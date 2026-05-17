<template>
  <div class="tm-meeting-room">
    <div class="tm-meeting-header">
      <div><strong>📍 Topic:</strong> <span>{{ displayTopic }}</span> <span class="tm-badge">{{ speechType }}</span></div>
      <div class="tm-signal-lights">
        <span class="tm-light green" :class="{on:lightGreen}"></span>
        <span class="tm-light yellow" :class="{on:lightYellow}"></span>
        <span class="tm-light red" :class="{on:lightRed}"></span>
        <span class="tm-timer-display">{{ timerDisplay }}</span>
      </div>
    </div>

    <div class="tm-bots-grid">
      <div v-for="bot in BOTS" :key="bot.key" class="tm-video-tile" :class="{ speaking: currentSpeaker === bot.key }" :id="`tile-${bot.key}`">
        <div class="tm-avatar-wrap" v-html="bot.svg"></div>
        <div class="tm-name-tag">{{ bot.label }}</div>
        <div class="tm-speaking-dot"></div>
      </div>
    </div>

    <div class="tm-user-panel">
      <div class="tm-video-tile self" :class="{ 'camera-off': !cameraEnabled, speaking: currentSpeaker === 'self' }">
        <div class="tm-user-video-wrap">
          <video ref="videoEl" autoplay muted playsinline></video>
          <div class="tm-face-box" ref="faceBoxEl"><div class="tm-face-box-label" ref="faceBoxLabelEl">face</div></div>
        </div>
        <div class="tm-camera-off-overlay">
          <div class="tm-camera-off-avatar">{{ userInitial }}</div>
          <div class="tm-camera-off-text">Camera Off</div>
        </div>
        <div class="tm-name-tag">👤 You ({{ userName }})</div>
        <div class="tm-speaking-dot"></div>
        <div class="tm-self-status">
          <span class="tm-status-icon" :class="{ muted: !micEnabled }">{{ micEnabled ? '🎤' : '🔇' }}</span>
          <span class="tm-status-icon" :class="{ muted: !cameraEnabled }">{{ cameraEnabled ? '📹' : '📷' }}</span>
          <span class="tm-status-icon" :class="{ muted: !faceDetected }">{{ faceDetected ? '😊' : '🙈' }}</span>
        </div>
        <div class="tm-focus-badge" v-if="focusBadgeText" :style="{ background: focusBadgeColor }">{{ focusBadgeText }}</div>
        <div class="tm-cam-debug" v-if="cameraAnalysisActive">
          <div><strong>AI:</strong> {{ detectionMethod }}</div>
          <div><strong>Frames:</strong> {{ dbgFrames }}</div>
          <div><strong>Face:</strong> {{ dbgVisibility }}%</div>
          <div><strong>Mic:</strong> {{ recordingStatus }}</div>
          <div v-if="chunksProcessed > 0"><strong>Chunks:</strong> {{ chunksProcessed }}</div>
        </div>
      </div>
    </div>

    <div class="tm-caption-box">
      <strong>{{ captionSpeaker }}:</strong>
      <span>{{ captionText }}</span>
    </div>

    <div class="tm-transcript-box">
      <h4>Your Live Transcript <span v-if="isSpeakingRef" style="color:#10b981;font-size:.85rem">🎤 Recording (Whisper AI)</span></h4>
      <div>{{ liveTranscript || (isSpeakingRef ? '🎙️ Listening... transcription appears every ~3 seconds' : '—') }}</div>
    </div>

    <div class="tm-controls">
      <button @click="startMeeting" :disabled="startBtnDisabled" class="tm-btn-primary">{{ startBtnText }}</button>
      <button @click="userSpeak" :disabled="speakBtnDisabled" class="tm-btn-success">🎤 I'm Ready to Speak</button>
      <button @click="userFinish" :disabled="finishBtnDisabled" class="tm-btn-warning">✋ I'm Done</button>
      <button @click="toggleMic" :disabled="!mediaReady" class="tm-btn-control" :class="{ off: !micEnabled }">{{ micEnabled ? '🎤 Mic On' : '🔇 Mic Off' }}</button>
      <button @click="toggleCamera" :disabled="!mediaReady" class="tm-btn-control" :class="{ off: !cameraEnabled }">{{ cameraEnabled ? '📹 Camera On' : '📷 Camera Off' }}</button>
      <button @click="$router.push('/toastmasters/results')" class="tm-btn-danger">Leave</button>
    </div>

    <div class="tm-reports-panel" v-if="reportsVisible">
      <h2>📋 Meeting Reports</h2>
      <div class="tm-report-card"><h3>⏱️ Timer Report</h3><p>{{ reports.timer }}</p></div>

      <!-- ✨ ENHANCED AH-COUNTER REPORT WITH FILLER CHIPS -->
      <div class="tm-report-card">
        <h3>🗣️ Ah-Counter Report</h3>
        <p>{{ reports.ah }}</p>
        <div v-if="sortedFillers.length > 0" class="tm-filler-section">
          <div class="tm-filler-section-title">📊 Filler Word Breakdown ({{ totalFillerCount }} total):</div>
          <div class="tm-filler-chips">
            <span v-for="[word, count] in sortedFillers" :key="word" class="tm-filler-chip">
              <span class="tm-filler-word">"{{ word }}"</span>
              <span class="tm-filler-count">×{{ count }}</span>
            </span>
          </div>
        </div>
        <div v-else-if="reportsVisible && !reports.ah.includes('⏳')" class="tm-filler-empty">
          ✨ Zero filler words — outstanding clarity!
        </div>
      </div>

      <div class="tm-report-card"><h3>✍️ Grammarian Report</h3><p>{{ reports.gram }}</p></div>
      <div class="tm-report-card"><h3>📋 Speech Evaluator Report</h3><p>{{ reports.speechEval }}</p></div>
      <div class="tm-report-card"><h3>🎯 General Evaluator Report</h3><p>{{ reports.generalEval }}</p></div>
      <div class="tm-report-card"><h3>📹 Body Language Analysis</h3><p style="white-space:pre-wrap">{{ reports.bodyLang }}</p></div>
      <button @click="$router.push('/toastmasters/results')" class="tm-btn-primary">View All Results →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { toastmastersService } from '@/services/toastmasters.service';
import { serviceRegistry } from '@/services/config';

const route = useRoute();
const authStore = useAuthStore();

const speechType = (route.query.type as string) || 'Prepared Speech';
const initialTopic = (route.query.topic as string) || 'Free Speech';
const minTime = parseInt((route.query.min_time as string) || '5');
const maxTime = parseInt((route.query.max_time as string) || '7');

const userName = computed(() => authStore.user?.first_name || authStore.user?.username || 'You');
const userInitial = computed(() => (userName.value[0] || 'U').toUpperCase());

// ====== Bot SVGs ======
const BOTS = [
  { key: 'toastmaster', label: '🎙️ Marcus — Toastmaster', svg: `<svg viewBox="0 0 200 200" class="tm-bot-svg" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="bg-marcus" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#1e1b4b"/></radialGradient></defs><rect width="200" height="200" fill="url(#bg-marcus)"/><path d="M 15 200 Q 20 150 65 140 L 135 140 Q 180 150 185 200 Z" fill="#1e293b"/><path d="M 82 140 L 100 168 L 118 140 Z" fill="#f8fafc"/><path d="M 95 168 L 105 168 L 110 200 L 90 200 Z" fill="#dc2626"/><path d="M 88 122 L 88 144 Q 100 150 112 144 L 112 122 Z" fill="#d99770"/><path d="M 55 88 Q 55 38 100 36 Q 145 38 145 88 L 145 105 Q 140 75 100 70 Q 60 75 55 105 Z" fill="#1a0f08"/><ellipse cx="100" cy="88" rx="40" ry="48" fill="#e8a778"/><path d="M 72 78 Q 82 74 90 78" stroke="#1a0f08" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M 110 78 Q 118 74 128 78" stroke="#1a0f08" stroke-width="2.8" fill="none" stroke-linecap="round"/><g class="eye-l"><ellipse cx="81" cy="89" rx="5" ry="3.5" fill="#fff"/><circle cx="81" cy="89" r="2.5" fill="#3d2818"/></g><g class="eye-r"><ellipse cx="119" cy="89" rx="5" ry="3.5" fill="#fff"/><circle cx="119" cy="89" r="2.5" fill="#3d2818"/></g><g class="mouth-group"><path class="lips-top" d="M 88 121 Q 94 117 100 120 Q 106 117 112 121" stroke="#8a3838" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse class="mouth-inside" cx="100" cy="124" rx="9" ry="2" fill="#4a1818"/><path class="lips-bottom" d="M 88 124 Q 100 132 112 124" stroke="#8a3838" stroke-width="2.2" fill="none" stroke-linecap="round"/></g></svg>` },
  { key: 'timer', label: '⏱️ Sara — Timer', svg: `<svg viewBox="0 0 200 200" class="tm-bot-svg" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="bg-sara" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#064e3b"/></radialGradient></defs><rect width="200" height="200" fill="url(#bg-sara)"/><path d="M 25 200 Q 30 130 60 100 L 140 100 Q 170 130 175 200 Z" fill="#a16236"/><path d="M 35 200 Q 40 155 75 145 L 125 145 Q 160 155 165 200 Z" fill="#10b981"/><path d="M 50 85 Q 50 38 100 35 Q 150 38 150 85 L 150 130 Q 145 95 138 80 Q 130 60 100 58 Q 70 60 62 80 Q 55 95 50 130 Z" fill="#a16236"/><ellipse cx="100" cy="90" rx="38" ry="46" fill="#fbcfa6"/><g class="eye-l"><ellipse cx="81" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="81" cy="91" r="2.5" fill="#2c5b3e"/></g><g class="eye-r"><ellipse cx="119" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="119" cy="91" r="2.5" fill="#2c5b3e"/></g><g class="mouth-group"><path class="lips-top" d="M 89 122 Q 94 118 100 121 Q 106 118 111 122" stroke="#c2185b" stroke-width="2.2" fill="#e91e63" stroke-linecap="round"/><ellipse class="mouth-inside" cx="100" cy="125" rx="8" ry="1.5" fill="#5a1530"/><path class="lips-bottom" d="M 89 125 Q 100 133 111 125" stroke="#c2185b" stroke-width="2.5" fill="#e91e63" stroke-linecap="round"/></g></svg>` },
  { key: 'ah', label: '🗣️ David — Ah-Counter', svg: `<svg viewBox="0 0 200 200" class="tm-bot-svg" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="bg-david" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#7c2d12"/></radialGradient></defs><rect width="200" height="200" fill="url(#bg-david)"/><path d="M 20 200 Q 25 150 70 142 L 130 142 Q 175 150 180 200 Z" fill="#475569"/><path d="M 56 80 Q 56 40 100 38 Q 144 40 144 80 Q 140 60 130 56 Q 115 50 100 52 Q 80 50 70 56 Q 60 60 56 80 Z" fill="#2c1810"/><ellipse cx="100" cy="90" rx="40" ry="46" fill="#d49a6e"/><g class="eye-l"><ellipse cx="81" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="81" cy="91" r="2.5" fill="#2c1810"/></g><g class="eye-r"><ellipse cx="119" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="119" cy="91" r="2.5" fill="#2c1810"/></g><circle cx="81" cy="91" r="10" fill="none" stroke="#1e293b" stroke-width="2.2"/><circle cx="119" cy="91" r="10" fill="none" stroke="#1e293b" stroke-width="2.2"/><path d="M 91 91 L 109 91" stroke="#1e293b" stroke-width="2.2"/><path d="M 87 124 Q 93 121 100 123 Q 107 121 113 124" stroke="#2c1810" stroke-width="3.5" fill="none" stroke-linecap="round"/><g class="mouth-group"><path class="lips-top" d="M 89 126 Q 95 124 100 126 Q 105 124 111 126" stroke="#7a3a3a" stroke-width="1.8" fill="none" stroke-linecap="round"/><ellipse class="mouth-inside" cx="100" cy="128" rx="8" ry="1.5" fill="#4a1818"/><path class="lips-bottom" d="M 89 128 Q 100 134 111 128" stroke="#7a3a3a" stroke-width="2" fill="none" stroke-linecap="round"/></g></svg>` },
  { key: 'grammarian', label: '✍️ Emma — Grammarian', svg: `<svg viewBox="0 0 200 200" class="tm-bot-svg" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="bg-emma" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#ec4899"/><stop offset="100%" stop-color="#831843"/></radialGradient></defs><rect width="200" height="200" fill="url(#bg-emma)"/><path d="M 22 200 Q 28 150 68 142 L 132 142 Q 172 150 178 200 Z" fill="#f9a8d4"/><ellipse cx="100" cy="55" rx="56" ry="38" fill="#1a0f08"/><circle cx="55" cy="65" r="13" fill="#1a0f08"/><circle cx="145" cy="65" r="13" fill="#1a0f08"/><circle cx="100" cy="32" r="13" fill="#1a0f08"/><ellipse cx="100" cy="92" rx="37" ry="44" fill="#8b5a3c"/><g class="eye-l"><ellipse cx="81" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="81" cy="91" r="2.5" fill="#3d2818"/></g><g class="eye-r"><ellipse cx="119" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="119" cy="91" r="2.5" fill="#3d2818"/></g><g class="mouth-group"><path class="lips-top" d="M 88 123 Q 94 119 100 122 Q 106 119 112 123" stroke="#9d2050" stroke-width="2.2" fill="#c84076" stroke-linecap="round"/><ellipse class="mouth-inside" cx="100" cy="126" rx="8" ry="1.5" fill="#5a1530"/><path class="lips-bottom" d="M 88 126 Q 100 134 112 126" stroke="#9d2050" stroke-width="2.5" fill="#c84076" stroke-linecap="round"/></g></svg>` },
  { key: 'speechEval', label: '📋 Sophia — Speech Evaluator', svg: `<svg viewBox="0 0 200 200" class="tm-bot-svg" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="bg-sophia" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#134e4a"/></radialGradient></defs><rect width="200" height="200" fill="url(#bg-sophia)"/><path d="M 35 200 Q 40 155 75 145 L 125 145 Q 160 155 165 200 Z" fill="#1e3a8a"/><path d="M 52 88 Q 52 36 100 34 Q 148 36 148 88 L 148 110 Q 142 90 100 60 Q 58 90 52 110 Z" fill="#d4a574"/><ellipse cx="100" cy="90" rx="38" ry="46" fill="#fbcfa6"/><g class="eye-l"><ellipse cx="81" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="81" cy="91" r="2.5" fill="#1e3a8a"/></g><g class="eye-r"><ellipse cx="119" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="119" cy="91" r="2.5" fill="#1e3a8a"/></g><ellipse cx="81" cy="91" rx="9" ry="7" fill="none" stroke="#2c2c2c" stroke-width="1.5"/><ellipse cx="119" cy="91" rx="9" ry="7" fill="none" stroke="#2c2c2c" stroke-width="1.5"/><g class="mouth-group"><path class="lips-top" d="M 89 123 Q 94 119 100 122 Q 106 119 111 123" stroke="#a85070" stroke-width="2" fill="#c97090" stroke-linecap="round"/><ellipse class="mouth-inside" cx="100" cy="126" rx="8" ry="1.5" fill="#5a1530"/><path class="lips-bottom" d="M 89 126 Q 100 133 111 126" stroke="#a85070" stroke-width="2.3" fill="#c97090" stroke-linecap="round"/></g></svg>` },
  { key: 'generalEval', label: '🎯 James — General Evaluator', svg: `<svg viewBox="0 0 200 200" class="tm-bot-svg" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="bg-james" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#64748b"/><stop offset="100%" stop-color="#0f172a"/></radialGradient></defs><rect width="200" height="200" fill="url(#bg-james)"/><path d="M 15 200 Q 22 150 65 140 L 135 140 Q 178 150 185 200 Z" fill="#374151"/><path d="M 60 90 Q 60 50 100 48 Q 140 50 140 90 Q 138 70 125 64 Q 110 60 100 62 Q 90 60 75 64 Q 62 70 60 90 Z" fill="#a8a29e"/><ellipse cx="100" cy="90" rx="40" ry="48" fill="#d4a382"/><g class="eye-l"><ellipse cx="81" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="81" cy="91" r="2.5" fill="#4a5568"/></g><g class="eye-r"><ellipse cx="119" cy="91" rx="5" ry="3.5" fill="#fff"/><circle cx="119" cy="91" r="2.5" fill="#4a5568"/></g><path d="M 86 124 Q 93 121 100 123 Q 107 121 114 124" stroke="#737373" stroke-width="3.2" fill="none" stroke-linecap="round"/><g class="mouth-group"><path class="lips-top" d="M 89 126 Q 95 124 100 126 Q 105 124 111 126" stroke="#7a3a3a" stroke-width="1.8" fill="none" stroke-linecap="round"/><ellipse class="mouth-inside" cx="100" cy="128" rx="8" ry="1.5" fill="#4a1818"/><path class="lips-bottom" d="M 89 128 Q 100 133 111 128" stroke="#7a3a3a" stroke-width="2" fill="none" stroke-linecap="round"/></g></svg>` }
];

// ====== State ======
const videoEl = ref<HTMLVideoElement>();
const faceBoxEl = ref<HTMLDivElement>();
const faceBoxLabelEl = ref<HTMLDivElement>();

const displayTopic = ref(initialTopic);
const currentSpeaker = ref<string | null>(null);
const captionSpeaker = ref('System');
const captionText = ref('Click "Start Meeting" to begin.');
const liveTranscript = ref('');
const startBtnDisabled = ref(false);
const startBtnText = ref('▶️ Start Meeting');
const speakBtnDisabled = ref(true);
const finishBtnDisabled = ref(true);
const mediaReady = ref(false);
const micEnabled = ref(true);
const cameraEnabled = ref(true);
const lightGreen = ref(false);
const lightYellow = ref(false);
const lightRed = ref(false);
const timerDisplay = ref('00:00');
const reportsVisible = ref(false);
const reports = reactive({ timer: '', ah: '', gram: '', speechEval: '', generalEval: '', bodyLang: '' });
const faceDetected = ref(false);
const focusBadgeText = ref('');
const focusBadgeColor = ref('#10B981');
const cameraAnalysisActive = ref(false);
const detectionMethod = ref('loading…');
const dbgFrames = ref(0);
const dbgVisibility = ref(0);
const recordingStatus = ref('—');
const isSpeakingRef = ref(false);
const chunksProcessed = ref(0);

// ✨ NEW: Filler word counts for visual breakdown
const fillerCounts = ref<Record<string, number>>({});
const sortedFillers = computed(() => {
  const entries = Object.entries(fillerCounts.value).filter(([_, c]) => c > 0);
  return entries.sort((a, b) => b[1] - a[1]); // descending by count
});
const totalFillerCount = computed(() =>
  Object.values(fillerCounts.value).reduce((sum, c) => sum + c, 0)
);

// Internal state
let mediaStream: MediaStream | null = null;
let transcript = '';
let isSpeaking = false;
let startTime = 0;
let timerInterval: any = null;
let wordOfTheDay = '';
let sampleSpeechText = '';
let voices: SpeechSynthesisVoice[] = [];
let blazefaceModel: any = null;
let nativeFaceDetector: any = null;
let analysisInterval: any = null;
let detectionCanvas: HTMLCanvasElement | null = null;
let videoIsMirrored: boolean | null = null;
let currentRecorder: MediaRecorder | null = null;
let recordingLoopActive = false;

const blStats = {
  frames: 0, faceVisibleFrames: 0, lookingForwardFrames: 0, lookingAwayFrames: 0, absentFrames: 0,
  consecutiveAwayFrames: 0, consecutiveAbsentFrames: 0, consecutiveFocusedFrames: 0,
  movements: 0, lastFaceCx: null as number | null, lastFaceCy: null as number | null,
  movementSum: 0, movementSamples: 0, recentMovements: [] as number[],
  centeredFrames: 0, cameraOffFrames: 0, stateCounts: {} as Record<string, number>
};

const FILLER_WORDS = ['um','uh','ah','er','like','you know','basically','well','so','actually','literally','right','okay'];
const BOT_GENDERS: Record<string, string> = { toastmaster:'male', timer:'female', ah:'male', grammarian:'female', speechEval:'female', generalEval:'male' };
const MALE_RE = /\b(male|david|mark|guy|james|george|ryan|daniel|alex|fred|tom)\b/i;
const FEMALE_RE = /\b(female|zira|hazel|samantha|karen|victoria|tessa|sara|emma|sophia|aria|jenny)\b/i;
const FOCUS_STATES: Record<string, { color: string; label: string }> = {
  excellent:{color:'#059669',label:'✨ Excellent'}, focused:{color:'#10B981',label:'🎯 Focused'},
  attentive:{color:'#22C55E',label:'👀 Attentive'}, restless:{color:'#FBBF24',label:'😅 Restless'},
  looking_away:{color:'#F59E0B',label:'↗️ Looking Away'}, distracted:{color:'#F97316',label:'🤔 Distracted'},
  away_briefly:{color:'#EF4444',label:'🚶 Away'}, absent:{color:'#7C2D12',label:'❌ Absent'}
};

function loadVoices() { voices = speechSynthesis.getVoices().filter(v => v.lang?.toLowerCase().startsWith('en')); }
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

function voiceFor(botKey: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const gender = BOT_GENDERS[botKey];
  let cands = voices.filter(v => gender === 'male' ? (MALE_RE.test(v.name) && !FEMALE_RE.test(v.name)) : (FEMALE_RE.test(v.name) && !MALE_RE.test(v.name)));
  if (cands.length === 0) cands = voices;
  const sameGenderBots = Object.entries(BOT_GENDERS).filter(([_, g]) => g === gender).map(([k]) => k);
  const idx = sameGenderBots.indexOf(botKey);
  return cands[idx % cands.length];
}

function speak(text: string, botKey: string): Promise<void> {
  return new Promise(resolve => {
    if (!text?.trim()) { resolve(); return; }
    captionSpeaker.value = BOTS.find(b => b.key === botKey)?.label || 'System';
    captionText.value = text;
    currentSpeaker.value = botKey;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voiceFor(botKey);
    if (v) u.voice = v;
    u.pitch = ({toastmaster:0.95,ah:1.05,timer:1.1,grammarian:0.95,speechEval:1.0,generalEval:0.9} as any)[botKey] || 1.0;
    u.onend = () => { currentSpeaker.value = null; resolve(); };
    u.onerror = () => { currentSpeaker.value = null; resolve(); };
    setTimeout(() => speechSynthesis.speak(u), 80);
  });
}

// ============================================================
// CAMERA ANALYSIS
// ============================================================
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-loaded="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = false; s.setAttribute('data-loaded', src);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed: ' + src));
    document.head.appendChild(s);
  });
}

async function ensureBlazeFace(): Promise<boolean> {
  if (typeof (window as any).blazeface !== 'undefined') return true;
  if (typeof (window as any).tf === 'undefined') {
    const tfUrls = ['https://cdn.jsdelivr.net/npm/@tensorflow/[email protected]/dist/tf.min.js', 'https://unpkg.com/@tensorflow/[email protected]/dist/tf.min.js'];
    let loaded = false;
    for (const url of tfUrls) { try { await loadScript(url); loaded = true; break; } catch {} }
    if (!loaded) return false;
  }
  const bfUrls = ['https://cdn.jsdelivr.net/npm/@tensorflow-models/[email protected]/dist/blazeface.min.js', 'https://unpkg.com/@tensorflow-models/[email protected]/dist/blazeface.min.js'];
  for (const url of bfUrls) { try { await loadScript(url); return true; } catch {} }
  return false;
}

async function loadFaceDetection() {
  detectionMethod.value = 'skin';
  if (await ensureBlazeFace()) {
    try { blazefaceModel = await (window as any).blazeface.load(); detectionMethod.value = '🤖 BlazeFace'; return; } catch {}
  }
  if ('FaceDetector' in window) {
    try { nativeFaceDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); detectionMethod.value = '🌐 Native API'; return; } catch {}
  }
  detectionMethod.value = '🎨 Skin Color';
}

function isSkinPixel(r: number, g: number, b: number): boolean {
  const Y = 0.299*r + 0.587*g + 0.114*b;
  const Cb = -0.169*r - 0.331*g + 0.500*b + 128;
  const Cr = 0.500*r - 0.419*g - 0.081*b + 128;
  if (Y > 60 && Y < 240 && Cb > 80 && Cb < 140 && Cr > 130 && Cr < 185) return true;
  if (r > 95 && g > 40 && b > 20 && Math.max(r,g,b) - Math.min(r,g,b) > 15 && Math.abs(r-g) > 12 && r > g && r > b) return true;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
  const s = mx ? (mx - mn) / mx : 0;
  if (mx > 35 && mx < 230 && s > 0.20 && s < 0.7 && r > g && r > b * 0.7) return true;
  return false;
}

function detectFaceSkin(video: HTMLVideoElement) {
  if (!detectionCanvas) detectionCanvas = document.createElement('canvas');
  const W = 160, H = 120;
  detectionCanvas.width = W; detectionCanvas.height = H;
  const ctx = detectionCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try { ctx.drawImage(video, 0, 0, W, H); } catch { return null; }
  let img; try { img = ctx.getImageData(0, 0, W, H); } catch { return null; }
  const px = img.data;
  let total = 0, sumX = 0, sumY = 0;
  const sm = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (isSkinPixel(px[i], px[i+1], px[i+2])) { sm[y * W + x] = 1; total++; sumX += x; sumY += y; }
  }
  if (total < 80) return null;
  const cx = sumX / total, cy = sumY / total;
  let vx = 0, vy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (sm[y * W + x]) { vx += (x - cx) ** 2; vy += (y - cy) ** 2; }
  }
  vx /= total; vy /= total;
  const hw = Math.sqrt(vx) * 1.8, hh = Math.sqrt(vy) * 1.8;
  const minX = Math.max(0, cx - hw), maxX = Math.min(W, cx + hw);
  const minY = Math.max(0, cy - hh), maxY = Math.min(H, cy + hh);
  if (maxX - minX < 20 || maxY - minY < 20) return null;
  const sx = video.videoWidth / W, sy = video.videoHeight / H;
  return { minX: minX * sx, minY: minY * sy, maxX: maxX * sx, maxY: maxY * sy, cx: cx * sx, cy: cy * sy, lookingForward: Math.abs(cx - W / 2) < W * 0.3 };
}

async function detectFace(video: HTMLVideoElement) {
  if (blazefaceModel) {
    try {
      const preds = await blazefaceModel.estimateFaces(video, false);
      if (preds?.length) {
        let best = preds[0];
        let ba = (best.bottomRight[0]-best.topLeft[0])*(best.bottomRight[1]-best.topLeft[1]);
        for (let i = 1; i < preds.length; i++) {
          const p = preds[i]; const a = (p.bottomRight[0]-p.topLeft[0])*(p.bottomRight[1]-p.topLeft[1]);
          if (a > ba) { best = p; ba = a; }
        }
        if (best.probability !== undefined) {
          const prob = Array.isArray(best.probability) ? best.probability[0] : best.probability;
          if (prob >= 0.7) {
            const [minX, minY] = best.topLeft, [maxX, maxY] = best.bottomRight;
            if (maxX - minX >= 25 && maxY - minY >= 25) {
              let lookingForward = true;
              if (best.landmarks?.length >= 3) {
                const [rE, lE, nose] = best.landmarks;
                const emX = (rE[0] + lE[0]) / 2, ed = Math.abs(rE[0] - lE[0]);
                if (ed > 0) lookingForward = Math.abs(nose[0] - emX) < ed * 0.4;
              }
              return { minX, minY, maxX, maxY, cx:(minX+maxX)/2, cy:(minY+maxY)/2, lookingForward };
            }
          }
        }
      }
    } catch {}
  }
  if (nativeFaceDetector) {
    try {
      const faces = await nativeFaceDetector.detect(video);
      if (faces?.length) {
        const bb = faces[0].boundingBox;
        if (bb.width >= 25 && bb.height >= 25) {
          return { minX: bb.x, minY: bb.y, maxX: bb.x + bb.width, maxY: bb.y + bb.height, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2, lookingForward: true };
        }
      }
    } catch {}
  }
  return detectFaceSkin(video);
}

function determineFocusState(face: any, recentMove: number): string {
  if (!face) return blStats.consecutiveAbsentFrames >= 3 ? 'absent' : 'away_briefly';
  if (!face.lookingForward) return blStats.consecutiveAwayFrames >= 6 ? 'distracted' : 'looking_away';
  if (recentMove > 35) return 'restless';
  if (blStats.consecutiveFocusedFrames >= 16) return 'excellent';
  if (blStats.consecutiveFocusedFrames >= 6) return 'focused';
  return 'attentive';
}

function detectVideoMirror(video: HTMLVideoElement): boolean {
  const t = window.getComputedStyle(video).transform || '';
  const m = t.match(/matrix\(([^)]+)\)/);
  if (m) { const v = m[1].split(',').map(x => parseFloat(x.trim())); if (v[0] < 0) return true; }
  return false;
}

function showFaceBox(face: any, stateInfo: { color: string; label: string }) {
  const box = faceBoxEl.value; const video = videoEl.value;
  if (!box || !video || !video.videoWidth) { if (box) box.style.display = 'none'; return; }
  const wrap = box.parentElement!;
  const wr = wrap.getBoundingClientRect(); const vr = video.getBoundingClientRect();
  if (wr.width <= 0 || vr.width <= 0) { box.style.display = 'none'; return; }
  const vw = video.videoWidth, vh = video.videoHeight;
  const ew = vr.width, eh = vr.height;
  let scale, padX, padY;
  if (vw / vh > ew / eh) { scale = eh / vh; padX = (ew - vw * scale) / 2; padY = 0; }
  else { scale = ew / vw; padX = 0; padY = (eh - vh * scale) / 2; }
  if (videoIsMirrored === null) videoIsMirrored = detectVideoMirror(video);
  let x = face.minX * scale + padX, y = face.minY * scale + padY;
  let w = (face.maxX - face.minX) * scale, h = (face.maxY - face.minY) * scale;
  if (videoIsMirrored) x = ew - x - w;
  x += (vr.left - wr.left); y += (vr.top - wr.top);
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > wr.width) w = wr.width - x;
  if (y + h > wr.height) h = wr.height - y;
  if (w < 14 || h < 14) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.style.left = x + 'px'; box.style.top = y + 'px';
  box.style.width = w + 'px'; box.style.height = h + 'px';
  box.style.borderColor = stateInfo.color;
  box.style.boxShadow = '0 0 22px ' + stateInfo.color + 'AA';
  if (faceBoxLabelEl.value) { faceBoxLabelEl.value.style.background = stateInfo.color; faceBoxLabelEl.value.textContent = stateInfo.label; }
}

async function analyzeFrame() {
  const video = videoEl.value;
  if (!video || video.readyState < 2 || !video.videoWidth) return;
  blStats.frames++;
  if (!cameraEnabled.value) {
    blStats.cameraOffFrames++; faceDetected.value = false;
    if (faceBoxEl.value) faceBoxEl.value.style.display = 'none';
    return;
  }
  let face = null;
  try { face = await detectFace(video); } catch {}
  if (face) {
    blStats.faceVisibleFrames++; blStats.consecutiveAbsentFrames = 0;
    if (face.lookingForward) { blStats.lookingForwardFrames++; blStats.consecutiveAwayFrames = 0; blStats.consecutiveFocusedFrames++; }
    else { blStats.lookingAwayFrames++; blStats.consecutiveAwayFrames++; blStats.consecutiveFocusedFrames = 0; }
    const cxN = face.cx / video.videoWidth;
    if (Math.abs(cxN - 0.5) < 0.30) blStats.centeredFrames++;
    if (blStats.lastFaceCx !== null) {
      const dist = Math.sqrt((face.cx - blStats.lastFaceCx) ** 2 + (face.cy - (blStats.lastFaceCy || 0)) ** 2);
      blStats.movementSum += dist; blStats.movementSamples++;
      blStats.recentMovements.push(dist);
      if (blStats.recentMovements.length > 6) blStats.recentMovements.shift();
      if (dist > 30) blStats.movements++;
    }
    blStats.lastFaceCx = face.cx; blStats.lastFaceCy = face.cy;
  } else {
    blStats.absentFrames++; blStats.consecutiveAbsentFrames++;
    blStats.consecutiveFocusedFrames = 0; blStats.consecutiveAwayFrames = 0;
  }
  const recentMove = blStats.recentMovements.length ? blStats.recentMovements.reduce((a, b) => a + b, 0) / blStats.recentMovements.length : 0;
  const stateKey = determineFocusState(face, recentMove);
  blStats.stateCounts[stateKey] = (blStats.stateCounts[stateKey] || 0) + 1;
  const stateInfo = FOCUS_STATES[stateKey] || FOCUS_STATES.focused;
  focusBadgeText.value = stateInfo.label;
  focusBadgeColor.value = stateInfo.color;
  if (face) { faceDetected.value = true; showFaceBox(face, stateInfo); }
  else { faceDetected.value = false; if (faceBoxEl.value) faceBoxEl.value.style.display = 'none'; }
  dbgFrames.value = blStats.frames;
  dbgVisibility.value = blStats.frames ? Math.round(blStats.faceVisibleFrames / blStats.frames * 100) : 0;
}

async function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 8000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (video?.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

async function startCameraAnalysis() {
  videoIsMirrored = null;
  await loadFaceDetection();
  if (videoEl.value) { const ready = await waitForVideoReady(videoEl.value); if (!ready) return; }
  cameraAnalysisActive.value = true;
  if (analysisInterval) clearInterval(analysisInterval);
  analysisInterval = setInterval(analyzeFrame, 350);
}

function stopCameraAnalysis() {
  if (analysisInterval) clearInterval(analysisInterval);
  analysisInterval = null;
  cameraAnalysisActive.value = false;
  if (faceBoxEl.value) faceBoxEl.value.style.display = 'none';
}

function getBodyLanguageData() {
  const total = blStats.frames || 1;
  const facePct = blStats.faceVisibleFrames / total * 100;
  const fwdPct = blStats.lookingForwardFrames / total * 100;
  const centeredPct = blStats.centeredFrames / total * 100;
  const avgMove = blStats.movementSamples ? blStats.movementSum / blStats.movementSamples : 0;
  const engagement = Math.min(100, Math.max(0, Math.round(facePct * 0.30 + fwdPct * 0.40 + centeredPct * 0.20 + Math.max(0, 100 - avgMove * 2) * 0.10)));
  return {
    frames_analyzed: total, faces_detected: blStats.faceVisibleFrames,
    face_visibility_percent: +(facePct).toFixed(1), looking_forward_percent: +(fwdPct).toFixed(1),
    looking_away_percent: +(blStats.lookingAwayFrames / total * 100).toFixed(1),
    absent_percent: +(blStats.absentFrames / total * 100).toFixed(1),
    centered_percent: +(centeredPct).toFixed(1), camera_off_percent: +(blStats.cameraOffFrames / total * 100).toFixed(1),
    avg_movement: Math.round(avgMove), engagement_score: engagement, detection_method: detectionMethod.value
  };
}

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
    alert('Camera/microphone permission denied: ' + e.message);
    return false;
  }
}

// ============================================================
// WHISPER-BASED TRANSCRIPTION
// ============================================================

function getPreferredMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

async function transcribeAudioBlob(blob: Blob, chunkIndex: number): Promise<void> {
  if (blob.size < 1000) return;
  try {
    const baseUrl = await serviceRegistry.getRandomToastmastersReplica();
    if (!baseUrl) return;
    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');
    const token = import.meta.env.VITE_AUTH_TOKEN;
    const response = await fetch(`${baseUrl}/api/toastmasters/transcribe`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}` },
      body: formData
    });
    if (response.ok) {
      const result = await response.json();
      const text = (result.text || '').trim();
      if (text) {
        transcript += ' ' + text;
        liveTranscript.value = transcript.trim();
        console.log(`[Whisper] Chunk #${chunkIndex} ✓ "${text}"`);
        chunksProcessed.value++;
      }
    }
  } catch (e: any) {
    console.error(`[Whisper] Chunk #${chunkIndex} error:`, e.message);
  }
}

async function recordOneChunk(chunkIndex: number, durationMs: number): Promise<void> {
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
    } catch (e) { resolve(); return; }
    const chunks: Blob[] = [];
    let stopTimeoutId: any = null;
    recorder.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.onerror = (e: any) => console.error('[Recorder]', e.error?.name || e);
    recorder.onstop = () => {
      if (stopTimeoutId) clearTimeout(stopTimeoutId);
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        transcribeAudioBlob(blob, chunkIndex);
      }
      currentRecorder = null;
      resolve();
    };
    currentRecorder = recorder;
    try { recorder.start(); } catch (e) { resolve(); return; }
    stopTimeoutId = setTimeout(() => {
      if (recorder.state === 'recording') { try { recorder.stop(); } catch {} }
    }, durationMs);
  });
}

async function startContinuousRecording() {
  if (recordingLoopActive) return;
  recordingLoopActive = true;
  recordingStatus.value = '🎤 Recording';
  chunksProcessed.value = 0;
  let chunkIndex = 0;
  while (isSpeaking && micEnabled.value) {
    chunkIndex++;
    await recordOneChunk(chunkIndex, 3500);
    if (isSpeaking) await new Promise(r => setTimeout(r, 50));
  }
  recordingLoopActive = false;
  recordingStatus.value = '—';
}

function stopCurrentRecording() {
  if (currentRecorder && currentRecorder.state === 'recording') {
    try { currentRecorder.stop(); } catch {}
  }
  currentRecorder = null;
}

function toggleMic() {
  micEnabled.value = !micEnabled.value;
  if (mediaStream) mediaStream.getAudioTracks().forEach(t => t.enabled = micEnabled.value);
  if (!micEnabled.value && currentRecorder) stopCurrentRecording();
}

function toggleCamera() {
  cameraEnabled.value = !cameraEnabled.value;
  if (mediaStream) mediaStream.getVideoTracks().forEach(t => t.enabled = cameraEnabled.value);
}

function startTimer() {
  startTime = Date.now();
  const minSec = minTime * 60, maxSec = maxTime * 60, midSec = (minSec + maxSec) / 2;
  timerInterval = setInterval(() => {
    const el = Math.floor((Date.now() - startTime) / 1000);
    timerDisplay.value = `${String(Math.floor(el / 60)).padStart(2, '0')}:${String(el % 60).padStart(2, '0')}`;
    lightGreen.value = el >= minSec;
    lightYellow.value = el >= midSec;
    lightRed.value = el >= maxSec;
  }, 200);
}

function countFillers(text: string): { counts: Record<string, number>; total: number } {
  const t = ' ' + text.toLowerCase().replace(/[^\w\s']/g, ' ') + ' ';
  const counts: Record<string, number> = {}; let total = 0;
  FILLER_WORDS.forEach(w => {
    const re = new RegExp(`\\s${w.replace(' ', '\\s')}\\s`, 'g');
    const m = t.match(re); if (m) { counts[w] = m.length; total += m.length; }
  });
  const st = text.match(/\b(\w+)(\s+\1){2,}/gi);
  if (st) { counts['repeated words'] = st.length; total += st.length; }
  return { counts, total };
}

// ============================================================
// MAIN FLOW
// ============================================================

async function startMeeting() {
  startBtnDisabled.value = true;
  startBtnText.value = '⏳ Setting up...';
  captionText.value = 'Requesting camera and microphone…';
  if (!(await initMedia())) { startBtnDisabled.value = false; startBtnText.value = '▶️ Start Meeting'; return; }
  if (typeof MediaRecorder === 'undefined') {
    alert('Your browser does not support audio recording. Please use Chrome, Edge, Firefox, or Safari.');
    startBtnDisabled.value = false; startBtnText.value = '▶️ Start Meeting'; return;
  }
  captionText.value = 'Loading AI face detection…';
  await startCameraAnalysis();
  if (voices.length === 0) { await new Promise(r => setTimeout(r, 400)); loadVoices(); }
  if (speechType === 'Table Topics (Impromptu)') {
    captionText.value = 'Generating your impromptu question...';
    const q = await toastmastersService.callBot('table-topic', {});
    if (q) displayTopic.value = q;
  }
  captionText.value = 'Bots are preparing...';
  const [intro, timerIntro, ahIntro, gramIntro, seIntro, geIntro] = await Promise.all([
    toastmastersService.callBot('toastmaster', { stage: 'intro', topic: displayTopic.value, speech_type: speechType, user_name: userName.value }),
    toastmastersService.callBot('timer', { stage: 'intro', min_time: minTime, max_time: maxTime }),
    toastmastersService.callBot('ah-counter', { stage: 'intro' }),
    toastmastersService.callBot('grammarian', { stage: 'intro' }),
    toastmastersService.callBot('speech-evaluator', { stage: 'intro' }),
    toastmastersService.callBot('general-evaluator', { stage: 'intro' })
  ]);
  await speak(intro || `Welcome ${userName.value}!`, 'toastmaster');
  await speak(timerIntro || '', 'timer');
  await speak(ahIntro || '', 'ah');
  try {
    const m = (gramIntro || '').match(/\{[\s\S]*\}/);
    if (m) { const j = JSON.parse(m[0]); wordOfTheDay = j.word || ''; await speak(`${j.intro} Today's Word of the Day is "${j.word}", meaning: ${j.meaning}.`, 'grammarian'); }
    else { wordOfTheDay = 'eloquent'; await speak("Hi, I'm Emma.", 'grammarian'); }
  } catch { wordOfTheDay = 'eloquent'; await speak("Hi, I'm Emma.", 'grammarian'); }
  await speak(seIntro || '', 'speechEval');
  await speak(geIntro || '', 'generalEval');

  if (speechType === 'Evaluation Speech') {
    const intro2 = await toastmastersService.callBot('toastmaster', { stage: 'evalspeech_intro' });
    await speak(intro2 || '', 'toastmaster');
    captionText.value = 'Preparing sample speech...';
    sampleSpeechText = await toastmastersService.callBot('sample-speech', {}) || 'Three years ago, I lost my job. I started a business that failed. But that failure taught me everything.';
    captionSpeaker.value = '🎙️ Marcus (Sample)'; captionText.value = 'Listen carefully...'; currentSpeaker.value = 'toastmaster';
    await new Promise<void>(r => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(sampleSpeechText);
      const v = voiceFor('toastmaster'); if (v) u.voice = v;
      u.rate = 0.95; u.pitch = 0.92;
      u.onend = () => { currentSpeaker.value = null; r(); };
      u.onerror = () => { currentSpeaker.value = null; r(); };
      setTimeout(() => speechSynthesis.speak(u), 100);
    });
    const ho = await toastmastersService.callBot('toastmaster', { stage: 'evalspeech_handover', user_name: userName.value });
    await speak(ho || '', 'toastmaster');
  } else if (speechType === 'Ice Breaker' && !cameraEnabled.value) {
    const msg = await toastmastersService.callBot('toastmaster', { stage: 'icebreaker_camera', user_name: userName.value });
    await speak(msg || 'Please turn on your camera.', 'toastmaster');
    let waited = 0;
    while (!cameraEnabled.value && waited < 30000) { await new Promise(r => setTimeout(r, 1000)); waited += 1000; }
  }
  if (speechType !== 'Evaluation Speech') {
    const handover = await toastmastersService.callBot('toastmaster', { stage: 'handover', topic: displayTopic.value, user_name: userName.value, speech_type: speechType });
    await speak(handover || `Please welcome ${userName.value}!`, 'toastmaster');
  }
  await new Promise(r => setTimeout(r, 500));
  speakBtnDisabled.value = false;
  captionText.value = 'Click "I\'m Ready to Speak" when ready.';
  startBtnText.value = '✓ Started';
}

function userSpeak() {
  if (!micEnabled.value) { alert('Please unmute your microphone first.'); return; }
  if (!mediaStream) { alert('Microphone not initialized.'); return; }
  if (typeof MediaRecorder === 'undefined') { alert('Audio recording not supported in your browser.'); return; }
  speechSynthesis.cancel();
  isSpeaking = true;
  isSpeakingRef.value = true;
  transcript = '';
  liveTranscript.value = '';
  startContinuousRecording().catch(e => console.error('[Recording]', e));
  startTimer();
  speakBtnDisabled.value = true;
  finishBtnDisabled.value = false;
  captionSpeaker.value = 'You';
  captionText.value = '🎤 Speak now! Your words will appear below every ~3 seconds (Whisper AI)';
}

async function userFinish() {
  isSpeaking = false;
  isSpeakingRef.value = false;
  stopCurrentRecording();
  await new Promise(r => setTimeout(r, 800));
  captionText.value = 'Finalizing transcription...';
  await new Promise(r => setTimeout(r, 1500));
  clearInterval(timerInterval);
  currentSpeaker.value = null;
  const duration = Math.floor((Date.now() - startTime) / 1000);
  finishBtnDisabled.value = true;
  const fillers = countFillers(transcript);

  // ✨ Save filler counts for visual display
  fillerCounts.value = { ...fillers.counts };

  const onTime = duration >= minTime * 60 && duration <= maxTime * 60;
  const cleanTranscript = transcript.trim() || '(no speech captured)';

  reportsVisible.value = true;
  reports.timer = '⏳ Generating...'; reports.ah = '⏳ Generating...';
  reports.gram = '⏳ Analyzing with AI...'; reports.speechEval = '⏳ Analyzing with AI...';
  reports.generalEval = '⏳ Analyzing with AI...'; reports.bodyLang = '⏳ Analyzing...';

  const closing = await toastmastersService.callBot('toastmaster', { stage: 'closing', user_name: userName.value });
  await speak(closing || '', 'toastmaster');

  reports.timer = await toastmastersService.callBot('timer', { stage: 'report', duration, min_time: minTime, max_time: maxTime }) || `${Math.floor(duration / 60)}m ${duration % 60}s.`;
  await speak(reports.timer, 'timer');

  reports.ah = await toastmastersService.callBot('ah-counter', { stage: 'report', counts: fillers.counts, total: fillers.total }) || `I counted ${fillers.total} filler words.`;
  await speak(reports.ah, 'ah');

  reports.gram = await toastmastersService.callBot('grammarian', { stage: 'report', transcript: cleanTranscript }) || 'Good language overall.';
  await speak(reports.gram, 'grammarian');

  reports.speechEval = await toastmastersService.callBot('speech-evaluator', { stage: 'report', transcript: cleanTranscript, topic: displayTopic.value, speech_type: speechType, sample_speech: sampleSpeechText }) || 'Solid effort.';
  await speak(reports.speechEval, 'speechEval');

  stopCameraAnalysis();
  const blData = getBodyLanguageData();
  const blAdvice = await toastmastersService.callBot('body-language', { body_language: blData }) || 'Maintain eye contact.';
  reports.bodyLang = `Engagement: ${blData.engagement_score}/100 | Face visible: ${blData.face_visibility_percent}% | Looking forward: ${blData.looking_forward_percent}% | Centered: ${blData.centered_percent}%\n\n${blAdvice}`;

  reports.generalEval = await toastmastersService.callBot('general-evaluator', { stage: 'report', transcript: cleanTranscript, speech_type: speechType, topic: displayTopic.value, duration, total_fillers: fillers.total, on_time: onTime, min_time: minTime, max_time: maxTime, engagement_score: blData.engagement_score }) || 'Good meeting overall.';
  await speak(reports.generalEval, 'generalEval');

  const timeScore = onTime ? 40 : Math.max(0, 40 - Math.abs(duration - (minTime * 60 + maxTime * 60) / 2) / 3);
  const wc = transcript.split(/\s+/).filter(Boolean).length || 1;
  const fillerScore = Math.max(0, 30 - (fillers.total / wc) * 300);
  const bodyScore = blData.engagement_score * 0.3;
  const overall = Math.round(timeScore + fillerScore + bodyScore);

  try {
    await toastmastersService.saveSession({
      user_id: authStore.user?.id || '', username: authStore.user?.username || '',
      user_first_name: authStore.user?.first_name || '', user_last_name: authStore.user?.last_name || '',
      user_full_name: `${authStore.user?.first_name || ''} ${authStore.user?.last_name || ''}`.trim() || authStore.user?.username,
      topic: displayTopic.value, speech_type: speechType,
      min_time: minTime, max_time: maxTime,
      duration_seconds: duration, transcript: transcript.trim(),
      sample_speech_text: sampleSpeechText,
      filler_counts: fillers.counts, total_fillers: fillers.total,
      word_of_the_day: wordOfTheDay,
      grammarian_report: reports.gram, ah_counter_report: reports.ah, timer_report: reports.timer,
      speech_evaluator_report: reports.speechEval, general_evaluator_report: reports.generalEval,
      body_language_data: blData, body_language_advice: blAdvice,
      overall_score: overall
    });
  } catch (e) { console.error('Save session failed:', e); }

  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
}

onUnmounted(() => {
  isSpeaking = false;
  recordingLoopActive = false;
  stopCurrentRecording();
  stopCameraAnalysis();
  if (timerInterval) clearInterval(timerInterval);
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  speechSynthesis.cancel();
});
</script>

<style src="@/assets/css/toastmasters.css"></style>