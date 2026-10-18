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
                  <button type="button" class="dd-icon-btn dd-icon-btn--danger" title="Delete" aria-label="Delete" :disabled="!runningUser"
                          @click="deleteFile(f.path)"><DdIcon name="trash" /></button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!runningUser" class="dd-muted vd-note">Files can be deleted while a running container has the volume mounted.</p>
        </div>
      </div>

      <div v-else class="dd-empty">
        <DdIcon name="download" :size="48" class="dd-empty__art" />
        <h2>No exports yet</h2>
        <p>Exporting a volume to a local file or registry needs a Docker account and is not available in this lab.</p>
      </div>
    </template>

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
import DdModal from './DdModal.vue';
import { cmd, containers, volumes, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const volume = computed(() => volumes(props.view).find(v => v.name === props.route.id));
const tab = computed(() => props.route.tab === 'data' || props.route.tab === 'exports' ? props.route.tab : 'containers');
const users = computed(() => containers(props.view).filter(c => volume.value?.used_by.includes(c.name)));
const runningUser = computed(() => users.value.find(c => c.status === 'running'));
const files = computed(() => volume.value?.files || []);
const deleting = ref(false);

function setTab(value: string) { emit('go', { page: 'volumes', id: props.route.id, tab: value }); }

async function deleteFile(path: string) {
  const user = runningUser.value;
  if (!user || !volume.value) return;
  const target = (user.mount_list || []).find(m => m.source === volume.value!.name)?.target || '';
  const full = `${target.replace(/\/$/, '')}/${path.replace(/\/$/, '')}`;
  await props.api.exec(cmd.rmFile(user.name, full), { success: `Deleted ${path}` });
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
</style>
