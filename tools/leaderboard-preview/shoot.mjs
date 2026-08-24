// Screenshot and measure the leaderboard preview at real viewport sizes.
//
//   node tools/leaderboard-preview/shoot.mjs [outDir]
//
// WHY THIS EXISTS RATHER THAN `chrome --screenshot`
//
// `--window-size=390,2600` does NOT give a 390px viewport. Headless Chrome has a
// minimum window width of around 500px, so it renders at ~490 and then crops the
// image to 390 — which looks exactly like a page overflowing its container. That
// cost a false bug report during this page's own development: every card
// appeared cut off on the right at "390px", and the layout was fine.
//
// The only way to a real narrow viewport is `Emulation.setDeviceMetricsOverride`,
// which means the DevTools protocol. Node has `fetch` and `WebSocket` built in,
// so that needs no dependency — which matters, because a check nobody can run
// without installing 200MB of Chromium is a check nobody runs.
//
// It measures as well as shoots: the page reports every element wider than the
// viewport and every element overflowing its own box, so a sideways scrollbar
// is named rather than left to be spotted in a picture.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHROME_CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/** Every galaxy the charts have to be legible in, and the widths that matter. */
const THEMES = ['andromeda', 'orion', 'sombrero', 'whirlpool', 'pinwheel',
    'triangulum', 'sunflower', 'cartwheel', 'dawn', 'silver'];
const WIDTHS = [1920, 1440, 1024, 820, 390, 320];

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:8791/index.html';
const outDir = resolve(process.argv[2] || 'tools/leaderboard-preview/shots');

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const port = 9333;
const chrome = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=' + join(outDir, '.profile'),
    'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function target() {
    for (let attempt = 0; attempt < 60; attempt++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            const page = list.find(t => t.type === 'page');
            if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
        } catch { /* not up yet */ }
        await sleep(250);
    }
    throw new Error('Chrome never opened its debugging port');
}

/** A minimal CDP client. One socket, one id counter, promises per id. */
function connect(url) {
    const socket = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    const ready = new Promise((ok, fail) => {
        socket.addEventListener('open', () => ok());
        socket.addEventListener('error', fail);
    });
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        const waiting = pending.get(message.id);
        if (!waiting) return;
        pending.delete(message.id);
        message.error ? waiting.fail(new Error(message.error.message)) : waiting.ok(message.result);
    });
    return {
        ready,
        send(method, params = {}) {
            const mine = ++id;
            socket.send(JSON.stringify({ id: mine, method, params }));
            return new Promise((ok, fail) => pending.set(mine, { ok, fail }));
        },
        close: () => socket.close(),
    };
}

const cdp = connect(await target());
await cdp.ready;
await cdp.send('Page.enable');

/*
  Screenshots are taken with reduced motion, and this is not a preference.

  Chart.js animates a bar's height and a line's points in from the origin, so a
  capture taken while that is running shows every series squeezed against the
  left-hand axis with the ticks already spread across the full width. It looks
  exactly like a chart drawing its data in the wrong coordinate space, and it
  cost a wrong diagnosis during this page's own development — the "bug" was the
  camera, twice over (the other half was `--window-size` cropping rather than
  resizing; see the header).

  The component already honours `prefers-reduced-motion`, so emulating it here
  makes every shot the settled frame. It also means two runs of this script
  produce identical images, which is what lets one be diffed against another.
*/
await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

let failures = 0;
const report = [];

for (const width of WIDTHS) {
    // One galaxy per width is enough for geometry — the layout does not depend on
    // the palette — but every galaxy is shot at the two widths a reader is most
    // likely to be on, because that is where the CHARTS have to be legible.
    const themes = width === 1440 || width === 390 ? THEMES : ['andromeda'];
    for (const theme of themes) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width, height: 900, deviceScaleFactor: 1,
            mobile: width <= 480,
        });
        await cdp.send('Page.navigate', { url: `${BASE}?theme=${theme}&probe=1` });
        await sleep(2200);

        const { result } = await cdp.send('Runtime.evaluate', {
            expression: 'document.getElementById("probe")?.textContent || "NO PROBE"',
            returnByValue: true,
        });
        const lines = String(result.value).split('\n');
        const bad = lines.filter(l => /SIDEWAYS SCROLL|OVERFLOWS/.test(l));
        if (bad.length) {
            failures += bad.length;
            report.push(`\n${width}px ${theme}:`);
            for (const line of [...new Set(bad)].slice(0, 12)) report.push('  ' + line);
        }

        const shot = await cdp.send('Page.captureScreenshot', {
            format: 'png', captureBeyondViewport: true,
        });
        writeFileSync(join(outDir, `${width}-${theme}.png`), Buffer.from(shot.data, 'base64'));
        console.log(`  shot  ${String(width).padStart(4)}px  ${theme.padEnd(11)}`
            + (bad.length ? `  ${bad.length} layout problem(s)` : '  clean'));
    }
}

cdp.close();
chrome.kill();

if (report.length) {
    console.log('\nLayout problems:' + report.join('\n'));
    console.log(`\n${failures} problem(s). Screenshots in ${outDir}\n`);
    process.exit(1);
}
console.log(`\nNo overflow at any width, in any galaxy. Screenshots in ${outDir}\n`);
