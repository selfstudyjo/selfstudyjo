<template>
  <!--
    What to include, then the format. Both files are built in this browser from
    the session already on screen -- nothing is sent anywhere, and a report can
    be downloaded the moment it is written, before the save to app 27 lands.

    Radio buttons rather than a <select>: four choices whose difference IS the
    point read better side by side than hidden in a drop-down, and each one says
    what it contains rather than relying on a short label.
  -->
  <div class="ji-downloads" role="group" :aria-label="$t('Download your report')">
    <span class="ji-downloads-label">{{ $t('Download your report') }}</span>

    <fieldset class="ji-download-choices" :disabled="busy !== null || disabled">
      <legend class="ji-download-legend">{{ $t('What to include') }}</legend>
      <label v-for="option in options" :key="option.id" class="ji-download-choice"
             :class="{ on: content === option.id }">
        <input type="radio" name="ji-report-content" :value="option.id" v-model="content">
        <span class="ji-download-choice-text">
          <strong>{{ $t(option.label) }}</strong>
          <small>{{ $t(option.description) }}</small>
        </span>
      </label>
    </fieldset>

    <div class="ji-download-buttons">
      <button type="button" class="ji-download-btn" :disabled="busy !== null || disabled"
              @click="download('pdf')">
        <FileDown class="ji-download-icon" aria-hidden="true" />
        <span>{{ busy === 'pdf' ? $t('Preparing PDF…') : $t('PDF') }}</span>
      </button>
      <button type="button" class="ji-download-btn" :disabled="busy !== null || disabled"
              @click="download('docx')">
        <FileText class="ji-download-icon" aria-hidden="true" />
        <span>{{ busy === 'docx' ? $t('Preparing Word file…') : $t('Word (.docx)') }}</span>
      </button>
    </div>
    <p class="ji-downloads-error" v-if="error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FileDown, FileText } from 'lucide-vue-next';
import { d, dir, localeId, t } from '@/i18n/runtime';
import {
  CONTENT_OPTIONS, type ReportContent, type ReportSession,
} from '@/utils/interviewReport/model';

const props = defineProps<{
  /** The session to report on. A getter, so it is read at click time, not mount. */
  session: () => ReportSession;
  disabled?: boolean;
}>();

/*
  The choices come from the model's own table, so the picker cannot offer a
  report the writers do not know how to build. Importing the model module is
  cheap -- it is plain data and string helpers -- and the heavy halves (the DOCX
  writer and the canvas layout) still load only on click.
*/
const options = CONTENT_OPTIONS;

/**
 * The last choice is remembered: somebody who downloads revision sheets wants
 * one again next time, not the full report back every visit.
 */
const STORE_KEY = 'sfs-ji-report-content';
function remembered(): ReportContent {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (CONTENT_OPTIONS.some(o => o.id === v)) return v as ReportContent;
  } catch { /* private mode */ }
  return 'full';
}
const content = ref<ReportContent>(remembered());

const busy = ref<'pdf' | 'docx' | null>(null);
const error = ref('');

async function download(format: 'pdf' | 'docx') {
  if (busy.value) return;
  busy.value = format;
  error.value = '';
  try { localStorage.setItem(STORE_KEY, content.value); } catch { /* private mode */ }
  try {
    // Lazily: the PDF layout draws A4 pages on canvas and has no business in
    // the chunk every other page of the platform downloads.
    const { downloadInterviewReport } = await import('@/utils/interviewReport');
    await downloadInterviewReport(props.session(), format, {
      tr: t,
      dir: dir.value,
      lang: localeId.value,
      content: content.value,
      formatDate: iso => d(iso, { year: 'numeric', month: 'long', day: 'numeric' }),
    });
  } catch (e) {
    console.error('Report download failed:', e);
    error.value = t('The report could not be created. Please try again.');
  } finally {
    busy.value = null;
  }
}
</script>
