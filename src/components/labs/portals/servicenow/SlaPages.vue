<template>
  <SnList v-if="route.page === 'sla_defs'" title="SLA Definitions" :columns="DEF_COLUMNS" :rows="definitions" row-key="name" new-label="" table="contract_sla" :api="api">
    <template #cell="{ row, col }">
      <span v-if="col.key === 'name'" class="strong">{{ row.name }}</span>
      <template v-else>{{ (row as any)[col.key] }}</template>
    </template>
  </SnList>
  <SnList v-else title="Task SLAs" :columns="TASK_COLUMNS" :rows="taskSlas" row-key="id" new-label="" table="task_sla" :api="api"
          @open="r => $emit('navigate', { page: 'incident', id: r.task })">
    <template #cell="{ row, col }">
      <button v-if="col.key === 'task'" type="button" class="link" @click="$emit('navigate', { page: 'incident', id: row.task })">{{ row.task }}</button>
      <span v-else-if="col.key === 'stage'"><i class="dot" :class="'dot--' + row.stageRaw.replace(' ', '-')"></i>{{ row.stage }}</span>
      <SlaBar v-else-if="col.key === 'percent'" :sla="row.sla" />
      <template v-else>{{ (row as any)[col.key] }}</template>
    </template>
  </SnList>
</template>

<script setup lang="ts">
/** contract_sla_list.do (the contract, read-only) and task_sla_list.do (every running clock). */
import { computed } from 'vue';
import type { PortalApi } from '../usePortal';
import SnList, { type Column } from './SnList.vue';
import SlaBar from './SlaBar.vue';
import { PRIORITY_LABEL, SLA_LABEL, STAGE_LABEL, type Model } from './snow';
import type { Route } from './route';

const props = defineProps<{ model: Model; api: PortalApi; route: Route }>();
defineEmits<{ (event: 'navigate', route: Route): void }>();

const DEF_COLUMNS: Column[] = [
  { key: 'name', label: 'Name' }, { key: 'table', label: 'Table' }, { key: 'type', label: 'Type' },
  { key: 'target', label: 'Target' }, { key: 'duration', label: 'Duration' }, { key: 'schedule', label: 'Schedule' },
  { key: 'start', label: 'Start condition' }, { key: 'stop', label: 'Stop condition' }, { key: 'pause', label: 'Pause condition' },
];
const TASK_COLUMNS: Column[] = [
  { key: 'task', label: 'Task' }, { key: 'priority', label: 'Priority' }, { key: 'definition', label: 'SLA definition' },
  { key: 'stage', label: 'Stage' }, { key: 'target', label: 'Target' }, { key: 'elapsed', label: 'Business elapsed time' },
  { key: 'percent', label: 'Business elapsed percentage', search: false }, { key: 'breached', label: 'Has breached' },
  { key: 'start', label: 'Start time' }, { key: 'stop', label: 'Stop time' },
];
const STOP: Record<string, string> = {
  pickup: 'Assigned to is a person AND State = In Progress (acknowledged)',
  response: 'First Additional comments (Customer visible)',
  restore: 'State = Resolved',
};
const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 1440) ? Math.floor(m / 1440) + 'd ' : ''}${Math.floor((m % 1440) / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m}m`);

const definitions = computed(() => props.model.choices.sla_targets.flatMap(t => ([
  ['pickup', 'Pick-up', t.pickup], ['response', 'Response', t.response], ['restore', 'Resolution (restore)', t.restore],
] as [string, string, number][]).map(([key, label, minutes]) => ({
  name: `P${t.priority} ${label} (${fmt(minutes)})`, table: 'Incident [incident]', type: 'SLA', target: key === 'restore' ? 'Resolution' : 'Response',
  duration: fmt(minutes), schedule: '24 x 7', start: `Priority = ${PRIORITY_LABEL[t.priority]}`, stop: STOP[key],
  pause: key === 'restore' ? (t.priority === 1 ? 'None (a P1 cannot be placed On Hold)' : 'On hold reason = Awaiting Caller') : 'None',
}))));

const taskSlas = computed(() => props.model.incidents.flatMap(i => i.slas.filter(s => s.stage !== 'cancelled').map(s => ({
  id: `${i.number}:${s.name}`, task: i.number, priority: PRIORITY_LABEL[i.priority], definition: s.definition,
  stage: STAGE_LABEL[s.stage] || s.stage, stageRaw: s.stage, target: SLA_LABEL[s.name] || s.name, elapsed: s.elapsed_text,
  percent: s.percent, sla: s, breached: s.has_breached ? 'true' : 'false', start: s.start, stop: s.stop,
}))));
</script>

<style scoped src="./sn.css"></style>
<style scoped>.strong { font-weight: 700; }</style>
