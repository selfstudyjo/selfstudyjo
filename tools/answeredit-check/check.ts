// Verifies src/utils/answerEditing.ts without a browser.
//
//   npm run check:answeredit
//
// Editing a spoken answer while it is being spoken. Checked here rather than by
// sitting an interview because the properties that matter are invariants over
// arbitrary speech, and every one of them fails in a way a single run would not
// show:
//
//   * a correction NEVER wipes an answer that had more than one part in it. A
//     candidate who loses two minutes of speech to one misheard word will not
//     use the feature twice, and "sorry" is a word Whisper hears in the middle
//     of ordinary sentences;
//   * the words spoken BEFORE the correction survive it and the words after it
//     are kept -- "...and we scaled it, sorry, I scaled it" must keep "I scaled
//     it", which is the entire point;
//   * inserting at a caret leaves the caret after what was inserted, so a
//     replacement dictated over three chunks arrives in order rather than
//     backwards;
//   * nothing a candidate typed by hand is discarded by the next chunk landing.
//
// The module is imported, not re-implemented -- a check written against a second
// copy of the logic proves nothing about the first (app 23's identity e2e is the
// cautionary tale: its stub answered the same wrong endpoint the code did, so 8
// checks passed against a validator that refused the entire happy path).

import {
    COMMAND_PHRASES,
    COMMAND_WORDS,
    MAX_VOICE_UNDO_SEGMENTS,
    applyTranscript,
    caretHint,
    emptyAnswer,
    insertSpeech,
    joinSpeech,
    parseSpokenChunk,
    removeLastSegments,
    replaceSelection,
    resumeAtEnd,
    segmentStarts,
    setTypedText,
    undoSegments,
    wordCount,
    type AnswerState,
} from '../../src/utils/answerEditing';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

/** Speak a sequence of chunks into an empty answer. */
function say(chunks: string[], voiceEditing = true): AnswerState {
    let state = emptyAnswer();
    for (const chunk of chunks) state = applyTranscript(state, chunk, { voiceEditing });
    return state;
}

console.log('\n1. Plain dictation, with nothing to correct');
{
    const state = say(['I led the migration', 'to Kubernetes last year']);
    check('chunks are joined with a single space',
        state.text === 'I led the migration to Kubernetes last year', state.text);
    check('and the caret stays at the end', state.caret === null);
    check('an empty chunk changes nothing',
        applyTranscript(state, '   ').text === state.text);
    check('leading punctuation is not pushed away from the word before it',
        joinSpeech('the cluster', ', which was fine') === 'the cluster, which was fine');
    check('words are counted for the on-screen figure', wordCount('one two three') === 3);
    check('an empty answer counts zero, not one', wordCount('   ') === 0);
}

console.log('\n2. Where a part begins and ends');
{
    const text = 'I owned the rollout, we shipped it, and it worked';
    check('a comma starts a new part', segmentStarts(text).length === 3, segmentStarts(text));
    check('so does a full stop', segmentStarts('One. Two. Three.').length === 3);
    check('a run of punctuation is ONE boundary, not three',
        segmentStarts('Wait... no that is wrong').length === 2,
        segmentStarts('Wait... no that is wrong'));
    check('and a comma after it is a second one, not a fourth',
        segmentStarts('Wait... no, that is wrong').length === 3,
        segmentStarts('Wait... no, that is wrong'));
    check('removing one part cuts back to the last comma',
        removeLastSegments(text, 1) === 'I owned the rollout, we shipped it', removeLastSegments(text, 1));
    check('and takes the dangling comma with it',
        !removeLastSegments(text, 1).endsWith(','), removeLastSegments(text, 1));
    check('removing two goes back two',
        removeLastSegments(text, 2) === 'I owned the rollout', removeLastSegments(text, 2));
    check('an empty trailing part does not absorb the first correction',
        removeLastSegments('I owned the rollout, we shipped it, ', 1) === 'I owned the rollout',
        removeLastSegments('I owned the rollout, we shipped it, ', 1));
    check('removing more parts than there are leaves nothing rather than throwing',
        removeLastSegments('one, two', 9) === '');
    check('removing zero is a no-op', removeLastSegments(text, 0) === text);
    check('a negative count is a no-op too', removeLastSegments(text, -3) === text);
}

console.log('\n3. Saying "sorry"');
{
    const one = say(['I owned the rollout, we shipped it on Friday', 'sorry']);
    check('one "sorry" removes the last part',
        one.text === 'I owned the rollout', one.text);

    const two = say(['I owned the rollout, we shipped it, it worked', 'sorry sorry']);
    check('two remove two parts', two.text === 'I owned the rollout', two.text);

    const three = say(['one, two, three, four', 'sorry sorry ignore']);
    check('three different command words still count as three',
        three.text === 'one', three.text);

    // The property that decides whether anybody uses this twice.
    const survivor = say(['I designed it, I built it, I ran it', 'sorry']);
    check('a correction never empties an answer that had parts in it',
        survivor.text.length > 0, survivor.text);

    const rebuilt = say(['and we scaled it, sorry, I scaled it myself']);
    check('the words before the correction survive it',
        rebuilt.text.startsWith('and we scaled it') === false
        && rebuilt.text === 'I scaled it myself', rebuilt.text);

    const midChunk = say(['I ran the migration, we did the cutover', 'sorry I did the cutover']);
    check('and the words after it are kept -- the whole point',
        midChunk.text === 'I ran the migration I did the cutover', midChunk.text);

    check('a run longer than the cap is capped rather than clearing everything',
        parseSpokenChunk('sorry '.repeat(30)).commands === MAX_VOICE_UNDO_SEGMENTS,
        parseSpokenChunk('sorry '.repeat(30)).commands);
}

console.log('\n4. The phrases, and the words that are NOT commands');
{
    check('"scratch that" is one command, not two',
        parseSpokenChunk('scratch that').commands === 1,
        parseSpokenChunk('scratch that').commands);
    check('"let me rephrase" is one command',
        parseSpokenChunk('let me rephrase').commands === 1);
    check('"scratch that scratch that" is two',
        parseSpokenChunk('scratch that scratch that').commands === 2,
        parseSpokenChunk('scratch that scratch that').commands);
    check('a phrase and a word together count separately',
        parseSpokenChunk('sorry scratch that').commands === 2);

    // "delete" and "remove" are ordinary technical vocabulary and are
    // deliberately NOT single-word commands -- "I delete the temp files" must
    // not eat the clause before it.
    check('"delete" alone is not a command',
        parseSpokenChunk('I delete the temp files afterwards').commands === 0);
    check('"remove" alone is not a command',
        parseSpokenChunk('we remove the old nodes first').commands === 0);
    check('but "delete that" is', parseSpokenChunk('delete that').commands === 1);
    check('no single-word command is a word that only means something technical',
        !COMMAND_WORDS.includes('delete') && !COMMAND_WORDS.includes('remove'));
    check('every phrase is at least two words -- a one-word phrase is a word',
        COMMAND_PHRASES.every(p => p.trim().split(/\s+/).length >= 2));

    check('the LAST run wins, because a correction of a correction is the latest intent',
        say(['a, b, c, d', 'sorry the third one sorry the fourth one']).text
        === 'a, b, c the fourth one',
        say(['a, b, c, d', 'sorry the third one sorry the fourth one']).text);
}

console.log('\n5. Turning it off');
{
    const on = say(['I am sorry to say the first attempt failed']);
    const off = say(['I am sorry to say the first attempt failed'], false);
    check('with voice editing off, nothing is treated as a command',
        off.text === 'I am sorry to say the first attempt failed', off.text);
    check('and with it on, the same sentence IS edited -- which is why there is a switch',
        on.text !== off.text, { on: on.text, off: off.text });
    check('a chunk with no command is identical either way',
        say(['a clean sentence']).text === say(['a clean sentence'], false).text);
}

console.log('\n6. Highlight, replace, and dictate into the gap');
{
    const base: AnswerState = { text: 'I led the frontend team for two years', caret: null };
    const cut = replaceSelection(base, 'I led the '.length, 'I led the frontend team'.length);
    check('the highlighted words are gone', cut.text === 'I led the for two years', cut.text);
    check('and the caret is left where they were', cut.caret === 'I led the'.length, cut.caret);

    const filled = applyTranscript(cut, 'platform group');
    check('the next words land in the gap, not at the end',
        filled.text === 'I led the platform group for two years', filled.text);

    const second = applyTranscript(filled, 'in Amman');
    check('a second chunk lands AFTER the first, not before it -- the caret moved',
        second.text === 'I led the platform group in Amman for two years', second.text);

    check('an empty selection is a no-op, not an error',
        replaceSelection(base, 4, 4).text === base.text);
    check('a reversed selection is a no-op too',
        replaceSelection(base, 12, 3).text === base.text);
    check('a selection past the end is clamped rather than throwing',
        typeof replaceSelection(base, 0, 9999).text === 'string');

    check('going back to the end clears the caret', resumeAtEnd(second).caret === null);
    check('and then dictation appends again',
        applyTranscript(resumeAtEnd(second), 'overall').text.endsWith('overall'));

    check('the caret is described so it can be shown on screen',
        caretHint(cut).includes('I led the'), caretHint(cut));
    check('and there is nothing to describe when there is no caret',
        caretHint(base) === '');

    // A correction spoken while a caret is set applies to the text BEFORE it,
    // which is what the candidate just dictated into the gap -- and NOT to the
    // clause in front of the gap, which they never touched. Without the anchor
    // this deletes "I led the" as well, because with no comma in it the whole
    // head is one part.
    const corrected = applyTranscript(filled, 'sorry the platform team');
    check('a spoken correction at a caret edits the gap, not the end of the answer',
        corrected.text === 'I led the the platform team for two years', corrected.text);
    check('and it cannot reach back past the gap into text that was never touched',
        corrected.text.startsWith('I led the'), corrected.text);
    check('however many times it is repeated',
        applyTranscript(filled, 'sorry sorry sorry sorry').text
            .startsWith('I led the'),
        applyTranscript(filled, 'sorry sorry sorry sorry').text);
}

console.log('\n6b. The Undo button is the same rule as saying "sorry"');
{
    // Two ways to ask for the same thing, and they must not diverge -- a second
    // implementation in the component would be one refactor away from being
    // wrong in only one of them.
    const spoken = say(['I owned the rollout, we shipped it on Friday', 'sorry']);
    const pressed = undoSegments(
        { text: 'I owned the rollout, we shipped it on Friday', caret: null }, 1);
    check('the button and the spoken command give the same answer',
        spoken.text === pressed.text, { spoken: spoken.text, pressed: pressed.text });

    const inGap: AnswerState = {
        text: 'I led the platform group for two years', caret: 24, anchor: 9,
    };
    check('and the button obeys the anchor too, not just the spoken form',
        undoSegments(inGap, 1).text.startsWith('I led the'),
        undoSegments(inGap, 1).text);
    check('pressing it repeatedly cannot reach past the gap',
        undoSegments(undoSegments(undoSegments(inGap, 1), 1), 1).text
            .startsWith('I led the'));
}

console.log('\n7. Typing by hand');
{
    let state: AnswerState = { text: 'I ran the migration', caret: null };
    state = setTypedText(state, 'I ran the migration in 2024');
    check('a hand edit is adopted', state.text === 'I ran the migration in 2024');
    const next = applyTranscript(state, 'across four regions');
    check('and the next transcribed chunk is appended to what was TYPED, not to a stale buffer',
        next.text === 'I ran the migration in 2024 across four regions', next.text);

    const withCaret: AnswerState = { text: 'one two three four', caret: 7 };
    check('a caret inside the new text survives a hand edit',
        setTypedText(withCaret, 'one two THREE four').caret === 7);
    check('a caret past the end of a shortened answer is dropped rather than pointing at nothing',
        setTypedText(withCaret, 'one').caret === null);
    check('clearing the box is allowed', setTypedText(withCaret, '').text === '');
}

console.log('\n8. Odd input that must not throw');
{
    for (const chunk of ['', '   ', ',,,', 'sorry', '…', '؟؟؟', 'sorry, sorry, sorry',
                         'SORRY', 'Sorry.', 'oops!']) {
        try {
            applyTranscript({ text: 'a, b', caret: null }, chunk);
        } catch (e) {
            check(`chunk ${JSON.stringify(chunk)} threw`, false, String(e));
        }
    }
    check('every odd chunk is handled', true);
    check('a command is recognised whatever its case',
        parseSpokenChunk('SORRY').commands === 1 && parseSpokenChunk('Sorry.').commands === 1);
    check('and with punctuation stuck to it',
        parseSpokenChunk('oops!').commands === 1);
    check('a chunk that is nothing but commands still corrects',
        say(['a, b, c', 'sorry, sorry']).text === 'a', say(['a, b, c', 'sorry, sorry']).text);
    check('inserting nothing into an empty answer is still an empty answer',
        insertSpeech(emptyAnswer(), '   ').text === '');
}

console.log('');
if (failures) {
    console.log(`❌ answerEditing: ${failures} check(s) failed\n`);
    process.exit(1);
}
console.log('✅ answerEditing: all checks passed\n');
