import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { subscriptionGuard } from './subscription-guard';

const publicRoutes = ['/login', '/register', '/verify-email', '/plans'];

export async function authGuard(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
): Promise<void> {
    const authStore = useAuthStore();

    try {
        if (authStore.token && !authStore.isAuthenticated) {
            await authStore.checkAuth();
        }

        const isPublicRoute = to.meta.requiresAuth === false;
        const isPublicPath = publicRoutes.includes(to.path);

        if (isPublicRoute || isPublicPath) {
            next();
            return;
        }

        if (authStore.isAuthenticated) {
            if (authStore.requiresVerification && to.path !== '/verify-email') {
                next('/verify-email');
                return;
            }

            if (to.meta.requiresSubscription) {
                await subscriptionGuard(to, from, next);
                return;
            }

            next();
        } else {
            next('/login');
        }
    } catch (error) {
        console.error('Auth guard error:', error);
        next('/login');
    }
}

export function publicOnlyGuard(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
): void {
    const authStore = useAuthStore();
    authStore.initAuth();
    if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
        next('/');
    } else {
        next();
    }
}
