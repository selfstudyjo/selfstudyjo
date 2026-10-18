/**
 * Docker Desktop's shared half: the routes, the view types and the command
 * builders. Plain - no Vue - so every page builds its `docker …` line the same
 * way, through `cli()`, and the check script on app 11 can mirror the shapes.
 */
import { cli, pick, rows } from '@/utils/portalKit';

export interface MenuItem { key: string; label: string; icon?: string; danger?: boolean; disabled?: boolean }

export type DdPage = 'containers' | 'images' | 'volumes' | 'networks' | 'builds'
    | 'scout' | 'extensions';

export interface DdRoute {
    page: DdPage;
    /** A detail page: container name, image ref, volume, network or build id. */
    id?: string;
    tab?: string;
}

export interface Container {
    id: string; full_id?: string; name: string; image: string; status: string;
    command: string; created: string; uptime: string; exit_code: number;
    service: string; project?: string; ports: string[];
    port_bindings?: { host: string; container: string; proto: string }[];
    networks: { name: string; ip: string }[];
    mounts: string[];
    mount_list?: { source: string; target: string; mode: string; type: string }[];
    env: string[]; env_map?: Record<string, string>; labels?: Record<string, string>;
    restart?: string; logs: string[]; all_logs?: string[];
    started_ago?: string; finished_ago?: string;
    cpu?: number | null; mem_mib?: number | null; net_rx_kb?: number | null;
    net_tx_kb?: number | null; pids?: number; fs_changes?: string[];
}

export interface Image {
    repository: string; tag: string; id: string; size: string; layers: number;
    created: string; in_use?: boolean; used_by?: string[]; dangling?: boolean;
    size_mb?: number; built?: boolean;
    layer_list?: { index: number; instruction: string; digest: string; size_mb: number }[];
}

export interface Volume {
    name: string; driver: string; anonymous: boolean; mountpoint: string;
    used_by: string[]; created_ago?: string; size?: string;
    files?: { path: string; dir: boolean; bytes: number }[];
}

export interface Network {
    name: string; id: string; full_id?: string; driver: string; subnet: string;
    builtin: boolean; members: string[]; created_ago?: string;
    endpoints?: { name: string; ip: string; alias: string; status: string }[];
}

export interface Build {
    id: string; name: string; dockerfile: string; context: string;
    status: 'completed' | 'error'; steps: number; cached: number; duration: number;
    created: string; source: string; log: string; error: string; image: string;
    image_id: string;
}

export function containers(view: unknown): Container[] { return rows<Container>(view, 'containers'); }
export function images(view: unknown): Image[] { return rows<Image>(view, 'images'); }
export function volumes(view: unknown): Volume[] { return rows<Volume>(view, 'volumes'); }
export function networks(view: unknown): Network[] { return rows<Network>(view, 'networks'); }
export function builds(view: unknown): Build[] { return rows<Build>(view, 'builds'); }
export function desktop(view: unknown): Record<string, any> { return pick(view, 'desktop', {}); }

/** A size the way Docker Desktop prints it: 142.28 MB, 1.02 GB, 13.26 kB. */
export function fmtSize(mb: number | undefined, fallback = ''): string {
    if (mb === undefined || mb === null || Number.isNaN(mb)) return fallback;
    if (mb >= 1000) return `${(mb / 1000).toFixed(2)} GB`;
    if (mb < 1) return `${(mb * 1000).toFixed(2)} kB`;
    return `${mb.toFixed(2)} MB`;
}

export function imageRef(image: Image): string {
    return image.dangling ? image.id : `${image.repository}:${image.tag}`;
}

export function imageName(image: Image): string {
    return image.dangling ? '<none>' : image.repository;
}

/** The "8080:80" pairs Docker Desktop prints in the Port(s) column. */
export function portPairs(row: Container): { host: string; container: string; proto: string }[] {
    if (row.port_bindings) return row.port_bindings;
    return (row.ports || []).map(text => {
        const match = String(text).match(/:(\S+) -> (\d+)\/(\w+)/);
        return match ? { host: match[1] === '-' ? '' : match[1], container: match[2], proto: match[3] }
            : { host: '', container: String(text), proto: 'tcp' };
    });
}

export const URL_BASE = 'docker-desktop://dashboard';

export function locationFor(route: DdRoute): string {
    const enc = encodeURIComponent;
    switch (route.page) {
        case 'containers':
            return route.id
                ? `${URL_BASE}/containers/container/${enc(route.id)}/${route.tab || 'logs'}`
                : `${URL_BASE}/containers`;
        case 'images':
            return route.id
                ? `${URL_BASE}/images/local/image/${enc(route.id)}`
                : `${URL_BASE}/images/${route.tab || 'local'}`;
        case 'volumes':
            return route.id
                ? `${URL_BASE}/volumes/volume/${enc(route.id)}/${route.tab || 'container-in-use'}`
                : `${URL_BASE}/volumes`;
        case 'networks':
            return route.id ? `${URL_BASE}/networks/${enc(route.id)}` : `${URL_BASE}/networks`;
        case 'builds':
            return route.id
                ? `${URL_BASE}/builds/${enc(route.id)}/${route.tab || 'info'}`
                : `${URL_BASE}/builds/${route.tab || 'history'}`;
        case 'scout':
            return `${URL_BASE}/scout/overview`;
        default:
            return `${URL_BASE}/extensions/marketplace`;
    }
}

/** The ports an official image EXPOSEs, which the Run dialog offers. */
export const EXPOSED: Record<string, string[]> = {
    nginx: ['80'], httpd: ['80'], redis: ['6379'], postgres: ['5432'], mysql: ['3306'],
    mariadb: ['3306'], mongo: ['27017'], rabbitmq: ['5672', '15672'], memcached: ['11211'],
    traefik: ['80'], grafana: ['3000'], prometheus: ['9090'], jenkins: ['8080', '50000'],
    wordpress: ['80'], elasticsearch: ['9200', '9300'], kibana: ['5601'],
    sonarqube: ['9000'], nextcloud: ['80'], 'selfstudy/api': ['8000'],
    'selfstudy/web': ['80'], myapp: ['3000'],
};

// ---------------------------------------------------------------------------
// Command builders. Every one returns the exact `docker …` line, quoted.
// ---------------------------------------------------------------------------

export interface RunOptions {
    image: string;
    name?: string;
    ports?: { host: string; container: string }[];
    volumes?: { source: string; target: string }[];
    env?: { key: string; value: string }[];
}

/** `docker run -d [--name n] [-p h:c]... [-v s:t]... [-e K=V]... image`. */
export function runCommand(options: RunOptions): string {
    const words: string[] = ['docker', 'run', '-d'];
    if (options.name && options.name.trim()) words.push('--name', options.name.trim());
    for (const port of options.ports || []) {
        if (!String(port.container).trim()) continue;
        const host = String(port.host ?? '').trim();
        if (host === '') continue;
        words.push('-p', `${host}:${String(port.container).trim()}`);
    }
    for (const volume of options.volumes || []) {
        if (!volume.source.trim() || !volume.target.trim()) continue;
        words.push('-v', `${volume.source.trim()}:${volume.target.trim()}`);
    }
    for (const pair of options.env || []) {
        if (!pair.key.trim()) continue;
        words.push('-e', `${pair.key.trim()}=${pair.value}`);
    }
    words.push(options.image);
    return cli(words);
}

export const cmd = {
    start: (names: string[]) => cli(['docker', 'start', ...names]),
    stop: (names: string[]) => cli(['docker', 'stop', ...names]),
    restart: (names: string[]) => cli(['docker', 'restart', ...names]),
    pause: (name: string) => cli(['docker', 'pause', name]),
    unpause: (name: string) => cli(['docker', 'unpause', name]),
    rm: (names: string[], force: boolean) =>
        cli(force ? ['docker', 'rm', '-f', ...names] : ['docker', 'rm', ...names]),
    logs: (name: string) => cli(['docker', 'logs', name]),
    inspect: (name: string) => cli(['docker', 'inspect', name]),
    exec: (name: string, command: string) => cli(['docker', 'exec', name, 'sh', '-c', command]),
    ls: (name: string, path: string) => cli(['docker', 'exec', name, 'ls', path]),
    cat: (name: string, path: string) => cli(['docker', 'exec', name, 'cat', path]),
    write: (name: string, path: string, body: string) =>
        cli(['docker', 'exec', name, 'sh', '-c', `printf %s ${shellWord(body)} > ${shellWord(path)}`]),
    rmFile: (name: string, path: string) => cli(['docker', 'exec', name, 'rm', path]),
    pull: (ref: string) => cli(['docker', 'pull', ref]),
    push: (ref: string) => cli(['docker', 'push', ref]),
    tag: (source: string, target: string) => cli(['docker', 'tag', source, target]),
    rmi: (refs: string[], force = false) =>
        cli(force ? ['docker', 'rmi', '-f', ...refs] : ['docker', 'rmi', ...refs]),
    imagePrune: (all: boolean) => cli(['docker', 'image', 'prune'], { '-a': all, '-f': true }),
    volumeCreate: (name: string) => cli(['docker', 'volume', 'create', name]),
    volumeRm: (names: string[]) => cli(['docker', 'volume', 'rm', ...names]),
    volumePrune: () => cli(['docker', 'volume', 'prune', '-f']),
    networkCreate: (name: string, driver: string, subnet: string) =>
        cli(['docker', 'network', 'create', name],
            { '--driver': driver && driver !== 'bridge' ? driver : '', '--subnet': subnet }),
    networkRm: (names: string[]) => cli(['docker', 'network', 'rm', ...names]),
    networkConnect: (network: string, container: string, alias: string) =>
        cli(['docker', 'network', 'connect'], { '--alias': alias }) + ' '
        + cli([network, container]),
    networkDisconnect: (network: string, container: string) =>
        cli(['docker', 'network', 'disconnect', network, container]),
    networkPrune: () => cli(['docker', 'network', 'prune', '-f']),
    build: (tag: string, dockerfile: string) =>
        cli(['docker', 'build'], { '-t': tag, '-f': dockerfile === 'Dockerfile' ? '' : dockerfile })
        + ' .',
    buildRm: (ids: string[]) => cli(['docker', 'buildx', 'history', 'rm', ...ids]),
    composeUp: (project: string, file: string) =>
        cli(['docker', 'compose'], composeFlags(project, file)) + ' up -d',
    compose: (verb: string, project: string, file = '') =>
        cli(['docker', 'compose'], composeFlags(project, file)) + ' ' + verb,
};

function composeFlags(project: string, file: string): Record<string, string> {
    return {
        '-f': file && file !== 'docker-compose.yml' ? file : '',
        '-p': project && project !== 'lab' ? project : '',
    };
}

/** One shell word inside an `sh -c` script - single-quoted. */
export function shellWord(text: string): string {
    return "'" + String(text).replace(/'/g, "'\\''") + "'";
}

/** A container name the way the daemon accepts it. */
export const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

export function statusLabel(row: Container): string {
    if (row.status === 'running') return 'Running';
    if (row.status === 'paused') return 'Paused';
    if (row.status === 'exited') return `Exited (${row.exit_code})`;
    return 'Created';
}

export function copyText(text: string) {
    try { void navigator.clipboard.writeText(text); } catch { /* ignored */ }
}

/** A deterministic sparkline series for the Stats tab, ending at `last`. */
export function series(seed: string, last: number, max: number, points = 40): number[] {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const out: number[] = [];
    let level = last;
    for (let i = 0; i < points - 1; i++) {
        hash = (hash * 1103515245 + 12345) >>> 0;
        const step = (((hash >>> 8) % 1000) / 1000 - 0.5) * 0.12;
        // A gentle random walk pulled back towards the current value.
        level = Math.max(0, Math.min(max, level * (1 + step) + (last - level) * 0.15));
        out.push(level);
    }
    out.push(last);
    return out;
}
