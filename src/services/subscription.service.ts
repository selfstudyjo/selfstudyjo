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
            return await apiService.get<SubscriptionType[]>(
                baseUrl,
                '/subscription-types/'
            );
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
            return await apiService.get<SubscriptionType>(
                baseUrl,
                `/subscription-types/${externalId}/`
            );
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
            return await apiService.get<Subscription[]>(
                baseUrl,
                `/subscriptions/?user_id=${userId}`
            );
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
            return await apiService.post<Subscription>(
                baseUrl,
                '/subscriptions/',
                data
            );
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

    async hasFeature(userId: string, featureExternalId: string): Promise<boolean> {
        try {
            const activeSubscription = await this.getActiveUserSubscription(userId);

            if (!activeSubscription) {
                return false;
            }

            return activeSubscription.subscription_type.features.some(
                feature => feature.external_id === featureExternalId
            );
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

            const subscriptionFeatures = activeSubscription.subscription_type.features.map(f => f.external_id);
            const missingFeatures = requiredFeatures.filter(feature =>
            !subscriptionFeatures.includes(feature)
            );

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

            // Check if user has a pending payment for this specific subscription type
            let pendingPaymentForPlan: Payment | null = null;
            if (subscriptionTypeExternalId) {
                pendingPaymentForPlan = userPayments.find(payment =>
                payment.subscription_id === subscriptionTypeExternalId &&
                payment.status === 'PENDING'
                ) || null;
            }

            // Check if user has any pending payment
            const pendingPayments = userPayments.filter(payment => payment.status === 'PENDING');
            const hasPendingPayment = pendingPayments.length > 0;

            // Determine if user can subscribe to this plan
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
                // Check if any pending payment is for a different plan
                const otherPendingPayments = pendingPayments.filter(p =>
                p.subscription_id !== subscriptionTypeExternalId
                );
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

// Add subscription service to service registry
export async function getRandomSubscriptionReplica(): Promise<string | null> {
    const replicas = await serviceRegistry.getServiceReplicas(
        parseInt(import.meta.env.VITE_SUBSCRIPTIONS_APP_ID || '22'),
                                                              'subscription'
    );
    return serviceRegistry.getRandomReplica(replicas);
}

// Update service registry to include subscription methods
serviceRegistry.getRandomSubscriptionReplica = getRandomSubscriptionReplica;
