<template>
  <div class="research-library-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research')"><RfIconBack /> Back</button>
      <h1 class="rf-page-title"><RfIconLibrary /> My Research Library</h1>
    </div>

    <div class="rf-tabs">
      <button :class="['rf-tab', { active: activeTab === 'openalex' }]" @click="activeTab = 'openalex'">
        <RfIconGlobe /> OpenAlex Library ({{ importedPapers.length }})
      </button>
      <button :class="['rf-tab', { active: activeTab === 'local' }]" @click="activeTab = 'local'">
        <RfIconFolder /> Local Projects ({{ savedLocalProjects.length }})
      </button>
    </div>

    <div v-if="loading" class="rf-loading">
      <div class="rf-spinner"></div>
      <p>Loading library...</p>
    </div>

    <div v-else-if="activeTab === 'openalex'">
      <div v-if="importedPapers.length === 0" class="rf-empty">
        <p>No papers in your OpenAlex library yet.</p>
        <button class="rf-btn rf-btn-primary" @click="$router.push('/research/import-openalex')">
          Import from OpenAlex
        </button>
      </div>
      <div v-else class="rf-library-grid">
        <div v-for="paper in importedPapers" :key="paper.id" class="rf-library-card">
          <h3 class="rf-library-title">{{ paper.title }}</h3>
          <p class="rf-library-meta">
            <span v-if="paper.publication_year"><RfIconCalendar /> {{ paper.publication_year }}</span>
            <span v-if="paper.venue"><RfIconLibrary /> {{ paper.venue }}</span>
            <span v-if="paper.citation_count"><RfIconCitation /> {{ paper.citation_count }} citations</span>
            <span v-if="paper.open_access"><RfIconOpenAccess /> Open Access</span>
          </p>
          <p v-if="paper.doi" class="rf-library-doi">DOI: {{ paper.doi }}</p>
          <div class="rf-keywords" v-if="paper.keywords && paper.keywords.length">
            <span v-for="kw in paper.keywords" :key="kw" class="rf-keyword-badge">{{ kw }}</span>
          </div>
          <div class="rf-library-actions">
            <button v-if="paper.url" class="rf-btn rf-btn-sm rf-btn-primary" @click="openExternal(paper.url)">
              <RfIconLink /> View Paper
            </button>
            <button class="rf-btn rf-btn-sm rf-btn-danger" @click="removePaper(paper.id)">
              <RfIconDelete /> Remove
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'local'">
      <div v-if="savedLocalProjects.length === 0" class="rf-empty">
        <p>No saved local projects yet.</p>
        <button class="rf-btn rf-btn-primary" @click="$router.push('/research/search')">Search Projects</button>
      </div>
      <div v-else class="rf-library-grid">
        <div v-for="paper in savedLocalProjects" :key="paper.id" class="rf-library-card">
          <h3 class="rf-library-title">{{ paper.title }}</h3>
          <p class="rf-library-meta">
            <span v-if="paper.publication_year"><RfIconCalendar /> {{ paper.publication_year }}</span>
            <span v-if="paper.venue"><RfIconLibrary /> {{ paper.venue }}</span>
          </p>
          <div class="rf-library-actions">
            <button v-if="paper.local_project_id" class="rf-btn rf-btn-sm rf-btn-primary" @click="$router.push(`/research/project/${paper.local_project_id}`)">
              <RfIconFolder /> View Project
            </button>
            <button class="rf-btn rf-btn-sm rf-btn-danger" @click="removePaper(paper.id)">
              <RfIconDelete /> Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import {
  RfIconBack, RfIconLibrary, RfIconGlobe, RfIconFolder,
  RfIconCalendar, RfIconCitation, RfIconOpenAccess,
  RfIconLink, RfIconDelete
} from '@/utils/rf-icons';

const authStore = useAuthStore();
const researchStore = useResearchStore();

const loading = ref(true);
const activeTab = ref('openalex');

const importedPapers = computed(() => researchStore.importedPapers);
const savedLocalProjects = computed(() => researchStore.savedLocalProjects);

const openExternal = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const removePaper = async (paperId: string) => {
  if (!confirm('Remove this paper from your library?')) return;
  const userId = authStore.user?.id;
  if (!userId) return;
  try {
    await researchStore.deleteImportedPaper(paperId, userId);
  } catch (err) {
    alert('Failed to remove paper');
  }
};

onMounted(async () => {
  loading.value = true;
  try {
    const userId = authStore.user?.id;
    if (userId) {
      await researchStore.loadImportedPapers(userId);
    }
  } finally {
    loading.value = false;
  }
});
</script>

<style src="@/assets/css/research-flow.css"></style>