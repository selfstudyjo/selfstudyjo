<template>
  <div class="page">
    <SnList title="Incidents" :columns="COLUMNS" :rows="rowsShown" :crumbs="crumbs" :initial-text="text"
            :bulk-actions="['Delete']" default-sort="" @new="$emit('navigate', { page: 'incident', id: '-1' })"
            @open="open" @bulk="bulk">
      <template #filters>
        <div class="seg" role="tablist" aria-label="Incident filters">
          <button v-for="f in FILTERS" :key="f.id" type="button" class="seg__btn" :class="{ 'is-on': filter === f.id }"
                  role="tab" :aria-selected="filter === f.id" @click="$emit('navigate', { page: 'incident_list', filter: f.id })">
            {{ f.label }} <span class="seg__count">{{ countFor(f.id) }}</span>
          </button>
        </div>
      </template>
      <template #cell="{ row, col }">
        <button v-if="col.key === 'number'" type="button" class="link" @click="open(row)">{{ row.number }}</button>
        <span v-else-if="col.key === 'priority'"><i class="dot" :class="'dot--p' + row.priority"></i>{{ PRIORITY_LABEL[row.priority] }}</span>
        <span v-else-if="col.key === 'state'"><i class="dot" :class="'dot--' + slug(row.state)"></i>{{ row.state }}</span>
        <span v-else-if="col.key === 'caller'">{{ personName(model, row.caller) }}</span>
        <span v-else-if="col.key === 'assigned_to'">{{ personName(model, row.assigned_to) }}</span>
        <SlaBar v-else-if="col.key === 'sla'" :sla="worstSla(row)" />
        <span v-else-if="col.key === 'short'" class="short">{{ row.short }}</span>
        <template v-else>{{ (row as any)[col.key] }}</template>
      </template>
    </SnList>

    <SnModal v-if="pendingDelete.length" title="Confirmation" size="sm" @close="pendingDelete = []">
      <p>Delete {{ pendingDelete.length }} record{{ pendingDelete.length > 1 ? 's' : '' }}?</p>
      <p class="muted">{{ pendingDelete.join(', ') }}</p>
      <p class="muted">Related Task SLAs and on-call pages are deleted with the incident. Only a New, unworked incident or a Canceled one can be deleted.</p>
      <template #footer>
        <button type="button" class="btn" @click="pendingDelete = []">Cancel</button>
        <button type="button" class="btn btn--danger-solid" @click="confirmDelete">Delete</button>
      </template>
    </SnModal>
  </div>
</template>

<script setup lang="ts">
/** incident_list.do: the queue, with the four standard filters and SLA bars. */
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import SnList, { type Column } from './SnList.vue';
import SnModal from './SnModal.vue';
import SlaBar from './SlaBar.vue';
import { PRIORITY_LABEL, cmd, isOpen, myGroups, personName, worstSla, type Incident, type Model } from './snow';
import type { IncidentFilter, Route } from './route';

const props = defineProps<{ model: Model; api: PortalApi; filter: IncidentFilter; text: string }>();
const emit = defineEmits<{ (event: 'navigate', route: Route): void }>();

const COLUMNS: Column[] = [
  { key: 'number', label: 'Number' },
  { key: 'opened', label: 'Opened' },
  { key: 'short', label: 'Short description' },
  { key: 'caller', label: 'Caller' },
  { key: 'priority', label: 'Priority' },
  { key: 'state', label: 'State' },
  { key: 'category', label: 'Category' },
  { key: 'group', label: 'Assignment group' },
  { key: 'assigned_to', label: 'Assigned to' },
  { key: 'sla', label: 'SLA (business elapsed)', search: false },
];
const FILTERS: { id: IncidentFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'open', label: 'Open' },
  { id: 'mine', label: 'Assigned to me' }, { id: 'group', label: 'My group' },
];

const pendingDelete = ref<string[]>([]);

function inFilter(row: Incident, f: IncidentFilter): boolean {
  const m = props.model;
  switch (f) {
    case 'all': return true;
    case 'open': return isOpen(row);
    case 'mine': return isOpen(row) && row.assigned_to === m.user;
    case 'group': return isOpen(row) && myGroups(m).includes(row.group);
    case 'unassigned': return isOpen(row) && !row.assigned_to;
    case 'p1': return isOpen(row) && row.priority === 1;
  }
  return true;
}
const rowsShown = computed(() => props.model.incidents
  .filter(r => inFilter(r, props.filter))
  .slice()
  .sort((a, b) => (props.filter === 'all' ? b.number.localeCompare(a.number) : a.priority - b.priority || a.opened_minute - b.opened_minute)));
function countFor(f: IncidentFilter) { return props.model.incidents.filter(r => inFilter(r, f)).length; }

const CRUMB: Record<IncidentFilter, string[]> = {
  all: [], open: ['Active = true'], mine: ['Active = true', 'Assigned to = (me)'],
  group: ['Active = true', 'Assignment group = (dynamic) One of My Groups'],
  unassigned: ['Active = true', 'Assigned to is empty'], p1: ['Active = true', 'Priority = 1 - Critical'],
};
const crumbs = computed(() => CRUMB[props.filter].map((label, i) => ({
  label,
  go: () => { if (i === 0) emit('navigate', { page: 'incident_list', filter: 'open' }); },
})));

function slug(text: string) { return text.toLowerCase().replace(/\s+/g, '-'); }
function open(row: Incident) { emit('navigate', { page: 'incident', id: row.number }); }
function bulk(action: string, keys: string[]) {
  if (action === 'Delete' && keys.length) pendingDelete.value = keys;
}
async function confirmDelete() {
  const keys = pendingDelete.value;
  pendingDelete.value = [];
  for (const number of keys) {
    const result = await props.api.exec(cmd.incidentDelete(number), { success: `${number} deleted`, failure: `${number} was not deleted` });
    if (!result.ok) break;
  }
}
</script>

<style scoped src="./sn.css"></style>
<style scoped>
.page { height: 100%; }
.seg { display: inline-flex; border: 1px solid var(--sn-border-strong); border-radius: var(--sn-radius); overflow: hidden; }
.seg__btn { padding: 0.25rem 0.7rem; border: 0; border-right: 1px solid var(--sn-border-strong); background: var(--sn-surface); color: var(--sn-text);
  font: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.seg__btn:last-child { border-right: 0; }
.seg__btn.is-on { background: var(--sn-brand); color: #fff; }
.seg__count { margin-left: 0.2rem; padding: 0 0.35rem; border-radius: 0.6rem; background: rgba(0, 0, 0, 0.08); font-size: 0.7rem; }
.seg__btn.is-on .seg__count { background: rgba(255, 255, 255, 0.2); }
.short { display: inline-block; min-width: 14rem; }
</style>
