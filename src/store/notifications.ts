// store/notifications.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { notificationService } from '@/services/notification.service';
import type { NotificationResponse, NotificationStats, PaginatedNotifications } from '@/services/notification.service';

export const useNotificationStore = defineStore('notifications', () => {
    // State
    const notifications = ref<NotificationResponse[]>([]);
    const unreadCount = ref(0);
    const totalCount = ref(0);
    const generalCount = ref(0);
    const groupCount = ref(0);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const currentPage = ref(1);
    const pageSize = ref(20);
    const hasMore = ref(true);
    const currentUsername = ref<string>('');

    // Local storage key
    const getStorageKey = (username: string) => `notifications_${username}`;

    // Computed
    const personalNotifications = computed(() => {
        if (!currentUsername.value) return [];
        return notifications.value.filter(n =>
        n.notification_type === 'personal' && n.recipient === currentUsername.value
        );
    });

    const generalNotifications = computed(() => {
        return notifications.value.filter(n => n.notification_type === 'general');
    });

    const groupNotifications = computed(() => {
        if (!currentUsername.value) return [];
        return notifications.value.filter(n => {
            if (n.notification_type !== 'group') return false;
            // Parse recipient list for group notifications
            const recipients = n.recipient.split(',').map(r => r.trim());
            return recipients.includes(currentUsername.value);
        });
    });

    const unreadPersonalNotifications = computed(() => {
        return personalNotifications.value.filter(n => !n.read);
    });

    const allUserNotifications = computed(() => {
        if (!currentUsername.value) return [];

        // Combine all notification types for the current user
        const allNotifications = [
            ...personalNotifications.value,
            ...generalNotifications.value,
            ...groupNotifications.value
        ];

        // Sort by created_at descending
        return allNotifications.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    });

    const canModifyNotification = computed(() => (notification: NotificationResponse) => {
        // Only personal notifications can be modified
        return notification.notification_type === 'personal';
    });

    // Actions
    async function fetchNotifications(username: string, refresh = false) {
        if (!username) {
            error.value = 'Username is required';
            return;
        }

        currentUsername.value = username;
        loading.value = true;
        error.value = null;

        try {
            if (refresh) {
                currentPage.value = 1;
                hasMore.value = true;
            }

            const response = await notificationService.getNotificationsForUser(
                username,
                currentPage.value,
                pageSize.value
            );

            if (currentPage.value === 1 || refresh) {
                // Clear all notifications
                notifications.value = response.results;
            } else {
                // Append new notifications, avoiding duplicates
                const existingIds = new Set(notifications.value.map(n => n.notification_id));
                const newNotifications = response.results.filter(
                    n => !existingIds.has(n.notification_id)
                );
                notifications.value.push(...newNotifications);
            }

            hasMore.value = !!response.next;
            currentPage.value++;

            // Update stats
            await fetchNotificationStats(username);

            // Save to localStorage
            saveToLocalStorage(username);
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch notifications';
            console.error('Failed to fetch notifications:', err);
        } finally {
            loading.value = false;
        }
    }

    async function fetchNotificationCount(username: string) {
        if (!username) return;

        try {
            const count = await notificationService.getNotificationCount(username);

            // Only update if we got valid data
            if (count && typeof count.unread_count === 'number') {
                unreadCount.value = count.unread_count;
                totalCount.value = count.total_count;
                currentUsername.value = username;

                // Save to localStorage
                saveToLocalStorage(username);
            }
        } catch (err) {
            console.error('Failed to fetch notification count:', err);
            // Try to load from localStorage
            loadFromLocalStorage(username);
        }
    }

    async function fetchNotificationStats(username: string) {
        if (!username) return;

        try {
            const stats = await notificationService.getNotificationStats(username);

            // Update counts
            unreadCount.value = stats.unread_personal;
            totalCount.value = stats.total_personal;
            generalCount.value = stats.total_general;
            groupCount.value = stats.total_group;
            currentUsername.value = username;

            // Save to localStorage
            saveToLocalStorage(username);
        } catch (err) {
            console.error('Failed to fetch notification stats:', err);
            // Try to load from localStorage
            loadFromLocalStorage(username);
        }
    }

    function saveToLocalStorage(username: string) {
        if (!username) return;

        const data = {
            unreadCount: unreadCount.value,
            totalCount: totalCount.value,
            generalCount: generalCount.value,
            groupCount: groupCount.value,
            timestamp: Date.now()
        };

        localStorage.setItem(getStorageKey(username), JSON.stringify(data));
    }

    function loadFromLocalStorage(username: string) {
        if (!username) return;

        const saved = localStorage.getItem(getStorageKey(username));
        if (saved) {
            try {
                const data = JSON.parse(saved);
                unreadCount.value = data.unreadCount || 0;
                totalCount.value = data.totalCount || 0;
                generalCount.value = data.generalCount || 0;
                groupCount.value = data.groupCount || 0;
                currentUsername.value = username;
            } catch (e) {
                console.error('Failed to load from localStorage:', e);
            }
        }
    }

    async function markAsRead(notificationId: string) {
        try {
            const updatedNotification = await notificationService.markNotificationAsRead(notificationId);

            // Update in local state
            const index = notifications.value.findIndex(n => n.notification_id === notificationId);
            if (index !== -1) {
                notifications.value[index] = updatedNotification;
            }

            // Update count if this is a personal notification
            if (updatedNotification.notification_type === 'personal' && updatedNotification.read) {
                unreadCount.value = Math.max(0, unreadCount.value - 1);
                saveToLocalStorage(currentUsername.value);
            }
        } catch (err: any) {
            console.error('Failed to mark notification as read:', err);
            throw err;
        }
    }

    async function markAllAsRead(username: string) {
        if (!username) return;

        try {
            const result = await notificationService.markAllAsRead(username);

            // Update all personal notifications in local state
            notifications.value = notifications.value.map(n =>
            n.notification_type === 'personal' && n.recipient === username
            ? { ...n, read: true }
            : n
            );

            // Update count
            if (username === currentUsername.value) {
                unreadCount.value = 0;
                saveToLocalStorage(username);
            }

            return result;
        } catch (err) {
            console.error('Failed to mark all as read:', err);
            throw err;
        }
    }

    async function deleteNotification(notificationId: string) {
        try {
            // Find the notification first
            const notification = notifications.value.find(n => n.notification_id === notificationId);

            if (notification) {
                // Check if it's personal before deleting
                if (notification.notification_type !== 'personal') {
                    throw new Error('Cannot delete non-personal notifications');
                }

                await notificationService.deleteNotification(notificationId);

                // Remove from local state
                notifications.value = notifications.value.filter(n => n.notification_id !== notificationId);

                // Update counts if it's a personal notification
                if (notification.recipient === currentUsername.value) {
                    totalCount.value = Math.max(0, totalCount.value - 1);
                    if (!notification.read) {
                        unreadCount.value = Math.max(0, unreadCount.value - 1);
                    }
                    saveToLocalStorage(currentUsername.value);
                }
            }
        } catch (err) {
            console.error('Failed to delete notification:', err);
            throw err;
        }
    }

    /**
     * Delete ANY notification (personal/general/group) as an admin.
     * The backend syncs the deletion across replicas so a GROUP notification
     * disappears for every admin recipient.
     */
    async function deleteNotificationAsAdmin(notificationId: string) {
        const notification = notifications.value.find(n => n.notification_id === notificationId);

        await notificationService.deleteNotificationAsAdmin(notificationId);

        // Remove from local state for the current user immediately
        notifications.value = notifications.value.filter(n => n.notification_id !== notificationId);

        // Defensive count adjustments (group notifications don't affect personal counts)
        if (notification && notification.notification_type === 'personal') {
            totalCount.value = Math.max(0, totalCount.value - 1);
            if (!notification.read) {
                unreadCount.value = Math.max(0, unreadCount.value - 1);
            }
            saveToLocalStorage(currentUsername.value);
        } else if (notification && notification.notification_type === 'group') {
            groupCount.value = Math.max(0, groupCount.value - 1);
            saveToLocalStorage(currentUsername.value);
        }
    }

    function resetPagination() {
        currentPage.value = 1;
        hasMore.value = true;
    }

    function clearUserNotifications(username: string) {
        // Remove only this user's personal notifications
        notifications.value = notifications.value.filter(n =>
        !(n.notification_type === 'personal' && n.recipient === username)
        );

        if (username === currentUsername.value) {
            unreadCount.value = 0;
            totalCount.value = 0;
        }

        resetPagination();
    }

    function clearAllNotifications() {
        notifications.value = [];
        unreadCount.value = 0;
        totalCount.value = 0;
        generalCount.value = 0;
        groupCount.value = 0;
        currentPage.value = 1;
        hasMore.value = true;
        error.value = null;
        currentUsername.value = '';
        resetPagination();
    }

    return {
        // State
        notifications,
        unreadCount,
        totalCount,
        generalCount,
        groupCount,
        loading,
        error,
        hasMore,
        currentUsername,

        // Computed
        personalNotifications,
        generalNotifications,
        groupNotifications,
        unreadPersonalNotifications,
        allUserNotifications,
        canModifyNotification,

        // Actions
        fetchNotifications,
        fetchNotificationCount,
        fetchNotificationStats,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteNotificationAsAdmin,
        resetPagination,
        clearUserNotifications,
        clearAllNotifications,
        loadFromLocalStorage
    };
});