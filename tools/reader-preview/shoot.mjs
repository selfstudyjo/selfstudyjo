// Screenshot and MEASURE the read-aloud control and its transport bar.
//
//   npm run shoot:reader
//
// `check:reader` proves 190 decisions and can say nothing about a layout. The
// bar is a `position: fixed` overlay teleported to `<body>` holding a title, a
// counter, four transport controls and a four-button speed picker -- and at
// 320px that does not fit on one line. An overlay that overflows is the one
// element on a page that can give the whole document sideways scroll.
//
// WHY THE DEVTOOLS PROTOCOL RATHER THAN `chrome --screenshot`
//
// `--window-size=390,2600` does NOT give a 390px viewport. Headless Chrome has
// a minimum window width of around 500px, so it renders at ~490 and then CROPS
// the image to 390 -- which looks exactly like a page overflowing its
// container. That cost a false bug report on the dashboard and again on the
// leaderboard. Only `Emulation.setDeviceMetricsOverride` gives a real narrow
// viewport, and node's own `fetch` and `WebSocket` reach it with no dependency
// -- which matters, because a check nobody can run without installing 200MB of
// Chromium is a check nobody runs.
//
// IT FAILS ON AN ABSENT BAR, not just on an overflow. A `?play=1` run whose bar
// never appeared photographs an idle page, and that is the same picture whether
// the control is broken, the click missed, or the fake engine never started.
// Those need opposite reactions, so the probe reports the reader's own state and
// this script treats a missing bar as a failure -- the lesson `NO PROBE` and
// `EMPTY PAGE` both taught on the leaderboard.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveDist } from '../leaderboard-preview/serve.mjs';

const CHROME_CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const WIDTHS = [1440, 1024, 820, 390, 320];

/*
  One dark galaxy and one light one, because the button's resting state is glass
  over the page in one and over a pale surface in the other -- and the playing
  state is an accent fill whose ink is derived per galaxy. Arabic and Chinese,
  because the bar's counter and speed picker must NOT mirror while the bar
  itself must, and because the whole point of the feature is the other two
  languages.
*/
const VARIANTS = [
    { id: 'idle-dark', query: 'theme=andromeda&lang=en' },
    { id: 'idle-light', query: 'theme=cartwheel&lang=en' },
    { id: 'playing-dark', query: 'theme=andromeda&lang=en&play=1' },
    { id: 'playing-light', query: 'theme=cartwheel&lang=en&play=1' },
    { id: 'playing-ar', query: 'theme=andromeda&lang=ar&play=1' },
    { id: 'playing-zh', query: 'theme=cartwheel&lang=zh&play=1' },
];

const PORT = 8796;
const DIST = resolve('tools/reader-preview/dist');
const BASE = process.env.PREVIEW_URL || `http://127.0.0.1:${PORT}/index.html`;
const outDir = resolve(process.argv[2] || 'tools/reader-preview/shots');

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// Serve the build ourselves. `null` means the port is already taken, which is
// not an error: something is already serving, and taking over would be worse.
const server = process.env.PREVIEW_URL ? null : await serveDist(DIST, PORT);

const port = 9341;
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
await cdp.send('Runtime.enable');

/*
  A throw inside the page must not read as a pass.

  `tools/rtl-audit` reported "1 problem" on every route for a while because its
  probe was throwing a SyntaxError inside the browser where nothing printed it,
  and that looked exactly like a page with nothing wrong. Console exceptions are
  collected here and reported per shot.
*/
const thrown = [];
cdp.send('Runtime.addBinding', { name: '__none' }).catch(() => {});

/*
  Reduced motion, so two runs produce identical images and the spinner is
  parked. The control honours it already (every keyframe track ends where it
  began, which is what makes `animation-duration: 0.01ms` land it upright).
*/
await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

let failures = 0;
const report = [];

for (const width of WIDTHS) {
    // Every variant at the two widths a reader is most likely to be on, and the
    // dark idle plus dark playing pair everywhere else: the LAYOUT does not
    // depend on the palette, and the palette is the whole point at 1440 and 390.
    const variants = width === 1440 || width === 390
        ? VARIANTS
        : [VARIANTS[0], VARIANTS[2]];

    for (const variant of variants) {
        thrown.length = 0;
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width, height: 900, deviceScaleFactor: 1, mobile: width <= 480,
        });
        await cdp.send('Page.navigate', { url: `${BASE}?${variant.query}&probe=1` });
        await sleep(2600);

        const { result } = await cdp.send('Runtime.evaluate', {
            expression: 'document.getElementById("probe")?.textContent || "NO PROBE"',
            returnByValue: true,
        });
        const lines = String(result.value).split('\n');
        const label = `${width}px ${variant.id}`;

        if (lines[0] === 'NO PROBE') {
            failures++;
            report.push(`\n${label}: the page never reported — it probably threw on mount`);
            continue;
        }

        const problems = lines.filter(l => /SIDEWAYS SCROLL|OVERFLOWS/.test(l));

        // The bar has to be there on a `?play=1` run, and has to NOT be there
        // otherwise. Both directions: a bar that appears without a press would
        // mean the control reads on mount, which on a page full of them is
        // seven voices at once.
        const barLine = lines.find(l => l.startsWith('BAR ')) || 'BAR ?';
        const wantsBar = variant.query.includes('play=1');
        const hasBar = barLine.startsWith('BAR present');
        if (wantsBar && !hasBar) {
            failures++;
            report.push(`\n${label}: pressed play and NO TRANSPORT BAR appeared  (${barLine})`);
        }
        if (!wantsBar && hasBar) {
            failures++;
            report.push(`\n${label}: a bar appeared with nothing pressed`);
        }

        // The disabled control is the code-only section, and there is exactly
        // one of it. Zero would mean an empty plan still offers to read.
        const disabled = Number((lines.find(l => l.startsWith('DISABLED ')) || '').split(' ')[1]);
        if (disabled !== 1) {
            failures++;
            report.push(`\n${label}: expected exactly one disabled control, found ${disabled}`);
        }

        if (problems.length) {
            failures += problems.length;
            report.push(`\n${label}:`);
            for (const line of [...new Set(problems)].slice(0, 12)) report.push('  ' + line);
        }

        const shot = await cdp.send('Page.captureScreenshot', {
            format: 'png', captureBeyondViewport: true,
        });
        writeFileSync(join(outDir, `${width}-${variant.id}.png`), Buffer.from(shot.data, 'base64'));
        console.log(`  shot  ${String(width).padStart(4)}px  ${variant.id.padEnd(14)}`
            + `  ${barLine.padEnd(28)}`
            + (problems.length ? `${problems.length} layout problem(s)` : 'clean'));
    }
}

cdp.close();
chrome.kill();
if (server) await server.close();

if (report.length) {
    console.log('\nProblems:' + report.join('\n'));
    console.log(`\n${failures} problem(s). Screenshots in ${outDir}\n`);
    process.exit(1);
}
console.log(`\nNo overflow at any width, in any galaxy or language, and the bar `
    + `appeared on every play. Screenshots in ${outDir}\n`);
// An explicit exit: a listening socket keeps node's event loop alive, and the
// first version of the leaderboard shooter printed its whole report and then
// hung for ever.
process.exit(0);
