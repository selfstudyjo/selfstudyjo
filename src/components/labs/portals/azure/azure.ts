/**
 * The Azure portal skin's shared half: what each resource kind is called, how
 * it is created, deleted and browsed, which URL the real portal shows for a
 * page, and the context object every blade reads through `inject`.
 *
 * Every write is the `az` command line a student could have typed (see
 * `portalKit.ts`), so this module is where a resource kind's CLI spelling
 * lives - one table, read by the browse blades, the resource blades and the
 * create wizards, so the three cannot disagree about how a VM is deleted.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { cli, rows, type PortalResult } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';

export interface AzRoute {
  page: 'home' | 'services' | 'browse' | 'group' | 'resource' | 'create' | 'deploy'
    | 'service' | 'dashboard';
  kind?: string;
  id?: string;
  name?: string;
  tab?: string;
  group?: string;
  extra?: Record<string, any>;
}

export interface AzNote {
  id: number;
  type: 'success' | 'error' | 'info' | 'progress';
  title: string;
  detail: string;
  at: number;
  read: boolean;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  /** When set, the user must type this exact text (Azure's "type the name"). */
  typeToConfirm?: string;
  typeLabel?: string;
  confirmLabel?: string;
  danger?: boolean;
  items?: string[];
}

export interface AzCtx {
  /** view.portal - the skin's own read model. */
  p: ComputedRef<Record<string, any>>;
  /** The whole family view (vnets, compliance, cost ... from the platform layer). */
  v: ComputedRef<Record<string, any>>;
  api: PortalApi;
  route: Ref<AzRoute>;
  busy: ComputedRef<boolean>;
  go(route: AzRoute): void;
  back(): void;
  run(command: string, success?: string, options?: { quiet?: boolean; note?: string })
    : Promise<PortalResult>;
  confirm(options: ConfirmOptions): Promise<boolean>;
  note(type: AzNote['type'], title: string, detail?: string): void;
  refresh(): void;
}

export const AZ: InjectionKey<AzCtx> = Symbol('azure-portal');

export function useAz(): AzCtx {
  const ctx = inject(AZ);
  if (!ctx) throw new Error('Azure portal context missing');
  return ctx;
}

export interface KindMeta {
  kind: string;
  /** Plural service name, as the portal's browse blade titles it. */
  plural: string;
  singular: string;
  icon: string;
  type: string;
  createLabel?: string;
  /** Marketplace id the create URL carries. */
  market?: string;
  /** The URL fragment of the browse blade. */
  browse: string;
}

export const KINDS: Record<string, KindMeta> = {
  vm: { kind: 'vm', plural: 'Virtual machines', singular: 'Virtual machine', icon: 'vm',
        type: 'Microsoft.Compute/virtualMachines', market: 'Microsoft.VirtualMachine-ARM',
        browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Compute%2FVirtualMachines' },
  storage: { kind: 'storage', plural: 'Storage accounts', singular: 'Storage account',
             icon: 'storage', type: 'Microsoft.Storage/storageAccounts',
             market: 'Microsoft.StorageAccount-ARM',
             browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Storage%2FStorageAccounts' },
  vnet: { kind: 'vnet', plural: 'Virtual networks', singular: 'Virtual network', icon: 'vnet',
          type: 'Microsoft.Network/virtualNetworks', market: 'Microsoft.VirtualNetwork-ARM',
          browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FvirtualNetworks' },
  nsg: { kind: 'nsg', plural: 'Network security groups', singular: 'Network security group',
         icon: 'nsg', type: 'Microsoft.Network/networkSecurityGroups',
         market: 'Microsoft.NetworkSecurityGroup-ARM',
         browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FNetworkSecurityGroups' },
  publicip: { kind: 'publicip', plural: 'Public IP addresses', singular: 'Public IP address',
              icon: 'publicip', type: 'Microsoft.Network/publicIPAddresses',
              market: 'Microsoft.PublicIpAddress-ARM',
              browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FPublicIPAddresses' },
  nic: { kind: 'nic', plural: 'Network interfaces', singular: 'Network interface', icon: 'nic',
         type: 'Microsoft.Network/networkInterfaces',
         browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FNetworkInterfaces' },
  routetable: { kind: 'routetable', plural: 'Route tables', singular: 'Route table',
                icon: 'routetable', type: 'Microsoft.Network/routeTables',
                market: 'Microsoft.RouteTable-ARM',
                browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FrouteTables' },
  privateendpoint: { kind: 'privateendpoint', plural: 'Private endpoints',
                     singular: 'Private endpoint', icon: 'privateendpoint',
                     type: 'Microsoft.Network/privateEndpoints',
                     market: 'Microsoft.PrivateEndpoint-ARM',
                     browse: 'Microsoft_Azure_Network/PrivateLinkCenterBlade/~/privateendpoints' },
  privatednszone: { kind: 'privatednszone', plural: 'Private DNS zones',
                    singular: 'Private DNS zone', icon: 'dnszone',
                    type: 'Microsoft.Network/privateDnsZones',
                    market: 'Microsoft.PrivateDnsZone-ARM',
                    browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FprivateDnsZones' },
  firewall: { kind: 'firewall', plural: 'Firewalls', singular: 'Firewall', icon: 'firewall',
              type: 'Microsoft.Network/azureFirewalls', market: 'Microsoft.Firewall-ARM',
              browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FazureFirewalls' },
  gateway: { kind: 'gateway', plural: 'Virtual network gateways',
             singular: 'Virtual network gateway', icon: 'gateway',
             type: 'Microsoft.Network/virtualNetworkGateways',
             browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FvirtualNetworkGateways' },
  natgateway: { kind: 'natgateway', plural: 'NAT gateways', singular: 'NAT gateway',
                icon: 'natgateway', type: 'Microsoft.Network/natGateways',
                browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FnatGateways' },
  bastion: { kind: 'bastion', plural: 'Bastions', singular: 'Bastion', icon: 'bastion',
             type: 'Microsoft.Network/bastionHosts',
             browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FbastionHosts' },
  plan: { kind: 'plan', plural: 'App Service plans', singular: 'App Service plan', icon: 'plan',
          type: 'Microsoft.Web/serverfarms', market: 'Microsoft.AppServicePlanCreate',
          browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Web%2FserverFarms' },
  webapp: { kind: 'webapp', plural: 'App Services', singular: 'Web App', icon: 'webapp',
            type: 'Microsoft.Web/sites', market: 'Microsoft.WebSite',
            browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Web%2Fsites' },
  aks: { kind: 'aks', plural: 'Kubernetes services', singular: 'Kubernetes service', icon: 'aks',
         type: 'Microsoft.ContainerService/managedClusters', market: 'Microsoft.AKS',
         browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.ContainerService%2FmanagedClusters' },
  sql: { kind: 'sql', plural: 'SQL servers', singular: 'SQL server', icon: 'sqlserver',
         type: 'Microsoft.Sql/servers', market: 'Microsoft.SQLServer',
         browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Sql%2Fservers' },
  keyvault: { kind: 'keyvault', plural: 'Key vaults', singular: 'Key vault', icon: 'keyvault',
              type: 'Microsoft.KeyVault/vaults', market: 'Microsoft.KeyVault',
              browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.KeyVault%2Fvaults' },
  acr: { kind: 'acr', plural: 'Container registries', singular: 'Container registry',
         icon: 'acr', type: 'Microsoft.ContainerRegistry/registries',
         market: 'Microsoft.ContainerRegistry',
         browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.ContainerRegistry%2Fregistries' },
  cosmos: { kind: 'cosmos', plural: 'Azure Cosmos DB accounts', singular: 'Azure Cosmos DB account',
            icon: 'cosmos', type: 'Microsoft.DocumentDB/databaseAccounts',
            market: 'Microsoft.DocumentDB',
            browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.DocumentDb%2FdatabaseAccounts' },
  redis: { kind: 'redis', plural: 'Azure Cache for Redis', singular: 'Azure Cache for Redis',
           icon: 'redis', type: 'Microsoft.Cache/redis',
           browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Cache%2FRedis' },
  appinsights: { kind: 'appinsights', plural: 'Application Insights',
                 singular: 'Application Insights', icon: 'appinsights',
                 type: 'Microsoft.Insights/components',
                 browse: 'HubsExtension/BrowseResource/resourceType/microsoft.insights%2Fcomponents' },
  workspace: { kind: 'workspace', plural: 'Log Analytics workspaces',
               singular: 'Log Analytics workspace', icon: 'workspace',
               type: 'Microsoft.OperationalInsights/workspaces',
               market: 'Microsoft.LogAnalyticsOMS',
               browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.OperationalInsights%2Fworkspaces' },
  identity: { kind: 'identity', plural: 'Managed Identities', singular: 'Managed Identity',
              icon: 'identity', type: 'Microsoft.ManagedIdentity/userAssignedIdentities',
              market: 'Microsoft.ManagedIdentity',
              browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.ManagedIdentity%2FuserAssignedIdentities' },
  sqldb: { kind: 'sqldb', plural: 'SQL databases', singular: 'SQL database', icon: 'sqldb',
           type: 'Microsoft.Sql/servers/databases', market: 'Microsoft.SQLDatabase',
           browse: 'HubsExtension/BrowseResource/resourceType/Microsoft.Sql%2Fservers%2Fdatabases' },
};

export function meta(kind: string): KindMeta {
  return KINDS[kind] || { kind, plural: kind, singular: kind, icon: 'resource',
                          type: kind, browse: 'HubsExtension/BrowseAll' };
}

/** Kinds that have a create wizard in this skin. */
export const CREATABLE = ['vm', 'storage', 'vnet', 'nsg', 'publicip', 'routetable',
  'privatednszone', 'privateendpoint', 'firewall', 'plan', 'webapp', 'aks', 'sql', 'sqldb',
  'keyvault', 'acr', 'cosmos', 'workspace', 'identity'];

export const PORTAL = 'https://portal.azure.com';
export const DOMAIN = '#@selfstudy.jo';

export function resourceUrl(id: string, tab = 'overview'): string {
  return `${PORTAL}/${DOMAIN}/resource${id}/${tab}`;
}

export function browseUrl(kind: string): string {
  if (kind === 'groups') return `${PORTAL}/#browse/resourcegroups`;
  if (kind === 'all') return `${PORTAL}/#browse/all`;
  return `${PORTAL}/#view/${meta(kind).browse}`;
}

export const LOCATION_NAMES: Record<string, string> = {
  uaenorth: 'UAE North', westeurope: 'West Europe', northeurope: 'North Europe',
  eastus: 'East US', eastus2: 'East US 2', uksouth: 'UK South',
  southeastasia: 'Southeast Asia', qatarcentral: 'Qatar Central', global: 'Global',
};

export function locName(location: unknown): string {
  const key = String(location || '');
  return LOCATION_NAMES[key] || key || '—';
}

export const REGION_GEO: Record<string, string> = {
  uaenorth: 'Middle East', qatarcentral: 'Middle East', westeurope: 'Europe',
  northeurope: 'Europe', uksouth: 'Europe', eastus: 'United States',
  eastus2: 'United States', southeastasia: 'Asia Pacific',
};

/** `az ...` that deletes one resource of this kind, the way the CLI spells it. */
export function deleteCommand(res: Record<string, any>): string {
  const g = res.group;
  const n = res.name;
  switch (res.kind) {
    case 'vm': return cli(['az', 'vm', 'delete'], { '-g': g, '-n': n, '--yes': true });
    case 'storage': return cli(['az', 'storage', 'account', 'delete'], { '-g': g, '-n': n, '--yes': true });
    case 'vnet': return cli(['az', 'network', 'vnet', 'delete'], { '-g': g, '-n': n });
    case 'nsg': return cli(['az', 'network', 'nsg', 'delete'], { '-g': g, '-n': n });
    case 'publicip': return cli(['az', 'network', 'public-ip', 'delete'], { '-g': g, '-n': n });
    case 'nic': return cli(['az', 'network', 'nic', 'delete'], { '-g': g, '-n': n });
    case 'webapp': return cli(['az', 'webapp', 'delete'], { '-g': g, '-n': n });
    case 'plan': return cli(['az', 'appservice', 'plan', 'delete'], { '-g': g, '-n': n, '--yes': true });
    case 'aks': return cli(['az', 'aks', 'delete'], { '-g': g, '-n': n, '--yes': true });
    case 'sql': return cli(['az', 'sql', 'server', 'delete'], { '-g': g, '-n': n, '--yes': true });
    case 'keyvault': return cli(['az', 'keyvault', 'delete'], { '-g': g, '-n': n });
    case 'acr': return cli(['az', 'acr', 'delete'], { '-g': g, '-n': n, '--yes': true });
    case 'cosmos': return cli(['az', 'cosmosdb', 'delete'], { '-g': g, '-n': n, '--yes': true });
    case 'routetable': return cli(['az', 'network', 'route-table', 'delete'], { '-g': g, '-n': n });
    case 'privateendpoint': return cli(['az', 'network', 'private-endpoint', 'delete'], { '-g': g, '-n': n });
    case 'privatednszone': return cli(['az', 'network', 'private-dns', 'zone', 'delete'], { '-g': g, '-n': n, '--yes': true });
    case 'firewall': return cli(['az', 'network', 'firewall', 'delete'], { '-g': g, '-n': n });
    case 'gateway': return cli(['az', 'network', 'vnet-gateway', 'delete'], { '-g': g, '-n': n });
    case 'natgateway': return cli(['az', 'network', 'nat', 'gateway', 'delete'], { '-g': g, '-n': n });
    case 'workspace': return cli(['az', 'monitor', 'log-analytics', 'workspace', 'delete'],
                                 { '-g': g, '--workspace-name': n, '--yes': true });
    case 'identity': return cli(['az', 'identity', 'delete'], { '-g': g, '-n': n });
    case 'sqldb': return cli(['az', 'sql', 'db', 'delete'], { '-g': g, '-s': res.props?.server, '-n': n, '--yes': true });
    default: return cli(['az', 'resource', 'delete'], { '--ids': res.id });
  }
}

/** Dependents before what they depend on: a VM before its NSG, IP and VNet. */
const DELETE_ORDER = ['vm', 'webapp', 'sqldb', 'privateendpoint', 'aks', 'firewall', 'gateway', 'natgateway', 'nic'];
export function deleteOrder<T extends Record<string, any>>(items: T[]): T[] {
  const rank = (kind: string) => {
    const index = DELETE_ORDER.indexOf(kind);
    if (index >= 0) return index;
    return kind === 'vnet' ? 99 : kind === 'plan' ? 50 : 40;
  };
  return [...items].sort((a, b) => rank(String(a.kind)) - rank(String(b.kind)));
}

/** Tag editing the way the portal does it: replace the whole set. */
export function tagCommand(targetId: string, tags: Record<string, string>): string {
  const pairs = Object.entries(tags).filter(([k]) => k.trim()).map(([k, v]) => `${k.trim()}=${v}`);
  if (!pairs.length) return cli(['az', 'tag', 'delete'], { '--resource-id': targetId, '--yes': true });
  return cli(['az', 'tag', 'update'], { '--resource-id': targetId, '--operation': 'Replace',
                                        '--tags': pairs });
}

export function tagPairs(tags: Record<string, string>): string[] {
  return Object.entries(tags || {}).filter(([k]) => k.trim()).map(([k, v]) => `${k.trim()}=${v}`);
}

/**
 * Every resource the portal lists, including SQL databases - which the engine
 * keeps inside their server record, and which the portal shows as resources
 * of their own (`Microsoft.Sql/servers/databases`).
 */
export function allResources(p: Record<string, any>): Record<string, any>[] {
  const list = rows(p, 'resources');
  const dbs: Record<string, any>[] = [];
  for (const server of list.filter(r => r.kind === 'sql')) {
    for (const db of (server.props?.databases || []) as Record<string, any>[]) {
      dbs.push({ kind: 'sqldb', name: db.name, group: server.group, location: server.location,
                 type: 'Microsoft.Sql/servers/databases', id: `${server.id}/databases/${db.name}`,
                 state: 'Succeeded', created: server.created, tags: {},
                 props: { server: server.name, sku: db.sku, created: db.created, status: 'Online' } });
    }
  }
  return [...list, ...dbs];
}

export function findResource(p: Record<string, any>, id: string): Record<string, any> | null {
  return allResources(p).find(r => r.id === id) || null;
}

export function resourcesOf(p: Record<string, any>, kind: string): Record<string, any>[] {
  return allResources(p).filter(r => r.kind === kind);
}

export function groupId(p: Record<string, any>, name: string): string {
  const g = rows(p, 'groups').find(x => x.name === name);
  return g ? String(g.id) : `/subscriptions/${p?.account?.subscription}/resourceGroups/${name}`;
}

export function fmtDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  let date: Date;
  if (typeof value === 'number') date = new Date(value * (value < 1e12 ? 1000 : 1));
  else date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric',
                                        hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

export function deploymentName(kind: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  if (kind === 'group') return `Microsoft.ResourceGroup-${stamp}`;
  return `${meta(kind).market || 'Microsoft.Template'}-${stamp}`;
}

/** A scope's full id from a short form, for IAM and Policy blades. */
export function scopeLabel(scope: string): string {
  const text = String(scope || '');
  if (text.includes('/managementGroups/')) return `${text.split('/managementGroups/')[1]} (Management group)`;
  if (text.includes('/providers/') && text.includes('/resourceGroups/')) {
    return `${text.split('/').pop()} (Resource)`;
  }
  if (text.includes('/resourceGroups/')) return `${text.split('/resourceGroups/')[1]} (Resource group)`;
  if (text.startsWith('/subscriptions/')) return 'This subscription';
  return text;
}
