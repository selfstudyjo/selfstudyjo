<template>
  <button
    type="button"
    :class="['room', { on: active, unread: unreadCount > 0 }]"
    :aria-current="active ? 'true' : undefined"
    @click="$emit('select', room.room_id)"
  >
    <ChatAvatar
      class="room-avatar"
      :user-id="otherPartyId(room, userId)"
      :name="name"
      :lookup="room.kind === 'direct'"
      :online="online"
      size="lg"
    />

    <span class="room-name">{{ name }}</span>
    <span class="room-when">{{ shortWhen(room.last_message_at) }}</span>

    <span class="room-preview">
      <span v-if="room.last_message_kind === 'image'" class="kind" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-6 6"/></svg>
      </span>
      <span v-else-if="room.last_message_kind === 'audio'" class="kind" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11z"/></svg>
      </span>
      <span class="preview-text">
        <template v-if="room.last_message_sender && room.kind !== 'direct'">{{ room.last_message_sender }}: </template>{{ previewText }}
      </span>
    </span>

    <span class="room-tail">
      <span v-if="room.muted" class="muted-icon" title="Muted" aria-label="Muted">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm18.5-1.9L20.1 5.7 17.8 8l-2.3-2.3-1.4 1.4L16.4 9.4l-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4-2.3-2.3z"/></svg>
      </span>
      <span v-if="unreadCount > 0" class="room-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import ChatAvatar from './ChatAvatar.vue';
import { displayName, otherPartyId, shortWhen } from './roomDisplay';
import type { ChatRoom } from '@/services/userchat.service';

const props = defineProps<{
  room: ChatRoom;
  userId: string;
  active: boolean;
  /** Only ever true for the room being viewed — presence is per-room and the
   *  list endpoint does not carry it, so every other row is simply not marked
   *  rather than marked offline. Claiming somebody is offline when we have not
   *  asked is worse than saying nothing. */
  online: boolean;
}>();

defineEmits<{ (e: 'select', roomId: string): void }>();

const name = computed(() => displayName(props.room, props.userId));
const unreadCount = computed(() => props.room.unread || 0);

const previewText = computed(() => {
  const value = props.room.last_message_preview;
  if (value) return value;
  if (props.room.last_message_kind === 'image') return 'Picture';
  if (props.room.last_message_kind === 'audio') return 'Voice note';
  return 'No messages yet';
});
</script>

<style scoped>
/*
  An explicit 3-column grid rather than nested flex rows.

  The nested version put the name, the time, the preview and the badge inside two
  `<span>`s that were themselves flex containers — and inside a `<button>`, whose
  children browsers lay out with their own rules. The result was a row whose
  parts could ride over the avatar once anything was long enough to wrap.

  A grid states the shape instead of deriving it: the avatar owns column 1 across
  both rows, the name and time share row 1, the preview and the badge share row 2.
  Nothing can land in the avatar's column, whatever length the text is.

      ┌────────┬──────────────────────┬─────────┐
      │        │ name                 │ time    │
      │ avatar ├──────────────────────┼─────────┤
      │        │ preview              │ badge   │
      └────────┴──────────────────────┴─────────┘
*/
.room {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    "avatar name    when"
    "avatar preview tail";
  align-items: center;
  column-gap: 12px;
  row-gap: 3px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--uc-r-md);
  background: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: var(--uc-text);
  transition: background var(--uc-t-fast), border-color var(--uc-t-fast);
}

.room:hover { background: var(--uc-surface); }

.room.on {
  background: linear-gradient(90deg, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.22), rgb(var(--sfs-accent-2-rgb, 118 75 162) / 0.1));
  border-color: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.3);
}
/* A gradient rail rather than a flat left border: it survives the rounded
   corner, where `border-left` on a 16px radius shows as two stubby ticks. */
.room.on::before {
  content: '';
  position: absolute;
  left: 0;
  top: 14%;
  bottom: 14%;
  width: 3px;
  border-radius: var(--uc-r-full);
  background: var(--uc-brand-grad);
}

.room-avatar { grid-area: avatar; }

.room-name {
  grid-area: name;
  min-width: 0;
  font-size: var(--uc-fs-md);
  font-weight: 500;
  color: var(--uc-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room.on .room-name { color: var(--uc-text); }
.room.unread .room-name { color: var(--uc-text); font-weight: 700; }

.room-when {
  grid-area: when;
  justify-self: end;
  font-size: var(--uc-fs-xs);
  color: var(--uc-text-dim);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.room.unread .room-when { color: var(--uc-brand-soft); font-weight: 600; }

.room-preview {
  grid-area: preview;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: var(--uc-fs-sm);
  color: var(--uc-text-dim);
}
.room.unread .room-preview { color: var(--uc-text-muted); }
.kind { display: inline-flex; flex: 0 0 auto; opacity: 0.85; }
.preview-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.room-tail {
  grid-area: tail;
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 6px;
}

.room-badge {
  min-width: 20px;
  padding: 2px 6px;
  border-radius: var(--uc-r-full);
  background: var(--uc-brand-grad);
  color: var(--sfs-text, #fff);
  font-size: var(--uc-fs-xs);
  font-weight: 700;
  text-align: center;
  line-height: 1.3;
  box-shadow: 0 2px 10px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45);
}

.muted-icon { display: inline-flex; color: var(--uc-text-dim); }

/* Roomier rows once the list has the whole screen to itself. */
@media (max-width: 768px) {
  .room { padding: 12px; }
  .room-name { font-size: var(--uc-fs-lg); }
  .room-preview { font-size: var(--uc-fs-md); }
}
</style>
