/**
 * The playgrounds: one free-practice workspace per tool (app 11).
 *
 * A plain module - no Vue, no DOM, no service imports - on the
 * `labCatalogue.ts` / `appNav.ts` precedent: the menu in the top bar and the
 * `/playgrounds` page both draw from these decisions, and both have to agree
 * on what a group is called, in which order the groups come, and what a search
 * matches.
 *
 * WHAT A PLAYGROUND IS. A lab RECORD that is not a lab: app 11's `play-<tool>`
 * rows are unpublished, task-less workspaces (the `carla-studio` precedent),
 * so every student gets their own saved environment for that tool - files,
 * consoles, query editors, dashboards and the product PORTAL - with nothing
 * graded and nothing recorded. `/playground/:playgroundId` renders the lab
 * workspace in playground mode over it.
 *
 * Two entries are not records here and never will be: the Network Simulator's
 * studio and the Self-Driving Studio already ARE free-practice workspaces with
 * routes of their own, so the menu links to them (`LINKED`) rather than
 * growing a second copy of either.
 */
import { matches, field, byField } from '@/i18n/records';
import type { Translatable, TranslationMap } from '@/i18n/records';
import type { LocaleId } from '@/i18n/locales';

/** The menu's groups, in the order they are drawn. Matches app 11's GROUPS. */
export const GROUPS = [
    'cloud', 'data', 'devops', 'programming', 'web', 'ai', 'management',
    'networking',
] as const;

export type PlaygroundGroup = typeof GROUPS[number];

/**
 * The group headings, as English catalogue KEYS. Reached through a variable
 * (`$t(GROUP_LABELS[g])`), so the i18n check imports this table rather than
 * finding the literals in a template - the sidebar's labels are the precedent.
 */
export const GROUP_LABELS: Record<PlaygroundGroup, string> = {
    cloud: 'Cloud',
    data: 'Data',
    devops: 'DevOps',
    programming: 'Programming',
    web: 'Web & mobile',
    ai: 'AI',
    management: 'Management',
    networking: 'Networking',
};

export interface PlaygroundTool {
    id: string;
    label: string;
    kind: string;
    icon: string;
    simulated: boolean;
}

export interface Playground extends Translatable {
    id: string;
    title: string;
    summary: string;
    track: string;
    group: PlaygroundGroup | string;
    icon: string;
    order: number;
    tools: PlaygroundTool[];
    try?: Array<{ tool: string; line: string }>;
    translations?: TranslationMap;
    /** Set on a LINKED entry: the route it opens instead of `/playground/:id`. */
    route?: string;
}

/**
 * The two free-practice workspaces that already have a route of their own.
 * Interface text, so their titles are English catalogue keys (translated in
 * `messages/<id>/playground.ts`), not record translations.
 */
export const LINKED: Playground[] = [
    {
        id: 'netsim-studio', title: 'Network Simulator',
        summary: 'Build a network of routers, switches and PCs and configure it.',
        track: 'netsim', group: 'networking', icon: 'netsim', order: 1000,
        tools: [], route: '/network-simulator/studio',
    },
    {
        id: 'self-driving-studio', title: 'Self-Driving Studio',
        summary: 'Write CARLA Python, run it, watch it drive a 3D city.',
        track: 'carla', group: 'ai', icon: 'car', order: 1000,
        tools: [], route: '/simulator',
    },
];

/** Where an entry opens. A record is `/playground/<id>`; a linked one its route. */
export function playgroundHref(row: Playground): string {
    return row.route || `/playground/${encodeURIComponent(row.id)}`;
}

/** Is this a `play-*` id, as the route accepts? Anything else is not opened. */
export function isPlaygroundId(id: string): boolean {
    return /^play-[a-z0-9][a-z0-9-]{0,40}$/.test(String(id || ''));
}

/**
 * A search matches the title and summary in EVERY language the record carries,
 * plus its tool labels - "kubectl", "pgAdmin" and "Snowsight" are how people
 * look for these, and none of them is in a title.
 */
export function matchesPlayground(row: Playground, query: string, extra = ''): boolean {
    const q = (query || '').trim().toLowerCase();
    if (!q) return true;
    if (matches(row, ['title', 'summary'], q)) return true;
    const hay = [row.id, row.group, extra, ...(row.tools || []).map(t => `${t.label} ${t.id}`)]
        .join(' ').toLowerCase();
    return hay.includes(q);
}

export interface GroupedPlaygrounds {
    group: PlaygroundGroup;
    label: string;
    rows: Playground[];
}

/**
 * Rows grouped in `GROUPS` order, each group ordered by the backend's own
 * `order` and then by DISPLAYED title (a total order, so the grid cannot
 * reshuffle under somebody typing in the filter box). An empty group is
 * dropped: a heading with nothing under it reads as a list that failed to load.
 * A row whose group this build does not know is filed under DevOps rather than
 * lost.
 *
 * `extra(row)` lets the caller add the LINKED entries' translated titles to
 * the haystack, since those are catalogue keys rather than record fields.
 */
export function groupPlaygrounds(
    rows: Playground[],
    query: string,
    locale: LocaleId,
    extra: (row: Playground) => string = () => '',
): GroupedPlaygrounds[] {
    const byTitle = byField<Playground>('title', locale);
    const known = new Set<string>(GROUPS);
    const buckets = new Map<PlaygroundGroup, Playground[]>();
    for (const row of rows) {
        if (!matchesPlayground(row, query, extra(row))) continue;
        const group = (known.has(String(row.group)) ? row.group : 'devops') as PlaygroundGroup;
        if (!buckets.has(group)) buckets.set(group, []);
        buckets.get(group)!.push(row);
    }
    const out: GroupedPlaygrounds[] = [];
    for (const group of GROUPS) {
        const list = buckets.get(group);
        if (!list || !list.length) continue;
        list.sort((a, b) => (a.order - b.order) || byTitle(a, b) || a.id.localeCompare(b.id));
        out.push({ group, label: GROUP_LABELS[group], rows: list });
    }
    return out;
}

/** The record list plus the linked studios, each once. */
export function withLinked(rows: Playground[]): Playground[] {
    const ids = new Set(rows.map(r => r.id));
    return [...rows, ...LINKED.filter(r => !ids.has(r.id))];
}

/** The displayed title of a record, falling back to its id. */
export function titleIn(row: Playground, locale: LocaleId): string {
    return field(row, 'title', locale) || row.id;
}

/** The tools a card lists: the product's own, never the Files tool or tutor. */
export function visibleTools(row: Playground, limit = 6): PlaygroundTool[] {
    return (row.tools || [])
        .filter(t => t.id !== 'terminal' || (row.tools || []).length <= 1)
        .slice(0, limit);
}
