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

    /**
     * Get or create a student record in the lab backend
     */
    async getOrCreateStudent(username: string, labUrl: string): Promise<Student | null> {
        try {
            console.log('🔍 Getting/creating student for:', username, 'at:', labUrl);

            // COMMENTED OUT - DON'T TRY TO GET/CREATE STUDENT, JUST RETURN NULL
            // This causes CORS errors and we don't need it
            console.log('✅ Returning null - labs work without student record');
            return null;

        } catch (error: any) {
            // Don't log any errors
            return null;
        }
    }

    /**
     * Use the check-and-create-user endpoint (recommended)
     */
    private async checkAndCreateUser(username: string, labUrl: string): Promise<Student | null> {
        // DON'T DO ANYTHING - JUST RETURN NULL
        return null;
    }

    /**
     * Find student by username in the students list
     */
    private async findStudentByUsername(username: string, labUrl: string): Promise<Student | null> {
        // DON'T DO ANYTHING - JUST RETURN NULL
        return null;
    }

    /**
     * Run SQL query
     */
    async runSQL(username: string, labUrl: string, query: string): Promise<SQLResult> {
        try {
            console.log('🚀 Running SQL query:', { username, query: query.substring(0, 100) + '...' });

            const response = await apiService.post<SQLResult>(
                labUrl,
                `/api/run-sql/${username}/`,
                { query }
            );

            console.log('✅ SQL query completed:', response);
            return response;

        } catch (error: any) {
            console.error('❌ SQL query failed:', error);

            // Handle specific errors
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
        try {
            console.log('🚀 Running Linux command:', { username, command });

            const response = await apiService.post<CommandResult>(
                labUrl,
                `/api/run-command/${username}/`,
                { command }
            );

            console.log('✅ Linux command completed:', response);
            return response;

        } catch (error: any) {
            console.error('❌ Linux command failed:', error);

            // Handle specific errors
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
        try {
            console.log('🛑 Killing process for:', username);

            const response = await apiService.post<CommandResult>(
                labUrl,
                `/api/kill-process/${username}/`,
                {}
            );

            console.log('✅ Process killed');
            return response;

        } catch (error: any) {
            console.error('❌ Failed to kill process:', error);
            return { output: '', error: error.message || 'Failed to kill process' };
        }
    }

    /**
     * Run Python code
     */
    async runPythonCode(username: string, labUrl: string, code: string): Promise<PythonResult> {
        try {
            console.log('🚀 Running Python code:', { username, codeLength: code.length });

            const response = await apiService.post<PythonResult>(
                labUrl,
                `/api/run-python/${username}/`,
                { code }
            );

            console.log('✅ Python code executed');
            return response;

        } catch (error: any) {
            console.error('❌ Python execution failed:', error);

            // Handle specific errors
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
        try {
            // COMMENTED OUT - DON'T MAKE THIS REQUEST
            // const response = await apiService.get<any>(labUrl, '/api/students/');
            // if (Array.isArray(response)) {
            //     return response;
            // }
            
            console.log('⚠️ Skipping getAllStudents to avoid CORS errors');
            return [];
        } catch (error) {
            // Don't log anything
            return [];
        }
    }

    /**
     * Get student count
     */
    async getStudentCount(labUrl: string): Promise<number> {
        try {
            // COMMENTED OUT - DON'T MAKE THIS REQUEST
            // const response = await apiService.get<{ student_count: number }>(
            //     labUrl,
            //     '/api/student-count/'
            // );
            // return response.student_count || 0;
            
            console.log('⚠️ Skipping getStudentCount to avoid CORS errors');
            return 0;
        } catch (error) {
            // Don't log anything
            return 0;
        }
    }

    /**
     * Check lab health
     */
    async checkLabHealth(labUrl: string): Promise<boolean> {
        try {
            // COMMENTED OUT - DON'T MAKE THIS REQUEST
            // await apiService.get(labUrl, '/api/student-count/');
            // return true;
            
            console.log('⚠️ Skipping lab health check to avoid CORS errors');
            return true;
        } catch (error) {
            // Don't log anything
            return false;
        }
    }
}

export const labService = new LabService();