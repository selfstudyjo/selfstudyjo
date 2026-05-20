<template>
  <div class="profile-avatar" :class="{ 'has-image': effectiveImageUrl }">
    <div v-if="effectiveImageUrl && !useFallback" class="avatar-image">
      <img
        :src="displayedImageUrl"
        :alt="altText"
        loading="eager"
        decoding="async"
        @error="handleImageError"
        @load="handleImageLoad"
      />
    </div>
    <div v-else class="avatar-initials" :style="avatarStyle">
      {{ initials }}
    </div>

    <!-- Upload overlay (only if editable) -->
    <div v-if="editable" class="avatar-overlay" @click="triggerFileInput">
      <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span>Change Photo</span>
    </div>

    <!-- File input (hidden) -->
    <input
      v-if="editable"
      ref="fileInput"
      type="file"
      accept="image/*"
      @change="handleFileChange"
      class="file-input"
    />

    <!-- Remove button (only if has image and editable) -->
    <button
      v-if="effectiveImageUrl && editable && !useFallback"
      @click="handleRemoveImage"
      class="remove-btn"
      type="button"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { getProxiedImageUrl, addCacheBuster } from '@/utils/imageUtils';

interface Props {
  imageUrl?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  editable?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  backgroundColor?: string;
  textColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  imageUrl: '',
  firstName: '',
  lastName: '',
  username: '',
  editable: false,
  size: 'lg',
  backgroundColor: '',
  textColor: ''
});

const emit = defineEmits<{
  'image-upload': [file: File];
  'image-remove': [];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const useFallback = ref(false);
const retryCount = ref(0);
const MAX_RETRIES = 2;
// The current `src` actually rendered (may include cache-buster on retry)
const displayedImageUrl = ref('');

const initials = computed(() => {
  if (props.firstName && props.lastName) {
    return `${props.firstName.charAt(0)}${props.lastName.charAt(0)}`.toUpperCase();
  } else if (props.firstName) {
    return props.firstName.charAt(0).toUpperCase();
  } else if (props.lastName) {
    return props.lastName.charAt(0).toUpperCase();
  } else if (props.username) {
    return props.username.charAt(0).toUpperCase();
  }
  return 'U';
});

const altText = computed(() => {
  if (props.firstName && props.lastName) {
    return `${props.firstName} ${props.lastName}'s profile picture`;
  } else if (props.firstName) {
    return `${props.firstName}'s profile picture`;
  } else if (props.lastName) {
    return `${props.lastName}'s profile picture`;
  }
  return 'Profile picture';
});

const proxiedImageUrl = computed(() => getProxiedImageUrl(props.imageUrl));

const effectiveImageUrl = computed(() => {
  if (useFallback.value) return '';
  return proxiedImageUrl.value;
});

const avatarStyle = computed(() => {
  const styles: Record<string, string> = {};
  const sizeMap = { sm: '32px', md: '48px', lg: '80px', xl: '120px' };
  styles.width = sizeMap[props.size] || '80px';
  styles.height = sizeMap[props.size] || '80px';
  styles.fontSize = props.size === 'sm' ? '12px' :
                    props.size === 'md' ? '16px' :
                    props.size === 'lg' ? '24px' : '32px';
  styles.lineHeight = styles.height;
  if (props.backgroundColor) styles.backgroundColor = props.backgroundColor;
  if (props.textColor) styles.color = props.textColor;
  return styles;
});

const handleImageLoad = () => {
  // success — reset retry counter in case URL changes later
  retryCount.value = 0;
};

const handleImageError = () => {
  if (retryCount.value < MAX_RETRIES && proxiedImageUrl.value) {
    retryCount.value++;
    // Retry with a cache-buster to bypass any stale 4xx in browser cache
    setTimeout(() => {
      displayedImageUrl.value = addCacheBuster(proxiedImageUrl.value);
    }, 250 * retryCount.value);
    return;
  }
  console.warn('Profile image failed to load, using initials fallback:', props.imageUrl);
  useFallback.value = true;
};

const triggerFileInput = () => {
  if (props.editable && fileInput.value) fileInput.value.click();
};

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }
    emit('image-upload', file);
    if (fileInput.value) fileInput.value.value = '';
    useFallback.value = false;
    retryCount.value = 0;
  }
};

const handleRemoveImage = () => {
  if (confirm('Are you sure you want to remove your profile picture?')) {
    emit('image-remove');
    useFallback.value = false;
    retryCount.value = 0;
  }
};

// Watch for URL changes — reset retry / fallback flags and refresh displayed URL
watch(
  () => props.imageUrl,
  () => {
    useFallback.value = false;
    retryCount.value = 0;
    displayedImageUrl.value = proxiedImageUrl.value || '';
  },
  { immediate: true }
);

onMounted(() => {
  useFallback.value = false;
  retryCount.value = 0;
  displayedImageUrl.value = proxiedImageUrl.value || '';
});
</script>

<style scoped>
.profile-avatar {
  position: relative;
  display: inline-block;
  border-radius: 50%;
  overflow: visible;
  cursor: default;
  isolation: isolate;
}

.profile-avatar.has-image,
.profile-avatar:not(.has-image) {
  filter: drop-shadow(0 8px 28px rgba(102, 126, 234, 0.35));
}

.avatar-image,
.avatar-initials {
  border-radius: 50%;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border: 2px solid rgba(255, 255, 255, 0.22);
  box-shadow:
    0 0 0 1px rgba(102, 126, 234, 0.3) inset,
    0 0 24px rgba(118, 75, 162, 0.25);
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.avatar-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block;
}

.avatar-initials {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: 700;
  text-align: center;
  user-select: none;
  border: 2px solid rgba(255, 255, 255, 0.22);
  box-shadow:
    inset 0 2px 12px rgba(255, 255, 255, 0.18),
    0 0 24px rgba(102, 126, 234, 0.35);
}

.profile-avatar:hover .avatar-image,
.profile-avatar:hover .avatar-initials {
  border-color: rgba(78, 205, 196, 0.7);
  box-shadow:
    0 0 0 1px rgba(78, 205, 196, 0.4) inset,
    0 0 32px rgba(78, 205, 196, 0.35);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #fff;
  background: rgba(10, 10, 30, 0.55);
  backdrop-filter: blur(8px) saturate(160%);
  -webkit-backdrop-filter: blur(8px) saturate(160%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
  cursor: pointer;
}

.profile-avatar:hover .avatar-overlay,
.profile-avatar:focus-within .avatar-overlay {
  opacity: 1;
}

.avatar-overlay .icon {
  width: 24px;
  height: 24px;
  filter: drop-shadow(0 0 6px rgba(78, 205, 196, 0.6));
}

.avatar-overlay span {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  text-align: center;
  padding: 0 10px;
}

.remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, #f56565, #c53030);
  box-shadow: 0 6px 18px rgba(252, 129, 129, 0.45);
  cursor: pointer;
  opacity: 0.95;
  transition: transform 0.25s ease, box-shadow 0.25s ease, opacity 0.25s ease;
  z-index: 10;
}

.remove-btn:hover {
  opacity: 1;
  transform: scale(1.08);
  box-shadow: 0 8px 24px rgba(252, 129, 129, 0.6);
}

.remove-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.remove-btn .icon {
  width: 16px;
  height: 16px;
}

.file-input {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .avatar-overlay,
  .remove-btn,
  .avatar-image,
  .avatar-initials {
    transition: none;
  }
  .remove-btn:hover { transform: none; }
}
</style>