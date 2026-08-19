<template>
  <div class="user-results">
    <h1>My Results</h1>

    <!-- Tabs -->
    <div class="tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'exams' }"
        @click="activeTab = 'exams'"
      >
        Exam Results
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'quizzes' }"
        @click="activeTab = 'quizzes'"
      >
        Quiz Results
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'chart' }"
        @click="activeTab = 'chart'"
      >
        Line Chart
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Exam Results -->
      <div v-if="activeTab === 'exams'" class="exam-results">
        <div v-if="loading.exams" class="loading">Loading exam results...</div>
        <div v-else-if="examResults.length === 0" class="empty">No exam results yet.</div>
        <div v-else class="results-grid">
          <div
            v-for="result in examResults"
            :key="result.external_id"
            class="result-card"
            @click="goToReview('exam', result.external_id)"
          >
            <div class="result-header">
              <h3>{{ result.exam_title || result.exam }}</h3>
              <span class="score" :class="getScoreClass(result.score, result.result_status)">{{ result.score }}%</span>
            </div>
            <p class="date">Taken: {{ formatDate(result.date_taken) }}</p>
            <p class="status" :class="result.result_status.toLowerCase()">
              {{ result.result_status }}
            </p>
            <!-- A pass now issues a certificate on its own (app 20). Saying so
                 here is the difference between a student waiting for something
                 and a student knowing where it is. `pending` is a real state, not
                 an error: app 24 may simply have been cold. -->
            <p v-if="certificateNote(result)" class="certificate-note"
               :class="result.certificate_status">
              <span aria-hidden="true">{{ result.certificate_status === 'issued' ? '🏆' : '⏳' }}</span>
              {{ certificateNote(result) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Quiz Results -->
      <div v-if="activeTab === 'quizzes'" class="quiz-results">
        <div v-if="loading.quizzes" class="loading">Loading quiz results...</div>
        <div v-else-if="quizResults.length === 0" class="empty">No quiz results yet.</div>
        <div v-else class="results-grid">
          <div
            v-for="result in quizResults"
            :key="result.external_id"
            class="result-card"
            @click="goToReview('quiz', result.external_id)"
          >
            <div class="result-header">
              <h3>{{ result.quiz_title || result.quiz }}</h3>
              <span class="score" :class="getScoreClass(result.score, result.result_status)">{{ result.score }}%</span>
            </div>
            <p class="date">Taken: {{ formatDate(result.date_taken) }}</p>
            <p class="status" :class="result.result_status.toLowerCase()">
              {{ result.result_status }}
            </p>
          </div>
        </div>
      </div>

      <!-- Line Chart -->
      <div v-if="activeTab === 'chart'" class="chart-tab">
        <div class="chart-filters">
          <label>
            <input type="radio" value="exams" v-model="chartType" /> Exams
          </label>
          <label>
            <input type="radio" value="quizzes" v-model="chartType" /> Quizzes
          </label>
          <select v-model="selectedFilterId" v-if="filterOptions.length">
            <option value="">All</option>
            <option v-for="opt in filterOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="chart-container">
          <canvas ref="chartCanvas"></canvas>
        </div>
        <p v-if="!chartData.length" class="empty">No data to display</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { examService, type UserExamResult } from '@/services/exam.service';
import { quizService, type UserQuizResult, type Quiz } from '@/services/quiz.service';
import Chart from 'chart.js/auto';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<'exams' | 'quizzes' | 'chart'>('exams');

// Data
const examResults = ref<UserExamResult[]>([]);
const quizResults = ref<UserQuizResult[]>([]);
const loading = ref({ exams: false, quizzes: false });

// Chart related
const chartType = ref<'exams' | 'quizzes'>('exams');
const selectedFilterId = ref('');
const filterOptions = ref<{ value: string; label: string }[]>([]);
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

// Fetch data on mount
onMounted(async () => {
  await Promise.all([fetchExamResults(), fetchQuizResults()]);
});

async function fetchExamResults() {
  if (!authStore.user?.id) return;
  loading.value.exams = true;
  try {
    const results = await examService.getUserExamResults(authStore.user.id);
    // Enrich with exam titles if needed (already done in service)
    examResults.value = results;
    updateFilterOptions('exams');
  } catch (error) {
    console.error('Failed to fetch exam results:', error);
  } finally {
    loading.value.exams = false;
  }
}

async function fetchQuizResults() {
  if (!authStore.user?.id) return;
  loading.value.quizzes = true;
  try {
    const results = await quizService.getUserQuizResults(authStore.user.id);
    quizResults.value = results;
    updateFilterOptions('quizzes');
  } catch (error) {
    console.error('Failed to fetch quiz results:', error);
  } finally {
    loading.value.quizzes = false;
  }
}

function updateFilterOptions(type: 'exams' | 'quizzes') {
  if (type === 'exams') {
    const uniqueExams = new Map();
    examResults.value.forEach(r => {
      if (!uniqueExams.has(r.exam)) {
        uniqueExams.set(r.exam, r.exam_title || r.exam);
      }
    });
    filterOptions.value = Array.from(uniqueExams.entries()).map(([value, label]) => ({ value, label }));
  } else {
    const uniqueQuizzes = new Map();
    quizResults.value.forEach(r => {
      if (!uniqueQuizzes.has(r.quiz)) {
        uniqueQuizzes.set(r.quiz, r.quiz_title || r.quiz);
      }
    });
    filterOptions.value = Array.from(uniqueQuizzes.entries()).map(([value, label]) => ({ value, label }));
  }
}

// Computed chart data
const chartData = computed(() => {
  const data = chartType.value === 'exams' ? examResults.value : quizResults.value;
  let filtered = data;
  if (selectedFilterId.value) {
    filtered = data.filter(r => (r as any).exam === selectedFilterId.value || (r as any).quiz === selectedFilterId.value);
  }
  // Sort by date
  filtered = [...filtered].sort((a, b) => new Date(a.date_taken).getTime() - new Date(b.date_taken).getTime());
  return filtered.map(r => ({
    label: chartType.value === 'exams' ? (r as UserExamResult).exam_title || (r as UserExamResult).exam : (r as UserQuizResult).quiz_title || (r as UserQuizResult).quiz,
    date: new Date(r.date_taken),
    score: r.score
  }));
});

// Watch for chart type or filter change and redraw
watch([chartType, selectedFilterId, chartData], () => {
  nextTick(renderChart);
}, { deep: true });

function renderChart() {
  if (!chartCanvas.value) return;
  if (chartInstance) chartInstance.destroy();

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  const labels = chartData.value.map(d => d.date.toLocaleDateString());
  const scores = chartData.value.map(d => d.score);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: chartType.value === 'exams' ? 'Exam Scores' : 'Quiz Scores',
        data: scores,
        borderColor: '#42a5f5',
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        tension: 0.1,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          title: { display: true, text: 'Score (%)' }
        }
      }
    }
  });
}

// Helper functions
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString();
}

/**
 * How to colour a score.
 *
 * `result_status` is the authoritative verdict — app 20 stored it, and it was
 * computed against that exam's own pass mark. Re-deriving pass/fail from a
 * literal 70 here contradicted it for any exam with a different mark: a 75 on an
 * exam passed at 85 rendered green and said "pass" beside a FAILED record.
 * The bands are only the fallback, for a record with no status.
 */
function getScoreClass(score: number, status?: string) {
  const verdict = String(status || '').toUpperCase();
  if (verdict === 'PASSED') return 'pass';
  if (verdict === 'FAILED') return 'fail';
  if (score >= 70) return 'pass';
  if (score >= 50) return 'average';
  return 'fail';
}

/** What to tell the student about the certificate their pass earned. */
function certificateNote(result: any): string {
  if (String(result?.result_status || '').toUpperCase() !== 'PASSED') return '';
  if (result?.certificate_status === 'issued') return 'Certificate issued';
  if (result?.certificate_status === 'pending') return 'Certificate is being issued';
  return '';
}

function goToReview(type: 'exam' | 'quiz', resultId: string) {
  router.push(`/review-result/${type}/${resultId}`);
}

// Structural + responsive fixes shared by the eight exam-system pages.
// Imported AFTER the page stylesheet on purpose - see the header of the file.
import '@/assets/css/exam-system.css';
</script>

<style scoped src="@/assets/css/user-results.css"></style>