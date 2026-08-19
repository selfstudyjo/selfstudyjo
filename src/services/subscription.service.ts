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

/**
 * The 7-day free trial.
 *
 * The card on /plans is **static** — it is offered whether or not app 22's
 * catalogue has ever heard of it — but the subscription it grants cannot be:
 * `POST /subscriptions/` refuses a plan external_id it does not know, and every
 * feature gate on the platform reads its feature list off the plan record. So
 * the plan is created in app 22 lazily, the first time anybody activates a
 * trial, under a **fixed external_id**.
 *
 * Fixed rather than minted is what makes that safe to run from a browser: app
 * 22 derives a record's uid from its natural key, so two people registering at
 * the same moment against two different replicas create the *same* record and
 * the merge collapses them. A `uuid4()` here would leave two free plans and two
 * cards.
 */
export const FREE_TRIAL_PLAN_ID = 'sfs-free-trial-7';
export const FREE_TRIAL_DAYS = 7;
export const FREE_TRIAL_PLAN_TITLE = 'Free Trial';
export const FREE_TRIAL_PLAN_DESCRIPTION =
    'Every feature on the platform, free for 7 days. One trial per account — no card, no payment.';
/**
 * The title stored on the *subscription* record, not on the plan.
 *
 * It is a second way of recognising a spent trial. Deleting a plan in app 22 is
 * `SET_NULL` and not a cascade — a subscription outlives the plan it was bought
 * on and reads back with `subscription_type: null` — so matching only on the
 * plan id would hand a second trial to anybody whose plan record was removed.
 */
export const FREE_TRIAL_SUBSCRIPTION_TITLE = 'Free Trial (7 days)';

/** True for a subscription that is (or was) this account's one free trial. */
export function isFreeTrialSubscription(sub: Subscription | null | undefined): boolean {
    if (!sub) return false;
    if (sub.subscription_type?.external_id === FREE_TRIAL_PLAN_ID) return true;
    return !sub.subscription_type && sub.title === FREE_TRIAL_SUBSCRIPTION_TITLE;
}

const SELECTED_SUB_KEY_PREFIX = 'selected_subscription_';
const EXPIRY_NOTIFIED_KEY_PREFIX = 'sub_expiry_notified_';
// Notify when a subscription expires within this window
const EXPIRY_NOTICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EXPIRY_TITLE = 'Subscription Expiring Soon';
/**
 * The catalogue key this sweep sends.
 *
 * **The frontend owns "expiring" and the console owns "expired"**, and the split
 * is deliberate rather than accidental: this runs whenever the person concerned
 * loads their plans, which is far more reliable for a warning than the console's
 * sweep, which only runs when an operator happens to open the Subscriptions
 * screen. The console keeps the after-the-fact one, which nobody's own browsing
 * will trigger. Both sending it would be two bells for one fact.
 */
const EXPIRY_EVENT = 'subscription.expiring';

class SubscriptionService {
    // Per-user in-flight lock so concurrent calls collapse into one run.
    private _expiryRuns = new Map<string, Promise<void>>();
    // The same shape for the trial, and here it is load-bearing rather than an
    // optimisation: `createSubscription` mints a fresh external_id on every
    // call, so two overlapping activations are two subscriptions, not one.
    private _trialRuns = new Map<string, Promise<Subscription | null>>();
    private _freePlanRun: Promise<SubscriptionType> | null = null;

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

    /** Every feature the platform sells. The free trial's card lists all of them. */
    async getFeatures(): Promise<Feature[]> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) throw new Error('No subscription service replicas available');
        try {
            return await apiService.get<Feature[]>(baseUrl, '/features/');
        } catch (error) {
            console.error('Failed to get features:', error);
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

    // ---------------------- Free trial ----------------------
    /**
     * The free-trial plan record in app 22, created on first use.
     *
     * Idempotent in three directions, because all three happen: two tabs (the
     * in-flight lock), two users at once on one replica (the 400 on a duplicate
     * external_id, read back rather than surfaced), and two replicas at once
     * (the fixed external_id, collapsed by the merge).
     */
    async ensureFreeTrialPlan(): Promise<SubscriptionType> {
        if (this._freePlanRun) return this._freePlanRun;
        const run = this._doEnsureFreeTrialPlan()
            .finally(() => { this._freePlanRun = null; });
        this._freePlanRun = run;
        return run;
    }

    private async _doEnsureFreeTrialPlan(): Promise<SubscriptionType> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) throw new Error('No subscription service replicas available');

        const featureIds = (await this.getFeatures()).map(f => f.external_id);

        let plan: SubscriptionType | null = null;
        try {
            plan = await apiService.get<SubscriptionType>(
                baseUrl, `/subscription-types/${FREE_TRIAL_PLAN_ID}/`);
        } catch (error: any) {
            // A 404 is the catalogue saying it has never heard of this plan,
            // which is the ordinary first-run case. Anything else is a real
            // failure and must not be answered by creating a second copy.
            if (error?.status !== 404) throw error;
        }

        if (!plan) {
            try {
                return await apiService.post<SubscriptionType>(baseUrl, '/subscription-types/', {
                    external_id: FREE_TRIAL_PLAN_ID,
                    title: FREE_TRIAL_PLAN_TITLE,
                    description: FREE_TRIAL_PLAN_DESCRIPTION,
                    price: '0.00',
                    features: featureIds,
                });
            } catch (error: any) {
                // 400 is `external_id already exists` — somebody got there first,
                // here or on a peer that has since synced. Read it back.
                if (error?.status !== 400) throw error;
                return await this.getSubscriptionType(FREE_TRIAL_PLAN_ID);
            }
        }

        // The promise is "every feature", so one added to the platform after the
        // plan was minted has to join it. Written only when it actually differs:
        // this runs on every activation and app 22 fans every write out to all
        // of its peers on a background thread.
        const listed = new Set((plan.features || []).map(f => f.external_id));
        const isCurrent = listed.size === featureIds.length
            && featureIds.every(id => listed.has(id));
        if (isCurrent) return plan;

        return await apiService.patch<SubscriptionType>(
            baseUrl, `/subscription-types/${FREE_TRIAL_PLAN_ID}/`, { features: featureIds });
    }

    /**
     * Has this account ever had the free trial? Expired counts — it is one per
     * account for the life of the account, not one at a time.
     */
    async hasUsedFreeTrial(userId: string): Promise<boolean> {
        try {
            const subs = await this.getUserSubscriptions(userId);
            return subs.some(isFreeTrialSubscription);
        } catch (error) {
            // Fail closed: an unreadable list must not read as "never had one"
            // and hand out a second trial.
            console.warn('Could not check free-trial history:', error);
            return true;
        }
    }

    /**
     * Give this account its 7-day, all-features trial.
     *
     * Returns the subscription, or `null` when the account has already had one.
     * Never call it as a gate on anything: the caller decides what to do when it
     * throws, and every caller today treats a failure as "no trial yet", which
     * the /plans card can still recover.
     */
    async activateFreeTrial(userId: string, username?: string): Promise<Subscription | null> {
        if (!userId) return null;

        const inFlight = this._trialRuns.get(userId);
        if (inFlight) return inFlight;

        const run = this._doActivateFreeTrial(userId, username)
            .finally(() => { this._trialRuns.delete(userId); });
        this._trialRuns.set(userId, run);
        return run;
    }

    private async _doActivateFreeTrial(
        userId: string,
        username?: string
    ): Promise<Subscription | null> {
        const existing = await this.getUserSubscriptions(userId);
        if (existing.some(isFreeTrialSubscription)) return null;

        const plan = await this.ensureFreeTrialPlan();
        const expires = new Date(Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);

        const created = await this.createSubscription({
            title: FREE_TRIAL_SUBSCRIPTION_TITLE,
            subscription_type: plan.external_id,
            user_id: userId,
            is_active: true,
            expire_date: expires.toISOString(),
        });

        if (username) {
            // Through the catalogue, so a trial reads exactly like the console's
            // own "your subscription is active" rather than being a second
            // wording for the same fact. `notify` never throws.
            notificationService.notify('subscription.activated', {
                to: username,
                params: {
                    plan: plan.title || FREE_TRIAL_PLAN_TITLE,
                    until: expires.toLocaleDateString(),
                },
            });
        }

        return created;
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
        let existing: Array<{ title: string; message: string; event?: string }> = [];
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
                // `event` is a first-class field on app 16 since 2026-08-09 and
                // is the reliable match; the title comparison behind it is for
                // the notifications already stored without one.
                if (n.event !== EXPIRY_EVENT && n.title !== EXPIRY_TITLE) return false;
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
                // Through the catalogue, so this reads the same as the console's
                // "your subscription has expired" rather than being a second
                // wording for the same family of fact.
                await notificationService.notify(EXPIRY_EVENT, {
                    to: username,
                    params: { plan: planTitle, days },
                });

                // Record locally as a fast guard (server check remains authoritative)
                try { localStorage.setItem(localKey, Date.now().toString()); } catch { /* ignore */ }

                // Add to the in-memory existing list so we don't double-create
                // within this same run for any duplicate sub entries.
                existing.push({
                    title: EXPIRY_TITLE,
                    event: EXPIRY_EVENT,
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
    // See the note in payment.service.ts: the appId is the pin.
    const appId = parseInt(import.meta.env.VITE_SUBSCRIPTIONS_APP_ID || '22');
    const replicas = await serviceRegistry.getServiceReplicas(appId, 'subscription');
    return serviceRegistry.getRandomReplica(replicas, appId);
}

serviceRegistry.getRandomSubscriptionReplica = getRandomSubscriptionReplica;