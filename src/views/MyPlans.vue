<template>
    <div class="my-plans-modern">
      <!-- Modern Header -->
      <header class="modern-header">
        <div class="header-content">
          <div class="header-text">
            <h1 class="main-title">
              <span class="title-gradient">{{ $t('My Learning Plans') }}</span>
            </h1>
            <p class="subtitle">{{ $t('Manage your subscriptions and track your learning journey') }}</p>
          </div>
          <div class="header-stats">
            <div class="stat-item">
              <div class="stat-icon">📚</div>
              <div class="stat-info">
                <div class="stat-value">{{ activeSubscriptions.length + inactiveSubscriptions.length }}</div>
                <div class="stat-label">{{ $t('Total Plans') }}</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">⏳</div>
              <div class="stat-info">
                <div class="stat-value">{{ pendingPayments.length }}</div>
                <div class="stat-label">{{ $t('Pending') }}</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">✅</div>
              <div class="stat-info">
                <div class="stat-value">{{ paidPayments.length }}</div>
                <div class="stat-label">{{ $t('Verified') }}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content Container -->
      <main class="modern-main">
        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <div class="spinner-container">
            <div class="spinner"></div>
          </div>
          <p class="loading-text">{{ $t('Loading your learning dashboard...') }}</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <div class="error-card">
            <div class="error-icon">⚠️</div>
            <h3>{{ $t('Unable to Load Plans') }}</h3>
            <p>{{ error }}</p>
            <button @click="fetchPlans" class="modern-btn primary-btn">
              {{ $t('Try Again') }}
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="subscriptions.length === 0 && pendingPayments.length === 0 && paidPayments.length === 0" class="empty-state">
          <div class="empty-card">
            <div class="empty-icon">📚</div>
            <h3>{{ $t('No Learning Plans Yet') }}</h3>
            <p>{{ $t('Start your educational journey by exploring our premium plans') }}</p>
            <router-link to="/plans" class="modern-btn primary-btn">
              {{ $t('Browse Learning Plans') }}
            </router-link>
          </div>
        </div>

        <!-- Main Content -->
        <div v-else class="main-content">
          <!-- Pending Payments Section -->
          <section v-if="pendingPayments.length > 0" class="pending-section modern-section">
            <div class="section-header">
              <div class="header-main">
                <h2 class="section-title">
                  <span class="title-icon pending-icon">⏳</span>
                  {{ $t('Pending Payments') }}
                  <span class="badge pending-badge">{{ pendingPayments.length }}</span>
                </h2>
                <p class="section-subtitle">{{ $t('Complete these payments to activate your subscriptions') }}</p>
              </div>
              <div class="progress-tracker">
                <div class="progress-label">
                  <span>{{ $t('{v0} of {v1} pending', { v0: pendingPayments.length, v1: allPayments.length }) }}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: (pendingPayments.length / allPayments.length * 100) + '%' }"></div>
                </div>
              </div>
            </div>

            <div class="payments-grid">
              <div
                v-for="payment in pendingPayments"
                :key="payment.external_id"
                :id="`payment-${payment.external_id}`"
                class="payment-card modern-card pending-card"
              >
                <div class="card-header">
                  <div class="status-badge pending">
                    <span class="badge-dot"></span>
                    {{ $t('PENDING') }}
                  </div>
                  <div class="payment-amount">
                    <span class="currency">JOD</span>
                    <span class="amount">{{ payment.amount }}</span>
                  </div>
                </div>

                <div class="card-body">
                  <div class="payment-info">
                    <div class="info-row">
                      <span class="info-label">{{ $t('Payment ID:') }}</span>
                      <span class="info-value">{{ payment.external_id }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Plan:') }}</span>
                      <span class="info-value plan-name">{{ getPlanTitle(payment.subscription_id) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Method:') }}</span>
                      <span class="info-value method-tag">{{ formatPaymentMethod(payment.payment_method) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Created:') }}</span>
                      <span class="info-value">{{ formatDateTime(payment.created_at) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Expires:') }}</span>
                      <span class="info-value">{{ formatDateTime(payment.expires_at) }}</span>
                    </div>
                  </div>

                  <div class="payment-instructions">
                    <div class="instructions-header">
                      <h4>{{ $t('Payment Instructions') }}</h4>
                    </div>
                    <div class="instructions-content">
                      <div v-if="payment.payment_method === 'IBAN'" class="instructions">
                        <p class="step">{{ $t('1. Transfer') }} <strong>{{ $t('JOD {v0}', { v0: payment.amount }) }}</strong> {{ $t('to:') }}</p>
                        <div class="account-details">
                          <div class="detail-item">
                            <span class="detail-icon">🏦</span>
                            <div class="detail-content">
                              <span class="detail-label">{{ $t('Bank') }}</span>
                              <span class="detail-value">{{ payment.bank_account?.bank_name }}</span>
                            </div>
                          </div>
                          <div class="detail-item">
                            <span class="detail-icon">🔢</span>
                            <div class="detail-content">
                              <span class="detail-label">IBAN</span>
                              <span class="detail-value">{{ payment.bank_account?.IBAN }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-else class="instructions">
                        <p class="step">{{ $t('1. Send') }} <strong>{{ $t('JOD {v0}', { v0: payment.amount }) }}</strong> {{ $t('via Cliq to:') }}</p>
                        <div class="account-details">
                          <div class="detail-item">
                            <span class="detail-icon">👤</span>
                            <div class="detail-content">
                              <span class="detail-label">{{ $t('Username') }}</span>
                              <span class="detail-value">@{{ payment.cliq_account?.username }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="reference-section">
                        <span class="reference-label">{{ $t('Reference Number:') }}</span>
                        <code class="reference-code">{{ payment.reference || payment.external_id }}</code>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="card-footer">
                  <div class="countdown-timer">
                    <div class="timer-header">
                      <span class="timer-icon">⏰</span>
                      <span class="timer-text">{{ $t('Expires in {v0}', { v0: getTimeRemaining(payment.expires_at) }) }}</span>
                    </div>
                    <div class="progress-bar time-bar">
                      <div
                        class="progress-fill time-fill"
                        :style="{ width: getExpiryPercentage(payment.expires_at) + '%' }"
                      ></div>
                    </div>
                  </div>
                  <div class="action-buttons">
                    <button @click="copyPaymentDetails(payment)" class="modern-btn secondary-btn">
                      {{ $t('📋 Copy Details') }}
                    </button>
                    <button
                      @click="cancelPayment(payment.external_id)"
                      class="modern-btn danger-btn"
                      :disabled="cancellingPayment === payment.external_id"
                    >
                      {{ cancellingPayment === payment.external_id ? 'Cancelling...' : '❌ Cancel' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Paid & Verified Payments -->
          <section v-if="paidPayments.length > 0" class="verified-section modern-section">
            <div class="section-header">
              <h2 class="section-title">
                <span class="title-icon verified-icon">✅</span>
                {{ $t('Verified Payments') }}
                <span class="badge verified-badge">{{ paidPayments.length }}</span>
              </h2>
            </div>

            <div class="payments-grid">
              <div
                v-for="payment in paidPayments"
                :key="payment.external_id"
                class="payment-card modern-card"
                :class="payment.status.toLowerCase()"
              >
                <div class="card-header">
                  <div :class="['status-badge', payment.status.toLowerCase()]">
                    <span class="badge-dot"></span>
                    {{ payment.status }}
                  </div>
                  <div class="payment-amount">
                    <span class="currency">JOD</span>
                    <span class="amount">{{ payment.amount }}</span>
                  </div>
                </div>

                <div class="card-body">
                  <div class="payment-info">
                    <div class="info-row">
                      <span class="info-label">{{ $t('Payment ID:') }}</span>
                      <span class="info-value">{{ payment.external_id }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Plan:') }}</span>
                      <span class="info-value plan-name">{{ getPlanTitle(payment.subscription_id) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Method:') }}</span>
                      <span class="info-value method-tag">{{ formatPaymentMethod(payment.payment_method) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Date:') }}</span>
                      <span class="info-value">{{ formatDateTime(payment.created_at) }}</span>
                    </div>
                  </div>

                  <div v-if="payment.status === 'VERIFIED'" class="verification-badge">
                    <span class="check-icon">✓</span>
                    {{ $t('Subscription successfully created') }}
                  </div>
                </div>

                <div class="card-footer">
                  <div class="action-buttons">
                    <button @click="viewPaymentDetails(payment)" class="modern-btn secondary-btn">
                      {{ $t('View Details') }}
                    </button>
                    <button
                      v-if="payment.status === 'PAID'"
                      class="modern-btn outline-btn"
                      @click="contactAdmin"
                    >
                      {{ $t('📞 Contact Admin') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Active Subscriptions -->
          <section v-if="activeSubscriptions.length > 0" class="subscriptions-section modern-section">
            <div class="section-header">
              <h2 class="section-title">
                <span class="title-icon active-icon">🚀</span>
                {{ $t('Active Subscriptions') }}
                <span class="badge active-badge">{{ activeSubscriptions.length }}</span>
              </h2>
              <p v-if="activeSubscriptions.length > 1" class="section-subtitle">
                {{ $t('You have multiple active subscriptions. Click "Use This Plan" to switch between them.') }}
              </p>
            </div>

            <!-- Currently active subscription indicator -->
            <div v-if="currentActiveSubscription" class="current-active-banner">
              <div class="banner-content">
                <span class="banner-icon">⭐</span>
                <div class="banner-text">
                  <span class="banner-label">{{ $t('Currently Active:') }}</span>
                  <strong class="banner-plan">{{ currentActiveSubscription.subscription_type?.title || currentActiveSubscription.title }}</strong>
                </div>
              </div>
            </div>

            <div class="subscriptions-grid">
              <div
                v-for="subscription in activeSubscriptions"
                :key="subscription.external_id"
                class="subscription-card modern-card active-card"
                :class="{ 'is-current-active': isCurrentActive(subscription) }"
              >
                <div class="card-header">
                  <div class="status-badge active">
                    <span class="badge-dot"></span>
                    {{ $t('ACTIVE') }}
                  </div>
                  <div v-if="isCurrentActive(subscription)" class="current-indicator">
                    {{ $t('⭐ IN USE') }}
                  </div>
                  <div class="plan-header">
                    <h3 class="plan-title">{{ subscription.title }}</h3>
                    <div class="plan-price">{{ priceLabel(subscription) }}</div>
                  </div>
                </div>

                <div class="card-body">
                  <div class="subscription-info">
                    <div class="info-row">
                      <span class="info-label">{{ $t('Plan Type:') }}</span>
                      <span class="info-value">{{ subscription.subscription_type?.title || 'N/A' }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Subscription ID:') }}</span>
                      <span class="info-value">{{ subscription.external_id }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Created:') }}</span>
                      <span class="info-value">{{ formatDate(subscription.created_date) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Expires:') }}</span>
                      <span class="info-value">{{ formatDate(subscription.expire_date) }}</span>
                    </div>
                  </div>

                  <div class="features-section">
                    <h4 class="features-title">{{ $t('Included Features') }}</h4>
                    <ul class="features-list">
                      <li
                        v-for="feature in subscription.subscription_type?.features"
                        :key="feature.external_id"
                        class="feature-item"
                      >
                        <span class="feature-icon">✓</span>
                        <div class="feature-content">
                          <span class="feature-name">{{ feature.name }}</span>
                          <span v-if="feature.description" class="feature-description">{{ feature.description }}</span>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                <div class="card-footer">
                  <div class="time-remaining">
                    <div class="time-header">
                      <span class="time-icon">⏳</span>
                      <span class="time-text">{{ getTimeRemainingText(subscription.expire_date) }}</span>
                    </div>
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        :style="{ width: getTimeRemainingPercentage(subscription.expire_date) + '%' }"
                      ></div>
                    </div>
                  </div>

                  <!-- Switch / activate button -->
                  <div class="action-buttons">
                    <button
                      v-if="!isCurrentActive(subscription)"
                      @click="switchToSubscription(subscription)"
                      class="modern-btn primary-btn"
                      :disabled="switchingTo === subscription.external_id"
                    >
                      {{ switchingTo === subscription.external_id ? 'Activating...' : '✨ Use This Plan' }}
                    </button>
                    <span v-else class="modern-btn success-btn disabled-look">
                      {{ $t('⭐ Currently Active') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Expired/Inactive Subscriptions -->
          <section v-if="inactiveSubscriptions.length > 0" class="subscriptions-section modern-section">
            <div class="section-header">
              <h2 class="section-title">
                <span class="title-icon expired-icon">📅</span>
                {{ $t('Previous Subscriptions') }}
                <span class="badge expired-badge">{{ inactiveSubscriptions.length }}</span>
              </h2>
            </div>

            <div class="subscriptions-grid">
              <div
                v-for="subscription in inactiveSubscriptions"
                :key="subscription.external_id"
                class="subscription-card modern-card expired-card"
              >
                <div class="card-header">
                  <div class="status-badge expired">
                    <span class="badge-dot"></span>
                    {{ $t('EXPIRED') }}
                  </div>
                  <div class="plan-header">
                    <h3 class="plan-title">{{ subscription.title }}</h3>
                    <div class="plan-price">{{ priceLabel(subscription) }}</div>
                  </div>
                </div>

                <div class="card-body">
                  <div class="subscription-info">
                    <div class="info-row">
                      <span class="info-label">{{ $t('Subscription ID:') }}</span>
                      <span class="info-value">{{ subscription.external_id }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">{{ $t('Duration:') }}</span>
                      <span class="info-value">{{ formatDate(subscription.created_date) }} - {{ formatDate(subscription.expire_date) }}</span>
                    </div>
                  </div>
                </div>

                <div class="card-footer">
                  <div class="action-buttons">
                    <button
                      class="modern-btn primary-btn"
                      @click="renewSubscription(subscription.subscription_type?.external_id)"
                      :disabled="hasPendingPayment"
                    >
                      🔄 {{ hasPendingPayment ? 'Pending Payment Exists' : 'Renew Plan' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Payment History -->
          <section v-if="allPayments.length > 0" class="history-section modern-section">
            <div class="section-header">
              <h2 class="section-title">
                <span class="title-icon history-icon">📊</span>
                {{ $t('Payment History') }}
                <span class="badge history-badge">{{ allPayments.length }}</span>
              </h2>
            </div>

            <div class="history-table">
              <div class="table-header">
                <div class="header-cell">{{ $t('Payment ID') }}</div>
                <div class="header-cell">{{ $t('Plan') }}</div>
                <div class="header-cell">{{ $t('Amount') }}</div>
                <div class="header-cell">{{ $t('Method') }}</div>
                <div class="header-cell">{{ $t('Status') }}</div>
                <div class="header-cell">{{ $t('Date') }}</div>
                <div class="header-cell">{{ $t('Actions') }}</div>
              </div>

              <div class="table-body">
                <div
                  v-for="payment in allPayments"
                  :key="payment.external_id"
                  class="table-row"
                  :class="getPaymentRowClass(payment.status)"
                >
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">{{ $t('Payment ID:') }}</span>
                      <span class="cell-value">{{ payment.external_id }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">{{ $t('Plan:') }}</span>
                      <span class="cell-value">{{ getPlanTitle(payment.subscription_id) }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">{{ $t('Amount:') }}</span>
                      <span class="cell-value amount-value">{{ $t('JOD {v0}', { v0: payment.amount }) }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">{{ $t('Method:') }}</span>
                      <span class="cell-value">{{ payment.payment_method }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">{{ $t('Status:') }}</span>
                      <span :class="['status-tag', payment.status.toLowerCase()]">
                        {{ payment.status }}
                      </span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">{{ $t('Date:') }}</span>
                      <span class="cell-value">{{ formatDateTime(payment.created_at) }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <div class="action-buttons compact">
                        <button
                          class="action-btn view-btn"
                          @click="viewPaymentDetails(payment)"
                          :title="$t('View Details')"
                        >
                          👁️
                        </button>
                        <button
                          v-if="payment.status === 'PENDING'"
                          @click="cancelPayment(payment.external_id)"
                          class="action-btn cancel-btn"
                          :disabled="cancellingPayment === payment.external_id"
                          :title="$t('Cancel Payment')"
                        >
                          {{ cancellingPayment === payment.external_id ? '⏳' : '❌' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import {
  subscriptionService,
  isFreeTrialSubscription,
  FREE_TRIAL_DAYS,
  type Subscription,
} from '@/services/subscription.service';
import { paymentService, type Payment } from '@/services/payment.service';

const router = useRouter();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const subscriptions = ref<Subscription[]>([]);
const allPayments = ref<Payment[]>([]);
const cancellingPayment = ref<string | null>(null);
const switchingTo = ref<string | null>(null);
const currentActiveSubscription = ref<Subscription | null>(null);

/**
 * What was paid, and over what term.
 *
 * Plans are sold by the year — /plans says "/ year" — so this said "/month"
 * about the same number the pricing page prices annually. The trial is neither:
 * it is free, and it runs for days rather than for a term.
 */
const priceLabel = (subscription: Subscription): string => {
  if (isFreeTrialSubscription(subscription)) return `Free · ${FREE_TRIAL_DAYS} days`;
  const price = subscription.subscription_type?.price;
  return price ? `JOD ${price}/year` : 'Free';
};

// Computed
const pendingPayments = computed(() =>
  allPayments.value.filter(p => p.status === 'PENDING')
);

const paidPayments = computed(() =>
  allPayments.value.filter(p => p.status === 'PAID' || p.status === 'VERIFIED')
);

/**
 * Active = is_active AND not expired
 * Sorted newest first so the newest appears first in the UI.
 */
const activeSubscriptions = computed(() => {
  const now = new Date();
  return subscriptions.value
    .filter(sub => {
      const expireDate = new Date(sub.expire_date);
      return sub.is_active && expireDate > now;
    })
    .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
});

const inactiveSubscriptions = computed(() => {
  const now = new Date();
  return subscriptions.value
    .filter(sub => {
      const expireDate = new Date(sub.expire_date);
      return !sub.is_active || expireDate <= now;
    })
    .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
});

const hasPendingPayment = computed(() => pendingPayments.value.length > 0);

// Helpers
const isCurrentActive = (sub: Subscription): boolean => {
  return currentActiveSubscription.value?.external_id === sub.external_id;
};

// Fetch
const fetchPlans = async () => {
  loading.value = true;
  error.value = null;

  try {
    if (!authStore.user?.id) {
      throw new Error('User not authenticated');
    }

    subscriptions.value = await subscriptionService.getUserSubscriptions(authStore.user.id);
    allPayments.value = await paymentService.getUserPayments(authStore.user.id);

    // Determine current active subscription (selected or newest non-expired)
    currentActiveSubscription.value = await subscriptionService.getActiveUserSubscription(authStore.user.id);
  } catch (err: any) {
    error.value = err.message || 'Failed to load your plans';
    console.error('Error fetching plans:', err);
  } finally {
    loading.value = false;
  }
};

// Switch between non-expired subscriptions
const switchToSubscription = async (sub: Subscription) => {
  if (!authStore.user?.id) return;

  // Guard: must not be expired
  const now = new Date();
  if (new Date(sub.expire_date) <= now) {
    alert('This subscription has expired and cannot be activated.');
    return;
  }
  if (!sub.is_active) {
    alert('This subscription is not active.');
    return;
  }

  switchingTo.value = sub.external_id;
  try {
    const activated = await subscriptionService.switchActiveSubscription(
      authStore.user.id,
      sub.external_id
    );
    currentActiveSubscription.value = activated;

    // Refresh user features in auth store so feature gates update immediately
    await authStore.loadUserFeatures();

    alert(`Switched to "${activated.subscription_type?.title || activated.title}" successfully!`);
  } catch (err: any) {
    console.error('Failed to switch subscription:', err);
    alert(err.message || 'Failed to switch subscription. Please try again.');
  } finally {
    switchingTo.value = null;
  }
};

// Formatting helpers
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

const formatDateTime = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

const formatPaymentMethod = (method: string) =>
  method === 'IBAN' ? 'Bank Transfer' : 'Cliq Transfer';

const getPlanTitle = (planExternalId: string): string => {
  const subscription = subscriptions.value.find(sub =>
    sub.subscription_type?.external_id === planExternalId
  );
  if (subscription) return subscription.subscription_type.title;
  return `Plan ${planExternalId.substring(0, 8)}...`;
};

const getPaymentRowClass = (status: string): string => {
  switch (status) {
    case 'PENDING': return 'pending-row';
    case 'PAID': return 'paid-row';
    case 'VERIFIED': return 'verified-row';
    case 'REJECTED': return 'rejected-row';
    case 'EXPIRED': return 'expired-row';
    default: return '';
  }
};

const getSubscriptionForPayment = (payment: Payment): Subscription | undefined =>
  subscriptions.value.find(sub =>
    sub.subscription_type?.external_id === payment.subscription_id
  );

const getTimeRemainingPercentage = (expireDate: string): number => {
  const now = new Date();
  const expiry = new Date(expireDate);
  const created = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const totalDuration = expiry.getTime() - created.getTime();
  const remainingDuration = expiry.getTime() - now.getTime();
  if (remainingDuration <= 0) return 0;
  if (remainingDuration >= totalDuration) return 100;
  return Math.round((remainingDuration / totalDuration) * 100);
};

const getExpiryPercentage = (expireDate: string): number => {
  const now = new Date();
  const expiry = new Date(expireDate);
  const created = new Date(expiry.getTime() - 3 * 24 * 60 * 60 * 1000);
  const totalDuration = expiry.getTime() - created.getTime();
  const elapsedDuration = now.getTime() - created.getTime();
  if (elapsedDuration <= 0) return 0;
  if (elapsedDuration >= totalDuration) return 100;
  return Math.round((elapsedDuration / totalDuration) * 100);
};

const getTimeRemainingText = (expireDate: string): string => {
  const now = new Date();
  const expiry = new Date(expireDate);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return `${diffHours} hours remaining`;
  } else if (diffDays === 1) {
    return '1 day remaining';
  }
  return `${diffDays} days remaining`;
};

const getTimeRemaining = (expireDate: string): string => {
  const now = new Date();
  const expiry = new Date(expireDate);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  }
  return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
};

const renewSubscription = (subscriptionTypeExternalId?: string) => {
  if (!subscriptionTypeExternalId) {
    alert('Unable to determine plan type for renewal.');
    return;
  }
  if (hasPendingPayment.value) {
    alert('You have a pending payment. Please complete or cancel it before renewing a plan.');
    return;
  }
  router.push({
    path: '/payment',
    query: { plan: subscriptionTypeExternalId }
  });
};

const copyPaymentDetails = async (payment: Payment) => {
  const details = `
Payment ID: ${payment.external_id}
Plan: ${getPlanTitle(payment.subscription_id)}
Amount: JOD ${payment.amount}
Payment Method: ${formatPaymentMethod(payment.payment_method)}
Reference: ${payment.reference || payment.external_id}
Expires: ${formatDateTime(payment.expires_at)}
${payment.payment_method === 'IBAN' ? `
Bank Details:
  Bank: ${payment.bank_account?.bank_name}
  IBAN: ${payment.bank_account?.IBAN}
  Account Holder: ${payment.bank_account?.full_name}
  Branch: ${payment.bank_account?.branch}, ${payment.bank_account?.city}
` : `
Cliq Details:
  Username: @${payment.cliq_account?.username}
  Name: ${payment.cliq_account?.full_name}
`}
  `.trim();

  try {
    await navigator.clipboard.writeText(details);
    alert('Payment details copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
    alert('Failed to copy details. Please try again.');
  }
};

const cancelPayment = async (paymentExternalId: string) => {
  if (!confirm('Are you sure you want to cancel this payment? This action cannot be undone.')) {
    return;
  }
  cancellingPayment.value = paymentExternalId;
  try {
    await paymentService.cancelPayment(paymentExternalId, `Cancelled by user on ${new Date().toLocaleDateString()}`);
    alert('Payment cancelled successfully!');
    await fetchPlans();
  } catch (err: any) {
    console.error('Error cancelling payment:', err);
    if (err.status === 400) {
      try {
        if (confirm('Update failed. Would you like to try deleting the payment instead?')) {
          await paymentService.deletePayment(paymentExternalId);
          alert('Payment deleted successfully!');
          await fetchPlans();
        }
      } catch (deleteErr) {
        alert('Failed to cancel payment. Please try again or contact support.');
      }
    } else {
      alert('Failed to cancel payment. Please try again or contact support.');
    }
  } finally {
    cancellingPayment.value = null;
  }
};

const viewPaymentDetails = (payment: Payment) => {
  const subscription = getSubscriptionForPayment(payment);
  const details = `
Payment Details:
---------------
ID: ${payment.external_id}
Plan: ${getPlanTitle(payment.subscription_id)}
Amount: JOD ${payment.amount}
Status: ${payment.status}
Method: ${formatPaymentMethod(payment.payment_method)}
Created: ${formatDateTime(payment.created_at)}
Expires: ${formatDateTime(payment.expires_at)}
${payment.reference ? `Reference: ${payment.reference}\n` : ''}
${payment.notes ? `Notes: ${payment.notes}\n` : ''}
Account Details:
${payment.payment_method === 'IBAN' && payment.bank_account ? `
  Bank: ${payment.bank_account.bank_name}
  IBAN: ${payment.bank_account.IBAN}
  Account Holder: ${payment.bank_account.full_name}
  Branch: ${payment.bank_account.branch}
  City: ${payment.bank_account.city}
  Country: ${payment.bank_account.country}
` : payment.payment_method === 'CLIQ' && payment.cliq_account ? `
  Username: @${payment.cliq_account.username}
  Name: ${payment.cliq_account.full_name}
` : 'N/A'}
${subscription ? `
Associated Subscription:
  ID: ${subscription.external_id}
  Status: ${subscription.is_active ? 'Active' : 'Inactive'}
  Expires: ${formatDate(subscription.expire_date)}
` : payment.status === 'VERIFIED' ? `
Note: This payment has been verified. A subscription should be active.
` : payment.status === 'PAID' ? `
Note: This payment has been marked as PAID. Waiting for admin verification.
` : ''}
  `.trim();

  alert(details);
};

const contactAdmin = () => {
  alert('Please contact support@selfstudyjo.com for any payment verification issues.');
};

onMounted(() => {
  fetchPlans();

  const hash = window.location.hash;
  if (hash.startsWith('#payment-')) {
    setTimeout(() => {
      const element = document.getElementById(hash.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 2000);
      }
    }, 500);
  }
});
</script>

<style src="@/assets/css/my-plans.css"></style>

<style scoped>
/* Styles for the new "current active" indicator and switch button */
.current-active-banner {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, var(--sfs-warning-wash, #fef3c7) 0%, var(--sfs-warning-wash, #fde68a) 100%);
  border: 2px solid var(--sfs-warning-wash, #f59e0b);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.banner-icon {
  font-size: 28px;
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--sfs-warning-text, #78350f);
  font-weight: 600;
}

.banner-plan {
  font-size: 18px;
  color: var(--sfs-warning-text, #78350f);
}

.subscription-card.is-current-active {
  border: 2px solid var(--sfs-warning, #f59e0b) !important;
  box-shadow: 0 8px 16px -4px rgb(var(--sfs-warning-rgb, 245 158 11) / 0.3) !important;
  position: relative;
}

.current-indicator {
  background: linear-gradient(135deg, var(--sfs-warning, #f59e0b) 0%, var(--sfs-warning, #d97706) 100%);
  color: var(--sfs-on-warning, white);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-inline-start: 8px;
}

.success-btn {
  background: linear-gradient(135deg, var(--sfs-success, #10b981) 0%, var(--sfs-success, #059669) 100%);
  color: var(--sfs-on-success, white);
  cursor: default;
}

.success-btn.disabled-look {
  opacity: 0.9;
  cursor: default;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
}

.section-subtitle {
  color: var(--sfs-accent-text, #64748b);
  font-size: 14px;
  margin-top: 4px;
}
</style>
