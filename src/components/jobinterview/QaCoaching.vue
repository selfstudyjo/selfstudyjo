<template>
  <div class="ji-qa-item">
    <div class="ji-qa-q">
      Q{{ index + 1 }}. {{ qa.question }}
      <span v-if="rating !== null" class="ji-qa-rating" :class="ratingClass">{{ rating }}/10</span>
    </div>

    <div class="ji-qa-a">
      <span class="ji-qa-a-label">{{ $t('🗣️ Your answer:') }}</span>
      {{ qa.answer || '(no answer captured)' }}
      <span class="ji-qa-secs" v-if="qa.seconds">· {{ qa.seconds }}s</span>
    </div>

    <!--
      Coaching is written DURING the interview, one question at a time, so a
      question can legitimately be on screen with nothing under it yet. Saying so
      is the difference between a report that is filling in and one that looks
      like the AI failed -- which is exactly what this whole change is about.
    -->
    <div class="ji-qa-note ji-qa-pending" v-if="pending">
      <span class="ji-qa-note-label">{{ $t('⏳ Coaching this answer…') }}</span>
      {{ $t('The coach is writing feedback for this question now. It will appear here.') }}
    </div>

    <template v-else>
      <!-- What the candidate actually said. First, because it is the only part
           of the report that is about them; the model answer is the same for
           anybody who was asked this question. -->
      <div class="ji-qa-note ji-qa-feedback" v-if="coaching.feedback">
        <span class="ji-qa-note-label">{{ $t('📌 Feedback on your answer') }}</span>
        {{ coaching.feedback }}
      </div>

      <!--
        Their own answer, rewritten. The most useful thing in the report and the
        one thing a model answer cannot do: it keeps their projects and their
        numbers and fixes only the telling, so what they read back is something
        they could actually have said.
      -->
      <div class="ji-qa-improved" v-if="coaching.improved_answer">
        <span class="ji-qa-improved-label">{{ $t('✨ Your answer, made stronger') }}</span>
        {{ coaching.improved_answer }}
      </div>

      <!--
        A SHORT model answer, in the first person, to rehearse.

        This block used to be followed by "✅ What a strong answer must include"
        and four bullets of the same advice in note form -- and with the AI
        unreachable both were generic, so every question in the report carried
        the same paragraph and the same checklist. A candidate cannot rehearse a
        checklist. The checklist is gone; what is here is a sentence or three
        they can say out loud.
      -->
      <div class="ji-qa-model" v-if="coaching.model_answer">
        <span class="ji-qa-model-label">
          {{ coaching.generic ? '🧭 How to answer this kind of question' : '⭐ A strong answer, short' }}
        </span>
        {{ coaching.model_answer }}
        <!-- A stand-in has to say it is one. Passing structural advice off as a
             tailored model answer is what made every question in this report
             look like it had the same answer. -->
        <span class="ji-qa-generic-note" v-if="coaching.generic">
          {{ $t('The AI coach could not be reached for this question, so this is the shape a strong answer has rather than one written for you. Re-running the interview when the service is back produces a tailored answer and feedback on what you actually said.') }}
        </span>
      </div>

      <div class="ji-qa-note ji-qa-fix" v-if="coaching.fix">
        <span class="ji-qa-note-label">{{ $t('🔧 The one thing to change') }}</span>
        {{ coaching.fix }}
      </div>

      <div class="ji-qa-note ji-qa-why" v-if="coaching.why">
        <span class="ji-qa-note-label">{{ $t('🎯 Why they ask this') }}</span>
        {{ coaching.why }}
      </div>

      <!--
        Only for records written before 2026-08-22, which stored it. Not
        requested any more and not produced by the fallback, but a report the
        candidate has already read must not lose a section when they open it
        again -- so it renders, folded, rather than disappearing.
      -->
      <details class="ji-qa-legacy" v-if="keyPoints.length">
        <summary>{{ $t('Checklist saved with this answer') }}</summary>
        <ul><li v-for="(point, i) in keyPoints" :key="i">{{ point }}</li></ul>
      </details>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * One question in an interview report: what was asked, what the candidate said,
 * and everything the coach had to say about it.
 *
 * One component rather than a block in each of the two report screens. They
 * show the same thing and a copy in each is a copy that drifts -- the session
 * report is seen once, the results modal is where somebody actually studies,
 * and the one that gets improved would not be the one being read.
 *
 * It renders three generations of record: one written today, one written
 * between 2026-08-20 and 2026-08-22 (a checklist and a long structural "model
 * answer"), and one older than that, carrying `model_answer` as a bare string
 * and nothing else. The oldest collapses to exactly what it always showed.
 */
import { computed } from 'vue';
import type { QACoaching, QAPair } from '@/services/jobinterview.service';

const props = defineProps<{ qa: QAPair; index: number }>();

/**
 * The coaching, however it was stored.
 *
 * An old record has `model_answer` and no `coaching`; a record written today
 * has both. Normalising here is what keeps the template free of the history.
 */
const coaching = computed<QACoaching>(() => {
    const stored = props.qa.coaching;
    if (stored && (stored.model_answer || stored.feedback || stored.why)) return stored;
    return { model_answer: props.qa.model_answer || '' };
});

/**
 * True while this answer's coaching call is still out.
 *
 * Only ever true during a live interview. A stored record with the flag left on
 * -- a session saved between the answer and the coaching landing -- must not
 * show a spinner for ever, so having no coaching at all is what actually
 * decides it.
 */
const pending = computed(() =>
    !!props.qa.coaching_pending && !props.qa.coaching && !props.qa.model_answer);

const keyPoints = computed(() =>
    (coaching.value.key_points || []).filter(p => String(p || '').trim()));

const rating = computed(() => {
    const value = coaching.value.rating;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
});

// Banded rather than a gradient: the three bands are what a candidate acts on,
// and a 6 and a 7 should not look like different outcomes.
const ratingClass = computed(() => {
    const value = rating.value ?? 0;
    return value >= 8 ? 'good' : value >= 5 ? 'mid' : 'low';
});
</script>
