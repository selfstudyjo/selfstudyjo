// Mounts the real AssistantDock with the network stubbed. See vite.config.ts.
import { createApp, h, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import AssistantDock from '@/components/assistant/AssistantDock.vue';
import AssistantButton from '@/components/assistant/AssistantButton.vue';
import AnimatedBackground from '@/components/AnimatedBackground.vue';
import { useAssistant } from '@/composables/useAssistant';
import '@/assets/css/theme.css';
import '@/assets/css/responsive.css';
import '@/style.css';
import '@/assets/css/ui.css';
import '@/assets/css/assistant.css';
import '@/assets/css/rtl.css';
import { THEMES, applyTheme } from '@/theme/apply';
import { i18n, setLocale } from '@/i18n/runtime';
import type { LocaleId } from '@/i18n/locales';

const params = new URLSearchParams(location.search);

applyTheme(THEMES.find(t => t.id === params.get('theme')) ?? THEMES[0]);

// `setLocale` writes `lang` and `dir` onto <html>, which is the only thing that
// mirrors a layout — so this is both halves in one call. It must happen BEFORE
// the mount: clicking a picker afterwards measures a window that has already
// laid itself out left-to-right, which is the mistake `tools/rtl-audit`
// documents.
setLocale((params.get('lang') || 'en') as LocaleId);

/*
  The dock renders `<router-link>` nowhere, but it CALLS `useRoute()` for the
  current path and `useRouter().push()` when a button is pressed. Both throw
  without a router installed. A memory history with one catch-all resolves every
  path the window can produce without pulling the real router's fifty view
  imports into this preview's bundle.
*/
const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:all(.*)', component: { render: () => h('div') } }],
});

const assistant = useAssistant();
const mounted = ref(false);

/*
  The real background, and the button beside it.

  Not decoration in either case: every surface in the window is a
  `backdrop-filter` over the background, so leaving it out would be previewing
  the glass against something it never sits on — and the BUTTON is what shows
  whether the panel lands under the control that opened it, which is the whole
  question in Arabic.
*/
const app = createApp({
    setup() {
        void nextTick(() => {
            assistant.start();
            mounted.value = true;
        });
        return () => [
            h(AnimatedBackground),
            h('div', {
                // A stand-in for the top bar, right-aligned in LTR and
                // left-aligned in RTL for free — it is a flex row and `dir`
                // reverses it, exactly as the real one does.
                style: 'position:fixed;inset-block-start:0;inset-inline:0;height:3.2rem;'
                    + 'display:flex;align-items:center;justify-content:flex-end;'
                    + 'gap:.5rem;padding:0 1rem;'
                    + 'background:rgb(var(--sfs-sink-rgb, 0 0 0)/.35);z-index:1200',
            }, [h(AssistantButton)]),
            mounted.value ? h(AssistantDock) : null,
        ];
    },
});
app.use(i18n);
app.use(router);

router.isReady().then(() => app.mount('#app'));

/*
  `?state=` — drive the window into a state a screenshot cannot reach on its own.

  Done by pressing the real controls rather than by setting a flag the component
  reads, because a flag would be a second code path that only ever runs in this
  harness — and the one that only runs in a harness is the one that goes stale.
  `busy` types a question and sends it, which runs the whole parse → resolve →
  bubble → button path against the stub's real envelope string.
*/
const state = params.get('state') || '';
if (state) {
    setTimeout(() => {
        const box = document.querySelector<HTMLTextAreaElement>('.sfs-bot__input');
        const send = document.querySelector<HTMLButtonElement>('.sfs-bot__act--send');
        const mic = document.querySelector<HTMLButtonElement>('.sfs-bot__act:not(.sfs-bot__act--send)');
        if (state === 'live') { mic?.click(); return; }
        if (!box || !send) return;
        box.value = state === 'long'
            ? 'How did I do in the Docker exam, and where is the certificate for it?'
            : 'Show me my quiz results';
        box.dispatchEvent(new Event('input', { bubbles: true }));
        void nextTick(() => send.click());
    }, 700);
}

/*
  `?probe=1` — the overflow report.

  A screenshot cannot show a page-level sideways scrollbar: the capture is
  simply cropped, which reads as "the design is wide" rather than as a bug.

  Every rect is INTERSECTED WITH ITS CLIPPING ANCESTORS first, exactly as
  `tools/rtl-audit` and `tools/home-preview` do. Skipping that step is not a
  small inaccuracy: the first version of the home preview's probe reported
  `.sfs-bg__aurora` at every width in every variant — an element that is
  `inset: -15%` on purpose inside a shell that is `overflow: hidden` and
  `contain: strict`, so it is clipped and cannot produce a scrollbar. Twelve
  false reports drown the one real finding the next change introduces.
*/
if (params.has('probe')) {
    setTimeout(() => {
        const viewport = document.documentElement.clientWidth;
        const docWidth = document.documentElement.scrollWidth;
        const lines: string[] = [];

        const panel = document.querySelector<HTMLElement>('.sfs-bot');
        if (!panel) {
            // An EMPTY PAGE and a clean page are the same picture, and the
            // leaderboard's shooter printed `clean` for a week against a window
            // that had thrown during its first render. Named, so the shooter
            // can treat it as the failure it is.
            lines.push('WINDOW MISSING — the dock never rendered');
        }

        lines.push(`VIEWPORT ${viewport}  DOCUMENT ${docWidth}  `
            + (docWidth > viewport ? `SIDEWAYS SCROLL by ${docWidth - viewport}px` : 'no sideways scroll'));

        /** How far right this element is actually VISIBLE, after every clip. */
        const visibleRight = (el: HTMLElement): number => {
            let right = el.getBoundingClientRect().right;
            for (let p = el.parentElement; p; p = p.parentElement) {
                const style = getComputedStyle(p);
                const clips = style.overflowX !== 'visible' || style.overflowY !== 'visible'
                    || style.contain.includes('paint') || style.contain.includes('strict');
                if (clips) right = Math.min(right, p.getBoundingClientRect().right);
            }
            return right;
        };
        /** …and how far LEFT, which is the edge that matters once `dir` flips. */
        const visibleLeft = (el: HTMLElement): number => {
            let left = el.getBoundingClientRect().left;
            for (let p = el.parentElement; p; p = p.parentElement) {
                const style = getComputedStyle(p);
                const clips = style.overflowX !== 'visible' || style.overflowY !== 'visible'
                    || style.contain.includes('paint') || style.contain.includes('strict');
                if (clips) left = Math.max(left, p.getBoundingClientRect().left);
            }
            return left;
        };

        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
            const box = el.getBoundingClientRect();
            if (box.width === 0 && box.height === 0) continue;
            const name = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/)[0] || '-'}`;
            if (visibleRight(el) > viewport + 1) {
                lines.push(`OVERFLOWS VIEWPORT  ${name}  right=${Math.round(box.right)}`);
            }
            if (visibleLeft(el) < -1) {
                lines.push(`OFF THE LEFT EDGE   ${name}  left=${Math.round(box.left)}`);
            }
            if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible') {
                lines.push(`OVERFLOWS ITSELF    ${name}  scroll=${el.scrollWidth} client=${el.clientWidth}`);
            }
        }

        /*
          The window must not reach the bottom-right corner, which belongs to
          the support chat launcher (app 9) on every page of the platform. Two
          fixed circles in one corner is the overlap `audit:rtl` reported for
          `ChatBox.vue` and which a reader cannot resolve — and the launcher is
          not rendered here, so nothing else in this harness would notice.
        */
        if (panel) {
            const rect = panel.getBoundingClientRect();
            const clearance = document.documentElement.clientHeight - rect.bottom;
            lines.push(`PANEL bottom clearance ${Math.round(clearance)}px`);
            if (clearance < 72) {
                lines.push(`TOO CLOSE TO THE CORNER  the support chat launcher lives there`);
            }
            if (rect.top < 0) lines.push('PANEL ABOVE THE VIEWPORT  its header is unreachable');
        }

        const out = document.createElement('pre');
        out.id = 'probe';
        out.style.display = 'none';
        out.textContent = lines.join('\n');
        document.body.appendChild(out);
    }, 2200);
}
