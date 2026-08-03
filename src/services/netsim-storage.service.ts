/**
 * src/services/netsim-storage.service.ts
 *
 * JSON storage for the Network Simulator, backed by the dedicated GitHub repo
 *   https://github.com/selfstudyjo/selfstudynetworksimulator_data
 *
 * Layout inside the repo (one JSON file per record, mirroring the flat-file
 * pattern the Django backends use in `json_storage.py`):
 *
 *   users/<username>/profile.json                 preferences + counters
 *   users/<username>/progress.json                lessons, scores, badges, XP
 *   users/<username>/projects/index.json          lightweight project list
 *   users/<username>/projects/<projectId>.json    the full project + topology
 *   users/<username>/ai/<sessionId>.json          saved AI conversations
 *   shared/index.json                             community-shared projects
 *   shared/<projectId>.json
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE MODES, and why
 *
 *   'proxy'  A backend endpoint holds the GitHub token and performs the reads
 *            and writes. This is the only mode that works for real users, and
 *            the only one that is actually secure. Discovered automatically
 *            through the sfsdomains registry — no replica URL is hardcoded.
 *
 *   'token'  A GitHub token supplied AT RUNTIME by an operator and kept in this
 *            browser's localStorage. Useful for admin work and local development.
 *
 *   'local'  No credentials at all. Everything lives in localStorage. The studio
 *            is fully functional; it just does not sync between devices.
 *
 * The token is deliberately NOT read from an environment variable. Anything in a
 * VITE_* variable is compiled into the JavaScript bundle and published with the
 * site — GitHub's own push protection rejects a deploy that contains one, which
 * is the correct outcome. Runtime-only, or server-side, or nothing.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Behaviour notes:
 *  • Writes are serialised per path so two rapid saves cannot race, and a stale
 *    SHA is retried once after re-reading the current one.
 *  • Every write also lands in localStorage, and every read falls back to it, so
 *    work is never lost to a network problem.
 */

const REPO_OWNER = import.meta.env.VITE_NETSIM_DATA_OWNER || 'selfstudyjo';
const REPO_NAME = import.meta.env.VITE_NETSIM_DATA_REPO || 'selfstudynetworksimulator_data';
const BRANCH = import.meta.env.VITE_NETSIM_DATA_BRANCH || 'main';
const API_ROOT = 'https://api.github.com';

/**
 * Optional explicit override for the storage proxy, for local development.
 * **This is an endpoint, never a credential.** It is validated as a URL so that
 * pasting a token here cannot silently ship it in the bundle — `vite.config.ts`
 * also fails the build on that mistake, but this one is cheap and worth it.
 *
 * Leave it blank in production: the proxy is discovered through the sfsdomains
 * registry like every other backend, so no replica URL is ever hardcoded and
 * requests spread across (and fail over between) all replicas.
 */
const PROXY_OVERRIDE = (() => {
    const raw = (import.meta.env.VITE_NETSIM_STORAGE_PROXY || '').trim();
    if (!raw) return '';
    if (!/^https?:\/\//i.test(raw)) {
        console.error(
            '[netsim] VITE_NETSIM_STORAGE_PROXY must be an http(s) URL of a backend endpoint, not a token. ' +
            'Ignoring it. A GitHub token must never appear in a VITE_* variable — it would be published in the bundle.'
        );
        return '';
    }
    return raw.replace(/\/+$/, '');
})();

/** The backend hosting the storage proxy. Defaults to Self Study AI (app 27). */
const PROXY_APP_ID = parseInt(
    import.meta.env.VITE_NETSIM_STORAGE_APP_ID || import.meta.env.VITE_NETSIM_AI_APP_ID || '27',
    10
);

/** The shared service token every SelfStudy backend already expects. */
const SERVICE_TOKEN = import.meta.env.VITE_AUTH_TOKEN || '';

const LS_PREFIX = 'netsim:store:';
const LS_TOKEN_KEY = 'netsim:github-token';

export type StorageMode = 'proxy' | 'token' | 'local';

export interface StoredFile<T> {
    data: T;
    sha?: string;
    /** True when the value came from localStorage rather than the repo. */
    local?: boolean;
}

export interface StorageStatus {
    mode: StorageMode;
    /** False until backend discovery has finished; nothing should render before. */
    settled: boolean;
    configured: boolean;
    online: boolean;
    repo: string;
    branch: string;
    proxy: string;
    lastError?: string;
    lastSyncAt?: string;
    pendingWrites: number;
}

export interface DirEntry {
    name: string;
    path: string;
    type: string;
    size: number;
    sha: string;
}

/* ─────────────────── base64 helpers (UTF-8 safe) ─────────────────── */

function toBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
}

function fromBase64(b64: string): string {
    const bin = atob((b64 || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

/* ─────────────────── the service ─────────────────── */

class NetSimStorageService {
    /** Runtime-only. Never sourced from the build, never persisted to the repo. */
    private token = '';

    private shaCache = new Map<string, string>();
    /** One promise chain per path so writes to the same file never interleave. */
    private writeChains = new Map<string, Promise<any>>();
    private pending = 0;
    private lastError?: string;
    private lastSyncAt?: string;
    private online = true;

    /** Proxy discovery state. Probed once, then cached for the session. */
    private proxyBases: string[] = [];
    private proxyCursor = 0;
    private proxyState: 'unknown' | 'available' | 'unavailable' = 'unknown';
    private readyPromise: Promise<void> | null = null;

    constructor() {
        try {
            this.token = (localStorage.getItem(LS_TOKEN_KEY) || '').trim();
        } catch {
            this.token = '';
        }
    }

    /* ── proxy discovery ── */

    /**
     * Resolve the storage proxy through the registry and confirm it is actually
     * deployed. Runs at most once per session; a backend that has not shipped the
     * endpoint yet simply leaves the studio in its previous mode, quietly.
     */
    async ensureReady(): Promise<void> {
        if (this.proxyState !== 'unknown') return;
        if (this.readyPromise) return this.readyPromise;

        this.readyPromise = (async () => {
            try {
                if (PROXY_OVERRIDE) {
                    this.proxyBases = [PROXY_OVERRIDE];
                } else {
                    const { serviceRegistry } = await import('./config');
                    this.proxyBases = await serviceRegistry.getServiceReplicas(PROXY_APP_ID, 'netsim-storage');
                }
                if (!this.proxyBases.length) { this.proxyState = 'unavailable'; return; }

                // Probe each replica until one answers; the endpoint may not be
                // deployed everywhere yet.
                for (let i = 0; i < this.proxyBases.length; i++) {
                    const base = this.proxyBases[i];
                    try {
                        const res = await fetch(`${base}/api/netsim/health`, {
                            headers: this.proxyHeaders(), cache: 'no-store',
                        });
                        // 404 means this backend has no storage proxy yet.
                        if (res.status === 404) continue;
                        if (res.ok || res.status === 503) {
                            const body = await res.json().catch(() => ({}));
                            if (body?.ok) {
                                this.proxyCursor = i;
                                this.proxyState = 'available';
                                return;
                            }
                            // Deployed but not configured — report the reason.
                            this.lastError = body?.error || 'The storage proxy is deployed but has no GitHub token configured.';
                        }
                    } catch {
                        /* try the next replica */
                    }
                }
                this.proxyState = 'unavailable';
            } catch {
                this.proxyState = 'unavailable';
            } finally {
                this.readyPromise = null;
            }
        })();

        return this.readyPromise;
    }

    /** Force a fresh probe, e.g. after the backend has been deployed. */
    async recheck(): Promise<void> {
        this.proxyState = 'unknown';
        this.proxyBases = [];
        this.readyPromise = null;
        await this.ensureReady();
    }

    private proxyBase(): string {
        return this.proxyBases[this.proxyCursor] || this.proxyBases[0] || '';
    }

    /* ── configuration ── */

    get mode(): StorageMode {
        if (this.proxyState === 'available') return 'proxy';
        if (this.token) return 'token';
        return 'local';
    }

    isConfigured(): boolean {
        return this.mode !== 'local';
    }

    get repoSlug(): string {
        return `${REPO_OWNER}/${REPO_NAME}`;
    }

    status(): StorageStatus {
        return {
            mode: this.mode,
            settled: this.proxyState !== 'unknown',
            configured: this.isConfigured(),
            online: this.online,
            repo: this.repoSlug,
            branch: BRANCH,
            proxy: this.proxyBase(),
            lastError: this.lastError,
            lastSyncAt: this.lastSyncAt,
            pendingWrites: this.pending,
        };
    }

    /**
     * Supply a token at runtime. Persisted to this browser only — it is never
     * committed, never sent anywhere except api.github.com, and never logged.
     */
    setToken(token: string, persist = true): void {
        this.token = (token || '').trim();
        this.shaCache.clear();
        this.lastError = undefined;
        if (!persist) return;
        try {
            if (this.token) localStorage.setItem(LS_TOKEN_KEY, this.token);
            else localStorage.removeItem(LS_TOKEN_KEY);
        } catch {
            /* private browsing — in-memory only for this session */
        }
    }

    clearToken(): void {
        this.setToken('');
    }

    hasRuntimeToken(): boolean {
        return this.token.length > 0;
    }

    /** Masked form for display, so an operator can confirm which token is loaded. */
    tokenHint(): string {
        if (!this.token) return '';
        return `${this.token.slice(0, 7)}…${this.token.slice(-4)}`;
    }

    /* ── request plumbing ── */

    private ghHeaders(): Record<string, string> {
        const h: Record<string, string> = {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
        if (this.token) h.Authorization = `Bearer ${this.token}`;
        return h;
    }

    private proxyHeaders(): Record<string, string> {
        const h: Record<string, string> = { Accept: 'application/json' };
        if (SERVICE_TOKEN) h.Authorization = `Token ${SERVICE_TOKEN}`;
        return h;
    }

    private ghUrl(path: string): string {
        const clean = path.replace(/^\/+/, '');
        return `${API_ROOT}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURI(clean)}`;
    }

    private proxyUrl(kind: 'file' | 'dir' | 'health', path?: string): string {
        const base = `${this.proxyBase()}/api/netsim/${kind}`;
        return path === undefined ? base : `${base}?path=${encodeURIComponent(path.replace(/^\/+/, ''))}`;
    }

    /* ── localStorage mirror ── */

    private lsKey(path: string): string {
        return `${LS_PREFIX}${path}`;
    }

    private readLocal<T>(path: string): T | null {
        try {
            const raw = localStorage.getItem(this.lsKey(path));
            return raw ? (JSON.parse(raw) as T) : null;
        } catch {
            return null;
        }
    }

    private writeLocal<T>(path: string, data: T): void {
        try {
            localStorage.setItem(this.lsKey(path), JSON.stringify(data));
        } catch {
            /* quota — nothing useful to do */
        }
    }

    private removeLocal(path: string): void {
        try { localStorage.removeItem(this.lsKey(path)); } catch { /* ignore */ }
    }

    /** Every locally-cached path, used to rebuild an index offline. */
    localPaths(prefix = ''): string[] {
        const out: string[] = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || !k.startsWith(LS_PREFIX)) continue;
                const p = k.slice(LS_PREFIX.length);
                if (!prefix || p.startsWith(prefix)) out.push(p);
            }
        } catch { /* ignore */ }
        return out;
    }

    /* ── reads ── */

    async getJson<T>(path: string, opts: { allowLocalFallback?: boolean } = {}): Promise<StoredFile<T> | null> {
        const allowLocal = opts.allowLocalFallback !== false;
        await this.ensureReady();
        const localOr = (): StoredFile<T> | null => {
            const local = allowLocal ? this.readLocal<T>(path) : null;
            return local ? { data: local, local: true } : null;
        };

        if (this.mode === 'local') return localOr();

        try {
            if (this.mode === 'proxy') {
                const res = await fetch(this.proxyUrl('file', path), { headers: this.proxyHeaders(), cache: 'no-store' });
                if (res.status === 404) { this.online = true; return localOr(); }
                if (!res.ok) throw new Error(`Storage proxy read ${res.status} ${res.statusText}`);
                const body = await res.json();
                this.online = true;
                this.lastError = undefined;
                this.lastSyncAt = new Date().toISOString();
                if (body?.sha) this.shaCache.set(path, body.sha);
                if (body?.data === undefined || body?.data === null) return localOr();
                this.writeLocal(path, body.data);
                return { data: body.data as T, sha: body.sha };
            }

            const res = await fetch(`${this.ghUrl(path)}?ref=${encodeURIComponent(BRANCH)}`, {
                headers: this.ghHeaders(),
                cache: 'no-store',
            });

            if (res.status === 404) { this.online = true; return localOr(); }
            if (!res.ok) throw new Error(`GitHub read ${res.status} ${res.statusText}`);

            const body = await res.json();
            this.online = true;
            this.lastError = undefined;
            this.lastSyncAt = new Date().toISOString();

            if (body.sha) this.shaCache.set(path, body.sha);
            const text = body.encoding === 'base64' ? fromBase64(body.content) : (body.content ?? '');
            if (!text.trim()) return localOr();
            const data = JSON.parse(text) as T;
            this.writeLocal(path, data);
            return { data, sha: body.sha };
        } catch (err: any) {
            this.online = false;
            this.lastError = err?.message || 'Read failed';
            return localOr();
        }
    }

    /** Directory listing. Returns [] when the folder does not exist. */
    async listDir(path: string): Promise<DirEntry[]> {
        await this.ensureReady();
        if (this.mode === 'local') return [];
        try {
            const url = this.mode === 'proxy'
                ? this.proxyUrl('dir', path)
                : `${this.ghUrl(path)}?ref=${encodeURIComponent(BRANCH)}`;
            const headers = this.mode === 'proxy' ? this.proxyHeaders() : this.ghHeaders();

            const res = await fetch(url, { headers, cache: 'no-store' });
            if (res.status === 404) return [];
            if (!res.ok) throw new Error(`Storage list ${res.status}`);
            const body = await res.json();
            this.online = true;
            if (Array.isArray(body)) return body as DirEntry[];
            return Array.isArray(body?.entries) ? (body.entries as DirEntry[]) : [];
        } catch (err: any) {
            this.online = false;
            this.lastError = err?.message || 'List failed';
            return [];
        }
    }

    /* ── writes (serialised per path, one conflict retry) ── */

    async putJson<T>(path: string, data: T, message?: string): Promise<{ ok: boolean; sha?: string; local?: boolean; error?: string }> {
        // Always mirror locally first — the studio must never lose work to a
        // network problem.
        this.writeLocal(path, data);
        await this.ensureReady();

        if (this.mode === 'local') return { ok: true, local: true };

        const run = async (): Promise<{ ok: boolean; sha?: string; local?: boolean; error?: string }> => {
            this.pending++;
            try {
                const commitMessage = message || `Update ${path}`;

                if (this.mode === 'proxy') {
                    const res = await fetch(this.proxyUrl('file'), {
                        method: 'PUT',
                        headers: { ...this.proxyHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: path.replace(/^\/+/, ''), data, message: commitMessage }),
                    });
                    if (!res.ok) {
                        const text = await res.text().catch(() => '');
                        throw new Error(`Storage proxy write ${res.status}: ${text.slice(0, 160)}`);
                    }
                    const body = await res.json().catch(() => ({}));
                    if (body?.sha) this.shaCache.set(path, body.sha);
                    this.online = true;
                    this.lastError = undefined;
                    this.lastSyncAt = new Date().toISOString();
                    return { ok: true, sha: body?.sha };
                }

                const content = toBase64(JSON.stringify(data, null, 2));
                const attempt = (sha?: string) => fetch(this.ghUrl(path), {
                    method: 'PUT',
                    headers: { ...this.ghHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: commitMessage, content, branch: BRANCH, ...(sha ? { sha } : {}) }),
                });

                let sha = this.shaCache.get(path);
                if (!sha) {
                    // Probe for an existing file so the first write of an
                    // existing path does not fail on a missing SHA.
                    const existing = await this.getJson<T>(path, { allowLocalFallback: false });
                    sha = existing?.sha || this.shaCache.get(path);
                }

                let res = await attempt(sha);

                if (res.status === 409 || res.status === 422) {
                    // Stale SHA — re-read and try once more.
                    this.shaCache.delete(path);
                    const fresh = await this.getJson<T>(path, { allowLocalFallback: false });
                    res = await attempt(fresh?.sha);
                }

                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    throw new Error(`GitHub write ${res.status}: ${text.slice(0, 160)}`);
                }

                const body = await res.json();
                const newSha = body?.content?.sha;
                if (newSha) this.shaCache.set(path, newSha);
                this.online = true;
                this.lastError = undefined;
                this.lastSyncAt = new Date().toISOString();
                return { ok: true, sha: newSha };
            } catch (err: any) {
                this.online = false;
                this.lastError = err?.message || 'Write failed';
                // The local mirror already holds the data.
                return { ok: false, local: true, error: this.lastError };
            } finally {
                this.pending--;
            }
        };

        const previous = this.writeChains.get(path) || Promise.resolve();
        const chained = previous.then(run, run);
        this.writeChains.set(path, chained.catch(() => undefined));
        return chained;
    }

    async deletePath(path: string, message?: string): Promise<{ ok: boolean; error?: string }> {
        this.removeLocal(path);
        await this.ensureReady();
        if (this.mode === 'local') return { ok: true };

        try {
            if (this.mode === 'proxy') {
                const res = await fetch(this.proxyUrl('file', path), {
                    method: 'DELETE',
                    headers: { ...this.proxyHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: path.replace(/^\/+/, ''), message: message || `Delete ${path}` }),
                });
                if (!res.ok && res.status !== 404) {
                    const text = await res.text().catch(() => '');
                    throw new Error(`Storage proxy delete ${res.status}: ${text.slice(0, 160)}`);
                }
                this.shaCache.delete(path);
                this.online = true;
                this.lastSyncAt = new Date().toISOString();
                return { ok: true };
            }

            let sha = this.shaCache.get(path);
            if (!sha) {
                const existing = await this.getJson<any>(path, { allowLocalFallback: false });
                sha = existing?.sha;
            }
            if (!sha) return { ok: true }; // nothing to delete

            const res = await fetch(this.ghUrl(path), {
                method: 'DELETE',
                headers: { ...this.ghHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message || `Delete ${path}`, sha, branch: BRANCH }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`GitHub delete ${res.status}: ${text.slice(0, 160)}`);
            }
            this.shaCache.delete(path);
            this.online = true;
            this.lastSyncAt = new Date().toISOString();
            return { ok: true };
        } catch (err: any) {
            this.online = false;
            this.lastError = err?.message || 'Delete failed';
            return { ok: false, error: this.lastError };
        }
    }

    /** Connectivity + permission probe used by the storage settings panel. */
    async testConnection(): Promise<{ ok: boolean; canRead: boolean; canWrite: boolean; message: string }> {
        await this.recheck();
        if (this.mode === 'local') {
            return {
                ok: false, canRead: false, canWrite: false,
                message: this.lastError
                    ? `No storage available: ${this.lastError} Projects are kept in this browser only.`
                    : 'No storage proxy found on the backend, so projects are kept in this browser only. Deploy the /api/netsim/* endpoints, or paste a token below to sync from this device.',
            };
        }

        try {
            if (this.mode === 'proxy') {
                const res = await fetch(this.proxyUrl('health'), { headers: this.proxyHeaders(), cache: 'no-store' });
                if (!res.ok) {
                    return { ok: false, canRead: false, canWrite: false, message: `The storage proxy at ${this.proxyBase()} returned HTTP ${res.status}.` };
                }
                const body = await res.json().catch(() => ({}));
                this.online = true;
                const canWrite = body?.canWrite !== false;
                return {
                    ok: true, canRead: true, canWrite,
                    message: canWrite
                        ? `Connected through the backend proxy at ${this.proxyBase()} to ${body?.repo || this.repoSlug} (${body?.branch || BRANCH}).`
                        : `The proxy can read ${body?.repo || this.repoSlug} but not write to it — saves will stay local.`,
                };
            }

            const repoRes = await fetch(`${API_ROOT}/repos/${REPO_OWNER}/${REPO_NAME}`, { headers: this.ghHeaders(), cache: 'no-store' });
            if (!repoRes.ok) {
                return {
                    ok: false, canRead: false, canWrite: false,
                    message: `Cannot read ${this.repoSlug} (HTTP ${repoRes.status}). Check the token and that it grants access to that repository.`,
                };
            }
            const repo = await repoRes.json();
            const canWrite = !!repo?.permissions?.push;
            this.online = true;
            return {
                ok: true,
                canRead: true,
                canWrite,
                message: canWrite
                    ? `Connected to ${this.repoSlug} (${BRANCH}) with write access, using the token stored on this device.`
                    : `Connected to ${this.repoSlug} but the token is read-only — saves will stay local.`,
            };
        } catch (err: any) {
            this.online = false;
            return { ok: false, canRead: false, canWrite: false, message: err?.message || 'Connection failed' };
        }
    }

    /** Normalise a username into something safe for a repo path. */
    static safeUser(username: string): string {
        return (username || 'anonymous')
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'anonymous';
    }
}

export const netsimStorage = new NetSimStorageService();
export const safeUser = NetSimStorageService.safeUser;

/* ─────────────────── path builders ─────────────────── */

export const paths = {
    userRoot: (u: string) => `users/${safeUser(u)}`,
    profile: (u: string) => `users/${safeUser(u)}/profile.json`,
    progress: (u: string) => `users/${safeUser(u)}/progress.json`,
    projectIndex: (u: string) => `users/${safeUser(u)}/projects/index.json`,
    project: (u: string, id: string) => `users/${safeUser(u)}/projects/${id}.json`,
    projectsDir: (u: string) => `users/${safeUser(u)}/projects`,
    aiSession: (u: string, id: string) => `users/${safeUser(u)}/ai/${id}.json`,
    aiDir: (u: string) => `users/${safeUser(u)}/ai`,
    sharedIndex: () => 'shared/index.json',
    shared: (id: string) => `shared/${id}.json`,
};
