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

    <div v-else-if="ready" class="sds-body">
      <!-- The IDE -->
      <section class="sds-ide" :aria-label="$t('Code')">
        <div class="sds-tabs" role="tablist">
          <button v-for="tab in tabs" :key="tab.id" type="button" role="tab"
                  :aria-selected="side === tab.id" :class="{ 'is-on': side === tab.id }"
                  @click="pickSide(tab.id)">
            <component :is="tab.icon" class="sds-i" /> {{ tab.label }}
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

      <!-- The simulator -->
      <section class="sds-sim" :aria-label="$t('Simulator view')">
        <LabDrive v-if="driveTool" ref="drive" :key="epoch" :tool-id="driveTool.id" :run="runTool" />
      </section>
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
import { computed, defineAsyncComponent, nextTick, onMounted, reactive, ref } from 'vue';
import {
  BookOpen, Bot, Car, Code2, FlaskConical, Loader2, RotateCcw,
  SquareTerminal, Terminal,
} from 'lucide-vue-next';
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

/*
  The simulator on top and the IDE full width under it. Side by side only on a
  very wide screen: the 3D pane carries its own run panel and the editor needs
  room for a file tree AND a buffer, so at 1440px both halves were squeezed.
*/
.sds-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}
.sds-sim { order: -1; }
@media (min-width: 1800px) {
  .sds-body { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); }
  .sds-sim { order: 0; }
}

.sds-ide, .sds-sim {
  min-width: 0;
  border-radius: var(--sfs-radius, 12px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
}
.sds-sim { padding: 0.75rem; }
.sds-ide { display: flex; flex-direction: column; overflow: hidden; }

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

.sds-pane { padding: 0.75rem; min-height: 32rem; }
.sds-guide { max-height: 75vh; overflow: auto; }

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
