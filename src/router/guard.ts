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
            // Preserve the originally-requested URL so we can send the user back
            // after they successfully log in.
            next({
                path: '/login',
                query: { redirect: to.fullPath }
            });
        }
    } catch (error) {
        console.error('Auth guard error:', error);
        next({
            path: '/login',
            query: { redirect: to.fullPath }
        });
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
        // If we were given a redirect target, honor it; otherwise go home.
        const redirect = to.query.redirect;
        if (typeof redirect === 'string' && redirect.trim() !== '') {
            next(redirect);
        } else {
            next('/');
        }
    } else {
        next();
    }
}