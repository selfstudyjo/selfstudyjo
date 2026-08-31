<template>
  <!-- A system message is the room narrating itself. Centred, unattributed, no
       bubble — it is not somebody talking. -->
  <div v-if="message.kind === 'system'" class="system">
    <span>{{ message.text }}</span>
  </div>

  <div
    v-else
    :class="['row', mine ? 'mine' : 'theirs', {
      'run-first': firstOfRun,
      'run-last': lastOfRun,
    }]"
  >
    <div class="gutter">
      <ChatAvatar
        v-if="!mine && firstOfRun"
        :user-id="message.sender_id"
        :name="message.sender_username"
        size="sm"
      />
    </div>

    <div class="stack">
      <p v-if="showSender" class="sender">{{ message.sender_username || 'Someone' }}</p>

      <div class="bubble-line">
        <!--
          A visible row of actions, revealed on hover and always present for
          keyboard and touch users.

          The right-click menu still works and does more, but it cannot be the
          only way to delete a message: there is no right-click on a phone, and a
          long-press there opens the browser's own menu. Deleting your own
          message is the single most-wanted action in any chat, so it gets a
          button.
        -->
        <div class="quick">
          <button
            type="button"
            class="quick-btn"
            :title="$t('Reply')"
            :aria-label="$t('Reply to this message')"
            @click="$emit('reply', message)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 016 6v5"/></svg>
          </button>
          <button
            v-if="canDelete"
            type="button"
            class="quick-btn danger"
            :title="mine ? 'Delete' : 'Delete as moderator'"
            :aria-label="deleteLabel"
            @click="$emit('remove', message)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
          </button>
          <button
            type="button"
            class="quick-btn"
            :title="$t('More')"
            :aria-label="$t('More actions')"
            @click="$emit('menu', message, $event)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
          </button>
        </div>

        <div
          :class="['bubble', message.kind, { pending: message.pending, failed: message.failed }]"
          :title="fullTime"
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
              <div v-if="!full && !mediaError" class="uc-spinner" :aria-label="$t('Loading picture')"></div>
              <p v-if="mediaError" class="media-error">{{ mediaError }}</p>
            </div>
            <RichText
              v-if="message.text"
              tag="figcaption"
              :text="message.text"
              :on-fill="mine"
            />
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
                :style="{ height: bar + '%', opacity: progress > i / bars.length ? 1 : 0.35 }"
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

          <!--
            Text.

            `on-fill` for your own bubble, which is painted with the accent
            gradient: a link there needs the ink derived for that fill, not the
            one derived for the page surface behind it. Mentions are on — this
            is a conversation between named people and "@sara" in a group chat
            is the normal way to address one of them.
          -->
          <RichText v-else class="text" :text="message.text" :on-fill="mine" />

          <!--
            The foot is drawn on the last bubble of a run, and on any bubble that
            has something to say about itself (edited, sending, failed). Repeating
            the same minute under all five messages of a burst is the noise that
            makes a transcript hard to scan; the exact time of the others is on
            the bubble's tooltip.
          -->
          <div v-if="showFoot" class="foot">
            <span v-if="message.edited" class="edited">{{ $t('edited') }}</span>
            <time :datetime="message.created_at">{{ time }}</time>

            <span v-if="status === 'sending'" class="tick" :title="$t('Sending')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9" opacity=".4"/><path d="M12 7v5l3 2"/></svg>
            </span>
            <button v-else-if="status === 'failed'" class="retry" type="button" @click="$emit('retry', message)">
              {{ $t('Not sent · retry') }}
            </button>
            <span v-else-if="status === 'read'" class="tick read" :title="$t('Read')">
              <svg width="16" height="12" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 9.6l4 4L14 4.4"/><path d="M9 13.6l0.6 0.6L21.5 2.8"/></svg>
            </span>
            <span v-else-if="status === 'sent'" class="tick" :title="$t('Sent')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * What the ticks under your own message mean.
 *
 * `read` is derived from the other members' `last_read_at`, not from a
 * per-message receipt — app 35 stores a read mark per membership, so "somebody
 * has read up to here" is the strongest true statement available. `none` is
 * everybody else's messages: a read mark on one of those would be meaningless.
 */
export type SendStatus = 'none' | 'sending' | 'sent' | 'read' | 'failed';
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import ChatAvatar from './ChatAvatar.vue';
import RichText from '@/components/RichText.vue';
import { formatDuration } from './chatMedia';
import { userChatService, type ChatMessage } from '@/services/userchat.service';

const props = withDefaults(defineProps<{
  message: ChatMessage;
  mine: boolean;
  /** First in a run from the same sender — only then is the avatar drawn, so a
   *  burst of five messages is one attributed block rather than five
   *  repetitions of the same face. */
  firstOfRun: boolean;
  /** Last in a run — where the tail, the time and the tick go. */
  lastOfRun: boolean;
  /** Whether to print the sender's name above the bubble. False in a one-to-one
   *  room, where the side of the screen already answers the question. */
  showSender: boolean;
  userId: string;
  replyTo?: ChatMessage | null;
  /** Whether this viewer may delete somebody *else's* message — owner or admin.
   *  Your own is always deletable and does not depend on this. */
  canModerate?: boolean;
  status?: SendStatus;
}>(), { status: 'none', canModerate: false, replyTo: null });

defineEmits<{
  (e: 'menu', message: ChatMessage, event: MouseEvent): void;
  (e: 'retry', message: ChatMessage): void;
  (e: 'jump', messageId: string): void;
  (e: 'lightbox', url: string): void;
  (e: 'reply', message: ChatMessage): void;
  (e: 'remove', message: ChatMessage): void;
}>();

/** The sender can always delete their own; a moderator can delete anybody's.
 *  Mirrors the backend rule in routes/messages.py, so the button is only shown
 *  where pressing it would actually work rather than producing a 403. */
const canDelete = computed(() => props.mine || !!props.canModerate);

const deleteLabel = computed(() => {
  const kind = props.message.kind === 'image' ? 'picture'
    : props.message.kind === 'audio' ? 'voice note' : 'message';
  return props.mine ? `Delete this ${kind}` : `Delete this ${kind} as a moderator`;
});

const showFoot = computed(() =>
  props.lastOfRun
  || props.message.edited
  || props.status === 'sending'
  || props.status === 'failed');

const full = ref('');
const mediaError = ref('');
const playing = ref(false);
const progress = ref(0);
const elapsed = ref(0);
const audioEl = ref<HTMLAudioElement | null>(null);

const thumb = computed(() => props.message.attachment?.thumbnail || '');

const frameStyle = computed(() => {
  const a = props.message.attachment;
  if (!a?.width || !a?.height) return {};
  // Reserve the right box before the picture arrives. Without an aspect ratio
  // here the thread jumps every time an image finishes loading, which on a slow
  // connection means it jumps continuously while you are trying to read.
  const ratio = a.width / a.height;
  const width = Math.min(340, a.width);
  return { width: `${width}px`, aspectRatio: `${ratio}` };
});

const time = computed(() => {
  const value = props.message.created_at;
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

/** The tooltip, so a bubble in the middle of a run still has its exact moment
 *  available without printing it under every line. */
const fullTime = computed(() => {
  const value = props.message.created_at;
  if (!value) return '';
  return new Date(value).toLocaleString();
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
/* ------------------------------------------------------- system notice */
.system {
  display: flex;
  justify-content: center;
  margin: var(--uc-gap-run) 0 6px;
}
.system span {
  padding: 4px 13px;
  border-radius: var(--uc-r-full);
  background: var(--uc-surface);
  border: 1px solid var(--uc-border);
  color: var(--uc-text-dim);
  font-size: var(--uc-fs-xs);
  text-align: center;
}

/* ------------------------------------------------------------ the row */
.row {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin-top: var(--uc-gap-tight);
}
/*
  The one rule that does most of the work. A run is tight; the space between
  runs is four times larger. That single ratio is what stops a transcript
  reading as one undifferentiated column, and it does more for legibility than
  any amount of colour.
*/
.row.run-first { margin-top: var(--uc-gap-run); }
.row.mine { flex-direction: row-reverse; }

/* Reserved whether or not an avatar is drawn, so every bubble in a run starts
   at the same x and the cluster reads as one block. */
.gutter { width: 26px; flex: 0 0 26px; }
.row.mine .gutter { display: none; }

.stack {
  min-width: 0;
  /* Capped by measure as well as by percentage: 76% of an ultrawide pane is a
     120-character line, which is roughly twice the width the eye can track back
     to the start of. */
  max-width: min(68ch, 76%);
  display: flex;
  flex-direction: column;
}
.row.mine .stack { align-items: flex-end; }

.sender {
  margin: 0 0 4px 3px;
  font-size: var(--uc-fs-xs);
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--uc-brand-soft);
}

/*
  The bubble and its action row on one line. `align-items: center` keeps the
  buttons vertically centred against a one-line bubble and against a picture
  alike, and reversing the row for `mine` puts them on the *outside* of the
  bubble in both directions — left of your own messages, right of everybody
  else's — so they never cover the text.
*/
.bubble-line { display: flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
.row.mine .bubble-line { flex-direction: row-reverse; }

.quick {
  display: flex;
  align-items: center;
  gap: 1px;
  flex: 0 0 auto;
  opacity: 0;
  transform: translateY(1px);
  transition: opacity var(--uc-t-fast), transform var(--uc-t-fast);
  pointer-events: none;
}
/* Revealed on hover, and on keyboard focus so the buttons are reachable without
   a mouse. `focus-within` is what makes tabbing to them work at all — an
   opacity-0 control is still focusable, and without this it would be focused and
   invisible. */
.row:hover .quick,
.quick:focus-within { opacity: 1; transform: none; pointer-events: auto; }

.quick-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--uc-text-dim);
  cursor: pointer;
  transition: background var(--uc-t-fast), color var(--uc-t-fast);
}
.quick-btn:hover { background: var(--uc-surface-2); color: var(--uc-text); }
.quick-btn.danger:hover { background: var(--uc-danger-bg); color: var(--uc-danger); }

/* On a touch screen there is no hover, so the actions are always visible — at a
   lower contrast so they do not shout. Long-press is not an option: the browser
   claims it for its own menu. */
@media (hover: none) {
  .quick { opacity: 0.5; transform: none; pointer-events: auto; }
}

/* --------------------------------------------------------- the bubble */
.bubble {
  position: relative;
  min-width: 0;
  padding: 9px 13px 7px;
  border-radius: var(--uc-r-lg);
  background: var(--uc-in-bg);
  border: 1px solid var(--uc-in-border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--uc-text);
  word-break: break-word;
  overflow-wrap: anywhere;
  /* The inset highlight along the top edge is what makes a flat translucent
     rectangle read as a piece of glass with a thickness to it. */
  box-shadow:
    0 2px 10px rgba(4, 6, 20, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  transition: box-shadow var(--uc-t-fast), transform var(--uc-t-fast);
}
.row:hover .bubble { transform: translateY(-1px); }
.row.theirs:hover .bubble { box-shadow: 0 6px 18px rgba(4, 6, 20, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.14); }

/*
  Your own messages: the brand gradient, and the only saturated colour in the
  transcript. Everything else is a tint of white, which is what makes this read
  as "mine" instantly rather than needing to be worked out from the alignment.
*/
.row.mine .bubble {
  background: var(--uc-out-bg);
  border-color: var(--uc-out-border);
  box-shadow: var(--uc-out-glow), inset 0 1px 0 rgba(255, 255, 255, 0.16);
}
.row.mine:hover .bubble {
  box-shadow: 0 10px 26px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

/* Selecting text inside a bubble should not go invisible against the gradient. */
.bubble ::selection, .bubble::selection { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.28); color: var(--sfs-text, #fff); }

/*
  Cluster geometry. The corner facing the author is tightened: bottom on the last
  bubble of a run (the tail), top on every bubble that is not the first (the
  join). A single message therefore gets one tail and three round corners, and a
  run of five reads as one shape with a tail at the end.
*/
.row.theirs .bubble { border-end-start-radius: var(--uc-tail); }
.row.theirs:not(.run-first) .bubble { border-start-start-radius: var(--uc-tail); }
.row.mine .bubble { border-end-end-radius: var(--uc-tail); }
.row.mine:not(.run-first) .bubble { border-start-end-radius: var(--uc-tail); }

.bubble.pending { opacity: 0.68; }
.bubble.failed {
  background: var(--uc-danger-bg);
  border-color: var(--uc-danger-border);
  box-shadow: none;
}

/* --------------------------------------------------------------- quote */
.quote {
  display: block;
  width: 100%;
  text-align: start;
  margin: 0 0 6px;
  padding: 5px 9px;
  border: 0;
  border-inline-start: 3px solid var(--uc-brand-soft);
  border-radius: var(--uc-r-xs);
  background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.22);
  color: inherit;
  cursor: pointer;
  font: inherit;
  transition: background var(--uc-t-fast);
}
.quote:hover { background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.32); }
.row.mine .quote { border-inline-start-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.7); background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14); }
.row.mine .quote:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.2); }
.quote-who { display: block; font-size: var(--uc-fs-xs); font-weight: 700; }
.quote-text {
  display: block;
  font-size: var(--uc-fs-sm);
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------------------------------------------------------------- text */
.text {
  margin: 0;
  font-size: var(--uc-fs-md);
  line-height: 1.5;
  white-space: pre-wrap;
}

/* -------------------------------------------------------------- media */
.bubble.image { padding: 5px 5px 4px; }

.media { margin: 0; }
.frame {
  position: relative;
  max-width: 340px;
  min-width: 130px;
  border-radius: var(--uc-r-sm);
  overflow: hidden;
  background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.3);
  cursor: zoom-in;
  display: grid;
  place-items: center;
}
.frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* The placeholder is a 24px thumbnail blown up, so it has to be blurred — at
   that size the pixels are the point, not a defect. */
.blur { filter: blur(12px); transform: scale(1.12); }
.full { position: relative; }
.media figcaption {
  margin: 7px 7px 1px;
  font-size: var(--uc-fs-md);
  line-height: 1.45;
}

.uc-spinner {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 2.5px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.35);
  border-top-color: var(--sfs-border-strong, #fff);
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.media-error { margin: 4px 0 0; font-size: var(--uc-fs-xs); color: var(--uc-danger); }

/* -------------------------------------------------------------- voice */
.voice { display: flex; align-items: center; gap: 10px; min-width: 214px; }
.play {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14);
  color: var(--uc-text);
  cursor: pointer;
  transition: background var(--uc-t-fast);
}
.play:hover:not(:disabled) { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.24); }
.row.theirs .play { background: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.24); color: var(--sfs-text-muted, #c7d2fe); }
.play:disabled { opacity: 0.45; cursor: default; }

.wave { flex: 1; display: flex; align-items: center; gap: 2px; height: 26px; cursor: pointer; }
.wave span {
  flex: 1;
  min-width: 2px;
  border-radius: 2px;
  background: currentColor;
  transition: opacity var(--uc-t-fast);
}
.row.theirs .wave { color: var(--sfs-text-muted, #a5b4fc); }
.row.mine .wave { color: var(--sfs-text, #fff); }

.duration {
  font-size: var(--uc-fs-xs);
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

/* --------------------------------------------------------------- foot */
.foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 3px;
  font-size: var(--uc-fs-xs);
  color: var(--sfs-text-muted, rgb(255 255 255 / 0.7));
  line-height: 1;
}
.bubble.image .foot { margin: 3px 5px 1px; }
.edited { font-style: italic; opacity: 0.8; }
time { font-variant-numeric: tabular-nums; }
.tick { display: inline-flex; }
/* The one place a second accent colour earns its keep: "delivered" and "seen"
   are different facts and a reader should not have to count the ticks. */
.tick.read { color: var(--uc-read); }
.retry {
  border: 0;
  background: none;
  padding: 0;
  color: var(--uc-danger);
  font: inherit;
  font-size: var(--uc-fs-xs);
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
}

/* ------------------------------------------------------------ jump-to */
/* Applied from the page when a reply's quote is followed to its parent. */
.row.highlighted .bubble { animation: uc-flash 1.6s ease-out; }
@keyframes uc-flash {
  0%, 40% { box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.6); }
  100% { box-shadow: 0 2px 10px rgba(4, 6, 20, 0.2); }
}

@media (max-width: 768px) {
  .stack { max-width: min(68ch, 86%); }
  .frame { max-width: min(70vw, 340px); }
}
</style>
