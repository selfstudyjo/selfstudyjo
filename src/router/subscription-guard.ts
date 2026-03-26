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

    // Ensure user features are loaded
    if (authStore.userFeatures.length === 0) {
        await authStore.loadUserFeatures();
    }

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

export async function checkFeatureAccess(featureName: string): Promise<boolean> {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated || !authStore.user?.id) {
        return false;
    }
    if (authStore.userFeatures.length === 0) {
        await authStore.loadUserFeatures();
    }
    return authStore.userFeatures.includes(featureName);
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
