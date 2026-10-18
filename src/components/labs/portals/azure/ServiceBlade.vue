<template>
  <div class="az-blade">
    <div class="az-blade__head">
      <AzIcon :name="svc?.icon || 'allservices'" :size="30" class="az-blade__icon" />
      <div class="az-blade__titles">
        <h1 class="az-blade__title">{{ title }}<small v-if="tabTitle"> | {{ tabTitle }}</small></h1>
        <div class="az-blade__sub">{{ sub }}</div>
      </div>
      <button type="button" class="az-x az-blade__close" aria-label="Close" @click="az.go({ page: 'home' })"><AzIcon name="close" /></button>
    </div>

    <PolicyBlade v-if="name === 'policy'" :tab="tab" :preset="az.route.value.extra" @tab="setTab" />
    <MonitorBlade v-else-if="name === 'monitor'" :tab="tab" @tab="setTab" />
    <CostBlade v-else-if="name === 'cost'" :tab="tab === 'overview' ? 'costanalysis' : tab" @tab="setTab" />
    <CostBlade v-else-if="name === 'advisor'" tab="advisor" @tab="setTabCost" />
    <EntraBlade v-else-if="name === 'entra'" :tab="tab" @tab="setTab" />
    <WatcherBlade v-else-if="name === 'watcher'" :tab="tab" @tab="setTab" />
    <MgmtBlade v-else-if="name === 'mgmt'" />
    <DeploymentsTab v-else-if="name === 'deployments'" />

    <!-- Subscriptions -->
    <template v-else-if="name === 'subscriptions'">
      <div class="az-split">
        <nav class="az-svcmenu" aria-label="Subscription menu">
          <button v-for="item in SUB_MENU" :key="item.key" type="button" class="az-svcmenu__item" :class="{ 'is-active': tab === item.key }"
                  @click="setTab(item.key)"><AzIcon :name="item.icon" /> {{ item.label }}</button>
        </nav>
        <div class="az-content">
          <template v-if="tab === 'overview'">
            <div class="az-cmdbar">
              <button type="button" class="az-cmd" @click="show"><AzIcon name="props" /> Show details (az account show)</button>
              <button type="button" class="az-cmd" @click="locations"><AzIcon name="allservices" /> List locations</button>
            </div>
            <AzTable :columns="subCols" :rows="subs" row-key="id">
              <template #cell-name="{ row }"><span class="az-namecell"><AzIcon name="subscription" /> {{ row.name }}</span></template>
            </AzTable>
            <pre v-if="output" class="az-code" style="margin-top: 10px">{{ output }}</pre>
          </template>
          <AzActivityLog v-else-if="tab === 'activity'" />
          <AzIamBlade v-else-if="tab === 'iam'" :scope="`/subscriptions/${acct.subscription}`" :scope-name="String(acct.subscription_name)" />
          <DeploymentsTab v-else-if="tab === 'deployments'" />
          <template v-else-if="tab === 'groups'">
            <AzTable :columns="[{ key: 'name', label: 'Name' }, { key: 'location', label: 'Location' }, { key: 'resources', label: 'Resources' }]"
                     :rows="rowsOf('groups')" row-key="id">
              <template #cell-name="{ row }"><button type="button" class="az-link" @click="az.go({ page: 'group', name: row.name })">{{ row.name }}</button></template>
            </AzTable>
          </template>
        </div>
      </div>
    </template>

    <!-- Deleted key vaults -->
    <template v-else-if="name === 'deletedvaults'">
      <div class="az-cmdbar">
        <button type="button" class="az-cmd" :disabled="!picked.length" @click="vaultAction('recover')"><AzIcon name="restart" /> Recover</button>
        <button type="button" class="az-cmd az-cmd--danger" :disabled="!picked.length" @click="vaultAction('purge')"><AzIcon name="trash" /> Purge</button>
        <button type="button" class="az-cmd" @click="listDeleted"><AzIcon name="refresh" /> Refresh</button>
      </div>
      <AzTable v-model:selected="picked" :columns="delCols" :rows="deleted" row-key="name" selectable>
        <template #empty>No deleted key vaults. A deleted vault is kept (soft-deleted) for its retention period and its name stays reserved.</template>
      </AzTable>
    </template>
  </div>
</template>

<script setup lang="ts">
/** A platform service blade (Policy, Monitor, Cost Management, Entra ID, ...). */
import { computed, ref, watch } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzTable from './AzTable.vue';
import AzActivityLog from './AzActivityLog.vue';
import AzIamBlade from './AzIamBlade.vue';
import DeploymentsTab from './DeploymentsTab.vue';
import PolicyBlade from './PolicyBlade.vue';
import MonitorBlade from './MonitorBlade.vue';
import CostBlade from './CostBlade.vue';
import EntraBlade from './EntraBlade.vue';
import WatcherBlade from './WatcherBlade.vue';
import MgmtBlade from './MgmtBlade.vue';
import { fmtDate, locName, useAz } from './azure';
import { SERVICES } from './services';

const az = useAz();
const name = computed(() => String(az.route.value.name || ''));
const tab = computed(() => az.route.value.tab || 'overview');
const svc = computed(() => SERVICES.find(s => s.key === name.value));
const acct = computed(() => az.p.value.account || {});
const title = computed(() => ({ deployments: 'Custom deployment', cost: 'Cost Management', advisor: 'Advisor',
  entra: 'Default Directory', deletedvaults: 'Manage deleted vaults' } as Record<string, string>)[name.value] || svc.value?.label || '');
const sub = computed(() => (name.value === 'entra' ? 'Microsoft Entra ID' : `${acct.value.directory} (${acct.value.domain})`));
const tabTitle = computed(() => (tab.value === 'overview' ? '' : tab.value.replace(/^./, c => c.toUpperCase())));
function setTab(key: string) { az.route.value = { ...az.route.value, tab: key }; }
function setTabCost(key: string) { az.go({ page: 'service', name: 'cost', tab: key }); }
function rowsOf(path: string) { return rows(az.p.value, path); }

const SUB_MENU = [
  { key: 'overview', label: 'Overview', icon: 'subscription' }, { key: 'activity', label: 'Activity log', icon: 'activity' },
  { key: 'iam', label: 'Access control (IAM)', icon: 'iam' }, { key: 'groups', label: 'Resource groups', icon: 'group' },
  { key: 'deployments', label: 'Deployments', icon: 'deploy' },
];
const subs = computed(() => rows(az.p.value, 'subscriptions').map((s): Record<string, any> => ({ ...s, idShort: s.id, role: 'Owner',
  current: String(s.id) === String(acct.value.subscription) ? 'Yes' : '' })));
const subCols = [{ key: 'name', label: 'Subscription name' }, { key: 'idShort', label: 'Subscription ID' },
                 { key: 'role', label: 'My role' }, { key: 'mgmt_group', label: 'Management group' }, { key: 'state', label: 'Status' }];
const output = ref('');
async function show() {
  const r = await az.run(cli(['az', 'account', 'show']), '', { quiet: true });
  output.value = String(r.output || r.error || '').trim();
}
async function locations() {
  const r = await az.run(cli(['az', 'account', 'list-locations'], { '--query': '[].name', '--output': 'tsv' }), '', { quiet: true });
  output.value = String(r.output || r.error || '').trim();
}

const picked = ref<string[]>([]);
const deleted = computed(() => rows(az.p.value, 'deleted_vaults').map((d): Record<string, any> => ({ ...d, location: locName(d.location),
  deletedOn: fmtDate(d.deleted), purgeOn: fmtDate(d.purge_at), protection: d.purge_protection ? 'Enabled' : 'Disabled' })));
const delCols = [{ key: 'name', label: 'Name' }, { key: 'location', label: 'Location' }, { key: 'deletedOn', label: 'Deletion date' },
                 { key: 'purgeOn', label: 'Scheduled purge date' }, { key: 'protection', label: 'Purge protection' }];
async function listDeleted() { await az.run(cli(['az', 'keyvault', 'list-deleted']), '', { quiet: true }); }
watch(name, n => { if (n === 'deletedvaults') void listDeleted(); }, { immediate: true });
async function vaultAction(verb: 'recover' | 'purge') {
  const items = [...picked.value];
  if (verb === 'purge' && !(await az.confirm({ title: 'Purge key vaults', message: 'Purging permanently deletes the vault and all its objects. This cannot be undone.', items, confirmLabel: 'Purge', danger: true }))) return;
  for (const n of items) {
    await az.run(cli(['az', 'keyvault', verb], { '--name': n }), verb === 'recover' ? `Recovered key vault '${n}'` : `Purged key vault '${n}'`);
  }
  picked.value = [];
}
</script>
