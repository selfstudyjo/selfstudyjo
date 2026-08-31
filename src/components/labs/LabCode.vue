<template>
  <div class="sl-code">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <FileCode class="sl-i" />
        <span>{{ $t(tool.label) }}</span>
        <span class="sl-tag sl-tag--real">{{ $t('Real') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--primary sl-btn--sm"
                :disabled="busy || !code.trim()" @click="submit">
          <Play class="sl-i" /> {{ $t('Run') }}
        </button>
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                :disabled="!busy" @click="stop">
          <Square class="sl-i" /> {{ $t('Stop') }}
        </button>
      </div>
    </div>

    <p v-if="tool.fidelity" class="sl-console__fidelity">{{ tool.fidelity }}</p>

    <!-- LTR, and Tab inserts four spaces rather than leaving the field.
         Python is indentation-sensitive, so a Tab that moves focus makes the
         editor unusable for the one language that needs it most. -->
    <textarea
      v-model="code"
      class="sl-code__editor"
      dir="ltr"
      spellcheck="false"
      rows="14"
      :placeholder="$t('Write a program and press Run, or Ctrl+Enter')"
      @keydown.tab.prevent="indent"
      @keydown.ctrl.enter.prevent="submit"
      @keydown.meta.enter.prevent="submit"
    ></textarea>

    <div class="sl-code__out" dir="ltr">
      <div class="sl-code__outhead">{{ $t('Output') }}</div>
      <pre v-if="busy" class="sl-code__pre">{{ $t('Running...') }}</pre>
      <pre v-else-if="output" class="sl-code__pre">{{ output }}</pre>
      <pre v-else-if="error" class="sl-code__pre sl-code__pre--err">{{ error }}</pre>
      <pre v-else class="sl-code__pre sl-code__pre--quiet">{{ $t('Nothing yet.') }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Python tool: a real CPython process.
 *
 * The whole editor buffer goes as one request, so this is a *program* rather
 * than a REPL — which is stated because it changes what a student expects: there
 * is no state between runs, and a name bound in one run is gone in the next.
 *
 * `Stop` posts to the kill endpoint through the parent's `stop` handler rather
 * than aborting the request, because the process is on the replica and abandoning
 * the fetch would leave it running. That is the same reason the standalone Python
 * tool has always had a Stop.
 */
import { ref } from 'vue';
import { FileCode, Play, Square } from 'lucide-vue-next';
import type { LabTool } from '@/utils/labCatalogue';

const props = defineProps<{
  tool: LabTool;
  initial?: string;
  run: (code: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
  stopRun?: () => Promise<unknown>;
}>();

const code = ref(props.initial || '');
const output = ref('');
const error = ref('');
const busy = ref(false);

function indent(event: KeyboardEvent) {
  const field = event.target as HTMLTextAreaElement;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  code.value = code.value.slice(0, start) + '    ' + code.value.slice(end);
  // The caret has to be moved after Vue has written the new value back, or it
  // lands at the start and the next keystroke is inserted in the wrong place.
  requestAnimationFrame(() => {
    field.selectionStart = field.selectionEnd = start + 4;
  });
}

async function submit() {
  const text = code.value;
  if (!text.trim() || busy.value) return;
  busy.value = true;
  output.value = '';
  error.value = '';
  try {
    const result = await props.run(text);
    output.value = result?.output || '';
    error.value = result?.error || '';
    if (!output.value && !error.value) output.value = '(the program printed nothing)';
  } finally {
    busy.value = false;
  }
}

async function stop() {
  if (props.stopRun) await props.stopRun();
}
</script>
