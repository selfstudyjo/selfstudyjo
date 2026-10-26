/*
  The terminal's full-screen programs, DRIVEN in a real browser.

    npm run build:lab-preview
    npx vite preview --config tools/labs-preview/vite.config.ts --port 8795
    node tools/labs-preview/shoot-term.mjs [outDir]

  Types into the lab's console, opens nano, types and saves with the real keys
  (^O Enter, ^X), opens vi (i, Esc, :wq), pages `man ls` (Space, q), watches
  `top` and a `ping` stream (Ctrl+C), selects output and opens the right-click
  menu - and ASSERTS on each, because a screenshot of a black rectangle is the
  same picture whether the editor drew nothing or was never opened. Keys are
  CDP key events, so they reach the component the way a keyboard does.
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

const port = 9341;
const chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${port}`, '--user-data-dir=' + join(outDir, '.profile-term'),
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
const grid = () => evaluate(`document.querySelector('.sl-ts__grid')?.innerText || ''`);
const transcript = () => evaluate(`document.querySelector('.sl-console__body')?.innerText || ''`);
async function shot(name) {
    const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `term-${name}.png`), Buffer.from(s.data, 'base64'));
}
async function command(line) {
    await evaluate(`(() => { const f = document.querySelector('.sl-console__input'); f.focus(); })()`);
    await type(line);
    await key('Enter');
    await sleep(500);
}

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await cdp.send('Page.navigate', { url: `${BASE}?lab=docker-01-first&theme=andromeda&lang=en` });
await sleep(2600);
// Open the pane holding the terminal.
await evaluate(`(() => {
  const tab = Array.from(document.querySelectorAll('.sl-bench__tab')).find(t => /terminal|shell/i.test(t.textContent || ''));
  tab?.click();
})()`);
await sleep(400);
const visible = await evaluate(`!!document.querySelector('.sl-console__input')`);
check('the lab has a console to type into', visible);

// ---- nano ---------------------------------------------------------------
await command('nano notes.txt');
let g = await grid();
check('nano opens IN the terminal, with its title bar', /GNU nano/.test(g), g);
check('...and the real shortcut bar (^O Write Out, ^X Exit)', /\^O/.test(g) && /\^X/.test(g), g);
await shot('nano-open');
await type('hello from nano');
g = await grid();
check('typing goes into the buffer and marks it Modified', /hello from nano/.test(g) && /Modified/.test(g), g);
await key('o', { ctrl: true });
g = await grid();
check('^O asks "File Name to Write"', /File Name to Write/.test(g), g);
await shot('nano-writeout');
await key('Enter');
await sleep(500);
g = await grid();
check('Enter writes it ("Wrote N lines")', /Wrote \d+ line/.test(g), g);
await key('x', { ctrl: true });
await sleep(400);
const afterNano = await evaluate(`!document.querySelector('.sl-ts')`);
check('^X leaves nano and gives the terminal back', afterNano);
await command('cat notes.txt');
check('the saved text is in the file', /hello from nano/.test(await transcript()), await transcript());

// ---- vi -----------------------------------------------------------------
await command('vi notes.txt');
g = await grid();
check('vi opens in the terminal with ~ rows and the file line', /~/.test(g) && /notes\.txt/.test(g), g);
await type('x');
g = await grid();
check('NORMAL mode: x deletes a character rather than typing it', !/xhello/.test(g), g);
await key('i');
await type('VI ');
await key('Escape');
await shot('vi-edit');
await type(':q');
await key('Enter');
await sleep(200);
g = await grid();
check(':q on a changed file is refused with E37', /E37/.test(g), g);
await type(':wq');
await key('Enter');
await sleep(600);
check(':wq writes and leaves', await evaluate(`!document.querySelector('.sl-ts')`));
await command('cat notes.txt');
check('vi\'s edit is in the file', /VI /.test(await transcript()), await transcript());

// ---- man (pager) ----------------------------------------------------------
await command('man ls');
g = await grid();
check('man ls pages inside the terminal', /LS\(1\)/.test(g) && /NAME/.test(g), g);
await key(' ');
await sleep(150);
g = await grid();
check('Space pages forward', !/^LS\(1\)/.test(g.trim()), g);
await shot('man');
await key('q');
await sleep(300);
check('q quits the pager', await evaluate(`!document.querySelector('.sl-ts')`));

// ---- top (live) -------------------------------------------------------------
await command('top');
await sleep(900);
g = await grid();
check('top draws a live frame', /load average/.test(g) && /PID USER/.test(g), g);
await shot('top');
await key('q');
await sleep(300);
check('q quits top', await evaluate(`!document.querySelector('.sl-ts')`));

// ---- ping (stream) --------------------------------------------------------------
await command('ping 127.0.0.1');
await sleep(1600);
g = await grid();
check('ping streams replies', /icmp_seq=3/.test(g), g);
check('...starting from its first frame (the PING header and icmp_seq=1)', /PING 127.0.0.1/.test(g) && /icmp_seq=1 /.test(g), g);
await shot('ping');
await key('c', { ctrl: true });
await sleep(600);
const t = await transcript();
check('Ctrl+C stops it and the statistics land in the scrollback', /ping statistics/.test(t), t.slice(-400));
check('...with exactly one ^C', (t.match(/\^C/g) || []).length === 1, t.slice(-400));

// ---- select + right-click menu ------------------------------------------------
await evaluate(`(() => {
  const body = document.querySelector('.sl-console__body');
  const range = document.createRange(); const lines = body.querySelectorAll('.sl-console__line--out'); range.selectNodeContents(lines[lines.length - 1] || body);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
})()`);
report.push('  ..   selection before right-click: ' + JSON.stringify(await evaluate(`window.getSelection().toString().slice(0, 60)`)));
const box = await evaluate(`(() => { const r = document.querySelector('.sl-console__body').getBoundingClientRect(); return { x: r.x + 60, y: r.y + 40 }; })()`);
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'right', clickCount: 1 });
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'right', clickCount: 1 });
await sleep(300);
const menu = await evaluate(`(() => { const m = document.querySelector('.sl-termmenu'); if (!m) return null;
  return Array.from(m.querySelectorAll('button')).map(b => (b.textContent || '').trim() + (b.disabled ? ' (off)' : '')); })()`);
check('right-click opens the terminal menu: Copy, Paste, Select all, Clear',
      Array.isArray(menu) && menu.length === 4 && /Copy/.test(menu[0]), JSON.stringify(menu));
check('...and Copy is ENABLED because there is a selection', Array.isArray(menu) && !/off/.test(menu[0]), JSON.stringify(menu));
await shot('menu');

check('nothing threw', thrown.length === 0, thrown.join(' | '));
console.log(report.join('\n'));
console.log(failures ? `\n${failures} FAILED` : '\nPASS');
chrome.kill();
process.exit(failures ? 1 : 0);
