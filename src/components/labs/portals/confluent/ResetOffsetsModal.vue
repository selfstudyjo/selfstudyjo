<template>
  <CcModal title="Reset offsets" :width="680" @close="$emit('close')">
    <p class="ro-p">Consumer group <strong>{{ group.group }}</strong>. Offsets can only be reset while the group has no active consumers.</p>
    <div v-if="group.members" class="cc-alert cc-alert--warn"><CcIcon name="warning" />
      <span>This group is {{ group.state }} with {{ group.members }} active consumer(s). Stop them before executing a reset.</span></div>
    <div class="cc-form-grid">
      <label class="cc-field"><span class="cc-label">Topic</span>
        <select v-model="topic" class="cc-select" @change="preview = null">
          <option value="">All topics</option>
          <option v-for="t in topicChoices" :key="t" :value="t">{{ t }}</option>
        </select></label>
      <label class="cc-field"><span class="cc-label">Reset to</span>
        <select v-model="strategy" class="cc-select" @change="preview = null">
          <option value="to-earliest">Earliest offset</option>
          <option value="to-latest">Latest offset</option>
          <option value="to-offset">Specific offset</option>
          <option value="shift-by">Shift by</option>
          <option value="to-datetime">Date / time</option>
          <option value="by-duration">Duration ago</option>
        </select></label>
      <label v-if="strategy === 'to-offset'" class="cc-field"><span class="cc-label">Offset</span>
        <input v-model.trim="value" class="cc-input" type="text" inputmode="numeric" placeholder="e.g. 100" @input="preview = null" /></label>
      <label v-if="strategy === 'shift-by'" class="cc-field"><span class="cc-label">Shift by (negative goes back)</span>
        <input v-model.trim="value" class="cc-input" type="text" inputmode="numeric" placeholder="e.g. -50" @input="preview = null" /></label>
      <label v-if="strategy === 'to-datetime'" class="cc-field"><span class="cc-label">Date and time (UTC)</span>
        <input v-model="value" class="cc-input" type="datetime-local" step="1" @input="preview = null" /></label>
      <label v-if="strategy === 'by-duration'" class="cc-field"><span class="cc-label">Duration (ISO-8601)</span>
        <input v-model.trim="value" class="cc-input" type="text" placeholder="PT1H30M" @input="preview = null" /></label>
    </div>
    <div v-if="valueError" class="cc-error-text">{{ valueError }}</div>
    <div v-if="error" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ error }}</span></div>

    <div v-if="preview" class="ro-preview">
      <h3 class="cc-h3">Dry run: new offsets</h3>
      <div class="cc-table-wrap">
        <table class="cc-table">
          <thead><tr><th>Topic</th><th class="is-num">Partition</th><th class="is-num">Current offset</th><th class="is-num">New offset</th><th class="is-num">Change</th></tr></thead>
          <tbody>
            <tr v-if="!preview.length"><td colspan="5" class="cc-empty">Nothing to reset.</td></tr>
            <tr v-for="r in preview" :key="r.topic + ':' + r.partition">
              <td class="cc-mono">{{ r.topic }}</td><td class="is-num">{{ r.partition }}</td>
              <td class="is-num">{{ current(r.topic, r.partition) }}</td><td class="is-num"><strong>{{ r.offset }}</strong></td>
              <td class="is-num">{{ delta(r.topic, r.partition, r.offset) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <button type="button" class="cc-btn" @click="$emit('close')">Cancel</button>
      <button type="button" class="cc-btn" :disabled="!!valueError || cc.busy.value" @click="go(false)">Dry run</button>
      <button type="button" class="cc-btn cc-btn--primary" :disabled="!preview || !!valueError || cc.busy.value" @click="go(true)">Execute reset</button>
    </template>
  </CcModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import CcModal from './CcModal.vue';
import { useCc } from './ccContext';
import { kafkaGroups, parseResetTable, type CcGroup, type CcResetRow } from './confluent';

const props = defineProps<{ group: CcGroup }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const cc = useCc();

const topicChoices = computed(() => {
  const set = new Set([...(props.group.topics || []), ...cc.topics.value.map(t => t.name)]);
  return [...set].sort();
});
const topic = ref(props.group.topics?.[0] || '');
const strategy = ref('to-earliest');
const value = ref('');
const preview = ref<CcResetRow[] | null>(null);
const error = ref('');

const valueError = computed(() => {
  const v = value.value;
  if (strategy.value === 'to-offset' && !/^\d+$/.test(v)) return 'Enter a non-negative offset.';
  if (strategy.value === 'shift-by' && !/^-?\d+$/.test(v)) return 'Enter a whole number, negative to move back.';
  if (strategy.value === 'to-datetime' && !v) return 'Choose a date and time.';
  if (strategy.value === 'by-duration' && !/^PT?(\d+H)?(\d+M)?$/.test(v)) return 'Use an ISO-8601 duration such as PT1H30M.';
  if (strategy.value !== 'to-earliest' && strategy.value !== 'to-latest' && !v) return 'A value is required.';
  return '';
});

function strategyFlags(): Record<string, string | boolean> {
  const v = value.value;
  switch (strategy.value) {
    case 'to-offset': return { '--to-offset': v };
    case 'shift-by': return { '--shift-by': v };
    case 'to-datetime': return { '--to-datetime': (v.length === 16 ? v + ':00' : v) + '.000' };
    case 'by-duration': return { '--by-duration': v };
    case 'to-latest': return { '--to-latest': true };
    default: return { '--to-earliest': true };
  }
}

function current(t: string, p: number) {
  const row = (props.group.lag_detail || []).find(r => r.topic === t && r.partition === p);
  return row?.committed ?? '-';
}
function delta(t: string, p: number, next: number) {
  const now = current(t, p);
  if (typeof now !== 'number') return '';
  const d = next - now;
  return d > 0 ? `+${d}` : String(d);
}

async function go(execute: boolean) {
  error.value = '';
  const scope = topic.value ? { '--topic': topic.value } : { '--all-topics': true };
  const command = kafkaGroups(['--group', props.group.group, '--reset-offsets'],
    { ...scope, ...strategyFlags(), [execute ? '--execute' : '--dry-run']: true });
  const result = await cc.run(command, { quiet: true, success: execute ? `Offsets of ${props.group.group} reset` : '' });
  if (!result.ok) { error.value = errorText(result); if (!execute) preview.value = null; return; }
  if (!execute) { preview.value = parseResetTable(String(result.output || '')); return; }
  emit('close');
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.ro-p { margin: 0; }
.ro-preview { display: flex; flex-direction: column; gap: 8px; }
</style>
