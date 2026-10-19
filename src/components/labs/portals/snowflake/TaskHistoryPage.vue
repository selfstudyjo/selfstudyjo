<template>
  <div class="sf-page">
    <div class="sf-page-head">
      <h1 class="sf-h1">Task History</h1>
      <span class="sf-spacer"></span>
      <button type="button" class="sf-btn sf-btn--primary" @click="sf.create('task')"><SfIcon name="plus" /> Task</button>
    </div>
    <div class="sf-tabs">
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'tasks' }" @click="tab = 'tasks'">Tasks</button>
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'runs' }" @click="tab = 'runs'">Task Runs</button>
    </div>
    <div v-if="tab === 'tasks'" class="sf-table-wrap">
      <table class="sf-table">
        <thead><tr><th>Task</th><th>State</th><th>Schedule</th><th>Warehouse</th><th>Last run</th><th>Last result</th><th class="sf-actions"></th></tr></thead>
        <tbody>
          <tr v-for="t in tasks" :key="t.fqn">
            <td><button type="button" class="sf-link sf-cell-name" @click="openTask(t.fqn)"><SfIcon name="task" />{{ t.fqn }}</button></td>
            <td><span class="sf-badge" :class="started(t) ? 'sf-badge--ok' : ''">{{ started(t) ? 'Started' : 'Suspended' }}</span></td>
            <td class="sf-mono">{{ t.schedule || '—' }}</td>
            <td class="sf-muted">{{ t.warehouse || 'Serverless' }}</td>
            <td class="sf-muted">{{ t.last_run !== null && t.last_run !== undefined ? fmtMinute(t.last_run) : 'Never' }}</td>
            <td><span v-if="t.last_state" class="sf-badge" :class="'sf-badge--' + statusTone(t.last_state)">{{ t.last_state }}</span></td>
            <td class="sf-actions sf-rel">
              <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" :aria-label="'Actions for ' + t.name" @click="menu = menu === t.fqn ? '' : t.fqn"><SfIcon name="more" /></button>
              <div v-if="menu === t.fqn" class="sf-menu th__menu" @mouseleave="menu = ''">
                <button v-if="!started(t)" type="button" @click="alter(t.fqn, 'RESUME')"><SfIcon name="play" /> Resume</button>
                <button v-else type="button" @click="alter(t.fqn, 'SUSPEND')"><SfIcon name="pause" /> Suspend</button>
                <button type="button" @click="execute(t.fqn)"><SfIcon name="power" /> Execute now</button>
                <button type="button" @click="openTask(t.fqn)"><SfIcon name="external" /> View details</button>
                <hr />
                <button type="button" class="is-danger" @click="drop(t.fqn)"><SfIcon name="trash" /> Drop</button>
              </div>
            </td>
          </tr>
          <tr v-if="!tasks.length"><td colspan="7"><div class="sf-empty"><SfIcon name="task" /><strong>No tasks</strong><span>Create a task to run SQL on a schedule.</span></div></td></tr>
        </tbody>
      </table>
    </div>
    <div v-else class="sf-table-wrap">
      <table class="sf-table">
        <thead><tr><th>Task</th><th>State</th><th>Scheduled</th><th>Completed</th><th>Error</th><th>Query ID</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in runs" :key="i">
            <td class="sf-mono">{{ r.task }}</td>
            <td><span class="sf-badge" :class="'sf-badge--' + statusTone(r.state)">{{ r.state }}</span></td>
            <td class="sf-muted">{{ r.scheduled || '' }}</td>
            <td class="sf-muted">{{ r.completed || '' }}</td>
            <td class="sf-muted"><span class="sf-ellipsis">{{ r.error || '' }}</span></td>
            <td><button v-if="r.query_id" type="button" class="sf-link sf-mono" @click="sf.go({ page: 'query-history', queryId: r.query_id })">{{ r.query_id.slice(0, 14) }}…</button></td>
          </tr>
          <tr v-if="!runs.length"><td colspan="6"><div class="sf-empty"><strong>No task runs yet</strong><span>A started task runs on its schedule as the lab clock advances; Execute now runs it once.</span></div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Monitoring > Task History: every task with Resume / Suspend / Execute, and its runs. */
import { computed, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import { useSf } from './sfContext';
import { pick } from '@/utils/portalKit';
import { fmtMinute, fqnSql, list, splitFqn, statusTone, type SfTask } from './snowflake';

const sf = useSf();
const tab = ref<'tasks' | 'runs'>('tasks');
const menu = ref('');
const tasks = computed(() => list.tasks(sf.view.value));
interface Run { task: string; state: string; scheduled?: string; completed?: string; error?: string; query_id?: string }
const runs = computed<Run[]>(() => {
  const explicit = pick<unknown[]>(sf.view.value, 'warehouse.task_history', []);
  if (explicit.length) {
    return explicit.filter((r): r is Record<string, any> => !!r && typeof r === 'object').map(r => ({
      task: String(r.task || r.name || ''), state: String(r.state || r.status || ''), scheduled: fmtMinute(r.scheduled ?? r.at),
      completed: fmtMinute(r.completed ?? r.at) + (r.manual ? ' (manual)' : ''), error: r.error || r.error_message, query_id: r.query_id,
    })).reverse();
  }
  return tasks.value.filter(t => t.last_run).map(t => ({ task: t.fqn, state: String(t.last_state || ''), scheduled: fmtMinute(t.last_run), completed: fmtMinute(t.last_run) }));
});
function started(t: SfTask) { return String(t.state || '').toLowerCase() === 'started'; }

async function alter(fqn: string, action: 'RESUME' | 'SUSPEND') {
  menu.value = '';
  await sf.sql(`ALTER TASK ${fqnSql(fqn)} ${action}`, { success: `Task ${action === 'RESUME' ? 'resumed' : 'suspended'}` });
}
async function execute(fqn: string) {
  menu.value = '';
  await sf.sql(`EXECUTE TASK ${fqnSql(fqn)}`, { success: 'Task run started' });
}
async function drop(fqn: string) {
  menu.value = '';
  const ok = await sf.confirm({ title: 'Drop task?', message: `${fqn} will be dropped. This cannot be undone.`, yes: 'Drop', danger: true });
  if (ok) await sf.sql(`DROP TASK ${fqnSql(fqn)}`, { success: 'Task dropped' });
}
function openTask(fqn: string) {
  menu.value = '';
  const [db, schema] = splitFqn(fqn);
  sf.go({ page: 'databases', db, schema, kind: 'tasks', object: fqn });
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.th__menu { right: 8px; top: 34px; }
</style>
