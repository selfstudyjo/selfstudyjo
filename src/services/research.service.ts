import { apiService } from './api';
import { serviceRegistry } from './config';

// ============ INTERFACES ============

export interface ResearcherProfile {
    id: string;
    user_id: string;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    university: string;
    institution: string;
    department: string;
    bio: string;
    research_interests: string[];
    orcid_id: string;
    google_scholar_id: string;
    website: string;
    created_at: string;
    updated_at: string;
}

export interface ResearchProject {
    id: string;
    title: string;
    description: string;
    owner_id: string;
    access_level: 'public' | 'team' | 'private';
    status: 'draft' | 'published' | 'under_review';
    keywords: string[];
    created_at: string;
    updated_at: string;
    views: number;
    downloads: number;
    openalex_id?: string;
    doi?: string;
    venue?: string;
    publication_year?: number;
    citation_count: number;
    open_access: boolean;
}

export interface ResearchFile {
    id: string;
    project_id: string;
    original_filename: string;
    stored_filename: string;
    file_type: string;
    file_size: number;
    version: string;
    description: string;
    uploaded_by: string;
    uploaded_at: string;
    is_current: boolean;
    download_url?: string;
}

export interface ProjectComment {
    id: string;
    project_id: string;
    author_id: string;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface CollaborationRequest {
    id: string;
    project_id: string;
    requester_id: string;
    recipient_id: string;
    message: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    responded_at: string | null;
}

export interface TeamMember {
    id: string;
    project_id: string;
    user_id: string;
    role: 'owner' | 'collaborator' | 'viewer';
    joined_at: string;
    can_edit: boolean;
    can_manage: boolean;
}

export interface ImportedPaper {
    id: string;
    user_id: string;
    openalex_id: string;
    title: string;
    authors: any[];
    abstract: string;
    venue: string;
    publication_year: number | null;
    doi: string;
    url: string;
    open_access: boolean;
    citation_count: number;
    keywords: string[];
    is_local_project: boolean;
    local_project_id: string | null;
    imported_at: string;
}

export interface DashboardData {
    stats: {
        research_files: number;
        collaborations: number;
        total_views: number;
        downloads: number;
    };
    recent_files: ResearchFile[];
    recent_projects: ResearchProject[];
    collaboration_requests: CollaborationRequest[];
    recent_activity: any[];
}

export interface OpenAlexWork {
    id: string;
    title: string;
    display_name?: string;
    authorships?: any[];
    publication_year?: number;
    doi?: string;
    primary_location?: any;
    open_access?: any;
    cited_by_count?: number;
    keywords?: any[];
    abstract_inverted_index?: any;
    concepts?: any[];
    biblio?: any;
    type?: string;
    relevance_score?: number;
}

export interface OpenAlexSearchResponse {
    meta?: {
        count: number;
        page: number;
        per_page: number;
    };
    results?: OpenAlexWork[];
}

export interface SearchResult {
    results: ResearchProject[];
    pagination: {
        count: number;
        next: boolean;
        previous: boolean;
        current_page: number;
        total_pages: number;
    };
}

// ============ SERVICE CLASS ============

class ResearchService {
    private async getBaseUrl(): Promise<string> {
        const appId = parseInt(import.meta.env.VITE_RESEARCH_FLOW_APP_ID || '28');
        const replicas = await serviceRegistry.getServiceReplicas(appId, 'researchflow');
        const url = serviceRegistry.getRandomReplica(replicas);
        if (!url) {
            throw new Error('Research Flow service is currently unavailable.');
        }
        return url;
    }

    private buildHeaders(userId: string): Record<string, string> {
        return {
            'X-User-ID': userId,
        };
    }

    // ============ RESEARCHER PROFILES ============

    async getResearcherProfiles(): Promise<ResearcherProfile[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            // Use the dedicated researcher-profiles endpoint
            const response = await apiService.get<any>(baseUrl, '/api/researcher-profiles/');
            if (Array.isArray(response)) return response;
            if (response && response.results) return response.results;
            return [];
        } catch (error) {
            console.error('Failed to get researcher profiles:', error);
            return [];
        }
    }

    async getResearcherProfile(userId: string): Promise<ResearcherProfile | null> {
        const baseUrl = await this.getBaseUrl();
        try {
            // Use the by-user endpoint for direct lookup
            const profile = await apiService.get<ResearcherProfile>(
                baseUrl,
                `/api/researcher-profiles/by-user/${userId}/`,
                this.buildHeaders(userId)
            );
            return profile;
        } catch (error: any) {
            // 404 means no profile exists - that's expected
            if (error?.status === 404) {
                return null;
            }
            console.error('Failed to get researcher profile:', error);
            return null;
        }
    }

    async createResearcherProfile(userId: string, profileData: Partial<ResearcherProfile>): Promise<ResearcherProfile> {
        const baseUrl = await this.getBaseUrl();
        const payload = {
            user_id: profileData.user_id || userId,
            username: profileData.username || '',
            first_name: profileData.first_name || '',
            last_name: profileData.last_name || '',
            email: profileData.email || '',
            university: profileData.university || '',
            institution: profileData.institution || '',
            department: profileData.department || '',
            bio: profileData.bio || '',
            research_interests: profileData.research_interests || [],
            orcid_id: profileData.orcid_id || '',
            google_scholar_id: profileData.google_scholar_id || '',
            website: profileData.website || '',
        };
        return await apiService.post<ResearcherProfile>(
            baseUrl,
            '/api/researcher-profiles/',
            payload,
            this.buildHeaders(userId)
        );
    }

    async updateResearcherProfile(profileId: string, userId: string, profileData: Partial<ResearcherProfile>): Promise<ResearcherProfile> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.put<ResearcherProfile>(
            baseUrl,
            `/api/researcher-profiles/${profileId}/`,
            profileData,
            this.buildHeaders(userId)
        );
    }

    // ============ PROJECTS ============

    async getProjects(userId: string): Promise<ResearchProject[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<any>(
                baseUrl,
                '/api/projects/',
                this.buildHeaders(userId)
            );
            if (Array.isArray(response)) return response;
            if (response && response.results) return response.results;
            return [];
        } catch (error) {
            console.error('Failed to get projects:', error);
            return [];
        }
    }

    async getProject(projectId: string, userId: string): Promise<ResearchProject | null> {
        const baseUrl = await this.getBaseUrl();
        try {
            return await apiService.get<ResearchProject>(
                baseUrl,
                `/api/projects/${projectId}`,
                this.buildHeaders(userId)
            );
        } catch (error) {
            console.error('Failed to get project:', error);
            return null;
        }
    }

    async createProject(userId: string, projectData: Partial<ResearchProject>): Promise<ResearchProject> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post<ResearchProject>(
            baseUrl,
            '/api/projects/',
            projectData,
            this.buildHeaders(userId)
        );
    }

    async updateProject(projectId: string, userId: string, projectData: Partial<ResearchProject>): Promise<ResearchProject> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.put<ResearchProject>(
            baseUrl,
            `/api/projects/${projectId}`,
            projectData,
            this.buildHeaders(userId)
        );
    }

    async deleteProject(projectId: string, userId: string): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.request<any>(
            'DELETE',
            baseUrl,
            `/api/projects/${projectId}`,
            undefined,
            this.buildHeaders(userId)
        );
    }

    // ============ FILES ============

    async getProjectFiles(projectId: string, userId: string): Promise<ResearchFile[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<any>(
                baseUrl,
                `/api/projects/${projectId}/files/`,
                this.buildHeaders(userId)
            );
            if (Array.isArray(response)) return response;
            return [];
        } catch (error) {
            console.error('Failed to get project files:', error);
            return [];
        }
    }

    async uploadFile(projectId: string, userId: string, file: File, description: string = '', version: string = 'v1.0'): Promise<ResearchFile> {
        const baseUrl = await this.getBaseUrl();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', description);
        formData.append('version', version);

        return await apiService.post<ResearchFile>(
            baseUrl,
            `/api/projects/${projectId}/files/`,
            formData,
            this.buildHeaders(userId)
        );
    }

    async deleteFile(fileId: string, userId: string): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.request<any>(
            'DELETE',
            baseUrl,
            `/api/files/${fileId}/`,
            undefined,
            this.buildHeaders(userId)
        );
    }

    async getFileDownloadInfo(fileId: string, userId: string): Promise<{ url: string; baseUrl: string }> {
        const baseUrl = await this.getBaseUrl();
        return {
            url: `${baseUrl}/api/files/${fileId}/download/`,
            baseUrl,
        };
    }

    // ============ COMMENTS ============

    async getComments(projectId: string, userId: string): Promise<ProjectComment[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<any>(
                baseUrl,
                `/api/projects/${projectId}/comments/`,
                this.buildHeaders(userId)
            );
            if (Array.isArray(response)) return response;
            return [];
        } catch (error) {
            console.error('Failed to get comments:', error);
            return [];
        }
    }

    async addComment(projectId: string, userId: string, content: string): Promise<ProjectComment> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post<ProjectComment>(
            baseUrl,
            `/api/projects/${projectId}/comments/`,
            { content },
            this.buildHeaders(userId)
        );
    }

    async updateComment(commentId: string, userId: string, content: string): Promise<ProjectComment> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.put<ProjectComment>(
            baseUrl,
            `/api/comments/${commentId}/`,
            { content },
            this.buildHeaders(userId)
        );
    }

    async deleteComment(commentId: string, userId: string): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.request<any>(
            'DELETE',
            baseUrl,
            `/api/comments/${commentId}/`,
            undefined,
            this.buildHeaders(userId)
        );
    }

    // ============ TEAMS ============

    async getTeam(projectId: string, userId: string): Promise<TeamMember[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<any>(
                baseUrl,
                `/api/projects/${projectId}/team/`,
                this.buildHeaders(userId)
            );
            if (Array.isArray(response)) return response;
            return [];
        } catch (error) {
            console.error('Failed to get team:', error);
            return [];
        }
    }

    async addTeamMember(projectId: string, userId: string, newUserId: string, role: string = 'collaborator'): Promise<TeamMember> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post<TeamMember>(
            baseUrl,
            `/api/projects/${projectId}/team/`,
            { user_id: newUserId, role },
            this.buildHeaders(userId)
        );
    }

    async removeTeamMember(projectId: string, userId: string, userToRemove: string): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.request<any>(
            'DELETE',
            baseUrl,
            `/api/projects/${projectId}/team/${userToRemove}`,
            undefined,
            this.buildHeaders(userId)
        );
    }

    // ============ COLLABORATION REQUESTS ============

    async getCollaborationRequests(userId: string, status?: string): Promise<CollaborationRequest[]> {
        const baseUrl = await this.getBaseUrl();
        let endpoint = '/api/collaboration-requests/';
        if (status) endpoint += `?status=${status}`;
        try {
            const response = await apiService.get<any>(
                baseUrl,
                endpoint,
                this.buildHeaders(userId)
            );
            if (Array.isArray(response)) return response;
            return [];
        } catch (error) {
            console.error('Failed to get collaboration requests:', error);
            return [];
        }
    }

    async sendCollaborationRequest(userId: string, projectId: string, message: string): Promise<CollaborationRequest> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post<CollaborationRequest>(
            baseUrl,
            '/api/collaboration-requests/',
            { project: projectId, message },
            this.buildHeaders(userId)
        );
    }

    async respondToCollaborationRequest(requestId: string, userId: string, action: 'approve' | 'reject'): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post<any>(
            baseUrl,
            `/api/collaboration-requests/${requestId}/respond/`,
            { action },
            this.buildHeaders(userId)
        );
    }

    // ============ SEARCH ============

    async searchProjects(userId: string, params: {
        q?: string;
        year?: string;
        access?: string;
        page?: number;
        page_size?: number;
    }): Promise<SearchResult> {
        const baseUrl = await this.getBaseUrl();
        const queryParams = new URLSearchParams();
        if (params.q) queryParams.set('q', params.q);
        if (params.year) queryParams.set('year', params.year);
        if (params.access && params.access !== 'all') queryParams.set('access', params.access);
        if (params.page) queryParams.set('page', params.page.toString());
        if (params.page_size) queryParams.set('page_size', params.page_size.toString());

        try {
            return await apiService.get<SearchResult>(
                baseUrl,
                `/api/search/?${queryParams.toString()}`,
                this.buildHeaders(userId)
            );
        } catch (error) {
            console.error('Failed to search projects:', error);
            return {
                results: [],
                pagination: { count: 0, next: false, previous: false, current_page: 1, total_pages: 0 }
            };
        }
    }

    // ============ DASHBOARD ============

    async getDashboard(userId: string): Promise<DashboardData> {
        const baseUrl = await this.getBaseUrl();
        try {
            return await apiService.get<DashboardData>(
                baseUrl,
                '/api/dashboard/',
                this.buildHeaders(userId)
            );
        } catch (error) {
            console.error('Failed to get dashboard:', error);
            return {
                stats: { research_files: 0, collaborations: 0, total_views: 0, downloads: 0 },
                recent_files: [],
                recent_projects: [],
                collaboration_requests: [],
                recent_activity: [],
            };
        }
    }

    // ============ OPENALEX ============

    async searchOpenAlex(userId: string, params: {
        q: string;
        page?: number;
        per_page?: number;
    }): Promise<OpenAlexSearchResponse> {
        const baseUrl = await this.getBaseUrl();
        const queryParams = new URLSearchParams();
        queryParams.set('q', params.q);
        if (params.page) queryParams.set('page', params.page.toString());
        if (params.per_page) queryParams.set('per_page', params.per_page.toString());

        try {
            return await apiService.get<OpenAlexSearchResponse>(
                baseUrl,
                `/api/openalex/search/?${queryParams.toString()}`,
                this.buildHeaders(userId)
            );
        } catch (error) {
            console.error('Failed to search OpenAlex:', error);
            return { results: [], meta: { count: 0, page: 1, per_page: 25 } };
        }
    }

    async saveToLibrary(userId: string, paperData: any): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post<any>(
            baseUrl,
            '/api/openalex/save-to-library/',
            paperData,
            this.buildHeaders(userId)
        );
    }

    // ============ IMPORTED PAPERS ============

    async getImportedPapers(userId: string): Promise<ImportedPaper[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<any>(
                baseUrl,
                '/api/imported-papers/',
                this.buildHeaders(userId)
            );
            if (response && response.results) return response.results;
            if (Array.isArray(response)) return response;
            return [];
        } catch (error) {
            console.error('Failed to get imported papers:', error);
            return [];
        }
    }

    async deleteImportedPaper(paperId: string, userId: string): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.request<any>(
            'DELETE',
            baseUrl,
            `/api/imported-papers/${paperId}`,
            undefined,
            this.buildHeaders(userId)
        );
    }

    // ============ NOTIFICATIONS ============

    async getNotifications(userId: string): Promise<any[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<any>(
                baseUrl,
                '/api/notifications/',
                this.buildHeaders(userId)
            );
            if (Array.isArray(response)) return response;
            return [];
        } catch (error) {
            console.error('Failed to get notifications:', error);
            return [];
        }
    }

    // ============ ACTIVITIES ============

    async getActivities(userId: string): Promise<any[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<any>(
                baseUrl,
                '/api/activities/',
                this.buildHeaders(userId)
            );
            if (Array.isArray(response)) return response;
            return [];
        } catch (error) {
            console.error('Failed to get activities:', error);
            return [];
        }
    }

    // ============ FOLLOWS ============

    async followResearcher(userId: string, researcherId: string): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post<any>(
            baseUrl,
            `/api/researchers/${researcherId}/follow/`,
            {},
            this.buildHeaders(userId)
        );
    }

    async getFollowing(userId: string): Promise<string[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<any>(
                baseUrl,
                '/api/following/',
                this.buildHeaders(userId)
            );
            if (response && response.results) return response.results;
            if (Array.isArray(response)) return response;
            return [];
        } catch (error) {
            console.error('Failed to get following:', error);
            return [];
        }
    }

    // ============ SAVE LOCAL PROJECT TO LIBRARY ============

    async saveLocalProjectToLibrary(userId: string, project: ResearchProject): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        const paperData = {
            id: `local:${project.id}`,
            title: project.title,
            authors: [],
            abstract: project.description,
            venue: project.venue || '',
            year: project.publication_year,
            doi: project.doi || '',
            url: '',
            open_access: project.open_access,
            citation_count: project.citation_count,
            keywords: project.keywords || [],
        };
        return await apiService.post<any>(
            baseUrl,
            '/api/openalex/save-to-library/',
            paperData,
            this.buildHeaders(userId)
        );
    }
}

export const researchService = new ResearchService();