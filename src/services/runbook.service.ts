import { apiService, ApiError } from './api';
import { serviceRegistry } from './config';

export interface Runbook {
    id: number;
    sync_id: string;
    title: string;
    sections?: RunBookSection[];
}

export interface RunBookSection {
    id: number;
    sync_id: string;
    runbook: number;
    title: string | null;
    is_code_block: boolean;
    content: string;
    bg_color: string;
    text_color: string;
    position: number;
}

export interface RunbookListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Runbook[];
}

export class RunbookService {
    private appId = parseInt(import.meta.env.VITE_RUNBOOK_APP_ID || '17');

    async getRandomReplica(): Promise<string> {
        try {
            const replicas = await serviceRegistry.getServiceReplicas(this.appId, 'runbook');
            if (!replicas || replicas.length === 0) {
                throw new Error('No runbook replicas available');
            }
            const randomIndex = Math.floor(Math.random() * replicas.length);
            console.log('Selected runbook replica:', replicas[randomIndex]);
            return replicas[randomIndex];
        } catch (error) {
            console.error('Error getting runbook replica:', error);
            throw error;
        }
    }

    async getAllRunbooks(): Promise<Runbook[]> {
        try {
            const baseUrl = await this.getRandomReplica();
            console.log('Fetching all runbooks from:', baseUrl);
            const response = await apiService.get<any>(baseUrl, '/runbooks/');

            // Handle different response formats
            if (Array.isArray(response)) {
                console.log('Found', response.length, 'runbooks');
                return response;
            } else if (response && response.results && Array.isArray(response.results)) {
                console.log('Found', response.results.length, 'runbooks in results');
                return response.results;
            } else if (response && Array.isArray(response)) {
                console.log('Found', response.length, 'runbooks in array');
                return response;
            } else {
                console.warn('Unexpected response format:', response);
                return [];
            }
        } catch (error) {
            console.error('Error fetching runbooks:', error);
            throw error;
        }
    }

    async getRunbookById(id: number): Promise<Runbook> {
        try {
            const baseUrl = await this.getRandomReplica();
            console.log(`Fetching runbook ${id} from:`, baseUrl);
            const response = await apiService.get<Runbook>(baseUrl, `/runbooks/${id}/`);
            console.log(`Runbook ${id} fetched successfully:`, response.title);
            return response;
        } catch (error) {
            console.error(`Error fetching runbook ${id}:`, error);
            throw error;
        }
    }

    async getRunbookByTitle(title: string): Promise<Runbook> {
        try {
            const baseUrl = await this.getRandomReplica();
            const response = await apiService.get<Runbook>(baseUrl, `/runbooks/by_title/?title=${encodeURIComponent(title)}`);
            return response;
        } catch (error) {
            console.error(`Error fetching runbook by title "${title}":`, error);
            throw error;
        }
    }

    async searchRunbooks(query: string): Promise<Runbook[]> {
        try {
            const baseUrl = await this.getRandomReplica();
            const response = await apiService.get<any>(baseUrl, `/runbooks/?title=${encodeURIComponent(query)}`);

            // Handle different response formats
            if (Array.isArray(response)) {
                return response;
            } else if (response && response.results && Array.isArray(response.results)) {
                return response.results;
            } else {
                return [];
            }
        } catch (error) {
            console.error(`Error searching runbooks for "${query}":`, error);
            throw error;
        }
    }

    async getRunbookWithSections(id: number): Promise<Runbook> {
        try {
            const baseUrl = await this.getRandomReplica();

            // Fetch runbook details
            const runbook = await this.getRunbookById(id);

            // Fetch sections for this runbook
            try {
                const sections = await apiService.get<any>(
                    baseUrl,
                    `/sections/?runbook_id=${id}`
                );

                // Handle different response formats for sections
                let sectionsArray: RunBookSection[] = [];
                if (Array.isArray(sections)) {
                    sectionsArray = sections;
                } else if (sections && sections.results && Array.isArray(sections.results)) {
                    sectionsArray = sections.results;
                }

                return {
                    ...runbook,
                    sections: sectionsArray.sort((a, b) => a.position - b.position)
                };
            } catch (sectionError) {
                console.warn(`Could not fetch sections for runbook ${id}:`, sectionError);
                return {
                    ...runbook,
                    sections: []
                };
            }
        } catch (error) {
            console.error(`Error fetching runbook ${id} with sections:`, error);
            throw error;
        }
    }
}

export const runbookService = new RunbookService();
