<template>
  <div class="research-flow-page">
    <div class="rf-header">
      <h1 class="rf-title">
        <span class="rf-icon-wrap"><ResearchIcon /></span>
        {{ $t('Research Flow') }}
      </h1>
      <p class="rf-subtitle">{{ $t('Manage your research projects, collaborate with peers, and explore academic papers') }}</p>
    </div>

    <div v-if="loading" class="rf-loading">
      <div class="rf-spinner"></div>
      <p>{{ $t('Loading Research Flow...') }}</p>
    </div>

    <div v-else class="rf-grid">
      <div
        v-for="card in navCards"
        :key="card.to"
        class="rf-card"
        :class="{ 'rf-card-featured': card.featured }"
        @click="navigateTo(card.to)"
      >
        <div class="rf-card-icon">
          <component :is="card.iconComponent" />
        </div>
        <h3 class="rf-card-title">{{ card.title }}</h3>
        <p class="rf-card-desc">{{ card.description }}</p>
        <div class="rf-card-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
        </div>
      </div>
    </div>

    <div v-if="dashboardData" class="rf-stats-section">
      <h2 class="rf-section-title">
        <span class="rf-icon-wrap"><StatsIcon /></span>
        {{ $t('Quick Stats') }}
      </h2>
      <div class="rf-stats-grid">
        <div class="rf-stat-card">
          <div class="rf-stat-value">{{ dashboardData.stats.research_files }}</div>
          <div class="rf-stat-label">{{ $t('Research Files') }}</div>
        </div>
        <div class="rf-stat-card">
          <div class="rf-stat-value">{{ dashboardData.stats.collaborations }}</div>
          <div class="rf-stat-label">{{ $t('Collaborations') }}</div>
        </div>
        <div class="rf-stat-card">
          <div class="rf-stat-value">{{ dashboardData.stats.total_views }}</div>
          <div class="rf-stat-label">{{ $t('Total Views') }}</div>
        </div>
        <div class="rf-stat-card">
          <div class="rf-stat-value">{{ dashboardData.stats.downloads }}</div>
          <div class="rf-stat-label">{{ $t('Downloads') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import type { DashboardData } from '@/services/research.service';

const router = useRouter();
const authStore = useAuthStore();
const researchStore = useResearchStore();

const loading = ref(true);
const dashboardData = ref<DashboardData | null>(null);

// ===== SVG Icon Components =====
const ResearchIcon = {
  render() {
    return h('svg', { width: '28', height: '28', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M9 4v1.38c-.83-.33-1.72-.5-2.5-.5-1.79 0-3.5.72-3.5 2.38V19.5C3 20.88 4.28 21 5.5 21c.96 0 1.89-.12 2.5-.38V22h10v-7.5L21.5 18l-2-2 2-2L18 17.5V4H9z' })
    ]);
  }
};

const StatsIcon = {
  render() {
    return h('svg', { width: '22', height: '22', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z' })
    ]);
  }
};

const FolderIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' })
    ]);
  }
};

const SearchIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' })
    ]);
  }
};

const LibraryIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z' })
    ]);
  }
};

const CollabIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' })
    ]);
  }
};

const AddIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' })
    ]);
  }
};

const GlobeIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zM5.08 16h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z' })
    ]);
  }
};

const PeopleIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z' })
    ]);
  }
};

const ProfileIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' })
    ]);
  }
};

const ScholarIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z' })
    ]);
  }
};

const AIWriterIcon = {
  render() {
    return h('svg', { width: '32', height: '32', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z' })
    ]);
  }
};

const navCards = [
  {
    to: '/research/ai-writer',
    iconComponent: AIWriterIcon,
    title: 'AI Research Writer',
    description: 'Plan and draft a Bachelor, Master or PhD document, then export it as DOCX or PDF',
    featured: true,
  },
  {
    to: '/research/my-projects',
    iconComponent: FolderIcon,
    title: 'My Projects',
    description: 'View and manage your research projects',
  },
  {
    to: '/research/search',
    iconComponent: SearchIcon,
    title: 'Search Projects',
    description: 'Discover and explore public research projects',
  },
  {
    to: '/research/library',
    iconComponent: LibraryIcon,
    title: 'My Research Library',
    description: 'Saved papers and local projects collection',
  },
  {
    to: '/research/collaboration',
    iconComponent: CollabIcon,
    title: 'Collaboration',
    description: 'Manage collaboration requests and invitations',
  },
  {
    to: '/research/create-project',
    iconComponent: AddIcon,
    title: 'Create Project',
    description: 'Start a new research project',
  },
  {
    to: '/research/import-openalex',
    iconComponent: GlobeIcon,
    title: 'Import from OpenAlex',
    description: 'Search 250M+ papers with filters, download PDFs and save them to your library',
  },
  {
    to: '/research/google-scholar',
    iconComponent: ScholarIcon,
    title: 'Google Scholar Search',
    description: 'AI-assisted Scholar search, verified against OpenAlex, with direct Scholar links',
  },
  {
    to: '/research/researchers',
    iconComponent: PeopleIcon,
    title: 'Researchers',
    description: 'Browse and follow fellow researchers',
  },
  {
    to: '/research/profile',
    iconComponent: ProfileIcon,
    title: 'Researcher Profile',
    description: 'View and edit your researcher profile',
  },
];

const navigateTo = (path: string) => {
  router.push(path);
};

onMounted(async () => {
  loading.value = true;
  try {
    const uid = authStore.user?.id;
    if (uid) {
      const profile = await researchStore.checkResearcherProfile(uid);
      if (!profile) {
        router.replace('/research/complete-profile');
        return;
      }
      await researchStore.loadDashboard(uid);
      dashboardData.value = researchStore.dashboard;
    }
  } catch (err) {
    console.error('Failed to initialize Research Flow:', err);
  } finally {
    loading.value = false;
  }
});
</script>

<style src="@/assets/css/research-flow.css"></style>