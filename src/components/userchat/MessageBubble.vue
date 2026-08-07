<template>
  <!-- A system message is the room narrating itself. Centred, unattributed, no
       bubble — it is not somebody talking. -->
  <div v-if="message.kind === 'system'" class="system">
    <span>{{ message.text }}</span>
  </div>

  <div v-else :class="['row', { mine, 'first-of-run': firstOfRun }]">
    <div class="avatar-slot">
      <div
        v-if="!mine && firstOfRun"
        class="avatar"
        :style="{ background: colourFor(message.sender_id) }"
        :title="message.sender_username"
      >{{ initials }}</div>
    </div>

    <div class="stack">
      <p v-if="!mine && firstOfRun" class="sender">{{ message.sender_username || 'Someone' }}</p>

      <div
        :class="['bubble', message.kind, { pending: message.pending, failed: message.failed }]"
        @contextmenu.prevent="$emit('menu', message, $event)"
      >
        <button
          v-if="replyTo"
          class="quote"
          type="button"
          @click="$emit('jump', replyTo!.message_id)"
        >
          <span class="quote-who">{{ replyTo.sender_username || 'Someone' }}</span>
          <span class="quote-text">{{ quotePreview }}</span>
        </button>

        <!-- Image -->
        <figure v-if="message.kind === 'image'" class="media">
          <!-- The thumbnail is a sub-kilobyte data URL that came down inside the
               message record, so it paints instantly and the bubble is the right
               size before the real picture has been fetched. Without it every
               image arrives as a jump in the scroll position. -->
          <div
            class="frame"
            :style="frameStyle"
            @click="full && $emit('lightbox', full)"
          >
            <img
              v-if="thumb && !full"
              :src="thumb"
              class="blur"
              alt=""
              aria-hidden="true"
            />
            <img
              v-if="full"
              :src="full"
              :alt="message.text || 'Shared picture'"
              class="full"
            />
            <div v-if="!full && !mediaError" class="spinner" aria-label="Loading picture"></div>
            <p v-if="mediaError" class="media-error">{{ mediaError }}</p>
          </div>
          <figcaption v-if="message.text">{{ message.text }}</figcaption>
        </figure>

        <!-- Voice note -->
        <div v-else-if="message.kind === 'audio'" class="voice">
          <button
            class="play"
            type="button"
            :disabled="!full && !mediaError"
            :aria-label="playing ? 'Pause voice note' : 'Play voice note'"
            @click="togglePlay"
          >
            <svg v-if="!playing" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
          </button>
          <div class="wave" @click="seek">
            <!-- A static waveform derived from the attachment id, not from the
                 audio. Decoding every voice note to draw a real one would mean
                 downloading and decoding all of them just to render the list. It
                 is deterministic per message, so it does not shimmer on re-render
                 and it never looks like the same clip twice. -->
            <span
              v-for="(bar, i) in bars"
              :key="i"
              :style="{ height: bar + '%', opacity: progress > i / bars.length ? 1 : 0.4 }"
            ></span>
          </div>
          <span class="duration">{{ elapsedLabel }}</span>
          <audio
            v-if="full"
            ref="audioEl"
            :src="full"
            preload="metadata"
            @timeupdate="onTime"
            @ended="onEnded"
            @loadedmetadata="onMeta"
          ></audio>
          <p v-if="mediaError" class="media-error">{{ mediaError }}</p>
        </div>

        <!-- Text -->
        <p v-else class="text">{{ message.text }}</p>

        <div class="foot">
          <span v-if="message.edited" class="edited">edited</span>
          <time :datetime="message.created_at">{{ time }}</time>
          <span v-if="message.pending" class="tick" title="Sending">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9" opacity=".35"/><path d="M12 7v5l3 2"/></svg>
          </span>
          <button v-else-if="message.failed" class="retry" type="button" @click="$emit('retry', message)">
            Not sent · retry
          </button>
          <span v-else-if="mine" class="tick" title="Sent">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 12.5l5 5L20 6.5"/></svg>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { formatDuration } from './chatMedia';
import { userChatService, type ChatMessage } from '@/services/userchat.service';

const props = defineProps<{
  message: ChatMessage;
  mine: boolean;
  /** First in a run from the same sender — only then is the name and avatar
   *  drawn, so a burst of five messages is one attributed block rather than five
   *  repetitions of the same name. */
  firstOfRun: boolean;
  userId: string;
  replyTo?: ChatMessage | null;
}>();

defineEmits<{
  (e: 'menu', message: ChatMessage, event: MouseEvent): void;
  (e: 'retry', message: ChatMessage): void;
  (e: 'jump', messageId: string): void;
  (e: 'lightbox', url: string): void;
}>();

const full = ref('');
const mediaError = ref('');
const playing = ref(false);
const progress = ref(0);
const elapsed = ref(0);
const audioEl = ref<HTMLAudioElement | null>(null);

const PALETTE = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2',
  '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#c026d3',
];

/** The same rule the backend's presence module uses, so a person is the same
 *  colour in the member list, on their avatar and beside their messages. */
function colourFor(id: string) {
  const text = String(id || '');
  if (!text) return PALETTE[0];
  let sum = 0;
  for (const ch of text) sum += ch.charCodeAt(0);
  return PALETTE[sum % PALETTE.length];
}

const initials = computed(() => {
  const name = props.message.sender_username || '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
});

const thumb = computed(() => props.message.attachment?.thumbnail || '');

const frameStyle = computed(() => {
  const a = props.message.attachment;
  if (!a?.width || !a?.height) return {};
  // Reserve the right box before the picture arrives. Without an aspect ratio
  // here the thread jumps every time an image finishes loading, which on a slow
  // connection means it jumps continuously while you are trying to read.
  const ratio = a.width / a.height;
  const width = Math.min(320, a.width);
  return { width: `${width}px`, aspectRatio: `${ratio}` };
});

const time = computed(() => {
  const value = props.message.created_at;
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

const quotePreview = computed(() => {
  const parent = props.replyTo;
  if (!parent) return '';
  if (parent.kind === 'image') return parent.text || 'Picture';
  if (parent.kind === 'audio') return parent.text || 'Voice note';
  return (parent.text || '').slice(0, 90);
});

const durationMs = computed(() => props.message.attachment?.duration_ms || 0);

const elapsedLabel = computed(() =>
  formatDuration(playing.value || elapsed.value ? elapsed.value : durationMs.value));

/** A deterministic pseudo-waveform from the attachment id. See the template. */
const bars = computed(() => {
  const seed = props.message.attachment?.attachment_id || props.message.message_id;
  const out: number[] = [];
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < 28; i++) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    out.push(28 + (hash % 68));
  }
  return out;
});

async function loadMedia() {
  const id = props.message.attachment_id;
  if (!id || props.message.kind === 'text' || props.message.kind === 'system') return;
  full.value = '';
  mediaError.value = '';
  try {
    full.value = await userChatService.attachmentUrl(props.userId, id);
  } catch (error: any) {
    mediaError.value = error?.status === 410
      ? 'This file is no longer stored.'
      : 'Could not load this file.';
  }
}

watch(() => props.message.attachment_id, loadMedia, { immediate: true });

function togglePlay() {
  const element = audioEl.value;
  if (!element) return;
  if (playing.value) {
    element.pause();
    playing.value = false;
  } else {
    element.play().then(() => { playing.value = true; }).catch(() => {
      mediaError.value = 'Could not play this recording.';
    });
  }
}

function onTime() {
  const element = audioEl.value;
  if (!element || !element.duration || !isFinite(element.duration)) return;
  progress.value = element.currentTime / element.duration;
  elapsed.value = element.currentTime * 1000;
}

function onMeta() {
  const element = audioEl.value;
  // A WebM from MediaRecorder often reports Infinity for duration until it has
  // been played through, so the attachment record's own duration_ms is the value
  // to trust and this only fills the gap when there is none.
  if (element && isFinite(element.duration) && !durationMs.value) {
    elapsed.value = 0;
  }
}

function onEnded() {
  playing.value = false;
  progress.value = 0;
  elapsed.value = 0;
}

function seek(event: MouseEvent) {
  const element = audioEl.value;
  if (!element || !element.duration || !isFinite(element.duration)) return;
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  element.currentTime = ((event.clientX - box.left) / box.width) * element.duration;
}

onBeforeUnmount(() => {
  audioEl.value?.pause();
});
</script>

<style scoped>
.system {
  display: flex;
  justify-content: center;
  margin: 10px 0;
}
.system span {
  padding: 4px 12px;
  border-radius: 999px;
  background: #eef2f7;
  color: #64748b;
  font-size: 0.74rem;
}

.row { display: flex; gap: 8px; margin-top: 2px; align-items: flex-end; }
.row.first-of-run { margin-top: 12px; }
.row.mine { flex-direction: row-reverse; }

.avatar-slot { width: 28px; flex: 0 0 28px; }
.row.mine .avatar-slot { display: none; }
.avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: grid; place-items: center;
  color: #fff; font-size: 0.66rem; font-weight: 700;
}

.stack { min-width: 0; max-width: min(78%, 560px); }
.row.mine .stack { display: flex; flex-direction: column; align-items: flex-end; }

.sender { margin: 0 0 3px 2px; font-size: 0.73rem; font-weight: 700; color: #475569; }

.bubble {
  position: relative;
  padding: 8px 11px 5px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  word-break: break-word;
}
.row.mine .bubble {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.bubble.pending { opacity: 0.62; }
.bubble.failed { border-color: #dc2626; background: #fef2f2; color: #7f1d1d; }

.row:not(.first-of-run) .bubble { border-top-left-radius: 6px; }
.row.mine:not(.first-of-run) .bubble { border-top-left-radius: 14px; border-top-right-radius: 6px; }

.quote {
  display: block; width: 100%; text-align: left;
  margin: 0 0 6px; padding: 5px 8px;
  border: 0; border-left: 3px solid currentColor;
  border-radius: 5px;
  background: rgba(15, 23, 42, 0.055);
  color: inherit; cursor: pointer; opacity: 0.85;
  font: inherit;
}
.row.mine .quote { background: rgba(255, 255, 255, 0.17); }
.quote-who { display: block; font-size: 0.71rem; font-weight: 700; }
.quote-text { display: block; font-size: 0.76rem; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.text { margin: 0; font-size: 0.9rem; line-height: 1.45; white-space: pre-wrap; }

.media { margin: 0; }
.frame {
  position: relative;
  max-width: 320px;
  min-width: 120px;
  border-radius: 9px;
  overflow: hidden;
  background: #e2e8f0;
  cursor: zoom-in;
  display: grid;
  place-items: center;
}
.frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* The placeholder is a 24px thumbnail blown up, so it has to be blurred — at
   that size the pixels are the point, not a defect. */
.blur { filter: blur(12px); transform: scale(1.12); }
.full { position: relative; }
.media figcaption { margin: 6px 2px 0; font-size: 0.85rem; line-height: 1.4; }

.spinner {
  position: absolute;
  width: 22px; height: 22px;
  border: 2.5px solid rgba(255, 255, 255, 0.55);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.media-error { margin: 4px 0 0; font-size: 0.75rem; color: #b91c1c; }
.row.mine .media-error { color: #fecaca; }

.voice { display: flex; align-items: center; gap: 9px; min-width: 208px; }
.play {
  flex: 0 0 30px; width: 30px; height: 30px;
  display: grid; place-items: center;
  border: 0; border-radius: 50%;
  background: rgba(37, 99, 235, 0.13); color: #2563eb;
  cursor: pointer;
}
.row.mine .play { background: rgba(255, 255, 255, 0.22); color: #fff; }
.play:disabled { opacity: 0.5; cursor: default; }

.wave { flex: 1; display: flex; align-items: center; gap: 2px; height: 26px; cursor: pointer; }
.wave span { flex: 1; min-width: 2px; border-radius: 2px; background: #2563eb; transition: opacity 0.12s; }
.row.mine .wave span { background: #fff; }

.duration { font-size: 0.72rem; font-variant-numeric: tabular-nums; opacity: 0.75; }

.foot {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 6px; margin-top: 2px;
  font-size: 0.66rem; opacity: 0.68;
}
.edited { font-style: italic; }
.tick { display: inline-flex; }
.retry {
  border: 0; background: none; padding: 0;
  color: #b91c1c; font-size: 0.68rem; font-weight: 700;
  cursor: pointer; text-decoration: underline;
}
</style>
