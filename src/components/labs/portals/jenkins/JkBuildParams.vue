<template>
  <form class="jk-bp" @submit.prevent="submit">
    <h1 class="jk-h1">{{ typeLabel }} {{ r.job }}</h1>
    <p>This build requires parameters:</p>
    <div v-if="error" class="jk-alert jk-alert--danger">{{ error }}</div>
    <div v-else-if="!params" class="jk-muted">Loading…</div>
    <template v-else>
      <p v-if="!params.length" class="jk-muted">No parameters are defined. The build will use the pipeline's defaults.</p>
      <div v-for="param in params" :key="param.name" class="jk-field jk-bp__field">
        <template v-if="param.type === 'boolean'">
          <label class="jk-check"><input v-model="values[param.name]" type="checkbox" true-value="true" false-value="false" />
            <strong>{{ param.name }}</strong></label>
        </template>
        <template v-else>
          <label class="jk-label" :for="'jk-bp-' + param.name">{{ param.name }}</label>
          <select v-if="param.type === 'choice'" :id="'jk-bp-' + param.name" v-model="values[param.name]" class="jk-select">
            <option v-for="choice in param.choices || []" :key="choice" :value="choice">{{ choice }}</option>
          </select>
          <input v-else :id="'jk-bp-' + param.name" v-model="values[param.name]" class="jk-input" type="text" />
        </template>
        <p v-if="param.description" class="jk-help">{{ param.description }}</p>
        <p v-if="param.declared" class="jk-help">Declared in the Jenkinsfile.</p>
      </div>
      <div class="jk-bottom-bar">
        <button type="submit" class="jk-btn jk-btn--primary jk-bp__build" :disabled="running">Build</button>
        <button type="button" class="jk-btn" @click="ctx.go({ page: 'job', job: r.job })">Cancel</button>
      </div>
    </template>
  </form>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useJk } from './jkContext';
import { useActions } from './jkActions';
import { jcli, TYPE_LABEL, type JobConfig, type ParamDef } from './jenkinsKit';

const ctx = useJk();
const actions = useActions(ctx);
const r = computed(() => ctx.route.value as any);
const typeLabel = computed(() => TYPE_LABEL[ctx.job(r.value.job)?.type || 'pipeline'] || 'Pipeline');
const params = ref<ParamDef[] | null>(null);
const values = reactive<Record<string, string>>({});
const error = ref('');
const running = ref(false);

onMounted(async () => {
  const result = await ctx.run(jcli(['get-job', r.value.job]), { quiet: true, unlogged: true, direct: true });
  const data = result.data as JobConfig | undefined;
  if (!result.ok || !data) {
    error.value = String(result.error || 'The job could not be read.');
    return;
  }
  const list = data.params || [];
  // The last build's values are the defaults the next one is offered.
  const last = ctx.job(r.value.job)?.builds[0]?.params || {};
  for (const param of list) {
    const previous = last[param.name];
    if (param.type === 'boolean') values[param.name] = String(previous ?? Boolean(param.default));
    else if (param.type === 'choice') values[param.name] = String(previous ?? (param.choices || [])[0] ?? '');
    else values[param.name] = String(previous ?? param.default ?? '');
  }
  params.value = list;
});

async function submit() {
  running.value = true;
  try {
    const sent: Record<string, string> = {};
    for (const param of params.value || []) sent[param.name] = String(values[param.name] ?? '');
    const ok = Object.keys(sent).length
      ? await actions.buildNow(r.value.job, sent)
      : (await ctx.run(jcli(['build', r.value.job]), { success: 'Build scheduled' })).ok;
    if (ok) ctx.go({ page: 'job', job: r.value.job });
  } finally {
    running.value = false;
  }
}
</script>

<style scoped>
.jk-bp { max-width: 768px; }
.jk-bp__field { max-width: 512px; }
.jk-bp__build { min-width: 88px; }
</style>
