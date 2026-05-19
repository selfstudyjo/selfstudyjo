<template>
  <div class="course-details-page">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading course details...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <div class="error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 class="error-title">Unable to load course</h3>
      <p class="error-message">{{ error }}</p>
      <button class="retry-btn" @click="fetchCourseData">Try Again</button>
      <router-link to="/courses" class="back-btn" style="margin-top: 0.75rem;">Back to Courses</router-link>
    </div>

    <div v-else-if="course" class="course-content-wrapper">
      <div class="breadcrumb">
        <router-link to="/courses" class="breadcrumb-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Courses
        </router-link>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">{{ course.title }}</span>
      </div>

      <div class="course-content">
        <div class="course-hero">
          <div class="course-image-container">
            <Planet
              :imageUrl="course.image_url"
              :courseName="course.title"
              :width="planetSize"
              :height="planetSize"
            />
            <div class="image-overlay"></div>
          </div>

          <div class="course-info">
            <div class="course-meta">
              <span class="course-badge">Course</span>
              <span class="course-date">Added {{ formatDate(course.date_added) }}</span>
            </div>

            <h1 class="course-title">{{ course.title }}</h1>

            <div class="course-stats">
              <div class="stat-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                <div class="stat-content">
                  <span class="stat-number">{{ lessons.length }}</span>
                  <span class="stat-label">Lessons</span>
                </div>
              </div>

              <div class="stat-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <div class="stat-content">
                  <span class="stat-number">{{ comments.length }}</span>
                  <span class="stat-label">Comments</span>
                </div>
              </div>
            </div>

            <div v-if="canShowRegistration && !regCheckLoading" class="course-registration-actions">
              <button
                v-if="!isUserRegistered"
                class="register-action-btn register-action-btn--enroll"
                :disabled="registrationLoading"
                @click="handleRegister"
              >
                <span v-if="registrationLoading" class="btn-spinner-lg"></span>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                <span>{{ registrationLoading ? 'Enrolling...' : 'Enroll in Course' }}</span>
              </button>
              <button
                v-else
                class="register-action-btn register-action-btn--enrolled"
                :disabled="registrationLoading"
                @click="handleUnregister"
              >
                <span v-if="registrationLoading" class="btn-spinner-lg"></span>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6 9 17l-5-5"></path>
                </svg>
                <span>{{ registrationLoading ? 'Working...' : 'Enrolled — Click to Unenroll' }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="main-content">
          <div class="mobile-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="mobile-tab"
              :class="{ active: activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              <span class="tab-icon">{{ tab.icon }}</span>
              <span class="tab-label">{{ tab.label }}</span>
            </button>
          </div>

          <div class="content-grid">
            <div class="left-column">
              <section class="section lessons-section" :class="{ active: activeTab === 'lessons' }">
                <div class="section-header">
                  <h2 class="section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                    Lessons
                  </h2>
                  <span class="section-count">{{ lessons.length }}</span>
                </div>

                <div class="lessons-list">
                  <div v-if="lessons.length === 0" class="empty-lessons">
                    <p>No lessons available for this course yet.</p>
                  </div>

                  <div
                    v-for="lesson in lessons"
                    :key="lesson.external_lesson_id"
                    class="lesson-card"
                  >
                    <div class="lesson-info">
                      <div class="lesson-header">
                        <h3 class="lesson-title">{{ lesson.title }}</h3>
                        <div class="lesson-badges">
                          <div v-if="lesson.hasQuiz && isUserRegistered" class="lesson-badge quiz-badge" @click="navigateToQuiz(lesson)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                              <path d="M4 22h16"></path>
                              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                            </svg>
                            <span>Take Quiz</span>
                          </div>

                          <div v-if="lesson.hasHomework" class="lesson-badge homework-badge" @click="navigateToHomework(lesson)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                              <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                            <span>Homework ({{ lesson.homeworkCount }})</span>
                          </div>
                        </div>
                      </div>

                      <p class="lesson-date">Added {{ formatDate(lesson.date_added) }}</p>

                      <div class="lesson-links">
                        <a v-if="lesson.reading_url" :href="lesson.reading_url" target="_blank" rel="noopener" class="lesson-link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                          Reading Material
                        </a>

                        <a v-if="lesson.source_code_url" :href="lesson.source_code_url" target="_blank" rel="noopener" class="lesson-link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                          </svg>
                          Source Code
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section class="section comments-section" :class="{ active: activeTab === 'comments' }">
                <div class="section-header">
                  <h2 class="section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Comments
                  </h2>
                  <span class="section-count">{{ comments.length }}</span>
                </div>

                <div class="add-comment-form">
                  <div class="form-header">
                    <h3 class="form-title">Add a Comment</h3>
                    <p class="form-subtitle" v-if="!authStore.user">
                      Please <router-link :to="loginLink">login</router-link> to comment
                    </p>
                  </div>
                  <form v-if="authStore.user" @submit.prevent="submitComment">
                    <div class="form-group">
                      <div class="mention-input-container">
                        <textarea
                          v-model="newComment"
                          ref="commentTextarea"
                          placeholder="Share your thoughts about this course... Use @ to mention users"
                          class="comment-input"
                          rows="4"
                          :disabled="submittingComment"
                          required
                          @input="handleMentionInput"
                          @keydown="handleMentionKeydown"
                        ></textarea>

                        <div
                          v-if="showMentionDropdown && filteredUsernames.length > 0"
                          class="mention-dropdown"
                          :style="{ top: mentionDropdownTop + 'px', left: mentionDropdownLeft + 'px' }"
                        >
                          <div
                            v-for="(username, index) in filteredUsernames"
                            :key="username"
                            class="mention-option"
                            :class="{ selected: selectedMentionIndex === index }"
                            @click="selectMention(username)"
                            @mouseenter="selectedMentionIndex = index"
                          >
                            <div class="mention-avatar" :style="{ background: getUserColor(username) }">
                              {{ getUserInitials(username) }}
                            </div>
                            <span class="mention-username">{{ username }}</span>
                          </div>
                        </div>
                      </div>

                      <div v-if="commentError" class="error-message" style="margin-top: 0.5rem;">
                        {{ commentError }}
                      </div>
                    </div>
                    <div class="form-actions">
                      <button type="submit" class="submit-btn" :disabled="!newComment.trim() || submittingComment">
                        <span v-if="submittingComment" class="btn-loading"></span>
                        <span v-else>Post Comment</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div class="comments-list">
                  <div v-if="comments.length === 0" class="empty-comments">
                    <p>No comments yet. Be the first to share your thoughts!</p>
                  </div>

                  <div v-for="comment in comments" :key="comment.external_comment_id" class="comment-card">
                    <div class="comment-header">
                      <div class="user-info">
                        <div class="user-avatar-container">
                          <img
                            v-if="comment.user_profile?.image_url && isImageUrlValid(comment.user_profile.image_url)"
                            :src="getSecureMediaUrl(comment.user_profile.image_url)"
                            :alt="comment.user_profile.username || 'User'"
                            class="user-avatar-image"
                            @error="handleAvatarError(comment.user_id)"
                          />
                          <div
                            v-else
                            class="user-avatar-generated"
                            :style="{ background: getUserColor(comment.user_profile?.username || comment.user_id) }"
                          >
                            {{ getUserInitials(comment.user_profile?.username || comment.user_id) }}
                          </div>
                        </div>

                        <div class="user-details">
                          <div class="user-name-row">
                            <span class="user-name">{{ comment.user_profile?.username || getUserDisplayName(comment.user_id) }}</span>
                            <span v-if="comment.user_profile?.first_name || comment.user_profile?.last_name" class="user-full-name">
                              ({{ comment.user_profile?.first_name || '' }} {{ comment.user_profile?.last_name || '' }})
                            </span>
                          </div>
                          <span class="comment-date">{{ formatDate(comment.date_added) }}</span>
                        </div>
                      </div>

                      <div v-if="comment.user_id === authStore.user?.id || comment.user_id === authStore.user?.username" class="comment-actions">
                        <button
                          class="action-btn delete-btn"
                          @click="deleteComment(comment.external_comment_id)"
                          :disabled="deletingCommentId === comment.external_comment_id"
                          aria-label="Delete comment"
                        >
                          <span v-if="deletingCommentId === comment.external_comment_id" class="btn-loading"></span>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div class="comment-content">
                      <p v-html="parseMentions(comment.content)"></p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div class="right-column">
              <section class="section description-section">
                <div class="section-header">
                  <h2 class="section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    About
                  </h2>
                </div>

                <div class="description-content">
                  <p>{{ course.description || 'No description available.' }}</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { courseService, type Course, type Lesson, type Comment, type Homework, type CourseRegistration } from '@/services/course.service';
import { quizService, type Quiz } from '@/services/quiz.service';
import { userService, type UserProfile } from '@/services/user.service';
import { notificationService } from '@/services/notification.service';
import { useAuthStore } from '@/store/auth';
import { serviceRegistry } from '@/services/config';
import Planet from '@/components/Planet.vue';
import { getSecureMediaUrl } from '@/utils/mediaUtils';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const course = ref<Course | null>(null);
const lessons = ref<(Lesson & {
  hasQuiz: boolean;
  quiz?: Quiz;
  hasHomework: boolean;
  homeworkCount: number;
})[]>([]);
const comments = ref<(Comment & { user_profile?: UserProfile })[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const activeTab = ref('lessons');
const newComment = ref('');
const submittingComment = ref(false);
const commentError = ref<string | null>(null);
const deletingCommentId = ref<string | null>(null);

// Registration state
const isUserRegistered = ref(false);
const userRegistration = ref<CourseRegistration | null>(null);
const registrationLoading = ref(false);
const regCheckLoading = ref(false);

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200);
const planetSize = computed(() => {
  const w = windowWidth.value;
  if (w < 360) return 220;
  if (w < 480) return 260;
  if (w < 768) return 320;
  if (w < 1024) return 380;
  if (w < 1440) return 440;
  return 500;
});

const handleResize = () => { windowWidth.value = window.innerWidth; };

const courseReplicaBaseUrl = ref<string | null>(null);
const quizReplicaBaseUrl = ref<string | null>(null);

const allUsernames = ref<string[]>([]);
const filteredUsernames = ref<string[]>([]);
const showMentionDropdown = ref(false);
const selectedMentionIndex = ref(0);
const mentionDropdownTop = ref(0);
const mentionDropdownLeft = ref(0);
const mentionSearch = ref('');
const commentTextarea = ref<HTMLTextAreaElement | null>(null);

const userProfileCache = new Map<string, UserProfile>();

const tabs = computed(() => [
  { id: 'lessons', label: 'Lessons', icon: '📚' },
  { id: 'comments', label: 'Comments', icon: '💬' },
]);

const canShowRegistration = computed(() =>
  authStore.isAuthenticated && authStore.hasActiveSubscription
);

const loginLink = computed(() => ({
  path: '/login',
  query: { redirect: route.fullPath, message: 'You need to login first to add a comment.' }
}));

/**
 * Returns every plausible user identifier — UUID, username, lowercased username.
 * The deployed selfstudy-course app stored `user_id` as either UUID or username
 * depending on when the registration was created.
 */
const buildUserIdCandidates = (): string[] => {
  const u = authStore.user;
  if (!u) return [];
  const list: string[] = [];
  if (u.id) list.push(String(u.id));
  if (u.username) {
    list.push(String(u.username));
    list.push(String(u.username).toLowerCase());
  }
  return [...new Set(list)];
};

const loadUserRegistrationStatus = async () => {
  if (!course.value || !authStore.user) {
    isUserRegistered.value = false;
    userRegistration.value = null;
    return;
  }
  const ids = buildUserIdCandidates();
  if (ids.length === 0) {
    isUserRegistered.value = false;
    userRegistration.value = null;
    return;
  }

  regCheckLoading.value = true;
  try {
    const reg = await courseService.getUserRegistrationForCourse(
      ids,
      course.value.external_course_id,
      courseReplicaBaseUrl.value || undefined
    );
    userRegistration.value = reg;
    isUserRegistered.value = !!reg;
  } catch (err) {
    console.warn('Failed to load registration status:', err);
    isUserRegistered.value = false;
    userRegistration.value = null;
  } finally {
    regCheckLoading.value = false;
  }
};

const handleRegister = async () => {
  if (!authStore.user || !course.value || registrationLoading.value) return;
  registrationLoading.value = true;
  try {
    const userId = String(authStore.user.id || authStore.user.username);
    const reg = await courseService.registerUserForCourse(
      userId,
      course.value.external_course_id,
      courseReplicaBaseUrl.value || undefined
    );
    userRegistration.value = reg;
    isUserRegistered.value = true;
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    if (err?.status === 400 && msg.includes('already registered')) {
      await loadUserRegistrationStatus();
    } else {
      console.error('Enroll failed:', err);
      alert(err?.message || 'Failed to enroll in this course. Please try again.');
    }
  } finally {
    registrationLoading.value = false;
  }
};

const handleUnregister = async () => {
  if (!authStore.user || !course.value || registrationLoading.value) return;
  if (!confirm(`Unenroll from "${course.value.title}"?`)) return;

  registrationLoading.value = true;
  try {
    if (userRegistration.value?.external_id) {
      await courseService.unregisterUserFromCourse(
        userRegistration.value.external_id,
        courseReplicaBaseUrl.value || undefined
      );
    } else {
      await courseService.unregisterUserFromCourseByCourse(
        buildUserIdCandidates(),
        course.value.external_course_id,
        courseReplicaBaseUrl.value || undefined
      );
    }
    userRegistration.value = null;
    isUserRegistered.value = false;
  } catch (err: any) {
    console.error('Unenroll failed:', err);
    alert(err?.message || 'Failed to unenroll. Please try again.');
  } finally {
    registrationLoading.value = false;
  }
};

const fetchCourseData = async () => {
  const courseId = route.params.id as string;
  if (!courseId) { error.value = 'Invalid course ID'; return; }

  loading.value = true;
  error.value = null;

  try {
    const courseReplica = await courseService.getRandomCourseReplica();
    if (!courseReplica) throw new Error('No course service replicas available');
    courseReplicaBaseUrl.value = courseReplica;

    const quizReplica = await quizService.getRandomQuizReplica();
    if (!quizReplica) throw new Error('No exam service replicas available');
    quizReplicaBaseUrl.value = quizReplica;

    const [fetchedCourse, fetchedLessons, fetchedComments] = await Promise.all([
      courseService.getCourse(courseId, courseReplicaBaseUrl.value),
      courseService.getCourseLessons(courseId, courseReplicaBaseUrl.value),
      courseService.getCourseComments(courseId, courseReplicaBaseUrl.value)
    ]);

    course.value = fetchedCourse;

    const quizzesByLessonId = new Map<string, Quiz>();
    try {
      const lightQuizzes = await quizService.getQuizzesForCourseLight(courseId, quizReplicaBaseUrl.value);
      lightQuizzes.forEach(q => {
        if (q.lesson_id) {
          quizzesByLessonId.set(q.lesson_id, { external_id: q.external_id, lesson_id: q.lesson_id } as Quiz);
        }
      });
    } catch (err) {}

    const homeworksByLessonId = new Map<string, Homework[]>();
    try {
      const allHomeworks = await courseService.getHomeworksForCourse(courseId, courseReplicaBaseUrl.value);
      allHomeworks.forEach(hw => {
        if (hw.lesson_external_id) {
          if (!homeworksByLessonId.has(hw.lesson_external_id)) {
            homeworksByLessonId.set(hw.lesson_external_id, []);
          }
          homeworksByLessonId.get(hw.lesson_external_id)!.push(hw);
        }
      });
    } catch (err) {}

    lessons.value = fetchedLessons.map(lesson => {
      const quiz = quizzesByLessonId.get(lesson.external_lesson_id);
      const lessonHomeworks = homeworksByLessonId.get(lesson.external_lesson_id) || [];
      return {
        ...lesson,
        hasQuiz: !!quiz,
        quiz,
        hasHomework: lessonHomeworks.length > 0,
        homeworkCount: lessonHomeworks.length
      };
    });

    const uniqueUserIds = [...new Set(fetchedComments.map(c => c.user_id))];
    const profilePromises = uniqueUserIds.map(async (userId) => {
      if (userProfileCache.has(userId)) return;
      try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let profile: UserProfile | null = null;
        if (uuidRegex.test(userId)) {
          profile = await userService.getUserProfile(userId);
        } else {
          try { profile = await userService.getUserProfileByUsername(userId); } catch (err) {}
        }
        if (profile) userProfileCache.set(userId, profile);
      } catch (err) {}
    });
    await Promise.all(profilePromises);

    comments.value = fetchedComments.map(comment => ({
      ...comment,
      user_profile: userProfileCache.get(comment.user_id)
    }));

    // Run registration check against the deployed selfstudy-course app
    await loadUserRegistrationStatus();

    await fetchAllUsernames();
  } catch (err: any) {
    error.value = err.message || 'Failed to load course details. Please try again.';
  } finally {
    loading.value = false;
  }
};

const fetchAllUsernames = async () => {
  try { allUsernames.value = await userService.getAllUsernames(); }
  catch (err) { allUsernames.value = []; }
};

const handleAvatarError = (_userId: string) => {};

const isImageUrlValid = (url: string): boolean => {
  if (!url) return false;
  const placeholderPatterns = [
    'default.jpg', 'placeholder', 'missing.png', 'no-image',
    'default-profile', 'anonymous', 'null', 'undefined'
  ];
  return !placeholderPatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
};

const handleMentionInput = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement;
  const value = textarea.value;
  const cursorPosition = textarea.selectionStart;
  const textBeforeCursor = value.substring(0, cursorPosition);
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');

  if (lastAtIndex >= 0) {
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    const wordMatch = textAfterAt.match(/^(\w+)/);

    if (wordMatch) {
      mentionSearch.value = wordMatch[1].toLowerCase();
      filteredUsernames.value = allUsernames.value.filter(username =>
        username.toLowerCase().includes(mentionSearch.value) && username !== authStore.user?.username
      );

      if (filteredUsernames.value.length > 0) {
        showMentionDropdown.value = true;
        selectedMentionIndex.value = 0;

        const textareaStyles = window.getComputedStyle(textarea);
        const lineHeight = parseInt(textareaStyles.lineHeight);
        const paddingTop = parseInt(textareaStyles.paddingTop);
        const paddingLeft = parseInt(textareaStyles.paddingLeft);

        const lines = textBeforeCursor.substring(0, lastAtIndex).split('\n');
        const lineNumber = lines.length;
        mentionDropdownTop.value = (lineNumber * lineHeight) + paddingTop + lineHeight;
        mentionDropdownLeft.value = paddingLeft;
      } else {
        showMentionDropdown.value = false;
      }
    } else {
      showMentionDropdown.value = false;
    }
  } else {
    showMentionDropdown.value = false;
  }
};

const handleMentionKeydown = (event: KeyboardEvent) => {
  if (!showMentionDropdown.value) return;
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedMentionIndex.value = Math.min(selectedMentionIndex.value + 1, filteredUsernames.value.length - 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedMentionIndex.value = Math.max(selectedMentionIndex.value - 1, 0);
      break;
    case 'Enter':
    case 'Tab':
      if (showMentionDropdown.value && filteredUsernames.value.length > 0) {
        event.preventDefault();
        selectMention(filteredUsernames.value[selectedMentionIndex.value]);
      }
      break;
    case 'Escape':
      showMentionDropdown.value = false;
      break;
  }
};

const selectMention = (username: string) => {
  const textarea = commentTextarea.value;
  if (!textarea) return;

  const value = textarea.value;
  const cursorPosition = textarea.selectionStart;
  const textBeforeCursor = value.substring(0, cursorPosition);
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');

  if (lastAtIndex >= 0) {
    const textAfterCursor = value.substring(cursorPosition);
    const wordAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    const wordMatch = wordAfterAt.match(/^(\w+)/);

    if (wordMatch) {
      const newText = textBeforeCursor.substring(0, lastAtIndex) + `@${username} ` + textAfterCursor;
      newComment.value = newText;
      showMentionDropdown.value = false;

      nextTick(() => {
        const newCursorPosition = lastAtIndex + username.length + 2;
        textarea.focus();
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      });
    }
  }
};

const parseMentions = (text: string) => {
  if (!text) return '';
  return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
};

const extractMentions = (text: string): string[] => {
  if (!text) return [];
  const mentions = text.match(/@(\w+)/g);
  if (!mentions) return [];
  return [...new Set(mentions.map(m => m.substring(1)))];
};

const createMentionNotifications = async (commentContent: string, commentId: string) => {
  const mentions = extractMentions(commentContent);
  if (mentions.length === 0 || !authStore.user?.username || !course.value) return;

  for (const username of mentions) {
    if (username === authStore.user.username) continue;
    try {
      serviceRegistry.clearCache();
      await notificationService.createNotification({
        title: 'You were mentioned in a comment',
        message: `@${authStore.user.username} mentioned you in a comment on "${course.value.title}"`,
        notification_type: 'personal',
        sender: authStore.user.username,
        recipient: username,
        course_url: `${window.location.origin}/course/${course.value.external_course_id}`,
        comment_id: commentId
      });
    } catch (err) {}
  }
};

const submitComment = async () => {
  if (!newComment.value.trim() || !course.value || !authStore.user?.id) return;

  submittingComment.value = true;
  commentError.value = null;

  try {
    serviceRegistry.clearCache();

    const userId = authStore.user.username || authStore.user.id;

    const commentData = {
      external_comment_id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: newComment.value.trim(),
      user_id: userId,
      course: course.value.external_course_id,
    };

    const newCommentObj = await courseService.createComment(commentData, courseReplicaBaseUrl.value || undefined);

    let userProfile: UserProfile | undefined;
    try {
      if (authStore.user.username) {
        userProfile = await userService.getUserProfileByUsername(authStore.user.username);
      } else {
        userProfile = await userService.getUserProfile(authStore.user.id);
      }
      if (userProfile) userProfileCache.set(userId, userProfile);
    } catch (err) {}

    comments.value.unshift({ ...newCommentObj, user_profile: userProfile });
    newComment.value = '';

    await createMentionNotifications(commentData.content, newCommentObj.external_comment_id);
  } catch (err: any) {
    commentError.value = err.message || 'Failed to submit comment. Please try again.';
  } finally {
    submittingComment.value = false;
  }
};

const deleteComment = async (commentId: string) => {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  deletingCommentId.value = commentId;
  try {
    serviceRegistry.clearCache();
    await courseService.deleteComment(commentId, courseReplicaBaseUrl.value || undefined);
    comments.value = comments.value.filter(comment => comment.external_comment_id !== commentId);
  } catch (err: any) {
    alert('Failed to delete comment. Please try again.');
  } finally {
    deletingCommentId.value = null;
  }
};

const navigateToQuiz = (lesson: any) => {
  if (!lesson.hasQuiz || !lesson.quiz) return;
  try {
    sessionStorage.setItem(`quiz_${lesson.quiz.external_id}`, JSON.stringify(lesson.quiz));
  } catch (e) {
    console.warn('Failed to cache quiz in sessionStorage:', e);
  }
  router.push({
    path: '/take-quiz',
    query: {
      quizId: lesson.quiz.external_id,
      lessonId: lesson.external_lesson_id,
      courseId: course.value?.external_course_id
    }
  });
};

const navigateToHomework = (lesson: any) => {
  if (!lesson.hasHomework) return;
  router.push({ path: `/course/${route.params.id}/lesson/${lesson.external_lesson_id}/homework` });
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
  } catch { return 'Recently'; }
};

const getUserInitials = (userId: string) => {
  if (!userId) return 'U';
  if (!userId.includes('-')) return userId.substring(0, 2).toUpperCase();
  return userId.charAt(0).toUpperCase();
};

const getUserDisplayName = (userId: string) => {
  if (!userId) return 'User';
  if (userId === authStore.user?.id || userId === authStore.user?.username) return 'You';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(userId)) return 'User';
  return userId;
};

const getUserColor = (userId: string) => {
  const colors = ['#667eea', '#764ba2', '#f56565', '#ed8936', '#48bb78', '#38b2ac', '#4299e1', '#9f7aea', '#ed64a6', '#f6ad55'];
  const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

const handleDocumentClick = (event: MouseEvent) => {
  if (showMentionDropdown.value && commentTextarea.value && !commentTextarea.value.contains(event.target as Node)) {
    showMentionDropdown.value = false;
  }
};

watch(
  () => [authStore.isAuthenticated, authStore.user?.id, authStore.user?.username, authStore.hasActiveSubscription],
  () => {
    if (course.value && authStore.isAuthenticated) {
      loadUserRegistrationStatus();
    } else {
      isUserRegistered.value = false;
      userRegistration.value = null;
    }
  }
);

onMounted(() => {
  fetchCourseData();
  window.addEventListener('resize', handleResize);
  document.addEventListener('click', handleDocumentClick);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('click', handleDocumentClick);
});
</script>

<style scoped src="@/assets/css/course-details.css"></style>

<style scoped>
.course-registration-actions {
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.register-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.register-action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25);
}

.register-action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.register-action-btn--enroll {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.register-action-btn--enrolled {
  background: linear-gradient(135deg, #48bb78, #38a169);
}

.register-action-btn--enrolled:hover:not(:disabled) {
  background: linear-gradient(135deg, #e53e3e, #c53030);
}

.btn-spinner-lg {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: detail-spin 0.7s linear infinite;
}

@keyframes detail-spin {
  to { transform: rotate(360deg); }
}
</style>