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
 * Behaviour notes:
 *  • Writes are serialised per path so two rapid saves cannot race, and a 409
 *    (stale SHA) is retried once after re-reading the current SHA.
 *  • Every write also lands in localStorage, and every read falls back to it.
 *    That means the studio keeps working offline, and keeps working if the
 *    repo token is missing — it just stops syncing.
 *  • The token is read from the environment only. It is never written to a file
 *    and never logged.
 */

const REPO_OWNER = import.meta.env.VITE_NETSIM_DATA_OWNER || 'selfstudyjo';
const REPO_NAME = import.meta.env.VITE_NETSIM_DATA_REPO || 'selfstudynetworksimulator_data';
const BRANCH = import.meta.env.VITE_NETSIM_DATA_BRANCH || 'main';
const API_ROOT = 'https://api.github.com';

const LS_PREFIX = 'netsim:store:';

export interface StoredFile<T> {
    data: T;
    sha?: string;
    /** True when the value came from localStorage rather than the repo. */
    local?: boolean;
}

export interface StorageStatus {
    configured: boolean;
    online: boolean;
    repo: string;
    branch: string;
    lastError?: string;
    lastSyncAt?: string;
    pendingWrites: number;
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
    private token: string = (import.meta.env.VITE_NETSIM_GITHUB_TOKEN
        || import.meta.env.VITE_NETSIM_DATA_TOKEN
        || '').trim();

    private shaCache = new Map<string, string>();
    /** One promise chain per path so writes to the same file never interleave. */
    private writeChains = new Map<string, Promise<any>>();
    private pending = 0;
    private lastError?: string;
    private lastSyncAt?: string;
    private online = true;

    /* ── configuration ── */

    isConfigured(): boolean {
        return this.token.length > 0;
    }

    get repoSlug(): string {
        return `${REPO_OWNER}/${REPO_NAME}`;
    }

    status(): StorageStatus {
        return {
            configured: this.isConfigured(),
            online: this.online,
            repo: this.repoSlug,
            branch: BRANCH,
            lastError: this.lastError,
            lastSyncAt: this.lastSyncAt,
            pendingWrites: this.pending,
        };
    }

    /** Allow the UI to supply a token at runtime (kept in memory only). */
    setToken(token: string): void {
        this.token = (token || '').trim();
        this.shaCache.clear();
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
        if (this.token) h.Authorization = `Bearer ${this.token}`;
        return h;
    }

    private url(path: string): string {
        const clean = path.replace(/^\/+/, '');
        return `${API_ROOT}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURI(clean)}`;
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

        if (!this.isConfigured()) {
            const local = this.readLocal<T>(path);
            return local ? { data: local, local: true } : null;
        }

        try {
            const res = await fetch(`${this.url(path)}?ref=${encodeURIComponent(BRANCH)}`, {
                headers: this.headers(),
                cache: 'no-store',
            });

            if (res.status === 404) {
                this.online = true;
                // Not an error — the record simply does not exist yet.
                const local = allowLocal ? this.readLocal<T>(path) : null;
                return local ? { data: local, local: true } : null;
            }
            if (!res.ok) {
                throw new Error(`GitHub read ${res.status} ${res.statusText}`);
            }

            const body = await res.json();
            this.online = true;
            this.lastError = undefined;
            this.lastSyncAt = new Date().toISOString();

            if (body.sha) this.shaCache.set(path, body.sha);
            const text = body.encoding === 'base64' ? fromBase64(body.content) : (body.content ?? '');
            const data = text.trim() ? (JSON.parse(text) as T) : (null as unknown as T);
            if (data !== null) this.writeLocal(path, data);
            return data === null ? null : { data, sha: body.sha };
        } catch (err: any) {
            this.online = false;
            this.lastError = err?.message || 'Read failed';
            const local = allowLocal ? this.readLocal<T>(path) : null;
            return local ? { data: local, local: true } : null;
        }
    }

    /** Directory listing. Returns [] when the folder does not exist. */
    async listDir(path: string): Promise<Array<{ name: string; path: string; type: string; size: number; sha: string }>> {
        if (!this.isConfigured()) return [];
        try {
            const res = await fetch(`${this.url(path)}?ref=${encodeURIComponent(BRANCH)}`, {
                headers: this.headers(),
                cache: 'no-store',
            });
            if (res.status === 404) return [];
            if (!res.ok) throw new Error(`GitHub list ${res.status}`);
            const body = await res.json();
            this.online = true;
            return Array.isArray(body) ? body : [];
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

        if (!this.isConfigured()) {
            return { ok: true, local: true };
        }

        const run = async (): Promise<{ ok: boolean; sha?: string; local?: boolean; error?: string }> => {
            this.pending++;
            try {
                const content = toBase64(JSON.stringify(data, null, 2));
                const commitMessage = message || `Update ${path}`;

                const attempt = async (sha?: string) => {
                    const res = await fetch(this.url(path), {
                        method: 'PUT',
                        headers: { ...this.headers(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: commitMessage, content, branch: BRANCH, ...(sha ? { sha } : {}) }),
                    });
                    return res;
                };

                let sha = this.shaCache.get(path);
                if (!sha) {
                    // Probe for an existing file so the first write of an
                    // existing path does not 422.
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
        if (!this.isConfigured()) return { ok: true };

        try {
            let sha = this.shaCache.get(path);
            if (!sha) {
                const existing = await this.getJson<any>(path, { allowLocalFallback: false });
                sha = existing?.sha;
            }
            if (!sha) return { ok: true }; // nothing to delete

            const res = await fetch(this.url(path), {
                method: 'DELETE',
                headers: { ...this.headers(), 'Content-Type': 'application/json' },
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

    /** Cheap connectivity + permission probe used by the Settings panel. */
    async testConnection(): Promise<{ ok: boolean; canRead: boolean; canWrite: boolean; message: string }> {
        if (!this.isConfigured()) {
            return {
                ok: false, canRead: false, canWrite: false,
                message: 'No token configured. Set VITE_NETSIM_GITHUB_TOKEN in selfstudyjo/.env — projects will be kept in this browser only until you do.',
            };
        }
        try {
            const repoRes = await fetch(`${API_ROOT}/repos/${REPO_OWNER}/${REPO_NAME}`, { headers: this.headers(), cache: 'no-store' });
            if (!repoRes.ok) {
                return { ok: false, canRead: false, canWrite: false, message: `Cannot read ${this.repoSlug} (HTTP ${repoRes.status}). Check the token and its repository access.` };
            }
            const repo = await repoRes.json();
            const canWrite = !!repo?.permissions?.push;
            this.online = true;
            return {
                ok: true,
                canRead: true,
                canWrite,
                message: canWrite
                    ? `Connected to ${this.repoSlug} (${BRANCH}) with write access.`
                    : `Connected to ${this.repoSlug} but the token has read-only access — saves will stay local.`,
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
