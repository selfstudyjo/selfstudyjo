/**
 * GitHub Desktop's half of the portal kit: what the view looks like, and the git
 * command every button stands for.
 *
 * Every command is built here with `cli()`, never by concatenation, and each one
 * is mirrored in `selfstudyuserlab/_portal_githubdesktop.py`, which drives it
 * against the real engine. If you add a builder, add it there too.
 *
 * The one line that is not git is `printf '%s' <text> > <path>`: the conflict
 * editor and "Ignore file" have to write a file, a portal line reaches the git
 * engine without a shell, and printf is the command a student would type in the
 * terminal for the same effect. The engine accepts exactly that shape.
 */
import { cli, pick, quote, rows } from '@/utils/portalKit';

export type FileStatus = 'new' | 'modified' | 'deleted' | 'conflicted' | 'renamed';

export interface DiffRow { t: ' ' | '+' | '-'; o: number | null; n: number | null; text: string }
export interface Hunk { header: string; lines: DiffRow[] }

export interface Change {
    path: string;
    status: FileStatus;
    staged: 'all' | 'none' | 'partial';
    untracked: boolean;
    additions: number;
    deletions: number;
    hunks: Hunk[];
    markers?: number;
    content?: string;
    ours?: string | null;
    theirs?: string | null;
}

export interface CommitFile {
    path: string; status: FileStatus; additions: number; deletions: number; hunks: Hunk[];
}

export interface Commit {
    sha: string; full: string; message: string; summary: string; body: string;
    author: string; email: string; at: string; parents: string[]; merge: boolean;
    refs: string[]; tags: string[]; head: boolean; reachable: boolean; changes: CommitFile[];
    remoteRefs?: string[];
}

export interface Branch {
    name: string; sha: string; full: string; current: boolean; message: string; at: string;
    merged: boolean; upstream: string; ahead: number; behind: number; gone: boolean;
}

export interface Tracking { upstream: string; remote: string; ahead: number; behind: number; gone: boolean }

export interface Stash {
    index: number; ref: string; message: string; branch: string; files: string[]; desktop: boolean;
}

/** The view, read defensively: a replica a release behind must render empty. */
export function readView(view: unknown) {
    const head = pick<Record<string, any>>(view, 'head', {});
    return {
        initialised: Boolean(pick(view, 'initialised', false)),
        branch: String(pick(view, 'branch', 'main')),
        detached: String(pick(view, 'detached', '')),
        user: pick<Record<string, string>>(view, 'user', { name: '', email: '' }),
        branches: rows<Branch>(view, 'branches').map(b => ({
            ...b, upstream: String(b.upstream || ''), ahead: Number(b.ahead) || 0,
            behind: Number(b.behind) || 0, gone: Boolean(b.gone),
        })),
        commits: rows<Commit>(view, 'commits').map(c => ({
            ...c,
            summary: c.summary ?? String(c.message || '').split('\n')[0],
            body: c.body ?? '',
            changes: Array.isArray(c.changes) ? c.changes : [],
            tags: Array.isArray(c.tags) ? c.tags : [],
            refs: Array.isArray(c.refs) ? c.refs : [],
            remoteRefs: Array.isArray((c as any).remote_refs) ? (c as any).remote_refs as string[] : [],
        })),
        changes: rows<Change>(view, 'changes'),
        conflicts: pick<string[]>(view, 'status.conflicts', []),
        stashes: rows<Stash>(view, 'stashes'),
        tags: rows<{ name: string; sha: string; full?: string; pushed?: boolean }>(view, 'tags'),
        remotes: pick<{ name: string; url: string }[]>(view, 'repository.remotes', []),
        remoteBranches: rows<{ name: string; remote: string; branch: string; sha: string; full: string }>(
            view, 'remote_branches'),
        tracking: pick<Tracking | null>(view, 'tracking', null),
        fetchedAt: String(pick(view, 'fetched_at', '')),
        rebasing: pick<{ branch: string; onto: string; remaining: number; total: number } | null>(
            view, 'rebasing', null),
        log: pick<string[]>(view, 'log', []),
        merging: pick<{ sha: string; branch: string; message: string } | null>(view, 'merging', null),
        sequencer: pick<{ op: string; commit: string; message: string } | null>(view, 'sequencer', null),
        gitignore: String(pick(view, 'gitignore', '')),
        ignored: pick<string[]>(view, 'ignored', []),
        repository: pick<{ name: string; path: string }>(view, 'repository',
                                                         { name: 'workspace', path: '/home/lab/workspace' }),
        head: {
            sha: String(head.sha || ''),
            short: String(head.short || ''),
            summary: String(head.summary || ''),
            parents: Array.isArray(head.parents) ? head.parents as string[] : [],
            unborn: Boolean(head.unborn),
        },
    };
}

export type GdView = ReturnType<typeof readView>;

/** GitHub Desktop's own stash for "Leave my changes on <branch>". */
export const desktopStash = (branch: string) => `!!GitHub_Desktop<${branch}>`;

// ---------------------------------------------------------------- commands ---
export const cmd = {
    init: () => cli(['git', 'init']),
    stage: (path: string) => cli(['git', 'add', path]),
    unstage: (path: string) => cli(['git', 'restore', '--staged', path]),
    stageAll: () => cli(['git', 'add', '-A']),
    unstageAll: () => cli(['git', 'reset']),
    commit: (summary: string, description: string) => {
        let line = cli(['git', 'commit'], { '-m': summary });
        if (description.trim()) line += ' ' + cli([], { '-m': description });
        return line;
    },
    undo: (root: boolean) => root ? cli(['git', 'update-ref', '-d', 'HEAD'])
        : cli(['git', 'reset', '--soft', 'HEAD~1']),
    discard: (path: string, untracked: boolean) => untracked
        ? cli(['git', 'clean', '-f', '--', path])
        : cli(['git', 'restore', '--staged', '--worktree', '--', path]),
    discardAll: () => cli(['git', 'reset', '--hard', 'HEAD']),
    cleanAll: () => cli(['git', 'clean', '-f', '-d']),
    write: (path: string, content: string) => `${cli(['printf', '%s', content])} > ${quote(path)}`,
    newBranch: (name: string, base = '') => cli(['git', 'checkout', '-b', name, base || null]),
    checkout: (ref: string) => cli(['git', 'checkout', ref]),
    rename: (from: string, to: string) => cli(['git', 'branch', '-m', from, to]),
    deleteBranch: (name: string) => cli(['git', 'branch', '-D', name]),
    stashLeave: (branch: string) => cli(['git', 'stash', 'push', '-u'], { '-m': desktopStash(branch) }),
    stashAll: () => cli(['git', 'stash', 'push', '-u']),
    stashPop: (ref: string) => cli(['git', 'stash', 'pop', ref]),
    stashDrop: (ref: string) => cli(['git', 'stash', 'drop', ref]),
    merge: (branch: string) => cli(['git', 'merge', branch]),
    mergeContinue: () => cli(['git', 'merge', '--continue']),
    mergeAbort: () => cli(['git', 'merge', '--abort']),
    seqContinue: (op: string) => cli(['git', op, '--continue']),
    seqAbort: (op: string) => cli(['git', op, '--abort']),
    useSide: (side: 'ours' | 'theirs', path: string) => cli(['git', 'checkout', '--' + side, '--', path]),
    markResolved: (path: string) => cli(['git', 'add', path]),
    rm: (path: string) => cli(['git', 'rm', path]),
    revert: (sha: string, merge: boolean) =>
        cli(['git', 'revert', '--no-edit'], { '-m': merge ? '1' : null }) + ' ' + quote(sha),
    cherryPick: (sha: string) => cli(['git', 'cherry-pick', sha]),
    resetTo: (sha: string) => cli(['git', 'reset', sha]),
    tag: (name: string, sha: string) => cli(['git', 'tag', name, sha]),
    tagDelete: (name: string) => cli(['git', 'tag', '-d', name]),
    config: (key: string, value: string) => cli(['git', 'config', key, value]),
    push: () => cli(['git', 'push']),
    // The remote (a server simulated inside the lab - see git.py).
    remoteAdd: (name: string, url: string) => cli(['git', 'remote', 'add', name, url]),
    remoteSetUrl: (name: string, url: string) => cli(['git', 'remote', 'set-url', name, url]),
    remoteRemove: (name: string) => cli(['git', 'remote', 'remove', name]),
    publishBranch: (remote: string, branch: string) => cli(['git', 'push', '-u', remote, branch]),
    pushTo: (remote: string) => cli(['git', 'push', remote, '--follow-tags']),
    forcePush: (remote: string) => cli(['git', 'push', remote, '--force-with-lease']),
    pull: (remote: string) => cli(['git', 'pull', remote]),
    fetchRemote: (remote: string) => cli(['git', 'fetch', remote]),
    deleteRemoteBranch: (remote: string, branch: string) => cli(['git', 'push', remote, '--delete', branch]),
    pushTag: (remote: string, tag: string) => cli(['git', 'push', remote, tag]),
    // Branch operations Desktop offers beside a merge commit.
    squashMerge: (branch: string) => cli(['git', 'merge', '--squash', branch]),
    rebase: (branch: string) => cli(['git', 'rebase', branch]),
    amend: (summary: string, description: string) => {
        let line = cli(['git', 'commit', '--amend'], { '-m': summary });
        if (description.trim()) line += ' ' + cli([], { '-m': description });
        return line;
    },
};

/** GitHub Desktop's co-author trailers, appended to the description. */
export function withCoAuthors(description: string, coAuthors: string[]): string {
    const trailers = coAuthors.map(a => a.trim()).filter(Boolean).map(a => `Co-authored-by: ${a}`);
    if (!trailers.length) return description;
    const body = description.replace(/\s+$/, '');
    return (body ? body + '\n\n' : '') + trailers.join('\n');
}

/** The URL GitHub Desktop would create for a repository published as `name`. */
export function publishUrl(login: string, name: string): string {
    const owner = (login || 'student').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'student';
    return `https://github.com/${owner}/${name}.git`;
}

/** "Last fetched 5 minutes ago" - Desktop's caption under Fetch origin. */
export function fetchedCaption(at: string): string {
    if (!at) return 'Never fetched';
    const rel = relTime(at);
    return rel ? `Last fetched ${rel}` : 'Never fetched';
}

// ----------------------------------------------------------------- helpers ---
/** `src/app/main.py` -> ['src/app/', 'main.py'] — the dir is drawn grey. */
export function splitPath(path: string): [string, string] {
    const at = path.lastIndexOf('/');
    return at < 0 ? ['', path] : [path.slice(0, at + 1), path.slice(at + 1)];
}

/** GitHub Desktop's branch-name sanitiser: spaces become hyphens as you type. */
export function sanitizeBranch(name: string): string {
    return name
        .replace(/\s+/g, '-')
        .replace(/[~^:?*[\\\]]+/g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/^[-./]+/, '')
        .replace(/-{2,}/g, '-');
}

export function branchNameError(name: string, branches: Branch[], current = ''): string {
    if (!name) return '';
    if (/\.lock$|\.$|\/$/.test(name)) return `${name} is not a valid branch name.`;
    if (branches.some(b => b.name === name && b.name !== current)) {
        return `A branch named ${name} already exists.`;
    }
    return '';
}

export function relTime(at: string, now = Date.now()): string {
    const when = Date.parse(at);
    if (!Number.isFinite(when)) return '';
    const seconds = Math.max(0, Math.round((now - when) / 1000));
    if (seconds < 45) return 'just now';
    const units: [number, string][] = [[60, 'minute'], [3600, 'hour'], [86400, 'day'],
                                       [2592000, 'month'], [31536000, 'year']];
    let value = 0;
    let label = 'minute';
    for (let i = units.length - 1; i >= 0; i--) {
        if (seconds >= units[i][0]) {
            value = Math.round(seconds / units[i][0]);
            label = units[i][1];
            break;
        }
    }
    if (!value) { value = 1; label = 'minute'; }
    return `${value} ${label}${value === 1 ? '' : 's'} ago`;
}

export function statusLabel(status: FileStatus): string {
    return { new: 'Added', modified: 'Modified', deleted: 'Deleted', conflicted: 'Conflicted',
             renamed: 'Renamed' }[status] || status;
}

export function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export interface MenuItem {
    label?: string;
    action?: () => void;
    disabled?: boolean;
    separator?: boolean;
    danger?: boolean;
    shortcut?: string;
}

export const LOCATION = 'x-github-desktop://repository/workspace';
