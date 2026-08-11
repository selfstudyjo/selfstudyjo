<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <h1>Create Account</h1>
        <p>Join Self Study JO and start learning today</p>
      </div>

      <!-- Arrived from the free card on /plans. Every new account gets the
           trial, so this states what is about to happen rather than gating it. -->
      <div v-if="cameForFreeTrial" class="register-alert alert-info">
        <span>
          🎁 Your <strong>{{ FREE_TRIAL_DAYS }}-day free trial</strong> — every feature unlocked —
          starts as soon as you verify your email.
        </span>
      </div>

      <form @submit.prevent="handleRegister" class="register-form">
        <div class="register-form-row">
          <div class="register-form-group">
            <label for="firstName">First Name</label>
            <input
              id="firstName"
              v-model="form.first_name"
              type="text"
              placeholder="John"
              :class="{ 'error': errors.first_name }"
            />
            <div v-if="errors.first_name" class="register-error-message">{{ errors.first_name }}</div>
          </div>

          <div class="register-form-group">
            <label for="lastName">Last Name</label>
            <input
              id="lastName"
              v-model="form.last_name"
              type="text"
              placeholder="Doe"
              :class="{ 'error': errors.last_name }"
            />
            <div v-if="errors.last_name" class="register-error-message">{{ errors.last_name }}</div>
          </div>
        </div>

        <div class="register-form-group">
          <label for="username">Username *</label>
          <div class="register-input-with-validation">
            <input
              id="username"
              v-model="form.username"
              type="text"
              required
              placeholder="johndoe"
              @blur="validateUsername"
              :class="{ 'error': errors.username, 'valid': usernameValid }"
            />
            <div v-if="usernameChecking" class="register-validation-status">
              <span class="register-loading"></span>
            </div>
            <div v-if="usernameValid" class="register-validation-status valid">
              ✓
            </div>
          </div>
          <div v-if="errors.username" class="register-error-message">{{ errors.username }}</div>
        </div>

        <div class="register-form-group">
          <label for="email">Email *</label>
          <div class="register-input-with-validation">
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              placeholder="john@example.com"
              @blur="validateEmail"
              :class="{ 'error': errors.email, 'valid': emailValid }"
            />
            <div v-if="emailChecking" class="register-validation-status">
              <span class="register-loading"></span>
            </div>
            <div v-if="emailValid" class="register-validation-status valid">
              ✓
            </div>
          </div>
          <div v-if="errors.email" class="register-error-message">{{ errors.email }}</div>
        </div>

        <div class="register-form-group">
          <label for="password">Password *</label>
          <div class="register-password-input">
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              required
              placeholder="Create a strong password"
              :class="{ 'error': errors.password }"
            />
            <button type="button" class="register-password-toggle" @click="showPassword = !showPassword">
              {{ showPassword ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <div v-if="errors.password" class="register-error-message">{{ errors.password }}</div>
          <div class="register-password-strength">
            <div class="register-strength-bar" :class="passwordStrengthClass"></div>
            <span class="register-strength-text">{{ passwordStrengthText }}</span>
          </div>
        </div>

        <div class="register-form-group">
          <label for="confirmPassword">Confirm Password *</label>
          <div class="register-password-input">
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              required
              placeholder="Confirm your password"
              :class="{ 'error': errors.confirmPassword }"
            />
            <button type="button" class="register-password-toggle" @click="showConfirmPassword = !showConfirmPassword">
              {{ showConfirmPassword ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <div v-if="errors.confirmPassword" class="register-error-message">{{ errors.confirmPassword }}</div>
        </div>

        <div class="register-form-group">
          <label for="gender">Gender</label>
          <select id="gender" v-model="form.gender" class="register-select-input">
            <option value="">Select gender</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>

        <div v-if="authStore.error" class="register-alert alert-error">
          {{ authStore.error }}
          <button type="button" @click="authStore.clearError()" class="register-alert-close">×</button>
        </div>

        <div class="register-terms">
          <input
            id="terms"
            v-model="acceptedTerms"
            type="checkbox"
            required
          />
          <label for="terms">
            I agree to the <a href="#" class="register-link">Terms of Service</a> and <a href="#" class="register-link">Privacy Policy</a>
          </label>
        </div>

        <button type="submit" class="register-btn register-btn-primary" :disabled="authStore.loading || !acceptedTerms">
          <span v-if="authStore.loading">Creating Account...</span>
          <span v-else>Create Account</span>
        </button>

        <div class="register-footer">
          <p>
            Already have an account?
            <router-link to="/login" class="register-link">Sign in</router-link>
          </p>
        </div>
      </form>
    </div>

    <div class="register-background">
      <div class="register-background-shapes">
        <div class="register-shape register-shape-1"></div>
        <div class="register-shape register-shape-2"></div>
        <div class="register-shape register-shape-3"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { FREE_TRIAL_DAYS } from '@/services/subscription.service';
import '@/assets/css/register.css';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

/** Set by the free card on /plans, which sends a visitor here rather than to
 *  /payment — there is nothing to pay for, and nothing to sign in to yet. */
const cameForFreeTrial = computed(() => route.query.plan === 'free');

const form = reactive({
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  gender: '' as 'M' | 'F' | '',
});

const confirmPassword = ref('');
const acceptedTerms = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const usernameValid = ref(false);
const emailValid = ref(false);
const usernameChecking = ref(false);
const emailChecking = ref(false);

const errors = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  first_name: '',
  last_name: '',
});

const passwordStrength = computed(() => {
  const password = form.password;
  if (!password) return 0;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return score;
});

const passwordStrengthClass = computed(() => {
  if (passwordStrength.value <= 2) return 'weak';
  if (passwordStrength.value <= 3) return 'medium';
  return 'strong';
});

const passwordStrengthText = computed(() => {
  if (!form.password) return '';
  if (passwordStrength.value <= 2) return 'Weak';
  if (passwordStrength.value <= 3) return 'Medium';
  return 'Strong';
});

const validateForm = () => {
  let isValid = true;

  // Clear previous errors
  Object.keys(errors).forEach(key => errors[key as keyof typeof errors] = '');

  // Username validation
  if (!form.username.trim()) {
    errors.username = 'Username is required';
    isValid = false;
  } else if (form.username.length < 3) {
    errors.username = 'Username must be at least 3 characters';
    isValid = false;
  } else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
    errors.username = 'Username can only contain letters, numbers, and underscores';
    isValid = false;
  }

  // Email validation
  if (!form.email.trim()) {
    errors.email = 'Email is required';
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Please enter a valid email address';
    isValid = false;
  }

  // Password validation
  if (!form.password) {
    errors.password = 'Password is required';
    isValid = false;
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
    isValid = false;
  }

  // Confirm password validation
  if (!confirmPassword.value) {
    errors.confirmPassword = 'Please confirm your password';
    isValid = false;
  } else if (form.password !== confirmPassword.value) {
    errors.confirmPassword = 'Passwords do not match';
    isValid = false;
  }

  return isValid;
};

const validateUsername = async () => {
  const username = form.username.trim().toLowerCase();

  if (username.length < 3) {
    errors.username = 'Username must be at least 3 characters';
    usernameValid.value = false;
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.username = 'Username can only contain letters, numbers, and underscores';
    usernameValid.value = false;
    return;
  }

  usernameChecking.value = true;
  try {
    const result = await authStore.checkUsername(username);
    if (result.available) {
      errors.username = '';
      usernameValid.value = true;
    } else {
      errors.username = 'Username is already taken';
      usernameValid.value = false;
    }
  } catch (error) {
    errors.username = 'Unable to check username availability';
    usernameValid.value = false;
  } finally {
    usernameChecking.value = false;
  }
};

const validateEmail = async () => {
  const email = form.email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email address';
    emailValid.value = false;
    return;
  }

  emailChecking.value = true;
  try {
    const result = await authStore.checkEmail(email);
    if (result.available) {
      errors.email = '';
      emailValid.value = true;
    } else {
      errors.email = 'Email is already registered';
      emailValid.value = false;
    }
  } catch (error) {
    errors.email = 'Unable to check email availability';
    emailValid.value = false;
  } finally {
    emailChecking.value = false;
  }
};

watch(() => form.password, () => {
  if (confirmPassword.value && form.password !== confirmPassword.value) {
    errors.confirmPassword = 'Passwords do not match';
  } else {
    errors.confirmPassword = '';
  }
});

watch(() => confirmPassword.value, () => {
  if (form.password !== confirmPassword.value) {
    errors.confirmPassword = 'Passwords do not match';
  } else {
    errors.confirmPassword = '';
  }
});

const handleRegister = async () => {
  if (!validateForm() || !acceptedTerms.value) return;

  try {
    const userData = {
      ...form,
      username: form.username.toLowerCase(),
      email: form.email.toLowerCase(),
    };

    const response = await authStore.register(userData);

    // Store verification data. The username joins the pair because the verify
    // page sends the welcome notification, app 16 addresses people by username,
    // and the store's copy does not survive a reload of that page.
    localStorage.setItem('verification_user_id', response.user_id);
    localStorage.setItem('verification_email', form.email.toLowerCase());
    localStorage.setItem('verification_username', form.username.toLowerCase());

    // Redirect to verification page
    router.push('/verify-email');
  } catch (error) {
    console.error('Registration error:', error);
  }
};
</script>
