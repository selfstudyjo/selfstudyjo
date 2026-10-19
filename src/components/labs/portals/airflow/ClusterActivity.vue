<template>
  <div class="af-page af-ca">
    <h2 class="af-h2">Cluster Activity</h2>

    <section class="af-ca__section">
      <h3 class="af-h4">Health</h3>
      <div class="af-ca__cards">
        <div v-for="c in health" :key="c.name" class="af-ca__card">
          <span class="af-ca__label">{{ c.name }}</span>
          <span class="af-ca__health" :class="c.ok ? 'is-ok' : 'is-bad'">{{ c.ok ? 'healthy' : 'unhealthy' }}</span>
          <span v-if="c.detail" class="af-muted af-small">{{ c.detail }}</span>
        </div>
      </div>
    </section>

    <section class="af-ca__section">
      <div class="af-ca__cards">
        <button type="button" class="af-ca__card af-ca__stat" @click="af.go({ page: 'home' })">
          <span class="af-ca__label">Unpaused DAGs</span><span class="af-ca__num">{{ unpaused }}</span></button>
        <button type="button" class="af-ca__card af-ca__stat" @click="af.go({ page: 'dagruns' })">
          <span class="af-ca__label">Running DAGs</span><span class="af-ca__num">{{ runningDags }}</span></button>
        <button type="button" class="af-ca__card af-ca__stat" @click="af.go({ page: 'dagruns' })">
          <span class="af-ca__label">Failed DAGs</span><span class="af-ca__num af-ca__num--bad">{{ failedDags }}</span></button>
        <button type="button" class="af-ca__card af-ca__stat" @click="af.go({ page: 'pools' })">
          <span class="af-ca__label">Pool slots used</span><span class="af-ca__num">{{ poolUsed }} / {{ poolTotal }}</span></button>
      </div>
    </section>

    <div class="af-ca__charts">
      <section class="af-ca__card af-ca__chart">
        <h3 class="af-h4">Dag Run States</h3>
        <StateBars :counts="runStates" />
      </section>
      <section class="af-ca__card af-ca__chart">
        <h3 class="af-h4">Dag Run Types</h3>
        <table class="af-kv"><tbody>
          <tr v-for="[t, n] in runTypes" :key="t"><th>{{ t }}</th><td>{{ n }}</td></tr>
          <tr v-if="!runTypes.length"><td colspan="2" class="af-muted">No DAG runs yet.</td></tr>
        </tbody></table>
      </section>
      <section class="af-ca__card af-ca__chart">
        <h3 class="af-h4">Task Instance States</h3>
        <StateBars :counts="tiStates" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, type PropType } from 'vue';
import { useAf } from './afContext';
import { normState, stateColor, stateLabel } from './airflow';

const af = useAf();

/** One horizontal bar per state, in the state's own colour - the axis carries the count. */
const StateBars = defineComponent({
  props: { counts: { type: Object as PropType<Record<string, number>>, required: true } },
  setup(p) {
    return () => {
      const entries = Object.entries(p.counts).sort((a, b) => b[1] - a[1]);
      const max = Math.max(1, ...entries.map(e => e[1]));
      if (!entries.length) return h('p', { class: 'af-ca__none' }, 'No data');
      return h('div', { class: 'af-ca__bars' }, entries.map(([s, n]) => h('div', { class: 'af-ca__barrow', key: s }, [
        h('span', { class: 'af-ca__barlabel' }, stateLabel(s)),
        h('span', { class: 'af-ca__bartrack' }, [h('span', { class: 'af-ca__bar', style: { width: `${(n / max) * 100}%`, background: s === 'none' ? '#ddd' : stateColor(s) } })]),
        h('span', { class: 'af-ca__barnum' }, String(n)),
      ])));
    };
  },
});

const sched = computed(() => af.scheduler.value || {});
const health = computed(() => [
  { name: 'MetaDatabase', ok: true, detail: '' },
  { name: 'Scheduler', ok: sched.value.healthy !== false, detail: sched.value.last_heartbeat ? `Last heartbeat: ${sched.value.last_heartbeat}` : '' },
  { name: 'Triggerer', ok: true, detail: '' },
  { name: 'Dag Processor', ok: true, detail: `${af.dags.value.length} DAGs, ${af.importErrors.value.length} import errors` },
]);
const unpaused = computed(() => af.dags.value.filter(d => !d.paused).length);
const runningDags = computed(() => new Set(af.runs.value.filter(r => normState(r.state) === 'running').map(r => r.dag_id)).size);
const failedDags = computed(() => new Set(af.runs.value.filter(r => normState(r.state) === 'failed').map(r => r.dag_id)).size);
const poolUsed = computed(() => af.pools.value.reduce((n, p) => n + (Number(p.running) || 0), 0));
const poolTotal = computed(() => af.pools.value.reduce((n, p) => n + Math.max(0, Number(p.slots) || 0), 0));
function count(list: string[]) {
  const out: Record<string, number> = {};
  list.forEach(s => { out[s] = (out[s] || 0) + 1; });
  return out;
}
const runStates = computed(() => count(af.runs.value.map(r => normState(r.state))));
const tiStates = computed(() => count(af.tis.value.map(t => normState(t.state))));
const runTypes = computed(() => Object.entries(count(af.runs.value.map(r => String(r.run_type || 'manual')))));
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-ca__section { display: flex; flex-direction: column; gap: 8px; }
.af-ca__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.af-ca__card { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--af-border-light); border-radius: 6px; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .05); min-width: 0; }
.af-ca__stat { cursor: pointer; text-align: left; font: inherit; }
.af-ca__stat:hover { border-color: var(--af-primary); }
.af-ca__label { font-size: 13px; color: var(--af-text-2); }
.af-ca__num { font-size: 26px; font-weight: 500; color: var(--af-text-strong); }
.af-ca__num--bad { color: #c00; }
.af-ca__health { font-weight: 700; }
.af-ca__health.is-ok { color: #2b7a2b; }
.af-ca__health.is-bad { color: #c00; }
.af-ca__charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 12px; }
.af-ca__chart { gap: 10px; }
:deep(.af-ca__bars) { display: flex; flex-direction: column; gap: 6px; }
:deep(.af-ca__barrow) { display: grid; grid-template-columns: 120px minmax(0, 1fr) 40px; align-items: center; gap: 8px; font-size: 13px; }
:deep(.af-ca__barlabel) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
:deep(.af-ca__bartrack) { height: 12px; background: #f2f2f2; border-radius: 2px; overflow: hidden; }
:deep(.af-ca__bar) { display: block; height: 100%; border-radius: 2px; }
:deep(.af-ca__barnum) { text-align: right; font-variant-numeric: tabular-nums; }
:deep(.af-ca__none) { margin: 0; color: var(--af-text-2); }
</style>
