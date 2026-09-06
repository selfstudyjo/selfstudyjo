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
              <span v-else class="preview-empty">
                {{ paper.element_count ? $t('Loading…') : $t('Blank') }}
              </span>
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
                  {{ paper.link_access === 'write'
                    ? $t('Link: can edit') : $t('Link: can view') }}
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
              <span v-else class="preview-empty">
                {{ paper.element_count ? $t('Loading…') : $t('Blank') }}
              </span>
            </div>
            <div class="card-body">
              <h3>{{ paper.title }}</h3>
              <p class="meta">
                {{ $t('{v0} · edited {v1}', { v0: paper.owner_username || 'Someone', v1: ago(paper.last_edited_at) }) }}
              </p>
              <div class="tags">
                <span class="tag" :class="paper.my_permission === 'write' ? 'edit-tag' : 'view-tag'">
                  {{ paper.my_permission === 'write'
                    ? $t('You can edit') : $t('View only') }}
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
import { d, rel, t } from '@/i18n/runtime';

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

/**
 * When a paper was last edited, in the reader's own language.
 *
 * `rel()` and `d()` - `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` -
 * rather than the hand-rolled English ladder this was: `${n} h ago` is never
 * translated, and inside Arabic prose the bidi algorithm then reorders the
 * neutral runs so the digit detaches from its unit. What a reader actually saw
 * on this page was `h ago 1`, and `8/29/2026` for anything over a week old
 * because `toLocaleDateString()` with no locale uses the BROWSER's rather than
 * the app's.
 *
 * Exactly the fault `Courses.vue` had and was corrected for; it is written down
 * in CLAUDE.md, and this page had its own copy of it. Found by rendering the
 * page in Arabic at 390px, which is the only way it could have been.
 */
function ago(stamp?: string): string {
    if (!stamp) return t('never');
    const at = new Date(stamp).getTime();
    if (!Number.isFinite(at)) return t('never');
    // A week, after which "38 days ago" stops being the useful answer and the
    // date itself starts being one. `rel()` would happily say "2 months ago";
    // for a document somebody is looking for, the date is what they remember.
    return Date.now() - at < 604800_000 ? rel(at) : d(at);
}
</script>

<style scoped>
/*
  THE SURFACES HERE FOLLOW THE THEME, and that is the whole of the 2026-09-06
  rework. See the note at the top of `tools/.../draw_papers_css.py` in the
  commit: every surface on this page used to be `--sfs-paper`, the always-light
  "printed page" token, and every ink on top of it `--sfs-text`, which is WHITE
  in the seven dark galaxies. So the card titles were white on white - reported
  as "the title does not appear" - and the page rendered identically in all ten
  galaxies, which is the "themes not applied" half of the same report.

  THE RULE THIS FILE NOW FOLLOWS: a fill and its ink are chosen together.

    chrome  -> --sfs-glass-1/2/3 + --sfs-text / --sfs-text-muted
    paper   -> --sfs-paper       + --sfs-on-paper / --sfs-on-paper-muted
    a fill  -> --sfs-accent      + --sfs-on-accent

  `--sfs-paper` survives in exactly one place: the preview thumbnail, which is
  a picture of a sheet of paper and is white in every theme for the same reason
  a certificate is.
*/
.papers {
  padding: clamp(1rem, 2.4vw, 1.75rem) clamp(1rem, 3vw, 1.75rem) 3rem;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--sfs-text, #f8fafc);
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  flex-wrap: wrap;
  margin-bottom: 1.6rem;
}

h1 {
  margin: 0 0 0.35rem;
  font-size: clamp(1.35rem, 3vw, 1.7rem);
  font-weight: var(--sfs-weight-bold, 700);
  color: var(--sfs-text, #f8fafc);
  /* `none` in the three light galaxies. A 28px accent haze around near-black
     letters on a pale page reads as a printing fault. */
  text-shadow: var(--sfs-title-glow, none);
}

.page-head p {
  margin: 0;
  max-width: 62ch;
  color: var(--sfs-text-muted, #94a3b8);
  font-size: 0.9rem;
  line-height: var(--sfs-leading-relaxed, 1.6);
}

section { margin-bottom: 2.1rem; }

.section-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.85rem;
}

h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: var(--sfs-weight-semibold, 600);
  color: var(--sfs-text, #f8fafc);
}

.count {
  padding: 0.1rem 0.55rem;
  border-radius: var(--sfs-radius-pill, 999px);
  background: var(--sfs-glass-3, rgb(255 255 255 / 0.12));
  border: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  font-size: 0.72rem;
  font-weight: var(--sfs-weight-bold, 700);
  font-variant-numeric: tabular-nums;
  color: var(--sfs-text-muted, #94a3b8);
  /* A bare count is bidi-neutral, so inside Arabic prose the algorithm is free
     to move it away from the heading it belongs to. */
  unicode-bidi: isolate;
}

/*
  `minmax(min(100%, 248px), 1fr)` and never `minmax(248px, 1fr)`.

  A `1fr` track's automatic minimum is `min-content`, not zero, so at 320px a
  248px floor overflows the page rather than shrinking - which is exactly the
  32 declarations the exam screens had to be corrected for (working rule 50).
*/
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 248px), 1fr));
  gap: 1.1rem;
}

.card {
  position: relative;
  min-width: 0;
  border: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  border-radius: var(--sfs-radius-lg, 18px);
  background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));
  -webkit-backdrop-filter: var(--sfs-blur, blur(10px));
  backdrop-filter: var(--sfs-blur, blur(10px));
  box-shadow: var(--sfs-sheen, inset 0 1px 0 rgb(255 255 255 / 0.14)),
              var(--sfs-elev-1, 0 4px 12px rgb(0 0 0 / 0.1));
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--sfs-dur-fast, 0.16s) var(--sfs-ease, ease),
              background-color var(--sfs-dur-fast, 0.16s) var(--sfs-ease, ease),
              border-color var(--sfs-dur-fast, 0.16s) var(--sfs-ease, ease);
}

/*
  No `backdrop-filter` support (Firefox before 103, and anything with it
  disabled): an 8% wash over a gradient is not a card. Same one-step-more-opaque
  fallback `theme.css` gives `.glass-effect`.
*/
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .card { background: var(--sfs-glass-3, rgb(255 255 255 / 0.12)); }
}

/* The lift is `transform` only and only where there IS a pointer. Animating a
   shadow's blur radius forces a paint on every frame. */
.card:hover,
.card:focus-within {
  background: var(--sfs-glass-hover, rgb(255 255 255 / 0.14));
  border-color: var(--sfs-border-accent, rgb(102 126 234 / 0.4));
}

@media (hover: hover) and (pointer: fine) {
  .card:hover { transform: translateY(-2px); }
}

.card.skeleton {
  height: 216px;
  background:
    linear-gradient(100deg,
      var(--sfs-glass-1, rgb(255 255 255 / 0.05)) 30%,
      var(--sfs-glass-3, rgb(255 255 255 / 0.12)) 50%,
      var(--sfs-glass-1, rgb(255 255 255 / 0.05)) 70%);
  background-size: 220% 100%;
  animation: shimmer 1.3s infinite;
  cursor: default;
}

@keyframes shimmer { to { background-position: -220% 0; } }

/*
  THE ONE PAPER SURFACE ON THE PAGE, and it keeps its own dark ink.

  This is a picture of a sheet of paper - the ruling shows through it, and the
  thumbnail drawn on it is dark ink on white. It is white in all ten galaxies
  for the same reason a certificate is, and `--sfs-on-paper-muted` is the ink
  derived against it rather than against the page.
*/
.preview {
  position: relative;
  display: grid;
  place-items: center;
  height: 132px;
  background: var(--sfs-paper, #fff);
  border-bottom: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  overflow: hidden;
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.preview-empty {
  font-size: 0.78rem;
  font-weight: var(--sfs-weight-semibold, 600);
  color: var(--sfs-on-paper-muted, #64748b);
}

/* The card preview hints at the paper's ruling even before its thumbnail loads,
   so a grid of blank papers is not a grid of identical rectangles. The ruling
   is drawn in the ACCENT so it follows the galaxy, at an alpha low enough to
   read as printed rule rather than as a coloured pattern - and against
   `--sfs-paper`, which is light everywhere, so one alpha works in all ten. */
.bg-grid {
  background-image:
    linear-gradient(rgb(var(--sfs-accent-rgb, 37 99 235) / 0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgb(var(--sfs-accent-rgb, 37 99 235) / 0.14) 1px, transparent 1px);
  background-size: 18px 18px;
}

.bg-graph {
  background-image:
    linear-gradient(rgb(var(--sfs-accent-rgb, 37 99 235) / 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgb(var(--sfs-accent-rgb, 37 99 235) / 0.12) 1px, transparent 1px);
  background-size: 8px 8px;
}

.bg-lined {
  background-image:
    linear-gradient(rgb(var(--sfs-accent-rgb, 37 99 235) / 0.16) 1px, transparent 1px);
  background-size: 100% 18px;
}

.bg-dots {
  background-image:
    radial-gradient(rgb(var(--sfs-accent-rgb, 37 99 235) / 0.3) 1.2px, transparent 1.2px);
  background-size: 18px 18px;
}

.card-body { padding: 0.75rem 0.9rem 0.9rem; }

/*
  THE TITLE, and the reason this file was rewritten.

  `--sfs-text` on `--sfs-glass-2` is the pair `themes.ts` derives together and
  measures: the ink is contrast-checked against the tint composited over the
  galaxy, in all ten. On `--sfs-paper` - which is what this rule used to sit on
  - the same ink is white on white in the seven dark galaxies, and the title
  did not appear at all.

  `text-wrap: balance` and TWO LINES rather than an ellipsis on one: a paper is
  identified by its name and nothing else on the card, so truncating "Lecture 4
  - normalisation worked examples" to "Lecture 4 - normal..." makes two papers
  indistinguishable. `-webkit-line-clamp` bounds it at two so a long title
  cannot push the metadata out of the card.
*/
h3 {
  margin: 0 0 0.3rem;
  font-size: 0.95rem;
  font-weight: var(--sfs-weight-semibold, 600);
  line-height: var(--sfs-leading-snug, 1.35);
  color: var(--sfs-text, #f8fafc);
  text-wrap: balance;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* A title is somebody's own text, in whichever language they typed it, so
     the direction is read out of the string rather than imposed. */
  unicode-bidi: plaintext;
}

.meta {
  margin: 0 0 0.55rem;
  font-size: 0.76rem;
  color: var(--sfs-text-muted, #94a3b8);
  /* An item count and a relative date beside each other are bidi-neutral runs;
     isolated, Arabic cannot reorder them into "edited 3 items ago". */
  unicode-bidi: isolate;
}

.tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }

.tag {
  padding: 0.1rem 0.5rem;
  border-radius: var(--sfs-radius-pill, 999px);
  font-size: 0.7rem;
  font-weight: var(--sfs-weight-semibold, 600);
  /* Every variant below sets its own fill AND its own ink. A shared `color`
     here is how an amber tag ended up wearing the indigo one's ink. */
/*
  A PALE TINTED ISLAND TAKES ITS OWN DARK INK, and this pair was wrong first.

  `--sfs-accent-wash` is LIGHT in all ten galaxies - it is the "a hint of the
  accent behind a chip" surface - while `--sfs-accent-text` is the accent ink
  derived against a plain GLASS card, i.e. a pale lavender in a dark galaxy.
  Together they measured 2.59:1, which `audit:contrast` reported the moment it
  was run. `--sfs-accent-on-paper` is the ink `themes.ts` derives against the
  wash, dark in every galaxy, and it is what the platform's own warning and
  error washes already use.
*/
  background: var(--sfs-accent-wash, rgb(102 126 234 / 0.16));
  color: var(--sfs-accent-on-paper, #1d4ed8);
  unicode-bidi: isolate;
}

.tag.quiet {
  background: var(--sfs-glass-3, rgb(255 255 255 / 0.12));
  color: var(--sfs-text-muted, #94a3b8);
}

.tag.link-tag {
  background: rgb(var(--sfs-warning-rgb, 217 119 6) / 0.16);
  color: var(--sfs-warning-text, #fcd34d);
}

.tag.edit-tag {
  background: rgb(var(--sfs-success-rgb, 22 163 74) / 0.16);
  color: var(--sfs-success-text, #6ee7b7);
}

.tag.view-tag {
  background: var(--sfs-glass-3, rgb(255 255 255 / 0.12));
  color: var(--sfs-text-muted, #94a3b8);
}

.card-actions {
  position: absolute;
  top: 0.55rem;
  /* PHYSICAL, deliberately. The card is `position: relative` and these buttons
     sit over the PREVIEW, which does not mirror - it is a picture. Flipping
     them to `inset-inline-end` would put them over the thumbnail's own
     top-left corner in Arabic, which is where a drawing usually starts. */
  right: 0.55rem;
  display: flex;
  gap: 0.3rem;
  /* Visible whenever the card is hovered OR keyboard-focused. Opacity alone
     left them unreachable by tab: an invisible button is still in the tab
     order, so a keyboard user was focusing controls they could not see. */
  opacity: 0;
  transition: opacity var(--sfs-dur-fast, 0.15s) var(--sfs-ease, ease);
}

.card:hover .card-actions,
.card:focus-within .card-actions { opacity: 1; }

.icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  border-radius: var(--sfs-radius-sm, 8px);
  /* THE SCRIM TOKEN, not the shadow one. `--sfs-overlay` is dark in all ten
     galaxies and carries a derived ink; `--sfs-shade-rgb` is `0 0 0`
     everywhere, which is right for a shadow and a mid-grey slab when spent as
     a surface on a pale page (working rule 48). */
  background: var(--sfs-overlay, rgb(15 23 42 / 0.72));
  color: var(--sfs-on-overlay, #f8fafc);
  font-size: 0.86rem;
  line-height: 1;
  cursor: pointer;
}

.icon:hover { border-color: var(--sfs-border-strong, rgb(255 255 255 / 0.24)); }

.icon.danger:hover {
  background: var(--sfs-danger, #dc2626);
  /* Its own ink. A fill decides its own ink; the base rule can only hold one
     `color`, and that one belongs to the scrim. */
  color: var(--sfs-on-danger, #fff);
  border-color: var(--sfs-danger, #dc2626);
}

.empty {
  padding: 2rem 1.6rem;
  border: 1px dashed var(--sfs-border-accent, rgb(102 126 234 / 0.4));
  border-radius: var(--sfs-radius-lg, 18px);
  background: var(--sfs-glass-1, rgb(255 255 255 / 0.05));
  text-align: center;
}

.empty p {
  margin: 0 0 0.4rem;
  color: var(--sfs-text-muted, #94a3b8);
  font-size: 0.88rem;
}

.empty .btn { margin-top: 0.75rem; }

.banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.1rem;
  padding: 0.7rem 0.9rem;
  border-radius: var(--sfs-radius, 14px);
  font-size: 0.86rem;
}

/*
  A WASH AND ITS OWN INK. `--sfs-danger-wash` is light in every galaxy and is
  paired with `--sfs-danger-on-paper`, which is dark in every galaxy - the pair
  `themes.ts` derives together for exactly this "pale tinted island" case.
  `--sfs-danger-text` is the ink for a GLASS card and would be a light red on a
  pale red wash.
*/
.banner.error {
  background: var(--sfs-danger-wash, rgb(220 38 38 / 0.14));
  border: 1px solid rgb(var(--sfs-danger-rgb, 220 38 38) / 0.4);
  color: var(--sfs-danger-on-paper, #b91c1c);
}

.link {
  border: none;
  background: none;
  color: inherit;
  font-weight: var(--sfs-weight-bold, 700);
  text-decoration: underline;
  cursor: pointer;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  /* 44px on a coarse pointer, and `max()` rather than a bare rem because
     `responsive.css` scales the ROOT: at a 390px viewport 2.75rem measures
     41.5px, which is under the minimum on exactly the devices the rule is for. */
  min-height: max(2.4rem, 40px);
  border: 1px solid transparent;
  border-radius: var(--sfs-radius, 14px);
  font-size: 0.88rem;
  font-weight: var(--sfs-weight-semibold, 600);
  cursor: pointer;
  transition: background-color var(--sfs-dur-fast, 0.16s) var(--sfs-ease, ease),
              border-color var(--sfs-dur-fast, 0.16s) var(--sfs-ease, ease);
}

.btn.primary {
  background: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #fff);
}

.btn.primary:hover:not(:disabled) { background: var(--sfs-accent-strong, #5568d3); }

.btn.ghost {
  background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));
  border-color: var(--sfs-border, rgb(255 255 255 / 0.14));
  color: var(--sfs-text, #f8fafc);
}

.btn.ghost:hover:not(:disabled) { background: var(--sfs-glass-hover, rgb(255 255 255 / 0.14)); }

.btn.danger {
  background: var(--sfs-danger, #dc2626);
  color: var(--sfs-on-danger, #fff);
}

.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: var(--sfs-overlay, rgb(15 23 42 / 0.55));
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

/*
  THE DIALOG IS A PANEL, NOT A SHEET OF PAPER.

  `--sfs-surface-2` is the theme's own raised surface with `--sfs-text` as its
  measured ink, so the dialog is dark in a dark galaxy and light in a light one
  - which is what makes it read as being in FRONT of the scrim. On
  `--sfs-paper` it was a white card in all ten themes with white ink on it,
  i.e. the same fault as the card titles.
*/
.dialog {
  width: min(520px, 100%);
  max-height: calc(100vh - 2.5rem);
  overflow-y: auto;
  padding: 1.4rem 1.5rem 1.1rem;
  border: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  border-radius: var(--sfs-radius-xl, 22px);
  background: var(--sfs-surface-2, #1a2036);
  color: var(--sfs-text, #f8fafc);
  box-shadow: var(--sfs-elev-3, 0 26px 64px rgb(0 0 0 / 0.34));
}

.dialog h2 { margin: 0 0 1rem; font-size: 1.1rem; }

.dialog-text {
  margin: 0 0 0.25rem;
  color: var(--sfs-text-muted, #94a3b8);
  font-size: 0.88rem;
  line-height: var(--sfs-leading-relaxed, 1.6);
}

.field { display: block; margin-bottom: 0.95rem; }

.field > span {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.72rem;
  font-weight: var(--sfs-weight-bold, 700);
  text-transform: uppercase;
  letter-spacing: var(--sfs-tracking-caps, 0.05em);
  color: var(--sfs-text-muted, #94a3b8);
}

/*
  A FIELD IS ITS OWN PAIR. `--sfs-field` / `--sfs-field-text` are derived
  together so a control is legible against its own background whatever the
  galaxy - and this is the pair the board's title input was already using,
  which is the only reason that title became visible when it was clicked.
*/
.input {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--sfs-field-border, rgb(255 255 255 / 0.2));
  border-radius: var(--sfs-radius-sm, 8px);
  background: var(--sfs-field, rgb(255 255 255 / 0.06));
  color: var(--sfs-field-text, #f8fafc);
  /* 16px minimum on a touch device: below it iOS zooms the page on focus and
     never zooms back, and the fix is the font size rather than a viewport
     that takes pinch-zoom away from everybody. */
  font-size: 0.9rem;
  font-family: inherit;
}

.input::placeholder { color: var(--sfs-placeholder, rgb(255 255 255 / 0.4)); }

.input:focus {
  outline: var(--sfs-ring-width, 2px) solid var(--sfs-focus, rgb(102 126 234 / 0.6));
  outline-offset: var(--sfs-ring-offset, 2px);
  border-color: var(--sfs-accent, #667eea);
}

@media (pointer: coarse) {
  .input { font-size: 16px; }
  .btn { min-height: 44px; }
  .icon { width: 34px; height: 34px; }
}

.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }

.chip {
  padding: 0.4rem 0.75rem;
  min-height: max(2rem, 34px);
  border: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  border-radius: var(--sfs-radius-pill, 999px);
  background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));
  font-size: 0.8rem;
  font-weight: var(--sfs-weight-semibold, 600);
  color: var(--sfs-text, #f8fafc);
  cursor: pointer;
}

.chip:hover { border-color: var(--sfs-border-strong, rgb(255 255 255 / 0.24)); }

.chip.active {
  background: var(--sfs-accent, #667eea);
  border-color: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #fff);
}

.inline-error {
  margin: 0 0 0.6rem;
  font-size: 0.82rem;
  color: var(--sfs-danger-text, #fca5a5);
}

footer { display: flex; justify-content: flex-end; gap: 0.55rem; margin-top: 1.1rem; }

@media (max-width: 640px) {
  /* The action buttons are permanently visible on a touch device: there is no
     hover to reveal them with. */
  .card-actions { opacity: 1; }
  footer { flex-wrap: wrap; }
  footer .btn { flex: 1 1 auto; }
}
</style>
