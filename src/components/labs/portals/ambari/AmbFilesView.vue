<template>
  <div class="fv panel">
    <!-- Path bar and the header actions. -->
    <div class="fv__head">
      <nav class="fv__crumbs" aria-label="Path">
        <a href="#" class="fv__crumb" @click.prevent="openDir('/')"><AmbIcon name="folder" :size="15" /></a>
        <template v-for="(crumb, i) in crumbs" :key="crumb.path">
          <span class="fv__sep">/</span>
          <a v-if="i < crumbs.length - 1" href="#" class="fv__crumb" @click.prevent="openDir(crumb.path)">{{ crumb.name }}</a>
          <span v-else class="fv__crumb is-current">{{ crumb.name }}</span>
        </template>
      </nav>
      <div class="fv__tools">
        <div class="fv__search">
          <AmbIcon name="search" :size="13" />
          <input v-model="search" placeholder="Search in current directory..." aria-label="Search in current directory" />
        </div>
        <button type="button" class="btn btn-default" :disabled="busy" @click="openNewFolder">
          <AmbIcon name="plus" :size="12" />New Folder
        </button>
        <button type="button" class="btn btn-default" :disabled="busy" @click="openUpload">
          <AmbIcon name="upload" :size="12" />Upload
        </button>
        <button type="button" class="btn btn-default" :disabled="busy" title="Trash" @click="openDir(trashDir)">
          <AmbIcon name="trash" :size="12" />Trash
        </button>
      </div>
    </div>

    <!-- The selection action bar, shown when rows are checked. -->
    <div v-if="selected.length" class="fv__actions">
      <span class="fv__count">{{ selected.length }} item{{ selected.length === 1 ? '' : 's' }} selected</span>
      <button v-if="single && single.type === 'file'" type="button" class="btn btn-link" @click="openFile(single)"><AmbIcon name="file" :size="13" />Open</button>
      <button v-if="single && single.type === 'dir'" type="button" class="btn btn-link" @click="openDir(single.path)"><AmbIcon name="folder" :size="13" />Open</button>
      <button v-if="single" type="button" class="btn btn-link" @click="startRename"><AmbIcon name="edit" :size="13" />Rename</button>
      <button type="button" class="btn btn-link" @click="startPermissions"><AmbIcon name="lock" :size="13" />Permissions</button>
      <button type="button" class="btn btn-link" @click="startReplication"><AmbIcon name="copy" :size="13" />Replication</button>
      <button type="button" class="btn btn-link fv__del" @click="modal = 'delete'"><AmbIcon name="trash" :size="13" />Delete</button>
      <button type="button" class="btn btn-link" @click="startTransfer('copy')"><AmbIcon name="copy" :size="13" />Copy</button>
      <button type="button" class="btn btn-link" @click="startTransfer('move')"><AmbIcon name="move" :size="13" />Move</button>
      <button v-if="selectedFiles.length" type="button" class="btn btn-link" @click="download"><AmbIcon name="download" :size="13" />Download</button>
      <button v-if="selectedFiles.length > 1 && selectedFiles.length === selected.length" type="button" class="btn btn-link"
              @click="concatenate"><AmbIcon name="list" :size="13" />Concatenate</button>
      <button type="button" class="btn btn-link fv__clear" @click="selected = []">Clear</button>
    </div>

    <div class="table-wrap">
      <table class="table fv__table">
        <thead>
          <tr>
            <th class="fv__check"><input type="checkbox" :checked="allChecked" aria-label="Select all" @change="toggleAll" /></th>
            <th><button type="button" class="fv__sort" @click="sort('name')">Name {{ arrow('name') }}</button></th>
            <th><button type="button" class="fv__sort" @click="sort('size')">Size {{ arrow('size') }}</button></th>
            <th><button type="button" class="fv__sort" @click="sort('mtime')">Last Modified {{ arrow('mtime') }}</button></th>
            <th>Owner</th><th>Group</th><th>Permission</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cwd !== '/'" class="fv__up">
            <td></td>
            <td colspan="6"><a href="#" @click.prevent="openDir(parentOf(cwd))"><AmbIcon name="folder" :size="15" /> ..</a></td>
          </tr>
          <tr v-for="row in entries" :key="row.path" :class="{ 'is-selected': selected.includes(row.path) }"
              @dblclick="row.type === 'dir' ? openDir(row.path) : openFile(row)">
            <td class="fv__check"><input v-model="selected" type="checkbox" :value="row.path" :aria-label="`Select ${row.name}`" /></td>
            <td class="fv__name">
              <AmbIcon :name="row.type === 'dir' ? 'folder' : 'file'" :size="15" :class="row.type === 'dir' ? 'fv__folder' : 'fv__file'" />
              <a href="#" @click.prevent="row.type === 'dir' ? openDir(row.path) : openFile(row)">{{ row.name }}</a>
            </td>
            <td>{{ row.type === 'dir' ? '--' : bytes(row.size) }}</td>
            <td class="fv__nowrap">{{ shortStamp(row.mtime) }}</td>
            <td>{{ row.owner }}</td>
            <td>{{ row.group }}</td>
            <td class="mono">{{ row.perm }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!entries.length" class="empty">{{ search ? 'No files match your search' : 'No files or folders' }}</div>
    </div>
    <div class="fv__foot text-muted">{{ entries.length }} item{{ entries.length === 1 ? '' : 's' }} · {{ cwd }}</div>

    <!-- NEW FOLDER -->
    <AmbModal v-if="modal === 'mkdir'" title="Add New Folder" ok-text="Add" :ok-disabled="!!folderError || !folderName"
              :busy="busy" small @close="modal = ''" @ok="createFolder">
      <div class="form-group" :class="{ 'has-error': folderError }">
        <label for="fv-folder">Folder name</label>
        <input id="fv-folder" v-model="folderName" class="form-control" placeholder="Enter folder name" @keydown.enter="createFolder" />
        <span v-if="folderError" class="help-block">{{ folderError }}</span>
      </div>
    </AmbModal>

    <!-- UPLOAD -->
    <AmbModal v-if="modal === 'upload'" title="Upload Files" ok-text="Upload" :ok-disabled="!uploads.length" :busy="busy"
              @close="modal = ''" @ok="upload">
      <p>Upload to <span class="mono">{{ cwd }}</span>. The files come from this lab's workspace (the Files tool),
        which is the local filesystem <span class="mono">hdfs dfs -put</span> reads from.</p>
      <div v-if="!localFiles.length" class="alert alert-info">This lab's workspace has no files yet — create one with the Files tool first.</div>
      <ul v-else class="fv__locals">
        <li v-for="file in localFiles" :key="file">
          <label><input v-model="uploads" type="checkbox" :value="file" /> <span class="mono">{{ file }}</span></label>
        </li>
      </ul>
      <label class="fv__inline"><input v-model="overwrite" type="checkbox" /> Overwrite if the file already exists</label>
    </AmbModal>

    <!-- OPEN / PREVIEW -->
    <AmbModal v-if="modal === 'preview'" :title="preview.title" ok-text="" cancel-text="Close" wide @close="modal = ''">
      <template #default>
        <pre class="fv__preview">{{ preview.content || '(empty file)' }}</pre>
      </template>
      <template #footer>
        <button type="button" class="btn btn-default" @click="saveBlob(preview.name, preview.content)"><AmbIcon name="download" :size="12" />Download</button>
        <button type="button" class="btn btn-success" @click="modal = ''">Close</button>
      </template>
    </AmbModal>

    <!-- RENAME -->
    <AmbModal v-if="modal === 'rename'" title="Rename" ok-text="Rename" :ok-disabled="!!renameError || !renameTo"
              :busy="busy" small @close="modal = ''" @ok="rename">
      <div class="form-group" :class="{ 'has-error': renameError }">
        <label for="fv-rename">New name</label>
        <input id="fv-rename" v-model="renameTo" class="form-control" @keydown.enter="rename" />
        <span v-if="renameError" class="help-block">{{ renameError }}</span>
      </div>
    </AmbModal>

    <!-- PERMISSIONS -->
    <AmbModal v-if="modal === 'perms'" title="Edit Permission" ok-text="Save" :busy="busy" @close="modal = ''" @ok="chmod">
      <table class="table fv__perms">
        <thead><tr><th></th><th>Read</th><th>Write</th><th>Execute</th></tr></thead>
        <tbody>
          <tr v-for="(who, w) in ['User', 'Group', 'Other']" :key="who">
            <th>{{ who }}</th>
            <td v-for="(bit, b) in [4, 2, 1]" :key="bit">
              <input v-model="perm[w][b]" type="checkbox" :aria-label="`${who} ${['read', 'write', 'execute'][b]}`" />
            </td>
          </tr>
        </tbody>
      </table>
      <label class="fv__inline"><input v-model="recursive" type="checkbox" /> Modify recursively</label>
      <p class="text-muted">Octal: <span class="mono">{{ octal }}</span></p>
    </AmbModal>

    <!-- REPLICATION -->
    <AmbModal v-if="modal === 'rep'" title="Set Replication Factor" ok-text="Save" :busy="busy" small
              :ok-disabled="!!repError" @close="modal = ''" @ok="setrep">
      <div class="form-group" :class="{ 'has-error': repError }">
        <label for="fv-rep">Replication factor</label>
        <input id="fv-rep" v-model="replication" type="number" min="1" max="512" class="form-control" />
        <span class="help-block">{{ repError || 'Applies to every file selected (recursively for folders).' }}</span>
      </div>
    </AmbModal>

    <!-- COPY / MOVE -->
    <AmbModal v-if="modal === 'copy' || modal === 'move'" :title="modal === 'copy' ? 'Copy to' : 'Move to'"
              :ok-text="modal === 'copy' ? 'Copy' : 'Move'" :ok-disabled="!target" :busy="busy" @close="modal = ''" @ok="transfer">
      <div class="form-group">
        <label for="fv-target">Destination folder</label>
        <input id="fv-target" v-model="target" class="form-control mono" />
      </div>
      <ul class="fv__dirs">
        <li v-for="dir in directories" :key="dir">
          <a href="#" :class="{ 'is-active': target === dir }" :style="{ paddingLeft: depth(dir) * 14 + 8 + 'px' }"
             @click.prevent="target = dir"><AmbIcon name="folder" :size="13" /> {{ dir === '/' ? '/' : dir.split('/').pop() }}</a>
        </li>
      </ul>
    </AmbModal>

    <!-- DELETE -->
    <AmbModal v-if="modal === 'delete'" title="Delete" ok-text="Delete" danger :busy="busy" small
              @close="modal = ''" @ok="remove">
      <p>Do you really want to delete {{ selected.length === 1 ? 'this item' : `these ${selected.length} items` }}?</p>
      <ul class="fv__dellist mono"><li v-for="p in selected" :key="p">{{ p }}</li></ul>
      <label class="fv__inline"><input v-model="permanently" type="checkbox" /> Delete permanently</label>
      <p class="help-block">Without this, the items move to the trash at <span class="mono">{{ trashDir }}</span>
        and still use space on the DataNodes.</p>
    </AmbModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import { cli, pick, rows, sortBy } from '@/utils/portalKit';
import { bytes, joinPath, parentOf, permOctal, shortStamp } from './ambari';
import AmbIcon from './AmbIcon.vue';
import AmbModal from './AmbModal.vue';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean }>();

const cwd = ref('/user/lab');
const search = ref('');
const selected = ref<string[]>([]);
const modal = ref('');
const sortKey = ref('name');
const sortDir = ref<'asc' | 'desc'>('asc');

const browser = computed(() => rows(props.view, 'browser'));
const byPath = computed(() => new Map(browser.value.map(r => [r.path, r])));
const trashDir = '/user/lab/.Trash/Current';

const crumbs = computed(() => {
  const parts = cwd.value.split('/').filter(Boolean);
  return parts.map((name, i) => ({ name, path: '/' + parts.slice(0, i + 1).join('/') }));
});

const entries = computed(() => {
  const needle = search.value.trim().toLowerCase();
  const list = browser.value.filter(r => r.parent === cwd.value && r.path !== '/'
    && (!needle || String(r.name).toLowerCase().includes(needle)));
  const dirs = sortBy(list.filter(r => r.type === 'dir'), sortKey.value, sortDir.value);
  const files = sortBy(list.filter(r => r.type !== 'dir'), sortKey.value, sortDir.value);
  return [...dirs, ...files];
});
const allChecked = computed(() => entries.value.length > 0 && entries.value.every(r => selected.value.includes(r.path)));
const selectedRows = computed(() => selected.value.map(p => byPath.value.get(p)).filter(Boolean) as Record<string, any>[]);
const selectedFiles = computed(() => selectedRows.value.filter(r => r.type === 'file'));
const single = computed(() => (selectedRows.value.length === 1 ? selectedRows.value[0] : null));
const directories = computed(() => browser.value.filter(r => r.type === 'dir').map(r => String(r.path)).sort());
const localFiles = computed(() => pick<string[]>(props.view, 'local_files', []));

function sort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}
function arrow(key: string) {
  return sortKey.value !== key ? '' : sortDir.value === 'asc' ? '▲' : '▼';
}
function toggleAll() {
  selected.value = allChecked.value ? [] : entries.value.map(r => r.path);
}
function depth(dir: string) {
  return dir === '/' ? 0 : dir.split('/').length - 1;
}

async function openDir(path: string) {
  const result = await props.api.exec(cli(['hdfs', 'dfs', '-ls', path]), { failure: 'Could not list the folder' });
  if (result.ok) {
    cwd.value = path;
    selected.value = [];
    search.value = '';
  }
}

// ---- new folder ----
const folderName = ref('');
const folderError = computed(() => {
  const name = folderName.value.trim();
  if (!name) return '';
  if (name.includes('/') || name === '.' || name === '..') return 'Folder name cannot contain "/", "." or ".."';
  if (byPath.value.has(joinPath(cwd.value, name))) return 'A file or folder with this name already exists';
  return '';
});
function openNewFolder() {
  folderName.value = '';
  modal.value = 'mkdir';
}
async function createFolder() {
  if (folderError.value || !folderName.value.trim()) return;
  const path = joinPath(cwd.value, folderName.value.trim());
  const result = await props.api.exec(cli(['hdfs', 'dfs', '-mkdir', '-p', path]), { success: `Folder ${path} created` });
  if (result.ok) modal.value = '';
}

// ---- upload ----
const uploads = ref<string[]>([]);
const overwrite = ref(false);
function openUpload() {
  uploads.value = [];
  overwrite.value = false;
  modal.value = 'upload';
}
async function upload() {
  for (const file of uploads.value) {
    const words = ['hdfs', 'dfs', '-put', ...(overwrite.value ? ['-f'] : []), file, cwd.value];
    const result = await props.api.exec(cli(words), { success: `Uploaded ${file}` });
    if (!result.ok) return;
  }
  modal.value = '';
}

// ---- open / download / concatenate ----
const preview = ref({ title: '', name: '', content: '' });
async function readFiles(paths: string[]) {
  const result = await props.api.exec(cli(['hdfs', 'dfs', '-cat', ...paths]), { failure: 'Could not read the file' });
  if (!result.ok) return null;
  const data = (result.data || {}) as Record<string, any>;
  return String(data.content ?? result.output ?? '');
}
async function openFile(row: Record<string, any>) {
  const content = await readFiles([row.path]);
  if (content === null) return;
  preview.value = { title: row.path, name: row.name, content };
  modal.value = 'preview';
}
async function download() {
  for (const row of selectedFiles.value) {
    const content = await readFiles([row.path]);
    if (content !== null) saveBlob(row.name, content);
  }
}
async function concatenate() {
  const paths = selectedFiles.value.map(r => r.path);
  const content = await readFiles(paths);
  if (content === null) return;
  preview.value = { title: `Concatenated: ${paths.length} files`, name: 'concatenated.txt', content };
  modal.value = 'preview';
}
function saveBlob(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- rename ----
const renameTo = ref('');
const renameError = computed(() => {
  const name = renameTo.value.trim();
  if (!name || !single.value) return '';
  if (name.includes('/')) return 'Name cannot contain "/"';
  if (name !== single.value.name && byPath.value.has(joinPath(cwd.value, name))) return 'A file or folder with this name already exists';
  return '';
});
function startRename() {
  renameTo.value = String(single.value?.name || '');
  modal.value = 'rename';
}
async function rename() {
  if (!single.value || renameError.value || !renameTo.value.trim()) return;
  if (renameTo.value.trim() === single.value.name) { modal.value = ''; return; }
  const to = joinPath(cwd.value, renameTo.value.trim());
  const result = await props.api.exec(cli(['hdfs', 'dfs', '-mv', single.value.path, to]), { success: `Renamed to ${to}` });
  if (result.ok) { modal.value = ''; selected.value = []; }
}

// ---- permissions ----
const perm = ref<boolean[][]>([[true, true, false], [true, false, false], [true, false, false]]);
const recursive = ref(false);
const octal = computed(() => perm.value.map(g => (g[0] ? 4 : 0) + (g[1] ? 2 : 0) + (g[2] ? 1 : 0)).join(''));
function startPermissions() {
  const digits = permOctal(String(selectedRows.value[0]?.perm || '-rw-r--r--'));
  perm.value = digits.split('').map(d => [Boolean(+d & 4), Boolean(+d & 2), Boolean(+d & 1)]);
  recursive.value = false;
  modal.value = 'perms';
}
async function chmod() {
  const result = await props.api.exec(cli(['hdfs', 'dfs', '-chmod', ...(recursive.value ? ['-R'] : []), octal.value,
                                           ...selected.value]), { success: `Permissions set to ${octal.value}` });
  if (result.ok) { modal.value = ''; selected.value = []; }
}

// ---- replication ----
const replication = ref('3');
const repError = computed(() => {
  const n = Number(replication.value);
  return Number.isInteger(n) && n >= 1 && n <= 512 ? '' : 'Enter a whole number between 1 and 512';
});
function startReplication() {
  replication.value = String(selectedFiles.value[0]?.replication || 3);
  modal.value = 'rep';
}
async function setrep() {
  for (const path of selected.value) {
    const result = await props.api.exec(cli(['hdfs', 'dfs', '-setrep', replication.value, path]),
                                        { success: `Replication set to ${replication.value} on ${path}` });
    if (!result.ok) return;
  }
  modal.value = '';
  selected.value = [];
}

// ---- copy / move ----
const target = ref('');
function startTransfer(kind: 'copy' | 'move') {
  target.value = cwd.value;
  modal.value = kind;
}
async function transfer() {
  const verb = modal.value === 'copy' ? '-cp' : '-mv';
  for (const path of [...selected.value]) {
    const result = await props.api.exec(cli(['hdfs', 'dfs', verb, path, target.value]),
                                        { success: `${verb === '-cp' ? 'Copied' : 'Moved'} ${path} to ${target.value}` });
    if (!result.ok) return;
  }
  modal.value = '';
  selected.value = [];
}

// ---- delete ----
const permanently = ref(false);
async function remove() {
  const words = ['hdfs', 'dfs', '-rm', '-r', ...(permanently.value ? ['-skipTrash'] : []), ...selected.value];
  const result = await props.api.exec(cli(words), {
    success: permanently.value ? `Deleted ${selected.value.length} item(s) permanently` : `Moved ${selected.value.length} item(s) to trash`,
  });
  if (result.ok) { modal.value = ''; selected.value = []; permanently.value = false; }
}
</script>

<style scoped>
.fv { margin: 0; display: flex; flex-direction: column; min-height: 100%; box-sizing: border-box; }
.fv__head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 15px; border-bottom: 1px solid #eee; }
.fv__crumbs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 15px; flex: 1; min-width: 0; }
.fv__crumb { color: #1491c1; display: inline-flex; align-items: center; }
.fv__crumb.is-current { color: #333; font-weight: 500; }
.fv__sep { color: #999; }
.fv__tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fv__search { display: flex; align-items: center; gap: 6px; border: 1px solid #ccc; border-radius: 4px; padding: 0 8px; height: 34px; color: #999; background: #fff; }
.fv__search input { border: 0; outline: 0; font: inherit; font-size: 13px; width: 200px; max-width: 40vw; }
.fv__actions { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; padding: 8px 12px; background: #f5f5f5; border-bottom: 1px solid #e3e3e3; }
.fv__actions .btn-link { height: 28px; font-size: 13px; }
.fv__count { font-size: 13px; color: #666; margin-right: 8px; }
.fv__del { color: #d9534f !important; }
.fv__clear { margin-left: auto; color: #666 !important; }
.fv__table th { user-select: none; }
.fv__sort { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; cursor: pointer; color: #333; }
.fv__check { width: 30px; }
.fv__name { white-space: nowrap; }
.fv__name a { margin-left: 6px; }
.fv__folder { color: #e8bc4e; }
.fv__file { color: #999; }
.fv__nowrap { white-space: nowrap; }
.fv__up a { display: inline-flex; gap: 6px; align-items: center; }
.fv__foot { padding: 8px 15px; font-size: 12px; border-top: 1px solid #eee; margin-top: auto; }
.fv__locals { list-style: none; padding: 0; margin: 0 0 12px; max-height: 220px; overflow: auto; border: 1px solid #eee; }
.fv__locals li { padding: 6px 10px; border-bottom: 1px solid #f2f2f2; }
.fv__inline { display: flex; align-items: center; gap: 8px; font-weight: 400; font-size: 13px; }
.fv__preview { background: #f8f8f8; border: 1px solid #ddd; padding: 10px; font-size: 12px; max-height: 50vh; overflow: auto; white-space: pre; margin: 0; }
.fv__perms th, .fv__perms td { text-align: center; }
.fv__dirs { list-style: none; padding: 0; margin: 0; max-height: 240px; overflow: auto; border: 1px solid #eee; }
.fv__dirs a { display: flex; align-items: center; gap: 6px; padding: 5px 8px; color: #333; font-size: 13px; }
.fv__dirs a.is-active { background: #eef7ec; font-weight: 700; }
.fv__dellist { max-height: 120px; overflow: auto; background: #f8f8f8; padding: 8px 8px 8px 24px; }
@container sl-portal (max-width: 600px) {
  .fv__search input { width: 120px; }
  .fv__tools .btn { padding: 0 8px; }
}
</style>
