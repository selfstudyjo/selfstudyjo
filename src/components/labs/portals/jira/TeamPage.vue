<template>
  <div class="j-page tp">
    <nav class="j-crumbs" aria-label="Breadcrumbs">
      <a href="#" @click.prevent>Teams</a><span class="sep">/</span><span>{{ orgName }}</span>
    </nav>
    <div class="j-header">
      <div class="tp__team">
        <span class="tp__team-avatar" aria-hidden="true"><JiraIcon name="team" :size="24" /></span>
        <div>
          <h1 class="j-h1">{{ orgName }}</h1>
          <p class="j-muted tp__sub">{{ members.length }} members · {{ capacity }} story points of effective capacity this sprint</p>
        </div>
      </div>
    </div>

    <div class="j-tabs" role="tablist">
      <button type="button" role="tab" class="j-tab" :class="{ 'is-active': view === 'members' }" :aria-selected="view === 'members'" @click="view = 'members'">Members</button>
      <button type="button" role="tab" class="j-tab" :class="{ 'is-active': view === 'hiring' }" :aria-selected="view === 'hiring'" @click="view = 'hiring'">Hiring</button>
    </div>
    <HiringPanel v-if="view === 'hiring'" />
    <template v-else>
    <div class="j-table-wrap">
      <table class="j-table">
        <thead><tr><th>Name</th><th>Role</th><th>Capacity</th><th>Morale</th><th>Engagement</th><th>Growth</th>
          <th>Burnout</th><th>Flight risk</th><th>One-to-one</th><th>Feedback</th></tr></thead>
        <tbody>
          <tr v-for="p in members" :key="p.id" class="tp__row" :class="{ 'is-selected': selected === p.id, 'is-gone': p.status === 'gone' }"
              tabindex="0" @click="selected = p.id" @keydown.enter="selected = p.id">
            <td class="j-nowrap"><span class="tp__name"><JiraAvatar :name="p.name" :size="32" />
              <span><strong>{{ p.name }}</strong><span class="j-small tp__lvl">{{ p.level }}</span></span></span></td>
            <td>{{ p.role }}</td>
            <td class="j-nowrap" :title="`Nominal ${p.nominal}, availability ${p.availability}`">{{ p.capacity }} / {{ p.nominal }}</td>
            <td><Meter :value="p.morale" /></td>
            <td><Meter :value="p.engagement" /></td>
            <td><Meter :value="p.growth" /></td>
            <td><Meter :value="p.burnout" inverse /></td>
            <td><span class="j-lozenge" :class="'j-lozenge--' + riskTone(p.risk)">{{ p.risk === 'gone' ? 'Left' : p.risk }}</span></td>
            <td class="j-nowrap"><span class="j-lozenge" :class="'j-lozenge--' + cadenceTone(p)">{{ cadenceLabel(p) }}</span></td>
            <td>{{ p.feedback }} specific</td>
          </tr>
        </tbody>
      </table>
    </div>

    <section v-if="person" ref="panelEl" class="tp__panel">
      <header class="tp__panel-head">
        <JiraAvatar :name="person.name" :size="48" />
        <div><h2 class="j-h2 tp__panel-name">{{ person.name }}</h2>
          <span class="j-muted">{{ person.role }} · {{ person.level }}</span></div>
        <span class="tp__spacer" />
        <button type="button" class="j-btn j-btn--subtle j-btn--icon" aria-label="Close" @click="selected = ''"><JiraIcon name="close" /></button>
      </header>
      <div v-if="person.status === 'gone'" class="j-msg j-msg--error"><JiraIcon name="error" :size="20" />
        <div><div class="j-msg__title">{{ person.name }} has left the team</div>{{ person.why }}</div></div>
      <template v-else>
        <p class="tp__note">{{ person.notes }}</p>
        <p v-if="person.why" class="j-small">Flight-risk factors: {{ person.why }}</p>
        <p class="j-small">Skills: {{ person.skills }}</p>
        <div class="j-tabs" role="tablist">
          <button v-for="t in tabs" :key="t" type="button" role="tab" class="j-tab" :class="{ 'is-active': tab === t }"
                  :aria-selected="tab === t" @click="tab = t">{{ t }}</button>
        </div>

        <form v-if="tab === 'One-to-ones'" @submit.prevent="logOneOnOne">
          <div class="j-grid2">
            <div class="j-field"><label class="j-label" for="tp-cad">Cadence</label>
              <div class="tp__inline"><select id="tp-cad" v-model="cadence" class="j-select">
                <option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select>
                <button type="button" class="j-btn" @click="schedule">{{ person.cadence ? 'Change' : 'Schedule' }}</button></div>
              <span class="j-help">{{ person.cadence ? `Agreed: ${person.cadence}, last held sprint ${person.last_1on1}` : 'No cadence agreed yet — a one-to-one cannot be logged until there is one.' }}</span></div>
            <div class="j-field"><label class="j-label" for="tp-topic">Topic</label>
              <input id="tp-topic" v-model="oo.topic" class="j-input" placeholder="general" /></div>
          </div>
          <div class="j-field"><label class="j-label" for="tp-note">Notes</label>
            <textarea id="tp-note" v-model="oo.note" class="j-textarea" rows="2" /></div>
          <div class="j-field"><label class="j-label" for="tp-action">Action</label>
            <input id="tp-action" v-model="oo.action" class="j-input" placeholder="What will change because of this conversation?" /></div>
          <button type="submit" class="j-btn j-btn--primary" :disabled="!person.cadence">Log one-to-one</button>
          <ol class="tp__history"><li v-for="(o, i) in [...person.one_on_ones].reverse()" :key="i">
            <span class="j-small">Sprint {{ o.sprint }} · {{ o.topic }}</span> {{ o.note }} <em v-if="o.action">→ {{ o.action }}</em></li></ol>
        </form>

        <form v-else-if="tab === 'Feedback'" @submit.prevent="giveFeedback">
          <div class="j-field"><label class="j-label" for="tp-sit">Situation</label>
            <input id="tp-sit" v-model="fb.situation" class="j-input" placeholder="When and where" /></div>
          <div class="j-field"><label class="j-label" for="tp-beh">Behaviour</label>
            <input id="tp-beh" v-model="fb.behaviour" class="j-input" placeholder="What they did, observably" /></div>
          <div class="j-field"><label class="j-label" for="tp-imp">Impact</label>
            <input id="tp-imp" v-model="fb.impact" class="j-input" placeholder="What it changed" /></div>
          <label class="j-check tp__gapb"><input v-model="fb.praise" type="checkbox" /> Praise (otherwise constructive)</label>
          <div><button type="submit" class="j-btn j-btn--primary" :disabled="!fb.situation && !fb.behaviour && !fb.impact">Give feedback</button></div>
          <ol class="tp__history"><li v-for="(f, i) in [...person.feedback_list].reverse()" :key="i">
            <span class="j-small">Sprint {{ f.sprint }} · {{ f.kind }}</span> {{ f.situation }} — {{ f.behaviour }} — {{ f.impact }}</li></ol>
        </form>

        <form v-else-if="tab === 'Performance'" @submit.prevent="rate">
          <div class="j-grid2">
            <div class="j-field"><label class="j-label" for="tp-ri">Impact</label>
              <select id="tp-ri" v-model="rv.impact" class="j-select"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div class="j-field"><label class="j-label" for="tp-rt">Trajectory</label>
              <select id="tp-rt" v-model="rv.trajectory" class="j-select"><option value="declining">Declining</option><option value="steady">Steady</option><option value="growing">Growing</option></select></div>
          </div>
          <div class="j-field"><label class="j-label" for="tp-rn">Note</label><input id="tp-rn" v-model="rv.note" class="j-input" /></div>
          <p class="j-small">Current rating: {{ person.rating.impact ? `${person.rating.impact} impact, ${person.rating.trajectory} trajectory` : 'none' }} ·
            {{ person.feedback }} specific piece(s) of feedback on file{{ person.promo ? ' · ' + person.promo : '' }}</p>
          <div class="j-actions"><button type="submit" class="j-btn j-btn--primary">Record rating</button>
            <button type="button" class="j-btn" @click="promote">Propose promotion</button></div>
        </form>
      </template>
    </section>
    </template>
  </div>
</template>

<script setup lang="ts">
/** Team: capacity and the people signals, plus one-to-ones, feedback and ratings through `mgr`. */
import { computed, defineComponent, h, nextTick, reactive, ref, watch } from 'vue';
import { cli, pick } from '@/utils/portalKit';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import HiringPanel from './HiringPanel.vue';
import { people, type Person } from './jiraKit';
import { useJira } from './useJira';

const Meter = defineComponent({
  props: { value: { type: Number, default: 0 }, inverse: Boolean },
  setup(props) {
    return () => {
      const v = Math.max(0, Math.min(100, Number(props.value) || 0));
      const good = props.inverse ? v <= 35 : v >= 65;
      const bad = props.inverse ? v > 55 : v < 50;
      return h('span', { class: 'tp-meter', title: String(v) }, [
        h('span', { class: ['j-progress', bad ? 'j-progress--red' : good ? 'j-progress--green' : 'j-progress--yellow'] },
          [h('span', { style: { width: v + '%' } })]),
        h('span', { class: 'j-small' }, String(v)),
      ]);
    };
  },
});

const { ctx } = useJira();
const orgName = computed(() => String(pick(ctx.view.value, 'org.name', 'Cloud Platform Engineering')));
const members = computed(() => people(ctx.view.value, true));
const capacity = computed(() => pick(ctx.view.value, 'stats.capacity', 0));
const selected = ref('');
const person = computed(() => members.value.find(p => p.id === selected.value) || null);
const panelEl = ref<HTMLElement | null>(null);
watch(selected, id => { if (id) nextTick(() => panelEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); });
const tabs = ['One-to-ones', 'Feedback', 'Performance'];
const view = ref('members');
const tab = ref('One-to-ones');
const cadence = ref('biweekly');
const oo = reactive({ topic: '', note: '', action: '' });
const fb = reactive({ situation: '', behaviour: '', impact: '', praise: false });
const rv = reactive({ impact: 'medium', trajectory: 'steady', note: '' });

const riskTone = (r: string) => r === 'high' || r === 'gone' ? 'danger' : r === 'medium' ? 'warning' : 'success';
const cadenceTone = (p: Person) => !p.cadence ? 'default' : p.overdue > 0 ? 'danger' : 'success';
const cadenceLabel = (p: Person) => !p.cadence ? 'No cadence' : p.overdue > 0 ? `Overdue ${p.overdue}` : p.cadence;

function lines(text: unknown) { return String(text || '').split('\n').map(l => l.trim()).filter(Boolean); }
async function report(command: string) {
  const result = await ctx.exec(command, { success: '' });
  if (result.ok) {
    const out = lines(result.output);
    ctx.flag(/NOT |FLAGGED|No action/.test(String(result.output)) ? 'warning' : 'success', out[0] || 'Saved', out.slice(1).join(' '));
  }
  return result.ok;
}

async function schedule() {
  await report(cli(['mgr', '1on1', 'schedule'], { '--with': person.value!.id, '--cadence': cadence.value }));
}
async function logOneOnOne() {
  if (await report(cli(['mgr', '1on1', 'log'], { '--with': person.value!.id, '--topic': oo.topic.trim(),
    '--note': oo.note.trim(), '--action': oo.action.trim() }))) Object.assign(oo, { topic: '', note: '', action: '' });
}
async function giveFeedback() {
  if (await report(cli(['mgr', 'feedback', 'give'], { '--to': person.value!.id, '--situation': fb.situation.trim(),
    '--behaviour': fb.behaviour.trim(), '--impact': fb.impact.trim(), '--praise': fb.praise }))) {
    Object.assign(fb, { situation: '', behaviour: '', impact: '', praise: false });
  }
}
async function rate() {
  await report(cli(['mgr', 'review', 'rate'], { '--for': person.value!.id, '--impact': rv.impact,
    '--trajectory': rv.trajectory, '--note': rv.note.trim() }));
}
async function promote() {
  await report(cli(['mgr', 'promo', 'propose'], { '--for': person.value!.id }));
}
</script>

<style scoped>
.tp__team { display: flex; gap: 12px; align-items: center; }
.tp__team-avatar { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 8px; background: #E9F2FE; color: #1868DB; }
.tp__sub { margin: 4px 0 0; }
.tp__row { cursor: pointer; }
.tp__row.is-gone { opacity: 0.6; }
.tp__name { display: inline-flex; align-items: center; gap: 10px; }
.tp__name strong { display: block; font-weight: 600; }
.tp__lvl { display: block; }
.tp :deep(.tp-meter) { display: inline-flex; align-items: center; gap: 6px; min-width: 90px; }
.tp :deep(.tp-meter .j-progress) { flex: 1; }
.tp__panel { margin-top: 24px; padding: 16px; border: 1px solid var(--j-border); border-radius: 6px; max-width: 760px; }
.tp__panel-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.tp__panel-name { margin: 0; }
.tp__spacer { flex: 1; }
.tp__note { margin: 0 0 4px; }
.tp__inline { display: flex; gap: 8px; }
.tp__gapb { margin-bottom: 12px; }
.tp__history { margin: 16px 0 0; padding-left: 18px; color: var(--j-text-subtle); }
.tp__history li { margin-bottom: 6px; overflow-wrap: anywhere; }
</style>
