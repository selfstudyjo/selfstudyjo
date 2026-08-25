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
// Loaded after every page stylesheet on purpose: it corrects what a
// left-to-right layout gets wrong once the document flips, and it can only do
// that from in front. See the file's own header.
import './assets/css/rtl.css'
import { bootstrapTheme } from './theme/apply'
import { bootstrapLocale } from './i18n/apply'
import { i18n, initLocale } from './i18n/runtime'

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

// Applied in the same breath and for the same reason: `dir` on <html> is the
// only thing that mirrors a layout, so a page that paints left-to-right and
// then flips has moved everything the reader was about to click.
bootstrapLocale()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(i18n)
app.use(router)

// Brings the reactive locale into line with what `bootstrapLocale()` already
// wrote onto the document, rather than applying it a second time.
initLocale()
app.mount('#app')