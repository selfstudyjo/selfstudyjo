<template>
  <div class="app-container">
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
        <div class="logo" @click="toggleSidebar" v-if="!isCollapsed">
          <div class="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
            </svg>
          </div>
          <span class="logo-text">Self Study JO</span>
        </div>
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

      <div class="sidebar-search" v-if="!isCollapsed">
        <div class="search-field" :class="{ 'has-query': !!searchQuery }">
          <span class="search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4.35-4.35" />
            </svg>
          </span>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search pages…"
            aria-label="Search navigation"
            autocomplete="off"
            spellcheck="false"
            @keydown.down.prevent="moveHighlight(1)"
            @keydown.up.prevent="moveHighlight(-1)"
            @keydown.enter.prevent="openHighlighted"
            @keydown.esc.prevent="onSearchEscape"
          />
          <button
            v-if="searchQuery"
            class="search-clear"
            type="button"
            aria-label="Clear search"
            @click="clearSearch"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <kbd v-else class="search-kbd">{{ searchShortcutLabel }}</kbd>
        </div>
        <p class="sr-only" aria-live="polite">
          {{ searchQuery ? `${filteredNavItems.length} pages match ${searchQuery}` : '' }}
        </p>
      </div>
      <button
        v-else
        class="rail-search-btn"
        type="button"
        aria-label="Search navigation"
        @click="focusSearch"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.35-4.35" />
        </svg>
      </button>

      <nav class="sidebar-nav">
        <router-link
          v-for="(item, index) in filteredNavItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ 'active': isActive(item.to), 'highlighted': index === highlightIndex }"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          @click="onNavClick"
        >
          <div class="nav-icon">
            <component :is="item.icon" />
          </div>
          <span class="nav-text"><span v-for="(part, i) in matchParts(item.text)" :key="i" :class="{ 'nav-text-match': part.match }">{{ part.text }}</span></span>
          <span
            v-if="item.to === '/notifications' && displayCount > 0"
            class="notification-badge"
            :aria-label="`${displayCount} unread notifications`"
          >
            {{ displayCount > 99 ? '99+' : displayCount }}
          </span>
          <span
            v-else-if="item.to === '/messages' && unreadMessages > 0"
            class="notification-badge"
            :aria-label="`${unreadMessages} unread messages`"
          >
            {{ chatStore.badge }}
          </span>
        </router-link>

        <p v-if="searchQuery && !filteredNavItems.length" class="nav-empty">
          No pages match “{{ searchQuery }}”
        </p>
      </nav>

      <div class="sidebar-footer">
        <template v-if="isAuthenticated">
          <div class="user-profile" @click="goToProfile">
            <div class="avatar">
              <img
                v-if="displayedAvatarUrl && !avatarError"
                :src="displayedAvatarUrl"
                :alt="username"
                class="profile-image"
                loading="eager"
                decoding="async"
                @error="handleAvatarError"
                @load="handleAvatarLoad"
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
                <span class="notification-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                  </svg>
                </span>
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
        <template v-else>
          <router-link to="/login" class="login-btn" @click="closeSidebarOnMobile">
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
import { ref, computed, h, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notifications';
import { useUserChatStore } from '@/store/userchat';
import { getProxiedImageUrl, addCacheBuster } from '@/utils/imageUtils';

const DashboardIcon = {
  name: 'DashboardIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' })
    ]);
  }
};

const CoursesIcon = {
  name: 'CoursesIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' })
    ]);
  }
};

const ProfileIcon = {
  name: 'ProfileIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' })
    ]);
  }
};

const NotificationsIcon = {
  name: 'NotificationsIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z' })
    ]);
  }
};

const ExamsIcon = {
  name: 'ExamsIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M13 11h-2v2h2v-2zm0-6h-2v4h2V5zm4.83 2.17L16.41 5.75 18 4.16l1.41 1.41-1.58 1.58zM20 12h4v2h-4v-2zm-9 7h2v2h-2v-2zM4 12h4v2H4v-2zm1.17-4.83L3.59 5.75 5 4.34l1.41 1.41-1.58 1.58zm14.66 8.66L17.41 18.08 19 19.66l1.41-1.41-1.58-1.58z' })
    ]);
  }
};

const CertificateIcon = {
  name: 'CertificateIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M4 3h16c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm0 2v2h16V5H4zm0 4v2h16V9H4zm0 4v2h16v-2H4zm0 4v2h16v-2H4z' }),
      h('rect', { x: '7', y: '11', width: '10', height: '2', 'fill-opacity': '0.5' }),
      h('rect', { x: '7', y: '15', width: '10', height: '2', 'fill-opacity': '0.5' })
    ]);
  }
};

const AllCertificatesIcon = {
  name: 'AllCertificatesIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10zm-3-4H7v2h10v-2zm0-4H7v2h10v-2z' })
    ]);
  }
};

const ProctorDashboardIcon = {
  name: 'ProctorDashboardIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' })
    ]);
  }
};

const RunbooksIcon = {
  name: 'RunbooksIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V7h2v4zm4 0h-4V7h4v4z' })
    ]);
  }
};

const LabIcon = {
  name: 'LabIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M19 6h-4V2H9v4H5v15h14V6zM9 4h6v2H9V4zm11 15H5V8h14v11zm-12-9h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8 4h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z' })
    ]);
  }
};

const PlansIcon = {
  name: 'PlansIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10zm-8-6H8v2h4v-2zm0-4H8v2h4V8z' })
    ]);
  }
};

const MyPlansIcon = {
  name: 'MyPlansIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z' })
    ]);
  }
};

const ResultsIcon = {
  name: 'ResultsIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z' })
    ]);
  }
};

const AIIcon = {
  name: 'AIIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-10H8v2h2v-2zm6 0h-2v2h2v-2zm-6 4H8v2h2v-2zm6 0h-2v2h2v-2z' })
    ]);
  }
};

const ResearchFlowIcon = {
  name: 'ResearchFlowIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M9 4v1.38c-.83-.33-1.72-.5-2.5-.5-1.79 0-3.5.72-3.5 2.38V19.5C3 20.88 4.28 21 5.5 21c.96 0 1.89-.12 2.5-.38V22h10v-7.5L21.5 18l-2-2 2-2L18 17.5V4H9zM7.17 14.5c-.83 0-1.67-.21-2.17-.6V8.4c.48-.36 1.3-.55 2.17-.55.83 0 1.63.18 2.33.55v5.53c-.73.36-1.52.57-2.33.57zM16 13h-4V5h4v8z' })
    ]);
  }
};

const ToastmastersIcon = {
  name: 'ToastmastersIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z' })
    ]);
  }
};

const JobInterviewIcon = {
  name: 'JobInterviewIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z' })
    ]);
  }
};

const RobloxIcon = {
  name: 'RobloxIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M4 4h16v16H4V4zm2 2v12h12V6H6zm3 3h6v6H9V9z' })
    ]);
  }
};

const CvBuilderIcon = {
  name: 'CvBuilderIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h8v1.5H8V13zm0 3h8v1.5H8V16zm0-6h3v1.5H8V10z' })
    ]);
  }
};

const MessagesIcon = {
  name: 'MessagesIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z' })
    ]);
  }
};

const DrawIcon = {
  name: 'DrawIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d: 'M3 21l3.5-1L18 8.5 15.5 6 4 17.5z' }),
      h('path', { d: 'M15.5 6l2-2a1.8 1.8 0 012.5 2.5l-2 2' }),
      h('path', { d: 'M13.5 8l2.5 2.5' })
    ]);
  }
};

const NetworkSimulatorIcon = {
  name: 'NetworkSimulatorIcon',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('rect', { x: '9', y: '2.5', width: '6', height: '5', rx: '1.4' }),
      h('rect', { x: '2', y: '16.5', width: '6', height: '5', rx: '1.4' }),
      h('rect', { x: '16', y: '16.5', width: '6', height: '5', rx: '1.4' }),
      h('path', { d: 'M12 7.5v3.5M5 16.5V11h14v5.5M12 11v5.5' })
    ]);
  }
};


const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const chatStore = useUserChatStore();

const isCollapsed = ref(true);
const isMobile = ref(false);
const sidebarVisible = ref(false);
const avatarError = ref(false);
const avatarRetryCount = ref(0);
const MAX_AVATAR_RETRIES = 2;
const displayedAvatarUrl = ref('');
let pollInterval: number | null = null;

onMounted(() => {
  checkIfMobile();
  window.addEventListener('resize', checkIfMobile);
  if (!authStore.isAuthenticated && authStore.token) {
    authStore.checkAuth().catch(err => console.log('Initial auth check failed:', err));
  }
  if (authStore.isAuthenticated) initializeNotifications();
  // The chime cannot play without a gesture behind it, and the browser gives no
  // error when it refuses - a chime that was never primed simply never sounds.
  // The first click anywhere in the app is that gesture.
  document.addEventListener('click', () => chatStore.primeAudio(), { once: true });
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleSearchShortcut);
  syncAvatarUrl();
});

onUnmounted(() => {
  stopPolling();
  chatStore.stop();
  window.removeEventListener('resize', checkIfMobile);
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleSearchShortcut);
});

function checkIfMobile() {
  isMobile.value = window.innerWidth <= 768;
  if (!isMobile.value) sidebarVisible.value = false;
}

const isAuthenticated = computed(() => authStore.isAuthenticated);
const hasLabAccess = computed(() => authStore.hasLabAccess);
const hasLabFeature = computed(() => authStore.hasLabFeature);
const hasAiAccess = computed(() => authStore.hasAiAccess);
const hasRunbookAccess = computed(() => authStore.hasRunbookAccess);
const hasResearchFlowAccess = computed(() => authStore.hasResearchFlowAccess);
const isProctor = computed(() => authStore.isProctor);
const hasToastmastersAccess = computed(() => authStore.hasToastmastersAccess);

interface NavItem {
  to: string;
  text: string;
  icon: any;
  /** Extra search terms so a page is findable by what it does, not only by its label. */
  keywords?: string;
}

const publicNavItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { to: '/courses', text: 'Courses', icon: CoursesIcon, keywords: 'learn lessons training catalog study' },
    ...(hasRunbookAccess.value ? [{ to: '/runbooks', text: 'Runbooks', icon: RunbooksIcon, keywords: 'procedures operations guides steps' }] : []),
    { to: '/exams', text: 'Exams', icon: ExamsIcon, keywords: 'tests quizzes assessments' },
    { to: '/plans', text: 'Plans', icon: PlansIcon, keywords: 'pricing packages subscribe subscription' },
    { to: '/all-certificates', text: 'All Certificates', icon: AllCertificatesIcon, keywords: 'credentials badges diplomas' },
  ];
  return items;
});

const privateNavItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { to: '/', text: 'Dashboard', icon: DashboardIcon, keywords: 'home overview start' },
    // Messages (app 35). Ungated like Drawing Papers — free with an account.
    // Deliberately in the *private* list rather than with the features: it is not
    // a tool somebody opens for a task, it is where they find out somebody is
    // trying to reach them, so it belongs next to Notifications.
    { to: '/messages', text: 'Messages', icon: MessagesIcon, keywords: 'chat conversation direct message dm talk classmates group voice picture free' },
    { to: '/notifications', text: 'Notifications', icon: NotificationsIcon, keywords: 'alerts inbox unread' },
    { to: '/my-plans', text: 'My Plans', icon: MyPlansIcon, keywords: 'subscription billing membership' },
    { to: '/certificates', text: 'My Certificates', icon: CertificateIcon, keywords: 'credentials badges diplomas' },
    { to: '/my-results', text: 'My Results', icon: ResultsIcon, keywords: 'scores grades marks exam history' },
    { to: '/profile', text: 'Profile', icon: ProfileIcon, keywords: 'account settings avatar password' },
  ];
  if (isProctor.value) {
    items.splice(1, 0, { to: '/proctor-dashboard', text: 'Proctor Dashboard', icon: ProctorDashboardIcon, keywords: 'monitor supervise invigilate exams' });
  }
  return items;
});

const featureNavItems = computed<NavItem[]>(() => [
  // Drawing Papers is listed with the tools but has no gate, deliberately: it is
  // free with an account, so there is no hasXAccess to consult. Every other entry
  // here is spread from a conditional, so an unconditional one reads like an
  // oversight — it is not.
  { to: '/draw', text: 'Drawing Papers', icon: DrawIcon, keywords: 'whiteboard draw paint canvas sketch diagram board collaborate free' },
  ...(hasLabAccess.value ? [{ to: '/labs', text: 'Labs', icon: LabIcon, keywords: 'practice sandbox hands on exercises' }] : []),
  ...(hasLabFeature.value ? [{ to: '/network-simulator', text: 'Network Simulator', icon: NetworkSimulatorIcon, keywords: 'netsim topology router switch packet tracer cisco' }] : []),
  ...(hasAiAccess.value ? [{ to: '/ai-chat', text: 'AI Chat Assistant', icon: AIIcon, keywords: 'chatbot gpt llm ask question assistant' }] : []),
  ...(hasResearchFlowAccess.value ? [{ to: '/research', text: 'Research Flow', icon: ResearchFlowIcon, keywords: 'papers sources literature review' }] : []),
  ...(hasToastmastersAccess.value ? [{ to: '/toastmasters', text: 'Toastmasters', icon: ToastmastersIcon, keywords: 'public speaking speech presentation' }] : []),
  ...(hasAiAccess.value ? [{ to: '/job-interview', text: 'Job Interview', icon: JobInterviewIcon, keywords: 'hiring practice questions mock career' }] : []),
  ...(hasAiAccess.value ? [{ to: '/cv-builder', text: 'CV Builder', icon: CvBuilderIcon, keywords: 'resume curriculum vitae pdf docx export' }] : []),
  ...(hasAiAccess.value ? [{ to: '/roblox-tool', text: 'Roblox Studio', icon: RobloxIcon, keywords: 'game lua scripting studio' }] : []),
]);

const navItems = computed<NavItem[]>(() =>
  isAuthenticated.value
    ? [...publicNavItems.value, ...privateNavItems.value, ...featureNavItems.value]
    : publicNavItems.value
);

const searchQuery = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const highlightIndex = ref(-1);
const isApplePlatform = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const searchShortcutLabel = isApplePlatform ? '⌘K' : 'Ctrl K';

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const searchTerms = computed(() => normalize(searchQuery.value).split(' ').filter(Boolean));

const filteredNavItems = computed(() => {
  const terms = searchTerms.value;
  if (!terms.length) return navItems.value;
  return navItems.value.filter(item => {
    const haystack = normalize(`${item.text} ${item.keywords || ''} ${item.to.replace(/[/-]/g, ' ')}`);
    return terms.every(term => haystack.includes(term));
  });
});

/** Split a label into matched / unmatched runs so hits can be emphasised without v-html. */
function matchParts(text: string): { text: string; match: boolean }[] {
  const terms = searchTerms.value;
  if (!terms.length) return [{ text, match: false }];

  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const term of terms) {
    let at = lower.indexOf(term);
    while (at !== -1) {
      ranges.push([at, at + term.length]);
      at = lower.indexOf(term, at + term.length);
    }
  }
  if (!ranges.length) return [{ text, match: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }

  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

function clearSearch() {
  searchQuery.value = '';
  highlightIndex.value = -1;
}

function focusSearch() {
  if (isMobile.value) openSidebar();
  else isCollapsed.value = false;
  nextTick(() => searchInput.value?.focus());
}

function moveHighlight(step: number) {
  const total = filteredNavItems.value.length;
  if (!total) return;
  const next = highlightIndex.value + step;
  highlightIndex.value = next < 0 ? total - 1 : next % total;
}

function openHighlighted() {
  const items = filteredNavItems.value;
  if (!items.length) return;
  const target = items[highlightIndex.value] || items[0];
  searchInput.value?.blur();
  clearSearch();
  closeSidebarOnMobile();
  if (target.to !== route.path) router.push(target.to);
}

function onSearchEscape() {
  if (searchQuery.value) clearSearch();
  else searchInput.value?.blur();
}

function onNavClick() {
  clearSearch();
  closeSidebarOnMobile();
}

function handleSearchShortcut(event: KeyboardEvent) {
  if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    focusSearch();
  }
}

// A fresh query starts on the first result so Enter always has an obvious target.
watch(searchQuery, value => {
  highlightIndex.value = value ? 0 : -1;
});

// Collapsing to the rail hides the field, so drop any in-progress filter with it.
watch(isCollapsed, collapsed => {
  if (collapsed) clearSearch();
});

const isActive = (path: string) => {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
};

const toggleSidebar = () => {
  if (isMobile.value) {
    sidebarVisible.value = !sidebarVisible.value;
    if (!sidebarVisible.value) isCollapsed.value = false;
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
  if (isMobile.value) closeSidebar();
};

function handleClickOutside(event: MouseEvent) {
  if (isMobile.value && sidebarVisible.value) {
    const sidebar = document.querySelector('.sidebar');
    const target = event.target as HTMLElement;
    if (sidebar && !sidebar.contains(target) && !target.closest('.mobile-toggle')) closeSidebar();
  }
}

const username = computed(() => authStore.user?.username || 'User');
const userEmail = computed(() => authStore.user?.email || '');
const userInitials = computed(() => {
  const name = username.value;
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
});
const proxiedImageUrl = computed(() => {
  if (!authStore.user?.image_url) return '';
  return getProxiedImageUrl(authStore.user.image_url);
});
const displayCount = computed(() => notificationStore.unreadCount);
const unreadMessages = computed(() => chatStore.totalUnread);

function syncAvatarUrl() {
  avatarError.value = false;
  avatarRetryCount.value = 0;
  displayedAvatarUrl.value = proxiedImageUrl.value || '';
}

function handleAvatarLoad() {
  avatarRetryCount.value = 0;
}

function handleAvatarError() {
  if (avatarRetryCount.value < MAX_AVATAR_RETRIES && proxiedImageUrl.value) {
    avatarRetryCount.value++;
    setTimeout(() => {
      displayedAvatarUrl.value = addCacheBuster(proxiedImageUrl.value);
    }, 250 * avatarRetryCount.value);
    return;
  }
  avatarError.value = true;
}

function initializeNotifications() {
  if (username.value) {
    notificationStore.loadFromLocalStorage(username.value);
    notificationStore.fetchNotificationCount(username.value);
    startPolling();
  }
  startMessagePolling();
}

/**
 * The messages badge, which polls independently of app 16's notifications.
 *
 * Two counters rather than one because they answer different questions: the bell
 * is "the platform has something to tell you", the messages badge is "a person is
 * waiting for a reply". Chat also deliberately does *not* produce a notification
 * per message — see utils/notify.py in selfstudyuserchat — so the bell would
 * undercount conversations badly if it were the only signal.
 *
 * Started here rather than in the Messages page because the whole point is to be
 * right when that page is closed. The store owns the interval, the chime and the
 * visibility handling.
 */
function startMessagePolling() {
  const id = String(authStore.user?.id || '');
  if (id) chatStore.start(id);
}

function startPolling() {
  stopPolling();
  if (!username.value) return;
  pollInterval = window.setInterval(() => {
    if (username.value) notificationStore.fetchNotificationCount(username.value);
  }, 30000);
}

function stopPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = null;
}

function goToNotifications() {
  router.push('/notifications');
  if (isMobile.value) closeSidebar();
}

function goToProfile() {
  router.push('/profile');
  if (isMobile.value) closeSidebar();
}

const handleLogout = async () => {
  try {
    stopPolling();
    notificationStore.clearAllNotifications();
    chatStore.reset();
    await authStore.logout();
    router.push('/login');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};

watch(() => authStore.isAuthenticated, (newValue) => {
  if (newValue && username.value) initializeNotifications();
  else {
    stopPolling();
    notificationStore.clearAllNotifications();
    // reset() also revokes every cached attachment object URL, which otherwise
    // keeps the previous user's pictures alive in this tab's memory.
    chatStore.reset();
  }
});

watch(username, (newUsername, oldUsername) => {
  if (newUsername) {
    if (oldUsername && oldUsername !== newUsername) notificationStore.clearUserNotifications(oldUsername);
    initializeNotifications();
  } else {
    stopPolling();
    notificationStore.clearAllNotifications();
  }
});

watch(() => route.path, () => {
  clearSearch();
  if (authStore.isAuthenticated && username.value) {
    setTimeout(() => notificationStore.fetchNotificationCount(username.value), 1000);
  }
});

watch(
  () => authStore.user?.image_url,
  () => syncAvatarUrl()
);

watch(() => authStore.user, () => {
  syncAvatarUrl();
});
</script>

<style src="@/assets/css/side-nav.css"></style>