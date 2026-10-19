/**
 * What every Snowsight page reads from the shell: the parsed view, navigation,
 * the one way to run a statement, the worksheets, and the confirm dialog.
 * Provided by `Snowsight.vue`, injected by each page.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { PortalResult } from '@/utils/portalKit';
import type { Profile, SfCurrent, SfGrid, SfRoute } from './snowflake';

export interface RunOptions {
    success?: string;
    failure?: string;
    quiet?: boolean;
    unlogged?: boolean;
}

export interface ConfirmRequest {
    title: string;
    message: string;
    yes?: string;
    danger?: boolean;
    /** Snowsight's "type the name to confirm" for dropping a database or warehouse. */
    typeToConfirm?: string;
}

/** One statement's outcome, kept so the result pane and the profile survive navigation. */
export interface QueryResult {
    id: number;
    sql: string;
    ok: boolean;
    error: string;
    grids: SfGrid[];
    output: string;
    queryId: string;
    profile: Profile | null;
    elapsedMs: number | null;
    at: number;
}

export interface Worksheet {
    id: number;
    name: string;
    sql: string;
    created: number;
    modified: number;
    lastResult: QueryResult | null;
    folder?: string;
}

export interface SfContext {
    view: ComputedRef<Record<string, any>>;
    current: ComputedRef<SfCurrent>;
    busy: ComputedRef<boolean>;
    route: Ref<SfRoute>;
    go: (route: SfRoute) => void;
    /** Run Snowflake SQL on the Worksheet surface. */
    sql: (statement: string, options?: RunOptions) => Promise<PortalResult>;
    /** Run SQL and capture the outcome as a worksheet result. */
    query: (statement: string, options?: RunOptions) => Promise<QueryResult>;
    confirm: (request: ConfirmRequest) => Promise<boolean>;
    notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
    worksheets: Ref<Worksheet[]>;
    openWorksheet: (sql?: string, name?: string) => Worksheet;
    /** Profiles of queries run in this session, by query id. */
    profiles: Ref<Record<string, Profile>>;
    /** Switch the session role / warehouse (USE ROLE / USE WAREHOUSE). */
    useRole: (role: string) => Promise<boolean>;
    useWarehouse: (warehouse: string) => Promise<boolean>;
    /** Open one of the shared create dialogs ("+ Create" and every page's Create button). */
    create: (kind: CreateKind, defaults?: Record<string, string>) => void;
}

export type CreateKind = 'database' | 'schema' | 'table' | 'view' | 'stage' | 'file-format' | 'warehouse'
    | 'role' | 'user' | 'monitor' | 'masking-policy' | 'row-access-policy' | 'stream' | 'task' | 'pipe';

export const SF: InjectionKey<SfContext> = Symbol('snowsight');

export function useSf(): SfContext {
    const ctx = inject(SF);
    if (!ctx) throw new Error('Snowsight page rendered outside Snowsight');
    return ctx;
}
