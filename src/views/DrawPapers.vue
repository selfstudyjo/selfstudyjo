<template>
  <div class="papers">
    <header class="page-head">
      <div>
        <h1>{{ $t('Drawing papers') }}</h1>
        <p>
          {{ $t('A shared whiteboard for lessons, diagrams and working through a problem. Papers are private until you share them — free with your account, no subscription needed.') }}
        </p>
      </div>
      <button class="btn primary" :disabled="creating" @click="showCreate = true">
        <span>＋</span> {{ $t('New paper') }}
      </button>
    </header>

    <div v-if="error" class="banner error">
      {{ error }}
      <button class="link" @click="load">{{ $t('Try again') }}</button>
    </div>

    <div v-if="loading" class="grid">
      <div v-for="n in 4" :key="n" class="card skeleton" />
    </div>

    <template v-else>
      <!-- Mine -->
      <section>
        <div class="section-head">
          <h2>{{ $t('My papers') }}</h2>
          <span class="count">{{ mine.length }}</span>
        </div>

        <div v-if="!mine.length" class="empty">
          <p><strong>{{ $t('No papers yet.') }}</strong></p>
          <p>{{ $t('Open a blank paper and start drawing — pen, shapes, text and sticky notes.') }}</p>
          <button class="btn primary" @click="showCreate = true">{{ $t('Create your first paper') }}</button>
        </div>

        <div v-else class="grid">
          <article v-for="paper in mine" :key="paper.paper_id" class="card"
                   @click="open(paper)">
            <div class="preview" :class="`bg-${paper.background}`">
              <img v-if="thumbnails[paper.paper_id]" :src="thumbnails[paper.paper_id]" alt="">
              <span v-else class="preview-empty">{{ paper.element_count ? 'Loading…' : 'Blank' }}</span>
            </div>
            <div class="card-body">
              <h3>{{ paper.title }}</h3>
              <p class="meta">
                {{ $t('{v0} item{v1} · edited {v2}', { v0: paper.element_count || 0, v1: paper.element_count === 1 ? '' : 's', v2: ago(paper.last_edited_at) }) }}
              </p>
              <div class="tags">
                <span v-if="paper.share_count" class="tag">
                  {{ $t('Shared with {v0}', { v0: paper.share_count }) }}
                </span>
                <span v-if="paper.link_access !== 'none'" class="tag link-tag">
                  {{ $t('Link: {v0}', { v0: paper.link_access === 'write' ? 'can edit' : 'can view' }) }}
                </span>
                <span v-if="!paper.share_count && paper.link_access === 'none'"
                      class="tag quiet">{{ $t('Private') }}</span>
              </div>
            </div>
            <div class="card-actions" @click.stop>
              <button class="icon" :title="$t('Duplicate')" @click="duplicate(paper)">⧉</button>
              <button class="icon danger" :title="$t('Delete')" @click="confirmDelete = paper">🗑</button>
            </div>
          </article>
        </div>
      </section>

      <!-- Shared with me -->
      <section v-if="shared.length">
        <div class="section-head">
          <h2>{{ $t('Shared with me') }}</h2>
          <span class="count">{{ shared.length }}</span>
        </div>
        <div class="grid">
          <article v-for="paper in shared" :key="paper.paper_id" class="card"
                   @click="open(paper)">
            <div class="preview" :class="`bg-${paper.background}`">
              <img v-if="thumbnails[paper.paper_id]" :src="thumbnails[paper.paper_id]" alt="">
              <span v-else class="preview-empty">{{ $t('Blank') }}</span>
            </div>
            <div class="card-body">
              <h3>{{ paper.title }}</h3>
              <p class="meta">
                {{ $t('{v0} · edited {v1}', { v0: paper.owner_username || 'Someone', v1: ago(paper.last_edited_at) }) }}
              </p>
              <div class="tags">
                <span class="tag" :class="paper.my_permission === 'write' ? 'edit-tag' : 'view-tag'">
                  {{ paper.my_permission === 'write' ? 'You can edit' : 'View only' }}
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>

    <!-- Create -->
    <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
      <form class="dialog" @submit.prevent="create">
        <h2>{{ $t('New paper') }}</h2>

        <label class="field">
          <span>{{ $t('Title') }}</span>
          <input v-model="draft.title" class="input" type="text" maxlength="200"
                 :placeholder="$t('Algebra — week 3')" autofocus>
        </label>

        <label class="field">
          <span>{{ $t('Paper') }}</span>
          <div class="chips">
            <button v-for="option in BACKGROUNDS" :key="option.value" type="button"
                    class="chip" :class="{ active: draft.background === option.value }"
                    @click="draft.background = option.value">
              {{ option.label }}
            </button>
          </div>
        </label>

        <label class="field">
          <span>{{ $t('Size') }}</span>
          <div class="chips">
            <button v-for="option in SIZES" :key="option.label" type="button"
                    class="chip" :class="{ active: draft.width === option.width }"
                    @click="draft.width = option.width; draft.height = option.height">
              {{ option.label }}
            </button>
          </div>
        </label>

        <p v-if="createError" class="inline-error">{{ createError }}</p>

        <footer>
          <button type="button" class="btn ghost" @click="showCreate = false">{{ $t('Cancel') }}</button>
          <button type="submit" class="btn primary" :disabled="creating">
            {{ creating ? 'Creating…' : 'Create and open' }}
          </button>
        </footer>
      </form>
    </div>

    <!-- Delete -->
    <div v-if="confirmDelete" class="overlay" @click.self="confirmDelete = null">
      <div class="dialog">
        <h2>{{ $t('Delete “{v0}”?', { v0: confirmDelete.title }) }}</h2>
        <p class="dialog-text">
          {{ $t('This removes the paper and everything drawn on it, for everyone it is shared with. It cannot be undone.') }}
        </p>
        <footer>
          <button class="btn ghost" @click="confirmDelete = null">{{ $t('Keep it') }}</button>
          <button class="btn danger" :disabled="busy" @click="destroy">
            {{ busy ? 'Deleting…' : 'Delete paper' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The papers dashboard: what I own, what has been shared with me.
 *
 * Thumbnails are fetched **after** the list, one paper at a time, and only for the
 * papers that have one. The list endpoint deliberately omits them — a PNG data URL
 * is tens of kilobytes and forty of them inline is a multi-megabyte response for a
 * page that shows a grid of cards. Fetching them separately means the grid appears
 * immediately and fills in.
 */
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { drawService, type DrawPaper, type PaperBackground } from '@/services/draw.service';

const router = useRouter();
const authStore = useAuthStore();

const mine = ref<DrawPaper[]>([]);
const shared = ref<DrawPaper[]>([]);
const thumbnails = reactive<Record<string, string>>({});
const loading = ref(true);
const creating = ref(false);
const busy = ref(false);
const error = ref('');
const createError = ref('');
const showCreate = ref(false);
const confirmDelete = ref<DrawPaper | null>(null);

const BACKGROUNDS: { value: PaperBackground; label: string }[] = [
    { value: 'grid', label: 'Grid' },
    { value: 'blank', label: 'Blank' },
    { value: 'lined', label: 'Lined' },
    { value: 'dots', label: 'Dots' },
    { value: 'graph', label: 'Graph' },
    { value: 'music', label: 'Music' },
    { value: 'isometric', label: 'Isometric' },
];

const SIZES = [
    { label: 'Standard (1920×1080)', width: 1920, height: 1080 },
    { label: 'Wide (2560×1440)', width: 2560, height: 1440 },
    { label: 'Portrait (1240×1754)', width: 1240, height: 1754 },
    { label: 'Large board (3200×1800)', width: 3200, height: 1800 },
];

const draft = reactive({
    title: '',
    background: 'grid' as PaperBackground,
    width: 1920,
    height: 1080,
});

const userId = () => authStore.user?.id || '';
const username = () => authStore.user?.username || '';

onMounted(load);

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const [owned, withMe] = await Promise.all([
            drawService.listPapers(userId()),
            drawService.listSharedWithMe(userId()),
        ]);
        // The combined endpoint returns owned *and* shared; the shared list is
        // fetched separately so the two sections are independent. Filtering here
        // rather than asking for owned-only keeps it to two requests.
        const sharedIds = new Set(withMe.results.map(p => p.paper_id));
        mine.value = owned.results.filter(p => !sharedIds.has(p.paper_id));
        shared.value = withMe.results;
        loadThumbnails([...mine.value, ...shared.value]);
    } catch (err: any) {
        error.value = err?.message || 'Could not load your papers.';
    } finally {
        loading.value = false;
    }
}

/** Sequential rather than parallel: a replica answering forty concurrent requests
 *  for the same user is how one page load looks like an attack, and the cards fill
 *  in fast enough that nobody notices the difference. */
async function loadThumbnails(papers: DrawPaper[]) {
    for (const paper of papers) {
        if (!paper.has_thumbnail || thumbnails[paper.paper_id]) continue;
        try {
            const full = await drawService.getPaper(userId(), paper.paper_id, username());
            if (full.thumbnail) thumbnails[paper.paper_id] = full.thumbnail;
        } catch {
            // A missing preview is a card with a placeholder, not an error worth
            // showing — the paper still opens.
        }
    }
}

async function create() {
    creating.value = true;
    createError.value = '';
    try {
        const paper = await drawService.createPaper(userId(), username(), {
            title: draft.title.trim() || 'Untitled paper',
            background: draft.background,
            width: draft.width,
            height: draft.height,
        });
        showCreate.value = false;
        router.push({ name: 'DrawBoard', params: { id: paper.paper_id } });
    } catch (err: any) {
        createError.value = err?.message || 'Could not create the paper.';
    } finally {
        creating.value = false;
    }
}

function open(paper: DrawPaper) {
    router.push({ name: 'DrawBoard', params: { id: paper.paper_id } });
}

async function duplicate(paper: DrawPaper) {
    busy.value = true;
    try {
        const copy = await drawService.duplicatePaper(userId(), username(),
                                                     paper.paper_id);
        mine.value = [copy, ...mine.value];
    } catch (err: any) {
        error.value = err?.message || 'Could not duplicate the paper.';
    } finally {
        busy.value = false;
    }
}

async function destroy() {
    const paper = confirmDelete.value;
    if (!paper) return;
    busy.value = true;
    try {
        await drawService.deletePaper(userId(), paper.paper_id);
        mine.value = mine.value.filter(p => p.paper_id !== paper.paper_id);
        confirmDelete.value = null;
    } catch (err: any) {
        error.value = err?.message || 'Could not delete the paper.';
    } finally {
        busy.value = false;
    }
}

function ago(stamp?: string): string {
    if (!stamp) return 'never';
    const seconds = (Date.now() - new Date(stamp).getTime()) / 1000;
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ago`;
    return new Date(stamp).toLocaleDateString();
}
</script>

<style scoped>
.papers { padding: 24px 28px 48px; max-width: 1400px; margin: 0 auto; }

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 26px;
}

h1 { margin: 0 0 6px; font-size: 1.6rem; color: var(--sfs-text, #0f172a); }
.page-head p { margin: 0; max-width: 62ch; color: var(--sfs-accent-text, #64748b); font-size: 0.9rem; line-height: 1.55; }

section { margin-bottom: 34px; }

.section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
h2 { margin: 0; font-size: 1.05rem; color: var(--sfs-text, #1e293b); }

.count {
  padding: 1px 9px;
  border-radius: 999px;
  background: var(--sfs-paper-2, #e2e8f0);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--sfs-accent-on-paper, #475569);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
  gap: 18px;
}

.card {
  position: relative;
  border: 1px solid rgb(var(--sfs-sink-rgb, 15 23 42) / 0.08);
  border-radius: 13px;
  background: var(--sfs-paper, #fff);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.16s, box-shadow 0.16s, border-color 0.16s;
}

.card:hover {
  transform: translateY(-3px);
  border-color: rgb(var(--sfs-accent-rgb, 37 99 235) / 0.35);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.13);
}

.card.skeleton { height: 216px; background: linear-gradient(100deg, var(--sfs-paper, #f1f5f9) 30%, var(--sfs-paper-2, #e2e8f0) 50%, var(--sfs-paper, #f1f5f9) 70%); background-size: 220% 100%; animation: shimmer 1.3s infinite; cursor: default; }
@keyframes shimmer { to { background-position: -220% 0; } }

.preview {
  position: relative;
  display: grid;
  place-items: center;
  height: 132px;
  background: var(--sfs-paper, #f8fafc);
  border-bottom: 1px solid rgb(var(--sfs-sink-rgb, 15 23 42) / 0.06);
  overflow: hidden;
}

.preview img { width: 100%; height: 100%; object-fit: cover; object-position: top; }

.preview-empty { font-size: 0.78rem; font-weight: 600; color: var(--sfs-accent-text, #94a3b8); }

/* The card preview hints at the paper's ruling even before its thumbnail loads, so
   a grid of blank papers is not a grid of identical grey rectangles. */
.bg-grid { background-image: linear-gradient(rgb(var(--sfs-accent-rgb, 37 99 235) / 0.09) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--sfs-accent-rgb, 37 99 235) / 0.09) 1px, transparent 1px); background-size: 18px 18px; }
.bg-graph { background-image: linear-gradient(rgb(var(--sfs-accent-rgb, 37 99 235) / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--sfs-accent-rgb, 37 99 235) / 0.08) 1px, transparent 1px); background-size: 8px 8px; }
.bg-lined { background-image: linear-gradient(rgb(var(--sfs-accent-rgb, 37 99 235) / 0.11) 1px, transparent 1px); background-size: 100% 18px; }
.bg-dots { background-image: radial-gradient(rgb(var(--sfs-accent-rgb, 37 99 235) / 0.25) 1.2px, transparent 1.2px); background-size: 18px 18px; }

.card-body { padding: 12px 14px 14px; }
h3 { margin: 0 0 4px; font-size: 0.95rem; color: var(--sfs-text, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { margin: 0 0 9px; font-size: 0.76rem; color: var(--sfs-accent-text, #64748b); }

.tags { display: flex; flex-wrap: wrap; gap: 5px; }

.tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgb(var(--sfs-accent-rgb, 37 99 235) / 0.1);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--sfs-accent-text, #1d4ed8);
}

.tag.quiet { background: var(--sfs-paper, #f1f5f9); color: var(--sfs-accent-on-paper, #64748b); }
.tag.link-tag { background: rgb(var(--sfs-warning-rgb, 217 119 6) / 0.12); color: var(--sfs-warning-text, #92400e); }
.tag.edit-tag { background: rgb(var(--sfs-success-rgb, 22 163 74) / 0.12); color: var(--sfs-success-text, #15803d); }
.tag.view-tag { background: rgb(var(--sfs-accent-rgb, 100 116 139) / 0.14); color: var(--sfs-accent-text, #475569); }

.card-actions {
  position: absolute;
  top: 9px;
  right: 9px;
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.15s;
}

.card:hover .card-actions { opacity: 1; }

.icon {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 7px;
  background: rgb(var(--sfs-surface-rgb, 15 23 42) / 0.72);
  color: var(--sfs-text, #fff);
  font-size: 0.86rem;
  cursor: pointer;
}
.icon:hover { background: rgb(var(--sfs-surface-rgb, 15 23 42) / 0.9); }
.icon.danger:hover { background: var(--sfs-danger, #dc2626);   /* Its own ink. The base rule this shares with the other variants can only
     hold one `color`, and that one belongs to whichever variant came first —
     so an amber or green button inherited the ink meant for the indigo one.
     A fill decides its own ink. */
  color: var(--sfs-on-danger, #fff);
}

.empty {
  padding: 34px 26px;
  border: 1px dashed rgb(var(--sfs-accent-rgb, 37 99 235) / 0.3);
  border-radius: 13px;
  background: rgb(var(--sfs-accent-rgb, 37 99 235) / 0.03);
  text-align: center;
}
.empty p { margin: 0 0 6px; color: var(--sfs-accent-text, #64748b); font-size: 0.88rem; }
.empty .btn { margin-top: 12px; }

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 0.86rem;
}
.banner.error { background: var(--sfs-paper, #fef2f2); border: 1px solid var(--sfs-danger-wash, #fecaca); color: var(--sfs-danger-on-paper, #b91c1c); }

.link { border: none; background: none; color: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border: none;
  border-radius: 9px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}
.btn.primary { background: var(--sfs-accent, #2563eb); color: var(--sfs-on-accent, #fff); }
.btn.primary:hover:not(:disabled) { background: var(--sfs-accent, #1d4ed8); }
.btn.ghost { background: var(--sfs-paper, #f1f5f9); color: var(--sfs-accent-on-paper, #334155); }
.btn.danger { background: var(--sfs-danger, #dc2626); color: var(--sfs-on-danger, #fff); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(var(--sfs-surface-rgb, 15 23 42) / 0.55);
  backdrop-filter: blur(3px);
}

.dialog {
  width: min(520px, 100%);
  padding: 22px 24px 18px;
  border-radius: 15px;
  background: var(--sfs-paper, #fff);
  box-shadow: 0 26px 64px rgba(15, 23, 42, 0.34);
}
.dialog h2 { margin: 0 0 16px; font-size: 1.1rem; }
.dialog-text { margin: 0 0 4px; color: var(--sfs-accent-text, #64748b); font-size: 0.88rem; line-height: 1.55; }

.field { display: block; margin-bottom: 15px; }
.field > span { display: block; margin-bottom: 6px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sfs-accent-text, #64748b); }

.input {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--sfs-border-strong, #cbd5e1);
  border-radius: 9px;
  font-size: 0.9rem;
}
.input:focus { outline: 2px solid rgb(var(--sfs-accent-rgb, 37 99 235) / 0.35); border-color: var(--sfs-accent, #2563eb); }

.chips { display: flex; flex-wrap: wrap; gap: 6px; }

.chip {
  padding: 6px 12px;
  border: 1px solid var(--sfs-paper-border, #cbd5e1);
  border-radius: 999px;
  background: var(--sfs-paper, #fff);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--sfs-accent-on-paper, #475569);
  cursor: pointer;
}
.chip:hover { border-color: var(--sfs-accent-wash, #94a3b8); }
.chip.active { background: var(--sfs-accent, #2563eb); border-color: var(--sfs-accent, #1d4ed8); color: var(--sfs-on-accent, #fff); }

.inline-error { margin: 0 0 10px; font-size: 0.82rem; color: var(--sfs-danger-text, #b91c1c); }

footer { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; }

@media (max-width: 640px) {
  .papers { padding: 18px 16px 40px; }
  .card-actions { opacity: 1; }
}
</style>
