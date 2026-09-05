// Renders the practice components in node, and asserts what comes out.
//
//   (imported by tools/practice-check/check.ts)
//
// WHY A RENDER CHECK AND NOT JUST THE ENGINE
//
// Everything in `check.ts` drives plain functions. None of it can see a
// TEMPLATE that throws — and the two ways these particular templates throw are
// both invisible in source and both have precedent on this platform:
//
//  * **`$t` is a template-only global installed by a plugin.** Without it every
//    `$t(...)` throws `$t is not a function` during the first render, Vue aborts
//    the mount, and the component renders NOTHING. That is how the leaderboard
//    preview came to print `clean` for ten galaxies at six widths against a
//    page that had not rendered since the interface learned Arabic, and how
//    `check:qacoaching` first failed.
//  * **A reference to something the setup did not define** — a helper moved to a
//    module, a prop renamed — is a compile-time error in a `.ts` file and a
//    RUNTIME one in a template.
//
// What is asserted is not the markup. It is that the sentence a student is owed
// is actually in the output: the limit in the exam rules, the reassurance in the
// lab's, the strike count in the meter, and the words "public" and "cheating"
// where they have to appear.

import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { i18n, setLocale } from '@/i18n/runtime';
import IntegrityRules from '@/components/practice/IntegrityRules.vue';
import IntegrityMeter from '@/components/practice/IntegrityMeter.vue';
import LabScoring from '@/components/practice/LabScoring.vue';
import {
    NEGATIVE_LIMIT, verdictFor, type PracticeContext,
} from '@/utils/practiceIntegrity';

type Check = (label: string, ok: boolean, detail?: unknown) => void;
type Section = (title: string) => void;

async function render(component: any, props: Record<string, unknown>) {
    const app = createSSRApp(component, props);
    // NOT OPTIONAL. See the header.
    app.use(i18n);
    /*
      A STUB `router-link`, so the output is not two Vue warnings deep.

      There is no router here and there does not need to be: what is being
      asserted is the words, and an `<a>` carries them. A warning that appears
      on every run is a warning nobody reads, which is how a real one gets
      missed - and rendering it as an anchor also keeps the "it points at the
      leaderboard" assertion honest, because the href survives.
    */
    app.component('router-link', {
        props: { to: { type: [String, Object], default: '' } },
        // A RENDER FUNCTION, not a `template` string: the ESM build of
        // `@vue/server-renderer` refuses on-the-fly template compilation, and
        // the error it throws points at the component being rendered rather
        // than at the stub.
        setup(props: any, { slots }: any) {
            return () => h('a', { href: String(props.to) }, slots.default?.());
        },
    });
    return renderToString(app);
}

const breaches = (n: number) =>
    Array.from({ length: n }, () => ({ action: 'window.left' }));

const meterEvents = [
    { id: 'a', label: 'Left the exam window', points: -4,
      severity: 'negative' as const, at: Date.UTC(2026, 8, 5, 9, 14) },
    { id: 'b', label: 'Stayed on task', points: 2,
      severity: 'positive' as const, at: Date.UTC(2026, 8, 5, 9, 10) },
    { id: 'c', label: 'Started the paper', points: 0,
      severity: 'neutral' as const, at: Date.UTC(2026, 8, 5, 9, 2) },
];

export async function renderChecks(check: Check, section: Section) {
    section('12. The components render, and say what they have to say');

    /* ---------------- the rules ---------------- */
    for (const context of ['exam', 'quiz'] as PracticeContext[]) {
        const html = await render(IntegrityRules, { context });
        check(`the ${context} rules render at all`, html.length > 500, html.length);
        check(`the ${context} rules name the limit`,
            html.includes(String(NEGATIVE_LIMIT)), html.slice(0, 160));
        check(`the ${context} rules say the sitting is scored zero`,
            /score it zero/i.test(html));
        check(`the ${context} rules use the word cheating`,
            /cheating/i.test(html));
        check(`the ${context} rules say the record is public`,
            /public/i.test(html));
        // The one thing that must NOT be there: the reassurance a lab gets.
        check(`the ${context} rules do NOT promise that nothing can fail you`,
            !/Nothing here can fail you/.test(html));
        check(`the ${context} rules list a penalty with its sign`,
            html.includes('-4') || html.includes('−4'), 'no penalty figure');
    }

    const lab = await render(IntegrityRules, { context: 'lab' });
    check('the lab rules render', lab.length > 500, lab.length);
    /*
      THE OTHER DIRECTION, and it is the assertion worth having.

      A check that only proved the exam warning appears would pass with the
      lab's version showing the same alarm - which is exactly the behaviour a
      lab exists to unteach: a student who reads a five-strike warning in a lab
      stops leaving the window to read the documentation.
    */
    check('the lab rules promise that nothing can fail you',
        /Nothing here can fail you/.test(lab));
    check('and do NOT threaten a zero',
        !/score it zero/i.test(lab), lab.slice(0, 200));
    check('the lab rules still say the record is public - the reassurance is '
        + 'about failing, not about privacy',
        /public/i.test(lab));
    check('the lab rules list the tutor penalty, which is lab-only',
        /tutor/i.test(lab));
    check('and NOT the developer-tools one, which is not a lab action',
        !/developer tools/i.test(lab), 'devtools leaked into the lab table');

    /* ---------------- the meter ---------------- */
    const clean = await render(IntegrityMeter, {
        context: 'exam', verdict: verdictFor([], 'exam'), events: [],
    });
    check('a clean meter renders', clean.length > 200, clean.length);
    check('and names the limit rather than a bare count',
        clean.includes(String(NEGATIVE_LIMIT)));
    check('and says nothing is recorded',
        /Nothing recorded/i.test(clean));

    const warned = await render(IntegrityMeter, {
        context: 'exam', verdict: verdictFor(breaches(3), 'exam'),
        events: meterEvents,
    });
    check('a warned meter counts the breaches', /3/.test(warned));
    check('and reaches the critical band, which is a class on the root',
        /is-critical/.test(warned), warned.slice(0, 200));
    check('and lists the recorded actions',
        warned.includes('Left the exam window'));
    check('with a clock reading beside each',
        /\d{1,2}[:.]\d{2}/.test(warned), 'no time rendered');
    check('and the sign on the penalty',
        warned.includes('−4'), 'the minus sign is missing');

    const failed = await render(IntegrityMeter, {
        context: 'exam', verdict: verdictFor(breaches(5), 'exam'),
        events: meterEvents,
    });
    check('a failed meter says the sitting has been ended',
        /has been ended/i.test(failed), failed.slice(0, 300));
    check('and carries the failed band', /is-failed/.test(failed));

    const labMeter = await render(IntegrityMeter, {
        context: 'lab', verdict: verdictFor(breaches(7), 'lab'),
        events: meterEvents,
    });
    check('a lab meter draws NO strike pips - a lab has no limit to draw',
        !/pr-meter__pip/.test(labMeter), 'pips rendered for a lab');
    check('and says nothing can fail you', /fail you/i.test(labMeter));
    check('and is headed as a practice record rather than as exam integrity',
        /Practice record/i.test(labMeter) && !/Exam integrity/i.test(labMeter));

    /* ---------------- the lab scoring panel ---------------- */
    const scoring = await render(LabScoring, {});
    check('the lab scoring panel renders', scoring.length > 800, scoring.length);
    check('every rule in it has its numbers filled in - a literal {v0} on the '
        + 'page is a placeholder nothing filled',
        !/\{v\d\}/.test(scoring),
        (scoring.match(/\{v\d\}/g) || []).slice(0, 4));
    check('it quotes the task-point figure', /\b4\b/.test(scoring));
    check('it quotes the completion figure', /\b40\b/.test(scoring));
    check('it says nothing in a lab can fail you',
        /Nothing in a lab can fail you/.test(scoring));
    check('and it points at the leaderboard, because the record is public',
        /leaderboard/i.test(scoring));

    /* ---------------- and in Arabic ---------------- */
    /*
      THE RUNTIME, not the engine.

      Every check above passes the locale in nowhere: `$t` reads the module's
      own ref. A catalogue registered under the wrong id, or a `setLocale` that
      moves the ref but not the document, would leave every assertion above
      green and the page untranslated - which is working rule 39's failure
      exactly, and is what `check:i18n` says about its own last section.
    */
    setLocale('ar');
    try {
        const arabic = await render(IntegrityRules, { context: 'exam' });
        check('the exam rules render in Arabic', arabic.length > 500);
        check('and are actually in Arabic rather than English',
            /[؀-ۿ]/.test(arabic), arabic.slice(0, 200));
        check('and the English is gone from the headline',
            !/will end this sitting and score it zero/.test(arabic));
        const arabicLab = await render(LabScoring, {});
        check('and so is the lab scoring panel',
            /[؀-ۿ]/.test(arabicLab));
        check('with its numbers still filled in - a translated key that lost a '
            + 'placeholder renders the literal',
            !/\{v\d\}/.test(arabicLab),
            (arabicLab.match(/\{v\d\}/g) || []).slice(0, 4));
    } finally {
        setLocale('en');
    }
}
