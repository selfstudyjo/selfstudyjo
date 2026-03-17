// services/chat.service.ts
import type { ChatRoom, ChatMessage } from '@/types/chat';

const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN;
const CHAT_APP_ID = import.meta.env.VITE_CHAT_APP_ID;
const REGISTRY_BASE = import.meta.env.VITE_API_BASE_REGISTRY;
const REGISTRY_ALT = import.meta.env.VITE_REGISTRY_ALT;

// Fallback chat replicas – all must support HTTPS
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

// Allowed domain patterns (to filter out misconfigured replicas)
const ALLOWED_REPLICA_PATTERNS = [
    /^https:\/\/selfstudychat\d*\.pythonanywhere\.com$/,
...FALLBACK_CHAT_REPLICAS.map(url => new RegExp(`^${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
];

// Cache for room counts
let roomCounts: { [url: string]: number } = {};

// Cache for user's chat room across sessions
const USER_ROOM_CACHE_KEY = 'chat_service_user_room_cache';

interface RoomCache {
    [ip: string]: {
        replicaUrl: string;
        roomId: number;
        timestamp: number;
    }
}

// Custom error types
class NetworkError extends Error {
    constructor(message: string, public readonly replicaUrl: string) {
        super(message);
        this.name = 'NetworkError';
    }
}

class ReplicaUnavailableError extends Error {
    constructor(message: string, public readonly replicaUrl: string) {
        super(message);
        this.name = 'ReplicaUnavailableError';
    }
}

// Get user's IP address
export async function getUserIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.debug('Failed to get IP, using anonymous ID:', error);
        // Fallback: Generate a random session ID
        return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Validate replica URL against allowed patterns
function isValidReplicaUrl(url: string): boolean {
    return ALLOWED_REPLICA_PATTERNS.some(pattern => pattern.test(url));
}

// Fetch chat app replicas from registry with fallback and validation
export async function fetchChatReplicas(): Promise<string[]> {
    const registries = [REGISTRY_BASE, REGISTRY_ALT];
    const isPageHttps = window.location.protocol === 'https:';

    for (const registry of registries) {
        try {
            const response = await fetch(`${registry}/apps/${CHAT_APP_ID}/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Token ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors',
                credentials: 'omit'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.replicas && Array.isArray(data.replicas)) {
                    const replicas = data.replicas
                    .filter((replica: any) => replica.replica_url && replica.is_active !== false)
                    .map((replica: any) => replica.replica_url.trim().replace(/\/$/, ''))
                    .filter((url: string) => url && url.startsWith('http'));

                    // Validate against allowed patterns
                    const validReplicas = replicas.filter(isValidReplicaUrl);

                    // In production (HTTPS), only keep HTTPS replicas
                    const secureReplicas = isPageHttps
                    ? validReplicas.filter(url => url.startsWith('https://'))
                    : validReplicas;

                    if (secureReplicas.length > 0) {
                        console.debug(`Found ${secureReplicas.length} valid chat replicas from registry`);
                        return secureReplicas;
                    }
                }
            }
        } catch (error) {
            console.debug(`Registry ${registry} unavailable, trying next...`);
        }
    }

    // Fallback to hardcoded replicas – also validate and enforce HTTPS
    console.debug('Using fallback chat replicas');
    const validFallback = FALLBACK_CHAT_REPLICAS.filter(isValidReplicaUrl);
    return isPageHttps
    ? validFallback.filter(url => url.startsWith('https://'))
    : validFallback;
}

// Get room count for a replica (with error handling)
async function getReplicaRoomCount(replicaUrl: string): Promise<number | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${replicaUrl}/api/chat-room-count/`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return data.chat_room_count || 0;
        }
    } catch (error) {
        console.debug(`Failed to get room count for ${replicaUrl}:`, error);
    }
    return null; // Indicates failure
}

// Check if IP is blocked on a replica (returns boolean or null on error)
async function isIPBlocked(replicaUrl: string, ip: string): Promise<boolean | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${replicaUrl}/api/check-blocked-ip/${encodeURIComponent(ip)}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return data.status === 'blocked';
        }
    } catch (error) {
        console.debug(`Failed to check IP block status for ${replicaUrl}:`, error);
    }
    return null; // Indicates failure
}

// Check if room exists for IP on a replica.
// Returns:
//   - { exists: true, room: ChatRoom } if room found (200)
//   - { exists: false } if room not found (404)
//   - { error: true } for network/CORS errors
async function getRoomForIP(replicaUrl: string, ip: string): Promise<{ exists: true; room: ChatRoom } | { exists: false } | { error: true }> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${replicaUrl}/api/chat-room/?anonymous_user_ip=${encodeURIComponent(ip)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const room = await response.json();
            return { exists: true, room };
        } else if (response.status === 404) {
            return { exists: false };
        } else {
            console.debug(`Unexpected status ${response.status} from ${replicaUrl}`);
            return { error: true };
        }
    } catch (error) {
        console.debug(`Network error checking room on ${replicaUrl}:`, error);
        return { error: true };
    }
}

// Get cached room for user from localStorage
function getCachedRoomForIP(ip: string): { replicaUrl: string; roomId: number } | null {
    try {
        const cache = localStorage.getItem(USER_ROOM_CACHE_KEY);
        if (cache) {
            const roomCache: RoomCache = JSON.parse(cache);
            const cachedRoom = roomCache[ip];

            // Check if cache is still valid (less than 24 hours old)
            if (cachedRoom && (Date.now() - cachedRoom.timestamp) < 24 * 60 * 60 * 1000) {
                return {
                    replicaUrl: cachedRoom.replicaUrl,
                    roomId: cachedRoom.roomId
                };
            }
        }
    } catch (error) {
        console.debug('Failed to read room cache:', error);
    }
    return null;
}

// Cache room for user in localStorage
function cacheRoomForIP(ip: string, replicaUrl: string, roomId: number): void {
    try {
        const cache = localStorage.getItem(USER_ROOM_CACHE_KEY);
        let roomCache: RoomCache = cache ? JSON.parse(cache) : {};

        roomCache[ip] = {
            replicaUrl,
            roomId,
            timestamp: Date.now()
        };

        // Clean up old entries (older than 7 days)
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        Object.keys(roomCache).forEach(key => {
            if (roomCache[key].timestamp < weekAgo) {
                delete roomCache[key];
            }
        });

        localStorage.setItem(USER_ROOM_CACHE_KEY, JSON.stringify(roomCache));
    } catch (error) {
        console.debug('Failed to cache room:', error);
    }
}

// Select best replica for creating a room.
// Returns:
//   - { replicaUrl, existingRoom } if an existing room is found on a reachable replica.
//   - { replicaUrl, existingRoom: null } if no existing room found, and we have a replica confirmed to have no room.
//   - Throws error if no suitable replica available.
export async function selectBestReplica(userIP: string): Promise<{ replicaUrl: string; existingRoom: ChatRoom | null }> {
    const replicas = await fetchChatReplicas();

    if (replicas.length === 0) {
        throw new Error('No chat servers available. Please try again later.');
    }

    // Check cached room first (fast path)
    const cachedRoom = getCachedRoomForIP(userIP);
    if (cachedRoom) {
        const result = await getRoomForIP(cachedRoom.replicaUrl, userIP);
        if (result.exists) {
            return { replicaUrl: cachedRoom.replicaUrl, existingRoom: result.room };
        }
        // If cached room not found (maybe deleted), we'll continue.
    }

    // Phase 1: Check all replicas for existing room, categorizing results.
    const checks = await Promise.allSettled(
        replicas.map(async (replicaUrl) => {
            const result = await getRoomForIP(replicaUrl, userIP);
            return { replicaUrl, result };
        })
    );

    const existingRooms: Array<{ replicaUrl: string; room: ChatRoom }> = [];
    const noRoomReplicas: string[] = [];
    const failedReplicas: string[] = [];

    for (const check of checks) {
        if (check.status === 'rejected') {
            // Should not happen because getRoomForIP doesn't throw, but just in case.
            failedReplicas.push(check.reason?.replicaUrl || 'unknown');
            continue;
        }
        const { replicaUrl, result } = check.value;
        if (result.exists) {
            existingRooms.push({ replicaUrl, room: result.room });
        } else if (result.exists === false) {
            noRoomReplicas.push(replicaUrl);
        } else {
            // error occurred
            failedReplicas.push(replicaUrl);
        }
    }

    // If any existing room found, return the first one (prefer cached if it was among them)
    if (existingRooms.length > 0) {
        // Optionally, we could pick the one with least load, but for simplicity take first.
        const { replicaUrl, room } = existingRooms[0];
        cacheRoomForIP(userIP, replicaUrl, room.id);
        return { replicaUrl, existingRoom: room };
    }

    // No existing room found. We need a replica that we are sure has no room.
    // If we have at least one replica with confirmed no room, we can proceed.
    if (noRoomReplicas.length === 0) {
        // All replicas either failed or returned errors. We cannot safely create a new room.
        throw new Error('Unable to verify chat room status. Please check your connection and try again.');
    }

    // Phase 2: Among replicas with no room, check IP block status and load.
    const blockChecks = await Promise.allSettled(
        noRoomReplicas.map(async (replicaUrl) => {
            const blocked = await isIPBlocked(replicaUrl, userIP);
            return { replicaUrl, blocked };
        })
    );

    const unblockedReplicas: string[] = [];

    for (const check of blockChecks) {
        if (check.status === 'fulfilled' && check.value.blocked === false) {
            unblockedReplicas.push(check.value.replicaUrl);
        } else if (check.status === 'fulfilled' && check.value.blocked === null) {
            // Block check failed, but we know there's no room; we can still try this replica.
            // We'll include it but with lower priority.
            unblockedReplicas.push(check.value.replicaUrl);
        }
        // If blocked === true, skip.
    }

    if (unblockedReplicas.length === 0) {
        throw new Error('Your IP is blocked from accessing chat services.');
    }

    // Phase 3: Get room counts for load balancing among unblocked replicas.
    const countChecks = await Promise.allSettled(
        unblockedReplicas.map(async (replicaUrl) => {
            const count = await getReplicaRoomCount(replicaUrl);
            return { replicaUrl, count };
        })
    );

    // Filter replicas that returned a valid count, and sort by count.
    const validReplicas = countChecks
    .filter((result): result is PromiseFulfilledResult<{ replicaUrl: string; count: number | null }> =>
    result.status === 'fulfilled'
    )
    .map(result => result.value)
    .filter((item): item is { replicaUrl: string; count: number } => item.count !== null)
    .sort((a, b) => a.count - b.count);

    let selectedReplica: string;

    if (validReplicas.length > 0) {
        selectedReplica = validReplicas[0].replicaUrl;
    } else {
        // If all count checks failed, just pick the first unblocked replica.
        selectedReplica = unblockedReplicas[0];
    }

    return { replicaUrl: selectedReplica, existingRoom: null };
}

// Create or get chat room
export async function getChatRoom(ip: string): Promise<{ room: ChatRoom; replicaUrl: string }> {
    const { replicaUrl, existingRoom } = await selectBestReplica(ip);

    if (existingRoom) {
        return { room: existingRoom, replicaUrl };
    }

    // No existing room, create a new one on the selected replica.
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${replicaUrl}/api/chat-room/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal,
            body: JSON.stringify({ anonymous_user_ip: ip })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create room: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const room = await response.json();

        // Cache the newly created room
        cacheRoomForIP(ip, replicaUrl, room.id);

        // Update room count cache
        roomCounts[replicaUrl] = (roomCounts[replicaUrl] || 0) + 1;

        return { room, replicaUrl };
    } catch (error) {
        console.error('Failed to create chat room:', error);
        throw new Error(`Failed to create chat room: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Send message
export async function sendMessage(
    replicaUrl: string,
    ip: string,
    message: string
): Promise<{ response: string }> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${replicaUrl}/api/send-message/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal,
            body: JSON.stringify({
                anonymous_user_ip: ip,
                message
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send message: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
    }
}

// Get messages for a room
export async function getMessages(replicaUrl: string, roomId: number): Promise<ChatMessage[]> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${replicaUrl}/api/all-chat-messages/${roomId}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const messages = await response.json();
            return messages.map((msg: any) => ({
                ...msg,
                is_unread: msg.sender !== 'anonymous' && !msg.is_seen
            }));
        } else if (response.status === 404) {
            // Room not found or deleted
            console.debug(`Room ${roomId} not found on ${replicaUrl}`);
            return [];
        }
    } catch (error) {
        console.debug('Failed to get messages:', error);
    }
    return [];
}

// Mark admin messages as seen
export async function markAdminMessagesAsSeen(replicaUrl: string, roomId: number): Promise<void> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch(`${replicaUrl}/api/all-chat-messages/${roomId}/mark-admin-seen/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
    } catch (error) {
        console.debug('Failed to mark admin messages as seen:', error);
    }
}

// Start polling for new messages
export function startMessagePolling(
    replicaUrl: string,
    roomId: number,
    callback: (messages: ChatMessage[]) => void,
                                    interval: number = 5000
): NodeJS.Timeout {
    return setInterval(async () => {
        try {
            const messages = await getMessages(replicaUrl, roomId);
            callback(messages);
        } catch (error) {
            console.debug('Chat polling error:', error);
        }
    }, interval);
}

// Calculate unread count
export function calculateUnreadCount(messages: ChatMessage[]): number {
    return messages.filter(msg => msg.is_unread).length;
}
