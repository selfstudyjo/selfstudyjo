<template>
  <div ref="rootEl" class="gd" dir="ltr" tabindex="-1" @keydown="onKey">
    <GdMenuBar :menus="menus" />
    <GdToolbar :v="v" :open="dropdown" :busy="busy" :act="toolbarAct"
               @toggle="toggleDropdown" @branch-context="branchContext" />
    <div v-if="dropdown" class="gd-dropcatch" @mousedown="dropdown = null"></div>

    <div class="gd-body">
      <aside class="gd-side" aria-label="Repository">
        <div class="gd-tabs" role="tablist">
          <button type="button" role="tab" class="gd-tabs__tab" :aria-selected="tab === 'changes'"
                  :class="{ 'is-active': tab === 'changes' }" :disabled="!v.initialised" @click="setTab('changes')">
            Changes <span v-if="v.changes.length" class="gd-tabs__count">{{ v.changes.length }}</span>
          </button>
          <button type="button" role="tab" class="gd-tabs__tab" :aria-selected="tab === 'history'"
                  :class="{ 'is-active': tab === 'history' }" :disabled="!v.initialised" @click="setTab('history')">
            History
          </button>
        </div>
        <GdChanges v-if="tab === 'changes' && v.initialised" :v="v" :selected="selectedPath" :busy="busy"
                   :undo="undoInfo" :act="changesAct" @select="selectPath" @context="changeContext" />
        <GdHistory v-else-if="tab === 'history' && v.initialised" :commits="historyList" :selected="selectedSha"
                   :unborn="v.head.unborn" @select="selectCommit" @context="commitContext" />
        <div v-else class="gd-side__none">No repository</div>
      </aside>

      <main class="gd-main">
        <div v-if="conflictBanner" class="gd-banner gd-banner--warn">
          <GdIcon name="alert" :size="16" />
          <span>{{ conflictBanner }}</span>
          <button type="button" class="gd-banner__link" @click="conflictsOpen = true">View conflicts</button>
        </div>
        <div v-for="flash in banners" :key="flash.id" class="gd-banner"
             :class="flash.type === 'success' ? 'gd-banner--ok' : 'gd-banner--info'" role="status">
          <GdIcon :name="flash.type === 'success' ? 'check' : 'alert'" :size="16" />
          <span>{{ flash.title }}</span>
          <button type="button" class="gd-banner__x" aria-label="Dismiss" @click="api.dismiss(flash.id)">
            <GdIcon name="x" :size="14" />
          </button>
        </div>

        <div class="gd-main__pane">
          <GdBlank v-if="!v.initialised" kind="norepo" :v="v" :busy="busy" @create="dialog = { type: 'createRepo' }" />
          <template v-else-if="tab === 'changes'">
            <GdBlank v-if="selectedPath === '::stash'" kind="stash" :v="v" :busy="busy" :stash="branchStash"
                     @restore="restoreStash" @discard-stash="s => dialog = { type: 'stashDiscard', stash: s }" />
            <GdDiff v-else-if="selectedChange" :path="selectedChange.path" :hunks="selectedChange.hunks"
                    :status="selectedChange.status" :additions="selectedChange.additions"
                    :deletions="selectedChange.deletions" />
            <GdBlank v-else kind="clean" :v="v" :busy="busy" @publish="dialog = { type: 'publish' }" />
          </template>
          <template v-else>
            <GdCommitDetail v-if="selectedCommitObj" :commit="selectedCommitObj" :file="selectedCommitFile"
                            @select-file="p => selectedCommitFile = p" @copy="copy" />
            <div v-else class="gd-main__empty">{{ v.head.unborn ? 'No commits yet' : 'No commit selected' }}</div>
          </template>
        </div>
      </main>
    </div>

    <!-- Desktop shows one popup at a time: an Error raised from a dialog replaces it on
         screen (the dialog keeps its state underneath and comes back on Close). -->
    <GdDialogs v-if="dialog" v-show="!errorDialog" :key="dialogKey" :d="dialog" :v="v" :busy="busy" :run="run" @close="dialog = null" />
    <GdMerge v-if="mergeOpen" :v="v" :busy="busy" :on-merge="doMerge" @close="mergeOpen = false" />
    <GdConflicts v-if="conflictsOpen && (v.conflicts.length || v.merging || v.sequencer)" :v="v" :busy="busy"
                 :run="run" @close="conflictsOpen = false" @done="conflictsOpen = false" />
    <GdSettings v-if="settingsOpen" v-show="!errorDialog" :v="v" :busy="busy" :run="run" :initial-tab="settingsTab"
                @close="settingsOpen = false" @publish="settingsOpen = false; dialog = { type: 'publish' }" />
    <GdDialogs v-if="errorDialog" :key="`e${errorDialog.id}`" :d="errorDialog" :v="v" :busy="busy" :run="run"
               @close="closeError" />
    <GdMenu v-if="menu" :items="menu.items" :x="menu.x" :y="menu.y" @close="menu = null" />
  </div>
</template>

<script setup lang="ts">
/**
 * GitHub Desktop 3.x (light theme), as a lab portal over the Git engine.
 *
 * Every button runs the git command it stands for through `api.exec` - the
 * equivalent-CLI drawer under the frame lists them - and everything drawn is
 * read back from the engine's view, so the Changes list, the console's
 * `git status` and the grader can never disagree. Layout: the dark title bar
 * with the menus, the dark toolbar (repository / branch / publish), the
 * Changes / History sidebar, and the diff or commit on the right.
 *
 * Errors are shown the way Desktop shows them - a modal "Error" dialog with
 * git's own message - and successes as the banner across the top of the pane.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { errorText } from '@/utils/portalKit';
import type { LabTool } from '@/utils/labCatalogue';
import type { PortalApi } from '../usePortal';
import GdBlank from './GdBlank.vue';
import GdChanges from './GdChanges.vue';
import GdCommitDetail from './GdCommitDetail.vue';
import GdConflicts from './GdConflicts.vue';
import GdDiff from './GdDiff.vue';
import GdDialogs from './GdDialogs.vue';
import GdHistory from './GdHistory.vue';
import GdIcon from './GdIcon.vue';
import GdMenu from './GdMenu.vue';
import GdMenuBar from './GdMenuBar.vue';
import GdMerge from './GdMerge.vue';
import GdSettings from './GdSettings.vue';
import GdToolbar from './GdToolbar.vue';
import { cmd, LOCATION, readView, type Branch, type Change, type Commit, type MenuItem,
         type Stash } from './gd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const api = props.api;
const v = computed(() => readView(props.view));
const busy = computed(() => Boolean(props.busy) || api.busy.value);

const rootEl = ref<HTMLElement | null>(null);
const tab = ref<'changes' | 'history'>('changes');
const selectedPath = ref('');
const selectedSha = ref('');
const selectedCommitFile = ref('');
const dropdown = ref<'repo' | 'branch' | null>(null);
const dialog = ref<Record<string, any> | null>(null);
const dialogKey = ref(0);
const errorDialog = ref<Record<string, any> | null>(null);
const mergeOpen = ref(false);
const conflictsOpen = ref(false);
const settingsOpen = ref(false);
const settingsTab = ref('remote');
const menu = ref<{ items: MenuItem[]; x: number; y: number } | null>(null);
const lastCommit = ref<{ sha: string; summary: string; at: string } | null>(null);

watch(dialog, () => { dialogKey.value += 1; });

// ------------------------------------------------------------ selection ---
const selectedChange = computed<Change | null>(() =>
  v.value.changes.find(c => c.path === selectedPath.value) || null);
const branchStash = computed<Stash | null>(() =>
  v.value.stashes.find(s => s.desktop && s.branch === v.value.branch) || null);
const historyList = computed(() => {
  // `log` is git log from HEAD (newest first); a replica a release behind falls back.
  if (v.value.log.length) {
    const byFull = new Map(v.value.commits.map(c => [c.full, c]));
    return v.value.log.map(sha => byFull.get(sha)).filter((c): c is Commit => Boolean(c));
  }
  return v.value.commits.filter(c => c.reachable !== false);
});
const selectedCommitObj = computed<Commit | null>(() =>
  historyList.value.find(c => c.full === selectedSha.value) || historyList.value[0] || null);

watch(() => v.value.changes.map(c => c.path).join('\n'), () => {
  if (selectedPath.value === '::stash' && branchStash.value) return;
  if (!v.value.changes.some(c => c.path === selectedPath.value)) {
    selectedPath.value = v.value.changes[0]?.path || '';
  }
}, { immediate: true });

watch(() => v.value.head.sha, () => {
  selectedSha.value = historyList.value[0]?.full || '';
  selectedCommitFile.value = '';
});
watch(() => historyList.value.map(c => c.full).join(','), () => {
  if (!historyList.value.some(c => c.full === selectedSha.value)) {
    selectedSha.value = historyList.value[0]?.full || '';
    selectedCommitFile.value = '';
  }
}, { immediate: true });

function selectPath(path: string) { selectedPath.value = path; }
function selectCommit(sha: string) { selectedSha.value = sha; selectedCommitFile.value = ''; }
function setTab(next: 'changes' | 'history') { tab.value = next; }

const location = computed(() => {
  if (!v.value.initialised) return `${LOCATION}/missing`;
  if (tab.value === 'history') return `${LOCATION}/history/${selectedCommitObj.value?.sha || ''}`;
  return `${LOCATION}/changes${selectedChange.value ? '/' + encodeURIComponent(selectedChange.value.path) : ''}`;
});
watch(location, url => emit('location', url), { immediate: true });

// A merge that stops with conflicts opens the dialog by itself, as Desktop does.
watch(() => v.value.conflicts.length, (count, before) => {
  if (count && !before) conflictsOpen.value = true;
});

const undoInfo = computed(() => lastCommit.value && lastCommit.value.sha === v.value.head.sha
  && !v.value.merging ? lastCommit.value : null);

const conflictBanner = computed(() => {
  if (conflictsOpen.value) return '';
  if (v.value.conflicts.length) return 'Resolve conflicts and then commit.';
  if (v.value.merging) return 'All conflicts resolved. Commit the merge to finish.';
  if (v.value.sequencer) return `A ${v.value.sequencer.op} is in progress.`;
  return '';
});

const banners = computed(() => api.flashes.value.filter(f => f.type === 'success' || f.type === 'info').slice(0, 2));

// An error flash from anywhere (a quiet:false exec) becomes Desktop's Error dialog.
watch(() => api.flashes.value.find(f => f.type === 'error')?.id, id => {
  const flash = api.flashes.value.find(f => f.id === id);
  if (flash && !errorDialog.value) {
    errorDialog.value = { type: 'error', id: flash.id, message: flash.detail || flash.title,
                          command: flash.command, flash: flash.id };
  }
});

function closeError() {
  if (errorDialog.value?.flash) api.dismiss(errorDialog.value.flash);
  errorDialog.value = null;
}

// ------------------------------------------------------------- running ---
let errorSeq = 0;

/** Run git lines in order; stop at the first failure and show git's message. */
async function run(commands: string[], success: string): Promise<boolean> {
  for (let i = 0; i < commands.length; i++) {
    const last = i === commands.length - 1;
    const result = await api.exec(commands[i], { success: last ? success : '', quiet: true });
    if (!result.ok) {
      const text = String(result.error || result.output || '');
      if (/CONFLICT \(/.test(text) && v.value.conflicts.length) {
        conflictsOpen.value = true;
        return false;
      }
      errorDialog.value = { type: 'error', id: ++errorSeq, message: errorText(result), command: commands[i] };
      return false;
    }
  }
  return true;
}

// -------------------------------------------------------------- actions ---
const changesAct = {
  toggle(change: Change) {
    run([change.staged === 'all' ? cmd.unstage(change.path) : cmd.stage(change.path)], '');
  },
  toggleAll(allStaged: boolean) {
    if (allStaged) { run([cmd.unstageAll()], ''); return; }
    if (v.value.conflicts.length) {
      run(v.value.changes.filter(c => c.staged !== 'all' && !(c.status === 'conflicted' && (c.markers || 0) > 0))
        .map(c => cmd.stage(c.path)), '');
      return;
    }
    run([cmd.stageAll()], '');
  },
  async commit(summary: string, description: string) {
    const ok = await run([cmd.commit(summary, description)], '');
    if (ok) {
      await nextTick();
      lastCommit.value = { sha: v.value.head.sha, summary, at: new Date().toISOString() };
    }
    return ok;
  },
  undo() {
    const root = v.value.head.parents.length === 0;
    run([cmd.undo(root)], 'Undid the last commit').then(ok => { if (ok) lastCommit.value = null; });
  },
};

function hasLocalChanges() {
  return v.value.changes.length > 0;
}

function switchTo(name: string) {
  dropdown.value = null;
  const current = !v.value.detached && name === v.value.branch;
  if (current) return;
  if (hasLocalChanges()) {
    dialog.value = { type: 'switch', target: name };
    return;
  }
  run([cmd.checkout(name)], '');
}

const toolbarAct = {
  switchTo,
  newBranch(initial: string) { dropdown.value = null; dialog.value = { type: 'newBranch', initial }; },
  mergeInto() { dropdown.value = null; mergeOpen.value = true; },
  publish() { dropdown.value = null; dialog.value = { type: 'publish' }; },
  createRepo() { dropdown.value = null; dialog.value = { type: 'createRepo' }; },
};

async function doMerge(branch: string) {
  const ok = await run([cmd.merge(branch)], `Successfully merged ${branch} into ${v.value.branch}`);
  mergeOpen.value = false;
  if (!ok && v.value.conflicts.length) conflictsOpen.value = true;
}

function restoreStash(stash: Stash) {
  run([cmd.stashPop(stash.ref)], 'Restored stashed changes').then(ok => {
    if (ok) selectedPath.value = v.value.changes[0]?.path || '';
  });
}

function toggleDropdown(which: 'repo' | 'branch') {
  dropdown.value = dropdown.value === which ? null : which;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch { /* a refused clipboard is not worth an error */ }
  api.notify('info', `Copied ${text.length > 12 ? text.slice(0, 7) : text} to the clipboard`);
}

function ignoreLines(lines: string[]) {
  const current = v.value.gitignore;
  const have = new Set(current.split('\n').map(l => l.trim()));
  const add = lines.filter(l => !have.has(l));
  if (!add.length) return;
  const base = current && !current.endsWith('\n') ? current + '\n' : current;
  run([cmd.write('.gitignore', base + add.join('\n') + '\n')], `Added ${add.join(', ')} to .gitignore`);
}

// --------------------------------------------------------- context menus ---
function at(ev: MouseEvent) {
  const rect = rootEl.value?.getBoundingClientRect();
  const x = ev.clientX - (rect?.left || 0);
  const y = ev.clientY - (rect?.top || 0);
  const w = rect?.width || 800;
  const h = rect?.height || 600;
  return { x: Math.max(4, Math.min(x, w - 250)), y: Math.max(4, Math.min(y, h - 260)) };
}

function changeContext(ev: MouseEvent, change: Change) {
  selectedPath.value = change.path;
  const ext = change.path.includes('.') ? change.path.slice(change.path.lastIndexOf('.')) : '';
  const items: MenuItem[] = [];
  if (change.status === 'conflicted') {
    items.push({ label: 'Resolve conflicts…', action: () => { conflictsOpen.value = true; } }, { separator: true });
  }
  items.push(
    { label: 'Discard changes…', disabled: change.status === 'conflicted',
      action: () => { dialog.value = { type: 'discard', files: [{ path: change.path, untracked: change.untracked }] }; } },
    { label: 'Discard all changes…', disabled: !v.value.changes.length || v.value.conflicts.length > 0,
      action: () => { dialog.value = { type: 'discardAll' }; } },
    { separator: true },
    { label: 'Ignore file (add to .gitignore)', disabled: change.path === '.gitignore',
      action: () => ignoreLines([change.path]) },
  );
  if (ext && ext.length > 1) {
    items.push({ label: `Ignore all ${ext} files (add to .gitignore)`, action: () => ignoreLines([`*${ext}`]) });
  }
  items.push(
    { separator: true },
    { label: 'Copy file path', action: () => copy(`${v.value.repository.path}/${change.path}`) },
    { label: 'Copy relative file path', action: () => copy(change.path) },
    { separator: true },
    { label: 'Show in Explorer', disabled: true },
    { label: 'Open in Visual Studio Code', disabled: true },
    { label: 'Open with default program', disabled: true },
  );
  menu.value = { items, ...at(ev) };
}

function commitContext(ev: MouseEvent, commit: Commit) {
  selectCommit(commit.full);
  const isHead = commit.full === v.value.head.sha;
  const busyOp = Boolean(v.value.merging || v.value.sequencer || v.value.conflicts.length);
  const items: MenuItem[] = [
    isHead
      ? { label: 'Undo commit…', disabled: busyOp || commit.merge, action: () => changesAct.undo() }
      : { label: 'Reset to commit…', disabled: busyOp, action: () => { dialog.value = { type: 'resetTo', commit }; } },
    { label: 'Checkout commit', disabled: busyOp || (Boolean(v.value.detached) && v.value.detached === commit.full),
      action: () => { dialog.value = { type: 'checkoutCommit', commit }; } },
    { label: 'Reorder commit', disabled: true },
    { label: 'Revert changes in commit', disabled: busyOp,
      action: () => run([cmd.revert(commit.full, commit.merge)], `Reverted ${commit.sha}`) },
    { separator: true },
    { label: 'Create branch from commit', action: () => { dialog.value = { type: 'newBranch', sha: commit.full }; } },
    { label: 'Create tag…', action: () => { dialog.value = { type: 'tag', commit }; } },
  ];
  for (const t of commit.tags) {
    items.push({ label: `Delete tag ${t}…`, action: () => { dialog.value = { type: 'deleteTag', tag: t }; } });
  }
  items.push(
    { label: 'Cherry-pick commit…', disabled: busyOp || hasLocalChanges() || v.value.branches.length < 2,
      action: () => { dialog.value = { type: 'cherryPick', commit }; } },
    { separator: true },
    { label: 'Copy SHA', action: () => copy(commit.full) },
    { label: 'Copy tag', disabled: !commit.tags.length, action: () => copy(commit.tags[0]) },
    { label: 'View on GitHub', disabled: true },
  );
  menu.value = { items, ...at(ev) };
}

function branchContext(ev: MouseEvent, branch: Branch) {
  menu.value = {
    ...at(ev),
    items: [
      { label: 'Rename…', action: () => { dropdown.value = null; dialog.value = { type: 'rename', branch: branch.name, initial: branch.name }; } },
      { label: 'Copy branch name', action: () => copy(branch.name) },
      { label: 'View branch on GitHub', disabled: true },
      { separator: true },
      { label: 'Delete…', disabled: branch.current,
        action: () => { dropdown.value = null; dialog.value = { type: 'deleteBranch', branch: branch.name }; } },
    ],
  };
}

// ---------------------------------------------------------------- menus ---
const menus = computed(() => {
  const ready = v.value.initialised;
  const busyOp = Boolean(v.value.merging || v.value.sequencer || v.value.conflicts.length);
  const current = v.value.detached ? '' : v.value.branch;
  return [
    { label: 'File', items: [
      { label: 'New repository…', shortcut: 'Ctrl+N', disabled: ready, action: () => { dialog.value = { type: 'createRepo' }; } },
      { label: 'Add local repository…', shortcut: 'Ctrl+O', disabled: true },
      { label: 'Clone repository…', shortcut: 'Ctrl+Shift+O', disabled: true },
      { separator: true },
      { label: 'Options…', shortcut: 'Ctrl+,', disabled: true },
      { separator: true },
      { label: 'Exit', disabled: true },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', disabled: true }, { label: 'Redo', shortcut: 'Ctrl+Y', disabled: true },
      { separator: true },
      { label: 'Cut', shortcut: 'Ctrl+X', disabled: true }, { label: 'Copy', shortcut: 'Ctrl+C', disabled: true },
      { label: 'Paste', shortcut: 'Ctrl+V', disabled: true }, { label: 'Select all', shortcut: 'Ctrl+A', disabled: true },
    ] },
    { label: 'View', items: [
      { label: 'Changes', shortcut: 'Ctrl+1', disabled: !ready, action: () => setTab('changes') },
      { label: 'History', shortcut: 'Ctrl+2', disabled: !ready, action: () => setTab('history') },
      { label: 'Repository list', shortcut: 'Ctrl+T', action: () => toggleDropdown('repo') },
      { label: 'Branches list', shortcut: 'Ctrl+B', disabled: !ready, action: () => toggleDropdown('branch') },
      { separator: true },
      { label: 'Go to summary', shortcut: 'Ctrl+G', disabled: true },
    ] },
    { label: 'Repository', items: [
      { label: 'Push', shortcut: 'Ctrl+P', disabled: !ready, action: () => { dialog.value = { type: 'publish' }; } },
      { label: 'Pull', shortcut: 'Ctrl+Shift+P', disabled: true },
      { label: 'Fetch', shortcut: 'Ctrl+Shift+T', disabled: true },
      { label: 'Remove…', shortcut: 'Ctrl+Backspace', disabled: true },
      { separator: true },
      { label: 'View on GitHub', shortcut: 'Ctrl+Shift+G', disabled: true },
      { label: 'Open in Command Prompt', shortcut: 'Ctrl+`', disabled: true },
      { label: 'Show in Explorer', shortcut: 'Ctrl+Shift+F', disabled: true },
      { label: 'Open in Visual Studio Code', shortcut: 'Ctrl+Shift+A', disabled: true },
      { separator: true },
      { label: 'Repository settings…', disabled: !ready, action: () => { settingsTab.value = 'remote'; settingsOpen.value = true; } },
    ] },
    { label: 'Branch', items: [
      { label: 'New branch…', shortcut: 'Ctrl+Shift+N', disabled: !ready, action: () => toolbarAct.newBranch('') },
      { label: 'Rename…', shortcut: 'Ctrl+Shift+R', disabled: !ready || !current,
        action: () => { dialog.value = { type: 'rename', branch: current, initial: current }; } },
      { label: 'Delete…', shortcut: 'Ctrl+Shift+D', disabled: true },
      { separator: true },
      { label: 'Discard all changes…', shortcut: 'Ctrl+Shift+Backspace', disabled: !v.value.changes.length || busyOp,
        action: () => { dialog.value = { type: 'discardAll' }; } },
      { label: 'Stash all changes', shortcut: 'Ctrl+Shift+S', disabled: !v.value.changes.length || busyOp || !current,
        action: () => stashAll() },
      { separator: true },
      { label: `Update from main`, shortcut: 'Ctrl+Shift+U', disabled: !ready || current === 'main' || busyOp
          || !v.value.branches.some(b => b.name === 'main'),
        action: () => doMerge('main') },
      { label: 'Compare to branch', shortcut: 'Ctrl+Shift+B', disabled: true },
      { label: 'Merge into current branch…', shortcut: 'Ctrl+Shift+M', disabled: !ready || !current || busyOp,
        action: () => { mergeOpen.value = true; } },
      { label: 'Squash and merge into current branch…', shortcut: 'Ctrl+Shift+H', disabled: true },
      { label: 'Rebase current branch…', shortcut: 'Ctrl+Shift+E', disabled: true },
      { separator: true },
      { label: 'Compare on GitHub', shortcut: 'Ctrl+Shift+C', disabled: true },
      { label: 'Create pull request', shortcut: 'Ctrl+R', disabled: true },
    ] },
    { label: 'Help', items: [
      { label: 'Report issue…', disabled: true }, { label: 'Contact GitHub support…', disabled: true },
      { label: 'Show User Guides', disabled: true }, { label: 'Show keyboard shortcuts', disabled: true },
      { separator: true }, { label: 'About GitHub Desktop', disabled: true },
    ] },
  ];
});

function stashAll() {
  const commands: string[] = [];
  if (branchStash.value) commands.push(cmd.stashDrop(branchStash.value.ref));
  commands.push(cmd.stashLeave(v.value.branch));
  run(commands, 'Stashed all changes').then(ok => { if (ok) selectedPath.value = '::stash'; });
}

function onKey(ev: KeyboardEvent) {
  if (!(ev.ctrlKey || ev.metaKey) || !v.value.initialised) return;
  const key = ev.key.toLowerCase();
  if (!ev.shiftKey && key === '1') { setTab('changes'); ev.preventDefault(); }
  else if (!ev.shiftKey && key === '2') { setTab('history'); ev.preventDefault(); }
  else if (!ev.shiftKey && key === 'b') { toggleDropdown('branch'); ev.preventDefault(); }
  else if (!ev.shiftKey && key === 't') { toggleDropdown('repo'); ev.preventDefault(); }
  else if (ev.shiftKey && key === 'n') { toolbarAct.newBranch(''); ev.preventDefault(); }
  else if (ev.shiftKey && key === 'm') { mergeOpen.value = true; ev.preventDefault(); }
}

</script>

<style scoped>
.gd {
  --gd-toolbar: #24292e;
  --gd-toolbar-hover: #2f363d;
  --gd-text: #24292e;
  --gd-text-secondary: #6a737d;
  --gd-border: #e1e4e8;
  --gd-hover: #f6f8fa;
  --gd-selected: #ebeef1;
  --gd-blue: #0366d6;
  --gd-blue-hover: #0255b3;
  --gd-green: #22863a;
  --gd-red: #d73a49;
  --gd-modified: #b08800;
  --gd-conflicted: #c24e00;
  --gd-sans: system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
  --gd-mono: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
  position: relative; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden;
  background: #fff; color: var(--gd-text); font-family: var(--gd-sans); font-size: 12px; line-height: 1.4;
  outline: none; color-scheme: light;
}
/* The platform's global element styles must not leak into the product.
   `:where(.gd) :deep(x)` compiles to `:where(.gd)[data-v] x` = (0,1,1): above the
   global element rules (0,0,1), below every class rule in this skin (0,2,0). */
:where(.gd) :deep(button) {
  font: inherit; font-weight: 400; letter-spacing: normal; text-transform: none; margin: 0; min-height: 0;
  min-width: 0; border-radius: 0; box-shadow: none; text-shadow: none; transition: none; color: inherit;
  line-height: inherit;
}
:where(.gd) :deep(input), :where(.gd) :deep(textarea), :where(.gd) :deep(select) {
  font: inherit; letter-spacing: normal; margin: 0; min-height: 0; border-radius: 3px; color: var(--gd-text);
  caret-color: var(--gd-text); accent-color: var(--gd-blue); box-shadow: none; transition: none;
}
:where(.gd) :deep(pre), :where(.gd) :deep(code), :where(.gd) :deep(kbd) {
  color: inherit; background-color: transparent; border-radius: 0; font-size: inherit; font-family: var(--gd-mono);
}
:where(.gd) :deep(h1), :where(.gd) :deep(h2), :where(.gd) :deep(h3), :where(.gd) :deep(h4) {
  letter-spacing: normal; text-wrap: wrap; color: inherit;
}
:where(.gd) :deep(a) { color: var(--gd-blue); }
.gd :deep(::placeholder) { color: #959da5; opacity: 1; }
.gd :deep(*), .gd :deep(*::before), .gd :deep(*::after) { box-sizing: border-box; }

/* Desktop's buttons: shared by every child component. */
.gd :deep(.gd-btn) {
  display: inline-flex; align-items: center; gap: 4px; height: 25px; padding: 0 10px; font-size: 12px; font-weight: 400;
  border: 1px solid rgba(27, 31, 35, 0.2); border-radius: 3px; background: #fafbfc; color: var(--gd-text);
  cursor: default; white-space: nowrap; line-height: 1;
}
.gd :deep(.gd-btn:hover:not(:disabled)) { background: #f3f4f6; }
.gd :deep(.gd-btn:focus-visible) { outline: none; box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3); }
.gd :deep(.gd-btn:disabled) { opacity: 0.6; }
.gd :deep(.gd-btn--primary) { background: var(--gd-blue); border-color: rgba(27, 31, 35, 0.15); color: #fff; }
.gd :deep(.gd-btn--primary:hover:not(:disabled)) { background: var(--gd-blue-hover); }
.gd :deep(.gd-btn--danger) { background: var(--gd-red); border-color: rgba(27, 31, 35, 0.15); color: #fff; }
.gd :deep(.gd-btn--danger:hover:not(:disabled)) { background: #cb2431; }

.gd-dropcatch { position: absolute; inset: 80px 0 0; z-index: 15; }
.gd-body { flex: 1; display: flex; min-height: 0; }
.gd-side {
  width: 250px; flex: none; display: flex; flex-direction: column; border-right: 1px solid var(--gd-border);
  min-height: 0; background: #fff;
}
.gd-side__none { padding: 16px; color: var(--gd-text-secondary); text-align: center; }
.gd-tabs { display: flex; flex: none; border-bottom: 1px solid var(--gd-border); }
.gd-tabs__tab {
  flex: 1; height: 33px; border: 0; border-radius: 0; font-weight: 400; background: #fff; color: var(--gd-text); font-size: 12px;
  border-bottom: 2px solid transparent; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  cursor: default;
}
.gd-tabs__tab + .gd-tabs__tab { border-left: 1px solid var(--gd-border); }
.gd-tabs__tab:hover:not(:disabled) { background: var(--gd-hover); }
.gd-tabs__tab.is-active { font-weight: 600; border-bottom-color: var(--gd-blue); }
.gd-tabs__tab:disabled { color: #a3aab1; }
.gd-tabs__count {
  min-width: 18px; padding: 0 5px; border-radius: 9px; background: rgba(27, 31, 35, 0.08); font-size: 11px;
  font-weight: 600; line-height: 16px;
}
.gd-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; background: #fff; }
.gd-main__pane { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.gd-main__pane > * { flex: 1; min-height: 0; }
.gd-main__empty { display: grid; place-items: center; color: var(--gd-text-secondary); }
.gd-banner {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 12px; flex: none;
  border-bottom: 1px solid;
}
.gd-banner--ok { background: #dcffe4; border-color: #a2e9b5; color: #144620; }
.gd-banner--ok > .gd-icon { color: var(--gd-green); }
.gd-banner--info { background: #f1f8ff; border-color: #c8e1ff; color: #032f62; }
.gd-banner--warn { background: #fffbdd; border-color: #f9c513; color: #735c0f; }
.gd-banner > span { flex: 1; min-width: 0; }
.gd-banner__link { border: 0; background: none; color: var(--gd-blue); font-size: 12px; padding: 0; cursor: pointer; }
.gd-banner__link:hover { text-decoration: underline; }
.gd-banner__x { border: 0; background: none; color: inherit; padding: 2px; display: inline-flex; opacity: 0.7; cursor: pointer; }

@container sl-portal (max-width: 900px) {
  .gd-side { width: 220px; }
}
@container sl-portal (max-width: 700px) {
  /* Narrow: the sidebar stacks above the diff and the BODY scrolls, so neither
     the file list nor the commit box is squeezed to a sliver. */
  .gd-body { flex-direction: column; overflow-y: auto; overflow-x: hidden; }
  .gd-side { width: auto; height: auto; flex: none; border-right: 0; border-bottom: 1px solid var(--gd-border); }
  .gd-main { flex: none; min-height: 420px; }
  .gd-dropcatch { inset: 80px 0 0; }
}
</style>
