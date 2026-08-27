<template>
  <div class="lesson-details-page">
    <div v-if="loading" class="lesson-loading">
      <div class="lesson-spinner"></div>
      <p class="lesson-loading-text">{{ $t('Loading lesson…') }}</p>
    </div>

    <div v-else-if="error" class="lesson-error">
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h3 class="lesson-error-title">{{ $t('Unable to load this lesson') }}</h3>
      <p class="lesson-error-text">{{ error }}</p>
      <button class="lesson-btn" @click="fetchLesson">{{ $t('Try Again') }}</button>
      <router-link :to="`/course/${courseId}`" class="lesson-btn lesson-btn--ghost">
        {{ $t('Back to the course') }}
      </router-link>
    </div>

    <div v-else-if="lesson" class="lesson-wrap">
      <nav class="lesson-crumbs" aria-label="Breadcrumb">
        <router-link to="/courses" class="lesson-crumb">{{ $t('Courses') }}</router-link>
        <span class="lesson-crumb-sep" aria-hidden="true">/</span>
        <router-link :to="`/course/${courseId}`" class="lesson-crumb">
          {{ course ? $td(course) : $t('Course') }}
        </router-link>
        <span class="lesson-crumb-sep" aria-hidden="true">/</span>
        <span class="lesson-crumb lesson-crumb--current">{{ $td(lesson) }}</span>
      </nav>

      <header class="lesson-head">
        <div class="lesson-head-meta">
          <span class="lesson-chip">{{ $t('Lesson') }}</span>
          <span v-if="lessonNumber" class="lesson-chip lesson-chip--quiet">
            {{ $t('{v0} of {v1}', { v0: lessonNumber, v1: siblings.length }) }}
          </span>
          <span v-if="minutes" class="lesson-chip lesson-chip--quiet">
            {{ $t('{v0} min read', { v0: minutes }) }}
          </span>
          <span v-if="lesson.date_added" class="lesson-chip lesson-chip--quiet">
            {{ when(lesson.date_added) }}
          </span>
        </div>
        <h1 class="lesson-title">{{ $td(lesson) }}</h1>
      </header>

      <!--
        THE RESOURCE ROW. Every related thing this lesson actually has, and
        nothing it does not: an empty row of five greyed-out buttons reads as a
        broken page, so each is drawn only when its own field is filled.

        The runbook leads it, as it does on the course page, because a runbook is
        the step-by-step version of the lesson and the rest are references beside
        it. It is a <router-link> with no target="_blank" - an internal
        destination stays in the tab, the rule linkify.ts follows - and it is
        drawn only for somebody who can OPEN one, because `/runbooks/:id` carries
        `requiredFeatures: ['runbook_feature']` and a button the guard bounces
        reads as broken rather than as locked.
      -->
      <div v-if="hasResources" class="lesson-resources">
        <router-link
          v-if="runbook"
          :to="`/runbooks/${runbook.id}`"
          class="lesson-res lesson-res--runbook"
          :title="runbook.title"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          {{ $t('Runbook') }}
        </router-link>

        <a v-if="lesson.reading_url" :href="lesson.reading_url" target="_blank" rel="noopener noreferrer" class="lesson-res">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          {{ $t('Reading Material') }}
        </a>

        <a v-if="lesson.source_code_url" :href="lesson.source_code_url" target="_blank" rel="noopener noreferrer" class="lesson-res">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          {{ $t('Source Code') }}
        </a>

        <button v-if="quiz" type="button" class="lesson-res lesson-res--action" @click="openQuiz">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
            <path d="M4 22h16"></path>
          </svg>
          {{ $t('Take Quiz') }}
        </button>

        <button v-if="homeworks.length" type="button" class="lesson-res lesson-res--action" @click="openHomework">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          {{ $t('Homework ({v0})', { v0: homeworks.length }) }}
        </button>
      </div>

      <div class="lesson-grid">
        <div class="lesson-main">
          <!--
            MEDIA. App 18 stores a lesson image and a lesson video in separate
            collections and app 19 keeps them in separate fields, so which
            element to draw is normally decided by which field is filled.
            `mediaKind` is the backstop for an operator who pastes an .mp4 into
            the image box: without it that renders as a broken-image icon, which
            reads as the upload having failed rather than as the wrong box.
          -->
          <figure v-if="videoSrc" class="lesson-media">
            <video class="lesson-video" controls preload="metadata" :src="videoSrc"
                   :poster="imageSrc || undefined"></video>
          </figure>
          <figure v-else-if="imageSrc" class="lesson-media">
            <img class="lesson-image" :src="imageSrc" :alt="$td(lesson)" loading="lazy"
                 @error="imageFailed = true" />
          </figure>

          <section class="lesson-card">
            <h2 class="lesson-h2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
              {{ $t('Lesson content') }}
            </h2>

            <!--
              NOTHING HERE BECOMES HTML (working rule 13). Every block is
              rendered with `{{ }}` or through RichText, which escapes before it
              inserts the anchors it builds itself. The parser is a plain module
              so it can be driven in node - `npm run check:lessoncontent`.
            -->
            <div v-if="contentBlocks.length" class="lesson-body">
              <template v-for="(block, index) in contentBlocks" :key="index">
                <h3 v-if="block.kind === 'heading'" class="lesson-h3">{{ block.text }}</h3>

                <aside v-else-if="block.kind === 'note'" class="lesson-note">
                  <RichText :text="block.text" />
                </aside>

                <ol v-else-if="block.kind === 'list' && block.ordered" class="lesson-ol" :start="block.start">
                  <li v-for="(item, i) in block.items" :key="i"><RichText :text="item" /></li>
                </ol>

                <ul v-else-if="block.kind === 'list'" class="lesson-ul">
                  <li v-for="(item, i) in block.items" :key="i"><RichText :text="item" /></li>
                </ul>

                <!--
                  CODE IS NOT RIGHT-TO-LEFT, and this is the one block on the
                  page that must not mirror. Rendered RTL the bidi algorithm
                  reorders the punctuation, so `ls -la /var/log | grep error`
                  comes out with the pipe and the flags moved and a student who
                  copies it gets a command that does not run. The stylesheet
                  pins it `direction: ltr` and `unicode-bidi: isolate` in
                  addition to rtl.css's <pre> rule, so it stays right even if
                  that shared rule is ever narrowed.
                -->
                <div v-else-if="block.kind === 'code'" class="lesson-code">
                  <div class="lesson-code-bar">
                    <span class="lesson-code-lang">{{ block.language || $t('Code') }}</span>
                    <button type="button" class="lesson-copy" @click="copy(block.text, index)">
                      {{ copiedIndex === index ? $t('Copied') : $t('Copy') }}
                    </button>
                  </div>
                  <pre class="lesson-pre"><code>{{ block.text }}</code></pre>
                </div>

                <p v-else class="lesson-p"><RichText :text="block.text" /></p>
              </template>
            </div>

            <!--
              NO WRITE-UP IS A STATE, NOT AN ERROR. Content is optional on the
              record - only a title and a course are mandatory - so this says so
              plainly and points at whatever the lesson DOES have rather than
              rendering an empty card, which reads as a page that failed to load.
            -->
            <div v-else class="lesson-empty">
              <p>{{ $t('This lesson has no write-up yet.') }}</p>
              <p v-if="lesson.reading_url">
                {{ $t('The reading material above covers it in the meantime.') }}
              </p>
            </div>
          </section>

          <section class="lesson-card lesson-comments">
            <h2 class="lesson-h2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              {{ $t('Discussion') }}
              <span class="lesson-count">{{ comments.length }}</span>
            </h2>

            <p v-if="!authStore.user" class="lesson-signin">
              {{ $t('Please') }}
              <router-link :to="loginLink">{{ $t('login') }}</router-link>
              {{ $t('to comment') }}
            </p>

            <form v-else class="lesson-comment-form" @submit.prevent="submitComment">
              <div class="lesson-mention-wrap">
                <textarea
                  ref="commentBox"
                  v-model="newComment"
                  class="lesson-textarea"
                  rows="4"
                  :placeholder="$t('Ask about this lesson… Use @ to mention someone')"
                  :disabled="submitting"
                  required
                  @input="onMentionInput"
                  @keydown="onMentionKeydown"
                ></textarea>

                <div
                  v-if="showMentions && mentionMatches.length"
                  class="lesson-mention-list"
                  :style="{ top: mentionTop + 'px', left: mentionLeft + 'px' }"
                >
                  <div
                    v-for="(name, index) in mentionMatches"
                    :key="name"
                    class="lesson-mention"
                    :class="{ 'is-selected': mentionIndex === index }"
                    @click="pickMention(name)"
                    @mouseenter="mentionIndex = index"
                  >
                    <span class="lesson-avatar" :style="paint(colourFor(name))">
                      {{ initialsFor(name) }}
                    </span>
                    <span class="lesson-mention-name">{{ name }}</span>
                  </div>
                </div>
              </div>
              <p v-if="commentError" class="lesson-form-error">{{ commentError }}</p>
              <div class="lesson-form-actions">
                <button type="submit" class="lesson-btn" :disabled="!newComment.trim() || submitting">
                  <span v-if="submitting" class="lesson-btn-spinner"></span>
                  <span v-else>{{ $t('Post Comment') }}</span>
                </button>
              </div>
            </form>

            <div class="lesson-comment-list">
              <p v-if="!comments.length" class="lesson-empty">
                {{ $t('No comments on this lesson yet. Be the first to ask.') }}
              </p>
              <article v-for="row in comments" :key="row.external_comment_id" class="lesson-comment">
                <header class="lesson-comment-head">
                  <span class="lesson-avatar" :style="paint(colourFor(displayName(row)))">
                    {{ initialsFor(displayName(row)) }}
                  </span>
                  <div class="lesson-comment-who">
                    <span class="lesson-comment-name">{{ displayName(row) }}</span>
                    <span class="lesson-comment-when">{{ when(row.date_added) }}</span>
                  </div>
                  <button
                    v-if="isMine(row)"
                    type="button"
                    class="lesson-comment-del"
                    :disabled="deletingId === row.external_comment_id"
                    :aria-label="$t('Delete comment')"
                    @click="removeComment(row.external_comment_id)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </header>
                <!--
                  A comment is what a PERSON wrote, so it goes through RichText -
                  which escapes first and only then inserts the links it built -
                  and it is never translated. `unicode-bidi: plaintext` in the
                  stylesheet reads the direction out of the string itself, so an
                  Arabic question and an English one render correctly in the same
                  thread whichever language the interface is in.
                -->
                <div class="lesson-comment-body"><RichText :text="row.content" /></div>
              </article>
            </div>
          </section>
        </div>

        <aside class="lesson-side">
          <section v-if="headings.length" class="lesson-card">
            <h2 class="lesson-h2">{{ $t('On this page') }}</h2>
            <ol class="lesson-toc">
              <li v-for="(heading, index) in headings" :key="index">{{ heading }}</li>
            </ol>
          </section>

          <section v-if="homeworks.length" class="lesson-card">
            <h2 class="lesson-h2">{{ $t('Homework') }}</h2>
            <ul class="lesson-hw">
              <li v-for="hw in homeworks" :key="hw.external_homework_id">
                <span class="lesson-hw-title">{{ $td(hw) }}</span>
                <span v-if="$td(hw, 'description')" class="lesson-hw-desc">
                  {{ $td(hw, 'description') }}
                </span>
              </li>
            </ul>
          </section>

          <section v-if="siblings.length > 1" class="lesson-card">
            <h2 class="lesson-h2">{{ $t('Lessons in this course') }}</h2>
            <ol class="lesson-siblings">
              <li v-for="(row, index) in siblings" :key="row.external_lesson_id">
                <router-link
                  :to="`/course/${courseId}/lesson/${row.external_lesson_id}`"
                  class="lesson-sibling"
                  :class="{ 'is-current': row.external_lesson_id === lessonId }"
                >
                  <span class="lesson-sibling-n">{{ index + 1 }}</span>
                  <span class="lesson-sibling-t">{{ $td(row) }}</span>
                </router-link>
              </li>
            </ol>
          </section>
        </aside>
      </div>

      <nav class="lesson-updown" aria-label="Lesson navigation">
        <router-link
          v-if="previousLesson"
          :to="`/course/${courseId}/lesson/${previousLesson.external_lesson_id}`"
          class="lesson-btn lesson-btn--ghost"
        >
          ← {{ $td(previousLesson) }}
        </router-link>
        <span v-else></span>
        <router-link
          v-if="nextLesson"
          :to="`/course/${courseId}/lesson/${nextLesson.external_lesson_id}`"
          class="lesson-btn lesson-btn--ghost"
        >
          {{ $td(nextLesson) }} →
        </router-link>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * One lesson: its write-up, its media, everything related to it, and its own
 * discussion.
 *
 * WHY THIS PAGE EXISTS. A course page listed twenty lesson titles and, for each,
 * a link to a Google Doc and a link to a GitHub file. There was nowhere on this
 * platform that a lesson itself could be read, and nowhere to ask a question
 * about ONE lesson - the course page's comment box put every question about
 * every lesson into one thread.
 *
 * THREE THINGS ARE DELIBERATE AND EASY TO UNDO BY ACCIDENT:
 *
 *  * **Every record field is read through `$td`.** `lesson.content` is the
 *    ENGLISH copy; on an Arabic page that is the half-translated failure working
 *    rule 41 exists for, and it is invisible to anybody working in English.
 *  * **Nothing is rendered with `v-html`.** The write-up is parsed into blocks by
 *    `src/utils/lessonContent.ts` and every block is interpolated or passed to
 *    `RichText`. This page is open to a signed-out visitor and `content` is a
 *    record fetched over the network.
 *  * **A comment posted here names the lesson AND the course.** App 19 keeps the
 *    course mandatory, so a comment that named only a lesson would disappear
 *    from every `?course_id=` read on the platform. Dropping the lesson instead
 *    is the other half of the same bug: the comment lands on the course and
 *    vanishes from the page it was typed on.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import RichText from '@/components/RichText.vue';
import { rel, td } from '@/i18n/runtime';
import { courseService, type Comment, type Course, type Homework, type Lesson } from '@/services/course.service';
import { quizService } from '@/services/quiz.service';
import { runbookService, type Runbook } from '@/services/runbook.service';
import { notificationService } from '@/services/notification.service';
import { serviceRegistry } from '@/services/config';
import { userService, type UserProfile } from '@/services/user.service';
import { useAuthStore } from '@/store/auth';
import { paint } from '@/theme/contrast';
import { blocks, mediaKind, outline, readingMinutes } from '@/utils/lessonContent';
import { getSecureMediaUrl } from '@/utils/mediaUtils';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const courseId = computed(() => String(route.params.courseId || ''));
const lessonId = computed(() => String(route.params.lessonId || ''));

const loading = ref(false);
const error = ref<string | null>(null);
const lesson = ref<Lesson | null>(null);
const course = ref<Course | null>(null);
const siblings = ref<Lesson[]>([]);
const homeworks = ref<Homework[]>([]);
const runbook = ref<Runbook | null>(null);
const quiz = ref<{ external_id: string } | null>(null);
const comments = ref<Comment[]>([]);
const imageFailed = ref(false);
const copiedIndex = ref<number | null>(null);

const replicaBase = ref<string | null>(null);

const newComment = ref('');
const submitting = ref(false);
const commentError = ref<string | null>(null);
const deletingId = ref<string | null>(null);

const usernames = ref<string[]>([]);
const mentionMatches = ref<string[]>([]);
const showMentions = ref(false);
const mentionIndex = ref(0);
const mentionTop = ref(0);
const mentionLeft = ref(0);
const commentBox = ref<HTMLTextAreaElement | null>(null);
const profiles = new Map<string, UserProfile>();

/**
 * A relative date, or nothing at all when there is no date.
 *
 * `rel()` is `Intl.RelativeTimeFormat` and needs a date; app 19's `date_added`
 * is optional on the type and absent on a handful of old records. Passing
 * `undefined` through would render "in 56 years" rather than nothing, which
 * reads as a corrupted record. Formatted rather than hand-written, so an Arabic
 * or Chinese reader gets their own wording -- `Courses.vue` had its own English
 * `${n} months ago` for a year and it was reordered by bidi inside Arabic prose.
 */
const when = (value?: string | null) => (value ? rel(value) : '');

const loginLink = computed(() => ({
    path: '/login',
    query: { redirect: route.fullPath, message: 'You need to login first to add a comment.' },
}));

/** The write-up, in the reader's language, as blocks. */
const contentBlocks = computed(() =>
    lesson.value ? blocks(td(lesson.value, 'content')) : []);
const headings = computed(() =>
    lesson.value ? outline(td(lesson.value, 'content')) : []);
const minutes = computed(() =>
    lesson.value ? readingMinutes(td(lesson.value, 'content')) : 0);

const hasResources = computed(() => !!(
    runbook.value || lesson.value?.reading_url || lesson.value?.source_code_url
    || quiz.value || homeworks.value.length));

const imageSrc = computed(() => {
    const url = lesson.value?.image_url;
    if (!url || imageFailed.value) return '';
    // A video pasted into the image box is a video. Without this it renders as a
    // broken-image icon, which reads as the upload having failed.
    if (mediaKind(url) === 'video') return '';
    return getSecureMediaUrl(url);
});

const videoSrc = computed(() => {
    const direct = lesson.value?.video_url;
    if (direct) return getSecureMediaUrl(direct);
    const image = lesson.value?.image_url;
    if (image && mediaKind(image) === 'video') return getSecureMediaUrl(image);
    return '';
});

const lessonNumber = computed(() => {
    const index = siblings.value.findIndex(r => r.external_lesson_id === lessonId.value);
    return index < 0 ? 0 : index + 1;
});
const previousLesson = computed(() =>
    lessonNumber.value > 1 ? siblings.value[lessonNumber.value - 2] : null);
const nextLesson = computed(() =>
    lessonNumber.value && lessonNumber.value < siblings.value.length
        ? siblings.value[lessonNumber.value] : null);

const fetchLesson = async () => {
    if (!courseId.value || !lessonId.value) {
        error.value = 'This address is missing the course or the lesson.';
        return;
    }
    loading.value = true;
    error.value = null;
    imageFailed.value = false;

    try {
        const base = await courseService.getRandomCourseReplica();
        if (!base) throw new Error('No course service replicas available');
        replicaBase.value = base;

        // The lesson and its own discussion are what the page cannot render
        // without; everything else is decoration and is allowed to fail. So the
        // two are awaited and the rest are best effort below.
        const [row, discussion] = await Promise.all([
            courseService.getLesson(lessonId.value, base),
            courseService.getLessonComments(courseId.value, lessonId.value, base)
                .catch(() => [] as Comment[]),
        ]);
        lesson.value = row;
        homeworks.value = row.homeworks || [];
        comments.value = [...discussion].reverse();

        // A cold app 19 must not take the write-up down with it, so each of
        // these is caught on its own rather than in one try around all of them:
        // one failure would otherwise cost the reader every sidebar on the page.
        courseService.getCourse(courseId.value, base)
            .then(value => { course.value = value; })
            .catch(() => { course.value = null; });

        courseService.getCourseLessons(courseId.value, base)
            .then(rows => { siblings.value = rows; })
            .catch(() => { siblings.value = []; });

        if (!homeworks.value.length) {
            courseService.getLessonHomeworks(lessonId.value, base)
                .then(rows => { homeworks.value = rows; })
                .catch(() => { /* the sidebar simply does not appear */ });
        }

        // ONLY FOR SOMEBODY WHO CAN OPEN ONE. `/runbooks/:id` is gated on
        // `runbook_feature`, so drawing the link for anybody else produces a
        // button the router guard bounces - which reads as broken rather than as
        // locked. It also skips the request entirely for most visitors.
        if (authStore.hasRunbookAccess) {
            runbookService.getRunbooksByLesson(courseId.value)
                .then(map => { runbook.value = map.get(lessonId.value) || null; })
                .catch(() => { runbook.value = null; });
        }

        loadQuiz();
        loadProfiles();
        if (authStore.user) loadUsernames();
    } catch (err: any) {
        error.value = err?.message || 'Failed to load this lesson. Please try again.';
    } finally {
        loading.value = false;
    }
};

const loadQuiz = async () => {
    quiz.value = null;
    try {
        const base = await quizService.getRandomQuizReplica();
        if (!base) return;
        const rows = await quizService.getQuizzesForLessons([lessonId.value], base);
        const found = rows.find(row => row.lesson_id === lessonId.value);
        if (found?.external_id) quiz.value = { external_id: found.external_id };
    } catch {
        // A quiz badge that fails to load is a badge that is not drawn.
    }
};

const loadProfiles = async () => {
    const ids = [...new Set(comments.value.map(row => row.user_id).filter(Boolean))];
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    await Promise.all(ids.map(async (id) => {
        if (profiles.has(id)) return;
        try {
            const profile = uuid.test(id)
                ? await userService.getUserProfile(id)
                : await userService.getUserProfileByUsername(id);
            if (profile) profiles.set(id, profile);
        } catch { /* an unresolved id renders as itself */ }
    }));
    // Reassigned rather than mutated so the names appear once they resolve.
    comments.value = [...comments.value];
};

const loadUsernames = async () => {
    try { usernames.value = await userService.getAllUsernames(); }
    catch { usernames.value = []; }
};

const displayName = (row: Comment) => {
    const profile = profiles.get(row.user_id);
    if (profile?.username) return profile.username;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuid.test(row.user_id) ? 'User' : (row.user_id || 'User');
};

const isMine = (row: Comment) =>
    row.user_id === authStore.user?.id || row.user_id === authStore.user?.username;

const initialsFor = (name: string) => (name || 'U').slice(0, 2).toUpperCase();

const colourFor = (name: string) => {
    const palette = ['#667eea', '#764ba2', '#f56565', '#ed8936', '#48bb78',
                     '#38b2ac', '#4299e1', '#9f7aea', '#ed64a6', '#f6ad55'];
    const sum = String(name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return palette[sum % palette.length];
};

// --------------------------------------------------------------------- mentions
const onMentionInput = (event: Event) => {
    const box = event.target as HTMLTextAreaElement;
    const before = box.value.slice(0, box.selectionStart);
    const at = before.lastIndexOf('@');
    if (at < 0) { showMentions.value = false; return; }
    const word = before.slice(at + 1).match(/^(\w*)$/);
    if (!word) { showMentions.value = false; return; }
    const needle = word[1].toLowerCase();
    mentionMatches.value = usernames.value
        .filter(name => name.toLowerCase().includes(needle)
            && name !== authStore.user?.username)
        .slice(0, 8);
    if (!mentionMatches.value.length) { showMentions.value = false; return; }
    showMentions.value = true;
    mentionIndex.value = 0;
    const styles = window.getComputedStyle(box);
    const lineHeight = parseInt(styles.lineHeight) || 20;
    const lines = before.slice(0, at).split('\n').length;
    mentionTop.value = lines * lineHeight + (parseInt(styles.paddingTop) || 0) + lineHeight;
    mentionLeft.value = parseInt(styles.paddingLeft) || 0;
};

const onMentionKeydown = (event: KeyboardEvent) => {
    if (!showMentions.value) return;
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        mentionIndex.value = Math.min(mentionIndex.value + 1, mentionMatches.value.length - 1);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        mentionIndex.value = Math.max(mentionIndex.value - 1, 0);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
        if (mentionMatches.value.length) {
            event.preventDefault();
            pickMention(mentionMatches.value[mentionIndex.value]);
        }
    } else if (event.key === 'Escape') {
        showMentions.value = false;
    }
};

const pickMention = (name: string) => {
    const box = commentBox.value;
    if (!box) return;
    const caret = box.selectionStart;
    const before = box.value.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at < 0) return;
    newComment.value = before.slice(0, at) + `@${name} ` + box.value.slice(caret);
    showMentions.value = false;
    nextTick(() => {
        const position = at + name.length + 2;
        box.focus();
        box.setSelectionRange(position, position);
    });
};

const mentionsIn = (text: string) => {
    const found = String(text || '').match(/@(\w+)/g);
    return found ? [...new Set(found.map(x => x.slice(1)))] : [];
};

/**
 * Tell the people a comment named that it named them.
 *
 * `course.lesson_mentioned`, NOT `course.mentioned`. The two differ only in
 * where they point, and that is the whole reason there are two: the course
 * event links to `/course/{courseId}`, whose comment list is the course's own
 * discussion and therefore does not contain this comment. A reader following it
 * lands on a page that does not show the thing they were notified about, and has
 * to guess which of twenty lessons it was.
 */
const notifyMentions = async (text: string) => {
    const author = authStore.user?.username;
    if (!author || !lesson.value) return;

    const named = mentionsIn(text).filter(name => name !== author);
    if (!named.length) return;

    // A mention is only worth sending to somebody who exists. `@lunch` in a
    // sentence is not a person, and a notification addressed to a username
    // nobody holds is a record that will never be read or cleared.
    const recipients: string[] = [];
    for (const name of named) {
        try {
            const profile = await userService.getUserProfileByUsername(name);
            if (profile?.username) recipients.push(profile.username);
        } catch { /* unknown name, or a cold profile service */ }
    }
    if (!recipients.length) return;

    serviceRegistry.clearCache();
    const trimmed = text.trim();
    await notificationService.notify('course.lesson_mentioned', {
        to: recipients,
        sender: author,
        params: {
            author: `@${author}`,
            lesson: lesson.value.title,
            courseId: courseId.value,
            lessonId: lessonId.value,
            excerpt: trimmed.slice(0, 120) + (trimmed.length > 120 ? '…' : ''),
        },
    });
};

const submitComment = async () => {
    const text = newComment.value.trim();
    if (!text || !authStore.user || submitting.value) return;
    submitting.value = true;
    commentError.value = null;
    try {
        serviceRegistry.clearCache();
        const userId = authStore.user.username || authStore.user.id;
        const created = await courseService.createComment({
            external_comment_id:
                `comment_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            content: text,
            user_id: String(userId),
            course: courseId.value,
            // Both references. See the header comment.
            lesson_external_id: lessonId.value,
        }, replicaBase.value || undefined);

        try {
            const profile = authStore.user.username
                ? await userService.getUserProfileByUsername(authStore.user.username)
                : await userService.getUserProfile(authStore.user.id);
            if (profile) profiles.set(String(userId), profile);
        } catch { /* the row renders with the username */ }

        comments.value = [created, ...comments.value];
        newComment.value = '';
        await notifyMentions(text);
    } catch (err: any) {
        commentError.value = err?.message || 'Failed to post your comment.';
    } finally {
        submitting.value = false;
    }
};

const removeComment = async (id: string) => {
    if (!confirm('Delete this comment?')) return;
    deletingId.value = id;
    try {
        serviceRegistry.clearCache();
        await courseService.deleteComment(id, replicaBase.value || undefined);
        comments.value = comments.value.filter(row => row.external_comment_id !== id);
    } catch {
        alert('Failed to delete comment.');
    } finally {
        deletingId.value = null;
    }
};

const openQuiz = () => {
    if (!quiz.value) return;
    router.push({
        path: '/take-quiz',
        query: {
            quizId: quiz.value.external_id,
            lessonId: lessonId.value,
            courseId: courseId.value,
        },
    });
};

const openHomework = () => {
    router.push(`/course/${courseId.value}/lesson/${lessonId.value}/homework`);
};

const copy = async (text: string, index: number) => {
    try {
        await navigator.clipboard.writeText(text);
        copiedIndex.value = index;
        window.setTimeout(() => { copiedIndex.value = null; }, 1500);
    } catch { /* a browser that refuses the clipboard leaves the label alone */ }
};

const closeMentions = (event: MouseEvent) => {
    if (showMentions.value && commentBox.value
        && !commentBox.value.contains(event.target as Node)) {
        showMentions.value = false;
    }
};

// The two ids are route params, so moving between lessons in the sidebar or with
// the prev/next buttons does not remount this component. Without the watch the
// page would keep showing the lesson it was opened on.
watch(() => [courseId.value, lessonId.value], () => {
    window.scrollTo({ top: 0 });
    fetchLesson();
});

onMounted(() => {
    fetchLesson();
    document.addEventListener('click', closeMentions);
});

onUnmounted(() => {
    document.removeEventListener('click', closeMentions);
});
</script>

<style scoped src="@/assets/css/lesson-details.css"></style>
