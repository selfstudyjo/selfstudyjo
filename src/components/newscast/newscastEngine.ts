/**
 * The newscast, as data: a running order, an anchor rota, and the bed policy.
 *
 * A plain module — no Vue, no DOM, no `speechSynthesis` — for the same reason
 * as `photoMask.ts`, `drawEngine.ts`, `chatMedia.ts` and `appNav.ts`: the parts
 * that go quietly wrong here are decidable without a browser, and
 * `npm run check:newscast` asserts them in about a second. What is left in the
 * component is playback, which you have to watch and listen to anyway.
 *
 * WHAT THE ENGINE DECIDES
 *
 * A bulletin from app 36 is a list of articles. A newscast is a *sequence of
 * spoken segments* with two presenters and a music bed, and turning one into
 * the other is where all the judgement lives:
 *
 *  1. **The bed plays under headlines and stops for detail.** This is the whole
 *     brief for the audio and it is a property of the segment, not of a timer
 *     the component runs: `bed` is on `open`, `headline`, `handover` and
 *     `close`, and off on `detail`. Deriving it in the component instead is how
 *     it ends up nearly right — music fading back in for the last two seconds
 *     of a story because a `setTimeout` outlived the utterance it belonged to.
 *
 *  2. **Anchors alternate per STORY, not per segment.** One presenter reads a
 *     headline and then its detail; the next story goes to the other. Swapping
 *     mid-story is the single most obviously robotic thing a two-anchor bulletin
 *     can do, and it is what you get from the naive `index % 2` on segments.
 *
 *  3. **A story with no detail is a headline and nothing else.** Al Jazeera's
 *     video and gallery sections carry no body text at all, so `has_detail`
 *     comes from the DAG and an anchor that pauses for a body that is not there
 *     reads as a fault. See `is_usable` in `dags/selfstudy_news.py`.
 *
 *  4. **Both languages are first class.** Every line an anchor says comes from
 *     PHRASES, never from a template literal at a call site, so Arabic is not a
 *     translation bolted onto English word order. Arabic is also RTL, which the
 *     ticker has to know about because a marquee that scrolls the wrong way is
 *     unreadable rather than merely untidy.
 */

export type LanguageCode = 'ar' | 'en';
export type AnchorId = 'female' | 'male';
export type SegmentKind = 'open' | 'headline' | 'detail' | 'handover' | 'close';

/** One article, as app 36 serves it. */
export interface NewsItem {
    id: string;
    title: string;
    summary?: string;
    body?: string;
    paragraphs?: string[];
    url?: string;
    image?: string;
    published_at?: string;
    fresh?: boolean;
    has_detail?: boolean;
    word_count?: number;
    source_label?: string;
    category_label?: string;
}

export interface BulletinMeta {
    label?: string;
    label_en?: string;
    source_label?: string;
    language?: string;
    generated_at?: string;
}

/** One thing an anchor says. */
export interface Segment {
    kind: SegmentKind;
    anchor: AnchorId;
    text: string;
    /** Should the music bed be audible while this is spoken? */
    bed: boolean;
    /** Which story this belongs to — absent on `open` and `close`. */
    itemId?: string;
    itemIndex?: number;
}

export interface ScriptOptions {
    language: LanguageCode;
    items: NewsItem[];
    meta?: BulletinMeta;
    /** Read the body, not just the headline. Off gives a headlines-only bulletin. */
    withDetail?: boolean;
    /** Sentences of body text per story. Keeps a 1300-word feature to a segment. */
    detailSentences?: number;
    /** Which presenter opens. Alternating this between runs stops it feeling canned. */
    firstAnchor?: AnchorId;
    /** Cap the running order. */
    maxItems?: number;
}

/* ------------------------------------------------------------------ *
 * Phrasebook
 *
 * Every spoken line is here. The rule is the same one CLAUDE.md sets for
 * notifications: never a template string at the call site, because that is
 * how one language quietly ends up with an untranslated sentence in it.
 * ------------------------------------------------------------------ */

export const PHRASES = {
    en: {
        dir: 'ltr' as const,
        locale: 'en-US',
        open: (category: string) =>
            `Welcome to the Self Study newscast. Here are the latest ${category} headlines.`,
        openNoCategory: 'Welcome to the Self Study newscast. Here are the latest headlines.',
        handover: ['Our next story.', 'Also this hour.', 'Turning to this.',
                   'In other news.', 'Meanwhile.'],
        detailLead: ['Here are the details.', 'More on that story.', 'The details.'],
        close: 'That is the bulletin for this hour. Thank you for listening to Self Study News.',
        empty: 'There are no stories in this category right now. Please try another category.',
        source: (name: string) => `${name} reports.`,
    },
    ar: {
        dir: 'rtl' as const,
        locale: 'ar-SA',
        open: (category: string) =>
            `أهلا بكم في نشرة سيلف ستدي الإخبارية. إليكم آخر عناوين ${category}.`,
        openNoCategory: 'أهلا بكم في نشرة سيلف ستدي الإخبارية. إليكم آخر العناوين.',
        handover: ['وفي خبر آخر.', 'وأيضا في هذه النشرة.', 'ننتقل الآن إلى.',
                   'وعلى صعيد آخر.', 'وفي سياق متصل.'],
        detailLead: ['وإليكم التفاصيل.', 'المزيد من التفاصيل.', 'التفاصيل.'],
        close: 'إلى هنا تنتهي نشرتنا لهذه الساعة. شكرا لمتابعتكم أخبار سيلف ستدي.',
        empty: 'لا توجد أخبار في هذا القسم حاليا. الرجاء اختيار قسم آخر.',
        source: (name: string) => `${name}.`,
    },
} as const;

export function isRtl(language: LanguageCode): boolean {
    return PHRASES[language].dir === 'rtl';
}

export function localeFor(language: LanguageCode): string {
    return PHRASES[language].locale;
}

/* ------------------------------------------------------------------ *
 * Preparing text for a synthesiser
 * ------------------------------------------------------------------ */

/**
 * Make a line safe and natural to speak.
 *
 * Speech synthesis reads punctuation and markup literally, so anything that
 * survives to here is heard. Four things in particular:
 *
 * * a stray `&quot;` is pronounced "quot" — the DAG unescapes entities, and
 *   this is the second line of defence for anything stored before it did;
 * * a bare URL is read out character by character, for ten seconds;
 * * Al Jazeera prefixes breaking stories with `عاجل |`, and the pipe is read
 *   as "vertical bar" by some voices and silently swallowed by others;
 * * an ellipsis of two dots (`..`, which both sources use heavily in Arabic)
 *   gets no pause at all, where a comma gets the right one.
 */
export function speakable(raw: string): string {
    if (!raw) return '';
    return raw
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, ' and ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/\s*\|\s*/g, ', ')
        .replace(/\.{2,}/g, ', ')
        .replace(/["“”«»]/g, ' ')
        .replace(/\s*[–—]\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Split body text into sentences, for both scripts.
 *
 * Arabic uses `؟` and `،` and does not use `.` as a terminator anywhere near as
 * often, so an English-only `/[.!?]/` split returns one enormous sentence and
 * the detail cap stops capping anything. That is not a cosmetic failure: an
 * uncapped detail is a 1300-word feature read in a single breath, which is
 * about nine minutes of one story.
 */
/**
 * Does `buffer` end in a dotted abbreviation rather than a full stop?
 *
 * "The U.S. said no." is one sentence, not three. Without this the anchor's
 * first line is the fragment "The U.S." and the detail cap spends two of its
 * three sentences on it — which is how a story gets read as a stub.
 *
 * Two shapes cover almost all of it in news copy: a single-letter initial
 * (`H.`, `U.`) and a dotted pair (`U.S.`, `a.m.`, `e.g.`). Unicode property
 * escapes so it holds for both scripts, and deliberately NOT an abbreviation
 * dictionary — the cost of missing one is a slightly early pause, and the cost
 * of a dictionary is a dictionary.
 */
function endsInAbbreviation(buffer: string): boolean {
    return /(?:^|\s)\p{L}\.$/u.test(buffer) || /\p{L}\.\p{L}\.$/u.test(buffer);
}

export function sentences(text: string): string[] {
    if (!text) return [];

    // Scanned rather than split with a regex, for two reasons that both bite.
    //
    // A lookbehind on the terminator class is the obvious spelling and is a
    // **parse-time** syntax error on Safari before 16.4 — it would not fail
    // here, it would take the whole bundle down on that browser. Same reasoning
    // as `linkify.ts`.
    //
    // And a terminator only ends a sentence when whitespace FOLLOWS it, so
    // "3.5" and "U.S." stay whole. Arabic needs the same rule with its own
    // question mark, U+061F: an English-only `[.!?]` split returns ONE enormous
    // sentence for Arabic prose, which silently disables the detail cap and
    // reads a whole feature in a single breath.
    const out: string[] = [];
    const chars = Array.from(text);
    let buffer = '';

    const flush = () => {
        const line = buffer.trim();
        if (line.length > 1) out.push(line);
        buffer = '';
    };

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === '\n' || ch === '\r') {
            flush();
            continue;
        }
        buffer += ch;
        const terminator = ch === '.' || ch === '!' || ch === '?' || ch === '؟';
        const next = chars[i + 1];
        if (terminator && (next === undefined || /\s/.test(next)) && !endsInAbbreviation(buffer)) {
            flush();
        }
    }
    flush();
    return out;
}

/** The first `count` sentences of a story's body, as one spoken passage. */
export function detailText(item: NewsItem, count: number): string {
    const source = (item.paragraphs && item.paragraphs.length)
        ? item.paragraphs.join(' ')
        : (item.body || item.summary || '');
    const picked = sentences(speakable(source)).slice(0, Math.max(1, count));
    if (picked.length) return picked.join(' ');
    return speakable(item.summary || '');
}

/** Does this story have anything to say after its headline? */
export function hasDetail(item: NewsItem): boolean {
    if (item.has_detail === false) return false;
    return Boolean((item.body && item.body.trim())
        || (item.paragraphs && item.paragraphs.length)
        || (item.summary && item.summary.trim()));
}

/* ------------------------------------------------------------------ *
 * The running order
 * ------------------------------------------------------------------ */

export const OTHER_ANCHOR: Record<AnchorId, AnchorId> = {
    female: 'male',
    male: 'female',
};

/**
 * Turn a bulletin into a running order.
 *
 * The two invariants worth stating, both asserted by the check:
 *
 * * every `detail` segment has `bed === false` and every other kind has
 *   `bed === true`;
 * * a story's `headline` and its `detail` are read by the SAME anchor, and
 *   consecutive stories are read by different ones.
 */
export function buildScript(options: ScriptOptions): Segment[] {
    const {
        language,
        meta,
        withDetail = true,
        detailSentences = 3,
        firstAnchor = 'female',
        maxItems = 12,
    } = options;

    const phrases = PHRASES[language];
    const items = (options.items || [])
        .filter(item => item && (item.title || '').trim().length > 0)
        .slice(0, Math.max(1, maxItems));

    if (!items.length) {
        return [{ kind: 'open', anchor: firstAnchor, text: phrases.empty, bed: false }];
    }

    const categoryLabel = (language === 'ar' ? meta?.label : (meta?.label_en || meta?.label)) || '';
    const script: Segment[] = [{
        kind: 'open',
        anchor: firstAnchor,
        text: categoryLabel
            ? phrases.open(speakable(categoryLabel))
            : phrases.openNoCategory,
        bed: true,
    }];

    let anchor = firstAnchor;
    items.forEach((item, index) => {
        // A story belongs to one anchor. The handover line is spoken by the
        // anchor taking over, which is what makes it a handover rather than an
        // announcement — so the switch happens before it, not after.
        if (index > 0) {
            anchor = OTHER_ANCHOR[anchor];
            script.push({
                kind: 'handover',
                anchor,
                text: phrases.handover[index % phrases.handover.length],
                bed: true,
                itemId: item.id,
                itemIndex: index,
            });
        }

        script.push({
            kind: 'headline',
            anchor,
            text: speakable(item.title),
            bed: true,
            itemId: item.id,
            itemIndex: index,
        });

        if (withDetail && hasDetail(item)) {
            const text = detailText(item, detailSentences);
            if (text) {
                script.push({
                    kind: 'detail',
                    anchor,
                    text,
                    // The one place the bed is off. This is the brief.
                    bed: false,
                    itemId: item.id,
                    itemIndex: index,
                });
            }
        }
    });

    script.push({
        kind: 'close',
        anchor: OTHER_ANCHOR[anchor],
        text: phrases.close,
        bed: true,
    });

    return script;
}

/** Every story the script touches, in order — what the page highlights. */
export function storyOrder(script: Segment[]): string[] {
    const seen: string[] = [];
    for (const segment of script) {
        if (segment.itemId && !seen.includes(segment.itemId)) seen.push(segment.itemId);
    }
    return seen;
}

/**
 * Roughly how long a segment takes to speak, in milliseconds.
 *
 * Only used to size the progress bar and to decide when to cross-fade the bed,
 * never to schedule anything — the synthesiser's own `end` event drives the
 * sequence, because a timer that disagrees with it either talks over the next
 * anchor or leaves a hole.
 *
 * Arabic script is denser per character and the common Arabic voices read it
 * slower than English, so the two rates differ. Words are the wrong unit for
 * Arabic, where clitics attach and one "word" is often a phrase.
 */
export function estimateDurationMs(text: string, language: LanguageCode, rate = 1): number {
    const characters = (text || '').trim().length;
    if (!characters) return 0;
    const charactersPerSecond = language === 'ar' ? 11 : 14;
    return Math.round((characters / (charactersPerSecond * Math.max(0.5, rate))) * 1000);
}

export function estimateScriptMs(script: Segment[], language: LanguageCode, rate = 1): number {
    return script.reduce((total, s) => total + estimateDurationMs(s.text, language, rate), 0);
}

/* ------------------------------------------------------------------ *
 * Voices
 * ------------------------------------------------------------------ */

/** The shape of a `SpeechSynthesisVoice`, without needing the DOM lib here. */
export interface VoiceLike {
    name: string;
    lang: string;
    localService?: boolean;
    default?: boolean;
}

// Names that reliably indicate a voice's gender across Windows, macOS, Android
// and Chrome's server voices. Matched case-insensitively against the voice
// name, which is the only signal the Web Speech API exposes — there is no
// gender field, and there never has been.
/*
  Gender is guessed from the voice NAME, because the Web Speech API exposes no
  gender field and never has.

  Arabic names are listed as carefully as the English ones, and getting them
  wrong is worse here: on a platform with exactly two Arabic voices, one bad
  hint puts both presenters on the same one. `naayf` was originally in both
  lists — it is Microsoft's male Saudi voice — so its score cancelled to zero
  and it was cast at random.
*/
const FEMALE_HINTS = [
    'female', 'woman',
    // Arabic
    'hoda', 'salma', 'laila', 'layla', 'zeina', 'amira', 'hala', 'noura', 'nora',
    'fatima', 'rana', 'sana',
    // English
    'zira', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'serena',
    'allison', 'susan', 'joanna', 'kendra', 'kimberly', 'aria', 'jenny', 'michelle',
    'eva', 'emma', 'libby', 'sonia', 'natasha', 'clara',
];
const MALE_HINTS = [
    'male', 'man',
    // Arabic
    'naayf', 'nayf', 'maged', 'majed', 'tarik', 'hamed', 'shakir', 'omar', 'ali',
    'khalid', 'bassel',
    // English
    'david', 'mark', 'george', 'james', 'guy', 'ryan', 'brian', 'alex', 'daniel',
    'fred', 'oliver', 'thomas', 'aaron', 'matthew', 'justin', 'william', 'liam',
    'christopher', 'eric', 'roger', 'steffan',
];

function scoreName(name: string, hints: string[]): number {
    const lower = (name || '').toLowerCase();
    return hints.reduce((score, hint) => (lower.includes(hint) ? score + 1 : score), 0);
}

/** The BCP-47 prefix a language's voices must carry. */
function langPrefix(language: LanguageCode): string {
    return language === 'ar' ? 'ar' : 'en';
}

/** Every installed voice that actually speaks `language`. */
export function voicesFor(voices: VoiceLike[], language: LanguageCode): VoiceLike[] {
    const prefix = langPrefix(language);
    return (voices || []).filter(v => (v.lang || '').toLowerCase().startsWith(prefix));
}

/** Can this browser speak `language` at all? */
export function canSpeak(voices: VoiceLike[], language: LanguageCode): boolean {
    return voicesFor(voices, language).length > 0;
}

/**
 * Pick the best available voice for a language and a presenter, or `null`.
 *
 * **It never returns a voice in the wrong language, and that is the whole
 * point of this function.** It used to fall back to "any voice at all" when the
 * requested language had none, on the reasoning that some voice is better than
 * silence. That reasoning is wrong, and Arabic is where it shows: an explicitly
 * assigned `utterance.voice` OVERRIDES `utterance.lang`, so an English engine
 * was handed Arabic characters and read them with English phonetics. The result
 * is not accented Arabic, it is unintelligible noise — reported, correctly, as
 * "it reads mixed words, not Arabic".
 *
 * Returning `null` is strictly better, because the caller can then leave
 * `utterance.voice` unset and let the platform match on `lang` alone. That
 * frequently reaches an OS voice the browser never listed, and when it does
 * not, the failure is silence plus a message the reader can act on rather than
 * a minute of gibberish.
 *
 * `exclude` is what stops both presenters landing on the same voice when the
 * platform offers two. Two identical voices "taking turns" is worse than one
 * voice reading everything, because the handover lines then sound like a fault.
 */
export function pickVoice(
    voices: VoiceLike[],
    language: LanguageCode,
    anchor: AnchorId,
    exclude?: VoiceLike | null,
): VoiceLike | null {
    const pool = voicesFor(voices, language);
    if (!pool.length) return null;

    const wanted = anchor === 'female' ? FEMALE_HINTS : MALE_HINTS;
    const unwanted = anchor === 'female' ? MALE_HINTS : FEMALE_HINTS;

    const ranked = pool
        .map(voice => {
            let score = scoreName(voice.name, wanted) * 4 - scoreName(voice.name, unwanted) * 4;
            // Not a hard exclusion: with one Arabic voice installed, both
            // presenters have to share it.
            if (exclude && voice.name === exclude.name) score -= 10;
            if (voice.localService) score += 1;      // no network hiccup mid-sentence
            return { voice, score };
        })
        .sort((a, b) => b.score - a.score);

    return ranked[0].voice;
}

/**
 * A voice for each presenter, never the same one twice unless there is no choice.
 *
 * Returned as a pair rather than resolved per segment so the page can tell the
 * listener which voices it actually found — "both anchors sound the same"
 * is a platform limitation worth stating rather than a bug worth hunting.
 */
export function castVoices(
    voices: VoiceLike[],
    language: LanguageCode,
): Record<AnchorId, VoiceLike | null> {
    const female = pickVoice(voices, language, 'female');
    const male = pickVoice(voices, language, 'male', female);
    return { female, male };
}

/**
 * The `lang` to put on an utterance.
 *
 * When a voice was found, use **that voice's own** tag rather than the
 * language's nominal one: casting `ar-EG` (Microsoft Hoda) while asking for
 * `ar-SA` is a mismatch some engines resolve by ignoring the voice. With no
 * voice, the nominal tag is the only signal the platform gets, and it is what
 * lets it reach an OS voice that was never in `getVoices()`.
 */
export function utteranceLang(language: LanguageCode, voice?: VoiceLike | null): string {
    return voice?.lang || localeFor(language);
}

/* ------------------------------------------------------------------ *
 * The music bed
 * ------------------------------------------------------------------ */

/** How many beds ship with the app — `bedIndexFor` never exceeds this. */
export const BED_COUNT = 4;

/**
 * Which bed plays under a given story.
 *
 * Rotating is the point: five stories under the same eighty-second loop is the
 * thing that makes an automated bulletin sound automated. Deterministic on the
 * index rather than random so a re-listen sounds the same and the check can
 * assert it.
 */
export function bedIndexFor(itemIndex: number): number {
    return (Math.max(0, itemIndex) % BED_COUNT) + 1;
}

/**
 * Bed volume for a segment.
 *
 * Zero under detail; ducked under a voice; full only on the opening, where
 * there is no speech competing for the first moment. Ducking to ~12% rather
 * than muting is what keeps a bulletin sounding continuous across the gaps
 * between utterances.
 */
export function bedVolumeFor(segment: Segment): number {
    if (!segment.bed) return 0;
    if (segment.kind === 'open') return 0.38;
    if (segment.kind === 'close') return 0.30;
    return 0.12;
}
