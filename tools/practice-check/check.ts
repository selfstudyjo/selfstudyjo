// Verifies the practice ledger without a browser.
//
//   npm run check:practice
//
// FOUR HALVES, and the third is the one that could not be done any other way.
//
// THE CATALOGUE. `src/utils/practiceIntegrity.ts` holds a second copy of app
// 20's `utils/integrity.py` — the browser needs one to render the rules before
// the first question and to move the strike meter the instant something
// happens (a candidate who alt-tabs and sees nothing change for two seconds
// has learnt that alt-tab is free). Two copies is the trap working rule 10
// exists for, so this check READS THE PYTHON OFF DISK and fails on any
// difference in the points, the severity, the contexts or the cap. It skips
// rather than passes when the sibling repo is absent, the same convention
// `check:notifyevents` and `selfstudy_news/_contract.py` follow: a check that
// cannot run must not report success.
//
// THE ARITHMETIC. Five breaches void an exam or a quiz and never a lab; the
// count clamps at zero; a positive award is capped; an unknown action scores
// nothing. Each of those is invisible from a browser and expensive to be wrong
// about, and each is asserted in BOTH directions — a check that only proved the
// fail would pass with `FAILS_AT` set to five for every context, which would
// fail students for reading the documentation their lab told them to read.
//
// THE THROTTLE. `shouldRecord` is the difference between a ledger and a log,
// and it is the one thing here whose absence makes the feature unfair rather
// than merely wrong: a browser fires `blur` and `visibilitychange` for one
// alt-tab, and a window manager can fire several as focus settles, so an
// unthrottled count would void a paper for one press of the taskbar.
//
// THE SOURCE. Two rules over the files themselves. Nothing may record what was
// copied — the ledger is published on a page that needs no account and app 20
// ships `is_correct` inside the exam payload, so the copied text during a paper
// IS the exam paper. And the numbers the lab page promises have to be the
// numbers the leaderboard pays, because a page that promises ten points for
// something worth three is worse than a page that promises nothing.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    ACTIONS,
    AI_FREE_ASKS,
    ALT_TAB_ABSORB_MS,
    CONTEXTS,
    FAILS_AT,
    FOCUS_AWARD_MS,
    MAX_DETAIL,
    MIN_GAP_MS,
    NEGATIVE_LIMIT,
    PENALTY_CAP,
    TERMINAL_ACTIONS,
    afterClosure,
    allowedIn,
    bandOf,
    closureOf,
    isTerminal,
    commitThrottle,
    describeCopy,
    isNegative,
    labEarningRules,
    labelOf,
    newEventId,
    newSessionId,
    newThrottle,
    pointsOf,
    rulesFor,
    sanitiseDetail,
    severityOf,
    shouldRecord,
    specOf,
    statusFor,
    strikeMessage,
    verdictFor,
    type PracticeContext,
} from '../../src/utils/practiceIntegrity';
import {
    DISTINCTION_SCORE,
    MASTERY_FROM,
    POINTS,
    aggregate,
    applyConductCaps,
    bestAttempts,
    masteryBonus,
    pointsFor,
} from '../../src/utils/leaderboardEngine';
import { buildDossier, pointsBySource, pointsSeries } from '../../src/utils/learnerDossier';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}
function section(title: string) {
    console.log(`\n${title}\n${'-'.repeat(title.length)}`);
}

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

/**
 * Source with its comments removed.
 *
 * Two assertions below are of the form "this file must not mention X", and the
 * comment explaining *why* it must not naturally mentions X. Without this, the
 * paragraph on why the copied text is never stored is what fails the check that
 * the copied text is never stored — which is a rule nobody can document, and
 * `check:aichat` and `check:leaderboard` have both had to be corrected for it.
 */
function stripComments(text: string): string {
    let out = '';
    let index = 0;
    let mode: 'code' | 'line' | 'block' | 'single' | 'double' | 'template' = 'code';
    while (index < text.length) {
        const two = text.slice(index, index + 2);
        if (mode === 'code') {
            if (two === '//') { mode = 'line'; index += 2; continue; }
            if (two === '/*') { mode = 'block'; index += 2; continue; }
            if (text[index] === "'") { mode = 'single'; out += text[index++]; continue; }
            if (text[index] === '"') { mode = 'double'; out += text[index++]; continue; }
            if (text[index] === '`') { mode = 'template'; out += text[index++]; continue; }
            out += text[index++];
            continue;
        }
        if (mode === 'line') {
            if (text[index] === '\n') { mode = 'code'; out += '\n'; }
            index++;
            continue;
        }
        if (mode === 'block') {
            if (two === '*/') { mode = 'code'; index += 2; continue; }
            if (text[index] === '\n') out += '\n';
            index++;
            continue;
        }
        // Inside a string. Copy it, honouring escapes.
        if (text[index] === '\\') { out += text.slice(index, index + 2); index += 2; continue; }
        const quote = mode === 'single' ? "'" : mode === 'double' ? '"' : '`';
        if (text[index] === quote) mode = 'code';
        out += text[index++];
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * 1. The catalogue, against app 20's
 * ------------------------------------------------------------------ */

section('1. The two catalogues agree');
{
    const pythonPath = resolve(process.cwd(), '../selfstudyexam/utils/integrity.py');
    if (!existsSync(pythonPath)) {
        // SKIP, not pass. There is no shared package (working rule 10), so this
        // is the only thing that stops the two drifting - and a check that
        // silently passes when it cannot run is worse than no check.
        console.log('  skip  selfstudyexam is not checked out beside this repo,'
            + ' so the Python catalogue cannot be compared.');
    } else {
        const python = readFileSync(pythonPath, 'utf8');

        /* A deliberately small parser over the ACTIONS literal. Not a Python
           parser: what is needed is four values per entry, and a real parser
           would be a dependency for something a regex over a hand-written,
           one-entry-per-block literal reads exactly. It fails loudly - the
           count assertion below is what catches a shape it did not
           understand. */
        const block = python.slice(python.indexOf('ACTIONS = {'));
        const entries = new Map<string, { points: number; severity: string; contexts: string[]; once: number; contextPoints: Record<string, number> }>();
        const re = /'([a-z_]+\.[a-z_]+)':\s*\{([\s\S]*?)\n    \},/g;
        for (const match of block.matchAll(re)) {
            const body = match[2];
            // `'points':` and not `points':`, deliberately: the leading quote is
            // what stops this matching inside `'context_points':`, whose own
            // value is read separately below.
            const points = Number(body.match(/'points':\s*(-?\d+)/)?.[1]);
            const severity = body.match(/'severity':\s*'(\w+)'/)?.[1] ?? '';
            const contexts = [...(body.match(/'contexts':\s*\(([^)]*)\)/)?.[1] ?? '')
                .matchAll(/'(\w+)'/g)].map(m => m[1]);
            const onceRaw = body.match(/'once':\s*([A-Z_]+|\d+)/)?.[1] ?? '0';
            const once = onceRaw === 'AI_FREE_ASKS' ? 3 : Number(onceRaw);
            const contextPoints: Record<string, number> = {};
            const table = body.match(/'context_points':\s*\{([^}]*)\}/)?.[1] ?? '';
            for (const pair of table.matchAll(/'(\w+)':\s*(-?\d+)/g)) {
                contextPoints[pair[1]] = Number(pair[2]);
            }
            entries.set(match[1], { points, severity, contexts, once, contextPoints });
        }

        check('the Python catalogue parsed', entries.size > 15, entries.size);
        check('both catalogues hold the same number of actions',
            entries.size === Object.keys(ACTIONS).length,
            { python: entries.size, ts: Object.keys(ACTIONS).length });

        const onlyPython = [...entries.keys()].filter(name => !ACTIONS[name]);
        const onlyTs = Object.keys(ACTIONS).filter(name => !entries.has(name));
        check('no action exists only on the service', !onlyPython.length, onlyPython);
        check('no action exists only in the browser', !onlyTs.length, onlyTs);

        const mismatched: unknown[] = [];
        for (const [name, py] of entries) {
            const ts = ACTIONS[name];
            if (!ts) continue;
            if (ts.points !== py.points) {
                mismatched.push({ name, field: 'points', py: py.points, ts: ts.points });
            }
            if (ts.severity !== py.severity) {
                mismatched.push({ name, field: 'severity', py: py.severity, ts: ts.severity });
            }
            if (ts.once !== py.once) {
                mismatched.push({ name, field: 'once', py: py.once, ts: ts.once });
            }
            const same = ts.contexts.length === py.contexts.length
                && ts.contexts.every(c => py.contexts.includes(c));
            if (!same) {
                mismatched.push({ name, field: 'contexts', py: py.contexts, ts: ts.contexts });
            }
            /*
              AND THE PER-CONTEXT PRICE, which is the newest way these two can
              drift and the least visible. A lab charges a quarter for a
              switched window; if only one side knew that, the meter on screen
              and the number on the record would disagree about the same action
              and nothing anywhere would say which was right.
            */
            const mine = (ts.contextPoints ?? {}) as Record<string, number>;
            const names = new Set([...Object.keys(mine), ...Object.keys(py.contextPoints)]);
            for (const context of names) {
                if (mine[context] !== py.contextPoints[context]) {
                    mismatched.push({ name, field: `context_points.${context}`,
                        py: py.contextPoints[context], ts: mine[context] });
                }
            }
        }
        check('every action agrees on its points, severity, contexts and cap',
            !mismatched.length, mismatched.slice(0, 6));

        // The three constants the screens quote at a student. A limit that
        // differed would be a candidate promised five and failed at four.
        check('the strike limit agrees',
            new RegExp(`NEGATIVE_LIMIT = ${NEGATIVE_LIMIT}\\b`).test(python));
        check('the free tutor allowance agrees',
            new RegExp(`AI_FREE_ASKS = ${AI_FREE_ASKS}\\b`).test(python));
        check('a lab is unfailable on both sides',
            /'lab': None/.test(python) && FAILS_AT.lab === null);
        check('the detail bound agrees',
            new RegExp(`MAX_DETAIL = ${MAX_DETAIL}\\b`).test(python));

        // THE CAPS AND THE ENDINGS. Both decide arithmetic the two sides do
        // independently - the browser for the meter, the service for the mark -
        // so a difference is a candidate watching one number while being
        // scored on another.
        const pyCaps = python.match(/PENALTY_CAP = \{([^}]*)\}/)?.[1] ?? '';
        const caps: Record<string, number> = {};
        for (const pair of pyCaps.matchAll(/'(\w+)':\s*(-?\d+)/g)) {
            caps[pair[1]] = Number(pair[2]);
        }
        check('the penalty cap agrees in every context',
            CONTEXTS.every(context => caps[context] === PENALTY_CAP[context]),
            { python: caps, ts: PENALTY_CAP });

        const pyEnds = python.match(/TERMINAL_ACTIONS = \{([\s\S]*?)\}/)?.[1] ?? '';
        const ends: Record<string, string> = {};
        for (const pair of pyEnds.matchAll(/'(\w+)':\s*'([\w.]+)'/g)) {
            ends[pair[1]] = pair[2];
        }
        check('and so does the action that ends a sitting',
            CONTEXTS.every(context => ends[context] === TERMINAL_ACTIONS[context]),
            { python: ends, ts: TERMINAL_ACTIONS });
    }
}

/* ------------------------------------------------------------------ *
 * 2. The catalogue's own shape
 * ------------------------------------------------------------------ */

section('2. The catalogue is coherent');
{
    check('every severity is one of three',
        Object.values(ACTIONS).every(a =>
            ['positive', 'negative', 'neutral'].includes(a.severity)));
    check('every context named is a real one',
        Object.values(ACTIONS).every(a =>
            a.contexts.every(c => (CONTEXTS as readonly string[]).includes(c))));
    check('a neutral action is worth exactly zero',
        Object.values(ACTIONS).filter(a => a.severity === 'neutral')
            .every(a => a.points === 0));
    check('a negative costs and a positive earns',
        Object.values(ACTIONS).every(a =>
            a.severity === 'negative' ? a.points < 0
                : a.severity === 'positive' ? a.points > 0 : a.points === 0));

    // A positive award with no cap is a positive award somebody scripts:
    // `focus.sustained` is +2 and unbounded it is +2 as many times as a loop
    // can post it.
    const uncapped = Object.entries(ACTIONS)
        .filter(([, a]) => a.severity === 'positive' && !a.once).map(([n]) => n);
    check('no positive award is uncapped', !uncapped.length, uncapped);

    // And the mirror image: refusing to record the sixth breach would be
    // refusing the evidence.
    const cappedBad = Object.entries(ACTIONS)
        .filter(([, a]) => a.severity === 'negative' && a.once).map(([n]) => n);
    check('no negative action is capped', !cappedBad.length, cappedBad);

    check('ai.overused is a lab action and nothing else',
        ACTIONS['ai.overused'].contexts.length === 1
        && ACTIONS['ai.overused'].contexts[0] === 'lab');
    check('devtools.opened is not a lab action - a lab is where you read the '
        + 'page you are building',
        !ACTIONS['devtools.opened'].contexts.includes('lab'));
    check('every action has a label and a reason to print',
        Object.values(ACTIONS).every(a => !!a.label && !!a.why));

    check('allowedIn refuses a lab action in an exam',
        !allowedIn('ai.overused', 'exam') && allowedIn('ai.overused', 'lab'));
    check('an unknown action is allowed nowhere',
        !allowedIn('free.points', 'exam') && specOf('free.points') === null);
    check('an unknown action scores nothing and is not a breach',
        pointsOf('free.points') === 0 && !isNegative('free.points')
        && severityOf('free.points') === 'neutral');
    check('labelOf falls back to the action rather than to an empty string',
        labelOf('free.points') === 'free.points');
}

/* ------------------------------------------------------------------ *
 * 3. The verdict
 * ------------------------------------------------------------------ */

section('3. Five breaches, and only where five means something');
{
    const breach = (n: number) => Array.from({ length: n }, () => ({ action: 'window.left' }));

    check('a clean sitting is clean',
        verdictFor([], 'exam').status === 'clean'
        && verdictFor([], 'exam').failed === false);
    check('one breach warns and does not fail',
        verdictFor(breach(1), 'exam').status === 'warned'
        && !verdictFor(breach(1), 'exam').failed);
    check('and it says how many are left',
        verdictFor(breach(1), 'exam').remaining === 4);
    check('four breaches still does not fail',
        !verdictFor(breach(4), 'exam').failed
        && verdictFor(breach(4), 'exam').remaining === 1);
    check('FIVE fails an exam', verdictFor(breach(5), 'exam').failed);
    check('and a quiz', verdictFor(breach(5), 'quiz').failed);

    // SEVEN, not five. At exactly the limit `limit - count` and
    // `max(0, limit - count)` are the same number, so the obvious version of
    // this passes with the clamp removed - a negative "strikes remaining"
    // renders as "-2 left" on the candidate's own screen.
    const seven = verdictFor(breach(7), 'exam');
    check('remaining clamps at zero rather than going negative',
        seven.remaining === 0, seven);
    check('and past the limit it is still a failure', seven.failed);

    // THE OTHER DIRECTION, and the one that keeps a lab a lab.
    const lab = verdictFor(breach(9), 'lab');
    check('NINE breaches never fails a lab', !lab.failed, lab);
    check('a lab has no limit at all', lab.limit === null);
    check('and remaining is null rather than a number a lab does not have',
        lab.remaining === null);
    check('but the points still come off in a lab', lab.points < 0, lab);

    const mixed = verdictFor([
        { action: 'focus.sustained' }, { action: 'focus.sustained' },
        { action: 'assessment.clean_sitting' },
        { action: 'window.left' },
        { action: 'assessment.started' },
    ], 'exam');
    check('positives and penalties are reported separately',
        mixed.positivePoints === 19 && mixed.penaltyPoints === -4, mixed);
    check('and the net is their sum', mixed.points === 15, mixed);
    check('a neutral action is an event and not a strike',
        mixed.events === 5 && mixed.negatives === 1, mixed);
    check('an action this build does not know scores nothing',
        verdictFor([{ action: 'something.new' }], 'exam').points === 0);

    check('statusFor has no limit case', statusFor(0, null) === 'clean'
        && statusFor(3, null) === 'warned');

    section('4. The four bands');
    check('clean is clean', bandOf(verdictFor([], 'exam')) === 'clean');
    check('one breach is a warning',
        bandOf(verdictFor(breach(1), 'exam')) === 'warned');
    // The split at two remaining is what gives a step before the cliff:
    // "warned" otherwise covers one breach and four, which want completely
    // different treatment on screen.
    check('three breaches is critical, not merely warned',
        bandOf(verdictFor(breach(3), 'exam')) === 'critical');
    check('five is failed', bandOf(verdictFor(breach(5), 'exam')) === 'failed');
    check('a lab never reaches critical however many breaches',
        bandOf(verdictFor(breach(9), 'lab')) === 'warned');

    section('5. What the meter says');
    const clean = strikeMessage(verdictFor([], 'exam'));
    check('a clean exam names the limit',
        clean.params.v0 === NEGATIVE_LIMIT, clean);
    const one = strikeMessage(verdictFor(breach(4), 'exam'));
    check('one strike left gets its own sentence, with no placeholders left '
        + 'unfilled',
        !/\{v\d\}/.test(one.key) || Object.keys(one.params).length > 0, one);
    const failed = strikeMessage(verdictFor(breach(5), 'exam'));
    check('the failed message names the count and the limit',
        failed.params.v0 === 5 && failed.params.v1 === 5, failed);
    const labSay = strikeMessage(verdictFor(breach(2), 'lab'));
    check('a lab is told nothing can fail it',
        /fail/i.test(labSay.key), labSay);

    // Every placeholder in a message must have a param, or the sentence renders
    // with a literal `{v1}` in it - which `check:i18n` cannot see, because the
    // key is correct and it is the CALL that is short.
    for (const verdict of [verdictFor([], 'exam'), verdictFor(breach(1), 'exam'),
        verdictFor(breach(4), 'exam'), verdictFor(breach(5), 'exam'),
        verdictFor([], 'lab'), verdictFor(breach(2), 'lab')]) {
        const message = strikeMessage(verdict);
        const wanted = [...message.key.matchAll(/\{(v\d+)\}/g)].map(m => m[1]);
        const missing = wanted.filter(name => message.params[name] === undefined);
        check(`every placeholder is filled: ${message.key.slice(0, 40)}...`,
            !missing.length, missing);
    }
}

/* ------------------------------------------------------------------ *
 * 6. The throttle
 * ------------------------------------------------------------------ */

section('6. One action is one strike');
{
    const state = newThrottle();
    check('the first of anything is recorded',
        shouldRecord(state, 'window.left', 1000));
    commitThrottle(state, 'window.left', 1000);
    check('a second one 200ms later is not - a browser fires blur and '
        + 'visibilitychange for one switch',
        !shouldRecord(state, 'window.left', 1200));
    check('and neither is one at the boundary',
        !shouldRecord(state, 'window.left', 1000 + MIN_GAP_MS['window.left'] - 1));
    check('past the gap it is recorded again - two departures are two events',
        shouldRecord(state, 'window.left', 1000 + MIN_GAP_MS['window.left']));

    // THE ONE THAT MATTERS MOST. Pressing Alt+Tab makes the window lose focus,
    // so both detectors fire for one action - counted separately that is two
    // strikes for one keystroke, which is the single most likely way this
    // feature would be reported as broken.
    const alt = newThrottle();
    commitThrottle(alt, 'window.alt_tab', 5000);
    check('an Alt+Tab absorbs the blur it causes',
        !shouldRecord(alt, 'window.left', 5100));
    check('and keeps absorbing it up to the declared window',
        !shouldRecord(alt, 'window.left', 5000 + ALT_TAB_ABSORB_MS - 1));
    check('but a genuine departure afterwards is still recorded',
        shouldRecord(alt, 'window.left', 5000 + ALT_TAB_ABSORB_MS + 1));

    check('an unthrottled action is always recorded',
        shouldRecord(newThrottle(), 'ai.overused', 0)
        && MIN_GAP_MS['ai.overused'] === 0);
    check('every negative action either has a gap or is declared as having none',
        Object.entries(ACTIONS).filter(([, a]) => a.severity === 'negative')
            .every(([name]) => MIN_GAP_MS[name] !== undefined),
        Object.entries(ACTIONS).filter(([name, a]) =>
            a.severity === 'negative' && MIN_GAP_MS[name] === undefined)
            .map(([name]) => name));
    check('the developer-tools heuristic is throttled hardest, because it is a '
        + 'heuristic and fires while the panel stays open',
        MIN_GAP_MS['devtools.opened'] >= 10000);
}

/* ------------------------------------------------------------------ *
 * 7. What is never recorded
 * ------------------------------------------------------------------ */

section('7. The copied text is never recorded');
{
    const secret = 'Which of these is a broadcast domain? A VLAN. is_correct=true';
    const described = describeCopy(secret);
    check('a copy is described as a character count',
        /^\d+ characters$/.test(described), described);
    // Word by word, so a partial leak fails too. The exam paper on a page that
    // needs no account is a far worse outcome than the cheating it records.
    const leaked = secret.split(/\s+/).filter(word =>
        word.length > 3 && described.includes(word));
    check('and carries no word of what was copied', !leaked.length, leaked);
    check('an empty selection is still a count rather than a blank',
        describeCopy('') === '0 characters');

    check('a detail is truncated to the declared bound',
        sanitiseDetail('x'.repeat(500)).length === MAX_DETAIL);
    check('and loses its newlines - the feed is one line per event',
        !sanitiseDetail('a\nb').includes('\n'));
    check('and its control characters',
        sanitiseDetail(`a${String.fromCharCode(0)}${String.fromCharCode(7)}b`) === 'a b',
        sanitiseDetail(`a${String.fromCharCode(0)}${String.fromCharCode(7)}b`));

    // The source rules. Neither file may reach for the clipboard's contents.
    const monitor = stripComments(source('src/utils/practiceMonitor.ts'));
    check('the monitor never puts a selection into a detail unmeasured',
        !/detail:\s*(String\()?\s*(selection|text)\b/.test(monitor),
        monitor.match(/detail:[^,\n]*/g)?.slice(0, 4));
    check('and every clipboard handler goes through describeCopy',
        (monitor.match(/record\('clipboard\.(copy|paste)'/g) || []).length
        === (monitor.match(/describeCopy\(/g) || []).length,
        {
            records: (monitor.match(/record\('clipboard\.\w+'/g) || []).length,
            describes: (monitor.match(/describeCopy\(/g) || []).length,
        });

    /*
      THE REQUEST SHAPE, not the whole file.

      The first version of this asserted the file never mentions `points`, and
      it failed on the two places that legitimately READ one - the verdict the
      service hands back, and the mirror of it in the local verdict. Reading is
      the point; what must not happen is SENDING. `QueuedEvent` is the shape
      that goes on the wire, so the shape is what is asserted.
    */
    const service = stripComments(source('src/services/practice.service.ts'));
    const queued = service.match(/interface QueuedEvent \{[\s\S]*?\n\}/)?.[0] ?? '';
    check('the QueuedEvent shape was found', !!queued, queued.slice(0, 80));
    check('a queued event carries no points - the catalogue decides, and a '
        + 'client that could send its own could award itself the leaderboard',
        !/\bpoints\b/.test(queued), queued);
    check('and no severity - a severity is what decides whether an action '
        + 'counts towards the strike limit',
        !/\bseverity\b/.test(queued), queued);
    check('and no label, so a retuned penalty cannot disagree with the rules '
        + 'the same page prints',
        !/\blabel\b/.test(queued), queued);
    check('the batch posts the queued events and nothing it invented',
        /events:\s*batch/.test(service), service.match(/events:[^,\n]*/g));
}

/* ------------------------------------------------------------------ *
 * 7b. A sitting that is over
 * ------------------------------------------------------------------ */

section('7b. A finished sitting takes nothing further');
{
    const at = (n: number) => 1_700_000_000_000 + n * 1000;
    const ev = (action: string, n: number) => ({ action, at: at(n) });

    // BOTH DIRECTIONS. A check that only proved the ignore would pass with
    // everything ignored, which is an integrity system that records nothing.
    const live = verdictFor([ev('window.left', 1), ev('window.left', 5)], 'exam');
    check('before the close a breach still counts',
        live.negatives === 2 && live.points === -8, live);

    const closed = verdictFor([
        ev('window.left', 1),
        ev('assessment.submitted', 9),
        ev('window.left', 20),
        ev('window.alt_tab', 30),
    ], 'exam');
    check('after the paper is submitted a breach is not scored',
        closed.points === -4, closed);
    check('and is not a strike - a queue flushed a second late must not void '
        + 'a paper that was already in',
        closed.negatives === 1 && closed.remaining === 4, closed);
    check('the sitting says it is closed', closed.closed === true, closed);
    check('and how many it declined to score',
        closed.ignoredAfterClose === 2, closed);
    check('while the record keeps every one of them',
        closed.events === 4 && closed.scored === 2, closed);

    // THE REPORTED BUG. Five switches after finishing a lab used to be -20 on
    // a public record, for leaving a tab open.
    const labDone = verdictFor([
        ev('lab.completed', 1),
        ...[10, 11, 12, 13, 14].map(n => ev('window.left', n)),
    ], 'lab');
    check('a finished LAB takes nothing further however long the tab is open',
        labDone.points === 0, labDone);
    check('and stays clean rather than warned', labDone.status === 'clean');

    check('a lab is not ended by a paper being submitted - the terminal '
        + 'action is per context',
        verdictFor([ev('assessment.submitted', 1), ev('window.left', 9)], 'lab')
            .closed === false);
    check('isTerminal knows the difference',
        isTerminal('lab.completed', 'lab')
        && !isTerminal('lab.completed', 'exam')
        && isTerminal('lab.completed'));

    check('an event in the same instant as the submission still counts - a '
        + 'batch stamps its items together and a tie must not forgive the '
        + 'breach it arrived with',
        verdictFor([ev('window.left', 9), ev('assessment.submitted', 9)], 'exam')
            .points === -4);
    check('with no stamps at all, position is the ordering',
        verdictFor([{ action: 'assessment.submitted' }, { action: 'window.left' }],
            'exam').points === 0);
    check('but an UNDATED event beside a dated close is never assumed late',
        verdictFor([ev('assessment.submitted', 9), { action: 'window.left' }],
            'exam').points === -4);
    check('the sitting ends at the FIRST submission and not the last',
        verdictFor([ev('assessment.submitted', 9), ev('assessment.submitted', 30),
            ev('window.left', 20)], 'exam').points === 0);

    check('closureOf reports nothing for a sitting still running',
        closureOf([ev('window.left', 1)], 'exam')[1] === null);
    check('and afterClosure says no when there is no closure',
        !afterClosure(ev('window.left', 99), 9, null, null));

    check('the meter stops counting down at a finished sitting',
        strikeMessage(verdictFor([ev('assessment.submitted', 1)], 'exam')).key
        === strikeMessage(verdictFor([ev('lab.completed', 1)], 'lab')).key);
    check('and says the sitting is finished rather than how many would end it',
        /finished/i.test(strikeMessage(
            verdictFor([ev('lab.completed', 1)], 'lab')).key));
}

/* ------------------------------------------------------------------ *
 * 7c. A penalty is bounded, and a price can depend on the context
 * ------------------------------------------------------------------ */

section('7c. A penalty is a bounded modifier, not an unbounded sink');
{
    const at = (n: number) => 1_700_000_000_000 + n * 1000;
    const many = (action: string, count: number) =>
        Array.from({ length: count }, (_u, i) => ({ action, at: at(i) }));

    const heavy = verdictFor(many('window.alt_tab', 10), 'exam');
    check('ten Alt+Tabs would be -60 and the cap is -30',
        heavy.penaltyPoints === PENALTY_CAP.exam, heavy);
    check('and the sitting says the cap bit', heavy.penaltyCapped === true);
    // THE HALF THAT MUST NOT BE WEAKENED: capping the arithmetic must never
    // cap the COUNT, or a candidate buys immunity by cheating faster.
    check('but every breach still counts, so five still voids the paper',
        heavy.negatives === 10 && heavy.failed, heavy);
    check('under the cap nothing is clamped',
        verdictFor(many('window.left', 3), 'exam').penaltyCapped === false);

    const labHeavy = verdictFor(many('window.left', 40), 'lab');
    check('forty switches in a two-hour lab costs 15 and not 160 - it is what '
        + 'the lab told the student to do',
        labHeavy.penaltyPoints === PENALTY_CAP.lab, labHeavy);
    check('and it is still not a failure', !labHeavy.failed);
    check('every context declares a cap and every cap is a penalty',
        CONTEXTS.every(c => PENALTY_CAP[c] < 0), PENALTY_CAP);

    // Per-context pricing.
    check('a lab charges a quarter for a switched window',
        pointsOf('window.left', 'lab') === -1
        && pointsOf('window.left', 'exam') === -4);
    check('no context at all means the base price, not the softest one - a '
        + 'caller that forgets gets the strict reading, which is the one that '
        + 'gets reported rather than the one nobody notices',
        pointsOf('window.left') === -4);
    check('an override never changes the sign of a penalty',
        Object.values(ACTIONS).filter(a => a.severity === 'negative')
            .every(a => Object.values(a.contextPoints ?? {})
                .every(value => value <= 0)));
    check('and only ever softens - the base price is the assessed one',
        Object.values(ACTIONS).every(a =>
            Object.values(a.contextPoints ?? {})
                .every(value => Math.abs(value) <= Math.abs(a.points))));
    check('every override names a context the action is allowed in',
        Object.values(ACTIONS).every(a =>
            Object.keys(a.contextPoints ?? {})
                .every(c => a.contexts.includes(c as PracticeContext))));
    check('the clipboard is not watched in a lab at all - copying is how a '
        + 'command gets from the brief into the terminal',
        !allowedIn('clipboard.copy', 'lab')
        && !allowedIn('clipboard.paste', 'lab')
        && allowedIn('clipboard.copy', 'exam'));
}

/* ------------------------------------------------------------------ *
 * 7d. The board is priced the same way the meter is
 * ------------------------------------------------------------------ */

section('7d. applyConductCaps, so the total agrees with the verdict');
{
    const at = (n: number) => 1_700_000_000_000 + n * 1000;
    const act = (unique: string, action: string, points: number, n: number,
                 context: PracticeContext = 'exam', session = 's1') => ({
        kind: 'practice' as const, userId: 'u1', name: '', subjectId: 'e1',
        unique, passed: false, at: at(n), points,
        severity: (points < 0 ? 'negative' : 'positive') as 'negative' | 'positive',
        action, label: 'x', context, sessionId: session,
    });

    const total = (events: readonly any[]) =>
        applyConductCaps(events).reduce((n, e) => n + pointsFor(e), 0);

    // A LAB THAT WAS FINISHED. Everything after the close is worth nothing,
    // and this is the half that makes the fix retroactive: these records are
    // already in the store, written before the service learned the rule.
    const finished = [
        act('a', 'lab.completed', 0, 1, 'lab', 'lab-1'),
        act('b', 'window.left', -1, 10, 'lab', 'lab-1'),
        act('c', 'window.left', -1, 20, 'lab', 'lab-1'),
    ];
    check('nothing recorded after a lab was finished reaches the total',
        total(finished) === 0, applyConductCaps(finished).map(e => e.points));
    check('and the line is marked as capped, so a reader can be told why it '
        + 'reads zero rather than left to think the page lost the number',
        applyConductCaps(finished).filter(e => e.capped).length === 2);

    // THE CAP, charged exactly to the boundary rather than dropped at it.
    const overrun = Array.from({ length: 10 },
        (_u, i) => act(`x${i}`, 'window.alt_tab', -6, i));
    check('a sitting cannot cost more than its cap',
        total(overrun) === PENALTY_CAP.exam, total(overrun));
    check('and the boundary event is charged partially rather than dropped - '
        + 'a learner two points over should be charged the two',
        applyConductCaps(overrun).some(e => e.points === -0
            || (e.capped && e.points! < 0)),
        applyConductCaps(overrun).map(e => e.points));

    // TWO SITTINGS ARE TWO CAPS, or a learner who worked twice as long would
    // be forgiven the second afternoon entirely.
    const twice = [
        ...Array.from({ length: 10 }, (_u, i) => act(`p${i}`, 'window.alt_tab', -6, i, 'exam', 'sA')),
        ...Array.from({ length: 10 }, (_u, i) => act(`q${i}`, 'window.alt_tab', -6, i, 'exam', 'sB')),
    ];
    check('two sittings are two caps',
        total(twice) === PENALTY_CAP.exam * 2, total(twice));

    // A POSITIVE IS NEVER CAPPED. The cap exists to bound a penalty; the awards
    // are already bounded by `once`, and clamping them here would be a second
    // copy of a limit that is checked elsewhere.
    const earned = [act('g', 'focus.sustained', 2, 1),
        act('h', 'focus.sustained', 2, 2)];
    check('positives pass through untouched', total(earned) === 4);

    // AND NOTHING ELSE IS TOUCHED. A pass is not a practice event and must
    // come out the other side identical.
    const exam = { kind: 'exam' as const, userId: 'u1', name: '', subjectId: 'e1',
        score: 80, passed: true, at: at(1) };
    check('a non-practice event is returned exactly as it went in',
        applyConductCaps([exam])[0] === exam);

    check('the order is stable, so two renders cap the same events',
        JSON.stringify(applyConductCaps(overrun))
        === JSON.stringify(applyConductCaps(overrun)));
}

/* ------------------------------------------------------------------ *
 * 7e. The mark is worth something, and it is a slope
 * ------------------------------------------------------------------ */

section('7e. No cliff at 90, and no cliff at the pass mark either');
{
    const ex = (score: number | null, passed: boolean, integrityStatus = '') => ({
        kind: 'exam' as const, userId: 'u1', name: '', subjectId: 'e1',
        score, passed, at: 1, integrityStatus,
    });

    check('a bare pass is worth the base and nothing more',
        pointsFor(ex(MASTERY_FROM, true)) === POINTS.examPassed);
    check('and full marks are worth the base plus the whole mastery award',
        pointsFor(ex(100, true)) === POINTS.examPassed + POINTS.mastery);
    // THE BUG THIS REPLACED: 70 and 89 used to score identically.
    check('70 and 89 are no longer the same score',
        pointsFor(ex(89, true)) > pointsFor(ex(70, true)),
        [pointsFor(ex(70, true)), pointsFor(ex(89, true))]);
    // AND THE OTHER HALF: 89 and 90 used to differ by a quarter of the pass.
    check('and 89 to 90 is a step of about one point rather than of 25',
        pointsFor(ex(DISTINCTION_SCORE, true))
        - pointsFor(ex(DISTINCTION_SCORE - 1, true)) <= 3,
        [pointsFor(ex(89, true)), pointsFor(ex(90, true))]);
    check('the slope never goes backwards',
        Array.from({ length: 101 }, (_u, s) => pointsFor(ex(s, true)))
            .every((value, index, all) => index === 0 || value >= all[index - 1]!));
    check('and never pays for a mark below where it starts',
        masteryBonus(MASTERY_FROM - 1) === 0 && masteryBonus(0) === 0);
    check('a score above 100 cannot pay more than 100 does',
        masteryBonus(140) === masteryBonus(100));
    check('and a missing score pays nothing rather than NaN',
        masteryBonus(null) === 0 && masteryBonus(undefined) === 0);

    check('an honest failed attempt is worth a little rather than nothing',
        pointsFor(ex(64, false)) === POINTS.attempted);
    check('and it is small - trying must not be a strategy',
        POINTS.attempted * 4 < POINTS.quizPassed * 2
        && POINTS.attempted < POINTS.quizPassed);
    // THE ONE THAT KEEPS THE BOARD AND THE LEDGER AGREEING.
    check('a sitting voided for cheating earns nothing at all, not even the '
        + 'credit for having attempted it',
        pointsFor(ex(0, false, 'failed')) === 0);
    check('a warned sitting is not a voided one and still earns the credit',
        pointsFor(ex(51, false, 'warned')) === POINTS.attempted);
    check('a failed CERTIFICATE is still worth nothing - there is no such '
        + 'thing as attempting one',
        pointsFor({ kind: 'course_certificate', userId: 'u1', name: '',
            subjectId: 'c1', score: null, passed: false, at: 1 }) === 0);
    check('and a failed attempt with no score at all earns nothing',
        pointsFor(ex(null, false)) === 0);

    // The dedupe is what makes paying for an attempt safe.
    const resits = Array.from({ length: 40 }, (_u, i) => ({
        kind: 'quiz' as const, userId: 'u1', name: '', subjectId: 'q1',
        score: 30 + i, passed: false, at: i,
    }));
    check('forty re-sits of one quiz are ONE credit, which is the whole reason '
        + 'paying for an attempt is safe',
        bestAttempts(resits).reduce((n, e) => n + pointsFor(e), 0)
        === POINTS.attempted, bestAttempts(resits).length);
}

/* ------------------------------------------------------------------ *
 * 8. What the lab page promises
 * ------------------------------------------------------------------ */

section('8. The lab page promises what the leaderboard pays');
{
    const rules = labEarningRules();
    check('there is a rule for every way a lab moves the total',
        rules.length >= 6, rules.length);
    for (const rule of rules) {
        const wanted = [...rule.key.matchAll(/\{(v\d+)\}/g)].map(m => m[1]);
        const missing = wanted.filter(name => rule.params[name] === undefined);
        check(`every placeholder is filled: ${rule.key.slice(0, 44)}...`,
            !missing.length, missing);
    }

    // THE NUMBERS. A page that promises ten points for something worth three is
    // worse than a page that promises nothing, and there is no way to see the
    // difference by reading either file.
    const values = rules.flatMap(rule => Object.values(rule.params).map(Number));
    check('the task-point figure it quotes is the one the board pays',
        values.includes(POINTS.labTaskPoint), { values, pays: POINTS.labTaskPoint });
    check('and the completion figure',
        values.includes(POINTS.labCompleted), { values, pays: POINTS.labCompleted });
    check('and the clean-session award',
        values.includes(ACTIONS['lab.clean_session'].points));
    check('and the tutor penalty',
        values.includes(Math.abs(ACTIONS['ai.overused'].points)));
    check('and the free allowance', values.includes(AI_FREE_ASKS));

    const listed = rulesFor('lab', 'negative').length
        + rulesFor('lab', 'positive').length + rulesFor('lab', 'neutral').length;
    const real = Object.values(ACTIONS).filter(a => a.contexts.includes('lab')).length;
    check('the rules table lists every action a lab can record',
        listed === real, { listed, real });
    check('the exam table lists every action an exam can record',
        rulesFor('exam', 'negative').length + rulesFor('exam', 'positive').length
        + rulesFor('exam', 'neutral').length
        === Object.values(ACTIONS).filter(a => a.contexts.includes('exam')).length);

    // Worst first, so the table does not open with "leaving full screen costs
    // three points" and bury the sentence that matters.
    const costs = rulesFor('exam', 'negative').map(rule => Math.abs(rule.points));
    check('the penalties are listed worst first',
        costs.every((value, index) => index === 0 || costs[index - 1] >= value),
        costs);
    // A total order, so the list cannot reshuffle between renders.
    check('and the order is stable across two calls',
        JSON.stringify(rulesFor('exam', 'negative'))
        === JSON.stringify(rulesFor('exam', 'negative')));
}

/* ------------------------------------------------------------------ *
 * 9. Identity
 * ------------------------------------------------------------------ */

section('9. Identity');
{
    check('a session id is minted with a recognisable prefix',
        newSessionId().startsWith('sit_'));
    check('and an event id with its own',
        newEventId().startsWith('pe_'));
    const ids = new Set(Array.from({ length: 200 }, () => newEventId()));
    check('two hundred event ids are two hundred distinct ids',
        ids.size === 200, ids.size);
    check('a focus award is five minutes, which is what the rules say',
        FOCUS_AWARD_MS === 5 * 60 * 1000);
}

/* ------------------------------------------------------------------ *
 * 10. How a practice event reaches the leaderboard
 * ------------------------------------------------------------------ */

section('10. A practice event scores without becoming a certificate');
{
    const practice = (id: string, points: number, severity: 'positive' | 'negative') => ({
        kind: 'practice' as const, userId: 'u1', name: '', subjectId: 'exam-1',
        unique: id, passed: false, at: 1_700_000_000_000, points, severity,
        action: severity === 'negative' ? 'window.left' : 'focus.sustained',
        label: 'x', context: 'exam' as const, sessionId: 's1',
    });

    check('a practice event carries its own points',
        pointsFor(practice('a', -4, 'negative')) === -4);
    check('and a positive one earns them',
        pointsFor(practice('b', 2, 'positive')) === 2);
    check('an event with no carried points is worth nothing rather than NaN',
        pointsFor({ ...practice('c', 0, 'positive'), points: undefined } as any) === 0);

    // THE DEDUPE. `bestAttempts` keys on (user, kind, subject), and a sitting
    // produces a dozen actions against one subject - so without `unique` the
    // whole ledger collapses to one event and the conduct score becomes
    // whichever action happened to be scanned last.
    const many = [practice('a', -4, 'negative'), practice('b', -4, 'negative'),
        practice('c', -4, 'negative')];
    check('three actions against one exam stay three events',
        bestAttempts(many).length === 3, bestAttempts(many).length);
    check('and an assessment attempt still collapses',
        bestAttempts([
            { kind: 'exam', userId: 'u1', name: '', subjectId: 'e1', score: 60, passed: false, at: 1 },
            { kind: 'exam', userId: 'u1', name: '', subjectId: 'e1', score: 90, passed: true, at: 2 },
        ]).length === 1);

    // ITS OWN BRANCH. Left to fall through, a practice action would be counted
    // as a CERTIFICATE - so a learner five breaches in would appear to hold
    // five certificates nobody issued. Exactly what happened to the labs.
    const rows = aggregate([...many, practice('d', 2, 'positive')]);
    check('a practice event is not counted as a credential',
        rows[0].certificates === 0, rows[0]);
    check('nor as an assessment - it would move the platform pass rate',
        rows[0].assessmentsTaken === 0, rows[0]);
    check('nor as a lab', rows[0].labsStarted === 0 && rows[0].labsCompleted === 0);
    check('the conduct points are broken out on their own',
        rows[0].conductPoints === -10, rows[0].conductPoints);
    check('and the breaches are counted',
        rows[0].negativeActions === 3 && rows[0].positiveActions === 1, rows[0]);
    check('and they reach the total',
        rows[0].points === -10, rows[0].points);
}

/* ------------------------------------------------------------------ *
 * 11. The dossier
 * ------------------------------------------------------------------ */

section('11. The activity record');
{
    const DAY = 86_400_000;
    const now = 1_700_000_000_000;
    const events = [
        { kind: 'exam' as const, userId: 'u1', name: 'Sam Ali', subjectId: 'e1', subjectName: 'Networks', score: 92, passed: true, at: now - 10 * DAY },
        { kind: 'exam' as const, userId: 'u1', name: 'Sam Ali', subjectId: 'e1', subjectName: 'Networks', score: 41, passed: false, at: now - 20 * DAY },
        { kind: 'exam' as const, userId: 'u1', name: 'Sam Ali', subjectId: 'e2', subjectName: 'Linux', score: 33, passed: false, at: now - 5 * DAY },
        { kind: 'quiz' as const, userId: 'u1', name: '', subjectId: 'q1', score: 80, passed: true, at: now - 3 * DAY },
        { kind: 'course_certificate' as const, userId: 'u1', name: 'Sam Ali', subjectId: 'c1', subjectName: 'Docker', score: null, passed: true, at: now - 30 * DAY, hours: 12 },
        { kind: 'exam_certificate' as const, userId: 'u1', name: 'Sam Ali', subjectId: 'e1', subjectName: 'Networks', score: null, passed: true, at: now - 10 * DAY },
        { kind: 'lab' as const, userId: 'u1', name: '', subjectId: 'lin-01', subjectName: 'Files', score: 100, passed: true, at: now - 2 * DAY, labPoints: 6, labPossible: 6 },
        { kind: 'practice' as const, userId: 'u1', name: '', subjectId: 'e2', unique: 'p1', passed: false, at: now - 5 * DAY, points: -4, severity: 'negative' as const, action: 'window.left', label: 'Left the exam window', reason: 'why', context: 'exam' as const, sessionId: 'sit-a' },
        { kind: 'practice' as const, userId: 'u1', name: '', subjectId: 'e2', unique: 'p2', passed: false, at: now - 5 * DAY, points: 2, severity: 'positive' as const, action: 'focus.sustained', label: 'Stayed on task', reason: 'why', context: 'exam' as const, sessionId: 'sit-a' },
        // Somebody else's, to prove the filter.
        { kind: 'exam' as const, userId: 'u2', name: 'Other', subjectId: 'e1', score: 70, passed: true, at: now - DAY },
    ];

    const dossier = buildDossier({
        userId: 'u1',
        events,
        labs: [
            { labId: 'lin-01', labName: 'Files', status: 'completed', earned: 6, possible: 6, percent: 100, startedAt: now - 3 * DAY, lastAt: now - 2 * DAY, completedAt: now - 2 * DAY },
            { labId: 'dk-01', labName: 'Images', status: 'in_progress', earned: 2, possible: 8, percent: 25, startedAt: now - DAY, lastAt: now - DAY, completedAt: 0 },
            // Opened and abandoned. NOT "in progress" - app 11 writes a record
            // the moment somebody clicks a link, and listing it would claim
            // work that never started.
            { labId: 'k8-01', labName: 'Pods', status: 'not_started', earned: 0, possible: 9, percent: 0, startedAt: 0, lastAt: now - 40 * DAY, completedAt: 0 },
        ],
        enrolments: [{ courseId: 'c1', courseName: 'Docker', at: now - 60 * DAY }],
    });

    check('somebody else\'s events are not in it',
        dossier.ledger.every(line => line.title !== 'Other'),
        dossier.ledger.map(l => l.title));
    check('the name is the freshest one that carried one',
        dossier.name === 'Sam Ali', dossier.name);
    check('achievement points and conduct points are separate',
        dossier.conductPoints === -2
        && dossier.achievementPoints === dossier.points + 2,
        { conduct: dossier.conductPoints, achievement: dossier.achievementPoints });
    check('and the total is their sum',
        dossier.points === dossier.achievementPoints + dossier.conductPoints);

    check('the best attempt is the one shown, matching the board',
        dossier.exams.passed[0]?.score === 92, dossier.exams.passed);
    check('and it knows how many attempts there were',
        dossier.exams.passed[0]?.attempts === 2, dossier.exams.passed[0]);
    check('a failure is on the record - a panel that showed only successes '
        + 'beside a total that went down would hide its own arithmetic',
        dossier.exams.failed.length === 1, dossier.exams.failed);
    check('both certificates are credentials', dossier.credentials.length === 2);
    check('the finished lab is finished', dossier.labsCompleted.length === 1);
    check('the started one is current', dossier.labsCurrent.length === 1
        && dossier.labsCurrent[0].labId === 'dk-01', dossier.labsCurrent);
    check('and the one that was only ever opened is NEITHER',
        !dossier.labsCompleted.concat(dossier.labsCurrent)
            .some(lab => lab.labId === 'k8-01'));
    check('the enrolment is listed and earns nothing',
        dossier.enrolments.length === 1
        && !dossier.ledger.some(line => line.title === 'Docker' && line.kind === 'practice'));

    check('the conduct breakdown is per action, worst first',
        dossier.conduct.byAction[0].action === 'window.left', dossier.conduct.byAction);
    check('and counts both directions',
        dossier.conduct.negatives === 1 && dossier.conduct.positives === 1);
    check('nothing is voided on one breach',
        dossier.conduct.voidedSittings.length === 0);

    // Five breaches in one sitting IS voided; the same five in a lab are not.
    const voided = buildDossier({
        userId: 'u1',
        events: Array.from({ length: 5 }, (_unused, index) => ({
            kind: 'practice' as const, userId: 'u1', name: '', subjectId: 'e9',
            unique: `v${index}`, passed: false, at: now, points: -4,
            severity: 'negative' as const, action: 'window.left', label: 'x',
            reason: 'y', context: 'exam' as const, sessionId: 'sit-void',
        })),
    });
    check('five breaches in one exam sitting names it as voided',
        voided.conduct.voidedSittings.length === 1, voided.conduct.voidedSittings);
    const labVoid = buildDossier({
        userId: 'u1',
        events: Array.from({ length: 9 }, (_unused, index) => ({
            kind: 'practice' as const, userId: 'u1', name: '', subjectId: 'l9',
            unique: `w${index}`, passed: false, at: now, points: -4,
            severity: 'negative' as const, action: 'window.left', label: 'x',
            reason: 'y', context: 'lab' as const, sessionId: 'sit-lab',
        })),
    });
    check('nine in a LAB names nothing - a lab cannot be voided',
        labVoid.conduct.voidedSittings.length === 0, labVoid.conduct.voidedSittings);

    check('the ledger is newest first',
        dossier.ledger.every((line, index) =>
            index === 0 || dossier.ledger[index - 1].at >= line.at));
    check('and the order is stable, so the list cannot reshuffle between renders',
        JSON.stringify(buildDossier({ userId: 'u1', events }).ledger)
        === JSON.stringify(buildDossier({ userId: 'u1', events }).ledger));
    check('the point ledger drops the lines that changed nothing',
        dossier.pointLedger.every(line => line.points !== 0)
        && dossier.pointLedger.length < dossier.ledger.length);

    const series = pointsSeries(dossier.ledger, { now });
    check('the series has buckets', series.length > 0, series.length);
    check('the last bucket starts before now, so there is no permanently '
        + 'empty column at the right edge',
        series[series.length - 1].start < now);
    check('the cumulative total ends at the ledger total',
        series[series.length - 1].cumulative
        === dossier.ledger.reduce((n, line) => n + line.points, 0),
        { series: series[series.length - 1].cumulative });
    check('and it counts the events as well as the points',
        series.reduce((n, point) => n + point.count, 0)
        === dossier.ledger.filter(line => line.at >= series[0].start).length);
    check('an empty ledger is an empty series rather than a crash',
        pointsSeries([], { now }).length === 0);

    const sources = pointsBySource(dossier.ledger);
    check('the sources are named and non-zero',
        sources.length > 0 && sources.every(row => row.points !== 0), sources);
    check('and an exam certificate is not among them - it is worth nothing '
        + 'by design, and a bar at zero is not information',
        !sources.some(row => row.label === 'Exam certificates'), sources);
}

/*
  THE RENDER CHECKS, last and awaited.

  Everything above drives plain functions and cannot see a TEMPLATE that throws
  — and the two ways these templates throw are both invisible in source: a
  missing i18n plugin makes every `$t(...)` throw and the component render
  nothing at all, and a reference the setup does not define is a runtime error
  rather than a compile one. See `render.ts`.
*/
const { renderChecks } = await import('./render');
await renderChecks(check, section);

console.log(failures ? `\n${failures} failed` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
