<template>
  <!--
    THE WAY BACK TO THE LESSON, and the lesson's other activities beside it.

    Drawn on a quiz, a quiz result, a lab and a runbook - every page a lesson
    links out to - so the student is never more than one click from the lesson
    they came from. What goes in the row is decided in `utils/learningTrail.ts`;
    this component fetches the four facts it needs and draws.

    Everything here is BEST EFFORT. A cold app 19, 20 or 17 costs a link, never
    the page: the lesson link is drawn from the ids alone the moment the
    component mounts, and the titles and the other activities arrive after.
  -->
  <nav v-if="links.length" class="sfs-trail" :class="`sfs-trail--${variant}`"
       :aria-label="$t('Related to this lesson')">
    <p v-if="heading && variant === 'card'" class="sfs-trail__heading">{{ heading }}</p>
    <div class="sfs-trail__row">
      <router-link
        v-for="link in links"
        :key="link.kind"
        :to="link.to"
        class="sfs-trail__link"
        :class="`sfs-trail__link--${link.kind}`"
        :title="titleFor(link)"
      >
        <component :is="ICONS[link.kind]" class="sfs-trail__icon"
                   :class="{ 'sfs-flip': link.kind === 'lesson' || link.kind === 'next' }"
                   aria-hidden="true" />
        <span class="sfs-trail__label">
          <span v-if="prefixFor(link)" class="sfs-trail__prefix">{{ prefixFor(link) }}</span>
          <span class="sfs-trail__text">{{ link.translate ? $t(link.label) : link.label }}</span>
        </span>
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, BookOpen, ClipboardList, FlaskConical, ListChecks } from 'lucide-vue-next';
import { useAuthStore } from '@/store/auth';
import { courseService, type Course, type Lesson } from '@/services/course.service';
import { quizService } from '@/services/quiz.service';
import { runbookService } from '@/services/runbook.service';
import { td, t } from '@/i18n/runtime';
import {
    browserStore, nextLessonOf, rememberOrigins, trailLinks,
    type TrailHere, type TrailKind, type TrailLink,
} from '@/utils/learningTrail';

const props = withDefaults(defineProps<{
    courseId: string;
    lessonId: string;
    here: TrailHere;
    /** Already known by the page (a quiz page knows its quiz) - skips a lookup. */
    quizId?: string;
    variant?: 'card' | 'bar';
    /** Already translated by the caller, so the key is a literal the i18n check can see. */
    heading?: string;
}>(), { quizId: '', variant: 'card', heading: '' });

const ICONS: Record<TrailKind, unknown> = {
    lesson: ArrowLeft,
    course: BookOpen,
    lab: FlaskConical,
    runbook: ClipboardList,
    quiz: ListChecks,
    next: ArrowRight,
};

const authStore = useAuthStore();
const lesson = ref<Lesson | null>(null);
const course = ref<Course | null>(null);
const next = ref<Lesson | null>(null);
const runbookId = ref<number | null>(null);
const foundQuizId = ref('');

const links = computed<TrailLink[]>(() => trailLinks({
    here: props.here,
    courseId: props.courseId,
    lessonId: props.lessonId,
    lessonTitle: lesson.value ? td(lesson.value) : '',
    courseTitle: course.value ? td(course.value) : '',
    labId: lesson.value?.lab_id || '',
    runbookId: runbookId.value,
    quizId: props.quizId || foundQuizId.value,
    next: next.value ? { id: next.value.external_lesson_id, title: td(next.value) } : null,
    access: { lab: authStore.hasLabAccess, runbook: authStore.hasRunbookAccess },
}));

/**
 * A record title on a button reads as a heading with no verb, so the lesson,
 * the course and the next lesson each get a short prefix saying what clicking
 * does. The generic fallbacks already say it, so they get none.
 */
function prefixFor(link: TrailLink): string {
    if (link.translate) return '';
    if (link.kind === 'lesson') return t('Back to the lesson');
    if (link.kind === 'course') return t('Course');
    if (link.kind === 'next') return t('Next lesson');
    return '';
}

function titleFor(link: TrailLink): string {
    return link.translate ? t(link.label) : link.label;
}

let generation = 0;

async function load() {
    const courseId = (props.courseId || '').trim();
    const lessonId = (props.lessonId || '').trim();
    const mine = ++generation;
    lesson.value = null; course.value = null; next.value = null;
    runbookId.value = null; foundQuizId.value = '';
    if (!courseId || !lessonId) return;

    // Four independent lookups, settled rather than awaited together, so the
    // slowest service decides when ITS link appears and nobody else's.
    const lessonsP = courseService.getCourseLessons(courseId).then(rows => {
        if (mine !== generation) return;
        lesson.value = rows.find(r => r.external_lesson_id === lessonId) || null;
        next.value = nextLessonOf(rows, lessonId);
        // The trail has the whole syllabus in hand, so it seeds the lab → lesson
        // index for every lab this course links - which is what lets a lab
        // opened later from the catalogue still find its way back.
        rememberOrigins(browserStore(), rows.map(r => ({
            labId: r.lab_id || '', courseId, lessonId: r.external_lesson_id,
        })), Date.now());
    });
    const courseP = courseService.getCourse(courseId).then(row => {
        if (mine === generation) course.value = row;
    });
    const quizP = (props.here === 'quiz' || props.quizId)
        ? Promise.resolve()
        : quizService.getQuizzesForLessons([lessonId]).then(rows => {
            if (mine === generation) foundQuizId.value = rows[0]?.external_id || '';
        });
    const runbookP = (props.here === 'runbook' || !authStore.hasRunbookAccess)
        ? Promise.resolve()
        : runbookService.getRunbooksByLesson(courseId).then(map => {
            if (mine === generation) runbookId.value = map.get(lessonId)?.id ?? null;
        });
    await Promise.allSettled([lessonsP, courseP, quizP, runbookP]);
}

onMounted(load);
watch(() => [props.courseId, props.lessonId], load);
</script>

<style scoped src="@/assets/css/lesson-trail.css"></style>
