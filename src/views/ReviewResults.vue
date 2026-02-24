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
        <h2>{{ resultTitle }}</h2>
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
              v-for="answer in question.answers"
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

const resultType = type;

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
  
  // Fetch the exam with questions and answers to get the title and details
  const exam = await examService.getExam(examResult.exam);
  
  // Set the exam title on the result for display
  examResult.exam_title = exam.title;
  
  // Store the result
  result.value = examResult;

  // Fetch exam questions with answers
  const examQuestions = await examService.getExamQuestions(examResult.exam);
  questions.value = examQuestions;

  // Build map of user's selected answers (assuming user_answers is included in result)
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
  
  // Fetch the quiz with details
  const quiz = await quizService.getQuiz(quizResult.quiz);
  
  // Set the quiz title
  quizResult.quiz_title = quiz.title;
  
  // Store result
  result.value = quizResult;

  // Get questions (already included in quiz if service fetches them, but we need to ensure)
  // The getQuiz method should populate questions, but if not, we can fetch separately.
  // For safety, we use quiz.questions or fetch if empty.
  if (quiz.questions && quiz.questions.length > 0) {
    questions.value = quiz.questions;
  } else {
    // Fallback: fetch quiz questions separately
    const quizQuestions = await quizService.getQuiz(quizResult.quiz); // but this might not include questions
    // Actually, we need to fetch questions via a separate method; quizService.getQuiz already includes questions.
    // So we can just assign quiz.questions.
    questions.value = quiz.questions || [];
  }

  if (quizResult.user_answers) {
    quizResult.user_answers.forEach((ua: any) => {
      if (ua.quiz_answer) {
        userAnswersMap.value.set(ua.quiz_question, ua.quiz_answer);
      }
    });
  }
}

const resultTitle = computed(() => {
  if (!result.value) return '';
  if (type === 'exam') {
    return (result.value as UserExamResult).exam_title || (result.value as UserExamResult).exam;
  } else {
    return (result.value as UserQuizResult).quiz_title || (result.value as UserQuizResult).quiz;
  }
});

const scoreClass = computed(() => {
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
</script>

<style src="@/assets/css/review-results.css"></style>