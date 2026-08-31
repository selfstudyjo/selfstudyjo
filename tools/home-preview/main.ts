// Mounts the real Home.vue with the network stubbed. See vite.config.ts.
import { createApp, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import Home from '@/views/Home.vue';
import AnimatedBackground from '@/components/AnimatedBackground.vue';
import '@/assets/css/theme.css';
import '@/assets/css/responsive.css';
import '@/style.css';
import '@/assets/css/ui.css';
import '@/assets/css/rtl.css';
import { THEMES, applyTheme } from '@/theme/apply';
import { i18n, setLocale } from '@/i18n/runtime';
import type { LocaleId } from '@/i18n/locales';

const params = new URLSearchParams(location.search);

// ?theme=cartwheel — the only way to see the score ring and the badge tiers in
// the three light galaxies, where the whole ink convention flips.
applyTheme(THEMES.find(t => t.id === params.get('theme')) ?? THEMES[0]);

// ?lang=ar — the dashboard has a score ring (which must NOT mirror), a badge row
// and four stat tiles whose labels are one long word in Arabic.
// `setLocale` also writes `lang` and `dir` onto <html>, which is the only thing
// that mirrors a layout — so this is both halves in one call.
setLocale((params.get('lang') || 'en') as LocaleId);

/*
  `<router-link>` appears nine times in this template — the four quick actions,
  the course rows, the certificates, the homeworks and two empty-state buttons —
  and it throws without a router installed. A memory history with one catch-all
  route resolves every `to` the view can produce without needing the real
  router's fifty imports (which would pull every view in the app into this
  preview's bundle).
*/
const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:all(.*)', component: { render: () => h('div') } }],
});

/*
  The real background, not a flat colour.

  `tools/leaderboard-preview` substitutes the space colour for it, which was
  right when the background was a WebGL galaxy — a canvas in a screenshot is
  noise. It is CSS gradients now, and every card on this page is a
  `backdrop-filter` over it, so leaving it out would be previewing the glass
  against something it never sits on.
*/
const app = createApp({
    render: () => [h(AnimatedBackground), h('div', { class: 'main-content' }, [h(Home)])],
});
app.use(i18n);
app.use(router);

router.isReady().then(() => app.mount('#app'));

/*
  `?probe=1` — the overflow report.

  A screenshot cannot show a page-level sideways scrollbar: the capture is
  simply cropped, which reads as "the design is wide" rather than as a bug. So
  after a paint the page walks its own tree and names every element wider than
  the viewport and every element overflowing its own box, and `shoot.mjs` reads
  that back over CDP.

  Every rect is INTERSECTED WITH ITS CLIPPING ANCESTORS first, exactly as
  `tools/rtl-audit` does, and the first version of this probe skipped that step
  and was immediately wrong: it reported `.sfs-bg__aurora` as overflowing at
  every width, in every variant. That element is `inset: -15%` ON PURPOSE — an
  oversized gradient so a slow drift can never bring an edge into view — inside
  a shell that is `overflow: hidden` and `contain: strict`. It is clipped, it
  cannot produce a scrollbar, and 12 reports of it drown the one real finding
  the next change introduces.
*/
if (params.has('probe')) {
    setTimeout(() => {
        const viewport = document.documentElement.clientWidth;
        const docWidth = document.documentElement.scrollWidth;
        const lines: string[] = [
            `VIEWPORT ${viewport}  DOCUMENT ${docWidth}  ` +
            (docWidth > viewport ? `SIDEWAYS SCROLL by ${docWidth - viewport}px` : 'no sideways scroll'),
        ];
        /** How far right this element is actually VISIBLE, after every clip. */
        const visibleRight = (el: HTMLElement): number => {
            let right = el.getBoundingClientRect().right;
            for (let p = el.parentElement; p; p = p.parentElement) {
                const style = getComputedStyle(p);
                const clips = style.overflowX !== 'visible'
                    || style.contain.includes('paint') || style.contain.includes('strict');
                if (clips) right = Math.min(right, p.getBoundingClientRect().right);
            }
            return right;
        };

        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
            const box = el.getBoundingClientRect();
            if (box.width === 0 && box.height === 0) continue;
            const name = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/)[0] || '-'}`;
            if (visibleRight(el) > viewport + 1) lines.push(`OVERFLOWS VIEWPORT  ${name}  right=${Math.round(box.right)}`);
            if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible') {
                lines.push(`OVERFLOWS ITSELF    ${name}  scroll=${el.scrollWidth} client=${el.clientWidth}`);
            }
        }
        const out = document.createElement('pre');
        out.id = 'probe';
        out.style.display = 'none';
        out.textContent = lines.join('\n');
        document.body.appendChild(out);
    }, 1500);
}
