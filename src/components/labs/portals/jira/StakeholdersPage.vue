<template>
  <div class="j-page sp">
    <nav class="j-crumbs" aria-label="Breadcrumbs">
      <a href="#" @click.prevent>Projects</a><span class="sep">/</span><a href="#" @click.prevent>Platform</a>
    </nav>
    <div class="j-header">
      <div>
        <h1 class="j-h1">Stakeholders</h1>
        <p class="j-muted sp__sub">Power / interest map. High-power, high-interest stakeholders who have not heard from you in two sprints lose confidence — and then escalate.</p>
      </div>
      <button type="button" class="j-btn j-btn--primary" @click="openAdd">Add stakeholder</button>
    </div>

    <section class="sp__grid" aria-label="Power interest grid">
      <span class="sp__axis sp__axis--y">Power</span>
      <template v-for="power in ['high', 'medium', 'low']" :key="power">
        <span class="sp__rowlabel">{{ cap(power) }}</span>
        <div v-for="interest in ['low', 'medium', 'high']" :key="power + interest" class="sp__box"
             :class="'is-' + boxTone(power, interest)">
          <span class="sp__advice">{{ advice(power, interest) }}</span>
          <button v-for="row in at(power, interest)" :key="row.id" type="button" class="sp__chip"
                  :class="'is-' + statusTone(row.status)" :title="`${row.name} — sentiment ${row.sentiment}`"
                  @click="selected = row.id">
            <JiraAvatar :name="row.name" :size="24" :title="false" /> {{ shortName(row.name) }}
          </button>
        </div>
      </template>
      <span /><span /><span v-for="i in ['Low', 'Medium', 'High']" :key="i" class="sp__collabel">{{ i }}</span>
      <span class="sp__axis sp__axis--x">Interest</span>
    </section>

    <div class="j-table-wrap">
      <table class="j-table">
        <thead><tr><th>Name</th><th>Role</th><th>Power</th><th>Interest</th><th>Confidence</th><th>Last contact</th>
          <th>Updates</th><th>Status</th><th><span class="sp__sr">Actions</span></th></tr></thead>
        <tbody>
          <tr v-for="row in holders" :key="row.id" :class="{ 'is-selected': selected === row.id }">
            <td class="j-nowrap"><button type="button" class="sp__name" @click="selected = row.id">
              <JiraAvatar :name="row.name" :size="24" /> {{ row.name }}</button></td>
            <td>{{ row.role }}</td>
            <td>{{ cap(row.power) }}</td>
            <td>{{ cap(row.interest) }}</td>
            <td><div class="sp__conf"><div class="j-progress" :class="'j-progress--' + barTone(row.sentiment)"><span :style="{ width: row.sentiment + '%' }" /></div>
              <span class="j-small">{{ row.sentiment }}</span></div></td>
            <td class="j-nowrap" :class="{ 'sp__stale': row.since >= 2 && row.power === 'high' }">{{ sinceLabel(row.since) }}</td>
            <td>{{ row.briefs }}</td>
            <td><span class="j-lozenge" :class="'j-lozenge--' + statusTone(row.status)">{{ row.status }}</span></td>
            <td class="j-nowrap">
              <button type="button" class="j-btn j-btn--compact" @click="openBrief(row)">Log contact</button>
              <JiraDropdown :items="menu(row)" label="Actions" align="right" trigger-class="j-btn j-btn--subtle j-btn--icon j-btn--compact"
                            @select="v => onMenu(row, v)">
                <template #trigger><JiraIcon name="more" /></template>
              </JiraDropdown>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section v-if="current" ref="detailEl" class="sp__detail">
      <header class="sp__detail-head">
        <JiraAvatar :name="current.name" :size="40" />
        <div><h2 class="j-h2 sp__detail-name">{{ current.name }}</h2><span class="j-muted">{{ current.role }} · {{ cap(current.power) }} power / {{ cap(current.interest) }} interest</span></div>
        <span class="sp__spacer" />
        <button type="button" class="j-btn j-btn--subtle j-btn--icon" aria-label="Close" @click="selected = ''"><JiraIcon name="close" /></button>
      </header>
      <p><strong>What they want:</strong> {{ current.wants || '—' }}</p>
      <h3 class="j-h3">Contact log</h3>
      <ol class="sp__log">
        <li v-for="(b, i) in [...(current.briefings || [])].reverse()" :key="i"><span class="j-small">Sprint {{ b.sprint }}</span> {{ b.message }}</li>
        <li v-if="!(current.briefings || []).length" class="j-muted">No contact logged yet.</li>
      </ol>
      <button type="button" class="j-btn j-btn--primary" @click="openBrief(current)">Log contact</button>
    </section>

    <JiraModal v-if="brief" :title="`Log contact with ${brief.name}`" width="small" @close="brief = null">
      <form id="sp-brief" @submit.prevent="saveBrief">
        <div class="j-field"><label class="j-label" for="sp-msg">Update shared<span class="j-req">*</span></label>
          <textarea id="sp-msg" v-model="brief.message" class="j-textarea" rows="4" autofocus
                    placeholder="What did you tell them? Dates, risks, decisions, asks." /></div>
        <p class="j-small">They want: {{ brief.wants }}</p>
      </form>
      <template #footer>
        <button type="button" class="j-btn j-btn--subtle" @click="brief = null">Cancel</button>
        <button type="submit" form="sp-brief" class="j-btn j-btn--primary" :disabled="!brief.message.trim()">Log contact</button>
      </template>
    </JiraModal>

    <JiraModal v-if="form" :title="form.id ? `Edit ${form.original.name}` : 'Add stakeholder'" @close="form = null">
      <form id="sp-form" @submit.prevent="saveForm">
        <div class="j-grid2">
          <div class="j-field"><label class="j-label" for="sp-name">Name<span class="j-req">*</span></label>
            <input id="sp-name" v-model="form.name" class="j-input" maxlength="80" autofocus /></div>
          <div class="j-field"><label class="j-label" for="sp-role">Role</label>
            <input id="sp-role" v-model="form.role" class="j-input" maxlength="80" /></div>
          <div class="j-field"><label class="j-label" for="sp-power">Power</label>
            <select id="sp-power" v-model="form.power" class="j-select"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div class="j-field"><label class="j-label" for="sp-int">Interest</label>
            <select id="sp-int" v-model="form.interest" class="j-select"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
        </div>
        <div class="j-field"><label class="j-label" for="sp-wants">What they want</label>
          <textarea id="sp-wants" v-model="form.wants" class="j-textarea" rows="2" /></div>
      </form>
      <template #footer>
        <button type="button" class="j-btn j-btn--subtle" @click="form = null">Cancel</button>
        <button type="submit" form="sp-form" class="j-btn j-btn--primary" :disabled="!form.name.trim()">{{ form.id ? 'Save' : 'Add' }}</button>
      </template>
    </JiraModal>
  </div>
</template>

<script setup lang="ts">
/** Stakeholders: the power/interest grid, the contact clock, and CRUD through `mgr stakeholder`. */
import { computed, nextTick, ref, watch } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import JiraModal from './JiraModal.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import { sinceLabel } from './jiraKit';
import { useJira } from './useJira';

interface Holder { id: string; name: string; role: string; power: string; interest: string; sentiment: number;
  since: number; briefs: number; wants: string; status: string; briefings: { sprint: number; message: string }[] }

const { ctx } = useJira();
const holders = computed(() => rows<Holder>(ctx.view.value, 'stakeholders'));
const selected = ref('');
const current = computed(() => holders.value.find(h => h.id === selected.value) || null);
const detailEl = ref<HTMLElement | null>(null);
watch(selected, id => { if (id) nextTick(() => detailEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); });

const SCALE: Record<string, number> = { low: 1, medium: 2, high: 3 };
const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : '';
const shortName = (name: string) => name.replace(/\s*\(.*\)\s*/, '').split(' ')[0] || name;
const at = (power: string, interest: string) => holders.value.filter(h => h.power === power && h.interest === interest);
const boxTone = (p: string, i: string) => (SCALE[p] + SCALE[i] >= 5 ? 'manage' : SCALE[p] >= 2 && SCALE[i] <= 2 ? 'satisfy' : SCALE[i] >= 2 ? 'inform' : 'monitor');
function advice(p: string, i: string) {
  const t = boxTone(p, i);
  return t === 'manage' ? 'Manage closely' : t === 'satisfy' ? 'Keep satisfied' : t === 'inform' ? 'Keep informed' : 'Monitor';
}
const statusTone = (s: string) => s === 'healthy' ? 'success' : s === 'at risk' ? 'danger' : 'warning';
const barTone = (n: number) => n >= 60 ? 'green' : n < 45 ? 'red' : 'yellow';

const brief = ref<{ id: string; name: string; wants: string; message: string } | null>(null);
function openBrief(row: Holder) { brief.value = { id: row.id, name: row.name, wants: row.wants, message: '' }; }
async function saveBrief() {
  const b = brief.value!;
  const result = await ctx.exec(cli(['mgr', 'stakeholder', 'brief', b.id], { '--message': b.message.trim() }),
                                { success: `Contact logged with ${b.name}` });
  if (result.ok) brief.value = null;
}

const form = ref<Record<string, any> | null>(null);
function openAdd() { form.value = { id: '', name: '', role: '', power: 'medium', interest: 'medium', wants: '' }; }
async function saveForm() {
  const f = form.value!;
  if (!f.id) {
    const result = await ctx.exec(cli(['mgr', 'stakeholder', 'add'], { '--name': f.name.trim(), '--role': f.role.trim(),
      '--power': f.power, '--interest': f.interest, '--wants': f.wants.trim() }), { success: `${f.name.trim()} added` });
    if (result.ok) form.value = null;
    return;
  }
  const o = f.original as Holder;
  const flags: Record<string, string> = {};
  for (const key of ['name', 'role', 'wants'] as const) if (f[key].trim() && f[key].trim() !== o[key]) flags['--' + key] = f[key].trim();
  for (const key of ['power', 'interest'] as const) if (f[key] !== o[key]) flags['--' + key] = f[key];
  if (!Object.keys(flags).length) { form.value = null; return; }
  const result = await ctx.exec(cli(['mgr', 'stakeholder', 'edit', f.id], flags), { success: `${o.name} updated` });
  if (result.ok) form.value = null;
}

function menu(row: Holder): DropItem[] {
  return [{ label: 'Edit', value: 'edit' }, { label: 'View contact log', value: 'view' },
    { label: 'Remove', value: 'remove', danger: true, disabled: row.sentiment < 45, hint: 'At risk — brief them first' }];
}
async function onMenu(row: Holder, value: string) {
  if (value === 'edit') form.value = { id: row.id, name: row.name, role: row.role, power: row.power, interest: row.interest, wants: row.wants, original: row };
  else if (value === 'view') selected.value = row.id;
  else if (value === 'remove' && await ctx.confirm({ title: `Remove ${row.name}?`, danger: true, confirm: 'Remove',
    body: `${row.name} will be removed from the stakeholder map, with their contact log.` })) {
    const result = await ctx.exec(cli(['mgr', 'stakeholder', 'remove', row.id]), { success: `${row.name} removed` });
    if (result.ok && selected.value === row.id) selected.value = '';
  }
}
</script>

<style scoped>
.sp__sub { margin: 4px 0 0; max-width: 680px; }
.sp__grid { display: grid; grid-template-columns: 24px 64px repeat(3, minmax(120px, 1fr)); grid-template-rows: repeat(3, minmax(80px, auto)) 20px 20px; gap: 4px; margin-bottom: 24px; max-width: 820px; }
.sp__axis { font-size: 12px; font-weight: 653; color: var(--j-text-subtlest); text-transform: uppercase; }
.sp__axis--y { grid-row: 1 / span 3; writing-mode: vertical-rl; transform: rotate(180deg); align-self: center; justify-self: center; }
.sp__axis--x { grid-column: 3 / span 3; text-align: center; }
.sp__rowlabel { align-self: center; font-size: 12px; color: var(--j-text-subtle); }
.sp__collabel { text-align: center; font-size: 12px; color: var(--j-text-subtle); }
.sp__box { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 4px; padding: 8px; border-radius: 4px; }
.sp__box.is-manage { background: #FFECEB; } .sp__box.is-satisfy { background: #FFF5DB; }
.sp__box.is-inform { background: #E9F2FE; } .sp__box.is-monitor { background: var(--j-sunken); }
.sp__advice { width: 100%; font-size: 12px; font-weight: 653; color: var(--j-text-subtle); text-transform: uppercase; }
.sp__chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px 2px 2px; border: 0; border-radius: 12px; background: var(--j-surface); box-shadow: var(--j-card-shadow); font: inherit; font-size: 12px; color: var(--j-text); cursor: pointer; }
.sp__chip.is-danger { box-shadow: 0 0 0 2px #E2483D; }
.sp__chip:hover { background: #F8F8F8; }
.sp__name { display: inline-flex; align-items: center; gap: 8px; border: 0; background: none; padding: 0; font: inherit; color: var(--j-text); cursor: pointer; }
.sp__name:hover { color: var(--j-link); text-decoration: underline; }
.sp__conf { display: flex; align-items: center; gap: 8px; min-width: 110px; }
.sp__conf .j-progress { flex: 1; }
.sp__stale { color: var(--j-danger-text); font-weight: 600; }
.sp__detail { margin-top: 24px; padding: 16px; border: 1px solid var(--j-border); border-radius: 6px; max-width: 720px; }
.sp__detail-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.sp__detail-name { margin: 0; }
.sp__spacer { flex: 1; }
.sp__log { margin: 0 0 12px; padding-left: 18px; }
.sp__log li { margin-bottom: 6px; overflow-wrap: anywhere; }
.sp__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; text-overflow: ellipsis; }
@container sl-portal (max-width: 700px) {
  .sp__grid { grid-template-columns: 14px 44px repeat(3, minmax(0, 1fr)); gap: 3px; }
  .sp__box { padding: 6px; min-width: 0; }
  .sp__advice { overflow-wrap: anywhere; }
  .sp__advice { font-size: 12px; line-height: 14px; }
  .sp__chip { min-height: 28px; }
  .sp__name { min-height: 32px; }
}
</style>
