<template>
  <div class="all-certificates">
    <div class="header">
      <h1>All Certificates</h1>
      <p>Browse all course and exam certificates</p>
    </div>

    <div class="tabs-container">
      <div class="tabs">
        <button
          :class="['tab', { active: activeTab === 'exams' }]"
          @click="activeTab = 'exams'"
        >
          Exam Certificates
          <span class="tab-badge">{{ examCertificates.length }}</span>
        </button>
        <button
          :class="['tab', { active: activeTab === 'courses' }]"
          @click="activeTab = 'courses'"
        >
          Course Certificates
          <span class="tab-badge">{{ courseCertificates.length }}</span>
        </button>
      </div>
    </div>

    <div class="filters">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by user, course, exam..."
          class="search-input"
        />
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="search-icon">
          <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3C5.91 3 3 5.91 3 9.5C3 13.09 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5C5 7.01 7.01 5 9.5 5C11.99 5 14 7.01 14 9.5C14 11.99 11.99 14 9.5 14Z" fill="#718096"/>
        </svg>
      </div>

      <div class="filter-controls">
        <select v-model="statusFilter" class="filter-select">
          <option value="">All Status</option>
          <option value="valid">Valid</option>
          <option value="expired">Expired</option>
        </select>
        <select v-model="sortBy" class="filter-select">
          <option value="date">Sort by Date</option>
          <option value="user">Sort by User</option>
        </select>
        <div class="view-toggle">
          <button
            :class="['view-btn', { active: viewMode === 'grid' }]"
            @click="viewMode = 'grid'"
            title="Grid view"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="5" height="5" fill="currentColor"/>
              <rect x="4" y="10" width="5" height="5" fill="currentColor"/>
              <rect x="4" y="16" width="5" height="5" fill="currentColor"/>
              <rect x="10" y="4" width="5" height="5" fill="currentColor"/>
              <rect x="10" y="10" width="5" height="5" fill="currentColor"/>
              <rect x="10" y="16" width="5" height="5" fill="currentColor"/>
              <rect x="16" y="4" width="5" height="5" fill="currentColor"/>
              <rect x="16" y="10" width="5" height="5" fill="currentColor"/>
              <rect x="16" y="16" width="5" height="5" fill="currentColor"/>
            </svg>
          </button>
          <button
            :class="['view-btn', { active: viewMode === 'list' }]"
            @click="viewMode = 'list'"
            title="List view"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="16" height="3" fill="currentColor"/>
              <rect x="4" y="9" width="16" height="3" fill="currentColor"/>
              <rect x="4" y="14" width="16" height="3" fill="currentColor"/>
              <rect x="4" y="19" width="16" height="3" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading certificates...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>Error Loading Certificates</h3>
      <p>{{ error }}</p>
      <button @click="fetchAllCertificates" class="retry-btn">Try Again</button>
    </div>

    <div v-else class="certificates-container">
      <!-- Exam Certificates Tab -->
      <div v-if="activeTab === 'exams'" class="tab-content">
        <div v-if="filteredExamCertificates.length === 0" class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>No Exam Certificates Found</h3>
          <p v-if="searchQuery">Try adjusting your search criteria</p>
          <p v-else>No exam certificates have been issued yet</p>
        </div>

        <!-- List View -->
        <div v-else-if="viewMode === 'list'" class="certificates-table">
          <div class="table-header">
            <div class="header-cell user">User</div>
            <div class="header-cell exam">Exam</div>
            <div class="header-cell date">Taken Date</div>
            <div class="header-cell expiry">Expiry Date</div>
            <div class="header-cell status">Status</div>
            <div class="header-cell actions">Actions</div>
          </div>

          <div class="table-body">
            <div
              v-for="certificate in filteredExamCertificates"
              :key="certificate.certificate_id"
              class="table-row"
            >
              <div class="table-cell user">
                <div class="user-cell">
                  <div class="user-avatar-small">
                    <img
                      v-if="getCertUserImage(certificate) && !avatarErrors[certificate.certificate_id]"
                      :src="getProxiedImageUrl(getCertUserImage(certificate))"
                      alt="User Avatar"
                      class="avatar-image-small"
                      @error="handleAvatarError(certificate.certificate_id)"
                    />
                    <div v-else class="avatar-fallback-small">
                      {{ getUserInitialsFromCert(certificate) }}
                    </div>
                  </div>
                  <div class="user-info-small">
                    <span class="username">{{ getCertUserName(certificate) }}</span>
                    <span class="user-id">{{ certificate.user_id.slice(0, 8) }}...</span>
                  </div>
                </div>
              </div>

              <div class="table-cell exam">
                <span class="exam-name">{{ getExamNameFromCert(certificate) }}</span>
              </div>

              <div class="table-cell date">
                {{ formatDate(certificate.taken_date) }}
              </div>

              <div class="table-cell expiry">
                {{ formatDate(certificate.expire_date) }}
              </div>

              <div class="table-cell status">
                <span class="status-badge" :class="{ valid: isExamValid(certificate), expired: !isExamValid(certificate) }">
                  {{ isExamValid(certificate) ? 'Valid' : 'Expired' }}
                </span>
              </div>

              <div class="table-cell actions">
                <button
                  @click="viewCertificate(certificate.certificate_id, 'exam')"
                  class="action-btn view"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          <div class="table-footer">
            <div class="pagination">
              <button
                :disabled="currentPage === 1"
                @click="currentPage--"
                class="pagination-btn"
              >
                Previous
              </button>
              <span class="page-info">
                Page {{ currentPage }} of {{ totalPages }}
              </span>
              <button
                :disabled="currentPage === totalPages"
                @click="currentPage++"
                class="pagination-btn"
              >
                Next
              </button>
            </div>
            <div class="total-count">
              Showing {{ filteredExamCertificates.length }} of {{ examCertificates.length }} certificates
            </div>
          </div>
        </div>

        <!-- Grid View -->
        <div v-else class="certificates-grid">
          <div
            v-for="certificate in filteredExamCertificates"
            :key="certificate.certificate_id"
            class="certificate-card"
          >
            <div class="card-header">
              <div class="user-avatar">
                <img
                  v-if="getCertUserImage(certificate) && !avatarErrors[certificate.certificate_id]"
                  :src="getProxiedImageUrl(getCertUserImage(certificate))"
                  alt="User Avatar"
                  class="avatar-image"
                  @error="handleAvatarError(certificate.certificate_id)"
                />
                <div v-else class="avatar-fallback">
                  {{ getUserInitialsFromCert(certificate) }}
                </div>
              </div>
              <div class="user-info">
                <span class="username">{{ getCertUserName(certificate) }}</span>
                <span class="user-id">{{ certificate.user_id.slice(0, 8) }}...</span>
              </div>
            </div>
            <div class="card-body">
              <div class="certificate-title">{{ getExamNameFromCert(certificate) }}</div>
              <div class="certificate-meta">
                <div class="meta-item">
                  <span class="meta-label">Taken:</span>
                  <span class="meta-value">{{ formatDate(certificate.taken_date) }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Expires:</span>
                  <span class="meta-value">{{ formatDate(certificate.expire_date) }}</span>
                </div>
              </div>
              <div class="status-wrapper">
                <span class="status-badge" :class="{ valid: isExamValid(certificate), expired: !isExamValid(certificate) }">
                  {{ isExamValid(certificate) ? 'Valid' : 'Expired' }}
                </span>
              </div>
            </div>
            <div class="card-footer">
              <button
                @click="viewCertificate(certificate.certificate_id, 'exam')"
                class="action-btn view"
              >
                View Certificate
              </button>
            </div>
          </div>
          <div class="grid-footer">
            <div class="pagination">
              <button
                :disabled="currentPage === 1"
                @click="currentPage--"
                class="pagination-btn"
              >
                Previous
              </button>
              <span class="page-info">
                Page {{ currentPage }} of {{ totalPages }}
              </span>
              <button
                :disabled="currentPage === totalPages"
                @click="currentPage++"
                class="pagination-btn"
              >
                Next
              </button>
            </div>
            <div class="total-count">
              Showing {{ filteredExamCertificates.length }} of {{ examCertificates.length }} certificates
            </div>
          </div>
        </div>
      </div>

      <!-- Course Certificates Tab -->
      <div v-else class="tab-content">
        <div v-if="filteredCourseCertificates.length === 0" class="empty-state">
          <div class="empty-icon">🎓</div>
          <h3>No Course Certificates Found</h3>
          <p v-if="searchQuery">Try adjusting your search criteria</p>
          <p v-else>No course certificates have been issued yet</p>
        </div>

        <!-- List View -->
        <div v-else-if="viewMode === 'list'" class="certificates-table">
          <div class="table-header">
            <div class="header-cell user">User</div>
            <div class="header-cell course">Course</div>
            <div class="header-cell date">Completion Date</div>
            <div class="header-cell hours">Hours</div>
            <div class="header-cell actions">Actions</div>
          </div>

          <div class="table-body">
            <div
              v-for="certificate in filteredCourseCertificates"
              :key="certificate.certificate_id"
              class="table-row"
            >
              <div class="table-cell user">
                <div class="user-cell">
                  <div class="user-avatar-small">
                    <img
                      v-if="getCertUserImage(certificate) && !avatarErrors[certificate.certificate_id]"
                      :src="getProxiedImageUrl(getCertUserImage(certificate))"
                      alt="User Avatar"
                      class="avatar-image-small"
                      @error="handleAvatarError(certificate.certificate_id)"
                    />
                    <div v-else class="avatar-fallback-small">
                      {{ getUserInitialsFromCert(certificate) }}
                    </div>
                  </div>
                  <div class="user-info-small">
                    <span class="username">{{ getCertUserName(certificate) }}</span>
                    <span class="user-id">{{ certificate.user_id.slice(0, 8) }}...</span>
                  </div>
                </div>
              </div>

              <div class="table-cell course">
                <span class="course-name">{{ getCourseNameFromCert(certificate) }}</span>
              </div>

              <div class="table-cell date">
                {{ formatDate(certificate.date) }}
              </div>

              <div class="table-cell hours">
                {{ certificate.hours }} hours
              </div>

              <div class="table-cell actions">
                <button
                  @click="viewCertificate(certificate.certificate_id, 'course')"
                  class="action-btn view"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          <div class="table-footer">
            <div class="pagination">
              <button
                :disabled="currentPage === 1"
                @click="currentPage--"
                class="pagination-btn"
              >
                Previous
              </button>
              <span class="page-info">
                Page {{ currentPage }} of {{ totalPages }}
              </span>
              <button
                :disabled="currentPage === totalPages"
                @click="currentPage++"
                class="pagination-btn"
              >
                Next
              </button>
            </div>
            <div class="total-count">
              Showing {{ filteredCourseCertificates.length }} of {{ courseCertificates.length }} certificates
            </div>
          </div>
        </div>

        <!-- Grid View -->
        <div v-else class="certificates-grid">
          <div
            v-for="certificate in filteredCourseCertificates"
            :key="certificate.certificate_id"
            class="certificate-card"
          >
            <div class="card-header">
              <div class="user-avatar">
                <img
                  v-if="getCertUserImage(certificate) && !avatarErrors[certificate.certificate_id]"
                  :src="getProxiedImageUrl(getCertUserImage(certificate))"
                  alt="User Avatar"
                  class="avatar-image"
                  @error="handleAvatarError(certificate.certificate_id)"
                />
                <div v-else class="avatar-fallback">
                  {{ getUserInitialsFromCert(certificate) }}
                </div>
              </div>
              <div class="user-info">
                <span class="username">{{ getCertUserName(certificate) }}</span>
                <span class="user-id">{{ certificate.user_id.slice(0, 8) }}...</span>
              </div>
            </div>
            <div class="card-body">
              <div class="certificate-title">{{ getCourseNameFromCert(certificate) }}</div>
              <div class="certificate-meta">
                <div class="meta-item">
                  <span class="meta-label">Completed:</span>
                  <span class="meta-value">{{ formatDate(certificate.date) }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Hours:</span>
                  <span class="meta-value">{{ certificate.hours }} hours</span>
                </div>
              </div>
            </div>
            <div class="card-footer">
              <button
                @click="viewCertificate(certificate.certificate_id, 'course')"
                class="action-btn view"
              >
                View Certificate
              </button>
            </div>
          </div>
          <div class="grid-footer">
            <div class="pagination">
              <button
                :disabled="currentPage === 1"
                @click="currentPage--"
                class="pagination-btn"
              >
                Previous
              </button>
              <span class="page-info">
                Page {{ currentPage }} of {{ totalPages }}
              </span>
              <button
                :disabled="currentPage === totalPages"
                @click="currentPage++"
                class="pagination-btn"
              >
                Next
              </button>
            </div>
            <div class="total-count">
              Showing {{ filteredCourseCertificates.length }} of {{ courseCertificates.length }} certificates
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { certificateService, type CourseCertificate, type ExamCertificate } from '@/services/certificate.service';
import { getProxiedImageUrl } from '@/utils/imageUtils';

const router = useRouter();

const loading = ref(true);
const error = ref<string | null>(null);
const activeTab = ref<'exams' | 'courses'>('exams');
const searchQuery = ref('');
const statusFilter = ref('');
const sortBy = ref('date');
const currentPage = ref(1);
const itemsPerPage = 20;
const viewMode = ref<'grid' | 'list'>('grid');

const examCertificates = ref<ExamCertificate[]>([]);
const courseCertificates = ref<CourseCertificate[]>([]);

const avatarErrors = reactive<Record<string, boolean>>({});

// Reads directly from denormalized fields on the certificate (fast!)
const getCertUserName = (cert: CourseCertificate | ExamCertificate): string => {
  return cert.user_full_name?.trim() || 'Unknown User';
};

const getCertUserImage = (cert: CourseCertificate | ExamCertificate): string => {
  return cert.user_image_url || '';
};

const getUserInitialsFromCert = (cert: CourseCertificate | ExamCertificate): string => {
  const name = cert.user_full_name?.trim() || '';
  if (!name) return 'U';
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
};

const getCourseNameFromCert = (cert: CourseCertificate): string => {
  return cert.course_name?.trim() || `Course: ${cert.course_id.slice(0, 8)}...`;
};

const getExamNameFromCert = (cert: ExamCertificate): string => {
  return cert.exam_name?.trim() || `Exam: ${cert.exam_id.slice(0, 8)}...`;
};

const isExamValid = (cert: ExamCertificate): boolean => {
  if (typeof cert.is_valid === 'boolean') return cert.is_valid;
  // Fallback compute
  if (!cert.expire_date) return false;
  return new Date(cert.expire_date) >= new Date();
};

const filteredExamCertificates = computed(() => {
  let filtered = [...examCertificates.value];

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(cert => {
      const name = getCertUserName(cert).toLowerCase();
      const examName = getExamNameFromCert(cert).toLowerCase();
      const userId = cert.user_id.toLowerCase();
      return name.includes(query) || examName.includes(query) || userId.includes(query);
    });
  }

  if (statusFilter.value === 'valid') {
    filtered = filtered.filter(cert => isExamValid(cert));
  } else if (statusFilter.value === 'expired') {
    filtered = filtered.filter(cert => !isExamValid(cert));
  }

  if (sortBy.value === 'user') {
    filtered.sort((a, b) => getCertUserName(a).localeCompare(getCertUserName(b)));
  } else {
    filtered.sort((a, b) => new Date(b.taken_date).getTime() - new Date(a.taken_date).getTime());
  }

  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filtered.slice(start, end);
});

const filteredCourseCertificates = computed(() => {
  let filtered = [...courseCertificates.value];

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(cert => {
      const name = getCertUserName(cert).toLowerCase();
      const courseName = getCourseNameFromCert(cert).toLowerCase();
      const userId = cert.user_id.toLowerCase();
      return name.includes(query) || courseName.includes(query) || userId.includes(query);
    });
  }

  if (sortBy.value === 'user') {
    filtered.sort((a, b) => getCertUserName(a).localeCompare(getCertUserName(b)));
  } else {
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filtered.slice(start, end);
});

const totalPages = computed(() => {
  const totalItems = activeTab.value === 'exams'
    ? examCertificates.value.length
    : courseCertificates.value.length;
  return Math.ceil(totalItems / itemsPerPage) || 1;
});

const handleAvatarError = (certificateId: string) => {
  avatarErrors[certificateId] = true;
};

// Fetch ALL certificates directly from certificate replica (fast!)
const fetchAllCertificates = async () => {
  try {
    loading.value = true;
    error.value = null;

    const result = await certificateService.getAllCertificates();
    examCertificates.value = result.exam_certificates || [];
    courseCertificates.value = result.course_certificates || [];

  } catch (err: any) {
    console.error('Failed to fetch all certificates:', err);
    error.value = err.message || 'Failed to load certificates';
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
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
  fetchAllCertificates();
});
</script>

<style scoped src="@/assets/css/all-users-certificates.css"></style>
