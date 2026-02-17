// services/chat.service.ts
import type { ChatRoom, ChatMessage } from '@/types/chat';

const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN;
const CHAT_APP_ID = import.meta.env.VITE_CHAT_APP_ID;
const REGISTRY_BASE = import.meta.env.VITE_API_BASE_REGISTRY;
const REGISTRY_ALT = import.meta.env.VITE_REGISTRY_ALT;

// Fallback chat replicas in case registry fails
const FALLBACK_CHAT_REPLICAS = [
    'https://selfstudychat.pythonanywhere.com',
    // Add more fallback URLs if available
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

// Fetch chat app replicas from registry with fallback
export async function fetchChatReplicas(): Promise<string[]> {
    const registries = [REGISTRY_BASE, REGISTRY_ALT];

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

                    if (replicas.length > 0) {
                        console.debug(`Found ${replicas.length} chat replicas from registry`);
                        return replicas;
                    }
                }
            }
        } catch (error) {
            console.debug(`Registry ${registry} unavailable, trying next...`);
        }
    }

    // Fallback to hardcoded replicas
    console.debug('Using fallback chat replicas');
    return FALLBACK_CHAT_REPLICAS;
}

// Get room count for a replica (with error handling)
async function getReplicaRoomCount(replicaUrl: string): Promise<number> {
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
        console.debug(`Failed to get room count for ${replicaUrl}, using fallback value`);
    }
    return 0;
}

// Check if IP is blocked on a replica
async function isIPBlocked(replicaUrl: string, ip: string): Promise<boolean> {
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
        console.debug(`Failed to check IP block status for ${replicaUrl}, assuming not blocked`);
    }
    return false;
}

// Check if room exists for IP on a replica - with silent handling for 404
async function getRoomForIP(replicaUrl: string, ip: string): Promise<ChatRoom | null> {
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
            return await response.json();
        } else if (response.status === 404) {
            // Room not found on this replica - this is expected, not an error
            return null;
        } else {
            console.debug(`Unexpected status ${response.status} when checking room for IP on ${replicaUrl}`);
            return null;
        }
    } catch (error) {
        // Only log network errors, not 404s
        if (error.name !== 'AbortError') {
            console.debug(`Failed to get room for IP on ${replicaUrl}:`, error.message || error);
        }
        return null;
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

// Select best replica for creating a room
export async function selectBestReplica(userIP: string): Promise<{ replicaUrl: string; existingRoom: ChatRoom | null }> {
    const replicas = await fetchChatReplicas();

    if (replicas.length === 0) {
        throw new Error('No chat servers available. Please try again later.');
    }

    // Check cached room first
    const cachedRoom = getCachedRoomForIP(userIP);
    if (cachedRoom) {
        try {
            const existingRoom = await getRoomForIP(cachedRoom.replicaUrl, userIP);
            if (existingRoom) {
                return { replicaUrl: cachedRoom.replicaUrl, existingRoom };
            }
        } catch (error) {
            console.debug('Cached room check failed, continuing with normal discovery');
        }
    }

    // Check replicas in parallel for better performance
    const replicaChecks = replicas.map(async (replicaUrl) => {
        try {
            const existingRoom = await getRoomForIP(replicaUrl, userIP);
            if (existingRoom) {
                return { replicaUrl, existingRoom };
            }
        } catch (error) {
            console.debug(`Room check failed for ${replicaUrl}`);
        }
        return null;
    });

    // Wait for all checks to complete
    const results = await Promise.allSettled(replicaChecks);
    
    // Find first successful result with a room
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            return result.value;
        }
    }

    // If no existing room found, check for blocked IPs
    const unblockedReplicas: string[] = [];
    const blockChecks = replicas.map(async (replicaUrl) => {
        try {
            const isBlocked = await isIPBlocked(replicaUrl, userIP);
            if (!isBlocked) {
                unblockedReplicas.push(replicaUrl);
            }
        } catch (error) {
            console.debug(`IP block check failed for ${replicaUrl}`);
            // If we can't check, assume not blocked
            unblockedReplicas.push(replicaUrl);
        }
    });

    await Promise.allSettled(blockChecks);

    if (unblockedReplicas.length === 0) {
        throw new Error('Your IP is blocked from accessing chat services.');
    }

    // Get room counts for load balancing
    const replicaCounts = await Promise.allSettled(
        unblockedReplicas.map(async (replicaUrl) => {
            try {
                const count = await getReplicaRoomCount(replicaUrl);
                return { replicaUrl, count };
            } catch (error) {
                console.debug(`Room count failed for ${replicaUrl}`);
                return { replicaUrl, count: Infinity };
            }
        })
    );

    // Filter out failed replicas and sort by room count
    const validReplicas = replicaCounts
        .filter(result => 
            result.status === 'fulfilled' && 
            result.value && 
            result.value.count !== Infinity
        )
        .map(result => (result as PromiseFulfilledResult<{ replicaUrl: string; count: number }>).value)
        .sort((a, b) => a.count - b.count);

    if (validReplicas.length === 0) {
        // Fallback to first unblocked replica
        return { replicaUrl: unblockedReplicas[0], existingRoom: null };
    }

    // Return replica with least rooms
    return { replicaUrl: validReplicas[0].replicaUrl, existingRoom: null };
}

// Create or get chat room
export async function getChatRoom(ip: string): Promise<{ room: ChatRoom; replicaUrl: string }> {
    const { replicaUrl, existingRoom } = await selectBestReplica(ip);

    if (existingRoom) {
        // Cache the found room
        cacheRoomForIP(ip, replicaUrl, existingRoom.id);
        return { room: existingRoom, replicaUrl };
    }

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