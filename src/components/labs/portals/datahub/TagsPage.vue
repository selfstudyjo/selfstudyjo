<template>
  <div class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1 class="dh-title">Manage Tags</h1>
        <p class="dh-subtitle">Tags are labels anyone can attach to a dataset or a field. Deleting a tag removes it from every asset that carries it.</p>
      </div>
      <button type="button" class="dh-btn dh-btn--primary" @click="openForm(null)"><DhIcon name="plus" /> Create Tag</button>
    </div>
    <div class="dh-tg-bar">
      <input v-model="filter" class="dh-input dh-tg-filter" placeholder="Search tags..." aria-label="Search tags" />
      <span class="dh-muted">{{ shown.length }} tags</span>
    </div>
    <div class="dh-table-wrap">
      <table class="dh-table">
        <thead><tr><th>Tag</th><th>Description</th><th>Datasets</th><th>Fields</th><th></th></tr></thead>
        <tbody>
          <tr v-if="!shown.length"><td colspan="5" class="dh-muted dh-tg-empty">{{ dh.tags.value.length ? 'No tags match your search.' : 'No tags yet. Create one, or add one from a dataset.' }}</td></tr>
          <tr v-for="t in shown" :key="t.name">
            <td><span class="dh-tag"><span class="dh-tag__dot" :style="{ background: t.color || tagColor(t.name) }" /><span class="dh-tag__text">{{ t.name }}</span></span></td>
            <td :class="{ 'dh-muted': !t.description }">{{ t.description || 'No description' }}</td>
            <td><button type="button" class="dh-link" :disabled="!t.datasets" @click="search(t.name)">{{ t.datasets }}</button></td>
            <td>{{ t.fields }}</td>
            <td class="dh-tg-act"><DhMenu :label="'Actions for ' + t.name" :items="actions(t)" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <DhModal v-if="form" :title="form.editing ? 'Edit Tag' : 'Create Tag'" :ok-text="form.editing ? 'Save' : 'Create'"
             :ok-disabled="!form.name.trim()" :busy="dh.busy.value" @close="form = null" @ok="save">
      <div class="dh-field"><span class="dh-label"><b>*</b>Name</span>
        <input v-model="form.name" class="dh-input" :disabled="form.editing" placeholder="e.g. Certified" aria-label="Tag name" /></div>
      <div class="dh-field"><span class="dh-label">Description</span>
        <textarea v-model="form.description" class="dh-textarea" rows="3" aria-label="Description" /></div>
      <div class="dh-field"><span class="dh-label">Color</span>
        <div class="dh-tg-colors">
          <button v-for="c in COLORS" :key="c" type="button" class="dh-tg-swatch" :class="{ 'is-on': form.color === c }"
                  :style="{ background: c }" :aria-label="'Color ' + c" @click="form.color = c" />
        </div></div>
      <div v-if="error" class="dh-alert dh-alert--error"><DhIcon name="x-circle" /><span>{{ error }}</span></div>
    </DhModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import DhIcon from './DhIcon.vue';
import DhMenu from './DhMenu.vue';
import DhModal from './DhModal.vue';
import { dh as cmd, tagColor, useDh, type DhMenuItem, type DhTagDef } from './dhContext';

const dh = useDh();
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#595959'];
const filter = ref('');
const shown = computed(() => dh.tags.value.filter(t => !filter.value.trim()
  || `${t.name} ${t.description}`.toLowerCase().includes(filter.value.trim().toLowerCase())));

function search(tag: string) { dh.go({ page: 'search', query: tag }); }

function actions(t: DhTagDef): DhMenuItem[] {
  return [
    { label: 'Edit', icon: 'pencil', run: () => openForm(t) },
    { label: 'View assets', icon: 'search', disabled: !t.datasets, run: () => search(t.name) },
    { label: 'Copy URN', icon: 'copy', run: () => copy(`urn:li:tag:${t.name}`) },
    { divider: true },
    { label: 'Delete', icon: 'trash', danger: true, run: () => remove(t) },
  ];
}
function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => dh.notify('success', 'Copied URN'), () => dh.notify('info', text));
}

const form = ref<{ name: string; description: string; color: string; editing: boolean } | null>(null);
const error = ref('');
function openForm(t: DhTagDef | null) {
  error.value = '';
  form.value = t ? { name: t.name, description: t.description, color: t.color, editing: true }
    : { name: '', description: '', color: '', editing: false };
}
async function save() {
  const f = form.value;
  if (!f) return;
  const flags: Record<string, string | null> = { '--name': f.name.trim(), '--color': f.color || null };
  const result = await dh.run(cmd(['datahub', 'tag', f.editing ? 'update' : 'create'], flags, { '--description': f.description.trim() }),
    { success: f.editing ? 'Tag updated' : `Created tag ${f.name.trim()}`, quiet: true });
  if (!result.ok) { error.value = errorText(result); return; }
  form.value = null;
}
async function remove(t: DhTagDef) {
  const ok = await dh.confirm({
    title: `Delete ${t.name}?`,
    message: `This tag will be removed from ${t.datasets} dataset(s) and ${t.fields} field(s). This cannot be undone.`,
    yes: 'Delete', danger: true, typeToConfirm: t.name,
  });
  if (ok) await dh.run(cmd(['datahub', 'tag', 'delete'], { '--tag': t.name }), { success: `Deleted tag ${t.name}` });
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-tg-bar { display: flex; align-items: center; gap: 12px; }
.dh-tg-filter { width: 280px; max-width: 100%; }
.dh-tg-empty { text-align: center; padding: 24px; }
.dh-tg-act { width: 48px; text-align: right; }
.dh-tg-colors { display: flex; gap: 8px; flex-wrap: wrap; }
.dh-tg-swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--dh-border); cursor: pointer; }
.dh-tg-swatch.is-on { box-shadow: 0 0 0 2px var(--dh-primary); }
</style>
