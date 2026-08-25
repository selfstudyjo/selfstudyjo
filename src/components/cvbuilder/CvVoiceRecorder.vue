<template>
  <div class="voice-recorder">
    <div class="vr-head">
      <div class="vr-title">
        <span class="vr-dot" :class="{ live: recording }"></span>
        <h4>{{ recording ? 'Listening…' : 'Talk about your career' }}</h4>
      </div>
      <div class="vr-meta">
        <span v-if="recording">{{ elapsedLabel }}</span>
        <span v-if="wordCount">{{ $t('{v0} words', { v0: wordCount }) }}</span>
        <span v-if="pendingChunks" class="vr-pending">{{ $t('transcribing {v0}…', { v0: pendingChunks }) }}</span>
      </div>
    </div>

    <p class="vr-hint">
      {{ $t('Speak naturally, as if answering “tell me about your career”. Cover each job title and employer, roughly when you were there, what you actually did and anything you improved with a number. Then your education, skills and languages. You can pause and resume — nothing is sent until you stop.') }}
    </p>

    <div class="vr-level" v-if="recording">
      <div class="vr-level-bar" :style="{ width: level + '%' }"></div>
    </div>

    <div class="vr-actions">
      <button v-if="!recording" class="vr-btn vr-btn-record" :disabled="starting" @click="start">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/>
        </svg>
        {{ starting ? 'Starting…' : (editableTranscript ? 'Continue recording' : 'Start recording') }}
      </button>
      <button v-else class="vr-btn vr-btn-stop" @click="stop">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        {{ $t('Stop') }}
      </button>

      <button v-if="editableTranscript && !recording" class="vr-btn vr-btn-ghost" @click="clear">{{ $t('Clear') }}</button>
      <span v-if="error" class="vr-error">{{ error }}</span>
    </div>

    <div class="vr-transcript-wrap">
      <label>{{ $t('Transcript') }} <span class="vr-editable">{{ $t('— editable, fix anything the microphone got wrong') }}</span></label>
      <textarea
        v-model="editableTranscript"
        class="vr-transcript"
        rows="7"
        placeholder="Your words will appear here as you speak. You can also just type here instead."
        @input="emitTranscript"
      ></textarea>
    </div>

    <div class="vr-notes-wrap">
      <label>{{ $t('Anything else to add') }} <span class="vr-editable">{{ $t('— optional') }}</span></label>
      <input
        v-model="notes"
        class="vr-notes"
        type="text"
        :placeholder="$t('e.g. targeting a DevOps role in Dubai, available from October')"
        @input="$emit('update:notes', notes)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { aiLanguage } from '@/i18n/runtime';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { cvBuilderService } from '@/services/cvbuilder.service';

const props = defineProps<{
  userId: string;
  modelValue?: string;
  notesValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:notes', value: string): void;
  (e: 'recording', value: boolean): void;
}>();

const recording = ref(false);
const starting = ref(false);
const error = ref('');
const level = ref(0);
const pendingChunks = ref(0);
const elapsed = ref(0);
const editableTranscript = ref(props.modelValue || '');
const notes = ref(props.notesValue || '');

// Recording is chunked rather than one long take: each chunk is transcribed while
// the next is being recorded, so the user sees words appear as they talk instead
// of waiting for a single upload at the end - and no request is ever long enough
// to hit the backend's timeout.
const CHUNK_MS = 6000;

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let loopActive = false;
let timer: number | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let levelFrame = 0;

const wordCount = computed(() =>
  editableTranscript.value.trim() ? editableTranscript.value.trim().split(/\s+/).length : 0);

const elapsedLabel = computed(() => {
  const total = Math.floor(elapsed.value);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
});

watch(() => props.modelValue, value => {
  if ((value || '') !== editableTranscript.value) editableTranscript.value = value || '';
});

function emitTranscript() {
  emit('update:modelValue', editableTranscript.value);
}

function appendText(text: string) {
  const clean = text.trim();
  if (!clean) return;
  editableTranscript.value = (editableTranscript.value
    ? `${editableTranscript.value.trim()} ${clean}`
    : clean);
  emitTranscript();
}

function preferredMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function watchLevel() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    if (!analyser || !recording.value) { level.value = 0; return; }
    analyser.getByteFrequencyData(data);
    const average = data.reduce((sum, v) => sum + v, 0) / data.length;
    level.value = Math.min(100, Math.round((average / 140) * 100));
    levelFrame = requestAnimationFrame(tick);
  };
  levelFrame = requestAnimationFrame(tick);
}

async function transcribeChunk(blob: Blob) {
  if (blob.size < 1200) return;
  pendingChunks.value++;
  try {
    // The language the speaker is DICTATING in. Left at the service's `'en'`
    // default, Whisper does not fail on Arabic or Chinese — it transliterates
    // phonetically, so the CV is then built from a Latin approximation of what
    // was said and the "nothing is invented about you" promise is quietly
    // broken by the transcription rather than by the model.
    const text = await cvBuilderService.transcribe(props.userId, blob, aiLanguage());
    appendText(text);
  } catch (e: any) {
    // One failed chunk must not stop the recording; surface it and keep going.
    error.value = e?.message || 'A part of the recording could not be transcribed.';
  } finally {
    pendingChunks.value = Math.max(0, pendingChunks.value - 1);
  }
}

function recordChunk(): Promise<void> {
  return new Promise(resolve => {
    if (!stream) { resolve(); return; }
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) { resolve(); return; }

    const mimeType = preferredMimeType();
    try {
      recorder = mimeType
        ? new MediaRecorder(new MediaStream(audioTracks), { mimeType, audioBitsPerSecond: 64000 })
        : new MediaRecorder(new MediaStream(audioTracks));
    } catch {
      resolve();
      return;
    }

    const parts: Blob[] = [];
    let stopTimer: number | null = null;
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) parts.push(event.data);
    };
    recorder.onstop = () => {
      if (stopTimer) window.clearTimeout(stopTimer);
      if (parts.length) {
        void transcribeChunk(new Blob(parts, { type: recorder?.mimeType || 'audio/webm' }));
      }
      recorder = null;
      resolve();
    };

    try {
      recorder.start();
    } catch {
      resolve();
      return;
    }
    stopTimer = window.setTimeout(() => {
      if (recorder && recorder.state === 'recording') {
        try { recorder.stop(); } catch { /* already stopped */ }
      }
    }, CHUNK_MS);
  });
}

async function recordLoop() {
  if (loopActive) return;
  loopActive = true;
  while (recording.value) {
    await recordChunk();
    if (recording.value) await new Promise(r => window.setTimeout(r, 40));
  }
  loopActive = false;
}

async function start() {
  error.value = '';
  if (typeof MediaRecorder === 'undefined') {
    error.value = 'This browser cannot record audio. Try Chrome, Edge, Firefox or Safari — '
      + 'or just type your career history into the transcript box below.';
    return;
  }

  starting.value = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e: any) {
    starting.value = false;
    error.value = e?.name === 'NotAllowedError'
      ? 'Microphone permission was denied. Allow it in your browser, or type into the transcript box instead.'
      : `The microphone could not be opened: ${e?.message || e}`;
    return;
  }

  try {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    audioContext.createMediaStreamSource(stream).connect(analyser);
  } catch {
    analyser = null;                                // level meter is cosmetic
  }

  starting.value = false;
  recording.value = true;
  emit('recording', true);
  watchLevel();
  timer = window.setInterval(() => { elapsed.value += 1; }, 1000);
  void recordLoop();
}

function stop() {
  recording.value = false;
  emit('recording', false);
  if (recorder && recorder.state === 'recording') {
    try { recorder.stop(); } catch { /* already stopped */ }
  }
  if (timer) { window.clearInterval(timer); timer = null; }
  if (levelFrame) { cancelAnimationFrame(levelFrame); levelFrame = 0; }
  level.value = 0;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  void audioContext?.close().catch(() => undefined);
  audioContext = null;
  analyser = null;
}

function clear() {
  editableTranscript.value = '';
  elapsed.value = 0;
  emitTranscript();
}

onBeforeUnmount(stop);

defineExpose({ stop, transcript: editableTranscript, notes });
</script>

<style scoped>
.voice-recorder {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
  border-radius: 14px;
  padding: 18px;
}

.vr-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}

.vr-title { display: flex; align-items: center; gap: 10px; }
.vr-title h4 { color: var(--sfs-text, #fff); font-size: 1.05rem; font-weight: 600; }

.vr-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.3);
}
.vr-dot.live { background: var(--sfs-danger, #ef4444); animation: vr-pulse 1.2s infinite;   /* Its own ink. The base rule this shares with the other variants can only
     hold one `color`, and that one belongs to whichever variant came first —
     so an amber or green button inherited the ink meant for the indigo one.
     A fill decides its own ink. */
  color: var(--sfs-on-danger, #fff);
}
@keyframes vr-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgb(var(--sfs-danger-rgb, 239 68 68) / 0.55); }
  50% { opacity: 0.7; box-shadow: 0 0 0 7px rgb(var(--sfs-danger-rgb, 239 68 68) / 0); }
}

.vr-meta {
  display: flex; gap: 12px; align-items: center;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.6); font-size: 0.82rem; font-variant-numeric: tabular-nums;
}
.vr-pending { color: var(--sfs-text-muted, #a5b4fc); }

.vr-hint {
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.62);
  font-size: 0.86rem;
  line-height: 1.5;
  margin-bottom: 12px;
}

.vr-level {
  height: 5px; border-radius: 3px; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1);
  overflow: hidden; margin-bottom: 12px;
}
.vr-level-bar {
  height: 100%; background: linear-gradient(90deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #a855f7));
  transition: width 90ms linear;
}

.vr-actions {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px;
}

.vr-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: 10px; border: none;
  font-size: 0.9rem; font-weight: 600; cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.vr-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
.vr-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.vr-btn-record { background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #764ba2)); color: var(--sfs-on-accent, #fff); }
.vr-btn-stop { background: var(--sfs-danger, #ef4444); color: var(--sfs-on-danger, #fff); }
.vr-btn-ghost {
  background: transparent; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.75);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);
}

.vr-error { color: var(--sfs-danger-text, #fca5a5); font-size: 0.83rem; flex: 1 1 220px; }

.vr-transcript-wrap, .vr-notes-wrap { margin-bottom: 12px; }

.vr-transcript-wrap label, .vr-notes-wrap label {
  display: block; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.8);
  font-size: 0.82rem; font-weight: 600; margin-bottom: 6px;
}
.vr-editable { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.45); font-weight: 400; }

.vr-transcript, .vr-notes {
  width: 100%; background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.28);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14); border-radius: 10px;
  color: var(--sfs-text, #fff); padding: 11px 13px; font-size: 0.9rem; line-height: 1.55;
  font-family: inherit; resize: vertical;
}
.vr-transcript:focus, .vr-notes:focus {
  outline: none; border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.7);
  box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16);
}
</style>
