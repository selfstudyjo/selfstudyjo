<template>
  <div class="ji-qa-item">
    <div class="ji-qa-q">
      Q{{ index + 1 }}. {{ qa.question }}
      <span v-if="rating !== null" class="ji-qa-rating" :class="ratingClass">{{ rating }}/10</span>
    </div>

    <div class="ji-qa-a">
      <span class="ji-qa-a-label">🗣️ Your answer:</span>
      {{ qa.answer || '(no answer captured)' }}
    </div>

    <!-- What the candidate actually said. First, because it is the only part of
         the report that is about them; the model answer is the same for anybody
         who was asked this question. -->
    <div class="ji-qa-note ji-qa-feedback" v-if="coaching.feedback">
      <span class="ji-qa-note-label">📌 Feedback on your answer</span>
      {{ coaching.feedback }}
    </div>

    <div class="ji-qa-model" v-if="coaching.model_answer">
      <span class="ji-qa-model-label">
        {{ coaching.generic ? '🧭 How to answer this kind of question' : '⭐ A strong answer sounds like this' }}
      </span>
      {{ coaching.model_answer }}
      <!-- A stand-in has to say it is one. Passing structural advice off as a
           tailored model answer is what made every question in this report look
           like it had the same answer. -->
      <span class="ji-qa-generic-note" v-if="coaching.generic">
        The AI coach could not be reached for this question, so this is the structure a strong
        answer needs rather than a model answer written for you. Re-running the interview when
        the service is back will produce a tailored one.
      </span>
    </div>

    <div class="ji-qa-note ji-qa-points" v-if="keyPoints.length">
      <span class="ji-qa-note-label">✅ What a strong answer must include</span>
      <ul>
        <li v-for="(point, i) in keyPoints" :key="i">{{ point }}</li>
      </ul>
    </div>

    <div class="ji-qa-note ji-qa-why" v-if="coaching.why">
      <span class="ji-qa-note-label">🎯 Why they ask this</span>
      {{ coaching.why }}
    </div>
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
 * It renders sessions recorded before the coaching existed too: those carry
 * `model_answer` as a bare string and nothing else, so the block collapses to
 * exactly what it always showed.
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
