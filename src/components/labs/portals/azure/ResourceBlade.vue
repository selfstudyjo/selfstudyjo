<template>
  <div class="az-blade">
    <div class="az-blade__head">
      <AzIcon :name="m.icon" :size="32" class="az-blade__icon" />
      <div class="az-blade__titles">
        <h1 class="az-blade__title">{{ res ? res.name : 'Resource' }} <small>| {{ tabLabel }}</small></h1>
        <div class="az-blade__sub">{{ m.singular }}</div>
      </div>
      <button type="button" class="az-x az-blade__close" aria-label="Close" @click="closeBlade"><AzIcon name="close" /></button>
    </div>

    <div v-if="!res" class="az-banner is-warning"><AzIcon name="warning" />
      <span>The resource could not be found. It may have been deleted or moved to another resource group.</span></div>

    <div v-else class="az-split">
      <nav class="az-svcmenu" :aria-label="m.singular + ' menu'">
        <input v-model="menuNeedle" class="az-svcmenu__search" placeholder="Search" aria-label="Search menu" />
        <template v-for="item in menu" :key="item.key">
          <div v-if="item.group" class="az-svcmenu__group">{{ item.label }}</div>
          <button v-else type="button" class="az-svcmenu__item" :class="{ 'is-active': tab === item.key }"
                  @click="setTab(item.key)"><AzIcon :name="item.icon || 'settings'" /> {{ item.label }}</button>
        </template>
      </nav>

      <div class="az-content">
        <template v-if="tab === 'overview'">
          <div class="az-cmdbar">
            <template v-if="res.kind === 'vm'">
              <button type="button" class="az-cmd" @click="setTab('connect')"><AzIcon name="connect" /> Connect</button>
              <button type="button" class="az-cmd" :disabled="running" @click="vmPower('start')"><AzIcon name="play" /> Start</button>
              <button type="button" class="az-cmd" :disabled="!running" @click="vmPower('restart')"><AzIcon name="restart" /> Restart</button>
              <button type="button" class="az-cmd" :disabled="!running" @click="vmPower('stop')"><AzIcon name="stop" /> Stop</button>
            </template>
            <template v-if="res.kind === 'webapp'">
              <button type="button" class="az-cmd" @click="az.note('info', 'Browse', 'https://' + res.props.host)"><AzIcon name="webapp" /> Browse</button>
              <button type="button" class="az-cmd" :disabled="res.props.web_state === 'Stopped'" @click="webPower('stop')"><AzIcon name="stop" /> Stop</button>
              <button type="button" class="az-cmd" :disabled="res.props.web_state !== 'Stopped'" @click="webPower('start')"><AzIcon name="play" /> Start</button>
              <button type="button" class="az-cmd" @click="webPower('restart')"><AzIcon name="restart" /> Restart</button>
            </template>
            <template v-if="res.kind === 'aks'">
              <button type="button" class="az-cmd" :disabled="res.props.power !== 'Stopped'" @click="aksPower('start')"><AzIcon name="play" /> Start</button>
              <button type="button" class="az-cmd" :disabled="res.props.power === 'Stopped'" @click="aksPower('stop')"><AzIcon name="stop" /> Stop</button>
            </template>
            <button type="button" class="az-cmd az-cmd--danger" @click="remove"><AzIcon name="trash" /> Delete</button>
            <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
            <button v-if="res.kind !== 'sqldb'" type="button" class="az-cmd" @click="moving = true"><AzIcon name="move" /> Move</button>
          </div>
          <AzEssentials :items="ess" :tags="res.tags || {}" json @edit-tags="editingTags = true" @json="json = true" />
          <component :is="kindComp" :res="res" tab="overview" @tab="setTab" />
        </template>

        <AzActivityLog v-else-if="tab === 'activity'" :target="res.name" />
        <AzIamBlade v-else-if="tab === 'iam'" :scope="res.id" :scope-name="res.name" />
        <template v-else-if="tab === 'tags'">
          <AzTagEditor v-model="tagDraft" />
          <div style="margin-top: 12px; display: flex; gap: 8px">
            <button type="button" class="az-btn az-btn--primary" @click="saveTags">Apply</button>
            <button type="button" class="az-btn" @click="tagDraft = { ...(res.tags || {}) }">Discard changes</button>
          </div>
        </template>
        <template v-else-if="tab === 'properties'">
          <div v-for="item in properties" :key="item[0]" class="az-kv"><span>{{ item[0] }}</span>
            <span :class="{ 'az-mono': String(item[1]).startsWith('/') }">{{ item[1] === '' || item[1] === undefined || item[1] === null ? '—' : item[1] }}</span></div>
        </template>
        <AzLocks v-else-if="tab === 'locks'" />
        <template v-else-if="tab === 'diagnostics'">
          <DiagnosticsTab :resource="res.name" />
        </template>
        <component :is="kindComp" v-else :res="res" :tab="tab" @tab="setTab" />
      </div>
    </div>

    <AzTagsPane v-if="editingTags && res" :target-id="res.id" :name="res.name" :type="m.singular" :tags="res.tags || {}"
                @close="editingTags = false" />
    <AzJsonPane v-if="json && res" :title="res.name" :body="resJson" @close="json = false" />
    <AzMovePane v-if="moving && res" :items="[res]" :from="res.group" @close="moving = false" />
  </div>
</template>

<script setup lang="ts">
/**
 * One resource's blade. The shared half (Overview + Essentials, Activity log,
 * IAM, Tags, Properties, Locks, JSON view, Move, Delete) lives here; the
 * kind-specific menu items are drawn by the Res*.vue component for its family.
 */
import { computed, ref, watch, type Component } from 'vue';
import { cli, pick } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzEssentials, { type EssItem } from './AzEssentials.vue';
import AzActivityLog from './AzActivityLog.vue';
import AzIamBlade from './AzIamBlade.vue';
import AzTagEditor from './AzTagEditor.vue';
import AzTagsPane from './AzTagsPane.vue';
import DiagnosticsTab from './DiagnosticsTab.vue';
import ResCompute from './ResCompute.vue';
import ResStorage from './ResStorage.vue';
import ResNetwork from './ResNetwork.vue';
import ResApps from './ResApps.vue';
import { AzJsonPane, AzLocks, AzMovePane } from './AzMisc';
import { deleteCommand, findResource, fmtDate, locName, meta, REGION_GEO, tagCommand, useAz } from './azure';

const az = useAz();
const res = computed(() => findResource(az.p.value, String(az.route.value.id || '')));
const m = computed(() => meta(res.value?.kind || ''));
const tab = computed(() => az.route.value.tab || 'overview');
const account = computed(() => pick(az.p.value, 'account', {} as Record<string, any>));

interface MenuItem { key: string; label: string; icon?: string; group?: boolean }
const KIND_MENU: Record<string, MenuItem[]> = {
  vm: [{ key: 'connect', label: 'Connect', icon: 'connect' }, { key: 'networking', label: 'Networking', icon: 'vnet' },
       { key: 'disks', label: 'Disks', icon: 'storage' }, { key: 'size', label: 'Size', icon: 'vm' }],
  storage: [{ key: 'containers', label: 'Containers', icon: 'container' }, { key: 'keys', label: 'Access keys', icon: 'key' },
            { key: 'configuration', label: 'Configuration', icon: 'settings' }, { key: 'networking', label: 'Networking', icon: 'vnet' }],
  vnet: [{ key: 'address', label: 'Address space', icon: 'vnet' }, { key: 'subnets', label: 'Subnets', icon: 'vnet' },
         { key: 'peerings', label: 'Peerings', icon: 'gateway' }, { key: 'devices', label: 'Connected devices', icon: 'nic' }],
  nsg: [{ key: 'inbound', label: 'Inbound security rules', icon: 'nsg' }, { key: 'outbound', label: 'Outbound security rules', icon: 'nsg' },
        { key: 'nsgsubnets', label: 'Subnets', icon: 'vnet' }, { key: 'nics', label: 'Network interfaces', icon: 'nic' },
        { key: 'effective', label: 'Effective security rules', icon: 'watcher' }],
  publicip: [{ key: 'ipconfig', label: 'Configuration', icon: 'settings' }],
  routetable: [{ key: 'routes', label: 'Routes', icon: 'routetable' }, { key: 'rtsubnets', label: 'Subnets', icon: 'vnet' },
               { key: 'rtconfig', label: 'Configuration', icon: 'settings' }],
  privatednszone: [{ key: 'records', label: 'Recordsets', icon: 'dnszone' }, { key: 'links', label: 'Virtual Network Links', icon: 'vnet' }],
  privateendpoint: [{ key: 'dnsconfig', label: 'DNS configuration', icon: 'dnszone' }, { key: 'pelink', label: 'Private Link connection', icon: 'privateendpoint' }],
  firewall: [{ key: 'fwrules', label: 'Rules (classic)', icon: 'firewall' }],
  webapp: [{ key: 'env', label: 'Environment variables', icon: 'settings' }, { key: 'webconfig', label: 'Configuration', icon: 'settings' }],
  plan: [{ key: 'scale', label: 'Scale up (App Service plan)', icon: 'plan' }, { key: 'apps', label: 'Apps', icon: 'webapp' }],
  aks: [{ key: 'nodepools', label: 'Node pools', icon: 'aks' }, { key: 'aksconnect', label: 'Connect', icon: 'connect' }],
  sql: [{ key: 'databases', label: 'SQL databases', icon: 'sqldb' }],
  sqldb: [{ key: 'compute', label: 'Compute + storage', icon: 'sqldb' }],
  keyvault: [{ key: 'secrets', label: 'Secrets', icon: 'key' }, { key: 'kvaccess', label: 'Access configuration', icon: 'iam' },
             { key: 'kvprops', label: 'Properties (soft delete)', icon: 'props' }],
  acr: [{ key: 'acrkeys', label: 'Access keys', icon: 'key' }, { key: 'repos', label: 'Repositories', icon: 'container' }],
  cosmos: [{ key: 'consistency', label: 'Default consistency', icon: 'cosmos' }],
  workspace: [{ key: 'logs', label: 'Logs', icon: 'query' }, { key: 'tables', label: 'Tables', icon: 'columns' }],
  identity: [{ key: 'roles', label: 'Azure role assignments', icon: 'iam' }],
};
const COMPS: Record<string, Component> = {
  vm: ResCompute, storage: ResStorage, vnet: ResNetwork, nsg: ResNetwork, publicip: ResNetwork, routetable: ResNetwork,
  privatednszone: ResNetwork, privateendpoint: ResNetwork, firewall: ResNetwork, nic: ResNetwork, gateway: ResNetwork,
  natgateway: ResNetwork,
};
const kindComp = computed<Component>(() => COMPS[res.value?.kind || ''] || ResApps);

const menuNeedle = ref('');
const menu = computed<MenuItem[]>(() => {
  const kind = res.value?.kind || '';
  const items: MenuItem[] = [
    { key: 'overview', label: 'Overview', icon: m.value.icon },
    { key: 'activity', label: 'Activity log', icon: 'activity' },
    { key: 'iam', label: 'Access control (IAM)', icon: 'iam' },
    { key: 'tags', label: 'Tags', icon: 'tag' },
    { key: 'g-settings', label: 'Settings', group: true },
    ...(KIND_MENU[kind] || []),
    { key: 'properties', label: 'Properties', icon: 'props' },
    { key: 'locks', label: 'Locks', icon: 'lock' },
    { key: 'g-mon', label: 'Monitoring', group: true },
    { key: 'diagnostics', label: 'Diagnostic settings', icon: 'monitor' },
  ];
  const q = menuNeedle.value.toLowerCase();
  return items.filter(i => i.group ? !q : i.label.toLowerCase().includes(q));
});
const tabLabel = computed(() => menu.value.find(i => i.key === tab.value)?.label || 'Overview');
function setTab(key: string) { az.route.value = { ...az.route.value, tab: key }; }
function closeBlade() {
  if (res.value) az.go({ page: 'group', name: res.value.group });
  else az.go({ page: 'browse', kind: 'all' });
}

const running = computed(() => res.value?.props?.power === 'VM running');
const ess = computed<EssItem[]>(() => {
  const r = res.value;
  if (!r) return [];
  const p = r.props || {};
  const base: EssItem[] = [
    { label: 'Resource group', value: r.group, link: () => az.go({ page: 'group', name: r.group }),
      change: r.kind === 'sqldb' ? undefined : () => { moving.value = true; } },
    { label: 'Location', value: `${locName(r.location)}${p.zone ? ` (Zone ${p.zone})` : ''}` },
    { label: 'Subscription', value: account.value.subscription_name,
      link: () => az.go({ page: 'service', name: 'subscriptions' }) },
    { label: 'Subscription ID', value: account.value.subscription, mono: true },
  ];
  const extra: EssItem[] = [];
  switch (r.kind) {
    case 'vm':
      extra.push({ label: 'Status', value: running.value ? 'Running' : p.power === 'VM deallocated' ? 'Stopped (deallocated)' : 'Stopped' },
                 { label: 'Operating system', value: String(p.image || '').startsWith('Win') ? 'Windows' : 'Linux' },
                 { label: 'Size', value: `${p.size} (${p.cpus} vcpus, ${p.memory} GiB memory)` },
                 { label: 'Public IP address', value: p.public_ip || '—' },
                 { label: 'Virtual network/subnet', value: p.vnet ? `${p.vnet}/${p.subnet || ''}` : '—', link: vnetLink(p.vnet) },
                 { label: 'Image', value: p.image });
      break;
    case 'storage':
      extra.push({ label: 'Performance', value: String(p.sku || '').startsWith('Premium') ? 'Premium' : 'Standard' },
                 { label: 'Replication', value: replication(p.sku) },
                 { label: 'Account kind', value: p.account_kind }, { label: 'Access tier', value: p.access_tier },
                 { label: 'Primary endpoint', value: `https://${r.name}.blob.core.windows.net/`, mono: true });
      break;
    case 'vnet': extra.push({ label: 'Address space', value: p.address_space },
                            { label: 'DNS servers', value: 'Azure provided DNS service' }); break;
    case 'publicip': extra.push({ label: 'IP address', value: p.address }, { label: 'SKU', value: p.sku || 'Standard' },
                                { label: 'DNS name', value: p.dns_label ? `${p.dns_label}.${r.location}.cloudapp.azure.com` : '—' }); break;
    case 'webapp': extra.push({ label: 'Status', value: p.web_state || 'Running' },
                              { label: 'Default domain', value: p.host }, { label: 'App Service Plan', value: p.plan },
                              { label: 'Runtime stack', value: p.runtime }); break;
    case 'plan': extra.push({ label: 'Pricing tier', value: p.sku }, { label: 'Operating System', value: p.linux ? 'Linux' : 'Windows' }); break;
    case 'aks': extra.push({ label: 'Status', value: p.power === 'Stopped' ? 'Stopped' : 'Succeeded (Running)' },
                           { label: 'Kubernetes version', value: p.version }, { label: 'API server address', value: p.fqdn, mono: true },
                           { label: 'Node pools', value: `1 node pool (${p.nodes} nodes, ${p.node_size})` }); break;
    case 'sql': extra.push({ label: 'Server name', value: p.fqdn }, { label: 'Server admin', value: p.admin },
                           { label: 'SQL databases', value: `${(p.databases || []).length}` }); break;
    case 'sqldb': extra.push({ label: 'Server name', value: `${p.server}.database.windows.net` },
                             { label: 'Status', value: 'Online' }, { label: 'Pricing tier', value: p.sku }); break;
    case 'keyvault': extra.push({ label: 'Vault URI', value: p.uri, mono: true }, { label: 'Pricing tier', value: p.sku },
                                { label: 'Soft-delete', value: `Enabled (${p.soft_delete_days} days)` },
                                { label: 'Purge protection', value: p.purge_protection ? 'Enabled' : 'Disabled' }); break;
    case 'acr': extra.push({ label: 'Login server', value: p.login_server }, { label: 'Pricing plan', value: p.sku }); break;
    case 'cosmos': extra.push({ label: 'URI', value: p.endpoint, mono: true }, { label: 'Read Locations', value: locName(r.location) },
                              { label: 'Default consistency', value: p.consistency }); break;
    case 'workspace': extra.push({ label: 'Workspace ID', value: pick(az.p.value, 'workspaces', [] as any[])
      .find((w: any) => w.name === r.name)?.id, mono: true }, { label: 'Pricing tier', value: 'Pay-as-you-go (Per GB 2018)' },
                                 { label: 'Retention', value: `${p.retention || 30} days` }); break;
    case 'identity': extra.push({ label: 'Principal ID', value: p.principal_id, mono: true }); break;
    case 'privateendpoint': extra.push({ label: 'Private IP', value: p.private_ip }, { label: 'Target resource', value: p.target }); break;
    case 'firewall': extra.push({ label: 'SKU', value: p.sku }, { label: 'Private IP', value: p.private_ip }); break;
    default: break;
  }
  return [...base, ...extra];
});
function vnetLink(name: string) {
  const v = (az.p.value.resources || []).find((x: any) => x.kind === 'vnet' && x.name === name);
  return v ? () => az.go({ page: 'resource', id: v.id }) : undefined;
}
function replication(sku: string) {
  return ({ Standard_LRS: 'Locally-redundant storage (LRS)', Standard_GRS: 'Geo-redundant storage (GRS)',
            Standard_ZRS: 'Zone-redundant storage (ZRS)', Premium_LRS: 'Locally-redundant storage (LRS)' } as Record<string, string>)[sku] || sku;
}
const properties = computed(() => {
  const r = res.value;
  if (!r) return [];
  const out: [string, unknown][] = [['Name', r.name], ['Resource ID', r.id], ['Type', r.type],
    ['Location', `${locName(r.location)} (${REGION_GEO[r.location] || r.location})`], ['Resource group', r.group],
    ['Subscription', account.value.subscription_name], ['Subscription ID', account.value.subscription],
    ['Provisioning state', r.state], ['Created', fmtDate(r.created)]];
  for (const [k, v] of Object.entries(r.props || {})) {
    if (typeof v !== 'object') out.push([k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()), v as unknown]);
  }
  return out;
});
const resJson = computed(() => {
  const r = res.value || ({} as Record<string, any>);
  return { id: r.id, name: r.name, type: r.type, location: r.location, tags: r.tags || {},
           properties: { provisioningState: r.state, ...(r.props || {}) } };
});

const editingTags = ref(false);
const json = ref(false);
const moving = ref(false);
const tagDraft = ref<Record<string, string>>({});
watch(res, r => { tagDraft.value = { ...(r?.tags || {}) }; }, { immediate: true });
async function saveTags() {
  if (!res.value) return;
  await az.run(tagCommand(res.value.id, tagDraft.value), `Tags updated for ${res.value.name}`);
}

const TYPE_NAME = ['storage', 'sql', 'keyvault', 'cosmos', 'acr', 'aks', 'sqldb'];
async function remove() {
  const r = res.value;
  if (!r) return;
  const typed = TYPE_NAME.includes(r.kind);
  const ok = await az.confirm({
    title: `Delete ${m.value.singular.toLowerCase()}`,
    message: r.kind === 'keyvault'
      ? `Are you sure you want to delete '${r.name}'? It will be soft-deleted and kept for ${r.props?.soft_delete_days || 90} days; the name stays reserved until it is purged.`
      : r.kind === 'vm'
        ? `Are you sure you want to delete '${r.name}'? The network interface, public IP and NSG it uses are not deleted with it.`
        : `Are you sure you want to delete '${r.name}'? This action cannot be undone.`,
    typeToConfirm: typed ? r.name : undefined,
    typeLabel: typed ? `Type the ${m.value.singular.toLowerCase()} name` : undefined,
    confirmLabel: typed ? 'Delete' : 'Yes', danger: true,
  });
  if (!ok) return;
  az.note('progress', `Deleting ${r.name}...`);
  const result = await az.run(deleteCommand(r), `Successfully deleted '${r.name}'`);
  if (result.ok) az.go({ page: 'group', name: r.group });
}
async function vmPower(verb: 'start' | 'restart' | 'stop') {
  const r = res.value!;
  if (verb === 'stop' && !(await az.confirm({ title: 'Stop this virtual machine',
    message: `Do you want to stop '${r.name}'? The public IP address is kept because it is Static.`, confirmLabel: 'Yes' }))) return;
  await az.run(cli(['az', 'vm', verb], { '-g': r.group, '-n': r.name }),
               `Successfully ${verb === 'start' ? 'started' : verb === 'stop' ? 'stopped' : 'restarted'} virtual machine '${r.name}'`);
}
async function webPower(verb: 'start' | 'stop' | 'restart') {
  const r = res.value!;
  await az.run(cli(['az', 'webapp', verb], { '-g': r.group, '-n': r.name }),
               `Successfully ${verb === 'start' ? 'started' : verb === 'stop' ? 'stopped' : 'restarted'} web app '${r.name}'`);
}
async function aksPower(verb: 'start' | 'stop') {
  const r = res.value!;
  await az.run(cli(['az', 'aks', verb], { '-g': r.group, '-n': r.name }),
               `${verb === 'start' ? 'Started' : 'Stopped'} Kubernetes service '${r.name}'`);
}
</script>
