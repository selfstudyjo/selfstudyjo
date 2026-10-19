<template>
  <!-- Create key -->
  <div v-if="page === 'create'">
    <CsHeader title="Create key" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Configure key" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><span class="cs-label">Key type</span>
          <div class="cs-tiles">
            <label class="cs-tile is-checked"><input type="radio" checked />
              <span><strong>Symmetric</strong><small>A single key used for encrypting and decrypting data or generating and verifying HMAC codes</small></span></label>
            <label class="cs-tile"><input type="radio" disabled />
              <span><strong>Asymmetric</strong><small>Not available in this lab</small></span></label>
          </div></div>
        <div class="cs-field"><span class="cs-label">Key usage</span>
          <label class="cs-radio"><input type="radio" checked /> Encrypt and decrypt</label></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Add labels" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="kms-alias">Alias</label>
          <div class="kms__alias"><span class="cs-mono">alias/</span>
            <input id="kms-alias" v-model.trim="alias" class="cs-input" :class="{ 'is-invalid': tried && aliasError }" placeholder="Enter alias" /></div>
          <span v-if="tried && aliasError" class="cs-error-text">{{ aliasError }}</span></div>
        <div class="cs-field"><label class="cs-label" for="kms-desc">Description <small>- optional</small></label>
          <input id="kms-desc" v-model="description" class="cs-input" placeholder="Description of the key" /></div>
        <div class="cs-field"><span class="cs-label">Tags <small>- optional</small></span><TagEditor v-model="tags" /></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Key rotation" :level="2" :info="false" /></div>
      <div class="cs-container__body"><label class="cs-check"><input v-model="rotate" type="checkbox" /> Automatically rotate this KMS key every year
        <small>Rotation is enabled after the key is created, with its key ID.</small></label></div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('kms', 'keys')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Finish</button>
    </div>
  </div>

  <!-- Key detail -->
  <div v-else-if="page === 'key' && key">
    <CsHeader :title="key.aliases[0] || key.id">
      <template #actions>
        <CsDropdown label="Key actions" :items="keyActions" @select="action" />
      </template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="General configuration" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Alias</dt><dd>{{ key.aliases.join(', ') || '-' }}</dd></div>
        <div><dt>Status</dt><dd><CsStatus :state="key.state === 'PendingDeletion' ? 'pending' : key.state.toLowerCase()" :label="key.state" /></dd></div>
        <div><dt>ARN</dt><dd class="cs-mono">{{ key.arn }}</dd></div>
        <div><dt>Description</dt><dd>{{ key.description || '-' }}</dd></div>
        <div><dt>Creation date</dt><dd>{{ awsDate(key.created) }}</dd></div>
        <div v-if="key.deletion"><dt>Scheduled deletion date</dt><dd>{{ awsDate(key.deletion) }}</dd></div>
      </dl></div>
    </section>
    <div class="cs-tabs" role="tablist">
      <button v-for="t in ['Key policy', 'Key rotation', 'Aliases', 'Tags']" :key="t" type="button" class="cs-tab" role="tab"
              :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <section v-if="tab === 'Key policy'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Key policy" :level="2" :info="false">
        <template #actions><button v-if="!editing" type="button" class="cs-btn" @click="startPolicy">Edit</button></template></CsHeader></div>
      <div class="cs-container__body">
        <template v-if="editing">
          <textarea v-model="policyText" class="cs-textarea cs-mono kms__policy" spellcheck="false" aria-label="Key policy" />
          <span v-if="policyError" class="cs-error-text">{{ policyError }}</span>
          <div class="cs-form-actions">
            <button type="button" class="cs-btn cs-btn--link" @click="editing = false">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="savePolicy">Save changes</button>
          </div>
        </template>
        <pre v-else class="cs-code">{{ pretty(key.policy) }}</pre>
      </div>
    </section>
    <section v-else-if="tab === 'Key rotation'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Automatic key rotation" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <label class="cs-toggle"><input type="checkbox" :checked="key.rotation" :disabled="busy || key.state !== 'Enabled'" @change="toggleRotation" />
          {{ key.rotation ? 'Enabled - rotates every 365 days' : 'Disabled' }}</label>
      </div>
    </section>
    <section v-else-if="tab === 'Aliases'" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Aliases (${key.aliases.length})`" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <table v-if="key.aliases.length" class="cs-table-mini"><thead><tr><th>Alias name</th><th /></tr></thead>
          <tbody><tr v-for="a in key.aliases" :key="a"><td class="cs-mono">{{ a }}</td>
            <td><button type="button" class="cs-btn cs-btn--inline" @click="deleteAlias(a)">Delete</button></td></tr></tbody></table>
        <div class="cs-row"><span class="cs-mono">alias/</span><input v-model.trim="newAlias" class="cs-input kms__narrow" aria-label="New alias" placeholder="alias name" />
          <button type="button" class="cs-btn" :disabled="!newAlias || busy" @click="addAlias">Create alias</button></div>
      </div>
    </section>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader title="Tags" :level="2" :info="false" /></div>
      <div class="cs-container__body"><table class="cs-table-mini"><thead><tr><th>Key</th><th>Value</th></tr></thead>
        <tbody><tr v-for="(v, k) in key.tags" :key="k"><td>{{ k }}</td><td>{{ v }}</td></tr></tbody></table></div>
    </section>
    <CsDelete v-if="deleting" title="Schedule key deletion" word="confirm" action="Schedule deletion" :busy="busy"
              warning="After the waiting period ends, AWS KMS deletes this KMS key and everything encrypted under it can never be decrypted."
              @close="deleting = false" @confirm="scheduleDeletion">
      <div class="cs-field"><label class="cs-label" for="kms-wait">Waiting period (in days)</label>
        <input id="kms-wait" v-model.number="waitDays" type="number" min="7" max="30" class="cs-input kms__narrow" />
        <span class="cs-constraint">Enter a whole number between 7 and 30.</span></div>
    </CsDelete>
  </div>

  <!-- Key list -->
  <div v-else>
    <CsTable v-model:selected="selected" title="Customer managed keys" variant="full-page" :items="keys" :columns="columns"
             track-by="id" selection-type="single" filter-placeholder="Filter keys by properties or tags"
             empty-title="No customer managed keys" empty-text="You don't have any customer managed keys in this Region.">
      <template #actions>
        <CsDropdown label="Key actions" :items="[{ id: 'enable', text: 'Enable' }, { id: 'disable', text: 'Disable' }, { id: 'delete', text: 'Schedule key deletion' }]"
                    :disabled="!current" @select="listAction" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('kms', 'create')">Create key</button>
      </template>
      <template #cell-alias="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('kms', 'key', { id: row.id, name: row.aliases[0] || row.id })">{{ row.aliases[0] || '-' }}</a></template>
      <template #cell-id="{ row }"><a href="#" class="cs-link cs-mono" @click.prevent="ctx.to('kms', 'key', { id: row.id, name: row.aliases[0] || row.id })">{{ row.id }}</a></template>
      <template #cell-state="{ row }"><CsStatus :state="row.state === 'PendingDeletion' ? 'pending' : row.state.toLowerCase()" :label="row.state" /></template>
    </CsTable>
  </div>
</template>

<script setup lang="ts">
/** AWS KMS: customer managed keys - create, alias, rotation, key policy, deletion. */
import { computed, ref } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import TagEditor from '../TagEditor.vue';
import type { TagPair } from '../commands';
import { awsDate, useAws } from '../ctx';

const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const keys = computed(() => rows(ctx.view.value, 'kms.keys'));
const key = computed(() => keys.value.find(k => k.id === (ctx.route.value.params || {}).id) || null);
const selected = ref<string[]>([]);
const current = computed(() => keys.value.find(k => k.id === selected.value[0]) || null);
const busy = ref(false);
const tried = ref(false);
const alias = ref('');
const description = ref('');
const tags = ref<TagPair[]>([]);
const rotate = ref(true);
const tab = ref('Key policy');
const editing = ref(false);
const policyText = ref('');
const policyError = ref('');
const newAlias = ref('');
const deleting = ref(false);
const waitDays = ref(30);

const columns: Column[] = [
  { id: 'alias', header: 'Aliases' },
  { id: 'id', header: 'Key ID', sortKey: 'id' },
  { id: 'state', header: 'Status' },
  { id: 'spec', header: 'Key spec', cell: () => 'SYMMETRIC_DEFAULT' },
  { id: 'usage', header: 'Key usage', cell: () => 'Encrypt and decrypt' },
  { id: 'rotation', header: 'Automatic rotation', cell: r => (r.rotation ? 'Enabled' : 'Disabled') },
];
const keyActions = computed(() => [
  { id: key.value?.state === 'Enabled' ? 'disable' : 'enable', text: key.value?.state === 'Enabled' ? 'Disable' : 'Enable' },
  { id: 'delete', text: 'Schedule key deletion' },
]);

const aliasError = computed(() => {
  if (!alias.value) return 'Alias is required.';
  if (!/^[A-Za-z0-9/_-]{1,250}$/.test(alias.value)) return 'Alias can contain only alphanumeric characters, slashes, underscores, and dashes.';
  if (alias.value.startsWith('aws/')) return 'Aliases that begin with aws/ are reserved.';
  if (rows(ctx.view.value, 'kms.aliases').some(a => a.name === `alias/${alias.value}`)) return 'An alias with this name already exists.';
  return '';
});

function pretty(text: string) {
  const parsed = parseJson(text);
  return parsed ? JSON.stringify(parsed, null, 4) : text;
}

async function create() {
  tried.value = true;
  if (aliasError.value) return;
  busy.value = true;
  const tagWords = tags.value.filter(t => t.key.trim()).map(t => `TagKey=${t.key.trim()},TagValue=${t.value.trim()}`);
  const made = await ctx.run(cli(['aws', 'kms', 'create-key'], { '--description': description.value, '--tags': tagWords }));
  const id = parseJson<any>(made.output)?.KeyMetadata?.KeyId;
  if (made.ok && id) {
    await ctx.run(cli(['aws', 'kms', 'create-alias'], { '--alias-name': `alias/${alias.value}`, '--target-key-id': id }), '', { quiet: true });
    if (rotate.value) await ctx.run(cli(['aws', 'kms', 'enable-key-rotation'], { '--key-id': id }), '', { quiet: true });
    ctx.api.notify('success', `Your AWS KMS key was created with alias alias/${alias.value} and key ID ${id}.`);
    ctx.to('kms', 'key', { id, name: `alias/${alias.value}` });
  }
  busy.value = false;
}

function startPolicy() {
  policyText.value = pretty(key.value?.policy || '');
  policyError.value = '';
  editing.value = true;
}
async function savePolicy() {
  if (!parseJson(policyText.value)) { policyError.value = 'The policy is not valid JSON.'; return; }
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'kms', 'put-key-policy'], { '--key-id': key.value!.id, '--policy-name': 'default', '--policy': policyText.value }),
    'The key policy was updated.');
  busy.value = false;
  if (result.ok) editing.value = false;
}
async function toggleRotation() {
  busy.value = true;
  await ctx.run(cli(['aws', 'kms', key.value!.rotation ? 'disable-key-rotation' : 'enable-key-rotation'], { '--key-id': key.value!.id }),
    `Automatic key rotation ${key.value!.rotation ? 'disabled' : 'enabled'}.`);
  busy.value = false;
}
async function addAlias() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'kms', 'create-alias'], { '--alias-name': `alias/${newAlias.value}`, '--target-key-id': key.value!.id }),
    `Alias alias/${newAlias.value} created.`);
  busy.value = false;
  if (result.ok) newAlias.value = '';
}
async function deleteAlias(name: string) {
  await ctx.run(cli(['aws', 'kms', 'delete-alias'], { '--alias-name': name }), `Alias ${name} deleted.`);
}
async function setState(id: string, verb: 'enable-key' | 'disable-key') {
  await ctx.run(cli(['aws', 'kms', verb], { '--key-id': id }), verb === 'enable-key' ? 'The key was enabled.' : 'The key was disabled.');
}
function action(id: string) {
  if (id === 'delete') deleting.value = true;
  else setState(key.value!.id, id === 'enable' ? 'enable-key' : 'disable-key');
}
function listAction(id: string) {
  if (!current.value) return;
  if (id === 'delete') { ctx.to('kms', 'key', { id: current.value.id, name: current.value.id }); deleting.value = true; return; }
  setState(current.value.id, id === 'enable' ? 'enable-key' : 'disable-key');
}
async function scheduleDeletion() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'kms', 'schedule-key-deletion'], { '--key-id': key.value!.id, '--pending-window-in-days': waitDays.value }),
    'Key deletion was scheduled.');
  busy.value = false;
  if (result.ok) deleting.value = false;
}
</script>

<style scoped>
.kms__alias { display: flex; align-items: center; gap: 6px; }
.kms__policy { min-height: 320px; }
.kms__narrow { width: 180px; }
</style>
