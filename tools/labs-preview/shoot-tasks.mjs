/*
  The lab TASK PANEL, driven in a real browser: beside the workbench, collapsed
  to its rail, inside the full-screen drawer, the "i" window in full screen,
  and PLAYGROUND mode.

    npm run build:lab-preview
    npx vite preview --config tools/labs-preview/vite.config.ts --port 8795
    node tools/labs-preview/shoot-tasks.mjs [outDir]

  Every press is a REAL mouse event at the element's own centre, never
  `element.click()`: full screen needs a user gesture, and a synthetic click
  passes happily while something transparent covers the control (working rule
  32). And the "i" window is asserted VISIBLE - `elementFromPoint` at its centre
  answers the dialog - because with the native Fullscreen API a dialog left on
  <body> opens, takes the focus, and is not painted at all.
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

const port = 9347;
const chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${port}`, '--user-data-dir=' + join(outDir, '.profile-tasks'),
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
    return { ready, close: () => socket.close(), send(method, params = {}) {
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
await cdp.send('Runtime.setAsyncCallStackDepth', { maxDepth: 4 }).catch(() => {});
async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (exceptionDetails) thrown.push(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
    return result?.value;
}

let failures = 0;
const report = [];
function check(label, ok, detail = '') {
    report.push(`${ok ? '  ok  ' : '  FAIL'}  ${label}${ok ? '' : '  -- ' + String(detail).slice(0, 300)}`);
    if (!ok) failures++;
}
async function shot(name) {
    const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `tasks-${name}.png`), Buffer.from(s.data, 'base64'));
}
async function waitFor(expr, ms = 8000) {
    for (let t = 0; t < ms; t += 200) { if (await evaluate(expr)) return true; await sleep(200); }
    return false;
}
/** A REAL click at the centre of the first VISIBLE match. */
async function press(selector) {
    const at = await evaluate(`(() => {
        const el = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
            .find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        if (!el) return null;
        el.scrollIntoView({ block: 'nearest' });
        const r = el.getBoundingClientRect();
        return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
    })()`);
    if (!at) return false;
    for (const type of ['mousePressed', 'mouseReleased']) {
        await cdp.send('Input.dispatchMouseEvent', { type, x: at[0], y: at[1], button: 'left', clickCount: 1 });
    }
    await sleep(350);
    return true;
}
async function escape() {
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(350);
}
const rect = sel => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
    const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; })()`);
/** Is the element on top at its own centre (i.e. painted and not covered)? */
const onTop = sel => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
    const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(40, r.height / 2));
    return !!hit && (e === hit || e.contains(hit)); })()`);

const LAB = 'web-01-html';
for (const [w, h, theme] of [[1440, 900, 'andromeda'], [1024, 768, 'cartwheel'], [390, 844, 'andromeda']]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(150);
    await cdp.send('Page.navigate', { url: `${BASE}?lab=${LAB}&theme=${theme}` });
    await evaluate(`localStorage.removeItem('sl-tasks-collapsed:${LAB}')`);
    check(`${w}: the workspace opened with its tasks`, await waitFor(`!!document.querySelector('.sl-side .sl-tasks .sl-task')`, 12000));
    await sleep(600);

    const bench = await rect('.sl-bench');
    const side = await rect('.sl-side');
    const scroller = await evaluate(`(() => { const s = document.querySelector('.sl-tasks__scroll'); const cs = getComputedStyle(s);
        return { overflow: cs.overflowY, max: cs.maxHeight, h: s.clientHeight }; })()`);
    check(`${w}: the task list scrolls inside itself`, scroller?.overflow === 'auto', JSON.stringify(scroller));
    if (w >= 1024) {
        check(`${w}: the tasks sit BESIDE the workbench, level with it`,
              side && bench && side.l >= bench.r - 1 && Math.abs(side.t - bench.t) < 4,
              JSON.stringify({ bench, side }));
        check(`${w}: the column is no taller than the viewport`, side && side.h <= h, JSON.stringify(side));
        check(`${w}: the column is sticky`, (await evaluate(`getComputedStyle(document.querySelector('.sl-side')).position`)) === 'sticky');
    } else {
        check(`${w}: stacked under the workbench, the list is capped`,
              side && bench && side.t >= bench.b - 1 && scroller.max !== 'none', JSON.stringify({ side, scroller }));
    }
    check(`${w}: the current task is marked`, await evaluate(`!!document.querySelector('.sl-task.is-current .sl-task__now')`));
    await shot(`${w}-page`);

    // COLLAPSE, with a real click.
    check(`${w}: Hide tasks is clickable`, await press('.sl-tasks__collapse'));
    check(`${w}: collapsed, the rail shows the progress`,
          await waitFor(`/\\d+\\/\\d+/.test(document.querySelector('.sl-rail')?.textContent || '')`, 2000));
    check(`${w}: the choice is remembered for this lab`,
          (await evaluate(`localStorage.getItem('sl-tasks-collapsed:${LAB}')`)) === '1');
    if (w >= 1024) {
        const wider = await rect('.sl-bench');
        check(`${w}: the workbench takes the space`, wider && bench && wider.w > bench.w + 150, JSON.stringify({ before: bench?.w, after: wider?.w }));
    }
    await shot(`${w}-collapsed`);
    check(`${w}: the rail reopens the panel`, await press('.sl-rail')
          && await waitFor(`!!document.querySelector('.sl-side .sl-tasks') && !document.querySelector('.sl-rail')`, 2000));

    // FULL SCREEN, with a real click (a user gesture).
    check(`${w}: Full screen is clickable`, await press('.sl-bench__fs-btn'));
    check(`${w}: the bench is full screen`, await waitFor(`!!document.querySelector('.sl-bench.is-full')`, 3000));
    const native = await evaluate(`!!document.fullscreenElement`);
    report.push(`        (${native ? 'native Fullscreen API' : 'overlay fallback'})`);
    check(`${w}: the task panel moved INTO the bench`,
          await waitFor(`!!document.querySelector('.sl-bench.is-full #sl-tasks-drawer .sl-tasks')`, 2000));
    if (w < 900) {
        check(`${w}: the narrow sheet starts closed`,
              await evaluate(`!document.querySelector('#sl-tasks-drawer.is-open')`));
        check(`${w}: the Tasks button opens it`, await press('.sl-bench__tasks-btn')
              && await waitFor(`!!document.querySelector('#sl-tasks-drawer.is-open')`, 2000));
    } else {
        check(`${w}: the drawer is open beside the tool`,
              await evaluate(`!!document.querySelector('#sl-tasks-drawer.is-open')`));
    }
    check(`${w}: the drawer is painted (on top at its own centre)`, await onTop('#sl-tasks-drawer .sl-tasks__head'));
    check(`${w}: the current task is visible in the drawer`, await onTop('#sl-tasks-drawer .sl-task.is-current .sl-task__now'));
    await shot(`${w}-fullscreen`);

    // THE "i" WINDOW IN FULL SCREEN.
    check(`${w}: the task info button is clickable in full screen`, await press('#sl-tasks-drawer .sl-task.is-current .sl-task__info'));
    check(`${w}: the info window opened`, await waitFor(`!!document.querySelector('.sltg-dialog')`, 3000));
    await sleep(400);
    check(`${w}: ...INSIDE the full-screen element`, await evaluate(`(() => {
        const host = document.fullscreenElement || document.querySelector('.sl-bench.is-full');
        return !!host && host.contains(document.querySelector('.sltg-dialog')); })()`));
    check(`${w}: ...and VISIBLE (on top at its centre)`, await onTop('.sltg-dialog'));
    check(`${w}: ...showing the task's steps`, await evaluate(`(document.querySelector('.sltg-dialog')?.innerText || '').length > 80`));
    await shot(`${w}-fullscreen-info`);
    await escape();
    check(`${w}: Escape closes the info window`, await waitFor(`!document.querySelector('.sltg-dialog')`, 2000));
    if (!native) check(`${w}: ...and leaves the workbench in full screen`, await evaluate(`!!document.querySelector('.sl-bench.is-full')`));

    // OUT AGAIN.
    if (await evaluate(`!!document.querySelector('.sl-bench.is-full')`)) {
        await press('.sl-bench__fs-btn:not(.sl-bench__tasks-btn):not(.sl-bench__fs-close)');
    }
    check(`${w}: leaving full screen puts the panel back beside/under the bench`,
          await waitFor(`!document.querySelector('.sl-bench.is-full') && !!document.querySelector('.sl-side .sl-tasks')`, 3000));

    // PLAYGROUND MODE.
    await cdp.send('Page.navigate', { url: `${BASE}?lab=${LAB}&theme=${theme}&play=1` });
    check(`${w}: playground opened`, await waitFor(`!!document.querySelector('.sl-wshead--play') && !!document.querySelector('.sl-bench__panel')`, 12000));
    await sleep(500);
    check(`${w}: playground has no task panel, no Check my work, no Brief tab`, await evaluate(`
        !document.querySelector('.sl-side') && !document.querySelector('.sl-tasks')
        && !Array.from(document.querySelectorAll('.sl-bench__tab')).some(b => /Brief/.test(b.textContent))`));
    const pb = await rect('.sl-bench');
    const pw = await rect('.sl-wsbody');
    check(`${w}: playground workbench takes the full width`, pb && pw && Math.abs(pb.w - pw.w) < 2, JSON.stringify({ pb, pw }));
    await shot(`${w}-playground`);
}

/*
  THE OVERLAY FALLBACK (iPhone Safari, a refused request): the API is switched
  off, so the bench becomes a fixed overlay. The info window must still be on
  top of it, and Escape must close the WINDOW first and the overlay second.
*/
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp.send('Page.navigate', { url: `${BASE}?lab=${LAB}` });
check('overlay: the workspace opened', await waitFor(`!!document.querySelector('.sl-side .sl-tasks .sl-task')`, 12000));
await evaluate(`Object.defineProperty(document, 'fullscreenEnabled', { get: () => false, configurable: true })`);
await press('.sl-bench__fs-btn');
check('overlay: the bench is the overlay', await waitFor(`!!document.querySelector('.sl-bench.is-full.is-overlay') && !document.fullscreenElement`, 3000));
check('overlay: the drawer holds the tasks', await onTop('#sl-tasks-drawer .sl-tasks__head'));
await press('#sl-tasks-drawer .sl-task__info');
check('overlay: the info window is on top of the overlay', await waitFor(`!!document.querySelector('.sltg-dialog')`, 3000) && await onTop('.sltg-dialog'));
await shot('overlay-info');
await escape();
check('overlay: Escape closes the window and KEEPS full screen',
      await evaluate(`!document.querySelector('.sltg-dialog') && !!document.querySelector('.sl-bench.is-overlay')`),
      await evaluate(`JSON.stringify({ dialog: !!document.querySelector('.sltg-dialog'), overlay: !!document.querySelector('.sl-bench.is-overlay'), active: document.activeElement?.className })`));
await escape();
check('overlay: a second Escape leaves full screen', await waitFor(`!document.querySelector('.sl-bench.is-full')`, 2000));

check('nothing threw', thrown.length === 0, thrown.join(' | '));
cdp.close();
chrome.kill();
console.log(report.join('\n'));
console.log(failures ? `\n${failures} failure(s). Screenshots in ${outDir}` : `\nAll passed. Screenshots in ${outDir}`);
process.exit(failures ? 1 : 0);
