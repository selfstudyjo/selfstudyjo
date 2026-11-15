// node tools/topicinterview-check/smoke.mjs  (after `npm run build`)
//
// Opens a real lesson page from the production build (live services), presses
// "Interview on this topic", and asserts the window opens IN PLACE, goes full
// screen and back, and closes -- with no page errors. Signed out, so the window
// shows its sign-in step; the conversation itself needs an account with ai_feature.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveDist } from '../leaderboard-preview/serve.mjs';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p => existsSync(p));
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1); }

const COURSE = process.env.TI_COURSE || '53aa84f4302c40daab76b2f0a97b0581';
const LESSON = process.env.TI_LESSON || '18432ac7-54f4-4792-98cc-2c320ed75e93';
const PORT = 8798;
const outDir = resolve('tools/topicinterview-check/shots');
mkdirSync(outDir, { recursive: true });
const server = await serveDist('dist', PORT);
const debugPort = 9341;
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', `--remote-debugging-port=${debugPort}`,
  '--user-data-dir=' + join(outDir, '.profile'), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* not yet */ }
  if (!wsUrl) await sleep(250);
}
const socket = new WebSocket(wsUrl);
await new Promise(ok => socket.addEventListener('open', ok));
let id = 0; const pending = new Map(); const errors = [];
socket.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  const w = pending.get(m.id); if (w) { pending.delete(m.id); w(m); }
});
const send = (method, params = {}) => new Promise(ok => { const n = ++id; pending.set(n, ok); socket.send(JSON.stringify({ id: n, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
async function waitFor(expr, ms = 45000) { const end = Date.now() + ms; while (Date.now() < end) { if (await ev(expr)) return true; await sleep(250); } return false; }
let failures = 0;
const check = (label, ok) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`); if (!ok) failures++; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await waitFor('document.readyState === "complete"');
await sleep(1500);
await ev(`location.hash = '#/course/${COURSE}/lesson/${LESSON}'`);
check('the lesson page shows the button', await waitFor('!!document.querySelector(".lesson-head-actions .ti-launch")'));
await ev('document.querySelector(".lesson-head-actions .ti-launch").click()');
check('the window opens', await waitFor('!!document.querySelector(".ti-dialog")', 5000));
check('signed out, it offers sign-in', await ev('!!document.querySelector(".ti-dialog a[href*=login]")'));
await ev('document.querySelector(".ti-dialog .ti-icon-btn").click()');
await sleep(600);
check('full screen engages', await ev('document.fullscreenElement === document.querySelector(".ti-dialog") || document.querySelector(".ti-dialog").classList.contains("is-full")'));
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(outDir, 'fullscreen.png'), Buffer.from(shot.result.data, 'base64'));
await ev('document.querySelector(".ti-dialog .ti-icon-btn").click()');
await sleep(600);
check('and leaves full screen', await ev('!document.fullscreenElement && !document.querySelector(".ti-dialog").classList.contains("is-full")'));
await ev('document.querySelector(".ti-dialog .ti-close").click()');
await sleep(300);
check('the window closes', await ev('!document.querySelector(".ti-dialog")'));
check('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
socket.close(); chrome.kill(); await server?.close();
console.log(failures ? `\n${failures} failed` : '\nsmoke passed');
process.exit(failures ? 1 : 0);
