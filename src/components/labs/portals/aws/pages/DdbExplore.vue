<template>
  <div class="dx">
    <aside class="cs-container dx__tables">
      <div class="cs-container__head"><CsHeader :title="`Tables (${tables.length})`" :level="2" :info="false" /></div>
      <div class="cs-container__body dx__list">
        <input v-model="tableFilter" class="cs-input" placeholder="Find tables by table name" aria-label="Find tables" />
        <label v-for="t in shownTables" :key="t.name" class="cs-radio dx__t"><input type="radio" :checked="t.name === name" @change="pick(t.name)" /> {{ t.name }}</label>
        <div v-if="!tables.length" class="cs-empty"><strong>No tables</strong><button type="button" class="cs-btn" @click="ctx.to('dynamodb', 'create')">Create table</button></div>
      </div>
    </aside>
    <div class="dx__main">
      <template v-if="table">
        <CsHeader :title="table.name" :info="false">
          <template #actions><button type="button" class="cs-btn" @click="ctx.to('dynamodb', 'table', { name: table.name })">View table details</button></template>
        </CsHeader>
        <section class="cs-container">
          <div class="cs-container__head"><button type="button" class="dx__exp"><CsIcon name="caret-down" /> <strong>Scan or query items</strong></button></div>
          <div class="cs-container__body cs-stack">
            <div class="cs-tiles dx__mode">
              <label class="cs-tile is-checked"><input type="radio" checked /><span><strong>Scan</strong></span></label>
              <label class="cs-tile dx__off"><input type="radio" disabled /><span><strong>Query</strong></span></label>
            </div>
            <div class="cs-row"><button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="scan">Run</button>
              <button type="button" class="cs-btn cs-btn--link" @click="scanned = null">Reset</button></div>
            <div v-if="scanned" class="cs-alert cs-alert--success dx__done"><CsIcon name="status-positive" class="cs-alert__icon" />
              <div>Completed · Items returned: {{ scanned.length }} · Items scanned: {{ scanned.length }} · Efficiency: 100%</div></div>
          </div>
        </section>
        <CsTable v-model:selected="selected" :title="`Items returned`" :items="items" :columns="columns" track-by="_key"
                 selection-type="multi" filter-placeholder="Find items" empty-title="The query did not return any results.">
          <template #actions>
            <CsDropdown :items="[{ id: 'delete', text: 'Delete items', disabled: !selected.length }, { id: 'download', text: 'Download selected items to CSV', disabled: true }]" @select="deleting = true" />
            <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('dynamodb', 'item-create', { name: table.name })">Create item</button>
          </template>
        </CsTable>
        <CsDelete v-if="deleting" title="Delete items?" word="" :busy="busy" @close="deleting = false" @confirm="removeItems">
          <p class="dx__p">Are you sure you want to delete {{ selected.length }} item(s)? This can't be undone.</p>
        </CsDelete>
      </template>

      <div v-else class="cs-empty dx__pick"><strong>Select a table</strong>Choose a table on the left to explore its items.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { ddbText } from '../commands';
import { useAws } from '../ctx';

const ctx = useAws();
const name = computed(() => ctx.route.value.params?.name || '');
const tables = computed(() => rows(ctx.view.value, 'dynamodb'));
const tableFilter = ref('');
const shownTables = computed(() => tables.value.filter(t => t.name.toLowerCase().includes(tableFilter.value.toLowerCase())));
const table = computed(() => tables.value.find(t => t.name === name.value) || null);
const scanned = ref<Record<string, any>[] | null>(null);
const selected = ref<string[]>([]);
const deleting = ref(false);
const busy = ref(false);

const source = computed<Record<string, any>[]>(() => scanned.value ?? (table.value?.rows || []));
const keyNames = computed(() => [table.value?.partition_key, table.value?.sort_key].filter(Boolean) as string[]);
const attrNames = computed(() => {
  const names = new Set<string>(keyNames.value);
  for (const item of source.value) Object.keys(item).forEach(k => names.add(k));
  return [...names];
});
const items = computed(() => source.value.map(item => {
  const row: Record<string, any> = { _raw: item, _key: keyNames.value.map(k => JSON.stringify(item[k])).join('|') };
  for (const attr of attrNames.value) row[attr] = ddbText(item[attr]);
  return row;
}));
const columns = computed<Column[]>(() => attrNames.value.map(attr => ({
  id: attr, header: attr + (attr === table.value?.partition_key ? ' (String)' : ''), sortKey: attr,
})));

function pick(table: string) {
  scanned.value = null;
  ctx.to('dynamodb', 'explore', { name: table });
}
async function scan() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'dynamodb', 'scan'], { '--table-name': name.value }));
  busy.value = false;
  if (result.ok) scanned.value = parseJson<{ Items: Record<string, any>[] }>(result.output)?.Items || [];
}
async function removeItems() {
  busy.value = true;
  for (const key of selected.value) {
    const row = items.value.find(r => r._key === key);
    if (!row) continue;
    const keyDoc: Record<string, unknown> = {};
    for (const k of keyNames.value) keyDoc[k] = row._raw[k];
    await ctx.run(cli(['aws', 'dynamodb', 'delete-item'], { '--table-name': name.value, '--key': JSON.stringify(keyDoc) }));
  }
  busy.value = false;
  deleting.value = false;
  ctx.api.notify('success', `${selected.value.length} item(s) deleted.`);
  selected.value = [];
  scanned.value = null;
}
</script>

<style scoped>
.dx { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 20px; align-items: start; }
.dx__tables { margin: 0; }
.dx__list { display: flex; flex-direction: column; gap: 8px; }
.dx__t { padding: 2px 0; }
.dx__main { min-width: 0; }
.dx__exp { display: inline-flex; gap: 6px; align-items: center; border: 0; background: none; font: inherit; padding: 0; color: #0f141a; }
.dx__mode { max-width: 420px; }
.dx__off { opacity: .55; }
.dx__done { margin: 0; }
.dx__p { margin: 0; }
.dx__pick { border: 1px dashed #c6c6cd; border-radius: 16px; }
@container sl-portal (max-width: 900px) { .dx { grid-template-columns: minmax(0, 1fr); } }
</style>
