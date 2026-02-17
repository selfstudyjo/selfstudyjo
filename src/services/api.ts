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
            console.error('❌ VITE_AUTH_TOKEN is missing or invalid!');
            console.error('Current token:', token);
            throw new Error('Authentication token is required but missing or invalid. Check your .env file.');
        }

        // Add CORS headers for cross-origin requests
        headers['Accept'] = 'application/json';
        headers['Origin'] = window.location.origin;

        return headers;
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        console.log(`Response status: ${response.status} ${response.statusText}`);
        console.log(`Response URL: ${response.url}`);

        const contentType = response.headers.get('content-type');
        let responseData: any;

        // Try to parse response data
        if (contentType && contentType.includes('application/json')) {
            try {
                responseData = await response.json();
                console.log('Response data:', responseData);
            } catch (error) {
                console.error('Failed to parse JSON response:', error);
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
            console.error('❌ Error response data:', JSON.stringify(responseData, null, 2));

            if (response.status === 400) {
                console.error('400 Bad Request details:', {
                    url: response.url,
                    status: response.status,
                    data: responseData,
                    headers: Object.fromEntries(response.headers.entries())
                });
            }

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
        console.log(`🚀 API ${method}: ${url}`);

        if (data) {
            console.log('Request data:', {
                ...(data instanceof FormData ? { formData: 'FormData object' } : data),
                        password: data.password ? '[HIDDEN]' : undefined
            });
        }

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
            console.log(`🚀 API DELETE with query params: ${urlWithParams}`);

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
            // For FormData, let browser set Content-Type automatically
            const requestHeaders: Record<string, string> = {
                ...baseHeaders
            };

            // Remove Content-Type if it exists in the provided headers
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
            console.error('Failed to get IP:', error);
            // Fallback: Generate a random session ID
            return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    }

    // Get chat service URL
    async getChatServiceUrl(): Promise<string | null> {
        try {
            return await serviceRegistry.getRandomChatReplica();
        } catch (error) {
            console.error('Failed to get chat service URL:', error);
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
            console.error('Failed to get/create chat room:', error);
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
            console.error('Failed to send chat message:', error);
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
            console.error('Failed to get chat messages:', error);
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
            console.warn('Failed to mark admin messages as seen:', error);
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
                console.error('Chat polling error:', error);
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
        console.error('Failed to create chat session:', error);
        return { userIP: '', room: null, chatServiceUrl: null };
    }
}
