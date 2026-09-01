// Stands in for `@/store/auth` in the lab-workspace preview.
//
// `?state=noaccess` renders the "your plan does not include the labs" gate,
// which is a real state a paying visitor lands on and one nobody has looked at.
const params = new URLSearchParams(location.search);
const state = params.get('state') || 'ok';

export const useAuthStore = () => ({
    user: {
        id: 'u-preview',
        user_id: 'b7d1f0c2-9a44-4e18-8f61-2c0d5a7e9b33',
        username: 'mahmoud',
        full_name: 'Mahmoud Alqudah',
    },
    isAuthenticated: true,
    hasLabAccess: state !== 'noaccess',
    checkAuth: () => Promise.resolve(true),
});
