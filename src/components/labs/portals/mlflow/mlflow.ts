/**
 * MLflow UI: the shapes it reads from the engine's `view().mlflow` block, the
 * routes it navigates, and the pieces of logic that are easy to get wrong
 * (MLflow's filter-string search, relative times, run colours).
 *
 * Plain module: no Vue, no DOM. The engine is `selfstudyuserlab/utils/sims/
 * mlops.py`; every write goes through a `mlflow ...` command line.
 */

export interface MfExperiment {
    id: string;
    name: string;
    lifecycle_stage: string;
    created: string;
    description: string;
    tags: Record<string, string>;
    artifact_location: string;
    default: boolean;
}

export interface MfArtifact {
    path: string;
    is_dir: boolean;
    size: number;
    text: string | null;
}

export interface MfRun {
    run_id: string;
    run_name: string;
    experiment_id: string;
    experiment: string;
    status: string;
    lifecycle_stage: string;
    start_time: string;
    duration_s: number;
    deleted_at: string;
    user: string;
    source: string;
    source_type: string;
    method: string;
    params: Record<string, string>;
    metrics: Record<string, number>;
    history: Record<string, [number, number][]>;
    tags: Record<string, string>;
    description: string;
    dataset: { name: string; digest: string; rows: number; split: string } | null;
    leak: number;
    logged_model: boolean;
    flavor: string;
    memory_gb: number | null;
    registered: { name: string; version: number }[];
    artifacts: MfArtifact[];
}

export interface MfVersion {
    version: number;
    stage: string;
    run_id: string;
    run_name: string;
    experiment_id: string;
    source: string;
    created: string;
    updated: string;
    description: string;
    tags: Record<string, string>;
    aliases: string[];
    status: string;
    base: string;
    format: string;
    size_mb: number;
    metrics: Record<string, number | null>;
}

export interface MfModel {
    name: string;
    description: string;
    created: string;
    updated: string;
    tags: Record<string, string>;
    aliases: Record<string, number>;
    latest_version: number;
    versions: MfVersion[];
}

export interface MfEval {
    id: string;
    model: string;
    run_id: string;
    suite: string;
    threshold: number;
    rows: number;
    dataset: string;
    metrics: Record<string, number>;
    confusion: Record<string, number>;
    slices: Record<string, any>[];
}

export interface MfServing {
    name: string;
    base: string;
    runtime: string;
    dtype: string;
    batch: number;
    replicas: number;
    max_len: number;
    total_gb: number;
    p50_ms: number;
    p95_ms: number;
    requests_per_s: number;
    status: string;
}

export type RunsViewMode = 'table' | 'chart' | 'evaluation' | 'traces';

/** The runs table's sort: `created`, `run_name`, `duration`, `metric:<key>` or `param:<key>`. */
export interface RunsSort { key: string; dir: 'asc' | 'desc' }
export type RunAction = 'open' | 'rename' | 'delete' | 'restore' | 'register' | 'compare' | 'description';

/**
 * Sort runs the way the table header says. A run missing the sorted metric or
 * parameter goes LAST in both directions, as in MLflow - a blank is not a
 * small number. Parameters compare numerically when both values are numbers.
 */
export function sortRuns(list: MfRun[], sort: RunsSort): MfRun[] {
    const sign = sort.dir === 'asc' ? 1 : -1;
    const value = (run: MfRun): string | number | undefined => {
        if (sort.key === 'created') return parseStamp(run.start_time) || 0;
        if (sort.key === 'run_name') return run.run_name.toLowerCase();
        if (sort.key === 'duration') return run.duration_s;
        if (sort.key.startsWith('metric:')) return run.metrics[sort.key.slice(7)];
        if (sort.key.startsWith('param:')) {
            const raw = run.params[sort.key.slice(6)];
            if (raw === undefined || raw === '') return undefined;
            const n = Number(raw);
            return Number.isNaN(n) ? raw.toLowerCase() : n;
        }
        return undefined;
    };
    return list.map((run, index) => ({ run, index, v: value(run) }))
        .sort((a, b) => {
            if (a.v === undefined && b.v === undefined) return a.index - b.index;
            if (a.v === undefined) return 1;
            if (b.v === undefined) return -1;
            const cmp = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v
                : String(a.v).localeCompare(String(b.v));
            return cmp ? cmp * sign : a.index - b.index;
        })
        .map(entry => entry.run);
}

export type MfRoute =
    | { page: 'experiments'; expId: string; mode: RunsViewMode }
    | { page: 'run'; expId: string; runId: string; tab: 'overview' | 'metrics' | 'system' | 'artifacts' }
    | { page: 'compare'; runIds: string[] }
    | { page: 'models' }
    | { page: 'model'; name: string }
    | { page: 'version'; name: string; version: number }
    | { page: 'prompts' };

export const DESCRIPTION_TAG = 'mlflow.note.content';

export function routeUrl(route: MfRoute): string {
    const base = 'http://127.0.0.1:5000/#';
    const e = encodeURIComponent;
    switch (route.page) {
        case 'experiments':
            return `${base}/experiments/${route.expId}?viewMode=${route.mode}`;
        case 'run':
            return `${base}/experiments/${route.expId}/runs/${route.runId}`
                + (route.tab === 'overview' ? '' : `/${route.tab === 'metrics' ? 'model-metrics'
                    : route.tab === 'system' ? 'system-metrics' : 'artifacts'}`);
        case 'compare':
            return `${base}/compare-runs?runs=${e(JSON.stringify(route.runIds))}`;
        case 'models':
            return `${base}/models`;
        case 'model':
            return `${base}/models/${e(route.name)}`;
        case 'version':
            return `${base}/models/${e(route.name)}/versions/${route.version}`;
        case 'prompts':
            return `${base}/prompts`;
    }
}

/** The run colour palette MLflow's charts use, picked stably by run id. */
export const RUN_COLORS = ['#077A9D', '#8A63BF', '#FFAB00', '#00A972', '#BA7B23',
    '#FF3621', '#2272B4', '#99DDB4', '#E65B77', '#919191', '#3A8C47', '#FCA4A1'];

export function runColor(runId: string): string {
    let hash = 0;
    for (const ch of runId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return RUN_COLORS[hash % RUN_COLORS.length];
}

export function parseStamp(stamp: string): number {
    if (!stamp) return NaN;
    return Date.parse(stamp.endsWith('Z') || stamp.includes('+') ? stamp : stamp + 'Z');
}

export function timeAgo(stamp: string, now = Date.now()): string {
    const at = parseStamp(stamp);
    if (Number.isNaN(at)) return '-';
    const seconds = Math.max(0, Math.round((now - at) / 1000));
    if (seconds < 45) return 'a few seconds ago';
    if (seconds < 90) return 'a minute ago';
    const minutes = Math.round(seconds / 60);
    if (minutes < 45) return `${minutes} minutes ago`;
    if (minutes < 90) return 'an hour ago';
    const hours = Math.round(minutes / 60);
    if (hours < 22) return `${hours} hours ago`;
    if (hours < 36) return 'a day ago';
    return `${Math.round(hours / 24)} days ago`;
}

/** `2026-10-18 09:11:33` - the absolute form the run page shows. */
export function fullTime(stamp: string): string {
    const at = parseStamp(stamp);
    if (Number.isNaN(at)) return '-';
    const d = new Date(at);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
        + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** `1.2min`, `45.0s`, `1.1h` - MLflow's duration column. */
export function duration(seconds: number): string {
    if (!seconds && seconds !== 0) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}min`;
    return `${(seconds / 3600).toFixed(1)}h`;
}

export function bytes(size: number): string {
    if (size < 1024) return `${size}B`;
    if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)}KB`;
    if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)}MB`;
    return `${(size / 1024 ** 3).toFixed(2)}GB`;
}

export function num(value: unknown): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return value === null || value === undefined ? '-' : String(value);
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 10000) / 10000);
}

// ---------------------------------------------------------------------------
// The search box: MLflow's filter string, applied client-side.
//
//   metrics.rmse < 1 and params.lr = "0.01"
//   attributes.status = 'FINISHED'      tags.team = 'nlp'
//   run_name LIKE '%owl%'               params.method IN ('lora', 'qlora')
//
// A bare word (no operator) is what the real UI turns into
// `attributes.run_name ILIKE '%word%'`.
// ---------------------------------------------------------------------------

export interface Clause {
    kind: 'metrics' | 'params' | 'tags' | 'attributes';
    key: string;
    op: string;
    value: string | number | string[];
}

export interface ParsedFilter {
    clauses: Clause[];
    error: string;
}

const KIND_ALIASES: Record<string, Clause['kind']> = {
    metric: 'metrics', metrics: 'metrics', param: 'params', params: 'params',
    parameter: 'params', parameters: 'params', tag: 'tags', tags: 'tags',
    attribute: 'attributes', attributes: 'attributes', attr: 'attributes', run: 'attributes',
};

function splitAnd(text: string): string[] {
    const parts: string[] = [];
    let quote = '';
    let current = '';
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            current += ch;
            if (ch === quote) quote = '';
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; current += ch; continue; }
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (depth === 0 && /\s/.test(ch) && /^\s+and\s+/i.test(text.slice(i))) {
            const match = text.slice(i).match(/^\s+and\s+/i)!;
            parts.push(current);
            current = '';
            i += match[0].length - 1;
            continue;
        }
        current += ch;
    }
    parts.push(current);
    return parts.map(part => part.trim()).filter(Boolean);
}

function unquote(raw: string): string {
    const text = raw.trim();
    if (text.length >= 2 && (text[0] === '"' || text[0] === "'" || text[0] === '`')
        && text[text.length - 1] === text[0]) {
        return text.slice(1, -1);
    }
    return text;
}

export function parseFilter(input: string): ParsedFilter {
    const text = input.trim();
    if (!text) return { clauses: [], error: '' };
    if (!/(=|<|>|\blike\b|\bilike\b|\bin\b)/i.test(text)) {
        return { clauses: [{ kind: 'attributes', key: 'run_name', op: 'ILIKE', value: `%${text}%` }], error: '' };
    }
    const clauses: Clause[] = [];
    for (const part of splitAnd(text)) {
        const match = part.match(/^(?:([A-Za-z]+)\.)?(`[^`]+`|"[^"]+"|[\w.\-/]+)\s*(!=|<=|>=|=|<|>|\bnot\s+like\b|\bilike\b|\blike\b|\bnot\s+in\b|\bin\b)\s*(.+)$/i);
        if (!match) {
            return { clauses: [], error: `Invalid clause(s) in filter string: '${part}'` };
        }
        const [, prefix, rawKey, rawOp, rawValue] = match;
        let kind: Clause['kind'] | undefined;
        let key = unquote(rawKey);
        if (prefix) {
            kind = KIND_ALIASES[prefix.toLowerCase()];
            if (!kind) {
                return { clauses: [], error: `Invalid entity type '${prefix}'. Valid values are ['metric', 'parameter', 'tag', 'attribute', 'dataset']` };
            }
        } else if (['run_name', 'status', 'start_time', 'run_id', 'user_id'].includes(key.toLowerCase())) {
            kind = 'attributes';
        } else {
            return { clauses: [], error: `Invalid identifier '${key}'. Prefix it with metrics., params., tags. or attributes.` };
        }
        const op = rawOp.replace(/\s+/g, ' ').toUpperCase();
        let value: Clause['value'];
        if (op === 'IN' || op === 'NOT IN') {
            const list = rawValue.trim().match(/^\((.*)\)$/);
            if (!list) return { clauses: [], error: `Invalid value for IN: ${rawValue}` };
            value = list[1].split(',').map(item => unquote(item)).filter(Boolean);
        } else if (kind === 'metrics') {
            const n = Number(unquote(rawValue));
            if (Number.isNaN(n)) {
                return { clauses: [], error: `Expected numeric value type for metric. Found ${rawValue.trim()}` };
            }
            if (['LIKE', 'ILIKE', 'NOT LIKE'].includes(op)) {
                return { clauses: [], error: `Invalid comparator '${rawOp}' not one of '['>', '>=', '!=', '=', '<', '<=']'` };
            }
            value = n;
        } else {
            const raw = rawValue.trim();
            if (!/^(['"`]).*\1$/.test(raw) && kind !== 'attributes') {
                return { clauses: [], error: `Value is either not quoted or unidentified quote types used for string value ${raw}. Use either single or double quotes.` };
            }
            value = unquote(raw);
        }
        if (kind === 'attributes' && key.toLowerCase() === 'name') key = 'run_name';
        clauses.push({ kind, key, op, value });
    }
    return { clauses, error: '' };
}

function like(text: string, pattern: string, insensitive: boolean): boolean {
    const re = '^' + pattern.split('%').map(part => part.split('_')
        .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.')).join('.*') + '$';
    return new RegExp(re, insensitive ? 'i' : '').test(text);
}

function compare(left: string | number | undefined, op: string, right: Clause['value']): boolean {
    if (left === undefined) return op === '!=' && right !== undefined ? false : false;
    if (Array.isArray(right)) {
        const inList = right.includes(String(left));
        return op === 'IN' ? inList : !inList;
    }
    if (op === 'LIKE') return like(String(left), String(right), false);
    if (op === 'ILIKE') return like(String(left), String(right), true);
    if (op === 'NOT LIKE') return !like(String(left), String(right), false);
    const a = typeof right === 'number' ? Number(left) : String(left);
    const b = right;
    switch (op) {
        case '=': return a === b;
        case '!=': return a !== b;
        case '<': return a < b;
        case '<=': return a <= b;
        case '>': return a > b;
        case '>=': return a >= b;
    }
    return false;
}

export function runMatches(run: MfRun, clauses: Clause[]): boolean {
    return clauses.every(clause => {
        let left: string | number | undefined;
        if (clause.kind === 'metrics') left = run.metrics[clause.key];
        else if (clause.kind === 'params') left = run.params[clause.key];
        else if (clause.kind === 'tags') {
            left = clause.key === 'mlflow.runName' ? run.run_name
                : clause.key === DESCRIPTION_TAG ? run.description : run.tags[clause.key];
        } else {
            const key = clause.key.toLowerCase();
            left = key === 'run_name' ? run.run_name
                : key === 'status' ? run.status
                    : key === 'run_id' ? run.run_id
                        : key === 'user_id' ? run.user
                            : key === 'start_time' ? Math.round((parseStamp(run.start_time) || 0)) : undefined;
        }
        return compare(left, clause.op, clause.value);
    });
}

/** The visible text of a version's stage, MLflow's spelling. */
export function stageLabel(stage: string): string {
    return stage === 'None' || !stage ? 'None' : stage;
}

export function userTags(tags: Record<string, string>): [string, string][] {
    return Object.entries(tags || {}).filter(([key]) => !key.startsWith('mlflow.'));
}
