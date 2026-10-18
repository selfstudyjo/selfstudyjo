/**
 * What every page of the console needs, provided once by `AwsConsole.vue`:
 * the view, the portal API, navigation, and the region/account it is in.
 */
import { inject, provide, type ComputedRef, type InjectionKey } from 'vue';
import type { PortalApi } from '../usePortal';
import type { PortalResult } from '@/utils/portalKit';
import type { Route, ServiceId } from './nav';

export interface AwsCtx {
    view: ComputedRef<Record<string, any>>;
    api: PortalApi;
    region: ComputedRef<string>;
    account: ComputedRef<string>;
    busy: ComputedRef<boolean>;
    route: ComputedRef<Route>;
    go(route: Route): void;
    to(svc: ServiceId, page: string, params?: Record<string, string>): void;
    /** Run a command; resolves after the view refreshed. */
    run(command: string, success?: string, options?: { quiet?: boolean; unlogged?: boolean }): Promise<PortalResult>;
}

const KEY: InjectionKey<AwsCtx> = Symbol('aws-console');

export function provideAws(ctx: AwsCtx) {
    provide(KEY, ctx);
}

export function useAws(): AwsCtx {
    const ctx = inject(KEY);
    if (!ctx) throw new Error('useAws() outside the AWS console');
    return ctx;
}

/** "2026-10-18T08:15:57Z" -> "October 18, 2026, 08:15:57 (UTC)" as the console prints. */
export function awsDate(stamp: unknown): string {
    const text = String(stamp || '');
    const date = new Date(text);
    if (!text || Number.isNaN(date.getTime())) return '-';
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}, `
        + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} (UTC)`;
}

/** Bytes as the S3 console prints them: "18.0 B", "2.1 KB". */
export function bytes(size: unknown): string {
    const n = Number(size) || 0;
    if (n < 1024) return `${n.toFixed(1)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
