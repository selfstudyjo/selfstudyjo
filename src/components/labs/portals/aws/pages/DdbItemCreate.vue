<template>
  <div v-if="table">
    <CsHeader title="Create item" description="You can add, remove, or edit the attributes of an item. You can nest attributes inside other attributes up to 32 levels deep." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Attributes" :level="2" :info="false">
        <template #actions><button type="button" class="cs-btn" @click="attrs.push({ name: '', type: 'S', value: '', key: false })">Add new attribute</button></template>
      </CsHeader></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini di__table">
          <thead><tr><th>Attribute name</th><th>Value</th><th>Type</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(attr, i) in attrs" :key="i">
              <td><input v-model.trim="attr.name" class="cs-input" :disabled="attr.key" :aria-label="'Attribute name ' + (i + 1)" />
                <span v-if="attr.key" class="cs-constraint">{{ attr.name === table.partition_key ? 'Partition key' : 'Sort key' }}</span></td>
              <td>
                <select v-if="attr.type === 'BOOL'" v-model="attr.value" class="cs-select" :aria-label="'Value ' + (i + 1)"><option value="true">True</option><option value="false">False</option></select>
                <input v-else-if="attr.type !== 'NULL'" v-model="attr.value" class="cs-input" :class="{ 'is-invalid': problem(attr) }" :aria-label="'Value ' + (i + 1)" :placeholder="attr.key ? 'Enter value' : ''" />
                <span v-else class="cs-muted">null</span>
                <span v-if="problem(attr)" class="cs-error-text">{{ problem(attr) }}</span>
              </td>
              <td><select v-model="attr.type" class="cs-select di__type" :disabled="attr.key" :aria-label="'Type ' + (i + 1)">
                <option value="S">String</option><option value="N">Number</option><option value="BOOL">Boolean</option><option value="NULL">Null</option></select></td>
              <td><button v-if="!attr.key" type="button" class="cs-btn" @click="attrs.splice(i, 1)">Remove</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('dynamodb', 'explore', { name: table.name })">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || attrs.some(a => problem(a))" @click="create">Create item</button>
    </div>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" /><div>Table {{ name }} not found.</div></div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import { ddbValue } from '../commands';
import { useAws } from '../ctx';

interface Attr { name: string; type: string; value: string; key: boolean }

const ctx = useAws();
const name = computed(() => ctx.route.value.params?.name || '');
const table = computed(() => rows(ctx.view.value, 'dynamodb').find(t => t.name === name.value) || null);
const busy = ref(false);
const attrs = ref<Attr[]>([]);
const t = table.value;
if (t) {
  for (const key of [t.partition_key, t.sort_key].filter(Boolean)) {
    attrs.value.push({ name: key, type: (t.types?.[key] === 'N' ? 'N' : 'S'), value: '', key: true });
  }
  if (!attrs.value.length) attrs.value.push({ name: 'id', type: 'S', value: '', key: false });
}

function problem(attr: Attr): string {
  if (!attr.name) return 'Attribute name is required.';
  if (attr.key && !attr.value) return 'The key attribute value is required.';
  if (attr.type === 'N' && attr.value !== '' && Number.isNaN(Number(attr.value))) return 'Enter a valid number.';
  if (attrs.value.filter(a => a.name === attr.name).length > 1) return 'Attribute names must be unique.';
  return '';
}
async function create() {
  busy.value = true;
  const item: Record<string, unknown> = {};
  for (const attr of attrs.value) item[attr.name] = ddbValue(attr.type, attr.value);
  const result = await ctx.run(cli(['aws', 'dynamodb', 'put-item'], { '--table-name': name.value, '--item': JSON.stringify(item) }),
    'The item has been saved successfully.');
  busy.value = false;
  if (result.ok) ctx.to('dynamodb', 'explore', { name: name.value });
}
</script>

<style scoped>
.di__table td { vertical-align: top; }
.di__type { width: 120px; }
</style>
