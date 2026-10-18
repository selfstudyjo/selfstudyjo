/**
 * The services the portal menu, All services and global search offer, in the
 * portal's own names and categories. A service is either a browse blade over
 * one resource kind, or one of the platform blades (Policy, Monitor, Cost
 * Management...) this skin draws itself.
 */
import type { AzRoute } from './azure';

export interface ServiceEntry {
  key: string;
  label: string;
  icon: string;
  route: AzRoute;
  category: string;
  favorite?: boolean;
  keywords?: string;
  /** URL fragment after portal.azure.com/ for a platform blade. */
  url?: string;
  description?: string;
}

function browse(kind: string, label: string, icon: string, category: string, extra: Partial<ServiceEntry> = {}): ServiceEntry {
  return { key: kind, label, icon, category, route: { page: 'browse', kind }, ...extra };
}
function blade(name: string, label: string, icon: string, category: string, url: string, extra: Partial<ServiceEntry> = {}): ServiceEntry {
  return { key: name, label, icon, category, url, route: { page: 'service', name }, ...extra };
}

export const SERVICES: ServiceEntry[] = [
  browse('all', 'All resources', 'allservices', 'General', { favorite: true, keywords: 'resources everything' }),
  browse('groups', 'Resource groups', 'group', 'General', { favorite: true, keywords: 'rg resource group' }),
  blade('subscriptions', 'Subscriptions', 'subscription', 'General', '#view/Microsoft_Azure_Billing/SubscriptionsBladeV2',
        { keywords: 'subscription account' }),
  blade('mgmt', 'Management groups', 'mgmt', 'Management and governance',
        '#view/Microsoft_Azure_ManagementGroups/ManagementGroupBrowseBlade/~/MGBrowse_overview',
        { keywords: 'management group hierarchy landing zone' }),
  browse('vm', 'Virtual machines', 'vm', 'Compute', { favorite: true, keywords: 'vm compute server' }),
  browse('aks', 'Kubernetes services', 'aks', 'Containers', { keywords: 'aks kubernetes k8s' }),
  browse('acr', 'Container registries', 'acr', 'Containers', { keywords: 'acr registry docker' }),
  browse('webapp', 'App Services', 'webapp', 'Web', { favorite: true, keywords: 'web app site app service' }),
  browse('plan', 'App Service plans', 'plan', 'Web', { keywords: 'server farm plan' }),
  browse('storage', 'Storage accounts', 'storage', 'Storage', { favorite: true, keywords: 'blob storage container' }),
  browse('vnet', 'Virtual networks', 'vnet', 'Networking', { favorite: true, keywords: 'vnet network subnet peering' }),
  browse('nsg', 'Network security groups', 'nsg', 'Networking', { keywords: 'nsg firewall rule security' }),
  browse('publicip', 'Public IP addresses', 'publicip', 'Networking', { keywords: 'ip address public' }),
  browse('nic', 'Network interfaces', 'nic', 'Networking', { keywords: 'nic interface' }),
  browse('routetable', 'Route tables', 'routetable', 'Networking', { keywords: 'udr route' }),
  browse('privateendpoint', 'Private endpoints', 'privateendpoint', 'Networking', { keywords: 'private link endpoint' }),
  browse('privatednszone', 'Private DNS zones', 'dnszone', 'Networking', { keywords: 'dns privatelink zone' }),
  browse('firewall', 'Firewalls', 'firewall', 'Networking', { keywords: 'azure firewall' }),
  browse('gateway', 'Virtual network gateways', 'gateway', 'Networking', { keywords: 'vpn gateway expressroute' }),
  browse('natgateway', 'NAT gateways', 'natgateway', 'Networking', { keywords: 'nat' }),
  blade('watcher', 'Network Watcher', 'watcher', 'Networking',
        '#view/Microsoft_Azure_Network/NetworkWatcherMenuBlade/~/overview',
        { keywords: 'connection troubleshoot effective rules path test' }),
  browse('sql', 'SQL servers', 'sqlserver', 'Databases', { keywords: 'sql server' }),
  browse('sqldb', 'SQL databases', 'sqldb', 'Databases', { favorite: true, keywords: 'sql database' }),
  browse('cosmos', 'Azure Cosmos DB', 'cosmos', 'Databases', { keywords: 'cosmos nosql document' }),
  browse('keyvault', 'Key vaults', 'keyvault', 'Security', { keywords: 'key vault secret' }),
  blade('deletedvaults', 'Deleted key vaults', 'keyvault', 'Security',
        '#view/HubsExtension/BrowseResource/resourceType/Microsoft.KeyVault%2FdeletedVaults',
        { keywords: 'soft delete purge recover' }),
  browse('identity', 'Managed Identities', 'identity', 'Identity', { keywords: 'managed identity msi' }),
  blade('entra', 'Microsoft Entra ID', 'entra', 'Identity', '#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview',
        { favorite: true, keywords: 'aad active directory users groups entra' }),
  blade('monitor', 'Monitor', 'monitor', 'Management and governance', '#view/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/~/overview',
        { favorite: true, keywords: 'monitor alerts logs metrics diagnostic' }),
  browse('workspace', 'Log Analytics workspaces', 'workspace', 'Management and governance',
         { keywords: 'log analytics kql workspace' }),
  browse('appinsights', 'Application Insights', 'appinsights', 'Management and governance', { keywords: 'app insights apm' }),
  blade('policy', 'Policy', 'policy', 'Management and governance', '#view/Microsoft_Azure_Policy/PolicyMenuBlade/~/Overview',
        { favorite: true, keywords: 'policy compliance governance assignment' }),
  blade('cost', 'Cost Management', 'cost', 'Management and governance',
        '#view/Microsoft_Azure_CostManagement/Menu/~/costanalysis',
        { favorite: true, keywords: 'cost billing budget finops' }),
  blade('advisor', 'Advisor', 'advisor', 'Management and governance', '#view/Microsoft_Azure_Expert/AdvisorMenuBlade/~/overview',
        { keywords: 'recommendations rightsize reservation' }),
  blade('deployments', 'Deploy a custom template', 'deploy', 'Management and governance',
        '#create/Microsoft.Template', { keywords: 'template bicep arm deployment what-if' }),
];

export function serviceFor(kindOrName: string): ServiceEntry | undefined {
  return SERVICES.find(s => s.key === kindOrName);
}
