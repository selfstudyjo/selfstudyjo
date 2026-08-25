<template>
  <div class="take-quiz-page">
    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ loadingMessage }}</p>
    </div>

    <!-- Quiz Content -->
    <div v-else-if="quiz" class="quiz-content">
      <!-- Quiz Header -->
      <div class="quiz-header">
        <div class="breadcrumb">
          <router-link :to="backToCourseLink" class="breadcrumb-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            {{ $t('Back to Course') }}
          </router-link>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">{{ $t('Quiz: {v0}', { v0: quiz.title }) }}</span>
        </div>

        <div class="quiz-info">
          <h1 class="quiz-title">{{ quiz.title }}</h1>
          <div class="quiz-meta">
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>{{ $t('Time: {v0}', { v0: formatTime(remainingTime) }) }}</span>
            </div>
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <span>{{ $t('Questions: {v0}', { v0: quiz.questions?.length || 0 }) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Result Display (after submission) -->
      <div v-if="showResult" class="quiz-result">
        <div class="result-card" :class="resultClass">
          <div class="result-icon">
            <svg v-if="quizResult?.result_status === 'PASSED'" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <h2 class="result-title">{{ quizResult?.result_status === 'PASSED' ? 'Quiz Passed!' : 'Quiz Failed' }}</h2>
          <div class="result-score">
            <div class="score-display">
              <span class="score-value">{{ formattedScore }}%</span>
              <span class="score-label">{{ $t('Your Score') }}</span>
            </div>
          </div>
          <p class="result-message">{{ quizResult?.result_message || '' }}</p>
          <div class="result-actions">
            <button class="btn-primary" @click="returnToCourse">
              {{ $t('Return to Course') }}
            </button>
            <button v-if="quizResult?.result_status === 'FAILED'" class="btn-secondary" @click="retakeQuiz">
              {{ $t('Retake Quiz') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Quiz Instructions -->
      <div v-else-if="!quizStarted" class="quiz-instructions">
        <div class="instructions-card">
          <h2 class="instructions-title">{{ $t('Quiz Instructions') }}</h2>
          <div class="instructions-content">
            <p>{{ quiz.description }}</p>
            <div class="instructions-list">
              <div class="instruction-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>{{ $t('Time Limit: {v0} minutes', { v0: quiz.quiz_duration }) }}</span>
              </div>
              <div class="instruction-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                <span>{{ $t('Total Questions: {v0}', { v0: quiz.questions?.length || 0 }) }}</span>
              </div>
              <div class="instruction-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>{{ $t('Passing Score: 70%') }}</span>
              </div>
              <div class="instruction-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>{{ $t('Flag questions to review later') }}</span>
              </div>
            </div>
          </div>
          <div class="instructions-actions">
            <button class="btn-primary" @click="startQuiz">
              {{ $t('Start Quiz') }}
            </button>
            <button class="btn-secondary" @click="returnToCourse">
              {{ $t('Return to Course') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Quiz Questions -->
      <div v-else class="quiz-questions">
        <div class="quiz-layout">
          <!-- Question Navigation Sidebar -->
          <div class="question-sidebar">
            <div class="timer-section">
              <div class="timer-display">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span class="timer-text">{{ formatTime(remainingTime) }}</span>
              </div>
              <div class="timer-progress">
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    :style="{ width: `${(remainingTime / (quiz.quiz_duration * 60)) * 100}%` }"
                  ></div>
                </div>
              </div>
            </div>

            <div class="question-navigation">
              <h3 class="nav-title">{{ $t('Questions') }}</h3>
              <div class="question-grid">
                <button
                  v-for="(question, index) in quiz.questions"
                  :key="question.external_id"
                  class="question-nav-btn"
                  :class="{
                    'current': currentQuestionIndex === index,
                    'answered': userAnswers.has(question.external_id),
                    'flagged': flaggedQuestions.has(question.external_id)
                  }"
                  @click="goToQuestion(index)"
                >
                  {{ index + 1 }}
                  <span v-if="flaggedQuestions.has(question.external_id)" class="flag-indicator">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                      <line x1="4" y1="22" x2="4" y2="15"></line>
                    </svg>
                  </span>
                </button>
              </div>
            </div>

            <div class="flagged-questions">
              <h3 class="nav-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
                {{ $t('Flagged ({v0})', { v0: flaggedQuestions.size }) }}
              </h3>
              <div v-if="flaggedQuestions.size > 0" class="flagged-list">
                <button
                  v-for="(questionId, index) in Array.from(flaggedQuestions)"
                  :key="questionId"
                  class="flagged-btn"
                  @click="goToFlaggedQuestion(questionId)"
                >
                  Q{{ getQuestionNumber(questionId) + 1 }}
                </button>
              </div>
              <p v-else class="no-flagged">{{ $t('No flagged questions') }}</p>
            </div>

            <div class="sidebar-actions">
              <button
                class="btn-submit"
                :disabled="submitting"
                @click="submitQuiz"
              >
                <span v-if="submitting" class="btn-loading"></span>
                <span v-else>{{ $t('Submit Quiz') }}</span>
              </button>
            </div>
          </div>

          <!-- Main Question Area -->
          <div class="question-main">
            <!-- Question Header -->
            <div class="question-header">
              <div class="question-counter">
                {{ $t('Question {v0} of {v1}', { v0: currentQuestionIndex + 1, v1: quiz.questions?.length || 0 }) }}
              </div>
              <div class="question-actions">
                <button
                  class="flag-btn"
                  :class="{ 'flagged': flaggedQuestions.has(currentQuestion.external_id) }"
                  @click="toggleFlag(currentQuestion.external_id)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                    <line x1="4" y1="22" x2="4" y2="15"></line>
                  </svg>
                  {{ flaggedQuestions.has(currentQuestion.external_id) ? 'Unflag' : 'Flag' }}
                </button>
              </div>
            </div>

            <!-- Question Text -->
            <div class="question-text">
              <h2>{{ currentQuestion.text }}</h2>
              <div class="question-score">
                <span class="score-badge">{{ $t('Score: {v0} points', { v0: currentQuestion.score }) }}</span>
              </div>
            </div>

            <!-- Answers -->
            <div class="answers-section">
              <div
                v-for="answer in currentQuestion.answers"
                :key="answer.external_id"
                class="answer-option"
                :class="{
                  'selected': selectedAnswer === answer.external_id,
                  'correct': showCorrectAnswers && answer.is_correct
                }"
                @click="selectAnswer(answer.external_id)"
              >
                <div class="answer-radio">
                  <div class="radio-circle" :class="{ 'checked': selectedAnswer === answer.external_id }"></div>
                </div>
                <div class="answer-content">
                  <p>{{ answer.text }}</p>
                  <span v-if="showCorrectAnswers && answer.is_correct" class="correct-indicator">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    {{ $t('Correct Answer') }}
                  </span>
                </div>
              </div>

              <div v-if="!currentQuestion.answers || currentQuestion.answers.length === 0" class="no-answers">
                <p>{{ $t('No answers available for this question.') }}</p>
              </div>
            </div>

            <!-- Navigation Buttons -->
            <div class="question-navigation-buttons">
              <button
                class="nav-btn prev-btn"
                :disabled="currentQuestionIndex === 0"
                @click="prevQuestion"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                {{ $t('Previous') }}
              </button>

              <button
                class="nav-btn next-btn"
                @click="nextQuestion"
              >
                {{ currentQuestionIndex === (quiz.questions?.length || 0) - 1 ? 'Finish' : 'Next' }}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            <!-- Quiz Progress -->
            <div class="quiz-progress">
              <div class="progress-info">
                <span>{{ $t('Progress: {v0}/{v1}', { v0: currentQuestionIndex + 1, v1: quiz.questions?.length || 0 }) }}</span>
                <span>{{ Math.round(((currentQuestionIndex + 1) / (quiz.questions?.length || 1)) * 100) }}%</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${((currentQuestionIndex + 1) / (quiz.questions?.length || 1)) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 class="error-title">{{ $t('Unable to load quiz') }}</h3>
      <p class="error-message">{{ error }}</p>
      <button class="retry-btn" @click="loadQuiz">
        {{ $t('Try Again') }}
      </button>
      <button class="back-btn" @click="returnToCourse">
        {{ $t('Back to Course') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { quizService, type Quiz, type SubmitQuizResponse, type SubmitQuizRequest } from '@/services/quiz.service';
import { useAuthStore } from '@/store/auth';
import { serviceRegistry } from '@/services/config';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// State
const quiz = ref<Quiz | null>(null);
const loading = ref(false);
const loadingMessage = ref('Loading quiz...');
const error = ref<string | null>(null);
const quizStarted = ref(false);
const showResult = ref(false);
const submitting = ref(false);
const quizResult = ref<SubmitQuizResponse | null>(null);

// Quiz state
const currentQuestionIndex = ref(0);
const userAnswers = ref<Map<string, string>>(new Map());
const flaggedQuestions = ref<Set<string>>(new Set());
const showCorrectAnswers = ref(false);
const remainingTime = ref(0);
const timerInterval = ref<NodeJS.Timeout | null>(null);

// Replica pinning
const quizReplicaBaseUrl = ref<string | null>(null);

// Cache keys
const getQuizCacheKey = (quizId: string) => `quiz_${quizId}`;

/** Round a number to 1 decimal place (e.g. 85.7364 -> 85.7) */
const round1 = (n: number): number => {
  if (!isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
};

// Computed
const currentQuestion = computed(() => {
  if (!quiz.value?.questions || quiz.value.questions.length === 0) return null;
  return quiz.value.questions[currentQuestionIndex.value];
});

const selectedAnswer = computed(() => {
  if (!currentQuestion.value) return null;
  return userAnswers.value.get(currentQuestion.value.external_id) || null;
});

const resultClass = computed(() => {
  if (!quizResult.value) return '';
  return quizResult.value.result_status === 'PASSED' ? 'passed' : 'failed';
});

const backToCourseLink = computed(() => {
  const courseId = route.query.courseId as string;
  return courseId ? `/course/${courseId}` : '/courses';
});

/** Display-only formatted score (always 1 decimal place, e.g. 85.7) */
const formattedScore = computed(() => {
  const raw = quizResult.value?.score;
  if (raw === undefined || raw === null || isNaN(Number(raw))) return '0.0';
  return round1(Number(raw)).toFixed(1);
});

// --- Ultimate Optimized loadQuiz ---
const loadQuiz = async () => {
  const quizId = route.query.quizId as string;
  const lessonId = route.query.lessonId as string;

  if (!quizId && !lessonId) {
    error.value = 'No quiz or lesson ID provided';
    return;
  }

  loading.value = true;
  loadingMessage.value = 'Loading quiz...';
  error.value = null;

  try {
    if (!authStore.user?.id || !authStore.user?.username) {
      error.value = 'You must be logged in to take a quiz';
      return;
    }

    // 1. Try router state (fastest)
    const state = history.state as { quiz?: Quiz } | null;
    if (state?.quiz) {
      if ((quizId && state.quiz.external_id === quizId) ||
          (lessonId && state.quiz.lesson_id === lessonId)) {
        quiz.value = state.quiz;
        // Check if already taken
        const existingResult = await quizService.getUserQuizResult(
          authStore.user.id,
          quiz.value.external_id,
          quizReplicaBaseUrl.value || undefined
        );
        if (existingResult) {
          showResult.value = true;
          quizResult.value = {
            external_id: existingResult.external_id,
            user_id: existingResult.user_id,
            username: existingResult.username,
            quiz: existingResult.quiz,
            score: round1(existingResult.score),
            date_taken: existingResult.date_taken || new Date().toISOString(),
            result_message: existingResult.result_message || '',
            result_status: existingResult.result_status
          };
        } else {
          remainingTime.value = quiz.value.quiz_duration * 60;
        }
        return;
      }
    }

    // 2. Try sessionStorage (for this session)
    if (quizId) {
      const cached = sessionStorage.getItem(getQuizCacheKey(quizId));
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Quiz;
          if (parsed.questions && parsed.questions.length > 0) {
            quiz.value = parsed;
            const existingResult = await quizService.getUserQuizResult(
              authStore.user.id,
              quiz.value.external_id,
              quizReplicaBaseUrl.value || undefined
            );
            if (existingResult) {
              showResult.value = true;
              quizResult.value = {
                external_id: existingResult.external_id,
                user_id: existingResult.user_id,
                username: existingResult.username,
                quiz: existingResult.quiz,
                score: round1(existingResult.score),
                date_taken: existingResult.date_taken || new Date().toISOString(),
                result_message: existingResult.result_message || '',
                result_status: existingResult.result_status
              };
            } else {
              remainingTime.value = quiz.value.quiz_duration * 60;
            }
            return;
          }
        } catch (e) {
          // Invalid cache, ignore
        }
      }
    }

    // 3. Fetch from API (parallel quiz + result)
    const replica = await quizService.getRandomQuizReplica();
    if (!replica) throw new Error('No exam service replicas available');
    quizReplicaBaseUrl.value = replica;

    let quizPromise: Promise<Quiz | null>;
    if (quizId) {
      quizPromise = quizService.getQuiz(quizId, quizReplicaBaseUrl.value);
    } else {
      quizPromise = quizService.getQuizByLessonId(lessonId, quizReplicaBaseUrl.value);
    }

    const resultsPromise = quizService.getUserQuizResult(authStore.user.id, quizId || '', quizReplicaBaseUrl.value);

    const [fetchedQuiz, existingResult] = await Promise.all([quizPromise, resultsPromise]);

    if (!fetchedQuiz) {
      error.value = 'Quiz not found for this lesson';
      return;
    }

    quiz.value = fetchedQuiz;

    // Cache in sessionStorage
    if (quizId) {
      try {
        sessionStorage.setItem(getQuizCacheKey(quizId), JSON.stringify(fetchedQuiz));
      } catch (e) {
        // Ignore
      }
    }

    if (existingResult) {
      showResult.value = true;
      quizResult.value = {
        external_id: existingResult.external_id,
        user_id: existingResult.user_id,
        username: existingResult.username,
        quiz: existingResult.quiz,
        score: round1(existingResult.score),
        date_taken: existingResult.date_taken || new Date().toISOString(),
        result_message: existingResult.result_message || '',
        result_status: existingResult.result_status
      };
    } else {
      remainingTime.value = fetchedQuiz.quiz_duration * 60;
    }

  } catch (err: any) {
    error.value = err.message || 'Failed to load quiz. Please try again.';
  } finally {
    loading.value = false;
  }
};

const startQuiz = () => {
  quizStarted.value = true;
  startTimer();
};

const startTimer = () => {
  if (timerInterval.value) clearInterval(timerInterval.value);
  timerInterval.value = setInterval(() => {
    if (remainingTime.value <= 0) {
      clearInterval(timerInterval.value!);
      submitQuiz();
      return;
    }
    remainingTime.value--;
  }, 1000);
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const goToQuestion = (index: number) => {
  if (quiz.value?.questions && index >= 0 && index < quiz.value.questions.length) {
    currentQuestionIndex.value = index;
  }
};

const goToFlaggedQuestion = (questionId: string) => {
  if (!quiz.value?.questions) return;
  const index = quiz.value.questions.findIndex(q => q.external_id === questionId);
  if (index !== -1) currentQuestionIndex.value = index;
};

const getQuestionNumber = (questionId: string): number => {
  if (!quiz.value?.questions) return 0;
  return quiz.value.questions.findIndex(q => q.external_id === questionId);
};

const selectAnswer = (answerId: string) => {
  if (!currentQuestion.value) return;
  userAnswers.value.set(currentQuestion.value.external_id, answerId);
};

const toggleFlag = (questionId: string) => {
  if (flaggedQuestions.value.has(questionId)) {
    flaggedQuestions.value.delete(questionId);
  } else {
    flaggedQuestions.value.add(questionId);
  }
};

const prevQuestion = () => {
  if (currentQuestionIndex.value > 0) currentQuestionIndex.value--;
};

const nextQuestion = () => {
  if (!quiz.value?.questions) return;
  if (currentQuestionIndex.value < quiz.value.questions.length - 1) {
    currentQuestionIndex.value++;
  } else {
    if (confirm('This is the last question. Do you want to submit the quiz?')) {
      submitQuiz();
    }
  }
};

const submitQuiz = async () => {
  if (!quiz.value || !authStore.user?.id || !authStore.user?.username) {
    error.value = 'Unable to submit quiz. Please try again.';
    return;
  }

  if (!confirm('Are you sure you want to submit your quiz? You cannot change answers after submission.')) {
    return;
  }

  submitting.value = true;

  try {
    if (timerInterval.value) {
      clearInterval(timerInterval.value);
      timerInterval.value = null;
    }

    const scoreData = quizService.calculateQuizResult(quiz.value, userAnswers.value);
    const submission: SubmitQuizRequest = quizService.createUserQuizResult(
      authStore.user.id,
      authStore.user.username,
      quiz.value.external_id,
      scoreData,
      userAnswers.value
    );

    const response = await quizService.submitQuiz(submission, quizReplicaBaseUrl.value || undefined);

    // Ensure score is exactly 1 decimal place
    if (response && typeof response.score === 'number') {
      response.score = round1(response.score);
    }

    quizResult.value = response;
    showResult.value = true;
    showCorrectAnswers.value = true;
    quizStarted.value = false;

    // Clear cache for this quiz (so retake fetches fresh)
    const quizId = quiz.value.external_id;
    sessionStorage.removeItem(getQuizCacheKey(quizId));
  } catch (err: any) {
    error.value = 'Failed to submit quiz. Please try again.';
    alert('Failed to submit quiz. Please check console for details.');
  } finally {
    submitting.value = false;
  }
};

const returnToCourse = () => {
  const courseId = route.query.courseId as string;
  if (courseId) {
    router.push(`/course/${courseId}`);
  } else {
    router.push('/courses');
  }
};

const retakeQuiz = () => {
  quizStarted.value = false;
  showResult.value = false;
  showCorrectAnswers.value = false;
  userAnswers.value.clear();
  flaggedQuestions.value.clear();
  currentQuestionIndex.value = 0;
  if (quiz.value) {
    remainingTime.value = quiz.value.quiz_duration * 60;
  }
};

onMounted(() => {
  loadQuiz();
});

onUnmounted(() => {
  if (timerInterval.value) clearInterval(timerInterval.value);
});
</script>

<style scoped src="@/assets/css/take-quiz.css"></style>