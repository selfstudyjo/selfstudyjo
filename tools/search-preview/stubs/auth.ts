/**
 * The auth store, as the plain object the top bar and the search read.
 *
 *   (default)       signed in with every feature
 *   ?signedout=1    a visitor: gated results become "Sign in to open" locks
 *   ?plan=none      signed in, no subscription: gated results become plan locks
 */
const params = new URLSearchParams(location.search);
const signedIn = !params.has('signedout');
const paid = signedIn && params.get('plan') !== 'none';

export function useAuthStore() {
    return {
        user: signedIn ? { id: 'u-1', username: 'sami', full_name: 'Sami Qudah', is_admin: false } : null,
        isAuthenticated: signedIn,
        hasAiAccess: paid,
        hasLabAccess: paid,
        hasRunbookAccess: paid,
        hasResearchFlowAccess: paid,
        hasToastmastersAccess: paid,
        hasExamFeature: paid,
        isProctor: false,
    };
}
