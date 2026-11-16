// node tools/labs-preview/reset-live.mjs <username> <user_id> [lab_id]
//
// Reset environment, in a real Chrome, against the production build and the
// LIVE lab service. A fake signed-in student (Pinia patched in the page) who has
// already done the lab: the page must show the tasks done, the Reset button must
// ask first, and after confirming every task must be to-do. Run `npm run build`
// first. Use a throwaway student, never a real one: this resets their lab.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveDist } from '../leaderboard-preview/serve.mjs';

const [USER, UID, LAB = 'tf-01-lifecycle'] = process.argv.slice(2);
if (!USER || !UID) { console.error('usage: reset-live.mjs <username> <user_id> [lab_id]'); process.exit(2); }
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => existsSync(p));
const PORT = 8801, debugPort = 9344;
const outDir = resolve('tools/labs-preview/shots');
mkdirSync(outDir, { recursive: true });
const server = await serveDist('dist', PORT);
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', `--remote-debugging-port=${debugPort}`,
  '--user-data-dir=' + join(outDir, '.profile-reset'), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* */ }
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
async function waitFor(expr, ms = 60000) { const end = Date.now() + ms; while (Date.now() < end) { if (await ev(expr)) return true; await sleep(300); } return false; }
let failures = 0;
const check = (label, ok, detail) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''}`); if (!ok) failures++; };
const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, `${name}.png`), Buffer.from(s.result.data, 'base64')); };
const doneCount = 'document.querySelectorAll(".sl-task.is-done, .sl-task--done, .sl-task[data-status=passed]").length';
const statusText = '[...document.querySelectorAll(".sl-task")].map(t => t.className).join(" | ")';

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await waitFor('document.readyState === "complete"');
await sleep(1500);
await ev(`(() => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('auth');
  s.isAuthenticated = true; s.user = { id: ${JSON.stringify(UID)}, user_id: ${JSON.stringify(UID)}, username: ${JSON.stringify(USER)}, first_name: 'Reset' };
  s.userFeatures = ['lab_feature'];
  s.loadActiveSubscriptions = async () => [{ id: 'fake', status: 'active' }];
  s.loadUserFeatures = async () => { s.userFeatures = ['lab_feature']; return s.userFeatures; };
  return true; })()`);
await ev(`location.hash = '#/lab/${LAB}'`);
check('the lab opens with its tasks', await waitFor('document.querySelectorAll(".sl-task").length > 0', 90000));
await sleep(1500);
console.log('     before:', await ev(statusText));
await shot('reset-before');
const resetBtn = `[...document.querySelectorAll('.sl-wshead button')].find(b => /Reset environment/.test(b.textContent))`;
await ev(`${resetBtn}.click()`);
check('Reset asks first', await waitFor('!!document.querySelector(".slr-dialog")', 5000));
await shot('reset-confirm');
await ev(`document.querySelector('.slr-btn--danger').click()`);
await waitFor('!document.querySelector(".slr-dialog")', 90000);
await sleep(2500);
const after = await ev(statusText);
console.log('     after: ', after);
await shot('reset-after');
check('after Reset no task shows as done', !/is-done|is-passed|passed|--done/.test(after), after);
check('no "verified earlier" note remains', !(await ev('document.body.innerText.includes("Verified earlier")')));
// Then what a student does next: Check my work, and a reload.
await ev(`[...document.querySelectorAll('button')].find(b => /Check my work/.test(b.textContent))?.click(); true`);
await sleep(8000);
const checked = await ev(statusText);
console.log('     after Check my work:', checked);
check('Check my work after a reset does not bring the ticks back', !/passed/.test(checked), checked);
// A reload is checked against the API instead: the fake sign-in does not survive one.
check('no page errors', errors.length === 0, errors);
socket.close(); chrome.kill(); await server?.close();
console.log(failures ? `\n${failures} failed` : '\nreset passed');
process.exit(failures ? 1 : 0);
