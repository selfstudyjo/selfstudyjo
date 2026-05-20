import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { subscriptionService } from '@/services/subscription.service';

export async function subscriptionGuard(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
): Promise<void> {
    const authStore = useAuthStore();

    const requiresSubscription = to.meta.requiresSubscription === true;
    const requiredFeatures = to.meta.requiredFeatures as string[] || [];

    if (!requiresSubscription || requiredFeatures.length === 0) {
        next();
        return;
    }

    if (!authStore.isAuthenticated || !authStore.user?.id) {
        next('/login');
        return;
    }

    // Always refresh the union of features from ALL active (non-expired) subscriptions.
    // This ensures features added/removed by switching plans or activating a new
    // subscription are reflected immediately on navigation.
    await authStore.loadUserFeatures();

    const userFeatures = authStore.userFeatures;
    const missingFeatures = requiredFeatures.filter(f => !userFeatures.includes(f));

    if (missingFeatures.length > 0) {
        const redirectData = {
            requiredFeatures: missingFeatures,
            from: to.path
        };
        sessionStorage.setItem('subscriptionRedirect', JSON.stringify(redirectData));
        next('/plans');
        return;
    }

    next();
}

/**
 * Check if the user has access to a particular feature.
 * Considers features from ALL non-expired active subscriptions (union).
 */
export async function checkFeatureAccess(featureName: string): Promise<boolean> {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated || !authStore.user?.id) {
        return false;
    }
    // Always pull a fresh union so this matches the current state of all subs
    try {
        const features = await subscriptionService.getAllUserFeatures(authStore.user.id);
        // Keep the store in sync as well
        authStore.userFeatures = features;
        return features.includes(featureName);
    } catch (error) {
        console.error('Feature access check error:', error);
        return authStore.userFeatures.includes(featureName);
    }
}

export async function getActiveSubscription() {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated || !authStore.user?.id) {
        return null;
    }
    try {
        return await subscriptionService.getActiveUserSubscription(authStore.user.id);
    } catch (error) {
        console.error('Get active subscription error:', error);
        return null;
    }
}

/**
 * Get ALL non-expired active subscriptions for the user.
 */
export async function getAllActiveSubscriptions() {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated || !authStore.user?.id) {
        return [];
    }
    try {
        return await subscriptionService.getUsableSubscriptions(authStore.user.id);
    } catch (error) {
        console.error('Get all active subscriptions error:', error);
        return [];
    }
}