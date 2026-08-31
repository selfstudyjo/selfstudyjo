<template>
  <div class="verify-container">
    <div class="verify-card">
      <div class="verify-header">
        <div class="verify-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 11L4 6H20ZM20 18H4V8L12 13L20 8V18Z" fill="currentColor"/>
          </svg>
        </div>
        <h1>{{ $t('Verify Your Email') }}</h1>
        <p>{{ $t('We\'ve sent a 6-digit code to {v0}', { v0: userEmail || 'your email' }) }}</p>
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

        <!-- A 201 from app 14 means the code EXISTS, not that it was delivered.
             Silently treating the two as the same is what let a replica with no
             mail configuration look like a working signup. -->
        <div v-if="deliveryWarning" class="alert alert-error">
          {{ deliveryWarning }}
        </div>

        <div v-if="verificationSuccess" class="alert alert-success">
          {{ $t('Email verified successfully! Redirecting...') }}
        </div>

        <div class="verification-info">
          <p v-if="timeLeft > 0">
            {{ $t('Code expires in {v0}', { v0: formattedTime }) }}
          </p>
          <p v-else class="expired">
            {{ $t('Code has expired') }}
          </p>
        </div>

        <div class="actions">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="authStore.loading || !isOtpComplete || timeLeft <= 0"
          >
            <span v-if="authStore.loading">{{ $t('Verifying...') }}</span>
            <span v-else>{{ $t('Verify Email') }}</span>
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
            {{ $t('Didn\'t receive the code?') }}
            <button type="button" class="link" @click="changeEmail">
              {{ $t('Change email address') }}
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
import { userService } from '@/services/user.service';

// Import the CSS file

const router = useRouter();
const authStore = useAuthStore();

const otp = reactive(Array(6).fill(''));
const otpInputs = ref<HTMLInputElement[]>([]);
const verificationError = ref('');
const deliveryWarning = ref('');
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

onMounted(async () => {
  // The address has to be resolved BEFORE the code is asked for. It used to
  // fall back to the literal string 'your email', which is not an address:
  // app 14 rejected every generate and every resend with
  // `email: Enter a valid email address.`, and the screen rendered that as
  // "HTTP 400: BAD REQUEST" and offered a Resend button that could only fail
  // the same way.
  await resolveEmail();

  // Generate OTP automatically — unless one has just been sent on our behalf.
  //
  // App 15 asks app 14 for a code itself when it refuses an unverified login,
  // so on that path this screen was ordering a second one within the same
  // second. Two near-identical emails arrive, only the newer code is stored,
  // and opening the one that came first gets "Invalid OTP code" for a code the
  // user is reading correctly. There is a Resend button for the case where the
  // first message really did not arrive.
  if (authStore.verificationData?.otp_sent === true) {
    deliveryWarning.value = '';
  } else {
    generateOTP();
  }

  // Start timers
  startTimers();
});

/** A syntactic check only — the same one `Register.vue` applies to the field. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const currentUserId = (): string =>
  localStorage.getItem('verification_user_id') ||
  authStore.verificationData?.user_id ||
  authStore.user?.id ||
  '';

/**
 * Which address the code goes to.
 *
 * Registration puts it in localStorage, so that path was always fine. **Login**
 * is the one that broke: somebody signing in on another device with an
 * unverified account is sent here by the router guard, and this browser has
 * never seen their address. App 15 now returns it with the 403, and app 13 is
 * asked as the fallback — it is the service that owns the value, so a lookup by
 * user_id always works where guessing never could.
 */
const resolveEmail = async () => {
  const known = String(
    localStorage.getItem('verification_email') ||
    authStore.verificationData?.email ||
    authStore.user?.email ||
    ''
  ).trim().toLowerCase();

  if (EMAIL_RE.test(known)) {
    userEmail.value = known;
    return;
  }

  const userId = currentUserId();
  if (userId) {
    try {
      const profile = await userService.getUserProfile(userId);
      const email = String(profile?.email || '').trim().toLowerCase();
      if (EMAIL_RE.test(email)) {
        userEmail.value = email;
        localStorage.setItem('verification_email', email);
        return;
      }
    } catch (error) {
      console.warn('Could not resolve the verification email from the profile service:', error);
    }
  }

  // Left empty rather than filled with a placeholder, so every caller below has
  // to notice it is missing instead of sending it to the OTP service.
  userEmail.value = '';
};

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

/**
 * A 201 says the code was created. `email_sent: false` says it never left the
 * building — a replica with no `EMAIL_HOST` / `DEFAULT_FROM_EMAIL` generates
 * codes perfectly and delivers none of them. Both halves of the response were
 * being thrown away here, so that failure looked exactly like a working signup
 * from the browser and the only symptom was a user waiting for an email.
 */
const noteDelivery = (response: any) => {
  if (response && response.email_sent === false) {
    deliveryWarning.value = response.warning
      || 'Your code was created but the email could not be sent. Please contact support.';
    return;
  }
  deliveryWarning.value = '';
};

const generateOTP = async () => {
  const userId = currentUserId();
  const username = localStorage.getItem('verification_username') ||
                  authStore.verificationData?.username ||
                  authStore.user?.username ||
                  userEmail.value.split('@')[0];

  if (!userId) {
    verificationError.value = 'Unable to generate OTP. Please try registering again.';
    return;
  }
  if (!EMAIL_RE.test(userEmail.value)) {
    verificationError.value = 'We could not work out which email address to send your code to. '
      + 'Please sign in again, or register.';
    return;
  }

  try {
    const response = await authStore.generateOTP({
      user_id: userId,
      email: userEmail.value,
      username: username,
    });
    verificationError.value = '';
    noteDelivery(response);
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

  const userId = currentUserId();
  const username = localStorage.getItem('verification_username') ||
                  authStore.verificationData?.username ||
                  authStore.user?.username ||
                  userEmail.value.split('@')[0];

  // One more attempt at the address before giving up: somebody who lands here
  // from a login has nothing in localStorage, and a Resend that cannot say
  // where to send it is a button that can only ever fail.
  if (!EMAIL_RE.test(userEmail.value)) await resolveEmail();

  if (!userId || !EMAIL_RE.test(userEmail.value)) {
    verificationError.value = 'Unable to resend OTP — we do not have a valid email address '
      + 'for this account on this device. Please sign in again, or register.';
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
    const response = await authStore.resendOTP({
      user_id: userId,
      email: userEmail.value,
      username: username,
    });

    verificationError.value = '';
    noteDelivery(response);
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

<!--
  SCOPED, not a script `import`.

  A JS `import` of a stylesheet puts it in the bundle GLOBALLY: every selector in
  it applies on every page of the app. `check:cssleaks` §5 has been reporting
  this file for that, and one of the reported classes was not merely untidy — it
  was breaking a button on another page. `verify-email.css` declared a bare
  `.btn-primary { background: var(--ve-grad) }`, and `--ve-grad` is declared on
  `.verify-container`. On the LOGIN page that selector still matched the submit
  button, where the variable does not exist — and an undefined `var()` is
  *invalid at computed value time*, which makes the property `unset` rather than
  falling back to the earlier declaration. So `.login-btn`'s own brand gradient
  was thrown away and Sign In had no fill at all, in all ten galaxies, on the
  first screen every visitor sees.

  `<style scoped src>` hands the job to Vite, which rewrites every selector with
  this component's `data-v-` attribute. That is complete and cannot be got
  wrong, where scoping 66 selectors by hand can. It is safe here because this
  file's tokens are declared on the page root (not on `:root`, which would
  become `:root[data-v-…]` and match nothing) and because this view renders no
  child components whose internals it styles.
-->
<style scoped src="@/assets/css/verify-email.css"></style>
