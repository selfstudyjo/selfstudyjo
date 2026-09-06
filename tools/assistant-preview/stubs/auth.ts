/**
 * The auth store, as the plain object the dock reads.
 *
 * `?signedout=1` renders the other half of the window — the greeting changes,
 * the suggestion chips change, and every gated destination disappears from the
 * prompt. That state is not a corner case: it is what a visitor deciding
 * whether to sign up sees, which is exactly who the window is most useful to.
 */
const params = new URLSearchParams(location.search);
const signedIn = !params.has('signedout');

export function useAuthStore() {
    return {
        user: signedIn
            ? { id: 'u-1', username: 'sami', full_name: 'Sami Qudah', is_admin: false }
            : null,
        isAuthenticated: signedIn,
        hasAiAccess: signedIn,
        hasLabAccess: signedIn,
        hasRunbookAccess: signedIn,
        hasResearchFlowAccess: signedIn,
        hasToastmastersAccess: signedIn,
        hasExamFeature: signedIn,
        isProctor: false,
    };
}
