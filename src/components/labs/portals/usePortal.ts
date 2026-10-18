/**
 * One portal's actions: run a command, report the outcome, remember it.
 *
 * HEADLESS ON PURPOSE. Every product announces an outcome in its own way — the
 * AWS console with a green flashbar across the top, the Azure portal with a
 * toast from the bell, Jira with a flag in the bottom-left, ServiceNow with a
 * message under the banner — and a portal that reported success in a shared
 * platform toast would stop looking like the product the student is learning.
 * So this owns the STATE (what is running, what happened, what was sent) and
 * each skin draws it.
 *
 * Three rules that are easy to break and silent when broken:
 *
 * **A failure is never swallowed.** Every exec returns the result AND, unless
 * the caller handles it (`quiet`), pushes an error flash carrying the engine's
 * own message. A form that closes and does nothing is the commonest way a
 * simulated console reads as broken.
 *
 * **The command is always recorded, failed or not.** The history is the
 * "equivalent CLI" strip under every portal — the half of the feature that
 * teaches — and a failed command is the most useful line in it.
 *
 * **Busy is a count, not a boolean.** Two actions in flight (a delete fired
 * while a list refresh runs) must not have the first one's completion clear the
 * spinner of the second.
 */
import { computed, ref } from 'vue';
import { errorText, type PortalPayload, type PortalResult, type PortalRun } from '@/utils/portalKit';

export type FlashType = 'success' | 'error' | 'info' | 'warning' | 'progress';

export interface PortalFlash {
    id: number;
    type: FlashType;
    title: string;
    detail: string;
    command: string;
}

export interface PortalHistoryEntry {
    id: number;
    command: string;
    surface: string;
    ok: boolean;
    output: string;
    at: number;
}

export interface ExecOptions {
    /** Run the line as a sibling tool would (Fabric's SQL editor, notebook…). */
    surface?: string;
    /** The success flash. Omit for a read; pass '' to suppress it. */
    success?: string;
    /** The error flash's title. Defaults to "The request failed". */
    failure?: string;
    /** The caller shows the error itself (a form's inline alert). */
    quiet?: boolean;
    /** Not worth a line in the history (a read the portal does on its own). */
    unlogged?: boolean;
}

const MAX_FLASHES = 4;
const MAX_HISTORY = 40;

let seq = 0;

export function usePortal(run: PortalRun) {
    const flashes = ref<PortalFlash[]>([]);
    const history = ref<PortalHistoryEntry[]>([]);
    const pending = ref(0);

    function notify(type: FlashType, title: string, detail = '', command = ''): number {
        const flash: PortalFlash = { id: ++seq, type, title, detail, command };
        flashes.value = [flash, ...flashes.value].slice(0, MAX_FLASHES);
        if (type === 'success' || type === 'info') {
            // A success fades on its own; a failure stays until it is read,
            // because an error that vanishes before it is read is the same as no
            // error at all.
            window.setTimeout(() => dismiss(flash.id), 9000);
        }
        return flash.id;
    }

    function dismiss(id: number) {
        flashes.value = flashes.value.filter(flash => flash.id !== id);
    }

    async function exec(command: string, options: ExecOptions = {}): Promise<PortalResult> {
        const payload: PortalPayload = { command };
        if (options.surface) payload.surface = options.surface;
        pending.value += 1;
        let result: PortalResult;
        try {
            result = await run(payload);
        } catch (error: any) {
            result = { ok: false, error: String(error?.message || error || 'The request failed') };
        } finally {
            pending.value = Math.max(0, pending.value - 1);
        }
        result = result || { ok: false, error: 'The lab service did not answer.' };
        if (!options.unlogged) {
            history.value = [{
                id: ++seq,
                command,
                surface: options.surface || '',
                ok: Boolean(result.ok),
                output: String(result.ok ? result.output || '' : result.error || result.output || ''),
                at: Date.now(),
            }, ...history.value].slice(0, MAX_HISTORY);
        }
        if (!result.ok && !options.quiet) {
            notify('error', options.failure || 'The request failed', errorText(result), command);
        } else if (result.ok && options.success) {
            notify('success', options.success, '', command);
        }
        return result;
    }

    return {
        flashes,
        history,
        pending,
        busy: computed(() => pending.value > 0),
        exec,
        notify,
        dismiss,
    };
}

export type PortalApi = ReturnType<typeof usePortal>;
