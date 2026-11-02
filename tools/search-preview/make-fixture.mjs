// Records the site search's fixture from the LIVE services, read-only.
//
//   node tools/search-preview/make-fixture.mjs
//
// A stub written from a guess at the payload proves nothing about the code that
// reads it (the leaderboard preview and app 23's identity e2e both paid for
// that), so the harness answers with what the services really send - trimmed
// to the fields `siteSearch.service.ts` reads, so the file stays small, but in
// each service's own envelope (`{count, results}`, `{labs, tracks}`, a bare
// array) so the real loaders and slimmers run against it.
//
// Reads AUTH_TOKEN and the registry from .env. Only GETs. Prints counts, never
// a token or a replica credential.
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter(line => line.includes('=') && !line.trim().startsWith('#'))
    .map(line => {
        const at = line.indexOf('=');
        return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^["']|["']$/g, '')];
    }));
const headers = { Authorization: `Token ${env.VITE_AUTH_TOKEN}` };
const registries = [env.VITE_API_BASE_REGISTRY, env.VITE_REGISTRY_ALT].filter(Boolean);

async function replica(appId) {
    for (const registry of registries) {
        try {
            const response = await fetch(`${registry.replace(/^http:/, 'https:')}/apps/${appId}/`, { headers });
            if (!response.ok) continue;
            const body = await response.json();
            return body.replicas[0].replica_url.replace(/\/$/, '').replace(/^http:/, 'https:');
        } catch { /* next registry */ }
    }
    throw new Error(`app ${appId} could not be resolved`);
}

async function get(appId, path) {
    const base = await replica(appId);
    const response = await fetch(base + path, { headers });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
}

const cut = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '');
function tr(map, names, n = 200) {
    const out = {};
    for (const [lang, entry] of Object.entries(map || {})) {
        const kept = {};
        for (const name of names) if (entry?.[name]) kept[name] = cut(entry[name], n);
        if (Object.keys(kept).length) out[lang] = kept;
    }
    return out;
}
const list = payload => (Array.isArray(payload) ? payload : payload?.results || []);

const courses = list(await get(19, '/courses/')).map(c => ({
    id: c.id, external_course_id: c.external_course_id, title: c.title,
    description: cut(c.description, 240), translations: tr(c.translations, ['title', 'description'], 240),
}));
const lessons = list(await get(19, '/lessons/')).map(l => ({
    external_lesson_id: l.external_lesson_id, title: l.title, course_external_id: l.course_external_id,
    translations: tr(l.translations, ['title']),
}));
const labsRaw = await get(11, '/api/labs/');
const labs = (labsRaw.labs || []).map(l => ({
    id: l.id, track: l.track, title: l.title, summary: cut(l.summary, 200), difficulty: l.difficulty,
    topics: (l.topics || []).slice(0, 8), translations: tr(l.translations, ['title', 'summary']),
}));
const tracks = ((await get(11, '/api/labs/tracks/')).tracks || []).map(t => ({
    id: t.id, title: t.title, translations: tr(t.translations, ['title']),
}));
const playgrounds = ((await get(11, '/api/labs/playgrounds/')).playgrounds || []).map(p => ({
    id: p.id, title: p.title, summary: cut(p.summary, 160),
    tools: (p.tools || []).slice(0, 8).map(t => ({ id: t.id, label: t.label })),
    translations: tr(p.translations, ['title', 'summary'], 160),
}));
const titles = await get(20, '/assessment-titles/');
const slimTitle = a => ({ external_id: a.external_id, title: a.title, course_id: a.course_id,
    lesson_id: a.lesson_id, translations: tr(a.translations, ['title']) });
const assessments = { exams: (titles.exams || []).map(slimTitle), quizzes: (titles.quizzes || []).map(slimTitle) };
const runbooks = list(await get(17, '/runbooks/')).map(r => ({
    id: r.id, sync_id: r.sync_id, title: r.title, course_id: r.course_id, lesson_id: r.lesson_id,
    translations: tr(r.translations, ['title']), sections: [],
}));

const fixture = {
    recorded: new Date().toISOString().slice(0, 10),
    courses: { count: courses.length, next: null, previous: null, results: courses },
    lessons: { count: lessons.length, next: null, previous: null, results: lessons },
    labs: { count: labs.length, labs, track: null, tracks: [] },
    tracks: { tracks },
    playgrounds: { playgrounds },
    assessments,
    runbooks,
};
writeFileSync('tools/search-preview/stubs/fixture.json', JSON.stringify(fixture));
console.log(`courses ${courses.length}, lessons ${lessons.length}, labs ${labs.length}, tracks ${tracks.length}, `
    + `playgrounds ${playgrounds.length}, exams ${assessments.exams.length}, quizzes ${assessments.quizzes.length}, `
    + `runbooks ${runbooks.length}`);
