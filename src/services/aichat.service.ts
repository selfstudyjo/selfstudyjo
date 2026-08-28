/**
 * src/services/aichat.service.ts — the AI Chat Assistant's rooms and history.
 *
 * Talks to app 27's `/api/aichat/*`. Replaces `ai.service.ts`, which is deleted:
 * that file held `VITE_AUTH_TOKEN` itself, fetched the registry itself with its
 * own ordered-fallback loop, and picked a replica with its own round-robin
 * counter — three copies of things `ServiceRegistry` and `ApiService` already
 * do, one of which (the replica choice) was actively wrong.
 *
 * WHY THE REPLICA PIN MATTERS MORE HERE THAN ANYWHERE
 * ===================================================
 *
 * The old service advanced `currentIndex` after every successful call, so
 * consecutive turns of one conversation went to DIFFERENT replicas. That was
 * harmless while the chat was stateless and is not now: replication on app 27
 * is push-then-repair, so a message written to replica 1 reaches replica 2 a
 * moment later. Re-picking per call is a coin flip on whether the reply you are
 * about to get was composed with the message you just sent.
 *
 * `serviceRegistry.getRandomAiReplica()` picks at random on the FIRST call —
 * which is what spreads users across replicas — and then pins that choice for
 * the life of the tab. Working rule 31 is about exactly this: nine services
 * wrote their own `getRandomXReplica()` wrapper and every one of them dropped
 * the argument that applies the pin. This calls the shared one.
 */

import { apiService, ApiError } from './api';
import { serviceRegistry } from './config';
import { aiLanguageHeaders } from '@/i18n/runtime';
import type { ChatContext, ChatMessage, ChatRoomSummary } from '@/utils/aichatRooms';

export type { ChatContext, ChatMessage, ChatRoomSummary };

export interface SendResult {
    message: ChatMessage;
    user_message: ChatMessage;
    room: ChatRoomSummary;
    /**
     * True when the backend has queued a memory rebuild for this room.
     *
     * The rebuild happens on a daemon thread whether or not anybody is looking,
     * and is re-derived from the record if the worker doing it dies — so this
     * is not something the client has to act on. It exists so the Memory panel
     * can say the brief it is showing is about to change, rather than the
     * reader wondering why it is one exchange behind. There is deliberately no
     * timer chasing it: guessing when a provider round trip finishes is how a
     * `setTimeout` ends up outliving the thing it belonged to.
     */
    context_pending: boolean;
}

class AiChatService {
    /**
     * The pinned replica for app 27.
     *
     * Not cached in a field here. `ServiceRegistry` owns the pin; a second cache
     * in front of it is a second thing to invalidate when `dropReplica()` moves
     * the pin after a replica stops answering.
     */
    private async base(): Promise<string> {
        const url = await serviceRegistry.getRandomAiReplica();
        if (!url) throw new Error('The AI service is unavailable');
        return url;
    }

    /**
     * Who the request is for.
     *
     * `X-User-ID` is the platform convention and app 27 accepts it. It is not
     * an authenticated claim here — the gateway (app 37) is what replaces it
     * with one from a verified token — so the backend must not be publicly
     * reachable once that is deployed. Sent as a header rather than in the
     * query string so it is not in anybody's access log.
     */
    private headers(userId: string, extra: Record<string, string> = {}) {
        return { 'X-User-ID': userId, ...extra };
    }

    async listRooms(userId: string, includeArchived = false): Promise<ChatRoomSummary[]> {
        const base = await this.base();
        const q = includeArchived ? '?include_archived=1' : '';
        const r = await apiService.get<{ rooms: ChatRoomSummary[] }>(
            base, `/api/aichat/rooms/${q}`, this.headers(userId));
        return r?.rooms || [];
    }

    async createRoom(userId: string, body: {
        title?: string; topic?: string; brief?: string; username?: string;
    } = {}): Promise<ChatRoomSummary> {
        const base = await this.base();
        // The language goes with it, so the room records which language the
        // conversation is being held in rather than which one the reader
        // happens to have selected when they open it again next month.
        const r = await apiService.post<{ room: ChatRoomSummary }>(
            base, '/api/aichat/rooms/', body,
            this.headers(userId, aiLanguageHeaders()));
        return r.room;
    }

    async getRoom(userId: string, roomId: string):
        Promise<{ room: ChatRoomSummary; messages: ChatMessage[] }> {
        const base = await this.base();
        return apiService.get(base, `/api/aichat/rooms/${encodeURIComponent(roomId)}/`,
                              this.headers(userId));
    }

    async updateRoom(userId: string, roomId: string, patch: {
        title?: string; topic?: string; brief?: string;
        pinned?: boolean; archived?: boolean;
    }): Promise<ChatRoomSummary> {
        const base = await this.base();
        // PATCH, never PUT. Every field is optional upstream and omitting one
        // means "leave it alone"; a whole-record write from this screen would
        // blank the brief every time somebody renamed a chat.
        const r = await apiService.patch<{ room: ChatRoomSummary }>(
            base, `/api/aichat/rooms/${encodeURIComponent(roomId)}/`, patch,
            this.headers(userId));
        return r.room;
    }

    async deleteRoom(userId: string, roomId: string): Promise<void> {
        const base = await this.base();
        await apiService.delete(base, `/api/aichat/rooms/${encodeURIComponent(roomId)}/`,
                                undefined, this.headers(userId));
    }

    /**
     * Send one message and wait for the reply.
     *
     * `id` is minted by the CALLER, so a retry is an update rather than a second
     * copy of the same sentence — see `newMessageId` in `aichatRooms.ts`.
     *
     * A 503 here means the providers could not be reached AND the question was
     * stored, which is a materially different outcome from a network failure
     * where it may not have been. The caller needs to tell them apart to decide
     * whether a retry could duplicate anything, so the status is preserved on
     * the thrown error rather than flattened into a message.
     */
    async send(userId: string, roomId: string, id: string, content: string):
        Promise<SendResult> {
        const base = await this.base();
        return apiService.post<SendResult>(
            base, `/api/aichat/rooms/${encodeURIComponent(roomId)}/messages/`,
            { id, content }, this.headers(userId, aiLanguageHeaders()));
    }

    async clearRoom(userId: string, roomId: string): Promise<ChatRoomSummary> {
        const base = await this.base();
        const r = await apiService.delete<{ room: ChatRoomSummary }>(
            base, `/api/aichat/rooms/${encodeURIComponent(roomId)}/messages/`,
            undefined, this.headers(userId));
        return r.room;
    }

    async getContext(userId: string, roomId: string): Promise<ChatContext> {
        const base = await this.base();
        return apiService.get<ChatContext>(
            base, `/api/aichat/rooms/${encodeURIComponent(roomId)}/context/`,
            this.headers(userId));
    }

    async rebuildContext(userId: string, roomId: string): Promise<ChatRoomSummary> {
        const base = await this.base();
        const r = await apiService.post<{ room: ChatRoomSummary }>(
            base, `/api/aichat/rooms/${encodeURIComponent(roomId)}/context/`, {},
            this.headers(userId, aiLanguageHeaders()));
        return r.room;
    }
}

export const aiChatService = new AiChatService();

/**
 * True when the failure was app 27 refusing the request rather than the network
 * dropping it.
 *
 * The distinction decides what the retry button may safely do: a 503 from the
 * service means the message IS stored and only the reply is missing, so a retry
 * carrying the same id is free. Anything else and we do not know, which is
 * exactly why the id is minted client-side in the first place.
 */
export function isServiceRefusal(error: unknown): boolean {
    return error instanceof ApiError && (error.status || 0) >= 500;
}
