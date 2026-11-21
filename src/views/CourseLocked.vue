<template>
  <div class="cl-page">
    <section class="cl-card" role="alert">
      <div class="cl-icon" aria-hidden="true">🔒</div>
      <h1>{{ $t('This part of the course is not available to you') }}</h1>
      <p v-if="part === 'lessons'">{{ $t('The course administrator has limited who can open the lessons of this course.') }}</p>
      <p v-else-if="part === 'labs'">{{ $t('The course administrator has limited who can open the labs of this course.') }}</p>
      <p v-else-if="part === 'exams'">{{ $t('The course administrator has limited who can take the exams of this course.') }}</p>
      <p v-else-if="part === 'quizzes'">{{ $t('The course administrator has limited who can take the quizzes of this course.') }}</p>
      <p v-else-if="part === 'runbooks'">{{ $t('The course administrator has limited who can open the runbooks of this course.') }}</p>
      <p class="cl-help">{{ $t('If you think you should have access, contact support@selfstudyjo.com.') }}</p>
      <div class="cl-actions">
        <router-link v-if="course" class="sfs-btn sfs-btn--primary" :to="`/course/${course}`">{{ $t('Back to the course') }}</router-link>
        <router-link class="sfs-btn" to="/courses">{{ $t('All courses') }}</router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/** Where the course-access guard sends a student (router/course-access-guard.ts). */
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const part = computed(() => String(route.query.part || ''));
const course = computed(() => String(route.query.course || ''));
</script>

<style scoped>
.cl-page { display: flex; justify-content: center; padding: 3rem 1rem; }
.cl-card {
  max-width: 36rem; width: 100%; text-align: center; padding: 2rem 1.5rem; border-radius: 1rem;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
  color: var(--sfs-text, #e8eaf6);
}
.cl-icon { font-size: 2.5rem; }
.cl-card h1 { font-size: 1.4rem; margin: 0.5rem 0 0.75rem; }
.cl-card p { margin: 0 0 0.5rem; color: var(--sfs-text-muted, #b8bdd8); }
.cl-help { font-size: 0.9rem; }
.cl-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; margin-top: 1.25rem; }
</style>
