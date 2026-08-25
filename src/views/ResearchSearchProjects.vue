<template>
  <div class="research-search-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research')"><RfIconBack /> {{ $t('Back') }}</button>
      <h1 class="rf-page-title"><RfIconSearch /> {{ $t('Search Projects') }}</h1>
    </div>

    <div class="rf-filters">
      <input
        v-model="searchQuery"
        type="text"
        class="rf-input"
        :placeholder="$t('Search by title, description, keywords, owner...')"
        @keyup.enter="handleSearch"
      />
      <input
        v-model="yearFilter"
        type="text"
        class="rf-input rf-input-sm"
        :placeholder="$t('Year')"
      />
      <select v-model="accessFilter" class="rf-select">
        <option value="all">{{ $t('All Access') }}</option>
        <option value="public">{{ $t('Public') }}</option>
        <option value="team">{{ $t('Team') }}</option>
      </select>
      <button class="rf-btn rf-btn-primary" @click="handleSearch"><RfIconSearch /> {{ $t('Search') }}</button>
    </div>

    <div v-if="loading" class="rf-loading">
      <div class="rf-spinner"></div>
      <p>{{ $t('Searching projects...') }}</p>
    </div>

    <div v-else-if="searchResults.length === 0 && hasSearched" class="rf-empty">
      <p>{{ $t('No projects found matching your criteria.') }}</p>
    </div>

    <div v-else class="rf-projects-grid">
      <div
        v-for="project in searchResults"
        :key="project.id"
        class="rf-project-card"
      >
        <div class="rf-project-card-header">
          <h3 class="rf-project-title">{{ project.title }}</h3>
          <span :class="['rf-access-badge', `rf-access-${project.access_level}`]">
            {{ project.access_level }}
          </span>
        </div>
        <p class="rf-project-desc">{{ truncate(project.description, 150) }}</p>
        <div class="rf-project-meta">
          <span v-if="project.publication_year"><RfIconCalendar /> {{ project.publication_year }}</span>
          <span><RfIconEye /> {{ $t('{v0} views', { v0: project.views }) }}</span>
          <span><RfIconDownload /> {{ $t('{v0} downloads', { v0: project.downloads }) }}</span>
          <span><RfIconProfile /> {{ getOwnerName(project.owner_id) }}</span>
        </div>
        <div class="rf-keywords" v-if="project.keywords && project.keywords.length">
          <span v-for="kw in project.keywords" :key="kw" class="rf-keyword-badge">{{ kw }}</span>
        </div>

        <div v-if="canAccessProject(project) && projectFiles[project.id]?.length" class="rf-file-downloads">
          <span class="rf-files-label"><RfIconFile /> {{ $t('Files:') }}</span>
          <button
            v-for="file in projectFiles[project.id]"
            :key="file.id"
            class="rf-btn rf-btn-xs rf-btn-outline"
            @click="downloadFile(file)"
          >
            <RfIconDownload /> {{ file.original_filename }}
          </button>
        </div>

        <div class="rf-project-card-actions">
          <button class="rf-btn rf-btn-sm rf-btn-primary" @click="$router.push(`/research/project/${project.id}`)">
            {{ $t('View Project') }}
          </button>
          <button
            v-if="canAccessProject(project)"
            class="rf-btn rf-btn-sm rf-btn-secondary"
            @click="saveToLibrary(project)"
            :disabled="isSaved(project.id)"
          >
            <RfIconSave /> {{ isSaved(project.id) ? 'Saved' : 'Save to Library' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="pagination.total_pages > 1" class="rf-pagination">
      <button class="rf-btn rf-btn-sm" :disabled="!pagination.previous" @click="goToPage(pagination.current_page - 1)">{{ $t('Previous') }}</button>
      <span class="rf-page-info">{{ $t('Page {v0} of {v1} ({v2} results)', { v0: pagination.current_page, v1: pagination.total_pages, v2: pagination.count }) }}</span>
      <button class="rf-btn rf-btn-sm" :disabled="!pagination.next" @click="goToPage(pagination.current_page + 1)">{{ $t('Next') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import { researchService } from '@/services/research.service';
import type { ResearchProject, ResearchFile, TeamMember } from '@/services/research.service';
import {
  RfIconBack, RfIconSearch, RfIconCalendar, RfIconEye,
  RfIconDownload, RfIconProfile, RfIconFile, RfIconSave
} from '@/utils/rf-icons';

const authStore = useAuthStore();
const researchStore = useResearchStore();

const loading = ref(false);
const hasSearched = ref(false);
const searchQuery = ref('');
const yearFilter = ref('');
const accessFilter = ref('all');

const searchResults = ref<ResearchProject[]>([]);
const pagination = ref({ count: 0, next: false, previous: false, current_page: 1, total_pages: 0 });
const ownerNames = ref<Record<string, string>>({});
const projectFiles = ref<Record<string, ResearchFile[]>>({});
const projectTeams = ref<Record<string, TeamMember[]>>({});
const savedIds = ref<Set<string>>(new Set());

const truncate = (text: string, maxLen: number) => {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
};

const getOwnerName = (ownerId: string) => ownerNames.value[ownerId] || ownerId.substring(0, 8) + '...';

const canAccessProject = (project: ResearchProject) => {
  const userId = authStore.user?.id;
  if (project.access_level === 'public') return true;
  if (project.owner_id === userId) return true;
  const team = projectTeams.value[project.id] || [];
  return team.some(t => t.user_id === userId);
};

const isSaved = (projectId: string) => savedIds.value.has(projectId);

// This is the handler for both button click and enter key
// It always calls doSearchPage with page=1
const handleSearch = () => {
  doSearchPage(1);
};

// This is called for pagination
const goToPage = (page: number) => {
  doSearchPage(page);
};

// The actual search function that takes a page number
const doSearchPage = async (page: number) => {
  loading.value = true;
  hasSearched.value = true;
  const userId = authStore.user?.id;
  if (!userId) {
    loading.value = false;
    return;
  }
  try {
    const result = await researchService.searchProjects(userId, {
      q: searchQuery.value || undefined,
      year: yearFilter.value || undefined,
      access: accessFilter.value !== 'all' ? accessFilter.value : undefined,
      page: page,
      page_size: 6,
    });
    searchResults.value = result.results;
    pagination.value = result.pagination;

    // Load files and teams for each result
    for (const project of result.results) {
      try {
        const files = await researchService.getProjectFiles(project.id, userId);
        projectFiles.value[project.id] = files;
      } catch {
        projectFiles.value[project.id] = [];
      }
      try {
        const team = await researchService.getTeam(project.id, userId);
        projectTeams.value[project.id] = team;
      } catch {
        projectTeams.value[project.id] = [];
      }
    }

    // Resolve owner names
    const uniqueOwners = [...new Set(result.results.map(p => p.owner_id))];
    // Fetch all researcher profiles once
    let allProfiles: any[] = [];
    try {
      allProfiles = await researchService.getResearcherProfiles();
    } catch {
      allProfiles = [];
    }
    for (const ownerId of uniqueOwners) {
      if (!ownerNames.value[ownerId]) {
        const profile = allProfiles.find((p: any) => p.user_id === ownerId);
        if (profile) {
          const name = (profile.first_name + ' ' + profile.last_name).trim();
          ownerNames.value[ownerId] = name || profile.username || ownerId.substring(0, 8);
        } else {
          ownerNames.value[ownerId] = ownerId.substring(0, 8);
        }
      }
    }
  } catch (err) {
    console.error('Search failed:', err);
  } finally {
    loading.value = false;
  }
};

const downloadFile = async (file: ResearchFile) => {
  const userId = authStore.user?.id;
  if (!userId) return;
  try {
    const { url } = await researchService.getFileDownloadInfo(file.id, userId);
    const token = import.meta.env.VITE_AUTH_TOKEN;
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}`, 'X-User-ID': userId }
    });
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.original_filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Download failed:', err);
    alert('Failed to download file');
  }
};

const saveToLibrary = async (project: ResearchProject) => {
  const userId = authStore.user?.id;
  if (!userId) return;
  try {
    await researchService.saveLocalProjectToLibrary(userId, project);
    savedIds.value.add(project.id);
    alert('Project saved to library!');
  } catch (err: any) {
    alert(err.message || 'Failed to save to library');
  }
};

onMounted(() => {
  const userId = authStore.user?.id;
  if (userId) {
    researchStore.loadImportedPapers(userId).then(() => {
      researchStore.savedLocalProjects.forEach(p => {
        if (p.local_project_id) savedIds.value.add(p.local_project_id);
      });
    });
    // Auto-search on load to show all available projects
    doSearchPage(1);
  }
});
</script>

<style src="@/assets/css/research-flow.css"></style>