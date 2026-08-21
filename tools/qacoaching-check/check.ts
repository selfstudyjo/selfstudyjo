// Renders src/components/jobinterview/QaCoaching.vue without a browser.
//
//   npm run check:qacoaching
//
// The block every question in an interview report is drawn with. It is checked
// by actually RENDERING it, because the failure mode of a Vue template is not
// an exception -- a mistyped binding, a `v-if` on a field the record does not
// carry, or a nested value read one level too shallow all render as *nothing*,
// and a report with a silently missing section looks like a report the AI did
// not fill in. That is precisely the bug this whole change exists to fix, so
// shipping a second version of it would be poor.
//
// Four shapes have to render, and all four exist in the live data:
//
//   * a session recorded today: a SHORT model answer, the candidate's own answer
//     rewritten, one thing to fix, and feedback on what they actually said;
//   * a session recorded between 2026-08-20 and 2026-08-22, carrying the
//     four-bullet "what a strong answer must include" checklist that the report
//     no longer asks for -- it must still render for somebody re-reading an old
//     report, folded rather than as the headline;
//   * a session recorded before 2026-08-20, carrying `model_answer` alone;
//   * a question answered while no AI provider could be reached, whose guidance
//     is generic and must SAY it is generic rather than pass as a model answer.
//
// And one that only exists mid-interview: a question whose coaching call has not
// come back yet. The report is written as the interview runs now, so a question
// can legitimately be on screen with nothing under it -- and "nothing under it"
// is exactly what a broken report looks like, so it has to say which it is.

import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import QaCoaching from '../../src/components/jobinterview/QaCoaching.vue';
import type { QAPair } from '../../src/services/jobinterview.service';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

async function render(qa: QAPair, index = 0): Promise<string> {
    return renderToString(createSSRApp(QaCoaching as any, { qa, index }));
}

const full: QAPair = {
    question: 'How do you approach debugging an intermittent failure?',
    answer: 'I look at the logs and try to reproduce it.',
    seconds: 74,
    model_answer: 'I start by pinning down what is actually varying.',
    coaching: {
        model_answer: 'I start by pinning down what is actually varying.',
        improved_answer: 'I start by pinning down what is actually varying, then I reproduce it.',
        fix: 'Say what you check first, and how you verified the fix.',
        why: 'Intermittent bugs test method rather than knowledge.',
        feedback: 'You named logs, which is right, but stopped before saying how you narrow it down.',
        rating: 6,
        generic: false,
    },
};

/**
 * A record from the two days when the report asked for a checklist.
 *
 * It is not produced any more -- a generic four-bullet list under every question
 * is what the report looked like when the AI was unreachable, and it read as the
 * coach having said the same thing about all ten answers. But somebody
 * re-reading a report they have already read must not find a section missing.
 */
const checklistEra: QAPair = {
    question: 'Walk me through your experience with Terraform.',
    answer: 'I have used it for three years.',
    coaching: {
        model_answer: 'I have run Terraform across about 40 modules for three years.',
        key_points: ['Scope and scale, with numbers', 'One problem you owned end to end'],
        why: 'The interviewer is calibrating how much of the role you have already done.',
        feedback: 'Three years is a start; the scale is missing.',
        rating: 5,
        generic: false,
    },
};

const legacy: QAPair = {
    question: 'Tell me about yourself.',
    answer: 'I am a DevOps engineer with eight years of experience.',
    model_answer: 'A strong answer gives a concrete, structured response.',
};

const generic: QAPair = {
    question: 'What is a service mesh?',
    answer: 'It routes traffic between services.',
    model_answer: 'Open with a one-sentence definition, then the mechanism.',
    coaching: {
        model_answer: 'Open with a one-sentence definition, then the mechanism.',
        improved_answer: '',
        fix: 'Get past the definition to the mechanism and the trade-off.',
        why: 'This tests depth.',
        feedback: 'The AI coach could not be reached for this answer.',
        rating: null,
        generic: true,
    },
};

/** Mid-interview: this answer has been submitted and its coaching is still out. */
const pending: QAPair = {
    question: 'Tell me about a time you disagreed with a manager.',
    answer: 'We disagreed about the release date.',
    coaching_pending: true,
};

async function main() {
    console.log('\n1. A question recorded today, with the full coaching block');
    {
        const html = await render(full, 2);
        check('the question is numbered from one, not from zero', html.includes('Q3.'), html.slice(0, 200));
        check('the question text is there', html.includes('intermittent failure'));
        check('what the candidate said is there', html.includes('I look at the logs'));
        check('the model answer is there', html.includes('pinning down what is actually varying'));
        check('their own answer, rewritten, is there -- the most useful block in the report',
            html.includes('Your answer, made stronger')
            && html.includes('then I reproduce it'), html);
        check('the one thing to change is there',
            html.includes('The one thing to change')
            && html.includes('how you verified the fix'));
        check('how long they spoke for is shown', html.includes('74s'));
        check('why the question is asked is there', html.includes('test method rather than knowledge'));
        check('the feedback on their own answer is there',
            html.includes('stopped before saying how you narrow it down'));
        check('the rating is shown out of ten', html.includes('6/10'));
        check('a 6 is banded mid, not good', html.includes('ji-qa-rating mid'), html);
        check('a real model answer is not labelled as a stand-in',
            !html.includes('could not be reached for this question'));
        check('and it is headed as a SHORT model answer -- the checklist that used to '
            + 'sit under it is gone',
            html.includes('A strong answer, short')
            && !html.includes('What a strong answer must include'), html);
        check('nothing is pending on a coached question',
            !html.includes('Coaching this answer'));
    }

    console.log('\n1b. A record from the two days the report asked for a checklist');
    {
        const html = await render(checklistEra);
        check('it renders', html.includes('Terraform'));
        check('the model answer is the headline', html.includes('about 40 modules'));
        check('the checklist is kept rather than dropped -- a report already read must '
            + 'not lose a section',
            html.includes('Scope and scale, with numbers'), html);
        check('but it is folded away, not the headline it used to be',
            html.includes('<details') && html.includes('Checklist saved with this answer'), html);
        check('and the old heading is not printed anywhere',
            !html.includes('What a strong answer must include'));
    }

    console.log('\n1c. Mid-interview, before the coaching call has come back');
    {
        const html = await render(pending);
        check('the question and the answer are already on screen',
            html.includes('disagreed with a manager') && html.includes('the release date'));
        check('and it says the coaching is being written rather than showing nothing',
            html.includes('Coaching this answer'), html);
        check('no empty model-answer block in the meantime',
            !html.includes('A strong answer, short'));

        // A session saved between the answer and the coaching landing carries the
        // flag on a record that will never be coached again. A spinner for ever
        // is worse than the section being absent.
        const stale = await render({
            question: 'Q?', answer: 'A.', coaching_pending: true,
            coaching: { model_answer: 'A real answer.' },
        });
        check('a stored record with the flag still set shows its coaching, not a spinner',
            stale.includes('A real answer.') && !stale.includes('Coaching this answer'), stale);
    }

    console.log('\n2. A session recorded before the coaching existed');
    {
        const html = await render(legacy);
        check('it still renders', html.length > 0);
        check('the question is there', html.includes('Tell me about yourself'));
        check('their answer is there', html.includes('eight years of experience'));
        check('the stored model answer is shown',
            html.includes('A strong answer gives a concrete, structured response'));
        // The sections it has no data for must be absent, not empty-headed.
        check('no empty key-points heading', !html.includes('What a strong answer must include'));
        check('no empty why heading', !html.includes('Why they ask this'));
        check('no empty feedback heading', !html.includes('Feedback on your answer'));
        check('no rating pill invented', !html.includes('ji-qa-rating'));
    }

    console.log('\n3. Guidance produced with no AI provider available');
    {
        const html = await render(generic);
        check('it is headed as guidance, not as a model answer',
            html.includes('How to answer this kind of question')
            && !html.includes('A strong answer, short'));
        check('and it says outright that the coach could not be reached',
            html.includes('could not be reached for this question'));
        check('a null rating shows no pill', !html.includes('ji-qa-rating'), html);
        check('there is no "your answer, made stronger" block -- with no AI there is '
            + 'nothing to make it stronger with, and echoing their own words back under '
            + 'that heading is worse than leaving it out',
            !html.includes('Your answer, made stronger'), html);
        check('the one thing to change still renders', html.includes('the mechanism and the trade-off'));
    }

    console.log('\n4. The edges');
    {
        const blank = await render({ question: 'Q?', answer: '' });
        check('an unanswered question says so rather than rendering an empty row',
            blank.includes('(no answer captured)'));

        const empty = await render({
            question: 'Q?', answer: 'A.',
            coaching: {
                model_answer: '', key_points: [], why: '', feedback: '', rating: null,
                improved_answer: '', fix: '',
            },
        });
        check('a coaching block with nothing in it renders no empty sections',
            !empty.includes('ji-qa-model') && !empty.includes('ji-qa-note')
            && !empty.includes('ji-qa-improved'), empty);
        check('but the question and answer still render',
            empty.includes('Q1.') && empty.includes('A.'));

        // key_points arriving with blank strings in it -- a model that returned
        // ["", "x"] would otherwise draw an empty bullet.
        const ragged = await render({
            question: 'Q?', answer: 'A.',
            coaching: { model_answer: 'M.', key_points: ['', '  ', 'real point'] },
        });
        check('blank key points are dropped',
            (ragged.match(/<li[ >]/g) || []).length === 1, ragged);
        check('an answer with no seconds recorded prints no stray dot',
            !(await render({ question: 'Q?', answer: 'A.' })).includes('ji-qa-secs'));

        const zero = await render({
            question: 'Q?', answer: 'A.',
            coaching: { model_answer: 'M.', rating: 0 },
        });
        check('a rating of zero is shown, not treated as absent', zero.includes('0/10'));
        check('and it is banded low', zero.includes('ji-qa-rating low'));

        const ten = await render({
            question: 'Q?', answer: 'A.',
            coaching: { model_answer: 'M.', rating: 10 },
        });
        check('a rating of ten is banded good', ten.includes('ji-qa-rating good'));

        // Vue escapes interpolation, but the report shows text the AI wrote
        // about text the candidate spoke, so it is worth proving.
        const nasty = await render({
            question: '<img src=x onerror=alert(1)>',
            answer: '</div><script>alert(2)</script>',
            coaching: {
                model_answer: '<b>bold</b>', key_points: ['<i>x</i>'],
                improved_answer: '<u>improved</u>', fix: '<em>fix</em>',
            },
        });
        check('nothing the AI or the candidate wrote renders as markup',
            !nasty.includes('<img src=x') && !nasty.includes('<script>')
            && !nasty.includes('<b>bold</b>') && !nasty.includes('<i>x</i>')
            && !nasty.includes('<u>improved</u>') && !nasty.includes('<em>fix</em>'), nasty);
    }

    console.log(failures === 0
        ? '\n✅ QaCoaching: all checks passed\n'
        : `\n❌ QaCoaching: ${failures} check(s) failed\n`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
