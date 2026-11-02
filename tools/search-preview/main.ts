// Mounts the REAL top bar, with the site search in it, over a stand-in page.
// Only the HTTP transport, the registry and the auth store are stubbed (see
// vite.config.ts); the field, the lazy panel, the loaders, the scoring, the
// stylesheets and the theme are the ones that ship.
//
//   ?theme=<id>      any galaxy          ?lang=ar|zh     the other two languages
//   ?signedout=1     a visitor           ?plan=none      signed in, no plan
//   ?fail=runbooks   a service down      ?delay=ms / ?slow=lessons:4000
//   ?sidebar=0       no stand-in sidebar column (the bar spans the viewport)
import { createApp, h } from 'vue';
import { RouterView, createMemoryHistory, createRouter, useRoute } from 'vue-router';
import { createPinia } from 'pinia';
import TopBar from '@/components/TopBar.vue';
import AnimatedBackground from '@/components/AnimatedBackground.vue';
import '@/assets/css/theme.css';
import '@/assets/css/responsive.css';
import '@/style.css';
import '@/assets/css/ui.css';
import '@/assets/css/labs.css';
import '@/assets/css/tour.css';
import '@/assets/css/assistant.css';
import '@/assets/css/rtl.css';
import { THEMES, applyTheme } from '@/theme/apply';
import { i18n, setLocale } from '@/i18n/runtime';
import type { LocaleId } from '@/i18n/locales';

const params = new URLSearchParams(location.search);
applyTheme(THEMES.find(t => t.id === params.get('theme')) ?? THEMES[0]);
setLocale((params.get('lang') || 'en') as LocaleId);

// A fresh session every load unless asked otherwise: the catalogue cache and
// the recent searches live in localStorage and would make runs depend on order.
if (!params.has('keep')) {
    for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sfs-gs')) localStorage.removeItem(key);
    }
}

const Page = {
    setup() {
        const route = useRoute();
        return () => h('main', { class: 'sp-page' }, [
            h('h1', 'Stand-in page'),
            h('p', { id: 'sp-route' }, route.fullPath),
            ...Array.from({ length: 6 }, (_, i) => h('p', { class: 'sp-para' },
                `Paragraph ${i + 1}. The search panel opens over this page and must stay readable on top of it.`)),
        ]);
    },
};

const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:all(.*)', component: Page }],
});

const withSidebar = params.get('sidebar') !== '0' && innerWidth >= 900;

const app = createApp({
    setup() {
        return () => h('div', { class: 'sp-shell' }, [
            h(AnimatedBackground),
            withSidebar ? h('aside', { class: 'sp-side' }, 'Sidebar') : null,
            h('div', { class: 'sp-main' }, [h(TopBar), h(RouterView)]),
        ]);
    },
});
app.use(createPinia());
app.use(i18n);
app.use(router);

const style = document.createElement('style');
style.textContent = `
  body { margin: 0; }
  .sp-shell { position: relative; z-index: 1; display: flex; min-height: 100vh; }
  .sp-side { flex: 0 0 248px; padding: 1rem; color: var(--sfs-text-muted);
             border-inline-end: 1px solid rgb(var(--sfs-line-rgb) / .14); }
  .sp-main { flex: 1 1 auto; min-width: 0; position: relative; }
  .sp-page { padding: 1.2rem; color: var(--sfs-text); }
  .sp-para { max-width: 60ch; color: var(--sfs-text-muted); }
`;
document.head.appendChild(style);

router.push(params.get('path') || '/courses').then(() => router.isReady()).then(() => app.mount('#app'));

(window as any).__sfsRoute = () => router.currentRoute.value.fullPath;
