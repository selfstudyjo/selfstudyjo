/**
 * What every Control Center page reads from the shell: the parsed view,
 * navigation, the one way to run a command, and the confirm dialog. Provided by
 * `ControlCenter.vue`, injected by each page.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { PortalResult } from '@/utils/portalKit';
import type { CcBroker, CcConnector, CcGroup, CcKsql, CcRoute, CcSubject, CcTopic } from './confluent';

export interface RunOptions {
    success?: string;
    quiet?: boolean;
    unlogged?: boolean;
}

export interface ConfirmRequest {
    title: string;
    message: string;
    yes?: string;
    danger?: boolean;
    /** When set, the user must type this text to enable the confirm button. */
    typeToConfirm?: string;
}

/** One entry of a row's actions menu ("..." button or right-click). */
export interface CcMenuItem {
    label?: string;
    icon?: string;
    danger?: boolean;
    disabled?: boolean;
    divider?: boolean;
    run?: () => void;
}

export interface CcContext {
    installed: ComputedRef<boolean>;
    clusterId: ComputedRef<string>;
    version: ComputedRef<string>;
    brokers: ComputedRef<CcBroker[]>;
    topics: ComputedRef<CcTopic[]>;
    groups: ComputedRef<CcGroup[]>;
    subjects: ComputedRef<CcSubject[]>;
    connectors: ComputedRef<CcConnector[]>;
    plugins: ComputedRef<string[]>;
    registryCompat: ComputedRef<string>;
    producer: ComputedRef<Record<string, any>>;
    ksql: ComputedRef<CcKsql>;
    busy: ComputedRef<boolean>;
    route: Ref<CcRoute>;
    go: (route: CcRoute) => void;
    run: (command: string, options?: RunOptions) => Promise<PortalResult>;
    confirm: (request: ConfirmRequest) => Promise<boolean>;
    notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
    /** Open the actions menu at a right-click, or under the "..." button that was clicked. */
    menu: (event: MouseEvent, items: CcMenuItem[]) => void;
    topic: (name: string) => CcTopic | undefined;
    subject: (name: string) => CcSubject | undefined;
}

export const CC: InjectionKey<CcContext> = Symbol('control-center');

export function useCc(): CcContext {
    const ctx = inject(CC);
    if (!ctx) throw new Error('Control Center page rendered outside ControlCenter');
    return ctx;
}
