/**
 * src/netsim/i18n/index.ts
 * The Arabic and Chinese of the Network Simulator's own curriculum.
 *
 * ============================================================
 * WHY THIS IS NOT A `messages/` CATALOGUE AND NOT A `$td` RECORD
 * ============================================================
 *
 * The netsim lessons are neither of the two translatable things this platform
 * already has:
 *
 *  - they are not INTERFACE text, so they cannot go in `src/i18n/messages/`.
 *    That catalogue is keyed on the English string and is loaded eagerly for
 *    every route; a lesson's theory is 2,000 characters of prose and there are
 *    sixty of them.
 *  - they are not RECORDS, so `$td` cannot reach them. They are a compiled-in
 *    TypeScript catalogue (`src/netsim/lessons.ts`) built by positional calls to
 *    an `L(...)` helper, with no backend and no `translations` field to carry.
 *
 * So the English stays exactly where it is and the translations are a JSON
 * catalogue beside it, keyed on the lesson id, overlaid at render time.
 *
 * ============================================================
 * IT IS LAZY, AND THAT IS THE LOAD-BEARING PART
 * ============================================================
 *
 * `NetworkSimulatorLearn.vue` and `NetworkSimulatorStudio.vue` are imported
 * STATICALLY by the router, so everything they reach is in the ENTRY chunk that
 * every visitor downloads -- including somebody reading the login page. The
 * netsim stack is already ~570 kB of it. Two full translations of the curriculum
 * is another ~600 kB of JSON, and shipping that eagerly would make every route
 * on the platform slower to pay for one route in two languages.
 *
 * So the catalogue is `await import()`ed, once, only when the reader's language
 * is not English, and only by a netsim view. An English reader downloads
 * nothing; an Arabic reader downloads one chunk on the netsim route.
 *
 * Before it arrives -- and on a chunk that 404s after a deploy -- every
 * accessor returns the English. That is the same degraded-not-broken answer
 * `$td` gives for an untranslated record, and it is why nothing here awaits
 * the load in order to render.
 *
 * ============================================================
 * WHAT IS DELIBERATELY NOT TRANSLATABLE
 * ============================================================
 *
 * A command is copied, never translated. `commands[].cmd` has no entry in the
 * catalogue shape at all, and neither does a task's `check` or its `args` --
 * those are a validator id and its arguments, and a translated one is a task
 * that can never pass. `keyTerms[].term` IS translatable and its `meaning`
 * obviously is; a term like "MAC address" will come back unchanged from a
 * translator told to keep protocol names in Latin script, which is correct.
 *
 * This is `untranslated.json`'s rule arriving at a third place: translate what
 * the platform wrote for a reader, leave what a machine parses.
 */

import { ref } from 'vue';

import type { Lesson, Track } from '../types';

/** One lesson's translated text. Every field optional -- a partial is normal. */
export interface LessonTranslation {
    title?: string;
    subtitle?: string;
    theory?: string;
    objectives?: string[];
    keyTerms?: Array<{ term?: string; meaning?: string }>;
    /** Positional, and `cmd` is absent by design -- a command is copied. */
    commands?: Array<{ explain?: string }>;
    /** KEYED ON TASK ID, never on position -- see the note on `overlayLesson`. */
    tasks?: Record<string, { text?: string; hint?: string }>;
    quiz?: Array<{ q?: string; options?: string[]; why?: string }>;
}

export interface TrackTranslation {
    title?: string;
    subtitle?: string;
    blurb?: string;
}

export interface NetsimCatalogue {
    lessons?: Record<string, LessonTranslation>;
    tracks?: Record<string, TrackTranslation>;
}

/**
 * The loaded catalogue, or null.
 *
 * A `ref` so a view's `computed` re-evaluates the moment the chunk lands: the
 * page renders in English immediately and switches to Arabic a few hundred
 * milliseconds later without anybody awaiting anything.
 */
const catalogue = ref<NetsimCatalogue | null>(null);
const loadedFor = ref<string>('');

/** In flight, so six components mounting at once join one download. */
const pending = new Set<string>();

/**
 * Which request is current.
 *
 * A COUNTER RATHER THAN A COMPARISON AGAINST THE PROMISE ITSELF. The obvious
 * spelling is `const job = (async () => { ... pending.get(id) === job ... })()`,
 * and `vue-tsc` is right to refuse it: the body closes over `job` before the
 * initialiser has finished, which is a temporal dead zone. It happens to work
 * because the body reaches an `await` first -- and "happens to work" is exactly
 * what took the Job Interview room down twice, once as a `ReferenceError`
 * swallowed by an empty catch and once as a blank page (working rule 36).
 *
 * The counter is the same shape the Newscast uses to guard `speechSynthesis`:
 * a generation, for an API with no AbortController.
 */
let generation = 0;

/**
 * Load the catalogue for a language. Safe to call on every mount and every
 * language change.
 *
 * A FAILURE IS CACHED AS "no catalogue" rather than retried, for the reason
 * `ensureCourse` in `Home.vue` caches a null: a chunk that 404s after a deploy
 * would otherwise be re-requested by every component on every render, and the
 * answer is not going to change within the life of the page.
 */
export function ensureNetsimI18n(localeId: string): void {
    if (!localeId || localeId === 'en') {
        catalogue.value = null;
        loadedFor.value = 'en';
        return;
    }
    if (loadedFor.value === localeId) return;
    if (pending.has(localeId)) return;

    pending.add(localeId);
    const mine = ++generation;
    void (async () => {
        let loaded: NetsimCatalogue | null = null;
        try {
            // A static map rather than a template literal, so the bundler can
            // see both chunks. `import(`./${id}.json`)` produces a glob import
            // of every file in the directory, which defeats the whole point.
            if (localeId === 'ar') loaded = (await import('./ar.json')).default as NetsimCatalogue;
            else if (localeId === 'zh') loaded = (await import('./zh.json')).default as NetsimCatalogue;
        } catch {
            // Cached as "no catalogue" rather than retried -- see the note
            // above. A chunk that 404s after a deploy is not going to appear
            // within the life of this page.
            loaded = null;
        }
        pending.delete(localeId);
        // Only publish if the reader has not switched language while we waited.
        // Without this, a slow Arabic chunk landing after a switch to Chinese
        // would overwrite the Chinese catalogue with the Arabic one.
        if (mine !== generation) return;
        catalogue.value = loaded;
        loadedFor.value = localeId;
    })();
}

/** Has anything been loaded? For a "reading in English" declaration. */
export function netsimTranslated(): boolean {
    return !!catalogue.value;
}

function pickText(translated: string | undefined, english: string): string {
    return translated && translated.trim() ? translated : english;
}

/**
 * A list, falling back to English ELEMENT BY ELEMENT.
 *
 * Same rule and same reason as `list()` in `src/i18n/records.ts`: a translation
 * that came back with three objectives where the English has five must render
 * five. A dropped objective is a requirement the student is never told about,
 * and the list looks complete while being short.
 */
function pickList(translated: string[] | undefined, english: string[]): string[] {
    if (!Array.isArray(translated)) return english;
    return english.map((text, index) => pickText(translated[index], text));
}

/**
 * One lesson with its prose in the reader's language.
 *
 * Returns the SAME OBJECT when there is nothing to overlay, so a view's
 * `computed` does not hand `v-for` a fresh array of fresh objects on every
 * unrelated render -- which would re-key every card and lose the reader's
 * expanded/collapsed state.
 *
 * TASKS ARE KEYED ON `task.id` AND NOT ON POSITION. A task's position is the
 * order somebody wrote them in and is free to change; its id is what
 * `LESSON_CHECKS` and the stored progress are recorded against. A translation
 * attached to an index would silently move onto a different task the first time
 * a lesson gained a step.
 */
export function overlayLesson(lesson: Lesson): Lesson {
    const entry = catalogue.value?.lessons?.[lesson.id];
    if (!entry) return lesson;
    return {
        ...lesson,
        title: pickText(entry.title, lesson.title),
        subtitle: pickText(entry.subtitle, lesson.subtitle),
        theory: pickText(entry.theory, lesson.theory),
        objectives: pickList(entry.objectives, lesson.objectives),
        keyTerms: lesson.keyTerms.map((row, index) => ({
            term: pickText(entry.keyTerms?.[index]?.term, row.term),
            meaning: pickText(entry.keyTerms?.[index]?.meaning, row.meaning),
        })),
        commands: lesson.commands?.map((row, index) => ({
            // `cmd` is NEVER overlaid. A student types it.
            cmd: row.cmd,
            explain: pickText(entry.commands?.[index]?.explain, row.explain),
        })),
        tasks: lesson.tasks.map(task => ({
            ...task,
            text: pickText(entry.tasks?.[task.id]?.text, task.text),
            hint: pickText(entry.tasks?.[task.id]?.hint, task.hint || '') || task.hint,
        })),
        quiz: lesson.quiz?.map((row, index) => ({
            ...row,
            q: pickText(entry.quiz?.[index]?.q, row.q),
            options: pickList(entry.quiz?.[index]?.options, row.options),
            why: pickText(entry.quiz?.[index]?.why, row.why),
        })),
    };
}

/** One track with its own text in the reader's language. */
export function overlayTrack(track: Track): Track {
    const entry = catalogue.value?.tracks?.[track.id];
    if (!entry) return track;
    return {
        ...track,
        title: pickText(entry.title, track.title),
        subtitle: pickText(entry.subtitle, track.subtitle),
        ...(entry.blurb && (track as Track & { blurb?: string }).blurb !== undefined
            ? { blurb: pickText(entry.blurb, (track as Track & { blurb?: string }).blurb || '') }
            : {}),
    };
}
