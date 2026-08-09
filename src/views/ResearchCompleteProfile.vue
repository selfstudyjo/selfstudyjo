<template>
  <div class="research-complete-profile-page">
    <div class="rf-page-header">
      <button v-if="isEditing" class="rf-back-btn" @click="$router.push('/research')"><RfIconBack /> Back</button>
      <h1 class="rf-page-title"><RfIconProfile /> {{ isEditing ? 'Edit' : 'Complete' }} Your Researcher Profile</h1>
      <p class="rf-subtitle">{{ isEditing ? 'Update your researcher profile information' : 'Set up your researcher profile to start using Research Flow' }}</p>
    </div>

    <div class="rf-section rf-profile-form-section">
      <div class="rf-form-group">
        <label class="rf-label">User ID</label>
        <input :value="userId" class="rf-input rf-input-disabled" disabled />
      </div>

      <div class="rf-form-row">
        <div class="rf-form-group">
          <label class="rf-label">First Name</label>
          <input v-model="form.first_name" class="rf-input" placeholder="First name" />
        </div>
        <div class="rf-form-group">
          <label class="rf-label">Last Name</label>
          <input v-model="form.last_name" class="rf-input" placeholder="Last name" />
        </div>
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Email</label>
        <input v-model="form.email" class="rf-input" type="email" placeholder="Email" />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Username</label>
        <input v-model="form.username" class="rf-input" placeholder="Username" />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">University *</label>
        <input v-model="form.university" class="rf-input" placeholder="e.g., MIT, Stanford..." />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Institution</label>
        <input v-model="form.institution" class="rf-input" placeholder="Research institution..." />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Department</label>
        <input v-model="form.department" class="rf-input" placeholder="e.g., Computer Science..." />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Bio</label>
        <textarea v-model="form.bio" class="rf-textarea" placeholder="Tell us about yourself and your research..." rows="4"></textarea>
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Research Interests (comma separated)</label>
        <input v-model="form.interestsStr" class="rf-input" placeholder="AI, Machine Learning, Data Science" />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">ORCID ID</label>
        <input v-model="form.orcid_id" class="rf-input" placeholder="0000-0000-0000-0000" />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Google Scholar ID</label>
        <input v-model="form.google_scholar_id" class="rf-input" placeholder="Google Scholar profile ID" />
      </div>

      <div class="rf-form-group">
        <label class="rf-label">Website</label>
        <input v-model="form.website" class="rf-input" type="url" placeholder="https://..." />
      </div>

      <div class="rf-form-actions">
        <button class="rf-btn rf-btn-primary rf-btn-lg" @click="saveProfile" :disabled="!form.university || saving">
          {{ saving ? 'Saving...' : isEditing ? 'Update Profile' : 'Create Profile' }}
        </button>
        <button v-if="isEditing" class="rf-btn rf-btn-secondary" @click="$router.push('/research')">Cancel</button>
      </div>

      <div v-if="errorMsg" class="rf-error-msg">{{ errorMsg }}</div>
      <div v-if="successMsg" class="rf-success-msg">{{ successMsg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import { notificationService } from '@/services/notification.service';
import { RfIconBack, RfIconProfile } from '@/utils/rf-icons';

const router = useRouter();
const authStore = useAuthStore();
const researchStore = useResearchStore();

const saving = ref(false);
const errorMsg = ref('');
const successMsg = ref('');
const isEditing = ref(false);

const userId = computed(() => authStore.user?.id || '');

const form = ref({
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  university: '',
  institution: '',
  department: '',
  bio: '',
  interestsStr: '',
  orcid_id: '',
  google_scholar_id: '',
  website: '',
});

const saveProfile = async () => {
  if (!form.value.university) {
    errorMsg.value = 'University is required';
    return;
  }
  if (!userId.value) {
    errorMsg.value = 'User not authenticated';
    return;
  }

  saving.value = true;
  errorMsg.value = '';
  successMsg.value = '';

  try {
    const interests = form.value.interestsStr.split(',').map(i => i.trim()).filter(Boolean);
    const profileData = {
      user_id: userId.value,
      username: form.value.username,
      first_name: form.value.first_name,
      last_name: form.value.last_name,
      email: form.value.email,
      university: form.value.university,
      institution: form.value.institution,
      department: form.value.department,
      bio: form.value.bio,
      research_interests: interests,
      orcid_id: form.value.orcid_id,
      google_scholar_id: form.value.google_scholar_id,
      website: form.value.website,
    };

    if (isEditing.value && researchStore.researcherProfile) {
      await researchStore.updateResearcherProfile(researchStore.researcherProfile.id, userId.value, profileData);
      successMsg.value = 'Profile updated successfully!';
    } else {
      await researchStore.createResearcherProfile(userId.value, profileData);
      successMsg.value = 'Profile created successfully!';
      // Only on creation. Editing a bio is not news to anybody.
      notificationService.notifyAdmins('research.new_researcher', {
        researcher: `${form.value.first_name} ${form.value.last_name}`.trim()
          || authStore.user?.username || 'A researcher',
        field: form.value.institution || form.value.department || 'research',
      });
    }

    setTimeout(() => { router.push('/research'); }, 1500);
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to save profile';
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  const user = authStore.user;
  if (user) {
    form.value.first_name = user.first_name || '';
    form.value.last_name = user.last_name || '';
    form.value.email = user.email || '';
    form.value.username = user.username || '';
  }

  if (userId.value) {
    try {
      const profile = await researchStore.checkResearcherProfile(userId.value);
      if (profile) {
        isEditing.value = true;
        form.value.university = profile.university || '';
        form.value.institution = profile.institution || '';
        form.value.department = profile.department || '';
        form.value.bio = profile.bio || '';
        form.value.interestsStr = (profile.research_interests || []).join(', ');
        form.value.orcid_id = profile.orcid_id || '';
        form.value.google_scholar_id = profile.google_scholar_id || '';
        form.value.website = profile.website || '';
        if (profile.first_name) form.value.first_name = profile.first_name;
        if (profile.last_name) form.value.last_name = profile.last_name;
        if (profile.email) form.value.email = profile.email;
        if (profile.username) form.value.username = profile.username;
      }
    } catch (err) {
      console.log('No existing researcher profile found');
    }
  }
});
</script>

<style src="@/assets/css/research-flow.css"></style>