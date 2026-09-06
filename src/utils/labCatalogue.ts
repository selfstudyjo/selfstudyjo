/**
 * The lab catalogue's browser-side model: grouping, filtering, ordering and the
 * GUI panel spec.
 *
 * A plain module — no Vue, no DOM, no service imports — on the same precedent as
 * `photoMask.ts`, `drawEngine.ts`, `newscastEngine.ts`, `appNav.ts` and
 * `dashboardProgress.ts`, and for the same reason: every decision in here is one
 * nobody can see in a screenshot, and `npm run check:labs` drives it in node in
 * about a second.
 *
 * Three of those decisions are worth stating up front.
 *
 * **A track with no labs is not shown.** The backend serves twelve tracks from
 * its built-in tier and a thirteenth could exist in a repo this build has not
 * heard of, so a card for an empty track is a promise the page cannot keep.
 *
 * **The ordering is total.** The catalogue is re-derived inside a computed that
 * re-evaluates on every keystroke in the filter box, so an unstable sort is a
 * list that visibly reorders itself as somebody types. Same trap `examShuffle.ts`
 * documents for option order and `leaderboardEngine.ts` for its rows.
 *
 * **A GUI is a SPEC, not a component per family.** Seven simulated families with
 * up to four dashboards each would be a dozen near-identical Vue files, and the
 * twelfth would drift from the first. `GUI_PANELS` says which panels a family's
 * dashboard has, where each one's rows come from in the backend's `view` payload,
 * and which columns to draw; `LabGui.vue` renders that. Adding a family is a
 * table entry.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type TaskStatus = 'passed' | 'pending' | 'unavailable';
export type LabStatus = 'not_started' | 'in_progress' | 'completed';

export interface LabTrack {
    id: string;
    title: string;
    subtitle?: string;
    icon?: string;
    order?: number;
    blurb?: string;
    topics?: string[];
    labs?: number;
    repo?: string;
    source?: string;
    /**
     * The three-language copies of the track's own text, when its repo carries
     * them.
     *
     * Declared even though the built-in tracks have none, so `$td(track,
     * 'title')` type-checks - and it is honest: a track's metadata comes from
     * `track.json` in its GitHub repo, which an operator can translate exactly
     * as they translate a course title. `$td` falls back to the record's own
     * English, so an untranslated track renders as it does today.
     */
    translations?: Record<string, Record<string, string>>;
}

export interface LabSummary {
    id: string;
    track: string;
    title: string;
    summary: string;
    difficulty: string;
    minutes: number;
    order: number;
    topics: string[];
    tools: string[];
    tool_labels: string[];
    task_count: number;
    points: number;
    datasets: string[];
    simulated: boolean;
    source: string;
    translations?: Record<string, Record<string, string>>;
}

export interface LabTool {
    id: string;
    label: string;
    kind: 'console' | 'code' | 'query' | 'editor' | 'web' | 'gui'
        | 'preview' | 'mobile' | 'external' | 'ai';
    engine: string;
    icon: string;
    summary: string;
    simulated: boolean;
    prompt: string;
    fidelity: string;
    family: string;
    order: number;
    href?: string;
}

export interface LabTask {
    id: string;
    title: string;
    detail: string;
    hint: string;
    points: number;
    status: TaskStatus;
    note: string;
    requires: string;
    manual: boolean;
}

export interface LabGrade {
    tasks: LabTask[];
    done: number;
    total: number;
    earned: number;
    possible: number;
    percent: number;
    status: LabStatus;
    unavailable: string[];
}

export interface LabProgress {
    lab_id: string;
    track: string;
    status: LabStatus;
    tasks_done: string[];
    score: number;
    earned: number;
    possible: number;
    attempts: number;
    completed_at: string;
    last_active: string;
}

export interface Lab extends LabSummary {
    brief: string;
    objectives: string[];
    tasks: Array<Record<string, unknown>>;
    environment: Record<string, unknown>;
    tool_detail: LabTool[];
    families: string[];
    unknown_tools: string[];
    unreachable_checks: string[];
    resources: Array<{ label?: string; title?: string; url?: string }>;
}

/* ─────────────────── difficulty ─────────────────── */

const DIFFICULTY_RANK: Record<string, number> = {
    beginner: 0,
    intermediate: 1,
    advanced: 2,
};

export function difficultyRank(value: string): number {
    return DIFFICULTY_RANK[String(value || '').toLowerCase()] ?? 1;
}

/** The catalogue's English labels. Keys, so `check:i18n` can prove coverage. */
export const DIFFICULTY_LABELS: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
};

export const STATUS_LABELS: Record<LabStatus, string> = {
    not_started: 'Not started',
    in_progress: 'In progress',
    completed: 'Completed',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
    passed: 'Done',
    pending: 'To do',
    unavailable: 'Cannot be checked',
};

/* ─────────────────── what Check my work says ─────────────────── */

export type GradeToneId = 'good' | 'warn' | 'bad' | 'quiet';

export interface GradeReport {
    tone: GradeToneId;
    /** A catalogue key, so `check:i18n` can prove all three languages cover it. */
    key: string;
    params: Record<string, string | number>;
}

/**
 * The sentence to put under the Check my work button.
 *
 * It exists because the button was SILENT in every one of its outcomes, and
 * that is the whole of "I click Check my work and nothing happens". Three of the
 * four things it can do are invisible:
 *
 *  * the grade did not move — which is the commonest outcome and the one a
 *    student most needs a word about, because the alternative reading is that
 *    the button is broken;
 *  * every task in the lab is SELF-MARKED, so it can never move however much
 *    work has been done. The whole Networking track is like that, and nothing on
 *    screen said so;
 *  * the lab service did not answer. `labsService.gradeLab` swallows a transport
 *    failure on purpose — the tools must keep working when app 11 is cold — so a
 *    dead replica and a passing grade produced the identical nothing.
 *
 * Only the fourth (a task went green) is visible without it, and only if the
 * student happens to be looking at the right row.
 *
 * A REPORT rather than a string: this module has no Vue and no `$t`, and the
 * platform's own rule is that the key is the English text. The view spends it.
 */
export function gradeReport(
    before: LabGrade | null,
    after: LabGrade | null,
): GradeReport {
    if (!after) {
        return { tone: 'bad', key: 'The lab service did not answer. Nothing has been lost — try again in a moment.', params: {} };
    }
    const gained = after.done - (before?.done ?? 0);
    if (after.total > 0 && after.done === after.total) {
        return { tone: 'good', key: 'Every task is done. {v0} of {v1} points.', params: { v0: after.earned, v1: after.possible } };
    }
    if (gained > 0) {
        return { tone: 'good', key: '{v0} more done — {v1} of {v2} now.', params: { v0: gained, v1: after.done, v2: after.total } };
    }
    if (after.unavailable.length > 0 && after.unavailable.length === after.total) {
        return { tone: 'bad', key: 'This lab cannot be checked on this replica. Tell an operator.', params: {} };
    }
    // The environment lost something a task had already passed on — a reset, or
    // a container removed. Reported BEFORE the self-marked case, and before
    // "nothing new": both of those read as "carry on", and this one is the
    // student's work having gone backwards, which is the thing to say first.
    if (gained < 0) {
        return { tone: 'warn', key: 'Some work is no longer in your environment — {v0} of {v1} now.', params: { v0: after.done, v1: after.total } };
    }
    // Nothing moved. WHY it could not move is the useful half.
    //
    // Guarded on `tasks.length`, never on `total`: `[].every()` is TRUE, so a
    // lab that answered with a count and an empty task list would be told every
    // task in it is self-marked. `total` is meant to equal `tasks.length` and a
    // guard that only holds while two fields agree is a guard about the wrong
    // thing.
    if (after.tasks.length > 0 && after.tasks.every(task => task.manual)) {
        return { tone: 'quiet', key: 'Every task here is marked by you. Tick "I have done this" as you finish each one.', params: {} };
    }
    return { tone: 'warn', key: 'Nothing new yet — still {v0} of {v1}. Open a task for its hint.', params: { v0: after.done, v1: after.total } };
}

/** Every sentence `gradeReport` can answer with, so `check:i18n` sees them all. */
export const GRADE_REPORT_KEYS = [
    'The lab service did not answer. Nothing has been lost — try again in a moment.',
    'Every task is done. {v0} of {v1} points.',
    '{v0} more done — {v1} of {v2} now.',
    'This lab cannot be checked on this replica. Tell an operator.',
    'Every task here is marked by you. Tick "I have done this" as you finish each one.',
    'Some work is no longer in your environment — {v0} of {v1} now.',
    'Nothing new yet — still {v0} of {v1}. Open a task for its hint.',
];

/* ─────────────────── ordering and grouping ─────────────────── */

/**
 * Tracks in reading order, dropping the empty ones.
 *
 * `order` first, then the id — a TOTAL order, so two tracks that forgot to set
 * `order` do not swap places between renders.
 */
export function sortTracks(tracks: LabTrack[]): LabTrack[] {
    return [...(tracks || [])]
        .filter(track => (track.labs ?? 0) > 0)
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.id.localeCompare(b.id));
}

/**
 * Labs in reading order within a track: the lab's own `order`, then difficulty,
 * then the id. Difficulty is the tie-break rather than the primary key on
 * purpose — a track's author has put the labs in a teaching sequence, and
 * sorting by difficulty would reorder a course.
 */
export function sortLabs(labs: LabSummary[]): LabSummary[] {
    return [...(labs || [])].sort((a, b) =>
        (a.order ?? 0) - (b.order ?? 0)
        || difficultyRank(a.difficulty) - difficultyRank(b.difficulty)
        || a.id.localeCompare(b.id));
}

export interface TrackGroup {
    track: LabTrack;
    labs: LabSummary[];
    completed: number;
    started: number;
    minutes: number;
    points: number;
}

/**
 * The catalogue as the page draws it: one group per track, with the reader's own
 * progress folded in.
 *
 * Progress is folded in HERE rather than in the view because the counts are what
 * a track card leads with, and a view computing them inline would recompute them
 * for every card on every keystroke.
 */
export function groupByTrack(
    tracks: LabTrack[],
    labs: LabSummary[],
    progress: LabProgress[] = [],
): TrackGroup[] {
    const byLab = new Map<string, LabProgress>();
    for (const row of progress || []) {
        if (row?.lab_id) byLab.set(row.lab_id, row);
    }
    const groups: TrackGroup[] = [];
    for (const track of sortTracks(tracks)) {
        const inTrack = sortLabs((labs || []).filter(lab => lab.track === track.id));
        if (inTrack.length === 0) continue;
        let completed = 0;
        let started = 0;
        let points = 0;
        for (const lab of inTrack) {
            const row = byLab.get(lab.id);
            if (!row) continue;
            started += 1;
            if (row.status === 'completed') completed += 1;
            points += Number(row.earned || 0);
        }
        groups.push({
            track: { ...track, labs: inTrack.length },
            labs: inTrack,
            completed,
            started,
            points,
            minutes: inTrack.reduce((total, lab) => total + Number(lab.minutes || 0), 0),
        });
    }
    return groups;
}

/**
 * Filter the catalogue by a free-text query.
 *
 * Matches the title, the summary, the track, the topics AND the tool labels —
 * the last of those because "docker" and "kubectl" are how somebody looks for a
 * lab, and neither is necessarily in a title. Every language the record carries
 * is searched too, for the reason `records.ts` gives: a reader looking at an
 * Arabic list types Arabic, and the same person describing it to a colleague
 * types English, so a search that only matched the rendered language would
 * silently stop finding things when they change a setting.
 */
export function filterLabs(labs: LabSummary[], query: string): LabSummary[] {
    const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return labs || [];
    return (labs || []).filter(lab => {
        const haystack = [
            lab.id, lab.title, lab.summary, lab.track, lab.difficulty,
            ...(lab.topics || []),
            ...(lab.tool_labels || []),
            ...(lab.tools || []),
            ...Object.values(lab.translations || {}).flatMap(
                entry => Object.values(entry || {})),
        ].join(' ').toLowerCase();
        return terms.every(term => haystack.includes(term));
    });
}

/* ─────────────────── progress ─────────────────── */

export function progressFor(
    labId: string, progress: LabProgress[],
): LabProgress | null {
    return (progress || []).find(row => row?.lab_id === labId) || null;
}

export interface ProgressSummary {
    started: number;
    completed: number;
    points: number;
    tasks: number;
    /** null, never 0, when nothing has been attempted. See below. */
    percent: number | null;
}

/**
 * The reader's own totals.
 *
 * `percent` is `null` rather than `0` when nothing has been started, and that is
 * the same call `dashboardProgress.ts` makes: reporting 0% is not a softer
 * version of "no data", it is a specific claim that they achieved nothing, drawn
 * as an empty ring on their own first day.
 */
export function summariseProgress(progress: LabProgress[]): ProgressSummary {
    const rows = progress || [];
    const earned = rows.reduce((total, row) => total + Number(row.earned || 0), 0);
    const possible = rows.reduce((total, row) => total + Number(row.possible || 0), 0);
    return {
        started: rows.length,
        completed: rows.filter(row => row.status === 'completed').length,
        points: earned,
        tasks: rows.reduce((total, row) => total + (row.tasks_done?.length || 0), 0),
        percent: possible > 0 ? Math.round((100 * earned) / possible) : null,
    };
}

/* ─────────────────── tools ─────────────────── */

/**
 * A lab's tools grouped into PANES, one per family, in reading order.
 *
 * A Big Data lab lists nine tools across one family; drawn as nine tabs the tab
 * bar is unreadable, and drawn as one pane with the console and its four
 * dashboards inside it, it is a workbench. That grouping is the whole reason
 * `family` exists on the tool record.
 */
export interface ToolPane {
    family: string;
    label: string;
    icon: string;
    simulated: boolean;
    tools: LabTool[];
    primary: LabTool;
}

const FAMILY_LABELS: Record<string, string> = {
    shell: 'Terminal & Files',
    python: 'Python',
    sql: 'SQL',
    web: 'Web',
    docker: 'Docker',
    kubernetes: 'Kubernetes',
    hadoop: 'Big Data',
    aws: 'AWS',
    azure: 'Azure',
    terraform: 'Terraform',
    git: 'Git',
    ansible: 'Ansible',
    jenkins: 'Jenkins',
    puppet: 'Puppet',
    chef: 'Chef',
    netsim: 'Network Simulator',
    django: 'Django',
    flask: 'Flask',
    ionic: 'Ionic',
    // `cowork` and `claudecode` are one ENGINE and two families, so the pane
    // is labelled for the product a student is learning rather than for the
    // implementation. See `view_families_for` in app 11's `utils/labtools.py`
    // for the half that makes the payload answer to both names.
    claudeapi: 'Claude API',
    // A THIRD Claude-adjacent family and not a surface of either of the
    // two below it: what its labs are about is the WIRE between a client
    // and a server rather than anybody's product.
    mcp: 'Model Context Protocol',
    claudecode: 'Claude Code',
    cowork: 'Claude Cowork',
    ai: 'AI Tutor',
};

export function familyLabel(family: string): string {
    return FAMILY_LABELS[family] || family;
}

/** Every family label is a catalogue key, so `check:i18n` can prove coverage. */
export const FAMILY_LABEL_KEYS = Object.values(FAMILY_LABELS);

export function toolPanes(tools: LabTool[]): ToolPane[] {
    const order = [...(tools || [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)
        || a.id.localeCompare(b.id));
    const panes = new Map<string, ToolPane>();
    for (const tool of order) {
        const family = tool.family || tool.id;
        let pane = panes.get(family);
        if (!pane) {
            pane = {
                family,
                label: familyLabel(family),
                icon: tool.icon,
                simulated: false,
                tools: [],
                primary: tool,
            };
            panes.set(family, pane);
        }
        pane.tools.push(tool);
        // A pane is "simulated" if ANY of its tools is - a Docker pane with a
        // real Files tool beside it is still a simulated Docker.
        if (tool.simulated) pane.simulated = true;
    }
    return [...panes.values()];
}

/**
 * The two families that are SUPPORTING tools rather than the subject of a lab.
 *
 * `shell` is the Files browser and the real terminal, and `ai` is the tutor.
 * Almost every lab in the catalogue carries one or both, and both sort ahead of
 * the lab's own tool on the global `order` — `editor` is 4 and `web` is 5 — so
 * "the first pane" is the wrong answer to "what is this lab about" for a large
 * part of the catalogue.
 */
export const AUX_FAMILIES = ['shell', 'ai'];

/**
 * Which pane a lab OPENS on.
 *
 * Not `panes[0]`, and that was the bug: a web lab opened on an empty file
 * browser and a networking lab opened on an empty file browser, because
 * `toolPanes` orders by each tool's global `order` and the supporting tools sort
 * first. What a student sees on opening `web-01-html` should be the web
 * playground, and on `net-01-addressing` the Network Simulator — the thing the
 * lab is named after.
 *
 * It answers a family rather than an index so a caller cannot hold a stale
 * position across a lab change, and it falls back to the first pane and then to
 * the brief, because a lab whose only tool is the tutor is a lab that still has
 * to render.
 */
export function defaultPane(panes: ToolPane[]): string {
    const rows = panes || [];
    const subject = rows.find(pane => AUX_FAMILIES.indexOf(pane.family) < 0);
    return (subject || rows[0])?.family || '__brief';
}

/**
 * Which `external` tools this build can render IN PLACE rather than link to.
 *
 * An external tool lives in another application — the Network Simulator is app
 * 27's studio — and the first version of the workbench drew a button that
 * navigated away. That loses the lab: the brief, the tasks and the Check my work
 * button are all on the page the student just left, so the one thing the
 * curriculum exists to provide is the thing the link throws away.
 *
 * Keyed on the TOOL ID rather than on a flag from the backend, because whether a
 * component exists in this bundle is a fact about the frontend and app 11 cannot
 * know it. A tool absent from here still renders its link, which is what a build
 * that has not learned to embed it should do.
 */
const EMBEDDABLE: Record<string, true> = { netsim: true };

export function canEmbed(tool: LabTool | null | undefined): boolean {
    return Boolean(tool && tool.kind === 'external' && EMBEDDABLE[tool.id]);
}

/* ─────────────────── the GUI spec ─────────────────── */

export type PanelKind = 'stats' | 'table' | 'cards' | 'tree' | 'log' | 'json';

export interface GuiColumn {
    key: string;
    label: string;
    /** `list` joins an array with commas; `code` renders monospaced. */
    kind?: 'text' | 'list' | 'code' | 'badge' | 'number';
}

export interface GuiPanel {
    id: string;
    title: string;
    kind: PanelKind;
    /** Dotted path into the family's `view` payload. */
    path: string;
    columns?: GuiColumn[];
    /** Which tool id this panel belongs to, so a lab that lists only some of a
     *  family's dashboards gets only those. */
    tool?: string;
    empty?: string;
}

function col(key: string, label: string, kind: GuiColumn['kind'] = 'text'): GuiColumn {
    return { key, label, kind };
}

/**
 * Which panels each simulated family's dashboards draw.
 *
 * `path` is a dotted path into exactly the payload
 * `GET /api/lab-tools/<lab>/views/<user>/` returns for that family, which is the
 * same payload the backend's own `view()` builds — so a panel and the console
 * cannot disagree about what the environment contains. A path that no longer
 * exists renders an empty panel rather than throwing, which is the right
 * degradation for a service that deploys separately from this bundle.
 */
export const GUI_PANELS: Record<string, GuiPanel[]> = {
    docker: [
        { id: 'stats', title: 'Engine', kind: 'stats', path: 'stats', tool: 'docker_gui' },
        {
            id: 'containers', title: 'Containers', kind: 'table', path: 'containers',
            tool: 'docker_gui', empty: 'No containers yet',
            columns: [col('name', 'Name'), col('image', 'Image'),
                col('status', 'Status', 'badge'), col('ports', 'Ports', 'list'),
                col('networks', 'Networks', 'list'), col('uptime', 'Uptime')],
        },
        {
            id: 'images', title: 'Images', kind: 'table', path: 'images',
            tool: 'docker_gui', empty: 'No images pulled yet',
            columns: [col('repository', 'Repository'), col('tag', 'Tag'),
                col('size', 'Size'), col('layers', 'Layers', 'number')],
        },
        {
            id: 'volumes', title: 'Volumes', kind: 'table', path: 'volumes',
            tool: 'docker_gui', empty: 'No volumes',
            columns: [col('name', 'Name'), col('driver', 'Driver'),
                col('used_by', 'Used by', 'list')],
        },
        {
            id: 'networks', title: 'Networks', kind: 'table', path: 'networks',
            tool: 'docker_gui', empty: 'No networks',
            columns: [col('name', 'Name'), col('driver', 'Driver'),
                col('subnet', 'Subnet', 'code'), col('members', 'Containers', 'list')],
        },
    ],
    kubernetes: [
        { id: 'stats', title: 'Cluster', kind: 'stats', path: 'stats', tool: 'k8s_gui' },
        {
            id: 'nodes', title: 'Nodes', kind: 'table', path: 'nodes', tool: 'k8s_gui',
            columns: [col('name', 'Name'), col('role', 'Role'),
                col('status', 'Status', 'badge'), col('version', 'Version'),
                col('ip', 'IP', 'code'), col('pods', 'Pods', 'list')],
        },
        {
            id: 'deployments', title: 'Deployments', kind: 'table',
            path: 'deployments', tool: 'k8s_gui', empty: 'No deployments yet',
            columns: [col('namespace', 'Namespace'), col('name', 'Name'),
                col('ready', 'Ready', 'number'), col('replicas', 'Wanted', 'number'),
                col('images', 'Images', 'list'), col('revision', 'Revision', 'number')],
        },
        {
            id: 'pods', title: 'Pods', kind: 'table', path: 'pods', tool: 'k8s_gui',
            empty: 'No pods yet',
            columns: [col('namespace', 'Namespace'), col('name', 'Name'),
                col('status', 'Status', 'badge'), col('ready', 'Ready'),
                col('node', 'Node'), col('ip', 'IP', 'code'),
                col('reason', 'Reason')],
        },
        {
            id: 'services', title: 'Services', kind: 'table', path: 'services',
            tool: 'k8s_gui', empty: 'No services yet',
            columns: [col('namespace', 'Namespace'), col('name', 'Name'),
                col('type', 'Type', 'badge'), col('cluster_ip', 'Cluster IP', 'code'),
                col('node_port', 'Node port')],
        },
        {
            id: 'config', title: 'ConfigMaps & Secrets', kind: 'table',
            path: 'configmaps', tool: 'k8s_gui', empty: 'No config yet',
            columns: [col('namespace', 'Namespace'), col('name', 'Name'),
                col('keys', 'Keys', 'list')],
        },
        {
            id: 'events', title: 'Events', kind: 'log', path: 'events',
            tool: 'k8s_gui', empty: 'Nothing has happened yet',
        },
    ],
    hadoop: [
        {
            id: 'namenode', title: 'NameNode', kind: 'stats', path: 'namenode',
            tool: 'namenode_gui',
        },
        {
            id: 'datanodes', title: 'DataNodes', kind: 'table', path: 'datanodes',
            tool: 'namenode_gui',
            columns: [col('host', 'Host'), col('ip', 'IP', 'code'),
                col('state', 'State', 'badge'), col('capacity_h', 'Capacity'),
                col('used_h', 'Used'), col('blocks', 'Blocks', 'number')],
        },
        {
            id: 'browser', title: 'Browse HDFS', kind: 'tree', path: 'browser',
            tool: 'namenode_gui',
        },
        {
            id: 'yarn', title: 'ResourceManager', kind: 'stats', path: 'yarn',
            tool: 'yarn_gui',
        },
        {
            id: 'apps', title: 'Applications', kind: 'table', path: 'yarn.apps',
            tool: 'yarn_gui', empty: 'No applications yet',
            columns: [col('id', 'Application'), col('name', 'Name'),
                col('type', 'Type', 'badge'), col('state', 'State', 'badge'),
                col('final', 'Result'), col('containers', 'Containers', 'number')],
        },
        {
            id: 'jobs', title: 'Jobs', kind: 'cards', path: 'spark.jobs',
            tool: 'spark_gui', empty: 'No jobs in the history yet',
        },
        {
            id: 'hive', title: 'Hive metastore', kind: 'table', path: 'hive.tables',
            tool: 'ambari_gui', empty: 'No tables',
            columns: [col('db', 'Database'), col('name', 'Table'),
                col('rows', 'Rows', 'number'), col('format', 'Format'),
                col('external', 'External', 'badge'),
                col('location', 'Location', 'code')],
        },
        {
            id: 'services', title: 'Services', kind: 'table', path: 'ambari.services',
            tool: 'ambari_gui',
            columns: [col('name', 'Service'), col('state', 'State', 'badge'),
                col('health', 'Health', 'badge'), col('metric', 'Metric'),
                col('components', 'Components', 'list')],
        },
        {
            id: 'alerts', title: 'Alerts', kind: 'log', path: 'ambari.alerts',
            tool: 'ambari_gui', empty: 'No alerts',
        },
    ],
    aws: [
        { id: 'stats', title: 'Account', kind: 'stats', path: 'stats', tool: 'aws_gui' },
        {
            id: 'buckets', title: 'S3', kind: 'table', path: 's3.buckets',
            tool: 'aws_gui', empty: 'No buckets',
            columns: [col('name', 'Bucket'), col('region', 'Region'),
                col('objects', 'Objects', 'number'), col('bytes_h', 'Size'),
                col('versioning', 'Versioning', 'badge'), col('arn', 'ARN', 'code')],
        },
        {
            id: 'instances', title: 'EC2', kind: 'table', path: 'ec2.instances',
            tool: 'aws_gui', empty: 'No instances',
            columns: [col('id', 'Instance'), col('name', 'Name'),
                col('type', 'Type'), col('state', 'State', 'badge'),
                col('az', 'Zone'), col('private_ip', 'Private IP', 'code'),
                col('public_ip', 'Public IP', 'code')],
        },
        {
            id: 'vpcs', title: 'VPCs & subnets', kind: 'table', path: 'ec2.vpcs',
            tool: 'aws_gui',
            columns: [col('id', 'VPC'), col('cidr', 'CIDR', 'code'),
                col('default', 'Default', 'badge'), col('subnets', 'Subnets', 'number')],
        },
        {
            id: 'sgs', title: 'Security groups', kind: 'table',
            path: 'ec2.security_groups', tool: 'aws_gui',
            columns: [col('id', 'Group'), col('name', 'Name'), col('vpc', 'VPC'),
                col('description', 'Description')],
        },
        {
            id: 'iam', title: 'IAM roles', kind: 'table', path: 'iam.roles',
            tool: 'aws_gui', empty: 'No roles',
            columns: [col('name', 'Role'), col('arn', 'ARN', 'code'),
                col('policies', 'Policies', 'list')],
        },
        {
            id: 'lambda', title: 'Lambda', kind: 'table', path: 'lambda',
            tool: 'aws_gui', empty: 'No functions',
            columns: [col('name', 'Function'), col('runtime', 'Runtime'),
                col('handler', 'Handler'), col('memory', 'Memory', 'number'),
                col('invocations', 'Invocations', 'number')],
        },
        {
            id: 'data', title: 'DynamoDB & RDS', kind: 'table', path: 'dynamodb',
            tool: 'aws_gui', empty: 'No tables',
            columns: [col('name', 'Table'), col('status', 'Status', 'badge'),
                col('items', 'Items', 'number'), col('billing', 'Billing')],
        },
        {
            id: 'logs', title: 'CloudWatch Logs', kind: 'log', path: 'logs.events',
            tool: 'aws_gui', empty: 'No log events',
        },
    ],
    azure: [
        { id: 'stats', title: 'Subscription', kind: 'stats', path: 'stats',
            tool: 'azure_gui' },
        {
            id: 'groups', title: 'Resource groups', kind: 'table', path: 'groups',
            tool: 'azure_gui', empty: 'No resource groups',
            columns: [col('name', 'Name'), col('location', 'Location'),
                col('resources', 'Resources', 'number'), col('id', 'Id', 'code')],
        },
        {
            id: 'resources', title: 'Resources', kind: 'table', path: 'resources',
            tool: 'azure_gui', empty: 'Nothing created yet',
            columns: [col('name', 'Name'), col('type', 'Type', 'code'),
                col('group', 'Group'), col('location', 'Location'),
                col('detail', 'Detail')],
        },
        {
            id: 'storage', title: 'Storage', kind: 'table', path: 'storage.accounts',
            tool: 'azure_gui', empty: 'No storage accounts',
            columns: [col('name', 'Account'), col('group', 'Group'),
                col('sku', 'SKU'), col('containers', 'Containers', 'number'),
                col('endpoint', 'Endpoint', 'code')],
        },
        {
            id: 'blobs', title: 'Blobs', kind: 'table', path: 'storage.blobs',
            tool: 'azure_gui', empty: 'No blobs',
            columns: [col('container', 'Container'), col('name', 'Blob'),
                col('size_h', 'Size'), col('tier', 'Tier')],
        },
    ],
    terraform: [
        { id: 'stats', title: 'State', kind: 'stats', path: 'stats',
            tool: 'terraform_gui' },
        {
            id: 'resources', title: 'Managed resources', kind: 'table',
            path: 'state.resources', tool: 'terraform_gui',
            empty: 'Nothing in state yet - run terraform apply',
            columns: [col('address', 'Address', 'code'), col('type', 'Type'),
                col('provider', 'Provider', 'badge'), col('id', 'Id', 'code')],
        },
        {
            id: 'plan', title: 'Last plan', kind: 'table', path: 'plan.actions',
            tool: 'terraform_gui', empty: 'No plan yet',
            columns: [col('action', 'Action', 'badge'),
                col('address', 'Address', 'code'), col('type', 'Type')],
        },
        {
            id: 'graph', title: 'Dependencies', kind: 'table', path: 'graph',
            tool: 'terraform_gui', empty: 'No dependencies',
            columns: [col('address', 'Resource', 'code'),
                col('depends_on', 'Depends on', 'list')],
        },
        {
            id: 'outputs', title: 'Outputs', kind: 'table', path: 'outputs',
            tool: 'terraform_gui', empty: 'No outputs',
            columns: [col('name', 'Name'), col('value', 'Value', 'code')],
        },
    ],
    ansible: [
        { id: 'stats', title: 'Control node', kind: 'stats', path: 'stats',
            tool: 'ansible_gui' },
        {
            id: 'hosts', title: 'Managed nodes', kind: 'table', path: 'hosts',
            tool: 'ansible_gui', empty: 'No hosts in this environment',
            columns: [col('name', 'Host'), col('address', 'Address', 'code'),
                col('os', 'Distribution'), col('groups', 'Groups', 'list'),
                col('status', 'Status', 'badge'),
                col('packages', 'Packages', 'number'),
                col('services_running', 'Running', 'number')],
        },
        {
            id: 'groups', title: 'Inventory groups', kind: 'table', path: 'groups',
            tool: 'ansible_gui', empty: 'The inventory declares no groups yet',
            columns: [col('name', 'Group'), col('hosts', 'Hosts', 'list'),
                col('count', 'Size', 'number'), col('vars', 'Variables', 'number')],
        },
        {
            id: 'services', title: 'Services', kind: 'table', path: 'services',
            tool: 'ansible_gui', empty: 'Nothing has been installed yet',
            columns: [col('host', 'Host'), col('name', 'Unit'),
                col('state', 'State', 'badge'), col('enabled', 'At boot', 'badge')],
        },
        {
            id: 'packages', title: 'Packages', kind: 'table', path: 'packages',
            tool: 'ansible_gui', empty: 'Nothing has been installed yet',
            columns: [col('host', 'Host'), col('name', 'Package'),
                col('version', 'Version', 'code')],
        },
        {
            // THE COLUMN THIS TRACK EXISTS FOR. A run whose `changed` is 0 is
            // an idempotent run, and seeing that flip to yes on the second pass
            // is the whole lesson - so it is a column rather than something a
            // student has to read out of a recap.
            id: 'runs', title: 'Playbook runs', kind: 'table', path: 'runs',
            tool: 'ansible_gui', empty: 'No playbook has been run yet',
            columns: [col('playbook', 'Playbook'), col('at', 'When'),
                col('mode', 'Mode', 'badge'), col('ok', 'ok', 'number'),
                col('changed', 'changed', 'number'),
                col('failed', 'failed', 'number'),
                col('idempotent', 'Idempotent', 'badge')],
        },
        {
            id: 'roles', title: 'Roles', kind: 'table', path: 'roles',
            tool: 'ansible_gui', empty: 'No roles yet',
            columns: [col('name', 'Role'), col('tasks', 'Tasks', 'number')],
        },
    ],
    jenkins: [
        { id: 'stats', title: 'Controller', kind: 'stats', path: 'stats',
            tool: 'jenkins_gui' },
        {
            id: 'jobs', title: 'Jobs', kind: 'table', path: 'jobs',
            tool: 'jenkins_gui', empty: 'No jobs yet',
            columns: [col('name', 'Job'), col('source', 'Pipeline from'),
                col('builds', 'Builds', 'number'),
                col('status', 'Last result', 'badge'), col('last_at', 'When')],
        },
        {
            // The stage view of the LAST build, which is the thing a Jenkins
            // user actually looks at: it says WHERE a build broke without
            // opening the log, and NOT_EXECUTED is a status of its own.
            id: 'stages', title: 'Stage view', kind: 'table', path: 'stages',
            tool: 'jenkins_gui', empty: 'Nothing has been built yet',
            columns: [col('stage', 'Stage'), col('status', 'Result', 'badge'),
                col('steps', 'Steps', 'number'), col('note', 'Note')],
        },
        {
            id: 'builds', title: 'Build history', kind: 'table', path: 'builds',
            tool: 'jenkins_gui', empty: 'Nothing has been built yet',
            columns: [col('job', 'Job'), col('number', 'Build', 'code'),
                col('result', 'Result', 'badge'), col('at', 'Started'),
                col('took', 'Took'), col('tests', 'Tests'),
                col('artifacts', 'Artifacts', 'number')],
        },
        {
            id: 'nodes', title: 'Nodes', kind: 'table', path: 'nodes',
            tool: 'jenkins_gui', empty: 'No agents',
            columns: [col('name', 'Node'), col('status', 'Status', 'badge'),
                col('executors', 'Executors', 'number'),
                col('labels', 'Labels', 'list')],
        },
        {
            id: 'credentials', title: 'Credentials', kind: 'table',
            path: 'credentials', tool: 'jenkins_gui',
            empty: 'The credential store is empty',
            columns: [col('id', 'ID', 'code'), col('kind', 'Kind'),
                col('username', 'Username'), col('description', 'Description')],
        },
        {
            id: 'plugins', title: 'Plugins', kind: 'table', path: 'plugins',
            tool: 'jenkins_gui', empty: 'No plugins',
            columns: [col('id', 'Plugin', 'code'), col('name', 'Name'),
                col('version', 'Version', 'code')],
        },
    ],
    /*
      Puppet and Chef lead with the thing each tool BUILDS before it changes
      anything - the catalog and the resource collection - where Ansible's
      dashboard above leads with a list of managed nodes. That is the tools
      differing rather than this file: Ansible pushes to a fleet, and these two
      run ON the machine. A student has to learn to read the artefact, so it is
      the first table rather than something buried under the node state.
    */
    puppet: [
        { id: 'stats', title: 'Control', kind: 'stats', path: 'stats',
            tool: 'puppet_gui' },
        {
            // THE TABLE THIS TRACK EXISTS FOR. A run whose `changed` is 0 is an
            // idempotent run, and watching that flip to yes on the second apply
            // is the whole lesson - so it is a column rather than something a
            // student has to read out of a log.
            id: 'runs', title: 'Runs', kind: 'table', path: 'runs',
            tool: 'puppet_gui', empty: 'No manifest has been applied yet',
            columns: [col('manifest', 'Manifest'), col('node', 'Node'),
                col('at', 'When'), col('mode', 'Mode', 'badge'),
                col('total', 'Resources', 'number'),
                col('changed', 'changed', 'number'),
                col('failed', 'failed', 'number'),
                col('idempotent', 'Idempotent', 'badge')],
        },
        {
            id: 'catalog', title: 'Compiled catalog', kind: 'table',
            path: 'catalog', tool: 'puppet_gui',
            empty: 'Nothing has been compiled yet',
            columns: [col('ref', 'Resource', 'code'), col('type', 'Type'),
                col('scope', 'Declared in'),
                col('attributes', 'Attributes', 'number')],
        },
        {
            id: 'edges', title: 'Relationships', kind: 'table', path: 'edges',
            tool: 'puppet_gui',
            empty: 'This catalog declares no relationships',
            columns: [col('from', 'Before', 'code'), col('to', 'After', 'code'),
                col('kind', 'Kind', 'badge')],
        },
        {
            id: 'nodes', title: 'Nodes', kind: 'table', path: 'nodes',
            tool: 'puppet_gui', empty: 'No nodes in this environment',
            columns: [col('name', 'Certname'), col('address', 'Address', 'code'),
                col('os', 'Distribution'), col('family', 'Family'),
                col('certificate', 'Certificate', 'badge'),
                col('primary', 'This node', 'badge'),
                col('packages', 'Packages', 'number'),
                col('services_running', 'Running', 'number')],
        },
        {
            id: 'classes', title: 'Declared classes', kind: 'table',
            path: 'classes', tool: 'puppet_gui',
            empty: 'No classes have been declared',
            columns: [col('name', 'Class', 'code')],
        },
        {
            id: 'packages', title: 'Packages', kind: 'table', path: 'packages',
            tool: 'puppet_gui', empty: 'Nothing has been installed yet',
            columns: [col('node', 'Node'), col('name', 'Package'),
                col('version', 'Version', 'code')],
        },
        {
            id: 'services', title: 'Services', kind: 'table', path: 'services',
            tool: 'puppet_gui', empty: 'Nothing has been installed yet',
            columns: [col('node', 'Node'), col('name', 'Unit'),
                col('state', 'State', 'badge'),
                col('enabled', 'At boot', 'badge'),
                col('restarted', 'Refreshed', 'badge')],
        },
        {
            id: 'files', title: 'Managed files', kind: 'table', path: 'files',
            tool: 'puppet_gui', empty: 'No files are managed yet',
            columns: [col('node', 'Node'), col('path', 'Path', 'code'),
                col('mode', 'Mode', 'code'), col('owner', 'Owner'),
                col('bytes', 'Bytes', 'number')],
        },
    ],
    chef: [
        { id: 'stats', title: 'Node', kind: 'stats', path: 'stats',
            tool: 'chef_gui' },
        {
            id: 'runs', title: 'Runs', kind: 'table', path: 'runs',
            tool: 'chef_gui', empty: 'chef-client has not run yet',
            columns: [col('runlist', 'Run list'), col('at', 'When'),
                col('mode', 'Mode', 'badge'),
                col('total', 'Resources', 'number'),
                col('updated', 'updated', 'number'),
                col('failed', 'failed', 'number'),
                col('delayed', 'Notifications', 'number'),
                col('idempotent', 'Idempotent', 'badge')],
        },
        {
            // THE COMPILE PHASE, ON ITS OWN, ABOVE THE COLLECTION. That split
            // is not presentation - it IS the lesson this track is built
            // around, and a panel that interleaved the two would teach the
            // opposite of what Chef does.
            id: 'compile', title: 'Compile phase', kind: 'table',
            path: 'compile_log', tool: 'chef_gui',
            empty: 'The last run printed nothing at compile time',
            columns: [col('line', 'Output', 'code')],
        },
        {
            id: 'resources', title: 'Resource collection', kind: 'table',
            path: 'resources', tool: 'chef_gui',
            empty: 'Nothing has been compiled yet',
            columns: [col('ref', 'Resource', 'code'),
                col('cookbook', 'From'), col('actions', 'Actions'),
                col('guarded', 'Guarded', 'badge'),
                col('notifying', 'Notifies', 'badge'),
                col('updated', 'Updated', 'badge')],
        },
        {
            id: 'runlist', title: 'Run list', kind: 'table', path: 'runlist',
            tool: 'chef_gui', empty: 'The run list is empty',
            columns: [col('position', 'Order', 'number'),
                col('entry', 'Entry', 'code')],
        },
        {
            // The precedence level BESIDE the effective value, because "why is
            // this 9090" is the question this table exists to answer and a
            // merged value on its own cannot.
            id: 'attributes', title: 'Attributes', kind: 'table',
            path: 'attributes', tool: 'chef_gui',
            empty: 'No attributes have been set',
            columns: [col('attribute', 'Attribute', 'code'),
                col('level', 'Precedence', 'badge'), col('value', 'Set to'),
                col('effective', 'Effective value')],
        },
        {
            id: 'packages', title: 'Packages', kind: 'table', path: 'packages',
            tool: 'chef_gui', empty: 'Nothing has been installed yet',
            columns: [col('name', 'Package'),
                col('version', 'Version', 'code')],
        },
        {
            id: 'services', title: 'Services', kind: 'table', path: 'services',
            tool: 'chef_gui', empty: 'Nothing has been installed yet',
            columns: [col('name', 'Service'), col('state', 'State', 'badge'),
                col('enabled', 'At boot', 'badge'),
                col('restarted', 'Restarted', 'badge'),
                col('restarts', 'Restarts', 'number')],
        },
        {
            id: 'files', title: 'Managed files', kind: 'table', path: 'files',
            tool: 'chef_gui', empty: 'No files are managed yet',
            columns: [col('path', 'Path', 'code'), col('mode', 'Mode', 'code'),
                col('owner', 'Owner'), col('bytes', 'Bytes', 'number')],
        },
    ],
    git: [
        {
            id: 'branches', title: 'Branches', kind: 'table', path: 'branches',
            tool: 'git', empty: 'No repository yet',
            columns: [col('name', 'Branch'), col('sha', 'Commit', 'code'),
                col('current', 'Current', 'badge'), col('message', 'Message')],
        },
        {
            id: 'commits', title: 'History', kind: 'cards', path: 'commits',
            tool: 'git', empty: 'No commits yet',
        },
    ],
    // The Claude API. The Requests panel leads on purpose: every lesson in the
    // three API courses is an arithmetic one - a cache hit is only visible as
    // a difference between two token counts, a truncation is only visible in
    // `stop_reason`, and a grounded answer is only distinguishable from an
    // invented one by a flag. Reading that table IS the skill.
    claudeapi: [
        { id: 'stats', title: 'Account', kind: 'stats', path: 'stats',
            tool: 'claude_gui' },
        {
            id: 'requests', title: 'Requests', kind: 'table', path: 'requests',
            tool: 'claude_gui', empty: 'Nothing sent yet',
            columns: [col('n', '#', 'number'), col('label', 'From'),
                col('model', 'Model'), col('temperature', 'Temp', 'number'),
                col('in_tokens', 'In', 'number'),
                col('out_tokens', 'Out', 'number'),
                col('cache_write', 'Cache w', 'number'),
                col('cache_read', 'Cache r', 'number'),
                col('stop_reason', 'Stopped', 'badge'),
                col('cost', 'Cost', 'number')],
        },
        {
            id: 'conversation', title: 'Last request', kind: 'table',
            path: 'conversation', tool: 'claude_gui',
            empty: 'No conversation yet',
            columns: [col('role', 'Role', 'badge'),
                col('blocks', 'Blocks', 'list'),
                col('tokens', 'Tokens', 'number'), col('text', 'Text')],
        },
        {
            id: 'tools', title: 'Tool definitions', kind: 'table',
            path: 'tools', tool: 'claude_gui', empty: 'No tools defined',
            columns: [col('name', 'Name', 'code'),
                col('required', 'Required', 'list'),
                col('properties', 'Properties', 'number'),
                col('description', 'Description')],
        },
        {
            id: 'tool_calls', title: 'Tool calls', kind: 'table',
            path: 'tool_calls', tool: 'claude_gui', empty: 'No tool calls',
            columns: [col('name', 'Tool', 'code'), col('id', 'Id', 'code'),
                col('input', 'Input', 'code'),
                col('answered', 'Answered', 'badge')],
        },
        {
            id: 'chunks', title: 'Retrieval index', kind: 'table',
            path: 'chunks', tool: 'claude_gui', empty: 'Nothing chunked yet',
            columns: [col('id', 'Chunk', 'code'),
                col('document', 'Document'), col('tokens', 'Tokens', 'number'),
                col('text', 'First words')],
        },
        {
            id: 'searches', title: 'Searches', kind: 'table', path: 'searches',
            tool: 'claude_gui', empty: 'No searches yet',
            columns: [col('query', 'Query'), col('mode', 'Mode', 'badge'),
                col('reranked', 'Reranked', 'badge'),
                col('top', 'Top hit', 'code'),
                col('top_score', 'Score', 'number'),
                col('documents', 'Documents', 'list')],
        },
        {
            id: 'evals', title: 'Evaluations', kind: 'table', path: 'evals',
            tool: 'claude_gui', empty: 'No evals run',
            columns: [col('name', 'Name'), col('grader', 'Grader', 'badge'),
                col('cases', 'Cases', 'number'),
                col('passed', 'Passed', 'number'),
                col('failed', 'Failed', 'number'),
                col('pass_rate', 'Rate %', 'number'),
                col('avg_score', 'Mean', 'number')],
        },
        {
            id: 'mcp', title: 'MCP servers', kind: 'table', path: 'mcp',
            tool: 'claude_gui', empty: 'No MCP servers',
            columns: [col('name', 'Server'), col('transport', 'Transport'),
                col('tools', 'Tools', 'number'),
                col('resources', 'Resources', 'number'),
                col('prompts', 'Prompts', 'number'),
                col('status', 'Status', 'badge')],
        },
    ],
    // Claude Code. The Tool calls panel is last and is the one that matters:
    // every other panel says what the configuration IS, and that one says what
    // it DID.
    claudecode: [
        { id: 'stats', title: 'Session', kind: 'stats', path: 'stats',
            tool: 'claudecode_gui' },
        {
            id: 'memory', title: 'Memory', kind: 'table', path: 'memory',
            tool: 'claudecode_gui', empty: 'No CLAUDE.md found',
            columns: [col('order', 'Order', 'number'),
                col('scope', 'Scope', 'badge'), col('path', 'File', 'code'),
                col('lines', 'Lines', 'number'),
                col('tokens', 'Tokens', 'number'),
                col('imports', 'Imports', 'list')],
        },
        {
            id: 'permissions', title: 'Permission rules', kind: 'table',
            path: 'permissions', tool: 'claudecode_gui', empty: 'No rules',
            columns: [col('effect', 'Effect', 'badge'),
                col('rule', 'Rule', 'code')],
        },
        {
            id: 'hooks', title: 'Hooks', kind: 'table', path: 'hooks',
            tool: 'claudecode_gui', empty: 'No hooks configured',
            columns: [col('event', 'Event', 'badge'),
                col('matcher', 'Matcher', 'code'),
                col('command', 'Command', 'code'),
                col('fired', 'Fired', 'number'),
                col('blocked', 'Blocked', 'number')],
        },
        {
            id: 'skills', title: 'Skills', kind: 'table', path: 'skills',
            tool: 'claudecode_gui', empty: 'No skills',
            columns: [col('name', 'Name'), col('scope', 'Scope', 'badge'),
                col('files', 'Files', 'number'),
                col('valid', 'Loaded', 'badge'),
                col('description', 'Description')],
        },
        {
            id: 'agents', title: 'Subagents', kind: 'table', path: 'agents',
            tool: 'claudecode_gui', empty: 'No subagents',
            columns: [col('name', 'Name'), col('scope', 'Scope', 'badge'),
                col('tools', 'Tools', 'list'), col('model', 'Model'),
                col('valid', 'Loaded', 'badge')],
        },
        {
            id: 'sessions', title: 'Runs', kind: 'table', path: 'sessions',
            tool: 'claudecode_gui', empty: 'Nothing run yet',
            columns: [col('prompt', 'Prompt'), col('mode', 'Mode', 'badge'),
                col('tools', 'Calls', 'number'),
                col('denied', 'Refused', 'number'),
                col('skill', 'Skill'), col('subagent', 'Subagent'),
                col('is_error', 'Error', 'badge'),
                col('cost', 'Cost', 'number')],
        },
        {
            id: 'tool_log', title: 'Tool calls', kind: 'table', path: 'tool_log',
            tool: 'claudecode_gui', empty: 'No tool calls yet',
            columns: [col('tool', 'Tool', 'badge'), col('target', 'Target', 'code'),
                // A SUBAGENT'S OWN CALLS ARE TAGGED WITH ITS NAME, and empty for
                // the caller's. The whole point of a subagent is that its work is
                // isolated from your context and NOT hidden from you, so a column
                // is where that shows: one Task in your session, and everything
                // the subagent did underneath it.
                col('agent', 'Agent', 'badge'),
                col('decision', 'Decision', 'badge'), col('reason', 'Why'),
                col('result', 'Result')],
        },
    ],
    // Cowork is the SAME engine and reads the same payload; a separate family
    // only so the pane carries the product a student is learning. It shows the
    // half a Cowork lab is about and leaves out the repository half.
    cowork: [
        { id: 'stats', title: 'Cowork', kind: 'stats', path: 'stats',
            tool: 'cowork_gui' },
        {
            id: 'instructions', title: 'Standing context', kind: 'table',
            path: 'memory', tool: 'cowork_gui', empty: 'No standing context',
            columns: [col('scope', 'Scope', 'badge'), col('path', 'File', 'code'),
                col('lines', 'Lines', 'number'),
                col('tokens', 'Tokens', 'number')],
        },
        {
            id: 'skills', title: 'Skills', kind: 'table', path: 'skills',
            tool: 'cowork_gui', empty: 'No skills',
            columns: [col('name', 'Name'), col('files', 'Files', 'number'),
                col('valid', 'Loaded', 'badge'),
                col('description', 'Description')],
        },
        {
            id: 'plugins', title: 'Plugins', kind: 'table', path: 'plugins',
            tool: 'cowork_gui', empty: 'No plugins installed',
            columns: [col('name', 'Plugin'), col('marketplace', 'From'),
                col('skills', 'Skills', 'number'),
                col('agents', 'Subagents', 'number'),
                col('hooks', 'Hooks', 'number')],
        },
        {
            id: 'tasks', title: 'Tasks', kind: 'table', path: 'sessions',
            tool: 'cowork_gui', empty: 'Nothing run yet',
            columns: [col('prompt', 'Task'), col('tools', 'Calls', 'number'),
                col('denied', 'Refused', 'number'), col('skill', 'Skill'),
                col('is_error', 'Error', 'badge')],
        },
        {
            id: 'tool_log', title: 'Tool calls', kind: 'table', path: 'tool_log',
            tool: 'cowork_gui', empty: 'No tool calls yet',
            columns: [col('tool', 'Tool', 'badge'), col('target', 'Target', 'code'),
                // A SUBAGENT'S OWN CALLS ARE TAGGED WITH ITS NAME, and empty for
                // the caller's. The whole point of a subagent is that its work is
                // isolated from your context and NOT hidden from you, so a column
                // is where that shows: one Task in your session, and everything
                // the subagent did underneath it.
                col('agent', 'Agent', 'badge'),
                col('decision', 'Decision', 'badge'), col('reason', 'Why'),
                col('result', 'Result')],
        },
    ],
    // The Model Context Protocol. The MESSAGES panel leads, and that is the
    // whole design rather than an ordering preference: MCP has two independent
    // ends and almost every problem is a disagreement between them that raises
    // nothing, so the wire log is the artefact - which side sent which frame,
    // which of them carry an id, and which can therefore never be answered.
    // Every other panel says what the two sides ARE; this one says what they
    // DID.
    mcp: [
        { id: 'stats', title: 'Session', kind: 'stats', path: 'stats',
            tool: 'mcp_gui' },
        {
            id: 'messages', title: 'Messages', kind: 'table', path: 'messages',
            tool: 'mcp_gui', empty: 'Nothing on the wire yet',
            // `id` is deliberately a column of its own and deliberately EMPTY
            // for a notification: that is the fact the whole protocol rests on,
            // not a gap in the data.
            columns: [col('n', '#', 'number'), col('dir', 'Direction', 'badge'),
                col('type', 'Type', 'badge'), col('id', 'Id', 'code'),
                col('method', 'Method', 'code'),
                col('params', 'Params'), col('result', 'Result'),
                col('error', 'Error')],
        },
        {
            id: 'tools', title: 'Tools', kind: 'table', path: 'tools',
            tool: 'mcp_gui', empty: 'No tools declared',
            columns: [col('name', 'Name', 'code'),
                col('schema', 'Input schema', 'code'),
                col('documented', 'Documented', 'badge'),
                col('samples', 'Samples', 'badge'),
                col('logs', 'Logs', 'badge'),
                col('progress', 'Progress', 'badge'),
                col('description', 'Description')],
        },
        {
            id: 'resources', title: 'Resources', kind: 'table',
            path: 'resources', tool: 'mcp_gui', empty: 'No resources declared',
            // `kind` distinguishes a fixed resource from a TEMPLATE, which are
            // two different lists on the wire - and mistaking one for the other
            // is the commonest "my resource is missing".
            columns: [col('uri', 'URI', 'code'), col('kind', 'Kind', 'badge'),
                col('mime', 'MIME'), col('description', 'Description')],
        },
        {
            id: 'prompts', title: 'Prompts', kind: 'table', path: 'prompts',
            tool: 'mcp_gui', empty: 'No prompts declared',
            columns: [col('name', 'Name', 'code'),
                col('arguments', 'Arguments', 'list'),
                col('description', 'Description')],
        },
        {
            id: 'capabilities', title: 'Capabilities', kind: 'table',
            path: 'capabilities', tool: 'mcp_gui', empty: 'Not connected',
            columns: [col('side', 'Side', 'badge'),
                col('capability', 'Capability', 'code'),
                col('declared', 'Declared', 'badge')],
        },
        {
            id: 'client', title: 'Client', kind: 'table', path: 'client',
            tool: 'mcp_gui', empty: 'No client file read',
            // Rows over the CANONICAL method list rather than over what the
            // file happens to call, so the panel shows the GAPS - a client with
            // no `initialize` is the commonest broken client there is.
            columns: [col('method', 'Wire method', 'code'),
                col('implemented', 'Implemented', 'badge')],
        },
        {
            id: 'calls', title: 'Tool calls', kind: 'table', path: 'calls',
            tool: 'mcp_gui', empty: 'No tool calls',
            columns: [col('tool', 'Tool', 'code'),
                col('arguments', 'Arguments', 'code'),
                col('ok', 'Ok', 'badge'), col('sampled', 'Sampled', 'badge'),
                col('text', 'Result')],
        },
        {
            id: 'sampling', title: 'Sampling', kind: 'table', path: 'sampling',
            tool: 'mcp_gui', empty: 'No sampling requests',
            columns: [col('tool', 'From tool', 'code'),
                col('allowed', 'Allowed', 'badge'), col('model', 'Model'),
                col('reason', 'Why')],
        },
        {
            id: 'notifications', title: 'Notifications', kind: 'table',
            path: 'notifications', tool: 'mcp_gui',
            empty: 'No notifications',
            // `delivered` is the column that matters: progress reported with no
            // progressToken in the request is NOT sent, and nothing errors.
            columns: [col('kind', 'Kind', 'badge'),
                col('method', 'Method', 'code'), col('level', 'Level', 'badge'),
                col('tool', 'From tool', 'code'),
                col('delivered', 'Sent', 'badge'), col('text', 'Text')],
        },
        {
            id: 'roots', title: 'Roots', kind: 'table', path: 'roots',
            tool: 'mcp_gui', empty: 'No roots offered',
            columns: [col('uri', 'URI', 'code'),
                col('declared', 'Capability', 'badge')],
        },
        {
            id: 'sessions', title: 'HTTP sessions', kind: 'table',
            path: 'sessions', tool: 'mcp_gui',
            empty: 'No session - stdio, or stateless',
            columns: [col('id', 'Mcp-Session-Id', 'code'),
                col('transport', 'Transport', 'badge'),
                col('stateful', 'Stateful', 'badge'), col('at', 'Issued')],
        },
    ],
};

/**
 * The panels to draw for a lab, given the tools it actually lists.
 *
 * Filtered by tool rather than by family, which is the point: a Big Data lab
 * that gives a student the HDFS shell and the NameNode UI but not Ambari gets
 * three panels and not ten. A lab that lists a GUI this build has no spec for
 * gets nothing for it - visibly thinner, never broken.
 */
export function panelsFor(family: string, tools: string[]): GuiPanel[] {
    const available = new Set(tools || []);
    return (GUI_PANELS[family] || []).filter(
        panel => !panel.tool || available.has(panel.tool));
}

/** Every panel title is a catalogue key, so `check:i18n` can prove coverage. */
export const PANEL_TITLE_KEYS = Object.values(GUI_PANELS)
    .flat()
    .map(panel => panel.title)
    .filter((title, index, all) => all.indexOf(title) === index);

/**
 * A dotted path into a view payload, tolerating everything a missing service
 * field can be.
 *
 * Returns `[]` for a path that is absent rather than throwing, because the lab
 * service deploys separately from this bundle: a replica a release behind simply
 * has no `spark.jobs` yet, and a panel that renders empty is a page while a
 * panel that throws is a blank screen.
 */
export function pick(payload: unknown, path: string): unknown {
    let current: unknown = payload;
    for (const part of String(path || '').split('.').filter(Boolean)) {
        if (current === null || current === undefined) return undefined;
        if (Array.isArray(current)) {
            const collected: unknown[] = [];
            for (const row of current) {
                const value = (row as Record<string, unknown>)?.[part];
                if (Array.isArray(value)) collected.push(...value);
                else if (value !== undefined) collected.push(value);
            }
            current = collected;
            continue;
        }
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

export function rowsAt(payload: unknown, path: string): Array<Record<string, unknown>> {
    const value = pick(payload, path);
    if (Array.isArray(value)) {
        return value.filter(row => row && typeof row === 'object') as Array<Record<string, unknown>>;
    }
    if (value && typeof value === 'object') {
        // An object where a table was expected is rendered as name/value rows,
        // which is what `terraform.outputs` and `hive.databases` need.
        return Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => typeof item !== 'object' || item === null)
            .map(([name, item]) => ({ name, value: item }));
    }
    return [];
}

export function statsAt(payload: unknown, path: string): Array<[string, unknown]> {
    const value = pick(payload, path);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item === null || typeof item !== 'object')
        .map(([key, item]) => [key, item] as [string, unknown]);
}

/** `used_percent` -> `Used percent`. Backend keys are snake_case. */
export function humanKey(key: string): string {
    const text = String(key || '').replace(/_/g, ' ').trim();
    return text ? text[0].toUpperCase() + text.slice(1) : '';
}

/* ─────────────────── the web playground ─────────────────── */

/**
 * One HTML document from the three panes.
 *
 * **The result is rendered in a sandboxed iframe and nowhere else.** That is not
 * a limitation of this platform, it is the correct architecture: the browser is
 * this language's runtime and already has a sandbox designed for exactly it,
 * while running a student's JavaScript server-side would be arbitrary code on a
 * replica holding the platform's data.
 *
 * Two things in here are load-bearing:
 *
 * **The console shim comes first.** A student's `console.log` has to reach the
 * parent page or the Console pane is always empty, and the shim has to be
 * installed before their code runs. It posts a message rather than touching
 * `window.parent` directly, because the frame is sandboxed without
 * `allow-same-origin` and a cross-origin property access would throw.
 *
 * **An uncaught error is reported, not swallowed.** Without the `onerror`
 * handler a syntax error in the student's script produces a blank pane and no
 * explanation, which reads as the tool being broken.
 */
export function buildPreview(html: string, css: string, js: string): string {
    const shim = `
<script>
(function () {
  var send = function (level, args) {
    try {
      parent.postMessage({ sfsLab: true, level: level, text: Array.prototype.map
        .call(args, function (value) {
          try {
            return typeof value === 'string' ? value : JSON.stringify(value);
          } catch (error) { return String(value); }
        }).join(' ') }, '*');
    } catch (error) { /* the parent went away */ }
  };
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      send(level, arguments);
      if (original) { try { original.apply(console, arguments); } catch (e) {} }
    };
  });
  window.onerror = function (message, source, line) {
    send('error', [message + ' (line ' + line + ')']);
    return false;
  };
  window.addEventListener('unhandledrejection', function (event) {
    send('error', ['Unhandled promise rejection: ' + event.reason]);
  });
}());
<\/script>`;
    const body = String(html || '');
    const style = `<style>\n${String(css || '')}\n</style>`;
    const script = `<script>\n${String(js || '')}\n<\/script>`;
    if (/<html[\s>]/i.test(body)) {
        // A full document: leave the student's own structure alone and inject
        // the shim into the head, because rewrapping it would silently change
        // the thing they are learning to write.
        return body.replace(/<head(\s[^>]*)?>/i, match => match + shim)
            .replace(/<\/body>/i, `${style}${script}</body>`);
    }
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${shim}
${style}
</head>
<body>
${body}
${script}
</body>
</html>`;
}

/* ─────────────────── the AI tutor's prompt ─────────────────── */

/**
 * The question the "Ask the tutor" button fills in.
 *
 * **The button used to send a sentence built at the call site and it filled
 * nothing in**, so a student who pressed it either got an answer to a question
 * they had not read or — because the ref it went through was an array, not the
 * component — nothing at all. Both halves are fixed: the box is FILLED and left
 * for the student to read and send, and the sentence is built here where
 * `npm run check:labs` can drive it.

 * Filled rather than sent, deliberately. A tutor question is the one place in
 * this workbench where the student is about to spend somebody's model quota on
 * a sentence they did not write, and a question they can see is a question they
 * can correct — which is usually all the nudge they needed. It is also the only
 * way to add "I have already tried X" before asking.
 *
 * Five things go into it, and each is there because the answer is worse without
 * it:
 *
 * - **the lab and the track**, so the model does not answer about Docker when
 *   the task is Terraform;
 * - **which task, out of how many**, which is what tells a model whether this is
 *   a first step or the last one;
 * - **the lab's own wording** — the title AND the detail, because the detail is
 *   where the actual requirement is (`local.full_name = ...`) and the title is
 *   only a label;
 * - **what the checker just said**, which is the single most useful line
 *   available: "main.tf does not contain it yet" turns a general question about
 *   locals into a specific one about this file;
 * - **an explicit request for a NUDGE.** Without it the model writes the answer
 *   out in full, the student pastes it, the task goes green and they have
 *   learned nothing. That sentence is the whole difference between a tutor and
 *   a solution key.
 *
 * The hint is deliberately NOT included. It is already one click away behind the
 * Hint button, and putting it in the prompt asks the model to paraphrase
 * something the student can simply read.
 */
/**
 * A fragment as a sentence.
 *
 * The lab's own detail and the checker's note are both written as fragments -
 * "nothing at images.repository", "`docker pull nginx`. Then `docker images`" -
 * and joining them with a space produced "nothing at images.repository What
 * should I look at next?", which reads as one run-on sentence and is exactly
 * the kind of thing a model resolves by ignoring the second half.
 */
function sentence(text: string): string {
    const trimmed = String(text || '').trim();
    if (!trimmed) return '';
    return /[.!?:;]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function taskQuestion(lab: Lab | null, task: LabTask,
                             position = 0, total = 0): string {
    const parts: string[] = [];
    const where = [lab?.title, lab?.track].filter(Boolean).join(' — ');
    const which = position > 0 && total > 0 ? `task ${position} of ${total}` : 'a task';
    parts.push(where
        ? `I am working through the "${where}" lab, on ${which}: "${task.title}".`
        : `I am stuck on ${which}: "${task.title}".`);
    if (task.detail) parts.push(`The lab asks: ${sentence(task.detail)}`);
    if (task.status === 'passed') {
        parts.push('It is already marked as done, and I want to understand why '
            + 'it works rather than just move on.');
    } else if (task.status === 'unavailable') {
        parts.push('The lab says it cannot check this one here, so I cannot tell '
            + 'whether what I have done is right.');
    } else {
        parts.push('It is still to do.');
        if (task.note) parts.push(`The check says: ${sentence(task.note)}`);
        if (task.manual) {
            parts.push('I have to mark this one myself, so nothing will tell me '
                + 'whether I have got it right.');
        }
    }
    parts.push('What should I look at next? Give me one nudge rather than the '
        + 'answer, and tell me why it works.');
    return parts.join(' ');
}

/**
 * The system message for a lab's AI tutor.
 *
 * **It says which tools are simulated, by name.** Without that the model
 * confidently suggests `docker stats --no-stream --format` options this engine
 * does not implement and `terraform import`, and the student is told to run
 * something that cannot work - which is worse than no tutor, because they will
 * blame themselves. The backend's `context` block carries the live environment;
 * this is the standing instruction around it.
 */
export function tutorPrompt(lab: Lab | null, context: string): string {
    const tools = (lab?.tool_detail || []);
    const simulated = tools.filter(tool => tool.simulated);
    const real = tools.filter(tool => !tool.simulated);
    const lines = [
        'You are the lab instructor inside Self Study Labs - a browser workbench '
        + 'where a student practises by doing.',
        '',
        'How to answer:',
        '- Be concrete about THIS lab and THIS environment. Use the state below '
        + 'by name: the container, the pod, the bucket, the table.',
        '- Teach the WHY. "Run docker network create" is useless; "containers on '
        + 'the default bridge have no DNS, so the name does not resolve" is '
        + 'teaching.',
        '- Give the exact command in a fenced code block when a command is the '
        + 'answer.',
        '- Short direct answer first, then the reasoning, then the command.',
        '- If their environment is already wrong in a way that matters, say so.',
        '- Never invent a flag or a resource type the tools below do not have.',
    ];
    if (simulated.length) {
        lines.push('');
        lines.push('SIMULATED tools in this lab. The command grammar is real and '
            + 'the object model is real; there is no daemon, no kernel and no '
            + 'network behind them. Do not suggest anything that needs one:');
        for (const tool of simulated) {
            lines.push(`- ${tool.label}: ${tool.fidelity || tool.summary}`);
        }
    }
    if (real.length) {
        lines.push('');
        lines.push('REAL tools in this lab:');
        for (const tool of real) {
            lines.push(`- ${tool.label}: ${tool.fidelity || tool.summary}`);
        }
    }
    if (lab?.brief) {
        lines.push('');
        lines.push('THE LAB BRIEF');
        lines.push(lab.brief.slice(0, 6000));
    }
    if (context) {
        lines.push('');
        lines.push(context.slice(0, 9000));
    }
    return lines.join('\n');
}
