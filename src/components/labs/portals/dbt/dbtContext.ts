/**
 * What every dbt Cloud page reads from the shell: the parsed view, navigation,
 * the one way to run a command, and the confirm dialog. Provided by
 * `DbtCloud.vue`, injected by each page, so a page never imports the shell.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { cli, errorText, parseJson, type PortalFlagValue, type PortalResult, type PortalValue } from '@/utils/portalKit';
import type {
    CloudEnv, CloudJob, CloudRun, DbtCoreRun, DbtExposure, DbtModel, DbtRoute, DbtSeedLike,
    DbtSource, DbtTest, FileItem, Graph,
} from './dbt';

export interface RunOptions { success?: string; quiet?: boolean; unlogged?: boolean }

export interface ConfirmRequest {
    title: string;
    message: string;
    yes?: string;
    danger?: boolean;
    /** Typed confirmation: the OK button stays disabled until this is typed. */
    typed?: string;
}

/** One command the IDE ran, for the command history drawer. */
export interface IdeInvocation {
    id: number;
    command: string;
    ok: boolean;
    output: string;
    data: any;
    at: string;
}

export interface DbtContext {
    version: ComputedRef<string>;
    project: ComputedRef<Record<string, any>>;
    models: ComputedRef<DbtModel[]>;
    sources: ComputedRef<DbtSource[]>;
    seeds: ComputedRef<DbtSeedLike[]>;
    snapshots: ComputedRef<DbtSeedLike[]>;
    tests: ComputedRef<DbtTest[]>;
    exposures: ComputedRef<DbtExposure[]>;
    coreRuns: ComputedRef<DbtCoreRun[]>;
    envs: ComputedRef<CloudEnv[]>;
    jobs: ComputedRef<CloudJob[]>;
    cloudRuns: ComputedRef<CloudRun[]>;
    files: ComputedRef<FileItem[]>;
    docsGenerated: ComputedRef<boolean>;
    parsed: ComputedRef<boolean>;
    nowStamp: ComputedRef<string>;
    busy: ComputedRef<boolean>;
    graph: (withTests?: boolean) => Graph;
    route: Ref<DbtRoute>;
    go: (route: DbtRoute) => void;
    run: (command: string, options?: RunOptions) => Promise<PortalResult>;
    confirm: (request: ConfirmRequest) => Promise<boolean>;
    notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
    ide: Ref<IdeInvocation[]>;
    ideRun: (command: string) => Promise<IdeInvocation>;
    nameOf: (uid: string) => string;
}

export const DBT: InjectionKey<DbtContext> = Symbol('dbt-cloud');

export function useDbt(): DbtContext {
    const ctx = inject(DBT);
    if (!ctx) throw new Error('dbt Cloud page rendered outside DbtCloud');
    return ctx;
}

/**
 * "Run now": `dbt-cloud job run --job-id N`. The engine runs every step
 * synchronously and answers with the run (an error exit when the run failed,
 * still carrying the run as JSON), so either way the portal can open it.
 */
export async function runJob(dbt: DbtContext, jobId: number, jobName: string, cause = 'Triggered via the dbt Cloud UI'): Promise<number | null> {
    const result = await dbt.run(cli(['dbt-cloud', 'job', 'run'], { '--job-id': jobId, '--cause': cause }), { quiet: true });
    const doc = parseJson<any>(result.ok ? result.output : result.error || result.output);
    const id = Number(doc?.data?.id || 0) || null;
    if (result.ok) dbt.notify('success', `Run #${id} succeeded`, `${jobName} finished successfully.`);
    else if (id) dbt.notify('error', `Run #${id} failed`, `${jobName}: a step returned an error - open the run for its logs.`);
    else dbt.notify('error', 'Could not start the run', errorText(result));
    return id;
}

/**
 * A free-text flag. `cli()` drops an empty value, and an empty value is how a
 * description is CLEARED; a value starting with a dash would be read as the
 * next option. Both go as `--flag=value` (a word that needs no quoting
 * when empty; quoted by cli() otherwise).
 */
export function textFlag(base: PortalValue[], flags: Record<string, PortalFlagValue>, text: Record<string, string>): string {
    const extra: string[] = [];
    const merged = { ...flags };
    for (const [flag, value] of Object.entries(text)) {
        if (value === '' || value.startsWith('-')) extra.push(`${flag}=${value}`);
        else merged[flag] = value;
    }
    return cli([...base, ...extra], merged);
}
