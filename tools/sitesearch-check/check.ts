// Verifies src/utils/siteSearch.ts without a browser.
//
//   npm run check:sitesearch
//
// The site search is a plain module for exactly this reason: every decision it
// makes is invisible in a screenshot. Whether an Arabic query typed without a
// hamza finds a title written with one; whether a Chinese query matches at all
// (Chinese writes no spaces, so a word-boundary rule rejects every one of them);
// whether two equally good rows trade places as somebody types; whether a
// runbook the reader cannot open is a lock or a link the guard bounces;
// whether an exam result carries anything but a title. All of it is asserted
// here, plus the source-level rules: nothing reaches `v-html`, the panel is a
// lazy chunk, and the loaders never fetch app 20's paper-carrying routes.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    SECTIONS, addRecent, buildIndex, canon, cleanRecent, courseDocs, destination, examDocs,
    fold, foldWithMap, highlight, labDocs, lessonDocs, lockFor, pageDocs, quizDocs,
    runbookDocs, search, sectionJump, snippet, stepActive, strength, terms, textIn,
    withinOneEdit,
    type SearchDoc,
} from '../../src/utils/siteSearch';
import type { Access } from '../../src/navigation/appNav';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail: unknown = '') {
    if (ok) passes++;
    else failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}
const section = (title: string) => console.log(`\n${title}`);

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
/** Comments blanked, so a rule cannot be satisfied (or tripped) by the explanation beside it. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '');

const NONE: Access = { auth: false, ai: false, lab: false, runbook: false, research: false, toastmasters: false, exam: false, proctor: false };
const SIGNED: Access = { ...NONE, auth: true };
const ALL: Access = { auth: true, ai: true, lab: true, runbook: true, research: true, toastmasters: true, exam: true, proctor: true };
const id = (s: string) => s;

/* ------------------------------------------------------------------ */
section('1. Folding');
{
    check('case', fold('DoCkEr') === 'docker');
    check('Latin diacritics', fold('Café Résumé naïve') === 'cafe resume naive', fold('Café Résumé naïve'));
    check('punctuation is one space', fold('CI/CD -- pipelines!!') === 'ci cd pipelines', fold('CI/CD -- pipelines!!'));
    check('leading/trailing/repeated separators collapse', fold('  a   b  ') === 'a b');
    check('full-width forms', fold('ＤＯＣＫＥＲ') === 'docker', fold('ＤＯＣＫＥＲ'));
    check('Arabic hamza on alef: أ إ آ -> ا', fold('أساسيات إدارة آلة') === fold('اساسيات ادارة الة'), [fold('أساسيات إدارة آلة')]);
    check('Arabic alef maqsura -> yeh', fold('مستوى') === fold('مستوي'));
    check('Arabic teh marbuta -> heh', fold('شبكة') === fold('شبكه'));
    check('Arabic harakat are removed', fold('مُخْتَبَر') === 'مختبر', fold('مُخْتَبَر'));
    check('tatweel is removed', fold('مـــختبر') === 'مختبر');
    check('hamza on waw/yeh unified', fold('مؤتمر سائل') === fold('موتمر سايل'));
    check('Arabic-Indic digits are Latin digits', fold('الوحدة ١٢') === fold('الوحده 12'), fold('الوحدة ١٢'));
    check('Chinese passes through unchanged', fold('大数据基础') === '大数据基础');
    check('empty and nullish', fold('') === '' && fold(undefined as any) === '');
}

section('2. foldWithMap agrees with fold, and maps back');
{
    for (const s of ['Café — Résumé', '  ci/cd  ', 'أساسيات الشبكات', '大数据 基础', 'ＡＢ c', 'ﬁle']) {
        const m = foldWithMap(s);
        check(`same text as fold(): ${JSON.stringify(s)}`, m.folded === fold(s), [m.folded, fold(s)]);
        check(`one offset pair per folded char: ${JSON.stringify(s)}`,
            m.start.length === m.folded.length && m.end.length === m.folded.length
            && m.start.every((v, i) => v >= 0 && v < m.end[i] && m.end[i] <= s.length));
    }
}

section('3. Terms and strength');
{
    check('terms are folded and de-duplicated', JSON.stringify(terms('Docker  docker DOCKER compose')) === '["docker","compose"]');
    check('at most eight terms', terms('a b c d e f g h i j k').length === 8);
    check('prefix = 3', strength('docker compose', 'dock') === 3);
    check('word start = 2', strength('learn docker', 'dock') === 2);
    check('substring = 1', strength('dockerize', 'kerize') === 1);
    check('absent = 0', strength('docker', 'kube') === 0);
    check('a single Latin letter mid-word is noise', strength('docker', 'o') === 0);
    check('...but counts at a word start', strength('the docker', 'd') === 2);
    check('CJK is a word start anywhere (no spaces in Chinese)', strength('学习大数据基础', '数据') === 2);
    check('a later word-start occurrence is found after an earlier substring',
        strength('xdock dock', 'dock') === 2);
}

section('4. One-edit matching');
{
    check('substitution', withinOneEdit('kubernates', 'kubernetes'));
    check('deletion', withinOneEdit('kubernets', 'kubernetes'));
    check('insertion', withinOneEdit('kubernettes', 'kubernetes'));
    check('adjacent swap', withinOneEdit('kuberentes', 'kubernetes'));
    check('two edits refused', !withinOneEdit('kubrnets', 'kubernetes'));
    check('length differs by two refused', !withinOneEdit('dock', 'docker'));
}

/* ------------------------------------------------------------------ */
const mk = (over: Partial<SearchDoc>): SearchDoc => ({
    section: 'courses', id: over.title || 'x', title: '', alt: [], subtitle: '', ctx: [], body: [],
    to: { path: '/x' }, icon: 'course', kind: '', lock: null, rank: 0, ...over,
});

section('5. Scoring');
{
    const docs = [
        mk({ id: 'sub', title: 'Containerized Dockerization', rank: 0 }),
        mk({ id: 'word', title: 'Learn Docker basics', rank: 1 }),
        mk({ id: 'prefix', title: 'Docker deep dive', rank: 2 }),
        mk({ id: 'exact', title: 'Docker', rank: 3 }),
        mk({ id: 'ctx', title: 'Volumes', ctx: ['Docker Mastery'], rank: 4 }),
        mk({ id: 'body', title: 'Images', body: ['how a docker image is layered'], rank: 5 }),
        mk({ id: 'none', title: 'Kubernetes', rank: 6 }),
    ];
    const idx = buildIndex(docs);
    const order = search(idx, 'docker', { limit: 20 }).find(r => r.section === 'courses')!.hits.map(h => h.doc.id);
    check('exact > prefix > word start > substring > context > description',
        JSON.stringify(order) === JSON.stringify(['exact', 'prefix', 'word', 'sub', 'ctx', 'body']), order);
    check('a record matching nothing is absent', !order.includes('none'));

    const and = search(idx, 'docker volumes', { limit: 20 })[1].hits.map(h => h.doc.id);
    check('every term must match somewhere (AND)', JSON.stringify(and) === '["ctx"]', and);

    const short = search(buildIndex([mk({ id: 'a', title: 'Images', body: ['an overview'] })]), 'vi', { limit: 5 });
    check('a two-letter substring in a description is a coincidence, not a match',
        short[1].total === 0, short[1]);

    const fuzzy = search(buildIndex([mk({ id: 'k', title: 'Kubernetes for admins' })]), 'kubernets', { limit: 5 })[1];
    check('a one-letter typo still finds the title', fuzzy.total === 1 && fuzzy.hits[0].fuzzy);
    const exactFirst = search(buildIndex([
        mk({ id: 'typo', title: 'Kubernetes', rank: 0 }),
        mk({ id: 'real', title: 'Kubernets explained', rank: 1 }),
    ]), 'kubernets', { limit: 5 })[1].hits.map(h => h.doc.id);
    check('...but an exact match ranks above a typo match', exactFirst[0] === 'real', exactFirst);

    const locked = search(buildIndex([
        mk({ id: 'locked', title: 'Linux runbook', rank: 0, lock: { kind: 'plan', feature: 'runbook', to: { path: '/plans' } } }),
        mk({ id: 'open', title: 'Linux runbook', rank: 1 }),
    ]), 'linux', { limit: 5 })[1].hits.map(h => h.doc.id);
    check('a locked result sorts below an equal open one', locked[0] === 'open', locked);
}

section('6. Every language a record carries is matched');
{
    const course = { id: 'c1', title: 'Network Fundamentals', description: 'Routing and switching',
        translations: { ar: { title: 'أساسيات الشبكات', description: 'التوجيه والتبديل' }, zh: { title: '网络基础', description: '路由与交换' } } };
    for (const locale of ['en', 'ar', 'zh'] as const) {
        const idx = buildIndex(courseDocs([course], locale));
        for (const q of ['network', 'اساسيات', 'الشبكات', '网络', 'شبكات']) {
            const hits = search(idx, q)[1].total;
            check(`locale ${locale}, query ${q}`, hits === 1, hits);
        }
    }
    const ar = courseDocs([course], 'ar')[0];
    check('the displayed title is the reader\'s language', ar.title === 'أساسيات الشبكات');
    const untranslated = courseDocs([{ id: 'c2', title: 'Kivy', translations: { zh: { title: '凯维' } } }], 'ar')[0];
    check('no Arabic: the English, never the Chinese', untranslated.title === 'Kivy', untranslated.title);
    check('textIn ignores a blank translation', textIn({ title: 'X', translations: { ar: { title: '  ' } } }, 'title', 'ar') === 'X');
    const hl = highlight('أساسيات الشبكات', 'اساسيات');
    check('an unhamzated query highlights the hamzated word', hl.some(s => s.match && s.text === 'أساسيات'), hl);
}

section('7. A total order: permuting the input changes nothing');
{
    const docs: SearchDoc[] = [];
    for (let i = 0; i < 30; i++) docs.push(mk({ id: `d${String(i).padStart(2, '0')}`, title: `Python lesson ${i % 3}`, rank: 0 }));
    const ref = search(buildIndex(docs), 'python', { limit: 50 })[1].hits.map(h => h.doc.id).join(',');
    let stable = true;
    let seed = 7;
    for (let round = 0; round < 20; round++) {
        const copy = docs.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const j = seed % (i + 1);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        const got = search(buildIndex(copy), 'python', { limit: 50 })[1].hits.map(h => h.doc.id).join(',');
        if (got !== ref) stable = false;
    }
    check('same order for 20 shuffles of identical-score rows', stable);
    const tie = search(buildIndex([
        mk({ id: 'a', title: 'Python b', rank: 0 }),
        mk({ id: 'z', title: 'Python a', rank: 0 }),
    ]), 'python')[1].hits.map(h => h.doc.id).join(',');
    check('an equal score and rank falls back to the title, not the id', tie === 'z,a', tie);
}

section('8. Caps and "show more"');
{
    const docs = Array.from({ length: 12 }, (_, i) => mk({ id: `l${i}`, section: 'lessons', title: `SQL joins ${i}`, rank: i }));
    const r = search(buildIndex(docs), 'sql').find(s => s.section === 'lessons')!;
    check('five shown by default', r.hits.length === 5 && r.total === 12 && r.more === 7, r);
    const e = search(buildIndex(docs), 'sql', { expanded: ['lessons'] }).find(s => s.section === 'lessons')!;
    check('an expanded section shows everything up to its cap', e.hits.length === 12 && e.more === 0);
    check('every section is reported, in the drawing order',
        JSON.stringify(search(buildIndex(docs), 'sql').map(s => s.section)) === JSON.stringify(SECTIONS));
    check('an empty query searches nothing', search(buildIndex(docs), '   ').length === 0);
}

section('9. Highlighting draws text, never markup');
{
    const attack = '<img src=x onerror=alert(1)> Docker';
    const segs = highlight(attack, 'docker');
    check('segments rejoin to the original exactly', segs.map(s => s.text).join('') === attack);
    check('only the match is marked', segs.filter(s => s.match).map(s => s.text).join('|') === 'Docker', segs);
    const cafe = highlight('Café au lait', 'cafe');
    check('an unaccented query marks the accented original', cafe[0].match && cafe[0].text === 'Café', cafe);
    check('overlapping terms merge into one mark', highlight('kubernetes', 'kube ernet').filter(s => s.match).length === 1);
    check('a single letter mid-word is not marked', highlight('docker', 'o').every(s => !s.match));
    check('nothing typed: one plain segment', highlight('abc', '').length === 1);
}

/* ------------------------------------------------------------------ */
section('10. Documents and their routes');
{
    const router = code(read('src/router/index.ts'));
    for (const pattern of ["'course/:id'", "'course/:courseId/lesson/:lessonId'", "'lab/:labId'",
        "'playground/:playgroundId'", "'runbooks/:id'", "'take-quiz'", "'exams'", "'login'", "'plans'"]) {
        check(`the router has ${pattern}`, router.includes(`path: ${pattern}`));
    }
    const courses = [{ id: 'aa11-bb22', title: 'Docker Mastery', translations: { ar: { title: 'إتقان دوكر' } } }];
    const lessons = [{ id: 'les-1', title: 'Volumes', course: 'AA11BB22' }];
    const [c] = courseDocs(courses, 'en');
    check('course -> /course/<external id>', c.to.path === '/course/aa11-bb22', c.to);
    const [l] = lessonDocs(lessons, courses, 'ar');
    check('lesson -> /course/<course>/lesson/<lesson>', l.to.path === '/course/AA11BB22/lesson/les-1', l.to);
    check('a lesson is joined to its course whatever the uuid spelling', l.subtitle === 'إتقان دوكر', l.subtitle);
    check('canon() ignores dashes and case', canon('AA11-bb22') === 'aa11bb22');

    const labs = labDocs(
        [{ id: 'dkr-01', title: 'First container', track: 'docker', difficulty: 'beginner' }],
        [{ id: 'docker', title: 'Docker' }],
        [{ id: 'play-docker', title: 'Docker playground', tools: ['docker'] }],
        'en', ALL, id);
    check('lab -> /lab/<id>', labs[0].to.path === '/lab/dkr-01');
    check('the lab names its track and level', labs[0].subtitle === 'Docker · Beginner', labs[0].subtitle);
    check('playground -> /playground/<id>, badged', labs[1].to.path === '/playground/play-docker' && labs[1].kind === 'playground');
    check('a lab sorts before a playground on a tie', labs[0].rank < labs[1].rank);

    const quizzes = quizDocs([{ id: 'q1', title: 'Volumes quiz', course: 'aa11bb22', lesson: 'les-1' }], lessons, courses, 'en', ALL);
    check('quiz -> /take-quiz with the three ids the page reads',
        quizzes[0].to.path === '/take-quiz' && quizzes[0].to.query?.quizId === 'q1'
        && quizzes[0].to.query?.lessonId === 'les-1' && quizzes[0].to.query?.courseId === 'aa11bb22', quizzes[0].to);
    check('a quiz is named after its lesson', quizzes[0].subtitle === 'Volumes');

    const exams = examDocs([{ id: 'e1', title: 'Docker Final Exam', course: 'aa11bb22', lesson: '',
        translations: { ar: { title: 'الامتحان النهائي' } } }], courses, 'ar');
    check('exam -> /exams filtered by its ENGLISH title, whatever the reader\'s language',
        exams[0].to.path === '/exams' && exams[0].to.query?.q === 'Docker Final Exam', exams[0].to);
    check('...while it is DISPLAYED in Arabic', exams[0].title === 'الامتحان النهائي');

    const runbooks = runbookDocs([{ id: '42', title: 'Runbook: volumes', course: 'aa11bb22', lesson: 'les-1' }], lessons, courses, 'en', ALL);
    check('runbook -> /runbooks/<numeric id>', runbooks[0].to.path === '/runbooks/42');
    check('snippet cuts at a word', snippet('one two three four five six seven', 14) === 'one two three…', snippet('one two three four five six seven', 14));
}

section('11. Locks: shown, never a dead link');
{
    const rb = { id: '7', title: 'Linux runbook' };
    const [out] = runbookDocs([rb], [], [], 'en', NONE);
    check('signed out: a runbook is a sign-in lock', out.lock?.kind === 'signin');
    check('...whose link returns to the runbook after signing in',
        destination(out).path === '/login' && destination(out).query?.redirect === '/runbooks/7', destination(out));
    const [noPlan] = runbookDocs([rb], [], [], 'en', SIGNED);
    check('signed in without the feature: a plan lock to /plans',
        noPlan.lock?.kind === 'plan' && noPlan.lock.feature === 'runbook' && destination(noPlan).path === '/plans');
    const [open] = runbookDocs([rb], [], [], 'en', { ...SIGNED, runbook: true });
    check('with the feature: open, and the link is the runbook', open.lock === null && destination(open).path === '/runbooks/7');
    const [quiz] = quizDocs([{ id: 'q', title: 'Q', course: 'c', lesson: 'l' }], [], [], 'en', NONE);
    check('a sign-in redirect keeps the query string',
        String(destination(quiz).query?.redirect).startsWith('/take-quiz?quizId=q'), destination(quiz));
    check('a public page has no lock signed out', lockFor('public', NONE, { path: '/courses' }) === null);
    check('courses, lessons and exams are never locked',
        courseDocs([{ id: 'c', title: 'C' }], 'en')[0].lock === null
        && examDocs([{ id: 'e', title: 'E', course: '', lesson: '' }], [], 'en')[0].lock === null);
    const labNone = labDocs([{ id: 'x', title: 'X', track: 't' }], [], [], 'en', SIGNED, id)[0];
    check('a lab without lab_feature is a plan lock', labNone.lock?.feature === 'lab');
}

section('12. Pages come from the sidebar registry');
{
    const guest = pageDocs(NONE, id);
    const proctor = pageDocs(ALL, id);
    const paths = guest.map(d => d.id);
    check('Home is in it', paths.includes('/'));
    check('no page appears twice', new Set(paths).size === paths.length);
    check('a proctor\'s page is absent for everybody else', !paths.includes('/proctor-dashboard'));
    check('...and present for a proctor', proctor.some(d => d.id === '/proctor-dashboard'));
    check('the Newscast is open signed out', guest.find(d => d.id === '/newscast')?.lock === null);
    check('the AI chat is a sign-in lock signed out', guest.find(d => d.id === '/ai-chat')?.lock?.kind === 'signin');
    const signedNoAi = pageDocs(SIGNED, id).find(d => d.id === '/ai-chat');
    check('...and a plan lock signed in without ai_feature', signedNoAi?.lock?.kind === 'plan' && signedNoAi.lock.feature === 'ai');
    const t = (s: string) => (s === 'Courses' ? 'الدورات' : s);
    const ar = pageDocs(NONE, t).find(d => d.id === '/courses')!;
    check('a page shows its translated label and still matches the English',
        ar.title === 'الدورات' && search(buildIndex([ar]), 'courses')[0].total === 1);
    check('keywords find a page by what it does', search(buildIndex(guest), 'netsim')[0].total >= 1);
}

section('13. The keyboard');
{
    const opts = [
        { section: 'pages' }, { section: 'pages' }, { section: 'courses' },
        { section: 'labs' }, { section: 'labs' }, { section: 'labs' },
    ];
    check('Tab from nothing goes to the first section', sectionJump(opts, -1, false) === 0);
    check('Tab goes to the next section\'s first row', sectionJump(opts, 1, false) === 2 && sectionJump(opts, 2, false) === 3);
    check('Tab at the last section falls through', sectionJump(opts, 4, false) === null);
    check('Shift+Tab goes to the previous section', sectionJump(opts, 4, true) === 2);
    check('Shift+Tab at the first section falls through', sectionJump(opts, 0, true) === null);
    check('Down from nothing is the first row', stepActive(6, -1, 1) === 0);
    check('Up from nothing is the last row', stepActive(6, -1, -1) === 5);
    check('Down wraps', stepActive(6, 5, 1) === 0);
    check('no rows: nothing active', stepActive(0, 3, 1) === -1);
}

section('14. Recent searches');
{
    let list: string[] = [];
    list = addRecent(list, 'docker');
    list = addRecent(list, '  Kubernetes   pods ');
    list = addRecent(list, 'DOCKER');
    check('newest first, folded duplicates replaced', JSON.stringify(list) === '["DOCKER","Kubernetes pods"]', list);
    for (let i = 0; i < 20; i++) list = addRecent(list, `q${i}`);
    check('capped at eight', list.length === 8);
    check('a blank query is not recorded', addRecent(['a'], '   ').length === 1);
    check('storage junk is dropped', JSON.stringify(cleanRecent(['a', 3, null, 'A', 'b'])) === '["a","b"]');
    check('a non-array is nothing', cleanRecent({}).length === 0);
}

section('15. Speed');
{
    const docs: SearchDoc[] = [];
    const words = ['docker', 'kubernetes', 'linux', 'python', 'sql', 'network', 'azure', 'aws', 'spark', 'terraform'];
    for (let i = 0; i < 4000; i++) {
        docs.push(mk({ id: `x${i}`, section: SECTIONS[i % SECTIONS.length], title: `${words[i % 10]} module ${i} ${words[(i * 7) % 10]}`,
            alt: [`الوحدة ${i}`], ctx: [`course ${words[(i * 3) % 10]}`], body: ['a description of the material in some detail'] }));
    }
    const t0 = Date.now();
    const idx = buildIndex(docs);
    const built = Date.now() - t0;
    const t1 = Date.now();
    for (const q of ['dock', 'kubernetes module', 'الوحدة', 'zzz', 'pythn']) search(idx, q);
    const each = (Date.now() - t1) / 5;
    check(`indexing 4,000 records is quick (${built} ms)`, built < 1500, built);
    check(`a keystroke is quick (${each.toFixed(1)} ms per search)`, each < 60, each);
}

/* ------------------------------------------------------------------ */
section('16. Source rules');
{
    const service = code(read('src/services/siteSearch.service.ts'));
    check('the loaders never fetch app 20\'s /exams/ or /quizzes/ (they carry the answer key)',
        !/['"`]\/(exams|quizzes|exam-questions|quiz-questions|exam-answers|quiz-answers)\//.test(service));
    check('...they use /assessment-titles/', service.includes("'/assessment-titles/'"));
    check('the lab catalogue names its key (two lists come back)', /catalogue\?\.labs/.test(service));
    const slim = service.match(/export function slimAssessment[\s\S]*?\n}/)?.[0] || '';
    check('an assessment keeps id, title, course, lesson and translations only',
        !!slim && !/question|answer|is_correct|instructions/.test(slim), slim);

    const panel = read('src/components/search/SiteSearchPanel.vue');
    const top = read('src/components/TopBar.vue');
    for (const [name, src] of [['SiteSearchPanel.vue', panel], ['TopBar.vue', top]] as const) {
        check(`${name}: nothing reaches v-html`, !/v-html|innerHTML/.test(code(src)));
    }
    check('the panel is a lazy chunk (defineAsyncComponent + dynamic import)',
        /defineAsyncComponent\(/.test(top) && /import\(['"]@\/components\/search\/SiteSearchPanel\.vue['"]\)/.test(top));
    check('...and is never imported statically', !/^\s*import\s+\w+\s+from\s+['"]@\/components\/search\/SiteSearchPanel\.vue['"]/m.test(top));
    check('the panel renders outside the backdrop-filtered bar',
        top.indexOf('<SiteSearchPanel') > top.indexOf('</div>', top.indexOf('class="sfs-topbar__inner"'))
        && top.indexOf('<SiteSearchPanel') > top.lastIndexOf('<span class="sfs-topbar__spacer">'));
    check('the field is a combobox wired to the listbox',
        /role="combobox"/.test(top) && /aria-controls="sfs-gs-listbox"/.test(top) && /aria-activedescendant/.test(top));
    check('the panel loads its own stylesheet (it travels in the lazy chunk)',
        /import '@\/assets\/css\/site-search\.css'/.test(panel));

    const css = read('src/assets/css/site-search.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const foreign: string[] = [];
    for (const rule of css.matchAll(/([^{}@]+)\{/g)) {
        for (const raw of rule[1].split(',')) {
            const sel = raw.trim();
            if (!sel || /^(from|to|\d+%)$/.test(sel)) continue;
            for (const m of sel.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
                // A state modifier (`is-active`) only ever compounds an sfs-gs class.
                if (!m[1].startsWith('sfs-gs') && !m[1].startsWith('is-')) foreign.push(sel);
            }
        }
    }
    check('site-search.css declares nothing outside the sfs-gs namespace', foreign.length === 0, foreign);
    check('...and no colour literal outside a var() fallback',
        !/:\s*(#[0-9a-f]{3,8}|rgb\(\d)/i.test(css.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, '')),
        css.match(/:\s*(#[0-9a-f]{3,8}|rgb\(\d)[^;]*/i)?.[0]);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
