import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

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

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')