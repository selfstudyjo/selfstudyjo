<template>
  <Teleport to="body">
    <!--
      THE "i" WINDOW: how to do one task, step by step.

      Teleported to <body> for the reason the lesson modal is: the workbench is
      a positioned box, one `z-index` away from a stacking context that would
      paint this under the sidebar. Opening it changes nothing in the lab - it
      reads the task and the grade, and a task that is done stays done
      however often it is opened.
    -->
    <div v-if="task" class="sltg-overlay" role="presentation" @click.self="$emit('close')">
      <div ref="dialog" class="sltg-dialog" role="dialog" aria-modal="true"
           :aria-labelledby="titleId" tabindex="-1" @keydown.esc="$emit('close')">
        <header class="sltg-head">
          <div class="sltg-head__text">
            <p class="sltg-kicker">
              <Info class="sltg-i" aria-hidden="true" />
              {{ $t('Task {v0} of {v1}', { v0: index + 1, v1: total }) }}
              <span class="sltg-badge" :class="`sltg-badge--${tone}`">{{ $t(statusLabel) }}</span>
            </p>
            <h2 :id="titleId" class="sltg-title">{{ task.title }}</h2>
          </div>
          <button type="button" class="sltg-close" :aria-label="$t('Close')" @click="$emit('close')">
            <X class="sltg-i" aria-hidden="true" />
          </button>
        </header>

        <div class="sltg-body">
          <p v-if="view.kept" class="sltg-callout sltg-callout--good">
            <CheckCircle2 class="sltg-i" aria-hidden="true" />
            {{ $t('Already verified. The environment has moved on since, which is fine - this task stays done.') }}
          </p>
          <p v-else-if="task.status === 'passed'" class="sltg-callout sltg-callout--good">
            <CheckCircle2 class="sltg-i" aria-hidden="true" />
            {{ $t('Done and verified. It stays done, even if a later task changes the environment.') }}
          </p>
          <p v-else-if="view.baseline" class="sltg-callout sltg-callout--warn">
            <AlertTriangle class="sltg-i" aria-hidden="true" />
            {{ $t('This was already true when you started, so it does not count yet. Do the step yourself - edit the file or run the command - and it will.') }}
          </p>

          <section class="sltg-section">
            <h3>{{ $t('What you need to do') }}</h3>
            <p class="sltg-detail">{{ task.instructions?.goal || task.detail || task.title }}</p>
            <p v-if="task.instructions?.done_when" class="sltg-done">
              <strong>{{ $t('Done when') }}:</strong> {{ task.instructions.done_when }}
            </p>
          </section>

          <section v-if="view.where.length" class="sltg-section">
            <h3>{{ $t('Where to work') }}</h3>
            <div class="sltg-tools">
              <button v-for="tool in view.where" :key="tool.id" type="button"
                      class="sl-btn sl-btn--ghost sl-btn--sm"
                      @click="$emit('open-tool', tool.id); $emit('close')">
                {{ tool.label }}
              </button>
            </div>
          </section>

          <section class="sltg-section">
            <h3>{{ $t('Step by step') }}</h3>
            <!-- The task's own written steps first; the generated ones follow
                 as the general checklist. -->
            <ol v-if="task.instructions?.steps?.length" class="sltg-steps sltg-steps--own">
              <li v-for="(step, n) in task.instructions.steps" :key="'own' + n">{{ step }}</li>
            </ol>
            <h3 v-if="task.instructions?.steps?.length" class="sltg-subhead">{{ $t('Before you check') }}</h3>
            <ol class="sltg-steps">
              <li v-for="(step, at) in view.steps" :key="at">
                <span>{{ $t(step.key, step.params || {}) }}</span>
                <span v-if="step.code && step.code.length" class="sltg-codes">
                  <span v-for="code in step.code" :key="code" class="sltg-code" dir="ltr">
                    <code>{{ code }}</code>
                    <button type="button" class="sltg-copy" :title="$t('Copy')"
                            :aria-label="$t('Copy')" @click="copy(code)">
                      <Check v-if="copied === code" class="sltg-i" aria-hidden="true" />
                      <Copy v-else class="sltg-i" aria-hidden="true" />
                    </button>
                  </span>
                </span>
              </li>
            </ol>
          </section>

          <section v-if="view.checks.length" class="sltg-section">
            <h3>{{ $t('How it is checked') }}</h3>
            <ul class="sltg-checks" dir="ltr">
              <li v-for="line in view.checks" :key="line">{{ line }}</li>
            </ul>
            <p v-if="task.note && task.status !== 'passed'" class="sltg-last">
              {{ $t('Last check said:') }} <span dir="ltr">{{ task.note }}</span>
            </p>
          </section>

          <section v-if="view.mistakes.length" class="sltg-section">
            <h3>{{ $t('Common mistakes') }}</h3>
            <ul class="sltg-list">
              <li v-for="(line, at) in view.mistakes" :key="at">{{ $t(line.key, line.params || {}) }}</li>
            </ul>
          </section>

          <section class="sltg-section">
            <h3>{{ $t('Tips') }}</h3>
            <ul class="sltg-list">
              <li v-for="(line, at) in view.tips" :key="at">{{ $t(line.key, line.params || {}) }}</li>
            </ul>
          </section>

          <!--
            THE HINT stays behind a press, exactly as on the card: a hint is a
            thing somebody chooses to reveal, and a guide that printed it would
            hand over the answer to anybody who wanted the steps.
          -->
          <section v-if="task.hint || view.hintCommands.length" class="sltg-section">
            <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm" @click="hintOpen = !hintOpen">
              <Lightbulb class="sltg-i" aria-hidden="true" />
              {{ hintOpen ? $t('Hide hint') : $t('Show the hint') }}
            </button>
            <div v-if="hintOpen" class="sltg-hint">
              <p v-if="task.hint">{{ task.hint }}</p>
              <span v-for="code in view.hintCommands" :key="code" class="sltg-code" dir="ltr">
                <code>{{ code }}</code>
                <button type="button" class="sltg-copy" :title="$t('Copy')"
                        :aria-label="$t('Copy')" @click="copy(code)">
                  <Check v-if="copied === code" class="sltg-i" aria-hidden="true" />
                  <Copy v-else class="sltg-i" aria-hidden="true" />
                </button>
              </span>
            </div>
          </section>
        </div>

        <footer class="sltg-foot">
          <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                  @click="$emit('ask', task, task.instructions?.ask_ai || ''); $emit('close')">
            <Sparkles class="sltg-i" aria-hidden="true" /> {{ $t('Ask the tutor') }}
          </button>
          <button v-if="task.manual && task.status !== 'passed'" type="button"
                  class="sl-btn sl-btn--ghost sl-btn--sm" @click="$emit('self-mark', task.id)">
            <Check class="sltg-i" aria-hidden="true" /> {{ $t('I have done this') }}
          </button>
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
 * One task's information window.
 *
 * Everything it says is DERIVED: `guideFor` in `labCatalogue.ts` turns the
 * grader's structure (which tools, which files, which tables, which commands)
 * into catalogue keys, so the window is in the reader's language while every
 * command, path and table name stays exactly as it must be typed. Nothing here
 * reaches `v-html` - a task's text arrives over the network.
 */
import { computed, nextTick, ref, watch } from 'vue';
import {
  AlertTriangle, Check, CheckCircle2, Copy, Info, Lightbulb, Sparkles, X,
} from 'lucide-vue-next';
import {
  TASK_STATUS_LABELS, guideFor, type LabTask, type LabTool,
} from '@/utils/labCatalogue';

const props = defineProps<{
  task: LabTask | null;
  index: number;
  total: number;
  tools?: LabTool[];
}>();
defineEmits<{
  (event: 'close'): void;
  (event: 'ask', task: LabTask, focus?: string): void;
  (event: 'open-tool', toolId: string): void;
  (event: 'self-mark', taskId: string): void;
}>();

const dialog = ref<HTMLElement | null>(null);
const hintOpen = ref(false);
const copied = ref('');
const titleId = `sltg-title-${Math.random().toString(36).slice(2, 8)}`;

const view = computed(() => guideFor(props.task as LabTask, props.tools || []));
const statusLabel = computed(() =>
  TASK_STATUS_LABELS[props.task?.status || 'pending'] || 'To do');
const tone = computed(() => {
  if (props.task?.status === 'passed') return 'good';
  if (props.task?.status === 'unavailable') return 'bad';
  return 'warn';
});

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = text;
    setTimeout(() => { if (copied.value === text) copied.value = ''; }, 1500);
  } catch { /* a locked-down browser: the command is still selectable */ }
}

watch(() => props.task?.id, async (id) => {
  hintOpen.value = false;
  if (!id) return;
  await nextTick();
  dialog.value?.focus();
});
</script>

<style scoped>
.sltg-overlay {
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

.sltg-dialog {
  display: flex;
  flex-direction: column;
  width: min(100%, 44rem);
  max-height: calc(100dvh - 2 * clamp(0.5rem, 3vw, 2rem));
  margin: auto;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  border-radius: var(--sfs-radius-lg, 16px);
  background: var(--sfs-space, #0b0e1a);
  color: var(--sfs-text, #e6e8ef);
  box-shadow: var(--sfs-shadow-strong, 0 20px 50px rgb(0 0 0 / 0.45));
  outline: none;
}

.sltg-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
}

.sltg-head__text { min-width: 0; }

.sltg-kicker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.25rem;
  font-size: 0.78rem;
  color: var(--sfs-text-muted, #b7bdcc);
}

.sltg-title {
  margin: 0;
  font-size: 1.15rem;
  overflow-wrap: anywhere;
}

.sltg-i { width: 1em; height: 1em; flex: none; }

.sltg-badge {
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}
.sltg-badge--good { background: rgb(var(--sfs-success-rgb, 16 185 129) / 0.2); color: var(--sfs-success-text, #6ee7b7); }
.sltg-badge--warn { background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.2); color: var(--sfs-warning-text, #fcd34d); }
.sltg-badge--bad { background: rgb(var(--sfs-danger-rgb, 239 68 68) / 0.2); color: var(--sfs-danger-text, #fca5a5); }

.sltg-close {
  display: inline-flex;
  padding: 0.35rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.sltg-close:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08); }

.sltg-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem 1.25rem;
}

.sltg-section { margin-block-end: 1.1rem; }
.sltg-section h3 {
  margin: 0 0 0.45rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sfs-text-muted, #b7bdcc);
}

.sltg-detail {
  margin: 0;
  line-height: 1.55;
  unicode-bidi: plaintext;
  overflow-wrap: anywhere;
}

.sltg-done {
  margin: 0.5rem 0 0;
  padding: 0.5rem 0.7rem;
  border-inline-start: 3px solid var(--sfs-success-text, #6ee7b7);
  border-radius: 6px;
  background: rgb(var(--sfs-success-rgb, 16 185 129) / 0.1);
  line-height: 1.5;
  unicode-bidi: plaintext;
}
.sltg-section h3.sltg-subhead { margin-block-start: 0.8rem; }
.sltg-steps--own li { unicode-bidi: plaintext; }

.sltg-callout {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0 0 1rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--sfs-radius-md, 10px);
  line-height: 1.45;
}
.sltg-callout--good { background: rgb(var(--sfs-success-rgb, 16 185 129) / 0.14); color: var(--sfs-success-text, #6ee7b7); }
.sltg-callout--warn { background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.14); color: var(--sfs-warning-text, #fcd34d); }

.sltg-tools { display: flex; flex-wrap: wrap; gap: 0.4rem; }

.sltg-steps {
  margin: 0;
  padding-inline-start: 1.3rem;
  line-height: 1.55;
}
.sltg-steps li { margin-block-end: 0.45rem; }

.sltg-codes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-block-start: 0.3rem;
}

.sltg-code {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  padding: 0.15rem 0.2rem 0.15rem 0.5rem;
  border-radius: 6px;
  /* A command is dark in every galaxy, like the console it is typed into. */
  background: var(--sl-code-bg, #0f172a);
  color: var(--sl-code-ink, #e2e8f0);
  font-family: var(--sfs-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.82rem;
}
/* The global `code` rule colours inline code for the PAGE; on this chip that
   was dark ink on a dark ground in the light galaxies. */
.sltg-code code {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.sltg-copy {
  display: inline-flex;
  padding: 0.2rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.75;
}
.sltg-copy:hover { opacity: 1; background: rgb(255 255 255 / 0.12); }

.sltg-checks {
  margin: 0;
  padding-inline-start: 1.1rem;
  font-family: var(--sfs-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.8rem;
  color: var(--sfs-text-muted, #b7bdcc);
  overflow-wrap: anywhere;
}

.sltg-last {
  margin: 0.4rem 0 0;
  font-size: 0.82rem;
  color: var(--sfs-text-muted, #b7bdcc);
}

.sltg-list {
  margin: 0;
  padding-inline-start: 1.1rem;
  line-height: 1.5;
}
.sltg-list li { margin-block-end: 0.3rem; }

.sltg-hint {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  margin-block-start: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--sfs-radius-md, 10px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
}
.sltg-hint p { margin: 0; unicode-bidi: plaintext; }

.sltg-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.8rem 1.25rem;
  border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
}
</style>
