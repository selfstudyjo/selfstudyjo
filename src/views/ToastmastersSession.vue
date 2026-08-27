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

    <!--
      The six seats. One canvas behind the whole grid, one camera per tile —
      see `PersonStage.vue` for why it is not six canvases, and `figures.ts`
      for why they are not six video loops any more. The grid class is this
      page's own, so every breakpoint in `toastmasters.css` still decides the
      layout and the stage measures whatever it decided.
    -->
    <PersonStage
      :seats="stageSeats"
      :speaking="currentSpeaker"
      :energy="speechEnergy"
      grid-class="tm-bots-grid"
      tile-class="tm-video-tile"
    >
      <template #tile="{ seat }">
        <div class="tm-name-tag">{{ seat.label }}</div>
        <div class="tm-speaking-dot"></div>
      </template>
    </PersonStage>

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

    <!--
      THE LIVE TRANSCRIPT IS EDITABLE.

      It was a read-only div, and a read-only transcript is a report marked on
      words the speaker did not mean to say: Whisper transcribes a false start
      faithfully, so a restarted sentence reached the Grammarian and the
      Ah-Counter complete with the restart and the word "sorry" - and they duly
      reported rambling, and filler words nobody used. Three ways out, the same
      three the Job Interview room offers, because they are used at different
      moments: type in the box, say "sorry" to drop the last part, or highlight a
      phrase and dictate over it. See src/utils/answerEditing.ts.
    -->
    <div class="tm-transcript-box">
      <div class="tm-transcript-head">
        <h4>
          {{ $t('Your Live Transcript') }}
          <span v-if="isSpeakingRef" class="tm-transcript-live">{{ $t('🎤 Recording (Whisper AI)') }}</span>
        </h4>
        <span class="tm-transcript-words">{{ $t('{v0} words', { v0: transcriptWords }) }}</span>
      </div>

      <textarea
        ref="transcriptEl"
        class="tm-transcript-input"
        :value="answer.text"
        :readonly="!isSpeakingRef && !answer.text"
        @input="onTranscriptTyped"
        @select="trackSelection"
        @keyup="trackSelection"
        @mouseup="trackSelection"
        :placeholder="transcriptPlaceholder"
        spellcheck="true"
        rows="4"
      ></textarea>

      <div class="tm-transcript-tools" v-if="isSpeakingRef">
        <button type="button" class="tm-btn-tool" :disabled="!hasSelection"
                @mousedown.prevent @click="replaceHighlighted"
                :title="$t('Delete what you highlighted and carry on speaking in its place')">
          {{ $t('✂️ Replace highlighted') }}
        </button>
        <button type="button" class="tm-btn-tool" v-if="answer.caret !== null" @click="backToEnd">
          {{ $t('⇥ Back to the end') }}
        </button>
        <button type="button" class="tm-btn-tool" :disabled="!answer.text" @click="undoLastPart">
          {{ $t('↩︎ Undo last part') }}
        </button>
        <button type="button" class="tm-btn-tool tm-btn-tool-danger" :disabled="!answer.text" @click="clearTranscript">
          {{ $t('🗑️ Clear') }}
        </button>
        <label class="tm-transcript-toggle"
               :title="$t('Turn off if the speech is about a subject where you say these words for real')">
          <input type="checkbox" v-model="voiceEditing"> {{ $t('spoken corrections') }}
        </label>
      </div>

      <div class="tm-transcript-caret" v-if="answer.caret !== null">
        {{ $t('▌ What you say next goes') }} <strong>{{ $t('here') }}</strong>: <em>{{ caretHintText }}</em>
      </div>
      <div class="tm-transcript-hint" v-else-if="isSpeakingRef && voiceEditing">
        {{ $t('Say') }} <strong>{{ $t('“sorry”') }}</strong> {{ $t('to delete the last part,') }} <strong>{{ $t('“sorry sorry”') }}</strong> {{ $t('for the last two — or highlight a phrase and press') }} <strong>{{ $t('Replace highlighted') }}</strong>{{ $t('. You can also just type.') }}
      </div>
    </div>

    <div class="tm-controls">
      <button @click="startMeeting" :disabled="startBtnDisabled" class="tm-btn-primary">{{ startBtnText }}</button>
      <button v-if="showSkipIntro" @click="doSkipIntro" :disabled="didSkipIntro" class="tm-btn-warning" style="font-size:.9rem">{{ didSkipIntro ? '⏩ Skipped' : '⏩ Skip Intro' }}</button>
      <button @click="userSpeak" :disabled="speakBtnDisabled" class="tm-btn-success">{{ speakBtnLabel }}</button>
      <button @click="userFinish" :disabled="finishBtnDisabled" class="tm-btn-warning">{{ $t('✋ I\'m Done') }}</button>
      <button v-if="showSkipReports" @click="doSkipReports" :disabled="didSkipReports" class="tm-btn-warning" style="font-size:.9rem">{{ didSkipReports ? '⏩ Skipped' : '⏩ Skip Reports' }}</button>
      <button @click="toggleMic" :disabled="!mediaReady" class="tm-btn-control" :class="{ off: !micEnabled }">{{ micEnabled ? '🎤 Mic On' : '🔇 Mic Off' }}</button>
      <button @click="toggleCamera" :disabled="!mediaReady || !cameraAvailable" class="tm-btn-control" :class="{ off: !cameraEnabled }"
              :title="cameraAvailable ? '' : $t('No camera on this device — the meeting runs on the microphone alone')">{{ cameraEnabled ? '📹 Camera On' : '📷 Camera Off' }}</button>
      <button @click="doLeave" class="tm-btn-danger">{{ $t('Leave') }}</button>
    </div>

    <!--
      Which voice is actually speaking.

      A diagnostic rather than a caption, and it earns its line: "the bots are
      silent in Arabic" and "this machine has no Arabic voice installed" are
      indistinguishable from a chair, and the newscast was asked the same
      question three separate times before it grew the same label. It appears
      only once something has spoken.
    -->
    <p v-if="voiceLabel" class="tm-voice-note sfs-bidi">
      <span aria-hidden="true">🔊</span> {{ voiceLabel }}
    </p>

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
import { aiLanguage, aiLanguageHeaders, localeId, locale as activeLocale, t } from '@/i18n/runtime';
import {
    NO_SERVER, deviceCanSpeak, describe as describeSpeech, planSpeech,
    serverVoicesFor, type ServerVoices,
} from '@/utils/roomSpeech';
import { shapeRatio } from '@/components/newscast/voiceShaper';
import { createSpeechAudio } from '@/utils/speechAudio';
import { spokenEnergy } from '@/stage3d/figures';
import { newsService } from '@/services/news.service';
import { ref, computed, onUnmounted, reactive, nextTick, watch } from 'vue';
// The transcript editor. Reused from the Job Interview room rather than
// reimplemented -- see `answer` below and `npm run check:answeredit`.
import {
    type AnswerState, emptyAnswer, applyTranscript, undoSegments,
    replaceSelection, resumeAtEnd, setTypedText, caretHint, wordCount,
} from '@/utils/answerEditing';
import { paint } from '@/theme/contrast';
import PersonStage from '@/components/stage3d/PersonStage.vue';
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
/*
 * The label on the one button the speaker presses.
 *
 * A `computed` reading `t()`, so it re-renders when the language changes -- the
 * role keys are the meeting's own vocabulary and stay as they are (they are what
 * the backend is sent), and only the label is translated.
 */
const speakBtnLabel = computed(() => {
  const ready = t('🎤 I am ready to speak');
  if (userRole === 'Speaker') return ready;
  const m: Record<string, string> = {
    Toastmaster: t('🎙️ Start hosting'), Timer: t('⏱️ Timer report'),
    'Ah-Counter': t('🗣️ Ah-Counter report'), Grammarian: t('✍️ Grammarian report'),
    'Speech Evaluator': t('📋 Deliver evaluation'), 'General Evaluator': t('🎯 General evaluation'),
  };
  return m[userRole] || ready;
});

// ═══════ STATE ═══════
const videoEl = ref<HTMLVideoElement>();
const faceBoxEl = ref<HTMLDivElement>();
const faceBoxLabelEl = ref<HTMLDivElement>();

const displayTopic = ref(initialTopic);
const currentSpeaker = ref<string | null>(null);
const captionSpeaker = ref('System');
const captionText = ref(t('Click "Start Meeting" to begin.'));

/*
 * THE TRANSCRIPT IS EDITABLE, AND IT IS THE SOURCE OF TRUTH.
 *
 * It was `let transcript = ''` with chunks appended to it and a read-only
 * `liveTranscript` ref mirroring it onto the page. That is fine for a native
 * speaker of the meeting's language and useless for anybody else, which is most
 * of this platform's readers: Whisper transcribes a false start faithfully, so
 * what reached the Grammarian, the Ah-Counter and both Evaluators was the wrong
 * sentence, the word "sorry", and then the right sentence — and the reports then
 * marked the speaker down for rambling and for filler words they did not use.
 *
 * The Job Interview room solved this already, so this reuses its module rather
 * than growing a second copy: `answerEditing.ts` is plain (no Vue), has its own
 * check (`npm run check:answeredit`), and owns all three ways out — type in the
 * box, say "sorry" to drop the last part, or highlight a phrase and dictate
 * over it.
 *
 * The important half is that there is now ONE string rather than a buffer and a
 * display. Everything downstream — the filler count, the word count, all five
 * reports and the saved session — reads `speechText()`. Had the edit landed only
 * on the ref, the speaker would have corrected the text on screen and been
 * marked on the original, which is worse than not offering the edit at all.
 */
const answer = ref<AnswerState>(emptyAnswer());
const selection = ref({ start: 0, end: 0 });
const voiceEditing = ref(true);
const transcriptEl = ref<HTMLTextAreaElement>();

/** The words the meeting will actually be judged on. */
function speechText(): string {
  return answer.value.text;
}
const startBtnDisabled = ref(false);
const startBtnText = ref(t('▶️ Start Meeting'));
const speakBtnDisabled = ref(true);
const finishBtnDisabled = ref(true);
const mediaReady = ref(false);
const micEnabled = ref(true);
const cameraEnabled = ref(true);
/*
 * Whether this machine gave us a camera at all.
 *
 * Distinct from `cameraEnabled`, which is the speaker's own choice, and the
 * distinction matters in two places: the toggle is disabled rather than merely
 * off (a button that cannot work should say so), and the body-language report
 * says "no camera" rather than reporting 0% engagement, which reads as a
 * damning assessment of somebody who never had a camera to look at.
 */
const cameraAvailable = ref(true);
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
function loadVoices() {
  voices = speechSynthesis.getVoices();
  // `getVoices()` is EMPTY on the first call in every browser and
  // `voiceschanged` is what says the list has arrived, sometimes more than
  // once. The server probe has to run again each time it moves: asked before
  // the voices land, every language looks unavailable and the room would reach
  // for the network on a machine that speaks perfectly well.
  void checkServerVoices();
}
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
  return {
    gender,
    ...planSpeech(voices, localeId.value, gender, seat, serverVoices.value, speechAudio.capable),
  };
}

/* ------------------------------------------------------------------ *
 * THE SERVER VOICE, WHICH IS WHY THIS ROOM WAS SILENT IN ARABIC
 * ------------------------------------------------------------------ *
 *
 * `planSpeech` was called with a hardcoded `false` for "can app 36 speak this
 * language", so the meeting NEVER reached the server engine. On any machine
 * with no Arabic voice installed — which is a stock Windows install, i.e. most
 * of them — all six seats fell straight through to the platform route and said
 * nothing at all. Nothing was wrong with the backend; it was never called.
 *
 * Asked ONCE per language rather than per line: the answer cannot change
 * mid-meeting, and a probe per sentence is a round trip per sentence against a
 * PythonAnywhere replica whose first answer of the day takes ~20 seconds. Asked
 * at all only when the device has no voice for the language, because on a
 * machine that does the server is never reached and the question is free to
 * leave unanswered.
 */
const serverVoices = ref<ServerVoices>(NO_SERVER);

/**
 * The capability probe that is in flight, so a line can wait for it.
 *
 * ============================================================
 * THE FIRST LINE WENT OUT BEFORE THE ANSWER CAME BACK
 * ============================================================
 *
 * The probe is a network round trip to a PythonAnywhere replica whose first
 * answer of the day takes about twenty seconds, and it is started from
 * `loadVoices()` — which runs at setup. Nothing waited for it. So the room's
 * opening line was cast against `NO_SERVER`, fell through to the platform route,
 * and on a machine with no voice for the reader's language said nothing at all.
 *
 * The opening line is the greeting: the one line whose absence reads as "this
 * does not work" rather than as "that question was quiet". Awaiting the probe
 * costs nothing on every line after the first, because a settled promise is
 * free, and on the first it costs exactly the round trip that was going to
 * happen anyway.
 */
let serverProbe: Promise<void> = Promise.resolve();

function checkServerVoices(): Promise<void> {
  /*
    NEVER REJECTS. `speak` awaits this from inside an async promise executor,
    where a throw is swallowed and the promise it was meant to settle is left
    hanging — which is a room that stops mid-session. The same shape as the
    temporal-dead-zone throw this file has just been fixed for, so it is worth
    the one line.
  */
  serverProbe = runServerProbe().catch(() => undefined);
  return serverProbe;
}

async function runServerProbe(): Promise<void> {
  if (deviceCanSpeak(voices, localeId.value)) { serverVoices.value = NO_SERVER; return; }
  try {
    serverVoices.value = serverVoicesFor(await newsService.speechCapabilities(), localeId.value);
  } catch {
    // A silent seat is worse than an unshaped one and `planSpeech` falls
    // through to the platform route on its own. Nothing to report here.
    serverVoices.value = NO_SERVER;
  }
}

// The language can be changed from the sidebar mid-meeting, and the answer for
// Arabic is not the answer for English.
watch(localeId, () => { void checkServerVoices(); });

/**
 * Every server clip goes through Web Audio, and that is also the fix for "the
 * voice is too low".
 *
 * The provider hands back audio around eight decibels below where it should be
 * and an `<audio>` element cannot take that back — `volume` only goes down. It
 * is levelled and compressed on the way out, and the same graph is what reports
 * {@link speechEnergy}, so the mouths on the tiles move on the real waveform.
 * See `utils/speechAudio.ts`.
 */
const speechAudio = createSpeechAudio();

/**
 * How loud the current speaker is, 0…1. Drives the 3D mouths.
 *
 * A live reading while a server clip is playing. `speechSynthesis` exposes no
 * audio whatsoever, so on the device route this is a nominal figure and the
 * syllable model in `figures.ts` carries the movement — good rather than
 * excellent, and indistinguishable at tile size.
 */
const speechEnergy = ref(0);
let energyTimer: number | null = null;

/**
 * What the reader is actually hearing, shown under the controls.
 *
 * "Is this seat really on an Arabic voice?" is a question a listener cannot
 * answer by listening, and it is the only way to tell "this device has no
 * Arabic voice" apart from "the meeting is broken" — which from a chair are the
 * same thing. The newscast was asked it three times before it grew the same
 * caption.
 */
const voiceLabel = ref('');

/**
 * The six seats, as the 3D stage wants them.
 *
 * The figure id comes off the seat rather than being listed again: the face on
 * the tile, the name in the caption and the gender that casts the voice are
 * three views of one person, and a second list is how they drift apart.
 */
const stageSeats = computed(() => SEATS.map(seat => ({
  key: seat.key,
  figure: seat.actor,
  label: seatLabel(seat),
})));

/*
  The first voice load happens HERE rather than beside `loadVoices` itself.

  It reaches `serverVoices` and, through `voiceFor`, `speechAudio` — both
  `const`s declared below the function. `<script setup>` runs top to bottom, so
  calling it at the point of definition is a temporal-dead-zone `ReferenceError`
  on every load of the room rather than a race that shows up occasionally.
*/
loadVoices();

/** When `onboundary` last fired, in `performance.now()` ms, or 0 for never. */
let lastBoundary = 0;

/**
 * ============================================================
 * `measured` IS ABOUT THE CLIP, NOT ABOUT THE BROWSER
 * ============================================================
 *
 * This branched on `speechAudio.capable` — "can this browser measure audio" —
 * which answers yes on every modern browser and is not the question. What
 * matters is whether THIS LINE is going through Web Audio. A `speechSynthesis`
 * line has no node, no buffer and no level however capable the browser is, so
 * the analyser was polled with nothing connected to it and returned a steady
 * zero, and `jawOpen` returns EXACTLY 0 at zero energy by design.
 *
 * So on every machine with a voice for the reader's language — which is every
 * machine in English — all six seats ran the meeting with their mouths shut,
 * their hands down and their brows still. They breathed and blinked, which
 * reads worse than nothing: it looks like six people deciding not to speak.
 */
function trackEnergy(live: boolean, measured = true) {
  if (energyTimer !== null) { window.clearInterval(energyTimer); energyTimer = null; }
  if (!live) { speechEnergy.value = 0; return; }
  // 40 ms rather than an animation frame: this feeds a value the renderer
  // smooths anyway, and a `setInterval` keeps running while the tab is
  // throttled, where a rAF stops and would leave a mouth frozen open.
  if (!measured || !speechAudio.capable) {
    // Reset the clock so the first word of a line pulses rather than inheriting
    // the tail of the last one.
    lastBoundary = 0;
    speechEnergy.value = spokenEnergy(Infinity);
    energyTimer = window.setInterval(() => {
      speechEnergy.value = spokenEnergy(
        lastBoundary ? (performance.now() - lastBoundary) / 1000 : Infinity);
    }, 40);
    return;
  }
  energyTimer = window.setInterval(() => {
    speechEnergy.value = speechAudio.energy();
  }, 40);
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
  return seat ? `${seat.emoji} ${actorById(seat.actor).name} (${t('Sample')})` : t('🎙️ Sample Speaker');
})();

/*
 * CHROME SILENTLY STOPS SPEAKING AFTER ABOUT FIFTEEN SECONDS.
 *
 * `pause()` + `resume()` on a timer resets its internal clock, and it is the
 * documented workaround. The Newscast has carried it since the day that page
 * shipped and the Job Interview room was given it after the same bug was
 * reported there; this room never had it, and it is the room where it hurts
 * most — a sample speech and five evaluator reports are the longest utterances
 * on the platform, so every one of them was cut off mid-word.
 *
 * The second half is worse than the truncation: when Chrome does this, `onend`
 * frequently never arrives. Every step of this meeting awaits `speak()`, so a
 * promise that never settles is a meeting that stops dead with the caption still
 * reading as though somebody were talking. That is the "it just sticks" report.
 *
 * Nine seconds, comfortably inside the fifteen.
 */
let speechKeepAlive: number | null = null;

/*
 * The utterance being spoken, held so the garbage collector cannot take it.
 *
 * Chrome and Safari have both shipped versions that collect a
 * `SpeechSynthesisUtterance` whose only reference is inside the speech queue,
 * and the symptom is the same one: speech stops part-way through, with no error
 * and often no `onend`. One variable, and it removes a whole class of report.
 */
let speaking: SpeechSynthesisUtterance | null = null;

function startSpeechKeepAlive() {
  stopSpeechKeepAlive();
  speechKeepAlive = window.setInterval(() => {
    try {
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    } catch { /* a browser that refuses this is a browser that does not need it */ }
  }, 9000);
}

function stopSpeechKeepAlive() {
  if (speechKeepAlive !== null) {
    window.clearInterval(speechKeepAlive);
    speechKeepAlive = null;
  }
}

/*
 * How long to wait for `onend` before giving up on it.
 *
 * Speech runs at roughly 14 characters a second, so this is the time the text
 * should take plus a wide margin. The keepalive above should make it
 * unreachable; it is here because "should" is not a guarantee and the cost of
 * being wrong is a meeting nobody can finish. Capped, because a bot that returns
 * a wall of text must not be able to hang the room for ten minutes either.
 */
function speechTimeoutMs(text: string): number {
  return Math.min(120000, Math.max(8000, text.length * 120 + 5000));
}

/*
 * One `speak` implementation with a `force` flag, rather than two.
 *
 * `speak` and `speakForced` differed in three lines — the skip check, the
 * caption fallback and a slightly slower delivery — and were otherwise the same
 * forty lines twice. That mattered once the keepalive and the watchdog arrived:
 * added to one and not the other, the sample speech (the single longest
 * utterance in the meeting, and the one delivered through `speakForced`) would
 * have been the one case still being cut off.
 */
function say(text: string, botKey: string, force: boolean): Promise<void> {
  // The executor is `async` because the server route below awaits a fetch.
  // That is normally an anti-pattern — a throw inside one is swallowed rather
  // than rejecting — and it is safe here precisely because nothing in this
  // function is allowed to reject: every path, including every failure, goes
  // through `done()` and resolves. A rejected `say()` is a meeting that stops.
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async resolve => {
    if (!text?.trim()) { resolve(); return; }
    captionSpeaker.value = speakerLabel(botKey, force ? t('🎙️ Sample Speaker') : t('System'));
    captionText.value = text;
    if (!force) {
      // Skip requested: show the line, say nothing, move on.
      if (didSkipIntro.value && !isSpeaking) { setTimeout(resolve, 80); return; }
      if (didSkipReports.value && reportsVisible.value) { setTimeout(resolve, 80); return; }
    }
    currentSpeaker.value = botKey;
    speechSynthesis.cancel();
    speechAudio.stop();

    // Wait for the capability probe if one is still in flight — otherwise the
    // Toastmaster's opening line is cast against an answer that has not
    // arrived. See `serverProbe`.
    await serverProbe;
    const plan = voiceFor(botKey);

    /*
      THE SERVER ROUTE. Reached only when the device has no voice for this
      language at all — a stock Windows install has none for Arabic, and many
      Linux and Android builds have none for Chinese.

      `allowAnyVoice` is the room telling app 36 it may hand over a voice of the
      other gender, which the backend otherwise refuses; `shapeTo` is the room
      undertaking to put it back into the right register on the way to the
      speakers. Those two travel together on purpose — asking for a wrong-gender
      voice without correcting it is the silent substitution that the refusal
      exists to prevent (working rule 21).

      Failure falls through to the platform route rather than aborting: "this
      one line had no sound" is recoverable, "the meeting stopped" is not.
    */
    if (plan.route === 'server') {
      const started = Date.now();
      try {
        const clip = await newsService.speech(
          text, localeId.value, plan.gender, force ? 0.95 : 1, '', plan.allowAnyVoice);
        voiceLabel.value = describeSpeech(plan, activeLocale.value.nativeName, clip.voice);
        const mismatched = !!clip.gender && clip.gender !== plan.gender;
        const ratio = mismatched && plan.shapeTo ? shapeRatio(clip.gender, plan.shapeTo) : 1;
        // Measured: this one really is going through the analyser.
        trackEnergy(true, true);
        await speechAudio.play(clip.url, ratio);
        trackEnergy(false);
        if (force) sampleSpeechDuration = Math.floor((Date.now() - started) / 1000);
        currentSpeaker.value = null;
        resolve();
        return;
      } catch {
        trackEnergy(false);
        // Nothing to tell the room: the caption already carries the line, and
        // the platform route below is a real chance of being heard.
      }
    }

    const u = new SpeechSynthesisUtterance(text);
    speaking = u;
    const cast = plan;
    voiceLabel.value = describeSpeech(plan, activeLocale.value.nativeName);
    if (cast.voice) u.voice = cast.voice as SpeechSynthesisVoice;
    // Set whether or not a voice was cast. With none assigned, `lang` is the
    // only thing telling the platform what language the text is in -- and an
    // unassigned voice with a correct `lang` frequently reaches an OS voice that
    // `getVoices()` never listed at all.
    u.lang = cast.lang;
    u.pitch = force ? cast.pitch - 0.03 : cast.pitch;
    // A shade slower for a set-piece speech being performed, rather than a line
    // of meeting business.
    if (force) u.rate = 0.95;

    const t0 = Date.now();
    let watchdog: any = null;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (watchdog) clearTimeout(watchdog);
      stopSpeechKeepAlive();
      trackEnergy(false);
      speaking = null;
      if (force) sampleSpeechDuration = Math.floor((Date.now() - t0) / 1000);
      currentSpeaker.value = null;
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    /* One pulse per word — as close to lip sync as a route with no audio gets.
       Not every engine fires it, and `spokenEnergy` falls back to a steady
       nominal level when it never comes, so this is purely additive. */
    u.onboundary = () => { lastBoundary = performance.now(); };

    setTimeout(() => {
      speechSynthesis.speak(u);
      startSpeechKeepAlive();
      // NOT measured: `speechSynthesis` exposes no audio whatsoever.
      trackEnergy(true, false);
      watchdog = setTimeout(() => {
        // `onend` never came. Stop whatever is still queued and carry on rather
        // than leaving the room waiting on a promise that will not settle.
        try { speechSynthesis.cancel(); } catch { /* nothing to cancel */ }
        done();
      }, speechTimeoutMs(text));
    }, force ? 100 : 80);
  });
}

function speak(text: string, botKey: string): Promise<void> { return say(text, botKey, false); }

/** Always plays, ignoring the skip flags — for the sample speeches. */
function speakForced(text: string, botKey: string): Promise<void> { return say(text, botKey, true); }

// ═══════ THE TRANSCRIPT EDITOR ═══════
//
// Thin on purpose: every rule lives in `@/utils/answerEditing`, which is a plain
// module with a check of its own. What is here is the wiring — where the caret
// is, what is selected, and putting the textarea's own cursor back where the
// speaker would expect it.

/*
 * The placeholder is prose in the reader's language, so it goes through `t()`
 * rather than being a bare literal -- this is a script block, where `$t` is
 * undefined and the call would throw on whichever branch reached it.
 */
const transcriptPlaceholder = computed(() => (
  isSpeakingRef.value
    ? t('Speak — your words appear here every few seconds. You can also type or correct anything in this box while you talk.')
    : '—'
));
const transcriptWords = computed(() => wordCount(answer.value.text));
const caretHintText = computed(() => caretHint(answer.value));
const hasSelection = computed(() => selection.value.end > selection.value.start);

/** Put the textarea's own cursor where the next dictated words will land. */
async function syncCursor() {
  const at = answer.value.caret;
  if (at === null) return;
  await nextTick();
  const el = transcriptEl.value;
  if (!el) return;
  try { el.setSelectionRange(at, at); } catch { /* not focusable yet */ }
}

/** One transcribed chunk, with spoken corrections applied. */
function applyChunk(text: string) {
  answer.value = applyTranscript(answer.value, text, { voiceEditing: voiceEditing.value });
  void syncCursor();
}

function onTranscriptTyped(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  answer.value = setTypedText(answer.value, el.value);
}

function trackSelection() {
  const el = transcriptEl.value;
  if (!el) return;
  selection.value = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
}

/*
 * Delete what is highlighted and dictate into the gap.
 *
 * The selection is read off the element rather than out of `selection` at the
 * moment of the click, because clicking can collapse a selection on some
 * browsers before the handler runs — and a button that silently does nothing on
 * the one browser nobody tested is worse than no button. The template's
 * `mousedown.prevent` is the other half of the same problem: pressing the button
 * blurs the field, and a browser that collapses on blur would disable the button
 * between mousedown and click.
 */
function replaceHighlighted() {
  const el = transcriptEl.value;
  const start = el?.selectionStart ?? selection.value.start;
  const end = el?.selectionEnd ?? selection.value.end;
  if (end <= start) return;
  answer.value = replaceSelection(answer.value, start, end);
  selection.value = { start: answer.value.caret ?? 0, end: answer.value.caret ?? 0 };
  void syncCursor();
  el?.focus();
}

function backToEnd() { answer.value = resumeAtEnd(answer.value); }

/** The button form of saying "sorry", through the module rather than a second copy. */
function undoLastPart() { answer.value = undoSegments(answer.value, 1); void syncCursor(); }

function clearTranscript() {
  answer.value = emptyAnswer();
  selection.value = { start: 0, end: 0 };
}

// ═══════ SKIP HANDLERS ═══════
function doSkipIntro() {
  didSkipIntro.value = true;
  speechSynthesis.cancel();
  stopSpeechKeepAlive();
  currentSpeaker.value = null;
  captionText.value = t('Intro skipped — jumping ahead…');
}
function doSkipReports() {
  didSkipReports.value = true;
  speechSynthesis.cancel();
  stopSpeechKeepAlive();
  currentSpeaker.value = null;
  captionText.value = t('Reports skipped — saving results…');
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

// ═══════ MEDIA ═══════
//
// THE MICROPHONE IS MANDATORY AND THE CAMERA IS NOT, AND THAT IS TWO
// `getUserMedia` CALLS RATHER THAN ONE.
//
// It was one call asking for `{ video, audio }`, and `getUserMedia` is all or
// nothing: a laptop with no webcam, a camera another tab already holds, a
// browser profile where video is blocked, or a user who simply says no to the
// camera half of the prompt — every one of those rejected the WHOLE request. So
// the meeting could not start at all, with an alert about permission being
// denied, on a machine whose microphone was working perfectly.
//
// That made the camera mandatory in practice while nothing in the product said
// it was. It is not: a Toastmasters meeting is a speaking exercise. The camera
// feeds the body-language report, which is one card out of seven and is already
// written to say when there was nothing to analyse.
//
// Audio first and on its own, because it is the one that must succeed and its
// failure is the only one worth stopping for. Video second, best effort, and its
// tracks are ADDED to the same stream so everything downstream — the recorder,
// `toggleCamera`, `doLeave`'s track cleanup — keeps working unchanged.
async function initMedia(): Promise<boolean> {
  const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
  } catch (e: any) {
    // The only hard stop. There is no meeting without a voice, so this says what
    // is needed rather than naming the camera as well and sending somebody to
    // check a setting that is not the problem.
    alert(t('Microphone access is needed to take part in the meeting.') + '\n' + (e?.message || ''));
    return false;
  }

  // Best effort. A refusal here is a normal state, not an error: the meeting runs
  // audio-only and the tile shows the "Camera Off" overlay it already has.
  try {
    const video = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
    });
    for (const track of video.getVideoTracks()) mediaStream.addTrack(track);
  } catch {
    cameraAvailable.value = false;
    cameraEnabled.value = false;
  }

  if (cameraAvailable.value && videoEl.value) {
    videoEl.value.srcObject = mediaStream;
    await new Promise<void>(r => {
      if (videoEl.value!.readyState >= 2) r();
      else videoEl.value!.onloadedmetadata = () => videoEl.value!.play().then(() => r()).catch(() => r());
    });
  }
  mediaReady.value = true;
  return true;
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
      if (text) { applyChunk(text); chunksProcessed.value++; }
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
  stopSpeechKeepAlive();
  speechAudio.stop();
  trackEnergy(false);
  router.push('/toastmasters/results');
}

// ═══════ MAIN FLOW ═══════

async function startMeeting() {
  // Primed inside the gesture that starts the meeting. An `AudioContext`
  // created outside a click starts `suspended` and every clip played on it is
  // silently ignored — no error, no event, a meeting that runs in complete
  // silence. Same reason the chimes elsewhere are primed on first click.
  speechAudio.prime();
  startBtnDisabled.value = true; startBtnText.value = t('⏳ Setting up…');
  showSkipIntro.value = true; didSkipIntro.value = false;
  captionText.value = t('Requesting the microphone…');

  if (!(await initMedia())) { startBtnDisabled.value = false; startBtnText.value = '▶️ Start Meeting'; showSkipIntro.value = false; return; }
  if (typeof MediaRecorder === 'undefined') { alert(t('Audio recording is not supported by this browser.')); startBtnDisabled.value = false; startBtnText.value = '▶️ Start Meeting'; showSkipIntro.value = false; return; }

  if (cameraAvailable.value) {
    captionText.value = t('Loading AI face detection…');
    await startCameraAnalysis();
  }
  if (!voices.length) { await new Promise(r => setTimeout(r, 400)); loadVoices(); }

  if (userRole === 'Speaker') {
    await speakerIntroFlow();
  } else {
    await roleIntroFlow();
  }

  showSkipIntro.value = false; didSkipIntro.value = false;
  await new Promise(r => setTimeout(r, 500));
  speakBtnDisabled.value = false;
  captionText.value = t('Click the speak button when ready.');
  startBtnText.value = t('✓ Started');
}

// ─── Speaker Intro ───
async function speakerIntroFlow() {
  if (speechType === 'Table Topics (Impromptu)') {
    captionText.value = t('Generating your impromptu question…');
    const q = await toastmastersService.callBot('table-topic', {});
    if (q) displayTopic.value = q;
  }
  captionText.value = t('The room is preparing…');
  const [intro, timerIntro, ahIntro, gramIntro, seIntro, geIntro] = await Promise.all([
    toastmastersService.callBot('toastmaster', { stage: 'intro', topic: displayTopic.value, speech_type: speechType, user_name: userName.value, user_role: 'Speaker' }),
    toastmastersService.callBot('timer', { stage: 'intro', min_time: minTime, max_time: maxTime }),
    toastmastersService.callBot('ah-counter', { stage: 'intro' }),
    toastmastersService.callBot('grammarian', { stage: 'intro' }),
    toastmastersService.callBot('speech-evaluator', { stage: 'intro' }),
    toastmastersService.callBot('general-evaluator', { stage: 'intro' })
  ]);
  await speak(intro || t('Welcome {v0}!', { v0: userName.value }), 'toastmaster');
  await speak(timerIntro || '', 'timer');
  await speak(ahIntro || '', 'ah');
  try {
    const m = (gramIntro || '').match(/\{[\s\S]*\}/);
    if (m) { const j = JSON.parse(m[0]); wordOfTheDay = j.word || ''; await speak(t('{v0} Today’s Word of the Day is “{v1}”, meaning: {v2}.', { v0: j.intro, v1: j.word, v2: j.meaning }), 'grammarian'); }
    else { wordOfTheDay = 'eloquent'; await speak(t('Hello, I am your Grammarian.'), 'grammarian'); }
  } catch { wordOfTheDay = 'eloquent'; await speak(t('Hello, I am your Grammarian.'), 'grammarian'); }
  await speak(seIntro || '', 'speechEval');
  await speak(geIntro || '', 'generalEval');

  if (speechType === 'Evaluation Speech') {
    showSkipIntro.value = false; didSkipIntro.value = false;
    const intro2 = await toastmastersService.callBot('toastmaster', { stage: 'evalspeech_intro' });
    await speakForced(intro2 || '', 'toastmaster');
    captionText.value = t('Preparing sample speech…');
    sampleSpeechText = await toastmastersService.callBot('sample-speech', {}) || t('Three years ago, I lost my job. I started a business that failed. But that failure taught me everything.');
    captionSpeaker.value = sampleSpeakerCaption; captionText.value = t('Listen carefully…');
    await speakForced(sampleSpeechText, 'toastmaster');
    const ho = await toastmastersService.callBot('toastmaster', { stage: 'evalspeech_handover', user_name: userName.value });
    await speakForced(ho || '', 'toastmaster');
  } else if (speechType === 'Ice Breaker' && cameraAvailable.value && !cameraEnabled.value) {
    // `cameraAvailable` and not just `cameraEnabled`: asking somebody with no
    // camera to turn theirs on is the Toastmaster reading out an instruction
    // that cannot be followed, which reads as the meeting being broken.
    const msg = await toastmastersService.callBot('toastmaster', { stage: 'icebreaker_camera', user_name: userName.value });
    await speak(msg || t('Please turn on your camera.'), 'toastmaster');
  }
  if (speechType !== 'Evaluation Speech') {
    const handover = await toastmastersService.callBot('toastmaster', { stage: 'handover', topic: displayTopic.value, user_name: userName.value, speech_type: speechType, user_role: 'Speaker' });
    await speak(handover || t('Please welcome {v0}!', { v0: userName.value }), 'toastmaster');
  }
}

// ─── Role Intro ───
async function roleIntroFlow() {
  captionText.value = `Setting up ${userRole} practice…`;
  const task = await toastmastersService.generateRoleTask({ user_role: userRole, user_name: userName.value });
  roleTaskInfo.value = task || t('Practice your {v0} duties.', { v0: userRole });

  const intro = await toastmastersService.callBot('toastmaster', { stage: 'intro', topic: displayTopic.value, speech_type: speechType, user_name: userName.value, user_role: userRole });
  await speak(intro || t('Welcome {v0}! Today you have the {v1} role.', { v0: userName.value, v1: userRole }), 'toastmaster');

  // Disable skip for sample speech
  showSkipIntro.value = false; didSkipIntro.value = false;

  captionText.value = t('Generating sample speech…');
  sampleSpeechText = await toastmastersService.callBot('sample-speech', { purpose: 'role_practice', user_role: userRole } as any)
    // Deliberately full of fillers -- it is the speech the Evaluation-Speech
    // exercise asks the candidate to critique, so the "um" and the "like" are
    // the material rather than sloppiness. Translated, the fillers become that
    // language's own.
    || t('Three years ago I was afraid of failure. Then I, um, lost my job and started a business. It failed but, you know, that failure taught me everything. I basically learned that, like, taking risks is actually the key.');
  sampleSpeechFillers = countFillers(sampleSpeechText);

  await speakForced(t('Now our sample speaker will deliver a speech. Listen carefully!'), 'toastmaster');
  captionSpeaker.value = t('🎙️ Sample Speaker'); captionText.value = t('Listen carefully…');
  await speakForced(sampleSpeechText, 'toastmaster');

  const ho = await toastmastersService.callBot('toastmaster', { stage: 'handover', topic: displayTopic.value, user_name: userName.value, speech_type: speechType, user_role: userRole });
  await speakForced(ho || t('Your turn, {v0}.', { v0: userName.value }), 'toastmaster');
}

// ─── User starts speaking ───
function userSpeak() {
  if (!micEnabled.value) { alert(t('Please unmute your microphone first.')); return; }
  if (!mediaStream) { alert(t('The microphone is not ready yet.')); return; }
  if (typeof MediaRecorder === 'undefined') { alert(t('Audio recording is not supported by this browser.')); return; }
  speechSynthesis.cancel();
  stopSpeechKeepAlive();
  isSpeaking = true; isSpeakingRef.value = true;
  answer.value = emptyAnswer(); selection.value = { start: 0, end: 0 };
  showSkipIntro.value = false;
  startContinuousRecording().catch(e => console.error('[Recording]', e));
  startTimer();
  speakBtnDisabled.value = true; finishBtnDisabled.value = false;
  captionSpeaker.value = t('You'); captionText.value = t('🎤 Speak now! Your words appear here every few seconds.');
}

// ─── User finishes ───
async function userFinish() {
  isSpeaking = false; isSpeakingRef.value = false;
  stopCurrentRecording();
  await new Promise(r => setTimeout(r, 800));
  captionText.value = t('Finalizing transcription…');
  await new Promise(r => setTimeout(r, 1500));
  clearInterval(timerInterval); currentSpeaker.value = null;
  const duration = Math.floor((Date.now() - startTime) / 1000);
  finishBtnDisabled.value = true;

  showSkipReports.value = true; didSkipReports.value = false;

  const fillers = countFillers(speechText());
  fillerCounts.value = { ...fillers.counts };
  const onTime = duration >= minTime * 60 && duration <= maxTime * 60;
  const cleanTranscript = speechText().trim() || t('(no speech captured)');

  reportsVisible.value = true;
  reports.timer = t('⏳ Generating…'); reports.ah = t('⏳ Generating…');
  reports.gram = t('⏳ Analyzing…'); reports.speechEval = t('⏳ Analyzing…');
  reports.generalEval = t('⏳ Analyzing…'); reports.bodyLang = t('⏳ Analyzing…');

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

  reports.timer = await toastmastersService.callBot('timer', { stage: 'report', duration, min_time: minTime, max_time: maxTime }) || t('{v0}m {v1}s.', { v0: Math.floor(duration / 60), v1: duration % 60 });
  if (!didSkipReports.value) await speak(reports.timer, 'timer');

  reports.ah = await toastmastersService.callBot('ah-counter', { stage: 'report', counts: fillers.counts, total: fillers.total }) || t('{v0} filler words.', { v0: fillers.total });
  if (!didSkipReports.value) await speak(reports.ah, 'ah');

  reports.gram = await toastmastersService.callBot('grammarian', { stage: 'report', transcript: cleanTranscript }) || t('Good language overall.');
  if (!didSkipReports.value) await speak(reports.gram, 'grammarian');

  reports.speechEval = await toastmastersService.callBot('speech-evaluator', { stage: 'report', transcript: cleanTranscript, topic: displayTopic.value, speech_type: speechType, sample_speech: sampleSpeechText }) || t('Solid effort.');
  if (!didSkipReports.value) await speak(reports.speechEval, 'speechEval');

  stopCameraAnalysis();
  const blData = getBodyLanguageData();
  /*
   * With no camera there is nothing to analyse, and the zeros are not a result.
   * Sent through the bot they read as 0/100 engagement and a face never visible
   * -- a damning assessment of somebody who never had a camera to look at. So
   * the card says what happened instead, and no provider call is spent on it.
   */
  const blAdvice = cameraAvailable.value
    ? (await toastmastersService.callBot('body-language', { body_language: blData })
       || t('Maintain eye contact.'))
    : t('No camera was used for this meeting, so there is no body-language analysis. The microphone is all a meeting needs — turn a camera on next time if you would like this report too.');
  reports.bodyLang = cameraAvailable.value
    ? `${t('Engagement')}: ${blData.engagement_score}/100 | ${t('Face visible')}: ${blData.face_visibility_percent}% | ${t('Looking forward')}: ${blData.looking_forward_percent}% | ${t('Centered')}: ${blData.centered_percent}%\n\n${blAdvice}`
    : blAdvice;

  reports.generalEval = await toastmastersService.callBot('general-evaluator', { stage: 'report', transcript: cleanTranscript, speech_type: speechType, topic: displayTopic.value, duration, total_fillers: fillers.total, on_time: onTime, min_time: minTime, max_time: maxTime, engagement_score: blData.engagement_score }) || t('Good meeting overall.');
  if (!didSkipReports.value) await speak(reports.generalEval, 'generalEval');

  const timeScore = onTime ? 40 : Math.max(0, 40 - Math.abs(duration - (minTime * 60 + maxTime * 60) / 2) / 3);
  const wc = wordCount(speechText()) || 1;
  const fillerScore = Math.max(0, 30 - (fillers.total / wc) * 300);
  const bodyScore = blData.engagement_score * 0.3;
  const overall = Math.round(timeScore + fillerScore + bodyScore);

  await saveSessionData('Speaker', duration, fillers, overall, blData, blAdvice);
  if (didSkipReports.value) { captionText.value = t('✅ Saved! Redirecting…'); setTimeout(() => router.push('/toastmasters/results'), 1200); }
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
}

async function finishRoleFlow(duration: number, fillers: { counts: Record<string, number>; total: number }, onTime: boolean, cleanTranscript: string) {
  reports.roleEval = t('⏳ Evaluating your role…');

  const closing = await toastmastersService.callBot('toastmaster', { stage: 'closing', user_name: userName.value, user_role: userRole });
  if (!didSkipReports.value) await speak(closing || '', 'toastmaster');

  stopCameraAnalysis();
  const blData = getBodyLanguageData();
  /*
   * With no camera there is nothing to analyse, and the zeros are not a result.
   * Sent through the bot they read as 0/100 engagement and a face never visible
   * -- a damning assessment of somebody who never had a camera to look at. So
   * the card says what happened instead, and no provider call is spent on it.
   */
  const blAdvice = cameraAvailable.value
    ? (await toastmastersService.callBot('body-language', { body_language: blData })
       || t('Maintain eye contact.'))
    : t('No camera was used for this meeting, so there is no body-language analysis. The microphone is all a meeting needs — turn a camera on next time if you would like this report too.');
  reports.bodyLang = cameraAvailable.value
    ? `${t('Engagement')}: ${blData.engagement_score}/100 | ${t('Face visible')}: ${blData.face_visibility_percent}% | ${t('Centered')}: ${blData.centered_percent}%\n\n${blAdvice}`
    : blAdvice;

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

  const wc = wordCount(speechText());
  const contentScore = Math.min(40, wc * 0.5);
  const fillerPenalty = Math.max(0, 30 - (fillers.total / Math.max(1, wc)) * 300);
  const bodyScore = blData.engagement_score * 0.3;
  const overall = Math.round(Math.min(100, contentScore + fillerPenalty + bodyScore));

  await saveSessionData(userRole, duration, fillers, overall, blData, blAdvice);
  if (didSkipReports.value) { captionText.value = t('✅ Saved! Redirecting…'); setTimeout(() => router.push('/toastmasters/results'), 1200); }
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
      duration_seconds: duration, transcript: speechText().trim(),
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
  stopSpeechKeepAlive();
  // The clip is an `AudioBufferSourceNode`, and `speechSynthesis.cancel()` does
  // not reach one — without this the bots go on talking over whatever page the
  // student opens next.
  trackEnergy(false);
  speechAudio.dispose();
});
</script>

<style src="@/assets/css/toastmasters.css"></style>