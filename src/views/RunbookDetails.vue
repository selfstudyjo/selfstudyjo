<template>
    <div class="runbook-details-container">
      <!-- Back Button -->
      <button @click="goBack" class="back-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" fill="currentColor"/>
        </svg>
        {{ $t('Back to Runbooks') }}
      </button>

      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <p>{{ $t('Loading runbook...') }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-container">
        <div class="error-icon">⚠️</div>
        <h3>{{ $t('Failed to load runbook') }}</h3>
        <p>{{ error }}</p>
        <button @click="fetchRunbook" class="retry-btn">{{ $t('Try Again') }}</button>
      </div>

      <!-- Runbook Content -->
      <div v-else-if="runbook" class="runbook-content">
        <!-- Header -->
        <div class="runbook-header">
          <div class="runbook-title-section">
            <h1 class="runbook-title">{{ $td(runbook) }}</h1>
            <div class="runbook-meta">
              <span class="section-count">
                {{ $t('{v0} steps', { v0: runbook.sections?.length || 0 }) }}
              </span>
              <!--
                READ THE WHOLE RUNBOOK. `spokenParts` is what decides which
                halves of it are said: a CODE section's content is skipped,
                because `switchport mode trunk` read aloud is somewhere between
                unintelligible and misleading and the student can see it on the
                screen. Its HEADING is prose and is read, so the procedure still
                has all its steps.
              -->
              <ReadAloud
                v-if="spokenParts.length"
                id="runbook-all"
                class="runbook-read"
                :parts="spokenParts"
                :title="$td(runbook)"
              />
            </div>
          </div>
        </div>

        <!-- Sections -->
        <div class="sections-container">
          <div
            v-for="(section, index) in runbook.sections"
            :key="section.id"
            class="section-card"
            :style="{
              backgroundColor: section.bg_color,
              color: section.text_color
            }"
          >
            <!-- Section Header -->
            <div class="section-header">
              <div class="section-number">
                {{ index + 1 }}
              </div>
              <div v-if="section.title" class="section-title">
                {{ $td(section) }}
              </div>
              <!--
                The id is the SECTION's own id, which app 17 mints and which is
                stable across a reorder -- unlike the index, which would move
                the transport bar to a different step the moment somebody
                changed the order of the procedure.
              -->
              <ReadAloud
                :id="`runbook-step-${section.id}`"
                class="runbook-read runbook-read--step"
                tone="inherit"
                :parts="stepParts(section)"
                :title="$td(section) || $t('{v0} steps', { v0: index + 1 })"
                compact
              />
            </div>

            <!-- Section Content -->
            <div class="section-content">
              <div
                v-if="section.is_code_block"
                class="code-block-container"
              >
                <div class="code-block-header">
                  <span class="code-label">{{ $t('Code') }}</span>
                  <button
                    @click.stop="copyCode(section.content, section.id)"
                    class="copy-btn"
                    :class="{ 'copied': copiedSectionId === section.id }"
                  >
                    {{ copiedSectionId === section.id ? '✓ Copied!' : 'Copy' }}
                  </button>
                </div>
                <pre class="code-block"><code>{{ section.content }}</code></pre>
              </div>
              <!--
                The PROSE branch is translated; the code branch above is not, and
                deliberately: `switchport mode trunk` is the same command in every
                language, and a student who types a translated keyword gets a
                command that does not run. Same rule `rtl.css` applies when it pins
                every `<pre>` left-to-right.
              -->
              <div v-else class="text-content">
                <template v-for="(paragraph, pIndex) in $td(section, 'content').split('\n')" :key="pIndex">
                  <p v-if="paragraph.trim()">{{ paragraph }}</p>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty Sections State -->
        <div v-if="!loading && runbook.sections?.length === 0" class="empty-sections">
          <div class="empty-icon">📝</div>
          <h3>{{ $t('No steps available') }}</h3>
          <p>{{ $t('This runbook doesn\'t have any steps yet.') }}</p>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ReadAloud from '@/components/ReadAloud.vue';
import { td } from '@/i18n/runtime';
import { runbookService, type Runbook, type RunBookSection } from '@/services/runbook.service';

/**
 * WHAT OF A STEP IS SAID ALOUD, and what is deliberately not.
 *
 * A runbook section is either prose or a code block, and app 17 says which with
 * `is_code_block`. The prose branch is translatable and is read; the code branch
 * is neither. That is the same split the template already makes for rendering
 * and the same rule `rtl.css` follows when it pins every `<pre>`
 * left-to-right -- `python -m venv LabExam` is the same text in every language,
 * and read aloud it is a string of letters a student cannot type back.
 *
 * The heading is read either way, because it is prose and because without it a
 * procedure read aloud loses the step it is on.
 */
function stepParts(section: RunBookSection): string[] {
    const parts = [td(section)];
    if (!section.is_code_block) parts.push(td(section, 'content'));
    return parts.filter(Boolean);
}

const route = useRoute();
const router = useRouter();
const runbook = ref<Runbook | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const copiedSectionId = ref<number | null>(null);

const runbookId = Number(route.params.id);

/** Every step's spoken half, in order, for the whole-runbook control. */
const spokenParts = computed(() =>
    (runbook.value?.sections || []).flatMap(stepParts));

const fetchRunbook = async () => {
  if (isNaN(runbookId) || runbookId <= 0) {
    error.value = 'Invalid runbook ID';
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    error.value = null;
    runbook.value = await runbookService.getRunbookWithSections(runbookId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load runbook';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const copyCode = async (code: string, sectionId: number) => {
  try {
    await navigator.clipboard.writeText(code);

    // Visual feedback
    copiedSectionId.value = sectionId;
    setTimeout(() => {
      copiedSectionId.value = null;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy code:', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = code;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      copiedSectionId.value = sectionId;
      setTimeout(() => {
        copiedSectionId.value = null;
      }, 2000);
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr);
      alert('Failed to copy code to clipboard');
    }
    document.body.removeChild(textArea);
  }
};

const goBack = () => {
  router.push('/runbooks');
};

onMounted(() => {
  fetchRunbook();
});
</script>

<style scoped>
@import '@/assets/css/runbook-details.css';
</style>
