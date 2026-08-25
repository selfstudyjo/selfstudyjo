<template>
  <div class="home-container">
    <!-- Welcome Header -->
    <div class="welcome-header glass-effect">
      <div class="header-content">
        <h1>{{ $t('Welcome back, {v0}!', { v0: username }) }}</h1>
        <p class="subtitle">{{ $t('Track your learning progress and achievements') }}</p>
      </div>
      <div class="stats-badge">
        <span class="badge-count">{{ registeredCoursesCount }}</span>
        <span class="badge-label">{{ $t('Courses') }}</span>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="main-grid">
      <!-- Registered Courses Section -->
      <div class="dashboard-card glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon course-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <h2>{{ $t('My Courses') }}</h2>
            <span class="card-count">{{ registeredCoursesCount }}</span>
          </div>
          <p class="card-subtitle">{{ $t('Courses you\'re currently enrolled in') }}</p>
        </div>
        
        <div class="courses-list">
          <div v-if="loading.courses" class="loading-placeholder">
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
          </div>
          <div v-else-if="registeredCourses.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="#94A3B8" stroke-width="1.5"/>
              </svg>
            </div>
            <p class="empty-text">{{ $t('No courses enrolled yet') }}</p>
            <router-link to="/courses" class="empty-action">{{ $t('Browse Courses') }}</router-link>
          </div>
          <div v-else>
            <router-link 
              v-for="course in registeredCourses" 
              :key="course.course_external_id" 
              :to="`/course/${course.course_external_id || course.course}`"
              class="course-item-link"
            >
              <div class="course-item">
                <div class="course-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div class="course-info">
                  <h3 class="course-title">{{ courseDetails[course.course_external_id || course.course]?.title || 'Loading...' }}</h3>
                  <p class="course-date">{{ $t('Registered: {v0}', { v0: formatDate(course.date_registered) }) }}</p>
                </div>
                <div class="course-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Certificates Section -->
      <div class="dashboard-card glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon certificate-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10M12 2C13.3132 2 14.6136 2.25866 15.8268 2.7612C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893C19.9997 5.85752 20.7362 6.95991 21.2388 8.17317C21.7413 9.38642 22 10.6868 22 12C22 13.3132 21.7413 14.6136 21.2388 15.8268C20.7362 17.0401 19.9997 18.1425 19.0711 19.0711C18.1425 19.9997 17.0401 20.7362 15.8268 21.2388C14.6136 21.7413 13.3132 22 12 22C10.6868 22 9.38642 21.7413 8.17317 21.2388C6.95991 20.7362 5.85752 19.9997 4.92893 19.0711C4.00035 18.1425 3.26375 17.0401 2.7612 15.8268C2.25866 14.6136 2 13.3132 2 12C2 9.34784 3.05357 6.8043 4.92893 4.92893C6.8043 3.05357 9.34784 2 12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2>{{ $t('Certificates') }}</h2>
            <span class="card-count">{{ totalCertificatesCount }}</span>
          </div>
          <p class="card-subtitle">{{ $t('Your earned certificates') }}</p>
        </div>
        
        <div class="certificates-grid">
          <!-- Exam Certificates -->
          <div class="certificate-section">
            <h3 class="section-title">{{ $t('Exam Certificates') }}</h3>
            <div v-if="loading.examCertificates" class="loading-placeholder">
              <div class="placeholder-item small"></div>
              <div class="placeholder-item small"></div>
            </div>
            <div v-else-if="examCertificates.length === 0" class="empty-state small">
              <p class="empty-text">{{ $t('No exam certificates yet') }}</p>
            </div>
            <div v-else class="certificate-list">
              <router-link 
                v-for="cert in examCertificates.slice(0, 3)" 
                :key="cert.certificate_id" 
                :to="{
                  path: `/certificate/${cert.certificate_id}`,
                  query: { type: 'exam' }
                }"
                class="certificate-item-link"
              >
                <div class="certificate-item">
                  <div class="certificate-icon exam">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12L11 14L15 10M12 2C13.3132 2 14.6136 2.25866 15.8268 2.7612C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893C19.9997 5.85752 20.7362 6.95991 21.2388 8.17317C21.7413 9.38642 22 10.6868 22 12C22 13.3132 21.7413 14.6136 21.2388 15.8268C20.7362 17.0401 19.9997 18.1425 19.0711 19.0711C18.1425 19.9997 17.0401 20.7362 15.8268 21.2388C14.6136 21.7413 13.3132 22 12 22C10.6868 22 9.38642 21.7413 8.17317 21.2388C6.95991 20.7362 5.85752 19.9997 4.92893 19.0711C4.00035 18.1425 3.26375 17.0401 2.7612 15.8268C2.25866 14.6136 2 13.3132 2 12C2 9.34784 3.05357 6.8043 4.92893 4.92893C6.8043 3.05357 9.34784 2 12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="certificate-info">
                    <h4 class="certificate-title">{{ examCertificateDetails[cert.exam_id]?.title || cert.exam_id || 'Exam Certificate' }}</h4>
                    <div class="certificate-meta">
                      <span class="certificate-date">{{ formatDate(cert.taken_date) }}</span>
                      <span class="certificate-status" :class="{ valid: cert.is_valid }">
                        {{ cert.is_valid ? 'Valid' : 'Expired' }}
                      </span>
                    </div>
                  </div>
                  <div class="certificate-arrow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>
              </router-link>
            </div>
          </div>

          <!-- Course Certificates -->
          <div class="certificate-section">
            <h3 class="section-title">{{ $t('Course Certificates') }}</h3>
            <div v-if="loading.courseCertificates" class="loading-placeholder">
              <div class="placeholder-item small"></div>
              <div class="placeholder-item small"></div>
            </div>
            <div v-else-if="courseCertificates.length === 0" class="empty-state small">
              <p class="empty-text">{{ $t('No course certificates yet') }}</p>
            </div>
            <div v-else class="certificate-list">
              <router-link 
                v-for="cert in courseCertificates.slice(0, 3)" 
                :key="cert.certificate_id" 
                :to="{
                  path: `/certificate/${cert.certificate_id}`,
                  query: { type: 'course' }
                }"
                class="certificate-item-link"
              >
                <div class="certificate-item">
                  <div class="certificate-icon course">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </div>
                  <div class="certificate-info">
                    <h4 class="certificate-title">{{ courseDetails[cert.course_id]?.title || cert.course_id || 'Course Certificate' }}</h4>
                    <div class="certificate-meta">
                      <span class="certificate-date">{{ formatDate(cert.date) }}</span>
                      <span class="certificate-hours">{{ cert.hours }}h</span>
                    </div>
                  </div>
                  <div class="certificate-arrow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Quiz Results Section -->
      <div class="dashboard-card glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon quiz-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M8.5 12.5L10.5 14.5L15.5 9.5M12 3C13.1819 3 14.3522 3.23279 15.4442 3.68508C16.5361 4.13738 17.5282 4.80031 18.364 5.63604C19.1997 6.47177 19.8626 7.46392 20.3149 8.55585C20.7672 9.64778 21 10.8181 21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5282 18.364 18.364C17.5282 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47177 19.1997 5.63604 18.364C4.80031 17.5282 4.13738 16.5361 3.68508 15.4442C3.23279 14.3522 3 13.1819 3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2>{{ $t('Quiz Results') }}</h2>
            <span class="card-count">{{ quizResults.length }}</span>
          </div>
          <p class="card-subtitle">{{ $t('Your recent quiz performance') }}</p>
        </div>
        
        <div class="quiz-results">
          <div v-if="loading.quizResults" class="loading-placeholder">
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
          </div>
          <div v-else-if="quizResults.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M8.5 12.5L10.5 14.5L15.5 9.5M12 3C13.1819 3 14.3522 3.23279 15.4442 3.68508C16.5361 4.13738 17.5282 4.80031 18.364 5.63604C19.1997 6.47177 19.8626 7.46392 20.3149 8.55585C20.7672 9.64778 21 10.8181 21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5282 18.364 18.364C17.5282 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47177 19.1997 5.63604 18.364C4.80031 17.5282 4.13738 16.5361 3.68508 15.4442C3.23279 14.3522 3 13.1819 3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3Z" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <p class="empty-text">{{ $t('No quiz results yet') }}</p>
          </div>
          <div v-else>
            <div v-for="quiz in quizResults.slice(0, 5)" :key="quiz.external_id" class="quiz-item">
              <div class="quiz-score" :class="getScoreClass(quiz.score)">
                <span class="score-value">{{ quiz.score }}%</span>
              </div>
              <div class="quiz-info">
                <h3 class="quiz-title">{{ quizDetails[quiz.quiz]?.quizTitle || 'Untitled Quiz' }}</h3>
                <div class="quiz-meta">
                  <span class="quiz-course">{{ quizDetails[quiz.quiz]?.courseTitle || 'Unknown Course' }}</span>
                  <span class="quiz-lesson">{{ quizDetails[quiz.quiz]?.lessonTitle || 'Unknown Lesson' }}</span>
                </div>
                <div class="quiz-footer">
                  <span class="quiz-status" :class="{ passed: quiz.result_status === 'PASSED' }">
                    {{ quiz.result_status }}
                  </span>
                  <span class="quiz-date">{{ formatDate(quiz.date_taken) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Homeworks Section -->
      <div class="dashboard-card glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon homework-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 14L12 20M9 21H15M19 13C19 15.2091 17.2091 17 15 17H9C6.79086 17 5 15.2091 5 13V7C5 4.79086 6.79086 3 9 3H15C17.2091 3 19 4.79086 19 7V13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <h2>{{ $t('Assigned Homeworks') }}</h2>
            <span class="card-count">{{ totalHomeworksCount }}</span>
          </div>
          <p class="card-subtitle">{{ $t('Homework for your enrolled courses') }}</p>
        </div>
        
        <div class="homeworks-list">
          <div v-if="loading.homeworks" class="loading-placeholder">
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
          </div>
          <div v-else-if="homeworks.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 14L12 20M9 21H15M19 13C19 15.2091 17.2091 17 15 17H9C6.79086 17 5 15.2091 5 13V7C5 4.79086 6.79086 3 9 3H15C17.2091 3 19 4.79086 19 7V13Z" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="empty-text">{{ $t('No homeworks assigned') }}</p>
          </div>
          <div v-else>
            <router-link 
              v-for="homework in homeworks.slice(0, 5)" 
              :key="homework.external_homework_id" 
              :to="{
                path: `/course/${homework.course_external_id || 'unknown'}/lesson/${homework.lesson_external_id || 'unknown'}/homework`,
                query: { homeworkId: homework.external_homework_id }
              }"
              class="homework-item-link"
            >
              <div class="homework-item">
                <div class="homework-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 14L12 20M9 21H15M19 13C19 15.2091 17.2091 17 15 17H9C6.79086 17 5 15.2091 5 13V7C5 4.79086 6.79086 3 9 3H15C17.2091 3 19 4.79086 19 7V13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="homework-info">
                  <h3 class="homework-title">{{ homework.title || 'Untitled Homework' }}</h3>
                  <p class="homework-description">{{ truncateText(homework.description, 60) }}</p>
                  <div class="homework-meta">
                    <span class="homework-course">{{ homeworkDetails[homework.external_homework_id]?.courseTitle || homework.course_external_id || 'Unknown Course' }}</span>
                    <span class="homework-lesson">{{ homeworkDetails[homework.external_homework_id]?.lessonTitle || homework.lesson_external_id || 'Unknown Lesson' }}</span>
                  </div>
                </div>
                <div class="homework-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Active Subscriptions Section -->
      <div class="dashboard-card glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon subscription-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
                <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2>{{ $t('Active Subscriptions') }}</h2>
            <span class="card-status" :class="{ active: activeSubscriptions.length > 0 }">
              {{ activeSubscriptions.length > 0 ? `${activeSubscriptions.length} Active` : 'None' }}
            </span>
          </div>
          <p class="card-subtitle">
            {{ $t('All your currently active subscription plans') }}
            <span v-if="combinedFeaturesCount > 0" class="combined-features-hint">
              {{ $t('· {v0} combined feature{v1}', { v0: combinedFeaturesCount, v1: combinedFeaturesCount > 1 ? 's' : '' }) }}
            </span>
          </p>
        </div>
        
        <div class="subscription-content">
          <div v-if="loading.subscription" class="loading-placeholder">
            <div class="placeholder-item"></div>
          </div>
          <div v-else-if="activeSubscriptions.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="#94A3B8" stroke-width="1.5"/>
              </svg>
            </div>
            <p class="empty-text">{{ $t('No active subscription') }}</p>
            <router-link to="/plans" class="empty-action">{{ $t('View Plans') }}</router-link>
          </div>
          <div v-else class="active-subscriptions-list">
            <div
              v-for="sub in activeSubscriptions"
              :key="sub.external_id"
              class="subscription-details"
            >
              <div class="subscription-plan">
                <h3 class="plan-title">{{ sub.subscription_type?.title || 'Unknown Plan' }}</h3>
                <div class="plan-price">
                  <span class="price-amount">{{ sub.subscription_type?.price || 'Free' }}</span>
                  <span class="price-period">/year</span>
                </div>
                <p class="plan-description">{{ sub.subscription_type?.description || '' }}</p>
              </div>

              <div class="subscription-features">
                <h4 class="features-title">
                  {{ $t('Features included') }}
                  <span v-if="sub.subscription_type?.features?.length" class="features-count">
                    ({{ sub.subscription_type.features.length }})
                  </span>
                </h4>
                <div class="features-list">
                  <div
                    v-for="feature in (sub.subscription_type?.features || [])"
                    :key="feature.external_id"
                    class="feature-item"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12L11 14L15 10" stroke="#48BB78" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>{{ feature.name }}</span>
                  </div>
                  <div
                    v-if="!sub.subscription_type?.features || sub.subscription_type.features.length === 0"
                    class="feature-item feature-empty"
                  >
                    <span>{{ $t('No features attached to this plan') }}</span>
                  </div>
                </div>
              </div>

              <div class="subscription-meta">
                <div class="meta-item">
                  <span class="meta-label">{{ $t('Plan Name') }}</span>
                  <span class="meta-value">{{ sub.title }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">{{ $t('Expires') }}</span>
                  <span class="meta-value">{{ formatDate(sub.expire_date) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import { courseService, type CourseRegistration, type Homework, type Course } from '@/services/course.service';
import { certificateService, type ExamCertificate, type CourseCertificate } from '@/services/certificate.service';
import { quizService, type UserQuizResult } from '@/services/quiz.service';
import { subscriptionService, type Subscription } from '@/services/subscription.service';
import { examService, type Exam } from '@/services/exam.service';

const authStore = useAuthStore();

// Reactive data
const registeredCourses = ref<CourseRegistration[]>([]);
const examCertificates = ref<ExamCertificate[]>([]);
const courseCertificates = ref<CourseCertificate[]>([]);
const quizResults = ref<UserQuizResult[]>([]);
const homeworks = ref<Homework[]>([]);

// CHANGED: now an array of ALL non-expired active subscriptions
const activeSubscriptions = ref<Subscription[]>([]);

// Additional details storage
const courseDetails = ref<Record<string, Course>>({});
const examCertificateDetails = ref<Record<string, Exam>>({});
const quizDetails = ref<Record<string, {
  quizTitle: string;
  courseTitle: string;
  lessonTitle: string;
}>>({});
const homeworkDetails = ref<Record<string, {
  courseTitle: string;
  lessonTitle: string;
}>>({});

// Loading states
const loading = ref({
  courses: true,
  examCertificates: true,
  courseCertificates: true,
  quizResults: true,
  homeworks: true,
  subscription: true,
});

// Computed properties
const username = computed(() => {
  return authStore.user?.username || 'Student';
});

const registeredCoursesCount = computed(() => registeredCourses.value.length);
const totalCertificatesCount = computed(() => examCertificates.value.length + courseCertificates.value.length);
const totalHomeworksCount = computed(() => homeworks.value.length);

// Union count of feature names across all active subscriptions
const combinedFeaturesCount = computed(() => {
  const set = new Set<string>();
  for (const sub of activeSubscriptions.value) {
    for (const f of (sub.subscription_type?.features || [])) {
      if (f?.name) set.add(f.name);
    }
  }
  return set.size;
});

// Helper functions
const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const truncateText = (text: string, maxLength: number): string => {
  if (!text) return 'No description';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

const getScoreClass = (score: number): string => {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'average';
  return 'poor';
};

// Fetch data functions
const fetchRegisteredCourses = async () => {
  try {
    loading.value.courses = true;
    if (authStore.user?.id) {
      registeredCourses.value = await courseService.getUserRegistrations(authStore.user.id);
      
      for (const registration of registeredCourses.value) {
        const courseId = registration.course_external_id || registration.course;
        if (courseId) {
          try {
            const course = await courseService.getCourse(courseId);
            courseDetails.value[courseId] = course;
          } catch (error) {
            console.error(`Failed to fetch course details for ${courseId}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch registered courses:', error);
    registeredCourses.value = [];
  } finally {
    loading.value.courses = false;
  }
};

const fetchCertificates = async () => {
  try {
    loading.value.examCertificates = true;
    loading.value.courseCertificates = true;
    
    if (authStore.user?.id) {
      const [examCerts, courseCerts] = await Promise.all([
        certificateService.getExamCertificates({ user_id: authStore.user.id }),
        certificateService.getCourseCertificates({ user_id: authStore.user.id })
      ]);
      
      examCertificates.value = examCerts;
      courseCertificates.value = courseCerts;
      
      for (const cert of examCerts) {
        if (cert.exam_id) {
          try {
            const exam = await examService.getExam(cert.exam_id);
            examCertificateDetails.value[cert.exam_id] = exam;
          } catch (error) {
            console.error(`Failed to fetch exam details for ${cert.exam_id}:`, error);
          }
        }
      }
      
      for (const cert of courseCerts) {
        if (cert.course_id) {
          try {
            const course = await courseService.getCourse(cert.course_id);
            courseDetails.value[cert.course_id] = course;
          } catch (error) {
            console.error(`Failed to fetch course details for ${cert.course_id}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch certificates:', error);
    examCertificates.value = [];
    courseCertificates.value = [];
  } finally {
    loading.value.examCertificates = false;
    loading.value.courseCertificates = false;
  }
};

const fetchQuizResults = async () => {
  try {
    loading.value.quizResults = true;
    if (authStore.user?.id) {
      const results = await quizService.getUserQuizResults(authStore.user.id);
      quizResults.value = results;
      
      for (const result of results) {
        if (result.quiz) {
          try {
            const quiz = await quizService.getQuiz(result.quiz);
            let courseTitle = 'Unknown Course';
            let lessonTitle = 'Unknown Lesson';
            
            if (quiz.course_id) {
              try {
                const course = await courseService.getCourse(quiz.course_id);
                courseTitle = course.title;
              } catch (error) {
                console.error(`Failed to fetch course for quiz ${result.quiz}:`, error);
              }
            }
            
            if (quiz.lesson_id) {
              try {
                const lesson = await courseService.getLesson(quiz.lesson_id);
                lessonTitle = lesson.title;
              } catch (error) {
                console.error(`Failed to fetch lesson for quiz ${result.quiz}:`, error);
              }
            }
            
            quizDetails.value[result.quiz] = {
              quizTitle: quiz.title,
              courseTitle,
              lessonTitle
            };
          } catch (error) {
            console.error(`Failed to fetch quiz details for ${result.quiz}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch quiz results:', error);
    quizResults.value = [];
  } finally {
    loading.value.quizResults = false;
  }
};

const fetchHomeworks = async () => {
  try {
    loading.value.homeworks = true;
    if (authStore.user?.id && registeredCourses.value.length > 0) {
      const allHomeworks: Homework[] = [];
      
      for (const registration of registeredCourses.value) {
        try {
          const courseId = registration.course_external_id || registration.course;
          const lessons = await courseService.getCourseLessons(courseId);
          
          for (const lesson of lessons) {
            if (lesson.external_lesson_id) {
              const lessonHomeworks = await courseService.getLessonHomeworks(lesson.external_lesson_id);
              for (const hw of lessonHomeworks) {
                allHomeworks.push({
                  ...hw,
                  course_external_id: courseId,
                  lesson_external_id: lesson.external_lesson_id
                });
                
                try {
                  const course = await courseService.getCourse(courseId);
                  const lessonDetail = await courseService.getLesson(lesson.external_lesson_id);
                  
                  homeworkDetails.value[hw.external_homework_id] = {
                    courseTitle: course.title,
                    lessonTitle: lessonDetail.title
                  };
                } catch (error) {
                  console.error(`Failed to fetch details for homework ${hw.external_homework_id}:`, error);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Failed to fetch homeworks for course ${registration.course_external_id}:`, error);
        }
      }
      
      homeworks.value = allHomeworks;
    }
  } catch (error) {
    console.error('Failed to fetch homeworks:', error);
    homeworks.value = [];
  } finally {
    loading.value.homeworks = false;
  }
};

/**
 * Fetch ALL non-expired active subscriptions, not just the selected one.
 * This way the Home page reflects every plan currently giving the user features.
 */
const fetchActiveSubscriptions = async () => {
  try {
    loading.value.subscription = true;
    if (authStore.user?.id) {
      activeSubscriptions.value = await subscriptionService.getUsableSubscriptions(authStore.user.id);
    } else {
      activeSubscriptions.value = [];
    }
  } catch (error) {
    console.error('Failed to fetch active subscriptions:', error);
    activeSubscriptions.value = [];
  } finally {
    loading.value.subscription = false;
  }
};

// Initialize data fetching
const initializeData = async () => {
  await Promise.all([
    fetchRegisteredCourses(),
    fetchCertificates(),
    fetchQuizResults(),
    fetchActiveSubscriptions(),
  ]);
  
  if (registeredCourses.value.length > 0) {
    await fetchHomeworks();
  }
};

onMounted(async () => {
  await authStore.checkAuth();
  
  if (authStore.isAuthenticated) {
    await initializeData();
  }
});
</script>

<style scoped src="@/assets/css/home.css"></style>

<style scoped>
/* Minimal additions for multi-subscription rendering — does not override existing design */
.active-subscriptions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.active-subscriptions-list .subscription-details + .subscription-details {
  border-top: 1px dashed rgb(var(--sfs-accent-rgb, 148 163 184) / 0.4);
  padding-top: 16px;
}

.features-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--sfs-accent-text, #64748b);
  margin-inline-start: 4px;
}

.feature-empty {
  color: var(--sfs-accent-text, #94a3b8);
  font-style: italic;
}

.combined-features-hint {
  color: var(--sfs-accent-text, #64748b);
  font-size: 12px;
  margin-inline-start: 4px;
}
</style>