<template>
  <div class="research-researcher-profile-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.back()"><RfIconBack /> {{ $t('Back') }}</button>
      <h1 class="rf-page-title"><RfIconProfile /> {{ $t('Researcher Profile') }}</h1>
    </div>

    <div v-if="loading" class="rf-loading"><div class="rf-spinner"></div></div>

    <div v-else-if="!profile" class="rf-empty">
      <p>{{ $t('Researcher profile not found.') }}</p>
    </div>

    <div v-else class="rf-profile-layout">
      <div class="rf-section rf-profile-header-section">
        <div class="rf-profile-avatar-lg">
          {{ getInitials(profile.first_name, profile.last_name, profile.username) }}
        </div>
        <div class="rf-profile-info">
          <h2>{{ (profile.first_name + ' ' + profile.last_name).trim() || profile.username }}</h2>
          <p v-if="profile.university"><RfIconUniversity /> {{ profile.university }}</p>
          <p v-if="profile.department"><RfIconLibrary /> {{ profile.department }}</p>
          <p v-if="profile.institution"><RfIconFolder /> {{ profile.institution }}</p>
          <p v-if="profile.email">{{ profile.email }}</p>
        </div>
        <button
          v-if="!isOwnProfile"
          class="rf-btn"
          :class="isFollowing ? 'rf-btn-danger' : 'rf-btn-primary'"
          @click="toggleFollowAction"
        >
          <RfIconFollowers /> {{ isFollowing ? 'Unfollow' : 'Follow' }}
        </button>
      </div>

      <div class="rf-tabs">
        <button :class="['rf-tab', { active: activeTab === 'projects' }]" @click="activeTab = 'projects'">
          <RfIconFolder /> {{ $t('Projects ({v0})', { v0: researcherProjects.length }) }}
        </button>
        <button :class="['rf-tab', { active: activeTab === 'about' }]" @click="activeTab = 'about'">
          <RfIconProfile /> {{ $t('About') }}
        </button>
      </div>

      <div v-if="activeTab === 'projects'" class="rf-section">
        <div v-if="researcherProjects.length === 0" class="rf-empty"><p>{{ $t('No projects yet.') }}</p></div>
        <div v-else class="rf-projects-grid">
          <div v-for="project in researcherProjects" :key="project.id" class="rf-project-card">
            <h3 class="rf-project-title">{{ project.title }}</h3>
            <p class="rf-project-desc">{{ truncate(project.description, 120) }}</p>
            <div class="rf-project-meta">
              <span><RfIconCalendar /> {{ project.publication_year || 'N/A' }}</span>
              <span><RfIconEye /> {{ project.views }}</span>
              <span><RfIconDownload /> {{ project.downloads }}</span>
            </div>
            <div class="rf-keywords" v-if="project.keywords?.length">
              <span v-for="kw in project.keywords" :key="kw" class="rf-keyword-badge">{{ kw }}</span>
            </div>
            <button class="rf-btn rf-btn-sm rf-btn-primary" @click="$router.push(`/research/project/${project.id}`)">{{ $t('View Project') }}</button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'about'" class="rf-section rf-about-section">
        <div class="rf-about-grid">
          <div class="rf-about-item" v-if="profile.bio">
            <h3>{{ $t('Bio') }}</h3>
            <p>{{ profile.bio }}</p>
          </div>
          <div class="rf-about-item" v-if="profile.research_interests?.length">
            <h3>{{ $t('Research Interests') }}</h3>
            <div class="rf-keywords">
              <span v-for="interest in profile.research_interests" :key="interest" class="rf-keyword-badge">{{ interest }}</span>
            </div>
          </div>
          <div class="rf-about-item" v-if="profile.orcid_id">
            <h3>ORCID</h3>
            <p>{{ profile.orcid_id }}</p>
          </div>
          <div class="rf-about-item" v-if="profile.google_scholar_id">
            <h3>Google Scholar</h3>
            <p>{{ profile.google_scholar_id }}</p>
          </div>
          <div class="rf-about-item" v-if="profile.website">
            <h3>{{ $t('Website') }}</h3>
            <a :href="profile.website" target="_blank" class="rf-link">{{ profile.website }}</a>
          </div>
          <div class="rf-about-item">
            <h3>{{ $t('Joined') }}</h3>
            <p>{{ formatDate(profile.created_at) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import { researchService } from '@/services/research.service';
import type { ResearcherProfile, ResearchProject } from '@/services/research.service';
import {
  RfIconBack, RfIconProfile, RfIconUniversity, RfIconLibrary,
  RfIconFolder, RfIconFollowers, RfIconCalendar, RfIconEye, RfIconDownload
} from '@/utils/rf-icons';

const route = useRoute();
const authStore = useAuthStore();
const researchStore = useResearchStore();

const loading = ref(true);
const activeTab = ref('projects');
const profile = ref<ResearcherProfile | null>(null);
const researcherProjects = ref<ResearchProject[]>([]);

const researcherUserId = computed(() => route.params.userId as string);
const isOwnProfile = computed(() => authStore.user?.id === researcherUserId.value);
const isFollowing = computed(() => researchStore.followingIds.includes(researcherUserId.value));

const getInitials = (firstName: string, lastName: string, username: string) => {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (username) return username[0].toUpperCase();
  return '?';
};

const truncate = (text: string, maxLen: number) => {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const toggleFollowAction = async () => {
  const userId = authStore.user?.id;
  if (!userId) return;
  try { await researchStore.toggleFollow(userId, researcherUserId.value); }
  catch { alert('Failed to update follow status'); }
};

onMounted(async () => {
  loading.value = true;
  try {
    const userId = authStore.user?.id;
    if (userId) {
      await researchStore.loadFollowing(userId);
      profile.value = await researchService.getResearcherProfile(researcherUserId.value);
      const allProjects = await researchService.getProjects(userId);
      researcherProjects.value = allProjects.filter(p => p.owner_id === researcherUserId.value);
    }
  } finally { loading.value = false; }
});
</script>

<style src="@/assets/css/research-flow.css"></style>