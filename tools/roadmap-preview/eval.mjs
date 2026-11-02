// Drive and photograph the Roadmap Provider preview in headless Chrome.
//
//   npm run shoot:roadmap          (builds, serves dist on 8796, drives, shoots)
//
// It ASSERTS as well as photographs, because a picture of a blank canvas looks
// the same whether WebGL rendered nothing or the scene was never built:
//
//   * the 3D canvas is PAINTED - its pixel variance is read back through the
//     scene's own sample() (readPixels right after a render), and a flat frame
//     fails;
//   * 2D/3D switch, a step opens its detail card, the tour shows a stage
//     caption, and the catalogue preview opens;
//   * no page exception, no console error;
//   * nothing overflows the viewport (rects clipped by their ancestors first).
//
// Two camera lessons carried over from tools/home-preview: a real narrow
// viewport needs Emulation.setDeviceMetricsOverride (--window-size crops), and
// stills are taken with prefers-reduced-motion emulated so every frame is the
// settled one.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveDist } from '../leaderboard-preview/serve.mjs';

const CHROME = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => existsSync(p));
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1); }

const PORT = 8797;
const outDir = resolve('tools/roadmap-preview/shots');
mkdirSync(outDir, { recursive: true });
const server = await serveDist('tools/roadmap-preview/dist', PORT);
const BASE = process.env.PREVIEW_URL || `http://127.0.0.1:${PORT}/index.html`;

const debugPort = 9338;
const chrome = spawn(CHROME, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    `--remote-debugging-port=${debugPort}`, '--user-data-dir=' + join(outDir, '.profile'), 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function target() {
    for (let i = 0; i < 80; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
            const page = list.find(t => t.type === 'page');
            if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
        } catch { /* not yet */ }
        await sleep(250);
    }
    throw new Error('Chrome never opened its debugging port');
}
function connect(url) {
    const socket = new WebSocket(url);
    const pending = new Map();
    const listeners = [];
    let id = 0;
    const ready = new Promise((ok, fail) => { socket.addEventListener('open', () => ok()); socket.addEventListener('error', fail); });
    socket.addEventListener('message', ev => {
        const msg = JSON.parse(ev.data);
        if (msg.method) listeners.forEach(l => l(msg));
        const w = pending.get(msg.id);
        if (!w) return;
        pending.delete(msg.id);
        msg.error ? w.fail(new Error(msg.error.message)) : w.ok(msg.result);
    });
    return {
        ready, on: fn => listeners.push(fn),
        send(method, params = {}) { const m = ++id; socket.send(JSON.stringify({ id: m, method, params })); return new Promise((ok, fail) => pending.set(m, { ok, fail })); },
        close: () => socket.close(),
    };
}

const cdp = connect(await target());
await cdp.ready;
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

let pageErrors = [];
cdp.on(msg => {
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        pageErrors.push(msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
});

const evaluate = async expr => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
};
async function waitFor(expr, ms = 20000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        try { if (await evaluate(expr)) return true; } catch { /* page navigating */ }
        await sleep(150);
    }
    return false;
}
const click = sel => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.scrollIntoView({block:'center'}); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`);
const clickText = (sel, text) => evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);

async function shot(name) {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(r.data, 'base64'));
}
async function open(query, width, height) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    pageErrors = [];
    await cdp.send('Page.navigate', { url: `${BASE}?${query}` });
    await waitFor('document.readyState === "complete" && !!document.querySelector(".rmp")');
}


// Debug helper: node tools/roadmap-preview/eval.mjs "<query>" "<expression>" [width]
const [q, expr, wArg] = process.argv.slice(2);
await open(q, Number(wArg || 1440), 900);
await sleep(2500);
try { console.log(JSON.stringify(await evaluate(expr), null, 1)); } catch (e) { console.log('ERR', e.message); }
console.log('errors:', pageErrors);
cdp.close(); chrome.kill(); await server?.close(); process.exit(0);
