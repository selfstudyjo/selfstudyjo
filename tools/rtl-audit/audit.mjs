// Look at the app in ARABIC, on a phone, and say what is broken.
//
//   npm run audit:rtl              # the public routes, six widths, Arabic
//   npm run audit:rtl -- --ltr     # the same in English, for a baseline
//
// WHY THIS EXISTS
//
// `check:i18n` proves the catalogue is complete and that every class `rtl.css`
// names is a class that exists. It cannot see a LAYOUT: an overlay pinned to
// the wrong corner, a drawer that parks on-screen, a card wider than the
// viewport, a fixed control that lands under another one. Every one of those is
// invisible in English, invisible in the source, and the whole of what "the
// style is bad in Arabic on a phone" means.
//
// It is also the class of bug this repo has already paid for once: `rtl.css`
// named three classes that did not exist, so the mobile drawer was parked in
// the MIDDLE of an Arabic phone's viewport, `position: fixed`, on top of the
// page, for the entire life of the file. Nothing in English showed it.
//
// WHY THE DEVTOOLS PROTOCOL AND NOT `chrome --screenshot`
//
// `--window-size=390,900` does not give a 390px viewport. Headless Chrome has a
// minimum window width of around 500px, so it renders at ~490 and crops the
// image to 390 — which looks exactly like a page overflowing its container, and
// cost a wrong diagnosis during the leaderboard's development. Only
// `Emulation.setDeviceMetricsOverride` gives a real narrow viewport, and that
// means CDP. Node has `fetch` and `WebSocket` built in, so it needs no
// dependency: a check that requires 200 MB of Chromium to be installed first is
// a check nobody runs.
//
// WHAT IT CANNOT SEE
//
// Only routes that render without an account. That is Home, Login, Register,
// Courses, Plans, All Certificates, the Leaderboard and the Newscast — which is
// most of the platform's CHROME (the sidebar, the drawer, the headers, the
// cards, the forms and the tables) even though it is a minority of its screens.
// Seeding a fake session to reach the rest would be testing a login shim.
//
// It reports rather than gates, like `audit:contrast` and `audit:ink`. Every
// finding is a real element with a real measurement, but "wider than its
// parent" has honest false positives — a deliberately scrolling strip, a
// `position: fixed` overlay measured against a scrolled document — and a check
// that fails on those is a check somebody switches off.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/** Everything that renders without an account. `AUDIT_ROUTES` narrows it. */
const ONLY = (process.env.AUDIT_ROUTES || '').split(',').filter(Boolean);
const ALL_ROUTES = [
    ['home', '/'],
    ['login', '/login'],
    ['register', '/register'],
    ['courses', '/courses'],
    ['plans', '/plans'],
    ['certificates', '/all-certificates'],
    ['leaderboard', '/leaderboard'],
    ['newscast', '/newscast'],
];
const ROUTES = ONLY.length ? ALL_ROUTES.filter(r => ONLY.includes(r[0])) : ALL_ROUTES;

/**
 * The widths that matter, and why each one is here.
 *
 *   320  the narrowest Android still in real use, and where everything breaks
 *   360  the modal Android width
 *   390  iPhone
 *   430  the large phones
 *   768  the tablet breakpoint — ON it, which is where an off-by-one shows
 *   1024 tablet landscape, the width the drawer stops being a drawer
 */
const WIDTHS = (process.env.AUDIT_WIDTHS || '320,360,390,430,768,1024')
    .split(',').map(Number);

const rtl = !process.argv.includes('--ltr');
const locale = rtl ? 'ar' : 'en';
const BASE = process.env.AUDIT_URL || 'http://127.0.0.1:4173';
const outDir = resolve(process.argv.find(a => !a.startsWith('-') && a.includes('shots'))
    || `tools/rtl-audit/shots-${locale}`);

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const port = 9411;
const chrome = spawn(browser, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    // SwiftShader rather than `--disable-gpu`: three of these routes render a
    // Babylon scene, and with no GL at all they show a permanently empty canvas
    // — which is indistinguishable from a page whose layout is fine and whose
    // content never arrived.
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

/** A minimal CDP client. One socket, one id counter, promises per id. */
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

/**
 * The probe, read as TEXT from a file of its own.
 *
 * Not a template literal in here: as one, every `\s` in a regex and every
 * `
` in a string has to be written twice, and getting one wrong is a
 * SyntaxError thrown inside the browser where nothing prints it. It happened
 * during this script's own development and the audit reported "1 problem" on
 * every route — indistinguishable from a page with nothing wrong with it. See
 * `probe.js`, and see the `exceptionDetails` branch below, which is the other
 * half of making sure a throw is never read as a pass.
 */
const PROBE = readFileSync(new URL('./probe.js', import.meta.url), 'utf8');

const cdp = connect(await target());
await cdp.ready;
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');

/*
  A page that THREW is not a clean page.

  Half of what "the style is broken" turns out to mean is a component that
  failed to mount, and from a screenshot that is indistinguishable from a
  section somebody has not written yet — the layout around it is perfectly
  correct, because there is nothing in it. Console errors and unhandled
  rejections are collected per route and reported beside the geometry.
*/
let consoleErrors = [];
cdp.onEvent = (method, params) => {
    if (method === 'Runtime.exceptionThrown') {
        const d = params.exceptionDetails;
        consoleErrors.push('THREW: ' + (d.exception?.description || d.text));
    } else if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
        consoleErrors.push('CONSOLE ERROR: ' + params.args
            .map(a => a.description || a.value).join(' ').slice(0, 300));
    }
};
// The 3D stages and every entry animation settle instantly, so two runs of this
// produce the same measurements and one can be diffed against another.
await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

/*
  The language is set BEFORE the app boots, not clicked afterwards.

  `initLocale()` reads `sfs-locale` from localStorage on the first tick and puts
  `dir` on `<html>`; setting it after load would measure a page that had already
  laid itself out left-to-right. `addScriptToEvaluateOnNewDocument` runs before
  any of the document's own script, on every navigation.
*/
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('sfs-locale', '${locale}'); } catch (e) {}`,
});

let problems = 0;
const report = [];

for (const width of WIDTHS) {
    for (const [label, path] of ROUTES) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width, height: 860, deviceScaleFactor: 1, mobile: width <= 480,
        });
        consoleErrors = [];
        await cdp.send('Page.navigate', { url: `${BASE}/#${path}` });
        // Long enough for the router, the first paint and any service call to
        // fail. Every one of these routes renders its own empty state without a
        // backend, which is the point of choosing them.
        await sleep(1800);

        /*
          A 3D ROUTE NEEDS LONGER, AND HAS TO BE WAITED FOR RATHER THAN GUESSED.

          The Newscast downloads the Babylon chunk, builds a scene and compiles
          PBR shaders — under SwiftShader that is several seconds, and the first
          two attempts at screenshotting it caught a half-drawn frame and then a
          blank one. Both looked like a broken renderer and neither was.

          Polled rather than slept: a fixed wait is either too short on a cold
          cache or wasted on every one of the other seven routes.
        */
        for (let tries = 0; tries < 24; tries++) {
            const ready = await cdp.send('Runtime.evaluate', {
                expression: `(() => {
                    const c = document.querySelector('canvas.stage__canvas, canvas.s3d__canvas');
                    if (!c) return true;                       // no 3D on this route
                    return c.width > 32 && c.height > 32 && !!c.__sfsPainted;
                })()`,
                returnByValue: true,
            });
            if (ready.result?.value) break;
            // Babylon marks the canvas after its first render — see
            // `portraitStage.ts` and `studioStage.ts`. Give it a beat and ask
            // again rather than assuming.
            await sleep(400);
        }

        const evaluated = await cdp.send('Runtime.evaluate', {
            expression: PROBE, returnByValue: true, awaitPromise: false,
        });
        /*
          A probe that THREW must not read as a clean page.

          It ran as an empty string once during this script's own development —
          a stray escape in the template literal — and every route reported one
          problem (the direction) and no others, which is indistinguishable from
          a page with nothing wrong with it. Reporting the exception is the
          difference between "there is nothing to fix" and "nothing looked".
        */
        if (evaluated.exceptionDetails) {
            console.log(`  ${String(width).padStart(4)}px  ${label.padEnd(14)}`
                + `PROBE THREW: ${evaluated.exceptionDetails.exception?.description
                    || evaluated.exceptionDetails.text}`);
            problems++;
            continue;
        }
        let reportedDir = '';
        let bad = [];
        try {
            const parsed = JSON.parse(String(evaluated.result?.value ?? '{}'));
            reportedDir = parsed.dir || '';
            bad = parsed.problems || [];
        } catch {
            bad = ['PROBE returned nothing parseable'];
        }

        bad.push(...new Set(consoleErrors));

        if (rtl && reportedDir !== 'rtl') {
            bad.unshift('DIRECTION: <html dir> is "' + reportedDir + '", expected rtl');
        }
        if (bad.length) {
            problems += bad.length;
            report.push(`\n  ${String(width).padStart(4)}px  ${label}`);
            for (const line of bad.slice(0, 10)) report.push('      ' + line);
            if (bad.length > 10) report.push(`      … and ${bad.length - 10} more`);
        }

        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(outDir, `${width}-${label}.png`), Buffer.from(shot.data, 'base64'));
        console.log(`  ${String(width).padStart(4)}px  ${label.padEnd(14)}`
            + (bad.length ? `${bad.length} problem(s)` : 'clean'));
    }
}

cdp.close();
chrome.kill();

console.log(`\n${locale.toUpperCase()} · ${problems} problem(s). Screenshots in ${outDir}`);
if (report.length) console.log(report.join('\n'));
console.log('');
