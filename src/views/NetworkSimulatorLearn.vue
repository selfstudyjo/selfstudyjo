<template>
  <div class="netsim-learn">
    <header class="ns-learn-hero">
      <div>
        <router-link class="ns-back-link" to="/network-simulator">← Network Simulator</router-link>
        <h1>Learn networking by building it</h1>
        <p>
          {{ TOTAL_LESSONS }} lessons across {{ TRACKS.length }} tracks, roughly {{ Math.round(TOTAL_MINUTES / 60) }} hours of
          work. Every task is checked against your live simulated network — not against a multiple-choice answer.
        </p>
      </div>
      <div v-if="progress" class="ns-learn-progress">
        <div class="ns-ring lg" :style="{ '--pct': completionPct }"><span>{{ completionPct }}%</span></div>
        <div>
          <strong>{{ progress.completedLessons.length }} / {{ TOTAL_LESSONS }}</strong>
          <p>{{ progress.xp }} XP · {{ progress.badges.length }} badges</p>
        </div>
      </div>
    </header>

    <div class="ns-learn-layout">
      <!-- ════════════ track rail ════════════ -->
      <nav class="ns-track-rail">
        <button
          v-for="t in TRACKS" :key="t.id"
          class="ns-track-btn"
          :class="{ active: activeTrack === t.id, done: trackComplete(t.id) }"
          :style="{ '--accent': t.accent }"
          @click="activeTrack = t.id"
        >
          <span class="ns-track-icon"><DeviceIcon :name="t.icon" :size="18" /></span>
          <span class="ns-track-label">
            <strong>{{ t.title }}</strong>
            <em>{{ trackDone(t.id) }}/{{ lessonsByTrack(t.id).length }} · {{ t.subtitle }}</em>
          </span>
        </button>
      </nav>

      <!-- ════════════ lessons ════════════ -->
      <main class="ns-lesson-main">
        <section v-if="track" class="ns-track-intro" :style="{ '--accent': track.accent }">
          <h2><DeviceIcon :name="track.icon" :size="20" /> {{ track.title }}</h2>
          <p>{{ track.description }}</p>
        </section>

        <div class="ns-lesson-cards">
          <article
            v-for="l in trackLessons" :key="l.id"
            class="ns-lesson-card"
            :class="{ done: isDone(l.id), open: expanded === l.id }"
          >
            <header @click="expanded = expanded === l.id ? '' : l.id">
              <span class="ns-lesson-num">{{ l.order }}</span>
              <div class="ns-lesson-title">
                <h3>{{ l.title }}</h3>
                <p>{{ l.subtitle }}</p>
              </div>
              <div class="ns-lesson-tags">
                <em class="ns-diff" :class="l.difficulty">{{ l.difficulty }}</em>
                <em>{{ l.minutes }} min</em>
                <em v-for="ly in l.layers" :key="ly" class="ns-layer-pill" :style="{ background: layerColor(ly) + '22', color: layerColor(ly) }">L{{ ly }}</em>
              </div>
              <span v-if="isDone(l.id)" class="ns-lesson-check"><DeviceIcon name="check" :size="14" /></span>
              <span v-else-if="scoreOf(l.id)" class="ns-lesson-score-sm">{{ scoreOf(l.id) }}%</span>
            </header>

            <div v-show="expanded === l.id" class="ns-lesson-detail">
              <div class="ns-lesson-cols">
                <div class="ns-lesson-col">
                  <h5>You will be able to</h5>
                  <ul class="ns-objectives">
                    <li v-for="(o, i) in l.objectives" :key="i">{{ o }}</li>
                  </ul>

                  <h5>Tasks checked in the studio</h5>
                  <ol class="ns-task-preview">
                    <li v-for="t in l.tasks" :key="t.id">{{ t.text }}</li>
                  </ol>

                  <div class="ns-btn-row">
                    <button class="ns-btn primary" @click="startLesson(l)">
                      <DeviceIcon name="play" :size="15" /> {{ isDone(l.id) ? 'Do it again' : 'Start in the studio' }}
                    </button>
                    <button class="ns-btn ghost" @click="readMode = readMode === l.id ? '' : l.id">
                      <DeviceIcon name="book" :size="15" /> {{ readMode === l.id ? 'Hide theory' : 'Read the theory' }}
                    </button>
                  </div>
                </div>

                <aside class="ns-lesson-col terms">
                  <h5>Key terms</h5>
                  <dl>
                    <template v-for="k in l.keyTerms" :key="k.term">
                      <dt>{{ k.term }}</dt><dd>{{ k.meaning }}</dd>
                    </template>
                  </dl>
                </aside>
              </div>

              <div v-if="readMode === l.id" class="ns-theory-block">
                <div class="ns-theory" v-html="renderMd(l.theory)"></div>

                <div v-if="l.quiz?.length" class="ns-quiz">
                  <h5>Check your understanding</h5>
                  <div v-for="(q, qi) in l.quiz" :key="qi" class="ns-quiz-q">
                    <p class="ns-quiz-text">{{ qi + 1 }}. {{ q.q }}</p>
                    <button
                      v-for="(o, oi) in q.options" :key="oi"
                      class="ns-quiz-option"
                      :class="{
                        chosen: answerKey(l.id, qi) === oi,
                        correct: answerKey(l.id, qi) !== undefined && oi === q.answer,
                        wrong: answerKey(l.id, qi) === oi && oi !== q.answer,
                      }"
                      :disabled="answerKey(l.id, qi) !== undefined"
                      @click="answer(l.id, qi, oi)"
                    >{{ o }}</button>
                    <p v-if="answerKey(l.id, qi) !== undefined" class="ns-quiz-why">{{ q.why }}</p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>

        <!-- ════════════ AI quiz generator ════════════ -->
        <section class="ns-ai-quiz">
          <div class="ns-section-head">
            <h2><DeviceIcon name="sparkles" :size="18" /> Practice questions on any topic</h2>
            <p class="ns-section-sub">The AI tutor writes exam-style questions and explains every answer.</p>
          </div>
          <div class="ns-btn-row">
            <input v-model="quizTopic" class="ns-inline-input grow" placeholder="e.g. VLSM, trunking, OSPF cost, NAT overload" @keydown.enter="makeQuiz" />
            <button class="ns-btn primary sm" :disabled="quizBusy || !quizTopic.trim()" @click="makeQuiz">
              {{ quizBusy ? 'Writing…' : 'Generate 5 questions' }}
            </button>
          </div>
          <div v-if="aiQuiz.length" class="ns-quiz">
            <div v-for="(q, qi) in aiQuiz" :key="qi" class="ns-quiz-q">
              <p class="ns-quiz-text">{{ qi + 1 }}. {{ q.q }}</p>
              <button
                v-for="(o, oi) in q.options" :key="oi"
                class="ns-quiz-option"
                :class="{
                  chosen: aiAnswers[qi] === oi,
                  correct: aiAnswers[qi] !== undefined && oi === q.answer,
                  wrong: aiAnswers[qi] === oi && oi !== q.answer,
                }"
                :disabled="aiAnswers[qi] !== undefined"
                @click="aiAnswers[qi] = oi"
              >{{ o }}</button>
              <p v-if="aiAnswers[qi] !== undefined" class="ns-quiz-why">{{ q.why }}</p>
            </div>
          </div>
        </section>
      </main>
    </div>

    <div class="ns-toasts">
      <div v-for="t in store.toasts" :key="t.id" class="ns-toast" :class="t.kind" @click="store.dismissToast(t.id)">
        <DeviceIcon :name="t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'" :size="15" />
        <div><strong>{{ t.title }}</strong><p v-if="t.message">{{ t.message }}</p></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import DeviceIcon from '@/components/netsim/DeviceIcon.vue';
import { useNetSimStore } from '@/store/netsim';
import { TRACKS, lessonsByTrack, TOTAL_LESSONS, TOTAL_MINUTES } from '@/netsim/lessons';
import { netsimAi } from '@/services/netsim-ai.service';
import { OSI_LAYERS } from '@/netsim/types';
import type { Lesson, LayerId } from '@/netsim/types';
import { marked } from 'marked';

const store = useNetSimStore();
const router = useRouter();

const activeTrack = ref(TRACKS[0].id);
const expanded = ref('');
const readMode = ref('');
const answers = ref<Record<string, Record<number, number>>>({});

const quizTopic = ref('');
const quizBusy = ref(false);
const aiQuiz = ref<Array<{ q: string; options: string[]; answer: number; why: string }>>([]);
const aiAnswers = ref<Record<number, number>>({});

const progress = computed(() => store.progress);
const track = computed(() => TRACKS.find(t => t.id === activeTrack.value));
const trackLessons = computed(() => lessonsByTrack(activeTrack.value));

const completionPct = computed(() =>
    progress.value ? Math.round((progress.value.completedLessons.length / Math.max(1, TOTAL_LESSONS)) * 100) : 0);

onMounted(async () => {
    await store.loadProfileAndProgress();
    // Jump to the first unfinished track.
    const firstOpen = TRACKS.find(t => !trackComplete(t.id));
    if (firstOpen) activeTrack.value = firstOpen.id;
});

function isDone(id: string): boolean {
    return !!progress.value?.completedLessons.includes(id);
}
function scoreOf(id: string): number {
    return progress.value?.lessonScores[id]?.score || 0;
}
function trackDone(trackId: string): number {
    return lessonsByTrack(trackId).filter(l => isDone(l.id)).length;
}
function trackComplete(trackId: string): boolean {
    const list = lessonsByTrack(trackId);
    return list.length > 0 && list.every(l => isDone(l.id));
}
function layerColor(id: LayerId): string {
    return OSI_LAYERS.find(l => l.id === id)?.color || '#64748b';
}
function renderMd(text: string): string {
    try { return marked.parse(text) as string; } catch { return text; }
}

function answerKey(lessonId: string, qi: number): number | undefined {
    return answers.value[lessonId]?.[qi];
}
function answer(lessonId: string, qi: number, oi: number) {
    answers.value = { ...answers.value, [lessonId]: { ...(answers.value[lessonId] || {}), [qi]: oi } };
}

function startLesson(l: Lesson) {
    store.setActiveLesson(l.id);
    router.push({
        path: '/network-simulator/studio/new',
        query: { lesson: l.id, ...(l.starterTemplateId ? { template: l.starterTemplateId } : {}) },
    });
}

async function makeQuiz() {
    quizBusy.value = true;
    aiQuiz.value = [];
    aiAnswers.value = {};
    try {
        const res = await netsimAi.quiz(quizTopic.value.trim(), 5);
        if (res.ok && res.data) aiQuiz.value = res.data;
        else store.toast('error', 'Could not generate questions', res.error);
    } finally {
        quizBusy.value = false;
    }
}
</script>

<style src="@/assets/css/netsim.css"></style>
