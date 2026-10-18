/**
 * The Microsoft Fabric skin's shared half: routing, the paths the `fab` CLI
 * writes, item-type metadata and the address bar. Plain TypeScript plus one
 * provide/inject key, so every page reads the same view and runs commands the
 * same way without threading props through ten components.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { cli, errorText, pick, rows, type PortalResult } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';

export type Page = 'home' | 'workspaces' | 'workspace' | 'item' | 'monitor' | 'onelake'
  | 'deploy' | 'admin' | 'create' | 'realtime' | 'workloads' | 'workload';

export interface Route {
  page: Page;
  ws?: string;
  folder?: string;
  item?: string;
  type?: string;
  tab?: string;
  dp?: string;
  /** A workload id on the 'workload' page (`WORKLOADS`). */
  wl?: string;
}

export interface FabricCtx {
  view: ComputedRef<Record<string, any>>;
  portal: ComputedRef<Record<string, any>>;
  api: PortalApi;
  route: Ref<Route>;
  go: (route: Route) => void;
  busy: ComputedRef<boolean>;
  /** Run a command; returns the result (the flash is drawn by the shell). */
  run: (command: string, success?: string, options?: { surface?: string; quiet?: boolean })
    => Promise<PortalResult>;
}

export const FABRIC: InjectionKey<FabricCtx> = Symbol('fabric');

export function useFabric(): FabricCtx {
  const ctx = inject(FABRIC);
  if (!ctx) throw new Error('Fabric context missing');
  return ctx;
}

/** `ws-ops-dev.Workspace`. */
export function wsPath(ws: string): string {
  return `${ws}.Workspace`;
}

/** `ws.Workspace/[Folder.Folder/]name.Type`. */
export function itemPath(ws: string, name: string, type: string, folder = ''): string {
  const folders = folder ? folder.split('/').filter(Boolean).map(f => `${f}.Folder`) : [];
  return [wsPath(ws), ...folders, `${name}.${type}`].join('/');
}

export function folderPath(ws: string, folder: string): string {
  return [wsPath(ws), ...folder.split('/').filter(Boolean).map(f => `${f}.Folder`)].join('/');
}

export function tablePath(ws: string, item: string, type: string, schema: string, table: string) {
  return `${itemPath(ws, item, type)}/Tables/${schema || 'dbo'}/${table}`;
}

export interface TypeInfo {
  type: string;
  label: string;
  task: string;
  description: string;
  slug: string;
}

/** Display names, the "Task" column, the URL segment the real portal uses. */
export const ITEM_TYPES: Record<string, TypeInfo> = {
  Lakehouse: { type: 'Lakehouse', label: 'Lakehouse', task: 'Store data',
    description: 'Store big data for cleaning, querying, reporting, and sharing.',
    slug: 'lakehouses' },
  Warehouse: { type: 'Warehouse', label: 'Warehouse', task: 'Store data',
    description: 'Provide strategic insights from multiple sources into your entire business.',
    slug: 'datawarehouses' },
  Notebook: { type: 'Notebook', label: 'Notebook', task: 'Prepare data',
    description: 'Explore, analyze, and visualize data and build machine learning models.',
    slug: 'synapsenotebooks' },
  DataPipeline: { type: 'DataPipeline', label: 'Data pipeline', task: 'Get data',
    description: 'Ingest data at scale and schedule data workflows.',
    slug: 'pipelines' },
  SemanticModel: { type: 'SemanticModel', label: 'Semantic model', task: 'Visualize data',
    description: 'Create a semantic model from your lakehouse tables for reporting.',
    slug: 'datasets' },
  Report: { type: 'Report', label: 'Report', task: 'Visualize data',
    description: 'Create an interactive presentation of your data.',
    slug: 'reports' },
  Environment: { type: 'Environment', label: 'Environment', task: 'Develop data',
    description: 'Set up shared libraries, Spark compute settings and resources for notebooks.',
    slug: 'sparkenvironments' },
  SQLEndpoint: { type: 'SQLEndpoint', label: 'SQL analytics endpoint', task: 'Store data',
    description: 'Query your lakehouse tables with T-SQL.', slug: 'lakewarehouses' },
};

export function typeLabel(type: string): string {
  return ITEM_TYPES[type]?.label || OTHER_TYPES[type]?.label || type;
}

/** The item types this lab can actually create (`fab mkdir`). */
export const CREATABLE = ['Lakehouse', 'Warehouse', 'Notebook', 'DataPipeline', 'SemanticModel',
  'Report', 'Environment'];

/**
 * Item types the real portal offers that this simulated estate does not model.
 * They are SHOWN (the student should recognise the real Create hub) and never
 * offered: their tiles are disabled and say so.
 */
export const OTHER_TYPES: Record<string, { label: string; description: string }> = {
  SparkJobDefinition: { label: 'Spark Job Definition',
    description: 'Define, schedule, and manage your Apache Spark jobs for big data processing.' },
  GraphQLApi: { label: 'API for GraphQL',
    description: 'Connect applications to Fabric data with a flexible GraphQL API.' },
  Dataflow: { label: 'Dataflow Gen2',
    description: 'Prep, clean, and transform data with a low-code Power Query experience.' },
  CopyJob: { label: 'Copy job',
    description: 'Copy data from many sources to many destinations, incrementally or in bulk.' },
  Airflow: { label: 'Apache Airflow job',
    description: 'Orchestrate data workflows with Python-authored Apache Airflow DAGs.' },
  MLModel: { label: 'ML model',
    description: 'Use machine learning models to predict outcomes and detect anomalies in data.' },
  Experiment: { label: 'Experiment',
    description: 'Create, run, and track the development of multiple models.' },
  SampleWarehouse: { label: 'Sample warehouse',
    description: 'Start a new warehouse with sample data already loaded.' },
  MirroredDatabase: { label: 'Mirrored database',
    description: 'Replicate an external database into OneLake in near real time.' },
  SQLDatabase: { label: 'SQL database',
    description: 'Build modern cloud applications on a developer-friendly transactional database.' },
  CosmosDB: { label: 'Cosmos DB',
    description: 'A NoSQL database for AI applications, with automatic OneLake replication.' },
  Dashboard: { label: 'Dashboard',
    description: 'Build a single-page, data-driven story with tiles from your reports.' },
  PaginatedReport: { label: 'Paginated report',
    description: 'Display tabular data in a pixel-perfect report that prints well.' },
  Eventhouse: { label: 'Eventhouse',
    description: 'Store and analyze high volumes of streaming and time-series data.' },
  Eventstream: { label: 'Eventstream',
    description: 'Capture, transform, and route real-time event streams without code.' },
  KQLQueryset: { label: 'KQL Queryset',
    description: 'Run Kusto queries over your event data and share the results.' },
  RTDashboard: { label: 'Real-Time Dashboard',
    description: 'Visualize streaming data with tiles that refresh in near real time.' },
  Activator: { label: 'Activator',
    description: 'Monitor data and trigger actions automatically when patterns are detected.' },
  Healthcare: { label: 'Healthcare data solutions',
    description: 'Unify and analyze clinical and imaging data on a standards-based model.' },
  Retail: { label: 'Retail data solutions',
    description: 'Bring together retail sales, inventory, and customer data.' },
  Sustainability: { label: 'Sustainability data solutions',
    description: 'Track and report environmental, social, and governance data.' },
};

export interface Workload {
  id: string;
  name: string;
  /** The FxIcon name of the workload's tile. */
  icon: string;
  /** The workload's colour (text on white) and its soft tint (backgrounds). */
  color: string;
  tint: string;
  description: string;
  /** Item types it creates. */
  types: string[];
  /** Destinations in this portal that help a student get going. */
  start: { title: string; text: string; icon: string; to: Route }[];
}

/** The Fabric workloads, in the order the Workload hub and the Create hub list them. */
export const WORKLOADS: Workload[] = [
  { id: 'data-engineering', name: 'Data Engineering', icon: 'wl-dataeng', color: '#0e6e5c', tint: '#e3f3ef',
    description: 'Create a lakehouse and operationalize your workflow to build, transform, and share your data estate with Apache Spark.',
    types: ['Lakehouse', 'Notebook', 'Environment', 'SparkJobDefinition', 'GraphQLApi'],
    start: [
      { title: 'Browse your data', icon: 'onelake', text: 'Find lakehouses and tables across workspaces in the OneLake catalog.', to: { page: 'onelake' } },
      { title: 'Track Spark runs', icon: 'monitor', text: 'Follow notebook sessions and their status in the Monitor hub.', to: { page: 'monitor' } },
    ] },
  { id: 'data-factory', name: 'Data Factory', icon: 'wl-factory', color: '#0f6cbd', tint: '#e5f0fb',
    description: 'Ingest, prepare, and transform data from a rich set of data sources, and orchestrate it all with data pipelines.',
    types: ['DataPipeline', 'Dataflow', 'CopyJob', 'Airflow', 'MirroredDatabase'],
    start: [
      { title: 'Watch pipeline runs', icon: 'monitor', text: 'Every pipeline run, its activities and their duration appear in the Monitor hub.', to: { page: 'monitor' } },
      { title: 'Promote pipelines', icon: 'deploy', text: 'Move pipelines from development to test and production with deployment pipelines.', to: { page: 'deploy' } },
    ] },
  { id: 'data-science', name: 'Data Science', icon: 'wl-science', color: '#6b47b8', tint: '#efebf8',
    description: 'Detect trends, identify outliers, and predict values using machine learning models and experiments on your lakehouse data.',
    types: ['Notebook', 'Environment', 'MLModel', 'Experiment'],
    start: [
      { title: 'Find training data', icon: 'onelake', text: 'Lakehouse tables are the input to every notebook and model.', to: { page: 'onelake' } },
      { title: 'Monitor sessions', icon: 'monitor', text: 'Notebook runs and their output show up in the Monitor hub.', to: { page: 'monitor' } },
    ] },
  { id: 'data-warehouse', name: 'Data Warehouse', icon: 'wl-warehouse', color: '#1f5fc4', tint: '#e6eefa',
    description: 'Provide strategic insights from multiple sources into your entire business with a lake-centric, fully transactional SQL warehouse.',
    types: ['Warehouse', 'SampleWarehouse', 'MirroredDatabase'],
    start: [
      { title: 'Explore warehouses', icon: 'onelake', text: 'See every warehouse and SQL analytics endpoint in the OneLake catalog.', to: { page: 'onelake' } },
      { title: 'Check the capacity', icon: 'admin', text: 'Warehouses run on your Fabric capacity - check its state in the Admin portal.', to: { page: 'admin', tab: 'capacities' } },
    ] },
  { id: 'databases', name: 'Databases', icon: 'wl-databases', color: '#00677f', tint: '#e2f0f3',
    description: 'Build operational applications on SQL database in Fabric, or mirror an external database into OneLake for analytics.',
    types: ['SQLDatabase', 'MirroredDatabase', 'CosmosDB'],
    start: [
      { title: 'See what is in OneLake', icon: 'onelake', text: 'Mirrored data lands in OneLake next to your lakehouses and warehouses.', to: { page: 'onelake' } },
    ] },
  { id: 'power-bi', name: 'Power BI', icon: 'wl-powerbi', color: '#8a5a00', tint: '#fdf4dc',
    description: 'Find insights, track progress, and make decisions faster using semantic models, rich visualizations and reports.',
    types: ['SemanticModel', 'Report', 'Dashboard', 'PaginatedReport'],
    start: [
      { title: 'Find semantic models', icon: 'onelake', text: 'Browse the models you can build reports on in the OneLake catalog.', to: { page: 'onelake' } },
      { title: 'Track refreshes', icon: 'monitor', text: 'Semantic model refreshes and their outcome appear in the Monitor hub.', to: { page: 'monitor' } },
    ] },
  { id: 'real-time-intelligence', name: 'Real-Time Intelligence', icon: 'wl-realtime', color: '#b4247c', tint: '#fbe9f3',
    description: 'Discover insights from your streaming data: ingest events, store them in an eventhouse, query them with KQL, and act on patterns as they happen.',
    types: ['Eventhouse', 'Eventstream', 'KQLQueryset', 'RTDashboard', 'Activator'],
    start: [
      { title: 'Open the Real-Time hub', icon: 'realtime', text: 'See the data streams available across your organization.', to: { page: 'realtime' } },
    ] },
  { id: 'industry-solutions', name: 'Industry solutions', icon: 'wl-industry', color: '#4f5b6b', tint: '#eef0f3',
    description: 'Accelerate analytics with prebuilt, industry-specific data models, pipelines and reports for healthcare, retail and sustainability.',
    types: ['Healthcare', 'Retail', 'Sustainability'],
    start: [
      { title: 'Start from your workspaces', icon: 'workspaces', text: 'Industry solutions deploy into a workspace like any other item.', to: { page: 'workspaces' } },
    ] },
];

export function workloadById(id: string | undefined): Workload | undefined {
  return WORKLOADS.find(w => w.id === id);
}

/** Label and description for any type, modelled or not, and whether this lab can create it. */
export function typeInfo(type: string): { label: string; description: string; available: boolean } {
  const known = ITEM_TYPES[type];
  if (known) return { label: known.label, description: known.description, available: CREATABLE.includes(type) };
  const other = OTHER_TYPES[type];
  return { label: other?.label || type, description: other?.description || '', available: false };
}

/** How many of a workload's item types this lab can create. */
export function availableCount(w: Workload): number {
  return w.types.filter(t => CREATABLE.includes(t)).length;
}


const BASE = 'https://app.fabric.microsoft.com';
const EXP = '?experience=fabric-developer';

export function fakeId(seed: string): string {
  // A stable GUID-looking id for things the view has no id for.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const a = hex(h); const b = hex(Math.imul(h, 31) ^ 0x5bd1e995); const c = hex(h ^ 0x9e3779b9);
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-a${c.slice(1, 4)}-${c}${a.slice(0, 4)}`;
}

export function locationFor(route: Route, portal: Record<string, any>): string {
  const ws = rows(portal, 'workspaces').find(w => w.name === route.ws);
  const wsId = ws?.id || fakeId('ws:' + (route.ws || ''));
  switch (route.page) {
    case 'home': return `${BASE}/home${EXP}`;
    case 'workspaces': return `${BASE}/groups${EXP}`;
    case 'workspace': {
      const folder = route.folder ? `&folderId=${fakeId('f:' + route.folder)}` : '';
      return `${BASE}/groups/${wsId}/list${EXP}${folder}`;
    }
    case 'item': {
      const item = rows(portal, 'items').find(i => i.name === route.item && i.type === route.type
        && i.workspace === route.ws);
      const slug = ITEM_TYPES[route.type || '']?.slug || 'items';
      const id = item?.id || fakeId('item:' + route.item);
      const tail = route.type === 'SemanticModel' ? (route.tab === 'dax' ? '/dax' : '/modeling') : '';
      return `${BASE}/groups/${wsId}/${slug}/${id}${tail}${EXP}`;
    }
    case 'monitor': return `${BASE}/monitoringhub${EXP}`;
    case 'onelake': return `${BASE}/onelake/explore${EXP}`;
    case 'deploy': return route.dp
      ? `${BASE}/groups/me/deploymentpipelines/${fakeId('dp:' + route.dp)}${EXP}`
      : `${BASE}/groups/me/deploymentpipelines${EXP}`;
    case 'admin': return `${BASE}/admin-portal/${route.tab || 'capacities'}${EXP}`;
    case 'create': return `${BASE}/create${EXP}`;
    case 'realtime': return `${BASE}/realtimehub${EXP}`;
    case 'workloads': return `${BASE}/workloadhub${EXP}`;
    case 'workload': return `${BASE}/workloadhub/detail/${route.wl || ''}${EXP}`;
    default: return `${BASE}/home${EXP}`;
  }
}

export { cli, errorText, pick, rows };

/** Initials for an avatar: "data.engineer@acmepay.com" -> "DE". */
export function initials(name: string): string {
  const base = String(name || '').split('@')[0];
  const parts = base.split(/[.\s_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

/** "data.engineer@acmepay.com" -> "Data Engineer". */
export function displayName(principal: string, principals: Record<string, any>[] = []): string {
  const found = principals.find(p => p.name === principal);
  if (found?.display) return String(found.display).replace(/\s*\(.*\)$/, '');
  const base = String(principal || '').split('@')[0];
  return base.split(/[.\s_]+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
}

export function avatarColor(seed: string): string {
  const palette = ['#0f6cbd', '#117865', '#8764b8', '#c239b3', '#ca5010', '#00727c', '#4f6bed',
    '#986f0b', '#b4009e', '#038387'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export interface Grid { columns: string[]; rows: unknown[][]; total: number }

/** The result grids the engine returned beside the text (`result.data.grids`). */
export function gridsOf(result: PortalResult | null | undefined): Grid[] {
  const data = result?.data as any;
  return Array.isArray(data?.grids) ? data.grids.filter((g: any) => g && Array.isArray(g.columns)) : [];
}

/** The text a SQL/DAX/notebook run printed, without its grids (messages). */
export function messagesOf(result: PortalResult | null | undefined): string[] {
  const text = String(result?.output || '');
  return text.split('\n').filter(line => line && !/^[+|]/.test(line)
    && !/^\d+ rows?$/.test(line) && !/^only showing top/.test(line));
}
