<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useAuthStore } from './store/auth';
import { useNotificationStore } from './store/notifications';
import { useThemeStore } from './store/theme';

const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const themeStore = useThemeStore();

// `main.ts` already applied the stored galaxy to the document before mount, so
// there is no flash to avoid here. This brings the store into line with what
// is on screen — without it the picker would open showing Andromeda selected
// while the page is painted in something else.
themeStore.initTheme();

onMounted(() => {
  // Initialize authentication from localStorage
  authStore.initAuth();
});

// Watch for user changes
watch(() => authStore.user, (newUser, oldUser) => {
  if (newUser && newUser.username) {
    // If user changed, clear old user's notifications
    if (oldUser && oldUser.username !== newUser.username) {
      notificationStore.clearUserNotifications(oldUser.username);
    }

    // Load notifications for the new user. `start` also begins the poll and the
    // chime, which is what makes the bell ring on a screen the sidebar is not
    // on — the login page redirect, most obviously. Calling it twice is safe:
    // it stops whatever was running first.
    notificationStore.start(newUser.username);
  } else {
    // Clear notifications when user logs out
    notificationStore.clearAllNotifications();
  }
}, { immediate: true });
</script>

<style>
/* Your existing styles remain the same */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-gradient: linear-gradient(135deg, var(--sfs-accent, #667eea) 0%, var(--sfs-accent-2, #764ba2) 100%);
  --secondary-gradient: linear-gradient(135deg, var(--sfs-accent, #4f46e5) 0%, var(--sfs-accent-2, #7c3aed) 100%);
  --success-gradient: linear-gradient(135deg, var(--sfs-success, #48bb78) 0%, var(--sfs-success, #38a169) 100%);
  --warning-gradient: linear-gradient(135deg, var(--sfs-warning, #ed8936) 0%, var(--sfs-warning, #dd6b20) 100%);
  --danger-gradient: linear-gradient(135deg, var(--sfs-danger, #fc8181) 0%, var(--sfs-danger, #f56565) 100%);
  --info-gradient: linear-gradient(135deg, var(--sfs-info, #0ea5e9) 0%, var(--sfs-accent, #3b82f6) 100%);
}

/* Body background is handled by src/style.css – do not add any body styles here */

#app {
  min-height: 100vh;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--sfs-paper, #f1f1f1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--sfs-paper-3, #c1c1c1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Utility classes */
.text-gradient {
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.card-shadow {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease;
}

.card-shadow:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
}

.glass-effect {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);
}

/* Responsive design */
@media (max-width: 768px) {
  .hide-on-mobile {
    display: none !important;
  }
}

@media (min-width: 769px) {
  .hide-on-desktop {
    display: none !important;
  }
}

/* Print styles */
@media print {
  .no-print {
    display: none !important;
  }
}

/* Focus styles */
:focus-visible {
  outline: 2px solid var(--sfs-accent, #667eea);
  outline-offset: 2px;
}

/* Loading states */
.loading {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--sfs-border-strong, #e2e8f0);
  border-top-color: var(--sfs-accent, #667eea);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>