<template>
  <section class="dd-page">
    <div class="dd-head">
      <h1>Builds</h1>
      <span class="dd-spacer"></span>
      <button type="button" class="dd-feedback"><DdIcon name="feedback" :size="15" /> Give feedback</button>
      <button type="button" class="dd-btn dd-btn--ghost" @click="api.notify('info', 'Builder settings', 'This lab builds with the default builder (desktop-linux, docker driver).')">Builder settings</button>
      <button type="button" class="dd-btn dd-btn--primary" @click="openBuild"><DdIcon name="builds" :size="15" /> Build</button>
    </div>

    <nav class="dd-tabs" aria-label="Builds">
      <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'history' }" @click="setTab('history')">Build history</button>
      <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'active' }" @click="setTab('active')">Active builds</button>
    </nav>

    <div v-if="tab === 'active'" class="dd-empty">
      <DdIcon name="builds" :size="56" class="dd-empty__art" />
      <h2>No active builds</h2>
      <p>Builds in progress appear here. A build in this lab finishes as soon as it starts, and then moves to Build history.</p>
    </div>
    <template v-else>
      <div class="dd-toolbar">
        <template v-if="selected.length">
          <span class="dd-selected"><b>{{ selected.length }}</b> selected</span>
          <button type="button" class="dd-btn dd-btn--danger-outline" @click="deleting = [...selected]"><DdIcon name="trash" :size="14" /> Delete</button>
          <button type="button" class="dd-link" @click="selected = []">Clear selection</button>
        </template>
        <label v-else class="dd-search"><DdIcon name="search" :size="16" /><input v-model="filter" type="search" placeholder="Search" aria-label="Search builds" /></label>
      </div>
      <div v-if="!list.length" class="dd-empty">
        <DdIcon name="builds" :size="56" class="dd-empty__art" />
        <h2>No builds yet</h2>
        <p>Build an image with <span class="dd-mono">docker build -t myapp:1.0 .</span> and it shows up here with its logs, source and timing.</p>
      </div>
      <div v-else class="dd-table-wrap">
        <table class="dd-table">
          <thead><tr>
            <th class="dd-check"><input type="checkbox" class="dd-cb" aria-label="Select all" :checked="allChecked" @change="toggleAll" /></th>
            <th>Name</th><th>Builder</th><th>Duration</th><th>Created</th><th>Author</th><th class="dd-actions">Actions</th>
          </tr></thead>
          <tbody>
            <tr v-for="b in shown" :key="b.id" :class="{ 'is-selected': selected.includes(b.id) }">
              <td class="dd-check"><input type="checkbox" class="dd-cb" :aria-label="`Select ${b.name}`" :checked="selected.includes(b.id)" @change="toggle(b.id)" /></td>
              <td>
                <div class="dd-name-cell">
                  <DdIcon :name="b.status === 'completed' ? 'check' : 'error'" :size="18" :class="b.status === 'completed' ? 'bv-ok' : 'bv-bad'" />
                  <div class="dd-name-lines">
                    <button type="button" class="dd-link bv-name" @click="$emit('go', { page: 'builds', id: b.id })">{{ b.name }}</button>
                    <small class="dd-mono">{{ b.dockerfile }} · {{ b.id.slice(0, 12) }}</small>
                  </div>
                </div>
              </td>
              <td>desktop-linux</td>
              <td>{{ b.duration }}s</td>
              <td>{{ b.created }}</td>
              <td>student</td>
              <td class="dd-actions">
                <span class="dd-actions-inner">
                  <button type="button" class="dd-icon-btn" title="Rebuild" aria-label="Rebuild" @click="rebuild(b)"><DdIcon name="restart" /></button>
                  <button type="button" class="dd-icon-btn dd-icon-btn--danger" title="Delete" aria-label="Delete" @click="deleting = [b.id]"><DdIcon name="trash" /></button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <DdModal v-if="building" title="Build an image" subtitle="Build context: the lab's working directory (.)" @close="building = false">
      <div class="dd-field">
        <label for="bv-df">Dockerfile</label>
        <select v-if="dockerfiles.length" id="bv-df" v-model="dockerfile" class="dd-select">
          <option v-for="f in dockerfiles" :key="f" :value="f">{{ f }}</option>
        </select>
        <input v-else id="bv-df" v-model="dockerfile" class="dd-input" />
        <small v-if="!dockerfiles.length">No Dockerfile found yet — write one with the Files tool.</small>
      </div>
      <div class="dd-field">
        <label for="bv-tag">Tag</label>
        <input id="bv-tag" v-model="tag" class="dd-input" :class="{ 'is-invalid': tagError }" placeholder="myapp:1.0" />
        <small v-if="!tagError">name:tag for the new image. Leave empty for an untagged image.</small>
        <span v-else class="dd-err">{{ tagError }}</span>
      </div>
      <p class="dd-mono dd-muted">{{ cmd.build(tag.trim(), dockerfile) }}</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="building = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || !!tagError || !dockerfile" @click="build">Build</button>
      </template>
    </DdModal>

    <DdModal v-if="deleting.length" :title="deleting.length > 1 ? 'Delete build records?' : 'Delete build record?'" @close="deleting = []">
      <p>The build record{{ deleting.length > 1 ? 's' : '' }} and {{ deleting.length > 1 ? 'their' : 'its' }} logs are deleted from the build history.
        Images the build produced are kept.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="deleting = []">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmDelete">Delete</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches, pick } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdModal from './DdModal.vue';
import { builds, cmd, type Build, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const tab = computed(() => props.route.tab === 'active' ? 'active' : 'history');
function setTab(value: string) { emit('go', { page: 'builds', tab: value }); }

const filter = ref('');
const selected = ref<string[]>([]);
const deleting = ref<string[]>([]);
const building = ref(false);
const list = computed(() => builds(props.view));
const shown = computed(() => list.value.filter(b => matches(b as any, filter.value, ['name', 'dockerfile', 'id'])));
const allChecked = computed(() => shown.value.length > 0 && shown.value.every(b => selected.value.includes(b.id)));
const dockerfiles = computed(() => pick<string[]>(props.view, 'dockerfiles', []));
const dockerfile = ref('Dockerfile');
const tag = ref('');
const tagError = computed(() => !tag.value.trim() || /^[a-z0-9]+([._/-][a-z0-9]+)*(:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?$/.test(tag.value.trim())
  ? '' : 'invalid reference format: repository name must be lowercase');

function toggle(id: string) { selected.value = selected.value.includes(id) ? selected.value.filter(x => x !== id) : [...selected.value, id]; }
function toggleAll() { selected.value = allChecked.value ? [] : shown.value.map(b => b.id); }
function openBuild() { dockerfile.value = dockerfiles.value[0] || 'Dockerfile'; tag.value = ''; building.value = true; }

async function build() {
  const result = await props.api.exec(cmd.build(tag.value.trim(), dockerfile.value),
                                      { success: `Built ${tag.value.trim() || 'image'}`, failure: 'Build failed' });
  building.value = false;
  const latest = builds(props.view)[0];
  if (latest) emit('go', { page: 'builds', id: latest.id, tab: result.ok ? 'info' : 'error' });
}
async function rebuild(b: Build) {
  const tagged = b.image || (b.name.includes(':') ? b.name : '');
  await props.api.exec(cmd.build(tagged, b.dockerfile), { success: `Rebuilt ${tagged || b.name}`, failure: 'Build failed' });
}
async function confirmDelete() {
  const ids = deleting.value;
  const result = await props.api.exec(cmd.buildRm(ids), { success: ids.length > 1 ? `Deleted ${ids.length} build records` : 'Deleted build record' });
  if (result.ok) { deleting.value = []; selected.value = selected.value.filter(x => !ids.includes(x)); }
}
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.dd-spacer { flex: 1; }
.bv-ok { color: var(--dd-green); }
.bv-bad { color: var(--dd-red); }
.bv-name { font-weight: 500; }
</style>
