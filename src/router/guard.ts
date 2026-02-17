import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { subscriptionGuard } from './subscription-guard';

// Routes that don't require authentication
const publicRoutes = ['/login', '/register', '/verify-email', '/plans'];

export async function authGuard(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
): Promise<void> {
    const authStore = useAuthStore();

    try {
        // First check if we have local auth data
        if (authStore.token && !authStore.isAuthenticated) {
            await authStore.checkAuth();
        }

        // Check if route is public by meta
        const isPublicRoute = to.meta.requiresAuth === false;
        const isPublicPath = publicRoutes.includes(to.path);

        if (isPublicRoute || isPublicPath) {
            next();
            return;
        }

        // For protected routes, ensure authentication
        if (authStore.isAuthenticated) {
            // Check if user needs email verification
            if (authStore.requiresVerification && to.path !== '/verify-email') {
                next('/verify-email');
                return;
            }

            // Check subscription access if required
            if (to.meta.requiresSubscription) {
                await subscriptionGuard(to, from, next);
                return;
            }

            next();
        } else {
            // Redirect to login if not authenticated
            next('/login');
        }
    } catch (error) {
        console.error('Auth guard error:', error);
        next('/login');
    }
}

// Route guard for login/register pages
export function publicOnlyGuard(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
): void {
    const authStore = useAuthStore();

    // Initialize auth from localStorage
    authStore.initAuth();

    // If already authenticated and trying to access public route, redirect to home
    if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
        next('/');
    } else {
        next();
    }
}