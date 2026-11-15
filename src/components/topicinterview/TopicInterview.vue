<!--
  "Interview on this topic": a button, and a window that opens where the student
  already is -- inside the lesson, the lab, the quiz or the practice exam -- and
  runs a short job-interview-style check on THAT material only.

  The decisions live in src/utils/topicInterview.ts and on app 27 (`_ji_scope`):
  the scope the page hands over, the question count (2-5, chosen by the planner
  from the size of the material), the strict scope in every prompt, and the
  fallbacks. This file runs the conversation and draws it.

  Three things that are easy to undo and should not be:
    * the LANGUAGE is chosen in the window and sent in every request body, so
      the interview can be Arabic on an English page (app 27 reads the body
      before the header) -- the page's own language is only the default;
    * the session is SAVED as it goes (in_progress, then complete), into the same
      collection as the Job Interviews, so the report is in "My Interviews"
      whatever happens to this tab;
    * the window teleports to the full-screen element when there is one
      (`useTeleportTarget`), or in a full-screen lab it would open invisibly.
-->
<template>
  <button
    type="button"
    class="ti-launch"
    :class="{ 'ti-launch--compact': compact }"
    :disabled="disabled"
    :title="disabled ? (disabledReason || '') : $t('A short interview about this topic only, with a report')"
    @click="openWindow"
  >
    <span class="ti-launch__icon" aria-hidden="true">🎙️</span>
    <span>{{ $t('Interview on this topic') }}</span>
  </button>

  <Teleport :to="teleportTo">
    <div v-if="open" class="ti-layer" @mousedown.self="onScrimDown" @mouseup.self="onScrimUp">
      <div
        ref="dialog"
        class="ti-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('Interview on this topic')"
        tabindex="-1"
        @keydown.esc.stop.prevent="requestClose"
        @keydown.tab="trapTab"
      >
        <header class="ti-head">
          <div class="ti-head__text">
            <span class="ti-kind">{{ kindLabel }}</span>
            <h2 class="ti-title" :title="scope.title">{{ scope.title }}</h2>
          </div>
          <button type="button" class="ti-close" :aria-label="$t('Close')" @click="requestClose">✕</button>
        </header>

        <!-- Not signed in / no AI access: say so here rather than hiding the button,
             so the feature is discoverable and the way in is one click. -->
        <section v-if="!authStore.isAuthenticated" class="ti-body ti-center">
          <p>{{ $t('Sign in to have a short interview on this topic.') }}</p>
          <router-link class="ti-btn ti-btn--primary" :to="{ path: '/login', query: { redirect: $route.fullPath } }" @click="open = false">
            {{ $t('Sign in') }}
          </router-link>
        </section>
        <section v-else-if="!authStore.hasAiAccess" class="ti-body ti-center">
          <p>{{ $t('Topic interviews are part of the AI feature of a subscription.') }}</p>
          <router-link class="ti-btn ti-btn--primary" to="/plans" @click="open = false">{{ $t('See the plans') }}</router-link>
        </section>

        <!-- 1. Setup -->
        <section v-else-if="phase === 'setup'" class="ti-body">
          <p class="ti-lede">
            {{ $t('A short interview of up to five questions about this {v0} only. The number of questions is chosen from the size of the material. Afterwards you get a report with your strengths, what to improve and the correct answers, saved in My Interviews.', { v0: kindLabel }) }}
          </p>

          <fieldset class="ti-langs">
            <legend>{{ $t('Interview language') }}</legend>
            <label v-for="l in LOCALES" :key="l.id" class="ti-lang" :class="{ 'is-on': lang === l.id }">
              <input v-model="lang" type="radio" name="ti-lang" :value="l.id">
              <span class="ti-lang__native" :lang="l.tag" :dir="l.direction">{{ l.nativeName }}</span>
              <span class="ti-lang__en">{{ l.name }}</span>
            </label>
          </fieldset>

          <label class="ti-check">
            <input v-model="speakAloud" type="checkbox">
            <span>{{ $t('Read the questions aloud') }}</span>
          </label>

          <div class="ti-actions">
            <button type="button" class="ti-btn ti-btn--primary" @click="start">{{ $t('Start the interview') }}</button>
            <router-link class="ti-btn ti-btn--ghost" to="/job-interview/results" @click="open = false">{{ $t('My Interviews') }}</router-link>
          </div>
        </section>

        <!-- 2. The conversation -->
        <section v-else-if="phase === 'running' || phase === 'finishing'" class="ti-body ti-room">
          <div class="ti-progress" aria-live="polite">
            <span>{{ $t('Question {v0} of {v1}', { v0: Math.min(qIndex + 1, plan.length || 1), v1: plan.length || '…' }) }}</span>
            <span class="ti-meter" aria-hidden="true">
              <span class="ti-meter__fill" :style="{ width: progressPct + '%' }"></span>
            </span>
          </div>

          <ol ref="thread" class="ti-thread" :dir="langDir" :lang="langTag">
            <li v-for="(m, i) in messages" :key="i" class="ti-msg" :class="'ti-msg--' + m.who">
              <span class="ti-msg__who">{{ m.who === 'bot' ? $t('Interviewer') : $t('You') }}</span>
              <p class="ti-msg__text">{{ m.text }}</p>
            </li>
            <li v-if="thinking" class="ti-msg ti-msg--bot ti-msg--typing">
              <span class="ti-msg__who">{{ $t('Interviewer') }}</span>
              <p class="ti-msg__text"><span class="ti-dots"><i></i><i></i><i></i></span></p>
            </li>
          </ol>

          <div v-if="phase === 'running'" class="ti-answer">
            <label class="ti-sr" for="ti-answer-box">{{ $t('Your answer') }}</label>
            <textarea
              id="ti-answer-box"
              ref="answerBox"
              v-model="answer"
              class="ti-answer__box"
              :dir="langDir"
              :lang="langTag"
              rows="4"
              :placeholder="$t('Type your answer, or record it with the microphone…')"
              :disabled="thinking || !currentQuestion"
              @keydown.ctrl.enter.prevent="submitAnswer"
              @keydown.meta.enter.prevent="submitAnswer"
            ></textarea>
            <div class="ti-answer__bar">
              <button
                v-if="micSupported"
                type="button"
                class="ti-btn ti-btn--ghost"
                :class="{ 'is-recording': recording }"
                :disabled="thinking || transcribing || !currentQuestion"
                @click="toggleRecording"
              >
                {{ recording ? $t('⏹ Stop recording') : transcribing ? $t('Transcribing…') : $t('🎤 Record answer') }}
              </button>
              <span class="ti-spacer"></span>
              <button type="button" class="ti-btn ti-btn--ghost" :disabled="thinking || !currentQuestion" @click="skip">{{ $t('Skip') }}</button>
              <button type="button" class="ti-btn ti-btn--primary" :disabled="thinking || recording || transcribing || !answer.trim()" @click="submitAnswer">
                {{ isLast ? $t('Answer and finish') : $t('Answer') }}
              </button>
            </div>
            <p v-if="micError" class="ti-note ti-note--warn">{{ micError }}</p>
          </div>
          <p v-else class="ti-note">{{ $t('Writing your report…') }}</p>
        </section>

        <!-- 3. The report -->
        <section v-else-if="phase === 'report'" class="ti-body ti-report">
          <div class="ti-score">
            <span class="ti-score__value">{{ evaluation?.score ?? '—' }}</span>
            <span class="ti-score__label">{{ $t('Score') }}</span>
          </div>
          <p v-if="evaluation?.recommendation" class="ti-reco" :dir="langDir">{{ evaluation.recommendation }}</p>

          <div class="ti-sections" :dir="langDir" :lang="langTag">
            <div v-if="evaluation?.summary" class="ti-sec"><h3>{{ $t('📝 Overall Summary') }}</h3><p>{{ evaluation.summary }}</p></div>
            <div v-if="evaluation?.strengths" class="ti-sec ti-sec--good"><h3>{{ $t('💪 Strengths') }}</h3><p>{{ evaluation.strengths }}</p></div>
            <div v-if="evaluation?.improvements" class="ti-sec ti-sec--warn"><h3>{{ $t('🎯 To improve') }}</h3><p>{{ evaluation.improvements }}</p></div>
            <div v-if="evaluation?.action_plan?.length" class="ti-sec">
              <h3>{{ $t('✅ What to do next') }}</h3>
              <ol class="ti-plan"><li v-for="(s, i) in evaluation.action_plan" :key="i">{{ s }}</li></ol>
            </div>
          </div>

          <h3 class="ti-qa-head">{{ $t('Questions, your answers and the correct answers') }}</h3>
          <div class="ti-qa" :dir="langDir" :lang="langTag">
            <QaCoaching v-for="(qa, i) in qaPairs" :key="i" :qa="qa" :index="i" />
          </div>

          <p class="ti-note">{{ saveNote }}</p>
          <div class="ti-actions">
            <button type="button" class="ti-btn ti-btn--primary" @click="reset">{{ $t('Interview again') }}</button>
            <router-link class="ti-btn ti-btn--ghost" to="/job-interview/results" @click="close">{{ $t('Open in My Interviews') }}</router-link>
            <button type="button" class="ti-btn ti-btn--ghost" @click="close">{{ $t('Close') }}</button>
          </div>
        </section>

        <section v-else-if="phase === 'error'" class="ti-body ti-center">
          <p>{{ errorText }}</p>
          <button type="button" class="ti-btn ti-btn--primary" @click="reset">{{ $t('Try again') }}</button>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import QaCoaching from '@/components/jobinterview/QaCoaching.vue';
import { jobInterviewService, type QAPair, type EvaluationResult } from '@/services/jobinterview.service';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/runtime';
import { LOCALES, getLocale } from '@/i18n/locales';
import { useTeleportTarget } from '@/composables/useFullscreen';
import {
  clampPlan, fallbackQuestion, sessionTopic, speechTag,
  type TopicScope,
} from '@/utils/topicInterview';

const props = defineProps<{
  scope: TopicScope;
  disabled?: boolean;
  disabledReason?: string;
  compact?: boolean;
}>();

const { t, localeId } = useI18n();
const authStore = useAuthStore();
const teleportTo = useTeleportTarget();

type Phase = 'setup' | 'running' | 'finishing' | 'report' | 'error';
interface Message { who: 'bot' | 'me'; text: string }

const open = ref(false);
const phase = ref<Phase>('setup');
const lang = ref<string>(localeId.value);
const speakAloud = ref(true);
const plan = ref<string[]>([]);
const qIndex = ref(0);
const currentQuestion = ref('');
const messages = ref<Message[]>([]);
const qaPairs = ref<QAPair[]>([]);
const answer = ref('');
const thinking = ref(false);
const evaluation = ref<EvaluationResult | null>(null);
const errorText = ref('');
const saveNote = ref('');

const dialog = ref<HTMLElement | null>(null);
const thread = ref<HTMLElement | null>(null);
const answerBox = ref<HTMLTextAreaElement | null>(null);
let opener: HTMLElement | null = null;

let sessionId = '';
let sessionSeed = 0;
let startedAt = 0;
let askedAt = 0;
let runToken = 0;
const coachJobs: Promise<void>[] = [];
let saveChain: Promise<unknown> = Promise.resolve();

const KIND_KEYS = { lesson: 'Lesson', lab: 'Lab', quiz: 'Quiz', exam: 'Exam' } as const;
const kindLabel = computed(() => t(KIND_KEYS[props.scope.kind as keyof typeof KIND_KEYS] || "Lesson"));
const langTag = computed(() => getLocale(lang.value).tag);
const langDir = computed(() => getLocale(lang.value).direction);
const isLast = computed(() => plan.value.length > 0 && qIndex.value >= plan.value.length - 1);
const progressPct = computed(() =>
  plan.value.length ? Math.round((qaPairs.value.length / plan.value.length) * 100) : 0);

/* ---------------- opening and closing ---------------- */

function openWindow(event: MouseEvent) {
  if (props.disabled) return;
  opener = event.currentTarget as HTMLElement;
  if (phase.value !== 'running' && phase.value !== 'finishing') lang.value = localeId.value;
  open.value = true;
  nextTick(() => dialog.value?.focus());
}

let scrimDown = false;
function onScrimDown() { scrimDown = true; }
function onScrimUp() { if (scrimDown) requestClose(); scrimDown = false; }

function requestClose() {
  if (phase.value === 'running' && qaPairs.value.length) {
    // Nothing is lost -- every answer is already saved -- but leaving halfway is
    // worth one question, because the report is what the student came for.
    if (!window.confirm(t('Leave the interview? Your answers so far are saved in My Interviews as unfinished.'))) return;
  }
  close();
}

function close() {
  stopSpeaking();
  stopRecording(true);
  if (phase.value === 'running' || phase.value === 'finishing') {
    runToken++;          // abandons anything still in flight
    phase.value = 'setup';
  }
  open.value = false;
  nextTick(() => opener?.focus());
}

function reset() {
  runToken++;
  stopSpeaking();
  stopRecording(true);
  phase.value = 'setup';
  messages.value = [];
  qaPairs.value = [];
  plan.value = [];
  evaluation.value = null;
  answer.value = '';
  currentQuestion.value = '';
}

function trapTab(event: KeyboardEvent) {
  const root = dialog.value;
  if (!root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled])'));
  if (!items.length) return;
  const first = items[0];
  if (!first) return;
  const last = items[items.length - 1] || first;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

/* ---------------- the conversation ---------------- */

function common() {
  return {
    scope: props.scope,
    language: lang.value,
    interview_type: 'Technical',
    topic: props.scope.title,
    qualifications: '',
  };
}

function userName(): string {
  return authStore.user?.first_name || authStore.user?.username || t('candidate');
}

function say(text: string) {
  messages.value.push({ who: 'bot', text });
  scrollThread();
  speak(text);
}

async function start() {
  const token = ++runToken;
  phase.value = 'running';
  messages.value = [];
  qaPairs.value = [];
  coachJobs.length = 0;
  evaluation.value = null;
  saveNote.value = '';
  sessionId = (crypto as any).randomUUID ? crypto.randomUUID() : `ti-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionSeed = Math.floor(Math.random() * 1e9);
  startedAt = Date.now();
  thinking.value = true;

  const [areas, intro] = await Promise.all([
    jobInterviewService.planQuestions({ ...common(), count: 'auto', session_seed: sessionSeed }),
    jobInterviewService.callInterviewer({ ...common(), stage: 'intro', user_name: userName() }),
  ]);
  if (token !== runToken) return;
  plan.value = clampPlan(areas, props.scope, lang.value);
  if (intro) say(intro);
  qIndex.value = 0;
  queueSave('in_progress');
  await ask(token);
}

async function ask(token: number) {
  thinking.value = true;
  const i = qIndex.value;
  const area = plan.value[i] || '';
  const text = await jobInterviewService.callInterviewer({
    ...common(),
    stage: 'question',
    user_name: userName(),
    question_number: i + 1,
    focus: area,
    asked_questions: qaPairs.value.map(q => q.question),
    previous_qa: qaPairs.value.slice(-2),
    session_seed: sessionSeed,
  });
  if (token !== runToken) return;
  const question = (text || '').trim() || fallbackQuestion(props.scope, area, i, lang.value);
  currentQuestion.value = question;
  thinking.value = false;
  askedAt = Date.now();
  say(question);
  nextTick(() => answerBox.value?.focus());
}

function skip() { void record(''); }
function submitAnswer() {
  if (!answer.value.trim() || thinking.value) return;
  void record(answer.value.trim());
}

async function record(text: string) {
  const token = runToken;
  stopSpeaking();
  const qa: QAPair = {
    question: currentQuestion.value,
    answer: text,
    seconds: Math.max(1, Math.round((Date.now() - askedAt) / 1000)),
    coaching_pending: true,
  };
  messages.value.push({ who: 'me', text: text || t('(skipped)') });
  qaPairs.value.push(qa);
  const index = qaPairs.value.length - 1;
  answer.value = '';
  currentQuestion.value = '';
  scrollThread();

  // Coached now, while the next question is asked -- the report is ready when
  // the interview ends rather than a minute after.
  coachJobs.push(jobInterviewService.coachOne({ ...common(), qa: { ...qa } }).then(c => {
    if (token !== runToken) return;
    const row = qaPairs.value[index];
    if (!row) return;
    if (c) { row.coaching = c; row.model_answer = c.model_answer; }
    row.coaching_pending = false;
    queueSave('in_progress');
  }));
  queueSave('in_progress');

  if (qIndex.value + 1 < plan.value.length) {
    qIndex.value++;
    await ask(token);
  } else {
    await finish(token);
  }
}

async function finish(token: number) {
  phase.value = 'finishing';
  thinking.value = true;
  const closing = await jobInterviewService.callInterviewer({ ...common(), stage: 'closing', user_name: userName() });
  if (token !== runToken) return;
  if (closing) say(closing);

  const [result] = await Promise.all([
    jobInterviewService.evaluate({ ...common(), qa_pairs: qaPairs.value }),
    Promise.allSettled(coachJobs),
  ]);
  if (token !== runToken) return;

  // Anything the per-answer coaching missed gets one more try, all at once.
  const missing = qaPairs.value.map((q, i) => ({ q, i })).filter(r => !r.q.coaching?.model_answer);
  if (missing.length) {
    const extra = await jobInterviewService.getModelAnswers({ ...common(), qa_pairs: missing.map(r => r.q) });
    if (token !== runToken) return;
    missing.forEach((r, k) => {
      if (extra[k]) { r.q.coaching = extra[k]; r.q.model_answer = extra[k].model_answer; }
    });
  }
  qaPairs.value.forEach(q => { q.coaching_pending = false; });

  evaluation.value = result;
  thinking.value = false;
  phase.value = 'report';
  try {
    await queueSave('complete');
    saveNote.value = t('This report is saved in My Interviews.');
  } catch {
    saveNote.value = t('The report could not be saved. It is still shown here.');
  }
}

function queueSave(status: 'in_progress' | 'complete'): Promise<unknown> {
  const ev = evaluation.value || ({} as Partial<EvaluationResult>);
  const body = {
    id: sessionId,
    user_id: authStore.user?.id || '',
    username: authStore.user?.username || '',
    user_full_name: `${authStore.user?.first_name || ''} ${authStore.user?.last_name || ''}`.trim(),
    ...common(),
    topic: sessionTopic(kindLabel.value, props.scope.title),
    planned_questions: plan.value.length,
    status,
    duration_seconds: Math.round((Date.now() - startedAt) / 1000),
    qa_pairs: qaPairs.value.map(q => ({ ...q })),
    transcript: messages.value.map(m => `${m.who === 'bot' ? 'Interviewer' : 'Candidate'}: ${m.text}`).join('\n'),
    score: ev.score ?? 0,
    summary: ev.summary || '',
    strengths: ev.strengths || '',
    improvements: ev.improvements || '',
    technical_assessment: ev.technical_assessment || '',
    communication: ev.communication || '',
    recommendation: ev.recommendation || '',
    action_plan: ev.action_plan || [],
    standout_moment: ev.standout_moment || '',
    red_flags: ev.red_flags || '',
    score_breakdown: ev.score_breakdown || {},
  };
  // Chained, never concurrent: every write carries the whole session, so two in
  // flight is a race whose loser wins.
  const next = saveChain.then(() => jobInterviewService.saveSession(body));
  saveChain = next.catch(() => undefined);
  if (status === 'in_progress') next.catch(e => console.warn('[topic interview] save failed', e));
  return next;
}

function scrollThread() {
  nextTick(() => { if (thread.value) thread.value.scrollTop = thread.value.scrollHeight; });
}

/* ---------------- speech out ---------------- */

let keepAlive: ReturnType<typeof setInterval> | null = null;
function speak(text: string) {
  if (!speakAloud.value || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(text);
  // `lang` only, never an assigned voice: an explicit voice overrides `lang`,
  // and a wrong-language voice reads Arabic as noise. The platform matches the
  // language itself, or stays silent -- and the text is on screen either way.
  u.lang = speechTag(lang.value);
  u.onend = () => stopKeepAlive();
  window.speechSynthesis.speak(u);
  // Chrome stops speaking after ~15 s without this.
  keepAlive = setInterval(() => { window.speechSynthesis.pause(); window.speechSynthesis.resume(); }, 9000);
}
function stopKeepAlive() { if (keepAlive) { clearInterval(keepAlive); keepAlive = null; } }
function stopSpeaking() {
  stopKeepAlive();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

/* ---------------- speech in ---------------- */

const micSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  && typeof window !== 'undefined' && 'MediaRecorder' in window;
const recording = ref(false);
const transcribing = ref(false);
const micError = ref('');
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;

async function toggleRecording() {
  if (recording.value) { stopRecording(false); return; }
  micError.value = '';
  try {
    stopSpeaking();
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => void transcribe(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
    recorder.start();
    recording.value = true;
  } catch {
    micError.value = t('The microphone could not be opened. You can type your answer instead.');
    stopRecording(true);
  }
}

let discardRecording = false;
function stopRecording(discard: boolean) {
  discardRecording = discard;
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  recording.value = false;
}

async function transcribe(blob: Blob) {
  recorder = null;
  if (discardRecording || blob.size < 1000) return;
  transcribing.value = true;
  try {
    const baseUrl = await jobInterviewService.resolveBaseUrl();
    if (!baseUrl) throw new Error('unreachable');
    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    form.append('language', lang.value);
    form.append('question', currentQuestion.value || '');
    const response = await fetch(`${baseUrl}/api/jobinterview/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Token ${import.meta.env.VITE_AUTH_TOKEN}`, 'X-SFS-Language': lang.value },
      body: form,
    });
    if (!response.ok) throw new Error(String(response.status));
    const text = String((await response.json()).text || '').trim();
    if (text) answer.value = answer.value.trim() ? `${answer.value.trim()} ${text}` : text;
    else micError.value = t('Nothing was heard. Try again a little closer to the microphone, or type.');
  } catch {
    micError.value = t('Your recording could not be transcribed. You can type your answer instead.');
  } finally {
    transcribing.value = false;
    nextTick(() => answerBox.value?.focus());
  }
}

watch(open, value => { document.documentElement.classList.toggle('ti-lock', value); });
onBeforeUnmount(() => {
  runToken++;
  stopSpeaking();
  stopRecording(true);
  document.documentElement.classList.remove('ti-lock');
});
</script>

<style src="@/assets/css/job-interview.css"></style>
<style>
html.ti-lock { overflow: hidden; }
</style>
<style scoped>
.ti-launch {
  display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.5rem 0.9rem; min-height: max(2.5rem, 40px);
  border-radius: 999px; border: 1px solid rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45);
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.14);
  color: var(--sfs-accent-text, #c7d2fe);
  font: inherit; font-weight: 600; font-size: 0.9rem; cursor: pointer;
  white-space: nowrap;
}
.ti-launch:hover:not(:disabled) { background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.24); }
.ti-launch:focus-visible { outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px; }
.ti-launch:disabled { opacity: 0.55; cursor: not-allowed; }
.ti-launch--compact { padding: 0.3rem 0.7rem; min-height: 0; font-size: 0.8rem; }

.ti-layer {
  position: fixed; inset: 0; z-index: 10020;
  display: flex; align-items: center; justify-content: center;
  padding: max(0.75rem, env(safe-area-inset-top)) 0.75rem max(0.75rem, env(safe-area-inset-bottom));
  background: var(--sfs-overlay, rgba(8, 10, 24, 0.62));
}
.ti-dialog {
  width: min(46rem, 100%); max-height: min(92dvh, 52rem);
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--sfs-surface, #161a2e); color: var(--sfs-text, #e5e7eb);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  border-radius: 1rem; box-shadow: 0 1.5rem 3rem rgb(0 0 0 / 0.35);
  outline: none;
}
.ti-head {
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 1rem 1.1rem 0.8rem;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
}
.ti-head__text { flex: 1; min-width: 0; }
.ti-kind { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sfs-text-muted, #9ca3af); }
.ti-title { margin: 0.15rem 0 0; font-size: 1.15rem; line-height: 1.3; overflow-wrap: anywhere; unicode-bidi: plaintext; }
.ti-close {
  flex: none; width: 2.25rem; height: 2.25rem; border-radius: 50%;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16); background: transparent;
  color: var(--sfs-text, #e5e7eb); font: inherit; cursor: pointer;
}
.ti-body { padding: 1rem 1.1rem 1.1rem; overflow-y: auto; min-height: 0; flex: 1; }
.ti-center { display: flex; flex-direction: column; align-items: center; gap: 0.9rem; text-align: center; padding-block: 2rem; }
.ti-lede { margin: 0 0 1rem; color: var(--sfs-text-muted, #9ca3af); line-height: 1.55; }

.ti-langs { border: 0; padding: 0; margin: 0 0 1rem; display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr)); }
.ti-langs legend { font-weight: 600; margin-bottom: 0.5rem; padding: 0; }
.ti-lang {
  display: flex; flex-direction: column; gap: 0.1rem; padding: 0.65rem 0.8rem; cursor: pointer;
  border-radius: 0.7rem; border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04);
}
.ti-lang.is-on { border-color: var(--sfs-accent, #667eea); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16); }
.ti-lang input { position: absolute; opacity: 0; pointer-events: none; }
.ti-lang:focus-within { outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px; }
.ti-lang__native { font-weight: 700; font-size: 1.05rem; }
.ti-lang__en { font-size: 0.8rem; color: var(--sfs-text-muted, #9ca3af); }
.ti-check { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; cursor: pointer; }

.ti-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.ti-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
  min-height: max(2.5rem, 40px); padding: 0.5rem 1rem; border-radius: 0.6rem;
  font: inherit; font-weight: 600; cursor: pointer; text-decoration: none;
  border: 1px solid transparent;
}
.ti-btn--primary { background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff); }
.ti-btn--ghost { background: transparent; color: var(--sfs-text, #e5e7eb); border-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.2); }
.ti-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ti-btn.is-recording { border-color: var(--sfs-danger, #f87171); color: var(--sfs-danger-text, #fca5a5); }
.ti-btn:focus-visible { outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px; }

.ti-room { display: flex; flex-direction: column; gap: 0.75rem; }
.ti-progress { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--sfs-text-muted, #9ca3af); }
.ti-meter { flex: 1; height: 0.4rem; border-radius: 999px; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1); overflow: hidden; }
.ti-meter__fill { display: block; height: 100%; background: var(--sfs-accent, #667eea); transition: width 0.3s; }
.ti-thread { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; overflow-y: auto; min-height: 8rem; max-height: 40dvh; }
.ti-msg { max-width: 88%; padding: 0.6rem 0.8rem; border-radius: 0.8rem; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); }
.ti-msg--me { align-self: flex-end; background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18); }
.ti-msg__who { display: block; font-size: 0.72rem; font-weight: 700; color: var(--sfs-text-muted, #9ca3af); margin-bottom: 0.2rem; }
.ti-msg__text { margin: 0; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; unicode-bidi: plaintext; }
.ti-dots { display: inline-flex; gap: 0.25rem; }
.ti-dots i { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: currentColor; opacity: 0.4; animation: ti-blink 1.2s infinite; }
.ti-dots i:nth-child(2) { animation-delay: 0.2s; }
.ti-dots i:nth-child(3) { animation-delay: 0.4s; }
@keyframes ti-blink { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.9; } }
@media (prefers-reduced-motion: reduce) { .ti-dots i { animation: none; } }

.ti-answer { display: flex; flex-direction: column; gap: 0.5rem; }
.ti-answer__box {
  width: 100%; box-sizing: border-box; resize: vertical; min-height: 5.5rem;
  padding: 0.65rem 0.75rem; border-radius: 0.6rem; font: inherit; font-size: max(1rem, 16px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05); color: var(--sfs-text, #e5e7eb);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
  unicode-bidi: plaintext;
}
.ti-answer__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.ti-spacer { flex: 1; }
.ti-note { margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--sfs-text-muted, #9ca3af); }
.ti-note--warn { color: var(--sfs-warning-text, #fcd34d); }
.ti-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.ti-score { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.4rem; }
.ti-score__value { font-size: 2.4rem; font-weight: 800; color: var(--sfs-accent-text, #c7d2fe); direction: ltr; }
.ti-score__label { color: var(--sfs-text-muted, #9ca3af); }
.ti-reco { margin: 0 0 0.8rem; font-weight: 600; unicode-bidi: plaintext; }
.ti-sections { display: grid; gap: 0.7rem; margin-bottom: 1rem; }
.ti-sec { padding: 0.7rem 0.85rem; border-radius: 0.7rem; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05); }
.ti-sec h3 { margin: 0 0 0.3rem; font-size: 0.95rem; }
.ti-sec p { margin: 0; line-height: 1.55; unicode-bidi: plaintext; }
.ti-sec--good { border-inline-start: 3px solid var(--sfs-success, #34d399); }
.ti-sec--warn { border-inline-start: 3px solid var(--sfs-warning, #fbbf24); }
.ti-plan { margin: 0; padding-inline-start: 1.2rem; line-height: 1.55; }
.ti-qa-head { font-size: 1rem; margin: 0.5rem 0; }
.ti-qa { display: grid; gap: 0.6rem; margin-bottom: 0.8rem; }

@media (max-width: 640px) {
  .ti-layer { padding: 0; align-items: stretch; }
  .ti-dialog { max-height: 100dvh; border-radius: 0; width: 100%; }
  .ti-thread { max-height: 34dvh; }
}
</style>
