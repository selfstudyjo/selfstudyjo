import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// Order matters. theme.css declares what everything else spends — the colour
// tokens per galaxy and the shared type/shape/elevation scale — and sets the
// floor for elements no page styles; responsive.css scales the units those
// pages are written in; ui.css gives every element a default worth inheriting.
// All of them land before any route chunk, so a page rule always wins a tie.
import './assets/css/theme.css'
import './assets/css/responsive.css'
import './style.css'
// The shared component floor: the type scale, the control defaults and the
// `.sfs-*` kit. After style.css so the newer layer wins over the legacy base
// file, and before every route chunk so any page rule still beats it — that
// ordering is the whole reason it is safe to load globally. See its header.
import './assets/css/ui.css'
// The playground labs, the workbench and the top bar's tool dock.
// GLOBAL rather than scoped: the lab UI is eight components deep and
// `<style scoped>` reaches a child component's ROOT element and no
// further. Safe to be global because every selector in it is `sl-` or
// `sfs-topbar`/`sfs-dock` prefixed - the escape check:cssleaks allows.
import './assets/css/labs.css'
// The guided tour's overlay. GLOBAL for the same reason as labs.css and for one
// more: it is teleported to <body>, so a scoped block could never reach it.
// Safe because every class in it is `sfs-tour` prefixed - a namespace no view
// writes, which is the escape check:cssleaks allows.
import './assets/css/tour.css'
// Noor, the site assistant. GLOBAL for the same two reasons as tour.css: her
// window is teleported to <body>, so a scoped block could never reach it, and
// half these page wrappers are stacking contexts a fixed descendant cannot
// escape. Safe because every class in it is `sfs-bot` prefixed - the namespace
// escape check:cssleaks allows, and check:assistant asserts.
import './assets/css/assistant.css'
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