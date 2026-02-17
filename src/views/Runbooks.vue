<template>
  <div class="runbooks-container">
    <!-- Header -->
    <div class="runbooks-header">
      <h1 class="runbooks-title">Runbooks</h1>
      <p class="runbooks-subtitle">Step-by-step guides and tutorials</p>

      <!-- Search and Filter -->
      <div class="search-filter-container">
        <div class="search-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="search-icon">
            <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z" fill="currentColor"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search runbooks..."
            class="search-input"
            @input="handleSearch"
          />
          <button v-if="searchQuery" @click="clearSearch" class="clear-search-btn" title="Clear search">
            &times;
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading runbooks...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>Failed to load runbooks</h3>
      <p>{{ error }}</p>
      <button @click="fetchRunbooks" class="retry-btn">Try Again</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredRunbooks.length === 0" class="empty-state">
      <div class="empty-icon">📚</div>
      <h3>No runbooks found</h3>
      <p v-if="searchQuery">Try a different search term</p>
      <p v-else>No runbooks available at the moment</p>
    </div>

    <!-- Runbooks Grid -->
    <div v-else class="runbooks-grid">
      <div
        v-for="runbook in filteredRunbooks"
        :key="runbook.id"
        class="runbook-card"
        @click="goToRunbookDetails(runbook.id)"
        role="button"
        tabindex="0"
        @keyup.enter="goToRunbookDetails(runbook.id)"
      >
        <div class="runbook-card-header">
          <div class="runbook-icon">📘</div>
          <div class="runbook-info">
            <h3 class="runbook-title">{{ runbook.title }}</h3>
            <div class="runbook-meta">
              <span class="section-count">
                {{ runbook.sections?.length || 0 }} steps
              </span>
            </div>
          </div>
        </div>
        <div class="runbook-card-footer">
          <span class="view-details">View Details →</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { runbookService, type Runbook } from '@/services/runbook.service';

const router = useRouter();
const runbooks = ref<Runbook[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref('');

const fetchRunbooks = async () => {
  try {
    loading.value = true;
    error.value = null;
    const fetchedRunbooks = await runbookService.getAllRunbooks();
    runbooks.value = fetchedRunbooks;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load runbooks';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const filteredRunbooks = computed(() => {
  if (!searchQuery.value.trim()) {
    return runbooks.value;
  }

  const query = searchQuery.value.toLowerCase().trim();
  return runbooks.value.filter(runbook =>
    runbook.title.toLowerCase().includes(query)
  );
});

const handleSearch = () => {
  // Debounce could be added here if needed
};

const clearSearch = () => {
  searchQuery.value = '';
};

const goToRunbookDetails = async (id: number) => {
  console.log('Navigating to runbook details with id:', id);
  try {
    // Test if we can fetch the runbook first
    const runbook = await runbookService.getRunbookById(id);
    console.log('Runbook found:', runbook);

    // Navigate to runbook details page
    router.push({
      name: 'RunbookDetails',
      params: { id: String(id) }
    });
  } catch (error) {
    console.error('Error fetching runbook or navigating:', error);
    // If there's an error, show a message but still try to navigate
    router.push({
      name: 'RunbookDetails',
      params: { id: String(id) }
    });
  }
};

onMounted(() => {
  fetchRunbooks();
});
</script>

<style scoped>
@import '@/assets/css/runbooks.css';
</style>
