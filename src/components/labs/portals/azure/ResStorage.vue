<template>
  <div>
    <template v-if="tab === 'overview'">
      <div class="az-tabs"><button type="button" class="az-tab is-active">Properties</button></div>
      <div class="az-props">
        <section><h3 class="az-section-title"><AzIcon name="container" /> Blob service</h3>
          <div class="az-kv"><span>Containers</span><span><button type="button" class="az-link" @click="$emit('tab', 'containers')">{{ containers.length }}</button></span></div>
          <div class="az-kv"><span>Access tier</span><span>{{ p.access_tier }}</span></div>
          <div class="az-kv"><span>Allow blob anonymous access</span><span>{{ p.blob_public ? 'Enabled' : 'Disabled' }}</span></div></section>
        <section><h3 class="az-section-title"><AzIcon name="nsg" /> Security</h3>
          <div class="az-kv"><span>Require secure transfer</span><span>{{ p.https_only === false ? 'Disabled' : 'Enabled' }}</span></div>
          <div class="az-kv"><span>Minimum TLS version</span><span>{{ tls(p.min_tls) }}</span></div>
          <div class="az-kv"><span>Public network access</span><span>{{ p.public_network_access || 'Enabled' }}</span></div></section>
      </div>
    </template>

    <!-- Containers / one container -->
    <template v-else-if="tab === 'containers' && !openContainer">
      <div class="az-cmdbar">
        <button type="button" class="az-cmd" @click="newContainer"><AzIcon name="plus" /> Container</button>
        <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
        <button type="button" class="az-cmd az-cmd--danger" :disabled="!picked.length" @click="deleteContainers"><AzIcon name="trash" /> Delete</button>
      </div>
      <div class="az-filters"><input v-model="needle" class="az-filter" placeholder="Search containers by prefix" /></div>
      <AzTable v-model:selected="picked" :columns="cCols" :rows="cRows" row-key="name" selectable>
        <template #cell-name="{ row }"><button type="button" class="az-link az-namecell" @click="browse(row.name)">
          <AzIcon name="container" /> {{ row.name }}</button></template>
        <template #empty>You don't have any containers yet. Click '+ Container' to get started.</template>
      </AzTable>
    </template>
    <template v-else-if="tab === 'containers' && openContainer">
      <div class="az-crumbline"><button type="button" class="az-link" @click="openContainer = ''">Containers</button> &gt; <b>{{ openContainer }}</b></div>
      <div class="az-cmdbar">
        <button type="button" class="az-cmd" @click="openUpload"><AzIcon name="upload" /> Upload</button>
        <button type="button" class="az-cmd" @click="listBlobs"><AzIcon name="refresh" /> Refresh</button>
        <button type="button" class="az-cmd az-cmd--danger" :disabled="!pickedBlobs.length" @click="deleteBlobs"><AzIcon name="trash" /> Delete</button>
      </div>
      <div class="az-muted" style="margin-bottom: 8px">Authentication method: Access key · Location: {{ openContainer }}</div>
      <AzTable v-model:selected="pickedBlobs" :columns="bCols" :rows="bRows" row-key="name" selectable>
        <template #cell-name="{ row }"><button type="button" class="az-link" @click="preview = row">{{ row.name }}</button></template>
        <template #empty>No results.</template>
      </AzTable>
      <AzPane v-if="preview" :title="preview.name" :subtitle="`${openContainer} · ${preview.size_h}`" @close="preview = null">
        <div class="az-kv"><span>URL</span><span class="az-mono">https://{{ res.name }}.blob.core.windows.net/{{ openContainer }}/{{ preview.name }}</span></div>
        <div class="az-kv"><span>Access tier</span><span>{{ preview.tier }}</span></div>
        <div class="az-kv"><span>Size</span><span>{{ preview.size_h }}</span></div>
        <h3 class="az-section-title">Edit (preview)</h3>
        <pre class="az-code">{{ preview.preview }}</pre>
        <template #foot><button type="button" class="az-btn" @click="preview = null">Close</button></template>
      </AzPane>
    </template>

    <template v-else-if="tab === 'keys'">
      <p class="az-intro">Access keys authenticate your applications' requests to this storage account. Store your keys
        securely – for example, using Azure Key Vault – and don't share them.</p>
      <div class="az-cmdbar">
        <button type="button" class="az-cmd" @click="shown = !shown"><AzIcon name="eye" /> {{ shown ? 'Hide' : 'Show' }} keys</button>
        <button type="button" class="az-cmd" @click="loadKeys"><AzIcon name="refresh" /> Refresh</button>
      </div>
      <div v-for="(k, i) in keys" :key="k.keyName" class="az-card" style="margin-bottom: 12px">
        <h3>{{ k.keyName }} <button type="button" class="az-btn" style="margin-left: 12px" @click="rotate(i === 0 ? 'primary' : 'secondary')">
          <AzIcon name="restart" /> Rotate key</button></h3>
        <div class="az-field"><div class="az-field__label">Key</div>
          <div class="az-field__ctl"><input class="az-input az-mono" readonly :type="shown ? 'text' : 'password'" :value="k.value" /></div></div>
        <div class="az-field"><div class="az-field__label">Connection string</div>
          <div class="az-field__ctl"><input class="az-input az-mono" readonly :type="shown ? 'text' : 'password'"
                 :value="`DefaultEndpointsProtocol=https;AccountName=${res.name};AccountKey=${k.value};EndpointSuffix=core.windows.net`" /></div></div>
      </div>
      <div v-if="!keys.length" class="az-muted">Loading keys…</div>
    </template>

    <template v-else-if="tab === 'configuration'">
      <div class="az-form">
        <div class="az-field"><div class="az-field__label">Secure transfer required</div>
          <div class="az-radios"><label class="az-radio"><input v-model="cfg.https" type="radio" value="true" /> Enabled</label>
            <label class="az-radio"><input v-model="cfg.https" type="radio" value="false" /> Disabled</label></div></div>
        <div class="az-field"><div class="az-field__label">Allow Blob anonymous access</div>
          <div class="az-radios"><label class="az-radio"><input v-model="cfg.blob" type="radio" value="true" /> Enabled</label>
            <label class="az-radio"><input v-model="cfg.blob" type="radio" value="false" /> Disabled</label></div></div>
        <div class="az-field"><div class="az-field__label">Minimum TLS version</div>
          <div class="az-field__ctl"><select v-model="cfg.tls" class="az-select">
            <option value="TLS1_0">Version 1.0</option><option value="TLS1_1">Version 1.1</option>
            <option value="TLS1_2">Version 1.2</option></select></div></div>
        <div class="az-field"><div class="az-field__label">Blob access tier (default)</div>
          <div class="az-radios"><label v-for="t in ['Hot', 'Cool', 'Cold']" :key="t" class="az-radio">
            <input v-model="cfg.tier" type="radio" :value="t" /> {{ t }}</label></div></div>
        <div class="az-field"><div class="az-field__label">Replication</div>
          <div class="az-field__ctl"><select v-model="cfg.sku" class="az-select">
            <option value="Standard_LRS">Locally-redundant storage (LRS)</option>
            <option value="Standard_ZRS">Zone-redundant storage (ZRS)</option>
            <option value="Standard_GRS">Geo-redundant storage (GRS)</option>
            <option value="Premium_LRS">Premium LRS</option></select></div></div>
        <div style="display: flex; gap: 8px">
          <button type="button" class="az-btn az-btn--primary" @click="saveCfg">Save</button>
          <button type="button" class="az-btn" @click="resetCfg">Discard</button>
        </div>
      </div>
    </template>

    <template v-else-if="tab === 'networking'">
      <h2 class="az-h2">Firewalls and virtual networks</h2>
      <div class="az-field"><div class="az-field__label">Public network access</div>
        <div class="az-radios">
          <label class="az-radio"><input v-model="net" type="radio" value="Enabled" /> Enabled from all networks</label>
          <label class="az-radio"><input v-model="net" type="radio" value="Disabled" /> Disabled</label></div></div>
      <div v-if="net === 'Disabled'" class="az-banner"><AzIcon name="infofill" />
        <span>Only private endpoints can reach this account. Create one from <button type="button" class="az-link"
          @click="az.go({ page: 'create', kind: 'privateendpoint' })">Private endpoints</button>.</span></div>
      <button type="button" class="az-btn az-btn--primary" :disabled="net === (p.public_network_access || 'Enabled')" @click="saveNet">Save</button>
    </template>

    <!-- New container pane -->
    <AzPane v-if="creatingC" title="New container" :error="cError" @close="creatingC = false">
      <div class="az-field"><div class="az-field__label">Name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="cForm.name" class="az-input" :class="{ 'is-bad': cBad }" />
          <div v-if="cBad" class="az-err">{{ cBad }}</div></div></div>
      <div class="az-field"><div class="az-field__label">Anonymous access level</div>
        <div class="az-field__ctl"><select v-model="cForm.level" class="az-select">
          <option value="off">Private (no anonymous access)</option>
          <option value="blob" :disabled="!p.blob_public">Blob (anonymous read access for blobs only)</option>
          <option value="container" :disabled="!p.blob_public">Container (anonymous read access for containers and blobs)</option>
        </select>
          <div v-if="!p.blob_public" class="az-help">Blob anonymous access is disabled for this storage account.</div></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="Boolean(cBad)" @click="createContainer">Create</button>
        <button type="button" class="az-btn" @click="creatingC = false">Cancel</button>
      </template>
    </AzPane>

    <!-- Upload pane -->
    <AzPane v-if="uploading" title="Upload blob" :subtitle="openContainer" :error="uError" @close="uploading = false">
      <div class="az-field"><div class="az-field__label">Source</div>
        <div class="az-radios">
          <label class="az-radio"><input v-model="uForm.mode" type="radio" value="file" /> File from the lab workspace</label>
          <label class="az-radio"><input v-model="uForm.mode" type="radio" value="text" /> Text content</label></div></div>
      <div v-if="uForm.mode === 'file'" class="az-field"><div class="az-field__label">File <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="uForm.file" class="az-select">
          <option value="">Select a file</option><option v-for="f in files" :key="f" :value="f">{{ f }}</option></select>
          <div v-if="!files.length" class="az-help">The lab workspace has no files yet. Create one with the Files tool.</div></div></div>
      <template v-else>
        <div class="az-field"><div class="az-field__label">Content <span class="az-req">*</span></div>
          <div class="az-field__ctl"><textarea v-model="uForm.text" class="az-textarea"></textarea></div></div>
      </template>
      <div class="az-field"><div class="az-field__label">Blob name {{ uForm.mode === 'text' ? '*' : '' }}</div>
        <div class="az-field__ctl"><input v-model="uForm.name" class="az-input" :placeholder="uForm.file ? uForm.file.split('/').pop() : 'hello.txt'" /></div></div>
      <label class="az-check"><input v-model="uForm.overwrite" type="checkbox" /> Overwrite if files already exist</label>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary"
                :disabled="uForm.mode === 'file' ? !uForm.file : !(uForm.text && uForm.name)" @click="upload">Upload</button>
        <button type="button" class="az-btn" @click="uploading = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** A storage account's blades: Containers (and blobs), Access keys, Configuration, Networking. */
import { computed, reactive, ref, watch } from 'vue';
import { cli, errorText, matches, parseJson, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import { fmtDate, useAz } from './azure';

const props = defineProps<{ res: Record<string, any>; tab: string }>();
defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
const p = computed(() => props.res.props || {});
function tls(v: string) { return ({ TLS1_0: 'Version 1.0', TLS1_1: 'Version 1.1', TLS1_2: 'Version 1.2' } as Record<string, string>)[v] || v || 'Version 1.2'; }

const containers = computed(() => rows(az.p.value, 'containers').filter(c => c.account === props.res.name));
const needle = ref('');
const picked = ref<string[]>([]);
const cRows = computed(() => containers.value.filter(c => matches(c, needle.value, ['name']))
  .map(c => ({ name: c.name, modified: fmtDate(c.created),
               level: c.level === 'blob' ? 'Blob' : c.level === 'container' ? 'Container' : 'Private',
               lease: 'Available', blobs: c.blobs })));
const cCols = [{ key: 'name', label: 'Name' }, { key: 'modified', label: 'Last modified' },
               { key: 'level', label: 'Anonymous access level' }, { key: 'lease', label: 'Lease state' },
               { key: 'blobs', label: 'Blobs' }];

const creatingC = ref(false);
const cError = ref('');
const cForm = reactive({ name: '', level: 'off' });
const cBad = computed(() => {
  const n = cForm.name;
  if (!n) return 'A container name is required.';
  if (!/^[a-z0-9](?!.*--)[a-z0-9-]{1,61}[a-z0-9]$/.test(n)) return 'This name may only contain lowercase letters, numbers, and hyphens, and must begin with a letter or a number. Each hyphen must be preceded and followed by a non-hyphen character. The name must also be between 3 and 63 characters long.';
  if (containers.value.some(c => c.name === n)) return 'A container with this name already exists.';
  return '';
});
function newContainer() { cForm.name = ''; cForm.level = 'off'; cError.value = ''; creatingC.value = true; }
async function createContainer() {
  const base = ['az', 'storage', 'container', 'create'];
  const flags: Record<string, any> = { '--account-name': props.res.name, '--name': cForm.name };
  if (cForm.level !== 'off') flags['--public-access'] = cForm.level;
  const result = await az.run(cli(base, flags), `Successfully created storage container '${cForm.name}'.`, { quiet: true });
  if (!result.ok) { cError.value = errorText(result); return; }
  creatingC.value = false;
}
async function deleteContainers() {
  const items = [...picked.value];
  if (!(await az.confirm({ title: 'Delete container(s)', message: 'Are you sure you want to delete the selected container(s)? All blobs in them will be deleted.', items, confirmLabel: 'Yes', danger: true }))) return;
  for (const name of items) {
    await az.run(cli(['az', 'storage', 'container', 'delete'], { '--account-name': props.res.name, '--name': name }),
                 `Successfully deleted storage container '${name}'.`);
  }
  picked.value = [];
}

const openContainer = ref('');
const pickedBlobs = ref<string[]>([]);
const preview = ref<Record<string, any> | null>(null);
const bRows = computed(() => rows(az.p.value, 'blobs').filter(b => b.account === props.res.name && b.container === openContainer.value)
  .map((b): Record<string, any> => ({ ...b, modified_h: fmtDate(b.modified), type: 'Block blob', lease: 'Available' })));
const bCols = [{ key: 'name', label: 'Name' }, { key: 'modified_h', label: 'Modified' }, { key: 'tier', label: 'Access tier' },
               { key: 'type', label: 'Blob type' }, { key: 'size_h', label: 'Size' }, { key: 'lease', label: 'Lease state' }];
function browse(name: string) { openContainer.value = name; pickedBlobs.value = []; listBlobs(); }
function listBlobs() {
  void az.run(cli(['az', 'storage', 'blob', 'list'], { '--account-name': props.res.name, '--container-name': openContainer.value,
                                                     '--output': 'table' }), '', { quiet: true });
}
async function deleteBlobs() {
  const items = [...pickedBlobs.value];
  if (!(await az.confirm({ title: 'Delete blob(s)', message: 'Do you want to delete the selected blob(s)?', items, confirmLabel: 'OK', danger: true }))) return;
  for (const name of items) {
    await az.run(cli(['az', 'storage', 'blob', 'delete'], { '--account-name': props.res.name,
                                                           '--container-name': openContainer.value, '--name': name }),
                 `Successfully deleted blob '${name}'`);
  }
  pickedBlobs.value = [];
}
const files = computed<string[]>(() => (az.p.value.files || []) as string[]);
const uploading = ref(false);
const uError = ref('');
const uForm = reactive({ mode: 'file', file: '', text: '', name: '', overwrite: true });
function openUpload() { Object.assign(uForm, { mode: files.value.length ? 'file' : 'text', file: '', text: '', name: '', overwrite: true }); uError.value = ''; uploading.value = true; }
async function upload() {
  const name = uForm.name || (uForm.mode === 'file' ? uForm.file.split('/').pop() : '');
  if (!uForm.overwrite && bRows.value.some(b => b.name === name)) { uError.value = `A blob named '${name}' already exists.`; return; }
  const flags: Record<string, any> = { '--account-name': props.res.name, '--container-name': openContainer.value, '--name': name };
  if (uForm.mode === 'file') flags['--file'] = uForm.file; else flags['--data'] = uForm.text;
  if (uForm.overwrite) flags['--overwrite'] = true;
  const result = await az.run(cli(['az', 'storage', 'blob', 'upload'], flags), `Successfully uploaded blob '${name}'`, { quiet: true });
  if (!result.ok) { uError.value = errorText(result); return; }
  uploading.value = false;
}

const keys = ref<Record<string, any>[]>([]);
const shown = ref(false);
async function loadKeys() {
  const result = await az.run(cli(['az', 'storage', 'account', 'keys', 'list'], { '-g': props.res.group, '--account-name': props.res.name }),
                              '', { quiet: true });
  keys.value = parseJson<Record<string, any>[]>(result.output) || [];
}
async function rotate(which: 'primary' | 'secondary') {
  if (!(await az.confirm({ title: 'Regenerate access key', message: `The current ${which === 'primary' ? 'key1' : 'key2'} will become invalid immediately. Any application using it will lose access. Do you want to regenerate it?`, confirmLabel: 'Yes', danger: true }))) return;
  const result = await az.run(cli(['az', 'storage', 'account', 'keys', 'renew'], { '-g': props.res.group, '--account-name': props.res.name, '--key': which }),
                              `Successfully rotated ${which === 'primary' ? 'key1' : 'key2'}`, { quiet: true });
  if (result.ok) keys.value = parseJson<Record<string, any>[]>(result.output) || keys.value;
}
watch(() => props.tab, t => { if (t === 'keys' && !keys.value.length) loadKeys(); }, { immediate: true });

const cfg = reactive({ https: 'true', blob: 'false', tls: 'TLS1_2', tier: 'Hot', sku: 'Standard_LRS' });
function resetCfg() {
  Object.assign(cfg, { https: String(p.value.https_only !== false), blob: String(Boolean(p.value.blob_public)),
                       tls: p.value.min_tls || 'TLS1_2', tier: p.value.access_tier || 'Hot', sku: p.value.sku || 'Standard_LRS' });
}
resetCfg();
async function saveCfg() {
  const flags: Record<string, any> = { '-g': props.res.group, '-n': props.res.name };
  if (cfg.https !== String(p.value.https_only !== false)) flags['--https-only'] = cfg.https;
  if (cfg.blob !== String(Boolean(p.value.blob_public))) flags['--allow-blob-public-access'] = cfg.blob;
  if (cfg.tls !== (p.value.min_tls || 'TLS1_2')) flags['--min-tls-version'] = cfg.tls;
  if (cfg.tier !== p.value.access_tier) flags['--access-tier'] = cfg.tier;
  if (cfg.sku !== p.value.sku) flags['--sku'] = cfg.sku;
  if (Object.keys(flags).length === 2) { az.note('info', 'No changes to save'); return; }
  await az.run(cli(['az', 'storage', 'account', 'update'], flags), `Successfully updated storage account '${props.res.name}'`);
}
const net = ref(String(p.value.public_network_access || 'Enabled'));
async function saveNet() {
  await az.run(cli(['az', 'storage', 'account', 'update'], { '-g': props.res.group, '-n': props.res.name, '--public-network-access': net.value }),
               `Successfully updated networking for '${props.res.name}'`);
}
</script>

<style scoped>
.az-props { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; }
.az-props .az-section-title { display: flex; align-items: center; gap: 8px; }
.az-crumbline { margin: 0 0 8px; }
@container sl-portal (max-width: 900px) { .az-props { grid-template-columns: 1fr; } }
</style>
