/**
 * The lab DOCUMENTATION model: the Definitions window and the GUI half of a
 * task's information window. A PLAIN module - no Vue, no DOM, no three.js - on
 * the `labCatalogue.ts` / `photoMask.ts` precedent, because everything in it is
 * a decision that fails silently and `npm run check:labdocs` drives it in node.
 *
 * Three jobs:
 *
 * 1. LAYOUT a flow diagram (`layoutDiagram`). The glossary describes a diagram
 *    as nodes and edges; this places them. No flowchart library: the good ones
 *    (Mermaid) are a megabyte, and a layered layout of at most a dozen boxes is
 *    eighty lines. The renderer is a plain SVG.
 * 2. COMPOSE the lab-specific half of the Definitions window from the lab the
 *    page already holds (`aboutLab`, `labFlow`) - the glossary and the track
 *    overview come from app 11, the lab's own story comes from its brief, its
 *    objectives and its tasks, so it can never disagree with them.
 * 3. MATCH a task's commands to portal GUI recipes (`guiSections`). A portal
 *    writes by running the command line the console accepts; a recipe says
 *    which clicks produce that line. The commands are read out of the task's
 *    own written steps, so the GUI walkthrough follows the same order as the
 *    terminal one.
 */

// ---------------------------------------------------------------------------
// Types - what app 11's /definitions/ route sends, and the recipe maps
// ---------------------------------------------------------------------------

export type NodeKind = 'start' | 'step' | 'decision' | 'data' | 'end' | 'actor';

export interface DiagramNode { id: string; label: string; kind: NodeKind }
export interface DiagramEdge { from: string; to: string; label?: string }
export interface Diagram { dir: 'LR' | 'TB'; nodes: DiagramNode[]; edges: DiagramEdge[] }

export type SceneKind = 'client-server' | 'layers' | 'pipeline' | 'cluster' | 'database'
    | 'storage' | 'containers' | 'network' | 'tree' | 'branches' | 'cloud' | 'stream'
    | 'security' | 'ai' | 'vehicle' | 'cycle' | 'hub' | 'chart';

export const SCENE_KINDS: SceneKind[] = ['client-server', 'layers', 'pipeline', 'cluster',
    'database', 'storage', 'containers', 'network', 'tree', 'branches', 'cloud', 'stream',
    'security', 'ai', 'vehicle', 'cycle', 'hub', 'chart'];

export interface SceneSpec { kind: SceneKind; labels: string[] }

export interface GlossaryTerm {
    id: string;
    term: string;
    aka: string[];
    category: 'platform' | 'concept' | 'tool' | 'language' | 'resource' | 'practice' | 'role';
    short: string;
    explain: string[];
    example: string;
    analogy: string;
    why: string;
    diagram: Diagram | null;
    scene: SceneSpec | null;
    related: string[];
    /** True for the lab's own terms; false for "see also" terms they point at. */
    primary?: boolean;
}

export interface GlossaryIndexRow { id: string; term: string; short: string; category: string }

export interface TrackOverview {
    product: string;
    tagline: string;
    what: string[];
    how: string[];
    who: string;
    learn: string[];
    before: string[];
    simulated: string;
    diagram: Diagram | null;
    scene: SceneSpec | null;
    core_terms: string[];
}

export interface LabDefinitions {
    lab_id: string;
    track_id: string;
    track: TrackOverview | null;
    terms: GlossaryTerm[];
    previous: Array<{ id: string; title: string }>;
}

export type GuiZone = 'top' | 'nav' | 'tab' | 'toolbar' | 'main' | 'panel' | 'dialog' | 'editor';
export type GuiAction = 'click' | 'type' | 'select' | 'check' | 'drag' | 'see';

export interface GuiStep {
    say: string;
    screen: string;
    nav?: string;
    zone: GuiZone;
    action: GuiAction;
    target: string;
    value?: string;
    optional?: boolean;
}

export interface Recipe {
    id: string;
    title: string;
    match: string;
    steps: GuiStep[];
    verify?: string;
}

export interface WalkthroughMap {
    skin: string;
    product: string;
    brand: string;
    top: string;
    nav: string[];
    recipes: Recipe[];
}

/** One recipe resolved against one command occurrence in a task. */
export interface GuiSection {
    skin: string;
    toolId: string;
    product: string;
    brand: string;
    top: string;
    nav: string[];
    title: string;
    /** The command this section does by clicks, exactly as the step wrote it. */
    command: string;
    steps: GuiStep[];
    verify: string;
}

// Minimal shapes this module reads off the lab - kept structural so it does not
// import labCatalogue.ts (and with it a dependency chain the check would load).
interface ToolLike { id: string; label: string; kind: string; skin?: string; simulated?: boolean;
    fidelity?: string; summary?: string }
interface TaskLike {
    id: string; title: string; detail?: string; hint?: string; gui?: string[];
    instructions?: { goal?: string; steps?: string[] } | null;
    guide?: { kinds?: string[]; files?: string[]; tables?: string[]; commands?: string[];
        hint_commands?: string[]; parts?: string[] } | null;
}

// ---------------------------------------------------------------------------
// 1. Diagram layout
// ---------------------------------------------------------------------------

export const NODE_H = 44;
const CHAR_W = 7.1;          // ~13px system-ui, average glyph
const LINE_CHARS = 22;       // wrap a label onto a second line beyond this
const GAP_MAIN = 64;         // between ranks
const GAP_CROSS = 22;        // between nodes in one rank
const PAD = 16;

export interface PlacedNode extends DiagramNode { x: number; y: number; w: number; h: number; lines: string[] }
export interface PlacedEdge { from: string; to: string; label: string; d: string; lx: number; ly: number; back: boolean }
export interface DiagramLayout { width: number; height: number; nodes: PlacedNode[]; edges: PlacedEdge[] }

/** Wrap a label onto at most two lines, breaking on spaces; never mid-word unless a word is too long. */
export function wrapLabel(label: string, max = LINE_CHARS): string[] {
    const words = String(label || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        if (!line) line = word;
        else if ((line + ' ' + word).length <= max) line += ' ' + word;
        else { lines.push(line); line = word; }
    }
    lines.push(line);
    if (lines.length <= 2) return lines.map(l => (l.length > max + 6 ? l.slice(0, max + 5) + '…' : l));
    const second = lines.slice(1).join(' ');
    return [lines[0], second.length > max ? second.slice(0, max - 1) + '…' : second];
}

/**
 * Rank every node by its longest distance from a source, ignoring edges that
 * close a cycle. Cycles are common here on purpose (a request goes out and the
 * response comes back), so a naive longest-path would never terminate.
 */
export function rankNodes(diagram: Diagram): Map<string, number> {
    const ids = diagram.nodes.map(n => n.id);
    const out = new Map<string, string[]>(ids.map(id => [id, []]));
    const indeg = new Map<string, number>(ids.map(id => [id, 0]));
    // Back edges are found by DFS in declaration order: an edge to a node
    // still on the stack closes a cycle.
    const back = new Set<string>();
    const state = new Map<string, number>();
    const adj = new Map<string, string[]>(ids.map(id => [id, []]));
    for (const e of diagram.edges) if (adj.has(e.from) && adj.has(e.to)) adj.get(e.from)!.push(e.to);
    const visit = (id: string) => {
        state.set(id, 1);
        for (const to of adj.get(id) || []) {
            if (state.get(to) === 1) back.add(`${id}>${to}`);
            else if (!state.get(to)) visit(to);
        }
        state.set(id, 2);
    };
    for (const id of ids) if (!state.get(id)) visit(id);
    for (const e of diagram.edges) {
        if (!out.has(e.from) || !out.has(e.to) || e.from === e.to || back.has(`${e.from}>${e.to}`)) continue;
        out.get(e.from)!.push(e.to);
        indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
    }
    const rank = new Map<string, number>(ids.map(id => [id, 0]));
    const queue = ids.filter(id => !indeg.get(id));
    while (queue.length) {
        const id = queue.shift()!;
        for (const to of out.get(id)!) {
            rank.set(to, Math.max(rank.get(to)!, rank.get(id)! + 1));
            indeg.set(to, indeg.get(to)! - 1);
            if (!indeg.get(to)) queue.push(to);
        }
    }
    return rank;
}

export function layoutDiagram(diagram: Diagram, opts: { lineChars?: number } = {}): DiagramLayout {
    const lr = diagram.dir !== 'TB';
    const rank = rankNodes(diagram);
    const ranks: string[][] = [];
    for (const node of diagram.nodes) (ranks[rank.get(node.id)!] ||= []).push(node.id);
    const byId = new Map<string, PlacedNode>();
    for (const node of diagram.nodes) {
        const lines = wrapLabel(node.label, opts.lineChars || LINE_CHARS);
        const longest = Math.max(...lines.map(l => l.length));
        const w = Math.max(96, Math.min(220, Math.round(longest * CHAR_W + 32)));
        const h = lines.length > 1 ? NODE_H + 16 : NODE_H;
        byId.set(node.id, { ...node, x: 0, y: 0, w, h, lines });
    }
    // Main axis: each rank is as deep as its widest (LR) / tallest (TB) node.
    let main = PAD;
    let crossMax = 0;
    const rankMain: number[] = [];
    const rankSize: number[] = [];
    ranks.forEach((ids, r) => {
        const nodes = (ids || []).map(id => byId.get(id)!);
        const depth = Math.max(0, ...nodes.map(n => (lr ? n.w : n.h)));
        rankMain[r] = main;
        rankSize[r] = depth;
        main += depth + GAP_MAIN;
        const cross = nodes.reduce((sum, n) => sum + (lr ? n.h : n.w), 0) + GAP_CROSS * Math.max(0, nodes.length - 1);
        crossMax = Math.max(crossMax, cross);
    });
    ranks.forEach((ids, r) => {
        const nodes = (ids || []).map(id => byId.get(id)!);
        const cross = nodes.reduce((sum, n) => sum + (lr ? n.h : n.w), 0) + GAP_CROSS * Math.max(0, nodes.length - 1);
        let at = PAD + (crossMax - cross) / 2;
        for (const n of nodes) {
            if (lr) { n.x = rankMain[r] + (rankSize[r] - n.w) / 2; n.y = at; at += n.h + GAP_CROSS; }
            else { n.y = rankMain[r] + (rankSize[r] - n.h) / 2; n.x = at; at += n.w + GAP_CROSS; }
        }
    });
    const width = Math.ceil(lr ? main - GAP_MAIN + PAD : crossMax + PAD * 2);
    const height = Math.ceil(lr ? crossMax + PAD * 2 : main - GAP_MAIN + PAD);
    const edges: PlacedEdge[] = [];
    let backCount = 0;
    for (const e of diagram.edges) {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) continue;
        const forward = rank.get(b.id)! > rank.get(a.id)!;
        let d: string, lx: number, ly: number;
        if (forward) {
            const [x1, y1] = lr ? [a.x + a.w, a.y + a.h / 2] : [a.x + a.w / 2, a.y + a.h];
            const [x2, y2] = lr ? [b.x, b.y + b.h / 2] : [b.x + b.w / 2, b.y];
            const mid = lr ? (x1 + x2) / 2 : (y1 + y2) / 2;
            d = lr ? `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`
                   : `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`;
            lx = (x1 + x2) / 2; ly = (y1 + y2) / 2;
        } else {
            // A back edge loops around the OUTSIDE (below for LR, right for TB),
            // each further out than the last so two returns do not overlap.
            backCount += 1;
            const off = 26 + backCount * 14;
            if (lr) {
                const y1 = a.y + a.h, y2 = b.y + b.h;
                const low = Math.max(y1, y2) + off;
                const x1 = a.x + a.w / 2, x2 = b.x + b.w / 2;
                d = `M${x1},${y1} C${x1},${low} ${x2},${low} ${x2},${y2}`;
                lx = (x1 + x2) / 2; ly = low - 10;
            } else {
                const x1 = a.x + a.w, x2 = b.x + b.w;
                const right = Math.max(x1, x2) + off;
                const y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
                d = `M${x1},${y1} C${right},${y1} ${right},${y2} ${x2},${y2}`;
                lx = right - 6; ly = (y1 + y2) / 2;
            }
        }
        edges.push({ from: e.from, to: e.to, label: e.label || '', d, lx, ly, back: !forward });
    }
    const extra = backCount ? 40 + backCount * 14 : 0;
    return {
        width: lr ? width : width + extra,
        height: lr ? height + extra : height,
        nodes: [...byId.values()],
        edges,
    };
}

// ---------------------------------------------------------------------------
// 2. The lab's own story
// ---------------------------------------------------------------------------

/**
 * The prose of a brief: its paragraphs and list items without the headings,
 * fences, tables and quotes. Read off the raw text rather than through
 * `lessonContent.blocks`, so this module stays free of imports; the brief is
 * still rendered by `LabBrief` with the real parser.
 */
export function briefProse(brief: string, max = 3): string[] {
    const out: string[] = [];
    let inFence = false;
    let para: string[] = [];
    const flush = () => {
        // Inline markers are notation, not prose: **bold**, `code`, [text](url).
        const text = para.join(' ').replace(/\s+/g, ' ')
            .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
        if (text.length > 24) out.push(text);
        para = [];
    };
    for (const raw of String(brief || '').split('\n')) {
        const line = raw.trim();
        if (/^```/.test(line)) { flush(); inFence = !inFence; continue; }
        if (inFence) continue;
        if (!line || /^(#|\||>|[-*]\s|\d+\.\s)/.test(line)) { flush(); continue; }
        para.push(line);
    }
    flush();
    return out.slice(0, max);
}

/** The lab's tasks as a flow chart: start, each task in order, the check. */
export function labFlow(tasks: Array<{ id: string; title: string }>, labels: { start: string; end: string }): Diagram {
    const nodes: DiagramNode[] = [{ id: '__start', label: labels.start, kind: 'start' }];
    tasks.slice(0, 14).forEach((task, at) => {
        nodes.push({ id: `t${at}`, label: `${at + 1}. ${task.title}`, kind: 'step' });
    });
    nodes.push({ id: '__end', label: labels.end, kind: 'end' });
    const edges: DiagramEdge[] = [];
    for (let at = 1; at < nodes.length; at += 1) edges.push({ from: nodes[at - 1].id, to: nodes[at].id });
    return { dir: 'TB', nodes, edges };
}

export interface ToolSummary { id: string; label: string; kind: string; simulated: boolean; fidelity: string; summary: string }

/** What the lab gives the student to work with, in the order the lab lists them. */
export function labToolsSummary(tools: ToolLike[]): ToolSummary[] {
    return tools.filter(t => t.kind !== 'ai').map(t => ({
        id: t.id, label: t.label, kind: t.kind, simulated: Boolean(t.simulated),
        fidelity: String(t.fidelity || ''), summary: String(t.summary || ''),
    }));
}

/**
 * Search terms by name, other names and the definition. Name matches first,
 * then a definition match - a reader typing "pod" wants Pod, not every term
 * whose explanation mentions one.
 */
export function searchTerms<T extends { term: string; short: string; aka?: string[] }>(terms: T[], query: string): T[] {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return terms.slice();
    const name: T[] = [];
    const body: T[] = [];
    for (const t of terms) {
        const names = [t.term, ...(t.aka || [])].map(s => s.toLowerCase());
        if (names.some(n => n.includes(q))) name.push(t);
        else if (t.short.toLowerCase().includes(q)) body.push(t);
    }
    const starts = (t: T) => (t.term.toLowerCase().startsWith(q) ? 0 : 1);
    return [...name.sort((a, b) => starts(a) - starts(b) || a.term.localeCompare(b.term)), ...body];
}

// ---------------------------------------------------------------------------
// 3. GUI walkthroughs
// ---------------------------------------------------------------------------

const RX_CACHE = new Map<string, RegExp | null>();

export function recipeRegex(source: string): RegExp | null {
    if (!RX_CACHE.has(source)) {
        let rx: RegExp | null = null;
        try { rx = new RegExp(source, 'gi'); } catch { rx = null; }
        RX_CACHE.set(source, rx);
    }
    return RX_CACHE.get(source)!;
}

/** `{1}`..`{9}` replaced by capture groups; `null` if a referenced group is empty. */
export function fillCaptures(text: string, groups: Array<string | undefined>): string | null {
    let missing = false;
    const out = String(text || '').replace(/\{(\d)\}/g, (_, n) => {
        const value = groups[Number(n)];
        if (value === undefined || value === '') { missing = true; return ''; }
        return value;
    });
    return missing ? null : out;
}

/** The texts a task's commands are read from, in reading order. */
export function taskTexts(task: TaskLike): string[] {
    const texts: string[] = [];
    for (const step of task.instructions?.steps || []) texts.push(step);
    for (const code of task.guide?.commands || []) texts.push(code);
    if (task.detail) texts.push(task.detail);
    for (const code of task.guide?.hint_commands || []) texts.push(code);
    return texts;
}

interface Hit { text: number; at: number; end: number; recipe: Recipe; groups: Array<string | undefined>; match: string }

/** Every recipe occurrence in the texts, non-overlapping, earliest recipe winning a tie. */
export function findRecipeHits(texts: string[], map: WalkthroughMap): Hit[] {
    const hits: Hit[] = [];
    texts.forEach((text, ti) => {
        const taken: Array<[number, number]> = [];
        for (const recipe of map.recipes) {
            const rx = recipeRegex(recipe.match);
            if (!rx) continue;
            rx.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = rx.exec(text))) {
                if (!m[0]) { rx.lastIndex += 1; continue; }
                const at = m.index, end = at + m[0].length;
                if (!taken.some(([a, b]) => at < b && end > a)) {
                    taken.push([at, end]);
                    hits.push({ text: ti, at, end, recipe, groups: Array.from(m), match: m[0] });
                }
            }
        }
    });
    return hits.sort((a, b) => a.text - b.text || a.at - b.at);
}

/** One recipe resolved against one command: values filled, unfillable optional steps dropped. */
export function resolveRecipe(recipe: Recipe, groups: Array<string | undefined>): GuiStep[] | null {
    const steps: GuiStep[] = [];
    for (const step of recipe.steps) {
        const say = fillCaptures(step.say, groups);
        const value = step.value === undefined ? undefined : fillCaptures(step.value, groups);
        if (say === null || value === null) {
            if (step.optional) continue;
            // A required value the command did not supply: keep the step and
            // show the placeholder as the field's own label, never "{1}".
            steps.push({
                ...step, say: step.say.replace(/\{\d\}/g, '…'), value: step.value ? '…' : undefined,
                screen: step.screen.replace(/\{\d\}/g, '…'), target: step.target.replace(/\{\d\}/g, '…'),
            });
            continue;
        }
        steps.push({
            ...step, say, value: value === undefined ? undefined : value,
            screen: fillCaptures(step.screen, groups) ?? step.screen.replace(/\{\d\}/g, '…'),
            target: fillCaptures(step.target, groups) ?? step.target.replace(/\{\d\}/g, '…'),
        });
    }
    return steps.length >= 1 ? steps : null;
}

export const MAX_GUI_SECTIONS = 6;

/**
 * The GUI half of a task's information window.
 *
 * Portals first: the task's `gui` list (decided by app 11's grader from the
 * check) names the portals that can do it; each one's recipes are matched
 * against the task's own written steps. Then the WORKSPACE tools, for what no
 * portal does - a file to write, a query to run, a page to build - because
 * the Files explorer and the Query editor are graphical too, and "use the
 * terminal" is not an answer for somebody who asked how to do it by clicking.
 */
export function guiSections(task: TaskLike, tools: ToolLike[], maps: Record<string, WalkthroughMap>,
                            workspace: WalkthroughMap | null = null): GuiSection[] {
    const texts = taskTexts(task);
    const sections: GuiSection[] = [];
    const seen = new Set<string>();
    const portalIds = (task.gui && task.gui.length) ? task.gui
        : tools.filter(t => t.kind === 'portal').map(t => t.id);
    const portals = portalIds.map(id => tools.find(t => t.id === id)).filter((t): t is ToolLike => Boolean(t && t.skin));
    const push = (section: GuiSection) => {
        // A recipe that only navigates and looks is the same walkthrough
        // whichever read command it came from; one that types a value is a
        // different walkthrough per value (two workspaces are two creates).
        const typesSomething = section.steps.some(s => s.action === 'type' || s.action === 'select');
        const key = typesSomething ? `${section.skin}|${section.title}|${section.command}` : `${section.skin}|${section.title}`;
        if (seen.has(key) || sections.length >= MAX_GUI_SECTIONS) return;
        seen.add(key);
        sections.push(section);
    };
    for (const tool of portals) {
        const map = maps[tool.skin!];
        if (!map) continue;
        for (const hit of findRecipeHits(texts, map)) {
            const steps = resolveRecipe(hit.recipe, hit.groups);
            if (!steps) continue;
            push({
                skin: map.skin, toolId: tool.id, product: map.product, brand: map.brand, top: map.top,
                nav: map.nav, title: hit.recipe.title, command: hit.match.trim(), steps,
                verify: hit.recipe.verify || '',
            });
        }
    }
    if (workspace) {
        for (const section of workspaceSections(task, tools, workspace)) push(section);
    }
    return sections;
}

/** Workspace recipes keyed by what the grader looks at, with the task's own paths. */
export function workspaceSections(task: TaskLike, tools: ToolLike[], map: WalkthroughMap): GuiSection[] {
    const kinds = new Set(task.guide?.kinds || []);
    const out: GuiSection[] = [];
    const byId = (id: string) => map.recipes.find(r => r.id === id);
    const tool = (kind: string) => tools.find(t => t.kind === kind);
    const add = (recipeId: string, toolKind: string, groups: string[], command: string) => {
        const recipe = byId(recipeId);
        const owner = tool(toolKind);
        if (!recipe || !owner) return;
        const steps = resolveRecipe(recipe, ['', ...groups]);
        if (!steps) return;
        out.push({
            skin: map.skin, toolId: owner.id, product: map.product, brand: map.brand, top: owner.label,
            nav: map.nav, title: recipe.title, command, steps, verify: recipe.verify || '',
        });
    };
    if (kinds.has('file_exists') || kinds.has('file_contains')) {
        for (const path of (task.guide?.files || []).slice(0, 2)) {
            add(kinds.has('file_contains') ? 'edit-file' : 'create-file', 'editor', [path], path);
        }
    }
    if (kinds.has('sql_result')) add('run-query', 'query', [(task.guide?.tables || [])[0] || ''], 'SQL');
    if (kinds.has('web_contains')) add('edit-web', 'web', [((task.guide?.parts || ['html'])[0] || 'html').toUpperCase()], 'HTML/CSS/JS');
    return out;
}

/** Every skin a lab's portals use - what the walkthrough loader has to fetch. */
export function skinsForLab(tools: ToolLike[]): string[] {
    return [...new Set(tools.filter(t => t.kind === 'portal' && t.skin).map(t => t.skin as string))];
}
