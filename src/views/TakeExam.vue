<!-- src/views/TakeExam.vue -->
<template>
  <div class="take-exam-page">
    <!-- Header -->
    <div class="exam-header">
      <div class="header-content">
        <div class="exam-info">
          <h1 class="exam-title">{{ exam?.title }}</h1>
          <p class="exam-course">{{ exam?.course_name || exam?.course_id }}</p>
          <div v-if="appointment" class="appointment-status">
            <span class="status-badge" :class="appointment.appointment_status.toLowerCase().replace(/\s+/g, '-')">
              {{ appointment.appointment_status }}
            </span>
          </div>
        </div>
        <div class="exam-controls">
          <div class="timer-container">
            <div class="timer-label">Time Remaining</div>
            <div class="timer" :class="timerClass">{{ formatTime(timeRemaining) }}</div>
          </div>
          <div class="question-nav">
            <div class="nav-label">Question</div>
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
      <p>Loading exam...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">❌</div>
      <h3>Error Loading Exam</h3>
      <p>{{ error }}</p>
      <button @click="loadExam" class="retry-btn">Retry</button>
    </div>

    <!-- Main Content -->
    <div v-else-if="exam && validQuestions.length > 0" class="main-content">
      <div class="content-grid">
        <!-- Question Panel -->
        <div class="question-panel">
          <div class="question-card">
            <div class="question-header">
              <h3 class="question-number">Question {{ currentQuestionIndex + 1 }}</h3>
              <div class="question-meta">
                <span class="question-score">{{ currentQuestion?.score }} points</span>
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
                {{ currentQuestion?.text }}
              </div>

              <div class="answers-container">
                <div v-for="answer in currentQuestion?.answers" :key="answer.external_id"
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
                  <div class="answer-text">{{ answer.text }}</div>
                  <div v-if="showCorrectAnswers && answer.is_correct && !examSubmitted" class="correct-badge">✓</div>
                </div>
              </div>
            </div>

            <div class="question-footer">
              <div class="navigation-buttons">
                <button @click="prevQuestion" :disabled="currentQuestionIndex === 0 || examSubmitted" class="nav-btn secondary">
                  Previous
                </button>
                <div class="question-counter">
                  Question {{ currentQuestionIndex + 1 }} of {{ validQuestions.length }}
                </div>
                <button v-if="currentQuestionIndex < validQuestions.length - 1"
                        @click="nextQuestion"
                        :disabled="examSubmitted"
                        class="nav-btn primary">
                  Next
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
          <!-- Overview -->
          <div class="overview-card">
            <div class="card-header">
              <h3>Questions</h3>
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
                <span>Current</span>
              </div>
              <div class="legend-item">
                <div class="legend-dot answered"></div>
                <span>Answered</span>
              </div>
              <div class="legend-item">
                <div class="legend-dot flagged"></div>
                <span>Flagged</span>
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div class="summary-card">
            <div class="card-header">
              <h3>Summary</h3>
            </div>
            <div class="summary-content">
              <div class="summary-item">
                <span class="label">Time Left:</span>
                <span class="value" :class="{ warning: timeRemaining < 300000 }">{{ formatTime(timeRemaining) }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Answered:</span>
                <span class="value">{{ answeredCount }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Flagged:</span>
                <span class="value">{{ flaggedCount }}</span>
              </div>
              <div v-if="examSubmitted" class="summary-item">
                <span class="label">Score:</span>
                <span class="value score" :class="examResult?.result_status?.toLowerCase()">
                  {{ examResult?.score }}%
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="actions-card">
            <div class="card-header">
              <h3>Actions</h3>
            </div>
            <div class="actions-content">
              <button v-if="!examSubmitted" @click="clearAnswer" :disabled="!selectedAnswer" class="action-btn secondary">
                Clear Answer
              </button>
              <button v-if="examSubmitted" @click="toggleCorrectAnswers" class="action-btn primary">
                {{ showCorrectAnswers ? 'Hide Answers' : 'Show Answers' }}
              </button>
              <button v-if="examSubmitted" @click="goToExams" class="action-btn success">
                Finish
              </button>
            </div>
          </div>

          <!-- Flagged Questions -->
          <div v-if="flaggedCount > 0" class="flagged-card">
            <div class="card-header">
              <h3>Flagged Questions</h3>
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
          <h3>Submit Exam</h3>
          <button @click="showSubmitModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="modal-icon">⚠️</div>
          <h4>Are you sure you want to submit?</h4>
          <div class="summary">
            <div class="summary-row">
              <span>Total Questions:</span>
              <span>{{ validQuestions.length }}</span>
            </div>
            <div class="summary-row">
              <span>Answered:</span>
              <span>{{ answeredCount }}</span>
            </div>
            <div class="summary-row">
              <span>Unanswered:</span>
              <span>{{ validQuestions.length - answeredCount }}</span>
            </div>
          </div>
          <div class="warning-text">
            You cannot change your answers after submission.
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showSubmitModal = false" class="btn-cancel">Cancel</button>
          <button @click="submitExam" :disabled="submitting" class="btn-submit">
            {{ submitting ? 'Submitting...' : 'Submit Exam' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Results Modal -->
    <div v-if="showResultsModal" class="modal-overlay">
      <div class="modal results-modal">
        <div class="modal-header">
          <h3>Exam Completed</h3>
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
              <span class="score-label">Score</span>
            </div>
          </div>

          <div class="result-details">
            <div class="detail">
              <span>Correct Answers:</span>
              <span>{{ correctAnswers }} / {{ validQuestions.length }}</span>
            </div>
            <div class="detail">
              <span>Time Spent:</span>
              <span>{{ formatTime(timeSpent) }}</span>
            </div>
            <div class="detail">
              <span>Appointment Status:</span>
              <span class="status-badge" :class="appointment?.appointment_status?.toLowerCase().replace(/\s+/g, '-')">
                {{ appointment?.appointment_status }}
              </span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showResultsModal = false; showCorrectAnswers = true;" class="btn-review">
            Review Answers
          </button>
          <button @click="goToExams" class="btn-finish">
            Back to Exams
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
import { examService, type Exam, type ExamQuestion, type ExamAnswer, type UserExamResult, type ExamAppointment } from '@/services/exam.service';

// Import the CSS file
import '@/assets/css/take-exam.css';

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

    // Start timer if not submitted
    if (!examSubmitted.value) {
      startTimer();
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

async function submitExamResults() {
  // Calculate score
  await calculateCorrectAnswers();
  const score = Math.round((correctAnswers.value / validQuestions.value.length) * 100);
  const passingScore = 70;

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
    result_status: score >= passingScore ? 'PASSED' : 'FAILED',
    user_answers: userExamAnswers
  };

  try {
    examResult.value = await examService.submitExam(resultData);
  } catch (error: any) {
    // Try alternative approach if the first one fails
    await submitExamAlternativeApproach(resultExternalId, userExamAnswers, score, passingScore);
  }

  // Update appointment based on exam result
  const appointmentId = route.query.appointmentId as string;
  if (appointmentId) {
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
  showResultsModal.value = true;
  showCorrectAnswers.value = true;
  stopTimer();
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
