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
import baseFixtures from './labs.fixture.json';
import GUIDES from './guides.fixture.json';
import INSTRUCTIONS from './instructions.fixture.json';
/* A CARLA lab plus the four answers the Simulator pane asks for - catalogue,
   one town's map, and a replay - all dumped from app 11 after a REAL run of the
   reference solution (see `_carla_solutions.py` in app 11). */
import carlaFixture from './carla.fixture.json';
// The Definitions window's payloads, dumped from app 11's real route (see _labdocs/dump_defs.py).
import DEFINITIONS from './definitions.fixture.json';
const fixtures: AnyRec = { ...(baseFixtures as AnyRec),
    [(carlaFixture as AnyRec).lab.id]: (carlaFixture as AnyRec).lab,
    ...((carlaFixture as AnyRec).extra_labs || {}) };

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
            // The task information window's structure, dumped from app 11's own
            // `labgrade.guide()` - a stub written from a guess would prove
            // nothing about the window that reads it.
            guide: (GUIDES as AnyRec)[lab.id]?.[task.id || String(index)],
            // The written goal / steps / done-when, from app 11's own
            // utils/labinstructions for the fixture's labs.
            instructions: (INSTRUCTIONS as AnyRec)[lab.id]?.[task.id || String(index)] || null,
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
    if ((lab.families || []).indexOf('carla') >= 0) {
        out.carla = ((carlaFixture as AnyRec).catalogue || {}).view || {};
    }
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
    getDefinitions(labId: string) {
        const all = DEFINITIONS as AnyRec;
        return delay(all[labId] || all[Object.keys(all)[0]] || null, 300);
    },
    getGlossaryIndex() {
        const rows: AnyRec[] = [];
        for (const payload of Object.values(DEFINITIONS as AnyRec)) for (const t of payload.terms || []) rows.push({ id: t.id, term: t.term, short: t.short, category: t.category });
        return delay(rows);
    },
    getGlossaryTerm(id: string) {
        for (const payload of Object.values(DEFINITIONS as AnyRec)) for (const t of payload.terms || []) if (t.id === id) return delay(t);
        return delay(null);
    },
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
        if (toolId === 'carla_sim') {
            const cf = carlaFixture as AnyRec;
            const action = String(payload.action || 'catalogue');
            if (action === 'catalogue') return delay(cf.catalogue);
            if (action === 'map') return delay(cf.maps[String(payload.map)]
                || { ok: false, error: 'No such map in the preview fixture', code: 'NOT_FOUND' });
            if (action === 'last' || action === 'run') return delay({ ...cf.last, ok: true });
            return delay({ ok: true });
        }
        /*
          THE BROWSER PANE (`django_preview` / `flask_preview`). A page TALLER
          than any screen, with a coloured footer, so a screenshot shows at a
          glance whether the frame reaches the bottom of the stage - which is
          exactly what "only the top half shows" was about.
        */
        if (/_preview$/.test(toolId)) {
            const rows = Array.from({ length: 40 }, (_v, i) =>
                `<tr><td>${i + 1}</td><td>Product ${i + 1}</td><td>${(i * 3.5 + 2).toFixed(2)}</td></tr>`).join('');
            return delay({
                ok: true,
                routes: [{ route: '/', name: 'home', view: 'shop.views.home' },
                         { route: '/admin/', name: 'admin', view: 'admin.site' }],
                response: {
                    status: 200, reason: 'OK', content_type: 'text/html', queries: ['SELECT * FROM shop_product'],
                    body: `<!doctype html><html><head><style>body{font:15px system-ui;margin:0}
header{background:#1e3a8a;color:#fff;padding:18px 24px}main{padding:18px 24px}
table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ddd;padding:6px}
footer{background:#047857;color:#fff;padding:22px 24px;font-weight:700}</style></head>
<body><header><h1>Shop admin</h1></header><main><table>${rows}</table></main>
<footer>END OF PAGE - the frame reached the bottom</footer></body></html>`,
                },
            });
        }
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
        /* Full-screen programs, shaped exactly as app 11's Linux layer answers
           (utils/sims/_linux/screen.py): a first frame plus a SCREEN request. */
        if (head === 'less' || head === 'man') {
            const text = head === 'man'
                ? ['LS(1)                     User Commands                    LS(1)', '', 'NAME',
                   '       ls - list directory contents', '', 'SYNOPSIS', '       ls [OPTION]... [FILE]...', '',
                   'DESCRIPTION', ...Array.from({ length: 60 }, (_v, i) => `       option ${i + 1}: an explanation of what it does`)].join('\n')
                : String(env.files[argv[1]] ?? Array.from({ length: 80 }, (_v, i) => `line ${i + 1}`).join('\n'));
            return answer({ output: text.split('\n').slice(0, 20).join('\n'),
                            screen: { program: 'pager', text, title: head === 'man' ? 'Manual page ls(1)' : argv[1] || '' } });
        }
        if (head === 'top' && !argv.includes('-b')) {
            return answer({ output: 'top frame', screen: { program: 'live', command: 'top -b -n 1', interval: 3, title: 'top' } });
        }
        if (head === 'top') {
            const now = new Date().toTimeString().slice(0, 8);
            return answer({ output: [
                `top - ${now} up 6 days, 17:45,  1 user,  load average: 0.16, 0.13, 0.11`,
                'Tasks: 122 total,   1 running, 121 sleeping,   0 stopped,   0 zombie',
                '%Cpu(s):  1.9 us,  0.7 sy,  0.0 ni, 97.2 id,  0.2 wa,  0.0 hi,  0.0 si,  0.0 st',
                'MiB Mem :   3932.1 total,   1063.3 free,   1100.9 used,   1767.9 buff/cache',
                'MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   2831.2 avail Mem', '',
                '    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND',
                '      1 root      20   0  167884  13012   8320 S   0.0   0.3   0:04.11 systemd',
                '    702 root      20   0   15432   9100   7600 S   0.0   0.2   0:00.02 sshd',
                '   1188 root      20   0   55180   1580    500 S   0.0   0.0   0:00.00 nginx'].join('\n') });
        }
        if (head === 'ping' && argv[1] === '--sfs-tick') {
            return answer({ output: `64 bytes from 127.0.0.1: icmp_seq=${Number(argv[2]) + 1} ttl=64 time=0.041 ms` });
        }
        if (head === 'ping' && argv[1] === '--sfs-stop') {
            const n = Number(argv[2]) + 1;
            return answer({ output: ['^C', '--- 127.0.0.1 ping statistics ---',
                `${n} packets transmitted, ${n} received, 0% packet loss, time ${n * 1000}ms`].join('\n') });
        }
        if (head === 'ping' && !argv.includes('-c')) {
            return answer({ output: 'PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.\n64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.050 ms',
                            screen: { program: 'stream', tick: 'ping --sfs-tick {n} 127.0.0.1',
                                      stop: 'ping --sfs-stop {n} 127.0.0.1', interval: 0.4, title: 'ping', limit: 600 } });
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

    /** `labfs.export`: every file at or under `path` WITH its content and mode. */
    exportFiles: (_u: string, _l: string, path: string) => {
        const root = clean(path);
        if (root && !isFileKey(root) && !isDirKey(root)) return delay(null);
        const prefix = root ? root + '/' : '';
        const chosen = isFileKey(root) ? [root]
            : Object.keys(env.files).filter(key => key.startsWith(prefix)).sort();
        return delay({
            root,
            files: chosen.map(key => ({ path: key, content: String(env.files[key] || ''),
                                        mode: String(env.modes[key] || '644') })),
            dirs: isFileKey(root) ? [] : allDirs().filter(d => d !== root && d.startsWith(prefix)),
        });
    },

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
