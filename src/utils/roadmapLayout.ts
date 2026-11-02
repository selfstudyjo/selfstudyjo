/**
 * src/utils/roadmapLayout.ts — everything the Roadmap Provider DECIDES.
 *
 * A plain module: no Vue, no DOM, no three.js. Same precedent as
 * `photoMask.ts`, `drawEngine.ts`, `leaderboardEngine.ts` and `labCatalogue.ts`,
 * and for the same reason — `npm run check:roadmap` drives it in node, and every
 * mistake in here is one a screenshot cannot see:
 *
 *  - **a layout that is not deterministic** is a map that rearranges itself
 *    when the page re-renders, and a 3D camera tour that flies to where a
 *    stage USED to be;
 *  - **two nodes on top of each other** is a node nobody can click;
 *  - **a node the layout forgot** is a lesson that is on the roadmap and on no
 *    picture of it;
 *  - **`percent: 0` instead of `null`** for an empty roadmap is a claim that
 *    the learner did nothing (same rule as `dashboardProgress.ts`);
 *  - **a `url` taken on trust** is a link the backend wrote and the browser
 *    navigates to. Only an in-app route of the four known shapes is followed.
 *
 * Coordinates: 2D is SVG user units, origin top-left. 3D is three.js world
 * units, Y up. The map is a PLACE, not a paragraph, so neither mirrors in RTL —
 * the components pin `direction: ltr`.
 */

/* ------------------------------------------------------------------ *
 * The contract (app 27, `roadmaps.py`)
 * ------------------------------------------------------------------ */

export type NodeKind = 'course' | 'lesson' | 'lab' | 'runbook' | 'topic';
export type NodeStatus = 'done' | 'doing' | '';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface RoadmapNode {
    id: string;
    kind: NodeKind;
    ref_id: string;
    course_id: string;
    title: string;
    summary: string;
    url: string;
    depends_on: string[];
    optional: boolean;
}

export interface RoadmapStage {
    id: string;
    order: number;
    title: string;
    summary: string;
    weeks: number;
    /** beginner / intermediate / advanced, or a free word like "core". Display only. */
    level: string;
    skills: string[];
    nodes: RoadmapNode[];
}

export interface RoleSource { title: string; url: string }

export interface RoadmapRole {
    title: string;
    summary: string;
    responsibilities: string[];
    skills: string[];
    tools: string[];
    certifications: string[];
    sources: RoleSource[];
}

export interface RoadmapDoc {
    id: string;
    owner: string;
    title: string;
    specialization_id: string;
    level: string;
    hours_per_week: number;
    estimated_weeks: number;
    source: string;
    notes: string[];
    created_at: string;
    updated_at: string;
    role: RoadmapRole;
    stages: RoadmapStage[];
    progress: Record<string, NodeStatus>;
}

export interface RoadmapSummary {
    id: string;
    title: string;
    specialization_id: string;
    level: string;
    created_at: string;
    updated_at: string;
    stage_count: number;
    node_count: number;
    done_count: number;
    source: string;
}

export interface Specialization {
    id: string;
    title: string;
    category: string;
    summary: string;
    icon: string;
    stage_count: number;
    course_count: number;
    lab_count: number;
    runbook_count: number;
}

export const KINDS: NodeKind[] = ['course', 'lesson', 'lab', 'runbook', 'topic'];
export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];

/* ------------------------------------------------------------------ *
 * Kind: shape first, colour second
 * ------------------------------------------------------------------ */

/**
 * How each kind is drawn.
 *
 * SHAPE carries the identity and the colour only supports it: in several
 * galaxies two accents are within a few ΔE of each other, and in Triangulum
 * `accent` and `accent-2` are the same colour to a deuteranope (working rule
 * 37). So every kind has a distinct silhouette in both renderers, an icon, and
 * a visible label; a reader who sees no colour at all loses nothing.
 *
 * `token` is a theme custom property NAME. The 2D map spends it as `var()`; the
 * 3D map resolves it with `getComputedStyle`, because a canvas cannot read a
 * custom property. `fallback` is what both use before a theme is applied.
 */
export const KIND_META: Record<NodeKind, {
    token: string;
    fallback: string;
    shape2d: 'hexagon' | 'circle' | 'square' | 'document' | 'diamond';
    shape3d: 'octahedron' | 'sphere' | 'box' | 'cylinder' | 'tetrahedron';
}> = {
    course:  { token: '--sfs-accent',   fallback: '#667eea', shape2d: 'hexagon',  shape3d: 'octahedron' },
    lesson:  { token: '--sfs-accent-2', fallback: '#764ba2', shape2d: 'circle',   shape3d: 'sphere' },
    lab:     { token: '--sfs-accent-3', fallback: '#f093fb', shape2d: 'square',   shape3d: 'box' },
    runbook: { token: '--sfs-info',     fallback: '#38bdf8', shape2d: 'document', shape3d: 'cylinder' },
    topic:   { token: '--sfs-text-muted', fallback: '#94a3b8', shape2d: 'diamond', shape3d: 'tetrahedron' },
};

/** Status is ONE hue per meaning, and it is the status tokens' own. */
export const STATUS_META: Record<'done' | 'doing' | 'todo', { token: string; fallback: string }> = {
    done:  { token: '--sfs-success', fallback: '#34d399' },
    doing: { token: '--sfs-warning', fallback: '#fbbf24' },
    todo:  { token: '--sfs-border-strong', fallback: '#64748b' },
};

/* ------------------------------------------------------------------ *
 * Normalising what arrived over the network
 * ------------------------------------------------------------------ */

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(str).map(s => s.trim()).filter(Boolean) : [];
const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
};

export function asKind(v: unknown): NodeKind {
    const k = str(v).toLowerCase();
    return (KINDS as string[]).includes(k) ? (k as NodeKind) : 'topic';
}

export function asStatus(v: unknown): NodeStatus {
    return v === 'done' || v === 'doing' ? v : '';
}

/**
 * A RoadmapDoc the components can trust.
 *
 * Every field the contract names is present and of the right type afterwards,
 * whatever arrived. Node ids are made UNIQUE (a duplicate id would be two nodes
 * sharing one progress mark, so ticking one ticks the other), and a dependency
 * on a node that is not in the roadmap — or on itself — is dropped, because an
 * edge to nothing is drawn to (0, 0).
 */
export function normaliseRoadmap(raw: any): RoadmapDoc {
    const doc = raw && typeof raw === 'object' ? raw : {};
    const seen = new Set<string>();
    const unique = (id: string, fallback: string) => {
        let base = id || fallback;
        let candidate = base;
        let n = 2;
        while (seen.has(candidate)) candidate = `${base}~${n++}`;
        seen.add(candidate);
        return candidate;
    };

    const stagesIn: any[] = Array.isArray(doc.stages) ? doc.stages : [];
    const stages: RoadmapStage[] = stagesIn.map((s, si) => {
        const stage = s && typeof s === 'object' ? s : {};
        const nodesIn: any[] = Array.isArray(stage.nodes) ? stage.nodes : [];
        return {
            id: str(stage.id) || `stage-${si + 1}`,
            order: num(stage.order, si + 1),
            title: str(stage.title).trim() || `Stage ${si + 1}`,
            summary: str(stage.summary),
            weeks: Math.max(0, num(stage.weeks)),
            level: str(stage.level),
            skills: strList(stage.skills),
            nodes: nodesIn.map((n, ni) => {
                const node = n && typeof n === 'object' ? n : {};
                return {
                    id: unique(str(node.id), `${str(stage.id) || 's' + si}-n${ni + 1}`),
                    kind: asKind(node.kind),
                    ref_id: str(node.ref_id),
                    course_id: str(node.course_id),
                    title: str(node.title).trim() || 'Untitled step',
                    summary: str(node.summary),
                    url: str(node.url),
                    depends_on: strList(node.depends_on),
                    optional: node.optional === true,
                };
            }),
        };
    });

    const ids = new Set(stages.flatMap(s => s.nodes.map(n => n.id)));
    for (const s of stages) {
        for (const n of s.nodes) {
            n.depends_on = [...new Set(n.depends_on)].filter(d => d !== n.id && ids.has(d));
        }
    }

    const progress: Record<string, NodeStatus> = {};
    if (doc.progress && typeof doc.progress === 'object') {
        for (const [k, v] of Object.entries(doc.progress)) {
            const status = asStatus(v);
            if (status && ids.has(k)) progress[k] = status;
        }
    }

    const role = doc.role && typeof doc.role === 'object' ? doc.role : {};
    const sources: RoleSource[] = (Array.isArray(role.sources) ? role.sources : [])
        .map((x: any) => ({ title: str(x?.title).trim(), url: str(x?.url).trim() }))
        .filter((x: RoleSource) => x.title || x.url);

    return {
        id: str(doc.id),
        owner: str(doc.owner),
        title: str(doc.title).trim() || str(role.title).trim() || 'Untitled roadmap',
        specialization_id: str(doc.specialization_id),
        level: str(doc.level),
        hours_per_week: Math.max(0, num(doc.hours_per_week)),
        estimated_weeks: Math.max(0, num(doc.estimated_weeks)),
        source: str(doc.source),
        notes: strList(doc.notes),
        created_at: str(doc.created_at),
        updated_at: str(doc.updated_at),
        role: {
            title: str(role.title),
            summary: str(role.summary),
            responsibilities: strList(role.responsibilities),
            skills: strList(role.skills),
            tools: strList(role.tools),
            certifications: strList(role.certifications),
            sources,
        },
        stages: orderedStages(stages),
        progress,
    };
}

/**
 * Stages in reading order: by `order`, then by position in the payload. The
 * comparator is TOTAL — an equal `order` falls back to the original index — so
 * the map never swaps two stages between renders.
 */
export function orderedStages(stages: RoadmapStage[]): RoadmapStage[] {
    return stages
        .map((stage, index) => ({ stage, index }))
        .sort((a, b) => (a.stage.order - b.stage.order) || (a.index - b.index))
        .map(x => x.stage);
}

export function allNodes(doc: RoadmapDoc): RoadmapNode[] {
    return doc.stages.flatMap(s => s.nodes);
}

export function findNode(doc: RoadmapDoc, id: string): { node: RoadmapNode; stage: RoadmapStage } | null {
    for (const stage of doc.stages) {
        const node = stage.nodes.find(n => n.id === id);
        if (node) return { node, stage };
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

export function statusOf(doc: RoadmapDoc, nodeId: string): NodeStatus {
    return asStatus(doc.progress?.[nodeId]);
}

export interface StageStats { id: string; total: number; done: number; doing: number; percent: number | null }

export interface ProgressStats {
    total: number;
    required: number;
    done: number;
    doing: number;
    todo: number;
    /** Done out of REQUIRED steps, 0–100; `null` when there is nothing to do. */
    percent: number | null;
    stages: StageStats[];
    byKind: Record<NodeKind, number>;
}

/**
 * The numbers on the progress card.
 *
 * `percent` is over the REQUIRED steps: an optional step is extra credit, and
 * counting it would mean a learner who did everything they were asked shows
 * 80%. An optional step that is done still counts towards `done`, but the
 * percentage is capped at 100. `null` rather than 0 for an empty roadmap —
 * 0% is a claim, and nothing was asked.
 */
export function progressStats(doc: RoadmapDoc): ProgressStats {
    const byKind = { course: 0, lesson: 0, lab: 0, runbook: 0, topic: 0 } as Record<NodeKind, number>;
    let total = 0, required = 0, done = 0, doing = 0, requiredDone = 0;
    const stages: StageStats[] = doc.stages.map(stage => {
        let sDone = 0, sDoing = 0;
        for (const node of stage.nodes) {
            total++;
            byKind[node.kind]++;
            if (!node.optional) required++;
            const s = statusOf(doc, node.id);
            if (s === 'done') { done++; sDone++; if (!node.optional) requiredDone++; }
            else if (s === 'doing') { doing++; sDoing++; }
        }
        return {
            id: stage.id,
            total: stage.nodes.length,
            done: sDone,
            doing: sDoing,
            percent: stage.nodes.length ? Math.round((sDone / stage.nodes.length) * 100) : null,
        };
    });
    return {
        total, required, done, doing,
        todo: total - done - doing,
        percent: required ? Math.min(100, Math.round((requiredDone / required) * 100)) : null,
        stages, byKind,
    };
}

/** Percent for a list row, from the summary's own counts. */
export function summaryPercent(s: Pick<RoadmapSummary, 'node_count' | 'done_count'>): number | null {
    const total = num(s.node_count);
    if (total <= 0) return null;
    return Math.min(100, Math.round((Math.max(0, num(s.done_count)) / total) * 100));
}

/** '' → doing → done → '' — the one-button cycle on a node. */
export function cycleStatus(s: NodeStatus): NodeStatus {
    return s === '' ? 'doing' : s === 'doing' ? 'done' : '';
}

/**
 * The progress map after one change, as the PATCH body wants it.
 *
 * Clearing a mark sends `''` for that node rather than omitting it: omitting a
 * key means "leave it alone" upstream, so a cleared mark that was omitted would
 * spring back on the next read.
 */
export function withStatus(progress: Record<string, NodeStatus>, nodeId: string, status: NodeStatus):
    Record<string, NodeStatus> {
    const next = { ...progress };
    if (status) next[nodeId] = status;
    else delete next[nodeId];
    return next;
}

/**
 * The step to do next: the first not-done, non-optional node (in stage order)
 * whose dependencies are all done. Falls back to the first not-done node at
 * all, so a roadmap whose dependencies form a cycle still has a "next".
 */
export function nextNode(doc: RoadmapDoc): RoadmapNode | null {
    const nodes = allNodes(doc);
    const done = (id: string) => statusOf(doc, id) === 'done';
    return nodes.find(n => !done(n.id) && !n.optional && n.depends_on.every(done))
        || nodes.find(n => !done(n.id))
        || null;
}

/* ------------------------------------------------------------------ *
 * Where a node leads
 * ------------------------------------------------------------------ */

const SEG = "[A-Za-z0-9._~%-]+";
const ROUTE_SHAPES: { kind: NodeKind; re: RegExp }[] = [
    { kind: 'lesson',  re: new RegExp(`^/course/${SEG}/lesson/${SEG}/?$`) },
    { kind: 'course',  re: new RegExp(`^/course/${SEG}/?$`) },
    { kind: 'lab',     re: new RegExp(`^/lab/${SEG}/?$`) },
    { kind: 'runbook', re: new RegExp(`^/runbooks/${SEG}/?$`) },
];

/** Which of the four destinations an in-app path is, or null. */
export function kindOfRoute(url: string): NodeKind | null {
    for (const shape of ROUTE_SHAPES) if (shape.re.test(url)) return shape.kind;
    return null;
}

/**
 * The in-app route a node opens, or null when it has none.
 *
 * The backend's `url` wins when it is one of the four known shapes — and only
 * then: a protocol, a `//host`, a query string or anything else is refused,
 * because this string is handed to `router.push`. Without a usable `url` one
 * is DERIVED from `kind` and `ref_id`. A topic has no page, which is a fact
 * about topics rather than a broken link.
 */
export function routeFor(node: Pick<RoadmapNode, 'kind' | 'ref_id' | 'course_id' | 'url'>): string | null {
    const url = str(node.url).trim();
    if (url && kindOfRoute(url)) return url;
    const enc = (s: string) => encodeURIComponent(s);
    const ref = str(node.ref_id).trim();
    if (!ref) return null;
    switch (node.kind) {
        case 'course': return `/course/${enc(ref)}`;
        case 'lesson': return node.course_id ? `/course/${enc(node.course_id)}/lesson/${enc(ref)}` : null;
        case 'lab': return `/lab/${enc(ref)}`;
        case 'runbook': return `/runbooks/${enc(ref)}`;
        default: return null;
    }
}

/** An external source link is followed only when it is http(s). */
export function safeExternal(url: string): string | null {
    const u = str(url).trim();
    return /^https?:\/\/[^\s/]+/i.test(u) ? u : null;
}

/* ------------------------------------------------------------------ *
 * The catalogue
 * ------------------------------------------------------------------ */

/**
 * Search and filter the catalogue. Every term must appear in the title, the
 * category or the summary. Ordered by category then title — a total order, so
 * the grid does not reshuffle as somebody types.
 */
export function filterCatalogue(specs: Specialization[], query: string, category = ''): Specialization[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return specs
        .filter(s => !category || s.category === category)
        .filter(s => {
            const hay = `${s.title} ${s.category} ${s.summary}`.toLowerCase();
            return terms.every(t => hay.includes(t));
        })
        .slice()
        .sort((a, b) => a.category.localeCompare(b.category, 'en')
            || a.title.localeCompare(b.title, 'en') || a.id.localeCompare(b.id, 'en'));
}

/** Newest first, then by id: the list a learner returns to. */
export function sortRoadmaps(list: RoadmapSummary[]): RoadmapSummary[] {
    return list.slice().sort((a, b) =>
        (str(b.updated_at || b.created_at)).localeCompare(str(a.updated_at || a.created_at))
        || a.id.localeCompare(b.id));
}

/**
 * A title broken onto at most `lines` lines of `perLine` characters, on word
 * boundaries, the last line truncated. SVG text does not wrap, and real titles
 * run to 84 characters ("Module 4: Window functions I: ranking, top-N and
 * deduplication"), so one truncated line loses the half that says what it is.
 */
export function wrapLabel(text: string, perLine: number, lines = 2): string[] {
    const words = str(text).trim().split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let line = '';
    let i = 0;
    for (; i < words.length; i++) {
        const w = words[i];
        const next = line ? `${line} ${w}` : w;
        if (next.length <= perLine) { line = next; continue; }
        if (!line) { line = w; continue; }
        out.push(line);
        line = w;
        if (out.length === lines - 1) { i++; break; }
    }
    if (out.length === lines - 1 && i < words.length) line = [line, ...words.slice(i)].join(' ');
    if (line) out.push(line);
    const last = out.length - 1;
    if (last >= 0) out[last] = truncate(out[last], perLine);
    return out.map(l => (l.length > perLine ? truncate(l, perLine) : l)).slice(0, lines);
}

/** A title that fits a box, cut on a word where possible. */
export function truncate(text: string, max: number): string {
    const t = str(text).trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, Math.max(1, max - 1));
    const space = cut.lastIndexOf(' ');
    return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:-]+$/, '') + '…';
}

/* ------------------------------------------------------------------ *
 * 2D layout — SVG
 * ------------------------------------------------------------------ */

export interface Rect { x: number; y: number; w: number; h: number }

export interface Placed2DStage extends Rect { id: string; index: number; cx: number; cy: number }
export interface Placed2DNode extends Rect { id: string; stageId: string; kind: NodeKind; index: number; cx: number; cy: number }
export interface Placed2DEdge { from: string; to: string; d: string; type: 'spine' | 'dependency' | 'rail' }

export interface Layout2D {
    orientation: 'horizontal' | 'vertical';
    width: number;
    height: number;
    stages: Placed2DStage[];
    nodes: Placed2DNode[];
    edges: Placed2DEdge[];
    /** The whole journey as one path, for the draw-on animation. */
    journey: string;
    /** The longest label a node box has room for, in characters. */
    labelChars: number;
}

const H = {
    PAD: 36, COL_W: 252, COL_GAP: 72, HEADER_H: 96, NODE_W: 232, NODE_H: 64, NODE_GAP: 14,
    FIRST_GAP: 30, WAVE: 34,
};
const V = {
    WIDTH: 360, PAD: 14, RAIL_X: 26, HEADER_H: 88, NODE_H: 62, NODE_GAP: 10, STAGE_GAP: 34,
    INDENT: 48, DEP_ROOM: 26,
};

const f = (n: number) => Math.round(n * 10) / 10;

/**
 * Stage columns (wide containers) or stage rows (phones).
 *
 * The map follows its CONTAINER, not the viewport: the components measure
 * themselves and pass the orientation, so a map in a narrow column on a 4K
 * screen gets rows (working rule 50).
 */
export function layout2D(doc: RoadmapDoc, orientation: 'horizontal' | 'vertical' = 'horizontal'): Layout2D {
    return orientation === 'vertical' ? layoutVertical(doc) : layoutHorizontal(doc);
}

function layoutHorizontal(doc: RoadmapDoc): Layout2D {
    const stages: Placed2DStage[] = [];
    const nodes: Placed2DNode[] = [];
    const edges: Placed2DEdge[] = [];
    let bottom = 0;

    doc.stages.forEach((stage, i) => {
        const x = H.PAD + i * (H.COL_W + H.COL_GAP);
        // A gentle wave, so a long roadmap reads as a path rather than a table.
        const y = H.PAD + (i % 2 ? H.WAVE : 0);
        stages.push({ id: stage.id, index: i, x, y, w: H.COL_W, h: H.HEADER_H,
                      cx: x + H.COL_W / 2, cy: y + H.HEADER_H / 2 });
        let lastY = y + H.HEADER_H;
        stage.nodes.forEach((node, j) => {
            const ny = y + H.HEADER_H + H.FIRST_GAP + j * (H.NODE_H + H.NODE_GAP);
            const nx = x + (H.COL_W - H.NODE_W) / 2;
            nodes.push({ id: node.id, stageId: stage.id, kind: node.kind, index: j,
                         x: nx, y: ny, w: H.NODE_W, h: H.NODE_H,
                         cx: nx + H.NODE_W / 2, cy: ny + H.NODE_H / 2 });
            lastY = ny + H.NODE_H;
        });
        if (stage.nodes.length) {
            const rx = x + 14;
            edges.push({ from: stage.id, to: stage.id, type: 'rail',
                         d: `M ${f(rx)} ${f(y + H.HEADER_H)} L ${f(rx)} ${f(lastY - H.NODE_H / 2)}` });
        }
        bottom = Math.max(bottom, lastY);
    });

    for (let i = 0; i + 1 < stages.length; i++) {
        const a = stages[i], b = stages[i + 1];
        const x1 = a.x + a.w, y1 = a.cy, x2 = b.x, y2 = b.cy, dx = (x2 - x1) * 0.55;
        edges.push({ from: a.id, to: b.id, type: 'spine',
                     d: `M ${f(x1)} ${f(y1)} C ${f(x1 + dx)} ${f(y1)}, ${f(x2 - dx)} ${f(y2)}, ${f(x2)} ${f(y2)}` });
    }

    edges.push(...dependencyEdges(doc, nodes, 'horizontal'));
    const width = stages.length ? stages[stages.length - 1].x + H.COL_W + H.PAD : H.PAD * 2 + H.COL_W;
    return {
        orientation: 'horizontal',
        width,
        height: Math.max(bottom, H.PAD + H.HEADER_H + H.WAVE) + H.PAD,
        stages, nodes, edges,
        journey: journeyPath(stages, 'horizontal'),
        labelChars: 23,
    };
}

function layoutVertical(doc: RoadmapDoc): Layout2D {
    const stages: Placed2DStage[] = [];
    const nodes: Placed2DNode[] = [];
    const edges: Placed2DEdge[] = [];
    let y = V.PAD;
    const headerX = V.RAIL_X + 16;
    const headerW = V.WIDTH - headerX - V.PAD;
    const nodeX = V.INDENT;
    const nodeW = V.WIDTH - nodeX - V.PAD - V.DEP_ROOM;

    doc.stages.forEach((stage, i) => {
        stages.push({ id: stage.id, index: i, x: headerX, y, w: headerW, h: V.HEADER_H,
                      cx: V.RAIL_X, cy: y + V.HEADER_H / 2 });
        y += V.HEADER_H + V.NODE_GAP;
        stage.nodes.forEach((node, j) => {
            nodes.push({ id: node.id, stageId: stage.id, kind: node.kind, index: j,
                         x: nodeX, y, w: nodeW, h: V.NODE_H,
                         cx: nodeX + nodeW / 2, cy: y + V.NODE_H / 2 });
            y += V.NODE_H + V.NODE_GAP;
        });
        y += V.STAGE_GAP - V.NODE_GAP;
    });

    for (let i = 0; i + 1 < stages.length; i++) {
        const a = stages[i], b = stages[i + 1];
        edges.push({ from: a.id, to: b.id, type: 'spine',
                     d: `M ${f(a.cx)} ${f(a.cy)} L ${f(b.cx)} ${f(b.cy)}` });
    }
    edges.push(...dependencyEdges(doc, nodes, 'vertical'));
    return {
        orientation: 'vertical',
        width: V.WIDTH,
        height: Math.max(y, V.PAD * 2 + V.HEADER_H) + V.PAD - V.STAGE_GAP + V.NODE_GAP,
        stages, nodes, edges,
        journey: journeyPath(stages, 'vertical'),
        labelChars: 29,
    };
}

function journeyPath(stages: Placed2DStage[], orientation: 'horizontal' | 'vertical'): string {
    if (!stages.length) return '';
    if (orientation === 'vertical') {
        return `M ${f(stages[0].cx)} ${f(stages[0].cy)} ` +
            stages.slice(1).map(s => `L ${f(s.cx)} ${f(s.cy)}`).join(' ');
    }
    let d = `M ${f(stages[0].x)} ${f(stages[0].cy)} L ${f(stages[0].x + stages[0].w)} ${f(stages[0].cy)}`;
    for (let i = 1; i < stages.length; i++) {
        const a = stages[i - 1], b = stages[i];
        const x1 = a.x + a.w, x2 = b.x, dx = (x2 - x1) * 0.55;
        d += ` C ${f(x1 + dx)} ${f(a.cy)}, ${f(x2 - dx)} ${f(b.cy)}, ${f(x2)} ${f(b.cy)} L ${f(b.x + b.w)} ${f(b.cy)}`;
    }
    return d;
}

function dependencyEdges(doc: RoadmapDoc, placed: Placed2DNode[], orientation: 'horizontal' | 'vertical'): Placed2DEdge[] {
    const at = new Map(placed.map(p => [p.id, p]));
    const stageIndex = new Map(doc.stages.map((s, i) => [s.id, i]));
    const out: Placed2DEdge[] = [];
    for (const node of allNodes(doc)) {
        const b = at.get(node.id);
        if (!b) continue;
        for (const dep of node.depends_on) {
            const a = at.get(dep);
            if (!a) continue;
            let d: string;
            if (orientation === 'vertical') {
                // Down the right-hand margin, which is reserved for exactly this.
                const x1 = a.x + a.w, x2 = b.x + b.w, bend = V.DEP_ROOM - 4;
                d = `M ${f(x1)} ${f(a.cy)} C ${f(x1 + bend)} ${f(a.cy)}, ${f(x2 + bend)} ${f(b.cy)}, ${f(x2)} ${f(b.cy)}`;
            } else if ((stageIndex.get(a.stageId) ?? 0) < (stageIndex.get(b.stageId) ?? 0)) {
                const x1 = a.x + a.w, x2 = b.x, dx = Math.max(30, (x2 - x1) * 0.45);
                d = `M ${f(x1)} ${f(a.cy)} C ${f(x1 + dx)} ${f(a.cy)}, ${f(x2 - dx)} ${f(b.cy)}, ${f(x2)} ${f(b.cy)}`;
            } else if (a.stageId === b.stageId) {
                // Same column: loop out to the right of the boxes.
                const x = a.x + a.w, bend = 22;
                d = `M ${f(x)} ${f(a.cy)} C ${f(x + bend)} ${f(a.cy)}, ${f(x + bend)} ${f(b.cy)}, ${f(x)} ${f(b.cy)}`;
            } else {
                // A dependency on a LATER stage: drawn back, left to right in reverse.
                const x1 = a.x, x2 = b.x + b.w, dx = Math.max(30, (x1 - x2) * 0.45);
                d = `M ${f(x1)} ${f(a.cy)} C ${f(x1 - dx)} ${f(a.cy)}, ${f(x2 + dx)} ${f(b.cy)}, ${f(x2)} ${f(b.cy)}`;
            }
            out.push({ from: dep, to: node.id, type: 'dependency', d });
        }
    }
    return out;
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
    return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap
        && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/* ------------------------------------------------------------------ *
 * 3D layout — a rising spiral of stages, nodes orbiting each one
 * ------------------------------------------------------------------ */

export interface Vec3 { x: number; y: number; z: number }
export interface Placed3DStage extends Vec3 { id: string; index: number; angle: number; radius: number }
export interface Placed3DNode extends Vec3 { id: string; stageId: string; kind: NodeKind; size: number }
export interface TourStop { stageId: string; target: Vec3; camera: Vec3 }

export interface Layout3D {
    stages: Placed3DStage[];
    nodes: Placed3DNode[];
    /** Points the journey tube passes through, start to end. */
    path: Vec3[];
    center: Vec3;
    /** Radius of a sphere that contains everything. */
    extent: number;
    tour: TourStop[];
    /** The camera that shows the whole map. */
    overview: { target: Vec3; camera: Vec3 };
}

export const SPIRAL = {
    RADIUS: 15, STEP_ANGLE: 0.9, RISE: 3.6, PER_RING: 12,
    RING_MIN: 2.5, RING_PER_NODE: 0.2, TIER_RISE: 1.6, NODE_LIFT: 1.15, NODE_SIZE: 0.55,
    STAGE_RADIUS: 1.9,
};

/**
 * Stage i sits on a helix: angle i·STEP, height i·RISE. Its nodes orbit it in
 * rings of at most PER_RING, a ring per tier, each tier higher than the last.
 * The angle offset of a ring starts at the stage's own angle so the first node
 * of every stage faces OUTWARD — towards where the tour camera stands.
 */
export function layout3D(doc: RoadmapDoc): Layout3D {
    const S = SPIRAL;
    const stages: Placed3DStage[] = [];
    const nodes: Placed3DNode[] = [];

    doc.stages.forEach((stage, i) => {
        const angle = i * S.STEP_ANGLE;
        const ps: Placed3DStage = {
            id: stage.id, index: i, angle, radius: S.STAGE_RADIUS,
            x: f3(S.RADIUS * Math.cos(angle)), y: f3(i * S.RISE), z: f3(S.RADIUS * Math.sin(angle)),
        };
        stages.push(ps);
        const m = stage.nodes.length;
        stage.nodes.forEach((node, j) => {
            const tier = Math.floor(j / S.PER_RING);
            const inTier = Math.min(S.PER_RING, m - tier * S.PER_RING);
            const k = j % S.PER_RING;
            const r = S.RING_MIN + S.RING_PER_NODE * inTier - tier * 1.0;
            const a = angle + (k / inTier) * Math.PI * 2 + tier * 0.35;
            nodes.push({
                id: node.id, stageId: stage.id, kind: node.kind, size: S.NODE_SIZE,
                x: f3(ps.x + r * Math.cos(a)),
                y: f3(ps.y + S.NODE_LIFT + tier * S.TIER_RISE + (k % 2) * 0.35),
                z: f3(ps.z + r * Math.sin(a)),
            });
        });
    });

    // The tube between consecutive stages follows the helix itself.
    const path: Vec3[] = [];
    for (let i = 0; i < stages.length; i++) {
        if (i === 0) path.push({ x: stages[0].x, y: stages[0].y, z: stages[0].z });
        if (i + 1 >= stages.length) break;
        for (let s = 1; s <= 8; s++) {
            const t = i + s / 8;
            const a = t * S.STEP_ANGLE;
            path.push({ x: f3(S.RADIUS * Math.cos(a)), y: f3(t * S.RISE), z: f3(S.RADIUS * Math.sin(a)) });
        }
    }

    const pts: Vec3[] = [...stages, ...nodes];
    const center = pts.length
        ? { x: f3(avg(pts.map(p => p.x))), y: f3(avg(pts.map(p => p.y))), z: f3(avg(pts.map(p => p.z))) }
        : { x: 0, y: 0, z: 0 };
    const extent = Math.max(S.RADIUS, ...pts.map(p => Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z))) + 2;

    const tour: TourStop[] = stages.map(s => {
        const out = { x: Math.cos(s.angle), z: Math.sin(s.angle) };
        const target = { x: s.x, y: f3(s.y + 1.4), z: s.z };
        return {
            stageId: s.id, target,
            camera: { x: f3(s.x + out.x * 11), y: f3(s.y + 6.5), z: f3(s.z + out.z * 11) },
        };
    });

    const dist = extent * 2.1;
    return {
        stages, nodes, path, center, extent, tour,
        overview: {
            target: center,
            camera: { x: f3(center.x + dist * 0.62), y: f3(center.y + dist * 0.5), z: f3(center.z + dist * 0.62) },
        },
    };
}

const f3 = (n: number) => Math.round(n * 1000) / 1000;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

export function distance(a: Vec3, b: Vec3): number {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Ease for camera flights and reveals: smooth at both ends. */
export function easeInOut(t: number): number {
    const x = Math.min(1, Math.max(0, t));
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
