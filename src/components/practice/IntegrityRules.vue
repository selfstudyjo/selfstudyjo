<template>
  <div class="pr-rules" :class="`pr-rules--${context}`">
    <!-- ------------------------------------------------------------ -->
    <!-- The warning, first and unmissable                             -->
    <!-- ------------------------------------------------------------ -->
    <div v-if="fails" class="pr-rules__alarm" role="alert">
      <span class="pr-rules__alarmMark" aria-hidden="true">!</span>
      <div>
        <p class="pr-rules__alarmTitle">
          {{ $t('{v0} integrity breaches will end this sitting and score it zero', { v0: limit }) }}
        </p>
        <p class="pr-rules__alarmBody">
          {{ $t('This is an assessment, not a lab. Leaving the window, switching away with Alt+Tab, copying, pasting, printing or opening the developer tools is recorded, costs points, and counts as one of the {v0}. Reach {v0} and the paper is submitted for you, marked zero, and recorded as cheating.', { v0: limit }) }}
        </p>
      </div>
    </div>
    <div v-else class="pr-rules__calm">
      <p class="pr-rules__calmTitle">{{ $t('Nothing here can fail you') }}</p>
      <!--
        PER CONTEXT, out of `CALM_BODY`. Three of the five contexts are
        unfailable and the reason differs in each: a lab is a place to try
        things, an interview is rehearsal for one, and a meeting is a room you
        are practising being present in. One sentence over all three printed
        "Leaving the window to read the documentation is what a practitioner
        does" on a Toastmasters panel, which is talking about documentation
        nobody is reading.
      -->
      <p class="pr-rules__calmBody">{{ $t(calmBody) }}</p>
    </div>

    <!-- ------------------------------------------------------------ -->
    <!-- What earns, then what costs                                   -->
    <!-- ------------------------------------------------------------ -->
    <div class="pr-rules__cols">
      <section class="pr-rules__col">
        <h4 class="pr-rules__h">
          <span class="pr-rules__badge pr-rules__badge--good" aria-hidden="true">+</span>
          {{ $t('What earns points') }}
        </h4>
        <ul class="pr-rules__list">
          <li v-for="rule in earns" :key="rule.action" class="pr-rules__item is-good">
            <span class="pr-rules__pts">+{{ rule.points }}</span>
            <span class="pr-rules__text">
              <strong>{{ $t(rule.label) }}</strong>
              <span class="pr-rules__why">{{ $t(rule.why) }}</span>
            </span>
          </li>
          <li v-if="!earns.length" class="pr-rules__item">
            <span class="pr-rules__text">{{ $t('Nothing in this context earns conduct points.') }}</span>
          </li>
        </ul>
      </section>

      <section class="pr-rules__col">
        <h4 class="pr-rules__h">
          <span class="pr-rules__badge pr-rules__badge--bad" aria-hidden="true">−</span>
          {{ $t('What costs points') }}
        </h4>
        <ul class="pr-rules__list">
          <li v-for="rule in costs" :key="rule.action" class="pr-rules__item is-bad">
            <span class="pr-rules__pts">{{ rule.points }}</span>
            <span class="pr-rules__text">
              <strong>{{ $t(rule.label) }}</strong>
              <span class="pr-rules__why">{{ $t(rule.why) }}</span>
            </span>
          </li>
        </ul>
      </section>
    </div>

    <!-- ------------------------------------------------------------ -->
    <!-- The neutral ones, folded away                                 -->
    <!-- ------------------------------------------------------------ -->
    <details v-if="neutral.length" class="pr-rules__more">
      <summary>{{ $t('Also recorded, and worth nothing either way') }}</summary>
      <ul class="pr-rules__list">
        <li v-for="rule in neutral" :key="rule.action" class="pr-rules__item">
          <span class="pr-rules__pts pr-rules__pts--flat">0</span>
          <span class="pr-rules__text">
            <strong>{{ $t(rule.label) }}</strong>
            <span class="pr-rules__why">{{ $t(rule.why) }}</span>
          </span>
        </li>
      </ul>
    </details>

    <!--
      THE PUBLICITY NOTICE, and it is not boilerplate.

      Every one of these records is readable by anybody on the leaderboard's
      activity panel. That is what makes the deterrent work, and it is also the
      one thing a student is owed BEFORE they start rather than afterwards - a
      rule nobody was told about is a trap, however visible the record is later.
    -->
    <p class="pr-rules__public">
      {{ $t('Everything recorded here is public. Anybody can open your activity record on the leaderboard and see what you earned, what you lost and when. Nothing records an answer, a question, or what you copied — a copy is recorded as a number of characters and never as the text.') }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * What the practice ledger rewards and punishes, printed rather than assumed.
 *
 * ONE COMPONENT FOR ALL THREE CONTEXTS, because the alternative was three
 * copies of the same table - and a table of penalties that disagrees with the
 * penalties actually applied is worse than no table at all. The rows come from
 * `practiceIntegrity.rulesFor`, which reads the same catalogue the meter counts
 * with and which `npm run check:practice` asserts matches app 20's.
 *
 * WHY THE EXAM VERSION LEADS WITH AN ALARM AND THE LAB VERSION LEADS WITH
 * REASSURANCE
 *
 * They are different facts. In an exam the most important sentence is that five
 * breaches void the paper; in a lab the most important sentence is that nothing
 * can. A single neutral heading over both would leave a student in a lab
 * believing they were being invigilated, which is exactly the behaviour a lab
 * is meant to unteach - and would leave a candidate in an exam discovering the
 * limit at the fifth breach.
 */
import { computed } from 'vue';
import {
    CALM_BODY,
    FAILS_AT,
    rulesFor,
    type PracticeContext,
} from '@/utils/practiceIntegrity';

const props = defineProps<{ context: PracticeContext }>();

const limit = computed(() => FAILS_AT[props.context]);
// Falls back to the lab's wording rather than to an empty paragraph: a context
// added without copy should read as slightly-off reassurance, never as a
// reassurance panel with nothing in it.
const calmBody = computed(() => CALM_BODY[props.context] || CALM_BODY.lab);
const fails = computed(() => limit.value !== null);

/*
  `as any` on the rows, and it is worth explaining rather than hiding.

  `rulesFor` returns each spec with its own `action` key spliced in, so the
  template can use it as a `:key` - and the declared return type is `ActionSpec[]`
  because the action is an implementation detail of the ordering. Widening the
  type would put `action` on `ActionSpec` everywhere, where it is redundant with
  the map key. A cast at one call site is the smaller of the two.
*/
type Row = { action: string; points: number; label: string; why: string };

const earns = computed(() =>
    rulesFor(props.context, 'positive') as unknown as Row[]);
const costs = computed(() =>
    rulesFor(props.context, 'negative') as unknown as Row[]);
const neutral = computed(() =>
    rulesFor(props.context, 'neutral') as unknown as Row[]);
</script>

<style scoped>
/*
  SCOPED, unlike the leaderboard's sheets, and deliberately.

  This component styles nothing but its own elements - there is no child
  component whose internals it has to reach - so Vite can scope it and the
  question `check:cssleaks` asks about a globally loaded page stylesheet does
  not arise. Getting that wrong is how `verify-email.css`'s bare
  `.btn-primary { background: var(--ve-grad) }` left the LOGIN button with no
  fill at all in every galaxy.
*/

.pr-rules {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
}

/* ---------------- the headline ---------------- */

.pr-rules__alarm {
    display: flex;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    /* A WASH with a `-on-paper` ink, not the solid status hue with the page's
       own text on it. `--sfs-danger-text` is derived against a plain surface,
       and this is a tinted island - the pair below is the one the palette
       measures for exactly this arrangement, in all ten galaxies. */
    background: var(--sfs-danger-wash, rgba(248, 113, 113, 0.16));
    color: var(--sfs-danger-on-paper, #7f1d1d);
    border: 1px solid rgb(var(--sfs-danger-rgb, 248 113 113) / 0.5);
    border-radius: var(--sfs-radius-sm, 10px);
}

.pr-rules__alarmMark {
    flex: 0 0 auto;
    width: 1.6rem;
    height: 1.6rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-weight: 800;
    color: var(--sfs-on-danger, #ffffff);
    background: var(--sfs-danger, #f87171);
}

.pr-rules__alarmTitle {
    margin: 0 0 0.25rem;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.35;
}

.pr-rules__alarmBody,
.pr-rules__calmBody {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.55;
}

.pr-rules__calm {
    padding: 0.8rem 1rem;
    background: var(--sfs-success-wash, rgba(52, 211, 153, 0.14));
    color: var(--sfs-success-on-paper, #065f46);
    border: 1px solid rgb(var(--sfs-success-rgb, 52 211 153) / 0.4);
    border-radius: var(--sfs-radius-sm, 10px);
}

.pr-rules__calmTitle {
    margin: 0 0 0.25rem;
    font-size: 0.95rem;
    font-weight: 700;
}

/* ---------------- the two columns ---------------- */

.pr-rules__cols {
    display: grid;
    /* `min(100%, …)` rather than a bare `1fr`, so one long label cannot force
       its track wider than its share and overflow the card. */
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
    gap: 0.9rem;
}

.pr-rules__h {
    margin: 0 0 0.45rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--sfs-text-muted, #9aa3b8);
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.pr-rules__badge {
    width: 1.15rem;
    height: 1.15rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: 800;
    line-height: 1;
}

.pr-rules__badge--good {
    color: var(--sfs-on-success, #04231a);
    background: var(--sfs-success, #34d399);
}

.pr-rules__badge--bad {
    color: var(--sfs-on-danger, #ffffff);
    background: var(--sfs-danger, #f87171);
}

.pr-rules__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.pr-rules__item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.6rem;
    align-items: start;
    padding: 0.5rem 0.6rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09);
    border-radius: var(--sfs-radius-sm, 10px);
}

/* The inline border is what carries the good/bad distinction with no colour at
   all — in `forced-colors`, in greyscale, and for a reader who cannot separate
   the two hues. The sign in `.pr-rules__pts` carries it a second time. */
.pr-rules__item.is-good { border-inline-start: 3px solid var(--sfs-success, #34d399); }
.pr-rules__item.is-bad { border-inline-start: 3px solid var(--sfs-danger, #f87171); }

.pr-rules__pts {
    font-size: 0.85rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    /* A signed number inside prose that may be Arabic. Isolated so the bidi
       algorithm cannot move the sign away from its digits. */
    unicode-bidi: isolate;
    white-space: nowrap;
    min-width: 2.2rem;
    text-align: end;
}

.pr-rules__item.is-good .pr-rules__pts { color: var(--sfs-success-text, #34d399); }
.pr-rules__item.is-bad .pr-rules__pts { color: var(--sfs-danger-text, #f87171); }
.pr-rules__pts--flat { color: var(--sfs-text-faint, rgba(255, 255, 255, 0.45)); }

.pr-rules__text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.82rem;
}

.pr-rules__why {
    font-size: 0.74rem;
    line-height: 1.45;
    color: var(--sfs-text-muted, #9aa3b8);
}

/* ---------------- the fold and the notice ---------------- */

.pr-rules__more summary {
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--sfs-text-muted, #9aa3b8);
    padding: 0.35rem 0;
    min-height: max(2.2rem, 36px);
}

.pr-rules__more[open] summary { margin-bottom: 0.4rem; }

.pr-rules__public {
    margin: 0;
    padding: 0.65rem 0.8rem;
    font-size: 0.76rem;
    line-height: 1.55;
    color: var(--sfs-text-muted, #9aa3b8);
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.035);
    border: 1px dashed rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
    border-radius: var(--sfs-radius-sm, 10px);
}

@media (forced-colors: active) {
    .pr-rules__alarm,
    .pr-rules__calm,
    .pr-rules__item { border: 1px solid CanvasText !important; }
}
</style>
