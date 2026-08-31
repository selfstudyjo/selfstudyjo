<template>
  <aside class="panel">
    <header>
      <h2>{{ isDirect ? 'Conversation' : 'Group' }}</h2>
      <button type="button" class="uc-icon-btn" :aria-label="$t('Close details')" @click="$emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </header>

    <div class="body uc-scroll">
      <div class="hero">
        <ChatAvatar
          class="hero-avatar"
          :user-id="heroId"
          :name="title"
          :lookup="isDirect"
          size="xl"
        />
        <div v-if="canAdminister && !isDirect" class="rename">
          <input
            v-model="nameDraft"
            type="text"
            maxlength="120"
            :aria-label="$t('Group name')"
            @blur="saveName"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          />
          <input
            v-model="topicDraft"
            type="text"
            maxlength="500"
            class="topic-input"
            :placeholder="$t('Add a topic…')"
            :aria-label="$t('Topic')"
            @blur="saveTopic"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          />
        </div>
        <template v-else>
          <h3>{{ title }}</h3>
          <p v-if="room.topic" class="topic">{{ room.topic }}</p>
        </template>
      </div>

      <label class="toggle">
        <input type="checkbox" :checked="room.muted" @change="$emit('mute', !room.muted)" />
        <span>
          <strong>{{ $t('Mute this conversation') }}</strong>
          <small>{{ $t('No chime and no notification email. The messages still arrive.') }}</small>
        </span>
      </label>

      <!--
        Pictures from the part of the transcript already loaded — no extra
        request, and the thumbnails are the sub-kilobyte data URLs that came down
        inside the message records. Clicking one scrolls the transcript to it
        rather than opening it, because the useful question here is "what were we
        saying when that was sent".
      -->
      <section v-if="media.length" class="media-section">
        <div class="section-head">
          <h4>{{ $t('Shared pictures') }}</h4>
          <span class="count">{{ media.length }}</span>
        </div>
        <div class="media-grid">
          <button
            v-for="item in media.slice(0, 9)"
            :key="item.message_id"
            type="button"
            class="media-cell"
            :title="`Sent by ${item.sender_username || 'someone'}`"
            @click="$emit('jump', item.message_id)"
          >
            <img v-if="item.attachment?.thumbnail" :src="item.attachment.thumbnail" alt="" />
            <span v-else class="media-fallback" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-6 6"/></svg>
            </span>
          </button>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h4>{{ members.length }} {{ members.length === 1 ? 'person' : 'people' }}</h4>
          <button
            v-if="canAdminister && !isDirect"
            type="button"
            class="link"
            @click="$emit('add-member')"
          >{{ $t('Add') }}</button>
        </div>

        <ul class="members">
          <li v-for="person in members" :key="person.user_id">
            <ChatAvatar
              :user-id="person.user_id"
              :name="person.username || person.full_name"
              :image-url="person.user_id === userId ? myImageUrl : undefined"
              :online="onlineIds.has(person.user_id)"
              size="md"
            />
            <span class="who">
              <span class="name">
                {{ person.username || 'Unknown user' }}
                <em v-if="person.user_id === userId">{{ $t('(you)') }}</em>
              </span>
              <span v-if="onlineIds.has(person.user_id)" class="online">{{ $t('online') }}</span>
              <span v-else-if="person.full_name" class="full">{{ person.full_name }}</span>
            </span>

            <span v-if="person.role !== 'member'" :class="['role', person.role]">
              {{ person.role }}
            </span>

            <!-- Only shown where it would actually work. An admin cannot manage
                 another admin or the owner, so offering the menu and then
                 answering 403 would be a worse experience than not offering it. -->
            <div v-if="canManage(person)" class="row-actions">
              <select
                :value="person.role"
                :aria-label="$t('Role')"
                @change="$emit('role', person.user_id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="member">{{ $t('Member') }}</option>
                <option value="admin">{{ $t('Admin') }}</option>
                <option v-if="myRole === 'owner'" value="owner">{{ $t('Owner') }}</option>
              </select>
              <button
                type="button"
                class="uc-icon-btn danger tiny"
                :aria-label="`Remove ${person.username}`"
                @click="$emit('remove', person.user_id)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="room.created_at" class="facts">
        <p><span>{{ $t('Started') }}</span> {{ formatDate(room.created_at) }}</p>
        <p v-if="room.created_by_username"><span>{{ $t('By') }}</span> {{ room.created_by_username }}</p>
        <p v-if="room.message_count !== undefined"><span>{{ $t('Messages') }}</span> {{ room.message_count }}</p>
      </section>
    </div>

    <footer>
      <button type="button" class="uc-danger-btn" @click="$emit('leave')">
        {{ $t('Leave this conversation') }}
      </button>
      <!-- Delete is the owner's alone, and it is destructive for everybody in the
           room rather than just for them — so it is separated from Leave and
           labelled with what it actually does. -->
      <button v-if="myRole === 'owner'" type="button" class="uc-danger-btn solid" @click="$emit('delete')">
        {{ $t('Delete for everyone') }}
      </button>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import ChatAvatar from './ChatAvatar.vue';
import type { ChatMember, ChatMessage, ChatRoom, RoomRole } from '@/services/userchat.service';
import { useAuthStore } from '@/store/auth';
import { getProxiedImageUrl } from '@/utils/imageUtils';

const props = withDefaults(defineProps<{
  room: ChatRoom;
  members: ChatMember[];
  userId: string;
  myRole: RoomRole;
  onlineIds: Set<string>;
  title: string;
  /** Image messages from the loaded transcript, newest first. Presentation
   *  only — the panel never fetches anything of its own. */
  media?: ChatMessage[];
}>(), { media: () => [] });

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'mute', value: boolean): void;
  (e: 'add-member'): void;
  (e: 'role', userId: string, role: string): void;
  (e: 'remove', userId: string): void;
  (e: 'leave'): void;
  (e: 'delete'): void;
  (e: 'rename', values: { name?: string; topic?: string }): void;
  (e: 'jump', messageId: string): void;
}>();

const RANK: Record<string, number> = { member: 1, admin: 2, owner: 3 };

const authStore = useAuthStore();

/** The signed-in user's own picture, taken from the auth store rather than
 *  looked up: it is already in memory, and it is the one that updates the moment
 *  they change it on their profile. */
const myImageUrl = computed(() => {
  const raw = authStore.user?.image_url;
  return raw ? getProxiedImageUrl(raw) : undefined;
});

const isDirect = computed(() => props.room.kind === 'direct');

/** A direct room's hero is the other person; a group's is itself. */
const heroId = computed(() => {
  if (!isDirect.value) return props.room.room_id;
  const other = props.members.find(m => m.user_id !== props.userId);
  return other?.user_id || props.room.room_id;
});
const canAdminister = computed(() => props.myRole === 'owner' || props.myRole === 'admin');

const nameDraft = ref(props.room.name || '');
const topicDraft = ref(props.room.topic || '');

watch(() => props.room.room_id, () => {
  nameDraft.value = props.room.name || '';
  topicDraft.value = props.room.topic || '';
});

function saveName() {
  const value = nameDraft.value.trim();
  if (!value || value === props.room.name) {
    nameDraft.value = props.room.name || '';
    return;
  }
  emit('rename', { name: value });
}

function saveTopic() {
  if (topicDraft.value === (props.room.topic || '')) return;
  emit('rename', { topic: topicDraft.value });
}

/** Strictly greater, matching `can_manage_member` on the backend. Two admins who
 *  can each remove the other is a room that goes to whoever clicks first. */
function canManage(person: ChatMember) {
  if (person.user_id === props.userId) return false;
  if (isDirect.value) return false;
  return (RANK[props.myRole] || 0) > (RANK[person.role] || 0);
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-inline-start: 1px solid var(--uc-border);
  background: rgb(var(--sfs-surface-rgb, 10 12 30) / 0.88);
  backdrop-filter: var(--uc-blur-strong);
  -webkit-backdrop-filter: var(--uc-blur-strong);
  color: var(--uc-text);
}

header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
  border-bottom: 1px solid var(--uc-border);
}
h2 { margin: 0; font-size: var(--uc-fs-lg); font-weight: 650; color: var(--uc-text); }

.body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 18px 14px; }

.hero { text-align: center; margin-bottom: 20px; }
.hero-avatar { margin: 0 auto 12px; }
h3 { margin: 0 0 4px; font-size: var(--uc-fs-xl); font-weight: 650; color: var(--uc-text); }
.topic { margin: 0; font-size: var(--uc-fs-sm); color: var(--uc-text-muted); line-height: 1.5; }

.rename input {
  width: 100%;
  text-align: center;
  font: inherit;
  color: var(--uc-text);
  border: 1px solid transparent;
  border-radius: var(--uc-r-xs);
  padding: 6px 9px;
  background: transparent;
  outline: none;
  transition: background var(--uc-t-fast), border-color var(--uc-t-fast);
}
.rename input:hover { background: var(--uc-surface); }
.rename input:focus { border-color: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.5); background: var(--uc-surface-2); }
.rename input:first-child { font-size: var(--uc-fs-xl); font-weight: 650; }
.topic-input { margin-top: 4px; font-size: var(--uc-fs-sm); color: var(--uc-text-muted); }
.rename input::placeholder { color: var(--uc-text-dim); }

.toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 12px;
  margin-bottom: 20px;
  border-radius: var(--uc-r-sm);
  background: var(--uc-surface);
  border: 1px solid var(--uc-border);
  cursor: pointer;
  transition: background var(--uc-t-fast);
}
.toggle:hover { background: var(--uc-surface-2); }
.toggle input { margin-top: 3px; accent-color: var(--uc-brand-1); }
.toggle strong { display: block; font-size: var(--uc-fs-md); color: var(--uc-text-soft); font-weight: 600; }
.toggle small { display: block; margin-top: 3px; font-size: var(--uc-fs-xs); color: var(--uc-text-dim); line-height: 1.45; }

section { margin-bottom: 20px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
h4 {
  margin: 0;
  font-size: var(--uc-fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--uc-text-dim);
}
.count { font-size: var(--uc-fs-xs); color: var(--uc-text-dim); }
.link {
  border: 0;
  background: none;
  color: var(--uc-brand-soft);
  font: inherit;
  font-size: var(--uc-fs-sm);
  font-weight: 600;
  cursor: pointer;
}
.link:hover { text-decoration: underline; }

/* -------------------------------------------------------- shared media */
.media-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
.media-cell {
  position: relative;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid var(--uc-border);
  border-radius: var(--uc-r-xs);
  overflow: hidden;
  background: var(--uc-surface);
  cursor: pointer;
  transition: transform var(--uc-t-fast), border-color var(--uc-t-fast);
}
.media-cell:hover { transform: scale(1.04); border-color: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.5); }
/* The thumbnails are 24px data URLs blown up to fill the cell, so the blur is
   deliberate — at that size the pixels would be the only thing visible. */
.media-cell img { width: 100%; height: 100%; object-fit: cover; filter: blur(1.5px); transform: scale(1.06); }
.media-fallback { display: grid; place-items: center; width: 100%; height: 100%; color: var(--uc-text-dim); }

/* ------------------------------------------------------------ members */
.members { list-style: none; margin: 0; padding: 0; }
.members li {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 6px;
  border-radius: var(--uc-r-xs);
  transition: background var(--uc-t-fast);
}
.members li:hover { background: var(--uc-surface); }
.who { flex: 1; min-width: 0; }
.name {
  display: block;
  font-size: var(--uc-fs-md);
  color: var(--uc-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name em { font-style: normal; color: var(--uc-text-dim); font-size: var(--uc-fs-xs); }
.online { display: block; font-size: var(--uc-fs-xs); color: var(--uc-online); font-weight: 600; }
.full {
  display: block;
  font-size: var(--uc-fs-xs);
  color: var(--uc-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role {
  padding: 2px 8px;
  border-radius: var(--uc-r-full);
  font-size: var(--uc-fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.role.owner { background: rgb(var(--sfs-warning-rgb, 251 191 36) / 0.18); color: var(--sfs-warning-text, #fcd34d); }
.role.admin { background: rgb(var(--sfs-accent-rgb, 129 140 248) / 0.2); color: var(--sfs-text-muted, #c7d2fe); }

.row-actions { display: flex; align-items: center; gap: 3px; }
.row-actions select {
  font: inherit;
  font-size: var(--uc-fs-xs);
  padding: 3px 5px;
  border: 1px solid var(--uc-border);
  border-radius: var(--uc-r-xs);
  background: rgb(var(--sfs-surface-rgb, 20 22 48) / 0.95);
  color: var(--uc-text-soft);
  cursor: pointer;
}
.row-actions select option { background: var(--sfs-surface-2, #14162f); color: var(--sfs-text, #fff); }
.uc-icon-btn.tiny { width: 24px; height: 24px; flex: 0 0 24px; }
.uc-icon-btn.danger:hover { background: var(--uc-danger-bg); color: var(--uc-danger); }

/* -------------------------------------------------------------- facts */
.facts p {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 7px;
  font-size: var(--uc-fs-sm);
  color: var(--uc-text-soft);
}
.facts span { color: var(--uc-text-dim); }

footer {
  flex: 0 0 auto;
  border-top: 1px solid var(--uc-border);
  padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));
  display: grid;
  gap: 8px;
}
.uc-danger-btn {
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--uc-r-xs);
  border: 1px solid var(--uc-danger-border);
  background: transparent;
  color: var(--uc-danger);
  font: inherit;
  font-size: var(--uc-fs-md);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--uc-t-fast);
}
.uc-danger-btn:hover { background: var(--uc-danger-bg); }
/* `--sfs-on-danger`, not the page ink: the button is filled with the danger
   hue, and the page ink is near-black in a light galaxy — 3.48:1 on a Delete
   button, which is the one control that must not be misread. */
.uc-danger-btn.solid { background: rgb(var(--sfs-danger-rgb, 220 38 38) / 0.85); border-color: transparent; color: var(--sfs-on-danger, #fff); }
.uc-danger-btn.solid:hover { background: var(--sfs-danger, rgba(220, 38, 38, 1));   /* Its own ink. The base rule this shares with the other variants can only
     hold one `color`, and that one belongs to whichever variant came first —
     so an amber or green button inherited the ink meant for the indigo one.
     A fill decides its own ink. */
  color: var(--sfs-on-danger, #fff);
}
</style>
