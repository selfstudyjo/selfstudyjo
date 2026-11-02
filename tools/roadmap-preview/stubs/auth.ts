// Stands in for `@/store/auth` in the roadmap preview. `?signedout=1` shows
// the page's own signed-out state.
const signedOut = new URLSearchParams(location.search).has('signedout');
export const useAuthStore = () => ({
    user: signedOut ? null : { id: 'u-preview', username: 'Mahmoud' },
    isAuthenticated: !signedOut,
    checkAuth: () => Promise.resolve(!signedOut),
});
