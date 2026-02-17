import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse } from '@/utils/api-utils';

export interface UserProfile {
    user_id: string;
    username: string;
    email: string;
    password?: string;
    first_name?: string;
    last_name?: string;
    gender?: 'M' | 'F';
    image_url?: string;
    lab_url?: string;
    is_email_verified?: boolean;
    date_joined?: string;
    last_updated?: string;
}

export interface UpdateProfileRequest {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    gender?: 'M' | 'F';
    image_url?: string;
    lab_url?: string;
}

export interface ChangePasswordRequest {
    current_password: string;
    new_password: string;
    confirm_password: string;
}

export interface RegisterResponse {
    user_id: string;
    username: string;
    email: string;
    message: string;
}

export interface EmailVerificationRequest {
    email: string;
    user_id: string;
}

export interface EmailVerificationResponse {
    status: string;
}

export interface CheckUsernameResponse {
    available: boolean;
}

export interface CheckEmailResponse {
    available: boolean;
}

export interface PasswordCheckRequest {
    username: string;
    password: string;
}

export interface PasswordCheckResponse {
    valid: boolean;
    user_id?: string;
    email?: string;
    is_email_verified?: boolean;
}

export interface DeleteAccountRequest {
    username: string;
    password: string;
}

export interface DeleteAccountResponse {
    status: string;
}

class UserService {
    async register(userData: UserProfile): Promise<RegisterResponse> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            return await apiService.post<RegisterResponse>(
                baseUrl,
                '/profiles/',
                userData
            );
        } catch (error) {
            console.error('Registration failed:', error);
            throw error;
        }
    }

    async verifyEmail(request: EmailVerificationRequest): Promise<EmailVerificationResponse> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            return await apiService.post<EmailVerificationResponse>(
                baseUrl,
                `/verify/${request.user_id}/verify_email/`,
                { email: request.email, user_id: request.user_id }
            );
        } catch (error) {
            console.error('Email verification failed:', error);
            throw error;
        }
    }

    async checkUsername(username: string): Promise<CheckUsernameResponse> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            return await apiService.get<CheckUsernameResponse>(
                baseUrl,
                `/check-username/${username.toLowerCase()}/`
            );
        } catch (error) {
            console.error('Username check failed:', error);
            throw error;
        }
    }

    async checkEmail(email: string): Promise<CheckEmailResponse> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            return await apiService.get<CheckEmailResponse>(
                baseUrl,
                `/check-email/${email.toLowerCase()}/`
            );
        } catch (error) {
            console.error('Email check failed:', error);
            throw error;
        }
    }

    async checkPassword(credentials: PasswordCheckRequest): Promise<PasswordCheckResponse> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            console.log('Checking password for username:', credentials.username);

            // Make sure username is lowercase
            const username = credentials.username.toLowerCase();

            const response = await apiService.post<PasswordCheckResponse>(
                baseUrl,
                '/check-password/',
                {
                    username: username,
                    password: credentials.password
                }
            );

            console.log('Password check response:', response);
            return response;
        } catch (error: any) {
            console.error('Password check failed with error:', error);

            // If we get a valid: false response (400 status with valid: false in data)
            if (error.status === 400 && error.data?.valid === false) {
                console.log('Received valid: false from server, returning it');
                return { valid: false };
            }

            // If we get any other error, check if it contains "valid: false"
            if (error.data?.valid === false) {
                return { valid: false };
            }

            throw error;
        }
    }

    async getUserProfile(userId: string): Promise<UserProfile> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            return await apiService.get<UserProfile>(
                baseUrl,
                `/profiles/${userId}/`
            );
        } catch (error) {
            console.error('Get user profile failed:', error);
            throw error;
        }
    }

    async getUserProfileByUsername(username: string): Promise<UserProfile> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            // First, get all profiles (paginated)
            const response = await apiService.get<any>(
                baseUrl,
                '/profiles/'
            );

            // Handle both array and paginated response
            let profiles: UserProfile[] = [];
            if (Array.isArray(response)) {
                profiles = response;
            } else if (response.results && Array.isArray(response.results)) {
                profiles = response.results;
            } else {
                // Try to normalize as paginated response
                const normalized = normalizePaginatedResponse<UserProfile>(response);
                profiles = normalized.results;
            }

            // Find user by username (case-insensitive)
            const userProfile = profiles.find(profile =>
            profile.username.toLowerCase() === username.toLowerCase()
            );

            if (!userProfile) {
                throw new Error(`User with username ${username} not found`);
            }

            return userProfile;
        } catch (error) {
            console.error('Get user profile by username failed:', error);
            throw error;
        }
    }

    async getAllUsernames(): Promise<string[]> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            let allUsernames: string[] = [];
            let nextUrl: string | null = '/profiles/';

            // Handle pagination
            while (nextUrl) {
                const response = await apiService.get<any>(baseUrl, nextUrl);

                let profiles: UserProfile[] = [];
                if (Array.isArray(response)) {
                    profiles = response;
                    nextUrl = null;
                } else if (response.results && Array.isArray(response.results)) {
                    profiles = response.results;
                    nextUrl = response.next ? new URL(response.next).pathname + new URL(response.next).search : null;
                } else {
                    // Try to normalize
                    const normalized = normalizePaginatedResponse<UserProfile>(response);
                    profiles = normalized.results;
                    nextUrl = normalized.next ? new URL(normalized.next).pathname + new URL(normalized.next).search : null;
                }

                allUsernames = [...allUsernames, ...profiles.map(profile => profile.username)];

                // Safety limit
                if (allUsernames.length >= 500) {
                    break;
                }

                // If no next page or we've reached the end
                if (!nextUrl || nextUrl === '/profiles/') {
                    break;
                }
            }

            return [...new Set(allUsernames)]; // Remove duplicates
        } catch (error) {
            console.error('Get all usernames failed:', error);
            throw error;
        }
    }

    async searchUsers(searchTerm: string, limit: number = 10): Promise<UserProfile[]> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            const response = await apiService.get<any>(baseUrl, '/profiles/');

            let profiles: UserProfile[] = [];
            if (Array.isArray(response)) {
                profiles = response;
            } else if (response.results && Array.isArray(response.results)) {
                profiles = response.results;
            } else {
                const normalized = normalizePaginatedResponse<UserProfile>(response);
                profiles = normalized.results;
            }

            // Filter by search term
            const filtered = profiles.filter(profile =>
            profile.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (profile.first_name && profile.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (profile.last_name && profile.last_name.toLowerCase().includes(searchTerm.toLowerCase()))
            );

            return filtered.slice(0, limit);
        } catch (error) {
            console.error('Search users failed:', error);
            throw error;
        }
    }

    async updateUserProfile(userId: string, updateData: UpdateProfileRequest): Promise<UserProfile> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            // Ensure username/email are lowercase
            if (updateData.username) {
                updateData.username = updateData.username.toLowerCase();
            }
            if (updateData.email) {
                updateData.email = updateData.email.toLowerCase();
            }

            return await apiService.patch<UserProfile>(
                baseUrl,
                `/profiles/${userId}/`,
                updateData
            );
        } catch (error) {
            console.error('Update user profile failed:', error);
            throw error;
        }
    }

    async changePassword(userId: string, passwordData: ChangePasswordRequest): Promise<UserProfile> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            // First get user to get the exact username (in lowercase)
            const user = await this.getUserProfile(userId);

            console.log('User profile retrieved for password change:', {
                userId: userId,
                username: user.username,
                email: user.email
            });

            // Verify current password
            console.log('Verifying current password...');
            const passwordCheck = await this.checkPassword({
                username: user.username.toLowerCase(), // Ensure lowercase
                                                           password: passwordData.current_password
            });

            console.log('Password check result:', passwordCheck);

            if (!passwordCheck.valid) {
                console.log('Current password is incorrect');
                throw new Error('Current password is incorrect');
            }

            if (passwordData.new_password !== passwordData.confirm_password) {
                console.log('New passwords do not match');
                throw new Error('New passwords do not match');
            }

            if (passwordData.new_password.length < 8) {
                console.log('New password is too short');
                throw new Error('New password must be at least 8 characters long');
            }

            // Update password
            console.log('Updating password for user:', userId);
            const result = await apiService.patch<UserProfile>(
                baseUrl,
                `/profiles/${userId}/`,
                { password: passwordData.new_password }
            );

            console.log('Password update successful:', result);
            return result;
        } catch (error) {
            console.error('Change password failed:', error);
            throw error;
        }
    }

    async deleteAccount(username: string, password: string): Promise<DeleteAccountResponse> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            console.log('Deleting account for username:', username);

            // First, get the user profile to get the user_id
            const userProfile = await this.getUserProfileByUsername(username.toLowerCase());

            console.log('Found user profile for deletion:', userProfile.user_id);

            // Try method 1: Use the profiles/{user_id}/ endpoint with DELETE
            try {
                await apiService.delete<any>(
                    baseUrl,
                    `/profiles/${userProfile.user_id}/`,
                    null // No body for this request
                );

                console.log('Account deleted via profiles endpoint');
                return { status: 'Account deleted successfully' };
            } catch (error: any) {
                console.log('Failed to delete via profiles endpoint, trying delete-account endpoint...');

                // Try method 2: Use delete-account endpoint with DELETE and query params
                const response = await apiService.delete<DeleteAccountResponse>(
                    baseUrl,
                    '/delete-account/',
                    {
                        username: username.toLowerCase(),
                                                                                password: password
                    }
                );

                console.log('Delete account response:', response);
                return response;
            }
        } catch (error: any) {
            console.error('Delete account failed:', error);

            // Check if it's a password error
            if (error.data?.error?.includes('Invalid password') ||
                error.message?.includes('Invalid password') ||
                error.data?.detail?.includes('Invalid password')) {
                throw new Error('Invalid password');
                }

                if (error.data?.error?.includes('User profile not found') ||
                    error.message?.includes('User profile not found')) {
                    throw new Error('User profile not found');
                    }

                    throw error;
        }
    }

    async getProfileCount(): Promise<{ count: number }> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            return await apiService.get<{ count: number }>(
                baseUrl,
                '/count/'
            );
        } catch (error) {
            console.error('Get profile count failed:', error);
            throw error;
        }
    }

    async profileLookup(userId: string): Promise<{ exists: boolean }> {
        const baseUrl = await serviceRegistry.getRandomUserProfileReplica();
        if (!baseUrl) {
            throw new Error('No user profile service replicas available');
        }

        try {
            return await apiService.get<{ exists: boolean }>(
                baseUrl,
                `/profiles/${userId}/lookup/`
            );
        } catch (error) {
            console.error('Profile lookup failed:', error);
            throw error;
        }
    }
}

export const userService = new UserService();
