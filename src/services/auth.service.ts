import { apiService } from './api';
import { serviceRegistry } from './config';

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    message: string;
    token: string;
    user_id: string;
    expires_at: string;
    requires_verification?: boolean;
    verification_domain?: string;
    user_profile_domain?: string;
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    lab_url?: string;
    is_email_verified?: boolean;
    is_admin?: boolean;
}

export interface TokenVerification {
    valid: boolean;
    user_id: string;
    expires_at: string;
}

export interface LogoutRequest {
    token: string;
}

export interface LogoutResponse {
    message: string;
}

export interface TokenValidationResponse {
    token: string;
    user_id: string;
    is_valid: boolean;
    validation_details: {
        expired: boolean;
        active: boolean;
        checks_performed: {
            expiry: boolean;
            active: boolean;
        };
        errors: string[];
    };
    metadata: {
        created_at: string;
        expires_at: string;
        ip_address?: string;
        user_agent?: string;
        time_remaining_seconds: number;
        time_remaining_days: number;
        age_days: number;
    };
}

/**
 * Custom error class preserving backend data + status.
 * This lets callers detect e.g. `requires_verification`
 * without losing the original response object.
 */
export class AuthError extends Error {
    status?: number;
    data?: any;

    constructor(message: string, status?: number, data?: any) {
        super(message);
        this.name = 'AuthError';
        this.status = status;
        this.data = data;
    }
}

class AuthService {
    private tokenKey = 'auth_token';
    private userKey = 'auth_user';
    private lastVerificationKey = 'last_token_verification';
    private verificationInterval = 15 * 60 * 1000; // 15 minutes

    async login(credentials: LoginRequest): Promise<LoginResponse> {
        const baseUrl = await serviceRegistry.getRandomAuthReplica();
        if (!baseUrl) {
            throw new AuthError('Authentication service is currently unavailable. Please try again later.');
        }

        try {
            const response = await apiService.post<LoginResponse>(
                baseUrl,
                '/api/login/',
                credentials
            );

            if (response.token) {
                this.setToken(response.token);
                this.setUser({
                    id: response.user_id,
                    token: response.token,
                    expiresAt: response.expires_at,
                    username: response.username,
                    email: response.email,
                    first_name: response.first_name,
                    last_name: response.last_name,
                    image_url: response.image_url,
                    lab_url: response.lab_url,
                    is_email_verified: response.is_email_verified,
                    is_admin: response.is_admin,
                });
                localStorage.setItem(this.lastVerificationKey, Date.now().toString());
            }
            return response;
        } catch (error: any) {
            const status = error?.status;
            const data = error?.data;

            // Handle email-not-verified path — this is a valid response flow, not an error
            if (status === 403 && data?.requires_verification) {
                return data as LoginResponse;
            }

            // Map backend messages to user-friendly messages,
            // but preserve structured error for the caller.
            let userMessage: string;

            if (status === 401) {
                userMessage = data?.message || 'Invalid username or password. Please check your credentials.';
            } else if (status === 503) {
                userMessage = data?.message || 'Service is temporarily unavailable. Please try again later.';
            } else if (status === 400) {
                userMessage = data?.message || data?.error || 'Invalid request. Please check your input.';
            } else if (status === 404) {
                userMessage = data?.message || 'User not found.';
            } else if (error?.message?.toLowerCase().includes('network')) {
                userMessage = 'Network error. Please check your internet connection.';
            } else if (data?.message) {
                userMessage = data.message;
            } else if (data?.error) {
                userMessage = data.error;
            } else {
                userMessage = error?.message || 'Login failed. Please try again.';
            }

            throw new AuthError(userMessage, status, data);
        }
    }

    async logout(token: string): Promise<LogoutResponse> {
        const baseUrl = await serviceRegistry.getRandomAuthReplica();
        if (!baseUrl) {
            this.clearAuth();
            return { message: 'Logged out locally (service unavailable)' };
        }

        try {
            const response = await apiService.post<LogoutResponse>(
                baseUrl,
                '/api/logout/',
                { token }
            );
            this.clearAuth();
            return response;
        } catch (error) {
            this.clearAuth();
            return { message: 'Logged out locally' };
        }
    }

    async verifyToken(token: string, userId?: string): Promise<TokenVerification> {
        const baseUrl = await serviceRegistry.getRandomAuthReplica();
        if (!baseUrl) {
            throw new Error('Authentication service unavailable');
        }

        const data: any = { token };
        if (userId) {
            data.user_id = userId;
        }

        return await apiService.post<TokenVerification>(
            baseUrl,
            '/api/verify-token/',
            data
        );
    }

    async validateToken(token: string): Promise<TokenValidationResponse> {
        const baseUrl = await serviceRegistry.getRandomAuthReplica();
        if (!baseUrl) {
            throw new Error('Authentication service unavailable');
        }

        try {
            const verification = await this.verifyToken(token);
            const is_valid = verification.valid;
            return {
                token,
                user_id: verification.user_id,
                is_valid: is_valid,
                validation_details: {
                    expired: !is_valid,
                    active: is_valid,
                    checks_performed: {
                        expiry: true,
                        active: true
                    },
                    errors: is_valid ? [] : ['Token expired or invalid']
                },
                metadata: {
                    created_at: new Date().toISOString(),
                    expires_at: verification.expires_at,
                    ip_address: undefined,
                    user_agent: undefined,
                    time_remaining_seconds: 0,
                    time_remaining_days: 0,
                    age_days: 0
                }
            };
        } catch (error) {
            // Fall back to external endpoints
            try {
                return await apiService.get<TokenValidationResponse>(
                    baseUrl,
                    `/api/external/tokens/validate/?token=${token}&check_expiry=true&check_active=true`
                );
            } catch (getError: any) {
                try {
                    return await apiService.post<TokenValidationResponse>(
                        baseUrl,
                        '/api/external/tokens/validate/',
                        {
                            token,
                            check_expiry: true,
                            check_active: true,
                        }
                    );
                } catch (postError: any) {
                    throw new Error('Token validation failed on all endpoints');
                }
            }
        }
    }

    async isAuthenticated(): Promise<boolean> {
        const token = this.getToken();
        const user = this.getUser();

        if (!token || !user) {
            return false;
        }

        // Local expiry check
        if (user.expiresAt) {
            const expiresAt = new Date(user.expiresAt);
            const now = new Date();
            if (now >= expiresAt) {
                this.clearAuth();
                return false;
            }
        }

        // Skip remote verification if recent
        const lastVerification = localStorage.getItem(this.lastVerificationKey);
        if (lastVerification) {
            const lastVerificationTime = parseInt(lastVerification, 10);
            if (Date.now() - lastVerificationTime < this.verificationInterval) {
                return true;
            }
        }

        try {
            const validation = await this.validateToken(token);
            localStorage.setItem(this.lastVerificationKey, Date.now().toString());
            return validation.is_valid && validation.validation_details.errors.length === 0;
        } catch (error) {
            if (user.expiresAt) {
                const expiresAt = new Date(user.expiresAt);
                const now = new Date();
                const isValid = expiresAt > now;
                if (!isValid) {
                    this.clearAuth();
                }
                return isValid;
            }
            return false;
        }
    }

    async checkAndRefreshAuth(): Promise<boolean> {
        try {
            const authenticated = await this.isAuthenticated();
            if (!authenticated) {
                this.clearAuth();
            }
            return authenticated;
        } catch (error) {
            this.clearAuth();
            return false;
        }
    }

    setToken(token: string): void {
        localStorage.setItem(this.tokenKey, token);
    }

    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    setUser(user: {
        id: string;
        token: string;
        expiresAt: string;
        username?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        image_url?: string;
        lab_url?: string;
        is_email_verified?: boolean;
        is_admin?: boolean;
    }): void {
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    getUser(): {
        id: string;
        token: string;
        expiresAt: string;
        username?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        image_url?: string;
        lab_url?: string;
        is_email_verified?: boolean;
        is_admin?: boolean;
    } | null {
        const userStr = localStorage.getItem(this.userKey);
        return userStr ? JSON.parse(userStr) : null;
    }

    clearAuth(): void {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.lastVerificationKey);
    }

    getAuthHeaders(): Record<string, string> {
        const token = this.getToken();
        return token ? { 'X-Auth-Token': token } : {};
    }
}

export const authService = new AuthService();