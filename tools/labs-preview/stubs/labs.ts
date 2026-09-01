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
const env: AnyRec = { files: {}, web: {}, log: [], self_marked: [], engines: {} };

function seedFrom(lab: AnyRec) {
    const spec = lab.environment || {};
    env.web = { ...(spec.web || {}) };
    env.files = { ...(spec.files || {}) };
    env.log = [];
    env.self_marked = [];
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

    runTool(_u: string, _l: string, toolId: string, payload: AnyRec) {
        const line = String(payload.command ?? payload.code ?? payload.query ?? '');
        env.log.push({ tool: toolId, command: line, code: 0, at: new Date().toISOString() });
        return delay({ ok: true, output: '(preview) ' + toolId + ' ran: ' + line, code: 0 });
    },

    listFiles: () => delay(Object.entries(env.files)
        .map(([path, body]) => ({ path, bytes: String(body).length }))),
    readFile: (_u: string, _l: string, path: string) => delay(String(env.files[path] || '')),
    writeFile: (_u: string, _l: string, path: string, content: string) => {
        env.files[path] = content;
        return delay({ ok: true });
    },
    deleteFile: (_u: string, _l: string, path: string) => {
        delete env.files[path];
        return delay({ ok: true });
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
