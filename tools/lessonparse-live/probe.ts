// Parse the LIVE lesson write-ups with the frontend's own module.
//
//   node parse_live.mjs            # every course in the pack
//
// A fixture proves the parser handles a table. This proves it handles the 65
// write-ups that are actually stored - which is a different question, and the
// one that decides whether a reader sees a table or a run of pipe characters.
//
// It reads app 19 through the registry with the shared token, exactly as the
// browser does, and runs `blocks()` and `readingMinutes()` over what comes
// back. Built by `npm run build:lessonparse` into the check harness's own
// bundle, because the module is TypeScript.
import { blocks, outline, readingMinutes } from '@/utils/lessonContent';

const TOKEN = process.env.SFS_TOKEN;
const REGISTRY = [
    'https://sfsdomains1.pythonanywhere.com',
    'https://sfsdomains2.pythonanywhere.com',
];

async function get(url) {
    const res = await fetch(url, {
        headers: { Authorization: `Token ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
}

async function replicas(appId) {
    for (const base of REGISTRY) {
        try {
            const body = await get(`${base}/apps/${appId}/`);
            return body.replicas.map(r =>
                r.replica_url.replace(/\/$/, '').replace('http://', 'https://'));
        } catch { /* try the next */ }
    }
    throw new Error('no registry answered');
}

async function paged(base, path) {
    const body = await get(base + path);
    return Array.isArray(body) ? body : (body.results || []);
}

const SLUGS = process.argv.slice(2);

const base = (await replicas(19))[0];
const courses = await paged(base, '/courses/');
const lessons = await paged(base, '/lessons/');

let problems = 0;
let tables = 0;
let checked = 0;
let blank = 0;

for (const course of courses) {
    const id = course.external_course_id;
    const own = lessons.filter(l => l.course_external_id === id);
    if (!own.some(l => /^Module \d+:/.test(l.title || ''))) continue;
    if (SLUGS.length && !SLUGS.some(s => (course.title || '').toLowerCase()
                                            .includes(s.toLowerCase()))) continue;

    const found = [];
    for (const lesson of own) {
        // A LESSON WITH NO WRITE-UP IS A LEGITIMATE STATE, not a failure: only
        // `title` and the course are mandatory on app 19, and a syllabus is
        // routinely entered before the material exists. Counting those as
        // problems made this probe report three pre-existing lessons and
        // drowned the one signal it is for.
        if (!(lesson.content || '').trim()) { blank++; continue; }
        checked++;
        const parsed = blocks(lesson.content || '');
        const kinds = parsed.map(b => b.kind);

        // THE FAILURE THIS SCRIPT EXISTS FOR: a table falling through to the
        // paragraph branch arrives as one run of pipe characters.
        const piped = parsed.filter(b => b.kind === 'paragraph'
                                         && b.text.split('|').length > 3);
        if (piped.length) {
            problems++;
            found.push(`  PIPES  ${lesson.title}\n         ${piped[0].text.slice(0, 90)}`);
        }
        // An unterminated fence swallows the rest of the document, so a
        // write-up whose last block is code and which has an odd fence count
        // is worth naming.
        const fences = (lesson.content || '').split('\n')
            .filter(l => /^\s*```/.test(l)).length;
        if (fences % 2 !== 0) {
            problems++;
            found.push(`  FENCE  ${lesson.title} has ${fences} fence lines`);
        }
        if (!parsed.length) {
            problems++;
            found.push(`  EMPTY  ${lesson.title} has content that parsed to nothing`);
        }
        if (outline(lesson.content || '').length === 0) {
            found.push(`  NOHEAD ${lesson.title} has no headings`);
        }
        const t = parsed.filter(b => b.kind === 'table');
        tables += t.length;
        for (const table of t) {
            const width = table.head.length || table.rows[0]?.length || 0;
            if (table.rows.some(r => r.length !== width)) {
                problems++;
                found.push(`  RAGGED ${lesson.title}`);
            }
            if (!table.rows.length) {
                problems++;
                found.push(`  NOROWS ${lesson.title} has a table with no rows`);
            }
        }
        if (readingMinutes(lesson.content || '') < 1) {
            problems++;
            found.push(`  SHORT  ${lesson.title} reads as under a minute`);
        }
        void kinds;
    }
    console.log(`${(course.title || '').padEnd(44)} lessons=${String(own.length).padStart(2)} ${found.length ? 'NOTES' : 'clean'}`);
    for (const row of found) console.log(row);
}

console.log('');
console.log(`${checked} write-ups parsed, ${tables} tables found, `
    + `${problems} problem(s)`);
console.log(`${blank} lesson(s) have no write-up yet, which is a legitimate `
    + 'state and not counted');
process.exit(problems === 0 ? 0 : 1);
