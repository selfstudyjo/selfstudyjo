<template>
  <div class="ns-lesson-panel">
    <div v-if="!lesson" class="ns-lesson-empty">
      <DeviceIcon name="book" :size="30" />
      <h4>{{ $t('No lesson attached') }}</h4>
      <p>{{ $t('Pick a lesson from the Learn hub and the studio will check your work against the live network as you build it.') }}</p>
      <router-link class="ns-btn primary sm" to="/network-simulator/learn">{{ $t('Browse the curriculum') }}</router-link>
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
        <span>{{ $t('{v0} min', { v0: lesson.minutes }) }}</span>
        <span>{{ lesson.difficulty }}</span>
        <span>{{ $t('Layers {v0}', { v0: lesson.layers.join(', ') }) }}</span>
      </div>

      <nav class="ns-subtabs">
        <button :class="['ns-subtab', { active: view === 'tasks' }]" @click="view = 'tasks'">{{ $t('Tasks') }}</button>
        <button :class="['ns-subtab', { active: view === 'theory' }]" @click="view = 'theory'">{{ $t('Theory') }}</button>
        <button v-if="lesson.commands?.length" :class="['ns-subtab', { active: view === 'commands' }]" @click="view = 'commands'">{{ $t('Commands') }}</button>
        <button v-if="lesson.quiz?.length" :class="['ns-subtab', { active: view === 'quiz' }]" @click="view = 'quiz'">{{ $t('Quiz') }}</button>
      </nav>

      <!-- ── tasks ── -->
      <div v-if="view === 'tasks'" class="ns-lesson-body">
        <button class="ns-btn primary block" @click="store.checkLesson()">
          <DeviceIcon name="check" :size="15" /> {{ $t('Check my work') }}
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
              <p v-if="t.hint && !resultFor(t.id)?.ok" class="ns-task-hint">{{ $t('Hint: {v0}', { v0: t.hint }) }}</p>
            </div>
          </li>
        </ol>

        <div v-if="lesson.starterTemplateId" class="ns-btn-row tight">
          <button class="ns-btn ghost sm" @click="loadStarter">
            <DeviceIcon name="grid" :size="13" /> {{ $t('Load the starter topology') }}
          </button>
        </div>

        <div v-if="store.lessonScore >= 100" class="ns-lesson-done">
          <DeviceIcon name="award" :size="20" />
          <div>
            <strong>{{ $t('Lesson complete') }}</strong>
            <p>{{ $t('Every task was verified against your running network — not a multiple-choice answer.') }}</p>
            <button v-if="next" class="ns-btn primary sm" @click="goNext">{{ $t('Next: {v0}', { v0: next.title }) }}</button>
          </div>
        </div>
      </div>

      <!-- ── theory ── -->
      <div v-else-if="view === 'theory'" class="ns-lesson-body">
        <!--
          READ THE THEORY ALOUD, in the studio.

          The side panel is where a student actually works: the canvas is in
          front of them and the theory is in a narrow column beside it, which is
          the one place on this platform where being read to instead of reading
          is obviously better -- their hands are on the topology.

          These lessons are English only (a compiled-in catalogue, no
          translation mechanism), so on an Arabic or Chinese interface the
          control names the language it is reading in rather than pretending.
        -->
        <div class="ns-theory-read">
          <ReadAloud :id="`ns-panel-${lesson.id}`"
                     :parts="theoryParts" :title="lesson.title" />
        </div>
        <ul class="ns-objectives">
          <li v-for="(o, i) in lesson.objectives" :key="i">{{ o }}</li>
        </ul>
        <div class="ns-theory" v-html="renderMd(lesson.theory)"></div>
        <div class="ns-terms">
          <h5>{{ $t('Key terms') }}</h5>
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
import ReadAloud from '@/components/ReadAloud.vue';
import { definitions, numbered } from '@/utils/reader';
import { useNetSimStore } from '@/store/netsim';
import { getLesson, nextLesson, TRACKS } from '@/netsim/lessons';
import { ensureNetsimI18n, overlayLesson, overlayTrack } from '@/netsim/i18n';
import { localeId } from '@/i18n/runtime';
import { marked } from 'marked';

const store = useNetSimStore();
const router = useRouter();
const view = ref<'tasks' | 'theory' | 'commands' | 'quiz'>('tasks');
const answers = ref<Record<number, number>>({});

// Overlaid, so the studio's lesson panel reads in the same language as the
// catalogue page it was opened from. See src/netsim/i18n/index.ts.
const lesson = computed(() => {
  const found = store.activeLessonId ? getLesson(store.activeLessonId) : undefined;
  return found ? overlayLesson(found) : undefined;
});
const next = computed(() => (lesson.value ? nextLesson(lesson.value.id) : undefined));
const trackTitle = computed(() => {
  const found = TRACKS.find(t => t.id === lesson.value?.trackId);
  return found ? overlayTrack(found).title : '';
});

/**
 * The theory as something a voice can read: the objectives, then the write-up,
 * then the key terms.
 *
 * `numbered` and `definitions` are the reader's, not this component's, because
 * both are DECISIONS -- a spoken list needs numbers or it is a paragraph, and a
 * definition list read as bare alternating fragments is unattributable in
 * exactly the way a table is. Both live where `check:reader` can drive them.
 */
const theoryParts = computed<string[]>(() => {
    const it = lesson.value;
    if (!it) return [];
    return [
        numbered(it.objectives || []),
        it.theory,
        definitions(it.keyTerms || []),
    ].filter(Boolean);
});

watch(() => lesson.value?.id, () => { answers.value = {}; view.value = 'tasks'; });

// The studio can be the FIRST netsim route a reader opens (a lab embeds it),
// so this cannot rely on the catalogue page having loaded the chunk.
ensureNetsimI18n(localeId.value);
watch(localeId, id => ensureNetsimI18n(id));

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
