<template>
  <FxPanel title="Workspace settings" width="820px" @close="$emit('close')">
    <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
    <div class="fx-settings">
      <div class="fx-settings__nav" role="tablist">
        <button v-for="t in tabs" :key="t.id" type="button" :class="{ 'is-active': tab === t.id }"
                @click="tab = t.id; error = ''">{{ t.label }}</button>
      </div>
      <div class="fx-settings__body">
        <!-- General -->
        <template v-if="tab === 'general'">
          <h3 class="fx-h3 ws-first">General</h3>
          <div class="fx-field">
            <label for="ws-name">Name<span class="fx-field__req">*</span></label>
            <input id="ws-name" v-model="name" class="fx-input" />
          </div>
          <div class="fx-field">
            <label for="ws-desc">Description</label>
            <textarea id="ws-desc" v-model="description" class="fx-textarea" />
          </div>
          <div class="fx-field">
            <span class="fx-field__label">Domain</span>
            <select v-model="domain" class="fx-select" aria-label="Domain">
              <option value="">No domain</option>
              <option>Service Operations</option><option>Finance</option><option>Platform</option>
              <option v-if="domain && !['Service Operations', 'Finance', 'Platform'].includes(domain)">{{ domain }}</option>
            </select>
          </div>
          <dl class="fx-kv">
            <dt>Workspace ID</dt><dd class="fx-mono">{{ ws?.id }}</dd>
            <dt>Created</dt><dd>{{ ws?.created }}</dd>
          </dl>
          <div class="ws-actions">
            <button type="button" class="fx-btn fx-btn--primary" :disabled="!dirtyGeneral" @click="saveGeneral">Save</button>
          </div>
        </template>

        <!-- License info -->
        <template v-else-if="tab === 'license'">
          <h3 class="fx-h3 ws-first">License info</h3>
          <dl class="fx-kv">
            <dt>Current license</dt><dd>{{ ws?.capacity ? 'Fabric capacity' : 'Pro' }}</dd>
            <dt>License capacity</dt><dd>{{ ws?.capacity || 'None' }}</dd>
            <dt>Capacity SKU</dt><dd>{{ cap?.sku || '—' }}</dd>
            <dt>Region</dt><dd>{{ cap?.region || '—' }}</dd>
          </dl>
          <h3 class="fx-h3">Edit</h3>
          <label class="fx-check"><input v-model="licMode" type="radio" value="fabric" />Fabric capacity</label>
          <label class="fx-check"><input v-model="licMode" type="radio" value="pro" />Pro</label>
          <div v-if="licMode === 'fabric'" class="fx-field">
            <span class="fx-field__label">Capacity</span>
            <select v-model="capChoice" class="fx-select" aria-label="Capacity">
              <option v-for="c in capacities" :key="c.name" :value="c.name">{{ c.name }} ({{ c.sku }}, {{ c.region }})</option>
            </select>
          </div>
          <p v-if="licMode === 'pro'" class="fx-msgbar fx-msgbar--warning"><FxIcon name="warning" />
            Without a Fabric capacity, items like lakehouses and notebooks in this workspace become unavailable.</p>
          <button type="button" class="fx-btn fx-btn--primary" @click="saveLicense">Select license</button>
        </template>

        <!-- Workspace identity -->
        <template v-else-if="tab === 'identity'">
          <h3 class="fx-h3 ws-first">Workspace identity</h3>
          <p class="ws-p">A workspace identity is an automatically managed Microsoft Entra service principal
            that Fabric items in this workspace can use to connect to resources that support Entra authentication.</p>
          <template v-if="ws?.identity">
            <p class="fx-msgbar fx-msgbar--success"><FxIcon name="success" />Workspace identity is enabled.</p>
            <dl class="fx-kv"><dt>Name</dt><dd>{{ wsName }}</dd><dt>State</dt><dd>Active</dd></dl>
          </template>
          <button v-else type="button" class="fx-btn fx-btn--primary" @click="setProp('identity', 'true', 'Workspace identity created')">
            + Workspace identity</button>
        </template>

        <!-- Git integration -->
        <template v-else-if="tab === 'git'">
          <h3 class="fx-h3 ws-first">Git integration</h3>
          <template v-if="ws?.git">
            <dl class="fx-kv">
              <dt>Git provider</dt><dd>{{ ws.git.provider }}</dd>
              <dt>Repository</dt><dd>{{ ws.git.repo }}</dd>
              <dt>Branch</dt><dd>{{ ws.git.branch }}</dd>
              <dt>Git folder</dt><dd>{{ ws.git.folder || '/' }}</dd>
            </dl>
            <div class="ws-actions">
              <button type="button" class="fx-btn" @click="disconnect">Disconnect workspace</button>
            </div>
          </template>
          <template v-else>
            <p class="ws-p">Connect this workspace to a Git repository to version items and collaborate.</p>
            <div class="fx-field">
              <span class="fx-field__label">Git provider</span>
              <select v-model="gitProvider" class="fx-select" aria-label="Git provider">
                <option value="GitHub">GitHub</option><option value="AzureDevOps">Azure DevOps</option>
              </select>
            </div>
            <div class="fx-field">
              <label for="ws-repo">Repository<span class="fx-field__req">*</span></label>
              <input id="ws-repo" v-model="gitRepo" class="fx-input" placeholder="org/repository" list="ws-repos" />
              <datalist id="ws-repos"><option v-for="r in repos" :key="r.name" :value="r.name" /></datalist>
            </div>
            <div class="fx-field">
              <label for="ws-branch">Branch<span class="fx-field__req">*</span></label>
              <input id="ws-branch" v-model="gitBranch" class="fx-input" />
            </div>
            <div class="fx-field">
              <label for="ws-folder">Git folder</label>
              <input id="ws-folder" v-model="gitFolder" class="fx-input" placeholder="/" />
            </div>
            <button type="button" class="fx-btn fx-btn--primary" :disabled="!gitRepo || !gitBranch" @click="connect">Connect and sync</button>
          </template>
        </template>

        <!-- Spark -->
        <template v-else-if="tab === 'spark'">
          <h3 class="fx-h3 ws-first">Data Engineering/Science - Spark settings</h3>
          <div class="fx-field">
            <span class="fx-field__label">Default pool for workspace</span>
            <select v-model="pool" class="fx-select" aria-label="Default pool">
              <option>Starter Pool</option><option>Medium Pool</option><option>Large Pool</option>
            </select>
            <span class="fx-field__help">Starter pools start in seconds; custom pools take a few minutes.</span>
          </div>
          <div class="fx-field">
            <label for="ws-nodes">Maximum nodes</label>
            <input id="ws-nodes" v-model.number="maxNodes" class="fx-input" type="number" min="1" max="200" />
          </div>
          <div class="ws-toggle"><button type="button" class="fx-switch" :class="{ 'is-on': native }" role="switch"
                                         :aria-checked="native" aria-label="Native execution engine" @click="native = !native" />
            <span>Native execution engine</span></div>
          <div class="ws-toggle"><button type="button" class="fx-switch" :class="{ 'is-on': hc }" role="switch"
                                         :aria-checked="hc" aria-label="High concurrency" @click="hc = !hc" />
            <span>High concurrency for notebooks</span></div>
          <div class="ws-actions"><button type="button" class="fx-btn fx-btn--primary" @click="saveSpark">Save</button></div>
        </template>

        <!-- Other -->
        <template v-else-if="tab === 'other'">
          <h3 class="fx-h3 ws-first">Remove this workspace</h3>
          <p class="ws-p">Removing the workspace permanently deletes it and everything in it: lakehouses, tables,
            files, notebooks, pipelines and semantic models.</p>
          <div class="fx-field">
            <label for="ws-confirm">Type <b>{{ wsName }}</b> to confirm</label>
            <input id="ws-confirm" v-model="confirmName" class="fx-input" />
          </div>
          <button type="button" class="fx-btn fx-btn--danger" :disabled="confirmName !== wsName" @click="remove">Remove this workspace</button>
        </template>
      </div>
    </div>
  </FxPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FxPanel from './FxPanel.vue';
import FxIcon from './FxIcon.vue';
import { cli, errorText, rows, useFabric, wsPath } from './fabric';

const props = defineProps<{ ws: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const { portal, run, go } = useFabric();

const tabs = [
  { id: 'general', label: 'General' }, { id: 'license', label: 'License info' },
  { id: 'identity', label: 'Workspace identity' }, { id: 'git', label: 'Git integration' },
  { id: 'spark', label: 'Data Engineering/Science' }, { id: 'other', label: 'Other' },
];
const tab = ref('general');
const error = ref('');
const wsName = ref(props.ws);
const ws = computed(() => rows(portal.value, 'workspaces').find(w => w.name === wsName.value));
const capacities = computed(() => rows(portal.value, 'capacities'));
const cap = computed(() => capacities.value.find(c => c.name === ws.value?.capacity));
const repos = computed(() => rows(portal.value, 'repos'));

const name = ref('');
const description = ref('');
const domain = ref('');
const licMode = ref('fabric');
const capChoice = ref('');
const gitProvider = ref('GitHub');
const gitRepo = ref('');
const gitBranch = ref('main');
const gitFolder = ref('/');
const pool = ref('Starter Pool');
const maxNodes = ref(4);
const native = ref(false);
const hc = ref(false);
const confirmName = ref('');

function load() {
  const w = ws.value;
  if (!w) return;
  name.value = w.name;
  description.value = w.description || '';
  domain.value = w.domain || '';
  licMode.value = w.capacity ? 'fabric' : 'pro';
  capChoice.value = w.capacity || capacities.value[0]?.name || '';
  pool.value = w.spark?.pool || 'Starter Pool';
  maxNodes.value = Number(w.spark?.max_nodes || 4);
  native.value = Boolean(w.spark?.native_engine);
  hc.value = Boolean(w.spark?.high_concurrency);
}
watch(ws, load, { immediate: true });

const dirtyGeneral = computed(() => ws.value && (name.value.trim() !== ws.value.name
  || description.value !== (ws.value.description || '') || domain.value !== (ws.value.domain || '')));

async function exec(command: string, success: string) {
  error.value = '';
  const result = await run(command, success, { quiet: true });
  if (!result.ok) error.value = errorText(result);
  return result.ok;
}

async function setProp(key: string, value: string, success: string) {
  return exec(cli(['fab', 'set', wsPath(wsName.value)], { '-q': key, '-i': value }), success);
}

async function saveGeneral() {
  const w = ws.value;
  if (!w) return;
  if (description.value !== (w.description || '')) {
    // An empty value is written as '' so clearing the box clears the description.
    if (!await exec(cli(['fab', 'set', wsPath(wsName.value), '-q', 'description', '-i', description.value]),
      'Description saved')) return;
  }
  if (domain.value !== (w.domain || '') && domain.value) {
    if (!await setProp('domain', domain.value, 'Domain assigned')) return;
  }
  const newName = name.value.trim();
  if (newName && newName !== w.name) {
    if (!await setProp('displayName', newName, `Workspace renamed to ${newName}`)) return;
    wsName.value = newName;
    go({ page: 'workspace', ws: newName });
  }
}

async function saveLicense() {
  if (licMode.value === 'pro') {
    await exec(cli(['fab', 'unassign'], { '-W': wsPath(wsName.value) }), 'License changed to Pro');
  } else if (capChoice.value) {
    await exec(cli(['fab', 'assign', `.capacities/${capChoice.value}.Capacity`], { '-W': wsPath(wsName.value) }),
      `Workspace assigned to ${capChoice.value}`);
  }
}

async function connect() {
  await exec(cli(['fab', 'git', 'connect', wsPath(wsName.value)], {
    '--provider': gitProvider.value, '--repo': gitRepo.value.trim(), '--branch': gitBranch.value.trim(),
    '--folder': gitFolder.value.trim() && gitFolder.value.trim() !== '/' ? gitFolder.value.trim() : '',
  }), `Connected to ${gitRepo.value}`);
}

async function disconnect() {
  await exec(cli(['fab', 'git', 'disconnect', wsPath(wsName.value)]), 'Workspace disconnected from Git');
}

async function saveSpark() {
  const w = ws.value;
  if (!w) return;
  const spark = w.spark || {};
  if (pool.value !== spark.pool && !await setProp('spark.pool', pool.value, 'Default pool saved')) return;
  if (maxNodes.value !== Number(spark.max_nodes) && !await setProp('spark.maxNodes', String(maxNodes.value), 'Maximum nodes saved')) return;
  if (native.value !== Boolean(spark.native_engine)
      && !await setProp('spark.nativeEngine', String(native.value), 'Native execution engine updated')) return;
  if (hc.value !== Boolean(spark.high_concurrency)) {
    await setProp('spark.highConcurrency', String(hc.value), 'High concurrency updated');
  }
}

async function remove() {
  if (await exec(cli(['fab', 'rm', wsPath(wsName.value), '-f']), `Workspace ${wsName.value} was removed`)) {
    emit('close');
    go({ page: 'workspaces' });
  }
}
</script>

<style scoped>
.ws-first { margin-top: 0; }
.ws-actions { margin-top: 16px; display: flex; gap: 8px; }
.ws-p { margin: 0 0 12px; color: #424242; }
.ws-toggle { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
</style>
