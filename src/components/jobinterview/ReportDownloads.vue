<template>
  <!--
    The two downloads. Both files are built in this browser from the session
    already on screen -- nothing is sent anywhere, and a report can be downloaded
    the moment it is written, before the save to app 27 has even landed.
  -->
  <div class="ji-downloads" role="group" :aria-label="$t('Download your report')">
    <span class="ji-downloads-label">{{ $t('Download your report') }}</span>
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
    <p class="ji-downloads-error" v-if="error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FileDown, FileText } from 'lucide-vue-next';
import { d, dir, localeId, t } from '@/i18n/runtime';
import type { ReportSession } from '@/utils/interviewReport/model';

const props = defineProps<{
  /** The session to report on. A getter, so it is read at click time, not mount. */
  session: () => ReportSession;
  disabled?: boolean;
}>();

const busy = ref<'pdf' | 'docx' | null>(null);
const error = ref('');

async function download(format: 'pdf' | 'docx') {
  if (busy.value) return;
  busy.value = format;
  error.value = '';
  try {
    // Lazily: the PDF layout draws A4 pages on canvas and has no business in
    // the chunk every other page of the platform downloads.
    const { downloadInterviewReport } = await import('@/utils/interviewReport');
    await downloadInterviewReport(props.session(), format, {
      tr: t,
      dir: dir.value,
      lang: localeId.value,
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
