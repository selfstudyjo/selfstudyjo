// Stands in for `@/store/auth` in the Labs preview.
//
// `?state=noaccess` renders the "your plan does not include the labs" screen,
// which is a real state a paying visitor can land on and one nobody has looked
// at either.
import { ref } from 'vue';

const params = new URLSearchParams(location.search);
const state = params.get('state') || 'ok';

export const useAuthStore = () => ({
    user: ref({ id: 'u-preview', username: 'mahmoud' }).value,
    isAuthenticated: true,
    hasLabAccess: state !== 'noaccess',
    checkAuth: () => Promise.resolve(true),
});
