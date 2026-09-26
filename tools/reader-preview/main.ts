// Mounts the REAL read-aloud control, over real prose, with a fake speech
// engine. See vite.config.ts for why the engine is what is stubbed.
import { createApp, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import ReadAloud from '@/components/ReadAloud.vue';
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

/*
  A FAKE SPEECH ENGINE, installed before anything imports the composable.

  `useReader` reads `window.speechSynthesis` at module scope to prime its voice
  list, so this has to be in place first -- and `main.ts` is the only file that
  can guarantee that, because an import is hoisted above any statement.

  It reports NO voices, which is the honest common case (a stock Windows install
  has no Arabic voice and many Linux builds have no Chinese one) and is what
  makes `planSpeech` return the `platform` route. Each utterance then "speaks"
  for a time proportional to its length, so the bar's progress and its remaining
  estimate move the way they would in a browser rather than all at once.
*/
type Spoken = { text: string; onend?: (() => void) | null; onerror?: (() => void) | null };
const speaking: { current: Spoken | null; timer: number } = { current: null, timer: 0 };

class FakeUtterance {
    text: string;
    lang = '';
    pitch = 1;
    rate = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onboundary: (() => void) | null = null;
    constructor(text: string) { this.text = text; }
}

// A tenth of real time, so a 40-passage lesson is watchable. Long enough that
// the bar is genuinely in `playing` when a screenshot is taken, and short
// enough that the shooter does not have to wait out a real read.
const MS_PER_CHAR = 1.4;

/*
  `Object.defineProperty`, not an assignment.

  `window.speechSynthesis` is an ACCESSOR with only a getter, so
  `window.speechSynthesis = fake` throws `TypeError: Cannot set property
  speechSynthesis of #<Window> which has only a getter` -- at module scope,
  before the probe below is registered, so the page renders nothing and the
  shooter correctly reported NO PROBE at every width rather than photographing
  a blank page. `SpeechSynthesisUtterance` is an ordinary writable global and
  would take a plain assignment; both go through the same call so neither can
  be got wrong later.
*/
const define = (name: string, value: unknown) =>
    Object.defineProperty(window, name, { value, configurable: true, writable: true });

define('SpeechSynthesisUtterance', FakeUtterance);
define('speechSynthesis', {
    getVoices: () => [],
    addEventListener: () => { /* the list never changes here */ },
    speak(utterance: Spoken) {
        speaking.current = utterance;
        speaking.timer = window.setTimeout(() => {
            const done = speaking.current;
            speaking.current = null;
            done?.onend?.();
        }, Math.max(300, utterance.text.length * MS_PER_CHAR));
    },
    cancel() {
        window.clearTimeout(speaking.timer);
        speaking.current = null;
    },
    // The composable calls these nine seconds apart as the documented
    // workaround for Chrome cutting a long utterance off, so they have to exist
    // or every passage throws inside the keepalive.
    pause() { /* nothing to suspend in a timer */ },
    resume() { /* nothing to resume */ },
});

applyTheme(THEMES.find(t => t.id === params.get('theme')) ?? THEMES[0]);
setLocale((params.get('lang') || 'en') as LocaleId);

/*
  `onBeforeRouteLeave` inside the control needs a router in scope, so a memory
  history with one catch-all is not optional. Without it the component throws on
  mount and the preview is a blank page -- which `check:reader` cannot see and
  the shooter reports as NO PROBE.
*/
const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:all(.*)', component: { render: () => h('div') } }],
});

/* ------------------------------------------------------------------ *
 * The content. Real shapes, in all three scripts.
 * ------------------------------------------------------------------ */

const WRITE_UP = `## What a network actually is

A network is three things: a shared **medium** to carry the signal, an
**address** so each side knows who it is talking to, and an agreed **protocol**
so both sides interpret the signal the same way. Remove any one and there is no
network.

- The medium is copper, fibre or radio
- The address is a MAC address and an IP address
- The protocol is Ethernet, IP, TCP or HTTP

\`\`\`bash
ip addr show
ping -c 4 192.168.10.2
\`\`\`

| Layer | Address | Answers |
|---|---|---|
| Two | MAC | where the frame goes next |
| Three | IP | where the packet is ultimately going |

> The IP address says where the packet is going; the MAC address says where the
> frame is going next. Confusing them is the commonest source of confusion in
> networking.`;

const AR_WRITE_UP = `## ما هي الشبكة فعلاً

الشبكة ثلاثة أشياء: وسط مشترك ينقل الإشارة، وعنوان يعرف به كل طرف من يخاطب،
وبروتوكول متفق عليه يفسر به الطرفان الإشارة بالطريقة نفسها. إذا حذفت أيًّا منها
فلا توجد شبكة على الإطلاق.

- الوسط هو النحاس أو الألياف أو الراديو
- العنوان هو عنوان MAC وعنوان IP`;

const ZH_WRITE_UP = `## 网络到底是什么

网络由三件事构成：承载信号的共享介质、让双方知道对方是谁的地址，以及双方以相同方式
解释信号的约定协议。去掉其中任何一项，网络就不存在。

- 介质是铜缆、光纤或无线电
- 地址是 MAC 地址和 IP 地址`;

/** A long one, so the transport bar has a real denominator to show. */
const LONG = Array.from({ length: 9 }, (_, i) =>
    `### Section ${i + 1}\n\n${WRITE_UP.split('\n\n').slice(1, 3).join('\n\n')}`).join('\n\n');

/* ------------------------------------------------------------------ *
 * The host page
 * ------------------------------------------------------------------ */

const Host = {
    setup() {
        const started = ref(false);
        /*
          `?play=1` presses the button after mount, so the shooter photographs
          the bar rather than only the idle control.

          A real CLICK on the real element, not a call into the composable: the
          whole point of the handler is that it primes the audio context inside
          a gesture, and calling `read()` directly would photograph a state the
          browser never reaches.
        */
        if (params.has('play')) {
            setTimeout(() => {
                const button = document.querySelector<HTMLButtonElement>(
                    '[data-preview="long"] button');
                button?.click();
                started.value = true;
            }, 350);
        }

        return () => h('div', {
            class: 'main-content',
            style: 'max-width:60rem;margin:0 auto;padding:1.5rem 1rem 8rem;',
        }, [
            h('h1', { style: 'font-size:1.4rem;margin:0 0 1rem;' }, 'Read aloud'),

            section('A write-up, with a table and a fenced block', [
                h(ReadAloud, { id: 'preview-write-up', text: WRITE_UP, title: 'What a network actually is' }),
            ]),
            section('Compact, on a heading row', [
                h(ReadAloud, { id: 'preview-compact', text: WRITE_UP, title: 'Overview', compact: true }),
            ]),
            section('On an operator-coloured island (a runbook step)', [
                h('div', {
                    // The exact shape a runbook section is: a background and an
                    // ink an operator chose, arriving as inline styles. The
                    // control inside has to borrow that ink or it is invisible.
                    style: 'display:flex;align-items:center;gap:.75rem;padding:.8rem;'
                        + 'border-radius:12px;background:#fffbeb;color:#1f2937;',
                }, [
                    h('strong', { style: 'flex:1;min-width:0;' }, 'Step 3 — verify the tunnel'),
                    h(ReadAloud, {
                        id: 'preview-island',
                        parts: ['Verify the tunnel', 'Check that the tunnel came up and that traffic is using it.'],
                        title: 'Step 3', tone: 'inherit', compact: true,
                    }),
                ]),
            ]),
            section('Arabic prose', [
                h(ReadAloud, { id: 'preview-ar', text: AR_WRITE_UP, title: 'ما هي الشبكة' }),
            ]),
            section('Chinese prose', [
                h(ReadAloud, { id: 'preview-zh', text: ZH_WRITE_UP, title: '网络到底是什么' }),
            ]),
            section('Nothing to read (code only) — the control is disabled', [
                h(ReadAloud, { id: 'preview-empty', text: '```\nterraform apply\n```', title: 'Commands' }),
            ]),
            h('div', { 'data-preview': 'long' }, [
                section('A long document — nine sections, for the transport bar', [
                    h(ReadAloud, { id: 'preview-long', text: LONG, title: 'The whole lesson' }),
                ]),
            ]),
        ]);
    },
};

function section(label: string, children: unknown[]) {
    return h('section', { class: 'glass-effect', style: 'margin:0 0 1rem;padding:1rem;border-radius:14px;' }, [
        h('p', { style: 'margin:0 0 .6rem;font-size:.8rem;opacity:.75;' }, label),
        ...(children as never[]),
    ]);
}

const app = createApp({
    render: () => [h(AnimatedBackground), h(Host)],
});
app.use(i18n);
app.use(router);
router.replace('/lesson').then(() => router.isReady()).then(() => app.mount('#app'));

/*
  `?probe=1` — the overflow report, plus what the reader is actually doing.

  A screenshot cannot show a page-level sideways scrollbar: the capture is
  cropped, which reads as "the design is wide" rather than as a bug. And it
  cannot show that the bar is a bar rather than a stuck spinner, so the probe
  reports the reader's own state as well -- `shoot.mjs` FAILS on a `?play=1` run
  whose bar never appeared, because a picture of an idle page is the same
  picture whether the control is broken or the click missed.

  Every rect is INTERSECTED WITH ITS CLIPPING ANCESTORS before it is judged,
  exactly as `tools/rtl-audit` and `tools/tools-preview` do -- the first version
  of both reported the ambient background's oversized aurora at every width, and
  twelve false findings drown the one real one the next change introduces.
*/
if (params.has('probe')) {
    setTimeout(() => {
        const viewport = document.documentElement.clientWidth;
        const docWidth = document.documentElement.scrollWidth;
        const bar = document.querySelector('.sfs-read-bar');
        const counter = document.querySelector('.sfs-read-bar__count');
        const lines: string[] = [
            `VIEWPORT ${viewport}  DOCUMENT ${docWidth}  `
            + (docWidth > viewport ? `SIDEWAYS SCROLL by ${docWidth - viewport}px` : 'no sideways scroll'),
            `BAR ${bar ? 'present' : 'absent'}`
            + (counter ? `  COUNTER ${counter.textContent?.trim()}` : ''),
            `BUTTONS ${document.querySelectorAll('.sfs-read-btn').length}`,
            `DISABLED ${document.querySelectorAll('.sfs-read-btn[disabled]').length}`,
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
            if (visibleRight(el) > viewport + 1) {
                lines.push(`OVERFLOWS VIEWPORT  ${name}  right=${Math.round(box.right)}`);
            }
            if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible') {
                lines.push(`OVERFLOWS ITSELF    ${name}  scroll=${el.scrollWidth} client=${el.clientWidth}`);
            }
        }
        const out = document.createElement('pre');
        out.id = 'probe';
        out.style.display = 'none';
        out.textContent = lines.join('\n');
        document.body.appendChild(out);
    }, 1600);
}
