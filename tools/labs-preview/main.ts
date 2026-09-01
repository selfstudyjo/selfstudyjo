// Mounts the real LabWorkspace.vue with app 11 stubbed. See vite.config.ts.
import { createApp, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia } from 'pinia';
import LabWorkspace from '@/views/LabWorkspace.vue';
import AnimatedBackground from '@/components/AnimatedBackground.vue';
import '@/assets/css/theme.css';
import '@/assets/css/responsive.css';
import '@/style.css';
import '@/assets/css/ui.css';
// The lab UI's own stylesheet. GLOBAL in the app (main.ts), so it is global
// here — scoping it would be previewing a page nobody is served.
import '@/assets/css/labs.css';
// The shell the app serves this page inside. `.sfs-bg` is `position: fixed`
// with `z-index: 0`, so a positioned background paints ABOVE in-flow content
// — the app avoids that with `.app-container > .main-content { position:
// relative; z-index: 1 }` in here. Without it the preview renders a page with
// nothing on it, which is a fault in the HARNESS and reads as one in the page.
import '@/assets/css/default-layout.css';
import '@/assets/css/rtl.css';
import { THEMES, applyTheme } from '@/theme/apply';
import { i18n, setLocale } from '@/i18n/runtime';
import type { LocaleId } from '@/i18n/locales';

const params = new URLSearchParams(location.search);

applyTheme(THEMES.find(t => t.id === params.get('theme')) ?? THEMES[0]);

// A console, a code editor and a lab brief's fenced blocks must NOT mirror, so
// this is the page where `rtl.css`'s LTR pins have to be looked at.
setLocale((params.get('lang') || 'en') as LocaleId);

/*
  The route has to be `/lab/:labId`, not a catch-all.

  LabWorkspace reads `route.params.labId` and watches it; a catch-all leaves the
  param undefined, `open()` returns immediately, and the page sits on the
  spinner for ever — which reads as a dead replica rather than as the preview
  addressing the wrong param name. `tools/tools-preview` paid for exactly this.
*/
const router = createRouter({
    history: createMemoryHistory(),
    routes: [
        { path: '/lab/:labId', component: { render: () => h('div') } },
        { path: '/:all(.*)', component: { render: () => h('div') } },
    ],
});

const app = createApp({
    render: () => [
        h(AnimatedBackground),
        h('div', { class: 'app-container' }, [
            h('div', { class: 'main-content' }, [h(LabWorkspace)]),
        ]),
    ],
});
app.use(createPinia());   // the Network Simulator pane is a Pinia store
app.use(i18n);
app.use(router);

/*
  AWAIT THE NAVIGATION, do not fire it and hope. `labId` is read in a computed
  at setup and `open()` runs `onMounted`, so mounting before the router is ready
  opens nothing at all.
*/
router.replace(`/lab/${params.get('lab') || 'web-01-html'}`)
    .then(() => router.isReady())
    .then(() => app.mount('#app'));

/*
  `?probe=1` — the report a screenshot cannot give.

  Three things beyond the overflow scan `tools/tools-preview` does, because all
  three of the faults this harness was built for are invisible in a picture:

  * WHAT THE RESULT FRAME ACTUALLY CONTAINS. The web playground's `<iframe>` is
    `sandbox`ed without `allow-same-origin`, so its document is a unique opaque
    origin this page cannot read — a screenshot of a blank white frame and a
    screenshot of a frame that never received a document are identical. What CAN
    be read is `iframe.srcdoc`, which is the string the component handed it.
  * EVERY PANE AND TOOL BUTTON, so "the simulator opens in another page" can be
    checked as a fact rather than by squinting at a link.
  * AN EMPTY PAGE IS A FAILURE, not a clean run. `tools/leaderboard-preview`
    screenshotted nothing for a week while reporting `clean`, because an empty
    document overflows nothing.
*/
if (params.has('probe')) {
    /*
      WAIT for the page to be ready, never sleep at it.

      The Network Simulator pane is a ~570 kB async chunk with a Pinia store
      that makes network calls behind it, so how long it takes to appear varies
      with the cache and with how fast those calls fail. A fixed delay reported
      it present at one width and absent at the next, in the same run, on a page
      where nothing had changed — which is exactly the shape of a real
      regression and would have been read as one. `tools/rtl-audit` learned the
      same thing waiting for a Babylon scene.

      The condition is "the workbench has rendered AND, if this lab has an
      embedded application, that has too". Bounded, so a lab that genuinely
      cannot draw one still reports rather than hanging.
    */
    const ready = () => {
        if (!document.querySelector('.sl-bench__panel')) return false;
        if (!document.querySelector('.sl-embed')) return true;
        return Boolean(document.querySelector('.ns-studio')
            || document.querySelector('.sl-embed__wait--bad'));
    };
    const settle = (done: () => void, waited = 0) => {
        if (ready() || waited > 12_000) { setTimeout(done, 400); return; }
        setTimeout(() => settle(done, waited + 200), 200);
    };
    settle(() => {
        const viewport = document.documentElement.clientWidth;
        const docWidth = document.documentElement.scrollWidth;
        const lines: string[] = [];

        const workspace = document.querySelector('.sl-workspace');
        if (!workspace || (workspace.textContent || '').trim().length < 20) {
            lines.push('EMPTY PAGE');
        }
        lines.push(`VIEWPORT ${viewport}  DOCUMENT ${docWidth}  ` +
            (docWidth > viewport ? `SIDEWAYS SCROLL by ${docWidth - viewport}px` : 'no sideways scroll'));

        const panes = Array.from(document.querySelectorAll('.sl-bench__tab'))
            .map(el => (el.textContent || '').trim().replace(/\s+/g, ' '));
        lines.push('PANES ' + JSON.stringify(panes));
        const tools = Array.from(document.querySelectorAll('.sl-bench__tool'))
            .map(el => (el.textContent || '').trim());
        lines.push('TOOLS ' + JSON.stringify(tools));

        const frame = document.querySelector('iframe.sl-web__frame') as HTMLIFrameElement | null;
        if (frame) {
            const doc = frame.getAttribute('srcdoc') || '';
            lines.push(`FRAME box=${Math.round(frame.getBoundingClientRect().width)}x${Math.round(frame.getBoundingClientRect().height)}`
                + ` srcdoc=${doc.length} chars`);
            lines.push('FRAME_SRCDOC ' + JSON.stringify(doc.slice(0, 400)));
        } else {
            lines.push('FRAME absent');
        }

        const external = document.querySelector('.sl-external');
        if (external) lines.push('EXTERNAL_PANE ' + JSON.stringify((external.textContent || '').trim().replace(/\s+/g, ' ')));
        const studio = document.querySelector('.ns-studio');
        lines.push('NETSIM_STUDIO ' + (studio ? 'embedded' : 'absent'));

        const tasks = Array.from(document.querySelectorAll('.sl-task')).map(el => {
            const title = (el.querySelector('.sl-task__title')?.textContent || '').trim().replace(/\s+/g, ' ');
            const badge = (el.querySelector('.sl-badge')?.textContent || '').trim();
            return `${badge} :: ${title}`;
        });
        lines.push('TASKS\n  ' + tasks.join('\n  '));
        lines.push('GRADE ' + ((document.querySelector('.sl-tasks__count')?.textContent || '').trim()));

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
    });
}
