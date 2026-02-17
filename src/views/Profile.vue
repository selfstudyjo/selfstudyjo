<template>
  <div class="profile-page">
    <div class="profile-container">
      <!-- Header -->
      <div class="profile-header">
        <h1 class="profile-title">Profile Settings</h1>
        <p class="profile-subtitle">Manage your account information and preferences</p>
      </div>

      <!-- Main Content -->
      <div class="profile-content">
        <!-- Left Column - Profile Picture -->
        <div class="profile-left">
          <div class="profile-card">
            <h2 class="profile-card-title">Profile Picture</h2>

            <div class="avatar-container">
              <ProfileAvatar
                :image-url="profileData.image_url"
                :first-name="profileData.first_name"
                :last-name="profileData.last_name"
                :username="profileData.username"
                :editable="true"
                size="xl"
                @image-upload="handleImageUpload"
                @image-remove="handleImageRemove"
              />
            </div>

            <div class="avatar-info">
              <p class="avatar-info-text">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Upload a JPG, PNG, or GIF image (max 5MB)
              </p>
            </div>

            <!-- Image upload progress -->
            <div v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
              <div class="profile-progress-bar">
                <div class="profile-progress-fill" :style="{ width: `${uploadProgress}%` }"></div>
              </div>
              <div class="profile-progress-text">Uploading: {{ uploadProgress }}%</div>
            </div>

            <!-- Upload error -->
            <div v-if="uploadError" class="profile-error-message">
              {{ uploadError }}
            </div>
          </div>

          <!-- Account Stats -->
          <div class="profile-card">
            <h2 class="profile-card-title">Account Information</h2>
            <div class="account-stats">
              <div class="profile-stat-item">
                <div class="profile-stat-label">Member Since</div>
                <div class="profile-stat-value">
                  {{ formatDate(profileData.date_joined) }}
                </div>
              </div>
              <div class="profile-stat-item">
                <div class="profile-stat-label">Last Updated</div>
                <div class="profile-stat-value">
                  {{ formatDate(profileData.last_updated) }}
                </div>
              </div>
              <div class="profile-stat-item">
                <div class="profile-stat-label">Email Status</div>
                <div class="profile-stat-value">
                  <span :class="profileData.is_email_verified ? 'verified' : 'unverified'">
                    {{ profileData.is_email_verified ? 'Verified' : 'Unverified' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column - Profile Details -->
        <div class="profile-right">
          <!-- Profile Information Form -->
          <div class="profile-card">
            <div class="profile-card-header">
              <h2 class="profile-card-title">Personal Information</h2>
              <button
                v-if="!isEditing"
                @click="startEditing"
                class="profile-edit-btn"
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </div>

            <form v-if="isEditing" @submit.prevent="updateProfile" class="profile-form">
              <div class="profile-form-grid">
                <div class="profile-form-group">
                  <label for="username">Username</label>
                  <input
                    id="username"
                    v-model="editData.username"
                    type="text"
                    :class="{ 'error': fieldErrors.username }"
                    @blur="checkUsernameAvailability"
                  />
                  <div v-if="fieldErrors.username" class="profile-error-message">
                    {{ fieldErrors.username }}
                  </div>
                  <div v-if="usernameAvailable !== null" class="availability-message">
                    <span v-if="usernameAvailable" class="available">✓ Available</span>
                    <span v-else class="unavailable">✗ Username already taken</span>
                  </div>
                </div>

                <div class="profile-form-group">
                  <label for="email">Email Address</label>
                  <input
                    id="email"
                    v-model="editData.email"
                    type="email"
                    :class="{ 'error': fieldErrors.email }"
                    @blur="checkEmailAvailability"
                  />
                  <div v-if="fieldErrors.email" class="profile-error-message">
                    {{ fieldErrors.email }}
                  </div>
                  <div v-if="emailAvailable !== null" class="availability-message">
                    <span v-if="emailAvailable" class="available">✓ Available</span>
                    <span v-else class="unavailable">✗ Email already registered</span>
                  </div>
                  <div v-if="profileData.is_email_verified" class="profile-verified-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    Email Verified
                  </div>
                </div>

                <div class="profile-form-group">
                  <label for="firstName">First Name</label>
                  <input
                    id="firstName"
                    v-model="editData.first_name"
                    type="text"
                  />
                </div>

                <div class="profile-form-group">
                  <label for="lastName">Last Name</label>
                  <input
                    id="lastName"
                    v-model="editData.last_name"
                    type="text"
                  />
                </div>

                <div class="profile-form-group">
                  <label for="gender">Gender</label>
                  <select id="gender" v-model="editData.gender">
                    <option value="">Select Gender</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>

              <div class="profile-form-actions">
                <button
                  type="button"
                  @click="cancelEditing"
                  class="profile-btn profile-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="isUpdating || !isFormValid"
                  class="profile-btn profile-btn-primary"
                >
                  <span v-if="isUpdating" class="profile-loading"></span>
                  Save Changes
                </button>
              </div>
            </form>

            <!-- View Mode -->
            <div v-else class="profile-details">
              <div class="profile-detail-grid">
                <div class="profile-detail-item">
                  <div class="profile-detail-label">Username</div>
                  <div class="profile-detail-value">{{ profileData.username }}</div>
                </div>
                <div class="profile-detail-item">
                  <div class="profile-detail-label">Email</div>
                  <div class="profile-detail-value">
                    {{ profileData.email }}
                    <span v-if="profileData.is_email_verified" class="profile-verified-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  </div>
                </div>
                <div class="profile-detail-item">
                  <div class="profile-detail-label">First Name</div>
                  <div class="profile-detail-value">{{ profileData.first_name || 'Not set' }}</div>
                </div>
                <div class="profile-detail-item">
                  <div class="profile-detail-label">Last Name</div>
                  <div class="profile-detail-value">{{ profileData.last_name || 'Not set' }}</div>
                </div>
                <div class="profile-detail-item">
                  <div class="profile-detail-label">Gender</div>
                  <div class="profile-detail-value">
                    {{ profileData.gender === 'M' ? 'Male' :
                       profileData.gender === 'F' ? 'Female' : 'Not set' }}
                  </div>
                </div>
                <div class="profile-detail-item">
                  <div class="profile-detail-label">User ID</div>
                  <div class="profile-detail-value small">{{ profileData.user_id }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Change Password Form -->
          <div class="profile-card">
            <h2 class="profile-card-title">Change Password</h2>
            <form @submit.prevent="handleChangePassword" class="password-form">
              <div class="profile-form-group">
                <label for="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  v-model="passwordData.current_password"
                  type="password"
                  :class="{ 'error': passwordErrors.current_password }"
                />
                <div v-if="passwordErrors.current_password" class="profile-error-message">
                  {{ passwordErrors.current_password }}
                </div>
              </div>

              <div class="profile-form-group">
                <label for="newPassword">New Password</label>
                <input
                  id="newPassword"
                  v-model="passwordData.new_password"
                  type="password"
                  :class="{ 'error': passwordErrors.new_password }"
                />
                <div v-if="passwordErrors.new_password" class="profile-error-message">
                  {{ passwordErrors.new_password }}
                </div>
                <div class="password-hint">
                  Password must be at least 8 characters long
                </div>
              </div>

              <div class="profile-form-group">
                <label for="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  v-model="passwordData.confirm_password"
                  type="password"
                  :class="{ 'error': passwordErrors.confirm_password }"
                />
                <div v-if="passwordErrors.confirm_password" class="profile-error-message">
                  {{ passwordErrors.confirm_password }}
                </div>
              </div>

              <div class="profile-form-actions">
                <button
                  type="submit"
                  :disabled="isChangingPassword || !isPasswordFormValid"
                  class="profile-btn profile-btn-primary"
                >
                  <span v-if="isChangingPassword" class="profile-loading"></span>
                  Change Password
                </button>
              </div>
            </form>
          </div>

          <!-- Danger Zone -->
          <div class="profile-card danger-zone">
            <h2 class="profile-card-title">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.86-.833-2.632 0L4.282 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Danger Zone
            </h2>
            <p class="danger-warning">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button
              @click="showDeleteConfirmation = true"
              class="profile-btn profile-btn-danger"
              type="button"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirmation" class="profile-modal-overlay">
      <div class="profile-modal">
        <h3 class="profile-modal-title">Delete Account</h3>
        <p class="profile-modal-text">
          Are you sure you want to delete your account? This action cannot be undone.
          All your data will be permanently removed.
        </p>

        <div class="profile-modal-form">
          <div class="profile-form-group">
            <label for="deletePassword">Confirm your password to delete account</label>
            <input
              id="deletePassword"
              v-model="deletePassword"
              type="password"
              placeholder="Enter your current password"
              :class="{ 'error': deleteError }"
            />
            <div v-if="deleteError" class="profile-error-message">
              {{ deleteError }}
            </div>
          </div>
        </div>

        <div class="profile-modal-actions">
          <button
            type="button"
            @click="showDeleteConfirmation = false"
            class="profile-btn profile-btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="deleteAccount"
            :disabled="isDeletingAccount || !deletePassword"
            class="profile-btn profile-btn-danger"
          >
            <span v-if="isDeletingAccount" class="profile-loading"></span>
            Delete Account
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { userService, type UpdateProfileRequest, type ChangePasswordRequest } from '@/services/user.service';
import { mediaService } from '@/services/media.service';
import ProfileAvatar from '@/components/ProfileAvatar.vue';
import '@/assets/css/profile.css';

const router = useRouter();
const authStore = useAuthStore();

// Profile data
const profileData = reactive({
  user_id: '',
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  gender: '' as 'M' | 'F' | '',
  image_url: '',
  is_email_verified: false,
  date_joined: '',
  last_updated: ''
});

// Edit state
const isEditing = ref(false);
const isUpdating = ref(false);
const isChangingPassword = ref(false);
const isDeletingAccount = ref(false);

// Edit form data
const editData = reactive({
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  gender: '' as 'M' | 'F' | ''
});

// Password form data
const passwordData = reactive({
  current_password: '',
  new_password: '',
  confirm_password: ''
});

// Delete account
const showDeleteConfirmation = ref(false);
const deletePassword = ref('');

// Availability checks
const usernameAvailable = ref<boolean | null>(null);
const emailAvailable = ref<boolean | null>(null);

// Upload state
const uploadProgress = ref(0);
const uploadError = ref('');

// Error states
const fieldErrors = reactive({
  username: '',
  email: '',
  first_name: '',
  last_name: ''
});

const passwordErrors = reactive({
  current_password: '',
  new_password: '',
  confirm_password: ''
});

const deleteError = ref('');

// Validation
const isFormValid = computed(() => {
  return editData.username && editData.email &&
         (!fieldErrors.username && !fieldErrors.email);
});

const isPasswordFormValid = computed(() => {
  return passwordData.current_password &&
         passwordData.new_password &&
         passwordData.confirm_password &&
         passwordData.new_password === passwordData.confirm_password &&
         passwordData.new_password.length >= 8;
});

// Load profile data
const loadProfileData = async () => {
  if (!authStore.user?.id) {
    router.push('/login');
    return;
  }

  try {
    const userProfile = await userService.getUserProfile(authStore.user.id);
    Object.assign(profileData, userProfile);

    // Reset edit data
    Object.assign(editData, {
      username: userProfile.username,
      email: userProfile.email,
      first_name: userProfile.first_name || '',
      last_name: userProfile.last_name || '',
      gender: userProfile.gender || ''
    });
  } catch (error) {
    console.error('Failed to load profile:', error);
    alert('Failed to load profile data. Please try again.');
  }
};

// Start editing
const startEditing = () => {
  isEditing.value = true;
  usernameAvailable.value = null;
  emailAvailable.value = null;
  clearFieldErrors();
};

// Cancel editing
const cancelEditing = () => {
  isEditing.value = false;
  Object.assign(editData, {
    username: profileData.username,
    email: profileData.email,
    first_name: profileData.first_name || '',
    last_name: profileData.last_name || '',
    gender: profileData.gender || ''
  });
};

// Update profile
const updateProfile = async () => {
  if (!isFormValid.value) return;

  isUpdating.value = true;
  clearFieldErrors();

  try {
    const updateData: UpdateProfileRequest = {
      username: editData.username.toLowerCase(),
      email: editData.email.toLowerCase(),
      first_name: editData.first_name,
      last_name: editData.last_name,
      gender: editData.gender || undefined
    };

    await authStore.updateProfile(profileData.user_id, updateData);

    // Reload profile data
    await loadProfileData();
    isEditing.value = false;

    // Show success message
    alert('Profile updated successfully!');
  } catch (error: any) {
    console.error('Update failed:', error);

    // Handle specific errors
    if (error.status === 409) {
      if (error.data?.error?.includes('Username')) {
        fieldErrors.username = 'Username already taken';
      } else if (error.data?.error?.includes('Email')) {
        fieldErrors.email = 'Email already registered';
      }
    } else {
      alert('Failed to update profile. Please try again. Error: ' + error.message);
    }
  } finally {
    isUpdating.value = false;
  }
};

// Handle image upload
const handleImageUpload = async (file: File) => {
  if (!authStore.user?.id || !authStore.user?.username) {
    alert('Please login to upload profile picture');
    return;
  }

  uploadError.value = '';
  uploadProgress.value = 10; // Start progress

  try {
    // Simulate progress
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10;
      }
    }, 100);

    await authStore.uploadProfilePicture(
      authStore.user.id,
      authStore.user.username,
      file
    );

    clearInterval(progressInterval);
    uploadProgress.value = 100;

    // Reload profile data
    await loadProfileData();

    // Reset progress after delay
    setTimeout(() => {
      uploadProgress.value = 0;
    }, 1000);

    alert('Profile picture updated successfully!');
  } catch (error: any) {
    console.error('Image upload failed:', error);
    uploadError.value = error.message || 'Failed to upload image';
    uploadProgress.value = 0;
  }
};

// Handle image removal
const handleImageRemove = async () => {
  if (!authStore.user?.id) {
    alert('Please login to remove profile picture');
    return;
  }

  try {
    await authStore.deleteProfilePicture(authStore.user.id);

    // Reload profile data
    await loadProfileData();

    alert('Profile picture removed successfully!');
  } catch (error: any) {
    console.error('Image removal failed:', error);
    alert('Failed to remove profile picture. Please try again.');
  }
};

// Handle password change
const handleChangePassword = async () => {
  if (!isPasswordFormValid.value) {
    alert('Please fill all password fields correctly');
    return;
  }

  isChangingPassword.value = true;
  clearPasswordErrors();

  try {
    console.log('Changing password for user:', authStore.user?.id, 'Username:', profileData.username);

    const passwordChangeData: ChangePasswordRequest = {
      current_password: passwordData.current_password,
      new_password: passwordData.new_password,
      confirm_password: passwordData.confirm_password
    };

    await authStore.changePassword(profileData.user_id, passwordChangeData);

    // Clear form
    Object.assign(passwordData, {
      current_password: '',
      new_password: '',
      confirm_password: ''
    });

    alert('Password changed successfully!');
  } catch (error: any) {
    console.error('Password change failed:', error);

    if (error.message.includes('Current password is incorrect')) {
      passwordErrors.current_password = 'Current password is incorrect';
    } else if (error.message.includes('New passwords do not match')) {
      passwordErrors.confirm_password = 'New passwords do not match';
    } else if (error.message.includes('must be at least 8 characters')) {
      passwordErrors.new_password = 'Password must be at least 8 characters long';
    } else if (error.message.includes('Authentication token')) {
      alert('Session expired. Please login again.');
      await authStore.logout();
      router.push('/login');
    } else {
      alert('Failed to change password. Please try again. Error: ' + error.message);
    }
  } finally {
    isChangingPassword.value = false;
  }
};

// Delete account
const deleteAccount = async () => {
  if (!deletePassword.value) {
    deleteError.value = 'Please enter your password';
    return;
  }

  isDeletingAccount.value = true;
  deleteError.value = '';

  try {
    console.log('Deleting account with username:', profileData.username);

    await authStore.deleteAccount(deletePassword.value);

    // Clear modal
    showDeleteConfirmation.value = false;
    deletePassword.value = '';

    // User will be redirected to login by the auth store
    alert('Your account has been deleted successfully.');
  } catch (error: any) {
    console.error('Account deletion failed:', error);

    if (error.message.includes('Invalid password')) {
      deleteError.value = 'Invalid password';
    } else if (error.message.includes('User not found')) {
      deleteError.value = 'User not found';
    } else if (error.message.includes('Authentication token')) {
      deleteError.value = 'Session expired. Please login again.';
      setTimeout(() => {
        authStore.logout();
        router.push('/login');
      }, 2000);
    } else {
      deleteError.value = 'Failed to delete account. Please try again.';
    }
  } finally {
    isDeletingAccount.value = false;
  }
};

// Check username availability
const checkUsernameAvailability = async () => {
  if (!editData.username || editData.username === profileData.username) {
    usernameAvailable.value = null;
    return;
  }

  try {
    const response = await userService.checkUsername(editData.username.toLowerCase());
    usernameAvailable.value = response.available;

    if (!response.available) {
      fieldErrors.username = 'Username already taken';
    } else {
      fieldErrors.username = '';
    }
  } catch (error) {
    console.error('Username check failed:', error);
    usernameAvailable.value = null;
  }
};

// Check email availability
const checkEmailAvailability = async () => {
  if (!editData.email || editData.email === profileData.email) {
    emailAvailable.value = null;
    return;
  }

  try {
    const response = await userService.checkEmail(editData.email.toLowerCase());
    emailAvailable.value = response.available;

    if (!response.available) {
      fieldErrors.email = 'Email already registered';
    } else {
      fieldErrors.email = '';
    }
  } catch (error) {
    console.error('Email check failed:', error);
    emailAvailable.value = null;
  }
};

// Format date
const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
};

// Clear errors
const clearFieldErrors = () => {
  Object.keys(fieldErrors).forEach(key => {
    fieldErrors[key as keyof typeof fieldErrors] = '';
  });
};

const clearPasswordErrors = () => {
  Object.keys(passwordErrors).forEach(key => {
    passwordErrors[key as keyof typeof passwordErrors] = '';
  });
};

// Watch for auth changes
watch(() => authStore.user, (newUser) => {
  if (newUser?.id) {
    loadProfileData();
  }
});

// Load data on mount
onMounted(() => {
  if (authStore.user?.id) {
    loadProfileData();
  } else {
    router.push('/login');
  }
});
</script>
