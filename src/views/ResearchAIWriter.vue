<template>
  <div class="research-aiwriter-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research')"><RfIconBack /> Back</button>
      <h1 class="rf-page-title"><RfIconAI /> AI Research Writer</h1>
    </div>

    <div class="rf-tabs">
      <button :class="['rf-tab', { active: tab === 'mine' }]" @click="tab = 'mine'">
        <RfIconList /> My AI Researches ({{ researches.length }})
      </button>
      <button :class="['rf-tab', { active: tab === 'new' }]" @click="tab = 'new'">
        <RfIconAdd /> Start a New Research
      </button>
      <button :class="['rf-tab', { active: tab === 'types' }]" @click="tab = 'types'">
        <RfIconBook /> Compare Research Types
      </button>
    </div>

    <!-- ================= MY RESEARCHES ================= -->
    <div v-if="tab === 'mine'">
      <div v-if="loading" class="rf-loading">
        <div class="rf-spinner"></div><p>Loading your researches…</p>
      </div>

      <div v-else-if="researches.length === 0" class="rf-empty">
        <p>You have not started an AI research yet.</p>
        <p class="rf-hint">
          The writer builds a full thesis structure for you — plan, chapters, references — and
          exports it as a Word document or a PDF.
        </p>
        <button class="rf-btn rf-btn-primary" @click="tab = 'new'"><RfIconAdd /> Start a New Research</button>
      </div>

      <div v-else class="rf-research-grid">
        <div v-for="item in researches" :key="item.id" class="rf-research-card"
             @click="$router.push(`/research/ai-writer/${item.id}`)">
          <div class="rf-research-card-head">
            <span class="rf-type-badge" :class="`rf-type-${item.research_type}`">{{ item.research_type_label }}</span>
            <span class="rf-status-badge" :class="`rf-status-${item.status}`">{{ statusLabel(item.status) }}</span>
          </div>

          <h3 class="rf-research-card-title">{{ item.title }}</h3>
          <p class="rf-research-card-topic">{{ truncate(item.topic, 130) }}</p>

          <div class="rf-progress-track">
            <div class="rf-progress-fill" :style="{ width: `${item.progress?.percent || 0}%` }"></div>
          </div>
          <div class="rf-research-card-stats">
            <span>{{ item.progress?.generated || 0 }} / {{ item.progress?.total || 0 }} sections</span>
            <span>{{ (item.progress?.words || 0).toLocaleString() }} words</span>
            <span>~{{ item.progress?.estimated_pages || 0 }} pages</span>
          </div>

          <div class="rf-research-card-meta">
            <span v-if="item.field"><RfIconTag /> {{ item.field }}</span>
            <span><RfIconLibrary /> {{ item.source_count }} sources</span>
            <span><RfIconTime /> {{ formatDate(item.updated_at) }}</span>
          </div>

          <div class="rf-research-card-actions" @click.stop>
            <button class="rf-btn rf-btn-xs rf-btn-primary" @click="$router.push(`/research/ai-writer/${item.id}`)">
              <RfIconEdit /> Open
            </button>
            <button class="rf-btn rf-btn-xs rf-btn-secondary"
                    :disabled="!item.progress?.generated || exportingId === item.id"
                    @click="exportResearch(item, 'docx')">
              <RfIconDoc /> DOCX
            </button>
            <button class="rf-btn rf-btn-xs rf-btn-secondary"
                    :disabled="!item.progress?.generated || exportingId === item.id"
                    @click="exportResearch(item, 'pdf')">
              <RfIconDownload /> PDF
            </button>
            <button class="rf-btn rf-btn-xs rf-btn-danger" @click="remove(item)"><RfIconDelete /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= NEW RESEARCH ================= -->
    <div v-else-if="tab === 'new'" class="rf-section">
      <h2 class="rf-section-title"><RfIconAdd /> Start a New Research</h2>

      <div v-if="!aiAvailable && typesLoaded" class="rf-alert rf-alert-error">
        <RfIconWarning />
        <div>No AI provider is configured on this server, so plans and chapters cannot be
          generated. Ask an administrator to set <code>GROQ_API_KEYS</code>,
          <code>OPENROUTER_API_KEYS</code> or <code>GEMINI_API_KEYS</code>.</div>
      </div>

      <!-- Type selection -->
      <label class="rf-filter-legend"><RfIconBook /> Research type <span class="rf-required">*</span></label>
      <div class="rf-type-grid">
        <div v-for="t in types" :key="t.key"
             class="rf-type-card" :class="{ selected: draft.research_type === t.key }"
             @click="draft.research_type = t.key">
          <h3 class="rf-type-card-title">{{ t.label }}</h3>
          <p class="rf-type-card-level">{{ t.level }}</p>
          <p class="rf-type-card-goal">{{ t.goal }}</p>
          <ul class="rf-type-card-facts">
            <li><strong>Length:</strong> {{ t.page_range }}</li>
            <li><strong>Chapters:</strong> {{ t.sections.filter(s => s.kind === 'chapter').length }}</li>
            <li><strong>Originality:</strong> {{ t.originality }}</li>
            <li><strong>Theory:</strong> {{ t.theory }}</li>
          </ul>
        </div>
      </div>

      <!-- Structure preview -->
      <div v-if="selectedType" class="rf-structure-preview">
        <h3 class="rf-subsection-title">
          Document structure — {{ selectedType.label }}
          <span class="rf-structure-sub">
            {{ selectedType.section_count }} sections · ~{{ selectedType.estimated_words.toLocaleString() }} words
          </span>
        </h3>
        <ol class="rf-structure-list">
          <li v-for="s in selectedType.sections" :key="s.key">
            <span class="rf-structure-num">{{ s.number ? `Chapter ${s.number}` : 'Front matter' }}</span>
            <span class="rf-structure-title">{{ s.title }}</span>
            <span class="rf-structure-words">~{{ s.word_target }} words</span>
          </li>
        </ol>
      </div>

      <!-- Core fields -->
      <div class="rf-form-group">
        <label class="rf-label">Research topic <span class="rf-required">*</span></label>
        <textarea v-model="draft.topic" class="rf-input rf-textarea" rows="3"
          placeholder="Describe what you want to research. Be as specific as you can — the plan quality depends on it. e.g. The effect of hand-gesture controlled exergames on wrist flexibility in post-stroke rehabilitation among adults in Jordan."></textarea>
      </div>

      <div class="rf-form-row">
        <div class="rf-form-group" style="flex: 2;">
          <label class="rf-label">Working title <span class="rf-optional">(optional — AI will propose one)</span></label>
          <input v-model="draft.title" class="rf-input" placeholder="Leave blank to let the AI write the title" />
        </div>
        <div class="rf-form-group">
          <label class="rf-label">Field of study</label>
          <input v-model="draft.field" class="rf-input" placeholder="e.g. Human-Computer Interaction" />
        </div>
      </div>

      <div class="rf-form-row">
        <div class="rf-form-group">
          <label class="rf-label">Your name</label>
          <input v-model="draft.author_name" class="rf-input" placeholder="Appears on the title page" />
        </div>
        <div class="rf-form-group">
          <label class="rf-label">University</label>
          <input v-model="draft.university" class="rf-input" placeholder="e.g. University of Jordan" />
        </div>
        <div class="rf-form-group">
          <label class="rf-label">Department</label>
          <input v-model="draft.department" class="rf-input" placeholder="e.g. Department of Computer Science" />
        </div>
      </div>

      <div class="rf-form-row">
        <div class="rf-form-group">
          <label class="rf-label">Degree programme</label>
          <input v-model="draft.degree_program" class="rf-input" placeholder="e.g. MSc in Computer Science" />
        </div>
        <div class="rf-form-group">
          <label class="rf-label">Supervisor</label>
          <input v-model="draft.supervisor" class="rf-input" placeholder="e.g. Prof. A. Rahman" />
        </div>
        <div class="rf-form-group">
          <label class="rf-label">Submission year</label>
          <input v-model.number="draft.submission_year" class="rf-input" type="number" />
        </div>
      </div>

      <div class="rf-form-row">
        <div class="rf-form-group">
          <label class="rf-label">Writing language</label>
          <select v-model="draft.language" class="rf-input">
            <option v-for="l in WRITING_LANGUAGES" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>
        <div class="rf-form-group">
          <label class="rf-label">Citation style</label>
          <select v-model="draft.citation_style" class="rf-input">
            <option v-for="s in CITATION_STYLES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="rf-form-group" style="flex: 2;">
          <label class="rf-label">Keywords <span class="rf-optional">(comma separated)</span></label>
          <input v-model="draft.keywords" class="rf-input" placeholder="gesture recognition, rehabilitation, exergame" />
        </div>
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Draft research questions <span class="rf-optional">(optional)</span></label>
        <textarea v-model="draft.research_questions_draft" class="rf-input rf-textarea" rows="2"
          placeholder="If you already have questions in mind, put them here and the AI will refine them."></textarea>
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Anything else the AI should know <span class="rf-optional">(optional)</span></label>
        <textarea v-model="draft.notes" class="rf-input rf-textarea" rows="2"
          placeholder="Constraints, available data, required methods, supervisor preferences…"></textarea>
      </div>

      <label class="rf-checkbox">
        <input type="checkbox" v-model="draft.use_library" />
        <span>Use my saved research library as the source list ({{ librarySize }} papers)</span>
      </label>

      <div v-if="createError" class="rf-alert rf-alert-error">{{ createError }}</div>

      <div class="rf-form-actions">
        <button class="rf-btn rf-btn-primary rf-btn-lg" @click="create" :disabled="!draft.topic.trim() || creating">
          <RfIconAI /> {{ creating ? 'Generating your research plan…' : 'Create research and generate plan' }}
        </button>
        <p v-if="creating" class="rf-hint">
          The AI is writing the problem statement, research gap, questions, methodology and chapter
          outline. This usually takes 20–60 seconds.
        </p>
      </div>
    </div>

    <!-- ================= COMPARE TYPES ================= -->
    <div v-else-if="tab === 'types'" class="rf-section">
      <h2 class="rf-section-title"><RfIconBook /> Research Type Comparison</h2>
      <div class="rf-table-wrap">
        <table class="rf-compare-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th v-for="t in types" :key="t.key">{{ t.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in COMPARISON_ROWS" :key="row.field">
              <th scope="row">{{ row.label }}</th>
              <td v-for="t in types" :key="t.key">{{ (t as any)[row.field] }}</td>
            </tr>
            <tr>
              <th scope="row">Sections generated</th>
              <td v-for="t in types" :key="t.key">{{ t.section_count }}</td>
            </tr>
            <tr>
              <th scope="row">Target word count</th>
              <td v-for="t in types" :key="t.key">~{{ t.estimated_words.toLocaleString() }}</td>
            </tr>
            <tr>
              <th scope="row">Suggested references</th>
              <td v-for="t in types" :key="t.key">{{ t.reference_target }}+</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="toast" class="rf-toast" :class="`rf-toast-${toast.kind}`">{{ toast.text }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import { researchService } from '@/services/research.service';
import { notificationService } from '@/services/notification.service';
import type { AiResearchSummary, ResearchTypeInfo } from '@/services/research.service';
import {
  RfIconBack, RfIconAI, RfIconAdd, RfIconList, RfIconBook, RfIconEdit, RfIconDelete,
  RfIconDoc, RfIconDownload, RfIconTag, RfIconLibrary, RfIconTime, RfIconWarning,
} from '@/utils/rf-icons';

const router = useRouter();
const authStore = useAuthStore();
const researchStore = useResearchStore();

const WRITING_LANGUAGES = ['English', 'Arabic', 'French', 'German', 'Spanish', 'Turkish'];
const CITATION_STYLES = ['APA 7th edition', 'MLA 9th edition', 'Chicago 17th edition',
  'Harvard', 'IEEE', 'Vancouver'];

const COMPARISON_ROWS = [
  { field: 'goal', label: 'Primary goal' },
  { field: 'page_range', label: 'Length' },
  { field: 'originality', label: 'Originality' },
  { field: 'literature_review', label: 'Literature review' },
  { field: 'methodology', label: 'Methodology' },
  { field: 'theory', label: 'Theory' },
  { field: 'discussion', label: 'Discussion' },
  { field: 'abstract_words', label: 'Abstract length (words)' },
];

const tab = ref<'mine' | 'new' | 'types'>('mine');
const loading = ref(true);
const creating = ref(false);
const createError = ref('');
const exportingId = ref('');
const typesLoaded = ref(false);
const aiAvailable = ref(true);

const researches = ref<AiResearchSummary[]>([]);
const types = ref<ResearchTypeInfo[]>([]);
const toast = ref<{ text: string; kind: 'ok' | 'err' } | null>(null);

const draft = reactive({
  research_type: 'master' as 'bachelor' | 'master' | 'phd',
  topic: '',
  title: '',
  field: '',
  author_name: '',
  university: '',
  department: '',
  degree_program: '',
  supervisor: '',
  submission_year: new Date().getFullYear(),
  language: 'English',
  citation_style: 'APA 7th edition',
  keywords: '',
  research_questions_draft: '',
  notes: '',
  use_library: true,
});

const selectedType = computed(() => types.value.find(t => t.key === draft.research_type) || null);
const librarySize = computed(() => researchStore.importedPapers.length);

const truncate = (text: string, n: number) => (text && text.length > n ? `${text.slice(0, n).trimEnd()}…` : (text || ''));
const statusLabel = (s: string) =>
  ({ draft: 'Plan ready', in_progress: 'In progress', completed: 'Completed' } as Record<string, string>)[s] || s;
const formatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
  toast.value = { text, kind };
  setTimeout(() => { toast.value = null; }, 4500);
};

const load = async () => {
  const userId = authStore.user?.id;
  if (!userId) return;
  loading.value = true;
  try {
    const [list, typeList] = await Promise.all([
      researchService.getAiResearches(userId),
      researchService.getResearchTypes(userId).catch(() => [] as ResearchTypeInfo[]),
    ]);
    researches.value = list;
    types.value = typeList;
    typesLoaded.value = true;
    if (list.length === 0) tab.value = 'new';
    // Populate the title page defaults from the researcher profile.
    const profile = researchStore.researcherProfile;
    if (profile) {
      draft.author_name = draft.author_name || `${profile.first_name} ${profile.last_name}`.trim();
      draft.university = draft.university || profile.university || profile.institution || '';
      draft.department = draft.department || profile.department || '';
    }
    if (!researchStore.importedPapers.length) {
      researchStore.loadImportedPapers(userId).catch(() => { /* library is optional here */ });
    }
  } catch (err: any) {
    showToast(err?.message || 'Could not load your researches.', 'err');
  } finally {
    loading.value = false;
  }
};

const create = async () => {
  const userId = authStore.user?.id;
  if (!userId || !draft.topic.trim()) return;
  creating.value = true;
  createError.value = '';
  try {
    const sources = draft.use_library
      ? researchStore.importedPapers.filter(p => !p.is_local_project)
      : [];
    const created = await researchService.createAiResearch(userId, {
      research_type: draft.research_type,
      topic: draft.topic.trim(),
      title: draft.title.trim() || undefined,
      field: draft.field,
      author_name: draft.author_name,
      university: draft.university,
      department: draft.department,
      degree_program: draft.degree_program,
      supervisor: draft.supervisor,
      submission_year: draft.submission_year,
      language: draft.language,
      citation_style: draft.citation_style,
      keywords: draft.keywords,
      research_questions_draft: draft.research_questions_draft,
      notes: draft.notes,
      sources,
    });
    // A durable pointer back to it. Generating a thesis draft is minutes of
    // work the user is expected to walk away from, and the id is not something
    // anybody remembers — this is the way back in.
    notificationService.notify('research.ai_draft_ready', {
      to: authStore.user?.username || '',
      params: { title: draft.title.trim() || draft.topic.trim(), draftId: created.id },
    });
    router.push(`/research/ai-writer/${created.id}`);
  } catch (err: any) {
    createError.value = err?.message || 'Could not create the research. Try again.';
  } finally {
    creating.value = false;
  }
};

const remove = async (item: AiResearchSummary) => {
  if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
  const userId = authStore.user?.id;
  if (!userId) return;
  try {
    await researchService.deleteAiResearch(userId, item.id);
    researches.value = researches.value.filter(r => r.id !== item.id);
    showToast('Research deleted.');
  } catch (err: any) {
    showToast(err?.message || 'Could not delete the research.', 'err');
  }
};

const exportResearch = async (item: AiResearchSummary, format: 'docx' | 'pdf') => {
  const userId = authStore.user?.id;
  if (!userId) return;
  exportingId.value = item.id;
  try {
    await researchService.exportAiResearch(userId, item.id, format, item.title);
    showToast(`${format.toUpperCase()} downloaded.`);
  } catch (err: any) {
    showToast(err?.message || `Could not export the ${format.toUpperCase()}.`, 'err');
  } finally {
    exportingId.value = '';
  }
};

onMounted(load);
</script>

<style src="@/assets/css/research-flow.css"></style>
