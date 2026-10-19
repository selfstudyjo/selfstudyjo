<template>
  <div class="dh-inc">
    <div class="dh-inc__bar">
      <div class="dh-seg" role="tablist">
        <button v-for="f in filters" :key="f.key" type="button" role="tab" :aria-selected="state === f.key"
                :class="{ 'is-active': state === f.key }" @click="state = f.key">{{ f.label }} <span class="dh-count">{{ f.count }}</span></button>
      </div>
      <span class="dh-spacer" />
      <select v-model="severity" class="dh-select dh-inc__sel" aria-label="Severity">
        <option value="">All severities</option><option value="high">High</option><option value="medium">Medium</option>
      </select>
    </div>

    <div v-if="!shown.length" class="dh-card dh-empty">
      <DhIcon name="check-circle" class="dh-inc__good" />
      <span>{{ state === 'active' ? 'No active incidents' : 'No incidents' }}{{ dataset ? ' for this asset' : '' }}.</span>
      <span class="dh-hint">An incident opens automatically when a monitor starts alerting.</span>
    </div>

    <article v-for="i in shown" :key="i.id" class="dh-inc__row" :class="'is-' + i.status">
      <div class="dh-inc__main">
        <div class="dh-row">
          <span class="dh-pill" :class="i.severity === 'high' ? 'dh-pill--bad' : 'dh-pill--warn'">{{ i.severity === 'high' ? 'High' : 'Medium' }}</span>
          <span class="dh-pill" :class="i.status === 'resolved' ? 'dh-pill--ok' : i.status === 'acknowledged' ? 'dh-pill--info' : 'dh-pill--bad'">{{ statusLabel(i.status) }}</span>
          <span class="dh-mono dh-muted">{{ i.id }}</span>
        </div>
        <div class="dh-inc__title">{{ i.title }}</div>
        <div class="dh-inc__meta">
          <span v-if="!dataset">Asset <button type="button" class="dh-link" @click="open(i.dataset)">{{ i.dataset }}</button></span>
          <span>Monitor <b>{{ i.monitor }}</b></span>
          <span>Raised {{ i.opened_time }}</span>
        </div>
        <ul v-if="i.notes && i.notes.length" class="dh-inc__notes">
          <li v-for="(n, k) in i.notes" :key="k"><b>{{ n.by }}</b> {{ n.action === 'resolve' ? 'resolved' : 'acknowledged' }}: {{ n.note }}</li>
        </ul>
      </div>
      <div v-if="i.status !== 'resolved'" class="dh-inc__actions">
        <button v-if="i.status === 'open'" type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value" @click="dialog = { id: i.id, action: 'ack', note: '' }">Acknowledge</button>
        <button type="button" class="dh-btn dh-btn--sm dh-btn--primary" :disabled="dh.busy.value" @click="dialog = { id: i.id, action: 'resolve', note: '' }">Resolve</button>
      </div>
    </article>

    <DhModal v-if="dialog" :title="dialog.action === 'resolve' ? 'Resolve Incident' : 'Acknowledge Incident'"
             :ok-text="dialog.action === 'resolve' ? 'Resolve' : 'Acknowledge'"
             :ok-disabled="dialog.action === 'resolve' && !dialog.note.trim()" :busy="dh.busy.value"
             @close="dialog = null" @ok="submit">
      <p class="dh-muted">{{ dialog.id }}</p>
      <div class="dh-field">
        <span class="dh-label"><b v-if="dialog.action === 'resolve'">*</b>{{ dialog.action === 'resolve' ? 'Resolution note' : 'Note (optional)' }}</span>
        <textarea v-model="dialog.note" class="dh-textarea" rows="4" aria-label="Note"
                  :placeholder="dialog.action === 'resolve' ? 'What was wrong, and what fixed it?' : 'Who is looking at it?'" />
      </div>
    </DhModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import DhModal from './DhModal.vue';
import { dh as cmd, sameDataset, useDh } from './dhContext';

const props = defineProps<{ dataset?: string }>();
const dh = useDh();
const state = ref<'active' | 'resolved' | 'all'>('active');
const severity = ref('');
const dialog = ref<{ id: string; action: 'ack' | 'resolve'; note: string } | null>(null);

const scoped = computed(() => dh.incidents.value.filter(i => !props.dataset || sameDataset(i.dataset, props.dataset)));
const filters = computed(() => [
  { key: 'active' as const, label: 'Active', count: scoped.value.filter(i => i.status !== 'resolved').length },
  { key: 'resolved' as const, label: 'Resolved', count: scoped.value.filter(i => i.status === 'resolved').length },
  { key: 'all' as const, label: 'All', count: scoped.value.length },
]);
const shown = computed(() => scoped.value
  .filter(i => state.value === 'all' || (state.value === 'active' ? i.status !== 'resolved' : i.status === 'resolved'))
  .filter(i => !severity.value || i.severity === severity.value)
  .slice().reverse());

function statusLabel(status: string) {
  return status === 'open' ? 'Active' : status === 'acknowledged' ? 'Acknowledged' : 'Resolved';
}

function open(urn: string) {
  if (dh.dataset(urn)) dh.openEntity(urn, 'Incidents');
}

async function submit() {
  if (!dialog.value) return;
  const { id, action, note } = dialog.value;
  const command = cmd(['monitor', action, id], {}, note.trim() ? { '--note': note.trim() } : {});
  const result = await dh.run(command, { success: action === 'resolve' ? `${id} resolved` : `${id} acknowledged` });
  if (result.ok) dialog.value = null;
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-inc { display: flex; flex-direction: column; gap: 10px; }
.dh-inc__bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dh-seg { display: inline-flex; border: 1px solid var(--dh-border-2); border-radius: 6px; overflow: hidden; }
.dh-seg button { border: 0; border-right: 1px solid var(--dh-border-2); background: #fff; padding: 4px 12px; font: inherit; font-size: 13px; cursor: pointer; color: var(--dh-text); display: inline-flex; align-items: center; gap: 6px; }
.dh-seg button:last-child { border-right: 0; }
.dh-seg button.is-active { background: #e6f4ff; color: var(--dh-primary); font-weight: 600; }
.dh-inc__sel { width: auto; height: 30px; font-size: 13px; }
.dh-inc__good { color: #52c41a !important; }
.dh-inc__row { display: flex; gap: 12px; background: #fff; border: 1px solid var(--dh-border); border-left: 4px solid #ff4d4f; border-radius: 8px; padding: 12px 14px; flex-wrap: wrap; }
.dh-inc__row.is-acknowledged { border-left-color: #1677ff; }
.dh-inc__row.is-resolved { border-left-color: #52c41a; }
.dh-inc__main { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 6px; }
.dh-inc__title { font-weight: 600; overflow-wrap: anywhere; }
.dh-inc__meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; color: var(--dh-text-2); }
.dh-inc__notes { margin: 0; padding-left: 18px; font-size: 13px; color: var(--dh-text-2); }
.dh-inc__actions { display: flex; gap: 8px; align-items: flex-start; }
</style>
