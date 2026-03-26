import { apiService } from './api';
import { serviceRegistry } from './config';
import { paymentService, type Payment } from './payment.service';

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
    subscription_type: string; // external_id of subscription type
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

class SubscriptionService {
    async getSubscriptionTypes(): Promise<SubscriptionType[]> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) {
            throw new Error('No subscription service replicas available');
        }
        try {
            return await apiService.get<SubscriptionType[]>(baseUrl, '/subscription-types/');
        } catch (error) {
            console.error('Failed to get subscription types:', error);
            throw error;
        }
    }

    async getSubscriptionType(externalId: string): Promise<SubscriptionType> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) {
            throw new Error('No subscription service replicas available');
        }
        try {
            return await apiService.get<SubscriptionType>(baseUrl, `/subscription-types/${externalId}/`);
        } catch (error) {
            console.error('Failed to get subscription type:', error);
            throw error;
        }
    }

    async getUserSubscriptions(userId: string): Promise<Subscription[]> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) {
            throw new Error('No subscription service replicas available');
        }
        try {
            return await apiService.get<Subscription[]>(baseUrl, `/subscriptions/?user_id=${userId}`);
        } catch (error) {
            console.error('Failed to get user subscriptions:', error);
            throw error;
        }
    }

    async createSubscription(data: CreateSubscriptionRequest): Promise<Subscription> {
        const baseUrl = await serviceRegistry.getRandomSubscriptionReplica();
        if (!baseUrl) {
            throw new Error('No subscription service replicas available');
        }
        try {
            return await apiService.post<Subscription>(baseUrl, '/subscriptions/', data);
        } catch (error) {
            console.error('Failed to create subscription:', error);
            throw error;
        }
    }

    async getActiveUserSubscription(userId: string): Promise<Subscription | null> {
        try {
            const subscriptions = await this.getUserSubscriptions(userId);
            const now = new Date();
            return subscriptions.find(sub => {
                const expireDate = new Date(sub.expire_date);
                return sub.is_active && expireDate > now;
            }) || null;
        } catch (error) {
            console.error('Failed to get active subscription:', error);
            return null;
        }
    }

    /**
     * Get the list of feature names (not external_ids) that the user has access to
     * based on their active subscriptions.
     */
    async getUserFeatures(userId: string): Promise<string[]> {
        try {
            const subscriptions = await this.getUserSubscriptions(userId);
            const now = new Date();
            const activeSubs = subscriptions.filter(sub => {
                const expireDate = new Date(sub.expire_date);
                return sub.is_active && expireDate > now;
            });
            const featureSet = new Set<string>();
            for (const sub of activeSubs) {
                if (sub.subscription_type?.features) {
                    sub.subscription_type.features.forEach(f => {
                        // Use the feature name, not external_id, as the identifier
                        featureSet.add(f.name);
                    });
                }
            }
            return Array.from(featureSet);
        } catch (error) {
            console.error('Failed to get user features:', error);
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
            const missingFeatures = requiredFeatures.filter(feature => !userFeatures.includes(feature));
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
            const pendingPayments = userPayments.filter(payment => payment.status === 'PENDING');
            const hasPendingPayment = pendingPayments.length > 0;
            let canSubscribe = true;
            let reason = '';
            if (activeSubscription) {
                const expireDate = new Date(activeSubscription.expire_date);
                const now = new Date();
                if (expireDate > now) {
                    canSubscribe = false;
                    reason = 'You already have an active subscription';
                }
            }
            if (pendingPaymentForPlan) {
                canSubscribe = false;
                reason = 'You have a pending payment for this plan';
            } else if (hasPendingPayment && subscriptionTypeExternalId) {
                const otherPendingPayments = pendingPayments.filter(p => p.subscription_id !== subscriptionTypeExternalId);
                if (otherPendingPayments.length > 0) {
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
            return payments.filter(payment => payment.status === 'PENDING');
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
