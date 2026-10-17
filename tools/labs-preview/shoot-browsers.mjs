// Drives the lab BROWSER panes at several screen sizes and asserts the page
// fills them - the "only the top half of the page shows" report - and that the
// web playground actually re-renders when CSS is typed.
//
//   npm run build:lab-preview
//   npx vite preview --config tools/labs-preview/vite.config.ts --port 8795
//   node tools/labs-preview/shoot-browsers.mjs
//
// WHAT IS MEASURED, AND WHY GEOMETRY. The frames are sandboxed without
// `allow-same-origin`, so nothing inside them can be read from here - which is
// the point of the sandbox. What CAN be read is the iframe element's own box
// against the stage it sits in: the bug was an iframe at its intrinsic 150px at
// the top of a 700px white stage, and that is a fact about two rectangles.
// A screenshot of each case is kept beside the report for the eye.
//
// For the playground, re-rendering is counted with a capturing `load` listener
// on the document (an iframe's load does not bubble, but it is seen in the
// capture phase), plus the CSS appearing in the new frame's `srcdoc`.

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
const SIZES = [[1920, 1080], [1440, 900], [1024, 768], [820, 1180], [390, 844]];
const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:8795/index.html';
const outDir = resolve(process.argv[2] || 'tools/labs-preview/shots/browsers');

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) { console.error('No Chrome or Edge found.'); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const port = 9343;
const chrome = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, '--user-data-dir=' + join(outDir, '.profile'),
    'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function target() {
    for (let i = 0; i < 60; i++) {
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
        const m = JSON.parse(event.data);
        const w = pending.get(m.id);
        if (!w) return;
        pending.delete(m.id);
        m.error ? w.fail(new Error(m.error.message)) : w.ok(m.result);
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

const thrown = [];
async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) thrown.push(exceptionDetails.text + ' '
        + (exceptionDetails.exception?.description || ''));
    return result?.value;
}
async function shot(name) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, name), Buffer.from(data, 'base64'));
}

let failures = 0;
function assert(label, ok, detail = '') {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
    if (!ok) failures++;
}

const openPane = (match, tool) => `(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 60 && !document.querySelector('.sl-bench__tab'); i++) await wait(200);
  const pane = Array.from(document.querySelectorAll('.sl-bench__tab'))
      .find(el => ${match}.test((el.textContent || '').trim()));
  if (pane) { pane.click(); await wait(300); }
  const tool = Array.from(document.querySelectorAll('.sl-bench__tool'))
      .find(el => ${tool}.test((el.textContent || '').trim()));
  if (tool) { tool.click(); await wait(300); }
  return Boolean(pane);
})()`;

/** The frame against its stage, after scrolling the stage into view. */
const measure = (frameSel, stageSel) => `(async () => {
  const frame = document.querySelector(${JSON.stringify(frameSel)});
  const stage = ${stageSel ? `document.querySelector(${JSON.stringify(stageSel)})` : 'frame'};
  if (!frame || !stage) return null;
  frame.scrollIntoView({ block: 'start' });
  await new Promise(r => setTimeout(r, 250));
  const f = frame.getBoundingClientRect(), s = stage.getBoundingClientRect();
  return { frameH: Math.round(f.height), frameW: Math.round(f.width),
           stageH: Math.round(s.height), stageW: Math.round(s.width),
           gapBottom: Math.round(s.bottom - f.bottom),
           vh: window.innerHeight, vw: window.innerWidth,
           overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 };
})()`;

try {
    for (const [width, height] of SIZES) {
        await cdp.send('Emulation.setDeviceMetricsOverride',
            { width, height, deviceScaleFactor: 1, mobile: width < 600 });

        // ---- the Django browser ------------------------------------------
        await cdp.send('Page.navigate', { url: `${BASE}?lab=dj-08-admin&theme=andromeda&lang=en` });
        await sleep(2200);
        await evaluate(openPane('/django/i', '/browser|preview/i'));
        await sleep(900);
        const dj = await evaluate(measure('.sl-prev__frame', '.sl-prev__stage'));
        assert(`${width}x${height} django: the frame FILLS the stage (no white below)`,
            dj && Math.abs(dj.frameH - dj.stageH) <= 1 && dj.gapBottom <= 1, dj);
        assert(`${width}x${height} django: the page is tall - most of the screen, never 150px`,
            dj && dj.frameH >= Math.min(352, dj.vh * 0.5) && dj.frameH > 160, dj);
        assert(`${width}x${height} django: and as wide as the pane, no sideways scroll`,
            dj && dj.frameW >= dj.stageW - 1 && !dj.overflowX, dj);
        await shot(`django-${width}.png`);

        // ---- the web playground ------------------------------------------
        await cdp.send('Page.navigate', { url: `${BASE}?lab=web-01-html&theme=andromeda&lang=en` });
        await sleep(2200);
        await evaluate(openPane('/web|html/i', '/web|playground/i'));
        await sleep(600);
        const web = await evaluate(measure('.sl-web__frame', null));
        assert(`${width}x${height} web: the result is most of the screen, not a 24rem box`,
            web && web.frameH >= Math.min(352, web.vh * 0.5), web);
        assert(`${width}x${height} web: no sideways scroll`, web && !web.overflowX, web);

        if (width === 1440) {
            // TYPE CSS AND WATCH IT RENDER, with Live on by default.
            const typed = await evaluate(`(async () => {
              const wait = ms => new Promise(r => setTimeout(r, ms));
              let loads = 0;
              document.addEventListener('load', e => {
                if (e.target && e.target.classList && e.target.classList.contains('sl-web__frame')) loads++;
              }, true);
              const live = document.querySelector('.sl-web__auto input');
              const cssTab = Array.from(document.querySelectorAll('.sl-web__tab'))
                  .find(b => b.textContent.trim() === 'CSS');
              cssTab.click(); await wait(150);
              const area = Array.from(document.querySelectorAll('.sl-web__editor'))
                  .find(t => t.offsetParent !== null);
              const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
              set.call(area, 'body { background: rgb(1, 2, 3); }');
              area.dispatchEvent(new Event('input', { bubbles: true }));
              await wait(1200);
              const frame = document.querySelector('.sl-web__frame');
              const first = { loads, live: live.checked,
                              hasCss: (frame.getAttribute('srcdoc') || '').includes('rgb(1, 2, 3)'),
                              stale: Boolean(document.querySelector('.sl-web__stale')) };
              set.call(area, 'body { background: rgb(4, 5, 6); }');
              area.dispatchEvent(new Event('input', { bubbles: true }));
              await wait(1200);
              const frame2 = document.querySelector('.sl-web__frame');
              return { ...first, loads2: loads,
                       hasCss2: (frame2.getAttribute('srcdoc') || '').includes('rgb(4, 5, 6)'),
                       fresh: frame2 !== frame };
            })()`);
            assert('web: Live is on by default', typed?.live === true, typed);
            assert('web: typed CSS re-renders the result with no Run press',
                typed?.hasCss && typed?.loads >= 1 && !typed?.stale, typed);
            assert('web: a SECOND edit renders again, in a fresh frame',
                typed?.hasCss2 && typed?.loads2 > typed?.loads && typed?.fresh, typed);

            // A full document with NO </body>: the case that never got its CSS.
            const fullDoc = await evaluate(`(async () => {
              const wait = ms => new Promise(r => setTimeout(r, ms));
              const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
              const tab = name => Array.from(document.querySelectorAll('.sl-web__tab'))
                  .find(b => b.textContent.trim() === name);
              const visible = () => Array.from(document.querySelectorAll('.sl-web__editor'))
                  .find(t => t.offsetParent !== null);
              tab('HTML').click(); await wait(150);
              let area = visible();
              set.call(area, '<html><head><title>mine</title></head><body><h1>Unclosed');
              area.dispatchEvent(new Event('input', { bubbles: true }));
              tab('CSS').click(); await wait(150);
              area = visible();
              set.call(area, 'h1 { color: rgb(9, 8, 7); }');
              area.dispatchEvent(new Event('input', { bubbles: true }));
              await wait(1200);
              const doc = document.querySelector('.sl-web__frame').getAttribute('srcdoc') || '';
              return { css: doc.includes('rgb(9, 8, 7)'), shim: doc.includes('sfsLab'),
                       own: doc.includes('<title>mine</title>') };
            })()`);
            assert('web: a full document with no </body> still gets the CSS and the shim',
                fullDoc?.css && fullDoc?.shim && fullDoc?.own, fullDoc);
        }
        await shot(`web-${width}.png`);
    }

    // ---- Big preview ------------------------------------------------------
    await cdp.send('Emulation.setDeviceMetricsOverride',
        { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `${BASE}?lab=web-01-html&theme=cartwheel&lang=en` });
    await sleep(2200);
    await evaluate(openPane('/web|html/i', '/web|playground/i'));
    await evaluate(`Array.from(document.querySelectorAll('.sl-web .sl-btn'))
        .find(b => /Big preview/.test(b.textContent))?.click()`);
    await sleep(500);
    const big = await evaluate(measure('.sl-web__frame', null));
    assert('web Big preview: the result takes most of the window',
        big && big.frameH >= big.vh * 0.7, big);
    await shot('web-big-1440-light.png');

    assert('nothing threw in the page', thrown.length === 0, thrown);
} finally {
    cdp.close();
    chrome.kill();
}

console.log(failures ? `\n${failures} failed` : '\nAll browser-pane checks passed.');
process.exit(failures ? 1 : 0);
