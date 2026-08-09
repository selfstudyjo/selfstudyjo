<template>
  <div class="cvb">
    <!-- ═══ Header ═══ -->
    <header class="cvb-header">
      <div class="cvb-header-left">
        <div class="cvb-header-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm2 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
        </div>
        <div>
          <h1>CV Builder</h1>
          <p>Import, dictate, tailor and download a professional CV — every version saved to your account.</p>
        </div>
      </div>
      <div class="cvb-header-actions">
        <button class="btn btn-primary" :disabled="creating" @click="createBlank">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          {{ creating ? 'Creating…' : 'New blank CV' }}
        </button>
      </div>
    </header>

    <!-- ═══ Service problems worth stating plainly ═══ -->
    <div v-if="serviceWarning" class="cvb-banner warn">
      <strong>Heads up:</strong> {{ serviceWarning }}
    </div>
    <div v-if="error" class="cvb-banner error">
      {{ error }}
      <button class="banner-retry" @click="reload">Retry</button>
    </div>

    <!-- ═══ Stats ═══ -->
    <section v-if="dashboard" class="cvb-stats">
      <div class="stat">
        <span class="stat-value">{{ dashboard.stats.total }}</span>
        <span class="stat-label">CVs</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ dashboard.stats.tailored }}</span>
        <span class="stat-label">Tailored to a job</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ dashboard.stats.average_completeness }}%</span>
        <span class="stat-label">Average completeness</span>
      </div>
      <div class="stat">
        <span class="stat-value">
          {{ dashboard.stats.best_match_score !== null ? dashboard.stats.best_match_score + '%' : '—' }}
        </span>
        <span class="stat-label">Best job match</span>
      </div>
    </section>

    <!-- ═══ Creation paths ═══ -->
    <section class="cvb-paths">
      <!-- Upload -->
      <article class="path-card" :class="{ busy: uploading }">
        <div class="path-icon upload">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
        </div>
        <h3>Upload your current CV</h3>
        <p>PDF or DOCX. The AI reads it, pulls out every role, date and skill, and hands you an
           editable CV you can then enhance.</p>

        <label class="path-drop" :class="{ dragging }"
               @dragover.prevent="dragging = true"
               @dragleave.prevent="dragging = false"
               @drop.prevent="onDrop">
          <input ref="fileInput" type="file" accept=".pdf,.docx,.txt" @change="onFilePicked" />
          <span v-if="!uploading">
            <strong>Choose a file</strong> or drop it here
            <em>PDF, DOCX or TXT · up to 12 MB</em>
          </span>
          <span v-else class="path-progress">
            <span class="spinner"></span>
            {{ uploadStage }}
          </span>
        </label>

        <p v-if="uploadError" class="path-error">{{ uploadError }}</p>
        <details v-if="uploadText" class="path-details">
          <summary>See the text we read from your file ({{ uploadText.split(/\s+/).length }} words)</summary>
          <pre>{{ uploadText.slice(0, 4000) }}</pre>
        </details>
      </article>

      <!-- Voice -->
      <article class="path-card">
        <div class="path-icon voice">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/>
          </svg>
        </div>
        <h3>Build it by talking</h3>
        <p>No CV to start from? Describe your experience out loud for a minute or two and the AI
           writes the whole thing. Add a photo and pick a template afterwards.</p>

        <button v-if="!showVoice" class="btn btn-secondary" @click="showVoice = true">
          Start the voice builder
        </button>

        <div v-else class="path-voice">
          <CvVoiceRecorder
            v-model="voiceTranscript"
            :notes-value="voiceNotes"
            :user-id="userId"
            @update:notes="voiceNotes = $event"
          />
          <div class="path-voice-actions">
            <button class="btn btn-primary" :disabled="buildingVoice || voiceTranscript.trim().length < 60"
                    @click="buildFromVoice">
              {{ buildingVoice ? 'Writing your CV…' : 'Build my CV' }}
            </button>
            <button class="btn btn-ghost" @click="showVoice = false">Cancel</button>
            <span v-if="voiceTranscript.trim().length < 60" class="path-note">
              Keep going — about 60 characters of speech is the minimum.
            </span>
          </div>
          <p v-if="voiceError" class="path-error">{{ voiceError }}</p>
        </div>
      </article>

      <!-- Paste -->
      <article class="path-card">
        <div class="path-icon paste">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0S9.6.84 9.18 2H5a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2V4a2 2 0 00-2-2zm-7 0a1 1 0 110 2 1 1 0 010-2zm7 18H5V4h2v3h10V4h2v16z"/></svg>
        </div>
        <h3>Paste text instead</h3>
        <p>Already have your history written down — in an email, a LinkedIn export, a note? Paste
           it and the AI structures it the same way.</p>

        <button v-if="!showPaste" class="btn btn-secondary" @click="showPaste = true">Paste CV text</button>
        <div v-else class="path-paste">
          <textarea v-model="pasteText" rows="7"
                    placeholder="Paste your CV or career history here…"></textarea>
          <div class="path-voice-actions">
            <button class="btn btn-primary" :disabled="parsing || pasteText.trim().length < 120"
                    @click="parsePasted">
              {{ parsing ? 'Reading it…' : 'Build from this text' }}
            </button>
            <button class="btn btn-ghost" @click="showPaste = false">Cancel</button>
          </div>
          <p v-if="pasteError" class="path-error">{{ pasteError }}</p>
        </div>
      </article>
    </section>

    <!-- ═══ My CVs ═══ -->
    <section class="cvb-list">
      <div class="list-head">
        <h2>My CVs <span v-if="cvs.length" class="count">{{ cvs.length }}</span></h2>
        <div class="list-tools">
          <input v-model="search" type="search" placeholder="Search by title, name or role…" />
          <button class="btn btn-ghost" :disabled="loading" @click="reload">
            {{ loading ? 'Loading…' : 'Refresh' }}
          </button>
        </div>
      </div>

      <div v-if="loading && !cvs.length" class="list-empty">Loading your CVs…</div>

      <div v-else-if="!cvs.length" class="list-empty">
        <p>You have no CVs yet. Upload one, dictate one, or start from blank — all three end up in
           the same editor.</p>
      </div>

      <div v-else class="cv-grid">
        <article v-for="cv in filteredCvs" :key="cv.id" class="cv-card">
          <div class="cv-card-top" :style="{ background: cv.accent_color || accentFor(cv.template) }">
            <span class="cv-card-template">{{ templateName(cv.template) }}</span>
            <span v-if="cv.tailored_to_job" class="cv-card-badge">
              Tailored{{ cv.match_score !== null ? ` · ${cv.match_score}%` : '' }}
            </span>
          </div>

          <div class="cv-card-body">
            <h3 :title="cv.title">{{ cv.title }}</h3>
            <p class="cv-card-name">{{ cv.full_name || 'No name yet' }}</p>
            <p v-if="cv.headline" class="cv-card-headline">{{ cv.headline }}</p>

            <div class="cv-card-meter" :title="`${cv.completeness}% complete`">
              <div class="cv-card-meter-fill" :style="{ width: cv.completeness + '%' }"></div>
            </div>
            <p class="cv-card-stats">
              {{ cv.completeness }}% complete · {{ cv.experience_count }} role{{ cv.experience_count === 1 ? '' : 's' }}
              · {{ cv.skill_count }} skill{{ cv.skill_count === 1 ? '' : 's' }} · {{ cv.words }} words
            </p>
            <p class="cv-card-updated">
              {{ sourceLabel(cv.source) }} · updated {{ formatDate(cv.updated_at) }}
            </p>
          </div>

          <div class="cv-card-actions">
            <button class="btn btn-primary btn-sm" @click="open(cv.id)">Open</button>
            <button class="btn btn-ghost btn-sm" :disabled="downloadingId === cv.id"
                    @click="download(cv, 'pdf')">
              {{ downloadingId === cv.id ? '…' : 'PDF' }}
            </button>
            <button class="btn btn-ghost btn-sm" :disabled="downloadingId === cv.id"
                    @click="download(cv, 'docx')">DOCX</button>
            <button class="btn btn-ghost btn-sm" @click="duplicate(cv)">Copy</button>
            <button class="btn btn-danger btn-sm" @click="confirmDelete(cv)">Delete</button>
          </div>
        </article>
      </div>
    </section>

    <!-- ═══ Templates gallery ═══ -->
    <section v-if="templates.length" class="cvb-templates">
      <h2>Templates</h2>
      <p class="section-sub">Every template renders identically in PDF and DOCX. You can switch
         template on any CV at any time — it never changes your content.</p>
      <div class="tpl-grid">
        <article v-for="tpl in templates" :key="tpl.key" class="tpl-card">
          <div class="tpl-thumb" :class="`tpl-${tpl.layout}`" :style="{ '--tpl-accent': tpl.accent }">
            <span class="tpl-band"></span>
            <span class="tpl-line l1"></span>
            <span class="tpl-line l2"></span>
            <span class="tpl-line l3"></span>
          </div>
          <h4>{{ tpl.name }}</h4>
          <p>{{ tpl.description }}</p>
          <span class="tpl-tag" :class="{ safe: tpl.ats_safe }">
            {{ tpl.ats_safe ? 'ATS-safe' : 'Design-forward' }}
          </span>
          <span class="tpl-best">{{ tpl.best_for }}</span>
        </article>
      </div>
    </section>

    <!-- ═══ Delete confirm ═══ -->
    <div v-if="pendingDelete" class="modal-backdrop" @click.self="pendingDelete = null">
      <div class="modal">
        <h3>Delete this CV?</h3>
        <p>“{{ pendingDelete.title }}” will be removed from your CV Builder. This cannot be undone
           from here.</p>
        <div class="modal-actions">
          <button class="btn btn-danger" :disabled="deleting" @click="doDelete">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
          <button class="btn btn-ghost" @click="pendingDelete = null">Cancel</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="toast" :class="toastType">{{ toast }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import CvVoiceRecorder from '@/components/cvbuilder/CvVoiceRecorder.vue';
import {
  cvBuilderService,
  type CvDashboard, type CvSummary, type CvTemplate, type ExportFormat,
} from '@/services/cvbuilder.service';

const router = useRouter();
const authStore = useAuthStore();
const userId = computed(() => String(authStore.user?.id || ''));

const loading = ref(false);
const creating = ref(false);
const error = ref('');
const serviceWarning = ref('');
const dashboard = ref<CvDashboard | null>(null);
const cvs = ref<CvSummary[]>([]);
const templates = ref<CvTemplate[]>([]);
const search = ref('');

const fileInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const uploading = ref(false);
const uploadStage = ref('');
const uploadError = ref('');
const uploadText = ref('');

const showVoice = ref(false);
const voiceTranscript = ref('');
const voiceNotes = ref('');
const buildingVoice = ref(false);
const voiceError = ref('');

const showPaste = ref(false);
const pasteText = ref('');
const parsing = ref(false);
const pasteError = ref('');

const downloadingId = ref('');
const pendingDelete = ref<CvSummary | null>(null);
const deleting = ref(false);
const toast = ref('');
const toastType = ref<'success' | 'error'>('success');

const filteredCvs = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return cvs.value;
  return cvs.value.filter(cv =>
    [cv.title, cv.full_name, cv.headline, cv.email]
      .some(value => (value || '').toLowerCase().includes(query)));
});

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = message;
  toastType.value = type;
  window.setTimeout(() => { toast.value = ''; }, 4200);
}

function formatDate(value?: string) {
  if (!value) return 'never';
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString();
}

function sourceLabel(source: string) {
  return ({ upload: 'Imported from a file', voice: 'Built by voice',
            paste: 'Built from pasted text', manual: 'Written here' } as any)[source] || 'Written here';
}

function templateName(key: string) {
  return templates.value.find(t => t.key === key)?.name || key;
}

function accentFor(key: string) {
  return templates.value.find(t => t.key === key)?.accent || '#4F46E5';
}

async function reload() {
  if (!userId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const data = await cvBuilderService.getDashboard(userId.value);
    dashboard.value = data;
    cvs.value = data.cvs || [];
  } catch (e: any) {
    // A replica that lost its GitHub token answers 503 with the reason - show it
    // rather than a generic failure, because the fix is an operator's, not the user's.
    error.value = e?.message || 'The CV Builder could not be reached.';
    cvBuilderService.resetReplica();
  } finally {
    loading.value = false;
  }
}

async function loadCatalogue() {
  if (!userId.value) return;
  try {
    const catalogue = await cvBuilderService.getTemplates(userId.value);
    templates.value = catalogue.templates || [];
  } catch { /* the gallery is decoration; the rest of the page still works */ }

  try {
    const status = await cvBuilderService.aiStatus();
    if (!status.available) {
      serviceWarning.value = 'No AI provider is configured on the CV Builder service right now, '
        + 'so importing, enhancing and tailoring will not work. Editing and downloading still do.';
    } else if (!status.transcription) {
      serviceWarning.value = 'Speech to text is unavailable on the CV Builder service right now, '
        + 'so the voice builder cannot transcribe. You can still type into its transcript box.';
    }
  } catch { /* status is advisory */ }
}

function open(cvId: string) {
  router.push({ name: 'CvBuilderEditor', params: { id: cvId } });
}

async function createBlank() {
  creating.value = true;
  try {
    const cv = await cvBuilderService.createCv(userId.value, { title: 'My CV' });
    open(cv.id);
  } catch (e: any) {
    showToast(e?.message || 'The CV could not be created.', 'error');
  } finally {
    creating.value = false;
  }
}

// ── Upload ────────────────────────────────────────────────────────────
function onFilePicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) void handleUpload(file);
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) void handleUpload(file);
}

async function handleUpload(file: File) {
  uploadError.value = '';
  uploadText.value = '';
  uploading.value = true;
  uploadStage.value = `Reading ${file.name}…`;

  try {
    uploadStage.value = 'Extracting the text, then asking the AI to structure it…';
    const result = await cvBuilderService.uploadCv(userId.value, file, { create: true });
    uploadText.value = result.text || '';
    if (result.cv?.id) {
      showToast('CV imported. Check the details — an import is a starting point, not gospel.');
      open(result.cv.id);
      return;
    }
    uploadError.value = result.error || 'That file could not be turned into a CV.';
  } catch (e: any) {
    uploadError.value = e?.message || 'The upload failed.';
  } finally {
    uploading.value = false;
    uploadStage.value = '';
    if (fileInput.value) fileInput.value.value = '';
  }
}

// ── Voice ─────────────────────────────────────────────────────────────
async function buildFromVoice() {
  voiceError.value = '';
  buildingVoice.value = true;
  try {
    const result = await cvBuilderService.buildFromVoice(userId.value, {
      transcript: voiceTranscript.value,
      notes: voiceNotes.value,
    });
    showToast('Your CV is written. Add a photo and pick a template next.');
    open(result.cv.id);
  } catch (e: any) {
    voiceError.value = e?.message || 'The CV could not be built from that recording.';
  } finally {
    buildingVoice.value = false;
  }
}

// ── Paste ─────────────────────────────────────────────────────────────
async function parsePasted() {
  pasteError.value = '';
  parsing.value = true;
  try {
    const result = await cvBuilderService.parseText(userId.value, pasteText.value, { save: true });
    showToast('CV created from your text.');
    open(result.cv.id);
  } catch (e: any) {
    pasteError.value = e?.message || 'That text could not be structured.';
  } finally {
    parsing.value = false;
  }
}

// ── Card actions ──────────────────────────────────────────────────────
async function download(cv: CvSummary, format: ExportFormat) {
  downloadingId.value = cv.id;
  try {
    const { blob, filename } = await cvBuilderService.download(userId.value, cv.id, format);
    cvBuilderService.saveBlob(blob, filename);
  } catch (e: any) {
    showToast(e?.message || `The ${format.toUpperCase()} could not be built.`, 'error');
  } finally {
    downloadingId.value = '';
  }
}

async function duplicate(cv: CvSummary) {
  try {
    await cvBuilderService.duplicateCv(userId.value, cv.id);
    showToast('Copy created.');
    await reload();
  } catch (e: any) {
    showToast(e?.message || 'The CV could not be copied.', 'error');
  }
}

function confirmDelete(cv: CvSummary) {
  pendingDelete.value = cv;
}

async function doDelete() {
  if (!pendingDelete.value) return;
  deleting.value = true;
  try {
    await cvBuilderService.deleteCv(userId.value, pendingDelete.value.id);
    showToast('CV deleted.');
    pendingDelete.value = null;
    await reload();
  } catch (e: any) {
    showToast(e?.message || 'The CV could not be deleted.', 'error');
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  await reload();
  await loadCatalogue();
});
</script>

<style scoped>
.cvb { padding: 22px 26px 60px; max-width: 1400px; margin: 0 auto; color: var(--sfs-text, #fff); }

/* ── Header ─────────────────────────────────────────────────── */
.cvb-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 20px; flex-wrap: wrap; margin-bottom: 20px;
}
.cvb-header-left { display: flex; gap: 15px; align-items: flex-start; }
.cvb-header-icon {
  width: 52px; height: 52px; flex: 0 0 auto; border-radius: 14px;
  display: grid; place-items: center; color: var(--sfs-on-accent, #fff);
  background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #764ba2));
}
.cvb-header h1 { font-size: 1.7rem; font-weight: 700; line-height: 1.2; }
.cvb-header p { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.62); font-size: 0.92rem; margin-top: 3px; max-width: 620px; }

/* ── Buttons ────────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px;
  border: none; border-radius: 10px; font-size: 0.88rem; font-weight: 600;
  cursor: pointer; transition: transform 0.15s ease, filter 0.15s ease;
  font-family: inherit;
}
.btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-sm { padding: 7px 12px; font-size: 0.8rem; border-radius: 8px; }
.btn-primary { background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #764ba2)); color: var(--sfs-on-accent, #fff); }
.btn-secondary { background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.2); color: var(--sfs-text-muted, #c7d2fe); border: 1px solid rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45); }
.btn-ghost { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.07); color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.85); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14); }
.btn-danger { background: rgb(var(--sfs-danger-rgb, 239 68 68) / 0.18); color: var(--sfs-danger-text, #fca5a5); border: 1px solid rgb(var(--sfs-danger-rgb, 239 68 68) / 0.42); }

/* ── Banners ────────────────────────────────────────────────── */
.cvb-banner {
  padding: 12px 16px; border-radius: 10px; font-size: 0.88rem; margin-bottom: 16px;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.cvb-banner.warn { background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.12); border: 1px solid rgb(var(--sfs-warning-rgb, 245 158 11) / 0.35); color: var(--sfs-warning-text, #fcd34d); }
.cvb-banner.error { background: rgb(var(--sfs-danger-rgb, 239 68 68) / 0.12); border: 1px solid rgb(var(--sfs-danger-rgb, 239 68 68) / 0.35); color: var(--sfs-danger-text, #fca5a5); }
.banner-retry {
  margin-left: auto; background: transparent; border: 1px solid currentColor;
  color: inherit; padding: 4px 12px; border-radius: 7px; cursor: pointer; font-size: 0.8rem;
}

/* ── Stats ──────────────────────────────────────────────────── */
.cvb-stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px; margin-bottom: 24px;
}
.stat {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.045); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09);
  border-radius: 12px; padding: 14px 16px;
}
.stat-value { display: block; font-size: 1.6rem; font-weight: 700; line-height: 1.1; }
.stat-label { display: block; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.55); font-size: 0.78rem; margin-top: 3px; }

/* ── Creation paths ─────────────────────────────────────────── */
.cvb-paths {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px; margin-bottom: 32px; align-items: start;
}
.path-card {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.045); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09);
  border-radius: 14px; padding: 20px;
}
.path-icon {
  width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center;
  margin-bottom: 12px; color: var(--sfs-text, #fff);
}
.path-icon.upload { background: linear-gradient(135deg, var(--sfs-accent, #3b82f6), var(--sfs-accent, #6366f1)); }
.path-icon.voice { background: linear-gradient(135deg, var(--sfs-accent-2, #ec4899), var(--sfs-accent-2, #a855f7)); }
.path-icon.paste { background: linear-gradient(135deg, var(--sfs-info, #14b8a6), var(--sfs-info, #0ea5e9));   /* Its own ink. The base rule this shares with the other variants can only
     hold one `color`, and that one belongs to whichever variant came first —
     so an amber or green button inherited the ink meant for the indigo one.
     A fill decides its own ink. */
  color: var(--sfs-on-info, #fff);
}
.path-card h3 { font-size: 1.06rem; font-weight: 650; margin-bottom: 6px; }
.path-card p { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.6); font-size: 0.86rem; line-height: 1.55; margin-bottom: 14px; }

.path-drop {
  display: block; border: 1.5px dashed rgb(var(--sfs-line-rgb, 255 255 255) / 0.24); border-radius: 11px;
  padding: 22px 14px; text-align: center; cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.72); font-size: 0.86rem;
}
.path-drop:hover, .path-drop.dragging {
  border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.75); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.08);
}
.path-drop input { display: none; }
.path-drop strong { color: var(--sfs-text-muted, #c7d2fe); }
.path-drop em { display: block; font-size: 0.76rem; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.42); margin-top: 5px; font-style: normal; }

.path-progress { display: inline-flex; align-items: center; gap: 10px; }
.spinner {
  width: 15px; height: 15px; border: 2px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.25);
  border-top-color: var(--sfs-border-strong, #fff); border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.path-error { color: var(--sfs-danger-text, #fca5a5); font-size: 0.84rem; margin-top: 10px; line-height: 1.5; }
.path-note { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.45); font-size: 0.78rem; }

.path-details { margin-top: 12px; }
.path-details summary { cursor: pointer; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.6); font-size: 0.82rem; }
.path-details pre {
  margin-top: 8px; max-height: 220px; overflow: auto; background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.35);
  border-radius: 8px; padding: 10px; font-size: 0.74rem; white-space: pre-wrap;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.72);
}

.path-voice { margin-top: 4px; }
.path-voice-actions { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.path-paste textarea {
  width: 100%; background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.28); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  border-radius: 10px; color: var(--sfs-text, #fff); padding: 11px 13px; font-size: 0.88rem;
  font-family: inherit; line-height: 1.55; resize: vertical;
}
.path-paste textarea:focus { outline: none; border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.7); }

/* ── CV list ────────────────────────────────────────────────── */
.cvb-list { margin-bottom: 34px; }
.list-head {
  display: flex; justify-content: space-between; align-items: center;
  gap: 14px; flex-wrap: wrap; margin-bottom: 14px;
}
.list-head h2 { font-size: 1.24rem; font-weight: 650; }
.count {
  font-size: 0.78rem; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1); padding: 2px 9px;
  border-radius: 20px; margin-left: 7px; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.7);
}
.list-tools { display: flex; gap: 9px; align-items: center; }
.list-tools input {
  background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.28); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  border-radius: 9px; color: var(--sfs-text, #fff); padding: 9px 13px; font-size: 0.85rem;
  min-width: 250px; font-family: inherit;
}
.list-tools input:focus { outline: none; border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.7); }

.list-empty {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.035); border: 1px dashed rgb(var(--sfs-line-rgb, 255 255 255) / 0.13);
  border-radius: 12px; padding: 34px; text-align: center;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.55); font-size: 0.9rem;
}

.cv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(285px, 1fr)); gap: 14px; }
.cv-card {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09);
  border-radius: 13px; overflow: hidden; display: flex; flex-direction: column;
  transition: transform 0.18s ease, border-color 0.18s ease;
}
.cv-card:hover { transform: translateY(-2px); border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.42); }
.cv-card-top {
  height: 34px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; font-size: 0.72rem; color: var(--sfs-text, #fff);
}
.cv-card-template { font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
.cv-card-badge { background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.28); padding: 2px 8px; border-radius: 20px; }

.cv-card-body { padding: 14px 14px 10px; flex: 1; }
.cv-card-body h3 {
  font-size: 0.98rem; font-weight: 650; margin-bottom: 3px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cv-card-name { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.8); font-size: 0.86rem; }
.cv-card-headline { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.5); font-size: 0.8rem; margin-bottom: 10px; }

.cv-card-meter {
  height: 5px; border-radius: 3px; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1);
  overflow: hidden; margin: 10px 0 6px;
}
.cv-card-meter-fill { height: 100%; background: linear-gradient(90deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #a855f7)); }
.cv-card-stats { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.55); font-size: 0.76rem; line-height: 1.5; }
.cv-card-updated { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.38); font-size: 0.73rem; margin-top: 4px; }

.cv-card-actions {
  display: flex; gap: 6px; flex-wrap: wrap; padding: 11px 14px 14px;
  border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.07);
}

/* ── Templates ──────────────────────────────────────────────── */
.cvb-templates h2 { font-size: 1.24rem; font-weight: 650; margin-bottom: 4px; }
.section-sub { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.55); font-size: 0.86rem; margin-bottom: 15px; max-width: 700px; }
.tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.tpl-card {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.045); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09);
  border-radius: 12px; padding: 14px;
}
.tpl-thumb {
  position: relative; height: 96px; border-radius: 7px; background: var(--sfs-paper, #fff);
  overflow: hidden; margin-bottom: 11px;
}
.tpl-band { position: absolute; background: var(--tpl-accent); }
.tpl-banner .tpl-band { top: 0; left: 0; right: 0; height: 26px; }
.tpl-sidebar .tpl-band { top: 0; bottom: 0; left: 0; width: 34%; }
.tpl-single .tpl-band { top: 14px; left: 12px; width: 46%; height: 4px; border-radius: 2px; }
.tpl-line { position: absolute; height: 4px; border-radius: 2px; background: var(--sfs-paper-2, #d8dbe3); }
.tpl-banner .l1 { top: 38px; left: 12px; right: 12px; }
.tpl-banner .l2 { top: 50px; left: 12px; right: 40px; }
.tpl-banner .l3 { top: 62px; left: 12px; right: 26px; }
.tpl-sidebar .l1 { top: 20px; left: 40%; right: 10px; }
.tpl-sidebar .l2 { top: 32px; left: 40%; right: 26px; }
.tpl-sidebar .l3 { top: 44px; left: 40%; right: 16px; }
.tpl-single .l1 { top: 30px; left: 12px; right: 12px; }
.tpl-single .l2 { top: 42px; left: 12px; right: 32px; }
.tpl-single .l3 { top: 54px; left: 12px; right: 20px; }

.tpl-card h4 { font-size: 0.94rem; font-weight: 650; margin-bottom: 4px; }
.tpl-card p { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.55); font-size: 0.79rem; line-height: 1.5; margin-bottom: 9px; }
.tpl-tag {
  display: inline-block; font-size: 0.7rem; padding: 2px 8px; border-radius: 20px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.09); color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.65); margin-right: 6px;
}
.tpl-tag.safe { background: rgb(var(--sfs-success-rgb, 34 197 94) / 0.15); color: var(--sfs-success-text, #86efac); }
.tpl-best { font-size: 0.72rem; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.4); }

/* ── Modal & toast ──────────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0; background: rgb(var(--sfs-surface-rgb, 0 0 0) / 0.62); backdrop-filter: blur(3px);
  display: grid; place-items: center; z-index: 900; padding: 20px;
}
.modal {
  background: var(--sfs-surface-2, #131327); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12); border-radius: 14px;
  padding: 22px; max-width: 420px; width: 100%;
}
.modal h3 { font-size: 1.1rem; font-weight: 650; margin-bottom: 8px; }
.modal p { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.62); font-size: 0.88rem; line-height: 1.55; margin-bottom: 16px; }
.modal-actions { display: flex; gap: 9px; }

.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 12px 20px; border-radius: 10px; font-size: 0.88rem; z-index: 950;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.42); max-width: 90vw;
}
.toast.success { background: var(--sfs-success, #16a34a); color: var(--sfs-on-success, #fff); }
.toast.error { background: var(--sfs-danger, #dc2626); color: var(--sfs-on-danger, #fff); }

@media (max-width: 640px) {
  .cvb { padding: 16px 14px 50px; }
  .list-tools input { min-width: 0; flex: 1; }
}
</style>
