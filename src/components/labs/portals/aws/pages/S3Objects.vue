<template>
  <div>
    <CsTable
      v-model:selected="selected"
      :title="'Objects'"
      :items="entries"
      :columns="columns"
      track-by="key"
      selection-type="multi"
      filter-placeholder="Find objects by prefix"
      :filter-fields="['name']"
      description="Objects are the fundamental entities stored in Amazon S3. You can use Amazon S3 inventory to get a list of all objects in your bucket. For others to access your objects, you'll need to explicitly grant them permissions."
      empty-title="No objects"
      empty-text="You don't have any objects in this bucket."
    >
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Objects refreshed')"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" :disabled="!single" @click="copyUri"><CsIcon name="copy" /> Copy S3 URI</button>
        <button type="button" class="cs-btn" :disabled="!singleFile" @click="download"><CsIcon name="download" /> Download</button>
        <button type="button" class="cs-btn" :disabled="!singleFile" @click="openObject">Open <CsIcon name="external" size="small" /></button>
        <button type="button" class="cs-btn" :disabled="!selected.length" @click="deleting = true">Delete</button>
        <CsDropdown :items="actionItems" @select="action" />
        <button type="button" class="cs-btn" @click="folderOpen = true">Create folder</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="uploadOpen = true"><CsIcon name="upload" /> Upload</button>
      </template>
      <template #empty>
        <button type="button" class="cs-btn" @click="uploadOpen = true">Upload</button>
      </template>
      <template #cell-name="{ row }">
        <span class="s3o__name">
          <CsIcon :name="row.folder ? 'folder' : 'file'" class="s3o__icon" />
          <a href="#" class="cs-link" @click.prevent="openRow(row as any)">{{ row.name }}</a>
        </span>
      </template>
    </CsTable>

    <CsModal v-if="folderOpen" title="Create folder" @close="folderOpen = false">
      <p class="s3o__p">Use folders to group objects in buckets. When you create a folder, S3 creates an object using the name that you specify followed by a slash (/). This object then appears as a folder on the console.</p>
      <div class="cs-field">
        <label class="cs-label" for="s3o-folder">Folder name</label>
        <input id="s3o-folder" v-model.trim="folderName" class="cs-input" :class="{ 'is-invalid': folderError }" placeholder="Folder name" />
        <div v-if="folderError" class="cs-error-text">{{ folderError }}</div>
        <div class="cs-constraint">Folder names can't contain "/". Destination: s3://{{ bucket.name }}/{{ prefix }}</div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="folderOpen = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!folderName || !!folderError || busy" @click="createFolder">Create folder</button>
      </template>
    </CsModal>

    <CsModal v-if="uploadOpen" title="Upload" size="large" @close="uploadOpen = false">
      <p class="s3o__p">Add the files you want to upload to S3. In this lab, files come from your lab workspace (the Files tool).</p>
      <div class="cs-container s3o__files">
        <div class="cs-container__head">
          <CsHeader :title="`Files and folders (${chosen.length} Total)`" :level="2" :info="false"
                    description="All files and folders in this table will be uploaded." />
        </div>
        <div class="cs-container__body">
          <div v-if="!files.length" class="cs-empty"><strong>No files in your workspace</strong>Create a file with the Files tool, then come back to upload it.</div>
          <table v-else class="cs-table-mini">
            <thead><tr><th></th><th>Name</th><th>Folder</th><th>Destination key</th></tr></thead>
            <tbody>
              <tr v-for="path in files" :key="path">
                <td><input v-model="chosen" type="checkbox" class="s3o__cb" :value="path" :aria-label="'Choose ' + path" /></td>
                <td>{{ leaf(path) }}</td>
                <td class="cs-muted">{{ dir(path) || '-' }}</td>
                <td class="cs-mono">{{ prefix }}{{ leaf(path) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="cs-field">
        <span class="cs-label">Destination</span>
        <span class="cs-link">s3://{{ bucket.name }}/{{ prefix }}</span>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="uploadOpen = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!chosen.length || busy" @click="upload">
          <span v-if="busy" class="cs-btn__spinner" />Upload
        </button>
      </template>
    </CsModal>

    <CsDelete v-if="deleting" title="Delete objects" word="permanently delete" action="Delete objects" :busy="busy"
              @close="deleting = false" @confirm="removeSelected">
      <div class="cs-alert cs-alert--warning">
        <CsIcon name="status-warning" class="cs-alert__icon" />
        <div>Deleting the specified objects can't be undone. <strong v-if="selectedFolders.length">Deleting a folder deletes every object under its prefix.</strong></div>
      </div>
      <table class="cs-table-mini">
        <thead><tr><th>Name</th><th>Type</th></tr></thead>
        <tbody><tr v-for="row in selectedRows" :key="row.key"><td>{{ row.name }}</td><td>{{ row.type }}</td></tr></tbody>
      </table>
    </CsDelete>

    <section v-if="preview !== null" class="cs-container s3o__preview">
      <div class="cs-container__head"><CsHeader :title="previewKey" :level="2" :info="false">
        <template #actions><button type="button" class="cs-btn cs-btn--link" @click="preview = null">Close</button></template>
      </CsHeader></div>
      <div class="cs-container__body"><pre class="cs-code">{{ preview || '(empty object)' }}</pre></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown, { type DdItem } from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, bytes, useAws } from '../ctx';

const props = defineProps<{ bucket: Record<string, any>; prefix: string }>();
const ctx = useAws();
const selected = ref<string[]>([]);
const folderOpen = ref(false);
const folderName = ref('');
const uploadOpen = ref(false);
const chosen = ref<string[]>([]);
const deleting = ref(false);
const busy = ref(false);
const preview = ref<string | null>(null);
const previewKey = ref('');

const files = computed(() => pick<string[]>(ctx.view.value, 'files', []));

interface Entry { key: string; name: string; folder: boolean; type: string; modified: string; size: string; storage: string }

const entries = computed<Entry[]>(() => {
  const all = rows(ctx.view.value, 's3.objects').filter(o => o.bucket === props.bucket.name
    && String(o.key).startsWith(props.prefix) && o.key !== props.prefix);
  const out: Entry[] = [];
  const folders = new Set<string>();
  for (const obj of all) {
    const rest = String(obj.key).slice(props.prefix.length);
    const slash = rest.indexOf('/');
    if (slash >= 0) {
      const folder = props.prefix + rest.slice(0, slash + 1);
      if (!folders.has(folder)) {
        folders.add(folder);
        out.push({ key: folder, name: rest.slice(0, slash + 1), folder: true, type: 'Folder', modified: '-', size: '-', storage: '-' });
      }
      continue;
    }
    const ext = rest.includes('.') ? rest.split('.').pop() || '' : '';
    out.push({ key: obj.key, name: rest, folder: false, type: ext || '-', modified: awsDate(obj.modified),
      size: bytes(obj.size), storage: 'Standard' });
  }
  return out.sort((a, b) => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name));
});

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'type', header: 'Type', sortKey: 'type' },
  { id: 'modified', header: 'Last modified', sortKey: 'modified' },
  { id: 'size', header: 'Size' },
  { id: 'storage', header: 'Storage class' },
];

const selectedRows = computed(() => entries.value.filter(e => selected.value.includes(e.key)));
const selectedFolders = computed(() => selectedRows.value.filter(e => e.folder));
const single = computed(() => (selectedRows.value.length === 1 ? selectedRows.value[0] : null));
const singleFile = computed(() => (single.value && !single.value.folder ? single.value : null));
const actionItems = computed<DdItem[]>(() => [
  { id: 'copy-url', text: 'Copy URL', disabled: !singleFile.value },
  { id: 'download-as', text: 'Download as', disabled: !singleFile.value },
  { id: 'share', text: 'Share with a presigned URL', disabled: !singleFile.value },
  { id: 'details', text: 'View details', disabled: !singleFile.value },
  { id: 'calc', text: 'Calculate total size', disabled: !selectedRows.value.length },
]);

const folderError = computed(() => (folderName.value.includes('/') ? 'Folder names can\'t contain "/".' : ''));

function leaf(path: string) {
  return path.split('/').pop() || path;
}
function dir(path: string) {
  const parts = path.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : '';
}
function uri(key: string) {
  return `s3://${props.bucket.name}/${key}`;
}

function openRow(row: Entry) {
  if (row.folder) ctx.to('s3', 'bucket', { name: props.bucket.name, prefix: row.key });
  else ctx.to('s3', 'object', { bucket: props.bucket.name, key: row.key });
}
async function copyUri() {
  if (!single.value) return;
  try { await navigator.clipboard.writeText(uri(single.value.key)); } catch { /* ignored */ }
  ctx.api.notify('success', 'S3 URI copied', uri(single.value.key));
}
async function download() {
  const row = singleFile.value;
  if (!row) return;
  await ctx.run(cli(['aws', 's3', 'cp', uri(row.key), leaf(row.key)]),
    `Downloaded ${row.name} to ${leaf(row.key)} in your lab workspace`);
}
async function openObject() {
  const row = singleFile.value;
  if (!row) return;
  const result = await ctx.run(cli(['aws', 's3', 'cp', uri(row.key), '-']));
  if (result.ok) {
    previewKey.value = row.key;
    preview.value = String(result.output || '');
  }
}
async function action(id: string) {
  const row = singleFile.value;
  if (id === 'details' && row) ctx.to('s3', 'object', { bucket: props.bucket.name, key: row.key });
  else if (id === 'download-as') download();
  else if (id === 'copy-url' && row) {
    const url = `https://${props.bucket.name}.s3.${props.bucket.region}.amazonaws.com/${row.key}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignored */ }
    ctx.api.notify('success', 'Object URL copied', url);
  } else if (id === 'share' && row) {
    const result = await ctx.run(cli(['aws', 's3', 'presign', uri(row.key)], { '--expires-in': 3600 }));
    if (result.ok) ctx.api.notify('success', 'Presigned URL created', String(result.output || '').trim());
  } else if (id === 'calc') {
    const keys = selectedRows.value;
    const all = rows(ctx.view.value, 's3.objects').filter(o => o.bucket === props.bucket.name
      && keys.some(k => (k.folder ? String(o.key).startsWith(k.key) : o.key === k.key)));
    ctx.api.notify('info', 'Total size', `${all.length} object(s), ${bytes(all.reduce((s, o) => s + (Number(o.size) || 0), 0))}`);
  }
}
async function createFolder() {
  busy.value = true;
  const key = `${props.prefix}${folderName.value}/`;
  const result = await ctx.run(cli(['aws', 's3api', 'put-object'], { '--bucket': props.bucket.name, '--key': key }),
    `Successfully created folder "${folderName.value}".`);
  busy.value = false;
  if (result.ok) { folderOpen.value = false; folderName.value = ''; }
}
async function upload() {
  busy.value = true;
  let ok = 0;
  for (const path of chosen.value) {
    const result = await ctx.run(cli(['aws', 's3', 'cp', path, uri(props.prefix + leaf(path))]));
    if (result.ok) ok += 1;
  }
  busy.value = false;
  if (ok) {
    ctx.api.notify('success', 'Upload succeeded', `${ok} file(s) uploaded to s3://${props.bucket.name}/${props.prefix}`);
    uploadOpen.value = false;
    chosen.value = [];
  }
}
async function removeSelected() {
  busy.value = true;
  let ok = 0;
  for (const row of selectedRows.value) {
    const command = row.folder
      ? cli(['aws', 's3', 'rm', uri(row.key)], { '--recursive': true })
      : cli(['aws', 's3', 'rm', uri(row.key)]);
    const result = await ctx.run(command);
    if (result.ok) ok += 1;
  }
  busy.value = false;
  deleting.value = false;
  selected.value = [];
  if (ok) ctx.api.notify('success', `Successfully deleted ${ok} object(s)`);
}
</script>

<style scoped>
.s3o__name { display: inline-flex; align-items: center; gap: 8px; }
.s3o__icon { color: #424650; }
.s3o__p { margin: 0 0 14px; color: #424650; }
.s3o__files { margin: 0 0 14px; }
.s3o__cb { accent-color: #006ce0; }
.s3o__preview { margin-top: 20px; }
</style>
