<template>
    <div class="my-plans-modern">
      <!-- Modern Header -->
      <header class="modern-header">
        <div class="header-content">
          <div class="header-text">
            <h1 class="main-title">
              <span class="title-gradient">My Learning Plans</span>
            </h1>
            <p class="subtitle">Manage your subscriptions and track your learning journey</p>
          </div>
          <div class="header-stats">
            <div class="stat-item">
              <div class="stat-icon">📚</div>
              <div class="stat-info">
                <div class="stat-value">{{ activeSubscriptions.length + inactiveSubscriptions.length }}</div>
                <div class="stat-label">Total Plans</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">⏳</div>
              <div class="stat-info">
                <div class="stat-value">{{ pendingPayments.length }}</div>
                <div class="stat-label">Pending</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">✅</div>
              <div class="stat-info">
                <div class="stat-value">{{ paidPayments.length }}</div>
                <div class="stat-label">Verified</div>
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
          <p class="loading-text">Loading your learning dashboard...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <div class="error-card">
            <div class="error-icon">⚠️</div>
            <h3>Unable to Load Plans</h3>
            <p>{{ error }}</p>
            <button @click="fetchPlans" class="modern-btn primary-btn">
              Try Again
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="subscriptions.length === 0 && pendingPayments.length === 0 && paidPayments.length === 0" class="empty-state">
          <div class="empty-card">
            <div class="empty-icon">📚</div>
            <h3>No Learning Plans Yet</h3>
            <p>Start your educational journey by exploring our premium plans</p>
            <router-link to="/plans" class="modern-btn primary-btn">
              Browse Learning Plans
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
                  Pending Payments
                  <span class="badge pending-badge">{{ pendingPayments.length }}</span>
                </h2>
                <p class="section-subtitle">Complete these payments to activate your subscriptions</p>
              </div>
              <div class="progress-tracker">
                <div class="progress-label">
                  <span>{{ pendingPayments.length }} of {{ allPayments.length }} pending</span>
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
                    PENDING
                  </div>
                  <div class="payment-amount">
                    <span class="currency">JOD</span>
                    <span class="amount">{{ payment.amount }}</span>
                  </div>
                </div>

                <div class="card-body">
                  <div class="payment-info">
                    <div class="info-row">
                      <span class="info-label">Payment ID:</span>
                      <span class="info-value">{{ payment.external_id }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Plan:</span>
                      <span class="info-value plan-name">{{ getPlanTitle(payment.subscription_id) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Method:</span>
                      <span class="info-value method-tag">{{ formatPaymentMethod(payment.payment_method) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Created:</span>
                      <span class="info-value">{{ formatDateTime(payment.created_at) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Expires:</span>
                      <span class="info-value">{{ formatDateTime(payment.expires_at) }}</span>
                    </div>
                  </div>

                  <div class="payment-instructions">
                    <div class="instructions-header">
                      <h4>Payment Instructions</h4>
                    </div>
                    <div class="instructions-content">
                      <div v-if="payment.payment_method === 'IBAN'" class="instructions">
                        <p class="step">1. Transfer <strong>JOD {{ payment.amount }}</strong> to:</p>
                        <div class="account-details">
                          <div class="detail-item">
                            <span class="detail-icon">🏦</span>
                            <div class="detail-content">
                              <span class="detail-label">Bank</span>
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
                        <p class="step">1. Send <strong>JOD {{ payment.amount }}</strong> via Cliq to:</p>
                        <div class="account-details">
                          <div class="detail-item">
                            <span class="detail-icon">👤</span>
                            <div class="detail-content">
                              <span class="detail-label">Username</span>
                              <span class="detail-value">@{{ payment.cliq_account?.username }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="reference-section">
                        <span class="reference-label">Reference Number:</span>
                        <code class="reference-code">{{ payment.reference || payment.external_id }}</code>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="card-footer">
                  <div class="countdown-timer">
                    <div class="timer-header">
                      <span class="timer-icon">⏰</span>
                      <span class="timer-text">Expires in {{ getTimeRemaining(payment.expires_at) }}</span>
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
                      📋 Copy Details
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
                Verified Payments
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
                      <span class="info-label">Payment ID:</span>
                      <span class="info-value">{{ payment.external_id }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Plan:</span>
                      <span class="info-value plan-name">{{ getPlanTitle(payment.subscription_id) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Method:</span>
                      <span class="info-value method-tag">{{ formatPaymentMethod(payment.payment_method) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Date:</span>
                      <span class="info-value">{{ formatDateTime(payment.created_at) }}</span>
                    </div>
                  </div>

                  <div v-if="payment.status === 'VERIFIED'" class="verification-badge">
                    <span class="check-icon">✓</span>
                    Subscription successfully created
                  </div>
                </div>

                <div class="card-footer">
                  <div class="action-buttons">
                    <button @click="viewPaymentDetails(payment)" class="modern-btn secondary-btn">
                      View Details
                    </button>
                    <button
                      v-if="payment.status === 'PAID'"
                      class="modern-btn outline-btn"
                      @click="contactAdmin"
                    >
                      📞 Contact Admin
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
                Active Subscriptions
                <span class="badge active-badge">{{ activeSubscriptions.length }}</span>
              </h2>
            </div>

            <div class="subscriptions-grid">
              <div
                v-for="subscription in activeSubscriptions"
                :key="subscription.external_id"
                class="subscription-card modern-card active-card"
              >
                <div class="card-header">
                  <div class="status-badge active">
                    <span class="badge-dot"></span>
                    ACTIVE
                  </div>
                  <div class="plan-header">
                    <h3 class="plan-title">{{ subscription.title }}</h3>
                    <div class="plan-price">JOD {{ subscription.subscription_type.price }}/month</div>
                  </div>
                </div>

                <div class="card-body">
                  <div class="subscription-info">
                    <div class="info-row">
                      <span class="info-label">Subscription ID:</span>
                      <span class="info-value">{{ subscription.external_id }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Created:</span>
                      <span class="info-value">{{ formatDate(subscription.created_date) }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Expires:</span>
                      <span class="info-value">{{ formatDate(subscription.expire_date) }}</span>
                    </div>
                  </div>

                  <div class="features-section">
                    <h4 class="features-title">Included Features</h4>
                    <ul class="features-list">
                      <li v-for="feature in subscription.subscription_type.features" :key="feature.external_id" class="feature-item">
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
                </div>
              </div>
            </div>
          </section>

          <!-- Expired/Inactive Subscriptions -->
          <section v-if="inactiveSubscriptions.length > 0" class="subscriptions-section modern-section">
            <div class="section-header">
              <h2 class="section-title">
                <span class="title-icon expired-icon">📅</span>
                Previous Subscriptions
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
                    EXPIRED
                  </div>
                  <div class="plan-header">
                    <h3 class="plan-title">{{ subscription.title }}</h3>
                    <div class="plan-price">JOD {{ subscription.subscription_type.price }}/month</div>
                  </div>
                </div>

                <div class="card-body">
                  <div class="subscription-info">
                    <div class="info-row">
                      <span class="info-label">Subscription ID:</span>
                      <span class="info-value">{{ subscription.external_id }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Duration:</span>
                      <span class="info-value">{{ formatDate(subscription.created_date) }} - {{ formatDate(subscription.expire_date) }}</span>
                    </div>
                  </div>
                </div>

                <div class="card-footer">
                  <div class="action-buttons">
                    <button
                      class="modern-btn primary-btn"
                      @click="renewSubscription(subscription.subscription_type.external_id)"
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
                Payment History
                <span class="badge history-badge">{{ allPayments.length }}</span>
              </h2>
            </div>

            <div class="history-table">
              <div class="table-header">
                <div class="header-cell">Payment ID</div>
                <div class="header-cell">Plan</div>
                <div class="header-cell">Amount</div>
                <div class="header-cell">Method</div>
                <div class="header-cell">Status</div>
                <div class="header-cell">Date</div>
                <div class="header-cell">Actions</div>
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
                      <span class="cell-label">Payment ID:</span>
                      <span class="cell-value">{{ payment.external_id }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">Plan:</span>
                      <span class="cell-value">{{ getPlanTitle(payment.subscription_id) }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">Amount:</span>
                      <span class="cell-value amount-value">JOD {{ payment.amount }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">Method:</span>
                      <span class="cell-value">{{ payment.payment_method }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">Status:</span>
                      <span :class="['status-tag', payment.status.toLowerCase()]">
                        {{ payment.status }}
                      </span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <span class="cell-label">Date:</span>
                      <span class="cell-value">{{ formatDateTime(payment.created_at) }}</span>
                    </div>
                  </div>
                  <div class="table-cell">
                    <div class="cell-content">
                      <div class="action-buttons compact">
                        <button
                          class="action-btn view-btn"
                          @click="viewPaymentDetails(payment)"
                          title="View Details"
                        >
                          👁️
                        </button>
                        <button
                          v-if="payment.status === 'PENDING'"
                          @click="cancelPayment(payment.external_id)"
                          class="action-btn cancel-btn"
                          :disabled="cancellingPayment === payment.external_id"
                          title="Cancel Payment"
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
import { subscriptionService, type SubscriptionType, type Subscription } from '@/services/subscription.service';
import { paymentService, type Payment } from '@/services/payment.service';

const router = useRouter();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const subscriptions = ref<Subscription[]>([]);
const allPayments = ref<Payment[]>([]);
const cancellingPayment = ref<string | null>(null);

// Computed properties
const pendingPayments = computed(() => {
  return allPayments.value.filter(payment => payment.status === 'PENDING');
});

const paidPayments = computed(() => {
  return allPayments.value.filter(payment =>
    payment.status === 'PAID' || payment.status === 'VERIFIED'
  );
});

const activeSubscriptions = computed(() => {
  const now = new Date();
  return subscriptions.value.filter(sub => {
    const expireDate = new Date(sub.expire_date);
    return sub.is_active && expireDate > now;
  });
});

const inactiveSubscriptions = computed(() => {
  const now = new Date();
  return subscriptions.value.filter(sub => {
    const expireDate = new Date(sub.expire_date);
    return !sub.is_active || expireDate <= now;
  });
});

const hasPendingPayment = computed(() => {
  return pendingPayments.value.length > 0;
});

// Methods
const fetchPlans = async () => {
  loading.value = true;
  error.value = null;

  try {
    if (!authStore.user?.id) {
      throw new Error('User not authenticated');
    }

    // Fetch user subscriptions
    subscriptions.value = await subscriptionService.getUserSubscriptions(authStore.user.id);

    // Fetch user payments
    allPayments.value = await paymentService.getUserPayments(authStore.user.id);

  } catch (err: any) {
    error.value = err.message || 'Failed to load your plans';
    console.error('Error fetching plans:', err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatPaymentMethod = (method: string) => {
  return method === 'IBAN' ? 'Bank Transfer' : 'Cliq Transfer';
};

const getPlanTitle = (planExternalId: string): string => {
  // Try to find plan in subscriptions first
  const subscription = subscriptions.value.find(sub =>
    sub.subscription_type.external_id === planExternalId
  );
  if (subscription) {
    return subscription.subscription_type.title;
  }

  // Try to find in all payments by looking at subscription types
  // (In a real app, you'd fetch the subscription type details)
  const payment = allPayments.value.find(p => p.subscription_id === planExternalId);
  if (payment) {
    return `Plan ${planExternalId.substring(0, 8)}...`;
  }

  return `Plan ${planExternalId.substring(0, 8)}...`;
};

const getAccountDetails = (payment: Payment): string => {
  if (payment.payment_method === 'IBAN' && payment.bank_account) {
    return `${payment.bank_account.bank_name} - ${payment.bank_account.IBAN}`;
  } else if (payment.payment_method === 'CLIQ' && payment.cliq_account) {
    return `@${payment.cliq_account.username}`;
  }
  return 'N/A';
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

const getSubscriptionForPayment = (payment: Payment): Subscription | undefined => {
  return subscriptions.value.find(sub =>
    sub.subscription_type.external_id === payment.subscription_id
  );
};

const getTimeRemainingPercentage = (expireDate: string): number => {
  const now = new Date();
  const expiry = new Date(expireDate);
  const created = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Assuming 30 days duration

  const totalDuration = expiry.getTime() - created.getTime();
  const remainingDuration = expiry.getTime() - now.getTime();

  if (remainingDuration <= 0) return 0;
  if (remainingDuration >= totalDuration) return 100;

  return Math.round((remainingDuration / totalDuration) * 100);
};

const getExpiryPercentage = (expireDate: string): number => {
  const now = new Date();
  const expiry = new Date(expireDate);
  const created = new Date(expiry.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days duration for payments

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
  } else {
    return `${diffDays} days remaining`;
  }
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
  } else {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  }
};

const renewSubscription = (subscriptionTypeExternalId: string) => {
  if (hasPendingPayment.value) {
    alert('You have a pending payment. Please complete or cancel it before renewing a plan.');
    return;
  }

  router.push({
    path: '/payment',
    query: {
      plan: subscriptionTypeExternalId
    }
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
    // Call the payment service to cancel the payment
    await paymentService.cancelPayment(paymentExternalId, `Cancelled by user on ${new Date().toLocaleDateString()}`);

    alert('Payment cancelled successfully!');

    // Refresh the data
    await fetchPlans();
  } catch (err: any) {
    console.error('Error cancelling payment:', err);

    if (err.status === 400) {
      // Try to delete instead if update fails
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

  // Check for hash in URL to scroll to specific payment
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
