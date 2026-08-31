<template>
  <div class="sl-console">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <component :is="icon" class="sl-i" />
        <span>{{ $t(tool.label) }}</span>
        <span v-if="tool.simulated" class="sl-tag sl-tag--sim">{{ $t('Simulated') }}</span>
        <span v-else class="sl-tag sl-tag--real">{{ $t('Real') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                @click="lines = []">
          <Eraser class="sl-i" /> {{ $t('Clear') }}
        </button>
      </div>
    </div>

    <!-- The fidelity line, on the tool's own header.
         Not a footnote: a student who learns a command against a simulator has
         to know which parts of it are real, and the one place they will read
         that is next to the prompt they are typing at. -->
    <p v-if="tool.fidelity" class="sl-console__fidelity">{{ tool.fidelity }}</p>

    <!--
      `dir="ltr"` and it never mirrors.

      A shell transcript is not a paragraph. Rendered right-to-left the bidi
      algorithm reorders the punctuation, so `ls -la /var/log | grep error`
      comes out with the pipe and the flags moved and a student copying it gets
      a command that does not run. `rtl.css` pins every `<pre>` for the same
      reason; this says it locally as well because this element is built here.
    -->
    <div ref="scroller" class="sl-console__body" dir="ltr">
      <div v-if="lines.length === 0" class="sl-console__hello">
        <p>{{ $t(tool.summary) }}</p>
        <p v-if="hint" class="sl-console__hint">{{ hint }}</p>
      </div>
      <div v-for="(line, index) in lines" :key="index"
           class="sl-console__line" :class="`sl-console__line--${line.kind}`">
        <span v-if="line.kind === 'cmd'" class="sl-console__prompt">{{ prompt }}</span><span
        >{{ line.text }}</span>
      </div>
      <div v-if="busy" class="sl-console__line sl-console__line--note">
        {{ $t('Running...') }}
      </div>
    </div>

    <form class="sl-console__form" dir="ltr" @submit.prevent="submit">
      <span class="sl-console__prompt">{{ prompt }}</span>
      <input
        ref="field"
        v-model="entry"
        class="sl-console__input"
        type="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :disabled="busy"
        :placeholder="placeholder"
        @keydown.up.prevent="recall(-1)"
        @keydown.down.prevent="recall(1)"
      >
      <button type="submit" class="sl-btn sl-btn--primary sl-btn--sm"
              :disabled="busy || !entry.trim()">
        <CornerDownLeft class="sl-i" /> {{ $t('Run') }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
/**
 * One console, for all eight of them.
 *
 * Docker, Compose, kubectl, Helm, HDFS, YARN, Spark, the AWS CLI, the az CLI,
 * Terraform, git and the real shell are ONE component. They differ in the tool
 * record and in nothing else the browser cares about — a line goes out, text
 * comes back — so a component per tool would be twelve near-identical files and
 * the twelfth would drift.
 *
 * Three things in here are not cosmetic:
 *
 * **The transcript is text nodes, never `v-html`.** Command output on this
 * platform includes an access-log line a stranger chose and a filename a student
 * typed; `RichText` is for prose and a console is not prose.
 *
 * **The history walks with the arrow keys and is per tool.** That is most of
 * what makes a console usable, and it is stored here rather than in the view
 * because it is presentation: the *authoritative* history is the environment's
 * own log, which the grader reads.
 *
 * **Scrolling to the bottom happens after the DOM has the line.** Doing it in
 * the same tick scrolls to where the transcript ended a moment ago, which reads
 * as the console not following.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import {
  CornerDownLeft, Eraser, Terminal, Boxes, Cloud, Database, FileCode,
  GitBranch, HardDrive, Layers, Server, Zap,
} from 'lucide-vue-next';
import type { LabTool } from '@/utils/labCatalogue';

const props = defineProps<{
  tool: LabTool;
  hint?: string;
  run: (line: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
}>();

type Line = { kind: 'cmd' | 'out' | 'err' | 'note'; text: string };

const lines = ref<Line[]>([]);
const entry = ref('');
const busy = ref(false);
const history = ref<string[]>([]);
const cursor = ref(-1);
const scroller = ref<HTMLElement | null>(null);
const field = ref<HTMLInputElement | null>(null);

const ICONS: Record<string, any> = {
  terminal: Terminal, docker: Boxes, layers: Layers, kubernetes: Boxes,
  package: Layers, hdfs: HardDrive, server: Server, spark: Zap,
  aws: Cloud, azure: Cloud, terraform: Layers, git: GitBranch,
  database: Database, code: FileCode, file: FileCode,
};

const icon = computed(() => ICONS[props.tool.icon] || Terminal);
const prompt = computed(() => props.tool.prompt || '$ ');
const placeholder = computed(() => props.tool.summary.split('.')[0]);

async function submit() {
  const line = entry.value.trim();
  if (!line || busy.value) return;
  entry.value = '';
  cursor.value = -1;
  history.value.push(line);
  lines.value.push({ kind: 'cmd', text: line });
  busy.value = true;
  await scrollDown();
  try {
    const result = await props.run(line);
    if (result?.output) lines.value.push({ kind: 'out', text: result.output });
    if (result?.error) lines.value.push({ kind: 'err', text: result.error });
    if (!result?.output && !result?.error) {
      // A real tool that answers with nothing has succeeded, and a console that
      // shows nothing at all reads as the command having been swallowed.
      lines.value.push({ kind: 'note', text: '(no output)' });
    }
  } finally {
    busy.value = false;
    await scrollDown();
    field.value?.focus();
  }
}

function recall(step: number) {
  if (history.value.length === 0) return;
  if (cursor.value === -1) cursor.value = history.value.length;
  cursor.value = Math.min(history.value.length,
                          Math.max(0, cursor.value + step));
  entry.value = cursor.value >= history.value.length
    ? '' : history.value[cursor.value];
}

async function scrollDown() {
  await nextTick();
  const element = scroller.value;
  if (element) element.scrollTop = element.scrollHeight;
}

onMounted(() => field.value?.focus());
watch(() => props.tool.id, () => { lines.value = []; history.value = []; });
</script>
