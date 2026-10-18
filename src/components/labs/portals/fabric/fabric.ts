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
  | 'deploy' | 'admin' | 'create' | 'realtime' | 'workloads';

export interface Route {
  page: Page;
  ws?: string;
  folder?: string;
  item?: string;
  type?: string;
  tab?: string;
  dp?: string;
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
  return ITEM_TYPES[type]?.label || type;
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
