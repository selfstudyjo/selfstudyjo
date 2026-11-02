// Mounts the real RoadmapProvider.vue with app 27 stubbed. See vite.config.ts.
import { createApp, h } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import RoadmapProvider from '@/views/RoadmapProvider.vue';
import AnimatedBackground from '@/components/AnimatedBackground.vue';
import '@/assets/css/theme.css';
import '@/assets/css/responsive.css';
import '@/style.css';
import '@/assets/css/ui.css';
import '@/assets/css/rtl.css';
// Global in the real app (main.ts); it carries html.sfs-fs-lock, the scroll
// lock under the full-screen overlay, without which the page scrollbar stays.
import '@/assets/css/labs.css';
import { THEMES, applyTheme } from '@/theme/apply';
import { i18n, setLocale } from '@/i18n/runtime';
import type { LocaleId } from '@/i18n/locales';

const params = new URLSearchParams(location.search);
applyTheme(THEMES.find(t => t.id === params.get('theme')) ?? THEMES[0]);
setLocale((params.get('lang') || 'en') as LocaleId);

const router = createRouter({
    history: createMemoryHistory(),
    routes: [
        { path: '/roadmaps', component: RoadmapProvider },
        { path: '/roadmaps/:roadmapId', component: RoadmapProvider },
        { path: '/:all(.*)', component: { render: () => h('div', { id: 'elsewhere' }, 'navigated away') } },
    ],
});
(window as any).__router = router;

const app = createApp({
    // The real layout puts the page at `position: relative; z-index: 1` over the
    // fixed background (default-layout.css). Without it every non-positioned
    // element is painted UNDER the background - the first shots had a page
    // whose only visible parts were the sticky list and the 3D canvas.
    render: () => [h(AnimatedBackground), h('div', { class: 'main-content', style: 'position:relative;z-index:1' }, [h(RouterView)])],
});
app.use(i18n);
app.use(router);
router.push(params.get('path') || '/roadmaps');
router.isReady().then(() => app.mount('#app'));

/*
  The overflow report, read back over CDP by shoot.mjs. Rects are intersected
  with their clipping ancestors first - an element inside the map's
  `overflow: auto` box is scrolled, not overflowing - the lesson
  tools/rtl-audit and tools/home-preview both paid for.
*/
(window as any).__probe = () => {
    const viewport = document.documentElement.clientWidth;
    const docWidth = document.documentElement.scrollWidth;
    const lines: string[] = [];
    if (docWidth > viewport) lines.push(`SIDEWAYS SCROLL ${docWidth - viewport}px`);
    const visibleRight = (el: Element): number => {
        let right = el.getBoundingClientRect().right;
        for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (s.overflowX !== 'visible' || s.contain.includes('paint') || s.contain.includes('strict')) {
                right = Math.min(right, p.getBoundingClientRect().right);
            }
        }
        return right;
    };
    for (const el of Array.from(document.querySelectorAll('.rmp *'))) {
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
        if (el.closest('.rm3d__labels')) continue;
        const box = el.getBoundingClientRect();
        if (!box.width && !box.height) continue;
        const name = `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(/\s+/)[0] || '-'}`;
        if (visibleRight(el) > viewport + 1) lines.push(`OVERFLOWS VIEWPORT ${name} right=${Math.round(box.right)}`);
        const he = el as HTMLElement;
        if (!(el instanceof SVGElement) && he.scrollWidth > he.clientWidth + 1
            && getComputedStyle(he).overflowX === 'visible') {
            lines.push(`OVERFLOWS ITSELF ${name} scroll=${he.scrollWidth} client=${he.clientWidth}`);
        }
    }
    return [...new Set(lines)].join('\n');
};
