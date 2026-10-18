<template>
  <div class="fx-page wp" @click="menu = null">
    <!-- Header: icon, name, description, the workspace-level actions -->
    <div class="wp-head">
      <span class="wp-icon"><FxIcon name="Workspace" :size="40" /></span>
      <div class="wp-title">
        <h1 class="fx-page__title">{{ wsName }}</h1>
        <div class="fx-page__sub">{{ ws?.description || 'No description' }}</div>
      </div>
      <span class="fx-cmdbar__grow" />
      <div class="wp-headbtns">
        <button v-if="ws?.git" type="button" class="fx-btn" @click="panel = 'git'">
          <FxIcon name="git" />Source control
          <span v-if="pendingGit" class="fx-pill fx-pill--brand">{{ pendingGit }}</span>
        </button>
        <button type="button" class="fx-btn" @click="panel = 'access'"><FxIcon name="people" />Manage access</button>
        <button type="button" class="fx-btn" @click="panel = 'settings'"><FxIcon name="settings" />Workspace settings</button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="fx-cmdbar wp-toolbar">
      <button type="button" class="fx-btn fx-btn--primary" @click="newItem = true"><FxIcon name="plus" />New item</button>
      <button type="button" class="fx-cmd" @click="openFolderDialog"><FxIcon name="folderAdd" />New folder</button>
      <button type="button" class="fx-cmd" @click="panel = 'git'"><FxIcon name="git" />{{ ws?.git ? 'Branch' : 'Git integration' }}</button>
      <button type="button" class="fx-cmd" :disabled="!selected.length" @click="bulkDelete"><FxIcon name="delete" />Delete</button>
      <span class="fx-cmdbar__grow" />
      <div class="fx-input fx-input--search wp-filter">
        <FxIcon name="filter" :size="14" />
        <input v-model="filter" placeholder="Filter by keyword" aria-label="Filter by keyword" />
      </div>
      <select v-model="typeFilter" class="fx-select wp-type" aria-label="Filter by type">
        <option value="">All types</option>
        <option v-for="t in presentTypes" :key="t" :value="t">{{ typeLabel(t) }}</option>
      </select>
      <div class="wp-views" role="tablist">
        <button type="button" class="fx-iconbtn" :class="{ 'is-on': mode === 'list' }" title="List view"
                @click="mode = 'list'"><FxIcon name="list" /></button>
        <button type="button" class="fx-iconbtn" :class="{ 'is-on': mode === 'lineage' }" title="Lineage view"
                @click="mode = 'lineage'"><FxIcon name="lineage" /></button>
      </div>
    </div>

    <nav v-if="folder" class="fx-breadcrumb wp-crumb" aria-label="Folder path">
      <button type="button" @click="openFolder('')">{{ wsName }}</button>
      <template v-for="(part, i) in folderParts" :key="i">
        <FxIcon name="chevronRight" :size="12" />
        <button type="button" :class="{ 'is-current': i === folderParts.length - 1 }"
                @click="openFolder(folderParts.slice(0, i + 1).join('/'))">{{ part }}</button>
      </template>
    </nav>

    <!-- List view -->
    <div v-if="mode === 'list'" class="fx-page__scroll fx-tablewrap">
      <table class="fx-table wp-table">
        <thead>
          <tr>
            <th class="wp-cb"><input type="checkbox" :checked="allSelected" aria-label="Select all" @change="toggleAll" /></th>
            <th v-for="col in columns" :key="col.key">
              <button type="button" class="wp-sort" @click="sortOn(col.key)">{{ col.label }}
                <span v-if="sortKey === col.key">{{ sortDir === 'asc' ? '↑' : '↓' }}</span></button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.key" :class="{ 'is-selected': selected.includes(row.key) }">
            <td class="wp-cb"><input v-if="row.kind !== 'endpoint'" type="checkbox" :checked="selected.includes(row.key)"
                                     :aria-label="'Select ' + row.name" @change="toggle(row.key)" /></td>
            <td>
              <span class="fx-cellname" :class="{ 'wp-child': row.kind === 'endpoint' }">
                <FxIcon :name="row.icon" :size="20" />
                <button type="button" @click="openRow(row)">{{ row.name }}</button>
                <button type="button" class="fx-iconbtn wp-more" :aria-label="'More options for ' + row.name"
                        @click.stop="openMenu(row, $event)"><FxIcon name="more" /></button>
              </span>
            </td>
            <td>{{ row.typeLabel }}</td>
            <td class="fx-muted">{{ row.task }}</td>
            <td><span v-if="row.owner" class="wp-owner"><span class="fx-avatar" :style="{ background: avatarColor(row.owner) }">{{ initials(row.owner) }}</span>{{ ownerName }}</span></td>
            <td class="fx-muted">{{ row.refreshed }}</td>
            <td class="fx-muted">{{ row.next }}</td>
            <td><span v-if="row.endorsement" class="fx-pill" :class="row.endorsement === 'Certified' ? 'fx-pill--brand' : 'fx-pill--info'"><FxIcon name="badge" :size="12" />{{ row.endorsement }}</span></td>
            <td><span v-if="row.label" class="fx-label" :style="{ '--fx-label-color': labelColor(row.label) }">{{ row.label }}<span v-if="row.labelInherited" class="fx-muted"> (inherited)</span></span></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!tableRows.length" class="fx-empty">
        <FxIcon name="Folder" :size="48" />
        <h3>{{ filter || typeFilter ? 'No items match your filters' : 'There\'s nothing here yet' }}</h3>
        <p>Create an item or a folder to get started.</p>
        <button type="button" class="fx-btn fx-btn--primary" @click="newItem = true"><FxIcon name="plus" />New item</button>
      </div>
    </div>

    <!-- Lineage view -->
    <div v-else class="fx-page__scroll wp-lineage">
      <div v-for="col in lineageColumns" :key="col.title" class="wp-lcol">
        <div class="wp-lcol__title">{{ col.title }}</div>
        <div v-for="node in col.nodes" :key="node.label" class="wp-lnode" :title="node.label">
          <FxIcon :name="node.icon" :size="18" />
          <span>{{ node.label }}</span>
        </div>
      </div>
      <p v-if="!lineageEdges.length" class="fx-muted">No lineage recorded for this workspace yet.</p>
    </div>

    <!-- Row context menu -->
    <div v-if="menu" class="fx-menu" :style="{ top: menu.y + 'px', left: menu.x + 'px' }" @click.stop>
      <button type="button" @click="openRow(menu.row); menu = null"><FxIcon name="chevronRight" />Open</button>
      <template v-if="menu.row.kind === 'item'">
        <button v-if="runnable(menu.row.type)" type="button" @click="runItem(menu.row)">
          <FxIcon :name="menu.row.type === 'SemanticModel' ? 'refresh' : 'play'" />{{ menu.row.type === 'SemanticModel' ? 'Refresh now' : 'Run' }}</button>
        <button v-if="runnable(menu.row.type)" type="button" @click="openSettings(menu.row, 'schedule')"><FxIcon name="calendar" />Schedule</button>
        <button type="button" @click="openSettings(menu.row, 'about')"><FxIcon name="settings" />Settings</button>
        <button type="button" @click="openSettings(menu.row, 'share')"><FxIcon name="share" />Manage permissions</button>
        <hr />
        <button type="button" @click="startRename(menu.row)"><FxIcon name="edit" />Rename</button>
        <button type="button" @click="startMove(menu.row)"><FxIcon name="Folder" />Move to</button>
        <hr />
        <button type="button" class="is-danger" @click="confirmDelete([menu.row])"><FxIcon name="delete" />Delete</button>
      </template>
      <template v-else-if="menu.row.kind === 'folder'">
        <button type="button" @click="startRename(menu.row)"><FxIcon name="edit" />Rename</button>
        <button type="button" class="is-danger" @click="confirmDelete([menu.row])"><FxIcon name="delete" />Delete</button>
      </template>
    </div>

    <!-- Dialogs -->
    <FxModal v-if="dialog === 'folder'" title="New folder" @close="dialog = ''">
      <div v-if="dialogError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dialogError }}</div>
      <div class="fx-field">
        <label for="wp-folder">Name<span class="fx-field__req">*</span></label>
        <input id="wp-folder" v-model="dialogName" class="fx-input" placeholder="Folder name" @keydown.enter="createFolder" />
        <span class="fx-field__help">Folder names can't contain / \ " &lt; &gt; | ? * :</span>
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!dialogName.trim()" @click="createFolder">Create</button>
        <button type="button" class="fx-btn" @click="dialog = ''">Cancel</button>
      </template>
    </FxModal>

    <FxModal v-if="dialog === 'rename' && target" :title="'Rename ' + (target.kind === 'folder' ? 'folder' : target.typeLabel.toLowerCase())" @close="dialog = ''">
      <div v-if="dialogError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dialogError }}</div>
      <div class="fx-field">
        <label for="wp-rename">Name<span class="fx-field__req">*</span></label>
        <input id="wp-rename" v-model="dialogName" class="fx-input" @keydown.enter="doRename" />
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!dialogName.trim() || dialogName.trim() === target.name" @click="doRename">Rename</button>
        <button type="button" class="fx-btn" @click="dialog = ''">Cancel</button>
      </template>
    </FxModal>

    <FxModal v-if="dialog === 'move' && target" :title="'Move ' + target.name" @close="dialog = ''">
      <div v-if="dialogError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dialogError }}</div>
      <div class="fx-field">
        <span class="fx-field__label">Workspace</span>
        <select v-model="moveWs" class="fx-select" aria-label="Destination workspace">
          <option v-for="w in workspaces" :key="w.name" :value="w.name">{{ w.name }}</option>
        </select>
      </div>
      <div class="fx-field">
        <span class="fx-field__label">Folder</span>
        <select v-model="moveFolder" class="fx-select" aria-label="Destination folder">
          <option value="">(workspace root)</option>
          <option v-for="f in moveFolders" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" @click="doMove">Move</button>
        <button type="button" class="fx-btn" @click="dialog = ''">Cancel</button>
      </template>
    </FxModal>

    <FxModal v-if="dialog === 'delete'" :title="deleteTitle" @close="dialog = ''">
      <div v-if="dialogError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dialogError }}</div>
      <p class="wp-p">{{ deleteText }}</p>
      <ul v-if="pendingDelete.length > 1" class="wp-dellist">
        <li v-for="r in pendingDelete" :key="r.key"><FxIcon :name="r.icon" />{{ r.name }}</li>
      </ul>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--danger" @click="doDelete">Delete</button>
        <button type="button" class="fx-btn" @click="dialog = ''">Cancel</button>
      </template>
    </FxModal>

    <NewItemDialog v-if="newItem" :ws="wsName" :folder="folder" @close="newItem = false" @created="created" />
    <WorkspaceSettingsPanel v-if="panel === 'settings'" :ws="wsName" @close="panel = ''" />
    <ManageAccessPanel v-if="panel === 'access'" :ws="wsName" @close="panel = ''" />
    <SourceControlPanel v-if="panel === 'git'" :ws="wsName" @close="panel = ''" />
    <ItemSettingsPanel v-if="settingsFor" :item="settingsFor" :tab="settingsTab" @close="settingsFor = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxModal from './FxModal.vue';
import NewItemDialog from './NewItemDialog.vue';
import WorkspaceSettingsPanel from './WorkspaceSettingsPanel.vue';
import ManageAccessPanel from './ManageAccessPanel.vue';
import SourceControlPanel from './SourceControlPanel.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import {
  ITEM_TYPES, avatarColor, cli, displayName, errorText, folderPath, initials, itemPath, rows,
  typeLabel, useFabric,
} from './fabric';
import { matches, sortBy } from '@/utils/portalKit';

interface Row {
  key: string; kind: 'item' | 'folder' | 'endpoint'; name: string; type: string; icon: string;
  typeLabel: string; task: string; owner: string; refreshed: string; next: string;
  endorsement: string; label: string; labelInherited: boolean; folder: string; item?: any;
}

const { portal, view, route, go, run } = useFabric();
const wsName = computed(() => String(route.value.ws || ''));
const ws = computed(() => rows(portal.value, 'workspaces').find(w => w.name === wsName.value));
const workspaces = computed(() => rows(portal.value, 'workspaces'));
const folder = computed(() => String(route.value.folder || ''));
const folderParts = computed(() => folder.value ? folder.value.split('/') : []);
const ownerName = computed(() => displayName(String(portal.value.me || '')));

const filter = ref('');
const typeFilter = ref('');
const mode = ref<'list' | 'lineage'>('list');
const selected = ref<string[]>([]);
const sortKey = ref('name');
const sortDir = ref<'asc' | 'desc'>('asc');
const menu = ref<{ row: Row; x: number; y: number } | null>(null);
const panel = ref('');
const newItem = ref(false);
const dialog = ref('');
const dialogName = ref('');
const dialogError = ref('');
const target = ref<Row | null>(null);
const moveWs = ref('');
const moveFolder = ref('');
const pendingDelete = ref<Row[]>([]);
const settingsFor = ref<Record<string, any> | null>(null);
const settingsTab = ref('about');

const columns = [
  { key: 'name', label: 'Name' }, { key: 'typeLabel', label: 'Type' }, { key: 'task', label: 'Task' },
  { key: 'owner', label: 'Owner' }, { key: 'refreshed', label: 'Refreshed' },
  { key: 'next', label: 'Next refresh' }, { key: 'endorsement', label: 'Endorsement' },
  { key: 'label', label: 'Sensitivity' },
];

const items = computed(() => rows(portal.value, 'items').filter(i => i.workspace === wsName.value));
const presentTypes = computed(() => [...new Set(items.value.map(i => String(i.type)))]);

const allRows = computed<Row[]>(() => {
  const out: Row[] = [];
  const subfolders = ((ws.value?.folders || []) as string[]).filter(f => {
    const parent = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '';
    return parent === folder.value;
  });
  for (const f of subfolders) {
    out.push({ key: 'folder:' + f, kind: 'folder', name: f.split('/').pop() || f, type: 'Folder',
      icon: 'Folder', typeLabel: 'Folder', task: '', owner: '', refreshed: '', next: '',
      endorsement: '', label: '', labelInherited: false, folder: f });
  }
  for (const i of items.value.filter(x => (x.folder || '') === folder.value)) {
    out.push({ key: `item:${i.type}:${i.name}`, kind: 'item', name: i.name, type: i.type, icon: i.type,
      typeLabel: typeLabel(i.type), task: ITEM_TYPES[i.type]?.task || '', owner: i.owner,
      refreshed: i.refreshed || '', next: i.next_refresh || '', endorsement: i.endorsement,
      label: i.label, labelInherited: i.label_inherited, folder: i.folder || '', item: i });
    if (i.type === 'Lakehouse') {
      out.push({ key: `endpoint:${i.name}`, kind: 'endpoint', name: i.name, type: 'SQLEndpoint',
        icon: 'SQLEndpoint', typeLabel: 'SQL analytics endpoint', task: 'Store data', owner: i.owner,
        refreshed: '', next: '', endorsement: '', label: i.label, labelInherited: true,
        folder: i.folder || '', item: i });
    }
  }
  return out;
});

const tableRows = computed(() => {
  const list = allRows.value.filter(r => matches(r as any, filter.value, ['name', 'typeLabel', 'label'])
    && (!typeFilter.value || r.type === typeFilter.value || (r.kind === 'endpoint' && typeFilter.value === 'Lakehouse')));
  const folders = list.filter(r => r.kind === 'folder');
  const others = list.filter(r => r.kind !== 'folder');
  // Keep each SQL analytics endpoint directly under its lakehouse when sorting by name.
  const sorted = sortBy(others as any[], sortKey.value, sortDir.value) as Row[];
  if (sortKey.value === 'name') {
    const ordered: Row[] = [];
    for (const r of sorted.filter(x => x.kind !== 'endpoint')) {
      ordered.push(r);
      const ep = sorted.find(x => x.kind === 'endpoint' && x.name === r.name && r.type === 'Lakehouse');
      if (ep) ordered.push(ep);
    }
    return [...sortBy(folders as any[], 'name', sortDir.value) as Row[], ...ordered];
  }
  return [...folders, ...sorted];
});

const allSelected = computed(() => {
  const keys = tableRows.value.filter(r => r.kind !== 'endpoint').map(r => r.key);
  return keys.length > 0 && keys.every(k => selected.value.includes(k));
});

watch([wsName, folder], () => { selected.value = []; });

function sortOn(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}
function toggle(key: string) {
  selected.value = selected.value.includes(key) ? selected.value.filter(k => k !== key) : [...selected.value, key];
}
function toggleAll() {
  selected.value = allSelected.value ? [] : tableRows.value.filter(r => r.kind !== 'endpoint').map(r => r.key);
}

function openFolder(f: string) { go({ page: 'workspace', ws: wsName.value, folder: f }); }

function openRow(row: Row) {
  if (row.kind === 'folder') return openFolder(row.folder);
  go({ page: 'item', ws: wsName.value, item: row.name, type: row.type });
}

function openMenu(row: Row, event: MouseEvent) {
  const host = (event.currentTarget as HTMLElement).closest('.wp') as HTMLElement;
  const box = host.getBoundingClientRect();
  const btn = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = Math.min(btn.left - box.left, box.width - 220);
  const y = Math.min(btn.bottom - box.top, box.height - 300);
  menu.value = { row, x: Math.max(4, x), y: Math.max(4, y) };
}

function runnable(type: string) { return ['DataPipeline', 'Notebook', 'SemanticModel'].includes(type); }

async function runItem(row: Row) {
  menu.value = null;
  const verb = row.type === 'SemanticModel' ? 'Refresh of' : 'Run of';
  await run(cli(['fab', 'job', 'run', itemPath(wsName.value, row.name, row.type)]), `${verb} ${row.name} finished`);
}

function openSettings(row: Row, tab: string) {
  menu.value = null;
  settingsTab.value = tab;
  settingsFor.value = row.item;
}

function openFolderDialog() {
  dialogName.value = 'New folder';
  dialogError.value = '';
  dialog.value = 'folder';
}

async function createFolder() {
  const name = dialogName.value.trim();
  if (!name) return;
  const full = folder.value ? `${folder.value}/${name}` : name;
  const result = await run(cli(['fab', 'mkdir', folderPath(wsName.value, full)]), `Created folder ${name}`, { quiet: true });
  if (!result.ok) { dialogError.value = errorText(result); return; }
  dialog.value = '';
}

function startRename(row: Row) {
  menu.value = null;
  target.value = row;
  dialogName.value = row.name;
  dialogError.value = '';
  dialog.value = 'rename';
}

async function doRename() {
  const row = target.value;
  const name = dialogName.value.trim();
  if (!row || !name || name === row.name) return;
  let result;
  if (row.kind === 'folder') {
    const parent = row.folder.includes('/') ? row.folder.slice(0, row.folder.lastIndexOf('/') + 1) : '';
    result = await run(cli(['fab', 'mv', folderPath(wsName.value, row.folder), folderPath(wsName.value, parent + name)]),
      `Renamed folder to ${name}`, { quiet: true });
  } else {
    result = await run(cli(['fab', 'set', itemPath(wsName.value, row.name, row.type)], { '-q': 'displayName', '-i': name }),
      `Renamed ${row.name} to ${name}`, { quiet: true });
  }
  if (!result.ok) { dialogError.value = errorText(result); return; }
  dialog.value = '';
}

function startMove(row: Row) {
  menu.value = null;
  target.value = row;
  moveWs.value = wsName.value;
  moveFolder.value = row.folder;
  dialogError.value = '';
  dialog.value = 'move';
}
const moveFolders = computed(() => workspaces.value.find(w => w.name === moveWs.value)?.folders || []);

async function doMove() {
  const row = target.value;
  if (!row) return;
  const dest = itemPath(moveWs.value, row.name, row.type, moveFolder.value);
  const result = await run(cli(['fab', 'mv', itemPath(wsName.value, row.name, row.type, row.folder), dest]),
    `Moved ${row.name}`, { quiet: true });
  if (!result.ok) { dialogError.value = errorText(result); return; }
  dialog.value = '';
}

function confirmDelete(list: Row[]) {
  menu.value = null;
  pendingDelete.value = list;
  dialogError.value = '';
  dialog.value = 'delete';
}
function bulkDelete() {
  confirmDelete(tableRows.value.filter(r => selected.value.includes(r.key)));
}
const deleteTitle = computed(() => pendingDelete.value.length === 1
  ? `Delete ${pendingDelete.value[0].name}?` : `Delete ${pendingDelete.value.length} items?`);
const deleteText = computed(() => {
  const one = pendingDelete.value[0];
  if (pendingDelete.value.length === 1 && one?.kind === 'folder') return 'The folder must be empty before it can be deleted.';
  if (pendingDelete.value.length === 1 && one?.type === 'Lakehouse') {
    return 'This lakehouse, its SQL analytics endpoint, and all of its tables and files will be permanently deleted. Items that depend on it will stop working.';
  }
  return 'The selected items will be permanently deleted. You can\'t undo this action.';
});

async function doDelete() {
  dialogError.value = '';
  for (const row of pendingDelete.value) {
    const path = row.kind === 'folder' ? folderPath(wsName.value, row.folder) : itemPath(wsName.value, row.name, row.type);
    const result = await run(cli(['fab', 'rm', path, '-f']), `Deleted ${row.name}`, { quiet: true });
    if (!result.ok) { dialogError.value = errorText(result); return; }
  }
  selected.value = [];
  dialog.value = '';
}

function created(value: { ws: string; name: string; type: string }) {
  newItem.value = false;
  go({ page: 'item', ws: value.ws, item: value.name, type: value.type });
}

function labelColor(label: string) {
  return ({ Public: '#107c10', General: '#0f6cbd', Confidential: '#ca5010', 'Highly Confidential': '#c50f1f' } as Record<string, string>)[label] || '#8a8886';
}

const pendingGit = computed(() => 0);

// Lineage: sources -> items in this workspace -> downstream.
const lineageEdges = computed(() => rows(view.value, 'lineage'));
const lineageColumns = computed(() => {
  const names = new Set(items.value.map(i => String(i.name).toLowerCase()));
  const owner = (label: string) => String(label).split('.')[0].split('/')[0].replace(' (semantic model)', '').toLowerCase();
  const edges = lineageEdges.value.filter(e => names.has(owner(e.from)) || names.has(owner(e.to)));
  const iconFor = (label: string) => {
    const it = items.value.find(i => String(i.name).toLowerCase() === owner(label));
    return it ? it.type : 'File';
  };
  const froms = [...new Set(edges.map(e => String(e.from)))].filter(f => !edges.some(e => e.to === f));
  const mids = [...new Set(edges.map(e => String(e.to)))].filter(t => edges.some(e => e.from === t));
  const ends = [...new Set(edges.map(e => String(e.to)))].filter(t => !mids.includes(t));
  const node = (label: string) => ({ label, icon: iconFor(label) });
  return [
    { title: 'Sources', nodes: froms.slice(0, 30).map(node) },
    { title: 'Transformations', nodes: mids.slice(0, 30).map(node) },
    { title: 'Consumers', nodes: ends.slice(0, 30).map(node) },
  ].filter(c => c.nodes.length);
});
</script>

<style scoped>
.wp { position: relative; }
.wp-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px 8px; flex-wrap: wrap; }
.wp-icon { display: inline-grid; place-items: center; width: 48px; height: 48px; border-radius: 8px; background: #eef5fc; }
.wp-title { min-width: 0; }
.wp-headbtns { display: flex; gap: 8px; flex-wrap: wrap; }
.wp-toolbar { gap: 4px; padding: 8px 20px; border-bottom: 0; }
.wp-toolbar .wp-filter { width: 200px; }
.wp-toolbar .wp-type { width: 150px; }
.wp-views { display: flex; gap: 2px; padding-left: 4px; }
.wp-views .is-on { background: #e6f2ef; color: #0e6e5c; }
.wp-crumb { padding-bottom: 6px; }
.wp-table { min-width: 980px; }
.wp-cb { width: 40px; }
.wp-sort { border: 0; background: none; padding: 0; font: inherit; color: inherit; cursor: pointer; }
.wp-more { margin-left: auto; opacity: 0; }
tr:hover .wp-more, .wp-more:focus { opacity: 1; }
.wp-child { padding-left: 24px; }
.wp-owner { display: inline-flex; align-items: center; gap: 6px; }
.wp-lineage { display: flex; gap: 32px; padding: 20px; align-items: flex-start; flex-wrap: wrap; }
.wp-lcol { display: flex; flex-direction: column; gap: 8px; min-width: 220px; }
.wp-lcol__title { font-weight: 600; color: #616161; font-size: 13px; }
.wp-lnode { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fff; font-size: 13px; box-shadow: 0 1px 2px rgba(0,0,0,.08); max-width: 300px; }
.wp-lnode span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wp-p { margin: 0 0 8px; }
.wp-dellist { margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.wp-dellist li { display: flex; gap: 8px; align-items: center; }
@container sl-portal (max-width: 600px) {
  .wp-head { padding: 12px 12px 6px; }
  .wp-icon { display: none; }
  .wp-toolbar { padding: 6px 12px; }
  .wp-toolbar .wp-filter, .wp-toolbar .wp-type { width: 100%; }
  .wp-more { opacity: 1; }
}
</style>
