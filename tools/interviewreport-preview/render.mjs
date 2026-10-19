// Render the interview report in headless Chrome and write what a student
// would download: the PDF, the DOCX, and a PNG of every PDF page.
//
//   npm run preview:interviewreport        -> tools/interviewreport-preview/out/
//
// The DevTools protocol through node's own fetch and WebSocket, no dependency --
// the same plumbing as tools/leaderboard-preview/shoot.mjs, and served by its
// serveDist so a missing build is an error rather than an empty page.
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
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => existsSync(p));
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1); }

const out = resolve(process.argv[2] || 'tools/interviewreport-preview/out');
mkdirSync(out, { recursive: true });
const served = await serveDist('tools/interviewreport-preview/dist', 8797);
const port = 9341;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`,
    '--user-data-dir=' + join(out, '.profile'), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    if (!wsUrl) await sleep(250);
}
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', e => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') console.error('PAGE EXCEPTION', JSON.stringify(msg.params.exceptionDetails).slice(0, 400));
});
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

let failed = 0;
try {
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:8797/index.html' });
    for (let i = 0; i < 60; i++) {
        const r = await send('Runtime.evaluate', { expression: 'window.__ready === true', returnByValue: true });
        if (r.result?.result?.value) break;
        await sleep(250);
    }
    // Every content option in English, and the two shorter ones that matter
    // most in the other two languages.
    const RUNS = [['en', 'full'], ['en', 'strong'], ['en', 'yours'], ['en', 'both'],
        ['ar', 'full'], ['ar', 'both'], ['zh', 'full'], ['zh', 'strong']];
    for (const [lang, content] of RUNS) {
        const r = await send('Runtime.evaluate', { expression: `window.__render('${lang}', '${content}')`, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails || !r.result?.result?.value) {
            failed++;
            console.error(lang, content, 'FAILED', JSON.stringify(r.result?.exceptionDetails || r).slice(0, 600));
            continue;
        }
        const v = r.result.result.value;
        const name = content === 'full' ? lang : `${lang}-${content}`;
        writeFileSync(join(out, `${name}.pdf`), Buffer.from(v.pdf, 'base64'));
        writeFileSync(join(out, `${name}.docx`), Buffer.from(v.docx, 'base64'));
        v.pages.forEach((png, i) => writeFileSync(join(out, `${name}-page-${i + 1}.png`), Buffer.from(png, 'base64')));
        console.log(`${name}: ${v.pages.length} page(s), pdf ${Math.round(v.pdf.length * 0.75 / 1024)} KB, docx ${Math.round(v.docx.length * 0.75 / 1024)} KB  (${v.fileBase})`);
    }
} finally {
    ws.close();
    chrome.kill();
    await served?.close();
}
process.exit(failed ? 1 : 0);
