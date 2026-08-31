<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>{{ $t('Welcome Back') }}</h1>
        <p>{{ $t('Sign in to your Self Study JO account') }}</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <!-- Redirect notice (only shown when an explicit message was passed) -->
        <div v-if="redirectMessage" class="login-alert alert-info">
          <span class="alert-icon" aria-hidden="true">ℹ️</span>
          <span class="alert-text">{{ redirectMessage }}</span>
          <button type="button" @click="redirectMessage = ''" class="alert-close">×</button>
        </div>

        <div class="form-group">
          <label for="username">{{ $t('Username') }}</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            required
            :placeholder="$t('Enter your username')"
            :class="{ 'error': errors.username }"
            autocomplete="username"
            :disabled="authStore.loading"
          />
          <div v-if="errors.username" class="error-message" role="alert">{{ errors.username }}</div>
        </div>

        <div class="form-group">
          <label for="password">{{ $t('Password') }}</label>
          <div class="password-input">
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              required
              :placeholder="$t('Enter your password')"
              :class="{ 'error': errors.password }"
              autocomplete="current-password"
              :disabled="authStore.loading"
            />
            <button
              type="button"
              class="password-toggle"
              @click="showPassword = !showPassword"
              :disabled="authStore.loading"
            >
              {{ showPassword ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <div v-if="errors.password" class="error-message" role="alert">{{ errors.password }}</div>
        </div>

        <div v-if="authStore.error" class="login-alert alert-error" role="alert">
          <span class="alert-icon" aria-hidden="true">⚠️</span>
          <span class="alert-text">{{ authStore.error }}</span>
          <button type="button" @click="authStore.clearError()" class="alert-close">×</button>
        </div>

        <button type="submit" class="login-btn btn-primary" :disabled="authStore.loading">
          <span v-if="authStore.loading">
            <span class="spinner"></span>
            {{ $t('Signing In...') }}
          </span>
          <span v-else>{{ $t('Sign In') }}</span>
        </button>

        <div class="login-footer">
          <p>
            {{ $t('Don\'t have an account?') }}
            <router-link :to="registerLink" class="link">{{ $t('Sign up') }}</router-link>
          </p>
        </div>
      </form>
    </div>

    <div class="login-background">
      <div class="background-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const form = reactive({
  username: '',
  password: '',
});

const errors = reactive({
  username: '',
  password: '',
});

const showPassword = ref(false);
const redirectMessage = ref<string>('');

/** Path the user wanted to reach before being redirected to /login */
const redirectPath = computed<string>(() => {
  const r = route.query.redirect;
  if (typeof r === 'string' && r.trim() !== '') return r;
  return '/';
});

/** Preserve redirect target when navigating to /register */
const registerLink = computed(() => {
  if (redirectPath.value && redirectPath.value !== '/') {
    return { path: '/register', query: { redirect: redirectPath.value } };
  }
  return { path: '/register' };
});

const validateForm = (): boolean => {
  let isValid = true;

  errors.username = '';
  errors.password = '';

  if (!form.username.trim()) {
    errors.username = 'Username is required';
    isValid = false;
  }

  if (!form.password) {
    errors.password = 'Password is required';
    isValid = false;
  } else if (form.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
    isValid = false;
  }

  return isValid;
};

const handleLogin = async () => {
  if (!validateForm()) return;
  if (authStore.loading) return;

  try {
    const response = await authStore.login({
      username: form.username.trim().toLowerCase(),
      password: form.password,
    });

    if (response.requires_verification) {
      // Preserve the original redirect target through verification
      if (redirectPath.value && redirectPath.value !== '/') {
        router.push({ path: '/verify-email', query: { redirect: redirectPath.value } });
      } else {
        router.push('/verify-email');
      }
    } else {
      // Send the user back to the page they originally came from (if any)
      router.push(redirectPath.value || '/');
    }
  } catch (error) {
    // Error message is already set in authStore.error and displayed in the template
    console.error('Login error:', error);
  }
};

onMounted(() => {
  authStore.clearError();

  // Only show a notice if an explicit `message` query param is provided
  // (e.g. when the user clicks "Select Plan" on the Plans page while logged out).
  // Do NOT show a generic message just because a `redirect` query exists,
  // since that also happens when the user opens the app's root URL while logged out.
  const msg = route.query.message;
  if (typeof msg === 'string' && msg.trim() !== '') {
    redirectMessage.value = msg;
  }
});
</script>

<style scoped>
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.3);
  border-top-color: var(--sfs-border-strong, #fff);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: middle;
  margin-inline-end: 6px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ============================================================
   INFO ALERT — light, brand-matched style
   ============================================================ */
.login-alert.alert-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--sfs-text, #e7ebff);
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.14);
  border: 1px solid rgb(var(--sfs-accent-rgb, 129 140 248) / 0.45);
  box-shadow: 0 0 0 1px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.08) inset;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

.login-alert.alert-info .alert-icon {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.5));
}

.login-alert.alert-info .alert-text {
  flex: 1;
  color: var(--sfs-text, #e7ebff);
  font-weight: 500;
  letter-spacing: 0.2px;
}

.login-alert.alert-info .alert-close {
  color: var(--sfs-text-muted, #c7d2fe);
}

.login-alert.alert-info .alert-close:hover {
  color: var(--sfs-text, #ffffff);
  background: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.18);
}

/* ============================================================
   ERROR ALERT extras — make the icon/text layout consistent
   with the info alert (text stays readable over the galaxy bg)
   ============================================================ */
.login-alert.alert-error .alert-icon {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px rgb(var(--sfs-danger-rgb, 252 129 129) / 0.55));
}

.login-alert.alert-error .alert-text {
  flex: 1;
  font-weight: 600;
  letter-spacing: 0.2px;
}
</style>

<!-- Scoped rather than imported from the script, so its selectors cannot reach
     another page. See VerifyEmail.vue for the bug that prompted it: a bare
     `.btn-primary` in a globally-loaded sheet wiped the fill off the login
     button, because an undefined `var()` makes a property `unset` rather than
     letting the earlier declaration win. Safe here for the same two reasons —
     the tokens are on the page root, not `:root`, and this view styles no child
     component's internals. -->
<style scoped src="@/assets/css/login.css"></style>
