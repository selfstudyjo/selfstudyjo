<template>
  <div class="certificate-details">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ $t('Accessing certificate data ...') }}</p>
    </div>

    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>{{ $t('Signal interference') }}</h3>
      <p>{{ error }}</p>
      <div class="error-actions">
        <button @click="fetchCertificate" class="retry-btn">
          <span>{{ $t('Re‑establish connection') }}</span>
        </button>
        <button @click="goBack" class="back-btn">{{ $t('Return to command centre') }}</button>
      </div>
    </div>

    <div v-else class="certificate-content">
      <div class="certificate-header">
        <div class="header-actions">
          <div class="share-wrap" ref="shareWrapRef">
            <button
              @click="toggleShareMenu"
              class="share-btn"
              :aria-expanded="shareMenuOpen"
              aria-haspopup="menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 16.08C17.24 16.08 16.56 16.38 16.04 16.85L8.91 12.7C8.96 12.47 9 12.24 9 12C9 11.76 8.96 11.53 8.91 11.3L15.96 7.19C16.5 7.69 17.21 8 18 8C19.66 8 21 6.66 21 5C21 3.34 19.66 2 18 2C16.34 2 15 3.34 15 5C15 5.24 15.04 5.47 15.09 5.7L8.04 9.81C7.5 9.31 6.79 9 6 9C4.34 9 3 10.34 3 12C3 13.66 4.34 15 6 15C6.79 15 7.5 14.69 8.04 14.19L15.16 18.35C15.11 18.56 15.08 18.78 15.08 19C15.08 20.61 16.39 21.92 18 21.92C19.61 21.92 20.92 20.61 20.92 19C20.92 17.39 19.61 16.08 18 16.08Z" fill="currentColor"/>
              </svg>
              <span>{{ $t('Share achievement') }}</span>
            </button>

            <transition name="uc-pop">
              <div v-if="shareMenuOpen" class="share-menu" role="menu">
                <p class="share-menu-title">{{ $t('Share your achievement') }}</p>
                <p class="share-menu-preview">{{ shareMessage }}</p>

                <div class="share-menu-actions">
                  <button
                    v-for="target in shareTargets"
                    :key="target.key"
                    class="share-option"
                    :class="`is-${target.key}`"
                    role="menuitem"
                    @click="openShareTarget(target.href)"
                  >
                    <span class="share-option-icon" v-html="target.icon"></span>
                    <span>{{ target.label }}</span>
                  </button>

                  <button
                    v-if="canNativeShare"
                    class="share-option is-native"
                    role="menuitem"
                    @click="nativeShare"
                  >
                    <span class="share-option-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M6 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm6 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm6 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>
                      </svg>
                    </span>
                    <span>{{ $t('More apps') }}</span>
                  </button>

                  <button class="share-option is-copy" role="menuitem" @click="copyShareMessage">
                    <span class="share-option-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/>
                      </svg>
                    </span>
                    <span>{{ $t('Copy post') }}</span>
                  </button>
                </div>
              </div>
            </transition>
          </div>

          <button @click="copyCertificateUrl" class="copy-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"/>
            </svg>
            <span>{{ $t('Copy link') }}</span>
          </button>

          <button @click="printCertificate" class="print-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 8h-1V3H6v5H5a3 3 0 0 0-3 3v6h4v3h12v-3h4v-6a3 3 0 0 0-3-3ZM8 5h8v3H8V5Zm8 14H8v-4h8v4Zm3-6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
            </svg>
            <span>{{ $t('Print') }}</span>
          </button>
        </div>
      </div>

      <article class="certificate-card">
        <div class="certificate-frame">

          <!-- Issuer -->
          <header class="cert-brand">
            <span class="brand-mark">★</span>
            <span class="brand-name">{{ $t('Self Study JO') }}</span>
            <span class="brand-sub">{{ $t('Official Certification Authority') }}</span>
          </header>

          <!-- Title -->
          <div class="cert-title">
            <h1>{{ $t('Certificate of {v0}', { v0: certificateType === 'course' ? 'Completion' : 'Achievement' }) }}</h1>
            <div class="cert-ribbon" aria-hidden="true">
              <span class="ribbon-line"></span>
              <span class="ribbon-center">🌠</span>
              <span class="ribbon-line"></span>
            </div>
          </div>

          <!-- Recipient -->
          <section class="cert-recipient">
            <p class="cert-lead">{{ $t('This is to certify that') }}</p>

            <div class="recipient-avatar">
              <img
                v-if="userImageUrl && !avatarError"
                :src="proxiedAvatarUrl"
                alt=""
                class="avatar-image"
                @error="avatarError = true"
              />
              <div v-else class="avatar-fallback">{{ userInitials }}</div>
            </div>

            <h2 class="recipient-name">{{ fullName }}</h2>
            <span class="name-rule" aria-hidden="true"></span>

            <span class="verified-badge">
              <span class="badge-icon">★</span>
              <span class="badge-text">{{ $t('Verified') }}</span>
            </span>
          </section>

          <!-- Award -->
          <section class="cert-award">
            <p class="cert-lead">
              {{ $t('has successfully {v0}', { v0: certificateType === 'course' ? 'completed the course' : 'passed the examination' }) }}
            </p>
            <h3 class="award-title">{{ mainTitle }}</h3>
            <p v-if="certificateType === 'exam' && certificate?.course_name" class="award-sub">
              {{ $t('as part of the course') }} <strong>{{ certificate.course_name }}</strong>
            </p>
          </section>

          <!-- Optional citation -->
          <blockquote v-if="certificate?.message" class="cert-citation">
            <p>{{ certificate.message }}</p>
          </blockquote>

          <!-- Facts -->
          <section class="cert-facts">
            <div class="fact" v-if="certificate?.date || certificate?.taken_date">
              <span class="fact-label">{{ certificateType === 'course' ? 'Completed' : 'Taken' }}</span>
              <span class="fact-value">{{ formatDate(certificate?.date || certificate?.taken_date) }}</span>
            </div>

            <div class="fact" v-if="certificate?.expire_date">
              <span class="fact-label">{{ $t('Valid until') }}</span>
              <span class="fact-value">{{ formatDate(certificate.expire_date) }}</span>
            </div>

            <div class="fact" v-if="certificate?.hours">
              <span class="fact-label">{{ $t('Study hours') }}</span>
              <span class="fact-value">{{ certificate.hours }} h</span>
            </div>

            <div class="fact">
              <span class="fact-label">{{ $t('Status') }}</span>
              <span class="fact-value">
                <span class="status-badge" :class="statusClass">{{ statusText }}</span>
              </span>
            </div>
          </section>

          <!-- Footer: issue date · seal · certificate id -->
          <footer class="cert-footer">
            <div class="footer-block">
              <span class="footer-value">{{ formatDate(certificate?.created_at || new Date().toISOString()) }}</span>
              <span class="footer-rule" aria-hidden="true"></span>
              <span class="footer-label">{{ $t('Date of issue') }}</span>
            </div>

            <div class="cert-seal" aria-hidden="true">
              <div class="seal">
                <div class="seal-inner">
                  <div class="seal-star">★</div>
                  <div class="seal-text">{{ $t('Certified') }}</div>
                  <div class="seal-org">{{ $t('Self Study JO') }}</div>
                </div>
              </div>
            </div>

            <div class="footer-block">
              <code class="footer-value cert-id">{{ certificate?.certificate_id }}</code>
              <span class="footer-rule" aria-hidden="true"></span>
              <span class="footer-label">{{ $t('Certificate ID') }}</span>
            </div>
          </footer>

        </div>
      </article>
    </div>

    <div v-if="showToast" class="toast" :class="{ success: toastSuccess }">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
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
const shareMenuOpen = ref(false);
const shareWrapRef = ref<HTMLElement | null>(null);

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

/* --------------------------------------------------------------------------
 *  Sharing
 *
 *  The certificate link must end up INSIDE the published post, so it is
 *  delivered twice on purpose:
 *    1. inline in the message body, near the top (survives the character
 *       truncation X applies and the preview cropping LinkedIn applies), and
 *    2. through each network's dedicated link parameter (`shareUrl`, `url`,
 *       `u`) — several networks sanitise links out of a prefilled text box,
 *       and Facebook ignores prefilled text entirely, so the parameter is the
 *       only guaranteed channel.
 *  As a final safety net the full post is copied to the clipboard before the
 *  composer opens, so an empty composer is always one paste away from correct.
 * -------------------------------------------------------------------------- */

/**
 * Path-only share link — deliberately NOT the in-app hash URL.
 *
 * Networks decode the prefilled message a second time before re-parsing it,
 * so a shared `...%23/certificate/x%3Ftype%3Dexam` collapses into
 * `https://www.selfstudyjo.com/` with the route treated as a URL fragment.
 * This form contains only letters, digits, hyphens and slashes, so it is
 * byte-identical no matter how many decode passes it survives.
 * The bootstrap in index.html maps it back onto the hash route.
 */
const certificateUrl = computed(() => {
  const base = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`.replace(/\/+$/, '');
  return `${base}/certificate/${certificateId.value}/${certificateType.value}`;
});

const canNativeShare = computed(() => typeof navigator !== 'undefined' && !!navigator.share);

/**
 * '&' truncates the post and '#' turns the remainder into a URL fragment once
 * a network re-parses the decoded message, so neither may reach the body via
 * course or exam titles ("HTML & CSS", "C# Fundamentals").
 */
const shareSafe = (value: string): string =>
  value.replace(/&/g, 'and').replace(/#/g, '').replace(/\s{2,}/g, ' ').trim();

const shareTitle = computed(() => shareSafe(mainTitle.value));

const shareMessage = computed(() => {
  const achievement = certificateType.value === 'course'
    ? `completed the course “${shareTitle.value}”`
    : `passed the exam “${shareTitle.value}”`;

  const lines: string[] = [
    `🎉 Proud moment! I've successfully ${achievement} and earned my official certificate from Self Study JO.`,
    '',
    // No '&' anywhere in this message: a network that re-parses the decoded
    // text as a query string truncates the post at the first one.
    `🔗 View and verify my certificate: ${certificateUrl.value}`,
    ''
  ];

  const achievedOn = certificate.value?.date || certificate.value?.taken_date || certificate.value?.created_at;
  if (achievedOn) {
    lines.push(`📅 ${certificateType.value === 'course' ? 'Completed' : 'Passed'} on ${formatDate(achievedOn)}`);
  }
  if (certificate.value?.hours) {
    lines.push(`⏱️ ${certificate.value.hours} hours of study`);
  }
  if (certificate.value?.certificate_id) {
    lines.push(`🔖 Certificate ID: ${certificate.value.certificate_id}`);
  }

  // Hashtags stay last — '#' is the one risky character left, so if a network
  // does cut here it costs the tags, never the certificate link.
  lines.push('', '#SelfStudyJO #Certificate #Achievement #NeverStopLearning');

  return lines.join('\n');
});

/**
 * X caps a post at 280 chars and appends the `url` parameter after the text,
 * counting any link as 23 chars. Trim the certificate title — never the link —
 * so the URL can never be the part that gets cut off.
 */
const xShareText = computed(() => {
  const X_LIMIT = 280;
  const X_URL_WEIGHT = 23;
  const action = certificateType.value === 'course' ? 'completed the course' : 'passed the exam';
  const tags = '#SelfStudyJO #Certificate #Achievement';

  const build = (title: string) =>
    `🎉 I've just ${action} “${title}” and earned my official Self Study JO certificate! ✅ Verify it here:\n\n${tags}`;

  const budget = X_LIMIT - X_URL_WEIGHT - 2;   // -2 for the space + newline X inserts
  let text = build(shareTitle.value);

  if (text.length > budget) {
    const keep = Math.max(8, shareTitle.value.length - (text.length - budget) - 1);
    text = build(`${shareTitle.value.slice(0, keep).trimEnd()}…`);
  }
  return text;
});

const shareTargets = computed(() => {
  const text = encodeURIComponent(shareMessage.value);
  const url = encodeURIComponent(certificateUrl.value);

  return [
    {
      key: 'linkedin',
      label: 'LinkedIn',
      // `shareUrl` attaches the link itself; `text` prefills the post body.
      href: `https://www.linkedin.com/feed/?shareActive=true&shareUrl=${url}&text=${text}`,
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0Z"/></svg>'
    },
    {
      key: 'x',
      label: 'X',
      // `url` is appended by X itself, so the link cannot be truncated away.
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(xShareText.value)}&url=${url}`,
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64Z"/></svg>'
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      // WhatsApp posts the body verbatim, so the inline link is enough.
      href: `https://wa.me/?text=${text}`,
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.05 21.8h-.01a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.7.97.99-3.61-.24-.37a9.79 9.79 0 0 1-1.5-5.22c0-5.4 4.4-9.8 9.82-9.8a9.75 9.75 0 0 1 6.93 2.88 9.72 9.72 0 0 1 2.87 6.93c0 5.4-4.41 9.8-9.81 9.8ZM20.5 3.49A11.72 11.72 0 0 0 12.05 0C5.6 0 .35 5.24.35 11.68c0 2.06.54 4.07 1.56 5.85L.25 24l6.6-1.73a11.68 11.68 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.24 11.7-11.68 0-3.12-1.22-6.06-3.43-8.27Z"/></svg>'
    },
    {
      key: 'facebook',
      label: 'Facebook',
      // Facebook drops `quote`; `u` is what actually gets posted, hence the
      // clipboard copy below so the wording can be pasted alongside it.
      href: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/></svg>'
    }
  ];
});

const toggleShareMenu = () => {
  shareMenuOpen.value = !shareMenuOpen.value;
};

const writeToClipboard = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (err) {
    console.error('Clipboard write failed:', err);
    return false;
  }
};

const openShareTarget = async (href: string) => {
  shareMenuOpen.value = false;
  // Copy first: if the network refuses the prefilled wording, the complete
  // post — certificate link included — is already on the clipboard.
  const copied = await writeToClipboard(shareMessage.value);
  window.open(href, '_blank', 'noopener,noreferrer,width=680,height=720');
  if (copied) {
    showToastMessage('Post copied — paste it if the composer opens empty.', true);
  }
};

const nativeShare = async () => {
  shareMenuOpen.value = false;
  try {
    await navigator.share({
      title: `${mainTitle.value} — Self Study JO Certificate`,
      // The link lives inside `text` rather than in a separate `url` field:
      // share targets always deliver the body, but many discard `url`.
      text: shareMessage.value
    });
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      copyShareMessage();
    }
  }
};

const copyShareMessage = async () => {
  shareMenuOpen.value = false;
  if (await writeToClipboard(shareMessage.value)) {
    showToastMessage('Celebration post copied — paste it anywhere!', true);
  } else {
    showToastMessage('Failed to copy the post', false);
  }
};

const copyCertificateUrl = async () => {
  if (await writeToClipboard(certificateUrl.value)) {
    showToastMessage('Certificate URL copied to clipboard!', true);
  } else {
    showToastMessage('Failed to copy URL', false);
  }
};

const printCertificate = () => {
  shareMenuOpen.value = false;
  window.print();
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

const handleDocumentClick = (event: MouseEvent) => {
  if (!shareMenuOpen.value) return;
  const wrap = shareWrapRef.value;
  if (wrap && !wrap.contains(event.target as Node)) {
    shareMenuOpen.value = false;
  }
};

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') shareMenuOpen.value = false;
};

onMounted(() => {
  fetchCertificate();
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', handleEscape);
});
</script>
