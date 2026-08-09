<template>
  <div class="composer">
    <!-- ------------------------------------------------------- replying -->
    <div v-if="replyTo" class="strip">
      <span class="strip-rail" aria-hidden="true"></span>
      <div class="strip-body">
        <span class="strip-who">Replying to {{ replyTo.sender_username || 'someone' }}</span>
        <span class="strip-text">{{ replyPreview }}</span>
      </div>
      <button type="button" class="uc-icon-btn small" aria-label="Cancel reply" @click="$emit('cancel-reply')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <!-- A picture waiting to be sent, with its caption. Shown *before* the upload
         finishes so the caption can be typed while the bytes are still going up —
         which is most of the reason upload and send are two requests. -->
    <div v-if="pending" class="strip">
      <img v-if="pendingPreview" :src="pendingPreview" alt="" class="thumb" />
      <div v-else class="thumb audio-thumb">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11z"/></svg>
      </div>
      <div class="strip-body">
        <span class="strip-who">{{ pending.name }}</span>
        <span class="strip-text">
          <template v-if="pending.state === 'uploading'">Uploading…</template>
          <span v-else-if="pending.state === 'error'" class="err">{{ pending.error }}</span>
          <template v-else>
            {{ humanSize(pending.storedBytes) }}
            <span v-if="pending.savedPercent > 4" class="saved">· {{ pending.savedPercent }}% smaller</span>
          </template>
        </span>
      </div>
      <button type="button" class="uc-icon-btn small" aria-label="Discard attachment" @click="$emit('discard')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <!-- ------------------------------------------------------ recording -->
    <div v-if="recording" class="recording">
      <span class="rec-dot" aria-hidden="true"></span>
      <span class="rec-time">{{ formatDuration(recordElapsed) }}</span>
      <div class="rec-level"><span :style="{ transform: `scaleX(${recordLevel})` }"></span></div>
      <button type="button" class="rec-cancel" @click="cancelRecording">Cancel</button>
      <button type="button" class="rec-stop" @click="finishRecording">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4z"/></svg>
        Send
      </button>
    </div>

    <!-- ---------------------------------------------------------- input -->
    <form v-else class="bar" @submit.prevent="submit">
      <input ref="fileInput" type="file" accept="image/*" class="uc-sr-only" @change="onPick" />

      <div class="lead">
        <button
          ref="emojiToggle"
          type="button"
          class="uc-icon-btn"
          :class="{ on: showEmoji }"
          aria-label="Insert an emoji"
          :aria-expanded="showEmoji"
          :disabled="busy"
          @click="toggleEmoji"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 007 0"/></svg>
        </button>

        <button
          type="button"
          class="uc-icon-btn"
          aria-label="Attach a picture"
          :disabled="busy"
          @click="fileInput?.click()"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a2 2 0 01-2.82-2.83l8.49-8.48"/></svg>
        </button>
      </div>

      <textarea
        ref="input"
        v-model="draft"
        class="input"
        :placeholder="placeholder"
        rows="1"
        :disabled="busy"
        @input="onInput"
        @keydown="onKeydown"
      ></textarea>

      <button
        v-if="!draft.trim() && !pending"
        type="button"
        class="uc-icon-btn mic"
        aria-label="Record a voice note"
        :disabled="busy"
        @click="beginRecording"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11z"/></svg>
      </button>
      <button
        v-else
        type="submit"
        class="send"
        aria-label="Send message"
        :disabled="busy || (!draft.trim() && !canSendAttachment)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>

      <!-- ------------------------------------------------ emoji picker -->
      <!--
        A fixed set rather than a picker library: this is a study platform's
        message box, not a keyboard, and the ~90 below cover what people
        actually send. It costs no dependency, no font download and no
        emoji-data bundle, and it inserts at the caret rather than appending —
        which matters the moment somebody wants one in the middle of a
        sentence.
      -->
      <div v-if="showEmoji" ref="emojiPanel" class="emoji" role="dialog" aria-label="Emoji">
        <button
          v-for="glyph in EMOJI"
          :key="glyph"
          type="button"
          class="emoji-btn"
          :aria-label="`Insert ${glyph}`"
          @click="insertEmoji(glyph)"
        >{{ glyph }}</button>
      </div>
    </form>

    <p v-if="error" class="uc-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import { formatDuration, humanSize, prepareImage, startRecording,
         MAX_RECORDING_SECONDS } from './chatMedia';
import type { ChatMessage } from '@/services/userchat.service';

export interface PendingAttachment {
  name: string;
  state: 'uploading' | 'ready' | 'error';
  attachmentId?: string;
  kind: 'image' | 'audio';
  storedBytes: number;
  savedPercent: number;
  error?: string;
  durationMs?: number;
}

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
  replyTo?: ChatMessage | null;
  pending?: PendingAttachment | null;
  pendingPreview?: string;
}>();

const emit = defineEmits<{
  (e: 'send', payload: { text: string }): void;
  (e: 'upload', payload: { blob: Blob; name: string; kind: 'image' | 'audio';
                           originalBytes: number; durationMs?: number;
                           previewUrl?: string }): void;
  (e: 'typing', value: boolean): void;
  (e: 'cancel-reply'): void;
  (e: 'discard'): void;
}>();

const draft = ref('');
const error = ref('');
const input = ref<HTMLTextAreaElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const busy = computed(() => props.disabled || props.pending?.state === 'uploading');
const canSendAttachment = computed(() => props.pending?.state === 'ready');
const placeholder = computed(() => props.placeholder || 'Write a message…');

const replyPreview = computed(() => {
  const parent = props.replyTo;
  if (!parent) return '';
  if (parent.kind === 'image') return parent.text || 'Picture';
  if (parent.kind === 'audio') return parent.text || 'Voice note';
  return (parent.text || '').slice(0, 80);
});

// ---------------------------------------------------------------- typing

let typingTimer: number | null = null;
let typingOn = false;

/** Tell the room somebody is typing, and stop telling it when they stop.
 *
 *  Rate-limited to one "on" signal and one "off" after a pause, rather than a
 *  message per keystroke: the poll carries the flag anyway, so keystroke-level
 *  granularity would only add requests. */
function onInput() {
  autosize();
  if (!typingOn) {
    typingOn = true;
    emit('typing', true);
  }
  if (typingTimer) window.clearTimeout(typingTimer);
  typingTimer = window.setTimeout(() => {
    typingOn = false;
    emit('typing', false);
  }, 2500);
}

function stopTyping() {
  if (typingTimer) window.clearTimeout(typingTimer);
  typingTimer = null;
  if (typingOn) {
    typingOn = false;
    emit('typing', false);
  }
}

function autosize() {
  const element = input.value;
  if (!element) return;
  element.style.height = 'auto';
  // Bounded, or a pasted essay pushes the whole conversation off the screen.
  element.style.height = `${Math.min(element.scrollHeight, 150)}px`;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showEmoji.value) {
    closeEmoji();
    return;
  }
  // Enter sends, Shift+Enter is a newline. The IME check matters for Arabic and
  // for any language typed through a composition step: Enter during composition
  // is "accept this candidate", and sending on it would cut the word in half.
  if (event.key === 'Enter' && !event.shiftKey && !(event as any).isComposing) {
    event.preventDefault();
    submit();
  }
}

function submit() {
  const text = draft.value.trim();
  if (!text && !canSendAttachment.value) return;
  emit('send', { text });
  draft.value = '';
  error.value = '';
  closeEmoji();
  stopTyping();
  nextTick(autosize);
}

// ----------------------------------------------------------------- emoji

const EMOJI = [
  '😀', '😃', '😄', '😁', '😊', '🙂', '😉', '😍', '🥰', '😘',
  '😎', '🤩', '🥳', '🤔', '🤨', '😐', '🙄', '😴', '😪', '😷',
  '🤒', '😢', '😭', '😤', '😠', '😅', '😂', '🤣', '😇', '🤗',
  '🤯', '😱', '😳', '🥺', '😬', '🙃', '😜', '🤪', '😋', '🤐',
  '👍', '👎', '👌', '🙏', '👏', '🙌', '🤝', '✌️', '🤞', '💪',
  '👋', '🫡', '🤷', '🤦', '💯', '🔥', '✨', '⭐', '🎉', '🎊',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💡', '✅',
  '❌', '⚠️', '❓', '❗', '📌', '📎', '📷', '🎤', '📚', '📝',
  '🧠', '💻', '⏰', '📅', '☕', '🍕', '🚀', '🏆', '🎯', '👀',
];

const showEmoji = ref(false);
const emojiPanel = ref<HTMLElement | null>(null);
const emojiToggle = ref<HTMLElement | null>(null);

function toggleEmoji() {
  showEmoji.value ? closeEmoji() : openEmoji();
}

function openEmoji() {
  showEmoji.value = true;
  // Registered on the next task, or the click that opened the panel is the same
  // click that closes it again.
  window.setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
}

function closeEmoji() {
  if (!showEmoji.value) return;
  showEmoji.value = false;
  document.removeEventListener('pointerdown', onOutside);
}

/**
 * Close on a click anywhere else — but *not* on the toggle button.
 *
 * `pointerdown` runs before `click`, so without the second test pressing the
 * emoji button while the panel is open closes it here and then immediately
 * reopens it in `toggleEmoji`, and the button appears to do nothing.
 */
function onOutside(event: PointerEvent) {
  const target = event.target as Node;
  if (emojiPanel.value?.contains(target)) return;
  if (emojiToggle.value?.contains(target)) return;
  closeEmoji();
}

/** Insert at the caret, not at the end — and put the caret after what was
 *  inserted, so somebody adding three in a row does not have to re-click. */
function insertEmoji(glyph: string) {
  const element = input.value;
  if (!element) {
    draft.value += glyph;
    return;
  }
  const start = element.selectionStart ?? draft.value.length;
  const end = element.selectionEnd ?? start;
  draft.value = draft.value.slice(0, start) + glyph + draft.value.slice(end);
  nextTick(() => {
    element.focus();
    const caret = start + glyph.length;
    element.setSelectionRange(caret, caret);
    autosize();
  });
}

// -------------------------------------------------------------- pictures

async function onPick(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';                 // so picking the same file twice still fires
  if (!file) return;

  error.value = '';
  try {
    // Compressed here first. The backend compresses again, but this is what stops
    // a 4 MB phone photo crossing the network at all — see chatMedia.ts.
    const prepared = await prepareImage(file);
    emit('upload', {
      blob: prepared.blob,
      name: file.name || 'picture.jpg',
      kind: 'image',
      originalBytes: prepared.originalBytes,
      previewUrl: URL.createObjectURL(prepared.blob),
    });
  } catch (failure: any) {
    error.value = failure?.message || 'That picture could not be read.';
  }
}

// ----------------------------------------------------------------- voice

const recording = ref(false);
const recordElapsed = ref(0);
const recordLevel = ref(0);
let handle: Awaited<ReturnType<typeof startRecording>> | null = null;
let tick: number | null = null;

async function beginRecording() {
  error.value = '';
  closeEmoji();
  try {
    handle = await startRecording(value => { recordLevel.value = value; });
  } catch (failure: any) {
    error.value = failure?.name === 'NotAllowedError'
      ? 'Microphone access was refused. Allow it in your browser to send a voice note.'
      : (failure?.message || 'This browser cannot record audio.');
    return;
  }
  recording.value = true;
  recordElapsed.value = 0;
  tick = window.setInterval(() => {
    recordElapsed.value = Date.now() - (handle?.startedAt || Date.now());
    // Stop at the backend's own limit rather than letting somebody record for ten
    // minutes and then be told it was refused.
    if (recordElapsed.value > MAX_RECORDING_SECONDS * 1000) finishRecording();
  }, 200);
}

function clearRecorder() {
  if (tick) window.clearInterval(tick);
  tick = null;
  recording.value = false;
  recordLevel.value = 0;
  handle = null;
}

/** Throw the recording away and release the microphone. */
function cancelRecording() {
  handle?.cancel();
  clearRecorder();
}

async function finishRecording() {
  if (!handle) return;
  const current = handle;
  handle = null;
  if (tick) window.clearInterval(tick);
  tick = null;
  try {
    const result = await current.stop();
    emit('upload', {
      blob: result.blob,
      name: 'voice-note',
      kind: 'audio',
      originalBytes: result.blob.size,
      durationMs: result.durationMs,
    });
  } catch (failure: any) {
    error.value = failure?.message || 'Nothing was recorded.';
  } finally {
    clearRecorder();
  }
}

onBeforeUnmount(() => {
  stopTyping();
  handle?.cancel();
  document.removeEventListener('pointerdown', onOutside);
  if (tick) window.clearInterval(tick);
});

defineExpose({ focus: () => input.value?.focus() });
</script>

<style scoped>
.composer {
  flex: 0 0 auto;
  padding: 10px clamp(12px, 2vw, 28px);
  /* Clears the home indicator on an iPhone and the gesture bar on Android. On
     everything else `env()` is 0 and this is the plain 10px. */
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  background: rgb(var(--sfs-surface-rgb, 10 12 30) / 0.62);
  backdrop-filter: var(--uc-blur-strong);
  -webkit-backdrop-filter: var(--uc-blur-strong);
  border-top: 1px solid var(--uc-border);
}

/* Matches the transcript's own measure, so the send button lines up with the
   right edge of the bubbles rather than with the edge of the window. */
.composer > * { max-width: 1080px; margin-left: auto; margin-right: auto; }

.uc-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

/* ------------------------------------------------- reply / attachment */
.strip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 7px 9px;
  border-radius: var(--uc-r-sm);
  background: var(--uc-surface);
  border: 1px solid var(--uc-border);
  overflow: hidden;
}
.strip-rail {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--uc-brand-grad);
}
.strip-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.strip-who { font-size: var(--uc-fs-xs); font-weight: 700; color: var(--uc-brand-soft); }
.strip-text {
  font-size: var(--uc-fs-sm);
  color: var(--uc-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.saved { color: var(--uc-success); font-weight: 600; }
.err { color: var(--uc-danger); }

.thumb { width: 40px; height: 40px; border-radius: var(--uc-r-xs); object-fit: cover; flex: 0 0 40px; }
.audio-thumb {
  display: grid;
  place-items: center;
  background: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.2);
  color: var(--sfs-text-muted, #c7d2fe);
}

/* ---------------------------------------------------------- input bar */
.bar {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 5px 6px;
  border: 1px solid var(--uc-border-strong);
  border-radius: var(--uc-r-xl);
  background: var(--uc-surface);
  transition: border-color var(--uc-t-fast), box-shadow var(--uc-t-fast), background var(--uc-t-fast);
}
.bar:focus-within {
  background: var(--uc-surface-2);
  border-color: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.5);
  box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16);
}

.lead { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; }

.input {
  flex: 1;
  min-width: 0;
  resize: none;
  border: 0;
  background: transparent;
  padding: 8px 4px;
  font: inherit;
  font-size: var(--uc-fs-md);
  line-height: 1.5;
  color: var(--uc-text);
  max-height: 150px;
  outline: none;
}
.input::placeholder { color: var(--uc-text-dim); }
.input:disabled { opacity: 0.6; }

.mic { align-self: flex-end; }

.send {
  flex: 0 0 38px;
  align-self: flex-end;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 50%;
  background: var(--uc-brand-grad);
  color: var(--sfs-text, #fff);
  cursor: pointer;
  box-shadow: 0 4px 14px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.4);
  transition: transform var(--uc-t-fast), box-shadow var(--uc-t-fast), opacity var(--uc-t-fast);
}
.send svg { transform: translateX(-1px); }
.send:hover:not(:disabled) { transform: scale(1.06); box-shadow: 0 8px 22px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.55); }
.send:active:not(:disabled) { transform: scale(0.95); }
.send:disabled { opacity: 0.4; box-shadow: none; cursor: not-allowed; }

/* --------------------------------------------------------------- emoji */
.emoji {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 30;
  width: min(320px, calc(100vw - 32px));
  max-height: 232px;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
  gap: 2px;
  border: 1px solid var(--uc-border-strong);
  border-radius: var(--uc-r-md);
  background: rgb(var(--sfs-surface-rgb, 14 16 38) / 0.97);
  backdrop-filter: var(--uc-blur-strong);
  -webkit-backdrop-filter: var(--uc-blur-strong);
  box-shadow: var(--uc-shadow-lg);
  scrollbar-width: thin;
}
.emoji-btn {
  display: grid;
  place-items: center;
  height: 34px;
  border: 0;
  border-radius: var(--uc-r-xs);
  background: none;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  transition: background var(--uc-t-fast), transform var(--uc-t-fast);
}
.emoji-btn:hover { background: var(--uc-surface-3); transform: scale(1.12); }

/* ----------------------------------------------------------- recording */
.recording {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 12px;
  border-radius: var(--uc-r-xl);
  background: var(--uc-danger-bg);
  border: 1px solid var(--uc-danger-border);
}
.rec-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--uc-danger);
  animation: pulse 1.1s ease-in-out infinite;
  flex: 0 0 auto;
}
@keyframes pulse { 50% { opacity: 0.25; } }
.rec-time {
  font-size: var(--uc-fs-sm);
  font-weight: 700;
  color: var(--uc-danger);
  font-variant-numeric: tabular-nums;
}
.rec-level { flex: 1; height: 5px; border-radius: 3px; background: rgb(var(--sfs-danger-rgb, 252 129 129) / 0.22); overflow: hidden; }
.rec-level span {
  display: block;
  height: 100%;
  background: var(--uc-danger);
  transform-origin: left;
  transform: scaleX(0);
  transition: transform 0.08s linear;
}
.rec-cancel {
  border: 0;
  background: none;
  color: var(--uc-text-muted);
  font: inherit;
  font-size: var(--uc-fs-sm);
  font-weight: 600;
  cursor: pointer;
}
.rec-cancel:hover { color: var(--uc-text); }
.rec-stop {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: var(--uc-r-full);
  padding: 7px 15px;
  background: var(--uc-danger);
  color: #1a0808;
  font: inherit;
  font-size: var(--uc-fs-sm);
  font-weight: 700;
  cursor: pointer;
}

.uc-error { margin: 7px 2px 0; font-size: var(--uc-fs-sm); color: var(--uc-danger); }

/* A 34px hit target is fine for the small close buttons on the strips, which sit
   inside a row that is already comfortably tall. */
.uc-icon-btn.small { width: 26px; height: 26px; flex: 0 0 26px; }

@media (max-width: 768px) {
  .composer { padding-left: 10px; padding-right: 10px; }
}
</style>
