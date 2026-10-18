<template>
  <FxPanel title="Create a workspace" @close="$emit('close')">
    <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ error }}</div>
    <div class="fx-field">
      <label for="fx-nw-name">Name<span class="fx-field__req">*</span></label>
      <input id="fx-nw-name" v-model="name" class="fx-input" :class="{ 'is-invalid': nameError }"
             placeholder="Enter a workspace name" />
      <span v-if="nameError" class="fx-field__err">{{ nameError }}</span>
    </div>
    <div class="fx-field">
      <label for="fx-nw-desc">Description</label>
      <textarea id="fx-nw-desc" v-model="description" class="fx-textarea"
                placeholder="Describe this workspace" />
    </div>
    <div class="fx-field">
      <span class="fx-field__label">Domain</span>
      <select v-model="domain" class="fx-select" aria-label="Domain">
        <option value="">No domain</option>
        <option>Service Operations</option>
        <option>Finance</option>
        <option>Platform</option>
      </select>
      <span class="fx-field__help">Assign to a domain to group data by business area.</span>
    </div>
    <h3 class="fx-h3">Advanced</h3>
    <div class="fx-field">
      <span class="fx-field__label">License mode</span>
      <label class="fx-check"><input v-model="mode" type="radio" value="fabric" />Fabric capacity</label>
      <label class="fx-check"><input v-model="mode" type="radio" value="pro" />Pro (no Fabric items)</label>
      <span class="fx-field__help">Fabric items such as lakehouses, warehouses and notebooks need a
        Fabric capacity.</span>
    </div>
    <div v-if="mode === 'fabric'" class="fx-field">
      <label for="fx-nw-cap">Capacity</label>
      <select id="fx-nw-cap" v-model="capacity" class="fx-select">
        <option v-for="c in capacities" :key="c.name" :value="c.name">
          {{ c.name }} - {{ c.region }} ({{ c.sku }})
        </option>
      </select>
    </div>
    <template #footer>
      <button type="button" class="fx-btn fx-btn--primary" :disabled="busy || !!nameError || !name"
              @click="create">Apply</button>
      <button type="button" class="fx-btn" @click="$emit('close')">Cancel</button>
    </template>
  </FxPanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FxPanel from './FxPanel.vue';
import FxIcon from './FxIcon.vue';
import { cli, errorText, rows, useFabric, wsPath } from './fabric';

const emit = defineEmits<{ (event: 'close'): void }>();
const { portal, run, go } = useFabric();
const name = ref('');
const description = ref('');
const domain = ref('');
const mode = ref<'fabric' | 'pro'>('fabric');
const capacities = computed(() => rows(portal.value, 'capacities'));
const capacity = ref(capacities.value[0]?.name || '');
const error = ref('');
const busy = ref(false);

const nameError = computed(() => {
  const text = name.value.trim();
  if (!text) return '';
  if (/[/\\"<>|?*:]/.test(text)) return 'Workspace names can\'t contain / \ " < > | ? * :';
  if (rows(portal.value, 'workspaces').some(w => String(w.name).toLowerCase() === text.toLowerCase())) {
    return 'This name is already in use.';
  }
  return '';
});

async function create() {
  busy.value = true;
  error.value = '';
  const ws = name.value.trim();
  const result = await run(cli(['fab', 'mkdir', wsPath(ws)],
    { '-P': mode.value === 'fabric' && capacity.value ? `capacityName=${capacity.value}` : '' }),
  `Created workspace ${ws}`, { quiet: true });
  if (!result.ok) {
    error.value = errorText(result);
    busy.value = false;
    return;
  }
  if (description.value.trim()) {
    await run(cli(['fab', 'set', wsPath(ws)], { '-q': 'description', '-i': description.value.trim() }));
  }
  if (domain.value) {
    await run(cli(['fab', 'set', wsPath(ws)], { '-q': 'domain', '-i': domain.value }));
  }
  busy.value = false;
  emit('close');
  go({ page: 'workspace', ws });
}
</script>
