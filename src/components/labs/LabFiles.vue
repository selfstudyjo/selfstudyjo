<template>
  <div class="sl-files">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <FolderTree class="sl-i" />
        <span>{{ $t('Files') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--primary sl-btn--sm"
                :disabled="saving || !path || dirty === false" @click="save">
          <Save class="sl-i" /> {{ $t('Save') }}
        </button>
      </div>
    </div>

    <p class="sl-console__fidelity">
      {{ $t('These files are what every tool in this lab sees. Write a Dockerfile, a manifest or a .tf file here and run it in the console.') }}
    </p>

    <div class="sl-files__body">
      <!-- ── the explorer ──────────────────────────────────────────────── -->
      <aside class="sl-tree" @contextmenu.prevent="openMenu($event, null)">
        <div class="sl-tree__bar">
          <span class="sl-tree__heading">{{ $t('Explorer') }}</span>
          <div class="sl-tree__icons">
            <button type="button" class="sl-tree__icon" :title="$t('New File')"
                    :aria-label="$t('New File')" @click="startCreate('file', '')">
              <FilePlus class="sl-i" />
            </button>
            <button type="button" class="sl-tree__icon" :title="$t('New Folder')"
                    :aria-label="$t('New Folder')" @click="startCreate('folder', '')">
              <FolderPlus class="sl-i" />
            </button>
            <button type="button" class="sl-tree__icon" :title="$t('Collapse All')"
                    :aria-label="$t('Collapse All')" @click="collapseAll">
              <ChevronsDownUp class="sl-i" />
            </button>
            <button type="button" class="sl-tree__icon" :title="$t('Refresh')"
                    :aria-label="$t('Refresh')" @click="refresh">
              <RotateCw class="sl-i" />
            </button>
          </div>
        </div>

        <div class="sl-tree__filter">
          <Search class="sl-i" />
          <input
            v-model="query"
            class="sl-tree__search"
            dir="ltr"
            spellcheck="false"
            :placeholder="$t('Filter files')"
            :aria-label="$t('Filter files')"
          >
        </div>

        <!--
          THE ROOT IS A DROP TARGET, and it has to be. Dragging a file OUT of a
          folder needs somewhere to drop it, and the tree's own background is
          the only thing that means "the top level".
        -->
        <div
          class="sl-tree__rows"
          :class="{ 'is-drop': dropTarget === ''}"
          @dragover.prevent="hoverRoot"
          @dragleave="dropTarget = null"
          @drop.prevent="dropOn('')"
        >
          <p v-if="!rows.length" class="sl-tree__empty">
            {{ query ? $t('Nothing matches that') : $t('No files yet') }}
          </p>

          <div
            v-for="row in rows"
            :key="row.path"
            class="sl-tree__row"
            :class="{
              'is-active': row.path === path,
              'is-folder': row.kind === 'folder',
              'is-drop': dropTarget === row.path,
              'is-cut': moving === row.path,
            }"
            :style="{ '--sl-depth': row.depth }"
            :draggable="renaming !== row.path"
            :title="row.path"
            role="button"
            tabindex="0"
            @click="activate(row)"
            @keydown.enter.prevent="activate(row)"
            @keydown.f2.prevent="startRename(row)"
            @keydown.delete.prevent="confirmDelete(row)"
            @contextmenu.prevent.stop="openMenu($event, row)"
            @dragstart="beginDrag(row, $event)"
            @dragend="endDrag"
            @dragover.prevent.stop="hoverRow(row)"
            @drop.prevent.stop="dropOnRow(row)"
          >
            <span class="sl-tree__twist" aria-hidden="true">
              <ChevronRight v-if="row.hasChildren && !row.expanded"
                            class="sl-i sl-i--tiny" />
              <ChevronDown v-else-if="row.hasChildren" class="sl-i sl-i--tiny" />
            </span>
            <component :is="glyph(row)" class="sl-i sl-i--tiny sl-tree__glyph"
                       aria-hidden="true" />
            <!--
              The rename box replaces the LABEL, not the row, so the row keeps
              its indent, its icon and its place in the list while it is being
              typed into — which is what stops the tree jumping under the caret.
            -->
            <input
              v-if="renaming === row.path"
              ref="renameBox"
              v-model="draft"
              class="sl-tree__rename"
              dir="ltr"
              spellcheck="false"
              @click.stop
              @keydown.enter.prevent="commitRename"
              @keydown.esc.prevent="cancelEdit"
              @blur="commitRename"
            >
            <span v-else class="sl-tree__name" dir="ltr">{{ row.name }}</span>
            <span v-if="row.kind === 'file' && renaming !== row.path"
                  class="sl-tree__size">{{ human(row.bytes) }}</span>
          </div>

          <!--
            The new-name box is a ROW in the tree at the depth it will land at,
            the way an editor does it, rather than a dialog. A student typing a
            name can see which folder it is going into.
          -->
          <div v-if="creating" class="sl-tree__row is-new"
               :style="{ '--sl-depth': createDepth }">
            <span class="sl-tree__twist" aria-hidden="true"></span>
            <component :is="creating === 'folder' ? Folder : File"
                       class="sl-i sl-i--tiny sl-tree__glyph" aria-hidden="true" />
            <input
              ref="createBox"
              v-model="draft"
              class="sl-tree__rename"
              dir="ltr"
              spellcheck="false"
              :placeholder="creating === 'folder' ? $t('folder name') : $t('file name')"
              @keydown.enter.prevent="commitCreate"
              @keydown.esc.prevent="cancelEdit"
              @blur="commitCreate"
            >
          </div>
        </div>

        <p v-if="treeNote" class="sl-tree__note">{{ treeNote }}</p>
      </aside>

      <!-- ── the editor ────────────────────────────────────────────────── -->
      <div class="sl-files__editor">
        <div v-if="path" class="sl-files__tabrow">
          <span class="sl-files__tab" dir="ltr">
            <component :is="glyph({ path, kind: 'file' })" class="sl-i sl-i--tiny"
                       aria-hidden="true" />
            <span class="sl-files__tabname">{{ path }}</span>
            <span v-if="dirty" class="sl-files__dot" :title="$t('Unsaved changes')">•</span>
          </span>
          <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                  @click="startRename({ path, name: baseName(path), kind: 'file' })">
            <PenLine class="sl-i" /> {{ $t('Rename') }}
          </button>
          <button type="button" class="sl-btn sl-btn--danger sl-btn--sm"
                  :aria-label="$t('Delete')"
                  @click="confirmDelete({ path, name: baseName(path), kind: 'file' })">
            <Trash2 class="sl-i" />
          </button>
        </div>
        <p v-else class="sl-files__nofile">
          {{ $t('Pick a file on the left, or make one with New File.') }}
        </p>

        <!-- LTR: these are Dockerfiles, YAML manifests and HCL. Mirrored, the
             indentation reads from the wrong side and YAML stops being valid. -->
        <textarea
          v-model="content"
          class="sl-files__text"
          dir="ltr"
          spellcheck="false"
          rows="18"
          :disabled="!path"
          :aria-label="$t('File contents')"
          @keydown.tab.prevent="indent"
          @keydown.ctrl.s.prevent="save"
          @keydown.meta.s.prevent="save"
        ></textarea>
        <p v-if="message" class="sl-files__msg" :class="{ 'is-error': failed }">
          {{ message }}
        </p>
      </div>
    </div>

    <!--
      ONE menu, positioned in the pane rather than in the document.

      `position: fixed` would put it above the sidebar on every galaxy and
      leave it behind when the pane scrolls; the pane is the containing block,
      which is also why `.sl-files` is `position: relative`.
    -->
    <div
      v-if="menu"
      ref="menuBox"
      class="sl-menu"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      role="menu"
      @click.stop
    >
      <p class="sl-menu__where" dir="ltr">{{ menu.row?.path || $t('Top level') }}</p>
      <!--
        EVERY ITEM TAKES ITS TARGET AS AN ARGUMENT, and that is a fix rather
        than a style. These handlers used to close over `menu` and read
        `menu!.row!` when they ran - and `fromMenu` clears `menu` before running
        the action, so by then the row was null and every item acted on nothing.
        New File landed at the top level instead of inside the folder that was
        right-clicked, and Rename, Cut, Duplicate and Delete did nothing at all.
        Nothing threw: the optional chain and the `void action()` swallowed it,
        and the menu closed exactly as it should. Found by DRIVING the pane in
        `tools/labs-preview/shoot.mjs`, which is what that harness is for.
      -->
      <button type="button" class="sl-menu__item" role="menuitem"
              @click="fromMenu((_row, folder) => startCreate('file', folder))">
        <FilePlus class="sl-i sl-i--tiny" /> {{ $t('New File') }}
      </button>
      <button type="button" class="sl-menu__item" role="menuitem"
              @click="fromMenu((_row, folder) => startCreate('folder', folder))">
        <FolderPlus class="sl-i sl-i--tiny" /> {{ $t('New Folder') }}
      </button>
      <template v-if="menu.row">
        <hr class="sl-menu__rule">
        <button type="button" class="sl-menu__item" role="menuitem"
                @click="fromMenu(row => row && startRename(row))">
          <PenLine class="sl-i sl-i--tiny" /> {{ $t('Rename') }}
        </button>
        <button v-if="menu.row.kind === 'file'" type="button" class="sl-menu__item"
                role="menuitem" @click="fromMenu(row => row && duplicate(row))">
          <Copy class="sl-i sl-i--tiny" /> {{ $t('Duplicate') }}
        </button>
        <button type="button" class="sl-menu__item" role="menuitem"
                @click="fromMenu(row => row && cut(row))">
          <Scissors class="sl-i sl-i--tiny" /> {{ $t('Cut') }}
        </button>
        <button v-if="moving && menu.row.kind === 'folder'" type="button"
                class="sl-menu__item" role="menuitem"
                @click="fromMenu(row => row && paste(row.path))">
          <ClipboardPaste class="sl-i sl-i--tiny" /> {{ $t('Paste here') }}
        </button>
        <hr class="sl-menu__rule">
        <button type="button" class="sl-menu__item is-danger" role="menuitem"
                @click="fromMenu(row => row && confirmDelete(row))">
          <Trash2 class="sl-i sl-i--tiny" /> {{ $t('Delete') }}
        </button>
      </template>
      <template v-else-if="moving">
        <hr class="sl-menu__rule">
        <button type="button" class="sl-menu__item" role="menuitem"
                @click="fromMenu(() => paste(''))">
          <ClipboardPaste class="sl-i sl-i--tiny" /> {{ $t('Paste here') }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Files tool: one filesystem, shared by every engine in the lab, drawn as
 * an explorer.
 *
 * That sharing is the whole reason this exists as a tool rather than as a text
 * box inside each console. A student writes `docker-compose.yml` here and runs
 * `docker compose up`; writes `deployment.yaml` and runs `kubectl apply -f`;
 * writes `main.tf` and runs `terraform init`. The backend keeps ONE `files`
 * dict, one `dirs` list and one `modes` map, and injects all three into
 * whichever engine is about to run — see `utils/labenv.py` and `utils/labfs.py`.
 *
 * It was a flat list of full paths and a text box until 2026-09-05, and the
 * difference is not decoration: half the labs on this platform ship a project
 * — `src/`, `modules/`, `templates/`, `.claude/settings.json` — and a flat list
 * of twenty-eight paths is not a project structure, it is twenty-eight strings.
 * A student could not make a folder at all, could not rename anything, and
 * deleting meant selecting a file and finding the bin next to the path box.
 *
 * **Every decision is in `src/utils/fileTree.ts`**, a plain module with
 * `npm run check:labs` over it, on the `photoMask.ts` / `labTerminal.ts`
 * precedent. This file is the DOM half: it drags, it draws, it asks, and it
 * decides nothing about what a move means.
 *
 * Four things in here are load-bearing and easy to undo:
 *
 *  * **NOTHING REACHES `v-html`.** A file name and a file's contents are
 *    student input and arrive over the network, and this page holds a session
 *    token. Working rule 13, asserted by `check:labs` over this file.
 *  * **A DROP IS REFUSED WHILE HOVERING, not on release.** `planDrop` answers
 *    before the pointer is let go, so an illegal target never highlights — a
 *    student who can drop something has been told the drop is allowed.
 *  * **THE EXPANSION SET IS CARRIED THROUGH A MOVE** (`remapExpanded`), or
 *    renaming an open folder collapses it and everything under it, which reads
 *    as the rename having emptied the folder.
 *  * **A DIRTY BUFFER IS NEVER DISCARDED SILENTLY.** Clicking another file with
 *    unsaved changes asks. The console can write a file underneath us at any
 *    time (every console is a shell), so `refresh` re-reads the LIST and leaves
 *    the open buffer alone unless the file has gone.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  Braces,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ClipboardPaste,
  Code,
  Copy,
  Database,
  File,
  FileCode,
  FileImage,
  FileJson,
  FileLock,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Palette,
  PenLine,
  RotateCw,
  Save,
  Scissors,
  Search,
  Settings,
  Terminal,
  Trash2,
} from 'lucide-vue-next';

import {
  ancestorsOf,
  basename,
  buildTree,
  deleteQuestion,
  dirname,
  flatten,
  humanBytes,
  iconFor,
  isFolder,
  joinPath,
  matchTree,
  pathProblem,
  planDrop,
  planRename,
  remapExpanded,
  type FileEntry,
  type IconName,
  type NodeKind,
  type Row,
} from '@/utils/fileTree';

interface Listing { files: FileEntry[]; dirs: string[] }
type Result = { ok: boolean; error?: string };

const props = defineProps<{
  /** Kept for the callers that only want the files — the tree prefers `tree`. */
  list: () => Promise<FileEntry[]>;
  tree?: () => Promise<Listing>;
  read: (path: string) => Promise<string>;
  write: (path: string, content: string) => Promise<Result>;
  remove?: (path: string, recursive?: boolean) => Promise<Result>;
  mkdir?: (path: string) => Promise<Result>;
  move?: (path: string, to: string) => Promise<Result>;
}>();

const emit = defineEmits<{ (event: 'changed'): void }>();

const files = ref<FileEntry[]>([]);
const dirs = ref<string[]>([]);
const expanded = ref(new Set<string>());
const query = ref('');

const path = ref('');
const content = ref('');
const saved = ref('');
const message = ref('');
const failed = ref(false);
const saving = ref(false);
const treeNote = ref('');

const renaming = ref('');
const creating = ref<'' | 'file' | 'folder'>('');
const createIn = ref('');
const draft = ref('');
const renameBox = ref<any>(null);
const createBox = ref<HTMLInputElement | null>(null);

const dragging = ref('');
const dropTarget = ref<string | null>(null);
const moving = ref('');

const menu = ref<{ x: number; y: number; row: Row | null } | null>(null);
const menuBox = ref<HTMLElement | null>(null);

const dirty = computed(() => Boolean(path.value) && content.value !== saved.value);

const rows = computed<Row[]>(() => {
  const tree = matchTree(buildTree(files.value, dirs.value), query.value);
  // A FILTER SHOWS EVERYTHING IT MATCHED, whatever is collapsed. Filtering and
  // then hiding the hits inside a closed folder is a search box that answers
  // "nothing matches" about a file that is plainly there.
  const open = query.value.trim()
    ? new Set([...expanded.value, ...allFolders(tree)])
    : expanded.value;
  return flatten(tree, open);
});

const createDepth = computed(() => (createIn.value
  ? createIn.value.split('/').length
  : 0));

/* ── loading ───────────────────────────────────────────────────────────── */

async function refresh() {
  const listing = props.tree
    ? await props.tree()
    : { files: await props.list(), dirs: [] };
  files.value = listing.files || [];
  dirs.value = listing.dirs || [];
  // The first load opens the folders that lead to something, so a lab that
  // seeds `src/main.tf` does not open on one closed row.
  if (!expanded.value.size) {
    const open = new Set<string>();
    for (const entry of files.value) {
      for (const parent of ancestorsOf(entry.path)) open.add(parent);
    }
    expanded.value = open;
  }
  if (!path.value) {
    const first = files.value.find(entry => !entry.path.includes('/'))
      || files.value[0];
    if (first) await open(first.path);
    return;
  }
  // THE OPEN BUFFER IS NOT RE-READ. Any console in this lab is a shell, so
  // `echo x > f` and `nano f` land here at any moment and `refresh` runs after
  // every command — re-reading would throw away whatever the student had typed,
  // which is the bug `refreshViews` on the workspace already had to be taught.
  if (!files.value.some(entry => entry.path === path.value)) {
    path.value = '';
    content.value = '';
    saved.value = '';
  }
}

async function open(target: string) {
  if (dirty.value && !window.confirm(
    `${basename(path.value)} has unsaved changes. Discard them?`)) return;
  path.value = target;
  message.value = '';
  failed.value = false;
  const text = await props.read(target);
  content.value = text;
  saved.value = text;
}

function activate(row: Pick<Row, 'path' | 'kind'>) {
  if (renaming.value) return;
  if (row.kind === 'folder') {
    toggle(row.path);
    return;
  }
  if (row.path !== path.value) open(row.path);
}

function toggle(folder: string) {
  const next = new Set(expanded.value);
  if (next.has(folder)) next.delete(folder);
  else next.add(folder);
  expanded.value = next;
}

function collapseAll() {
  expanded.value = new Set();
}

function allFolders(nodes: ReturnType<typeof buildTree>): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.kind !== 'folder') continue;
    out.push(node.path);
    out.push(...allFolders(node.children));
  }
  return out;
}

/* ── saving ────────────────────────────────────────────────────────────── */

async function save() {
  const target = path.value.trim();
  if (!target) return;
  saving.value = true;
  message.value = '';
  failed.value = false;
  try {
    const result = await props.write(target, content.value);
    if (result?.ok) {
      message.value = 'Saved';
      saved.value = content.value;
      await refresh();
      emit('changed');
    } else {
      failed.value = true;
      message.value = result?.error || 'That file could not be saved';
    }
  } finally {
    saving.value = false;
  }
}

function indent(event: KeyboardEvent) {
  const field = event.target as HTMLTextAreaElement;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  content.value = content.value.slice(0, start) + '  ' + content.value.slice(end);
  requestAnimationFrame(() => {
    field.selectionStart = field.selectionEnd = start + 2;
  });
}

/* ── creating ──────────────────────────────────────────────────────────── */

function startCreate(kind: 'file' | 'folder', folder: string) {
  cancelEdit();
  creating.value = kind;
  createIn.value = folder;
  draft.value = '';
  if (folder) expanded.value = new Set([...expanded.value, folder,
                                        ...ancestorsOf(folder)]);
  nextTick(() => createBox.value?.focus());
}

async function commitCreate() {
  const kind = creating.value;
  const name = draft.value.trim();
  if (!kind) return;
  creating.value = '';
  draft.value = '';
  if (!name) return;
  const target = joinPath(createIn.value, name);
  const problem = pathProblem(target);
  if (problem) {
    say(problem, true);
    return;
  }
  if (kind === 'folder') {
    if (!props.mkdir) {
      say('This lab cannot create folders', true);
      return;
    }
    const result = await props.mkdir(target);
    if (!result?.ok) {
      say(result?.error || 'That folder could not be created', true);
      return;
    }
    expanded.value = new Set([...expanded.value, target, ...ancestorsOf(target)]);
  } else {
    // A NEW FILE IS WRITTEN EMPTY RATHER THAN HELD IN THE BROWSER, because a
    // file that exists only in this tab is one the console cannot see — and the
    // first thing a student does with a new `main.tf` is run something against
    // it.
    const result = await props.write(target, '');
    if (!result?.ok) {
      say(result?.error || 'That file could not be created', true);
      return;
    }
    expanded.value = new Set([...expanded.value, ...ancestorsOf(target)]);
  }
  await refresh();
  emit('changed');
  if (kind === 'file') {
    path.value = target;
    content.value = '';
    saved.value = '';
  }
  say(kind === 'folder' ? `Created ${target}` : `Created ${target}`);
}

/* ── renaming ──────────────────────────────────────────────────────────── */

function startRename(row: Pick<Row, 'path' | 'name' | 'kind'>) {
  cancelEdit();
  renaming.value = row.path;
  draft.value = row.name;
  nextTick(() => {
    const box = Array.isArray(renameBox.value) ? renameBox.value[0] : renameBox.value;
    box?.focus?.();
    box?.select?.();
  });
}

async function commitRename() {
  const from = renaming.value;
  const name = draft.value.trim();
  renaming.value = '';
  draft.value = '';
  if (!from || !name || name === basename(from)) return;
  const plan = planRename(from, name, files.value, dirs.value);
  if (plan.problem) {
    say(plan.problem, true);
    return;
  }
  if (plan.noop) return;
  await applyMove(from, plan.to);
}

function cancelEdit() {
  renaming.value = '';
  creating.value = '';
  draft.value = '';
}

/* ── moving ────────────────────────────────────────────────────────────── */

async function applyMove(from: string, to: string) {
  if (!props.move) {
    say('This lab cannot move files', true);
    return;
  }
  const result = await props.move(from, to);
  if (!result?.ok) {
    say(result?.error || 'That could not be moved', true);
    return;
  }
  expanded.value = remapExpanded(expanded.value, from, to);
  // The open buffer follows its own file, or a rename reads as having closed it.
  if (path.value === from) path.value = to;
  else if (path.value.startsWith(`${from}/`)) {
    path.value = to + path.value.slice(from.length);
  }
  if (moving.value === from) moving.value = '';
  await refresh();
  emit('changed');
  say(`Moved to ${to}`);
}

function beginDrag(row: Row, event: DragEvent) {
  dragging.value = row.path;
  // `text/plain` as well as our own type, so dragging a path into the console or
  // the editor pastes it — and `effectAllowed` so the cursor says "move".
  event.dataTransfer?.setData('text/plain', row.path);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function endDrag() {
  dragging.value = '';
  dropTarget.value = null;
}

function hoverRoot() {
  if (!dragging.value) return;
  const plan = planDrop(dragging.value, '', files.value, dirs.value);
  dropTarget.value = plan.problem || plan.noop ? null : '';
}

function hoverRow(row: Row) {
  if (!dragging.value) return;
  const folder = row.kind === 'folder' ? row.path : dirname(row.path);
  const plan = planDrop(dragging.value, folder, files.value, dirs.value);
  // REFUSED WHILE HOVERING. A target that cannot take the drop never
  // highlights, so nothing is reported after the fact — see the header.
  dropTarget.value = plan.problem || plan.noop ? null : row.path;
}

async function dropOnRow(row: Row) {
  const folder = row.kind === 'folder' ? row.path : dirname(row.path);
  await dropOn(folder);
}

async function dropOn(folder: string) {
  const from = dragging.value;
  endDrag();
  if (!from) return;
  const plan = planDrop(from, folder, files.value, dirs.value);
  if (plan.noop) return;
  if (plan.problem) {
    say(plan.problem, true);
    return;
  }
  if (folder) expanded.value = new Set([...expanded.value, folder]);
  await applyMove(from, plan.to);
}

function cut(row: Row) {
  moving.value = row.path;
  say(`${row.path} — pick a folder and choose Paste here`);
}

async function paste(folder: string) {
  const from = moving.value;
  if (!from) return;
  const plan = planDrop(from, folder, files.value, dirs.value);
  if (plan.noop) {
    moving.value = '';
    return;
  }
  if (plan.problem) {
    say(plan.problem, true);
    return;
  }
  await applyMove(from, plan.to);
}

/* ── duplicating and deleting ──────────────────────────────────────────── */

async function duplicate(row: Row) {
  const name = basename(row.path);
  const cut = name.lastIndexOf('.');
  const stem = cut > 0 ? name.slice(0, cut) : name;
  const tail = cut > 0 ? name.slice(cut) : '';
  let target = joinPath(dirname(row.path), `${stem}-copy${tail}`);
  let index = 2;
  while (files.value.some(entry => entry.path === target)) {
    target = joinPath(dirname(row.path), `${stem}-copy${index}${tail}`);
    index += 1;
  }
  const text = await props.read(row.path);
  const result = await props.write(target, text);
  if (!result?.ok) {
    say(result?.error || 'That file could not be copied', true);
    return;
  }
  await refresh();
  emit('changed');
  say(`Copied to ${target}`);
}

async function confirmDelete(row: Pick<Row, 'path' | 'name' | 'kind'>) {
  if (!props.remove) return;
  if (!window.confirm(deleteQuestion(row.path, row.kind, files.value))) return;
  const recursive = row.kind === 'folder';
  const result = await props.remove(row.path, recursive);
  if (!result?.ok) {
    say(result?.error || 'That could not be deleted', true);
    return;
  }
  if (path.value === row.path || path.value.startsWith(`${row.path}/`)) {
    path.value = '';
    content.value = '';
    saved.value = '';
  }
  if (moving.value === row.path) moving.value = '';
  await refresh();
  emit('changed');
  say(`Deleted ${row.path}`);
}

/* ── the context menu ──────────────────────────────────────────────────── */

function openMenu(event: MouseEvent, row: Row | null) {
  const host = (event.currentTarget as HTMLElement)
    .closest('.sl-files') as HTMLElement | null;
  const box = host?.getBoundingClientRect();
  menu.value = {
    x: Math.max(0, event.clientX - (box?.left ?? 0)),
    y: Math.max(0, event.clientY - (box?.top ?? 0)),
    row,
  };
  if (row && row.kind === 'file' && row.path !== path.value) activate(row);
}

/**
 * Run a menu action against the row the menu was opened on.
 *
 * THE TARGET IS RESOLVED BEFORE THE MENU IS CLOSED. Reading `menu.value` inside
 * the action is the bug this signature exists to make impossible: closing is
 * what a menu item does first, so an action that reads the row afterwards reads
 * null — and then does nothing, quietly, with the menu closing exactly as it
 * should. `folder` is the row's own path for a folder and its parent for a
 * file, so New File inside a right-clicked folder lands there.
 */
function fromMenu(action: (row: Row | null, folder: string) => void | Promise<void>) {
  const row = menu.value?.row ?? null;
  const folder = row ? (row.kind === 'folder' ? row.path : dirname(row.path)) : '';
  menu.value = null;
  void action(row, folder);
}

function closeMenu(event: Event) {
  if (!menu.value) return;
  const target = event.target as Node;
  if (menuBox.value?.contains(target)) return;
  menu.value = null;
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') menu.value = null;
}

/* ── odds and ends ─────────────────────────────────────────────────────── */

const GLYPHS: Record<IconName, unknown> = {
  file: File,
  code: FileCode,
  markup: Code,
  style: Palette,
  data: FileJson,
  config: Settings,
  shell: Terminal,
  database: Database,
  image: FileImage,
  doc: FileText,
  lock: FileLock,
  terraform: Braces,
};

function glyph(row: { path: string; kind: NodeKind }) {
  if (row.kind === 'folder') {
    // An OPEN folder, not a tree glyph: the pane's own heading is the tree, and
    // the same picture in both places says nothing about the row's state.
    return row.path && expanded.value.has(row.path) ? FolderOpen : Folder;
  }
  return GLYPHS[iconFor(row.path, row.kind)] || File;
}

const human = humanBytes;
const baseName = basename;

function say(text: string, bad = false) {
  treeNote.value = text;
  if (bad) {
    failed.value = true;
    message.value = text;
  }
  window.setTimeout(() => {
    if (treeNote.value === text) treeNote.value = '';
  }, 6000);
}

defineExpose({ refresh });

onMounted(() => {
  refresh();
  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu);
  document.removeEventListener('keydown', onKey);
});

// A folder that stops being a folder must stop being expanded, or its row is
// gone and the set grows for the life of the tab.
watch([files, dirs], () => {
  if (!expanded.value.size) return;
  const live = new Set<string>();
  for (const folder of expanded.value) {
    if (isFolder(folder, files.value, dirs.value)) live.add(folder);
  }
  if (live.size !== expanded.value.size) expanded.value = live;
});

// `remove` is a prop name AND a handler name elsewhere in this file; the local
// aliases above keep the template unambiguous.
</script>
