<template>
  <div class="qm">
    <div class="toolbar">
      <button type="button" class="btn btn-default" :disabled="busy" @click="openAdd"><AmbIcon name="plus" :size="11" />Add Queue</button>
      <span class="spacer"></span>
      <span v-if="dirty" class="qm__dirty">Unsaved changes</span>
      <button type="button" class="btn btn-default" :disabled="!dirty || busy" @click="reset">Discard</button>
      <button type="button" class="btn btn-success" :disabled="!dirty || busy || !!error" @click="save">Save and Refresh Queues</button>
    </div>
    <div v-if="error && dirty" class="alert alert-danger">{{ error }}</div>

    <div class="qm__body">
      <div class="panel qm__tree">
        <div class="panel-heading"><h4>Queues</h4></div>
        <div class="qm__root" :class="{ active: !selectedName }">
          <button type="button" class="qm__node" @click="selectedName = ''">
            <strong>root</strong><span class="qm__pct">{{ total.toFixed(0) }}%</span>
          </button>
        </div>
        <ul class="qm__children">
          <li v-for="q in draft" :key="q.name" :class="{ active: selectedName === q.name, 'is-new': q.isNew, 'is-removed': q.removed }">
            <button type="button" class="qm__node" @click="selectedName = q.name">
              <span class="qm__name">
                <AmbIcon :name="q.state === 'RUNNING' ? 'ok' : 'stop'" :class="q.state === 'RUNNING' ? 'health-ok' : 'health-down'" :size="11" />
                {{ q.name }}
              </span>
              <span class="qm__pct">{{ q.capacity }}%</span>
            </button>
            <div class="qm__bar"><i :style="{ width: Math.min(100, Number(q.capacity) || 0) + '%' }"></i><b :style="{ width: Math.min(100, Number(q.used) || 0) + '%' }"></b></div>
          </li>
        </ul>
      </div>

      <div class="panel qm__edit">
        <template v-if="selected">
          <div class="panel-heading">
            <h4>root.{{ selected.name }}</h4>
            <span v-if="selected.removed" class="label label-crit">To be deleted</span>
            <span v-else-if="selected.isNew" class="label label-warn">New</span>
            <span class="spacer"></span>
            <button v-if="!selected.removed" type="button" class="btn btn-danger btn-sm" :disabled="selected.name === 'default'"
                    :title="selected.name === 'default' ? 'The default queue cannot be deleted' : ''" @click="removeQueue(selected)">
              <AmbIcon name="trash" :size="11" />Delete Queue
            </button>
            <button v-else type="button" class="btn btn-default btn-sm" @click="selected.removed = false">Undo delete</button>
          </div>
          <div class="panel-body qm__form">
            <div class="form-group" :class="{ 'has-error': capError(selected) }">
              <label :for="`qm-cap-${selected.name}`">Capacity</label>
              <div class="qm__input"><input :id="`qm-cap-${selected.name}`" v-model.number="selected.capacity" type="number" min="0" max="100" step="1" class="form-control" :disabled="selected.removed" /><span>%</span></div>
              <span class="help-block">{{ capError(selected) || 'Share of root guaranteed to this queue.' }}</span>
            </div>
            <div class="form-group">
              <label :for="`qm-max-${selected.name}`">Max Capacity</label>
              <div class="qm__input"><input :id="`qm-max-${selected.name}`" v-model.number="selected.maximum_capacity" type="number" min="0" max="100" step="1" class="form-control" :disabled="selected.removed" /><span>%</span></div>
              <span class="help-block">How far it may grow into idle capacity.</span>
            </div>
            <div class="form-group">
              <label>State</label>
              <label class="qm__radio"><input v-model="selected.state" type="radio" value="RUNNING" :disabled="selected.removed" /> Running</label>
              <label class="qm__radio"><input v-model="selected.state" type="radio" value="STOPPED" :disabled="selected.removed" /> Stopped</label>
              <span class="help-block">A queue must be stopped before it can be deleted. A stopped queue refuses new applications.</span>
            </div>
            <p class="text-muted">Running applications: {{ selected.running || 0 }}</p>
          </div>
        </template>
        <template v-else>
          <div class="panel-heading"><h4>root</h4></div>
          <div class="panel-body">
            <p>Children: {{ draft.filter(q => !q.removed).length }} · Total capacity of children:
              <strong :class="Math.abs(total - 100) > 0.01 ? 'health-down' : 'health-ok'">{{ total }}%</strong></p>
            <p class="text-muted">The capacities of root's children must add up to exactly 100%. All changes are saved
              together, so moving capacity from one queue to another is a single save.</p>
          </div>
        </template>
      </div>
    </div>

    <AmbModal v-if="adding" title="Add Queue" ok-text="Add" small :ok-disabled="!!addError || !newName.trim()" @close="adding = false" @ok="addQueue">
      <div class="form-group" :class="{ 'has-error': addError }">
        <label for="qm-new">Queue name</label>
        <div class="qm__input"><span class="mono">root.</span><input id="qm-new" v-model="newName" class="form-control" @keydown.enter="addQueue" /></div>
        <span v-if="addError" class="help-block">{{ addError }}</span>
      </div>
    </AmbModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import { cli, rows } from '@/utils/portalKit';
import AmbIcon from './AmbIcon.vue';
import AmbModal from './AmbModal.vue';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean }>();

interface Q { name: string; capacity: number; maximum_capacity: number; state: string; running?: number; used?: number; isNew?: boolean; removed?: boolean }

const stored = computed<Q[]>(() => {
  const list = rows<Q>(props.view, 'yarn.queues');
  return list.length ? list : [{ name: 'default', capacity: 100, maximum_capacity: 100, state: 'RUNNING' }];
});
const draft = ref<Q[]>([]);
const selectedName = ref('');
const adding = ref(false);
const newName = ref('');

function reset() {
  draft.value = stored.value.map(q => ({ ...q, capacity: Number(q.capacity), maximum_capacity: Number(q.maximum_capacity) }));
}
watch(stored, reset, { immediate: true, deep: true });

const selected = computed(() => draft.value.find(q => q.name === selectedName.value) || null);
const total = computed(() => draft.value.filter(q => !q.removed).reduce((n, q) => n + (Number(q.capacity) || 0), 0));

function capError(q: Q) {
  const cap = Number(q.capacity);
  if (!Number.isFinite(cap) || cap < 0 || cap > 100) return 'Capacity must be between 0 and 100';
  if (Number(q.maximum_capacity) < cap) return 'Max Capacity cannot be lower than Capacity';
  return '';
}

const ops = computed(() => {
  const add: string[] = [];
  const update: string[] = [];
  const remove: string[] = [];
  for (const q of draft.value) {
    const before = stored.value.find(s => s.name === q.name);
    if (q.removed) {
      if (before) remove.push(`root.${q.name}`);
      continue;
    }
    if (!before) {
      add.push(`root.${q.name}:capacity=${q.capacity},maximum-capacity=${q.maximum_capacity},state=${q.state}`);
      continue;
    }
    const props2: string[] = [];
    if (Number(before.capacity) !== Number(q.capacity)) props2.push(`capacity=${q.capacity}`);
    if (Number(before.maximum_capacity) !== Number(q.maximum_capacity)) props2.push(`maximum-capacity=${q.maximum_capacity}`);
    if (before.state !== q.state) props2.push(`state=${q.state}`);
    if (props2.length) update.push(`root.${q.name}:${props2.join(',')}`);
  }
  return { add, update, remove };
});
const dirty = computed(() => ops.value.add.length + ops.value.update.length + ops.value.remove.length > 0);
const error = computed(() => {
  for (const q of draft.value.filter(x => !x.removed)) {
    const problem = capError(q);
    if (problem) return `root.${q.name}: ${problem}`;
  }
  if (Math.abs(total.value - 100) > 0.01) return `The capacities of root's children add up to ${total.value}%, not 100%.`;
  const stoppedFirst = draft.value.find(q => q.removed && stored.value.find(s => s.name === q.name)?.state !== 'STOPPED');
  if (stoppedFirst) return `root.${stoppedFirst.name} must be STOPPED (and saved) before it can be deleted.`;
  return '';
});

function openAdd() {
  newName.value = '';
  adding.value = true;
}
const addError = computed(() => {
  const name = newName.value.trim();
  if (!name) return '';
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return 'Use letters, digits, "-" and "_" only';
  if (draft.value.some(q => q.name === name)) return `Queue root.${name} already exists`;
  return '';
});
function addQueue() {
  if (addError.value || !newName.value.trim()) return;
  draft.value.push({ name: newName.value.trim(), capacity: 0, maximum_capacity: 100, state: 'RUNNING', isNew: true });
  selectedName.value = newName.value.trim();
  adding.value = false;
}
function removeQueue(q: Q) {
  if (q.isNew) {
    draft.value = draft.value.filter(x => x !== q);
    selectedName.value = '';
  } else {
    q.removed = true;
  }
}

async function save() {
  if (error.value) return;
  const { add, update, remove } = ops.value;
  const command = cli(['yarn', 'schedulerconf'], {
    '-add': add.length ? add.join(';') : null,
    '-update': update.length ? update.join(';') : null,
    '-remove': remove.length ? remove.join(';') : null,
  });
  await props.api.exec(command, { success: 'Queues saved and refreshed', failure: 'The scheduler refused the configuration' });
}
</script>

<style scoped>
.qm__dirty { color: #b8661f; font-size: 13px; }
.qm__body { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; }
.qm__tree, .qm__edit { margin: 0; }
.qm__edit .spacer { flex: 1; }
.qm__edit .panel-heading h4 { text-transform: none; color: #333; font-size: 15px; }
.qm__root, .qm__children li { border-bottom: 1px solid #f0f0f0; }
.qm__children { list-style: none; margin: 0; padding: 0 0 0 18px; }
.qm__node { display: flex; width: 100%; align-items: center; justify-content: space-between; border: 0; background: none; padding: 9px 12px; font: inherit; font-size: 13px; cursor: pointer; color: #333; }
.qm__root.active, .qm__children li.active { background: #eef7ec; }
.qm__children li.is-new .qm__name { font-style: italic; }
.qm__children li.is-removed .qm__name { text-decoration: line-through; color: #707070; }
.qm__name { display: flex; align-items: center; gap: 6px; }
.qm__pct { color: #666; }
.qm__bar { position: relative; height: 5px; margin: -4px 12px 8px; background: #eee; }
.qm__bar i { position: absolute; inset: 0 auto 0 0; background: #b3e0d9; }
.qm__bar b { position: absolute; inset: 0 auto 0 0; background: #41bfae; }
.qm__form { max-width: 420px; }
.qm__input { display: flex; align-items: center; gap: 6px; }
.qm__input .form-control { max-width: 140px; }
.qm__radio { display: inline-flex !important; align-items: center; gap: 6px; margin-right: 16px; font-weight: 400 !important; }
@container sl-portal (max-width: 760px) { .qm__body { grid-template-columns: minmax(0, 1fr); } }
</style>
