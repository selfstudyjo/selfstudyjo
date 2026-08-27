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
    BED_COUNT, BED_REFERENCE_RMS, BED_RMS, OTHER_ANCHOR, PHRASES,
    anchorsUsed, bedIndexFor, bedTrimFor, bedVolumeFor, buildScript, canSpeak,
    castVoices, detailText, estimateDurationMs, genderOf, hasDetail, hasGenderedPair,
    isRtl, localeFor, pickVoice, sentences, speakable, storyOrder, utteranceLang, voicesFor,
    type AnchorId, type NewsItem, type Segment, type VoiceLike,
} from '../../src/components/newscast/newscastEngine';
import {
    IDENTITY_RATIO, MALE_F0_CEILING, MALE_LOUDNESS_MAKEUP, MALE_RATIO,
    PEAK_CEILING, TARGET_RMS,
    canShape, hann, levelGain, normalizeLevel, peakOf, shapeRatio, shapedPitch,
    timeScale, voicedRms,
} from '../../src/components/newscast/voiceShaper';
import {
    COMPRESSOR_RATIO, COMPRESSOR_THRESHOLD_DB, OUTPUT_CEILING, SHAPED_PRESENCE_HZ,
    compressionCurveDb, limitVoice, prepareVoice, tiltShapedVoice,
} from '../../src/utils/speechAudio';

// Read as TEXT as well as imported, so the check can assert things about the
// source that are invisible once it has been compiled — the lookbehind ban
// below being the one that matters, since bundling would have already
// succeeded on the machine running this.
const ENGINE_PATH = resolve('src/components/newscast/newscastEngine.ts');
const SHAPER_PATH = resolve('src/components/newscast/voiceShaper.ts');

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
    const long = item('x', 'Long feature', { paragraphs: [feature], body: feature, summary: '' });
    check('detailText caps the BODY at the sentence count',
          detailText(long, 3) === 'One sentence. Two sentence. Three sentence.',
          detailText(long, 3));
    check('and takes the whole thing when the cap is above the count',
          detailText(long, 99) === feature, detailText(long, 99));
    check('detailText falls back to the summary when there is no body',
          detailText({ id: 'y', title: 't', summary: 'Just a summary.' } as NewsItem, 3)
          === 'Just a summary.');
    check('detailText never returns undefined',
          detailText({ id: 'z', title: 't' } as NewsItem, 3) === '');

    /*
      THE SUMMARY IS READ, AND IT IS READ FIRST.

      Reported as the presenters skipping `story__summary` and jumping straight
      into the body, in both languages — and they did, always. `detailText`
      read `paragraphs` when there were any and only fell back to `summary`
      when there were none, and every story from both sources has paragraphs.
      Checked against a live bulletin, one Arabic story had a 178-character
      summary carrying the whole news and a single paragraph reading "on the
      55th day since the memorandum was signed:" — so the anchor read the date
      and moved on, while the page printed the summary in bold above it.
    */
    const withSummary = item('s', 'A story', {
        summary: 'The standfirst carries the story.',
        paragraphs: ['Body one. Body two. Body three. Body four.'],
        body: 'Body one. Body two. Body three. Body four.',
    });
    const spoken = detailText(withSummary, 3);
    check('the summary is spoken', spoken.includes('The standfirst carries the story.'), spoken);
    check('and it is spoken FIRST, before any body',
          spoken.indexOf('standfirst') < spoken.indexOf('Body one'), spoken);
    check('the body still follows it', spoken.includes('Body one.') && spoken.includes('Body three.'),
          spoken);
    check('and the cap applies to the body, not to the summary',
          !spoken.includes('Body four.'), spoken);

    // A summary repeated as the opening paragraph must not be said twice.
    const repeated = item('r', 'A story', {
        summary: 'The same opening line.',
        paragraphs: ['The same opening line.', 'Then something new.'],
        body: 'The same opening line. Then something new.',
    });
    const once = detailText(repeated, 3);
    check('a summary repeated as the first paragraph is not read twice',
          once.split('The same opening line').length - 1 === 1, once);
    check('and the rest of the body survives that', once.includes('Then something new.'), once);
    check('punctuation differences do not defeat the de-duplication',
          detailText(item('r2', 't', {
              summary: '"The same opening line".',
              paragraphs: ['The same opening line.', 'New material.'],
              body: '',
          }), 3).toLowerCase().split('the same opening line').length - 1 === 1);

    // App 36 truncates a synthesis request mid-word at 1200 characters, so the
    // spoken passage stops on a sentence boundary well before that.
    const verbose = item('v', 'A story', {
        summary: 'Short standfirst.',
        paragraphs: [Array.from({ length: 20 },
            (_, i) => `Sentence number ${i} padded out to a realistic newswire length here.`).join(' ')],
        body: '',
    });
    const bounded = detailText(verbose, 12);
    check('a long passage stops on a sentence boundary under the budget',
          bounded.length <= 1000 && /[.!?؟]$/.test(bounded.trim()),
          [bounded.length, bounded.slice(-40)]);
    check('and still leads with the summary',
          bounded.startsWith('Short standfirst.'), bounded.slice(0, 40));
    check('a summary alone is never truncated away',
          detailText(item('v2', 't', { summary: 'Only this.', paragraphs: [], body: '' }), 3)
          === 'Only this.');
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

    /*
      Every bed ends up at the same level, whichever track it is.

      The five were mastered up to 5 dB apart — bed1 at 0.398 against bed2 at
      0.226 — so one `volume` for all of them is music that gets louder and
      quieter as the bulletin moves between stories, for no reason a listener
      can attribute to anything. Under a quiet anchor bed1 sat 7 dB below the
      voice, which was part of "the voice is too low".
    */
    const beds = ['open', 'bed1', 'bed2', 'bed3', 'bed4'];
    const trimmed = beds.map(b => BED_RMS[b] * bedTrimFor(b));
    check('every bed is trimmed to the same level',
          Math.max(...trimmed) / Math.min(...trimmed) < 1.02,
          beds.map((b, i) => `${b}:${trimmed[i].toFixed(3)}`));
    check('the loudest bed is turned down, not the quietest turned up',
          bedTrimFor('bed1') < 1 && bedTrimFor('bed1') > 0.5, bedTrimFor('bed1'));
    check('every bed that ships has a measured level',
          beds.every(b => typeof BED_RMS[b] === 'number' && BED_RMS[b] > 0),
          'measure it, do not estimate it');
    check('an unknown bed is left alone rather than silenced',
          bedTrimFor('bed9') === 1);
    check('a trim can never push the element past full volume',
          beds.every(b => bedVolumeFor({ kind: 'open', anchor: 'female', text: '', bed: true })
                          * bedTrimFor(b) <= 1));
    // The ducked bed against a voice normalised to TARGET_RMS.
    const ducked = BED_REFERENCE_RMS * 0.12;
    const under = 20 * Math.log10(TARGET_RMS / ducked);
    check(`the bed sits ${under.toFixed(0)} dB under the anchor, where a newsroom puts it`,
          under >= 13 && under <= 22, under);

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

    /*
      A "male" voice that reads female is not half a pair either.

      Reported after the Arabic fix, and it turned out to be English: Microsoft
      labels `Guy` Male and it is — but it measures 160 Hz, inside the female
      range and 37 Hz from Aria, where every other male voice measured
      105-150 Hz. So the male anchor sounded female and the declared gender said
      nothing was wrong.
    */
    const guyOnly: VoiceLike[] = [
        { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' },
    ];
    check('Aria + Guy is not a usable pair', !hasGenderedPair(guyOnly, 'en'),
          'Guy measures 160Hz and does not read as male beside Aria');
    check('Aria + Christopher is', hasGenderedPair([
        guyOnly[0],
        { name: 'Microsoft Christopher Online (Natural) - English (United States)', lang: 'en-US' },
    ], 'en'));
    check('Guy is still known to be male', genderOf(guyOnly[1]) === 'male');
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

console.log('\n11. One presenter, when the engine can only field one voice');
{
    /*
      WHY THIS SECTION EXISTS.

      Reported as "in Arabic, when a man speaks, he speaks in a woman's voice",
      and none of the ten sections above could have caught it, because none of
      them is about the *provider*. Section 9 proves the device path never casts
      a mismatched pair. The backend proves its own neural pair is measured and
      separated. What sat between them: with `edge-tts` missing from the
      replica, app 36 fell through to a provider that has exactly one voice per
      language — female — and rendered both anchors with it. Every check passed.

      The engine's answer is `soloAnchor`. Sharing one voice between two named
      presenters is the bug; reading the bulletin with one presenter is a
      bulletin. These assertions are the difference.
    */
    const solo = buildScript({ language: 'ar', items: ENGLISH, soloAnchor: 'female' });

    check('a solo bulletin casts exactly one presenter',
          anchorsUsed(solo).length === 1, anchorsUsed(solo));
    check('and it is the one asked for',
          solo.every(s => s.anchor === 'female'),
          [...new Set(solo.filter(s => s.anchor !== 'female').map(s => s.kind))]);
    check('the sign-off is the same presenter, not the "other" one',
          solo[solo.length - 1].anchor === 'female', solo[solo.length - 1].anchor);
    check('the male presenter is never cast anywhere in it',
          !solo.some(s => s.anchor === 'male'));

    const soloMale = buildScript({ language: 'ar', items: ENGLISH, soloAnchor: 'male' });
    check('a solo bulletin works for either presenter',
          anchorsUsed(soloMale).length === 1 && soloMale[0].anchor === 'male',
          anchorsUsed(soloMale));

    // `soloAnchor` OVERRIDES `firstAnchor`. Honouring both would open with one
    // voice and read with another — the two-voice bug wearing a hat.
    const conflicting = buildScript({
        language: 'en', items: ENGLISH, firstAnchor: 'female', soloAnchor: 'male',
    });
    check('soloAnchor wins over a conflicting firstAnchor',
          anchorsUsed(conflicting).length === 1 && conflicting[0].anchor === 'male',
          anchorsUsed(conflicting));

    // Everything else about the bulletin has to survive it. A solo bulletin is
    // a normal bulletin, not a degraded mode with its own rules.
    check('the bed policy is unchanged',
          solo.every(s => (s.kind === 'detail') === (s.bed === false)));
    check('every story is still read',
          storyOrder(solo).length === storyOrder(
              buildScript({ language: 'ar', items: ENGLISH })).length);
    check('handover lines still link the stories',
          solo.filter(s => s.kind === 'handover').length === ENGLISH.length - 1,
          solo.filter(s => s.kind === 'handover').length);
    check('a headline is still followed by its own detail',
          solo.every((s, i) => s.kind !== 'detail' || solo[i - 1]?.itemId === s.itemId));
    check('nothing spoken is empty', solo.every(s => s.text.trim().length > 0));
    check('the shape is still open, stories, close',
          solo[0].kind === 'open' && solo[solo.length - 1].kind === 'close');

    // And the default is unaffected: two presenters, alternating, as before.
    const paired = buildScript({ language: 'en', items: ENGLISH });
    check('without soloAnchor there are still two presenters',
          anchorsUsed(paired).length === 2, anchorsUsed(paired));
    check('soloAnchor: null is the same as omitting it',
          JSON.stringify(buildScript({ language: 'en', items: ENGLISH, soloAnchor: null }))
          === JSON.stringify(paired));

    // An empty category speaks either way — it is the one script with a single
    // segment, so it must not be mistaken for a solo bulletin by anything.
    const emptySolo = buildScript({ language: 'ar', items: [], soloAnchor: 'female' });
    check('an empty solo bulletin still says so',
          emptySolo.length === 1 && emptySolo[0].anchor === 'female'
          && emptySolo[0].text.length > 0, emptySolo);
}

console.log('\n12. Reshaping a voice, so the male anchor is never removed');
{
    /*
      The second answer to "in Arabic the man speaks in a woman's voice", and
      the one that keeps him on air.

      Section 11 removes him, which is honest and is not what a newsroom does.
      `voiceShaper.ts` instead time-compresses the fallback audio and lets the
      caller play it back slower, which drops pitch AND formants together — the
      cue that reads as a different, larger speaker.

      Every property below is inaudible-until-shipped, which is the whole
      argument for it being a plain module:

      * a time-scaler that changes PITCH is not a time-scaler, it is a chipmunk,
        and the bug would present as "the man sounds like a cartoon";
      * a wrong output length desynchronises the shift, so the male anchor would
        read at the wrong speed for the whole bulletin;
      * a missing window normalisation fades every line in and out;
      * and a ratio that lands the pitch outside the male range reproduces the
        original report exactly, having done a lot of arithmetic on the way.
    */
    const RATE = 24000;      // what the fallback provider actually returns

    function tone(hz: number, seconds: number, rate = RATE): Float32Array {
        const out = new Float32Array(Math.round(rate * seconds));
        for (let i = 0; i < out.length; i++) {
            out[i] = Math.sin((2 * Math.PI * hz * i) / rate) * 0.7;
        }
        return out;
    }

    /** Fundamental by zero-crossing rate — crude, and enough to catch a shift. */
    function measureHz(signal: Float32Array, rate = RATE): number {
        let crossings = 0;
        // Skip the first and last frame: they are the partially-windowed ends.
        const from = Math.min(2000, Math.floor(signal.length / 4));
        const to = signal.length - from;
        for (let i = from + 1; i < to; i++) {
            if (signal[i - 1] <= 0 && signal[i] > 0) crossings++;
        }
        return (crossings * rate) / Math.max(1, to - from);
    }

    function rms(signal: Float32Array): number {
        let total = 0;
        for (let i = 0; i < signal.length; i++) total += signal[i] * signal[i];
        return Math.sqrt(total / Math.max(1, signal.length));
    }

    // ---- the ratio -----------------------------------------------------
    check('a voice already in the right register is left completely alone',
          shapeRatio('male', 'male') === IDENTITY_RATIO
          && shapeRatio('female', 'female') === IDENTITY_RATIO);
    check('an unknown rendered gender is not guessed at',
          shapeRatio('', 'male') === IDENTITY_RATIO,
          'reshaping on a guess is how a correct voice gets mangled');
    check('a female voice asked to read the male anchor is lowered',
          shapeRatio('female', 'male') === MALE_RATIO && MALE_RATIO < 1, MALE_RATIO);

    /*
      The direction that does NOT exist, and the trap in it.

      No provider here is male-only, so there is no measured up-shift and
      inventing one would mean a 1.65x rise that sounds like a cartoon. It
      answers 1 — which the CALLER must read as "cannot shape this", never as
      "nothing needs shaping". Newscast.vue therefore branches on the gender
      mismatch and treats a ratio of 1 there as a reason to fall back to one
      presenter. Getting that backwards plays a man as the female anchor: the
      original bug, arriving through the door built to stop it.
    */
    check('the direction with no honest ratio refuses rather than inventing one',
          shapeRatio('male', 'female') === IDENTITY_RATIO,
          'must be read as "cannot shape", not as "no shaping needed"');

    // THE ASSERTION THIS FILE EXISTS FOR. app 36 calls a voice male below
    // 155 Hz, learned from en-US-GuyNeural at 160 Hz being reported as female.
    // A shaped voice has to clear the same bar the neural ones do.
    const shaped = shapedPitch(MALE_RATIO);
    check(`a reshaped voice lands in the male range (${shaped.toFixed(0)}Hz)`,
          shaped <= MALE_F0_CEILING, `${shaped} must be <= ${MALE_F0_CEILING}`);
    check('and is not dropped so far it stops sounding like a person',
          shaped >= 100, `${shaped}Hz — below ~100 the formants read as a giant`);

    // ---- the time scaler ------------------------------------------------
    const voice = tone(216, 0.6);                    // the fallback's pitch

    check('a ratio of exactly 1 is a byte-for-byte no-op',
          timeScale(voice, 1, RATE).length === voice.length
          && timeScale(voice, 1, RATE).every((v, i) => v === voice[i]));

    const compressed = timeScale(voice, MALE_RATIO, RATE);
    check('the output is shorter by the ratio',
          Math.abs(compressed.length - voice.length * MALE_RATIO) <= 2,
          [compressed.length, voice.length * MALE_RATIO]);

    // The one that matters: time-scaling must NOT move the pitch. The shift
    // comes later, from playbackRate; if it happened here too it would be
    // applied twice and the anchor would sound like a foghorn.
    const before = measureHz(voice);
    const after = measureHz(compressed);
    check(`time-scaling leaves the pitch alone (${before.toFixed(0)} -> ${after.toFixed(0)}Hz)`,
          Math.abs(after - before) / before < 0.06, [before, after]);

    // ...and the two halves together land where the ratio promised. Playing
    // the compressed buffer at `playbackRate = ratio` is what the component
    // does; here that is the same as reading it at a lower sample rate.
    const played = measureHz(compressed, RATE * MALE_RATIO);
    check(`played back at the ratio it becomes a male pitch (${played.toFixed(0)}Hz)`,
          played <= MALE_F0_CEILING, played);

    // Duration is restored by the same move: shorter buffer, slower playback.
    const finalSeconds = compressed.length / (RATE * MALE_RATIO);
    check('and the line still takes exactly as long to read',
          Math.abs(finalSeconds - voice.length / RATE) < 0.01,
          [finalSeconds, voice.length / RATE]);

    // No fade at the ends: a missing window normalisation is inaudible on a
    // test tone's average and very audible on every spoken line.
    check('the level is held across the whole line',
          Math.abs(rms(compressed) - rms(voice)) / rms(voice) < 0.25,
          [rms(voice), rms(compressed)]);
    const head = compressed.subarray(0, Math.floor(compressed.length * 0.06));
    check('including at the very start, which is where a fade would show',
          rms(head) > rms(compressed) * 0.5, [rms(head), rms(compressed)]);

    // ---- it must not fall over on the odd input -------------------------
    check('silence stays silent rather than becoming noise',
          timeScale(new Float32Array(4096), MALE_RATIO, RATE).every(v => v === 0));
    check('empty in, empty out', timeScale(new Float32Array(0), MALE_RATIO, RATE).length === 0);
    check('a clip shorter than one frame does not crash',
          timeScale(tone(216, 0.004), MALE_RATIO, RATE) instanceof Float32Array);
    check('a nonsense ratio returns the audio untouched',
          timeScale(voice, 0, RATE).length === voice.length
          && timeScale(voice, NaN, RATE).length === voice.length);
    check('output is finite everywhere — a NaN silences the rest of the line',
          compressed.every(v => Number.isFinite(v)));
    check('and never clips',
          compressed.every(v => v >= -1.001 && v <= 1.001),
          Math.max(...Array.from(compressed).map(Math.abs)));

    // Stretching as well as compressing, since `shapeRatio` is the only thing
    // stopping a future caller passing > 1.
    const stretched = timeScale(voice, 1.4, RATE);
    check('it stretches as well as it compresses',
          Math.abs(stretched.length - voice.length * 1.4) <= 2, stretched.length);
    check('and still without moving the pitch',
          Math.abs(measureHz(stretched) - before) / before < 0.06, measureHz(stretched));

    // ---- the window -----------------------------------------------------
    check('the hann window starts and ends at zero',
          hann(64)[0] === 0 && Math.abs(hann(64)[63]) < 1e-12);
    check('and peaks in the middle', Math.abs(hann(65)[32] - 1) < 1e-9);
    check('a degenerate window does not divide by zero',
          hann(1)[0] === 1 && hann(0).length === 0);

    // ---- level ----------------------------------------------------------
    /*
      Reported as "the Arabic male voice is too low, and the female a little
      low too". The shaping was not the cause — measured, it returns the level
      it was given to within 0.0 dB. The PROVIDER is: Google's TTS comes back
      at a peak of 0.41 and a voiced RMS of 0.10, eight decibels of headroom
      left on the table, and an `<audio>` element can only turn that down.
      Against a music bed ducked to 0.12 it was a duet rather than a bed.
    */
    const quiet = tone(200, 0.5);
    for (let i = 0; i < quiet.length; i++) quiet[i] *= 0.24;      // ~ the provider's level
    check('the provider level is genuinely low, which is the premise',
          voicedRms(quiet) < TARGET_RMS * 0.6, voicedRms(quiet));

    const lifted = normalizeLevel(Float32Array.from(quiet));
    check('a quiet clip is brought up to the target',
          Math.abs(voicedRms(lifted) - TARGET_RMS) / TARGET_RMS < 0.06,
          voicedRms(lifted));
    check('and never past the ceiling', peakOf(lifted) <= PEAK_CEILING + 1e-6, peakOf(lifted));

    /*
      Loudness first, peak as a backstop — and which of the two wins matters.

      Peak normalisation ALONE is the wrong tool: speech has a high crest
      factor, so two clips normalised to the same peak sit at audibly different
      volumes and one loud consonant decides the answer for the whole line.
      Real provider audio measures peak 0.41 against a voiced RMS of 0.10, a
      crest of about four, and at those numbers the loudness term is the one
      that binds — which is what makes the boost consistent from line to line.
    */
    const speech = Float32Array.from(quiet);
    // Consonant peaks sized to the crest factor real provider audio measures —
    // peak 0.41 over a voiced RMS of 0.10, so about four to one.
    for (let i = 200; i < 260; i++) speech[i] = 0.48 * Math.sign(speech[i] || 1);
    check('at a realistic crest factor the LOUDNESS term binds, not the peak',
          TARGET_RMS / voicedRms(speech) < PEAK_CEILING / peakOf(speech),
          [TARGET_RMS / voicedRms(speech), PEAK_CEILING / peakOf(speech)]);
    check('so a real line is lifted to the target',
          Math.abs(voicedRms(normalizeLevel(Float32Array.from(speech))) - TARGET_RMS)
              / TARGET_RMS < 0.06);

    // And the backstop genuinely is a backstop: one sample near full scale
    // holds the gain down rather than clipping the line. Conservative on
    // purpose — a quiet line is a complaint, a clipped one is a defect.
    const spiky = Float32Array.from(quiet);
    spiky[100] = 0.95;
    check('a near-full-scale peak caps the gain instead of clipping',
          levelGain(spiky) < 1.1 && peakOf(normalizeLevel(Float32Array.from(spiky)))
              <= PEAK_CEILING + 1e-6,
          levelGain(spiky));

    // Silence between sentences must not count, or a clip with a long pause
    // measures quiet and gets boosted until the words clip.
    const withPause = new Float32Array(quiet.length * 2);
    withPause.set(quiet, 0);
    check('silence is not counted as part of the level',
          Math.abs(voicedRms(withPause) - voicedRms(quiet)) / voicedRms(quiet) < 0.05,
          [voicedRms(quiet), voicedRms(withPause)]);

    check('the male anchor is aimed louder, to land at the same PERCEIVED level',
          MALE_LOUDNESS_MAKEUP > 1 && MALE_LOUDNESS_MAKEUP <= 1.35, MALE_LOUDNESS_MAKEUP);
    const male = normalizeLevel(Float32Array.from(quiet), TARGET_RMS * MALE_LOUDNESS_MAKEUP);
    check('and still cannot clip', peakOf(male) <= PEAK_CEILING + 1e-6, peakOf(male));
    check('a reshaped line ends up above a plain one',
          voicedRms(male) > voicedRms(lifted), [voicedRms(lifted), voicedRms(male)]);

    check('an already-loud clip is left alone rather than pushed further',
          levelGain(normalizeLevel(Float32Array.from(quiet))) < 1.05);
    check('silence does not divide by zero',
          levelGain(new Float32Array(512)) === 1
          && normalizeLevel(new Float32Array(512)).every(v => v === 0));

    // The shaper must not change the level it was handed — measured at -0.0 dB
    // on real provider audio, and asserted here so it stays that way.
    const rmsIn = voicedRms(voice);
    const rmsOut = voicedRms(timeScale(voice, MALE_RATIO, RATE));
    check('time-scaling is level-neutral',
          Math.abs(rmsOut - rmsIn) / rmsIn < 0.08, [rmsIn, rmsOut]);

    // ---- capability detection -------------------------------------------
    check('canShape is false without Web Audio', !canShape({}));
    check('canShape is true with it', canShape({ AudioContext: function () {} }));
    check('and accepts the prefixed name Safari used to ship',
          canShape({ webkitAudioContext: function () {} }));


    /* ------------------------------------------------------------------ *
     * The sample-domain level chain
     *
     * WHY THESE ARE HERE AND NOT IN `check:actors`
     *
     * Because they are arithmetic over a Float32Array and this is the file that
     * already has a signal generator, an autocorrelation pitch meter and an RMS
     * in it. `check:actors` owns the CONSTANTS (that the threshold is sane, that
     * the makeup fits the headroom); this owns what the functions do to audio.
     *
     * All of it exists because of one report — "the Arabic Male Voice is not
     * clear, it has a lot of noise, and the volume level is too low" — which was
     * three separate faults with three separate fixes, and every one of them is
     * silent:
     *
     *  1. the correlation in `timeScale` was unnormalised, so the WSOLA search
     *     found the loudest offset rather than the matching one;
     *  2. the graph clipped, because a `DynamicsCompressorNode` has an attack
     *     and no look-ahead and the makeup gain was 3.4x on a 0.97 peak;
     *  3. `MALE_LOUDNESS_MAKEUP` was spent where the peak ceiling cancelled it,
     *     so the reshaped voice was not actually louder at all.
     * ------------------------------------------------------------------ */
    {
        /** Speech-like: harmonics, a syllable envelope, and consonant bursts. */
        const speechLike = (seconds: number, level = 0.41): Float32Array => {
            const n = Math.round(RATE * seconds);
            const out = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                const t = i / RATE;
                let v = 0;
                for (let h = 1; h <= 14; h++) {
                    v += (1 / h) * Math.sin(2 * Math.PI * 192 * h * t + h * 0.3);
                }
                const env = 0.12 + 0.88
                    * Math.pow(Math.max(0, Math.sin(2 * Math.PI * 4 * t)), 1.6);
                out[i] = v * env;
            }
            // Bursts AFTER a near-silence, which is the case a compressor's
            // attack cannot catch and the one that was clipping.
            for (const at of [0.30, 0.61, 0.92]) {
                const start = Math.round(at * RATE);
                for (let i = 0; i < 300 && start + i < n; i++) {
                    out[start + i] = (out[start + i] as number)
                        + 2.2 * (1 - i / 300) * Math.sin(i * 1.9);
                }
            }
            const p = peakOf(out) || 1;
            for (let i = 0; i < n; i++) out[i] = ((out[i] as number) / p) * level;
            return out;
        };

        // ---- the guarantee -------------------------------------------------
        for (const ratio of [IDENTITY_RATIO, MALE_RATIO]) {
            const raw = speechLike(1.0);
            const before = voicedRms(raw);
            const shaped = ratio === IDENTITY_RATIO
                ? Float32Array.from(raw)
                : timeScale(raw, ratio, RATE);
            prepareVoice(shaped, RATE, ratio);
            const label = ratio === IDENTITY_RATIO ? 'plain' : 'reshaped';

            check(`${label}: NO sample leaves above the ceiling`,
                  peakOf(shaped) <= OUTPUT_CEILING + 1e-6, peakOf(shaped));
            check(`${label}: and every sample is finite`,
                  shaped.every(v => Number.isFinite(v)));
            const gainDb = 20 * Math.log10(voicedRms(shaped) / before);
            check(`${label}: the average is lifted by 6 dB or more (${gainDb.toFixed(1)} dB)`,
                  gainDb > 6, gainDb);
            /*
              A crest factor that survives. Squashing a voice to a crest of 2 is
              what "over-compressed" sounds like, and it is what a detector fast
              enough to catch every peak produces — which is why the compressor's
              attack is 6 ms and a separate limiter does the peak work.
            */
            const crest = peakOf(shaped) / voicedRms(shaped);
            check(`${label}: and the waveform is not squashed flat (crest ${crest.toFixed(2)})`,
                  crest > 3, crest);
        }

        /*
          THE OLD CHAIN COULD NOT HAVE PASSED THE FIRST OF THOSE.

          Stated as arithmetic rather than as prose, because it is the whole
          reason the compression moved out of the graph: a compressor with a 4 ms
          attack passes the front of a transient at unity, so the peak reaching
          the destination was the sample peak times the full makeup.
        */
        check('the graph chain it replaced would have clipped by 10 dB or more',
              20 * Math.log10(0.97 * 3.4) > 10,
              20 * Math.log10(0.97 * 3.4));

        // ---- the limiter ---------------------------------------------------
        const quiet = new Float32Array(4096);
        for (let i = 0; i < quiet.length; i++) {
            quiet[i] = 0.2 * Math.sin((2 * Math.PI * 200 * i) / RATE);
        }
        const untouched = Float32Array.from(quiet);
        limitVoice(untouched, RATE);
        check('the limiter does nothing at all to audio that is already under it',
              untouched.every((v, i) => Math.abs(v - (quiet[i] as number)) < 1e-9));

        const hot = Float32Array.from(quiet);
        for (let i = 0; i < hot.length; i++) hot[i] = (hot[i] as number) * 6;
        limitVoice(hot, RATE);
        check('...and holds the line on audio that is way over it',
              peakOf(hot) <= OUTPUT_CEILING + 1e-6, peakOf(hot));
        /*
          The gain must not JUMP. A limiter that snaps its gain back is itself a
          discontinuity, which is the artefact that makes a cheap one sound like
          it is chewing — so consecutive samples of a steady tone may not differ
          by more than the tone itself does.
        */
        let worst = 0;
        for (let i = 1; i < hot.length; i++) {
            worst = Math.max(worst, Math.abs((hot[i] as number) - (hot[i - 1] as number)));
        }
        check('and its gain moves smoothly rather than snapping', worst < 0.35, worst);

        check('a limiter with a nonsense ceiling leaves the audio alone',
              limitVoice(Float32Array.from(quiet), RATE, 0)
                  .every((v, i) => v === (quiet[i] as number)));
        check('and an empty buffer does not crash it',
              limitVoice(new Float32Array(0), RATE).length === 0);

        // ---- the compressor ------------------------------------------------
        const curveAt = (x: number) => compressionCurveDb(x);
        check('the compression curve is a straight line below the knee',
              Math.abs(curveAt(-40) - (-40)) < 1e-9);
        check('...and reduces by the ratio above it',
              Math.abs(curveAt(0) - (COMPRESSOR_THRESHOLD_DB
                  + -COMPRESSOR_THRESHOLD_DB / COMPRESSOR_RATIO)) < 1e-9,
              curveAt(0));
        check('...and is monotonic through the knee, so it cannot fold back',
              (() => {
                  for (let x = -60; x < 0; x += 0.25) {
                      if (curveAt(x + 0.25) < curveAt(x) - 1e-9) return false;
                  }
                  return true;
              })());
        check('the curve never makes anything LOUDER', (() => {
            for (let x = -60; x <= 6; x += 0.5) if (curveAt(x) > x + 1e-9) return false;
            return true;
        })());

        // ---- the tilt ------------------------------------------------------
        const flat = speechLike(0.3);
        const same = Float32Array.from(flat);
        tiltShapedVoice(same, RATE, IDENTITY_RATIO);
        check('the tilt is a byte-for-byte no-op on a voice that was not reshaped',
              same.every((v, i) => v === (flat[i] as number)));

        /*
          A DOWN-SHIFTED VOICE GETS ITS PRESENCE BACK, and the frequency is
          divided by the ratio because these samples are about to be played at
          `playbackRate = ratio`. Measured as the ratio of high-band to low-band
          energy before and after: the shelf has to lift the top, and the low cut
          has to remove the bottom.
        */
        const band = (signal: Float32Array, from: number, to: number): number => {
            let total = 0;
            for (let hz = from; hz <= to; hz += (to - from) / 12) {
                let re = 0;
                let im = 0;
                for (let i = 0; i < signal.length; i++) {
                    const a = (2 * Math.PI * hz * i) / RATE;
                    re += (signal[i] as number) * Math.cos(a);
                    im += (signal[i] as number) * Math.sin(a);
                }
                total += re * re + im * im;
            }
            return total;
        };
        const tilted = Float32Array.from(flat);
        tiltShapedVoice(tilted, RATE, MALE_RATIO);
        const before = band(flat, 3600, 6000) / (band(flat, 150, 400) + 1e-12);
        const after = band(tilted, 3600, 6000) / (band(tilted, 150, 400) + 1e-12);
        check(`the tilt lifts the presence band relative to the bass (x${(after / before).toFixed(2)})`,
              after > before * 1.3, [before, after]);
        check('and it stays finite',
              tilted.every(v => Number.isFinite(v)));
        check('the presence shelf is placed for the SHIFTED spectrum, not the raw one',
              SHAPED_PRESENCE_HZ / MALE_RATIO > SHAPED_PRESENCE_HZ);

        // ---- WSOLA, after the normalisation fix ----------------------------
        /*
          THE CORRELATION HAS TO BE NORMALISED.

          A source assertion, because the failure is not a wrong answer — it is a
          slightly wrong answer per frame, which sums to a buzz at the hop rate
          (~89 Hz, in the middle of the voice band). There is no output test that
          separates "the search picked the second-best offset" from "the provider
          sent slightly rough audio"; what there is, is the absence of the
          division.
        */
        const shaperSrc = readFileSync(SHAPER_PATH, 'utf-8');
        check('the WSOLA search divides by the candidate\'s own energy',
              /dot\s*\/\s*Math\.sqrt\(energyAt\(/.test(shaperSrc),
              'an unnormalised dot product finds the LOUDEST offset, not the matching one');
        check('...and the energy comes from a prefix sum rather than a second loop',
              /Float64Array\(input\.length \+ 1\)/.test(shaperSrc));

        /*
          AND THE TAIL IS NOT SILENCE.

          The frame loop stops as soon as the next frame would run off the end of
          the input, which leaves `scale * frame` of output — about 31 ms — at
          zero weight. It divided to silence, so the last syllable of every line
          was clipped and faded out.
        */
        const line = speechLike(0.8, 0.6);
        const scaled = timeScale(line, MALE_RATIO, RATE);
        const tailLen = Math.round(RATE * 0.025);
        const tail = scaled.subarray(scaled.length - tailLen);
        const body = scaled.subarray(0, scaled.length - tailLen);
        check('the last 25 ms of a line is not faded to silence',
              voicedRms(tail) > voicedRms(body) * 0.25,
              [voicedRms(tail), voicedRms(body)]);
    }

    // Same Safari rule as the engine: a lookbehind is a PARSE-TIME error
    // before 16.4 and would take the whole bundle down, not just this module.
    check('the shaper source contains no lookbehind',
          !readFileSync(SHAPER_PATH, 'utf-8').includes('(?<='));
}

console.log(`\n${failures ? `FAILED: ${failures} check(s)` : 'All newscast engine checks passed.'}`);
process.exit(failures ? 1 : 0);
