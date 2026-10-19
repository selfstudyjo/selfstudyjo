<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'connect' })">Connect</button><span class="cc-sep">/</span><span>Add connector</span></nav>
    <div class="cc-title-row"><h1 class="cc-title">{{ step === 'browse' ? 'Browse' : step === 'config' ? 'Add connector' : 'Review and launch' }}</h1></div>
    <ol class="ac-steps">
      <li :class="{ 'is-on': step === 'browse' }">1. Choose a connector</li>
      <li :class="{ 'is-on': step === 'config' }">2. Configure</li>
      <li :class="{ 'is-on': step === 'review' }">3. Review and launch</li>
    </ol>

    <!-- ===== 1. Browse plugins, or upload a config file ===== -->
    <template v-if="step === 'browse'">
      <div class="cc-toolbar">
        <label class="cc-search"><CcIcon name="search" />
          <input v-model="query" class="cc-input" type="search" placeholder="Search connector plugins" aria-label="Search connector plugins" /></label>
        <span class="cc-spacer"></span>
        <label class="cc-btn ac-upload"><CcIcon name="upload" />Upload connector config file
          <input type="file" accept=".json,application/json" @change="onFile" /></label>
      </div>
      <div v-if="uploadError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ uploadError }}</span></div>
      <div class="ac-grid">
        <button v-for="p in plugins" :key="p.cls" type="button" class="ac-tile" @click="choose(p.cls)">
          <span class="ac-tile__type" :class="'is-' + p.type">{{ p.type === 'sink' ? 'Sink' : 'Source' }}</span>
          <strong class="ac-tile__name">{{ p.name }}</strong>
          <span class="cc-mono cc-small ac-tile__cls">{{ p.cls }}</span>
          <span class="cc-muted cc-small">{{ p.vendor }} · {{ p.version }}</span>
        </button>
      </div>
    </template>

    <!-- ===== 2. Configure ===== -->
    <div v-else-if="step === 'config'" class="cc-card">
      <div class="cc-card__head"><strong>{{ spec?.name || cls }}</strong><span class="cc-muted cc-small cc-mono">{{ cls }}</span></div>
      <div class="cc-card__body ac-form">
        <section class="ac-section">
          <h2 class="cc-h3">Common</h2>
          <div class="cc-form-grid">
            <label class="cc-field"><span class="cc-label">Name <em>*</em></span>
              <input v-model.trim="name" class="cc-input" type="text" spellcheck="false" placeholder="e.g. orders-s3-sink" /></label>
            <label class="cc-field"><span class="cc-label">Tasks max</span>
              <input v-model.trim="tasksMax" class="cc-input" type="text" inputmode="numeric" /></label>
            <label class="cc-field"><span class="cc-label">Key converter class</span>
              <input v-model.trim="extra['key.converter']" class="cc-input" type="text" placeholder="org.apache.kafka.connect.storage.StringConverter" /></label>
            <label class="cc-field"><span class="cc-label">Value converter class</span>
              <input v-model.trim="extra['value.converter']" class="cc-input" type="text" placeholder="org.apache.kafka.connect.json.JsonConverter" /></label>
          </div>
        </section>
        <section class="ac-section">
          <h2 class="cc-h3">{{ spec?.type === 'sink' ? 'Sink' : 'Source' }} settings</h2>
          <div class="cc-form-grid">
            <label v-for="f in fields" :key="f.key" class="cc-field">
              <span class="cc-label">{{ f.label }} <em v-if="f.required">*</em></span>
              <select v-if="f.options" v-model="values[f.key]" class="cc-select">
                <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
              </select>
              <select v-else-if="f.key === 'topics'" v-model="values[f.key]" class="cc-select">
                <option value="">Select a topic</option>
                <option v-for="t in cc.topics.value" :key="t.name" :value="t.name">{{ t.name }}</option>
              </select>
              <input v-else v-model.trim="values[f.key]" class="cc-input" :type="f.secret ? 'password' : 'text'" spellcheck="false" autocomplete="off" />
              <span class="cc-hint cc-mono">{{ f.key }}{{ f.help ? ' - ' + f.help : '' }}</span>
            </label>
          </div>
        </section>
        <section class="ac-section">
          <h2 class="cc-h3">Additional properties</h2>
          <label class="cc-field"><span class="cc-hint">One <span class="cc-mono">key=value</span> per line.</span>
            <textarea v-model="additional" class="cc-textarea" rows="4" spellcheck="false" placeholder="errors.log.enable=true"></textarea></label>
        </section>
        <div v-if="configError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ configError }}</span></div>
        <div class="cc-toolbar">
          <button type="button" class="cc-btn cc-btn--primary" @click="toReview">Next</button>
          <button type="button" class="cc-btn" @click="step = 'browse'">Back</button>
          <button type="button" class="cc-btn cc-btn--ghost" @click="cc.go({ page: 'connect' })">Cancel</button>
        </div>
      </div>
    </div>

    <!-- ===== 3. Review the JSON and launch ===== -->
    <div v-else class="cc-card">
      <div class="cc-card__head"><strong>Connector configuration</strong></div>
      <div class="cc-card__body ac-form">
        <CcJson :text="reviewText" />
        <div v-if="launchError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ launchError }}</span></div>
        <div class="cc-toolbar">
          <button type="button" class="cc-btn cc-btn--primary" :disabled="cc.busy.value" @click="launch">Launch</button>
          <button type="button" class="cc-btn" @click="step = 'config'">Back</button>
          <button type="button" class="cc-btn cc-btn--ghost" @click="cc.go({ page: 'connect' })">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import CcJson from './CcJson.vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME, PLUGINS, connectCurl, pluginFor, restError, type PluginSpec } from './confluent';

const cc = useCc();
const step = ref<'browse' | 'config' | 'review'>('browse');
const query = ref('');
const cls = ref('');
const name = ref('');
const tasksMax = ref('1');
const values = reactive<Record<string, string>>({});
const extra = reactive<Record<string, string>>({ 'key.converter': '', 'value.converter': '' });
const additional = ref('');
const uploadError = ref('');
const configError = ref('');
const launchError = ref('');

const plugins = computed<PluginSpec[]>(() => {
  const installed = cc.plugins.value;
  const known = PLUGINS.filter(p => !installed.length || installed.includes(p.cls));
  const needle = query.value.trim().toLowerCase();
  return known.filter(p => !needle || p.cls.toLowerCase().includes(needle) || p.type.includes(needle));
});
const spec = computed(() => pluginFor(cls.value));
const fields = computed(() => spec.value?.fields || []);

function reset(nextCls: string) {
  cls.value = nextCls;
  for (const key of Object.keys(values)) delete values[key];
  for (const f of pluginFor(nextCls)?.fields || []) values[f.key] = f.value;
  extra['key.converter'] = '';
  extra['value.converter'] = '';
  tasksMax.value = '1';
  additional.value = '';
  configError.value = '';
}
function choose(nextCls: string) {
  reset(nextCls);
  name.value = '';
  step.value = 'config';
}

function onFile(event: Event) {
  uploadError.value = '';
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let body: any;
    try { body = JSON.parse(String(reader.result || '')); } catch (problem: any) {
      uploadError.value = `${file.name} is not valid JSON: ${String(problem?.message || problem)}`;
      return;
    }
    const config = body && typeof body.config === 'object' ? body.config : body;
    const klass = String(config?.['connector.class'] || '');
    if (!klass) { uploadError.value = `${file.name} has no "connector.class".`; return; }
    reset(pluginFor(klass)?.cls || klass);
    name.value = String(body?.name || config?.name || '');
    const lines: string[] = [];
    for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
      if (k === 'connector.class' || k === 'name') continue;
      const value = String(v);
      if (k === 'tasks.max') tasksMax.value = value;
      else if (k in extra) extra[k] = value;
      else if (fields.value.some(f => f.key === k)) values[k] = value;
      else lines.push(`${k}=${value}`);
    }
    additional.value = lines.join('\n');
    step.value = 'config';
  };
  reader.readAsText(file);
}

function buildConfig(): Record<string, string> | null {
  configError.value = '';
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(name.value)) { configError.value = "Name is required: letters, digits, '.', '_' and '-'."; return null; }
  const missing = fields.value.filter(f => f.required && !String(values[f.key] || '').trim()).map(f => f.label);
  if (missing.length) { configError.value = `Missing required configuration: ${missing.join(', ')}.`; return null; }
  const config: Record<string, string> = { 'connector.class': cls.value };
  if (tasksMax.value) config['tasks.max'] = tasksMax.value;
  for (const [k, v] of Object.entries(extra)) if (v) config[k] = v;
  for (const f of fields.value) if (String(values[f.key] || '') !== '') config[f.key] = String(values[f.key]);
  for (const raw of additional.value.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.indexOf('=');
    if (at <= 0) { configError.value = `Additional property "${line}" is not key=value.`; return null; }
    config[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return config;
}

const reviewBody = ref<{ name: string; config: Record<string, string> } | null>(null);
const reviewText = computed(() => JSON.stringify(reviewBody.value || {}, null, 2));
function toReview() {
  const config = buildConfig();
  if (!config) return;
  reviewBody.value = { name: name.value, config };
  launchError.value = '';
  step.value = 'review';
}

async function launch() {
  if (!reviewBody.value) return;
  launchError.value = '';
  const result = await cc.run(connectCurl('POST', '/connectors', reviewBody.value), { quiet: true });
  const rest = result.ok ? restError(result.output) : errorText(result);
  if (rest) { launchError.value = rest; cc.notify('error', 'Connector not created', rest); return; }
  const created = reviewBody.value.name;
  cc.notify('success', `Connector ${created} launched`);
  cc.go({ page: 'connector', name: created, tab: 'overview' });
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.ac-steps { display: flex; gap: 24px; margin: 0; padding: 0; list-style: none; font-size: 13px; color: var(--cc-text-2); flex-wrap: wrap; }
.ac-steps li { padding-bottom: 6px; border-bottom: 3px solid transparent; }
.ac-steps li.is-on { color: var(--cc-primary); font-weight: 600; border-bottom-color: var(--cc-primary); }
.ac-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 12px; }
.ac-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 16px; background: #fff; border: 1px solid var(--cc-border); border-radius: 4px; cursor: pointer; text-align: left; font: inherit; color: var(--cc-text); min-width: 0; }
.ac-tile:hover { border-color: var(--cc-primary); box-shadow: 0 2px 8px rgba(11, 106, 166, 0.12); }
.ac-tile__type { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; }
.ac-tile__type.is-source { background: var(--cc-success-bg); color: var(--cc-success-text); }
.ac-tile__type.is-sink { background: var(--cc-blue-bg); color: var(--cc-primary-hover); }
.ac-tile__name { font-size: 15px; }
.ac-tile__cls { overflow-wrap: anywhere; color: var(--cc-text-2); }
.ac-upload { position: relative; overflow: hidden; }
.ac-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.ac-form { display: flex; flex-direction: column; gap: 18px; }
.ac-section { display: flex; flex-direction: column; gap: 10px; }
</style>
