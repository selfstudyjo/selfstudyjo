<template>
  <div class="research-scholar-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research')"><RfIconBack /> Back</button>
      <h1 class="rf-page-title"><RfIconScholar /> Google Scholar Search</h1>
    </div>

    <div class="rf-alert rf-alert-info">
      <RfIconWarning />
      <div>
        <strong>How this works.</strong>
        Google Scholar has no public API, so this page does two things instead. It builds the exact
        Scholar query a professional searcher would run — open it to see the real Scholar results —
        and it uses AI to suggest the literature that search should surface. Every suggestion is
        then checked against OpenAlex. Items marked <em>Verified</em> have confirmed bibliographic
        data; items marked <em>Unverified</em> are search leads to confirm yourself before citing.
      </div>
    </div>

    <!-- ============ SEARCH ============ -->
    <div class="rf-section">
      <h2 class="rf-section-title"><RfIconSearch /> Search</h2>

      <div class="rf-search-bar">
        <input
          v-model="form.q"
          class="rf-input rf-search-input"
          placeholder="Enter your research topic, e.g. python games development for education"
          @keyup.enter="runSearch"
        />
        <button class="rf-btn rf-btn-primary rf-search-go" @click="runSearch" :disabled="!form.q.trim() || searching">
          <RfIconSearch /> {{ searching ? 'Searching…' : 'Search' }}
        </button>
      </div>
      <p class="rf-hint">Keywords are the only required field.</p>

      <button class="rf-filters-toggle" @click="showFilters = !showFilters">
        <RfIconFilter /> {{ showFilters ? 'Hide filters' : 'Show filters' }}
      </button>

      <div v-show="showFilters" class="rf-filters-panel">
        <div class="rf-form-row">
          <div class="rf-form-group">
            <label class="rf-label">From year</label>
            <input v-model="form.from_year" class="rf-input" type="number" placeholder="2020" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">To year</label>
            <input v-model="form.to_year" class="rf-input" type="number" :placeholder="String(currentYear)" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">Results</label>
            <select v-model.number="form.limit" class="rf-input">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="15">15</option>
              <option :value="20">20</option>
            </select>
          </div>
        </div>

        <div class="rf-form-row">
          <div class="rf-form-group">
            <label class="rf-label">Authors</label>
            <input v-model="form.authors" class="rf-input" placeholder="e.g. Funabiki, Anggraini" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">University / institution</label>
            <input v-model="form.university" class="rf-input" placeholder="e.g. Okayama University" />
          </div>
        </div>

        <div class="rf-form-row">
          <div class="rf-form-group">
            <label class="rf-label">Language</label>
            <select v-model="form.language" class="rf-input">
              <option value="">Any language</option>
              <option v-for="l in LANGUAGES" :key="l.code" :value="l.name">{{ l.name }}</option>
            </select>
          </div>
          <div class="rf-form-group">
            <label class="rf-label">Scholar interface language</label>
            <select v-model="form.hl" class="rf-input">
              <option v-for="l in LANGUAGES" :key="l.code" :value="l.code">{{ l.name }}</option>
            </select>
          </div>
          <div class="rf-form-group">
            <label class="rf-label">Publication type</label>
            <select v-model="form.publication_type" class="rf-input">
              <option value="">Any type</option>
              <option value="journal article">Journal article</option>
              <option value="conference paper">Conference paper</option>
              <option value="review">Review</option>
              <option value="book chapter">Book chapter</option>
              <option value="thesis">Thesis</option>
            </select>
          </div>
        </div>

        <div class="rf-form-row">
          <div class="rf-form-group" style="flex: 2;">
            <label class="rf-label">Exclude work about</label>
            <input v-model="form.exclude" class="rf-input" placeholder="e.g. video game addiction" />
          </div>
        </div>

        <div class="rf-checkbox-row">
          <label class="rf-checkbox">
            <input type="checkbox" v-model="form.reviews_only" />
            <span>Review articles only</span>
          </label>
          <label class="rf-checkbox">
            <input type="checkbox" v-model="form.verify" />
            <span><RfIconVerified /> Verify results against OpenAlex (recommended)</span>
          </label>
        </div>
      </div>
    </div>

    <!-- ============ ALWAYS-AVAILABLE SCHOLAR LINK ============ -->
    <div v-if="scholarUrl" class="rf-section rf-scholar-links">
      <h2 class="rf-section-title"><RfIconLink /> Open on Google Scholar</h2>
      <div class="rf-scholar-url-box">
        <code class="rf-scholar-url">{{ response?.primary_scholar_url || scholarUrl }}</code>
        <div class="rf-scholar-url-actions">
          <a class="rf-btn rf-btn-sm rf-btn-primary"
             :href="response?.primary_scholar_url || scholarUrl" target="_blank" rel="noopener noreferrer">
            <RfIconLink /> Open search
          </a>
          <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="copy(response?.primary_scholar_url || scholarUrl)">
            {{ copied ? 'Copied' : 'Copy URL' }}
          </button>
        </div>
      </div>

      <div v-if="response?.alternative_scholar_urls?.length" class="rf-alt-queries">
        <h3 class="rf-subsection-title">Alternative searches</h3>
        <div v-for="alt in response.alternative_scholar_urls" :key="alt.url" class="rf-alt-query">
          <span class="rf-alt-query-text">{{ alt.query }}</span>
          <a class="rf-btn rf-btn-xs rf-btn-ghost" :href="alt.url" target="_blank" rel="noopener noreferrer">
            Open <RfIconArrowRight />
          </a>
        </div>
      </div>

      <div v-if="response?.search_strategy" class="rf-strategy">
        <h3 class="rf-subsection-title">Search strategy</h3>
        <p>{{ response.search_strategy }}</p>
      </div>

      <div v-if="response?.suggested_keywords?.length" class="rf-keywords">
        <span v-for="kw in response.suggested_keywords" :key="kw" class="rf-keyword-badge">{{ kw }}</span>
      </div>
    </div>

    <!-- ============ STATE ============ -->
    <div v-if="searching" class="rf-loading">
      <div class="rf-spinner"></div>
      <p>Building the search and checking results against OpenAlex…</p>
      <p class="rf-hint">This takes longer than a normal search because every suggestion is verified.</p>
    </div>

    <div v-else-if="errorMessage" class="rf-alert rf-alert-error">
      <strong>Search failed.</strong> {{ errorMessage }}
    </div>

    <div v-else-if="response?.error" class="rf-alert rf-alert-warn">
      {{ response.error }}
    </div>

    <!-- ============ RESULTS ============ -->
    <div v-if="!searching && results.length" class="rf-section">
      <div class="rf-results-header">
        <h2 class="rf-section-title"><RfIconStats /> {{ results.length }} suggested papers</h2>
        <span class="rf-results-sub">
          <span class="rf-badge-verified"><RfIconVerified /> {{ response?.meta?.verified_count || 0 }} verified</span>
          <span class="rf-badge-unverified">{{ response?.meta?.unverified_count || 0 }} unverified</span>
        </span>
      </div>

      <p v-if="response?.search_notes" class="rf-hint rf-hint-warn">{{ response.search_notes }}</p>

      <div class="rf-openalex-grid">
        <div v-for="(paper, index) in results" :key="`${paper.title}-${index}`"
             class="rf-openalex-card" :class="{ 'rf-card-unverified': !paper.verified }">
          <div class="rf-card-flag">
            <span v-if="paper.verified" class="rf-badge-verified">
              <RfIconVerified /> Verified in OpenAlex
              <template v-if="paper.match_score"> · {{ Math.round(paper.match_score * 100) }}% title match</template>
            </span>
            <span v-else class="rf-badge-unverified">
              <RfIconWarning /> Unverified suggestion
              <template v-if="paper.confidence"> · AI confidence: {{ paper.confidence }}</template>
            </span>
          </div>

          <h3 class="rf-openalex-title">{{ paper.title }}</h3>

          <div class="rf-openalex-meta">
            <span v-if="paper.publication_year || paper.year"><RfIconCalendar /> {{ paper.publication_year || paper.year }}</span>
            <span v-if="paper.venue"><RfIconLibrary /> {{ paper.venue }}</span>
            <span v-if="paper.citation_count"><RfIconCitation /> {{ paper.citation_count }} citations</span>
            <span v-if="paper.is_oa" class="rf-badge-oa"><RfIconOpenAccess /> Open access</span>
            <span v-if="paper.has_pdf" class="rf-badge-pdf"><RfIconDownload /> PDF available</span>
          </div>

          <div class="rf-openalex-authors" v-if="paper.author_names?.length">
            <strong>Authors:</strong> {{ paper.author_names.slice(0, 8).join(', ') }}
          </div>
          <div class="rf-openalex-authors" v-else-if="paper.authors || paper.first_author">
            <strong>Authors:</strong> {{ paper.authors || paper.first_author }}
          </div>

          <p v-if="paper.relevance" class="rf-relevance"><strong>Why it matters:</strong> {{ paper.relevance }}</p>
          <p v-if="paper.abstract" class="rf-openalex-abstract">{{ truncate(paper.abstract, 300) }}</p>
          <p v-if="!paper.verified && paper.verification_note" class="rf-hint rf-hint-warn">
            {{ paper.verification_note }}
          </p>

          <div v-if="paper.doi" class="rf-openalex-doi"><strong>DOI:</strong> {{ paper.doi }}</div>

          <div class="rf-openalex-actions">
            <a class="rf-btn rf-btn-sm rf-btn-secondary" :href="paper.scholar_url" target="_blank" rel="noopener noreferrer">
              <RfIconScholar /> Find on Scholar
            </a>

            <button v-if="paper.verified" class="rf-btn rf-btn-sm rf-btn-primary"
                    @click="saveToLibrary(paper, index)"
                    :disabled="savedKeys.has(saveKey(paper, index)) || savingIndex === index">
              <RfIconSave />
              {{ savedKeys.has(saveKey(paper, index)) ? 'In library'
                : (savingIndex === index ? 'Saving…' : 'Save to library') }}
            </button>

            <button v-if="paper.verified && paper.has_pdf && paper.work_key"
                    class="rf-btn rf-btn-sm rf-btn-success"
                    @click="downloadPdf(paper)"
                    :disabled="downloadingKey === paper.work_key">
              <RfIconDownload /> {{ downloadingKey === paper.work_key ? 'Fetching…' : 'Download PDF' }}
            </button>

            <a v-if="paper.landing_page_url" class="rf-btn rf-btn-sm rf-btn-ghost"
               :href="paper.landing_page_url" target="_blank" rel="noopener noreferrer">
              <RfIconLink /> View paper
            </a>
          </div>
        </div>
      </div>
    </div>

    <div v-if="toast" class="rf-toast" :class="`rf-toast-${toast.kind}`">{{ toast.text }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { researchService } from '@/services/research.service';
import type { ScholarResult, ScholarSearchResponse } from '@/services/research.service';
import {
  RfIconBack, RfIconScholar, RfIconSearch, RfIconFilter, RfIconStats, RfIconCalendar,
  RfIconLibrary, RfIconCitation, RfIconOpenAccess, RfIconSave, RfIconLink, RfIconDownload,
  RfIconWarning, RfIconVerified, RfIconArrowRight,
} from '@/utils/rf-icons';

const authStore = useAuthStore();
const route = useRoute();
const currentYear = new Date().getFullYear();

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'ar', name: 'Arabic' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }, { code: 'es', name: 'Spanish' }, { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' }, { code: 'tr', name: 'Turkish' },
];

const form = reactive({
  q: '',
  hl: 'en',
  from_year: '',
  to_year: '',
  authors: '',
  university: '',
  language: '',
  publication_type: '',
  exclude: '',
  limit: 10,
  reviews_only: false,
  verify: true,
});

const showFilters = ref(false);
const searching = ref(false);
const errorMessage = ref('');
const response = ref<ScholarSearchResponse | null>(null);
const savedKeys = ref<Set<string>>(new Set());
const savingIndex = ref(-1);
const downloadingKey = ref('');
const copied = ref(false);
const toast = ref<{ text: string; kind: 'ok' | 'err' } | null>(null);

const results = computed(() => response.value?.results || []);
const scholarUrl = computed(() => response.value?.scholar_query_url || '');

const truncate = (text: string, n: number) => (text.length > n ? `${text.slice(0, n).trimEnd()}…` : text);
const saveKey = (paper: ScholarResult, index: number) => paper.openalex_id || `${paper.title}-${index}`;

const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
  toast.value = { text, kind };
  setTimeout(() => { toast.value = null; }, 4000);
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    showToast('Could not copy — select the URL and copy it manually.', 'err');
  }
};

const runSearch = async () => {
  const userId = authStore.user?.id;
  if (!userId) { errorMessage.value = 'You need to be signed in to search.'; return; }
  if (!form.q.trim()) return;

  searching.value = true;
  errorMessage.value = '';
  try {
    response.value = await researchService.searchScholar(userId, {
      q: form.q.trim(),
      hl: form.hl,
      from_year: form.from_year || undefined,
      to_year: form.to_year || undefined,
      authors: form.authors || undefined,
      university: form.university || undefined,
      language: form.language || undefined,
      publication_type: form.publication_type || undefined,
      exclude: form.exclude || undefined,
      limit: form.limit,
      reviews_only: form.reviews_only,
      verify: form.verify,
    });
  } catch (err: any) {
    errorMessage.value = err?.message || 'The Scholar search could not be completed.';
    response.value = null;
  } finally {
    searching.value = false;
  }
};

const saveToLibrary = async (paper: ScholarResult, index: number) => {
  const userId = authStore.user?.id;
  if (!userId) return;
  savingIndex.value = index;
  try {
    await researchService.saveToLibrary(userId, {
      ...paper,
      id: paper.openalex_id || `scholar:${paper.title}`,
      source: 'google_scholar',
    });
    savedKeys.value = new Set(savedKeys.value).add(saveKey(paper, index));
    showToast('Saved to your research library.');
  } catch (err: any) {
    if (err?.status === 409) {
      savedKeys.value = new Set(savedKeys.value).add(saveKey(paper, index));
      showToast('This paper is already in your library.');
    } else {
      showToast(err?.message || 'Could not save the paper.', 'err');
    }
  } finally {
    savingIndex.value = -1;
  }
};

const downloadPdf = async (paper: ScholarResult) => {
  const userId = authStore.user?.id;
  if (!userId || !paper.work_key) return;
  downloadingKey.value = paper.work_key;
  try {
    const filename = `${paper.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 80)}.pdf`;
    await researchService.downloadOpenAlexPdf(userId, paper.work_key, filename);
    showToast('PDF downloaded.');
  } catch (err: any) {
    showToast(err?.message || 'Could not fetch the PDF. Use "View paper" instead.', 'err');
  } finally {
    downloadingKey.value = '';
  }
};

// The AI writer links here with the plan's recommended search terms prefilled.
onMounted(() => {
  const q = route.query.q;
  if (typeof q === 'string' && q.trim()) {
    form.q = q.trim();
    runSearch();
  }
});
</script>

<style src="@/assets/css/research-flow.css"></style>
