/**
 * DataHub: the shapes the portal reads from the engine's `view().quality`
 * block, the routes it navigates, the command builder, and the pieces of logic
 * that are easy to get wrong (DataHub's search, URN spellings, the lineage walk).
 *
 * The engine is `selfstudyuserlab/utils/sims/dataplat/quality.py`; every write
 * goes through a `datahub` / `gx` / `contract` / `monitor` command line built
 * with `dh()` below, so the console and the portal never disagree.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { cli, type PortalFlagValue, type PortalResult, type PortalValue } from '@/utils/portalKit';

export interface DhColumn {
    name: string;
    type: string | null;
    description: string;
    tags: string[];
    terms: string[];
    pii: boolean;
    classified: boolean;
}

export interface DhOwner { owner: string; type: string }

export interface DhAssertion {
    status: 'passing' | 'failing';
    last_run: number;
    suite: string;
    checkpoint: string | null;
    runs: number;
    failed: number;
}

export interface DhDataset {
    urn: string;
    platform: string;
    name: string;
    description: string;
    owner: string;
    owners: DhOwner[];
    domain: string;
    tags: string[];
    terms: string[];
    columns: DhColumn[];
    pii_columns: string[];
    assertions: DhAssertion | null;
    contract: { name: string; version: string } | null;
    upstream: number;
    downstream: number;
    ingested: boolean;
    created: number;
    updated: number;
}

export interface DhEdge { from: string; to: string; via: string; kind: string }
export interface DhTerm { name: string; definition: string }
export interface DhDomain { name: string; owner: string }

export interface DhExpectation { type: string; kwargs: Record<string, any> }
export interface DhSuite { name: string; datasource: string | null; asset: string | null; path: string; expectations: DhExpectation[] }
export interface DhCheckpoint { name: string; suite: string; asset: string | null; last_result: string | null; last_run?: number; created?: number }
export interface DhDetail {
    type: string;
    column: string | null;
    success: boolean;
    observed: any;
    unexpected_count: number;
    unexpected_percent: number;
    partial: any[];
    error: string | null;
}
export interface DhResult {
    id: string;
    checkpoint: string | null;
    suite: string;
    asset: string;
    success: boolean;
    evaluated: number;
    successful: number;
    failed: { type: string; column: string | null; observed: any; unexpected_count: number }[];
    details: DhDetail[];
    rows: number;
    at: number;
    time: string;
}
export interface DhContractField { name: string; type: string; required: boolean; unique: boolean; pii: boolean; description: string }
export interface DhContract {
    name: string;
    path: string;
    dataset: string;
    version: string;
    owner: string;
    valid: boolean | null;
    breaking: string[];
    published: boolean;
    problems: string[];
    validated_at: number | null;
    sla: { freshness_h: number | null; field: string | null };
    fields: DhContractField[];
    freshness?: { field: string; max: any; age_h: number | null; limit_h: number } | null;
    rows?: number;
}
export interface DhContractFile { path: string; name: string; dataset: string; version: string; owner: string; fields: number; error: string }
export interface DhRecipeFile { path: string; type: string; sink: string }
export interface DhDiff {
    old: string;
    new: string;
    breaking: string[];
    non_breaking: string[];
    required_bump: string;
    declared_bump: string;
    sufficient: boolean;
    suggested_version: string;
    at: number;
}
export interface DhMonitor {
    name: string;
    type: string;
    dataset: string;
    column: string | null;
    field: string | null;
    threshold: string | null;
    status: 'OK' | 'ALERT' | null;
    last_value: any;
    detail: string;
    at: number | null;
    baseline: Record<string, any>;
    paused?: boolean;
}
export interface DhIncident {
    id: string;
    title: string;
    dataset: string;
    monitor: string;
    status: 'open' | 'acknowledged' | 'resolved';
    severity: string;
    opened: number;
    opened_time: string;
    resolved: number | null;
    notes: { at: number; by: string; action: string; note: string }[];
}
export interface DhErasure {
    id: string;
    subject: string;
    requested: string;
    completed: string | null;
    status: string;
    by: string;
    rows: number;
    systems: { system: string; dataset: string; rows: number; action: string; status: string }[];
}
export interface DhIngest { recipe: string; source: string; at: number; datasets: number; classified: number }
export interface DhProfile { asset: string; rows: number; at: number; columns: { column: string; type: string; nulls: number; null_pct: number; distinct: number; min: any; max: any }[] }

export interface DhRoute {
    page: 'home' | 'search' | 'entity' | 'glossary' | 'domains' | 'monitors' | 'incidents'
        | 'contracts' | 'gx' | 'ingestion' | 'pii' | 'erasure';
    query?: string;
    platforms?: string[];
    urn?: string;
    tab?: string;
    name?: string;
}

export interface RunOptions { success?: string; quiet?: boolean; failure?: string }

export interface ConfirmRequest {
    title: string;
    message: string;
    yes?: string;
    danger?: boolean;
    /** The user must type this exact text before OK is enabled. */
    typeToConfirm?: string;
}

export interface DhContext {
    datasets: ComputedRef<DhDataset[]>;
    edges: ComputedRef<DhEdge[]>;
    terms: ComputedRef<DhTerm[]>;
    domains: ComputedRef<DhDomain[]>;
    suites: ComputedRef<DhSuite[]>;
    suiteErrors: ComputedRef<{ path: string; error: string }[]>;
    checkpoints: ComputedRef<DhCheckpoint[]>;
    results: ComputedRef<DhResult[]>;
    contracts: ComputedRef<DhContract[]>;
    contractFiles: ComputedRef<DhContractFile[]>;
    recipeFiles: ComputedRef<DhRecipeFile[]>;
    diffs: ComputedRef<DhDiff[]>;
    monitors: ComputedRef<DhMonitor[]>;
    incidents: ComputedRef<DhIncident[]>;
    erasures: ComputedRef<DhErasure[]>;
    ingests: ComputedRef<DhIngest[]>;
    profiles: ComputedRef<DhProfile[]>;
    piiUnmasked: ComputedRef<string[]>;
    lastAudit: ComputedRef<{ at: number; unmasked: string[] } | null>;
    docsBuilt: ComputedRef<boolean>;
    clockText: ComputedRef<string>;
    clock: ComputedRef<number>;
    busy: ComputedRef<boolean>;
    route: Ref<DhRoute>;
    go: (route: DhRoute) => void;
    openEntity: (urn: string, tab?: string) => void;
    run: (command: string, options?: RunOptions) => Promise<PortalResult>;
    read: (command: string) => Promise<PortalResult>;
    confirm: (request: ConfirmRequest) => Promise<boolean>;
    notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
    dataset: (urn: string) => DhDataset | undefined;
}

export const DH: InjectionKey<DhContext> = Symbol('datahub');

export function useDh(): DhContext {
    const ctx = inject(DH);
    if (!ctx) throw new Error('DataHub page rendered outside DataHub.vue');
    return ctx;
}

/**
 * A command line for the four CLIs this product speaks (`datahub`, `gx`,
 * `contract`, `monitor`). Free text (a definition, a note, a description) goes
 * in `text`, because `cli()` drops an empty value - and an empty description is
 * how an edit is CLEARED - and a value starting with a dash would be read by the
 * engine's parser as the next option. Both are sent as `--flag=value`.
 */
export function dh(words: PortalValue[], flags: Record<string, PortalFlagValue> = {},
                   text: Record<string, string> = {}): string {
    const extra: string[] = [];
    let all = flags;
    for (const [flag, value] of Object.entries(text)) {
        if (value === '' || value.startsWith('-')) extra.push(`${flag}=${value}`);
        else all = { ...all, [flag]: value };
    }
    return cli([...words, ...extra], all);
}

export interface PlatformInfo { label: string; kind: string }

export const PLATFORMS: Record<string, PlatformInfo> = {
    postgres: { label: 'PostgreSQL', kind: 'Table' },
    snowflake: { label: 'Snowflake', kind: 'Table' },
    kafka: { label: 'Kafka', kind: 'Topic' },
    lake: { label: 'S3', kind: 'Table' },
    dbt: { label: 'dbt', kind: 'Model' },
    airflow: { label: 'Airflow', kind: 'Task' },
    flink: { label: 'Flink', kind: 'Job' },
    feast: { label: 'Feast', kind: 'Feature View' },
};

export function platformOf(urn: string): string {
    const text = String(urn || '');
    const index = text.indexOf(':');
    return index > 0 ? text.slice(0, index).toLowerCase() : 'unknown';
}

export function nameOf(urn: string): string {
    const text = String(urn || '');
    const index = text.indexOf(':');
    return index > 0 ? text.slice(index + 1) : text;
}

export function platformLabel(platform: string): string {
    return PLATFORMS[platform]?.label || (platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Unknown');
}

export function subtypeOf(platform: string): string {
    return PLATFORMS[platform]?.kind || 'Dataset';
}

/** The last segment of a dotted name: what DataHub prints as the entity title. */
export function shortName(urn: string): string {
    const name = nameOf(urn);
    const parts = name.split('.');
    return parts[parts.length - 1] || name;
}

/** The browse path (container breadcrumbs) above the title. */
export function browsePath(urn: string): string[] {
    const parts = nameOf(urn).split('.');
    return parts.slice(0, -1);
}

/** DataHub's own spelling of a dataset URN, which the engine also accepts. */
export function fullUrn(urn: string): string {
    return `urn:li:dataset:(urn:li:dataPlatform:${platformOf(urn)},${nameOf(urn)},PROD)`;
}

/** Comparing two dataset references written in different spellings. */
export function canonical(text: string): string {
    const value = String(text || '').trim();
    const match = value.match(/^urn:li:dataset:\(urn:li:dataPlatform:([^,]+),([^,]+)(?:,[A-Z]+)?\)$/);
    const plain = match ? `${match[1]}:${match[2]}` : value;
    const [platform, ...rest] = plain.split(':');
    const aliases: Record<string, string> = { pg: 'postgres', postgresql: 'postgres', sf: 'snowflake', delta: 'lake', iceberg: 'lake' };
    const pl = (platform || '').toLowerCase();
    const p = aliases[pl] || pl;
    let name = rest.join(':').toLowerCase();
    if (p === 'postgres' && name && !name.includes('.')) name = 'shop.public.' + name;
    if (p === 'postgres' && name.split('.').length === 2) name = 'shop.' + name;
    return `${p}:${name}`;
}

export function sameDataset(a: string, b: string): boolean {
    return canonical(a) === canonical(b);
}

/** True for the assets GX, monitors and contracts can query. */
export function isQueryable(urn: string): boolean {
    return ['postgres', 'snowflake', 'lake'].includes(platformOf(urn));
}

/**
 * DataHub's search, as the engine runs it (`datahub search`): every word of the
 * query must appear in the URN, description, domain, tags, terms, field names
 * or owners. Kept identical so the results list and the CLI agree.
 */
export function searchDatasets(datasets: DhDataset[], query: string, platforms: string[] = []): DhDataset[] {
    const words = String(query || '').trim().toLowerCase().replace(/^\*$/, '').split(/\s+/).filter(Boolean);
    return datasets
        .filter(d => !platforms.length || platforms.includes(d.platform))
        .filter(d => {
            const hay = [d.urn, d.description, d.domain, ...(d.tags || []), ...(d.terms || []),
                ...(d.columns || []).map(c => c.name), ...(d.owners || []).map(o => o.owner)]
                .join(' ').toLowerCase();
            return words.every(w => hay.includes(w));
        })
        .sort((a, b) => a.urn.toLowerCase().localeCompare(b.urn.toLowerCase()));
}

export const OWNER_TYPES: { value: string; label: string }[] = [
    { value: 'TECHNICAL_OWNER', label: 'Technical Owner' },
    { value: 'BUSINESS_OWNER', label: 'Business Owner' },
    { value: 'DATA_STEWARD', label: 'Data Steward' },
];

export function ownerTypeLabel(type: string): string {
    return OWNER_TYPES.find(t => t.value === type)?.label || type;
}

export const EXPECTATIONS: { type: string; label: string; column: boolean; range: boolean; set: boolean; regex: boolean; compound: boolean }[] = [
    { type: 'expect_column_values_to_not_be_null', label: 'Column values are not null', column: true, range: false, set: false, regex: false, compound: false },
    { type: 'expect_column_values_to_be_unique', label: 'Column values are unique', column: true, range: false, set: false, regex: false, compound: false },
    { type: 'expect_column_values_to_be_between', label: 'Column values are between', column: true, range: true, set: false, regex: false, compound: false },
    { type: 'expect_column_values_to_be_in_set', label: 'Column values are in set', column: true, range: false, set: true, regex: false, compound: false },
    { type: 'expect_column_values_to_match_regex', label: 'Column values match regex', column: true, range: false, set: false, regex: true, compound: false },
    { type: 'expect_table_row_count_to_be_between', label: 'Table row count is between', column: false, range: true, set: false, regex: false, compound: false },
    { type: 'expect_column_mean_to_be_between', label: 'Column mean is between', column: true, range: true, set: false, regex: false, compound: false },
    { type: 'expect_compound_columns_to_be_unique', label: 'Compound columns are unique', column: false, range: false, set: false, regex: false, compound: true },
    { type: 'expect_column_max_to_be_between', label: 'Column max is between (freshness)', column: true, range: true, set: false, regex: false, compound: false },
];

/** A stable colour for a tag's dot, as DataHub gives every tag one. */
export function tagColor(tag: string): string {
    const palette = ['#d6246e', '#1677ff', '#13a8a8', '#d46b08', '#722ed1', '#389e0d', '#c41d7f', '#0958d9'];
    if (String(tag).toUpperCase() === 'PII') return '#cf1322';
    let hash = 0;
    for (const ch of String(tag)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length] as string;
}

/** The simulated clock is minutes since the lab's epoch, 2026-11-02 00:00. */
export function clockAgo(at: number | null | undefined, now: number): string {
    if (at === null || at === undefined) return '-';
    const minutes = Math.max(0, Number(now) - Number(at));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
}

export function humanType(type: string): string {
    return String(type || '').replace(/^expect_/, '').replace(/_/g, ' ');
}

/** The URL DataHub's own router shows for a page. */
export function routeUrl(route: DhRoute): string {
    const base = 'http://datahub.shopflow.internal:9002';
    const enc = encodeURIComponent;
    switch (route.page) {
        case 'search': {
            const filters = (route.platforms || []).map((p, i) =>
                `&filter_platform___false___EQUAL___${i}=${enc('urn:li:dataPlatform:' + p)}`).join('');
            return `${base}/search?page=1&query=${enc(route.query || '*')}&unionType=0${filters}`;
        }
        case 'entity': {
            const tab = route.tab || 'Schema';
            return `${base}/dataset/${enc(fullUrn(route.urn || ''))}/${enc(tab)}?is_lineage_mode=false`;
        }
        case 'glossary':
            return route.name
                ? `${base}/glossaryTerm/${enc('urn:li:glossaryTerm:' + route.name)}/Related%20Entities`
                : `${base}/glossary`;
        case 'domains':
            return route.name
                ? `${base}/domain/${enc('urn:li:domain:' + route.name)}/Entities`
                : `${base}/domains`;
        case 'monitors': return `${base}/observe/monitors`;
        case 'incidents': return `${base}/observe/incidents`;
        case 'contracts': return `${base}/observe/data-contracts`;
        case 'gx': return `${base}/observe/assertions?source=great-expectations`;
        case 'ingestion': return `${base}/ingestion`;
        case 'pii': return `${base}/govern/compliance/pii`;
        case 'erasure': return `${base}/govern/compliance/erasure`;
        default: return `${base}/`;
    }
}

export interface LineageNode {
    urn: string;
    level: number;
    expandable: boolean;
}

export interface LineageGraph {
    nodes: LineageNode[];
    edges: DhEdge[];
}

/**
 * The visible lineage around one dataset: walk upstream to `up` hops and
 * downstream to `down` hops (like `datahub lineage --depth`), plus one extra hop
 * in the outward direction from every node the student expanded. A node keeps
 * the FIRST level it is reached at, so a diamond does not draw a node twice.
 */
export function buildLineage(center: string, edges: DhEdge[], up: number, down: number,
                             expanded: Set<string>): LineageGraph {
    const key = (u: string) => u.toLowerCase();
    const level = new Map<string, { urn: string; level: number }>();
    level.set(key(center), { urn: center, level: 0 });
    const neighbours = (urn: string, direction: 'up' | 'down') => edges
        .filter(e => key(direction === 'down' ? e.from : e.to) === key(urn))
        .map(e => (direction === 'down' ? e.to : e.from));
    for (const direction of ['up', 'down'] as const) {
        const limit = direction === 'up' ? up : down;
        const sign = direction === 'up' ? -1 : 1;
        const queue: { urn: string; depth: number }[] = [{ urn: center, depth: 0 }];
        while (queue.length) {
            const item = queue.shift()!;
            if (item.depth >= 12) continue;
            if (item.depth >= limit && !expanded.has(key(item.urn))) continue;
            for (const other of neighbours(item.urn, direction)) {
                if (level.has(key(other))) continue;
                level.set(key(other), { urn: other, level: sign * (item.depth + 1) });
                queue.push({ urn: other, depth: item.depth + 1 });
            }
        }
    }
    const nodes: LineageNode[] = [...level.values()].map(entry => {
        const outward = entry.level < 0 ? 'up' : entry.level > 0 ? 'down' : null;
        const hidden = outward
            ? neighbours(entry.urn, outward).some(o => !level.has(key(o)))
            : false;
        return { urn: entry.urn, level: entry.level, expandable: hidden };
    });
    const visible = new Set(nodes.map(n => key(n.urn)));
    const shown = edges.filter(e => visible.has(key(e.from)) && visible.has(key(e.to)));
    return { nodes, edges: shown };
}
