/**
 * Shared by the six QA portals (QA Shop Browser, Mobile Simulator, Postman,
 * Playwright Test, TestRail, Bug Tracker). Plain helpers, no DOM.
 *
 * Every portal writes by running the `qa` / `pytest` / `newman` command a
 * student could type (see ../README.md), built with `cli()` so a typed value
 * is always one argument.
 */
import { cli, pick, rows } from '@/utils/portalKit';

export interface QaElement {
    tag: string; id: string; text: string; label: string; role: string; name: string;
    value: string; testid: string; cls: string; visible: boolean; action: string;
}
export interface QaDevice { name: string; width: number; height: number; platform: string; }
export interface QaPageView {
    path: string; url: string; title: string; device: QaDevice; elements: QaElement[];
    user: string | null; cart_count: number; recording: boolean; steps: any[];
    can_back: boolean; devices: QaDevice[]; note?: string; observations?: string[];
}

export function pageOf(view: unknown): QaPageView | null {
    const page = pick<QaPageView | null>(view, 'browser', null);
    return page && Array.isArray(page.elements) ? page : null;
}

export function devicesOf(view: unknown): QaDevice[] {
    return rows<QaDevice>(view, 'devices');
}

/** The commands a page interaction needs: the dirty fills, then the click. */
export function uiCommands(fills: Record<string, string>, clickId: string): string[] {
    const out = Object.entries(fills).map(([id, value]) => cli(['qa', 'ui', 'fill', id, value]));
    if (clickId) out.push(cli(['qa', 'ui', 'click', clickId]));
    return out;
}

export const STATUS_LABEL: Record<string, string> = {
    new: 'New', triaged: 'Triaged', in_progress: 'In Progress', fixed: 'Fixed',
    verified: 'Verified', closed: 'Closed', reopened: 'Reopened', deferred: 'Deferred',
    rejected: 'Rejected', duplicate: 'Duplicate',
};

export function relTime(index: number): string {
    return index === 0 ? 'latest' : `${index} run${index === 1 ? '' : 's'} ago`;
}

export function prettyJson(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
