<template>
  <header class="head">
    <button type="button" class="back uc-icon-btn" aria-label="Back to conversations" @click="$emit('back')">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
    </button>

    <button type="button" class="identity" :aria-label="`Details for ${name}`" @click="$emit('toggle-info')">
      <ChatAvatar
        :user-id="otherPartyId(room, userId)"
        :name="name"
        :lookup="room.kind === 'direct'"
        :online="otherOnline"
        size="md"
      />
      <span class="titles">
        <span class="name">{{ name }}</span>
        <span class="uc-status">
          <!-- Typing wins over presence: it is the more specific and the more
               perishable of the two, and showing "Online" while somebody is
               visibly composing is a wasted line. -->
          <span v-if="typingLabel" class="typing">
            <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
            {{ typingLabel }}
          </span>
          <template v-else-if="room.kind === 'direct'">
            <span v-if="otherOnline" class="online">Online</span>
            <span v-else>{{ room.topic || 'Direct message' }}</span>
          </template>
          <template v-else>
            {{ memberCount }} {{ memberCount === 1 ? 'person' : 'people' }}
            <span v-if="onlineCount > 0" class="online"> · {{ onlineCount }} online</span>
          </template>
        </span>
      </span>
    </button>

    <div class="uc-actions">
      <!--
        The way out of the feature.

        The Messages page is the only screen in the app that takes the full
        viewport height and hides the support widget, and on a phone the side
        nav is a drawer behind a button this page's header sits next to. Without
        an explicit exit, somebody deep in a conversation has the browser's back
        button and nothing else — and back from here is whatever they were
        reading before, not the app.
      -->
      <button
        type="button"
        class="uc-icon-btn home"
        aria-label="Back to the dashboard"
        title="Back to the dashboard"
        @click="$emit('home')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 001 1h12a1 1 0 001-1V9.8"/><path d="M9.5 21v-6h5v6"/></svg>
      </button>

      <span v-if="room.muted" class="muted-chip" title="Notifications are muted for this conversation">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm18.5-1.9L20.1 5.7 17.8 8l-2.3-2.3-1.4 1.4L16.4 9.4l-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4-2.3-2.3z"/></svg>
        <span>Muted</span>
      </span>

      <button
        type="button"
        class="uc-icon-btn"
        :class="{ on: infoOpen }"
        :aria-label="infoOpen ? 'Hide details' : 'Show details'"
        :aria-expanded="infoOpen"
        @click="$emit('toggle-info')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import ChatAvatar from './ChatAvatar.vue';
import { displayName, otherPartyId } from './roomDisplay';
import type { ChatRoom } from '@/services/userchat.service';

const props = defineProps<{
  room: ChatRoom;
  userId: string;
  memberCount: number;
  /** Other people online in this room — the signed-in user is excluded by the
   *  caller, so `1 online` never means "you". */
  onlineCount: number;
  otherOnline: boolean;
  typingLabel: string;
  infoOpen: boolean;
}>();

defineEmits<{ (e: 'back'): void; (e: 'toggle-info'): void; (e: 'home'): void }>();

const name = computed(() => displayName(props.room, props.userId));
</script>

<style scoped>
.head {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: rgba(10, 12, 30, 0.62);
  backdrop-filter: var(--uc-blur-strong);
  -webkit-backdrop-filter: var(--uc-blur-strong);
  border-bottom: 1px solid var(--uc-border);
  /* Above the sticky day dividers in the transcript, which scroll up under it. */
  z-index: 5;
}

/* A brand hairline along the bottom edge, brightest under the avatar and fading
   out across the width. It is what stops the header reading as a grey bar bolted
   on top of the conversation. */
.head::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(102, 126, 234, 0.55) 0%,
    rgba(118, 75, 162, 0.35) 38%,
    transparent 78%
  );
  pointer-events: none;
}

/* Only a phone gets a back arrow: everywhere else the room list is still there
   to the left, so an arrow would point at something already on screen. */
.back { display: none; }

/*
  The whole identity block is the details toggle, not just the ⓘ button. It is
  the largest and most obvious target in the header and it is what people reach
  for when they want to know who they are talking to.
*/
.identity {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 5px 8px;
  margin: -5px -8px;
  border: 0;
  border-radius: var(--uc-r-md);
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--uc-t-fast);
}
.identity:hover { background: var(--uc-surface); }

.titles { min-width: 0; display: flex; flex-direction: column; gap: 1px; }

.name {
  font-size: var(--uc-fs-lg);
  font-weight: 650;
  color: var(--uc-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.uc-status {
  font-size: var(--uc-fs-xs);
  color: var(--uc-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.online { color: var(--uc-online); font-weight: 600; }

.typing { display: inline-flex; align-items: center; gap: 6px; color: var(--uc-brand-soft); font-weight: 600; }
.dots { display: inline-flex; gap: 2px; }
.dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  animation: blink 1.2s infinite;
}
.dots i:nth-child(2) { animation-delay: 0.18s; }
.dots i:nth-child(3) { animation-delay: 0.36s; }
@keyframes blink { 0%, 60%, 100% { opacity: 0.28; } 30% { opacity: 1; } }

.uc-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }

.muted-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: var(--uc-r-full);
  background: var(--uc-surface);
  border: 1px solid var(--uc-border);
  color: var(--uc-text-dim);
  font-size: var(--uc-fs-xs);
  font-weight: 600;
}

/* On a phone the header is competing with the back arrow and the details
   button for a 380px row, so the muted marker keeps its icon and drops its
   label. */
@media (max-width: 768px) {
  .head { padding: 8px 10px; }
  .back { display: grid; }
  .muted-chip { padding: 5px; }
  .muted-chip span { display: none; }
}
</style>
