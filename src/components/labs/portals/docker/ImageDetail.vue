<template>
  <section class="dd-page">
    <div v-if="!image" class="dd-empty">
      <h2>This image is no longer on your machine</h2>
      <button type="button" class="dd-btn dd-btn--primary" @click="$emit('go', { page: 'images' })">Back to Images</button>
    </div>
    <template v-else>
      <div class="dd-detail-head">
        <button type="button" class="dd-icon-btn" aria-label="Back" title="Back" @click="$emit('go', { page: 'images' })"><DdIcon name="back" :size="20" /></button>
        <DdIcon name="images" :size="30" class="idt-icon" />
        <div class="dd-detail-title">
          <h1>{{ image.dangling ? '<none>' : `${image.repository}:${image.tag}` }}</h1>
          <div class="dd-detail-meta">
            <span class="dd-mono">{{ image.id }}</span>
            <button type="button" class="idt-copy" title="Copy" aria-label="Copy image ID" @click="copyText('sha256:' + image.id)"><DdIcon name="copy" :size="13" /></button>
            <span>{{ image.created }}</span>
            <span>{{ fmtSize(image.size_mb, image.size) }}</span>
            <span class="dd-status"><span class="dd-dot" :class="{ 'dd-dot--green': image.in_use }"></span>{{ image.in_use ? 'In use' : 'Unused' }}</span>
          </div>
        </div>
        <div class="dd-actions-inner">
          <button type="button" class="dd-btn dd-btn--primary" @click="running = true"><DdIcon name="play" :size="14" /> Run</button>
          <DdMenu :items="menu" label="More options" @select="action" />
          <button type="button" class="dd-icon-btn dd-icon-btn--danger" title="Delete" aria-label="Delete" @click="deleting = true"><DdIcon name="trash" :size="18" /></button>
        </div>
      </div>

      <div class="idt-grid">
        <div class="dd-box idt-panel">
          <div class="idt-panel__head">
            <strong>Image hierarchy</strong>
          </div>
          <ul class="idt-tree">
            <li><DdIcon name="images" :size="15" /> {{ base }} <span class="dd-muted">(base image)</span></li>
            <li class="idt-tree__self"><DdIcon name="images" :size="15" /> {{ image.dangling ? image.id : `${image.repository}:${image.tag}` }}</li>
          </ul>
          <div class="idt-panel__head"><strong>Layers ({{ layers.length }})</strong></div>
          <ol class="idt-layers">
            <li v-for="layer in layers" :key="layer.index" :class="{ 'is-open': open === layer.index }" @click="open = open === layer.index ? -1 : layer.index">
              <span class="idt-layers__n">{{ layer.index }}</span>
              <code>{{ layer.instruction }}</code>
              <span class="dd-muted">{{ layer.size_mb ? fmtSize(layer.size_mb) : '0 B' }}</span>
              <span v-if="open === layer.index" class="idt-layers__digest dd-mono">{{ layer.digest }}</span>
            </li>
          </ol>
        </div>
        <div class="idt-side">
          <div class="dd-box idt-panel">
            <div class="idt-panel__head"><strong>Used by</strong></div>
            <p v-if="!image.used_by?.length" class="dd-muted idt-pad">No container is using this image.</p>
            <ul v-else class="idt-tree">
              <li v-for="name in image.used_by" :key="name"><DdIcon name="containers" :size="15" />
                <button type="button" class="dd-link" @click="$emit('go', { page: 'containers', id: name })">{{ name }}</button></li>
            </ul>
          </div>
          <div class="dd-box idt-panel">
            <div class="idt-panel__head"><strong>Vulnerabilities</strong></div>
            <p class="dd-muted idt-pad">Docker Scout analysis is not available in this lab, so no packages or CVEs are listed.
              Nothing here means "not analysed", not "no vulnerabilities".</p>
          </div>
        </div>
      </div>
    </template>

    <RunDialog v-if="running && image" :image="ref_" :api="api" :busy="busy" @close="running = false"
               @ran="name => { running = false; $emit('go', { page: 'containers', id: name, tab: 'logs' }); }" />
    <DdModal v-if="deleting && image" title="Delete image?" @close="deleting = false">
      <p>Delete <b>{{ ref_ }}</b> from your machine? You can pull it again later.</p>
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
import RunDialog from './RunDialog.vue';
import { cmd, copyText, fmtSize, imageRef, images, type DdRoute, type MenuItem } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const image = computed(() => {
  const id = String(props.route.id || '');
  const ref = id.includes(':') ? id : `${id}:latest`;
  return images(props.view).find(i => imageRef(i) === id || `${i.repository}:${i.tag}` === ref || i.id === id);
});
const ref_ = computed(() => image.value ? imageRef(image.value) : '');
const layers = computed(() => image.value?.layer_list || []);
const base = computed(() => {
  const from = layers.value.find(l => /^FROM\s/i.test(l.instruction));
  return from ? from.instruction.split(/\s+/)[1] : 'scratch';
});
const open = ref(-1);
const running = ref(false);
const deleting = ref(false);
const menu: MenuItem[] = [
  { key: 'pull', label: 'Pull', icon: 'download' },
  { key: 'push', label: 'Push to Hub', icon: 'external' },
  { key: 'copy', label: 'Copy image ID', icon: 'copy' },
];

async function action(key: string) {
  if (!image.value) return;
  if (key === 'pull') await props.api.exec(cmd.pull(ref_.value), { success: `Pulled ${ref_.value}` });
  else if (key === 'push') await props.api.exec(cmd.push(ref_.value), { success: `Pushed ${ref_.value}`, failure: `Push failed for ${ref_.value}` });
  else copyText('sha256:' + image.value.id);
}
async function confirmDelete() {
  const result = await props.api.exec(cmd.rmi([ref_.value]), { success: `Deleted ${ref_.value}` });
  if (result.ok) { deleting.value = false; emit('go', { page: 'images' }); }
}
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.idt-icon { color: var(--dd-blue); }
.idt-copy { border: 0; background: none; color: var(--dd-text-2); cursor: pointer; padding: 2px; }
.idt-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: 14px; align-items: start; }
.idt-side { display: flex; flex-direction: column; gap: 14px; }
.idt-panel { overflow: hidden; }
.idt-panel__head { padding: 10px 14px; border-bottom: 1px solid var(--dd-border); font-size: 0.875rem; background: #FAFAFB; }
.idt-panel__head strong { font-weight: 500; }
.idt-pad { margin: 0; padding: 12px 14px; font-size: 0.8125rem; line-height: 1.5; }
.idt-tree { list-style: none; margin: 0; padding: 8px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 0.8125rem; }
.idt-tree li { display: flex; align-items: center; gap: 8px; }
.idt-tree svg { color: var(--dd-text-2); }
.idt-tree__self { padding-left: 18px; font-weight: 500; }
.idt-layers { list-style: none; margin: 0; padding: 0; }
.idt-layers li { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--dd-border); font-size: 0.8125rem; cursor: pointer; }
.idt-layers li:hover, .idt-layers li.is-open { background: var(--dd-hover); }
.idt-layers code { color: var(--dd-text); background: none; padding: 0; font-family: var(--dd-mono); font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.idt-layers li.is-open code { white-space: normal; word-break: break-all; }
.idt-layers__n { color: var(--dd-text-2); text-align: right; }
.idt-layers__digest { grid-column: 2 / -1; font-size: 0.6875rem; color: var(--dd-text-2); word-break: break-all; }
@container sl-portal (max-width: 760px) { .idt-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
