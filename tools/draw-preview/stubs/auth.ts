// Stands in for `@/store/auth` in the Drawing Papers preview.
//
// The real store reaches app 15 and app 13 on `checkAuth()`. Only the members
// DrawPapers.vue reads are provided, so anything else it grows fails loudly
// here rather than silently reaching the network.
import { ref } from 'vue';

export const useAuthStore = () => ({
    user: ref({ id: 'u-preview', username: 'Mahmoud' }).value,
    isAuthenticated: true,
    checkAuth: () => Promise.resolve(true),
});
