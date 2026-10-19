<template>
  <div class="af-cal">
    <div v-for="year in years" :key="year.year" class="af-cal__year">
      <div class="af-cal__ytitle">{{ year.year }}</div>
      <div class="af-cal__scroll">
        <svg :width="year.weeks * CELL + 34" :height="7 * CELL + 22" role="img" :aria-label="'DAG runs in ' + year.year">
          <text v-for="m in year.months" :key="m.label + m.x" :x="34 + m.x" y="11" class="af-cal__mlabel">{{ m.label }}</text>
          <text v-for="(d, i) in ['Mon', 'Wed', 'Fri']" :key="d" x="0" :y="22 + (i * 2 + 1) * CELL + 10" class="af-cal__dlabel">{{ d }}</text>
          <g v-for="day in year.days" :key="day.date" :transform="`translate(${34 + day.week * CELL},${16 + day.dow * CELL})`"
             class="af-cal__day" :class="{ 'has-run': day.runs.length }" @click="pick(day)">
            <title>{{ day.date }}{{ day.runs.length ? '\n' + day.summary : day.planned ? '\nplanned' : '' }}</title>
            <rect :width="CELL - 2" :height="CELL - 2" rx="2" :fill="day.fill" :stroke="day.planned ? '#017cee' : '#e2e2e2'"
                  :stroke-dasharray="day.planned ? '2 1' : ''" />
          </g>
        </svg>
      </div>
    </div>
    <div class="af-cal__legend">
      <span class="af-state"><i :style="{ background: '#008000' }"></i>success</span>
      <span class="af-state"><i :style="{ background: '#ff0000' }"></i>failed</span>
      <span class="af-state"><i :style="{ background: '#00ff00' }"></i>running</span>
      <span class="af-state"><i :style="{ background: '#808080' }"></i>queued</span>
      <span class="af-state"><i class="af-cal__planned"></i>planned</span>
      <span class="af-state"><i :style="{ background: '#fff' }"></i>no status</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAf } from './afContext';
import { dayOf, normState, stateColor, type AfDag, type AfRun } from './airflow';

const props = defineProps<{ dag: AfDag }>();
const emit = defineEmits<{ (event: 'select-run', runId: string): void }>();
const af = useAf();
const CELL = 15;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const runs = computed(() => af.runsOf(props.dag.dag_id));
const byDay = computed(() => {
  const map = new Map<string, AfRun[]>();
  for (const r of runs.value) {
    const d = dayOf(r.logical_date);
    if (d) (map.get(d) || map.set(d, []).get(d) as AfRun[]).push(r);
  }
  return map;
});
const nextDay = computed(() => dayOf(props.dag.next_run));

function fillFor(list: AfRun[]) {
  const states = list.map(r => normState(r.state));
  for (const s of ['failed', 'running', 'queued', 'success']) if (states.includes(s)) return stateColor(s);
  return '#fff';
}

const years = computed(() => {
  const set = new Set<number>();
  for (const d of byDay.value.keys()) set.add(Number(d.slice(0, 4)));
  if (nextDay.value) set.add(Number(nextDay.value.slice(0, 4)));
  if (!set.size) set.add(Number(dayOf(props.dag.start_date).slice(0, 4)) || 2026);
  return [...set].filter(Boolean).sort().map(year => {
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const offset = (jan1.getUTCDay() + 6) % 7; // Monday-first rows
    const days: { date: string; week: number; dow: number; runs: AfRun[]; fill: string; planned: boolean; summary: string }[] = [];
    const months: { label: string; x: number }[] = [];
    for (let i = 0; i < 366; i++) {
      const dt = new Date(Date.UTC(year, 0, 1 + i));
      if (dt.getUTCFullYear() !== year) break;
      const date = dt.toISOString().slice(0, 10);
      const index = i + offset;
      const list = byDay.value.get(date) || [];
      if (dt.getUTCDate() === 1) months.push({ label: MONTHS[dt.getUTCMonth()] ?? '', x: Math.floor(index / 7) * CELL });
      const counts: Record<string, number> = {};
      list.forEach(r => { const s = normState(r.state); counts[s] = (counts[s] || 0) + 1; });
      days.push({
        date, week: Math.floor(index / 7), dow: index % 7, runs: list, fill: list.length ? fillFor(list) : '#fff',
        planned: !list.length && !props.dag.paused && Boolean(nextDay.value) && date === nextDay.value,
        summary: Object.entries(counts).map(([s, n]) => `${s}: ${n}`).join('\n'),
      });
    }
    return { year, days, months, weeks: Math.ceil((offset + days.length) / 7) };
  });
});

function pick(day: { runs: AfRun[] }) {
  const last = day.runs[day.runs.length - 1];
  if (last) emit('select-run', last.run_id);
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-cal { display: flex; flex-direction: column; gap: 14px; }
.af-cal__ytitle { font-size: 16px; font-weight: 600; color: var(--af-text-strong); margin-bottom: 4px; }
.af-cal__scroll { overflow-x: auto; }
.af-cal__scroll svg { max-width: none; display: block; }
.af-cal__mlabel, .af-cal__dlabel { font-size: 10px; fill: #888; font-family: var(--af-font); }
.af-cal__day.has-run { cursor: pointer; }
.af-cal__day.has-run:hover rect { stroke: #333; }
.af-cal__legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--af-text-2); }
.af-cal__planned { background: #fff !important; border: 1px dashed #017cee !important; }
</style>
