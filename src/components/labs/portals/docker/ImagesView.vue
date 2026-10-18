<template>
  <section class="dd-page">
    <div class="dd-head">
      <h1>Images</h1>
      <span class="dd-spacer"></span>
      <button type="button" class="dd-feedback"><DdIcon name="feedback" :size="15" /> Give feedback</button>
    </div>

    <nav class="dd-tabs" aria-label="Image sources">
      <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'local' }" @click="setTab('local')">Local</button>
      <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'hub' }" @click="setTab('hub')">My Hub</button>
    </nav>

    <template v-if="tab === 'local'">
      <div class="iv-summary">
        <span><b>{{ inUseSize }}</b> / {{ totalSize }} in use</span>
        <span class="dd-muted">{{ list.length }} image{{ list.length === 1 ? '' : 's' }}</span>
        <span class="dd-spacer"></span>
        <span class="dd-muted iv-refresh">Last refresh: just now
          <button type="button" class="dd-icon-btn" aria-label="Refresh" title="Refresh" @click="$emit('refresh')"><DdIcon name="refresh" :size="15" /></button>
        </span>
      </div>

      <div class="dd-toolbar">
        <template v-if="selected.length">
          <span class="dd-selected"><b>{{ selected.length }}</b> selected</span>
          <button type="button" class="dd-btn dd-btn--danger-outline" @click="deleting = [...selected]"><DdIcon name="trash" :size="14" /> Delete</button>
          <button type="button" class="dd-link" @click="selected = []">Clear selection</button>
        </template>
        <template v-else>
          <label class="dd-search"><DdIcon name="search" :size="16" /><input v-model="filter" type="search" placeholder="Search" aria-label="Search images" /></label>
          <select v-model="show" class="dd-select iv-show" aria-label="Filter images">
            <option value="all">All images</option>
            <option value="used">In use</option>
            <option value="unused">Unused</option>
            <option value="dangling">Dangling</option>
          </select>
          <span class="dd-spacer"></span>
          <button type="button" class="dd-btn dd-btn--ghost" :disabled="!unused.length" @click="openCleanup">Clean up</button>
          <button type="button" class="dd-btn dd-btn--primary" @click="pullOpen = true"><DdIcon name="download" :size="15" /> Pull</button>
        </template>
      </div>

      <div v-if="!list.length" class="dd-empty">
        <DdIcon name="images" :size="64" class="dd-empty__art" />
        <h2>No images on your machine yet</h2>
        <p>Images are templates for containers. Pull one from <button type="button" class="dd-link" @click="setTab('hub')">Docker Hub</button>,
          or build one from a Dockerfile.</p>
      </div>
      <div v-else class="dd-table-wrap">
        <table class="dd-table">
          <thead><tr>
            <th class="dd-check"><input type="checkbox" class="dd-cb" aria-label="Select all" :checked="allChecked" @change="toggleAll" /></th>
            <th class="sortable" @click="sort('repository')">Name {{ arrow('repository') }}</th>
            <th class="sortable" @click="sort('tag')">Tag {{ arrow('tag') }}</th>
            <th>Image ID</th>
            <th class="sortable" @click="sort('created_at')">Created {{ arrow('created_at') }}</th>
            <th class="sortable" @click="sort('size_mb')">Size {{ arrow('size_mb') }}</th>
            <th class="dd-actions">Actions</th>
          </tr></thead>
          <tbody>
            <tr v-for="image in shown" :key="image.id + image.tag" :class="{ 'is-selected': selected.includes(imageRef(image)) }">
              <td class="dd-check"><input type="checkbox" class="dd-cb" :aria-label="`Select ${imageRef(image)}`" :checked="selected.includes(imageRef(image))" @change="toggle(imageRef(image))" /></td>
              <td>
                <div class="dd-name-lines">
                  <button type="button" class="dd-link iv-name" @click="$emit('go', { page: 'images', id: imageRef(image) })">{{ imageName(image) }}</button>
                  <span class="dd-status"><span class="dd-dot" :class="{ 'dd-dot--green': image.in_use }"></span>{{ image.in_use ? 'In use' : image.dangling ? 'Dangling' : 'Unused' }}</span>
                </div>
              </td>
              <td>{{ image.dangling ? '<none>' : image.tag }}</td>
              <td><span class="dd-mono">{{ image.id }}</span>
                <button type="button" class="iv-copy" title="Copy" aria-label="Copy image ID" @click="copyText('sha256:' + image.id)"><DdIcon name="copy" :size="13" /></button></td>
              <td>{{ image.created }}</td>
              <td>{{ fmtSize(image.size_mb, image.size) }}</td>
              <td class="dd-actions">
                <span class="dd-actions-inner">
                  <button type="button" class="dd-icon-btn dd-icon-btn--blue" title="Run" aria-label="Run" @click="running = imageRef(image)"><DdIcon name="play" /></button>
                  <DdMenu :items="menu(image)" label="More options" @select="key => imageAction(image, key)" />
                  <button type="button" class="dd-icon-btn dd-icon-btn--danger" title="Delete" aria-label="Delete" @click="deleting = [imageRef(image)]"><DdIcon name="trash" /></button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <HubTab v-else :view="view" :api="api" :busy="busy" @run="ref_ => (running = ref_)" />

    <RunDialog v-if="running" :image="running" :api="api" :busy="busy" @close="running = ''" @ran="ran" />

    <DdModal v-if="deleting.length" :title="deleting.length > 1 ? 'Delete images?' : 'Delete image?'" @close="deleting = []">
      <p v-if="deleting.length === 1">Delete <b>{{ deleting[0] }}</b> from your machine? You can pull it again later.</p>
      <p v-else>Delete these {{ deleting.length }} images: <b>{{ deleting.join(', ') }}</b>?</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="deleting = []">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmDelete">Delete forever</button>
      </template>
    </DdModal>

    <DdModal v-if="cleaning" title="Clean up images" subtitle="Remove images no container is using to reclaim disk space" @close="cleaning = false">
      <div class="iv-clean">
        <label v-for="image in unused" :key="imageRef(image)" class="iv-clean__row">
          <input v-model="cleanPick" type="checkbox" class="dd-cb" :value="imageRef(image)" />
          <span class="dd-mono">{{ image.dangling ? '<none>' : imageRef(image) }}</span>
          <span class="dd-spacer"></span>
          <span class="dd-muted">{{ fmtSize(image.size_mb, image.size) }}</span>
        </label>
      </div>
      <p class="dd-muted">{{ cleanPick.length }} selected · {{ cleanSize }} to reclaim</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="cleaning = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy || !cleanPick.length" @click="confirmCleanup">Remove</button>
      </template>
    </DdModal>

    <DdModal v-if="tagging" title="Tag image" :subtitle="tagging" @close="tagging = ''">
      <div class="dd-field">
        <label for="iv-tag">New name</label>
        <input id="iv-tag" v-model="tagValue" class="dd-input" placeholder="repository:tag" :class="{ 'is-invalid': tagError }" />
        <small v-if="!tagError">Adds a second name to the same image (<span class="dd-mono">docker tag</span>). Nothing is copied.</small>
        <span v-else class="dd-err">{{ tagError }}</span>
      </div>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="tagging = ''">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || !!tagError || !tagValue" @click="confirmTag">Tag</button>
      </template>
    </DdModal>

    <DdModal v-if="pullOpen" title="Pull an image" @close="pullOpen = false">
      <div class="dd-field">
        <label for="iv-pull">Image</label>
        <input id="iv-pull" v-model="pullRef" class="dd-input" placeholder="nginx:latest" @keydown.enter="confirmPull" />
        <small>Pulled from the lab's registry, as <span class="dd-mono">docker pull</span> would.</small>
      </div>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="pullOpen = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || !pullRef.trim()" @click="confirmPull">Pull</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches, sortBy } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdMenu from './DdMenu.vue';
import DdModal from './DdModal.vue';
import RunDialog from './RunDialog.vue';
import HubTab from './HubTab.vue';
import { cmd, copyText, fmtSize, imageName, imageRef, images, type DdRoute, type Image, type MenuItem } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const tab = computed(() => props.route.tab === 'hub' ? 'hub' : 'local');
function setTab(value: string) { emit('go', { page: 'images', tab: value }); }

const filter = ref('');
const show = ref('all');
const selected = ref<string[]>([]);
const key = ref('repository');
const dir = ref<'asc' | 'desc'>('asc');
const running = ref('');
const deleting = ref<string[]>([]);
const cleaning = ref(false);
const cleanPick = ref<string[]>([]);
const tagging = ref('');
const tagValue = ref('');
const pullOpen = ref(false);
const pullRef = ref('');

const list = computed(() => images(props.view));
const unused = computed(() => list.value.filter(i => !i.in_use));
const shown = computed(() => sortBy(list.value
  .filter(i => show.value === 'all' || (show.value === 'used' ? i.in_use : show.value === 'unused' ? !i.in_use : i.dangling))
  .filter(i => matches(i as any, filter.value, ['repository', 'tag', 'id'])) as any[], key.value, dir.value) as Image[]);
function mb(value: number) { return fmtSize(value, '0 B'); }
const totalSize = computed(() => mb(list.value.reduce((s, i) => s + (i.size_mb || 0), 0)));
const inUseSize = computed(() => mb(list.value.filter(i => i.in_use).reduce((s, i) => s + (i.size_mb || 0), 0)));
const cleanSize = computed(() => mb(list.value.filter(i => cleanPick.value.includes(imageRef(i))).reduce((s, i) => s + (i.size_mb || 0), 0)));
const allChecked = computed(() => shown.value.length > 0 && shown.value.every(i => selected.value.includes(imageRef(i))));
const tagError = computed(() => !tagValue.value || /^[a-z0-9]+([._/-][a-z0-9]+)*(:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?$/.test(tagValue.value)
  ? '' : 'Invalid reference format: repository name must be lowercase.');

function sort(column: string) {
  if (key.value === column) dir.value = dir.value === 'asc' ? 'desc' : 'asc';
  else { key.value = column; dir.value = 'asc'; }
}
function arrow(column: string) { return key.value === column ? (dir.value === 'asc' ? '↑' : '↓') : ''; }
function toggle(ref_: string) {
  selected.value = selected.value.includes(ref_) ? selected.value.filter(r => r !== ref_) : [...selected.value, ref_];
}
function toggleAll() { selected.value = allChecked.value ? [] : shown.value.map(imageRef); }

function menu(image: Image): MenuItem[] {
  return [
    { key: 'pull', label: 'Pull', icon: 'download', disabled: image.dangling },
    { key: 'push', label: 'Push to Hub', icon: 'external', disabled: image.dangling },
    { key: 'tag', label: 'Tag', icon: 'plus' },
    { key: 'details', label: 'View packages and CVEs', icon: 'scout' },
    { key: 'usage', label: 'View container usage', icon: 'containers', disabled: !image.in_use },
    { key: 'copy', label: 'Copy image ID', icon: 'copy' },
  ];
}

async function imageAction(image: Image, action: string) {
  const ref_ = imageRef(image);
  if (action === 'pull') await props.api.exec(cmd.pull(ref_), { success: `Pulled ${ref_}` });
  else if (action === 'push') await props.api.exec(cmd.push(ref_), { success: `Pushed ${ref_}`, failure: `Push failed for ${ref_}` });
  else if (action === 'tag') { tagging.value = ref_; tagValue.value = image.dangling ? '' : `${image.repository}:v2`; }
  else if (action === 'details') emit('go', { page: 'images', id: ref_ });
  else if (action === 'usage') emit('go', { page: 'containers' });
  else if (action === 'copy') copyText('sha256:' + image.id);
}

async function confirmDelete() {
  const refs = deleting.value;
  const result = await props.api.exec(cmd.rmi(refs), { success: refs.length > 1 ? `Deleted ${refs.length} images` : `Deleted ${refs[0]}` });
  if (result.ok) { deleting.value = []; selected.value = selected.value.filter(r => !refs.includes(r)); }
}

function openCleanup() { cleanPick.value = unused.value.map(imageRef); cleaning.value = true; }
async function confirmCleanup() {
  const everyUnused = cleanPick.value.length === unused.value.length;
  const command = everyUnused ? cmd.imagePrune(true) : cmd.rmi(cleanPick.value);
  const result = await props.api.exec(command, { success: `Removed ${cleanPick.value.length} unused image${cleanPick.value.length > 1 ? 's' : ''}` });
  if (result.ok) cleaning.value = false;
}

async function confirmTag() {
  const result = await props.api.exec(cmd.tag(tagging.value, tagValue.value), { success: `Tagged ${tagging.value} as ${tagValue.value}` });
  if (result.ok) tagging.value = '';
}

async function confirmPull() {
  const ref_ = pullRef.value.trim();
  if (!ref_) return;
  const result = await props.api.exec(cmd.pull(ref_), { success: `Pulled ${ref_}` });
  if (result.ok) { pullOpen.value = false; pullRef.value = ''; }
}

function ran(name: string) {
  running.value = '';
  emit('go', { page: 'containers', id: name, tab: 'logs' });
}
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.dd-spacer { flex: 1; }
.iv-summary { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 14px; }
.iv-summary b { font-weight: 500; }
.iv-refresh { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
.iv-show { width: auto; }
.iv-name { font-weight: 500; }
.iv-copy { border: 0; background: none; color: var(--dd-text-2); cursor: pointer; padding: 2px 4px; opacity: .7; }
.iv-clean { display: flex; flex-direction: column; border: 1px solid var(--dd-border); border-radius: 6px; max-height: 260px; overflow: auto; }
.iv-clean__row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--dd-border); cursor: pointer; }
.iv-clean__row:last-child { border-bottom: 0; }
</style>
