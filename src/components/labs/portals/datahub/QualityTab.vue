<template>
  <div class="dh-q">
    <nav class="dh-q__sub" aria-label="Quality">
      <button type="button" :class="{ 'is-active': sub === 'assertions' }" @click="sub = 'assertions'">Assertions</button>
      <button type="button" :class="{ 'is-active': sub === 'monitors' }" @click="sub = 'monitors'">Monitors <span class="dh-count">{{ monitors.length }}</span></button>
    </nav>

    <template v-if="sub === 'assertions'">
      <div class="dh-q__summary dh-card">
        <div class="dh-q__status">
          <DhIcon :name="!latest ? 'quality' : latest.success ? 'check-circle' : 'x-circle'" :size="28"
                  :class="!latest ? '' : latest.success ? 'is-ok' : 'is-bad'" />
          <div>
            <div class="dh-h4">{{ !latest ? 'No assertions have run' : latest.success ? 'All assertions are passing' : (latest.evaluated - latest.successful) + ' of ' + latest.evaluated + ' assertions are failing' }}</div>
            <div class="dh-muted dh-small" v-if="latest">Last evaluated by Great Expectations · suite <b>{{ latest.suite }}</b><template v-if="latest.checkpoint"> · checkpoint <b>{{ latest.checkpoint }}</b></template> · {{ latest.time }} · {{ latest.rows.toLocaleString() }} rows</div>
            <div class="dh-muted dh-small" v-else>Run a Great Expectations checkpoint or validate a suite that targets this asset.</div>
          </div>
        </div>
        <div v-if="history.length" class="dh-q__history" aria-label="Run history">
          <span class="dh-muted dh-small">History</span>
          <span v-for="r in history" :key="r.id" class="dh-q__run" :class="r.success ? 'is-ok' : 'is-bad'"
                :title="`${r.id} · ${r.suite} · ${r.time} · ${r.successful}/${r.evaluated} passed`" />
        </div>
      </div>

      <div v-if="latest" class="dh-table-wrap">
        <table class="dh-table">
          <thead><tr><th>Status</th><th>Assertion</th><th>Column</th><th>Observed</th><th>Unexpected</th><th>Sample unexpected values</th></tr></thead>
          <tbody>
            <tr v-for="(d, i) in latest.details" :key="i">
              <td><span class="dh-pill" :class="d.success ? 'dh-pill--ok' : 'dh-pill--bad'">{{ d.success ? 'Passing' : 'Failing' }}</span></td>
              <td><span class="dh-assert">{{ humanType(d.type) }}</span><div class="dh-mono dh-muted">{{ d.type }}</div></td>
              <td class="dh-mono">{{ d.column || '—' }}</td>
              <td class="dh-mono">{{ d.error ? 'error' : fmt(d.observed) }}<div v-if="d.error" class="dh-error-text">{{ d.error }}</div></td>
              <td>{{ d.unexpected_count }}<span class="dh-muted"> ({{ d.unexpected_percent }}%)</span></td>
              <td class="dh-mono">{{ d.partial && d.partial.length ? d.partial.map(fmt).join(', ') : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="dh-q__grid">
        <section class="dh-card">
          <div class="dh-card__head"><h3 class="dh-h4">Checkpoints on this asset</h3><span class="dh-spacer" />
            <button type="button" class="dh-btn dh-btn--link dh-btn--sm" @click="dh.go({ page: 'gx' })">Manage</button></div>
          <div class="dh-card__body">
            <div v-if="!checkpoints.length" class="dh-muted dh-small">No checkpoint targets this asset.</div>
            <div v-for="c in checkpoints" :key="c.name" class="dh-q__item">
              <DhIcon name="quality" /><b>{{ c.name }}</b><span class="dh-muted dh-small">suite {{ c.suite }}</span>
              <span v-if="c.last_result" class="dh-pill" :class="c.last_result === 'success' ? 'dh-pill--ok' : 'dh-pill--bad'">{{ c.last_result }}</span>
              <span class="dh-spacer" />
              <button type="button" class="dh-btn dh-btn--sm dh-btn--primary" :disabled="dh.busy.value" @click="runCheckpoint(c.name)"><DhIcon name="play" :size="12" /> Run</button>
            </div>
          </div>
        </section>
        <section class="dh-card">
          <div class="dh-card__head"><h3 class="dh-h4">Expectation suites</h3><span class="dh-spacer" />
            <button type="button" class="dh-btn dh-btn--link dh-btn--sm" @click="dh.go({ page: 'gx' })">Manage</button></div>
          <div class="dh-card__body">
            <div v-if="!suites.length" class="dh-muted dh-small">No suite targets this asset.</div>
            <div v-for="s in suites" :key="s.name" class="dh-q__item">
              <DhIcon name="doc" /><b>{{ s.name }}</b><span class="dh-muted dh-small">{{ s.expectations.length }} expectations</span>
              <span class="dh-spacer" />
              <button type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value || !s.expectations.length" @click="validate(s.name)"><DhIcon name="play" :size="12" /> Validate</button>
            </div>
          </div>
        </section>
      </div>
    </template>

    <template v-else>
      <div v-if="!monitors.length" class="dh-card dh-empty">
        <DhIcon name="pulse" />
        <span>No monitors watch this asset.</span>
        <button type="button" class="dh-btn dh-btn--primary" @click="dh.go({ page: 'monitors' })"><DhIcon name="plus" /> Create monitor</button>
      </div>
      <div v-else class="dh-table-wrap">
        <table class="dh-table">
          <thead><tr><th>Status</th><th>Monitor</th><th>Type</th><th>Threshold</th><th>Last value</th><th>Detail</th><th /></tr></thead>
          <tbody>
            <tr v-for="m in monitors" :key="m.name">
              <td><span class="dh-pill" :class="m.paused ? 'dh-pill--grey' : m.status === 'ALERT' ? 'dh-pill--bad' : m.status === 'OK' ? 'dh-pill--ok' : 'dh-pill--grey'">{{ m.paused ? 'Paused' : m.status || 'Pending' }}</span></td>
              <td><b>{{ m.name }}</b></td><td>{{ m.type }}</td><td>{{ m.threshold }}</td><td class="dh-mono">{{ fmt(m.last_value) }}</td>
              <td class="dh-small">{{ m.detail }}</td>
              <td class="dh-actions"><button type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value" @click="runMonitor(m.name)"><DhIcon name="refresh" :size="12" /> Run</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import { dh as cmd, humanType, sameDataset, useDh, type DhDataset } from './dhContext';

const props = defineProps<{ entity: DhDataset }>();
const dh = useDh();
const sub = ref<'assertions' | 'monitors'>('assertions');

const runs = computed(() => dh.results.value.filter(r => sameDataset(r.asset, props.entity.urn)));
const latest = computed(() => runs.value[runs.value.length - 1] || null);
const history = computed(() => runs.value.slice(-20));
const suites = computed(() => dh.suites.value.filter(s => s.asset && sameDataset(s.asset, props.entity.urn)));
const checkpoints = computed(() => dh.checkpoints.value.filter(c => {
  const asset = c.asset || dh.suites.value.find(s => s.name === c.suite)?.asset || '';
  return asset && sameDataset(asset, props.entity.urn);
}));
const monitors = computed(() => dh.monitors.value.filter(m => sameDataset(m.dataset, props.entity.urn)));

function fmt(value: unknown) {
  if (value === null || value === undefined) return 'null';
  return String(value);
}

async function runCheckpoint(name: string) {
  const result = await dh.run(cmd(['gx', 'checkpoint', 'run', name]), { quiet: true });
  if (result.ok) dh.notify('success', `Checkpoint ${name} passed`);
  else dh.notify('error', `Checkpoint ${name} failed`, 'One or more expectations failed. See the assertion results below.');
}

async function validate(name: string) {
  const result = await dh.run(cmd(['gx', 'validate', name]), { quiet: true });
  if (result.ok) dh.notify('success', `Suite ${name}: all expectations met`);
  else dh.notify('error', `Suite ${name}: validation failed`, 'See the assertion results below.');
}

async function runMonitor(name: string) {
  await dh.run(cmd(['monitor', 'run', name]), { success: `Monitor ${name} evaluated` });
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-q { display: flex; flex-direction: column; gap: 14px; }
.dh-q__sub { display: flex; gap: 6px; }
.dh-q__sub button { border: 1px solid var(--dh-border-2); background: #fff; border-radius: 16px; padding: 3px 14px; font: inherit; font-size: 13px; cursor: pointer; color: var(--dh-text); display: inline-flex; align-items: center; gap: 6px; }
.dh-q__sub button.is-active { border-color: var(--dh-primary); color: var(--dh-primary); background: #e6f4ff; font-weight: 600; }
.dh-q__summary { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.dh-q__status { display: flex; gap: 12px; align-items: flex-start; }
.dh-q__status .dh-ico { color: #bfbfbf; }
.dh-q__status .is-ok { color: #52c41a; }
.dh-q__status .is-bad { color: #ff4d4f; }
.dh-small { font-size: 13px; }
.dh-q__history { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.dh-q__run { width: 12px; height: 22px; border-radius: 3px; }
.dh-q__run.is-ok { background: #52c41a; }
.dh-q__run.is-bad { background: #ff4d4f; }
.dh-assert { font-weight: 600; text-transform: capitalize; }
.dh-q__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 14px; }
.dh-q__item { display: flex; align-items: center; gap: 8px; padding: 6px 0; flex-wrap: wrap; border-bottom: 1px solid var(--dh-border); }
.dh-q__item:last-child { border-bottom: 0; }
.dh-q__item > .dh-ico { color: var(--dh-text-2); }
</style>
