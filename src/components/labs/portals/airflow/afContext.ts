/**
 * What every Airflow page reads from the shell: the parsed view, navigation,
 * the one way to run a command, and the confirm dialog. Provided by
 * `AirflowUi.vue`, injected by each page, so a page never imports the shell.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { PortalResult } from '@/utils/portalKit';
import type { AfConnection, AfDag, AfPool, AfRoute, AfRun, AfTi, AfVariable, AfXcom, AfJob } from './airflow';

export interface RunOptions {
    success?: string;
    quiet?: boolean;
}

export interface ConfirmRequest {
    title: string;
    message: string;
    lines?: string[];
    yes?: string;
    danger?: boolean;
}

/** One row of a right-click menu. */
export interface CtxItem {
    label: string;
    hint?: string;
    danger?: boolean;
    disabled?: boolean;
    divider?: boolean;
    header?: boolean;
    action?: () => void;
}

export interface AfContext {
    version: ComputedRef<string>;
    executor: ComputedRef<string>;
    dags: ComputedRef<AfDag[]>;
    runs: ComputedRef<AfRun[]>;
    tis: ComputedRef<AfTi[]>;
    importErrors: ComputedRef<{ file: string; error: string }[]>;
    connections: ComputedRef<AfConnection[]>;
    variables: ComputedRef<AfVariable[]>;
    pools: ComputedRef<AfPool[]>;
    xcom: ComputedRef<AfXcom[]>;
    slaMisses: ComputedRef<Record<string, any>[]>;
    jobs: ComputedRef<AfJob[]>;
    scheduler: ComputedRef<Record<string, any>>;
    airflowView: ComputedRef<Record<string, any>>;
    clock: ComputedRef<string>;
    busy: ComputedRef<boolean>;
    history: ComputedRef<{ command: string; ok: boolean; at: number }[]>;
    route: Ref<AfRoute>;
    go: (route: AfRoute) => void;
    run: (command: string, options?: RunOptions) => Promise<PortalResult>;
    confirm: (request: ConfirmRequest) => Promise<boolean>;
    /** Open a right-click menu at the pointer. */
    openMenu: (event: MouseEvent, title: string, items: CtxItem[]) => void;
    notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
    refresh: () => void;
    dag: (id: string) => AfDag | undefined;
    runsOf: (dagId: string) => AfRun[];
    tisOf: (dagId: string, runId?: string) => AfTi[];
}

export const AF: InjectionKey<AfContext> = Symbol('airflow');

export function useAf(): AfContext {
    const ctx = inject(AF);
    if (!ctx) throw new Error('Airflow page rendered outside AirflowUi');
    return ctx;
}
