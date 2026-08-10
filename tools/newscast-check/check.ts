// Verifies src/components/newscast/newscastEngine.ts without a browser.
//
//   npm run check:newscast
//
// Playback needs `speechSynthesis` and an `<audio>` element and is not checkable
// here. What *is* checkable is everything that decides what the listener hears,
// and all of it fails silently:
//
// * **The bed policy.** "Music under the headlines, stopped for the details" is
//   the entire brief for the audio, and it is one boolean per segment. Wrong,
//   and a bulletin either plays music over every word of a 300-word story or
//   never plays any at all — and both sound deliberate.
// * **The anchor rota.** Two presenters who swap mid-story is the most obviously
//   robotic thing a bulletin can do, and it is exactly what `index % 2` over
//   segments produces. Nothing about it throws.
// * **`speakable`.** Everything it misses is *heard*: a URL read out character
//   by character, "quot" in the middle of a sentence, a pipe read as "vertical
//   bar". You only find these by listening, one story at a time.
// * **Arabic sentence splitting.** An English-only `[.!?]` split returns one
//   enormous sentence for Arabic, so the detail cap stops capping and a feature
//   is read for nine minutes without a pause.
// * **Voice casting.** Both anchors landing on the same voice makes the handover
//   lines sound like a fault rather than a handover.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    BED_COUNT, OTHER_ANCHOR, PHRASES,
    bedIndexFor, bedVolumeFor, buildScript, canSpeak, castVoices, detailText,
    estimateDurationMs, genderOf, hasDetail, hasGenderedPair, isRtl, localeFor,
    pickVoice, sentences, speakable, storyOrder, utteranceLang, voicesFor,
    type AnchorId, type NewsItem, type Segment, type VoiceLike,
} from '../../src/components/newscast/newscastEngine';

// Read as TEXT as well as imported, so the check can assert things about the
// source that are invisible once it has been compiled — the lookbehind ban
// below being the one that matters, since bundling would have already
// succeeded on the machine running this.
const ENGINE_PATH = resolve('src/components/newscast/newscastEngine.ts');

let failures = 0;

function check(label: string, ok: boolean, detail: any = '') {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
    if (!ok) failures++;
}

function item(id: string, title: string, over: Partial<NewsItem> = {}): NewsItem {
    return {
        id,
        title,
        summary: `Summary for ${title}.`,
        body: `First sentence about ${title}. Second sentence. Third sentence. Fourth sentence. Fifth sentence.`,
        paragraphs: [`First sentence about ${title}. Second sentence.`, 'Third sentence. Fourth sentence. Fifth sentence.'],
        has_detail: true,
        ...over,
    };
}

const ENGLISH = [item('a', 'Typhoon hits east China'),
                 item('b', 'Talks resume in Geneva'),
                 item('c', 'Oil prices climb')];

console.log('\n1. The bed plays under headlines and stops for detail');
{
    const script = buildScript({ language: 'en', items: ENGLISH });

    check('every detail segment has the bed off',
          script.filter(s => s.kind === 'detail').every(s => s.bed === false),
          script.filter(s => s.kind === 'detail' && s.bed).map(s => s.text));

    check('every non-detail segment has the bed on',
          script.filter(s => s.kind !== 'detail').every(s => s.bed === true),
          script.filter(s => s.kind !== 'detail' && !s.bed).map(s => s.kind));

    check('a headline is always followed by its own detail',
          script.every((s, i) => s.kind !== 'detail' || script[i - 1]?.itemId === s.itemId),
          script.map(s => `${s.kind}:${s.itemId ?? '-'}`));

    check('bedVolumeFor is zero exactly when bed is off',
          script.every(s => (bedVolumeFor(s) === 0) === !s.bed));

    check('the bed is ducked under a headline, not full',
          script.filter(s => s.kind === 'headline').every(s => bedVolumeFor(s) > 0 && bedVolumeFor(s) < 0.2));

    check('the opening is louder than a headline',
          bedVolumeFor(script[0]) > bedVolumeFor(script.find(s => s.kind === 'headline')!));
}

console.log('\n2. Two anchors, alternating per story');
{
    const script = buildScript({ language: 'en', items: ENGLISH, firstAnchor: 'female' });

    for (const id of storyOrder(script)) {
        const forStory = script.filter(s => s.itemId === id && s.kind !== 'handover');
        const anchors = new Set(forStory.map(s => s.anchor));
        check(`story ${id} is read by exactly one anchor`, anchors.size === 1, [...anchors]);
    }

    const byStory = storyOrder(script).map(id =>
        script.find(s => s.itemId === id && s.kind === 'headline')!.anchor);
    check('consecutive stories go to different anchors',
          byStory.every((a, i) => i === 0 || a !== byStory[i - 1]), byStory);

    check('the requested anchor opens', script[0].anchor === 'female', script[0].anchor);

    const other = buildScript({ language: 'en', items: ENGLISH, firstAnchor: 'male' });
    check('opening with the other anchor mirrors the rota',
          other[0].anchor === 'male'
          && other.filter(s => s.kind === 'headline')[0].anchor === 'male');

    check('the handover is spoken by the anchor taking over',
          script.every((s, i) => s.kind !== 'handover'
              || script.slice(i + 1).find(n => n.kind === 'headline')?.anchor === s.anchor));

    check('the sign-off is not the anchor who read the last story',
          script[script.length - 1].anchor
          !== script.filter(s => s.kind === 'headline').pop()!.anchor);

    check('OTHER_ANCHOR is an involution',
          (['female', 'male'] as AnchorId[]).every(a => OTHER_ANCHOR[OTHER_ANCHOR[a]] === a));
}

console.log('\n3. A story with no detail is a headline and nothing else');
{
    // Al Jazeera's /videos/ and /gallery/ sections. The DAG sets has_detail.
    const video = item('v', 'Watch: floods in Bangkok',
                       { has_detail: false, body: '', paragraphs: [], summary: '' });
    const script = buildScript({ language: 'en', items: [ENGLISH[0], video] });

    check('hasDetail is false for a headline-only story', !hasDetail(video));
    check('no detail segment is emitted for it',
          !script.some(s => s.kind === 'detail' && s.itemId === 'v'),
          script.map(s => `${s.kind}:${s.itemId ?? '-'}`));
    check('its headline is still read',
          script.some(s => s.kind === 'headline' && s.itemId === 'v'));
    check('a story WITH detail still gets one',
          script.some(s => s.kind === 'detail' && s.itemId === 'a'));

    // has_detail absent (an older stored bulletin) must fall back to the text.
    const legacy = item('l', 'An older stored story', { has_detail: undefined });
    check('a bulletin without has_detail falls back to the body', hasDetail(legacy));
    const empty = { id: 'e', title: 'Nothing but a headline here' } as NewsItem;
    check('and a story with no text at all has no detail', !hasDetail(empty));
}

console.log('\n4. speakable() — everything it misses is heard aloud');
{
    // The point is that the *word* "quot" is never spoken and the sentence
    // survives intact. The quote characters themselves are then dropped
    // deliberately — some voices pronounce them, and none needs them.
    check('&quot; never reaches a voice as a word',
          !speakable('the &quot;yellow line&quot; area').includes('quot'),
          speakable('the &quot;yellow line&quot; area'));
    check('and the words around it survive',
          speakable('the &quot;yellow line&quot; area') === 'the yellow line area',
          speakable('the &quot;yellow line&quot; area'));
    check('strips a URL', !speakable('See https://example.com/a/b for more').includes('http'),
          speakable('See https://example.com/a/b for more'));
    check("Al Jazeera's breaking pipe becomes a pause",
          speakable('عاجل | زلزال بقوة 6.7') === 'عاجل, زلزال بقوة 6.7',
          speakable('عاجل | زلزال بقوة 6.7'));
    check('a two-dot ellipsis becomes a comma',
          speakable('النيران تتخطى الخط.. صور فضائية') === 'النيران تتخطى الخط, صور فضائية',
          speakable('النيران تتخطى الخط.. صور فضائية'));
    check('an em dash becomes a pause',
          speakable('Khamenei footage – commander') === 'Khamenei footage, commander',
          speakable('Khamenei footage – commander'));
    check('collapses whitespace', speakable('a\n\n  b   c') === 'a b c');
    check('leaves ordinary text alone',
          speakable('Oil prices climb 3% in Asia') === 'Oil prices climb 3% in Asia');
    check('an unknown entity does not survive',
          !speakable('a &mdash; b').includes('&'), speakable('a &mdash; b'));
    check('empty in, empty out', speakable('') === '');
}

console.log('\n5. Sentence splitting works in both scripts');
{
    const english = sentences('One. Two! Three? Four.');
    check('splits english on terminators', english.length === 4, english);

    // The failure this exists to catch: an English-only split returns ONE
    // sentence here, so the detail cap silently stops capping.
    const arabic = sentences('الجملة الأولى. الجملة الثانية؟ الجملة الثالثة. الرابعة.');
    check('splits arabic, including on ؟', arabic.length === 4, arabic);

    check('keeps the terminator with its sentence', english[0] === 'One.', english[0]);
    check('ignores empty fragments', sentences('One.   \n\n  Two.').length === 2);
    check('no text, no sentences', sentences('').length === 0);

    // A terminator with no whitespace after it is not a sentence break.
    check('a decimal is not split', sentences('Oil rose 3.5 percent today.').length === 1,
          sentences('Oil rose 3.5 percent today.'));
    check('an abbreviation is not split', sentences('The U.S. said no.').length === 1,
          sentences('The U.S. said no.'));
    check('a line break is a break', sentences('One\nTwo').length === 2);

    // Real scraped Arabic, which is where the cap actually has to work.
    const scraped = 'قال مسؤول في وزارة الحرب الأمريكية إن بلاده لا تنسحب من آسيا. '
                  + 'وأضاف أن الهدف هو توازن القوى. فهل ينجح ذلك؟ الوقت وحده يحكم.';
    check('real arabic prose splits into its sentences', sentences(scraped).length === 4,
          sentences(scraped));

    // A lookbehind is a PARSE-TIME error on Safari < 16.4, so it would not fail
    // at runtime — it would take the whole bundle down before a line executed.
    // The rule is documented in linkify.ts and this module has to honour it too.
    check('the engine source contains no lookbehind',
          !readFileSync(ENGINE_PATH, 'utf-8').includes('(?<='),
          'a (?<=...) group would break Safari < 16.4 at parse time');

    // Realistic prose, not 'A. B. C.' — a run of single letters is exactly what
    // `endsInAbbreviation` is supposed to treat as initials, so it made a poor
    // fixture for the cap.
    const feature = 'One sentence. Two sentence. Three sentence. Four sentence. Five sentence.';
    const long = item('x', 'Long feature', { paragraphs: [feature], body: feature });
    check('detailText caps at the sentence count',
          detailText(long, 3) === 'One sentence. Two sentence. Three sentence.',
          detailText(long, 3));
    check('and takes the whole thing when the cap is above the count',
          detailText(long, 99) === feature, detailText(long, 99));
    check('detailText falls back to the summary when there is no body',
          detailText({ id: 'y', title: 't', summary: 'Just a summary.' } as NewsItem, 3)
          === 'Just a summary.');
    check('detailText never returns undefined',
          detailText({ id: 'z', title: 't' } as NewsItem, 3) === '');
}

console.log('\n6. Both languages are first class');
{
    const arabic = buildScript({
        language: 'ar',
        items: [item('a', 'زلزال بقوة 6.7 يضرب كولومبيا')],
        meta: { label: 'أخبار', label_en: 'News' },
    });
    check('the arabic opening is in arabic', /نشرة/.test(arabic[0].text), arabic[0].text);
    check('the arabic opening names the arabic category',
          arabic[0].text.includes('أخبار'), arabic[0].text);
    check('the arabic sign-off is in arabic',
          /شكرا/.test(arabic[arabic.length - 1].text), arabic[arabic.length - 1].text);

    const english = buildScript({
        language: 'en', items: [item('a', 'A story')],
        meta: { label: 'أخبار', label_en: 'News' },
    });
    check('the english opening uses label_en, not the native label',
          english[0].text.includes('News') && !english[0].text.includes('أخبار'),
          english[0].text);

    check('arabic is rtl and english is not', isRtl('ar') && !isRtl('en'));
    check('each language has a distinct locale',
          localeFor('ar') !== localeFor('en'));
    check('no phrase list is empty',
          (['ar', 'en'] as const).every(l =>
              PHRASES[l].handover.length > 0 && PHRASES[l].close.length > 0));

    // A category with nothing in it has to SAY so. Silence reads as broken.
    const empty = buildScript({ language: 'ar', items: [] });
    check('an empty bulletin still speaks', empty.length === 1 && empty[0].text.length > 0);
    check('and does it in the right language', /لا توجد/.test(empty[0].text), empty[0].text);
    check('and plays no music over it', empty[0].bed === false);
}

console.log('\n7. Running order and limits');
{
    const many = Array.from({ length: 30 }, (_, i) => item(`i${i}`, `Story number ${i}`));
    const script = buildScript({ language: 'en', items: many, maxItems: 5 });
    check('maxItems caps the running order', storyOrder(script).length === 5,
          storyOrder(script).length);
    check('the order is the bulletin order',
          storyOrder(script).join(',') === 'i0,i1,i2,i3,i4', storyOrder(script));

    const headlinesOnly = buildScript({ language: 'en', items: ENGLISH, withDetail: false });
    check('withDetail:false gives a headlines-only bulletin',
          !headlinesOnly.some(s => s.kind === 'detail'));
    check('and therefore never stops the bed',
          headlinesOnly.every(s => s.bed === true));

    check('a story with a blank title is dropped',
          storyOrder(buildScript({
              language: 'en', items: [item('a', 'Real story'), item('b', '  ')],
          })).length === 1);

    check('the script opens and closes',
          script[0].kind === 'open' && script[script.length - 1].kind === 'close');
}

console.log('\n8. Bed rotation and duration estimates');
{
    const seen = new Set(Array.from({ length: 12 }, (_, i) => bedIndexFor(i)));
    check('bed rotation uses every bed', seen.size === BED_COUNT, [...seen]);
    check('bed indices are 1-based and in range',
          [...seen].every(n => n >= 1 && n <= BED_COUNT), [...seen]);
    check('rotation is deterministic', bedIndexFor(0) === bedIndexFor(BED_COUNT));
    check('a negative index does not escape the range', bedIndexFor(-3) >= 1);

    check('a longer line takes longer',
          estimateDurationMs('a'.repeat(200), 'en') > estimateDurationMs('a'.repeat(50), 'en'));
    check('arabic is estimated slower than english for the same length',
          estimateDurationMs('a'.repeat(100), 'ar') > estimateDurationMs('a'.repeat(100), 'en'));
    check('a faster rate is quicker',
          estimateDurationMs('a'.repeat(100), 'en', 2) < estimateDurationMs('a'.repeat(100), 'en', 1));
    check('empty text takes no time', estimateDurationMs('', 'en') === 0);
}

console.log('\n9. Casting two distinct voices');
{
    const voices: VoiceLike[] = [
        { name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true },
        { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true },
        { name: 'Microsoft Hoda - Arabic (Egypt)', lang: 'ar-EG', localService: true },
        { name: 'Microsoft Naayf - Arabic (Saudi)', lang: 'ar-SA', localService: true },
        { name: 'Google Deutsch', lang: 'de-DE' },
    ];

    const english = castVoices(voices, 'en');
    check('an english cast is english', english.female?.lang.startsWith('en')
          && english.male?.lang.startsWith('en'), english);
    check('the two english anchors are different voices',
          english.female?.name !== english.male?.name, english);
    check('Zira is cast as the woman', /Zira/.test(english.female?.name || ''), english.female);
    check('David is cast as the man', /David/.test(english.male?.name || ''), english.male);

    const arabic = castVoices(voices, 'ar');
    check('an arabic cast is arabic', arabic.female?.lang.startsWith('ar')
          && arabic.male?.lang.startsWith('ar'), arabic);
    check('the two arabic anchors are different voices',
          arabic.female?.name !== arabic.male?.name, arabic);

    // With one Arabic voice installed, both anchors share it rather than the
    // bulletin failing — the page says so in the caption.
    const single = castVoices([voices[2]], 'ar');
    check('one voice is used for both anchors rather than failing',
          single.female?.name === 'Microsoft Hoda - Arabic (Egypt)'
          && single.male?.name === 'Microsoft Hoda - Arabic (Egypt)', single);

    /*
      THE REGRESSION THIS SECTION EXISTS FOR.

      `pickVoice` used to fall back to "any voice at all" when the requested
      language had none, on the reasoning that some voice beats silence. It does
      not. An explicitly assigned `utterance.voice` OVERRIDES `utterance.lang`,
      so with no Arabic voice installed the page assigned an ENGLISH voice and
      handed it Arabic characters. That is not accented Arabic, it is
      unintelligible — and it was reported exactly that way: "it reads in
      English and reads mixed words, not Arabic".

      Returning null is what lets the component leave `voice` unset so the
      platform can match on `lang` alone, and what lets the page say an Arabic
      voice is missing instead of pretending to read the news.
    */
    const noArabic = castVoices([voices[0], voices[1]], 'ar');
    check('no arabic voice returns null rather than an english one',
          noArabic.female === null && noArabic.male === null, noArabic);
    check('and pickVoice agrees',
          pickVoice([voices[0], voices[1]], 'ar', 'female') === null);
    check('a german voice is never cast for arabic',
          pickVoice([voices[4]], 'ar', 'male') === null, pickVoice([voices[4]], 'ar', 'male'));
    check('nor for english',
          pickVoice([voices[4]], 'en', 'male') === null);

    // The invariant, stated once over the whole matrix: a cast voice always
    // speaks the language it was cast for.
    for (const language of ['ar', 'en'] as const) {
        const cast = castVoices(voices, language);
        for (const anchor of ['female', 'male'] as const) {
            const cast_voice = cast[anchor];
            check(`${language}/${anchor} is cast in the right language`,
                  cast_voice === null || cast_voice.lang.toLowerCase().startsWith(language),
                  cast_voice);
        }
    }

    /*
      TWO FEMALE VOICES IS NOT A PAIR.

      Reported after the language fix: "both voices in Arabic are female". The
      voices themselves were fine — measured, the Arabic females sit at ~216 Hz
      and the males at ~108 Hz, nearly an octave apart. What was wrong is that
      Edge exposes Salma AND Zariyah on many machines, both female, so the
      device had "plenty of Arabic voices" and still could not staff a
      two-anchor bulletin. `hasGenderedPair` is the question the page has to ask
      before using device voices at all.
    */
    const twoFemales: VoiceLike[] = [
        { name: 'Microsoft Salma Online (Natural) - Arabic (Egypt)', lang: 'ar-EG' },
        { name: 'Microsoft Zariyah Online (Natural) - Arabic (Saudi Arabia)', lang: 'ar-SA' },
    ];
    check('two female arabic voices are not a gendered pair',
          !hasGenderedPair(twoFemales, 'ar'));
    check('a real arabic pair is', hasGenderedPair([
        twoFemales[0],
        { name: 'Microsoft Shakir Online (Natural) - Arabic (Egypt)', lang: 'ar-EG' },
    ], 'ar'));
    check('no arabic voices at all is not a pair', !hasGenderedPair([], 'ar'));
    check('english voices do not make an arabic pair',
          !hasGenderedPair(voices.slice(0, 2), 'ar'));

    // The known-name table is what makes the above reliable.
    check('Zariyah is known female', genderOf(twoFemales[1]) === 'female');
    check('Shakir is known male',
          genderOf({ name: 'Microsoft Shakir Online (Natural) - Arabic (Egypt)', lang: 'ar-EG' })
          === 'male');
    check('Hamed is known male',
          genderOf({ name: 'Microsoft Hamed Online (Natural) - Arabic (Saudi Arabia)', lang: 'ar-SA' })
          === 'male');
    check('an unrecognised voice is honestly unknown',
          genderOf({ name: 'Google العربية', lang: 'ar-XA' }) === null);

    // Whole-word matching, not `includes`. A substring test puts `ali` inside
    // `Australia` and silently swaps an anchor's gender.
    check('a substring is not a match',
          genderOf({ name: 'English (Australia)', lang: 'en-AU' }) === null,
          genderOf({ name: 'English (Australia)', lang: 'en-AU' }));
    check('"female" in the name still works',
          genderOf({ name: 'Google UK English Female', lang: 'en-GB' }) === 'female');
    check('"male" in the name still works',
          genderOf({ name: 'Google UK English Male', lang: 'en-GB' }) === 'male');

    // And the cast honours it: given one of each, the anchors must not swap.
    const realPair = castVoices([
        { name: 'Microsoft Zariyah Online (Natural) - Arabic (Saudi Arabia)', lang: 'ar-SA' },
        { name: 'Microsoft Hamed Online (Natural) - Arabic (Saudi Arabia)', lang: 'ar-SA' },
    ], 'ar');
    check('the female anchor gets the female voice',
          /Zariyah/.test(realPair.female?.name || ''), realPair.female);
    check('the male anchor gets the male voice',
          /Hamed/.test(realPair.male?.name || ''), realPair.male);

    check('voicesFor filters to the language', voicesFor(voices, 'ar').length === 2,
          voicesFor(voices, 'ar').map(v => v.name));
    check('canSpeak is true when a voice exists', canSpeak(voices, 'ar'));
    check('canSpeak is false when none does', !canSpeak([voices[0]], 'ar'));

    check('no voices at all returns null, not a crash',
          pickVoice([], 'en', 'female') === null);
    check('castVoices with no voices returns nulls',
          castVoices([], 'en').female === null);

    // The utterance's `lang` follows the voice that was actually cast, so an
    // ar-EG voice is not asked to speak ar-SA. With no voice it falls back to
    // the nominal tag, which is the platform's only remaining hint.
    check('utteranceLang follows the cast voice',
          utteranceLang('ar', voices[2]) === 'ar-EG', utteranceLang('ar', voices[2]));
    check('utteranceLang falls back to the language locale',
          utteranceLang('ar', null) === localeFor('ar'), utteranceLang('ar', null));
    check('and never returns an english tag for arabic',
          !utteranceLang('ar', null).toLowerCase().startsWith('en'));
}

console.log('\n10. A whole bulletin end to end');
{
    const script = buildScript({
        language: 'ar',
        items: [
            item('a', 'عاجل | زلزال بقوة 6.7 يضرب كولومبيا'),
            item('b', 'المساعدات لا تصل إلى غزة'),
            { id: 'c', title: 'مشاهدة: فيضانات بانكوك', has_detail: false } as NewsItem,
        ],
        meta: { label: 'أخبار', label_en: 'News' },
        detailSentences: 2,
    });

    check('nothing spoken is empty', script.every(s => s.text.trim().length > 0),
          script.filter(s => !s.text.trim()).map(s => s.kind));
    check('no unresolved entity reaches a voice',
          script.every(s => !/&[a-z]+;/i.test(s.text)),
          script.filter(s => /&[a-z]+;/i.test(s.text)).map(s => s.text));
    check('no URL reaches a voice', script.every(s => !s.text.includes('http')));
    check('no pipe reaches a voice', script.every(s => !s.text.includes('|')),
          script.filter(s => s.text.includes('|')).map(s => s.text));
    check('the headline-only story has no detail',
          !script.some(s => s.kind === 'detail' && s.itemId === 'c'));
    check('every segment names a known anchor',
          script.every(s => s.anchor === 'female' || s.anchor === 'male'));
    check('every story segment carries its index',
          script.filter(s => s.itemId).every(s => typeof s.itemIndex === 'number'));

    const kinds = script.map(s => s.kind).join(' ');
    check('the shape is open, then stories, then close',
          kinds.startsWith('open headline detail') && kinds.endsWith('close'), kinds);
}

console.log(`\n${failures ? `FAILED: ${failures} check(s)` : 'All newscast engine checks passed.'}`);
process.exit(failures ? 1 : 0);
