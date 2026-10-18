<template>
  <!-- Step 1: the "New item" gallery, grouped by task as Fabric groups it -->
  <FxPanel v-if="!type" title="New item" width="720px" @close="$emit('close')">
    <div class="fx-input fx-input--search ni-search">
      <FxIcon name="search" :size="14" />
      <input v-model="filter" placeholder="Search items by name or description" aria-label="Filter items" />
    </div>
    <div v-for="group in groups" :key="group.task" class="ni-group">
      <h3 class="fx-h3">{{ group.task }}</h3>
      <div class="fx-cards">
        <button v-for="t in group.types" :key="t.type" type="button" class="fx-card"
                @click="pick(t.type)">
          <span class="fx-card__title"><FxIcon :name="t.type" :size="24" />{{ t.label }}</span>
          <span class="fx-card__desc">{{ t.description }}</span>
        </button>
      </div>
    </div>
    <p v-if="!groups.length" class="fx-muted">No items match "{{ filter }}".</p>
  </FxPanel>

  <!-- Step 2: the create dialog for one type -->
  <FxModal v-else :title="'New ' + label.toLowerCase()" :width="type === 'SemanticModel' ? '560px' : '440px'"
           @close="$emit('close')">
    <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
    <div class="fx-field">
      <label for="fx-ni-name">Name<span class="fx-field__req">*</span></label>
      <input id="fx-ni-name" ref="nameInput" v-model="name" class="fx-input"
             :class="{ 'is-invalid': nameError }" @keydown.enter="create" />
      <span v-if="nameError" class="fx-field__err">{{ nameError }}</span>
    </div>
    <div class="fx-field">
      <span class="fx-field__label">Location</span>
      <div class="ni-loc">
        <select v-model="targetWs" class="fx-select" aria-label="Workspace">
          <option v-for="w in workspaces" :key="w.name" :value="w.name">{{ w.name }}</option>
        </select>
        <select v-model="targetFolder" class="fx-select" aria-label="Folder">
          <option value="">(workspace root)</option>
          <option v-for="f in folders" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>
    </div>
    <label v-if="type === 'Lakehouse'" class="fx-check">
      <input v-model="schemas" type="checkbox" />Lakehouse schemas
    </label>
    <template v-if="type === 'Notebook'">
      <div class="fx-field">
        <span class="fx-field__label">Default lakehouse</span>
        <select v-model="lakehouse" class="fx-select" aria-label="Default lakehouse">
          <option value="">None - add one later</option>
          <option v-for="l in lakehouses" :key="l.name" :value="l.name">{{ l.name }}</option>
        </select>
      </div>
    </template>
    <template v-if="type === 'SemanticModel'">
      <div class="fx-field">
        <span class="fx-field__label">Lakehouse or warehouse<span class="fx-field__req">*</span></span>
        <select v-model="lakehouse" class="fx-select" aria-label="Source">
          <option v-for="l in sources" :key="l.name + l.type" :value="l.name">{{ l.name }} ({{ l.type }})</option>
        </select>
      </div>
      <div class="fx-field">
        <span class="fx-field__label">Select tables<span class="fx-field__req">*</span></span>
        <div class="ni-tables">
          <label v-for="t in sourceTables" :key="t.schema + '.' + t.name" class="fx-check">
            <input v-model="tables" type="checkbox" :value="t.schema === 'dbo' ? t.name : t.schema + '.' + t.name" />
            <FxIcon :name="t.kind === 'View' ? 'View' : 'Table'" />{{ t.schema }}.{{ t.name }}
            <span class="fx-muted">{{ t.rows }} rows</span>
          </label>
          <p v-if="!sourceTables.length" class="fx-muted">This source has no tables yet.</p>
        </div>
        <span class="fx-field__help">The model reads these Delta tables in Direct Lake mode.</span>
      </div>
    </template>
    <template #footer>
      <button type="button" class="fx-btn fx-btn--primary" :disabled="!canCreate" @click="create">Create</button>
      <button type="button" class="fx-btn" @click="$emit('close')">Cancel</button>
    </template>
  </FxModal>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxModal from './FxModal.vue';
import FxPanel from './FxPanel.vue';
import { ITEM_TYPES, cli, errorText, itemPath, rows, typeLabel, useFabric } from './fabric';

const props = defineProps<{ ws?: string; folder?: string; initialType?: string }>();
const emit = defineEmits<{ (event: 'close'): void;
  (event: 'created', value: { ws: string; name: string; type: string }): void }>();
const { portal, run } = useFabric();

const type = ref(props.initialType || '');
const filter = ref('');
const name = ref('');
const workspaces = computed(() => rows(portal.value, 'workspaces'));
const targetWs = ref(props.ws || workspaces.value[0]?.name || '');
const targetFolder = ref(props.folder || '');
const schemas = ref(true);
const lakehouse = ref('');
const tables = ref<string[]>([]);
const error = ref('');
const busy = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

const CREATABLE = ['Lakehouse', 'Warehouse', 'Notebook', 'DataPipeline', 'SemanticModel', 'Report',
  'Environment'];
const ORDER = ['Get data', 'Store data', 'Prepare data', 'Develop data', 'Visualize data'];

const groups = computed(() => {
  const text = filter.value.trim().toLowerCase();
  const list = CREATABLE.map(t => ITEM_TYPES[t]).filter(t => !text
    || t.label.toLowerCase().includes(text) || t.description.toLowerCase().includes(text));
  return ORDER.map(task => ({ task, types: list.filter(t => t.task === task) }))
    .filter(g => g.types.length);
});

const label = computed(() => typeLabel(type.value));
const folders = computed(() => workspaces.value.find(w => w.name === targetWs.value)?.folders || []);
const lakehouses = computed(() => rows(portal.value, 'items')
  .filter(i => i.type === 'Lakehouse' && i.workspace === targetWs.value));
const sources = computed(() => rows(portal.value, 'items')
  .filter(i => (i.type === 'Lakehouse' || i.type === 'Warehouse') && i.workspace === targetWs.value));
const sourceTables = computed(() => rows(portal.value, 'objects')
  .filter(o => o.item === lakehouse.value && o.workspace === targetWs.value));

function defaultName(kind: string) {
  const base = { Lakehouse: 'lh_new', Warehouse: 'wh_new', Notebook: 'Notebook',
    DataPipeline: 'Pipeline', SemanticModel: 'SemanticModel', Report: 'Report',
    Environment: 'Environment' }[kind] || kind;
  const taken = new Set(rows(portal.value, 'items').filter(i => i.workspace === targetWs.value
    && i.type === kind).map(i => String(i.name).toLowerCase()));
  for (let n = 1; n < 200; n++) {
    const candidate = /_$|new$/.test(base) ? `${base}${n}` : `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base;
}

function pick(kind: string) {
  type.value = kind;
}

watch(type, kind => {
  if (!kind) return;
  name.value = defaultName(kind);
  if (kind === 'SemanticModel') lakehouse.value = sources.value[0]?.name || '';
  nextTick(() => nameInput.value?.select());
}, { immediate: true });
watch(lakehouse, () => { tables.value = []; });
onMounted(() => nameInput.value?.select());

const nameError = computed(() => {
  const text = name.value.trim();
  if (!text) return 'Name is required.';
  if (/[/\\"<>|?*:]/.test(text)) return 'Names can\'t contain / \\ " < > | ? * :';
  if ((type.value === 'Lakehouse' || type.value === 'Warehouse') && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
    return `${label.value} names can contain only letters, numbers and underscores, and must start with a letter or underscore.`;
  }
  if (rows(portal.value, 'items').some(i => i.workspace === targetWs.value && i.type === type.value
    && String(i.name).toLowerCase() === text.toLowerCase())) {
    return 'This name is already in use.';
  }
  return '';
});

const canCreate = computed(() => !busy.value && !nameError.value && !!targetWs.value
  && (type.value !== 'SemanticModel' || (lakehouse.value && tables.value.length > 0)));

async function create() {
  if (!canCreate.value) return;
  busy.value = true;
  error.value = '';
  const itemName = name.value.trim();
  const path = itemPath(targetWs.value, itemName, type.value, targetFolder.value);
  let props2 = '';
  if (type.value === 'Lakehouse' && !schemas.value) props2 = 'enableSchemas=false';
  if (type.value === 'Notebook' && lakehouse.value) props2 = `lakehouse=${lakehouse.value}`;
  if (type.value === 'SemanticModel') props2 = `lakehouse=${lakehouse.value},tables=${tables.value.join(';')}`;
  const result = await run(cli(['fab', 'mkdir', path], { '-P': props2 }),
    `Created ${label.value.toLowerCase()} ${itemName}`, { quiet: true });
  busy.value = false;
  if (!result.ok) {
    error.value = errorText(result);
    return;
  }
  emit('created', { ws: targetWs.value, name: itemName, type: type.value });
}
</script>

<style scoped>
.ni-search { margin-bottom: 8px; }
.ni-group { margin-bottom: 4px; }
.ni-loc { display: flex; gap: 8px; }
.ni-loc .fx-select { flex: 1; min-width: 0; }
.ni-tables { max-height: 220px; overflow: auto; border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px 10px 0; }
.ni-tables .fx-check { gap: 6px; }
.ni-tables .fx-muted { margin-left: auto; font-size: 12px; }
</style>
