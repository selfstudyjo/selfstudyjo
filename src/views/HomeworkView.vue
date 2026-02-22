<template>
  <div class="homework-page">
    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading homework...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 class="error-title">Unable to load homework</h3>
      <p class="error-message">{{ error }}</p>
      <button class="retry-btn" @click="fetchHomeworkData">
        Try Again
      </button>
      <router-link :to="`/course/${route.params.courseId}`" class="back-btn">
        Back to Course
      </router-link>
    </div>

    <!-- Homework Content -->
    <div v-else-if="homework" class="homework-content">
      <!-- Header -->
      <div class="homework-header">
        <div class="breadcrumb">
          <router-link :to="`/course/${route.params.courseId}`" class="breadcrumb-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back to Course
          </router-link>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">{{ homework.title }}</span>
        </div>

        <div class="homework-hero">
          <div class="homework-info">
            <div class="homework-meta">
              <span class="homework-badge">Homework</span>
              <span class="lesson-title" v-if="lesson">Lesson: {{ lesson.title }}</span>
            </div>
            <h1 class="homework-title">{{ homework.title }}</h1>
            <p class="homework-description">{{ homework.description }}</p>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Homework Content & Submission -->
        <div class="homework-main-content">
          <!-- Homework Content Section -->
          <section class="section homework-content-section">
            <div class="section-header">
              <h2 class="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Assignment Content
              </h2>
            </div>

            <div class="homework-content-wrapper">
              <!-- Homework Materials -->
              <div v-if="homework.homework_url" class="homework-materials">
                <div class="materials-header">
                  <h3 class="materials-title">Homework Materials</h3>
                  <a :href="homework.homework_url" target="_blank" class="external-link">
                    Open in new tab
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </a>
                </div>

                <!-- Show direct link for Google Docs (can't be embedded) -->
                <div v-if="isGoogleDocsLink" class="docs-warning">
                  <div class="warning-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <div class="warning-content">
                    <p>This Google Docs link cannot be embedded. Please use the link below to view the document:</p>
                    <a :href="homework.homework_url" target="_blank" class="docs-link">
                      {{ homework.homework_url }}
                    </a>
                  </div>
                </div>

                <!-- Embedded content for non-Google Docs -->
                <div v-else class="embed-container">
                  <iframe
                    v-if="!isGoogleDocsLink"
                    :src="homework.homework_url"
                    class="homework-iframe"
                    :title="homework.title"
                    allowfullscreen
                  ></iframe>
                  <div v-else class="no-embed">
                    <p>Preview not available. Please use the link above to view the content.</p>
                  </div>
                </div>
              </div>

              <!-- Instructions -->
              <div class="instructions-container">
                <h3 class="instructions-title">Instructions</h3>
                <div class="instructions-content" v-html="formatInstructions(homework.description)"></div>
              </div>
            </div>
          </section>

          <!-- Submission Section -->
          <section class="section submission-section">
            <div class="section-header">
              <h2 class="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Your Submission
              </h2>
              <span v-if="submission" class="submission-status submitted">Submitted</span>
              <span v-else class="submission-status not-submitted">Not Submitted</span>
            </div>

            <div class="submission-content">
              <!-- Show existing submission -->
              <div v-if="submission && !showSubmissionForm" class="existing-submission">
                <div class="submission-card">
                  <div class="submission-header">
                    <div class="submission-info">
                      <h3 class="submission-title">Submitted Work</h3>
                      <span class="submission-date">
                        Submitted {{ formatDate(submission.date_submitted) }}
                      </span>
                    </div>
                    <div class="submission-actions">
                      <button
                        class="edit-btn"
                        @click="showSubmissionForm = true"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit Submission
                      </button>
                    </div>
                  </div>

                  <div class="submission-details">
                    <div v-if="submission.submitted_homework_url" class="submission-link">
                      <a :href="submission.submitted_homework_url" target="_blank" class="link-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        View Your Submission
                      </a>
                    </div>

                    <div v-if="submission.description" class="submission-description">
                      <h4>Submission Notes:</h4>
                      <p>{{ submission.description }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Submission Form -->
              <div v-if="showSubmissionForm || !submission" class="submission-form">
                <h3 class="form-title">
                  {{ submission ? 'Update Submission' : 'Submit Homework' }}
                </h3>

                <form @submit.prevent="submitHomework">
                  <div class="form-group">
                    <label for="submissionUrl" class="form-label">
                      Submission URL
                      <span class="required">*</span>
                    </label>
                    <input
                      id="submissionUrl"
                      v-model="submissionForm.submitted_homework_url"
                      type="url"
                      placeholder="https://github.com/your-username/project or https://drive.google.com/file/d/..."
                      class="form-input"
                      :disabled="submitting"
                      required
                    >
                    <p class="form-hint">
                      Provide a link to your work (GitHub repository, Google Drive, CodePen, etc.)
                    </p>
                  </div>

                  <div class="form-group">
                    <label for="description" class="form-label">
                      Description / Notes
                    </label>
                    <textarea
                      id="description"
                      v-model="submissionForm.description"
                      placeholder="Add any notes about your submission..."
                      class="form-textarea"
                      :disabled="submitting"
                      rows="4"
                    ></textarea>
                  </div>

                  <div class="form-actions">
                    <button
                      v-if="submission && showSubmissionForm"
                      type="button"
                      class="cancel-btn"
                      @click="cancelEdit"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="submit-btn"
                      :disabled="submitting || !submissionForm.submitted_homework_url"
                    >
                      <span v-if="submitting" class="btn-loading"></span>
                      <span v-else>{{ submission ? 'Update Submission' : 'Submit Homework' }}</span>
                    </button>
                  </div>

                  <div v-if="submitError" class="error-message">
                    {{ submitError }}
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { courseService, type Homework, type SubmittedHomework, type Lesson, type Course } from '@/services/course.service';
import { useAuthStore } from '@/store/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// State
const homework = ref<Homework | null>(null);
const lesson = ref<Lesson | null>(null);
const course = ref<Course | null>(null);
const submission = ref<SubmittedHomework | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const submitting = ref(false);
const submitError = ref<string | null>(null);
const showSubmissionForm = ref(false);

// Form data
const submissionForm = ref({
  submitted_homework_url: '',
  description: '',
});

// Computed
const isGoogleDocsLink = computed(() => {
  return homework.value?.homework_url?.includes('docs.google.com') ||
         homework.value?.homework_url?.includes('drive.google.com');
});

// Helper function to generate UUID v4
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    // Fallback for older browsers or non-secure contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Methods
const fetchHomeworkData = async () => {
  const courseId = route.params.courseId as string;
  const lessonId = route.params.lessonId as string;

  if (!courseId || !lessonId) {
    error.value = 'Invalid route parameters';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // Fetch course
    course.value = await courseService.getCourse(courseId);

    // Fetch lesson
    lesson.value = await courseService.getLesson(lessonId);

    // Fetch homework - get the first homework for this lesson
    const homeworks = await courseService.getLessonHomeworks(lessonId);

    if (homeworks.length === 0) {
      throw new Error('No homeworks found for this lesson');
    }

    // Use the first homework
    homework.value = homeworks[0];

    // Fetch user's submission if logged in
    const userId = authStore.user?.id;
    if (userId && homework.value) {
      try {
        const submissions = await courseService.getUserSubmissions(userId, homework.value.external_homework_id);
        if (submissions.length > 0) {
          submission.value = submissions[0];
          // Pre-fill form with existing submission
          submissionForm.value = {
            submitted_homework_url: submission.value.submitted_homework_url,
            description: submission.value.description || '',
          };
        }
      } catch (err) {
        // ignore
      }
    }

    // Set showSubmissionForm to true if no submission exists
    if (!submission.value) {
      showSubmissionForm.value = true;
    }

  } catch (err: any) {
    error.value = err.message || 'Failed to load homework. Please try again.';
  } finally {
    loading.value = false;
  }
};

const submitHomework = async () => {
  if (!homework.value || !authStore.user?.id) {
    submitError.value = 'Please login to submit homework';
    return;
  }

  submitting.value = true;
  submitError.value = null;

  try {
    // Generate a proper UUID for new submissions
    const externalId = submission.value?.external_submitted_homework_id || generateUUID();

    // Prepare submission data
    const submissionData: any = {
      external_submitted_homework_id: externalId,
      user_id: authStore.user.id,
      submitted_homework_url: submissionForm.value.submitted_homework_url.trim(),
      description: submissionForm.value.description.trim() || undefined,
    };

    if (submission.value) {
      // For update, use internal ID if available, otherwise fetch it
      let homeworkId = homework.value.id;

      if (!homeworkId) {
        // If we don't have the internal ID, try to fetch homework details
        try {
          const homeworkDetail = await courseService.getHomeworkByExternalId(homework.value.external_homework_id);
          homeworkId = homeworkDetail.id;
        } catch (fetchError) {
          // Fallback to using external ID
          submissionData.homework_external_id = homework.value.external_homework_id;
        }
      }

      // Add the homework ID if we have it
      if (homeworkId) {
        submissionData.homework = homeworkId;
      }

      // Update existing submission
      const updated = await courseService.updateHomeworkSubmission(
        submission.value.external_submitted_homework_id,
        submissionData
      );
      submission.value = updated;
    } else {
      // For create, use external ID
      submissionData.homework_external_id = homework.value.external_homework_id;

      // Create new submission
      const newSubmission = await courseService.submitHomework(submissionData);
      submission.value = newSubmission;
    }

    showSubmissionForm.value = false;
    alert(submission.value ? 'Submission updated successfully!' : 'Homework submitted successfully!');
  } catch (err: any) {
    // More detailed error message
    if (err.data) {
      if (err.data.homework) {
        submitError.value = `Homework field error: ${Array.isArray(err.data.homework) ? err.data.homework[0] : err.data.homework}`;
      } else if (err.data.detail) {
        submitError.value = err.data.detail;
      } else if (err.data.error) {
        submitError.value = err.data.error;
      } else if (typeof err.data === 'string') {
        submitError.value = err.data;
      } else {
        submitError.value = 'Failed to submit homework. Please check the form data and try again.';
      }
    } else {
      submitError.value = err.message || 'Failed to submit homework. Please try again.';
    }
  } finally {
    submitting.value = false;
  }
};

const cancelEdit = () => {
  showSubmissionForm.value = false;
  // Reset form to original submission data
  if (submission.value) {
    submissionForm.value = {
      submitted_homework_url: submission.value.submitted_homework_url,
      description: submission.value.description || '',
    };
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Recently';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return 'Recently';
  }
};

const formatInstructions = (text: string) => {
  if (!text) return '<p>No instructions provided.</p>';

  // Replace newlines with paragraphs
  const paragraphs = text.split('\n').filter(p => p.trim());
  return paragraphs.map(p => `<p>${p}</p>`).join('');
};

// Lifecycle
onMounted(() => {
  fetchHomeworkData();
});
</script>

<style scoped src="@/assets/css/homework-view.css"></style>
