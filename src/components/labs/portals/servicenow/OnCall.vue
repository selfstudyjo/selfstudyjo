<template>
  <div class="form-page">
    <div class="bar">
      <h1 class="bar__title">On-Call Scheduling</h1>
      <span class="bar__sub">Who is on call now · {{ model.time }} UTC</span>
      <span class="bar__spacer"></span>
      <label class="sr" for="oc-group">Group</label>
      <select id="oc-group" v-model="groupName" class="select grp">
        <option v-for="g in model.groups" :key="g.name" :value="g.name">{{ g.name }}</option>
      </select>
    </div>
    <div class="scroll body">
      <section class="now">
        <div v-for="g in model.groups" :key="g.name" class="now__card card" :class="{ 'is-on': g.name === groupName }" @click="groupName = g.name">
          <div class="now__group">{{ g.name }}</div>
          <div class="now__who"><span class="av">{{ ini(g.primary) }}</span><span><b>{{ personName(model, g.primary) || '—' }}</b><small>Primary</small></span></div>
          <div class="now__sec">Secondary: {{ personName(model, g.secondary) || 'none' }} · {{ g.escalation.length }} escalation step(s)</div>
        </div>
      </section>

      <div v-if="group" class="grid">
        <div class="card">
          <div class="card__head"><h3 class="card__title">Rota — {{ group.name }}</h3></div>
          <div class="card__body">
            <div class="field"><label class="field__label" for="oc-primary">Primary</label>
              <select id="oc-primary" v-model="primary" class="select">
                <option value="">-- None --</option>
                <option v-for="m in group.members" :key="m" :value="m">{{ personName(model, m) }}</option>
              </select></div>
            <div class="field"><label class="field__label" for="oc-secondary">Secondary</label>
              <select id="oc-secondary" v-model="secondary" class="select">
                <option value="">-- None --</option>
                <option v-for="m in group.members" :key="m" :value="m">{{ personName(model, m) }}</option>
              </select></div>
            <p class="field__help">The secondary exists for when the primary cannot answer: they must be different people. Manager: {{ personName(model, group.manager) }}.</p>
            <button type="button" class="btn btn--primary" :disabled="busy || !dirtyRota" @click="saveRota">Save</button>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><h3 class="card__title">Escalation policy</h3><span class="bar__spacer"></span>
            <button v-if="group.escalation.length" type="button" class="btn btn--sm btn--danger" :disabled="busy" @click="confirmClear = true">Delete policy</button></div>
          <div class="card__body">
            <div class="table-wrap"><table class="table">
              <thead><tr><th>Level</th><th>After (minutes unacknowledged)</th><th>Notify</th><th></th></tr></thead>
              <tbody>
                <tr><td>1</td><td>0</td><td>Primary ({{ personName(model, group.primary) || '—' }})</td><td></td></tr>
                <tr v-for="(s, i) in steps" :key="i">
                  <td>{{ i + 2 }}</td>
                  <td><input v-model.number="s.after" class="input small" type="number" min="1" :aria-label="'Step ' + (i + 2) + ' minutes'" /></td>
                  <td><select v-model="s.who" class="select" :aria-label="'Step ' + (i + 2) + ' target'">
                    <option value="secondary">Secondary</option><option value="manager">Group manager</option><option value="group">Whole group</option>
                    <option v-for="p in model.people" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </select></td>
                  <td><button type="button" class="icon-btn" :aria-label="'Remove step ' + (i + 2)" @click="steps.splice(i, 1)">✕</button></td>
                </tr>
              </tbody>
            </table></div>
            <div class="row">
              <button type="button" class="btn btn--sm" @click="addStep">Add escalation step</button>
              <span class="bar__spacer"></span>
              <button type="button" class="btn btn--primary" :disabled="busy || !steps.length" @click="savePolicy">Save policy</button>
            </div>
            <p v-if="!group.escalation.length" class="field__help">No policy: a page nobody acknowledges stays with the primary for ever.</p>
          </div>
        </div>
      </div>

      <div class="card mt">
        <div class="card__head"><h3 class="card__title">Pages</h3><span class="bar__spacer"></span>
          <select v-model="pageInc" class="select inline" aria-label="Incident to page">
            <option value="">Incident…</option>
            <option v-for="i in model.incidents.filter(x => ['New', 'In Progress', 'On Hold'].includes(x.state))" :key="i.number" :value="i.number">{{ i.number }} (P{{ i.priority }})</option>
          </select>
          <button type="button" class="btn btn--sm" :disabled="busy || !pageInc" @click="page">Page on-call</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Page</th><th>Incident</th><th>Group</th><th>With</th><th>Level</th><th>Status</th><th>Sent</th><th>Escalation history</th><th></th></tr></thead>
            <tbody>
              <tr v-for="p in [...model.pages].reverse()" :key="p.id">
                <td>{{ p.id }}</td>
                <td><button type="button" class="link" @click="$emit('navigate', { page: 'incident', id: p.incident })">{{ p.incident }}</button></td>
                <td>{{ p.group }}</td><td>{{ personName(model, p.who) }}</td><td>{{ p.level }}</td>
                <td><span class="pill" :class="p.status === 'open' ? 'pill--warning' : 'pill--positive'">{{ p.status === 'open' ? 'Open' : 'Acknowledged' }}</span></td>
                <td>{{ p.sent }}</td>
                <td class="muted wrap">{{ p.history.map(h => h.at + ' ' + h.what + ' → ' + h.who).join(' · ') }}</td>
                <td><button v-if="p.status === 'open' && p.who === model.user" type="button" class="btn btn--sm btn--primary" :disabled="busy" @click="ack(p.id)">Acknowledge</button></td>
              </tr>
            </tbody>
          </table>
          <div v-if="!model.pages.length" class="empty">No pages have been sent.</div>
        </div>
      </div>
    </div>
    <SnModal v-if="confirmClear && group" title="Confirmation" size="sm" @close="confirmClear = false">
      <p>Delete the escalation policy for {{ group.name }}?</p>
      <p class="muted">A page nobody acknowledges will stay with the primary.</p>
      <template #footer>
        <button type="button" class="btn" @click="confirmClear = false">Cancel</button>
        <button type="button" class="btn btn--danger-solid" :disabled="busy" @click="clearPolicy">Delete</button>
      </template>
    </SnModal>
  </div>
</template>

<script setup lang="ts">
/** On-call scheduling: who is on call, the rota, the escalation policy and the pages. */
import { computed, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import SnModal from './SnModal.vue';
import { cmd, personName, type Model } from './snow';
import type { Route } from './route';

const props = defineProps<{ model: Model; api: PortalApi }>();
defineEmits<{ (event: 'navigate', route: Route): void }>();

const busy = computed(() => props.api.busy.value);
const groupName = ref(props.model.groups.find(g => g.members.includes(props.model.user))?.name || props.model.groups[0]?.name || '');
const group = computed(() => props.model.groups.find(g => g.name === groupName.value));
const primary = ref('');
const secondary = ref('');
const steps = ref<{ who: string; after: number }[]>([]);
const pageInc = ref('');
const confirmClear = ref(false);

function load() {
  const g = group.value;
  primary.value = g?.primary || '';
  secondary.value = g?.secondary || '';
  steps.value = (g?.escalation || []).map(s => ({ ...s }));
}
load();
watch(() => JSON.stringify(group.value), load);
const dirtyRota = computed(() => primary.value !== (group.value?.primary || '') || secondary.value !== (group.value?.secondary || ''));

function ini(id: string) { return (personName(props.model, id) || '?').split(/\s+/).map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase(); }
function addStep() {
  const last = steps.value[steps.value.length - 1]?.after || 0;
  steps.value.push({ who: steps.value.length ? 'manager' : 'secondary', after: last + (last ? 10 : 5) });
}
async function one(line: string, success: string) { return (await props.api.exec(line, { success })).ok; }
async function saveRota() {
  const g = group.value!;
  await one(cmd.oncallSet(g.name, primary.value !== g.primary ? primary.value : undefined,
    secondary.value !== g.secondary ? secondary.value : undefined), `${g.name} rota updated`);
}
async function savePolicy() { await one(cmd.oncallPolicy(group.value!.name, steps.value), `${group.value!.name} escalation policy saved`); }
async function clearPolicy() {
  if (await one(cmd.oncallClear(group.value!.name), 'Escalation policy deleted')) confirmClear.value = false;
}
async function page() { if (await one(cmd.oncallPage(pageInc.value), `Paged on-call for ${pageInc.value}`)) pageInc.value = ''; }
async function ack(id: string) { await one(cmd.oncallAck(id), `${id} acknowledged`); }
</script>

<style scoped src="./sn.css"></style>
<style scoped src="./form.css"></style>
<style scoped>
.body { padding: 16px; background: var(--sn-page); }
.grp { width: auto; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; text-overflow: ellipsis; }
.now { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 224px), 1fr)); gap: 9.6px; margin-bottom: 14.4px; }
.now__card { padding: 11.2px 12.8px; cursor: pointer; }
.now__card.is-on { border-color: var(--sn-primary); box-shadow: 0 0 0 1px var(--sn-primary); }
.now__group { font-size: 12px; font-weight: 700; color: var(--sn-text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
.now__who { display: flex; align-items: center; gap: 8px; margin: 7.2px 0 4.8px; font-size: 14px; }
.now__who small { display: block; color: var(--sn-text-muted); font-size: 12px; }
.av { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: #d9dcf3; color: var(--sn-brand); font-size: 12px; font-weight: 800; }
.now__sec { font-size: 12px; color: var(--sn-text-muted); }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 12.8px; align-items: start; }
.grid .table td { vertical-align: middle; }
.small { width: 96px; }
.row { display: flex; align-items: center; gap: 8px; margin-top: 9.6px; }
.inline { width: auto; min-height: 25.6px; font-size: 12px; }
.mt { margin-top: 12.8px; }
@container sl-portal (max-width: 900px) { .grid { grid-template-columns: minmax(0, 1fr); } }
@container sl-portal (max-width: 640px) { .inline { min-height: 32px; } }
</style>
