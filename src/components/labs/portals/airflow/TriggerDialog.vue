<template>
  <AfModal :title="'Trigger DAG: ' + dagId" ok-text="Trigger" :ok-disabled="Boolean(confError)" :busy="saving" :width="680"
           @close="$emit('close')" @ok="submit">
    <p v-if="dag && dag.description" class="af-muted af-trig__desc">{{ dag.description }}</p>
    <div class="af-trig__grid">
      <label class="af-field">
        <span class="af-label">Logical date <i>(optional)</i></span>
        <input v-model="logicalDate" class="af-input" type="text" placeholder="2026-11-02T00:00:00+00:00" aria-label="Logical date" />
        <span class="af-help">Leave empty for "now" on the platform clock.</span>
      </label>
      <label class="af-field">
        <span class="af-label">Run id <i>(optional)</i></span>
        <input v-model="runId" class="af-input" type="text" placeholder="manual__..." aria-label="Run id" />
      </label>
    </div>
    <div v-if="paramKeys.length" class="af-trig__params">
      <span class="af-label">DAG conf Parameters</span>
      <label v-for="key in paramKeys" :key="key" class="af-field af-trig__param">
        <span class="af-trig__pname">{{ key }}</span>
        <input class="af-input" :value="paramValue(key)" :aria-label="key" @input="setParam(key, ($event.target as HTMLInputElement).value)" />
      </label>
    </div>
    <label class="af-field">
      <span class="af-label">Configuration JSON <i>(Optional, must be a dict object)</i></span>
      <textarea v-model="conf" class="af-textarea" :class="{ 'af-input--error': confError }" rows="8" spellcheck="false" aria-label="Configuration JSON"></textarea>
      <span v-if="confError" class="af-error-text">{{ confError }}</span>
      <span class="af-help">To access configuration in your DAG use <code v-pre>{{ dag_run.conf }}</code>.
        As core.dag_run_conf_overrides_params is set to True, the conf overrides the DAG's params.</span>
    </label>
    <div class="af-trig__cli">
      <span class="af-label">Equivalent CLI</span>
      <code class="af-trig__line">{{ command }}</code>
    </div>
  </AfModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AfModal from './AfModal.vue';
import { useAf } from './afContext';
import { CMD, parseConf } from './airflow';
import { triggerNow } from './dagActions';

const props = defineProps<{ dagId: string }>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'done', ok: boolean): void }>();
const af = useAf();
const dag = computed(() => af.dag(props.dagId));

const initialParams = (() => {
  const params = dag.value?.params;
  return params && typeof params === 'object' && !Array.isArray(params) ? params as Record<string, any> : {};
})();
const conf = ref(Object.keys(initialParams).length ? JSON.stringify(initialParams, null, 4) : '{}');
const logicalDate = ref('');
const runId = ref('');
const saving = ref(false);

const paramKeys = computed(() => Object.keys(initialParams));
const parsed = computed(() => parseConf(conf.value));
const confError = computed(() => (parsed.value.ok ? '' : parsed.value.error));
const confValue = computed(() => (parsed.value.ok && parsed.value.value !== '{}' ? parsed.value.value : ''));
const command = computed(() => CMD.trigger(props.dagId, { conf: confValue.value, logicalDate: logicalDate.value.trim(), runId: runId.value.trim() }));

function paramValue(key: string) {
  try {
    const value = JSON.parse(conf.value || '{}')[key];
    return value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return '';
  }
}
function setParam(key: string, value: string) {
  let obj: Record<string, any> = {};
  try { obj = JSON.parse(conf.value || '{}') || {}; } catch { obj = {}; }
  let typed: any = value;
  try { typed = JSON.parse(value); } catch { typed = value; }
  obj[key] = typed;
  conf.value = JSON.stringify(obj, null, 4);
}

async function submit() {
  if (confError.value) return;
  saving.value = true;
  const result = await triggerNow(af, props.dagId, { conf: confValue.value, logicalDate: logicalDate.value.trim(), runId: runId.value.trim() });
  saving.value = false;
  emit('done', result.ok);
  if (result.ok) emit('close');
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-trig__desc { margin: 0; }
.af-trig__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; }
.af-trig__params { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--af-border); border-radius: 4px; background: #fafafa; }
.af-trig__param { display: grid; grid-template-columns: minmax(100px, 30%) 1fr; align-items: center; gap: 8px; }
.af-trig__pname { font-family: var(--af-mono); font-size: 13px; overflow-wrap: anywhere; }
.af-trig__cli { display: flex; flex-direction: column; gap: 4px; }
.af-trig__line { display: block; padding: 6px 8px; color: #24292e; background: #f6f8fa; border: 1px solid #e1e4e8; overflow-wrap: anywhere; white-space: pre-wrap; }
</style>
