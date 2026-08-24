// Mounts the real Leaderboard view with the network stubbed. See stub.service.ts.
import { createApp } from 'vue';
import Leaderboard from '@/views/Leaderboard.vue';
import '@/assets/css/theme.css';
import '@/assets/css/responsive.css';
import '@/style.css';
import { THEMES, applyTheme } from '@/theme/apply';

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

createApp(Leaderboard).mount('#app');

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
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
            const box = el.getBoundingClientRect();
            if (box.width === 0 && box.height === 0) continue;
            const name = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/)[0] || '-'}`;
            if (box.right > viewport + 1) {
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
