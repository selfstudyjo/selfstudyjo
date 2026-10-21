<template>
  <section class="dd-page">
    <div v-if="!volume" class="dd-empty">
      <h2>This volume no longer exists</h2>
      <button type="button" class="dd-btn dd-btn--primary" @click="$emit('go', { page: 'volumes' })">Back to Volumes</button>
    </div>
    <template v-else>
      <div class="dd-detail-head">
        <button type="button" class="dd-icon-btn" aria-label="Back" title="Back" @click="$emit('go', { page: 'volumes' })"><DdIcon name="back" :size="20" /></button>
        <DdIcon name="volumes" :size="30" class="vd-icon" />
        <div class="dd-detail-title">
          <h1>{{ volume.name }}</h1>
          <div class="dd-detail-meta">
            <span class="dd-status"><span class="dd-dot" :class="{ 'dd-dot--green': volume.used_by.length }"></span>{{ volume.used_by.length ? 'In use' : 'Unused' }}</span>
            <span>Created {{ volume.created_ago }}</span>
            <span>{{ volume.size }}</span>
            <span class="dd-mono">{{ volume.mountpoint }}</span>
          </div>
        </div>
        <button type="button" class="dd-btn dd-btn--danger-outline" @click="deleting = true"><DdIcon name="trash" :size="14" /> Delete</button>
      </div>

      <nav class="dd-tabs" aria-label="Volume details">
        <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'containers' }" @click="setTab('containers')">Container in-use</button>
        <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'data' }" @click="setTab('data')">Stored data</button>
        <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'exports' }" @click="setTab('exports')">Exports</button>
      </nav>

      <div v-if="tab === 'containers'">
        <div v-if="!users.length" class="dd-empty"><h2>No container is using this volume</h2>
          <p>Mount it with <span class="dd-mono">-v {{ volume.name }}:/path</span>, or from the Run dialog's Volumes field.</p></div>
        <div v-else class="dd-table-wrap">
          <table class="dd-table">
            <thead><tr><th>Container</th><th>Image</th><th>Status</th><th>Mounted to</th></tr></thead>
            <tbody>
              <tr v-for="c in users" :key="c.id">
                <td><button type="button" class="dd-link" @click="$emit('go', { page: 'containers', id: c.name })">{{ c.name }}</button></td>
                <td>{{ c.image }}</td>
                <td><span class="dd-status"><span class="dd-dot" :class="{ 'dd-dot--green': c.status === 'running' }"></span>{{ c.status }}</span></td>
                <td class="dd-mono">{{ (c.mount_list || []).find(m => m.source === volume!.name)?.target || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else-if="tab === 'data'">
        <div v-if="!files.length" class="dd-empty"><h2>This volume is empty</h2>
          <p>Files written into the mount point by a container are stored here and survive the container being deleted.</p></div>
        <div v-else class="dd-table-wrap">
          <table class="dd-table">
            <thead><tr><th>Name</th><th>Size</th><th class="dd-actions">Actions</th></tr></thead>
            <tbody>
              <tr v-for="f in files" :key="f.path">
                <td><span class="vd-file"><DdIcon :name="f.dir ? 'folder' : 'file'" :size="15" /> {{ f.path.replace(/\/$/, '') }}</span></td>
                <td>{{ f.dir ? '-' : f.bytes + ' B' }}</td>
                <td class="dd-actions">
                  <DdMenu :items="fileMenu(f)" :label="`Actions for ${f.path}`" :disabled="!runningUser" @select="key => fileAction(key, f)" />
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!runningUser" class="dd-muted vd-note">Files can be opened, saved and deleted while a running container has the volume mounted (through <span class="dd-mono">docker exec</span> and <span class="dd-mono">docker cp</span>).</p>
          <p v-else class="dd-muted vd-note">Read and written through <b>{{ runningUser.name }}</b>, mounted at <span class="dd-mono">{{ mountTarget }}</span>.</p>
        </div>
        <div v-if="openPath" class="dd-box vd-editor">
          <div class="vd-editor__bar">
            <span class="dd-mono">{{ openPath }}</span>
            <span class="dd-spacer"></span>
            <button type="button" class="dd-btn dd-btn--ghost" @click="openPath = ''">Close</button>
            <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || body === saved" @click="saveOpen">Save</button>
          </div>
          <textarea v-model="body" class="dd-textarea vd-editor__text" rows="12" spellcheck="false" aria-label="File contents"></textarea>
        </div>
      </div>

      <div v-else class="dd-empty">
        <DdIcon name="download" :size="48" class="dd-empty__art" />
        <h2>No exports yet</h2>
        <p>Exporting a volume to a local file or registry needs a Docker account and is not available in this lab.</p>
      </div>
    </template>

    <DdModal v-if="removing && volume" title="Delete from volume?" @close="removing = null">
      <p><span class="dd-mono">{{ removing.path.replace(/\/$/, '') }}</span> will be deleted from <b>{{ volume.name }}</b>. This cannot be undone.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="removing = null">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmRemove">Delete</button>
      </template>
    </DdModal>
    <DdModal v-if="savingAs" title="Save as" @close="savingAs = null">
      <div class="dd-field"><label for="vd-save">Save to (workspace path)</label>
        <input id="vd-save" v-model="saveTarget" class="dd-input dd-mono" /></div>
      <p class="dd-muted">Copied out with <span class="dd-mono">docker cp</span> into this lab's workspace.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="savingAs = null">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="!saveTarget.trim() || busy" @click="confirmSaveAs">Save</button>
      </template>
    </DdModal>
    <DdModal v-if="deleting && volume" title="Delete volume?" @close="deleting = false">
      <p>Are you sure you want to delete <b>{{ volume.name }}</b>? All the data in it is deleted and cannot be recovered.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="deleting = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmDelete">Delete forever</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdMenu from './DdMenu.vue';
import DdModal from './DdModal.vue';
import { cmd, containers, volumes, type DdRoute, type MenuItem } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const volume = computed(() => volumes(props.view).find(v => v.name === props.route.id));
const tab = computed(() => props.route.tab === 'data' || props.route.tab === 'exports' ? props.route.tab : 'containers');
const users = computed(() => containers(props.view).filter(c => volume.value?.used_by.includes(c.name)));
const runningUser = computed(() => users.value.find(c => c.status === 'running'));
const files = computed(() => volume.value?.files || []);
const deleting = ref(false);

function setTab(value: string) { emit('go', { page: 'volumes', id: props.route.id, tab: value }); }

const mountTarget = computed(() => (runningUser.value?.mount_list || [])
  .find(m => m.source === volume.value?.name)?.target || '');
function fullPath(path: string) { return `${mountTarget.value.replace(/\/$/, '')}/${path.replace(/\/$/, '')}`; }

type StoredFile = { path: string; dir: boolean; bytes: number };
const openPath = ref('');
const body = ref('');
const saved = ref('');
const savingAs = ref<StoredFile | null>(null);
const saveTarget = ref('');

function fileMenu(f: StoredFile): MenuItem[] {
  return [
    { key: 'open', label: f.dir ? 'Open in container Files' : 'Edit file', icon: f.dir ? 'folder' : 'file' },
    { key: 'saveas', label: 'Save as…', icon: 'download' },
    { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
  ];
}

async function fileAction(key: string, f: StoredFile) {
  const user = runningUser.value;
  if (!user) return;
  if (key === 'delete') return deleteFile(f);
  if (key === 'saveas') { savingAs.value = f; saveTarget.value = f.path.replace(/\/$/, '').split('/').pop() || 'export'; return; }
  if (f.dir) { emit('go', { page: 'containers', id: user.name, tab: 'files' }); return; }
  const result = await props.api.exec(cmd.cat(user.name, fullPath(f.path)), { quiet: true, unlogged: true });
  if (!result.ok) { props.api.notify('error', `Could not open ${f.path}`, String(result.error || '')); return; }
  openPath.value = fullPath(f.path);
  body.value = String(result.output || '');
  saved.value = body.value;
}

async function saveOpen() {
  const user = runningUser.value;
  if (!user || !openPath.value) return;
  const result = await props.api.exec(cmd.write(user.name, openPath.value, body.value), { success: `Saved ${openPath.value}` });
  if (result.ok) saved.value = body.value;
}

async function confirmSaveAs() {
  const user = runningUser.value;
  if (!user || !savingAs.value) return;
  const result = await props.api.exec(cmd.cpOut(user.name, fullPath(savingAs.value.path), saveTarget.value.trim()),
    { success: `Saved ${saveTarget.value.trim()} to the workspace` });
  if (result.ok) savingAs.value = null;
}

const removing = ref<StoredFile | null>(null);
function deleteFile(f: StoredFile) { removing.value = f; }

async function confirmRemove() {
  const user = runningUser.value;
  const f = removing.value;
  if (!user || !f) return;
  const full = fullPath(f.path);
  const result = await props.api.exec(f.dir ? cmd.rmTree(user.name, full) : cmd.rmFile(user.name, full), { success: `Deleted ${f.path}` });
  if (result.ok) {
    if (openPath.value === full) openPath.value = '';
    removing.value = null;
  }
}

async function confirmDelete() {
  if (!volume.value) return;
  const name = volume.value.name;
  const result = await props.api.exec(cmd.volumeRm([name]), { success: `Deleted ${name}` });
  if (result.ok) { deleting.value = false; emit('go', { page: 'volumes' }); }
}
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.vd-icon { color: var(--dd-blue); }
.vd-file { display: inline-flex; align-items: center; gap: 8px; font-family: var(--dd-mono); font-size: 13px; }
.vd-file svg { color: var(--dd-text-2); }
.vd-note { font-size: 13px; padding: 8px 12px; margin: 0; }
.vd-editor { margin-top: 12px; display: flex; flex-direction: column; }
.vd-editor__bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--dd-border); flex-wrap: wrap; }
.vd-editor__text { border: 0; border-radius: 0 0 6px 6px; min-height: 220px; font-family: var(--dd-mono); font-size: 13px; }
.dd-spacer { flex: 1; }
</style>
