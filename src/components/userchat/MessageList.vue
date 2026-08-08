<template>
  <div class="stream">
    <div ref="scroller" class="transcript uc-scroll" @scroll.passive="onScroll">
      <div ref="content" class="content">
        <!-- ---------------------------------------------------- older -->
        <div class="older">
          <p v-if="loadingOlder" class="older-note">
            <span class="uc-spinner" aria-hidden="true"></span> Loading earlier messages…
          </p>
          <button
            v-else-if="hasMore"
            type="button"
            class="older-btn"
            @click="$emit('scroll-top')"
          >Load earlier messages</button>
          <p v-else-if="messages.length" class="older-note faint">
            This is the beginning of the conversation.
          </p>
        </div>

        <!-- --------------------------------------------------- groups -->
        <!--
          One <section> per calendar day, with the date pill sticky inside it.
          Sticky *inside the group* rather than as a flat sibling is what stops
          every divider in the transcript piling up at the top of the viewport
          and overprinting each other — a sticky element only sticks while its
          own containing block is on screen.
        -->
        <section v-for="group in groups" :key="group.key" class="day-group">
          <div class="day"><span>{{ group.label }}</span></div>

          <MessageBubble
            v-for="entry in group.items"
            :id="`msg-${entry.message.message_id}`"
            :key="entry.message.message_id"
            :message="entry.message"
            :mine="entry.mine"
            :first-of-run="entry.firstOfRun"
            :last-of-run="entry.lastOfRun"
            :show-sender="entry.showSender"
            :user-id="userId"
            :reply-to="parentOf(entry.message)"
            :can-moderate="canModerate"
            :status="statusOf(entry.message, entry.mine)"
            :class="{ highlighted: highlighted === entry.message.message_id }"
            @menu="(m, e) => $emit('menu', m, e)"
            @retry="$emit('retry', $event)"
            @jump="$emit('jump', $event)"
            @lightbox="$emit('lightbox', $event)"
            @reply="$emit('reply', $event)"
            @remove="$emit('remove', $event)"
          />
        </section>

        <!-- -------------------------------------------------- loading -->
        <!-- Ghost bubbles rather than a spinner: they hold the shape the real
             transcript is about to take, so opening a conversation does not
             flash an empty panel and then jump. -->
        <div v-if="loading && !messages.length" class="skeletons" aria-hidden="true">
          <span class="ghost in" style="width: 42%"></span>
          <span class="ghost in" style="width: 58%"></span>
          <span class="ghost out" style="width: 36%"></span>
          <span class="ghost in" style="width: 48%"></span>
          <span class="ghost out" style="width: 62%"></span>
        </div>

        <!-- ---------------------------------------------------- empty -->
        <div v-else-if="!messages.length" class="uc-empty">
          <div class="empty-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          </div>
          <strong>No messages yet</strong>
          <span>Say hello — messages, pictures and voice notes.</span>
        </div>
      </div>
    </div>

    <!-- ------------------------------------------------ jump to bottom -->
    <transition name="fab">
      <button
        v-if="!atBottom"
        type="button"
        class="jump"
        :class="{ pinged: missedCount > 0 }"
        :aria-label="missedCount > 0 ? `${missedCount} new messages — jump to the latest` : 'Jump to the latest message'"
        @click="scrollToBottom(true)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        <span v-if="missedCount > 0">{{ missedCount > 99 ? '99+' : missedCount }} new</span>
      </button>
    </transition>
  </div>
</template>

<script setup lang="ts">
/**
 * The transcript.
 *
 * It owns the scrolling — the scroller element, "am I at the bottom", keeping a
 * reading position while older messages are prepended, and staying pinned while
 * a picture finishes loading. The page owns the data and tells this component
 * what to do through the exposed methods; this component tells the page when the
 * user has reached the top or left the bottom.
 *
 * Grouping lives here too, because it is presentation: a run is consecutive
 * messages from one person inside five minutes, and a run is what turns forty
 * bubbles into eight readable clusters.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import MessageBubble, { type SendStatus } from './MessageBubble.vue';
import { dayLabel } from './roomDisplay';
import type { ChatMessage } from '@/services/userchat.service';

const props = defineProps<{
  /** Already filtered (no tombstones) and sorted oldest-first by the page. */
  messages: ChatMessage[];
  userId: string;
  /** A one-to-one room needs no sender names — there are only two people, and
   *  the side of the screen already says which one. */
  isDirect: boolean;
  canModerate: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  loading: boolean;
  highlighted: string;
  /** Messages that arrived while the user was reading further up. */
  missedCount: number;
  /**
   * Epoch milliseconds: the newest moment any *other* member has read up to.
   * Anything of mine at or before it has been seen, which is the double tick.
   * 0 when unknown, which renders as a single tick — under-claiming is right
   * here, since "read" is a statement about another person.
   */
  readCutoff: number;
}>();

const emit = defineEmits<{
  (e: 'scroll-top'): void;
  (e: 'at-bottom', value: boolean): void;
  (e: 'menu', message: ChatMessage, event: MouseEvent): void;
  (e: 'retry', message: ChatMessage): void;
  (e: 'jump', messageId: string): void;
  (e: 'lightbox', url: string): void;
  (e: 'reply', message: ChatMessage): void;
  (e: 'remove', message: ChatMessage): void;
}>();

const scroller = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
const atBottom = ref(true);

/** A gap of more than this restarts the run, so a reply hours later is
 *  attributed rather than looking like part of the earlier burst. */
const RUN_GAP_MS = 5 * 60 * 1000;
/** How close to the bottom still counts as "at the bottom". Roughly one bubble:
 *  small enough that scrolling up to read stops the auto-follow, large enough
 *  that a stray wheel click does not. */
const BOTTOM_SLACK = 90;
/** How close to the top triggers the older page. */
const TOP_TRIGGER = 140;

interface Entry {
  message: ChatMessage;
  mine: boolean;
  firstOfRun: boolean;
  lastOfRun: boolean;
  showSender: boolean;
}

/**
 * Messages → runs → days, in one pass.
 *
 * A system message is never part of a run in either direction: it is the room
 * narrating itself, and letting it join a run would attach somebody's name to
 * "Sara left the conversation".
 */
const groups = computed(() => {
  const list = props.messages;
  const out: Array<{ key: string; label: string; items: Entry[] }> = [];

  for (let i = 0; i < list.length; i++) {
    const message = list[i];
    const previous = list[i - 1];
    const next = list[i + 1];
    const mine = message.sender_id === props.userId;

    const firstOfRun = startsRun(message, previous);
    const lastOfRun = !next || startsRun(next, message);

    const day = new Date(message.created_at || 0).toDateString();
    let group = out[out.length - 1];
    if (!group || group.key !== day) {
      group = { key: day, label: dayLabel(message.created_at), items: [] };
      out.push(group);
    }

    group.items.push({
      message,
      mine,
      firstOfRun,
      lastOfRun,
      // The name is only ever drawn on somebody else's first message in a run,
      // and never in a one-to-one room.
      showSender: firstOfRun && !mine && !props.isDirect && message.kind !== 'system',
    });
  }

  return out;
});

function startsRun(current: ChatMessage, previous?: ChatMessage) {
  if (!previous) return true;
  if (previous.kind === 'system' || current.kind === 'system') return true;
  if (previous.sender_id !== current.sender_id) return true;
  const gap = new Date(current.created_at || 0).getTime()
    - new Date(previous.created_at || 0).getTime();
  return gap > RUN_GAP_MS;
}

const byId = computed(() => {
  const map = new Map<string, ChatMessage>();
  for (const message of props.messages) map.set(message.message_id, message);
  return map;
});

function parentOf(message: ChatMessage) {
  if (!message.reply_to) return null;
  return byId.value.get(message.reply_to) || null;
}

/** What tick to draw. Only ever on your own messages — a read mark on somebody
 *  else's is meaningless, and a lot of chat apps get this wrong. */
function statusOf(message: ChatMessage, mine: boolean): SendStatus {
  if (!mine || message.kind === 'system') return 'none';
  if (message.pending) return 'sending';
  if (message.failed) return 'failed';
  const at = new Date(message.created_at || 0).getTime();
  if (props.readCutoff && at && at <= props.readCutoff) return 'read';
  return 'sent';
}

// ------------------------------------------------------------- scrolling

function onScroll() {
  const element = scroller.value;
  if (!element) return;

  const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
  const nowAtBottom = distance < BOTTOM_SLACK;
  if (nowAtBottom !== atBottom.value) {
    atBottom.value = nowAtBottom;
    emit('at-bottom', nowAtBottom);
  }

  if (element.scrollTop < TOP_TRIGGER && props.hasMore && !props.loadingOlder) {
    emit('scroll-top');
  }
}

function scrollToBottom(smooth = false) {
  const element = scroller.value;
  if (!element) return;
  element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  if (!atBottom.value) {
    atBottom.value = true;
    emit('at-bottom', true);
  }
}

/**
 * Hold the reading position across a prepend.
 *
 * Call before loading an older page, call the returned function after the DOM
 * has updated. Without it, prepending jumps the user to the top of the newly
 * loaded block, which on a long conversation means losing their place every
 * single time they scroll up.
 */
function captureScroll() {
  const element = scroller.value;
  const previousHeight = element?.scrollHeight || 0;
  const previousTop = element?.scrollTop || 0;
  return () => {
    const target = scroller.value;
    if (!target) return;
    target.scrollTop = target.scrollHeight - previousHeight + previousTop;
  };
}

function jumpTo(messageId: string) {
  const target = document.getElementById(`msg-${messageId}`);
  if (!target) return false;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

/**
 * Stay pinned to the bottom while the content grows underneath.
 *
 * Every picture in the thread changes height when it finishes loading, and a
 * voice note's waveform arrives a frame late. Without this the view drifts
 * upward by exactly the amount each one grew — which on a slow connection means
 * the transcript creeps away from the newest message while you are reading it.
 */
let observer: ResizeObserver | null = null;

onMounted(() => {
  scrollToBottom();
  if (typeof ResizeObserver === 'undefined' || !content.value) return;
  observer = new ResizeObserver(() => {
    if (atBottom.value) scrollToBottom();
  });
  observer.observe(content.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

defineExpose({ scrollToBottom, captureScroll, jumpTo });
</script>

<style scoped>
/* One gentle fade per room. The component is keyed on the room id by the page,
   so this fires exactly once when a conversation opens rather than on every
   incoming message — which is the difference between "the room settled in" and
   a transcript that twitches while you read it. */
.stream {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  animation: uc-settle 0.26s var(--uc-ease) both;
}
@keyframes uc-settle {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

.transcript {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* Momentum on iOS, and a scroll that does not chain to the page behind it. */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/*
  The transcript is centred and capped rather than full-bleed. On a 34" monitor a
  full-width thread puts the avatar at one edge and the timestamp at the other,
  and a bubble at 76% of 2000px is a line of text nobody can track back to the
  start of.
*/
.content {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 10px clamp(12px, 2vw, 28px) 18px;
  display: flex;
  flex-direction: column;
}

.day-group { display: flex; flex-direction: column; }

/* --------------------------------------------------------- day divider */
.day {
  position: sticky;
  top: 4px;
  z-index: 2;
  display: flex;
  justify-content: center;
  margin: 14px 0 10px;
  pointer-events: none;
}
.day span {
  padding: 4px 14px;
  border-radius: var(--uc-r-full);
  background: rgba(10, 12, 32, 0.78);
  backdrop-filter: var(--uc-blur);
  -webkit-backdrop-filter: var(--uc-blur);
  border: 1px solid var(--uc-border);
  color: var(--uc-text-muted);
  font-size: var(--uc-fs-xs);
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: 0 4px 14px rgba(4, 6, 20, 0.35);
}
/* The first divider in a thread does not need the gap above it. */
.day-group:first-of-type .day { margin-top: 4px; }

/* --------------------------------------------------------------- older */
.older { display: flex; justify-content: center; min-height: 4px; }
.older-btn {
  margin: 6px auto 12px;
  padding: 6px 16px;
  border: 1px solid var(--uc-border);
  border-radius: var(--uc-r-full);
  background: var(--uc-surface);
  color: var(--uc-text-muted);
  font: inherit;
  font-size: var(--uc-fs-sm);
  cursor: pointer;
  transition: background var(--uc-t-fast), color var(--uc-t-fast);
}
.older-btn:hover { background: var(--uc-surface-2); color: var(--uc-text); }

.older-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px auto 12px;
  font-size: var(--uc-fs-sm);
  color: var(--uc-text-dim);
}
.older-note.faint { opacity: 0.55; font-size: var(--uc-fs-xs); }

.uc-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid var(--uc-border-strong);
  border-top-color: var(--uc-brand-soft);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ----------------------------------------------------------- skeletons */
.skeletons { display: flex; flex-direction: column; gap: 10px; padding: 16px 0; }
.ghost {
  height: 38px;
  min-width: 120px;
  border-radius: var(--uc-r-lg);
  background: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0.04) 30%,
    rgba(255, 255, 255, 0.10) 50%,
    rgba(255, 255, 255, 0.04) 70%
  );
  background-size: 220% 100%;
  animation: shimmer 1.4s infinite;
}
.ghost.in { align-self: flex-start; border-bottom-left-radius: var(--uc-tail); margin-left: 35px; }
.ghost.out { align-self: flex-end; border-bottom-right-radius: var(--uc-tail); }
@keyframes shimmer { to { background-position: -220% 0; } }

/* --------------------------------------------------------------- empty */
.uc-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 50px 20px;
  text-align: center;
  color: var(--uc-text-dim);
  font-size: var(--uc-fs-sm);
}
.uc-empty-mark {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 6px;
  border-radius: 50%;
  background: var(--uc-surface);
  border: 1px solid var(--uc-border);
  color: rgba(129, 140, 248, 0.6);
}
.uc-empty strong { color: var(--uc-text-soft); font-size: var(--uc-fs-lg); font-weight: 600; }

/* ----------------------------------------------------- jump to bottom */
.jump {
  position: absolute;
  right: clamp(14px, 2vw, 26px);
  bottom: 14px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 13px;
  border: 1px solid var(--uc-border-strong);
  border-radius: var(--uc-r-full);
  background: rgba(16, 18, 44, 0.92);
  backdrop-filter: var(--uc-blur);
  -webkit-backdrop-filter: var(--uc-blur);
  color: var(--uc-text-soft);
  font: inherit;
  font-size: var(--uc-fs-sm);
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--uc-shadow);
  transition: transform var(--uc-t-fast), color var(--uc-t-fast);
}
.jump:hover { transform: translateY(-2px); color: var(--uc-text); }
.jump.pinged {
  background: var(--uc-brand-grad);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.5);
}

.fab-enter-active, .fab-leave-active { transition: opacity var(--uc-t-fast), transform var(--uc-t-fast); }
.fab-enter-from, .fab-leave-to { opacity: 0; transform: translateY(6px) scale(0.94); }

@media (max-width: 768px) {
  .content { padding: 8px 10px 14px; }
}
</style>
