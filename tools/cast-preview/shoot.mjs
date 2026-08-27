// Screenshot the 3D cast, at the framings that matter.
//
//   node tools/cast-preview/shoot.mjs [outDir]
//
// Serves `tools/cast-preview/dist` itself, so the whole thing is one command:
// build the preview, run this, look at the pictures. No dev server to remember
// to start and no port to collide with.
//
// WHY `Emulation.setDeviceMetricsOverride` AND NOT `--window-size`
//
// Headless Chrome has a minimum window width of about 500px and CROPS the image
// below that rather than resizing the viewport, which looks exactly like a page
// overflowing its container. That cost a wrong diagnosis on the leaderboard;
// the note is in `tools/leaderboard-preview/shoot.mjs` and it applies to every
// screenshot taken on this platform.
//
// WHY REDUCED MOTION IS **NOT** EMULATED HERE
//
// The opposite of every other shooter in this repo, and deliberately: under
// `prefers-reduced-motion` the figures scale their idle amplitudes down to 35%
// (see `loader.ts`), and the whole point of these shots is to judge the pose the
// animation actually produces. A settled frame is what a chart wants; a moving
// one is what a person wants.
//
// The trade is that two runs are not byte-identical, so these cannot be diffed
// the way the leaderboard's can. They are for looking at.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const CHROME_CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/**
 * What to shoot.
 *
 * `head` is where a modelling change is judged and `tile` is where it has to
 * survive; both are needed, because a face that looks right at 520px can be an
 * unreadable smudge at 170 and a face tuned at 170 can be crude at 520.
 */
const SHOTS = [
    { name: 'all-tile', query: 'who=all&zoom=tile', width: 1200, height: 900 },
    { name: 'all-tile-speaking', query: 'who=all&zoom=tile&speaking=1', width: 1200, height: 900 },
    { name: 'head-marcus', query: 'who=marcus&zoom=head', width: 620, height: 700 },
    { name: 'head-marcus-speaking', query: 'who=marcus&zoom=head&speaking=1', width: 620, height: 700 },
    { name: 'head-sara', query: 'who=sara&zoom=head', width: 620, height: 700 },
    { name: 'head-emma-speaking', query: 'who=emma&zoom=head&speaking=1', width: 620, height: 700 },
    { name: 'head-anchor-male', query: 'who=anchorMale&zoom=head', width: 620, height: 700 },
    { name: 'head-anchor-female', query: 'who=anchorFemale&zoom=head', width: 620, height: 700 },
    { name: 'wide-james', query: 'who=james&zoom=wide', width: 620, height: 500 },
    { name: 'silent-mouth', query: 'who=david&zoom=head&speaking=0&energy=0', width: 620, height: 700 },
    /*
      The newscast SET, which had no preview at all until now — the only way to
      see it was a live bulletin. Three shots, because the three states are
      different pictures: nobody reading, the male anchor reading (he is
      screen-right, which is the one thing about the layout that is easy to get
      backwards), and the female anchor reading.
    */
    { name: 'studio-idle', query: 'stage=studio&speaking=0', width: 1280, height: 900 },
    { name: 'studio-male', query: 'stage=studio&speaking=1&energy=0.8', width: 1280, height: 900 },
    { name: 'studio-female', query: 'stage=studio&speaking=1&reading=female&energy=0.8', width: 1280, height: 900 },
];

const dist = resolve('tools/cast-preview/dist');
const outDir = resolve(process.argv[2] || 'tools/cast-preview/shots');
if (!existsSync(join(dist, 'index.html'))) {
    console.error('Build it first:  npm run build:cast-preview');
    process.exit(1);
}
const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};

const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(dist, path === '/' ? 'index.html' : path);
    if (!file.startsWith(dist) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const port = 9422;
const chrome = spawn(browser, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    // The default headless GL is fine and software-rendered; forcing SwiftShader
    // keeps the shot identical on a machine with no GPU passthrough, which is
    // the case in CI and on a VM.
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=' + join(outDir, '.profile'),
    'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

let wsUrl = null;
for (let attempt = 0; attempt < 80 && !wsUrl; attempt++) {
    try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl || null;
    } catch { /* not up yet */ }
    if (!wsUrl) await sleep(250);
}
if (!wsUrl) { console.error('Chrome never opened its debugging port'); process.exit(1); }

const socket = new WebSocket(wsUrl);
const pending = new Map();
let id = 0;
const errors = [];
await new Promise((ok, fail) => {
    socket.addEventListener('open', ok);
    socket.addEventListener('error', fail);
});
socket.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (m.method === 'Runtime.exceptionThrown') {
        errors.push(m.params.exceptionDetails.exception?.description
            || m.params.exceptionDetails.text);
        return;
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errors.push(m.params.args.map(a => a.description || a.value).join(' ').slice(0, 300));
        return;
    }
    const waiting = pending.get(m.id);
    if (!waiting) return;
    pending.delete(m.id);
    waiting(m.result ?? {});
});
const send = (method, params = {}) => new Promise(ok => {
    const mine = ++id;
    pending.set(mine, ok);
    socket.send(JSON.stringify({ id: mine, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');

for (const shot of SHOTS) {
    errors.length = 0;
    await send('Emulation.setDeviceMetricsOverride', {
        width: shot.width, height: shot.height, deviceScaleFactor: 1, mobile: false,
    });
    await send('Page.navigate', { url: `${base}?${shot.query}` });
    // Long enough for the Babylon chunk to download and one figure to build.
    // Software rendering is slow; a short wait shoots an empty canvas, which
    // looks like a broken scene rather than an impatient screenshot.
    await sleep(3500);
    const png = await send('Page.captureScreenshot', { format: 'png' });
    if (!png.data) {
        console.log(`  FAIL  ${shot.name}  no image`);
        continue;
    }
    writeFileSync(join(outDir, `${shot.name}.png`), Buffer.from(png.data, 'base64'));
    console.log(`  shot  ${shot.name.padEnd(22)}`
        + (errors.length ? `${errors.length} page error(s): ${errors[0]}` : 'ok'));
}

socket.close();
chrome.kill();
server.close();
console.log(`\nScreenshots in ${outDir}\n`);
