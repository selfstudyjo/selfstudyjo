/**
 * dbt Cloud: the shapes the portal reads from the engine's `view().dbt` block,
 * its routes and URLs, and the pieces of logic that are easy to get wrong -
 * the lineage graph and dbt's node selection syntax (`+model`, `model+`,
 * `2+model`, `@model`, `tag:`, `path:`, `source:`), the DAG layout, the cron
 * text, the file tree and a tokenizer for the read-only code view.
 *
 * Plain module: no Vue, no DOM. The engine is `selfstudyuserlab/utils/sims/
 * dataplat/dbt.py` (dbt Core) plus `dbtcloud.py` (environments, jobs, runs);
 * every write goes through a `dbt ...` or `dbt-cloud ...` command line.
 */

export interface DbtColumn { name: string; description: string; tests: string[] }

export interface DbtModel {
    unique_id: string; name: string; path: string; tags: string[]; relation: string;
    database: string; schema: string; depends_on: string[]; materialized: string;
    description: string; unique_key: string | null; incremental_strategy: string | null;
    columns: DbtColumn[]; sources: string[]; last_status: string | null; rows: number | null;
    execution_time: number | null; compiled_sql: string | null; tests: string[];
    incremental_mode: string | null;
}

export interface DbtSource {
    unique_id: string; source: string; name: string; relation: string;
    loaded_at_field: string | null; has_freshness: boolean;
    freshness: { status: string | null; max_loaded_at: string | null; age_minutes: number | null };
}

export interface DbtTest {
    unique_id: string; name: string; kind: string; test_name: string; column: string | null;
    model: string | null; attached: string | null; severity: string | null; depends_on: string[];
    path: string; last_status: string | null; failures: number | null;
}

export interface DbtSeedLike {
    unique_id: string; name: string; path: string; relation: string; depends_on: string[];
    tags: string[]; last_status: string | null; rows: number | null; strategy?: string; unique_key?: string;
}

export interface DbtExposure {
    name: string; type: string; owner: string; depends_on: string[]; url: string; path: string;
}

export interface DbtResult {
    unique_id: string; status: string; execution_time: number | null; message: string | null;
    rows: number | null; step?: number;
}

export interface DbtCoreRun {
    id: string; command: string; at: number; time: string; status: string; elapsed_s: number;
    target: string; counts: Record<string, number>; results: DbtResult[];
}

export interface CloudEnv {
    id: number; name: string; type: string; deployment_type: string | null; dbt_version: string;
    target_name: string; threads: number; connection: string; custom_branch: string | null;
}

export interface CloudJob {
    id: number; environment_id: number; name: string; description: string; execute_steps: string[];
    settings: { threads: number; target_name: string | null };
    triggers: { schedule: boolean };
    schedule: { cron: string | null };
    generate_docs: boolean; run_generate_sources: boolean; created_at: string; updated_at: string;
    last_run: { id: number; status: string; finished_at: string; duration_s: number } | null;
    next_run: string | null;
}

export interface CloudStep {
    index: number; name: string; command?: string; status: number; duration_s: number;
    logs: string[]; dbt_run_id?: string | null; counts?: Record<string, number> | null; warning?: boolean;
}

export interface CloudRun {
    id: number; job_definition_id: number; job_name: string; environment_id: number;
    environment_name: string | null; target: string; trigger: { cause: string; type: string };
    status: number; status_humanized: string; git_branch: string; git_sha: string;
    created_at: string; started_at: string; finished_at: string; duration_s: number;
    run_steps: number; steps: CloudStep[]; results: DbtResult[]; docs_generated: boolean;
    retried_from?: number;
}

export interface FileItem { path: string; size: number; generated: boolean; content: string | null }

export type DbtRoute =
    | { page: 'develop' }
    | { page: 'runs' }
    | { page: 'run'; id: number }
    | { page: 'jobs' }
    | { page: 'job'; id: number }
    | { page: 'job-edit'; id: number | null; envId?: number }
    | { page: 'environments' }
    | { page: 'environment'; id: number }
    | { page: 'explore' }
    | { page: 'lineage'; select?: string }
    | { page: 'resource'; id: string };

export const ACCOUNT = 71203;
export const PROJECT = 40112;
const BASE = 'https://cloud.getdbt.com';

export function routeUrl(route: DbtRoute, envSlug = 'production'): string {
    const deploy = `${BASE}/deploy/${ACCOUNT}/projects/${PROJECT}`;
    const explore = `${BASE}/explore/${ACCOUNT}/projects/${PROJECT}/environments/${envSlug}`;
    switch (route.page) {
        case 'develop': return `${BASE}/develop/${ACCOUNT}/projects/${PROJECT}`;
        case 'runs': return `${deploy}/runs/`;
        case 'run': return `${deploy}/runs/${route.id}/`;
        case 'jobs': return `${deploy}/jobs/`;
        case 'job': return `${deploy}/jobs/${route.id}`;
        case 'job-edit': return route.id ? `${deploy}/jobs/${route.id}/settings` : `${deploy}/jobs/create/deploy`;
        case 'environments': return `${deploy}/environments/`;
        case 'environment': return `${deploy}/environments/${route.id}`;
        case 'explore': return `${explore}/`;
        case 'lineage': return `${explore}/lineage${route.select ? '?select=' + encodeURIComponent(route.select) : ''}`;
        case 'resource': return `${explore}/details/${route.id}`;
        default: return `${deploy}/`;
    }
}

/* ---------------------------------------------------------------- graph */

export type NodeKind = 'source' | 'model' | 'seed' | 'snapshot' | 'test' | 'exposure';

export interface GNode {
    id: string; name: string; kind: NodeKind; label: string; status: string | null;
    tags: string[]; path: string; materialized?: string;
}

export interface Graph {
    nodes: Map<string, GNode>;
    parents: Map<string, string[]>;
    children: Map<string, string[]>;
}

/** `ref('x')` / `source('a', 'b')` in an exposure's depends_on, to a node id. */
function exposureDep(text: string, byName: Map<string, string>): string | null {
    const ref = text.match(/ref\(\s*['"]([^'"]+)['"]\s*\)/);
    if (ref) return byName.get(ref[1] || '') || null;
    const src = text.match(/source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    if (src) return byName.get(`${src[1] || ''}.${src[2] || ''}`) || null;
    return byName.get(text) || null;
}

export function buildGraph(view: {
    models: DbtModel[]; sources: DbtSource[]; seeds: DbtSeedLike[]; snapshots: DbtSeedLike[];
    tests: DbtTest[]; exposures: DbtExposure[];
}, withTests = false): Graph {
    const nodes = new Map<string, GNode>();
    const parents = new Map<string, string[]>();
    const byName = new Map<string, string>();
    const add = (node: GNode, deps: string[]) => {
        nodes.set(node.id, node);
        parents.set(node.id, deps.slice());
    };
    for (const s of view.sources) {
        add({ id: s.unique_id, name: `${s.source}.${s.name}`, kind: 'source', label: `${s.source}.${s.name}`,
              status: s.freshness?.status || null, tags: [], path: '' }, []);
        byName.set(`${s.source}.${s.name}`, s.unique_id);
    }
    for (const s of view.seeds) {
        add({ id: s.unique_id, name: s.name, kind: 'seed', label: s.name, status: s.last_status,
              tags: s.tags || [], path: s.path }, s.depends_on || []);
        byName.set(s.name, s.unique_id);
    }
    for (const s of view.snapshots) {
        add({ id: s.unique_id, name: s.name, kind: 'snapshot', label: s.name, status: s.last_status,
              tags: s.tags || [], path: s.path }, s.depends_on || []);
        byName.set(s.name, s.unique_id);
    }
    for (const m of view.models) {
        add({ id: m.unique_id, name: m.name, kind: 'model', label: m.name, status: m.last_status,
              tags: m.tags || [], path: m.path, materialized: m.materialized }, m.depends_on || []);
        byName.set(m.name, m.unique_id);
    }
    if (withTests) {
        for (const t of view.tests) {
            add({ id: t.unique_id, name: t.name, kind: 'test', label: t.test_name || t.name,
                  status: t.last_status, tags: [], path: t.path }, t.depends_on || []);
        }
    }
    for (const e of view.exposures) {
        const id = `exposure.${e.name}`;
        const deps = (e.depends_on || []).map(d => exposureDep(d, byName)).filter((d): d is string => !!d);
        add({ id, name: e.name, kind: 'exposure', label: e.name, status: null, tags: [], path: e.path }, deps);
    }
    const children = new Map<string, string[]>();
    for (const id of nodes.keys()) children.set(id, []);
    for (const [id, deps] of parents) {
        const known = deps.filter(d => nodes.has(d));
        parents.set(id, known);
        for (const d of known) children.get(d)!.push(id);
    }
    return { nodes, parents, children };
}

function walk(graph: Graph, start: string, dir: 'up' | 'down', depth: number | null): Set<string> {
    const seen = new Set<string>();
    let frontier = [start];
    let level = 0;
    while (frontier.length && (depth === null || level < depth)) {
        const next: string[] = [];
        for (const id of frontier) {
            for (const other of (dir === 'up' ? graph.parents : graph.children).get(id) || []) {
                if (!seen.has(other)) { seen.add(other); next.push(other); }
            }
        }
        frontier = next;
        level += 1;
    }
    return seen;
}

function matchAtom(graph: Graph, atom: string): string[] {
    const lower = atom.toLowerCase();
    const all = [...graph.nodes.values()];
    if (lower.startsWith('tag:')) return all.filter(n => n.tags.includes(atom.slice(4))).map(n => n.id);
    if (lower.startsWith('path:')) {
        const p = atom.slice(5).replace(/\/$/, '');
        return all.filter(n => n.path === p || n.path.startsWith(p + '/')).map(n => n.id);
    }
    if (lower.startsWith('source:')) {
        const rest = atom.slice(7);
        return all.filter(n => n.kind === 'source' && (n.name === rest || n.name.split('.')[0] === rest)).map(n => n.id);
    }
    if (lower.startsWith('resource_type:')) {
        const t = atom.slice(14);
        return all.filter(n => n.kind === t).map(n => n.id);
    }
    if (lower.startsWith('config.materialized:')) {
        const m = atom.slice(20);
        return all.filter(n => n.materialized === m).map(n => n.id);
    }
    if (atom.includes('*')) {
        const re = new RegExp('^' + atom.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
        return all.filter(n => re.test(n.name)).map(n => n.id);
    }
    return all.filter(n => n.name === atom || n.id === atom).map(n => n.id);
}

/**
 * dbt's node selection, for highlighting the lineage graph. Space separates a
 * union; a comma inside one term is an intersection.
 */
export function selectNodes(graph: Graph, expr: string): Set<string> {
    const out = new Set<string>();
    for (const term of String(expr || '').trim().split(/\s+/).filter(Boolean)) {
        let acc: Set<string> | null = null;
        for (const part of term.split(',').filter(Boolean)) {
            const found = new Set<string>();
            const m = part.match(/^(@)?(\d*\+)?(.*?)(\+\d*)?$/);
            if (!m) continue;
            const [, at, up, atomRaw, down] = m;
            for (const id of matchAtom(graph, atomRaw || '')) {
                found.add(id);
                if (up || at) {
                    const depth = up && up.length > 1 ? Number(up.slice(0, -1)) : null;
                    walk(graph, id, 'up', at ? null : depth).forEach(x => found.add(x));
                }
                if (down || at) {
                    const depth = down && down.length > 1 ? Number(down.slice(1)) : null;
                    const kids = walk(graph, id, 'down', at ? null : depth);
                    kids.forEach(x => found.add(x));
                    if (at) kids.forEach(k => walk(graph, k, 'up', null).forEach(x => found.add(x)));
                }
            }
            if (acc === null) {
                acc = found;
            } else {
                const both = new Set<string>();
                for (const x of acc as Set<string>) if (found.has(x)) both.add(x);
                acc = both;
            }
        }
        (acc as Set<string> | null)?.forEach(x => out.add(x));
    }
    return out;
}

export interface Placed { id: string; x: number; y: number; layer: number }

/** A layered (Sugiyama-lite) layout: longest path from a root, then a barycentre pass. */
export function layout(graph: Graph, ids: Set<string> | null, colW = 210, rowH = 54): {
    placed: Map<string, Placed>; width: number; height: number;
} {
    const keep = (id: string) => !ids || ids.has(id);
    const layer = new Map<string, number>();
    const depth = (id: string, seen: Set<string>): number => {
        if (layer.has(id)) return layer.get(id)!;
        if (seen.has(id)) return 0;
        seen.add(id);
        const ps = (graph.parents.get(id) || []).filter(keep);
        const value = ps.length ? Math.max(...ps.map(p => depth(p, seen) + 1)) : 0;
        layer.set(id, value);
        return value;
    };
    const order = [...graph.nodes.keys()].filter(keep).sort();
    order.forEach(id => depth(id, new Set()));
    const columns: string[][] = [];
    for (const id of order) {
        const l = layer.get(id) || 0;
        (columns[l] = columns[l] || []).push(id);
    }
    const kindRank: Partial<Record<string, number>> = { source: 0, seed: 1, snapshot: 2, model: 3, test: 4, exposure: 5 };
    columns.forEach(col => col.sort((a, b) => ((kindRank[graph.nodes.get(a)!.kind] ?? 9) - (kindRank[graph.nodes.get(b)!.kind] ?? 9))
        || graph.nodes.get(a)!.name.localeCompare(graph.nodes.get(b)!.name)));
    const pos = new Map<string, number>();
    columns.forEach(col => col.forEach((id, i) => pos.set(id, i)));
    for (let pass = 0; pass < 2; pass++) {
        for (let l = 1; l < columns.length; l++) {
            const col = columns[l];
            if (!col) continue;
            const bary = (id: string) => {
                const ps = (graph.parents.get(id) || []).filter(p => pos.has(p));
                return ps.length ? ps.reduce((s, p) => s + pos.get(p)!, 0) / ps.length : pos.get(id)!;
            };
            col.sort((a, b) => bary(a) - bary(b) || a.localeCompare(b));
            col.forEach((id, i) => pos.set(id, i));
        }
    }
    const tallest = Math.max(1, ...columns.map(c => (c ? c.length : 0)));
    const placed = new Map<string, Placed>();
    columns.forEach((col, l) => {
        if (!col) return;
        const offset = (tallest - col.length) * rowH / 2;
        col.forEach((id, i) => placed.set(id, { id, layer: l, x: 24 + l * colW, y: 24 + offset + i * rowH }));
    });
    return { placed, width: 48 + Math.max(1, columns.length) * colW, height: 48 + tallest * rowH };
}

/* ---------------------------------------------------------------- text */

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function cronText(cron: string | null | undefined): string {
    const parts = String(cron || '').trim().split(/\s+/);
    if (parts.length !== 5) return cron ? String(cron) : 'No schedule';
    const [mi = '', h = '', dom = '', mon = '', dow = ''] = parts;
    const pad = (n: string) => n.padStart(2, '0');
    if (/^\d+$/.test(mi) && /^\d+$/.test(h) && dom === '*' && mon === '*') {
        if (dow === '*') return `Every day at ${pad(h)}:${pad(mi)} UTC`;
        if (dow === '1-5') return `Weekdays at ${pad(h)}:${pad(mi)} UTC`;
        if (/^\d$/.test(dow)) return `Every ${DOW[Number(dow) % 7]} at ${pad(h)}:${pad(mi)} UTC`;
    }
    if (/^\d+$/.test(mi) && h === '*' && dom === '*' && mon === '*' && dow === '*') return `Every hour at :${pad(mi)}`;
    const every = h.match(/^\*\/(\d+)$/);
    if (/^\d+$/.test(mi) && every && dom === '*' && mon === '*' && dow === '*') return `Every ${every[1]} hours at :${pad(mi)}`;
    if (/^\d+$/.test(mi) && /^[\d,]+$/.test(h) && dom === '*' && mon === '*' && dow === '*') {
        return `At ${h.split(',').map(x => pad(x) + ':' + pad(mi)).join(', ')} UTC`;
    }
    return `Cron: ${cron}`;
}

export function duration(seconds: number | null | undefined): string {
    const s = Number(seconds || 0);
    if (s < 60) return `${s < 10 ? s.toFixed(2).replace(/\.?0+$/, '') || '0' : Math.round(s)}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${Math.round(s % 60)}s`;
}

/** Relative time between two engine timestamps (`YYYY-MM-DD HH:MM:SS`). */
export function ago(stamp: string | null | undefined, nowStamp: string | null | undefined): string {
    const parse = (t: string) => Date.parse(String(t).replace(' ', 'T') + 'Z');
    if (!stamp) return '—';
    const a = parse(stamp);
    const b = nowStamp ? parse(nowStamp) : a;
    if (Number.isNaN(a) || Number.isNaN(b)) return String(stamp);
    const min = Math.round((b - a) / 60000);
    if (min <= 0) return 'just now';
    if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
    const h = Math.round(min / 60);
    if (h < 48) return `${h} hour${h === 1 ? '' : 's'} ago`;
    const d = Math.round(h / 24);
    return `${d} days ago`;
}

export function statusTone(status: string | number | null | undefined): 'ok' | 'bad' | 'warn' | 'skip' | 'none' {
    const s = String(status ?? '').toLowerCase();
    if (['success', 'pass', '10', 'ok'].includes(s)) return 'ok';
    if (['error', 'fail', '20', 'runtime error'].includes(s)) return 'bad';
    if (s === 'warn') return 'warn';
    if (['skipped', 'skip', '30', 'cancelled'].includes(s)) return 'skip';
    return 'none';
}

/** One row of a right-click menu in the Studio IDE. */
export interface DbtMenuItem {
    label: string;
    icon?: string;
    hint?: string;
    danger?: boolean;
    disabled?: boolean;
    divider?: boolean;
    action?: () => void;
}

/** A file or folder name the IDE accepts - the same rule `dbt-cloud ide` enforces. */
export function validIdePath(path: string): string {
    const rel = path.trim().replace(/^\/+|\/+$/g, '');
    if (!rel) return 'Enter a name.';
    const parts = rel.split('/');
    if (parts.some(p => !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(p))) {
        return "Use letters, digits, '_', '-' and '.', separated by '/'.";
    }
    if (['target', 'dbt_packages', 'logs'].includes(parts[0] ?? '')) return `'${parts[0]}/' is written by dbt and is read-only.`;
    return '';
}

export interface TreeNode { name: string; path: string; dir: boolean; children: TreeNode[]; item?: FileItem }

export function fileTree(items: FileItem[], dirs: string[] = []): TreeNode[] {
    const root: TreeNode = { name: '', path: '', dir: true, children: [] };
    // Empty folders (made with New folder) carry no file, so they come in
    // separately and are added as directory chains first.
    for (const dir of dirs) {
        const parts = String(dir || '').split('/').filter(Boolean);
        let node = root;
        parts.forEach((part, i) => {
            const path = parts.slice(0, i + 1).join('/');
            let child = node.children.find(c => c.name === part && c.dir);
            if (!child) {
                child = { name: part, path, dir: true, children: [] };
                node.children.push(child);
            }
            node = child;
        });
    }
    for (const item of items) {
        const parts = item.path.split('/');
        let node = root;
        parts.forEach((part, i) => {
            const path = parts.slice(0, i + 1).join('/');
            const last = i === parts.length - 1;
            let child = node.children.find(c => c.name === part && c.dir === !last);
            if (!child) {
                child = { name: part, path, dir: !last, children: [] };
                node.children.push(child);
            }
            if (last) child.item = item;
            node = child;
        });
    }
    const sort = (n: TreeNode) => {
        n.children = n.children.filter(c => c.dir || c.name !== '.gitkeep');
        n.children.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
        n.children.forEach(sort);
    };
    sort(root);
    return root.children;
}

export type TokenKind = 'kw' | 'jinja' | 'str' | 'num' | 'com' | 'fn' | 'key' | 'plain';
export interface Token { text: string; kind: TokenKind }

const SQL_KW = new Set(('select from where join left right inner outer full on as and or not null is in ' +
    'group by order having limit with union all distinct case when then else end cast over partition ' +
    'using create table view insert into update delete merge values coalesce lower upper sum count avg ' +
    'min max true false asc desc between like exists qualify row_number date_trunc').split(' '));

/** One line of a file as coloured tokens (SQL + Jinja, or YAML). Text only - never markup. */
export function tokenize(line: string, lang: 'sql' | 'yaml' | 'text'): Token[] {
    if (lang === 'text') return [{ text: line, kind: 'plain' }];
    const out: Token[] = [];
    const push = (text: string, kind: TokenKind) => { if (text) out.push({ text, kind }); };
    if (lang === 'yaml') {
        const c = line.indexOf('#');
        const body = c >= 0 && !/['"]/.test(line.slice(0, c)) ? line.slice(0, c) : line;
        const m = body.match(/^(\s*-?\s*)([\w.+-]+)(:)(.*)$/);
        if (m) { const [, a = '', b = '', c = '', d = ''] = m; push(a, 'plain'); push(b, 'key'); push(c, 'plain'); push(d, /^\s*['"]/.test(d) ? 'str' : 'plain'); }
        else push(body, 'plain');
        if (body !== line) push(line.slice(body.length), 'com');
        return out;
    }
    const re = /(\{\{.*?\}\}|\{%.*?%\}|\{#.*?#\}|--.*$|'(?:[^']|'')*'|"[^"]*"|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][\w$]*\b(?=\s*\()|\b[A-Za-z_][\w$]*\b)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
        push(line.slice(last, m.index), 'plain');
        const t = m[0];
        let kind: TokenKind = 'plain';
        if (t.startsWith('{')) kind = t.startsWith('{#') ? 'com' : 'jinja';
        else if (t.startsWith('--')) kind = 'com';
        else if (t.startsWith("'") || t.startsWith('"')) kind = 'str';
        else if (/^\d/.test(t)) kind = 'num';
        else if (SQL_KW.has(t.toLowerCase())) kind = 'kw';
        else if (/\(/.test(line.slice(m.index + t.length).trimStart().charAt(0))) kind = 'fn';
        push(t, kind);
        last = m.index + t.length;
    }
    push(line.slice(last), 'plain');
    return out;
}

export function langOf(path: string): 'sql' | 'yaml' | 'text' {
    if (/\.sql$/i.test(path)) return 'sql';
    if (/\.ya?ml$/i.test(path)) return 'yaml';
    return 'text';
}

/** The log line's severity, for colouring the command output like the IDE does. */
export function logTone(line: string): 'err' | 'warn' | 'ok' | 'plain' {
    if (/\b(ERROR|FAIL|Error|Encountered an error|Compilation Error|Database Error|Runtime Error)\b/.test(line)) return 'err';
    if (/\bWARN\b/.test(line)) return 'warn';
    if (/\b(OK created|PASS|SUCCESS|Completed successfully)\b/.test(line)) return 'ok';
    return 'plain';
}

/** Resource-type label and colour token for a node kind (the dbt Explorer palette). */
export const KIND_LABEL: Record<NodeKind, string> = {
    source: 'Source', model: 'Model', seed: 'Seed', snapshot: 'Snapshot', test: 'Test', exposure: 'Exposure',
};

/** The engine's simulated clock (minutes since 2026-11-02 06:00 UTC) as a timestamp. */
export function clockStamp(minutes: number | null | undefined): string {
    const t = new Date(Date.UTC(2026, 10, 2, 6, 0, 0) + Number(minutes || 0) * 60000);
    return t.toISOString().slice(0, 19).replace('T', ' ');
}

export function matchesText(text: string, needle: string): boolean {
    const q = String(needle || '').trim().toLowerCase();
    return !q || String(text || '').toLowerCase().includes(q);
}
