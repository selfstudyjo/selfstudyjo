/**
 * What every Jenkins page reads from the shell: the engine view, navigation,
 * the one way to run a command, and the confirm dialog. Provided by
 * `JenkinsApp.vue`, injected by each page, so a page never imports the shell.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { PortalResult } from '@/utils/portalKit';
import type { Credential, Job, Node, Plugin, Route } from './jenkinsKit';

export interface RunOptions {
    /** The green notification bar text; omit for a read. */
    success?: string;
    /** The page shows the error itself. */
    quiet?: boolean;
    /** A read the portal does on its own: not worth a line in the CLI strip. */
    unlogged?: boolean;
    /** Speak as the portal itself (needed for a structured `data` answer, which the console's shell does not carry). */
    direct?: boolean;
}

export interface ConfirmRequest {
    title: string;
    message?: string;
    yes?: string;
    destructive?: boolean;
}

export interface JkContext {
    view: Ref<Record<string, any>>;
    jobs: ComputedRef<Job[]>;
    nodes: ComputedRef<Node[]>;
    credentials: ComputedRef<Credential[]>;
    plugins: ComputedRef<Plugin[]>;
    branch: ComputedRef<string>;
    user: ComputedRef<string>;
    base: ComputedRef<string>;
    now: Ref<number>;
    busy: ComputedRef<boolean>;
    route: Ref<Route>;
    go: (route: Route) => void;
    run: (command: string, options?: RunOptions) => Promise<PortalResult>;
    confirm: (request: ConfirmRequest) => Promise<boolean>;
    notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
    job: (name: string) => Job | undefined;
}

export const JK: InjectionKey<JkContext> = Symbol('jenkins');

export function useJk(): JkContext {
    const ctx = inject(JK);
    if (!ctx) throw new Error('Jenkins page rendered outside JenkinsApp');
    return ctx;
}
