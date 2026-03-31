<template>
  <div class="research-openalex-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research')"><RfIconBack /> Back</button>
      <h1 class="rf-page-title"><RfIconGlobe /> Import from OpenAlex</h1>
    </div>

    <div class="rf-section rf-openalex-search">
      <h2 class="rf-section-title"><RfIconSearch /> Search Academic Papers</h2>
      <div class="rf-form-row">
        <div class="rf-form-group" style="flex: 2;">
          <label class="rf-label">Search Keywords *</label>
          <input v-model="searchQuery" class="rf-input" placeholder="e.g., machine learning, neural networks..." @keyup.enter="doSearch" />
        </div>
        <div class="rf-form-group">
          <label class="rf-label">From Year</label>
          <input v-model="fromYear" class="rf-input" type="number" placeholder="2020" />
        </div>
        <div class="rf-form-group">
          <label class="rf-label">To Year</label>
          <input v-model="toYear" class="rf-input" type="number" placeholder="2025" />
        </div>
      </div>
      <button class="rf-btn rf-btn-primary" @click="doSearch" :disabled="!searchQuery || searching">
        <RfIconSearch /> {{ searching ? 'Searching...' : 'Search OpenAlex' }}
      </button>
    </div>

    <div v-if="searching" class="rf-loading">
      <div class="rf-spinner"></div>
      <p>Searching OpenAlex...</p>
    </div>

    <div v-else-if="results.length > 0" class="rf-section">
      <h2 class="rf-section-title"><RfIconStats /> Search Results ({{ totalCount }} total)</h2>

      <div class="rf-openalex-grid">
        <div v-for="paper in paginatedResults" :key="paper.id" class="rf-openalex-card">
          <h3 class="rf-openalex-title">{{ paper.title || paper.display_name || 'Untitled' }}</h3>
          <div class="rf-openalex-meta">
            <span v-if="paper.publication_year"><RfIconCalendar /> {{ paper.publication_year }}</span>
            <span v-if="getVenue(paper)"><RfIconLibrary /> {{ getVenue(paper) }}</span>
            <span v-if="paper.cited_by_count"><RfIconCitation /> {{ paper.cited_by_count }} citations</span>
            <span v-if="paper.open_access?.is_oa"><RfIconOpenAccess /> Open Access</span>
            <span v-if="paper.type"><RfIconFile /> {{ paper.type }}</span>
          </div>
          <div class="rf-openalex-authors" v-if="paper.authorships?.length">
            <strong>Authors:</strong>
            {{ paper.authorships.map((a: any) => a.author?.display_name).filter(Boolean).join(', ') }}
          </div>
          <div v-if="paper.doi" class="rf-openalex-doi">
            <strong>DOI:</strong> {{ paper.doi }}
          </div>
          <div class="rf-keywords" v-if="getConcepts(paper).length">
            <span v-for="concept in getConcepts(paper).slice(0, 5)" :key="concept" class="rf-keyword-badge">{{ concept }}</span>
          </div>
          <div class="rf-openalex-actions">
            <button class="rf-btn rf-btn-sm rf-btn-primary" @click="saveToLibrary(paper)" :disabled="isSaved(paper.id)">
              <RfIconSave /> {{ isSaved(paper.id) ? 'Saved' : 'Save to Library' }}
            </button>
            <button v-if="getPaperUrl(paper)" class="rf-btn rf-btn-sm rf-btn-secondary" @click="openExternal(getPaperUrl(paper))">
              <RfIconLink /> View Paper
            </button>
          </div>
        </div>
      </div>

      <div class="rf-pagination">
        <button class="rf-btn rf-btn-sm" :disabled="currentPage <= 1" @click="currentPage--">Previous</button>
        <span class="rf-page-info">Page {{ currentPage }} of {{ totalPages }}</span>
        <button class="rf-btn rf-btn-sm" :disabled="currentPage >= totalPages" @click="currentPage++">Next</button>
      </div>
    </div>

    <div v-else-if="hasSearched && !searching" class="rf-empty">
      <p>No results found. Try different search terms.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/store/auth';
import { researchService } from '@/services/research.service';
import type { OpenAlexWork } from '@/services/research.service';
import {
  RfIconBack, RfIconGlobe, RfIconSearch, RfIconStats,
  RfIconCalendar, RfIconLibrary, RfIconCitation, RfIconOpenAccess,
  RfIconFile, RfIconSave, RfIconLink
} from '@/utils/rf-icons';

const authStore = useAuthStore();

const searching = ref(false);
const hasSearched = ref(false);
const searchQuery = ref('');
const fromYear = ref('');
const toYear = ref('');
const results = ref<OpenAlexWork[]>([]);
const totalCount = ref(0);
const currentPage = ref(1);
const perPage = 5;
const savedPaperIds = ref<Set<string>>(new Set());

const totalPages = computed(() => Math.ceil(results.value.length / perPage));

const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * perPage;
  return results.value.slice(start, start + perPage);
});

const isSaved = (paperId: string) => savedPaperIds.value.has(paperId);

const getVenue = (paper: OpenAlexWork) => {
  return paper.primary_location?.source?.display_name || '';
};

const getConcepts = (paper: OpenAlexWork) => {
  if (paper.concepts) return paper.concepts.map((c: any) => c.display_name).filter(Boolean);
  if (paper.keywords) return paper.keywords.map((k: any) => k.display_name || k.keyword || k).filter(Boolean);
  return [];
};

const getPaperUrl = (paper: OpenAlexWork) => {
  if (paper.doi) return paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`;
  if (paper.primary_location?.landing_page_url) return paper.primary_location.landing_page_url;
  return paper.id?.startsWith('http') ? paper.id : '';
};

const openExternal = (url: string) => {
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
};

const doSearch = async () => {
  if (!searchQuery.value.trim()) return;
  searching.value = true;
  hasSearched.value = true;
  currentPage.value = 1;
  const userId = authStore.user?.id;
  if (!userId) return;

  try {
    const response = await researchService.searchOpenAlex(userId, {
      q: searchQuery.value,
      page: 1,
      per_page: 100,
    });
    let allResults = response.results || [];

    if (fromYear.value) {
      const fy = parseInt(fromYear.value);
      allResults = allResults.filter(p => (p.publication_year || 0) >= fy);
    }
    if (toYear.value) {
      const ty = parseInt(toYear.value);
      allResults = allResults.filter(p => (p.publication_year || 9999) <= ty);
    }

    results.value = allResults;
    totalCount.value = response.meta?.count || allResults.length;
  } catch (err) {
    console.error('OpenAlex search failed:', err);
    results.value = [];
  } finally {
    searching.value = false;
  }
};

const saveToLibrary = async (paper: OpenAlexWork) => {
  const userId = authStore.user?.id;
  if (!userId) return;
  try {
    const paperData = {
      id: paper.id,
      title: paper.title || paper.display_name || '',
      authors: (paper.authorships || []).map((a: any) => ({ author: { display_name: a.author?.display_name } })),
      year: paper.publication_year,
      doi: paper.doi || '',
      url: getPaperUrl(paper),
      open_access: paper.open_access?.is_oa || false,
      citation_count: paper.cited_by_count || 0,
      keywords: getConcepts(paper),
      venue: getVenue(paper),
    };
    await researchService.saveToLibrary(userId, paperData);
    savedPaperIds.value.add(paper.id);
    alert('Paper saved to library!');
  } catch (err: any) {
    alert(err.message || 'Failed to save paper');
  }
};
</script>

<style src="@/assets/css/research-flow.css"></style>