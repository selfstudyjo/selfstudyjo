// Verifies Noor, the site assistant, without a browser.
//
//   npm run check:assistant
//
// WHAT IS WORTH ASSERTING, AND WHY NONE OF IT IS VISIBLE IN A SCREENSHOT
//
// Every failure this feature has is silent. She keeps answering, the window
// keeps looking right, and what has actually happened is:
//
//  * **a button to nowhere.** A destination whose `to` the router cannot match
//    renders as a perfectly ordinary "Open Labs" that lands on the catch-all.
//    The only symptom is a reader pressing it twice.
//  * **an invented page.** A model asked for a URL will produce `/dashboard`,
//    `/my-courses`, `/settings` — plausible, and none of them a route here. The
//    protocol is an id off a closed list for exactly that reason, and the check
//    that matters is that an id NOT on the list is dropped.
//  * **an empty bubble.** `parseReply` is called from the send handler; a throw
//    there is a spinner that never stops, which reads as the provider having
//    gone away, so nobody would look here.
//  * **"you have no certificates"** — the assistant's version of the leaderboard's
//    "Untitled" chart. A section that failed to load, rendered as an empty one,
//    tells a student their credentials are gone.
//  * **an answer key in the process.** The one guarantee rather than a request:
//    the service is read off disk and must name none of app 20's six paper
//    collections.
//  * **a solve request that got through**, and — just as important — an
//    ordinary question that did NOT. A detector that fires on "how many quizzes
//    are in this course" is one a reader has to fight.
//  * **an untranslated bubble.** Every string is spent through a variable, so
//    `check:i18n` cannot see the literal; `ASSISTANT_KEYS` is what it verifies
//    against and it is derived from the constants rather than written twice.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    ASSISTANTS,
    ASSISTANT_FIGURE_ID,
    ASSISTANT_KEYS,
    ASSISTANT_NAME,
    BUTTON_LABEL,
    CAST_STORAGE_KEY,
    DEFAULT_ASSISTANT,
    AUTO_SEND_MIN_CHARS,
    AUTO_SEND_SILENCE_MS,
    EMPTY_CONTEXT,
    GREETING_SIGNED_IN,
    GREETING_SIGNED_OUT,
    HISTORY_TURNS,
    MAX_ROWS,
    MIC_FAILED,
    MIC_LABEL,
    NO_ACCESS,
    NO_ANSWER,
    REFUSAL,
    SERVICE_BUSY,
    SERVICE_UNREACHABLE,
    STATE_LABELS,
    SUGGESTIONS_SIGNED_IN,
    THINKING_LABEL,
    SUGGESTIONS_SIGNED_OUT,
    VOICE_LABELS,
    bestAttempts,
    buildSystemPrompt,
    castAssistant,
    destinationId,
    destinations,
    emptySnapshot,
    historyFor,
    looksLikeSolveRequest,
    newMessageId,
    parseReply,
    resolveAction,
    seatOf,
    shouldAutoSend,
    snapshotSettled,
    summariseStudent,
    visibleDestinations,
    type ActionContext,
    type Attempt,
    type StudentSnapshot,
} from '../../src/utils/assistantEngine';
import {
    ASSISTANT_FIGURE, ASSISTANT_FIGURES, BREATH_PERIOD, figureById,
} from '../../src/stage3d/figures';
import type { Access } from '../../src/navigation/appNav';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}
function section(title: string) {
    console.log(`\n${title}`);
}

// From the repo root, which is where npm runs the script — the same anchor
// every other check here uses. `import.meta.dirname` would be the DIST folder.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const ALL: Access = {
    auth: true, ai: true, lab: true, runbook: true,
    research: true, toastmasters: true, exam: true, proctor: true,
};

/**
 * Source with its comments blanked.
 *
 * A rule that fires on the paragraph explaining it is a rule nobody can
 * document, and this platform has paid for that twice — `check:aichat` matched
 * its own header saying the file no longer uses `v-html`, and `check:i18n`
 * blanked 51 real `$t` calls by lexing a template as JavaScript. So: one
 * left-to-right pass that knows what it is inside of, and it is only ever run
 * over `<script>` blocks and `.ts` files.
 */
function blankHtmlComments(source: string): string {
    return source.replace(/<!--[\s\S]*?-->/g, comment =>
        comment.replace(/[^\n]/g, ' '));
}

function blankComments(source: string): string {
    let out = '';
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        const next = source[i + 1];
        if (ch === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') { out += ' '; i++; }
            continue;
        }
        if (ch === '/' && next === '*') {
            while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
                out += source[i] === '\n' ? '\n' : ' ';
                i++;
            }
            out += '  ';
            i += 2;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            const quote = ch;
            out += ch;
            i++;
            while (i < source.length) {
                if (source[i] === '\\') { out += source[i] + (source[i + 1] ?? ''); i += 2; continue; }
                out += source[i];
                if (source[i] === quote) { i++; break; }
                i++;
            }
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

/* ================================================================== *
 * 1. Destinations
 * ================================================================== */

section('Destinations: every page she can send somebody to');

const all = destinations();
check('there are destinations at all', all.length > 20, all.length);

{
    const ids = all.map(d => d.id);
    check('every id is unique — two pages sharing one is a target that reaches '
        + 'whichever happened to be first',
        new Set(ids).size === ids.length,
        ids.filter((id, i) => ids.indexOf(id) !== i));

    check('no destination carries a route PARAMETER — `/course/:id` is not a '
        + 'page anybody can be sent to as it stands, and drawing a button for '
        + 'it navigates to a literal colon',
        all.every(d => !d.to.includes(':')), all.filter(d => d.to.includes(':')));

    check('every `to` is absolute', all.every(d => d.to.startsWith('/')),
          all.filter(d => !d.to.startsWith('/')));

    check('every destination has a sentence about it — the model chooses from '
        + 'these, and an entry that is only a label is one it cannot tell apart '
        + 'from its neighbour',
        all.every(d => d.about.trim().length > 3), all.filter(d => !d.about.trim()));

    // The list goes into a prompt AND into this check. An order that depends on
    // how `APP_SECTIONS` happens to be arranged changes for reasons nothing here
    // controls, which makes the prompt non-reproducible between builds.
    const sorted = [...ids].sort();
    check('the list is stably ordered', JSON.stringify(ids) === JSON.stringify(sorted));

    // FIRST WRITER WINS, and it is worth asserting because the mutation that
    // reverses it changes nothing visible: a section's landing page keeps its
    // id and its label and silently swaps its one-line description for the
    // keyword list of whichever entry was walked last. The model chooses from
    // those descriptions.
    const courses = all.find(d => d.to === '/courses');
    check('a section landing page keeps the SECTION subtitle rather than an '
        + 'entry keyword list',
        courses?.about === 'Lessons, homework and quizzes', courses);
}

{
    /*
      Against the ROUTER, read off disk. A destination whose path no route
      matches is the one failure that looks completely normal until pressed.

      The scan has to understand two parameter forms, because SKIPPING anything
      with a colon reported three live pages as missing on this check's first
      run — `/tools/linux`, `/tools/python` and `/network-simulator/studio` are
      all reachable and all declared with a parameter:

        * `tools/:tab(sql|linux|python)` — an enumerated constraint, so each
          alternative is a concrete path the router matches;
        * `network-simulator/studio/:id?` — an OPTIONAL parameter, so the path
          without it matches too.

      Expanding them rather than loosening the assertion, because the assertion
      is the point: a check that waves through anything containing a colon would
      also wave through `/course/:id` being offered as a destination.
    */
    const routerSource = read('src/router/index.ts');
    const declared = new Set<string>();
    for (const match of routerSource.matchAll(/path:\s*'([^']*)'/g)) {
        const raw = match[1]!;
        const path = raw.startsWith('/') ? raw : `/${raw}`;
        if (!path.includes(':')) { declared.add(path); continue; }

        const enumerated = path.match(/^(.*)\/:[\w]+\(([^)]+)\)$/);
        if (enumerated) {
            for (const option of enumerated[2]!.split('|')) {
                declared.add(`${enumerated[1]}/${option}`);
            }
            continue;
        }
        const optional = path.match(/^(.*)\/:[\w]+\?$/);
        if (optional) declared.add(optional[1]!);
    }
    const missing = all.filter(d => !declared.has(d.to));
    check('every destination is a path the router actually declares — a renamed '
        + 'route would otherwise leave her confidently offering a page that '
        + 'lands on the catch-all',
        missing.length === 0, missing.map(d => `${d.id} -> ${d.to}`));
}

{
    const signedOut = visibleDestinations(NO_ACCESS);
    check('a signed-out visitor is offered only public pages',
          signedOut.every(d => d.requires === 'public'),
          signedOut.filter(d => d.requires !== 'public').map(d => d.id));
    check('...and still has somewhere to go, or the window is useless to the '
        + 'people most likely to be asking what the platform is',
        signedOut.length >= 4, signedOut.map(d => d.id));

    const gated = visibleDestinations({ ...ALL, lab: false });
    check('a reader without `lab_feature` is not offered the lab catalogue — a '
        + 'button the subscription guard bounces reads as broken rather than '
        + 'as locked',
        !gated.some(d => d.to === '/labs'), gated.filter(d => d.to === '/labs'));
    check('...while a reader with it is', visibleDestinations(ALL).some(d => d.to === '/labs'));
}

check('a path becomes a readable id', destinationId('/research/my-projects') === 'research-my-projects',
      destinationId('/research/my-projects'));
check('...and the root becomes `home` rather than an empty string, which would '
    + 'be an id no model can name', destinationId('/') === 'home', destinationId('/'));

/* ================================================================== *
 * 2. Actions
 * ================================================================== */

section('Actions: what the model may make happen');

const ctx: ActionContext = {
    access: ALL,
    courses: [{ id: 'course-7', title: 'Docker Mastery' }],
    lessons: [{ id: 'lesson-3', title: 'Containers', courseId: 'course-7' }],
    labs: [{ id: 'dk-01-basics', title: 'Your first container' }],
    runbooks: [{ id: '12', title: 'Production readiness' }],
};

check('a real target resolves',
      resolveAction({ kind: 'navigate', target: 'labs' }, ctx)?.to === '/labs');
check('...and the button takes the DESTINATION\'s own name, never the model\'s',
      resolveAction({ kind: 'navigate', target: 'labs' }, ctx)?.label === 'Labs',
      resolveAction({ kind: 'navigate', target: 'labs' }, ctx));

check('AN INVENTED PAGE IS DROPPED — this is the whole reason the protocol is '
    + 'an id rather than a URL',
    resolveAction({ kind: 'navigate', target: 'dashboard' }, ctx) === null);
check('...and so is a raw path she was not offered',
      resolveAction({ kind: 'navigate', target: '/etc/passwd' }, ctx) === null);
check('...and an off-site URL',
      resolveAction({ kind: 'navigate', target: 'https://evil.example' }, ctx) === null);

check('a page this reader cannot open is dropped rather than drawn',
      resolveAction({ kind: 'navigate', target: 'labs' },
                    { ...ctx, access: { ...ALL, lab: false } }) === null);

check('a course she holds resolves',
      resolveAction({ kind: 'open_course', id: 'course-7' }, ctx)?.to === '/course/course-7');
check('...an invented course id does not',
      resolveAction({ kind: 'open_course', id: 'course-999' }, ctx) === null);
check('...and the label is the RECORD\'s title, so a button cannot promise a '
    + 'page it is not about to open',
    resolveAction({ kind: 'open_course', id: 'course-7' }, ctx)?.label === 'Docker Mastery');

check('a lab resolves for a reader who has the feature',
      resolveAction({ kind: 'open_lab', id: 'dk-01-basics' }, ctx)?.to === '/lab/dk-01-basics');
check('...and is dropped for one who does not, rather than bouncing off the guard',
      resolveAction({ kind: 'open_lab', id: 'dk-01-basics' },
                    { ...ctx, access: { ...ALL, lab: false } }) === null);

check('a lesson carries its course into the path',
      resolveAction({ kind: 'open_lesson', id: 'lesson-3' }, ctx)?.to
        === '/course/course-7/lesson/lesson-3');
check('...and a lesson with no course recorded cannot be opened at all, because '
    + 'the route has nowhere to put it',
    resolveAction({ kind: 'open_lesson', id: 'x' },
                  { ...ctx, lessons: [{ id: 'x', title: 'Orphan' }] }) === null);

check('a runbook needs `runbook_feature`',
      resolveAction({ kind: 'open_runbook', id: '12' }, ctx)?.to === '/runbooks/12'
      && resolveAction({ kind: 'open_runbook', id: '12' },
                       { ...ctx, access: { ...ALL, runbook: false } }) === null);

for (const junk of [null, undefined, {}, { kind: 'none' }, { kind: '' },
                    { kind: 'navigate' }, { kind: 42 }, { kind: 'eval' },
                    { kind: 'navigate', target: 42 }]) {
    check(`junk is null, not a throw: ${JSON.stringify(junk)}`,
          resolveAction(junk as never, ctx) === null);
}

check('the empty context resolves nothing at all, so a window that has not '
    + 'loaded its catalogues yet draws no buttons rather than broken ones',
    resolveAction({ kind: 'navigate', target: 'labs' }, EMPTY_CONTEXT) === null
    && resolveAction({ kind: 'open_course', id: 'course-7' }, EMPTY_CONTEXT) === null);

/* ================================================================== *
 * 3. Reading the model's reply
 * ================================================================== */

section('parseReply: never throws, whatever arrives');

check('a plain envelope', parseReply('{"say":"Hello","action":{"kind":"none"}}').say === 'Hello');
check('...carries its action',
      parseReply('{"say":"x","action":{"kind":"navigate","target":"labs"}}').action?.kind
        === 'navigate');

check('a fenced envelope', parseReply('```json\n{"say":"Fenced"}\n```').say === 'Fenced');
check('an envelope with prose in front of it',
      parseReply('Sure!\n{"say":"After"}').say === 'After');

// The reason for a brace scan rather than a regex: the `say` field routinely
// contains a brace, because she is explaining a JSON lab or quoting a path.
check('A BRACE INSIDE A VALUE DOES NOT CUT THE DOCUMENT SHORT',
      parseReply('{"say":"Use {\\"a\\": 1} in the file","action":{"kind":"none"}}').say
        === 'Use {"a": 1} in the file');

check('plain prose is shown as it is',
      parseReply('I can help with that.').say === 'I can help with that.');
check('...with no action',
      parseReply('I can help with that.').action === null);

check('an envelope with an EMPTY `say` falls through to the prose rather than '
    + 'rendering a blank bubble',
    parseReply('Here you go.\n{"action":{"kind":"none"}}').say.includes('Here you go'));

check('a dangling JSON blob beside a sentence is not read out to the reader',
      !parseReply('Your labs are here.\n{"kind":"navigate","target":"labs"}')
        .say.includes('navigate'));

for (const junk of ['', '   ', '{', '{"say":', 'null', '[]', '{"say":42}',
                    '```', '{"say":"a"', undefined, null, 42, {}]) {
    let threw = false;
    let result: unknown = null;
    try { result = parseReply(junk as never); } catch { threw = true; }
    check(`no throw on ${JSON.stringify(junk)}`, !threw && typeof (result as { say: string })?.say === 'string');
}

/* ================================================================== *
 * 4. The refusal
 * ================================================================== */

section('She will not sit the paper');

for (const asked of [
    'solve this exam question for me',
    'can you answer question 3 of the quiz',
    'just give me the answers',
    'what is the correct answer',
    'do my homework',
    'complete the lab for me',
    'which option is correct?',
    'حل هذا السؤال من فضلك',
    '帮我解答这道题',
]) {
    check(`refused before a model call: "${asked}"`, looksLikeSolveRequest(asked));
}

// The other half, and it matters as much: a detector that fires on an ordinary
// question is one the reader has to fight, and the whole point of running it in
// front of the model is that it is cheap AND right.
for (const asked of [
    'how many quizzes are in this course?',
    'where do I see the answers after an exam?',
    'when is my next exam?',
    'show me my quiz results',
    'take me to the labs',
    'what is Self Study Jo?',
    'how do I book an exam?',
    'did I pass the Docker exam?',
    // A solve VERB with no assessment noun. Without these three the detector's
    // whole AND is untested: replacing it with "any verb alone" passed every
    // other case here, which is a mutation regressing nothing and therefore a
    // check reporting itself as sound when it is not.
    'how do I complete my profile?',
    'did I finish the Docker course?',
    'where do I answer a comment on a lesson?',
    'ما هي نتائجي في الامتحان؟',
    '我的考试成绩在哪里？',
]) {
    check(`NOT refused: "${asked}"`, !looksLikeSolveRequest(asked));
}

check('an empty message is not a solve request', !looksLikeSolveRequest(''));
check('...nor is a non-string', !looksLikeSolveRequest(null as never));

check('the refusal offers a way forward rather than only saying no',
      /lesson|runbook|lab/i.test(REFUSAL), REFUSAL);

/* ================================================================== *
 * 5. The student's record
 * ================================================================== */

section('The snapshot: three states, never two');

{
    const rows: Attempt[] = [
        { subject: 'q1', title: 'Docker', score: 40, passed: false, at: '2026-01-01', attempts: 1 },
        { subject: 'q1', title: 'Docker', score: 90, passed: true, at: '2026-02-01', attempts: 1 },
        { subject: 'q1', title: 'Docker', score: 90, passed: true, at: '2026-03-01', attempts: 1 },
        { subject: 'q2', title: 'Linux', score: 70, passed: true, at: '2026-04-01', attempts: 1 },
    ];
    const best = bestAttempts(rows);
    check('one row per assessment, whatever the retakes', best.length === 2, best.length);
    const docker = best.find(r => r.subject === 'q1')!;
    check('...the BEST score, not the latest — counting every attempt makes '
        + 'somebody who re-sat one quiz eleven times look like eleven quizzes',
        docker.score === 90, docker);
    check('...the EARLIEST of a tie, so the date quoted is the day they first '
        + 'got there', docker.at === '2026-02-01', docker.at);
    check('...and the retake count survives, because "your best of three" is a '
        + 'different sentence from "your score"', docker.attempts === 3, docker.attempts);

    const twice = bestAttempts(rows);
    check('the order is total — the list is rebuilt every turn, so a comparator '
        + 'that can call two rows equal is one that reshuffles between two '
        + 'questions about it',
        JSON.stringify(best) === JSON.stringify(twice));

    const tied = bestAttempts([
        { subject: 'b', title: 'B', score: 1, passed: true, at: '2026-01-01', attempts: 1 },
        { subject: 'a', title: 'A', score: 1, passed: true, at: '2026-01-01', attempts: 1 },
    ]);
    check('...including when the dates are identical',
          tied.map(r => r.subject).join(',') === 'a,b', tied.map(r => r.subject));

    check('no rows in, no rows out', bestAttempts([]).length === 0);
}

{
    const snap: StudentSnapshot = emptySnapshot('sami', 'Sami Q');
    check('a fresh snapshot is PENDING rather than empty — a question asked '
        + 'while it loads must not be answered from nothing',
        !snapshotSettled(snap));
    check('...and says so in the prompt', /still loading/i.test(summariseStudent(snap)));

    snap.certificates = { state: 'unavailable', rows: [] };
    snap.quizzes = { state: 'ok', rows: [] };
    snap.exams = { state: 'ok', rows: [] };
    snap.courses = { state: 'ok', rows: [] };
    snap.labs = { state: 'ok', rows: [] };
    snap.plan = { state: 'ok', rows: [] };
    snap.appointments = { state: 'ok', rows: [] };
    const text = summariseStudent(snap);
    check('A SECTION THAT COULD NOT BE READ IS NOT AN EMPTY ONE — rendered as '
        + '"none", she tells a student their certificates are gone',
        /COULD NOT BE READ/.test(text) && /do not say they have none/.test(text), text);
    check('...while a genuinely empty one says none', /Quiz results[^\n]*: none yet/.test(text), text);
    check('...and everything else being settled is not "still loading"',
          snapshotSettled(snap));
}

{
    const snap = emptySnapshot('sami', 'Sami Q');
    snap.quizzes = {
        state: 'ok',
        rows: Array.from({ length: MAX_ROWS + 12 }, (_, i) => ({
            subject: `q${i}`, title: `Quiz ${i}`, score: 80, passed: true,
            at: '2026-01-01', attempts: 1,
        })),
    };
    const text = summariseStudent(snap);
    const listed = (text.match(/Quiz \d+ —/g) || []).length;
    check('a section is CAPPED — one student with three hundred attempts would '
        + 'otherwise trip a provider\'s size limit, and `call_ai` then learns '
        + 'that limit for the model and degrades every other AI feature on the '
        + 'replica', listed === MAX_ROWS, listed);
    check('...and says how many it left out, rather than silently truncating',
          /and 12 more/.test(text), text.slice(-200));
}

check('a signed-out reader has no record and the prompt says so plainly',
      /NOT SIGNED IN/.test(summariseStudent(emptySnapshot())));

/* ================================================================== *
 * 6. The prompt
 * ================================================================== */

section('The system prompt');

const prompt = buildSystemPrompt({
    assistant: DEFAULT_ASSISTANT,
    snapshot: emptySnapshot('sami', 'Sami Q'),
    access: ALL,
    currentPath: '/course/course-7',
    courses: ctx.courses,
    labs: ctx.labs,
    runbooks: ctx.runbooks,
});

check('it names whoever is on duty', prompt.includes(ASSISTANT_NAME));
check('IT SAYS THE WORD JSON — app 27\'s `call_ai` wrapper detects it and '
    + 'appends the JSON language directive rather than the prose one, which is '
    + 'what keeps the KEYS English while translating the VALUES. Without it a '
    + 'model told to answer in Chinese renames `say` to `说`, the reply parses, '
    + 'nothing raises, and every bubble comes out empty',
    prompt.includes('JSON'));
check('it forbids answering an exam, a quiz, a lab task or a homework',
      /Never answer or work out an exam question, a quiz question, a lab task or a\s+homework/.test(prompt),
      prompt.slice(prompt.indexOf('MUST NOT'), prompt.indexOf('MUST NOT') + 220));
check('...and says a hint is not a loophole', /Not a hint/.test(prompt));
check('it forbids inventing a figure', /Never invent a figure/.test(prompt));
check('it forbids inventing a page or an id', /Never invent a page/.test(prompt));
check('it forbids turning an unreadable section into "you have none"',
      /COULD NOT BE READ/.test(prompt));
check('it says where the reader is, so "what is this page" is answerable',
      prompt.includes('/course/course-7'));
check('every destination is offered by id', prompt.includes('labs — Labs'), true);
check('the course catalogue is in it, so `open_course` can only name a real one',
      prompt.includes('course-7 = Docker Mastery'));
check('it tells her to answer in words as well as with a button — the reader '
    + 'may be listening rather than looking',
    /never reply with only a\s+button/.test(prompt));

{
    const narrow = buildSystemPrompt({
        assistant: DEFAULT_ASSISTANT,
        snapshot: emptySnapshot(),
        access: NO_ACCESS,
        currentPath: '/login',
        courses: [], labs: [], runbooks: [],
    });
    check('a signed-out prompt does not offer a page they cannot open',
          !narrow.includes('\n  labs — '), narrow.slice(narrow.indexOf('PAGES'), 400));
    check('...and still lists the public ones', /newscast|courses|leaderboard/.test(narrow));
}

/* ================================================================== *
 * 7. Talking
 * ================================================================== */

section('Hands-free');

check('a pause long enough ends the turn', shouldAutoSend('where are my labs', AUTO_SEND_SILENCE_MS));
check('...and a shorter one does not, or she cuts people off mid-question',
      !shouldAutoSend('where are my labs', AUTO_SEND_SILENCE_MS - 400));
check('silence with nothing said sends nothing', !shouldAutoSend('', 99999));
check('...nor does a cough', !shouldAutoSend('a', 99999));
// `chars`, not `words`: `'这是什么'.split()` has length one, so a word floor
// refuses every Chinese question. The same fault `count_words` exists for.
check('A TWO-CHARACTER CHINESE QUESTION IS STILL A QUESTION',
      shouldAutoSend('实验', AUTO_SEND_SILENCE_MS));
check('the floor is a character count rather than a word count',
      AUTO_SEND_MIN_CHARS <= 2, AUTO_SEND_MIN_CHARS);

/* ================================================================== *
 * 8. Bounded history
 * ================================================================== */

section('History');

{
    const many = Array.from({ length: 60 }, (_, i) => ({
        id: `m${i}`, role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
        content: `turn ${i}`, at: i,
    }));
    const kept = historyFor(many);
    check('history is bounded — an unbounded transcript eventually trips a '
        + 'provider size limit, which `call_ai` then learns for the model',
        kept.length === HISTORY_TURNS * 2, kept.length);
    check('...and it is the LATEST turns that are kept',
          kept[kept.length - 1]!.content === 'turn 59', kept[kept.length - 1]);
    check('a failed bubble is not sent back as context — she would be answering '
        + 'her own error message',
        historyFor([{ id: 'a', role: 'assistant', content: 'oops', failed: true, at: 1 }])
            .length === 0);
    check('...and neither is an empty one',
          historyFor([{ id: 'a', role: 'user', content: '   ', at: 1 }]).length === 0);
}

check('a message id is unique', newMessageId() !== newMessageId());

/* ================================================================== *
 * 9. The figure
 * ================================================================== */

section('The pair on duty');

check('there are two of them', ASSISTANTS.length === 2, ASSISTANTS.map(a => a.id));
check('...one of each gender, so the male voice route is exercised by half of '
    + 'all sessions rather than by nobody',
    new Set(ASSISTANTS.map(a => a.gender)).size === 2,
    ASSISTANTS.map(a => `${a.id}:${a.gender}`));
check('...with distinct ids and distinct names',
      new Set(ASSISTANTS.map(a => a.id)).size === 2
      && new Set(ASSISTANTS.map(a => a.name)).size === 2, ASSISTANTS);

// Derived from the figure table rather than restated, so a name on a plate, the
// gender that casts the voice and the face being rendered cannot disagree.
check('every one is a figure `figures.ts` can resolve - a typo here renders a '
    + 'blank tile with an initial on it and nothing else',
    ASSISTANTS.every(a => figureById(a.id).id === a.id),
    ASSISTANTS.map(a => a.id));
check('...and its name and gender come FROM that figure rather than being '
    + 'written down twice',
    ASSISTANTS.every(a => {
        const figure = figureById(a.id);
        return figure.name === a.name && figure.gender === a.gender;
    }));
check('...and the table is exactly the assistant figures, so one added there '
    + 'is one that appears',
    ASSISTANTS.length === ASSISTANT_FIGURES.length);

check('THEY ALTERNATE: whoever greeted you last time, the other one greets you now',
      castAssistant(ASSISTANTS[0]!.id).id === ASSISTANTS[1]!.id
      && castAssistant(ASSISTANTS[1]!.id).id === ASSISTANTS[0]!.id);
check('...a first-ever visit gets the first of them',
      castAssistant(null).id === ASSISTANTS[0]!.id);
check('...and so does a stored value nothing recognises. `localStorage` is '
    + 'writable by anything on this origin, and an assistant that refused to '
    + 'appear because a string was wrong would be a window that does not open',
    castAssistant('nobody').id === ASSISTANTS[0]!.id
    && castAssistant(undefined).id === ASSISTANTS[0]!.id
    && castAssistant('').id === ASSISTANTS[0]!.id);
check('alternating twice returns to the start, so the pair really is a cycle '
    + 'rather than a one-way trip',
    castAssistant(castAssistant(ASSISTANTS[0]!.id).id).id === ASSISTANTS[0]!.id);
check('the storage key is namespaced', CAST_STORAGE_KEY.startsWith('sfs-'),
      CAST_STORAGE_KEY);

check('each gets its OWN seat number - `planSpeech` casts a different device '
    + 'voice per seat, so one seat for both is Noor and Omar sharing a voice on '
    + 'any machine that has two',
    new Set(ASSISTANTS.map(seatOf)).size === ASSISTANTS.length,
    ASSISTANTS.map(a => `${a.id}:${seatOf(a)}`));

check('the default is the first of them and agrees with the legacy exports',
      DEFAULT_ASSISTANT.id === ASSISTANT_FIGURE_ID
      && DEFAULT_ASSISTANT.name === ASSISTANT_NAME
      && ASSISTANT_FIGURE.id === ASSISTANT_FIGURE_ID);

{
    /*
      THE BREATH PHASE, MEASURED MODULO THE CYCLE.

      The first version of this measured RAW gaps and required 0.5, which passed
      while the assistant sat 0.2 from Marcus once taken modulo the 4.6-second
      breath cycle - clustered, by `check:actors`'s own definition, which is the
      measurement that matters because every idle cycle is a function of
      `t + phase`. Two checks looking at the wrong thing agreed with each other
      and a figure shipped breathing in near-lockstep with a meeting seat.

      `check:actors` covers the whole cast including these two now. This is the
      same property asserted from the side that owns them, because the fault it
      caught was the assistant table being invisible to the other file.
    */
    const phases = ASSISTANT_FIGURES.map(f => f.phase % BREATH_PERIOD);
    check('the two of them do not breathe together',
          Math.abs(phases[0]! - phases[1]!) > 0.2 + 1e-6,
          phases.map(p => Number(p.toFixed(3))));
}

check('the button, the typing indicator and the microphone all take a {bot} '
    + 'parameter - a greeting reading "I am Noor" over a plate saying Omar is '
    + 'the window disagreeing with itself in its first sentence',
    [BUTTON_LABEL, THINKING_LABEL, MIC_LABEL, GREETING_SIGNED_IN, GREETING_SIGNED_OUT]
        .every(k => k.includes('{bot}')));

{
    // Each name is rendered as `$t(cast.name)`, so both have to be catalogue
    // keys — the newscast transliterates its own anchors on their plates and
    // this is the same decision.
    const missing = ASSISTANTS.filter(a => !ASSISTANT_KEYS.includes(a.name));
    check('both names are catalogue keys, so an Arabic reader is greeted by '
        + 'نور or عمر rather than by a Latin run inside Arabic prose',
        missing.length === 0, missing.map(a => a.name));
}

/* ================================================================== *
 * 10. Source rules
 * ================================================================== */

section('Source rules');

{
    const service = blankComments(read('src/services/assistant.service.ts'));
    // THE ONE GUARANTEE rather than a request. `_exam_out` and `_quiz_out` nest
    // every question with every answer and its `is_correct`; a prompt saying
    // "do not answer the paper" is a request, and not holding the paper is not.
    const forbidden = ['/exams/', '/quizzes/', '/exam-questions/', '/quiz-questions/',
                       '/exam-answers/', '/quiz-answers/'];
    for (const path of forbidden) {
        check(`the service never fetches \`${path}\` — it carries the answer key`,
              !service.includes(path));
    }
    check('...and it does name `/assessment-titles/`, which is the light route '
        + 'added to app 20 so a result can be NAMED without the key travelling',
        service.includes('/assessment-titles/'));
    check('the replica is pinned through the shared helper rather than an '
        + 'inlined `Math.random()` under a name that looks like it (working '
        + 'rule 31)',
        service.includes('getRandomAiReplica') && !service.includes('Math.random'));
}

{
    const dock = read('src/components/assistant/AssistantDock.vue');
    /*
      Two untrusted sources meet in that bubble: text a model wrote, and text
      the reader dictated. This window is on every page including ones holding
      a session.

      Read with the COMMENTS BLANKED, in the template as well as the script.
      This assertion failed on its first run against the paragraph in the
      template saying `v-html` is never used — which is working rule 44 exactly:
      a rule that fires on the comment explaining it is a rule nobody can
      document, so the next person deletes one or the other. `check:aichat` and
      `check:leaderboard` have both paid for this.
    */
    const dockCode = blankComments(blankHtmlComments(dock));
    /*
      NO COMPONENT HARDCODES A NAME.

      The whole feature is that the two alternate, so a stray `Noor` in a
      template is the window disagreeing with itself — the plate saying Omar
      while the greeting says Noor, or a tooltip naming somebody who is not on
      duty. Every one of them goes through `$t(cast.name)`.

      Checked against the blanked source so the paragraphs explaining the pair
      can go on naming them, which is the trap this same check fell into over
      `v-html` on its first run.
    */
    const WORDY = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$';
    const isWord = (ch: string) => ch !== '' && WORDY.includes(ch);
    /*
      A whole-word scan rather than a regex, because the first version of this
      was `new RegExp(\`...${name}\b\`)` inside a TEMPLATE LITERAL — where
      `` is a backspace character and not a word boundary, so the pattern
      matched nothing and the rule passed with `<span>Noor</span>` hardcoded in
      the plate. Found by breaking the code and watching nothing happen.
    */
    const named = ASSISTANTS.map(a => a.name).filter(name => {
        for (let at = dockCode.indexOf(name); at >= 0;
             at = dockCode.indexOf(name, at + 1)) {
            if (!isWord(dockCode[at - 1] || '')
                && !isWord(dockCode[at + name.length] || '')) return true;
        }
        return false;
    });
    check('the window hardcodes neither name - both come from the cast',
          named.length === 0, named);

    check('NOTHING REACHES `v-html`', !dockCode.includes('v-html'), dockCode.slice(0, 0));
    check('the window is teleported to <body>, or a positioned page wrapper '
        + 'paints it under the sidebar', dockCode.includes('<Teleport to="body">'));
    check('Escape closes it — a window with no keyboard way out is a trap',
          /event\.key === 'Escape'/.test(dock));

    const script = dockCode.slice(dockCode.indexOf('<script'));
    check('the microphone is Whisper on app 27, not `SpeechRecognition`, which '
        + 'Firefox does not have and whose Arabic support varies by build',
        script.includes('assistantService.transcribe')
        && !script.includes('webkitSpeechRecognition'));
    check('Chrome cuts speech off after ~15 seconds and `onend` frequently '
        + 'never arrives, so a long answer is truncated AND the window sits in '
        + '`speaking` for ever - the pause/resume keepalive is the documented '
        + 'workaround',
        script.includes('speechSynthesis.pause') && script.includes('speechSynthesis.resume'));
    {
        // The INTERVAL, not just the call. Setting it to 9000000 leaves code
        // that looks identical and a keepalive that fires once every two and a
        // half hours, i.e. never - so the assertion is the property (under
        // Chrome's own cut-off) rather than the literal.
        const every = script.match(/speechSynthesis\.resume[\s\S]{0,120}?}\s*,\s*(\d+)\)/);
        check('...on an interval shorter than that cut-off',
              !!every && Number(every[1]) > 0 && Number(every[1]) < 15000, every && every[1]);
    }
    check('...with a watchdog behind it, because "should" is not a guarantee',
          /setTimeout\(finish/.test(script));
    check('speech is cancelled on unmount, or she reads over whatever page the '
        + 'reader opens next', script.includes('speech.dispose'));
    check('the audio context is primed inside a gesture — one created outside '
        + 'one starts suspended and every clip on it is silently ignored',
        script.includes('speech.prime()'));
    check('the language is re-probed when the reader changes it: what app 36 '
        + 'can say is per language, and an answer cached from English is what '
        + 'leaves an Arabic reader in silence',
        /watch\(localeId/.test(script));
    /*
      THE MALE HALF OF THE PAIR, which is the half that can go wrong quietly.

      App 36's fallback provider has one voice per language and it is female in
      all three, so with `edge-tts` missing from the replica Omar's line comes
      back in a woman's voice. Two things stand between that and the reader, and
      neither is visible in a screenshot:

        * `plan.allowAnyVoice` — the backend REFUSES a wrong-gender voice by
          default, because a silent substitution is the bug all of this exists
          to prevent. Drop it and Omar is not mis-voiced, he is SILENT.
        * the reshaping ratio on `play` — this is what actually corrects it,
          the same 192 Hz in / 140 Hz out pass the newscast's Adam goes through.
          Drop it and he is voiced by a woman, which is the newscast bug that
          was reported four times.

      Both were missed by the first version of this check and found by
      `negative.py`.
    */
    check('the server is told a stand-in voice is acceptable - without it the '
        + 'male assistant is refused one and goes silent rather than being '
        + 'mis-voiced', /newsService\.speech\([^;]*plan\.allowAnyVoice/.test(script));
    check('...and what comes back is RESHAPED into his register, from the '
        + 'gender the backend MEASURED rather than the one that was asked for',
        /shapeRatio\(\s*clip\.gender\s*,\s*plan\.shapeTo\s*\)/.test(script)
        && /speech\.play\(\s*clip\.url\s*,\s*ratio\s*\)/.test(script));
    check('...and the gender cast is the one on duty, not a literal',
          /planSpeech\([^;]*who\.gender/.test(script)
          && !/planSpeech\([^;]*'female'/.test(script));

    check('a wrong-language device voice is never cast by hand — the decision '
        + 'goes through `planSpeech`', script.includes('planSpeech'));
}

{
    const css = read('src/assets/css/assistant.css');
    const selectors = [...css.matchAll(/^\s*\.([a-zA-Z][\w-]*)/gm)].map(m => m[1]!);
    const stray = [...new Set(selectors)].filter(name => !name.startsWith('sfs-bot'));
    check('every class is `sfs-bot` prefixed — this sheet is loaded globally, '
        + 'and a bare name in one is how `roblox-tool.css`\'s `.placeholder` '
        + 'covered the exam calendar on every page of the platform',
        stray.length === 0, stray);

    // A literal is right in the default galaxy and wrong in the other nine.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // Every `var(...)` is REMOVED before looking, rather than its fallback
    // being collected and subtracted by VALUE. Compared by value, a bare
    // `color: #e7eaf3` is excused by the identical hex sitting inside somebody
    // else's fallback three rules down - which is what happened, and it is a
    // check reporting itself as sound when it is not.
    const withoutVars = withoutComments.replace(/var\([^()]*\)/g, 'VAR');
    const bare = [...withoutVars.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0]);
    check('no colour literal outside a `var()` fallback', bare.length === 0, bare);

    check('the window stops short of the bottom-right corner, which belongs to '
        + 'the support chat launcher on every page',
        /max-block-size:\s*min\(/.test(css));
    check('it is placed with LOGICAL properties, so it lands on the same side '
        + 'as its button in Arabic', css.includes('inset-inline-end'));
    check('the 3D tile is pinned LTR — the renderer positions its camera '
        + 'viewport in viewport coordinates, which do not mirror',
        /\.sfs-bot__stage\s*\{[^}]*direction:\s*ltr/.test(css));
    check('a bubble reads its direction out of its own text, so an English '
        + 'sentence in an Arabic window keeps its full stop at the end',
        /\.sfs-bot__msg\s*\{[^}]*unicode-bidi:\s*plaintext/.test(css));
    check('an unbreakable id cannot set the bubble\'s width',
          /overflow-wrap:\s*anywhere/.test(css));
    check('every keyframe track ends where it began — `responsive.css` collapses '
        + 'durations to 0.01ms under reduced motion, which lands an element on '
        + 'its LAST keyframe',
        /0%,\s*100%\s*\{\s*opacity:\s*1;\s*\}/.test(css)
        && /0%,\s*100%\s*\{\s*opacity:\s*0\.3;\s*\}/.test(css));
    check('a field is never below 16px, or iOS zooms on focus and never zooms back',
          /font-size:\s*max\(0\.9rem,\s*16px\)/.test(css));
}

{
    const layout = blankComments(blankHtmlComments(read('src/layouts/DefaultLayout.vue')));
    /*
      Asserted on the CALL and on the absence of a static import, not on the
      name `defineAsyncComponent` appearing somewhere in the file.

      Replacing the deferral with a plain `import AssistantDock from ...` left
      `import { computed, defineAsyncComponent } from 'vue'` at the top, so a
      name test passed against an eagerly-imported window - a check reporting
      itself as sound when it is not, found by breaking the code and watching
      nothing happen.
    */
    check('the window is DEFERRED - it is the biggest part of this feature and '
        + 'most readers never open it, so eager it would be downloaded by a '
        + 'visitor reading the login page (working rule 47)',
        /defineAsyncComponent\(\s*\(\)\s*=>\s*import\([^)]*AssistantDock\.vue/
            .test(layout),
        layout.slice(layout.indexOf('AssistantDock'), layout.indexOf('AssistantDock') + 160));
    check('...and there is no static import of it beside the deferred one, '
        + 'which would put it back in the entry chunk while looking deferred',
        !/^import\s+AssistantDock\s+from/m.test(layout));
    check('...and it is mounted once, outside the sidebar slot',
          (layout.match(/<AssistantDock/g) || []).length === 1);

    const topBar = read('src/components/TopBar.vue');
    const lab = read('src/views/LabWorkspace.vue');
    check('the BUTTON is in the top bar', topBar.includes('<AssistantButton />'));
    check('...and in the lab workspace, which is the one page the top bar is '
        + 'hidden on and the one with the most to ask about',
        lab.includes('<AssistantButton />'));
    check('...both driving ONE window through the shared ref, because a second '
        + '<AssistantDock> would be two transcripts and two voices',
        read('src/components/assistant/AssistantButton.vue').includes('useAssistant'));
}

/* ================================================================== *
 * 11. Translation keys
 * ================================================================== */

section('Copy');

{
    /*
      Asserted by MEMBERSHIP rather than by a count.

      The first version compared `ASSISTANT_KEYS.length` against an arithmetic
      expression, and it went stale the moment four error sentences and the two
      voice labels were added - so the check failed while nothing was wrong,
      which is the kind of failure that gets a check deleted rather than read.
      What matters is that no piece of copy is MISSING from the list, and that
      is checkable directly.
    */
    const owned: Array<[string, unknown]> = [
        ['REFUSAL', REFUSAL],
        ['GREETING_SIGNED_IN', GREETING_SIGNED_IN],
        ['GREETING_SIGNED_OUT', GREETING_SIGNED_OUT],
        ['MIC_FAILED', MIC_FAILED],
        ['NO_ANSWER', NO_ANSWER],
        ['SERVICE_BUSY', SERVICE_BUSY],
        ['SERVICE_UNREACHABLE', SERVICE_UNREACHABLE],
        ...Object.entries(STATE_LABELS),
        ...Object.entries(VOICE_LABELS),
        ...SUGGESTIONS_SIGNED_IN.map((v, i) => [`suggestion in ${i}`, v] as [string, unknown]),
        ...SUGGESTIONS_SIGNED_OUT.map((v, i) => [`suggestion out ${i}`, v] as [string, unknown]),
    ];
    const missing = owned.filter(([, value]) => !ASSISTANT_KEYS.includes(value as string));
    check('every string this module owns is in `ASSISTANT_KEYS` - they are all '
        + 'reached through a variable, so no source file contains the literal '
        + 'and `check:i18n` verifies them against this table instead of '
        + 'reporting every one as an orphan',
        missing.length === 0, missing.map(([name]) => name));
    check('...with nothing listed twice, which would make a coverage figure lie',
          new Set(ASSISTANT_KEYS).size === ASSISTANT_KEYS.length,
          ASSISTANT_KEYS.filter((k, i) => ASSISTANT_KEYS.indexOf(k) !== i));
}

console.log(failures ? `\n${failures} failed` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
