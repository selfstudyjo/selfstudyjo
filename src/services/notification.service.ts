// services/notification.service.ts
//
// The client for app 16.
//
// Three things changed on 2026-08-09 and all three are worth knowing before
// touching this file:
//
// 1. **Every call that acts on somebody's inbox now names them.** `recipient` is
//    what tells the backend to write that person's state row rather than the
//    shared record. Leaving it off is the old behaviour — a student opening an
//    announcement marking it read for the entire platform — and the backend
//    still accepts it, because the admin console needs it. So the omission is
//    silent, and that is why every method here passes it explicitly.
// 2. **Deleting is `dismiss`, not DELETE.** DELETE removes the record for
//    everybody and is refused with a 403 on anything that is not personal. The
//    "delete" a *recipient* means is "take it out of my list", which is a
//    tombstone for a notification they own and a state row for one they share.
//    The backend decides which; the client must not try to.
// 3. **Sending a notification goes through the catalogue**, not through a
//    template string written at the call site. See
//    `src/utils/notificationEvents.ts` — that is where the wording, the
//    category, the priority and the link live, and `npm run check:notifyevents`
//    is what keeps them honest.

import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse } from '@/utils/api-utils';
import { userService } from './user.service';
import { encodeNotificationMessage, type NotificationMeta } from '@/utils/notificationMeta';
import {
    buildNotification,
    type NotificationCategory,
    type NotificationPriority,
} from '@/utils/notificationEvents';

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
    /** First-class since 2026-08-09 — see notificationEvents.ts. */
    category?: string;
    event?: string;
    link?: string;
    priority?: string;
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
    category: string;
    event: string;
    link: string;
    priority: NotificationPriority;
    dismissed: boolean;
}

export interface NotificationCount {
    recipient: string;
    total_count: number;
    unread_count: number;
    /** The newest thing in this inbox. The poller compares these rather than the
     *  unread count — one notification read on a phone while another arrives
     *  leaves the count unchanged, and the bell would stay silent. */
    latest_at: string;
    latest_id: string;
    latest_title: string;
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

export interface ClearAllResponse {
    message: string;
    recipient: string;
    /** Tombstoned for good — the ones this person owned. */
    deleted: number;
    /** Taken out of their list only — announcements everybody else still has. */
    dismissed: number;
    total: number;
}

export interface NotificationStats {
    recipient: string;
    total_personal: number;
    unread_personal: number;
    total_general: number;
    unread_general: number;
    total_group: number;
    unread_group: number;
    total_visible: number;
    unread_visible: number;
}

/** What a caller passes to `notify()`. */
export interface NotifyOptions {
    /** One username, or several. Several becomes one bulk call, not N posts. */
    to: string | string[];
    /** Placeholders for the catalogue entry's templates. */
    params?: Record<string, unknown>;
    /** Who it is from. Defaults to `system`, which is what the UI shows for
     *  anything the platform did rather than a person. */
    sender?: string;
    /** Action buttons, for the two events that need parameters rather than a
     *  path. Encoded into the message the old way — see notificationMeta.ts. */
    meta?: NotificationMeta;
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

    /** The pinned replica, or a thrown error naming why there is none. */
    private async base(): Promise<string> {
        const baseUrl = await this.getRandomNotificationReplica();
        if (!baseUrl) throw new Error('No notification service replicas available');
        return baseUrl;
    }

    // -- Sending -------------------------------------------------------------

    async createNotification(notificationData: Notification): Promise<NotificationResponse> {
        const baseUrl = await this.base();
        const payload = {
            ...notificationData,
            // Ensure type/recipient are always explicitly present
            notification_type: notificationData.notification_type,
            recipient: notificationData.recipient,
            read: notificationData.read || false
        };
        return apiService.post<NotificationResponse>(baseUrl, '/api/notifications/', payload);
    }

    /**
     * Create a notification that carries structured "action" metadata
     * (buttons / links) encoded inside the message text.
     *
     * Kept for the payment approve/ignore pair, which needs a payment id and a
     * student username on the button rather than a path. Everything with a plain
     * destination should use `notify()` and the catalogue's `link` instead — a
     * link in the message body is invisible to every client but this one.
     */
    async createActionNotification(
        notificationData: Notification,
        meta?: NotificationMeta
    ): Promise<NotificationResponse> {
        const encodedMessage = encodeNotificationMessage(notificationData.message, meta);
        return this.createNotification({
            ...notificationData,
            message: encodedMessage
        });
    }

    /**
     * Send a catalogued event to one or more people.
     *
     * **Never throws.** Every call site is a `then` hanging off a user action
     * that has already succeeded — the homework is submitted, the payment is
     * recorded — and failing to tell somebody about it must not turn that into a
     * red error box. It returns how many notifications were created so a caller
     * that cares can log it.
     *
     * Several recipients become **one personal notification each**, in one bulk
     * call. Not a group notification: that is a single shared record, so one
     * person clearing it away would have to clear it for everybody, and the read
     * flag would be shared too. Thirty students in a class means thirty records,
     * and the bulk endpoint exists so that is one request and one replication
     * push rather than thirty of each.
     */
    async notify(eventKey: string, options: NotifyOptions): Promise<number> {
        try {
            const built = buildNotification(eventKey, options.params || {});
            if (!built) {
                console.warn(`[notify] unknown event key: ${eventKey}`);
                return 0;
            }

            const recipients = (Array.isArray(options.to) ? options.to : [options.to])
                .map(name => String(name || '').trim())
                .filter(Boolean);
            if (!recipients.length) return 0;

            const message = options.meta
                ? encodeNotificationMessage(built.message, options.meta)
                : built.message;

            const common = {
                title: built.title,
                message,
                notification_type: 'personal' as const,
                sender: options.sender || 'system',
                category: built.category,
                event: built.event,
                link: built.link,
                priority: built.priority,
                read: false,
            };

            if (recipients.length === 1) {
                await this.createNotification({ ...common, recipient: recipients[0] });
                return 1;
            }

            const baseUrl = await this.base();
            const response = await apiService.post<{ created_count: number }>(
                baseUrl,
                '/api/notifications/bulk/',
                { notifications: recipients.map(recipient => ({ ...common, recipient })) }
            );
            return response?.created_count ?? recipients.length;
        } catch (error) {
            // Deliberately swallowed. See the docstring: the thing being
            // announced already happened.
            console.warn(`[notify] ${eventKey} failed:`, error);
            return 0;
        }
    }

    /**
     * The same, for callers holding a user **id** rather than a username.
     *
     * App 16 addresses a person by username; several services store only the
     * UUID (Research Flow's collaboration requests, app 34's shares, every
     * `X-User-ID` header). Resolving it here rather than at each call site is
     * what stops the next one being written against a UUID and silently
     * notifying nobody — the record is created, it is simply addressed to a
     * name no account holds, so it is never read and never cleared.
     */
    async notifyById(eventKey: string, options: Omit<NotifyOptions, 'to'> & { userId: string }):
        Promise<number> {
        try {
            if (!options.userId) return 0;
            const profile = await userService.getUserProfile(options.userId);
            if (!profile?.username) return 0;
            return this.notify(eventKey, { ...options, to: profile.username });
        } catch (error) {
            console.warn(`[notify] ${eventKey} could not resolve ${options.userId}:`, error);
            return 0;
        }
    }

    /** Announce something to everybody. One record, so it is read and cleared
     *  per person through their state row rather than on the record. */
    async announce(eventKey: string, params: Record<string, unknown> = {},
                   sender = 'system'): Promise<boolean> {
        try {
            const built = buildNotification(eventKey, params);
            if (!built) return false;
            await this.createNotification({
                title: built.title,
                message: built.message,
                notification_type: 'general',
                sender,
                recipient: 'all',
                category: built.category,
                event: built.event,
                link: built.link,
                priority: built.priority,
                read: false,
            });
            return true;
        } catch (error) {
            console.warn(`[notify] announcement ${eventKey} failed:`, error);
            return false;
        }
    }

    /** Every admin on the platform, for the operator-side events. */
    private async adminUsernames(): Promise<string[]> {
        const admins = await userService.getAdminUsers();
        return admins.map(a => a.username).filter(Boolean);
    }

    /**
     * Send a catalogued operator-side event to every admin.
     *
     * One personal notification each rather than one group notification, which
     * is a change: the payment request used to be a single group record so that
     * whichever admin acted on it could delete it for all of them. That is the
     * one case where sharing the record was the point, so it keeps its own
     * method below; everything else is better off per-person, because an admin
     * clearing their own bell should not clear their colleague's.
     */
    async notifyAdmins(eventKey: string, params: Record<string, unknown> = {},
                       sender = 'system'): Promise<number> {
        try {
            const recipients = await this.adminUsernames();
            if (!recipients.length) {
                console.warn('[notify] no admin users found (is_admin === true)');
                return 0;
            }
            return this.notify(eventKey, { to: recipients, params, sender });
        } catch (error) {
            console.warn(`[notify] admin event ${eventKey} failed:`, error);
            return 0;
        }
    }

    /**
     * Notify ALL admin users that a student submitted a payment request.
     *
     * Creates a SINGLE GROUP notification whose recipient list is the
     * comma-separated set of all admin usernames. Because it's one record,
     * deleting it (when any admin approves/ignores) removes it for everyone —
     * which is exactly what should happen to a request that has been dealt with,
     * and is why this one event is not sent per-person like the rest.
     */
    async notifyAdminsOfPaymentRequest(params: {
        paymentId: string;
        amount: string | number;
        planTitle: string;
        studentUsername: string;
        studentFullName?: string;
    }): Promise<void> {
        try {
            const recipients = await this.adminUsernames();
            if (!recipients.length) {
                console.warn(
                    '[notify] No admin users found (is_admin === true). ' +
                    'No payment-request notification was created.'
                );
                return;
            }

            const who = params.studentFullName
                ? `${params.studentFullName} (@${params.studentUsername})`
                : `@${params.studentUsername}`;

            const built = buildNotification('payment.request_submitted', {
                student: who,
                plan: params.planTitle,
                amount: String(params.amount),
                paymentId: params.paymentId,
            })!;

            const meta: NotificationMeta = {
                actions: [
                    {
                        type: 'approve_payment',
                        label: 'Approve',
                        paymentId: params.paymentId,
                        studentUsername: params.studentUsername,
                        planTitle: params.planTitle,
                        amount: String(params.amount)
                    },
                    {
                        type: 'ignore_payment',
                        label: 'Ignore',
                        paymentId: params.paymentId,
                        studentUsername: params.studentUsername,
                        planTitle: params.planTitle,
                        amount: String(params.amount)
                    }
                ]
            };

            await this.createActionNotification(
                {
                    title: built.title,
                    message: built.message,
                    notification_type: 'group',
                    sender: 'system',
                    recipient: recipients.join(', '),
                    category: built.category,
                    event: built.event,
                    link: built.link,
                    priority: built.priority,
                    read: false
                },
                meta
            );
        } catch (error) {
            console.warn('notifyAdminsOfPaymentRequest failed:', error);
        }
    }

    // -- Reading -------------------------------------------------------------

    async getNotificationsForUser(username: string, page = 1, pageSize = 20): Promise<PaginatedNotifications> {
        try {
            const baseUrl = await this.base();
            const response = await apiService.get<any>(
                baseUrl,
                `/api/notifications/user-notifications/?recipient=${encodeURIComponent(username)}`
                + `&page=${page}&page_size=${pageSize}`
            );
            return this.parseNotificationsResponse(response);
        } catch (error: any) {
            console.error('Failed to get notifications:', error);
            return { count: 0, next: null, previous: null, results: [] };
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

        const mappedResults: NotificationResponse[] = results.map((notification: any) => ({
            notification_id: notification.notification_id || notification.id,
            title: notification.title,
            message: notification.message,
            notification_type: notification.notification_type,
            sender: notification.sender,
            recipient: notification.recipient,
            read: notification.read || false,
            created_at: notification.created_at,
            updated_at: notification.updated_at,
            // Defaults rather than undefined: a replica that has not pulled the
            // 2026-08-09 build yet answers without these five, and the UI would
            // otherwise render "undefined" as a category chip.
            category: notification.category || '',
            event: notification.event || '',
            link: notification.link || '',
            priority: notification.priority || 'normal',
            dismissed: !!notification.dismissed,
        }));

        return {
            // `count` is the page's own length rather than the envelope's total,
            // which is what this method has always returned; the store pages on
            // `next`.
            count: mappedResults.length,
            next,
            previous,
            results: mappedResults
        };
    }

    async getNotificationCount(username: string): Promise<NotificationCount> {
        try {
            const baseUrl = await this.base();
            return await apiService.get<NotificationCount>(
                baseUrl,
                `/api/notification-count/?recipient=${encodeURIComponent(username)}`
            );
        } catch (error: any) {
            console.error('Failed to get notification count:', error);
            return {
                recipient: username,
                total_count: 0,
                unread_count: 0,
                latest_at: '',
                latest_id: '',
                latest_title: '',
            };
        }
    }

    async getNotificationStats(username: string): Promise<NotificationStats> {
        try {
            const baseUrl = await this.base();
            const stats = await apiService.get<any>(
                baseUrl,
                `/api/notification-stats/?recipient=${encodeURIComponent(username)}`
            );
            return {
                recipient: username,
                total_personal: stats.total_personal || 0,
                unread_personal: stats.unread_personal || 0,
                total_general: stats.total_general || 0,
                unread_general: stats.unread_general || 0,
                total_group: stats.total_group || 0,
                unread_group: stats.unread_group || 0,
                total_visible: stats.total_visible
                    ?? (stats.total_personal || 0) + (stats.total_general || 0) + (stats.total_group || 0),
                unread_visible: stats.unread_visible ?? (stats.unread_personal || 0),
            };
        } catch (error: any) {
            console.error('Failed to get notification stats:', error);
            return {
                recipient: username,
                total_personal: 0, unread_personal: 0,
                total_general: 0, unread_general: 0,
                total_group: 0, unread_group: 0,
                total_visible: 0, unread_visible: 0,
            };
        }
    }

    // -- Acting on one inbox --------------------------------------------------

    /**
     * Read, for one person.
     *
     * `recipient` is the whole point: without it the backend marks the shared
     * record, which on an announcement is every other student's bell going quiet
     * about something they never saw.
     */
    async markNotificationAsRead(notificationId: string, username: string): Promise<void> {
        const baseUrl = await this.base();
        await apiService.post(
            baseUrl,
            `/api/notifications/${notificationId}/mark-as-read/`,
            { recipient: username }
        );
    }

    async markAllAsRead(username: string): Promise<MarkAllReadResponse> {
        const baseUrl = await this.base();
        return apiService.post<MarkAllReadResponse>(
            baseUrl,
            `/api/notifications/mark-all-as-read/`,
            { recipient: username }
        );
    }

    /**
     * Take one notification out of one person's list — the Delete button.
     *
     * The backend decides whether that means a tombstone (they own it) or a
     * state row (an announcement everybody else is still reading). The response
     * says which, so the UI can be honest about it.
     */
    async dismissNotification(notificationId: string, username: string):
        Promise<{ deleted: boolean; dismissed: boolean }> {
        const baseUrl = await this.base();
        return apiService.post<{ deleted: boolean; dismissed: boolean }>(
            baseUrl,
            `/api/notifications/${notificationId}/dismiss/`,
            { recipient: username }
        );
    }

    /** Empty one person's inbox — the Clear all button. One call, two writes. */
    async clearAll(username: string): Promise<ClearAllResponse> {
        const baseUrl = await this.base();
        return apiService.post<ClearAllResponse>(
            baseUrl,
            `/api/notifications/clear-all/`,
            { recipient: username }
        );
    }

    /**
     * Delete ANY notification type (personal / general / group) as an admin.
     *
     * IMPORTANT: We pass the privileged flag as a QUERY PARAM (?admin_request=true)
     * rather than a custom header (X-Admin-Request). A custom header would force a
     * CORS pre-flight that requires the backend to whitelist that header in
     * Access-Control-Allow-Headers — otherwise the browser blocks the request and
     * the delete silently fails. The query param avoids that entirely.
     *
     * The backend then deletes locally AND syncs the deletion to all replicas, so
     * a GROUP notification disappears for every admin recipient.
     */
    async deleteNotificationAsAdmin(notificationId: string): Promise<void> {
        const baseUrl = await this.base();
        await apiService.delete(
            baseUrl,
            `/api/notifications/${notificationId}/?admin_request=true`
        );
    }

    // Helper method to check if user is in group recipients
    isUserInGroupRecipients(notification: NotificationResponse, username: string): boolean {
        if (notification.notification_type !== 'group') return false;
        const recipients = notification.recipient.split(',').map(r => r.trim());
        return recipients.includes(username);
    }
}

export const notificationService = new NotificationService();

/** Re-exported so a call site needs one import rather than two. */
export type { NotificationCategory, NotificationPriority };
