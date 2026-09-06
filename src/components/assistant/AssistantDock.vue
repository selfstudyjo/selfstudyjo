<template>
  <!--
    TELEPORTED TO <body>.

    Half the page wrappers on this platform are positioned boxes with a
    `z-index`, which makes a stacking context — and a `position: fixed`
    descendant cannot escape its ancestor's, so the window would be painted at
    the wrapper's level and land under the sidebar. That is the fault the admin
    console's modals had on nine screens, and the guided tour teleports for the
    same reason.
  -->
  <Teleport to="body">
    <section
      ref="rootEl"
      class="sfs-bot"
      role="dialog"
      :aria-label="$t('Ask Noor, the site assistant')"
      :dir="dir"
    >
      <header class="sfs-bot__head">
        <div class="sfs-bot__stage">
          <!--
            The same renderer the Toastmasters meeting and the Job Interview
            room use — one WebGL canvas, one camera per tile, the person drawn
            underneath and every piece of text as ordinary DOM on top. Reusing
            it rather than writing a second one is why a fix to the cast lands
            in all three places at once.
          -->
          <PersonStage
            :seats="seats"
            :speaking="speaking ? ASSISTANT_FIGURE_ID : null"
            :energy="energy"
            tile-class="sfs-bot__tile"
          />
        </div>

        <p class="sfs-bot__plate">
          <span>{{ ASSISTANT_NAME }}</span>
          <span class="sfs-bot__state">· {{ $t(stateLabel) }}</span>
        </p>

        <button
          type="button" class="sfs-bot__close"
          :aria-label="$t('Close')" :title="$t('Close')"
          @click="close"
        ><X /></button>
      </header>

      <div ref="logEl" class="sfs-bot__log">
        <div
          v-for="message in messages" :key="message.id"
          class="sfs-bot__row"
          :class="message.role === 'user' ? 'sfs-bot__row--user' : ''"
        >
          <div>
            <!--
              `{{ }}`, never `v-html`.

              Two untrusted sources meet in this bubble: text a language model
              wrote, and text the reader dictated. This window is on every page
              of the platform including the ones holding a session, so a reply
              containing `<img src=x onerror=…>` — an ordinary thing for a model
              to produce when somebody asks about HTML on a platform that
              teaches web development — would be script execution. Working rule
              13, and `check:assistant` asserts it.
            -->
            <p
              class="sfs-bot__msg"
              :class="[
                message.role === 'user' ? 'sfs-bot__msg--user' : 'sfs-bot__msg--bot',
                message.failed ? 'sfs-bot__msg--error' : '',
              ]"
            >{{ message.content }}</p>

            <button
              v-if="message.action"
              type="button" class="sfs-bot__go"
              @click="go(message.action)"
            >
              <ArrowRight />
              <!--
                `$t` on the LABEL as well as on the sentence.

                A destination's label is an English catalogue KEY — the same one
                the sidebar renders through `$t(row.entry.text)` — so passing it
                straight into `{v0}` put "Open My Results" in the middle of an
                otherwise Arabic window. A record title (a course, a lab) is not
                a key, and `$t` answers an unknown key with itself, so those
                render unchanged. One call is right for both.
              -->
              <span>{{ $t('Open {v0}', { v0: $t(message.action.label) }) }}</span>
            </button>
          </div>
        </div>

        <div v-if="thinking" class="sfs-bot__row">
          <div class="sfs-bot__typing" :aria-label="$t('Noor is thinking')">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <div v-if="!messages.length || (!thinking && messages.length < 3)" class="sfs-bot__chips">
        <button
          v-for="chip in suggestions" :key="chip"
          type="button" class="sfs-bot__chip"
          @click="ask($t(chip))"
        >{{ $t(chip) }}</button>
      </div>

      <div class="sfs-bot__composer">
        <textarea
          ref="inputEl"
          v-model="draft"
          class="sfs-bot__input"
          rows="1"
          :placeholder="$t('Ask me anything about Self Study Jo…')"
          :aria-label="$t('Ask me anything about Self Study Jo…')"
          @keydown.enter.exact.prevent="ask(draft)"
        ></textarea>

        <button
          type="button"
          class="sfs-bot__act"
          :class="listening ? 'sfs-bot__act--live' : ''"
          :disabled="!micSupported"
          :aria-pressed="listening"
          :title="listening ? $t('Stop listening') : $t('Talk to Noor')"
          :aria-label="listening ? $t('Stop listening') : $t('Talk to Noor')"
          @click="toggleMic"
        ><component :is="listening ? MicOff : Mic" /></button>

        <button
          type="button"
          class="sfs-bot__act sfs-bot__act--send"
          :disabled="thinking || !draft.trim()"
          :title="$t('Send')" :aria-label="$t('Send')"
          @click="ask(draft)"
        ><Send /></button>
      </div>

      <div class="sfs-bot__foot">
        <button
          type="button" class="sfs-bot__toggle"
          :class="speakReplies ? 'is-on' : ''"
          :aria-pressed="speakReplies"
          @click="toggleVoice"
        >
          <component :is="speakReplies ? Volume2 : VolumeX" />
          <span>{{ $t(speakReplies ? VOICE_LABELS.on : VOICE_LABELS.off) }}</span>
        </button>

        <span v-if="voiceNote" class="sfs-bot__note">{{ voiceNote }}</span>
        <p v-if="warning" class="sfs-bot__warn">{{ warning }}</p>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Noor's window: a rendered person, a transcript, and a microphone.
 *
 * Everything she DECIDES is in `utils/assistantEngine.ts` and everything she
 * FETCHES is in `services/assistant.service.ts`. This file draws, records and
 * plays — the split is what lets `npm run check:assistant` drive the decisions
 * in node, which matters because most of them are invisible in a screenshot.
 *
 * ============================================================
 * THE LAYOUT OF THIS FILE IS LOAD-BEARING
 * ============================================================
 *
 * Declarations first, then the functions, then the calls. Not a style
 * preference: `speak()` in the Job Interview room closed over a `const`
 * declared four lines below it, which is a temporal dead zone — it threw
 * `ReferenceError` inside a deliberately empty `catch`, the promise never
 * settled, and the interview stopped dead after its first Arabic line. `vue-tsc`
 * was clean and the production build succeeded, because a TDZ is a runtime
 * fault and both of those are compile-time tools. `check:actors` now asserts
 * the layout for the two rooms; the same discipline applies here.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight, Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-vue-next';

import PersonStage, { type StageSeat } from '@/components/stage3d/PersonStage.vue';
import { useAssistant } from '@/composables/useAssistant';
import { useAuthStore } from '@/store/auth';
import { dir, localeId, t } from '@/i18n/runtime';
import { newsService } from '@/services/news.service';
import { assistantService, isServiceRefusal, type ChatTurn } from '@/services/assistant.service';
import { createSpeechAudio } from '@/utils/speechAudio';
import { spokenEnergy } from '@/stage3d/figures';
import {
    NO_SERVER, describe as describeSpeech, planSpeech, serverVoicesFor,
    type ServerVoices,
} from '@/utils/roomSpeech';
import type { VoiceLike } from '@/components/newscast/newscastEngine';
import {
    ASSISTANT_FIGURE_ID, ASSISTANT_NAME, EMPTY_CONTEXT, GREETING_SIGNED_IN,
    GREETING_SIGNED_OUT, MIC_FAILED, NO_ANSWER, REFUSAL, SERVICE_BUSY,
    SERVICE_UNREACHABLE, STATE_LABELS, SUGGESTIONS_SIGNED_IN, SUGGESTIONS_SIGNED_OUT,
    VOICE_LABELS,
    buildSystemPrompt, emptySnapshot, historyFor, looksLikeSolveRequest,
    newMessageId, parseReply, resolveAction, shouldAutoSend,
    type ActionContext, type AssistantMessage, type ResolvedAction,
    type StudentSnapshot,
} from '@/utils/assistantEngine';

/* ------------------------------ state ------------------------------ */

const { stop: closeAssistant } = useAssistant();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const rootEl = ref<HTMLElement | null>(null);
const logEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);

const messages = ref<AssistantMessage[]>([]);
const draft = ref('');
const thinking = ref(false);
const speaking = ref(false);
const energy = ref(0);
const listening = ref(false);
const speakReplies = ref(true);
const voiceNote = ref('');
const warning = ref('');

const snapshot = ref<StudentSnapshot>(emptySnapshot());
const actionContext = ref<ActionContext>(EMPTY_CONTEXT);
const serverVoices = ref<ServerVoices>(NO_SERVER);
const voices = ref<VoiceLike[]>([]);

/**
 * Web Audio, created once and primed inside a click.
 *
 * A context created outside a user gesture starts `suspended` and every clip on
 * it is silently ignored — no error, no event, an assistant that opens her
 * mouth in complete silence. Every room on this platform primes on the gesture
 * that starts the session; here that is the first press of the button, the mic
 * or a suggestion chip.
 */
const speech = createSpeechAudio();

const seats = computed<StageSeat[]>(() => [
    { key: ASSISTANT_FIGURE_ID, figure: ASSISTANT_FIGURE_ID, label: ASSISTANT_NAME },
]);

const suggestions = computed(() =>
    (authStore.isAuthenticated ? SUGGESTIONS_SIGNED_IN : SUGGESTIONS_SIGNED_OUT));

const stateLabel = computed(() => {
    if (thinking.value) return STATE_LABELS.thinking;
    if (speaking.value) return STATE_LABELS.speaking;
    if (listening.value) return STATE_LABELS.listening;
    return STATE_LABELS.idle;
});

const micSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined';

/* -------------------------- module plumbing ------------------------- */

let audioStream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let recordingLoop = false;
/** Bumped on every cancel, so a stale `onend` cannot start the next thing. */
let speechTurn = 0;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let energyTimer: ReturnType<typeof setInterval> | null = null;
let lastGrowthAt = 0;
let lastHeard = '';
let voicesProbed = false;

/* ------------------------------ helpers ----------------------------- */

function scrollDown() {
    void nextTick(() => {
        const el = logEl.value;
        if (el) el.scrollTop = el.scrollHeight;
    });
}

function push(role: 'user' | 'assistant', content: string,
              action: ResolvedAction | null = null, failed = false) {
    messages.value.push({
        id: newMessageId(), role, content, action, failed, at: Date.now(),
    });
    scrollDown();
}

function stopSpeaking() {
    speechTurn++;
    speaking.value = false;
    energy.value = 0;
    if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
    if (energyTimer) { clearInterval(energyTimer); energyTimer = null; }
    speech.stop();
    try { window.speechSynthesis?.cancel(); } catch { /* no engine here */ }
}

/**
 * Read the device's voice list.
 *
 * `getVoices()` is empty on its FIRST synchronous call in every browser — the
 * list arrives asynchronously and `voiceschanged` is what fills it in, and it
 * can fire more than once. Casting at mount without this gets a null and the
 * platform's default robotic voice.
 */
function loadVoices() {
    try {
        voices.value = (window.speechSynthesis?.getVoices() || []) as VoiceLike[];
    } catch {
        voices.value = [];
    }
}

/**
 * Ask app 36 what it can say in THIS language, once per language.
 *
 * Re-probed when the reader changes language, because the answer is per
 * language and a session that settled on "no server" for English would keep
 * that answer into Arabic and then ask `speechSynthesis` for a language the
 * machine cannot speak. That is exactly the bug the Job Interview room had: it
 * probed at setup and never again, while the meeting had watched the locale
 * since it was written, so the two behaved differently in the same language on
 * the same machine.
 */
async function probeVoices() {
    loadVoices();
    try {
        serverVoices.value = serverVoicesFor(
            await newsService.speechCapabilities(), localeId.value);
    } catch {
        serverVoices.value = NO_SERVER;
    }
    voicesProbed = true;
}

/**
 * Say one line, and move the mouth while it is being said.
 *
 * The route is `roomSpeech.planSpeech`'s: a device voice in the right language,
 * else app 36's server voice, else `speechSynthesis` with `lang` set and NO
 * voice assigned. A wrong-LANGUAGE device voice is never used at any step —
 * that is not accented speech, it is noise, and the listener cannot tell
 * whether the feature or their own comprehension is at fault.
 *
 * Never rejects. Every caller is a turn that has already been rendered, and a
 * rejection would leave the window in `speaking` for ever.
 */
async function say(text: string): Promise<void> {
    if (!speakReplies.value || !text.trim()) return;
    if (!voicesProbed) await probeVoices();

    const turn = ++speechTurn;
    const locale = localeId.value;
    const plan = planSpeech(voices.value, locale, 'female', 0,
                            serverVoices.value, speech.capable);
    voiceNote.value = describeSpeech(plan, locale);
    speaking.value = true;

    // ---- the server route: a real waveform, so the mouth is exact ----
    if (plan.route === 'server') {
        try {
            const clip = await newsService.speech(
                text, locale as 'ar' | 'en' | 'zh', 'female', 1, '', plan.allowAnyVoice);
            if (turn !== speechTurn) return;
            voiceNote.value = describeSpeech(plan, locale, clip.voice);
            energyTimer = setInterval(() => { energy.value = speech.energy(); }, 40);
            await speech.play(clip.url);
        } catch {
            /* fall through to the device engine rather than going silent */
        } finally {
            if (energyTimer) { clearInterval(energyTimer); energyTimer = null; }
        }
        if (turn === speechTurn) { speaking.value = false; energy.value = 0; }
        return;
    }

    // ---- the device / platform route: no audio to measure ----
    //
    // `speechSynthesis` exposes NO audio whatsoever — no node, no buffer, no
    // level — so an analyser would report a steady zero and `jawOpen` returns
    // exactly 0 at zero energy, which is a figure that breathes and blinks and
    // never speaks. `onboundary` fires as the engine crosses each word on most
    // browsers, which is genuine word-level movement; where it never fires the
    // syllable model in `figures.ts` carries it from a nominal level.
    await new Promise<void>(resolve => {
        // EVERY binding this closure reads is declared before the closure is.
        // See the file header: the same shape one line out of order took the
        // interview room down.
        let settled = false;
        let boundaryAt = performance.now();
        const finish = () => {
            if (settled || turn !== speechTurn) { resolve(); return; }
            settled = true;
            if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
            if (energyTimer) { clearInterval(energyTimer); energyTimer = null; }
            speaking.value = false;
            energy.value = 0;
            resolve();
        };

        let utterance: SpeechSynthesisUtterance;
        try {
            utterance = new SpeechSynthesisUtterance(text);
        } catch {
            finish();
            return;
        }
        utterance.lang = plan.lang;
        utterance.pitch = plan.pitch;
        // Left UNSET on the platform route deliberately: an explicitly assigned
        // `utterance.voice` OVERRIDES `utterance.lang`, so leaving it null is
        // what lets the platform match on the language itself and often reach
        // an OS voice `getVoices()` never listed.
        if (plan.voice) utterance.voice = plan.voice as unknown as SpeechSynthesisVoice;
        utterance.onboundary = () => { boundaryAt = performance.now(); };
        utterance.onend = finish;
        utterance.onerror = finish;

        energyTimer = setInterval(() => {
            energy.value = spokenEnergy((performance.now() - boundaryAt) / 1000);
        }, 40);

        // Chrome stops speaking after ~15 seconds and `onend` frequently never
        // arrives, so a long answer is cut off AND the window sits in
        // `speaking` for ever. The pause/resume pair is the documented
        // workaround; the watchdog is sized to the text because "should" is not
        // a guarantee and the cost of being wrong is a stuck window.
        keepAlive = setInterval(() => {
            try {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
            } catch { /* engine gone */ }
        }, 9000);
        const watchdog = setTimeout(finish, 4000 + text.length * 90);

        try {
            window.speechSynthesis.speak(utterance);
        } catch {
            clearTimeout(watchdog);
            finish();
        }
    });
}

/* ------------------------------ asking ------------------------------ */

/**
 * Make sure the reader's record is in hand.
 *
 * Started when the window OPENS and awaited here, so by the time somebody has
 * typed a question it is usually already there. Awaited rather than guessed at
 * with a "does this look like a data question" heuristic: an exact answer is
 * the whole point, and a heuristic that guesses wrong answers "you have no
 * certificates" from an empty snapshot.
 */
async function ensureContext() {
    const user = authStore.user;
    const userId = String(user?.id || '');
    const username = String(user?.username || '');
    const [record, courses, labs, runbooks] = await Promise.all([
        assistantService.snapshot(userId, username,
                                  String(user?.full_name || user?.name || '')),
        assistantService.courses(),
        assistantService.labs(),
        assistantService.runbooks(),
    ]);
    snapshot.value = record;
    actionContext.value = {
        access: {
            auth: authStore.isAuthenticated,
            ai: authStore.hasAiAccess,
            lab: authStore.hasLabAccess,
            runbook: authStore.hasRunbookAccess,
            research: authStore.hasResearchFlowAccess,
            toastmasters: authStore.hasToastmastersAccess,
            exam: authStore.hasExamFeature,
            proctor: authStore.isProctor,
        },
        courses, labs, runbooks,
        // Lessons are not preloaded: 270 of them is a catalogue nobody is
        // asking about by name, and `open_course` lands on the page that lists
        // them. `resolveAction` handles `open_lesson` for the day one is.
        lessons: [],
    };
}

async function ask(text: string) {
    const question = (text || '').trim();
    if (!question || thinking.value) return;

    speech.prime();
    stopSpeaking();
    draft.value = '';
    push('user', question);

    // Refused before a provider is spent. The commonest phrasings never reach
    // a model at all, which is faster AND cheaper than being told no by one.
    if (looksLikeSolveRequest(question)) {
        push('assistant', t(REFUSAL));
        void say(t(REFUSAL));
        return;
    }

    thinking.value = true;
    warning.value = '';
    try {
        await ensureContext();
        const turns: ChatTurn[] = [
            {
                role: 'system',
                content: buildSystemPrompt({
                    snapshot: snapshot.value,
                    access: actionContext.value.access,
                    currentPath: route.path,
                    courses: actionContext.value.courses,
                    labs: actionContext.value.labs,
                    runbooks: actionContext.value.runbooks,
                }),
            },
            ...historyFor(messages.value).map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            })),
        ];

        const raw = await assistantService.ask(turns);
        const reply = parseReply(raw);
        const action = resolveAction(reply.action, actionContext.value);

        if (!reply.say) {
            // A reply with nothing in it is a provider that answered and said
            // nothing, which is a different failure from one that refused —
            // and an empty bubble reads as the window being broken.
            push('assistant', t(NO_ANSWER), null, true);
            return;
        }
        push('assistant', reply.say, action);
        void say(reply.say);
    } catch (error) {
        const message = isServiceRefusal(error) ? t(SERVICE_BUSY) : t(SERVICE_UNREACHABLE);
        push('assistant', message, null, true);
    } finally {
        thinking.value = false;
        scrollDown();
    }
}

function go(action: ResolvedAction | null | undefined) {
    if (!action) return;
    // The window stays OPEN across the navigation. She is a guide: taking
    // somebody somewhere and then vanishing means the obvious follow-up ("and
    // where do I click now?") costs another two clicks to ask.
    stopSpeaking();
    void router.push(action.to);
}

/* ---------------------------- the microphone ------------------------ */

function preferredMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4',
                   'audio/ogg;codecs=opus', 'audio/ogg'];
    for (const type of types) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return '';
}

function recordChunk(ms: number): Promise<void> {
    return new Promise<void>(resolve => {
        const tracks = audioStream?.getAudioTracks() || [];
        if (!tracks.length) { resolve(); return; }
        // A NEW MediaStream over the same tracks. Naming a `const` after the
        // module-level `audioStream` here would put every read of it above in
        // that constant's temporal dead zone — the fault that left the
        // interview's transcript box on "Listening…" for ever.
        const chunkStream = new MediaStream(tracks);
        const mimeType = preferredMimeType();
        let active: MediaRecorder;
        try {
            active = mimeType
                ? new MediaRecorder(chunkStream, { mimeType, audioBitsPerSecond: 64000 })
                : new MediaRecorder(chunkStream);
        } catch { resolve(); return; }

        const parts: Blob[] = [];
        let stopTimer: ReturnType<typeof setTimeout> | null = null;
        active.ondataavailable = event => {
            if (event.data && event.data.size > 0) parts.push(event.data);
        };
        active.onstop = () => {
            if (stopTimer) clearTimeout(stopTimer);
            if (parts.length) {
                void heard(new Blob(parts, { type: active.mimeType || 'audio/webm' }));
            }
            recorder = null;
            resolve();
        };
        recorder = active;
        try { active.start(); } catch { resolve(); return; }
        stopTimer = setTimeout(() => {
            if (active.state === 'recording') { try { active.stop(); } catch { /* gone */ } }
        }, ms);
    });
}

async function heard(blob: Blob) {
    const text = await assistantService.transcribe(blob);
    if (!text || !listening.value) return;
    // Appended to the box rather than replacing it, so anything typed by hand
    // survives — and so the reader can correct a false start before it is sent,
    // which is what Whisper transcribing a restart faithfully makes necessary.
    draft.value = draft.value ? `${draft.value} ${text}` : text;
    lastGrowthAt = Date.now();
    lastHeard = draft.value;
}

/**
 * Record until the reader stops talking, then send.
 *
 * `try/finally` around the loop, because `recordingLoop` is a latch: without
 * it one thrown chunk leaves it true for the rest of the session and the guard
 * at the top silently refuses every later attempt. That is what turned a single
 * `ReferenceError` in the interview room into "the transcript never appears
 * again".
 */
async function listen() {
    if (recordingLoop) return;
    recordingLoop = true;
    lastGrowthAt = Date.now();
    lastHeard = draft.value;
    try {
        while (listening.value) {
            await recordChunk(2500);
            if (!listening.value) break;
            if (draft.value !== lastHeard) { lastGrowthAt = Date.now(); lastHeard = draft.value; }
            // Hands-free: a pause long enough to be the end of a question sends
            // it. The threshold is in the engine, where it can be checked —
            // too short cuts somebody off mid-sentence and too long reads as
            // "she is not listening".
            if (!thinking.value && shouldAutoSend(draft.value, Date.now() - lastGrowthAt)) {
                const question = draft.value;
                draft.value = '';
                lastHeard = '';
                await ask(question);
                lastGrowthAt = Date.now();
            }
        }
    } finally {
        recordingLoop = false;
    }
}

async function startMic() {
    warning.value = '';
    speech.prime();
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
        // Deliberately not "permission denied": `getUserMedia` has at least six
        // distinct failures and only one of them is a refusal, and telling
        // somebody whose microphone is held by another application to grant a
        // permission they already granted sends them to the one place that
        // cannot help. `mediaDevices.ts` makes the same point at length.
        warning.value = t(MIC_FAILED);
        listening.value = false;
        return;
    }
    listening.value = true;
    void listen();
}

function stopMic() {
    listening.value = false;
    try { recorder?.stop(); } catch { /* already stopped */ }
    recorder = null;
    audioStream?.getTracks().forEach(track => { try { track.stop(); } catch { /* gone */ } });
    audioStream = null;
}

function toggleMic() {
    if (listening.value) {
        stopMic();
        // Send whatever they had said when they switched it off. Somebody who
        // stops the microphone mid-question has finished the question.
        if (draft.value.trim()) void ask(draft.value);
        return;
    }
    void startMic();
}

function toggleVoice() {
    speakReplies.value = !speakReplies.value;
    if (!speakReplies.value) stopSpeaking();
    else speech.prime();
}

function close() {
    stopMic();
    stopSpeaking();
    closeAssistant();
}

function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
}

/* ------------------------------- wiring ------------------------------ */

/*
  MOUNTING IS OPENING.

  `DefaultLayout` renders this behind `v-if="assistantOpen"` and a
  `defineAsyncComponent`, so the component does not exist until somebody presses
  the button and stops existing when they close her. That is why the greeting is
  pushed here rather than from a `watch(open)`: the watcher would never fire for
  the FIRST open, because `open` was already true before this component existed.
*/
onMounted(() => {
    window.addEventListener('keydown', onKey);
    speech.prime();
    const name = String(authStore.user?.full_name || authStore.user?.username || '');
    push('assistant', authStore.isAuthenticated
        ? t(GREETING_SIGNED_IN, { name })
        : t(GREETING_SIGNED_OUT));
    void nextTick(() => inputEl.value?.focus());
    // Kicked off here and awaited in `ask`, so opening the window costs nothing
    // and the record is usually in hand by the time a question is typed.
    void ensureContext();
    void probeVoices();
});

// The device's voice list arrives asynchronously and the event can fire more
// than once.
if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
}

// A language change re-probes: what app 36 can say is per language, and an
// answer cached from English is what leaves an Arabic reader in silence.
watch(localeId, () => {
    voicesProbed = false;
    stopSpeaking();
    void probeVoices();
});

// Signing out must not leave her holding the previous person's results.
watch(() => authStore.user?.id, () => {
    assistantService.reset();
    snapshot.value = emptySnapshot();
    actionContext.value = EMPTY_CONTEXT;
    messages.value = [];
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    stopMic();
    stopSpeaking();
    // `speechSynthesis` belongs to the WINDOW, not to this component: without
    // this she keeps reading over whatever page the reader opens next.
    speech.dispose();
});
</script>
