/**
 * Self Study User Lab (app 11) — the SQL, Linux and Python sandboxes.
 *
 * Every method here used to take a `labUrl`, read from `authStore.user.lab_url`,
 * because each lab replica had its own student table: a user existed on exactly one
 * of them, so an operator pinned them to it by hand on their profile. That field is
 * gone. The lab service replicates its records now, so this file resolves app 11
 * through the registry like every other service.
 *
 * The one thing that cannot replicate is a student's *workspace* — their files and
 * their running process live on one replica's disk. So the lab records which replica
 * that is and tells us: `check-and-create-user` returns `home_replica`, we remember
 * it for the session, and every sandbox call goes straight there. If we send a
 * command somewhere else anyway the receiving replica forwards it, so nothing breaks
 * — it just costs a hop.
 */
import { apiService } from './api';
import { serviceRegistry } from './config';

export interface Student {
    id: number;
    username: string;
    uuid_credentials: string;
    created_at: string;
    expire_date: string;
    /** The replica holding this student's files. Empty until the lab pins them. */
    home_replica?: string;
}

export interface CommandResult {
    output: string;
    error: string;
    /** Which replica actually ran it — set when the call was forwarded. */
    ran_on?: string;
    /** Set when the lab had to recreate the workspace on a different replica. */
    note?: string;
}

export interface SQLResult {
    result: any[];
    error?: string;
    truncated?: boolean;
    message?: string;
}

export interface PythonResult {
    output: string;
    error: string;
    note?: string;
}

export interface StudentResponse {
    username: string;
    database_status: string;
    folder_status: string;
    folder_message: string;
    user_id?: number;
    uuid?: string;
    message?: string;
    warning?: string;
    home_replica?: string;
    is_home?: boolean;
    replica?: string;
}

export interface LabError {
    error: string;
    code: string;
    details?: string;
}

class LabService {
    /**
     * Where each student's files are, learned from `check-and-create-user`.
     *
     * Per session and per username, not persisted: a replica can be retired between
     * visits, and a stale value here would send every command on a pointless hop
     * (the lab would forward it, or adopt the student, and either way it still works
     * — but a fresh lookup costs one request and is always right).
     */
    private homeReplicas = new Map<string, string>();

    /** Upgrade to https. The registry stores some replica URLs as http://. */
    private ensureHttps(url: string): string {
        if (!url) return url;
        if (url.startsWith('http://')) return url.replace(/^http:/, 'https:');
        return url;
    }

    /**
     * A replica to talk to for this student.
     *
     * Their home replica if we know it, so the call is not forwarded; otherwise any
     * replica, which will forward on our behalf.
     */
    private async replicaFor(username: string): Promise<string | null> {
        const home = username ? this.homeReplicas.get(username) : undefined;
        if (home) return home;
        const replica = await serviceRegistry.getRandomLabReplica();
        return replica ? this.ensureHttps(replica) : null;
    }

    private remember(username: string, response: StudentResponse): void {
        const home = response.home_replica || response.replica;
        if (username && home) {
            this.homeReplicas.set(username, this.ensureHttps(home));
        }
    }

    /**
     * Get or create the student record, and find out where their workspace is.
     *
     * The one call to make before anything else: it creates the record if it is
     * missing, creates the workspace, and pins the student to a replica. Tries every
     * replica in turn rather than only one — a Labs page that does nothing because a
     * single replica happened to be cold is not a good trade for one extra request.
     */
    async getOrCreateStudent(username: string): Promise<Student | null> {
        if (!username) return null;

        const replicas = await serviceRegistry.getLabReplicas();
        if (replicas.length === 0) {
            console.warn('No Self Study User Lab replica could be resolved from the registry');
            return null;
        }

        let lastError: any = null;
        for (const candidate of replicas) {
            const replica = this.ensureHttps(candidate);
            try {
                const response = await apiService.post<StudentResponse>(
                    replica,
                    '/api/check-and-create-user/',
                    { username }
                );
                this.remember(username, response);
                return {
                    id: response.user_id || 0,
                    username: response.username || username,
                    uuid_credentials: response.uuid || '',
                    created_at: '',
                    expire_date: '',
                    home_replica: response.home_replica || '',
                };
            } catch (error: any) {
                lastError = error;
                // A 4xx is the service answering, not a dead replica — the next one
                // would say the same thing, so stop rather than retrying three times.
                if (error?.status && error.status >= 400 && error.status < 500) break;
            }
        }

        console.warn('Failed to check/create student (non-critical):',
                     lastError?.message || lastError);
        return null;
    }

    /** The replica holding this student's files, if we have been told. */
    homeReplicaFor(username: string): string {
        return this.homeReplicas.get(username) || '';
    }

    /**
     * Run one SQL statement against the student's own copy of the demo database.
     *
     * Their own copy: it used to be one file shared by every student on the replica,
     * so a `DROP TABLE` took the table away from everybody. `resetDemoDatabase()`
     * puts theirs back.
     */
    async runSQL(username: string, query: string): Promise<SQLResult> {
        const replica = await this.replicaFor(username);
        if (!replica) return { result: [], error: 'The lab service is unreachable' };

        try {
            return await apiService.post<SQLResult>(
                replica, `/api/run-sql/${encodeURIComponent(username)}/`, { query });
        } catch (error: any) {
            return { result: [], error: this.explain(error, 'SQL execution failed') };
        }
    }

    async resetDemoDatabase(username: string): Promise<CommandResult> {
        const replica = await this.replicaFor(username);
        if (!replica) return { output: '', error: 'The lab service is unreachable' };

        try {
            return await apiService.post<CommandResult>(
                replica, `/api/reset-sql/${encodeURIComponent(username)}/`, {});
        } catch (error: any) {
            return { output: '', error: this.explain(error, 'Could not restore the database') };
        }
    }

    async runLinuxCommand(username: string, command: string): Promise<CommandResult> {
        const replica = await this.replicaFor(username);
        if (!replica) return { output: '', error: 'The lab service is unreachable' };

        try {
            return await apiService.post<CommandResult>(
                replica, `/api/run-command/${encodeURIComponent(username)}/`, { command });
        } catch (error: any) {
            return { output: '', error: this.explain(error, 'Command execution failed') };
        }
    }

    async killProcess(username: string): Promise<CommandResult> {
        const replica = await this.replicaFor(username);
        if (!replica) return { output: '', error: 'The lab service is unreachable' };

        try {
            return await apiService.post<CommandResult>(
                replica, `/api/kill-process/${encodeURIComponent(username)}/`, {});
        } catch (error: any) {
            return { output: '', error: error?.message || 'Failed to kill process' };
        }
    }

    async runPythonCode(username: string, code: string): Promise<PythonResult> {
        const replica = await this.replicaFor(username);
        if (!replica) return { output: '', error: 'The lab service is unreachable' };

        try {
            return await apiService.post<PythonResult>(
                replica, `/api/run-python/${encodeURIComponent(username)}/`, { code });
        } catch (error: any) {
            return { output: '', error: this.explain(error, 'Python execution failed') };
        }
    }

    /** Whether the lab is reachable at all. */
    async checkLabHealth(): Promise<boolean> {
        const replica = await serviceRegistry.getRandomLabReplica();
        if (!replica) return false;
        try {
            const response = await fetch(`${this.ensureHttps(replica)}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Turn an ApiError into something a student can act on.
     *
     * The lab answers with a `code`, so the message can name the actual problem
     * rather than the status number.
     */
    private explain(error: any, fallback: string): string {
        const code = error?.data?.code;
        if (code === 'PERMISSION_DENIED') {
            return 'Permission denied: that reaches outside your workspace';
        }
        if (code === 'USER_NOT_FOUND') {
            return 'Your lab account has not been set up yet. Reload the page.';
        }
        if (code === 'FOLDER_ERROR') {
            return 'The lab could not open your workspace. Try again in a moment.';
        }
        if (code === 'FORWARD_ERROR') {
            return 'The replica holding your files could not be reached. Try again.';
        }
        if (error?.data?.error) return String(error.data.error);
        if (error?.status === 404) return 'Not found in the lab system';
        return error?.message || fallback;
    }
}

export const labService = new LabService();
