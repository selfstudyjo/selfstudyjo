/**
 * Context menus and the small helpers the explorers share: where a menu opens,
 * OneLake paths (ABFS, URL, relative), file sizes, and copying to the clipboard.
 * Plain TypeScript.
 */
import type { PortalApi } from '../usePortal';

export interface MenuAt { x: number; y: number }

export interface MenuEntry {
  label?: string;
  icon?: string;
  hint?: string;
  title?: string;
  danger?: boolean;
  disabled?: boolean;
  sep?: boolean;
  heading?: boolean;
  action?: () => void;
}

/**
 * The menu's position against the shell's `.fx-body` - the nearest positioned
 * ancestor of every page - from a click on a "..." button or a right-click.
 * Clamped so a menu opened near the right or bottom edge stays inside.
 */
export function menuAt(event: MouseEvent, width = 240, height = 320): MenuAt {
  const target = event.currentTarget as HTMLElement | null;
  const host = (target?.closest('.fx-body') || target?.closest('.fx') || document.body) as HTMLElement;
  const box = host.getBoundingClientRect();
  let x: number;
  let y: number;
  if (event.type === 'contextmenu' || !target) {
    x = event.clientX - box.left;
    y = event.clientY - box.top;
  } else {
    const btn = target.getBoundingClientRect();
    x = btn.left - box.left;
    y = btn.bottom - box.top + 2;
  }
  x = Math.max(4, Math.min(x, box.width - width - 4));
  y = Math.max(4, Math.min(y, box.height - Math.min(height, box.height - 8) - 4));
  return { x, y };
}

const ONELAKE = 'onelake.dfs.fabric.microsoft.com';

/** `abfss://ws@onelake.dfs.fabric.microsoft.com/lh.Lakehouse/Files/raw`. */
export function abfsPath(ws: string, item: string, type: string, relative: string): string {
  return `abfss://${ws}@${ONELAKE}/${item}.${type}${relative ? '/' + relative : ''}`;
}

/** `https://onelake.dfs.fabric.microsoft.com/ws/lh.Lakehouse/Files/raw`. */
export function oneLakeUrl(ws: string, item: string, type: string, relative: string): string {
  return `https://${ONELAKE}/${ws}/${item}.${type}${relative ? '/' + relative : ''}`;
}

export function bytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** The extension, upper-cased, the way the Files list shows a type. */
export function fileType(path: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(path);
  return m ? m[1].toUpperCase() : 'File';
}

export async function copyText(api: PortalApi, text: string, what = 'Path'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    api.notify('success', `${what} copied to clipboard`, text);
  } catch {
    api.notify('info', `${what}`, text);
  }
}

/** Lowercase letters, numbers and underscores - what a Load to Tables name may be. */
export function tableName(text: string): string {
  const base = text.replace(/\.[A-Za-z0-9]+$/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return /^[a-z_]/.test(base) ? base : `t_${base}`;
}
