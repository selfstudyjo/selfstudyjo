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
        <button type="button" class="az-cmd" :disabled="picked.length !== 1" @click="openLevel(picked[0])"><AzIcon name="lock" /> Change access level</button>
        <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
        <button type="button" class="az-cmd az-cmd--danger" :disabled="!picked.length" @click="deleteContainers"><AzIcon name="trash" /> Delete</button>
      </div>
      <div class="az-filters"><input v-model="needle" class="az-filter" placeholder="Search containers by prefix" /></div>
      <AzTable v-model:selected="picked" :columns="cCols" :rows="cRows" row-key="name" selectable
               menu @menu="(row, x, y) => (cMenu = { row, x, y })">
        <template #cell-name="{ row }"><button type="button" class="az-link az-namecell" @click="browse(row.name)">
          <AzIcon name="container" /> {{ row.name }}</button></template>
        <template #empty>You don't have any containers yet. Click '+ Container' to get started.</template>
      </AzTable>
    </template>
    <template v-else-if="tab === 'containers' && openContainer">
      <div class="az-crumbline"><button type="button" class="az-link" @click="openContainer = ''">Containers</button> &gt; <b>{{ openContainer }}</b></div>
      <div class="az-cmdbar">
        <button type="button" class="az-cmd" @click="openUpload"><AzIcon name="upload" /> Upload</button>
        <button type="button" class="az-cmd" :disabled="pickedBlobs.length !== 1" @click="download(pickedBlobs[0])"><AzIcon name="download" /> Download</button>
        <button type="button" class="az-cmd" :disabled="pickedBlobs.length !== 1" @click="openTier(pickedBlobs[0])"><AzIcon name="settings" /> Change tier</button>
        <button type="button" class="az-cmd" :disabled="pickedBlobs.length !== 1" @click="openSas('blob', pickedBlobs[0])"><AzIcon name="key" /> Generate SAS</button>
        <button type="button" class="az-cmd" @click="listBlobs"><AzIcon name="refresh" /> Refresh</button>
        <button type="button" class="az-cmd az-cmd--danger" :disabled="!pickedBlobs.length" @click="deleteBlobs"><AzIcon name="trash" /> Delete</button>
      </div>
      <div class="az-muted" style="margin-bottom: 8px">Authentication method: Access key · Location: {{ openContainer }}</div>
      <AzTable v-model:selected="pickedBlobs" :columns="bCols" :rows="bRows" row-key="name" selectable
               menu @menu="(row, x, y) => (bMenu = { row, x, y })">
        <template #cell-name="{ row }"><button type="button" class="az-link" @click="openPreview(row)">{{ row.name }}</button></template>
        <template #empty>No results.</template>
      </AzTable>
      <AzPane v-if="preview" :title="preview.name" :subtitle="`${openContainer} · ${preview.size_h}`" :error="editError" @close="preview = null">
        <div class="az-tabs">
          <button type="button" class="az-tab" :class="{ 'is-active': previewTab === 'overview' }" @click="previewTab = 'overview'">Overview</button>
          <button type="button" class="az-tab" :class="{ 'is-active': previewTab === 'edit' }" :disabled="preview.tier === 'Archive'" @click="previewTab = 'edit'">Edit</button>
          <button type="button" class="az-tab" @click="openSas('blob', preview.name)">Generate SAS</button>
        </div>
        <template v-if="previewTab === 'overview'">
          <div class="az-kv"><span>URL</span><span class="az-mono">https://{{ res.name }}.blob.core.windows.net/{{ openContainer }}/{{ preview.name }}</span></div>
          <div class="az-kv"><span>Access tier</span><span>{{ preview.tier }}</span></div>
          <div class="az-kv"><span>Blob type</span><span>Block blob</span></div>
          <div class="az-kv"><span>Size</span><span>{{ preview.size_h }}</span></div>
          <div class="az-kv"><span>Last modified</span><span>{{ preview.modified_h }}</span></div>
          <div v-if="preview.tier === 'Archive'" class="az-banner is-warning" style="margin-top: 10px"><AzIcon name="warning" />
            <span>This blob is in the Archive tier. Its content cannot be read until it is rehydrated to an online tier.</span></div>
        </template>
        <template v-else>
          <textarea v-model="editBody" class="az-textarea az-mono" style="min-height: 260px" spellcheck="false" aria-label="Blob content"></textarea>
        </template>
        <template #foot>
          <template v-if="previewTab === 'edit'">
            <button type="button" class="az-btn az-btn--primary" :disabled="editBody === (preview.preview || '')" @click="saveEdit">Save</button>
            <button type="button" class="az-btn" @click="editBody = preview.preview || ''">Discard</button>
          </template>
          <button type="button" class="az-btn" :disabled="preview.tier === 'Archive'" @click="download(preview.name)"><AzIcon name="download" /> Download</button>
          <button type="button" class="az-btn" @click="preview = null">Close</button>
        </template>
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

    <template v-if="tab === 'sas'">
      <p class="az-intro">A shared access signature (SAS) is a URI that grants restricted access rights to Azure Storage resources.
        It is signed with one of this account's access keys — rotating that key invalidates every SAS signed with it.</p>
      <div class="az-form">
        <div class="az-field"><div class="az-field__label">Allowed services</div>
          <div class="az-radios"><label v-for="sv in SAS_SERVICES" :key="sv.k" class="az-check"><input v-model="acct.services" type="checkbox" :value="sv.k" /> {{ sv.l }}</label></div></div>
        <div class="az-field"><div class="az-field__label">Allowed resource types</div>
          <div class="az-radios"><label v-for="rt in SAS_TYPES" :key="rt.k" class="az-check"><input v-model="acct.types" type="checkbox" :value="rt.k" /> {{ rt.l }}</label></div></div>
        <div class="az-field"><div class="az-field__label">Allowed permissions</div>
          <div class="az-radios"><label v-for="pm in ACCOUNT_PERMS" :key="pm.k" class="az-check"><input v-model="acct.perms" type="checkbox" :value="pm.k" /> {{ pm.l }}</label></div></div>
        <div class="az-field"><div class="az-field__label">Start and expiry date/time</div>
          <div class="az-field__ctl sas-dates"><input v-model="acct.start" class="az-input" type="datetime-local" aria-label="Start" />
            <input v-model="acct.expiry" class="az-input" type="datetime-local" aria-label="End" /></div></div>
        <div class="az-field"><div class="az-field__label">Allowed protocols</div>
          <div class="az-radios"><label class="az-radio"><input v-model="acct.https" type="radio" :value="true" /> HTTPS only</label>
            <label class="az-radio"><input v-model="acct.https" type="radio" :value="false" /> HTTPS and HTTP</label></div></div>
        <div class="az-field"><div class="az-field__label">Signing key</div>
          <div class="az-field__ctl"><select class="az-select" disabled aria-label="Signing key"><option>key1</option></select></div></div>
        <button type="button" class="az-btn az-btn--primary" :disabled="!acct.services.length || !acct.types.length || !acct.perms.length || !acct.expiry"
                @click="genAccountSas">Generate SAS and connection string</button>
        <div v-if="acctOut" style="margin-top: 16px">
          <div class="az-field"><div class="az-field__label">SAS token</div><div class="az-field__ctl sas-copy">
            <input class="az-input az-mono" readonly :value="'?' + acctOut" aria-label="SAS token" />
            <button type="button" class="az-btn" aria-label="Copy" @click="copy('?' + acctOut)"><AzIcon name="copy" /></button></div></div>
          <div class="az-field"><div class="az-field__label">Blob service SAS URL</div><div class="az-field__ctl sas-copy">
            <input class="az-input az-mono" readonly :value="`https://${res.name}.blob.core.windows.net/?${acctOut}`" aria-label="Blob service SAS URL" />
            <button type="button" class="az-btn" aria-label="Copy" @click="copy(`https://${res.name}.blob.core.windows.net/?${acctOut}`)"><AzIcon name="copy" /></button></div></div>
          <div class="az-field"><div class="az-field__label">Connection string</div><div class="az-field__ctl sas-copy">
            <input class="az-input az-mono" readonly :value="`BlobEndpoint=https://${res.name}.blob.core.windows.net/;SharedAccessSignature=${acctOut}`" aria-label="Connection string" />
            <button type="button" class="az-btn" aria-label="Copy" @click="copy(`BlobEndpoint=https://${res.name}.blob.core.windows.net/;SharedAccessSignature=${acctOut}`)"><AzIcon name="copy" /></button></div></div>
        </div>
      </div>
    </template>

    <AzContextMenu v-if="cMenu" :items="containerItems" :x="cMenu.x" :y="cMenu.y" @pick="containerPick" @close="cMenu = null" />
    <AzContextMenu v-if="bMenu" :items="blobItems" :x="bMenu.x" :y="bMenu.y" @pick="blobPick" @close="bMenu = null" />

    <!-- Generate SAS (blob / container) -->
    <AzPane v-if="sas" title="Generate SAS" :subtitle="sas.kind === 'blob' ? `${openContainer}/${sas.name}` : sas.name"
            :error="sasError" @close="sas = null">
      <div class="az-field"><div class="az-field__label">Signing method</div>
        <div class="az-radios"><label class="az-radio"><input type="radio" checked /> Account key</label>
          <label class="az-radio" title="User delegation keys are not modelled in this lab"><input type="radio" disabled /> User delegation key</label></div></div>
      <div class="az-field"><div class="az-field__label">Signing key</div>
        <div class="az-field__ctl"><select class="az-select" disabled aria-label="Signing key"><option>Key 1</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Permissions <span class="az-req">*</span></div>
        <div class="az-radios"><label v-for="pm in (sas.kind === 'blob' ? BLOB_PERMS : CONTAINER_PERMS)" :key="pm.k" class="az-check">
          <input v-model="sasForm.perms" type="checkbox" :value="pm.k" /> {{ pm.l }}</label></div></div>
      <div class="az-field"><div class="az-field__label">Start</div>
        <div class="az-field__ctl"><input v-model="sasForm.start" class="az-input" type="datetime-local" aria-label="Start" /></div></div>
      <div class="az-field"><div class="az-field__label">Expiry <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="sasForm.expiry" class="az-input" type="datetime-local" aria-label="Expiry" /></div></div>
      <div class="az-field"><div class="az-field__label">Allowed protocols</div>
        <div class="az-radios"><label class="az-radio"><input v-model="sasForm.https" type="radio" :value="true" /> HTTPS only</label>
          <label class="az-radio"><input v-model="sasForm.https" type="radio" :value="false" /> HTTPS and HTTP</label></div></div>
      <template v-if="sasOut">
        <div class="az-field"><div class="az-field__label">{{ sas.kind === 'blob' ? 'Blob SAS token' : 'SAS token' }}</div><div class="az-field__ctl sas-copy">
          <input class="az-input az-mono" readonly :value="sasOut.token" aria-label="SAS token" />
          <button type="button" class="az-btn" aria-label="Copy" @click="copy(sasOut.token)"><AzIcon name="copy" /></button></div></div>
        <div class="az-field"><div class="az-field__label">{{ sas.kind === 'blob' ? 'Blob SAS URL' : 'SAS URL' }}</div><div class="az-field__ctl sas-copy">
          <input class="az-input az-mono" readonly :value="sasOut.url" aria-label="SAS URL" />
          <button type="button" class="az-btn" aria-label="Copy" @click="copy(sasOut.url)"><AzIcon name="copy" /></button></div></div>
      </template>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!sasForm.perms.length || !sasForm.expiry" @click="genSas">Generate SAS token and URL</button>
        <button type="button" class="az-btn" @click="sas = null">Close</button>
      </template>
    </AzPane>

    <!-- Change tier -->
    <AzPane v-if="tierFor" title="Change tier" :subtitle="tierFor" :error="tierError" @close="tierFor = ''">
      <p class="az-intro">Optimize storage costs by placing your data in the appropriate access tier.</p>
      <div class="az-field"><div class="az-field__label">Access tier</div>
        <div class="az-field__ctl"><select v-model="tierChoice" class="az-select" aria-label="Access tier">
          <option value="Hot">Hot</option><option value="Cool">Cool</option><option value="Cold">Cold</option><option value="Archive">Archive</option></select>
          <div v-if="tierChoice === 'Archive'" class="az-help">An archived blob is offline: it cannot be read or downloaded until it is rehydrated to Hot, Cool or Cold.</div></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" @click="saveTier">Save</button>
        <button type="button" class="az-btn" @click="tierFor = ''">Cancel</button>
      </template>
    </AzPane>

    <!-- Change access level -->
    <AzPane v-if="levelFor" title="Change access level" :subtitle="levelFor" :error="levelError" @close="levelFor = ''">
      <div class="az-field"><div class="az-field__label">Anonymous access level</div>
        <div class="az-field__ctl"><select v-model="levelChoice" class="az-select" aria-label="Anonymous access level">
          <option value="off">Private (no anonymous access)</option>
          <option value="blob" :disabled="!p.blob_public">Blob (anonymous read access for blobs only)</option>
          <option value="container" :disabled="!p.blob_public">Container (anonymous read access for containers and blobs)</option></select>
          <div v-if="!p.blob_public" class="az-help">Anonymous access is disabled for this storage account. Enable "Allow Blob anonymous access" in Configuration first.</div></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" @click="saveLevel">OK</button>
        <button type="button" class="az-btn" @click="levelFor = ''">Cancel</button>
      </template>
    </AzPane>

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
import AzContextMenu, { type CtxItem } from './AzContextMenu.vue';
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
const previewTab = ref<'overview' | 'edit'>('overview');
const editBody = ref('');
const editError = ref('');
function openPreview(row: Record<string, any>) {
  preview.value = row;
  previewTab.value = 'overview';
  editBody.value = String(row.preview || '');
  editError.value = '';
}
/** "Edit" saves by re-uploading the blob, which is exactly what the portal does. */
async function saveEdit() {
  if (!preview.value) return;
  const name = String(preview.value.name);
  const result = await az.run(cli(['az', 'storage', 'blob', 'upload'], { '--account-name': props.res.name,
    '--container-name': openContainer.value, '--name': name, '--data': editBody.value, '--overwrite': true }),
    `Successfully saved blob '${name}'`, { quiet: true });
  if (!result.ok) { editError.value = errorText(result); return; }
  const fresh = bRows.value.find(b => b.name === name);
  if (fresh) preview.value = fresh;
}
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

// ----- row menus ("..." and right-click) -----
const cMenu = ref<{ row: Record<string, any>; x: number; y: number } | null>(null);
const bMenu = ref<{ row: Record<string, any>; x: number; y: number } | null>(null);
const containerItems: CtxItem[] = [
  { key: 'open', label: 'Open', icon: 'container' },
  { key: 'level', label: 'Change access level', icon: 'lock' },
  { key: 'sas', label: 'Generate SAS', icon: 'key' },
  { key: 'url', label: 'Copy URL', icon: 'copy' },
  { key: 's', sep: true },
  { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
];
const blobItems = computed<CtxItem[]>(() => [
  { key: 'view', label: 'View/edit', icon: 'edit', disabled: bMenu.value?.row.tier === 'Archive' },
  { key: 'download', label: 'Download', icon: 'download', disabled: bMenu.value?.row.tier === 'Archive' },
  { key: 'tier', label: 'Change tier', icon: 'settings' },
  { key: 'sas', label: 'Generate SAS', icon: 'key' },
  { key: 'url', label: 'Copy URL', icon: 'copy' },
  { key: 's', sep: true },
  { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
]);
async function containerPick(key: string) {
  const row = cMenu.value?.row;
  cMenu.value = null;
  if (!row) return;
  const name = String(row.name);
  if (key === 'open') browse(name);
  else if (key === 'level') openLevel(name);
  else if (key === 'sas') openSas('container', name);
  else if (key === 'url') copy(`https://${props.res.name}.blob.core.windows.net/${name}`);
  else if (key === 'delete') { picked.value = [name]; await deleteContainers(); }
}
async function blobPick(key: string) {
  const row = bMenu.value?.row;
  bMenu.value = null;
  if (!row) return;
  const name = String(row.name);
  if (key === 'view') openPreview(row);
  else if (key === 'download') await download(name);
  else if (key === 'tier') openTier(name);
  else if (key === 'sas') openSas('blob', name);
  else if (key === 'url') copy(`https://${props.res.name}.blob.core.windows.net/${openContainer.value}/${name}`);
  else if (key === 'delete') { pickedBlobs.value = [name]; await deleteBlobs(); }
}
function copy(text: string) {
  void navigator.clipboard?.writeText(text);
  az.note('info', 'Copied to clipboard');
}

// ----- download: `az storage blob download` with no --file prints the content -----
async function download(name: string) {
  const result = await az.run(cli(['az', 'storage', 'blob', 'download'], { '--account-name': props.res.name,
    '--container-name': openContainer.value, '--name': name }), '', { quiet: true });
  if (!result.ok) { az.api.notify('error', `Failed to download '${name}'`, errorText(result)); return; }
  const url = URL.createObjectURL(new Blob([String(result.output || '')], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.split('/').pop() || name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  az.note('success', `Downloaded '${name}'`);
}

// ----- SAS -----
function inDays(days: number) {
  const d = new Date(Date.now() + days * 86400000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
/** A datetime-local value as the UTC string the CLI takes: 2026-12-31T23:59Z. */
function utc(local: string) {
  if (!local) return '';
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16) + 'Z';
}
const BLOB_PERMS = [{ k: 'r', l: 'Read' }, { k: 'a', l: 'Add' }, { k: 'c', l: 'Create' }, { k: 'w', l: 'Write' },
                    { k: 'd', l: 'Delete' }];
const CONTAINER_PERMS = [...BLOB_PERMS, { k: 'l', l: 'List' }];
const ACCOUNT_PERMS = [{ k: 'r', l: 'Read' }, { k: 'w', l: 'Write' }, { k: 'd', l: 'Delete' }, { k: 'l', l: 'List' },
                       { k: 'a', l: 'Add' }, { k: 'c', l: 'Create' }];
const SAS_SERVICES = [{ k: 'b', l: 'Blob' }, { k: 'f', l: 'File' }, { k: 'q', l: 'Queue' }, { k: 't', l: 'Table' }];
const SAS_TYPES = [{ k: 's', l: 'Service' }, { k: 'c', l: 'Container' }, { k: 'o', l: 'Object' }];
const sas = ref<{ kind: 'blob' | 'container'; name: string } | null>(null);
const sasForm = reactive({ perms: ['r'] as string[], start: '', expiry: '', https: true });
const sasOut = ref<{ token: string; url: string } | null>(null);
const sasError = ref('');
function openSas(kind: 'blob' | 'container', name: string) {
  sas.value = { kind, name };
  sasOut.value = null;
  sasError.value = '';
  Object.assign(sasForm, { perms: kind === 'blob' ? ['r'] : ['r', 'l'], start: inDays(0), expiry: inDays(1), https: true });
}
function ordered(perms: string[], order: string) { return order.split('').filter(ch => perms.includes(ch)).join(''); }
async function genSas() {
  const s = sas.value;
  if (!s) return;
  sasError.value = '';
  const flags: Record<string, any> = { '--account-name': props.res.name };
  if (s.kind === 'blob') { flags['--container-name'] = openContainer.value; flags['--name'] = s.name; }
  else flags['--name'] = s.name;
  flags['--https-only'] = sasForm.https;
  flags['--permissions'] = ordered(sasForm.perms, 'racwdl');
  flags['--start'] = utc(sasForm.start);
  flags['--expiry'] = utc(sasForm.expiry);
  const base = s.kind === 'blob' ? ['az', 'storage', 'blob', 'generate-sas'] : ['az', 'storage', 'container', 'generate-sas'];
  const result = await az.run(cli(base, flags), '', { quiet: true });
  if (!result.ok) { sasError.value = errorText(result); return; }
  const token = String(parseJson<string>(result.output) || '');
  const path = s.kind === 'blob' ? `${openContainer.value}/${s.name}` : s.name;
  sasOut.value = { token, url: `https://${props.res.name}.blob.core.windows.net/${path}?${token}` };
}
const acct = reactive({ services: ['b'] as string[], types: ['s', 'c', 'o'] as string[], perms: ['r', 'l'] as string[],
                        start: inDays(0), expiry: inDays(7), https: true });
const acctOut = ref('');
async function genAccountSas() {
  const result = await az.run(cli(['az', 'storage', 'account', 'generate-sas'], {
    '--account-name': props.res.name, '--https-only': acct.https, '--services': ordered(acct.services, 'bfqt'),
    '--resource-types': ordered(acct.types, 'sco'), '--permissions': ordered(acct.perms, 'rwdlac'),
    '--start': utc(acct.start), '--expiry': utc(acct.expiry) }), '', { quiet: true });
  if (!result.ok) { az.api.notify('error', 'Could not generate the SAS', errorText(result)); return; }
  acctOut.value = String(parseJson<string>(result.output) || '');
}

// ----- tier and access level -----
const tierFor = ref('');
const tierChoice = ref('Hot');
const tierError = ref('');
function openTier(name: string) {
  tierFor.value = name;
  tierError.value = '';
  tierChoice.value = String(bRows.value.find(b => b.name === name)?.tier || 'Hot');
}
async function saveTier() {
  const name = tierFor.value;
  const result = await az.run(cli(['az', 'storage', 'blob', 'set-tier'], { '--account-name': props.res.name,
    '--container-name': openContainer.value, '--name': name, '--tier': tierChoice.value }),
    `Successfully changed the tier of '${name}' to ${tierChoice.value}`, { quiet: true });
  if (!result.ok) { tierError.value = errorText(result); return; }
  tierFor.value = '';
}
const levelFor = ref('');
const levelChoice = ref('off');
const levelError = ref('');
function openLevel(name: string) {
  levelFor.value = name;
  levelError.value = '';
  levelChoice.value = String(containers.value.find(c => c.name === name)?.level || 'off');
}
async function saveLevel() {
  const name = levelFor.value;
  const result = await az.run(cli(['az', 'storage', 'container', 'set-permission'], { '--account-name': props.res.name,
    '--name': name, '--public-access': levelChoice.value }), `Successfully changed the access level of '${name}'`, { quiet: true });
  if (!result.ok) { levelError.value = errorText(result); return; }
  levelFor.value = '';
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
.sas-dates { display: flex; gap: 8px; flex-wrap: wrap; }
.sas-dates .az-input { width: auto; flex: 1 1 180px; }
.sas-copy { display: flex; gap: 6px; }
.sas-copy .az-btn { min-width: 0; }
@container sl-portal (max-width: 900px) { .az-props { grid-template-columns: 1fr; } }
</style>
