// Photographs the guided tour on real pages, in a real browser.
//
//   npx vite preview --port 4173
//   node tools/tour-check/shoot.mjs                # English, Andromeda
//   node tools/tour-check/shoot.mjs --ar           # Arabic, right to left
//   TOUR_THEME=cartwheel node tools/tour-check/shoot.mjs
//
// WHY THIS EXISTS ALONGSIDE `npm run check:tour`
//
// That check drives `tourSteps.ts` in node, which is where every DECISION
// lives - which steps a path has, which of them resolve, where the caption goes
// and where the line runs. What it cannot see is whether any of it is DRAWN:
// a caption behind the sidebar, a box round nothing, a line pointing off the
// screen, an overlay that never mounted. Working rule 42 - put a camera on the
// drawing - and every fault this found on its first run was of exactly that
// kind.
//
// IT ASSERTS, IT DOES NOT ONLY PHOTOGRAPH.
//
// A screenshot harness that passes on a blank page is worse than none (the
// leaderboard's preview printed `clean` for a week while the page rendered
// nothing at all). So each shot is taken only after the overlay has been
// confirmed present, and the geometry is read back out of the DOM and checked:
// the caption is on the screen, the box is on the screen, and the two do not
// sit on top of each other.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHROME_CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
];

const locale = process.argv.includes('--ar') ? 'ar'
    : process.argv.includes('--zh') ? 'zh' : 'en';
const theme = process.env.TOUR_THEME || '';
const BASE = process.env.TOUR_URL || 'http://127.0.0.1:4173';
const outDir = resolve(`tools/tour-check/shots-${locale}${theme ? '-' + theme : ''}`);

/*
  PUBLIC ROUTES ONLY, and the same eight `audit:rtl` uses.

  Everything else needs a session, and seeding one would be testing a login
  shim. It is not as narrow as it sounds: between them these carry the sidebar,
  the search, the top bar, both pickers and the tour's whole platform tail, plus
  four chapters of its own.
*/
const ROUTES = [
    ['leaderboard', '/leaderboard'],
    ['courses', '/courses'],
    ['exams', '/exams'],
    ['plans', '/plans'],
    ['login', '/login'],
];

/** How many steps to photograph per route. The first three carry the chapter. */
const STEPS = 3;
/** The widths that matter: a laptop, a tablet and the narrowest phone. */
const WIDTHS = [1440, 820, 390];

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const port = 9413;
const chrome = spawn(browser, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=' + join(outDir, '.profile'),
    'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function target() {
    for (let attempt = 0; attempt < 80; attempt++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            const page = list.find(t => t.type === 'page');
            if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
        } catch { /* not up yet */ }
        await sleep(250);
    }
    throw new Error('Chrome never opened its debugging port');
}

function connect(url) {
    const socket = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    const ready = new Promise((ok, fail) => {
        socket.addEventListener('open', () => ok());
        socket.addEventListener('error', fail);
    });
    const client = {};
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.method) { client.onEvent?.(message.method, message.params); return; }
        const waiting = pending.get(message.id);
        if (!waiting) return;
        pending.delete(message.id);
        message.error ? waiting.fail(new Error(message.error.message)) : waiting.ok(message.result);
    });
    return Object.assign(client, {
        ready,
        send(method, params = {}) {
            const mine = ++id;
            socket.send(JSON.stringify({ id: mine, method, params }));
            return new Promise((ok, fail) => pending.set(mine, { ok, fail }));
        },
        close: () => socket.close(),
    });
}

const cdp = connect(await target());
await cdp.ready;
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');

let thrown = [];
cdp.onEvent = (method, params) => {
    if (method === 'Runtime.exceptionThrown') {
        thrown.push('THREW: ' + (params.exceptionDetails.exception?.description
            || params.exceptionDetails.text));
    }
};

// Settled frames, so two runs produce the same pictures - and so the box does
// not photograph mid-transition on its way to the next target.
await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try {
        localStorage.setItem('sfs-locale', '${locale}');
        ${theme ? `localStorage.setItem('sfs-theme', '${theme}');` : ''}
    } catch (e) {}`,
});

const evaluate = async expression => {
    const answer = await cdp.send('Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true });
    if (answer.exceptionDetails) {
        return { error: answer.exceptionDetails.exception?.description
            || answer.exceptionDetails.text };
    }
    return answer.result.value;
};

let failures = 0;
const say = (ok, label, detail) => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined
        ? '' : '  ' + JSON.stringify(detail)}`);
};

for (const width of WIDTHS) {
    console.log(`\n${width}px, ${locale}${theme ? ' / ' + theme : ''}`);
    for (const [label, path] of ROUTES) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width, height: 860, deviceScaleFactor: 1, mobile: width <= 480,
        });
        thrown = [];
        await cdp.send('Page.navigate', { url: `${BASE}/#${path}` });
        await sleep(1600);

        // THE BUTTON IS THE FIRST THING ASSERTED. Without it there is no tour
        // at all, and a harness that went on to report "no overlay" would be
        // describing the symptom rather than the cause.
        const started = await evaluate(`(() => {
            const btn = document.querySelector('.sfs-tour-btn');
            if (!btn) return 'no button';
            btn.click();
            return 'ok';
        })()`);
        say(started === 'ok', `${label}: the Tour button is on the page`, started);
        if (started !== 'ok') continue;

        for (let step = 0; step < STEPS; step++) {
            await sleep(650);
            const state = await evaluate(`(() => {
                const root = document.querySelector('.sfs-tour');
                if (!root) return { mounted: false };
                const card = root.querySelector('.sfs-tour__card');
                const box = root.querySelector('.sfs-tour__box');
                const rect = n => { const r = n.getBoundingClientRect();
                    return { x: r.left, y: r.top, w: r.width, h: r.height }; };
                return {
                    mounted: true,
                    title: root.querySelector('.sfs-tour__title')?.textContent?.trim() || '',
                    count: root.querySelector('.sfs-tour__count')?.textContent?.trim() || '',
                    card: card ? rect(card) : null,
                    box: box ? rect(box) : null,
                    line: !!root.querySelector('.sfs-tour__line'),
                    view: { w: innerWidth, h: innerHeight },
                };
            })()`);

            if (!state || state.error || !state.mounted) {
                say(false, `${label} step ${step + 1}: the overlay is on screen`, state);
                break;
            }
            const c = state.card;
            const onScreen = c && c.x >= -1 && c.y >= -1
                && c.x + c.w <= state.view.w + 1 && c.y + c.h <= state.view.h + 1;
            say(!!onScreen, `${label} step ${step + 1}: the caption is inside the viewport`,
                { card: c, view: state.view });
            say(!!state.title, `${label} step ${step + 1}: it says something`, state.count);

            if (state.box) {
                const b = state.box;
                const boxOn = b.x + b.w > 0 && b.y + b.h > 0
                    && b.x < state.view.w && b.y < state.view.h;
                say(boxOn, `${label} step ${step + 1}: the box is on the screen`, b);
                // At 390px the caption legitimately covers part of a large
                // target - there is nowhere else for it - so the overlap rule
                // is only asserted where there was room.
                if (width >= 1024) {
                    const over = c.x < b.x + b.w && b.x < c.x + c.w
                        && c.y < b.y + b.h && b.y < c.y + c.h;
                    say(!over, `${label} step ${step + 1}: and the caption is not on top of it`,
                        { card: c, box: b });
                }
            }

            const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(outDir, `${width}-${label}-${step + 1}.png`),
                Buffer.from(shot.data, 'base64'));

            await evaluate(`document.querySelector('.sfs-tour__btn1')?.click()`);
        }

        // Escape has to work from anywhere, or the tour is a trap.
        await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
        await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        await sleep(300);
        const gone = await evaluate(`!document.querySelector('.sfs-tour')`);
        say(gone === true, `${label}: Escape stops the tour`, gone);

        if (thrown.length) say(false, `${label}: nothing threw`, thrown.slice(0, 2));
    }
}

cdp.close();
chrome.kill();
console.log(failures ? `\n${failures} failed` : `\nAll clean. Shots in ${outDir}`);
process.exit(failures ? 1 : 0);
