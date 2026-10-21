/**
 * The Airflow UI (2.9): the shapes it reads from the engine's `view().airflow`
 * block, the routes it navigates, and the logic that is easy to get wrong
 * (state colours, topological layers for the Graph view, the clear window).
 *
 * Plain module: no Vue, no DOM. The engine is `selfstudyuserlab/utils/sims/
 * dataplat/airflow.py`; EVERY write is an `airflow ...` command line built
 * here with `cli()`, so the console beside the portal and the portal can never
 * disagree.
 */
import { cli, type PortalFlagValue, type PortalValue } from '@/utils/portalKit';

export interface AfTask {
    task_id: string;
    operator: string;
    upstream: string[];
    downstream: string[];
    retries: number;
    retry_delay_min: number;
    pool: string;
    sla_min: number | null;
    trigger_rule: string;
    mapped: boolean;
    [key: string]: any;
}

export interface AfDag {
    dag_id: string;
    fileloc: string;
    schedule: string;
    paused: boolean;
    catchup: boolean;
    tags: string[];
    owner: string;
    start_date: string;
    max_active_runs: number;
    description: string;
    next_run: string;
    tasks: AfTask[];
    last_run_state: string;
    [key: string]: any;
}

export interface AfRun {
    dag_id: string;
    run_id: string;
    logical_date: string;
    data_interval_start: string;
    data_interval_end: string;
    state: string;
    run_type: string;
    start: string;
    end: string;
    conf?: Record<string, any> | string;
    [key: string]: any;
}

export interface AfTi {
    dag_id: string;
    run_id: string;
    task_id: string;
    state: string;
    try_number: number;
    max_tries: number;
    start: string;
    end: string;
    duration_s: number | null;
    map_index: number;
    log: string[];
    [key: string]: any;
}

export interface AfConnection { conn_id: string; conn_type: string; host: string; schema: string; login: string; port?: number | string; extra?: string; description?: string; }
export interface AfVariable { key: string; value: string; description?: string; }
export interface AfPool { pool: string; slots: number; running: number; queued: number; description?: string; [key: string]: any; }
export interface AfXcom { dag_id: string; run_id: string; task_id: string; key: string; value: any; map_index?: number; }
export interface AfJob { id: number; job_type: string; state: string; hostname: string; executor_class: string | null;
    start_date: string | null; end_date: string | null; latest_heartbeat: string | null; dag_id: string | null;
    task_id?: string; run_id?: string; }

/** The tabs of the 2.9 DAG page's right-hand panel (the Grid is always on the left). */
export type DagTab = 'details' | 'graph' | 'gantt' | 'code' | 'calendar' | 'logs' | 'xcom' | 'rendered';

export type AfRoute =
    | { page: 'home' }
    | { page: 'dag'; dagId: string; tab: DagTab; runId?: string; taskId?: string }
    | { page: 'cluster' }
    | { page: 'datasets' }
    | { page: 'security'; sub: 'users' | 'roles' }
    | { page: 'dagruns' }
    | { page: 'tis' }
    | { page: 'sla' }
    | { page: 'audit' }
    | { page: 'jobs' }
    | { page: 'variables' }
    | { page: 'config' }
    | { page: 'connections' }
    | { page: 'pools' }
    | { page: 'xcoms' };

export const BASE_URL = 'http://airflow.shopflow.internal:8080';

/** The URL Airflow 2.9 shows in the address bar for each page. */
export function routeUrl(route: AfRoute): string {
    switch (route.page) {
        case 'home': return `${BASE_URL}/home`;
        case 'dag': {
            // 2.9 folded every DAG view into tabs of the Grid page.
            const params: string[] = [];
            if (route.runId) params.push('dag_run_id=' + encodeURIComponent(route.runId));
            if (route.taskId) params.push('task_id=' + encodeURIComponent(route.taskId));
            if (route.tab !== 'details') params.push('tab=' + route.tab);
            return `${BASE_URL}/dags/${encodeURIComponent(route.dagId)}/grid${params.length ? '?' + params.join('&') : ''}`;
        }
        case 'cluster': return `${BASE_URL}/cluster_activity`;
        case 'datasets': return `${BASE_URL}/datasets`;
        case 'security': return `${BASE_URL}/${route.sub}/list/`;
        case 'dagruns': return `${BASE_URL}/dagrun/list/`;
        case 'tis': return `${BASE_URL}/taskinstance/list/`;
        case 'sla': return `${BASE_URL}/slamiss/list/`;
        case 'audit': return `${BASE_URL}/log/list/`;
        case 'jobs': return `${BASE_URL}/job/list/`;
        case 'variables': return `${BASE_URL}/variable/list/`;
        case 'config': return `${BASE_URL}/configuration`;
        case 'connections': return `${BASE_URL}/connection/list/`;
        case 'pools': return `${BASE_URL}/pool/list/`;
        case 'xcoms': return `${BASE_URL}/xcom/list/`;
    }
    return `${BASE_URL}/home`;
}

/* ---------------------------------------------------------------------------
 * States and their colours - Airflow 2.9's STATE_COLORS defaults.
 * ------------------------------------------------------------------------- */

export const STATE_COLORS: Record<string, string> = {
    deferred: '#9370db',          // mediumpurple
    failed: '#ff0000',            // red
    queued: '#808080',            // gray
    removed: '#d3d3d3',           // lightgrey
    restarting: '#ee82ee',        // violet
    running: '#00ff00',           // lime
    scheduled: '#d2b48c',         // tan
    shutdown: '#0000ff',          // blue
    skipped: '#ff69b4',           // hotpink
    success: '#008000',           // green
    up_for_reschedule: '#40e0d0', // turquoise
    up_for_retry: '#ffd700',      // gold
    upstream_failed: '#ffa500',   // orange
};

/** The states the DAGs list shows as "Recent Tasks" circles, in Airflow's order. */
export const TASK_STATES = ['success', 'running', 'failed', 'upstream_failed', 'skipped', 'up_for_retry',
    'up_for_reschedule', 'queued', 'none', 'scheduled', 'deferred', 'removed', 'restarting'];

export const RUN_STATES = ['queued', 'success', 'running', 'failed'];

export function normState(state: unknown): string {
    const text = String(state ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    return text && text !== 'null' && text !== 'none' ? text : 'none';
}

export function stateColor(state: unknown): string {
    return STATE_COLORS[normState(state)] || 'transparent';
}

/** Text colour that reads on a state swatch (lime and gold need dark ink). */
export function stateInk(state: unknown): string {
    const s = normState(state);
    return ['running', 'up_for_retry', 'removed', 'scheduled', 'up_for_reschedule', 'restarting', 'none'].includes(s) ? '#111' : '#fff';
}

export function stateLabel(state: unknown): string {
    const s = normState(state);
    return s === 'none' ? 'no_status' : s;
}

/** Operator colours as each operator's `ui_color` declares it. */
export const OPERATOR_COLORS: Record<string, string> = {
    BashOperator: '#f0ede4',
    PythonOperator: '#ffefeb',
    _PythonDecoratedOperator: '#ffefeb',
    BranchPythonOperator: '#ffefeb',
    EmptyOperator: '#e8f7e4',
    SQLExecuteQueryOperator: '#cdaaed',
    SnowflakeOperator: '#ededed',
    PostgresOperator: '#ededed',
    S3KeySensor: '#ffd8a8',
    ExternalTaskSensor: '#4db7db',
    SqlSensor: '#7c7287',
    TriggerDagRunOperator: '#ffefeb',
    DbtTaskGroup: '#ff694a',
};

export function operatorColor(op: unknown): string {
    const name = String(op || '');
    if (OPERATOR_COLORS[name]) return OPERATOR_COLORS[name];
    if (/Sensor$/.test(name)) return '#e6f1f2';
    return '#fff';
}

/* ---------------------------------------------------------------------------
 * Time
 * ------------------------------------------------------------------------- */

/** "2026-11-02T06:00:00+00:00" -> "2026-11-02, 06:00:00 UTC" - Airflow's own format. */
export function fmtDate(value: unknown, withTz = true): string {
    const text = String(value ?? '').trim();
    if (!text || text === 'None' || text === 'null') return '';
    const m = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?/);
    if (!m) return text;
    return `${m[1]}, ${m[2]}${m[3] || ':00'}${withTz ? ' UTC' : ''}`;
}

/** The date part of a logical date, for `-s` / `-e` and the Calendar. */
export function dayOf(value: unknown): string {
    const m = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] ?? '' : '';
}

/** Seconds as Airflow's HH:MM:SS duration. */
export function fmtDuration(seconds: unknown): string {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n < 0) return '';
    const s = Math.round(n);
    const pad = (x: number) => String(x).padStart(2, '0');
    const d = Math.floor(s / 86400);
    const rest = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    return d ? `${d} day${d === 1 ? '' : 's'}, ${rest}` : rest;
}

export function secondsBetween(start: unknown, end: unknown): number | null {
    const a = Date.parse(String(start || '').replace(' ', 'T'));
    const b = Date.parse(String(end || '').replace(' ', 'T'));
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.max(0, (b - a) / 1000);
}

/** A cron or preset, shown the way the DAGs list shows it. */
export function scheduleLabel(schedule: unknown): string {
    const text = String(schedule ?? '').trim();
    if (!text || text === 'None' || text === 'null') return 'None';
    return text;
}

/* ---------------------------------------------------------------------------
 * Graph: topological layers
 * ------------------------------------------------------------------------- */

/** Tasks in dependency order (stable: declaration order breaks ties). */
export function topoOrder(tasks: AfTask[]): AfTask[] {
    const byId = new Map(tasks.map(t => [t.task_id, t]));
    const indeg = new Map<string, number>();
    for (const t of tasks) indeg.set(t.task_id, (t.upstream || []).filter(u => byId.has(u)).length);
    const out: AfTask[] = [];
    const done = new Set<string>();
    let progress = true;
    while (out.length < tasks.length && progress) {
        progress = false;
        for (const t of tasks) {
            if (done.has(t.task_id)) continue;
            if ((indeg.get(t.task_id) || 0) === 0) {
                out.push(t);
                done.add(t.task_id);
                progress = true;
                for (const d of t.downstream || []) {
                    if (indeg.has(d)) indeg.set(d, (indeg.get(d) || 0) - 1);
                }
            }
        }
    }
    for (const t of tasks) if (!done.has(t.task_id)) out.push(t);   // a cycle: still show it
    return out;
}

/** Each task's layer = the longest path from a root, so edges always point right. */
export function layers(tasks: AfTask[]): AfTask[][] {
    const order = topoOrder(tasks);
    const depth = new Map<string, number>();
    for (const t of order) {
        let d = 0;
        for (const u of t.upstream || []) {
            if (depth.has(u)) d = Math.max(d, (depth.get(u) || 0) + 1);
        }
        depth.set(t.task_id, d);
    }
    const result: AfTask[][] = [];
    for (const t of order) {
        const d = depth.get(t.task_id) || 0;
        (result[d] = result[d] || []).push(t);
    }
    return result.filter(Boolean);
}

/** Every task reachable downstream (or upstream) of one. */
export function relatives(tasks: AfTask[], taskId: string, direction: 'downstream' | 'upstream'): string[] {
    const byId = new Map(tasks.map(t => [t.task_id, t]));
    const seen = new Set<string>();
    const stack = [taskId];
    while (stack.length) {
        const id = stack.pop() as string;
        for (const next of byId.get(id)?.[direction] || []) {
            if (!seen.has(next)) { seen.add(next); stack.push(next); }
        }
    }
    return [...seen];
}

/** `^task$` for one task id, escaped, as the UI's Clear sends it. */
export function taskRegex(taskId: string): string {
    return '^' + taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
}

/* ---------------------------------------------------------------------------
 * The commands. Every one an `airflow ...` line a student could type.
 * ------------------------------------------------------------------------- */

/** The states the UI's "Mark state as" can set on a task instance. */
export type TiTarget = 'success' | 'failed' | 'skipped' | 'up_for_retry';

export function airflow(words: PortalValue[], flags: Record<string, PortalFlagValue> = {}): string {
    return cli(['airflow', ...words], flags);
}

export const CMD = {
    pause: (dagId: string, paused: boolean) => airflow(['dags', paused ? 'pause' : 'unpause', dagId]),
    trigger: (dagId: string, opts: { conf?: string; logicalDate?: string; runId?: string } = {}) =>
        airflow(['dags', 'trigger', dagId], { '-r': opts.runId || '', '-e': opts.logicalDate || '', '-c': opts.conf || '' }),
    deleteDag: (dagId: string) => airflow(['dags', 'delete', dagId], { '-y': true }),
    backfill: (dagId: string, start: string, end: string, opts: { reset?: boolean; conf?: string } = {}) =>
        airflow(['dags', 'backfill', dagId], {
            '-s': start, '-e': end,
            '--reset-dagruns': Boolean(opts.reset),
            '-c': opts.conf || '',
            '-y': Boolean(opts.reset),
        }),
    /** `airflow tasks clear` - the UI's Clear, its toggles mapped to the CLI's flags. */
    clear: (dagId: string, opts: { taskRegex?: string; start?: string; end?: string; downstream?: boolean; upstream?: boolean; onlyFailed?: boolean }) =>
        airflow(['tasks', 'clear', dagId], {
            '-t': opts.taskRegex || '',
            '-s': opts.start || '',
            '-e': opts.end || '',
            '--downstream': Boolean(opts.downstream),
            '--upstream': Boolean(opts.upstream),
            '--only-failed': Boolean(opts.onlyFailed),
            '-y': true,
        }),
    runTask: (dagId: string, taskId: string, runId: string, opts: { ignoreAllDeps?: boolean; ignoreTaskState?: boolean; ignoreTaskDeps?: boolean } = {}) =>
        airflow(['tasks', 'run', dagId, taskId, runId], {
            '-A': Boolean(opts.ignoreAllDeps),
            '--force': Boolean(opts.ignoreTaskState),
            '-i': Boolean(opts.ignoreTaskDeps),
        }),
    testTask: (dagId: string, taskId: string, date: string) => airflow(['tasks', 'test', dagId, taskId, date]),
    testDag: (dagId: string, date: string) => airflow(['dags', 'test', dagId, date]),
    /**
     * Mark a task instance success / failed. Airflow 2.9's UI does this through
     * its REST API (there is no stock CLI verb); the lab engine accepts the
     * same action as `airflow tasks set-state`, so the drawer still shows a
     * line the console accepts.
     */
    markTask: (dagId: string, taskId: string, runId: string, state: TiTarget,
               opts: { downstream?: boolean; upstream?: boolean; past?: boolean; future?: boolean } = {}) =>
        airflow(['tasks', 'set-state', dagId, taskId, runId, state], {
            '--downstream': Boolean(opts.downstream), '--upstream': Boolean(opts.upstream),
            '--past': Boolean(opts.past), '--future': Boolean(opts.future),
        }),
    markRun: (dagId: string, runId: string, state: 'success' | 'failed' | 'queued') =>
        airflow(['dags', 'set-state', dagId, runId, state]),
    /** The DAG Runs list's Delete (a lab verb beside `set-state`, no stock CLI equivalent). */
    deleteRun: (dagId: string, runId: string) => airflow(['dags', 'delete-run', dagId, runId]),
    exportConnections: (file: string) => airflow(['connections', 'export', file]),
    importConnections: (file: string, overwrite = false) =>
        airflow(['connections', 'import', file], { '--overwrite': overwrite }),
    exportPools: (file: string) => airflow(['pools', 'export', file]),
    importPools: (file: string) => airflow(['pools', 'import', file]),
    exportVariables: (file: string) => airflow(['variables', 'export', file]),
    importVariablesFile: (file: string) => airflow(['variables', 'import', file]),
    jobsCheck: (jobType: string) => airflow(['jobs', 'check'], { '--job-type': jobType }),
    taskLogs: (dagId: string, taskId: string, runId: string, tryNumber: number) =>
        airflow(['tasks', 'logs', dagId, taskId, runId], { '--try': tryNumber }),
    renderTask: (dagId: string, taskId: string, date: string) => airflow(['tasks', 'render', dagId, taskId, date]),
    addConnection: (c: { conn_id: string; conn_type: string; host?: string; schema?: string; login?: string; password?: string; port?: string; extra?: string; description?: string }) =>
        airflow(['connections', 'add', c.conn_id], {
            '--conn-type': c.conn_type,
            '--conn-description': c.description || '',
            '--conn-host': c.host || '',
            '--conn-schema': c.schema || '',
            '--conn-login': c.login || '',
            '--conn-password': c.password || '',
            '--conn-port': c.port || '',
            '--conn-extra': c.extra || '',
        }),
    deleteConnection: (connId: string) => airflow(['connections', 'delete', connId]),
    testConnection: (connId: string) => airflow(['connections', 'test', connId]),
    setVariable: (key: string, value: string, description = '') =>
        airflow(['variables', 'set', key, value], { '--description': description }),
    deleteVariable: (key: string) => airflow(['variables', 'delete', key]),
    setPool: (name: string, slots: number | string, description: string) =>
        airflow(['pools', 'set', name, String(slots), description || '']),
    deletePool: (name: string) => airflow(['pools', 'delete', name]),
    reserialize: () => airflow(['dags', 'reserialize']),
    /** Not Airflow: the lab's simulated clock, which every scheduler follows. */
    clock: (delta: string) => cli(['platform', 'clock', delta]),
};

/** A JSON object, or a message saying why it is not one. */
export function parseConf(text: string): { ok: true; value: string } | { ok: false; error: string } {
    const trimmed = text.trim();
    if (!trimmed) return { ok: true, value: '' };
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, error: 'Invalid JSON configuration, must be a dict' };
        }
        return { ok: true, value: JSON.stringify(parsed) };
    } catch {
        return { ok: false, error: 'Invalid JSON configuration, not parseable' };
    }
}

export const CONN_TYPES = ['aws', 'email', 'fs', 'ftp', 'generic', 'google_cloud_platform', 'http', 'kubernetes',
    'mysql', 'postgres', 'redis', 'sftp', 'slack', 'snowflake', 'sqlite', 'ssh', 'wasb'];

/** Mapped task index label used by the Grid. */
export function tryLabel(n: number): string {
    return `${n}`;
}
