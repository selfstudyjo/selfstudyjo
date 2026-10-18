<template>
  <div class="j-page gp">
    <nav class="j-crumbs" aria-label="Breadcrumbs">
      <a href="#" @click.prevent>Projects</a><span class="sep">/</span><a href="#" @click.prevent>Platform</a>
    </nav>
    <div class="j-header">
      <div>
        <h1 class="j-h1">Goals</h1>
        <p class="j-muted gp__sub">Objectives and key results for {{ quarter }}. Work rolls up to a key result from the issue view.</p>
      </div>
      <button type="button" class="j-btn j-btn--primary" @click="openGoal()">Create goal</button>
    </div>

    <div v-if="!objectives.length" class="j-empty">
      <JiraIcon name="goals" :size="48" />
      <h3>No goals yet</h3>
      <p>A goal is an objective with measurable key results, each owned by one person. A key result nobody owns does not move.</p>
      <button type="button" class="j-btn j-btn--primary" @click="openGoal()">Create goal</button>
    </div>

    <article v-for="objective in objectives" :key="objective.id" class="gp__goal">
      <header class="gp__goal-head">
        <span class="gp__goal-icon"><JiraIcon name="goals" /></span>
        <div class="gp__goal-title">
          <span class="j-key">{{ objective.id }}</span>
          <h2 class="j-h2">{{ objective.objective }}</h2>
        </div>
        <span class="j-lozenge" :class="'j-lozenge--' + goalStatus(objective).tone">{{ goalStatus(objective).label }}</span>
        <JiraDropdown :items="goalMenu" label="Goal actions" align="right" trigger-class="j-btn j-btn--subtle j-btn--icon"
                      @select="v => onGoalMenu(objective, v)">
          <template #trigger><JiraIcon name="more" /></template>
        </JiraDropdown>
      </header>
      <div class="j-table-wrap">
        <table class="j-table">
          <thead><tr><th>Key result</th><th>Owner</th><th>Progress</th><th>Confidence</th><th>Status</th>
            <th>Check-ins</th><th>Work</th><th><span class="j-sr">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="kr in objective.krs" :key="kr.id">
              <td class="gp__kr"><span class="j-key">{{ kr.id }}</span> {{ kr.text }}
                <div class="j-small">{{ kr.baseline }} → {{ kr.target }} · now {{ kr.current }}</div></td>
              <td class="j-nowrap"><span v-if="kr.owner" class="gp__owner"><JiraAvatar :name="personName(kr.owner)" :size="24" /> {{ personName(kr.owner) }}</span>
                <span v-else class="j-lozenge j-lozenge--danger">No owner</span></td>
              <td><div class="gp__prog"><div class="j-progress" :class="'j-progress--' + tone(kr)"><span :style="{ width: clamp(kr.progress) + '%' }" /></div>
                <span class="j-small">{{ Math.round(kr.progress) }}%</span></div></td>
              <td class="j-nowrap">{{ kr.confidence || 0 }}%</td>
              <td><span class="j-lozenge" :class="'j-lozenge--' + krStatus(kr).tone">{{ krStatus(kr).label }}</span></td>
              <td>{{ (kr.checkins || []).length }}</td>
              <td class="j-nowrap">
                <button v-for="key in kr.linked || []" :key="key" type="button" class="j-link gp__work" @click="ctx.openIssue(key)">{{ key }}</button>
                <span v-if="!(kr.linked || []).length" class="j-small">—</span>
              </td>
              <td class="j-nowrap">
                <button type="button" class="j-btn j-btn--compact" @click="openCheckin(kr)">Update</button>
                <JiraDropdown :items="krMenu" label="Key result actions" align="right"
                              trigger-class="j-btn j-btn--subtle j-btn--icon j-btn--compact" @select="v => onKrMenu(kr, v)">
                  <template #trigger><JiraIcon name="more" /></template>
                </JiraDropdown>
              </td>
            </tr>
            <tr v-if="!objective.krs.length"><td colspan="8" class="j-muted">An objective with no key result is a slogan. Add one.</td></tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="j-btn j-btn--subtle gp__add" @click="openKr(objective)"><JiraIcon name="plus" /> Add key result</button>
    </article>

    <!-- Create goal / edit objective -->
    <JiraModal v-if="goalForm" :title="goalForm.id ? 'Edit goal' : 'Create goal'" @close="goalForm = null">
      <form id="gp-goal" @submit.prevent="saveGoal">
        <div class="j-field"><label class="j-label" for="gp-obj">Objective<span class="j-req">*</span></label>
          <input id="gp-obj" v-model="goalForm.objective" class="j-input" autofocus maxlength="200" />
          <span class="j-help">Qualitative and inspiring: what are we trying to achieve this quarter?</span></div>
        <template v-if="!goalForm.id">
          <h3 class="j-h3">First key result</h3>
          <KrFields :form="goalForm" :team="team" />
        </template>
      </form>
      <template #footer>
        <button type="button" class="j-btn j-btn--subtle" @click="goalForm = null">Cancel</button>
        <button type="submit" form="gp-goal" class="j-btn j-btn--primary" :disabled="!goalForm.objective.trim()">{{ goalForm.id ? 'Save' : 'Create' }}</button>
      </template>
    </JiraModal>

    <!-- Add / edit key result -->
    <JiraModal v-if="krForm" :title="krForm.id ? `Edit ${krForm.id}` : `Add key result to ${krForm.objectiveId}`" @close="krForm = null">
      <form id="gp-kr" @submit.prevent="saveKr"><KrFields :form="krForm" :team="team" :editing="Boolean(krForm.id)" /></form>
      <template #footer>
        <button type="button" class="j-btn j-btn--subtle" @click="krForm = null">Cancel</button>
        <button type="submit" form="gp-kr" class="j-btn j-btn--primary" :disabled="!krForm.kr.trim()">{{ krForm.id ? 'Save' : 'Add' }}</button>
      </template>
    </JiraModal>

    <!-- Check-in -->
    <JiraModal v-if="checkin" :title="`Update ${checkin.id}`" width="small" @close="checkin = null">
      <form id="gp-ci" @submit.prevent="saveCheckin">
        <p class="j-muted gp__ci-text">{{ checkin.text }} — from {{ checkin.baseline }} to {{ checkin.target }}</p>
        <div class="j-field"><label class="j-label" for="gp-ci-v">Current value<span class="j-req">*</span></label>
          <input id="gp-ci-v" v-model="checkin.value" class="j-input" type="number" step="any" autofocus /></div>
        <div class="j-field"><label class="j-label" for="gp-ci-c">Confidence (%)</label>
          <input id="gp-ci-c" v-model="checkin.confidence" class="j-input" type="number" min="0" max="100" />
          <span class="j-help">How sure are you the target will be hit? Confidence far above progress is the gap a check-in exists to surface.</span></div>
      </form>
      <template #footer>
        <button type="button" class="j-btn j-btn--subtle" @click="checkin = null">Cancel</button>
        <button type="submit" form="gp-ci" class="j-btn j-btn--primary" :disabled="checkin.value === ''">Post update</button>
      </template>
    </JiraModal>
  </div>
</template>

<script setup lang="ts">
/** Goals: objectives, key results, owners, progress and confidence, all through `mgr okr`. */
import { computed, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import JiraModal from './JiraModal.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import KrFields from './KrFields.vue';
import { useJira } from './useJira';

interface Kr { id: string; text: string; owner: string; baseline: number; target: number; current: number;
  confidence: number; progress: number; checkins: unknown[]; linked: string[] }
interface Objective { id: string; objective: string; krs: Kr[] }

const { ctx, team, personName } = useJira();
const quarter = computed(() => String(pick(ctx.view.value, 'org.quarter', 'this quarter')));
const objectives = computed(() => rows<Objective>(ctx.view.value, 'objectives').map(o => ({ ...o, krs: o.krs || [] })));

const goalForm = ref<Record<string, any> | null>(null);
const krForm = ref<Record<string, any> | null>(null);
const checkin = ref<Record<string, any> | null>(null);

const clamp = (n: number) => Math.max(0, Math.min(100, Number(n) || 0));
function tone(kr: Kr) {
  if (!kr.owner) return 'red';
  if ((kr.confidence || 0) - kr.progress > 35) return 'yellow';
  return kr.progress >= 70 ? 'green' : 'blue';
}
function krStatus(kr: Kr) {
  if (!kr.owner) return { label: 'No owner', tone: 'danger' };
  if ((kr.confidence || 0) - kr.progress > 35) return { label: 'At risk', tone: 'warning' };
  if (kr.progress >= 100) return { label: 'Done', tone: 'done' };
  return { label: 'On track', tone: 'success' };
}
function goalStatus(objective: Objective) {
  if (!objective.krs.length) return { label: 'Pending', tone: 'default' };
  if (objective.krs.some(kr => !kr.owner)) return { label: 'Off track', tone: 'danger' };
  if (objective.krs.some(kr => (kr.confidence || 0) - kr.progress > 35)) return { label: 'At risk', tone: 'warning' };
  return { label: 'On track', tone: 'success' };
}

function blankKr() {
  return { kr: '', owner: '', baseline: '0', target: '100', confidence: '' };
}
function openGoal() { goalForm.value = { id: '', objective: '', ...blankKr() }; }
function openKr(objective: Objective) { krForm.value = { id: '', objectiveId: objective.id, ...blankKr() }; }
function openCheckin(kr: Kr) {
  checkin.value = { id: kr.id, text: kr.text, baseline: kr.baseline, target: kr.target, value: String(kr.current),
                    confidence: String(kr.confidence || '') };
}

async function saveGoal() {
  const form = goalForm.value!;
  const result = form.id
    ? await ctx.exec(cli(['mgr', 'okr', 'edit'], { '--objective': form.id, '--text': form.objective.trim() }),
                     { success: `${form.id} updated` })
    : await ctx.exec(cli(['mgr', 'okr', 'add'], { '--objective': form.objective.trim(), '--kr': form.kr.trim(),
        '--baseline': form.baseline, '--target': form.target, '--owner': form.owner, '--confidence': form.confidence }),
      { success: 'Goal created' });
  if (result.ok) goalForm.value = null;
}

async function saveKr() {
  const form = krForm.value!;
  const result = form.id
    ? await ctx.exec(cli(['mgr', 'okr', 'edit'], { '--kr': form.id, '--text': form.kr.trim(), '--owner': form.owner,
        '--baseline': form.baseline, '--target': form.target, '--confidence': form.confidence }),
      { success: `${form.id} updated` })
    : await ctx.exec(cli(['mgr', 'okr', 'kr'], { '--objective': form.objectiveId, '--kr': form.kr.trim(),
        '--baseline': form.baseline, '--target': form.target, '--owner': form.owner, '--confidence': form.confidence }),
      { success: 'Key result added' });
  if (result.ok) krForm.value = null;
}

async function saveCheckin() {
  const form = checkin.value!;
  const result = await ctx.exec(cli(['mgr', 'okr', 'checkin'], { '--kr': form.id, '--value': form.value,
    '--confidence': form.confidence }), { success: '' });
  if (result.ok) {
    checkin.value = null;
    const lines = String(result.output || '').split('\n').map(l => l.trim()).filter(Boolean);
    ctx.flag(lines.length > 1 ? 'warning' : 'success', lines[0] || 'Update posted', lines.slice(1).join(' '));
  }
}

const goalMenu: DropItem[] = [{ label: 'Edit goal', value: 'edit' }, { label: 'Add key result', value: 'kr' },
  { label: 'Delete goal', value: 'delete', danger: true }];
const krMenu: DropItem[] = [{ label: 'Edit', value: 'edit' }, { label: 'Delete', value: 'delete', danger: true }];

async function onGoalMenu(objective: Objective, value: string) {
  if (value === 'edit') goalForm.value = { id: objective.id, objective: objective.objective, ...blankKr() };
  else if (value === 'kr') openKr(objective);
  else if (value === 'delete' && await ctx.confirm({ title: `Delete ${objective.id}?`, danger: true, confirm: 'Delete',
    body: `"${objective.objective}" and its ${objective.krs.length} key result(s) will be deleted. Work linked to them is unlinked.` })) {
    await ctx.exec(cli(['mgr', 'okr', 'remove'], { '--objective': objective.id }), { success: `${objective.id} deleted` });
  }
}

async function onKrMenu(kr: Kr, value: string) {
  if (value === 'edit') {
    krForm.value = { id: kr.id, kr: kr.text, owner: kr.owner, baseline: String(kr.baseline), target: String(kr.target),
                     confidence: String(kr.confidence || '') };
  } else if (value === 'delete' && await ctx.confirm({ title: `Delete ${kr.id}?`, danger: true, confirm: 'Delete',
    body: `"${kr.text}" will be deleted, with its check-in history.` })) {
    await ctx.exec(cli(['mgr', 'okr', 'remove'], { '--kr': kr.id }), { success: `${kr.id} deleted` });
  }
}
</script>

<style scoped>
.gp__sub { margin: 4px 0 0; }
.gp__goal { margin-bottom: 24px; padding: 16px; border: 1px solid var(--j-border); border-radius: 6px; }
.gp__goal-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.gp__goal-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 6px; background: #DCFFF1; color: #216E4E; flex: none; }
.gp__goal-title { flex: 1; min-width: 0; }
.gp__goal-title .j-h2 { margin: 0; overflow-wrap: anywhere; }
.gp__kr { min-width: 220px; }
.gp__owner { display: inline-flex; align-items: center; gap: 8px; }
.gp__prog { display: flex; align-items: center; gap: 8px; min-width: 120px; }
.gp__prog .j-progress { flex: 1; }
.gp__work { margin-right: 6px; font-size: 12px; }
.gp__add { margin-top: 8px; }
.gp__ci-text { margin: 0 0 12px; }
.j-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; text-overflow: ellipsis; }
</style>
