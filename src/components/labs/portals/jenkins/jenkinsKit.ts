/**
 * The Jenkins portal's plain half: the shapes it reads out of the engine's
 * `portal` view, the status / weather / duration vocabulary Jenkins prints,
 * and the command lines every form turns into.
 *
 * Every write is a `jenkins-cli` line (see `utils/sims/jenkins.py` on app 11).
 * A single-line command is sent AS the Jenkins CLI console (`surface:
 * 'jenkins'`), so the lab's `command_ran` checks - which are written against
 * that console - pass whichever way the student ran it. A command carrying a
 * multi-line value (a Jenkinsfile, an Execute shell script) is sent as the
 * portal itself, because the console wraps every line in the lab shell and a
 * newline there is a statement separator.
 */
import { cli, pick, rows, type PortalValue } from '@/utils/portalKit';

export type Result = 'SUCCESS' | 'UNSTABLE' | 'FAILURE' | 'ABORTED' | 'NOT_BUILT' | string;

export interface Stage {
    name: string;
    status: string;
    steps: number;
    note: string;
    ms: number;
}

export interface Build {
    number: number;
    result: Result;
    at: string;
    duration: number;
    cause: string;
    params: Record<string, unknown>;
    stages: Stage[];
    artifacts: string[];
    tests: { total?: number; failed?: number; skipped?: number };
}

export interface ParamDef {
    type: 'string' | 'boolean' | 'choice' | string;
    name: string;
    default?: string | boolean;
    choices?: string[];
    description?: string;
    declared?: boolean;
}

export interface Job {
    name: string;
    type: 'pipeline' | 'freestyle' | 'multibranch' | 'folder' | string;
    description: string;
    from_scm: boolean;
    script_path: string;
    disabled: boolean;
    next: number;
    param_defs: ParamDef[];
    triggers: Record<string, string>;
    builds: Build[];          // newest first
}

export interface Node {
    name: string;
    labels: string[];
    executors: number;
    online: boolean;
    os: string;
}

export interface Credential {
    id: string;
    kind: string;
    username: string;
    description: string;
}

export interface Plugin {
    id: string;
    name: string;
    version: string;
    /** Absent from a replica a release behind: read as enabled. */
    enabled?: boolean;
}

/** A List View (`create-view`). The primary view, All, is not in the list. */
export interface View {
    name: string;
    description: string;
    jobs: string[];
}

export function viewsOf(view: unknown): View[] {
    return rows<View>(view, 'portal.views').map(v => ({
        name: String(v.name || ''),
        description: String(v.description || ''),
        jobs: Array.isArray(v.jobs) ? v.jobs.map(String) : [],
    })).filter(v => v.name);
}

export function systemMessageOf(view: unknown): string {
    return String(pick(view, 'portal.system_message', '') || '');
}

/** What `jenkins-cli get-job NAME` hands back as `data`. */
export interface JobConfig {
    name: string;
    type: string;
    description: string;
    from_scm: boolean;
    script_path: string;
    script: string;
    scm_text: string | null;
    disabled: boolean;
    param_defs: ParamDef[];
    params: ParamDef[];
    triggers: Record<string, string>;
    shell: string;
    checkout: boolean;
    branch: string;
    files: string[];
}

export function jobsOf(view: unknown): Job[] {
    return rows<Job>(view, 'portal.jobs').map(job => ({
        ...job,
        builds: Array.isArray(job.builds) ? job.builds : [],
        param_defs: Array.isArray(job.param_defs) ? job.param_defs : [],
        triggers: job.triggers && typeof job.triggers === 'object' ? job.triggers : {},
    }));
}

export function nodesOf(view: unknown): Node[] {
    return rows<Node>(view, 'portal.nodes');
}

export function credentialsOf(view: unknown): Credential[] {
    return rows<Credential>(view, 'portal.credentials');
}

export function pluginsOf(view: unknown): Plugin[] {
    return rows<Plugin>(view, 'portal.plugins');
}

export function baseUrl(view: unknown): string {
    const url = String(pick(view, 'portal.url', '') || pick(view, 'url', '') || 'http://jenkins.lab:8080/');
    return url.endsWith('/') ? url : url + '/';
}

export const TYPE_LABEL: Record<string, string> = {
    pipeline: 'Pipeline',
    freestyle: 'Freestyle project',
    multibranch: 'Multibranch Pipeline',
    folder: 'Folder',
};

/** The colour of a build ball, as Jenkins names its icons. */
export function ballOf(result: string | undefined, disabled = false): string {
    if (disabled) return 'disabled';
    switch (String(result || '')) {
        case 'SUCCESS': return 'blue';
        case 'UNSTABLE': return 'yellow';
        case 'FAILURE': return 'red';
        case 'ABORTED': return 'aborted';
        default: return 'nobuilt';
    }
}

export function resultLabel(result: string | undefined): string {
    switch (String(result || '')) {
        case 'SUCCESS': return 'Success';
        case 'UNSTABLE': return 'Unstable';
        case 'FAILURE': return 'Failed';
        case 'ABORTED': return 'Aborted';
        case 'NOT_EXECUTED': return 'Not executed';
        default: return 'Not built';
    }
}

/** Jenkins' weather report: the share of the last five builds that passed. */
export function weatherOf(job: Job): { icon: string; score: number; text: string } {
    const recent = job.builds.slice(0, 5);
    if (!recent.length) return { icon: 'none', score: -1, text: '' };
    const ok = recent.filter(build => build.result === 'SUCCESS').length;
    const score = Math.round((ok / recent.length) * 100);
    const failed = recent.length - ok;
    const text = `Build stability: ${failed === 0 ? 'No recent builds failed.'
        : `${failed} out of the last ${recent.length} builds failed.`}`;
    let icon = 'sunny';
    if (score <= 20) icon = 'storm';
    else if (score <= 40) icon = 'rain';
    else if (score <= 60) icon = 'cloudy';
    else if (score <= 80) icon = 'partly';
    return { icon, score, text };
}

/** "6.3 sec", "1 min 2 sec", "870 ms" - the way Jenkins prints a duration. */
export function duration(seconds: number): string {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return `${s} sec`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ${s % 60} sec`;
    const h = Math.floor(m / 60);
    return `${h} hr ${m % 60} min`;
}

export function stageTime(ms: number): string {
    const value = Math.max(0, Number(ms) || 0);
    if (value === 0) return '';
    if (value < 1000) return `${value}ms`;
    const s = value / 1000;
    return s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}min ${Math.round(s % 60)}s`;
}

export function parseStamp(at: string | undefined): number {
    const t = Date.parse(String(at || ''));
    return Number.isFinite(t) ? t : 0;
}

/** "5 min 2 sec" since a stamp. */
export function since(at: string | undefined, now: number): string {
    const t = parseStamp(at);
    if (!t) return 'N/A';
    const seconds = Math.max(0, Math.round((now - t) / 1000));
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ${seconds % 60} sec`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ${minutes % 60} min`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ${hours % 24} hr`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 18, 2026, 10:12 AM" - the Build History widget's format. */
export function shortDate(at: string | undefined, seconds = false): string {
    const t = parseStamp(at);
    if (!t) return '';
    const d = new Date(t);
    const h = d.getHours();
    const hour = h % 12 === 0 ? 12 : h % 12;
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hour}:${mm}${seconds ? ':' + ss : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

export function lastWhere(job: Job, test: (build: Build) => boolean): Build | null {
    return job.builds.find(test) || null;
}

/** Stage names in the order they first appear, oldest build first. */
export function stageColumns(builds: Build[]): string[] {
    const out: string[] = [];
    for (const build of [...builds].reverse()) {
        for (const stage of build.stages || []) {
            if (!stage.name.startsWith('post / ') && !out.includes(stage.name)) out.push(stage.name);
        }
    }
    return out;
}

/** A command line for the Jenkins CLI. */
export function jcli(words: PortalValue[], flags: Record<string, any> = {}): string {
    return cli(['jenkins-cli', ...words], flags);
}

/** `-p K=V -p L=M`, which `cli()` cannot spell with one flag key. */
export function buildCommand(job: string, params: Record<string, string>): string {
    const words: PortalValue[] = ['build', job];
    for (const [key, value] of Object.entries(params)) words.push('-p', `${key}=${value}`);
    return jcli(words);
}

/** A parameter definition as `update-job --param` spells it. */
export function paramSpec(def: ParamDef): string {
    if (def.type === 'boolean') return `boolean:${def.name}=${def.default ? 'true' : 'false'}`;
    if (def.type === 'choice') return `choice:${def.name}=${(def.choices || []).join(',')}`;
    return `string:${def.name}=${def.default ?? ''}`;
}

/** Whether a command must go as the portal itself (see the module header). */
export function multiline(command: string): boolean {
    return /[\n\r]/.test(command);
}

export const JOB_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/;

export function nameProblem(name: string, jobs: Job[]): string {
    const text = name.trim();
    if (!text) return 'This field cannot be empty, please enter a valid name';
    if (/[!@#$%^&*[\]|\\:;/?<>]/.test(text)) {
        const bad = text.match(/[!@#$%^&*[\]|\\:;/?<>]/)?.[0] || '';
        return `‘${bad}’ is an unsafe character`;
    }
    if (!JOB_NAME.test(text)) return `‘${text}’ is not a valid name in this lab (letters, digits, . _ -)`;
    if (jobs.some(job => job.name === text)) return `A job already exists with the name ‘${text}’`;
    return '';
}

export function uuid(): string {
    const hex = '0123456789abcdef';
    let out = '';
    for (let i = 0; i < 32; i++) out += hex[Math.floor(Math.random() * 16)];
    return `${out.slice(0, 8)}-${out.slice(8, 12)}-4${out.slice(13, 16)}-a${out.slice(17, 20)}-${out.slice(20)}`;
}

export type Route =
    | { page: 'dashboard'; view?: string }
    | { page: 'newView' }
    | { page: 'editView'; view: string }
    | { page: 'system' }
    | { page: 'workspace'; job: string; path?: string }
    | { page: 'newItem' }
    | { page: 'history' }
    | { page: 'manage' }
    | { page: 'plugins'; tab?: string }
    | { page: 'nodes' }
    | { page: 'node'; node: string }
    | { page: 'nodeNew' }
    | { page: 'credentials' }
    | { page: 'credentialNew' }
    | { page: 'credential'; id: string }
    | { page: 'cli' }
    | { page: 'about' }
    | { page: 'job'; job: string }
    | { page: 'configure'; job: string }
    | { page: 'buildParams'; job: string }
    | { page: 'stageView'; job: string }
    | { page: 'rename'; job: string }
    | { page: 'syntax'; job: string }
    | { page: 'changes'; job: string }
    | { page: 'build'; job: string; build: number; tab?: 'status' | 'console' | 'params' | 'replay' | 'steps' | 'overview' };

export function routeUrl(route: Route, base: string): string {
    const job = 'job' in route ? `job/${encodeURIComponent(route.job)}/` : '';
    switch (route.page) {
        case 'dashboard': return route.view ? `${base}view/${encodeURIComponent(route.view)}/` : base;
        case 'newView': return `${base}newView`;
        case 'editView': return `${base}view/${encodeURIComponent(route.view)}/configure`;
        case 'system': return `${base}manage/configure`;
        case 'workspace': return `${base}${job}ws/${route.path ? route.path.split('/').map(encodeURIComponent).join('/') : ''}`;
        case 'newItem': return `${base}view/all/newJob`;
        case 'history': return `${base}view/all/builds`;
        case 'manage': return `${base}manage/`;
        case 'plugins': return `${base}manage/pluginManager/${route.tab && route.tab !== 'installed' ? route.tab : 'installed'}`;
        case 'nodes': return `${base}manage/computer/`;
        case 'node': return `${base}manage/computer/${encodeURIComponent(route.node === 'built-in' ? '(built-in)' : route.node)}/`;
        case 'nodeNew': return `${base}manage/computer/new`;
        case 'credentials': return `${base}manage/credentials/store/system/domain/_/`;
        case 'credentialNew': return `${base}manage/credentials/store/system/domain/_/newCredentials`;
        case 'credential': return `${base}manage/credentials/store/system/domain/_/credential/${encodeURIComponent(route.id)}/`;
        case 'cli': return `${base}manage/cli/`;
        case 'about': return `${base}manage/about/`;
        case 'job': return base + job;
        case 'configure': return `${base}${job}configure`;
        case 'buildParams': return `${base}${job}build?delay=0sec`;
        case 'stageView': return `${base}${job}workflow-stage`;
        case 'rename': return `${base}${job}confirm-rename`;
        case 'syntax': return `${base}${job}pipeline-syntax/`;
        case 'changes': return `${base}${job}changes`;
        case 'build': {
            const tail = { status: '', console: 'console', params: 'parameters/', replay: 'replay/',
                           steps: 'flowGraphTable/', overview: 'pipeline-overview/' }[route.tab || 'status'];
            return `${base}${job}${route.build}/${tail}`;
        }
        default: return base;
    }
}
