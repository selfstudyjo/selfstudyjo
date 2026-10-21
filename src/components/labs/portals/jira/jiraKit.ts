/**
 * The Jira skin's shared half: what the pages read off the management view,
 * the words Jira uses for the engine's states, and the context every page
 * reaches through `inject`.
 *
 * Plain on purpose (no component in here) so the pages stay small: a page
 * draws, this file decides what a status is called and which command a form
 * stands for. Every command still goes through `cli()` in `portalKit.ts`.
 */
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import { cli, rows, pick, type PortalResult } from '@/utils/portalKit';
import type { ExecOptions } from '../usePortal';

export const SITE = 'https://selfstudy.atlassian.net';
export const PROJECT = { key: 'PLAT', name: 'Platform', board: 1 };

export type PageId = 'timeline' | 'backlog' | 'board' | 'goals' | 'reports'
    | 'risks' | 'incidents' | 'stakeholders' | 'team' | 'issues';

export const PAGE_URL: Record<PageId, string> = {
    timeline: `${SITE}/jira/software/projects/PLAT/boards/1/timeline`,
    backlog: `${SITE}/jira/software/projects/PLAT/boards/1/backlog`,
    board: `${SITE}/jira/software/projects/PLAT/boards/1`,
    goals: `${SITE}/jira/software/projects/PLAT/goals`,
    reports: `${SITE}/jira/software/projects/PLAT/boards/1/reports/velocity`,
    risks: `${SITE}/jira/software/projects/PLAT/list?jql=type%20%3D%20Risk`,
    incidents: `${SITE}/jira/servicedesk/projects/PLAT/incidents`,
    stakeholders: `${SITE}/jira/software/projects/PLAT/pages/stakeholders`,
    team: `${SITE}/jira/people/team/platform-engineering`,
    issues: `${SITE}/jira/software/projects/PLAT/issues`,
};

// ---- the view, typed loosely (a replica a release behind sends less) -----

export interface Issue {
    id: string;
    title: string;
    points: number;
    skill: string;
    value: string;
    status: 'todo' | 'doing' | 'done' | string;
    assignee: string;
    assignee_id: string;
    type: string;
    description: string;
    in_sprint: boolean;
    kr: string;
    done_points: number;
    carried: number;
    cost: number;
    sprint: number | string;
    created: number;
    comments: { sprint: number; author: string; body: string }[];
    events: { sprint: number; seq: number; text: string }[];
    raci: Record<string, string[] | string> | null;
    flagged: boolean;
    labels: string[];
    links: { type: string; key: string }[];
    subtasks: { n: number; title: string; done: boolean }[];
    watching: boolean;
}

export interface Person {
    id: string;
    name: string;
    role: string;
    level: string;
    status: string;
    capacity: number;
    nominal: number;
    availability: string;
    morale: number;
    engagement: number;
    growth: number;
    burnout: number;
    risk: string;
    cadence: string;
    overdue: number;
    feedback: number;
    skills: string;
    skill_levels: Record<string, number>;
    why: string;
    notes: string;
    ramp: number;
    last_1on1: number;
    one_on_ones: { sprint: number; topic: string; note: string; action: string }[];
    feedback_list: { sprint: number; kind: string; situation: string; behaviour: string; impact: string }[];
    rating: Record<string, any>;
    promo: string;
}

export function issues(view: unknown): Issue[] {
    return rows<Issue>(view, 'board').map(row => ({
        ...row,
        type: row.type || 'story',
        description: row.description || '',
        assignee_id: row.assignee_id || '',
        comments: Array.isArray(row.comments) ? row.comments : [],
        flagged: Boolean(row.flagged),
        labels: Array.isArray(row.labels) ? row.labels.map(String) : [],
        links: Array.isArray(row.links) ? row.links : [],
        subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
        watching: Boolean(row.watching),
        events: Array.isArray(row.events) ? row.events : [],
        done_points: Number(row.done_points || 0),
        points: Number(row.points || 0),
    }));
}

export function people(view: unknown, includeGone = false): Person[] {
    return rows<Person>(view, 'team')
        .filter(person => includeGone || person.status !== 'gone')
        .map(person => ({ ...person, skill_levels: person.skill_levels || {},
                          one_on_ones: person.one_on_ones || [],
                          feedback_list: person.feedback_list || [],
                          rating: person.rating || {} }));
}

export function currentSprint(view: unknown) {
    const sprint = pick<Record<string, any>>(view, 'current_sprint', {});
    return {
        n: Number(sprint.n || pick(view, 'stats.sprint', 1)),
        status: String(sprint.status || 'planning'),
        committed: Array.isArray(sprint.committed) ? sprint.committed.map(String) : [],
        committedPoints: Number(sprint.committed_points || pick(view, 'stats.committed', 0)),
        capacity: Number(sprint.capacity ?? pick(view, 'stats.capacity', 0)),
        goal: String(sprint.goal || ''),
    };
}

export function sprintName(n: number): string {
    return `PLAT Sprint ${n}`;
}

// ---- Jira's words for the engine's values -------------------------------

export const STATUS_LABEL: Record<string, string> = {
    todo: 'To Do', doing: 'In Progress', done: 'Done',
};

export const PRIORITY_LABEL: Record<string, string> = {
    high: 'High', medium: 'Medium', low: 'Low',
};

export const TYPE_LABEL: Record<string, string> = {
    story: 'Story', task: 'Task', bug: 'Bug', epic: 'Epic', risk: 'Risk',
    incident: 'Incident', issue: 'Issue', assumption: 'Assumption',
    dependency: 'Dependency', subtask: 'Subtask',
};

export const SKILL_HINT: Record<string, string> = {
    azure: 'azure', terraform: 'terraform', networking: 'networking',
    python: 'python', leadership: 'leadership', data: 'data',
};

/** Jira's issue link types, as the engine spells them (`mgr backlog link --type`). */
export const LINK_TYPES: { value: string; label: string }[] = [
    { value: 'blocks', label: 'blocks' },
    { value: 'is-blocked-by', label: 'is blocked by' },
    { value: 'relates', label: 'relates to' },
    { value: 'duplicates', label: 'duplicates' },
    { value: 'is-duplicated-by', label: 'is duplicated by' },
    { value: 'clones', label: 'clones' },
    { value: 'is-cloned-by', label: 'is cloned by' },
];

export function issueUrl(key: string): string {
    return `${SITE}/browse/${key}`;
}

/** The created key out of `Added PLAT-15 (5 pts, azure): …`. */
export function createdKey(result: PortalResult): string {
    const match = String(result.output || '').match(/\b(PLAT-\d+)\b/);
    return match ? match[1] : '';
}

export function initials(name: string): string {
    const parts = String(name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Jira's avatar backgrounds: a fixed palette chosen by a stable hash. */
const AVATAR_COLOURS = ['#1868DB', '#4C6B1F', '#964AC0', '#A54800', '#206A83',
    '#AE2E24', '#5B7F24', '#803FA5', '#7F5F01', '#0055CC'];

export function avatarColour(seed: string): string {
    let hash = 0;
    for (const char of String(seed || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}

export function sinceLabel(sprints: number): string {
    if (sprints <= 0) return 'This sprint';
    if (sprints === 1) return '1 sprint ago';
    return `${sprints} sprints ago`;
}

/** Build a command; re-exported so pages import one module. */
export { cli };

// ---- the context the shell provides --------------------------------------

export interface JiraContext {
    view: ComputedRef<Record<string, any>>;
    busy: ComputedRef<boolean>;
    exec: (command: string, options?: ExecOptions) => Promise<PortalResult>;
    openIssue: (key: string) => void;
    openCreate: (preset?: Record<string, any>) => void;
    go: (page: PageId) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    flag: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
    showOutput: (title: string, output: string) => void;
    search: Ref<string>;
    /** The dialogs any page's card menu opens (labels, link issue, flag). */
    openDialog: (kind: IssueDialogKind, key: string) => void;
    /** A right-click menu at the pointer, shared by every page. */
    openMenu: (event: MouseEvent, items: DropMenuItem[], onSelect: (value: string) => void) => void;
    /** The JQL a page wants the Issues page to open with. */
    jql: Ref<string>;
}

export type IssueDialogKind = 'labels' | 'link' | 'flag';

export interface DropMenuItem {
    label: string;
    value: string;
    disabled?: boolean;
    hint?: string;
    danger?: boolean;
    section?: string;
}

export interface ConfirmOptions {
    title: string;
    body: string;
    confirm: string;
    danger?: boolean;
    warning?: boolean;
}

export const JIRA: InjectionKey<JiraContext> = Symbol('jira');
