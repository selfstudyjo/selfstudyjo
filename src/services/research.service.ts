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
    work_key?: string;
    title: string;
    authors: any[];
    author_names?: string[];
    abstract: string;
    venue: string;
    publisher?: string;
    publication_year: number | null;
    doi: string;
    url: string;
    landing_page_url?: string;
    pdf_url?: string;
    has_pdf?: boolean;
    open_access: boolean;
    oa_status?: string;
    license?: string;
    citation_count: number;
    keywords: string[];
    topics?: string[];
    type?: string;
    language?: string;
    biblio?: any;
    /** Where the paper came from: 'openalex' | 'google_scholar' | 'local'. */
    origin?: string;
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

/**
 * A work as normalised by the backend (utils/openalex.py -> normalize_work).
 * The raw OpenAlex shape is never sent to the client any more: abstracts are
 * already reconstructed, PDF candidates already resolved, and links already
 * point at something a human can open.
 */
export interface OpenAlexWork {
    id: string;
    openalex_id: string;
    work_key: string;
    title: string;
    abstract: string;
    authors: { name: string; id: string; orcid: string; is_corresponding: boolean; position: string }[];
    author_names: string[];
    institutions: { name: string; id: string; country_code: string; type: string }[];
    publication_year: number | null;
    publication_date: string;
    type: string;
    language: string;
    doi: string;
    doi_url: string;
    venue: string;
    publisher: string;
    is_oa: boolean;
    oa_status: string;
    license: string;
    version: string;
    citation_count: number;
    fwci: number | null;
    keywords: string[];
    topics: string[];
    primary_topic: string;
    landing_page_url: string;
    openalex_url: string;
    pdf_url: string;
    pdf_candidates: string[];
    has_pdf: boolean;
    referenced_works_count: number;
    is_retracted: boolean;
    relevance_score?: number;
    biblio?: any;
    source: string;
}

export interface OpenAlexSearchResponse {
    results: OpenAlexWork[];
    meta: {
        count: number;
        reachable_count: number;
        page: number;
        per_page: number;
        total_pages: number;
        max_page: number;
        truncated: boolean;
    };
    applied_filters: Record<string, any>;
    query: string;
    request_url: string;
}

/** Every field except `q` is optional - keywords are the only thing a student must fill in. */
export interface OpenAlexSearchParams {
    q: string;
    search_field?: 'title_abstract' | 'title' | 'fulltext';
    from_year?: string | number;
    to_year?: string | number;
    keywords?: string;
    topics?: string;
    concepts?: string;
    authors?: string;
    institutions?: string;
    countries?: string;
    language?: string;
    type?: string;
    license?: string;
    has_pdf?: boolean;
    is_oa?: boolean;
    has_doi?: boolean;
    min_citations?: string | number;
    sort?: string;
    page?: number;
    per_page?: number;
}

export interface AutocompleteHit {
    id: string;
    full_id: string;
    display_name: string;
    hint: string;
    works_count: number;
    cited_by_count: number;
    entity_type: string;
}

// ============ GOOGLE SCHOLAR ============

export interface ScholarResult {
    title: string;
    first_author?: string;
    authors?: any;
    author_names?: string[];
    year?: number;
    publication_year?: number | null;
    venue?: string;
    type?: string;
    relevance?: string;
    confidence?: 'high' | 'medium' | 'low';
    scholar_url: string;
    source: string;
    verified: boolean;
    match_score?: number;
    verification_note?: string;
    openalex_id?: string;
    work_key?: string;
    abstract?: string;
    doi?: string;
    doi_url?: string;
    landing_page_url?: string;
    pdf_url?: string;
    pdf_candidates?: string[];
    has_pdf?: boolean;
    is_oa?: boolean;
    citation_count?: number;
    keywords?: string[];
    topics?: string[];
    biblio?: any;
}

export interface ScholarSearchResponse {
    query: string;
    primary_query: string;
    alternative_queries: string[];
    search_strategy: string;
    search_notes: string;
    suggested_keywords: string[];
    scholar_query_url: string;
    primary_scholar_url?: string;
    alternative_scholar_urls?: { query: string; url: string }[];
    results: ScholarResult[];
    meta?: { count: number; verified_count: number; unverified_count: number };
    ai_available: boolean;
    error?: string;
}

export interface ScholarSearchParams {
    q: string;
    hl?: string;
    from_year?: string | number;
    to_year?: string | number;
    authors?: string;
    university?: string;
    language?: string;
    publication_type?: string;
    exclude?: string;
    limit?: number;
    reviews_only?: boolean;
    verify?: boolean;
}

// ============ AI RESEARCH WRITER ============

export type ResearchTypeKey = 'bachelor' | 'master' | 'phd';

export interface ResearchTypeInfo {
    key: ResearchTypeKey;
    label: string;
    level: string;
    goal: string;
    page_range: string;
    abstract_words: string;
    originality: string;
    literature_review: string;
    methodology: string;
    theory: string;
    discussion: string;
    reference_target: number;
    section_count: number;
    estimated_words: number;
    sections: { key: string; number: string; title: string; kind: string; word_target: number }[];
}

export interface ResearchSection {
    key: string;
    number: string;
    title: string;
    kind: 'front' | 'chapter';
    word_target: number;
    content: string;
    word_count: number;
    status: 'pending' | 'generated' | 'edited';
    generated_at: string | null;
}

export interface ResearchPlan {
    title?: string;
    alternative_titles?: string[];
    problem_statement?: string;
    research_gap?: string;
    thesis_statement?: string;
    research_questions?: string[];
    hypotheses?: string[];
    aims?: string[];
    objectives?: string[];
    significance?: string;
    scope_and_delimitations?: string;
    theoretical_framework?: string;
    methodology_summary?: Record<string, string>;
    keywords?: string[];
    chapter_outline?: { number: string; title: string; summary: string }[];
    recommended_search_terms?: string[];
    risks?: { risk: string; mitigation: string }[];
    next_steps?: string[];
}

export interface AiResearchProgress {
    generated: number;
    total: number;
    percent: number;
    words: number;
    estimated_pages: number;
}

export interface AiResearch {
    id: string;
    user_id: string;
    title: string;
    topic: string;
    research_type: ResearchTypeKey;
    field: string;
    language: string;
    university: string;
    department: string;
    degree_program: string;
    supervisor: string;
    author_name: string;
    submission_year: number;
    keywords: string[];
    notes: string;
    citation_style: string;
    plan: ResearchPlan;
    plan_error?: string;
    sections: ResearchSection[];
    sources: any[];
    references: string[];
    /** Ordered source records the bibliography was built from; drives italics and DOI links on export. */
    reference_sources?: any[];
    appendices: { title: string; content: string }[];
    status: 'draft' | 'in_progress' | 'completed';
    progress: AiResearchProgress;
    created_at: string;
    updated_at: string;
}

export interface AiResearchSummary {
    id: string;
    title: string;
    topic: string;
    research_type: ResearchTypeKey;
    research_type_label: string;
    field: string;
    language: string;
    university: string;
    author_name: string;
    keywords: string[];
    status: 'draft' | 'in_progress' | 'completed';
    progress: AiResearchProgress;
    source_count: number;
    reference_count: number;
    citation_style?: string;
    created_at: string;
    updated_at: string;
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
        const url = serviceRegistry.getRandomReplica(replicas, appId);
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

    /**
     * Search OpenAlex. Filtering and paging happen server-side, so `meta.count`
     * and the page controls describe the real result set rather than one
     * pre-fetched slice.
     */
    async searchOpenAlex(userId: string, params: OpenAlexSearchParams): Promise<OpenAlexSearchResponse> {
        const baseUrl = await this.getBaseUrl();
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '' || value === false) return;
            qs.set(key, String(value));
        });
        return await apiService.get<OpenAlexSearchResponse>(
            baseUrl,
            `/api/openalex/search/?${qs.toString()}`,
            this.buildHeaders(userId)
        );
    }

    /** Resolve typed text to OpenAlex ids for the author/institution/keyword pickers. */
    async openAlexAutocomplete(userId: string, entity: string, q: string, limit = 8): Promise<AutocompleteHit[]> {
        if (!q.trim()) return [];
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<{ results: AutocompleteHit[] }>(
                baseUrl,
                `/api/openalex/autocomplete/?entity=${encodeURIComponent(entity)}&q=${encodeURIComponent(q)}&limit=${limit}`,
                this.buildHeaders(userId)
            );
            return response.results || [];
        } catch (error) {
            console.error(`Autocomplete failed for ${entity}:`, error);
            return [];
        }
    }

    /**
     * Download a paper's PDF through the backend proxy.
     *
     * Fetching the publisher URL from the browser cannot work: those hosts send
     * no CORS headers and several block cross-origin requests outright. The
     * backend resolves the candidate list and streams whichever copy responds.
     */
    async downloadOpenAlexPdf(userId: string, workKey: string, filename?: string): Promise<void> {
        const baseUrl = await this.getBaseUrl();
        await this.downloadBlob(
            `${baseUrl}/api/openalex/pdf/${encodeURIComponent(workKey)}/`,
            userId,
            filename || `${workKey}.pdf`
        );
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

    // ============ GOOGLE SCHOLAR ============

    /**
     * AI-assisted Google Scholar search.
     *
     * Scholar has no API, so the backend proposes literature with an AI model
     * and cross-checks every suggestion against OpenAlex. Always surfaces
     * `scholar_query_url` so the student can run the real search themselves.
     */
    async searchScholar(userId: string, params: ScholarSearchParams): Promise<ScholarSearchResponse> {
        const baseUrl = await this.getBaseUrl();
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '' || value === false) return;
            qs.set(key, String(value));
        });
        return await apiService.get<ScholarSearchResponse>(
            baseUrl,
            `/api/scholar/search/?${qs.toString()}`,
            this.buildHeaders(userId)
        );
    }

    async getScholarHistory(userId: string): Promise<any[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<{ results: any[] }>(
                baseUrl, '/api/scholar/history/', this.buildHeaders(userId));
            return response.results || [];
        } catch (error) {
            console.error('Failed to load Scholar history:', error);
            return [];
        }
    }

    // ============ AI RESEARCH WRITER ============

    async getResearchTypes(userId: string): Promise<ResearchTypeInfo[]> {
        const baseUrl = await this.getBaseUrl();
        const response = await apiService.get<{ results: ResearchTypeInfo[] }>(
            baseUrl, '/api/research-types/', this.buildHeaders(userId));
        return response.results || [];
    }

    async getAiResearches(userId: string): Promise<AiResearchSummary[]> {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await apiService.get<{ results: AiResearchSummary[] }>(
                baseUrl, '/api/ai-research/', this.buildHeaders(userId));
            return response.results || [];
        } catch (error) {
            console.error('Failed to load AI researches:', error);
            return [];
        }
    }

    async getAiResearch(userId: string, researchId: string): Promise<{ research: AiResearch; structure: any; ai: any }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.get(
            baseUrl, `/api/ai-research/${researchId}/`, this.buildHeaders(userId));
    }

    /** Creating a project also runs the planning prompt, so this call is slow by design. */
    async createAiResearch(userId: string, payload: Record<string, any>): Promise<AiResearch> {
        const baseUrl = await this.getBaseUrl();
        const response = await apiService.post<{ research: AiResearch }>(
            baseUrl, '/api/ai-research/', payload, this.buildHeaders(userId));
        return response.research;
    }

    async updateAiResearch(userId: string, researchId: string, payload: Record<string, any>): Promise<AiResearch> {
        const baseUrl = await this.getBaseUrl();
        const response = await apiService.request<{ research: AiResearch }>(
            'PATCH', baseUrl, `/api/ai-research/${researchId}/`, payload, this.buildHeaders(userId));
        return response.research;
    }

    async deleteAiResearch(userId: string, researchId: string): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.request<any>(
            'DELETE', baseUrl, `/api/ai-research/${researchId}/`, undefined, this.buildHeaders(userId));
    }

    async regenerateAiPlan(userId: string, researchId: string): Promise<AiResearch> {
        const baseUrl = await this.getBaseUrl();
        const response = await apiService.post<{ research: AiResearch }>(
            baseUrl, `/api/ai-research/${researchId}/plan/`, {}, this.buildHeaders(userId));
        return response.research;
    }

    async setAiResearchSources(userId: string, researchId: string, payload: Record<string, any>): Promise<{ sources: any[]; count: number }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post(
            baseUrl, `/api/ai-research/${researchId}/sources/`, payload, this.buildHeaders(userId));
    }

    /**
     * Draft one section.
     *
     * One request per section is deliberate: a full dissertation exceeds both
     * the model output limit and the backend request timeout, so the client
     * loops and reports progress instead.
     */
    async generateAiSection(userId: string, researchId: string, sectionKey: string, force = false):
        Promise<{ section: ResearchSection; progress: AiResearchProgress; status: string }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post(
            baseUrl,
            `/api/ai-research/${researchId}/generate/`,
            { section_key: sectionKey, force },
            this.buildHeaders(userId)
        );
    }

    /**
     * Format the attached sources into a reference list.
     *
     * APA 7 is produced deterministically on the backend from the stored
     * metadata; other styles go through the AI with APA kept as a fallback.
     */
    async generateAiReferences(userId: string, researchId: string, style?: string):
        Promise<{ references: string[]; style: string; count: number }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post(
            baseUrl, `/api/ai-research/${researchId}/references/`, { style }, this.buildHeaders(userId));
    }

    async exportAiResearch(userId: string, researchId: string, format: 'docx' | 'pdf', title: string): Promise<void> {
        const baseUrl = await this.getBaseUrl();
        const safe = (title || 'research').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 70) || 'research';
        await this.downloadBlob(
            `${baseUrl}/api/ai-research/${researchId}/export/${format}/`,
            userId,
            `${safe}.${format}`
        );
    }

    // ============ BINARY DOWNLOADS ============

    /**
     * Fetch an authenticated endpoint as a blob and save it.
     *
     * The export and PDF endpoints require `Authorization: Token`, so a plain
     * anchor or window.open would come back 401 - the response has to be
     * fetched with headers and handed to the browser as an object URL.
     */
    private async downloadBlob(url: string, userId: string, filename: string): Promise<void> {
        const token = import.meta.env.VITE_AUTH_TOKEN;
        if (!token) throw new Error('Authentication token is missing. Check your .env file.');

        const response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Token ${token}`, 'X-User-ID': userId, Accept: '*/*' },
            mode: 'cors',
            credentials: 'omit',
        });

        if (!response.ok) {
            // The backend explains download failures in JSON (blocked publisher,
            // missing dependency, nothing generated yet) - surface that text.
            let message = `Download failed (${response.status})`;
            try {
                const body = await response.json();
                if (body?.error) message = body.error;
            } catch {
                /* non-JSON error body; keep the status message */
            }
            throw new Error(message);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Revoke on the next tick so Safari has time to start the download.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
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
            publication_year: project.publication_year,
            doi: project.doi || '',
            url: '',
            open_access: project.open_access,
            citation_count: project.citation_count,
            keywords: project.keywords || [],
            source: 'local',
            // Without these the paper lands in the OpenAlex tab instead of the
            // Local Projects tab, which is where the library expects it.
            is_local_project: true,
            local_project_id: project.id,
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