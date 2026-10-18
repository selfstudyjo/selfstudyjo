/**
 * The create wizards, as data. Each spec lists the wizard's tabs and fields in
 * the portal's own words (Basics, Disks, Networking, ... Tags, Review + create)
 * and turns the finished form into the `az` command lines the deployment runs.
 *
 * Validation here mirrors what the portal checks before it lets you press
 * Create (name rules, required fields, a CIDR inside the address space); what
 * the platform refuses after that (a policy, a name taken globally) comes back
 * from the engine as the deployment's failure, exactly as in Azure.
 */
import { cli, rows } from '@/utils/portalKit';
import { allResources, locName, tagPairs } from './azure';

export interface Opt { value: string; label: string; disabled?: boolean }
export interface SpecCtx {
  p: Record<string, any>;
  v: Record<string, any>;
  values: Record<string, any>;
}
export interface Field {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'radio' | 'number' | 'check' | 'group' | 'textarea' | 'info' | 'subnets' | 'heading';
  options?: Opt[] | ((ctx: SpecCtx) => Opt[]);
  required?: boolean;
  help?: string | ((ctx: SpecCtx) => string);
  def?: string | number | boolean | Record<string, unknown>[] | ((ctx: SpecCtx) => unknown);
  validate?: (value: any, ctx: SpecCtx) => string;
  show?: (ctx: SpecCtx) => boolean;
  placeholder?: string;
  /** Not shown on the Review tab. */
  noReview?: boolean;
}
export interface Tab { name: string; intro?: string; fields: Field[] }
export interface Spec {
  kind: string;
  title: string;
  tabs: Tab[];
  tags?: boolean;
  build(values: Record<string, any>, ctx: SpecCtx): string[];
  name(values: Record<string, any>): string;
  group(values: Record<string, any>): string;
}

// ---------------------------------------------------------------- helpers
const locations = (ctx: SpecCtx): Opt[] => ((ctx.p.catalogue?.locations || ['uaenorth']) as string[])
  .map(l => ({ value: l, label: `(${geo(l)}) ${locName(l)}` }));
function geo(l: string) {
  return ({ uaenorth: 'Middle East', qatarcentral: 'Middle East', westeurope: 'Europe', northeurope: 'Europe',
            uksouth: 'Europe', eastus: 'US', eastus2: 'US', southeastasia: 'Asia Pacific' } as Record<string, string>)[l] || 'Other';
}
const groupLocation = (ctx: SpecCtx) => {
  const g = rows(ctx.p, 'groups').find(x => x.name === ctx.values.group);
  return g ? String(g.location) : String(ctx.v.location || ctx.p.catalogue?.locations?.[0] || 'uaenorth');
};
const exists = (ctx: SpecCtx, kind: string, name: string, group?: string) => allResources(ctx.p)
  .some(r => r.kind === kind && String(r.name).toLowerCase() === String(name).toLowerCase() && (!group || r.group === group));
const CIDR = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;
function cidrNum(text: string): [number, number] | null {
  const m = String(text || '').trim().match(CIDR);
  if (!m) return null;
  const parts = m.slice(1, 5).map(Number);
  const prefix = Number(m[5]);
  if (parts.some(x => x > 255) || prefix > 32) return null;
  const ip = ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  return [ip, prefix];
}
export function cidrInside(inner: string, outer: string): boolean {
  const a = cidrNum(inner);
  const b = cidrNum(outer);
  if (!a || !b || a[1] < b[1]) return false;
  const mask = b[1] === 0 ? 0 : (~0 << (32 - b[1])) >>> 0;
  return ((a[0] & mask) >>> 0) === ((b[0] & mask) >>> 0);
}
function cidrOverlap(x: string, y: string) { return cidrInside(x, y) || cidrInside(y, x); }
const cidrRule = (v: string) => (cidrNum(v) ? '' : 'The value must be a valid CIDR, such as 10.0.0.0/16.');

const PROJECT: Field[] = [
  { key: 'h1', label: 'Project details', type: 'heading',
    help: 'Select the subscription to manage deployed resources and costs. Use resource groups like folders to organize and manage all your resources.' },
  { key: 'subscription', label: 'Subscription', type: 'select', required: true,
    options: ctx => [{ value: String(ctx.p.account?.subscription || ''), label: String(ctx.p.account?.subscription_name || 'Self Study Lab') }],
    def: (ctx: SpecCtx) => String(ctx.p.account?.subscription || '') },
  { key: 'group', label: 'Resource group', type: 'group', required: true },
];
const region = (key = 'location'): Field => ({ key, label: 'Region', type: 'select', required: true, options: locations,
                                               def: groupLocation });
const instance = (): Field => ({ key: 'h2', label: 'Instance details', type: 'heading' });

/** A new resource group first, when the form asked for one. */
function preGroup(values: Record<string, any>, ctx: SpecCtx): string[] {
  if (!values.newGroup) return [];
  return [cli(['az', 'group', 'create'], { '--name': values.group, '--location': values.location || groupLocation(ctx) })];
}
function tags(values: Record<string, any>) { return tagPairs(values.tags || {}); }

// ---------------------------------------------------------------- specs
export const SPECS: Record<string, Spec> = {
  group: {
    kind: 'group', title: 'Create a resource group', tags: true,
    tabs: [{ name: 'Basics',
      intro: 'Resource group - A container that holds related resources for an Azure solution. The resource group can include all the resources for the solution, or only those resources that you want to manage as a group.',
      fields: [
        { key: 'h1', label: 'Project details', type: 'heading' },
        { key: 'subscription', label: 'Subscription', type: 'select', required: true,
          options: ctx => [{ value: String(ctx.p.account?.subscription || ''), label: String(ctx.p.account?.subscription_name || '') }],
          def: (ctx: SpecCtx) => String(ctx.p.account?.subscription || '') },
        { key: 'name', label: 'Resource group', type: 'text', required: true, placeholder: 'e.g. lab-rg',
          validate: (v, ctx) => (!/^[-\w.()]{1,90}$/.test(v) || v.endsWith('.')
            ? 'Resource group names only allow alphanumeric characters, periods, underscores, hyphens and parenthesis and cannot end in a period.'
            : rows(ctx.p, 'groups').some(g => String(g.name).toLowerCase() === v.toLowerCase()) ? `Resource group '${v}' already exists.` : '') },
        { key: 'h2', label: 'Resource details', type: 'heading' },
        { key: 'location', label: 'Region', type: 'select', required: true, options: locations,
          def: ctx => String(ctx.v.location || 'uaenorth') },
      ] }],
    build: v => [cli(['az', 'group', 'create'], { '--name': v.name, '--location': v.location, '--tags': tags(v) })],
    name: v => v.name, group: v => v.name,
  },

  vm: {
    kind: 'vm', title: 'Create a virtual machine', tags: true,
    tabs: [
      { name: 'Basics',
        intro: 'Create a virtual machine that runs Linux or Windows. Select an image from Azure marketplace or use your own customized image. Complete the Basics tab then Review + create to provision a virtual machine with default parameters or review each tab for full customization.',
        fields: [...PROJECT, instance(),
          { key: 'name', label: 'Virtual machine name', type: 'text', required: true,
            validate: (v, ctx) => (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}[A-Za-z0-9_]$|^[A-Za-z0-9]$/.test(v)
              ? 'The value must be between 1 and 64 characters long, contain only letters, numbers, periods, underscores and hyphens, and must not end with a period or hyphen.'
              : exists(ctx, 'vm', v, ctx.values.group) ? 'A virtual machine with this name already exists in the resource group.' : '') },
          region(),
          { key: 'zone', label: 'Availability options', type: 'select',
            options: [{ value: '', label: 'No infrastructure redundancy required' }, { value: '1', label: 'Availability zone 1' },
                      { value: '2', label: 'Availability zone 2' }, { value: '3', label: 'Availability zone 3' }], def: '' },
          { key: 'security', label: 'Security type', type: 'select', options: [{ value: 'TrustedLaunch', label: 'Trusted launch virtual machines' },
            { value: 'Standard', label: 'Standard' }], def: 'TrustedLaunch', noReview: false },
          { key: 'image', label: 'Image', type: 'select', required: true,
            options: ctx => ((ctx.p.catalogue?.images || []) as string[]).map(i => ({ value: i, label: IMAGE_NAMES[i] || i })),
            def: 'Ubuntu2204' },
          { key: 'size', label: 'Size', type: 'select', required: true,
            options: ctx => ((ctx.p.catalogue?.vm_sizes || []) as any[]).map(s => ({ value: s.name,
              label: `${s.name} - ${s.cpus} vcpu${s.cpus > 1 ? 's' : ''}, ${s.memory} GiB memory ($${s.monthly}/month)` })),
            def: 'Standard_B1s' },
          { key: 'h3', label: 'Administrator account', type: 'heading' },
          { key: 'auth', label: 'Authentication type', type: 'radio', options: [{ value: 'ssh', label: 'SSH public key' },
            { value: 'password', label: 'Password' }], def: 'ssh' },
          { key: 'admin', label: 'Username', type: 'text', required: true, def: 'azureuser',
            validate: v => (['admin', 'administrator', 'root', 'guest', 'user'].includes(String(v).toLowerCase())
              ? 'Username is not allowed.' : !/^[a-z_][a-z0-9_.-]{0,63}$/i.test(v) ? 'Username must only contain letters, numbers, hyphens, and underscores and may not start with a hyphen or number.' : '') },
          { key: 'keysource', label: 'SSH public key source', type: 'select', show: c => c.values.auth === 'ssh',
            options: [{ value: 'generate', label: 'Generate new key pair' }], def: 'generate' },
          { key: 'password', label: 'Password', type: 'password', required: true, show: c => c.values.auth === 'password',
            validate: v => {
              const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(v)).length;
              return v.length < 12 || v.length > 123 || classes < 3
                ? 'The value must be between 12 and 123 characters long and must have 3 of the following: 1 lower case character, 1 upper case character, 1 number, and 1 special character.' : '';
            } },
          { key: 'confirm', label: 'Confirm password', type: 'password', required: true, show: c => c.values.auth === 'password',
            validate: (v, c) => (v !== c.values.password ? 'Password and confirm password must match.' : ''), noReview: true },
          { key: 'h4', label: 'Inbound port rules', type: 'heading',
            help: 'Select which virtual machine network ports are accessible from the public internet.' },
          { key: 'ports', label: 'Public inbound ports', type: 'radio', options: [{ value: 'none', label: 'None' },
            { value: 'allow', label: 'Allow selected ports' }], def: 'allow' },
          { key: 'port', label: 'Select inbound ports', type: 'select', show: c => c.values.ports === 'allow',
            options: [{ value: 'SSH', label: 'SSH (22)' }, { value: 'RDP', label: 'RDP (3389)' }], def: 'SSH',
            help: c => (c.values.ports === 'allow' ? 'This will allow all IP addresses to access your virtual machine. This is only recommended for testing.' : '') },
        ] },
      { name: 'Disks', intro: 'Azure VMs have one operating system disk and a temporary disk for short-term storage.',
        fields: [
          { key: 'h1', label: 'VM disk encryption', type: 'heading' },
          { key: 'diskSize', label: 'OS disk size', type: 'select', options: [{ value: '30', label: 'Image default (30 GiB)' },
            { value: '64', label: '64 GiB (P6)' }, { value: '128', label: '128 GiB (P10)' }, { value: '256', label: '256 GiB (P15)' }], def: '30' },
          { key: 'diskType', label: 'OS disk type', type: 'select', options: [{ value: 'Premium_LRS', label: 'Premium SSD (locally-redundant storage)' },
            { value: 'StandardSSD_LRS', label: 'Standard SSD (locally-redundant storage)' }, { value: 'Standard_LRS', label: 'Standard HDD (locally-redundant storage)' }],
            def: 'Premium_LRS' },
          { key: 'deleteDisk', label: 'Delete with VM', type: 'check', def: true },
        ] },
      { name: 'Networking',
        intro: 'Define network connectivity for your virtual machine by configuring network interface card (NIC) settings. You can control ports, inbound and outbound connectivity with security group rules.',
        fields: [
          { key: 'h1', label: 'Network interface', type: 'heading' },
          { key: 'vnet', label: 'Virtual network', type: 'select', required: true,
            options: ctx => [{ value: '__new__', label: `(new) ${ctx.values.name || 'vm'}-vnet` },
              ...rows(ctx.p, 'vnets').filter(v => !ctx.values.group || v.group === ctx.values.group).map(v => ({ value: v.name, label: v.name }))],
            def: '__new__' },
          { key: 'subnet', label: 'Subnet', type: 'select', required: true,
            options: ctx => (ctx.values.vnet === '__new__' || !ctx.values.vnet
              ? [{ value: 'default', label: '(new) default (10.0.0.0/24)' }]
              : (rows(ctx.p, 'vnets').find(v => v.name === ctx.values.vnet)?.subnets || []).map((s: any) => ({ value: s.name, label: `${s.name} (${s.prefix})` }))),
            def: 'default' },
          { key: 'pip', label: 'Public IP', type: 'select', options: ctx => [{ value: '__new__', label: `(new) ${ctx.values.name || 'vm'}-ip` },
            { value: 'none', label: 'None' }], def: '__new__' },
          { key: 'nsgMode', label: 'NIC network security group', type: 'radio', options: [{ value: 'none', label: 'None' },
            { value: 'basic', label: 'Basic' }], def: 'basic' },
          { key: 'deleteNic', label: 'Delete public IP and NIC when VM is deleted', type: 'check', def: false },
        ] },
      { name: 'Management', fields: [
        { key: 'h1', label: 'Identity', type: 'heading' },
        { key: 'identity', label: 'Enable system assigned managed identity', type: 'check', def: false },
        { key: 'h2', label: 'Auto-shutdown', type: 'heading' },
        { key: 'shutdown', label: 'Enable auto-shutdown', type: 'check', def: false },
      ] },
      { name: 'Monitoring', fields: [
        { key: 'h1', label: 'Alerts', type: 'heading' },
        { key: 'alerts', label: 'Enable recommended alert rules', type: 'check', def: false },
        { key: 'h2', label: 'Diagnostics', type: 'heading' },
        { key: 'bootdiag', label: 'Boot diagnostics', type: 'radio', options: [{ value: 'managed', label: 'Enable with managed storage account (recommended)' },
          { value: 'off', label: 'Disable' }], def: 'managed' },
      ] },
      { name: 'Advanced', fields: [
        { key: 'h1', label: 'Custom data and cloud init', type: 'heading',
          help: 'Pass a script, configuration file, or other data into the virtual machine while it is being provisioned.' },
        { key: 'customData', label: 'Custom data', type: 'textarea', def: '' },
      ] },
    ],
    build: (v, ctx) => {
      const vnet = v.vnet === '__new__' ? `${v.name}-vnet` : v.vnet;
      const base: string[] = ['az', 'vm', 'create'];
      if (v.pip === 'none') base.push('--public-ip-address', '');
      if (v.nsgMode === 'none') base.push('--nsg', '');
      return [...preGroup(v, ctx), cli(base, {
        '--resource-group': v.group, '--name': v.name, '--location': v.location, '--image': v.image, '--size': v.size,
        '--admin-username': v.admin,
        '--authentication-type': v.auth,
        '--admin-password': v.auth === 'password' ? v.password : '',
        '--generate-ssh-keys': v.auth === 'ssh',
        '--vnet-name': vnet, '--subnet': v.subnet,
        '--public-ip-address': v.pip === '__new__' ? `${v.name}-ip` : '',
        '--nsg': v.nsgMode === 'basic' ? `${v.name}-nsg` : '',
        '--nsg-rule': v.nsgMode === 'basic' ? (v.ports === 'allow' ? v.port : 'NONE') : '',
        '--os-disk-size-gb': v.diskSize !== '30' ? v.diskSize : '',
        '--zone': v.zone,
        '--tags': tags(v),
      })];
    },
    name: v => v.name, group: v => v.group,
  },

  storage: {
    kind: 'storage', title: 'Create a storage account', tags: true,
    tabs: [
      { name: 'Basics', fields: [...PROJECT, instance(),
        { key: 'name', label: 'Storage account name', type: 'text', required: true,
          validate: (v, ctx) => (!/^[a-z0-9]{3,24}$/.test(v)
            ? 'The name must be between 3 and 24 characters, using only lowercase letters and numbers.'
            : exists(ctx, 'storage', v) ? 'The storage account name is already taken.' : '') },
        region(),
        { key: 'service', label: 'Primary service', type: 'select', options: [{ value: '', label: 'Select a primary service' },
          { value: 'blob', label: 'Azure Blob Storage or Azure Data Lake Storage Gen 2' }, { value: 'files', label: 'Azure Files' }], def: '' },
        { key: 'performance', label: 'Performance', type: 'radio', options: [{ value: 'Standard', label: 'Standard: Recommended for most scenarios (general-purpose v2 account)' },
          { value: 'Premium', label: 'Premium: Recommended for scenarios that require low latency.' }], def: 'Standard' },
        { key: 'redundancy', label: 'Redundancy', type: 'select',
          options: c => (c.values.performance === 'Premium' ? [{ value: 'Premium_LRS', label: 'Locally-redundant storage (LRS)' }]
            : [{ value: 'Standard_LRS', label: 'Locally-redundant storage (LRS)' }, { value: 'Standard_GRS', label: 'Geo-redundant storage (GRS)' },
               { value: 'Standard_ZRS', label: 'Zone-redundant storage (ZRS)' }]),
          def: 'Standard_LRS' },
      ] },
      { name: 'Advanced', fields: [
        { key: 'h1', label: 'Security', type: 'heading' },
        { key: 'https', label: 'Require secure transfer for REST API operations', type: 'check', def: true },
        { key: 'blobPublic', label: 'Allow enabling anonymous access on individual containers', type: 'check', def: false },
        { key: 'tls', label: 'Minimum TLS version', type: 'select', options: [{ value: 'TLS1_2', label: 'Version 1.2' },
          { value: 'TLS1_1', label: 'Version 1.1' }, { value: 'TLS1_0', label: 'Version 1.0' }], def: 'TLS1_2' },
        { key: 'h2', label: 'Blob storage', type: 'heading' },
        { key: 'tier', label: 'Access tier', type: 'radio', options: [{ value: 'Hot', label: 'Hot: Optimized for frequently accessed data' },
          { value: 'Cool', label: 'Cool: Optimized for infrequently accessed data' }, { value: 'Cold', label: 'Cold: Optimized for rarely accessed data' }], def: 'Hot' },
      ] },
      { name: 'Networking', fields: [
        { key: 'h1', label: 'Network access', type: 'heading' },
        { key: 'network', label: 'Network access', type: 'radio', options: [{ value: 'Enabled', label: 'Enable public access from all networks' },
          { value: 'Disabled', label: 'Disable public access and use private access' }], def: 'Enabled' },
      ] },
      { name: 'Data protection', fields: [
        { key: 'h1', label: 'Recovery', type: 'heading' },
        { key: 'softBlob', label: 'Enable soft delete for blobs', type: 'check', def: true },
        { key: 'softContainer', label: 'Enable soft delete for containers', type: 'check', def: true },
      ] },
      { name: 'Encryption', fields: [
        { key: 'enc', label: 'Encryption type', type: 'radio', options: [{ value: 'mmk', label: 'Microsoft-managed keys (MMK)' }], def: 'mmk' },
      ] },
    ],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'storage', 'account', 'create'], {
      '--name': v.name, '--resource-group': v.group, '--location': v.location,
      '--sku': v.performance === 'Premium' ? 'Premium_LRS' : v.redundancy, '--kind': 'StorageV2',
      '--access-tier': v.tier, '--https-only': v.https ? '' : 'false', '--min-tls-version': v.tls,
      '--allow-blob-public-access': v.blobPublic ? 'true' : 'false',
      '--public-network-access': v.network === 'Disabled' ? 'Disabled' : '', '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  vnet: {
    kind: 'vnet', title: 'Create virtual network', tags: true,
    tabs: [
      { name: 'Basics', intro: 'Azure Virtual Network (VNet) is the fundamental building block for your private network in Azure.',
        fields: [...PROJECT, instance(),
          { key: 'name', label: 'Virtual network name', type: 'text', required: true,
            validate: (v, ctx) => (!/^[A-Za-z0-9][\w.-]{0,62}[\w]$|^[A-Za-z0-9]$/.test(v) ? 'The name must begin with a letter or number, end with a letter, number or underscore, and may contain only letters, numbers, underscores, periods, or hyphens.'
              : exists(ctx, 'vnet', v, ctx.values.group) ? 'A virtual network with this name already exists.' : '') },
          region()] },
      { name: 'Security', fields: [
        { key: 'bastion', label: 'Enable Azure Bastion', type: 'check', def: false },
        { key: 'firewall', label: 'Enable Azure Firewall', type: 'check', def: false },
        { key: 'ddos', label: 'Enable Azure DDoS Network Protection', type: 'check', def: false },
      ] },
      { name: 'IP addresses', intro: 'Configure your virtual network address space with the IPv4 and IPv6 addresses and subnets you need.',
        fields: [
          { key: 'space', label: 'IPv4 address space', type: 'text', required: true, def: '10.0.0.0/16', validate: cidrRule },
          { key: 'subnets', label: 'Subnets', type: 'subnets', def: [{ name: 'default', prefix: '10.0.0.0/24' }],
            validate: (list: any[], ctx) => {
              if (!list.length) return 'Add at least one subnet.';
              for (const s of list) {
                if (!s.name) return 'Every subnet needs a name.';
                if (!cidrNum(s.prefix)) return `Subnet '${s.name}' needs a valid CIDR.`;
                if (!cidrInside(s.prefix, ctx.values.space)) return `Subnet '${s.name}' (${s.prefix}) is not within the address space ${ctx.values.space}.`;
              }
              for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
                if (cidrOverlap(list[i].prefix, list[j].prefix)) return `Subnets '${list[i].name}' and '${list[j].name}' overlap.`;
                if (list[i].name === list[j].name) return 'Subnet names must be unique.';
              }
              return '';
            } },
        ] },
    ],
    build: (v, ctx) => {
      const subnets = (v.subnets || []) as { name: string; prefix: string }[];
      const out = [...preGroup(v, ctx), cli(['az', 'network', 'vnet', 'create'], {
        '--resource-group': v.group, '--name': v.name, '--location': v.location, '--address-prefixes': v.space,
        '--subnet-name': subnets[0]?.name, '--subnet-prefixes': subnets[0]?.prefix, '--tags': tags(v) })];
      for (const s of subnets.slice(1)) {
        out.push(cli(['az', 'network', 'vnet', 'subnet', 'create'], { '--resource-group': v.group, '--vnet-name': v.name,
          '--name': s.name, '--address-prefixes': s.prefix }));
      }
      return out;
    },
    name: v => v.name, group: v => v.group,
  },

  nsg: simple('nsg', 'Create network security group', 'Name',
              v => /^[A-Za-z0-9][\w.-]{0,79}$/.test(v) ? '' : 'The name must begin with a letter or number and contain only letters, numbers, underscores, periods, or hyphens.',
              (v, ctx) => [...preGroup(v, ctx), cli(['az', 'network', 'nsg', 'create'],
                { '--resource-group': v.group, '--name': v.name, '--location': v.location, '--tags': tags(v) })]),

  publicip: {
    kind: 'publicip', title: 'Create public IP address', tags: true,
    tabs: [{ name: 'Basics', fields: [...PROJECT, instance(), region(),
      { key: 'name', label: 'Name', type: 'text', required: true,
        validate: (v, ctx) => (!/^[A-Za-z0-9][\w.-]{0,78}$/.test(v) ? 'Invalid name.' : exists(ctx, 'publicip', v, ctx.values.group) ? 'Name already in use.' : '') },
      { key: 'version', label: 'IP Version', type: 'radio', options: [{ value: 'IPv4', label: 'IPv4' }, { value: 'IPv6', label: 'IPv6' }], def: 'IPv4' },
      { key: 'sku', label: 'SKU', type: 'radio', options: [{ value: 'Standard', label: 'Standard' }, { value: 'Basic', label: 'Basic' }], def: 'Standard' },
      { key: 'alloc', label: 'IP address assignment', type: 'radio', options: c => [{ value: 'Static', label: 'Static' },
        { value: 'Dynamic', label: 'Dynamic', disabled: c.values.sku === 'Standard' }], def: 'Static' },
      { key: 'dns', label: 'DNS name label', type: 'text', placeholder: 'Optional', help: c => (c.values.dns ? `${c.values.dns}.${c.values.location}.cloudapp.azure.com` : '') },
    ] }],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'network', 'public-ip', 'create'], { '--resource-group': v.group, '--name': v.name,
      '--location': v.location, '--sku': v.sku, '--version': v.version, '--allocation-method': v.alloc, '--dns-name': v.dns, '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  routetable: {
    kind: 'routetable', title: 'Create Route table', tags: true,
    tabs: [{ name: 'Basics', fields: [...PROJECT, instance(), region(),
      { key: 'name', label: 'Name', type: 'text', required: true, validate: (v, ctx) => (exists(ctx, 'routetable', v) ? 'Name already in use.' : /^[A-Za-z0-9][\w.-]{0,79}$/.test(v) ? '' : 'Invalid name.') },
      { key: 'propagate', label: 'Propagate gateway routes', type: 'radio', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], def: 'yes' },
    ] }],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'network', 'route-table', 'create'], { '--resource-group': v.group, '--name': v.name,
      '--location': v.location, '--disable-bgp-route-propagation': v.propagate === 'no' ? 'true' : '', '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  privatednszone: {
    kind: 'privatednszone', title: 'Create Private DNS zone', tags: true,
    tabs: [{ name: 'Basics', intro: 'A private DNS zone is used to resolve names in your virtual networks. For a private endpoint, the zone name must be the exact privatelink zone the service uses.',
      fields: [...PROJECT, instance(),
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'privatelink.blob.core.windows.net',
          validate: (v, ctx) => (exists(ctx, 'privatednszone', v) ? 'This zone already exists.'
            : /^([a-z0-9-]+\.)+[a-z0-9-]+$/i.test(v) ? '' : 'The zone name must be a valid DNS name, such as contoso.internal.'),
          help: ctx => `Common privatelink zones: ${Object.values(ctx.p.catalogue?.private_zones || {}).slice(0, 4).join(', ')}` },
        { key: 'location', label: 'Resource group region', type: 'info', def: groupLocation },
      ] }],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'network', 'private-dns', 'zone', 'create'], { '--resource-group': v.group, '--name': v.name, '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  privateendpoint: {
    kind: 'privateendpoint', title: 'Create a private endpoint', tags: true,
    tabs: [
      { name: 'Basics', fields: [...PROJECT, instance(),
        { key: 'name', label: 'Name', type: 'text', required: true, validate: (v, ctx) => (exists(ctx, 'privateendpoint', v) ? 'Name already in use.' : v ? '' : 'Required') },
        region()] },
      { name: 'Resource', fields: [
        { key: 'target', label: 'Resource', type: 'select', required: true,
          options: ctx => allResources(ctx.p).filter(r => ['storage', 'sql', 'keyvault', 'acr', 'cosmos', 'webapp', 'aks', 'redis'].includes(r.kind))
            .map(r => ({ value: `${r.kind}|${r.name}`, label: `${r.name} (${r.kind})` })) },
        { key: 'sub', label: 'Target sub-resource', type: 'select', required: true,
          options: ctx => {
            const kind = String(ctx.values.target || '').split('|')[0];
            return ({ storage: ['blob', 'file', 'dfs'], sql: ['sqlServer'], keyvault: ['vault'], acr: ['registry'],
                      cosmos: ['Sql'], webapp: ['sites'], aks: ['management'], redis: ['redisCache'] } as Record<string, string[]>)[kind]
              ?.map(x => ({ value: x, label: x })) || [];
          } },
      ] },
      { name: 'Virtual Network', fields: [
        { key: 'vnet', label: 'Virtual network', type: 'select', required: true, options: ctx => rows(ctx.p, 'vnets').map(v => ({ value: v.name, label: v.name })) },
        { key: 'subnet', label: 'Subnet', type: 'select', required: true,
          options: ctx => (rows(ctx.p, 'vnets').find(v => v.name === ctx.values.vnet)?.subnets || []).map((s: any) => ({ value: s.name, label: `${s.name} (${s.prefix})` })) },
      ] },
      { name: 'DNS', intro: 'To connect privately with your private endpoint you need a DNS record. Configure the DNS zone group from the endpoint\'s DNS configuration blade after it is created.',
        fields: [{ key: 'dnsinfo', label: 'Integrate with private DNS zone', type: 'info', def: 'Configure after creation (az network private-endpoint dns-zone-group create)' }] },
    ],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'network', 'private-endpoint', 'create'], { '--resource-group': v.group, '--name': v.name,
      '--vnet-name': v.vnet, '--subnet': v.subnet, '--private-connection-resource-id': String(v.target || '').split('|')[1],
      '--group-id': v.sub, '--location': v.location, '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  firewall: {
    kind: 'firewall', title: 'Create a firewall', tags: true,
    tabs: [{ name: 'Basics', fields: [...PROJECT, instance(),
      { key: 'name', label: 'Name', type: 'text', required: true, validate: (v, ctx) => (exists(ctx, 'firewall', v) ? 'Name already in use.' : v ? '' : 'Required') },
      region(),
      { key: 'sku', label: 'Firewall SKU', type: 'radio', options: [{ value: 'Basic', label: 'Basic' }, { value: 'Standard', label: 'Standard' }, { value: 'Premium', label: 'Premium' }], def: 'Standard' },
      { key: 'vnet', label: 'Virtual network', type: 'select', required: true, options: ctx => rows(ctx.p, 'vnets').map(v => ({ value: v.name, label: v.name })),
        help: 'The virtual network must have a subnet named AzureFirewallSubnet (/26 or larger).',
        validate: (v, ctx) => (v && !(rows(ctx.p, 'vnets').find(x => x.name === v)?.subnets || []).some((s: any) => s.name === 'AzureFirewallSubnet')
          ? 'The selected virtual network has no AzureFirewallSubnet.' : '') },
      { key: 'threat', label: 'Threat intelligence mode', type: 'select', options: [{ value: 'Alert', label: 'Alert only' }, { value: 'Deny', label: 'Alert and deny' }, { value: 'Off', label: 'Off' }], def: 'Alert' },
    ] }],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'network', 'firewall', 'create'], { '--resource-group': v.group, '--name': v.name,
      '--vnet-name': v.vnet, '--sku': v.sku, '--threat-intel-mode': v.threat, '--location': v.location, '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  plan: {
    kind: 'plan', title: 'Create App Service Plan', tags: true,
    tabs: [{ name: 'Basics', fields: [...PROJECT, { key: 'h2', label: 'App Service Plan details', type: 'heading' },
      { key: 'name', label: 'Name', type: 'text', required: true, validate: (v, ctx) => (exists(ctx, 'plan', v, ctx.values.group) ? 'Name already in use.' : /^[A-Za-z0-9-]{1,40}$/.test(v) ? '' : 'Only letters, numbers and hyphens.') },
      { key: 'os', label: 'Operating System', type: 'radio', options: [{ value: 'linux', label: 'Linux' }, { value: 'windows', label: 'Windows' }], def: 'linux' },
      region(),
      { key: 'sku', label: 'Pricing plan', type: 'select', options: [{ value: 'F1', label: 'Free F1' }, { value: 'B1', label: 'Basic B1' },
        { value: 'S1', label: 'Standard S1' }, { value: 'P1v3', label: 'Premium V3 P1V3' }], def: 'B1' },
    ] }],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'appservice', 'plan', 'create'], { '--resource-group': v.group, '--name': v.name,
      '--sku': v.sku, '--is-linux': v.os === 'linux', '--location': v.location, '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  webapp: {
    kind: 'webapp', title: 'Create Web App', tags: true,
    tabs: [
      { name: 'Basics', intro: 'App Service Web Apps lets you quickly build, deploy, and scale enterprise-grade web, mobile, and API apps running on any platform.',
        fields: [...PROJECT, instance(),
          { key: 'name', label: 'Name', type: 'text', required: true,
            validate: (v, ctx) => (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,58}[A-Za-z0-9])?$/.test(v) ? 'The name can contain letters, numbers and hyphens, and must be 2-60 characters.'
              : exists(ctx, 'webapp', v) ? 'This web app name is not available.' : ''),
            help: c => (c.values.name ? `${c.values.name}.azurewebsites.net` : '.azurewebsites.net') },
          { key: 'publish', label: 'Publish', type: 'radio', options: [{ value: 'code', label: 'Code' }, { value: 'container', label: 'Container', disabled: true }], def: 'code' },
          { key: 'runtime', label: 'Runtime stack', type: 'select', required: true,
            options: ctx => ((ctx.p.catalogue?.runtimes || []) as string[]).map(r => ({ value: r, label: r.replace(':', ' ') })), def: 'PYTHON:3.12' },
          { key: 'os', label: 'Operating System', type: 'radio', options: [{ value: 'linux', label: 'Linux' }], def: 'linux' },
          region(),
          { key: 'h3', label: 'Pricing plans', type: 'heading' },
          { key: 'plan', label: 'Linux Plan', type: 'select', required: true,
            options: ctx => [{ value: '__new__', label: `(New) ASP-${ctx.values.group || 'rg'}` },
              ...allResources(ctx.p).filter(r => r.kind === 'plan' && r.group === ctx.values.group).map(r => ({ value: r.name, label: `${r.name} (${r.props?.sku})` }))],
            def: '__new__' },
          { key: 'sku', label: 'Pricing plan', type: 'select', show: c => c.values.plan === '__new__',
            options: [{ value: 'F1', label: 'Free F1 (Shared infrastructure)' }, { value: 'B1', label: 'Basic B1 (100 total ACU, 1.75 GB memory)' },
                      { value: 'P1v3', label: 'Premium V3 P1V3 (195 minimum ACU/vCPU, 8 GB memory)' }], def: 'B1' },
        ] },
      { name: 'Deployment', fields: [{ key: 'cd', label: 'Continuous deployment', type: 'radio', options: [{ value: 'off', label: 'Disable' }], def: 'off' }] },
      { name: 'Networking', fields: [{ key: 'public', label: 'Enable public access', type: 'radio', options: [{ value: 'on', label: 'On' }], def: 'on' }] },
      { name: 'Monitoring', fields: [{ key: 'ai', label: 'Enable Application Insights', type: 'radio', options: [{ value: 'no', label: 'No' }], def: 'no' }] },
    ],
    build: (v, ctx) => {
      const plan = v.plan === '__new__' ? `ASP-${v.group}` : v.plan;
      const out = [...preGroup(v, ctx)];
      if (v.plan === '__new__') {
        out.push(cli(['az', 'appservice', 'plan', 'create'], { '--resource-group': v.group, '--name': plan, '--sku': v.sku,
          '--is-linux': true, '--location': v.location }));
      }
      out.push(cli(['az', 'webapp', 'create'], { '--resource-group': v.group, '--plan': plan, '--name': v.name,
        '--runtime': v.runtime, '--tags': tags(v) }));
      return out;
    },
    name: v => v.name, group: v => v.group,
  },

  aks: {
    kind: 'aks', title: 'Create Kubernetes cluster', tags: true,
    tabs: [
      { name: 'Basics', fields: [...PROJECT, { key: 'h2', label: 'Cluster details', type: 'heading' },
        { key: 'preset', label: 'Cluster preset configuration', type: 'select', options: [{ value: 'dev', label: 'Dev/Test' }, { value: 'prod', label: 'Production Standard' }], def: 'dev' },
        { key: 'name', label: 'Kubernetes cluster name', type: 'text', required: true,
          validate: (v, ctx) => (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,61}[A-Za-z0-9]$/.test(v) ? 'The name must be 1-63 characters: letters, numbers, underscores and hyphens.'
            : exists(ctx, 'aks', v, ctx.values.group) ? 'A cluster with this name already exists.' : '') },
        region(),
        { key: 'version', label: 'Kubernetes version', type: 'select', options: [{ value: '1.29.7', label: '1.29.7 (default)' }], def: '1.29.7' }] },
      { name: 'Node pools', fields: [
        { key: 'size', label: 'Node size', type: 'select', options: ctx => ((ctx.p.catalogue?.vm_sizes || []) as any[]).map(s => ({ value: s.name, label: s.name })), def: 'Standard_D2s_v5' },
        { key: 'count', label: 'Node count', type: 'number', def: 3, validate: v => (Number(v) >= 1 && Number(v) <= 100 ? '' : 'Node count must be between 1 and 100.') },
      ] },
      { name: 'Networking', fields: [{ key: 'net', label: 'Network configuration', type: 'radio', options: [{ value: 'overlay', label: 'Azure CNI Overlay' }], def: 'overlay' }] },
      { name: 'Integrations', fields: [{ key: 'acr', label: 'Container registry', type: 'select', options: [{ value: '', label: 'None' }], def: '' }] },
      { name: 'Monitoring', fields: [{ key: 'mon', label: 'Enable Container insights', type: 'check', def: false }] },
    ],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'aks', 'create'], { '--resource-group': v.group, '--name': v.name,
      '--node-count': v.count, '--node-vm-size': v.size, '--location': v.location, '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  sql: {
    kind: 'sql', title: 'Create SQL Database Server', tags: true,
    tabs: [{ name: 'Basics', fields: [...PROJECT, { key: 'h2', label: 'Server details', type: 'heading' },
      { key: 'name', label: 'Server name', type: 'text', required: true,
        validate: (v, ctx) => (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(v) ? 'Your server name can contain only lowercase letters, numbers, and \'-\', but can\'t start or end with \'-\' or have more than 63 characters.'
          : exists(ctx, 'sql', v) ? 'This server name is already taken.' : ''), help: c => (c.values.name ? `${c.values.name}.database.windows.net` : '.database.windows.net') },
      region(),
      { key: 'h3', label: 'Authentication', type: 'heading' },
      { key: 'authMethod', label: 'Authentication method', type: 'radio', options: [{ value: 'sql', label: 'Use SQL authentication' }], def: 'sql' },
      { key: 'admin', label: 'Server admin login', type: 'text', required: true, def: 'sqladmin',
        validate: v => (['admin', 'sa', 'root', 'administrator'].includes(String(v).toLowerCase()) ? 'Login name is not allowed.' : '') },
      { key: 'password', label: 'Password', type: 'password', required: true,
        validate: v => ([/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(v)).length < 3 || v.length < 8 ? 'Your password must be at least 8 characters and contain characters from three of these categories: uppercase, lowercase, numbers and non-alphanumeric.' : '') },
    ] }],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'sql', 'server', 'create'], { '--resource-group': v.group, '--name': v.name,
      '--location': v.location, '--admin-user': v.admin, '--admin-password': v.password, '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  sqldb: {
    kind: 'sqldb', title: 'Create SQL Database', tags: false,
    tabs: [{ name: 'Basics', fields: [...PROJECT, { key: 'h2', label: 'Database details', type: 'heading' },
      { key: 'name', label: 'Database name', type: 'text', required: true,
        validate: (v, ctx) => (!/^[^<>*%&:\\/?]{1,128}$/.test(v) ? 'Invalid database name.' : allResources(ctx.p).some(r => r.kind === 'sqldb' && r.props?.server === ctx.values.server && r.name === v) ? 'A database with this name already exists on the server.' : '') },
      { key: 'server', label: 'Server', type: 'select', required: true,
        options: ctx => allResources(ctx.p).filter(r => r.kind === 'sql' && (!ctx.values.group || r.group === ctx.values.group)).map(r => ({ value: r.name, label: `${r.name} (${r.location})` })),
        help: 'Create the server first from SQL servers if the list is empty.' },
      { key: 'elastic', label: 'Want to use SQL elastic pool?', type: 'radio', options: [{ value: 'no', label: 'No' }], def: 'no' },
      { key: 'tier', label: 'Compute + storage', type: 'select', options: [{ value: 'Basic', label: 'Basic, 2 GB storage' },
        { value: 'S0', label: 'Standard S0, 10 DTUs, 250 GB storage' }, { value: 'GP_S_Gen5_1', label: 'General Purpose - Serverless: Gen5, 1 vCore' }], def: 'S0' },
    ] }],
    build: v => [cli(['az', 'sql', 'db', 'create'], { '--resource-group': v.group, '--server': v.server, '--name': v.name,
                                                    '--service-objective': v.tier })],
    name: v => v.name, group: v => v.group,
  },

  keyvault: {
    kind: 'keyvault', title: 'Create a key vault', tags: true,
    tabs: [
      { name: 'Basics', intro: 'Azure Key Vault is a cloud service used to manage keys, secrets, and certificates.',
        fields: [...PROJECT, instance(),
          { key: 'name', label: 'Key vault name', type: 'text', required: true,
            validate: (v, ctx) => (!/^[A-Za-z](?!.*--)[A-Za-z0-9-]{1,22}[A-Za-z0-9]$/.test(v) ? 'Vault name must only contain alphanumeric characters and dashes and cannot start with a number. It must be 3-24 characters long and cannot contain consecutive dashes.'
              : exists(ctx, 'keyvault', v) ? 'The vault name is already in use.'
              : rows(ctx.p, 'deleted_vaults').some(d => d.name === v) ? 'A vault with this name exists in a soft-deleted state. Recover or purge it from "Manage deleted vaults".' : '') },
          region(),
          { key: 'sku', label: 'Pricing tier', type: 'select', options: [{ value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }], def: 'standard' },
          { key: 'h3', label: 'Recovery options', type: 'heading' },
          { key: 'retention', label: 'Days to retain deleted vaults', type: 'number', def: 90,
            validate: v => (Number(v) >= 7 && Number(v) <= 90 ? '' : 'The value must be between 7 and 90.') },
          { key: 'purge', label: 'Purge protection', type: 'radio', options: [{ value: 'disable', label: 'Disable purge protection' },
            { value: 'enable', label: 'Enable purge protection (enforce a mandatory retention period for deleted vaults and vault objects)' }], def: 'disable' },
        ] },
      { name: 'Access configuration', fields: [
        { key: 'model', label: 'Permission model', type: 'radio', options: [{ value: 'rbac', label: 'Azure role-based access control (recommended)' },
          { value: 'policy', label: 'Vault access policy' }], def: 'rbac' },
      ] },
      { name: 'Networking', fields: [{ key: 'public', label: 'Enable public access', type: 'check', def: true }] },
    ],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'keyvault', 'create'], { '--resource-group': v.group, '--name': v.name,
      '--location': v.location, '--sku': v.sku, '--retention-days': v.retention, '--enable-purge-protection': v.purge === 'enable' ? 'true' : '',
      '--enable-rbac-authorization': v.model === 'policy' ? 'false' : 'true', '--public-network-access': v.public ? '' : 'Disabled', '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  acr: {
    kind: 'acr', title: 'Create container registry', tags: true,
    tabs: [{ name: 'Basics', fields: [...PROJECT, instance(),
      { key: 'name', label: 'Registry name', type: 'text', required: true,
        validate: (v, ctx) => (!/^[A-Za-z0-9]{5,50}$/.test(v) ? 'Resource names may contain alpha numeric characters only and must be between 5 and 50 characters.'
          : exists(ctx, 'acr', v) ? 'The registry name is already in use.' : ''), help: c => (c.values.name ? `${String(c.values.name).toLowerCase()}.azurecr.io` : '.azurecr.io') },
      region(),
      { key: 'sku', label: 'Pricing plan', type: 'select', options: [{ value: 'Basic', label: 'Basic' }, { value: 'Standard', label: 'Standard' }, { value: 'Premium', label: 'Premium' }], def: 'Standard' },
    ] }],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'acr', 'create'], { '--resource-group': v.group, '--name': v.name, '--sku': v.sku,
      '--location': v.location, '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  cosmos: {
    kind: 'cosmos', title: 'Create Azure Cosmos DB Account - Azure Cosmos DB for NoSQL', tags: true,
    tabs: [{ name: 'Basics', fields: [...PROJECT, instance(),
      { key: 'name', label: 'Account Name', type: 'text', required: true,
        validate: (v, ctx) => (!/^[a-z0-9](?!.*--)[a-z0-9-]{1,42}[a-z0-9]$/.test(v) ? 'The name can contain only lowercase letters, numbers and the \'-\' character, and must be between 3 and 44 characters.'
          : exists(ctx, 'cosmos', v) ? 'The account name is already in use.' : '') },
      region(),
      { key: 'capacity', label: 'Capacity mode', type: 'radio', options: [{ value: 'provisioned', label: 'Provisioned throughput' }, { value: 'serverless', label: 'Serverless' }], def: 'provisioned' },
      { key: 'consistency', label: 'Default consistency', type: 'select', options: ['Session', 'Eventual', 'ConsistentPrefix', 'BoundedStaleness', 'Strong'].map(x => ({ value: x, label: x })), def: 'Session' },
    ] }],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'cosmosdb', 'create'], { '--resource-group': v.group, '--name': v.name,
      '--kind': 'GlobalDocumentDB', '--default-consistency-level': v.consistency, '--location': v.location,
      '--capabilities': v.capacity === 'serverless' ? 'EnableServerless' : '', '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  workspace: {
    kind: 'workspace', title: 'Create Log Analytics workspace', tags: true,
    tabs: [{ name: 'Basics', intro: 'A Log Analytics workspace is the basic management unit of Azure Monitor Logs.',
      fields: [...PROJECT, instance(),
        { key: 'name', label: 'Name', type: 'text', required: true,
          validate: (v, ctx) => (!/^[A-Za-z0-9][A-Za-z0-9-]{2,61}[A-Za-z0-9]$/.test(v) ? 'The workspace name must be 4-63 characters: letters, numbers and hyphens, starting and ending with a letter or number.'
            : rows(ctx.p, 'workspaces').some(w => w.name === v) ? 'A workspace with this name already exists.' : '') },
        region(),
        { key: 'retention', label: 'Data retention (days)', type: 'number', def: 30, validate: v => (Number(v) >= 30 && Number(v) <= 730 ? '' : 'Retention must be between 30 and 730 days.') },
      ] }],
    build: (v, ctx) => [...preGroup(v, ctx), cli(['az', 'monitor', 'log-analytics', 'workspace', 'create'], { '--resource-group': v.group,
      '--workspace-name': v.name, '--location': v.location, '--retention-time': v.retention, '--tags': tags(v) })],
    name: v => v.name, group: v => v.group,
  },

  identity: simple('identity', 'Create User Assigned Managed Identity', 'Name',
                   v => /^[A-Za-z0-9][\w-]{2,127}$/.test(v) ? '' : 'The name must be 3-128 characters: letters, numbers, hyphens and underscores.',
                   (v, ctx) => [...preGroup(v, ctx), cli(['az', 'identity', 'create'], { '--resource-group': v.group, '--name': v.name,
                                                                                       '--location': v.location, '--tags': tags(v) })]),
};

function simple(kind: string, title: string, label: string, rule: (v: string) => string,
                build: (v: Record<string, any>, ctx: SpecCtx) => string[]): Spec {
  return {
    kind, title, tags: true,
    tabs: [{ name: 'Basics', fields: [...PROJECT, instance(),
      { key: 'name', label, type: 'text', required: true,
        validate: (v, ctx) => rule(v) || (exists(ctx, kind, v, ctx.values.group) ? 'A resource with this name already exists in the resource group.' : '') },
      region()] }],
    build, name: v => v.name, group: v => v.group,
  };
}

export const IMAGE_NAMES: Record<string, string> = {
  Ubuntu2204: 'Ubuntu Server 22.04 LTS - x64 Gen2', Ubuntu2404: 'Ubuntu Server 24.04 LTS - x64 Gen2',
  Debian12: 'Debian 12 "Bookworm" - x64 Gen2', RHELRaw8LVMGen2: 'Red Hat Enterprise Linux 8 (LVM) - x64 Gen2',
  Win2022Datacenter: 'Windows Server 2022 Datacenter: Azure Edition - x64 Gen2',
  CentOS85Gen2: 'CentOS-based 8.5 - x64 Gen2',
};

/** The Marketplace's "Create a resource" page: popular products by category. */
export const MARKET: { category: string; items: { kind: string; label: string; icon: string; blurb: string }[] }[] = [
  { category: 'Popular Azure services', items: [
    { kind: 'vm', label: 'Virtual machine', icon: 'vm', blurb: 'Linux and Windows virtual machines' },
    { kind: 'storage', label: 'Storage account', icon: 'storage', blurb: 'Blob, file, table and queue storage' },
    { kind: 'webapp', label: 'Web App', icon: 'webapp', blurb: 'Build and host web apps' },
    { kind: 'sqldb', label: 'SQL Database', icon: 'sqldb', blurb: 'Managed relational database' },
    { kind: 'aks', label: 'Kubernetes Service', icon: 'aks', blurb: 'Managed Kubernetes clusters' },
    { kind: 'keyvault', label: 'Key Vault', icon: 'keyvault', blurb: 'Safeguard keys and secrets' },
  ] },
  { category: 'Networking', items: [
    { kind: 'vnet', label: 'Virtual network', icon: 'vnet', blurb: 'Private networks in Azure' },
    { kind: 'nsg', label: 'Network security group', icon: 'nsg', blurb: 'Filter network traffic' },
    { kind: 'publicip', label: 'Public IP address', icon: 'publicip', blurb: 'Internet-facing addresses' },
    { kind: 'routetable', label: 'Route table', icon: 'routetable', blurb: 'User-defined routes' },
    { kind: 'privateendpoint', label: 'Private endpoint', icon: 'privateendpoint', blurb: 'Private Link to PaaS services' },
    { kind: 'privatednszone', label: 'Private DNS zone', icon: 'dnszone', blurb: 'Name resolution inside VNets' },
    { kind: 'firewall', label: 'Firewall', icon: 'firewall', blurb: 'Stateful network firewall' },
  ] },
  { category: 'Compute, containers and databases', items: [
    { kind: 'plan', label: 'App Service Plan', icon: 'plan', blurb: 'Compute for App Service apps' },
    { kind: 'acr', label: 'Container Registry', icon: 'acr', blurb: 'Private Docker registry' },
    { kind: 'sql', label: 'SQL server (logical server)', icon: 'sqlserver', blurb: 'Host for Azure SQL databases' },
    { kind: 'cosmos', label: 'Azure Cosmos DB', icon: 'cosmos', blurb: 'Globally distributed NoSQL' },
  ] },
  { category: 'Management, identity and monitoring', items: [
    { kind: 'group', label: 'Resource group', icon: 'group', blurb: 'A container for related resources' },
    { kind: 'workspace', label: 'Log Analytics workspace', icon: 'workspace', blurb: 'Collect and query logs' },
    { kind: 'identity', label: 'User Assigned Managed Identity', icon: 'identity', blurb: 'An identity with no secret' },
  ] },
];
