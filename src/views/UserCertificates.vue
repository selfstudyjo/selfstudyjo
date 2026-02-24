<template>
  <div class="user-certificates">
    <div class="header">
      <h1>My Certificates</h1>
      <p>View all your course and exam certificates</p>
    </div>

    <!-- Loading / Error / Empty states (unchanged) -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading certificates...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>Error Loading Certificates</h3>
      <p>{{ error }}</p>
      <button @click="fetchCertificates" class="retry-btn">Try Again</button>
    </div>

    <div v-else class="certificates-container">
      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'course' }"
          @click="activeTab = 'course'"
        >
          Course Certificates <span class="badge">{{ courseCertificates.length }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'exam' }"
          @click="activeTab = 'exam'"
        >
          Exam Certificates <span class="badge">{{ examCertificates.length }}</span>
        </button>
      </div>

      <!-- Search Bar -->
      <div class="search-container" v-if="activeTabCertificates.length > 0">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            v-model="searchQuery"
            :placeholder="'Search ' + (activeTab === 'course' ? 'course' : 'exam') + ' certificates...'"
            class="search-input"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="search-clear"
            aria-label="Clear search"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Active Tab Content -->
      <section class="certificates-section" v-if="activeTab === 'course'">
        <div class="section-header">
          <h2>Course Certificates</h2>
          <span class="badge">{{ filteredCourseCertificates.length }}</span>
        </div>

        <div v-if="filteredCourseCertificates.length === 0" class="empty-state">
          <div class="empty-icon">📜</div>
          <h3>No Course Certificates Found</h3>
          <p v-if="searchQuery">Try adjusting your search</p>
          <p v-else>Complete courses to earn certificates</p>
        </div>

        <div v-else class="certificates-grid">
          <div
            v-for="certificate in filteredCourseCertificates"
            :key="certificate.certificate_id"
            class="certificate-card"
            @click="viewCertificate(certificate.certificate_id, 'course')"
          >
            <!-- certificate card content unchanged -->
            <div class="certificate-header">
              <div class="certificate-icon course">🎓</div>
              <div class="certificate-info">
                <h3>{{ getCourseName(certificate.course_id) }}</h3>
                <p class="certificate-id">ID: {{ certificate.certificate_id.slice(0, 8) }}...</p>
              </div>
            </div>
            <div class="certificate-details">
              <div class="detail-item">
                <span class="label">Completion Date:</span>
                <span class="value">{{ formatDate(certificate.date) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Hours Completed:</span>
                <span class="value">{{ certificate.hours }} hours</span>
              </div>
              <div class="detail-item">
                <span class="label">Status:</span>
                <span class="status-badge valid">Valid</span>
              </div>
            </div>
            <div class="certificate-actions">
              <button class="view-btn">View Details</button>
            </div>
          </div>
        </div>
      </section>

      <section class="certificates-section" v-else>
        <div class="section-header">
          <h2>Exam Certificates</h2>
          <span class="badge">{{ filteredExamCertificates.length }}</span>
        </div>

        <div v-if="filteredExamCertificates.length === 0" class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>No Exam Certificates Found</h3>
          <p v-if="searchQuery">Try adjusting your search</p>
          <p v-else>Pass exams to earn certificates</p>
        </div>

        <div v-else class="certificates-grid">
          <div
            v-for="certificate in filteredExamCertificates"
            :key="certificate.certificate_id"
            class="certificate-card"
            @click="viewCertificate(certificate.certificate_id, 'exam')"
          >
            <div class="certificate-header">
              <div class="certificate-icon exam" :class="{ expired: !certificate.is_valid }">
                📝
              </div>
              <div class="certificate-info">
                <h3>{{ getExamName(certificate.exam_id) }}</h3>
                <p class="certificate-id">ID: {{ certificate.certificate_id.slice(0, 8) }}...</p>
              </div>
            </div>
            <div class="certificate-details">
              <div class="detail-item">
                <span class="label">Taken Date:</span>
                <span class="value">{{ formatDate(certificate.taken_date) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Expiry Date:</span>
                <span class="value">{{ formatDate(certificate.expire_date) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Status:</span>
                <span class="status-badge" :class="{ valid: certificate.is_valid, expired: !certificate.is_valid }">
                  {{ certificate.is_valid ? 'Valid' : 'Expired' }}
                </span>
              </div>
            </div>
            <div class="certificate-actions">
              <button class="view-btn">View Details</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { certificateService } from '@/services/certificate.service';
import { courseService } from '@/services/course.service';
import { examService } from '@/services/exam.service';

import '@/assets/css/user-certificates.css';

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(true);
const error = ref<string | null>(null);

const courseCertificates = ref<any[]>([]);
const examCertificates = ref<any[]>([]);
const coursesMap = ref<Map<string, string>>(new Map());
const examsMap = ref<Map<string, string>>(new Map());

const userId = computed(() => authStore.user?.id);

// Tabs and search
const activeTab = ref<'course' | 'exam'>('course');
const searchQuery = ref('');

const filteredCourseCertificates = computed(() => {
  if (!searchQuery.value) return courseCertificates.value;
  const q = searchQuery.value.toLowerCase();
  return courseCertificates.value.filter(cert => {
    const name = getCourseName(cert.course_id).toLowerCase();
    const id = cert.certificate_id.toLowerCase();
    return name.includes(q) || id.includes(q);
  });
});

const filteredExamCertificates = computed(() => {
  if (!searchQuery.value) return examCertificates.value;
  const q = searchQuery.value.toLowerCase();
  return examCertificates.value.filter(cert => {
    const name = getExamName(cert.exam_id).toLowerCase();
    const id = cert.certificate_id.toLowerCase();
    return name.includes(q) || id.includes(q);
  });
});

// Helper for active tab certificates count (used to hide search when empty)
const activeTabCertificates = computed(() =>
  activeTab.value === 'course' ? courseCertificates.value : examCertificates.value
);

// Rest of the script unchanged...
const fetchCertificates = async () => {
  if (!userId.value) {
    error.value = 'User not authenticated';
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    error.value = null;

    const certificates = await certificateService.getUserCertificates(userId.value);
    courseCertificates.value = certificates.course_certificates || [];
    examCertificates.value = certificates.exam_certificates || [];

    const courseIds = Array.from(new Set(courseCertificates.value.map(c => c.course_id)));
    await fetchCourseNames(courseIds);

    const examIds = Array.from(new Set(examCertificates.value.map(c => c.exam_id)));
    await fetchExamNames(examIds);
  } catch (err: any) {
    console.error('Failed to fetch certificates:', err);
    error.value = err.message || 'Failed to load certificates';
  } finally {
    loading.value = false;
  }
};

const fetchCourseNames = async (courseIds: string[]) => {
  for (const courseId of courseIds) {
    try {
      const course = await courseService.getCourse(courseId);
      coursesMap.value.set(courseId, course.title);
    } catch (err) {
      coursesMap.value.set(courseId, `Course: ${courseId.slice(0, 8)}...`);
    }
  }
};

const fetchExamNames = async (examIds: string[]) => {
  for (const examId of examIds) {
    try {
      const exam = await examService.getExam(examId);
      examsMap.value.set(examId, exam.title);
    } catch (err) {
      examsMap.value.set(examId, `Exam: ${examId.slice(0, 8)}...`);
    }
  }
};

const getCourseName = (courseId: string): string => {
  return coursesMap.value.get(courseId) || `Course: ${courseId.slice(0, 8)}...`;
};

const getExamName = (examId: string): string => {
  return examsMap.value.get(examId) || `Exam: ${examId.slice(0, 8)}...`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const viewCertificate = (certificateId: string, type: 'course' | 'exam') => {
  router.push(`/certificate/${certificateId}?type=${type}`);
};

onMounted(() => {
  fetchCertificates();
});
</script>