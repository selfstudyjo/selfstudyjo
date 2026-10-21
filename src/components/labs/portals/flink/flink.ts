/**
 * The Apache Flink 1.19 web dashboard's model, over the lab's data-platform
 * engine (`sim:dataplat`, the `flink` block of the `dataplat` view).
 *
 * Plain on purpose: no Vue, no DOM. The pages read the view through these
 * helpers so a field a replica a release behind does not send yet renders as
 * empty rather than throwing, and every command line the dashboard can write is
 * built here with `cli()` (never by concatenation).
 */
import { cli, pick, rows, type PortalResult } from '@/utils/portalKit';

export const HOST = 'http://flink-jobmanager.shopflow.internal:8081';
export const SAVEPOINT_DIR = 's3://shopflow-lake/flink/savepoints';
export const CHECKPOINT_DIR = 's3://shopflow-lake/flink/checkpoints';

export type JobState = 'RUNNING' | 'FINISHED' | 'CANCELED' | 'FAILED' | 'CANCELLING' | 'CREATED'
    | 'RESTARTING' | 'INITIALIZING' | string;

/**
 * Flink's own COLOR_MAP (web-dashboard `config.ts`) - RUNNING green, FINISHED
 * blue, CANCELED orange, FAILED red - each taken one Ant Design step darker
 * (green-8, blue-7, orange-8, red-7...), because Flink draws white text on these
 * and its exact tones (#52c41a under white is 2.3:1) are not readable.
 */
export const STATE_COLOR: Record<string, string> = {
    TOTAL: '#112641',
    RUNNING: '#237804',
    FAILED: '#cf1322',
    FINISHED: '#096dd9',
    CANCELED: '#ad4e00',
    CANCELING: '#ad6800',
    CANCELLING: '#ad6800',
    CREATED: '#1d39c4',
    DEPLOYING: '#006d75',
    RECONCILING: '#c41d7f',
    IN_PROGRESS: '#ad6800',
    SCHEDULED: '#531dab',
    COMPLETED: '#096dd9',
    RESTARTING: '#006d75',
    INITIALIZING: '#2f54eb',
    SUSPENDED: '#595959',
};

export function stateColor(state: string): string {
    return STATE_COLOR[String(state || '').toUpperCase()] || '#595959';
}

export interface FkVertex {
    id: string;
    name: string;
    parallelism: number;
    records_in: number;
    records_out: number;
    bytes_in?: number;
    bytes_out?: number;
    backpressure: 'OK' | 'LOW' | 'HIGH' | string;
    busy?: number;
    backpressured?: number;
    ship_strategy?: string;
    inputs?: string[];
    watermark?: any;
    status?: string;
    [key: string]: any;
}

export interface FkCheckpoint {
    id: number;
    status: string;
    trigger: any;
    ack: any;
    duration_ms: number;
    size_kb: number;
    savepoint?: boolean;
    path?: string;
}

export interface FkJob {
    jid: string;
    name: string;
    state: JobState;
    parallelism: number;
    start: any;
    end?: any;
    duration: any;
    startMs: number | null;
    durationMs: number | null;
    endMs: number | null;
    vertices: FkVertex[];
    checkpoints: Record<string, any>;
    savepoints: any[];
    watermark: any;
    late_records_dropped: number;
    records_in: number;
    records_out: number;
    sink: string;
    sql: string;
    [key: string]: any;
}

export interface FkRoute {
    page: 'overview' | 'running' | 'completed' | 'job' | 'taskmanagers' | 'taskmanager' | 'jobmanager' | 'submit';
    jid?: string;
    tab?: string;
    tm?: string;
    jmTab?: string;
}

export function routeUrl(route: FkRoute, job?: FkJob | null): string {
    switch (route.page) {
        case 'running': return `${HOST}/#/job/running`;
        case 'completed': return `${HOST}/#/job/completed`;
        case 'job': {
            const kind = job && isRunning(job) ? 'running' : 'completed';
            return `${HOST}/#/job/${kind}/${route.jid || ''}/${route.tab || 'overview'}`;
        }
        case 'taskmanagers': return `${HOST}/#/task-manager`;
        case 'taskmanager': return `${HOST}/#/task-manager/${encodeURIComponent(route.tm || '')}/metrics`;
        case 'jobmanager': return `${HOST}/#/job-manager/${route.jmTab || 'metrics'}`;
        case 'submit': return `${HOST}/#/submit`;
        default: return `${HOST}/#/overview`;
    }
}

// ---------------------------------------------------------------- reading the view

const num = (value: unknown, fallback = 0): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

/** The simulation's epoch (`core.EPOCH` on app 11): minute 0 is 2026-11-02 06:00. */
export const SIM_EPOCH_MS = Date.UTC(2026, 10, 2, 6, 0, 0);

/** A simulated minute as epoch milliseconds. */
export function minuteMs(minute: unknown): number | null {
    const n = Number(minute);
    return minute === null || minute === undefined || minute === '' || !Number.isFinite(n)
        ? null : SIM_EPOCH_MS + n * 60000;
}

/** "Now" on the simulated clock (the view's `clock`, in minutes). */
export function simNowMs(view: unknown): number {
    return minuteMs(pick<any>(view, 'clock', null)) ?? SIM_EPOCH_MS;
}

export function normaliseJob(raw: Record<string, any>, nowMs: number | null = null): FkJob {
    const vertices = (Array.isArray(raw.vertices) ? raw.vertices : [])
        .filter((v: any) => v && typeof v === 'object')
        .map((v: any, index: number) => ({
            ...v,
            id: String(v.id ?? v.vertex_id ?? index),
            name: String(v.name ?? `Vertex ${index + 1}`),
            parallelism: num(v.parallelism, num(raw.parallelism, 1)),
            records_in: num(v.records_in),
            records_out: num(v.records_out),
            backpressure: String(v.backpressure || 'OK').toUpperCase(),
        })) as FkVertex[];
    const state = String(raw.state || 'CREATED').toUpperCase();
    // The engine reports `start_minute` and `duration` in simulated minutes.
    const startMs = minuteMs(raw.start_minute) ?? toMs(raw.start);
    let durationMs: number | null = null;
    if (raw.start_minute !== undefined && typeof raw.duration === 'number') durationMs = raw.duration * 60000;
    else if (typeof raw.duration_ms === 'number') durationMs = raw.duration_ms;
    const live = ['RUNNING', 'CREATED', 'RESTARTING', 'INITIALIZING', 'CANCELLING', 'CANCELING', 'RECONCILING'].includes(state);
    if (durationMs === null && startMs !== null && live && nowMs !== null) durationMs = Math.max(0, nowMs - startMs);
    const endMs = live ? null : (toMs(raw.end) ?? (startMs !== null && durationMs !== null ? startMs + durationMs : null));
    return {
        ...raw,
        startMs,
        durationMs,
        endMs,
        jid: String(raw.jid ?? raw.id ?? ''),
        name: String(raw.name ?? raw.jid ?? 'job'),
        state,
        parallelism: num(raw.parallelism, 1),
        start: startMs ?? raw.start ?? null,
        end: raw.end ?? raw.end_time ?? null,
        duration: raw.duration ?? null,
        vertices,
        checkpoints: raw.checkpoints && typeof raw.checkpoints === 'object' ? raw.checkpoints : {},
        savepoints: Array.isArray(raw.savepoints) ? raw.savepoints : [],
        watermark: raw.watermark ?? null,
        late_records_dropped: num(raw.late_records_dropped),
        records_in: num(raw.records_in),
        records_out: num(raw.records_out),
        sink: String(raw.sink ?? ''),
        sql: String(raw.sql ?? ''),
    };
}

export function jobsOf(view: unknown): FkJob[] {
    const now = simNowMs(view);
    return rows(view, 'flink.jobs').map(raw => normaliseJob(raw, now));
}

export function isRunning(job: FkJob): boolean {
    return ['RUNNING', 'CREATED', 'RESTARTING', 'INITIALIZING', 'CANCELLING', 'CANCELING', 'RECONCILING']
        .includes(String(job.state));
}

export interface FkCluster {
    taskmanagers: number;
    slots_total: number;
    slots_free: number;
    version: string;
    commit: string;
}

export function clusterOf(view: unknown): FkCluster {
    const c = pick<Record<string, any>>(view, 'flink.cluster', {});
    const taskmanagers = num(c.taskmanagers, 0);
    const slotsTotal = num(c.slots_total, 0);
    return {
        taskmanagers,
        slots_total: slotsTotal,
        slots_free: num(c.slots_free, slotsTotal),
        version: String(c.version || '1.19.1'),
        commit: String(c.commit || 'f5d4c5b'),
    };
}

export interface FkTable {
    name: string;
    connector: string;
    format: string;
    topic: string;
    watermark: string;
    columns: { name: string; type: string }[];
    [key: string]: any;
}

export function tablesOf(view: unknown): FkTable[] {
    return rows(view, 'flink.tables').map((t: any) => ({
        ...t,
        name: String(t.name ?? ''),
        connector: String(t.connector ?? ''),
        format: String(t.format ?? ''),
        topic: String(t.topic ?? t.path ?? ''),
        watermark: typeof t.watermark === 'string' ? t.watermark
            : t.watermark ? JSON.stringify(t.watermark) : '',
        columns: (Array.isArray(t.columns) ? t.columns : []).map((col: any) =>
            typeof col === 'string' ? { name: col, type: '' }
                : { name: String(col?.name ?? ''), type: String(col?.type ?? col?.data_type ?? '') }),
    }));
}

export interface FkSavepoint { path: string; job: string; at: any; kind?: string }

export function savepointsOf(view: unknown): FkSavepoint[] {
    return rows(view, 'flink.savepoints').map((s: any) => ({
        ...s,
        path: String(s.path ?? s.location ?? ''),
        job: String(s.job ?? s.jid ?? ''),
        at: s.at ?? s.time ?? null,
    }));
}

/** Flink's own settings (`SET 'k'='v'`), when the engine reports them. */
export function settingsOf(view: unknown): Record<string, string> {
    const raw = pick<Record<string, any>>(view, 'flink.session',
        pick<Record<string, any>>(view, 'flink.settings', {}));
    const out: Record<string, string> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [key, value] of Object.entries(raw)) out[key] = String(value ?? '');
    }
    return out;
}

export function topicsOf(view: unknown): string[] {
    return rows(view, 'kafka.topics').map((t: any) => String(t.name || '')).filter(n => n && !n.startsWith('_'));
}

// ---------------------------------------------------------------- formatting

/** A timestamp from the engine as epoch milliseconds, whatever unit it used. */
export function toMs(value: any): number | null {
    if (value === null || value === undefined || value === '' || value === -1) return null;
    if (typeof value === 'number') {
        if (value > 1e11) return value;
        if (value > 1e8) return value * 1000;
        return null;
    }
    // Only ISO-looking text: the engine's clock text ("Mon 02 Nov 06:30") has no
    // year, and Date.parse would happily invent one.
    const text = String(value);
    if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return null;
    const parsed = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text.replace(' ', 'T') + 'Z');
    return Number.isFinite(parsed) ? parsed : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-19 12:04:51`, the dashboard's date format. */
export function fmtTime(value: any): string {
    if (value === null || value === undefined || value === '' || value === -1) return '-';
    const ms = toMs(value);
    if (ms === null) return String(value);
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} `
        + `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** The dashboard's `humanizeDuration`: `1d 2h 3m 4s`, `12m 5s`, `850ms`. */
export function fmtDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '-';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const parts: string[] = [];
    if (d) parts.push(`${d}d`);
    if (h || d) parts.push(`${h}h`);
    if (m || h || d) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

/** A job's duration in ms (simulated time). */
export function jobDurationMs(job: FkJob): number | null {
    return typeof job.durationMs === 'number' ? job.durationMs : null;
}

export function jobEndMs(job: FkJob): number | null {
    return typeof job.endMs === 'number' ? job.endMs : null;
}

export function fmtCount(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('en-US');
}

export function fmtBytes(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return '-';
    if (n < 1024) return `${n} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let v = n / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function fmtWatermark(value: any): string {
    if (value === null || value === undefined || value === '' || value === Number.MIN_SAFE_INTEGER) {
        return 'No Watermark';
    }
    if (typeof value === 'number' && value < 0) return 'No Watermark';
    const ms = toMs(value);
    return ms === null ? String(value) : fmtTime(ms);
}

// ---------------------------------------------------------------- the job graph

/**
 * How records travel into a vertex: Flink labels every edge with its ship
 * strategy. The engine may say so (`ship_strategy`); otherwise it follows from
 * what the operator is, the way the planner decides it - a keyed aggregate,
 * window, join or rank needs a HASH partitioning, a change of parallelism is a
 * REBALANCE, and anything else is chained FORWARD.
 */
export function shipStrategy(vertex: FkVertex, upstream: FkVertex | undefined): string {
    if (vertex.ship_strategy) return String(vertex.ship_strategy).toUpperCase();
    const name = vertex.name.toLowerCase();
    if (/aggregate|window|join|rank|deduplicate|groupby|keyby|over\(/.test(name)) return 'HASH';
    if (upstream && upstream.parallelism !== vertex.parallelism) return 'REBALANCE';
    return 'FORWARD';
}

export interface GraphEdge { from: string; to: string; strategy: string }

export function graphEdges(vertices: FkVertex[]): GraphEdge[] {
    const byId = new Map(vertices.map(v => [v.id, v]));
    const edges: GraphEdge[] = [];
    vertices.forEach((vertex, index) => {
        const inputs = Array.isArray(vertex.inputs) && vertex.inputs.length
            ? vertex.inputs.map(String).filter(id => byId.has(id))
            : index > 0 ? [vertices[index - 1].id] : [];
        for (const from of inputs) {
            edges.push({ from, to: vertex.id, strategy: shipStrategy(vertex, byId.get(from)) });
        }
    });
    return edges;
}

/** Backpressured (max) %, from the engine's level when it gives no number. */
export function backpressuredPct(vertex: FkVertex, job: FkJob): number {
    if (!isRunning(job)) return 0;
    if (typeof vertex.backpressured === 'number') return Math.round(vertex.backpressured);
    const level = String(vertex.backpressure).toUpperCase();
    return level === 'HIGH' ? 87 : level === 'LOW' ? 23 : 0;
}

/**
 * Busy (max) %. A backpressured vertex is waiting on the one AFTER it, so the
 * first vertex downstream of the last backpressured one is the bottleneck and
 * reads 100%. Deterministic when the engine reports no figure.
 */
export function busyPct(vertex: FkVertex, job: FkJob): number {
    if (!isRunning(job)) return 0;
    if (typeof vertex.busy === 'number') return Math.round(vertex.busy);
    const list = job.vertices;
    const index = list.findIndex(v => v.id === vertex.id);
    let lastHigh = -1;
    list.forEach((v, i) => { if (String(v.backpressure).toUpperCase() !== 'OK') lastHigh = i; });
    if (lastHigh >= 0 && index === lastHigh + 1) return 100;
    if (lastHigh >= 0 && index <= lastHigh) return 4 + ((index * 5) % 9);
    return 6 + ((index * 11 + vertex.parallelism * 3) % 21);
}

/** The colour Flink 1.19 fills a vertex with: busy red, backpressured black, idle blue. */
export function vertexFill(vertex: FkVertex, job: FkJob): string {
    const busy = busyPct(vertex, job);
    const bp = backpressuredPct(vertex, job);
    if (!isRunning(job)) return '#e6f4ff';
    if (bp >= 50) return '#4d4d4d';
    if (busy >= 50) {
        const t = Math.min(1, (busy - 50) / 50);
        return t > 0.5 ? '#d9363e' : '#f5807f';
    }
    return '#e6f4ff';
}

export function vertexInk(fill: string): string {
    return fill === '#e6f4ff' ? '#002766' : '#ffffff';
}

// ---------------------------------------------------------------- checkpoints

export interface CheckpointStats {
    interval_s: number;
    mode: string;
    triggered: number;
    in_progress: number;
    completed: number;
    failed: number;
    restored: number;
    last_size_kb: number;
    last_at: any;
    timeout_s: number;
    min_pause_ms: number;
    max_concurrent: number;
    unaligned: boolean;
    externalized: string;
    enabled: boolean;
    restored_from: string;
}

export function checkpointStats(job: FkJob): CheckpointStats {
    const c = job.checkpoints || {};
    const completed = num(c.completed);
    const failed = num(c.failed);
    const interval = num(c.interval_s ?? c.interval, 0);
    return {
        interval_s: interval,
        mode: String(c.mode || 'EXACTLY_ONCE').toUpperCase(),
        triggered: num(c.triggered, completed + failed + num(c.in_progress)),
        in_progress: num(c.in_progress),
        completed,
        failed,
        restored: num(c.restored, c.restored_from ? 1 : 0),
        last_size_kb: num(c.last_size_kb),
        last_at: c.last_at ?? null,
        timeout_s: num(c.timeout_s, 600),
        min_pause_ms: num(c.min_pause_ms, 0),
        max_concurrent: num(c.max_concurrent, 1),
        unaligned: Boolean(c.unaligned),
        externalized: String(c.externalized || 'Retain on cancellation'),
        enabled: interval > 0 || completed > 0,
        restored_from: String(c.restored_from || job.restored_from || ''),
    };
}

/**
 * The checkpoint history table. The engine's own list when it sends one;
 * otherwise the last ten completed checkpoints laid out from the counts it does
 * report (ids, interval, last size and time) - deterministic, so two reads of
 * the same job show the same table.
 */
export function checkpointHistory(job: FkJob): FkCheckpoint[] {
    const c = job.checkpoints || {};
    const raw = Array.isArray(c.history) ? c.history : [];
    if (raw.length) {
        return raw.filter((h: any) => h && typeof h === 'object').map((h: any, i: number) => ({
            id: num(h.id, i + 1),
            status: String(h.status || 'COMPLETED').toUpperCase(),
            trigger: h.trigger ?? h.trigger_timestamp ?? h.at ?? null,
            ack: h.ack ?? h.latest_ack_timestamp ?? h.at ?? null,
            duration_ms: num(h.duration_ms ?? h.end_to_end_duration, 0),
            size_kb: num(h.size_kb, num(h.state_size, 0) / 1024),
            savepoint: Boolean(h.savepoint || h.is_savepoint),
            path: h.path ? String(h.path) : undefined,
        })).sort((a: FkCheckpoint, b: FkCheckpoint) => b.id - a.id);
    }
    const stats = checkpointStats(job);
    const total = stats.completed + stats.failed;
    if (!total) return [];
    const interval = (stats.interval_s || 60) * 1000;
    const until = job.endMs ?? (job.startMs !== null && job.durationMs !== null ? job.startMs + job.durationMs : null);
    const lastAt = toMs(stats.last_at) ?? (job.startMs !== null
        ? Math.min(until ?? Infinity, job.startMs + total * interval) : null);
    const list: FkCheckpoint[] = [];
    const failedEvery = stats.failed ? Math.max(1, Math.floor(total / stats.failed)) : 0;
    let failedLeft = stats.failed;
    for (let id = total; id > Math.max(0, total - 10); id -= 1) {
        const back = total - id;
        const isFailed = failedLeft > 0 && failedEvery > 0 && id % failedEvery === 0;
        if (isFailed) failedLeft -= 1;
        const trigger = lastAt !== null ? lastAt - back * interval - 180 : null;
        const duration = 180 + ((id * 37) % 140);
        const size = Math.max(1, Math.round(stats.last_size_kb * (1 - back * 0.015)));
        list.push({
            id,
            status: isFailed ? 'FAILED' : 'COMPLETED',
            trigger,
            ack: trigger !== null ? trigger + duration : null,
            duration_ms: isFailed ? 0 : duration,
            size_kb: isFailed ? 0 : size,
        });
    }
    return list;
}

// ---------------------------------------------------------------- task managers

export interface FkTaskManager {
    id: string;
    path: string;
    dataPort: number;
    heartbeat: any;
    slots: number;
    free: number;
    cores: number;
    physicalMemory: number;
    heap: number;
    managed: number;
}

export function taskManagersOf(view: unknown): FkTaskManager[] {
    const explicit = rows(view, 'flink.taskmanagers').length ? rows(view, 'flink.taskmanagers')
        : rows(view, 'flink.cluster.taskmanager_list');
    const cluster = clusterOf(view);
    const clock = simNowMs(view);
    if (explicit.length) {
        return explicit.map((t: any, i: number) => ({
            id: String(t.id ?? `taskmanager-${i + 1}`),
            path: String(t.path ?? `akka.tcp://flink@flink-taskmanager-${i + 1}:6122/user/rpc/taskmanager_0`),
            dataPort: num(t.data_port, 6121),
            heartbeat: t.heartbeat ?? clock,
            slots: num(t.slots, 4),
            free: num(t.free_slots ?? t.slots_free, num(t.slots, 4)),
            cores: num(t.cpu_cores, 4),
            physicalMemory: num(t.physical_memory, 16 * 1024 ** 3),
            heap: num(t.heap, 1536 * 1024 ** 2),
            managed: num(t.managed_memory, 1280 * 1024 ** 2),
        }));
    }
    const count = Math.max(0, cluster.taskmanagers);
    if (!count) return [];
    const per = count ? Math.max(1, Math.round(cluster.slots_total / count)) : 0;
    let used = Math.max(0, cluster.slots_total - cluster.slots_free);
    const list: FkTaskManager[] = [];
    for (let i = 0; i < count; i += 1) {
        const take = Math.min(per, used);
        used -= take;
        const ip = `10.42.${1 + i}.${17 + i * 9}`;
        list.push({
            id: `${ip}:6122-${(0x3f2a1 + i * 0x1b7d).toString(16)}`,
            path: `pekko.tcp://flink@${ip}:6122/user/rpc/taskmanager_0`,
            dataPort: 6121,
            heartbeat: clock,
            slots: per,
            free: per - take,
            cores: 4,
            physicalMemory: 16 * 1024 ** 3,
            heap: 1536 * 1024 ** 2,
            managed: 1280 * 1024 ** 2,
        });
    }
    return list;
}

// ---------------------------------------------------------------- commands

export const cmd = {
    list: (all = false) => cli(['flink', 'list'], { '--all': all }),
    cancel: (jid: string) => cli(['flink', 'cancel', jid]),
    savepoint: (jid: string, dir: string) => cli(['flink', 'savepoint', jid, dir.trim() || null]),
    /** `flink stop [--savepointPath <dir>] [--drain] <jobId>` - the options come before the id. */
    stop: (jid: string, dir: string, drain: boolean) =>
        cli(['flink', 'stop', dir.trim() ? '--savepointPath' : null, dir.trim() || null,
            drain ? '--drain' : null, jid]),
};

/* ---------------------------------------------------------------- JARs */

export const JOBMANAGER = 'http://flink-jobmanager.shopflow.internal:8081';

export interface FkJar { id: string; name: string; uploaded: number; size?: number; entry: { name: string }[]; args?: string }
export interface FkPlaygroundJar { path: string; name: string; size: number; entry: string; args: string }

export function jarsOf(view: unknown): FkJar[] {
    return rows<FkJar>(view, 'flink.jars');
}
export function playgroundJarsOf(view: unknown): FkPlaygroundJar[] {
    return rows<FkPlaygroundJar>(view, 'flink.playground_jars');
}

/** What the dashboard calls: the JobManager's REST API, as curl. */
export const rest = {
    upload: (localPath: string) => cli(['curl', '-s', '-X', 'POST', '-H', 'Expect:', '-F', `jarfile=@${localPath}`,
        `${JOBMANAGER}/jars/upload`]),
    remove: (id: string) => cli(['curl', '-s', '-X', 'DELETE', `${JOBMANAGER}/jars/${encodeURIComponent(id)}`]),
    plan: (id: string, parallelism: number | null) => cli(['curl', '-s', '-X', 'POST', '-H', 'Content-Type: application/json',
        '--data', JSON.stringify(parallelism ? { parallelism } : {}), `${JOBMANAGER}/jars/${encodeURIComponent(id)}/plan`]),
    run: (id: string, body: { entryClass?: string; parallelism?: number | null; programArgs?: string; savepointPath?: string; allowNonRestoredState?: boolean }) => {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body)) if (v !== '' && v !== null && v !== undefined && v !== false) clean[k] = v;
        return cli(['curl', '-s', '-X', 'POST', '-H', 'Content-Type: application/json', '--data', JSON.stringify(clean),
            `${JOBMANAGER}/jars/${encodeURIComponent(id)}/run`]);
    },
};

/** A REST answer's body, or its error message (Flink answers `{"errors": [...]}`). */
export function restAnswer(output: string | undefined): { body: any; error: string } {
    const text = String(output || '').trim();
    try {
        const body = JSON.parse(text);
        if (body && Array.isArray(body.errors)) return { body, error: body.errors.map(String).join('\n') };
        return { body, error: '' };
    } catch {
        return { body: null, error: text };
    }
}

/** A Flink SQL string literal. */
export function sqlString(value: string): string {
    return `'${String(value).replace(/'/g, "''")}'`;
}

/** The result grids the engine returned beside the text (`result.data.grids`). */
export interface FkGridData { columns: string[]; rows: any[][]; total?: number; title?: string }

export function gridsOf(result: PortalResult | null | undefined): FkGridData[] {
    const data: any = result?.data;
    return Array.isArray(data?.grids) ? data.grids.filter((g: any) => g && Array.isArray(g.columns)) : [];
}
