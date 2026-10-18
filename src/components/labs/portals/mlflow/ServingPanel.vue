<template>
  <section class="mf-section mf-serve">
    <div class="mf-section-head">
      <h2 class="mf-h3">Serving endpoints</h2>
      <span class="mf-spacer"></span>
      <button type="button" class="mf-btn mf-btn--sm" :disabled="!model.versions.length" @click="startDeploy"><MfIcon name="server" />Deploy</button>
    </div>
    <p class="mf-muted mf-serve__p">A registered version is deployed to a serving runtime through an MLflow deployment target. In this lab the
      targets are TorchServe (<code class="mf-mono">torchserve --start</code>) and vLLM (<code class="mf-mono">vllm serve</code>), sized against the lab's GPU.</p>
    <div v-if="!endpoints.length" class="mf-muted mf-serve__none">No endpoint is serving {{ model.name }}.</div>
    <div v-else class="mf-table-wrap">
      <table class="mf-table">
        <thead><tr><th>Endpoint</th><th>State</th><th>Runtime</th><th>Base</th><th>Precision</th><th class="mf-num">GPU GiB</th>
          <th class="mf-num">p50 ms</th><th class="mf-num">p95 ms</th><th class="mf-num">req/s</th><th></th></tr></thead>
        <tbody>
          <tr v-for="e in endpoints" :key="e.name + e.runtime">
            <td><b>{{ e.name }}</b></td>
            <td><span class="mf-status mf-status--FINISHED"><MfIcon name="check-circle" /><span>Ready</span></span></td>
            <td>{{ e.runtime }}</td><td>{{ e.base }}</td><td>{{ e.dtype }}</td>
            <td class="mf-num">{{ e.total_gb }}</td><td class="mf-num">{{ e.p50_ms }}</td><td class="mf-num">{{ e.p95_ms }}</td>
            <td class="mf-num">{{ e.requests_per_s }}</td>
            <td><button type="button" class="mf-btn mf-btn--sm mf-btn--danger-ghost" @click="stop(e)">Stop</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <MfModal v-if="deploying" title="Deploy model version" ok-text="Deploy" :busy="saving" :width="560" @close="deploying = false" @ok="deploy">
      <label class="mf-field"><span class="mf-label">Version</span>
        <select v-model.number="version" class="mf-select" aria-label="Version">
          <option v-for="v in model.versions" :key="v.version" :value="v.version">Version {{ v.version }} ({{ v.stage }}) - {{ v.base }}</option>
        </select></label>
      <label class="mf-field"><span class="mf-label">Deployment target</span>
        <select v-model="runtime" class="mf-select" aria-label="Deployment target">
          <option value="torchserve">TorchServe</option>
          <option value="vllm">vLLM (language models)</option>
        </select></label>
      <div class="mf-serve__grid">
        <label class="mf-field"><span class="mf-label">Precision</span>
          <select v-model="dtype" class="mf-select" aria-label="Precision">
            <option v-for="d in dtypes" :key="d" :value="d">{{ d }}</option></select></label>
        <label v-if="runtime === 'torchserve'" class="mf-field"><span class="mf-label">Workers</span>
          <input v-model.number="workers" class="mf-input" type="number" min="1" max="8" aria-label="Workers" /></label>
        <label v-else class="mf-field"><span class="mf-label">Max model length</span>
          <input v-model.number="maxLen" class="mf-input" type="number" min="128" step="128" aria-label="Max model length" /></label>
        <label v-if="runtime === 'vllm'" class="mf-field"><span class="mf-label">Max concurrent sequences</span>
          <input v-model.number="seqs" class="mf-input" type="number" min="1" aria-label="Max concurrent sequences" /></label>
      </div>
      <p class="mf-hint mf-mono">{{ preview }}</p>
      <div v-if="error" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span class="mf-serve__err">{{ error }}</span></div>
    </MfModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import { useMf } from './mfContext';
import type { MfModel, MfServing } from './mlflow';

const props = defineProps<{ model: MfModel }>();
const mf = useMf();
const endpoints = computed(() => mf.serving.value.filter(e => e.name === props.model.name));

const deploying = ref(false);
const saving = ref(false);
const error = ref('');
const version = ref(0);
const runtime = ref<'torchserve' | 'vllm'>('torchserve');
const dtype = ref('fp32');
const workers = ref(1);
const maxLen = ref(4096);
const seqs = ref(16);
const dtypes = computed(() => (runtime.value === 'vllm' ? ['bf16', 'fp16', 'int8', 'awq'] : ['fp32', 'fp16', 'bf16', 'int8']));
const chosen = computed(() => props.model.versions.find(v => v.version === version.value));
function startDeploy() {
  const live = props.model.versions.find(v => v.stage === 'Production') || props.model.versions[props.model.versions.length - 1];
  version.value = live?.version || 0;
  runtime.value = /B-|Instruct|Llama|Mistral|Qwen/i.test(live?.base || '') ? 'vllm' : 'torchserve';
  dtype.value = runtime.value === 'vllm' ? 'bf16' : 'fp32';
  error.value = '';
  deploying.value = true;
}
const command = computed(() => {
  const v = chosen.value;
  if (!v) return '';
  if (runtime.value === 'torchserve') {
    return cli(['torchserve'], { '--start': true, '--models': `${props.model.name}=${v.run_id}`, '--dtype': dtype.value,
      '--workers': workers.value > 1 ? workers.value : '' });
  }
  return cli(['vllm', 'serve', v.base], { '--served-model-name': props.model.name, '--dtype': dtype.value,
    '--max-model-len': maxLen.value, '--max-num-seqs': seqs.value });
});
const preview = computed(() => command.value);
async function deploy() {
  if (!command.value || saving.value) return;
  saving.value = true;
  const result = await mf.run(command.value, { quiet: true });
  saving.value = false;
  if (!result.ok) { error.value = String(result.error || result.output || '').trim(); return; }
  deploying.value = false;
  mf.notify('success', `Endpoint ${props.model.name} is ready`, `Version ${version.value} on ${runtime.value}.`);
}
async function stop(e: MfServing) {
  const torch = e.runtime === 'torchserve';
  const yes = await mf.confirm({ title: 'Stop endpoint', yes: 'Stop', danger: true,
    message: torch ? 'TorchServe is one server: stopping it stops every model it serves.' : `Stop the vLLM server for ${e.name}?` });
  if (!yes) return;
  await mf.run(torch ? cli(['torchserve'], { '--stop': true }) : cli(['vllm', 'stop'], { '--model': e.name }),
               { success: `Stopped ${e.name}` });
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-serve__p { margin: 0; }
.mf-serve__none { font-size: 13px; }
.mf-serve__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.mf-serve__err { white-space: pre-wrap; overflow-wrap: anywhere; }
.mf-hint.mf-mono { overflow-wrap: anywhere; }
</style>
