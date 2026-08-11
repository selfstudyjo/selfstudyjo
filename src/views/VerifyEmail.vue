<template>
  <div class="verify-container">
    <div class="verify-card">
      <div class="verify-header">
        <div class="verify-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 11L4 6H20ZM20 18H4V8L12 13L20 8V18Z" fill="currentColor"/>
          </svg>
        </div>
        <h1>Verify Your Email</h1>
        <p>We've sent a 6-digit code to {{ userEmail }}</p>
      </div>

      <form @submit.prevent="handleVerify" class="verify-form">
        <div class="otp-inputs">
          <input
            v-for="index in 6"
            :key="index"
            :ref="el => otpInputs[index - 1] = el"
            v-model="otp[index - 1]"
            type="text"
            maxlength="1"
            inputmode="numeric"
            pattern="[0-9]*"
            @input="handleOtpInput(index - 1, $event)"
            @keydown="handleOtpKeydown(index - 1, $event)"
            @paste="handleOtpPaste"
            :class="{ 'error': verificationError }"
          />
        </div>

        <div v-if="verificationError" class="alert alert-error">
          {{ verificationError }}
        </div>

        <div v-if="verificationSuccess" class="alert alert-success">
          Email verified successfully! Redirecting...
        </div>

        <div class="verification-info">
          <p v-if="timeLeft > 0">
            Code expires in {{ formattedTime }}
          </p>
          <p v-else class="expired">
            Code has expired
          </p>
        </div>

        <div class="actions">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="authStore.loading || !isOtpComplete || timeLeft <= 0"
          >
            <span v-if="authStore.loading">Verifying...</span>
            <span v-else>Verify Email</span>
          </button>

          <button
            type="button"
            class="btn btn-secondary"
            @click="resendCode"
            :disabled="resendDisabled"
          >
            {{ resendButtonText }}
          </button>
        </div>

        <div class="alternative">
          <p>
            Didn't receive the code?
            <button type="button" class="link" @click="changeEmail">
              Change email address
            </button>
          </p>
        </div>
      </form>
    </div>

    <div class="verify-background">
      <div class="background-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { notificationService } from '@/services/notification.service';
import { subscriptionService, FREE_TRIAL_DAYS } from '@/services/subscription.service';

// Import the CSS file
import '@/assets/css/verify-email.css';

const router = useRouter();
const authStore = useAuthStore();

const otp = reactive(Array(6).fill(''));
const otpInputs = ref<HTMLInputElement[]>([]);
const verificationError = ref('');
const verificationSuccess = ref(false);
const timeLeft = ref(15 * 60); // 15 minutes in seconds
const resendCooldown = ref(60); // 1 minute cooldown
const userEmail = ref('');

let timer: NodeJS.Timeout | null = null;
let resendTimer: NodeJS.Timeout | null = null;

const isOtpComplete = computed(() => otp.every(digit => digit !== ''));
const formattedTime = computed(() => {
  const minutes = Math.floor(timeLeft.value / 60);
  const seconds = timeLeft.value % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const resendDisabled = computed(() => resendCooldown.value > 0);
const resendButtonText = computed(() => {
  if (resendCooldown.value > 0) {
    return `Resend Code (${resendCooldown.value}s)`;
  }
  return 'Resend Code';
});

onMounted(() => {
  // Get user email from localStorage or auth store
  const storedEmail = localStorage.getItem('verification_email') ||
                     authStore.verificationData?.email ||
                     'your email';
  userEmail.value = storedEmail;

  // Generate OTP automatically
  generateOTP();

  // Start timers
  startTimers();
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (resendTimer) clearInterval(resendTimer);
});

const startTimers = () => {
  // OTP expiration timer
  timer = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--;
    } else {
      if (timer) clearInterval(timer);
    }
  }, 1000);

  // Resend cooldown timer
  resendTimer = setInterval(() => {
    if (resendCooldown.value > 0) {
      resendCooldown.value--;
    } else {
      if (resendTimer) clearInterval(resendTimer);
    }
  }, 1000);
};

const generateOTP = async () => {
  const userId = localStorage.getItem('verification_user_id') ||
                authStore.verificationData?.user_id;
  const username = localStorage.getItem('verification_username') ||
                  authStore.verificationData?.username ||
                  userEmail.value.split('@')[0];

  if (!userId || !userEmail.value) {
    verificationError.value = 'Unable to generate OTP. Please try registering again.';
    return;
  }

  try {
    await authStore.generateOTP({
      user_id: userId,
      email: userEmail.value,
      username: username,
    });
  } catch (error: any) {
    verificationError.value = error.message || 'Failed to generate OTP';
  }
};

const handleOtpInput = (index: number, event: Event) => {
  const input = event.target as HTMLInputElement;
  const value = input.value;

  // Only allow digits
  if (!/^\d*$/.test(value)) {
    otp[index] = '';
    return;
  }

  // Update OTP value
  otp[index] = value;

  // Clear error when user starts typing
  if (verificationError.value) {
    verificationError.value = '';
  }

  // Move to next input if value entered
  if (value && index < 5) {
    otpInputs.value[index + 1]?.focus();
  }
};

const handleOtpKeydown = (index: number, event: KeyboardEvent) => {
  if (event.key === 'Backspace' && !otp[index] && index > 0) {
    // Move to previous input on backspace
    otpInputs.value[index - 1]?.focus();
  } else if (event.key === 'ArrowLeft' && index > 0) {
    otpInputs.value[index - 1]?.focus();
    event.preventDefault();
  } else if (event.key === 'ArrowRight' && index < 5) {
    otpInputs.value[index + 1]?.focus();
    event.preventDefault();
  }
};

const handleOtpPaste = (event: ClipboardEvent) => {
  event.preventDefault();
  const paste = event.clipboardData?.getData('text') || '';
  const digits = paste.replace(/\D/g, '').slice(0, 6);

  digits.split('').forEach((digit, index) => {
    if (index < 6) {
      otp[index] = digit;
    }
  });

  // Focus last input
  const lastIndex = Math.min(digits.length - 1, 5);
  otpInputs.value[lastIndex]?.focus();
};

const handleVerify = async () => {
  if (!isOtpComplete.value || timeLeft.value <= 0) {
    verificationError.value = 'Please enter a valid OTP';
    return;
  }

  const otpCode = otp.join('');
  const userId = localStorage.getItem('verification_user_id') ||
                authStore.verificationData?.user_id;

  if (!userId) {
    verificationError.value = 'Unable to verify. Please try registering again.';
    return;
  }

  try {
    const response = await authStore.verifyOTP({
      user_id: userId,
      code: otpCode,
    });

    if (response.email_verified) {
      verificationSuccess.value = true;
      verificationError.value = '';

      // Store verification status
      localStorage.setItem('email_verified', 'true');

      // The first two things in a new account's bell, so it is never empty on
      // the first visit — an empty bell on day one reads as a feature that does
      // not work rather than as a feature with nothing to say yet.
      const username = authStore.user?.username
        || authStore.verificationData?.username
        || localStorage.getItem('verification_username')
        || '';
      if (username) {
        notificationService.notify('account.email_verified', { to: username });
        notificationService.notify('account.welcome', {
          to: username,
          params: { name: authStore.user?.first_name || username },
        });
      }

      // Every new account gets the 7-day, all-features trial, and it starts
      // here rather than at registration so the days are only ever spent by an
      // account somebody actually owns.
      //
      // Not awaited and never allowed to throw: verification must not fail
      // because app 22 is cold, and the trial has a recovery path that a
      // verified email does not — the free card on /plans stays selectable for
      // an account that never got one. It sends its own
      // `subscription.activated` bell, so nothing is added here.
      subscriptionService.activateFreeTrial(userId, username || undefined)
        .catch(err => console.warn(`Free ${FREE_TRIAL_DAYS}-day trial activation failed:`, err));

      // Redirect after delay
      setTimeout(() => {
        if (authStore.isAuthenticated) {
          router.push('/');
        } else {
          router.push('/login');
        }
      }, 2000);
    } else {
      verificationError.value = response.warning || 'Verification failed. Please try again.';
    }
  } catch (error: any) {
    verificationError.value = error.message || 'Verification failed. Please try again.';

    // Shake OTP inputs on error
    otpInputs.value.forEach(input => {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
    });
  }
};

const resendCode = async () => {
  if (resendDisabled.value) return;

  const userId = localStorage.getItem('verification_user_id') ||
                authStore.verificationData?.user_id;
  const username = localStorage.getItem('verification_username') ||
                  authStore.verificationData?.username ||
                  userEmail.value.split('@')[0];

  if (!userId || !userEmail.value) {
    verificationError.value = 'Unable to resend OTP';
    return;
  }

  try {
    // Reset OTP
    otp.forEach((_, index) => otp[index] = '');
    otpInputs.value[0]?.focus();

    // Reset timers
    timeLeft.value = 15 * 60;
    resendCooldown.value = 60;
    startTimers();

    // Generate new OTP
    await authStore.resendOTP({
      user_id: userId,
      email: userEmail.value,
      username: username,
    });

    verificationError.value = '';
  } catch (error: any) {
    verificationError.value = error.message || 'Failed to resend OTP';
  }
};

const changeEmail = () => {
  // Clear verification data and redirect to register
  localStorage.removeItem('verification_user_id');
  localStorage.removeItem('verification_email');
  localStorage.removeItem('verification_username');
  router.push('/register');
};
</script>
