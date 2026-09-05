<template>
  <section class="pl-score" :aria-label="$t('How lab points work')">
    <header class="pl-score__head">
      <h2 class="pl-score__title">{{ $t('How you earn points here') }}</h2>
      <p class="pl-score__lede">
        {{ $t('Every point on the public leaderboard comes from something this platform verified. Nothing here is awarded for turning up, and nothing here can be talked up: a task counts when the service looks at your environment and finds what the lab asked for.') }}
      </p>
    </header>

    <ol class="pl-score__rules">
      <li v-for="(rule, index) in rules" :key="index" class="pl-score__rule">
        <span class="pl-score__num" aria-hidden="true">{{ index + 1 }}</span>
        <span>{{ $t(rule.key, rule.params) }}</span>
      </li>
    </ol>

    <!--
      THE LAB'S OWN PROMISE, and it is the point of the whole panel.

      A student who has been shown an exam's five-strike rule will read a list
      of penalties in a lab as the same threat, and behave accordingly: they
      will stop leaving the window to read the documentation, which is the one
      habit a lab exists to build. So the reassurance is not a footnote, it is
      the heading of its own block.
    -->
    <div class="pl-score__safe">
      <h3 class="pl-score__safeTitle">{{ $t('Nothing in a lab can fail you') }}</h3>
      <p class="pl-score__safeBody">
        {{ $t('Leave the window, read the manual, ask the tutor, break the environment and reset it. Some of that costs points and none of it ends a lab, takes a verified task away from you, or counts against an exam. The five-breach rule is for exams and quizzes only, and it is on the screen before you start one.') }}
      </p>
    </div>

    <details class="pl-score__detail">
      <summary>{{ $t('The full table, and what is recorded') }}</summary>
      <IntegrityRules context="lab" />
    </details>

    <p class="pl-score__public">
      {{ $t('Your record is public. Anybody can open it from the leaderboard and see every task you finished, every lab you are in the middle of, and every point earned or lost — with the time it happened.') }}
      <router-link to="/leaderboard" class="pl-score__link">
        {{ $t('See the leaderboard') }}
      </router-link>
    </p>
  </section>
</template>

<script setup lang="ts">
/**
 * How a lab earns points, printed on the page that earns them.
 *
 * The rows are `practiceIntegrity.labEarningRules()`, which is where they can
 * be checked: `npm run check:practice` asserts every number in them against
 * `ACTIONS` and against the leaderboard's own `POINTS`, because the failure
 * worth catching is a page that promises ten points for something worth three.
 * A page that promises nothing is better than a page that promises wrongly -
 * the second one is what makes a scoring system look rigged.
 */
import IntegrityRules from '@/components/practice/IntegrityRules.vue';
import { labEarningRules } from '@/utils/practiceIntegrity';

const rules = labEarningRules();
</script>

<style scoped>
.pl-score {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: clamp(0.9rem, 2.5vw, 1.4rem);
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
    border-radius: var(--sfs-radius-lg, 18px);
}

.pl-score__head { display: flex; flex-direction: column; gap: 0.35rem; }

.pl-score__title {
    margin: 0;
    font-size: clamp(1rem, 2.2vw, 1.25rem);
    /* `text-wrap: balance` for the reason ui.css applies it to every heading: a
       heading with one orphan word on the second line is the commonest thing
       that makes a careful layout look careless, and it happens constantly in
       Arabic and Chinese where the same sentence is a different length. */
    text-wrap: balance;
}

.pl-score__lede {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--sfs-text-muted, #9aa3b8);
    max-width: 78ch;
}

.pl-score__rules {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    /* `min(100%, …)` rather than a bare `1fr`: a `1fr` track's automatic
       minimum is `min-content`, so one long sentence would force its track
       wider than its share and overflow the card. */
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
    gap: 0.45rem;
}

.pl-score__rule {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.55rem;
    align-items: start;
    font-size: 0.82rem;
    line-height: 1.5;
    padding: 0.5rem 0.6rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09);
    border-radius: var(--sfs-radius-sm, 10px);
}

.pl-score__num {
    width: 1.4rem;
    height: 1.4rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--sfs-on-accent, #ffffff);
    background: var(--sfs-accent, #667eea);
    /* A number in a badge, isolated so it cannot be reordered against the
       prose beside it on an Arabic page. */
    unicode-bidi: isolate;
}

.pl-score__safe {
    padding: 0.8rem 0.95rem;
    /* A WASH with a `-on-paper` ink, not the solid hue with the page's own text
       on it: `--sfs-success-text` is derived against a plain surface and this
       is a tinted island. */
    background: var(--sfs-success-wash, rgba(52, 211, 153, 0.14));
    color: var(--sfs-success-on-paper, #065f46);
    border: 1px solid rgb(var(--sfs-success-rgb, 52 211 153) / 0.4);
    border-radius: var(--sfs-radius-sm, 10px);
}

.pl-score__safeTitle {
    margin: 0 0 0.25rem;
    font-size: 0.95rem;
    font-weight: 700;
    text-wrap: balance;
}

.pl-score__safeBody {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.6;
}

.pl-score__detail summary {
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--sfs-accent-text, #a5b4fc);
    padding: 0.4rem 0;
    min-height: max(2.2rem, 36px);
}

.pl-score__detail[open] summary { margin-bottom: 0.6rem; }

.pl-score__public {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.55;
    color: var(--sfs-text-muted, #9aa3b8);
}

.pl-score__link {
    color: var(--sfs-accent-text, #a5b4fc);
    font-weight: 600;
}

@media (forced-colors: active) {
    .pl-score,
    .pl-score__rule,
    .pl-score__safe { border: 1px solid CanvasText !important; }
}
</style>
