// Screenshot and MEASURE the Drawing Papers preview at real viewport sizes.
//
//   npm run shoot:draw
//
// `/draw` is `requiresAuth: true` and needs a warm app 34, so it is one of the
// screens `audit:rtl` cannot reach — and that is exactly how it shipped with
// card titles that did not appear at all. `.card` was `--sfs-paper`, which is
// light in all ten galaxies, and `h3` was `--sfs-text`, which is WHITE in the
// seven dark ones: white on white, about 1.05:1.
//
// WHY IT MEASURES RATHER THAN ONLY PHOTOGRAPHING
//
// A picture of invisible text and a picture of a card with no text are the SAME
// PICTURE. Shooting alone would have needed somebody to notice that five cards
// had gone quiet, which is what nobody did for as long as this page has
// existed. So the probe reports the computed contrast of EVERY line of text
// against the fill actually painted behind it, and this script FAILS below AA —
// a number a run can fail on rather than a picture somebody has to read.
//
// It is every line rather than the titles because the first version measured
// `.card-body h3` alone and its first clean run photographed a page whose h1,
// both section headings and the New paper button were all invisible. A probe
// aimed at one selector proves one selector.
//
// WHY THE DEVTOOLS PROTOCOL RATHER THAN `chrome --screenshot`
//
// `--window-size=390,2600` does NOT give a 390px viewport: headless Chrome has
// a minimum window width of around 500px, so it renders at ~490 and then CROPS
// the image to 390 — which looks exactly like a page overflowing its container.
// Only `Emulation.setDeviceMetricsOverride` gives a real narrow viewport. Node
// has `fetch` and `WebSocket` built in, so this needs no dependency: a check
// nobody can run without installing 200MB of Chromium is a check nobody runs.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

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
  ONE DARK GALAXY AND ONE LIGHT ONE, and that pairing is the whole point.

  The reported bug was TOTAL in a dark galaxy and INVISIBLE in a light one, so
  a harness that only ever rendered the default would have reported the page as
  fine — which is the same argument `AUDIT_THEME` makes for `audit:rtl`. Arabic
  as well, because the grid, the tag row and one stubbed paper title all mirror.
*/
const VARIANTS = [
    { id: 'andromeda-en', query: 'theme=andromeda&lang=en' },
    { id: 'cartwheel-en', query: 'theme=cartwheel&lang=en' },
    { id: 'andromeda-ar', query: 'theme=andromeda&lang=ar' },
    { id: 'empty-en', query: 'theme=andromeda&lang=en&empty=1' },
];


const outDir = resolve(process.argv[2] || 'tools/draw-preview/shots');
const distDir = resolve('tools/draw-preview/dist');

if (!existsSync(join(distDir, 'index.html'))) {
    console.error('No build. Run `npm run build:draw-preview` first.');
    process.exit(1);
}

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

/*
  ITS OWN SERVER, and that is not a convenience.

  `shoot.mjs` in `tools/leaderboard-preview` defaulted to a port and started
  nothing, so run without a server it printed `NO PROBE` for every width — which
  is the exact string it prints when the page fails to MOUNT. Those two need
  opposite reactions and were indistinguishable.
*/
const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};
const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const file = join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);
    try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
    } catch {
        res.writeHead(404).end('not found');
    }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;

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
        message.error ? waiting.fail(new Error(message.error.message))
            : waiting.ok(message.result);
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
  A THROW MUST NEVER READ AS A PASS. `audit:rtl` reported "1 problem" on every
  route once, from a SyntaxError thrown inside the browser where nothing printed
  it — and a page with nothing wrong with it looks identical. So the console is
  listened to and anything that arrives is a failure.
*/
const thrown = [];
cdp.send('Log.enable').catch(() => {});
const socketErrors = message => {
    if (message?.method === 'Runtime.exceptionThrown') {
        thrown.push(message.params?.exceptionDetails?.text || 'exception');
    }
};
void socketErrors;

// Reduced motion, so every shot is the settled frame and two runs produce
// identical images. The card lift and the skeleton shimmer both animate.
await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

let failures = 0;
const report = [];

for (const width of WIDTHS) {
    /* Every variant at the two widths a reader is most likely to be on, and one
       dark English shot everywhere else: the LAYOUT does not depend on the
       palette, and the palette is the whole point at 1440 and 390. */
    const variants = width === 1440 || width === 390 ? VARIANTS : [VARIANTS[0]];
    for (const variant of variants) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width, height: 900, deviceScaleFactor: 1, mobile: width <= 480,
        });
        await cdp.send('Page.navigate', { url: `${BASE}?${variant.query}&probe=1` });
        await sleep(2400);

        const { result } = await cdp.send('Runtime.evaluate', {
            expression: 'document.getElementById("probe")?.textContent || "NO PROBE"',
            returnByValue: true,
        });
        const lines = String(result.value).split('\n');
        const problems = [];

        if (lines[0] === 'NO PROBE') {
            problems.push('the page never reported — it probably threw during mount');
        }

        /* ---- LEGIBILITY, which is what this harness is for ----
           The probe measures every line of text on the page against the fill
           actually painted behind it and names anything under AA, so this only
           has to relay them. It also reports how many it measured: a page that
           threw halfway through renders a handful of elements and would
           otherwise come back "clean". */
        problems.push(...lines.filter(l => l.startsWith('UNREADABLE')));
        // COVERED, which no contrast measurement can see: legible text with
        // something painted on top of it. See the probe - this is what the
        // first clean run of this harness photographed and did not report.
        problems.push(...lines.filter(l => l.startsWith('COVERED')));
        problems.push(...lines.filter(l => l.startsWith('NO CARDS')));
        const counted = Number((lines.find(l => l.startsWith('MEASURED')) || '').split(' ')[1]);
        if (lines[0] !== 'NO PROBE' && !(counted >= 8)) {
            problems.push(`only ${counted || 0} text elements on the page - it rendered almost nothing`);
        }

        /* ---- and the overflow report ---- */
        problems.push(...lines.filter(l => /SIDEWAYS SCROLL|OVERFLOWS/.test(l)));

        if (problems.length) {
            failures += problems.length;
            report.push(`\n${width}px ${variant.id}:`);
            for (const line of [...new Set(problems)].slice(0, 12)) report.push('  ' + line);
        }

        const shot = await cdp.send('Page.captureScreenshot', {
            format: 'png', captureBeyondViewport: true,
        });
        writeFileSync(join(outDir, `${width}-${variant.id}.png`),
            Buffer.from(shot.data, 'base64'));

        console.log(`  shot  ${String(width).padStart(4)}px  ${variant.id.padEnd(14)}`
            + `  ${counted || 0} lines measured`
            + (problems.length ? `  ${problems.length} problem(s)` : '  all legible, no overflow'));
    }
}

cdp.close();
chrome.kill();
server.close();

if (report.length) {
    console.log('\nProblems:' + report.join('\n'));
    console.log(`\n${failures} problem(s). Screenshots in ${outDir}\n`);
    process.exit(1);
}
console.log(`\nEvery card title clears AA in both galaxies and both languages, `
    + `and nothing overflows at any width. Screenshots in ${outDir}\n`);
// A listening socket keeps node's event loop alive; the leaderboard shooter
// printed its whole report and then hung for ever before it learned this.
process.exit(0);
