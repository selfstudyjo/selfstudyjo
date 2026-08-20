<template>
  <div class="ji-meeting-room">
    <div class="ji-meeting-header">
      <div>
        <strong>💼 {{ interviewType }} Interview</strong>
        <span class="ji-badge" v-if="topic && interviewType === 'Technical'">{{ topic }}</span>
        <!--
          Both of these confirm something the candidate asked for and would
          otherwise have no way to see: that the CV really did reach the
          interviewer, and that this sitting is being treated as a redo rather
          than as a fresh interview that will re-ask the same questions.
        -->
        <span class="ji-badge" v-if="cvTitle" :title="'The interviewer has read: ' + cvTitle">📄 CV attached</span>
        <span class="ji-badge" v-if="attempt > 1" title="New questions — the interviewer knows what you have already been asked">🔁 Attempt {{ attempt }}</span>
      </div>
      <div class="ji-header-right">
        <span class="ji-q-counter" v-if="phase !== 'idle'">Q {{ Math.min(questionNumber, maxQuestions) }} / {{ maxQuestions }}</span>
        <span class="ji-timer-display" :class="{ over: timeUp }">{{ timerDisplay }}</span>
      </div>
    </div>

    <div class="ji-stage">
      <!-- Interviewer -->
      <div class="ji-video-tile ji-interviewer" :class="{ speaking: currentSpeaker === 'interviewer' }">
        <!--
          The assets are square and this tile is 16/10, so 37.5% of the height
          has to go somewhere. `align="0%"` takes all of it off the BOTTOM: the
          window becomes the top 62.5% of the square, which cuts nothing from a
          head that the square had not already cut, and gives away desk instead.
          Measured, that is the only setting that works for all six -- Marcus and
          James are close-ups whose hair reaches the top edge of their square, so
          a centred `cover` (or anything above 0%) trims the crown off two of the
          people who can be cast, one interview in three.
        -->
        <SpeakerMedia
          :actor="interviewer.id"
          :speaking="currentSpeaker === 'interviewer'"
          align="0%"
          :alt="interviewerTag"
        />
        <div class="ji-name-tag">{{ interviewerTag }}</div>
        <div class="ji-speaking-dot"></div>
      </div>

      <!-- User -->
      <div class="ji-video-tile ji-self" :class="{ 'camera-off': !cameraEnabled, speaking: phase === 'answering' }">
        <div class="ji-user-video-wrap">
          <video ref="videoEl" autoplay muted playsinline></video>
        </div>
        <div class="ji-camera-off-overlay">
          <div class="ji-camera-off-avatar">{{ userInitial }}</div>
          <div class="ji-camera-off-text">{{ cameraBusy ? 'Starting camera…' : 'Camera Off' }}</div>
          <!--
            Said on the tile, not in an alert. The camera is optional, so its
            failure must not interrupt anything — but it does have to be
            explained, or "Camera Off" while the camera is plugged in reads as
            the app being broken.
          -->
          <div class="ji-camera-note" v-if="cameraError && !cameraBusy">{{ cameraError }}</div>
        </div>
        <div class="ji-name-tag">👤 You ({{ userName }})</div>
        <div class="ji-self-status">
          <span class="ji-status-icon" :class="{ muted: !micEnabled }">{{ micEnabled ? '🎤' : '🔇' }}</span>
          <span class="ji-status-icon" :class="{ muted: !cameraEnabled }">{{ cameraEnabled ? '📹' : '📷' }}</span>
        </div>
        <div class="ji-speaking-dot"></div>
      </div>
    </div>

    <!-- Current question -->
    <div class="ji-question-box" v-if="currentQuestionText">
      <div class="ji-question-label">❓ Interviewer asks:</div>
      <div class="ji-question-text">{{ currentQuestionText }}</div>
    </div>

    <!-- Caption / status -->
    <div class="ji-caption-box">
      <strong>{{ captionSpeaker }}:</strong>
      <span>{{ captionText }}</span>
    </div>

    <!-- Live answer transcript -->
    <div class="ji-transcript-box" v-if="phase === 'answering' || currentAnswerText">
      <h4>Your Answer
        <span v-if="phase === 'answering'" style="color:#34d399;font-size:.85rem">🎤 Recording (Whisper AI)</span>
      </h4>
      <div>{{ currentAnswerText || (phase === 'answering' ? '🎙️ Listening… your words appear every ~3 seconds' : '—') }}</div>
    </div>

    <!--
      Only the microphone can stop an interview, so only the microphone gets a
      blocking panel. It says what actually went wrong and offers the retry,
      because the two commonest causes — the device held by another app, and
      access blocked at the padlock — are both things the candidate fixes in
      another window and comes straight back from.
    -->
    <div class="ji-media-error" v-if="mediaError && !reportVisible">
      <div class="ji-media-error-title">🎤 Your microphone could not be started</div>
      <p>{{ mediaError }}</p>
      <p class="ji-media-error-hint">
        A microphone is required — your spoken answers are transcribed. A camera is optional and
        the interview runs perfectly without one.
      </p>
      <button @click="retryMicrophone" class="ji-btn-primary" :disabled="starting">
        {{ starting ? 'Trying…' : '↻ Try Again' }}
      </button>
    </div>

    <!-- Controls -->
    <div class="ji-controls" v-if="!reportVisible">
      <button @click="startInterview" :disabled="phase !== 'idle' || starting" class="ji-btn-primary">
        {{ startBtnText }}
      </button>
      <button @click="startAnswering" :disabled="phase !== 'awaiting'" class="ji-btn-success">🎤 Start Answering</button>
      <button @click="submitAnswer" :disabled="phase !== 'answering'" class="ji-btn-warning">✅ Submit Answer</button>
      <button @click="toggleMic" :disabled="!mediaReady" class="ji-btn-control" :class="{ off: !micEnabled }">{{ micEnabled ? '🎤 Mic On' : '🔇 Mic Off' }}</button>
      <!--
        Enabled as soon as the MICROPHONE is ready, not the camera. Pressing it
        after a camera failure is a fresh attempt at opening one, which is what
        makes "close Teams, then press it" work without leaving the interview.
      -->
      <button @click="toggleCamera" :disabled="!mediaReady || cameraBusy" class="ji-btn-control" :class="{ off: !cameraEnabled }">
        {{ cameraBusy ? '⏳ Camera…' : cameraEnabled ? '📹 Camera On' : '📷 Turn Camera On' }}
      </button>
      <button @click="endInterview" :disabled="phase === 'idle' || phase === 'processing'" class="ji-btn-secondary">⏹️ End Interview</button>
      <button @click="leave" class="ji-btn-danger">Leave</button>
    </div>

    <!-- Report -->
    <div class="ji-reports-panel" v-if="reportVisible">
      <h2>📋 Interview Feedback Report</h2>

      <div class="ji-score-card">
        <div class="ji-score-circle" :class="scoreClass(report.score)">{{ report.score }}<span>/100</span></div>
        <div class="ji-recommendation">
          <div class="ji-rec-label">Recommendation</div>
          <div class="ji-rec-value">{{ report.recommendation || '—' }}</div>
        </div>
      </div>

      <div class="ji-report-card"><h3>📝 Overall Summary</h3><p>{{ report.summary }}</p></div>
      <div class="ji-report-card"><h3>✅ Strengths</h3><p>{{ report.strengths }}</p></div>
      <div class="ji-report-card"><h3>📈 Areas to Improve</h3><p>{{ report.improvements }}</p></div>
      <div class="ji-report-card"><h3>🧠 {{ interviewType === 'HR' ? 'Competency Assessment' : 'Technical Assessment' }}</h3><p>{{ report.technical_assessment }}</p></div>
      <div class="ji-report-card"><h3>🗣️ Communication</h3><p>{{ report.communication }}</p></div>

      <div class="ji-report-card">
        <h3>💬 Question-by-question coaching ({{ qaPairs.length }})</h3>
        <p class="ji-card-lead">
          For each question: what you said, what was missing, what a strong answer sounds like,
          and why the interviewer asked it.
        </p>
        <div class="ji-qa-list">
          <QaCoaching v-for="(qa, i) in qaPairs" :key="i" :qa="qa" :index="i" />
          <div v-if="qaPairs.length === 0" style="color:var(--ji-text-mute)">No questions were answered.</div>
        </div>
      </div>

      <div class="ji-controls">
        <button @click="$router.push('/job-interview/results')" class="ji-btn-primary">View All Results →</button>
        <!--
          Straight back into the room with the same role, requirements and CV.
          Re-typing a page of job requirements is the reason nobody practised the
          same role twice; the interviewer is told what it has already asked.
        -->
        <button @click="redoSameInterview" class="ji-btn-success">🔁 Redo This Interview</button>
        <button @click="editAndRedo" class="ji-btn-secondary">✏️ Change Details & Redo</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import {
  jobInterviewService, type QACoaching, type QAPair, type EvaluationResult,
} from '@/services/jobinterview.service';
import SpeakerMedia from '@/components/cast/SpeakerMedia.vue';
import QaCoaching from '@/components/jobinterview/QaCoaching.vue';
import {
  INTERVIEWER_TITLES, actorById, castVoice, interviewerLabel, isActorId,
  pickInterviewer, pitchFor, type InterviewType,
} from '@/cast/actors';
import {
  MAX_AVOID_QUESTIONS, clampMinutes, fallbackQuestion as fallbackQuestionFor,
  questionCountFor, redoConfigFrom, type InterviewConfig,
} from '@/utils/interviewSetup';
import {
  VIDEO_CONSTRAINTS, acquireInterviewMedia, describeMediaError, mediaUnsupportedReason,
} from '@/utils/mediaDevices';

const router = useRouter();
const authStore = useAuthStore();

// ====== Config from pre-session ======
let cfg: InterviewConfig = { type: 'Technical', topic: '', qualifications: '', minutes: 15 };
try {
  const raw = sessionStorage.getItem('jobInterviewConfig');
  if (raw) cfg = JSON.parse(raw);
} catch { /* ignore */ }

const topic = cfg.topic || '';
const qualifications = cfg.qualifications || '';
const plannedMinutes = clampMinutes(cfg.minutes);

// The CV the candidate attached, already rendered to text by the pre-session
// page. Text rather than an id on purpose: the room is re-created by a reload,
// and resolving it here would put a live interview behind app 33 being warm.
const cvSummary = cfg.cvSummary || '';
const cvTitle = cfg.cvTitle || '';
// Which sitting this is, and what was asked in the earlier ones. Both only
// affect which questions come out; neither can stop the interview.
const attempt = Math.max(1, Math.round(Number(cfg.attempt) || 1));
const avoidQuestions = (cfg.avoidQuestions || []).slice(0, MAX_AVOID_QUESTIONS);

const maxQuestions = questionCountFor(plannedMinutes);

const userName = computed(() => authStore.user?.first_name || authStore.user?.username || 'Candidate');
const userInitial = computed(() => (userName.value[0] || 'U').toUpperCase());

// ====== Interviewer persona ======
/**
 * The interviewer is a real face, cast at random for each interview.
 *
 * The choice is READ from the session config rather than made here, so that
 * reloading the page mid-interview does not hand the candidate over to a
 * different person halfway through: the config is what survives a reload, and
 * who is conducting it is part of the setup like the topic and the duration. A
 * config written before this existed re-casts here rather than rendering a
 * blank tile.
 *
 * Deliberately not filtered by interview type. The two personas app 27 shipped
 * with were a man for Technical and a woman for HR, and either title reads
 * correctly on any of the six.
 */
const castId = cfg.interviewer || '';
const interviewer = isActorId(castId) ? actorById(castId) : pickInterviewer();

const interviewType: InterviewType = cfg.type === 'HR' ? 'HR' : 'Technical';
const interviewerName = interviewer.name;
const interviewerRole = INTERVIEWER_TITLES[interviewType].title;
const interviewerTag = interviewerLabel(interviewer, interviewType);

// ====== Local fallback questions ======
/**
 * Used only when app 27 itself is unreachable -- when it is up but its own AI
 * providers are not, it falls back on its own (and rotates the same way).
 *
 * Rotated by `attempt`, which is what makes a redo a redo rather than a re-run
 * of the identical twelve questions. The pools and the rotation live in
 * src/utils/interviewSetup.ts so they can be checked without a browser
 * (`npm run check:interview`).
 */
function fallbackQuestion(qnum: number): string {
  return fallbackQuestionFor(interviewType, topic, qnum, attempt);
}

// ====== State ======
const videoEl = ref<HTMLVideoElement>();
type Phase = 'idle' | 'intro' | 'awaiting' | 'answering' | 'processing' | 'done';
const phase = ref<Phase>('idle');
const starting = ref(false);
const startBtnText = ref('▶️ Start Interview');

const currentSpeaker = ref<string | null>(null);
const captionSpeaker = ref('System');
const captionText = ref('Click "Start Interview" to begin.');
const currentQuestionText = ref('');
const currentAnswerText = ref('');
const questionNumber = ref(0);
const qaPairs = ref<QAPair[]>([]);

const mediaReady = ref(false);
const micEnabled = ref(true);
// The camera starts OFF and is switched on only once a track is actually
// running. It used to start true, so a machine with no camera showed a live
// tile with a black rectangle in it rather than the "Camera Off" placeholder
// that already existed for exactly this.
const cameraEnabled = ref(false);
const cameraBusy = ref(false);
/** Why the microphone could not be opened. Blocks the interview. */
const mediaError = ref('');
/** Why the camera could not be opened. Does not block anything. */
const cameraError = ref('');

const timerDisplay = ref('00:00');
const timeUp = ref(false);

const reportVisible = ref(false);
const report = reactive<EvaluationResult>({
  score: 0, summary: '', strengths: '', improvements: '',
  technical_assessment: '', communication: '', recommendation: ''
});

// Internal
// Two streams, not one: the microphone is required and the camera is not, so
// they are opened, toggled and stopped independently. See initMedia().
let audioStream: MediaStream | null = null;
let videoStream: MediaStream | null = null;
let startTime = 0;
let timerInterval: any = null;
let answerBuffer = '';
let isAnswering = false;
let recordingLoopActive = false;
let currentRecorder: MediaRecorder | null = null;
let voices: SpeechSynthesisVoice[] = [];

function loadVoices() { voices = speechSynthesis.getVoices().filter(v => v.lang?.toLowerCase().startsWith('en')); }
loadVoices();
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = loadVoices;

/**
 * A voice for whoever was cast, chosen on THEIR gender rather than on the
 * interview type.
 *
 * The old rule was "a female voice for HR, a male one for Technical", which was
 * only ever right because the two personas were fixed. Now that there is a face
 * on the tile, a mismatch is a man's face speaking in a woman's voice -- what
 * the newscast was reported for four separate times -- so the fact that the
 * browser had no voice of the right gender is carried into the pitch rather
 * than dropped.
 */
function castInterviewerVoice() {
  return castVoice(voices, interviewer.gender);
}

function speak(text: string): Promise<void> {
  return new Promise(resolve => {
    if (!text?.trim()) { resolve(); return; }
    captionSpeaker.value = interviewerName;
    captionText.value = text;
    currentSpeaker.value = 'interviewer';
    try { speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    const cast = castInterviewerVoice();
    if (cast.voice) u.voice = cast.voice as SpeechSynthesisVoice;
    u.pitch = pitchFor(interviewer.gender, cast.matched);
    u.rate = 1.0;
    u.onend = () => { currentSpeaker.value = null; resolve(); };
    u.onerror = () => { currentSpeaker.value = null; resolve(); };
    setTimeout(() => { try { speechSynthesis.speak(u); } catch { resolve(); } }, 80);
  });
}

// ====== Media ======
function stopAllTracks() {
  audioStream?.getTracks().forEach(t => t.stop());
  videoStream?.getTracks().forEach(t => t.stop());
  audioStream = null;
  videoStream = null;
}

/**
 * The microphone, on its own, and then the camera, on its own.
 *
 * TWO calls, and that is the fix rather than a refactor. It used to ask for
 * `{video, audio}` in one `getUserMedia`, which resolves only if BOTH can be
 * opened — so a machine with a perfectly good microphone and a camera that was
 * unplugged, disabled in Windows privacy settings, or held by Teams got a
 * single `NotFoundError` and no microphone either. The interview could not be
 * started at all, and the message said permission had been denied on a
 * permission the user had granted.
 *
 * The microphone is required (the answers are transcribed from it). The camera
 * is not: nothing reads the video track — it is shown to the candidate to make
 * the room feel like a room — so failing to get one must never stop an
 * interview.
 */
async function initMedia(): Promise<boolean> {
  mediaError.value = '';
  cameraError.value = '';

  const unsupported = mediaUnsupportedReason(
    navigator, typeof isSecureContext === 'undefined' ? true : isSecureContext,
    location.origin);
  if (unsupported) { mediaError.value = unsupported; return false; }

  const got = await acquireInterviewMedia(c => navigator.mediaDevices.getUserMedia(c));

  // The microphone is required, so a failure here stops the interview.
  if (!got.audio) {
    console.error('[media] microphone:', got.micError);
    mediaError.value = got.micError;
    return false;
  }
  audioStream = got.audio;
  mediaReady.value = true;
  micEnabled.value = true;

  // The camera is not. A failure is a note on the tile and nothing more — and
  // it is retryable from the Camera button, because the usual cause (another
  // app holding it) is one the candidate can clear without losing the
  // interview they are in.
  videoStream = got.video;
  cameraError.value = got.cameraError;
  if (videoStream) await showCamera();
  return true;
}

/** Put an open camera stream on screen. Never throws. */
async function showCamera() {
  if (!videoStream) { cameraEnabled.value = false; return; }
  if (videoEl.value) {
    videoEl.value.srcObject = videoStream;
    // Bounded, and that matters: `onloadedmetadata` does not always fire for a
    // track that opened but never produces frames (a covered or virtual
    // camera), and an unbounded wait here would hang the start button on the
    // one device that is optional.
    await Promise.race([
      new Promise<void>(r => {
        if (videoEl.value!.readyState >= 2) r();
        else videoEl.value!.onloadedmetadata = () => videoEl.value!.play().then(() => r()).catch(() => r());
      }),
      new Promise<void>(r => setTimeout(r, 3000)),
    ]);
  }
  cameraEnabled.value = true;
}

/** Open the camera on demand, after it failed or was switched off. */
async function enableCamera(opts: { announce: boolean }): Promise<boolean> {
  if (videoStream) { setCameraTracks(true); return true; }
  cameraBusy.value = true;
  cameraError.value = '';
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
    await showCamera();
    return true;
  } catch (e) {
    console.error('[media] camera:', e);
    videoStream = null;
    cameraEnabled.value = false;
    cameraError.value = describeMediaError(e, 'camera');
    // Announced only when the candidate asked for it by pressing the button.
    // On the automatic attempt at start-up it stays on the tile, because an
    // alert there would interrupt an interview over an optional device.
    if (opts.announce) alert(cameraError.value);
    return false;
  } finally {
    cameraBusy.value = false;
  }
}

function setCameraTracks(on: boolean) {
  cameraEnabled.value = on;
  if (videoStream) videoStream.getVideoTracks().forEach(t => (t.enabled = on));
}

function toggleMic() {
  micEnabled.value = !micEnabled.value;
  if (audioStream) audioStream.getAudioTracks().forEach(t => (t.enabled = micEnabled.value));
  if (!micEnabled.value) stopCurrentRecording();
}

async function toggleCamera() {
  if (cameraEnabled.value) { setCameraTracks(false); return; }
  // Turning it back on after it failed is a fresh attempt, not a flag flip —
  // which is what makes "close Teams and press it again" work mid-interview.
  if (!videoStream) { await enableCamera({ announce: true }); return; }
  setCameraTracks(true);
}

/** Ask for the microphone again after the candidate has fixed whatever it was. */
async function retryMicrophone() {
  if (starting.value) return;
  mediaError.value = '';
  await startInterview();
}

// ====== Whisper transcription ======
function getPreferredMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

async function transcribeAudioBlob(blob: Blob): Promise<void> {
  if (blob.size < 1000) return;
  try {
    const baseUrl = await jobInterviewService.resolveBaseUrl();
    if (!baseUrl) return;
    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');
    const token = import.meta.env.VITE_AUTH_TOKEN;
    const response = await fetch(`${baseUrl}/api/jobinterview/transcribe`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}` },
      body: formData
    });
    if (response.ok) {
      const result = await response.json();
      const text = (result.text || '').trim();
      if (text) {
        answerBuffer = (answerBuffer + ' ' + text).trim();
        currentAnswerText.value = answerBuffer;
      }
    } else {
      console.warn('[Whisper] HTTP', response.status);
    }
  } catch (e: any) {
    console.error('[Whisper] error:', e?.message || e);
  }
}

async function recordOneChunk(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!audioStream) { resolve(); return; }
    const audioTracks = audioStream.getAudioTracks();
    if (audioTracks.length === 0) { resolve(); return; }
    const audioStream = new MediaStream(audioTracks);
    const mimeType = getPreferredMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(audioStream, { mimeType, audioBitsPerSecond: 64000 })
        : new MediaRecorder(audioStream);
    } catch { resolve(); return; }
    const chunks: Blob[] = [];
    let stopTimeoutId: any = null;
    recorder.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      if (stopTimeoutId) clearTimeout(stopTimeoutId);
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        transcribeAudioBlob(blob);
      }
      currentRecorder = null;
      resolve();
    };
    currentRecorder = recorder;
    try { recorder.start(); } catch { resolve(); return; }
    stopTimeoutId = setTimeout(() => {
      if (recorder.state === 'recording') { try { recorder.stop(); } catch {} }
    }, durationMs);
  });
}

async function startContinuousRecording() {
  if (recordingLoopActive) return;
  recordingLoopActive = true;
  while (isAnswering && micEnabled.value) {
    await recordOneChunk(3500);
    if (isAnswering) await new Promise(r => setTimeout(r, 50));
  }
  recordingLoopActive = false;
}

function stopCurrentRecording() {
  if (currentRecorder && currentRecorder.state === 'recording') {
    try { currentRecorder.stop(); } catch {}
  }
  currentRecorder = null;
}

// ====== Timer ======
function startTimer() {
  startTime = Date.now();
  const limit = plannedMinutes * 60;
  timerInterval = setInterval(() => {
    const el = Math.floor((Date.now() - startTime) / 1000);
    timerDisplay.value = `${String(Math.floor(el / 60)).padStart(2, '0')}:${String(el % 60).padStart(2, '0')}`;
    if (el >= limit && !timeUp.value) {
      timeUp.value = true;
      captionSpeaker.value = 'System';
      captionText.value = '⏰ Time is up — finish your current answer, then it will wrap up.';
    }
  }, 250);
}

// ====== Flow ======
async function startInterview() {
  starting.value = true;
  startBtnText.value = '⏳ Setting up…';
  captionSpeaker.value = 'System';
  captionText.value = 'Requesting your microphone…';
  if (!(await initMedia())) {
    starting.value = false;
    startBtnText.value = '▶️ Start Interview';
    captionText.value = 'The interview cannot start without a microphone — see the message above.';
    return;
  }
  if (typeof MediaRecorder === 'undefined') {
    mediaError.value = 'This browser cannot record audio. Use Chrome, Edge, Firefox or Safari.';
    starting.value = false; startBtnText.value = '▶️ Start Interview'; return;
  }
  // Said once, here, so a candidate with no camera is told the interview is
  // fine rather than left reading a camera error and assuming it is not.
  captionText.value = cameraError.value
    ? 'Microphone ready. Continuing without a camera — that is fine, only your voice is assessed.'
    : 'Microphone ready.';
  if (voices.length === 0) { await new Promise(r => setTimeout(r, 400)); loadVoices(); }

  phase.value = 'intro';
  captionText.value = 'Interviewer is joining…';
  const intro = await jobInterviewService.callInterviewer({
    stage: 'intro', interview_type: interviewType, topic, qualifications, user_name: userName.value,
    interviewer_name: interviewerName, interviewer_role: interviewerRole,
    cv_summary: cvSummary
  });
  await speak(intro || `Hello ${userName.value}, I'm ${interviewerName}. Let's begin.`);

  startTimer();
  startBtnText.value = '✓ Started';
  questionNumber.value = 1;
  await askNextQuestion();
  starting.value = false;
}

async function askNextQuestion() {
  if (timeUp.value || questionNumber.value > maxQuestions) {
    await endInterview();
    return;
  }
  phase.value = 'processing';
  currentAnswerText.value = '';
  captionSpeaker.value = interviewerName;
  captionText.value = 'Interviewer is thinking of the next question…';
  const q = await jobInterviewService.callInterviewer({
    stage: 'question',
    interview_type: interviewType,
    topic,
    qualifications,
    user_name: userName.value,
    interviewer_name: interviewerName,
    interviewer_role: interviewerRole,
    question_number: questionNumber.value,
    previous_qa: qaPairs.value,
    // The CV rides along on every question, not just the intro: the model is
    // stateless, so one mentioned in the greeting is forgotten by question three.
    cv_summary: cvSummary,
    // Earlier sittings' questions, plus this sitting's, so the interviewer does
    // not re-ask something within the redo either.
    avoid_questions: avoidQuestions,
    attempt
  });
  currentQuestionText.value = (q && q.trim()) ? q.trim() : fallbackQuestion(questionNumber.value);
  await speak(currentQuestionText.value);
  phase.value = 'awaiting';
  captionSpeaker.value = 'System';
  captionText.value = 'Click "Start Answering" when you are ready to respond.';
}

function startAnswering() {
  if (!micEnabled.value) { alert('Please unmute your microphone first.'); return; }
  if (!audioStream) { alert('Your microphone is not connected yet.'); return; }
  answerBuffer = '';
  currentAnswerText.value = '';
  isAnswering = true;
  phase.value = 'answering';
  captionSpeaker.value = 'You';
  captionText.value = '🎤 Answer now — your words appear below every ~3 seconds (Whisper AI).';
  startContinuousRecording().catch(e => console.error('[Recording]', e));
}

async function submitAnswer() {
  if (phase.value !== 'answering') return;
  isAnswering = false;
  phase.value = 'processing';
  stopCurrentRecording();
  captionText.value = 'Finalizing your answer…';
  await new Promise(r => setTimeout(r, 1400));

  qaPairs.value.push({
    question: currentQuestionText.value,
    answer: answerBuffer.trim()
  });

  questionNumber.value++;
  if (timeUp.value || questionNumber.value > maxQuestions) {
    await endInterview();
  } else {
    await askNextQuestion();
  }
}

async function endInterview() {
  if (phase.value === 'done') return;
  isAnswering = false;
  stopCurrentRecording();
  if (timerInterval) clearInterval(timerInterval);
  phase.value = 'processing';
  currentQuestionText.value = '';
  captionSpeaker.value = interviewerName;
  captionText.value = 'Wrapping up the interview and preparing your feedback…';

  const closing = await jobInterviewService.callInterviewer({
    stage: 'closing', interview_type: interviewType, topic, user_name: userName.value,
    interviewer_name: interviewerName, interviewer_role: interviewerRole,
    attempt
  });
  await speak(closing || `Thank you ${userName.value}. I'll share some feedback now.`);

  const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

  // Run evaluation + coaching in parallel
  captionText.value = 'Generating feedback, model answers and coaching notes…';

  const [evalResult, coaching] = await Promise.all([
    jobInterviewService.evaluate({
      interview_type: interviewType, topic, qualifications, cv_summary: cvSummary,
      qa_pairs: qaPairs.value
    }),
    // The whole pair, not just the question: what the candidate SAID is what
    // lets the coach say why their answer fell short rather than only describing
    // a good one.
    qaPairs.value.length > 0
      ? jobInterviewService.getModelAnswers({
          interview_type: interviewType, topic, qualifications, cv_summary: cvSummary,
          qa_pairs: qaPairs.value
        })
      : Promise.resolve([] as QACoaching[])
  ]);

  // Attach the coaching to each Q&A. `model_answer` is kept as a plain string
  // alongside it, because that is the field every report written before today
  // is stored with and the one an older client reads.
  qaPairs.value.forEach((qa, i) => {
    const entry = coaching[i];
    qa.model_answer = entry?.model_answer || '';
    qa.coaching = entry || undefined;
  });

  if (evalResult) {
    Object.assign(report, evalResult);
  } else {
    Object.assign(report, {
      score: 0,
      summary: 'We could not generate AI feedback at this time, but your interview was recorded.',
      strengths: 'You participated in the full interview.',
      improvements: 'Try again later for detailed AI feedback.',
      technical_assessment: '—',
      communication: '—',
      recommendation: 'Maybe'
    });
  }

  reportVisible.value = true;
  phase.value = 'done';

  const transcript = qaPairs.value
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer || '(no answer)'}`)
    .join('\n\n');

  try {
    await jobInterviewService.saveSession({
      user_id: authStore.user?.id || '',
      username: authStore.user?.username || '',
      user_full_name: `${authStore.user?.first_name || ''} ${authStore.user?.last_name || ''}`.trim() || authStore.user?.username,
      interview_type: interviewType,
      topic,
      qualifications,
      cv_id: cfg.cvId || '',
      cv_title: cvTitle,
      cv_summary: cvSummary,
      attempt,
      planned_minutes: plannedMinutes,
      duration_seconds: duration,
      qa_pairs: qaPairs.value,   // includes model_answer now
      transcript,
      score: report.score,
      summary: report.summary,
      strengths: report.strengths,
      improvements: report.improvements,
      technical_assessment: report.technical_assessment,
      communication: report.communication,
      recommendation: report.recommendation
    });
  } catch (e) {
    console.error('Save interview failed:', e);
  }

  stopAllTracks();
}

function scoreClass(score: number): string {
  return score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low';
}

function leave() {
  router.push('/job-interview/results');
}

// ====== Practising again ======
/**
 * The interview that was just sat, as a config for sitting it again.
 *
 * Built from the CURRENT session rather than re-read from the service: the save
 * happens on a background path and a redo pressed straight after the report
 * appears must not depend on it having landed yet.
 */
function nextAttemptConfig() {
  const asked = qaPairs.value.map(qa => qa.question).filter(Boolean);
  return redoConfigFrom({
    interview_type: interviewType,
    topic,
    qualifications,
    planned_minutes: plannedMinutes,
    attempt,
    cv_id: cfg.cvId || '',
    cv_title: cvTitle,
    cv_summary: cvSummary,
  }, {
    // A different person each sitting, which is closer to the real thing than
    // meeting the same interviewer six times.
    interviewer: pickInterviewer().id,
    // This sitting's questions first -- they are the ones a candidate would
    // most obviously notice being asked again.
    avoidQuestions: [...asked, ...avoidQuestions].slice(0, MAX_AVOID_QUESTIONS),
  });
}

/** Straight back into the room, same setup, different questions. */
async function redoSameInterview() {
  sessionStorage.setItem('jobInterviewConfig', JSON.stringify(nextAttemptConfig()));
  // Out of the room and back in, rather than a push to the path we are already
  // on. This view reads its config once, at setup, and Vue Router reuses the
  // instance for a same-path navigation -- so a plain push would leave the
  // second interview running on the first one's state: same questions, expired
  // timer, report still on screen. Leaving unmounts it, which is also what
  // stops the camera and the speech synthesis.
  await router.replace('/job-interview');
  await router.push('/job-interview/session');
}

/** The same, but stopping at the form so the details can be changed first. */
function editAndRedo() {
  sessionStorage.setItem('jobInterviewPrefill', JSON.stringify(nextAttemptConfig()));
  router.push('/job-interview/pre-session');
}

onMounted(() => {
  if (!sessionStorage.getItem('jobInterviewConfig')) {
    router.replace('/job-interview/pre-session');
  }
});

onUnmounted(() => {
  isAnswering = false;
  recordingLoopActive = false;
  stopCurrentRecording();
  if (timerInterval) clearInterval(timerInterval);
  stopAllTracks();
  try { speechSynthesis.cancel(); } catch {}
});
</script>

<style src="@/assets/css/job-interview.css"></style>