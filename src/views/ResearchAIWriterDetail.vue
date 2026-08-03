<template>
  <div class="research-aiwriter-detail-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research/ai-writer')"><RfIconBack /> All researches</button>
      <h1 class="rf-page-title"><RfIconAI /> AI Research Writer</h1>
    </div>

    <div v-if="loading" class="rf-loading">
      <div class="rf-spinner"></div><p>Loading research…</p>
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
          <span><strong>{{ research.progress.generated }}</strong> / {{ research.progress.total }} sections</span>
          <span><strong>{{ research.progress.words.toLocaleString() }}</strong> words</span>
          <span>~<strong>{{ research.progress.estimated_pages }}</strong> pages</span>
          <span><strong>{{ research.sources.length }}</strong> sources</span>
          <span><strong>{{ research.references.length }}</strong> references</span>
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
            Writing section {{ batchDone + 1 }} of {{ batchTotal }} — <strong>{{ currentSectionTitle }}</strong>.
            Each section is a separate request, so you can leave this page and come back; finished
            sections are saved as they complete.
          </div>
        </div>
        <div v-if="research.plan_error" class="rf-alert rf-alert-warn">
          <RfIconWarning /> <div>{{ research.plan_error }}</div>
        </div>
      </div>

      <!-- ============ TABS ============ -->
      <div class="rf-tabs">
        <button :class="['rf-tab', { active: tab === 'plan' }]" @click="tab = 'plan'"><RfIconBook /> Research Plan</button>
        <button :class="['rf-tab', { active: tab === 'sections' }]" @click="tab = 'sections'"><RfIconDoc /> Document ({{ research.progress.generated }}/{{ research.progress.total }})</button>
        <button :class="['rf-tab', { active: tab === 'sources' }]" @click="tab = 'sources'"><RfIconLibrary /> Sources ({{ research.sources.length }})</button>
        <button :class="['rf-tab', { active: tab === 'references' }]" @click="tab = 'references'"><RfIconList /> References ({{ research.references.length }})</button>
        <button :class="['rf-tab', { active: tab === 'settings' }]" @click="tab = 'settings'"><RfIconEdit /> Title Page</button>
      </div>

      <!-- ============ PLAN ============ -->
      <div v-if="tab === 'plan'" class="rf-section">
        <div class="rf-plan-head">
          <h2 class="rf-section-title"><RfIconBook /> Research Plan</h2>
          <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="regeneratePlan" :disabled="busy">
            <RfIconRefresh /> {{ regenerating ? 'Regenerating…' : 'Regenerate plan' }}
          </button>
        </div>

        <div v-if="!hasPlan" class="rf-empty">
          <p>No plan has been generated yet.</p>
          <button class="rf-btn rf-btn-primary" @click="regeneratePlan" :disabled="busy">
            <RfIconAI /> Generate the research plan
          </button>
        </div>

        <template v-else>
          <div v-if="plan.thesis_statement" class="rf-plan-highlight">
            <h3 class="rf-subsection-title">Thesis statement</h3>
            <p class="rf-thesis">{{ plan.thesis_statement }}</p>
          </div>

          <div class="rf-plan-grid">
            <PlanBlock title="Problem statement" :text="plan.problem_statement" />
            <PlanBlock title="Research gap" :text="plan.research_gap" />
            <PlanBlock title="Significance" :text="plan.significance" />
            <PlanBlock title="Scope and delimitations" :text="plan.scope_and_delimitations" />
            <PlanBlock title="Theoretical framework" :text="plan.theoretical_framework" />
          </div>

          <PlanList title="Research questions" :items="plan.research_questions" />
          <PlanList title="Hypotheses" :items="plan.hypotheses" />
          <PlanList title="Aims" :items="plan.aims" />
          <PlanList title="Objectives" :items="plan.objectives" />

          <div v-if="plan.methodology_summary && Object.keys(plan.methodology_summary).length" class="rf-plan-block">
            <h3 class="rf-subsection-title">Methodology</h3>
            <dl class="rf-def-list">
              <template v-for="(value, key) in plan.methodology_summary" :key="key">
                <dt v-if="value">{{ prettyKey(String(key)) }}</dt>
                <dd v-if="value">{{ value }}</dd>
              </template>
            </dl>
          </div>

          <div v-if="plan.chapter_outline?.length" class="rf-plan-block">
            <h3 class="rf-subsection-title">Chapter outline</h3>
            <ol class="rf-outline-list">
              <li v-for="ch in plan.chapter_outline" :key="ch.number + ch.title">
                <strong>Chapter {{ ch.number }}: {{ ch.title }}</strong>
                <p>{{ ch.summary }}</p>
              </li>
            </ol>
          </div>

          <div v-if="plan.risks?.length" class="rf-plan-block">
            <h3 class="rf-subsection-title">Risks and mitigations</h3>
            <ul class="rf-risk-list">
              <li v-for="(r, i) in plan.risks" :key="i">
                <strong>{{ r.risk }}</strong><span> → {{ r.mitigation }}</span>
              </li>
            </ul>
          </div>

          <PlanList title="Next steps" :items="plan.next_steps" />

          <div v-if="plan.recommended_search_terms?.length" class="rf-plan-block">
            <h3 class="rf-subsection-title">Recommended search terms</h3>
            <div class="rf-keywords">
              <span v-for="term in plan.recommended_search_terms" :key="term" class="rf-keyword-badge">{{ term }}</span>
            </div>
            <div class="rf-plan-search-actions">
              <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="searchWith('openalex')">
                <RfIconGlobe /> Search these on OpenAlex
              </button>
              <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="searchWith('scholar')">
                <RfIconScholar /> Search these on Google Scholar
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- ============ SECTIONS ============ -->
      <div v-else-if="tab === 'sections'" class="rf-section">
        <h2 class="rf-section-title"><RfIconDoc /> Document Sections</h2>
        <p class="rf-hint">
          Sections are written one at a time so long documents do not time out. Generate them in
          order — each section is given the earlier ones as context so the argument stays consistent.
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
                <RfIconEdit /> Edit
              </button>
              <button v-if="section.content" class="rf-btn rf-btn-sm rf-btn-ghost" @click="copyText(section.content)">
                Copy text
              </button>
            </div>

            <div v-if="editingKey === section.key" class="rf-section-editor">
              <textarea v-model="editBuffer" class="rf-input rf-textarea rf-editor" rows="18"></textarea>
              <div class="rf-section-card-actions">
                <button class="rf-btn rf-btn-sm rf-btn-primary" @click="saveEdit(section)" :disabled="savingEdit">
                  {{ savingEdit ? 'Saving…' : 'Save changes' }}
                </button>
                <button class="rf-btn rf-btn-sm rf-btn-ghost" @click="editingKey = ''">Cancel</button>
              </div>
            </div>

            <div v-else-if="section.content" class="rf-section-content">
              <p v-for="(para, i) in section.content.split('\n\n')" :key="i">{{ para }}</p>
            </div>

            <p v-else class="rf-hint">Not written yet. Press <strong>Generate section</strong> above.</p>
          </div>
        </div>
      </div>

      <!-- ============ SOURCES ============ -->
      <div v-else-if="tab === 'sources'" class="rf-section">
        <div class="rf-plan-head">
          <h2 class="rf-section-title"><RfIconLibrary /> Sources the AI may cite</h2>
          <button class="rf-btn rf-btn-sm rf-btn-secondary" @click="importLibrary" :disabled="busy">
            <RfIconSave /> {{ importingLibrary ? 'Importing…' : 'Import my whole library' }}
          </button>
        </div>
        <p class="rf-hint">
          The writer cites only these sources. If the list is empty it writes from general
          disciplinary knowledge and will not invent citations — but the document will be far
          stronger with real literature attached.
        </p>

        <div v-if="!research.sources.length" class="rf-empty">
          <p>No sources attached.</p>
          <div class="rf-empty-actions">
            <button class="rf-btn rf-btn-primary" @click="$router.push('/research/import-openalex')">
              <RfIconGlobe /> Find papers on OpenAlex
            </button>
            <button class="rf-btn rf-btn-secondary" @click="$router.push('/research/google-scholar')">
              <RfIconScholar /> Search Google Scholar
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
                <span v-if="source.citation_count"> · {{ source.citation_count }} citations</span>
              </p>
            </div>
            <div class="rf-source-actions">
              <a v-if="source.landing_page_url || source.url" class="rf-btn rf-btn-xs rf-btn-ghost"
                 :href="source.landing_page_url || source.url" target="_blank" rel="noopener noreferrer">Open</a>
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
          <h2 class="rf-section-title"><RfIconList /> References</h2>
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

        <div v-if="!research.references.length" class="rf-empty">
          <p>No reference list yet.</p>
          <p class="rf-hint">Attach sources, then press <strong>Format references</strong>.</p>
        </div>
        <ol v-else class="rf-reference-list">
          <li v-for="(ref, i) in research.references" :key="i">{{ ref }}</li>
        </ol>
      </div>

      <!-- ============ TITLE PAGE SETTINGS ============ -->
      <div v-else-if="tab === 'settings'" class="rf-section">
        <h2 class="rf-section-title"><RfIconEdit /> Title Page Details</h2>
        <p class="rf-hint">These fields appear on the title page of the exported document.</p>

        <div class="rf-form-group">
          <label class="rf-label">Title</label>
          <input v-model="settings.title" class="rf-input" />
        </div>
        <div class="rf-form-row">
          <div class="rf-form-group">
            <label class="rf-label">Author name</label>
            <input v-model="settings.author_name" class="rf-input" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">Supervisor</label>
            <input v-model="settings.supervisor" class="rf-input" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">Submission year</label>
            <input v-model.number="settings.submission_year" class="rf-input" type="number" />
          </div>
        </div>
        <div class="rf-form-row">
          <div class="rf-form-group">
            <label class="rf-label">University</label>
            <input v-model="settings.university" class="rf-input" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">Department</label>
            <input v-model="settings.department" class="rf-input" />
          </div>
          <div class="rf-form-group">
            <label class="rf-label">Degree programme</label>
            <input v-model="settings.degree_program" class="rf-input" />
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-label">Keywords <span class="rf-optional">(comma separated)</span></label>
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
    showToast(`${result.count} sources attached.`);
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
    await researchService.exportAiResearch(userId, research.value.id, format, research.value.title);
    showToast(`${format.toUpperCase()} downloaded.`);
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
