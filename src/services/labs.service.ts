/**
 * The playground labs (app 11): the catalogue, a lab's environment, and progress.
 *
 * Separate from `lab.service.ts`, which is the three standalone practice tools -
 * the terminal, the SQL editor and the Python compiler. They share a backend and
 * nothing else: those three are a scratchpad anybody can open from the top bar,
 * and this is a curriculum with tasks, progress and a grade.
 *
 * Three things here are load-bearing and easy to undo:
 *
 * **The replica is PINNED per student, not re-picked per call.** `openLab` learns
 * the `home_replica` from the response and every later call for that lab goes
 * straight there. The environment does not replicate - it is a file on one
 * replica's disk - so a command sent elsewhere is forwarded, which works and
 * costs a hop; but a VIEW read from elsewhere would be forwarded too and any
 * failure in that chain reads as an empty dashboard. Same pin
 * `lab.service.ts` already keeps, and the same reason working rule 31 exists.
 *
 * **`getHeaders` is not used for the catalogue.** Every call here goes through
 * `apiService`, which adds the token and the `X-User-ID`; the catalogue endpoints
 * do not need a user and the environment ones take the username in the PATH,
 * because that is what the backend homes on.
 *
 * **A failed grade never breaks the page.** The tasks list is the whole point of
 * a lab, so `gradeLab` answers `null` on a transport failure and the view keeps
 * whatever it had. A lab where the tools work and the tick marks are stale is
 * usable; one that shows an error card instead of the console is not.
 */
import { apiService } from './api';
import { serviceRegistry } from './config';
import type {
    Lab, LabGrade, LabProgress, LabSummary, LabTool, LabTrack,
} from '@/utils/labCatalogue';

export interface OpenLabResponse {
    ok: boolean;
    lab: Lab;
    tools: LabTool[];
    progress: LabProgress | null;
    grade: LabGrade;
    views: Record<string, unknown>;
    replica: string;
    ran_on?: string;
    note?: string;
}

export interface ToolResult {
    ok: boolean;
    output?: string;
    error?: string;
    code?: number;
    tool?: string;
    engine?: string;
    simulated?: boolean;
    /** SQL-shaped tools answer with these instead of `output`. */
    columns?: string[];
    rows?: Array<Record<string, unknown>>;
    truncated?: boolean;
    /**
     * Where the shell is, and the four things it says beyond text.
     *
     * `clear` is a control signal rather than empty output — a console that
     * printed "(no output)" for `clear` was the second thing reported about
     * these labs. `editor` is nano or vi asking the browser to open a buffer,
     * because there is no pseudo-terminal anywhere in this design and a curses
     * program cannot exist. `cwd` and `prompt` are what the prompt draws and
     * what Tab completion is relative to.
     */
    cwd?: string;
    prompt?: string;
    clear?: boolean;
    editor?: {
        program: 'nano' | 'vi';
        path: string;
        name: string;
        content: string;
        existing: boolean;
    };
    ran_on?: string;
    note?: string;
}

export interface CompletionSet {
    ok?: boolean;
    /** Where these names are relative to, e.g. `~/practice`. */
    prompt?: string;
    cwd?: string;
    commands: string[];
    dirs: string[];
    files: string[];
    paths?: string[];
}

export interface FileEntry {
    path: string;
    bytes: number;
}

/**
 * What `list` answers: the files, AND the folders.
 *
 * `dirs` carries every directory including the ones a file implies, and the
 * browser deliberately does not derive them — an EMPTY folder is implied by
 * nothing, and it is exactly the one a student has just made with New Folder
 * and is waiting to see.
 */
export interface FileListing {
    files: FileEntry[];
    dirs: string[];
    limits?: { max_files?: number; max_bytes?: number };
}

export interface WebSource {
    html?: string;
    css?: string;
    js?: string;
}

export interface HistoryEntry {
    tool: string;
    command: string;
    code: number;
    at: string;
}

class LabsService {
    /** Which replica holds each student's environments, learned from `openLab`. */
    private homes = new Map<string, string>();

    private ensureHttps(url: string): string {
        if (!url) return url;
        return url.startsWith('http://') ? url.replace(/^http:/, 'https:') : url;
    }

    private async catalogueReplica(): Promise<string | null> {
        const replica = await serviceRegistry.getRandomLabReplica();
        return replica ? this.ensureHttps(replica) : null;
    }

    private async replicaFor(username: string): Promise<string | null> {
        const home = username ? this.homes.get(username) : undefined;
        if (home) return home;
        return this.catalogueReplica();
    }

    private remember(username: string, response: { replica?: string; ran_on?: string }): void {
        const home = response?.ran_on || response?.replica;
        if (username && home) this.homes.set(username, this.ensureHttps(home));
    }

    /* ─────────────── the catalogue ─────────────── */

    /**
     * The tracks and the whole lab list in one pair of calls.
     *
     * Both are small - the list carries no brief and no tasks - and both are
     * needed to draw the catalogue page, so they go out together rather than one
     * after the other: a cold PythonAnywhere replica takes ~20 seconds for its
     * first answer, and serialising two of those is forty.
     */
    async getCatalogue(): Promise<{ tracks: LabTrack[]; labs: LabSummary[] }> {
        const replica = await this.catalogueReplica();
        if (!replica) return { tracks: [], labs: [] };
        try {
            const [tracks, labs] = await Promise.all([
                apiService.get<{ tracks: LabTrack[] }>(replica, '/api/labs/tracks/'),
                apiService.get<{ labs: LabSummary[] }>(replica, '/api/labs/'),
            ]);
            return { tracks: tracks?.tracks || [], labs: labs?.labs || [] };
        } catch (error) {
            console.warn('Could not load the lab catalogue', error);
            return { tracks: [], labs: [] };
        }
    }

    async getLab(labId: string): Promise<Lab | null> {
        const replica = await this.catalogueReplica();
        if (!replica) return null;
        try {
            const payload = await apiService.get<{ lab: Lab }>(
                replica, `/api/labs/${encodeURIComponent(labId)}/`);
            return payload?.lab || null;
        } catch {
            return null;
        }
    }

    async getTools(): Promise<LabTool[]> {
        const replica = await this.catalogueReplica();
        if (!replica) return [];
        try {
            const payload = await apiService.get<{ tools: LabTool[] }>(
                replica, '/api/labs/tools/');
            return payload?.tools || [];
        } catch {
            return [];
        }
    }

    /* ─────────────── one lab ─────────────── */

    /**
     * Seed the environment and get the lab, its tools, the grade and the views.
     *
     * One call, because this is what a lab page does on load and four round
     * trips against a cold replica is a page that takes a minute and a half to
     * appear. It tries every replica in turn rather than one - a lab page that
     * does nothing because a single replica happened to be cold is not worth
     * saving one request for.
     */
    async openLab(username: string, labId: string,
                  options: { userId?: string; fullName?: string; reset?: boolean } = {},
    ): Promise<OpenLabResponse | null> {
        const replicas = await serviceRegistry.getLabReplicas();
        if (replicas.length === 0) return null;
        const pinned = this.homes.get(username);
        const ordered = pinned
            ? [pinned, ...replicas.map(r => this.ensureHttps(r)).filter(r => r !== pinned)]
            : replicas.map(r => this.ensureHttps(r));

        let lastError: any = null;
        for (const replica of ordered) {
            try {
                const payload = await apiService.post<OpenLabResponse>(
                    replica, `/api/labs/${encodeURIComponent(labId)}/open/${encodeURIComponent(username)}/`,
                    {
                        user_id: options.userId || '',
                        full_name: options.fullName || '',
                        reset: Boolean(options.reset),
                    });
                this.remember(username, payload);
                return payload;
            } catch (error: any) {
                lastError = error;
                // A 4xx is the service answering, not a dead replica: the next
                // one would say the same thing.
                if (error?.status && error.status >= 400 && error.status < 500) break;
            }
        }
        console.warn('Could not open the lab', lastError?.message || lastError);
        return null;
    }

    async gradeLab(username: string, labId: string,
                   options: { userId?: string; selfMarked?: string[] } = {},
    ): Promise<{ grade: LabGrade; progress: LabProgress | null;
                 views: Record<string, unknown> } | null> {
        const replica = await this.replicaFor(username);
        if (!replica) return null;
        try {
            return await apiService.post(
                replica,
                `/api/labs/${encodeURIComponent(labId)}/grade/${encodeURIComponent(username)}/`,
                { user_id: options.userId || '', self_marked: options.selfMarked || [] });
        } catch (error) {
            // Never fatal: the tools still work and the ticks are simply stale.
            console.warn('Could not grade the lab', error);
            return null;
        }
    }

    async resetLab(username: string, labId: string,
                   resetDatasets = false): Promise<boolean> {
        const replica = await this.replicaFor(username);
        if (!replica) return false;
        try {
            await apiService.post(
                replica,
                `/api/labs/${encodeURIComponent(labId)}/reset/${encodeURIComponent(username)}/`,
                { reset_datasets: resetDatasets });
            return true;
        } catch {
            return false;
        }
    }

    /** What the AI tutor is told. Text, not a state document — see the backend. */
    async getContext(username: string, labId: string): Promise<string> {
        const replica = await this.replicaFor(username);
        if (!replica) return '';
        try {
            const payload = await apiService.get<{ context: string }>(
                replica,
                `/api/labs/${encodeURIComponent(labId)}/context/${encodeURIComponent(username)}/`);
            return payload?.context || '';
        } catch {
            return '';
        }
    }

    /* ─────────────── the tools ─────────────── */

    async runTool(username: string, labId: string, toolId: string,
                  payload: Record<string, unknown>): Promise<ToolResult> {
        const replica = await this.replicaFor(username);
        if (!replica) {
            return { ok: false, error: 'The lab service is unreachable' };
        }
        try {
            const result = await apiService.post<ToolResult>(
                replica,
                `/api/lab-tools/${encodeURIComponent(labId)}/${encodeURIComponent(toolId)}/${encodeURIComponent(username)}/`,
                payload);
            this.remember(username, result);
            return result;
        } catch (error: any) {
            return { ok: false, error: this.explain(error, 'That could not be run') };
        }
    }

    /**
     * What Tab completes against: the command names, and this directory.
     *
     * Fetched once per directory and cached by the caller, never per keystroke.
     * A round trip against a replica whose first answer of the day takes twenty
     * seconds is not a completion, it is a pause — so the console primes this on
     * the first Tab press and re-primes from the `cwd` every command carries.
     *
     * It NEVER throws and it never reports: Tab quietly doing nothing is a
     * missing convenience, and an error toast over a console because a
     * completion could not be fetched is a bug in the way of the work.
     */
    async completions(username: string, labId: string,
                      toolId = ''): Promise<CompletionSet> {
        const empty: CompletionSet = { commands: [], dirs: [], files: [], paths: [] };
        const replica = await this.replicaFor(username);
        if (!replica) return empty;
        try {
            const result = await apiService.post<CompletionSet>(
                replica,
                `/api/lab-tools/${encodeURIComponent(labId)}/complete/${encodeURIComponent(username)}/`,
                toolId ? { tool: toolId } : {});
            return {
                prompt: result?.prompt || '~',
                cwd: result?.cwd || '',
                commands: result?.commands || [],
                dirs: result?.dirs || [],
                files: result?.files || [],
                paths: result?.paths || [],
            };
        } catch {
            return empty;
        }
    }

    async listFiles(username: string, labId: string): Promise<FileEntry[]> {
        return (await this.listTree(username, labId)).files;
    }

    /** The whole filesystem: files, folders and the lab's own limits. */
    async listTree(username: string, labId: string): Promise<FileListing> {
        const result: any = await this.fileAction(username, labId, { action: 'list' });
        return {
            files: result?.files || [],
            dirs: result?.dirs || [],
            limits: result?.limits || {},
        };
    }

    /** Create a folder. An empty one exists only here, so it has to be asked for. */
    async makeFolder(username: string, labId: string,
                     path: string): Promise<ToolResult> {
        return this.fileAction(username, labId, { action: 'mkdir', path });
    }

    /**
     * Rename or move a file or a folder. ONE call, because it is one operation.
     *
     * A rename and a drag between folders differ only in whether the parent
     * changes, and two endpoints would be two copies of the refusals — which
     * are the whole of the operation. The backend carries the file MODES and
     * the empty sub-folders with it; nothing here has to know that.
     */
    async movePath(username: string, labId: string, path: string,
                   to: string): Promise<ToolResult> {
        return this.fileAction(username, labId, { action: 'move', path, to });
    }

    async readFile(username: string, labId: string, path: string): Promise<string> {
        const result = await this.fileAction(username, labId,
                                            { action: 'read', path });
        return (result as any)?.content ?? '';
    }

    async writeFile(username: string, labId: string, path: string,
                    content: string): Promise<ToolResult> {
        return this.fileAction(username, labId,
                               { action: 'write', path, content });
    }

    /**
     * Delete a file, or a folder and everything under it.
     *
     * `recursive` is passed explicitly and defaults to false, because the
     * backend refuses a non-empty folder without it for the reason `rm` asks
     * for `-r`. The browser asks first, naming the count, and then sends it.
     */
    async deleteFile(username: string, labId: string, path: string,
                     recursive = false): Promise<ToolResult> {
        return this.fileAction(username, labId,
                               { action: 'delete', path, recursive });
    }

    private async fileAction(username: string, labId: string,
                             payload: Record<string, unknown>): Promise<ToolResult> {
        const replica = await this.replicaFor(username);
        if (!replica) return { ok: false, error: 'The lab service is unreachable' };
        try {
            return await apiService.post<ToolResult>(
                replica,
                `/api/lab-tools/${encodeURIComponent(labId)}/files/${encodeURIComponent(username)}/`,
                payload);
        } catch (error: any) {
            return { ok: false, error: this.explain(error, 'That file could not be saved') };
        }
    }

    async saveWeb(username: string, labId: string,
                  source: WebSource): Promise<WebSource | null> {
        const replica = await this.replicaFor(username);
        if (!replica) return null;
        try {
            const payload = await apiService.post<{ web: WebSource }>(
                replica,
                `/api/lab-tools/${encodeURIComponent(labId)}/web/${encodeURIComponent(username)}/`,
                { action: 'save', ...source });
            return payload?.web || null;
        } catch {
            return null;
        }
    }

    async getViews(username: string, labId: string,
                   families?: string[]): Promise<Record<string, unknown>> {
        const replica = await this.replicaFor(username);
        if (!replica) return {};
        try {
            const payload = await apiService.post<{ views: Record<string, unknown> }>(
                replica,
                `/api/lab-tools/${encodeURIComponent(labId)}/views/${encodeURIComponent(username)}/`,
                { families: families || [] });
            return payload?.views || {};
        } catch {
            return {};
        }
    }

    async getHistory(username: string, labId: string,
                     tool?: string): Promise<HistoryEntry[]> {
        const replica = await this.replicaFor(username);
        if (!replica) return [];
        try {
            const payload = await apiService.post<{ history: HistoryEntry[] }>(
                replica,
                `/api/lab-tools/${encodeURIComponent(labId)}/history/${encodeURIComponent(username)}/`,
                { tool: tool || '' });
            return payload?.history || [];
        } catch {
            return [];
        }
    }

    /* ─────────────── progress ─────────────── */

    /**
     * Every progress record for this reader.
     *
     * Replicated, so any replica answers - which is why this one does NOT use
     * the pin: the catalogue page needs it before a lab has been opened, and at
     * that point there is no home replica to pin to.
     */
    async getProgress(username: string, userId = ''): Promise<LabProgress[]> {
        const replica = await this.catalogueReplica();
        if (!replica) return [];
        try {
            const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
            const payload = await apiService.get<{ progress: LabProgress[] }>(
                replica, `/api/labs/progress/${encodeURIComponent(username)}/${query}`);
            return payload?.progress || [];
        } catch {
            return [];
        }
    }

    async getLeaderboard(limit = 25): Promise<Array<{
        username: string; full_name: string; points: number;
        labs_completed: number; labs_started: number;
    }>> {
        const replica = await this.catalogueReplica();
        if (!replica) return [];
        try {
            const payload = await apiService.get<{ leaderboard: any[] }>(
                replica, `/api/labs/leaderboard/?limit=${limit}`);
            return payload?.leaderboard || [];
        } catch {
            return [];
        }
    }

    private explain(error: any, fallback: string): string {
        const code = error?.data?.code;
        if (code === 'TOOL_NOT_IN_LAB') {
            return 'That tool is not part of this lab';
        }
        if (code === 'UNKNOWN_TOOL') {
            return 'This build of the lab service does not have that tool';
        }
        if (code === 'NO_ENGINE') {
            return 'This lab has no environment for that tool yet. Reload the page.';
        }
        if (code === 'TOO_LARGE') {
            return 'That is larger than the lab allows';
        }
        if (code === 'FOLDER_ERROR') {
            return 'The lab could not open your workspace. Try again in a moment.';
        }
        if (error?.data?.error) return String(error.data.error);
        if (error?.status === 404) return 'Not found in the lab service';
        return error?.message || fallback;
    }
}

export const labsService = new LabsService();
