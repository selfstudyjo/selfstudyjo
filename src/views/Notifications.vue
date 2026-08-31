<template>
  <div class="notifications-container">
    <div class="notifications-header">
      <h1>{{ $t('Notifications') }}</h1>
      <div class="header-actions">
        <button
          class="btn-mark-all-read"
          @click="markAllAsRead"
          :disabled="!hasUnread || loading"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
          </svg>
          {{ $t('Mark All as Read') }}
        </button>
        <button
          class="btn-clear-all"
          @click="askToClear"
          :disabled="allUserNotifications.length === 0 || loading"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
          {{ $t('Clear All') }}
        </button>
        <button
          class="btn-sound"
          :class="{ 'is-off': !soundEnabled }"
          @click="toggleSound"
          :title="soundEnabled ? 'Notification sound is on' : 'Notification sound is off'"
        >
          <svg v-if="soundEnabled" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>
            <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>
            <path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          {{ soundEnabled ? 'Sound On' : 'Sound Off' }}
        </button>
        <button
          class="btn-refresh"
          @click="refreshNotifications"
          :disabled="loading"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="currentColor"/>
          </svg>
          {{ $t('Refresh') }}
        </button>
      </div>
    </div>

    <!--
      Clear All is destructive and irreversible, so it asks — inline rather than
      through `confirm()`, which a browser renders outside the theme and some
      block outright after a few uses.
    -->
    <div v-if="confirmingClear" class="clear-confirm">
      <p>
        {{ $t('Clear all {v0} notifications? The ones sent to you are deleted for good. Announcements are removed from your list and stay in everybody else\'s.', { v0: allUserNotifications.length }) }}
      </p>
      <button class="confirm-yes" @click="clearAll" :disabled="clearing">
        {{ clearing ? 'Clearing…' : 'Yes, clear all' }}
      </button>
      <button class="confirm-no" @click="confirmingClear = false" :disabled="clearing">
        {{ $t('Cancel') }}
      </button>
    </div>

    <p v-if="actionNote" class="action-note">{{ actionNote }}</p>

    <div class="stats-summary">
      <div class="stat-card">
        <div class="stat-value">{{ totalCount }}</div>
        <div class="stat-label">{{ $t('Total') }}</div>
      </div>
      <div class="stat-card unread">
        <div class="stat-value">{{ unreadCount }}</div>
        <div class="stat-label">{{ $t('Unread') }}</div>
      </div>
      <div class="stat-card general">
        <div class="stat-value">{{ generalCount }}</div>
        <div class="stat-label">{{ $t('General') }}</div>
      </div>
      <div class="stat-card group">
        <div class="stat-value">{{ groupCount }}</div>
        <div class="stat-label">{{ $t('Group') }}</div>
      </div>
      <div class="stat-card user-info">
        <div class="stat-value">{{ currentUser }}</div>
        <div class="stat-label">{{ $t('Current User') }}</div>
      </div>
    </div>

    <div class="notifications-filters">
      <div class="filter-tabs">
        <button
          class="filter-tab"
          :class="{ active: activeFilter === 'all' }"
          @click="setFilter('all')"
        >
          {{ $t('All ({v0})', { v0: allUserNotifications.length }) }}
        </button>
        <button
          class="filter-tab"
          :class="{ active: activeFilter === 'unread' }"
          @click="setFilter('unread')"
        >
          {{ $t('Unread ({v0})', { v0: unreadNotifications.length }) }}
        </button>
        <button
          class="filter-tab"
          :class="{ active: activeFilter === 'personal' }"
          @click="setFilter('personal')"
        >
          {{ $t('Personal ({v0})', { v0: personalNotifications.length }) }}
        </button>
        <button
          class="filter-tab"
          :class="{ active: activeFilter === 'general' }"
          @click="setFilter('general')"
        >
          {{ $t('General ({v0})', { v0: generalNotifications.length }) }}
        </button>
        <button
          class="filter-tab"
          :class="{ active: activeFilter === 'group' }"
          @click="setFilter('group')"
        >
          {{ $t('Group ({v0})', { v0: groupNotifications.length }) }}
        </button>
      </div>
    </div>

    <div class="notifications-list">
      <div v-if="loading && filteredNotifications.length === 0" class="loading-state">
        <div class="notifications-spinner"></div>
        <p>{{ $t('Loading your notifications...') }}</p>
      </div>

      <div v-else-if="filteredNotifications.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>{{ activeFilter === 'all' ? 'No notifications yet' : 'Nothing here' }}</h3>
        <p>
          {{ activeFilter === 'all'
            ? "When you receive notifications, they'll appear here."
            : 'Try another filter — there may be notifications under one of the other tabs.' }}
        </p>
      </div>

      <div v-else class="notifications-grid">
        <div
          v-for="notification in filteredNotifications"
          :key="notification.notification_id"
          :class="['notification-card', {
            unread: !notification.read,
            personal: notification.notification_type === 'personal',
            general: notification.notification_type === 'general',
            group: notification.notification_type === 'group'
          }]"
        >
          <div class="notification-header">
            <div class="notification-type notification-tags">
              <span v-if="!notification.read" class="unread-dot" :aria-label="$t('Unread')"></span>
              <span :class="['type-badge', notification.notification_type]">
                {{ notification.notification_type.toUpperCase() }}
              </span>
              <span v-if="notification.category" class="category-chip">
                {{ notification.category }}
              </span>
              <span
                v-if="notification.priority === 'high' || notification.priority === 'urgent'"
                :class="['priority-badge', notification.priority]"
              >
                {{ notification.priority }}
              </span>
            </div>
            <div class="notification-time">
              {{ formatTime(notification.created_at) }}
            </div>
          </div>

          <div class="notification-content">
            <h4 class="notification-title">{{ notification.title }}</h4>
            <!--
              Notification bodies routinely carry a URL — a link to a course, a
              payment page, an external resource. Rendered as text they had to
              be selected and copied by hand. RichText escapes the body before
              it builds any anchor, so this is not a v-html hole; see
              src/utils/linkify.ts.
            -->
            <RichText
              class="notification-message"
              :text="getCleanMessage(notification)"
              measured
            />

            <div class="notification-meta">
              <span class="sender">
                {{ $t('From:') }} <strong>{{ notification.sender }}</strong>
              </span>
              <span v-if="notification.notification_type === 'personal'" class="recipient">
                {{ $t('To:') }} <strong>{{ notification.recipient }}</strong>
              </span>
              <span v-else-if="notification.notification_type === 'group'" class="recipient">
                {{ $t('Group:') }} <strong>{{ notification.recipient }}</strong>
              </span>
            </div>
          </div>

          <div class="notification-actions">
            <!--
              Mark as read and Delete now work on every kind, not just personal.
              App 16 keeps a per-recipient state row, so marking an announcement
              read marks it read for you and nobody else, and deleting one takes
              it out of your list without touching anybody else's.
            -->
            <button
              v-if="!notification.read"
              class="btn-mark-read"
              @click="markAsRead(notification.notification_id)"
              :disabled="busyId === notification.notification_id"
            >
              {{ $t('Mark as Read') }}
            </button>
            <button
              v-if="notification.link"
              class="btn-view-link"
              @click="openLink(notification)"
            >
              {{ $t('View') }}
            </button>
            <button
              class="btn-delete"
              @click="deleteNotification(notification)"
              :disabled="busyId === notification.notification_id"
            >
              {{ $t('Delete') }}
            </button>

            <!-- Action buttons (Approve / Ignore) for the payment pair, which
                 carries parameters rather than a path. -->
            <template v-if="!isActionHandled(notification.notification_id)">
              <button
                v-for="(action, idx) in getActions(notification)"
                :key="notification.notification_id + '-act-' + idx"
                class="btn-meta-action"
                :class="metaActionClass(action.type)"
                :disabled="actionLoading === notification.notification_id"
                @click="handleAction(notification, action)"
              >
                {{ action.label || defaultActionLabel(action.type) }}
              </button>
            </template>
            <span
              v-else-if="getActions(notification).length > 0"
              class="action-handled-info"
            >
              {{ $t('✓ Handled') }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="loading && filteredNotifications.length > 0" class="loading-more">
        <div class="notifications-spinner small"></div>
        {{ $t('Loading more notifications...') }}
      </div>

      <div v-if="hasMore && !loading && filteredNotifications.length > 0" class="load-more">
        <button @click="loadMore" class="btn-load-more">
          {{ $t('Load More') }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      <p>⚠️ {{ error }}</p>
      <button @click="refreshNotifications" class="btn-retry">{{ $t('Retry') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notifications';
import { notificationService, type NotificationResponse } from '@/services/notification.service';
import { paymentService } from '@/services/payment.service';
import { decodeNotificationMessage, type NotificationAction } from '@/utils/notificationMeta';
import RichText from '@/components/RichText.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const loading = computed(() => notificationStore.loading);
const error = computed(() => notificationStore.error);
const personalNotifications = computed(() => notificationStore.personalNotifications);
const generalNotifications = computed(() => notificationStore.generalNotifications);
const groupNotifications = computed(() => notificationStore.groupNotifications);
const unreadNotifications = computed(() => notificationStore.unreadNotifications);
const allUserNotifications = computed(() => notificationStore.allUserNotifications);
const unreadCount = computed(() => notificationStore.unreadCount);
const totalCount = computed(() => notificationStore.totalCount);
const generalCount = computed(() => notificationStore.generalCount);
const groupCount = computed(() => notificationStore.groupCount);
const hasMore = computed(() => notificationStore.hasMore);
const soundEnabled = computed(() => notificationStore.soundEnabled);

const currentUser = computed(() => {
  return authStore.user?.username || 'Not logged in';
});

const hasUnread = computed(() => {
  return unreadCount.value > 0;
});

// Active filter
const activeFilter = ref('all');

// Track action state for metadata buttons
const handledActionIds = ref<Set<string>>(new Set());
const actionLoading = ref<string | null>(null);
/** The one card currently mid-request, so its two buttons disable together
 *  without freezing the whole list. */
const busyId = ref<string | null>(null);
const confirmingClear = ref(false);
const clearing = ref(false);
const actionNote = ref('');

// Filtered notifications based on active filter
const filteredNotifications = computed(() => {
  switch (activeFilter.value) {
    case 'unread':
      return unreadNotifications.value;
    case 'personal':
      return personalNotifications.value;
    case 'general':
      return generalNotifications.value;
    case 'group':
      return groupNotifications.value;
    case 'all':
    default:
      return allUserNotifications.value;
  }
});

// Track if we've already loaded notifications
const hasLoaded = ref(false);

onMounted(() => {
  // Opening the bell is a user gesture, and it is the one moment we can be sure
  // of. Priming here as well as on the first click means the chime works even
  // for somebody who lands straight on this page from a link.
  notificationStore.primeAudio();
  if (currentUser.value) loadNotifications();
});

// Use route guard to handle leaving the page
onBeforeRouteLeave((to, from, next) => {
  // Reset pagination when leaving the notifications page
  if (from.name === 'Notifications') {
    notificationStore.resetPagination();
  }
  next();
});

watch(currentUser, (newUsername) => {
  if (newUsername) {
    // Clear previous user's notifications and load new ones
    notificationStore.clearUserNotifications(newUsername);
    hasLoaded.value = false;
    activeFilter.value = 'all';
    loadNotifications();
  }
}, { immediate: true });

// Watch for route changes to handle navigation back to notifications
watch(() => route.name, (routeName) => {
  if (routeName === 'Notifications' && currentUser.value) {
    // Only refresh if we haven't loaded recently
    if (!hasLoaded.value) {
      loadNotifications();
    }
  } else if (routeName !== 'Notifications') {
    // Reset loaded flag when leaving notifications page
    hasLoaded.value = false;
  }
});

async function loadNotifications() {
  if (!currentUser.value) return;

  await notificationStore.fetchNotifications(currentUser.value, true);
  await notificationStore.fetchNotificationStats(currentUser.value);
  hasLoaded.value = true;
}

async function refreshNotifications() {
  if (!currentUser.value) return;

  hasLoaded.value = false;
  actionNote.value = '';
  await loadNotifications();
}

async function loadMore() {
  if (!currentUser.value) return;

  await notificationStore.fetchNotifications(currentUser.value);
}

function toggleSound() {
  notificationStore.setSoundEnabled(!soundEnabled.value);
  // Play it once when switching on, so the choice is audible rather than a
  // setting somebody has to take on trust until the next notification.
  if (notificationStore.soundEnabled) notificationStore.ring();
}

async function markAsRead(notificationId: string) {
  busyId.value = notificationId;
  try {
    await notificationStore.markAsRead(notificationId);
  } catch (err: any) {
    actionNote.value = err?.message || 'Could not mark that as read. Try again.';
  } finally {
    busyId.value = null;
  }
}

async function markAllAsRead() {
  if (!currentUser.value) return;
  try {
    const result = await notificationStore.markAllAsRead(currentUser.value);
    actionNote.value = `Marked ${result?.updated_count ?? 0} notifications as read.`;
  } catch (err: any) {
    actionNote.value = err?.message || 'Could not mark everything as read. Try again.';
  }
}

/**
 * One notification's Delete.
 *
 * The message afterwards is not decoration. An announcement is a single record
 * the whole platform reads, so all a recipient can do is take it out of their
 * own list — and a user who is told that once stops wondering why it is still
 * listed in the admin console.
 */
async function deleteNotification(notification: NotificationResponse) {
  busyId.value = notification.notification_id;
  try {
    await notificationStore.deleteNotification(notification.notification_id);
    actionNote.value = notification.notification_type === 'personal'
      ? 'Notification deleted.'
      : 'Removed from your list. Announcements stay in everybody else\'s.';
  } catch (err: any) {
    actionNote.value = err?.message || 'Could not delete that notification. Try again.';
  } finally {
    busyId.value = null;
  }
}

function askToClear() {
  actionNote.value = '';
  confirmingClear.value = true;
}

async function clearAll() {
  if (!currentUser.value) return;
  clearing.value = true;
  try {
    const result = await notificationStore.clearAll(currentUser.value);
    confirmingClear.value = false;
    const deleted = result?.deleted ?? 0;
    const dismissed = result?.dismissed ?? 0;
    actionNote.value = dismissed
      ? `Cleared ${deleted + dismissed}. ${deleted} deleted, ${dismissed} announcement${dismissed === 1 ? '' : 's'} removed from your list.`
      : `Cleared ${deleted} notifications.`;
  } catch (err: any) {
    actionNote.value = err?.message || 'Could not clear your notifications. Try again.';
  } finally {
    clearing.value = false;
  }
}

function setFilter(filterType: string) {
  activeFilter.value = filterType;
}

/**
 * Follow a notification's destination.
 *
 * Marks it read on the way, because arriving at the thing a notification is
 * about and then finding it still unread is the single most common complaint
 * about any bell. Failure is deliberately ignored: the navigation is what the
 * user asked for.
 */
async function openLink(notification: NotificationResponse) {
  const to = notification.link;
  if (!notification.read) {
    notificationStore.markAsRead(notification.notification_id).catch(() => undefined);
  }
  if (!to) return;
  if (/^https?:\/\//i.test(to)) {
    window.open(to, '_blank', 'noopener,noreferrer');
  } else {
    router.push(to);
  }
}

// ---------------- Notification metadata / action handling ----------------

function getCleanMessage(notification: NotificationResponse): string {
  return decodeNotificationMessage(notification.message).message;
}

function getActions(notification: NotificationResponse): NotificationAction[] {
  const meta = decodeNotificationMessage(notification.message).meta;
  return meta?.actions || [];
}

function isActionHandled(notificationId: string): boolean {
  return handledActionIds.value.has(notificationId);
}

function defaultActionLabel(type: string): string {
  switch (type) {
    case 'approve_payment': return 'Approve';
    case 'ignore_payment': return 'Ignore';
    case 'view_course': return 'View Course';
    case 'view_appointment': return 'View Appointment';
    case 'view_plans': return 'View Plans';
    default: return 'Open';
  }
}

function metaActionClass(type: string): string {
  switch (type) {
    case 'approve_payment': return 'meta-approve';
    case 'ignore_payment': return 'meta-ignore';
    default: return 'meta-link';
  }
}

async function notifyStudentPaymentDecision(action: NotificationAction, approved: boolean) {
  await notificationService.notify(
    approved ? 'payment.approved' : 'payment.rejected',
    {
      to: action.studentUsername,
      sender: authStore.user?.username || 'system',
      params: {
        plan: action.planTitle,
        amount: action.amount,
        reason: 'Please contact support or submit a new request.',
      },
    }
  );
}

/**
 * After an admin approves/ignores: delete the GROUP notification so it is
 * removed for ALL admins (backend syncs the delete across replicas).
 */
async function deleteAdminPaymentNotification(notification: NotificationResponse) {
  handledActionIds.value.add(notification.notification_id);
  try {
    await notificationStore.deleteNotificationAsAdmin(notification.notification_id);
  } catch (err) {
    console.warn('Failed to delete admin payment notification:', err);
  }
}

async function handleAction(notification: NotificationResponse, action: NotificationAction) {
  if (actionLoading.value) return;
  actionLoading.value = notification.notification_id;

  try {
    switch (action.type) {
      case 'approve_payment': {
        if (!action.paymentId) throw new Error('Missing payment reference');
        // Approve => mark the payment as VERIFIED (final accepted state)
        await paymentService.approvePayment(
          action.paymentId,
          `Approved & verified by admin ${authStore.user?.username} on ${new Date().toLocaleString()}`
        );
        await notifyStudentPaymentDecision(action, true);
        await deleteAdminPaymentNotification(notification);
        actionNote.value = 'Payment approved and marked as VERIFIED. The student has been notified.';
        break;
      }
      case 'ignore_payment': {
        if (!action.paymentId) throw new Error('Missing payment reference');
        await paymentService.rejectPayment(
          action.paymentId,
          `Ignored by admin ${authStore.user?.username} on ${new Date().toLocaleString()}`
        );
        await notifyStudentPaymentDecision(action, false);
        await deleteAdminPaymentNotification(notification);
        actionNote.value = 'Payment request ignored. The student has been notified.';
        break;
      }
      case 'view_course':
      case 'view_appointment':
      case 'view_plans': {
        if (action.path) {
          router.push(action.path);
        }
        break;
      }
      default:
        if (action.path) router.push(action.path);
        break;
    }
  } catch (err: any) {
    console.error('Notification action failed:', err);
    actionNote.value = err?.message || 'Action failed. Please try again.';
  } finally {
    actionLoading.value = null;
  }
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const minutes = Math.floor(diffInHours * 60);
    return minutes < 1 ? 'Just now' : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hour${Math.floor(diffInHours) > 1 ? 's' : ''} ago`;
  } else if (diffInHours < 168) {
    const days = Math.floor(diffInHours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}
</script>

<style scoped>
.notification-message {
  white-space: pre-line;
}

.btn-meta-action {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--sfs-text, #fff);
  transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
}

.btn-meta-action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
}

.btn-meta-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-meta-action.meta-approve {
  background: linear-gradient(135deg, var(--sfs-success, #48bb78), var(--sfs-success, #38a169));
  /* Its own ink. The base rule this shares with the other variants can only
     hold one `color`, and that one belongs to whichever variant came first —
     so an amber or green button inherited the ink meant for the indigo one.
     A fill decides its own ink. */
  color: var(--sfs-on-success, #fff);
}

.btn-meta-action.meta-ignore {
  background: linear-gradient(135deg, var(--sfs-danger, #f56565), var(--sfs-danger, #c53030));
  /* Its own ink. The base rule this shares with the other variants can only
     hold one `color`, and that one belongs to whichever variant came first —
     so an amber or green button inherited the ink meant for the indigo one.
     A fill decides its own ink. */
  color: var(--sfs-on-danger, #fff);
}

.btn-meta-action.meta-link {
  background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #764ba2));
}

.action-handled-info {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--sfs-success-text, #38a169);
}
</style>

<!-- Scoped rather than imported from the script, so its selectors cannot reach
     another page. See VerifyEmail.vue for the bug that prompted it: a bare
     `.btn-primary` in a globally-loaded sheet wiped the fill off the login
     button, because an undefined `var()` makes a property `unset` rather than
     letting the earlier declaration win. Safe here for the same two reasons —
     the tokens are on the page root, not `:root`, and this view styles no child
     component's internals. -->
<style scoped src="@/assets/css/notifications.css"></style>
