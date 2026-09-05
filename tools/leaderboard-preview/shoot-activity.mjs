// Open the activity record and photograph it, at real viewport sizes.
//
//   node tools/_serve.mjs tools/leaderboard-preview/dist 8791 &
//   node tools/leaderboard-preview/shoot-activity.mjs
//
// WHY A SECOND SHOOTER RATHER THAN A FLAG ON THE FIRST
//
// `shoot.mjs` measures the BOARD, and the board is what it walks: one probe
// call per width per galaxy, over a tree with no dialog in it. The record is a
// `position: fixed` sheet that has to be OPENED, its five tabs each have to be
// clicked to be measured, and its own overflow question is a different one —
// the sheet scrolls itself, so "wider than the viewport" is the only failure
// that matters and "taller" is by design. Folding both into one script would
// make the board's report conditional on a dialog's state, which is exactly
// the shape that makes a harness report `clean` for the wrong reason.
//
// The board's own lessons are inherited rather than re-derived:
//
//  * `--window-size=390,x` does NOT give a 390px viewport. Headless Chrome has
//    a ~500px minimum and then CROPS the image, which reads unmistakably as a
//    page overflowing its container. Only `Emulation.setDeviceMetricsOverride`
//    gives a real narrow viewport.
//  * A screenshot taken during a chart's entry animation is not a picture of
//    the chart. `prefers-reduced-motion` is emulated so every shot is the
//    settled frame and two runs produce identical images.
//  * An element inside a horizontal scroller is not judged against the
//    viewport — see the note in `main.ts`.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveDist } from './serve.mjs';

const CHROME_CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

/** The tabs, and one is not like the others: `charts` draws into a canvas. */
const TABS = ['ledger', 'conduct', 'results', 'work', 'charts'];
const WIDTHS = [1440, 820, 390, 320];
const THEMES = ['andromeda', 'cartwheel'];

const BASE = process.env.PREVIEW_URL
    || 'http://127.0.0.1:8791/index.html';

/*
  THIS SCRIPT SERVES THE BUILD ITSELF.

  It used to default to port 8791 and start nothing, so running it without a
  server already up printed **NO PROBE for every width in every galaxy** - which
  is the exact string it prints when the page fails to MOUNT. Those two need
  opposite reactions and were indistinguishable, which is the same class of
  wrongness as `EMPTY PAGE` once counting as clean.

  `serveDist` answers null when the port is already taken, which is not an
  error: something is already serving and joining it is better than fighting
  over the socket. `PREVIEW_URL` still wins, so a dev server can be shot
  instead.
*/
const served = process.env.PREVIEW_URL
    ? null
    : await serveDist('tools/leaderboard-preview/dist', 8791);
const outDir = resolve(process.argv[2] || 'tools/leaderboard-preview/shots-activity');

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found.');
    process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const port = 9334;
const chrome = spawn(browser, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    `--user-data-dir=${join(outDir, '.profile')}`,
    'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function pageSocket() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            const page = list.find(t => t.type === 'page');
            if (page) return page.webSocketDebuggerUrl;
        } catch { /* not up yet */ }
        await sleep(250);
    }
    throw new Error('devtools never came up');
}

const url = await pageSocket();
const socket = new WebSocket(url);
await new Promise((resolve_, reject) => {
    socket.onopen = resolve_;
    socket.onerror = reject;
});

let nextId = 0;
const pending = new Map();
socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
    }
};
function send(method, params = {}) {
    nextId += 1;
    const id = nextId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise(resolve_ => pending.set(id, resolve_));
}
async function evaluate(expression) {
    const answer = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (answer.error) throw new Error(answer.error.message);
    const details = answer.result?.exceptionDetails;
    if (details) throw new Error(details.exception?.description || details.text);
    return answer.result?.result?.value;
}

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

/**
 * Open the record for the learner whose row carries the voided sitting.
 *
 * By SEARCHING the rendered rows rather than clicking the first one: the
 * fixture's ordering is by points and a change to the sample data would
 * silently start photographing a learner with a clean record - which is the
 * least interesting state and the one that would hide a regression in the
 * banner, the conduct meters and the negative tile all at once.
 */
const OPEN = `(() => {
    const rows = Array.from(document.querySelectorAll('.lb-table tbody tr'));
    const wanted = rows.find(row => /−/.test(row.textContent || '')) || rows[0];
    if (!wanted) return 'NO ROWS';
    const button = wanted.querySelector('.lb-actBtn');
    if (!button) return 'NO BUTTON';
    button.click();
    return 'clicked';
})()`;

const MEASURE = `(() => {
    const viewport = document.documentElement.clientWidth;
    const panel = document.querySelector('.lb-sheet__panel');
    if (!panel) return 'NO SHEET';
    const lines = [];
    const inScroller = el => {
        for (let node = el.parentElement; node; node = node.parentElement) {
            const overflow = getComputedStyle(node).overflowX;
            if (overflow === 'auto' || overflow === 'scroll') return true;
        }
        return false;
    };
    for (const el of Array.from(document.querySelectorAll('.lb-sheet *'))) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        const name = el.tagName.toLowerCase() + '.'
            + ((el.className || '').toString().split(/\\s+/)[0] || '-');
        if (box.right > viewport + 1) {
            lines.push('OVERFLOWS VIEWPORT  ' + name + '  right=' + Math.round(box.right));
        }
        const parent = el.parentElement;
        if (!parent || inScroller(el)) continue;
        const outer = parent.getBoundingClientRect();
        if (outer.width > 0 && box.right > outer.right + 1
            && getComputedStyle(parent).overflowX === 'visible') {
            lines.push('OVERFLOWS PARENT    ' + name + '  by '
                + Math.round(box.right - outer.right) + 'px');
        }
    }
    const text = (panel.textContent || '').trim();
    if (text.length < 200) {
        lines.push('EMPTY SHEET         only ' + text.length + ' characters');
    }
    return lines.length ? lines.join('\\n') : 'clean';
})()`;

let failures = 0;
const report = [];

for (const width of WIDTHS) {
    const themes = width === 1440 ? THEMES : [THEMES[0]];
    for (const theme of themes) {
        await send('Emulation.setDeviceMetricsOverride', {
            width, height: 900, deviceScaleFactor: 1, mobile: width <= 480,
        });
        await send('Page.navigate', { url: `${BASE}?theme=${theme}` });
        await sleep(2000);

        const opened = await evaluate(OPEN);
        if (opened !== 'clicked') {
            failures += 1;
            report.push(`\n${width}px ${theme}: could not open the record (${opened})`);
            continue;
        }
        // The panel is an async chunk, so the first open is a network round
        // trip to the loader. Waiting on the ELEMENT rather than on a timer,
        // because a sleep long enough to be safe makes the run unusable and a
        // short one reports "no sheet" on a page that was merely loading.
        let ready = false;
        for (let attempt = 0; attempt < 40 && !ready; attempt += 1) {
            ready = await evaluate(
                `!!document.querySelector('.lb-sheet__tabs .lb-sheet__tab')`);
            if (!ready) await sleep(150);
        }
        if (!ready) {
            failures += 1;
            report.push(`\n${width}px ${theme}: the record never mounted`);
            continue;
        }

        for (const [index, tab] of TABS.entries()) {
            await evaluate(
                `document.querySelectorAll('.lb-sheet__tab')[${index}]?.click()`);
            await sleep(500);
            const measured = await evaluate(MEASURE);
            const bad = String(measured).split('\n')
                .filter(line => /OVERFLOWS|EMPTY SHEET|NO SHEET/.test(line));
            if (bad.length) {
                failures += bad.length;
                report.push(`\n${width}px ${theme} · ${tab}:`);
                for (const line of [...new Set(bad)].slice(0, 8)) report.push('  ' + line);
            }
            // `send` answers the WHOLE CDP message, so the payload is one
            // level down. Reading `shot.data` gave `undefined` and Buffer.from
            // threw - loudly, which is the good version of getting this wrong.
            const shot = await send('Page.captureScreenshot', {
                format: 'png', captureBeyondViewport: true,
            });
            writeFileSync(join(outDir, `${width}-${theme}-${tab}.png`),
                          Buffer.from(shot.result.data, 'base64'));
            console.log(`  shot  ${String(width).padStart(4)}px  ${theme.padEnd(10)} `
                + `${tab.padEnd(8)} ${bad.length ? `${bad.length} problem(s)` : 'clean'}`);
        }
    }
}

if (report.length) console.log('\nLayout problems:' + report.join('\n'));
console.log(failures
    ? `\n${failures} problem(s). Screenshots in ${outDir}`
    : `\nThe record is clean at every width, in every tab. Screenshots in ${outDir}`);

socket.close();
chrome.kill();
if (served) await served.close();
process.exit(failures ? 1 : 0);
