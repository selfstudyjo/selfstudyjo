<template>
  <div class="courses-page">
    <!-- Header Section -->
    <div class="page-header glass-effect">
      <div class="header-content">
        <h1 class="page-title">Explore Courses</h1>
        <p class="page-subtitle">Expand your knowledge with our curated courses</p>
      </div>
      <div class="header-actions">
        <div class="search-container">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search courses..."
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
          <label for="sortBy" class="filter-label">Sort by:</label>
          <select id="sortBy" v-model="sortBy" class="filter-select" @change="handleSortChange">
            <option value="-date_added">Newest First</option>
            <option value="date_added">Oldest First</option>
            <option value="title">Title (A-Z)</option>
            <option value="-title">Title (Z-A)</option>
          </select>
        </div>
        <div class="results-count">
          <span v-if="useClientSidePagination">
            ⚠️ Client-side pagination active
          </span>
          Showing {{ displayedCourses.length }} of {{ filteredCourses.length }} courses
          <span v-if="searchQuery"> for "{{ searchQuery }}"</span>
          <span v-else> (Page {{ currentPage }} of {{ totalPages }})</span>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading courses...</p>
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
      <h3 class="error-title">Unable to load courses</h3>
      <p class="error-message">{{ error }}</p>
      <button class="retry-btn" @click="fetchCourses">
        Try Again
      </button>
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
      <h3 class="empty-title">No courses found</h3>
      <p class="empty-message">
        {{ searchQuery ? `No courses found for "${searchQuery}". Try different keywords.` : 'No courses available at the moment' }}
      </p>
      <button v-if="searchQuery" class="clear-search-btn" @click="clearSearch">
        Clear Search
      </button>
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
          <!-- 3D Planet -->
          <Planet
            :imageUrl="course.image_url"
            :courseName="course.title"
            :width="300"
            :height="200"
          />
          <div class="course-overlay"></div>
        </div>
        <div class="course-content">
          <div class="course-header">
            <h3 class="course-title">{{ course.title || 'Untitled Course' }}</h3>
            <span class="course-badge">Course</span>
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
              <span>{{ course.lessons_count || 0 }} lessons</span>
            </div>
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>{{ course.comments_count || 0 }} comments</span>
            </div>
          </div>
          <div class="course-footer">
            <span class="course-date">
              Added {{ formatDate(course.date_added) }}
            </span>
            <button class="view-course-btn">
              View Details
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
        <button
          class="pagination-btn"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Previous
        </button>

        <div class="page-numbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            class="page-number"
            :class="{ active: page === currentPage }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
          <span v-if="showEllipsis" class="page-ellipsis">...</span>
        </div>

        <button
          class="pagination-btn"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Next
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      <div class="pagination-info">
        Page {{ currentPage }} of {{ totalPages }} • {{ filteredCourses.length }} total courses
        <span v-if="useClientSidePagination" class="client-side-warning">
          (Client-side pagination active)
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { courseService, type Course, type CourseFilters } from '@/services/course.service';
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
const searchTimeout = ref<NodeJS.Timeout | null>(null);
const debounceDelay = 500;
const useClientSidePagination = ref(false);

// Computed properties
const filteredCourses = computed(() => {
  console.log('🔄 [Computed] Filtering courses...');
  console.log('Total courses:', allCourses.value.length);
  console.log('Search query:', searchQuery.value);
  console.log('Sort by:', sortBy.value);

  let courses = [...allCourses.value];

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase();
    courses = courses.filter(course =>
      course.title.toLowerCase().includes(query) ||
      course.description.toLowerCase().includes(query)
    );
  }

  // Apply sorting
  if (sortBy.value === 'title') {
    courses.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy.value === '-title') {
    courses.sort((a, b) => b.title.localeCompare(a.title));
  } else if (sortBy.value === 'date_added') {
    courses.sort((a, b) => new Date(a.date_added || '').getTime() - new Date(b.date_added || '').getTime());
  } else if (sortBy.value === '-date_added') {
    courses.sort((a, b) => new Date(b.date_added || '').getTime() - new Date(a.date_added || '').getTime());
  }

  console.log('Filtered courses count:', courses.length);
  return courses;
});

const totalPages = computed(() => {
  const pages = Math.ceil(filteredCourses.value.length / pageSize.value);
  console.log('📄 Total pages:', pages);
  return pages;
});

const displayedCourses = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value;
  const endIndex = startIndex + pageSize.value;
  const courses = filteredCourses.value.slice(startIndex, endIndex);
  console.log('📋 Displaying courses', currentPage.value, ':', courses.length);
  return courses;
});

const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages.value, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
});

const showEllipsis = computed(() => totalPages.value > visiblePages.value.length);

// Methods
const fetchCourses = async () => {
  console.log('🚀 [fetchCourses] Starting...');
  loading.value = true;
  error.value = null;

  try {
    console.log('📡 [fetchCourses] Attempting server-side pagination...');

    const filters: CourseFilters = {
      page: currentPage.value,
      page_size: pageSize.value,
      ordering: sortBy.value,
    };

    if (searchQuery.value.trim()) {
      filters.search = searchQuery.value.trim();
    }

    console.log('📋 [fetchCourses] Server filters:', filters);
    const response = await courseService.getCourses(filters);

    console.log('✅ [fetchCourses] Server response:', {
      count: response.count,
      results: response.results.length,
      next: response.next,
      previous: response.previous
    });

    // If server returns paginated results
    if (response.count !== undefined && response.results) {
      console.log('✅ [fetchCourses] Server-side pagination working');
      useClientSidePagination.value = false;
      allCourses.value = response.results;
    } else {
      console.log('⚠️ [fetchCourses] Server-side pagination not supported, using client-side');
      useClientSidePagination.value = true;

      // Fetch all courses without pagination
      const allResponse = await courseService.getCourses({});
      allCourses.value = allResponse.results || [];

      console.log('📦 [fetchCourses] Loaded all courses:', allCourses.value.length);
    }

  } catch (err: any) {
    console.error('❌ [fetchCourses] Error:', err);

    // Fallback: Load all courses and use client-side pagination
    console.log('🔄 [fetchCourses] Falling back to client-side pagination...');
    useClientSidePagination.value = true;

    try {
      const allResponse = await courseService.getCourses({});
      allCourses.value = allResponse.results || [];
      console.log('✅ [fetchCourses] Loaded all courses for client-side:', allCourses.value.length);
    } catch (fallbackError) {
      console.error('❌ [fetchCourses] Fallback also failed:', fallbackError);
      error.value = err.message || 'Failed to load courses. Please try again.';
      allCourses.value = [];
    }
  } finally {
    loading.value = false;
    console.log('🏁 [fetchCourses] Finished');
  }
};

const handleSearchInput = () => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }

  searchTimeout.value = setTimeout(() => {
    performSearch();
  }, debounceDelay);
};

const performSearch = () => {
  console.log('🔍 [performSearch] Searching for:', searchQuery.value);
  currentPage.value = 1;

  if (useClientSidePagination.value) {
    console.log('🔄 [performSearch] Using client-side search');
  } else {
    console.log('🔄 [performSearch] Using server-side search');
    fetchCourses();
  }
};

const clearSearch = () => {
  console.log('🗑️ [clearSearch] Clearing search');
  searchQuery.value = '';
  currentPage.value = 1;
  fetchCourses();
};

const handleSortChange = () => {
  console.log('📊 [handleSortChange] Sorting by:', sortBy.value);
  currentPage.value = 1;

  if (useClientSidePagination.value) {
    console.log('🔄 [handleSortChange] Using client-side sorting');
  } else {
    console.log('🔄 [handleSortChange] Using server-side sorting');
    fetchCourses();
  }
};

const goToPage = (page: number) => {
  console.log('📖 [goToPage] Going to page:', page);
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
  return trimmed.length > maxLength
    ? trimmed.substring(0, maxLength) + '...'
    : trimmed;
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

// Watchers
watch(() => currentPage.value, () => {
  console.log('📄 [Watch] Page changed to:', currentPage.value);

  if (!useClientSidePagination.value) {
    console.log('🔄 [Watch] Fetching from server for page:', currentPage.value);
    fetchCourses();
  }
});

watch(() => sortBy.value, () => {
  console.log('📊 [Watch] Sort changed to:', sortBy.value);
});

// Lifecycle
onMounted(() => {
  console.log('🏁 [onMounted] Courses component mounted');
  fetchCourses();
});

onUnmounted(() => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
});
</script>

<style scoped src="@/assets/css/courses.css"></style>
