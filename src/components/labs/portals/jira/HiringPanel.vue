<template>
  <div class="hp">
    <div class="hp__bar">
      <p class="j-muted hp__intro">Every stage has a clock: a candidate left in one stage for two sprints takes another offer. A hire starts a sprint later and ramps over three.</p>
      <button type="button" class="j-btn j-btn--primary" @click="req = { role: '', level: 'L5', skill: 'azure' }">Open requisition</button>
    </div>
    <div class="hp__board">
      <section v-for="stage in STAGES" :key="stage" class="hp__col">
        <header class="hp__col-head">{{ stage }} <span>{{ at(stage).length }}</span></header>
        <article v-for="c in at(stage)" :key="c.id" class="hp__card">
          <div class="hp__name"><JiraAvatar :name="c.name" :size="24" /> <strong>{{ c.name }}</strong></div>
          <div class="j-small">{{ c.id }} · {{ c.role }}</div>
          <div class="hp__meta">
            <span class="j-lozenge" :class="c.in_stage >= 1 && ADV.includes(c.stage) ? 'j-lozenge--warning' : 'j-lozenge--default'">{{ c.in_stage }} sprint(s) in stage</span>
            <span class="j-small">{{ c.cards }} scorecard(s), {{ c.evidenced }} evidenced</span>
          </div>
          <div v-if="ADV.includes(c.stage)" class="hp__actions">
            <button type="button" class="j-btn j-btn--compact" @click="card = { id: c.id, name: c.name, by: '', signal: 'yes', evidence: '' }">Scorecard</button>
            <button v-if="c.stage !== 'offer'" type="button" class="j-btn j-btn--compact" @click="advance(c.id)">Advance</button>
            <button type="button" class="j-btn j-btn--compact" @click="offer(c)">Offer</button>
            <button type="button" class="j-btn j-btn--compact j-btn--subtle" @click="reject = { id: c.id, name: c.name, because: '' }">Reject</button>
          </div>
        </article>
      </section>
    </div>

    <JiraModal v-if="req" title="Open requisition" width="small" @close="req = null">
      <form id="hp-req" @submit.prevent="openReq">
        <div class="j-field"><label class="j-label" for="hp-role">Role<span class="j-req">*</span></label>
          <input id="hp-role" v-model="req.role" class="j-input" autofocus placeholder="Senior SRE" /></div>
        <div class="j-grid2">
          <div class="j-field"><label class="j-label" for="hp-level">Level</label>
            <select id="hp-level" v-model="req.level" class="j-select"><option v-for="l in ['L3', 'L4', 'L5', 'L6', 'L7']" :key="l">{{ l }}</option></select></div>
          <div class="j-field"><label class="j-label" for="hp-skill">Skill</label>
            <select id="hp-skill" v-model="req.skill" class="j-select"><option v-for="s in skills" :key="s">{{ s }}</option></select></div>
        </div>
      </form>
      <template #footer><button type="button" class="j-btn j-btn--subtle" @click="req = null">Cancel</button>
        <button type="submit" form="hp-req" class="j-btn j-btn--primary" :disabled="!req.role.trim()">Open</button></template>
    </JiraModal>

    <JiraModal v-if="card" :title="`Scorecard for ${card.name}`" width="small" @close="card = null">
      <form id="hp-card" @submit.prevent="saveCard">
        <div class="j-field"><label class="j-label" for="hp-by">Interviewer<span class="j-req">*</span></label>
          <select id="hp-by" v-model="card.by" class="j-select"><option value="" disabled>Select</option>
            <option v-for="p in team" :key="p.id" :value="p.id">{{ p.name }}</option></select></div>
        <div class="j-field"><label class="j-label" for="hp-sig">Signal</label>
          <select id="hp-sig" v-model="card.signal" class="j-select"><option value="strong_yes">Strong yes</option><option value="yes">Yes</option>
            <option value="no">No</option><option value="strong_no">Strong no</option></select></div>
        <div class="j-field"><label class="j-label" for="hp-ev">Evidence</label>
          <textarea id="hp-ev" v-model="card.evidence" class="j-textarea" rows="3" placeholder="What they did in the interview that supports the signal" /></div>
      </form>
      <template #footer><button type="button" class="j-btn j-btn--subtle" @click="card = null">Cancel</button>
        <button type="submit" form="hp-card" class="j-btn j-btn--primary" :disabled="!card.by">Submit</button></template>
    </JiraModal>

    <JiraModal v-if="reject" :title="`Reject ${reject.name}`" width="small" @close="reject = null">
      <form id="hp-rej" @submit.prevent="doReject">
        <div class="j-field"><label class="j-label" for="hp-because">Reason</label>
          <textarea id="hp-because" v-model="reject.because" class="j-textarea" rows="3" autofocus /></div>
      </form>
      <template #footer><button type="button" class="j-btn j-btn--subtle" @click="reject = null">Cancel</button>
        <button type="submit" form="hp-rej" class="j-btn j-btn--danger">Reject</button></template>
    </JiraModal>
  </div>
</template>

<script setup lang="ts">
/** The hiring funnel through `mgr hire`. */
import { computed, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import JiraAvatar from './JiraAvatar.vue';
import JiraModal from './JiraModal.vue';
import { useJira } from './useJira';

const STAGES = ['screen', 'tech', 'onsite', 'offer', 'hired', 'rejected', 'lost'];
const ADV = ['screen', 'tech', 'onsite', 'offer'];
const { ctx, team } = useJira();
const candidates = computed(() => rows<Record<string, any>>(ctx.view.value, 'hiring'));
const skills = computed(() => pick<string[]>(ctx.view.value, 'skills', ['azure']));
const at = (stage: string) => candidates.value.filter(c => c.stage === stage);

const req = ref<{ role: string; level: string; skill: string } | null>(null);
const card = ref<{ id: string; name: string; by: string; signal: string; evidence: string } | null>(null);
const reject = ref<{ id: string; name: string; because: string } | null>(null);

function lines(text: unknown) { return String(text || '').split('\n').map(l => l.trim()).filter(Boolean); }
async function run(command: string) {
  const result = await ctx.exec(command, { success: '' });
  if (result.ok) {
    const out = lines(result.output);
    ctx.flag(/NO EVIDENCE|SCORECARD\(S\)|No reason/.test(String(result.output)) ? 'warning' : 'success', out[0] || 'Done', out.slice(1).join(' '));
  }
  return result.ok;
}
async function openReq() {
  const r = req.value!;
  if (await run(cli(['mgr', 'hire', 'req'], { '--role': r.role.trim(), '--level': r.level, '--skill': r.skill }))) req.value = null;
}
async function saveCard() {
  const c = card.value!;
  if (await run(cli(['mgr', 'hire', 'scorecard', c.id], { '--by': c.by, '--signal': c.signal, '--evidence': c.evidence.trim() }))) card.value = null;
}
async function advance(id: string) { await run(cli(['mgr', 'hire', 'advance', id])); }
async function offer(c: Record<string, any>) {
  if (await ctx.confirm({ title: `Make an offer to ${c.name}?`, confirm: 'Make offer',
    body: `${c.cards} scorecard(s) on file. They start next sprint at 40% capacity and ramp over three sprints.` })) {
    await run(cli(['mgr', 'hire', 'offer', c.id]));
  }
}
async function doReject() {
  const r = reject.value!;
  if (await run(cli(['mgr', 'hire', 'reject', r.id], { '--because': r.because.trim() }))) reject.value = null;
}
</script>

<style scoped>
.hp__bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
.hp__intro { margin: 0; max-width: 640px; }
.hp__board { display: grid; grid-template-columns: repeat(7, minmax(170px, 1fr)); gap: 8px; overflow-x: auto; }
.hp__col { padding: 0 6px 8px; border-radius: 6px; background: var(--j-sunken); min-height: 120px; }
.hp__col-head { padding: 10px 6px 6px; font-size: 12px; font-weight: 653; color: var(--j-text-subtle); text-transform: uppercase; }
.hp__col-head span { font-weight: 400; }
.hp__card { margin-bottom: 6px; padding: 10px; border-radius: 4px; background: var(--j-surface); box-shadow: var(--j-card-shadow); }
.hp__name { display: flex; align-items: center; gap: 6px; }
.hp__meta { display: flex; flex-direction: column; gap: 4px; margin: 6px 0; }
.hp__actions { display: flex; flex-wrap: wrap; gap: 4px; }
</style>
