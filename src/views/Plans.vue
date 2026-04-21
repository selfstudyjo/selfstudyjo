<template>
  <div class="plans-container">
    <!-- Header -->
    <header class="header">
      <h1 class="title">Choose Your Plan</h1>
      <p class="subtitle">Unlock your learning potential with the perfect plan tailored for your journey</p>
    </header>

    <!-- Pending Payment Banner -->
    <div v-if="hasPendingPayment" class="pending-payment-banner" role="alert">
      <div class="banner-content">
        <div class="banner-icon" aria-hidden="true">⏳</div>
        <div class="banner-text">
          <h3>Payment Pending</h3>
          <p>You have a pending payment for the <strong>{{ pendingPaymentPlan?.title }}</strong> plan.</p>
          <div class="banner-details">
            <span class="detail-item">
              Amount: <strong>JOD {{ pendingPayment?.amount }}</strong>
            </span>
            <span class="detail-item">
              Status: <span class="status pending">{{ pendingPayment?.status }}</span>
            </span>
            <span class="detail-item">
              Created: {{ formatDate(pendingPayment?.created_at || '') }}
            </span>
          </div>
        </div>
        <div class="banner-actions">
          <button @click="viewPaymentDetails" class="btn view-payment-btn" type="button">
            <span class="btn-icon" aria-hidden="true">🔍</span>
            <span>View Details</span>
          </button>
          <button
            @click="cancelPayment(pendingPayment?.external_id || '')"
            class="btn cancel-payment-btn"
            :disabled="!!cancellingPayment"
            type="button"
          >
            <span class="btn-icon" aria-hidden="true">{{ cancellingPayment ? '⏳' : '✕' }}</span>
            <span>{{ cancellingPayment ? 'Cancelling...' : 'Cancel' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-container" role="status" aria-live="polite">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p class="loading-text">Loading plans...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-container" role="alert">
      <div class="error-icon" aria-hidden="true">⚠️</div>
      <h3 class="error-title">Unable to load plans</h3>
      <p class="error-message">{{ error }}</p>
      <button @click="fetchPlans" class="btn retry-btn" type="button">
        <span class="btn-icon" aria-hidden="true">🔄</span>
        <span>Try Again</span>
      </button>
    </div>

    <!-- Plans Grid -->
    <div v-else class="plans-grid">
      <article
        v-for="plan in plans"
        :key="plan.external_id"
        :class="['plan-card', {
          'disabled': !canSelectPlan(plan.external_id),
          'pending': hasPendingPaymentForPlan(plan.external_id)
        }]"
        @mousemove="handleCardMove"
      >
        <div v-if="hasPendingPaymentForPlan(plan.external_id)" class="pending-badge">
          ⏳ Pending
        </div>

        <div class="plan-header">
          <h3 class="plan-title">{{ plan.title }}</h3>
          <div class="price">
            <span class="currency">JOD</span>
            <span class="amount">{{ plan.price }}</span>
            <span class="period">/ month</span>
          </div>
        </div>

        <div class="plan-description">
          <p>{{ plan.description }}</p>
        </div>

        <div class="plan-features">
          <h4 class="features-title">What's included</h4>
          <ul class="features-list">
            <li
              v-for="feature in plan.features"
              :key="feature.external_id"
              class="feature-item"
            >
              <span class="feature-icon" aria-hidden="true">✓</span>
              <span>
                <span class="feature-name">{{ feature.name }}</span>
                <span class="feature-description" v-if="feature.description">
                  — {{ feature.description }}
                </span>
              </span>
            </li>
          </ul>
        </div>

        <div class="plan-actions">
          <div v-if="!canSelectPlan(plan.external_id)" class="disabled-reason">
            <div class="reason-icon" aria-hidden="true">ⓘ</div>
            <div class="reason-text">{{ getDisabledReason(plan.external_id) }}</div>
          </div>

          <button
            v-else
            class="btn select-btn"
            @click="selectPlan(plan)"
            :disabled="!canSelectPlan(plan.external_id)"
            type="button"
          >
            <span class="btn-icon" aria-hidden="true">🚀</span>
            <span>Select Plan</span>
          </button>
        </div>
      </article>
    </div>

    <!-- Current Subscriptions -->
    <section v-if="userSubscriptions.length > 0" class="current-subscriptions">
      <h3 class="subscriptions-title">Your Current Subscriptions</h3>
      <div class="subscriptions-list">
        <div
          v-for="subscription in userSubscriptions"
          :key="subscription.external_id"
          class="subscription-item"
        >
          <div class="subscription-info">
            <h4 class="subscription-name">{{ subscription.title }}</h4>
            <p class="subscription-status">
              <span>Status:</span>
              <span :class="['status', subscription.is_active ? 'active' : 'inactive']">
                {{ subscription.is_active ? 'Active' : 'Inactive' }}
              </span>
            </p>
            <p class="subscription-expiry">
              <span>Expires:</span>
              <span>{{ formatDate(subscription.expire_date) }}</span>
            </p>
          </div>
          <div class="subscription-actions">
            <router-link :to="`/my-plans`" class="btn view-details-btn">
              <span class="btn-icon" aria-hidden="true">📄</span>
              <span>View Details</span>
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Payment History -->
    <section v-if="allPayments.length > 0" class="all-payments-section">
      <h3 class="payments-title">Payment History</h3>
      <div class="payments-table" role="table">
        <div class="table-header" role="row">
          <div class="header-cell" role="columnheader">Payment ID</div>
          <div class="header-cell" role="columnheader">Plan</div>
          <div class="header-cell" role="columnheader">Amount</div>
          <div class="header-cell" role="columnheader">Method</div>
          <div class="header-cell" role="columnheader">Status</div>
          <div class="header-cell" role="columnheader">Date</div>
          <div class="header-cell" role="columnheader">Actions</div>
        </div>

        <div class="table-body">
          <div
            v-for="payment in allPayments"
            :key="payment.external_id"
            class="table-row"
            :class="getPaymentRowClass(payment.status)"
            role="row"
          >
            <div class="table-cell" role="cell">
              <span class="cell-label">Payment ID</span>
              <span class="cell-value payment-id">{{ truncateId(payment.external_id) }}</span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">Plan</span>
              <span class="cell-value plan-name">{{ getPlanTitle(payment.subscription_id) }}</span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">Amount</span>
              <span class="cell-value payment-amount">JOD {{ payment.amount }}</span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">Method</span>
              <span class="cell-value payment-method">{{ payment.payment_method }}</span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">Status</span>
              <span :class="['status', payment.status.toLowerCase()]">
                {{ payment.status }}
              </span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">Date</span>
              <span class="cell-value payment-date">{{ formatDate(payment.created_at) }}</span>
            </div>
            <div class="table-cell actions" role="cell">
              <span class="cell-label">Actions</span>
              <button
                class="btn view-details-btn"
                @click="viewPaymentDetailsById(payment.external_id)"
                type="button"
                aria-label="View payment details"
              >
                <span class="btn-icon" aria-hidden="true">👁️</span>
                <span>View</span>
              </button>
              <button
                v-if="payment.status === 'PENDING'"
                @click="cancelPayment(payment.external_id)"
                class="btn cancel-btn-small"
                :disabled="cancellingPayment === payment.external_id"
                :title="cancellingPayment === payment.external_id ? 'Cancelling...' : 'Cancel payment'"
                type="button"
                aria-label="Cancel payment"
              >
                {{ cancellingPayment === payment.external_id ? '⏳' : '✕' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
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

const plans = ref<SubscriptionType[]>([]);
const userSubscriptions = ref<Subscription[]>([]);
const allPayments = ref<Payment[]>([]);
const pendingPayments = ref<Payment[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const cancellingPayment = ref<string | null>(null);

const fetchPlans = async () => {
  loading.value = true;
  error.value = null;

  try {
    const subscriptionTypes = await subscriptionService.getSubscriptionTypes();
    plans.value = subscriptionTypes;

    if (authStore.user?.id) {
      const [subscriptions, payments] = await Promise.all([
        subscriptionService.getUserSubscriptions(authStore.user.id),
        paymentService.getUserPayments(authStore.user.id)
      ]);

      userSubscriptions.value = subscriptions;
      allPayments.value = payments;
      pendingPayments.value = payments.filter(payment => payment.status === 'PENDING');
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load plans';
    console.error('Error fetching plans:', err);
  } finally {
    loading.value = false;
  }
};

const hasPendingPayment = computed(() => pendingPayments.value.length > 0);
const pendingPayment = computed(() => pendingPayments.value[0] || null);
const pendingPaymentPlan = computed(() => {
  if (!pendingPayment.value) return null;
  return plans.value.find(plan => plan.external_id === pendingPayment.value?.subscription_id);
});

const hasPendingPaymentForPlan = (planExternalId: string): boolean => {
  return pendingPayments.value.some(payment => payment.subscription_id === planExternalId);
};

const canSelectPlan = (planExternalId: string): boolean => {
  if (!authStore.user?.id) return false;

  const now = new Date();
  const hasActive = userSubscriptions.value.some(subscription => {
    const expireDate = new Date(subscription.expire_date);
    return subscription.subscription_type.external_id === planExternalId &&
           subscription.is_active &&
           expireDate > now;
  });

  if (hasActive) return false;
  if (hasPendingPaymentForPlan(planExternalId)) return false;
  if (pendingPayments.value.length > 0 && !hasPendingPaymentForPlan(planExternalId)) return false;

  return true;
};

const getDisabledReason = (planExternalId: string): string => {
  const now = new Date();
  const hasActive = userSubscriptions.value.some(subscription => {
    const expireDate = new Date(subscription.expire_date);
    return subscription.subscription_type.external_id === planExternalId &&
           subscription.is_active &&
           expireDate > now;
  });

  if (hasActive) return 'You already have an active subscription for this plan';
  if (hasPendingPaymentForPlan(planExternalId)) return 'You have a pending payment for this plan';
  if (pendingPayments.value.length > 0 && !hasPendingPaymentForPlan(planExternalId)) {
    return 'Complete your pending payment on another plan first';
  }

  return 'Cannot select this plan';
};

const getPlanTitle = (planExternalId: string): string => {
  const plan = plans.value.find(p => p.external_id === planExternalId);
  return plan?.title || `Plan ${planExternalId.substring(0, 8)}...`;
};

const truncateId = (id: string): string => {
  if (!id) return '';
  return id.length > 12 ? `${id.substring(0, 8)}...` : id;
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

const selectPlan = (plan: SubscriptionType) => {
  if (!canSelectPlan(plan.external_id)) return;

  router.push({
    path: '/payment',
    query: {
      plan: plan.external_id,
      title: plan.title,
      price: plan.price,
      description: plan.description
    }
  });
};

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const viewPaymentDetails = () => {
  if (pendingPayment.value) {
    router.push(`/my-plans#payment-${pendingPayment.value.external_id}`);
  }
};

const viewPaymentDetailsById = (paymentExternalId: string) => {
  router.push(`/my-plans#payment-${paymentExternalId}`);
};

const cancelPayment = async (paymentExternalId: string) => {
  if (!paymentExternalId || !authStore.user?.id) return;

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

/** Interactive hover spotlight */
const handleCardMove = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement;
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  target.style.setProperty('--mx', `${x}%`);
  target.style.setProperty('--my', `${y}%`);
};

onMounted(() => {
  fetchPlans();
});
</script>

<style src="@/assets/css/plans.css"></style>
