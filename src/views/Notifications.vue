<template>
  <div class="notifications-container">
    <div class="notifications-header">
      <h1>Notifications</h1>
      <div class="header-actions">
        <button
          class="btn-mark-all-read"
          @click="markAllAsRead"
          :disabled="!hasUnread || loading"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
          </svg>
          Mark All Personal as Read
        </button>
        <button
          class="btn-refresh"
          @click="refreshNotifications"
          :disabled="loading"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="currentColor"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <div class="stats-summary">
      <div class="stat-card">
        <div class="stat-value">{{ totalCount }}</div>
        <div class="stat-label">Personal</div>
      </div>
      <div class="stat-card unread">
        <div class="stat-value">{{ unreadCount }}</div>
        <div class="stat-label">Unread Personal</div>
      </div>
      <div class="stat-card general">
        <div class="stat-value">{{ generalCount }}</div>
        <div class="stat-label">General</div>
      </div>
      <div class="stat-card group">
        <div class="stat-value">{{ groupCount }}</div>
        <div class="stat-label">Group</div>
      </div>
      <div class="stat-card user-info">
        <div class="stat-value">{{ currentUser }}</div>
        <div class="stat-label">Current User</div>
      </div>
    </div>

    <div class="notifications-filters">
      <div class="filter-tabs">
        <button
          class="filter-tab"
          :class="{ active: activeFilter === 'all' }"
          @click="setFilter('all')"
        >
          All ({{ allUserNotifications.length }})
        </button>
        <button
          class="filter-tab"
          :class="{ active: activeFilter === 'personal' }"
          @click="setFilter('personal')"
        >
          Personal ({{ personalNotifications.length }})
        </button>
        <button
          class="filter-tab"
          :class="{ active: activeFilter === 'general' }"
          @click="setFilter('general')"
        >
          General ({{ generalNotifications.length }})
        </button>
        <button
          class="filter-tab"
          :class="{ active: activeFilter === 'group' }"
          @click="setFilter('group')"
        >
          Group ({{ groupNotifications.length }})
        </button>
      </div>
    </div>

    <div class="notifications-list">
      <div v-if="loading && filteredNotifications.length === 0" class="loading-state">
        <div class="notifications-spinner"></div>
        <p>Loading your notifications...</p>
      </div>

      <div v-else-if="filteredNotifications.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>No notifications yet</h3>
        <p>When you receive notifications, they'll appear here.</p>
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
            <div class="notification-type">
              <span :class="['type-badge', notification.notification_type]">
                {{ notification.notification_type.toUpperCase() }}
              </span>
            </div>
            <div class="notification-time">
              {{ formatTime(notification.created_at) }}
            </div>
          </div>

          <div class="notification-content">
            <h4 class="notification-title">{{ notification.title }}</h4>
            <p class="notification-message">{{ getCleanMessage(notification) }}</p>

            <div class="notification-meta">
              <span class="sender">
                From: <strong>{{ notification.sender }}</strong>
              </span>
              <span v-if="notification.notification_type === 'personal'" class="recipient">
                To: <strong>{{ notification.recipient }}</strong>
              </span>
              <span v-else-if="notification.notification_type === 'group'" class="recipient">
                Group: <strong>{{ notification.recipient }}</strong>
              </span>
            </div>
          </div>

          <div class="notification-actions">
            <button
              v-if="notification.notification_type === 'personal' && !notification.read"
              class="btn-mark-read"
              @click="markAsRead(notification.notification_id)"
              :disabled="loading"
            >
              Mark as Read
            </button>
            <button
              v-if="notification.notification_type === 'personal'"
              class="btn-delete"
              @click="deleteNotification(notification.notification_id)"
              :disabled="loading"
            >
              Delete
            </button>
            <span v-if="notification.notification_type !== 'personal'" class="readonly-info">
              {{ notification.notification_type === 'general' ? 'General Notification' : 'Group Notification' }} (Read-only)
            </span>

            <!-- Action buttons (Approve / Ignore / View Course / View Plans / View Appointment) -->
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
              ✓ Handled
            </span>
          </div>
        </div>
      </div>

      <div v-if="loading && filteredNotifications.length > 0" class="loading-more">
        <div class="notifications-spinner small"></div>
        Loading more notifications...
      </div>

      <div v-if="hasMore && !loading && filteredNotifications.length > 0" class="load-more">
        <button @click="loadMore" class="btn-load-more">
          Load More
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      <p>⚠️ {{ error }}</p>
      <button @click="refreshNotifications" class="btn-retry">Retry</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notifications';
import { notificationService, type NotificationResponse } from '@/services/notification.service';
import { paymentService } from '@/services/payment.service';
import { decodeNotificationMessage, type NotificationAction } from '@/utils/notificationMeta';
import '@/assets/css/notifications.css';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const loading = computed(() => notificationStore.loading);
const error = computed(() => notificationStore.error);
const notifications = computed(() => notificationStore.notifications);
const personalNotifications = computed(() => notificationStore.personalNotifications);
const generalNotifications = computed(() => notificationStore.generalNotifications);
const groupNotifications = computed(() => notificationStore.groupNotifications);
const allUserNotifications = computed(() => notificationStore.allUserNotifications);
const unreadCount = computed(() => notificationStore.unreadCount);
const totalCount = computed(() => notificationStore.totalCount);
const generalCount = computed(() => notificationStore.generalCount);
const groupCount = computed(() => notificationStore.groupCount);
const hasMore = computed(() => notificationStore.hasMore);

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

// Filtered notifications based on active filter
const filteredNotifications = computed(() => {
  switch (activeFilter.value) {
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
  if (currentUser.value) {
    loadNotifications();
  }
});

onUnmounted(() => {
  // Don't clear notifications on unmount, just reset pagination
  notificationStore.resetPagination();
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
  if (!currentUser.value) {
    error.value = 'Please log in to view notifications';
    return;
  }

  await notificationStore.fetchNotifications(currentUser.value, true);
  await notificationStore.fetchNotificationStats(currentUser.value);
  hasLoaded.value = true;
}

async function refreshNotifications() {
  if (!currentUser.value) return;

  hasLoaded.value = false;
  activeFilter.value = 'all';
  await loadNotifications();
}

async function loadMore() {
  if (!currentUser.value) return;

  await notificationStore.fetchNotifications(currentUser.value);
}

async function markAsRead(notificationId: string) {
  try {
    await notificationStore.markAsRead(notificationId);
    // Refresh stats after marking as read
    if (currentUser.value) {
      await notificationStore.fetchNotificationStats(currentUser.value);
    }
  } catch (err: any) {
    alert(err.message || 'Failed to mark as read');
    console.error('Failed to mark as read:', err);
  }
}

async function markAllAsRead() {
  if (!currentUser.value) return;

  if (confirm('Are you sure you want to mark all personal notifications as read?')) {
    try {
      await notificationStore.markAllAsRead(currentUser.value);
      // Refresh stats after marking all as read
      await notificationStore.fetchNotificationStats(currentUser.value);
    } catch (err: any) {
      alert(err.message || 'Failed to mark all as read');
      console.error('Failed to mark all as read:', err);
    }
  }
}

async function deleteNotification(notificationId: string) {
  if (!currentUser.value) return;

  if (confirm('Are you sure you want to delete this personal notification?')) {
    try {
      await notificationStore.deleteNotification(notificationId);
      // Refresh stats after deletion
      await notificationStore.fetchNotificationStats(currentUser.value);
    } catch (err: any) {
      alert(err.message || 'Failed to delete notification');
      console.error('Failed to delete notification:', err);
    }
  }
}

function setFilter(filterType: string) {
  activeFilter.value = filterType;
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
  try {
    await notificationService.createActionNotification(
      {
        title: approved ? 'Payment Approved' : 'Payment Not Approved',
        message: approved
          ? `Your payment of JOD ${action.amount} for the "${action.planTitle}" plan has been approved. Your subscription will be activated shortly.`
          : `Your payment request of JOD ${action.amount} for the "${action.planTitle}" plan was not approved. Please contact support or submit a new request.`,
        notification_type: 'personal',
        sender: authStore.user?.username || 'system',
        recipient: action.studentUsername,
        read: false
      },
      {
        actions: [{ type: 'view_plans', label: 'View My Plans', path: '/my-plans' }]
      }
    );
  } catch (err) {
    console.warn('Failed to notify student of payment decision:', err);
  }
}

async function afterAdminPaymentDecision(notification: NotificationResponse) {
  handledActionIds.value.add(notification.notification_id);
  // Mark this admin notification as read (it is personal -> allowed)
  try {
    if (notification.notification_type === 'personal' && !notification.read) {
      await notificationStore.markAsRead(notification.notification_id);
    }
  } catch (err) {
    console.warn('Failed to mark admin notification as read:', err);
  }
}

async function handleAction(notification: NotificationResponse, action: NotificationAction) {
  if (actionLoading.value) return;
  actionLoading.value = notification.notification_id;

  try {
    switch (action.type) {
      case 'approve_payment': {
        if (!action.paymentId) throw new Error('Missing payment reference');
        await paymentService.approvePayment(
          action.paymentId,
          `Approved by admin ${authStore.user?.username} on ${new Date().toLocaleString()}`
        );
        await notifyStudentPaymentDecision(action, true);
        await afterAdminPaymentDecision(notification);
        alert('Payment approved and marked as PAID. The student has been notified.');
        break;
      }
      case 'ignore_payment': {
        if (!action.paymentId) throw new Error('Missing payment reference');
        await paymentService.rejectPayment(
          action.paymentId,
          `Ignored by admin ${authStore.user?.username} on ${new Date().toLocaleString()}`
        );
        await notifyStudentPaymentDecision(action, false);
        await afterAdminPaymentDecision(notification);
        alert('Payment request ignored. The student has been notified.');
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
    alert(err?.message || 'Action failed. Please try again.');
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
  color: #fff;
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
  background: linear-gradient(135deg, #48bb78, #38a169);
}

.btn-meta-action.meta-ignore {
  background: linear-gradient(135deg, #f56565, #c53030);
}

.btn-meta-action.meta-link {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.action-handled-info {
  font-size: 0.8rem;
  font-weight: 600;
  color: #38a169;
}
</style>