/**
 * The Spark web UI skin — the plain half: deriving the History Server's
 * applications, each application's jobs, stages, tasks and executors from the
 * Hadoop engine's view. No Vue, no DOM.
 *
 * What the engine records for a job is its stages (name, task count, duration,
 * shuffle bytes) — the execution report a query produced. Per-task rows are not
 * stored, so they are EXPANDED here, deterministically, from those stage
 * totals: the same view always draws the same tasks, and the per-task numbers
 * always add back up to the stage totals the engine computed.
 */
import { pick, rows } from '@/utils/portalKit';

export const HISTORY_BASE = 'http://spark-history.lab.internal:18080';

export type SparkPage = 'history' | 'jobs' | 'job' | 'stages' | 'stage' | 'storage' | 'environment'
  | 'executors' | 'sql' | 'query' | 'rdd';

export interface SparkRoute {
  page: SparkPage;
  app?: string;
  id?: number;
}

export interface SparkStage {
  key: string;
  stageId: number;
  jobId: number;
  name: string;
  description: string;
  tasks: number;
  durationMs: number;
  submitted: number;
  shuffleRead: number;
  shuffleWrite: number;
  inputRows: number;
  inputBytes: number;
  /** Catalyst-planned stages carry their task distribution and spill. */
  kind?: string;
  spillMemory: number;
  spillDisk: number;
  spillTasks: number;
  taskMs?: number[];
  taskRead?: number[];
  taskSpill?: number[];
  hot?: number[][];
  skewed?: boolean;
}

export interface SparkJob {
  jobId: number;
  globalId: number;
  description: string;
  submitted: number;
  durationMs: number;
  status: string;
  stages: SparkStage[];
  tasks: number;
  rowsReturned: number;
  error: string;
  plan: string[];
  initialPlan: string[];
  aqe: boolean;
  joinStrategies: string[];
  notes: string[];
}

export interface SparkApp {
  id: string;
  name: string;
  user: string;
  state: string;
  final: string;
  started: number;
  ended: number;
  durationMs: number;
  completed: boolean;
  jobs: SparkJob[];
  stages: SparkStage[];
}

export interface SparkTask {
  index: number;
  taskId: number;
  executor: string;
  host: string;
  launch: number;
  durationMs: number;
  gcMs: number;
  shuffleRead: number;
  shuffleWrite: number;
  inputBytes: number;
  spillMemory: number;
  spillDisk: number;
}

export function locationFor(route: SparkRoute): string {
  if (route.page === 'history' || !route.app) return `${HISTORY_BASE}/`;
  const base = `${HISTORY_BASE}/history/${route.app}`;
  switch (route.page) {
    case 'job': return `${base}/jobs/job/?id=${route.id ?? 0}`;
    case 'stages': return `${base}/stages/`;
    case 'stage': return `${base}/stages/stage/?id=${route.id ?? 0}&attempt=0`;
    case 'storage': return `${base}/storage/`;
    case 'rdd': return `${base}/storage/rdd/?id=${route.id ?? 0}`;
    case 'environment': return `${base}/environment/`;
    case 'executors': return `${base}/executors/`;
    case 'sql': return `${base}/SQL/`;
    case 'query': return `${base}/SQL/execution/?id=${route.id ?? 0}`;
    default: return `${base}/jobs/`;
  }
}

function epoch(stamp: unknown): number {
  const ms = Date.parse(String(stamp || ''));
  return Number.isNaN(ms) ? 0 : ms;
}

/** The applications the History Server lists, newest first, with their jobs. */
export function sparkApps(view: unknown): SparkApp[] {
  const apps = rows(view, 'spark.applications');
  const jobs = rows(view, 'spark.jobs');
  const details = rows(view, 'spark.job_details');
  return apps.map(app => {
    const own = jobs.filter(j => j.app === app.id).sort((a, b) => Number(a.id) - Number(b.id));
    let stageId = 0;
    const appJobs: SparkJob[] = own.map((job, jobIndex) => {
      const detail = details.find(d => d.id === job.id) || {};
      const submitted = epoch(job.submitted) || Number(app.started_epoch || 0) * 1000;
      let offset = 0;
      const stages: SparkStage[] = rows(job, 'stages').map((stage, index) => {
        const raw = rows(detail, 'stages')[index] || {};
        const s: SparkStage = {
          key: `${job.id}-${stage.id}`,
          stageId: stageId++,
          jobId: jobIndex,
          name: String(stage.name || `Stage ${index}`),
          description: stageDescription(String(stage.name || ''), index),
          tasks: Number(stage.tasks || 1),
          durationMs: Number(stage.duration_ms || 0),
          submitted: submitted + offset,
          shuffleRead: Number(raw.shuffle_read || 0),
          shuffleWrite: Number(raw.shuffle_write || 0),
          inputRows: Number(raw.input_rows || 0),
          inputBytes: stage.input_bytes !== undefined ? Number(stage.input_bytes || 0)
            : index === 0 ? Number(raw.input_rows || 0) * 90 : 0,
          kind: stage.kind ? String(stage.kind) : undefined,
          spillMemory: Number(stage.spill_memory || 0),
          spillDisk: Number(stage.spill_disk || 0),
          spillTasks: Number(stage.spill_tasks || 0),
          taskMs: numbers(stage.task_ms),
          taskRead: numbers(stage.task_read),
          taskSpill: numbers(stage.task_spill),
          hot: Array.isArray(stage.hot) ? stage.hot.map((h: unknown) => numbers(h) || []) : undefined,
          skewed: Boolean(stage.skewed),
        };
        offset += s.durationMs;
        return s;
      });
      return {
        jobId: jobIndex,
        globalId: Number(job.id),
        description: String(job.description || ''),
        submitted,
        durationMs: Number(job.duration_ms || 0),
        status: String(job.status || 'SUCCEEDED'),
        stages,
        tasks: stages.reduce((n, s) => n + s.tasks, 0),
        rowsReturned: Number(job.rows_returned || 0),
        error: String(job.error || ''),
        plan: strings(job.plan),
        initialPlan: strings(job.initial_plan),
        aqe: Boolean(job.aqe),
        joinStrategies: strings(job.join_strategies),
        notes: strings(job.notes),
      };
    });
    const started = Number(app.started_epoch || 0) * 1000 || epoch(app.started);
    // The engine finishes an application the instant its query returns; a real
    // driver lives a little longer than its jobs (context start-up, shutdown).
    const lastEnd = appJobs.reduce((t, j) => Math.max(t, j.submitted + j.durationMs), started);
    const durationMs = Math.max(Number(app.duration_ms || 0),
                                appJobs.length ? lastEnd - started + 1350 : Number(app.duration_ms || 0));
    return {
      id: String(app.id),
      name: String(app.name || app.id),
      user: String(app.user || 'lab'),
      state: String(app.state || ''),
      final: String(app.final || ''),
      started,
      ended: app.completed ? started + durationMs : 0,
      durationMs,
      completed: Boolean(app.completed),
      jobs: appJobs,
      stages: appJobs.flatMap(j => j.stages),
    };
  });
}

function numbers(value: unknown): number[] | undefined {
  return Array.isArray(value) ? value.map(v => Number(v) || 0) : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(v => String(v)) : [];
}

function stageDescription(name: string, index: number): string {
  const callsite = index === 0 ? 'collect at SparkSQLDriver.scala:69' : 'run at ThreadPoolExecutor.java:1149';
  return name ? `${callsite}` : callsite;
}

/** A small deterministic hash in [0, 1). */
export function unit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export interface SparkExecutor {
  id: string;
  host: string;
  address: string;
  cores: number;
  memory: string;
  maxMemoryBytes: number;
}

export function executorsFor(view: unknown): SparkExecutor[] {
  const props = pick<Record<string, string>>(view, 'ambari.configs.spark2-defaults.properties', {});
  const count = Math.max(1, Math.min(6, Number(props['spark.executor.instances'] || 2)));
  const cores = Math.max(1, Number(props['spark.executor.cores'] || 2));
  const hosts = rows(view, 'datanodes').map(n => String(n.host));
  const out: SparkExecutor[] = [{
    id: 'driver', host: 'master-1.lab.internal', address: 'master-1.lab.internal:41235', cores: 0,
    memory: String(props['spark.driver.memory'] || '1g'), maxMemoryBytes: 434 * 1024 * 1024,
  }];
  for (let i = 1; i <= count; i++) {
    const host = `${hosts[(i - 1) % Math.max(1, hosts.length)] || 'dn-' + i}.lab.internal`;
    out.push({ id: String(i), host, address: `${host}:${38000 + i * 17}`, cores,
               memory: String(props['spark.executor.memory'] || '2g'), maxMemoryBytes: 912 * 1024 * 1024 });
  }
  return out;
}

/** The tasks of one stage, expanded deterministically from its totals. */
export function tasksFor(stage: SparkStage, executors: SparkExecutor[], taskIdBase: number): SparkTask[] {
  if (stage.taskMs && stage.taskMs.length === 5 && stage.tasks > 0) return measuredTasks(stage, executors, taskIdBase);
  const workers = executors.filter(e => e.id !== 'driver');
  const slots = Math.max(1, workers.reduce((n, e) => n + e.cores, 0));
  const waves = Math.max(1, Math.ceil(stage.tasks / slots));
  const average = Math.max(4, stage.durationMs / waves);
  const out: SparkTask[] = [];
  for (let i = 0; i < stage.tasks; i++) {
    const jitter = 0.55 + 0.9 * unit(`${stage.key}:${i}`);
    const duration = Math.max(1, Math.round(average * jitter));
    const exec = workers[i % Math.max(1, workers.length)] || executors[0];
    const wave = Math.floor(i / slots);
    out.push({
      index: i,
      taskId: taskIdBase + i,
      executor: exec.id,
      host: exec.host,
      launch: stage.submitted + Math.round(wave * average),
      durationMs: duration,
      gcMs: Math.round(duration * 0.04 * unit(`gc:${stage.key}:${i}`)),
      shuffleRead: Math.round(stage.shuffleRead / stage.tasks),
      shuffleWrite: Math.round(stage.shuffleWrite / stage.tasks),
      inputBytes: Math.round(stage.inputBytes / stage.tasks),
      spillMemory: 0,
      spillDisk: 0,
    });
  }
  return out;
}

/** Interpolate a value at rank r in [0, 1] through the five quantiles. */
function atRank(q: number[], r: number): number {
  const pos = r * 4;
  const i = Math.min(3, Math.floor(pos));
  return q[i] + (q[i + 1] - q[i]) * (pos - i);
}

/**
 * The tasks of a Catalyst-planned stage. The engine sends the min / quartiles /
 * max of each metric and the slowest tasks by index; every other task is drawn
 * through those quantiles, so the Summary Metrics table and the task list agree
 * with each other and with the stage totals the engine computed.
 */
function measuredTasks(stage: SparkStage, executors: SparkExecutor[], taskIdBase: number): SparkTask[] {
  const workers = executors.filter(e => e.id !== 'driver');
  const slots = Math.max(1, workers.reduce((n, e) => n + e.cores, 0));
  const n = stage.tasks;
  const hot = (stage.hot || []).filter(h => h.length >= 4 && h[0] < n);
  const hotIndex = new Set(hot.map(h => h[0]));
  const order = Array.from({ length: n }, (_, i) => i).filter(i => !hotIndex.has(i))
    .sort((a, b) => unit(`${stage.key}:o:${a}`) - unit(`${stage.key}:o:${b}`));
  const rest = n - hot.length;
  const rank = new Map<number, number>();
  order.forEach((index, k) => rank.set(index, rest > 1 ? k / (rest - 1) * (hot.length ? 0.97 : 1) : 0));
  const out: SparkTask[] = [];
  const launchAt: number[] = Array(slots).fill(stage.submitted);
  for (let i = 0; i < n; i++) {
    const h = hot.find(x => x[0] === i);
    const r = rank.get(i) ?? 1;
    const ms = Math.max(1, Math.round(h ? h[1] : atRank(stage.taskMs as number[], r)));
    const read = Math.round(h ? h[2] : atRank(stage.taskRead || [0, 0, 0, 0, 0], r));
    const spill = Math.round(h ? h[3] : atRank(stage.taskSpill || [0, 0, 0, 0, 0], r));
    const slot = launchAt.indexOf(Math.min(...launchAt));
    const exec = workers[slot % Math.max(1, workers.length)] || executors[0];
    out.push({
      index: i, taskId: taskIdBase + i, executor: exec.id, host: exec.host, launch: launchAt[slot],
      durationMs: ms, gcMs: Math.round(ms * (spill ? 0.12 : 0.04) * unit(`gc:${stage.key}:${i}`)),
      shuffleRead: stage.kind === 'scan' ? 0 : read,
      shuffleWrite: Math.round(stage.shuffleWrite / n),
      inputBytes: stage.kind === 'scan' ? Math.round(stage.inputBytes / n) : 0,
      spillMemory: spill ? Math.round(spill * 2) : 0, spillDisk: spill,
    });
    launchAt[slot] += ms;
  }
  return out;
}

/** The engine's physical plan when it sent one, else a sketch from the stages. */
export function planLines(job: SparkJob, initial = false): string[] {
  const lines = initial ? job.initialPlan : job.plan;
  if (lines && lines.length) return lines;
  const nodes = physicalPlan(job);
  return ['AdaptiveSparkPlan isFinalPlan=true', ...nodes.map((n, i) => ' '.repeat(i * 3) + '+- ' + n)];
}

/** Operator names, bottom (scan) to top, for the SQL tab's diagram. */
export function planOperators(job: SparkJob): string[] {
  return planLines(job).map(line => line.replace(/^[\s+-]*/, '').trim())
    .filter(Boolean).reverse();
}

/** The first task id of each stage in an application, counting in order. */
export function taskIdBase(app: SparkApp, stage: SparkStage): number {
  let base = 0;
  for (const s of app.stages) {
    if (s.key === stage.key) return base;
    base += s.tasks;
  }
  return base;
}

/** Min, 25th, median, 75th, max — Spark's summary metrics row. */
export function quantiles(values: number[]): number[] {
  if (!values.length) return [0, 0, 0, 0, 0];
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1) + 0.5))];
  return [sorted[0], at(0.25), at(0.5), at(0.75), sorted[sorted.length - 1]];
}

/** Spark's own duration format: 45 ms, 1.2 s, 3.4 min, 1.1 h. */
export function duration(ms: number): string {
  const v = Number(ms) || 0;
  if (v < 1000) return `${Math.round(v)} ms`;
  if (v < 60000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')} s`;
  if (v < 3600000) return `${(v / 60000).toFixed(1).replace(/\.0$/, '')} min`;
  return `${(v / 3600000).toFixed(1)} h`;
}

/** Spark's byte format: 12.3 KiB, 4.0 MiB. */
export function bytes(value: number): string {
  let v = Number(value) || 0;
  if (v === 0) return '0.0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(1)} ${units[u]}`;
}

/** Spark's date format: 2026/10/18 09:02:52. */
export function date(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** The physical plan Spark would print for the stages the engine recorded. */
export function physicalPlan(job: SparkJob): string[] {
  const names = job.stages.map(s => s.name);
  const sql = job.description.toLowerCase();
  const nodes: string[] = [];
  if (names.includes('Sort') || /order\s+by/.test(sql)) nodes.push('Sort [ordering#1 DESC NULLS LAST], true, 0');
  if (names.includes('Sort')) nodes.push('Exchange rangepartitioning(ordering#1 DESC NULLS LAST, 200), ENSURE_REQUIREMENTS');
  if (names.includes('HashAggregate')) {
    nodes.push('HashAggregate(keys=[grouping#0], functions=[finalmerge(...)])');
    nodes.push('Exchange hashpartitioning(grouping#0, 200), ENSURE_REQUIREMENTS');
    nodes.push('HashAggregate(keys=[grouping#0], functions=[partial(...)])');
  }
  if (names.includes('ShuffleHashJoin')) {
    nodes.push('ShuffledHashJoin [key#0], [key#1], Inner, BuildRight');
    nodes.push('Exchange hashpartitioning(key#1, 200), ENSURE_REQUIREMENTS');
  }
  const table = (job.description.match(/\bfrom\s+([\w.]+)/i) || [])[1] || 'table';
  nodes.push(`FileScan csv default.${table.replace(/^.*\./, '')} Batched: false, DataFilters: [], Format: CSV, Location: InMemoryFileIndex(1 paths)[hdfs://namenode:8020/data/...], ReadSchema: struct<...>`);
  return nodes;
}
