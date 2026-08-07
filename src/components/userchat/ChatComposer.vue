<template>
  <div class="composer">
    <div v-if="replyTo" class="replying">
      <div class="replying-body">
        <span class="replying-who">Replying to {{ replyTo.sender_username || 'someone' }}</span>
        <span class="replying-text">{{ replyPreview }}</span>
      </div>
      <button type="button" class="icon-btn" aria-label="Cancel reply" @click="$emit('cancel-reply')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <!-- A picture waiting to be sent, with its caption. Shown *before* the upload
         finishes so the caption can be typed while the bytes are still going up —
         which is most of the reason upload and send are two requests. -->
    <div v-if="pending" class="pending">
      <img v-if="pendingPreview" :src="pendingPreview" alt="" class="pending-thumb" />
      <div v-else class="pending-thumb audio-thumb">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11z"/></svg>
      </div>
      <div class="pending-body">
        <p class="pending-name">{{ pending.name }}</p>
        <p class="pending-meta">
          <template v-if="pending.state === 'uploading'">Uploading…</template>
          <template v-else-if="pending.state === 'error'" class="err">{{ pending.error }}</template>
          <template v-else>
            {{ humanSize(pending.storedBytes) }}
            <span v-if="pending.savedPercent > 4" class="saved">
              · {{ pending.savedPercent }}% smaller
            </span>
          </template>
        </p>
      </div>
      <button type="button" class="icon-btn" aria-label="Discard attachment" @click="$emit('discard')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div v-if="recording" class="recording">
      <span class="rec-dot" aria-hidden="true"></span>
      <span class="rec-time">{{ formatDuration(recordElapsed) }}</span>
      <div class="rec-level"><span :style="{ transform: `scaleX(${recordLevel})` }"></span></div>
      <button type="button" class="rec-cancel" @click="cancelRecording">Cancel</button>
      <button type="button" class="rec-stop" @click="finishRecording">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4z"/></svg>
        Send
      </button>
    </div>

    <form v-else class="bar" @submit.prevent="submit">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="sr-only"
        @change="onPick"
      />
      <button
        type="button"
        class="icon-btn big"
        aria-label="Attach a picture"
        :disabled="busy"
        @click="fileInput?.click()"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a2 2 0 01-2.82-2.83l8.49-8.48"/></svg>
      </button>

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
        class="icon-btn big"
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
        aria-label="Send"
        :disabled="busy || (!draft.trim() && !canSendAttachment)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
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
  element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
}

function onKeydown(event: KeyboardEvent) {
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
  stopTyping();
  nextTick(autosize);
}

// ------------------------------------------------------------- pictures

async function onPick(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';                 // so picking the same file twice still fires
  if (!file) return;

  error.value = '';
  try {
    // Compressed here first. The backend compresses again, but this is what stops
    // a 4 MB phone photo crossing the network at all - see chatMedia.ts.
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

// ---------------------------------------------------------------- voice

const recording = ref(false);
const recordElapsed = ref(0);
const recordLevel = ref(0);
let handle: Awaited<ReturnType<typeof startRecording>> | null = null;
let tick: number | null = null;

async function beginRecording() {
  error.value = '';
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
  if (tick) window.clearInterval(tick);
});

defineExpose({ focus: () => input.value?.focus() });
</script>

<style scoped>
.composer { border-top: 1px solid rgba(15, 23, 42, 0.08); background: #fff; padding: 8px 12px 10px; }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.replying, .pending {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 8px; padding: 6px 8px;
  border-radius: 9px; background: #f1f5f9;
  border-left: 3px solid #2563eb;
}
.replying-body, .pending-body { flex: 1; min-width: 0; }
.replying-who, .pending-name { display: block; font-size: 0.73rem; font-weight: 700; color: #1e293b; }
.replying-text, .pending-meta {
  display: block; margin: 0; font-size: 0.76rem; color: #64748b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.saved { color: #16a34a; font-weight: 600; }
.err { color: #b91c1c; }

.pending-thumb { width: 38px; height: 38px; border-radius: 7px; object-fit: cover; flex: 0 0 38px; }
.audio-thumb { display: grid; place-items: center; background: #dbeafe; color: #2563eb; }

.bar { display: flex; align-items: flex-end; gap: 6px; }

.input {
  flex: 1;
  resize: none;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 18px;
  padding: 9px 14px;
  font: inherit;
  font-size: 0.9rem;
  line-height: 1.4;
  max-height: 140px;
  outline: none;
  background: #f8fafc;
  transition: border-color 0.14s, background 0.14s;
}
.input:focus { border-color: #2563eb; background: #fff; }
.input:disabled { opacity: 0.6; }

.icon-btn {
  display: grid; place-items: center;
  border: 0; background: none; color: #64748b;
  cursor: pointer; border-radius: 50%;
  width: 26px; height: 26px; flex: 0 0 26px;
}
.icon-btn.big { width: 36px; height: 36px; flex: 0 0 36px; }
.icon-btn:hover:not(:disabled) { background: #e2e8f0; color: #1e293b; }
.icon-btn:disabled { opacity: 0.45; cursor: default; }

.send {
  display: grid; place-items: center;
  width: 36px; height: 36px; flex: 0 0 36px;
  border: 0; border-radius: 50%;
  background: #2563eb; color: #fff; cursor: pointer;
  transition: background 0.14s, transform 0.1s;
}
.send:hover:not(:disabled) { background: #1d4ed8; }
.send:active:not(:disabled) { transform: scale(0.94); }
.send:disabled { background: #cbd5e1; cursor: default; }

.recording {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 18px;
  background: #fef2f2; border: 1px solid #fecaca;
}
.rec-dot {
  width: 9px; height: 9px; border-radius: 50%; background: #dc2626;
  animation: pulse 1.1s ease-in-out infinite;
}
@keyframes pulse { 50% { opacity: 0.25; } }
.rec-time { font-size: 0.8rem; font-weight: 700; color: #7f1d1d; font-variant-numeric: tabular-nums; }
.rec-level { flex: 1; height: 5px; border-radius: 3px; background: #fecaca; overflow: hidden; }
.rec-level span {
  display: block; height: 100%; background: #dc2626;
  transform-origin: left; transform: scaleX(0);
  transition: transform 0.08s linear;
}
.rec-cancel {
  border: 0; background: none; color: #7f1d1d;
  font-size: 0.79rem; font-weight: 600; cursor: pointer;
}
.rec-stop {
  display: inline-flex; align-items: center; gap: 6px;
  border: 0; border-radius: 999px; padding: 6px 13px;
  background: #dc2626; color: #fff;
  font-size: 0.79rem; font-weight: 700; cursor: pointer;
}

.error { margin: 6px 2px 0; font-size: 0.77rem; color: #b91c1c; }
</style>
