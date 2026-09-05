/**
 * Stands in for `@/services/labs.service` in the lab-workspace preview.
 *
 * The lab records are the REAL ones, dumped out of app 11's own
 * `labcatalogue.get()` into `labs.fixture.json` — a stub written from a guess at
 * the payload shape proves nothing about the page that reads it, which is the
 * lesson `tools/leaderboard-preview` and app 23's identity e2e both paid for.
 *
 * The grading is a small honest implementation of the backend's own rules for
 * the check types these three labs use (`web_contains`, `all`, `manual`,
 * `state`, `command_ran`), so that pressing **Check my work** after doing the
 * work actually ticks a task — which is the whole thing being previewed.
 *
 *   ?lab=<id>            web-01-html | net-01-addressing | docker-01-first
 *   ?state=gradefail     grading answers null, as an unreachable replica does
 *   ?state=loading       openLab never resolves
 *   ?state=error         openLab answers null
 */
import fixtures from './labs.fixture.json';

const params = new URLSearchParams(location.search);
const state = params.get('state') || 'ok';
const delay = <T,>(v: T, ms = 260): Promise<T> => new Promise(r => setTimeout(() => r(v), ms));

type AnyRec = Record<string, any>;

/** The student's environment, shaped exactly as `labenv.blank()` shapes it. */
const env: AnyRec = {
    files: {}, web: {}, log: [], self_marked: [], engines: {},
    // `dirs` and `modes` are the other two filesystem keys, and they are here
    // for the reason the real environment has them: an EMPTY folder is implied
    // by no file, and a mode has to survive a rename. A stub that carried only
    // `files` would make the explorer look correct while proving nothing about
    // the two things that are hard.
    dirs: [], modes: {},
};

function seedFrom(lab: AnyRec) {
    const spec = lab.environment || {};
    env.web = { ...(spec.web || {}) };
    env.files = { ...(spec.files || {}) };
    env.dirs = [...(spec.dirs || [])];
    env.modes = { ...(spec.modes || {}) };
    env.log = [];
    env.self_marked = [];
}

/* ── the filesystem, mirroring utils/labfs.py ─────────────────────────────
 *
 * A STUB THAT IS KINDER THAN PRODUCTION TESTS NOTHING. The refusals below are
 * the ones the backend actually makes - a folder inside itself, an occupied
 * destination, a non-empty folder without `recursive`, a name the path rule
 * refuses - because a harness that accepted them all would photograph an
 * explorer that cannot exist.
 */

const PATH_RE = /^[A-Za-z0-9.][A-Za-z0-9._/-]{0,119}$/;

function validPath(path: string): boolean {
    const text = String(path || '');
    if (!PATH_RE.test(text)) return false;
    if (text.includes('..') || text.startsWith('/') || text.endsWith('/')) return false;
    return text.split('/').every(part => part !== '' && part !== '.');
}

function isFileKey(path: string): boolean {
    return Object.prototype.hasOwnProperty.call(env.files, path);
}

function isDirKey(path: string): boolean {
    if (!path) return true;
    if ((env.dirs as string[]).includes(path)) return true;
    const prefix = path + '/';
    return Object.keys(env.files).some(key => key.startsWith(prefix))
        || (env.dirs as string[]).some(key => key.startsWith(prefix));
}

/** Every directory, including the ones a file implies — `shell.walk_dirs`. */
function allDirs(): string[] {
    const out = new Set<string>();
    for (const key of Object.keys(env.files)) {
        const parts = key.split('/');
        for (let i = 1; i < parts.length; i += 1) out.add(parts.slice(0, i).join('/'));
    }
    for (const key of env.dirs as string[]) {
        const parts = key.split('/');
        for (let i = 1; i <= parts.length; i += 1) out.add(parts.slice(0, i).join('/'));
    }
    out.delete('');
    return [...out].sort();
}

function mkdirs(path: string) {
    const parts = String(path || '').split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i += 1) {
        const candidate = parts.slice(0, i).join('/');
        if (candidate && !(env.dirs as string[]).includes(candidate)) {
            (env.dirs as string[]).push(candidate);
        }
    }
}

/** Drop a listed directory a file already implies — `shell.prune_dirs`. */
function pruneDirs() {
    const implied = new Set<string>();
    for (const key of Object.keys(env.files)) {
        const parts = key.split('/');
        for (let i = 1; i < parts.length; i += 1) implied.add(parts.slice(0, i).join('/'));
    }
    env.dirs = [...new Set(env.dirs as string[])]
        .filter(dir => dir && !implied.has(dir));
}

function clean(path: string): string {
    return String(path || '').trim().replace(/\/+$/, '');
}

/**
 * Delete a file, and KEEP the directory it was in — `shell.remove_file`.
 *
 * `dirs` holds only the directories no file implies, so the moment the last
 * file leaves `src/` nothing implies it and it disappears. A real shell leaves
 * it, and in the explorer this is the fault you cannot miss: drag the one file
 * out of a folder and the folder goes with it.
 */
function removeFileKey(path: string) {
    delete env.files[path];
    delete env.modes[path];
    mkdirs(path.split('/').slice(0, -1).join('/'));
}

/* ── the grader, matching utils/labgrade.py for the types these labs use ── */

function checkWeb(check: AnyRec): [string, string] {
    const part = String(check.part || 'html');
    const body = String(env.web?.[part] || '');
    if (!body.trim()) return ['pending', 'the ' + part.toUpperCase() + ' is empty'];
    if (!check.pattern) return ['passed', 'the ' + part.toUpperCase() + ' has been written'];
    let re: RegExp;
    try { re = new RegExp(check.pattern, 'is'); } catch { return ['unavailable', 'the pattern does not compile']; }
    return re.test(body)
        ? ['passed', 'found in the ' + part.toUpperCase()]
        : ['pending', 'not in the ' + part.toUpperCase() + ' yet'];
}

function checkCommand(check: AnyRec): [string, string] {
    let re: RegExp;
    try { re = new RegExp(check.pattern || '', 'i'); } catch { return ['unavailable', 'bad pattern']; }
    for (const entry of [...(env.log || [])].reverse()) {
        if (check.tool && entry.tool !== check.tool) continue;
        if (re.test(String(entry.command || ''))) return ['passed', 'ran ' + entry.command];
    }
    return ['pending', 'not run yet'];
}

function evaluateOne(check: AnyRec, selfMarked: string[]): [string, string] {
    const kind = String((check || {}).type || '');
    if (kind === 'web_contains') return checkWeb(check);
    if (kind === 'command_ran' || kind === 'command_ok') return checkCommand(check);
    if (kind === 'manual') {
        return selfMarked.includes(String(check.task || ''))
            ? ['passed', 'you marked this done']
            : ['pending', 'mark it done when you have finished'];
    }
    if (kind === 'state') return ['pending', 'nothing at ' + check.path];
    if (kind === 'all') {
        const parts = (check.checks || []).map((c: AnyRec) => evaluateOne(c, selfMarked));
        if (parts.length && parts.every((p: [string, string]) => p[0] === 'passed')) {
            return ['passed', 'all ' + parts.length + ' parts done'];
        }
        const done = parts.filter((p: [string, string]) => p[0] === 'passed').length;
        return ['pending', done + ' of ' + parts.length + ' parts done'];
    }
    if (kind === 'any') {
        const parts = (check.checks || []).map((c: AnyRec) => evaluateOne(c, selfMarked));
        const hit = parts.find((p: [string, string]) => p[0] === 'passed');
        return hit ? ['passed', hit[1]] : ['pending', 'none of the alternatives yet'];
    }
    return ['unavailable', 'this build does not know the check type "' + kind + '"'];
}

function describe(check: AnyRec): string {
    const kind = String((check || {}).type || '');
    if (kind === 'web_contains') return 'the ' + (check.part || 'html') + ' containing /' + check.pattern + '/';
    if (kind === 'manual') return 'your own confirmation';
    if (kind === 'state') return check.family + '.' + check.path;
    if (kind === 'command_ran') return 'a command matching /' + check.pattern + '/';
    if (kind === 'all' || kind === 'any') {
        return kind + ' of: ' + (check.checks || []).map(describe).join('; ');
    }
    return kind || 'nothing';
}

function evaluate(lab: AnyRec, selfMarked: string[]) {
    const marks = Array.from(new Set([...(env.self_marked || []), ...selfMarked]));
    env.self_marked = marks;
    const tasks = (lab.tasks || []).map((task: AnyRec, index: number) => {
        let check = task.check || { type: 'manual', task: task.id || String(index) };
        if (check.type === 'manual' && !check.task) check = { ...check, task: task.id || String(index) };
        const verdict = evaluateOne(check, marks);
        return {
            id: task.id || String(index),
            title: task.title || 'Task ' + (index + 1),
            detail: task.detail || '',
            hint: task.hint || '',
            points: Number(task.points || 1),
            status: verdict[0],
            note: verdict[1],
            requires: describe(check),
            manual: check.type === 'manual',
        };
    });
    const passed = tasks.filter((t: AnyRec) => t.status === 'passed');
    const earned = passed.reduce((n: number, t: AnyRec) => n + t.points, 0);
    const possible = tasks.reduce((n: number, t: AnyRec) => n + t.points, 0) || 1;
    return {
        tasks,
        done: passed.length,
        total: tasks.length,
        earned,
        possible,
        percent: Math.round((100 * earned) / possible),
        status: tasks.length && passed.length === tasks.length ? 'completed'
            : (passed.length || env.log.length ? 'in_progress' : 'not_started'),
        unavailable: tasks.filter((t: AnyRec) => t.status === 'unavailable').map((t: AnyRec) => t.id),
    };
}

function views(lab: AnyRec) {
    const out: AnyRec = {
        files: Object.entries(env.files).map(([path, body]) => ({ path, bytes: String(body).length })),
        web: { ...env.web },
        updated_at: new Date().toISOString(),
    };
    if ((lab.families || []).indexOf('docker') >= 0) {
        out.docker = {
            stats: { running: 0, containers: 0, images: 1 },
            containers: [],
            images: [{ repository: 'nginx', tag: '1.27', size: '54MB', id: 'sha256:aa11' }],
            networks: [{ name: 'bridge', driver: 'bridge', scope: 'local' }],
            volumes: [],
        };
    }
    return out;
}

let current: AnyRec = (fixtures as AnyRec)['web-01-html'];

/* Where the stub shell is. Module-level, like `env`: the console asks after
   every command, and a value that reset per call would make `cd` a no-op. */
let shellCwd = '';

export const labsService = {
    openLab(_username: string, labId: string) {
        if (state === 'loading') return new Promise(() => { /* never resolves */ });
        if (state === 'error') return delay(null);
        current = (fixtures as AnyRec)[labId] || (fixtures as AnyRec)['web-01-html'];
        seedFrom(current);
        return delay({
            ok: true,
            lab: current,
            tools: current.tool_detail,
            progress: null,
            grade: evaluate(current, []),
            views: views(current),
            replica: 'https://sfsuserlab2.pythonanywhere.com',
            ran_on: 'https://sfsuserlab2.pythonanywhere.com',
        });
    },

    gradeLab(_username: string, _labId: string, options: { selfMarked?: string[] } = {}) {
        if (state === 'gradefail') return delay(null, 700);
        return delay({
            grade: evaluate(current, options.selfMarked || []),
            progress: null,
            views: views(current),
        }, 700);
    },

    resetLab: () => { seedFrom(current); return delay(true); },
    getContext: () => delay('The environment is empty.'),

    /**
     * A command, answering the shape `utils/sims/shell.py` answers.
     *
     * A stub that returned "(preview) ran: ls" for everything proved nothing
     * about the console: `clear`, `nano` and the moving prompt are all answered
     * OUT OF BAND, and a fake that only ever fills `output` cannot exercise any
     * of them. Same lesson as the leaderboard preview, which handed its view
     * finished records a service never sends and hid a real defect.
     *
     * Deliberately a handful of builtins and not a shell: what the harness has
     * to drive is the wiring - the transcript, the prompt, the overlay - and the
     * shell itself has 276 checks of its own in the backend repo.
     */
    runTool(_u: string, _l: string, toolId: string, payload: AnyRec) {
        const line = String(payload.command ?? payload.code ?? payload.query ?? '').trim();
        env.log.push({ tool: toolId, command: line, code: 0, at: new Date().toISOString() });
        const argv = line.split(/\s+/);
        const head = argv[0] || '';
        const answer = (extra: AnyRec) => delay({
            ok: true, code: 0, cwd: shellCwd,
            prompt: shellCwd ? '~/' + shellCwd : '~', ...extra });

        if (head === 'clear') return answer({ clear: true });
        if (head === 'pwd') return answer({ output: '/home/student' + (shellCwd ? '/' + shellCwd : '') });
        if (head === 'cd') {
            const target = argv[1] || '';
            shellCwd = (!target || target === '~' || target === '..') ? '' : target.replace(/^\.\//, '');
            return answer({});
        }
        if (head === 'ls') {
            const here = Object.keys(env.files)
                .filter(p => (shellCwd ? p.startsWith(shellCwd + '/') : !p.includes('/')))
                .map(p => (shellCwd ? p.slice(shellCwd.length + 1) : p));
            return answer({ output: here.join('  ') });
        }
        if (head === 'cat') {
            const target = argv[1] || '';
            return env.files[target] === undefined
                ? delay({ ok: false, code: 1, error: 'cat: ' + target + ': No such file or directory' })
                : answer({ output: String(env.files[target]) });
        }
        if (['nano', 'vi', 'vim'].includes(head)) {
            const target = argv[1];
            if (!target) return delay({ ok: false, code: 1, error: head + ': no file named' });
            return answer({ editor: {
                program: head === 'nano' ? 'nano' : 'vi',
                path: target, name: target,
                content: String(env.files[target] ?? ''),
                existing: env.files[target] !== undefined,
            } });
        }
        const redirect = line.match(/^echo\s+(.*?)\s*>\s*(\S+)$/);
        if (redirect) {
            env.files[redirect[2]] = redirect[1].replace(/^["']|["']$/g, '') + '\n';
            return answer({});
        }
        if (head === 'help') {
            return answer({ output: 'cat  cd  clear  echo  help  ls  nano  pwd  vi' });
        }
        return answer({ output: '(preview) ' + toolId + ' ran: ' + line });
    },

    /** What Tab completes against, keyed on the directory the shell is in. */
    completions() {
        const here = Object.keys(env.files)
            .filter(p => (shellCwd ? p.startsWith(shellCwd + '/') : !p.includes('/')))
            .map(p => (shellCwd ? p.slice(shellCwd.length + 1) : p));
        return delay({
            prompt: shellCwd ? '~/' + shellCwd : '~',
            cwd: shellCwd,
            commands: ['cat', 'cd', 'clear', 'echo', 'help', 'ls', 'nano',
                       'pwd', 'vi'],
            dirs: [...new Set(Object.keys(env.files)
                .filter(p => p.includes('/')).map(p => p.split('/')[0]))],
            files: here,
            paths: Object.keys(env.files),
        });
    },

    listFiles: () => delay(Object.entries(env.files)
        .map(([path, body]) => ({ path, bytes: String(body).length }))),

    listTree: () => delay({
        files: Object.entries(env.files)
            .map(([path, body]) => ({ path, bytes: String(body).length }))
            .sort((a, b) => (a.path < b.path ? -1 : 1)),
        dirs: allDirs(),
        limits: { max_files: 60, max_bytes: 256 * 1024 },
    }),

    readFile: (_u: string, _l: string, path: string) => delay(String(env.files[path] || '')),

    writeFile: (_u: string, _l: string, path: string, content: string) => {
        const target = clean(path);
        if (!validPath(target)) {
            return delay({ ok: false, error: 'That is not a usable file name.' });
        }
        if (!isFileKey(target) && isDirKey(target)) {
            return delay({ ok: false, error: target + ' is a folder' });
        }
        env.files[target] = content;
        mkdirs(target.split('/').slice(0, -1).join('/'));
        pruneDirs();
        return delay({ ok: true });
    },

    makeFolder: (_u: string, _l: string, path: string) => {
        const target = clean(path);
        if (!validPath(target)) {
            return delay({ ok: false, error: 'That is not a usable folder name.' });
        }
        if (isFileKey(target)) {
            return delay({ ok: false, error: 'There is already a file called ' + target });
        }
        if (isDirKey(target)) {
            return delay({ ok: false, error: 'That folder already exists' });
        }
        mkdirs(target);
        return delay({ ok: true, path: target });
    },

    movePath: (_u: string, _l: string, path: string, to: string) => {
        const from = clean(path);
        const dest = clean(to);
        if (!validPath(from) || !validPath(dest)) {
            return delay({ ok: false, error: 'That is not a usable name.' });
        }
        if (!isFileKey(from) && !isDirKey(from)) {
            return delay({ ok: false, error: 'No such file or folder: ' + from });
        }
        if (dest === from) return delay({ ok: false, error: 'That is already its name' });
        if (isFileKey(dest) || isDirKey(dest)) {
            return delay({ ok: false, error: dest + ' already exists' });
        }
        if (isDirKey(from) && !isFileKey(from) && dest.startsWith(from + '/')) {
            return delay({ ok: false, error: 'A folder cannot be moved inside itself' });
        }
        if (isFileKey(from)) {
            // The mode is read BEFORE the removal and set after: the removal
            // pops it, so reading it afterwards gets the default.
            const mode = env.modes[from];
            env.files[dest] = env.files[from];
            removeFileKey(from);
            if (mode !== undefined) env.modes[dest] = mode;
            mkdirs(dest.split('/').slice(0, -1).join('/'));
        } else {
            const prefix = from + '/';
            for (const key of Object.keys(env.files)) {
                if (!key.startsWith(prefix)) continue;
                const target = dest + '/' + key.slice(prefix.length);
                const mode = env.modes[key];
                env.files[target] = env.files[key];
                removeFileKey(key);
                if (mode !== undefined) env.modes[target] = mode;
            }
            env.dirs = (env.dirs as string[])
                .filter(dir => dir !== from)
                .map(dir => (dir.startsWith(prefix)
                    ? dest + '/' + dir.slice(prefix.length) : dir));
            mkdirs(dest);
            mkdirs(from.split('/').slice(0, -1).join('/'));
        }
        pruneDirs();
        return delay({ ok: true, path: from, to: dest });
    },

    deleteFile: (_u: string, _l: string, path: string, recursive = false) => {
        const target = clean(path);
        if (isFileKey(target)) {
            removeFileKey(target);
            pruneDirs();
            return delay({ ok: true, removed: 1 });
        }
        if (!isDirKey(target)) {
            return delay({ ok: false, error: 'No such file or folder: ' + target });
        }
        const prefix = target + '/';
        const inside = Object.keys(env.files).filter(key => key.startsWith(prefix));
        const within = (env.dirs as string[]).filter(dir => dir.startsWith(prefix));
        if ((inside.length || within.length) && !recursive) {
            return delay({
                ok: false,
                error: target + ' is not empty. Deleting it removes '
                    + inside.length + ' file(s) too.',
            });
        }
        for (const key of inside) removeFileKey(key);
        // AFTER the loop, or `removeFileKey` re-records the directory being
        // deleted as the parent of the file it just removed.
        env.dirs = (env.dirs as string[])
            .filter(dir => dir !== target && !dir.startsWith(prefix));
        mkdirs(target.split('/').slice(0, -1).join('/'));
        pruneDirs();
        return delay({ ok: true, removed: inside.length, folder: true });
    },

    saveWeb: (_u: string, _l: string, source: AnyRec) => {
        env.web = { ...env.web, ...source };
        return delay({ ...env.web });
    },

    getViews: () => delay(views(current)),
    getHistory: () => delay(env.log),
    getProgress: () => delay([]),
    getLeaderboard: () => delay([]),
};
