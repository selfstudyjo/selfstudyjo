/**
 * What every Flink dashboard page reads from the shell: the parsed view,
 * navigation, the one way to run something, and the confirm dialog.
 * Provided by `FlinkDashboard.vue`, injected by each page.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { PortalResult } from '@/utils/portalKit';
import type { FkCluster, FkJob, FkRoute, FkSavepoint, FkTable, FkTaskManager } from './flink';

export interface RunOptions {
    success?: string;
    quiet?: boolean;
    surface?: string;
}

export interface ConfirmRequest {
    title: string;
    message: string;
    yes?: string;
    danger?: boolean;
}

export interface FkContext {
    view: ComputedRef<Record<string, any>>;
    jobs: ComputedRef<FkJob[]>;
    cluster: ComputedRef<FkCluster>;
    tables: ComputedRef<FkTable[]>;
    savepoints: ComputedRef<FkSavepoint[]>;
    taskManagers: ComputedRef<FkTaskManager[]>;
    settings: ComputedRef<Record<string, string>>;
    topics: ComputedRef<string[]>;
    now: Ref<number>;
    /** "Now" on the simulated clock, epoch ms. */
    simNow: ComputedRef<number>;
    busy: ComputedRef<boolean>;
    route: Ref<FkRoute>;
    go: (route: FkRoute) => void;
    run: (command: string, options?: RunOptions) => Promise<PortalResult>;
    confirm: (request: ConfirmRequest) => Promise<boolean>;
    notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
    job: (jid: string) => FkJob | undefined;
    /** Fill the SQL Gateway editor (Submit New Job) and open it. */
    openSubmit: (sql?: string, savepoint?: string) => void;
    draft: Ref<{ sql: string; savepoint: string }>;
}

export const FK: InjectionKey<FkContext> = Symbol('flink');

export function useFk(): FkContext {
    const ctx = inject(FK);
    if (!ctx) throw new Error('Flink page rendered outside FlinkDashboard');
    return ctx;
}
