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

const PORT = 8796;
const outDir = resolve(process.argv[2] || 'tools/roadmap-preview/shots');
mkdirSync(outDir, { recursive: true });
const server = await serveDist('tools/roadmap-preview/dist', PORT);
const BASE = process.env.PREVIEW_URL || `http://127.0.0.1:${PORT}/index.html`;

const debugPort = 9337;
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
        msg.error ? w.fail(new Error(`${w.method}: ${msg.error.message}`)) : w.ok(msg.result);
    });
    return {
        ready, on: fn => listeners.push(fn),
        send(method, params = {}) { const m = ++id; socket.send(JSON.stringify({ id: m, method, params })); return new Promise((ok, fail) => pending.set(m, { ok, fail, method })); },
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
    // Right after leaving native full screen the window is still settling
    // and the protocol answers "Internal error"; it succeeds a moment later.
    for (let attempt = 0; ; attempt++) {
        try { await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 }); break; }
        catch (e) { if (attempt >= 8) throw e; await sleep(400); }
    }
    pageErrors = [];
    await cdp.send('Page.navigate', { url: `${BASE}?${query}` });
    await waitFor('document.readyState === "complete" && !!document.querySelector(".rmp")');
}

let failures = 0;
const report = [];
function check(label, ok, detail = '') {
    if (!ok) failures++;
    const line = `${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + detail}`;
    report.push(line);
    console.log(line);
}

const VARIANTS = [
    { id: 'andromeda-en', q: 'theme=andromeda&lang=en' },
    { id: 'cartwheel-en', q: 'theme=cartwheel&lang=en' },
    { id: 'andromeda-ar', q: 'theme=andromeda&lang=ar' },
];
const SIZES = [[1440, 900], [820, 1180], [390, 844]];

// SHOOT_ONLY=fs runs the full-screen section alone, for iterating on it.
const ONLY_FS = process.env.SHOOT_ONLY === "fs";
if (!ONLY_FS) {
for (const [w, h] of SIZES) {
    for (const v of VARIANTS) {
        const tag = `${v.id}-${w}`;
        await open(`${v.q}&path=/roadmaps/rm-ai`, w, h);
        const map = await waitFor('!!document.querySelector(".rm3d__canvas[data-painted]") || !!document.querySelector(".rm2d__svg")', 25000);
        check(`${tag}: a map rendered`, map);
        const is3d = await evaluate('!!document.querySelector(".rm3d__canvas")');
        if (is3d) {
            await sleep(600);
            const variance = await evaluate('document.querySelector(".rm3d__canvas").__sfsSample?.() ?? -1');
            check(`${tag}: the 3D canvas is painted (variance ${variance})`, variance > 40, String(variance));
            await evaluate('document.querySelector(".rm3d").scrollIntoView({block:"start"})');
            await sleep(200);
            await shot(`${tag}-3d`);
        } else {
            check(`${tag}: 3D is available (WebGL in headless)`, false, 'fell back to 2D');
        }
        const probe = await evaluate('window.__probe()');
        check(`${tag}: nothing overflows`, !probe, probe);
        await evaluate('window.scrollTo(0,0)');
        await shot(`${tag}-top`);

        // 2D
        await clickText('.rmp__seg button', '2D');
        const two = await waitFor('!!document.querySelector(".rm2d__node")');
        check(`${tag}: switches to 2D`, two);
        await evaluate('document.querySelector(".rmp__map2d").scrollIntoView({block:"start"})');
        await sleep(200);
        await shot(`${tag}-2d`);
        await click('.rm2d__node:nth-of-type(3)') || await click('.rm2d__node');
        const card = await waitFor('!!document.querySelector(".rmnode")', 3000);
        check(`${tag}: a 2D step opens its detail card`, card);
        if (card) {
            await evaluate('document.querySelector(".rmnode").scrollIntoView({block:"center"})');
            await sleep(150);
            await shot(`${tag}-card`);
            // Press whichever mark is NOT on, and expect it to come back on.
            const which = await evaluate('document.querySelector(".rmnode__sbtn.is-done").getAttribute("aria-pressed") === "true" ? "is-doing" : "is-done"');
            const pressed = await click(`.rmnode__sbtn.${which}`);
            const marked = await waitFor(`document.querySelector(".rmnode__sbtn.${which}")?.getAttribute("aria-pressed") === "true"`, 3000);
            check(`${tag}: marking a step done sticks`, pressed && marked);
        }
        const probe2 = await evaluate('window.__probe()');
        check(`${tag}: 2D view overflows nothing`, !probe2, probe2);

        // Back to 3D, open a step from the list, play the tour.
        if (is3d) {
            await clickText('.rmp__seg button', '3D');
            await waitFor('!!document.querySelector(".rm3d__canvas[data-painted]")', 20000);
            await click('.rmp__step');
            const card3 = await waitFor('!!document.querySelector(".rmnode")', 3000);
            check(`${tag}: a step picked in 3D opens its card`, card3);
            await evaluate('document.querySelector(".rmp__tourbtn").click()');
            const caption = await waitFor('!!document.querySelector(".rm3d__caption")', 5000);
            check(`${tag}: the tour shows a stage caption`, caption);
            if (w === 1440) {
                await evaluate('document.querySelector(".rm3d").scrollIntoView({block:"start"})');
                await sleep(300);
                await shot(`${tag}-tour`);
            }
            await evaluate('document.querySelector(".rmp__tourbtn").click()');
        }
        check(`${tag}: no page errors`, pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    }

    // The catalogue and the preview, one galaxy per width.
    await open(`theme=andromeda&lang=en&path=/roadmaps`, w, h);
    const cat = await waitFor('document.querySelectorAll(".rmp__spec").length > 5', 10000);
    check(`catalogue-${w}: the catalogue renders`, cat);
    await shot(`catalogue-${w}`);
    const probe3 = await evaluate('window.__probe()');
    check(`catalogue-${w}: nothing overflows`, !probe3, probe3);
    await click('.rmp__spec');
    const prev = await waitFor('!!document.querySelector(".rmp__previewbar")', 8000);
    check(`catalogue-${w}: a specialization opens its preview`, prev);
    await sleep(500);
    await evaluate('window.scrollTo(0,0)');
    await shot(`preview-${w}`);
    await clickText('.rmp__tabs button', '');
}

// The three states a visitor can meet before any map.
for (const [name, q] of [['signedout', 'signedout=1'], ['unavailable', 'state=unavailable'], ['unconfigured', 'state=unconfigured'], ['empty', 'empty=1']]) {
    await open(`theme=andromeda&lang=en&${q}`, 390, 844);
    await sleep(700);
    await shot(`state-${name}`);
    const text = await evaluate('document.querySelector(".rmp")?.innerText || ""');
    const want = { signedout: 'Sign in or register', unavailable: 'not available yet', unconfigured: 'not set up yet', empty: 'not made a roadmap yet' }[name];
    check(`state ${name}: says so`, text.includes(want), text.slice(0, 120));
}

// Creating one with AI shows the progress state, then the new map.
await open('theme=andromeda&lang=en&empty=1', 1440, 900);
await waitFor('!!document.querySelector(".rmp__tabs")');
await evaluate('document.querySelectorAll(".rmp__tabs button")[1].click()');
await sleep(150);
await evaluate(`(() => { const i = document.querySelector('.rmp__custom input'); i.value = 'Cloud Security Engineer'; i.dispatchEvent(new Event('input')); })()`);
await sleep(100);
await click('.rmp__custom button[type=submit]');
const progress = await waitFor('!!document.querySelector(".rmp__creating")', 2000);
check('create: shows the progress state', progress);
await shot('create-progress');
const made = await waitFor('!!document.querySelector(".rmp__doctitle")', 15000);
check('create: the new roadmap opens', made);
} // not SHOOT_ONLY=fs

/*
  FULL SCREEN, in both mechanisms. The button is pressed with a REAL input
  event (Input.dispatchMouseEvent), because requestFullscreen needs a user
  gesture and a synthetic el.click() is not one - it would silently test the
  overlay twice. The overlay run removes the API first, which is what iPhone
  Safari and a refusing iframe look like.

  Asserted in each: the shell covers the viewport; the 3D renderer was resized
  to it (drawing buffer aspect = displayed aspect, and it is tall) and is still
  painted; 2D and the tour still work inside it; a step's card opens INSIDE the
  full-screen element and is the topmost thing at its own centre; and leaving
  (Escape, or the exit button) puts the map back at its page size, resized.
*/
async function realClick(sel) {
    const r = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({block:'center'}); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    if (!r) return false;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
    return true;
}
async function pressEscape() {
    const k = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
    // Leaving native full screen resizes the page mid-event, and the
    // protocol can answer "Internal error" for the key-up; the outcome is
    // asserted afterwards, so a transport hiccup here is not a verdict.
    try { await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...k }); } catch { /* see above */ }
    try { await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k }); } catch { /* see above */ }
}
const CANVAS_FITS = `(() => { const c = document.querySelector('.rm3d__canvas'); if (!c || !c.clientWidth || !c.clientHeight) return false;
    return Math.abs(c.width / c.height - c.clientWidth / c.clientHeight) < 0.03; })()`;
const SHELL_COVERS = `(() => { const s = document.querySelector('.rmp__shell'); const b = s.getBoundingClientRect();
    return Math.abs(b.left) < 2 && Math.abs(b.top) < 2 && Math.abs(b.width - innerWidth) < 3 && Math.abs(b.height - innerHeight) < 3; })()`;
const CARD_ON_TOP = `(() => { const s = document.querySelector('.rmp__shell'); const c = document.querySelector('.rmnode'); if (!s || !c) return 'no card';
    if (!s.contains(c)) return 'card outside the full-screen element';
    const b = c.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(40, b.height / 2));
    return hit && c.contains(hit) ? '' : 'something covers the card: ' + (hit?.className?.baseVal ?? hit?.className); })()`;

for (const [fsMode, w, h] of [['native', 1440, 900], ['overlay', 1440, 900], ['overlay', 390, 844], ['native', 820, 1180]]) {
    const tag = `fs-${fsMode}-${w}`;
    await open(`theme=${w === 820 ? 'cartwheel' : 'andromeda'}&lang=${w === 390 ? 'ar' : 'en'}&path=/roadmaps/rm-ai`, w, h);
    await waitFor('!!document.querySelector(".rm3d__canvas[data-painted]")', 25000);
    if (fsMode === 'overlay') {
        await evaluate(`Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true }), true`);
    }
    const pageH = await evaluate('document.querySelector(".rm3d__canvas").clientHeight');
    await realClick('.rmp__fsbtn');
    const entered = await waitFor('!!document.querySelector(".rmp__shell.is-full")', 5000);
    check(`${tag}: the Full screen button enters full screen`, entered);
    if (!entered) continue;
    const mech = await evaluate(`document.fullscreenElement === document.querySelector('.rmp__shell') ? 'native'
        : document.querySelector('.rmp__shell.is-overlay') && !document.fullscreenElement ? 'overlay' : 'neither'`);
    check(`${tag}: it used the ${fsMode} mechanism`, mech === fsMode, mech);
    await sleep(500);
    check(`${tag}: the map shell covers the viewport`, await evaluate(SHELL_COVERS));
    const fitted = await waitFor(`${CANVAS_FITS} && document.querySelector('.rm3d__canvas').clientHeight > innerHeight * 0.6`, 4000);
    check(`${tag}: the 3D renderer was resized to full screen`, fitted,
        await evaluate('(() => { const c = document.querySelector(".rm3d__canvas"); return `${c.width}x${c.height} for ${c.clientWidth}x${c.clientHeight}`; })()'));
    const v = await evaluate('document.querySelector(".rm3d__canvas").__sfsSample?.() ?? -1');
    check(`${tag}: and is painted (variance ${v})`, v > 40, String(v));
    check(`${tag}: the 2D/3D toggle, Play tour and the exit button are there`,
        await evaluate('!!document.querySelector(".rmp__shell .rmp__seg") && !!document.querySelector(".rmp__shell .rmp__tourbtn") && !!document.querySelector(".rmp__shell .rmp__fsexit")'));
    await shot(`${tag}-3d`);

    await click('.rmp__tourbtn');
    check(`${tag}: the tour runs in full screen`, await waitFor('!!document.querySelector(".rm3d__caption")', 5000));
    await click('.rmp__tourbtn');

    await clickText('.rmp__shell .rmp__seg button', '2D');
    check(`${tag}: switches to 2D inside full screen`, await waitFor('!!document.querySelector(".rmp__shell.is-full .rm2d__node")', 4000));
    check(`${tag}: the 2D map fills the screen`, await evaluate(`(() => { const m = document.querySelector('.rmp__map2d').getBoundingClientRect(); return m.height > innerHeight * 0.6; })()`));
    await click('.rm2d__node:nth-of-type(4)') || await click('.rm2d__node');
    const card = await waitFor('!!document.querySelector(".rmnode")', 3000);
    await sleep(400);
    const onTop = card ? await evaluate(CARD_ON_TOP) : 'no card';
    check(`${tag}: a step's card opens inside the full-screen element, on top`, onTop === '', onTop);
    await shot(`${tag}-2d-card`);

    await clickText('.rmp__shell .rmp__seg button', '3D');
    await waitFor('!!document.querySelector(".rm3d__canvas[data-painted]")', 20000);
    await sleep(400);
    check(`${tag}: back in 3D the renderer fills the screen`, await waitFor(`${CANVAS_FITS} && document.querySelector('.rm3d__canvas').clientHeight > innerHeight * 0.6`, 4000));

    // Leave: Escape first; the exit button if the browser kept Escape for itself.
    await evaluate('document.activeElement?.blur?.()');
    await pressEscape();
    let left = await waitFor('!document.querySelector(".rmp__shell.is-full")', 2500);
    let how = 'Escape';
    if (!left) { await realClick('.rmp__fsexit'); left = await waitFor('!document.querySelector(".rmp__shell.is-full")', 2500); how = 'the exit button'; }
    check(`${tag}: ${how} leaves full screen`, left && (fsMode === 'native' || how === 'Escape'));
    await sleep(500);
    const back = await evaluate('document.querySelector(".rm3d__canvas")?.clientHeight ?? 0');
    check(`${tag}: the map is back at its page size and resized`, Math.abs(back - pageH) < 4 && await evaluate(CANVAS_FITS), `${back} vs ${pageH}`);
    check(`${tag}: no page errors`, pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
}
await evaluate(`delete Document.prototype.fullscreenEnabled`).catch(() => {});

if (!ONLY_FS) {
// With motion ON: the intro (the journey drawing itself on, stages rising,
// the camera flying in), the travelling pulse and a tour, once - stills are
// all reduced-motion, so this is the only pass that runs the animation code.
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await open('theme=andromeda&lang=en&path=/roadmaps/rm-ai', 1440, 900);
await waitFor('!!document.querySelector(".rm3d__canvas[data-painted]")', 25000);
await evaluate('document.querySelector(".rm3d").scrollIntoView({block:"start"})');
await sleep(800);
await shot('motion-intro');
await sleep(3500);
const settled = await evaluate('document.querySelector(".rm3d__canvas").__sfsSample?.() ?? -1');
check(`motion: the animated 3D map is painted (variance ${settled})`, settled > 40, String(settled));
await shot('motion-settled');
await evaluate('document.querySelector(".rmp__tourbtn").click()');
await sleep(2500);
check('motion: the tour flies to a stage', await evaluate('!!document.querySelector(".rm3d__caption")'));
await shot('motion-tour');
await clickText('.rmp__seg button', '2D');
await sleep(1200);
await shot('motion-2d-reveal');
check('motion: no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} // not SHOOT_ONLY=fs

console.log(failures ? `\n${failures} FAILED` : '\nPASS');
writeFileSync(join(outDir, 'report.txt'), report.join('\n'));
cdp.close();
chrome.kill();
await server?.close();
process.exit(failures ? 1 : 0);
