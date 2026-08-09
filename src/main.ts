import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// Order matters. theme.css declares what everything else spends and sets the
// floor for elements no page styles; responsive.css scales the units those
// pages are written in. Both are imported before style.css and before any
// route chunk, so a page rule always wins a tie against them.
import './assets/css/theme.css'
import './assets/css/responsive.css'
import './style.css'
import { bootstrapTheme } from './theme/apply'

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // ✅ Use BASE_URL so SW path works on GitHub Pages subpath (e.g. /repo-name/)
        const swPath = `${import.meta.env.BASE_URL}sw.js`.replace(/\/+/g, '/');

        navigator.serviceWorker.register(swPath).then((registration) => {
            // Force an update check so users get the new (no-op) SW
            // instead of being stuck with an older version that intercepts media.
            try {
                registration.update();
            } catch {
                /* ignore */
            }
        }).catch(() => {
            // Silently ignore service worker registration failure
        });
    });

    // If a new service worker takes over (e.g. the old intercepting one is
    // replaced by the new no-op one), reload once so all requests now use
    // the new SW state.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
    });
}

// Applied before Vue exists so the first frame is already the right galaxy.
// Every var(--sfs-…) in the stylesheets carries the pre-theme literal as its
// fallback, so this failing would render the old palette rather than nothing.
bootstrapTheme()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')