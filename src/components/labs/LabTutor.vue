<template>
  <div class="sl-tutor">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <Sparkles class="sl-i" />
        <span>{{ $t('AI Tutor') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                :disabled="busy" @click="review">
          <Stethoscope class="sl-i" /> {{ $t('Review my work') }}
        </button>
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                @click="turns = []">
          <Eraser class="sl-i" /> {{ $t('Clear') }}
        </button>
      </div>
    </div>

    <p class="sl-console__fidelity">
      {{ $t('It can see your environment and what you have run. Answers come from a language model and can be wrong.') }}
    </p>

    <div ref="scroller" class="sl-tutor__thread">
      <p v-if="turns.length === 0" class="sl-tutor__hello">
        {{ $t('Ask about this lab. Try: why does the container name not resolve?') }}
      </p>
      <div v-for="(turn, index) in turns" :key="index"
           class="sl-turn" :class="`sl-turn--${turn.role}`">
        <!--
          `RichText`, not `v-html`.

          This is text a language model wrote at the student's own instruction,
          rendered on a page that carries the session. `marked` passes raw HTML
          through by design and a model emits `<img src=x onerror=...>` in any
          ordinary answer about image tags - which is a Tuesday on a platform
          that teaches web development. `RichText` escapes before it inserts the
          anchors it builds itself, and `aichatMarkdown` is what turns the fenced
          blocks into typed blocks rather than markup.
        -->
        <template v-for="(block, position) in blocksOf(turn)" :key="position">
          <pre v-if="block.kind === 'code'" class="sl-turn__code" dir="ltr">{{ block.text }}</pre>
          <h4 v-else-if="block.kind === 'heading'" class="sl-turn__heading">{{ block.text }}</h4>
          <ul v-else-if="block.kind === 'list'" class="sl-turn__list">
            <li v-for="(item, at) in block.items" :key="at">
              <RichText :text="item" />
            </li>
          </ul>
          <ol v-else-if="block.kind === 'ordered'" class="sl-turn__list"
              :start="block.start">
            <li v-for="(item, at) in block.items" :key="at">
              <RichText :text="item" />
            </li>
          </ol>
          <blockquote v-else-if="block.kind === 'quote'" class="sl-turn__quote">
            <RichText :text="block.text" />
          </blockquote>
          <p v-else class="sl-turn__text"><RichText :text="block.text" /></p>
        </template>
      </div>
      <p v-if="busy" class="sl-tutor__busy">{{ $t('Thinking...') }}</p>
      <p v-if="error" class="sl-tutor__error">{{ error }}</p>
    </div>

    <form class="sl-tutor__form" @submit.prevent="send">
      <input
        v-model="question"
        class="sl-tutor__input"
        type="text"
        :disabled="busy"
        :placeholder="$t('Ask a question about this lab')"
      >
      <button type="submit" class="sl-btn sl-btn--primary sl-btn--sm"
              :disabled="busy || !question.trim()">
        <Send class="sl-i" /> {{ $t('Ask') }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
/**
 * The lab's AI tutor.
 *
 * Two things it does that a plain chat box would not:
 *
 * **It sends the ENVIRONMENT, not just the question.** `getContext` on the lab
 * service returns a text description of the containers, the pods, the buckets,
 * the HDFS files and the last twenty-five commands - so "why can't my container
 * reach the other one" gets an answer about the two networks they are actually
 * on. Without that the tutor is a search engine with extra steps.
 *
 * **It is told which tools are SIMULATED.** `tutorPrompt` names them and quotes
 * each one's fidelity line, because a model that does not know will suggest
 * `terraform import` and `docker stats --format` and the student will blame
 * themselves when it does not work.
 *
 * The context is fetched fresh on each question rather than cached: the whole
 * value is that it describes the environment as it is NOW, and a lab moves
 * several times a minute.
 */
import { nextTick, ref } from 'vue';
import { Eraser, Send, Sparkles, Stethoscope } from 'lucide-vue-next';
import RichText from '@/components/RichText.vue';
import { renderMarkdown } from '@/utils/aichatMarkdown';
import { labAiService, type TutorMessage } from '@/services/lab-ai.service';
import type { Lab, LabTask } from '@/utils/labCatalogue';

const props = defineProps<{
  lab: Lab | null;
  loadContext: () => Promise<string>;
}>();

const turns = ref<TutorMessage[]>([]);
const question = ref('');
const busy = ref(false);
const error = ref('');
const scroller = ref<HTMLElement | null>(null);

function blocksOf(turn: TutorMessage) {
  // The AI Chat's parser, not `marked`. Same module, same reason: it produces
  // typed BLOCKS rather than markup, so nothing a model wrote can reach
  // `v-html` - and it already has `npm run check:aichat` over the five ways an
  // unterminated fence or a `#` inside one can go wrong.
  return renderMarkdown(turn.content);
}

async function scrollDown() {
  await nextTick();
  const element = scroller.value;
  if (element) element.scrollTop = element.scrollHeight;
}

async function ask(text: string) {
  if (busy.value || !text.trim()) return;
  error.value = '';
  turns.value.push({ role: 'user', content: text });
  busy.value = true;
  await scrollDown();
  try {
    const context = await props.loadContext();
    const history = turns.value.slice(0, -1);
    const result = await labAiService.ask(text, props.lab, context, history);
    if (result.ok && result.text) {
      turns.value.push({ role: 'assistant', content: result.text });
    } else {
      error.value = result.error || 'The tutor could not answer.';
    }
  } finally {
    busy.value = false;
    await scrollDown();
  }
}

async function send() {
  const text = question.value.trim();
  question.value = '';
  await ask(text);
}

async function review() {
  if (busy.value) return;
  error.value = '';
  busy.value = true;
  await scrollDown();
  try {
    const context = await props.loadContext();
    const result = await labAiService.review(props.lab, context);
    turns.value.push({ role: 'user', content: 'Review my work on this lab.' });
    if (result.ok && result.text) {
      turns.value.push({ role: 'assistant', content: result.text });
    } else {
      error.value = result.error || 'The tutor could not answer.';
    }
  } finally {
    busy.value = false;
    await scrollDown();
  }
}

/** Called by the task list's "Ask the tutor" button. */
async function askAboutTask(task: LabTask) {
  await ask(`I am stuck on "${task.title}". ${task.detail || ''} `
    + 'Give me one nudge without doing it for me.');
}

defineExpose({ askAboutTask });
</script>
