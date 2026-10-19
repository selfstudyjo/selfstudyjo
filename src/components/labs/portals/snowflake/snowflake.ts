/**
 * Snowsight's model: the view slice the pages read, the routes and their URLs,
 * the SQL the dialogs build, and the formatters the product uses.
 *
 * PLAIN on purpose - no Vue, no DOM. Every write the portal makes is a
 * Snowflake SQL statement run on the `sf_sql` surface (the same Worksheet the
 * lab's query tool is), so the place a typed value becomes part of a statement
 * is here: `ident()` and `str()`. A name with a space or a quote in it, or a
 * comment with an apostrophe, would otherwise arrive as a different statement
 * than the one the dialog showed.
 */
import { pick, rows } from '@/utils/portalKit';

export const SURFACE = 'sf_sql';

/* ---------------------------------------------------------------- the view */

export interface SfCurrent { role: string; warehouse: string; database: string; schema: string }
export interface SfDatabase { name: string; owner?: string; retention_days?: number; created?: string | number; comment?: string; dropped?: boolean; transient?: boolean; clone_of?: string | null }
export interface SfSchema { database: string; name: string; managed_access?: boolean; owner?: string; dropped?: boolean }
export interface SfColumn { name: string; type: string; nullable?: boolean; masking_policy?: string; comment?: string }
export interface SfTable {
    database: string; schema: string; name: string; fqn: string; kind?: string;
    rows?: number; bytes?: number; columns?: SfColumn[]; clustering_key?: string | null;
    micro_partitions?: number; clustering_depth?: number | null; retention_days?: number;
    change_tracking?: boolean; owner?: string; created?: string | number; dropped?: boolean; secure?: boolean; versions?: number;
    definition?: string; comment?: string; row_access_policy?: string; clone_of?: string;
}
export interface SfWarehouse {
    name: string; size: string; size_label?: string; state: string; auto_suspend?: number | null; auto_resume?: boolean;
    min_clusters?: number; max_clusters?: number; scaling_policy?: string; credits_used?: number;
    resource_monitor?: string | null; owner?: string; comment?: string; type?: string;
    running?: number; queued?: number;
}
export interface SfRole { name: string; granted_to?: string[]; granted_to_roles?: string[]; granted_to_users?: string[]; owner?: string; comment?: string; kind?: string }
export interface SfUser { name: string; default_role?: string; default_warehouse?: string; disabled?: boolean; email?: string; login_name?: string; display_name?: string }
export interface SfGrant { privilege: string; on: string; name: string; to: string; granted_to?: string; grant_option?: boolean }
export interface SfStage { name: string; fqn: string; url?: string; file_format?: unknown; type?: string; comment?: string; owner?: string }
export interface SfFileFormat { name: string; fqn?: string; type: string; options?: Record<string, unknown> }
export interface SfPipe { name: string; fqn: string; table?: string; stage?: string; auto_ingest?: boolean; files_loaded?: number; definition?: string }
export interface SfStream { name: string; fqn: string; table?: string; mode?: string; stale?: boolean; rows_pending?: number }
export interface SfTask { name: string; fqn: string; schedule?: string; state?: string; warehouse?: string; last_run?: string | number | null; last_state?: string; definition?: string; runs?: number }
export interface SfPolicy { name: string; fqn: string; signature?: string; attached?: string[]; body?: string; returns?: string }
export interface SfMonitor { name: string; credit_quota?: number; used?: number; triggers?: unknown; warehouses?: string[]; frequency?: string; level?: string }
export interface SfQuery {
    query_id: string; text: string; status: string; error?: string; role?: string; warehouse?: string;
    rows?: number; bytes_scanned?: number; partitions_scanned?: number; partitions_total?: number;
    elapsed_ms?: number; credits?: number; from_cache?: boolean; at?: number; time?: string;
    database?: string; schema?: string; user?: string; type?: string; spill_local?: number; spill_remote?: number; via?: string; warehouse_size?: string;
}
export interface SfLoad { table: string; file: string; status: string; rows_loaded?: number; rows_parsed?: number; errors?: number; first_error?: string; at?: number; pipe?: string }

export function current(view: unknown): SfCurrent {
    const cur = pick<Record<string, any>>(view, 'warehouse.current', {});
    return {
        role: String(cur.role || ''), warehouse: String(cur.warehouse || ''),
        database: String(cur.database || ''), schema: String(cur.schema || ''),
    };
}

export const list = {
    databases: (v: unknown) => rows<SfDatabase>(v, 'warehouse.databases'),
    schemas: (v: unknown) => rows<SfSchema>(v, 'warehouse.schemas'),
    tables: (v: unknown) => rows<SfTable>(v, 'warehouse.tables'),
    warehouses: (v: unknown) => rows<SfWarehouse>(v, 'warehouse.warehouses'),
    roles: (v: unknown) => rows<SfRole>(v, 'warehouse.roles'),
    users: (v: unknown) => rows<SfUser>(v, 'warehouse.users'),
    grants: (v: unknown) => rows<SfGrant>(v, 'warehouse.grants'),
    stages: (v: unknown) => rows<SfStage>(v, 'warehouse.stages'),
    fileFormats: (v: unknown) => rows<SfFileFormat>(v, 'warehouse.file_formats'),
    pipes: (v: unknown) => rows<SfPipe>(v, 'warehouse.pipes'),
    streams: (v: unknown) => rows<SfStream>(v, 'warehouse.streams'),
    tasks: (v: unknown) => rows<SfTask>(v, 'warehouse.tasks'),
    masking: (v: unknown) => rows<SfPolicy>(v, 'warehouse.masking_policies'),
    rowAccess: (v: unknown) => rows<SfPolicy>(v, 'warehouse.row_access_policies'),
    monitors: (v: unknown) => rows<SfMonitor>(v, 'warehouse.resource_monitors'),
    queries: (v: unknown) => rows<SfQuery>(v, 'warehouse.query_history'),
    loads: (v: unknown) => rows<SfLoad>(v, 'warehouse.load_history'),
};

/** The schema part of an object's fqn: `RAW.SHOP.ORDERS` -> `RAW.SHOP`. */
export function schemaOf(fqn: string): string {
    const parts = splitFqn(fqn);
    return parts.slice(0, 2).join('.');
}
export function splitFqn(fqn: string): string[] {
    return String(fqn || '').split('.').filter(Boolean);
}
export function leaf(fqn: string): string {
    const parts = splitFqn(fqn);
    return parts[parts.length - 1] || '';
}
/** Objects whose fqn is in `DB.SCHEMA`. */
export function inSchema<T extends { fqn?: string; database?: string; schema?: string }>(items: T[], db: string, schema: string): T[] {
    const prefix = (db + '.' + schema + '.').toUpperCase();
    return items.filter(item => {
        if (item.database && item.schema) {
            return item.database.toUpperCase() === db.toUpperCase() && item.schema.toUpperCase() === schema.toUpperCase();
        }
        return String(item.fqn || '').toUpperCase().startsWith(prefix);
    });
}

/* ------------------------------------------------------------- SQL pieces */

const PLAIN_IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;

/**
 * One identifier as Snowflake reads it. A plain name is written UNQUOTED so it
 * folds to upper case exactly as a hand-typed one does (quoting `orders` would
 * create a lower-case table nobody can SELECT without quotes); anything else
 * is double-quoted with `"` doubled.
 */
export function ident(name: string): string {
    const text = String(name ?? '').trim();
    if (PLAIN_IDENT.test(text)) return text.toUpperCase();
    return '"' + text.replace(/"/g, '""') + '"';
}
/** A dotted name, each part identified separately. */
export function fqnSql(fqn: string): string {
    return splitFqn(fqn).map(part => (part.startsWith('"') ? part : ident(part))).join('.');
}
/** A string literal. */
export function str(value: string): string {
    return "'" + String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}
export function isPlainIdent(name: string): boolean {
    return PLAIN_IDENT.test(String(name || '').trim());
}

export const SIZES: [string, string, number][] = [
    ['XSMALL', 'X-Small', 1], ['SMALL', 'Small', 2], ['MEDIUM', 'Medium', 4],
    ['LARGE', 'Large', 8], ['XLARGE', 'X-Large', 16], ['XXLARGE', '2X-Large', 32],
    ['XXXLARGE', '3X-Large', 64], ['X4LARGE', '4X-Large', 128],
];
export function sizeLabel(size: string): string {
    const key = String(size || '').toUpperCase().replace(/-/g, '');
    const hit = SIZES.find(([id, label]) => id === key || label.toUpperCase().replace(/-/g, '') === key);
    return hit ? hit[1] : String(size || '');
}
export function sizeId(size: string): string {
    const key = String(size || '').toUpperCase().replace(/-/g, '');
    const hit = SIZES.find(([id, label]) => id === key || label.toUpperCase().replace(/-/g, '') === key);
    return hit ? hit[0] : key;
}
export function sizeCredits(size: string): number {
    const id = sizeId(size);
    return SIZES.find(([key]) => key === id)?.[2] ?? 1;
}

export const PRIVILEGES: Record<string, string[]> = {
    ACCOUNT: ['CREATE DATABASE', 'CREATE WAREHOUSE', 'CREATE ROLE', 'CREATE USER', 'EXECUTE TASK', 'MANAGE GRANTS', 'APPLY MASKING POLICY', 'APPLY ROW ACCESS POLICY', 'MONITOR USAGE'],
    DATABASE: ['USAGE', 'CREATE SCHEMA', 'MONITOR', 'OWNERSHIP'],
    SCHEMA: ['USAGE', 'CREATE TABLE', 'CREATE VIEW', 'CREATE STAGE', 'CREATE FILE FORMAT', 'CREATE PIPE', 'CREATE STREAM', 'CREATE TASK', 'CREATE MASKING POLICY', 'MONITOR', 'OWNERSHIP'],
    TABLE: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'OWNERSHIP'],
    VIEW: ['SELECT', 'REFERENCES', 'OWNERSHIP'],
    WAREHOUSE: ['USAGE', 'OPERATE', 'MONITOR', 'MODIFY', 'OWNERSHIP'],
    STAGE: ['USAGE', 'READ', 'WRITE'],
};

/* ---------------------------------------------------------------- routes */

export type SfRoute =
    | { page: 'home' }
    | { page: 'worksheets' }
    | { page: 'worksheet'; id: number }
    | { page: 'databases'; db?: string; schema?: string; kind?: string; object?: string; tab?: string }
    | { page: 'query-history'; queryId?: string; tab?: string }
    | { page: 'copy-history' }
    | { page: 'task-history' }
    | { page: 'governance'; tab?: string }
    | { page: 'warehouses'; name?: string }
    | { page: 'cost'; tab?: string }
    | { page: 'users-roles'; tab?: string; name?: string };

export const ORG = 'shopflow';
export const ACCOUNT_LOCATOR = 'xy12345';
const BASE = `https://app.snowflake.com/eu-west-1/${ORG}-${ACCOUNT_LOCATOR}/#`;

export function routeUrl(route: SfRoute): string {
    const enc = encodeURIComponent;
    switch (route.page) {
        case 'home': return BASE + '/homepage';
        case 'worksheets': return BASE + '/worksheets';
        case 'worksheet': return BASE + `/worksheets/w${1000 + route.id}`;
        case 'databases': {
            let url = BASE + '/data/databases';
            if (route.db) url += '/' + enc(route.db);
            if (route.db && route.schema) url += '/schemas/' + enc(route.schema);
            if (route.schema && route.kind && route.object) url += '/' + route.kind + '/' + enc(route.object);
            return url;
        }
        case 'query-history':
            return route.queryId ? BASE + `/compute/history/queries/${enc(route.queryId)}/${route.tab === 'profile' ? 'profile' : 'detail'}`
                : BASE + '/compute/history/queries';
        case 'copy-history': return BASE + '/compute/history/copies';
        case 'task-history': return BASE + '/compute/history/tasks';
        case 'governance': return BASE + '/data/governance' + (route.tab ? '/' + route.tab : '');
        case 'warehouses': return BASE + '/compute/warehouses' + (route.name ? '/' + enc(route.name) : '');
        case 'cost': return BASE + '/account/usage' + (route.tab ? '/' + route.tab : '');
        case 'users-roles': return BASE + '/admin/' + (route.tab === 'roles' ? 'roles' : route.tab === 'grants' ? 'roles/grants' : 'users') + (route.name ? '/' + enc(route.name) : '');
    }
    return BASE + '/homepage';
}

/* ------------------------------------------------------------- formatting */

export function fmtBytes(value: unknown): string {
    const n = Number(value);
    if (!isFinite(n) || n <= 0) return n === 0 ? '0 B' : '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = n;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return (size >= 100 || i === 0 ? size.toFixed(0) : size.toFixed(1)) + ' ' + units[i];
}
export function fmtNum(value: unknown): string {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !isFinite(n)) return '—';
    return n.toLocaleString('en-US');
}
export function fmtMs(value: unknown): string {
    const n = Number(value);
    if (value === null || value === undefined || !isFinite(n)) return '—';
    if (n < 1000) return Math.round(n) + 'ms';
    if (n < 60000) return (n / 1000).toFixed(n < 10000 ? 1 : 0) + 's';
    const m = Math.floor(n / 60000);
    return m + 'm ' + Math.round((n % 60000) / 1000) + 's';
}
export function fmtCredits(value: unknown): string {
    const n = Number(value);
    if (!isFinite(n)) return '—';
    if (n === 0) return '0';
    return n < 0.01 ? n.toFixed(4) : n < 10 ? n.toFixed(3) : n.toFixed(1);
}
export function fmtSuspend(seconds: unknown): string {
    const n = Number(seconds);
    if (seconds === null || seconds === undefined || !isFinite(n) || n <= 0) return 'Never';
    if (n < 60) return n + ' seconds';
    if (n % 3600 === 0) return (n / 3600) + (n === 3600 ? ' hour' : ' hours');
    if (n % 60 === 0) return (n / 60) + (n === 60 ? ' minute' : ' minutes');
    return n + ' seconds';
}
/** The lab's simulated clock: a minute count from the platform epoch (Mon 02 Nov 2026 06:00). */
const EPOCH_MS = Date.UTC(2026, 10, 2, 6, 0, 0);
export function fmtMinute(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string' && !/^\d+$/.test(value)) return value;
    const n = Number(value);
    if (!isFinite(n)) return String(value);
    const d = new Date(EPOCH_MS + n * 60000);
    const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    return `${day}, ${time}`;
}
/** A stage's file format, which the engine sends as an options object. */
export function formatText(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        const o = value as Record<string, unknown>;
        if (o.FORMAT_NAME || o.format_name) return String(o.FORMAT_NAME || o.format_name);
        const parts = Object.entries(o).map(([k, v]) => `${k} = ${v}`);
        return parts.length ? parts.join(', ') : '';
    }
    return String(value);
}
/** `LINEAR(A, B)` (SHOW TABLES' spelling) -> `A, B`. */
export function clusterColumns(key: unknown): string {
    const text = String(key || '').trim();
    const m = text.match(/^LINEAR\s*\((.*)\)$/i);
    return (m ? m[1] : text).replace(/^\(|\)$/g, '').trim();
}
export function statusTone(status: string): 'ok' | 'bad' | 'run' | 'muted' {
    const s = String(status || '').toUpperCase();
    if (/FAIL|ERROR|ABORT|CANCEL|REFUS|DENIED/.test(s)) return 'bad';
    if (/RUN|QUEUE|EXECUT|SCHEDUL|PARTIAL/.test(s)) return 'run';
    if (/SUCCE|LOADED|OK|COMPLET|STARTED/.test(s)) return 'ok';
    return 'muted';
}
export function initials(name: string): string {
    const parts = String(name || '').split(/[_\s.]+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

/* ------------------------------------------------------------- results */

export interface SfGrid { columns: string[]; rows: unknown[][]; total: number; title?: string }

export function gridsOf(data: unknown): SfGrid[] {
    const list = pick<unknown[]>(data, 'grids', []);
    return list.filter(g => g && typeof g === 'object').map((g: any) => ({
        columns: Array.isArray(g.columns) ? g.columns.map(String) : [],
        rows: Array.isArray(g.rows) ? g.rows.filter(Array.isArray) : [],
        total: Number(g.total ?? (Array.isArray(g.rows) ? g.rows.length : 0)),
        title: g.title ? String(g.title) : undefined,
    }));
}

export interface ColumnStats {
    name: string; kind: 'number' | 'text' | 'date' | 'bool' | 'empty';
    nulls: number; distinct: number; count: number;
    min?: string; max?: string; mean?: number;
    histogram: number[]; top: [string, number][];
}

/** Snowsight's column stats sidebar, computed over the rows on screen. */
export function columnStats(grid: SfGrid, index: number): ColumnStats {
    const values = grid.rows.map(r => r[index]);
    const present = values.filter(v => v !== null && v !== undefined && v !== '');
    const stats: ColumnStats = {
        name: grid.columns[index] || '', kind: 'empty', nulls: values.length - present.length,
        distinct: new Set(present.map(v => String(v))).size, count: values.length, histogram: [], top: [],
    };
    if (!present.length) return stats;
    const numbers = present.map(v => (typeof v === 'number' ? v : Number(v)));
    if (numbers.every(n => isFinite(n)) && present.every(v => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)))) {
        stats.kind = 'number';
        const lo = Math.min(...numbers);
        const hi = Math.max(...numbers);
        stats.min = fmtStat(lo); stats.max = fmtStat(hi);
        stats.mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const bins = new Array(12).fill(0);
        for (const n of numbers) bins[hi === lo ? 0 : Math.min(11, Math.floor(((n - lo) / (hi - lo)) * 12))] += 1;
        stats.histogram = bins;
        return stats;
    }
    if (present.every(v => typeof v === 'boolean' || /^(true|false)$/i.test(String(v)))) stats.kind = 'bool';
    else if (present.every(v => /^\d{4}-\d{2}-\d{2}/.test(String(v)))) {
        stats.kind = 'date';
        const sorted = present.map(String).sort();
        stats.min = sorted[0]; stats.max = sorted[sorted.length - 1];
    } else stats.kind = 'text';
    const counts = new Map<string, number>();
    for (const v of present) counts.set(String(v), (counts.get(String(v)) || 0) + 1);
    stats.top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    return stats;
}
function fmtStat(n: number): string {
    return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(2);
}

/* ---------------------------------------------------------- query profile */

export interface ProfileNode {
    id: string; type: string; label: string; percent: number; rows: number | null;
    inputs: string[]; attrs: [string, string][];
}
export interface Profile {
    queryId: string; totalMs: number | null; nodes: ProfileNode[]; stats: [string, string, string][];
    partitionsScanned: number | null; partitionsTotal: number | null; bytesScanned: number | null;
    spilledLocal: number | null; spilledRemote: number | null; cachePercent: number | null;
    fromResultCache: boolean; warehouse: string; credits: number | null; raw: Record<string, any>;
}

const STAT_LABELS: Record<string, [string, string]> = {
    partitions_scanned: ['Pruning', 'Partitions scanned'],
    partitions_total: ['Pruning', 'Partitions total'],
    bytes_scanned: ['IO', 'Bytes scanned'],
    percent_scanned_from_cache: ['IO', 'Percentage scanned from cache'],
    bytes_written: ['IO', 'Bytes written'],
    bytes_spilled_local: ['Spilling', 'Bytes spilled to local storage'],
    bytes_spilled_remote: ['Spilling', 'Bytes spilled to remote storage'],
    rows_produced: ['DML', 'Number of rows produced'],
    rows_inserted: ['DML', 'Number of rows inserted'],
    rows_updated: ['DML', 'Number of rows updated'],
    rows_deleted: ['DML', 'Number of rows deleted'],
};

function num(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return isFinite(n) ? n : null;
}

/**
 * The engine's profile, read tolerantly. A replica a release behind may name a
 * field differently or not send one, and a profile tab that crashed would take
 * the whole worksheet with it - so every field is optional here.
 */
export function readProfile(raw: unknown, fallback: Partial<SfQuery> = {}): Profile | null {
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Record<string, any>;
    const stats = (p.statistics || p.stats || {}) as Record<string, any>;
    const field = (...keys: string[]) => {
        for (const key of keys) {
            if (p[key] !== undefined && p[key] !== null) return p[key];
            if (stats[key] !== undefined && stats[key] !== null) return stats[key];
        }
        return undefined;
    };
    const list: any[] = Array.isArray(p.operators) ? p.operators : Array.isArray(p.nodes) ? p.nodes : Array.isArray(p.steps) ? p.steps : [];
    const KNOWN = new Set(['id', 'operator_id', 'type', 'operator', 'operator_type', 'name', 'inputs', 'children',
        'input', 'attributes', 'attrs', 'details', 'label', 'title', 'percent', 'pct', 'time_percent', 'percentage',
        'rows', 'output_rows', 'rows_out']);
    const nodes: ProfileNode[] = list.filter(n => n && typeof n === 'object').map((n, i) => {
        const id = String(n.id ?? n.operator_id ?? i);
        const type = String(n.type || n.operator || n.operator_type || n.name || 'Operator');
        const inputs = (n.inputs || n.children || n.input || []) as unknown;
        const attrSource: Record<string, unknown> = { ...(n.attributes || n.attrs || n.details || {}) };
        // Operator fields the engine sends flat (table, alias, partitions...) are attributes too.
        for (const [key, value] of Object.entries(n)) if (!KNOWN.has(key)) attrSource[key] = value;
        const attrs: [string, string][] = Object.entries(attrSource)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => [prettyKey(k), Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)]);
        return {
            id, type,
            label: String(n.label || n.title || type),
            percent: num(n.percent ?? n.pct ?? n.time_percent ?? n.percentage) ?? -1,
            rows: num(n.rows ?? n.output_rows ?? n.rows_out),
            inputs: Array.isArray(inputs) ? inputs.map(String) : inputs !== undefined && inputs !== null && inputs !== '' ? [String(inputs)] : [],
            attrs,
        };
    });
    chainOperators(nodes);
    estimatePercent(nodes);
    const statRows: [string, string, string][] = [];
    for (const [key, value] of Object.entries(stats)) {
        if (value === null || value === undefined || typeof value === 'object') continue;
        const known = STAT_LABELS[key];
        const label = known ? known[1] : prettyKey(key);
        const shown = /bytes/.test(key) ? fmtBytes(value) : /percent/.test(key) ? `${Number(value).toFixed(2)}%` : typeof value === 'number' ? fmtNum(value) : String(value);
        statRows.push([known ? known[0] : 'Statistics', label, shown]);
    }
    const parts = (p.partitions || {}) as Record<string, any>;
    const spill = (p.spill || {}) as Record<string, any>;
    const scans = nodes.filter(n => /scan/i.test(n.type));
    const sumAttr = (key: string) => {
        let total: number | null = null;
        for (const n of scans) {
            const raw2 = list.find(o => String(o?.id ?? '') === n.id)?.[key];
            const v = num(raw2);
            if (v !== null) total = (total || 0) + v;
        }
        return total;
    };
    return {
        queryId: String(p.query_id || fallback.query_id || ''),
        totalMs: num(field('total_ms', 'elapsed_ms', 'duration_ms', 'elapsed')) ?? num(fallback.elapsed_ms),
        nodes,
        stats: statRows,
        partitionsScanned: num(parts.scanned) ?? num(field('partitions_scanned')) ?? sumAttr('partitions_scanned') ?? num(fallback.partitions_scanned),
        partitionsTotal: num(parts.total) ?? num(field('partitions_total')) ?? sumAttr('partitions_total') ?? num(fallback.partitions_total),
        bytesScanned: num(field('bytes_scanned', 'bytes')) ?? num(fallback.bytes_scanned),
        spilledLocal: num(spill.local) ?? num(field('bytes_spilled_local', 'spilled_local', 'spill_local_bytes')),
        spilledRemote: num(spill.remote) ?? num(field('bytes_spilled_remote', 'spilled_remote', 'spill_remote_bytes')),
        cachePercent: num(field('percent_scanned_from_cache', 'cache_percent', 'cache_hit_percent')),
        fromResultCache: Boolean(field('from_cache', 'result_cache', 'reused_result') ?? fallback.from_cache),
        warehouse: String(field('warehouse') || fallback.warehouse || ''),
        credits: num(field('credits')) ?? num(fallback.credits),
        raw: p,
    };
}

function prettyKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

/**
 * The engine lists operators bottom-up (scans first, Result last) without
 * edges. Snowsight draws a tree: each operator consumes the one before it,
 * and the scans all feed the first non-scan operator (the join, when there is
 * one). Only applied when no operator names its inputs.
 */
function chainOperators(nodes: ProfileNode[]) {
    if (!nodes.length || nodes.some(n => n.inputs.length)) return;
    const scans = nodes.filter(n => /scan/i.test(n.type));
    const rest = nodes.filter(n => !/scan/i.test(n.type));
    if (!rest.length) return;
    rest[0].inputs = scans.map(s => s.id);
    for (let i = 1; i < rest.length; i++) rest[i].inputs = [rest[i - 1].id];
}

/**
 * Where an operator did not report its share of the time, estimate it the way
 * the engine models time: scanning dominates and is proportional to the
 * partitions read; joins and aggregates cost something; the rest is noise.
 */
function estimatePercent(nodes: ProfileNode[]) {
    if (!nodes.length || nodes.every(n => n.percent >= 0)) {
        nodes.forEach(n => { if (n.percent < 0) n.percent = 0; });
        return;
    }
    const weight = (n: ProfileNode) => {
        if (/scan/i.test(n.type)) {
            const parts = Number(n.attrs.find(([k]) => k === 'Partitions scanned')?.[1]);
            return 8 + (isFinite(parts) ? parts * 6 : (n.rows || 0) / 200);
        }
        if (/join/i.test(n.type)) return 10;
        if (/aggregate|window|sort/i.test(n.type)) return 6;
        if (/filter/i.test(n.type)) return 2;
        return 0.6;
    };
    const total = nodes.reduce((sum, n) => sum + weight(n), 0) || 1;
    for (const n of nodes) n.percent = Math.round((weight(n) / total) * 1000) / 10;
}

/** Lay the operator tree out in rows: the root (no consumer) on top. */
export function layoutProfile(nodes: ProfileNode[]): ProfileNode[][] {
    if (!nodes.length) return [];
    const byId = new Map(nodes.map(n => [n.id, n]));
    const consumed = new Set<string>();
    for (const n of nodes) for (const input of n.inputs) consumed.add(input);
    const roots = nodes.filter(n => !consumed.has(n.id));
    const levels: ProfileNode[][] = [];
    const seen = new Set<string>();
    let frontier = roots.length ? roots : [nodes[0]];
    while (frontier.length && levels.length < 30) {
        const level = frontier.filter(n => !seen.has(n.id));
        level.forEach(n => seen.add(n.id));
        if (!level.length) break;
        levels.push(level);
        frontier = level.flatMap(n => n.inputs.map(id => byId.get(id)).filter((x): x is ProfileNode => Boolean(x)));
    }
    const rest = nodes.filter(n => !seen.has(n.id));
    if (rest.length) levels.push(rest);
    return levels;
}

/* ------------------------------------------------------------ statements */

/** The statement the caret is in (Snowsight runs that one on Ctrl+Enter). */
export function statementAt(text: string, caret: number): string {
    const spans = statementSpans(text);
    for (const [start, end] of spans) {
        if (caret >= start && caret <= end + 1) return text.slice(start, end).trim();
    }
    // Caret after the last statement: run the last one.
    const last = spans[spans.length - 1];
    return last ? text.slice(last[0], last[1]).trim() : '';
}

/** [start, end) of each statement, honouring quotes and comments. */
export function statementSpans(text: string): [number, number][] {
    const spans: [number, number][] = [];
    let start = 0;
    let i = 0;
    let quote = '';
    while (i < text.length) {
        const ch = text[i];
        if (quote) {
            if (ch === quote) {
                if (text[i + 1] === quote) i++;
                else quote = '';
            }
        } else if (ch === "'" || ch === '"') {
            quote = ch;
        } else if (ch === '-' && text[i + 1] === '-') {
            const nl = text.indexOf('\n', i);
            i = nl < 0 ? text.length : nl;
            continue;
        } else if (ch === '/' && text[i + 1] === '*') {
            const close = text.indexOf('*/', i + 2);
            i = close < 0 ? text.length : close + 2;
            continue;
        } else if (ch === '$' && text[i + 1] === '$') {
            const close = text.indexOf('$$', i + 2);
            i = close < 0 ? text.length : close + 2;
            continue;
        } else if (ch === ';') {
            if (stripComments(text.slice(start, i)).trim()) spans.push([start, i]);
            start = i + 1;
        }
        i++;
    }
    if (stripComments(text.slice(start)).trim()) spans.push([start, text.length]);
    return spans;
}

function stripComments(text: string): string {
    return text.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** A short title for a statement, the way Query History shows it. */
export function oneLine(sql: string, max = 120): string {
    const text = stripComments(String(sql || '')).replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** The DDL Snowsight shows on an object's Definition panel, from its metadata. */
export function tableDdl(table: SfTable): string {
    if (table.definition && /^\s*create/i.test(table.definition)) return table.definition;
    const kind = String(table.kind || 'TABLE').toUpperCase();
    if (kind === 'VIEW') {
        return `create or replace view ${table.fqn}${table.definition ? `\nas ${table.definition}` : ' as\n  -- definition not available'};`;
    }
    const cols = (table.columns || []).map(c => `\t${c.name} ${c.type}${c.nullable === false ? ' NOT NULL' : ''}${c.masking_policy ? ` WITH MASKING POLICY ${c.masking_policy}` : ''}`);
    const prefix = kind === 'TRANSIENT' ? 'create or replace transient table' : 'create or replace table';
    let ddl = `${prefix} ${table.fqn} (\n${cols.join(',\n')}\n)`;
    if (table.clustering_key) ddl += `\ncluster by (${clusterColumns(table.clustering_key)})`;
    if (table.change_tracking) ddl += '\nchange_tracking = true';
    if (table.retention_days !== undefined && table.retention_days !== null && table.retention_days !== 1) ddl += `\ndata_retention_time_in_days = ${table.retention_days}`;
    return ddl + ';';
}
