<template>
  <!--
    THE SELF-DRIVING STUDIO - the simulator on its own, the way the Network
    Simulator has a studio of its own beside its labs.

    It is NOT a lab, on purpose: no brief, no tasks, no Check my work, no
    practice record. It is a place to write CARLA Python, press Run and watch
    it in 3D, or take the wheel by hand. The fourteen graded labs stay in Labs.

    Underneath it is app 11's `carla-studio` record - unpublished, marked as a
    `workspace`, with no tasks - because that is what gives each student a
    SAVED set of files, a console and the simulator server. Nothing it does is
    graded and no lab progress is ever written for it (routes/labs.py skips an
    unpublished lab).
  -->
  <div class="sds">
    <header class="sds-head">
      <div class="sds-head__title">
        <span class="sds-head__icon" aria-hidden="true">
          <Car class="sds-i" />
        </span>
        <div>
          <h1>{{ $t('Self-Driving Studio') }}</h1>
          <p>{{ $t('Write CARLA Python, run it, and watch your car drive a 3D city - or take the wheel yourself.') }}</p>
        </div>
      </div>
      <div class="sds-head__actions">
        <router-link to="/labs" class="sds-btn sds-btn--ghost">
          <FlaskConical class="sds-i" /> {{ $t('Self-driving labs') }}
        </router-link>
        <button type="button" class="sds-btn sds-btn--ghost" :disabled="!ready || busy"
                @click="confirmReset = true">
          <RotateCcw class="sds-i" /> {{ $t('Reset my files') }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="sds-state">
      <Loader2 class="sds-i sds-spin" />
      <p>{{ $t('Starting the simulator…') }}</p>
    </div>

    <div v-else-if="error" class="sds-state is-error">
      <p>{{ error }}</p>
      <button type="button" class="sds-btn" @click="open">{{ $t('Try again') }}</button>
    </div>

    <div v-else-if="ready" ref="frameEl" class="sds-frame"
         :class="{ 'is-full': fs.active.value, 'is-overlay': fs.active.value && !fs.native.value }">
      <!-- The workspace bar: how the two panes share the screen, and full screen. -->
      <div class="sds-bar" role="toolbar" :aria-label="$t('Workspace layout')">
        <div class="sds-seg" role="radiogroup" :aria-label="$t('Layout')">
          <button v-for="mode in layouts" :key="mode.id" type="button" role="radio"
                  :aria-checked="layout === mode.id" :class="{ 'is-on': layout === mode.id }"
                  :title="mode.label" @click="setLayout(mode.id)">
            <component :is="mode.icon" class="sds-i" aria-hidden="true" />
            <span class="sds-seg__text">{{ mode.label }}</span>
          </button>
        </div>
        <div class="sds-bar__end">
          <span v-if="fs.active.value" class="sds-bar__hint">{{ $t('Esc leaves full screen') }}</span>
          <button v-if="!fs.active.value" type="button" class="sds-btn sds-btn--ghost sds-btn--sm" @click="fs.enter()">
            <Maximize2 class="sds-i" aria-hidden="true" /> {{ $t('Full screen') }}
          </button>
          <button v-else type="button" class="sds-btn sds-btn--sm" @click="fs.exit()">
            <Minimize2 class="sds-i" aria-hidden="true" /> {{ $t('Exit full screen') }}
          </button>
        </div>
      </div>

    <div ref="bodyEl" class="sds-body" :data-layout="layout" :style="{ '--sds-split': split + '%' }">
      <!-- The IDE -->
      <section v-show="layout !== 'sim'" class="sds-ide" :aria-label="$t('Code')">
        <div class="sds-tabs" role="tablist">
          <button v-for="tab in tabs" :key="tab.id" type="button" role="tab"
                  :aria-selected="side === tab.id" :class="{ 'is-on': side === tab.id }"
                  @click="pickSide(tab.id)">
            <component :is="tab.icon" class="sds-i" /> {{ tab.label }}
          </button>
          <button type="button" class="sds-max" :title="layout === 'code' ? $t('Show the simulator too') : $t('Maximise the code')"
                  :aria-label="layout === 'code' ? $t('Show the simulator too') : $t('Maximise the code')"
                  @click="toggleMax('code')">
            <component :is="layout === 'code' ? Minimize2 : Maximize2" class="sds-i" aria-hidden="true" />
          </button>
        </div>

        <!-- v-show, not v-if: switching tab must not throw away a transcript
             or an unsaved buffer (the workspace's own lesson). -->
        <div v-show="side === 'code'" class="sds-pane">
          <LabFiles
            ref="files"
            :list="listFiles"
            :tree="listTree"
            :read="readFile"
            :write="writeFile"
            :remove="deleteFile"
            :mkdir="makeFolder"
            :move="movePath"
            :export-files="exportFiles"
            archive-name="self-driving-studio"
            :intro="$t('Your scripts, saved for you. Edit drive.py or a file in examples/, press Ctrl+S, then Run it in the simulator.')"
            @changed="onFilesChanged"
          />
        </div>
        <div v-show="side === 'console'" class="sds-pane">
          <LabConsole
            v-if="consoleTool"
            :tool="consoleTool"
            :hint="$t('Try: python drive.py   ·   python examples/02_autopilot_city.py --map Town10HD   ·   carla maps')"
            :run="line => runTool(consoleTool!.id, { command: line })"
            :complete="completeIn"
            :save="writeFile"
          />
        </div>
        <div v-show="side === 'terminal'" class="sds-pane">
          <LabConsole
            v-if="terminalTool"
            :tool="terminalTool"
            :run="line => runTool(terminalTool!.id, { command: line })"
            :complete="completeIn"
            :save="writeFile"
          />
        </div>
        <div v-show="side === 'ai'" class="sds-pane">
          <LabTutor v-if="lab && opened.has('ai')" :lab="lab" :load-context="loadContext" />
        </div>
        <div v-show="side === 'guide'" class="sds-pane sds-guide">
          <LabBrief :text="guide" />
        </div>
      </section>

      <!-- The divider: drag (or arrow keys) to give either pane more room. Split view only. -->
      <div v-if="layout === 'split'" class="sds-split" role="separator" aria-orientation="vertical"
           :aria-valuenow="Math.round(split)" aria-valuemin="25" aria-valuemax="75" tabindex="0"
           :aria-label="$t('Resize the panes')" @pointerdown="startDrag" @keydown="nudge"></div>

      <!-- The simulator -->
      <section v-show="layout !== 'code'" class="sds-sim" :aria-label="$t('Simulator view')">
        <div class="sds-sim__head">
          <span>{{ $t('Simulator') }}</span>
          <button type="button" class="sds-max" :title="layout === 'sim' ? $t('Show the code too') : $t('Maximise the simulator')"
                  :aria-label="layout === 'sim' ? $t('Show the code too') : $t('Maximise the simulator')"
                  @click="toggleMax('sim')">
            <component :is="layout === 'sim' ? Minimize2 : Maximize2" class="sds-i" aria-hidden="true" />
          </button>
        </div>
        <div class="sds-sim__body">
          <LabDrive v-if="driveTool" ref="drive" :key="epoch" :tool-id="driveTool.id" :run="runTool" />
        </div>
      </section>
    </div>
    </div>

    <!-- Reset: a plain confirm in the page, not a modal layer of its own. -->
    <div v-if="confirmReset" class="sds-confirm" role="alertdialog" aria-modal="true">
      <div class="sds-confirm__card">
        <p>{{ $t('Put drive.py and the examples back the way they shipped? Files you created are removed.') }}</p>
        <div class="sds-confirm__row">
          <button type="button" class="sds-btn sds-btn--ghost" @click="confirmReset = false">{{ $t('Cancel') }}</button>
          <button type="button" class="sds-btn sds-btn--danger" :disabled="busy" @click="reset">{{ $t('Reset my files') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  BookOpen, Bot, Car, Code2, Columns2, FlaskConical, Loader2, Maximize2, Minimize2, MonitorPlay, RotateCcw,
  Rows2, SquareTerminal, Terminal,
} from 'lucide-vue-next';
import { useFullscreen } from '@/composables/useFullscreen';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/runtime';
import { labsService } from '@/services/labs.service';
import type { Lab, LabTool } from '@/utils/labCatalogue';
import LabBrief from '@/components/labs/LabBrief.vue';
import LabConsole from '@/components/labs/LabConsole.vue';
import LabFiles from '@/components/labs/LabFiles.vue';
import LabTutor from '@/components/labs/LabTutor.vue';

/* Babylon and the 3D studio stay out of the entry chunk (working rule 47). */
const LabDrive = defineAsyncComponent(() => import('@/components/labs/LabDrive.vue'));

/** The workspace record on app 11. Unpublished, so it is in no catalogue. */
const STUDIO_ID = 'carla-studio';

type Side = 'code' | 'console' | 'terminal' | 'ai' | 'guide';
// A computed, so the labels follow a language switch made on this page.
const tabs = computed(() => [
  { id: 'code' as Side, label: t('Code'), icon: Code2 },
  { id: 'console' as Side, label: t('CARLA console'), icon: SquareTerminal },
  { id: 'terminal' as Side, label: t('Terminal'), icon: Terminal },
  { id: 'ai' as Side, label: t('AI helper'), icon: Bot },
  { id: 'guide' as Side, label: t('Guide'), icon: BookOpen },
]);

/*
  The layout. The simulator and the editor used to share the page in whatever room the
  grid left them (stacked under 1800px, both squeezed above it), with no full screen.
  Now the student chooses: side by side with a draggable divider, stacked, or one pane
  maximised - and the whole workspace can go full screen (useFullscreen: native API,
  fixed overlay where refused, Escape leaves). Both choices are remembered.
*/
type Layout = 'split' | 'stack' | 'sim' | 'code';
const LAYOUT_KEY = 'sfs-sds-layout';
const SPLIT_KEY = 'sfs-sds-split';
const layouts = computed(() => [
  { id: 'split' as Layout, label: t('Side by side'), icon: Columns2 },
  { id: 'stack' as Layout, label: t('Stacked'), icon: Rows2 },
  { id: 'sim' as Layout, label: t('Simulator only'), icon: MonitorPlay },
  { id: 'code' as Layout, label: t('Code only'), icon: Code2 },
]);
function storedLayout(): Layout {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    if (v === 'split' || v === 'stack' || v === 'sim' || v === 'code') return v;
  } catch { /* private mode */ }
  return typeof window !== 'undefined' && window.innerWidth >= 1200 ? 'split' : 'stack';
}
function storedSplit(): number {
  try { const n = Number(localStorage.getItem(SPLIT_KEY)); if (n >= 25 && n <= 75) return n; } catch { /* private mode */ }
  return 42;
}
const layout = ref<Layout>(storedLayout());
const split = ref<number>(storedSplit());
const lastPair = ref<Layout>(layout.value === 'stack' ? 'stack' : 'split');
const frameEl = ref<HTMLElement | null>(null);
const bodyEl = ref<HTMLElement | null>(null);
const fs = useFullscreen(frameEl);

function setLayout(mode: Layout) {
  layout.value = mode;
  if (mode === 'split' || mode === 'stack') lastPair.value = mode;
  try { localStorage.setItem(LAYOUT_KEY, mode); } catch { /* private mode */ }
}
function toggleMax(pane: 'sim' | 'code') { setLayout(layout.value === pane ? lastPair.value : pane); }
function saveSplit() { try { localStorage.setItem(SPLIT_KEY, String(Math.round(split.value))); } catch { /* private mode */ } }

let dragStop: (() => void) | null = null;
function startDrag(event: PointerEvent) {
  const body = bodyEl.value;
  if (!body) return;
  event.preventDefault();
  const rect = body.getBoundingClientRect();
  const rtl = getComputedStyle(body).direction === 'rtl';
  const move = (e: PointerEvent) => {
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    if (rtl) pct = 100 - pct;
    split.value = Math.min(75, Math.max(25, pct));
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('sds-dragging'); saveSplit(); dragStop = null; };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  document.body.classList.add('sds-dragging');
  dragStop = up;
}
function nudge(event: KeyboardEvent) {
  const step = event.shiftKey ? 10 : 3;
  if (event.key === 'ArrowLeft') split.value = Math.max(25, split.value - step);
  else if (event.key === 'ArrowRight') split.value = Math.min(75, split.value + step);
  else if (event.key === 'Home') split.value = 25;
  else if (event.key === 'End') split.value = 75;
  else return;
  event.preventDefault();
  saveSplit();
}
// The 3D view measures its own box: after a layout change or full screen, let it re-measure.
watch([layout, () => fs.active.value], () => { nextTick(() => requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))); });
onBeforeUnmount(() => { if (dragStop) dragStop(); });

const authStore = useAuthStore();
const { t } = useI18n();
const username = computed(() => authStore.user?.username || '');

const lab = ref<Lab | null>(null);
const loading = ref(true);
const error = ref('');
const busy = ref(false);
const side = ref<Side>('code');
const opened = reactive(new Set<Side>(['code']));
const epoch = ref(0);
const confirmReset = ref(false);
const guide = ref('');
const files = ref<InstanceType<typeof LabFiles> | null>(null);
const drive = ref<{ refreshScripts?: () => Promise<void> } | null>(null);

const ready = computed(() => !!lab.value);
const tools = computed<LabTool[]>(() => (lab.value?.tool_detail || []) as LabTool[]);
const toolOf = (id: string) => tools.value.find(tool => tool.id === id) || null;
const driveTool = computed(() => toolOf('carla_sim'));
const consoleTool = computed(() => toolOf('carla'));
const terminalTool = computed(() => toolOf('terminal'));

function pickSide(id: Side) {
  side.value = id;
  opened.add(id);
  if (id === 'guide') void loadGuide();
}

async function open() {
  if (!username.value) return;
  loading.value = true;
  error.value = '';
  try {
    // No user id on purpose: the studio records no progress, and the backend
    // skips it for an unpublished record anyway.
    const payload = await labsService.openLab(username.value, STUDIO_ID);
    if (!payload?.lab) {
      error.value = t('The simulator service could not be reached. It may still be starting up.');
      return;
    }
    lab.value = payload.lab as Lab;
    epoch.value += 1;
  } catch {
    error.value = t('The simulator service could not be reached. It may still be starting up.');
  } finally {
    loading.value = false;
  }
}

async function runTool(toolId: string, payload: Record<string, unknown>) {
  const result = await labsService.runTool(username.value, STUDIO_ID, toolId, payload);
  // A console can write files (`echo > f`, nano, cp), so the explorer and the
  // simulator's Script list follow every command, not just the editor's saves.
  if (toolId !== driveTool.value?.id) onFilesChanged();
  return result;
}

function onFilesChanged() {
  (files.value as any)?.refresh?.();
  void drive.value?.refreshScripts?.();
  if (opened.has('guide')) void loadGuide();
}

async function loadGuide() {
  guide.value = await labsService.readFile(username.value, STUDIO_ID, 'README.md') || '';
}

async function completeIn(toolId: string) {
  return labsService.completions(username.value, STUDIO_ID, toolId);
}
async function loadContext(): Promise<string> {
  return labsService.getContext(username.value, STUDIO_ID);
}
async function listFiles() {
  return labsService.listFiles(username.value, STUDIO_ID);
}
async function listTree() {
  return labsService.listTree(username.value, STUDIO_ID);
}
async function readFile(path: string) {
  return labsService.readFile(username.value, STUDIO_ID, path);
}
async function exportFiles(path: string) {
  return labsService.exportFiles(username.value, STUDIO_ID, path);
}
async function writeFile(path: string, content: string) {
  const result = await labsService.writeFile(username.value, STUDIO_ID, path, content);
  void drive.value?.refreshScripts?.();
  return result;
}
async function deleteFile(path: string, recursive = false) {
  const result = await labsService.deleteFile(username.value, STUDIO_ID, path, recursive);
  void drive.value?.refreshScripts?.();
  return result;
}
async function makeFolder(path: string) {
  return labsService.makeFolder(username.value, STUDIO_ID, path);
}
async function movePath(path: string, to: string) {
  const result = await labsService.movePath(username.value, STUDIO_ID, path, to);
  void drive.value?.refreshScripts?.();
  return result;
}

async function reset() {
  busy.value = true;
  try {
    await labsService.resetLab(username.value, STUDIO_ID);
    confirmReset.value = false;
    await open();
    await nextTick();
    onFilesChanged();
  } finally {
    busy.value = false;
  }
}

onMounted(open);
</script>

<style scoped>
.sds {
  max-width: 1680px;
  margin: 0 auto;
  padding: clamp(0.75rem, 2vw, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--sfs-text, #e8edf5);
}
.sds-i { width: 1.05em; height: 1.05em; flex: none; }
.sds-spin { animation: sds-spin 1s linear infinite; }
@keyframes sds-spin { to { transform: rotate(360deg); } }

.sds-head {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 0.75rem 1.5rem;
  padding: 1rem 1.25rem;
  border-radius: var(--sfs-radius, 12px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
}
.sds-head__title { display: flex; align-items: center; gap: 0.85rem; min-width: 0; }
.sds-head__icon {
  display: grid; place-content: center; width: 2.75rem; height: 2.75rem; flex: none;
  border-radius: 12px; font-size: 1.4rem;
  background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #ffffff);
}
.sds-head h1 { margin: 0; font-size: clamp(1.25rem, 2.4vw, 1.65rem); }
.sds-head p { margin: 0.2rem 0 0; color: var(--sfs-text-muted, #b4bccb); }
.sds-head__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.sds-btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  min-height: max(2.5rem, 40px); padding: 0.45rem 0.9rem;
  border-radius: 10px; border: 1px solid transparent; cursor: pointer;
  font: inherit; font-weight: 600; text-decoration: none;
  background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #ffffff);
}
.sds-btn:disabled { opacity: 0.55; cursor: default; }
.sds-btn--ghost {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
  color: var(--sfs-text, #e8edf5);
}
.sds-btn--danger { background: var(--sfs-danger, #e5484d); color: var(--sfs-on-danger, #ffffff); }

.sds-state {
  display: grid; place-items: center; gap: 0.75rem; min-height: 40vh; text-align: center;
  color: var(--sfs-text-muted, #b4bccb);
}
.sds-state.is-error p { color: var(--sfs-danger-text, #ff8a8a); }

/* The workspace frame: the bar, then the panes. It is what goes full screen. */
.sds-frame { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
.sds-frame.is-full {
  height: 100%; padding: 0.75rem; box-sizing: border-box;
  background: var(--sfs-space, #070b14);
}
.sds-frame.is-overlay { position: fixed; inset: 0; z-index: 2147483000; height: 100dvh; }

.sds-bar {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem;
}
.sds-bar__end { display: flex; align-items: center; gap: 0.6rem; }
.sds-bar__hint { font-size: 0.82rem; color: var(--sfs-text-muted, #b4bccb); }
.sds-seg {
  display: inline-flex; padding: 0.2rem; gap: 0.2rem; border-radius: 10px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
}
.sds-seg button {
  display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.7rem; min-height: 2.25rem;
  border: 0; border-radius: 8px; cursor: pointer; font: inherit; font-size: 0.88rem; font-weight: 600;
  background: transparent; color: var(--sfs-text-muted, #b4bccb);
}
.sds-seg button:hover { color: var(--sfs-text, #e8edf5); }
.sds-seg button.is-on { background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #ffffff); }
.sds-btn--sm { min-height: 2.25rem; padding: 0.35rem 0.75rem; font-size: 0.88rem; }
@media (max-width: 720px) { .sds-seg__text { display: none; } }

/*
  The panes. Each one has a fixed share of a bounded height and scrolls INSIDE itself,
  so nothing spills over the other pane and the page never grows two screens tall.
*/
.sds-body {
  --sds-h: clamp(30rem, calc(100dvh - 12rem), 60rem);
  display: grid; gap: 0.75rem; min-height: 0;
  grid-template-columns: minmax(0, 1fr);
}
.sds-body[data-layout='split'] {
  grid-template-columns: minmax(0, calc(var(--sds-split) - 0.5rem)) 0.75rem minmax(0, 1fr);
  gap: 0; height: var(--sds-h);
}
.sds-body[data-layout='split'] .sds-ide { order: 0; }
.sds-body[data-layout='split'] .sds-sim { order: 2; }
.sds-body[data-layout='stack'] .sds-sim { order: -1; height: min(42rem, 70dvh); }
.sds-body[data-layout='stack'] .sds-ide { height: min(40rem, 75dvh); }
.sds-body[data-layout='sim'], .sds-body[data-layout='code'] { height: var(--sds-h); }
.sds-frame.is-full .sds-body { flex: 1; height: auto; min-height: 0; }
.sds-frame.is-full .sds-body[data-layout='stack'] { grid-template-rows: minmax(0, 1.2fr) minmax(0, 1fr); }
.sds-frame.is-full .sds-body[data-layout='stack'] .sds-sim,
.sds-frame.is-full .sds-body[data-layout='stack'] .sds-ide { height: auto; }

.sds-ide, .sds-sim {
  min-width: 0; min-height: 0;
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: var(--sfs-radius, 12px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
}
.sds-sim__head {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  padding: 0.45rem 0.6rem 0.45rem 0.9rem; font-weight: 700; font-size: 0.92rem;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
}
.sds-sim__body { flex: 1; min-height: 0; overflow: auto; padding: 0.75rem; overscroll-behavior: contain; }
.sds-max {
  display: inline-grid; place-items: center; width: 2.1rem; height: 2.1rem; flex: none; margin-inline-start: auto;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16); border-radius: 8px; cursor: pointer;
  background: transparent; color: var(--sfs-text, #e8edf5);
}
.sds-max:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1); }

.sds-split {
  position: relative; cursor: col-resize; touch-action: none; order: 1;
}
.sds-split::before {
  content: ''; position: absolute; inset-block: 1.5rem; inset-inline-start: 50%; width: 4px; margin-inline-start: -2px;
  border-radius: 4px; background: rgb(var(--sfs-line-rgb, 255 255 255) / 0.22); transition: background 0.15s;
}
.sds-split:hover::before, .sds-split:focus-visible::before { background: var(--sfs-accent, #667eea); }
.sds-split:focus-visible { outline: none; }
:global(body.sds-dragging) { cursor: col-resize; user-select: none; }

.sds-tabs {
  display: flex; align-items: center; gap: 0.25rem; overflow-x: auto;
  padding: 0.5rem; border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
}
.sds-tabs button {
  display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap;
  padding: 0.45rem 0.75rem; border-radius: 8px; border: 0; cursor: pointer;
  font: inherit; font-size: 0.9rem; background: transparent;
  color: var(--sfs-text-muted, #b4bccb);
}
.sds-tabs button.is-on { background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #ffffff); }

.sds-pane { flex: 1; min-height: 0; overflow: auto; padding: 0.75rem; overscroll-behavior: contain; }
.sds-tabs { flex: none; }

.sds-confirm {
  position: fixed; inset: 0; z-index: 2000;
  display: grid; place-items: center; padding: 1rem;
  background: var(--sfs-overlay, rgb(8 12 20 / 0.6));
}
.sds-confirm__card {
  max-width: 28rem; padding: 1.25rem; border-radius: 14px;
  background: var(--sfs-surface, #161b26); color: var(--sfs-text, #e8edf5);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16);
}
.sds-confirm__row { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
</style>
