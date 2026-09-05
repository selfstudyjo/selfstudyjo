<template>
  <div class="pr-meter" :class="`is-${band}`">
    <div class="pr-meter__head">
      <h3 class="pr-meter__title">
        {{ fails ? $t('Exam integrity') : $t('Practice record') }}
      </h3>
      <span class="pr-meter__points" :class="pointsClass">{{ signed(verdict.points) }}</span>
    </div>

    <!--
      THE STRIKE PIPS, and they are pips rather than a bar on purpose.

      Five is a countable number and the question a candidate is asking is "how
      many have I got left", which a discrete row answers at a glance and a
      continuous bar does not. A bar at 80% needs arithmetic; four filled boxes
      out of five does not.
    -->
    <div
      v-if="fails"
      class="pr-meter__pips"
      role="meter"
      :aria-valuenow="verdict.negatives"
      aria-valuemin="0"
      :aria-valuemax="verdict.limit ?? 5"
      :aria-label="$t('{v0} of {v1} integrity breaches recorded', { v0: verdict.negatives, v1: verdict.limit })"
    >
      <span
        v-for="index in (verdict.limit ?? 5)"
        :key="index"
        class="pr-meter__pip"
        :class="{ 'is-used': index <= verdict.negatives }"
        aria-hidden="true"
      ></span>
    </div>

    <p class="pr-meter__say" role="status">{{ $t(message.key, message.params) }}</p>

    <!--
      The recorded actions, newest first, with the time.

      Shown to the candidate WHILE the paper is open rather than only afterwards,
      because a penalty somebody cannot see is a penalty they cannot stop
      collecting - and because the alternative is a zero at the end with no
      explanation, which is the failure that makes an integrity system feel
      arbitrary rather than fair.
    -->
    <ul v-if="events.length" class="pr-meter__log">
      <li
        v-for="event in shown"
        :key="event.id"
        class="pr-meter__logRow"
        :class="`is-${event.severity}`"
      >
        <span class="pr-meter__logPts">{{ event.points === 0 ? '·' : signed(event.points) }}</span>
        <span class="pr-meter__logText">
          <strong>{{ $t(event.label) }}</strong>
          <span class="pr-meter__logWhen">{{ clock(event.at) }}</span>
        </span>
      </li>
    </ul>
    <p v-else class="pr-meter__none">
      {{ fails ? $t('Nothing recorded. Keep the paper in front of you and it stays that way.')
               : $t('Nothing recorded yet.') }}
    </p>

    <p v-if="events.length > SHOWN" class="pr-meter__foot">
      {{ $t('and {v0} more, all of them on your activity record', { v0: events.length - SHOWN }) }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * What this sitting has collected, while it is still happening.
 *
 * Drawn from the recorder's own verdict, which is the LOCAL count settled
 * against the server's - see `PracticeRecorder.verdict`. It has to be local to
 * be immediate: a candidate who alt-tabs and sees nothing change for two
 * seconds has just learnt that alt-tab is free, and the deterrent is the whole
 * point.
 *
 * The component decides nothing. The bands, the wording and the arithmetic are
 * `practiceIntegrity.ts`'s, where `npm run check:practice` drives them.
 */
import { computed } from 'vue';
import {
    FAILS_AT,
    bandOf,
    strikeMessage,
    type PracticeContext,
    type Verdict,
} from '@/utils/practiceIntegrity';

export interface MeterEvent {
    id: string;
    label: string;
    points: number;
    severity: 'positive' | 'negative' | 'neutral';
    at: number;
}

const props = defineProps<{
    context: PracticeContext;
    verdict: Verdict;
    events: readonly MeterEvent[];
}>();

/** How many log lines fit before the panel starts owning the screen. */
const SHOWN = 6;

const fails = computed(() => FAILS_AT[props.context] !== null);
const band = computed(() => bandOf(props.verdict));
const message = computed(() => strikeMessage(props.verdict));
const shown = computed(() => props.events.slice(0, SHOWN));

const pointsClass = computed(() => props.verdict.points > 0 ? 'is-up'
    : props.verdict.points < 0 ? 'is-down' : 'is-flat');

/**
 * A signed number with a MINUS SIGN rather than a hyphen.
 *
 * U+2212, because a hyphen is bidi-neutral: inside Arabic prose the algorithm
 * is free to move it away from its digits, so "-4" renders as "4-" and reads as
 * a footnote marker.
 */
function signed(value: number): string {
    if (!Number.isFinite(value) || value === 0) return '0';
    return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/**
 * The wall clock, not "3 minutes ago".
 *
 * A relative time is right on the leaderboard's feed, where everything is days
 * old. Here everything is minutes old, so a relative time reads as a stopwatch
 * that keeps changing - and the useful question is "when in the paper did this
 * happen", which a clock answers and a countdown does not. Formatted through
 * `Intl`, so an Arabic reader gets their own meridiem.
 */
function clock(at: number): string {
    if (!Number.isFinite(at) || at <= 0) return '';
    return new Date(at).toLocaleTimeString(undefined,
                                           { hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.pr-meter {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.85rem 0.95rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
    border-radius: var(--sfs-radius-sm, 10px);
}

/*
  The band changes the BORDER and never only a colour.

  `critical` and `failed` also get a heavier edge, so the escalation survives
  greyscale and `forced-colors` - and the sentence in `.pr-meter__say` says the
  same thing in words, which is the carrier that always works.
*/
.pr-meter.is-warned { border-color: rgb(var(--sfs-warning-rgb, 251 191 36) / 0.45); }

.pr-meter.is-critical {
    border-color: var(--sfs-danger, #f87171);
    border-width: 2px;
    background: var(--sfs-danger-wash, rgba(248, 113, 113, 0.14));
    color: var(--sfs-danger-on-paper, #7f1d1d);
}

.pr-meter.is-failed {
    border-color: var(--sfs-danger, #f87171);
    border-width: 2px;
    background: var(--sfs-danger-wash, rgba(248, 113, 113, 0.2));
    color: var(--sfs-danger-on-paper, #7f1d1d);
}

.pr-meter__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
}

.pr-meter__title {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.pr-meter__points {
    font-size: 1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
}

.pr-meter__points.is-up { color: var(--sfs-success-text, #34d399); }
.pr-meter__points.is-down { color: var(--sfs-danger-text, #f87171); }
.pr-meter__points.is-flat { color: var(--sfs-text-muted, #9aa3b8); }

/* The pip row is a place, not a paragraph: pinned left-to-right in both
   directions so "how many are left" reads from the same end whichever language
   the interface is in. Same rule `rtl.css` follows for the score ring. */
.pr-meter__pips {
    display: flex;
    gap: 0.3rem;
    direction: ltr;
}

.pr-meter__pip {
    flex: 1 1 0;
    height: 0.5rem;
    border-radius: var(--sfs-radius-pill, 999px);
    background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.28);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
}

.pr-meter__pip.is-used {
    background: var(--sfs-danger, #f87171);
    border-color: var(--sfs-danger, #f87171);
}

.pr-meter__say {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.5;
    font-weight: 600;
}

.pr-meter__log {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.pr-meter__logRow {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.5rem;
    align-items: baseline;
    font-size: 0.76rem;
    padding: 0.3rem 0.4rem;
    border-radius: 6px;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04);
}

.pr-meter__logRow.is-negative { border-inline-start: 3px solid var(--sfs-danger, #f87171); }
.pr-meter__logRow.is-positive { border-inline-start: 3px solid var(--sfs-success, #34d399); }

.pr-meter__logPts {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
    min-width: 1.9rem;
    text-align: end;
}

.pr-meter__logRow.is-negative .pr-meter__logPts { color: var(--sfs-danger-text, #f87171); }
.pr-meter__logRow.is-positive .pr-meter__logPts { color: var(--sfs-success-text, #34d399); }

.pr-meter__logText {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: baseline;
}

.pr-meter__logWhen {
    font-size: 0.7rem;
    color: var(--sfs-text-muted, #9aa3b8);
    /* A clock reading is a machine identifier inside prose that may be Arabic,
       where a colon is bidi-neutral and gets relocated. */
    unicode-bidi: isolate;
}

.pr-meter__none,
.pr-meter__foot {
    margin: 0;
    font-size: 0.74rem;
    line-height: 1.45;
    color: var(--sfs-text-muted, #9aa3b8);
}

@media (forced-colors: active) {
    .pr-meter,
    .pr-meter__pip { border: 1px solid CanvasText !important; }
    .pr-meter__pip.is-used { forced-color-adjust: none; }
}
</style>
