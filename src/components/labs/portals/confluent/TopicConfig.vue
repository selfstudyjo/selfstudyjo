<template>
  <div class="tc">
    <div class="cc-toolbar">
      <label class="cc-search"><CcIcon name="search" />
        <input v-model="query" class="cc-input" type="search" placeholder="Search settings" aria-label="Search settings" /></label>
      <label class="tc-check"><input v-model="onlyOverrides" type="checkbox" /> Show only overridden settings</label>
      <span class="cc-spacer"></span>
      <template v-if="!editing">
        <button type="button" class="cc-btn cc-btn--primary" @click="startEdit"><CcIcon name="edit" />Edit settings</button>
      </template>
      <template v-else>
        <button type="button" class="cc-btn" @click="editing = false">Cancel</button>
        <button type="button" class="cc-btn cc-btn--primary" :disabled="!changeCount || cc.busy.value" @click="save">Save changes{{ changeCount ? ` (${changeCount})` : '' }}</button>
      </template>
    </div>
    <div v-if="error" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ error }}</span></div>

    <div class="cc-table-wrap">
      <table class="cc-table">
        <thead><tr><th>Setting</th><th>Value</th><th>Default</th><th>Source</th><th v-if="editing"></th></tr></thead>
        <tbody>
          <tr v-for="row in shown" :key="row.key" :class="{ 'tc-over': row.overridden }">
            <td class="cc-mono">{{ row.key }}</td>
            <td>
              <template v-if="editing">
                <select v-if="row.key === 'cleanup.policy'" v-model="drafts[row.key]" class="cc-select tc-input">
                  <option value="delete">delete</option><option value="compact">compact</option><option value="compact,delete">compact,delete</option>
                </select>
                <input v-else v-model.trim="drafts[row.key]" class="cc-input tc-input" :class="{ 'tc-changed': drafts[row.key] !== row.value }" type="text" spellcheck="false" />
              </template>
              <template v-else>
                <span class="cc-mono">{{ row.value }}</span>
                <span v-if="/\.ms$/.test(row.key)" class="cc-muted cc-small"> ({{ msLabel(row.value) }})</span>
              </template>
            </td>
            <td class="cc-mono cc-muted">{{ row.def }}</td>
            <td><span v-if="row.overridden" class="cc-badge cc-badge--blue">Dynamic topic config</span><span v-else class="cc-muted cc-small">Default</span></td>
            <td v-if="editing">
              <button v-if="row.overridden" type="button" class="cc-btn cc-btn--ghost cc-btn--sm" :class="{ 'tc-reset-on': resets.has(row.key) }"
                      @click="toggleReset(row.key)">{{ resets.has(row.key) ? 'Will reset' : 'Reset to default' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="cc-card tc-danger">
      <div class="cc-card__body tc-danger__body">
        <div><h3 class="cc-h3">Delete topic</h3>
          <p class="cc-muted">Deleting <strong>{{ topic.name }}</strong> removes all of its {{ topic.messages }} messages and its consumer offsets. This cannot be undone.</p></div>
        <button type="button" class="cc-btn cc-btn--danger" @click="remove"><CcIcon name="trash" />Delete topic</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import { useCc } from './ccContext';
import { TOPIC_DEFAULTS, kafkaConfigs, kafkaTopics, msLabel, type CcTopic } from './confluent';

const props = defineProps<{ topic: CcTopic }>();
const cc = useCc();
const query = ref('');
const onlyOverrides = ref(false);
const editing = ref(false);
const drafts = reactive<Record<string, string>>({});
const resets = ref(new Set<string>());
const error = ref('');

const rowsAll = computed(() => {
  const keys = new Set([...Object.keys(TOPIC_DEFAULTS), ...Object.keys(props.topic.configs || {})]);
  return [...keys].sort().map(key => {
    const over = (props.topic.configs || {})[key];
    return { key, value: over ?? TOPIC_DEFAULTS[key] ?? '', def: TOPIC_DEFAULTS[key] ?? '', overridden: over !== undefined };
  });
});
const shown = computed(() => rowsAll.value.filter(r => (!onlyOverrides.value || r.overridden)
  && (!query.value.trim() || r.key.includes(query.value.trim().toLowerCase()))));

function startEdit() {
  for (const r of rowsAll.value) drafts[r.key] = r.value;
  resets.value = new Set();
  error.value = '';
  editing.value = true;
}
function toggleReset(key: string) {
  const next = new Set(resets.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  resets.value = next;
}
const adds = computed(() => {
  const out: string[] = [];
  for (const r of rowsAll.value) {
    if (resets.value.has(r.key)) continue;
    const v = drafts[r.key];
    if (v !== undefined && v !== r.value && v !== '') out.push(`${r.key}=${v}`);
  }
  return out;
});
const changeCount = computed(() => adds.value.length + resets.value.size);

async function save() {
  error.value = '';
  const result = await cc.run(kafkaConfigs(['--entity-type', 'topics', '--entity-name', props.topic.name, '--alter'], {
    '--add-config': adds.value.join(','),
    '--delete-config': [...resets.value].join(','),
  }), { success: `Settings of ${props.topic.name} updated`, quiet: true });
  if (!result.ok) { error.value = errorText(result); return; }
  editing.value = false;
}

async function remove() {
  const ok = await cc.confirm({
    title: 'Delete topic',
    message: `Topic ${props.topic.name} and all of its messages will be permanently deleted.`,
    yes: 'Delete', danger: true, typeToConfirm: props.topic.name,
  });
  if (!ok) return;
  const name = props.topic.name;
  const result = await cc.run(kafkaTopics(['--delete', '--topic', name]), { success: `Topic ${name} deleted` });
  if (result.ok) cc.go({ page: 'topics' });
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.tc { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.tc-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.tc-over td:first-child { font-weight: 600; }
.tc-input { width: 100%; max-width: 280px; }
.tc-changed { border-color: var(--cc-primary); background: var(--cc-blue-bg); }
.tc-reset-on { color: var(--cc-danger); }
.tc-danger { border-color: var(--cc-danger-border); }
.tc-danger__body { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: space-between; }
.tc-danger__body p { margin: 4px 0 0; }
</style>
