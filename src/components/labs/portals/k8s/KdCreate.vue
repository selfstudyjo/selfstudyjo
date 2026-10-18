<template>
  <section class="kd-card kd-create">
    <nav class="kd-tabs" role="tablist">
      <button v-for="t in TABS" :key="t.id" type="button" role="tab" class="kd-tab" :class="{ 'is-active': tab === t.id }"
              :aria-selected="tab === t.id" @click="tab = t.id">{{ t.label }}</button>
    </nav>

    <!-- CREATE FROM INPUT -->
    <div v-if="tab === 'input'" class="kd-create__body">
      <p class="kd-help">Enter YAML or JSON content specifying the resources to create to the currently selected namespace.</p>
      <div class="kd-editor">
        <div class="kd-editor__gutter" aria-hidden="true"><span v-for="n in inputLines" :key="n">{{ n }}</span></div>
        <textarea v-model="input" class="kd-editor__text" :style="{ height: (inputLines * 20 + 16) + 'px' }" spellcheck="false" aria-label="YAML or JSON content"
                  placeholder="apiVersion: v1&#10;kind: ConfigMap&#10;metadata:&#10;  name: example" />
      </div>
      <p v-if="inputError" class="kd-error">{{ inputError }}</p>
      <div class="kd-actions">
        <button type="button" class="kd-btn kd-btn--primary" :disabled="!input.trim() || busy" @click="uploadInput">Upload</button>
        <button type="button" class="kd-btn" @click="$emit('cancel')">Cancel</button>
      </div>
    </div>

    <!-- CREATE FROM FILE -->
    <div v-else-if="tab === 'file'" class="kd-create__body">
      <p class="kd-help">Select YAML or JSON file specifying the resources to deploy to the currently selected namespace.</p>
      <div class="kd-field">
        <label class="kd-label" for="kd-file-pick">Choose YAML or JSON file</label>
        <select id="kd-file-pick" v-model="filePath" class="kd-select">
          <option value="">Select a file from the lab workspace…</option>
          <option v-for="f in files" :key="f.path" :value="f.path">{{ f.path }}</option>
        </select>
        <span class="kd-hint">Files come from this lab's workspace (the Files tool). {{ files.length }} manifest{{ files.length === 1 ? '' : 's' }} found.</span>
      </div>
      <div class="kd-field">
        <label class="kd-filebtn">
          <KIcon name="upload" :size="18" /> Or choose a file from your computer
          <input type="file" accept=".yaml,.yml,.json" class="kd-hidden" @change="pickLocal" />
        </label>
        <span v-if="localName" class="kd-hint">{{ localName }} ({{ localBody.length }} characters) — will be sent as STDIN.</span>
      </div>
      <pre v-if="previewBody" class="kd-preview">{{ previewBody }}</pre>
      <p v-if="fileError" class="kd-error">{{ fileError }}</p>
      <div class="kd-actions">
        <button type="button" class="kd-btn kd-btn--primary" :disabled="(!filePath && !localBody) || busy" @click="uploadFile">Upload</button>
        <button type="button" class="kd-btn" @click="$emit('cancel')">Cancel</button>
      </div>
    </div>

    <!-- CREATE FROM FORM -->
    <form v-else class="kd-create__body kd-form" novalidate @submit.prevent="deploy">
      <div class="kd-row">
        <div class="kd-field">
          <label class="kd-label" for="kd-app">App name *</label>
          <input id="kd-app" v-model="form.name" class="kd-input" :class="{ 'is-bad': touched && nameError }" maxlength="24" @input="syncAppLabel" />
          <span v-if="touched && nameError" class="kd-error">{{ nameError }}</span>
          <span class="kd-counter">{{ form.name.length }} / 24</span>
        </div>
        <p class="kd-aside">An 'app' label with this value will be added to the Deployment and Service that get deployed.</p>
      </div>
      <div class="kd-row">
        <div class="kd-field">
          <label class="kd-label" for="kd-image">Container image *</label>
          <input id="kd-image" v-model="form.image" class="kd-input" :class="{ 'is-bad': touched && !form.image.trim() }" />
          <span v-if="touched && !form.image.trim()" class="kd-error">Container image is required</span>
        </div>
        <p class="kd-aside">Enter the URL of a public image on any registry, or a private image hosted on Docker Hub or Google Container Registry.</p>
      </div>
      <div class="kd-row">
        <div class="kd-field">
          <label class="kd-label" for="kd-pods">Number of pods *</label>
          <input id="kd-pods" v-model.number="form.replicas" class="kd-input" type="number" min="1" max="100" />
          <span v-if="touched && podsError" class="kd-error">{{ podsError }}</span>
        </div>
        <p class="kd-aside">A Deployment will be created to maintain the desired number of pods across your cluster.</p>
      </div>
      <div class="kd-row">
        <div class="kd-field">
          <label class="kd-label" for="kd-svc">Service *</label>
          <select id="kd-svc" v-model="form.service" class="kd-select">
            <option value="none">None</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </div>
        <p class="kd-aside">Optionally, an internal or external Service can be defined to map an incoming Port to a target Port seen by the container.</p>
      </div>
      <div v-if="form.service !== 'none'" class="kd-ports">
        <div v-for="(p, i) in form.ports" :key="i" class="kd-port">
          <div class="kd-field"><label class="kd-label">Port *</label><input v-model="p.port" class="kd-input" inputmode="numeric" /></div>
          <div class="kd-field"><label class="kd-label">Target port *</label><input v-model="p.targetPort" class="kd-input" inputmode="numeric" /></div>
          <div class="kd-field"><label class="kd-label">Protocol *</label>
            <select v-model="p.protocol" class="kd-select"><option>TCP</option><option>UDP</option></select></div>
        </div>
        <span v-if="touched && portError" class="kd-error">{{ portError }}</span>
      </div>

      <button type="button" class="kd-btn kd-btn--link" @click="advanced = !advanced">{{ advanced ? 'Hide advanced options' : 'Show advanced options' }}</button>

      <template v-if="advanced">
        <div class="kd-row">
          <div class="kd-field">
            <label class="kd-label" for="kd-desc">Description</label>
            <textarea id="kd-desc" v-model="form.description" class="kd-input kd-textarea" rows="2" />
          </div>
          <p class="kd-aside">The description will be added as an annotation to the Deployment and displayed in the application's details.</p>
        </div>
        <div class="kd-row">
          <div class="kd-field">
            <span class="kd-label">Labels</span>
            <div v-for="(l, i) in form.labels" :key="i" class="kd-kv">
              <input v-model="l.key" class="kd-input" placeholder="Key" :disabled="i === 0" aria-label="Label key" />
              <input v-model="l.value" class="kd-input" placeholder="Value" :disabled="i === 0" aria-label="Label value" />
              <button v-if="i > 0" type="button" class="kd-iconbtn" aria-label="Remove label" @click="form.labels.splice(i, 1)"><KIcon name="remove" :size="20" /></button>
            </div>
            <button type="button" class="kd-btn kd-btn--link" @click="form.labels.push({ key: '', value: '' })">Add label</button>
          </div>
          <p class="kd-aside">The specified labels will be applied to the created Deployment, Service (if any) and Pods. Common labels include release, environment, tier, partition and track.</p>
        </div>
        <div class="kd-row">
          <div class="kd-field">
            <label class="kd-label" for="kd-ns">Namespace *</label>
            <select id="kd-ns" v-model="form.namespace" class="kd-select" @change="onNamespacePick">
              <option v-for="n in namespaces" :key="n" :value="n">{{ n }}</option>
              <option value="__new__">Create a new namespace…</option>
            </select>
          </div>
          <p class="kd-aside">Namespaces let you partition resources into logically named groups.</p>
        </div>
        <div class="kd-row">
          <div class="kd-field kd-field--pair">
            <div><label class="kd-label" for="kd-cpu">CPU requirement (cores)</label><input id="kd-cpu" v-model="form.cpu" class="kd-input" placeholder="e.g. 0.1" /></div>
            <div><label class="kd-label" for="kd-mem">Memory requirement (MiB)</label><input id="kd-mem" v-model="form.memory" class="kd-input" placeholder="e.g. 64" /></div>
          </div>
          <p class="kd-aside">You can specify minimum CPU and memory requirements for the container.</p>
        </div>
        <div class="kd-row">
          <div class="kd-field">
            <span class="kd-label">Environment variables</span>
            <div v-for="(e, i) in form.env" :key="i" class="kd-kv">
              <input v-model="e.name" class="kd-input" placeholder="Name" aria-label="Variable name" />
              <input v-model="e.value" class="kd-input" placeholder="Value" aria-label="Variable value" />
              <button type="button" class="kd-iconbtn" aria-label="Remove variable" @click="form.env.splice(i, 1)"><KIcon name="remove" :size="20" /></button>
            </div>
            <button type="button" class="kd-btn kd-btn--link" @click="form.env.push({ name: '', value: '' })">Add variable</button>
          </div>
          <p class="kd-aside">Environment variables available for use in the container. Values can reference other variables using $(VAR_NAME) syntax.</p>
        </div>
      </template>

      <div class="kd-actions">
        <button type="submit" class="kd-btn kd-btn--primary" :disabled="busy">Deploy</button>
        <button type="button" class="kd-btn" @click="showPreview = true">Preview</button>
        <button type="button" class="kd-btn" @click="$emit('cancel')">Cancel</button>
      </div>
    </form>

    <div v-if="showPreview" class="kd-overlay" @click.self="showPreview = false">
      <div class="kd-dialog kd-dialog--preview" role="dialog" aria-label="Preview">
        <h2 class="kd-dialog__title">Preview</h2>
        <pre class="kd-preview kd-preview--tall">{{ manifest }}</pre>
        <div class="kd-actions kd-actions--end"><button type="button" class="kd-btn kd-btn--primary" @click="showPreview = false">Close</button></div>
      </div>
    </div>

    <div v-if="newNs.open" class="kd-overlay" @click.self="cancelNs">
      <div class="kd-dialog" role="dialog" aria-label="Create a new namespace">
        <h2 class="kd-dialog__title">Create a new namespace</h2>
        <p class="kd-help">The new namespace will be added to the cluster.</p>
        <div class="kd-field">
          <label class="kd-label" for="kd-newns">Namespace name *</label>
          <input id="kd-newns" v-model="newNs.name" class="kd-input" maxlength="63" />
          <span v-if="newNs.error" class="kd-error">{{ newNs.error }}</span>
        </div>
        <div class="kd-actions kd-actions--end">
          <button type="button" class="kd-btn" @click="cancelNs">Cancel</button>
          <button type="button" class="kd-btn kd-btn--primary" @click="createNs">OK</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The "+" page: Create from input, Create from file, Create from form.
 *
 * Input and file go through `kubectl create -f` - the Dashboard's upload is a
 * CREATE (an object that already exists is refused), and the pasted text is
 * sent as STDIN written as a heredoc. Form runs `kubectl create deployment`
 * and then the label / annotate / set env / set resources / expose lines the
 * advanced options call for, in that order, stopping at the first failure.
 */
import { computed, reactive, ref, watch } from 'vue';
import { errorText } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import KIcon from './KIcon.vue';
import { createFromFileCommand, createFromInputCommand, createNamespaceCommand, dash, formCommands,
  formManifest, validateName, type FormSpec, type Row } from './k8s';

const props = defineProps<{ view: Record<string, any>; namespace: string; api: PortalApi; initialTab?: string }>();
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'done', target: { kind: string; namespace: string; name?: string }): void }>();

const TABS = [
  { id: 'input', label: 'Create from input' },
  { id: 'file', label: 'Create from file' },
  { id: 'form', label: 'Create from form' },
];
const tab = ref(props.initialTab || 'input');
const busy = ref(false);
const MAX = 3800;

const input = ref('');
const inputError = ref('');
const inputLines = computed(() => Math.max(12, input.value.split('\n').length));

const files = computed<Row[]>(() => (dash(props.view).files || []) as Row[]);
const filePath = ref('');
const fileError = ref('');
const localName = ref('');
const localBody = ref('');
const previewBody = computed(() => {
  if (localBody.value) return localBody.value.slice(0, 4000);
  return files.value.find(f => f.path === filePath.value)?.body || '';
});
watch(filePath, value => { if (value) { localName.value = ''; localBody.value = ''; } });

const namespaces = computed<string[]>(() => ((dash(props.view).namespaces || []) as Row[]).map(n => n.name));
const targetNs = computed(() => (props.namespace === '_all' ? 'default' : props.namespace));

function pickLocal(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    localName.value = file.name;
    localBody.value = String(reader.result || '');
    filePath.value = '';
  };
  reader.readAsText(file);
}

function firstObject(output: string | undefined): { kind: string; name: string } | null {
  const match = String(output || '').match(/^([a-z.]+)\/([^\s]+)\s+created/m);
  if (!match) return null;
  return { kind: match[1].split('.')[0], name: match[2] };
}

async function sendManifest(body: string, errorRef: typeof inputError) {
  errorRef.value = '';
  if (body.length > MAX) {
    errorRef.value = `The content is ${body.length} characters; the lab accepts up to ${MAX}. Save it as a file in the Files tool and use Create from file.`;
    return;
  }
  busy.value = true;
  try {
    const result = await props.api.exec(createFromInputCommand(targetNs.value, body), { quiet: true });
    if (!result.ok) { errorRef.value = errorText(result); return; }
    props.api.notify('success', 'Deployed', String(result.output || '').trim());
    const first = firstObject(result.output);
    emit('done', { kind: first?.kind || 'workloads', namespace: targetNs.value, name: first?.name });
  } finally {
    busy.value = false;
  }
}

function uploadInput() { void sendManifest(input.value, inputError); }

async function uploadFile() {
  if (localBody.value) { await sendManifest(localBody.value, fileError); return; }
  fileError.value = '';
  busy.value = true;
  try {
    const result = await props.api.exec(createFromFileCommand(targetNs.value, filePath.value), { quiet: true });
    if (!result.ok) { fileError.value = errorText(result); return; }
    props.api.notify('success', 'Deployed', String(result.output || '').trim());
    const first = firstObject(result.output);
    emit('done', { kind: first?.kind || 'workloads', namespace: targetNs.value, name: first?.name });
  } finally {
    busy.value = false;
  }
}

// ---- form --------------------------------------------------------------
const touched = ref(false);
const advanced = ref(false);
const showPreview = ref(false);
const form = reactive<FormSpec>({
  name: '', image: '', replicas: 1, service: 'none',
  ports: [{ port: '', targetPort: '', protocol: 'TCP' }],
  description: '', labels: [{ key: 'app', value: '' }], namespace: targetNs.value,
  cpu: '', memory: '', env: [],
});
function syncAppLabel() { form.labels[0].value = form.name; }

const nameError = computed(() => validateName(form.name, 'Name', 24));
const podsError = computed(() => (!Number.isInteger(form.replicas) || form.replicas < 1 ? 'Number of pods must be a positive integer' : ''));
const portError = computed(() => {
  if (form.service === 'none') return '';
  const p = form.ports[0];
  const valid = (v: string) => /^\d+$/.test(v.trim()) && Number(v) > 0 && Number(v) < 65536;
  if (!valid(p.port) || !valid(p.targetPort || p.port)) return 'Port and target port must be numbers between 1 and 65535';
  return '';
});
const manifest = computed(() => formManifest({ ...form, name: form.name || 'app-name', image: form.image || 'image' }));

async function deploy() {
  touched.value = true;
  if (nameError.value || !form.image.trim() || podsError.value || portError.value) return;
  busy.value = true;
  try {
    const spec: FormSpec = JSON.parse(JSON.stringify({ ...form, name: form.name.trim(), image: form.image.trim() }));
    for (const command of formCommands(spec)) {
      const result = await props.api.exec(command, { failure: 'Deploying the application failed' });
      if (!result.ok) return;
    }
    props.api.notify('success', `Deployment ${spec.name} created`);
    emit('done', { kind: 'deployment', namespace: spec.namespace, name: spec.name });
  } finally {
    busy.value = false;
  }
}

// ---- namespace dialog ----------------------------------------------------
const newNs = reactive({ open: false, name: '', error: '' });
function onNamespacePick() {
  if (form.namespace === '__new__') { newNs.open = true; newNs.name = ''; newNs.error = ''; }
}
function cancelNs() { newNs.open = false; form.namespace = targetNs.value; }
async function createNs() {
  newNs.error = validateName(newNs.name, 'Namespace name');
  if (newNs.error) return;
  const result = await props.api.exec(createNamespaceCommand(newNs.name.trim()), { quiet: true,
    success: `Namespace ${newNs.name.trim()} created` });
  if (!result.ok) { newNs.error = errorText(result); return; }
  form.namespace = newNs.name.trim();
  newNs.open = false;
}
</script>

<style scoped>
.kd-card { background: #fff; box-shadow: var(--kd-shadow); border-radius: 2px; }
.kd-tabs { display: flex; border-bottom: 1px solid rgb(0 0 0 / 0.12); overflow-x: auto; scrollbar-width: none; }
.kd-tab { min-width: 160px; height: 48px; padding: 0 24px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 500;
  color: rgb(0 0 0 / 0.6); text-transform: uppercase; letter-spacing: 0.02em; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; flex: none; }
.kd-tab.is-active { color: var(--kd-primary); border-bottom-color: var(--kd-primary); }
.kd-create__body { padding: 20px; }
.kd-help { margin: 0 0 16px; font-size: 14px; color: rgb(0 0 0 / 0.54); }
.kd-editor { display: flex; border: 1px solid rgb(0 0 0 / 0.12); min-height: 300px; max-height: 50vh; overflow: auto; background: #fff; }
.kd-editor__gutter { display: flex; flex-direction: column; padding: 8px 6px; background: #f0f0f0; color: #6b6b6b; text-align: right;
  font: 13px/20px 'Roboto Mono', Consolas, monospace; user-select: none; min-width: 32px; }
.kd-editor__text { flex: 1; border: 0; outline: 0; resize: none; padding: 8px; font: 13px/20px 'Roboto Mono', Consolas, monospace;
  color: rgb(0 0 0 / 0.87); white-space: pre; overflow-x: auto; overflow-y: hidden; }
.kd-actions { display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap; }
.kd-actions--end { justify-content: flex-end; }
.kd-btn { height: 36px; padding: 0 16px; border: 0; border-radius: 4px; background: transparent; color: var(--kd-primary);
  font: inherit; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.02em; cursor: pointer; }
.kd-btn:hover:not(:disabled) { background: rgb(50 109 230 / 0.08); }
.kd-btn--primary { background: var(--kd-primary); color: #fff;
  box-shadow: 0 3px 1px -2px rgb(0 0 0 / 0.2), 0 2px 2px 0 rgb(0 0 0 / 0.14), 0 1px 5px 0 rgb(0 0 0 / 0.12); }
.kd-btn--primary:hover:not(:disabled) { background: var(--kd-primary-hover); }
.kd-btn:disabled { opacity: 1; color: rgb(0 0 0 / 0.38); background: transparent; cursor: default; box-shadow: none; }
.kd-btn--primary:disabled, .kd-btn--warn:disabled { background: rgb(0 0 0 / 0.12); }
.kd-btn--link { text-transform: none; padding: 0 4px; height: 28px; margin: 8px 0; align-self: flex-start; }
.kd-form { display: flex; flex-direction: column; gap: 4px; max-width: 980px; }
.kd-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: start; }
.kd-aside { margin: 20px 0 0; font-size: 13px; color: rgb(0 0 0 / 0.54); line-height: 1.5; }
.kd-field { display: flex; flex-direction: column; gap: 2px; margin-bottom: 14px; position: relative; }
.kd-field--pair { flex-direction: row; gap: 16px; }
.kd-field--pair > div { flex: 1; display: flex; flex-direction: column; }
.kd-label { font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-input, .kd-select { border: 0; border-bottom: 1px solid rgb(0 0 0 / 0.42); padding: 6px 0; font: inherit; font-size: 15px;
  background: transparent; color: rgb(0 0 0 / 0.87); outline: 0; min-width: 0; }
.kd-input:focus, .kd-select:focus { border-bottom: 2px solid var(--kd-primary); padding-bottom: 5px; }
.kd-input.is-bad { border-bottom: 2px solid #f44336; }
.kd-input:disabled { color: rgb(0 0 0 / 0.38); border-bottom-style: dotted; }
.kd-textarea { resize: vertical; }
.kd-counter { position: absolute; right: 0; bottom: -14px; font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-error { color: #f44336; font-size: 12px; margin-top: 4px; }
.kd-hint { font-size: 12px; color: rgb(0 0 0 / 0.54); margin-top: 4px; }
.kd-ports { display: flex; flex-direction: column; gap: 4px; max-width: 480px; }
.kd-port { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 100px); gap: 16px; }
.kd-kv { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 40px; gap: 12px; align-items: end; margin-bottom: 4px; }
.kd-iconbtn { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: rgb(0 0 0 / 0.54);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.kd-filebtn { display: inline-flex; align-items: center; gap: 8px; color: var(--kd-primary); font-size: 14px; font-weight: 500; cursor: pointer; }
.kd-hidden { display: none; }
.kd-preview { margin: 8px 0 0; padding: 12px; background: #f5f5f5; max-height: 260px; overflow: auto; font: 12px/1.5 'Roboto Mono', Consolas, monospace; white-space: pre; }
.kd-preview--tall { max-height: none; }
.kd-dialog--preview { display: flex; flex-direction: column; overflow: hidden; }
.kd-dialog--preview .kd-preview { flex: 1 1 auto; min-height: 0; }
.kd-dialog--preview .kd-actions { flex: none; }
.kd-overlay { position: absolute; inset: 0; z-index: 50; background: rgb(0 0 0 / 0.32); display: grid; place-items: center; padding: 16px; }
.kd-dialog { background: #fff; border-radius: 4px; padding: 24px; width: min(640px, 100%); max-height: 90%; overflow: auto;
  box-shadow: 0 11px 15px -7px rgb(0 0 0 / 0.2), 0 24px 38px 3px rgb(0 0 0 / 0.14), 0 9px 46px 8px rgb(0 0 0 / 0.12); }
.kd-dialog__title { margin: 0 0 16px; font-size: 20px; font-weight: 500; color: rgb(0 0 0 / 0.87); }
@container sl-portal (max-width: 760px) {
  .kd-row { grid-template-columns: 1fr; gap: 0; }
  .kd-aside { margin: 0 0 12px; }
  .kd-tab { min-width: 0; padding: 0 14px; }
  .kd-port { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 80px); gap: 8px; }
}
@container sl-portal (max-width: 560px) {
  .kd-create__body { padding: 16px 12px; }
  .kd-tab { flex: 1 1 0; height: auto; min-height: 48px; padding: 6px 6px; white-space: normal; line-height: 1.25; font-size: 13px; letter-spacing: 0; }
  .kd-field--pair { flex-direction: column; gap: 0; }
  .kd-kv { gap: 8px; }
  .kd-dialog { padding: 20px 16px; }
}
</style>
