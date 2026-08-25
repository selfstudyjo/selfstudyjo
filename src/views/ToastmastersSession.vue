<template>
  <div class="tm-meeting-room">
    <div class="tm-meeting-header">
      <div>
        <strong>{{ $t('🎭 Role:') }}</strong>
        <span class="tm-badge" :style="paint(roleBadgeColor)">{{ userRole }}</span>
        <template v-if="userRole==='Speaker'">
          <strong style="margin-left:.75rem">{{ $t('📍 Topic:') }}</strong> <span>{{ displayTopic }}</span>
          <span class="tm-badge">{{ speechType }}</span>
        </template>
      </div>
      <div class="tm-signal-lights">
        <span class="tm-light green" :class="{on:lightGreen}"></span>
        <span class="tm-light yellow" :class="{on:lightYellow}"></span>
        <span class="tm-light red" :class="{on:lightRed}"></span>
        <span class="tm-timer-display">{{ timerDisplay }}</span>
      </div>
    </div>

    <!-- Role task info -->
    <div v-if="roleTaskInfo && userRole!=='Speaker'" style="background:linear-gradient(135deg,#1e1b4b,#312e81);color:#e0e7ff;padding:12px 18px;border-radius:10px;margin-bottom:12px;font-size:.92rem;line-height:1.5;border:1px solid #4338ca">
      <strong>{{ $t('🎭 Your Role:') }}</strong> {{ userRole }}<br>
      <strong>{{ $t('📋 Task:') }}</strong> {{ roleTaskInfo }}
    </div>

    <div class="tm-bots-grid">
      <div v-for="(seat, i) in SEATS" :key="seat.key" class="tm-video-tile" :class="{ speaking: currentSpeaker === seat.key }">
        <!-- `phase` staggers the six idle drifts; in unison they read as a screensaver. -->
        <SpeakerMedia
          :actor="seat.actor"
          :speaking="currentSpeaker === seat.key"
          :phase="i * 1.7"
          :alt="seatLabel(seat)"
        />
        <div class="tm-name-tag">{{ seatLabel(seat) }}</div>
        <div class="tm-speaking-dot"></div>
      </div>
    </div>

    <div class="tm-user-panel">
      <div class="tm-video-tile self" :class="{ 'camera-off': !cameraEnabled, speaking: currentSpeaker === 'self' }">
        <div class="tm-user-video-wrap">
          <video ref="videoEl" autoplay muted playsinline></video>
          <div class="tm-face-box" ref="faceBoxEl"><div class="tm-face-box-label" ref="faceBoxLabelEl">{{ $t('face') }}</div></div>
        </div>
        <div class="tm-camera-off-overlay">
          <div class="tm-camera-off-avatar">{{ userInitial }}</div>
          <div class="tm-camera-off-text">{{ $t('Camera Off') }}</div>
        </div>
        <div class="tm-name-tag">{{ $t('👤 You ({v0}) —', { v0: userName }) }} <strong>{{ userRole }}</strong></div>
        <div class="tm-speaking-dot"></div>
        <div class="tm-self-status">
          <span class="tm-status-icon" :class="{ muted: !micEnabled }">{{ micEnabled ? '🎤' : '🔇' }}</span>
          <span class="tm-status-icon" :class="{ muted: !cameraEnabled }">{{ cameraEnabled ? '📹' : '📷' }}</span>
          <span class="tm-status-icon" :class="{ muted: !faceDetected }">{{ faceDetected ? '😊' : '🙈' }}</span>
        </div>
        <div class="tm-focus-badge" v-if="focusBadgeText" :style="paint(focusBadgeColor)">{{ focusBadgeText }}</div>
        <div class="tm-cam-debug" v-if="cameraAnalysisActive">
          <div><strong>AI:</strong> {{ detectionMethod }}</div>
          <div><strong>{{ $t('Frames:') }}</strong> {{ dbgFrames }}</div>
          <div><strong>{{ $t('Face:') }}</strong> {{ dbgVisibility }}%</div>
          <div><strong>{{ $t('Mic:') }}</strong> {{ recordingStatus }}</div>
          <div v-if="chunksProcessed > 0"><strong>{{ $t('Chunks:') }}</strong> {{ chunksProcessed }}</div>
        </div>
      </div>
    </div>

    <div class="tm-caption-box">
      <strong>{{ captionSpeaker }}:</strong>
      <span>{{ captionText }}</span>
    </div>

    <div class="tm-transcript-box">
      <h4>{{ $t('Your Live Transcript') }} <span v-if="isSpeakingRef" style="color:#10b981;font-size:.85rem">{{ $t('🎤 Recording (Whisper AI)') }}</span></h4>
      <div>{{ liveTranscript || (isSpeakingRef ? '🎙️ Listening... transcription appears every ~3 seconds' : '—') }}</div>
    </div>

    <div class="tm-controls">
      <button @click="startMeeting" :disabled="startBtnDisabled" class="tm-btn-primary">{{ startBtnText }}</button>
      <button v-if="showSkipIntro" @click="doSkipIntro" :disabled="didSkipIntro" class="tm-btn-warning" style="font-size:.9rem">{{ didSkipIntro ? '⏩ Skipped' : '⏩ Skip Intro' }}</button>
      <button @click="userSpeak" :disabled="speakBtnDisabled" class="tm-btn-success">{{ speakBtnLabel }}</button>
      <button @click="userFinish" :disabled="finishBtnDisabled" class="tm-btn-warning">{{ $t('✋ I\'m Done') }}</button>
      <button v-if="showSkipReports" @click="doSkipReports" :disabled="didSkipReports" class="tm-btn-warning" style="font-size:.9rem">{{ didSkipReports ? '⏩ Skipped' : '⏩ Skip Reports' }}</button>
      <button @click="toggleMic" :disabled="!mediaReady" class="tm-btn-control" :class="{ off: !micEnabled }">{{ micEnabled ? '🎤 Mic On' : '🔇 Mic Off' }}</button>
      <button @click="toggleCamera" :disabled="!mediaReady" class="tm-btn-control" :class="{ off: !cameraEnabled }">{{ cameraEnabled ? '📹 Camera On' : '📷 Camera Off' }}</button>
      <button @click="doLeave" class="tm-btn-danger">{{ $t('Leave') }}</button>
    </div>

    <div class="tm-reports-panel" v-if="reportsVisible">
      <h2>{{ $t('📋 Meeting Reports') }}</h2>
      <div v-if="reports.roleEval && userRole!=='Speaker'" class="tm-report-card">
        <h3>{{ $t('🎭 {v0} Role Evaluation', { v0: userRole }) }}</h3><p>{{ reports.roleEval }}</p>
      </div>
      <div class="tm-report-card"><h3>{{ $t('⏱️ Timer Report') }}</h3><p>{{ reports.timer }}</p></div>
      <div class="tm-report-card">
        <h3>{{ $t('🗣️ Ah-Counter Report') }}</h3>
        <p>{{ reports.ah }}</p>
        <div v-if="sortedFillers.length > 0" class="tm-filler-section">
          <div class="tm-filler-section-title">{{ $t('📊 Filler Word Breakdown ({v0} total):', { v0: totalFillerCount }) }}</div>
          <div class="tm-filler-chips">
            <span v-for="[word, count] in sortedFillers" :key="word" class="tm-filler-chip">
              <span class="tm-filler-word">"{{ word }}"</span>
              <span class="tm-filler-count">×{{ count }}</span>
            </span>
          </div>
        </div>
        <div v-else-if="reportsVisible && !reports.ah.includes('⏳')" class="tm-filler-empty">
          {{ $t('✨ Zero filler words — outstanding clarity!') }}
        </div>
      </div>
      <div class="tm-report-card"><h3>{{ $t('✍️ Grammarian Report') }}</h3><p>{{ reports.gram }}</p></div>
      <div class="tm-report-card"><h3>{{ $t('📋 Speech Evaluator Report') }}</h3><p>{{ reports.speechEval }}</p></div>
      <div class="tm-report-card"><h3>{{ $t('🎯 General Evaluator Report') }}</h3><p>{{ reports.generalEval }}</p></div>
      <div class="tm-report-card"><h3>{{ $t('📹 Body Language Analysis') }}</h3><p style="white-space:pre-wrap">{{ reports.bodyLang }}</p></div>
      <button @click="doLeave" class="tm-btn-primary">{{ $t('View All Results →') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { aiLanguage, aiLanguageHeaders, localeId } from '@/i18n/runtime';
import { planSpeech } from '@/utils/roomSpeech';
import { ref, computed, onUnmounted, reactive } from 'vue';
import { paint } from '@/theme/contrast';
import SpeakerMedia from '@/components/cast/SpeakerMedia.vue';
import { SEATS, actorById, seatByKey, seatGenders, seatLabel } from '@/cast/actors';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { toastmastersService } from '@/services/toastmasters.service';
import { serviceRegistry } from '@/services/config';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// ═══════ CONFIG ═══════
const userRole = (route.query.role as string) || 'Speaker';
const speechType = (route.query.type as string) || 'Prepared Speech';
const initialTopic = (route.query.topic as string) || 'Free Speech';
const minTime = parseInt((route.query.min_time as string) || '5');
const maxTime = parseInt((route.query.max_time as string) || '7');

const ROLE_COLORS: Record<string, string> = {
  Speaker: '#4f46e5', Toastmaster: '#7c3aed', Timer: '#10b981',
  'Ah-Counter': '#f59e0b', Grammarian: '#ec4899',
  'Speech Evaluator': '#14b8a6', 'General Evaluator': '#64748b',
};
const roleBadgeColor = ROLE_COLORS[userRole] || '#4f46e5';

const userName = computed(() => authStore.user?.first_name || authStore.user?.username || 'You');
const userInitial = computed(() => (userName.value[0] || 'U').toUpperCase());
const speakBtnLabel = computed(() => {
  if (userRole === 'Speaker') return "🎤 I'm Ready to Speak";
  const m: Record<string, string> = {
    Toastmaster: '🎙️ Start Hosting', Timer: '⏱️ Timer Report',
    'Ah-Counter': '🗣️ Ah-Counter Report', Grammarian: '✍️ Grammarian Report',
    'Speech Evaluator': '📋 Deliver Eval', 'General Evaluator': '🎯 General Eval',
  };
  return m[userRole] || "🎤 I'm Ready to Speak";
});

// ═══════ STATE ═══════
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
const reports = reactive({ timer: '', ah: '', gram: '', speechEval: '', generalEval: '', bodyLang: '', roleEval: '' });
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
const roleTaskInfo = ref('');

// Skip buttons
const showSkipIntro = ref(false);
const didSkipIntro = ref(false);
const showSkipReports = ref(false);
const didSkipReports = ref(false);

const fillerCounts = ref<Record<string, number>>({});
const sortedFillers = computed(() => {
  const entries = Object.entries(fillerCounts.value).filter(([_, c]) => c > 0);
  return entries.sort((a, b) => b[1] - a[1]);
});
const totalFillerCount = computed(() => Object.values(fillerCounts.value).reduce((sum, c) => sum + c, 0));

// Internals
let mediaStream: MediaStream | null = null;
let transcript = '';
let isSpeaking = false;
let startTime = 0;
let timerInterval: any = null;
let wordOfTheDay = '';
let sampleSpeechText = '';
let sampleSpeechDuration = 0;
let sampleSpeechFillers: { counts: Record<string, number>; total: number } = { counts: {}, total: 0 };
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
// Who is in each seat, and therefore what each one should sound like, comes from
// the cast — it used to be a second copy of the same fact here, which agreed with
// the pictures only by coincidence.
const BOT_GENDERS = seatGenders();
const FOCUS_STATES: Record<string, { color: string; label: string }> = {
  excellent:{color:'#059669',label:'✨ Excellent'}, focused:{color:'#10B981',label:'🎯 Focused'},
  attentive:{color:'#22C55E',label:'👀 Attentive'}, restless:{color:'#FBBF24',label:'😅 Restless'},
  looking_away:{color:'#F59E0B',label:'↗️ Looking Away'}, distracted:{color:'#F97316',label:'🤔 Distracted'},
  away_briefly:{color:'#EF4444',label:'🚶 Away'}, absent:{color:'#7C2D12',label:'❌ Absent'}
};

/*
 * EVERY voice the device has, not just the English ones.
 *
 * This filtered `startsWith('en')`, which was correct while the meeting was
 * English-only and became the reason it fell silent in Arabic: the filter ran
 * once at mount, so switching language could not bring an Arabic voice back
 * even on a machine that had one. `planSpeech` filters per line against the
 * current locale instead — and it is the only thing that knows a
 * wrong-language voice must never be cast, because an assigned
 * `utterance.voice` overrides `utterance.lang` and an English engine handed
 * Arabic characters produces noise rather than an accent.
 */
function loadVoices() { voices = speechSynthesis.getVoices(); }
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

/**
 * The voice for one seat, and whether it is the right gender for the person on
 * that tile.
 *
 * `seat` is the seat's position among the same-gender seats, so the three men
 * do not all get the one male voice the browser has. `matched` is passed on to
 * the pitch, because now that the tiles are photographs of actual people a
 * mismatch is a man's face speaking in a woman's voice — a fault the newscast
 * was reported for four times.
 */
function voiceFor(botKey: string) {
  const gender = BOT_GENDERS[botKey] || 'male';
  const sameGenderSeats = SEATS.filter(s => BOT_GENDERS[s.key] === gender).map(s => s.key);
  const seat = Math.max(0, sameGenderSeats.indexOf(botKey));
  // `seat` still spreads the six around whatever voices exist, so the three men
  // are not all read by the one male voice the browser has — that property is
  // per language now rather than English-only.
  return { gender, ...planSpeech(voices, localeId.value, gender, seat, false) };
}

/** `🎙️ Marcus — Toastmaster`, or a plain label for the stand-in sample speaker. */
function speakerLabel(botKey: string, fallback: string): string {
  const seat = seatByKey(botKey);
  return seat ? seatLabel(seat) : fallback;
}

/**
 * The sample speech is delivered by whoever holds the Toastmaster seat, so the
 * caption names them rather than saying "Marcus" in a string of its own — the
 * face on that tile is the cast's business, not this view's.
 */
const sampleSpeakerCaption = (() => {
  const seat = seatByKey('toastmaster');
  return seat ? `${seat.emoji} ${actorById(seat.actor).name} (Sample)` : '🎙️ Sample Speaker';
})();

function speak(text: string, botKey: string): Promise<void> {
  return new Promise(resolve => {
    if (!text?.trim()) { resolve(); return; }
    captionSpeaker.value = speakerLabel(botKey, 'System');
    captionText.value = text;
    // Skip TTS if user clicked skip intro
    if (didSkipIntro.value && !isSpeaking) { setTimeout(resolve, 80); return; }
    // Skip TTS if user clicked skip reports
    if (didSkipReports.value && reportsVisible.value) { setTimeout(resolve, 80); return; }
    currentSpeaker.value = botKey;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const cast = voiceFor(botKey);
    if (cast.voice) u.voice = cast.voice as SpeechSynthesisVoice;
    // Set whether or not a voice was cast. With none assigned, `lang` is the
    // only thing telling the platform what language the text is in — and an
    // unassigned voice with a correct `lang` frequently reaches an OS voice
    // that `getVoices()` never listed at all.
    u.lang = cast.lang;
    u.pitch = cast.pitch;
    u.onend = () => { currentSpeaker.value = null; resolve(); };
    u.onerror = () => { currentSpeaker.value = null; resolve(); };
    setTimeout(() => speechSynthesis.speak(u), 80);
  });
}

/** Force-speak: always plays TTS, ignores skip flags (for sample speeches) */
function speakForced(text: string, botKey: string): Promise<void> {
  return new Promise(resolve => {
    if (!text?.trim()) { resolve(); return; }
    captionSpeaker.value = speakerLabel(botKey, '🎙️ Sample Speaker');
    captionText.value = text;
    currentSpeaker.value = botKey;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const cast = voiceFor(botKey);
    if (cast.voice) u.voice = cast.voice as SpeechSynthesisVoice;
    u.lang = cast.lang;
    // A shade slower and lower than the same seat's ordinary delivery: this is a
    // set-piece speech being performed, not a line of meeting business.
    u.rate = 0.95; u.pitch = cast.pitch - 0.03;
    const t0 = Date.now();
    u.onend = () => { sampleSpeechDuration = Math.floor((Date.now() - t0) / 1000); currentSpeaker.value = null; resolve(); };
    u.onerror = () => { sampleSpeechDuration = Math.floor((Date.now() - t0) / 1000); currentSpeaker.value = null; resolve(); };
    setTimeout(() => speechSynthesis.speak(u), 100);
  });
}

// ═══════ SKIP HANDLERS ═══════
function doSkipIntro() {
  didSkipIntro.value = true;
  speechSynthesis.cancel();
  currentSpeaker.value = null;
  captionText.value = 'Intro skipped — jumping ahead…';
}
function doSkipReports() {
  didSkipReports.value = true;
  speechSynthesis.cancel();
  currentSpeaker.value = null;
  captionText.value = 'Reports skipped — saving results…';
}

// ═══════ CAMERA ANALYSIS (identical to original) ═══════
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-loaded="${src}"]`)) return resolve();
    const s = document.createElement('script'); s.src = src; s.async = false; s.setAttribute('data-loaded', src);
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed: ' + src));
    document.head.appendChild(s);
  });
}
async function ensureBlazeFace(): Promise<boolean> {
  if (typeof (window as any).blazeface !== 'undefined') return true;
  if (typeof (window as any).tf === 'undefined') {
    for (const url of ['https://cdn.jsdelivr.net/npm/@tensorflow/[email protected]/dist/tf.min.js','https://unpkg.com/@tensorflow/[email protected]/dist/tf.min.js']) { try { await loadScript(url); break; } catch {} }
    if (typeof (window as any).tf === 'undefined') return false;
  }
  for (const url of ['https://cdn.jsdelivr.net/npm/@tensorflow-models/[email protected]/dist/blazeface.min.js','https://unpkg.com/@tensorflow-models/[email protected]/dist/blazeface.min.js']) { try { await loadScript(url); return true; } catch {} }
  return false;
}
async function loadFaceDetection() {
  detectionMethod.value = 'skin';
  if (await ensureBlazeFace()) { try { blazefaceModel = await (window as any).blazeface.load(); detectionMethod.value = '🤖 BlazeFace'; return; } catch {} }
  if ('FaceDetector' in window) { try { nativeFaceDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); detectionMethod.value = '🌐 Native API'; return; } catch {} }
  detectionMethod.value = '🎨 Skin Color';
}
function isSkinPixel(r:number,g:number,b:number):boolean{const Y=.299*r+.587*g+.114*b,Cb=-.169*r-.331*g+.5*b+128,Cr=.5*r-.419*g-.081*b+128;if(Y>60&&Y<240&&Cb>80&&Cb<140&&Cr>130&&Cr<185)return true;if(r>95&&g>40&&b>20&&Math.max(r,g,b)-Math.min(r,g,b)>15&&Math.abs(r-g)>12&&r>g&&r>b)return true;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),s=mx?(mx-mn)/mx:0;return mx>35&&mx<230&&s>.2&&s<.7&&r>g&&r>b*.7}
function detectFaceSkin(video:HTMLVideoElement){if(!detectionCanvas)detectionCanvas=document.createElement('canvas');const W=160,H=120;detectionCanvas.width=W;detectionCanvas.height=H;const ctx=detectionCanvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;try{ctx.drawImage(video,0,0,W,H)}catch{return null}let img;try{img=ctx.getImageData(0,0,W,H)}catch{return null}const px=img.data;let total=0,sumX=0,sumY=0;const sm=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(isSkinPixel(px[i],px[i+1],px[i+2])){sm[y*W+x]=1;total++;sumX+=x;sumY+=y}}if(total<80)return null;const cx=sumX/total,cy=sumY/total;let vx=0,vy=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(sm[y*W+x]){vx+=(x-cx)**2;vy+=(y-cy)**2}}vx/=total;vy/=total;const hw=Math.sqrt(vx)*1.8,hh=Math.sqrt(vy)*1.8;const minX=Math.max(0,cx-hw),maxX=Math.min(W,cx+hw),minY=Math.max(0,cy-hh),maxY=Math.min(H,cy+hh);if(maxX-minX<20||maxY-minY<20)return null;const sx=video.videoWidth/W,sy=video.videoHeight/H;return{minX:minX*sx,minY:minY*sy,maxX:maxX*sx,maxY:maxY*sy,cx:cx*sx,cy:cy*sy,lookingForward:Math.abs(cx-W/2)<W*.3}}
async function detectFace(video:HTMLVideoElement){if(blazefaceModel){try{const preds=await blazefaceModel.estimateFaces(video,false);if(preds?.length){let best=preds[0];let ba=(best.bottomRight[0]-best.topLeft[0])*(best.bottomRight[1]-best.topLeft[1]);for(let i=1;i<preds.length;i++){const p=preds[i];const a=(p.bottomRight[0]-p.topLeft[0])*(p.bottomRight[1]-p.topLeft[1]);if(a>ba){best=p;ba=a}}if(best.probability!==undefined){const prob=Array.isArray(best.probability)?best.probability[0]:best.probability;if(prob>=.7){const[minX,minY]=best.topLeft,[maxX,maxY]=best.bottomRight;if(maxX-minX>=25&&maxY-minY>=25){let lookingForward=true;if(best.landmarks?.length>=3){const[rE,lE,nose]=best.landmarks;const emX=(rE[0]+lE[0])/2,ed=Math.abs(rE[0]-lE[0]);if(ed>0)lookingForward=Math.abs(nose[0]-emX)<ed*.4}return{minX,minY,maxX,maxY,cx:(minX+maxX)/2,cy:(minY+maxY)/2,lookingForward}}}}}}catch{}}if(nativeFaceDetector){try{const faces=await nativeFaceDetector.detect(video);if(faces?.length){const bb=faces[0].boundingBox;if(bb.width>=25&&bb.height>=25)return{minX:bb.x,minY:bb.y,maxX:bb.x+bb.width,maxY:bb.y+bb.height,cx:bb.x+bb.width/2,cy:bb.y+bb.height/2,lookingForward:true}}}catch{}}return detectFaceSkin(video)}
function determineFocusState(face:any,recentMove:number):string{if(!face)return blStats.consecutiveAbsentFrames>=3?'absent':'away_briefly';if(!face.lookingForward)return blStats.consecutiveAwayFrames>=6?'distracted':'looking_away';if(recentMove>35)return'restless';if(blStats.consecutiveFocusedFrames>=16)return'excellent';if(blStats.consecutiveFocusedFrames>=6)return'focused';return'attentive'}
function detectVideoMirror(video:HTMLVideoElement):boolean{const t=window.getComputedStyle(video).transform||'';const m=t.match(/matrix\(([^)]+)\)/);if(m){const v=m[1].split(',').map(x=>parseFloat(x.trim()));if(v[0]<0)return true}return false}
function showFaceBox(face:any,stateInfo:{color:string;label:string}){const box=faceBoxEl.value;const video=videoEl.value;if(!box||!video||!video.videoWidth){if(box)box.style.display='none';return}const wrap=box.parentElement!;const wr=wrap.getBoundingClientRect();const vr=video.getBoundingClientRect();if(wr.width<=0||vr.width<=0){box.style.display='none';return}const vw=video.videoWidth,vh=video.videoHeight,ew=vr.width,eh=vr.height;let scale,padX,padY;if(vw/vh>ew/eh){scale=eh/vh;padX=(ew-vw*scale)/2;padY=0}else{scale=ew/vw;padX=0;padY=(eh-vh*scale)/2}if(videoIsMirrored===null)videoIsMirrored=detectVideoMirror(video);let x=face.minX*scale+padX,y=face.minY*scale+padY,w=(face.maxX-face.minX)*scale,h=(face.maxY-face.minY)*scale;if(videoIsMirrored)x=ew-x-w;x+=(vr.left-wr.left);y+=(vr.top-wr.top);if(x<0){w+=x;x=0}if(y<0){h+=y;y=0}if(x+w>wr.width)w=wr.width-x;if(y+h>wr.height)h=wr.height-y;if(w<14||h<14){box.style.display='none';return}box.style.display='block';box.style.left=x+'px';box.style.top=y+'px';box.style.width=w+'px';box.style.height=h+'px';box.style.borderColor=stateInfo.color;box.style.boxShadow='0 0 22px '+stateInfo.color+'AA';if(faceBoxLabelEl.value){faceBoxLabelEl.value.style.background=stateInfo.color;faceBoxLabelEl.value.textContent=stateInfo.label}}
async function analyzeFrame(){const video=videoEl.value;if(!video||video.readyState<2||!video.videoWidth)return;blStats.frames++;if(!cameraEnabled.value){blStats.cameraOffFrames++;faceDetected.value=false;if(faceBoxEl.value)faceBoxEl.value.style.display='none';return}let face=null;try{face=await detectFace(video)}catch{}if(face){blStats.faceVisibleFrames++;blStats.consecutiveAbsentFrames=0;if(face.lookingForward){blStats.lookingForwardFrames++;blStats.consecutiveAwayFrames=0;blStats.consecutiveFocusedFrames++}else{blStats.lookingAwayFrames++;blStats.consecutiveAwayFrames++;blStats.consecutiveFocusedFrames=0}const cxN=face.cx/video.videoWidth;if(Math.abs(cxN-.5)<.3)blStats.centeredFrames++;if(blStats.lastFaceCx!==null){const dist=Math.sqrt((face.cx-blStats.lastFaceCx)**2+(face.cy-(blStats.lastFaceCy||0))**2);blStats.movementSum+=dist;blStats.movementSamples++;blStats.recentMovements.push(dist);if(blStats.recentMovements.length>6)blStats.recentMovements.shift();if(dist>30)blStats.movements++}blStats.lastFaceCx=face.cx;blStats.lastFaceCy=face.cy}else{blStats.absentFrames++;blStats.consecutiveAbsentFrames++;blStats.consecutiveFocusedFrames=0;blStats.consecutiveAwayFrames=0}const recentMove=blStats.recentMovements.length?blStats.recentMovements.reduce((a,b)=>a+b,0)/blStats.recentMovements.length:0;const stateKey=determineFocusState(face,recentMove);blStats.stateCounts[stateKey]=(blStats.stateCounts[stateKey]||0)+1;const stateInfo=FOCUS_STATES[stateKey]||FOCUS_STATES.focused;focusBadgeText.value=stateInfo.label;focusBadgeColor.value=stateInfo.color;if(face){faceDetected.value=true;showFaceBox(face,stateInfo)}else{faceDetected.value=false;if(faceBoxEl.value)faceBoxEl.value.style.display='none'}dbgFrames.value=blStats.frames;dbgVisibility.value=blStats.frames?Math.round(blStats.faceVisibleFrames/blStats.frames*100):0}
async function waitForVideoReady(video:HTMLVideoElement,timeoutMs=8000):Promise<boolean>{const start=Date.now();while(Date.now()-start<timeoutMs){if(video?.readyState>=2&&video.videoWidth>0&&video.videoHeight>0)return true;await new Promise(r=>setTimeout(r,100))}return false}
async function startCameraAnalysis(){videoIsMirrored=null;await loadFaceDetection();if(videoEl.value){const ready=await waitForVideoReady(videoEl.value);if(!ready)return}cameraAnalysisActive.value=true;if(analysisInterval)clearInterval(analysisInterval);analysisInterval=setInterval(analyzeFrame,350)}
function stopCameraAnalysis(){if(analysisInterval)clearInterval(analysisInterval);analysisInterval=null;cameraAnalysisActive.value=false;if(faceBoxEl.value)faceBoxEl.value.style.display='none'}
function getBodyLanguageData(){const total=blStats.frames||1;const facePct=blStats.faceVisibleFrames/total*100;const fwdPct=blStats.lookingForwardFrames/total*100;const centeredPct=blStats.centeredFrames/total*100;const avgMove=blStats.movementSamples?blStats.movementSum/blStats.movementSamples:0;const engagement=Math.min(100,Math.max(0,Math.round(facePct*.3+fwdPct*.4+centeredPct*.2+Math.max(0,100-avgMove*2)*.1)));return{frames_analyzed:total,faces_detected:blStats.faceVisibleFrames,face_visibility_percent:+(facePct).toFixed(1),looking_forward_percent:+(fwdPct).toFixed(1),looking_away_percent:+(blStats.lookingAwayFrames/total*100).toFixed(1),absent_percent:+(blStats.absentFrames/total*100).toFixed(1),centered_percent:+(centeredPct).toFixed(1),camera_off_percent:+(blStats.cameraOffFrames/total*100).toFixed(1),avg_movement:Math.round(avgMove),engagement_score:engagement,detection_method:detectionMethod.value}}

// ═══════ MEDIA (identical to original) ═══════
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
  } catch (e: any) { alert('Camera/microphone permission denied: ' + e.message); return false; }
}

// ═══════ WHISPER TRANSCRIPTION (identical to original) ═══════
function getPreferredMimeType(): string {
  const types = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus','audio/ogg'];
  for (const t of types) { if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t; }
  return '';
}
async function transcribeAudioBlob(blob: Blob, chunkIndex: number): Promise<void> {
  if (blob.size < 1000) return;
  try {
    const baseUrl = await serviceRegistry.getRandomToastmastersReplica();
    if (!baseUrl) return;
    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');
    formData.append('language', aiLanguage());
    const token = import.meta.env.VITE_AUTH_TOKEN;
    const response = await fetch(`${baseUrl}/api/toastmasters/transcribe`, {
      method: 'POST', headers: {
   'Authorization': `Token ${token}`,
 // The language the answer is being SPOKEN in, so Whisper transcribes it
 // rather than transliterating it. Sent as a form field as well as a
 // header: this is a multipart upload, and `language.py` reads the body
 // first — but `request.get_json(silent=True)` sees nothing in a multipart
 // request, so the header is what actually carries it here. Both are sent
 // so that neither the service nor a future proxy has to be the one that
 // works.
   ...aiLanguageHeaders(),
 }, body: formData
    });
    if (response.ok) {
      const result = await response.json();
      const text = (result.text || '').trim();
      if (text) { transcript += ' ' + text; liveTranscript.value = transcript.trim(); chunksProcessed.value++; }
    }
  } catch (e: any) { console.error(`[Whisper] Chunk #${chunkIndex} error:`, e.message); }
}
async function recordOneChunk(chunkIndex: number, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!mediaStream) { resolve(); return; }
    const audioTracks = mediaStream.getAudioTracks();
    if (!audioTracks.length) { resolve(); return; }
    const audioStream = new MediaStream(audioTracks);
    const mimeType = getPreferredMimeType();
    let recorder: MediaRecorder;
    try { recorder = mimeType ? new MediaRecorder(audioStream, { mimeType, audioBitsPerSecond: 64000 }) : new MediaRecorder(audioStream); }
    catch { resolve(); return; }
    const chunks: Blob[] = [];
    let stopTimeout: any = null;
    recorder.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.onerror = (e: any) => console.error('[Recorder]', e.error?.name || e);
    recorder.onstop = () => {
      if (stopTimeout) clearTimeout(stopTimeout);
      if (chunks.length > 0) { const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); transcribeAudioBlob(blob, chunkIndex); }
      currentRecorder = null; resolve();
    };
    currentRecorder = recorder;
    try { recorder.start(); } catch { resolve(); return; }
    stopTimeout = setTimeout(() => { if (recorder.state === 'recording') try { recorder.stop(); } catch {} }, durationMs);
  });
}
async function startContinuousRecording() {
  if (recordingLoopActive) return;
  recordingLoopActive = true; recordingStatus.value = '🎤 Recording'; chunksProcessed.value = 0;
  let chunkIndex = 0;
  while (isSpeaking && micEnabled.value) {
    chunkIndex++;
    await recordOneChunk(chunkIndex, 3500);
    if (isSpeaking) await new Promise(r => setTimeout(r, 50));
  }
  recordingLoopActive = false; recordingStatus.value = '—';
}
function stopCurrentRecording() {
  if (currentRecorder && currentRecorder.state === 'recording') try { currentRecorder.stop(); } catch {}
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
    lightGreen.value = el >= minSec; lightYellow.value = el >= midSec; lightRed.value = el >= maxSec;
  }, 200);
}

function countFillers(text: string): { counts: Record<string, number>; total: number } {
  const t = ' ' + text.toLowerCase().replace(/[^\w\s']/g, ' ') + ' ';
  const counts: Record<string, number> = {}; let total = 0;
  FILLER_WORDS.forEach(w => { const re = new RegExp(`\\s${w.replace(' ', '\\s')}\\s`, 'g'); const m = t.match(re); if (m) { counts[w] = m.length; total += m.length; } });
  const st = text.match(/\b(\w+)(\s+\1){2,}/gi);
  if (st) { counts['repeated words'] = st.length; total += st.length; }
  return { counts, total };
}

function doLeave() {
  isSpeaking = false; recordingLoopActive = false;
  stopCurrentRecording(); stopCameraAnalysis();
  if (timerInterval) clearInterval(timerInterval);
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  speechSynthesis.cancel();
  router.push('/toastmasters/results');
}

// ═══════ MAIN FLOW ═══════

async function startMeeting() {
  startBtnDisabled.value = true; startBtnText.value = '⏳ Setting up...';
  showSkipIntro.value = true; didSkipIntro.value = false;
  captionText.value = 'Requesting camera and microphone…';

  if (!(await initMedia())) { startBtnDisabled.value = false; startBtnText.value = '▶️ Start Meeting'; showSkipIntro.value = false; return; }
  if (typeof MediaRecorder === 'undefined') { alert('Audio recording not supported.'); startBtnDisabled.value = false; startBtnText.value = '▶️ Start Meeting'; showSkipIntro.value = false; return; }

  captionText.value = 'Loading AI face detection…';
  await startCameraAnalysis();
  if (!voices.length) { await new Promise(r => setTimeout(r, 400)); loadVoices(); }

  if (userRole === 'Speaker') {
    await speakerIntroFlow();
  } else {
    await roleIntroFlow();
  }

  showSkipIntro.value = false; didSkipIntro.value = false;
  await new Promise(r => setTimeout(r, 500));
  speakBtnDisabled.value = false;
  captionText.value = 'Click the speak button when ready.';
  startBtnText.value = '✓ Started';
}

// ─── Speaker Intro ───
async function speakerIntroFlow() {
  if (speechType === 'Table Topics (Impromptu)') {
    captionText.value = 'Generating your impromptu question...';
    const q = await toastmastersService.callBot('table-topic', {});
    if (q) displayTopic.value = q;
  }
  captionText.value = 'Bots are preparing...';
  const [intro, timerIntro, ahIntro, gramIntro, seIntro, geIntro] = await Promise.all([
    toastmastersService.callBot('toastmaster', { stage: 'intro', topic: displayTopic.value, speech_type: speechType, user_name: userName.value, user_role: 'Speaker' }),
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
    showSkipIntro.value = false; didSkipIntro.value = false;
    const intro2 = await toastmastersService.callBot('toastmaster', { stage: 'evalspeech_intro' });
    await speakForced(intro2 || '', 'toastmaster');
    captionText.value = 'Preparing sample speech...';
    sampleSpeechText = await toastmastersService.callBot('sample-speech', {}) || 'Three years ago, I lost my job. I started a business that failed. But that failure taught me everything.';
    captionSpeaker.value = sampleSpeakerCaption; captionText.value = 'Listen carefully...';
    await speakForced(sampleSpeechText, 'toastmaster');
    const ho = await toastmastersService.callBot('toastmaster', { stage: 'evalspeech_handover', user_name: userName.value });
    await speakForced(ho || '', 'toastmaster');
  } else if (speechType === 'Ice Breaker' && !cameraEnabled.value) {
    const msg = await toastmastersService.callBot('toastmaster', { stage: 'icebreaker_camera', user_name: userName.value });
    await speak(msg || 'Please turn on your camera.', 'toastmaster');
  }
  if (speechType !== 'Evaluation Speech') {
    const handover = await toastmastersService.callBot('toastmaster', { stage: 'handover', topic: displayTopic.value, user_name: userName.value, speech_type: speechType, user_role: 'Speaker' });
    await speak(handover || `Please welcome ${userName.value}!`, 'toastmaster');
  }
}

// ─── Role Intro ───
async function roleIntroFlow() {
  captionText.value = `Setting up ${userRole} practice…`;
  const task = await toastmastersService.generateRoleTask({ user_role: userRole, user_name: userName.value });
  roleTaskInfo.value = task || `Practice your ${userRole} duties.`;

  const intro = await toastmastersService.callBot('toastmaster', { stage: 'intro', topic: displayTopic.value, speech_type: speechType, user_name: userName.value, user_role: userRole });
  await speak(intro || `Welcome ${userName.value}! Today: ${userRole} role.`, 'toastmaster');

  // Disable skip for sample speech
  showSkipIntro.value = false; didSkipIntro.value = false;

  captionText.value = 'Generating sample speech…';
  sampleSpeechText = await toastmastersService.callBot('sample-speech', { purpose: 'role_practice', user_role: userRole } as any)
    || "Three years ago I was afraid of failure. Then I, um, lost my job and started a business. It failed but, you know, that failure taught me everything. I basically learned that, like, taking risks is actually the key.";
  sampleSpeechFillers = countFillers(sampleSpeechText);

  await speakForced('Now our sample speaker will deliver a speech. Listen carefully!', 'toastmaster');
  captionSpeaker.value = '🎙️ Sample Speaker'; captionText.value = 'Listen carefully...';
  await speakForced(sampleSpeechText, 'toastmaster');

  const ho = await toastmastersService.callBot('toastmaster', { stage: 'handover', topic: displayTopic.value, user_name: userName.value, speech_type: speechType, user_role: userRole });
  await speakForced(ho || `Your turn, ${userName.value}.`, 'toastmaster');
}

// ─── User starts speaking ───
function userSpeak() {
  if (!micEnabled.value) { alert('Please unmute your microphone first.'); return; }
  if (!mediaStream) { alert('Microphone not initialized.'); return; }
  if (typeof MediaRecorder === 'undefined') { alert('Audio recording not supported.'); return; }
  speechSynthesis.cancel();
  isSpeaking = true; isSpeakingRef.value = true;
  transcript = ''; liveTranscript.value = '';
  showSkipIntro.value = false;
  startContinuousRecording().catch(e => console.error('[Recording]', e));
  startTimer();
  speakBtnDisabled.value = true; finishBtnDisabled.value = false;
  captionSpeaker.value = 'You'; captionText.value = '🎤 Speak now! Transcription appears every ~3 seconds (Whisper AI)';
}

// ─── User finishes ───
async function userFinish() {
  isSpeaking = false; isSpeakingRef.value = false;
  stopCurrentRecording();
  await new Promise(r => setTimeout(r, 800));
  captionText.value = 'Finalizing transcription...';
  await new Promise(r => setTimeout(r, 1500));
  clearInterval(timerInterval); currentSpeaker.value = null;
  const duration = Math.floor((Date.now() - startTime) / 1000);
  finishBtnDisabled.value = true;

  showSkipReports.value = true; didSkipReports.value = false;

  const fillers = countFillers(transcript);
  fillerCounts.value = { ...fillers.counts };
  const onTime = duration >= minTime * 60 && duration <= maxTime * 60;
  const cleanTranscript = transcript.trim() || '(no speech captured)';

  reportsVisible.value = true;
  reports.timer = '⏳ Generating...'; reports.ah = '⏳ Generating...';
  reports.gram = '⏳ Analyzing…'; reports.speechEval = '⏳ Analyzing…';
  reports.generalEval = '⏳ Analyzing…'; reports.bodyLang = '⏳ Analyzing…';

  if (userRole === 'Speaker') {
    await finishSpeakerFlow(duration, fillers, onTime, cleanTranscript);
  } else {
    await finishRoleFlow(duration, fillers, onTime, cleanTranscript);
  }

  showSkipReports.value = false;
}

async function finishSpeakerFlow(duration: number, fillers: { counts: Record<string, number>; total: number }, onTime: boolean, cleanTranscript: string) {
  const closing = await toastmastersService.callBot('toastmaster', { stage: 'closing', user_name: userName.value, user_role: 'Speaker' });
  await speak(closing || '', 'toastmaster');

  reports.timer = await toastmastersService.callBot('timer', { stage: 'report', duration, min_time: minTime, max_time: maxTime }) || `${Math.floor(duration / 60)}m ${duration % 60}s.`;
  if (!didSkipReports.value) await speak(reports.timer, 'timer');

  reports.ah = await toastmastersService.callBot('ah-counter', { stage: 'report', counts: fillers.counts, total: fillers.total }) || `${fillers.total} fillers.`;
  if (!didSkipReports.value) await speak(reports.ah, 'ah');

  reports.gram = await toastmastersService.callBot('grammarian', { stage: 'report', transcript: cleanTranscript }) || 'Good language overall.';
  if (!didSkipReports.value) await speak(reports.gram, 'grammarian');

  reports.speechEval = await toastmastersService.callBot('speech-evaluator', { stage: 'report', transcript: cleanTranscript, topic: displayTopic.value, speech_type: speechType, sample_speech: sampleSpeechText }) || 'Solid effort.';
  if (!didSkipReports.value) await speak(reports.speechEval, 'speechEval');

  stopCameraAnalysis();
  const blData = getBodyLanguageData();
  const blAdvice = await toastmastersService.callBot('body-language', { body_language: blData }) || 'Maintain eye contact.';
  reports.bodyLang = `Engagement: ${blData.engagement_score}/100 | Face visible: ${blData.face_visibility_percent}% | Looking forward: ${blData.looking_forward_percent}% | Centered: ${blData.centered_percent}%\n\n${blAdvice}`;

  reports.generalEval = await toastmastersService.callBot('general-evaluator', { stage: 'report', transcript: cleanTranscript, speech_type: speechType, topic: displayTopic.value, duration, total_fillers: fillers.total, on_time: onTime, min_time: minTime, max_time: maxTime, engagement_score: blData.engagement_score }) || 'Good meeting overall.';
  if (!didSkipReports.value) await speak(reports.generalEval, 'generalEval');

  const timeScore = onTime ? 40 : Math.max(0, 40 - Math.abs(duration - (minTime * 60 + maxTime * 60) / 2) / 3);
  const wc = transcript.split(/\s+/).filter(Boolean).length || 1;
  const fillerScore = Math.max(0, 30 - (fillers.total / wc) * 300);
  const bodyScore = blData.engagement_score * 0.3;
  const overall = Math.round(timeScore + fillerScore + bodyScore);

  await saveSessionData('Speaker', duration, fillers, overall, blData, blAdvice);
  if (didSkipReports.value) { captionText.value = '✅ Saved! Redirecting…'; setTimeout(() => router.push('/toastmasters/results'), 1200); }
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
}

async function finishRoleFlow(duration: number, fillers: { counts: Record<string, number>; total: number }, onTime: boolean, cleanTranscript: string) {
  reports.roleEval = '⏳ AI evaluating your role…';

  const closing = await toastmastersService.callBot('toastmaster', { stage: 'closing', user_name: userName.value, user_role: userRole });
  if (!didSkipReports.value) await speak(closing || '', 'toastmaster');

  stopCameraAnalysis();
  const blData = getBodyLanguageData();
  const blAdvice = await toastmastersService.callBot('body-language', { body_language: blData }) || 'Maintain eye contact.';
  reports.bodyLang = `Engagement: ${blData.engagement_score}/100 | Face visible: ${blData.face_visibility_percent}% | Centered: ${blData.centered_percent}%\n\n${blAdvice}`;

  // Role evaluation
  const roleEvalText = await toastmastersService.evaluateRole({
    user_role: userRole, transcript: cleanTranscript, user_name: userName.value,
    sample_speech: sampleSpeechText, duration,
    actual_fillers_in_sample: sampleSpeechFillers.counts,
    user_reported_fillers: fillers.counts,
    user_timer_report: cleanTranscript, user_wod: wordOfTheDay,
    sample_duration: sampleSpeechDuration,
    min_time: minTime, max_time: maxTime,
  } as any) || `Thank you for practicing the ${userRole} role!`;
  reports.roleEval = roleEvalText;
  if (!didSkipReports.value) await speak(roleEvalText, 'generalEval');

  // Secondary reports
  if (userRole === 'Timer') reports.timer = `Actual: ${Math.floor(sampleSpeechDuration/60)}m ${sampleSpeechDuration%60}s (target ${minTime}-${maxTime}min). Your report: ${Math.floor(duration/60)}m ${duration%60}s.`;
  else if (userRole === 'Ah-Counter') { const bd = Object.entries(sampleSpeechFillers.counts).filter(([_,c])=>c>0).map(([w,c])=>`${w}: ${c}`).join(', ')||'none'; reports.ah = `Actual fillers: ${sampleSpeechFillers.total} (${bd}). Compare with your report.`; }
  else if (userRole === 'Grammarian') reports.gram = `Report: ${Math.floor(duration/60)}m ${duration%60}s. ${wordOfTheDay?`WOD: "${wordOfTheDay}".`:'Introduce a WOD next time.'}`;
  else if (userRole === 'Speech Evaluator') reports.speechEval = `Eval: ${Math.floor(duration/60)}m ${duration%60}s. Did you use Praise-Suggest-Encourage?`;
  else if (userRole === 'General Evaluator') reports.generalEval = `GE: ${Math.floor(duration/60)}m ${duration%60}s. Timing, flow, performances?`;
  else if (userRole === 'Toastmaster') reports.generalEval = `Hosting: ${Math.floor(duration/60)}m ${duration%60}s. Welcome, introduce, transitions, close?`;

  const wc = transcript.split(/\s+/).filter(Boolean).length || 0;
  const contentScore = Math.min(40, wc * 0.5);
  const fillerPenalty = Math.max(0, 30 - (fillers.total / Math.max(1, wc)) * 300);
  const bodyScore = blData.engagement_score * 0.3;
  const overall = Math.round(Math.min(100, contentScore + fillerPenalty + bodyScore));

  await saveSessionData(userRole, duration, fillers, overall, blData, blAdvice);
  if (didSkipReports.value) { captionText.value = '✅ Saved! Redirecting…'; setTimeout(() => router.push('/toastmasters/results'), 1200); }
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
}

async function saveSessionData(role: string, duration: number, fillers: { counts: Record<string, number>; total: number }, overall: number, blData: any, blAdvice: string) {
  try {
    await toastmastersService.saveSession({
      user_id: authStore.user?.id || '', username: authStore.user?.username || '',
      user_first_name: authStore.user?.first_name || '', user_last_name: authStore.user?.last_name || '',
      user_full_name: `${authStore.user?.first_name || ''} ${authStore.user?.last_name || ''}`.trim() || authStore.user?.username,
      user_role: role, topic: displayTopic.value, speech_type: speechType,
      min_time: minTime, max_time: maxTime,
      duration_seconds: duration, transcript: transcript.trim(),
      sample_speech_text: sampleSpeechText,
      filler_counts: fillers.counts, total_fillers: fillers.total,
      word_of_the_day: wordOfTheDay,
      grammarian_report: reports.gram, ah_counter_report: reports.ah, timer_report: reports.timer,
      speech_evaluator_report: reports.speechEval, general_evaluator_report: reports.generalEval,
      role_evaluation_report: reports.roleEval || '',
      body_language_data: blData, body_language_advice: blAdvice,
      overall_score: overall
    });
  } catch (e) { console.error('Save session failed:', e); }
}

onUnmounted(() => {
  isSpeaking = false; recordingLoopActive = false;
  stopCurrentRecording(); stopCameraAnalysis();
  if (timerInterval) clearInterval(timerInterval);
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  speechSynthesis.cancel();
});
</script>

<style src="@/assets/css/toastmasters.css"></style>