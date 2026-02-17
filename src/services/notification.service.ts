// services/notification.service.ts
import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse } from '@/utils/api-utils';

export interface Notification {
    notification_id?: string;
    title: string;
    message: string;
    notification_type: 'general' | 'personal' | 'group';
    sender: string;
    recipient: string;
    read?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface NotificationResponse {
    notification_id: string;
    title: string;
    message: string;
    notification_type: string;
    sender: string;
    recipient: string;
    read: boolean;
    created_at: string;
    updated_at: string;
}

export interface NotificationCount {
    recipient: string;
    total_count: number;
    unread_count: number;
}

export interface PaginatedNotifications {
    count: number;
    next: string | null;
    previous: string | null;
    results: NotificationResponse[];
}

export interface MarkAllReadResponse {
    message: string;
    recipient: string;
    updated_count: number;
}

export interface NotificationStats {
    recipient: string;
    total_personal: number;
    unread_personal: number;
    total_general: number;
    total_group: number;
}

class NotificationService {
    private readonly APP_ID = 16;

    async getNotificationReplicas(): Promise<string[]> {
        return serviceRegistry.getServiceReplicas(this.APP_ID, 'notification');
    }

    async getRandomNotificationReplica(): Promise<string | null> {
        const replicas = await this.getNotificationReplicas();
        return serviceRegistry.getRandomReplica(replicas);
    }

    async createNotification(notificationData: Notification): Promise<NotificationResponse> {
        const baseUrl = await this.getRandomNotificationReplica();
        if (!baseUrl) {
            throw new Error('No notification service replicas available');
        }

        try {
            const payload = {
                ...notificationData,
                read: notificationData.read || false
            };

            return await apiService.post<NotificationResponse>(
                baseUrl,
                '/api/notifications/',
                payload
            );
        } catch (error: any) {
            console.error('Create notification failed:', error);
            throw error;
        }
    }

    async getNotificationsForUser(username: string, page = 1, pageSize = 20): Promise<PaginatedNotifications> {
        const baseUrl = await this.getRandomNotificationReplica();
        if (!baseUrl) {
            throw new Error('No notification service replicas available');
        }

        try {
            const response = await apiService.get<any>(
                baseUrl,
                `/api/notifications/user-notifications/?recipient=${username}&page=${page}&page_size=${pageSize}`
            );

            return this.parseNotificationsResponse(response);
        } catch (error: any) {
            console.error('Failed to get notifications:', error);
            return {
                count: 0,
                next: null,
                previous: null,
                results: []
            };
        }
    }

    private parseNotificationsResponse(response: any): PaginatedNotifications {
        let results: any[] = [];
        let count = 0;
        let next = null;
        let previous = null;

        if (response.results && Array.isArray(response.results)) {
            results = response.results;
            count = response.count || results.length;
            next = response.next;
            previous = response.previous;
        } else if (Array.isArray(response)) {
            results = response;
            count = results.length;
        } else {
            const normalized = normalizePaginatedResponse<any>(response);
            results = normalized.results;
            count = normalized.count;
            next = normalized.next;
            previous = normalized.previous;
        }

        // Map notifications with proper formatting
        const mappedResults = results.map((notification: any) => ({
            notification_id: notification.notification_id || notification.id,
            title: notification.title,
            message: notification.message,
            notification_type: notification.notification_type,
            sender: notification.sender,
            recipient: notification.recipient,
            read: notification.read || false,
            created_at: notification.created_at,
            updated_at: notification.updated_at
        }));

        return {
            count: mappedResults.length,
            next,
            previous,
            results: mappedResults
        };
    }

    async getNotificationCount(username: string): Promise<NotificationCount> {
        const baseUrl = await this.getRandomNotificationReplica();
        if (!baseUrl) {
            throw new Error('No notification service replicas available');
        }

        try {
            const response = await apiService.get<NotificationCount>(
                baseUrl,
                `/api/notification-count/?recipient=${username}`
            );

            return response;
        } catch (error: any) {
            console.error('Failed to get notification count:', error);
            return {
                recipient: username,
                total_count: 0,
                unread_count: 0
            };
        }
    }

    async getNotificationStats(username: string): Promise<NotificationStats> {
        const baseUrl = await this.getRandomNotificationReplica();
        if (!baseUrl) {
            throw new Error('No notification service replicas available');
        }

        try {
            const response = await apiService.get<NotificationStats>(
                baseUrl,
                `/api/notification-stats/?recipient=${username}`
            );

            return response;
        } catch (error: any) {
            console.error('Failed to get notification stats:', error);
            return {
                recipient: username,
                total_personal: 0,
                unread_personal: 0,
                total_general: 0,
                total_group: 0
            };
        }
    }

    async markNotificationAsRead(notificationId: string): Promise<NotificationResponse> {
        const baseUrl = await this.getRandomNotificationReplica();
        if (!baseUrl) {
            throw new Error('No notification service replicas available');
        }

        try {
            // Try the mark-as-read endpoint first
            return await apiService.patch<NotificationResponse>(
                baseUrl,
                `/api/notifications/${notificationId}/mark-as-read/`,
                {}
            );
        } catch (error: any) {
            if (error.status === 403) {
                // If permission denied (non-personal notification), return the notification as-is
                throw new Error('Cannot mark non-personal notifications as read');
            } else if (error.status === 404) {
                // Fallback to updating the notification directly
                return await apiService.patch<NotificationResponse>(
                    baseUrl,
                    `/api/notifications/${notificationId}/`,
                    { read: true }
                );
            }
            throw error;
        }
    }

    async markAllAsRead(username: string): Promise<MarkAllReadResponse> {
        const baseUrl = await this.getRandomNotificationReplica();
        if (!baseUrl) {
            throw new Error('No notification service replicas available');
        }

        try {
            return await apiService.post<MarkAllReadResponse>(
                baseUrl,
                `/api/notifications/mark-all-as-read/`,
                { recipient: username }
            );
        } catch (error: any) {
            console.error('Bulk mark as read failed:', error);

            // Fallback: mark each personal notification individually
            const notifications = await this.getNotificationsForUser(username, 1, 100);
            const personalUnread = notifications.results.filter(
                n => !n.read && n.notification_type === 'personal'
            );

            for (const notification of personalUnread) {
                try {
                    await this.markNotificationAsRead(notification.notification_id);
                } catch (err) {
                    console.error(`Failed to mark notification ${notification.notification_id} as read:`, err);
                }
            }

            return {
                message: `Marked ${personalUnread.length} personal notifications as read`,
                recipient: username,
                updated_count: personalUnread.length
            };
        }
    }

    async deleteNotification(notificationId: string): Promise<void> {
        const baseUrl = await this.getRandomNotificationReplica();
        if (!baseUrl) {
            throw new Error('No notification service replicas available');
        }

        try {
            await apiService.delete(baseUrl, `/api/notifications/${notificationId}/`);
        } catch (error: any) {
            if (error.status === 403) {
                throw new Error('Cannot delete non-personal notifications');
            }
            throw error;
        }
    }

    // Helper method to check if user is in group recipients
    isUserInGroupRecipients(notification: NotificationResponse, username: string): boolean {
        if (notification.notification_type !== 'group') return false;
        const recipients = notification.recipient.split(',').map(r => r.trim());
        return recipients.includes(username);
    }
}

export const notificationService = new NotificationService();
