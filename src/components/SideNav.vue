<template>
  <div class="app-container">
    <!-- Mobile Toggle Button (only visible on mobile) -->
    <button
      v-if="isMobile && !sidebarVisible"
      class="mobile-toggle"
      @click="openSidebar"
      aria-label="Open navigation menu"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 6V8H21V6H3Z" fill="currentColor"/>
      </svg>
    </button>

    <aside :class="['sidebar', { 'collapsed': isCollapsed, 'active': sidebarVisible }]">
      <div class="sidebar-header">
        <!-- Logo - Only shown when sidebar is expanded -->
        <div class="logo" @click="toggleSidebar" v-if="!isCollapsed">
          <div class="logo-icon">🎓</div>
          <span class="logo-text">Self Study JO</span>
        </div>

        <!-- Toggle Button - Always visible -->
        <button
          class="sidebar-toggle"
          @click="toggleSidebar"
          :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 6V8H21V6H3Z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      <nav class="sidebar-nav">
        <!-- Public Navigation Items (always visible) -->
        <div v-for="item in publicNavItems" :key="item.to">
          <router-link
            :to="item.to"
            class="nav-item"
            :class="{ 'active': isActive(item.to) }"
            :aria-current="isActive(item.to) ? 'page' : null"
            @click="closeSidebarOnMobile"
          >
            <div class="nav-icon">
              <component :is="item.icon" />
            </div>
            <span class="nav-text">{{ item.text }}</span>
          </router-link>
        </div>

        <!-- Private Navigation Items (only when authenticated) -->
        <template v-if="isAuthenticated">
          <router-link
            v-for="item in privateNavItems"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ 'active': isActive(item.to) }"
            :aria-current="isActive(item.to) ? 'page' : null"
            @click="closeSidebarOnMobile"
          >
            <div class="nav-icon">
              <component :is="item.icon" />
            </div>
            <span class="nav-text">{{ item.text }}</span>

            <!-- Notification badge -->
            <span
              v-if="item.to === '/notifications' && displayCount > 0"
              class="notification-badge"
              :aria-label="`${displayCount} unread notifications`"
            >
              {{ displayCount > 99 ? '99+' : displayCount }}
            </span>
          </router-link>

          <!-- Labs item -->
          <router-link
            v-if="hasLabAccess"
            to="/labs"
            class="nav-item"
            :class="{ 'active': isActive('/labs') }"
            @click="closeSidebarOnMobile"
          >
            <div class="nav-icon">
              <LabIcon />
            </div>
            <span class="nav-text">Labs</span>
          </router-link>
        </template>
      </nav>

      <div class="sidebar-footer">
        <!-- User Profile Section (only when authenticated) -->
        <template v-if="isAuthenticated">
          <div class="user-profile" @click="goToProfile">
            <div class="avatar">
              <!-- Profile Image with proxy and error fallback -->
              <img
                v-if="proxiedImageUrl && !avatarError"
                :src="proxiedImageUrl"
                :alt="username"
                class="profile-image"
                @error="avatarError = true"
              />
              <span v-else>{{ userInitials }}</span>
            </div>
            <div v-if="!isCollapsed" class="user-info">
              <p class="username">{{ username }}</p>
              <p class="email">{{ userEmail }}</p>
              <div
                class="notification-summary"
                @click.stop="goToNotifications"
                v-if="displayCount > 0"
                :aria-label="`${displayCount} unread notifications`"
              >
                <span class="notification-icon">🔔</span>
                <span class="notification-count">{{ displayCount }} unread</span>
              </div>
            </div>
          </div>

          <button class="logout-btn" @click="handleLogout">
            <div class="logout-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.58L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
              </svg>
            </div>
            <span v-if="!isCollapsed">Logout</span>
          </button>
        </template>

        <!-- Login Button (only when NOT authenticated) -->
        <template v-else>
          <router-link
            to="/login"
            class="login-btn"
            @click="closeSidebarOnMobile"
          >
            <div class="login-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" fill="currentColor"/>
              </svg>
            </div>
            <span v-if="!isCollapsed">Login</span>
          </router-link>
        </template>
      </div>
    </aside>

    <!-- Overlay for mobile when sidebar is open -->
    <div
      v-if="isMobile && sidebarVisible"
      class="sidebar-overlay"
      @click="closeSidebar"
    ></div>

    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notifications';
import { getProxiedImageUrl } from '@/utils/imageUtils';

// Icons (simplified versions)
const DashboardIcon = {
  name: 'DashboardIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'
      })
    ]);
  }
};

const CoursesIcon = {
  name: 'CoursesIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2'
    }, [
      h('path', {
        d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
      })
    ]);
  }
};

const ProfileIcon = {
  name: 'ProfileIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'
      })
    ]);
  }
};

const NotificationsIcon = {
  name: 'NotificationsIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'
      })
    ]);
  }
};

const ExamsIcon = {
  name: 'ExamsIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M13 11h-2v2h2v-2zm0-6h-2v4h2V5zm4.83 2.17L16.41 5.75 18 4.16l1.41 1.41-1.58 1.58zM20 12h4v2h-4v-2zm-9 7h2v2h-2v-2zM4 12h4v2H4v-2zm1.17-4.83L3.59 5.75 5 4.34l1.41 1.41-1.58 1.58zm14.66 8.66L17.41 18.08 19 19.66l1.41-1.41-1.58-1.58z'
      })
    ]);
  }
};

const CertificateIcon = {
  name: 'CertificateIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M4 3h16c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm0 2v2h16V5H4zm0 4v2h16V9H4zm0 4v2h16v-2H4zm0 4v2h16v-2H4z'
      }),
      h('rect', {
        x: '7',
        y: '11',
        width: '10',
        height: '2',
        'fill-opacity': '0.5'
      }),
      h('rect', {
        x: '7',
        y: '15',
        width: '10',
        height: '2',
        'fill-opacity': '0.5'
      })
    ]);
  }
};

const AllCertificatesIcon = {
  name: 'AllCertificatesIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10zm-3-4H7v2h10v-2zm0-4H7v2h10v-2z'
      })
    ]);
  }
};

const ProctorDashboardIcon = {
  name: 'ProctorDashboardIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'
      })
    ]);
  }
};

const RunbooksIcon = {
  name: 'RunbooksIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V7h2v4zm4 0h-4V7h4v4z'
      })
    ]);
  }
};

const LabIcon = {
  name: 'LabIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M19 6h-4V2H9v4H5v15h14V6zM9 4h6v2H9V4zm11 15H5V8h14v11zm-12-9h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8 4h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z'
      })
    ]);
  }
};

const PlansIcon = {
  name: 'PlansIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10zm-8-6H8v2h4v-2zm0-4H8v2h4V8z'
      })
    ]);
  }
};

const MyPlansIcon = {
  name: 'MyPlansIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z'
      })
    ]);
  }
};

// ===== NEW ICON FOR MY RESULTS =====
const ResultsIcon = {
  name: 'ResultsIcon',
  render() {
    return h('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z'
      })
    ]);
  }
};

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const isCollapsed = ref(false);
const isMobile = ref(false);
const sidebarVisible = ref(false);
const avatarError = ref(false);
let pollInterval: number | null = null;

onMounted(() => {
  checkIfMobile();
  window.addEventListener('resize', checkIfMobile);

  if (!authStore.isAuthenticated && authStore.token) {
    authStore.checkAuth().catch(err => {
      console.log('Initial auth check failed:', err);
    });
  }

  if (authStore.isAuthenticated) {
    initializeNotifications();
  }

  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  stopPolling();
  window.removeEventListener('resize', checkIfMobile);
  document.removeEventListener('click', handleClickOutside);
});

function checkIfMobile() {
  isMobile.value = window.innerWidth <= 768;
  if (!isMobile.value) {
    sidebarVisible.value = false;
  }
}

const isAuthenticated = computed(() => authStore.isAuthenticated);

const hasLabAccess = computed(() => {
  return authStore.user?.lab_url && authStore.user?.lab_url.trim() !== '';
});

const isProctor = computed(() => authStore.isProctor);

const publicNavItems = computed(() => {
  const items = [
    { to: '/courses', text: 'Courses', icon: CoursesIcon },
    { to: '/runbooks', text: 'Runbooks', icon: RunbooksIcon },
    { to: '/exams', text: 'Exams', icon: ExamsIcon },
    { to: '/plans', text: 'Plans', icon: PlansIcon },
    { to: '/all-certificates', text: 'All Certificates', icon: AllCertificatesIcon },
  ];
  return items;
});

const privateNavItems = computed(() => {
  const items = [
    { to: '/', text: 'Dashboard', icon: DashboardIcon },
    { to: '/notifications', text: 'Notifications', icon: NotificationsIcon },
    { to: '/my-plans', text: 'My Plans', icon: MyPlansIcon },
    { to: '/certificates', text: 'My Certificates', icon: CertificateIcon },
    // ===== NEW ITEM =====
    { to: '/my-results', text: 'My Results', icon: ResultsIcon },
    { to: '/profile', text: 'Profile', icon: ProfileIcon },
  ];

  if (isProctor.value) {
    items.splice(1, 0, { to: '/proctor-dashboard', text: 'Proctor Dashboard', icon: ProctorDashboardIcon });
  }

  return items;
});

const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(path);
};

const toggleSidebar = () => {
  if (isMobile.value) {
    sidebarVisible.value = !sidebarVisible.value;
    if (!sidebarVisible.value) {
      isCollapsed.value = false;
    }
  } else {
    isCollapsed.value = !isCollapsed.value;
  }
};

const openSidebar = () => {
  sidebarVisible.value = true;
  isCollapsed.value = false;
};

const closeSidebar = () => {
  sidebarVisible.value = false;
};

const closeSidebarOnMobile = () => {
  if (isMobile.value) {
    closeSidebar();
  }
};

function handleClickOutside(event: MouseEvent) {
  if (isMobile.value && sidebarVisible.value) {
    const sidebar = document.querySelector('.sidebar');
    const target = event.target as HTMLElement;

    if (sidebar && !sidebar.contains(target) && !target.closest('.mobile-toggle')) {
      closeSidebar();
    }
  }
}

const username = computed(() => {
  return authStore.user?.username || 'User';
});

const userEmail = computed(() => {
  return authStore.user?.email || '';
});

const userInitials = computed(() => {
  const name = username.value;
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

const proxiedImageUrl = computed(() => {
  if (!authStore.user?.image_url) return '';
  return getProxiedImageUrl(authStore.user.image_url);
});

const displayCount = computed(() => {
  return notificationStore.unreadCount;
});

function initializeNotifications() {
  if (username.value) {
    notificationStore.loadFromLocalStorage(username.value);
    notificationStore.fetchNotificationCount(username.value);
    startPolling();
  }
}

function startPolling() {
  stopPolling();

  if (!username.value) return;

  pollInterval = window.setInterval(() => {
    if (username.value) {
      notificationStore.fetchNotificationCount(username.value);
    }
  }, 30000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function goToNotifications() {
  router.push('/notifications');
  if (isMobile.value) {
    closeSidebar();
  }
}

function goToProfile() {
  router.push('/profile');
  if (isMobile.value) {
    closeSidebar();
  }
}

const handleLogout = async () => {
  try {
    stopPolling();
    notificationStore.clearAllNotifications();
    await authStore.logout();
    router.push('/login');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};

watch(() => authStore.isAuthenticated, (newValue) => {
  if (newValue && username.value) {
    initializeNotifications();
  } else {
    stopPolling();
    notificationStore.clearAllNotifications();
  }
});

watch(username, (newUsername, oldUsername) => {
  if (newUsername) {
    if (oldUsername && oldUsername !== newUsername) {
      notificationStore.clearUserNotifications(oldUsername);
    }
    initializeNotifications();
  } else {
    stopPolling();
    notificationStore.clearAllNotifications();
  }
});

watch(() => route.path, () => {
  if (authStore.isAuthenticated && username.value) {
    setTimeout(() => {
      notificationStore.fetchNotificationCount(username.value);
    }, 1000);
  }
});

watch(() => authStore.user, () => {
  avatarError.value = false;
});
</script>

<style src="@/assets/css/side-nav.css"></style>