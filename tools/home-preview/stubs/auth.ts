// Stands in for `@/store/auth` in the dashboard preview.
//
// The real store reaches app 15 and app 13 on `checkAuth()`. Only the three
// members Home.vue actually reads are provided, so anything else it grows will
// fail loudly here rather than silently reaching the network.
import { ref } from 'vue';

export const useAuthStore = () => ({
    user: ref({ id: 'u-preview', username: 'Mahmoud' }).value,
    isAuthenticated: true,
    checkAuth: () => Promise.resolve(true),
});
