<template>
  <div class="board">
    <header class="board-head">
      <button class="back" :title="$t('Back to papers')" @click="leave">←</button>

      <div class="title-block">
        <input
          v-if="canAdminister"
          v-model="title"
          class="title-input"
          maxlength="200"
          :aria-label="$t('Paper title')"
          @blur="renameIfChanged"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        >
        <h1 v-else class="title-static">{{ paper?.title || 'Paper' }}</h1>
        <p class="byline">
          <template v-if="paper && !isOwner">{{ paper.owner_username || 'Someone' }} · </template>
          <span :class="saveClass">{{ saveLabel }}</span>
        </p>
      </div>

      <!-- Who is here. Real people, live, and the reason the paper feels shared. -->
      <div v-if="participants.length" class="people">
        <span
          v-for="person in participants.slice(0, 5)"
          :key="person.user_id"
          class="face"
          :style="paint(person.colour)"
          :title="`${person.username}${person.user_id === userId ? ' (you)' : ''}`"
        >{{ (person.username || '?').charAt(0).toUpperCase() }}</span>
        <span v-if="participants.length > 5" class="face more">
          +{{ participants.length - 5 }}
        </span>
      </div>

      <div class="head-actions">
        <span v-if="permission === 'read'" class="pill view">{{ $t('View only') }}</span>
        <span v-else-if="permission === 'write'" class="pill edit">{{ $t('Can edit') }}</span>

        <button v-if="canAdminister" class="btn ghost" @click="showShare = true">
          {{ $t('Share') }}<template v-if="paper?.share_count"> · {{ paper.share_count }}</template>
        </button>
        <button class="btn ghost" :title="$t('Save a copy to my papers')" @click="duplicate">
          {{ $t('Duplicate') }}
        </button>
      </div>
    </header>

    <DrawToolbar
      v-model="toolState"
      :zoom="zoom"
      :can-undo="undoStack.length > 0"
      :can-redo="redoStack.length > 0"
      :readonly="!canEdit"
      @undo="undo"
      @redo="redo"
      @clear="confirmClear = true"
      @fit="canvas?.fit()"
      @zoom-in="canvas?.zoomIn()"
      @zoom-out="canvas?.zoomOut()"
    />

    <div v-if="loading" class="state">{{ $t('Opening the paper…') }}</div>

    <div v-else-if="loadError" class="state error">
      <h2>{{ loadError }}</h2>
      <p v-if="denied">
        {{ $t('This paper is private, or it is no longer shared with you. Ask whoever owns it to share it again.') }}
      </p>
      <button class="btn primary" @click="$router.push({ name: 'DrawPapers' })">
        {{ $t('Back to my papers') }}
      </button>
    </div>

    <DrawCanvas
      v-else-if="paper"
      ref="canvas"
      :elements="elements"
      :tool-state="toolState"
      :width="paper.width"
      :height="paper.height"
      :background="paper.background"
      :canvas-color="paper.canvas_color"
      :readonly="!canEdit"
      :cursors="participants"
      :author-id="userId"
      :author-username="username"
      @commit="commit"
      @erase="erase"
      @update="applyLocal"
      @pointer="onPointer"
    />

    <p v-if="banner" class="banner">{{ banner }}</p>

    <DrawShareDialog
      v-if="showShare && paper"
      :paper="paper"
      :user-id="userId"
      :username="username"
      @close="showShare = false"
      @changed="onShareChanged"
    />

    <div v-if="confirmClear" class="overlay" @click.self="confirmClear = false">
      <div class="dialog">
        <h2>{{ $t('Clear this paper?') }}</h2>
        <p>{{ $t('Everything drawn on it will be erased, for everyone. Undo can bring it back while this tab stays open.') }}</p>
        <footer>
          <button class="btn ghost" @click="confirmClear = false">{{ $t('Cancel') }}</button>
          <button class="btn danger" @click="clearPage">{{ $t('Clear the paper') }}</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * One paper, open, and live.
 *
 * The interesting part of this file is the loop that keeps two people's canvases in
 * step, and every piece of it is answering a specific way this goes wrong.
 *
 * **Local first, then the network.** A gesture is applied to `elements` the instant
 * it finishes and queued for saving separately. Waiting for the server would put a
 * round trip between the pointer lifting and the ink appearing, which is the one
 * thing a drawing tool cannot do. The consequence is that the local scene is
 * authoritative for what this user just drew, and the server is authoritative for
 * everything else — which is exactly what `applyDelta` implements, keyed on the
 * element id the browser minted.
 *
 * **Saves are batched and never concurrent.** Strokes queue and flush on a short
 * timer, and `flushing` prevents a second flush overlapping the first. Two
 * overlapping saves of the same stroke are harmless on the backend (the write is
 * idempotent) and produce out-of-order `updated_at` values, which is how a stroke
 * ends up flickering between two versions of itself.
 *
 * **The live poll is adaptive.** Polling at a fixed fast rate keeps a replica busy
 * for a paper nobody is drawing on; polling slowly makes collaboration feel broken.
 * So it runs fast while anything is happening and backs off when the paper is idle,
 * and stops entirely when the tab is hidden — a backgrounded tab polling every
 * second for an hour is pure waste.
 *
 * **Undo is local to this tab, on purpose.** A shared undo stack would let one
 * person undo another's stroke, which is indistinguishable from data loss. Undo here
 * reverses *your* actions, which is what the word means to the person pressing it.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { paint } from '@/theme/contrast';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { ApiError } from '@/services/api';
import {
    drawService, type DrawPaper, type DrawPermission, type Participant,
} from '@/services/draw.service';
import DrawCanvas, { type ToolState } from '@/components/draw/DrawCanvas.vue';
import DrawToolbar from '@/components/draw/DrawToolbar.vue';
import DrawShareDialog from '@/components/draw/DrawShareDialog.vue';
import { applyDelta, type SceneElement } from '@/components/draw/drawEngine';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const paper = ref<DrawPaper | null>(null);
const elements = ref<SceneElement[]>([]);
const participants = ref<Participant[]>([]);
const permission = ref<DrawPermission>('read');
const title = ref('');
const loading = ref(true);
const loadError = ref('');
const denied = ref(false);
const banner = ref('');
const showShare = ref(false);
const confirmClear = ref(false);
const canvas = ref<InstanceType<typeof DrawCanvas> | null>(null);

const toolState = ref<ToolState>({
    tool: 'pen',
    stroke: '#111827',
    fill: 'transparent',
    width: 3,
    fontSize: 22,
    opacity: 1,
});

const userId = computed(() => authStore.user?.id || '');
const username = computed(() => authStore.user?.username || '');
const isOwner = computed(() => permission.value === 'owner');
const canEdit = computed(() => permission.value === 'owner' || permission.value === 'write');
const canAdminister = computed(() => permission.value === 'owner');
const zoom = computed(() => canvas.value?.scale ?? 1);

// --- history (this tab only) ---
type Action =
    | { kind: 'add'; elements: SceneElement[] }
    | { kind: 'erase'; elements: SceneElement[] };

const undoStack = ref<Action[]>([]);
const redoStack = ref<Action[]>([]);
const MAX_HISTORY = 60;

// --- save queue ---
const pending = new Map<string, SceneElement>();
const pendingErases = new Set<string>();
let saveTimer: number | undefined;
let flushing = false;
const saveState = ref<'saved' | 'saving' | 'dirty' | 'error'>('saved');

const SAVE_DEBOUNCE = 550;

// --- live loop ---
let liveTimer: number | undefined;
let cursor: { x: number; y: number } | null = null;
let cursorDirty = false;
let sinceMark = '';
let quietTicks = 0;

const LIVE_FAST = 1000;
const LIVE_SLOW = 4000;
/** Ticks with nothing happening before backing off. Twelve fast ticks is about ten
 *  seconds of an idle paper, which is short enough that nobody notices the slowdown
 *  and long enough to survive somebody pausing to think. */
const QUIET_BEFORE_SLOW = 12;

const saveLabel = computed(() => {
    if (!canEdit.value) return 'Read-only';
    switch (saveState.value) {
        case 'saving': return 'Saving…';
        case 'dirty': return 'Unsaved changes';
        case 'error': return 'Could not save — retrying';
        default: return 'All changes saved';
    }
});

const saveClass = computed(() => `save-${saveState.value}`);

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

onMounted(async () => {
    await open(String(route.params.id || ''));
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    stopLive();
    // Flush before going, so a stroke drawn a moment before navigating away is not
    // lost to the debounce timer.
    void flush(true);
    if (paper.value) void drawService.leave(userId.value, paper.value.paper_id);
});

watch(() => route.params.id, id => {
    if (id && paper.value && id !== paper.value.paper_id) open(String(id));
});

async function open(paperId: string) {
    loading.value = true;
    loadError.value = '';
    denied.value = false;
    try {
        const record = await drawService.getPaper(userId.value, paperId, username.value);
        paper.value = record;
        title.value = record.title;
        permission.value = record.my_permission || 'read';
        participants.value = record.participants || [];

        const scene = await drawService.getScene(userId.value, paperId, username.value);
        elements.value = scene.elements as SceneElement[];
        sinceMark = scene.at;
        permission.value = scene.my_permission || permission.value;
        startLive();
    } catch (err: any) {
        if (err instanceof ApiError && err.status === 404) {
            denied.value = true;
            loadError.value = 'This paper is not available to you.';
        } else if (err instanceof ApiError && err.status === 400) {
            loadError.value = 'You need to be signed in to open a paper.';
        } else {
            loadError.value = err?.message || 'Could not open the paper.';
        }
    } finally {
        loading.value = false;
    }
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/** A finished gesture: on the canvas now, queued for the server. */
function commit(incoming: SceneElement[]) {
    if (!canEdit.value) return;
    elements.value = applyDelta(elements.value, incoming);
    for (const element of incoming) pending.set(element.element_id, element);
    remember({ kind: 'add', elements: incoming });
    markDirty();
}

function erase(ids: string[]) {
    if (!canEdit.value || !ids.length) return;
    const removed = elements.value.filter(e => ids.includes(e.element_id));
    elements.value = elements.value.filter(e => !ids.includes(e.element_id));
    for (const id of ids) {
        pendingErases.add(id);
        // An element erased before its own save landed never needs to be sent at
        // all — sending it and then erasing it is two writes that both replicate.
        pending.delete(id);
    }
    if (removed.length) remember({ kind: 'erase', elements: removed });
    markDirty();
}

/** An in-progress change the canvas wants reflected but not yet saved — dragging an
 *  element, or the eraser sweeping over strokes before the pointer lifts. */
function applyLocal(incoming: SceneElement[]) {
    elements.value = applyDelta(elements.value, incoming);
}

function remember(action: Action) {
    undoStack.value = [...undoStack.value.slice(-(MAX_HISTORY - 1)), action];
    // A new action invalidates the redo branch. Keeping it would let redo replay
    // something that no longer makes sense against the current scene.
    redoStack.value = [];
}

function undo() {
    const action = undoStack.value.pop();
    if (!action || !canEdit.value) return;
    if (action.kind === 'add') {
        const ids = action.elements.map(e => e.element_id);
        elements.value = elements.value.filter(e => !ids.includes(e.element_id));
        for (const id of ids) { pendingErases.add(id); pending.delete(id); }
    } else {
        elements.value = applyDelta(elements.value, action.elements);
        for (const element of action.elements) {
            pending.set(element.element_id, element);
            pendingErases.delete(element.element_id);
        }
    }
    redoStack.value = [...redoStack.value, action];
    markDirty();
}

function redo() {
    const action = redoStack.value.pop();
    if (!action || !canEdit.value) return;
    if (action.kind === 'add') {
        elements.value = applyDelta(elements.value, action.elements);
        for (const element of action.elements) {
            pending.set(element.element_id, element);
            pendingErases.delete(element.element_id);
        }
    } else {
        const ids = action.elements.map(e => e.element_id);
        elements.value = elements.value.filter(e => !ids.includes(e.element_id));
        for (const id of ids) { pendingErases.add(id); pending.delete(id); }
    }
    undoStack.value = [...undoStack.value, action];
    markDirty();
}

async function clearPage() {
    confirmClear.value = false;
    if (!canEdit.value || !paper.value) return;
    const removed = [...elements.value];
    elements.value = [];
    remember({ kind: 'erase', elements: removed });
    try {
        await drawService.clearPage(userId.value, paper.value.paper_id);
        saveState.value = 'saved';
    } catch (err: any) {
        banner.value = err?.message || 'Could not clear the paper.';
        saveState.value = 'error';
    }
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

function markDirty() {
    saveState.value = 'dirty';
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void flush(), SAVE_DEBOUNCE);
}

/**
 * Send whatever is queued.
 *
 * `flushing` is a guard against two flushes overlapping, not an optimisation: the
 * backend write is idempotent, so a duplicate is harmless there, but two in-flight
 * saves of one stroke come back with different `updated_at` values and the live poll
 * then alternates between them, which shows up as a stroke flickering.
 *
 * On failure the batch goes back into the queue. A stroke is a person's work; losing
 * it because one request timed out is not acceptable, and the next tick retries.
 */
async function flush(final = false) {
    if (flushing || !paper.value || !canEdit.value) return;
    if (!pending.size && !pendingErases.size) {
        saveState.value = 'saved';
        return;
    }

    flushing = true;
    saveState.value = 'saving';
    const batch = [...pending.values()];
    const erases = [...pendingErases];
    pending.clear();
    pendingErases.clear();

    try {
        if (batch.length) {
            await drawService.saveElements(userId.value, username.value,
                                          paper.value.paper_id, batch as any);
        }
        if (erases.length) {
            await drawService.eraseElements(userId.value, paper.value.paper_id, erases);
        }
        saveState.value = pending.size || pendingErases.size ? 'dirty' : 'saved';
        banner.value = '';
        if (!final) void saveThumbnail();
    } catch (err: any) {
        for (const element of batch) {
            // Anything erased or re-drawn while this batch was in flight wins over
            // the version being retried.
            if (!pending.has(element.element_id) && !pendingErases.has(element.element_id)) {
                pending.set(element.element_id, element);
            }
        }
        for (const id of erases) if (!pending.has(id)) pendingErases.add(id);
        saveState.value = 'error';
        if (err instanceof ApiError && err.status === 403) {
            banner.value = 'Your access to this paper changed — you can no longer edit it.';
            permission.value = 'read';
            pending.clear();
            pendingErases.clear();
            saveState.value = 'saved';
        }
    } finally {
        flushing = false;
        if (!final && (pending.size || pendingErases.size)) markDirty();
    }
}

/** The card preview. Throttled hard — it is a full re-render plus a PNG encode plus
 *  an upload, and it only has to be roughly current. */
let thumbnailAt = 0;
async function saveThumbnail() {
    if (!paper.value || !canvas.value) return;
    if (Date.now() - thumbnailAt < 45_000) return;
    thumbnailAt = Date.now();
    const image = canvas.value.thumbnail(480);
    if (image) await drawService.saveThumbnail(userId.value, paper.value.paper_id, image);
}

async function renameIfChanged() {
    if (!paper.value || !canAdminister.value) return;
    const next = title.value.trim();
    if (!next || next === paper.value.title) {
        title.value = paper.value.title;
        return;
    }
    try {
        const updated = await drawService.updatePaper(userId.value,
                                                     paper.value.paper_id,
                                                     { title: next });
        paper.value = { ...paper.value, ...updated };
        title.value = updated.title;
    } catch (err: any) {
        banner.value = err?.message || 'Could not rename the paper.';
        title.value = paper.value.title;
    }
}

// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

function startLive() {
    stopLive();
    liveTimer = window.setTimeout(tick, LIVE_FAST);
}

function stopLive() {
    window.clearTimeout(liveTimer);
    liveTimer = undefined;
}

async function tick() {
    if (!paper.value || document.hidden) {
        // Rescheduled rather than stopped: a hidden tab should cost nothing but has
        // to come straight back when it is shown again.
        liveTimer = window.setTimeout(tick, LIVE_SLOW);
        return;
    }

    try {
        const poll = await drawService.syncCursor(userId.value, username.value,
                                                 paper.value.paper_id, {
            since: sinceMark,
            cursor: cursorDirty ? cursor : undefined,
            tool: toolState.value.tool,
        });
        cursorDirty = false;

        if (poll) {
            sinceMark = poll.at;
            participants.value = poll.participants || [];

            // Anything of this user's own that has not been saved yet is left alone:
            // the server's copy is older than what is on their screen, and letting it
            // win would make their own stroke jump back a version.
            const theirs = (poll.elements || []).filter(
                e => !pending.has(e.element_id) && !pendingErases.has(e.element_id));
            if (theirs.length) {
                elements.value = applyDelta(elements.value, theirs as SceneElement[]);
                quietTicks = 0;
            } else {
                quietTicks++;
            }

            if (poll.my_permission && poll.my_permission !== permission.value) {
                permission.value = poll.my_permission;
                banner.value = poll.my_permission === 'read'
                    ? 'This paper is now read-only for you.'
                    : '';
            }
        } else {
            quietTicks++;
        }
    } catch (err: any) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
            // Access was revoked while the paper was open. Stop polling and say so
            // rather than retrying against a paper that is no longer theirs.
            stopLive();
            banner.value = 'Your access to this paper was removed.';
            permission.value = 'read';
            return;
        }
        quietTicks++;
    }

    const busy = quietTicks < QUIET_BEFORE_SLOW || pending.size || pendingErases.size
        || participants.value.length > 1;
    liveTimer = window.setTimeout(tick, busy ? LIVE_FAST : LIVE_SLOW);
}

/** The pointer position, sampled rather than sent. The canvas fires this on every
 *  pointer move; the live tick sends whatever the latest value was, so a cursor
 *  costs one field on a request that was going to happen anyway. */
function onPointer(point: { x: number; y: number } | null) {
    cursor = point;
    cursorDirty = true;
}

function onVisibility() {
    if (!document.hidden && paper.value) {
        quietTicks = 0;
        stopLive();
        liveTimer = window.setTimeout(tick, 150);
    }
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        // Nothing needs saving on demand, but Ctrl-S is muscle memory and letting
        // the browser open a Save dialog over a drawing app is worse than a no-op.
        event.preventDefault();
        void flush();
        return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const shortcuts: Record<string, ToolState['tool']> = {
        v: 'select', p: 'pen', m: 'marker', h: 'highlighter', e: 'eraser',
        l: 'line', a: 'arrow', r: 'rect', o: 'ellipse', t: 'text', n: 'sticky',
    };
    const tool = shortcuts[event.key.toLowerCase()];
    if (tool) toolState.value = { ...toolState.value, tool };
}

function onShareChanged(patch: Partial<DrawPaper>) {
    if (paper.value) paper.value = { ...paper.value, ...patch };
}

async function duplicate() {
    if (!paper.value) return;
    try {
        const copy = await drawService.duplicatePaper(userId.value, username.value,
                                                     paper.value.paper_id);
        router.push({ name: 'DrawBoard', params: { id: copy.paper_id } });
    } catch (err: any) {
        banner.value = err?.message || 'Could not duplicate the paper.';
    }
}

async function leave() {
    await flush(true);
    router.push({ name: 'DrawPapers' });
}
</script>

<style scoped>
/*
  THE CHROME FOLLOWS THE THEME; ONLY THE CANVAS IS PAPER.

  Every surface in this header used to be `--sfs-paper`, which is light in all
  ten galaxies, with `--sfs-text` on top of it - white in the seven dark ones.
  That is the reported bug: the paper's title was white on white, and it became
  visible only when the owner clicked into it, because `:focus` was the one
  rule using a matched pair (`--sfs-field` / `--sfs-field-text`). A
  COLLABORATOR, who gets an `<h1>` rather than an `<input>`, had no focus state
  and so never saw the title at all.

  The rule now: chrome on `--sfs-glass-*` + `--sfs-text`, a fill with its own
  ink, and `--sfs-paper` reserved for the drawing surface itself - which is a
  sheet of paper and is white in every theme, exactly as a certificate is.
*/
.board {
  display: flex;
  flex-direction: column;
  /* `100dvh` alongside `100vh`: on iOS the small viewport unit is the only one
     that accounts for the browser chrome, and a board an inch taller than the
     screen puts its toolbar off the bottom. */
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  color: var(--sfs-text, #f8fafc);
}

.board-head {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.6rem 1rem;
  background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));
  -webkit-backdrop-filter: var(--sfs-blur, blur(10px));
  backdrop-filter: var(--sfs-blur, blur(10px));
  border-bottom: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  /* A header over a canvas needs to read as being IN FRONT of it, and a sheen
     is what does that without a shadow that would darken the drawing. */
  box-shadow: var(--sfs-sheen, inset 0 1px 0 rgb(255 255 255 / 0.14));
  /* The toolbar and the canvas scroll; the header does not. */
  flex: 0 0 auto;
  z-index: 2;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .board-head { background: var(--sfs-glass-3, rgb(255 255 255 / 0.12)); }
}

.back {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  border-radius: var(--sfs-radius-sm, 8px);
  background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));
  font-size: 1rem;
  line-height: 1;
  color: var(--sfs-text, #f8fafc);
  cursor: pointer;
}

.back:hover {
  background: var(--sfs-glass-hover, rgb(255 255 255 / 0.14));
  border-color: var(--sfs-border-strong, rgb(255 255 255 / 0.24));
}

/* THE BACK ARROW IS A DIRECTION, so it mirrors with the page. `.sfs-flip` is
   the opt-in hook `rtl.css` offers for exactly this, and it is opt-in because
   most icons on this platform are a bell or a camera and mirroring those is a
   wrongness nobody can name. */
[dir='rtl'] .back { transform: scaleX(-1); }

.title-block { min-width: 0; flex: 1; }

/*
  THE TITLE. `--sfs-text` over `--sfs-glass-2` is the pair `themes.ts` derives
  and measures together, in all ten galaxies - which is the whole fix. It also
  gets a visible affordance now: the owner's input carries a hairline at rest,
  because a title that looks like plain text and is secretly editable is a
  control nobody finds, and the collaborator's `<h1>` deliberately does not.
*/
.title-input,
.title-static {
  display: block;
  width: 100%;
  max-width: 420px;
  margin: 0;
  padding: 0.2rem 0.4rem;
  border: 1px solid transparent;
  border-radius: var(--sfs-radius-xs, 6px);
  background: transparent;
  font-family: inherit;
  font-size: 1rem;
  font-weight: var(--sfs-weight-bold, 700);
  color: var(--sfs-text, #f8fafc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* A paper's name is its owner's own text, in whichever language they typed
     it, so the direction is read out of the string rather than imposed - an
     English title inside an Arabic page otherwise has its full stop moved to
     the front. */
  unicode-bidi: plaintext;
}

/* Only the editable one. A hairline round static text would promise an edit
   that is not on offer to a collaborator. */
.title-input {
  border-color: var(--sfs-border, rgb(255 255 255 / 0.14));
  cursor: text;
}

.title-input:hover {
  border-color: var(--sfs-border-strong, rgb(255 255 255 / 0.24));
  background: var(--sfs-glass-1, rgb(255 255 255 / 0.05));
}

.title-input:focus {
  outline: var(--sfs-ring-width, 2px) solid var(--sfs-focus, rgb(102 126 234 / 0.6));
  outline-offset: var(--sfs-ring-offset, 2px);
  border-color: var(--sfs-accent, #667eea);
  background: var(--sfs-field, rgb(255 255 255 / 0.06));
  color: var(--sfs-field-text, #f8fafc);
}

.title-input::placeholder { color: var(--sfs-placeholder, rgb(255 255 255 / 0.4)); }

.byline {
  margin: 0.05rem 0 0 0.4rem;
  font-size: 0.74rem;
  color: var(--sfs-text-muted, #94a3b8);
  unicode-bidi: isolate;
}

/*
  THE SAVE STATE, and every one of the four is a status ink on a glass surface
  rather than on paper - which is what `--sfs-*-text` is derived for.
*/
.save-saved { color: var(--sfs-success-text, #6ee7b7); }
.save-saving { color: var(--sfs-accent-text, #93c5fd); }
.save-dirty { color: var(--sfs-warning-text, #fcd34d); }
.save-error { color: var(--sfs-danger-text, #fca5a5); font-weight: var(--sfs-weight-semibold, 600); }

.people { display: flex; align-items: center; }

/*
  A COLLABORATOR'S INITIAL, on a background that comes from DATA.

  The fill is bound with `paint()` in the template - it is derived from the
  username, so no token can reach it - which is exactly the case `paint()`
  exists for, and it supplies the ink with the fill. What is set here is only
  the ring, which separates two overlapping faces and has to be visible against
  the HEADER rather than against either face.
*/
.face {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  margin-inline-start: -7px;
  border-radius: 50%;
  border: 2px solid var(--sfs-surface-2, #1a2036);
  font-size: 0.76rem;
  font-weight: var(--sfs-weight-bold, 700);
  cursor: default;
}

.face:first-child { margin-inline-start: 0; }

.face.more {
  background: var(--sfs-glass-3, rgb(255 255 255 / 0.12));
  color: var(--sfs-text, #f8fafc);
}

.head-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }

.pill {
  padding: 0.2rem 0.6rem;
  border-radius: var(--sfs-radius-pill, 999px);
  font-size: 0.72rem;
  font-weight: var(--sfs-weight-bold, 700);
}

.pill.view {
  background: var(--sfs-glass-3, rgb(255 255 255 / 0.12));
  color: var(--sfs-text-muted, #94a3b8);
}

.pill.edit {
  background: rgb(var(--sfs-success-rgb, 22 163 74) / 0.16);
  color: var(--sfs-success-text, #6ee7b7);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  min-height: max(2.2rem, 36px);
  border: 1px solid transparent;
  border-radius: var(--sfs-radius, 14px);
  font-size: 0.84rem;
  font-weight: var(--sfs-weight-semibold, 600);
  cursor: pointer;
  transition: background-color var(--sfs-dur-fast, 0.16s) var(--sfs-ease, ease),
              border-color var(--sfs-dur-fast, 0.16s) var(--sfs-ease, ease);
}

.btn.ghost {
  background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));
  border-color: var(--sfs-border, rgb(255 255 255 / 0.14));
  color: var(--sfs-text, #f8fafc);
}

.btn.ghost:hover { background: var(--sfs-glass-hover, rgb(255 255 255 / 0.14)); }

.btn.primary {
  background: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #fff);
}

.btn.primary:hover { background: var(--sfs-accent-strong, #5568d3); }

.btn.danger {
  background: var(--sfs-danger, #dc2626);
  color: var(--sfs-on-danger, #fff);
}

.state {
  flex: 1;
  display: grid;
  place-content: center;
  gap: 0.6rem;
  padding: 1.5rem;
  text-align: center;
  color: var(--sfs-text-muted, #94a3b8);
  font-size: 0.92rem;
}

.state.error h2 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--sfs-danger-text, #fca5a5);
}

.state.error p { margin: 0; max-width: 46ch; line-height: var(--sfs-leading-relaxed, 1.6); }
.state .btn { justify-self: center; }

/*
  THE TOAST, and it is the one thing here that sits over the CANVAS rather than
  over the page - so it takes the scrim pair, which is dark with a derived light
  ink in all ten galaxies. `--sfs-surface-rgb` would follow the theme and
  disappear into a light one.
*/
.banner {
  position: absolute;
  bottom: 1.1rem;
  /* PHYSICAL AND CENTRED. `left: 50%` with `translateX(-50%)` cannot be
     rewritten to a logical property: flipped, the 50% is measured from the
     right while the transform still pulls left, and the toast lands off-centre
     by its own width. */
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 0.55rem 1rem;
  border-radius: var(--sfs-radius-pill, 999px);
  background: var(--sfs-overlay, rgb(15 23 42 / 0.88));
  color: var(--sfs-on-overlay, #f8fafc);
  font-size: 0.82rem;
  box-shadow: var(--sfs-elev-2, 0 10px 26px rgb(0 0 0 / 0.3));
  z-index: 20;
}

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

/* A PANEL, NOT A SHEET. See DrawPapers' dialog - on `--sfs-paper` this was a
   white card in all ten themes carrying white ink. */
.dialog {
  width: min(460px, 100%);
  padding: 1.4rem 1.5rem 1.1rem;
  border: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  border-radius: var(--sfs-radius-xl, 22px);
  background: var(--sfs-surface-2, #1a2036);
  color: var(--sfs-text, #f8fafc);
  box-shadow: var(--sfs-elev-3, 0 26px 64px rgb(0 0 0 / 0.34));
}

.dialog h2 { margin: 0 0 0.6rem; font-size: 1.06rem; }

.dialog p {
  margin: 0;
  color: var(--sfs-text-muted, #94a3b8);
  font-size: 0.88rem;
  line-height: var(--sfs-leading-relaxed, 1.6);
}

.dialog footer { display: flex; justify-content: flex-end; gap: 0.55rem; margin-top: 1.1rem; }

@media (pointer: coarse) {
  .btn { min-height: 44px; }
  .back { width: 40px; height: 40px; flex-basis: 40px; }
}

@media (max-width: 760px) {
  .byline { display: none; }
  .board-head { gap: 0.5rem; padding: 0.5rem 0.6rem; }
  .head-actions .btn { padding: 0.5rem 0.6rem; font-size: 0.78rem; }
  .title-input, .title-static { font-size: 0.92rem; }
}
</style>
