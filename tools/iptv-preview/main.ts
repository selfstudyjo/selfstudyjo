/*
  Mounts the real Self Study TV views with the network stubbed. See
  stub.service.ts for what is faked and why so little of it is.

  THE ROUTER IS REAL, AND THAT IS THE POINT OF THIS HARNESS
  ========================================================

  The four tabs ARE routes (`TV_TABS` in `iptvEngine.ts`), the strip decides
  which one is lit by asking `tabFor(route.path)`, and every tile is a
  `router.push`. A harness with fake tabs would be testing fake tabs — so this
  builds a real `vue-router` over the real view components, with the same five
  paths `src/router/index.ts` registers for `/tv`. If a tab goes dead here, it is
  dead in the app.
*/
import { createApp, h } from 'vue';
import { RouterView, createRouter, createWebHashHistory } from 'vue-router';

import Iptv from '@/views/Iptv.vue';
import IptvSeries from '@/views/IptvSeries.vue';
import IptvWatch from '@/views/IptvWatch.vue';
import IptvLive from '@/views/IptvLive.vue';

import '@/assets/css/theme.css';
/*
  `default-layout.css` is imported because it owns `--main-content-padding` and
  the `.app-container > .main-content` padding that spends it. Without it the
  variable is undefined, the declaration is dropped, and every page renders with
  its tiles running to x = 0 - which reads exactly like a grid overflowing its
  container and is nothing of the kind. `side-nav.css` is deliberately NOT
  imported: it owns the rail's own width and the margin that shifts the content
  aside, and there is no rail here.
*/
import '@/assets/css/default-layout.css';
import '@/assets/css/responsive.css';
import '@/style.css';
import '@/assets/css/rtl.css';
import { THEMES, applyTheme } from '@/theme/apply';
import { i18n, setLocale } from '@/i18n/runtime';
import { applyLocale, getLocale } from '@/i18n/apply';

const params = new URLSearchParams(location.search);

// ?theme=orion so one command can screenshot all ten galaxies.
const wanted = params.get('theme') || 'andromeda';
applyTheme(THEMES.find(t => t.id === wanted) ?? THEMES[0]);

/*
  ?locale=ar — and it is applied BEFORE the app mounts, for the reason
  `audit:rtl` documents: clicking a language picker afterwards measures a page
  that has already laid itself out left to right, so an RTL fault is invisible.
*/
const locale = params.get('locale') || 'en';
setLocale(locale as any);
applyLocale(getLocale(locale as any));

/*
  The page normally sits on the 3D galaxy that DefaultLayout paints. The harness
  stands in for it with the flat space colour, because a WebGL canvas in a
  screenshot is noise and every surface here is measured against the composited
  colour either way.
*/
document.documentElement.style.background = getComputedStyle(document.documentElement)
    .getPropertyValue('--sfs-space').trim() || '#04040f';
document.body.style.background = 'transparent';

/*
  DefaultLayout's padded, scrolling `.main-content` is stood in for too, because
  the bar is `position: sticky` and sticky is measured against the nearest
  SCROLLING ancestor. Without a stand-in the harness would prove the bar sticks
  to a container the app does not have.
*/
const shell = document.createElement('div');
shell.className = 'app-container';
const main = document.createElement('div');
main.className = 'main-content';
const host = document.createElement('div');
host.id = 'app';
main.appendChild(host);
shell.appendChild(main);
document.getElementById('app')?.replaceWith(shell);

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: '/', redirect: '/tv' },
        { path: '/tv', component: Iptv },
        // The same constrained parameter the app registers, so `/tv/live` and
        // `/tv/series/:id` cannot be swallowed by it here either.
        { path: '/tv/:tab(movies|series)', component: Iptv },
        { path: '/tv/live', component: IptvLive },
        { path: '/tv/series/:id', component: IptvSeries },
        { path: '/tv/watch/:kind(movie)/:id', component: IptvWatch },
        { path: '/tv/watch/:kind(episode)/:seriesId/:id', component: IptvWatch },
        // Everything the sidebar's `related` links point at. They are not part of
        // this preview, so they resolve to a plain note rather than to a warning
        // in the console on every render.
        { path: '/:rest(.*)', component: { render: () => h('p', { style: 'padding:2rem' }, 'Not in this preview.') } },
    ],
});

/*
  A RENDER FUNCTION, not a `template` string.

  A production Vue build ships no template compiler, so `template: '<router-view/>'`
  is silently ignored: the app mounts, `data-v-app` appears, and the root renders
  an empty comment node. Every page then measures as a page with nothing wrong
  with it - which is exactly the failure `audit:rtl` spent an afternoon on, and
  the reason this harness treats "never rendered" as its own reported failure
  rather than as an absence of problems.
*/
const app = createApp({ render: () => h(RouterView) });
app.use(i18n);
app.use(router);
app.mount(host);

/*
  `?probe=1` — the overflow report, on the leaderboard preview's model.

  `check:iptv` proves the model and can say nothing about layout. This walks the
  tree after a paint and names every element wider than the viewport and every
  element overflowing its own box, so a fixed-width sweep is one command rather
  than an afternoon of eyeballing screenshots.

  A page-level sideways scrollbar is the failure this catches, and it is
  invisible in a screenshot: the capture is simply cropped, which reads as "the
  design is wide" rather than as a bug.

  Rects are intersected with their clipping ancestors first, exactly as
  `audit:rtl` learned to: a shelf is DELIBERATELY wider than its own box
  (`overflow-x: auto` is what makes it a shelf), and reporting every tile in
  every shelf drowns the report in correct behaviour. That took the first Arabic
  run from 2,223 problems to 14.
*/
if (params.has('probe')) {
    setTimeout(() => {
        const viewport = document.documentElement.clientWidth;
        const docWidth = document.documentElement.scrollWidth;
        const lines: string[] = [
            `VIEWPORT ${viewport}  DOCUMENT ${docWidth}  `
            + (docWidth > viewport + 1
                ? `SIDEWAYS SCROLL by ${docWidth - viewport}px`
                : 'no sideways scroll'),
        ];

        /*
          The visible rect, after every clipping ancestor — plus whether any of
          that clipping happened under `overflow: hidden` rather than `auto`.

          THE DISTINCTION IS THE WHOLE POINT, and intersecting without it makes
          the probe lie. `overflow-x: auto` on a shelf means the tiles past the
          edge are REACHABLE, so clipping them out of the report is right — that
          is the noise reduction `audit:rtl` needed. `overflow-x: hidden` on
          `.main-content` means they are gone: unreachable by scroll, by keyboard
          or by touch. Intersecting there hides a real fault and reports the page
          as clean, which is the same shape as a check whose input has been
          silently emptied.
        */
        function clipped(el: HTMLElement): { box: DOMRect; cut: string } | null {
            let box = el.getBoundingClientRect();
            let node: HTMLElement | null = el.parentElement;
            let cut = '';
            while (node) {
                const style = getComputedStyle(node);
                if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
                    const outer = node.getBoundingClientRect();
                    const left = Math.max(box.left, outer.left);
                    const right = Math.min(box.right, outer.right);
                    const top = Math.max(box.top, outer.top);
                    const bottom = Math.min(box.bottom, outer.bottom);
                    if (right <= left || bottom <= top) return null;
                    const lost = (box.right - right) + (left - box.left);
                    if (lost > 1 && !cut
                        && style.overflowX === 'hidden' && style.overflowY !== 'auto') {
                        cut = `${node.tagName.toLowerCase()}.`
                            + ((node.className || '').toString().split(/\s+/)[0] || '-');
                    }
                    box = new DOMRect(left, top, right - left, bottom - top);
                }
                node = node.parentElement;
            }
            return { box, cut };
        }

        for (const el of Array.from(document.querySelectorAll<HTMLElement>('.main-content *'))) {
            const raw = el.getBoundingClientRect();
            if (raw.width === 0 && raw.height === 0) continue;
            const found = clipped(el);
            if (!found) continue;
            const { box, cut } = found;
            const name = `${el.tagName.toLowerCase()}.`
                + ((el.className || '').toString().split(/\s+/)[0] || '-');
            if (box.right > viewport + 1) {
                lines.push(`OVERFLOWS VIEWPORT  ${name}  right=${Math.round(box.right)}`);
            }
            if (cut) {
                lines.push(`OVERFLOWS ITSELF    ${name}  clipped away by ${cut} `
                    + `(overflow: hidden, so it is unreachable)`);
            }
            if (el.scrollWidth > el.clientWidth + 1
                && getComputedStyle(el).overflowX === 'visible') {
                lines.push(`OVERFLOWS ITSELF    ${name}  `
                    + `scroll=${el.scrollWidth} client=${el.clientWidth}`);
            }
        }

        const out = document.createElement('pre');
        out.id = 'probe';
        out.textContent = lines.join('\n');
        document.body.appendChild(out);
    }, 900);
}
