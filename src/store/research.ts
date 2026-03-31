import { defineStore } from 'pinia';
import { ref } from 'vue';
import { researchService } from '@/services/research.service';
import type {
    ResearcherProfile,
    ResearchProject,
    ResearchFile,
    ProjectComment,
    CollaborationRequest,
    TeamMember,
    ImportedPaper,
    DashboardData,
} from '@/services/research.service';

export const useResearchStore = defineStore('research', () => {
    const researcherProfile = ref<ResearcherProfile | null>(null);
    const profileLoading = ref(false);
    const profileChecked = ref(false);

    const myProjects = ref<ResearchProject[]>([]);
    const currentProject = ref<ResearchProject | null>(null);
    const currentProjectFiles = ref<ResearchFile[]>([]);
    const currentProjectComments = ref<ProjectComment[]>([]);
    const currentProjectTeam = ref<TeamMember[]>([]);

    const collaborationRequests = ref<CollaborationRequest[]>([]);
    const importedPapers = ref<ImportedPaper[]>([]);
    const savedLocalProjects = ref<ImportedPaper[]>([]);

    const researchers = ref<ResearcherProfile[]>([]);
    const followingIds = ref<string[]>([]);

    const dashboard = ref<DashboardData | null>(null);

    const loading = ref(false);
    const error = ref<string | null>(null);

    // ============ RESEARCHER PROFILE ============

    const checkResearcherProfile = async (userId: string): Promise<ResearcherProfile | null> => {
        profileLoading.value = true;
        try {
            const profile = await researchService.getResearcherProfile(userId);
            researcherProfile.value = profile;
            profileChecked.value = true;
            return profile;
        } catch (err) {
            console.warn('Failed to check researcher profile:', err);
            profileChecked.value = true;
            researcherProfile.value = null;
            return null;
        } finally {
            profileLoading.value = false;
        }
    };

    const createResearcherProfile = async (userId: string, profileData: Partial<ResearcherProfile>): Promise<ResearcherProfile> => {
        profileLoading.value = true;
        error.value = null;
        try {
            const profile = await researchService.createResearcherProfile(userId, profileData);
            researcherProfile.value = profile;
            profileChecked.value = true;
            return profile;
        } catch (err: any) {
            // If profile already exists (409), fetch and return it
            if (err?.status === 409 && err?.data?.profile) {
                researcherProfile.value = err.data.profile;
                profileChecked.value = true;
                return err.data.profile;
            }
            error.value = err.message || 'Failed to create researcher profile';
            throw err;
        } finally {
            profileLoading.value = false;
        }
    };

    const updateResearcherProfile = async (profileId: string, userId: string, profileData: Partial<ResearcherProfile>): Promise<ResearcherProfile> => {
        profileLoading.value = true;
        error.value = null;
        try {
            const profile = await researchService.updateResearcherProfile(profileId, userId, profileData);
            researcherProfile.value = { ...researcherProfile.value, ...profile } as ResearcherProfile;
            return profile;
        } catch (err: any) {
            error.value = err.message || 'Failed to update researcher profile';
            throw err;
        } finally {
            profileLoading.value = false;
        }
    };

    // ============ PROJECTS ============

    const loadMyProjects = async (userId: string) => {
        loading.value = true;
        try {
            const projects = await researchService.getProjects(userId);
            myProjects.value = projects.filter(p => p.owner_id === userId);
        } catch (err: any) {
            error.value = err.message;
        } finally {
            loading.value = false;
        }
    };

    const loadProject = async (projectId: string, userId: string) => {
        loading.value = true;
        try {
            currentProject.value = await researchService.getProject(projectId, userId);
            if (currentProject.value) {
                await Promise.all([
                    loadProjectFiles(projectId, userId),
                    loadProjectComments(projectId, userId),
                    loadProjectTeam(projectId, userId),
                ]);
            }
        } catch (err: any) {
            error.value = err.message;
        } finally {
            loading.value = false;
        }
    };

    const createProject = async (userId: string, projectData: Partial<ResearchProject>): Promise<ResearchProject> => {
        loading.value = true;
        error.value = null;
        try {
            const project = await researchService.createProject(userId, projectData);
            myProjects.value.unshift(project);
            return project;
        } catch (err: any) {
            error.value = err.message || 'Failed to create project';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const updateProject = async (projectId: string, userId: string, projectData: Partial<ResearchProject>): Promise<ResearchProject> => {
        loading.value = true;
        error.value = null;
        try {
            const updated = await researchService.updateProject(projectId, userId, projectData);
            const idx = myProjects.value.findIndex(p => p.id === projectId);
            if (idx !== -1) myProjects.value[idx] = updated;
            if (currentProject.value?.id === projectId) currentProject.value = updated;
            return updated;
        } catch (err: any) {
            error.value = err.message || 'Failed to update project';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const deleteProject = async (projectId: string, userId: string) => {
        loading.value = true;
        try {
            await researchService.deleteProject(projectId, userId);
            myProjects.value = myProjects.value.filter(p => p.id !== projectId);
            if (currentProject.value?.id === projectId) currentProject.value = null;
        } catch (err: any) {
            error.value = err.message;
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // ============ FILES ============

    const loadProjectFiles = async (projectId: string, userId: string) => {
        try {
            currentProjectFiles.value = await researchService.getProjectFiles(projectId, userId);
        } catch (err: any) {
            console.error('Failed to load project files:', err);
        }
    };

    const uploadFile = async (projectId: string, userId: string, file: File, description: string, version: string) => {
        try {
            const newFile = await researchService.uploadFile(projectId, userId, file, description, version);
            currentProjectFiles.value.push(newFile);
            return newFile;
        } catch (err: any) {
            error.value = err.message || 'Failed to upload file';
            throw err;
        }
    };

    const deleteFile = async (fileId: string, userId: string) => {
        try {
            await researchService.deleteFile(fileId, userId);
            currentProjectFiles.value = currentProjectFiles.value.filter(f => f.id !== fileId);
        } catch (err: any) {
            error.value = err.message;
            throw err;
        }
    };

    // ============ COMMENTS ============

    const loadProjectComments = async (projectId: string, userId: string) => {
        try {
            currentProjectComments.value = await researchService.getComments(projectId, userId);
        } catch (err: any) {
            console.error('Failed to load comments:', err);
        }
    };

    const addComment = async (projectId: string, userId: string, content: string) => {
        try {
            const comment = await researchService.addComment(projectId, userId, content);
            currentProjectComments.value.push(comment);
            return comment;
        } catch (err: any) {
            error.value = err.message;
            throw err;
        }
    };

    const updateComment = async (commentId: string, userId: string, content: string) => {
        try {
            const updated = await researchService.updateComment(commentId, userId, content);
            const idx = currentProjectComments.value.findIndex(c => c.id === commentId);
            if (idx !== -1) currentProjectComments.value[idx] = updated;
            return updated;
        } catch (err: any) {
            error.value = err.message;
            throw err;
        }
    };

    const deleteComment = async (commentId: string, userId: string) => {
        try {
            await researchService.deleteComment(commentId, userId);
            currentProjectComments.value = currentProjectComments.value.filter(c => c.id !== commentId);
        } catch (err: any) {
            error.value = err.message;
            throw err;
        }
    };

    // ============ TEAM ============

    const loadProjectTeam = async (projectId: string, userId: string) => {
        try {
            currentProjectTeam.value = await researchService.getTeam(projectId, userId);
        } catch (err: any) {
            console.error('Failed to load team:', err);
        }
    };

    // ============ COLLABORATION ============

    const loadCollaborationRequests = async (userId: string, status?: string) => {
        loading.value = true;
        try {
            collaborationRequests.value = await researchService.getCollaborationRequests(userId, status);
        } catch (err: any) {
            error.value = err.message;
        } finally {
            loading.value = false;
        }
    };

    const sendCollaborationRequest = async (userId: string, projectId: string, message: string) => {
        try {
            const request = await researchService.sendCollaborationRequest(userId, projectId, message);
            collaborationRequests.value.push(request);
            return request;
        } catch (err: any) {
            error.value = err.message;
            throw err;
        }
    };

    const respondToCollaboration = async (requestId: string, userId: string, action: 'approve' | 'reject') => {
        try {
            await researchService.respondToCollaborationRequest(requestId, userId, action);
            const idx = collaborationRequests.value.findIndex(r => r.id === requestId);
            if (idx !== -1) {
                collaborationRequests.value[idx].status = action === 'approve' ? 'approved' : 'rejected';
                collaborationRequests.value[idx].responded_at = new Date().toISOString();
            }
        } catch (err: any) {
            error.value = err.message;
            throw err;
        }
    };

    // ============ LIBRARY ============

    const loadImportedPapers = async (userId: string) => {
        loading.value = true;
        try {
            const papers = await researchService.getImportedPapers(userId);
            importedPapers.value = papers.filter(p => !p.is_local_project);
            savedLocalProjects.value = papers.filter(p => p.is_local_project);
        } catch (err: any) {
            error.value = err.message;
        } finally {
            loading.value = false;
        }
    };

    const deleteImportedPaper = async (paperId: string, userId: string) => {
        try {
            await researchService.deleteImportedPaper(paperId, userId);
            importedPapers.value = importedPapers.value.filter(p => p.id !== paperId);
            savedLocalProjects.value = savedLocalProjects.value.filter(p => p.id !== paperId);
        } catch (err: any) {
            error.value = err.message;
            throw err;
        }
    };

    // ============ RESEARCHERS ============

    const loadResearchers = async () => {
        loading.value = true;
        try {
            researchers.value = await researchService.getResearcherProfiles();
        } catch (err: any) {
            error.value = err.message;
        } finally {
            loading.value = false;
        }
    };

    const loadFollowing = async (userId: string) => {
        try {
            followingIds.value = await researchService.getFollowing(userId);
        } catch (err: any) {
            console.error('Failed to load following:', err);
        }
    };

    const toggleFollow = async (userId: string, researcherId: string) => {
        try {
            const result = await researchService.followResearcher(userId, researcherId);
            if (result.is_following) {
                if (!followingIds.value.includes(researcherId)) {
                    followingIds.value.push(researcherId);
                }
            } else {
                followingIds.value = followingIds.value.filter(id => id !== researcherId);
            }
            return result;
        } catch (err: any) {
            error.value = err.message;
            throw err;
        }
    };

    // ============ DASHBOARD ============

    const loadDashboard = async (userId: string) => {
        loading.value = true;
        try {
            dashboard.value = await researchService.getDashboard(userId);
        } catch (err: any) {
            error.value = err.message;
        } finally {
            loading.value = false;
        }
    };

    const clearError = () => {
        error.value = null;
    };

    const clearCurrentProject = () => {
        currentProject.value = null;
        currentProjectFiles.value = [];
        currentProjectComments.value = [];
        currentProjectTeam.value = [];
    };

    return {
        researcherProfile,
        profileLoading,
        profileChecked,
        myProjects,
        currentProject,
        currentProjectFiles,
        currentProjectComments,
        currentProjectTeam,
        collaborationRequests,
        importedPapers,
        savedLocalProjects,
        researchers,
        followingIds,
        dashboard,
        loading,
        error,

        checkResearcherProfile,
        createResearcherProfile,
        updateResearcherProfile,
        loadMyProjects,
        loadProject,
        createProject,
        updateProject,
        deleteProject,
        loadProjectFiles,
        uploadFile,
        deleteFile,
        loadProjectComments,
        addComment,
        updateComment,
        deleteComment,
        loadProjectTeam,
        loadCollaborationRequests,
        sendCollaborationRequest,
        respondToCollaboration,
        loadImportedPapers,
        deleteImportedPaper,
        loadResearchers,
        loadFollowing,
        toggleFollow,
        loadDashboard,
        clearError,
        clearCurrentProject,
    };
});