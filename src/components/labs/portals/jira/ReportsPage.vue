<template>
  <div class="j-page rr">
    <nav class="j-crumbs" aria-label="Breadcrumbs">
      <a href="#" @click.prevent>Projects</a><span class="sep">/</span><a href="#" @click.prevent>Platform</a>
      <span class="sep">/</span><a href="#" @click.prevent>Reports</a>
    </nav>
    <div class="j-header"><h1 class="j-h1">{{ titles[tab] }}</h1></div>
    <div class="j-tabs" role="tablist">
      <button v-for="(label, id) in titles" :key="id" type="button" role="tab" class="j-tab" :class="{ 'is-active': tab === id }"
              :aria-selected="tab === id" @click="tab = id">{{ label }}</button>
    </div>

    <!-- Velocity -->
    <section v-if="tab === 'velocity'">
      <p class="j-muted rr__intro">Track the amount of work completed from sprint to sprint. This helps you determine your team's velocity and estimate the work your team can realistically achieve in future sprints.</p>
      <div v-if="!closed.length" class="j-empty"><JiraIcon name="reports" :size="40" />
        <h3>No completed sprints yet</h3><p>Complete a sprint to see its commitment against what was delivered.</p></div>
      <template v-else>
        <div class="rr__legend" aria-hidden="true">
          <span><i class="rr__swatch rr__swatch--commit" /> Commitment</span>
          <span><i class="rr__swatch rr__swatch--done" /> Completed</span>
          <span><i class="rr__swatch rr__swatch--cap" /> Capacity</span>
        </div>
        <div class="rr__chart" role="img" :aria-label="`Velocity chart for ${closed.length} sprints`">
          <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="rr__svg">
            <g v-for="tick in ticks" :key="tick">
              <line :x1="PAD" :x2="W - 8" :y1="y(tick)" :y2="y(tick)" class="rr__grid" />
              <text :x="PAD - 6" :y="y(tick) + 4" class="rr__tick" text-anchor="end">{{ tick }}</text>
            </g>
            <g v-for="(s, i) in closed" :key="s.n">
              <rect :x="groupX(i)" :y="y(s.committed)" :width="BAR" :height="Math.max(0, y(0) - y(s.committed))" rx="2"
                    class="rr__bar rr__bar--commit" @mouseenter="hover = i" @mouseleave="hover = -1" />
              <rect :x="groupX(i) + BAR + 2" :y="y(s.delivered)" :width="BAR" :height="Math.max(0, y(0) - y(s.delivered))" rx="2"
                    class="rr__bar rr__bar--done" @mouseenter="hover = i" @mouseleave="hover = -1" />
              <line :x1="groupX(i) - 4" :x2="groupX(i) + BAR * 2 + 6" :y1="y(s.capacity)" :y2="y(s.capacity)" class="rr__cap" />
              <text :x="groupX(i) + BAR + 1" :y="H - 8" class="rr__tick" text-anchor="middle">Sprint {{ s.n }}</text>
            </g>
          </svg>
          <div v-if="hover >= 0" class="rr__tip" :style="{ left: (100 * (groupX(hover) + BAR) / W) + '%' }">
            <strong>{{ sprintName(closed[hover].n) }}</strong><br />Commitment {{ closed[hover].committed }} ·
            Completed {{ closed[hover].delivered }}<br />Capacity {{ closed[hover].capacity }} · Say/do {{ closed[hover].say_do || '—' }}
          </div>
        </div>
        <p class="j-small">Average velocity {{ average }} story points over the last {{ Math.min(3, closed.length) }} sprint(s).</p>
      </template>
      <div class="j-table-wrap rr__gap">
        <table class="j-table">
          <thead><tr><th>Sprint</th><th>Status</th><th>Capacity</th><th>Commitment</th><th>Completed</th><th>Carried</th><th>Say/do</th></tr></thead>
          <tbody><tr v-for="s in sprints" :key="s.n">
            <td>{{ sprintName(s.n) }}</td>
            <td><span class="j-lozenge" :class="s.status === 'closed' ? 'j-lozenge--done' : s.status === 'active' ? 'j-lozenge--doing' : 'j-lozenge--default'">{{ s.status === 'closed' ? 'Complete' : s.status === 'active' ? 'Active' : 'Future' }}</span></td>
            <td>{{ s.capacity }}</td><td>{{ s.committed }}</td><td>{{ s.delivered }}</td><td>{{ s.carried }}</td><td>{{ s.say_do || '—' }}</td>
          </tr></tbody>
        </table>
      </div>
    </section>

    <!-- Burndown -->
    <section v-else-if="tab === 'burndown'">
      <p class="j-muted rr__intro">Track the work remaining in a sprint against the ideal line. In this simulation the team delivers
        when the sprint completes (mgr advance), so the remaining line stays flat and drops on the last day — the gap to the
        guideline is the honest picture of a sprint whose work lands at the end.</p>
      <div class="j-field rr__pick"><label class="j-label" for="rr-bd">Sprint</label>
        <select id="rr-bd" v-model.number="bdSprint" class="j-select">
          <option v-for="s in [...sprints].reverse()" :key="s.n" :value="s.n">{{ sprintName(s.n) }} ({{ s.status === 'closed' ? 'complete' : s.status }})</option>
        </select></div>
      <div v-if="bd" class="rr__chart" role="img" :aria-label="`Burndown for ${sprintName(bd.n)}`">
        <div class="rr__legend" aria-hidden="true">
          <span><i class="rr__swatch rr__swatch--guide" /> Guideline</span>
          <span><i class="rr__swatch rr__swatch--remain" /> Remaining story points</span>
        </div>
        <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="rr__svg">
          <g v-for="tick in bdTicks" :key="tick">
            <line :x1="PAD" :x2="W - 8" :y1="by(tick)" :y2="by(tick)" class="rr__grid" />
            <text :x="PAD - 6" :y="by(tick) + 4" class="rr__tick" text-anchor="end">{{ tick }}</text>
          </g>
          <line :x1="bx(0)" :y1="by(bd.committed)" :x2="bx(days)" :y2="by(0)" class="rr__guide" />
          <polyline :points="bdPoints" class="rr__remain" />
          <text v-for="d in [0, Math.round(days / 2), days]" :key="d" :x="bx(d)" :y="H - 8" class="rr__tick" text-anchor="middle">Day {{ d }}</text>
        </svg>
        <p class="j-small">Committed {{ bd.committed }} · Completed {{ bd.delivered }} · Remaining {{ Math.max(0, bd.committed - bd.delivered) }}
          <template v-if="bd.status !== 'closed'"> · not completed yet</template></p>
      </div>
      <div v-else class="j-empty"><h3>No sprint data yet</h3><p>Plan and start a sprint to see its burndown.</p></div>
    </section>

    <!-- Burnup -->
    <section v-else-if="tab === 'burnup'">
      <p class="j-muted rr__intro">Completed work accumulating sprint by sprint, against the total scope of the backlog today.
        The distance between the two lines is the work still to do.</p>
      <div v-if="!closed.length" class="j-empty"><h3>No completed sprints yet</h3><p>Complete a sprint to start the burnup.</p></div>
      <div v-else class="rr__chart" role="img" aria-label="Burnup chart">
        <div class="rr__legend" aria-hidden="true">
          <span><i class="rr__swatch rr__swatch--done" /> Completed (cumulative)</span>
          <span><i class="rr__swatch rr__swatch--cap" /> Total scope</span>
        </div>
        <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="rr__svg">
          <g v-for="tick in buTicks" :key="tick">
            <line :x1="PAD" :x2="W - 8" :y1="uy(tick)" :y2="uy(tick)" class="rr__grid" />
            <text :x="PAD - 6" :y="uy(tick) + 4" class="rr__tick" text-anchor="end">{{ tick }}</text>
          </g>
          <line :x1="PAD" :x2="W - 8" :y1="uy(scope)" :y2="uy(scope)" class="rr__cap" />
          <polyline :points="buPoints" class="rr__burnup" />
          <circle v-for="(p, i) in buSeries" :key="i" :cx="ux(i)" :cy="uy(p)" r="4" class="rr__dot" />
          <text v-for="(s, i) in closed" :key="s.n" :x="ux(i)" :y="H - 8" class="rr__tick" text-anchor="middle">Sprint {{ s.n }}</text>
        </svg>
        <p class="j-small">{{ buSeries[buSeries.length - 1] }} of {{ scope }} story points completed
          ({{ scope ? Math.round(100 * buSeries[buSeries.length - 1] / scope) : 0 }}%).</p>
      </div>
    </section>

    <!-- Sprint report -->
    <section v-else-if="tab === 'sprint'">
      <form class="rr__retro" @submit.prevent="saveRetro">
        <h2 class="j-h3">Retrospective — {{ sprintName(currentSprint) }}</h2>
        <div class="rr__retro-grid">
          <div class="j-field"><label class="j-label" for="rr-keep">What went well</label><input id="rr-keep" v-model="retro.keep" class="j-input" /></div>
          <div class="j-field"><label class="j-label" for="rr-change">What to change</label><input id="rr-change" v-model="retro.change" class="j-input" /></div>
          <div class="j-field"><label class="j-label" for="rr-action">Action</label><input id="rr-action" v-model="retro.action" class="j-input" /></div>
        </div>
        <button type="submit" class="j-btn" :disabled="!retro.keep && !retro.change && !retro.action">Save retrospective</button>
        <ul v-if="retros.length" class="rr__retros"><li v-for="(r, i) in retros" :key="i"><span class="j-small">Sprint {{ r.sprint }}</span>
          <span v-if="r.keep">Keep: {{ r.keep }}.</span> <span v-if="r.change">Change: {{ r.change }}.</span> <strong v-if="r.action">Action: {{ r.action }}</strong></li></ul>
      </form>
      <p class="j-muted rr__intro">What the simulation noticed, sprint by sprint — the consequences of what was done, and not done.</p>
      <ol class="rr__signals">
        <li v-for="(s, i) in signalsDesc" :key="i" :class="'is-' + s.level">
          <JiraIcon :name="s.level === 'good' ? 'success' : s.level === 'critical' ? 'error' : 'warning'" />
          <div><span class="j-small">Sprint {{ s.sprint }}</span><div>{{ s.text }}</div></div>
        </li>
        <li v-if="!signalsDesc.length" class="j-muted">Nothing yet. Signals appear when a sprint completes.</li>
      </ol>
    </section>

    <!-- Health -->
    <section v-else-if="tab === 'health'">
      <p class="j-muted rr__intro">Four scores, never one: delivering while the team burns out and protecting the team while missing every date are both failing, differently.</p>
      <div class="rr__tiles">
        <div v-for="k in ['people', 'delivery', 'stakeholders', 'governance', 'overall']" :key="k" class="rr__tile" :class="{ 'is-overall': k === 'overall' }">
          <span class="j-small rr__tile-label">{{ k }}</span>
          <span class="rr__tile-num">{{ scores[k] ?? '—' }}</span>
          <div class="j-progress" :class="'j-progress--' + tone(scores[k])"><span :style="{ width: (scores[k] || 0) + '%' }" /></div>
        </div>
      </div>
      <button type="button" class="j-btn rr__gap" @click="scorecard">Explain the scores</button>
      <button type="button" class="j-btn rr__gap" @click="weekly">Generate weekly update</button>
    </section>

    <!-- Cost -->
    <section v-else-if="tab === 'cost'">
      <div class="rr__tiles">
        <div class="rr__tile"><span class="j-small rr__tile-label">Run rate / month</span><span class="rr__tile-num">{{ money(stats.run_rate) }}</span></div>
        <div class="rr__tile"><span class="j-small rr__tile-label">Budget / month</span><span class="rr__tile-num">{{ money(stats.budget) }}</span></div>
        <div class="rr__tile"><span class="j-small rr__tile-label">3-month forecast</span>
          <span class="rr__tile-num" :class="{ 'is-bad': stats.forecast > stats.budget }">{{ money(stats.forecast) }}</span></div>
      </div>
      <div class="j-table-wrap rr__gap">
        <table class="j-table">
          <thead><tr><th>Cost line</th><th>Per month</th><th>Share</th><th>Tagged</th><th>Note</th><th><span class="rr__sr">Actions</span></th></tr></thead>
          <tbody><tr v-for="line in cost" :key="line.line">
            <td>{{ line.line }}</td><td class="j-nowrap">{{ money(line.monthly) }}</td><td>{{ line.share }}</td>
            <td><span class="j-lozenge" :class="line.tagged ? 'j-lozenge--success' : 'j-lozenge--danger'">{{ line.tagged ? 'Tagged' : 'Untagged' }}</span></td>
            <td class="j-muted">{{ line.note }}</td>
            <td class="j-nowrap">
              <button type="button" class="j-btn j-btn--compact" :disabled="line.tagged" @click="tag(line.line)">Tag owner</button>
              <button type="button" class="j-btn j-btn--compact" @click="rightsize = { line: line.line, save: String(Math.round(line.monthly * 0.25)) }">Right-size</button>
            </td>
          </tr></tbody>
        </table>
      </div>
      <JiraModal v-if="rightsize" :title="`Right-size ${rightsize.line}`" width="small" @close="rightsize = null">
        <form id="rr-rs" @submit.prevent="doRightsize">
          <div class="j-field"><label class="j-label" for="rr-save">Monthly saving</label>
            <input id="rr-save" v-model="rightsize.save" class="j-input" type="number" min="1" autofocus />
            <span class="j-help">Capped at 60% of the line.</span></div>
        </form>
        <template #footer>
          <button type="button" class="j-btn j-btn--subtle" @click="rightsize = null">Cancel</button>
          <button type="submit" form="rr-rs" class="j-btn j-btn--primary">Right-size</button>
        </template>
      </JiraModal>
    </section>
  </div>
</template>

<script setup lang="ts">
/** Reports: the velocity chart, the sprint report, team health and cost. */
import { computed, reactive, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import JiraIcon from './JiraIcon.vue';
import JiraModal from './JiraModal.vue';
import { sprintName } from './jiraKit';
import { useJira } from './useJira';

interface Sprint { n: number; status: string; capacity: number; committed: number; delivered: number; carried: number; say_do: string }
const { ctx } = useJira();
const titles: Record<string, string> = { velocity: 'Velocity report', burndown: 'Sprint burndown chart', burnup: 'Burnup report',
  sprint: 'Sprint report', health: 'Team health', cost: 'Cost report' };
const tab = ref('velocity');
const hover = ref(-1);
const rightsize = ref<{ line: string; save: string } | null>(null);

const sprints = computed(() => rows<Sprint>(ctx.view.value, 'sprints'));
const closed = computed(() => sprints.value.filter(s => s.status === 'closed').slice(-8));
const scores = computed(() => pick<Record<string, number>>(ctx.view.value, 'scores', {}));
const stats = computed(() => pick<Record<string, number>>(ctx.view.value, 'stats', {}));
const cost = computed(() => rows<Record<string, any>>(ctx.view.value, 'cost'));
const retros = computed(() => [...rows<Record<string, any>>(ctx.view.value, 'retros')].reverse());
const currentSprint = computed(() => Number(pick(ctx.view.value, 'stats.sprint', 1)));
const retro = reactive({ keep: '', change: '', action: '' });
async function saveRetro() {
  const result = await ctx.exec(cli(['mgr', 'retro', 'add'], { '--keep': retro.keep.trim(), '--change': retro.change.trim(), '--action': retro.action.trim() }),
                                { success: 'Retrospective saved' });
  if (result.ok) Object.assign(retro, { keep: '', change: '', action: '' });
}
const signalsDesc = computed(() => [...rows<Record<string, any>>(ctx.view.value, 'signals')].reverse());
const average = computed(() => {
  const recent = closed.value.slice(-3);
  return recent.length ? Math.round(recent.reduce((a, s) => a + s.delivered, 0) / recent.length) : 0;
});

const W = 640; const H = 240; const PAD = 36; const BAR = 22;
const max = computed(() => Math.max(10, ...closed.value.flatMap(s => [s.committed, s.delivered, s.capacity])));
const ticks = computed(() => { const step = Math.ceil(max.value / 4 / 5) * 5; return [0, step, step * 2, step * 3, step * 4]; });
const top = computed(() => ticks.value[ticks.value.length - 1] || 10);
const y = (v: number) => 16 + (H - 40) * (1 - (Number(v) || 0) / top.value);
const groupX = (i: number) => PAD + 16 + i * ((W - PAD - 40) / Math.max(1, closed.value.length));
const days = computed(() => Number(pick(ctx.view.value, 'org.sprint_days', 14)));
const bdSprint = ref(Number(pick(ctx.view.value, 'stats.sprint', 1)));
const bd = computed(() => sprints.value.find(s => s.n === bdSprint.value) || sprints.value[sprints.value.length - 1] || null);
const bdTop = computed(() => { const m = Math.max(10, bd.value?.committed || 0); return Math.ceil(m / 5) * 5; });
const bdTicks = computed(() => [0, 1, 2, 3, 4].map(i => Math.round(i * bdTop.value / 4)));
const bx = (d: number) => PAD + 8 + (W - PAD - 24) * d / Math.max(1, days.value);
const by = (v: number) => 16 + (H - 40) * (1 - v / bdTop.value);
const bdPoints = computed(() => {
  const s = bd.value;
  if (!s) return '';
  const end = s.status === 'closed' ? Math.max(0, s.committed - s.delivered) : s.committed;
  return [[0, s.committed], [days.value, s.committed], [days.value, end]].map(([d, v]) => `${bx(d)},${by(v)}`).join(' ');
});
const scope = computed(() => rows<Record<string, any>>(ctx.view.value, 'board').reduce((a, r) => a + Number(r.points || 0), 0));
const buSeries = computed(() => { let sum = 0; return closed.value.map(s => (sum += Number(s.delivered || 0))); });
const buTop = computed(() => Math.ceil(Math.max(10, scope.value, ...buSeries.value) / 10) * 10);
const buTicks = computed(() => [0, 1, 2, 3, 4].map(i => Math.round(i * buTop.value / 4)));
const ux = (i: number) => PAD + 24 + (W - PAD - 48) * i / Math.max(1, closed.value.length - 1);
const uy = (v: number) => 16 + (H - 40) * (1 - v / buTop.value);
const buPoints = computed(() => buSeries.value.map((v, i) => `${ux(i)},${uy(v)}`).join(' '));
const tone = (n: number | undefined) => (n ?? 0) >= 70 ? 'green' : (n ?? 0) >= 50 ? 'yellow' : 'red';
const money = (n: unknown) => (Number(n) || 0).toLocaleString('en-US');

async function scorecard() {
  const result = await ctx.exec(cli(['mgr', 'scorecard']), { success: '' });
  if (result.ok) ctx.showOutput('Scorecard', String(result.output || ''));
}
async function weekly() {
  const result = await ctx.exec(cli(['mgr', 'report']), { success: '' });
  if (result.ok) ctx.showOutput('Weekly update', String(result.output || ''));
}
async function tag(line: string) {
  await ctx.exec(cli(['mgr', 'budget', 'tag', line]), { success: `${line} tagged to an owner` });
}
async function doRightsize() {
  const r = rightsize.value!;
  const result = await ctx.exec(cli(['mgr', 'budget', 'rightsize', r.line], { '--save': r.save }), { success: '' });
  if (result.ok) { rightsize.value = null; ctx.flag('success', `${r.line} right-sized`, String(result.output || '')); }
}
</script>

<style scoped>
.rr__intro { margin: 0 0 16px; max-width: 720px; }
.rr__retro { margin-bottom: 24px; padding: 16px; border: 1px solid var(--j-border); border-radius: 6px; max-width: 900px; }
.rr__retro-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 12px; }
.rr__retros { margin: 12px 0 0; padding-left: 18px; }
@container sl-portal (max-width: 700px) { .rr__retro-grid { grid-template-columns: minmax(0, 1fr); } }
.rr__legend { display: flex; gap: 16px; margin-bottom: 8px; font-size: 12px; color: var(--j-text-subtle); }
.rr__legend span { display: inline-flex; align-items: center; gap: 6px; }
.rr__swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
.rr__swatch--commit { background: #8C8F97; } .rr__swatch--done { background: #1F845A; }
.rr__swatch--cap { height: 2px; background: #1868DB; }
.rr__chart { position: relative; max-width: 760px; }
.rr__svg { width: 100%; height: 260px; display: block; }
.rr__grid { stroke: #0B120E24; stroke-width: 1; }
.rr__tick { font-size: 12px; fill: #6B6E76; }
.rr__bar--commit { fill: #8C8F97; } .rr__bar--done { fill: #1F845A; }
.rr__bar { cursor: pointer; }
.rr__cap { stroke: #1868DB; stroke-width: 2; stroke-dasharray: 4 3; }
.rr__guide { stroke: #8C8F97; stroke-width: 1.5; }
.rr__remain { fill: none; stroke: #C9372C; stroke-width: 2; }
.rr__burnup { fill: none; stroke: #1F845A; stroke-width: 2; }
.rr__dot { fill: #1F845A; }
.rr__swatch--guide { height: 2px; background: #8C8F97; }
.rr__swatch--remain { height: 2px; background: #C9372C; }
.rr__pick { max-width: 280px; }
.rr__tip { position: absolute; top: 4px; transform: translateX(-50%); padding: 8px 12px; border-radius: 4px; background: #292A2E; color: #fff; font-size: 12px; line-height: 16px; white-space: nowrap; pointer-events: none; }
.rr__gap { margin-top: 16px; margin-right: 8px; }
.rr__signals { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-width: 820px; }
.rr__signals li { display: flex; gap: 12px; padding: 12px; border-radius: 4px; background: var(--j-sunken); }
.rr__signals li.is-good > .ji { color: #22A06B; } .rr__signals li.is-warning > .ji { color: #E06C00; } .rr__signals li.is-critical > .ji { color: #C9372C; }
.rr__tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; max-width: 900px; }
.rr__tile { display: flex; flex-direction: column; gap: 6px; padding: 16px; border: 1px solid var(--j-border); border-radius: 6px; }
.rr__tile.is-overall { background: #E9F2FE; border-color: transparent; }
.rr__tile-label { text-transform: capitalize; }
.rr__tile-num { font-size: 28px; line-height: 32px; font-weight: 653; }
.rr__tile-num.is-bad { color: var(--j-danger-text); }
.rr__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; text-overflow: ellipsis; }
</style>
