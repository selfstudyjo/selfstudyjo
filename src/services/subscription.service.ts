import { apiService } from './api';
import { serviceRegistry } from './config';
import { paymentService, type Payment } from './payment.service';
import { notificationService } from './notification.service';
import { decodeNotificationMessage } from '@/utils/notificationMeta';

export interface Feature {
    external_id: string;
    name: string;
    description: string;
}

export interface SubscriptionType {
    external_id: string;
    title: string;
    description: string;
    price: string;
    features: Feature[];
}

export interface Subscription {
    external_id: string;
    title: string;
    subscription_type: SubscriptionType;
    user_id: string;
    is_active: boolean;
    created_date: string;
    expire_date: string;
}

export interface CreateSubscriptionRequest {
    external_id?: string;
    title: string;
    subscription_type: string;
    user_id: string;
    is_active: boolean;
    expire_date?: string;
}

export interface UserSubscriptionStatus {
    hasActiveSubscription: boolean;
    hasPendingPayment: boolean;
    pendingPayment: Payment | null;
    activeSubscription: Subscription | null;
    canSubscribe: boolean;
    reason?: string;
}

const SELECTED_SUB_KEY_PREFIX = 'selected_subscription_';
const EXPIRY_NOTIFIED_KEY_PREFIX = 'sub_expiry_notified_';
// Notify when a subscription expires within this window
const EXPIRY_NOTICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EXPIRY_TITLE = 'Subscription Expiring Soon';

class SubscriptionService {
    // Per-user in-flight lock so concurrent calls collapse into one run.
    private _expiryRuns = new Map<string, Promise<void>>();

    // ---------------------- Selected subscription persistence ----------------------
    /** Get user-selected subscription external_id (from localStorage). */
    getSelectedSubscriptionId(userId: string): string | null {
        try {
            return localStorage.getItem(`${SELECTED_SUB_KEY_PREFIX}${userId}`);
        } catch {
            return null;
        }
    }

    setSelectedSubscriptionId(userId: string, subscriptionExternalId: string): void {
        try {
            localStorage.setItem(`${SELECTED_SUB_KEY_PREFIX}${userId}`, subscriptionExternalId);
        } catch (err) {
            console.warn('Failed to persist selected subscription:', err);
        }
    }

    clearSelectedSubscriptionId(userId: string): void {
        try {
            localStorage.removeItem(`${SELECTED_SUB_KEY_PREFIX}${userId}`);
        } catch {
            /* ignore */
        }
    }

    // ---------------------- API methods ----------------------
    async getSubscriptionTypes(): Promise<SubscriptionType[]> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) throw new Error('No subscription service replicas available');
        try {
            return await apiService.get<SubscriptionType[]>(baseUrl, '/subscription-types/');
        } catch (error) {
            console.error('Failed to get subscription types:', error);
            throw error;
        }
    }

    async getSubscriptionType(externalId: string): Promise<SubscriptionType> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) throw new Error('No subscription service replicas available');
        try {
            return await apiService.get<SubscriptionType>(baseUrl, `/subscription-types/${externalId}/`);
        } catch (error) {
            console.error('Failed to get subscription type:', error);
            throw error;
        }
    }

    async getUserSubscriptions(userId: string): Promise<Subscription[]> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) throw new Error('No subscription service replicas available');
        try {
            return await apiService.get<Subscription[]>(baseUrl, `/subscriptions/?user_id=${userId}`);
        } catch (error) {
            console.error('Failed to get user subscriptions:', error);
            throw error;
        }
    }

    async createSubscription(data: CreateSubscriptionRequest): Promise<Subscription> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) throw new Error('No subscription service replicas available');
        try {
            return await apiService.post<Subscription>(baseUrl, '/subscriptions/', data);
        } catch (error) {
            console.error('Failed to create subscription:', error);
            throw error;
        }
    }

    // ---------------------- Non-expired subscription helpers ----------------------
    /**
     * Return all non-expired subscriptions for user, sorted by created_date DESC (newest first).
     * A subscription is considered usable if:
     *   - expire_date is in the future
     *   - is_active is true
     */
    async getUsableSubscriptions(userId: string): Promise<Subscription[]> {
        try {
            const subs = await this.getUserSubscriptions(userId);
            const now = new Date();
            return subs
            .filter(sub => {
                const expireDate = new Date(sub.expire_date);
                return sub.is_active && expireDate > now;
            })
            .sort((a, b) => {
                // Newest first
                const dateA = new Date(a.created_date).getTime();
                const dateB = new Date(b.created_date).getTime();
                return dateB - dateA;
            });
        } catch (error) {
            console.error('Failed to get usable subscriptions:', error);
            return [];
        }
    }

    /**
     * Get the user's "active" subscription.
     * Priority:
     *   1. User-selected subscription (if still non-expired)
     *   2. Newest non-expired subscription
     *   3. null
     */
    async getActiveUserSubscription(userId: string): Promise<Subscription | null> {
        try {
            const usable = await this.getUsableSubscriptions(userId);
            if (usable.length === 0) return null;

            // Check user's selected preference
            const selectedId = this.getSelectedSubscriptionId(userId);
            if (selectedId) {
                const selected = usable.find(s => s.external_id === selectedId);
                if (selected) return selected;
                // Selected is expired/not usable -> clear preference
                this.clearSelectedSubscriptionId(userId);
            }

            // Default: newest usable subscription
            return usable[0];
        } catch (error) {
            console.error('Failed to get active subscription:', error);
            return null;
        }
    }

    /**
     * Switch the user's active subscription to the given one.
     * Only allowed if the target subscription is non-expired.
     */
    async switchActiveSubscription(userId: string, subscriptionExternalId: string): Promise<Subscription> {
        const usable = await this.getUsableSubscriptions(userId);
        const target = usable.find(s => s.external_id === subscriptionExternalId);
        if (!target) {
            throw new Error('This subscription is expired or not usable');
        }
        this.setSelectedSubscriptionId(userId, subscriptionExternalId);
        return target;
    }

    /**
     * Get the list of feature names the user has access to through their ACTIVE selected subscription.
     * If no selection, uses the newest non-expired subscription.
     * If you want union of all non-expired subs, call getAllUserFeatures instead.
     */
    async getUserFeatures(userId: string): Promise<string[]> {
        try {
            const active = await this.getActiveUserSubscription(userId);
            if (!active || !active.subscription_type?.features) return [];
            return active.subscription_type.features.map(f => f.name);
        } catch (error) {
            console.error('Failed to get user features:', error);
            return [];
        }
    }

    /**
     * Union of all features from ALL non-expired subscriptions.
     * Useful if you want user to implicitly benefit from every active plan.
     */
    async getAllUserFeatures(userId: string): Promise<string[]> {
        try {
            const usable = await this.getUsableSubscriptions(userId);
            const featureSet = new Set<string>();
            for (const sub of usable) {
                sub.subscription_type?.features?.forEach(f => featureSet.add(f.name));
            }
            return Array.from(featureSet);
        } catch (error) {
            console.error('Failed to get all user features:', error);
            return [];
        }
    }

    async hasFeature(userId: string, featureName: string): Promise<boolean> {
        try {
            const features = await this.getUserFeatures(userId);
            return features.includes(featureName);
        } catch (error) {
            console.error('Failed to check feature:', error);
            return false;
        }
    }

    /**
     * Notify the student about any subscription that will expire soon.
     *
     * Guarantees NO duplicates:
     *  - Per-user in-flight lock collapses concurrent calls into a single run
     *    (fixes the "created twice per login" race).
     *  - Authoritative server-side check: skips creating a notification if one
     *    already exists for that exact subscription (matched via the
     *    `subscriptionId` embedded in the notification metadata). This survives
     *    logout/login and other devices.
     *  - A DIFFERENT subscription that is also expiring will still be notified.
     */
    async notifyExpiringSubscriptions(
        userId: string,
        username: string,
        subs?: Subscription[]
    ): Promise<void> {
        if (!userId || !username) return;

        // Collapse concurrent calls for the same user into one execution.
        const existingRun = this._expiryRuns.get(userId);
        if (existingRun) return existingRun;

        const run = this._doNotifyExpiringSubscriptions(userId, username, subs)
            .catch(err => console.warn('notifyExpiringSubscriptions failed:', err))
            .finally(() => {
                this._expiryRuns.delete(userId);
            });

        this._expiryRuns.set(userId, run);
        return run;
    }

    private async _doNotifyExpiringSubscriptions(
        userId: string,
        username: string,
        subs?: Subscription[]
    ): Promise<void> {
        const usable = subs && subs.length ? subs : await this.getUsableSubscriptions(userId);
        const now = new Date();

        // Subscriptions expiring within the notice window
        const expiringSoon = usable.filter(sub => {
            const diff = new Date(sub.expire_date).getTime() - now.getTime();
            return diff > 0 && diff <= EXPIRY_NOTICE_WINDOW_MS;
        });

        if (expiringSoon.length === 0) return;

        // Fetch the user's existing notifications ONCE (authoritative dedup source).
        let existing: Array<{ title: string; message: string }> = [];
        try {
            const resp = await notificationService.getNotificationsForUser(username, 1, 100);
            existing = resp.results || [];
        } catch (err) {
            console.warn('Could not fetch existing notifications for dedup check:', err);
            existing = [];
        }

        for (const sub of expiringSoon) {
            const subId = sub.external_id;
            const planTitle = sub.subscription_type?.title || sub.title;

            // 1) Authoritative server-side dedup
            const alreadyOnServer = existing.some(n => {
                if (n.title !== EXPIRY_TITLE) return false;
                const decoded = decodeNotificationMessage(n.message);
                // Primary match: subscription id embedded in metadata
                if (decoded.meta?.subscriptionId === subId) return true;
                // Fallback for older notifications (no subscriptionId in meta)
                if (planTitle && decoded.message.includes(`"${planTitle}"`)) return true;
                return false;
            });
            if (alreadyOnServer) continue;

            // 2) Fast local guard (optional optimization)
            const localKey = `${EXPIRY_NOTIFIED_KEY_PREFIX}${subId}_${sub.expire_date}`;
            let localBlocked = false;
            try {
                localBlocked = !!localStorage.getItem(localKey);
            } catch { /* ignore */ }
            if (localBlocked) continue;

            // 3) Create the notification
            const days = Math.max(
                1,
                Math.ceil((new Date(sub.expire_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
            );

            try {
                await notificationService.createActionNotification(
                    {
                        title: EXPIRY_TITLE,
                        message:
                            `Your subscription "${planTitle}" will expire in ${days} day${days > 1 ? 's' : ''} ` +
                            `(on ${new Date(sub.expire_date).toLocaleDateString()}). Renew now to keep your access.`,
                        notification_type: 'personal',
                        sender: 'system',
                        recipient: username,
                        read: false
                    },
                    {
                        subscriptionId: subId,
                        expireDate: sub.expire_date,
                        actions: [{ type: 'view_plans', label: 'View Plans', path: '/plans' }]
                    }
                );

                // Record locally as a fast guard (server check remains authoritative)
                try { localStorage.setItem(localKey, Date.now().toString()); } catch { /* ignore */ }

                // Add to the in-memory existing list so we don't double-create
                // within this same run for any duplicate sub entries.
                existing.push({
                    title: EXPIRY_TITLE,
                    message: `"${planTitle}"`
                });
            } catch (err) {
                console.warn('Failed to create expiring-subscription notification:', err);
            }
        }
    }

    async checkSubscriptionAccess(userId: string, requiredFeatures: string[]): Promise<{
        hasAccess: boolean;
        missingFeatures: string[];
        activeSubscription: Subscription | null;
    }> {
        try {
            const activeSubscription = await this.getActiveUserSubscription(userId);
            if (!activeSubscription) {
                return {
                    hasAccess: false,
                    missingFeatures: requiredFeatures,
                    activeSubscription: null
                };
            }
            const userFeatures = await this.getUserFeatures(userId);
            const missingFeatures = requiredFeatures.filter(f => !userFeatures.includes(f));
            return {
                hasAccess: missingFeatures.length === 0,
                missingFeatures,
                activeSubscription
            };
        } catch (error) {
            console.error('Failed to check subscription access:', error);
            return {
                hasAccess: false,
                missingFeatures: requiredFeatures,
                activeSubscription: null
            };
        }
    }

    async getUserSubscriptionStatus(userId: string, subscriptionTypeExternalId?: string): Promise<UserSubscriptionStatus> {
        try {
            const [activeSubscription, userPayments] = await Promise.all([
                this.getActiveUserSubscription(userId),
                                                                         paymentService.getUserPayments(userId)
            ]);

            let pendingPaymentForPlan: Payment | null = null;
            if (subscriptionTypeExternalId) {
                pendingPaymentForPlan = userPayments.find(payment =>
                payment.subscription_id === subscriptionTypeExternalId &&
                payment.status === 'PENDING'
                ) || null;
            }

            const pendingPayments = userPayments.filter(p => p.status === 'PENDING');
            const hasPendingPayment = pendingPayments.length > 0;

            let canSubscribe = true;
            let reason = '';

            // If user already has ANY active subscription for this plan type, block duplicate subscription
            if (subscriptionTypeExternalId) {
                const usable = await this.getUsableSubscriptions(userId);
                const duplicate = usable.find(s =>
                s.subscription_type?.external_id === subscriptionTypeExternalId
                );
                if (duplicate) {
                    canSubscribe = false;
                    reason = 'You already have an active subscription for this plan';
                }
            }

            if (pendingPaymentForPlan) {
                canSubscribe = false;
                reason = 'You have a pending payment for this plan';
            } else if (hasPendingPayment && subscriptionTypeExternalId) {
                const others = pendingPayments.filter(p => p.subscription_id !== subscriptionTypeExternalId);
                if (others.length > 0) {
                    canSubscribe = false;
                    reason = 'You have a pending payment for another plan. Please complete it first.';
                }
            }

            return {
                hasActiveSubscription: !!activeSubscription,
                hasPendingPayment,
                pendingPayment: pendingPaymentForPlan || (pendingPayments[0] || null),
                activeSubscription,
                canSubscribe,
                reason
            };
        } catch (error) {
            console.error('Failed to get user subscription status:', error);
            return {
                hasActiveSubscription: false,
                hasPendingPayment: false,
                pendingPayment: null,
                activeSubscription: null,
                canSubscribe: false,
                reason: 'Unable to check subscription status'
            };
        }
    }

    async getUserPendingPayments(userId: string): Promise<Payment[]> {
        try {
            const payments = await paymentService.getUserPayments(userId);
            return payments.filter(p => p.status === 'PENDING');
        } catch (error) {
            console.error('Failed to get user pending payments:', error);
            return [];
        }
    }
}

export const subscriptionService = new SubscriptionService();

export async function getRandomSubscriptionReplica(): Promise<string | null> {
    const replicas = await serviceRegistry.getServiceReplicas(
        parseInt(import.meta.env.VITE_SUBSCRIPTIONS_APP_ID || '22'),
                                                              'subscription'
    );
    return serviceRegistry.getRandomReplica(replicas);
}

serviceRegistry.getRandomSubscriptionReplica = getRandomSubscriptionReplica;