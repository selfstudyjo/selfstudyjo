// DRIVE the site search in a real browser, assert on what happened, and
// photograph it.
//
//   npm run build:search-preview && node tools/search-preview/shoot.mjs [outDir]
//
// It types queries, walks the results with the arrow keys and Tab, presses
// Enter and checks where the router went, opens the phone sheet with a real
// click, and closes it with Escape - at 1440 and 390, in a dark galaxy, a light
// galaxy and Arabic, plus a service down and a signed-out visitor. Keys and
// clicks go through `Input.dispatch*`, never `element.click()`, which would
// pass while something covered the control. Every check prints ok/FAIL and the
// exit code is the number of failures.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveDist } from '../assistant-preview/serve.mjs';

const CHROME = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => existsSync(p));
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1); }

const PORT = 8813; // not 8794-8796: the assistant and roadmap harnesses use those
const served = process.env.PREVIEW_URL ? null : await serveDist('tools/search-preview/dist', PORT);
// serveDist answers null when the port is taken - and then we would be shooting
// whatever ELSE is on it (another harness). Refuse rather than report on it.
if (!process.env.PREVIEW_URL && !served) { console.error('Port ' + PORT + ' is in use; set PREVIEW_URL.'); process.exit(1); }
const BASE = process.env.PREVIEW_URL || `http://127.0.0.1:${PORT}/index.html`;
const outDir = resolve(process.argv[2] || 'tools/search-preview/shots');
mkdirSync(outDir, { recursive: true });

const DEBUG = 9363;
const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${join(outDir, '.profile')}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function wsUrl() {
    for (let i = 0; i < 80; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json();
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
    const listeners = [];
    let id = 0;
    const ready = new Promise((ok, fail) => {
        socket.addEventListener('open', () => ok());
        socket.addEventListener('error', fail);
    });
    socket.addEventListener('message', event => {
        const msg = JSON.parse(event.data);
        if (msg.method) { listeners.forEach(l => l(msg)); return; }
        const waiting = pending.get(msg.id);
        if (!waiting) return;
        pending.delete(msg.id);
        msg.error ? waiting.fail(new Error(msg.error.message)) : waiting.ok(msg.result);
    });
    return {
        ready,
        on: fn => listeners.push(fn),
        send(method, params = {}) {
            const mine = ++id;
            socket.send(JSON.stringify({ id: mine, method, params }));
            return new Promise((ok, fail) => pending.set(mine, { ok, fail }));
        },
    };
}

const cdp = connect(await wsUrl());
await cdp.ready;
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
const errors = [];
cdp.on(msg => {
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description || 'exception');
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
});
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

let failures = 0;
let passes = 0;
function check(label, ok, detail = '') {
    if (ok) passes++; else failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

async function js(expression) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'evaluate threw');
    return result.value;
}

async function until(expression, timeout = 8000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        if (await js(expression)) return true;
        await sleep(80);
    }
    return false;
}

const KEYS = {
    ArrowDown: 40, ArrowUp: 38, Enter: 13, Tab: 9, Escape: 27, '/': 191,
};
async function key(name, modifiers = 0) {
    const base = { key: name, code: name === '/' ? 'Slash' : name, windowsVirtualKeyCode: KEYS[name], modifiers };
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
    if (name === '/') await cdp.send('Input.dispatchKeyEvent', { type: 'char', ...base, text: '/' });
    if (name === 'Enter') await cdp.send('Input.dispatchKeyEvent', { type: 'char', ...base, text: '\r' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    await sleep(60);
}
// Past the panel's 110 ms debounce, or the next probe reads the state before the query.
const type = async text => { await cdp.send('Input.insertText', { text }); await sleep(260); };
async function clear() {
    await js(`(() => { const i = document.activeElement; if (i && 'value' in i) { i.select(); } })()`);
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await sleep(150);
}
async function clickSelector(selector) {
    const at = await js(`(() => { const e = document.querySelector(${JSON.stringify(selector)});
        if (!e) return null; const r = e.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    if (!at) return false;
    for (const t of ['mousePressed', 'mouseReleased']) {
        await cdp.send('Input.dispatchMouseEvent', { type: t, x: at[0], y: at[1], button: 'left', clickCount: 1 });
    }
    await sleep(120);
    return true;
}
async function shot(name) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, 'base64'));
}

/** The panel, as the page reports it: sections, rows, the active row, geometry problems. */
const PROBE = `(() => {
  const panel = document.querySelector('.sfs-gs');
  const input = document.activeElement;
  const vw = innerWidth, vh = innerHeight;
  const out = { open: !!panel, sections: [], rows: 0, skeletons: 0, errors: 0, locks: 0,
    active: input?.getAttribute?.('aria-activedescendant') || '', activeText: '',
    focus: input?.className || '', value: input?.value ?? null, problems: [], route: window.__sfsRoute?.() };
  if (!panel) return out;
  out.sections = [...panel.querySelectorAll('.sfs-gs__gtitle')].map(h => h.textContent.trim().replace(/\\s+/g, ' '));
  out.rows = panel.querySelectorAll('.sfs-gs__link').length;
  out.skeletons = panel.querySelectorAll('.sfs-gs__skel').length;
  out.errors = panel.querySelectorAll('.sfs-gs__opt--error').length;
  out.locks = panel.querySelectorAll('.sfs-gs__sub--lock').length;
  out.empty = !!panel.querySelector('.sfs-gs__empty');
  const act = out.active && document.getElementById(out.active);
  out.activeText = act ? act.textContent.trim().replace(/\\s+/g, ' ').slice(0, 80) : '';
  const r = panel.getBoundingClientRect();
  if (r.left < -1 || r.right > vw + 1) out.problems.push('PANEL OFF THE SIDE ' + JSON.stringify([r.left, r.right, vw]));
  if (r.bottom > vh + 1) out.problems.push('PANEL BELOW THE VIEWPORT');
  for (const el of panel.querySelectorAll('.sfs-gs__opt, .sfs-gs__ghead, .sfs-gs__foot')) {
    const b = el.getBoundingClientRect();
    if (b.width && (b.left < r.left - 1 || b.right > r.right + 1)) { out.problems.push('ROW OUTSIDE THE PANEL: ' + el.className); break; }
  }
  const hit = act && act.getBoundingClientRect();
  if (hit && hit.height) {
    const top = document.elementFromPoint(hit.left + hit.width / 2, hit.top + hit.height / 2);
    if (top && !act.contains(top) && !panel.contains(top)) out.problems.push('ACTIVE ROW COVERED');
  }
  return out;
})()`;

const BAR_PROBE = `(() => {
  const bar = document.querySelector('.sfs-topbar__inner');
  if (!bar) return { missing: true };
  const vw = innerWidth; const r = bar.getBoundingClientRect();
  const off = [...bar.children].filter(c => { const b = c.getBoundingClientRect();
    return b.width && (b.right > vw + 1 || b.left < -1); }).map(c => c.className);
  return { height: Math.round(r.height), scroll: bar.scrollWidth - bar.clientWidth, off,
    field: !!(document.querySelector('.sfs-topbar__search')?.offsetWidth),
    button: !!(document.querySelector('.sfs-topbar__searchbtn')?.offsetWidth) };
})()`;

const VARIANTS = [
    { id: 'andromeda-en', q: 'theme=andromeda&lang=en', query: 'docker', native: 'docker' },
    { id: 'cartwheel-en', q: 'theme=cartwheel&lang=en', query: 'linux', native: 'linux' },
    { id: 'andromeda-ar', q: 'theme=andromeda&lang=ar', query: 'docker', native: 'شبكات' },
    { id: 'dawn-zh', q: 'theme=dawn&lang=zh', query: 'python', native: '数据' },
];

async function load(width, q, height = 900) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 });
    await cdp.send('Page.navigate', { url: `${BASE}?${q}` });
    const mounted = await until(`!!document.querySelector('.sfs-topbar__inner')`, 15000);
    await sleep(300);
    return mounted;
}

const waitSettled = () => until(`(() => { const p = document.querySelector('.sfs-gs');
    return p && !p.querySelector('.sfs-gs__skel') && !p.querySelector('.sfs-gs__pending'); })()`, 12000);

/* ───────────────────────── desktop ───────────────────────── */
for (const v of VARIANTS) {
    const width = 1440;
    console.log(`\n${width}px ${v.id}`);
    check('page mounted', await load(width, v.q), errors.slice(0, 3));
    const bar = await js(BAR_PROBE);
    check('the bar fits: nothing off either edge', !bar.off.length && bar.scroll <= 1, bar);
    check('desktop shows the field, not the phone button', bar.field && !bar.button, bar);

    await key('/');
    await until(`!!document.querySelector('.sfs-gs')`, 6000);
    let p = await js(PROBE);
    check('"/" opens the panel and focuses the field', p.open && /sfs-topbar__searchinput/.test(p.focus), p);
    check('...without typing the slash', p.value === '', p.value);
    check('the empty state offers shortcuts', await js(`document.querySelectorAll('.sfs-gs__chip').length >= 4`));
    await shot(`${width}-${v.id}-empty`);

    await type(v.query);
    check('results arrive and settle', await waitSettled(), await js(PROBE));
    p = await js(PROBE);
    check(`"${v.query}" finds rows in several sections`, p.rows >= 6 && p.sections.length >= 3, p.sections);
    check('the best match is active (Enter opens it)', !!p.active && p.activeText.toLowerCase().includes(v.query), [p.active, p.activeText]);
    const startAt = Number(p.active.split('-opt-')[1]);
    check('no geometry problems', !p.problems.length, p.problems);
    check('no locks for a paying reader', p.locks === 0, p.locks);
    await shot(`${width}-${v.id}-results`);

    await key('ArrowDown'); await key('ArrowDown');
    p = await js(PROBE);
    check('↓↓ moves the active row two down', Number(p.active.split('-opt-')[1]) === startAt + 2, [startAt, p.active]);
    const firstSection = await js(`document.getElementById(document.activeElement.getAttribute('aria-activedescendant'))?.closest('section')?.querySelector('.sfs-gs__gtitle')?.textContent`);
    await key('Tab');
    const nextSection = await js(`document.getElementById(document.activeElement.getAttribute('aria-activedescendant'))?.closest('section')?.querySelector('.sfs-gs__gtitle')?.textContent`);
    check('Tab jumps to the next section', !!nextSection && nextSection !== firstSection, [firstSection, nextSection]);
    check('...and focus stays in the field', /sfs-topbar__searchinput/.test((await js(PROBE)).focus));
    const href = await js(`document.getElementById(document.activeElement.getAttribute('aria-activedescendant'))?.querySelector('a')?.getAttribute('href')`);
    await key('Enter');
    await sleep(250);
    p = await js(PROBE);
    check('Enter navigates to the active result and closes the panel',
        !p.open && href && decodeURIComponent(p.route) === decodeURIComponent(href.replace(/^#/, '')), [href, p.route]);

    await key('/');
    await until(`!!document.querySelector('.sfs-gs')`);
    check('the query was cleared after navigating', (await js(PROBE)).value === '');
    check('...and it is now a recent search', await js(`!!document.querySelector('.sfs-gs__opt--recent')`));
    await type(v.native);
    await waitSettled();
    p = await js(PROBE);
    check(`a native-script query ("${v.native}") finds results`, p.rows >= 1, p);
    await shot(`${width}-${v.id}-native`);

    await clear();
    await type('zzqxvkj');
    await waitSettled();
    p = await js(PROBE);
    check('nonsense shows the no-results state', p.empty && p.rows === 0, p);
    await shot(`${width}-${v.id}-none`);

    await key('Escape');
    p = await js(PROBE);
    check('Escape closes the panel and keeps focus in the field', !p.open && /sfs-topbar__searchinput/.test(p.focus), p);
    await key('Escape');
    check('a second Escape clears the field', (await js(PROBE)).value === '');
}

/* ───────────────────────── the bar at every other width ───────────────────────── */
for (const [width, q] of [[2560, VARIANTS[0].q], [1920, VARIANTS[2].q], [1280, VARIANTS[0].q],
    [1024, VARIANTS[2].q], [1024, VARIANTS[3].q], [820, VARIANTS[0].q], [700, VARIANTS[2].q]]) {
    const tag = q.match(/lang=(\w+)/)[1];
    console.log(`\n${width}px bar (${tag})`);
    await load(width, q);
    const bar = await js(BAR_PROBE);
    check('the bar fits: nothing off either edge', !bar.off.length && bar.scroll <= 1, bar);
    check('the field is shown', bar.field && !bar.button, bar);
    await key('/');
    await type('git');
    await waitSettled();
    const p = await js(PROBE);
    check('the dropdown has results and no geometry problems', p.rows >= 1 && !p.problems.length, p);
    await shot(width + '-bar-' + tag);
}

/* ───────────────────────── phone ───────────────────────── */
for (const v of [VARIANTS[0], VARIANTS[2], VARIANTS[1]]) {
    for (const width of [390, 320]) {
        console.log(`\n${width}px ${v.id}`);
        check('page mounted', await load(width, v.q, 844));
        const bar = await js(BAR_PROBE);
        check('phone shows the search button, not the field', bar.button && !bar.field, bar);
        check('the bar fits or scrolls, never clips', !bar.off.length || bar.scroll > 0, bar);
        await shot(`${width}-${v.id}-bar`);
        if (width === 320) continue;

        check('the button is clickable', await clickSelector('.sfs-topbar__searchbtn'));
        await until(`!!document.querySelector('.sfs-gs--sheet')`, 6000);
        let p = await js(PROBE);
        check('the sheet opens and focuses its own field', p.open && /sfs-gs__input/.test(p.focus), p);
        const full = await js(`(() => { const r = document.querySelector('.sfs-gs--sheet').getBoundingClientRect();
            return r.left <= 0 && r.top <= 0 && r.right >= innerWidth - 1 && r.bottom >= innerHeight - 1; })()`);
        check('the sheet covers the screen', full);
        await type(v.query);
        await waitSettled();
        p = await js(PROBE);
        check('results in the sheet', p.rows >= 3 && !p.problems.length, p);
        await shot(`${width}-${v.id}-sheet`);
        await key('Escape');
        p = await js(PROBE);
        check('Escape closes the sheet and returns focus to the button',
            !p.open && /sfs-topbar__searchbtn/.test(p.focus), p);
    }
}

/* ───────────────────────── a service down, and a visitor ───────────────────────── */
{
    console.log('\n1440px runbooks down');
    await load(1440, 'theme=andromeda&lang=en&fail=runbooks');
    await key('/');
    await type('linux');
    await waitSettled();
    const p = await js(PROBE);
    check('the failed section says so instead of vanishing', p.errors === 1, p);
    check('...and the other sections still answer', p.rows >= 3, p.rows);
    await shot('1440-runbooks-down');
}
{
    console.log('\n1440px signed out (Arabic, light)');
    await load(1440, 'theme=dawn&lang=ar&signedout=1');
    await key('/');
    await type('runbook');
    await waitSettled();
    let p = await js(PROBE);
    check('gated results are shown with a lock', p.locks >= 1, p);
    const lockedHref = await js(`document.querySelector('.sfs-gs__opt.is-locked a')?.getAttribute('href')`);
    check('a locked result links to sign-in, returning to it afterwards', /\/login\?redirect=/.test(lockedHref || ''), lockedHref);
    await shot('1440-signedout-ar');
}
{
    console.log('\n1440px lessons slow');
    await load(1440, 'theme=andromeda&lang=en&slow=lessons:5000');
    await key('/');
    await type('sql');
    await sleep(1200);
    const p = await js(PROBE);
    check('a slow catalogue shows a skeleton while the others answer', p.skeletons >= 1 && p.rows >= 1, p);
    await shot('1440-lessons-loading');
}

check('no uncaught errors in the page', errors.length === 0, errors.slice(0, 5));
console.log(`\n${passes} passed, ${failures} failed — shots in ${outDir}`);
chrome.kill();
served?.close?.();
process.exit(failures ? 1 : 0);
