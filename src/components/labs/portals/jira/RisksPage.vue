<template>
  <div class="j-page rp">
    <nav class="j-crumbs" aria-label="Breadcrumbs">
      <a href="#" @click.prevent>Projects</a><span class="sep">/</span><a href="#" @click.prevent>Platform</a>
    </nav>
    <div class="j-header">
      <div>
        <h1 class="j-h1">Risks</h1>
        <p class="j-muted rp__sub">RAID register — risks, assumptions, issues and dependencies. An entry with no owner or no due date never moves.</p>
      </div>
      <button type="button" class="j-btn j-btn--primary" @click="openCreate">Create</button>
    </div>

    <div class="rp__top">
      <section class="rp__heat" aria-label="Risk heat map">
        <h2 class="j-h3">Heat map <span class="j-small">open risks · impact × likelihood</span></h2>
        <div class="rp__heat-grid">
          <span class="rp__axis rp__axis--y">Impact</span>
          <template v-for="impact in ['high', 'medium', 'low']" :key="impact">
            <span class="rp__rowlabel">{{ cap(impact) }}</span>
            <button v-for="likelihood in ['low', 'medium', 'high']" :key="impact + likelihood" type="button"
                    class="rp__cell" :class="['is-' + heatTone(impact, likelihood), { 'is-picked': cell === impact + '/' + likelihood }]"
                    :aria-label="`${cap(impact)} impact, ${likelihood} likelihood: ${heat(impact, likelihood)} open`"
                    @click="cell = cell === impact + '/' + likelihood ? '' : impact + '/' + likelihood">
              {{ heat(impact, likelihood) || '' }}
            </button>
          </template>
          <span /><span />
          <span v-for="likelihood in ['Low', 'Medium', 'High']" :key="likelihood" class="rp__collabel">{{ likelihood }}</span>
          <span class="rp__axis rp__axis--x">Likelihood</span>
        </div>
      </section>
      <section class="rp__stats">
        <div class="rp__stat"><span class="rp__num">{{ open.length }}</span><span class="j-small">Open</span></div>
        <div class="rp__stat"><span class="rp__num rp__num--bad">{{ uncontrolled }}</span><span class="j-small">No owner or date</span></div>
        <div class="rp__stat"><span class="rp__num rp__num--good">{{ mitigated }}</span><span class="j-small">Mitigated</span></div>
        <div class="rp__stat"><span class="rp__num rp__num--bad">{{ materialised }}</span><span class="j-small">Materialised</span></div>
      </section>
    </div>

    <div class="rp__filters">
      <div class="j-tabs rp__tabs" role="tablist">
        <button v-for="t in tabs" :key="t.id" type="button" role="tab" class="j-tab" :class="{ 'is-active': tab === t.id }"
                :aria-selected="tab === t.id" @click="tab = t.id">{{ t.label }}</button>
      </div>
      <button v-if="cell" type="button" class="j-btn j-btn--subtle" @click="cell = ''">Clear heat map filter ({{ cell }})</button>
    </div>

    <DecisionsPanel v-if="tab === 'decisions'" />
    <div v-else class="j-table-wrap">
      <table class="j-table">
        <thead><tr><th>Key</th><th>Type</th><th>Summary</th><th>Rating</th><th>Owner</th><th>Due date</th>
          <th>Mitigation</th><th>Status</th><th>Age</th><th><span class="rp__sr">Actions</span></th></tr></thead>
        <tbody>
          <tr v-for="row in shown" :key="row.id" :class="{ 'is-selected': selected === row.id }">
            <td class="j-nowrap"><button type="button" class="j-link" @click="openEdit(row)">{{ row.id }}</button></td>
            <td class="j-nowrap"><span class="rp__type"><JiraIcon :name="row.kind" kind="type" /> {{ cap(row.kind) }}</span></td>
            <td class="rp__summary"><button type="button" class="rp__title" @click="openEdit(row)">{{ row.title }}</button></td>
            <td class="j-nowrap"><span class="rp__rating" :class="'is-' + heatTone(row.impact, row.likelihood)"
                  :title="`Impact ${row.impact}, likelihood ${row.likelihood}`">{{ score(row) }}</span>
              <span class="j-small">{{ cap(row.impact) }}/{{ cap(row.likelihood) }}</span></td>
            <td class="j-nowrap"><span v-if="row.owner" class="rp__owner"><JiraAvatar :name="row.owner" :size="24" /> {{ row.owner }}</span>
              <span v-else class="j-lozenge j-lozenge--danger">No owner</span></td>
            <td class="j-nowrap"><span v-if="row.due">{{ row.due }}</span><span v-else class="j-lozenge j-lozenge--warning">No date</span></td>
            <td class="rp__mit">{{ row.mitigation || '—' }}</td>
            <td><span class="j-lozenge" :class="'j-lozenge--' + statusTone(row.status)">{{ row.status }}</span></td>
            <td>{{ row.age }}</td>
            <td class="j-nowrap">
              <JiraDropdown :items="rowMenu(row)" label="Actions" align="right" trigger-class="j-btn j-btn--subtle j-btn--icon j-btn--compact"
                            @select="v => onMenu(row, v)">
                <template #trigger><JiraIcon name="more" /></template>
              </JiraDropdown>
            </td>
          </tr>
          <tr v-if="!shown.length"><td colspan="10"><div class="j-empty rp__empty"><h3>No entries</h3>
            <p>The register is empty. That is not the same as having no risks.</p></div></td></tr>
        </tbody>
      </table>
    </div>

    <JiraModal v-if="form" :title="form.id ? `Edit ${form.id}` : 'Create risk'" @close="form = null">
      <form id="rp-form" @submit.prevent="save">
        <div class="j-grid2">
          <div class="j-field"><label class="j-label" for="rp-kind">Type<span class="j-req">*</span></label>
            <select id="rp-kind" v-model="form.kind" class="j-select" :disabled="Boolean(form.id)">
              <option value="risk">Risk</option><option value="issue">Issue</option>
              <option value="assumption">Assumption</option><option value="dependency">Dependency</option></select>
            <span v-if="form.id" class="j-help">The type is part of the key ({{ form.id }}) and cannot change.</span></div>
          <div class="j-field"><label class="j-label" for="rp-owner">Owner</label>
            <select id="rp-owner" v-model="form.owner" class="j-select">
              <option value="">{{ form.id ? 'Keep current owner' : 'No owner' }}</option>
              <option v-for="p in team" :key="p.id" :value="p.id">{{ p.name }}</option></select></div>
        </div>
        <div class="j-field"><label class="j-label" for="rp-title">Summary<span class="j-req">*</span></label>
          <input id="rp-title" v-model="form.title" class="j-input" maxlength="200" autofocus /></div>
        <div class="j-grid2">
          <div class="j-field"><label class="j-label" for="rp-impact">Impact</label>
            <select id="rp-impact" v-model="form.impact" class="j-select"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div class="j-field"><label class="j-label" for="rp-like">Likelihood</label>
            <select id="rp-like" v-model="form.likelihood" class="j-select"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div class="j-field"><label class="j-label" for="rp-due">Due date</label>
            <input id="rp-due" v-model="form.due" class="j-input" type="date" /></div>
        </div>
        <div class="j-field"><label class="j-label" for="rp-mit">Mitigation</label>
          <textarea id="rp-mit" v-model="form.mitigation" class="j-textarea" rows="3" placeholder="What will reduce the likelihood or the impact?" /></div>
        <div v-if="gaps.length" class="j-msg j-msg--warning"><JiraIcon name="warning" :size="20" />
          <div>{{ gaps.join(', ') }}. An entry with no owner or no date never moves — you will watch it stay open.</div></div>
      </form>
      <template #footer>
        <button type="button" class="j-btn j-btn--subtle" @click="form = null">Cancel</button>
        <button type="submit" form="rp-form" class="j-btn j-btn--primary" :disabled="!form.title.trim()">{{ form.id ? 'Save' : 'Create' }}</button>
      </template>
    </JiraModal>
  </div>
</template>

<script setup lang="ts">
/** The RAID register with a heat map: create, edit, close, reopen, delete through `mgr raid`. */
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import JiraModal from './JiraModal.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import DecisionsPanel from './DecisionsPanel.vue';
import { useJira } from './useJira';

interface Raid { id: string; kind: string; title: string; owner: string; owner_id: string; impact: string;
  likelihood: string; due: string; mitigation: string; status: string; age: number; controlled: boolean }

const { ctx, team } = useJira();
const all = computed(() => rows<Raid>(ctx.view.value, 'raid'));
const open = computed(() => all.value.filter(r => r.status === 'open'));
const uncontrolled = computed(() => open.value.filter(r => !r.owner || !r.due).length);
const mitigated = computed(() => all.value.filter(r => r.status === 'mitigated').length);
const materialised = computed(() => all.value.filter(r => r.status === 'materialised').length);

const tab = ref('open');
const cell = ref('');
const selected = ref('');
const tabs = [{ id: 'open', label: 'Open' }, { id: 'all', label: 'All' }, { id: 'risk', label: 'Risks' },
  { id: 'assumption', label: 'Assumptions' }, { id: 'issue', label: 'Issues' }, { id: 'dependency', label: 'Dependencies' },
  { id: 'decisions', label: 'Decisions' }];
const SCALE: Record<string, number> = { low: 1, medium: 2, high: 3 };

const shown = computed(() => all.value.filter(row => {
  if (tab.value === 'open' && row.status !== 'open') return false;
  if (!['open', 'all'].includes(tab.value) && row.kind !== tab.value) return false;
  if (cell.value && `${row.impact}/${row.likelihood}` !== cell.value) return false;
  return true;
}));

const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : '';
const score = (row: Raid) => (SCALE[row.impact] || 0) * (SCALE[row.likelihood] || 0);
function heat(impact: string, likelihood: string) {
  return open.value.filter(r => r.kind === 'risk' && r.impact === impact && r.likelihood === likelihood).length;
}
function heatTone(impact: string, likelihood: string) {
  const s = (SCALE[impact] || 0) * (SCALE[likelihood] || 0);
  return s >= 6 ? 'high' : s >= 3 ? 'medium' : 'low';
}
function statusTone(status: string) {
  return status === 'open' ? 'doing' : status === 'mitigated' ? 'success' : status === 'materialised' ? 'danger' : 'default';
}

const form = ref<Record<string, any> | null>(null);
const gaps = computed(() => {
  if (!form.value || form.value.id) return [];
  const out: string[] = [];
  if (!form.value.owner) out.push('No owner');
  if (!form.value.due) out.push('no due date');
  if (!form.value.mitigation.trim()) out.push('no mitigation');
  return out;
});

function openCreate() {
  form.value = { id: '', kind: 'risk', title: '', owner: '', impact: 'medium', likelihood: 'medium', due: '', mitigation: '' };
}
function openEdit(row: Raid) {
  selected.value = row.id;
  form.value = { id: row.id, kind: row.kind, title: row.title, owner: row.owner_id || '', impact: row.impact,
                 likelihood: row.likelihood, due: row.due, mitigation: row.mitigation, original: row };
}

async function save() {
  const f = form.value!;
  let result;
  if (!f.id) {
    result = await ctx.exec(cli(['mgr', 'raid', 'add'], { '--kind': f.kind, '--title': f.title.trim(), '--owner': f.owner,
      '--impact': f.impact, '--likelihood': f.likelihood, '--mitigation': f.mitigation.trim(), '--due': f.due }),
    { success: '' });
    if (result.ok) {
      const lines = String(result.output || '').split('\n').map(l => l.trim()).filter(Boolean);
      ctx.flag(lines.length > 1 ? 'warning' : 'success', lines[0] || 'Created', lines.slice(1).join(' '));
    }
  } else {
    const o = f.original as Raid;
    const flags: Record<string, string> = {};
    if (f.title.trim() !== o.title) flags['--title'] = f.title.trim();
    if (f.impact !== o.impact) flags['--impact'] = f.impact;
    if (f.likelihood !== o.likelihood) flags['--likelihood'] = f.likelihood;
    if (f.owner && f.owner !== o.owner_id) flags['--owner'] = f.owner;
    if (f.due && f.due !== o.due) flags['--due'] = f.due;
    if (f.mitigation.trim() && f.mitigation.trim() !== o.mitigation) flags['--mitigation'] = f.mitigation.trim();
    if (!Object.keys(flags).length) { form.value = null; return; }
    result = await ctx.exec(cli(['mgr', 'raid', 'edit', f.id], flags), { success: `${f.id} updated` });
  }
  if (result.ok) form.value = null;
}

function rowMenu(row: Raid): DropItem[] {
  return [
    { label: 'Edit', value: 'edit' },
    row.status === 'open' ? { label: 'Close', value: 'close' }
      : { label: 'Reopen', value: 'reopen', disabled: row.status === 'materialised', hint: 'It became an incident' },
    { label: 'Delete', value: 'delete', danger: true, disabled: row.status === 'open', hint: 'Close it first' },
  ];
}

async function onMenu(row: Raid, value: string) {
  if (value === 'edit') openEdit(row);
  else if (value === 'close') await ctx.exec(cli(['mgr', 'raid', 'close', row.id]), { success: `${row.id} closed` });
  else if (value === 'reopen') await ctx.exec(cli(['mgr', 'raid', 'reopen', row.id]), { success: `${row.id} reopened` });
  else if (value === 'delete' && await ctx.confirm({ title: `Delete ${row.id}?`, danger: true, confirm: 'Delete',
    body: `"${row.title}" will be removed from the register permanently.` })) {
    await ctx.exec(cli(['mgr', 'raid', 'remove', row.id]), { success: `${row.id} deleted` });
  }
}
</script>

<style scoped>
.rp__sub { margin: 4px 0 0; max-width: 640px; }
.rp__top { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 16px; }
.rp__heat { padding: 16px; border: 1px solid var(--j-border); border-radius: 6px; }
.rp__heat-grid { display: grid; grid-template-columns: 24px 64px repeat(3, 56px); grid-auto-rows: 40px; gap: 4px; align-items: center; }
.rp__axis { font-size: 11px; color: var(--j-text-subtlest); font-weight: 653; text-transform: uppercase; }
.rp__axis--y { grid-row: 1 / span 3; writing-mode: vertical-rl; transform: rotate(180deg); justify-self: center; }
.rp__axis--x { grid-column: 3 / span 3; text-align: center; }
.rp__rowlabel, .rp__collabel { font-size: 12px; color: var(--j-text-subtle); }
.rp__collabel { text-align: center; }
.rp__cell { height: 40px; border: 0; border-radius: 4px; font: inherit; font-weight: 700; cursor: pointer; color: #292A2E; }
.rp__cell.is-low { background: #BAF3DB; }
.rp__cell.is-medium { background: #F8E6A0; }
.rp__cell.is-high { background: #FFD5D2; color: #AE2E24; }
.rp__cell:hover { filter: brightness(0.95); }
.rp__cell.is-picked { box-shadow: inset 0 0 0 2px var(--j-brand); }
.rp__stats { display: grid; grid-template-columns: repeat(2, minmax(120px, 1fr)); gap: 8px; align-content: start; }
.rp__stat { display: flex; flex-direction: column; padding: 12px 16px; border: 1px solid var(--j-border); border-radius: 6px; }
.rp__num { font-size: 24px; line-height: 28px; font-weight: 653; }
.rp__num--bad { color: var(--j-danger-text); }
.rp__num--good { color: var(--j-success-text); }
.rp__filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rp__tabs { flex: 1; margin-bottom: 8px; }
.rp__type, .rp__owner { display: inline-flex; align-items: center; gap: 6px; }
.rp__summary { min-width: 200px; }
.rp__title { border: 0; background: none; padding: 0; font: inherit; color: var(--j-text); text-align: left; cursor: pointer; }
.rp__title:hover { color: var(--j-link); text-decoration: underline; }
.rp__rating { display: inline-grid; place-items: center; width: 24px; height: 20px; margin-right: 6px; border-radius: 3px; font-weight: 700; font-size: 12px; }
.rp__rating.is-low { background: #BAF3DB; color: #216E4E; }
.rp__rating.is-medium { background: #F8E6A0; color: #7F5F01; }
.rp__rating.is-high { background: #FFD5D2; color: #AE2E24; }
.rp__mit { min-width: 160px; max-width: 280px; color: var(--j-text-subtle); }
.rp__empty { padding: 24px; }
.rp__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
