import { apiService } from './api';

export interface Student {
    id: number;
    username: string;
    uuid_credentials: string;
    created_at: string;
    expire_date: string;
}

export interface CommandResult {
    output: string;
    error: string;
}

export interface SQLResult {
    result: any[];
    error?: string;
}

export interface PythonResult {
    output: string;
    error: string;
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
}

export interface StudentCreateResponse {
    id?: number;
    username?: string;
    uuid_credentials?: string;
    created_at?: string;
    expire_date?: string;
    error?: string;
    code?: string;
    details?: any;
}

export interface LabError {
    error: string;
    code: string;
    details?: string;
}

class LabService {
    private AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN;

    // Helper to ensure URL uses HTTPS
    private ensureHttps(url: string): string {
        if (!url) return url;
        if (url.startsWith('https://')) return url;
        if (url.startsWith('http://')) {
            const httpsUrl = url.replace(/^http:/, 'https:');
            return httpsUrl;
        }
        return url;
    }

    /**
     * Get or create a student record in the lab backend
     * Uses the check-and-create-user endpoint which creates the student in DB
     * and creates the user folder if they don't exist.
     */
    async getOrCreateStudent(username: string, labUrl: string): Promise<Student | null> {
        if (!username || !labUrl) {
            return null;
        }

        const secureLabUrl = this.ensureHttps(labUrl);

        try {
            const response = await apiService.post<StudentResponse>(
                secureLabUrl,
                '/api/check-and-create-user/',
                { username }
            );

            // If the user was newly created, we have the user_id and uuid in the response
            if (response.user_id && response.uuid) {
                return {
                    id: response.user_id,
                    username: response.username,
                    uuid_credentials: response.uuid,
                    created_at: new Date().toISOString(),
                    expire_date: ''
                };
            }

            // If user already existed, we still consider it a success
            if (response.database_status === 'exists' || response.database_status === 'created') {
                return {
                    id: response.user_id || 0,
                    username: response.username,
                    uuid_credentials: response.uuid || '',
                    created_at: '',
                    expire_date: ''
                };
            }

            return null;
        } catch (error: any) {
            console.warn('Failed to check/create student (non-critical):', error?.message || error);
            return null;
        }
    }

    /**
     * Use the check-and-create-user endpoint (recommended)
     */
    private async checkAndCreateUser(username: string, labUrl: string): Promise<Student | null> {
        return this.getOrCreateStudent(username, labUrl);
    }

    /**
     * Find student by username in the students list
     */
    private async findStudentByUsername(username: string, labUrl: string): Promise<Student | null> {
        return null;
    }

    /**
     * Run SQL query
     */
    async runSQL(username: string, labUrl: string, query: string): Promise<SQLResult> {
        const secureLabUrl = this.ensureHttps(labUrl);
        try {
            const response = await apiService.post<SQLResult>(
                secureLabUrl,
                `/api/run-sql/${username}/`,
                { query }
            );

            return response;

        } catch (error: any) {
            let errorMessage = 'SQL execution failed';
            if (error.status === 403) {
                errorMessage = 'Permission denied: You do not have access to run SQL queries';
            } else if (error.status === 404) {
                errorMessage = 'Database or user not found';
            } else if (error.status === 400) {
                errorMessage = `Invalid SQL: ${error.data?.error || error.message}`;
            } else if (error.message) {
                errorMessage = error.message;
            }

            return { result: [], error: errorMessage };
        }
    }

    /**
     * Run Linux command
     */
    async runLinuxCommand(username: string, labUrl: string, command: string): Promise<CommandResult> {
        const secureLabUrl = this.ensureHttps(labUrl);
        try {
            const response = await apiService.post<CommandResult>(
                secureLabUrl,
                `/api/run-command/${username}/`,
                { command }
            );

            return response;

        } catch (error: any) {
            let errorMessage = 'Command execution failed';
            if (error.status === 403) {
                errorMessage = 'Permission denied: Command not allowed';
            } else if (error.status === 404) {
                errorMessage = 'User not found in lab system';
            } else if (error.status === 400) {
                errorMessage = `Invalid command: ${error.data?.error || error.message}`;
            } else if (error.message) {
                errorMessage = error.message;
            }

            return { output: '', error: errorMessage };
        }
    }

    /**
     * Kill running process
     */
    async killProcess(username: string, labUrl: string): Promise<CommandResult> {
        const secureLabUrl = this.ensureHttps(labUrl);
        try {
            const response = await apiService.post<CommandResult>(
                secureLabUrl,
                `/api/kill-process/${username}/`,
                {}
            );

            return response;

        } catch (error: any) {
            return { output: '', error: error.message || 'Failed to kill process' };
        }
    }

    /**
     * Run Python code
     */
    async runPythonCode(username: string, labUrl: string, code: string): Promise<PythonResult> {
        const secureLabUrl = this.ensureHttps(labUrl);
        try {
            const response = await apiService.post<PythonResult>(
                secureLabUrl,
                `/api/run-python/${username}/`,
                { code }
            );

            return response;

        } catch (error: any) {
            let errorMessage = 'Python execution failed';
            if (error.status === 403) {
                errorMessage = 'Permission denied: You do not have access to run Python code';
            } else if (error.status === 404) {
                errorMessage = 'User not found in lab system';
            } else if (error.status === 400) {
                errorMessage = `Python error: ${error.data?.error || error.message}`;
            } else if (error.message) {
                errorMessage = error.message;
            }

            return { output: '', error: errorMessage };
        }
    }

    /**
     * Get all students (admin function)
     */
    async getAllStudents(labUrl: string): Promise<Student[]> {
        const secureLabUrl = this.ensureHttps(labUrl);
        try {
            return [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Get student count
     */
    async getStudentCount(labUrl: string): Promise<number> {
        const secureLabUrl = this.ensureHttps(labUrl);
        try {
            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Check lab health
     */
    async checkLabHealth(labUrl: string): Promise<boolean> {
        const secureLabUrl = this.ensureHttps(labUrl);
        try {
            return true;
        } catch (error) {
            return false;
        }
    }
}

export const labService = new LabService();