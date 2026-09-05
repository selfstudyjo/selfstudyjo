<!-- src/views/TakeExam.vue -->
<template>
  <div class="take-exam-page">
    <!-- Header -->
    <div class="exam-header">
      <div class="header-content">
        <div class="exam-info">
          <h1 class="exam-title" :title="exam?.title">{{ exam?.title }}</h1>
          <!-- Course and status on ONE line. They were two of the four bands that
               made this sticky header 43% of the viewport on a desktop and 72% on
               a small phone, with the question scrolling underneath it. -->
          <div class="exam-meta-line">
            <p class="exam-course">{{ exam?.course_name || exam?.course_id }}</p>
            <span v-if="appointment" class="appointment-status">
              <span class="status-badge" :class="appointment.appointment_status.toLowerCase().replace(/\s+/g, '-')">
                {{ appointment.appointment_status }}
              </span>
            </span>
          </div>
        </div>
        <div class="exam-controls">
          <div class="timer-container">
            <div class="timer-label">{{ $t('Time Remaining') }}</div>
            <div class="timer" :class="timerClass">{{ formatTime(timeRemaining) }}</div>
          </div>
          <div class="question-nav">
            <div class="nav-label">{{ $t('Question') }}</div>
            <div class="nav-controls">
              <button @click="prevQuestion" :disabled="currentQuestionIndex === 0 || examSubmitted" class="nav-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="current-question">{{ currentQuestionIndex + 1 }} / {{ validQuestions.length }}</div>
              <button @click="nextQuestion" :disabled="currentQuestionIndex === validQuestions.length - 1 || examSubmitted" class="nav-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>{{ $t('Loading exam...') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">❌</div>
      <h3>{{ $t('Error Loading Exam') }}</h3>
      <p>{{ error }}</p>
      <button @click="loadExam" class="retry-btn">{{ $t('Retry') }}</button>
    </div>

    <!--
      THE RULES GATE, and the clock does not start until it is accepted.

      A banner would have been less work and it is the wrong shape: a candidate
      who has to be told that five breaches void their paper has to be told
      BEFORE the paper is in front of them, because afterwards it competes with
      forty questions and a countdown for their attention. Accepting it is also
      the first thing on the ledger, so a sitting that was voided can be shown
      to have started with the rules on screen.

      Skipped entirely for an already-submitted paper - somebody opening a
      finished exam to review their answers is not sitting anything.
    -->
    <div v-else-if="exam && validQuestions.length > 0 && !ruleGateDone"
         class="exam-gate">
      <div class="exam-gate__card">
        <p class="exam-gate__eyebrow">{{ $t('Before you begin') }}</p>
        <h2 class="exam-gate__title">{{ $td(exam, 'title') }}</h2>
        <p class="exam-gate__lede">
          {{ $t('{v0} questions, {v1} minutes, and a pass mark of {v2}%. The clock starts when you accept the rules below.', { v0: validQuestions.length, v1: exam.exam_duration, v2: passMark }) }}
        </p>

        <IntegrityRules context="exam" />

        <div class="exam-gate__actions">
          <button type="button" class="exam-gate__go" @click="acceptRules">
            {{ $t('I understand — start the exam') }}
          </button>
          <button type="button" class="exam-gate__out" @click="goToExams">
            {{ $t('Not now') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="exam && validQuestions.length > 0" class="main-content">
      <div class="content-grid">
        <!-- Question Panel -->
        <div class="question-panel">
          <div class="question-card">
            <div class="question-header">
              <h3 class="question-number">{{ $t('Question {v0}', { v0: currentQuestionIndex + 1 }) }}</h3>
              <div class="question-meta">
                <span class="question-score">{{ $t('{v0} points', { v0: currentQuestion?.score }) }}</span>
                <button @click="toggleFlag" class="flag-btn" :class="{ flagged: isQuestionFlagged(currentQuestion?.external_id) }" :disabled="examSubmitted">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M14 4L18 8V20L14 16H6L4 20V4L6 8H14Z" :fill="isQuestionFlagged(currentQuestion?.external_id) ? '#f56565' : 'none'" stroke="#f56565" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  {{ isQuestionFlagged(currentQuestion?.external_id) ? 'Unflag' : 'Flag' }}
                </button>
              </div>
            </div>

            <div class="question-body">
              <div class="question-text">
                {{ $td(currentQuestion, 'text') }}
              </div>

              <div class="answers-container">
                <div v-for="answer in displayedAnswers" :key="answer.external_id"
                     class="answer-item"
                     :class="{
                       selected: selectedAnswer?.external_id === answer.external_id,
                       'show-correct': showCorrectAnswers && answer.is_correct,
                       'user-correct': examSubmitted && selectedAnswer?.external_id === answer.external_id && answer.is_correct,
                       'user-incorrect': examSubmitted && selectedAnswer?.external_id === answer.external_id && !answer.is_correct
                     }"
                     @click="selectAnswer(answer)">
                  <div class="answer-radio">
                    <div class="radio-circle" :class="{
                      selected: selectedAnswer?.external_id === answer.external_id,
                      correct: answer.is_correct && (showCorrectAnswers || examSubmitted),
                      incorrect: examSubmitted && selectedAnswer?.external_id === answer.external_id && !answer.is_correct
                    }"></div>
                  </div>
                  <div class="answer-text">{{ $td(answer, 'text') }}</div>
                  <div v-if="showCorrectAnswers && answer.is_correct && !examSubmitted" class="correct-badge">✓</div>
                </div>
              </div>
            </div>

            <div class="question-footer">
              <div class="navigation-buttons">
                <button @click="prevQuestion" :disabled="currentQuestionIndex === 0 || examSubmitted" class="nav-btn secondary">
                  {{ $t('Previous') }}
                </button>
                <div class="question-counter">
                  {{ $t('Question {v0} of {v1}', { v0: currentQuestionIndex + 1, v1: validQuestions.length }) }}
                </div>
                <button v-if="currentQuestionIndex < validQuestions.length - 1"
                        @click="nextQuestion"
                        :disabled="examSubmitted"
                        class="nav-btn primary">
                  {{ $t('Next') }}
                </button>
                <button v-else-if="!examSubmitted"
                        @click="confirmSubmit"
                        :disabled="submitting"
                        class="nav-btn success">
                  {{ submitting ? 'Submitting...' : 'Submit Exam' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Side Panel -->
        <div class="side-panel">
          <!--
            FIRST in the side panel, not last.

            It is the only thing here that can end the sitting, and the
            proctor's own screen had to be corrected for exactly this: the most
            time-critical control was the last thing on the page. A candidate
            has to be able to see the count without hunting for it, or the
            deterrent only works retrospectively.
          -->
          <IntegrityMeter
            v-if="!examSubmitted"
            context="exam"
            :verdict="sitting.verdict.value"
            :events="sitting.log.value"
          />

          <!-- Overview -->
          <div class="overview-card">
            <div class="card-header">
              <h3>{{ $t('Questions') }}</h3>
              <div class="stats">
                <span class="answered">{{ answeredCount }}</span>/<span class="total">{{ validQuestions.length }}</span>
              </div>
            </div>
            <div class="questions-grid">
              <div v-for="(question, index) in validQuestions"
                   :key="question.external_id"
                   class="question-dot"
                   :class="{
                     current: index === currentQuestionIndex,
                     answered: userAnswers.has(question.external_id),
                     flagged: flaggedQuestions.has(question.external_id),
                     correct: examSubmitted && isAnswerCorrect(question.external_id),
                     incorrect: examSubmitted && !isAnswerCorrect(question.external_id) && userAnswers.has(question.external_id)
                   }"
                   @click="goToQuestion(index)">
                {{ index + 1 }}
              </div>
            </div>
            <div class="legend">
              <div class="legend-item">
                <div class="legend-dot current"></div>
                <span>{{ $t('Current') }}</span>
              </div>
              <div class="legend-item">
                <div class="legend-dot answered"></div>
                <span>{{ $t('Answered') }}</span>
              </div>
              <div class="legend-item">
                <div class="legend-dot flagged"></div>
                <span>{{ $t('Flagged') }}</span>
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div class="summary-card">
            <div class="card-header">
              <h3>{{ $t('Summary') }}</h3>
            </div>
            <div class="summary-content">
              <div class="summary-item">
                <span class="label">{{ $t('Time Left:') }}</span>
                <span class="value" :class="{ warning: timeRemaining < 300000 }">{{ formatTime(timeRemaining) }}</span>
              </div>
              <div class="summary-item">
                <span class="label">{{ $t('Answered:') }}</span>
                <span class="value">{{ answeredCount }}</span>
              </div>
              <div class="summary-item">
                <span class="label">{{ $t('Flagged:') }}</span>
                <span class="value">{{ flaggedCount }}</span>
              </div>
              <div v-if="examSubmitted" class="summary-item">
                <span class="label">{{ $t('Score:') }}</span>
                <span class="value score" :class="examResult?.result_status?.toLowerCase()">
                  {{ examResult?.score }}%
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="actions-card">
            <div class="card-header">
              <h3>{{ $t('Actions') }}</h3>
            </div>
            <div class="actions-content">
              <button v-if="!examSubmitted" @click="clearAnswer" :disabled="!selectedAnswer" class="action-btn secondary">
                {{ $t('Clear Answer') }}
              </button>
              <button v-if="examSubmitted" @click="toggleCorrectAnswers" class="action-btn primary">
                {{ showCorrectAnswers ? 'Hide Answers' : 'Show Answers' }}
              </button>
              <button v-if="examSubmitted" @click="goToExams" class="action-btn success">
                {{ $t('Finish') }}
              </button>
            </div>
          </div>

          <!-- Flagged Questions -->
          <div v-if="flaggedCount > 0" class="flagged-card">
            <div class="card-header">
              <h3>{{ $t('Flagged Questions') }}</h3>
            </div>
            <div class="flagged-questions">
              <button v-for="index in flaggedQuestionIndices"
                      :key="index"
                      @click="goToQuestion(index)"
                      class="flagged-btn"
                      :class="{ active: index === currentQuestionIndex }">
                Q{{ index + 1 }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Submit Modal -->
    <div v-if="showSubmitModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ $t('Submit Exam') }}</h3>
          <button @click="showSubmitModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="modal-icon">⚠️</div>
          <h4>{{ $t('Are you sure you want to submit?') }}</h4>
          <div class="summary">
            <div class="summary-row">
              <span>{{ $t('Total Questions:') }}</span>
              <span>{{ validQuestions.length }}</span>
            </div>
            <div class="summary-row">
              <span>{{ $t('Answered:') }}</span>
              <span>{{ answeredCount }}</span>
            </div>
            <div class="summary-row">
              <span>{{ $t('Unanswered:') }}</span>
              <span>{{ validQuestions.length - answeredCount }}</span>
            </div>
          </div>
          <div class="warning-text">
            {{ $t('You cannot change your answers after submission.') }}
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showSubmitModal = false" class="btn-cancel">{{ $t('Cancel') }}</button>
          <button @click="submitExam" :disabled="submitting" class="btn-submit">
            {{ submitting ? 'Submitting...' : 'Submit Exam' }}
          </button>
        </div>
      </div>
    </div>

    <!--
      THE REPRIMAND, and it is its own modal rather than a variant of the
      results one.

      The results modal congratulates or consoles; this one accuses, and
      dressing an accusation in the same furniture as a score would bury it. It
      names the count, it says the paper was submitted and scored zero, and it
      points at the record - because a reprimand delivered without the evidence
      beside it is an accusation, and every action is on the ledger the
      candidate can read.
    -->
    <div v-if="showVoidModal" class="modal-overlay">
      <div class="modal void-modal" role="alertdialog" aria-modal="true">
        <div class="modal-header">
          <h3>{{ $t(FAIL_HEADLINE) }}</h3>
        </div>
        <div class="modal-body">
          <div class="void-modal__mark" aria-hidden="true">!</div>
          <p class="void-modal__body">
            {{ $t(FAIL_BODY, { v0: sitting.verdict.value.negatives, v1: sitting.verdict.value.limit }) }}
          </p>
          <ul class="void-modal__list">
            <li v-for="event in voidedBreaches" :key="event.id">
              <span>{{ $t(event.label) }}</span>
              <span class="void-modal__when">{{ breachTime(event.at) }}</span>
            </li>
          </ul>
          <div class="void-modal__score">
            <span class="void-modal__scoreValue">0%</span>
            <span class="void-modal__scoreLabel">{{ $t('Recorded score') }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <router-link to="/leaderboard" class="btn-review">
            {{ $t('See my activity record') }}
          </router-link>
          <button @click="goToExams" class="btn-finish">{{ $t('Back to Exams') }}</button>
        </div>
      </div>
    </div>

    <!-- Results Modal -->
    <div v-if="showResultsModal" class="modal-overlay">
      <div class="modal results-modal">
        <div class="modal-header">
          <h3>{{ $t('Exam Completed') }}</h3>
        </div>
        <div class="modal-body">
          <div class="result-icon" :class="examResult?.result_status?.toLowerCase()">
            {{ examResult?.result_status === 'PASSED' ? '🎉' : '📝' }}
          </div>
          <h2>{{ examResult?.result_status === 'PASSED' ? 'You Passed!' : 'Exam Completed' }}</h2>
          <p>{{ examResult?.result_message || 'Your exam has been submitted.' }}</p>

          <div class="score-display">
            <div class="score-circle" :class="examResult?.result_status?.toLowerCase()">
              <span class="score-value">{{ examResult?.score }}%</span>
              <span class="score-label">{{ $t('Score') }}</span>
            </div>
          </div>

          <div class="result-details">
            <div class="detail">
              <span>{{ $t('Correct Answers:') }}</span>
              <span>{{ correctAnswers }} / {{ validQuestions.length }}</span>
            </div>
            <div class="detail">
              <span>{{ $t('Time Spent:') }}</span>
              <span>{{ formatTime(timeSpent) }}</span>
            </div>
            <div class="detail">
              <span>{{ $t('Appointment Status:') }}</span>
              <span class="status-badge" :class="appointment?.appointment_status?.toLowerCase().replace(/\s+/g, '-')">
                {{ appointment?.appointment_status }}
              </span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showResultsModal = false; showCorrectAnswers = true;" class="btn-review">
            {{ $t('Review Answers') }}
          </button>
          <button @click="goToExams" class="btn-finish">
            {{ $t('Back to Exams') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { examService, passMarkOf, type Exam, type ExamQuestion, type ExamAnswer, type UserExamResult, type ExamAppointment } from '@/services/exam.service';
import { notificationService } from '@/services/notification.service';
import { proctorService } from '@/services/proctor.service';
import { attemptSeed, shuffleAnswers } from '@/utils/examShuffle';
import IntegrityMeter from '@/components/practice/IntegrityMeter.vue';
import IntegrityRules from '@/components/practice/IntegrityRules.vue';
import { usePracticeSitting } from '@/composables/usePracticeSitting';
import { FAIL_BODY, FAIL_HEADLINE } from '@/utils/practiceIntegrity';

// Import the CSS file
import '@/assets/css/take-exam.css';
// Structural + responsive fixes shared by the eight exam-system pages.
// Imported AFTER the page stylesheet on purpose - see the header of the file.
import '@/assets/css/exam-system.css';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const submitting = ref(false);
const showSubmitModal = ref(false);
const showResultsModal = ref(false);
const showCorrectAnswers = ref(false);
const examSubmitted = ref(false);

// Exam Data
const exam = ref<Exam | null>(null);
const appointment = ref<ExamAppointment | null>(null);
const questions = ref<ExamQuestion[]>([]);
const currentQuestionIndex = ref(0);
const userAnswers = ref<Map<string, ExamAnswer>>(new Map());
const flaggedQuestions = ref<Set<string>>(new Set());
const answerCorrectness = ref<Map<string, boolean>>(new Map());

// Timer
const examStartTime = ref<number>(Date.now());
const timeSpent = ref<number>(0);
const timerInterval = ref<NodeJS.Timeout | null>(null);

// Results
const examResult = ref<UserExamResult | null>(null);
const correctAnswers = ref<number>(0);

/* ------------------------------------------------------------------ *
 * The practice ledger
 * ------------------------------------------------------------------ */

/** Whether the rules have been accepted. The clock waits for it. */
const ruleGateDone = ref(false);
const showVoidModal = ref(false);

/**
 * This sitting.
 *
 * `onVoided` submits, and it is the composable that decides WHEN: it stops the
 * monitor and settles the ledger against app 20 before calling back, because
 * the service scores the paper from what has actually landed and submitting
 * first would race the flush.
 */
const sitting = usePracticeSitting({
  context: 'exam',
  onVoided: async () => {
    showVoidModal.value = true;
    stopTimer();
    // Submitted for them, deliberately. Leaving the paper open would leave a
    // voided sitting with no record at all, which is indistinguishable from a
    // submission that never arrived - and would take the evidence with it. App
    // 20 scores it zero on the strength of the ledger; this sends the answers
    // so the record is complete.
    if (!examSubmitted.value) await submitExamResults({ voided: true });
  },
});

const passMark = computed(() => exam.value ? passMarkOf(exam.value) : 70);

/** The breaches that ended the sitting, for the reprimand's own list. */
const voidedBreaches = computed(() =>
  sitting.log.value.filter(row => row.severity === 'negative'));

/** A wall clock reading. Through `Intl`, so an Arabic reader gets their own. */
function breachTime(at: number): string {
  return Number.isFinite(at) && at > 0
    ? new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
}

// Computed
const validQuestions = computed(() => {
  return questions.value.filter(q => q && q.external_id && q.external_id.trim() !== '');
});

const currentQuestion = computed(() => {
  if (!validQuestions.value[currentQuestionIndex.value]) {
    return null;
  }
  return validQuestions.value[currentQuestionIndex.value];
});

/**
 * Per candidate, so two people sitting together do not see the same order.
 *
 * The user id rather than the appointment, so the review screen can reproduce
 * exactly this order after submission - it knows the result's user_id and has no
 * appointment reference. See attemptSeed().
 */
const answerSeed = computed(() =>
  attemptSeed(authStore.user?.id, route.query.appointmentId as string));

/**
 * The current question's answers, in the order they are shown.
 *
 * Measured on the live exams: **70 of 89 questions had the correct answer
 * first** - 79%, against a 70% pass mark - so the papers were passable without
 * reading them. `shuffleAnswers` is a pure function of `(seed, questionId)`, so
 * this computed can be re-evaluated as often as Vue likes and the order never
 * moves: a `Math.random()` shuffle here would reshuffle on every selection, every
 * timer tick and every re-render, walking the options around under the
 * candidate's finger. See utils/examShuffle.ts.
 *
 * Marking is unaffected - `calculateCorrectAnswers` matches on `external_id`.
 */
const displayedAnswers = computed(() => {
  const question = currentQuestion.value;
  if (!question?.external_id) return [];
  return shuffleAnswers(question.answers, question.external_id, answerSeed.value);
});

const selectedAnswer = computed(() => {
  const question = currentQuestion.value;
  if (!question?.external_id) return null;
  return userAnswers.value.get(question.external_id) || null;
});

const answeredCount = computed(() => {
  return userAnswers.value.size;
});

const flaggedCount = computed(() => {
  return flaggedQuestions.value.size;
});

const timeRemaining = computed(() => {
  if (!exam.value || examSubmitted.value) return 0;
  const totalTime = exam.value.exam_duration * 60 * 1000;
  const elapsed = timeSpent.value;
  return Math.max(0, totalTime - elapsed);
});

const timerClass = computed(() => {
  if (examSubmitted.value) return 'ended';
  if (timeRemaining.value < 300000) return 'warning'; // 5 minutes
  if (timeRemaining.value < 60000) return 'critical'; // 1 minute
  return 'normal';
});

const flaggedQuestionIndices = computed(() => {
  const indices: number[] = [];
  validQuestions.value.forEach((question, index) => {
    if (question?.external_id && flaggedQuestions.value.has(question.external_id)) {
      indices.push(index);
    }
  });
  return indices;
});

// Methods
function isQuestionFlagged(questionId: string | undefined): boolean {
  if (!questionId) return false;
  return flaggedQuestions.value.has(questionId);
}

function isAnswerCorrect(questionId: string): boolean {
  return answerCorrectness.value.get(questionId) || false;
}

onMounted(() => {
  loadExam();
});

onUnmounted(() => {
  stopTimer();
});

async function loadExam() {
  const examId = route.query.examId as string;
  const appointmentId = route.query.appointmentId as string;

  if (!examId) {
    error.value = 'No exam specified';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // Load exam
    exam.value = await examService.getExam(examId);

    // Load appointment if provided
    if (appointmentId) {
      try {
        appointment.value = await examService.getAppointmentById(appointmentId);

        // Update appointment status to "In Progress" when user enters the exam
        if (appointment.value &&
            (appointment.value.appointment_status === 'Scheduled' ||
             appointment.value.appointment_status === 'No Reservation Yet')) {
          await updateAppointmentToInProgress(appointmentId);
        }

        // Check if exam is already completed
        if (appointment.value.appointment_status === 'Completed' ||
            appointment.value.appointment_status === 'Taken but Failed') {
          examSubmitted.value = true;
          await loadExistingExamResult(examId, appointmentId);
        }
      } catch (err) {
        // ignore
      }
    }

    // Load questions for this exam
    const examQuestions = await examService.getExamQuestions(examId);

    // Filter out invalid questions
    questions.value = examQuestions.filter(q => q && q.external_id && q.external_id.trim() !== '');

    if (questions.value.length === 0) {
      throw new Error('No questions found for this exam');
    }

    /*
      THE TIMER NO LONGER STARTS HERE.

      It starts when the rules are accepted (`acceptRules`), so a candidate is
      not charged for the time they spend reading what will void their paper.
      An already-submitted paper skips the gate entirely - somebody reviewing
      their answers is not sitting anything - which is what this branch is for.
    */
    if (examSubmitted.value) {
      ruleGateDone.value = true;
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load exam';
  } finally {
    loading.value = false;
  }
}

async function updateAppointmentToInProgress(appointmentId: string) {
  try {
    const updatedAppointment = await examService.updateExamAppointment(appointmentId, {
      appointment_status: 'In Progress',
      can_start: true,
      is_entered: true,
      entered_datetime: new Date().toISOString()
    });

    appointment.value = updatedAppointment;
  } catch (err: any) {
    throw err;
  }
}

async function loadExistingExamResult(examId: string, appointmentId: string) {
  try {
    const userId = authStore.user?.id;
    if (!userId) return;

    const results = await examService.getUserExamResults(userId, examId);
    if (results.length > 0) {
      const latestResult = results.sort((a, b) =>
        new Date(b.date_taken).getTime() - new Date(a.date_taken).getTime()
      )[0];

      examResult.value = latestResult;

      // Load previous answers
      if (latestResult.user_answers) {
        latestResult.user_answers.forEach(answer => {
          if (answer.exam_question && answer.exam_answer) {
            userAnswers.value.set(answer.exam_question, { external_id: answer.exam_answer } as ExamAnswer);
          }
          if (answer.flagged && answer.exam_question) {
            flaggedQuestions.value.add(answer.exam_question);
          }
        });
      }

      // Calculate correctness
      await calculateCorrectAnswers();

      showCorrectAnswers.value = true;
      showResultsModal.value = true;
      stopTimer();
    }
  } catch (err) {
    // ignore
  }
}

async function calculateCorrectAnswers() {
  correctAnswers.value = 0;
  answerCorrectness.value.clear();

  for (const question of validQuestions.value) {
    const userAnswer = userAnswers.value.get(question.external_id);
    if (userAnswer && question.answers) {
      const isCorrect = question.answers.some(a =>
        a.external_id === userAnswer.external_id && a.is_correct
      );
      answerCorrectness.value.set(question.external_id, isCorrect);
      if (isCorrect) {
        correctAnswers.value++;
      }
    }
  }
}

/**
 * Accept the rules: start the clock, start watching, start the ledger.
 *
 * The order is the sitting's: the ledger records that the rules were
 * acknowledged and that the paper was started BEFORE the first question is on
 * screen, so a sitting that ends badly can be shown to have begun with the
 * rules in front of the candidate.
 */
function acceptRules() {
  if (ruleGateDone.value) return;
  ruleGateDone.value = true;
  sitting.begin(
    { id: exam.value?.external_id || '', name: exam.value?.title || '' },
    { userId: authStore.user?.id || '', username: authStore.user?.username || '' },
  );
  sitting.note('assessment.rules_acknowledged');
  sitting.note('assessment.started');
  startTimer();
}

function startTimer() {
  if (examSubmitted.value) return;

  examStartTime.value = Date.now();
  timerInterval.value = setInterval(() => {
    timeSpent.value = Date.now() - examStartTime.value;

    if (timeRemaining.value <= 0) {
      stopTimer();
      autoSubmit();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
    timerInterval.value = null;
  }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function selectAnswer(answer: ExamAnswer) {
  if (examSubmitted.value || !currentQuestion.value?.external_id) return;
  userAnswers.value.set(currentQuestion.value.external_id, answer);
}

function clearAnswer() {
  if (examSubmitted.value || !currentQuestion.value?.external_id) return;
  userAnswers.value.delete(currentQuestion.value.external_id);
}

function toggleFlag() {
  if (examSubmitted.value || !currentQuestion.value?.external_id) return;
  const questionId = currentQuestion.value.external_id;
  if (flaggedQuestions.value.has(questionId)) {
    flaggedQuestions.value.delete(questionId);
  } else {
    flaggedQuestions.value.add(questionId);
  }
}

function prevQuestion() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--;
  }
}

function nextQuestion() {
  if (currentQuestionIndex.value < validQuestions.value.length - 1) {
    currentQuestionIndex.value++;
  }
}

function goToQuestion(index: number) {
  if (index >= 0 && index < validQuestions.value.length) {
    currentQuestionIndex.value = index;
  }
}

function confirmSubmit() {
  showSubmitModal.value = true;
}

async function autoSubmit() {
  if (examSubmitted.value) return;
  await submitExam();
}

async function submitExam() {
  if (!exam.value || !authStore.user || examSubmitted.value) return;

  showSubmitModal.value = false;
  submitting.value = true;

  try {
    await submitExamResults();
  } catch (err: any) {
    error.value = err.message || 'Failed to submit exam';
    submitting.value = false;
  }
}

async function submitExamResults(opts: { voided?: boolean } = {}) {
  /*
    A GUARD, because this has TWO callers now.

    `submitExam` checks the exam and the user before calling; `onVoided` does
    not, because it fires from the practice monitor the moment the fifth breach
    lands and has no idea what state the page is in. Without this, a paper
    voided while the exam record was somehow absent would throw inside a
    background handler - which is the one place a throw is invisible.
  */
  if (!exam.value || !authStore.user) return;
  /*
    THE LEDGER IS CLOSED FIRST, and that ordering is the whole enforcement.

    App 20 recomputes the verdict from the events that have reached the store
    and overrides the score to zero when the sitting failed - so a submission
    that arrived before the last breach was posted would be scored on one fewer
    breach. `finish` flushes and settles; a voided sitting has already been
    settled by `endSitting`, which is why that path skips it.
  */
  if (!opts.voided) {
    await sitting.finish({
      allAnswered: userAnswers.value.size === validQuestions.value.length,
    });
  }

  // Calculate score
  await calculateCorrectAnswers();
  const score = Math.round((correctAnswers.value / validQuestions.value.length) * 100);
  // The exam's own mark, not a literal. App 20 issues the certificate against
  // this same number, so a hardcoded one here is a student shown a pass who
  // never gets a certificate — with nothing on either side explaining why.
  const passingScore = passMarkOf(exam.value);

  // Generate unique external_id for the exam result
  const resultExternalId = `exam_result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Prepare answers with all required fields
  const userExamAnswers = validQuestions.value.map(question => {
    const userAnswer = userAnswers.value.get(question.external_id);
    const isFlagged = flaggedQuestions.value.has(question.external_id);

    // Generate unique external_id for each answer
    const answerExternalId = `user_exam_ans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      external_id: answerExternalId,
      exam_question: question.external_id,
      exam_answer: userAnswer?.external_id || null,
      flagged: isFlagged,
      // user_exam_result will be set by the backend after the result is created
    };
  });

  // Submit result
  /*
    THE CLIENT STILL SENDS ITS OWN SCORE, and app 20 still overrides it.

    Nothing here is trusted to decide whether the sitting was honest: the
    service counts the stored breaches itself and writes a zero when there were
    five. What `practice_session` does is tell it WHICH sitting to count, and
    that is the only integrity field a client is allowed to set - see
    `validate_result`. Sending a locally-computed verdict instead would be a
    candidate declaring their own sitting clean.
  */
  const resultData = {
    external_id: resultExternalId,
    user_id: authStore.user.id,
    username: authStore.user.username,
    exam: exam.value.external_id,
    score: score,
    date_taken: new Date().toISOString(),
    result_message: score >= passingScore
      ? 'Congratulations! You have passed the exam.'
      : 'You need more practice. Better luck next time!',
    // `as const` on both branches, so the literal type survives into
    // `Partial<UserExamResult>` rather than widening to `string`. A
    // pre-existing `vue-tsc` error on this file, fixed here because the line
    // was being touched anyway.
    result_status: (score >= passingScore ? 'PASSED' : 'FAILED') as 'PASSED' | 'FAILED',
    practice_session: sitting.sessionId.value,
    user_answers: userExamAnswers
  };

  try {
    examResult.value = await examService.submitExam(resultData);
  } catch (error: any) {
    // Try alternative approach if the first one fails
    await submitExamAlternativeApproach(resultExternalId, userExamAnswers, score, passingScore);
  }

  /*
    Update the appointment - unless the sitting was voided.

    App 20 has recorded the zero, and an operator looking at a voided sitting
    wants the appointment as it was rather than silently closed as "Taken but
    Failed", which reads as an ordinary poor mark.
  */
  const appointmentId = route.query.appointmentId as string;
  if (appointmentId && !opts.voided) {
    try {
      const status = score >= passingScore ? 'Completed' : 'Taken but Failed';
      const updateData = {
        appointment_status: status,
        can_start: false,
        exam_time: Math.floor(timeSpent.value / 60000)
      };

      const updatedAppointment = await examService.updateExamAppointment(appointmentId, updateData);
      appointment.value = updatedAppointment;
    } catch (err) {
      // ignore
    }
  }

  // Mark as submitted
  examSubmitted.value = true;
  /*
    The results modal is NOT raised for a voided sitting, and neither is the
    answer key.

    Two different reasons and both matter. A "you scored 0%" card over the top
    of a reprimand reads as a marking error rather than as a penalty; and
    showing the correct answers to somebody whose paper was just voided for
    copying hands them the answer key on the way out.
  */
  if (!opts.voided) {
    showResultsModal.value = true;
    showCorrectAnswers.value = true;
  }
  stopTimer();

  /*
    A VOIDED SITTING STOPS HERE.

    What follows is three notifications, all of them worded for a mark that was
    earned - "passed with 0%" is not a sentence to send anybody, and
    `exam.result_published` is the durable copy of a result the candidate is
    meant to keep.
  */
  if (opts.voided) return;

  // The candidate is looking at their score right now, so the notification is
  // not news — it is the durable copy. An exam result is the one thing on this
  // platform somebody comes back looking for weeks later, and the modal is gone
  // the moment they close the tab.
  const outcome = score >= passingScore
    ? `passed with ${score}%`
    : `${score}%, below the ${passingScore}% pass mark`;
  notificationService.notify('exam.result_published', {
    to: authStore.user?.username || '',
    params: { exam: exam.value?.title || 'your exam', outcome },
  });
  notificationService.notifyAdmins('exam.submitted', {
    student: authStore.user?.username || 'A student',
    exam: exam.value?.title || 'an exam',
    score: `${score}%`,
  });

  // And the proctor who invigilated it. They are the person who has to know the
  // candidate is finished — without this a proctor watching a room has no signal
  // that the paper is in other than the candidate telling them, and the operator
  // notification above goes to somebody who is not in the room.
  notifyProctorOfSubmission(score);
}

/**
 * Tell the invigilating proctor the paper is in. Best effort, and deliberately
 * not awaited: the student's result is already saved and their screen is showing
 * it, so nothing here may delay or fail that.
 */
async function notifyProctorOfSubmission(score: number) {
  try {
    const proctorId = appointment.value?.proctor_id;
    if (!proctorId) return;
    // The appointment carries `proctor_name` once enriched; fall back to asking
    // app 21, because app 16 addresses people by username and not by id.
    let proctorUsername = appointment.value?.proctor_name || '';
    if (!proctorUsername) {
      const proctor = await proctorService.getProctor(proctorId);
      proctorUsername = proctor?.username || '';
    }
    if (!proctorUsername) return;
    notificationService.notify('proctor.exam_submitted', {
      to: proctorUsername,
      params: {
        student: authStore.user?.username || 'A candidate',
        exam: exam.value?.title || 'an exam',
        score: `${score}%`,
      },
    });
  } catch {
    // A proctor not being told must never surface on the candidate's results.
  }
}

// Alternative approach if submitExam fails (called from submitExamResults)
async function submitExamAlternativeApproach(resultExternalId: string, userExamAnswers: any[], score: number, passingScore: number) {
  // Try a different method or re-throw error
  throw new Error('Submission failed');
}

function toggleCorrectAnswers() {
  showCorrectAnswers.value = !showCorrectAnswers.value;
}

function goToExams() {
  router.push('/exams');
}
</script>
