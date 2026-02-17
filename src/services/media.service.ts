import { apiService } from './api';
import { serviceRegistry } from './config';

export interface MediaUploadResponse {
    id?: number;
    user_id: string;
    username?: string;
    image?: string;
    video?: string;
    created_at?: string;
    message?: string;
}

export interface ProfileImageResponse {
    id: number;
    user_id: string;
    username: string;
    image: string;
    created_at: string;
}

class MediaService {
    async uploadProfileImage(userId: string, username: string, imageFile: File): Promise<ProfileImageResponse> {
        const baseUrl = await serviceRegistry.getRandomMediaReplica();
        if (!baseUrl) {
            throw new Error('No media service replicas available');
        }

        // Create FormData
        const formData = new FormData();
        formData.append('user_id', userId);
        formData.append('username', username);
        formData.append('image', imageFile);

        try {
            // Do NOT set Content-Type header - browser will set it automatically with boundary
            const response = await apiService.post<ProfileImageResponse>(
                baseUrl,
                '/profile-images/',
                formData,
                {} // Empty headers object - let browser handle Content-Type
            );
            return response;
        } catch (error) {
            console.error('Profile image upload failed:', error);
            throw error;
        }
    }

    async deleteProfileImage(userId: string): Promise<{ message: string }> {
        const baseUrl = await serviceRegistry.getRandomMediaReplica();
        if (!baseUrl) {
            throw new Error('No media service replicas available');
        }

        try {
            return await apiService.delete<{ message: string }>(
                baseUrl,
                `/profile-images/${userId}/`
            );
        } catch (error) {
            console.error('Profile image deletion failed:', error);
            throw error;
        }
    }

    async getProfileImage(userId: string): Promise<ProfileImageResponse | null> {
        const baseUrl = await serviceRegistry.getRandomMediaReplica();
        if (!baseUrl) {
            throw new Error('No media service replicas available');
        }

        try {
            return await apiService.get<ProfileImageResponse>(
                baseUrl,
                `/profile-images/${userId}/`
            );
        } catch (error: any) {
            // If 404, return null (no profile image)
            if (error.status === 404) {
                return null;
            }
            console.error('Get profile image failed:', error);
            throw error;
        }
    }

    async updateProfileImage(userId: string, imageFile: File): Promise<ProfileImageResponse> {
        const baseUrl = await serviceRegistry.getRandomMediaReplica();
        if (!baseUrl) {
            throw new Error('No media service replicas available');
        }

        // Create FormData
        const formData = new FormData();
        formData.append('image', imageFile);

        try {
            // First try PATCH (update)
            return await apiService.patch<ProfileImageResponse>(
                baseUrl,
                `/profile-images/${userId}/`,
                formData,
                {} // Empty headers object
            );
        } catch (error: any) {
            // If PATCH fails with 404, the image might not exist yet
            if (error.status === 404) {
                throw new Error('Profile image not found. Please upload a new image.');
            }
            console.error('Profile image update failed:', error);
            throw error;
        }
    }

    async uploadProfileImageWithPatch(userId: string, username: string, imageFile: File): Promise<ProfileImageResponse> {
        const baseUrl = await serviceRegistry.getRandomMediaReplica();
        if (!baseUrl) {
            throw new Error('No media service replicas available');
        }

        // Create FormData
        const formData = new FormData();
        formData.append('user_id', userId);
        formData.append('username', username);
        formData.append('image', imageFile);

        try {
            // Try PATCH first (for updating existing)
            return await apiService.patch<ProfileImageResponse>(
                baseUrl,
                `/profile-images/${userId}/`,
                formData,
                {} // Empty headers object
            );
        } catch (error: any) {
            // If PATCH fails (404), try POST (create new)
            if (error.status === 404) {
                return await this.uploadProfileImage(userId, username, imageFile);
            }
            console.error('Profile image upload with PATCH failed:', error);
            throw error;
        }
    }

    getProfileImageUrl(imagePath: string): string {
        if (!imagePath) return '';

        // Check if it's already a full URL
        if (imagePath.startsWith('http')) {
            return imagePath;
        }

        // For relative paths, we might need to prepend base URL
        // This would depend on your setup
        return imagePath;
    }
}

export const mediaService = new MediaService();
