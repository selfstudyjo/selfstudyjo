/**
 * What every MLflow page reads from the shell: the parsed view, navigation,
 * the one way to run a command, and the confirm dialog. Provided by
 * `MlflowUi.vue`, injected by each page, so a page never imports the shell.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { cli, type PortalFlagValue, type PortalResult, type PortalValue } from '@/utils/portalKit';
import type { MfEval, MfExperiment, MfModel, MfRoute, MfRun, MfServing } from './mlflow';

export interface RunOptions {
    success?: string;
    quiet?: boolean;
}

export interface ConfirmRequest {
    title: string;
    message: string;
    yes?: string;
    danger?: boolean;
}

/** One entry of a row menu (the "⋮" button, or a right-click on the row). */
export interface MenuItem {
    label?: string;
    icon?: string;
    hint?: string;
    title?: string;
    danger?: boolean;
    disabled?: boolean;
    divider?: boolean;
    heading?: string;
    action?: () => void;
}

export interface MfContext {
    version: ComputedRef<string>;
    experiments: ComputedRef<MfExperiment[]>;
    runs: ComputedRef<MfRun[]>;
    models: ComputedRef<MfModel[]>;
    evals: ComputedRef<MfEval[]>;
    serving: ComputedRef<MfServing[]>;
    now: Ref<number>;
    busy: ComputedRef<boolean>;
    route: Ref<MfRoute>;
    go: (route: MfRoute) => void;
    run: (command: string, options?: RunOptions) => Promise<PortalResult>;
    confirm: (request: ConfirmRequest) => Promise<boolean>;
    notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
    experiment: (id: string) => MfExperiment | undefined;
    findRun: (id: string) => MfRun | undefined;
    model: (name: string) => MfModel | undefined;
    /** Open the shared row menu at the pointer (right-click) or under the clicked button. */
    menu: (event: MouseEvent, items: MenuItem[], label?: string) => void;
    /** Copy to the clipboard and say so, the way MLflow's copy buttons do. */
    copy: (text: string, what: string) => void;
}

export const MF: InjectionKey<MfContext> = Symbol('mlflow');

export function useMf(): MfContext {
    const ctx = inject(MF);
    if (!ctx) throw new Error('MLflow page rendered outside MlflowUi');
    return ctx;
}

/**
 * An `mlflow ...` command line. Free text (a description, a tag value) goes
 * through `textFlag`, because `cli()` drops an empty value - and an empty
 * description is how a description is CLEARED - and a value starting with a
 * dash would be read as the next option.
 */
export function mlflow(words: PortalValue[], flags: Record<string, PortalFlagValue> = {},
                       text: Record<string, string> = {}): string {
    const extra: string[] = [];
    for (const [flag, value] of Object.entries(text)) {
        if (value === '' || value.startsWith('-')) extra.push(`${flag}=${value}`);
        else flags = { ...flags, [flag]: value };
    }
    return cli(['mlflow', ...words, ...extra], flags);
}

/**
 * Save the tag editor's changes: one `set-tag` per added or changed tag, one
 * `delete-tag` per removed one, as the client API does it. Returns the first
 * error, or '' when every command worked.
 */
export async function applyTags(mf: MfContext, noun: 'runs' | 'experiments' | 'models',
                                target: Record<string, PortalFlagValue>,
                                changes: { set: [string, string][]; remove: string[] }): Promise<string> {
    for (const [key, value] of changes.set) {
        const result = await mf.run(mlflow([noun, 'set-tag'], { ...target, '--key': key }, { '--value': value }), { quiet: true });
        if (!result.ok) return String(result.error || result.output || 'The request failed').trim();
    }
    for (const key of changes.remove) {
        const result = await mf.run(mlflow([noun, 'delete-tag'], { ...target, '--key': key }), { quiet: true });
        if (!result.ok) return String(result.error || result.output || 'The request failed').trim();
    }
    const count = changes.set.length + changes.remove.length;
    if (count) mf.notify('success', 'Tags saved', `${count} tag change${count === 1 ? '' : 's'}`);
    return '';
}
