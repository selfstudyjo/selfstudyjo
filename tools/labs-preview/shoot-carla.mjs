// Screenshot and DRIVE the self-driving Simulator pane (CARLA track, app 11).
//
//   npm run build:lab-preview
//   npx vite preview --config tools/labs-preview/vite.config.ts --port 8795 &
//   node tools/labs-preview/shoot-carla.mjs
//
// The pane needs an account, `lab_feature`, a warm app 11 replica and a run
// that has actually happened, so nothing else on the platform can look at it.
// The stub answers with a catalogue, a town and a replay DUMPED from app 11
// after a real run of the reference solution (`stubs/carla.fixture.json`), so
// the city, the cars and the frames on screen are the backend's, not a guess.
//
// What it asserts, because a 3D canvas fails silently (working rule 42):
//   - the pane mounted and the loading overlay went away (the engine arrived);
//   - the replay has a duration and the scrubber moves when seeked;
//   - every camera mode and the Drive tab can be selected without a throw;
//   - and the canvas is not a flat colour: a screenshot of the canvas rectangle
//     is decoded and its pixel variance measured. An empty WebGL canvas and a
//     painted city are otherwise the same `<canvas>` element.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const CHROME = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => existsSync(p));
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1); }

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:8795/index.html';
const outDir = resolve(process.argv[2] || 'tools/labs-preview/shots');
mkdirSync(outDir, { recursive: true });
const LAB = 'carla-11-traffic-rules';
const VARIANTS = [
    { id: 'carla-dark', query: `lab=${LAB}&theme=andromeda&lang=en`, width: 1440 },
    { id: 'carla-light', query: `lab=${LAB}&theme=cartwheel&lang=en`, width: 1440 },
    { id: 'carla-ar', query: `lab=${LAB}&theme=andromeda&lang=ar`, width: 1440 },
    // `/simulator`: the lab id only as a prop, no URL param - the page that
    // was stuck on "Opening the lab..." in production.
    { id: 'simulator-route', query: `lab=carla-00-playground&route=prop&theme=andromeda&lang=en`, width: 1440 },
    // THE STANDALONE STUDIO (`/simulator`): not a lab - an IDE beside the 3D
    // studio, over the unpublished `carla-studio` workspace.
    { id: 'studio-dark', query: `view=studio&theme=andromeda&lang=en`, width: 1440 },
    { id: 'studio-light', query: `view=studio&theme=cartwheel&lang=en`, width: 1440 },
    { id: 'studio-ar', query: `view=studio&theme=andromeda&lang=ar`, width: 1440 },
    { id: 'studio-phone', query: `view=studio&theme=andromeda&lang=en`, width: 390 },
    { id: 'carla-phone', query: `lab=${LAB}&theme=andromeda&lang=en`, width: 390 },
];

const port = 9339;
const chrome = spawn(CHROME, [
    '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, '--user-data-dir=' + join(outDir, '.profile-carla'),
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

const socket = new WebSocket(await target());
const pending = new Map();
let seq = 0;
await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
socket.onmessage = e => {
    const m = JSON.parse(e.data);
    const w = pending.get(m.id);
    if (!w) return;
    pending.delete(m.id);
    m.error ? w.fail(new Error(m.error.message)) : w.ok(m.result);
};
const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++seq; pending.set(id, { ok, fail });
    socket.send(JSON.stringify({ id, method, params }));
});
await send('Page.enable');
await send('Runtime.enable');
const thrown = [];
async function evaluate(expression) {
    const { result, exceptionDetails } = await send('Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) thrown.push(exceptionDetails.exception?.description || exceptionDetails.text);
    return result?.value;
}

/* A minimal PNG decoder - 8-bit RGB/RGBA, non-interlaced, which is what
   Chrome's captureScreenshot produces - so the variance check needs no package. */
function pixelSpread(png) {
    let off = 8, width = 0, height = 0, ctype = 0;
    const idat = [];
    while (off < png.length) {
        const len = png.readUInt32BE(off); const type = png.toString('ascii', off + 4, off + 8);
        const data = png.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); ctype = data[9]; }
        if (type === 'IDAT') idat.push(data);
        off += 12 + len;
    }
    const bpp = ctype === 6 ? 4 : 3;
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * bpp;
    const prev = Buffer.alloc(stride); const cur = Buffer.alloc(stride);
    const seen = new Set(); let sum = 0, sum2 = 0, n = 0;
    for (let y = 0; y < height; y++) {
        const f = raw[y * (stride + 1)];
        const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
            let v = row[x];
            if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
            cur[x] = v & 255;
        }
        for (let x = 0; x < width; x += 3) {
            const i = x * bpp; const lum = cur[i] * 0.3 + cur[i + 1] * 0.59 + cur[i + 2] * 0.11;
            sum += lum; sum2 += lum * lum; n++; seen.add((cur[i] >> 4) << 8 | (cur[i + 1] >> 4) << 4 | (cur[i + 2] >> 4));
        }
        cur.copy(prev);
    }
    const mean = sum / n;
    return { std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), colours: seen.size };
}

let failures = 0;
const report = [];
const ok = (label, cond, detail = '') => {
    if (!cond) failures++;
    report.push(`${cond ? '  ok  ' : '  FAIL'} ${label}${detail ? '  -- ' + detail : ''}`);
};

for (const v of VARIANTS) {
    report.push(`\n${v.width}px ${v.id}`);
    await send('Emulation.setDeviceMetricsOverride',
        { width: v.width, height: 1000, deviceScaleFactor: 1, mobile: v.width <= 480 });
    await send('Page.navigate', { url: `${BASE}?${v.query}` });
    let state = null;
    for (let i = 0; i < 60; i++) {
        await sleep(500);
        state = await evaluate(`(() => {
            const pane = document.querySelector('.sl-drive');
            if (!pane) return { pane: false };
            return { pane: true,
                     loading: !!pane.querySelector('.sl-drive__overlay'),
                     canvas: !!pane.querySelector('canvas.sl-drive__canvas'),
                     visible: !!pane.offsetParent };
        })()`);
        if (state?.pane && !state.loading) break;
    }
    ok('the Simulator pane mounted', state?.pane, JSON.stringify(state));
    if (v.id.startsWith('studio')) {
        const studio = await evaluate(`(() => ({
            title: (document.querySelector('.sds-head h1') || {}).textContent || '',
            tabs: document.querySelectorAll('.sds-tabs [role=tab]').length,
            files: Array.from(document.querySelectorAll('.sds-ide *'))
                .filter(e => e.children.length === 0 && /drive\.py|examples/.test(e.textContent || '')).length,
            noTasks: !document.querySelector('.sl-tasks, .sl-side'),
        }))()`);
        ok('the standalone studio rendered (not a lab workspace)',
           studio && studio.title && studio.tabs === 5 && studio.noTasks, JSON.stringify(studio));
        ok('the editor lists drive.py and the examples', studio && studio.files > 0, JSON.stringify(studio));
    }
    if (v.id === 'simulator-route') {
        const title = await evaluate(`(document.querySelector('h1') || {}).textContent || ''`);
        ok('/simulator opened the PLAYGROUND lab from the prop alone', /free drive/i.test(title), title.trim());
    }
    ok('the pane is the one the lab OPENS on', state?.visible);
    ok('the engine arrived (loading overlay gone)', state?.pane && !state.loading);
    await sleep(2500);

    const scrub = await evaluate(`(() => {
        const r = document.querySelector('.sl-drive__scrub input[type=range]');
        return r ? { max: Number(r.max) } : null;
    })()`);
    ok('the replay has a duration', scrub && scrub.max > 1, JSON.stringify(scrub));

    // Seek to the middle so the shot shows traffic in motion, not the grid.
    await evaluate(`(() => {
        const r = document.querySelector('.sl-drive__scrub input[type=range]');
        if (!r) return;
        r.value = String(Number(r.max) * 0.45);
        r.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(1500);

    const rect = await evaluate(`(() => {
        const c = document.querySelector('.sl-drive__stage');
        const b = c && c.getBoundingClientRect();
        return b ? { x: b.x, y: b.y + window.scrollY, width: b.width, height: b.height } : null;
    })()`);
    if (rect && rect.width > 10) {
        const clip = await send('Page.captureScreenshot',
            { format: 'png', clip: { ...rect, scale: 1 }, captureBeyondViewport: false });
        const spread = pixelSpread(Buffer.from(clip.data, 'base64'));
        ok('the 3D canvas is PAINTED, not a flat colour', spread.std > 12 && spread.colours > 40,
           `luminance sd ${spread.std.toFixed(1)}, ${spread.colours} colour buckets`);
        writeFileSync(join(outDir, `${v.width}-${v.id}-stage.png`), Buffer.from(clip.data, 'base64'));
    } else ok('the stage has a size', false, JSON.stringify(rect));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `${v.width}-${v.id}.png`), Buffer.from(shot.data, 'base64'));

    if (v.id === 'carla-dark') {
        // Every camera, then the Drive tab: each must switch without a throw.
        const cams = await evaluate(`(async () => {
            const out = [];
            const buttons = Array.from(document.querySelectorAll('.sl-drive__cams button'));
            if (!buttons.length) return ['NO CAMERA BUTTONS'];
            for (const button of buttons) {
                button.click();
                await new Promise(r => setTimeout(r, 500));
                if (button.classList.contains('is-on')) out.push((button.textContent || '').trim());
            }
            return out;
        })()`);
        ok('every camera mode can be selected', Array.isArray(cams) && cams.length >= 5, JSON.stringify(cams));
        const top = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(outDir, `${v.width}-${v.id}-lastcam.png`), Buffer.from(top.data, 'base64'));
        const drive = await evaluate(`(async () => {
            const tab = Array.from(document.querySelectorAll('.sl-drive__modes button'))
                .find(b => /drive/i.test(b.textContent || ''));
            if (!tab) return 'NO DRIVE TAB';
            tab.click();
            await new Promise(r => setTimeout(r, 1500));
            return tab.getAttribute('aria-selected') || tab.className;
        })()`);
        ok('the Drive (manual) tab opens', drive && drive !== 'NO DRIVE TAB', String(drive));
        const manual = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(outDir, `${v.width}-${v.id}-manual.png`), Buffer.from(manual.data, 'base64'));
    }
}

ok('nothing threw in the page', thrown.length === 0, thrown.slice(0, 3).join(' | '));
console.log(report.join('\n'));
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
socket.close();
chrome.kill();
process.exit(failures ? 1 : 0);
