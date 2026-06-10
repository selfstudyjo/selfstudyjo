<template>
  <div class="ji-meeting-room">
    <div class="ji-meeting-header">
      <div>
        <strong>💼 {{ interviewType }} Interview</strong>
        <span class="ji-badge" v-if="topic && interviewType === 'Technical'">{{ topic }}</span>
      </div>
      <div class="ji-header-right">
        <span class="ji-q-counter" v-if="phase !== 'idle'">Q {{ Math.min(questionNumber, maxQuestions) }} / {{ maxQuestions }}</span>
        <span class="ji-timer-display" :class="{ over: timeUp }">{{ timerDisplay }}</span>
      </div>
    </div>

    <div class="ji-stage">
      <!-- Interviewer -->
      <div class="ji-video-tile ji-interviewer" :class="{ speaking: currentSpeaker === 'interviewer' }">
        <div class="ji-avatar-wrap" v-html="interviewerSvg"></div>
        <div class="ji-name-tag">{{ interviewerLabel }}</div>
        <div class="ji-speaking-dot"></div>
      </div>

      <!-- User -->
      <div class="ji-video-tile ji-self" :class="{ 'camera-off': !cameraEnabled, speaking: phase === 'answering' }">
        <div class="ji-user-video-wrap">
          <video ref="videoEl" autoplay muted playsinline></video>
        </div>
        <div class="ji-camera-off-overlay">
          <div class="ji-camera-off-avatar">{{ userInitial }}</div>
          <div class="ji-camera-off-text">Camera Off</div>
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

    <!-- Controls -->
    <div class="ji-controls" v-if="!reportVisible">
      <button @click="startInterview" :disabled="phase !== 'idle' || starting" class="ji-btn-primary">
        {{ startBtnText }}
      </button>
      <button @click="startAnswering" :disabled="phase !== 'awaiting'" class="ji-btn-success">🎤 Start Answering</button>
      <button @click="submitAnswer" :disabled="phase !== 'answering'" class="ji-btn-warning">✅ Submit Answer</button>
      <button @click="toggleMic" :disabled="!mediaReady" class="ji-btn-control" :class="{ off: !micEnabled }">{{ micEnabled ? '🎤 Mic On' : '🔇 Mic Off' }}</button>
      <button @click="toggleCamera" :disabled="!mediaReady" class="ji-btn-control" :class="{ off: !cameraEnabled }">{{ cameraEnabled ? '📹 Camera On' : '📷 Camera Off' }}</button>
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
        <h3>💬 Questions, Your Answers & Model Answers ({{ qaPairs.length }})</h3>
        <div class="ji-qa-list">
          <div v-for="(qa, i) in qaPairs" :key="i" class="ji-qa-item">
            <div class="ji-qa-q">Q{{ i + 1 }}. {{ qa.question }}</div>
            <div class="ji-qa-a"><span class="ji-qa-a-label">🗣️ Your answer:</span> {{ qa.answer || '(no answer captured)' }}</div>
            <div class="ji-qa-model" v-if="qa.model_answer">
              <span class="ji-qa-model-label">⭐ Model answer (for training):</span>
              {{ qa.model_answer }}
            </div>
          </div>
          <div v-if="qaPairs.length === 0" style="color:var(--ji-text-mute)">No questions were answered.</div>
        </div>
      </div>

      <div class="ji-controls">
        <button @click="$router.push('/job-interview/results')" class="ji-btn-primary">View All Results →</button>
        <button @click="$router.push('/job-interview/pre-session')" class="ji-btn-secondary">Practice Again</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { jobInterviewService, type QAPair, type EvaluationResult } from '@/services/jobinterview.service';

const router = useRouter();
const authStore = useAuthStore();

// ====== Config from pre-session ======
interface Config { type: string; topic: string; qualifications: string; minutes: number; }
let cfg: Config = { type: 'Technical', topic: '', qualifications: '', minutes: 15 };
try {
  const raw = sessionStorage.getItem('jobInterviewConfig');
  if (raw) cfg = JSON.parse(raw);
} catch { /* ignore */ }

const interviewType = cfg.type || 'Technical';
const topic = cfg.topic || '';
const qualifications = cfg.qualifications || '';
const plannedMinutes = Math.max(3, Math.min(60, cfg.minutes || 15));

const maxQuestions = Math.max(4, Math.min(12, Math.round(plannedMinutes / 1.5)));

const userName = computed(() => authStore.user?.first_name || authStore.user?.username || 'Candidate');
const userInitial = computed(() => (userName.value[0] || 'U').toUpperCase());

// ====== Interviewer persona / avatar ======
const INTERVIEWER_MALE = `<svg viewBox="0 0 200 200" class="ji-bot-svg" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="ji-bg-m" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#1e1b4b"/></radialGradient></defs><rect width="200" height="200" fill="url(#ji-bg-m)"/><path d="M 15 200 Q 20 150 65 140 L 135 140 Q 180 150 185 200 Z" fill="#1e293b"/><path d="M 82 140 L 100 168 L 118 140 Z" fill="#f8fafc"/><path d="M 95 168 L 105 168 L 110 200 L 90 200 Z" fill="#3b82f6"/><path d="M 88 122 L 88 144 Q 100 150 112 144 L 112 122 Z" fill="#d99770"/><path d="M 55 88 Q 55 38 100 36 Q 145 38 145 88 L 145 105 Q 140 75 100 70 Q 60 75 55 105 Z" fill="#1a0f08"/><ellipse cx="100" cy="88" rx="40" ry="48" fill="#e8a778"/><path d="M 72 78 Q 82 74 90 78" stroke="#1a0f08" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M 110 78 Q 118 74 128 78" stroke="#1a0f08" stroke-width="2.8" fill="none" stroke-linecap="round"/><g class="eye-l"><ellipse cx="81" cy="89" rx="5" ry="3.5" fill="#fff"/><circle cx="81" cy="89" r="2.5" fill="#3d2818"/></g><g class="eye-r"><ellipse cx="119" cy="89" rx="5" ry="3.5" fill="#fff"/><circle cx="119" cy="89" r="2.5" fill="#3d2818"/></g><g class="mouth-group"><path class="lips-top" d="M 88 121 Q 94 117 100 120 Q 106 117 112 121" stroke="#8a3838" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse class="mouth-inside" cx="100" cy="124" rx="9" ry="2" fill="#4a1818"/><path class="lips-bottom" d="M 88 124 Q 100 132 112 124" stroke="#8a3838" stroke-width="2.2" fill="none" stroke-linecap="round"/></g></svg>`;
const INTERVIEWER_FEMALE = `<svg viewBox="0 0 200 200" class="ji-bot-svg" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="ji-bg-f" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#134e4a"/></radialGradient></defs><rect width="200" height="200" fill="url(#ji-bg-f)"/><path d="M 35 200 Q 40 155 75 145 L 125 145 Q 160 155 165 200 Z" fill="#1e3a8a"/><path d="M 52 88 Q 52 36 100 34 Q 148 36 148 88 L 148 110 Q 142 90 100 60 Q 58 90 52 110 Z" fill="#5a3825"/><ellipse cx="100" cy="90" rx="38" ry="46" fill="#fbcfa6"/><g class="eye-l"><ellipse cx="81" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="81" cy="91" r="2.5" fill="#1e3a8a"/></g><g class="eye-r"><ellipse cx="119" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="119" cy="91" r="2.5" fill="#1e3a8a"/></g><g class="mouth-group"><path class="lips-top" d="M 89 123 Q 94 119 100 122 Q 106 119 111 123" stroke="#a85070" stroke-width="2" fill="#c97090" stroke-linecap="round"/><ellipse class="mouth-inside" cx="100" cy="126" rx="8" ry="1.5" fill="#5a1530"/><path class="lips-bottom" d="M 89 126 Q 100 133 111 126" stroke="#a85070" stroke-width="2.3" fill="#c97090" stroke-linecap="round"/></g></svg>`;

const isHR = interviewType === 'HR';
const interviewerName = isHR ? 'Rachel' : 'Alex';
const interviewerLabel = computed(() => `${isHR ? '🤝' : '🛠️'} ${interviewerName} — ${isHR ? 'HR Manager' : 'Technical Interviewer'}`);
const interviewerSvg = isHR ? INTERVIEWER_FEMALE : INTERVIEWER_MALE;

// ====== Local fallback questions (vary by number so they never repeat) ======
const HR_FALLBACKS = [
  'Tell me about yourself and your professional background.',
  'Why are you interested in this role and our company?',
  'Describe a challenging situation at work and how you handled it.',
  'What are your greatest strengths, and one area you are working to improve?',
  'Tell me about a time you worked in a team to achieve a difficult goal.',
  'Where do you see yourself in five years?',
  'How do you handle pressure and competing deadlines?',
  'Why should we hire you over other candidates?',
  'Describe a time you received difficult feedback. How did you respond?',
  'Do you have any questions for us?'
];
function techFallbacks(t: string) {
  const r = t || 'this field';
  return [
    `Can you walk me through your hands-on experience related to ${r}?`,
    `What core concepts should every ${r} professional master, and why?`,
    `Describe the most difficult technical problem you solved involving ${r}.`,
    `How do you approach debugging a complex, intermittent issue in ${r}?`,
    `What best practices and design principles do you follow when working with ${r}?`,
    `How do you keep your ${r} skills current with industry changes?`,
    `Describe a project where you applied ${r} and the impact it had.`,
    `What tools, frameworks or technologies do you rely on for ${r} work?`,
    `How would you explain a complex ${r} concept to a non-technical stakeholder?`,
    `Tell me about a trade-off decision you made in a ${r} project.`
  ];
}
function fallbackQuestion(qnum: number): string {
  const arr = isHR ? HR_FALLBACKS : techFallbacks(topic);
  return arr[(qnum - 1) % arr.length];
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
const cameraEnabled = ref(true);

const timerDisplay = ref('00:00');
const timeUp = ref(false);

const reportVisible = ref(false);
const report = reactive<EvaluationResult>({
  score: 0, summary: '', strengths: '', improvements: '',
  technical_assessment: '', communication: '', recommendation: ''
});

// Internal
let mediaStream: MediaStream | null = null;
let startTime = 0;
let timerInterval: any = null;
let answerBuffer = '';
let isAnswering = false;
let recordingLoopActive = false;
let currentRecorder: MediaRecorder | null = null;
let voices: SpeechSynthesisVoice[] = [];

const MALE_RE = /\b(male|david|mark|guy|james|george|ryan|daniel|alex|fred|tom)\b/i;
const FEMALE_RE = /\b(female|zira|hazel|samantha|karen|victoria|tessa|sara|emma|sophia|aria|jenny|rachel)\b/i;

function loadVoices() { voices = speechSynthesis.getVoices().filter(v => v.lang?.toLowerCase().startsWith('en')); }
loadVoices();
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = loadVoices;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  let cands = voices.filter(v => isHR ? (FEMALE_RE.test(v.name) && !MALE_RE.test(v.name)) : (MALE_RE.test(v.name) && !FEMALE_RE.test(v.name)));
  if (cands.length === 0) cands = voices;
  return cands[0];
}

function speak(text: string): Promise<void> {
  return new Promise(resolve => {
    if (!text?.trim()) { resolve(); return; }
    captionSpeaker.value = interviewerName;
    captionText.value = text;
    currentSpeaker.value = 'interviewer';
    try { speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.pitch = isHR ? 1.05 : 0.95;
    u.rate = 1.0;
    u.onend = () => { currentSpeaker.value = null; resolve(); };
    u.onerror = () => { currentSpeaker.value = null; resolve(); };
    setTimeout(() => { try { speechSynthesis.speak(u); } catch { resolve(); } }, 80);
  });
}

// ====== Media ======
async function initMedia(): Promise<boolean> {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    if (videoEl.value) {
      videoEl.value.srcObject = mediaStream;
      await new Promise<void>(r => {
        if (videoEl.value!.readyState >= 2) r();
        else videoEl.value!.onloadedmetadata = () => videoEl.value!.play().then(() => r()).catch(() => r());
      });
    }
    mediaReady.value = true;
    return true;
  } catch (e: any) {
    alert('Camera/microphone permission denied: ' + (e?.message || e));
    return false;
  }
}

function toggleMic() {
  micEnabled.value = !micEnabled.value;
  if (mediaStream) mediaStream.getAudioTracks().forEach(t => t.enabled = micEnabled.value);
  if (!micEnabled.value) stopCurrentRecording();
}

function toggleCamera() {
  cameraEnabled.value = !cameraEnabled.value;
  if (mediaStream) mediaStream.getVideoTracks().forEach(t => t.enabled = cameraEnabled.value);
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
    if (!mediaStream) { resolve(); return; }
    const audioTracks = mediaStream.getAudioTracks();
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
  captionText.value = 'Requesting camera and microphone…';
  if (!(await initMedia())) { starting.value = false; startBtnText.value = '▶️ Start Interview'; return; }
  if (typeof MediaRecorder === 'undefined') {
    alert('Your browser does not support audio recording. Please use Chrome, Edge, Firefox, or Safari.');
    starting.value = false; startBtnText.value = '▶️ Start Interview'; return;
  }
  if (voices.length === 0) { await new Promise(r => setTimeout(r, 400)); loadVoices(); }

  phase.value = 'intro';
  captionText.value = 'Interviewer is joining…';
  const intro = await jobInterviewService.callInterviewer({
    stage: 'intro', interview_type: interviewType, topic, qualifications, user_name: userName.value
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
    question_number: questionNumber.value,
    previous_qa: qaPairs.value
  });
  currentQuestionText.value = (q && q.trim()) ? q.trim() : fallbackQuestion(questionNumber.value);
  await speak(currentQuestionText.value);
  phase.value = 'awaiting';
  captionSpeaker.value = 'System';
  captionText.value = 'Click "Start Answering" when you are ready to respond.';
}

function startAnswering() {
  if (!micEnabled.value) { alert('Please unmute your microphone first.'); return; }
  if (!mediaStream) { alert('Microphone not initialized.'); return; }
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
    stage: 'closing', interview_type: interviewType, topic, user_name: userName.value
  });
  await speak(closing || `Thank you ${userName.value}. I'll share some feedback now.`);

  const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

  // Run evaluation + model answers in parallel
  captionText.value = 'Generating feedback and model answers…';
  const questions = qaPairs.value.map(qa => qa.question);

  const [evalResult, modelAnswers] = await Promise.all([
    jobInterviewService.evaluate({
      interview_type: interviewType, topic, qualifications, qa_pairs: qaPairs.value
    }),
    questions.length > 0
      ? jobInterviewService.getModelAnswers({ interview_type: interviewType, topic, qualifications, questions })
      : Promise.resolve([] as string[])
  ]);

  // Attach model answers to each Q&A
  qaPairs.value.forEach((qa, i) => {
    qa.model_answer = modelAnswers[i] || '';
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

  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
}

function scoreClass(score: number): string {
  return score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low';
}

function leave() {
  router.push('/job-interview/results');
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
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  try { speechSynthesis.cancel(); } catch {}
});
</script>

<style src="@/assets/css/job-interview.css"></style>