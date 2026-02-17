<template>
    <div class="plans-container">
      <div class="header">
        <h1 class="title">Choose Your Plan</h1>
        <p class="subtitle">Select the perfect plan for your learning journey</p>
      </div>

      <!-- Pending Payment Banner -->
      <div v-if="hasPendingPayment" class="pending-payment-banner">
        <div class="banner-content">
          <div class="banner-icon">⏳</div>
          <div class="banner-text">
            <h3>Pending Payment</h3>
            <p>You have a pending payment for the <strong>{{ pendingPaymentPlan?.title }}</strong> plan.</p>
            <p class="banner-details">
              <span class="detail-item">Amount: <strong>JOD {{ pendingPayment?.amount }}</strong></span>
              <span class="detail-item">Status: <span class="status pending">{{ pendingPayment?.status }}</span></span>
              <span class="detail-item">Created: {{ formatDate(pendingPayment?.created_at || '') }}</span>
            </p>
          </div>
          <div class="banner-actions">
            <button @click="viewPaymentDetails" class="btn view-payment-btn">
              <span class="btn-icon">🔍</span>
              View Payment Details
            </button>
            <button
              @click="cancelPayment(pendingPayment?.external_id || '')"
              class="btn cancel-payment-btn"
              :disabled="cancellingPayment"
            >
              <span class="btn-icon">{{ cancellingPayment ? '⏳' : '✕' }}</span>
              {{ cancellingPayment ? 'Cancelling...' : 'Cancel Payment' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading plans...</p>
      </div>

      <div v-else-if="error" class="error-container">
        <div class="error-icon">⚠️</div>
        <h3 class="error-title">Unable to load plans</h3>
        <p class="error-message">{{ error }}</p>
        <button @click="fetchPlans" class="btn retry-btn">
          <span class="btn-icon">🔄</span>
          Try Again
        </button>
      </div>

      <div v-else class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.external_id"
          :class="['plan-card', {
            'disabled': !canSelectPlan(plan.external_id),
            'pending': hasPendingPaymentForPlan(plan.external_id)
          }]"
        >
          <div v-if="hasPendingPaymentForPlan(plan.external_id)" class="pending-badge">
            ⏳ Payment Pending
          </div>

          <div class="plan-header">
            <h3 class="plan-title">{{ plan.title }}</h3>
            <div class="price">
              <span class="currency">JOD</span>
              <span class="amount">{{ plan.price }}</span>
              <span class="period">/month</span>
            </div>
          </div>

          <div class="plan-description">
            <p>{{ plan.description }}</p>
          </div>

          <div class="plan-features">
            <h4 class="features-title">Features</h4>
            <ul class="features-list">
              <li v-for="feature in plan.features" :key="feature.external_id" class="feature-item">
                <span class="feature-icon">✓</span>
                <span class="feature-name">{{ feature.name }}</span>
                <span class="feature-description" v-if="feature.description">
                  - {{ feature.description }}
                </span>
              </li>
            </ul>
          </div>

          <div class="plan-actions">
            <div v-if="!canSelectPlan(plan.external_id)" class="disabled-reason">
              <div class="reason-icon">ⓘ</div>
              <div class="reason-text">
                {{ getDisabledReason(plan.external_id) }}
              </div>
            </div>

            <button
              v-else
              class="btn select-btn"
              @click="selectPlan(plan)"
              :disabled="!canSelectPlan(plan.external_id)"
            >
              <span class="btn-icon">🚀</span>
              Select Plan
            </button>
          </div>
        </div>
      </div>

      <div v-if="userSubscriptions.length > 0" class="current-subscriptions">
        <h3 class="subscriptions-title">Your Current Subscriptions</h3>
        <div class="subscriptions-list">
          <div v-for="subscription in userSubscriptions" :key="subscription.external_id" class="subscription-item">
            <div class="subscription-info">
              <h4 class="subscription-name">{{ subscription.title }}</h4>
              <p class="subscription-status">
                Status:
                <span :class="['status', subscription.is_active ? 'active' : 'inactive']">
                  {{ subscription.is_active ? 'Active' : 'Inactive' }}
                </span>
              </p>
              <p class="subscription-expiry">Expires: {{ formatDate(subscription.expire_date) }}</p>
            </div>
            <div class="subscription-actions">
              <router-link :to="`/my-plans`" class="btn view-details-btn">
                <span class="btn-icon">📄</span>
                View Details
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- All Payments Section (Including Paid) -->
      <div v-if="allPayments.length > 0" class="all-payments-section">
        <h3 class="payments-title">Your Payment History</h3>
        <div class="payments-table">
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
                <span class="cell-label">Payment ID:</span>
                <span class="cell-value payment-id">{{ payment.external_id }}</span>
              </div>
              <div class="table-cell">
                <span class="cell-label">Plan:</span>
                <span class="cell-value plan-name">{{ getPlanTitle(payment.subscription_id) }}</span>
              </div>
              <div class="table-cell">
                <span class="cell-label">Amount:</span>
                <span class="cell-value payment-amount">JOD {{ payment.amount }}</span>
              </div>
              <div class="table-cell">
                <span class="cell-label">Method:</span>
                <span class="cell-value payment-method">{{ payment.payment_method }}</span>
              </div>
              <div class="table-cell">
                <span class="cell-label">Status:</span>
                <span :class="['cell-value', 'status', payment.status.toLowerCase()]">
                  {{ payment.status }}
                </span>
              </div>
              <div class="table-cell">
                <span class="cell-label">Date:</span>
                <span class="cell-value payment-date">{{ formatDate(payment.created_at) }}</span>
              </div>
              <div class="table-cell actions">
                <button
                  class="btn view-details-btn"
                  @click="viewPaymentDetailsById(payment.external_id)"
                >
                  <span class="btn-icon">👁️</span>
                  View
                </button>
                <button
                  v-if="payment.status === 'PENDING'"
                  @click="cancelPayment(payment.external_id)"
                  class="btn cancel-btn-small"
                  :disabled="cancellingPayment === payment.external_id"
                  :title="cancellingPayment === payment.external_id ? 'Cancelling...' : 'Cancel Payment'"
                >
                  {{ cancellingPayment === payment.external_id ? '⏳' : '✕' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
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
    // Fetch all subscription types
    const subscriptionTypes = await subscriptionService.getSubscriptionTypes();
    plans.value = subscriptionTypes;

    // Fetch user's data
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

const hasPendingPayment = computed(() => {
  return pendingPayments.value.length > 0;
});

const pendingPayment = computed(() => {
  return pendingPayments.value[0] || null;
});

const pendingPaymentPlan = computed(() => {
  if (!pendingPayment.value) return null;
  return plans.value.find(plan => plan.external_id === pendingPayment.value?.subscription_id);
});

const hasPendingPaymentForPlan = (planExternalId: string): boolean => {
  return pendingPayments.value.some(payment =>
    payment.subscription_id === planExternalId
  );
};

const canSelectPlan = (planExternalId: string): boolean => {
  if (!authStore.user?.id) return false;

  // Check if user has active subscription for this plan
  const now = new Date();
  const hasActive = userSubscriptions.value.some(subscription => {
    const expireDate = new Date(subscription.expire_date);
    return subscription.subscription_type.external_id === planExternalId &&
           subscription.is_active &&
           expireDate > now;
  });

  if (hasActive) return false;

  // Check if user has pending payment for this plan
  if (hasPendingPaymentForPlan(planExternalId)) return false;

  // Check if user has any pending payment (for any plan)
  if (pendingPayments.value.length > 0 && !hasPendingPaymentForPlan(planExternalId)) {
    // User has pending payment for a different plan
    return false;
  }

  return true;
};

const getDisabledReason = (planExternalId: string): string => {
  // Check if user has active subscription for this plan
  const now = new Date();
  const hasActive = userSubscriptions.value.some(subscription => {
    const expireDate = new Date(subscription.expire_date);
    return subscription.subscription_type.external_id === planExternalId &&
           subscription.is_active &&
           expireDate > now;
  });

  if (hasActive) {
    return 'You already have an active subscription for this plan';
  }

  // Check if user has pending payment for this plan
  if (hasPendingPaymentForPlan(planExternalId)) {
    return 'You have a pending payment for this plan';
  }

  // Check if user has pending payment for a different plan
  if (pendingPayments.value.length > 0 && !hasPendingPaymentForPlan(planExternalId)) {
    return 'You have a pending payment for another plan. Please complete it first.';
  }

  return 'Cannot select this plan';
};

const getPlanTitle = (planExternalId: string): string => {
  const plan = plans.value.find(p => p.external_id === planExternalId);
  return plan?.title || `Plan ${planExternalId.substring(0, 8)}...`;
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
    month: 'long',
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

onMounted(() => {
  fetchPlans();
});
</script>

<style src="@/assets/css/plans.css"></style>