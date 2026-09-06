// Mounts the real DrawPapers.vue with the network stubbed. See vite.config.ts.
import { createApp, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import DrawPapers from '@/views/DrawPapers.vue';
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

// ?theme=cartwheel — and BOTH halves have to be looked at, because the bug this
// harness was written for was total in a dark galaxy and invisible in a light
// one. A preview that only ever renders the default would have reported the
// page as fine.
applyTheme(THEMES.find(t => t.id === params.get('theme')) ?? THEMES[0]);

// ?lang=ar — the grid mirrors, the tag row mirrors, and one of the stubbed
// papers has an Arabic title, which is what exercises the card's own
// `unicode-bidi: plaintext`. `setLocale` writes `lang` and `dir` onto <html>,
// which is the only thing that mirrors a layout, so this is both halves.
setLocale((params.get('lang') || 'en') as LocaleId);

/*
  `<router-link>` is not in this template, but `useRouter()` is — the page
  navigates on a card click — and it throws without a router installed. A
  memory history with one catch-all resolves every `to` the view can produce
  without pulling the real router's fifty view imports into this bundle.
*/
const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:all(.*)', component: { render: () => h('div') } }],
});

/*
  The real background, not a flat colour.

  Every card on this page is a `backdrop-filter` over it since the 2026-09-06
  rework, so leaving it out would be previewing the glass against something it
  never sits on — which is the whole property being checked.
*/
/*
  THE STACKING CONTEXT IS PART OF THE LAYOUT, and leaving it out cost a wrong
  diagnosis on this harness's first clean run.

  `AnimatedBackground` is `position: fixed; z-index: 0`, and `default-layout.css`
  gives `.main-content` `position: relative; z-index: 1`. That stylesheet is
  keyed on `.app-container > .main-content` and brings the sidebar's margins
  with it, so it is not imported here - but without those two properties the
  fixed background paints in the positioned layer ABOVE every non-positioned
  line of text on the page. The cards survive (`.card` is `position: relative`,
  so it is in the same layer and later in DOM order) and the headings do not,
  which reads unmistakably as a heading bug and is a harness bug.
*/
const app = createApp({
    render: () => [
        h(AnimatedBackground),
        h('div', {
            class: 'main-content',
            style: 'position: relative; z-index: 1; min-height: 100vh',
        }, [h(DrawPapers)]),
    ],
});
app.use(i18n);
app.use(router);

router.isReady().then(() => app.mount('#app'));

/*
  `?probe=1` — the report `shoot.mjs` reads back over CDP.

  TWO THINGS, and the first is the reason this harness exists at all.

  1. **IS THE TITLE ACTUALLY LEGIBLE.** A screenshot of an invisible title and a
     screenshot of a card with no title are the same picture, so photographing
     alone would have needed somebody to notice that five cards had gone quiet.
     This measures it: the computed colour of each `h3` against the composited
     background behind it, as a WCAG ratio. That is a number a check can fail
     on, and it is the exact defect that was reported - `--sfs-paper` under
     `--sfs-text` measured about 1.05:1 in the seven dark galaxies.

  2. **THE OVERFLOW REPORT**, because a screenshot cannot show a page-level
     sideways scrollbar - the capture is simply cropped, which reads as "the
     design is wide" rather than as a bug. Every rect is INTERSECTED WITH ITS
     CLIPPING ANCESTORS first, exactly as `tools/rtl-audit` and
     `tools/home-preview` do: without that step `.sfs-bg__aurora` is reported
     at every width in every variant, because it is `inset: -15%` on purpose
     inside a shell that is `overflow: hidden`, and twelve false reports drown
     the one real finding the next change introduces.
*/
if (params.has('probe')) {
    setTimeout(() => {
        const lines: string[] = [];

        /* ---------------- 1. can every line of text be read ---------------- */
        /*
          EVERY TEXT NODE, not just the card titles.

          The first version of this measured `.card-body h3` alone, because that
          was what had been reported - and its first clean run photographed a
          page whose `h1`, both section headings and the New paper button were
          ALL invisible. A probe aimed at one selector proves one selector, and
          on a page whose whole fault was a token pairing the fault was never
          going to be confined to the element somebody happened to notice.
        */

        /** `rgb(r g b / a)` or `rgb(r,g,b)` to a triple plus alpha. */
        const parse = (value: string): [number, number, number, number] => {
            const parts = (value.match(/[\d.]+/g) || []).map(Number);
            return [parts[0] || 0, parts[1] || 0, parts[2] || 0,
                parts.length > 3 ? parts[3] : 1];
        };

        /** Composite a stack of colours, front to back, onto white. */
        const flatten = (stack: [number, number, number, number][]) => {
            let [r, g, b] = [255, 255, 255];
            for (let i = stack.length - 1; i >= 0; i--) {
                const [sr, sg, sb, sa] = stack[i];
                r = sr * sa + r * (1 - sa);
                g = sg * sa + g * (1 - sa);
                b = sb * sa + b * (1 - sa);
            }
            return [r, g, b] as [number, number, number];
        };

        const luminance = ([r, g, b]: [number, number, number]) => {
            const channel = (c: number) => {
                const v = c / 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };

        const ratio = (a: [number, number, number], b: [number, number, number]) => {
            const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
            return (hi + 0.05) / (lo + 0.05);
        };

        /**
         * Everything painted BEHIND this element, nearest first.
         *
         * Walked rather than assumed, because the whole bug was a card whose
         * fill came from one token and whose ink came from another: the only
         * honest way to measure it is to find the fill the browser actually
         * used, wherever in the ancestry it was declared.
         */
        const backdrop = (el: HTMLElement) => {
            const stack: [number, number, number, number][] = [];
            for (let p: HTMLElement | null = el; p; p = p.parentElement) {
                const colour = parse(getComputedStyle(p).backgroundColor);
                if (colour[3] > 0.001) stack.push(colour);
                if (colour[3] > 0.99) break;
            }
            return stack;
        };

        /** The element's OWN text, ignoring what its children carry. */
        const ownText = (el: HTMLElement) => Array.from(el.childNodes)
            .filter(n => n.nodeType === 3)
            .map(n => (n.textContent || '').trim())
            .join(' ')
            .trim();

        let measured = 0;
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
            const text = ownText(el);
            if (!text) continue;
            const style = getComputedStyle(el);
            // Genuinely hidden text is not a legibility problem. `opacity: 0`
            // is how the card's own action buttons rest, and a screen reader
            // still reaches them - they are measured when hovered, not here.
            if (style.visibility === 'hidden' || style.display === 'none'
                || Number(style.opacity) < 0.1) continue;
            const box = el.getBoundingClientRect();
            if (box.width < 2 || box.height < 2) continue;

            const ink = parse(style.color);
            if (ink[3] < 0.1) continue;
            const behind = flatten(backdrop(el));
            const seen = ratio([ink[0], ink[1], ink[2]], behind);
            measured += 1;
            const name = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/)[0] || '-'}`;

            /*
              IS ANYTHING ON TOP OF IT, which a contrast measurement cannot
              see - and this is the check that would have caught the fault this
              harness shipped with. Its first clean run reported all 44 lines of
              text as legible and photographed a page with no headings on it:
              they were legible, and they were painted underneath the
              background, because the harness had left out the two properties
              the real layout gives `.main-content`.

              `elementFromPoint` at the element's own centre is the tool for it
              (working rule 32 - it is how `.placeholder` was found covering
              every date on the exam calendar), and it is checked at the CENTRE
              of the first line rather than of the box, because a two-line
              heading's centre falls in the leading between its lines.
            */
            const x = Math.round(box.left + Math.min(box.width, 40) / 2);
            const y = Math.round(box.top + Math.min(box.height, 20) / 2);
            if (x > 0 && y > 0 && x < window.innerWidth && y < window.innerHeight) {
                const hit = document.elementFromPoint(x, y);
                if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
                    const over = `${hit.tagName.toLowerCase()}.${(hit.className || '').toString().split(/\s+/)[0] || '-'}`;
                    lines.push(`COVERED ${name} by ${over}  "${text.slice(0, 24)}"`);
                }
            }
            // AA for body text is 4.5:1. Large text is allowed 3:1, and this
            // deliberately does not make that concession: everything on this
            // page is under 24px except the h1, so a single threshold is both
            // simpler and stricter, and a page that clears the strict one
            // needs no argument about which rule applied.
            if (seen < 4.5) {
                lines.push(`UNREADABLE ${seen.toFixed(2)}:1  ${name}  "${text.slice(0, 30)}"`);
            }
        }
        lines.push(`MEASURED ${measured} text elements`);
        if (!document.querySelector('.card-body h3')
            && !document.querySelector('.empty')) {
            lines.push('NO CARDS AND NO EMPTY STATE - the page rendered nothing');
        }

        /* ---------------- 2. the overflow report ---------------- */

        const viewport = document.documentElement.clientWidth;
        const docWidth = document.documentElement.scrollWidth;
        lines.push(`VIEWPORT ${viewport}  DOCUMENT ${docWidth}  `
            + (docWidth > viewport ? `SIDEWAYS SCROLL by ${docWidth - viewport}px`
                : 'no sideways scroll'));

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
            if (visibleRight(el) > viewport + 1) {
                lines.push(`OVERFLOWS VIEWPORT  ${name}  right=${Math.round(box.right)}`);
            }
            if (el.scrollWidth > el.clientWidth + 1
                && getComputedStyle(el).overflowX === 'visible') {
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
