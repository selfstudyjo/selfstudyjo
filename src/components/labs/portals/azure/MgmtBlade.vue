<template>
  <div>
    <div class="az-cmdbar">
      <button type="button" class="az-cmd" @click="openCreate"><AzIcon name="plus" /> Create</button>
      <button type="button" class="az-cmd" @click="openSub"><AzIcon name="subscription" /> Add subscription</button>
      <button type="button" class="az-cmd" @click="openNewSub"><AzIcon name="plus" /> New subscription</button>
      <button type="button" class="az-cmd" @click="listGroups"><AzIcon name="refresh" /> Refresh</button>
    </div>
    <p class="az-intro">Management groups give you enterprise-grade management at scale. Policy and access assigned to a
      management group are inherited by every subscription, resource group and resource beneath it.</p>
    <div class="az-filters"><input v-model="needle" class="az-filter" placeholder="Search by name or ID" /></div>
    <div class="az-tablewrap">
      <table class="az-table">
        <thead><tr><th>Name</th><th>Type</th><th>ID</th><th>Total subscriptions</th><th>Policies</th><th></th></tr></thead>
        <tbody>
          <tr v-for="row in tree" :key="row.type + row.id" :class="{ 'is-sel': selected === row.id }">
            <td><span :style="{ paddingLeft: row.depth * 22 + 'px' }" class="az-namecell">
              <AzIcon :name="row.type === 'Management group' ? 'mgmt' : 'subscription'" />
              <button type="button" class="az-link" @click="select(row)">{{ row.label }}</button></span></td>
            <td>{{ row.type }}</td><td class="az-mono">{{ row.id }}</td>
            <td>{{ row.subs }}</td><td>{{ row.policies }}</td>
            <td><button v-if="row.type === 'Management group' && row.parent" type="button" class="az-link" @click="details(row)">Details</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <pre v-if="output" class="az-code" style="margin-top: 12px">{{ output }}</pre>

    <!-- details -->
    <AzPane v-if="open" :title="open.label" subtitle="Management group" :error="error" @close="open = null">
      <div class="az-tabs">
        <button v-for="t in ['Overview', 'Access control (IAM)']" :key="t" type="button" class="az-tab" :class="{ 'is-active': paneTab === t }" @click="paneTab = t">{{ t }}</button>
      </div>
      <template v-if="paneTab === 'Overview'">
        <div class="az-kv"><span>ID</span><span>{{ open.id }}</span></div>
        <div class="az-kv"><span>Path</span><span>{{ pathOf(open.id).join(' / ') }}</span></div>
        <div class="az-field" style="margin-top: 12px"><div class="az-field__label">Display name</div>
          <div class="az-field__ctl"><input v-model="edit.display" class="az-input" /></div></div>
        <div class="az-field"><div class="az-field__label">Parent management group</div>
          <div class="az-field__ctl"><select v-model="edit.parent" class="az-select">
            <option v-for="g in groups.filter(x => x.name !== open!.id)" :key="g.name" :value="g.name">{{ g.display }}</option></select></div></div>
      </template>
      <AzIamBlade v-else :scope="`/providers/Microsoft.Management/managementGroups/${open.id}`" :scope-name="open.label" />
      <template #foot>
        <button v-if="paneTab === 'Overview'" type="button" class="az-btn az-btn--primary" @click="saveDetails">Save</button>
        <button v-if="paneTab === 'Overview'" type="button" class="az-btn az-btn--danger" @click="remove">Delete</button>
        <button type="button" class="az-btn" @click="open = null">Close</button>
      </template>
    </AzPane>

    <AzPane v-if="creating" title="Create management group" :error="error" @close="creating = false">
      <div class="az-field"><div class="az-field__label">Management group ID <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="form.name" class="az-input" placeholder="landingzones" />
          <div class="az-help">The ID cannot be changed after creation.</div></div></div>
      <div class="az-field"><div class="az-field__label">Management group display name</div>
        <div class="az-field__ctl"><input v-model="form.display" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Parent management group</div>
        <div class="az-field__ctl"><select v-model="form.parent" class="az-select">
          <option v-for="g in groups" :key="g.name" :value="g.name">{{ g.display }}</option></select></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!/^[\w().-]{1,90}$/.test(form.name)" @click="create">Submit</button>
        <button type="button" class="az-btn" @click="creating = false">Cancel</button>
      </template>
    </AzPane>

    <AzPane v-if="addingSub" title="Add subscription" subtitle="Move a subscription under a management group" :error="error" @close="addingSub = false">
      <div class="az-field"><div class="az-field__label">Subscription <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="sub.subscription" class="az-select">
          <option v-for="s in subs" :key="s.id" :value="s.name">{{ s.name }} ({{ String(s.id).slice(0, 8) }}…)</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Management group <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="sub.group" class="az-select">
          <option v-for="g in groups" :key="g.name" :value="g.name">{{ g.display }}</option></select></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!sub.subscription || !sub.group" @click="addSub">Save</button>
        <button type="button" class="az-btn" @click="addingSub = false">Cancel</button>
      </template>
    </AzPane>

    <AzPane v-if="newSub" title="Create a subscription" :error="error" @close="newSub = false">
      <div class="az-field"><div class="az-field__label">Subscription name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="ns.name" class="az-input" placeholder="sub-payments-prod" /></div></div>
      <div class="az-field"><div class="az-field__label">Management group</div>
        <div class="az-field__ctl"><select v-model="ns.group" class="az-select">
          <option v-for="g in groups" :key="g.name" :value="g.name">{{ g.display }}</option></select></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!ns.name" @click="createSub">Create</button>
        <button type="button" class="az-btn" @click="newSub = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** Management groups: the scope tree, subscriptions under it, and IAM at a group. */
import { computed, reactive, ref } from 'vue';
import { cli, errorText, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzIamBlade from './AzIamBlade.vue';
import { useAz } from './azure';

const az = useAz();
const needle = ref('');
const selected = ref('');
const output = ref('');
const error = ref('');
const groups = computed(() => rows(az.p.value, 'mgmt_groups'));
const subs = computed(() => rows(az.p.value, 'subscriptions'));
const assignments = computed(() => rows(az.p.value, 'policy_assignments'));

interface Row { id: string; label: string; type: string; depth: number; parent: string; subs: number | string; policies: number | string }
const tree = computed<Row[]>(() => {
  const out: Row[] = [];
  const walk = (name: string, depth: number) => {
    const g = groups.value.find(x => x.name === name);
    if (!g) return;
    const below = (n: string): number => subs.value.filter(s => s.mgmt_group === n).length
      + groups.value.filter(x => x.parent === n).reduce((a, x) => a + below(x.name), 0);
    out.push({ id: g.name, label: g.display, type: 'Management group', depth, parent: g.parent || '', subs: below(g.name),
               policies: assignments.value.filter(a => String(a.scope).endsWith(`/managementGroups/${g.name}`)).length });
    for (const child of groups.value.filter(x => x.parent === name)) walk(child.name, depth + 1);
    for (const s of subs.value.filter(x => x.mgmt_group === name)) {
      out.push({ id: String(s.id), label: s.name, type: 'Subscription', depth: depth + 1, parent: name, subs: '', policies: '' });
    }
  };
  for (const root of groups.value.filter(x => !x.parent)) walk(root.name, 0);
  const q = needle.value.toLowerCase();
  return q ? out.filter(r => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : out;
});
function pathOf(name: string) {
  const out: string[] = [];
  let cur = name;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) { seen.add(cur); out.unshift(cur); cur = groups.value.find(g => g.name === cur)?.parent || ''; }
  return out;
}
function select(row: Row) {
  selected.value = row.id;
  if (row.type === 'Subscription') az.go({ page: 'service', name: 'subscriptions' });
  else details(row);
}
async function listGroups() {
  const r = await az.run(cli(['az', 'account', 'management-group', 'list']), '', { quiet: true });
  output.value = String(r.ok ? r.output : r.error || '').trim();
}

const open = ref<Row | null>(null);
const paneTab = ref('Overview');
const edit = reactive({ display: '', parent: '' });
async function details(row: Row) {
  open.value = row;
  paneTab.value = 'Overview';
  edit.display = row.label;
  edit.parent = row.parent;
  error.value = '';
  await az.run(cli(['az', 'account', 'management-group', 'show'], { '--name': row.id }), '', { quiet: true });
}
async function saveDetails() {
  if (!open.value) return;
  const r = await az.run(cli(['az', 'account', 'management-group', 'update'], { '--name': open.value.id,
    '--display-name': edit.display !== open.value.label ? edit.display : '',
    '--parent': edit.parent !== open.value.parent ? edit.parent : '' }), `Updated management group '${open.value.id}'`, { quiet: true });
  if (!r.ok) { error.value = errorText(r); return; }
  open.value = null;
}
async function remove() {
  if (!open.value) return;
  const id = open.value.id;
  if (!(await az.confirm({ title: 'Delete management group', message: `Delete the management group '${id}'? It must have no child groups or subscriptions.`, typeToConfirm: id, typeLabel: 'Type the management group ID', danger: true }))) return;
  const r = await az.run(cli(['az', 'account', 'management-group', 'delete'], { '--name': id }), `Deleted management group '${id}'`, { quiet: true });
  if (!r.ok) { error.value = errorText(r); return; }
  open.value = null;
}

const creating = ref(false);
const form = reactive({ name: '', display: '', parent: 'tenant-root' });
function openCreate() { Object.assign(form, { name: '', display: '', parent: groups.value[0]?.name || 'tenant-root' }); error.value = ''; creating.value = true; }
async function create() {
  const r = await az.run(cli(['az', 'account', 'management-group', 'create'], { '--name': form.name,
    '--display-name': form.display, '--parent': form.parent }), `Management group '${form.name}' was created`, { quiet: true });
  if (!r.ok) { error.value = errorText(r); return; }
  creating.value = false;
}
const addingSub = ref(false);
const sub = reactive({ subscription: '', group: '' });
function openSub() { Object.assign(sub, { subscription: subs.value[0]?.name || '', group: groups.value[1]?.name || groups.value[0]?.name || '' }); error.value = ''; addingSub.value = true; }
async function addSub() {
  const r = await az.run(cli(['az', 'account', 'management-group', 'subscription', 'add'], { '--name': sub.group, '--subscription': sub.subscription }),
                         `Moved subscription '${sub.subscription}' to '${sub.group}'`, { quiet: true });
  if (!r.ok) { error.value = errorText(r); return; }
  addingSub.value = false;
}
const newSub = ref(false);
const ns = reactive({ name: '', group: 'tenant-root' });
function openNewSub() { Object.assign(ns, { name: '', group: groups.value[0]?.name || 'tenant-root' }); error.value = ''; newSub.value = true; }
async function createSub() {
  const r = await az.run(cli(['az', 'account', 'create'], { '--name': ns.name, '--management-group': ns.group }),
                         `Subscription '${ns.name}' was created`, { quiet: true });
  if (!r.ok) { error.value = errorText(r); return; }
  newSub.value = false;
}
</script>
