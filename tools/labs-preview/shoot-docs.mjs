/*
  The Definitions window and the task window's GUI walkthrough, DRIVEN in a real browser.

    npm run build:lab-preview
    npx vite preview --config tools/labs-preview/vite.config.ts --port 8795
    node tools/labs-preview/shoot-docs.mjs [outDir]

  Opens fab-01-platform, presses Definitions, walks every section, opens a
  term, and ASSERTS on what rendered: a flow diagram with nodes, a 3D canvas
  that is PAINTED (pixel variance, because an empty WebGL canvas and an
  illustration are the same <canvas> element), then opens a task's
  information window, switches to the GUI tab and checks the walkthrough has
  steps and its monitor is painted. 1440 wide and 390 wide.
*/
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
];
const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:8795/index.html';
const outDir = resolve(process.argv[2] || 'tools/labs-preview/shots');
const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) { console.error('No Chrome or Edge found.'); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const port = 9343;
const chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${port}`, '--user-data-dir=' + join(outDir, '.profile-docs'),
    'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function target() {
    for (let i = 0; i < 60; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            const page = list.find(t => t.type === 'page');
            if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
        } catch { /* not up */ }
        await sleep(250);
    }
    throw new Error('Chrome never opened its debugging port');
}
function connect(url) {
    const socket = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    const ready = new Promise((ok, fail) => { socket.addEventListener('open', ok); socket.addEventListener('error', fail); });
    socket.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        const w = pending.get(m.id);
        if (!w) return;
        pending.delete(m.id);
        m.error ? w.fail(new Error(m.error.message)) : w.ok(m.result);
    });
    return { ready, send(method, params = {}) {
        const mine = ++id;
        socket.send(JSON.stringify({ id: mine, method, params }));
        return new Promise((ok, fail) => pending.set(mine, { ok, fail }));
    } };
}

const cdp = connect(await target());
await cdp.ready;
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
const thrown = [];
async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) thrown.push(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
    return result?.value;
}

const SPECIAL = { Enter: 13, Escape: 27, Backspace: 8, Tab: 9, ' ': 32, ArrowDown: 40, ArrowUp: 38 };
async function key(name, mods = {}) {
    const modifiers = (mods.alt ? 1 : 0) | (mods.ctrl ? 2 : 0) | (mods.shift ? 8 : 0);
    const single = name.length === 1;
    const code = SPECIAL[name] ?? (single && /[a-z0-9]/i.test(name) ? name.toUpperCase().charCodeAt(0) : 0);
    const text = single && !mods.ctrl ? name : (name === 'Enter' ? '\r' : undefined);
    await cdp.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: name,
        windowsVirtualKeyCode: code, modifiers, text, unmodifiedText: text });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, windowsVirtualKeyCode: code, modifiers });
    await sleep(25);
}
async function type(text) { for (const ch of text) await key(ch); }

let failures = 0;
const report = [];
function check(label, ok, detail = '') {
    report.push(`${ok ? '  ok  ' : '  FAIL'}  ${label}${ok ? '' : '  -- ' + String(detail).slice(0, 300)}`);
    if (!ok) failures++;
}

async function shot(name) {
    const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `docs-${name}.png`), Buffer.from(s.data, 'base64'));
}
async function click(selector) {
    return evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
}
async function clickText(selector, text) {
    return evaluate(`(() => { const el = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e => (e.textContent || '').includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
}
async function waitFor(expr, ms = 8000) {
    for (let t = 0; t < ms; t += 200) { if (await evaluate(expr)) return true; await sleep(200); }
    return false;
}
/* Pixel variance of a WebGL canvas, read back through a 2D copy. */
const painted = sel => evaluate(`(() => { const c = document.querySelector(${JSON.stringify(sel)}); if (!c || !c.width) return -1;
  const k = document.createElement('canvas'); k.width = 64; k.height = 36; const x = k.getContext('2d'); x.drawImage(c, 0, 0, 64, 36);
  const d = x.getImageData(0, 0, 64, 36).data; let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; s += v; s2 += v * v; n++; } return s2 / n - (s / n) ** 2; })()`);

for (const [w, h] of [[1440, 900], [390, 844]]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await cdp.send('Page.navigate', { url: `${BASE}?lab=fab-01-platform` });
    check(`${w}: the workspace opened`, await waitFor(`!!document.querySelector('.sl-defs-card')`, 12000));
    await click('.sl-defs-card .sl-btn');
    check(`${w}: Definitions opened and loaded`, await waitFor(`!!document.querySelector('.sld__article')`));
    const about = await evaluate(`document.querySelector('.sld__article')?.innerText || ''`);
    check(`${w}: About shows the lab story and what you will learn`, /About this lab/.test(about) && about.length > 300, about.slice(0, 200));
    const termCount = await evaluate(`document.querySelectorAll('.sld__toc--terms button').length`);
    if (w > 600) check(`${w}: key terms are listed`, termCount >= 6, termCount);
    await shot(`${w}-about`);
    // The platform section.
    if (w > 600) await clickText('.sld__toc button', 'What is'); else await evaluate(`(() => { const s = document.querySelector('.sld__mobile'); s.value = 'platform'; s.dispatchEvent(new Event('change')); })()`);
    check(`${w}: the platform section explains the product`, await waitFor(`/What is/.test(document.querySelector('.sld__article h3')?.textContent || '')`));
    await waitFor(`!!document.querySelector('.scs__canvas')`, 4000);
    await sleep(2500);
    check(`${w}: the platform illustration is painted`, (await painted('.scs__canvas')) > 20, await painted('.scs__canvas'));
    check(`${w}: the architecture diagram has nodes`, (await evaluate(`document.querySelectorAll('.sfd__node').length`)) >= 3);
    await shot(`${w}-platform`);
    // The flow.
    if (w > 600) { await clickText('.sld__toc button', 'How this lab flows');
        check(`${w}: the lab flow draws every task`, await waitFor(`document.querySelectorAll('.sfd__node').length >= 4`)); await shot(`${w}-flow`); }
    // One term.
    if (w > 600) await click('.sld__toc--terms button'); else await evaluate(`(() => { const s = document.querySelector('.sld__mobile'); const o = Array.from(s.options).find(o => o.value.startsWith('term:')); s.value = o.value; s.dispatchEvent(new Event('change')); })()`);
    check(`${w}: a term shows its definition`, await waitFor(`!!document.querySelector('.sld__lead') && !!document.querySelector('.sld__cat')`));
    await sleep(2500);
    check(`${w}: the term's 3D illustration is painted`, (await painted('.scs__canvas')) > 20, await painted('.scs__canvas'));
    check(`${w}: the term's diagram has nodes`, (await evaluate(`document.querySelectorAll('.sfd__node').length`)) >= 2);
    const overflow = await evaluate(`document.querySelector('.sld').scrollWidth - document.querySelector('.sld').clientWidth`);
    check(`${w}: the window does not scroll sideways`, overflow <= 1, overflow);
    await shot(`${w}-term`);
    await click('.sld__close');
    // The task window, GUI tab.
    if (w < 600) { await clickText('.sl-bench__tab, button', 'Tasks'); await sleep(300); }
    const opened = await evaluate(`(() => { const b = document.querySelector('.sl-task__info, [aria-label*="How to do"], button[title*="nfo"]'); if (!b) return false; b.click(); return true; })()`);
    check(`${w}: a task's information window opened`, opened && await waitFor(`!!document.querySelector('.sltg-dialog')`));
    await clickText('.sltg-tab', 'GUI');
    check(`${w}: the GUI tab shows a walkthrough with steps`, await waitFor(`document.querySelectorAll('.sgw__step').length >= 2`, 8000),
        await evaluate(`document.querySelector('.stg')?.innerText?.slice(0, 200) || ''`));
    await sleep(3000);
    check(`${w}: the walkthrough monitor is painted`, (await painted('.sgw__canvas')) > 20, await painted('.sgw__canvas'));
    const active = await evaluate(`Array.from(document.querySelectorAll('.sgw__steps li')).findIndex(li => li.classList.contains('is-active'))`);
    check(`${w}: the animation advances through the steps`, active >= 1, active);
    await shot(`${w}-gui`);
    await clickText('.sltg-tab', 'Terminal');
    check(`${w}: the Terminal tab keeps the written steps`, await waitFor(`!!document.querySelector('.sltg-steps')`));
    await click('.sltg-close');
}

check('nothing threw', thrown.length === 0, thrown.join(' | '));
console.log(report.join('\n'));
console.log(failures ? `\n${failures} FAILED` : '\nPASS');
chrome.kill();
process.exit(failures ? 1 : 0);
