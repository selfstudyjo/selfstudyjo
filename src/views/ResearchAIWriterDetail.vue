<template>
  <div class="research-aiwriter-detail-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research/ai-writer')"><RfIconBack /> {{ $t('All researches') }}</button>
      <h1 class="rf-page-title"><RfIconAI /> {{ $t('AI Research Writer') }}</h1>
    </div>

    <div v-if="loading" class="rf-loading">
      <div class="rf-spinner"></div><p>{{ $t('Loading research…') }}</p>
    </div>

    <div v-else-if="loadError" class="rf-alert rf-alert-error">{{ loadError }}</div>

    <template v-else-if="research">
      <!-- ============ HEADER ============ -->
      <div class="rf-section rf-doc-header">
        <div class="rf-doc-header-top">
          <span class="rf-type-badge" :class="`rf-type-${research.research_type}`">
            {{ structure?.label || research.research_type }}
          </span>
          <span class="rf-status-badge" :class="`rf-status-${research.status}`">{{ statusLabel }}</span>
        </div>
        <h2 class="rf-doc-title">{{ research.title }}</h2>
        <p class="rf-doc-topic">{{ research.topic }}</p>

        <div class="rf-progress-track rf-progress-lg">
          <div class="rf-progress-fill" :style="{ width: `${research.progress.percent}%` }"></div>
        </div>
        <div class="rf-doc-stats">
          <span><strong>{{ research.progress.generated }}</strong> {{ $t('/ {v0} sections', { v0: research.progress.total }) }}</span>
          <span><strong>{{ research.progress.words.toLocaleString() }}</strong> {{ $t('words') }}</span>
          <span>~<strong>{{ research.progress.estimated_pages }}</strong> {{ $t('pages') }}</span>
          <span><strong>{{ research.sources.length }}</strong> {{ $t('sources') }}</span>
          <span><strong>{{ research.references.length }}</strong> {{ $t('references') }}</span>
        </div>

        <div class="rf-doc-actions">
          <button class="rf-btn rf-btn-primary" @click="generateAll" :disabled="busy">
            <RfIconPlay /> {{ generatingAll ? `Writing ${currentSectionTitle}…` : 'Generate all remaining sections' }}
          </button>
          <button class="rf-btn rf-btn-secondary" @click="buildReferences" :disabled="busy || !research.sources.length">
            <RfIconList /> {{ buildingRefs ? 'Formatting…' : 'Build reference list' }}
          </button>
          <button class="rf-btn rf-btn-success" @click="exportDoc('docx')" :disabled="busy || !research.progress.generated">
            <RfIconDoc /> {{ exporting === 'docx' ? 'Preparing…' : 'Download DOCX' }}
          </button>
          <button class="rf-btn rf-btn-success" @click="exportDoc('pdf')" :disabled="busy || !research.progress.generated">
            <RfIconDownload /> {{ exporting === 'pdf' ? 'Preparing…' : 'Download PDF' }}
          </button>
        </div>

        <div v-if="generatingAll" class="rf-alert rf-alert-info">
          <div class="rf-spinner rf-spinner-sm"></div>
          <div>
            {{ $t('Writing section {v0} of {v1} —', { v0: batchDone + 1, v1: batchTotal }) }} <strong>{{ currentSectionTitle }}</strong>{{ $t('. Each section is a separate request, so you can leave this page and come back; finished sections are saved as they complete.') }}
          </div>
        </div>
        <div v-if="research.plan_error" class="rf-alert rf-alert-warn">
          <RfIconWarning /> <div>{{ research.plan_error }}</div>
        </div>

        <div v-if="!research.sources.length" class="rf-alert rf-alert-warn">
          <RfIconWarning />
          <div>
            <strong>{{ $t('No sources attached, so the document will export without a reference list.') }}</strong>
            {{ $t('Attach papers on the') }} <button class="rf-link-btn" @click="tab = 'sources'">{{ $t('Sources') }}</button>
            {{ $t('tab — the writer then cites them in the text and builds the bibliography in {v0} automatically.', { v0: research.citation_style || 'APA 7th edition' }) }}
          </div>
        </div>
        <div v-else-if="!research.references.length" class="rf-alert rf-alert-info">
          <RfIconList />
          <div>
            {{ $t('{v0} source{v1} attached. The reference list is built automatically when you export, or press', { v0: research.sources.length, v1: research.sources.length === 1 ? '' : 's' }) }}
            <button class="rf-link-btn" @click="buildReferences">{{ $t('Build reference list') }}</button>
            {{ $t('to review it first.') }}
          </div>
        </div>
      </div>

      <!-- ============ TABS ============ -->
      <div class="rf-tabs">
        <button :class="['rf-tab', { active: tab === 'plan' }]" @click="tab = 'plan'"><RfIconBook /> {{ $t('Research Plan') }}</button>
        <button :class="['rf-tab', { active: tab === 'sections' }]" @click="tab = 'sections'"><RfIconDoc /> {{ $t('Document ({v0}/{v1})', { v0: research.progress.generated, v1: research.progress.total }) }}</button>
        <button :class="['rf-tab', { active: tab === 'sources' }]" @click="tab = 'sources'"><RfIconLibrary /> {{ $t('Sources ({v0})', { v0: research.sources.length }) }}</button>
        <button :class="['rf-tab', { active: tab === 'references' }]" @click="tab = 'references'"><RfIconList /> {{ $t('References ({v0})', { v0: research.references.length }) }}</button>
        <button :class="['rf-tab', { active: tab === 'settings' }]" @click="tab = 'settings'"><RfIconEdit /> {{ $t('Title Page') }}</button>
      </div>

      <!-- ============ PLAN ============ -->
      <div v-if="tab === 'plan'" class="rf-section">
        <div class="rf-plan-head">
          <h2 class="rf-section-title"><RfIconBook /> {{ $t('Research Plan') }}</h2>
          <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="regeneratePlan" :disabled="busy">
            <RfIconRefresh /> {{ regenerating ? 'Regenerating…' : 'Regenerate plan' }}
          </button>
        </div>

        <div v-if="!hasPlan" class="rf-empty">
          <p>{{ $t('No plan has been generated yet.') }}</p>
          <button class="rf-btn rf-btn-primary" @click="regeneratePlan" :disabled="busy">
            <RfIconAI /> {{ $t('Generate the research plan') }}
          </button>
        </div>

        <template v-else>
          <div v-if="plan.thesis_statement" class="rf-plan-highlight">
            <h3 class="rf-subsection-title">{{ $t('Thesis statement') }}</h3>
            <p class="rf-thesis">{{ plan.thesis_statement }}</p>
          </div>

          <div class="rf-plan-grid">
            <PlanBlock :title="$t('Problem statement')" :text="plan.problem_statement" />
            <PlanBlock :title="$t('Research gap')" :text="plan.research_gap" />
            <PlanBlock :title="$t('Significance')" :text="plan.significance" />
            <PlanBlock :title="$t('Scope and delimitations')" :text="plan.scope_and_delimitations" />
            <PlanBlock :title="$t('Theoretical framework')" :text="plan.theoretical_framework" />
          </div>

          <PlanList :title="$t('Research questions')" :items="plan.research_questions" />
          <PlanList :title="$t('Hypotheses')" :items="plan.hypotheses" />
          <PlanList :title="$t('Aims')" :items="plan.aims" />
          <PlanList :title="$t('Objectives')" :items="plan.objectives" />

          <div v-if="plan.methodology_summary && Object.keys(plan.methodology_summary).length" class="rf-plan-block">
            <h3 class="rf-subsection-title">{{ $t('Methodology') }}</h3>
            <dl class="rf-def-list">
              <template v-for="(value, key) in plan.methodology_summary" :key="key">
                <dt v-if="value">{{ prettyKey(String(key)) }}</dt>
                <dd v-if="value">{{ value }}</dd>
              </template>
            </dl>
          </div>

          <div v-if="plan.chapter_outline?.length" class="rf-plan-block">
            <h3 class="rf-subsection-title">{{ $t('Chapter outline') }}</h3>
            <ol class="rf-outline-list">
              <li v-for="ch in plan.chapter_outline" :key="ch.number + ch.title">
                <strong>{{ $t('Chapter {v0}: {v1}', { v0: ch.number, v1: ch.title }) }}</strong>
                <p>{{ ch.summary }}</p>
              </li>
            </ol>
          </div>

          <div v-if="plan.risks?.length" class="rf-plan-block">
            <h3 class="rf-subsection-title">{{ $t('Risks and mitigations') }}</h3>
            <ul class="rf-risk-list">
              <li v-for="(r, i) in plan.risks" :key="i">
                <strong>{{ r.risk }}</strong><span> → {{ r.mitigation }}</span>
              </li>
            </ul>
          </div>

          <PlanList :title="$t('Next steps')" :items="plan.next_steps" />

          <div v-if="plan.recommended_search_terms?.length" class="rf-plan-block">
            <h3 class="rf-subsection-title">{{ $t('Recommended search terms') }}</h3>
            <div class="rf-keywords">
              <span v-for="term in plan.recommended_search_terms" :key="term" class="rf-keyword-badge">{{ term }}</span>
            </div>
            <div class="rf-plan-search-actions">
              <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="searchWith('openalex')">
                <RfIconGlobe /> {{ $t('Search these on OpenAlex') }}
              </button>
              <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="searchWith('scholar')">
                <RfIconScholar /> {{ $t('Search these on Google Scholar') }}
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- ============ SECTIONS ============ -->
      <div v-else-if="tab === 'sections'" class="rf-section">
        <h2 class="rf-section-title"><RfIconDoc /> {{ $t('Document Sections') }}</h2>
        <p class="rf-hint">
          {{ $t('Sections are written one at a time so long documents do not time out. Generate them in order — each section is given the earlier ones as context so the argument stays consistent.') }}
        </p>

        <div v-for="section in research.sections" :key="section.key" class="rf-section-card">
          <div class="rf-section-card-head" @click="toggleSection(section.key)">
            <div class="rf-section-card-label">
              <span class="rf-section-num">{{ section.number ? `Chapter ${section.number}` : 'Front matter' }}</span>
              <h3 class="rf-section-card-title">{{ section.title }}</h3>
            </div>
            <div class="rf-section-card-status">
              <span class="rf-word-count">
                {{ section.word_count ? `${section.word_count} / ~${section.word_target} words` : `target ~${section.word_target} words` }}
              </span>
              <span class="rf-status-dot" :class="`rf-dot-${section.status}`" :title="section.status"></span>
            </div>
          </div>

          <div v-if="openSections.has(section.key)" class="rf-section-card-body">
            <div class="rf-section-card-actions">
              <button class="rf-btn rf-btn-sm rf-btn-primary"
                      @click="generateSection(section, !!section.content)"
                      :disabled="busy">
                <RfIconAI />
                {{ generatingKey === section.key ? 'Writing…' : (section.content ? 'Rewrite section' : 'Generate section') }}
              </button>
              <button v-if="section.content" class="rf-btn rf-btn-sm rf-btn-secondary" @click="startEdit(section)">
                <RfIconEdit /> {{ $t('Edit') }}
              </button>
              <button v-if="section.content" class="rf-btn rf-btn-sm rf-btn-ghost" @click="copyText(section.content)">
                {{ $t('Copy text') }}
              </button>
            </div>

            <div v-if="editingKey === section.key" class="rf-section-editor">
              <textarea v-model="editBuffer" class="rf-input rf-textarea rf-editor" rows="18"></textarea>
              <div class="rf-section-card-actions">
                <button class="rf-btn rf-btn-sm rf-btn-primary" @click="saveEdit(section)" :disabled="savingEdit">
                  {{ savingEdit ? 'Saving…' : 'Save changes' }}
                </button>
                <button class="rf-btn rf-btn-sm rf-btn-ghost" @click="editingKey = ''">{{ $t('Cancel') }}</button>
              </div>
            </div>

            <div v-else-if="section.content" class="rf-section-content">
              <p v-for="(para, i) in section.content.split('\n\n')" :key="i">{{ para }}</p>
            </div>

            <p v-else class="rf-hint">{{ $t('Not written yet. Press') }} <strong>{{ $t('Generate section') }}</strong> {{ $t('above.') }}</p>
          </div>
        </div>
      </div>

      <!-- ============ SOURCES ============ -->
      <div v-else-if="tab === 'sources'" class="rf-section">
        <div class="rf-plan-head">
          <h2 class="rf-section-title"><RfIconLibrary /> {{ $t('Sources the AI may cite') }}</h2>
          <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="importLibrary" :disabled="busy">
            <RfIconSave /> {{ importingLibrary ? 'Importing…' : 'Import my whole library' }}
          </button>
        </div>
        <p class="rf-hint">
          {{ $t('The writer cites only these sources. If the list is empty it writes from general disciplinary knowledge and will not invent citations — but the document will be far stronger with real literature attached.') }}
        </p>

        <div v-if="!research.sources.length" class="rf-empty">
          <p>{{ $t('No sources attached.') }}</p>
          <div class="rf-empty-actions">
            <button class="rf-btn rf-btn-primary" @click="$router.push('/research/import-openalex')">
              <RfIconGlobe /> {{ $t('Find papers on OpenAlex') }}
            </button>
            <button class="rf-btn rf-btn-secondary" @click="$router.push('/research/google-scholar')">
              <RfIconScholar /> {{ $t('Search Google Scholar') }}
            </button>
          </div>
        </div>

        <div v-else class="rf-source-list">
          <div v-for="(source, index) in research.sources" :key="sourceKey(source, index)" class="rf-source-item">
            <div class="rf-source-main">
              <h4>{{ source.title }}</h4>
              <p class="rf-source-meta">
                <span v-if="source.author_names?.length">{{ source.author_names.slice(0, 4).join(', ') }}</span>
                <span v-if="source.publication_year"> · {{ source.publication_year }}</span>
                <span v-if="source.venue"> · {{ source.venue }}</span>
                <span v-if="source.citation_count"> {{ $t('· {v0} citations', { v0: source.citation_count }) }}</span>
              </p>
            </div>
            <div class="rf-source-actions">
              <a v-if="source.landing_page_url || source.url" class="rf-btn rf-btn-xs rf-btn-ghost"
                 :href="source.landing_page_url || source.url" target="_blank" rel="noopener noreferrer">{{ $t('Open') }}</a>
              <button class="rf-btn rf-btn-xs rf-btn-danger" @click="removeSource(source, index)">
                <RfIconDelete />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ REFERENCES ============ -->
      <div v-else-if="tab === 'references'" class="rf-section">
        <div class="rf-plan-head">
          <h2 class="rf-section-title"><RfIconList /> {{ $t('References') }}</h2>
          <div class="rf-inline-controls">
            <select v-model="citationStyle" class="rf-input rf-input-sm">
              <option v-for="s in CITATION_STYLES" :key="s" :value="s">{{ s }}</option>
            </select>
            <button class="rf-btn rf-btn-sm rf-btn-primary" @click="buildReferences"
                    :disabled="busy || !research.sources.length">
              <RfIconRefresh /> {{ buildingRefs ? 'Formatting…' : 'Format references' }}
            </button>
          </div>
        </div>

        <p class="rf-hint">
          {{ $t('Formatted in {v0} with a hanging indent. Journal titles are italicised and each DOI or URL becomes a clickable link in the exported DOCX and PDF. Only metadata held for the source is used — no page range or DOI is guessed.', { v0: research.citation_style || 'APA 7th edition' }) }}
        </p>

        <div v-if="!research.references.length" class="rf-empty">
          <p>{{ $t('No reference list yet.') }}</p>
          <p class="rf-hint">
            {{ research.sources.length
              ? 'Press Format references above, or just export — it is built automatically.'
              : 'Attach sources on the Sources tab first.' }}
          </p>
        </div>
        <ol v-else class="rf-reference-list">
          <li v-for="(ref, i) in research.references" :key="i">{{ ref }}</li>
        </ol>
      </div>

      <!-- ============ TITLE PAGE SETTINGS ============ -->
      <div v-else-if="tab === 'settings'" class="rf-section">
        <h2 class="rf-section-title"><RfIconEdit /> {{ $t('Title Page Details') }}</h2>
        <p class="rf-hint">{{ $t('These fields appear on the title page of the exported document.') }}</p>

        <div class="rf-form-group">
          <label class="rf-label">{{ $t('Title') }}</label>
          <input v-model="settings.title" class="rf-input" />
        </div>
        <div class="rf-form-row">
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Author name') }}</label>
            <input v-model="settings.author_name" class="rf-input" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Supervisor') }}</label>
            <input v-model="settings.supervisor" class="rf-input" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Submission year') }}</label>
            <input v-model.number="settings.submission_year" class="rf-input" type="number" />
          </div>
        </div>
        <div class="rf-form-row">
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('University') }}</label>
            <input v-model="settings.university" class="rf-input" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Department') }}</label>
            <input v-model="settings.department" class="rf-input" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">{{ $t('Degree programme') }}</label>
            <input v-model="settings.degree_program" class="rf-input" />
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-label">{{ $t('Keywords') }} <span class="rf-optional">{{ $t('(comma separated)') }}</span></label>
          <input v-model="settings.keywords" class="rf-input" />
        </div>

        <div class="rf-form-actions">
          <button class="rf-btn rf-btn-primary" @click="saveSettings" :disabled="savingSettings">
            {{ savingSettings ? 'Saving…' : 'Save title page' }}
          </button>
        </div>
      </div>
    </template>

    <div v-if="toast" class="rf-toast" :class="`rf-toast-${toast.kind}`">{{ toast.text }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, type PropType } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import { researchService } from '@/services/research.service';
import type { AiResearch, ResearchSection, ResearchTypeInfo } from '@/services/research.service';
import {
  RfIconBack, RfIconAI, RfIconBook, RfIconDoc, RfIconList, RfIconLibrary, RfIconEdit,
  RfIconRefresh, RfIconPlay, RfIconDownload, RfIconWarning, RfIconDelete, RfIconSave,
  RfIconGlobe, RfIconScholar,
} from '@/utils/rf-icons';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const researchStore = useResearchStore();

const CITATION_STYLES = ['APA 7th edition', 'MLA 9th edition', 'Chicago 17th edition',
  'Harvard', 'IEEE', 'Vancouver'];

// --- Small presentational helpers -----------------------------------------
const PlanBlock = defineComponent({
  props: { title: { type: String, required: true }, text: { type: String, default: '' } },
  setup: (props) => () => (props.text
    ? h('div', { class: 'rf-plan-block' }, [
        h('h3', { class: 'rf-subsection-title' }, props.title),
        h('p', props.text),
      ])
    : null),
});

const PlanList = defineComponent({
  props: { title: { type: String, required: true }, items: { type: Array as PropType<string[]>, default: () => [] } },
  setup: (props) => () => (props.items?.length
    ? h('div', { class: 'rf-plan-block' }, [
        h('h3', { class: 'rf-subsection-title' }, props.title),
        h('ul', { class: 'rf-plan-ul' }, props.items.map((item, i) => h('li', { key: i }, item))),
      ])
    : null),
});

// --- State -----------------------------------------------------------------
const researchId = computed(() => String(route.params.id || ''));
const loading = ref(true);
const loadError = ref('');
const research = ref<AiResearch | null>(null);
const structure = ref<ResearchTypeInfo | null>(null);

const tab = ref<'plan' | 'sections' | 'sources' | 'references' | 'settings'>('plan');
const openSections = ref<Set<string>>(new Set());
const editingKey = ref('');
const editBuffer = ref('');
const savingEdit = ref(false);

const generatingKey = ref('');
const generatingAll = ref(false);
const batchDone = ref(0);
const batchTotal = ref(0);
const currentSectionTitle = ref('');
const regenerating = ref(false);
const buildingRefs = ref(false);
const importingLibrary = ref(false);
const exporting = ref('');
const savingSettings = ref(false);
const citationStyle = ref('APA 7th edition');
const toast = ref<{ text: string; kind: 'ok' | 'err' } | null>(null);

const settings = reactive({
  title: '', author_name: '', supervisor: '', submission_year: new Date().getFullYear(),
  university: '', department: '', degree_program: '', keywords: '',
});

const busy = computed(() =>
  !!generatingKey.value || generatingAll.value || regenerating.value ||
  buildingRefs.value || !!exporting.value || importingLibrary.value);

const plan = computed(() => research.value?.plan || {});
const hasPlan = computed(() => Object.keys(plan.value).length > 0);
const statusLabel = computed(() => ({
  draft: 'Plan ready', in_progress: 'In progress', completed: 'Completed',
} as Record<string, string>)[research.value?.status || 'draft'] || '');

const prettyKey = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const sourceKey = (source: any, index: number) => source.id || source.openalex_id || `src-${index}`;

const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
  toast.value = { text, kind };
  setTimeout(() => { toast.value = null; }, 5000);
};

// --- Load ------------------------------------------------------------------
const load = async () => {
  const userId = authStore.user?.id;
  if (!userId) { loadError.value = 'You need to be signed in.'; loading.value = false; return; }
  loading.value = true;
  loadError.value = '';
  try {
    const payload = await researchService.getAiResearch(userId, researchId.value);
    research.value = payload.research;
    structure.value = payload.structure;
    citationStyle.value = payload.research.citation_style || 'APA 7th edition';
    Object.assign(settings, {
      title: payload.research.title,
      author_name: payload.research.author_name,
      supervisor: payload.research.supervisor,
      submission_year: payload.research.submission_year,
      university: payload.research.university,
      department: payload.research.department,
      degree_program: payload.research.degree_program,
      keywords: (payload.research.keywords || []).join(', '),
    });
    if (payload.research.progress.generated > 0) tab.value = 'sections';
  } catch (err: any) {
    loadError.value = err?.message || 'Could not load this research.';
  } finally {
    loading.value = false;
  }
};

// --- Sections --------------------------------------------------------------
const toggleSection = (key: string) => {
  const next = new Set(openSections.value);
  next.has(key) ? next.delete(key) : next.add(key);
  openSections.value = next;
};

const generateSection = async (section: ResearchSection, force = false) => {
  const userId = authStore.user?.id;
  if (!userId || !research.value) return;
  if (force && !confirm(`Rewrite "${section.title}"? The current text will be replaced.`)) return;

  generatingKey.value = section.key;
  try {
    const result = await researchService.generateAiSection(userId, research.value.id, section.key, force);
    Object.assign(section, result.section);
    research.value.progress = result.progress;
    research.value.status = result.status as AiResearch['status'];
    openSections.value = new Set(openSections.value).add(section.key);
    return true;
  } catch (err: any) {
    showToast(err?.message || `Could not write "${section.title}".`, 'err');
    return false;
  } finally {
    generatingKey.value = '';
  }
};

/**
 * Write every remaining section, one request at a time.
 *
 * Sequential on purpose: each section is given the previous ones as context, so
 * running them in parallel would break continuity — and would hit the provider
 * rate limits immediately.
 */
const generateAll = async () => {
  if (!research.value) return;
  const pending = research.value.sections.filter(s => !s.content?.trim());
  if (!pending.length) { showToast('Every section already has content.'); return; }

  generatingAll.value = true;
  batchDone.value = 0;
  batchTotal.value = pending.length;
  tab.value = 'sections';

  for (const section of pending) {
    currentSectionTitle.value = section.title;
    const ok = await generateSection(section, false);
    if (!ok) {
      showToast(
        `Stopped at "${section.title}". Finished sections are already saved — ` +
        'wait a moment for the rate limit to clear, then press Generate again.',
        'err',
      );
      break;
    }
    batchDone.value += 1;
  }

  generatingAll.value = false;
  currentSectionTitle.value = '';
  if (batchDone.value === batchTotal.value) showToast('All sections written.');
};

const startEdit = (section: ResearchSection) => {
  editingKey.value = section.key;
  editBuffer.value = section.content;
};

const saveEdit = async (section: ResearchSection) => {
  const userId = authStore.user?.id;
  if (!userId || !research.value) return;
  savingEdit.value = true;
  try {
    const updated = await researchService.updateAiResearch(userId, research.value.id, {
      section_key: section.key,
      content: editBuffer.value,
    });
    research.value = updated;
    editingKey.value = '';
    showToast('Section saved.');
  } catch (err: any) {
    showToast(err?.message || 'Could not save the section.', 'err');
  } finally {
    savingEdit.value = false;
  }
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard.');
  } catch {
    showToast('Could not copy — select the text manually.', 'err');
  }
};

// --- Plan ------------------------------------------------------------------
const regeneratePlan = async () => {
  const userId = authStore.user?.id;
  if (!userId || !research.value) return;
  regenerating.value = true;
  try {
    research.value = await researchService.regenerateAiPlan(userId, research.value.id);
    showToast('Research plan regenerated.');
  } catch (err: any) {
    showToast(err?.message || 'Could not regenerate the plan.', 'err');
  } finally {
    regenerating.value = false;
  }
};

const searchWith = (engine: 'openalex' | 'scholar') => {
  const terms = (plan.value.recommended_search_terms || []).slice(0, 6).join(' ');
  const target = engine === 'openalex' ? '/research/import-openalex' : '/research/google-scholar';
  router.push({ path: target, query: { q: terms || research.value?.topic || '' } });
};

// --- Sources ---------------------------------------------------------------
const importLibrary = async () => {
  const userId = authStore.user?.id;
  if (!userId || !research.value) return;
  importingLibrary.value = true;
  try {
    const result = await researchService.setAiResearchSources(userId, research.value.id, { from_library: true });
    research.value.sources = result.sources;
    // The backend clears the cached bibliography whenever the source list
    // changes, so it is rebuilt against the new sources rather than exported stale.
    research.value.references = [];
    showToast(`${result.count} sources attached. The reference list will rebuild on export.`);
  } catch (err: any) {
    showToast(err?.message || 'Could not import your library.', 'err');
  } finally {
    importingLibrary.value = false;
  }
};

const removeSource = async (source: any, index: number) => {
  const userId = authStore.user?.id;
  if (!userId || !research.value) return;
  const key = source.id || source.openalex_id;
  try {
    if (key) {
      const result = await researchService.setAiResearchSources(userId, research.value.id, { remove: [key] });
      research.value.sources = result.sources;
    } else {
      const next = [...research.value.sources];
      next.splice(index, 1);
      const result = await researchService.setAiResearchSources(userId, research.value.id, { sources: next });
      research.value.sources = result.sources;
    }
    research.value.references = [];
  } catch (err: any) {
    showToast(err?.message || 'Could not remove the source.', 'err');
  }
};

// --- References ------------------------------------------------------------
const buildReferences = async () => {
  const userId = authStore.user?.id;
  if (!userId || !research.value) return;
  buildingRefs.value = true;
  try {
    const result = await researchService.generateAiReferences(userId, research.value.id, citationStyle.value);
    research.value.references = result.references;
    research.value.citation_style = result.style;
    tab.value = 'references';
    showToast(`${result.count} references formatted in ${result.style}.`);
  } catch (err: any) {
    showToast(err?.message || 'Could not format the references.', 'err');
  } finally {
    buildingRefs.value = false;
  }
};

// --- Settings & export -----------------------------------------------------
const saveSettings = async () => {
  const userId = authStore.user?.id;
  if (!userId || !research.value) return;
  savingSettings.value = true;
  try {
    research.value = await researchService.updateAiResearch(userId, research.value.id, {
      ...settings,
      keywords: settings.keywords,
    });
    showToast('Title page saved.');
  } catch (err: any) {
    showToast(err?.message || 'Could not save the title page.', 'err');
  } finally {
    savingSettings.value = false;
  }
};

const exportDoc = async (format: 'docx' | 'pdf') => {
  const userId = authStore.user?.id;
  if (!userId || !research.value) return;
  exporting.value = format;
  try {
    // A thesis should never download without its bibliography. If the student
    // went straight from generating sections to exporting, build the reference
    // list first so the REFERENCES chapter is present in the file.
    if (!research.value.references.length && research.value.sources.length) {
      try {
        const built = await researchService.generateAiReferences(
          userId, research.value.id, citationStyle.value);
        research.value.references = built.references;
        research.value.citation_style = built.style;
        showToast(`${built.count} references formatted in ${built.style} and added to the document.`);
      } catch {
        // Non-fatal: the backend rebuilds it during export as a safety net.
      }
    }

    await researchService.exportAiResearch(userId, research.value.id, format, research.value.title);

    if (!research.value.references.length && !research.value.sources.length) {
      showToast(`${format.toUpperCase()} downloaded, but it has no reference list — `
        + 'attach sources on the Sources tab to get a bibliography.', 'err');
    } else {
      showToast(`${format.toUpperCase()} downloaded.`);
    }
  } catch (err: any) {
    showToast(err?.message || `Could not export the ${format.toUpperCase()}.`, 'err');
  } finally {
    exporting.value = '';
  }
};

onMounted(async () => {
  await load();
  const userId = authStore.user?.id;
  if (userId && !researchStore.importedPapers.length) {
    researchStore.loadImportedPapers(userId).catch(() => { /* library is optional here */ });
  }
});
</script>

<style src="@/assets/css/research-flow.css"></style>
