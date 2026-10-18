<template>
  <div v-if="dialog" class="kd-overlay" @click.self="close" @keydown.esc="close">
    <!-- DELETE -->
    <div v-if="dialog.type === 'delete'" class="kd-dialog" role="dialog" aria-label="Delete a resource">
      <h2 class="kd-dialog__title">Delete a resource</h2>
      <p class="kd-text">Are you sure you want to delete {{ kindWord }} <strong>{{ dialog.row.name }}</strong><template v-if="dialog.def.namespaced"> in namespace <strong>{{ dialog.row.namespace }}</strong></template>?</p>
      <p v-if="dialog.def.kind === 'Namespace'" class="kd-text kd-warn">Deleting a namespace deletes every object in it.</p>
      <div class="kd-equiv"><span>This action is equivalent to:</span><code>{{ deleteLine }}</code></div>
      <p v-if="error" class="kd-error">{{ error }}</p>
      <div class="kd-actions">
        <button type="button" class="kd-btn kd-btn--warn" :disabled="working" @click="run(deleteLine, `${dialog.def.kind} ${dialog.row.name} deleted`, 'deleted')">Delete</button>
        <button type="button" class="kd-btn" @click="close">Cancel</button>
      </div>
    </div>

    <!-- SCALE -->
    <div v-else-if="dialog.type === 'scale'" class="kd-dialog" role="dialog" aria-label="Scale a resource">
      <h2 class="kd-dialog__title">Scale a resource</h2>
      <p class="kd-text">{{ dialog.def.kind }} <strong>{{ dialog.row.name }}</strong> will be updated to reflect the desired replicas count.</p>
      <div class="kd-pair">
        <div class="kd-field"><label class="kd-label" for="kd-desired">Desired replicas</label>
          <input id="kd-desired" v-model.number="replicas" type="number" min="0" class="kd-input" /></div>
        <div class="kd-field"><label class="kd-label" for="kd-actual">Actual replicas</label>
          <input id="kd-actual" :value="dialog.row.desired ?? 0" disabled class="kd-input" /></div>
      </div>
      <div class="kd-equiv"><span>This action is equivalent to:</span><code>{{ scaleLine }}</code></div>
      <p v-if="replicasError" class="kd-error">{{ replicasError }}</p>
      <p v-if="error" class="kd-error">{{ error }}</p>
      <div class="kd-actions">
        <button type="button" class="kd-btn kd-btn--primary" :disabled="working || !!replicasError" @click="run(scaleLine, `${dialog.def.kind} ${dialog.row.name} scaled to ${replicas}`)">Scale</button>
        <button type="button" class="kd-btn" @click="close">Cancel</button>
      </div>
    </div>

    <!-- RESTART -->
    <div v-else-if="dialog.type === 'restart'" class="kd-dialog" role="dialog" aria-label="Restart a resource">
      <h2 class="kd-dialog__title">Restart a resource</h2>
      <p class="kd-text">Are you sure you want to restart deployment <strong>{{ dialog.row.name }}</strong> in namespace <strong>{{ dialog.row.namespace }}</strong>?</p>
      <div class="kd-equiv"><span>This action is equivalent to:</span><code>{{ restartLine }}</code></div>
      <p v-if="error" class="kd-error">{{ error }}</p>
      <div class="kd-actions">
        <button type="button" class="kd-btn kd-btn--primary" :disabled="working" @click="run(restartLine, `Deployment ${dialog.row.name} restarted`)">Restart</button>
        <button type="button" class="kd-btn" @click="close">Cancel</button>
      </div>
    </div>

    <!-- ROLLBACK -->
    <div v-else-if="dialog.type === 'rollback'" class="kd-dialog" role="dialog" aria-label="Rollback a deployment">
      <h2 class="kd-dialog__title">Rollback a resource</h2>
      <p class="kd-text">Roll deployment <strong>{{ dialog.row.name }}</strong> back to revision <strong>{{ dialog.revision }}</strong>? The pod template of that revision becomes the current one and its ReplicaSet is scaled up.</p>
      <div class="kd-equiv"><span>This action is equivalent to:</span><code>{{ undoLine }}</code></div>
      <p v-if="error" class="kd-error">{{ error }}</p>
      <div class="kd-actions">
        <button type="button" class="kd-btn kd-btn--primary" :disabled="working" @click="run(undoLine, `Deployment ${dialog.row.name} rolled back to revision ${dialog.revision}`)">Rollback</button>
        <button type="button" class="kd-btn" @click="close">Cancel</button>
      </div>
    </div>

    <!-- EDIT -->
    <div v-else-if="dialog.type === 'edit'" class="kd-dialog kd-dialog--wide" role="dialog" aria-label="Edit resource">
      <h2 class="kd-dialog__title">Edit resource</h2>
      <nav class="kd-tabs" role="tablist">
        <button type="button" class="kd-tab" :class="{ 'is-active': format === 'yaml' }" @click="switchFormat('yaml')">YAML</button>
        <button type="button" class="kd-tab" :class="{ 'is-active': format === 'json' }" @click="switchFormat('json')">JSON</button>
      </nav>
      <div class="kd-editor">
        <div class="kd-editor__gutter" aria-hidden="true"><span v-for="n in lineCount" :key="n">{{ n }}</span></div>
        <textarea v-model="body" class="kd-editor__text" :style="{ height: (lineCount * 20 + 16) + 'px' }" spellcheck="false" :disabled="loading" aria-label="Resource definition" />
      </div>
      <p v-if="error" class="kd-error">{{ error }}</p>
      <div class="kd-actions">
        <button type="button" class="kd-btn kd-btn--primary" :disabled="working || loading || !body.trim()" @click="update">Update</button>
        <button type="button" class="kd-btn" @click="close">Cancel</button>
        <span class="kd-spacer" />
        <button type="button" class="kd-btn" @click="copy"><KIcon name="copy" :size="18" /> Copy</button>
      </div>
    </div>

    <!-- QUICK CREATE: namespace / config map / secret / service / cron job -->
    <form v-else-if="dialog.type === 'create'" class="kd-dialog" role="dialog" :aria-label="createTitle" novalidate @submit.prevent="createSubmit">
      <h2 class="kd-dialog__title">{{ createTitle }}</h2>
      <div class="kd-field">
        <label class="kd-label" for="kd-cname">Name *</label>
        <input id="kd-cname" v-model="createName" class="kd-input" maxlength="63" />
      </div>
      <div v-if="dialog.def.namespaced" class="kd-field">
        <label class="kd-label" for="kd-cns">Namespace *</label>
        <select id="kd-cns" v-model="createNs" class="kd-input">
          <option v-for="n in namespaceNames" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
      <template v-if="dialog.def.kind === 'ConfigMap' || dialog.def.kind === 'Secret'">
        <span class="kd-label">Data</span>
        <div v-for="(pair, i) in pairs" :key="i" class="kd-kv">
          <input v-model="pair.key" class="kd-input" placeholder="Key" aria-label="Key" />
          <input v-model="pair.value" class="kd-input" placeholder="Value" aria-label="Value"
                 :type="dialog.def.kind === 'Secret' ? 'password' : 'text'" />
          <button type="button" class="kd-iconbtn" aria-label="Remove" @click="pairs.splice(i, 1)"><KIcon name="remove" :size="20" /></button>
        </div>
        <button type="button" class="kd-btn kd-btn--link" @click="pairs.push({ key: '', value: '' })">Add data</button>
      </template>
      <template v-if="dialog.def.kind === 'Service'">
        <div class="kd-field"><label class="kd-label" for="kd-stype">Type *</label>
          <select id="kd-stype" v-model="svcType" class="kd-input">
            <option value="clusterip">ClusterIP</option><option value="nodeport">NodePort</option><option value="loadbalancer">LoadBalancer</option>
          </select></div>
        <div class="kd-pair">
          <div class="kd-field"><label class="kd-label" for="kd-sport">Port *</label><input id="kd-sport" v-model="svcPort" class="kd-input" inputmode="numeric" /></div>
          <div class="kd-field"><label class="kd-label" for="kd-starget">Target port</label><input id="kd-starget" v-model="svcTarget" class="kd-input" inputmode="numeric" /></div>
        </div>
        <p class="kd-text kd-small">The selector is <code>app={{ createName || 'NAME' }}</code>, as <code>kubectl create service</code> sets it.</p>
      </template>
      <template v-if="dialog.def.kind === 'CronJob'">
        <div class="kd-field"><label class="kd-label" for="kd-cimg">Container image *</label><input id="kd-cimg" v-model="cronImage" class="kd-input" /></div>
        <div class="kd-field"><label class="kd-label" for="kd-csched">Schedule *</label><input id="kd-csched" v-model="cronSchedule" class="kd-input" placeholder="*/5 * * * *" /></div>
      </template>
      <div class="kd-equiv"><span>This action is equivalent to:</span><code>{{ createLine }}</code></div>
      <p v-if="error" class="kd-error">{{ error }}</p>
      <div class="kd-actions">
        <button type="submit" class="kd-btn kd-btn--primary" :disabled="working">Create</button>
        <button type="button" class="kd-btn" @click="close">Cancel</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
/** Every modal the Dashboard opens from a row's ⋮ menu or an action bar icon. */
import { computed, ref, watch } from 'vue';
import { errorText } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import KIcon from './KIcon.vue';
import { createConfigMapCommand, createCronJobCommand, createNamespaceCommand, createSecretCommand,
  createServiceCommand, dash, deleteCommand, getYamlCommand, replaceCommand, restartCommand, scaleCommand,
  undoCommand, validateName, type DialogState, type Row } from './k8s';

const props = defineProps<{ dialog: DialogState | null; view: Record<string, any>; api: PortalApi }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'deleted', d: DialogState): void }>();

const working = ref(false);
const error = ref('');
const replicas = ref(0);
const format = ref<'yaml' | 'json'>('yaml');
const body = ref('');
const loading = ref(false);
const createName = ref('');
const createNs = ref('default');
const pairs = ref<{ key: string; value: string }[]>([{ key: '', value: '' }]);
const svcType = ref('clusterip');
const svcPort = ref('80');
const svcTarget = ref('');
const cronImage = ref('busybox');
const cronSchedule = ref('*/5 * * * *');

const namespaceNames = computed<string[]>(() => ((dash(props.view).namespaces || []) as Row[]).map(n => n.name));
const kindWord = computed(() => props.dialog?.def.singular || '');
const ns = computed(() => props.dialog?.row.namespace || 'default');

watch(() => props.dialog, async d => {
  error.value = '';
  working.value = false;
  if (!d) return;
  if (d.type === 'scale') replicas.value = Number(d.row.desired ?? 0);
  if (d.type === 'edit') { format.value = 'yaml'; await load(); }
  if (d.type === 'create') {
    createName.value = '';
    createNs.value = d.namespace && d.namespace !== '_all' ? d.namespace : 'default';
    pairs.value = [{ key: '', value: '' }];
    svcType.value = 'clusterip'; svcPort.value = '80'; svcTarget.value = '';
  }
}, { immediate: true });

const deleteLine = computed(() => props.dialog ? deleteCommand(props.dialog.def, ns.value, props.dialog.row.name) : '');
const scaleLine = computed(() => props.dialog ? scaleCommand(props.dialog.def, ns.value, props.dialog.row.name, replicas.value) : '');
const restartLine = computed(() => props.dialog ? restartCommand(ns.value, props.dialog.row.name) : '');
const undoLine = computed(() => props.dialog ? undoCommand(ns.value, props.dialog.row.name, props.dialog.revision) : '');
const replicasError = computed(() => (Number.isInteger(replicas.value) && replicas.value >= 0 ? '' : 'Desired replicas must be a whole number, 0 or more'));
const lineCount = computed(() => Math.max(16, body.value.split('\n').length));

const createTitle = computed(() => {
  const k = props.dialog?.def.kind;
  return { Namespace: 'Create a new namespace', ConfigMap: 'Create a config map', Secret: 'Create a secret',
    Service: 'Create a service', CronJob: 'Create a cron job' }[k || ''] || 'Create';
});
const createLine = computed(() => {
  const d = props.dialog;
  if (!d || d.type !== 'create') return '';
  const name = createName.value.trim() || 'NAME';
  switch (d.def.kind) {
    case 'Namespace': return createNamespaceCommand(name);
    case 'ConfigMap': return createConfigMapCommand(createNs.value, name, pairs.value);
    case 'Secret': return createSecretCommand(createNs.value, name, pairs.value);
    case 'Service': return createServiceCommand(createNs.value, svcType.value, name, svcPort.value.trim(), svcTarget.value.trim());
    case 'CronJob': return createCronJobCommand(createNs.value, name, cronImage.value.trim(), cronSchedule.value.trim());
    default: return '';
  }
});

function close() { emit('close'); }

async function run(command: string, success: string, after?: 'deleted') {
  const d = props.dialog;
  if (!d || working.value) return;
  working.value = true;
  error.value = '';
  try {
    const result = await props.api.exec(command, { quiet: true, success });
    if (!result.ok) { error.value = errorText(result); return; }
    if (after === 'deleted') emit('deleted', d);
    emit('close');
  } finally {
    working.value = false;
  }
}

async function load() {
  if (!props.dialog) return;
  loading.value = true;
  body.value = '';
  const result = await props.api.exec(getYamlCommand(props.dialog.def, ns.value, props.dialog.row.name, format.value),
    { unlogged: true, quiet: true });
  loading.value = false;
  if (!result.ok) { error.value = errorText(result); return; }
  body.value = String(result.output || '');
}

async function switchFormat(next: 'yaml' | 'json') {
  if (format.value === next) return;
  format.value = next;
  await load();
}

async function update() {
  if (!props.dialog) return;
  if (body.value.length > 3800) { error.value = 'The resource is too large to send from this editor.'; return; }
  await run(replaceCommand(props.dialog.def, ns.value, body.value), `${props.dialog.def.kind} ${props.dialog.row.name} updated`);
}

async function copy() {
  try { await navigator.clipboard.writeText(body.value); props.api.notify('info', 'Copied to clipboard'); } catch { /* ignore */ }
}

async function createSubmit() {
  const d = props.dialog;
  if (!d) return;
  error.value = validateName(createName.value, 'Name');
  if (!error.value && d.def.kind === 'Service' && !/^\d+$/.test(svcPort.value.trim())) error.value = 'Port must be a number';
  if (!error.value && d.def.kind === 'CronJob' && (!cronImage.value.trim() || cronSchedule.value.trim().split(/\s+/).length !== 5)) {
    error.value = 'Container image and a five-field schedule are required';
  }
  if (error.value) return;
  await run(createLine.value, `${d.def.kind} ${createName.value.trim()} created`);
}
</script>

<style scoped>
.kd-overlay { position: absolute; inset: 0; z-index: 60; background: rgb(0 0 0 / 0.32); display: grid; place-items: center; padding: 16px; }
.kd-dialog { background: #fff; border-radius: 4px; padding: 24px; width: min(560px, 100%); max-height: 92%; overflow: auto;
  box-shadow: 0 11px 15px -7px rgb(0 0 0 / 0.2), 0 24px 38px 3px rgb(0 0 0 / 0.14), 0 9px 46px 8px rgb(0 0 0 / 0.12); }
.kd-dialog--wide { width: min(900px, 100%); }
.kd-dialog__title { margin: 0 0 16px; font-size: 20px; font-weight: 500; color: rgb(0 0 0 / 0.87); }
.kd-text { font-size: 14px; color: rgb(0 0 0 / 0.87); margin: 0 0 12px; line-height: 1.5; word-break: break-word; }
.kd-small { font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-warn { color: #e65100; }
.kd-equiv { display: flex; flex-direction: column; gap: 4px; background: #f5f5f5; padding: 10px 12px; border-radius: 2px; margin: 8px 0 4px; font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-equiv code { font: 12px/1.5 'Roboto Mono', Consolas, monospace; color: rgb(0 0 0 / 0.87); word-break: break-all; white-space: pre-wrap; }
.kd-actions { display: flex; gap: 8px; margin-top: 20px; align-items: center; flex-wrap: wrap; }
.kd-spacer { flex: 1; }
.kd-btn { height: 36px; padding: 0 16px; border: 0; border-radius: 4px; background: transparent; color: var(--kd-primary);
  font: inherit; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.02em; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px; }
.kd-btn:hover:not(:disabled) { background: rgb(50 109 230 / 0.08); }
.kd-btn--primary { background: var(--kd-primary); color: #fff; box-shadow: 0 3px 1px -2px rgb(0 0 0 / 0.2), 0 2px 2px 0 rgb(0 0 0 / 0.14), 0 1px 5px 0 rgb(0 0 0 / 0.12); }
.kd-btn--primary:hover:not(:disabled) { background: var(--kd-primary-hover); }
.kd-btn--warn { background: #f44336; color: #fff; box-shadow: 0 3px 1px -2px rgb(0 0 0 / 0.2), 0 2px 2px 0 rgb(0 0 0 / 0.14), 0 1px 5px 0 rgb(0 0 0 / 0.12); }
.kd-btn--warn:hover:not(:disabled) { background: #d32f2f; }
.kd-btn:disabled { opacity: 0.38; cursor: default; }
.kd-btn--link { text-transform: none; padding: 0 4px; height: 28px; }
.kd-error { color: #f44336; font-size: 13px; margin: 8px 0 0; word-break: break-word; }
.kd-field { display: flex; flex-direction: column; gap: 2px; margin-bottom: 14px; flex: 1; }
.kd-pair { display: flex; gap: 16px; }
.kd-label { font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-input { border: 0; border-bottom: 1px solid rgb(0 0 0 / 0.42); padding: 6px 0; font: inherit; font-size: 15px; background: transparent;
  color: rgb(0 0 0 / 0.87); outline: 0; min-width: 0; }
.kd-input:focus { border-bottom: 2px solid var(--kd-primary); padding-bottom: 5px; }
.kd-input:disabled { color: rgb(0 0 0 / 0.38); border-bottom-style: dotted; }
.kd-kv { display: grid; grid-template-columns: 1fr 1fr 40px; gap: 12px; align-items: end; margin-bottom: 4px; }
.kd-iconbtn { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: rgb(0 0 0 / 0.54);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.kd-tabs { display: flex; border-bottom: 1px solid rgb(0 0 0 / 0.12); margin-bottom: 8px; }
.kd-tab { min-width: 90px; height: 40px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 500; color: rgb(0 0 0 / 0.6);
  cursor: pointer; border-bottom: 2px solid transparent; }
.kd-tab.is-active { color: var(--kd-primary); border-bottom-color: var(--kd-primary); }
.kd-editor { display: flex; border: 1px solid rgb(0 0 0 / 0.12); height: min(55vh, 460px); overflow: auto; }
.kd-editor__gutter { display: flex; flex-direction: column; padding: 8px 6px; background: #f0f0f0; color: #999; text-align: right;
  font: 13px/20px 'Roboto Mono', Consolas, monospace; user-select: none; min-width: 32px; }
.kd-editor__text { flex: 1; border: 0; outline: 0; resize: none; padding: 8px; font: 13px/20px 'Roboto Mono', Consolas, monospace;
  color: rgb(0 0 0 / 0.87); white-space: pre; overflow-x: auto; overflow-y: hidden; }
</style>
