<template>
  <div class="ji-page">
    <div class="ji-hero">
      <h1>💼 AI Job Interview Practice</h1>
      <p>Practice technical and HR interviews with an AI interviewer and get instant feedback.</p>
    </div>
    <div class="ji-card-grid">
      <router-link to="/job-interview/pre-session" class="ji-card">
        <div class="ji-card-icon">🚀</div>
        <h3>Start New Interview</h3>
        <p>Choose Technical or HR, set your role/topic and qualifications, then get interviewed question-by-question.</p>
      </router-link>
      <router-link to="/job-interview/results" class="ji-card">
        <div class="ji-card-icon">📊</div>
        <h3>My Interview Results</h3>
        <p>Review past interviews, scores, transcripts and detailed feedback reports.</p>
      </router-link>
      <div class="ji-card ji-info">
        <div class="ji-card-icon">🎯</div>
        <h3>What You'll Improve</h3>
        <ul>
          <li>Answering structure (STAR)</li>
          <li>Technical depth & clarity</li>
          <li>Confidence under pressure</li>
          <li>Communication skills</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style src="@/assets/css/job-interview.css"></style>