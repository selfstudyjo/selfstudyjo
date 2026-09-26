// Verifies src/utils/reader.ts, the composable's own invariants, and the
// control's stylesheet -- without a browser and without a voice.
//
//   npm run check:reader
//
// EVERY PROPERTY BELOW FAILS SILENTLY. That is the whole reason this exists: the
// failure mode of a reader is a voice saying the wrong thing, saying it in the
// wrong language, or saying nothing at all -- and the page looks identical in
// all four cases. A screenshot cannot see any of it and neither can `vue-tsc`.
//
// In the order they matter:
//
//   * A WRONG-LANGUAGE VOICE. ~230 lesson write-ups and the whole Network
//     Simulator catalogue are English only, so an Arabic reader pressing play is
//     the NORMAL case rather than the edge one. Hand English prose to an Arabic
//     voice and the result is not accented English, it is noise -- the same
//     failure `pickVoice` returns null to prevent, arriving from the data side.
//   * CODE READ ALOUD. `hdfs dfs -du -h -s /data` spoken is unintelligible, and
//     a 300-line configuration file is forty minutes of it. This platform's labs
//     are SQL, Linux, Python, Terraform and Cisco IOS.
//   * A PASSAGE OVER 1200 CHARACTERS. App 36 truncates a synthesis request at
//     `MAX_TEXT_CHARS` and answers 200 with the audio for whatever survived --
//     no error, no header. The reader hears a sentence stop mid-word.
//   * A TABLE AS A STREAM OF CELLS. Every fact present, none attached to
//     anything.
//   * A PASSAGE THAT VANISHES. `sentences()` drops a one-character line and
//     returns nothing for some shapes, so a unit with no sentence structure --
//     a heading, a table cell, a list item -- has to fall back to itself.
//   * A LIST READ AS ONE RUN-ON SENTENCE, and an ordered list that restarts at
//     1 when the write-up resumed it at 4.
//   * AND A LOOKBEHIND ANYWHERE. `(?<=` is a *parse-time* syntax error on Safari
//     before 16.4 -- it would not misread a word, it would take the whole bundle
//     down on that browser. `linkify.ts` and `newscastEngine.ts` document the
//     same trap and this module is full of regexes.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    PASSAGE_CEILING,
    SERVER_TEXT_LIMIT,
    SPEECH_BUDGET,
    chunk,
    definitions,
    detectLang,
    dominantLanguage,
    estimateMs,
    hasSpeech,
    numbered,
    plain,
    planBlocks,
    planParts,
    planText,
    splitLong,
    tableSpeech,
    type ReaderLang,
} from '../../src/utils/reader';
import { blocks, type TableBlock } from '../../src/utils/lessonContent';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

// From the repo root, not from this file: the built check runs out of
// tools/reader-check/dist, so `../../` there is `tools/`.
const source = (relative: string) =>
    readFileSync(resolve(process.cwd(), relative), 'utf8');

/**
 * A file with its comments blanked.
 *
 * For the reason `check:aichat` and `check:lessoncontent` both need it: the
 * paragraph explaining WHY a lookbehind must never appear has to be allowed to
 * contain the characters `(?<=`, or the only way to pass the check is to delete
 * the explanation. A rule that fires on its own documentation is a rule nobody
 * can document (working rule 44).
 *
 * Blanked rather than removed, so any line number in a failure detail still
 * lines up with the file.
 */
const withoutComments = (text: string) => text
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, lead) => lead + ' '.repeat(m.length - lead.length));

/* Real prose, in all three scripts, so nothing below is measured on a toy. */
const EN = 'A network is three things: a shared medium, an address so each side '
    + 'knows who it is talking to, and an agreed protocol. Remove any one and '
    + 'there is no network at all.';
const AR = 'الشبكة ثلاثة أشياء: وسط مشترك ينقل الإشارة، وعنوان يعرف به كل طرف من '
    + 'يخاطب، وبروتوكول متفق عليه يفسر به الطرفان الإشارة بالطريقة نفسها. إذا '
    + 'حذفت أيًّا منها فلا توجد شبكة.';
const ZH = '网络由三件事构成：承载信号的共享介质、让双方知道对方是谁的地址，以及双方以'
    + '相同方式解释信号的约定协议。去掉其中任何一项，网络就不存在。';

console.log('\n1. Nothing to read is nothing to read');
{
    check('empty text is an empty plan', planText('').passages.length === 0);
    check('null is an empty plan', planText(null).passages.length === 0);
    check('undefined is an empty plan', planText(undefined).passages.length === 0);
    check('whitespace alone is an empty plan', planText('  \n\n \t ').passages.length === 0);
    check('no blocks is an empty plan', planBlocks([]).passages.length === 0);
    check('null blocks is an empty plan', planBlocks(null).passages.length === 0);
    check('an empty parts list is an empty plan', planParts([]).passages.length === 0);
    check('parts of nothing is an empty plan',
        planParts([null, '', '   ', undefined]).passages.length === 0);
    check('hasSpeech agrees', !hasSpeech(planText('')) && hasSpeech(planText(EN)));
    check('an empty plan has no dominant language',
        dominantLanguage(planText('')) === null);
    check('an empty plan takes no time', estimateMs(planText('')) === 0);
    // A caller that mutated the shared empty would corrupt every later caller's
    // plan, and the symptom would be a section reading somebody else's text.
    const a = planText('');
    a.passages.push({ text: 'leaked', lang: 'en' });
    check('the empty plan is not a shared mutable object',
        planText('').passages.length === 0, planText(''));
}

console.log('\n2. THE LANGUAGE COMES FROM THE SCRIPT, NOT FROM THE SETTING');
{
    // The decision the whole feature rests on. An Arabic interface over an
    // English write-up must answer `en`, every time.
    check('English prose is English', detectLang(EN, 'en') === 'en');
    check('English prose is STILL English when the reader chose Arabic',
        detectLang(EN, 'ar') === 'en', detectLang(EN, 'ar'));
    check('and still English when the reader chose Chinese',
        detectLang(EN, 'zh') === 'en', detectLang(EN, 'zh'));
    check('Arabic prose is Arabic even when the reader chose English',
        detectLang(AR, 'en') === 'ar', detectLang(AR, 'en'));
    check('Chinese prose is Chinese even when the reader chose English',
        detectLang(ZH, 'en') === 'zh', detectLang(ZH, 'en'));

    // The normalisation, and the case that makes it necessary. Counted raw,
    // Latin wins 4 to 2 here and an English voice is handed 标头.
    check('a short Chinese heading with a Latin term in it is Chinese',
        detectLang('HTTP 标头', 'en') === 'zh', detectLang('HTTP 标头', 'en'));
    check('an Arabic phrase with a Latin term in it is Arabic',
        detectLang('بروتوكول HTTP', 'en') === 'ar', detectLang('بروتوكول HTTP', 'en'));
    // And the other direction: one borrowed word must not capture a paragraph.
    check('an English paragraph with one Arabic word is English',
        detectLang(EN + ' شبكة', 'en') === 'en');
    check('an English paragraph with two Han characters is English',
        detectLang(EN + ' 网络', 'en') === 'en');

    // No letters at all is the ONLY case the reader's own setting decides.
    check('an address is read in the interface language (ar)',
        detectLang('192.168.10.0/24', 'ar') === 'ar');
    check('an address is read in the interface language (zh)',
        detectLang('192.168.10.0/24', 'zh') === 'zh');
    check('and in English when that is the interface language',
        detectLang('10.0.0.1 255.255.255.0', 'en') === 'en');
    check('empty text falls back', detectLang('', 'zh') === 'zh');
    check('a non-string falls back rather than throwing',
        detectLang(null as unknown as string, 'ar') === 'ar');

    // Digits and punctuation are NOT evidence: a table of versions would
    // otherwise read as English.
    check('digits and punctuation do not vote',
        detectLang('2026-09-26 (1.25) [3]', 'zh') === 'zh');

    // Deterministic. An answer that changed between two renders of the same
    // text would change the voice mid-document for no reason a reader could see.
    check('the same text always answers the same language',
        detectLang('HTTP 标头', 'en') === detectLang('HTTP 标头', 'en'));
}

console.log('\n3. The language survives into the plan, per block');
{
    const mixed = planText(`## ${AR}\n\n${EN}\n\n${ZH}`, 'ar');
    const langs = mixed.passages.map(p => p.lang);
    check('an Arabic heading, an English paragraph and a Chinese one are three languages',
        new Set(langs).size === 3, langs);
    check('the plan names every language it will use',
        ['ar', 'en', 'zh'].every(l => mixed.languages.includes(l as ReaderLang)),
        mixed.languages);
    check('the languages are in the order first met',
        mixed.languages.join(',') === 'ar,en,zh', mixed.languages);

    // Detected PER BLOCK, not per passage: a chunk boundary inside one
    // paragraph must not flip the voice mid-thought.
    const long = planText(EN + ' ' + EN + ' ' + EN + ' ' + EN, 'ar');
    check('a paragraph split across passages keeps one language',
        long.passages.length > 1 && new Set(long.passages.map(p => p.lang)).size === 1,
        { passages: long.passages.length, langs: [...new Set(long.passages.map(p => p.lang))] });

    // And per block rather than per list ITEM: a two-word entry inside an
    // Arabic list would otherwise be read by a different person.
    const list = planText(`- ${AR}\n- OSI\n- ${AR}`, 'ar');
    check('a short Latin item inside an Arabic list is still read in Arabic',
        list.passages.every(p => p.lang === 'ar'), list.passages.map(p => p.lang));

    // The dominant language is by CHARACTERS, so three short headings do not
    // outvote the paragraph the section is actually made of.
    const dom = planText(`## ${AR}\n\n${EN + ' ' + EN}`, 'en');
    check('the dominant language is the one most of the text is in',
        dominantLanguage(dom) === 'en', dominantLanguage(dom));
}

console.log('\n4. CODE IS NEVER READ ALOUD, AND IS ALWAYS COUNTED');
{
    const doc = `${EN}\n\n\`\`\`bash\nhdfs dfs -du -h -s /data\n\`\`\`\n\n${EN}`;
    const p = planText(doc);
    check('a fenced block is skipped', p.skippedCode === 1, p.skippedCode);
    check('and its text is nowhere in the plan',
        !p.passages.some(x => x.text.includes('hdfs')), p.passages);
    check('the prose around it is still read', p.passages.length >= 2, p.passages.length);

    const two = planText('```\na\n```\n\ntext\n\n```sql\nSELECT *\n```');
    check('several fenced blocks are all counted', two.skippedCode === 2, two.skippedCode);
    check('and none of them is spoken',
        !two.passages.some(x => /SELECT/.test(x.text)), two.passages);

    const only = planText('```\nterraform apply\n```');
    check('a section that is nothing but code has nothing to read',
        only.passages.length === 0 && only.skippedCode === 1, only);
    // Reported rather than swallowed: the student can SEE the command, so a
    // voice that skips it without a word reads as the reader having stopped.
    check('and it still reports the skip so the control can say so',
        only.skippedCode === 1);

    // INLINE code is the opposite case and must survive: it is a term in the
    // middle of a sentence, and dropping it removes the subject.
    check('inline code keeps its content',
        plain('turn an IP into a MAC with `ARP` first').includes('ARP'),
        plain('turn an IP into a MAC with `ARP` first'));
}

console.log('\n5. No passage can be truncated by the backend');
{
    check('the budget is under the server limit', SPEECH_BUDGET < SERVER_TEXT_LIMIT);
    check('and so is the hard ceiling', PASSAGE_CEILING < SERVER_TEXT_LIMIT);
    check('the ceiling is above the budget', PASSAGE_CEILING > SPEECH_BUDGET);

    // Real documents, at the two lengths that actually turn up.
    const huge = planText(Array.from({ length: 40 }, () => EN).join(' '));
    const over = huge.passages.filter(p => p.text.length > PASSAGE_CEILING);
    check('a 40-paragraph run of prose produces no over-long passage',
        over.length === 0, over.map(p => p.text.length));

    // One sentence with no terminator anywhere in it -- an operator paste, a
    // Google Docs export with its punctuation eaten. This is the shape that
    // reaches `splitLong`.
    const runOn = 'word '.repeat(600).trim();
    const p = planText(runOn);
    check('a 3000-character run-on sentence is still cut under the ceiling',
        p.passages.every(x => x.text.length <= PASSAGE_CEILING),
        p.passages.map(x => x.text.length));
    check('and nothing is lost in the cutting',
        p.passages.map(x => x.text).join(' ').replace(/\s+/g, ' ')
            .includes('word word word'));

    // Chinese has no spaces, so the space step cannot apply and the ceiling
    // itself has to decide -- and it has to TERMINATE.
    const zhRunOn = '网络'.repeat(900);
    const zp = planText(zhRunOn, 'zh');
    check('a Chinese run of 1800 characters is cut under the ceiling',
        zp.passages.length > 1
        && zp.passages.every(x => x.text.length <= PASSAGE_CEILING),
        zp.passages.map(x => x.text.length));

    // splitLong must make progress on every iteration or it hangs the tab.
    check('splitLong always makes progress (en)',
        splitLong('x'.repeat(5000), 'en').every(s => s.length > 0
            && s.length <= PASSAGE_CEILING));
    check('splitLong always makes progress (zh)',
        splitLong('网'.repeat(5000), 'zh').every(s => s.length > 0
            && s.length <= PASSAGE_CEILING));
    check('splitLong leaves a short string alone',
        splitLong('short', 'en').join('') === 'short');
    check('splitLong prefers a comma to the ceiling',
        splitLong('a'.repeat(500) + ', ' + 'b'.repeat(500), 'en')[0]!.endsWith(','),
        splitLong('a'.repeat(500) + ', ' + 'b'.repeat(500), 'en')[0]!.slice(-8));
    check('and a space to a mid-word cut',
        !/\S$/.test(splitLong('aa '.repeat(400), 'en')[0]!)
        || splitLong('aa '.repeat(400), 'en')[0]!.endsWith('aa'),
        splitLong('aa '.repeat(400), 'en')[0]!.slice(-6));
}

console.log('\n6. Nothing a voice must not say survives');
{
    check('bold markers are gone', plain('the **medium** carries it') === 'the medium carries it',
        plain('the **medium** carries it'));
    check('double-underscore bold is gone too',
        plain('the __medium__ carries it') === 'the medium carries it');
    check('single-asterisk emphasis is gone',
        plain('the *medium* carries it') === 'the medium carries it');
    check('strikethrough is gone',
        plain('~~old~~ new') === 'old new', plain('~~old~~ new'));
    check('a link becomes its text',
        plain('see [the Docker docs](https://docs.docker.com/x) first')
            === 'see the Docker docs first',
        plain('see [the Docker docs](https://docs.docker.com/x) first'));
    check('an image becomes its alt text',
        plain('![a switch](https://x/y.png)') === 'a switch',
        plain('![a switch](https://x/y.png)'));
    check('a bare URL is not read out character by character',
        !plain('see https://docs.docker.com/engine/ for more').includes('http'),
        plain('see https://docs.docker.com/engine/ for more'));
    check('a heading marker never reaches the voice',
        !plain('## Overview').includes('#'), plain('## Overview'));
    check('a quote marker does not either',
        plain('> worth knowing') === 'worth knowing', plain('> worth knowing'));
    check('a horizontal rule is not a word',
        plain('---').trim() === '', JSON.stringify(plain('---')));
    check('an HTML entity is decoded rather than spelled out',
        !plain('said &quot;no&quot;').includes('quot'), plain('said &quot;no&quot;'));

    // AN IDENTIFIER KEEPS ITS UNDERSCORES. The regex that strips `_emphasis_`
    // without eating these needs a lookbehind, which is a parse-time error on
    // Safari before 16.4 -- so it is deliberately not attempted.
    check('user_id keeps its underscore', plain('the user_id field').includes('user_id'),
        plain('the user_id field'));
    check('exam_pass_score keeps its underscores',
        plain('set exam_pass_score to 70').includes('exam_pass_score'));

    // An unbalanced marker must be left alone rather than eating the rest of
    // the sentence.
    check('an unbalanced marker is left alone',
        plain('2 * 3 is six').includes('2 * 3'), plain('2 * 3 is six'));
}

console.log('\n7. A list is read as a list');
{
    const ul = planText(`- first thing\n- second thing\n- third thing`);
    check('an unordered list is one passage per item',
        ul.passages.length === 3, ul.passages.map(p => p.text));
    check('and each item ends in a stop so the voice breathes',
        ul.passages.every(p => /[.!?]$/.test(p.text)), ul.passages.map(p => p.text));

    const ol = planText(`1. do this\n2. then this\n3. then this`);
    check('an ordered list is numbered aloud',
        ol.passages[0]!.text.startsWith('1.')
        && ol.passages[1]!.text.startsWith('2.'), ol.passages.map(p => p.text));

    // THE NUMBER IT ACTUALLY STARTS AT. The console's drafts routinely resume a
    // step list after a code block, so a list starting at 4 is ordinary here --
    // and a voice saying "one, two, three" over steps four, five and six is
    // telling a student to redo work they have already done.
    const resumed = planText(`4. fourth step\n5. fifth step`);
    check('a resumed list keeps the number it starts at',
        resumed.passages[0]!.text.startsWith('4.')
        && resumed.passages[1]!.text.startsWith('5.'),
        resumed.passages.map(p => p.text));

    // A one-word item must not be dropped: `sentences()` discards a line of one
    // character and returns nothing for some shapes, so the fallback matters.
    const terse = planText('- ARP\n- MAC\n- IP');
    check('a one-word list item is still read', terse.passages.length === 3,
        terse.passages.map(p => p.text));

    check('numbered() produces notation the parser understands',
        planText(numbered(['alpha', 'beta'])).passages.length === 2,
        planText(numbered(['alpha', 'beta'])).passages.map(p => p.text));
    check('numbered() numbers from one',
        planText(numbered(['alpha', 'beta'])).passages[0]!.text.startsWith('1.'));
    check('numbered() drops blanks rather than numbering them',
        numbered(['a', '', '   ', 'b']).split('\n').length === 2, numbered(['a', '', 'b']));
    check('numbered([]) is empty', numbered([]) === '');
}

console.log('\n8. A TABLE IS READ AS PAIRS');
{
    const doc = '| Strategy | Downtime | Rollback |\n'
        + '|---|---|---|\n'
        + '| Rolling | none | one command |\n'
        + '| Recreate | seconds | redeploy |';
    const rows = blocks(doc);
    check('the document really is parsed as a table',
        rows.length === 1 && rows[0]!.kind === 'table', rows.map(r => r.kind));

    const said = tableSpeech(rows[0] as TableBlock);
    check('one sentence per row', said.length === 2, said);
    // Without the pairing this is "rolling, none, one command" -- every fact
    // present and none of it attached to anything.
    check('every value carries its column heading',
        said[0]!.includes('Downtime: none')
        && said[0]!.includes('Rollback: one command'), said[0]);
    check('the first cell leads the sentence rather than being labelled',
        said[0]!.startsWith('Rolling'), said[0]);
    check('and it is not read twice',
        (said[0]!.match(/Rolling/g) || []).length === 1, said[0]);
    check('each row ends in a stop', said.every(s => /[.!?]$/.test(s)), said);

    // An empty cell read as its heading with nothing after it is a stumble that
    // reads as the voice having lost its place.
    const gappy = tableSpeech(blocks(
        '| A | B | C |\n|---|---|---|\n| one |  | three |')[0] as TableBlock);
    check('an empty cell is skipped rather than announced',
        !gappy[0]!.includes('B:'), gappy[0]);

    // No header row is legal and rare; inventing column names would be worse
    // than the ambiguity.
    const headless = blocks('| one | two |\n|---|---|');
    check('a table with no body has nothing to say',
        tableSpeech(headless[0] as TableBlock).length === 0);

    const inPlan = planText(doc);
    check('a table in a write-up reaches the plan', inPlan.passages.length === 2,
        inPlan.passages.map(p => p.text));
    // A table is READING -- often the densest part of a lesson -- so it has to
    // count towards the estimate.
    check('and it counts towards the estimate', estimateMs(inPlan) > 0);
}

console.log('\n9. Definitions are attributable');
{
    const text = definitions([
        { term: 'MAC address', meaning: '48-bit hardware address' },
        { term: 'ARP', meaning: 'turns a known IP into an unknown MAC' },
    ]);
    const p = planText(text);
    check('each pair is its own passage', p.passages.length === 2, p.passages.map(x => x.text));
    check('and the meaning is attached to its term',
        p.passages[0]!.text.includes('MAC address')
        && p.passages[0]!.text.includes('48-bit'),
        p.passages[0]);
    check('a pair with no meaning is still said',
        definitions([{ term: 'ARP' }]).includes('ARP'));
    check('an empty pair is dropped',
        definitions([{ term: '', meaning: '' }, { term: 'x', meaning: 'y' }])
            .split('\n\n').length === 1);
    check('definitions([]) is empty', definitions([]) === '');
}

console.log('\n10. Chunking');
{
    check('a short paragraph is one passage', chunk(EN, 'en').length === 1, chunk(EN, 'en'));
    check('sentences are packed up to the budget',
        chunk(Array.from({ length: 6 }, () => EN).join(' '), 'en')
            .every(s => s.length <= PASSAGE_CEILING));
    check('nothing comes back empty',
        chunk(EN + '\n\n\n' + EN, 'en').every(s => s.trim().length > 0));
    check('empty text is no passages', chunk('', 'en').length === 0);
    check('whitespace is no passages', chunk('   \n  ', 'en').length === 0);

    // A unit with no sentence structure at all -- which is every heading, every
    // table cell and every short list item. `sentences()` can return [] for
    // these, and a passage that silently disappears is a paragraph the voice
    // skips over.
    check('a heading with no terminator is not lost',
        chunk('Overview', 'en').length === 1, chunk('Overview', 'en'));
    check('a single character is not lost',
        chunk('A', 'en').length === 1, chunk('A', 'en'));

    // THE ARABIC AND CHINESE SPLITTING RULES. An English-only `/[.!?]\s/`
    // returns one enormous sentence for either script, and then every budget
    // downstream silently stops applying (working rule 40).
    const arLong = Array.from({ length: 8 }, () => AR).join(' ');
    check('Arabic prose is split into several passages',
        chunk(arLong, 'ar').length > 1, chunk(arLong, 'ar').length);
    check('and every one is inside the ceiling',
        chunk(arLong, 'ar').every(s => s.length <= PASSAGE_CEILING));
    const zhLong = Array.from({ length: 8 }, () => ZH).join('');
    check('Chinese prose is split into several passages',
        chunk(zhLong, 'zh').length > 1, chunk(zhLong, 'zh').length);
    check('and every one is inside the ceiling',
        chunk(zhLong, 'zh').every(s => s.length <= PASSAGE_CEILING));
}

console.log('\n11. The estimate is per language');
{
    // Chinese is ~5 characters a second against English's 14, so one rate for a
    // mixed document is wrong by minutes in one direction or the other.
    const en = planText('x'.repeat(700), 'en');
    const zh = planText('网'.repeat(700), 'zh');
    check('the same number of characters takes longer in Chinese',
        estimateMs(zh) > estimateMs(en) * 2, { en: estimateMs(en), zh: estimateMs(zh) });
    check('an Arabic passage is slower than an English one',
        estimateMs(planText('ش'.repeat(700), 'ar')) > estimateMs(en),
        estimateMs(planText('ش'.repeat(700), 'ar')));
    check('a mixed plan is the sum of its parts, not one rate over all of it',
        estimateMs(planText(`${EN}\n\n${ZH}`, 'en'))
            > estimateMs(planText(EN, 'en')) + estimateMs(planText(EN, 'en')) * 0.2);
}

console.log('\n12. planParts reads its pieces in order, each in its own language');
{
    const p = planParts([AR, EN], 'ar');
    check('both pieces are read', p.passages.length >= 2, p.passages.length);
    check('the first is Arabic and the last is English',
        p.passages[0]!.lang === 'ar'
        && p.passages[p.passages.length - 1]!.lang === 'en',
        p.passages.map(x => x.lang));
    check('order is preserved', p.passages[0]!.text.includes('الشبكة'), p.passages[0]!.text);
    check('a blank piece is skipped rather than read as a pause',
        planParts([EN, '', null, EN]).passages.length
            === planParts([EN, EN]).passages.length);
    check('code inside a part is skipped and counted',
        planParts(['```\nrm -rf /\n```', EN]).skippedCode === 1,
        planParts(['```\nrm -rf /\n```', EN]).skippedCode);
    check('and the dangerous command is nowhere in the plan',
        !planParts(['```\nrm -rf /\n```', EN]).passages.some(x => x.text.includes('rm -rf')));
}

console.log('\n13. No lookbehind, anywhere');
{
    // `(?<=` is a PARSE-TIME syntax error on Safari before 16.4. It would not
    // misread a word -- it would take the whole bundle down on that browser, so
    // every page on the platform would be blank for those readers.
    for (const file of [
        'src/utils/reader.ts',
        'src/composables/useReader.ts',
        'src/components/ReadAloud.vue',
    ]) {
        const text = withoutComments(source(file));
        check(`${file} contains no lookbehind`, !text.includes('(?<'),
            text.match(/\(\?<[^)]{0,40}/g));
    }
}

console.log('\n14. The composable cannot leave a voice running');
{
    const js = withoutComments(source('src/composables/useReader.ts'));

    // `speechSynthesis` belongs to the WINDOW. Without a cancel it reads the
    // lesson over whatever page the student opens next.
    check('every stop cancels speechSynthesis',
        /speechSynthesis\?\.cancel\(\)/.test(js), 'cancelSpeech must call cancel()');
    check('and stops the Web Audio source too', /audio\.stop\(\)/.test(js));
    check('and clears the keepalive and the watchdog',
        /clearInterval\(keepAlive\)/.test(js) && /clearTimeout\(watchdog\)/.test(js));

    // Chrome stops speaking after ~15s and `onend` frequently never arrives, so
    // a long passage is cut off AND the promise never settles -- a reader stuck
    // mid-document with the bar saying it is still playing.
    check('the Chrome keepalive is installed',
        /speechSynthesis\.pause\(\)/.test(js) && /speechSynthesis\.resume\(\)/.test(js));
    check('and a watchdog sized to the text backs it up',
        /watchdog = setTimeout\(finish/.test(js) && /estimateDurationMs\(/.test(js));

    // An AudioContext created outside a user gesture starts suspended and every
    // clip on it is silently ignored -- a section that reads in total silence.
    check('read() primes the audio context', /audio\.prime\(\)/.test(js));

    // THE CAPABILITY PROBE IS NOT SPENT WHEN THE DEVICE CAN ALREADY SPEAK. It
    // is a round trip to a replica whose first answer of the day takes ~20
    // seconds and it sits on an `await` in front of the first word -- which is
    // the one number the whole chunking budget is tuned around.
    check('the capability probe is skipped when the device has the voices',
        /if \(languages\.every\(lang => deviceCanSpeak\(voices\.value, lang\)\)\) return;/
            .test(js));
    check('and it is asked about the languages the PLAN actually holds',
        /await probe\(next\.languages\)/.test(js));
    const readBody = js.slice(js.indexOf('async function read('));
    check('and primes it before anything is awaited',
        readBody.indexOf('audio.prime()') < readBody.indexOf('await '),
        { prime: readBody.indexOf('audio.prime()'), await: readBody.indexOf('await ') });

    // A synthesis is a round trip and a decode is asynchronous, so an abandoned
    // chain resumes talking over the new one. speechSynthesis has no
    // AbortController, which is why this is a counter.
    // A COUNT IS NOT ENOUGH, and the negative harness proved it: removing the
    // guard at the top of the loop left five other occurrences and the check
    // passed. What matters is WHERE they are -- the one inside the loop is what
    // stops an abandoned chain advancing the new read's index, and the one
    // after each await is what stops it speaking.
    check('a generation counter exists', /let turn = 0/.test(js));
    check('and the loop checks it before touching the index',
        /for \(let at = from; at < plan\.passages\.length; at\+\+\) \{\s*if \(mine !== turn\) return;\s*index\.value = at;/
            .test(js),
        js.slice(js.indexOf('for (let at = from'), js.indexOf('for (let at = from') + 200));
    check('and again after the passage has been said',
        /const said = await sayOnServer\(passage, mine\);\s*if \(mine !== turn\) return;/.test(js));
    check('and again after the device fallback',
        /await sayOnDevice\(passage, mine\);\s*if \(mine !== turn\) return;/.test(js));
    check('the reader state is module-level, so two sections cannot both read',
        /^const state = ref<ReaderState>/m.test(js)
        && /^const section = ref<string \| null>/m.test(js));

    // A failure on the server route falls through to the device engine rather
    // than abandoning the document; three in a row stop with a message, because
    // skipping silently through forty reads as a dead button.
    check('a server failure falls through to the device engine',
        /await sayOnDevice\(passage, mine\)/.test(js));
    check('and three in a row stop with a message',
        /MAX_FAILURES/.test(js) && /error\.value = 'speech-unavailable'/.test(js));
    // Only a SERVER route counts as a failure. Counting a device route would
    // abandon the read after three passages on every machine with its own
    // voices -- i.e. on the fast path.
    check('a device route is not counted as a failure',
        /if \(spoken\.route === 'server'\) failures\+\+/.test(js));

    // The next passage is synthesised while this one plays, or there is a round
    // trip of silence between every passage.
    check('the next passage is prefetched', /function prefetch\(/.test(js)
        && /prefetch\(plan\.passages\[at \+ 1\]\)/.test(js));

    // THE PAGE RESERVES ROOM FOR THE BAR, and both halves are needed: the
    // attribute is set by the composable and consumed by the file that owns
    // `.main-content`'s padding. Measured, the bar is 115px tall on a 390px
    // phone against the 110px that container reserves, so without this the last
    // ~20px of the final element on the page is underneath it.
    check('the document is marked while a bar is up',
        /root\.setAttribute\('data-sfs-reading', '1'\)/.test(js)
        && /root\.removeAttribute\('data-sfs-reading'\)/.test(js));
    check('and the mark is cleared when the read ends',
        /function finishRead\(\): void \{[\s\S]{0,160}markReading\(false\);/.test(js));
    const layout = withoutComments(source('src/assets/css/default-layout.css'));
    check('the layout reserves room for it',
        /html\[data-sfs-reading='1'\] \.app-container > \.main-content\s*\{[^}]*padding-bottom:\s*calc\(/
            .test(layout),
        layout.slice(layout.indexOf('data-sfs-reading') - 40, layout.indexOf('data-sfs-reading') + 200));
}

console.log('\n15. The control declares what it is doing');
{
    const vue = source('src/components/ReadAloud.vue');
    const code = withoutComments(vue);

    // WORKING RULE 13. A write-up, a brief and a runbook step are all records
    // fetched over the network, and the lesson page is open to a signed-out
    // visitor.
    check('nothing reaches v-html', !code.includes('v-html'));
    check('and marked is never imported', !code.includes("from 'marked'"));

    // A substitution that is not declared is the bug working rule 21 is about.
    // ~230 write-ups and the whole netsim catalogue are English only, so this
    // sentence is the normal case rather than an edge one.
    check('the language it is reading in is named when it differs',
        /dominantLanguage\(/.test(code) && /'Read in \{v0\}'/.test(code));
    check('and the skipped code is named',
        /skippedCode/.test(code)
        && /'\{v0\} code blocks are not read aloud'/.test(code));

    // `speechSynthesis` belongs to the window: BOTH hooks are needed, because a
    // route change does not always unmount and an unmount is not always a route
    // change.
    check('it stops on route leave', /onBeforeRouteLeave\(\(\) => \{ if \(mine\.value\)/.test(code));
    check('and on unmount', /onBeforeUnmount\(\(\) => \{ if \(mine\.value\)/.test(code));
    // Only if THIS section is reading: another section's button unmounting must
    // not silence it.
    check('but only for its own section',
        (code.match(/if \(mine\.value\) reader\.stop\(\)/g) || []).length >= 2,
        (code.match(/if \(mine\.value\) reader\.stop\(\)/g) || []).length);

    // Switching language switches the DOCUMENT underneath the voice.
    check('a language change stops the read',
        /watch\(localeId, \(\) => \{ if \(mine\.value\) reader\.stop\(\)/.test(code));

    // The bar is fixed and half these page wrappers are stacking contexts a
    // fixed descendant cannot escape.
    check('the transport bar is teleported to <body>', /<Teleport v-if="mine" to="body">/.test(vue));
    // A live region announcing progress would talk over the voice reading the
    // page.
    // Measured on the comment-stripped source, because the paragraph explaining
    // this rule contains the very string it asserts -- so against the raw file
    // the check passed with the attribute set to `polite`. The negative harness
    // found it; it is working rule 44 arriving inside the check that was
    // written to honour working rule 44.
    check('and it does not announce itself over the voice',
        /aria-live="off"/.test(code) && !/aria-live="(polite|assertive)"/.test(code),
        (code.match(/aria-live="[a-z]+"/g) || []));

    // A page with twenty of these must not parse twenty documents on every
    // render, and the button has to be able to say how long a section takes
    // before anybody presses it.
    check('the plan is a computed rather than built in the handler',
        /const plan = computed<ReadingPlan>/.test(code));
}

console.log('\n16. The stylesheet');
{
    const css = source('src/assets/css/read-aloud.css');
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // A globally loaded sheet may only own names nobody else can collide with,
    // and this one is namespaced whichever way it is ever loaded. That is the
    // check `.placeholder` earned by making every date on the exam calendar
    // unclickable on every page of the platform.
    const owned = new Set<string>();
    for (const m of rules.matchAll(/\.([a-z][a-z0-9_-]*)/g)) owned.add(m[1]!);
    const stray = [...owned].filter(c => !c.startsWith('sfs-read'));
    check('every class is sfs-read prefixed', stray.length === 0, stray);

    // WORKING RULE 12. A bare colour is right in Andromeda and wrong in the
    // other nine galaxies, and nobody sees it until a reader picks one.
    const hexes = rules.match(/#[0-9a-fA-F]{3,8}/g) || [];
    const fallbacks = (rules.match(/var\([^)]*\)/g) || []).join(' ');
    const bare = hexes.filter(h => !fallbacks.includes(h));
    check('every hex is only a var() fallback', bare.length === 0, bare);
    check('the control spends theme tokens', /var\(--sfs-/.test(rules));

    // An accent FILL takes `--sfs-on-accent`, never `--sfs-text` -- which flips
    // with the mode and is near-black in the three light galaxies. That exact
    // pairing was wrong on the login button and every outgoing chat bubble.
    const live = rules.slice(rules.indexOf('.sfs-read-btn--live'));
    check('the playing state pairs its fill with the fill-derived ink',
        /--sfs-on-accent/.test(live.slice(0, 260)), live.slice(0, 260));

    // A counter of bidi-neutral characters inside an Arabic bar is reordered,
    // so the reader is told they are on passage forty of three.
    check('the passage counter is pinned LTR',
        /\.sfs-read-bar__count\s*\{[^}]*direction:\s*ltr/.test(rules));
    check('and isolated, so it does not disturb its neighbours',
        /\.sfs-read-bar__count\s*\{[^}]*unicode-bidi:\s*isolate/.test(rules));
    // A transport is a PLACE: previous is left of next in every media player a
    // student has used, and mirroring it makes skip-back skip forward.
    check('the transport controls do not mirror',
        /\.sfs-read-bar__controls\s*\{[^}]*direction:\s*ltr/.test(rules));
    check('and neither does the speed picker',
        /\.sfs-read-bar__rate\s*\{[^}]*direction:\s*ltr/.test(rules));

    // A touch target must not scale with the fluid root font size: `2.75rem` is
    // ~41.5px on a 390px phone, under the minimum, on exactly the devices the
    // rule exists for.
    check('the touch minimum is a floor rather than a rem',
        /min-height:\s*max\(2\.75rem,\s*44px\)/.test(rules));

    // `responsive.css` forces `animation-duration: 0.01ms` under reduced
    // motion, which lands an element on its LAST keyframe -- so a track ending
    // anywhere else parks the spinner at an angle for exactly the people who
    // cannot see it move.
    check('the spinner keyframes end where they began',
        /from \{ transform: rotate\(0deg\); \}/.test(rules)
        && /to \{ transform: rotate\(360deg\); \}/.test(rules));

    // A runbook step's background and ink are an OPERATOR's choice, arriving as
    // inline styles: a control inside one cannot spend page-derived tokens or it
    // is near-white glass with light ink on a pale card.
    check('the island variant borrows its container ink',
        /\.sfs-read-btn--inherit\s*\{[^}]*color:\s*inherit/.test(rules));
    check('and its border rather than a token fill',
        /\.sfs-read-btn--inherit\s*\{[^}]*border-color:\s*currentColor/.test(rules));
}

console.log('\n17. Every page that reads gives its sections a stable, unique id');
{
    // The id is how the module-level reader knows which button is reading. Two
    // buttons sharing one would both render the playing state and both teleport
    // a transport bar; an id that changed between renders would leave the bar
    // attached to a button that no longer exists.
    const pages: Array<[string, number]> = [
        ['src/views/LessonDetails.vue', 2],
        ['src/views/RunbookDetails.vue', 2],
        ['src/components/labs/LabBrief.vue', 1],
        ['src/components/labs/LabTasks.vue', 1],
        ['src/components/netsim/LessonPanel.vue', 1],
        ['src/views/NetworkSimulatorLearn.vue', 1],
    ];
    const seen = new Map<string, string>();
    for (const [file, want] of pages) {
        const text = source(file);
        check(`${file} imports the control`,
            text.includes("import ReadAloud from '@/components/ReadAloud.vue'"));
        // The backticks have to come off before the prefix test: half of these
        // are template literals, and a scan that only matched a bare string
        // reported the two netsim pages as having no read-aloud control at all
        // -- a check that cannot see the thing it is checking (working rule 44).
        const ids = [...withoutComments(text).matchAll(/(?::id|\bid)="([^"]+)"/g)]
            .map(m => m[1]!.replace(/`/g, ''))
            .filter(id => /^(lesson-|runbook-|lab-|ns-)/.test(id));
        check(`${file} declares ${want} read-aloud section id(s)`,
            ids.length >= want, ids);
        for (const id of ids) {
            // A literal id used on two different pages is fine (only one page
            // renders at a time); the same literal twice on ONE page is not.
            const key = `${file} ${id}`;
            check(`${file}: ${id} is declared once`, !seen.has(key), key);
            seen.set(key, file);
        }
        // A dynamic id has to vary per row, so it must interpolate something.
        const dynamic = ids.filter(id => id.includes('${'));
        for (const id of dynamic) {
            check(`${file}: ${id} varies per section`, /\$\{[^}]+\}/.test(id), id);
        }
    }
}

console.log('\n18. The catalogues cover every string the control can render');
{
    // A key that is not in a catalogue renders in ENGLISH, which on this
    // control is the one place a reader may be unable to see the screen at all.
    const vue = source('src/components/ReadAloud.vue');
    const keys = new Set<string>();
    for (const m of vue.matchAll(/\$t\('((?:[^'\\]|\\.)+)'/g)) keys.add(m[1]!);
    // A LEADING CAPTURE GROUP rather than a negative lookbehind, even though
    // this file only ever runs in node: `\$?tc?\(` matches the tail of any
    // identifier ending in `t`, which is how `tools/i18n-wrap` once registered
    // the argument of `split('-')` as translatable text. The group is also what
    // separates a bare `t('x')` from `$t('x')` without reaching for a construct
    // this repo has banned for a reason (see section 13).
    for (const m of vue.matchAll(/(^|[^\w$])t\('((?:[^'\\]|\\.)+)'/gm)) keys.add(m[2]!);
    check('the control has strings to translate', keys.size >= 10, keys.size);

    for (const locale of ['ar', 'zh']) {
        const catalogue = source(`src/i18n/messages/${locale}/reader.ts`)
            + source(`src/i18n/messages/${locale}/common.ts`);
        const missing = [...keys].filter(k => !catalogue.includes(`'${k}'`));
        check(`${locale} covers every key the control renders`,
            missing.length === 0, missing);
    }

    // A key declared in two modules is a silent overwrite. `Previous`, `Next`
    // and `Stop` are already in `common`, so the reader module must not redeclare
    // them.
    for (const locale of ['ar', 'zh']) {
        const reader = source(`src/i18n/messages/${locale}/reader.ts`);
        const common = source(`src/i18n/messages/${locale}/common.ts`);
        const readerKeys = [...reader.matchAll(/^\s{4}'((?:[^'\\]|\\.)+)':/gm)].map(m => m[1]!);
        const clash = readerKeys.filter(k => new RegExp(`^\\s+'${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':`, 'm').test(common));
        check(`${locale}: the reader module declares no key common already has`,
            clash.length === 0, clash);
        // Comment-stripped: `includes('...reader,')` is satisfied by
        // `/* ...reader, */`, which is precisely how a spread gets disabled --
        // and an unregistered catalogue renders every string in English while
        // the file it lives in looks complete.
        check(`${locale}: the reader module is registered`,
            withoutComments(source(`src/i18n/messages/${locale}/index.ts`))
                .includes('...reader,'));
    }
}

console.log(failures === 0
    ? '\nAll checks passed.'
    : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
