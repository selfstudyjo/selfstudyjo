<template>
  <div class="research-collab-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research')"><RfIconBack /> Back</button>
      <h1 class="rf-page-title"><RfIconCollab /> Collaboration</h1>
    </div>

    <div class="rf-section rf-collab-send">
      <h2 class="rf-section-title"><RfIconSend /> Send Collaboration Request</h2>
      <div class="rf-collab-form">
        <select v-model="selectedProjectId" class="rf-select">
          <option value="">Select a project...</option>
          <option v-for="p in availableProjects" :key="p.id" :value="p.id">
            {{ p.title }} ({{ p.access_level }})
          </option>
        </select>
        <textarea v-model="requestMessage" class="rf-textarea" placeholder="Enter your collaboration request message..." rows="3"></textarea>
        <button class="rf-btn rf-btn-primary" @click="sendRequest" :disabled="!selectedProjectId || !requestMessage || sendingRequest">
          {{ sendingRequest ? 'Sending...' : 'Send Request' }}
        </button>
      </div>
    </div>

    <div class="rf-tabs">
      <button :class="['rf-tab', { active: activeTab === 'received' }]" @click="activeTab = 'received'">
        <RfIconInbox /> Received ({{ receivedRequests.length }})
      </button>
      <button :class="['rf-tab', { active: activeTab === 'sent' }]" @click="activeTab = 'sent'">
        <RfIconSend /> My Requests ({{ sentRequests.length }})
      </button>
      <button :class="['rf-tab', { active: activeTab === 'pending' }]" @click="activeTab = 'pending'">
        <RfIconTime /> Pending ({{ pendingRequests.length }})
      </button>
      <button :class="['rf-tab', { active: activeTab === 'approved' }]" @click="activeTab = 'approved'">
        <RfIconCheck /> Approved ({{ approvedRequests.length }})
      </button>
      <button :class="['rf-tab', { active: activeTab === 'rejected' }]" @click="activeTab = 'rejected'">
        <RfIconClose /> Rejected ({{ rejectedRequests.length }})
      </button>
    </div>

    <div class="rf-filters">
      <input v-model="tabSearch" type="text" class="rf-input" placeholder="Search requests..." />
    </div>

    <div v-if="loading" class="rf-loading"><div class="rf-spinner"></div></div>

    <div v-else class="rf-collab-list">
      <div v-if="displayedRequests.length === 0" class="rf-empty">
        <p>No requests in this category.</p>
      </div>
      <div v-for="req in displayedRequests" :key="req.id" class="rf-collab-card">
        <div class="rf-collab-card-header">
          <h3>{{ getProjectTitle(req.project_id) }}</h3>
          <span :class="['rf-badge', `rf-badge-${req.status}`]">{{ req.status }}</span>
        </div>
        <p class="rf-collab-message">{{ req.message }}</p>
        <div class="rf-collab-meta">
          <span>From: {{ req.requester_id === userId ? 'You' : req.requester_id.substring(0, 8) + '...' }}</span>
          <span>To: {{ req.recipient_id === userId ? 'You' : req.recipient_id.substring(0, 8) + '...' }}</span>
          <span>{{ formatDate(req.created_at) }}</span>
        </div>
        <div v-if="req.status === 'pending' && req.recipient_id === userId" class="rf-collab-card-actions">
          <button class="rf-btn rf-btn-sm rf-btn-success" @click="respondTo(req.id, 'approve')"><RfIconCheck /> Approve</button>
          <button class="rf-btn rf-btn-sm rf-btn-danger" @click="respondTo(req.id, 'reject')"><RfIconClose /> Reject</button>
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
import type { ResearchProject } from '@/services/research.service';
import {
  RfIconBack, RfIconCollab, RfIconSend, RfIconInbox,
  RfIconTime, RfIconCheck, RfIconClose
} from '@/utils/rf-icons';

const authStore = useAuthStore();
const researchStore = useResearchStore();

const loading = ref(true);
const activeTab = ref('received');
const tabSearch = ref('');
const selectedProjectId = ref('');
const requestMessage = ref('');
const sendingRequest = ref(false);
const availableProjects = ref<ResearchProject[]>([]);
const projectTitles = ref<Record<string, string>>({});

const userId = computed(() => authStore.user?.id || '');
const allRequests = computed(() => researchStore.collaborationRequests);
const receivedRequests = computed(() => allRequests.value.filter(r => r.recipient_id === userId.value));
const sentRequests = computed(() => allRequests.value.filter(r => r.requester_id === userId.value));
const pendingRequests = computed(() => allRequests.value.filter(r => r.status === 'pending'));
const approvedRequests = computed(() => allRequests.value.filter(r => r.status === 'approved'));
const rejectedRequests = computed(() => allRequests.value.filter(r => r.status === 'rejected'));

const currentTabRequests = computed(() => {
  switch (activeTab.value) {
    case 'received': return receivedRequests.value;
    case 'sent': return sentRequests.value;
    case 'pending': return pendingRequests.value;
    case 'approved': return approvedRequests.value;
    case 'rejected': return rejectedRequests.value;
    default: return allRequests.value;
  }
});

const displayedRequests = computed(() => {
  if (!tabSearch.value) return currentTabRequests.value;
  const q = tabSearch.value.toLowerCase();
  return currentTabRequests.value.filter(r =>
    (r.message || '').toLowerCase().includes(q) ||
    getProjectTitle(r.project_id).toLowerCase().includes(q)
  );
});

const getProjectTitle = (projectId: string) => projectTitles.value[projectId] || projectId.substring(0, 8) + '...';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const sendRequest = async () => {
  if (!selectedProjectId.value || !requestMessage.value || !userId.value) return;
  sendingRequest.value = true;
  try {
    await researchStore.sendCollaborationRequest(userId.value, selectedProjectId.value, requestMessage.value);
    alert('Collaboration request sent!');
    requestMessage.value = '';
    selectedProjectId.value = '';
  } catch (err: any) {
    alert(err.message || 'Failed to send request');
  } finally {
    sendingRequest.value = false;
  }
};

const respondTo = async (requestId: string, action: 'approve' | 'reject') => {
  try {
    await researchStore.respondToCollaboration(requestId, userId.value, action);
    alert(`Request ${action}d!`);
  } catch (err: any) {
    alert(err.message || `Failed to ${action} request`);
  }
};

onMounted(async () => {
  loading.value = true;
  try {
    if (userId.value) {
      await researchStore.loadCollaborationRequests(userId.value);
      const allProjects = await researchService.getProjects(userId.value);
      availableProjects.value = allProjects.filter(p => p.owner_id !== userId.value);
      for (const p of allProjects) {
        projectTitles.value[p.id] = p.title;
      }
    }
  } finally {
    loading.value = false;
  }
});
</script>

<style src="@/assets/css/research-flow.css"></style>