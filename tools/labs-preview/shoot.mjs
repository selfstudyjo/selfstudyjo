// Screenshot and MEASURE one lab's workspace at real viewport sizes.
//
//   npm run build:lab-preview && node tools/labs-preview/shoot.mjs
//
// `/lab/:labId` needs an account, `lab_feature` on a live subscription and a
// warm app 11 replica, so `audit:rtl` cannot reach it and `check:labs` renders
// nothing. Three faults were reported on this page — the web result pane
// showing nothing, the Network Simulator opening somewhere else, and Check my
// work doing nothing — and not one of them is visible in `check:labs`'s 341
// assertions, because none is a property of `labCatalogue.ts`.
//
// It DRIVES the page as well as photographing it: it types into the web
// playground, presses Run, presses Check my work, and reads back what actually
// happened. A screenshot of a blank white iframe and a screenshot of an iframe
// that never received a document are the same picture.
//
// `Emulation.setDeviceMetricsOverride` rather than `--window-size`: headless
// Chrome has a ~500px minimum window and CROPS below it, which reads as a page
// overflowing its container. Node's own `fetch`/`WebSocket` speak CDP, so this
// needs no dependency.
//
// ONE THING THE PICTURES CANNOT SHOW, and it is worth knowing before reading
// them: headless Chrome composites a child frame at an OPAQUE ORIGIN into a
// capture only sometimes. The web playground's result pane therefore comes out
// WHITE in a good many of these shots while being perfectly painted in the
// browser — verified by clipping the same rectangle at the same instant and
// getting the student's page, then clipping it again and getting white. It is a
// race, not a state of the page, and capturing twice makes it no better. So a
// shot here is evidence about the LAYOUT and about nothing inside that frame;
// what the frame did is asserted from its `load` count instead, which is exact.
// (`captureBeyondViewport` was a second way that pane read as blank, and
// `--window-size` a third on tools/tools-preview. This camera lies a lot.)

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

const WIDTHS = [1920, 1440, 1024, 820, 390];

const VARIANTS = [
    { id: 'web-dark', query: 'lab=web-01-html&theme=andromeda&lang=en' },
    { id: 'web-light', query: 'lab=web-01-html&theme=cartwheel&lang=en' },
    { id: 'netsim-dark', query: 'lab=net-01-addressing&theme=andromeda&lang=en' },
    { id: 'docker-dark', query: 'lab=docker-01-first&theme=andromeda&lang=en' },
    { id: 'web-ar', query: 'lab=web-01-html&theme=andromeda&lang=ar' },
    { id: 'gradefail', query: 'lab=web-01-html&state=gradefail&theme=andromeda' },
];

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:8795/index.html';
const outDir = resolve(process.argv[2] || 'tools/labs-preview/shots');

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const port = 9338;
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

// A thrown exception must never read as a clean run: `tools/rtl-audit` reported
// "1 problem" on every route for exactly this reason.
const thrown = [];

async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) thrown.push(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
    return result?.value;
}

await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

let failures = 0;
const report = [];

/* ── the drive: type into the web playground, Run, then Check my work ──────
   This is the half a screenshot cannot do. The result frame is sandboxed
   without `allow-same-origin`, so its document is unreadable from here — what
   IS readable is the `srcdoc` the component handed it, and whether the task
   list moved after the button was pressed. */
const DRIVE = `(async () => {
  const q = s => document.querySelector(s);
  const out = [];
  const paneNamed = name => Array.from(document.querySelectorAll('.sl-bench__tab'))
      .find(el => (el.textContent || '').trim().toLowerCase().includes(name));
  const web = paneNamed('web');
  if (!web) return 'NO WEB PANE';
  web.click();
  await new Promise(r => setTimeout(r, 200));
  const area = q('.sl-web__editor:not([style*="display: none"])') || q('.sl-web__editor');
  if (!area) return 'NO EDITOR';
  /*
    Count the frame's LOAD events from BEFORE the first Run.

    The result frame is a unique opaque origin, so its document cannot be read
    from here and a screenshot of a blank white box is the same picture whether
    it rendered nothing or was never handed anything. A load event on the
    element is the one signal that crosses the boundary: one more of them is the
    browser having committed the document Run produced.
  */
  const preframe = q('iframe.sl-web__frame');
  if (preframe) {
    preframe.dataset.loads = '0';
    preframe.addEventListener('load', () => {
      preframe.dataset.loads = String(+preframe.dataset.loads + 1);
    });
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(area, '<h1>Hi</h1>\\n<ul><li>a</li><li>b</li></ul>\\n<a href="https://x.dev">go</a>\\n<img src="x" alt="y">');
  area.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 120));
  const run = Array.from(document.querySelectorAll('.sl-web__panes button, .sl-console__actions button'))
      .concat(Array.from(document.querySelectorAll('button')))
      .find(b => (b.textContent || '').trim() === 'Run');
  out.push('RUN BUTTON ' + (run ? 'found' : 'MISSING'));
  if (run) run.click();
  await new Promise(r => setTimeout(r, 400));
  const frame = q('iframe.sl-web__frame');
  out.push('AFTER RUN srcdoc=' + ((frame && frame.getAttribute('srcdoc')) || '').length + ' chars');
  out.push('AFTER RUN contains h1: ' + /<h1>/.test((frame && frame.getAttribute('srcdoc')) || ''));
  out.push('AFTER RUN the frame committed a document: '
           + (frame && frame.dataset.loads !== '0') + ' (loads=' + (frame||{}).dataset.loads + ')');

  const save = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Save');
  if (save) { save.click(); await new Promise(r => setTimeout(r, 1400)); }
  out.push('AFTER SAVE grade=' + ((q('.sl-tasks__count') || {}).textContent || '').trim());

  const before = ((q('.sl-tasks__count') || {}).textContent || '').trim();
  const check = Array.from(document.querySelectorAll('.sl-tasks__head button'))[0];
  out.push('CHECK BUTTON ' + (check ? 'found' : 'MISSING'));
  if (check) { check.click(); await new Promise(r => setTimeout(r, 1500)); }
  const after = ((q('.sl-tasks__count') || {}).textContent || '').trim();
  out.push('CHECK before=' + JSON.stringify(before) + ' after=' + JSON.stringify(after));
  out.push('FEEDBACK ' + JSON.stringify(((q('.sl-tasks__feedback') || {}).textContent || '').trim()));
  return out.join('\\n');
})()`;

/* ── the second drive: a lab where every task is marked by the student ─────
   The whole Networking track is `manual` checks, so Check my work can never
   move on its own — and the tick that CAN move it was persisted under one key
   and read back under another, so it survived nothing. Both halves are
   invisible without pressing the thing. */
const DRIVE_MANUAL = `(async () => {
  const q = s => document.querySelector(s);
  const out = [];
  const count = () => ((q('.sl-tasks__count') || {}).textContent || '').trim();
  out.push('BEFORE ' + count());
  out.push('NOTICE ' + JSON.stringify(((q('.sl-tasks__feedback') || {}).textContent || '').trim()));
  const tick = Array.from(document.querySelectorAll('.sl-task__self'))[0];
  out.push('SELF-MARK CONTROL ' + (tick ? 'found' : 'MISSING'));
  if (tick) { tick.click(); await new Promise(r => setTimeout(r, 1500)); }
  out.push('AFTER TICK ' + count());
  out.push('FEEDBACK ' + JSON.stringify(((q('.sl-tasks__feedback') || {}).textContent || '').trim()));
  const studio = q('.ns-studio');
  out.push('STUDIO IN THE PANE ' + Boolean(studio)
           + (studio ? ' ' + Math.round(studio.getBoundingClientRect().height) + 'px' : ''));
  return out.join('\\n');
})()`;

for (const width of WIDTHS) {
    const variants = width === 1440 || width === 390 ? VARIANTS : [VARIANTS[0], VARIANTS[2]];
    for (const variant of variants) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width, height: 1000, deviceScaleFactor: 1, mobile: width <= 480,
        });
        await cdp.send('Page.navigate', { url: `${BASE}?${variant.query}&probe=1` });
        // The probe WAITS for the page to settle (see main.ts), so this is a floor
        // rather than a guess. The netsim chunk is ~570 kB and starts cold.
        await sleep(variant.id.includes('netsim') ? 4200 : 2400);

        const value = await evaluate('document.getElementById("probe")?.textContent || "NO PROBE"');
        const lines = String(value).split('\n');
        if (lines[0] === 'NO PROBE' || lines.includes('EMPTY PAGE')) {
            failures++;
            report.push(`\n${width}px ${variant.id}: ${lines[0] === 'NO PROBE' ? 'the page never reported — it probably threw' : 'THE PAGE IS EMPTY'}`);
        }
        /*
          THE SIMULATOR IS A PANE AT EVERY WIDTH, not a link at some of them.
          Asserted per width rather than once, because the studio's own
          responsive rules hide two of its three columns at and below 1024 —
          which is where an embedded copy is most likely to be got wrong.
        */
        if (variant.id.includes('netsim')) {
            if (!lines.includes('NETSIM_STUDIO embedded')) {
                failures++;
                report.push(`
${width}px ${variant.id}: the Network Simulator is NOT in the pane`);
            }
            if (lines.some(l => l.startsWith('EXTERNAL_PANE'))) {
                failures++;
                report.push(`
${width}px ${variant.id}: it fell back to the link-only pane`);
            }
        }
        const bad = lines.filter(l => /SIDEWAYS SCROLL|OVERFLOWS/.test(l));
        if (bad.length) {
            failures += bad.length;
            report.push(`\n${width}px ${variant.id}:`);
            for (const line of [...new Set(bad)].slice(0, 12)) report.push('  ' + line);
        }

        /*
          VIEWPORT ONLY, and that is the third way this camera has lied.

          `captureBeyondViewport` re-renders the page at the full document size
          and does NOT re-rasterise an <iframe> — so the web playground's result
          frame comes out BLANK in the picture while being perfectly painted in
          the browser. That is indistinguishable from the fault this harness was
          built to look at, and it cost an hour before the frame was clipped and
          shot on its own. (`tools/leaderboard-preview` documents the same thing
          for a <canvas>.) The overflow report above is numeric, so nothing is
          lost by photographing only what a reader can see. */
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(outDir, `${width}-${variant.id}.png`), Buffer.from(shot.data, 'base64'));
        console.log(`  shot  ${String(width).padStart(4)}px  ${variant.id.padEnd(13)}`
            + (bad.length ? `  ${bad.length} layout problem(s)` : '  clean'));

        if (width === 1440) {
            console.log(lines.filter(l => /^(PANES|TOOLS|FRAME|EXTERNAL_PANE|NETSIM_STUDIO|GRADE)/.test(l))
                .map(l => '        ' + l).join('\n'));
            if (variant.id === 'web-dark' || variant.id === 'gradefail') {
                const drove = String(await evaluate(DRIVE));
                console.log(drove.split('\n').map(l => '        · ' + l).join('\n'));
                /*
                  The drive is ASSERTED, not merely printed. Each of these is one of
                  the three faults this harness was built for, and a report nobody
                  reads is how tools/leaderboard-preview screenshotted an empty page
                  for a week while printing `clean`.
                */
                const must = [
                    ['the Run button exists', /RUN BUTTON found/],
                    ['Run renders the typed markup', /AFTER RUN contains h1: true/],
                    ['and the frame actually commits it', /committed a document: true/],
                    ['Check my work says what it did', /FEEDBACK "[^"]+"/],
                ];
                for (const [what, pattern] of must) {
                    if (!pattern.test(drove)) {
                        failures++;
                        report.push(`\n${width}px ${variant.id}: ${what} — NOT TRUE`);
                    }
                }
                const after = await cdp.send('Page.captureScreenshot', { format: 'png' });
                writeFileSync(join(outDir, `${width}-${variant.id}-driven.png`), Buffer.from(after.data, 'base64'));
            }
            if (variant.id === 'netsim-dark') {
                const drove = String(await evaluate(DRIVE_MANUAL));
                console.log(drove.split('\n').map(l => '        · ' + l).join('\n'));
                const must = [
                    ['the self-mark control is on the card', /SELF-MARK CONTROL found/],
                    ['A TICK ACTUALLY MOVES THE GRADE', /AFTER TICK 1 of 5 done/],
                    ['and the button says what it did', /FEEDBACK "[^"]+"/],
                    ['the studio is IN the pane, not behind a link', /STUDIO IN THE PANE true/],
                ];
                for (const [what, pattern] of must) {
                    if (!pattern.test(drove)) {
                        failures++;
                        report.push(`\n${width}px ${variant.id}: ${what} — NOT TRUE`);
                    }
                }
                const after = await cdp.send('Page.captureScreenshot', { format: 'png' });
                writeFileSync(join(outDir, `${width}-${variant.id}-driven.png`), Buffer.from(after.data, 'base64'));
            }
        }
    }
}

cdp.close();
chrome.kill();

if (thrown.length) {
    console.log('\nUncaught in the page:\n  ' + [...new Set(thrown)].join('\n  '));
    failures += thrown.length;
}
if (report.length || failures) {
    console.log((report.length ? '\nLayout problems:' + report.join('\n') : ''));
    console.log(`\n${failures} problem(s). Screenshots in ${outDir}\n`);
    process.exit(1);
}
console.log(`\nNo overflow at any width, in any galaxy or language. Screenshots in ${outDir}\n`);
