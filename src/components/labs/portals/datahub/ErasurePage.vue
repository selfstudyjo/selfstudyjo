<template>
  <div class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1 class="dh-title">GDPR Erasure</h1>
        <p class="dh-subtitle">Right-to-be-forgotten requests. DataHub finds every system that holds the subject through lineage and PII tags; plan the erasure as a dry run, review it, then execute it. Executing really deletes the rows and writes an audit record.</p>
      </div>
    </div>

    <section class="dh-card">
      <div class="dh-card__head"><h2 class="dh-h4">New erasure request</h2></div>
      <div class="dh-card__body dh-er-form">
        <div class="dh-field dh-er-subject">
          <span class="dh-label"><b>*</b>Data subject</span>
          <div class="dh-er-input">
            <span class="dh-er-prefix">customer:</span>
            <input v-model="customerId" class="dh-input" inputmode="numeric" placeholder="1234" aria-label="Customer id" @keydown.enter.prevent="plan" />
          </div>
          <span v-if="customerId && !validId" class="dh-error-text">The subject is a numeric customer id.</span>
        </div>
        <button type="button" class="dh-btn" :disabled="dh.busy.value || !validId" @click="plan"><DhIcon name="eye" /> Plan erasure (dry run)</button>
        <button type="button" class="dh-btn dh-btn--danger" :disabled="dh.busy.value || !canExecute" :title="canExecute ? '' : 'Plan the erasure first'" @click="execute"><DhIcon name="eraser" /> Execute erasure</button>
      </div>
    </section>

    <section v-if="planned" class="dh-card">
      <div class="dh-card__head">
        <h2 class="dh-h4">Erasure plan for {{ planned.subject }}</h2>
        <span class="dh-pill" :class="planned.total ? 'dh-pill--warn' : 'dh-pill--grey'">{{ planned.total }} row(s) would be erased</span>
      </div>
      <div class="dh-card__body dh-scroll">
        <table v-if="planned.grid" class="dh-table">
          <thead><tr><th v-for="(c, i) in planned.grid.columns" :key="i" class="dh-cap">{{ c }}</th></tr></thead>
          <tbody>
            <tr v-for="(row, i) in planned.grid.rows" :key="i" :class="{ 'is-skip': /retain|cannot/.test(String(row[3])) }">
              <td v-for="(cell, j) in row" :key="j" :class="{ 'dh-mono': j === 1 }">
                <span v-if="j === 0" class="dh-src"><PlatformIcon :platform="String(cell)" :size="14" /> {{ cell }}</span>
                <template v-else>{{ cell }}</template>
              </td>
            </tr>
          </tbody>
        </table>
        <pre class="dh-pre dh-er-note">{{ planned.footer }}</pre>
      </div>
    </section>

    <section v-if="executed" class="dh-alert" :class="executed.ok ? 'dh-alert--success' : 'dh-alert--error'">
      <DhIcon :name="executed.ok ? 'check-circle' : 'x-circle'" />
      <div><pre class="dh-pre dh-er-note">{{ executed.text }}</pre></div>
    </section>

    <section class="dh-card">
      <div class="dh-card__head"><h2 class="dh-h4">Erasure audit log</h2><span class="dh-count">{{ dh.erasures.value.length }}</span></div>
      <div class="dh-card__body dh-scroll">
        <div v-if="!dh.erasures.value.length" class="dh-muted">No erasures have been executed.</div>
        <table v-else class="dh-table">
          <thead><tr><th>Request</th><th>Subject</th><th>Requested</th><th>Completed</th><th>Status</th><th>Rows removed</th><th>Systems</th></tr></thead>
          <tbody>
            <tr v-for="e in erasuresNewestFirst" :key="e.id">
              <td class="dh-mono">{{ e.id }}</td><td class="dh-mono">{{ e.subject }}</td><td>{{ e.requested }}</td><td>{{ e.completed || '—' }}</td>
              <td><span class="dh-pill" :class="e.status === 'completed' ? 'dh-pill--ok' : 'dh-pill--bad'">{{ e.status }}</span></td>
              <td>{{ e.rows }}</td>
              <td><ul class="dh-er-sys"><li v-for="(s, i) in e.systems" :key="i"><span class="dh-mono">{{ s.dataset }}</span> · {{ s.rows }} · {{ s.status }}</li></ul></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import PlatformIcon from './PlatformIcon.vue';
import { dh as cmd, useDh } from './dhContext';

const dh = useDh();
const customerId = ref('');
const planned = ref<{ subject: string; total: number; grid: { columns: string[]; rows: unknown[][] } | null; footer: string } | null>(null);
const executed = ref<{ ok: boolean; text: string } | null>(null);

const validId = computed(() => /^\d+$/.test(customerId.value.trim()));
const subject = computed(() => `customer:${customerId.value.trim()}`);
const canExecute = computed(() => Boolean(planned.value && planned.value.subject === subject.value && planned.value.total > 0));
const erasuresNewestFirst = computed(() => dh.erasures.value.slice().reverse());

async function plan() {
  if (!validId.value) return;
  executed.value = null;
  const result = await dh.run(cmd(['datahub', 'erase'], { '--subject': subject.value }));
  if (!result.ok) { planned.value = null; return; }
  const text = String(result.output || '');
  const grid = ((result.data as any)?.grids || [])[0] || null;
  const match = text.match(/(\d+) row\(s\) would be erased/);
  planned.value = { subject: subject.value, total: match ? Number(match[1]) : 0, grid, footer: text.split('\n').slice(-1)[0] ?? '' };
}

async function execute() {
  if (!canExecute.value || !planned.value) return;
  const ok = await dh.confirm({
    title: 'Execute GDPR erasure?',
    message: `This permanently deletes ${planned.value.total} row(s) about ${subject.value} from every system in the plan and writes an audit record. It cannot be undone.`,
    yes: 'Erase', danger: true, typeToConfirm: subject.value,
  });
  if (!ok) return;
  const result = await dh.run(cmd(['datahub', 'erase'], { '--subject': subject.value, '--execute': true }), { quiet: true });
  executed.value = { ok: result.ok, text: String(result.ok ? result.output || '' : result.error || result.output || '') };
  if (result.ok) {
    dh.notify('success', `Erasure for ${subject.value} completed`);
    planned.value = null;
  } else {
    dh.notify('error', `Erasure for ${subject.value} did not complete`, 'See the per-system status below.');
  }
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-er-form { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.dh-er-subject { flex: 0 1 320px; }
.dh-er-input { display: flex; }
.dh-er-prefix { display: inline-flex; align-items: center; padding: 0 10px; border: 1px solid var(--dh-border-2); border-right: 0; border-radius: 6px 0 0 6px; background: #fafafa; font-family: var(--dh-mono); font-size: 13px; color: var(--dh-text-2); }
.dh-er-input .dh-input { border-radius: 0 6px 6px 0; }
.dh-scroll { overflow: auto; display: flex; flex-direction: column; gap: 10px; }
.dh-cap { text-transform: capitalize; }
.dh-src { display: inline-flex; align-items: center; gap: 6px; }
.dh-table tr.is-skip td { color: var(--dh-text-2); background: #fafafa; }
.dh-er-note { max-height: none; background: transparent; border: 0; padding: 0; }
.dh-er-sys { margin: 0; padding-left: 16px; font-size: 12px; }
</style>
