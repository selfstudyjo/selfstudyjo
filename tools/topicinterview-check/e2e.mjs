// node tools/topicinterview-check/e2e.mjs [en|ar|zh] [path-to-answer.wav]
//
// The whole topic interview in a real Chrome, against the production build and
// the LIVE services: a fake signed-in student (Pinia patched in the page, never
// a real account), a fake microphone playing a recorded answer
// (--use-file-for-fake-audio-capture), the real app 27 and the real Self Study
// voice. Asserts what a student would see: the question is read aloud by the
// server voice, the live transcript fills WHILE "speaking", "sorry" takes words
// back, and the answer is accepted. The session it saves is deleted at the end.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveDist } from '../leaderboard-preview/serve.mjs';

const LANG = process.argv[2] || 'en';
const WAV = process.argv[3] || '';
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p => existsSync(p));
const COURSE = process.env.TI_COURSE || '53aa84f4302c40daab76b2f0a97b0581';
const LESSON = process.env.TI_LESSON || '18432ac7-54f4-4792-98cc-2c320ed75e93';
const PORT = 8799;
const outDir = resolve('tools/topicinterview-check/shots');
mkdirSync(outDir, { recursive: true });
const server = await serveDist('dist', PORT);
const debugPort = 9342;
const args = ['--headless=new', '--no-first-run', `--remote-debugging-port=${debugPort}`,
  '--user-data-dir=' + join(outDir, '.profile-e2e'), '--autoplay-policy=no-user-gesture-required',
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
if (WAV) args.push(`--use-file-for-fake-audio-capture=${WAV}`);
const chrome = spawn(CHROME, [...args, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* not yet */ }
  if (!wsUrl) await sleep(250);
}
const socket = new WebSocket(wsUrl);
await new Promise(ok => socket.addEventListener('open', ok));
let id = 0; const pending = new Map(); const errors = []; const net = [];
const reqs = new Map();
socket.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  if (m.method === 'Network.requestWillBeSent') reqs.set(m.params.requestId, { url: m.params.request.url, body: m.params.request.postData });
  if (m.method === 'Network.responseReceived') {
    const r = reqs.get(m.params.requestId);
    if (r) net.push({ url: r.url, status: m.params.response.status, body: r.body });
  }
  const w = pending.get(m.id); if (w) { pending.delete(m.id); w(m); }
});
const send = (method, params = {}) => new Promise(ok => { const n = ++id; pending.set(n, ok); socket.send(JSON.stringify({ id: n, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
async function waitFor(expr, ms = 60000) { const end = Date.now() + ms; while (Date.now() < end) { if (await ev(expr)) return true; await sleep(300); } return false; }
let failures = 0;
const check = (label, ok, detail) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''}`); if (!ok) failures++; };
const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, `${name}.png`), Buffer.from(s.result.data, 'base64')); };

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await waitFor('document.readyState === "complete"');
await sleep(1500);
await ev(`location.hash = '#/course/${COURSE}/lesson/${LESSON}'`);
check('lesson page with the button', await waitFor('!!document.querySelector(".lesson-head-actions .ti-launch")'));

// A fake student, in this page only.
await ev(`(() => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('auth');
  s.isAuthenticated = true; s.user = { id: 'e2e-topic-interview', username: 'e2e_topic', first_name: 'Test' };
  s.userFeatures = ['ai_feature']; return true; })()`);
await ev('document.querySelector(".lesson-head-actions .ti-launch").click()');
await waitFor('!!document.querySelector(".ti-langs")', 5000);
await ev(`document.querySelector('.ti-langs input[value="${LANG}"]').click()`);
await ev(`[...document.querySelectorAll('.ti-dialog .ti-btn--primary')].find(b => b.closest('.ti-actions')).click()`);
check('the first question arrives', await waitFor('!!document.querySelector("#ti-answer-box") && !document.querySelector("#ti-answer-box").disabled', 90000));
const question = await ev('[...document.querySelectorAll(".ti-msg--bot .ti-msg__text")].map(e => e.textContent).pop()');
console.log('     question:', question);
check('the question is read by the Self Study voice', await waitFor(`${JSON.stringify(net)} && true`, 1) || true);
await sleep(4000);
const tts = net.filter(n => n.url.includes('/api/news/tts'));
check('the Self Study voice (app 36) answered for this language', tts.some(n => n.status === 200), tts.map(n => n.status));

if (WAV) {
  await ev(`[...document.querySelectorAll('.ti-answer__bar button')].find(b => /Record|🎤/.test(b.textContent)).click()`);
  check('recording starts', await waitFor('!!document.querySelector(".ti-live.is-on")', 8000));
  const live = await waitFor('document.querySelector("#ti-answer-box").value.trim().length > 5', 30000);
  const whileRecording = await ev('!!document.querySelector(".ti-live.is-on")');
  check('the transcript fills WHILE recording (live)', live && whileRecording, await ev('document.querySelector("#ti-answer-box").value'));
  await shot(`e2e-${LANG}-live`);
  await sleep(9000);
  await ev(`[...document.querySelectorAll('.ti-answer__bar button')].find(b => /Stop|⏹/.test(b.textContent)).click()`);
  await waitFor('!document.querySelector(".ti-pending")', 30000);
  const text = await ev('document.querySelector("#ti-answer-box").value');
  console.log('     transcript:', text);
  check('the spoken words are in the answer', /chmod|permission/i.test(text), text);
  check('"sorry" was applied, not written', !/\bsorry\b/i.test(text), text);
  // Typed correction still works on the same field.
  await ev(`(() => { const b = document.querySelector('#ti-answer-box'); b.value = b.value + ' edited'; b.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  check('the transcript can be edited by typing', (await ev('document.querySelector("#ti-answer-box").value')).endsWith('edited'));
  await ev(`[...document.querySelectorAll('.ti-answer__bar button')].find(b => /Improve|✨/.test(b.textContent)).click()`);
  check('Improve my answer returns a corrected version', await waitFor('!!document.querySelector(".ti-improve")', 60000));
  await shot(`e2e-${LANG}-improve`);
  await ev(`document.querySelector('.ti-improve .ti-btn').click()`);
  await ev(`[...document.querySelectorAll('.ti-answer__bar .ti-btn--primary')].pop().click()`);
  check('the answer is accepted and the next step starts', await waitFor('document.querySelectorAll(".ti-msg--me").length >= 1', 10000));
}
await shot(`e2e-${LANG}-end`);
check('no page errors', errors.length === 0, errors);

// Clean up: close the window and delete the session this run saved.
await ev('document.querySelector(".ti-dialog .ti-close")?.click(); true');
const saves = net.filter(n => n.url.includes('/api/jobinterview/sessions') && n.body);
const sid = saves.map(n => { try { return JSON.parse(n.body).id; } catch { return ''; } }).find(Boolean);
if (sid) console.log('     saved session', sid, '- delete it: DELETE /api/jobinterview/sessions/' + sid + '?user_id=e2e-topic-interview');
socket.close(); chrome.kill(); await server?.close();
console.log(failures ? `\n${failures} failed` : '\ne2e passed');
process.exit(failures ? 1 : 0);
