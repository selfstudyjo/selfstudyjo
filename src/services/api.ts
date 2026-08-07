// services/api.ts
import { serviceRegistry } from './config';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    status?: number;
}

export interface ChatRoom {
    id: number;
    anonymous_user_ip: string;
    created_at: string;
    last_active: string;
}

export interface ChatMessage {
    id: number;
    sender: 'anonymous' | 'admin' | 'system';
    message: string;
    timestamp: string;
    is_seen: boolean;
    is_unread?: boolean;
}

export class ApiError extends Error {
    constructor(
        message: string,
        public status?: number,
            public data?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Run a call against one replica of a service, moving to another if it fails.
 *
 * Newly worth doing as of 2026-08-06. Before then, failing over would have shown
 * the user *different data*, because each replica of a backend held a different
 * slice of the records — so a retry against another replica was not a retry, it
 * was a different question. Every backend replicates now, so any of them can
 * answer for the whole service and a dead replica no longer has to mean a dead
 * page.
 *
 * **Only a transport failure or a 5xx moves on.** A 404 is the replica telling
 * you the record does not exist, and every replica holds the same records, so
 * asking another is a slower way to get the same answer. A 400 or a 401 is an
 * answer too. This is the same rule `chat.service.ts` has always applied and
 * working rule 3 in CLAUDE.md.
 *
 * The pin in `ServiceRegistry` is what makes this cheap: the first URL tried is
 * the one this tab has been using, so a healthy replica costs no extra request,
 * and a failover moves the pin so the next call goes straight to the survivor.
 *
 *     const courses = await withReplicas(19, 'course', (base) =>
 *         apiService.get<Course[]>(base, '/courses/'));
 */
export async function withReplicas<T>(
    appId: number,
    serviceName: string,
    call: (baseUrl: string) => Promise<T>,
): Promise<T> {
    const replicas = await serviceRegistry.getReplicaOrder(appId, serviceName);
    if (!replicas.length) {
        throw new ApiError(`No replica of ${serviceName} could be resolved.`, 0);
    }

    let lastError: unknown = null;
    for (const baseUrl of replicas) {
        try {
            return await call(baseUrl);
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0;
            // 0 is a transport failure (fetch rejected): the replica is not
            // answering at all. Anything below 500 is an answer, and answers are
            // the same on every replica.
            if (status && status < 500) throw error;
            serviceRegistry.dropReplica(appId, baseUrl);
            lastError = error;
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new ApiError(`Every replica of ${serviceName} failed.`, 0);
}

export class ApiService {
    private AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN;

    private getHeaders(additionalHeaders: Record<string, string> = {}, isFormData: boolean = false) {
        const headers: Record<string, string> = {
            ...additionalHeaders,
        };

        // Don't set Content-Type for FormData (let browser set it)
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        // ALWAYS add the AUTH_TOKEN - REQUIRED for backend APIs
        const token = this.AUTH_TOKEN;
        if (token && token !== 'Token Not Found!' && token !== 'your-actual-auth-token-here') {
            headers['Authorization'] = `Token ${token}`;
        } else {
            throw new Error('Authentication token is required but missing or invalid. Check your .env file.');
        }

        // Add CORS headers for cross-origin requests
        headers['Accept'] = 'application/json';
        headers['Origin'] = window.location.origin;

        return headers;
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        const contentType = response.headers.get('content-type');
        let responseData: any;

        // Try to parse response data
        if (contentType && contentType.includes('application/json')) {
            try {
                responseData = await response.json();
            } catch (error) {
                throw new ApiError('Invalid JSON response', 500);
            }
        } else {
            try {
                const text = await response.text();
                responseData = { text };
            } catch {
                responseData = {};
            }
        }

        // For password check endpoint, we want to handle 400 differently
        // because it returns { valid: false } when password is incorrect
        if (response.url.includes('/check-password/') && response.status === 400) {
            // Check if this is a password validation failure
            if (responseData?.valid === false) {
                return responseData as T;
            }
        }

        // For delete-account endpoint, handle 400 for invalid password
        if (response.url.includes('/delete-account/') && response.status === 400) {
            if (responseData?.error?.includes('Invalid password')) {
                throw new ApiError('Invalid password', 400, responseData);
            }
        }

        if (!response.ok) {
            throw new ApiError(
                responseData.error || responseData.message || responseData.detail ||
                (typeof responseData === 'string' ? responseData : `HTTP ${response.status}: ${response.statusText}`),
                               response.status,
                               responseData
            );
        }

        return responseData as T;
    }

    async request<T>(
        method: string,
        baseUrl: string,
        endpoint: string,
        data?: any,
        headers: Record<string, string> = {}
    ): Promise<T> {
        const url = `${baseUrl}${endpoint}`;

        // Get base headers
        const baseHeaders = this.getHeaders();

        // Special handling for DELETE requests with data
        if (method === 'DELETE' && data) {
            // For DELETE requests, we need to send data differently
            // Some servers don't accept DELETE with body, so we'll use query parameters
            const requestHeaders: Record<string, string> = {
                ...baseHeaders,
                ...headers
            };

            // Remove Content-Type for DELETE with query params
            delete requestHeaders['Content-Type'];

            // Convert data to query parameters
            const params = new URLSearchParams();
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined && data[key] !== null) {
                    params.append(key, data[key].toString());
                }
            });

            const urlWithParams = `${url}?${params.toString()}`;

            const options: RequestInit = {
                method: 'DELETE',
                headers: requestHeaders,
                mode: 'cors',
                credentials: 'omit',
                cache: 'no-cache'
            };

            try {
                const response = await fetch(urlWithParams, options);
                return await this.handleResponse<T>(response);
            } catch (error) {
                if (error instanceof ApiError) {
                    throw error;
                }
                throw new ApiError(
                    error instanceof Error ? error.message : 'Network error',
                    0,
                    error
                );
            }
        } else if (data instanceof FormData) {
            // Caller-supplied headers must be merged here just as they are for a
            // JSON body. Dropping them silently broke every multipart endpoint
            // that identifies the user with X-User-ID — the request arrived
            // authenticated but anonymous, and the backend answered
            // "X-User-ID header is required".
            const requestHeaders: Record<string, string> = {
                ...baseHeaders,
                ...headers
            };

            // Deleted AFTER the merge: the browser has to set Content-Type itself
            // so the multipart boundary matches the body it generates.
            delete requestHeaders['Content-Type'];

            const options: RequestInit = {
                method,
                headers: requestHeaders,
                mode: 'cors',
                credentials: 'omit',
                cache: 'no-cache',
                body: data
            };

            try {
                const response = await fetch(url, options);
                return await this.handleResponse<T>(response);
            } catch (error) {
                if (error instanceof ApiError) {
                    throw error;
                }
                throw new ApiError(
                    error instanceof Error ? error.message : 'Network error',
                    0,
                    error
                );
            }
        } else {
            // For JSON data, set Content-Type to application/json
            const requestHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                ...baseHeaders,
                ...headers
            };

            const options: RequestInit = {
                method,
                headers: requestHeaders,
                mode: 'cors',
                credentials: 'omit',
                cache: 'no-cache'
            };

            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }

            try {
                const response = await fetch(url, options);
                return await this.handleResponse<T>(response);
            } catch (error) {
                if (error instanceof ApiError) {
                    throw error;
                }
                throw new ApiError(
                    error instanceof Error ? error.message : 'Network error',
                    0,
                    error
                );
            }
        }
    }

    async get<T>(baseUrl: string, endpoint: string, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('GET', baseUrl, endpoint, undefined, headers);
    }

    async post<T>(baseUrl: string, endpoint: string, data: any, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('POST', baseUrl, endpoint, data, headers);
    }

    async put<T>(baseUrl: string, endpoint: string, data: any, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('PUT', baseUrl, endpoint, data, headers);
    }

    async patch<T>(baseUrl: string, endpoint: string, data: any, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('PATCH', baseUrl, endpoint, data, headers);
    }

    async delete<T>(baseUrl: string, endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('DELETE', baseUrl, endpoint, data, headers);
    }

    // CHAT-SPECIFIC METHODS

    // Get user's IP address
    async getUserIP(): Promise<string> {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            // Fallback: Generate a random session ID
            return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    }

    // Get chat service URL
    async getChatServiceUrl(): Promise<string | null> {
        try {
            return await serviceRegistry.getRandomChatReplica();
        } catch (error) {
            return null;
        }
    }

    // Get chat room
    async getChatRoom(ip: string): Promise<ChatRoom | null> {
        try {
            const chatServiceUrl = await this.getChatServiceUrl();
            if (!chatServiceUrl) {
                throw new Error('No chat service available');
            }

            // Try to get existing room
            try {
                const existingRoom = await this.get<ChatRoom>(
                    chatServiceUrl,
                    `/api/chat-room/?anonymous_user_ip=${encodeURIComponent(ip)}`
                );
                return existingRoom;
            } catch (error) {
                // If room doesn't exist, create one
                const newRoom = await this.post<ChatRoom>(
                    chatServiceUrl,
                    '/api/chat-room/',
                    { anonymous_user_ip: ip }
                );
                return newRoom;
            }
        } catch (error) {
            return null;
        }
    }

    // Send chat message
    async sendChatMessage(chatServiceUrl: string, ip: string, message: string): Promise<{ response: string } | null> {
        try {
            return await this.post<{ response: string }>(
                chatServiceUrl,
                '/api/send-message/',
                {
                    anonymous_user_ip: ip,
                    message
                }
            );
        } catch (error) {
            return null;
        }
    }

    // Get chat messages
    async getChatMessages(chatServiceUrl: string, roomId: number): Promise<ChatMessage[]> {
        try {
            return await this.get<ChatMessage[]>(
                chatServiceUrl,
                `/api/all-chat-messages/${roomId}/`
            );
        } catch (error) {
            return [];
        }
    }

    // Mark admin messages as seen
    async markAdminMessagesAsSeen(chatServiceUrl: string, roomId: number): Promise<boolean> {
        try {
            await this.post(
                chatServiceUrl,
                `/api/all-chat-messages/${roomId}/mark-admin-seen/`,
                {}
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    // Simple chat polling function
    startChatPolling(
        chatServiceUrl: string,
        roomId: number,
        callback: (messages: ChatMessage[]) => void,
                     interval: number = 5000
    ): NodeJS.Timeout {
        return setInterval(async () => {
            try {
                const messages = await this.getChatMessages(chatServiceUrl, roomId);
                callback(messages);
            } catch (error) {
                // ignore polling errors
            }
        }, interval);
    }
}

export const apiService = new ApiService();

// Helper function to get chat service with CORS handling
export async function getChatService(): Promise<string | null> {
    return apiService.getChatServiceUrl();
}

// Helper function to create chat session
export async function createChatSession(): Promise<{
    userIP: string;
    room: ChatRoom | null;
    chatServiceUrl: string | null;
}> {
    try {
        const userIP = await apiService.getUserIP();
        const chatServiceUrl = await getChatService();
        if (!chatServiceUrl) {
            return { userIP, room: null, chatServiceUrl: null };
        }

        const room = await apiService.getChatRoom(userIP);
        return { userIP, room, chatServiceUrl };
    } catch (error) {
        return { userIP: '', room: null, chatServiceUrl: null };
    }
}
