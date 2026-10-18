<template>
  <div class="j-page ip" :class="{ 'has-panel': current }">
    <div class="ip__list">
      <nav class="j-crumbs" aria-label="Breadcrumbs">
        <a href="#" @click.prevent>Projects</a><span class="sep">/</span><a href="#" @click.prevent>Platform</a>
        <span class="sep">/</span><span>Operations</span>
      </nav>
      <div class="j-header">
        <h1 class="j-h1">Incidents</h1>
        <button type="button" class="j-btn j-btn--primary" @click="openCreate">Create incident</button>
      </div>
      <div class="ip__summary">
        <div class="ip__stat"><span class="ip__num" :class="{ 'is-bad': openCount }">{{ openCount }}</span><span class="j-small">Open</span></div>
        <div class="ip__stat"><span class="ip__num">{{ avg('mtta') }}</span><span class="j-small">Mean time to acknowledge</span></div>
        <div class="ip__stat"><span class="ip__num">{{ avg('mttr') }}</span><span class="j-small">Mean time to resolve</span></div>
        <div class="ip__stat"><span class="ip__num">{{ withPm }}/{{ resolved }}</span><span class="j-small">Resolved with a postmortem</span></div>
      </div>
      <div class="j-tabs" role="tablist">
        <button v-for="t in tabs" :key="t.id" type="button" role="tab" class="j-tab" :class="{ 'is-active': tab === t.id }"
                :aria-selected="tab === t.id" @click="tab = t.id">{{ t.label }}</button>
      </div>
      <div class="j-table-wrap">
        <table class="j-table">
          <thead><tr><th>Key</th><th>Summary</th><th>Priority</th><th>Status</th><th>MTTA</th><th>MTTR</th><th>Postmortem</th><th>Created</th></tr></thead>
          <tbody>
            <tr v-for="row in shown" :key="row.id" class="ip__row" :class="{ 'is-selected': row.id === selected }"
                tabindex="0" @click="selected = row.id" @keydown.enter="selected = row.id">
              <td class="j-nowrap"><span class="ip__key"><JiraIcon name="incident" kind="type" /> {{ row.id }}</span></td>
              <td class="ip__title">{{ row.title }}<div v-if="row.source" class="j-small">from {{ row.source }}</div></td>
              <td class="j-nowrap"><span class="ip__sev" :class="'is-s' + row.sev">{{ SEV[row.sev] || 'P' + row.sev }}</span></td>
              <td><span class="j-lozenge" :class="'j-lozenge--' + tone(row.status)">{{ label(row.status) }}</span></td>
              <td class="j-nowrap">{{ mins(row.mtta) }}</td>
              <td class="j-nowrap">{{ mins(row.mttr) }}</td>
              <td class="j-nowrap"><span v-if="row.postmortem" class="j-lozenge" :class="row.blameless === false ? 'j-lozenge--danger' : 'j-lozenge--success'">{{ row.blameless === false ? 'Blameful' : 'Written' }}</span>
                <span v-else class="j-small">—</span></td>
              <td class="j-nowrap">Sprint {{ row.sprint }}</td>
            </tr>
            <tr v-if="!shown.length"><td colspan="8"><div class="j-empty"><h3>No incidents</h3><p>Nothing is on fire. Enjoy it.</p></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <aside v-if="current" class="ip__panel" aria-label="Incident details">
      <header class="ip__panel-head">
        <span class="ip__key"><JiraIcon name="incident" kind="type" /> {{ current.id }}</span>
        <span class="ip__spacer" />
        <button type="button" class="j-btn j-btn--subtle j-btn--icon" aria-label="Edit incident" title="Edit" @click="openEdit"><JiraIcon name="pencil" /></button>
        <button type="button" class="j-btn j-btn--subtle j-btn--icon" aria-label="Close panel" @click="selected = ''"><JiraIcon name="close" /></button>
      </header>
      <h2 class="ip__panel-title">{{ current.title }}</h2>
      <div class="ip__badges">
        <span class="j-lozenge" :class="'j-lozenge--' + tone(current.status)">{{ label(current.status) }}</span>
        <span class="ip__sev" :class="'is-s' + current.sev">{{ SEV[current.sev] }}</span>
        <span class="j-small">Clock +{{ current.clock }} min</span>
      </div>

      <div class="j-actions ip__steps">
        <button v-for="step in steps" :key="step.verb" type="button" class="j-btn"
                :class="{ 'j-btn--primary': step.next }" :disabled="step.done"
                @click="openStep(step.verb)">{{ step.label }}</button>
      </div>
      <form v-if="stepForm" class="ip__stepform" @submit.prevent="runStep">
        <label class="j-label" for="ip-after">Minutes since the last update<span class="j-req">*</span></label>
        <div class="ip__inline">
          <input id="ip-after" v-model="stepForm.after" class="j-input" type="number" min="0" autofocus />
          <button type="submit" class="j-btn j-btn--primary">{{ stepLabel(stepForm.verb) }}</button>
          <button type="button" class="j-btn j-btn--subtle" @click="stepForm = null">Cancel</button>
        </div>
        <span class="j-help">The incident clock adds this to +{{ current.clock }} min. MTTA and MTTR are arithmetic over these minutes.</span>
      </form>

      <h3 class="j-h3 ip__gap">Timeline</h3>
      <ol class="ip__timeline">
        <li><span class="ip__dot" />Opened <span class="j-small">+0 min · Sprint {{ current.sprint }}</span></li>
        <li v-if="current.ack !== null && current.ack !== undefined"><span class="ip__dot is-blue" />Acknowledged <span class="j-small">+{{ current.ack }} min</span></li>
        <li v-if="current.mitigated !== null && current.mitigated !== undefined"><span class="ip__dot is-yellow" />Mitigated <span class="j-small">+{{ current.mitigated }} min</span></li>
        <li v-if="current.resolved !== null && current.resolved !== undefined"><span class="ip__dot is-green" />Resolved <span class="j-small">+{{ current.resolved }} min</span></li>
      </ol>

      <h3 class="j-h3 ip__gap">Postmortem</h3>
      <div v-if="current.postmortem && !editingPm" class="ip__pm">
        <p><strong>Cause:</strong> {{ current.cause }}</p>
        <p><strong>Blameless:</strong> {{ current.blameless === false ? 'No — the cause names a person' : (current.blameless ? 'Yes' : 'Not stated') }}</p>
        <p><strong>Actions:</strong></p>
        <ul><li v-for="(a, i) in current.action_list" :key="i">{{ a }}</li><li v-if="!current.action_list.length" class="j-muted">None — this incident will recur.</li></ul>
        <button type="button" class="j-btn" @click="startPm">Rewrite postmortem</button>
      </div>
      <form v-else class="ip__pmform" @submit.prevent="savePm">
        <div v-if="current.status !== 'resolved'" class="j-msg"><JiraIcon name="info" :size="20" />
          <div>Postmortems are usually written once the incident is resolved.</div></div>
        <div class="j-field"><label class="j-label" for="ip-cause">What caused it?<span class="j-req">*</span></label>
          <textarea id="ip-cause" v-model="pm.cause" class="j-textarea" rows="3" placeholder="The system condition that let this happen — never a person." /></div>
        <label class="j-check ip__gapb"><input v-model="pm.blameless" type="checkbox" /> This postmortem is blameless</label>
        <div class="j-field"><span class="j-label">Actions</span>
          <div v-for="(a, i) in pm.actions" :key="i" class="ip__inline ip__action">
            <input v-model="pm.actions[i]" class="j-input" :aria-label="'Action ' + (i + 1)" placeholder="A change that stops it happening again" />
            <button type="button" class="j-btn j-btn--subtle j-btn--icon" :aria-label="'Remove action ' + (i + 1)" @click="pm.actions.splice(i, 1)"><JiraIcon name="trash" /></button>
          </div>
          <button type="button" class="j-btn j-btn--subtle ip__addaction" @click="pm.actions.push('')"><JiraIcon name="plus" /> Add action</button>
          <span class="j-help">Without an action nothing stops the recurrence.</span></div>
        <div class="j-actions"><button type="submit" class="j-btn j-btn--primary" :disabled="!pm.cause.trim()">Save postmortem</button>
          <button v-if="editingPm" type="button" class="j-btn j-btn--subtle" @click="editingPm = false">Cancel</button></div>
      </form>
    </aside>

    <JiraModal v-if="form" :title="form.id ? `Edit ${form.id}` : 'Create incident'" width="small" @close="form = null">
      <form id="ip-form" @submit.prevent="saveForm">
        <div class="j-field"><label class="j-label" for="ip-title">Summary<span class="j-req">*</span></label>
          <input id="ip-title" v-model="form.title" class="j-input" maxlength="160" autofocus /></div>
        <div class="j-field"><label class="j-label" for="ip-sev">Priority<span class="j-req">*</span></label>
          <select id="ip-sev" v-model="form.sev" class="j-select" :disabled="form.resolved">
            <option :value="1">P1 — Critical (Sev1)</option><option :value="2">P2 — High (Sev2)</option>
            <option :value="3">P3 — Medium (Sev3)</option><option :value="4">P4 — Low (Sev4)</option></select>
          <span v-if="form.resolved" class="j-help">A resolved incident's severity is part of the record.</span></div>
      </form>
      <template #footer>
        <button type="button" class="j-btn j-btn--subtle" @click="form = null">Cancel</button>
        <button type="submit" form="ip-form" class="j-btn j-btn--primary" :disabled="!form.title.trim()">{{ form.id ? 'Save' : 'Create' }}</button>
      </template>
    </JiraModal>
  </div>
</template>

<script setup lang="ts">
/** A Jira Service Management incident queue over `mgr incident`. */
import { computed, reactive, ref, watch } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import JiraIcon from './JiraIcon.vue';
import JiraModal from './JiraModal.vue';
import { useJira } from './useJira';

interface Incident { id: string; title: string; sev: number; severity: string; status: string; sprint: number;
  mtta: number | null; mttr: number | null; ack: number | null; mitigated: number | null; resolved: number | null;
  clock: number; postmortem: boolean; blameless: boolean | null; cause: string; action_list: string[]; source: string }

const SEV: Record<number, string> = { 1: 'P1 Critical', 2: 'P2 High', 3: 'P3 Medium', 4: 'P4 Low' };
const { ctx } = useJira();
const all = computed(() => rows<Incident>(ctx.view.value, 'incidents').map(r => ({
  ...r, sev: Number(r.sev || String(r.severity || '').replace(/\D/g, '') || 3), action_list: r.action_list || [],
})).reverse());

const tab = ref('open');
const tabs = [{ id: 'open', label: 'All open incidents' }, { id: 'all', label: 'All incidents' },
  { id: 'resolved', label: 'Resolved' }];
const shown = computed(() => all.value.filter(r => tab.value === 'all' || (tab.value === 'open'
  ? r.status !== 'resolved' : r.status === 'resolved')));
const openCount = computed(() => all.value.filter(r => r.status !== 'resolved').length);
const resolved = computed(() => all.value.filter(r => r.status === 'resolved').length);
const withPm = computed(() => all.value.filter(r => r.status === 'resolved' && r.postmortem).length);
const selected = ref('');
const current = computed(() => all.value.find(r => r.id === selected.value) || null);

const label = (s: string) => ({ open: 'Open', acknowledged: 'Acknowledged', mitigated: 'Mitigated', resolved: 'Resolved' } as Record<string, string>)[s] || s;
const tone = (s: string) => s === 'resolved' ? 'success' : s === 'open' ? 'danger' : s === 'mitigated' ? 'warning' : 'doing';
const mins = (n: number | null | undefined) => n === null || n === undefined ? '—' : `${n}m`;
function avg(key: 'mtta' | 'mttr') {
  const list = all.value.map(r => r[key]).filter((n): n is number => typeof n === 'number');
  return list.length ? `${Math.round(list.reduce((a, b) => a + b, 0) / list.length)}m` : '—';
}

const steps = computed(() => {
  const r = current.value!;
  const ack = r.ack !== null && r.ack !== undefined;
  const mit = r.mitigated !== null && r.mitigated !== undefined;
  const res = r.resolved !== null && r.resolved !== undefined;
  return [
    { verb: 'ack', label: 'Acknowledge', done: ack, next: !ack },
    { verb: 'mitigate', label: 'Mitigate', done: mit || res, next: ack && !mit && !res },
    { verb: 'resolve', label: 'Resolve', done: res, next: ack && !res },
  ];
});
const stepForm = ref<{ verb: string; after: string } | null>(null);
const stepLabel = (verb: string) => ({ ack: 'Acknowledge', mitigate: 'Mitigate', resolve: 'Resolve' } as Record<string, string>)[verb];
function openStep(verb: string) { stepForm.value = { verb, after: verb === 'ack' ? '5' : '15' }; }
async function runStep() {
  const f = stepForm.value!;
  const r = current.value!;
  const result = await ctx.exec(cli(['mgr', 'incident', f.verb, r.id], { '--after': String(f.after || '0') }), { success: '' });
  if (result.ok) {
    stepForm.value = null;
    const lines = String(result.output || '').split('\n').map(l => l.trim()).filter(Boolean);
    ctx.flag('success', lines[0] || `${r.id} updated`, lines.slice(1).join(' '));
  }
}

const editingPm = ref(false);
const pm = reactive<{ cause: string; blameless: boolean; actions: string[] }>({ cause: '', blameless: true, actions: [''] });
watch(selected, () => { editingPm.value = false; stepForm.value = null; resetPm(); });
function resetPm() {
  const r = current.value;
  pm.cause = r?.cause || '';
  pm.blameless = r ? r.blameless !== false : true;
  pm.actions = r && r.action_list.length ? [...r.action_list] : [''];
}
function startPm() { resetPm(); editingPm.value = true; }
async function savePm() {
  const r = current.value!;
  let command = cli(['mgr', 'incident', 'postmortem', r.id], { '--cause': pm.cause.trim(), '--blameless': pm.blameless });
  // Several actions are a repeated flag, one `--action` per action.
  for (const action of pm.actions.map(a => a.trim()).filter(Boolean)) command += ' ' + cli([], { '--action': action });
  const result = await ctx.exec(command, { success: '' });
  if (result.ok) {
    editingPm.value = false;
    const text = String(result.output || '');
    ctx.flag(/BLAMEFUL|NO ACTIONS/.test(text) ? 'warning' : 'success', `Postmortem saved for ${r.id}`,
             text.split('\n').slice(1).map(l => l.trim()).filter(Boolean).join(' '));
  }
}

const form = ref<{ id: string; title: string; sev: number; resolved: boolean; original?: Incident } | null>(null);
function openCreate() { form.value = { id: '', title: '', sev: 2, resolved: false }; }
function openEdit() {
  const r = current.value!;
  form.value = { id: r.id, title: r.title, sev: r.sev, resolved: r.status === 'resolved', original: r };
}
async function saveForm() {
  const f = form.value!;
  if (!f.id) {
    const result = await ctx.exec(cli(['mgr', 'incident', 'open'], { '--title': f.title.trim(), '--severity': String(f.sev) }),
                                  { success: '' });
    if (result.ok) {
      const match = String(result.output || '').match(/INC-\d+/);
      ctx.flag('success', `${match ? match[0] : 'Incident'} created`, 'The clock is running — acknowledge it.');
      if (match) selected.value = match[0];
      form.value = null;
    }
    return;
  }
  const flags: Record<string, string> = {};
  if (f.title.trim() !== f.original!.title) flags['--title'] = f.title.trim();
  if (!f.resolved && f.sev !== f.original!.sev) flags['--severity'] = String(f.sev);
  if (!Object.keys(flags).length) { form.value = null; return; }
  const result = await ctx.exec(cli(['mgr', 'incident', 'edit', f.id], flags), { success: `${f.id} updated` });
  if (result.ok) form.value = null;
}
</script>

<style scoped>
.ip { display: flex; gap: 24px; align-items: flex-start; }
.ip__list { flex: 1; min-width: 0; }
.ip__summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
.ip__stat { display: flex; flex-direction: column; padding: 12px 16px; border: 1px solid var(--j-border); border-radius: 6px; }
.ip__num { font-size: 24px; line-height: 28px; font-weight: 653; }
.ip__num.is-bad { color: var(--j-danger-text); }
.ip__row { cursor: pointer; }
.ip__key { display: inline-flex; align-items: center; gap: 6px; color: var(--j-link); font-weight: 500; }
.ip__title { min-width: 200px; }
.ip__sev { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.ip__sev::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #8590A2; }
.ip__sev.is-s1::before { background: #C9372C; } .ip__sev.is-s2::before { background: #E06C00; }
.ip__sev.is-s3::before { background: #E2B203; } .ip__sev.is-s4::before { background: #1868DB; }
.ip__panel { width: 380px; flex: none; position: sticky; top: 0; padding: 16px; border: 1px solid var(--j-border); border-radius: 6px; background: var(--j-surface); }
.ip__panel-head { display: flex; align-items: center; gap: 4px; }
.ip__spacer { flex: 1; }
.ip__panel-title { margin: 8px 0; font-size: 20px; line-height: 24px; font-weight: 653; overflow-wrap: anywhere; }
.ip__badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.ip__steps { margin-bottom: 8px; }
.ip__stepform { padding: 12px; margin-bottom: 8px; background: var(--j-sunken); border-radius: 4px; }
.ip__inline { display: flex; gap: 8px; align-items: center; margin: 4px 0; }
.ip__inline .j-input { flex: 1; }
.ip__gap { margin-top: 16px; }
.ip__gapb { margin-bottom: 12px; }
.ip__timeline { list-style: none; margin: 0; padding: 0 0 0 4px; border-left: 2px solid var(--j-border); }
.ip__timeline li { position: relative; padding: 4px 0 8px 16px; }
.ip__dot { position: absolute; left: -7px; top: 9px; width: 12px; height: 12px; border-radius: 50%; background: #C9372C; box-shadow: 0 0 0 2px var(--j-surface); }
.ip__dot.is-blue { background: #1868DB; } .ip__dot.is-yellow { background: #E2B203; } .ip__dot.is-green { background: #22A06B; }
.ip__pm p { margin: 0 0 6px; overflow-wrap: anywhere; }
.ip__pm ul { margin: 0 0 12px; padding-left: 20px; }
.ip__action .j-input { min-height: 32px; }
.ip__addaction { align-self: flex-start; }
@container sl-portal (max-width: 1100px) {
  .ip { flex-direction: column; }
  .ip__panel { width: auto; align-self: stretch; position: static; }
  .ip.has-panel .ip__panel { order: -1; }
}
@container sl-portal (max-width: 700px) { .ip__summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
