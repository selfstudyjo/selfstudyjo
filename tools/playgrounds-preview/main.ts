import { createApp, h } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { createPinia } from 'pinia';
import TopBar from '@/components/TopBar.vue';
import Playgrounds from '@/views/Playgrounds.vue';
import Playground from '@/views/Playground.vue';
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
try { sessionStorage.removeItem('sfs-playgrounds'); } catch { /* fresh list each load */ }

const router = createRouter({
    history: createMemoryHistory(),
    routes: [
        { path: '/playgrounds', component: Playgrounds },
        { path: '/playground/:playgroundId', component: Playground, props: true },
        { path: '/:all(.*)', component: { render: () => h('div', { class: 'pp-blank' }, 'page') } },
    ],
});

const app = createApp({
    render: () => [
        h(AnimatedBackground),
        h('div', { class: 'app-container' }, [
            h('div', { class: 'main-content', style: 'padding:0' }, [h(TopBar), h(RouterView)]),
        ]),
    ],
});
app.use(createPinia());
app.use(i18n);
app.use(router);

const view = params.get('view') || 'index';
const start = view === 'play' ? `/playground/${params.get('id') || 'play-aws'}`
    : view === 'menu' ? '/home' : '/playgrounds';
router.replace(start).then(() => router.isReady()).then(() => {
    app.mount('#app');
    (window as any).__router = router;
});
