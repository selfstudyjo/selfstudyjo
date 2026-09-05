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
      <!--
        A TEXTAREA, not an input, and it has a ref.

        "Ask the tutor" fills this in, and a filled-in question is two or three
        lines long - in a single-line input a student sees the last six words of
        a sentence they are being asked to check, which is worse than not
        showing it at all. Enter still sends and Shift+Enter still adds a line,
        so nothing about typing a short question changed.
      -->
      <textarea
        ref="box"
        v-model="question"
        class="sl-tutor__input"
        rows="1"
        :disabled="busy"
        :placeholder="$t('Ask a question about this lab')"
        @keydown.enter.exact.prevent="send"
      ></textarea>
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
import { nextTick, ref, watch } from 'vue';
import { Eraser, Send, Sparkles, Stethoscope } from 'lucide-vue-next';
import RichText from '@/components/RichText.vue';
import { renderMarkdown } from '@/utils/aichatMarkdown';
import { labAiService, type TutorMessage } from '@/services/lab-ai.service';
import type { Lab } from '@/utils/labCatalogue';

const props = defineProps<{
  lab: Lab | null;
  loadContext: () => Promise<string>;
}>();

/**
 * Emitted once per ASK that actually reached the provider.
 *
 * The workspace charges for asks past the free allowance, so this has to fire
 * for exactly the asks that happened: not on a click that was refused because
 * the tutor was already busy, not on an empty box, and not on a request that
 * failed - the student did not get an answer, so charging them for one would
 * be charging for the provider being down.
 *
 * It fires BEFORE the answer arrives rather than after, because the ask is what
 * is being counted and a student who navigates away mid-answer still asked.
 */
const emit = defineEmits<{ (event: 'asked'): void }>();

const turns = ref<TutorMessage[]>([]);
const question = ref('');
const busy = ref(false);
const error = ref('');
const scroller = ref<HTMLElement | null>(null);
const box = ref<HTMLTextAreaElement | null>(null);

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
  // After the guards, so a refused click and an empty box cost nothing.
  emit('asked');
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
  /*
    A REVIEW COUNTS AS AN ASK, and it should.

    It is a model call over the whole environment - the most expensive thing
    this pane can do and the one most likely to hand a student the answer.
    Leaving it free would make the allowance meaningless: three asks and then
    Review my work as many times as you like.
  */
  emit('asked');
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

/**
 * Called by the task list's "Ask the tutor" button: FILL the box, do not send.
 *
 * It used to send a sentence built at the call site, which is wrong twice over.
 * A student got an answer to a question they had never read - so they could not
 * tell whether the tutor had misunderstood them or they had misunderstood the
 * task - and there was no way to add "I have already tried X", which is the
 * single most useful thing anybody can put in front of a model here.
 *
 * Filling it costs one keypress and buys the student the chance to correct it,
 * which is usually all the nudge they needed. The sentence is built by
 * `taskQuestion` in `labCatalogue.ts` so `npm run check:labs` can drive it.
 */
function fillQuestion(text: string) {
  question.value = String(text || '');
  nextTick(() => {
    const element = box.value;
    if (!element) return;
    element.focus();
    // The caret at the END, not selecting the whole thing: a student who wants
    // to add a sentence should be able to type, and a full selection means the
    // first character they press deletes the question.
    element.setSelectionRange(question.value.length, question.value.length);
    autoGrow();
  });
}

/** A textarea does not grow on its own, and a clipped question is unreadable. */
function autoGrow() {
  const element = box.value;
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
}

watch(question, () => nextTick(autoGrow));

defineExpose({ fillQuestion });
</script>
