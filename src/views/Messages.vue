<template>
  <div class="messages" :class="{ 'thread-open': !!activeRoom }">
    <!-- ------------------------------------------------------- room list -->
    <aside class="rooms">
      <header class="rooms-head">
        <div class="title-row">
          <h1>Messages</h1>
          <div class="head-actions">
            <button
              type="button"
              class="icon-btn"
              :aria-label="chatStore.soundEnabled ? 'Turn the chime off' : 'Turn the chime on'"
              :title="chatStore.soundEnabled ? 'Chime on' : 'Chime off'"
              @click="chatStore.setSoundEnabled(!chatStore.soundEnabled)"
            >
              <svg v-if="chatStore.soundEnabled" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.03v8.05A4.47 4.47 0 0016.5 12z"/></svg>
              <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm18.5-1.9L20.1 5.7 17.8 8l-2.3-2.3-1.4 1.4L16.4 9.4l-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4-2.3-2.3z"/></svg>
            </button>
            <button type="button" class="new-btn" @click="showNewChat = true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              New
            </button>
          </div>
        </div>
        <div class="search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.35-4.35"/></svg>
          <input v-model="roomFilter" type="text" placeholder="Search conversations…" aria-label="Search conversations" />
        </div>
      </header>

      <div class="rooms-list">
        <template v-if="loadingRooms">
          <div v-for="n in 5" :key="n" class="room-skeleton"></div>
        </template>

        <p v-else-if="!filteredRooms.length && !roomFilter" class="rooms-empty">
          <strong>No conversations yet</strong>
          Start one with a classmate or a teacher — it is free with your account.
        </p>
        <p v-else-if="!filteredRooms.length" class="rooms-empty">
          Nothing matches “{{ roomFilter }}”.
        </p>

        <button
          v-for="room in filteredRooms"
          :key="room.room_id"
          type="button"
          :class="['room', { on: room.room_id === activeRoomId, unread: (room.unread || 0) > 0 }]"
          @click="openRoom(room.room_id)"
        >
          <ChatAvatar
            class="room-avatar"
            :user-id="otherPartyId(room)"
            :name="displayName(room)"
            :lookup="room.kind === 'direct'"
            :online="isRoomOnline(room)"
            size="lg"
          />
          <span class="room-name">{{ displayName(room) }}</span>
          <span class="room-when">{{ shortWhen(room.last_message_at) }}</span>
          <span class="room-preview">
            <template v-if="room.last_message_kind === 'image'">📷 </template>
            <template v-else-if="room.last_message_kind === 'audio'">🎤 </template>
            <template v-if="room.last_message_sender && room.kind !== 'direct'">{{ room.last_message_sender }}: </template>{{ room.last_message_preview || 'No messages yet' }}
          </span>
          <span class="room-tail">
            <span v-if="room.muted" class="muted-icon" title="Muted">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm18.5-1.9L20.1 5.7 17.8 8l-2.3-2.3-1.4 1.4L16.4 9.4l-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4-2.3-2.3z"/></svg>
            </span>
            <span v-if="(room.unread || 0) > 0" class="room-badge">
              {{ (room.unread || 0) > 99 ? '99+' : room.unread }}
            </span>
          </span>
        </button>
      </div>
    </aside>

    <!-- ---------------------------------------------------------- thread -->
    <section class="thread">
      <div v-if="!activeRoom" class="placeholder">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
        <h2>Pick a conversation</h2>
        <p>Or start a new one. Messages, pictures and voice notes, free with your account.</p>
      </div>

      <template v-else>
        <header class="thread-head">
          <button type="button" class="back" aria-label="Back to conversations" @click="closeRoom">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <ChatAvatar
            :user-id="otherPartyId(activeRoom)"
            :name="displayName(activeRoom)"
            :lookup="activeRoom.kind === 'direct'"
            :online="otherOnline"
            size="md"
          />
          <div class="thread-title">
            <h2>{{ displayName(activeRoom) }}</h2>
            <p>
              <span v-if="typingLabel" class="typing">{{ typingLabel }}</span>
              <span v-else-if="activeRoom.kind === 'direct'">
                {{ otherOnline ? 'Online' : (activeRoom.topic || 'Direct message') }}
              </span>
              <span v-else>
                {{ members.length }} {{ members.length === 1 ? 'person' : 'people' }}
                <template v-if="onlineCount > 0"> · {{ onlineCount }} online</template>
              </span>
            </p>
          </div>
          <button
            type="button"
            class="icon-btn"
            :aria-label="showInfo ? 'Hide details' : 'Show details'"
            @click="showInfo = !showInfo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
          </button>
        </header>

        <div ref="scroller" class="transcript" @scroll="onScroll">
          <div v-if="loadingOlder" class="loading-older">Loading earlier messages…</div>
          <button
            v-else-if="hasMore"
            type="button"
            class="load-older"
            @click="loadOlder"
          >Load earlier messages</button>

          <template v-for="(message, index) in visibleMessages" :key="message.message_id">
            <div v-if="showDayDivider(index)" class="day">
              <span>{{ dayLabel(message.created_at) }}</span>
            </div>
            <MessageBubble
              :id="`msg-${message.message_id}`"
              :message="message"
              :mine="message.sender_id === userId"
              :first-of-run="isFirstOfRun(index)"
              :user-id="userId"
              :reply-to="parentOf(message)"
              :can-moderate="canModerate"
              :class="{ highlighted: highlighted === message.message_id }"
              @menu="openMenu"
              @retry="retrySend"
              @jump="jumpTo"
              @lightbox="lightbox = $event"
              @reply="startReplyTo"
              @remove="confirmDeleteMessage"
            />
          </template>

          <p v-if="!visibleMessages.length && !loadingMessages" class="thread-empty">
            No messages yet. Say hello.
          </p>
        </div>

        <button v-if="!atBottom" type="button" class="jump-bottom" @click="scrollToBottom(true)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          <span v-if="missedWhileScrolled > 0">{{ missedWhileScrolled }} new</span>
        </button>

        <ChatComposer
          ref="composer"
          :reply-to="replyTo"
          :pending="pendingAttachment"
          :pending-preview="pendingPreview"
          :placeholder="`Message ${displayName(activeRoom)}…`"
          @send="onSend"
          @upload="onUpload"
          @typing="onTyping"
          @cancel-reply="replyTo = null"
          @discard="discardAttachment"
        />
      </template>
    </section>

    <RoomInfoPanel
      v-if="activeRoom && showInfo"
      :room="activeRoom"
      :members="members"
      :user-id="userId"
      :my-role="activeRoom.my_role || 'member'"
      :online-ids="onlineIds"
      :title="displayName(activeRoom)"
      @close="showInfo = false"
      @mute="setMuted"
      @add-member="showAddMember = true"
      @role="changeRole"
      @remove="removeMember"
      @leave="confirmLeave"
      @delete="confirmDelete"
      @rename="renameRoom"
    />

    <NewChatDialog
      v-if="showNewChat"
      ref="newChatDialog"
      :current-user-id="userId"
      @close="showNewChat = false"
      @direct="startDirect"
      @group="createGroup"
    />

    <NewChatDialog
      v-if="showAddMember"
      ref="addMemberDialog"
      :current-user-id="userId"
      @close="showAddMember = false"
      @direct="addExistingMember"
      @group="addSeveralMembers"
    />

    <!-- Message context menu -->
    <div
      v-if="menu.open"
      class="menu-backdrop"
      @click="menu.open = false"
      @contextmenu.prevent="menu.open = false"
    >
      <ul class="menu" :style="{ top: `${menu.y}px`, left: `${menu.x}px` }" @click.stop>
        <li><button type="button" @click="startReply">Reply</button></li>
        <li v-if="menu.message?.kind === 'text'">
          <button type="button" @click="copyText">Copy text</button>
        </li>
        <li v-if="canEdit(menu.message)">
          <button type="button" @click="startEdit">Edit</button>
        </li>
        <li v-if="canDelete(menu.message)">
          <button type="button" class="danger" @click="deleteMessage">Delete</button>
        </li>
      </ul>
    </div>

    <!-- Inline edit -->
    <div v-if="editing" class="backdrop" @click.self="editing = null">
      <div class="edit-dialog" role="dialog" aria-modal="true" aria-label="Edit message">
        <h3>Edit message</h3>
        <textarea v-model="editDraft" rows="4" aria-label="Message text"></textarea>
        <div class="edit-actions">
          <button type="button" class="ghost" @click="editing = null">Cancel</button>
          <button type="button" class="primary" :disabled="!editDraft.trim()" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>

    <!-- Full-size picture -->
    <div v-if="lightbox" class="lightbox" @click="lightbox = ''">
      <img :src="lightbox" alt="" />
    </div>

    <p v-if="banner" class="banner" role="status">{{ banner }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ChatAvatar from '@/components/userchat/ChatAvatar.vue';
import ChatComposer, { type PendingAttachment } from '@/components/userchat/ChatComposer.vue';
import MessageBubble from '@/components/userchat/MessageBubble.vue';
import NewChatDialog from '@/components/userchat/NewChatDialog.vue';
import RoomInfoPanel from '@/components/userchat/RoomInfoPanel.vue';
import { ApiError } from '@/services/api';
import { userChatService, type ChatMember, type ChatMessage,
         type ChatRoom, type Participant } from '@/services/userchat.service';
import { useAuthStore } from '@/store/auth';
import { useUserChatStore } from '@/store/userchat';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const chatStore = useUserChatStore();

const userId = computed(() => String(authStore.user?.id || ''));
const username = computed(() => String(authStore.user?.username || ''));

const rooms = ref<ChatRoom[]>([]);
const loadingRooms = ref(true);
const roomFilter = ref('');

const activeRoomId = ref('');
const activeRoom = ref<ChatRoom | null>(null);
const members = ref<ChatMember[]>([]);
const messages = ref<ChatMessage[]>([]);
const participants = ref<Participant[]>([]);
const loadingMessages = ref(false);
const loadingOlder = ref(false);
const hasMore = ref(false);
const nextBefore = ref('');

const showInfo = ref(false);
const showNewChat = ref(false);
const showAddMember = ref(false);
const newChatDialog = ref<any>(null);
const addMemberDialog = ref<any>(null);
const composer = ref<any>(null);
const scroller = ref<HTMLElement | null>(null);
const atBottom = ref(true);
const missedWhileScrolled = ref(0);
const highlighted = ref('');
const lightbox = ref('');
const banner = ref('');
const replyTo = ref<ChatMessage | null>(null);
const editing = ref<ChatMessage | null>(null);
const editDraft = ref('');

const pendingAttachment = ref<PendingAttachment | null>(null);
const pendingPreview = ref('');

const menu = ref<{ open: boolean; x: number; y: number; message: ChatMessage | null }>(
  { open: false, x: 0, y: 0, message: null });

// -------------------------------------------------------------- rendering

/** A direct room has no name of its own — it is rendered as the other person,
 *  which is why the member list rides along on every room in the list payload. */
function displayName(room: ChatRoom): string {
  if (room.kind !== 'direct') return room.name || 'Group';
  const other = (room.members || []).find(m => m.user_id !== userId.value);
  return other?.username || other?.full_name || 'Conversation';
}

/**
 * Whose face to show on a room.
 *
 * A one-to-one conversation is the *other person*, so their id drives both the
 * avatar lookup and the fallback colour. A group has no single face, so it gets
 * the room id — which keeps its colour stable across renders — with
 * `:lookup="false"`, because a room id is not a user and asking app 13 about it
 * would cache a miss for ever.
 */
function otherPartyId(room: ChatRoom | null): string {
  if (!room) return '';
  if (room.kind !== 'direct') return room.room_id;
  const other = (room.members || []).find(m => m.user_id !== userId.value);
  return other?.user_id || room.room_id;
}

/** Whether anybody else in this room is currently online.
 *
 *  Only known for the room being viewed — presence is per-room and the list
 *  endpoint does not carry it, so every other row is simply not marked rather
 *  than marked offline. Claiming somebody is offline when we have not asked is
 *  worse than saying nothing. */
function isRoomOnline(room: ChatRoom): boolean {
  if (room.room_id !== activeRoomId.value) return false;
  return onlineCount.value > 0;
}

function shortWhen(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (now.getTime() - date.getTime() < 7 * 86400000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function dayLabel(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

const filteredRooms = computed(() => {
  const term = roomFilter.value.trim().toLowerCase();
  const list = [...rooms.value].sort((a, b) =>
    String(b.last_message_at || b.created_at || '').localeCompare(
      String(a.last_message_at || a.created_at || '')));
  if (!term) return list;
  return list.filter(room =>
    displayName(room).toLowerCase().includes(term)
    || (room.last_message_preview || '').toLowerCase().includes(term)
    || (room.topic || '').toLowerCase().includes(term));
});

const visibleMessages = computed(() =>
  messages.value.filter(m => !m.deleted));

function isFirstOfRun(index: number) {
  const current = visibleMessages.value[index];
  const previous = visibleMessages.value[index - 1];
  if (!previous || previous.sender_id !== current.sender_id) return true;
  if (previous.kind === 'system' || current.kind === 'system') return true;
  // A gap of more than five minutes restarts the run, so a reply hours later is
  // attributed rather than looking like part of the earlier burst.
  const gap = new Date(current.created_at || 0).getTime()
    - new Date(previous.created_at || 0).getTime();
  return gap > 5 * 60 * 1000;
}

function showDayDivider(index: number) {
  const current = visibleMessages.value[index];
  const previous = visibleMessages.value[index - 1];
  if (!current?.created_at) return false;
  if (!previous?.created_at) return true;
  return new Date(current.created_at).toDateString()
    !== new Date(previous.created_at).toDateString();
}

function parentOf(message: ChatMessage) {
  if (!message.reply_to) return null;
  return messages.value.find(m => m.message_id === message.reply_to) || null;
}

/** Owner or admin of the open room — mirrors `can_administer` on the backend, and
 *  is what decides whether the delete button appears on somebody else's message. */
const canModerate = computed(() => {
  const role = activeRoom.value?.my_role;
  return role === 'owner' || role === 'admin';
});

const onlineIds = computed(() =>
  new Set(participants.value.filter(p => p.idle_seconds < 30).map(p => p.user_id)));

const onlineCount = computed(() =>
  [...onlineIds.value].filter(id => id !== userId.value).length);

const otherOnline = computed(() => {
  const other = (activeRoom.value?.members || []).find(m => m.user_id !== userId.value);
  return other ? onlineIds.value.has(other.user_id) : false;
});

const typingLabel = computed(() => {
  const names = participants.value
    .filter(p => p.typing && p.user_id !== userId.value)
    .map(p => p.username || 'Someone');
  if (!names.length) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
});

// ------------------------------------------------------------------ rooms

async function loadRooms() {
  if (!userId.value) return;
  loadingRooms.value = true;
  try {
    const data = await userChatService.listRooms(userId.value);
    rooms.value = data.results || [];
  } catch (error: any) {
    flash(error?.message || 'Could not load your conversations.');
  } finally {
    loadingRooms.value = false;
  }
}

async function openRoom(roomId: string) {
  if (!roomId || roomId === activeRoomId.value) return;
  stopPolling();
  activeRoomId.value = roomId;
  messages.value = [];
  participants.value = [];
  replyTo.value = null;
  discardAttachment();
  hasMore.value = false;
  nextBefore.value = '';
  missedWhileScrolled.value = 0;
  atBottom.value = true;
  loadingMessages.value = true;

  // The URL is the source of truth for which room is open, so a refresh and a
  // shared link both land in the right place.
  if (route.params.roomId !== roomId) {
    router.replace({ name: 'MessageRoom', params: { roomId } });
  }

  try {
    const [room, page] = await Promise.all([
      userChatService.getRoom(userId.value, roomId),
      userChatService.listMessages(userId.value, roomId, { limit: 50 }),
    ]);
    activeRoom.value = room;
    members.value = room.members || [];
    participants.value = room.participants || [];
    messages.value = page.messages || [];
    hasMore.value = page.has_more;
    nextBefore.value = page.next_before;
    since = page.at;

    chatStore.setActiveRoom(roomId);
    await nextTick();
    scrollToBottom();
    markRead();
    startPolling();
    composer.value?.focus();
  } catch (error: any) {
    if (error instanceof ApiError && error.status === 404) {
      flash('That conversation is not available.');
      closeRoom();
    } else {
      flash(error?.message || 'Could not open that conversation.');
    }
  } finally {
    loadingMessages.value = false;
  }
}

function closeRoom() {
  stopPolling();
  if (activeRoomId.value) {
    userChatService.leaveLive(userId.value, activeRoomId.value);
  }
  activeRoomId.value = '';
  activeRoom.value = null;
  messages.value = [];
  chatStore.setActiveRoom('');
  if (route.name === 'MessageRoom') router.replace({ name: 'Messages' });
}

async function loadOlder() {
  if (!activeRoomId.value || !nextBefore.value || loadingOlder.value) return;
  loadingOlder.value = true;
  const element = scroller.value;
  const previousHeight = element?.scrollHeight || 0;
  try {
    const page = await userChatService.listMessages(userId.value, activeRoomId.value,
                                                    { limit: 50, before: nextBefore.value });
    messages.value = [...(page.messages || []), ...messages.value];
    hasMore.value = page.has_more;
    nextBefore.value = page.next_before;
    await nextTick();
    // Hold the reading position. Prepending without this jumps the user to the
    // top of the newly-loaded block, which on a long conversation means losing
    // their place every time they scroll up.
    if (element) element.scrollTop = element.scrollHeight - previousHeight;
  } catch (error: any) {
    flash(error?.message || 'Could not load earlier messages.');
  } finally {
    loadingOlder.value = false;
  }
}

// ------------------------------------------------------------------- live

let poller: number | null = null;
let since = '';
let typing = false;

function startPolling() {
  stopPolling();
  poller = window.setInterval(tick, document.hidden ? 8000 : 2500);
}

function stopPolling() {
  if (poller) window.clearInterval(poller);
  poller = null;
}

async function tick() {
  const roomId = activeRoomId.value;
  if (!roomId) return;
  let data;
  try {
    data = await userChatService.poll(userId.value, username.value, roomId,
                                      { since, typing });
  } catch (error) {
    // A 403 or 404 mid-conversation is access being revoked while the room is
    // open, not a hiccup. Stop rather than retrying forever against a room that
    // is no longer ours.
    flash('You no longer have access to this conversation.');
    closeRoom();
    await loadRooms();
    return;
  }
  if (!data) return;

  since = data.at;
  participants.value = data.participants || [];
  applyIncoming(data.messages || []);
}

function applyIncoming(incoming: ChatMessage[]) {
  if (!incoming.length) return;
  const byId = new Map(messages.value.map(m => [m.message_id, m]));
  let arrived = 0;

  for (const message of incoming) {
    const existing = byId.get(message.message_id);
    if (message.deleted) {
      if (existing) existing.deleted = true;
      continue;
    }
    if (existing) {
      // Merge rather than replace, so a locally-pending bubble that the server
      // has now confirmed loses its "sending" state instead of being duplicated.
      Object.assign(existing, message, { pending: false, failed: false });
      continue;
    }
    byId.set(message.message_id, message);
    messages.value.push(message);
    if (message.sender_id !== userId.value && message.kind !== 'system') arrived++;
  }

  messages.value.sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || '')));

  if (arrived) {
    if (atBottom.value) {
      nextTick(() => {
        scrollToBottom();
        markRead();
      });
    } else {
      missedWhileScrolled.value += arrived;
    }
  }
}

function onTyping(value: boolean) {
  typing = value;
}

// --------------------------------------------------------------- sending

async function onSend(payload: { text: string }) {
  const room = activeRoom.value;
  if (!room) return;

  const attachment = pendingAttachment.value;
  if (attachment && attachment.state !== 'ready') return;

  const messageId = userChatService.newMessageId();
  // The bubble appears now, before the network. The id is minted here and the
  // backend adopts it, so the retry below is an idempotent update rather than a
  // second copy of the same message.
  const optimistic: ChatMessage = {
    message_id: messageId,
    room_id: room.room_id,
    kind: (attachment?.kind || 'text') as any,
    text: payload.text,
    attachment_id: attachment?.attachmentId || '',
    reply_to: replyTo.value?.message_id || '',
    sender_id: userId.value,
    sender_username: username.value,
    edited: false,
    created_at: new Date().toISOString(),
    pending: true,
  };
  messages.value.push(optimistic);
  const replyingTo = replyTo.value?.message_id || '';
  replyTo.value = null;
  const sending = attachment;
  discardAttachment(false);

  await nextTick();
  scrollToBottom(true);

  try {
    const saved = await userChatService.send(userId.value, username.value, room.room_id, {
      messageId,
      text: payload.text,
      kind: (sending?.kind || 'text') as any,
      attachmentId: sending?.attachmentId,
      replyTo: replyingTo,
    });
    const index = messages.value.findIndex(m => m.message_id === messageId);
    if (index >= 0) messages.value[index] = { ...saved, pending: false };
    touchRoomPreview(room.room_id, saved);
  } catch (error: any) {
    const index = messages.value.findIndex(m => m.message_id === messageId);
    if (index >= 0) {
      messages.value[index].pending = false;
      messages.value[index].failed = true;
    }
    flash(error?.message || 'That message did not send.');
  }
}

async function retrySend(message: ChatMessage) {
  const room = activeRoom.value;
  if (!room) return;
  message.failed = false;
  message.pending = true;
  try {
    // Same message_id: the backend adopts it as the record's uid, so this lands
    // as an update if the first attempt actually got through.
    const saved = await userChatService.send(userId.value, username.value, room.room_id, {
      messageId: message.message_id,
      text: message.text,
      kind: message.kind as any,
      attachmentId: message.attachment_id,
      replyTo: message.reply_to,
    });
    Object.assign(message, saved, { pending: false, failed: false });
  } catch (error: any) {
    message.pending = false;
    message.failed = true;
    flash(error?.message || 'Still could not send that message.');
  }
}

function touchRoomPreview(roomId: string, message: ChatMessage) {
  const room = rooms.value.find(r => r.room_id === roomId);
  if (!room) return;
  room.last_message_at = message.created_at;
  room.last_message_preview = message.text
    || (message.kind === 'image' ? 'Picture' : message.kind === 'audio' ? 'Voice note' : '');
  room.last_message_kind = message.kind;
  room.last_message_sender = message.sender_username;
}

// ----------------------------------------------------------- attachments

async function onUpload(payload: {
  blob: Blob; name: string; kind: 'image' | 'audio';
  originalBytes: number; durationMs?: number; previewUrl?: string;
}) {
  const room = activeRoom.value;
  if (!room) return;

  if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
  pendingPreview.value = payload.previewUrl || '';
  pendingAttachment.value = {
    name: payload.name,
    kind: payload.kind,
    state: 'uploading',
    storedBytes: payload.blob.size,
    savedPercent: 0,
  };

  try {
    const attachment = await userChatService.upload(userId.value, room.room_id,
                                                    payload.blob, {
      filename: payload.name,
      durationMs: payload.durationMs,
    });
    // "40% smaller" is measured against what the user actually picked, not
    // against what the browser handed the server - otherwise the client-side
    // compression, which is the bigger half of the saving, is invisible.
    const before = Math.max(payload.originalBytes, attachment.compressed_from || 0);
    pendingAttachment.value = {
      name: payload.name,
      kind: payload.kind,
      state: 'ready',
      attachmentId: attachment.attachment_id,
      storedBytes: attachment.byte_size,
      savedPercent: before > 0
        ? Math.max(0, Math.round((1 - attachment.byte_size / before) * 100))
        : 0,
      durationMs: payload.durationMs,
    };
    // A voice note is sent the moment it is uploaded — nobody records one and
    // then types a caption. A picture waits, because captioning one is normal.
    if (payload.kind === 'audio') onSend({ text: '' });
  } catch (error: any) {
    pendingAttachment.value = {
      name: payload.name,
      kind: payload.kind,
      state: 'error',
      storedBytes: payload.blob.size,
      savedPercent: 0,
      error: error?.message || 'Upload failed.',
    };
  }
}

function discardAttachment(clearPreview = true) {
  if (clearPreview && pendingPreview.value) {
    URL.revokeObjectURL(pendingPreview.value);
    pendingPreview.value = '';
  }
  pendingAttachment.value = null;
}

// ------------------------------------------------------------- scrolling

function onScroll() {
  const element = scroller.value;
  if (!element) return;
  const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
  atBottom.value = distance < 90;
  if (atBottom.value) {
    missedWhileScrolled.value = 0;
    markRead();
  }
}

function scrollToBottom(smooth = false) {
  const element = scroller.value;
  if (!element) return;
  element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  atBottom.value = true;
  missedWhileScrolled.value = 0;
}

function jumpTo(messageId: string) {
  const target = document.getElementById(`msg-${messageId}`);
  if (!target) {
    flash('That message is further back — load earlier messages to see it.');
    return;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  highlighted.value = messageId;
  window.setTimeout(() => { highlighted.value = ''; }, 1600);
}

let readTimer: number | null = null;
function markRead() {
  if (!activeRoomId.value) return;
  // Debounced: scrolling fires this continuously and the read mark only has to
  // land once the user has settled.
  if (readTimer) window.clearTimeout(readTimer);
  readTimer = window.setTimeout(async () => {
    const roomId = activeRoomId.value;
    if (!roomId) return;
    await userChatService.markRead(userId.value, roomId);
    chatStore.markLocallyRead(roomId);
    const room = rooms.value.find(r => r.room_id === roomId);
    if (room) room.unread = 0;
  }, 400);
}

// --------------------------------------------------------- message menu

function openMenu(message: ChatMessage, event: MouseEvent) {
  if (message.kind === 'system') return;
  // Clamped so a menu opened near the right or bottom edge is still on screen.
  menu.value = {
    open: true,
    x: Math.min(event.clientX, window.innerWidth - 180),
    y: Math.min(event.clientY, window.innerHeight - 190),
    message,
  };
}

function canEdit(message: ChatMessage | null) {
  return !!message && message.kind === 'text' && message.sender_id === userId.value;
}

function canDelete(message: ChatMessage | null) {
  if (!message) return false;
  if (message.sender_id === userId.value) return true;
  const role = activeRoom.value?.my_role;
  return role === 'owner' || role === 'admin';
}

function startReply() {
  replyTo.value = menu.value.message;
  menu.value.open = false;
  composer.value?.focus();
}

/** The reply button on the bubble itself, rather than through the menu. */
function startReplyTo(message: ChatMessage) {
  replyTo.value = message;
  composer.value?.focus();
}

/**
 * Delete a message from the button on the bubble.
 *
 * Confirmed, and the wording names what is actually going — a picture and a
 * voice note are not recoverable, and the backend deletes the stored file along
 * with the record on every replica and in the data repo. "Delete this message?"
 * would understate that.
 */
async function confirmDeleteMessage(message: ChatMessage) {
  if (!activeRoomId.value) return;
  const mine = message.sender_id === userId.value;
  const what = message.kind === 'image' ? 'picture'
    : message.kind === 'audio' ? 'voice note' : 'message';
  const extra = message.kind === 'text' ? ''
    : ` The ${what} file will be deleted from storage and cannot be recovered.`;
  const who = mine ? '' : ' It was sent by somebody else.';
  if (!window.confirm(`Delete this ${what} for everyone?${extra}${who}`)) return;

  // Removed from view immediately, and restored if the call fails: a delete that
  // sits there for a second while the request goes out reads as a dead button,
  // and people press it again.
  message.deleted = true;
  try {
    await userChatService.deleteMessage(userId.value, activeRoomId.value,
                                        message.message_id);
    if (replyTo.value?.message_id === message.message_id) replyTo.value = null;
    refreshPreviewFromView();
  } catch (error: any) {
    message.deleted = false;
    flash(error?.message || 'Could not delete that message.');
  }
}

/** Keep the room list's preview honest after a delete, without a round trip.
 *  The backend recomputes its own copy; this is so the row does not go on
 *  advertising a sentence the transcript no longer contains until the next poll. */
function refreshPreviewFromView() {
  const room = rooms.value.find(r => r.room_id === activeRoomId.value);
  if (!room) return;
  const newest = [...visibleMessages.value].reverse()
    .find(m => m.kind !== 'system');
  if (!newest) {
    room.last_message_preview = '';
    room.last_message_kind = '';
    room.last_message_sender = '';
    return;
  }
  touchRoomPreview(room.room_id, newest);
}

function copyText() {
  navigator.clipboard?.writeText(menu.value.message?.text || '');
  menu.value.open = false;
  flash('Copied.');
}

function startEdit() {
  editing.value = menu.value.message;
  editDraft.value = menu.value.message?.text || '';
  menu.value.open = false;
}

async function saveEdit() {
  const message = editing.value;
  if (!message || !activeRoomId.value) return;
  const text = editDraft.value.trim();
  editing.value = null;
  try {
    const saved = await userChatService.editMessage(userId.value, activeRoomId.value,
                                                    message.message_id, text);
    Object.assign(message, saved);
  } catch (error: any) {
    flash(error?.message || 'Could not edit that message.');
  }
}

async function deleteMessage() {
  const message = menu.value.message;
  menu.value.open = false;
  if (!message || !activeRoomId.value) return;
  if (!window.confirm('Delete this message for everyone?')) return;
  try {
    await userChatService.deleteMessage(userId.value, activeRoomId.value,
                                        message.message_id);
    message.deleted = true;
  } catch (error: any) {
    flash(error?.message || 'Could not delete that message.');
  }
}

// -------------------------------------------------------------- room ops

async function startDirect(person: { id: string; username: string }) {
  try {
    const room = await userChatService.openDirect(userId.value, username.value,
                                                  person.id, person.username);
    showNewChat.value = false;
    await loadRooms();
    openRoom(room.room_id);
  } catch (error: any) {
    newChatDialog.value?.failed(error?.message || 'Could not start that conversation.');
  }
}

async function createGroup(payload: { name: string; members: Array<{ id: string; username: string }> }) {
  try {
    const room = await userChatService.createGroup(userId.value, username.value, {
      name: payload.name,
      members: payload.members.map(p => ({ user_id: p.id, username: p.username })),
    });
    showNewChat.value = false;
    await loadRooms();
    openRoom(room.room_id);
  } catch (error: any) {
    newChatDialog.value?.failed(error?.message || 'Could not create that group.');
  }
}

async function addExistingMember(person: { id: string; username: string }) {
  await addSeveralMembers({ name: '', members: [person] });
}

async function addSeveralMembers(payload: { name: string; members: Array<{ id: string; username: string }> }) {
  const roomId = activeRoomId.value;
  if (!roomId) return;
  try {
    for (const person of payload.members) {
      await userChatService.addMember(userId.value, username.value, roomId,
                                      { user_id: person.id, username: person.username });
    }
    showAddMember.value = false;
    await refreshMembers();
  } catch (error: any) {
    addMemberDialog.value?.failed(error?.message || 'Could not add that person.');
  }
}

async function refreshMembers() {
  if (!activeRoomId.value) return;
  try {
    const data = await userChatService.listMembers(userId.value, activeRoomId.value);
    members.value = data.results || [];
    if (activeRoom.value) activeRoom.value.members = data.results || [];
  } catch {
    // The panel keeps whatever it had; the next room open refreshes it.
  }
}

async function changeRole(targetId: string, role: string) {
  if (!activeRoomId.value) return;
  try {
    await userChatService.changeRole(userId.value, activeRoomId.value, targetId, role as any);
    await refreshMembers();
    // A handover changes *our* role too, so the room has to be re-read rather
    // than only the member list.
    if (role === 'owner') {
      activeRoom.value = await userChatService.getRoom(userId.value, activeRoomId.value);
    }
  } catch (error: any) {
    flash(error?.message || 'Could not change that role.');
  }
}

async function removeMember(targetId: string) {
  if (!activeRoomId.value) return;
  if (!window.confirm('Remove this person from the conversation?')) return;
  try {
    await userChatService.removeMember(userId.value, activeRoomId.value, targetId);
    await refreshMembers();
  } catch (error: any) {
    flash(error?.message || 'Could not remove that person.');
  }
}

async function setMuted(value: boolean) {
  if (!activeRoomId.value) return;
  try {
    await userChatService.setMuted(userId.value, activeRoomId.value, value);
    if (activeRoom.value) activeRoom.value.muted = value;
    const room = rooms.value.find(r => r.room_id === activeRoomId.value);
    if (room) room.muted = value;
    chatStore.refresh();
  } catch (error: any) {
    flash(error?.message || 'Could not change that setting.');
  }
}

async function renameRoom(values: { name?: string; topic?: string }) {
  if (!activeRoomId.value) return;
  try {
    const updated = await userChatService.updateRoom(userId.value, activeRoomId.value, values);
    activeRoom.value = { ...updated, members: members.value };
    const room = rooms.value.find(r => r.room_id === activeRoomId.value);
    if (room) Object.assign(room, { name: updated.name, topic: updated.topic });
  } catch (error: any) {
    flash(error?.message || 'Could not rename that conversation.');
  }
}

async function confirmLeave() {
  const roomId = activeRoomId.value;
  if (!roomId) return;
  if (!window.confirm('Leave this conversation? You will stop receiving its messages.')) return;
  try {
    await userChatService.leaveRoom(userId.value, username.value, roomId);
    closeRoom();
    await loadRooms();
    flash('You left the conversation.');
  } catch (error: any) {
    flash(error?.message || 'Could not leave that conversation.');
  }
}

async function confirmDelete() {
  const roomId = activeRoomId.value;
  if (!roomId) return;
  if (!window.confirm('Delete this conversation for everyone? Every message, picture and voice note in it will be removed. This cannot be undone.')) return;
  try {
    await userChatService.deleteRoom(userId.value, roomId);
    closeRoom();
    await loadRooms();
    flash('Conversation deleted.');
  } catch (error: any) {
    flash(error?.message || 'Could not delete that conversation.');
  }
}

// -------------------------------------------------------------- plumbing

let bannerTimer: number | null = null;
function flash(message: string) {
  banner.value = message;
  if (bannerTimer) window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => { banner.value = ''; }, 4200);
}

function onVisibility() {
  if (!activeRoomId.value) return;
  startPolling();
  if (!document.hidden) tick();
}

onMounted(async () => {
  // The chime cannot play without a gesture behind it. Opening this page is one,
  // so it is the natural place to unlock it.
  chatStore.primeAudio();
  await loadRooms();
  const wanted = String(route.params.roomId || '');
  if (wanted) openRoom(wanted);
  document.addEventListener('visibilitychange', onVisibility);
});

onBeforeUnmount(() => {
  stopPolling();
  if (activeRoomId.value) userChatService.leaveLive(userId.value, activeRoomId.value);
  chatStore.setActiveRoom('');
  if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
  if (readTimer) window.clearTimeout(readTimer);
  if (bannerTimer) window.clearTimeout(bannerTimer);
  document.removeEventListener('visibilitychange', onVisibility);
});

// Following a notification link while already on this page changes the param
// without remounting, so the room has to be opened from the watcher too.
watch(() => route.params.roomId, value => {
  const wanted = String(value || '');
  if (wanted && wanted !== activeRoomId.value) openRoom(wanted);
});
</script>

<style scoped>
/*
  Full-height, and getting this right is what fixes the layout rather than any
  amount of tuning further down.

  Two traps, both of which produce the same symptom — a page taller than the
  screen, a composer below the fold, and rows squeezed until their contents
  overlap:

  1. `100vh` on a phone is the viewport *with the browser chrome hidden*, which
     is taller than what you can actually see. `100dvh` is the visible height and
     tracks the URL bar sliding away. The `100vh` line before it is the fallback
     for the handful of browsers without `dvh`.
  2. `.main-content` in side-nav.css adds `padding-top: 4.5rem` below 768px, to
     clear the floating menu button. A child asking for the full viewport height
     inside that padding overflows by exactly 4.5rem. The media query at the
     bottom of this file subtracts it.
*/
.messages {
  display: flex;
  height: 100vh;
  height: 100dvh;
  background: #f8fafc;
  overflow: hidden;
  /* The page owns its own scrolling regions; nothing here should ever scroll the
     document. */
  overscroll-behavior: contain;
}

/* ------------------------------------------------------------ room list */
.rooms {
  width: 320px; flex: 0 0 320px;
  display: flex; flex-direction: column;
  background: #fff;
  border-right: 1px solid rgba(15, 23, 42, 0.08);
}

.rooms-head { padding: 16px 14px 10px; border-bottom: 1px solid rgba(15, 23, 42, 0.07); }
.title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px; }
h1 { margin: 0; font-size: 1.25rem; color: #0f172a; }
.head-actions { display: flex; align-items: center; gap: 4px; }

.new-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border: 0; border-radius: 999px;
  background: #2563eb; color: #fff;
  font-size: 0.81rem; font-weight: 600; cursor: pointer;
}
.new-btn:hover { background: #1d4ed8; }

.search { position: relative; display: flex; align-items: center; }
.search svg { position: absolute; left: 10px; color: #94a3b8; pointer-events: none; }
.search input {
  width: 100%; padding: 7px 11px 7px 30px; font: inherit; font-size: 0.84rem;
  border: 1px solid transparent; border-radius: 999px; background: #f1f5f9; outline: none;
}
.search input:focus { border-color: #2563eb; background: #fff; }

.rooms-list { flex: 1; overflow-y: auto; padding: 6px; }

.room-skeleton {
  height: 58px; margin: 4px 0; border-radius: 10px;
  background: linear-gradient(100deg, #f1f5f9 30%, #e2e8f0 50%, #f1f5f9 70%);
  background-size: 220% 100%; animation: shimmer 1.3s infinite;
}
@keyframes shimmer { to { background-position: -220% 0; } }

.rooms-empty { padding: 30px 18px; text-align: center; font-size: 0.83rem; color: #94a3b8; line-height: 1.55; }
.rooms-empty strong { display: block; margin-bottom: 4px; color: #475569; font-size: 0.9rem; }

/*
  An explicit 3-column grid rather than nested flex rows.

  The nested version put the name, the time, the preview and the badge inside two
  `<span>`s that were themselves flex containers — and inside a `<button>`, whose
  children browsers lay out with their own rules. The result was a row whose parts
  could ride over the avatar once anything was long enough to wrap.

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
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  grid-template-areas:
    "avatar name    when"
    "avatar preview tail";
  align-items: center;
  column-gap: 11px;
  row-gap: 2px;
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: 12px;
  background: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: background 0.14s;
}
.room:hover { background: #f1f5f9; }
.room.on { background: #eff6ff; box-shadow: inset 3px 0 0 #2563eb; }
.room:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }

.room-avatar { grid-area: avatar; }

.room-name {
  grid-area: name;
  min-width: 0;
  font-size: 0.9rem;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room.unread .room-name { font-weight: 700; }

.room-when {
  grid-area: when;
  justify-self: end;
  font-size: 0.71rem;
  color: #94a3b8;
  white-space: nowrap;
}
.room.unread .room-when { color: #2563eb; font-weight: 600; }

.room-preview {
  grid-area: preview;
  min-width: 0;
  font-size: 0.8rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room.unread .room-preview { color: #334155; }

.room-tail {
  grid-area: tail;
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 5px;
}

.room-badge {
  min-width: 20px; padding: 2px 6px;
  border-radius: 999px; background: #2563eb; color: #fff;
  font-size: 0.68rem; font-weight: 700; text-align: center; line-height: 1.25;
}
.muted-icon { color: #cbd5e1; display: inline-flex; }

/* --------------------------------------------------------------- thread */
.thread { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; background: #f8fafc; }

.placeholder {
  flex: 1; display: grid; place-content: center; justify-items: center;
  gap: 6px; color: #94a3b8; text-align: center; padding: 30px;
}
.placeholder h2 { margin: 8px 0 0; font-size: 1.05rem; color: #475569; }
.placeholder p { margin: 0; font-size: 0.86rem; max-width: 38ch; line-height: 1.5; }

.thread-head {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: #fff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}
.thread-title { flex: 1; min-width: 0; }
.thread-title h2 { margin: 0; font-size: 0.95rem; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.thread-title p { margin: 1px 0 0; font-size: 0.75rem; color: #64748b; }
.typing { color: #2563eb; font-weight: 600; }

.back { display: none; }

.transcript { flex: 1; overflow-y: auto; padding: 10px 16px 14px; scroll-behavior: smooth; }

.day { display: flex; justify-content: center; margin: 16px 0 8px; }
.day span {
  padding: 3px 12px; border-radius: 999px;
  background: rgba(15, 23, 42, 0.06); color: #64748b;
  font-size: 0.71rem; font-weight: 600;
}

.thread-empty { text-align: center; padding: 40px 20px; font-size: 0.85rem; color: #94a3b8; }

.load-older, .loading-older {
  display: block; margin: 4px auto 12px; padding: 5px 14px;
  border: 1px solid rgba(15, 23, 42, 0.1); border-radius: 999px;
  background: #fff; color: #475569;
  font-size: 0.78rem; cursor: pointer;
}
.loading-older { color: #94a3b8; cursor: default; text-align: center; width: max-content; }

.jump-bottom {
  position: absolute; right: 18px; bottom: 78px;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 12px; border: 0; border-radius: 999px;
  background: #2563eb; color: #fff;
  font-size: 0.77rem; font-weight: 600; cursor: pointer;
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
}

:deep(.highlighted) .bubble { animation: flash 1.5s ease-out; }
@keyframes flash {
  0%, 40% { box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.45); }
  100% { box-shadow: none; }
}

/* ---------------------------------------------------------------- menus */
.menu-backdrop { position: fixed; inset: 0; z-index: 70; }
.menu {
  position: fixed; list-style: none; margin: 0; padding: 5px;
  min-width: 150px; border-radius: 10px; background: #fff;
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.22);
  border: 1px solid rgba(15, 23, 42, 0.08);
}
.menu button {
  display: block; width: 100%; text-align: left;
  padding: 7px 11px; border: 0; border-radius: 7px;
  background: none; font: inherit; font-size: 0.84rem;
  color: #1e293b; cursor: pointer;
}
.menu button:hover { background: #f1f5f9; }
.menu button.danger { color: #b91c1c; }
.menu button.danger:hover { background: #fef2f2; }

.backdrop {
  position: fixed; inset: 0; z-index: 60;
  display: grid; place-items: center;
  background: rgba(15, 23, 42, 0.45); padding: 18px;
}
.edit-dialog { width: min(440px, 100%); background: #fff; border-radius: 13px; padding: 16px; }
.edit-dialog h3 { margin: 0 0 10px; font-size: 1rem; color: #0f172a; }
.edit-dialog textarea {
  width: 100%; font: inherit; font-size: 0.88rem; padding: 9px 11px;
  border: 1px solid rgba(15, 23, 42, 0.14); border-radius: 9px;
  resize: vertical; outline: none;
}
.edit-dialog textarea:focus { border-color: #2563eb; }
.edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 11px; }
.ghost, .primary { border: 0; border-radius: 8px; padding: 8px 15px; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.ghost { background: #f1f5f9; color: #475569; }
.primary { background: #2563eb; color: #fff; }
.primary:disabled { background: #cbd5e1; cursor: default; }

.lightbox {
  position: fixed; inset: 0; z-index: 80;
  display: grid; place-items: center;
  background: rgba(2, 6, 23, 0.9); cursor: zoom-out; padding: 24px;
}
.lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; }

.banner {
  position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%);
  z-index: 90; margin: 0; padding: 9px 18px; border-radius: 999px;
  background: #0f172a; color: #fff; font-size: 0.83rem;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.32);
}

.icon-btn { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 50%; background: none; color: #64748b; cursor: pointer; }
.icon-btn:hover { background: #e2e8f0; color: #1e293b; }

/* ----------------------------------------------------------- responsive */

/* ≤ 1180: the details panel overlays the thread instead of squeezing it. Three
   columns in 1100px leaves a conversation about 400px wide, which is where
   bubbles start wrapping every few words. */
@media (max-width: 1180px) {
  :deep(.panel) {
    position: absolute;
    top: 0; right: 0; bottom: 0;
    z-index: 20;
    box-shadow: -10px 0 30px rgba(15, 23, 42, 0.14);
  }
  .thread { position: relative; }
}

/* ≤ 1024: a narrower list, so the conversation keeps the room. */
@media (max-width: 1024px) {
  .rooms { width: 268px; flex: 0 0 268px; }
}

/*
  ≤ 860: one pane at a time — the list, or the thread.

  A 320px sidebar next to a 60px conversation is the usual way a chat becomes
  unusable on a phone, and it is also what makes rows look like their contents
  are colliding: they are simply out of room.
*/
@media (max-width: 860px) {
  /* `.main-content` adds padding-top: 4.5rem below 768px for the floating menu
     button. Without subtracting it the page is 4.5rem taller than the screen and
     the composer sits under the fold. */
  .messages { height: calc(100dvh - 4.5rem); }

  .rooms { width: 100%; flex: 1 1 auto; border-right: 0; }
  .thread { display: none; }
  .messages.thread-open .rooms { display: none; }
  .messages.thread-open .thread { display: flex; }

  .back {
    display: grid; place-items: center;
    width: 34px; height: 34px; flex: 0 0 34px;
    border: 0; border-radius: 50%; background: none;
    color: #475569; cursor: pointer;
  }

  :deep(.panel) { position: fixed; inset: 0; width: 100%; z-index: 55; }

  /* Comfortable touch targets, and a little more air per row now that the list
     has the whole screen. */
  .room { padding: 11px 12px; column-gap: 12px; }
  .room-name { font-size: 0.94rem; }
  .room-preview { font-size: 0.84rem; }
  .jump-bottom { bottom: 88px; }
}

/* ≤ 420: the smallest phones. The time column is the first thing to go — the
   preview is worth more than the exact minute. */
@media (max-width: 420px) {
  h1 { font-size: 1.12rem; }
  .rooms-head { padding: 12px 11px 9px; }
  .room { padding: 10px 9px; column-gap: 10px; }
  .room-when { font-size: 0.67rem; }
  .transcript { padding: 8px 10px 12px; }
  :deep(.stack) { max-width: 86%; }
}

/* Somebody who has asked for less motion should not get a smooth-scrolling
   transcript that animates on every incoming message. */
@media (prefers-reduced-motion: reduce) {
  .transcript { scroll-behavior: auto; }
  .room, .send, .icon-btn { transition: none; }
}
</style>
