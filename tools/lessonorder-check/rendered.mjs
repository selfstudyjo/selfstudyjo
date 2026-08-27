// Watches a real browser render the lesson list, and reads the order off the
// DOM. Not part of `npm run check` — it needs Chrome and the network.
//
//   node tools/lessonorder-check/rendered.mjs                 # the live site
//   node tools/lessonorder-check/rendered.mjs http://localhost:4173
//
// WHY THIS EXISTS ALONGSIDE check:lessonorder
// -------------------------------------------
// `check:lessonorder` proves `orderLessons` sorts correctly, and it cannot
// prove the PAGE uses it. Those are different claims, and the bug the user
// reported lived in the gap between them: for weeks the ordering was simply
// absent, and every check in the repo was green because none of them rendered
// anything. The fix was then verified the same way — 41 assertions, a run over
// the live API, a build, a deployed bundle grepped for its own word list — and
// still nobody had watched a browser put Module 1 at the top.
//
// So this reads `<ol class="lesson-siblings">` out of the rendered page, which
// is the exact list the reader sees, and checks it ascends.
//
// THE HASH-ROUTE TRAP, which is what makes this awkward to write
// ---------------------------------------------------------------
// Navigating straight to `https://site/#/course/x/lesson/y` can land on the
// login screen: the app boots, the router resolves before the hash is applied,
// and the guard redirects. It looks exactly like the page requiring an account,
// and it does not — `/course/:courseId/lesson/:lessonId` is `requiresAuth:
// false` on purpose. So this navigates to the base URL, WAITS for the app to
// boot, then sets `location.hash` and waits for the list to appear. The wait is
// for the element rather than a sleep, because the page fetches lessons from a
// PythonAnywhere replica whose first answer of the day takes ~20 seconds.
//
// It also fails loudly on a redirect to /login rather than reporting "no list
// found", because those two need completely different reactions.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.argv[2] || 'https://www.selfstudyjo.com').replace(/\/$/, '');

// Big Data Fundamentals: 31 lessons, stored fully reversed, and the course the
// bug was reported against. Any lesson of it renders the whole sibling list.
const COURSE = '1ee868b1e6bb4dc7946cc8f73967a0f0';
const LESSON = '44a93b72-b2e5-4a4e-8c3d-edfafb7c8731';   // Module 1
const ROUTE = `/course/${COURSE}/lesson/${LESSON}`;
// The user reported BOTH pages, so both are read. They share
// `courseService.getCourseLessons`, but "shares a code path" is an argument and
// a rendered list is evidence.
const COURSE_ROUTE = `/course/${COURSE}`;

const CHROME_CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
];

const browser = CHROME_CANDIDATES.find(p => existsSync(p));
if (!browser) {
    console.error('No Chrome or Edge found. Set one of:\n  ' + CHROME_CANDIDATES.join('\n  '));
    process.exit(2);
}

const outDir = new URL('./.render', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(outDir, { recursive: true });

const port = 9413;
const chrome = spawn(browser, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=' + join(outDir, '.profile'),
    'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function target() {
    for (let attempt = 0; attempt < 80; attempt++) {
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
        if (message.method) return;
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

/** Evaluate in the page, and treat a thrown exception as a failure, never a null. */
async function evaluate(cdp, expression) {
    const result = await cdp.send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) {
        throw new Error('page threw: ' +
            (result.exceptionDetails.exception?.description
             || result.exceptionDetails.text));
    }
    return result.result.value;
}

let failures = 0;
const check = (label, ok, detail) => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
};

const cdp = connect(await target());
await cdp.ready;
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');

try {
    console.log(`\nReading the rendered lesson list from ${BASE}${ROUTE}\n`);

    // 1. Boot the app at the base URL first. Going straight to the hash route
    //    is what lands on /login.
    await cdp.send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120 && !(await evaluate(cdp, 'document.readyState === "complete"')); i++) {
        await sleep(250);
    }
    await sleep(1500);                       // let the router mount

    // 2 and 3, for each page: ask for the route, then WAIT for the list rather
    // than for a timer, because a cold replica takes ~20s to answer.
    async function readList(route, reader) {
        await evaluate(cdp, `location.hash = ${JSON.stringify('#' + route)}; true`);
        for (let i = 0; i < 160; i++) {
            const found = await evaluate(cdp, `(() => {
                if (location.hash.includes('/login')) return { redirected: location.hash };
                ${reader}
            })()`);
            if (found) return found;
            await sleep(500);
        }
        return null;
    }

    const LESSON_READER = `
        const ol = document.querySelector('ol.lesson-siblings');
        if (!ol) return null;
        const items = [...ol.querySelectorAll('li')].map(li => ({
            n: (li.querySelector('.lesson-sibling-n') || {}).textContent,
            title: ((li.querySelector('.lesson-sibling-t') || {}).textContent || '').trim(),
        }));
        return items.length ? { items } : null;`;

    const COURSE_READER = `
        const cards = [...document.querySelectorAll('.lessons-list .lesson-card')];
        if (!cards.length) return null;
        const items = cards.map((card, i) => ({
            n: String(i + 1),
            title: ((card.querySelector('.lesson-title-link') || {}).textContent || '').trim(),
        }));
        return items.every(r => r.title) ? { items } : null;`;

    let rows = await readList(ROUTE, LESSON_READER);

    if (rows?.redirected) {
        check('the page renders without an account', false, rows.redirected);
    } else if (!rows) {
        check('the lesson list rendered', false, 'no ol.lesson-siblings after 80s');
    } else {
        const { items } = rows;
        console.log('  rendered order, as the reader sees it:');
        items.slice(0, 3).forEach(r => console.log(`     ${r.n}  ${r.title}`));
        console.log('     ...');
        console.log(`     ${items[items.length - 1].n}  ${items[items.length - 1].title}`);
        console.log('');

        const nums = items.map(r => {
            const m = /Module\s+(\d+)/i.exec(r.title);
            return m ? Number(m[1]) : null;
        });
        check('the list rendered at all', items.length > 1, items.length);
        check('every row is a numbered module', nums.every(n => n !== null));
        check('the FIRST rendered lesson is Module 1', nums[0] === 1, items[0]?.title);
        check('the LAST rendered lesson is the highest module',
              nums[nums.length - 1] === Math.max(...nums), items[items.length - 1]?.title);
        check('the module numbers ascend down the page',
              nums.every((n, i) => i === 0 || n > nums[i - 1]));
        check('the visible counter matches the position',
              items.every((r, i) => String(r.n).trim() === String(i + 1)));
        // The bug, stated as the thing that must not be true again.
        check('the list is NOT reversed',
              !(nums[0] === Math.max(...nums) && nums[nums.length - 1] === Math.min(...nums)));
    }

    console.log(`
  --- the course page, ${BASE}/#${COURSE_ROUTE} ---`);
    const courseRows = await readList(COURSE_ROUTE, COURSE_READER);
    if (courseRows?.redirected) {
        check('the course page renders without an account', false, courseRows.redirected);
    } else if (!courseRows) {
        check('the course page lesson list rendered', false, 'no .lesson-card after 80s');
    } else {
        const titles = courseRows.items.map(r => r.title);
        const cnums = titles.map(t => { const m = /Module\s+(\d+)/i.exec(t); return m ? Number(m[1]) : null; });
        console.log(`     1  ${titles[0]}`);
        console.log('     ...');
        console.log(`     ${titles.length}  ${titles[titles.length - 1]}`);
        check('the course page lists every lesson', titles.length === 31, titles.length);
        check('the course page starts at Module 1', cnums[0] === 1, titles[0]);
        check('the course page ascends too',
              cnums.every((n, i) => i === 0 || (n !== null && n > cnums[i - 1])));
        check('both pages agree on the order',
              titles.join('|') === rows.items.map(r => r.title).join('|'));
    }
} catch (error) {
    check('the browser run completed', false, String(error.message || error));
} finally {
    cdp.close();
    chrome.kill();
}

console.log(failures ? `\n${failures} check(s) FAILED\n` : '\nRendered order confirmed in a real browser.\n');
process.exit(failures ? 1 : 0);
