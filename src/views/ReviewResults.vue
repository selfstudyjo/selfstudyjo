<template>
  <div class="review-results">
    <div class="review-header">
      <h1>Review {{ resultType === 'exam' ? 'Exam' : 'Quiz' }}</h1>
      <button class="back-btn" @click="goBack">Back to Results</button>
    </div>

    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div class="result-summary">
        <!-- Now shows the real title from the exam/quiz data -->
        <h2>{{ contentTitle }}</h2>
        <p class="score">
          Score: <strong :class="scoreClass">{{ result?.score }}%</strong>
          ({{ result?.result_status }})
        </p>
        <p>Date: {{ formatDate(result?.date_taken) }}</p>
      </div>

      <div class="questions-review">
        <h3>Questions</h3>
        <div
          v-for="(question, index) in questions"
          :key="question.external_id"
          class="question-card"
          :class="{ correct: isQuestionCorrect(question), incorrect: !isQuestionCorrect(question) }"
        >
          <div class="question-header">
            <span class="q-num">Q{{ index + 1 }}.</span>
            <span class="q-text">{{ question.text }}</span>
            <span class="q-score">{{ question.score }} pts</span>
          </div>
          <div class="answers">
            <div
              v-for="answer in answersOf(question)"
              :key="answer.external_id"
              class="answer"
              :class="{
                'selected': isAnswerSelected(question, answer),
                'correct-answer': answer.is_correct
              }"
            >
              <span class="answer-text">{{ answer.text }}</span>
              <span v-if="answer.is_correct" class="correct-badge">Correct</span>
              <span v-else-if="isAnswerSelected(question, answer) && !answer.is_correct" class="wrong-badge">Your answer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { examService, type UserExamResult, type ExamQuestion, type ExamAnswer } from '@/services/exam.service';
import { attemptSeed, shuffleAnswers } from '@/utils/examShuffle';
import { quizService, type UserQuizResult, type QuizQuestion, type QuizAnswer } from '@/services/quiz.service';

const route = useRoute();
const router = useRouter();

const type = route.params.type as 'exam' | 'quiz';
const resultId = route.params.id as string;

const result = ref<UserExamResult | UserQuizResult | null>(null);
const questions = ref<(ExamQuestion | QuizQuestion)[]>([]);
const userAnswersMap = ref<Map<string, string>>(new Map()); // question_id -> selected answer_id
const loading = ref(true);
const error = ref('');

// Store the real title (exam/quiz) separately – this is what we display in the summary
const contentTitle = ref('');

const resultType = type;

/**
 * A question's answers in the order the candidate actually saw them.
 *
 * Exams are shuffled per candidate (utils/examShuffle.ts, because 79% of the live
 * questions had the correct answer first), and this screen has to reproduce that
 * order or a candidate reviewing their paper sees the option they chose second
 * sitting first. Same seed, same question id, same permutation.
 *
 * QUIZZES ARE LEFT ALONE, deliberately: `TakeQuiz.vue` renders them in stored
 * order, and their live data is already well distributed (measured: 15/57/38/6
 * across 119 questions). Shuffling only here would introduce exactly the
 * mismatch this function exists to prevent.
 */
function answersOf(question: any) {
  if (resultType !== 'exam') return question?.answers || [];
  return shuffleAnswers(question?.answers, question?.external_id,
                        attemptSeed((result.value as any)?.user_id));
}

onMounted(async () => {
  try {
    if (type === 'exam') {
      await loadExamResult();
    } else {
      await loadQuizResult();
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load result';
  } finally {
    loading.value = false;
  }
});

async function loadExamResult() {
  // Fetch the result
  const examResult = await examService.getExamResultById(resultId) as UserExamResult;
  result.value = examResult;

  // Fetch the exam details (which contain the real title)
  const exam = await examService.getExam(examResult.exam);
  contentTitle.value = exam.title || examResult.exam_title || examResult.exam;

  // Fetch questions with answers
  const examQuestions = await examService.getExamQuestions(examResult.exam);
  questions.value = examQuestions;

  // Build map of user's selected answers
  if (examResult.user_answers) {
    examResult.user_answers.forEach((ua: any) => {
      if (ua.exam_answer) {
        userAnswersMap.value.set(ua.exam_question, ua.exam_answer);
      }
    });
  }
}

async function loadQuizResult() {
  // Fetch the result
  const quizResult = await quizService.getQuizResultById(resultId) as UserQuizResult;
  result.value = quizResult;

  // Fetch the quiz details (which contain the real title)
  const quiz = await quizService.getQuiz(quizResult.quiz);
  contentTitle.value = quiz.title || quizResult.quiz_title || quizResult.quiz;

  // Questions are already inside the quiz object? If not, fetch them separately.
  // The service might return quiz with questions; adjust if needed.
  questions.value = quiz.questions || [];

  // Build map of user's selected answers
  if (quizResult.user_answers) {
    quizResult.user_answers.forEach((ua: any) => {
      if (ua.quiz_answer) {
        userAnswersMap.value.set(ua.quiz_question, ua.quiz_answer);
      }
    });
  }
}

const scoreClass = computed(() => {
  // The stored verdict wins — see the note in UserResults.vue. A literal 70 here
  // disagreed with app 20 for any exam whose pass mark is not 70.
  const verdict = String((result.value as any)?.result_status || '').toUpperCase();
  if (verdict === 'PASSED') return 'pass';
  if (verdict === 'FAILED') return 'fail';
  const score = result.value?.score || 0;
  if (score >= 70) return 'pass';
  if (score >= 50) return 'average';
  return 'fail';
});

function formatDate(dateStr?: string) {
  return dateStr ? new Date(dateStr).toLocaleDateString() : '';
}

function isQuestionCorrect(question: any): boolean {
  const correctAnswer = question.answers?.find((a: any) => a.is_correct);
  if (!correctAnswer) return false;
  const selectedId = userAnswersMap.value.get(question.external_id);
  return selectedId === correctAnswer.external_id;
}

function isAnswerSelected(question: any, answer: any): boolean {
  return userAnswersMap.value.get(question.external_id) === answer.external_id;
}

function goBack() {
  router.push('/my-results');
}

// Structural + responsive fixes shared by the eight exam-system pages.
// Imported AFTER the page stylesheet on purpose - see the header of the file.
import '@/assets/css/exam-system.css';
</script>

<!-- ===== scoped prevents style conflicts with global buttons ===== -->
<style scoped src="@/assets/css/review-results.css"></style>