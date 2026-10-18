/**
 * What every page of the console needs, provided once by `AwsOpsConsole.vue`.
 *
 * `run` sends the command line through the SAME surface as the Ops console
 * (`ops_console`), so the lab log - and every `command_*` task check - records
 * exactly what a student typing it would have produced.
 */
import { inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { PortalApi } from '../usePortal';
import type { PortalResult } from '@/utils/portalKit';
import type { Route, ServiceId } from './nav';

export interface RunOptions {
    quiet?: boolean;
    unlogged?: boolean;
    failure?: string;
}

export interface OpsCtx {
    /** The whole cloudops view (for the summary keys). */
    view: ComputedRef<Record<string, any>>;
    /** `view.console` - the portal's read model. */
    c: ComputedRef<Record<string, any>>;
    api: PortalApi;
    /** The region selected in the top bar (the estate lives in `home`). */
    region: Ref<string>;
    home: ComputedRef<string>;
    account: ComputedRef<string>;
    busy: ComputedRef<boolean>;
    route: ComputedRef<Route>;
    go(route: Route): void;
    to(svc: ServiceId, page: string, params?: Record<string, string>): void;
    run(command: string, success?: string, options?: RunOptions): Promise<PortalResult>;
}

const KEY: InjectionKey<OpsCtx> = Symbol('aws-ops-console');

export function provideOps(ctx: OpsCtx) {
    provide(KEY, ctx);
}

export function useOps(): OpsCtx {
    const ctx = inject(KEY);
    if (!ctx) throw new Error('useOps() outside the AWS console');
    return ctx;
}
