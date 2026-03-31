<template>
  <div class="research-create-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.push('/research')"><RfIconBack /> Back</button>
      <h1 class="rf-page-title"><RfIconAdd /> Create New Project</h1>
    </div>

    <div class="rf-section rf-create-form">
      <h2 class="rf-section-title">Basic Information</h2>

      <div class="rf-form-group">
        <label class="rf-label">Title *</label>
        <input v-model="form.title" class="rf-input" placeholder="Project title" required />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Description *</label>
        <textarea v-model="form.description" class="rf-textarea" placeholder="Project description..." rows="5" required></textarea>
      </div>

      <div class="rf-form-row">
        <div class="rf-form-group">
          <label class="rf-label">Publication Year</label>
          <input v-model.number="form.publication_year" class="rf-input" type="number" placeholder="2025" />
        </div>
        <div class="rf-form-group">
          <label class="rf-label">Venue/Journal</label>
          <input v-model="form.venue" class="rf-input" placeholder="e.g., Nature, IEEE..." />
        </div>
      </div>

      <div class="rf-form-group">
        <label class="rf-label">DOI (Optional)</label>
        <input v-model="form.doi" class="rf-input" placeholder="10.1234/example" />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Keywords (comma separated)</label>
        <input v-model="form.keywordsStr" class="rf-input" placeholder="AI, Machine Learning, Deep Learning" />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Access Control *</label>
        <select v-model="form.access_level" class="rf-select">
          <option value="public">Public - Anyone can view</option>
          <option value="team">Team - Only team members</option>
          <option value="private">Private - Only you</option>
        </select>
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Status</label>
        <select v-model="form.status" class="rf-select">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="under_review">Under Review</option>
        </select>
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Upload File (Optional)</label>
        <input type="file" ref="fileInput" class="rf-input" @change="onFileSelect" />
        <input v-model="fileDescription" class="rf-input" placeholder="File description" style="margin-top: 8px;" />
      </div>

      <div class="rf-form-actions">
        <button class="rf-btn rf-btn-primary rf-btn-lg" @click="createProject" :disabled="!form.title || !form.description || creating">
          {{ creating ? 'Creating...' : 'Create Project' }}
        </button>
        <button class="rf-btn rf-btn-secondary" @click="$router.push('/research')">Cancel</button>
      </div>

      <div v-if="errorMsg" class="rf-error-msg">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import { RfIconBack, RfIconAdd } from '@/utils/rf-icons';

const router = useRouter();
const authStore = useAuthStore();
const researchStore = useResearchStore();

const creating = ref(false);
const errorMsg = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const fileDescription = ref('');

const form = ref({
  title: '',
  description: '',
  publication_year: null as number | null,
  venue: '',
  doi: '',
  keywordsStr: '',
  access_level: 'private',
  status: 'draft',
});

const onFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  selectedFile.value = target.files?.[0] || null;
};

const createProject = async () => {
  if (!form.value.title || !form.value.description) {
    errorMsg.value = 'Title and description are required';
    return;
  }
  const userId = authStore.user?.id;
  if (!userId) return;

  creating.value = true;
  errorMsg.value = '';
  try {
    const keywords = form.value.keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
    const project = await researchStore.createProject(userId, {
      title: form.value.title,
      description: form.value.description,
      publication_year: form.value.publication_year || undefined,
      venue: form.value.venue || undefined,
      doi: form.value.doi || undefined,
      keywords,
      access_level: form.value.access_level as any,
      status: form.value.status as any,
    });

    if (selectedFile.value) {
      try {
        await researchStore.uploadFile(project.id, userId, selectedFile.value, fileDescription.value, 'v1.0');
      } catch (err) {
        console.warn('File upload failed but project was created:', err);
      }
    }

    router.push(`/research/project/${project.id}`);
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to create project';
  } finally {
    creating.value = false;
  }
};
</script>

<style src="@/assets/css/research-flow.css"></style>