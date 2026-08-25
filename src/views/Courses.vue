<template>
  <div class="courses-page">
    <!-- Header Section -->
    <div class="page-header glass-effect">
      <div class="header-content">
        <h1 class="page-title">{{ $t('Explore Courses') }}</h1>
        <p class="page-subtitle">{{ $t('Expand your knowledge with our curated courses') }}</p>
      </div>
      <div class="header-actions">
        <div class="search-container">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('Search courses...')"
            class="search-input"
            @keyup.enter="performSearch"
            @input="handleSearchInput"
          >
          <button class="search-btn" @click="performSearch">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Filters Section -->
    <div class="filters-section">
      <div class="filters-container">
        <div class="filter-group">
          <label for="sortBy" class="filter-label">{{ $t('Sort by:') }}</label>
          <select id="sortBy" v-model="sortBy" class="filter-select" @change="handleSortChange">
            <option value="-date_added">{{ $t('Newest First') }}</option>
            <option value="date_added">{{ $t('Oldest First') }}</option>
            <option value="title">{{ $t('Title (A-Z)') }}</option>
            <option value="-title">{{ $t('Title (Z-A)') }}</option>
          </select>
        </div>
        <div class="results-count">
          {{ $t('Showing {v0} of {v1} courses', { v0: displayedCourses.length, v1: filteredCourses.length }) }}
          <span v-if="searchQuery"> {{ $t('for "{v0}"', { v0: searchQuery }) }}</span>
          <span v-if="totalPages > 1"> {{ $t('(Page {v0} of {v1})', { v0: currentPage, v1: totalPages }) }}</span>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ $t('Loading courses...') }}</p>
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
      <h3 class="error-title">{{ $t('Unable to load courses') }}</h3>
      <p class="error-message">{{ error }}</p>
      <button class="retry-btn" @click="fetchCourses">{{ $t('Try Again') }}</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="displayedCourses.length === 0 && !loading" class="empty-state">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      </div>
      <h3 class="empty-title">{{ $t('No courses found') }}</h3>
      <p class="empty-message">
        {{ searchQuery ? `No courses found for "${searchQuery}". Try different keywords.` : 'No courses available at the moment' }}
      </p>
      <button v-if="searchQuery" class="clear-search-btn" @click="clearSearch">{{ $t('Clear Search') }}</button>
    </div>

    <!-- Courses Grid -->
    <div v-else class="courses-grid">
      <div
        v-for="course in displayedCourses"
        :key="course.external_course_id"
        class="course-card"
        @click="navigateToCourse(course.external_course_id)"
      >
        <div class="course-image-container">
          <Planet
            :imageUrl="course.image_url"
            :courseName="course.title"
            :width="300"
            :height="200"
          />
          <div class="course-overlay"></div>

          <!-- Registration overlay button -->
          <div
            v-if="canShowRegistration && !regCheckLoading"
            class="enroll-overlay"
            @click.stop
          >
            <button
              v-if="!isRegistered(course.external_course_id)"
              class="enroll-btn enroll-btn--enroll"
              :disabled="!!registrationLoading[course.external_course_id]"
              @click.stop="handleRegister(course)"
            >
              <span v-if="registrationLoading[course.external_course_id]" class="btn-spinner"></span>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              <span>{{ registrationLoading[course.external_course_id] ? 'Enrolling...' : 'Enroll' }}</span>
            </button>
            <button
              v-else
              class="enroll-btn enroll-btn--unenroll"
              :disabled="!!registrationLoading[course.external_course_id]"
              @click.stop="handleUnregister(course)"
            >
              <span v-if="registrationLoading[course.external_course_id]" class="btn-spinner"></span>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5"></path>
              </svg>
              <span>{{ registrationLoading[course.external_course_id] ? 'Working...' : 'Enrolled' }}</span>
            </button>
          </div>
        </div>
        <div class="course-content">
          <div class="course-header">
            <h3 class="course-title">{{ course.title || 'Untitled Course' }}</h3>
            <span class="course-badge">{{ $t('Course') }}</span>
          </div>
          <p class="course-description">
            {{ truncateDescription(course.description) }}
          </p>
          <div class="course-meta">
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <span v-if="countsLoading[course.external_course_id]" class="count-loading">...</span>
              <span v-else>{{ $t('{v0} lessons', { v0: courseCounts[course.external_course_id]?.lessons ?? course.lessons_count ?? 0 }) }}</span>
            </div>
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span v-if="countsLoading[course.external_course_id]" class="count-loading">...</span>
              <span v-else>{{ $t('{v0} comments', { v0: courseCounts[course.external_course_id]?.comments ?? course.comments_count ?? 0 }) }}</span>
            </div>
          </div>
          <div class="course-footer">
            <span class="course-date">{{ $t('Added {v0}', { v0: formatDate(course.date_added) }) }}</span>
            <button class="view-course-btn">
              {{ $t('View Details') }}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1 && displayedCourses.length > 0" class="pagination-container">
      <div class="pagination">
        <button class="pagination-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          {{ $t('Previous') }}
        </button>
        <div class="page-numbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            class="page-number"
            :class="{ active: page === currentPage }"
            @click="goToPage(page)"
          >{{ page }}</button>
          <span v-if="showEllipsis" class="page-ellipsis">...</span>
        </div>
        <button class="pagination-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">
          {{ $t('Next') }}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      <div class="pagination-info">
        {{ $t('Page {v0} of {v1} • {v2} total courses', { v0: currentPage, v1: totalPages, v2: filteredCourses.length }) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { courseService, type Course, type CourseRegistration } from '@/services/course.service';
import { notificationService } from '@/services/notification.service';
import { useAuthStore } from '@/store/auth';
import Planet from '@/components/Planet.vue';

const router = useRouter();
const authStore = useAuthStore();

// State
const allCourses = ref<Course[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const sortBy = ref('-date_added');
const currentPage = ref(1);
const pageSize = ref(6);

// Counts state
const courseCounts = ref<Record<string, { lessons: number; comments: number }>>({});
const countsLoading = ref<Record<string, boolean>>({});

// Registration state: external_course_id -> CourseRegistration
const userRegistrations = ref<Record<string, CourseRegistration>>({});
const registrationLoading = ref<Record<string, boolean>>({});
const regCheckLoading = ref(false);

const canShowRegistration = computed(() =>
  authStore.isAuthenticated && authStore.hasActiveSubscription
);

const isRegistered = (courseExternalId: string): boolean =>
  !!userRegistrations.value[courseExternalId];

/**
 * Build the list of identifiers we should query the backend with.
 * The deployed selfstudy-course app stores `user_id` as a plain string and
 * historically it may be either the UUID or the username (lowercased).
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

// Computed
const filteredCourses = computed(() => {
  let courses = [...allCourses.value];

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase();
    courses = courses.filter(course =>
      course.title.toLowerCase().includes(query) ||
      course.description.toLowerCase().includes(query)
    );
  }

  if (sortBy.value === 'title') {
    courses.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy.value === '-title') {
    courses.sort((a, b) => b.title.localeCompare(a.title));
  } else if (sortBy.value === 'date_added') {
    courses.sort((a, b) => new Date(a.date_added || '').getTime() - new Date(b.date_added || '').getTime());
  } else if (sortBy.value === '-date_added') {
    courses.sort((a, b) => new Date(b.date_added || '').getTime() - new Date(a.date_added || '').getTime());
  }

  return courses;
});

const totalPages = computed(() => Math.ceil(filteredCourses.value.length / pageSize.value));

const displayedCourses = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value;
  const endIndex = startIndex + pageSize.value;
  return filteredCourses.value.slice(startIndex, endIndex);
});

const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages.value, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

const showEllipsis = computed(() => totalPages.value > visiblePages.value.length);

/**
 * Fetch ALL registrations for this user from the deployed selfstudy-course
 * app, trying every plausible identifier (UUID, username, lowercase username).
 */
const loadUserRegistrations = async () => {
  const ids = buildUserIdCandidates();
  if (ids.length === 0) {
    userRegistrations.value = {};
    return;
  }

  regCheckLoading.value = true;
  try {
    const regs = await courseService.getUserRegistrations(ids);
    const indexed: Record<string, CourseRegistration> = {};
    regs.forEach(r => {
      const key = r.course_external_id || r.course;
      if (key) indexed[key] = r;
    });
    userRegistrations.value = indexed;
  } catch (err) {
    console.warn('Failed to load user registrations:', err);
    userRegistrations.value = {};
  } finally {
    regCheckLoading.value = false;
  }
};

const handleRegister = async (course: Course) => {
  if (!authStore.user) return;
  const courseId = course.external_course_id;
  if (registrationLoading.value[courseId]) return;

  registrationLoading.value[courseId] = true;
  try {
    // Use UUID id first (most stable); fall back to username if no id
    const userId = String(authStore.user.id || authStore.user.username);
    const reg = await courseService.registerUserForCourse(userId, courseId);
    userRegistrations.value = { ...userRegistrations.value, [courseId]: reg };
    // The operators, not the student — they are looking at the button they just
    // pressed and do not need telling. `notify` never throws; an enrolment must
    // not fail because the bell service is cold.
    notificationService.notifyAdmins('course.enrolled', {
      student: authStore.user.username,
      course: course.title,
      courseId,
    });
  } catch (err: any) {
    // Backend returns 400 'User is already registered' when row exists under another identifier
    const msg = (err?.message || '').toLowerCase();
    if (err?.status === 400 && msg.includes('already registered')) {
      // Re-sync state from backend
      await loadUserRegistrations();
    } else {
      console.error('Enroll failed:', err);
      alert(err?.message || 'Failed to enroll in this course. Please try again.');
    }
  } finally {
    registrationLoading.value[courseId] = false;
  }
};

const handleUnregister = async (course: Course) => {
  if (!authStore.user) return;
  const courseId = course.external_course_id;
  if (registrationLoading.value[courseId]) return;

  if (!confirm(`Unenroll from "${course.title}"?`)) return;

  registrationLoading.value[courseId] = true;
  try {
    const reg = userRegistrations.value[courseId];
    if (reg?.external_id) {
      await courseService.unregisterUserFromCourse(reg.external_id);
    } else {
      // Fall back: search the deployed app using every identifier and delete
      await courseService.unregisterUserFromCourseByCourse(
        buildUserIdCandidates(),
        courseId
      );
    }
    const copy = { ...userRegistrations.value };
    delete copy[courseId];
    userRegistrations.value = copy;
  } catch (err: any) {
    console.error('Unenroll failed:', err);
    alert(err?.message || 'Failed to unenroll. Please try again.');
  } finally {
    registrationLoading.value[courseId] = false;
  }
};

const fetchCountsForCourse = async (courseId: string, baseUrl: string) => {
  if (courseCounts.value[courseId] !== undefined) return;
  countsLoading.value[courseId] = true;
  try {
    const [lessons, comments] = await Promise.allSettled([
      courseService.getCourseLessons(courseId, baseUrl),
      courseService.getCourseComments(courseId, baseUrl),
    ]);
    courseCounts.value[courseId] = {
      lessons: lessons.status === 'fulfilled' ? lessons.value.length : 0,
      comments: comments.status === 'fulfilled' ? comments.value.length : 0,
    };
  } catch (err) {
    courseCounts.value[courseId] = { lessons: 0, comments: 0 };
  } finally {
    countsLoading.value[courseId] = false;
  }
};

const fetchCountsForDisplayedCourses = async (courses: Course[]) => {
  if (courses.length === 0) return;
  const baseUrl = await courseService.getRandomCourseReplica();
  if (!baseUrl) return;
  const pending = courses.filter(c => courseCounts.value[c.external_course_id] === undefined);
  if (pending.length === 0) return;
  await Promise.all(pending.map(course => fetchCountsForCourse(course.external_course_id, baseUrl)));
};

/**
 * Load the whole catalogue, once, and page it here.
 *
 * This used to ask app 19 for `page=1&page_size=6` and then measure the
 * catalogue by what came back — six rows, so one page, so no pager, so 24
 * courses looked like 6. The service does return the total in `count`, but it
 * also ignores `search` and `ordering` entirely, so paging on the server would
 * mean searching and sorting a six-row window of a set the user cannot reach.
 * Both problems have the same answer: fetch everything, filter, sort and slice
 * locally. `getAllCourses()` follows the pages if the service ever starts
 * windowing by default.
 */
const fetchCourses = async () => {
  loading.value = true;
  error.value = null;
  try {
    allCourses.value = await courseService.getAllCourses();
  } catch (err: any) {
    error.value = err.message || 'Failed to load courses. Please try again.';
    allCourses.value = [];
  } finally {
    loading.value = false;
  }
};

// No debounce: the query filters an array that is already in memory, so there is
// no request to hold back — and delaying only the page reset while the grid
// filters instantly is what leaves a reader on page 3 of a two-page result.
const handleSearchInput = () => {
  performSearch();
};

// Searching and sorting are local — every course is already loaded, and the
// service would ignore `search` and `ordering` anyway. Nothing here refetches.
const performSearch = () => {
  currentPage.value = 1;
};

const clearSearch = () => {
  searchQuery.value = '';
  currentPage.value = 1;
};

const handleSortChange = () => {
  currentPage.value = 1;
};

const goToPage = (page: number) => {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const navigateToCourse = (courseId: string) => {
  router.push(`/course/${courseId}`);
};

const truncateDescription = (description: string, maxLength: number = 100) => {
  if (!description) return 'No description available';
  const trimmed = description.trim();
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) + '...' : trimmed;
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

// A search that narrows the set to fewer pages must not leave the reader parked
// on page 4 of 2, which renders as an empty grid with no way back.
watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = Math.max(1, pages);
});

watch(displayedCourses, (courses) => {
  if (courses.length > 0) fetchCountsForDisplayedCourses(courses);
}, { immediate: false });

watch(
  () => [authStore.isAuthenticated, authStore.user?.id, authStore.user?.username, authStore.hasActiveSubscription],
  () => {
    if (canShowRegistration.value) {
      loadUserRegistrations();
    } else {
      userRegistrations.value = {};
    }
  }
);

onMounted(async () => {
  await fetchCourses();
  if (displayedCourses.value.length > 0) {
    fetchCountsForDisplayedCourses(displayedCourses.value);
  }
  if (canShowRegistration.value) {
    await loadUserRegistrations();
  }
});
</script>

<style scoped src="@/assets/css/courses.css"></style>

<style scoped>
.enroll-overlay {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 5;
}

.enroll-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  border: none;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--sfs-on-accent, #fff);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.enroll-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.enroll-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.enroll-btn--enroll {
  background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #764ba2));
}

.enroll-btn--unenroll {
  background: linear-gradient(135deg, var(--sfs-success, #48bb78), var(--sfs-success, #38a169));
  /* Its own ink. The base rule this shares with the other variants can only
     hold one `color`, and that one belongs to whichever variant came first —
     so an amber or green button inherited the ink meant for the indigo one.
     A fill decides its own ink. */
  color: var(--sfs-on-success, #fff);
}

.enroll-btn--unenroll:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--sfs-danger, #e53e3e), var(--sfs-danger, #c53030));
  /* Its own ink. The base rule this shares with the other variants can only
     hold one `color`, and that one belongs to whichever variant came first —
     so an amber or green button inherited the ink meant for the indigo one.
     A fill decides its own ink. */
  color: var(--sfs-on-danger, #fff);
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.4);
  border-top-color: var(--sfs-border-strong, #fff);
  border-radius: 50%;
  animation: enroll-spin 0.7s linear infinite;
}

@keyframes enroll-spin {
  to { transform: rotate(360deg); }
}
</style>