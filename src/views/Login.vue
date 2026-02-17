<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>Welcome Back</h1>
        <p>Sign in to your Self Study JO account</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            required
            placeholder="Enter your username"
            :class="{ 'error': errors.username }"
          />
          <div v-if="errors.username" class="error-message">{{ errors.username }}</div>
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <div class="password-input">
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              required
              placeholder="Enter your password"
              :class="{ 'error': errors.password }"
            />
            <button type="button" class="password-toggle" @click="showPassword = !showPassword">
              {{ showPassword ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <div v-if="errors.password" class="error-message">{{ errors.password }}</div>
        </div>

        <div v-if="authStore.error" class="login-alert alert-error">
          {{ authStore.error }}
          <button type="button" @click="authStore.clearError()" class="alert-close">×</button>
        </div>

        <button type="submit" class="login-btn btn-primary" :disabled="authStore.loading">
          <span v-if="authStore.loading">Signing In...</span>
          <span v-else>Sign In</span>
        </button>

        <div class="login-footer">
          <p>
            Don't have an account?
            <router-link to="/register" class="link">Sign up</router-link>
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
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import '@/assets/css/login.css';

const router = useRouter();
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

const validateForm = () => {
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

  try {
    const response = await authStore.login({
      username: form.username.toLowerCase(),
      password: form.password,
    });

    if (response.requires_verification) {
      // Redirect to verification page
      router.push('/verify-email');
    } else {
      // Redirect to home
      router.push('/');
    }
  } catch (error) {
    // Error is already handled by auth store
    console.error('Login error:', error);
  }
};

onMounted(() => {
  // Clear any previous errors
  authStore.clearError();
});
</script>


