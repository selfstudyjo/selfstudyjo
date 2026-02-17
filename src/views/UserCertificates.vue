<template>
  <div class="user-certificates">
    <div class="header">
      <h1>My Certificates</h1>
      <p>View all your course and exam certificates</p>
    </div>

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
      <!-- Course Certificates Section -->
      <section class="certificates-section">
        <div class="section-header">
          <h2>Course Certificates</h2>
          <span class="badge">{{ courseCertificates.length }}</span>
        </div>

        <div v-if="courseCertificates.length === 0" class="empty-state">
          <div class="empty-icon">📜</div>
          <h3>No Course Certificates Yet</h3>
          <p>Complete courses to earn certificates</p>
        </div>

        <div v-else class="certificates-grid">
          <div
            v-for="certificate in courseCertificates"
            :key="certificate.certificate_id"
            class="certificate-card"
            @click="viewCertificate(certificate.certificate_id, 'course')"
          >
            <div class="certificate-header">
              <div class="certificate-icon course">
                🎓
              </div>
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

      <!-- Exam Certificates Section -->
      <section class="certificates-section">
        <div class="section-header">
          <h2>Exam Certificates</h2>
          <span class="badge">{{ examCertificates.length }}</span>
        </div>

        <div v-if="examCertificates.length === 0" class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>No Exam Certificates Yet</h3>
          <p>Pass exams to earn certificates</p>
        </div>

        <div v-else class="certificates-grid">
          <div
            v-for="certificate in examCertificates"
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

// Import the CSS file
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

const fetchCertificates = async () => {
  if (!userId.value) {
    error.value = 'User not authenticated';
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    error.value = null;

    // Fetch user certificates
    const certificates = await certificateService.getUserCertificates(userId.value);
    courseCertificates.value = certificates.course_certificates || [];
    examCertificates.value = certificates.exam_certificates || [];

    // Fetch course names
    const courseIds = Array.from(new Set(courseCertificates.value.map(c => c.course_id)));
    await fetchCourseNames(courseIds);

    // Fetch exam names
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
  try {
    for (const courseId of courseIds) {
      try {
        const course = await courseService.getCourse(courseId);
        coursesMap.value.set(courseId, course.title);
      } catch (err) {
        console.warn(`Failed to fetch course ${courseId}:`, err);
        coursesMap.value.set(courseId, `Course: ${courseId.slice(0, 8)}...`);
      }
    }
  } catch (err) {
    console.error('Failed to fetch course names:', err);
  }
};

const fetchExamNames = async (examIds: string[]) => {
  try {
    for (const examId of examIds) {
      try {
        const exam = await examService.getExam(examId);
        examsMap.value.set(examId, exam.title);
      } catch (err) {
        console.warn(`Failed to fetch exam ${examId}:`, err);
        examsMap.value.set(examId, `Exam: ${examId.slice(0, 8)}...`);
      }
    }
  } catch (err) {
    console.error('Failed to fetch exam names:', err);
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
