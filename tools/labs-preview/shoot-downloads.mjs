// Drives the lab explorer's DOWNLOADS and the AI tutor's rendering in a real
// browser, and asserts on the files that actually land on disk.
//
//   npm run build:lab-preview
//   npx vite preview --config tools/labs-preview/vite.config.ts --port 8795
//   node tools/labs-preview/shoot-downloads.mjs
//
// WHY A HARNESS OF ITS OWN. `check:labs` proves the ZIP writer against zlib and
// proves the template wires each button to the right handler. Neither can see
// whether a right-click on a folder in a real browser ends with a real file in
// Downloads - the menu could open on the wrong row, the anchor could fail to
// start a transfer, the blob could be revoked too early. So this right-clicks,
// clicks, waits for the file, and hands it to Python's zipfile, which is an
// unzip that has never seen this code.
//
// And it asks the tutor a question, because "the code has a Copy button" is a
// property of a rendered answer and nothing else.

import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
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

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:8795/index.html';
const outDir = resolve(process.argv[2] || 'tools/labs-preview/shots/downloads');
const downloads = join(outDir, 'files');

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found.');
    process.exit(1);
}
mkdirSync(outDir, { recursive: true });
rmSync(downloads, { recursive: true, force: true });
mkdirSync(downloads, { recursive: true });

const port = 9341;
const chrome = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, '--user-data-dir=' + join(outDir, '.profile'),
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
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
    .catch(() => cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }));
await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const thrown = [];
async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) thrown.push(exceptionDetails.text + ' '
        + (exceptionDetails.exception?.description || ''));
    return result?.value;
}

async function shot(name) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, name), Buffer.from(data, 'base64'));
}

async function waitFor(name, ms = 8000) {
    const file = join(downloads, name);
    for (let waited = 0; waited < ms; waited += 200) {
        if (existsSync(file) && !existsSync(file + '.crdownload') && statSync(file).size > 0) {
            return file;
        }
        await sleep(200);
    }
    return null;
}

let failures = 0;
function assert(label, ok, detail = '') {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + detail}`);
    if (!ok) failures++;
}

function zipNames(file) {
    return execFileSync('python', ['-I', '-c',
        'import sys,zipfile,json;z=zipfile.ZipFile(sys.argv[1]);'
        + 'bad=z.testzip();print(json.dumps({"bad":bad,"names":z.namelist(),'
        + '"modes":{i.filename:(i.external_attr>>16)&0o777 for i in z.infolist()}}))',
        file], { encoding: 'utf-8' });
}

const OPEN_FILES = `(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 60 && !document.querySelector('.sl-bench__tab'); i++) await wait(200);
  const pane = Array.from(document.querySelectorAll('.sl-bench__tab'))
      .find(el => (el.textContent || '').trim().toLowerCase().includes('file'));
  if (!pane) return 'NO FILES PANE';
  pane.click(); await wait(300);
  const tool = Array.from(document.querySelectorAll('.sl-bench__tool'))
      .find(el => (el.textContent || '').trim() === 'Files');
  if (tool) { tool.click(); await wait(400); }
  for (let i = 0; i < 30 && !document.querySelector('.sl-tree__row'); i++) await wait(200);
  return Array.from(document.querySelectorAll('.sl-tree__row'))
      .map(el => el.getAttribute('title')).join(',');
})()`;

const rightClick = (path, item) => `(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const row = Array.from(document.querySelectorAll('.sl-tree__row'))
      .find(el => (el.getAttribute('title') || '') === ${JSON.stringify(path)});
  if (!row) return 'NO ROW';
  const box = row.getBoundingClientRect();
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
      clientX: box.left + 20, clientY: box.top + 5 }));
  await wait(200);
  const where = (document.querySelector('.sl-menu__where') || {}).textContent || '';
  const button = Array.from(document.querySelectorAll('.sl-menu__item'))
      .find(el => (el.textContent || '').trim() === ${JSON.stringify(item)});
  if (!button) return 'NO ITEM on ' + where;
  return 'MENU ' + where.trim();
})()`;

const clickItem = item => `(() => {
  const button = Array.from(document.querySelectorAll('.sl-menu__item'))
      .find(el => (el.textContent || '').trim() === ${JSON.stringify(item)});
  if (!button) return 'NO ITEM';
  button.click();
  return 'CLICKED';
})()`;

try {
    await cdp.send('Page.navigate', { url: `${BASE}?lab=dj-08-admin&theme=andromeda&lang=en` });
    await sleep(2500);
    const listed = await evaluate(OPEN_FILES);
    assert('the explorer opens with the project tree', /config/.test(listed || ''), listed);

    // 1. A FOLDER, from the context menu.
    const menu = await evaluate(rightClick('config', 'Download as ZIP'));
    assert('right-clicking a folder offers Download as ZIP', /^MENU config/.test(menu || ''), menu);
    await shot('menu-folder.png');
    await evaluate(clickItem('Download as ZIP'));
    const folderZip = await waitFor('config.zip');
    assert('the folder downloads as config.zip', Boolean(folderZip), readdirSync(downloads).join(','));
    if (folderZip) {
        const info = JSON.parse(zipNames(folderZip));
        assert('python zipfile opens it and every CRC checks out', info.bad === null, info.bad);
        assert('everything in it is under config/',
            info.names.length > 1 && info.names.every(n => n.startsWith('config/')), info.names.join(','));
    }

    // 2. A FILE, from the context menu.
    const fileMenu = await evaluate(rightClick('manage.py', 'Download'));
    assert('right-clicking a file offers Download', /^MENU manage\.py/.test(fileMenu || ''), fileMenu);
    await evaluate(clickItem('Download'));
    const single = await waitFor('manage.py');
    assert('the file downloads as itself', Boolean(single), readdirSync(downloads).join(','));

    // 3. Download all, from the Explorer bar.
    await evaluate(`document.querySelector('.sl-tree__icon--download')?.click()`);
    const all = await waitFor('dj-08-admin.zip');
    assert('Download all lands as dj-08-admin.zip', Boolean(all), readdirSync(downloads).join(','));
    if (all) {
        const info = JSON.parse(zipNames(all));
        assert('...a valid archive', info.bad === null, info.bad);
        assert('...wrapped in one folder named after the lab',
            info.names.every(n => n.startsWith('dj-08-admin/')), info.names.join(','));
        assert('...holding manage.py and the config/ tree',
            info.names.includes('dj-08-admin/manage.py')
            && info.names.some(n => n.startsWith('dj-08-admin/config/')), info.names.join(','));
    }
    const note = await evaluate(`(document.querySelector('.sl-tree__note') || {}).textContent || ''`);
    assert('the explorer says what was downloaded', /Downloaded/.test(note || ''), note);
    await shot('explorer.png');

    // 4. The tutor.
    const asked = await evaluate(`(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const pane = Array.from(document.querySelectorAll('.sl-bench__tab'))
          .find(el => /tutor|ai/i.test(el.textContent || ''));
      if (pane) { pane.click(); await wait(300); }
      const tool = Array.from(document.querySelectorAll('.sl-bench__tool'))
          .find(el => /tutor/i.test(el.textContent || ''));
      if (tool) { tool.click(); await wait(300); }
      const box = document.querySelector('.sl-tutor__input');
      if (!box) return 'NO TUTOR';
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(box, 'why does db not resolve?');
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      for (let i = 0; i < 40 && !document.querySelector('.sl-codecard'); i++) await wait(150);
      return JSON.stringify({
        cards: document.querySelectorAll('.sl-codecard').length,
        copies: document.querySelectorAll('.sl-codecard__copy').length,
        steps: document.querySelectorAll('.sl-steps__item').length,
        nums: Array.from(document.querySelectorAll('.sl-steps__num')).map(n => n.textContent.trim()),
        inline: document.querySelectorAll('.sl-inline__code').length,
        strong: document.querySelectorAll('.sl-inline__strong').length,
        callout: document.querySelectorAll('.sl-turn__callout').length,
        nested: document.querySelectorAll('.sl-codecard.is-in-steps').length,
        rawTicks: /\`/.test((document.querySelector('.sl-turn--assistant') || {}).textContent || ''),
      });
    })()`);
    let tutor = {};
    try { tutor = JSON.parse(asked); } catch { /* reported below */ }
    assert('the tutor answers with a code card per command block', tutor.cards === 2, asked);
    assert('...each with a Copy button', tutor.copies === 2, asked);
    assert('...the procedure drawn as three numbered steps',
        tutor.steps === 3 && (tutor.nums || []).join('') === '123', asked);
    assert('...the code placed under its step', tutor.nested === 2, asked);
    assert('...inline code and bold drawn, no stray backticks',
        tutor.inline >= 3 && tutor.strong === 1 && tutor.rawTicks === false, asked);
    assert('...and the tip as a callout', tutor.callout === 1, asked);
    // A REAL CLICK, not element.click(): the clipboard needs user activation,
    // and a synthetic click carries none - so the harness would report a broken
    // button that works for every student.
    await cdp.send('Browser.grantPermissions', {
        permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
    }).catch(() => {});
    const at = await evaluate(`(() => {
      const button = document.querySelector('.sl-codecard__copy');
      button.scrollIntoView({ block: 'center' });
      const box = button.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })()`);
    for (const type of ['mousePressed', 'mouseReleased']) {
        await cdp.send('Input.dispatchMouseEvent',
            { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
    }
    await sleep(400);
    const copied = await evaluate(`document.querySelector('.sl-codecard__copy').textContent.trim()
      + ' | ' + ((document.querySelector('.sl-tutor__error') || {}).textContent || '')`);
    assert('pressing Copy says Copied', /Copied/.test(copied || ''), copied);
    await shot('tutor.png');

    assert('nothing threw in the page', thrown.length === 0, thrown.join(' | '));
} finally {
    cdp.close();
    chrome.kill();
}

console.log(failures ? `\n${failures} failed` : '\nAll download and tutor checks passed.');
process.exit(failures ? 1 : 0);
