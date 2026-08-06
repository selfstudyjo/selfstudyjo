// services/chat.service.ts
//
// Client for Self Study Chat (app 9).
//
// This used to hunt for the visitor's room across every replica, because each
// replica held its own rooms and only one of them had yours. Opening the chat
// cost roughly thirty requests — a room lookup, a block check and a room count
// against all ten replicas — and it refused to start at all unless enough of
// them answered, so one slow replica showed the visitor "Unable to verify chat
// room status".
//
// The backend now replicates: every replica holds every room and every message,
// and a write on one reaches the rest. So the client talks to *one* replica,
// and the hunt is replaced by two facts:
//
//   * `POST /api/chat-room/` is get-or-create. Ask any replica and you get the
//     visitor's room, existing or new — no need to know which replica "owns" it.
//   * Any replica can serve any room. So a replica failing mid-conversation is
//     no longer fatal: the next call transparently moves to another one and the
//     conversation continues.
//
// Opening the chat is now two requests instead of ~30, and it succeeds as long
// as *one* replica is reachable rather than requiring most of them to be.

import type { ChatRoom, ChatMessage } from '@/types/chat';

const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN;
const CHAT_APP_ID = import.meta.env.VITE_CHAT_APP_ID;
const REGISTRY_BASE = import.meta.env.VITE_API_BASE_REGISTRY;
const REGISTRY_ALT = import.meta.env.VITE_REGISTRY_ALT;

// Used only when both registry instances are unreachable. Stale by nature —
// the registry is the source of truth for which replicas exist.
const FALLBACK_CHAT_REPLICAS = [
    'https://selfstudychat.pythonanywhere.com',
    'https://selfstudychat2.pythonanywhere.com',
    'https://selfstudychat3.pythonanywhere.com',
    'https://selfstudychat4.pythonanywhere.com',
    'https://selfstudychat5.pythonanywhere.com',
    'https://selfstudychat6.pythonanywhere.com',
    'https://selfstudychat7.pythonanywhere.com',
    'https://selfstudychat8.pythonanywhere.com',
    'https://selfstudychat9.pythonanywhere.com',
    'https://selfstudychat10.pythonanywhere.com',
];

// Guards against a malformed registry entry pointing the chat at something that
// is not a chat replica.
const ALLOWED_REPLICA_PATTERN = /^https:\/\/selfstudychat\d*\.pythonanywhere\.com$/;

const REPLICA_CACHE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;

let replicaCache: { urls: string[]; at: number } | null = null;
// The replica this visitor is currently talking to. A hint, not a binding:
// every call falls over to another replica if this one stops answering.
let pinnedReplica: string | null = null;

export class ChatBlockedError extends Error {
    constructor() {
        super('Your IP address is blocked from sending messages.');
        this.name = 'ChatBlockedError';
    }
}

export class ChatUnavailableError extends Error {
    constructor(message = 'No chat server is reachable right now.') {
        super(message);
        this.name = 'ChatUnavailableError';
    }
}

// Get the visitor's IP. Only used as the room key — the backend treats it as an
// opaque identifier, so the fallback below works just as well.
export async function getUserIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        if (data?.ip) return data.ip;
    } catch (error) {
        console.debug('Failed to get IP, using an anonymous id instead:', error);
    }
    let anonymous = localStorage.getItem('chat_anonymous_id');
    if (!anonymous) {
        // Persisted, so a visitor who cannot be geolocated still returns to the
        // same conversation on their next visit instead of a fresh empty room.
        anonymous = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        localStorage.setItem('chat_anonymous_id', anonymous);
    }
    return anonymous;
}

function shuffle<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

// Resolve the replica list from the registry, trying both instances.
export async function fetchChatReplicas(): Promise<string[]> {
    if (replicaCache && Date.now() - replicaCache.at < REPLICA_CACHE_MS) {
        return replicaCache.urls;
    }

    for (const registry of [REGISTRY_BASE, REGISTRY_ALT].filter(Boolean)) {
        try {
            const response = await fetch(`${registry}/apps/${CHAT_APP_ID}/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Token ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                mode: 'cors',
                credentials: 'omit',
            });
            if (!response.ok) continue;

            const data = await response.json();
            const urls: string[] = (data?.replicas ?? [])
                .map((replica: any) => String(replica?.replica_url ?? '').trim().replace(/\/$/, ''))
                // The registry stores some replicas as http://. The page is
                // https, so those would be blocked as mixed content.
                .map((url: string) => url.replace(/^http:/, 'https:'))
                .filter((url: string) => ALLOWED_REPLICA_PATTERN.test(url));

            if (urls.length) {
                replicaCache = { urls: shuffle(urls), at: Date.now() };
                return replicaCache.urls;
            }
        } catch {
            // Try the other registry instance.
        }
    }

    console.debug('Registry unreachable; falling back to the built-in replica list');
    replicaCache = { urls: shuffle(FALLBACK_CHAT_REPLICAS), at: Date.now() };
    return replicaCache.urls;
}

async function callReplica(
    replicaUrl: string,
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await fetch(`${replicaUrl}${path}`, {
            ...init,
            headers: {
                'Authorization': `Token ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(init.headers ?? {}),
            },
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Run a call against the pinned replica, moving to another one if it fails.
 *
 * Only transport failures and 5xx trigger a move — every replica holds the same
 * data, so a 404 means the record is genuinely gone and asking a different
 * replica would just be a slower way to get the same answer.
 */
async function withReplica<T>(
    handle: (response: Response) => Promise<T> | T,
    path: string,
    init: RequestInit = {},
    preferred?: string | null,
): Promise<T> {
    const all = await fetchChatReplicas();
    if (!all.length) throw new ChatUnavailableError();

    const first = preferred ?? pinnedReplica;
    const order = first && all.includes(first) ? [first, ...all.filter(u => u !== first)] : all;

    let lastError: unknown = null;
    for (const replicaUrl of order) {
        try {
            const response = await callReplica(replicaUrl, path, init);
            if (response.status >= 500) {
                lastError = new Error(`${replicaUrl} answered ${response.status}`);
                continue;
            }
            pinnedReplica = replicaUrl;
            return await handle(response);
        } catch (error) {
            lastError = error;
        }
    }
    console.debug('Every chat replica failed:', lastError);
    throw new ChatUnavailableError();
}

export function currentReplica(): string | null {
    return pinnedReplica;
}

/**
 * The visitor's room, creating it if they do not have one.
 *
 * One request. `POST /api/chat-room/` is get-or-create on the backend and every
 * replica knows about every room, so there is nothing to search for: 201 means
 * a new room, 200 means they already had one.
 */
export async function getChatRoom(ip: string): Promise<{ room: ChatRoom; replicaUrl: string }> {
    const room = await withReplica<ChatRoom>(
        async (response) => {
            if (response.status === 403) throw new ChatBlockedError();
            if (!response.ok) {
                throw new Error(`Failed to open the chat room: ${response.status} ${await response.text()}`);
            }
            return response.json();
        },
        '/api/chat-room/',
        { method: 'POST', body: JSON.stringify({ anonymous_user_ip: ip }) },
    );
    return { room, replicaUrl: pinnedReplica! };
}

export async function isIPBlocked(ip: string): Promise<boolean> {
    try {
        // 200 means blocked, 404 means not — the backend has answered this way
        // since before the port and the shape is part of the contract.
        return await withReplica(
            (response) => response.status === 200,
            `/api/check-blocked-ip/${encodeURIComponent(ip)}/`,
            { method: 'GET' },
        );
    } catch {
        return false;   // never lock a visitor out because a replica was slow
    }
}

export async function sendMessage(
    replicaUrl: string,
    ip: string,
    message: string,
): Promise<{ response: string }> {
    return withReplica<{ response: string }>(
        async (response) => {
            if (response.status === 403) throw new ChatBlockedError();
            if (!response.ok) {
                throw new Error(`Failed to send message: ${response.status} ${await response.text()}`);
            }
            return response.json();
        },
        '/api/send-message/',
        { method: 'POST', body: JSON.stringify({ anonymous_user_ip: ip, message }) },
        replicaUrl,
    );
}

export async function getMessages(replicaUrl: string, roomId: number): Promise<ChatMessage[]> {
    try {
        return await withReplica<ChatMessage[]>(
            async (response) => {
                if (response.status === 404) return [];   // the room was deleted
                if (!response.ok) throw new Error(`status ${response.status}`);
                const messages = await response.json();
                return messages.map((msg: any) => ({
                    ...msg,
                    is_unread: msg.sender !== 'anonymous' && !msg.is_seen,
                }));
            },
            `/api/all-chat-messages/${roomId}/`,
            { method: 'GET' },
            replicaUrl,
        );
    } catch (error) {
        console.debug('Failed to get messages:', error);
        return [];
    }
}

export async function markAdminMessagesAsSeen(replicaUrl: string, roomId: number): Promise<void> {
    try {
        await withReplica(
            () => undefined,
            `/api/all-chat-messages/${roomId}/mark-admin-seen/`,
            { method: 'POST', body: '{}' },
            replicaUrl,
        );
    } catch (error) {
        console.debug('Failed to mark admin messages as seen:', error);
    }
}

export function startMessagePolling(
    replicaUrl: string,
    roomId: number,
    callback: (messages: ChatMessage[]) => void,
    interval: number = 5000,
): ReturnType<typeof setInterval> {
    return setInterval(async () => {
        try {
            // Deliberately not passing replicaUrl: if the replica the
            // conversation started on goes away, polling should follow the
            // conversation to a live one rather than going quiet.
            callback(await getMessages(pinnedReplica ?? replicaUrl, roomId));
        } catch (error) {
            console.debug('Chat polling error:', error);
        }
    }, interval);
}

export function calculateUnreadCount(messages: ChatMessage[]): number {
    return messages.filter(msg => msg.is_unread).length;
}
