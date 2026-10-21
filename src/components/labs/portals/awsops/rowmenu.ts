/**
 * Right-click menus on table rows: which row was clicked, and the clipboard.
 *
 * The shared Cloudscape table (`../aws/CsTable.vue`) is not this skin's to
 * change, so a page marks the cell it already renders for a row with
 * `data-row="<key>"` and wraps the table in an element listening for
 * `contextmenu`. `rowKey` walks from the click to its `<tr>` and reads the
 * key back - so sorting, filtering and paging inside the table can never
 * make the menu act on a different row than the one under the pointer.
 */
import { ref } from 'vue';

export interface MenuItem {
    id: string;
    text?: string;
    disabled?: boolean;
    disabledReason?: string;
    group?: boolean;
    divider?: boolean;
    nested?: boolean;
    danger?: boolean;
    hint?: string;
}

export function rowKey(event: MouseEvent): string {
    const target = event.target as HTMLElement | null;
    const row = target?.closest?.('tr');
    if (!row || row.closest('thead')) return '';
    const marked = row.querySelector<HTMLElement>('[data-row]');
    return marked?.dataset.row || '';
}

/** State for one right-click menu on a page. */
export function useRowMenu() {
    const menu = ref<{ x: number; y: number; key: string } | null>(null);
    function open(event: MouseEvent, select?: (key: string) => void): boolean {
        const key = rowKey(event);
        if (!key) return false;
        event.preventDefault();
        select?.(key);
        menu.value = { x: event.clientX, y: event.clientY, key };
        return true;
    }
    function close() { menu.value = null; }
    return { menu, open, close };
}

/** Copy text; resolves whether it worked (a sandboxed frame may refuse). */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* fall through */
    }
    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
    } catch {
        return false;
    }
}

/** Save text as a file the browser downloads (no network: a local blob). */
export function downloadText(name: string, text: string, type = 'text/plain'): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
