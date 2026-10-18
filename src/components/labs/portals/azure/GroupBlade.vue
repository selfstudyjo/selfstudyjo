<template>
  <div class="az-blade">
    <div class="az-blade__head">
      <AzIcon name="group" :size="32" class="az-blade__icon" />
      <div class="az-blade__titles">
        <h1 class="az-blade__title">{{ name }} <small>| {{ tabLabel }}</small></h1>
        <div class="az-blade__sub">Resource group</div>
      </div>
      <button type="button" class="az-x az-blade__close" aria-label="Close" @click="az.go({ page: 'browse', kind: 'groups' })">
        <AzIcon name="close" /></button>
    </div>

    <div v-if="!group" class="az-banner is-warning"><AzIcon name="warning" />
      <span>Resource group '{{ name }}' could not be found. It may have been deleted.</span></div>

    <div v-else class="az-split">
      <nav class="az-svcmenu" aria-label="Resource group menu">
        <input v-model="menuNeedle" class="az-svcmenu__search" placeholder="Search" aria-label="Search menu" />
        <template v-for="item in menu" :key="item.key">
          <div v-if="item.group" class="az-svcmenu__group">{{ item.label }}</div>
          <button v-else type="button" class="az-svcmenu__item" :class="{ 'is-active': tab === item.key }"
                  @click="setTab(item.key)"><AzIcon :name="item.icon || 'overview'" /> {{ item.label }}</button>
        </template>
      </nav>

      <div class="az-content">
        <!-- Overview -->
        <template v-if="tab === 'overview'">
          <div class="az-cmdbar">
            <button type="button" class="az-cmd" @click="az.go({ page: 'create', kind: 'marketplace', group: name })">
              <AzIcon name="plus" /> Create</button>
            <button type="button" class="az-cmd az-cmd--danger" @click="deleteGroup"><AzIcon name="trash" /> Delete resource group</button>
            <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
            <button type="button" class="az-cmd" @click="exportCsv"><AzIcon name="download" /> Export to CSV</button>
            <span class="az-cmdsep"></span>
            <button type="button" class="az-cmd" :disabled="!selected.length" @click="tagSelected = true"><AzIcon name="tag" /> Assign tags</button>
            <button type="button" class="az-cmd" :disabled="!selected.length" @click="moving = true"><AzIcon name="move" /> Move</button>
            <button type="button" class="az-cmd az-cmd--danger" :disabled="!selected.length" @click="deleteSelected"><AzIcon name="trash" /> Delete</button>
          </div>
          <AzEssentials :items="ess" :tags="group.tags || {}" json @edit-tags="editing = true" @json="json = true" />
          <div class="az-tabs"><button type="button" class="az-tab is-active">Resources</button>
            <button type="button" class="az-tab" @click="az.go({ page: 'service', name: 'advisor' })">Recommendations</button></div>
          <div class="az-filters">
            <input v-model="needle" class="az-filter" placeholder="Filter for any field..." aria-label="Filter resources" />
            <label class="az-pill">Type equals <select v-model="typeFilter" aria-label="Type filter"><option value="">all</option>
              <option v-for="t in types" :key="t" :value="t">{{ meta(t).singular }}</option></select></label>
            <label class="az-pill">Location equals <select v-model="locFilter" aria-label="Location filter"><option value="">all</option>
              <option v-for="l in locs" :key="l" :value="l">{{ locName(l) }}</option></select></label>
          </div>
          <div class="az-count">Showing {{ list.length ? 1 : 0 }} to {{ list.length }} of {{ list.length }} records.</div>
          <AzTable v-model:selected="selected" :columns="cols" :rows="list" row-key="id" selectable>
            <template #cell-name="{ row }">
              <button type="button" class="az-link az-namecell" @click="az.go({ page: 'resource', id: row.id })">
                <AzIcon :name="meta(row.kind).icon" /> {{ row.name }}</button></template>
            <template #empty>
              <div class="az-empty az-empty--small">
                <h3>No resources to display</h3>
                <p>Try changing or clearing your filters.</p>
                <button type="button" class="az-btn az-btn--primary" @click="az.go({ page: 'create', kind: 'marketplace', group: name })">Create resources</button>
              </div></template>
          </AzTable>
        </template>

        <AzActivityLog v-else-if="tab === 'activity'" :group="name" />
        <AzIamBlade v-else-if="tab === 'iam'" :scope="group.id" :scope-name="name" />

        <template v-else-if="tab === 'tags'">
          <AzTagEditor v-model="tagDraft" />
          <div style="margin-top: 12px; display: flex; gap: 8px">
            <button type="button" class="az-btn az-btn--primary" @click="saveTags">Apply</button>
            <button type="button" class="az-btn" @click="tagDraft = { ...(group.tags || {}) }">Discard changes</button>
          </div>
        </template>

        <DeploymentsTab v-else-if="tab === 'deployments'" :group="name" />

        <template v-else-if="tab === 'policies'">
          <div class="az-cmdbar">
            <button type="button" class="az-cmd" @click="az.go({ page: 'service', name: 'policy', tab: 'assignments', extra: { scope: 'rg:' + name } })">
              <AzIcon name="plus" /> Assign policy</button>
            <button type="button" class="az-cmd" @click="az.go({ page: 'service', name: 'policy', tab: 'compliance' })"><AzIcon name="policy" /> View compliance</button>
          </div>
          <AzTable :columns="polCols" :rows="policies" row-key="name">
            <template #empty>No policy assignments apply to this resource group.</template>
          </AzTable>
        </template>

        <template v-else-if="tab === 'properties'">
          <div class="az-kv"><span>Name</span><span>{{ name }}</span></div>
          <div class="az-kv"><span>Location</span><span>{{ locName(group.location) }}</span></div>
          <div class="az-kv"><span>Location ID</span><span>{{ group.location }}</span></div>
          <div class="az-kv"><span>Resource ID</span><span class="az-mono">{{ group.id }}</span></div>
          <div class="az-kv"><span>Subscription</span><span>{{ account.subscription_name }}</span></div>
          <div class="az-kv"><span>Subscription ID</span><span class="az-mono">{{ account.subscription }}</span></div>
          <div class="az-kv"><span>Provisioning state</span><span>{{ group.state }}</span></div>
        </template>

        <AzLocks v-else-if="tab === 'locks'" />

        <template v-else-if="tab === 'cost'">
          <p class="az-intro">Estimated monthly cost of the resources in this group (list-price ballparks).</p>
          <AzTable :columns="costCols" :rows="costs" row-key="resource">
            <template #cell-monthly="{ row }">${{ Number(row.monthly).toLocaleString() }}</template>
            <template #empty>Nothing in this resource group is costing anything yet.</template>
          </AzTable>
          <p style="margin-top: 10px"><b>Total: ${{ costs.reduce((a, r) => a + Number(r.monthly || 0), 0).toLocaleString() }}</b> / month</p>
        </template>
      </div>
    </div>

    <AzTagsPane v-if="editing && group" :target-id="group.id" :name="name" type="Resource group" :tags="group.tags || {}"
                @close="editing = false" />
    <AzJsonPane v-if="json && group" :title="name" :body="groupJson" @close="json = false" />
    <AzMovePane v-if="moving" :items="chosen" :from="name" @close="moving = false; selected = []" />
    <AzPane v-if="tagSelected" title="Assign tags" :subtitle="`${selected.length} resource(s)`" :error="bulkError"
            @close="tagSelected = false">
      <AzTagEditor v-model="bulkTags" />
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!Object.keys(bulkTags).length" @click="applyBulk">Save</button>
        <button type="button" class="az-btn" @click="tagSelected = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** A resource group's blade: Overview with its resources, IAM, Tags, Deployments, Policies... */
import { computed, ref, watch } from 'vue';
import { cli, errorText, matches, pick, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzTable from './AzTable.vue';
import AzPane from './AzPane.vue';
import AzEssentials, { type EssItem } from './AzEssentials.vue';
import AzActivityLog from './AzActivityLog.vue';
import AzIamBlade from './AzIamBlade.vue';
import AzTagEditor from './AzTagEditor.vue';
import AzTagsPane from './AzTagsPane.vue';
import DeploymentsTab from './DeploymentsTab.vue';
import { AzJsonPane, AzLocks, AzMovePane } from './AzMisc';
import { allResources, deleteCommand, deleteOrder, locName, meta, tagCommand, tagPairs, useAz } from './azure';

const az = useAz();
const name = computed(() => String(az.route.value.name || ''));
const tab = computed(() => az.route.value.tab || 'overview');
const group = computed(() => rows(az.p.value, 'groups').find(g => g.name === name.value) || null);
const account = computed(() => pick(az.p.value, 'account', {} as Record<string, any>));

const MENU = [
  { key: 'overview', label: 'Overview', icon: 'group' },
  { key: 'activity', label: 'Activity log', icon: 'activity' },
  { key: 'iam', label: 'Access control (IAM)', icon: 'iam' },
  { key: 'tags', label: 'Tags', icon: 'tag' },
  { key: 's', label: 'Settings', group: true },
  { key: 'deployments', label: 'Deployments', icon: 'deploy' },
  { key: 'policies', label: 'Policies', icon: 'policy' },
  { key: 'properties', label: 'Properties', icon: 'props' },
  { key: 'locks', label: 'Locks', icon: 'lock' },
  { key: 'c', label: 'Cost Management', group: true },
  { key: 'cost', label: 'Cost analysis', icon: 'cost' },
];
const menuNeedle = ref('');
const menu = computed(() => MENU.filter(m => m.group ? !menuNeedle.value
  : m.label.toLowerCase().includes(menuNeedle.value.toLowerCase())));
const tabLabel = computed(() => MENU.find(m => m.key === tab.value)?.label || 'Overview');
function setTab(key: string) { az.route.value = { ...az.route.value, tab: key }; }

const resources = computed(() => allResources(az.p.value).filter(r => r.group === name.value));
const needle = ref('');
const typeFilter = ref('');
const locFilter = ref('');
const types = computed(() => [...new Set(resources.value.map(r => String(r.kind)))]);
const locs = computed(() => [...new Set(resources.value.map(r => String(r.location)))]);
const list = computed(() => resources.value
  .map((r): Record<string, any> => ({ ...r, type: meta(r.kind).singular, locationName: locName(r.location) }))
  .filter(r => (!typeFilter.value || r.kind === typeFilter.value) && (!locFilter.value || r.location === locFilter.value)
    && matches(r, needle.value, ['name', 'type', 'locationName'])));
const cols = [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'locationName', label: 'Location' }];
const selected = ref<string[]>([]);
const chosen = computed(() => resources.value.filter(r => selected.value.includes(String(r.id))));

const deployments = computed(() => rows(az.p.value, 'deployments').filter(d => d.group === name.value));
const ess = computed<EssItem[]>(() => [
  { label: 'Subscription', value: account.value.subscription_name, link: () => az.go({ page: 'service', name: 'subscriptions' }),
    change: () => az.note('info', 'Moving a resource group between subscriptions is not available in this lab') },
  { label: 'Deployments', value: deployments.value.length ? `${deployments.value.length} Succeeded` : 'No deployments',
    link: () => setTab('deployments') },
  { label: 'Subscription ID', value: account.value.subscription, mono: true },
  { label: 'Location', value: locName(group.value?.location) },
]);
const groupJson = computed(() => ({ id: group.value?.id, name: name.value, type: 'Microsoft.Resources/resourceGroups',
  location: group.value?.location, tags: group.value?.tags || {},
  properties: { provisioningState: group.value?.state } }));

const editing = ref(false);
const json = ref(false);
const moving = ref(false);
const tagDraft = ref<Record<string, string>>({});
watch(group, g => { tagDraft.value = { ...(g?.tags || {}) }; }, { immediate: true });
async function saveTags() {
  if (!group.value) return;
  await az.run(tagCommand(group.value.id, tagDraft.value), `Tags updated for ${name.value}`);
}

async function deleteGroup() {
  const inside = resources.value.filter(r => r.kind !== 'sqldb');
  const ok = await az.confirm({
    title: `Delete a resource group`,
    message: 'The following resource group and all its dependent resources will be permanently deleted.',
    items: [`Resource group to be deleted: ${name.value}`,
            ...inside.map(r => `${r.name} — ${meta(r.kind).singular}`)],
    typeToConfirm: name.value, typeLabel: 'Enter resource group name to confirm deletion', danger: true });
  if (!ok) return;
  az.note('progress', `Deleting resource group ${name.value}`, 'The resource group and its resources are being deleted.');
  const result = await az.run(cli(['az', 'group', 'delete'], { '--name': name.value, '--yes': true }),
                              `Deleted resource group ${name.value}`);
  if (result.ok) az.go({ page: 'browse', kind: 'groups' });
}

async function deleteSelected() {
  const items = chosen.value;
  const ok = await az.confirm({ title: 'Delete Resources', message: 'Deleting the following resources is permanent.',
                                items: items.map(r => `${r.name} (${meta(r.kind).singular})`),
                                typeToConfirm: 'delete', typeLabel: 'Confirm delete: type "delete"', danger: true });
  if (!ok) return;
  for (const r of deleteOrder(items)) await az.run(deleteCommand(r), `Successfully deleted '${r.name}'`);
  selected.value = [];
}

const tagSelected = ref(false);
const bulkTags = ref<Record<string, string>>({});
const bulkError = ref('');
async function applyBulk() {
  bulkError.value = '';
  for (const r of chosen.value) {
    const result = await az.run(cli(['az', 'tag', 'update'], { '--resource-id': r.id, '--operation': 'Merge',
                                                              '--tags': tagPairs(bulkTags.value) }), '', { quiet: true });
    if (!result.ok) { bulkError.value = errorText(result); return; }
  }
  az.note('success', `Tags assigned to ${chosen.value.length} resource(s)`);
  tagSelected.value = false;
  bulkTags.value = {};
}

const policies = computed(() => rows(az.p.value, 'policy_assignments')
  .filter(a => String(a.scope).endsWith(`/resourceGroups/${name.value}`) || !String(a.scope).includes('/resourceGroups/'))
  .map(a => ({ name: a.name, definition: a.definition, effect: a.effect,
               scope: String(a.scope).includes('/resourceGroups/') ? 'This resource group' : 'Inherited' })));
const polCols = [{ key: 'name', label: 'Name' }, { key: 'definition', label: 'Definition' },
                 { key: 'effect', label: 'Effect' }, { key: 'scope', label: 'Scope' }];
const costs = computed(() => rows(az.v.value, 'cost').filter(c => c.group === name.value));
const costCols = [{ key: 'resource', label: 'Resource' }, { key: 'kind', label: 'Service' },
                  { key: 'sku', label: 'Meter' }, { key: 'monthly', label: 'Cost / month' }, { key: 'owner', label: 'owner tag' }];

function exportCsv() {
  const lines = ['NAME,TYPE,LOCATION'].concat(list.value.map(r => `"${r.name}","${r.type}","${r.locationName}"`));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.value}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>
