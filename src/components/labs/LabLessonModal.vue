<template>
  <Teleport to="body">
    <!--
      THE LESSON, WITHOUT LEAVING THE LAB.

      Teleported to <body> for the reason the tour's overlay is: the workbench
      is a positioned box, one `z-index` away from a stacking context that would
      paint this dialog under the sidebar. The lab keeps running behind it -
      nothing in the workspace is unmounted - so closing it lands the student
      exactly where they were, console transcript and unsaved editor included.
    -->
    <div v-if="open" class="sll-overlay" role="presentation" @click.self="$emit('close')">
      <div ref="dialog" class="sll-dialog" role="dialog" aria-modal="true"
           :aria-label="$t('Review the lesson')" tabindex="-1" @keydown.esc="$emit('close')">
        <header class="sll-head">
          <h2 class="sll-title">
            <BookOpen class="sll-i" aria-hidden="true" />
            {{ current ? $td(current, 'title') : $t('Review the lesson') }}
          </h2>
          <button type="button" class="sll-close" :aria-label="$t('Close')" @click="$emit('close')">
            <X class="sll-i" aria-hidden="true" />
          </button>
        </header>

        <!-- Several lessons can practise one lab; let the student pick. -->
        <nav v-if="lessons.length > 1" class="sll-tabs" :aria-label="$t('Lessons for this lab')">
          <button v-for="row in lessons" :key="row.external_lesson_id" type="button"
                  class="sll-tab" :class="{ 'is-active': row.external_lesson_id === currentId }"
                  @click="currentId = row.external_lesson_id">{{ $td(row, 'title') }}</button>
        </nav>

        <div class="sll-body">
          <p v-if="loading" class="sll-state">{{ $t('Loading the lesson...') }}</p>
          <p v-else-if="error" class="sll-state">{{ error }}</p>
          <p v-else-if="!current" class="sll-state">
            {{ $t('No lesson is linked to this lab yet. The brief and the tasks have everything you need.') }}
          </p>
          <template v-else>
            <LabBrief v-if="content" :text="content" />
            <p v-else class="sll-state">{{ $t('This lesson has no write-up yet.') }}</p>
            <p v-if="current.reading_url" class="sll-links">
              <a :href="current.reading_url" target="_blank" rel="noopener noreferrer">
                {{ $t('Reading material') }}
              </a>
            </p>
          </template>
        </div>

        <footer class="sll-foot">
          <router-link v-if="current && courseOf(current)" class="sl-btn sl-btn--ghost sl-btn--sm"
                       :to="lessonLink(current)">
            {{ $t('Open the full lesson page') }}
          </router-link>
          <button type="button" class="sl-btn sl-btn--primary sl-btn--sm" @click="$emit('close')">
            {{ $t('Back to the lab') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * "Review the lesson" from inside a lab: the write-up of the lesson that
 * practises this lab, in a modal over the workspace.
 *
 * Which lesson: ONLY lessons app 19 says link to this lab (`lab_id`), handed
 * in by the workspace, which fetched them to decide whether to draw the button
 * at all. The one the student came from (`origin`) is selected first when it is
 * one of them. An origin that is NOT one of them is ignored rather than
 * fetched: that fallback is how a lab with no course opened an unrelated
 * lesson. Rendered with `LabBrief`, i.e. the same `lessonContent` parser
 * the lesson page uses, so a heading or a code block reads identically in both
 * places - and nothing reaches `v-html`.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { BookOpen, X } from 'lucide-vue-next';
import LabBrief from '@/components/labs/LabBrief.vue';
import { t, td } from '@/i18n/runtime';
import { courseService, type Lesson } from '@/services/course.service';
import { lessonPath, type LessonRef } from '@/utils/learningTrail';

const props = defineProps<{
  open: boolean;
  labId: string;
  origin?: LessonRef | null;
  /** The lessons that link this lab, already fetched by the workspace. */
  lessons?: Lesson[];
}>();
defineEmits<{ (event: 'close'): void }>();

const lessons = ref<Lesson[]>([]);
const currentId = ref('');
const loading = ref(false);
const error = ref('');
const dialog = ref<HTMLElement | null>(null);
/** Loaded once per lab: re-opening the modal must not refetch. */
let loadedFor = '';

const current = computed(() =>
  lessons.value.find(row => row.external_lesson_id === currentId.value) || null);
const content = computed(() => (current.value ? td(current.value, 'content') : '') || '');

function courseOf(row: Lesson): string {
  return String(row.course_external_id || (row as any).course || '');
}
function lessonLink(row: Lesson) {
  return lessonPath(courseOf(row), row.external_lesson_id);
}

async function load() {
  if (loadedFor === props.labId) return;
  loading.value = true;
  error.value = '';
  try {
    const rows = (props.lessons && props.lessons.length)
      ? props.lessons
      : await courseService.getLessonsForLab(props.labId);
    const origin = props.origin;
    lessons.value = rows.filter(row => String(row.lab_id || '') === props.labId);
    currentId.value = (origin && lessons.value.some(row => row.external_lesson_id === origin.lessonId))
      ? origin.lessonId : (lessons.value[0]?.external_lesson_id || '');
    loadedFor = props.labId;
  } catch {
    error.value = t('Could not load the lesson. Check your connection and try again.');
  } finally {
    loading.value = false;
  }
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  dialog.value?.focus();
  await load();
});
watch(() => props.labId, () => { loadedFor = ''; lessons.value = []; });
watch(() => props.lessons, () => { loadedFor = ''; });
</script>

<style scoped>
.sll-overlay {
  /* The lab's tokens. This window is teleported to <body>, OUTSIDE the
     `.sl-workspace` root that declares them, so the shared `.sl-btn` had no
     border, radius or surface here - a ghost button rendered as bare text. */
  --sl-radius: 12px;
  --sl-radius-sm: 8px;
  --sl-line: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  --sl-surface: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  --sl-surface-2: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1);
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  padding: clamp(0.5rem, 3vw, 2rem);
  background: var(--sfs-overlay, rgb(0 0 0 / 0.6));
  overflow-y: auto;
}

.sll-dialog {
  display: flex;
  flex-direction: column;
  width: min(100%, 56rem);
  max-height: calc(100dvh - 2 * clamp(0.5rem, 3vw, 2rem));
  margin: auto;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  border-radius: var(--sfs-radius-lg, 16px);
  background: var(--sfs-space, #0b0e1a);
  color: var(--sfs-text, #e6e8ef);
  box-shadow: var(--sfs-shadow-strong, 0 20px 50px rgb(0 0 0 / 0.45));
  outline: none;
}

.sll-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
}

.sll-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.15rem;
}

.sll-i { width: 1.1em; height: 1.1em; flex: none; }

.sll-close {
  display: inline-flex;
  padding: 0.35rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.sll-close:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08); }

.sll-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.6rem 1.25rem 0;
}

.sll-tab {
  padding: 0.3rem 0.7rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.sll-tab.is-active {
  border-color: var(--sfs-accent, #667eea);
  background: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #fff);
}

.sll-body {
  flex: 1 1 auto;
  min-height: 8rem;
  padding: 1rem 1.25rem;
  overflow-y: auto;
}

.sll-state { color: var(--sfs-text-muted, #b8bdd0); }

.sll-links { margin-top: 1rem; }

.sll-links a { color: var(--sfs-accent-text, #a3b1ff); }

.sll-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.8rem 1.25rem;
  border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
}
</style>
