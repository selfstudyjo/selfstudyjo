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

    <aside :class="['sidebar', { 'collapsed': isCollapsed, 'active': sidebarVisible, 'in-app': !!activeSection }]">
      <div class="sidebar-header">
        <!--
          Inside an application the header becomes that application's identity
          rather than the platform's. It is a link to the application's own
          landing page, which is the other half of "where am I" — the title
          says it, the link acts on it.
        -->
        <router-link
          v-if="activeSection && !isCollapsed"
          :to="activeSection.home"
          class="app-badge"
          @click="onNavClick"
        >
          <div class="app-badge-icon">
            <component :is="icons[activeSection.icon]" />
          </div>
          <div class="app-badge-text">
            <span class="app-badge-title">{{ activeSection.title }}</span>
            <span class="app-badge-sub">{{ activeSection.subtitle }}</span>
          </div>
        </router-link>

        <div class="logo" @click="toggleSidebar" v-else-if="!isCollapsed">
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

      <!--
        The search field is part of every sidebar, in every application, and it
        always searches the whole platform — see navLayout() in
        src/navigation/appNav.ts for why scoping it to the open application
        would be the wrong call.
      -->
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
            :placeholder="searchPlaceholder"
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
          {{ searchQuery ? `${visibleItems.length} pages match ${searchQuery}` : '' }}
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
        <!--
          Home. Pinned above every group, rendered in every mode, never
          filtered by the search and never hidden by an access flag — a sidebar
          scoped to one application is a sidebar that no longer lists the rest
          of the platform, so the way back to the dashboard has to be somewhere
          the user can always find it. See HOME_ENTRY in appNav.ts.
        -->
        <router-link
          :to="homeEntry.to"
          class="nav-item nav-home"
          :class="{ 'active': currentPath === homeEntry.to }"
          :aria-current="currentPath === homeEntry.to ? 'page' : undefined"
          :title="isCollapsed ? 'Home' : undefined"
          @click="onNavClick"
        >
          <div class="nav-icon"><component :is="icons[homeEntry.icon]" /></div>
          <span class="nav-text">{{ homeEntry.text }}</span>
        </router-link>

        <template v-for="group in renderGroups.scoped" :key="group.key">
          <p v-if="!isCollapsed" class="nav-group-label">{{ group.label }}</p>
          <span v-else class="nav-group-rule" aria-hidden="true"></span>
          <router-link
            v-for="row in group.items"
            :key="row.key"
            :to="row.entry.to"
            class="nav-item"
            :class="{ 'active': row.entry.to === activeItemPath, 'highlighted': row.index === highlightIndex }"
            :aria-current="row.entry.to === activeItemPath ? 'page' : undefined"
            :title="isCollapsed ? row.entry.text : undefined"
            @click="onNavClick"
          >
            <div class="nav-icon"><component :is="icons[row.entry.icon]" /></div>
            <span class="nav-text"><span v-for="(part, i) in matchParts(row.entry.text, terms)" :key="i" :class="{ 'nav-text-match': part.match }">{{ part.text }}</span></span>
            <span
              v-if="badgeCount(row.entry) > 0"
              class="notification-badge"
              :aria-label="`${badgeCount(row.entry)} unread`"
            >
              {{ badgeCount(row.entry) > 99 ? '99+' : badgeCount(row.entry) }}
            </span>
          </router-link>
        </template>

        <!--
          The rest of the platform, one click away rather than gone. Only while
          inside an application and only with an empty query: a search already
          reaches everywhere, so a disclosure would just be a second thing to
          click before seeing the answer.
        -->
        <button
          v-if="activeSection && !terms.length"
          class="nav-item nav-more"
          type="button"
          :aria-expanded="showAllApps"
          :title="isCollapsed ? 'All applications' : undefined"
          @click="showAllApps = !showAllApps"
        >
          <div class="nav-icon"><component :is="icons.grid" /></div>
          <span class="nav-text">All applications</span>
          <svg class="nav-more-chevron" :class="{ 'open': showAllApps }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <template v-for="group in renderGroups.extra" :key="group.key">
          <p v-if="!isCollapsed" class="nav-group-label nav-group-label-extra">{{ group.label }}</p>
          <span v-else class="nav-group-rule" aria-hidden="true"></span>
          <router-link
            v-for="row in group.items"
            :key="row.key"
            :to="row.entry.to"
            class="nav-item"
            :class="{ 'active': row.entry.to === activeItemPath, 'highlighted': row.index === highlightIndex }"
            :aria-current="row.entry.to === activeItemPath ? 'page' : undefined"
            :title="isCollapsed ? row.entry.text : undefined"
            @click="onNavClick"
          >
            <div class="nav-icon"><component :is="icons[row.entry.icon]" /></div>
            <span class="nav-text"><span v-for="(part, i) in matchParts(row.entry.text, terms)" :key="i" :class="{ 'nav-text-match': part.match }">{{ part.text }}</span></span>
            <span
              v-if="badgeCount(row.entry) > 0"
              class="notification-badge"
              :aria-label="`${badgeCount(row.entry)} unread`"
            >
              {{ badgeCount(row.entry) > 99 ? '99+' : badgeCount(row.entry) }}
            </span>
          </router-link>
        </template>

        <p v-if="searchQuery && !visibleItems.length" class="nav-empty">
          No pages match “{{ searchQuery }}”
        </p>
      </nav>

      <div class="sidebar-footer">
        <!--
          The galaxy picker sits above the account block and outside the
          authenticated branch on purpose: choosing how the app looks is not
          something a visitor should have to sign in for, and the login page
          is one of the screens most worth being able to read.
        -->
        <ThemePicker :collapsed="isCollapsed" />

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
import ThemePicker from '@/components/ThemePicker.vue';
import { getProxiedImageUrl, addCacheBuster } from '@/utils/imageUtils';
import {
  HOME_ENTRY,
  activePath,
  flatten,
  matchParts,
  navLayout,
  resolveSection,
  searchTerms,
  type Access,
  type IconName,
  type NavEntry,
  type NavGroup,
} from '@/navigation/appNav';

/* ------------------------------------------------------------------ *
 * Icons
 *
 * `appNav.ts` names an icon, this map draws it. The registry cannot import a
 * render function without becoming unloadable in node and therefore
 * uncheckable, and `Record<IconName, ...>` is what makes the two halves stay
 * in step: a name added to the union without a glyph here is a type error
 * rather than a blank square in the sidebar.
 * ------------------------------------------------------------------ */

/** Most glyphs are a single filled path on the same 24×24 grid. */
const filled = (name: string, ...d: string[]) => ({
  name,
  render() {
    return h(
      'svg',
      { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' },
      d.map(path => h('path', { d: path }))
    );
  },
});

/** The few that read better as strokes — thin outlines at the same weight. */
const stroked = (name: string, width: string, children: () => any[]) => ({
  name,
  render() {
    return h(
      'svg',
      {
        width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', 'stroke-width': width,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      },
      children()
    );
  },
});

const icons: Record<IconName, any> = {
  home: filled('HomeIcon', 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'),
  grid: filled('GridIcon', 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z'),

  courses: stroked('CoursesIcon', '2', () => [
    h('path', { d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' }),
  ]),
  exams: filled('ExamsIcon',
    'M13 11h-2v2h2v-2zm0-6h-2v4h2V5zm4.83 2.17L16.41 5.75 18 4.16l1.41 1.41-1.58 1.58zM20 12h4v2h-4v-2zm-9 7h2v2h-2v-2zM4 12h4v2H4v-2zm1.17-4.83L3.59 5.75 5 4.34l1.41 1.41-1.58 1.58zm14.66 8.66L17.41 18.08 19 19.66l1.41-1.41-1.58-1.58z'),
  runbooks: filled('RunbooksIcon',
    'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V7h2v4zm4 0h-4V7h4v4z'),
  lab: filled('LabIcon',
    'M19 6h-4V2H9v4H5v15h14V6zM9 4h6v2H9V4zm11 15H5V8h14v11zm-12-9h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8 4h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z'),
  netsim: stroked('NetworkSimulatorIcon', '1.7', () => [
    h('rect', { x: '9', y: '2.5', width: '6', height: '5', rx: '1.4' }),
    h('rect', { x: '2', y: '16.5', width: '6', height: '5', rx: '1.4' }),
    h('rect', { x: '16', y: '16.5', width: '6', height: '5', rx: '1.4' }),
    h('path', { d: 'M12 7.5v3.5M5 16.5V11h14v5.5M12 11v5.5' }),
  ]),

  certificate: filled('CertificateIcon',
    'M4 3h16c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm0 2v2h16V5H4zm0 4v2h16V9H4zm0 4v2h16v-2H4zm0 4v2h16v-2H4z'),
  allCertificates: filled('AllCertificatesIcon',
    'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10zm-3-4H7v2h10v-2zm0-4H7v2h10v-2z'),
  results: filled('ResultsIcon', 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z'),

  plans: filled('PlansIcon',
    'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10zm-8-6H8v2h4v-2zm0-4H8v2h4V8z'),
  myPlans: filled('MyPlansIcon',
    'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z'),

  profile: filled('ProfileIcon',
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'),
  notifications: filled('NotificationsIcon',
    'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'),
  messages: stroked('MessagesIcon', '1.8', () => [
    h('path', { d: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z' }),
  ]),
  draw: stroked('DrawIcon', '1.7', () => [
    h('path', { d: 'M3 21l3.5-1L18 8.5 15.5 6 4 17.5z' }),
    h('path', { d: 'M15.5 6l2-2a1.8 1.8 0 012.5 2.5l-2 2' }),
    h('path', { d: 'M13.5 8l2.5 2.5' }),
  ]),

  ai: filled('AIIcon',
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-10H8v2h2v-2zm6 0h-2v2h2v-2zm-6 4H8v2h2v-2zm6 0h-2v2h2v-2z'),
  research: filled('ResearchFlowIcon',
    'M9 4v1.38c-.83-.33-1.72-.5-2.5-.5-1.79 0-3.5.72-3.5 2.38V19.5C3 20.88 4.28 21 5.5 21c.96 0 1.89-.12 2.5-.38V22h10v-7.5L21.5 18l-2-2 2-2L18 17.5V4H9zM7.17 14.5c-.83 0-1.67-.21-2.17-.6V8.4c.48-.36 1.3-.55 2.17-.55.83 0 1.63.18 2.33.55v5.53c-.73.36-1.52.57-2.33.57zM16 13h-4V5h4v8z'),
  toastmasters: filled('ToastmastersIcon',
    'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z'),
  jobInterview: filled('JobInterviewIcon',
    'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z'),
  roblox: filled('RobloxIcon', 'M4 4h16v16H4V4zm2 2v12h12V6H6zm3 3h6v6H9V9z'),
  cvBuilder: filled('CvBuilderIcon',
    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h8v1.5H8V13zm0 3h8v1.5H8V16zm0-6h3v1.5H8V10z'),

  proctor: filled('ProctorDashboardIcon', 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'),

  list: filled('ListIcon',
    'M3 5h2v2H3V5zm4 0h14v2H7V5zM3 11h2v2H3v-2zm4 0h14v2H7v-2zM3 17h2v2H3v-2zm4 0h14v2H7v-2z'),
  plus: filled('PlusIcon', 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z'),
  search: stroked('SearchIcon', '2', () => [
    h('circle', { cx: '11', cy: '11', r: '7' }),
    h('path', { d: 'M20 20l-4.35-4.35' }),
  ]),
  library: filled('LibraryIcon',
    'M6 2h12a1 1 0 011 1v18a1 1 0 01-1 1H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2H6zm0 2a.5.5 0 00-.5.5V17h11V4H6zm-.5 15.5a1 1 0 001 1H17v-2H6.5a1 1 0 00-1 1z'),
  users: filled('UsersIcon',
    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z'),
  write: filled('WriteIcon',
    'M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z'),
  import: filled('ImportIcon', 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z'),
  globe: filled('GlobeIcon',
    'M12 2a10 10 0 100 20 10 10 0 000-20zm6.93 6h-2.95a15.65 15.65 0 00-1.38-3.56A8.03 8.03 0 0118.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14A7.9 7.9 0 014 12c0-.69.1-1.36.26-2h3.38a16.5 16.5 0 000 4H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 015.07 16zm2.95-8H5.07a7.99 7.99 0 014.33-3.56A15.65 15.65 0 008.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66a14.6 14.6 0 010-4h4.68a14.6 14.6 0 010 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a7.99 7.99 0 01-4.33 3.56zM16.36 14a16.5 16.5 0 000-4h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z'),
  play: filled('PlayIcon', 'M8 5v14l11-7L8 5z'),
  calendar: filled('CalendarIcon',
    'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z'),
  check: filled('CheckIcon',
    'M12 2a10 10 0 100 20 10 10 0 000-20zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'),
  layers: filled('LayersIcon',
    'M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z'),
  learn: filled('LearnIcon',
    'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z'),
  idCard: filled('IdCardIcon',
    'M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 14H4V6h16v12zM9 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-4 3h8v-.75C13 13.75 10.33 13 9 13s-4 .75-4 2.25V16zm9-7h5v1.5h-5V9zm0 3h5v1.5h-5V12z'),
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

/* ------------------------------------------------------------------ *
 * The dynamic nav
 * ------------------------------------------------------------------ */

/**
 * The auth store's `hasXAccess` computeds, flattened into the plain object the
 * registry takes. Keeping `appNav.ts` free of the store is what lets the whole
 * navigation model be verified in node — see `npm run check:appnav`.
 */
const access = computed<Access>(() => ({
  auth: authStore.isAuthenticated,
  ai: authStore.hasAiAccess,
  lab: authStore.hasLabAccess,
  runbook: authStore.hasRunbookAccess,
  research: authStore.hasResearchFlowAccess,
  toastmasters: authStore.hasToastmastersAccess,
  exam: authStore.hasExamFeature,
  proctor: authStore.isProctor,
}));

const homeEntry = HOME_ENTRY;
const currentPath = computed(() => route.path);
const activeSection = computed(() => resolveSection(currentPath.value, access.value));

const searchQuery = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const highlightIndex = ref(-1);
const showAllApps = ref(false);
const isApplePlatform = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const searchShortcutLabel = isApplePlatform ? '⌘K' : 'Ctrl K';

const terms = computed(() => searchTerms(searchQuery.value));

const layout = computed(() => navLayout({
  section: activeSection.value,
  access: access.value,
  query: searchQuery.value,
  showAllApps: showAllApps.value,
}));

/** Everything on screen, in render order — what the up/down keys walk. */
const visibleItems = computed<NavEntry[]>(() => [
  ...flatten(layout.value.scoped),
  ...flatten(layout.value.extra),
]);

/**
 * The same list with each row's position in it, because the keyboard cursor
 * cannot be tracked by object identity: the entry constants are shared between
 * an application's `related` links and the platform menu on purpose, so with
 * the disclosure open the same object is legitimately on screen twice and
 * `item === highlighted` would light up both.
 */
const renderGroups = computed(() => {
  let index = 0;
  const decorate = (groups: NavGroup[], prefix: string) => groups.map(group => ({
    key: `${prefix}-${group.label}`,
    label: group.label,
    items: group.items.map(entry => ({
      key: `${prefix}-${group.label}-${entry.to}`,
      entry,
      index: index++,
    })),
  }));
  // Order matters: `visibleItems` is scoped-then-extra, and these indices are
  // positions in that list.
  const scoped = decorate(layout.value.scoped, 's');
  const extra = decorate(layout.value.extra, 'x');
  return { scoped, extra };
});

/**
 * Exactly one entry is active: the longest path the current location sits
 * under. Marking every prefix would light up `/research` alongside
 * `/research/library` on every page of the application.
 */
const activeItemPath = computed(() =>
  activePath(visibleItems.value.map(item => item.to).filter(to => to !== '/'), currentPath.value)
);

const searchPlaceholder = computed(() =>
  activeSection.value ? `Search ${activeSection.value.title} & all apps…` : 'Search pages…'
);

const displayCount = computed(() => notificationStore.unreadCount);
const unreadMessages = computed(() => chatStore.totalUnread);

/** Live counters, hung off the entry's declared `badge` rather than off its path. */
function badgeCount(item: NavEntry): number {
  if (item.badge === 'notifications') return displayCount.value;
  if (item.badge === 'messages') return unreadMessages.value;
  return 0;
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
  const total = visibleItems.value.length;
  if (!total) return;
  const next = highlightIndex.value + step;
  highlightIndex.value = next < 0 ? total - 1 : next % total;
}

function openHighlighted() {
  const items = visibleItems.value;
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

// Moving between applications re-scopes the sidebar, so a disclosure left open
// in the last one should not decide how the next one opens.
watch(() => activeSection.value?.id, () => {
  showAllApps.value = false;
});

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
