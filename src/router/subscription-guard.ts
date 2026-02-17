import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { subscriptionService } from '@/services/subscription.service';

export async function subscriptionGuard(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
): Promise<void> {
    const authStore = useAuthStore();

    // Check if route requires subscription
    const requiresSubscription = to.meta.requiresSubscription === true;
    const requiredFeatures = to.meta.requiredFeatures as string[] || [];

    if (!requiresSubscription || requiredFeatures.length === 0) {
        next();
        return;
    }

    // Check if user is authenticated
    if (!authStore.isAuthenticated || !authStore.user?.id) {
        next('/login');
        return;
    }

    try {
        // Check subscription access
        const { hasAccess, missingFeatures, activeSubscription } =
        await subscriptionService.checkSubscriptionAccess(authStore.user.id, requiredFeatures);

        if (!hasAccess) {
            // Store the required features and redirect to plans page
            const redirectData = {
                requiredFeatures: missingFeatures,
                from: to.path
            };

            // You can store this in sessionStorage or pass as query params
            sessionStorage.setItem('subscriptionRedirect', JSON.stringify(redirectData));

            // Redirect to plans page
            next('/plans');
            return;
        }

        // User has access, continue
        next();
    } catch (error) {
        console.error('Subscription guard error:', error);
        // On error, redirect to plans page
        next('/plans');
    }
}

// Helper function to check access in components
export async function checkFeatureAccess(featureExternalId: string): Promise<boolean> {
    const authStore = useAuthStore();

    if (!authStore.isAuthenticated || !authStore.user?.id) {
        return false;
    }

    try {
        return await subscriptionService.hasFeature(authStore.user.id, featureExternalId);
    } catch (error) {
        console.error('Feature access check error:', error);
        return false;
    }
}

// Helper function to get active subscription
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
