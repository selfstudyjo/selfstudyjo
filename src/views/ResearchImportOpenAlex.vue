<template>
  <div class="research-openalex-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research')"><RfIconBack /> {{ $t('Back') }}</button>
      <h1 class="rf-page-title"><RfIconGlobe /> {{ $t('Import from OpenAlex') }}</h1>
    </div>

    <!-- ============ SEARCH ============ -->
    <div class="rf-section rf-openalex-search">
      <h2 class="rf-section-title"><RfIconSearch /> {{ $t('Search Academic Papers') }}</h2>

      <div class="rf-search-bar">
        <input
          v-model="form.q"
          class="rf-input rf-search-input"
          :placeholder="$t('Enter your research keywords, e.g. hand gesture rehabilitation exergame')"
          @keyup.enter="runSearch(1)"
        />
        <button class="rf-btn rf-btn-primary rf-search-go" @click="runSearch(1)" :disabled="!form.q.trim() || searching">
          <RfIconSearch /> {{ searching ? 'Searching…' : 'Search' }}
        </button>
      </div>
      <p class="rf-hint">
        {{ $t('Keywords are the only required field. Every filter below is optional — add them only when you want to narrow the results.') }}
      </p>

      <button class="rf-filters-toggle" @click="showFilters = !showFilters">
        <RfIconFilter /> {{ showFilters ? 'Hide filters' : 'Show filters' }}
        <span v-if="activeFilterCount" class="rf-filter-count">{{ activeFilterCount }}</span>
      </button>

      <div v-show="showFilters" class="rf-filters-panel">
        <!-- Year -->
        <div class="rf-filter-group">
          <label class="rf-filter-legend"><RfIconCalendar /> {{ $t('Publication year') }}</label>
          <div class="rf-form-row">
            <div class="rf-form-group">
              <label class="rf-label">{{ $t('From') }}</label>
              <input v-model="form.from_year" class="rf-input" type="number" placeholder="2020" min="1600" :max="currentYear" />
            </div>
            <div class="rf-form-group">
              <label class="rf-label">{{ $t('To') }}</label>
              <input v-model="form.to_year" class="rf-input" type="number" :placeholder="String(currentYear)" min="1600" :max="currentYear" />
            </div>
          </div>
        </div>

        <!-- Keywords -->
        <div class="rf-filter-group">
          <label class="rf-filter-legend"><RfIconTag /> {{ $t('Keywords') }}</label>
          <TokenPicker
            entity="keywords"
            :placeholder="$t('Type a topic keyword, e.g. computer vision')"
            :selected="selected.keywords"
            @add="t => addToken('keywords', t)"
            @remove="i => selected.keywords.splice(i, 1)"
            :lookup="lookup"
          />
        </div>

        <!-- Authors -->
        <div class="rf-filter-group">
          <label class="rf-filter-legend"><RfIconPeople /> {{ $t('Authors') }}</label>
          <TokenPicker
            entity="authors"
            :placeholder="$t('Type an author name')"
            :selected="selected.authors"
            @add="t => addToken('authors', t)"
            @remove="i => selected.authors.splice(i, 1)"
            :lookup="lookup"
          />
        </div>

        <!-- University / institution -->
        <div class="rf-filter-group">
          <label class="rf-filter-legend"><RfIconUniversity /> {{ $t('University / institution') }}</label>
          <TokenPicker
            entity="institutions"
            :placeholder="$t('Type a university name')"
            :selected="selected.institutions"
            @add="t => addToken('institutions', t)"
            @remove="i => selected.institutions.splice(i, 1)"
            :lookup="lookup"
          />
        </div>

        <!-- Scalars -->
        <div class="rf-form-row">
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Language') }}</label>
            <select v-model="form.language" class="rf-input">
              <option value="">{{ $t('Any language') }}</option>
              <option v-for="l in LANGUAGES" :key="l.code" :value="l.code">{{ l.name }}</option>
            </select>
          </div>
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Publication type') }}</label>
            <select v-model="form.type" class="rf-input">
              <option value="">{{ $t('Any type') }}</option>
              <option v-for="t in WORK_TYPES" :key="t" :value="t">{{ prettyType(t) }}</option>
            </select>
          </div>
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Search in') }}</label>
            <select v-model="form.search_field" class="rf-input">
              <option value="title_abstract">{{ $t('Title and abstract') }}</option>
              <option value="title">{{ $t('Title only') }}</option>
              <option value="fulltext">{{ $t('Full text') }}</option>
            </select>
          </div>
        </div>

        <div class="rf-form-row">
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Sort by') }}</label>
            <select v-model="form.sort" class="rf-input">
              <option value="">{{ $t('Relevance') }}</option>
              <option value="cited_by_count:desc">{{ $t('Most cited') }}</option>
              <option value="publication_date:desc">{{ $t('Newest first') }}</option>
              <option value="publication_date:asc">{{ $t('Oldest first') }}</option>
            </select>
          </div>
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Minimum citations') }}</label>
            <input v-model="form.min_citations" class="rf-input" type="number" min="0" placeholder="0" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Results per page') }}</label>
            <select v-model.number="form.per_page" class="rf-input">
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
            </select>
          </div>
        </div>

        <div class="rf-checkbox-row">
          <label class="rf-checkbox">
            <input type="checkbox" v-model="form.has_pdf" />
            <span><RfIconDownload /> {{ $t('PDF linked only') }}</span>
          </label>
          <label class="rf-checkbox">
            <input type="checkbox" v-model="form.is_oa" />
            <span><RfIconOpenAccess /> {{ $t('Open access only') }}</span>
          </label>
          <label class="rf-checkbox">
            <input type="checkbox" v-model="form.has_doi" />
            <span><RfIconLink /> {{ $t('Has a DOI') }}</span>
          </label>
        </div>

        <div class="rf-filters-actions">
          <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="resetFilters">{{ $t('Clear all filters') }}</button>
        </div>
      </div>
    </div>

    <!-- ============ STATE ============ -->
    <div v-if="searching" class="rf-loading">
      <div class="rf-spinner"></div>
      <p>{{ $t('Searching OpenAlex…') }}</p>
    </div>

    <div v-else-if="errorMessage" class="rf-alert rf-alert-error">
      <strong>{{ $t('Search failed.') }}</strong> {{ errorMessage }}
    </div>

    <div v-else-if="hasSearched && results.length === 0" class="rf-empty">
      <p>{{ $t('No papers matched this search.') }}</p>
      <p class="rf-hint">{{ $t('Try removing a filter, widening the year range, or searching the full text instead of just the title and abstract.') }}</p>
    </div>

    <!-- ============ RESULTS ============ -->
    <div v-else-if="results.length > 0" class="rf-section">
      <div class="rf-results-header">
        <h2 class="rf-section-title">
          <RfIconStats /> {{ $t('{v0} paper{v1} found', { v0: meta.count.toLocaleString(), v1: meta.count === 1 ? '' : 's' }) }}
        </h2>
        <span class="rf-results-sub">
          {{ $t('Showing {v0}–{v1} · page {v2} of {v3}', { v0: firstIndex, v1: lastIndex, v2: meta.page, v3: meta.total_pages }) }}
        </span>
      </div>

      <div v-if="appliedChips.length" class="rf-applied-filters">
        <span class="rf-applied-label">{{ $t('Filters:') }}</span>
        <span v-for="chip in appliedChips" :key="chip" class="rf-chip">{{ chip }}</span>
      </div>

      <p v-if="meta.truncated" class="rf-hint rf-hint-warn">
        {{ $t('OpenAlex allows paging through the first 10,000 results only. Narrow the search with filters to reach the rest.') }}
      </p>

      <div class="rf-openalex-grid">
        <div v-for="paper in results" :key="paper.id" class="rf-openalex-card">
          <h3 class="rf-openalex-title">{{ paper.title }}</h3>

          <div class="rf-openalex-meta">
            <span v-if="paper.publication_year"><RfIconCalendar /> {{ paper.publication_year }}</span>
            <span v-if="paper.venue"><RfIconLibrary /> {{ paper.venue }}</span>
            <span v-if="paper.citation_count"><RfIconCitation /> {{ $t('{v0} citations', { v0: paper.citation_count }) }}</span>
            <span v-if="paper.is_oa" class="rf-badge-oa"><RfIconOpenAccess /> {{ $t('Open access') }}</span>
            <span v-if="paper.has_pdf" class="rf-badge-pdf"><RfIconDownload /> {{ $t('PDF available') }}</span>
            <span v-if="paper.type">{{ prettyType(paper.type) }}</span>
            <span v-if="paper.is_retracted" class="rf-badge-danger">{{ $t('Retracted') }}</span>
          </div>

          <div class="rf-openalex-authors" v-if="paper.author_names.length">
            <strong>{{ $t('Authors:') }}</strong> {{ authorLine(paper) }}
          </div>
          <div class="rf-openalex-authors" v-if="paper.institutions.length">
            <strong>{{ $t('Institutions:') }}</strong>
            {{ paper.institutions.slice(0, 3).map(i => i.name).join(', ') }}
            <span v-if="paper.institutions.length > 3">{{ $t('+{v0} more', { v0: paper.institutions.length - 3 }) }}</span>
          </div>

          <p v-if="paper.abstract" class="rf-openalex-abstract">
            {{ expanded.has(paper.id) ? paper.abstract : truncate(paper.abstract, 320) }}
            <button v-if="paper.abstract.length > 320" class="rf-link-btn" @click="toggleAbstract(paper.id)">
              {{ expanded.has(paper.id) ? 'Show less' : 'Read more' }}
            </button>
          </p>

          <div v-if="paper.doi" class="rf-openalex-doi"><strong>DOI:</strong> {{ paper.doi }}</div>

          <div class="rf-keywords" v-if="paper.keywords.length">
            <span v-for="kw in paper.keywords.slice(0, 6)" :key="kw" class="rf-keyword-badge">{{ kw }}</span>
          </div>

          <div class="rf-openalex-actions">
            <button class="rf-btn rf-btn-sm rf-btn-primary"
                    @click="saveToLibrary(paper)"
                    :disabled="savedIds.has(paper.id) || savingId === paper.id">
              <RfIconSave />
              {{ savedIds.has(paper.id) ? 'In library' : (savingId === paper.id ? 'Saving…' : 'Save to library') }}
            </button>

            <button v-if="paper.has_pdf"
                    class="rf-btn rf-btn-sm rf-btn-success"
                    @click="downloadPdf(paper)"
                    :disabled="downloadingId === paper.work_key">
              <RfIconDownload />
              {{ downloadingId === paper.work_key ? 'Fetching…' : 'Download PDF' }}
            </button>

            <a v-if="paper.landing_page_url" class="rf-btn rf-btn-sm rf-btn-secondary"
               :href="paper.landing_page_url" target="_blank" rel="noopener noreferrer">
              <RfIconLink /> {{ $t('View paper') }}
            </a>

            <a v-if="paper.doi_url && paper.doi_url !== paper.landing_page_url"
               class="rf-btn rf-btn-sm rf-btn-ghost"
               :href="paper.doi_url" target="_blank" rel="noopener noreferrer">
              DOI
            </a>

            <a v-if="paper.openalex_url" class="rf-btn rf-btn-sm rf-btn-ghost"
               :href="paper.openalex_url" target="_blank" rel="noopener noreferrer">
              OpenAlex
            </a>
          </div>

          <!-- Shown when the backend proxy could not fetch any copy -->
          <div v-if="pdfFallback[paper.id]" class="rf-alert rf-alert-warn rf-alert-inline">
            <p>{{ pdfFallback[paper.id].message }}</p>
            <div class="rf-fallback-links">
              <a v-for="(url, i) in pdfFallback[paper.id].urls" :key="url"
                 :href="url" target="_blank" rel="noopener noreferrer" class="rf-link-btn">
                {{ $t('Open PDF source {v0}', { v0: i + 1 }) }}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="rf-pagination">
        <button class="rf-btn rf-btn-sm" :disabled="meta.page <= 1 || searching" @click="runSearch(1)">{{ $t('« First') }}</button>
        <button class="rf-btn rf-btn-sm" :disabled="meta.page <= 1 || searching" @click="runSearch(meta.page - 1)">{{ $t('Previous') }}</button>
        <span class="rf-page-info">{{ $t('Page {v0} of {v1}', { v0: meta.page, v1: meta.total_pages }) }}</span>
        <button class="rf-btn rf-btn-sm" :disabled="meta.page >= meta.total_pages || searching" @click="runSearch(meta.page + 1)">{{ $t('Next') }}</button>
        <button class="rf-btn rf-btn-sm" :disabled="meta.page >= meta.total_pages || searching" @click="runSearch(meta.total_pages)">{{ $t('Last »') }}</button>
      </div>
    </div>

    <div v-if="toast" class="rf-toast" :class="`rf-toast-${toast.kind}`">{{ toast.text }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, h, onMounted, defineComponent, type PropType } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { researchService } from '@/services/research.service';
import type { AutocompleteHit, OpenAlexWork } from '@/services/research.service';
import {
  RfIconBack, RfIconGlobe, RfIconSearch, RfIconStats, RfIconCalendar, RfIconLibrary,
  RfIconCitation, RfIconOpenAccess, RfIconSave, RfIconLink, RfIconDownload,
  RfIconPeople, RfIconUniversity, RfIconFilter, RfIconTag, RfIconClose,
} from '@/utils/rf-icons';

const authStore = useAuthStore();
const route = useRoute();
const currentYear = new Date().getFullYear();

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'ar', name: 'Arabic' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }, { code: 'es', name: 'Spanish' }, { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' }, { code: 'pt', name: 'Portuguese' }, { code: 'ru', name: 'Russian' },
  { code: 'tr', name: 'Turkish' }, { code: 'it', name: 'Italian' },
];

const WORK_TYPES = ['article', 'review', 'book', 'book-chapter', 'dissertation',
  'preprint', 'report', 'dataset', 'letter'];

// ---------------------------------------------------------------------------
// Token picker: resolves typed text to real OpenAlex ids. Filtering by a raw
// name does not work - OpenAlex filters on entity ids only.
// ---------------------------------------------------------------------------
interface Token { id: string; label: string }

const TokenPicker = defineComponent({
  name: 'TokenPicker',
  props: {
    entity: { type: String, required: true },
    placeholder: { type: String, default: '' },
    selected: { type: Array as PropType<Token[]>, required: true },
    lookup: { type: Function as PropType<(entity: string, q: string) => Promise<AutocompleteHit[]>>, required: true },
  },
  emits: ['add', 'remove'],
  setup(props, { emit }) {
    const text = ref('');
    const hits = ref<AutocompleteHit[]>([]);
    const busy = ref(false);
    const open = ref(false);
    let timer: any = null;

    const onInput = () => {
      clearTimeout(timer);
      const q = text.value.trim();
      if (q.length < 2) { hits.value = []; open.value = false; return; }
      timer = setTimeout(async () => {
        busy.value = true;
        try {
          hits.value = await props.lookup(props.entity, q);
          open.value = hits.value.length > 0;
        } finally { busy.value = false; }
      }, 300);
    };

    const choose = (hit: AutocompleteHit) => {
      emit('add', { id: hit.id, label: hit.display_name });
      text.value = '';
      hits.value = [];
      open.value = false;
    };

    return () => h('div', { class: 'rf-token-picker' }, [
      h('div', { class: 'rf-token-list' }, props.selected.map((token, index) =>
        h('span', { class: 'rf-token', key: token.id }, [
          token.label,
          h('button', {
            class: 'rf-token-remove',
            type: 'button',
            title: 'Remove',
            onClick: () => emit('remove', index),
          }, [h(RfIconClose)]),
        ]))),
      h('div', { class: 'rf-token-input-wrap' }, [
        h('input', {
          class: 'rf-input',
          placeholder: props.placeholder,
          value: text.value,
          onInput: (e: Event) => { text.value = (e.target as HTMLInputElement).value; onInput(); },
          onFocus: () => { if (hits.value.length) open.value = true; },
          onBlur: () => setTimeout(() => { open.value = false; }, 180),
        }),
        busy.value ? h('span', { class: 'rf-token-busy' }, '…') : null,
        open.value ? h('ul', { class: 'rf-token-dropdown' }, hits.value.map(hit =>
          h('li', {
            class: 'rf-token-option',
            key: hit.id,
            onMousedown: (e: Event) => { e.preventDefault(); choose(hit); },
          }, [
            h('span', { class: 'rf-token-option-name' }, hit.display_name),
            hit.hint ? h('span', { class: 'rf-token-option-hint' }, hit.hint) : null,
            hit.works_count ? h('span', { class: 'rf-token-option-count' }, `${hit.works_count.toLocaleString()} works`) : null,
          ]))) : null,
      ]),
    ]);
  },
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const emptyForm = () => ({
  q: '',
  search_field: 'title_abstract' as 'title_abstract' | 'title' | 'fulltext',
  from_year: '',
  to_year: '',
  language: '',
  type: '',
  sort: '',
  min_citations: '',
  per_page: 25,
  has_pdf: false,
  is_oa: false,
  has_doi: false,
});

const form = reactive(emptyForm());
const selected = reactive<{ keywords: Token[]; authors: Token[]; institutions: Token[] }>({
  keywords: [], authors: [], institutions: [],
});

const showFilters = ref(false);
const searching = ref(false);
const hasSearched = ref(false);
const errorMessage = ref('');
const results = ref<OpenAlexWork[]>([]);
const meta = reactive({ count: 0, page: 1, per_page: 25, total_pages: 1, truncated: false });
const appliedChips = ref<string[]>([]);
const expanded = ref<Set<string>>(new Set());
const savedIds = ref<Set<string>>(new Set());
const savingId = ref('');
const downloadingId = ref('');
const pdfFallback = reactive<Record<string, { message: string; urls: string[] }>>({});
const toast = ref<{ text: string; kind: 'ok' | 'err' } | null>(null);

const firstIndex = computed(() => (meta.page - 1) * meta.per_page + 1);
const lastIndex = computed(() => Math.min(meta.page * meta.per_page, meta.count));

const activeFilterCount = computed(() => {
  let n = selected.keywords.length + selected.authors.length + selected.institutions.length;
  if (form.from_year) n++;
  if (form.to_year) n++;
  if (form.language) n++;
  if (form.type) n++;
  if (form.min_citations) n++;
  if (form.has_pdf) n++;
  if (form.is_oa) n++;
  if (form.has_doi) n++;
  return n;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const prettyType = (t: string) => (t || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const truncate = (text: string, n: number) => (text.length > n ? `${text.slice(0, n).trimEnd()}…` : text);
const toggleAbstract = (id: string) => {
  const next = new Set(expanded.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expanded.value = next;
};
const authorLine = (paper: OpenAlexWork) => {
  const names = paper.author_names;
  return names.length > 8 ? `${names.slice(0, 8).join(', ')} +${names.length - 8} more` : names.join(', ');
};

const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
  toast.value = { text, kind };
  setTimeout(() => { toast.value = null; }, 4000);
};

const addToken = (bucket: 'keywords' | 'authors' | 'institutions', token: Token) => {
  if (!selected[bucket].some(t => t.id === token.id)) selected[bucket].push(token);
};

const lookup = async (entity: string, q: string) => {
  const userId = authStore.user?.id;
  if (!userId) return [];
  return researchService.openAlexAutocomplete(userId, entity, q);
};

const resetFilters = () => {
  const q = form.q;
  Object.assign(form, emptyForm());
  form.q = q;
  selected.keywords = [];
  selected.authors = [];
  selected.institutions = [];
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const runSearch = async (page = 1) => {
  const userId = authStore.user?.id;
  if (!userId) { errorMessage.value = 'You need to be signed in to search.'; return; }
  if (!form.q.trim()) return;

  searching.value = true;
  hasSearched.value = true;
  errorMessage.value = '';

  try {
    const response = await researchService.searchOpenAlex(userId, {
      q: form.q.trim(),
      search_field: form.search_field,
      from_year: form.from_year || undefined,
      to_year: form.to_year || undefined,
      language: form.language || undefined,
      type: form.type || undefined,
      sort: form.sort || undefined,
      min_citations: form.min_citations || undefined,
      keywords: selected.keywords.map(t => t.id).join(',') || undefined,
      authors: selected.authors.map(t => t.id).join(',') || undefined,
      institutions: selected.institutions.map(t => t.id).join(',') || undefined,
      has_pdf: form.has_pdf,
      is_oa: form.is_oa,
      has_doi: form.has_doi,
      page,
      per_page: form.per_page,
    });

    results.value = response.results || [];
    Object.assign(meta, response.meta);
    appliedChips.value = describeFilters(response.applied_filters);
    expanded.value = new Set();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err: any) {
    errorMessage.value = err?.message || 'OpenAlex could not be reached. Try again in a moment.';
    results.value = [];
  } finally {
    searching.value = false;
  }
};

/** Turn the backend's applied_filters map into readable chips. */
const describeFilters = (applied: Record<string, any> = {}) => {
  const labelFor = (bucket: 'keywords' | 'authors' | 'institutions', id: string) =>
    selected[bucket].find(t => t.id === id)?.label || id;

  const chips: string[] = [];
  if (applied.years) chips.push(`Year ${applied.years}`);
  (applied.keywords || []).forEach((k: string) => chips.push(labelFor('keywords', k)));
  (applied.authors || []).forEach((a: string) => chips.push(labelFor('authors', a)));
  (applied.institutions || []).forEach((i: string) => chips.push(labelFor('institutions', i)));
  if (applied.language) chips.push(`Language: ${applied.language}`);
  if (applied.type) chips.push(prettyType(applied.type));
  if (applied.has_pdf) chips.push('PDF linked');
  if (applied.is_oa) chips.push('Open access');
  if (applied.has_doi) chips.push('Has DOI');
  if (applied.min_citations) chips.push(`${applied.min_citations}+ citations`);
  return chips;
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
const saveToLibrary = async (paper: OpenAlexWork) => {
  const userId = authStore.user?.id;
  if (!userId) return;
  savingId.value = paper.id;
  try {
    await researchService.saveToLibrary(userId, paper);
    savedIds.value = new Set(savedIds.value).add(paper.id);
    showToast('Saved to your research library.');
  } catch (err: any) {
    // 409 means it is already there - that is a success from the user's side.
    if (err?.status === 409) {
      savedIds.value = new Set(savedIds.value).add(paper.id);
      showToast('This paper is already in your library.');
    } else {
      showToast(err?.message || 'Could not save the paper.', 'err');
    }
  } finally {
    savingId.value = '';
  }
};

const downloadPdf = async (paper: OpenAlexWork) => {
  const userId = authStore.user?.id;
  if (!userId) return;
  downloadingId.value = paper.work_key;
  delete pdfFallback[paper.id];
  try {
    const filename = `${paper.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || paper.work_key}.pdf`;
    await researchService.downloadOpenAlexPdf(userId, paper.work_key, filename);
    showToast('PDF downloaded.');
  } catch (err: any) {
    // Some publishers block server-side fetches outright. Offer the raw
    // candidate URLs so the user can open them in their own browser session.
    pdfFallback[paper.id] = {
      message: err?.message || 'The publisher blocked the download.',
      urls: paper.pdf_candidates || [],
    };
    showToast('Could not fetch the PDF automatically — direct links are shown below.', 'err');
  } finally {
    downloadingId.value = '';
  }
};

// The AI writer links here with the plan's recommended search terms prefilled.
onMounted(() => {
  const q = route.query.q;
  if (typeof q === 'string' && q.trim()) {
    form.q = q.trim();
    runSearch(1);
  }
});
</script>

<style src="@/assets/css/research-flow.css"></style>
