// Screenshot (and optionally drive) a portal preview page in headless Chrome.
//
//   node tools/portal-preview/shoot.mjs <url> <out.png> [width=1440] [height=900] [steps.json]
//
// steps.json is a list of actions run in order before the final shot:
//   {"click": "<css selector>"}                 a REAL click at the element's centre
//   {"clickText": "<exact visible text>"}       the innermost visible element with it
//   {"type": "<css selector>", "text": "..."}   clear the field, then insert text
//   {"key": "Enter"}                            one key press
//   {"wait": 800}                               milliseconds
//   {"waitFor": "<css selector>"}               up to 15 s
//   {"eval": "<js expression>"}                 result printed
//   {"shot": "<out.png>"}                       an intermediate screenshot
//
// A REAL click (Input.dispatchMouseEvent at coordinates), never element.click():
// a covering element is invisible to the latter and fatal to a user (working
// rule 32). Page exceptions and console errors are printed after the shot, and
// a step that matches nothing is reported, so a passing run cannot hide either.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const [url, out = 'portal.png', width = '1440', height = '900', stepsFile] = process.argv.slice(2);
if (!url) {
    console.error('usage: shoot.mjs <url> <out.png> [w] [h] [steps.json]');
    process.exit(2);
}
const CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
];
const browser = CANDIDATES.find(path => existsSync(path));
if (!browser) {
    console.error('No Chrome or Edge found');
    process.exit(1);
}
const port = 9400 + Math.floor(Math.random() * 500);
const profile = join(tmpdir(), 'sfs-portal-shot-' + port);
const chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(done => setTimeout(done, ms));

let ws;
for (let attempt = 0; attempt < 80 && !ws; attempt++) {
    try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        ws = list.find(target => target.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    if (!ws) await sleep(250);
}
if (!ws) {
    chrome.kill();
    throw new Error('Chrome did not start');
}

const socket = new WebSocket(ws);
const pending = new Map();
let counter = 0;
const logs = [];
await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        logs.push('EXCEPTION ' + (details?.exception?.description || details?.text));
    }
    if (message.method === 'Runtime.consoleAPICalled'
        && ['error', 'warning'].includes(message.params.type)) {
        logs.push(message.params.type.toUpperCase() + ' '
            + message.params.args.map(arg => arg.value ?? arg.description).join(' '));
    }
    const waiting = pending.get(message.id);
    if (!waiting) return;
    pending.delete(message.id);
    message.error ? waiting.fail(new Error(message.error.message)) : waiting.ok(message.result);
};
const send = (method, params = {}) => new Promise((ok, fail) => {
    const mine = ++counter;
    pending.set(mine, { ok, fail });
    socket.send(JSON.stringify({ id: mine, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
           { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia',
           { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

async function evaluate(expression) {
    const answer = await send('Runtime.evaluate',
                              { expression, returnByValue: true, awaitPromise: true });
    if (answer.exceptionDetails) {
        throw new Error(answer.exceptionDetails.exception?.description
            || answer.exceptionDetails.text);
    }
    return answer.result.value;
}

await send('Page.navigate', { url });
for (let attempt = 0; attempt < 160; attempt++) {
    const ready = await evaluate(`(() => {
        if (window.__portal && window.__portal.ready) return true;
        const err = document.querySelector('.pp__err');
        return !!(err && err.textContent && !err.textContent.startsWith('Opening'));
    })()`).catch(() => false);
    if (ready) break;
    await sleep(250);
}
await sleep(1500);

function locate(selector) {
    return evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
}

function locateText(text) {
    return evaluate(`(() => {
        const want = ${JSON.stringify(text)};
        const all = [...document.querySelectorAll('body *')].filter(el => {
            const t = (el.innerText || el.value || '').trim();
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && t === want;
        });
        const el = all.find(el => ![...el.children].some(child => all.includes(child))) || all[0];
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
}

async function clickAt(point, label) {
    if (!point) {
        logs.push('STEP FAILED: nothing matches ' + label);
        return;
    }
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent',
                   { type, x: point.x, y: point.y, button: 'left', clickCount: 1 });
    }
    await sleep(400);
}

const steps = stepsFile ? JSON.parse(readFileSync(stepsFile, 'utf8')) : [];
for (const step of steps) {
    try {
        if (step.click) {
            await clickAt(await locate(step.click), step.click);
        } else if (step.clickText) {
            await clickAt(await locateText(step.clickText), step.clickText);
        } else if (step.type) {
            await clickAt(await locate(step.type), step.type);
            await evaluate(`(() => {
                const el = document.querySelector(${JSON.stringify(step.type)});
                if (el && 'value' in el) {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            })()`);
            await send('Input.insertText', { text: step.text });
            await sleep(200);
        } else if (step.key) {
            await send('Input.dispatchKeyEvent', { type: 'keyDown', key: step.key, code: step.key,
                                                   windowsVirtualKeyCode: step.key === 'Enter' ? 13 : 0 });
            await send('Input.dispatchKeyEvent', { type: 'keyUp', key: step.key, code: step.key });
            await sleep(250);
        } else if (step.wait) {
            await sleep(step.wait);
        } else if (step.waitFor) {
            for (let attempt = 0; attempt < 60; attempt++) {
                if (await evaluate(`!!document.querySelector(${JSON.stringify(step.waitFor)})`)) break;
                await sleep(250);
            }
        } else if (step.eval) {
            console.log('eval:', JSON.stringify(await evaluate(step.eval)));
        } else if (step.probe) {
            // The style probe (probe.js): contrast, overflow, sideways scroll,
            // clipped text, overlapping and tiny controls inside the frame.
            const code = readFileSync(new URL('./probe.js', import.meta.url), 'utf8');
            const findings = await evaluate(code);
            console.log(`PROBE ${step.probe}: ${findings.length} finding(s)`);
            for (const f of findings) {
                console.log(`  [${f.kind}] ${f.at} "${f.text}" - ${f.detail || ''}`);
            }
        } else if (step.resize) {
            await send('Emulation.setDeviceMetricsOverride', {
                width: Number(step.resize[0]), height: Number(step.resize[1]),
                deviceScaleFactor: 1, mobile: Number(step.resize[0]) < 700,
            });
            await sleep(600);
        } else if (step.shot) {
            const picture = await send('Page.captureScreenshot', { format: 'png' });
            mkdirSync(dirname(resolve(step.shot)), { recursive: true });
            writeFileSync(step.shot, Buffer.from(picture.data, 'base64'));
            console.log('shot', step.shot);
        }
    } catch (problem) {
        logs.push('STEP ERROR ' + JSON.stringify(step) + ': ' + problem.message);
    }
}

await sleep(500);
const picture = await send('Page.captureScreenshot', { format: 'png' });
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, Buffer.from(picture.data, 'base64'));
console.log('saved', out);
for (const line of logs) console.log(line);
socket.close();
chrome.kill();
process.exit(0);
