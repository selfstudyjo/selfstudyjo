<template>
  <div class="tm-page">
    <div class="tm-hero">
      <h1>🎤 Toastmasters AI Training</h1>
      <p>Master public speaking with AI-powered evaluation and feedback.</p>
    </div>
    <div class="tm-card-grid">
      <router-link to="/toastmasters/pre-session" class="tm-card">
        <div class="tm-card-icon">🚀</div>
        <h3>Start New Session</h3>
        <p>Practice a speech with 6 AI evaluators watching and giving real-time feedback.</p>
      </router-link>
      <router-link to="/toastmasters/results" class="tm-card">
        <div class="tm-card-icon">📊</div>
        <h3>My Results</h3>
        <p>View your past sessions, filler word trends, and progression charts.</p>
      </router-link>
      <div class="tm-card tm-info">
        <div class="tm-card-icon">🎯</div>
        <h3>Skills You'll Build</h3>
        <ul>
          <li>Public speaking confidence</li>
          <li>Reduced filler words</li>
          <li>Better time management</li>
          <li>Stronger body language</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style src="@/assets/css/toastmasters.css"></style>