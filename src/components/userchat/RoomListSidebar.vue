<template>
  <div class="uc-side">
    <header class="head">
      <div class="title-row">
        <!-- The way out of the feature — see the matching note in ChatHeader.
             It is here as well as in the thread because on a phone those are two
             separate screens and only one of them is ever on show. -->
        <button
          type="button"
          class="uc-icon-btn home"
          aria-label="Back to the dashboard"
          title="Back to the dashboard"
          @click="$emit('home')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 001 1h12a1 1 0 001-1V9.8"/><path d="M9.5 21v-6h5v6"/></svg>
        </button>

        <h1>
          Messages
          <span v-if="totalUnread > 0" class="total">{{ totalUnread > 99 ? '99+' : totalUnread }}</span>
        </h1>

        <div class="head-actions">
          <button
            type="button"
            class="uc-icon-btn"
            :class="{ on: soundEnabled }"
            :aria-label="soundEnabled ? 'Turn the chime off' : 'Turn the chime on'"
            :title="soundEnabled ? 'Chime on' : 'Chime off'"
            @click="$emit('toggle-sound')"
          >
            <svg v-if="soundEnabled" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.03v8.05A4.47 4.47 0 0016.5 12z"/></svg>
            <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm18.5-1.9L20.1 5.7 17.8 8l-2.3-2.3-1.4 1.4L16.4 9.4l-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4-2.3-2.3z"/></svg>
          </button>

          <button type="button" class="new-btn" @click="$emit('new-chat')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>New</span>
          </button>
        </div>
      </div>

      <div class="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.35-4.35"/></svg>
        <input
          :value="modelValue"
          type="text"
          placeholder="Search conversations…"
          aria-label="Search conversations"
          autocomplete="off"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="modelValue"
          type="button"
          class="clear"
          aria-label="Clear search"
          @click="$emit('update:modelValue', '')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
    </header>

    <div class="list uc-scroll">
      <template v-if="loading">
        <div v-for="n in 6" :key="n" class="skeleton" aria-hidden="true"></div>
        <p class="uc-sr-only">Loading your conversations</p>
      </template>

      <div v-else-if="!rooms.length && !modelValue" class="uc-empty">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
        <strong>No conversations yet</strong>
        <span>Start one with a classmate or a teacher — it is free with your account.</span>
        <button type="button" class="new-btn wide" @click="$emit('new-chat')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          <span>New message</span>
        </button>
      </div>

      <p v-else-if="!rooms.length" class="uc-empty terse">
        Nothing matches “{{ modelValue }}”.
      </p>

      <RoomListItem
        v-for="room in rooms"
        :key="room.room_id"
        :room="room"
        :user-id="userId"
        :active="room.room_id === activeRoomId"
        :online="room.room_id === activeRoomId && activeRoomOnline"
        @select="$emit('select-room', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The room list: search, the rows, and the two states that are not rows.
 *
 * Presentational — it is handed an already-filtered, already-sorted list and
 * reports what was clicked. Sorting and filtering stay in the page, because the
 * page is what knows about the active room and the store.
 */
import RoomListItem from './RoomListItem.vue';
import type { ChatRoom } from '@/services/userchat.service';

defineProps<{
  rooms: ChatRoom[];
  userId: string;
  activeRoomId: string;
  loading: boolean;
  soundEnabled: boolean;
  totalUnread: number;
  /** Whether anybody else is online in the room currently open. */
  activeRoomOnline: boolean;
  /** The search term, as `v-model`. */
  modelValue: string;
}>();

defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select-room', roomId: string): void;
  (e: 'new-chat'): void;
  (e: 'toggle-sound'): void;
  (e: 'home'): void;
}>();
</script>

<style scoped>
.uc-side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.head {
  flex: 0 0 auto;
  padding: 16px 14px 12px;
  border-bottom: 1px solid var(--uc-border);
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

h1 {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: var(--uc-fs-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--uc-text);
}

.home { flex: 0 0 34px; margin-left: -6px; }

.total {
  padding: 2px 8px;
  border-radius: var(--uc-r-full);
  background: var(--uc-brand-grad);
  color: #fff;
  font-size: var(--uc-fs-xs);
  font-weight: 700;
  line-height: 1.4;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.45);
}

.head-actions { display: flex; align-items: center; gap: 6px; }

.new-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 0;
  border-radius: var(--uc-r-full);
  background: var(--uc-brand-grad);
  color: #fff;
  font: inherit;
  font-size: var(--uc-fs-sm);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.38);
  transition: transform var(--uc-t-fast), box-shadow var(--uc-t-fast);
}
.new-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(102, 126, 234, 0.5); }
.new-btn:active { transform: none; }
.new-btn.wide { margin-top: 6px; }

.search { position: relative; display: flex; align-items: center; }
.search > svg { position: absolute; left: 12px; color: var(--uc-text-dim); pointer-events: none; }
.search input {
  width: 100%;
  padding: 9px 34px 9px 34px;
  font: inherit;
  font-size: var(--uc-fs-sm);
  color: var(--uc-text);
  border: 1px solid var(--uc-border);
  border-radius: var(--uc-r-full);
  background: var(--uc-surface);
  outline: none;
  transition: border-color var(--uc-t-fast), background var(--uc-t-fast);
}
.search input::placeholder { color: var(--uc-text-dim); }
.search input:focus {
  border-color: rgba(129, 140, 248, 0.5);
  background: var(--uc-surface-2);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.16);
}
.clear {
  position: absolute;
  right: 8px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: var(--uc-surface-2);
  color: var(--uc-text-muted);
  cursor: pointer;
}
.clear:hover { background: var(--uc-surface-3); color: var(--uc-text); }

.list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.skeleton {
  height: 62px;
  flex: 0 0 auto;
  border-radius: var(--uc-r-md);
  background: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0.04) 30%,
    rgba(255, 255, 255, 0.10) 50%,
    rgba(255, 255, 255, 0.04) 70%
  );
  background-size: 220% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { to { background-position: -220% 0; } }

.uc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 40px 22px;
  text-align: center;
  font-size: var(--uc-fs-sm);
  color: var(--uc-text-dim);
  line-height: 1.55;
}
.uc-empty svg { color: rgba(129, 140, 248, 0.45); margin-bottom: 4px; }
.uc-empty strong { color: var(--uc-text-soft); font-size: var(--uc-fs-lg); font-weight: 600; }
.uc-empty.terse { padding: 30px 18px; }

.uc-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
