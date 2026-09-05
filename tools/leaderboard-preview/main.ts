// Mounts the real Leaderboard view with the network stubbed. See stub.service.ts.
import { createApp } from 'vue';
import Leaderboard from '@/views/Leaderboard.vue';
import '@/assets/css/theme.css';
import '@/assets/css/responsive.css';
import '@/style.css';
import { THEMES, applyTheme } from '@/theme/apply';
import { i18n } from '@/i18n/runtime';

// ?theme=orion so one command can screenshot all ten galaxies.
const wanted = new URLSearchParams(location.search).get('theme') || 'andromeda';
applyTheme(THEMES.find(t => t.id === wanted) ?? THEMES[0]);

// The page normally sits on the 3D galaxy that DefaultLayout paints. The
// harness stands in for it with the flat space colour, because a WebGL canvas
// in a screenshot is noise and the cards are measured against the composited
// surface either way.
document.documentElement.style.background = getComputedStyle(document.documentElement)
    .getPropertyValue('--sfs-space').trim() || '#04040f';
document.body.style.background = 'transparent';

/*
  THE i18n PLUGIN IS NOT OPTIONAL, and leaving it out rendered nothing at all.

  `$t` is a template-only global installed by the plugin. Without it every
  `$t(...)` in the view throws `$t is not a function` during the first render, Vue
  aborts the mount, and the page is BLANK — while the overflow probe below
  cheerfully reports "no sideways scroll", because an empty document does not
  overflow anything. That is how this harness came to print `clean` for ten
  galaxies at six widths against a page that had not rendered since the day the
  interface learned Arabic. `check:qacoaching` hit the same wall and fixed it the
  same way.
*/
const app = createApp(Leaderboard);
app.use(i18n);
app.mount('#app');

/*
  `?probe=1` — the overflow report.

  `check:leaderboard` proves the model and can say nothing about layout. This is
  the other half: after a paint it walks the tree and names every element wider
  than the viewport, plus every element wider than its own parent's content box.
  Read with a headless browser and `--dump-dom`, so a fixed-width sweep is one
  command rather than an afternoon of eyeballing screenshots.

  A page-level sideways scrollbar is the failure this catches. It is invisible in
  a screenshot — the capture is simply cropped, which reads as "the design is
  wide" rather than as a bug.
*/
if (new URLSearchParams(location.search).has('probe')) {
    setTimeout(() => {
        const docWidth = document.documentElement.scrollWidth;
        const viewport = document.documentElement.clientWidth;
        const lines: string[] = [
            `VIEWPORT ${viewport}  DOCUMENT ${docWidth}  ` +
            (docWidth > viewport ? `SIDEWAYS SCROLL by ${docWidth - viewport}px` : 'no sideways scroll'),
        ];
        /*
          AN EMPTY PAGE IS THE FAILURE THIS PROBE MISSED FOR MONTHS.

          Everything below asks whether something is too wide, and nothing is too
          wide when nothing rendered — so a mount that threw reported as clean, at
          every width, in every galaxy. The board is the point of the page: if
          there is no ranked row and no empty-state card, nothing else measured
          here means anything.
        */
        const mounted = document.querySelector('.lb-page, .lb-board, [class^="lb-"]');
        const text = (document.body.innerText || '').trim();
        if (!mounted || text.length < 80) {
            lines.push(`EMPTY PAGE          nothing rendered `
                + `(${text.length} characters of text, mounted=${Boolean(mounted)})`);
        }
        /*
          AN ELEMENT INSIDE A HORIZONTAL SCROLLER IS NOT JUDGED AGAINST THE
          VIEWPORT.

          `.lb-tableWrap` is `overflow-x: auto`, so a table wider than a 320px
          phone scrolls inside it - which is the whole point of that
          declaration. Measured against the viewport alone every cell in it is a
          finding, and adding one column produced 68 of them for one designed
          behaviour. Sixty-eight false reports drown the one real thing the next
          change introduces; `tools/rtl-audit` learned that going from 2,223
          findings to 14 and `tools/home-preview` learned it again.

          ONLY `auto` and `scroll`, not `hidden` or `clip`. The first version
          of this excused those too and went from 68 findings to 816: an element
          flush against a `hidden` container's right edge became a finding at
          every width, which is worse than the problem it set out to fix.

          The container itself is still judged, because IT is what would give
          the page a sideways scrollbar - and `documentElement.scrollWidth`
          above measures that directly in any case.
        */
        const inScroller = (el: HTMLElement): boolean => {
            for (let node = el.parentElement; node; node = node.parentElement) {
                const overflow = getComputedStyle(node).overflowX;
                if (overflow === 'auto' || overflow === 'scroll') return true;
            }
            return false;
        };

        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
            const box = el.getBoundingClientRect();
            if (box.width === 0 && box.height === 0) continue;
            const name = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/)[0] || '-'}`;
            if (box.right > viewport + 1 && !inScroller(el)) {
                lines.push(`OVERFLOWS VIEWPORT  ${name}  right=${Math.round(box.right)}`);
            }
            if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible') {
                lines.push(`OVERFLOWS ITSELF    ${name}  scroll=${el.scrollWidth} client=${el.clientWidth}`);
            }
        }
        const out = document.createElement('pre');
        out.id = 'probe';
        out.textContent = lines.join('\n');
        document.body.appendChild(out);
    }, 1200);
}
