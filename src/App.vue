<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useAuthStore } from './store/auth';
import { useNotificationStore } from './store/notifications';

const authStore = useAuthStore();
const notificationStore = useNotificationStore();

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

    // Load notifications for the new user
    notificationStore.loadFromLocalStorage(newUser.username);
    notificationStore.fetchNotificationCount(newUser.username);
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
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --secondary-gradient: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  --success-gradient: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  --warning-gradient: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
  --danger-gradient: linear-gradient(135deg, #fc8181 0%, #f56565 100%);
  --info-gradient: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #1a202c;
  background: #f7fafc;
  overflow-x: hidden;
}

#app {
  min-height: 100vh;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
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
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
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
  outline: 2px solid #667eea;
  outline-offset: 2px;
}

/* Loading states */
.loading {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
