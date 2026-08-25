<template>
  <div class="tm-page">
    <div class="tm-hero">
      <h1>{{ $t('🎤 Toastmasters AI Training') }}</h1>
      <p>{{ $t('Master public speaking with AI-powered evaluation and feedback.') }}</p>
    </div>
    <div class="tm-card-grid">
      <router-link to="/toastmasters/pre-session" class="tm-card">
        <div class="tm-card-icon">🚀</div>
        <h3>{{ $t('Start New Session') }}</h3>
        <p>{{ $t('Practice a speech with 6 AI evaluators watching and giving real-time feedback.') }}</p>
      </router-link>
      <router-link to="/toastmasters/results" class="tm-card">
        <div class="tm-card-icon">📊</div>
        <h3>{{ $t('My Results') }}</h3>
        <p>{{ $t('View your past sessions, filler word trends, and progression charts.') }}</p>
      </router-link>
      <div class="tm-card tm-info">
        <div class="tm-card-icon">🎯</div>
        <h3>{{ $t('Skills You\'ll Build') }}</h3>
        <ul>
          <li>{{ $t('Public speaking confidence') }}</li>
          <li>{{ $t('Reduced filler words') }}</li>
          <li>{{ $t('Better time management') }}</li>
          <li>{{ $t('Stronger body language') }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style src="@/assets/css/toastmasters.css"></style>