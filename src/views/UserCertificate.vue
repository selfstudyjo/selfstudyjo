<template>
  <div class="certificate-details">
    <!-- LOADING STATE – cosmic spinner, transparent glass -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">Accessing certificate data ...</p>
    </div>

    <!-- ERROR STATE – glass card, subtle glow -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>Signal interference</h3>
      <p>{{ error }}</p>
      <div class="error-actions">
        <button @click="fetchCertificate" class="retry-btn">
          <span>Re‑establish connection</span>
        </button>
        <button @click="goBack" class="back-btn">Return to command centre</button>
      </div>
    </div>

    <!-- CERTIFICATE CONTENT – floating glass window -->
    <div v-else class="certificate-content">

      <!-- HEADER ACTIONS – share / copy, floating in space -->
      <div class="certificate-header">
        <div class="header-actions">
          <button @click="shareCertificate" class="share-btn">
            <span>Share</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 16.08C17.24 16.08 16.56 16.38 16.04 16.85L8.91 12.7C8.96 12.47 9 12.24 9 12C9 11.76 8.96 11.53 8.91 11.3L15.96 7.19C16.5 7.69 17.21 8 18 8C19.66 8 21 6.66 21 5C21 3.34 19.66 2 18 2C16.34 2 15 3.34 15 5C15 5.24 15.04 5.47 15.09 5.7L8.04 9.81C7.5 9.31 6.79 9 6 9C4.34 9 3 10.34 3 12C3 13.66 4.34 15 6 15C6.79 15 7.5 14.69 8.04 14.19L15.16 18.35C15.11 18.56 15.08 18.78 15.08 19C15.08 20.61 16.39 21.92 18 21.92C19.61 21.92 20.92 20.61 20.92 19C20.92 17.39 19.61 16.08 18 16.08Z" fill="currentColor"/>
            </svg>
          </button>
          <button @click="copyCertificateUrl" class="copy-btn">
            <span>Copy link</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- MAIN CERTIFICATE CARD – like a spaceship viewport -->
      <div class="certificate-card">
        <div class="certificate-border">

          <!-- TITLE – full width, cosmic gradient -->
          <div class="certificate-title">
            <h1>CERTIFICATE OF {{ certificateType.toUpperCase() }}</h1>
            <div class="certificate-ribbon">
              <div class="ribbon-left"></div>
              <div class="ribbon-center">🌠</div>
              <div class="ribbon-right"></div>
            </div>
          </div>

          <!-- BODY – two‑column grid, zero row gap -->
          <div class="certificate-body">

            <!-- LEFT COLUMN – recipient, award message, ID -->
            <div class="presented-to">
              <p class="label">This certificate is presented to</p>
              <div class="user-info">
                <div class="user-avatar">
                  <img
                    v-if="userProfile?.image_url && !avatarError"
                    :src="proxiedAvatarUrl"
                    alt="User avatar"
                    class="avatar-image"
                    @error="avatarError = true"
                  />
                  <div v-else class="avatar-fallback">
                    {{ userInitials }}
                  </div>
                </div>
                <div class="user-details">
                  <h2 class="user-name">{{ fullName }}</h2>
                  <!-- email removed per requirements -->
                </div>
              </div>
              <!-- 🔥 NEW MODERN COSMIC BADGE – under user info -->
              <div class="user-badge">
                <span class="badge-icon">★</span>
                <span class="badge-text">VERIFIED</span>
              </div>
            </div>

            <!-- AWARDED FOR – directly under recipient, no white space -->
            <p class="awarded-for">
              for successfully {{ certificateType === 'course' ? 'completing the course' : 'passing the exam' }}
            </p>

            <!-- CERTIFICATE MESSAGE – floating quote bubble -->
            <div v-if="certificate?.message" class="certificate-message">
              <p class="message">{{ certificate.message }}</p>
            </div>

            <!-- CERTIFICATE ID – badge style -->
            <div class="certificate-id">
              <span class="label">Certificate ID</span>
              <code class="id-value">{{ certificate?.certificate_id }}</code>
            </div>

            <!-- RIGHT COLUMN – course/exam name, dates, status -->
            <div class="main-details">
              <div class="detail-item">
                <span class="label">{{ certificateType === 'course' ? 'Course' : 'Exam' }} name</span>
                <h3 class="value">{{ certificateDetails.title || 'Loading...' }}</h3>
              </div>

              <div class="detail-grid">
                <div class="detail-card" v-if="certificate?.date || certificate?.taken_date">
                  <span class="label">{{ certificateType === 'course' ? 'Completed' : 'Taken' }}</span>
                  <span class="value">{{ formatDate(certificate?.date || certificate?.taken_date) }}</span>
                </div>

                <div class="detail-card" v-if="certificate?.expire_date">
                  <span class="label">Expires</span>
                  <span class="value">{{ formatDate(certificate.expire_date) }}</span>
                </div>

                <div class="detail-card" v-if="certificate?.hours">
                  <span class="label">Hours logged</span>
                  <span class="value">{{ certificate.hours }} h</span>
                </div>

                <div class="detail-card">
                  <span class="label">Status</span>
                  <div class="value">
                    <span class="status-badge" :class="statusClass">
                      {{ statusText }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- FOOTER – issue date, clean & minimal -->
            <div class="certificate-footer">
              <div class="issue-date">
                <span class="label">Issued on</span>
                <span class="value">{{ formatDate(certificate?.created_at || new Date().toISOString()) }}</span>
              </div>
              <!-- no issuer in current HTML, kept empty for future -->
            </div>

          </div><!-- .certificate-body -->

          <!-- COSMIC SEAL – golden medallion, absolute position -->
          <div class="certificate-seal">
            <div class="seal">
              <div class="seal-inner">
                <div class="seal-star">★</div>
                <div class="seal-text">CERTIFIED</div>
                <div class="seal-org">SELF STUDY JO</div>
              </div>
            </div>
          </div>

        </div><!-- .certificate-border -->
      </div><!-- .certificate-card -->

      <!-- ADDITIONAL INFO – course/exam description, glass card -->
      <div class="additional-info" v-if="certificateDetails.description">
        <h3>
          <span class="icon">🪐</span>
          {{ certificateType === 'course' ? 'Course' : 'Exam' }} description
        </h3>
        <p class="description">{{ certificateDetails.description }}</p>
      </div>

    </div><!-- .certificate-content -->

    <!-- TOAST NOTIFICATION – cosmic floating alert -->
    <div v-if="showToast" class="toast" :class="{ success: toastSuccess }">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { certificateService } from '@/services/certificate.service';
import { userService } from '@/services/user.service';
import { courseService } from '@/services/course.service';
import { examService } from '@/services/exam.service';
import { getProxiedImageUrl } from '@/utils/imageUtils';

// import the cosmic CSS – make sure the path is correct
import '@/assets/css/user-certificate.css';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref<string | null>(null);
const certificate = ref<any>(null);
const userProfile = ref<any>(null);
const certificateDetails = ref<any>({});
const showToast = ref(false);
const toastMessage = ref('');
const toastSuccess = ref(false);
const avatarError = ref(false);

const certificateId = computed(() => route.params.certificateId as string);
const certificateType = computed(() => route.query.type as 'course' | 'exam' || 'course');

// Full name from first and last name, fallback to username
const fullName = computed(() => {
  if (!userProfile.value) return 'Space traveller';
  const first = userProfile.value.first_name || '';
  const last = userProfile.value.last_name || '';
  if (first.trim() || last.trim()) {
    return `${first} ${last}`.trim();
  }
  return userProfile.value.username || 'Space traveller';
});

// Avatar initials: first letter of first name, otherwise first letter of username
const userInitials = computed(() => {
  if (!userProfile.value) return 'U';
  const first = userProfile.value.first_name;
  if (first && first.trim()) {
    return first.charAt(0).toUpperCase();
  }
  const username = userProfile.value.username || '';
  return username.charAt(0).toUpperCase() || 'U';
});

const proxiedAvatarUrl = computed(() => {
  if (!userProfile.value?.image_url) return '';
  return getProxiedImageUrl(userProfile.value.image_url);
});

const statusClass = computed(() => {
  if (certificateType.value === 'exam') {
    return certificate.value?.is_valid ? 'valid' : 'expired';
  }
  return 'valid';
});

const statusText = computed(() => {
  if (certificateType.value === 'exam') {
    return certificate.value?.is_valid ? 'Valid' : 'Expired';
  }
  return 'Valid';
});

const fetchCertificate = async () => {
  if (!certificateId.value) {
    error.value = 'Certificate ID is required';
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    error.value = null;

    if (certificateType.value === 'course') {
      certificate.value = await certificateService.getCourseCertificate(certificateId.value);
      try {
        const course = await courseService.getCourse(certificate.value.course_id);
        certificateDetails.value = {
          title: course.title,
          description: course.description
        };
      } catch (err) {
        console.warn('Failed to fetch course details:', err);
        certificateDetails.value = {
          title: `Course: ${certificate.value.course_id.slice(0, 8)}...`
        };
      }
    } else {
      certificate.value = await certificateService.getExamCertificate(certificateId.value);
      try {
        const exam = await examService.getExam(certificate.value.exam_id);
        certificateDetails.value = {
          title: exam.title,
          description: exam.exam_instructions
        };
      } catch (err) {
        console.warn('Failed to fetch exam details:', err);
        certificateDetails.value = {
          title: `Exam: ${certificate.value.exam_id.slice(0, 8)}...`
        };
      }
    }

    try {
      userProfile.value = await userService.getUserProfile(certificate.value.user_id);
    } catch (err) {
      console.warn('Failed to fetch user profile:', err);
    }

  } catch (err: any) {
    console.error('Failed to fetch certificate:', err);
    error.value = err.message || 'Failed to load certificate';
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const shareCertificate = () => {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({
      title: `${certificateDetails.value.title} Certificate`,
      text: `Check out my ${certificateType.value} certificate from Self Study JO`,
      url: url
    });
  } else {
    copyCertificateUrl();
  }
};

const copyCertificateUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToastMessage('Certificate URL copied to clipboard!', true);
  } catch (err) {
    console.error('Failed to copy URL:', err);
    showToastMessage('Failed to copy URL', false);
  }
};

const showToastMessage = (message: string, success: boolean) => {
  toastMessage.value = message;
  toastSuccess.value = success;
  showToast.value = true;

  setTimeout(() => {
    showToast.value = false;
  }, 3000);
};

const goBack = () => {
  router.push('/certificates');
};

onMounted(() => {
  fetchCertificate();
});
</script>