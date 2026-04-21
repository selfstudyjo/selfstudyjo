<template>
  <div class="certificate-details">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">Accessing certificate data ...</p>
    </div>

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

    <div v-else class="certificate-content">
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

      <div class="certificate-card">
        <div class="certificate-border">

          <div class="certificate-title">
            <h1>CERTIFICATE OF {{ certificateType.toUpperCase() }}</h1>
            <div class="certificate-ribbon">
              <div class="ribbon-left"></div>
              <div class="ribbon-center">🌠</div>
              <div class="ribbon-right"></div>
            </div>
          </div>

          <div class="certificate-body">
            <div class="presented-to">
              <p class="label">This certificate is presented to</p>
              <div class="user-info">
                <div class="user-avatar">
                  <img
                    v-if="userImageUrl && !avatarError"
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
                </div>
              </div>
              <div class="user-badge">
                <span class="badge-icon">★</span>
                <span class="badge-text">VERIFIED</span>
              </div>
            </div>

            <p class="awarded-for">
              for successfully {{ certificateType === 'course' ? 'completing the course' : 'passing the exam' }}
            </p>

            <div v-if="certificate?.message" class="certificate-message">
              <p class="message">{{ certificate.message }}</p>
            </div>

            <div class="certificate-id">
              <span class="label">Certificate ID</span>
              <code class="id-value">{{ certificate?.certificate_id }}</code>
            </div>

            <div class="main-details">
              <div class="detail-item">
                <span class="label">{{ certificateType === 'course' ? 'Course' : 'Exam' }} name</span>
                <h3 class="value">{{ mainTitle }}</h3>
              </div>

              <div v-if="certificateType === 'exam' && certificate?.course_name" class="detail-item">
                <span class="label">Related course</span>
                <h4 class="value">{{ certificate.course_name }}</h4>
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

            <div class="certificate-footer">
              <div class="issue-date">
                <span class="label">Issued on</span>
                <span class="value">{{ formatDate(certificate?.created_at || new Date().toISOString()) }}</span>
              </div>
            </div>

          </div>

          <div class="certificate-seal">
            <div class="seal">
              <div class="seal-inner">
                <div class="seal-star">★</div>
                <div class="seal-text">CERTIFIED</div>
                <div class="seal-org">SELF STUDY JO</div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>

    <div v-if="showToast" class="toast" :class="{ success: toastSuccess }">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { certificateService } from '@/services/certificate.service';
import { getProxiedImageUrl } from '@/utils/imageUtils';

import '@/assets/css/user-certificate.css';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref<string | null>(null);
const certificate = ref<any>(null);
const showToast = ref(false);
const toastMessage = ref('');
const toastSuccess = ref(false);
const avatarError = ref(false);

const certificateId = computed(() => route.params.certificateId as string);
const certificateType = computed(() => (route.query.type as 'course' | 'exam') || 'course');

// All values now read directly from denormalized certificate record
const fullName = computed(() => {
  return certificate.value?.user_full_name?.trim() || 'Space traveller';
});

const userImageUrl = computed(() => {
  return certificate.value?.user_image_url || '';
});

const userInitials = computed(() => {
  const name = certificate.value?.user_full_name?.trim() || '';
  if (!name) return 'U';
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
});

const proxiedAvatarUrl = computed(() => {
  if (!userImageUrl.value) return '';
  return getProxiedImageUrl(userImageUrl.value);
});

const mainTitle = computed(() => {
  if (!certificate.value) return 'Loading...';
  if (certificateType.value === 'course') {
    return certificate.value.course_name?.trim()
      || `Course: ${certificate.value.course_id?.slice(0, 8) || ''}...`;
  }
  return certificate.value.exam_name?.trim()
    || `Exam: ${certificate.value.exam_id?.slice(0, 8) || ''}...`;
});

const statusClass = computed(() => {
  if (certificateType.value === 'exam') {
    return isExamValid() ? 'valid' : 'expired';
  }
  return 'valid';
});

const statusText = computed(() => {
  if (certificateType.value === 'exam') {
    return isExamValid() ? 'Valid' : 'Expired';
  }
  return 'Valid';
});

const isExamValid = (): boolean => {
  if (!certificate.value) return false;
  if (typeof certificate.value.is_valid === 'boolean') return certificate.value.is_valid;
  if (!certificate.value.expire_date) return false;
  return new Date(certificate.value.expire_date) >= new Date();
};

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
    } else {
      certificate.value = await certificateService.getExamCertificate(certificateId.value);
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
      title: `${mainTitle.value} Certificate`,
      text: `Check out this ${certificateType.value} certificate from Self Study JO`,
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
