<template>
    <div class="payment-container">
      <div class="header">
        <h1 class="title">{{ $t('Complete Your Purchase') }}</h1>
        <p class="subtitle">{{ $t('Select payment method and complete your subscription') }}</p>
      </div>

      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <p>{{ $t('Loading payment options...') }}</p>
      </div>

      <div v-else-if="error" class="error-container">
        <div class="error-icon">⚠️</div>
        <h3>{{ $t('Payment Error') }}</h3>
        <p>{{ error }}</p>
        <button @click="initializePayment" class="retry-btn">{{ $t('Try Again') }}</button>
      </div>

      <div v-else class="payment-content">
        <!-- Plan Summary -->
        <div class="plan-summary">
          <h3>{{ $t('Plan Summary') }}</h3>
          <div class="summary-card">
            <div class="summary-header">
              <h4>{{ selectedPlan.title }}</h4>
              <div class="plan-price">{{ $t('JOD {v0}', { v0: selectedPlan.price }) }}</div>
            </div>
            <p class="plan-description">{{ selectedPlan.description }}</p>
          </div>
        </div>

        <!-- Payment Methods Tabs -->
        <div class="payment-methods">
          <div class="tabs">
            <button
              :class="['tab-btn', { 'active': activeTab === 'bank' }]"
              @click="activeTab = 'bank'"
            >
              <span class="tab-icon">🏦</span>
              {{ $t('Bank Transfer') }}
            </button>
            <button
              :class="['tab-btn', { 'active': activeTab === 'cliq' }]"
              @click="activeTab = 'cliq'"
            >
              <span class="tab-icon">💳</span>
              {{ $t('Cliq Transfer') }}
            </button>
          </div>

          <div class="tab-content">
            <!-- Bank Accounts Tab -->
            <div v-if="activeTab === 'bank'" class="accounts-list">
              <div v-if="bankAccounts.length === 0" class="no-accounts">
                <div class="no-accounts-icon">🏦</div>
                <h4>{{ $t('No Bank Accounts Available') }}</h4>
                <p>{{ $t('Please check back later or use Cliq transfer') }}</p>
              </div>

              <div
                v-for="account in bankAccounts"
                :key="account.IBAN"
                :class="['account-card', { 'selected': selectedBankAccount?.IBAN === account.IBAN }]"
                @click="selectBankAccount(account)"
              >
                <div class="account-header">
                  <div class="bank-logo">{{ getBankInitials(account.bank_name) }}</div>
                  <div class="account-info">
                    <h4>{{ account.bank_name }}</h4>
                    <p class="account-number">{{ account.IBAN }}</p>
                  </div>
                  <div class="checkmark" v-if="selectedBankAccount?.IBAN === account.IBAN">
                    ✓
                  </div>
                </div>

                <div class="account-details">
                  <div class="detail-row">
                    <span class="detail-label">{{ $t('Account Holder:') }}</span>
                    <span class="detail-value">{{ account.full_name }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">{{ $t('Branch:') }}</span>
                    <span class="detail-value">{{ account.branch }}, {{ account.city }}, {{ account.country }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">{{ $t('Address:') }}</span>
                    <span class="detail-value">{{ account.street_address }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cliq Accounts Tab -->
            <div v-else class="accounts-list">
              <div v-if="cliqAccounts.length === 0" class="no-accounts">
                <div class="no-accounts-icon">💳</div>
                <h4>{{ $t('No Cliq Accounts Available') }}</h4>
                <p>{{ $t('Please check back later or use Bank transfer') }}</p>
              </div>

              <div
                v-for="account in cliqAccounts"
                :key="account.username"
                :class="['account-card', { 'selected': selectedCliqAccount?.username === account.username }]"
                @click="selectCliqAccount(account)"
              >
                <div class="account-header">
                  <div class="cliq-logo">CLIQ</div>
                  <div class="account-info">
                    <h4>{{ account.full_name }}</h4>
                    <p class="account-number">@{{ account.username }}</p>
                  </div>
                  <div class="checkmark" v-if="selectedCliqAccount?.username === account.username">
                    ✓
                  </div>
                </div>

                <div class="account-details">
                  <div class="detail-row">
                    <span class="detail-label">{{ $t('Status:') }}</span>
                    <span :class="['status', account.is_active ? 'active' : 'inactive']">
                      {{ account.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Summary -->
        <div class="payment-summary">
          <h3>{{ $t('Payment Summary') }}</h3>
          <div class="summary-details">
            <div class="summary-row">
              <span>{{ $t('Plan:') }}</span>
              <span>{{ selectedPlan.title }}</span>
            </div>
            <div class="summary-row">
              <span>{{ $t('Price:') }}</span>
              <span>{{ $t('JOD {v0}', { v0: selectedPlan.price }) }}</span>
            </div>
            <div class="summary-row">
              <span>{{ $t('Payment Method:') }}</span>
              <span>{{ activeTab === 'bank' ? 'Bank Transfer' : 'Cliq Transfer' }}</span>
            </div>
            <div class="summary-row" v-if="selectedBankAccount || selectedCliqAccount">
              <span>{{ $t('Selected Account:') }}</span>
              <span>{{ getSelectedAccountName() }}</span>
            </div>
            <div class="summary-row total">
              <span>{{ $t('Total Amount:') }}</span>
              <span>{{ $t('JOD {v0}', { v0: selectedPlan.price }) }}</span>
            </div>
          </div>

          <div class="payment-actions">
            <button
              class="btn back-btn"
              @click="goBack"
            >
              {{ $t('← Back to Plans') }}
            </button>
            <button
              class="btn pay-btn"
              :disabled="!canSubmit"
              @click="createPayment"
              :class="{ 'disabled': !canSubmit }"
            >
              {{ processing ? 'Processing...' : 'Request a Plan' }}
              <span v-if="!processing">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { paymentService, type BankAccount, type CliqAccount } from '@/services/payment.service';
import { subscriptionService } from '@/services/subscription.service';
import { notificationService } from '@/services/notification.service';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const processing = ref(false);
const activeTab = ref<'bank' | 'cliq'>('bank');

const bankAccounts = ref<BankAccount[]>([]);
const cliqAccounts = ref<CliqAccount[]>([]);
const selectedBankAccount = ref<BankAccount | null>(null);
const selectedCliqAccount = ref<CliqAccount | null>(null);

const selectedPlan = ref({
  external_id: '',
  title: '',
  price: '',
  description: ''
});

// Computed
const canSubmit = computed(() => {
  if (!authStore.user?.id) return false;

  if (activeTab.value === 'bank') {
    return selectedBankAccount.value !== null;
  } else {
    return selectedCliqAccount.value !== null;
  }
});

const getSelectedAccountName = () => {
  if (activeTab.value === 'bank' && selectedBankAccount.value) {
    return `${selectedBankAccount.value.bank_name} - ${selectedBankAccount.value.IBAN}`;
  } else if (activeTab.value === 'cliq' && selectedCliqAccount.value) {
    return `${selectedCliqAccount.value.full_name} (@${selectedCliqAccount.value.username})`;
  }
  return 'None selected';
};

const getBankInitials = (bankName: string) => {
  return bankName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
};

// Methods
const initializePayment = async () => {
  loading.value = true;
  error.value = null;

  try {
    // Get plan details from route
    const planExternalId = route.query.plan as string;
    if (!planExternalId) {
      throw new Error('No plan selected');
    }

    // Get plan details
    const plan = await subscriptionService.getSubscriptionType(planExternalId);
    selectedPlan.value = {
      external_id: plan.external_id,
      title: plan.title,
      price: plan.price,
      description: plan.description
    };

    // Load bank accounts
    bankAccounts.value = await paymentService.getBankAccounts();

    // Load cliq accounts
    cliqAccounts.value = await paymentService.getCliqAccounts();

    // Auto-select first active account if available
    if (bankAccounts.value.length > 0) {
      selectedBankAccount.value = bankAccounts.value.find(acc => acc.is_active) || bankAccounts.value[0];
    }

    if (cliqAccounts.value.length > 0) {
      selectedCliqAccount.value = cliqAccounts.value.find(acc => acc.is_active) || cliqAccounts.value[0];
    }

  } catch (err: any) {
    error.value = err.message || 'Failed to initialize payment';
    console.error('Error initializing payment:', err);
  } finally {
    loading.value = false;
  }
};

const selectBankAccount = (account: BankAccount) => {
  selectedBankAccount.value = account;
};

const selectCliqAccount = (account: CliqAccount) => {
  selectedCliqAccount.value = account;
};

const createPayment = async () => {
  if (!canSubmit.value || !authStore.user?.id) return;

  processing.value = true;

  try {
    // Check if user already has a pending payment for this plan
    const userPayments = await paymentService.getUserPayments(authStore.user.id);
    const existingPendingPayment = userPayments.find(payment =>
      payment.subscription_id === selectedPlan.value.external_id &&
      payment.status === 'PENDING'
    );

    if (existingPendingPayment) {
      alert('You already have a pending payment for this plan. Please complete or cancel it before creating a new one.');
      router.push('/my-plans');
      return;
    }

    // Check if user has any pending payment
    const pendingPayments = userPayments.filter(payment => payment.status === 'PENDING');
    if (pendingPayments.length > 0) {
      alert('You already have a pending payment. Please complete or cancel it before creating a new one.');
      router.push('/my-plans');
      return;
    }

    const paymentData = {
      user_id: authStore.user.id,
      subscription_id: selectedPlan.value.external_id,
      amount: selectedPlan.value.price,
      payment_method: activeTab.value === 'bank' ? 'IBAN' : 'CLIQ' as 'IBAN' | 'CLIQ',
      reference: `Subscription to ${selectedPlan.value.title}`,
      notes: `User: ${authStore.user.username} - Plan: ${selectedPlan.value.title}`
    };

    const payment = await paymentService.createPayment(paymentData);

    // --- Notify all admin users about this payment request (non-blocking) ---
    try {
      const fullName = [authStore.user.first_name, authStore.user.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();

      await notificationService.notifyAdminsOfPaymentRequest({
        paymentId: payment.external_id,
        amount: payment.amount,
        planTitle: selectedPlan.value.title,
        studentUsername: authStore.user.username,
        studentFullName: fullName || undefined
      });
    } catch (notifyErr) {
      console.warn('Failed to notify admins of payment request:', notifyErr);
    }
    // ------------------------------------------------------------------------

    // Show success message and redirect
    alert('Payment request created successfully! You will be redirected to your plans.');

    router.push('/my-plans');

  } catch (err: any) {
    error.value = err.message || 'Failed to create payment';
    console.error('Error creating payment:', err);
    alert('Failed to create payment: ' + err.message);
  } finally {
    processing.value = false;
  }
};

const goBack = () => {
  router.push('/plans');
};

onMounted(() => {
  initializePayment();
});
</script>

<style src="@/assets/css/payment.css"></style>