<template>
  <div class="ns-lesson-panel">
    <div v-if="!lesson" class="ns-lesson-empty">
      <DeviceIcon name="book" :size="30" />
      <h4>No lesson attached</h4>
      <p>Pick a lesson from the Learn hub and the studio will check your work against the live network as you build it.</p>
      <router-link class="ns-btn primary sm" to="/network-simulator/learn">Browse the curriculum</router-link>
    </div>

    <template v-else>
      <header class="ns-lesson-head">
        <div>
          <span class="ns-lesson-track">{{ trackTitle }}</span>
          <h4>{{ lesson.title }}</h4>
          <p>{{ lesson.subtitle }}</p>
        </div>
        <div class="ns-lesson-score" :class="{ done: store.lessonScore >= 100 }">
          {{ store.lessonScore }}<em>%</em>
        </div>
      </header>

      <div class="ns-lesson-meta">
        <span>{{ lesson.minutes }} min</span>
        <span>{{ lesson.difficulty }}</span>
        <span>Layers {{ lesson.layers.join(', ') }}</span>
      </div>

      <nav class="ns-subtabs">
        <button :class="['ns-subtab', { active: view === 'tasks' }]" @click="view = 'tasks'">Tasks</button>
        <button :class="['ns-subtab', { active: view === 'theory' }]" @click="view = 'theory'">Theory</button>
        <button v-if="lesson.commands?.length" :class="['ns-subtab', { active: view === 'commands' }]" @click="view = 'commands'">Commands</button>
        <button v-if="lesson.quiz?.length" :class="['ns-subtab', { active: view === 'quiz' }]" @click="view = 'quiz'">Quiz</button>
      </nav>

      <!-- ── tasks ── -->
      <div v-if="view === 'tasks'" class="ns-lesson-body">
        <button class="ns-btn primary block" @click="store.checkLesson()">
          <DeviceIcon name="check" :size="15" /> Check my work
        </button>

        <ol class="ns-task-list">
          <li v-for="t in lesson.tasks" :key="t.id" :class="{ done: resultFor(t.id)?.ok, failed: resultFor(t.id) && !resultFor(t.id)!.ok }">
            <span class="ns-task-mark">
              <DeviceIcon v-if="resultFor(t.id)?.ok" name="check" :size="12" />
              <template v-else>·</template>
            </span>
            <div>
              <p class="ns-task-text">{{ t.text }}</p>
              <p v-if="resultFor(t.id)" class="ns-task-msg">{{ resultFor(t.id)!.message }}</p>
              <p v-if="t.hint && !resultFor(t.id)?.ok" class="ns-task-hint">Hint: {{ t.hint }}</p>
            </div>
          </li>
        </ol>

        <div v-if="lesson.starterTemplateId" class="ns-btn-row tight">
          <button class="ns-btn ghost sm" @click="loadStarter">
            <DeviceIcon name="grid" :size="13" /> Load the starter topology
          </button>
        </div>

        <div v-if="store.lessonScore >= 100" class="ns-lesson-done">
          <DeviceIcon name="award" :size="20" />
          <div>
            <strong>Lesson complete</strong>
            <p>Every task was verified against your running network — not a multiple-choice answer.</p>
            <button v-if="next" class="ns-btn primary sm" @click="goNext">Next: {{ next.title }}</button>
          </div>
        </div>
      </div>

      <!-- ── theory ── -->
      <div v-else-if="view === 'theory'" class="ns-lesson-body">
        <ul class="ns-objectives">
          <li v-for="(o, i) in lesson.objectives" :key="i">{{ o }}</li>
        </ul>
        <div class="ns-theory" v-html="renderMd(lesson.theory)"></div>
        <div class="ns-terms">
          <h5>Key terms</h5>
          <dl>
            <template v-for="k in lesson.keyTerms" :key="k.term">
              <dt>{{ k.term }}</dt><dd>{{ k.meaning }}</dd>
            </template>
          </dl>
        </div>
      </div>

      <!-- ── commands ── -->
      <div v-else-if="view === 'commands'" class="ns-lesson-body">
        <div v-for="(c, i) in lesson.commands || []" :key="i" class="ns-cmd">
          <code>{{ c.cmd }}</code>
          <p>{{ c.explain }}</p>
        </div>
      </div>

      <!-- ── quiz ── -->
      <div v-else class="ns-lesson-body">
        <div v-for="(q, qi) in lesson.quiz || []" :key="qi" class="ns-quiz-q">
          <p class="ns-quiz-text">{{ qi + 1 }}. {{ q.q }}</p>
          <button
            v-for="(o, oi) in q.options" :key="oi"
            class="ns-quiz-option"
            :class="{
              chosen: answers[qi] === oi,
              correct: answers[qi] !== undefined && oi === q.answer,
              wrong: answers[qi] === oi && oi !== q.answer,
            }"
            :disabled="answers[qi] !== undefined"
            @click="answers[qi] = oi"
          >{{ o }}</button>
          <p v-if="answers[qi] !== undefined" class="ns-quiz-why">{{ q.why }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import DeviceIcon from './DeviceIcon.vue';
import { useNetSimStore } from '@/store/netsim';
import { getLesson, nextLesson, TRACKS } from '@/netsim/lessons';
import { marked } from 'marked';

const store = useNetSimStore();
const router = useRouter();
const view = ref<'tasks' | 'theory' | 'commands' | 'quiz'>('tasks');
const answers = ref<Record<number, number>>({});

const lesson = computed(() => (store.activeLessonId ? getLesson(store.activeLessonId) : undefined));
const next = computed(() => (lesson.value ? nextLesson(lesson.value.id) : undefined));
const trackTitle = computed(() => TRACKS.find(t => t.id === lesson.value?.trackId)?.title || '');

watch(() => lesson.value?.id, () => { answers.value = {}; view.value = 'tasks'; });

function resultFor(id: string) {
    return store.lessonResults.find(r => r.id === id);
}

function renderMd(text: string): string {
    try { return marked.parse(text) as string; } catch { return text; }
}

function loadStarter() {
    if (lesson.value?.starterTemplateId) store.loadTemplate(lesson.value.starterTemplateId);
}

function goNext() {
    if (!next.value) return;
    store.setActiveLesson(next.value.id);
    if (next.value.starterTemplateId) store.loadTemplate(next.value.starterTemplateId);
    view.value = 'theory';
    router.replace({ query: { lesson: next.value.id } }).catch(() => undefined);
}
</script>
