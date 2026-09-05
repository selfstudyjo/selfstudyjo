/**
 * The lab explorer's model: a flat path list becomes a tree, and every refusal
 * a menu or a drop can hit is decided here.
 *
 * A plain module, no Vue and no DOM, on the `photoMask.ts` / `labCatalogue.ts` /
 * `labTerminal.ts` precedent — because six of the things below are invisible in
 * a screenshot and each of them is the whole feature when it is wrong:
 *
 *  * **AN UNSTABLE COMPARATOR IS A TREE THAT REORDERS ITSELF.** The rows are
 *    re-derived inside a computed that re-evaluates on every keystroke in the
 *    filter box and after every save, so a comparator that is not a total order
 *    moves the row somebody is aiming at as they type. `sortNodes` breaks an
 *    equal name on the raw path, which is unique. Same trap `sortLabs`,
 *    `examShuffle` and `sortScene` document.
 *  * **A FOLDER MOVED INTO ITS OWN DESCENDANT EATS THE TREE.** Re-prefixing `a`
 *    to `a/b` rewrites every key to a path still under `a`. The backend refuses
 *    it and so does `moveProblem`, because the drop has to be REFUSED WHILE
 *    HOVERING — a student who can drop it has been told it is allowed.
 *  * **A DROP ONTO A FOLDER'S OWN PARENT IS A NO-OP, NOT AN ERROR.** Dragging
 *    `src/app.py` onto `src` is the commonest mis-drop there is, and reporting
 *    "src/app.py already exists" for it reads as the explorer being broken.
 *  * **EXPANSION IS KEYED ON THE PATH, so a rename must carry it.** Renaming an
 *    expanded folder otherwise collapses it and everything under it, which reads
 *    as the rename having emptied the folder.
 *  * **A PATH IS NOT A NAME.** The New File box takes a path (`src/main.tf` has
 *    to work); the Rename box takes one segment, and a `/` typed there would
 *    silently move the file somewhere else. Two rules, deliberately.
 *  * **THE ICON IS A NAME, NEVER A COMPONENT.** An icon is a Vue render
 *    function and importing one here would make this module unloadable in node,
 *    which is where it is checked. Same split as `appNav.ts`.
 *
 * **The backend stays authoritative on every path rule.** `pathProblem` mirrors
 * `labenv.valid_path` so a mistake is named before a round trip against a
 * replica whose first answer of the day takes twenty seconds — it is not a
 * second enforcement point, and the message shown on a refusal is always the
 * one that came back.
 */

export interface FileEntry {
    path: string;
    bytes: number;
}

export type NodeKind = 'file' | 'folder';

export interface TreeNode {
    path: string;
    name: string;
    kind: NodeKind;
    bytes: number;
    children: TreeNode[];
}

export interface Row {
    path: string;
    name: string;
    kind: NodeKind;
    depth: number;
    bytes: number;
    /** A folder with something in it — what decides whether a chevron is drawn. */
    hasChildren: boolean;
    expanded: boolean;
}

/** The icon names the explorer draws. Mapped to components in the component. */
export type IconName =
    | 'file' | 'code' | 'markup' | 'style' | 'data' | 'config'
    | 'shell' | 'database' | 'image' | 'doc' | 'lock' | 'terraform';

/* ───────────────────────────── paths ───────────────────────────── */

export function basename(path: string): string {
    const text = String(path || '');
    const cut = text.lastIndexOf('/');
    return cut === -1 ? text : text.slice(cut + 1);
}

export function dirname(path: string): string {
    const text = String(path || '');
    const cut = text.lastIndexOf('/');
    return cut === -1 ? '' : text.slice(0, cut);
}

export function joinPath(folder: string, name: string): string {
    const base = String(folder || '').replace(/\/+$/, '');
    const leaf = String(name || '').replace(/^\/+/, '');
    return base ? `${base}/${leaf}` : leaf;
}

export function extensionOf(path: string): string {
    const name = basename(path);
    const cut = name.lastIndexOf('.');
    // A LEADING DOT IS THE WHOLE NAME, not an extension: `.gitignore` has no
    // extension, and reading one gives every dotfile in the lab the same icon
    // as whatever `gitignore` happens to map to.
    if (cut <= 0) return '';
    return name.slice(cut + 1).toLowerCase();
}

/**
 * Every ancestor folder of a path, shallowest first.
 *
 * What "reveal this file" opens, and what a fresh tree expands so a lab that
 * seeds `src/main.tf` does not open on a single closed folder.
 */
export function ancestorsOf(path: string): string[] {
    const parts = String(path || '').split('/').filter(Boolean);
    const out: string[] = [];
    for (let index = 1; index < parts.length; index += 1) {
        out.push(parts.slice(0, index).join('/'));
    }
    return out;
}

/* ───────────────────────────── the tree ───────────────────────────── */

/**
 * Folders first, then files, each by name — and the tie broken on the PATH.
 *
 * Case-insensitive because that is what every editor does and because
 * `README.md` sorting above `api/` is not what anybody means by alphabetical.
 * `localeCompare` with an explicit locale, so two readers of the same lab see
 * the same order (the browser's default collation differs between them, which
 * `records.ts` already pays for).
 */
export function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.slice().sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
        const byName = a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en');
        if (byName !== 0) return byName;
        return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });
}

/**
 * The nested tree for a flat file list plus the folders nothing implies.
 *
 * `dirs` is what the backend sends and is NOT derived from the file paths here.
 * The implied ones could be; the EMPTY ones cannot, and those are exactly the
 * folders a student has just made with New Folder and is waiting to see.
 */
export function buildTree(files: FileEntry[], dirs: string[] = []): TreeNode[] {
    const root: TreeNode = { path: '', name: '', kind: 'folder', bytes: 0, children: [] };
    const folders = new Map<string, TreeNode>([['', root]]);

    function folderAt(path: string): TreeNode {
        if (folders.has(path)) return folders.get(path)!;
        const parent = folderAt(dirname(path));
        const node: TreeNode = {
            path, name: basename(path), kind: 'folder', bytes: 0, children: [],
        };
        parent.children.push(node);
        folders.set(path, node);
        return node;
    }

    for (const dir of dirs) {
        const path = String(dir || '').replace(/\/+$/, '');
        if (path) folderAt(path);
    }
    for (const entry of files || []) {
        const path = String(entry?.path || '');
        if (!path) continue;
        // A path arriving as both a file and a folder cannot happen through the
        // API (`write` refuses a directory) and could through a hand-edited
        // environment. The FOLDER wins, because it has children to lose.
        if (folders.has(path)) continue;
        folderAt(dirname(path)).children.push({
            path,
            name: basename(path),
            kind: 'file',
            bytes: Number(entry?.bytes) || 0,
            children: [],
        });
    }

    for (const node of folders.values()) node.children = sortNodes(node.children);
    return root.children;
}

/**
 * The rows to draw: every node whose ancestors are all expanded.
 *
 * Flat rather than a recursive component, for two reasons that are not style. A
 * recursive component makes the whole subtree a new scope, so the keyboard
 * cursor, the drag target and the context menu each need their own way back to
 * the top; and a flat list is what `check:labs` can assert on.
 */
export function flatten(nodes: TreeNode[], expanded: Set<string>,
                        depth = 0): Row[] {
    const out: Row[] = [];
    for (const node of nodes) {
        const open = node.kind === 'folder' && expanded.has(node.path);
        out.push({
            path: node.path,
            name: node.name,
            kind: node.kind,
            depth,
            bytes: node.bytes,
            hasChildren: node.kind === 'folder' && node.children.length > 0,
            expanded: open,
        });
        if (open) out.push(...flatten(node.children, expanded, depth + 1));
    }
    return out;
}

/** Every folder in the lab, shallowest first — the New File parent list. */
export function folderPaths(files: FileEntry[], dirs: string[] = []): string[] {
    const seen = new Set<string>();
    for (const dir of dirs) {
        const path = String(dir || '').replace(/\/+$/, '');
        if (path) {
            seen.add(path);
            for (const parent of ancestorsOf(path)) seen.add(parent);
        }
    }
    for (const entry of files || []) {
        for (const parent of ancestorsOf(String(entry?.path || ''))) seen.add(parent);
    }
    return [...seen].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Whether a path names a folder in this tree. */
export function isFolder(path: string, files: FileEntry[],
                         dirs: string[] = []): boolean {
    const target = String(path || '').replace(/\/+$/, '');
    if (!target) return true;
    if ((dirs || []).some(dir => String(dir).replace(/\/+$/, '') === target)) return true;
    const prefix = `${target}/`;
    if ((dirs || []).some(dir => String(dir).startsWith(prefix))) return true;
    return (files || []).some(entry => String(entry?.path || '').startsWith(prefix));
}

export function isFile(path: string, files: FileEntry[]): boolean {
    return (files || []).some(entry => entry?.path === path);
}

export function exists(path: string, files: FileEntry[],
                       dirs: string[] = []): boolean {
    return isFile(path, files) || (Boolean(path) && isFolder(path, files, dirs));
}

/** Every file at or under a path — what a folder delete is about to remove. */
export function filesUnder(path: string, files: FileEntry[]): string[] {
    const prefix = `${String(path || '').replace(/\/+$/, '')}/`;
    return (files || [])
        .map(entry => String(entry?.path || ''))
        .filter(candidate => candidate === path || candidate.startsWith(prefix))
        .sort();
}

/* ───────────────────────────── names ───────────────────────────── */

// `labenv._PATH_RE`, and the two rules under it. Kept in one place so the
// message can say what is allowed rather than only that something is not.
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;
const PATH_START_RE = /^[A-Za-z0-9.]/;
const MAX_PATH = 120;

/**
 * One segment: what the Rename box and New Folder's name take.
 *
 * A `/` is refused HERE and allowed by `pathProblem`, and that difference is the
 * point: a slash typed into Rename would move the file into another folder
 * without saying so, which is a different operation from the one the student
 * asked for.
 */
export function nameProblem(name: string): string | null {
    const text = String(name || '').trim();
    if (!text) return 'A name is needed';
    if (text === '.' || text === '..') return 'That name means something else';
    if (text.includes('/')) return 'A name cannot contain a slash';
    if (!SEGMENT_RE.test(text)) {
        return 'Use letters, digits, dots, dashes and underscores';
    }
    if (!PATH_START_RE.test(text)) return 'Start with a letter, a digit or a dot';
    if (text.length > MAX_PATH) return 'That name is too long';
    return null;
}

/** A whole path: what New File takes, so `src/main.tf` works in one action. */
export function pathProblem(path: string): string | null {
    const text = String(path || '').trim();
    if (!text) return 'A file name is needed';
    if (text.startsWith('/')) return 'Leave off the leading slash';
    if (text.endsWith('/')) return 'A file name cannot end with a slash';
    if (text.includes('\\')) return 'Use forward slashes';
    if (text.length > MAX_PATH) return 'That path is too long';
    if (!PATH_START_RE.test(text)) return 'Start with a letter, a digit or a dot';
    const parts = text.split('/');
    for (const part of parts) {
        const problem = nameProblem(part);
        if (problem) return problem;
    }
    return null;
}

/* ───────────────────────────── moving ───────────────────────────── */

export interface MovePlan {
    /** The path the thing ends up at. */
    to: string;
    /** A sentence when the move must not happen, else null. */
    problem: string | null;
    /** True when the move would change nothing — a drop on its own parent. */
    noop: boolean;
}

/**
 * Where a drop lands, and whether it may.
 *
 * `folder` is `''` for the root, which is a real target: dragging a file OUT of
 * a folder needs somewhere to drop it, and the tree's own background is it.
 */
export function planDrop(source: string, folder: string, files: FileEntry[],
                         dirs: string[] = []): MovePlan {
    const from = String(source || '').replace(/\/+$/, '');
    const into = String(folder || '').replace(/\/+$/, '');
    const to = joinPath(into, basename(from));
    return { to, ...verdict(from, to, into, files, dirs) };
}

/** Where a rename lands, and whether it may. */
export function planRename(source: string, name: string, files: FileEntry[],
                           dirs: string[] = []): MovePlan {
    const from = String(source || '').replace(/\/+$/, '');
    const problem = nameProblem(name);
    const to = joinPath(dirname(from), String(name || '').trim());
    if (problem) return { to, problem, noop: false };
    return { to, ...verdict(from, to, dirname(to), files, dirs) };
}

function verdict(from: string, to: string, into: string, files: FileEntry[],
                 dirs: string[]): { problem: string | null; noop: boolean } {
    if (!from) return { problem: 'Nothing to move', noop: false };
    // A drop on the row's own parent, or a rename to the name it already has.
    // NOT an error: it is the commonest mis-drop in any explorer, and the
    // honest answer is to do nothing quietly.
    if (to === from) return { problem: null, noop: true };
    const problem = pathProblem(to);
    if (problem) return { problem, noop: false };
    if (isFolder(from, files, dirs)) {
        if (into === from || into.startsWith(`${from}/`)) {
            return { problem: 'A folder cannot be moved inside itself', noop: false };
        }
    }
    if (exists(to, files, dirs)) {
        return { problem: `${to} already exists`, noop: false };
    }
    return { problem: null, noop: false };
}

/**
 * The expansion set after a move, with the moved subtree's own state carried.
 *
 * Without this, renaming an open folder collapses it and everything inside it —
 * which reads as the rename having emptied the folder rather than renamed it.
 */
export function remapExpanded(expanded: Iterable<string>, from: string,
                              to: string): Set<string> {
    const prefix = `${from}/`;
    const out = new Set<string>();
    for (const path of expanded) {
        if (path === from) out.add(to);
        else if (path.startsWith(prefix)) out.add(to + '/' + path.slice(prefix.length));
        else out.add(path);
    }
    // Open the new parents, or a file dropped into a collapsed folder appears to
    // have been deleted.
    for (const parent of ancestorsOf(to)) out.add(parent);
    return out;
}

/* ───────────────────────────── presentation ───────────────────────────── */

const ICONS: Record<string, IconName> = {
    py: 'code', js: 'code', mjs: 'code', ts: 'code', tsx: 'code', jsx: 'code',
    java: 'code', go: 'code', rb: 'code', php: 'code', rs: 'code', c: 'code',
    h: 'code', cpp: 'code', cs: 'code', lua: 'code', groovy: 'code',
    html: 'markup', htm: 'markup', vue: 'markup', xml: 'markup', svg: 'markup',
    css: 'style', scss: 'style', sass: 'style', less: 'style',
    json: 'data', yaml: 'data', yml: 'data', toml: 'data', csv: 'data',
    ini: 'config', cfg: 'config', conf: 'config', env: 'config',
    sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'shell',
    sql: 'database', sqlite: 'database', db: 'database',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
    md: 'doc', txt: 'doc', rst: 'doc', log: 'doc',
    tf: 'terraform', tfvars: 'terraform', hcl: 'terraform',
};

const BY_NAME: Record<string, IconName> = {
    dockerfile: 'config',
    makefile: 'shell',
    jenkinsfile: 'config',
    '.gitignore': 'config',
    '.dockerignore': 'config',
    '.env': 'lock',
    'requirements.txt': 'config',
    'package.json': 'config',
};

/**
 * The icon for a path, as a NAME from a closed set.
 *
 * Matched on the whole file name first, because the files this decision is most
 * often about have no extension at all: `Dockerfile`, `Makefile`,
 * `Jenkinsfile`, `.gitignore`. Extension second.
 */
export function iconFor(path: string, kind: NodeKind = 'file'): IconName {
    if (kind === 'folder') return 'file';
    const name = basename(path).toLowerCase();
    if (BY_NAME[name]) return BY_NAME[name];
    return ICONS[extensionOf(path)] || 'file';
}

/** A byte count as an explorer prints it. */
export function humanBytes(bytes: number): string {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10240 ? 1 : 0)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The sentence a folder delete asks with.
 *
 * It NAMES THE COUNT, because "delete src?" and "delete src and the 14 files in
 * it?" are different questions and only one of them is the one being asked.
 */
export function deleteQuestion(path: string, kind: NodeKind,
                               files: FileEntry[]): string {
    if (kind === 'file') return `Delete ${path}?`;
    const inside = filesUnder(path, files).length;
    if (!inside) return `Delete the folder ${path}?`;
    return `Delete the folder ${path} and the ${inside} file(s) in it?`;
}

/** Rows matching a filter, with the folders that lead to them kept. */
export function matchTree(nodes: TreeNode[], query: string): TreeNode[] {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return nodes;
    const out: TreeNode[] = [];
    for (const node of nodes) {
        if (node.kind === 'file') {
            if (node.path.toLowerCase().includes(needle)) out.push(node);
            continue;
        }
        const kids = matchTree(node.children, needle);
        // A folder whose OWN name matches keeps everything under it: somebody
        // filtering for `modules` wants the module, not an empty folder row.
        if (node.path.toLowerCase().includes(needle)) out.push(node);
        else if (kids.length) out.push({ ...node, children: kids });
    }
    return out;
}
