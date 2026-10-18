<template>
  <CsTable v-if="page === 'secrets'" variant="full-page" title="Secrets" :items="secrets" :columns="cols" track-by="name" filter-placeholder="Filter secrets by name" empty-title="No secrets">
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('secrets', 'secret', { name: row.name })">{{ row.name }}</a></template>
  </CsTable>

  <div v-else-if="page === 'secret' && secret">
    <CsHeader :title="secret.name" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Secret details" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Encryption key</dt><dd>aws/secretsmanager</dd></div>
        <div><dt>Secret name</dt><dd class="cs-mono">{{ secret.name }}</dd></div>
        <div><dt>Secret ARN</dt><dd class="cs-mono">arn:aws:secretsmanager:{{ ctx.home.value }}:{{ ctx.account.value }}:secret:{{ secret.name }}</dd></div>
        <div><dt>Description</dt><dd>used by {{ secret.consumer }}</dd></div>
        <div><dt>Versions</dt><dd>{{ secret.versions }}</dd></div>
      </dl></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Secret value" :level="2" :info="false">
        <template #actions>
          <button v-if="!shown" type="button" class="cs-btn" :disabled="busy" @click="retrieve">Retrieve secret value</button>
          <button v-else type="button" class="cs-btn" @click="openEdit">Edit</button>
        </template></CsHeader></div>
      <div class="cs-container__body">
        <p v-if="!shown" class="cs-muted sm__p">Retrieve and view the secret value.</p>
        <div v-else class="cs-scroll-x"><table class="cs-table-mini"><thead><tr><th>Secret key</th><th>Secret value</th></tr></thead>
          <tbody><tr v-for="(v, k) in pairs" :key="k"><td class="cs-mono">{{ k }}</td><td class="cs-mono">{{ v }}</td></tr></tbody></table></div>
      </div>
    </section>
  </div>

  <CsModal v-if="editing" title="Edit secret value" size="large" @close="editing = null">
    <div class="cs-stack">
      <div class="cs-tabs"><button type="button" class="cs-tab" :class="{ 'is-active': editing.mode === 'kv' }" @click="editing.mode = 'kv'">Key/value</button>
        <button type="button" class="cs-tab" :class="{ 'is-active': editing.mode === 'text' }" @click="toText">Plaintext</button></div>
      <template v-if="editing.mode === 'kv'">
        <div v-for="(p, i) in editing.rows" :key="i" class="cs-row"><input v-model="p.k" class="cs-input" placeholder="Key" /><input v-model="p.v" class="cs-input cs-mono" placeholder="Value" />
          <button type="button" class="cs-btn" @click="editing.rows.splice(i, 1)">Remove</button></div>
        <div><button type="button" class="cs-btn" @click="editing.rows.push({ k: '', v: '' })">Add row</button></div>
      </template>
      <textarea v-else v-model="editing.text" class="cs-textarea cs-mono sm__text" spellcheck="false" />
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="editing = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="save">Save</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const busy = ref(false);
const shown = ref<string | null>(null);
const editing = ref<any>(null);
const secrets = computed(() => rows<any>(ctx.c.value, 'secrets'));
const secret = computed<any>(() => secrets.value.find(s => s.name === ctx.route.value.params?.name) || null);
const cols = [{ id: 'name', header: 'Secret name', sortKey: 'name' }, { id: 'consumer', header: 'Description', cell: (s: any) => `used by ${s.consumer}` },
  { id: 'versions', header: 'Versions' }];
const pairs = computed<Record<string, unknown>>(() => {
  const parsed = parseJson<Record<string, unknown>>(shown.value);
  return parsed && typeof parsed === 'object' ? parsed : { 'Plaintext': shown.value };
});

async function retrieve() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'secretsmanager', 'get-secret-value'], { '--secret-id': secret.value.name }), undefined, { quiet: true });
  busy.value = false;
  if (result.ok) shown.value = parseJson<any>(result.output)?.SecretString ?? '';
}
function openEdit() {
  const parsed = parseJson<Record<string, unknown>>(shown.value);
  editing.value = parsed && typeof parsed === 'object'
    ? { mode: 'kv', rows: Object.entries(parsed).map(([k, v]) => ({ k, v: String(v) })), text: shown.value }
    : { mode: 'text', rows: [], text: shown.value };
}
function toText() {
  if (editing.value.mode === 'kv') editing.value.text = JSON.stringify(Object.fromEntries(editing.value.rows.filter((r: any) => r.k).map((r: any) => [r.k, r.v])));
  editing.value.mode = 'text';
}
async function save() {
  const value = editing.value.mode === 'kv'
    ? JSON.stringify(Object.fromEntries(editing.value.rows.filter((r: any) => r.k.trim()).map((r: any) => [r.k.trim(), r.v])))
    : editing.value.text;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'secretsmanager', 'put-secret-value'], { '--secret-id': secret.value.name, '--secret-string': value }),
    `Secret ${secret.value.name} updated.`);
  busy.value = false;
  if (result.ok) { shown.value = value; editing.value = null; }
}
</script>

<style scoped>
.sm__p { margin: 0; }
.sm__text { min-height: 200px; }
</style>
