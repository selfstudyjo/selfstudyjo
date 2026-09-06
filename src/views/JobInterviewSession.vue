<template>
  <div class="ji-meeting-room">
    <div class="ji-meeting-header">
      <div>
        <strong>{{ $t('💼 {v0} Interview', { v0: interviewType }) }}</strong>
        <span class="ji-badge" v-if="topic && interviewType === 'Technical'">{{ topic }}</span>
        <!--
          Both of these confirm something the candidate asked for and would
          otherwise have no way to see: that the CV really did reach the
          interviewer, and that this sitting is being treated as a redo rather
          than as a fresh interview that will re-ask the same questions.
        -->
        <span class="ji-badge" v-if="cvTitle" :title="'The interviewer has read: ' + cvTitle">{{ $t('📄 CV attached') }}</span>
        <span class="ji-badge" v-if="attempt > 1" :title="$t('New questions — the interviewer knows what you have already been asked')">{{ $t('🔁 Attempt {v0}', { v0: attempt }) }}</span>
      </div>
      <div class="ji-header-right">
        <span class="ji-q-counter" v-if="phase !== 'idle'">Q {{ Math.min(questionNumber, maxQuestions) }} / {{ maxQuestions }}</span>
        <span class="ji-timer-display" :class="{ over: timeUp }" :title="'Whole interview — ' + plannedMinutes + ' min planned'">{{ timerDisplay }}</span>
      </div>
    </div>

    <div class="ji-stage">
      <!--
        The interviewer.

        Built in 3D rather than played back — see `stage3d/figures.ts`. The
        framing problem the filmed version had here is simply gone with it: the
        assets were square and this tile is 16/10, so 37.5% of the height had to
        be thrown away and the crop that worked for four of the six cast people
        cut the crown off the other two. A camera has no crop; it has a target
        and a focal length, and the same shot is correct at every tile shape.
      -->
      <PersonStage
        class="ji-stage3d"
        :seats="stageSeats"
        :speaking="currentSpeaker === 'interviewer' ? 'interviewer' : null"
        :energy="speechEnergy"
        grid-class="ji-stage3d-grid"
        tile-class="ji-video-tile ji-interviewer"
      >
        <template #tile>
          <div class="ji-name-tag">{{ interviewerTag }}</div>
          <div class="ji-speaking-dot"></div>
        </template>
      </PersonStage>

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
        <div class="ji-name-tag">{{ $t('👤 You ({v0})', { v0: userName }) }}</div>
        <div class="ji-self-status">
          <span class="ji-status-icon" :class="{ muted: !micEnabled }">{{ micEnabled ? '🎤' : '🔇' }}</span>
          <span class="ji-status-icon" :class="{ muted: !cameraEnabled }">{{ cameraEnabled ? '📹' : '📷' }}</span>
        </div>
        <div class="ji-speaking-dot"></div>
      </div>
    </div>

    <!-- Current question -->
    <div class="ji-question-box" v-if="currentQuestionText">
      <div class="ji-question-label">{{ $t('❓ Interviewer asks:') }}</div>
      <div class="ji-question-text">{{ currentQuestionText }}</div>
    </div>

    <!-- Caption / status -->
    <div class="ji-caption-box">
      <strong>{{ captionSpeaker }}:</strong>
      <span>{{ captionText }}</span>
    </div>

    <!--
      The answer, EDITABLE while it is being spoken.

      It was a read-only div, which is fine for a native speaker and useless for
      anybody else: Whisper faithfully transcribes a false start, so the answer
      that reached the report was the wrong sentence, the word "sorry", and then
      the right sentence -- and the coach then marked the candidate down for
      rambling. Three ways out, and they are three because they are used at
      different moments: type in the box, say "sorry" to drop the last part, or
      highlight a phrase and dictate over it. See src/utils/answerEditing.ts.
    -->
    <div class="ji-answer-box" v-if="phase === 'answering' || answer.text">
      <div class="ji-answer-head">
        <h4>
          {{ $t('✍️ Your answer') }}
          <span class="ji-answer-live" v-if="phase === 'answering'">{{ $t('🎤 transcribing…') }}</span>
        </h4>
        <div class="ji-answer-meta">
          <!--
            The per-answer clock, not the interview one. A candidate has no way
            to judge ninety seconds while thinking, and "you spoke for four
            minutes" is a note in the report rather than something they can act
            on at the time.
          -->
          <span class="ji-answer-clock" :class="answerClockClass" v-if="phase === 'answering'"
                :title="'About ' + answerSeconds + 's is a strong answer'">{{ answerClock }}</span>
          <span class="ji-answer-words">{{ $t('{v0} words', { v0: answerWords }) }}</span>
        </div>
      </div>

      <textarea
        ref="answerEl"
        class="ji-answer-input"
        :value="answer.text"
        :readonly="phase !== 'answering' && phase !== 'awaiting'"
        @input="onAnswerTyped"
        @select="trackSelection"
        @keyup="trackSelection"
        @mouseup="trackSelection"
        :placeholder="answerPlaceholder"
        spellcheck="true"
        rows="4"
      ></textarea>

      <div class="ji-answer-tools" v-if="phase === 'answering'">
        <!--
          `mousedown.prevent` keeps the focus in the textarea, and it is not
          cosmetic: pressing a button blurs the field, and a browser that
          collapses the selection on blur would disable this button between
          mousedown and click -- so the click never fires and the one control
          this whole feature is named after silently does nothing. Preventing
          the focus change means there is no blur to collapse anything.
        -->
        <button type="button" class="ji-btn-tool" :disabled="!hasSelection"
                @mousedown.prevent @click="replaceHighlighted"
                :title="$t('Delete what you highlighted and carry on speaking in its place')">
          {{ $t('✂️ Replace highlighted') }}
        </button>
        <button type="button" class="ji-btn-tool" v-if="answer.caret !== null" @click="backToEnd">
          {{ $t('↦ Back to the end') }}
        </button>
        <button type="button" class="ji-btn-tool" :disabled="!answer.text" @click="undoLastPart">
          {{ $t('↩︎ Undo last part') }}
        </button>
        <button type="button" class="ji-btn-tool ji-btn-tool-danger" :disabled="!answer.text" @click="clearAnswer">
          {{ $t('🗑️ Clear') }}
        </button>
        <label class="ji-answer-toggle" :title="$t('Turn off if the interview is about a subject where you say these words for real')">
          <input type="checkbox" v-model="voiceEditing"> {{ $t('spoken corrections') }}
        </label>
      </div>

      <div class="ji-answer-caret" v-if="answer.caret !== null">
        {{ $t('▌ What you say next goes') }} <strong>{{ $t('here') }}</strong>: <em>{{ caretHintText }}</em>
      </div>
      <div class="ji-answer-hint" v-else-if="phase === 'answering' && voiceEditing">
        {{ $t('Say') }} <strong>{{ $t('“sorry”') }}</strong> {{ $t('to delete the last part,') }} <strong>{{ $t('“sorry sorry”') }}</strong> {{ $t('for the last two — or highlight a phrase and press') }} <strong>{{ $t('Replace highlighted') }}</strong>{{ $t('. You can also just type.') }}
      </div>
      <!--
        The caption reads "Listening…" whether the recorder is running or has
        died, so a fault here has no natural symptom. Saying so is the whole
        difference between a bug that gets reported and one that gets reported
        as "it just sticks".
      -->
      <div class="ji-transcript-warning" v-if="recordingError">⚠️ {{ recordingError }}</div>
    </div>

    <!--
      The report is written DURING the interview, so the candidate is told so.

      Without this line the coaching calls are invisible: the only evidence they
      are happening is that the report appears quickly at the end, which is not
      evidence of anything while you are waiting for it. It is also the one
      place a stalled coaching call shows up at all.
    -->
    <div class="ji-live-report" v-if="phase !== 'idle' && !reportVisible">
      <span class="ji-live-report-dot" :class="{ working: coachingInFlight > 0 }"></span>
      <span v-if="qaPairs.length">
        {{ $t('📋 Your report is being written as you go —') }}
        <strong>{{ coachedCount }}</strong> {{ $t('of {v0} answers coached', { v0: qaPairs.length }) }}<span
          v-if="coachingInFlight">{{ $t(', {v0} in progress', { v0: coachingInFlight }) }}</span>.
      </span>
      <span v-else>{{ $t('📋 Your report starts building from your first answer — nothing waits until the end.') }}</span>
    </div>

    <!--
      THE PRACTICE RECORD, under the live-report strip.

      It cannot fail anybody - `FAILS_AT.interview` is null, so `IntegrityMeter`
      draws no strike pips and says so in words. It is here because the points
      are PUBLIC and a candidate is owed the running total that produced them,
      not because anything is being invigilated.

      Hidden once the report is up: the sitting is closed by then, so a panel
      counting breaches at somebody reading their coaching would be counting
      nothing and reading as an accusation.
    -->
    <IntegrityMeter
      v-if="phase !== 'idle' && !reportVisible"
      context="interview"
      :verdict="sitting.verdict.value"
      :events="sitting.log.value"
    />

    <!--
      Only the microphone can stop an interview, so only the microphone gets a
      blocking panel. It says what actually went wrong and offers the retry,
      because the two commonest causes — the device held by another app, and
      access blocked at the padlock — are both things the candidate fixes in
      another window and comes straight back from.
    -->
    <div class="ji-media-error" v-if="mediaError && !reportVisible">
      <div class="ji-media-error-title">{{ $t('🎤 Your microphone could not be started') }}</div>
      <p>{{ mediaError }}</p>
      <p class="ji-media-error-hint">
        {{ $t('A microphone is required — your spoken answers are transcribed. A camera is optional and the interview runs perfectly without one.') }}
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
      <button @click="startAnswering" :disabled="phase !== 'awaiting'" class="ji-btn-success">{{ $t('🎤 Start Answering') }}</button>
      <button @click="submitAnswer" :disabled="phase !== 'answering'" class="ji-btn-warning">{{ $t('✅ Submit Answer') }}</button>
      <button @click="toggleMic" :disabled="!mediaReady" class="ji-btn-control" :class="{ off: !micEnabled }">{{ micEnabled ? '🎤 Mic On' : '🔇 Mic Off' }}</button>
      <!--
        Enabled as soon as the MICROPHONE is ready, not the camera. Pressing it
        after a camera failure is a fresh attempt at opening one, which is what
        makes "close Teams, then press it" work without leaving the interview.
      -->
      <button @click="toggleCamera" :disabled="!mediaReady || cameraBusy" class="ji-btn-control" :class="{ off: !cameraEnabled }">
        {{ cameraBusy ? '⏳ Camera…' : cameraEnabled ? '📹 Camera On' : '📷 Turn Camera On' }}
      </button>
      <button @click="endInterview" :disabled="phase === 'idle' || phase === 'processing'" class="ji-btn-secondary">{{ $t('⏹️ End Interview') }}</button>
      <button @click="leave" class="ji-btn-danger">{{ $t('Leave') }}</button>
    </div>

    <!-- Report -->
    <div class="ji-reports-panel" v-if="reportVisible">
      <h2>{{ $t('📋 Interview Feedback Report') }}</h2>

      <div class="ji-score-card">
        <div class="ji-score-circle" :class="scoreClass(report.score)">{{ report.score }}<span>/100</span></div>
        <div class="ji-recommendation">
          <div class="ji-rec-label">{{ $t('Recommendation') }}</div>
          <div class="ji-rec-value">{{ report.recommendation || '—' }}</div>
        </div>
      </div>

      <!--
        Where the score came from. One number out of a hundred tells a candidate
        they did badly and nothing about what to practise; five tell them their
        content was fine and their structure was not, which is a different
        evening's work. Absent on a replica a release behind, and the panel
        simply does not render.
      -->
      <div class="ji-report-card" v-if="breakdownRows.length">
        <h3>{{ $t('📊 Where the score came from') }}</h3>
        <div class="ji-bars">
          <div class="ji-bar-row" v-for="row in breakdownRows" :key="row.key">
            <span class="ji-bar-label">{{ row.label }}</span>
            <span class="ji-bar-track"><span class="ji-bar-fill" :class="row.band" :style="{ width: row.value + '%' }"></span></span>
            <span class="ji-bar-value">{{ row.value }}</span>
          </div>
        </div>
        <p class="ji-card-lead">{{ weakestLine }}</p>
      </div>

      <!--
        The most actionable thing in the report, so it is near the top rather
        than under twelve questions of coaching. A candidate reads a report
        once; what they need from it is the next evening's practice list.
      -->
      <div class="ji-report-card ji-report-plan" v-if="report.action_plan && report.action_plan.length">
        <h3>{{ $t('🎯 Do this before your next interview') }}</h3>
        <ol class="ji-plan-list"><li v-for="(step, i) in report.action_plan" :key="i">{{ step }}</li></ol>
      </div>

      <div class="ji-report-card ji-report-standout" v-if="report.standout_moment">
        <h3>{{ $t('🌟 Your strongest moment') }}</h3><p>{{ report.standout_moment }}</p>
      </div>

      <div class="ji-report-card ji-report-flags" v-if="report.red_flags">
        <h3>{{ $t('⚠️ What would worry a hiring manager') }}</h3><p>{{ report.red_flags }}</p>
      </div>

      <div class="ji-report-card"><h3>{{ $t('📝 Overall Summary') }}</h3><p>{{ report.summary }}</p></div>
      <div class="ji-report-card"><h3>{{ $t('✅ Strengths') }}</h3><p>{{ report.strengths }}</p></div>
      <div class="ji-report-card"><h3>{{ $t('📈 Areas to Improve') }}</h3><p>{{ report.improvements }}</p></div>
      <div class="ji-report-card"><h3>🧠 {{ interviewType === 'HR' ? 'Competency Assessment' : 'Technical Assessment' }}</h3><p>{{ report.technical_assessment }}</p></div>
      <div class="ji-report-card"><h3>{{ $t('🗣️ Communication') }}</h3><p>{{ report.communication }}</p></div>

      <div class="ji-report-card">
        <h3>{{ $t('💬 Question-by-question coaching ({v0})', { v0: qaPairs.length }) }}</h3>
        <p class="ji-card-lead">
          {{ $t('For each question: what you said, your own answer rewritten to be stronger, a short model answer you can rehearse, and why the interviewer asked it.') }}
        </p>
        <div class="ji-qa-list">
          <QaCoaching v-for="(qa, i) in qaPairs" :key="i" :qa="qa" :index="i" />
          <div v-if="qaPairs.length === 0" style="color:var(--ji-text-mute)">{{ $t('No questions were answered.') }}</div>
        </div>
      </div>

      <div class="ji-controls">
        <button @click="$router.push('/job-interview/results')" class="ji-btn-primary">{{ $t('View All Results →') }}</button>
        <!--
          Straight back into the room with the same role, requirements and CV.
          Re-typing a page of job requirements is the reason nobody practised the
          same role twice; the interviewer is told what it has already asked.
        -->
        <button @click="redoSameInterview" class="ji-btn-success">{{ $t('🔁 Redo This Interview') }}</button>
        <button @click="editAndRedo" class="ji-btn-secondary">{{ $t('✏️ Change Details & Redo') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { aiLanguage, aiLanguageHeaders, localeId, locale as activeLocale, t } from '@/i18n/runtime';
import {
  NO_SERVER, deviceCanSpeak, describe as describeSpeech, planSpeech,
  serverVoicesFor, type ServerVoices,
} from '@/utils/roomSpeech';
import { createSpeechAudio } from '@/utils/speechAudio';
import { spokenEnergy } from '@/stage3d/figures';
import { shapeRatio } from '@/components/newscast/voiceShaper';
import { newsService, type SpeechClip } from '@/services/news.service';
import { ref, computed, nextTick, reactive, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import {
  jobInterviewService, type QAPair, type EvaluationResult, type ScoreBreakdown,
} from '@/services/jobinterview.service';
import PersonStage from '@/components/stage3d/PersonStage.vue';
import IntegrityMeter from '@/components/practice/IntegrityMeter.vue';
import { usePracticeSitting } from '@/composables/usePracticeSitting';
import { countWords } from '@/i18n/locales';
import QaCoaching from '@/components/jobinterview/QaCoaching.vue';
import {
  INTERVIEWER_TITLES, actorById, interviewerLabel, isActorId,
  pickInterviewer, type InterviewType,
} from '@/cast/actors';
import {
  MAX_AVOID_QUESTIONS, MAX_QUESTIONS, clampMinutes,
  fallbackQuestion as fallbackQuestionFor, isWholeQuestion, newSessionSeed,
  normaliseQuestion, plannedQuestionCount, redoConfigFrom, secondsPerAnswer,
  type InterviewConfig,
} from '@/utils/interviewSetup';
import {
  applyTranscript, caretHint, emptyAnswer, replaceSelection, resumeAtEnd,
  setTypedText, undoSegments, wordCount, type AnswerState,
} from '@/utils/answerEditing';
import {
  VIDEO_CONSTRAINTS, acquireInterviewMedia, describeMediaError, hasVideoInput,
  mediaUnsupportedReason,
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

/**
 * Makes two interviews with identical settings different interviews.
 *
 * Read from the config rather than minted here, for the same reason the
 * interviewer is: this view is re-created by a reload, and a seed regenerated
 * on the way back in would re-plan the interview the candidate is halfway
 * through. A config written before it existed gets one now, which is right --
 * an old config being replayed is a fresh sitting.
 */
const sessionSeed = Number(cfg.sessionSeed) || newSessionSeed();

/**
 * How many questions, and how long each answer is worth.
 *
 * The candidate picks the COUNT now and the minutes are derived from it at
 * ninety seconds each, which is the way round people actually think about
 * interview practice. `plannedQuestionCount` falls back to the old
 * minutes-derived figure for a config written before 2026-08-22, so a redo of
 * an old interview runs at exactly the length it did.
 */
const maxQuestions = plannedQuestionCount(cfg);
const answerSeconds = secondsPerAnswer(plannedMinutes, maxQuestions);

/**
 * THE PRACTICE LEDGER, for the first time in this room.
 *
 * Until 2026-09-06 an interview produced no record anywhere on the leaderboard
 * at all: a candidate could sit ten of them and the board would say they had
 * done nothing. It records conduct AND effort now - see `practiceIntegrity`.
 *
 * WHAT IS WATCHED, AND WHAT IS DELIBERATELY NOT
 *
 * `window` and `focusAward` are on, because presence is the exercise here in a
 * way it is not in a lab: somebody is asking you a question. `clipboard` is on
 * too, and it is the one that matters most - the box a paste lands in is the
 * TRANSCRIPT, which is the record of what the candidate said, so a pasted
 * answer is coached, evaluated and reported as speech nobody spoke and the
 * report is wrong about the one thing it exists to be right about.
 *
 * `devtools`, `print` and `fullscreen` are OFF. There is no answer key in this
 * room, so opening the console during a mock interview is somebody looking at a
 * page rather than misconduct; printing the report is reading it; and the room
 * is not full screen to begin with.
 *
 * `abandonedAs` is why there is no `note()` in `leave()`. There are three ways
 * out of here - the Leave button, a router navigation and closing the tab - and
 * only one of them runs a handler this view controls. All three tear the
 * component down, so `usePracticeSitting` notes it from its own unmount, which
 * is the single place that sees all three.
 */
const sitting = usePracticeSitting({
  context: 'interview',
  watch: { devtools: false, print: false, fullscreen: false },
  abandonedAs: 'interview.left_early',
});

/**
 * Whether a transcript chunk for THIS answer came back from the microphone.
 *
 * The evidence behind `speaking.delivered`, and the reason that award is worth
 * paying at all: it cannot be had by typing. Set in `applyChunk`, which is the
 * only place a transcription lands, and cleared when each answer opens.
 */
let spokeThisAnswer = false;

/**
 * How many words an answer needs before it counts as one.
 *
 * `countWords` rather than `split(' ').length`, because a Chinese answer has no
 * spaces in it and a naive count makes every one of them a single word - which
 * is working rule 40, and it has already been paid for twice in this room's
 * own question guard.
 */
const SPOKEN_WORD_FLOOR = 12;

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
  return fallbackQuestionFor(interviewType, topic, qnum, attempt, sessionSeed);
}

/** Two questions that differ only by punctuation are the same question. */
function sameQuestion(a: string, b: string): boolean {
  const left = normaliseQuestion(a);
  const right = normaliseQuestion(b);
  if (!left || !right) return false;
  // Containment either way, because the commonest re-ask is the same question
  // with a clause bolted on the front.
  return left === right || left.includes(right) || right.includes(left);
}

/**
 * A local question this candidate has not been asked in this sitting.
 *
 * Reached when app 27 is unreachable, and also when a replica that has not
 * pulled the anti-repeat work hands back something already asked. The rotation
 * alone does not cover the second case: it guarantees distinct questions across
 * the pool and says nothing about which ones the AI has already used. Walking
 * the pool for an unasked one does.
 */
function unaskedFallback(qnum: number, asked: string[]): string {
  for (let step = 0; step < MAX_QUESTIONS; step++) {
    const candidate = fallbackQuestion(qnum + step);
    if (!asked.some(prev => sameQuestion(prev, candidate))) return candidate;
  }
  return fallbackQuestion(qnum);
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
const questionNumber = ref(0);
const qaPairs = ref<QAPair[]>([]);

/**
 * The answer being given, and where the next spoken words land.
 *
 * One object rather than a string, because a caret is part of the answer's
 * state the moment the candidate can highlight a phrase and dictate over it.
 * The transformations live in src/utils/answerEditing.ts and every one of them
 * takes the CURRENT text as an argument -- a module holding its own buffer would
 * silently discard whatever was typed by hand between two chunks, which is the
 * bug the old `answerBuffer` had waiting for it.
 */
const answer = ref<AnswerState>(emptyAnswer());
const answerEl = ref<HTMLTextAreaElement>();
/** Whether "sorry" and friends edit the answer. Off is a real choice — see below. */
const voiceEditing = ref(cfg.voiceEditing !== false);
const selection = ref<{ start: number; end: number }>({ start: 0, end: 0 });
/** Seconds spent on the current answer, for the per-answer clock. */
const answerElapsed = ref(0);

/**
 * The areas this interview is planned to cover, one per question.
 *
 * Empty is a supported state and the room behaves exactly as it used to in it:
 * the plan is what stops a stateless model asking its most probable question
 * three times, and losing it costs variety rather than an interview.
 */
const questionPlan = ref<string[]>([]);

/** Coaching calls still in the air. Shown, because otherwise they are invisible. */
const coachingInFlight = ref(0);

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
/**
 * Why nothing is being transcribed.
 *
 * Surfaced because the failure mode here has no natural symptom: the caption
 * says "Listening…" whether the recorder is running or has thrown, so a broken
 * recording loop and a candidate who has not started talking look identical.
 * That is how a ReferenceError on every chunk went unnoticed except as
 * "it just sticks".
 */
const recordingError = ref('');

const timerDisplay = ref('00:00');
const timeUp = ref(false);

const reportVisible = ref(false);
const report = reactive<EvaluationResult>({
  score: 0, summary: '', strengths: '', improvements: '',
  technical_assessment: '', communication: '', recommendation: '',
  action_plan: [], standout_moment: '', red_flags: '', score_breakdown: {},
});

// Internal
// Two streams, not one: the microphone is required and the camera is not, so
// they are opened, toggled and stopped independently. See initMedia().
let audioStream: MediaStream | null = null;
let videoStream: MediaStream | null = null;
/**
 * True when one stream carries both tracks, which is the normal case: the
 * combined request is tried first because it is the one browsers grant.
 * Stopping it twice would be harmless, but toggling the camera must not stop
 * the microphone with it.
 */
let streamsAreShared = false;
let startTime = 0;
let timerInterval: any = null;
let answerTimer: any = null;
let answerStartedAt = 0;
let isAnswering = false;
let recordingLoopActive = false;
let currentRecorder: MediaRecorder | null = null;
let voices: SpeechSynthesisVoice[] = [];

// ====== The answer editor ======
//
// Everything below is thin on purpose: the rules live in
// src/utils/answerEditing.ts, which is a plain module with no Vue in it and a
// check of its own (`npm run check:answeredit`). What is here is the wiring --
// where the caret is, what is selected, and putting the textarea's own cursor
// back where the candidate would expect it.

const answerWords = computed(() => wordCount(answer.value.text));
const caretHintText = computed(() => caretHint(answer.value));
const hasSelection = computed(() => selection.value.end > selection.value.start);

const answerClock = computed(() => {
  const s = answerElapsed.value;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
});

/**
 * Amber at the target, red half again past it.
 *
 * Banded rather than a countdown, and nothing is ever cut off: a hard stop on a
 * practice answer would teach a candidate to rush, which is the opposite of the
 * problem. The bands are the same advice a real interviewer's body language
 * gives -- you are at time, you are well past it.
 */
const answerClockClass = computed(() => {
  if (answerElapsed.value >= answerSeconds * 1.5) return 'over';
  if (answerElapsed.value >= answerSeconds) return 'due';
  return '';
});

const answerPlaceholder = computed(() => {
  if (phase.value === 'answering') {
    return t('Speak — your words appear here every few seconds. You can also type or correct anything in this box while you talk.');
  }
  return '—';
});

/** Put the textarea's own cursor where the next dictated words will land. */
async function syncCursor() {
  const at = answer.value.caret;
  if (at === null) return;
  await nextTick();
  const el = answerEl.value;
  if (!el) return;
  try { el.setSelectionRange(at, at); } catch { /* not focusable yet */ }
}

/** One transcribed chunk, with spoken corrections applied. */
function applyChunk(text: string) {
  // THE ONE PLACE A TRANSCRIPTION LANDS, so it is the one place that can say
  // an answer was SPOKEN rather than typed. `speaking.delivered` rests on it.
  spokeThisAnswer = true;
  answer.value = applyTranscript(answer.value, text, { voiceEditing: voiceEditing.value });
  void syncCursor();
}

function onAnswerTyped(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  answer.value = setTypedText(answer.value, el.value);
}

function trackSelection() {
  const el = answerEl.value;
  if (!el) return;
  selection.value = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
}

/**
 * Delete what is highlighted and dictate into the gap.
 *
 * The selection is read from the element rather than from `selection` at the
 * moment of the click, because clicking the button can collapse a selection on
 * some browsers before the handler runs -- and a button that silently does
 * nothing on the one browser nobody tested is worse than no button.
 */
function replaceHighlighted() {
  const el = answerEl.value;
  const start = el?.selectionStart ?? selection.value.start;
  const end = el?.selectionEnd ?? selection.value.end;
  if (end <= start) return;
  answer.value = replaceSelection(answer.value, start, end);
  selection.value = { start: answer.value.caret ?? 0, end: answer.value.caret ?? 0 };
  void syncCursor();
  el?.focus();
}

function backToEnd() {
  answer.value = resumeAtEnd(answer.value);
}

/**
 * The button form of saying "sorry" — for anybody who would rather not.
 *
 * Through the module's own `undoSegments`, not a second implementation here:
 * the anchor rule that stops an undo eating the half of the answer the
 * candidate never touched lives there, and a copy of it in a component is a
 * copy that is one refactor away from being wrong in only one of the two places
 * this can be asked for.
 */
function undoLastPart() {
  answer.value = undoSegments(answer.value, 1);
  void syncCursor();
}

function clearAnswer() {
  answer.value = emptyAnswer();
}

/*
 * EVERY voice the device has, not just the English ones.
 *
 * This used to filter `startsWith('en')`, which was correct while the room was
 * English-only and became the reason it went silent in Arabic: the filter ran
 * once at mount, so switching language could not bring an Arabic voice back
 * even on a machine that had one. `planSpeech` does the filtering now, per
 * line, against the current locale — and it is the only thing that knows a
 * wrong-language voice must never be cast.
 */
function loadVoices() {
  voices = speechSynthesis.getVoices();
  // `getVoices()` is EMPTY on the first call in every browser — the list is
  // populated asynchronously and `voiceschanged` is what says so, sometimes
  // more than once. So the server probe has to run again each time the list
  // moves: asked before the voices arrive, every language looks unavailable and
  // the room would reach for the network on a machine that can speak perfectly
  // well. The Newscast documents the same trap.
  void checkServerVoice();
}

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
  return planSpeech(
    voices, localeId.value, interviewer.gender, 0, serverVoices.value, speechAudio.capable);
}

/**
 * The seat list the 3D stage wants. One person, but the same shape the meeting
 * uses so both rooms drive one component.
 */
const stageSeats = computed(() => [{
  key: 'interviewer',
  figure: interviewer.id,
  label: interviewerTag,
}]);

/**
 * Can app 36 voice a gendered pair in this language?
 *
 * Asked ONCE per session rather than per line: the answer cannot change
 * mid-interview, and a probe per sentence is a round trip per sentence against
 * a PythonAnywhere replica whose first answer of the day takes ~20 seconds.
 * Asked at all only when the device has no voice for the language, because on a
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

function checkServerVoice(): Promise<void> {
  /*
    NEVER REJECTS. `speak` awaits this from inside an async promise executor,
    where a throw is swallowed and the promise it was meant to settle is left
    hanging — which is a room that stops mid-session. The same shape as the
    temporal-dead-zone throw this file has just been fixed for, so it is worth
    the one line.
  */
  serverProbe = (async () => {
    if (deviceCanSpeak(voices, localeId.value)) { serverVoices.value = NO_SERVER; return; }
    try {
      serverVoices.value = serverVoicesFor(await newsService.speechCapabilities(), localeId.value);
    } catch {
      // A silent interviewer is worse than an unshaped one, and `planSpeech`
      // falls through to the platform route on its own. Nothing to report.
      serverVoices.value = NO_SERVER;
    }
  })().catch(() => undefined);
  return serverProbe;
}

/**
 * ASKING THE WRONG QUESTION IS WHY ARABIC WAS SILENT HERE TOO.
 *
 * This used to read `caps.languages[locale].paired` — "does app 36 have a male
 * AND a female voice for this language" — and treat `false` as "the server
 * cannot help". App 36's replica has been missing `edge-tts` for some time, so
 * the single-voice fallback provider is in charge and `paired` is false for
 * every language; the room therefore turned down a perfectly good Arabic voice
 * and fell through to a platform route that says nothing on a machine with no
 * Arabic voice installed. `serverVoicesFor` answers the question that matters —
 * can it speak this language at all — and the gender is dealt with separately,
 * by reshaping the audio. See `roomSpeech.ts`.
 */

/*
  AND AGAIN WHEN THE LANGUAGE CHANGES.

  `loadVoices()` is the only other caller, and it runs at setup and on
  `voiceschanged` — neither of which fires when a reader picks a different
  language from the sidebar. So a room that had settled on `NO_SERVER` for
  English (correctly: the device has an English voice) kept that answer after the
  switch to Arabic, fell through to the platform route, and asked
  `speechSynthesis` for a language the machine has no voice for. Silence.

  The meeting has had this watch since it was written; this room did not, which
  is why the two behaved differently in the same language on the same machine.
*/
watch(localeId, () => { void checkServerVoice(); });

/*
  ============================================================
  THE FIRST CALL GOES HERE, BELOW EVERYTHING IT TOUCHES
  ============================================================

  `loadVoices()` calls `checkServerVoice()`, which assigns to `serverProbe` — and
  `serverProbe` is a `let`. Called from where it used to sit, a hundred lines
  above that declaration, the assignment is a write into a temporal dead zone:
  `ReferenceError: Cannot access 'serverProbe' before initialization`, thrown
  synchronously out of `setup`, so the whole room fails to mount and the page
  renders nothing.

  It is worth knowing that the version before it was ALSO unsafe and got away
  with it. `checkServerVoice` was an `async function` whose first statement reads
  `serverVoices`, declared in the same dead zone — and it survived only because
  `getVoices()` returns an empty list on the first synchronous call, so
  `deviceCanSpeak` was false, the assignment inside that branch was skipped, and
  execution reached an `await` before touching anything. A browser that ever
  returned a populated list on that first call would have crashed the room.

  The meeting has always had this order — declarations, then the call — and says
  so at its own call site. This is the same layout.
*/
loadVoices();
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = loadVoices;

/**
 * Every server clip goes through Web Audio, which is also the fix for "the
 * voice is too low".
 *
 * It was `new Audio(url)`, and an `<audio>` element cannot raise a level —
 * `volume` only goes down — so the interviewer was stuck at whatever the
 * provider felt like, about eight decibels below where it should be. The same
 * graph reports {@link speechEnergy}, which is what moves the mouth on the real
 * waveform. See `utils/speechAudio.ts`.
 */
const speechAudio = createSpeechAudio();

/** How loud the interviewer is right now, 0…1. Drives the 3D mouth. */
const speechEnergy = ref(0);
let energyTimer: number | null = null;
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
 * zero — and `jawOpen` returns EXACTLY 0 at zero energy, by design.
 *
 * So on every machine that has a voice for the reader's language, the
 * interviewer asked their questions with their mouth shut, their hands down and
 * their brows still. The same fault, in three slightly different disguises, was
 * in all three rooms.
 */
function trackEnergy(live: boolean, measured = true) {
  if (energyTimer !== null) { window.clearInterval(energyTimer); energyTimer = null; }
  if (!live) { speechEnergy.value = 0; return; }
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
  energyTimer = window.setInterval(() => { speechEnergy.value = speechAudio.energy(); }, 40);
}

/**
 * Chrome silently stops speaking after about fifteen seconds.
 *
 * `pause()` + `resume()` on a timer resets its internal clock, and it is the
 * documented workaround -- the Newscast has carried it since the day that page
 * shipped, for exactly the same reason. This room did not, so any question
 * longer than a couple of sentences was cut off mid-word and, worse, `onend`
 * often never arrived: the interviewer simply stopped and the room sat there.
 *
 * Nine seconds, comfortably inside the fifteen.
 */
let speechKeepAlive: number | null = null;

/**
 * The utterance currently being spoken, held so the garbage collector cannot
 * take it.
 *
 * Chrome and Safari have both shipped versions that collect a
 * `SpeechSynthesisUtterance` whose only reference is inside the speech queue,
 * and the symptom is exactly the one reported here: speech stops part-way
 * through a sentence, with no error and often no `onend`. Keeping a reference
 * alive until it settles is the standard workaround and costs one variable.
 */
let speaking: SpeechSynthesisUtterance | null = null;

/**
 * Which call to {@link speak} owns the room right now.
 *
 * It replaces an identity test against the utterance (`speaking === u`), which
 * was doing the same job and could not be reached from the server route — see
 * the note in `speak`'s `finish`. A counter works for both routes, because the
 * server route creates no utterance to compare against.
 */
let speechTurn = 0;

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

/**
 * How long to wait for `onend` before giving up on it.
 *
 * Speech at rate 1.0 runs at roughly 14 characters a second, so this is the
 * time the text should take plus a wide margin. It exists because the failure
 * being fixed here has two halves: Chrome cuts the speech off, AND sometimes
 * never fires `onend` -- and a promise that never settles is an interview that
 * never reaches the next question. The keepalive above should make this
 * unreachable; it is here because "should" is not a guarantee and the cost of
 * being wrong is a frozen room.
 */
/**
 * What the reader is actually hearing, shown in the room.
 *
 * "Is the interviewer really on a voice for my language?" is a question a
 * listener cannot answer by listening — on the newscast it was asked three
 * separate times and the page could not say. It is also the only way to tell
 * "this device has no Chinese voice" apart from "the speech is broken", which
 * from a chair are the same thing.
 */
const voiceLabel = ref('');

/**
 * Play one line from the server engine, and resolve when it has finished.
 *
 * Resolves rather than rejects on every failure, for the reason in `speak`'s
 * own comment: a rejection here is an interview that never reaches the next
 * question. `speechAudio` is what levels it — the raw clip is far too quiet —
 * and what measures it, which is what moves the interviewer's mouth.
 */
function playClip(url: string, ratio: number): Promise<void> {
  // Measured: this one really is going through the analyser.
  trackEnergy(true, true);
  return speechAudio.play(url, ratio).finally(() => trackEnergy(false));
}

/**
 * Stop whatever the server engine is playing.
 *
 * `speechSynthesis.cancel()` does not reach Web Audio, so without this the
 * interviewer goes on talking over whatever page the candidate opens next — the
 * same bug the Newscast documents for `speechSynthesis` itself, one mechanism
 * along.
 */
function stopServerClip(): void {
  speechAudio.stop();
  trackEnergy(false);
}

function speechTimeoutMs(text: string): number {
  return Math.min(90000, Math.max(8000, text.length * 120 + 5000));
}

function speak(text: string): Promise<void> {
  // The executor is `async` because the server route below awaits a network
  // fetch. That is normally an anti-pattern — a throw inside an async executor
  // is swallowed rather than rejecting the promise — and it is safe here
  // precisely because nothing in this function is allowed to reject: every
  // path, including every failure, goes through `finish()` and resolves. A
  // rejected `speak()` would leave the interview waiting for a question that
  // is never asked.
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async resolve => {
    if (!text?.trim()) { resolve(); return; }
    captionSpeaker.value = interviewerName;
    captionText.value = text;
    currentSpeaker.value = 'interviewer';
    try { speechSynthesis.cancel(); } catch {}
    stopServerClip();

    let settled = false;
    let watchdog: any = null;
    const turn = ++speechTurn;
    /*
      ============================================================
      THIS USED TO READ `speaking === u`, AND `u` IS DECLARED BELOW IT
      ============================================================

      That is a temporal dead zone, and it is the whole of "the interviewer does
      not speak in Arabic".

      `u` is the `SpeechSynthesisUtterance`, and it is `const`-declared after the
      server-route block — so on the SERVER route (which is the Arabic route on
      any machine with no Arabic voice) `finish()` reached a binding that had not
      been initialised yet and threw `ReferenceError: Cannot access 'u' before
      initialization`. The call site is inside the route's `try`, whose `catch`
      is deliberately empty, so the throw was swallowed.

      What that produced, in order:

        1. the clip played;
        2. `settled` was set to true;
        3. `finish()` threw before reaching `resolve()`;
        4. the empty catch swallowed it and execution fell through to the DEVICE
           route, which spoke the same line again — silently, because the machine
           has no voice for the language;
        5. that utterance's `onend` called `finish()`, which returned immediately
           because `settled` was already true.

      `resolve()` was therefore never called on any path, so the promise never
      settled and the interview stopped dead after its first Arabic line. From a
      chair it looks exactly like "the interviewer does not speak".

      Two things are different now. The guard is a turn counter, which works for
      both routes because the server route has no utterance to compare against;
      and nothing that runs AFTER the network call is inside the catch, so a
      throw there can never be read as "the clip failed, try the device".
    */
    const finish = () => {
      if (settled) return;
      settled = true;
      if (watchdog) clearTimeout(watchdog);
      /*
        Tear down only what is still OURS. `speak()` cancels whatever is playing
        on the way in, and that cancellation reaches the previous utterance as an
        `error` event -- which can land after the next one has already started.
        Unguarded, the old call's cleanup stops the new one's keepalive and
        clears the speaking indicator underneath it, and the symptom is the
        interviewer going quiet part-way through the very next sentence.
      */
      if (turn === speechTurn) {
        speaking = null;
        stopSpeechKeepAlive();
        trackEnergy(false);
        currentSpeaker.value = null;
      }
      resolve();
    };

    // Wait for the capability probe if one is still in flight — otherwise the
    // greeting is cast against an answer that has not arrived. See `serverProbe`.
    await serverProbe;
    const plan = castInterviewerVoice();

    /*
     * THE SERVER ROUTE. Reached only when the device has no voice for this
     * language at all — a stock Windows install has none for Arabic, and many
     * Linux and Android builds have none for Chinese.
     *
     * App 36's `/api/news/tts/` is a measured neural pair per language, and it
     * is reused here rather than reimplemented: it is already deployed, its
     * voices are already F0-checked, and the alternative for a candidate on
     * such a machine is a silent interviewer. It is named `news` because that
     * is the service that grew it; the endpoint itself is general.
     *
     * Failure falls through to the platform route rather than aborting. The
     * clip is a network round trip on a page where somebody is waiting, and
     * "no sound for this one question" is recoverable where "the interview
     * stopped" is not.
     */
    if (plan.route === 'server') {
        /*
          THE `try` COVERS THE NETWORK CALL AND NOTHING ELSE.

          It used to wrap the playback and the teardown as well, so any fault
          after the fetch — including the one described above — was
          indistinguishable from "the server had no clip" and fell through to a
          second, duplicate attempt at the same line. A catch that is this broad
          around an empty handler will swallow whatever bug arrives next, too.
        */
        let clip: SpeechClip | null = null;
        try {
            clip = await newsService.speech(
                text, localeId.value, interviewer.gender, 1, '', plan.allowAnyVoice);
        } catch {
            // Nothing to report to the candidate: they are mid-answer, and the
            // caption already carries the text they would have heard. The
            // device route below is a real chance of being heard.
            clip = null;
        }
        if (clip) {
            voiceLabel.value = describeSpeech(
                plan, activeLocale.value.nativeName, `${clip.voice} · ${clip.provider}`);
            /*
              Branch on the MISMATCH, not on the ratio. `shapeRatio` answers 1
              for a direction it has no honest ratio for, and reading that 1 as
              "nothing to correct" plays the wrong voice — the original bug
              arriving through the door built to stop it.
            */
            const mismatched = !!clip.gender && clip.gender !== interviewer.gender;
            const ratio = mismatched && plan.shapeTo
                ? shapeRatio(clip.gender, plan.shapeTo) : 1;
            await playClip(clip.url, ratio);
            finish();
            return;
        }
    }

    const u = new SpeechSynthesisUtterance(text);
    if (plan.voice) u.voice = plan.voice as SpeechSynthesisVoice;
    /*
     * `lang` is set WHETHER OR NOT a voice was cast, and that is the fix for
     * "the interviewer is silent in Arabic".
     *
     * With no voice assigned, `lang` is the only thing telling the platform
     * what language the text is in — and an unassigned voice plus a correct
     * `lang` frequently reaches an OS voice that `getVoices()` never listed.
     * With a voice assigned it is set to that VOICE's own lang rather than the
     * locale's, because asking for `zh-CN` while casting a `zh-TW` voice is a
     * mismatch some engines resolve by ignoring the voice.
     */
    u.lang = plan.lang;
    u.pitch = plan.pitch;
    u.rate = 1.0;
    voiceLabel.value = describeSpeech(plan, activeLocale.value.nativeName);
    u.onend = finish;
    u.onerror = finish;
    /* One pulse per word — as close to lip sync as a route with no audio gets.
       Not every engine fires it, and `spokenEnergy` falls back to a steady
       nominal level when it never comes, so this is purely additive. */
    u.onboundary = () => { lastBoundary = performance.now(); };

    setTimeout(() => {
      if (settled) return;
      try {
        speaking = u;
        speechSynthesis.speak(u);
        startSpeechKeepAlive();
        // NOT measured: `speechSynthesis` exposes no audio whatsoever.
        trackEnergy(true, false);
        watchdog = setTimeout(() => {
          // `onend` never came. Stop whatever is still going rather than
          // leaving it to talk over the next question.
          try { speechSynthesis.cancel(); } catch {}
          stopServerClip();
          finish();
        }, speechTimeoutMs(text));
      } catch {
        finish();
      }
    }, 80);
  });
}

// ====== Media ======
function stopAllTracks() {
  audioStream?.getTracks().forEach(t => t.stop());
  // Only when it is a second, separate stream. With the combined request the
  // two references are the same object and its tracks are already stopped.
  if (!streamsAreShared) videoStream?.getTracks().forEach(t => t.stop());
  audioStream = null;
  videoStream = null;
  streamsAreShared = false;
}

/**
 * The microphone, on its own, and then the camera, on its own.
 *
 * TWO calls, and that is the fix rather than a refactor. It used to ask for
 * `{video, audio}` in one `getUserMedia`, which resolves only if BOTH can be
 * opened — so a machine with a perfectly good microphone and a camera that was
 * unplugged or held by Teams got a single `NotFoundError` and no microphone
 * either, and the message blamed a permission the user had granted.
 *
 * Splitting it unconditionally then broke the ordinary case, which is worse: a
 * video-only follow-up is a separate permission request against a separately
 * tracked device, so a browser that had already granted the pair either prompts
 * again or answers `NotFoundError` for a camera that is plugged in and was
 * working seconds earlier.
 *
 * `acquireInterviewMedia` therefore asks for BOTH first — the exact request
 * that has always worked — and only falls back to asking separately when that
 * fails. The microphone is required (the answers are transcribed from it); the
 * camera is not, and failing to get one must never stop an interview.
 */
async function initMedia(): Promise<boolean> {
  mediaError.value = '';
  cameraError.value = '';

  const unsupported = mediaUnsupportedReason(
    navigator, typeof isSecureContext === 'undefined' ? true : isSecureContext,
    location.origin);
  if (unsupported) { mediaError.value = unsupported; return false; }

  const got = await acquireInterviewMedia(c => navigator.mediaDevices.getUserMedia(c));
  streamsAreShared = got.combined;

  // The microphone is required, so a failure here stops the interview.
  if (!got.audio) {
    console.error('[media] microphone:', got.micError);
    mediaError.value = got.micError;
    // Whatever the camera did is beside the point while there is no mic, and
    // two red panels for one problem reads as two problems.
    cameraError.value = '';
    if (got.video) { got.video.getTracks().forEach(t => t.stop()); }
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
  if (videoStream) {
    await showCamera();
  } else if (got.cameraError) {
    // Ask the machine whether a camera exists before repeating the browser's
    // claim that there is none. The two disagree often enough that saying "no
    // camera was found" to somebody looking at their webcam is the single most
    // unhelpful thing this page can do.
    cameraError.value = await cameraFailureMessage(got.cameraRaw);
  }
  return true;
}

/** The camera failure, re-described once we know whether a camera is there. */
async function cameraFailureMessage(err: unknown): Promise<string> {
  const present = await hasVideoInput(navigator.mediaDevices);
  return describeMediaError(err, 'camera', present);
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
    streamsAreShared = false;
    await showCamera();
    return true;
  } catch (e) {
    console.error('[media] camera:', e);
    videoStream = null;
    cameraEnabled.value = false;
    cameraError.value = await cameraFailureMessage(e);
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

/**
 * Consecutive failed transcriptions.
 *
 * Counted rather than reported one at a time: a single dropped chunk is normal
 * on a flaky connection and re-reporting it every three seconds would be
 * noise. Three in a row means it is not coming back on its own.
 */
let transcribeFailures = 0;
const TRANSCRIBE_FAILURES_BEFORE_TELLING = 3;

function noteTranscribeFailure(reason: string) {
  transcribeFailures++;
  if (transcribeFailures >= TRANSCRIBE_FAILURES_BEFORE_TELLING) {
    recordingError.value = `Your speech is not being transcribed (${reason}). Keep answering — `
      + `the interview continues — but this answer may be recorded as empty.`;
  }
}

async function transcribeAudioBlob(blob: Blob): Promise<void> {
  if (blob.size < 1000) return;
  try {
    const baseUrl = await jobInterviewService.resolveBaseUrl();
    if (!baseUrl) { noteTranscribeFailure('the transcription service is unreachable'); return; }
    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');
    formData.append('language', aiLanguage());
    const token = import.meta.env.VITE_AUTH_TOKEN;
    const response = await fetch(`${baseUrl}/api/jobinterview/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
      // The language the answer is being SPOKEN in, so Whisper transcribes it
      // rather than transliterating it. Sent as a form field as well as a
      // header: this is a multipart upload, and `language.py` reads the body
      // first — but `request.get_json(silent=True)` sees nothing in a multipart
      // request, so the header is what actually carries it here. Both are sent
      // so that neither the service nor a future proxy has to be the one that
      // works.
        ...aiLanguageHeaders(),
      },
      body: formData
    });
    if (response.ok) {
      const result = await response.json();
      const text = (result.text || '').trim();
      // A silent chunk legitimately transcribes to nothing, so an empty result
      // is a success and must reset the counter — otherwise a candidate who
      // pauses to think is told transcription is broken.
      transcribeFailures = 0;
      recordingError.value = '';
      // Through the editor rather than straight onto a buffer: this is where a
      // spoken "sorry" takes the last clause back, and where a chunk lands at
      // the caret instead of at the end after a highlighted passage was
      // replaced. Anything the candidate typed by hand in the meantime is in
      // `answer` already and survives, which a private buffer would not have
      // allowed.
      if (text) applyChunk(text);
    } else {
      console.warn('[Whisper] HTTP', response.status);
      noteTranscribeFailure(`the server answered ${response.status}`);
    }
  } catch (e: any) {
    console.error('[Whisper] error:', e?.message || e);
    noteTranscribeFailure('the connection failed');
  }
}

async function recordOneChunk(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!audioStream) { resolve(); return; }
    const audioTracks = audioStream.getAudioTracks();
    if (audioTracks.length === 0) { resolve(); return; }
    // NOT `audioStream`. That is the module-level stream this function reads two
    // lines above, and a `const` of the same name puts the whole function body
    // in its temporal dead zone — so both reads above throw
    // "Cannot access 'audioStream' before initialization", every chunk, and the
    // only symptom is the transcript box sitting on "Listening…" for ever.
    const chunkStream = new MediaStream(audioTracks);
    const mimeType = getPreferredMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(chunkStream, { mimeType, audioBitsPerSecond: 64000 })
        : new MediaRecorder(chunkStream);
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
  // try/finally, because the flag is a latch: without it one thrown chunk
  // leaves `recordingLoopActive` true for the rest of the session and the
  // `return` above then silently refuses every later answer. That is what
  // turned a single ReferenceError into "the transcript never appears again",
  // and it would have hidden any future fault the same way.
  try {
    while (isAnswering && micEnabled.value) {
      await recordOneChunk(3500);
      if (isAnswering) await new Promise(r => setTimeout(r, 50));
    }
  } finally {
    recordingLoopActive = false;
  }
}

function stopCurrentRecording() {
  if (currentRecorder && currentRecorder.state === 'recording') {
    try { currentRecorder.stop(); } catch {}
  }
  currentRecorder = null;
}

// ====== Timer ======
/**
 * The clock on the current answer.
 *
 * Separate from the interview timer and deliberately advisory -- nothing is cut
 * off at the target. A candidate has no way to judge ninety seconds while
 * thinking, and "you spoke for four minutes" is a line in the report rather
 * than something they could have acted on at the time.
 */
function startAnswerTimer() {
  answerStartedAt = Date.now();
  answerElapsed.value = 0;
  if (answerTimer) clearInterval(answerTimer);
  answerTimer = setInterval(() => {
    answerElapsed.value = Math.floor((Date.now() - answerStartedAt) / 1000);
  }, 500);
}

function stopAnswerTimer() {
  if (answerTimer) clearInterval(answerTimer);
  answerTimer = null;
}

function startTimer() {
  startTime = Date.now();
  const limit = plannedMinutes * 60;
  timerInterval = setInterval(() => {
    const el = Math.floor((Date.now() - startTime) / 1000);
    timerDisplay.value = `${String(Math.floor(el / 60)).padStart(2, '0')}:${String(el % 60).padStart(2, '0')}`;
    if (el >= limit && !timeUp.value) {
      timeUp.value = true;
      captionSpeaker.value = 'System';
      captionText.value = t('⏰ Time is up — finish your current answer, then it will wrap up.');
    }
  }, 250);
}

// ====== The report, built while the interview runs ======
//
// The report used to be assembled entirely at the end: one evaluate call plus a
// coaching call per batch of three, all fired after the closing speech. On two
// cold PythonAnywhere replicas that is most of a minute of a spinner the
// candidate can do nothing with and cannot tell is working.
//
// Nothing about coaching one answer depends on the answers after it, so there
// was never a reason to wait. Each answer is coached the moment it is
// submitted, while the interviewer is asking the next question -- and the
// session is SAVED from the first question, so a browser that dies at question
// seven leaves seven coached answers in the results list instead of nothing.
// By the time the interview ends, the only thing still outstanding is the
// overall evaluation.
//
// A single question per call is also the shape the AI handles most reliably.
// The reported "every question has the same feedback" was a truncated reply:
// ten questions in one call, cut off mid-array, no closing brace, and every
// entry fell back to the same generic paragraph. One short answer inside the
// whole token budget cannot fail that way.

/**
 * The id this interview is saved under, minted before the first save.
 *
 * `crypto.randomUUID` is not available on http origins or in older Safari, and
 * an interview must not fail to be recorded over an id -- so there is a
 * fallback, and it only has to be unique among one user's sessions.
 */
function newSessionId(): string {
  try {
    const c: any = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch { /* fall through */ }
  return `ji_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const sessionId = newSessionId();
const coachedCount = computed(() => qaPairs.value.filter(qa => qa.coaching).length);

/**
 * Everything asked so far, so the interviewer cannot ask it twice.
 *
 * The question currently on screen is included because it is NOT yet in
 * `qaPairs` when the interview ends without it being answered -- and deduped,
 * because it usually is: `submitAnswer` pushes the pair before the next
 * question is asked, so the last question would otherwise be listed twice and
 * spend prompt budget saying the same thing.
 */
function askedSoFar(): string[] {
  const asked: string[] = [];
  const seen = new Set<string>();
  for (const question of [...qaPairs.value.map(qa => qa.question), currentQuestionText.value]) {
    const key = normaliseQuestion(question);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    asked.push(question);
  }
  return asked;
}

const coachingJobs: Promise<unknown>[] = [];

/** What every coaching and evaluation call needs to know about this interview. */
function coachingContext() {
  return {
    interview_type: interviewType,
    topic,
    qualifications,
    cv_summary: cvSummary,
  };
}

/**
 * Coach one answer, in the background.
 *
 * Never awaited by the interview and never allowed to throw into it: a coaching
 * call that fails leaves that one question uncoached and `endInterview` picks
 * it up in the catch-up pass. The candidate is never waiting on this.
 */
function coachAnswer(index: number) {
  const qa = qaPairs.value[index];
  if (!qa) return;
  qa.coaching_pending = true;
  coachingInFlight.value++;
  const job = jobInterviewService
    .coachOne({ ...coachingContext(), qa: { question: qa.question, answer: qa.answer } })
    .then(entry => {
      if (entry) {
        qa.coaching = entry;
        // Kept alongside as a plain string: it is the field every report
        // written before 2026-08-20 is stored with and the one an older client
        // reads.
        qa.model_answer = entry.model_answer || '';
      }
    })
    .catch(e => { console.error('Coaching failed for question', index + 1, e); })
    .finally(() => {
      qa.coaching_pending = false;
      coachingInFlight.value--;
      persistSoon();
    });
  coachingJobs.push(job);
}

/**
 * The session as it stands, ready to be written.
 *
 * Built fresh each time rather than mutated, because it is sent from three
 * places -- the start of the interview, after every answer, and at the end --
 * and a shared object edited by whichever fired last is how a final report ends
 * up saved with a half-filled score.
 */
function sessionPayload(status: 'in_progress' | 'complete') {
  const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const transcript = qaPairs.value
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer || '(no answer)'}`)
    .join('\n\n');
  return {
    id: sessionId,
    user_id: authStore.user?.id || '',
    username: authStore.user?.username || '',
    user_full_name: `${authStore.user?.first_name || ''} ${authStore.user?.last_name || ''}`.trim()
      || authStore.user?.username,
    interview_type: interviewType,
    topic,
    qualifications,
    cv_id: cfg.cvId || '',
    cv_title: cvTitle,
    cv_summary: cvSummary,
    attempt,
    planned_minutes: plannedMinutes,
    planned_questions: maxQuestions,
    status,
    duration_seconds: duration,
    qa_pairs: qaPairs.value,
    transcript,
    score: report.score,
    summary: report.summary,
    strengths: report.strengths,
    improvements: report.improvements,
    technical_assessment: report.technical_assessment,
    communication: report.communication,
    recommendation: report.recommendation,
    action_plan: report.action_plan || [],
    standout_moment: report.standout_moment || '',
    red_flags: report.red_flags || '',
    score_breakdown: report.score_breakdown || {},
  };
}

let persistTimer: any = null;

/**
 * Writes are chained, never concurrent.
 *
 * They all carry the WHOLE session, so two in flight at once is a race whose
 * loser wins: an `in_progress` write started before the report was finished can
 * land after the `complete` one and put the record back into the unfinished
 * pile with a half-filled score. Serialising them is one line and removes the
 * whole class of problem -- and there is no throughput to lose, because the
 * debounce means there is rarely more than one waiting.
 */
let persistChain: Promise<void> = Promise.resolve();

/** Write the session. Never throws — a failed save must not stop an interview. */
function persistNow(status: 'in_progress' | 'complete'): Promise<void> {
  if (!authStore.user?.id) return persistChain;
  persistChain = persistChain.then(async () => {
    try {
      await jobInterviewService.saveSession(sessionPayload(status));
    } catch (e) {
      console.error('Save interview failed:', e);
    }
  });
  return persistChain;
}

/**
 * Write the session shortly, coalescing whatever else asks in the meantime.
 *
 * Three coaching calls landing within a second of each other would otherwise be
 * three full-session writes -- and each one fans out to every peer of app 27 on
 * a background thread. Debounced, a burst is one write. Deliberately fire and
 * forget: the interview never waits on it, and the next tick covers anything a
 * dropped write missed.
 */
function persistSoon() {
  if (phase.value === 'done') return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    // Checked again here, not only on the way in: the debounce is a second and
    // a half, which is long enough for the last answer to be submitted and the
    // interview to finish in between.
    if (phase.value !== 'done') void persistNow('in_progress');
  }, 1500);
}

// ====== Flow ======
async function startInterview() {
  // Primed inside the gesture. An `AudioContext` created outside a click starts
  // `suspended`, and every clip on it is then silently ignored — no error, no
  // event, an interviewer that never makes a sound.
  speechAudio.prime();
  starting.value = true;
  startBtnText.value = '⏳ Setting up…';
  captionSpeaker.value = 'System';
  captionText.value = t('Requesting your microphone…');
  if (!(await initMedia())) {
    starting.value = false;
    startBtnText.value = '▶️ Start Interview';
    captionText.value = t('The interview cannot start without a microphone — see the message above.');
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
  captionText.value = t('Interviewer is joining…');

  // The greeting and the question plan at the same time, and the plan is never
  // waited for on its own: it is what stops a stateless model asking its most
  // probable question three times, and it takes about as long as the greeting.
  // Sequenced, it would be a second cold start the candidate sits through
  // before anybody says hello.
  const [intro] = await Promise.all([
    jobInterviewService.callInterviewer({
      stage: 'intro', interview_type: interviewType, topic, qualifications,
      user_name: userName.value,
      interviewer_name: interviewerName, interviewer_role: interviewerRole,
      cv_summary: cvSummary,
    }),
    jobInterviewService.planQuestions({
      interview_type: interviewType, topic, qualifications, cv_summary: cvSummary,
      count: maxQuestions, avoid_questions: avoidQuestions, attempt,
      session_seed: sessionSeed,
    }).then(areas => { questionPlan.value = areas; }),
  ]);
  // "Hi Mahmoud, welcome to a" was the other half of the report, and it is the
  // first thing a candidate hears. A greeting that stops mid-word reads as the
  // interviewer having frozen; the canned one below is a worse greeting and a
  // far better first impression. Same test as a question -- three words and a
  // terminator -- which a greeting passes and a fragment does not.
  const spokenIntro = intro && isWholeQuestion(intro)
    ? intro
    : `Hello ${userName.value}, I'm ${interviewerName}. Thanks for joining this `
      + `${interviewType} interview. Let's begin.`;
  if (intro && intro !== spokenIntro) {
    console.warn('[interview] discarding a truncated greeting:', intro);
  }
  await speak(spokenIntro);

  startTimer();
  /*
    THE LEDGER STARTS WHEN THE INTERVIEW DOES, not when the page loads.

    The subject is the interview TYPE rather than this sitting - `subjectId` is
    what the board's "most studied" chart groups on, and grouping on a session
    id would give one bar per sitting, each of height one.
  */
  sitting.begin(
    { id: 'interview:' + interviewType,
      name: interviewType + ' interview' + (topic ? ' - ' + topic : '') },
    { userId: authStore.user?.id || '', username: authStore.user?.username || '' },
  );
  sitting.note('interview.started');
  // The record exists from here on, so an interview that is abandoned at
  // question seven is seven coached answers in the results list rather than
  // nothing at all. Fire and forget: nothing about the interview waits on it.
  void persistNow('in_progress');
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
  answer.value = emptyAnswer();
  captionSpeaker.value = interviewerName;
  captionText.value = t('Interviewer is thinking of the next question…');
  const asked = askedSoFar();
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
    // Earlier sittings' questions, so a redo is a redo rather than a re-run.
    avoid_questions: avoidQuestions,
    // And THIS sitting's, all of them. `previous_qa` is capped at five on the
    // service side because it carries the answers too, so in a twelve-question
    // interview the model was free to re-ask question two at question nine --
    // and did. This is the single biggest cause of the repetition.
    asked_questions: asked,
    // The area this question is meant to cover. Telling a stateless model "ask
    // something different" is advice; telling it "ask about incident response"
    // is an instruction.
    focus: questionPlan.value[questionNumber.value - 1] || '',
    session_seed: sessionSeed,
    attempt
  });
  const offered = (q && q.trim()) ? q.trim() : '';
  // Two last lines of defence, and neither is redundant with the service's own
  // checks: app 27 and this bundle deploy independently, and app 27 is several
  // replicas that are deployed one at a time.
  //
  //  * a repeat -- a replica that has not pulled the anti-repeat work will
  //    happily hand back question two again;
  //  * a FRAGMENT -- "Can you detail a specific instance where you designed and
  //    executed a", which is a reasoning model running out of tokens mid
  //    sentence. It is unanswerable, it is read aloud, and it is stored and
  //    shown again in the report as something the interviewer asked.
  //
  // In both cases the remedy is the local pool: a real question the candidate
  // has not been asked beats a broken one from a better source.
  const repeated = offered && asked.some(prev => sameQuestion(prev, offered));
  const truncated = offered && !isWholeQuestion(offered);
  if (truncated) console.warn('[interview] discarding a truncated question:', offered);
  currentQuestionText.value = offered && !repeated && !truncated
    ? offered
    : unaskedFallback(questionNumber.value, asked);
  await speak(currentQuestionText.value);
  phase.value = 'awaiting';
  captionSpeaker.value = 'System';
  captionText.value = t('Click "Start Answering" when you are ready to respond.');
}

function startAnswering() {
  if (!micEnabled.value) { alert(t('Please unmute your microphone first.')); return; }
  if (!audioStream) { alert(t('Your microphone is not connected yet.')); return; }
  answer.value = emptyAnswer();
  selection.value = { start: 0, end: 0 };
  // PER ANSWER, so the fourth answer cannot be paid for on the strength of the
  // first one having been spoken.
  spokeThisAnswer = false;
  recordingError.value = '';
  transcribeFailures = 0;
  isAnswering = true;
  phase.value = 'answering';
  startAnswerTimer();
  captionSpeaker.value = 'You';
  captionText.value = `🎤 Answer now — aim for about ${answerSeconds} seconds. Your words appear `
    + 'below; you can edit them, or say "sorry" to take the last part back.';
  startContinuousRecording().catch(e => {
    console.error('[Recording]', e);
    recordingError.value = 'Recording stopped unexpectedly. Press Submit Answer, then Start '
      + 'Answering again — or type nothing and continue; the interview is not affected.';
  });
}

async function submitAnswer() {
  if (phase.value !== 'answering') return;
  isAnswering = false;
  phase.value = 'processing';
  stopCurrentRecording();
  stopAnswerTimer();
  captionText.value = t('Finalizing your answer…');
  // Long enough for the chunk that was mid-recording when Submit was pressed to
  // come back from Whisper. It is the last second or two of what the candidate
  // said, so losing it costs the end of every answer in the report.
  await new Promise(r => setTimeout(r, 1400));

  const spokenText = answer.value.text.trim();
  qaPairs.value.push({
    question: currentQuestionText.value,
    answer: spokenText,
    seconds: answerElapsed.value,
  });

  /*
    THE ANSWER ON THE LEDGER, and the award only when it was EARNED.

    `interview.answered` is neutral and unconditional - it is what makes
    "answered three of eight, then left" legible on a public record. The award
    needs two things and both are evidence rather than intent: a chunk came back
    from the microphone for this turn, and the answer clears a word floor. So it
    cannot be had by typing, and it cannot be had by saying two words. The
    catalogue caps it at eight, which is the anti-farming half.
  */
  sitting.note('interview.answered');
  // `countWords` takes the LOCALE OBJECT, not its id. Handed a string it reads
  // `.wordless` off it, gets undefined, and falls through to the
  // space-separated count - so a Chinese answer measured ONE word however long
  // it was, and this award was unreachable for exactly the speakers the CJK
  // branch exists for. Working rule 40, and vue-tsc had been reporting it.
  //
  // It sits ABOVE the `if` rather than inside the condition because
  // `check:practice` asserts the flag and the word count are adjacent, and it
  // is right to: anything allowed between them is somewhere a third condition
  // could be slipped in without the check noticing.
  if (spokeThisAnswer
      && countWords(spokenText, activeLocale.value) >= SPOKEN_WORD_FLOOR) {
    sitting.note('speaking.delivered');
  }

  // Coached NOW, while the interviewer asks the next question, rather than at
  // the end with all the others. Not awaited: the candidate is never waiting on
  // their report being written.
  coachAnswer(qaPairs.value.length - 1);
  persistSoon();

  questionNumber.value++;
  if (timeUp.value || questionNumber.value > maxQuestions) {
    await endInterview();
  } else {
    await askNextQuestion();
  }
}

/**
 * Coaching that never arrived, filled in one last pass.
 *
 * Bounded, and that is the point: by the end most questions are already coached
 * and this is a top-up for the one whose call failed, not the main path. Sent as
 * one request for whatever is left rather than one each, because at this point
 * the candidate IS waiting.
 */
async function fillMissingCoaching() {
  const missing = qaPairs.value
    .map((qa, i) => ({ qa, i }))
    .filter(entry => !entry.qa.coaching);
  if (!missing.length) return;

  const coaching = await jobInterviewService.getModelAnswers({
    ...coachingContext(),
    qa_pairs: missing.map(entry => ({ question: entry.qa.question, answer: entry.qa.answer })),
  });
  missing.forEach((entry, k) => {
    const got = coaching[k];
    if (!got) return;
    entry.qa.coaching = got;
    entry.qa.model_answer = got.model_answer || '';
  });
}

/** Whatever is in flight, but never for longer than this. */
function settleWithin<T>(jobs: Promise<T>[], ms: number): Promise<unknown> {
  if (!jobs.length) return Promise.resolve();
  return Promise.race([
    Promise.allSettled(jobs),
    new Promise(resolve => setTimeout(resolve, ms)),
  ]);
}

async function endInterview() {
  if (phase.value === 'done') return;
  isAnswering = false;
  stopCurrentRecording();
  stopAnswerTimer();
  if (timerInterval) clearInterval(timerInterval);
  phase.value = 'processing';
  currentQuestionText.value = '';
  captionSpeaker.value = interviewerName;
  captionText.value = t('Wrapping up the interview and preparing your feedback…');

  // The closing speech, the evaluation and any coaching still in the air, all at
  // once. The evaluation is the one thing that genuinely cannot start earlier --
  // it is a judgement on the whole interview -- so it is started here rather
  // than after the interviewer has finished speaking, and the ten seconds of
  // synthesised sign-off is time it no longer costs.
  const evaluation = jobInterviewService.evaluate({
    interview_type: interviewType, topic, qualifications, cv_summary: cvSummary,
    qa_pairs: qaPairs.value,
  });

  const closing = await jobInterviewService.callInterviewer({
    stage: 'closing', interview_type: interviewType, topic, user_name: userName.value,
    interviewer_name: interviewerName, interviewer_role: interviewerRole,
    attempt
  });
  const spokenClosing = closing && isWholeQuestion(closing)
    ? closing
    : `Thank you ${userName.value}. That concludes our interview — I'll share some `
      + `feedback now.`;
  await speak(spokenClosing);

  captionText.value = t('Finishing your report…');
  // Twenty seconds is one cold PythonAnywhere start. Past that the answer is not
  // coming, and `fillMissingCoaching` covers whatever it was.
  await settleWithin(coachingJobs, 20000);
  await fillMissingCoaching();

  const evalResult = await evaluation;
  if (evalResult) {
    Object.assign(report, evalResult);
  } else {
    Object.assign(report, {
      score: 0,
      summary: 'We could not generate AI feedback at this time, but your interview was recorded '
        + 'and the per-question coaching below is still worth reading.',
      strengths: 'You participated in the full interview.',
      improvements: 'Try again later for detailed AI feedback.',
      technical_assessment: '—',
      communication: '—',
      recommendation: 'Maybe',
      action_plan: [],
      standout_moment: '',
      red_flags: '',
      score_breakdown: {},
    });
  }

  reportVisible.value = true;
  phase.value = 'done';

  /*
    THE SITTING IS CLOSED HERE, and closing it is what stops everything
    downstream scoring: `PracticeRecorder.record` drops a later breach before it
    is queued, app 20 answers a late one `ignored: sitting_closed`, and both
    `verdictFor` and `applyConductCaps` ignore anything stored past this point.

    Without it a candidate who finished an interview and left the tab open went
    on paying for every switch to their email, indefinitely, on a record
    anybody can read - which is exactly the bug the labs were reported for.

    `interview.all_answered` FIRST and only when nothing was skipped. "Every
    question" is `maxQuestions`, not "however many were asked": an interview cut
    short by the clock has not had every question answered, and paying for it
    would make the award mean "the timer ran out".
  */
  if (qaPairs.value.length >= maxQuestions
      && qaPairs.value.every(pair => !!pair.answer)) {
    sitting.note('interview.all_answered');
  }
  await sitting.complete();

  // The last write, and the one that flips the record out of `in_progress`.
  // `persistSoon` refuses to fire once the phase is `done`, so a coaching call
  // landing a moment after this cannot overwrite the finished report with a
  // half-filled one.
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  await persistNow('complete');

  stopAllTracks();
}

function scoreClass(score: number): string {
  return score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low';
}

/** The five dimensions, in a fixed order, skipping any the coach did not send. */
const BREAKDOWN_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'structure', label: 'Structure' },
  { key: 'relevance', label: 'Answering the question' },
  { key: 'depth', label: 'Depth and detail' },
  { key: 'communication', label: 'Communication' },
  { key: 'impact', label: 'Results and impact' },
];

const breakdownRows = computed(() => {
  const breakdown = report.score_breakdown || {};
  return BREAKDOWN_LABELS
    .map(row => ({ ...row, value: Number(breakdown[row.key]) }))
    .filter(row => Number.isFinite(row.value))
    .map(row => ({
      key: String(row.key),
      label: row.label,
      value: Math.max(0, Math.min(100, Math.round(row.value))),
      band: scoreClass(row.value),
    }));
});

/**
 * The one line a candidate reads off a bar chart.
 *
 * Five bars are a diagnosis and nobody reads a diagnosis; naming the lowest one
 * is what turns it into an instruction. Silent when the spread is small, because
 * "your weakest area is 78" is noise.
 */
const weakestLine = computed(() => {
  const rows = breakdownRows.value;
  if (rows.length < 2) return '';
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  if (best.value - worst.value < 10) {
    return 'Evenly balanced — no single area is holding the score back.';
  }
  return `Your weakest area is ${worst.label.toLowerCase()} (${worst.value}). `
    + `That is where practice buys the most.`;
});

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
    planned_questions: maxQuestions,
    attempt,
    cv_id: cfg.cvId || '',
    cv_title: cvTitle,
    cv_summary: cvSummary,
  }, {
    // A different person each sitting, which is closer to the real thing than
    // meeting the same interviewer six times.
    interviewer: pickInterviewer().id,
    questions: maxQuestions,
    minutes: plannedMinutes,
    // A FRESH seed, and this is the half of "practise again" that keeps working
    // once the avoid list is full: with the same seed a redo differs only by the
    // questions it was explicitly told to skip, and that list is capped.
    sessionSeed: newSessionSeed(),
    voiceEditing: voiceEditing.value,
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
  stopAnswerTimer();
  stopSpeechKeepAlive();
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  if (timerInterval) clearInterval(timerInterval);
  stopAllTracks();
  try { speechSynthesis.cancel(); } catch {}
  stopServerClip();
  speechAudio.dispose();
});
</script>

<style src="@/assets/css/job-interview.css"></style>