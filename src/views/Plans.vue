<template>
  <div class="plans-container">
    <!-- Header -->
    <header class="header">
      <h1 class="title">{{ $t('Choose Your Plan') }}</h1>
      <p class="subtitle">{{ $t('Unlock your learning potential with the perfect plan tailored for your journey') }}</p>
    </header>

    <!-- Pending Payment Banner -->
    <div v-if="hasPendingPayment" class="pending-payment-banner" role="alert">
      <div class="banner-content">
        <div class="banner-icon" aria-hidden="true">⏳</div>
        <div class="banner-text">
          <h3>{{ $t('Payment Pending') }}</h3>
          <p>{{ $t('You have a pending payment for the') }} <strong>{{ pendingPaymentPlan?.title }}</strong> {{ $t('plan.') }}</p>
          <div class="banner-details">
            <span class="detail-item">
              {{ $t('Amount:') }} <strong>{{ $t('JOD {v0}', { v0: pendingPayment?.amount }) }}</strong>
            </span>
            <span class="detail-item">
              {{ $t('Status:') }} <span class="status pending">{{ pendingPayment?.status }}</span>
            </span>
            <span class="detail-item">
              {{ $t('Created: {v0}', { v0: formatDate(pendingPayment?.created_at || '') }) }}
            </span>
          </div>
        </div>
        <div class="banner-actions">
          <button @click="viewPaymentDetails" class="btn view-payment-btn" type="button">
            <span class="btn-icon" aria-hidden="true">🔍</span>
            <span>{{ $t('View Details') }}</span>
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
      <p class="loading-text">{{ $t('Loading plans...') }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-container" role="alert">
      <div class="error-icon" aria-hidden="true">⚠️</div>
      <h3 class="error-title">{{ $t('Unable to load plans') }}</h3>
      <p class="error-message">{{ error }}</p>
      <button @click="fetchPlans" class="btn retry-btn" type="button">
        <span class="btn-icon" aria-hidden="true">🔄</span>
        <span>{{ $t('Try Again') }}</span>
      </button>
    </div>

    <!-- Plans Grid -->
    <div v-else class="plans-grid">
      <article
        v-for="plan in sortedPlans"
        :key="plan.external_id"
        :class="['plan-card', {
          'disabled': !canSelectPlan(plan.external_id),
          'pending': hasPendingPaymentForPlan(plan.external_id),
          'free': isFreePlan(plan.external_id)
        }]"
        @mousemove="handleCardMove"
      >
        <div v-if="hasPendingPaymentForPlan(plan.external_id)" class="pending-badge">
          {{ $t('⏳ Pending') }}
        </div>
        <div v-else-if="isFreePlan(plan.external_id)" class="free-badge">
          {{ $t('✨ {v0} days free', { v0: FREE_TRIAL_DAYS }) }}
        </div>

        <div class="plan-header">
          <h3 class="plan-title">{{ $td(plan) }}</h3>
          <div class="price">
            <span v-if="!isFreePlan(plan.external_id)" class="currency">JOD</span>
            <span class="amount">{{ isFreePlan(plan.external_id) ? 'Free' : plan.price }}</span>
            <span class="period">{{ periodLabel(plan.external_id) }}</span>
          </div>
        </div>

        <div class="plan-description">
          <p>{{ $td(plan, 'description') }}</p>
        </div>

        <div class="plan-features">
          <h4 class="features-title">{{ $t('What\'s included') }}</h4>
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
            :disabled="isFreePlan(plan.external_id) && activatingFreeTrial"
            type="button"
          >
            <span class="btn-icon" aria-hidden="true">
              {{ isFreePlan(plan.external_id) ? (activatingFreeTrial ? '⏳' : '🎁') : '🚀' }}
            </span>
            <span>
              {{ isFreePlan(plan.external_id)
                ? (activatingFreeTrial ? 'Starting...' : 'Start Free Trial')
                : 'Select Plan' }}
            </span>
          </button>
        </div>
      </article>
    </div>

    <!-- Current Subscriptions -->
    <section v-if="userSubscriptions.length > 0" class="current-subscriptions">
      <h3 class="subscriptions-title">{{ $t('Your Current Subscriptions') }}</h3>
      <div class="subscriptions-list">
        <div
          v-for="subscription in userSubscriptions"
          :key="subscription.external_id"
          class="subscription-item"
        >
          <div class="subscription-info">
            <h4 class="subscription-name">{{ $td(subscription.subscription_type) || subscription.title }}</h4>
            <p class="subscription-status">
              <span>{{ $t('Status:') }}</span>
              <span :class="['status', subscription.is_active ? 'active' : 'inactive']">
                {{ subscription.is_active ? 'Active' : 'Inactive' }}
              </span>
            </p>
            <p class="subscription-expiry">
              <span>{{ $t('Expires:') }}</span>
              <span>{{ formatDate(subscription.expire_date) }}</span>
            </p>
          </div>
          <div class="subscription-actions">
            <router-link :to="`/my-plans`" class="btn view-details-btn">
              <span class="btn-icon" aria-hidden="true">📄</span>
              <span>{{ $t('View Details') }}</span>
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Payment History -->
    <section v-if="allPayments.length > 0" class="all-payments-section">
      <h3 class="payments-title">{{ $t('Payment History') }}</h3>
      <div class="payments-table" role="table">
        <div class="table-header" role="row">
          <div class="header-cell" role="columnheader">{{ $t('Payment ID') }}</div>
          <div class="header-cell" role="columnheader">{{ $t('Plan') }}</div>
          <div class="header-cell" role="columnheader">{{ $t('Amount') }}</div>
          <div class="header-cell" role="columnheader">{{ $t('Method') }}</div>
          <div class="header-cell" role="columnheader">{{ $t('Status') }}</div>
          <div class="header-cell" role="columnheader">{{ $t('Date') }}</div>
          <div class="header-cell" role="columnheader">{{ $t('Actions') }}</div>
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
              <span class="cell-label">{{ $t('Payment ID') }}</span>
              <span class="cell-value payment-id">{{ truncateId(payment.external_id) }}</span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">{{ $t('Plan') }}</span>
              <span class="cell-value plan-name">{{ getPlanTitle(payment.subscription_id) }}</span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">{{ $t('Amount') }}</span>
              <span class="cell-value payment-amount">{{ $t('JOD {v0}', { v0: payment.amount }) }}</span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">{{ $t('Method') }}</span>
              <span class="cell-value payment-method">{{ payment.payment_method }}</span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">{{ $t('Status') }}</span>
              <span :class="['status', payment.status.toLowerCase()]">
                {{ payment.status }}
              </span>
            </div>
            <div class="table-cell" role="cell">
              <span class="cell-label">{{ $t('Date') }}</span>
              <span class="cell-value payment-date">{{ formatDate(payment.created_at) }}</span>
            </div>
            <div class="table-cell actions" role="cell">
              <span class="cell-label">{{ $t('Actions') }}</span>
              <button
                class="btn view-details-btn"
                @click="viewPaymentDetailsById(payment.external_id)"
                type="button"
                :aria-label="$t('View payment details')"
              >
                <span class="btn-icon" aria-hidden="true">👁️</span>
                <span>{{ $t('View') }}</span>
              </button>
              <button
                v-if="payment.status === 'PENDING'"
                @click="cancelPayment(payment.external_id)"
                class="btn cancel-btn-small"
                :disabled="cancellingPayment === payment.external_id"
                :title="cancellingPayment === payment.external_id ? 'Cancelling...' : 'Cancel payment'"
                type="button"
                :aria-label="$t('Cancel payment')"
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
import {
  subscriptionService,
  isFreeTrialSubscription,
  FREE_TRIAL_PLAN_ID,
  FREE_TRIAL_DAYS,
  FREE_TRIAL_PLAN_TITLE,
  FREE_TRIAL_PLAN_DESCRIPTION,
  type SubscriptionType,
  type Subscription,
  type Feature,
} from '@/services/subscription.service';
import { paymentService, type Payment } from '@/services/payment.service';

const router = useRouter();
const authStore = useAuthStore();

const plans = ref<SubscriptionType[]>([]);
const allFeatures = ref<Feature[]>([]);
const userSubscriptions = ref<Subscription[]>([]);
const allPayments = ref<Payment[]>([]);
const pendingPayments = ref<Payment[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const cancellingPayment = ref<string | null>(null);
const activatingFreeTrial = ref(false);

const fetchPlans = async () => {
  loading.value = true;
  error.value = null;

  try {
    const subscriptionTypes = await subscriptionService.getSubscriptionTypes();
    plans.value = subscriptionTypes;

    // The free card lists every feature on the platform, so it needs the
    // catalogue rather than a plan's slice of it. A failure here costs the
    // bullet list and nothing else, so it must not fail the page — and this
    // runs again after every cancel and every activation, so it is fetched
    // once rather than on each pass.
    if (allFeatures.value.length === 0) {
      subscriptionService.getFeatures()
        .then(features => { allFeatures.value = features; })
        .catch(err => console.warn('Could not load the feature list:', err));
    }

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

const isFreePlan = (planExternalId: string): boolean =>
  planExternalId === FREE_TRIAL_PLAN_ID;

/** `/ year` on a paid plan; the trial is not a year of anything. */
const periodLabel = (planExternalId: string): string =>
  isFreePlan(planExternalId) ? `/ ${FREE_TRIAL_DAYS} days` : '/ year';

/**
 * The free card is built here rather than read from app 22.
 *
 * It is always on the page — including before anybody has ever activated one,
 * which is the moment the plan record does not exist yet
 * (`ensureFreeTrialPlan()` mints it on first use). Rendering it from the
 * catalogue would mean the offer appearing only after somebody had already
 * taken it.
 */
const freePlanCard = computed<SubscriptionType>(() => ({
  external_id: FREE_TRIAL_PLAN_ID,
  title: FREE_TRIAL_PLAN_TITLE,
  description: FREE_TRIAL_PLAN_DESCRIPTION,
  price: '0.00',
  features: allFeatures.value,
}));

const priceOf = (plan: SubscriptionType): number => {
  // Prices arrive as strings — app 22 renders a DecimalField the way DRF did,
  // so this is "19.90" and not 19.9. An unparseable one sorts last rather than
  // to the front, where a NaN would otherwise put it.
  const amount = Number.parseFloat(String(plan.price ?? ''));
  return Number.isFinite(amount) ? amount : Number.POSITIVE_INFINITY;
};

/** Cheapest first, free at the head. */
const sortedPlans = computed<SubscriptionType[]>(() => {
  // Filter the real free-trial record out of the catalogue: once anybody has
  // activated a trial the plan exists in app 22 and would otherwise render
  // twice, beside the static card.
  const paid = plans.value.filter(plan => !isFreePlan(plan.external_id));
  return [freePlanCard.value, ...paid].sort((a, b) => {
    const byPrice = priceOf(a) - priceOf(b);
    if (byPrice !== 0) return byPrice;
    // A paid plan can also be 0.00, so the trial is pinned ahead of one.
    if (isFreePlan(a.external_id)) return -1;
    if (isFreePlan(b.external_id)) return 1;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
});

/** One trial per account, for the life of the account — expired still counts. */
const hasUsedFreeTrial = computed(() =>
  userSubscriptions.value.some(isFreeTrialSubscription));

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
  // If user is NOT authenticated, allow selecting the plan.
  // The click handler will redirect them to the login page.
  if (!authStore.isAuthenticated || !authStore.user?.id) {
    return true;
  }

  // The trial is governed by one question only. A pending payment on a paid
  // plan does not block it — there is nothing to pay here, so "finish paying
  // for the other one first" would be about a transaction that does not exist.
  if (isFreePlan(planExternalId)) {
    return !hasUsedFreeTrial.value;
  }

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
  // Only authenticated users can ever see this reason now.
  if (isFreePlan(planExternalId)) {
    return `You have already used your ${FREE_TRIAL_DAYS}-day free trial — it is one per account.`;
  }

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

/**
 * The free plan does not go to /payment, because there is nothing to pay.
 *
 * A visitor goes to `/register` rather than to `/login`: the offer is for a new
 * account, and sending somebody who has none to a sign-in form is a dead end.
 * The trial itself is created at email verification, for every new account —
 * see `VerifyEmail.vue`. Activating from here is the path for somebody who
 * already has an account and never got one (or whose activation failed at
 * verification, which is best effort by design).
 */
const selectFreePlan = async () => {
  if (!authStore.isAuthenticated || !authStore.user?.id) {
    router.push({ path: '/register', query: { plan: 'free' } });
    return;
  }

  if (hasUsedFreeTrial.value || activatingFreeTrial.value) return;

  activatingFreeTrial.value = true;
  try {
    const created = await subscriptionService.activateFreeTrial(
      authStore.user.id, authStore.user.username);

    if (created) {
      // The gates read the store's copy of the feature list, so refresh it
      // before navigating or the tools stay locked until the next reload.
      await Promise.allSettled([
        authStore.loadUserFeatures(),
        authStore.loadActiveSubscriptions(),
      ]);
      await fetchPlans();
      alert(`Your ${FREE_TRIAL_DAYS}-day free trial is active. Every feature is unlocked until `
        + `${new Date(created.expire_date).toLocaleDateString()}.`);
      router.push('/my-plans');
      return;
    }

    // `null` is the service refusing a second one. Re-read so the card
    // disables itself rather than staying clickable and refusing again.
    await fetchPlans();
    alert(`You have already used your ${FREE_TRIAL_DAYS}-day free trial.`);
  } catch (err: any) {
    console.error('Failed to activate the free trial:', err);
    alert(err?.message || 'Could not start your free trial. Please try again.');
  } finally {
    activatingFreeTrial.value = false;
  }
};

const selectPlan = (plan: SubscriptionType) => {
  if (isFreePlan(plan.external_id)) {
    selectFreePlan();
    return;
  }

  // If the user is NOT authenticated, redirect to login page with a redirect
  // back to /plans so they return here after signing in.
  if (!authStore.isAuthenticated || !authStore.user?.id) {
    router.push({
      path: '/login',
      query: {
        redirect: '/plans',
        message: 'You need to login first to select a plan.'
      }
    });
    return;
  }

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