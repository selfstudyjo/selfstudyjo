<template>
  <div class="profile-avatar" :class="{ 'has-image': effectiveImageUrl }">
    <div v-if="effectiveImageUrl && !useFallback" class="avatar-image">
      <img
        :src="effectiveImageUrl"
        :alt="altText"
        @error="handleImageError"
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
import { ref, computed, onMounted } from 'vue';
import { getProxiedImageUrl } from '@/utils/imageUtils';

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

// Apply proxy to the original image URL
const proxiedImageUrl = computed(() => getProxiedImageUrl(props.imageUrl));

// Determine which URL to use (proxied or fallback initials)
const effectiveImageUrl = computed(() => {
  if (useFallback.value) {
    return generateInitialsImage(initials.value, 200);
  }
  return proxiedImageUrl.value;
});

const avatarStyle = computed(() => {
  const styles: Record<string, string> = {};

  const sizeMap = {
    sm: '32px',
    md: '48px',
    lg: '80px',
    xl: '120px'
  };

  styles.width = sizeMap[props.size] || '80px';
  styles.height = sizeMap[props.size] || '80px';
  styles.fontSize = props.size === 'sm' ? '12px' :
                    props.size === 'md' ? '16px' :
                    props.size === 'lg' ? '24px' : '32px';
  styles.lineHeight = styles.height;

  if (props.backgroundColor) {
    styles.backgroundColor = props.backgroundColor;
  }
  if (props.textColor) {
    styles.color = props.textColor;
  }

  return styles;
});

const handleImageError = () => {
  console.warn('Profile image failed to load, using fallback initials:', props.imageUrl);
  useFallback.value = true;
};

const triggerFileInput = () => {
  if (props.editable && fileInput.value) {
    fileInput.value.click();
  }
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
    // Reset input
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    // Reset fallback state in case new image is uploaded
    useFallback.value = false;
  }
};

const handleRemoveImage = () => {
  if (confirm('Are you sure you want to remove your profile picture?')) {
    emit('image-remove');
    useFallback.value = false;
  }
};

function generateInitialsImage(initials: string, size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const hue = (initials.charCodeAt(0) * 10) % 360;
  const color = `hsl(${hue}, 70%, 60%)`;

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, size / 2, size / 2);

  return canvas.toDataURL('image/png');
}

onMounted(() => {
  useFallback.value = false;
});
</script>

<style scoped>
.profile-avatar {
  position: relative;
  display: inline-block;
  border-radius: 50%;
  overflow: hidden;
  cursor: default;
}

.profile-avatar.editable {
  cursor: pointer;
}

.avatar-image {
  width: 100%;
  height: 100%;
}

.avatar-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-initials {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: bold;
  text-align: center;
  user-select: none;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 50%;
  cursor: pointer;
}

.profile-avatar:hover .avatar-overlay {
  opacity: 1;
}

.avatar-overlay .icon {
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
}

.avatar-overlay span {
  font-size: 12px;
  text-align: center;
}

.remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f56565;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
  transition: all 0.3s ease;
  z-index: 10;
}

.remove-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.remove-btn .icon {
  width: 16px;
  height: 16px;
}

.file-input {
  display: none;
}
</style>
