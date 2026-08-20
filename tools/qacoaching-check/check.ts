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
// Three shapes have to render, and all three exist in the live data:
//
//   * a session recorded today, with the full coaching block;
//   * a session recorded before 2026-08-20, carrying `model_answer` alone;
//   * a question answered while no AI provider could be reached, whose guidance
//     is generic and must SAY it is generic rather than pass as a model answer.

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
    model_answer: 'I start by pinning down what is actually varying.',
    coaching: {
        model_answer: 'I start by pinning down what is actually varying.',
        key_points: ['Reproduce it before changing anything', 'Say what you check first',
                     'Explain how you verified the fix'],
        why: 'Intermittent bugs test method rather than knowledge.',
        feedback: 'You named logs, which is right, but stopped before saying how you narrow it down.',
        rating: 6,
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
        key_points: ['Plain-language definition first', 'Then the mechanism'],
        why: 'This tests depth.',
        feedback: 'AI feedback was unavailable for this answer.',
        rating: null,
        generic: true,
    },
};

async function main() {
    console.log('\n1. A question recorded today, with the full coaching block');
    {
        const html = await render(full, 2);
        check('the question is numbered from one, not from zero', html.includes('Q3.'), html.slice(0, 200));
        check('the question text is there', html.includes('intermittent failure'));
        check('what the candidate said is there', html.includes('I look at the logs'));
        check('the model answer is there', html.includes('pinning down what is actually varying'));
        check('every key point is rendered, not just the first',
            html.includes('Reproduce it before changing anything')
            && html.includes('Say what you check first')
            && html.includes('Explain how you verified the fix'));
        check('the key points are a list, not a run-on paragraph',
            (html.match(/<li[ >]/g) || []).length === 3, (html.match(/<li[ >]/g) || []).length);
        check('why the question is asked is there', html.includes('test method rather than knowledge'));
        check('the feedback on their own answer is there',
            html.includes('stopped before saying how you narrow it down'));
        check('the rating is shown out of ten', html.includes('6/10'));
        check('a 6 is banded mid, not good', html.includes('ji-qa-rating mid'), html);
        check('a real model answer is not labelled as a stand-in',
            !html.includes('could not be reached for this question'));
        check('and it is headed as a model answer',
            html.includes('A strong answer sounds like this'));
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
            && !html.includes('A strong answer sounds like this'));
        check('and it says outright that the coach could not be reached',
            html.includes('could not be reached for this question'));
        check('a null rating shows no pill', !html.includes('ji-qa-rating'), html);
        check('the key points still render', html.includes('Plain-language definition first'));
    }

    console.log('\n4. The edges');
    {
        const blank = await render({ question: 'Q?', answer: '' });
        check('an unanswered question says so rather than rendering an empty row',
            blank.includes('(no answer captured)'));

        const empty = await render({
            question: 'Q?', answer: 'A.',
            coaching: { model_answer: '', key_points: [], why: '', feedback: '', rating: null },
        });
        check('a coaching block with nothing in it renders no empty sections',
            !empty.includes('ji-qa-model') && !empty.includes('ji-qa-note'), empty);
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
            coaching: { model_answer: '<b>bold</b>', key_points: ['<i>x</i>'] },
        });
        check('nothing the AI or the candidate wrote renders as markup',
            !nasty.includes('<img src=x') && !nasty.includes('<script>')
            && !nasty.includes('<b>bold</b>') && !nasty.includes('<i>x</i>'), nasty);
    }

    console.log(failures === 0
        ? '\n✅ QaCoaching: all checks passed\n'
        : `\n❌ QaCoaching: ${failures} check(s) failed\n`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
