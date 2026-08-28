// Screenshot and measure the Self Study TV preview at real viewport sizes.
//
//   npm run build:iptv-preview
//   npx vite preview --outDir tools/iptv-preview/dist --port 8792 --strictPort
//   node tools/iptv-preview/shoot.mjs
//
// WHY THIS EXISTS RATHER THAN `chrome --screenshot`
//
// `--window-size=390,2600` does NOT give a 390px viewport. Headless Chrome has a
// minimum window width of around 500px, so it renders at ~490 and then crops the
// image to 390 - which looks exactly like a page overflowing its container. That
// cost a false bug report on the leaderboard: every card appeared cut off on the
// right at "390px", and the layout was fine.
//
// The only way to a real narrow viewport is `Emulation.setDeviceMetricsOverride`,
// which means the DevTools protocol. Node has `fetch` and `WebSocket` built in,
// so that needs no dependency - which matters, because a check nobody can run
// without installing 200MB of Chromium is a check nobody runs.
//
// WHAT IT COVERS THAT `check:iptv` CANNOT
//
// Everything the reported bug was about. `check:iptv` proves the running order,
// the rails, the resume states and which tab a path belongs to; it cannot see a
// tile whose title runs into its neighbour, a bar that wraps onto three rows, a
// theatre column that will not shrink, or a channel list that pushes the page
// sideways. Those need a browser at a real width with awkward data in it.
//
// It walks all four pages, because they share one stylesheet: a change made for
// the hub lands on the player too, and the player is the one nobody thinks to
// open.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

/** Every galaxy: seven are dark and three are light, and both halves of the
    contrast rule have to hold on a page made almost entirely of surfaces. */
const THEMES = ['andromeda', 'orion', 'sombrero', 'whirlpool', 'pinwheel',
    'triangulum', 'sunflower', 'cartwheel', 'dawn', 'silver'];
const WIDTHS = [1920, 1440, 1024, 820, 390, 320];

/*
  The four pages, plus the three states nobody looks at.

  `empty`, `down` and `loading` are here because they are DIFFERENT layouts and
  the live service will not produce them on demand - and the difference between
  the first two is the thing this feature's own comments insist on: one offers a
  retry and the other explains itself. A harness that only ever shoots the happy
  path cannot see that one of them has come out looking like the other.
*/
const PAGES = [
    { id: 'browse', hash: '#/tv' },
    { id: 'films', hash: '#/tv/movies' },
    { id: 'series-shelf', hash: '#/tv/series' },
    { id: 'series', hash: '#/tv/series/s1' },
    { id: 'live', hash: '#/tv/live' },
    { id: 'live-tuned', hash: '#/tv/live?channel=c2' },
    { id: 'watch', hash: '#/tv/watch/episode/s1/s1-s1e1' },
    { id: 'loading', hash: '#/tv', state: 'slow' },
    { id: 'empty', hash: '#/tv', state: 'empty' },
    { id: 'down', hash: '#/tv', state: 'down' },
];

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:8792/index.html';
const outDir = resolve(process.argv[2] || 'tools/iptv-preview/shots');

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const port = 9334;
const chrome = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    // The profile goes in the OS temp directory, NOT next to the screenshots.
    // Chrome keeps files in it open for a moment after it exits, so a profile
    // inside `shots/` makes `rm -rf shots` fail with "device or resource busy" -
    // and it is a few hundred megabytes of browser state sitting in the repo.
    '--user-data-dir=' + join(tmpdir(), 'sfs-iptv-shoot-profile'),
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
  A throw inside the page must never read as a pass.

  `audit:rtl` reported "1 problem" on every route for a whole afternoon because a
  SyntaxError was being thrown inside the browser where nothing printed it, and a
  page with nothing on it measures as a page with nothing wrong with it. So
  exceptions and console errors are collected and counted.
*/
const pageErrors = [];
cdp.send('Log.enable').catch(() => { /* older builds */ });

/*
  Screenshots are taken with reduced motion, and this is not a preference: the
  cards animate on hover and the skeleton pulses, so two runs would otherwise
  produce different images and neither could be diffed against the other. The
  stylesheet already honours `prefers-reduced-motion`, so every shot is the
  settled frame.
*/
await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

let failures = 0;
const report = [];

/*
  NAVIGATE TO THE ROOT, THEN SET `location.hash`.

  Going straight to `BASE#/tv/live` from `about:blank` makes the app boot and the
  router resolve BEFORE the hash is applied, so it lands on whatever `/` redirects
  to - which reads exactly like the route being broken and is not. The same two
  lines are why `tools/lessonorder-check/rendered.mjs` is shaped the way it is.
  Setting the hash once the router has mounted is an ordinary in-app navigation
  and works every time.

  And WAIT FOR AN ELEMENT, never a timer alone: these views fetch (from a stub
  here, from a ~20-second cold replica in production), so a sleep long enough to
  be safe makes the run unusable and a short one reports an empty page that was
  merely still loading.
*/
async function show(page, theme, locale) {
    const query = `?theme=${theme}&locale=${locale}&probe=1`
        + (page.state ? `&state=${page.state}` : '');
    await cdp.send('Page.navigate', { url: `${BASE}${query}` });
    await sleep(250);
    await cdp.send('Runtime.evaluate', {
        expression: `location.hash = ${JSON.stringify(page.hash)}`,
    });
    for (let attempt = 0; attempt < 40; attempt++) {
        const { result } = await cdp.send('Runtime.evaluate', {
            expression: `(() => {
                const bar = document.querySelector('.iptv-bar');
                const body = document.querySelector('.iptv-card, .iptv-notice,'
                    + ' .iptv-theatre, .iptv-episode, .iptv-stage, .iptv-head');
                return bar && body ? 'ready' : 'waiting';
            })()`,
            returnByValue: true,
        });
        if (result.value === 'ready') return true;
        await sleep(150);
    }
    return false;
}

/*
  Force every `loading="lazy"` image to load before capturing.

  `captureBeyondViewport` paints the whole document, and it does NOT reliably
  trigger a lazy image that has never been inside the viewport. So the first run
  of this harness produced a Live shelf of twelve channel plates with no logos in
  any of them - which looks exactly like the logos being broken, and the next
  move would have been to "fix" a stylesheet that was working. `naturalWidth === 0`
  is what said otherwise.

  Scrolling the document once and returning to the top is the cheapest honest
  answer: the browser loads what it passes. The wait afterwards is on the images
  themselves rather than on a timer.
*/
async function loadLazyImages() {
    await cdp.send('Runtime.evaluate', {
        expression: `(async () => {
            const step = window.innerHeight * 0.8;
            for (let y = 0; y < document.body.scrollHeight; y += step) {
                window.scrollTo(0, y);
                await new Promise(r => requestAnimationFrame(r));
            }
            window.scrollTo(0, 0);
        })()`,
        awaitPromise: true,
    });
    for (let attempt = 0; attempt < 30; attempt++) {
        const { result } = await cdp.send('Runtime.evaluate', {
            expression: '[...document.images].filter(i => i.src && !i.complete).length',
            returnByValue: true,
        });
        if (result.value === 0) return;
        await sleep(120);
    }
}

/** The probe's own report, once it has had time to run. */
async function probe() {
    for (let attempt = 0; attempt < 30; attempt++) {
        const { result } = await cdp.send('Runtime.evaluate', {
            expression: 'document.getElementById("probe")?.textContent || ""',
            returnByValue: true,
        });
        if (result.value) return String(result.value);
        await sleep(150);
    }
    return 'NO PROBE';
}

for (const width of WIDTHS) {
    /*
      One galaxy per width for GEOMETRY - the layout does not depend on the
      palette - and every galaxy at the two widths a reader is most likely to be
      on, because that is where a surface-heavy page has to stay legible. Arabic
      at those two as well: an RTL fault is invisible in English and invisible in
      the source, which is the whole argument `audit:rtl` makes.
    */
    const themes = width === 1440 || width === 390 ? THEMES : ['andromeda'];
    const locales = width === 1440 || width === 390 ? ['en', 'ar'] : ['en'];

    for (const locale of locales) {
        for (const theme of themes) {
            // Only the geometry sweep walks every page; the palette sweep is
            // Browse and a tuned Live, which between them carry every surface in
            // the stylesheet.
            const pages = theme === 'andromeda'
                ? PAGES
                : PAGES.filter(p => p.id === 'browse' || p.id === 'live-tuned');

            for (const page of pages) {
                await cdp.send('Emulation.setDeviceMetricsOverride', {
                    width, height: 900, deviceScaleFactor: 1, mobile: width <= 480,
                });
                const ready = await show(page, theme, locale);
                await loadLazyImages();
                const lines = (await probe()).split('\n');
                const bad = lines.filter(l => /SIDEWAYS SCROLL|OVERFLOWS/.test(l));

                const label = `${width}px ${theme} ${locale} ${page.id}`;

                // A page that never rendered is its own failure, and it must not
                // read as "no overflow" - which is what an empty page measures as.
                if (!ready) {
                    failures++;
                    report.push(`\n${label}:`);
                    report.push('  NEVER RENDERED  (no .iptv-bar, or no content in it)');
                }
                if (bad.length) {
                    failures += bad.length;
                    report.push(`\n${label}:`);
                    for (const line of [...new Set(bad)].slice(0, 12)) {
                        report.push('  ' + line);
                    }
                }

                const shot = await cdp.send('Page.captureScreenshot', {
                    format: 'png', captureBeyondViewport: true,
                });
                const name = `${width}-${theme}-${locale}-${page.id}.png`;
                writeFileSync(join(outDir, name), Buffer.from(shot.data, 'base64'));
                console.log(`  shot  ${String(width).padStart(4)}px  `
                    + `${theme.padEnd(11)} ${locale}  ${page.id.padEnd(13)}`
                    + (bad.length ? `  ${bad.length} layout problem(s)`
                        : ready ? '  clean' : '  NEVER RENDERED'));
            }
        }
    }
}

cdp.close();
chrome.kill();

if (pageErrors.length) {
    console.log('\nExceptions inside the page:');
    for (const line of [...new Set(pageErrors)].slice(0, 10)) console.log('  ' + line);
}

if (report.length) {
    console.log('\nLayout problems:' + report.join('\n'));
    console.log(`\n${failures} problem(s). Screenshots in ${outDir}\n`);
    process.exit(1);
}
console.log('\nNo overflow at any width, in any galaxy, in either direction.');
console.log(`Screenshots in ${outDir}\n`);
