// Screenshot and measure NOOR'S WINDOW at real viewport sizes.
//
//   npm run shoot:assistant
//
// Her window is a fixed panel in a corner with a 3D canvas in it, and no other
// check on this platform can see it: `audit:rtl` drives eight public routes and
// has no way to PRESS the button, so the window is closed in every one of its
// screenshots, and `check:assistant` proves the model rather than the panel.
//
// It shoots six widths, three languages and both a dark galaxy and a light one,
// plus the mid-answer and listening states — and it MEASURES as well as shoots:
// the page reports every element off either edge, every element overflowing its
// own box, and how much clearance the panel leaves at the bottom of the
// viewport, which is where the support chat launcher lives on every real page.
//
// WHY THIS EXISTS RATHER THAN `chrome --screenshot`
//
// `--window-size=390,2600` does NOT give a 390px viewport. Headless Chrome has a
// minimum window width of around 500px, so it renders at ~490 and then crops the
// image to 390 — which looks exactly like a page overflowing its container, and
// cost a false bug report during the leaderboard's development.
//
// The only way to a real narrow viewport is `Emulation.setDeviceMetricsOverride`,
// which means the DevTools protocol. Node has `fetch` and `WebSocket` built in,
// so that needs no dependency — a check nobody can run without installing 200MB
// of Chromium is a check nobody runs.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveDist } from './serve.mjs';

const CHROME_CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const WIDTHS = [1920, 1440, 1024, 820, 390, 320];

/*
  Arabic is the variant that matters most and it is not a translation check.

  The panel is placed with `inset-inline-end`, so in Arabic it has to land on
  the LEFT — under the button that opened it, which the top bar has also moved.
  Get that wrong and the window opens on the far side of the screen from the
  control the reader just pressed. A light galaxy is here for the other half of
  the contrast rule (working rule 48), and Chinese because its labels are two
  characters where English is eight and a flex row can collapse differently.
*/
const VARIANTS = [
    { id: 'andromeda-en', query: 'theme=andromeda&lang=en&state=busy' },
    { id: 'cartwheel-en', query: 'theme=cartwheel&lang=en&state=busy' },
    { id: 'andromeda-ar', query: 'theme=andromeda&lang=ar&state=busy' },
    { id: 'andromeda-zh', query: 'theme=andromeda&lang=zh&state=busy' },
    { id: 'long-en', query: 'theme=andromeda&lang=en&state=long' },
    { id: 'live-en', query: 'theme=andromeda&lang=en&state=live' },
    { id: 'signedout-ar', query: 'theme=dawn&lang=ar&signedout=1' },
    /*
      THE OTHER ASSISTANT.

      They alternate, so half of all sessions get Omar — and he is not a recolour
      of Noor: a different build, a different skin tone, a different hair style
      and the one of the two whose voice has to be RESHAPED, because app 36's
      fallback provider is female in all three languages. Shipping a figure
      nobody has looked at is how Noor's own tile came to render a blank band.
    */
    { id: 'omar-en', query: 'theme=andromeda&lang=en&bot=omar&state=busy' },
    { id: 'omar-ar', query: 'theme=andromeda&lang=ar&bot=omar&state=busy' },
];

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:8794/index.html';

/*
  THIS SCRIPT SERVES THE BUILD ITSELF.

  The leaderboard's shooter defaulted to a port and started nothing, so running
  it without a server already up printed NO PROBE for every width - the exact
  string it prints when the page fails to MOUNT. Those two need opposite
  reactions and were indistinguishable.

  `serveDist` answers null when the port is already taken, which is not an
  error: something is already serving and joining it beats fighting over the
  socket. `PREVIEW_URL` still wins, so a dev server can be shot instead.
*/
const served = process.env.PREVIEW_URL
    ? null
    : await serveDist('tools/assistant-preview/dist', 8794);
const outDir = resolve(process.argv[2] || 'tools/assistant-preview/shots');

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const port = 9337;
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
    /* Every variant at the two widths a reader is most likely to be on, plus
       Arabic everywhere: the palette does not change the layout, and the
       DIRECTION does — a panel pinned to the wrong corner is wrong at every
       width and right at none. */
    const variants = width === 1440 || width === 390
        ? VARIANTS
        : [VARIANTS[0], VARIANTS[2]];
    for (const variant of variants) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width, height: 900, deviceScaleFactor: 1, mobile: width <= 480,
        });
        await cdp.send('Page.navigate', { url: `${BASE}?${variant.query}&probe=1` });
        await sleep(3200);

        const { result } = await cdp.send('Runtime.evaluate', {
            expression: 'document.getElementById("probe")?.textContent || "NO PROBE"',
            returnByValue: true,
        });
        const lines = String(result.value).split('\n');
        if (lines[0] === 'NO PROBE') {
            failures++;
            report.push(`\n${width}px ${variant.id}: the page never reported — it probably threw`);
        }
        const bad = lines.filter(l =>
            /SIDEWAYS SCROLL|OVERFLOWS|OFF THE LEFT EDGE|WINDOW MISSING|TOO CLOSE|ABOVE THE VIEWPORT|NOT CLICKABLE/
                .test(l));
        if (bad.length) {
            failures += bad.length;
            report.push(`\n${width}px ${variant.id}:`);
            for (const line of [...new Set(bad)].slice(0, 12)) report.push('  ' + line);
        }

        const shot = await cdp.send('Page.captureScreenshot', {
            format: 'png', captureBeyondViewport: true,
        });
        writeFileSync(join(outDir, `${width}-${variant.id}.png`), Buffer.from(shot.data, 'base64'));
        console.log(`  shot  ${String(width).padStart(4)}px  ${variant.id.padEnd(14)}`
            + (bad.length ? `  ${bad.length} layout problem(s)` : '  clean'));
    }
}

/*
  AND ONE REAL CLICK ON THE X.

  The hit test above is per width and per language and catches a covered
  control; this catches the other half — a control that IS on top and still
  does nothing, because the handler never fires or the thing it sets is not
  what the layout renders against.

  Both halves were live at once. `PersonStage`'s grid covered the button, AND
  this harness mounted the window off a local flag rather than off the shared
  `open` ref, so it could not observe a close at all — which meant the first
  fix looked like it had not worked.

  A REAL click through `Input.dispatchMouseEvent`, never `element.click()`: the
  synthetic one dispatches straight at the node and passes happily while a
  transparent grid is covering the page.
*/
await cdp.send('Emulation.setDeviceMetricsOverride',
               { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp.send('Page.navigate', { url: `${BASE}?theme=andromeda&lang=en` });
await sleep(3200);

const at = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
        const b = document.querySelector('.sfs-bot__close');
        if (!b) return '';
        const r = b.getBoundingClientRect();
        return JSON.stringify([Math.round(r.left + r.width / 2),
                               Math.round(r.top + r.height / 2)]);
    })()`,
    returnByValue: true,
});

if (!at.result.value) {
    failures++;
    report.push('\nclose: the window never rendered, so the X could not be tried');
} else {
    const [cx, cy] = JSON.parse(at.result.value);
    for (const type of ['mousePressed', 'mouseReleased']) {
        await cdp.send('Input.dispatchMouseEvent',
                       { type, x: cx, y: cy, button: 'left', clickCount: 1 });
    }
    await sleep(700);
    const gone = await cdp.send('Runtime.evaluate', {
        expression: '!document.querySelector(".sfs-bot")', returnByValue: true,
    });
    if (gone.result.value !== true) {
        failures++;
        report.push('\nclose: a real click on the X did NOT close the window');
    }
    console.log(`  click ${gone.result.value === true
        ? ' the X closes the window' : ' THE X DOES NOT CLOSE THE WINDOW'}`);
}

cdp.close();
chrome.kill();
/*
  A listening socket keeps node's event loop alive, so without this the script
  prints its whole report and then hangs for ever - which reads as a shoot that
  never finished rather than as one that finished and would not leave.
*/
if (served) await served.close();

if (report.length) {
    console.log('\nLayout problems:' + report.join('\n'));
    console.log(`\n${failures} problem(s). Screenshots in ${outDir}\n`);
    process.exit(1);
}
console.log(`\nNo overflow at any width, in any galaxy or language. Screenshots in ${outDir}\n`);
process.exit(0);
