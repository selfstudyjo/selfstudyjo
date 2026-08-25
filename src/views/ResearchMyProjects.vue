<template>
  <div class="research-myprojects-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research')">
        <RfIconBack /> {{ $t('Back') }}
      </button>
      <h1 class="rf-page-title"><RfIconFolder /> {{ $t('My Projects') }}</h1>
    </div>

    <div class="rf-project-stats">
      <div class="rf-pstat">
        <span class="rf-pstat-val">{{ filteredProjects.length }}</span>
        <span class="rf-pstat-label">{{ $t('Total') }}</span>
      </div>
      <div class="rf-pstat">
        <span class="rf-pstat-val">{{ publishedCount }}</span>
        <span class="rf-pstat-label">{{ $t('Published') }}</span>
      </div>
      <div class="rf-pstat">
        <span class="rf-pstat-val">{{ draftCount }}</span>
        <span class="rf-pstat-label">{{ $t('Draft') }}</span>
      </div>
      <div class="rf-pstat">
        <span class="rf-pstat-val">{{ reviewCount }}</span>
        <span class="rf-pstat-label">{{ $t('Under Review') }}</span>
      </div>
    </div>

    <div class="rf-filters">
      <input v-model="searchQuery" type="text" class="rf-input" :placeholder="$t('Search my projects...')" />
      <select v-model="statusFilter" class="rf-select">
        <option value="">{{ $t('All Statuses') }}</option>
        <option value="draft">{{ $t('Draft') }}</option>
        <option value="published">{{ $t('Published') }}</option>
        <option value="under_review">{{ $t('Under Review') }}</option>
      </select>
      <select v-model="accessFilter" class="rf-select">
        <option value="">{{ $t('All Access') }}</option>
        <option value="public">{{ $t('Public') }}</option>
        <option value="team">{{ $t('Team') }}</option>
        <option value="private">{{ $t('Private') }}</option>
      </select>
      <button class="rf-btn rf-btn-primary" @click="$router.push('/research/create-project')">
        <RfIconAdd /> {{ $t('New Project') }}
      </button>
    </div>

    <div v-if="loading" class="rf-loading">
      <div class="rf-spinner"></div>
      <p>{{ $t('Loading projects...') }}</p>
    </div>

    <div v-else-if="filteredProjects.length === 0" class="rf-empty">
      <p>{{ $t('No projects found. Create your first project!') }}</p>
      <button class="rf-btn rf-btn-primary" @click="$router.push('/research/create-project')">{{ $t('Create Project') }}</button>
    </div>

    <div v-else class="rf-projects-grid">
      <div v-for="project in filteredProjects" :key="project.id" class="rf-project-card">
        <div class="rf-project-card-header">
          <h3 class="rf-project-title">{{ project.title }}</h3>
          <span :class="['rf-badge', `rf-badge-${project.status}`]">{{ formatStatus(project.status) }}</span>
        </div>
        <p class="rf-project-desc">{{ truncate(project.description, 120) }}</p>
        <div class="rf-project-meta">
          <span v-if="project.publication_year"><RfIconCalendar /> {{ project.publication_year }}</span>
          <span><RfIconFile /> {{ $t('{v0} files', { v0: getFileCount(project.id) }) }}</span>
          <span><RfIconEye /> {{ $t('{v0} views', { v0: project.views }) }}</span>
          <span><RfIconPeople /> {{ $t('{v0} members', { v0: getTeamCount(project.id) }) }}</span>
          <span><RfIconDownload /> {{ $t('{v0} downloads', { v0: project.downloads }) }}</span>
        </div>
        <div class="rf-keywords" v-if="project.keywords && project.keywords.length">
          <span v-for="kw in project.keywords" :key="kw" class="rf-keyword-badge">{{ kw }}</span>
        </div>
        <div class="rf-project-card-actions">
          <button class="rf-btn rf-btn-sm rf-btn-primary" @click="$router.push(`/research/project/${project.id}`)">
            {{ $t('View Project') }}
          </button>
          <span :class="['rf-access-badge', `rf-access-${project.access_level}`]">{{ project.access_level }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import { researchService } from '@/services/research.service';
import {
  RfIconBack, RfIconFolder, RfIconAdd, RfIconCalendar,
  RfIconFile, RfIconEye, RfIconPeople, RfIconDownload
} from '@/utils/rf-icons';

const authStore = useAuthStore();
const researchStore = useResearchStore();

const loading = ref(true);
const searchQuery = ref('');
const statusFilter = ref('');
const accessFilter = ref('');
const teamCounts = ref<Record<string, number>>({});
const fileCounts = ref<Record<string, number>>({});

const filteredProjects = computed(() => {
  let projects = researchStore.myProjects;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    projects = projects.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.keywords || []).some(k => k.toLowerCase().includes(q))
    );
  }
  if (statusFilter.value) projects = projects.filter(p => p.status === statusFilter.value);
  if (accessFilter.value) projects = projects.filter(p => p.access_level === accessFilter.value);
  return projects;
});

const publishedCount = computed(() => researchStore.myProjects.filter(p => p.status === 'published').length);
const draftCount = computed(() => researchStore.myProjects.filter(p => p.status === 'draft').length);
const reviewCount = computed(() => researchStore.myProjects.filter(p => p.status === 'under_review').length);

const getTeamCount = (projectId: string) => teamCounts.value[projectId] || 0;
const getFileCount = (projectId: string) => fileCounts.value[projectId] || 0;

const truncate = (text: string, maxLen: number) => {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
};

const formatStatus = (status: string) => {
  const map: Record<string, string> = { draft: 'Draft', published: 'Published', under_review: 'Under Review' };
  return map[status] || status;
};

onMounted(async () => {
  loading.value = true;
  try {
    const userId = authStore.user?.id;
    if (userId) {
      await researchStore.loadMyProjects(userId);
      for (const project of researchStore.myProjects) {
        try {
          const team = await researchService.getTeam(project.id, userId);
          teamCounts.value[project.id] = team.length;
        } catch { teamCounts.value[project.id] = 0; }
        try {
          const files = await researchService.getProjectFiles(project.id, userId);
          fileCounts.value[project.id] = files.length;
        } catch { fileCounts.value[project.id] = 0; }
      }
    }
  } finally {
    loading.value = false;
  }
});
</script>

<style src="@/assets/css/research-flow.css"></style>