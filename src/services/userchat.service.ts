// src/services/userchat.service.ts
//
// Client for the Self Study User Chat backend (app 35).
//
// **This is not the support chat.** `chat.service.ts` talks to Self Study Chat
// (app 9), the anonymous visitor widget that reaches an operator through
// selfstudyadmin. This service is signed-in people messaging each other, and the
// two share nothing but a word in their names — do not merge them.
//
// Five things here are load-bearing before changing anything:
//
// 1. **Every call carries `X-User-ID`.** The service token says a Self Study
//    client is calling; the header says who for. Without it the backend answers
//    400, and it is what every permission decision is made against.
// 2. **The client mints the message id**, and the backend adopts it as the
//    record's uid. That is what makes `sendText` safe to retry: a re-POST of a
//    message whose response was lost is an idempotent update rather than the same
//    sentence twice. Every chat app has that bug on a flaky connection; this is
//    the fix, and it only works if the id is generated here.
// 3. **A one-to-one room is opened, never created.** `openDirect` is idempotent
//    across replicas because the backend derives the room id from the two user
//    ids — see `direct_room_id` in its utils/serializers.py.
// 4. **An attachment is uploaded first, then referenced by a message.** Two
//    requests on purpose: the picture uploads while the caption is still being
//    typed, and retrying the message does not re-upload the picture.
// 5. **`attachmentUrl` fetches with the token and returns an object URL.** An
//    `<img src>` cannot send an Authorization header, which is why nothing on this
//    platform ever points a browser at a raw media URL. The blobs are cached per
//    tab so scrolling back through a conversation does not re-fetch them.

import { ApiError, apiService, withReplicas } from './api';
import { serviceRegistry } from './config';

export const USER_CHAT_APP_ID = parseInt(import.meta.env.VITE_USER_CHAT_APP_ID || '35');

export type RoomRole = 'owner' | 'admin' | 'member';
export type RoomKind = 'direct' | 'group';
export type MessageKind = 'text' | 'image' | 'audio' | 'file' | 'system';

export interface ChatMember {
    room_id: string;
    user_id: string;
    username: string;
    full_name: string;
    role: RoomRole;
    muted: boolean;
    last_read_at: string;
    invited_by?: string;
    invited_by_username?: string;
    created_at?: string;
}

export interface ChatAttachment {
    attachment_id: string;
    room_id: string;
    message_id?: string;
    kind: 'image' | 'audio' | 'file';
    mime: string;
    filename?: string;
    byte_size: number;
    /** What it weighed before the service compressed it. 0 when unknown. */
    compressed_from?: number;
    owner_id?: string;
    sha256?: string;
    width?: number;
    height?: number;
    duration_ms?: number;
    /** A sub-kilobyte data URL, so a bubble can render before the real fetch. */
    thumbnail?: string;
}

export interface ChatMessage {
    message_id: string;
    room_id: string;
    kind: MessageKind;
    text: string;
    attachment_id?: string;
    attachment?: ChatAttachment;
    reply_to?: string;
    metadata?: Record<string, any>;
    sender_id: string;
    sender_username: string;
    edited: boolean;
    edited_at?: string;
    created_at?: string;
    updated_at?: string;
    /** Present on an incremental read: this message was deleted. */
    deleted?: boolean;
    /** Client-only, never sent: this message has not been acknowledged yet. */
    pending?: boolean;
    /** Client-only: the send failed and can be retried. */
    failed?: boolean;
}

export interface ChatRoom {
    room_id: string;
    name: string;
    kind: RoomKind;
    topic: string;
    avatar_color: string;
    created_by: string;
    created_by_username: string;
    is_archived: boolean;
    created_at?: string;
    updated_at?: string;
    last_message_at?: string;
    last_message_preview?: string;
    last_message_kind?: string;
    last_message_sender?: string;
    last_message_sender_id?: string;
    my_role?: RoomRole;
    member_count?: number;
    message_count?: number;
    unread?: number;
    muted?: boolean;
    last_read_at?: string;
    members?: ChatMember[];
    participants?: Participant[];
    /** Only on the direct-room endpoint: whether it was made just now. */
    created?: boolean;
}

export interface Participant {
    user_id: string;
    username: string;
    colour: string;
    typing: boolean;
    idle_seconds: number;
}

export interface LivePoll {
    room_id: string;
    at: string;
    since: string;
    my_role: RoomRole;
    count: number;
    messages: ChatMessage[];
    participants: Participant[];
    unread: number;
    last_message_at?: string;
}

export interface MessagePage {
    room_id: string;
    at: string;
    my_role: RoomRole;
    count: number;
    has_more: boolean;
    next_before: string;
    messages: ChatMessage[];
}

export interface UnreadSummary {
    total: number;
    rooms: number;
    at: string;
    results: Array<{
        room_id: string;
        name: string;
        kind: RoomKind;
        unread: number;
        muted: boolean;
        last_message_at: string;
        last_message_preview: string;
        last_message_sender: string;
    }>;
}

class UserChatService {
    private readonly APP_ID = USER_CHAT_APP_ID;

    /** Object URLs for attachments already fetched in this tab.
     *
     *  Keyed by attachment id, which identifies the *content* — an attachment is
     *  never rewritten — so this can be cached for the life of the tab without any
     *  invalidation. `revokeAttachments` exists for the logout path, because an
     *  object URL keeps its blob alive in memory until it is revoked. */
    private blobUrls = new Map<string, string>();
    private inFlight = new Map<string, Promise<string>>();

    private headers(userId: string, username = ''): Record<string, string> {
        const out: Record<string, string> = {};
        if (userId) out['X-User-ID'] = userId;
        if (username) out['X-User-Name'] = username;
        return out;
    }

    /** Run a call against this tab's replica, failing over only when one is
     *  genuinely down. A 404 here means "no such room, or you are not in it" and
     *  every replica holds the same records, so asking another is a slower way to
     *  get the same answer — see `withReplicas` in api.ts. */
    private call<T>(fn: (base: string) => Promise<T>): Promise<T> {
        return withReplicas(this.APP_ID, 'userchat', fn);
    }

    async getReplica(): Promise<string | null> {
        return serviceRegistry.getRandomUserChatReplica();
    }

    /** A message id, minted here so a retry is idempotent. See the note at the
     *  top of this file — this is not a convenience. */
    newMessageId(): string {
        const webcrypto = globalThis.crypto;
        // Feature-detected through `any` on purpose. The DOM lib declares
        // `randomUUID` as always present, so narrowing on it types the fallback
        // branch below as `never` — which is TypeScript being more confident
        // about older Safari and any non-secure-context page than it should be.
        const randomUUID = (webcrypto as any)?.randomUUID;
        if (typeof randomUUID === 'function') return randomUUID.call(webcrypto);

        // A v4 UUID from getRandomValues, for the browsers where randomUUID is
        // missing but crypto is not. The backend validates the shape, so a
        // hand-rolled string has to be a real v4.
        const bytes = new Uint8Array(16);
        webcrypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // ----------------------------------------------------------------- rooms

    async listRooms(userId: string, includeArchived = false): Promise<{ count: number; results: ChatRoom[] }> {
        const query = includeArchived ? '?include_archived=1' : '';
        return this.call(base => apiService.get<any>(
            base, `/api/userchat/rooms/${query}`, this.headers(userId)));
    }

    async getRoom(userId: string, roomId: string): Promise<ChatRoom> {
        return this.call(base => apiService.get<ChatRoom>(
            base, `/api/userchat/rooms/${roomId}/`, this.headers(userId)));
    }

    async createGroup(userId: string, username: string, values: {
        name: string;
        topic?: string;
        avatar_color?: string;
        members?: Array<{ user_id: string; username?: string; role?: RoomRole }>;
    }): Promise<ChatRoom> {
        return this.call(base => apiService.post<ChatRoom>(
            base, '/api/userchat/rooms/', values, this.headers(userId, username)));
    }

    /** Open the one-to-one conversation with somebody, creating it only if it does
     *  not exist. Idempotent across replicas and safe to call on every click —
     *  the backend derives the room id from the pair of user ids, so both people
     *  and both replicas arrive at the same room. */
    async openDirect(userId: string, username: string, otherId: string, otherName = ''): Promise<ChatRoom> {
        return this.call(base => apiService.post<ChatRoom>(
            base, '/api/userchat/rooms/direct/',
            { user_id: otherId, username: otherName },
            this.headers(userId, username)));
    }

    async updateRoom(userId: string, roomId: string, values: Partial<ChatRoom>): Promise<ChatRoom> {
        return this.call(base => apiService.patch<ChatRoom>(
            base, `/api/userchat/rooms/${roomId}/`, values, this.headers(userId)));
    }

    async deleteRoom(userId: string, roomId: string): Promise<void> {
        await this.call(base => apiService.delete(
            base, `/api/userchat/rooms/${roomId}/`, undefined, this.headers(userId)));
    }

    async leaveRoom(userId: string, username: string, roomId: string): Promise<any> {
        return this.call(base => apiService.post<any>(
            base, `/api/userchat/rooms/${roomId}/leave/`, {},
            this.headers(userId, username)));
    }

    /** Move this user's read mark to now. Never throws: a failed read receipt is
     *  a badge that clears a moment later, and surfacing it as an error on every
     *  room open would train people to ignore real ones. */
    async markRead(userId: string, roomId: string): Promise<number> {
        try {
            const data = await this.call(base => apiService.post<any>(
                base, `/api/userchat/rooms/${roomId}/read/`, {}, this.headers(userId)));
            return data?.unread ?? 0;
        } catch {
            return -1;
        }
    }

    // --------------------------------------------------------------- members

    async listMembers(userId: string, roomId: string): Promise<{ count: number; results: ChatMember[]; my_role: RoomRole }> {
        return this.call(base => apiService.get<any>(
            base, `/api/userchat/rooms/${roomId}/members/`, this.headers(userId)));
    }

    async addMember(userId: string, username: string, roomId: string,
                    target: { user_id: string; username?: string; role?: RoomRole }): Promise<ChatMember> {
        return this.call(base => apiService.post<ChatMember>(
            base, `/api/userchat/rooms/${roomId}/members/`, target,
            this.headers(userId, username)));
    }

    async changeRole(userId: string, roomId: string, targetId: string, role: RoomRole): Promise<ChatMember> {
        return this.call(base => apiService.patch<ChatMember>(
            base, `/api/userchat/rooms/${roomId}/members/${targetId}/`, { role },
            this.headers(userId)));
    }

    async removeMember(userId: string, roomId: string, targetId: string): Promise<void> {
        await this.call(base => apiService.delete(
            base, `/api/userchat/rooms/${roomId}/members/${targetId}/`, undefined,
            this.headers(userId)));
    }

    /** Mute or unmute this room for yourself. A member may do this to their own
     *  row without being an admin — it is a personal setting that happens to live
     *  on the membership record. */
    async setMuted(userId: string, roomId: string, muted: boolean): Promise<ChatMember> {
        return this.call(base => apiService.patch<ChatMember>(
            base, `/api/userchat/rooms/${roomId}/members/${userId}/`, { muted },
            this.headers(userId)));
    }

    // -------------------------------------------------------------- messages

    async listMessages(userId: string, roomId: string, options: {
        limit?: number; before?: string; since?: string;
    } = {}): Promise<MessagePage> {
        const params = new URLSearchParams();
        if (options.limit) params.set('limit', String(options.limit));
        if (options.before) params.set('before', options.before);
        if (options.since) params.set('since', options.since);
        const query = params.toString() ? `?${params}` : '';
        return this.call(base => apiService.get<MessagePage>(
            base, `/api/userchat/rooms/${roomId}/messages/${query}`,
            this.headers(userId)));
    }

    /**
     * Send a message.
     *
     * `messageId` is required rather than optional, so a caller cannot
     * accidentally give up the idempotency: the UI mints it, renders the bubble
     * immediately, and passes the same id to a retry. See `newMessageId`.
     */
    async send(userId: string, username: string, roomId: string, payload: {
        messageId: string;
        text?: string;
        kind?: Exclude<MessageKind, 'system'>;
        attachmentId?: string;
        replyTo?: string;
    }): Promise<ChatMessage> {
        return this.call(base => apiService.post<ChatMessage>(
            base, `/api/userchat/rooms/${roomId}/messages/`, {
                message_id: payload.messageId,
                kind: payload.kind || 'text',
                text: payload.text || '',
                attachment_id: payload.attachmentId || '',
                reply_to: payload.replyTo || '',
            }, this.headers(userId, username)));
    }

    async editMessage(userId: string, roomId: string, messageId: string, text: string): Promise<ChatMessage> {
        return this.call(base => apiService.patch<ChatMessage>(
            base, `/api/userchat/rooms/${roomId}/messages/${messageId}/`, { text },
            this.headers(userId)));
    }

    async deleteMessage(userId: string, roomId: string, messageId: string): Promise<void> {
        await this.call(base => apiService.delete(
            base, `/api/userchat/rooms/${roomId}/messages/${messageId}/`, undefined,
            this.headers(userId)));
    }

    /** Unread counts for every room, in one request. What the sidebar badge polls
     *  when no room is open, and what tells the app when to ring. */
    async unreadSummary(userId: string): Promise<UnreadSummary> {
        return this.call(base => apiService.get<UnreadSummary>(
            base, '/api/userchat/unread/?all=1', this.headers(userId)));
    }

    // ------------------------------------------------------------------ live

    /**
     * One live tick: hand over this user's heartbeat, receive everyone else's
     * messages.
     *
     * `since` is the caller's high-water mark — the `at` from the previous tick.
     * The backend clamps it to its own window, so a tab that has been asleep gets
     * a bounded answer rather than an hour of conversation.
     *
     * Returns null instead of throwing when a tick fails. A live poll runs every
     * couple of seconds; a rejection that propagated would tear the thread down
     * over a single dropped request, and the next tick almost always succeeds. A
     * 403 or 404 *is* rethrown — that is access being revoked while the room is
     * open, and the caller has to stop polling rather than retry forever.
     */
    async poll(userId: string, username: string, roomId: string, payload: {
        since?: string; typing?: boolean; leaving?: boolean;
    } = {}): Promise<LivePoll | null> {
        try {
            const query = payload.since ? `?since=${encodeURIComponent(payload.since)}` : '';
            return await this.call(base => apiService.post<LivePoll>(
                base, `/api/userchat/rooms/${roomId}/live/${query}`, payload,
                this.headers(userId, username)));
        } catch (error) {
            if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
                throw error;
            }
            return null;
        }
    }

    /** Tell the others this tab has gone, rather than leaving a stale "online"
     *  dot until the TTL expires. */
    async leaveLive(userId: string, roomId: string): Promise<void> {
        try {
            await this.call(base => apiService.post(
                base, `/api/userchat/rooms/${roomId}/live/`, { leaving: true },
                this.headers(userId)));
        } catch {
            // Closing a tab is not a moment to raise anything; presence expires
            // on its own TTL either way.
        }
    }

    // ----------------------------------------------------------- attachments

    /**
     * Upload a picture or a voice note. Returns its metadata.
     *
     * Sent as a **raw body** rather than multipart: the data is already binary and
     * multipart wraps it in another encoding layer for no gain here. The backend
     * accepts both.
     *
     * The blob should already have been compressed by `chatMedia.ts` before it
     * gets here. The backend compresses again regardless — that is what makes the
     * limit a limit rather than a request — but doing it in the browser first is
     * what makes the *upload* fast, and it is the only saving that stops four
     * megabytes crossing the network at all.
     */
    async upload(userId: string, roomId: string, blob: Blob, options: {
        filename?: string; durationMs?: number;
    } = {}): Promise<ChatAttachment> {
        const params = new URLSearchParams();
        if (options.filename) params.set('filename', options.filename);
        if (options.durationMs) params.set('duration_ms', String(Math.round(options.durationMs)));
        const query = params.toString() ? `?${params}` : '';

        const replicas = await serviceRegistry.getReplicaOrder(this.APP_ID, 'userchat');
        if (!replicas.length) throw new ApiError('No replica of the chat service could be resolved.', 0);

        let lastError: unknown = null;
        for (const base of replicas) {
            try {
                // Hand-rolled rather than through ApiService, which only knows JSON
                // and FormData. An upload is neither: it is the bytes, with their
                // real Content-Type, which is also what the backend sniffs.
                const response = await fetch(
                    `${base}/api/userchat/rooms/${roomId}/attachments/${query}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Token ${import.meta.env.VITE_AUTH_TOKEN}`,
                            'Content-Type': blob.type || 'application/octet-stream',
                            ...this.headers(userId),
                        },
                        body: blob,
                        mode: 'cors',
                        credentials: 'omit',
                    });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    // The backend answers {field: [message]} — surface the message
                    // itself, because on this endpoint it is written to be read by
                    // the person who chose the file.
                    const detail = data?.file?.[0] || data?.error || data?.detail
                        || `Upload failed (${response.status})`;
                    throw new ApiError(detail, response.status, data);
                }
                return data as ChatAttachment;
            } catch (error) {
                const status = error instanceof ApiError ? error.status : 0;
                if (status && status < 500) throw error;
                serviceRegistry.dropReplica(this.APP_ID, base);
                lastError = error;
            }
        }
        throw lastError instanceof Error ? lastError
            : new ApiError('Every replica refused the upload.', 0);
    }

    /**
     * A URL an `<img>` or an `<audio>` can actually use.
     *
     * The attachment endpoint needs the service token and the `X-User-ID` header,
     * and an `<img src>` sends neither — which is why no page on this platform
     * ever points a browser straight at stored media. So the bytes are fetched
     * here and handed back as an object URL.
     *
     * Cached per tab and de-duplicated while in flight: a conversation being
     * scrolled will ask for the same picture from several components at once, and
     * without the in-flight map each of those becomes its own download.
     */
    async attachmentUrl(userId: string, attachmentId: string): Promise<string> {
        const cached = this.blobUrls.get(attachmentId);
        if (cached) return cached;

        const pending = this.inFlight.get(attachmentId);
        if (pending) return pending;

        const request = (async () => {
            const replicas = await serviceRegistry.getReplicaOrder(this.APP_ID, 'userchat');
            let lastError: unknown = null;
            for (const base of replicas) {
                try {
                    const response = await fetch(
                        `${base}/api/userchat/attachments/${attachmentId}/`, {
                            headers: {
                                'Authorization': `Token ${import.meta.env.VITE_AUTH_TOKEN}`,
                                ...this.headers(userId),
                            },
                            mode: 'cors',
                            credentials: 'omit',
                        });
                    if (response.status === 410) {
                        // The record exists and no replica still holds the bytes.
                        // Distinct from a 404 on purpose, and worth passing through
                        // as its own message rather than "not found".
                        throw new ApiError('This attachment is no longer stored.', 410);
                    }
                    if (!response.ok) throw new ApiError('Attachment unavailable', response.status);
                    const url = URL.createObjectURL(await response.blob());
                    this.blobUrls.set(attachmentId, url);
                    return url;
                } catch (error) {
                    const status = error instanceof ApiError ? error.status : 0;
                    if (status && status < 500) throw error;
                    serviceRegistry.dropReplica(this.APP_ID, base);
                    lastError = error;
                }
            }
            throw lastError instanceof Error ? lastError
                : new ApiError('Attachment unavailable', 0);
        })().finally(() => this.inFlight.delete(attachmentId));

        this.inFlight.set(attachmentId, request);
        return request;
    }

    /** Release every cached object URL. An object URL pins its blob in memory
     *  until revoked, so a long session that has scrolled through a lot of
     *  pictures will hold all of them; this is called on logout. */
    revokeAttachments() {
        for (const url of this.blobUrls.values()) URL.revokeObjectURL(url);
        this.blobUrls.clear();
    }
}

export const userChatService = new UserChatService();
