<template>
  <div class="re">
    <div class="cs-scroll-x">
      <table class="cs-table-mini re__table">
        <thead>
          <tr><th v-if="showIds">Security group rule ID</th><th>Type <span class="re__info">Info</span></th><th>Protocol</th><th>Port range</th>
            <th>{{ peer }}</th><th>Description - optional</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in modelValue" :key="index">
            <td v-if="showIds" class="cs-mono re__id">{{ row.original ? 'sgr-' + (index + 1).toString(16).padStart(17, '0') : '-' }}</td>
            <td><select class="cs-select re__type" :value="row.type" :aria-label="'Type ' + (index + 1)" @change="setType(index, ($event.target as HTMLSelectElement).value)">
              <option v-for="t in RULE_TYPES" :key="t.label" :value="t.label">{{ t.label }}</option></select></td>
            <td><input class="cs-input re__narrow" :value="protocolOf(row)" disabled aria-label="Protocol" /></td>
            <td><input class="cs-input re__narrow" :class="{ 'is-invalid': problem(row) && isCustom(row) }" :value="portOf(row)"
                       :disabled="!isCustom(row)" placeholder="0" :aria-label="'Port range ' + (index + 1)"
                       @input="set(index, 'port', ($event.target as HTMLInputElement).value)" /></td>
            <td class="re__src">
              <select class="cs-select re__srcsel" :value="row.source" :aria-label="peer + ' type ' + (index + 1)"
                      @change="setSource(index, ($event.target as HTMLSelectElement).value)">
                <option>Custom</option><option>Anywhere-IPv4</option><option>My IP</option>
              </select>
              <input class="cs-input re__cidr" :class="{ 'is-invalid': problem(row) && !isCustom(row) || (problem(row).startsWith('Source')) }"
                     :value="row.cidr" placeholder="CIDR blocks" :aria-label="peer + ' CIDR ' + (index + 1)"
                     @input="set(index, 'cidr', ($event.target as HTMLInputElement).value)" />
            </td>
            <td><input class="cs-input" :value="row.description" :aria-label="'Description ' + (index + 1)"
                       @input="set(index, 'description', ($event.target as HTMLInputElement).value)" /></td>
            <td><button type="button" class="cs-btn" @click="remove(index)">Delete</button></td>
          </tr>
          <tr v-if="!modelValue.length"><td :colspan="showIds ? 7 : 6" class="cs-muted">This security group has no {{ direction }} rules.</td></tr>
        </tbody>
      </table>
    </div>
    <div v-for="(row, index) in modelValue" :key="'e' + index">
      <div v-if="problem(row)" class="cs-error-text">Rule {{ index + 1 }}: {{ problem(row) }}</div>
    </div>
    <button type="button" class="cs-btn re__add" @click="add">Add rule</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RULE_TYPES, protocolLabel, ruleOf, ruleProblem, type EditRule } from './sgRules';

const props = withDefaults(defineProps<{ modelValue: EditRule[]; showIds?: boolean; direction?: 'inbound' | 'outbound' }>(),
  { showIds: false, direction: 'inbound' });
const peer = computed(() => (props.direction === 'outbound' ? 'Destination' : 'Source'));
const emit = defineEmits<{ (e: 'update:modelValue', value: EditRule[]): void }>();

function patch(index: number, change: Partial<EditRule>) {
  emit('update:modelValue', props.modelValue.map((row, i) => (i === index ? { ...row, ...change } : row)));
}
function set(index: number, field: 'port' | 'cidr' | 'description', value: string) {
  patch(index, { [field]: value } as Partial<EditRule>);
}
function setType(index: number, type: string) {
  patch(index, { type, port: '' });
}
function setSource(index: number, source: string) {
  const cidr = source === 'Anywhere-IPv4' ? '0.0.0.0/0' : source === 'My IP' ? '203.0.113.25/32' : props.modelValue[index].cidr;
  patch(index, { source, cidr });
}
function add() {
  emit('update:modelValue', [...props.modelValue,
    { type: 'Custom TCP', port: '', source: 'Custom', cidr: '', description: '' }]);
}
function remove(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index));
}
function isCustom(row: EditRule) {
  return Boolean(RULE_TYPES.find(t => t.label === row.type)?.custom);
}
function protocolOf(row: EditRule) {
  return protocolLabel(ruleOf(row).protocol);
}
function portOf(row: EditRule) {
  if (isCustom(row)) return row.port;
  const port = ruleOf(row).port;
  return port || 'All';
}
function problem(row: EditRule) {
  const text = ruleProblem(row);
  return props.direction === 'outbound' ? text.replace(/^Source/, 'Destination') : text;
}
</script>

<style scoped>
.re { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.re > .cs-scroll-x { width: 100%; }
.re__table td { vertical-align: middle; }
.re__type { min-width: 150px; }
.re__narrow { width: 110px; }
.re__src { display: flex; gap: 6px; }
.re__srcsel { width: 140px; }
.re__cidr { min-width: 150px; }
.re__info { font-size: 12px; color: #006ce0; }
.re__id { color: #656871; white-space: nowrap; }
.re__add { margin-top: 4px; }
</style>
