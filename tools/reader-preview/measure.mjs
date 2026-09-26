// A one-off: photograph the bar WITHOUT `captureBeyondViewport` and print the
// box of every element in it.
//
//   node tools/reader-preview/measure.mjs
//
// WHY IT IS CHECKED IN. `shoot.mjs` captures with `captureBeyondViewport: true`
// so a tall page fits in one image, and that mode composites a
// `position: fixed` element at its VIEWPORT position over a DOCUMENT-sized
// canvas -- so a fixed bar can appear with a fragment of itself at a second
// offset. On the first Arabic run that produced a stray coloured rectangle
// beside the bar's title, which is indistinguishable in a picture from a real
// mis-positioned element. CLAUDE.md records the same class of camera artefact
// for a `<canvas>` in that mode.
//
// So: one viewport-only capture, plus the numbers. A measurement settles it and
// a screenshot alone cannot.
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveDist } from '../leaderboard-preview/serve.mjs';

const CHROME = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].find(p => existsSync(p));

const DIST = resolve('tools/reader-preview/dist');
const OUT = resolve('tools/reader-preview/shots');
mkdirSync(OUT, { recursive: true });

const server = await serveDist(DIST, 8802);
const port = 9371;
const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=' + join(OUT, '.measure-profile'), 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws;
for (let i = 0; i < 60 && !ws; i++) {
    try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        ws = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    if (!ws) await sleep(250);
}

const socket = new WebSocket(ws);
await new Promise(r => socket.addEventListener('open', r));
let id = 0;
const pending = new Map();
socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const waiting = pending.get(message.id);
    if (waiting) { pending.delete(message.id); waiting(message.result); }
});
const send = (method, params = {}) => {
    const mine = ++id;
    socket.send(JSON.stringify({ id: mine, method, params }));
    return new Promise(r => pending.set(mine, r));
};

const MEASURE = `(function () {
  var bar = document.querySelector('.sfs-read-bar');
  if (!bar) return 'NO BAR';
  var lines = [];
  var box = function (el) {
    var b = el.getBoundingClientRect();
    return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(',');
  };
  lines.push('viewport ' + document.documentElement.clientWidth + 'x' + document.documentElement.clientHeight);
  lines.push('BAR left,top,w,h = ' + box(bar));
  var reserved = getComputedStyle(document.documentElement).getPropertyValue('--body-padding-bottom');
  lines.push('--body-padding-bottom = ' + reserved.trim());
  var kids = bar.querySelectorAll('*');
  for (var i = 0; i < kids.length; i++) {
    var name = kids[i].tagName.toLowerCase() + '.' + String(kids[i].className || '-').split(' ')[0];
    lines.push('  ' + name + '  ' + box(kids[i]));
  }
  lines.push('activeElement = ' + (document.activeElement ? document.activeElement.tagName + '.' + String(document.activeElement.className || '-') : 'none'));
  var sel = window.getSelection();
  lines.push('selection = ' + JSON.stringify(sel ? sel.toString() : ''));
  // Whatever is painted at the coordinates the screenshot shows a stray block.
  var probes = [[300, 740], [300, 760], [470, 862]];
  for (var j = 0; j < probes.length; j++) {
    var el = document.elementFromPoint(probes[j][0], probes[j][1]);
    lines.push('at ' + probes[j].join(',') + ' -> ' + (el
      ? el.tagName.toLowerCase() + '.' + String(el.className || '-').split(' ')[0]
        + '  bg=' + getComputedStyle(el).backgroundColor
      : 'nothing'));
  }
  return lines.join(String.fromCharCode(10));
})()`;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

for (const variant of [
    { id: 'ar', width: 390, height: 844, query: 'theme=andromeda&lang=ar&play=1' },
    { id: 'en', width: 1440, height: 900, query: 'theme=cartwheel&lang=en&play=1' },
]) {
    await send('Emulation.setDeviceMetricsOverride', {
        width: variant.width, height: variant.height,
        deviceScaleFactor: 1, mobile: variant.width <= 480,
    });
    await send('Page.navigate', { url: `http://127.0.0.1:8802/index.html?${variant.query}` });
    await sleep(2600);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `viewport-${variant.width}-${variant.id}.png`),
        Buffer.from(shot.data, 'base64'));
    // The bar alone, at 3x, so a stray block can be identified rather than
    // squinted at.
    const barBox = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(function(){var b=document.querySelector('.sfs-read-bar');`
            + `if(!b) return null; var r=b.getBoundingClientRect();`
            + `return {x:Math.floor(r.left)-4,y:Math.floor(r.top)-4,`
            + `width:Math.ceil(r.width)+8,height:Math.ceil(r.height)+8};})()`,
    });
    if (barBox.result.value) {
        const clip = await send('Page.captureScreenshot', {
            format: 'png', clip: { ...barBox.result.value, scale: 3 },
        });
        writeFileSync(join(OUT, `bar-${variant.width}-${variant.id}.png`),
            Buffer.from(clip.data, 'base64'));
    }
    const html = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(function(){var b=document.querySelector('.sfs-read-bar');`
            + `return b ? b.outerHTML : 'none';})()`,
    });
    console.log('HTML: ' + String(html.result.value).replace(/\s+/g, ' ').slice(0, 1400));
    const out = await send('Runtime.evaluate', { returnByValue: true, expression: MEASURE });
    console.log(`\n--- ${variant.width}px ${variant.id} ---`);
    console.log(out.result.value);
}

socket.close();
chrome.kill();
await server.close();
process.exit(0);
