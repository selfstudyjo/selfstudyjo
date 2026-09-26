/**
 * ONE READER FOR THE WHOLE APP, and the browser half of reading aloud.
 *
 * The decisions -- what is said, in what order, in which language, in what size
 * pieces -- are in `src/utils/reader.ts`, which is plain and checked in node.
 * The routing between a device voice, app 36's server voice and the platform
 * engine is `roomSpeech.planSpeech`, which already exists and is already
 * checked. What is here is the part that can only be done in a browser: the
 * `speechSynthesis` quirks, the Web Audio levelling, the prefetch, and the
 * bookkeeping that stops two sections reading at once.
 *
 * ============================================================
 * WHY THE STATE IS MODULE-LEVEL
 * ============================================================
 *
 * Exactly the reason `useTour` and `useAssistant` are: there are MANY buttons
 * and there must be ONE voice. A lesson page has a Read button on the write-up,
 * on each heading section and in the floating bar; the lab workbench has one on
 * the brief and one on each task. Per-component state means pressing the second
 * one starts a second reader over the top of the first, which is two voices
 * reading two different paragraphs and no way to stop either.
 *
 * `section` is which button is currently reading, so each button can render its
 * own state without knowing about the others. Starting a new section stops the
 * old one, which is what a reader expects from a play button.
 *
 * Deliberately NOT a Pinia store (it is transient UI state about what is
 * audible right now) and deliberately NOT persisted -- a page that started
 * talking on load, because it was talking when the reader left, is a page
 * nobody can use in an office.
 *
 * ============================================================
 * PAUSE RESTARTS THE CURRENT PASSAGE, AND THAT IS DELIBERATE
 * ============================================================
 *
 * There are two playback mechanisms here and only one of them can pause. Web
 * Audio has no pause and no seek on a `BufferSource`; `speechSynthesis` has
 * `pause()` and `resume()` -- and this module is already USING that pair, nine
 * seconds apart, as the documented workaround for Chrome cutting a long
 * utterance off at ~15 seconds. A user pause layered on top of that keepalive
 * is a race whose loser resumes speech the reader asked to stop.
 *
 * So pause means "stop the audio, remember the passage" and resume means "say
 * that passage again from its start". A passage is ~360 characters, i.e. about
 * twenty seconds, so the worst case is re-hearing one short paragraph -- and it
 * behaves identically on both routes, which an exact-pause-here-and-restart-
 * there hybrid would not. Stop is always available and always exact.
 */

import { computed, ref } from 'vue';

import {
    dominantLanguage, estimateMs, type Passage, type ReaderLang, type ReadingPlan,
} from '@/utils/reader';
import {
    NO_SERVER, describe as describeSpeech, planSpeech, serverVoicesFor,
    type ServerVoices,
} from '@/utils/roomSpeech';
import { createSpeechAudio } from '@/utils/speechAudio';
import { shapeRatio } from '@/components/newscast/voiceShaper';
import { estimateDurationMs, type VoiceLike } from '@/components/newscast/newscastEngine';
import { getLocale } from '@/i18n/locales';
import { newsService, type SpeechCapabilities } from '@/services/news.service';

export type ReaderState = 'idle' | 'loading' | 'playing' | 'paused';

/* ------------------------------------------------------------------ *
 * The one reader
 * ------------------------------------------------------------------ */

const state = ref<ReaderState>('idle');
/** Which section is reading. Null when nothing is. */
const section = ref<string | null>(null);
const index = ref(0);
const total = ref(0);
/** What the reader is actually hearing, for the bar to show. */
const voiceNote = ref('');
/** A refusal the reader needs to know about. Never a stack trace. */
const error = ref('');

let plan: ReadingPlan | null = null;

/**
 * Bumped by every stop, pause and new read.
 *
 * A synthesis is a network round trip and a decode is asynchronous, so a
 * reader who presses Stop and then presses Play on another section has two
 * chains in flight. Without this the abandoned one resumes talking over the new
 * one -- and `speechSynthesis` has no AbortController, which is why this is a
 * counter rather than a signal. Same shape as the Newscast's and
 * `speechAudio`'s own.
 */
let turn = 0;

let keepAlive: ReturnType<typeof setInterval> | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;

/**
 * Web Audio, shared for the life of the tab.
 *
 * One instance rather than one per section: an `AudioContext` is a scarce
 * resource (browsers cap live ones at about six and then start silently killing
 * the OLDEST, which looks like the voice simply stopping) and the decoded-clip
 * cache inside it is what makes replaying a passage after a pause free.
 */
const audio = createSpeechAudio();

/* ------------------------------------------------------------------ *
 * Voices
 * ------------------------------------------------------------------ */

const voices = ref<VoiceLike[]>([]);

/**
 * App 36's capability payload, fetched ONCE and read per language.
 *
 * One request rather than one per language, because the answer for all three
 * arrives in the same body -- and this is a round trip to a PythonAnywhere
 * replica whose first answer of the day takes ~20 seconds, in front of a button
 * somebody has just pressed.
 *
 * `null` means "not asked yet"; a failed probe stores an empty payload so it is
 * not retried on every passage. `NO_SERVER` is then what `serverVoicesFor`
 * answers, and the platform route carries the read.
 */
let capabilities: SpeechCapabilities | null = null;
let probed = false;

/**
 * THE NARRATOR IS FEMALE, and that is a practical decision rather than a
 * default nobody thought about.
 *
 * App 36's fallback provider -- which is what is in charge whenever `edge-tts`
 * is missing from the replica, and it has been for some time -- has exactly ONE
 * voice per language and it is female in all three. Asking for a female
 * narrator therefore makes `planSpeech` answer `matched` with nothing to
 * correct, and the whole pitch-reshaping pass is skipped on every passage.
 *
 * A male narrator would be reshaped clip by clip on that configuration: a
 * resample plus a WSOLA pass per passage, for a voice nobody asked to be male.
 * Where the platform grows a second narrator this becomes a preference; until
 * then it is the choice that costs a reader nothing.
 */
const NARRATOR = 'female' as const;

function loadVoices(): void {
    try {
        voices.value = (window.speechSynthesis?.getVoices() || []) as VoiceLike[];
    } catch {
        voices.value = [];
    }
}

/**
 * Read the device list and ask app 36 what it can do.
 *
 * `getVoices()` is empty on its first synchronous call in every browser -- the
 * list arrives asynchronously and `voiceschanged` fills it in, and it can fire
 * more than once. Casting without this gets a null and the platform's default
 * robotic voice, in whatever language it happens to be.
 */
async function probe(): Promise<void> {
    loadVoices();
    if (probed) return;
    probed = true;
    try {
        capabilities = await newsService.speechCapabilities();
    } catch {
        capabilities = null;
    }
}

function serverFor(lang: ReaderLang): ServerVoices {
    if (!capabilities) return NO_SERVER;
    return serverVoicesFor(capabilities, lang);
}

/* ------------------------------------------------------------------ *
 * Reading speed
 * ------------------------------------------------------------------ */

const RATE_KEY = 'sfs-reader-rate';
export const RATES = [0.8, 1, 1.25, 1.5] as const;

function storedRate(): number {
    try {
        const raw = Number(window.localStorage.getItem(RATE_KEY));
        return RATES.includes(raw as (typeof RATES)[number]) ? raw : 1;
    } catch {
        // Safari in private mode throws on localStorage, and a reader who
        // cannot store a preference should still be able to listen.
        return 1;
    }
}

const rate = ref(storedRate());

function setRate(value: number): void {
    rate.value = RATES.includes(value as (typeof RATES)[number]) ? value : 1;
    try { window.localStorage.setItem(RATE_KEY, String(rate.value)); } catch { /* fine */ }
}

/* ------------------------------------------------------------------ *
 * Saying one passage
 * ------------------------------------------------------------------ */

/**
 * MARK THE DOCUMENT WHILE A BAR IS UP, so the page can reserve room for it.
 *
 * `.app-container > .main-content` is the scroll container and it reserves
 * `clamp(80px, 14vh, 110px)` of bottom padding. Measured, the bar is 115px tall
 * plus a 16px offset at 390px -- so without this the last ~20px of the final
 * element on the page sits underneath it, which on a lesson is the bottom of
 * the comment box and on a runbook is the last line of the last step. The rule
 * that consumes this lives in `default-layout.css`, which is the file that owns
 * that element's padding; a rule for `.main-content` in the control's own
 * stylesheet would be a page-layout decision taken by a button.
 *
 * An attribute rather than a class, so it cannot collide with anything, and on
 * `<html>` rather than `<body>` because that is where the theme system already
 * writes and the two are read together.
 */
function markReading(active: boolean): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (active) root.setAttribute('data-sfs-reading', '1');
    else root.removeAttribute('data-sfs-reading');
}

function clearTimers(): void {
    if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
}

function cancelSpeech(): void {
    clearTimers();
    audio.stop();
    try { window.speechSynthesis?.cancel(); } catch { /* no engine here */ }
}

/**
 * Say one passage through `speechSynthesis`. Resolves when it has finished.
 *
 * Never rejects. The caller is a loop over a document, and a rejection there
 * would leave the bar stuck on passage four of forty with no way forward.
 */
function sayOnDevice(passage: Passage, mine: number): Promise<void> {
    const locale = getLocale(passage.lang);
    const plan = planSpeech(voices.value, passage.lang, NARRATOR, 0,
                            serverFor(passage.lang), audio.capable);
    voiceNote.value = describeSpeech(plan, locale.name);

    return new Promise<void>(resolve => {
        // EVERY binding this closure reads is declared before the closure is.
        // A `const` read from a function defined above it is a temporal dead
        // zone error, and inside a swallowed catch it is a promise that never
        // settles -- which is what took the Job Interview room down and is why
        // that file, this one and `AssistantDock` all order declarations first.
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimers();
            resolve();
        };

        let utterance: SpeechSynthesisUtterance;
        try {
            utterance = new SpeechSynthesisUtterance(passage.text);
        } catch {
            finish();
            return;
        }
        utterance.lang = plan.lang;
        utterance.pitch = plan.pitch;
        utterance.rate = rate.value;
        // Left UNSET on the platform route deliberately: an explicitly assigned
        // `utterance.voice` OVERRIDES `utterance.lang`, so leaving it null is
        // what lets the platform match on the language itself and often reach
        // an OS voice `getVoices()` never listed at all.
        if (plan.voice) utterance.voice = plan.voice as unknown as SpeechSynthesisVoice;
        utterance.onend = finish;
        utterance.onerror = finish;

        // Chrome stops speaking after ~15 seconds and `onend` frequently never
        // arrives, so a long passage is both cut off AND leaves this promise
        // pending for ever -- a reader stuck mid-document with the bar saying
        // it is still playing. The pause/resume pair is the documented
        // workaround; the watchdog is sized to the text because "should" is not
        // a guarantee and the cost of being wrong is a dead reader.
        keepAlive = setInterval(() => {
            try {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
            } catch {
                /* the engine went away; the watchdog will move us on */
            }
        }, 9000);

        const budget = estimateDurationMs(passage.text, passage.lang, rate.value);
        watchdog = setTimeout(finish, Math.max(8000, budget * 2 + 6000));

        try {
            window.speechSynthesis.speak(utterance);
        } catch {
            finish();
        }
        if (mine !== turn) finish();
    });
}

/**
 * Say one passage through app 36. Resolves false when it could not.
 *
 * `false` rather than a throw, because the caller's answer to "the server could
 * not say this" is to try the device engine for the same passage rather than to
 * abandon the document -- and a partly-read section is the failure this whole
 * feature exists to avoid.
 */
async function sayOnServer(passage: Passage, mine: number): Promise<boolean> {
    const locale = getLocale(passage.lang);
    const server = serverFor(passage.lang);
    const spoken = planSpeech(voices.value, passage.lang, NARRATOR, 0,
                              server, audio.capable);
    if (spoken.route !== 'server') return false;

    try {
        const clip = await newsService.speech(
            passage.text, passage.lang, NARRATOR, rate.value, '', spoken.allowAnyVoice);
        if (mine !== turn) return true;
        voiceNote.value = describeSpeech(spoken, locale.name, clip.voice);
        // RESHAPE WHAT ACTUALLY ARRIVED, not what was asked for. `shapeRatio`
        // answers 1 for a direction it has no honest number for and `play`
        // skips the whole resynthesis pass on 1, so a correctly-voiced clip is
        // never bent -- bending one that did not need it only makes it sound
        // synthetic.
        const ratio = spoken.shapeTo ? shapeRatio(clip.gender, spoken.shapeTo) : 1;
        await audio.play(clip.url, ratio);
        return true;
    } catch {
        return false;
    }
}

/**
 * Prefetch the next passage while this one is playing.
 *
 * `newsService.speech` caches per tab and de-duplicates in-flight requests, so
 * this is free to call and the real request is the one the loop makes a moment
 * later. Without it there is a synthesis round trip of silence between every
 * passage, which on a warm replica is a second and on a cold one is twenty --
 * and a gap that long reads as the reader having stopped.
 */
function prefetch(next: Passage | undefined): void {
    if (!next) return;
    const spoken = planSpeech(voices.value, next.lang, NARRATOR, 0,
                              serverFor(next.lang), audio.capable);
    if (spoken.route !== 'server') return;
    void newsService
        .speech(next.text, next.lang, NARRATOR, rate.value, '', spoken.allowAnyVoice)
        .catch(() => { /* the loop will report it if it matters */ });
}

/* ------------------------------------------------------------------ *
 * The loop
 * ------------------------------------------------------------------ */

/** Consecutive server failures before the read is abandoned with a message. */
const MAX_FAILURES = 3;

async function run(mine: number, from: number): Promise<void> {
    if (!plan) return;
    let failures = 0;

    for (let at = from; at < plan.passages.length; at++) {
        if (mine !== turn) return;
        index.value = at;
        const passage = plan.passages[at]!;

        state.value = 'playing';
        prefetch(plan.passages[at + 1]);

        const said = await sayOnServer(passage, mine);
        if (mine !== turn) return;

        if (said) {
            failures = 0;
        } else {
            const spoken = planSpeech(voices.value, passage.lang, NARRATOR, 0,
                                      serverFor(passage.lang), audio.capable);
            // Only count a failure where the SERVER was the plan. A device or
            // platform route is not a failure at all, and counting it would
            // abandon the read after three passages on every machine that has
            // its own voices -- i.e. on the fast path.
            if (spoken.route === 'server') failures++;
            await sayOnDevice(passage, mine);
            if (mine !== turn) return;
        }

        if (failures >= MAX_FAILURES) {
            // Skipping one failed line is right; skipping silently through
            // forty of them reads as "the play button does nothing". Same rule
            // the Newscast follows.
            error.value = 'speech-unavailable';
            finishRead();
            return;
        }
    }

    if (mine === turn) finishRead();
}

function finishRead(): void {
    turn++;
    clearTimers();
    markReading(false);
    state.value = 'idle';
    section.value = null;
    index.value = 0;
    total.value = 0;
    plan = null;
}

/* ------------------------------------------------------------------ *
 * The surface
 * ------------------------------------------------------------------ */

/**
 * Start reading a section, stopping whatever was reading before.
 *
 * MUST be called from inside a click. An `AudioContext` created outside a user
 * gesture starts `suspended` and every `start()` on it is silently ignored --
 * no error, no event, a section that reads in complete silence. `prime()` is
 * the unlock, and it is the first thing this does for that reason.
 */
async function read(id: string, next: ReadingPlan): Promise<void> {
    cancelSpeech();
    turn++;
    const mine = turn;

    audio.prime();
    error.value = '';
    voiceNote.value = '';

    if (!next.passages.length) {
        state.value = 'idle';
        section.value = null;
        return;
    }

    plan = next;
    section.value = id;
    markReading(true);
    index.value = 0;
    total.value = next.passages.length;
    state.value = 'loading';

    await probe();
    if (mine !== turn) return;
    await run(mine, 0);
}

/** Stop and forget. Safe to call when nothing is reading. */
function stop(): void {
    cancelSpeech();
    finishRead();
}

/**
 * Hold, at the start of the current passage. See the header for why not exact.
 */
function pause(): void {
    if (state.value !== 'playing' && state.value !== 'loading') return;
    turn++;
    cancelSpeech();
    state.value = 'paused';
}

function resume(): void {
    if (state.value !== 'paused' || !plan) return;
    turn++;
    const mine = turn;
    audio.prime();
    void run(mine, index.value);
}

function toggle(id: string, next: () => ReadingPlan): void {
    if (section.value === id) {
        if (state.value === 'paused') { resume(); return; }
        if (state.value === 'playing' || state.value === 'loading') { pause(); return; }
    }
    void read(id, next());
}

/** Skip to the next passage. Stops at the end rather than wrapping. */
function next(): void {
    if (!plan || section.value === null) return;
    const at = index.value + 1;
    if (at >= plan.passages.length) { stop(); return; }
    turn++;
    const mine = turn;
    cancelSpeech();
    index.value = at;
    void run(mine, at);
}

/** Back to the start of the previous passage, or of this one. */
function previous(): void {
    if (!plan || section.value === null) return;
    const at = Math.max(0, index.value - 1);
    turn++;
    const mine = turn;
    cancelSpeech();
    index.value = at;
    void run(mine, at);
}

const active = computed(() => state.value !== 'idle');
const languages = computed<ReaderLang[]>(() => plan?.languages ?? []);
const currentLanguage = computed<ReaderLang | null>(
    () => plan?.passages[index.value]?.lang ?? null);
const remainingMs = computed(() => {
    if (!plan) return 0;
    return plan.passages.slice(index.value).reduce(
        (total, p) => total + estimateDurationMs(p.text, p.lang, rate.value), 0);
});

/**
 * Keep the device voice list fresh.
 *
 * `voiceschanged` can fire more than once and often fires well after the first
 * `getVoices()` returned nothing, so a list read only at the first press is a
 * list that is empty on the first press of the session -- which is the press
 * that decides whether anybody uses this feature.
 */
if (typeof window !== 'undefined' && window.speechSynthesis) {
    loadVoices();
    try {
        window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } catch {
        // Older Safari exposes the handler property and not the event target.
        (window.speechSynthesis as unknown as {
            onvoiceschanged: (() => void) | null;
        }).onvoiceschanged = loadVoices;
    }
}

export function useReader() {
    return {
        /* state */
        state,
        section,
        index,
        total,
        active,
        voiceNote,
        error,
        languages,
        currentLanguage,
        remainingMs,
        rate,

        /* actions */
        read,
        stop,
        pause,
        resume,
        toggle,
        next,
        previous,
        setRate,

        /** Is THIS section the one reading? What a button asks. */
        isReading: (id: string) => section.value === id,
        /** How long the whole plan would take. Exposed for the button's label. */
        estimateMs,
        dominantLanguage,
    };
}
