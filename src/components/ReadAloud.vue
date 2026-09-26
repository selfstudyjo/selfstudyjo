<template>
  <div class="sfs-read">
    <button
      type="button"
      class="sfs-read-btn"
      :class="{
        'sfs-read-btn--compact': compact,
        'sfs-read-btn--inherit': tone === 'inherit',
        'sfs-read-btn--live': mine,
      }"
      :disabled="!speakable"
      :aria-pressed="mine && state !== 'paused'"
      :title="hint"
      @click="press"
    >
      <Loader2 v-if="mine && state === 'loading'" class="sfs-read-i sfs-read-i--spin" />
      <Pause v-else-if="mine && state === 'playing'" class="sfs-read-i" />
      <Play v-else-if="mine && state === 'paused'" class="sfs-read-i" />
      <Volume2 v-else class="sfs-read-i" />
      <span v-if="!compact" class="sfs-read-label">{{ buttonLabel }}</span>
    </button>

    <!--
      THE BAR IS TELEPORTED TO <body>, and it has to be.

      Half the page wrappers on this platform give themselves `position:
      relative` AND a `z-index`, which makes a stacking context -- and a
      `position: fixed` DESCENDANT cannot escape its ancestor's context however
      high its own z-index is. That is the bug the console's modals had on nine
      screens and the reason `tour.css` and `assistant.css` are loaded globally.
      A teleported node still carries this component's scope attribute, so
      `<style scoped>` reaches it wherever it lands.

      Only the ACTIVE section renders one, so there can never be two bars: the
      reader is module-level and exactly one section can be reading.
    -->
    <Teleport v-if="mine" to="body">
      <div class="sfs-read-bar" :dir="dir" role="group" :aria-label="$t('Reading aloud')">
        <div class="sfs-read-bar__main">
          <div class="sfs-read-bar__what">
            <span class="sfs-read-bar__title">{{ title || $t('Reading aloud') }}</span>
            <!--
              `aria-live="off"`, explicitly. A live region that announced every
              passage change would have a screen reader talking over the voice
              that is reading the page -- two voices saying different things,
              which is worse than no announcement at all. Same rule the
              newscast ticker follows.
            -->
            <span class="sfs-read-bar__meta" aria-live="off">
              <!--
                PINNED LTR. Every character in `3 / 40` is bidi-neutral, so
                inside an Arabic bar the algorithm orders the runs
                right-to-left and the reader is told they are on passage forty
                of three. `unicode-bidi: isolate` stops the counter disturbing
                its neighbours and says nothing about the order INSIDE it.
              -->
              <span class="sfs-read-bar__count">{{ index + 1 }} / {{ total }}</span>
              <span v-if="left" class="sfs-read-bar__left">{{ left }}</span>
            </span>
          </div>

          <div class="sfs-read-bar__controls">
            <button type="button" class="sfs-read-ctl" :title="$t('Previous')"
                    :aria-label="$t('Previous')" @click="reader.previous()">
              <SkipBack class="sfs-read-i" />
            </button>
            <button type="button" class="sfs-read-ctl sfs-read-ctl--primary"
                    :title="state === 'paused' ? $t('Resume') : $t('Pause')"
                    :aria-label="state === 'paused' ? $t('Resume') : $t('Pause')"
                    @click="state === 'paused' ? reader.resume() : reader.pause()">
              <Play v-if="state === 'paused'" class="sfs-read-i" />
              <Pause v-else class="sfs-read-i" />
            </button>
            <button type="button" class="sfs-read-ctl" :title="$t('Next')"
                    :aria-label="$t('Next')" @click="reader.next()">
              <SkipForward class="sfs-read-i" />
            </button>
            <button type="button" class="sfs-read-ctl" :title="$t('Stop reading')"
                    :aria-label="$t('Stop reading')" @click="reader.stop()">
              <Square class="sfs-read-i" />
            </button>
          </div>

          <!--
            The speed control is `direction: ltr` for the same reason as the
            counter: `1.25x` is digits and a Latin letter, all of it neutral or
            left-to-right, and mirrored it reads as `x52.1`.
          -->
          <div class="sfs-read-bar__rate" role="group" :aria-label="$t('Reading speed')">
            <button
              v-for="r in RATES" :key="r"
              type="button"
              class="sfs-read-rate"
              :class="{ 'sfs-read-rate--on': rate === r }"
              :aria-pressed="rate === r"
              @click="reader.setRate(r)"
            >{{ r }}x</button>
          </div>
        </div>

        <div class="sfs-read-bar__track" aria-hidden="true">
          <div class="sfs-read-bar__fill" :style="{ width: progress + '%' }"></div>
        </div>

        <p v-if="notes.length" class="sfs-read-bar__notes">
          <span v-for="(note, at) in notes" :key="at" class="sfs-read-note">{{ note }}</span>
        </p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * "Read this section" -- the control, on every page that has prose.
 *
 * One component for the lesson page, the runbook, the lab brief, the lab tasks
 * and the Network Simulator's lessons, for the reason this console has already
 * paid for twice: a button per page is five buttons whose behaviour drifts, and
 * a fourth language or a fifth control would then be five edits. Everything it
 * DECIDES is in `src/utils/reader.ts` (plain, `npm run check:reader`) and
 * everything about the voice is in `src/composables/useReader.ts`.
 *
 * A caller hands over text, parts or already-parsed blocks and a stable `id`:
 *
 *     <ReadAloud id="lesson-body" :text="write-up" :title="lesson title" />
 *     <ReadAloud :id="`step-${section.id}`" :parts="[heading, body]" compact />
 *     <ReadAloud id="brief" :blocks="parsed" />
 *
 * THE `id` MUST BE STABLE AND UNIQUE ON THE PAGE. It is how the module-level
 * reader knows which button is the one that is reading, so two sections sharing
 * an id would both render the playing state and both render a bar -- and an id
 * that changed between renders would leave the bar attached to a button that no
 * longer exists.
 */
import { computed, onBeforeUnmount, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import {
    Loader2, Pause, Play, SkipBack, SkipForward, Square, Volume2,
} from 'lucide-vue-next';

import { RATES, useReader } from '@/composables/useReader';
import {
    dominantLanguage, estimateMs, planBlocks, planParts, planText,
    type ReadingPlan,
} from '@/utils/reader';
import type { LessonBlock } from '@/utils/lessonContent';
import { getLocale } from '@/i18n/locales';
import { localeId, t } from '@/i18n/runtime';

const props = withDefaults(defineProps<{
    /** Unique and stable within the page. See the header. */
    id: string;
    /** Raw text in the platform's five-marker notation. */
    text?: string | null;
    /** Several pieces read in order -- a heading and its body, say. */
    parts?: Array<string | null | undefined>;
    /** Already-parsed blocks, where the caller has them. */
    blocks?: LessonBlock[] | null;
    /** What this section is, for the bar. Not read aloud. */
    title?: string;
    /** Icon only, for a control that sits inside a row of them. */
    compact?: boolean;
    /**
     * `inherit` where the container carries its OWN ink -- a runbook step, whose
     * background and text colour an operator chose and which arrive as inline
     * styles. See the stylesheet: a control there has to borrow the island's ink
     * rather than spend the page's, or it is invisible on a pale card.
     */
    tone?: 'default' | 'inherit';
}>(), {
    text: '',
    title: '',
    compact: false,
    tone: 'default',
});

const reader = useReader();
const { state, index, total, rate, error, voiceNote } = reader;

/**
 * The plan, computed lazily.
 *
 * A `computed` rather than a function call in the handler so a page with twenty
 * of these does the parsing once per section and only for the sections that
 * render -- and so the button can be disabled, and can say how long the section
 * takes, before anybody presses it.
 *
 * The reader's own locale is the FALLBACK only: a passage with no letters in any
 * of the three scripts (a row of IP addresses, a version number) is read in the
 * interface language, and everything else is read in the language its own
 * characters are in. See `reader.ts`.
 */
const plan = computed<ReadingPlan>(() => {
    if (props.blocks) return planBlocks(props.blocks, localeId.value);
    if (props.parts) return planParts(props.parts, localeId.value);
    return planText(props.text, localeId.value);
});

const speakable = computed(() => plan.value.passages.length > 0);
const mine = computed(() => reader.isReading(props.id));
const dir = computed(() => getLocale(localeId.value).direction);

const progress = computed(() => {
    if (!total.value) return 0;
    return Math.round(((index.value + 1) / total.value) * 100);
});

function minutesOf(ms: number): number {
    return Math.max(1, Math.round(ms / 60000));
}

const left = computed(() => {
    const ms = reader.remainingMs.value;
    if (ms < 45000) return '';
    return t('{v0} min left', { v0: minutesOf(ms) });
});

/**
 * The language the section is actually in, named when it is not the one the
 * reader chose.
 *
 * This is the declaration that makes the substitution acceptable (working rule
 * 21). ~230 lesson write-ups and the whole Network Simulator catalogue are
 * English only, so an Arabic reader pressing play on one of them hears English
 * -- which is correct, is the best available answer, and is baffling unless the
 * page says so.
 */
const spokenIn = computed(() => {
    const lang = dominantLanguage(plan.value);
    if (!lang || lang === localeId.value) return '';
    return t('Read in {v0}', { v0: getLocale(lang).nativeName });
});

const buttonLabel = computed(() => {
    if (mine.value && state.value === 'loading') return t('Preparing…');
    if (mine.value && state.value === 'playing') return t('Pause');
    if (mine.value && state.value === 'paused') return t('Resume');
    return t('Read this section');
});

const hint = computed(() => {
    if (!speakable.value) return t('There is nothing here to read aloud.');
    const bits = [t('{v0} min listen', { v0: minutesOf(estimateMs(plan.value)) })];
    if (spokenIn.value) bits.push(spokenIn.value);
    if (plan.value.skippedCode) bits.push(codeNote.value);
    return bits.join(' · ');
});

const codeNote = computed(() => {
    const n = plan.value.skippedCode;
    if (!n) return '';
    // Said rather than swallowed: a student can SEE the command on the screen,
    // so a voice that skips it without a word reads as the reader having
    // stopped. The commands are excluded because read aloud they are
    // unintelligible and, on a platform whose labs are shell and SQL, actively
    // misleading -- the same argument that pins every `<pre>` left-to-right.
    return n === 1
        ? t('Code is not read aloud')
        : t('{v0} code blocks are not read aloud', { v0: n });
});

const notes = computed(() => {
    const out: string[] = [];
    if (error.value) out.push(t('The voice service could not be reached. Reading stopped.'));
    if (spokenIn.value) out.push(spokenIn.value);
    if (codeNote.value) out.push(codeNote.value);
    if (voiceNote.value) out.push(voiceNote.value);
    return out;
});

/**
 * Pressing the button must be what PRIMES the audio.
 *
 * An `AudioContext` created outside a user gesture starts `suspended` and every
 * clip on it is silently ignored -- no error, no event, a section that reads in
 * complete silence. `useReader.read` calls `prime()` first for that reason, so
 * this handler must stay synchronous up to that call and must never be moved
 * behind an `await`.
 */
function press(): void {
    reader.toggle(props.id, () => plan.value);
}

/**
 * CHANGING LANGUAGE MID-READ STOPS THE READ.
 *
 * The text on screen is `$td(...)`, so switching the interface language
 * switches the document underneath the voice -- and a reader who is being read
 * an Arabic paragraph while the page has become Chinese has no idea what they
 * are listening to. Stopping is the honest answer; the next press builds a
 * fresh plan from whatever is now on the page.
 */
watch(localeId, () => { if (mine.value) reader.stop(); });

/**
 * `speechSynthesis` BELONGS TO THE WINDOW, NOT TO THIS COMPONENT.
 *
 * Without both of these the voice keeps reading the lesson over whatever page
 * the student opens next -- which the Newscast learned the same way, and which
 * is the single most alarming thing a page can do. Only stop if THIS section is
 * the one reading: another section's button unmounting must not silence it.
 */
onBeforeRouteLeave(() => { if (mine.value) reader.stop(); });
onBeforeUnmount(() => { if (mine.value) reader.stop(); });
</script>

<style scoped src="@/assets/css/read-aloud.css"></style>
