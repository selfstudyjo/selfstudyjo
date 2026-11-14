<template>
  <!--
    ONE WRITTEN STEP of a lab task: the prose, every command in it as code with
    its own Copy button, and WHY it is run (the step's own explanation, or one
    derived from the command / the tool by labSteps.ts). Nothing reaches
    v-html: a step is text that arrived over the network.
  -->
  <span class="sl-step">
    <span class="sl-step__line">
      <template v-for="(part, at) in parsed.parts" :key="at">
        <span v-if="part.kind === 'text'">{{ part.text }}</span>
        <span v-else class="sl-step__cmd" dir="ltr">
          <code>{{ part.text }}</code>
          <button type="button" class="sl-step__copy" :title="$t('Copy')"
                  :aria-label="$t('Copy the command: {v0}', { v0: part.text })"
                  @click.stop="copy(part.text)">
            <Check v-if="copied === part.text" class="sl-i" aria-hidden="true" />
            <Copy v-else class="sl-i" aria-hidden="true" />
          </button>
        </span>
      </template>
    </span>
    <span v-if="parsed.why" class="sl-step__why">
      <strong>{{ $t('Why') }}:</strong> {{ parsed.why }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Copy } from 'lucide-vue-next';
import { parseStep } from '@/utils/labSteps';

const props = defineProps<{ step: string }>();
const parsed = computed(() => parseStep(props.step));
const copied = ref('');
let timer: number | undefined;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers / an insecure context: the textarea route still works.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.setProperty('position', 'fixed');
    area.style.setProperty('opacity', '0');
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } catch { /* nothing more to try */ }
    area.remove();
  }
  copied.value = text;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { copied.value = ''; }, 1600);
}
</script>
