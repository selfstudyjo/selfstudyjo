<template>
  <div class="uc-root messages-page">
    <ChatLayout :thread-open="!!activeRoom" :aside-open="!!activeRoom && showInfo">
      <!-- ----------------------------------------------------- sidebar -->
      <template #sidebar>
        <RoomListSidebar
          v-model="roomFilter"
          :rooms="filteredRooms"
          :user-id="userId"
          :active-room-id="activeRoomId"
          :loading="loadingRooms"
          :sound-enabled="chatStore.soundEnabled"
          :total-unread="totalUnread"
          :active-room-online="onlineCount > 0"
          @select-room="openRoom"
          @new-chat="showNewChat = true"
          @toggle-sound="chatStore.setSoundEnabled(!chatStore.soundEnabled)"
          @home="goHome"
        />
      </template>

      <!-- -------------------------------------------------------- main -->
      <template #main>
        <div v-if="!activeRoom" class="uc-placeholder">
          <div class="uc-placeholder-mark" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          </div>
          <h2>{{ $t('Pick a conversation') }}</h2>
          <p>{{ $t('Or start a new one. Messages, pictures and voice notes, free with your account.') }}</p>
          <button type="button" class="uc-placeholder-btn" @click="showNewChat = true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            {{ $t('New message') }}
          </button>
        </div>

        <template v-else>
          <ChatHeader
            :room="activeRoom"
            :user-id="userId"
            :member-count="members.length"
            :online-count="onlineCount"
            :other-online="otherOnline"
            :typing-label="typingLabel"
            :info-open="showInfo"
            @back="closeRoom"
            @toggle-info="showInfo = !showInfo"
            @home="goHome"
          />

          <MessageList
            ref="list"
            :key="activeRoomId"
            :messages="visibleMessages"
            :user-id="userId"
            :is-direct="activeRoom.kind === 'direct'"
            :can-moderate="canModerate"
            :has-more="hasMore"
            :loading-older="loadingOlder"
            :loading="loadingMessages"
            :highlighted="highlighted"
            :missed-count="missedWhileScrolled"
            :read-cutoff="readCutoff"
            @scroll-top="loadOlder"
            @at-bottom="onAtBottom"
            @menu="openMenu"
            @retry="retrySend"
            @jump="jumpTo"
            @lightbox="lightbox = $event"
            @reply="startReplyTo"
            @remove="confirmDeleteMessage"
          />

          <ChatInput
            ref="chatInput"
            :reply-to="replyTo"
            :pending="pendingAttachment"
            :pending-preview="pendingPreview"
            :placeholder="`Message ${activeRoomName}…`"
            @send="onSend"
            @upload="onUpload"
            @typing="onTyping"
            @cancel-reply="replyTo = null"
            @discard="discardAttachment"
          />
        </template>
      </template>

      <!-- ------------------------------------------------------- aside -->
      <template #aside>
        <RoomInfoPanel
          v-if="activeRoom"
          :room="activeRoom"
          :members="members"
          :user-id="userId"
          :my-role="activeRoom.my_role || 'member'"
          :online-ids="onlineIds"
          :title="activeRoomName"
          :media="sharedMedia"
          @close="showInfo = false"
          @mute="setMuted"
          @add-member="showAddMember = true"
          @role="changeRole"
          @remove="removeMember"
          @leave="confirmLeave"
          @delete="confirmDelete"
          @rename="renameRoom"
          @jump="jumpFromPanel"
        />
      </template>
    </ChatLayout>

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
        <li><button type="button" @click="startReply">{{ $t('Reply') }}</button></li>
        <li v-if="menu.message?.kind === 'text'">
          <button type="button" @click="copyText">{{ $t('Copy text') }}</button>
        </li>
        <li v-if="canEdit(menu.message)">
          <button type="button" @click="startEdit">{{ $t('Edit') }}</button>
        </li>
        <li v-if="canDelete(menu.message)">
          <button type="button" class="danger" @click="deleteMessage">{{ $t('Delete') }}</button>
        </li>
      </ul>
    </div>

    <!-- Inline edit -->
    <div v-if="editing" class="backdrop" @click.self="editing = null">
      <div class="edit-dialog" role="dialog" aria-modal="true" :aria-label="$t('Edit message')">
        <h3>{{ $t('Edit message') }}</h3>
        <textarea v-model="editDraft" rows="4" aria-label="Message text"></textarea>
        <div class="edit-actions">
          <button type="button" class="ghost" @click="editing = null">{{ $t('Cancel') }}</button>
          <button type="button" class="primary" :disabled="!editDraft.trim()" @click="saveEdit">{{ $t('Save') }}</button>
        </div>
      </div>
    </div>

    <!-- Full-size picture -->
    <div v-if="lightbox" class="lightbox" @click="lightbox = ''">
      <button type="button" class="lightbox-close" :aria-label="$t('Close picture')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <img :src="lightbox" alt="" @click.stop />
    </div>

    <transition name="banner">
      <p v-if="banner" class="banner" role="status">{{ banner }}</p>
    </transition>
  </div>
</template>

<script setup lang="ts">
/**
 * Messages — Self Study User Chat (app 35).
 *
 * **Not the support chat.** That is app 9, the ChatBox widget floating on every
 * other page, answered by an operator in selfstudyadmin. This is signed-in
 * people talking to each other.
 *
 * This file is the container and holds all of the behaviour: rooms, the live
 * poll, optimistic sending, read marks and every room operation. The seven
 * components under `components/userchat/` are presentation — they are handed
 * data and report what was clicked, and the only one holding state of its own is
 * MessageList, which owns the scroller.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ChatHeader from '@/components/userchat/ChatHeader.vue';
import ChatInput, { type PendingAttachment } from '@/components/userchat/ChatInput.vue';
import ChatLayout from '@/components/userchat/ChatLayout.vue';
import MessageList from '@/components/userchat/MessageList.vue';
import NewChatDialog from '@/components/userchat/NewChatDialog.vue';
import RoomInfoPanel from '@/components/userchat/RoomInfoPanel.vue';
import RoomListSidebar from '@/components/userchat/RoomListSidebar.vue';
import { displayName } from '@/components/userchat/roomDisplay';
import { ApiError } from '@/services/api';
import { userChatService, type ChatMember, type ChatMessage,
         type ChatRoom, type Participant } from '@/services/userchat.service';
import { useAuthStore } from '@/store/auth';
import { useUserChatStore } from '@/store/userchat';

import '@/assets/css/user-chat.css';

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
const chatInput = ref<any>(null);
const list = ref<InstanceType<typeof MessageList> | null>(null);
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

const activeRoomName = computed(() => displayName(activeRoom.value, userId.value));

const totalUnread = computed(() =>
  rooms.value.reduce((sum, room) => sum + (room.unread || 0), 0));

const filteredRooms = computed(() => {
  const term = roomFilter.value.trim().toLowerCase();
  const sorted = [...rooms.value].sort((a, b) =>
    String(b.last_message_at || b.created_at || '').localeCompare(
      String(a.last_message_at || a.created_at || '')));
  if (!term) return sorted;
  return sorted.filter(room =>
    displayName(room, userId.value).toLowerCase().includes(term)
    || (room.last_message_preview || '').toLowerCase().includes(term)
    || (room.topic || '').toLowerCase().includes(term));
});

const visibleMessages = computed(() => messages.value.filter(m => !m.deleted));

/** Pictures already in the loaded transcript, newest first — the details
 *  panel's strip. `filter` returns a fresh array, so reversing it is safe. */
const sharedMedia = computed(() =>
  visibleMessages.value.filter(m => m.kind === 'image').reverse());

/** Owner or admin of the open room — mirrors `can_administer` on the backend,
 *  and is what decides whether the delete button appears on somebody else's
 *  message. */
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

// ----------------------------------------------------------- read receipts

/**
 * The newest moment any *other* member has read up to, in epoch milliseconds.
 *
 * App 35 keeps a read mark per membership (`last_read_at`, joined
 * `MONOTONIC_MAX` so it can never move backwards), not a receipt per message.
 * "Somebody has read up to here" is therefore the strongest true statement
 * available, and it is exactly what a double tick claims. 0 means nobody has
 * read anything yet, which renders as a single tick — under-claiming is the
 * right way round for a statement about another person.
 */
const readCutoff = computed(() => {
  let newest = 0;
  for (const member of members.value) {
    if (member.user_id === userId.value) continue;
    const at = Date.parse(member.last_read_at || '');
    if (Number.isFinite(at) && at > newest) newest = at;
  }
  return newest;
});

/** Whether my newest message is still waiting to be read. Drives the member
 *  refresh below — there is no point asking who has read what when the answer
 *  cannot have changed. */
const awaitingReceipt = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const message = messages.value[i];
    if (message.deleted || message.kind === 'system') continue;
    if (message.sender_id !== userId.value) return false;
    const at = Date.parse(message.created_at || '');
    return Number.isFinite(at) && at > readCutoff.value;
  }
  return false;
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
  members.value = [];
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
    list.value?.scrollToBottom();
    markRead();
    startPolling();
    chatInput.value?.focus();
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

/** Leave the feature for the dashboard.
 *
 *  `router.push`, not `history.back()`: back from here is whatever the person
 *  was reading before opening a notification link, which is very often another
 *  site. The route is named `Home` and its `meta.title` is "Dashboard" — the
 *  buttons are labelled after the title, since that is the word on the nav. */
function goHome() {
  router.push({ name: 'Home' });
}

function closeRoom() {
  stopPolling();
  if (activeRoomId.value) {
    userChatService.leaveLive(userId.value, activeRoomId.value);
  }
  activeRoomId.value = '';
  activeRoom.value = null;
  messages.value = [];
  members.value = [];
  showInfo.value = false;
  chatStore.setActiveRoom('');
  if (route.name === 'MessageRoom') router.replace({ name: 'Messages' });
}

async function loadOlder() {
  if (!activeRoomId.value || !nextBefore.value || loadingOlder.value) return;
  loadingOlder.value = true;
  // Hold the reading position across the prepend. Without it, the user is
  // thrown to the top of the newly-loaded block, which on a long conversation
  // means losing their place every time they scroll up.
  const restore = list.value?.captureScroll();
  try {
    const page = await userChatService.listMessages(userId.value, activeRoomId.value,
                                                    { limit: 50, before: nextBefore.value });
    messages.value = [...(page.messages || []), ...messages.value];
    hasMore.value = page.has_more;
    nextBefore.value = page.next_before;
    await nextTick();
    restore?.();
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
let ticks = 0;

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

  // Read marks live on the membership records, which the live poll does not
  // carry — so they are only refreshed when there is something to learn: my
  // newest message is out and nobody has acknowledged it yet. Every fourth tick
  // is one request per ten seconds, and only while a receipt is outstanding.
  ticks++;
  if (ticks % 4 === 0 && awaitingReceipt.value) refreshMembers();
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
        list.value?.scrollToBottom();
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
  list.value?.scrollToBottom(true);

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
    // against what the browser handed the server — otherwise the client-side
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

/** MessageList owns the scroller and reports the transitions; the page only
 *  needs to know whether new arrivals should follow or be counted. */
function onAtBottom(value: boolean) {
  atBottom.value = value;
  if (!value) return;
  missedWhileScrolled.value = 0;
  markRead();
}

function jumpTo(messageId: string) {
  if (!list.value?.jumpTo(messageId)) {
    flash('That message is further back — load earlier messages to see it.');
    return;
  }
  highlighted.value = messageId;
  window.setTimeout(() => { highlighted.value = ''; }, 1700);
}

/** Jumping from the details panel's picture strip. On a phone that panel covers
 *  the whole screen, so scrolling the transcript behind it would look like the
 *  thumbnail did nothing at all. The breakpoint matches ChatLayout's. */
function jumpFromPanel(messageId: string) {
  if (window.matchMedia('(max-width: 768px)').matches) showInfo.value = false;
  nextTick(() => jumpTo(messageId));
}

let readTimer: number | null = null;
function markRead() {
  if (!activeRoomId.value) return;
  // Debounced: scrolling fires this repeatedly and the read mark only has to
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
  chatInput.value?.focus();
}

/** The reply button on the bubble itself, rather than through the menu. */
function startReplyTo(message: ChatMessage) {
  replyTo.value = message;
  chatInput.value?.focus();
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
    refreshPreviewFromView();
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

/** Escape closes the topmost thing, in the order somebody would expect to get
 *  out of it. Without this the lightbox is a full-screen overlay with no
 *  keyboard exit at all. */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (lightbox.value) { lightbox.value = ''; return; }
  if (menu.value.open) { menu.value.open = false; return; }
  if (editing.value) { editing.value = null; return; }
  if (showInfo.value) { showInfo.value = false; }
}

onMounted(async () => {
  // The chime cannot play without a gesture behind it. Opening this page is one,
  // so it is the natural place to unlock it.
  chatStore.primeAudio();
  await loadRooms();
  const wanted = String(route.params.roomId || '');
  if (wanted) openRoom(wanted);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  stopPolling();
  if (activeRoomId.value) userChatService.leaveLive(userId.value, activeRoomId.value);
  chatStore.setActiveRoom('');
  if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
  if (readTimer) window.clearTimeout(readTimer);
  if (bannerTimer) window.clearTimeout(bannerTimer);
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('keydown', onKeydown);
});

// Following a notification link while already on this page changes the param
// without remounting, so the room has to be opened from the watcher too.
watch(() => route.params.roomId, value => {
  const wanted = String(value || '');
  if (wanted && wanted !== activeRoomId.value) openRoom(wanted);
});
</script>

<style scoped>
/* The page is a wrapper for the token scope and the overlays; ChatLayout owns
   every dimension. */
.messages-page { position: relative; }

/* --------------------------------------------------------- placeholder */
.uc-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  text-align: center;
  color: var(--uc-text-dim);
}
.uc-placeholder-mark {
  display: grid;
  place-items: center;
  width: 78px;
  height: 78px;
  margin-bottom: 8px;
  border-radius: 50%;
  background: var(--uc-surface);
  border: 1px solid var(--uc-border);
  color: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.65);
}
.uc-placeholder h2 { margin: 0; font-size: var(--uc-fs-xl); font-weight: 650; color: var(--uc-text-soft); }
.uc-placeholder p { margin: 0; font-size: var(--uc-fs-md); max-width: 40ch; line-height: 1.55; }
.uc-placeholder-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  padding: 9px 18px;
  border: 0;
  border-radius: var(--uc-r-full);
  background: var(--uc-brand-grad);
  color: var(--sfs-text, #fff);
  font: inherit;
  font-size: var(--uc-fs-md);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.38);
  transition: transform var(--uc-t-fast), box-shadow var(--uc-t-fast);
}
.uc-placeholder-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.5); }

/* ---------------------------------------------------------------- menus */
.menu-backdrop { position: fixed; inset: 0; z-index: 70; }
.menu {
  position: fixed;
  list-style: none;
  margin: 0;
  padding: 5px;
  min-width: 158px;
  border-radius: var(--uc-r-sm);
  background: rgb(var(--sfs-surface-rgb, 16 18 42) / 0.98);
  backdrop-filter: var(--uc-blur);
  -webkit-backdrop-filter: var(--uc-blur);
  border: 1px solid var(--uc-border-strong);
  box-shadow: var(--uc-shadow-lg);
}
.menu button {
  display: block;
  width: 100%;
  text-align: start;
  padding: 8px 12px;
  border: 0;
  border-radius: var(--uc-r-xs);
  background: none;
  font: inherit;
  font-size: var(--uc-fs-md);
  color: var(--uc-text-soft);
  cursor: pointer;
  transition: background var(--uc-t-fast), color var(--uc-t-fast);
}
.menu button:hover { background: var(--uc-surface-2); color: var(--uc-text); }
.menu button.danger { color: var(--uc-danger); }
.menu button.danger:hover { background: var(--uc-danger-bg); }

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgb(var(--sfs-surface-rgb, 3 4 16) / 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 18px;
}
.edit-dialog {
  width: min(460px, 100%);
  background: rgb(var(--sfs-surface-rgb, 14 16 38) / 0.97);
  border: 1px solid var(--uc-border-strong);
  border-radius: var(--uc-r-lg);
  box-shadow: var(--uc-shadow-lg);
  padding: 18px;
}
.edit-dialog h3 { margin: 0 0 12px; font-size: var(--uc-fs-xl); font-weight: 650; color: var(--uc-text); }
.edit-dialog textarea {
  width: 100%;
  font: inherit;
  font-size: var(--uc-fs-md);
  padding: 10px 12px;
  color: var(--uc-text);
  background: var(--uc-surface);
  border: 1px solid var(--uc-border);
  border-radius: var(--uc-r-xs);
  resize: vertical;
  outline: none;
}
.edit-dialog textarea:focus {
  border-color: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.5);
  box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16);
}
.edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.ghost, .primary {
  border: 1px solid transparent;
  border-radius: var(--uc-r-xs);
  padding: 9px 16px;
  font: inherit;
  font-size: var(--uc-fs-md);
  font-weight: 600;
  cursor: pointer;
}
.ghost { background: var(--uc-surface); color: var(--uc-text-muted); border-color: var(--uc-border); }
.ghost:hover { background: var(--uc-surface-2); color: var(--uc-text); }
.primary { background: var(--uc-brand-grad); color: var(--sfs-text, #fff); }
.primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* ------------------------------------------------------------ lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  background: rgb(var(--sfs-surface-rgb, 2 3 12) / 0.94);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  cursor: zoom-out;
  padding: clamp(16px, 4vw, 48px);
}
.lightbox img {
  max-width: 100%;
  max-height: 100%;
  border-radius: var(--uc-r-sm);
  box-shadow: var(--uc-shadow-lg);
  cursor: default;
}
.lightbox-close {
  position: absolute;
  top: 18px;
  right: 18px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--uc-border-strong);
  border-radius: 50%;
  background: var(--uc-surface-2);
  color: var(--uc-text);
  cursor: pointer;
}
.lightbox-close:hover { background: var(--uc-surface-3); }

/* -------------------------------------------------------------- banner */
.banner {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 90;
  margin: 0;
  padding: 10px 20px;
  border-radius: var(--uc-r-full);
  background: rgb(var(--sfs-surface-rgb, 16 18 42) / 0.97);
  border: 1px solid var(--uc-border-strong);
  backdrop-filter: var(--uc-blur);
  -webkit-backdrop-filter: var(--uc-blur);
  color: var(--uc-text);
  font-size: var(--uc-fs-md);
  box-shadow: var(--uc-shadow-lg);
}
.banner-enter-active, .banner-leave-active { transition: opacity var(--uc-t-base), transform var(--uc-t-base); }
.banner-enter-from, .banner-leave-to { opacity: 0; transform: translate(-50%, 8px); }
</style>
