<template>
  <div class="az-blade">
    <div class="az-blade__head">
      <AzIcon :name="icon" :size="28" class="az-blade__icon" />
      <div class="az-blade__titles">
        <h1 class="az-blade__title">{{ title }}</h1>
        <div class="az-blade__sub">{{ account.directory }} ({{ account.domain }})</div>
      </div>
    </div>

    <div class="az-cmdbar">
      <button v-if="canCreate" type="button" class="az-cmd" @click="create"><AzIcon name="plus" /> Create</button>
      <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
      <button type="button" class="az-cmd" @click="exportCsv"><AzIcon name="download" /> Export to CSV</button>
      <span class="az-cmdsep"></span>
      <button type="button" class="az-cmd" :disabled="!selected.length" @click="tagging = true"><AzIcon name="tag" /> Assign tags</button>
      <template v-if="kind === 'vm'">
        <button type="button" class="az-cmd" :disabled="!selected.length" @click="power('start')"><AzIcon name="play" /> Start</button>
        <button type="button" class="az-cmd" :disabled="!selected.length" @click="power('restart')"><AzIcon name="restart" /> Restart</button>
        <button type="button" class="az-cmd" :disabled="!selected.length" @click="power('stop')"><AzIcon name="stop" /> Stop</button>
      </template>
      <button type="button" class="az-cmd az-cmd--danger" :disabled="!selected.length" @click="removeSelected">
        <AzIcon name="trash" /> Delete</button>
    </div>

    <div class="az-filters">
      <input v-model="needle" class="az-filter" placeholder="Filter for any field..." aria-label="Filter for any field" />
      <span class="az-pill">Subscription equals <b>all</b></span>
      <label v-if="kind !== 'groups'" class="az-pill">Resource group equals
        <select v-model="groupFilter" aria-label="Resource group filter"><option value="">all</option>
          <option v-for="g in groupNames" :key="g" :value="g">{{ g }}</option></select></label>
      <label v-if="kind === 'all'" class="az-pill">Type equals
        <select v-model="typeFilter" aria-label="Type filter"><option value="">all</option>
          <option v-for="t in typeNames" :key="t" :value="t">{{ meta(t).singular }}</option></select></label>
      <label class="az-pill">Location equals
        <select v-model="locFilter" aria-label="Location filter"><option value="">all</option>
          <option v-for="l in locNames" :key="l" :value="l">{{ locName(l) }}</option></select></label>
      <span class="az-filters__right">
        <label class="az-pill"><select v-model="grouping" aria-label="Grouping">
          <option value="">No grouping</option>
          <option value="group" v-if="kind !== 'groups'">Group by resource group</option>
          <option value="kind" v-if="kind === 'all'">Group by type</option>
          <option value="location">Group by location</option>
        </select></label>
      </span>
    </div>
    <div class="az-count">Showing {{ list.length ? 1 : 0 }} to {{ list.length }} of {{ list.length }} records.</div>

    <div v-if="!allRows.length" class="az-empty">
      <AzIcon :name="icon" :size="64" />
      <h3>No {{ lower(title) }} to display</h3>
      <p>{{ emptyText }}</p>
      <button v-if="canCreate" type="button" class="az-btn az-btn--primary" @click="create">Create {{ lower(singular) }}</button>
    </div>
    <template v-else>
      <div v-for="section in sections" :key="section.label">
        <div v-if="grouping" class="az-grouphead">{{ section.label }} ({{ section.rows.length }})</div>
        <AzTable v-model:selected="selected" :columns="columns" :rows="section.rows" row-key="id" selectable
                 menu @menu="(row, x, y) => (ctx = { row, x, y })">
          <template #cell-name="{ row }">
            <button type="button" class="az-link az-namecell" @click="open(row)">
              <AzIcon :name="kind === 'groups' ? 'group' : meta(row.kind).icon" /> {{ row.name }}</button>
          </template>
          <template #cell-group="{ row }">
            <button type="button" class="az-link" @click="az.go({ page: 'group', name: row.group })">{{ row.group }}</button>
          </template>
          <template #cell-status="{ row }">
            <span class="az-status"><AzIcon :name="row.status === 'Running' ? 'running' : 'stopped'" :size="10" /> {{ row.status }}</span>
          </template>
        </AzTable>
      </div>
    </template>

    <AzPane v-if="tagging" title="Assign tags" :subtitle="`${selected.length} resource(s) selected`" :error="tagError"
            @close="tagging = false">
      <p class="az-intro">The tags below are merged into each selected resource's existing tags.</p>
      <AzTagEditor v-model="bulkTags" />
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!Object.keys(bulkTags).length" @click="applyTags">Save</button>
        <button type="button" class="az-btn" @click="tagging = false">Cancel</button>
      </template>
    </AzPane>
    <AzResMenu v-if="ctx" :target="ctx.row" :x="ctx.x" :y="ctx.y" @close="ctx = null" />
  </div>
</template>

<script setup lang="ts">
/** A browse blade: All resources, Resource groups, or one resource type. */
import { computed, ref } from 'vue';
import { cli, errorText, matches, pick, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import AzResMenu from './AzResMenu.vue';
import AzTagEditor from './AzTagEditor.vue';
import { allResources, CREATABLE, deleteCommand, deleteOrder, locName, meta, tagPairs, useAz } from './azure';

const az = useAz();
const ctx = ref<{ row: Record<string, any>; x: number; y: number } | null>(null);
const kind = computed(() => az.route.value.kind || 'all');
const account = computed(() => pick(az.p.value, 'account', {} as Record<string, any>));
const title = computed(() => (kind.value === 'all' ? 'All resources' : kind.value === 'groups' ? 'Resource groups'
  : meta(kind.value).plural));
const singular = computed(() => (kind.value === 'groups' ? 'Resource group' : kind.value === 'all' ? 'resource'
  : meta(kind.value).singular));
const icon = computed(() => (kind.value === 'all' ? 'allservices' : kind.value === 'groups' ? 'group' : meta(kind.value).icon));
const canCreate = computed(() => kind.value === 'groups' || kind.value === 'all' || CREATABLE.includes(kind.value));
const emptyText = computed(() => (kind.value === 'groups'
  ? 'Try changing your filters if you don\'t see what you\'re looking for.'
  : `Create ${/^[aeiou]/i.test(singular.value) ? 'an' : 'a'} ${lower(singular.value)} to get started.`));
/** Sentence case that leaves product names and acronyms alone ("Azure Cosmos DB account"). */
function lower(text: string) {
  return String(text).split(' ').map(w => (/^(Azure|Cosmos|Kubernetes)$/.test(w) || /[A-Z].*[A-Z]/.test(w) ? w : w.toLowerCase())).join(' ');
}

const needle = ref('');
const groupFilter = ref('');
const typeFilter = ref('');
const locFilter = ref('');
const grouping = ref('');
const selected = ref<string[]>([]);

const sub = computed(() => String(account.value.subscription_name || 'Self Study Lab'));
const allRows = computed<Record<string, any>[]>(() => {
  if (kind.value === 'groups') {
    return rows(az.p.value, 'groups').map(g => ({ id: g.id, name: g.name, location: g.location,
      locationName: locName(g.location), subscription: sub.value, tags: g.tags, kind: 'group' }));
  }
  const all = allResources(az.p.value);
  const list = kind.value === 'all' ? all : all.filter(r => r.kind === kind.value);
  return list.map(r => {
    const p = r.props || {};
    const row: Record<string, any> = { ...r, type: meta(r.kind).singular, locationName: locName(r.location),
      subscription: sub.value };
    if (r.kind === 'vm') {
      row.status = p.power === 'VM running' ? 'Running' : p.power === 'VM deallocated' ? 'Stopped (deallocated)' : 'Stopped';
      row.os = String(p.image || '').startsWith('Win') ? 'Windows' : 'Linux';
      row.size = p.size;
      row.publicIp = p.public_ip || '—';
    }
    if (r.kind === 'storage') { row.accountKind = p.account_kind; row.replication = p.sku; }
    if (r.kind === 'webapp') { row.status = p.web_state || 'Running'; row.plan = p.plan; row.url = p.host; }
    if (r.kind === 'aks') { row.k8s = p.version; row.nodes = p.nodes; }
    if (r.kind === 'publicip') { row.address = p.address; }
    if (r.kind === 'vnet') { row.space = p.address_space; }
    if (r.kind === 'sqldb') { row.server = p.server; row.tier = p.sku; row.status = 'Online'; }
    return row;
  });
});
const groupNames = computed(() => rows(az.p.value, 'groups').map(g => String(g.name)));
const typeNames = computed(() => [...new Set(allResources(az.p.value).map(r => String(r.kind)))]);
const locNames = computed(() => [...new Set(allRows.value.map(r => String(r.location)))]);

const list = computed(() => allRows.value.filter(r =>
  (!groupFilter.value || r.group === groupFilter.value)
  && (!typeFilter.value || r.kind === typeFilter.value)
  && (!locFilter.value || r.location === locFilter.value)
  && matches(r, needle.value, ['name', 'type', 'group', 'locationName'])));

const sections = computed(() => {
  if (!grouping.value) return [{ label: '', rows: list.value }];
  const out = new Map<string, Record<string, any>[]>();
  for (const r of list.value) {
    const key = grouping.value === 'group' ? String(r.group) : grouping.value === 'kind' ? meta(r.kind).singular
      : locName(r.location);
    out.set(key, [...(out.get(key) || []), r]);
  }
  return [...out.entries()].map(([label, items]) => ({ label, rows: items }));
});

const columns = computed(() => {
  if (kind.value === 'groups') {
    return [{ key: 'name', label: 'Name' }, { key: 'subscription', label: 'Subscription' },
            { key: 'locationName', label: 'Location' }];
  }
  const base = [{ key: 'name', label: 'Name' }];
  const tail = [{ key: 'group', label: 'Resource group' }, { key: 'locationName', label: 'Location' },
                { key: 'subscription', label: 'Subscription' }];
  switch (kind.value) {
    case 'vm': return [...base, { key: 'type', label: 'Type' }, { key: 'subscription', label: 'Subscription' },
      { key: 'group', label: 'Resource group' }, { key: 'locationName', label: 'Location' },
      { key: 'status', label: 'Status' }, { key: 'os', label: 'Operating system' }, { key: 'size', label: 'Size' },
      { key: 'publicIp', label: 'Public IP address' }];
    case 'storage': return [...base, { key: 'type', label: 'Type' }, { key: 'accountKind', label: 'Kind' }, ...tail];
    case 'webapp': return [...base, { key: 'status', label: 'Status' }, { key: 'locationName', label: 'Location' },
      { key: 'plan', label: 'App Service Plan' }, { key: 'group', label: 'Resource group' }, { key: 'url', label: 'URL' }];
    case 'aks': return [...base, ...tail, { key: 'k8s', label: 'Kubernetes version' }, { key: 'nodes', label: 'Node count' }];
    case 'publicip': return [...base, ...tail, { key: 'address', label: 'IP address' }];
    case 'vnet': return [...base, ...tail, { key: 'space', label: 'Address space' }];
    case 'sqldb': return [...base, { key: 'status', label: 'Status' }, { key: 'server', label: 'Server' },
      { key: 'tier', label: 'Pricing tier' }, ...tail];
    default: return [...base, { key: 'type', label: 'Type' }, ...tail];
  }
});

function open(row: Record<string, any>) {
  if (kind.value === 'groups') az.go({ page: 'group', name: row.name });
  else az.go({ page: 'resource', id: row.id });
}
function create() {
  if (kind.value === 'groups') az.go({ page: 'create', kind: 'group' });
  else if (kind.value === 'all') az.go({ page: 'create', kind: 'marketplace' });
  else az.go({ page: 'create', kind: kind.value });
}

const chosen = computed(() => allRows.value.filter(r => selected.value.includes(String(r.id))));

async function removeSelected() {
  if (kind.value === 'groups') {
    if (chosen.value.length !== 1) {
      az.note('info', 'Delete resource groups one at a time', 'Select a single resource group to delete it.');
      return;
    }
    const g = chosen.value[0];
    const inside = allResources(az.p.value).filter(r => r.group === g.name && r.kind !== 'sqldb');
    const ok = await az.confirm({
      title: 'Delete a resource group',
      message: 'The following resource group and all its dependent resources will be permanently deleted.',
      items: [`Resource group: ${g.name}`, ...inside.map(r => `${r.name} (${meta(r.kind).singular})`)],
      typeToConfirm: g.name, typeLabel: 'Enter resource group name to confirm deletion', danger: true });
    if (!ok) return;
    az.note('progress', `Deleting resource group ${g.name}`);
    await az.run(cli(['az', 'group', 'delete'], { '--name': g.name, '--yes': true }),
                 `Deleted resource group ${g.name}`);
    selected.value = [];
    return;
  }
  const items = chosen.value;
  const ok = await az.confirm({
    title: 'Delete Resources',
    message: 'Deleting the following resources is permanent and cannot be undone.',
    items: items.map(r => `${r.name} (${meta(r.kind).singular})`),
    typeToConfirm: 'delete', typeLabel: 'Confirm delete: type "delete"', danger: true });
  if (!ok) return;
  for (const r of deleteOrder(items)) {
    await az.run(deleteCommand(r), `Successfully deleted '${r.name}'`);
  }
  selected.value = [];
}

async function power(verb: 'start' | 'restart' | 'stop') {
  for (const r of chosen.value.filter(x => x.kind === 'vm')) {
    await az.run(cli(['az', 'vm', verb], { '-g': r.group, '-n': r.name }),
                 `${verb === 'start' ? 'Started' : verb === 'stop' ? 'Stopped' : 'Restarted'} virtual machine '${r.name}'`);
  }
}

const tagging = ref(false);
const bulkTags = ref<Record<string, string>>({});
const tagError = ref('');
async function applyTags() {
  tagError.value = '';
  for (const r of chosen.value) {
    const result = await az.run(cli(['az', 'tag', 'update'], { '--resource-id': r.id, '--operation': 'Merge',
                                                              '--tags': tagPairs(bulkTags.value) }),
                                `Tags assigned to ${r.name}`, { quiet: true });
    if (!result.ok) { tagError.value = errorText(result); return; }
  }
  tagging.value = false;
  bulkTags.value = {};
}

function exportCsv() {
  const cols = columns.value;
  const lines = [cols.map(c => c.label).join(',')].concat(list.value.map(r =>
    cols.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.value}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>

<style scoped>
.az-filters__right { margin-left: auto; display: flex; gap: 8px; }
.az-grouphead { margin: 14px 0 4px; font-weight: 600; }
</style>
