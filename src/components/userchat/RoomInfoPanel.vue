<template>
  <aside class="panel">
    <header>
      <h2>{{ isDirect ? 'Conversation' : 'Group' }}</h2>
      <button type="button" class="icon-btn" aria-label="Close details" @click="$emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </header>

    <div class="body">
      <div class="hero">
        <div class="hero-avatar" :style="{ background: room.avatar_color || '#2563eb' }">
          {{ initials(title) }}
        </div>
        <div v-if="canAdminister && !isDirect" class="rename">
          <input
            v-model="nameDraft"
            type="text"
            maxlength="120"
            aria-label="Group name"
            @blur="saveName"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          />
          <input
            v-model="topicDraft"
            type="text"
            maxlength="500"
            class="topic-input"
            placeholder="Add a topic…"
            aria-label="Topic"
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
          <strong>Mute this conversation</strong>
          <small>No chime and no notification email. The messages still arrive.</small>
        </span>
      </label>

      <section>
        <div class="section-head">
          <h4>{{ members.length }} {{ members.length === 1 ? 'person' : 'people' }}</h4>
          <button
            v-if="canAdminister && !isDirect"
            type="button"
            class="link"
            @click="$emit('add-member')"
          >Add</button>
        </div>

        <ul class="members">
          <li v-for="person in members" :key="person.user_id">
            <span class="avatar" :style="{ background: colourFor(person.user_id) }">
              {{ initials(person.username || person.user_id) }}
            </span>
            <span class="who">
              <span class="name">
                {{ person.username || 'Unknown user' }}
                <em v-if="person.user_id === userId">(you)</em>
              </span>
              <span v-if="onlineIds.has(person.user_id)" class="online">online</span>
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
                aria-label="Role"
                @change="$emit('role', person.user_id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option v-if="myRole === 'owner'" value="owner">Owner</option>
              </select>
              <button
                type="button"
                class="icon-btn danger"
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
        <p><span>Started</span> {{ formatDate(room.created_at) }}</p>
        <p v-if="room.created_by_username"><span>By</span> {{ room.created_by_username }}</p>
        <p v-if="room.message_count !== undefined"><span>Messages</span> {{ room.message_count }}</p>
      </section>
    </div>

    <footer>
      <button type="button" class="danger-btn" @click="$emit('leave')">
        Leave this conversation
      </button>
      <!-- Delete is the owner's alone, and it is destructive for everybody in the
           room rather than just for them - so it is separated from Leave and
           labelled with what it actually does. -->
      <button v-if="myRole === 'owner'" type="button" class="danger-btn solid" @click="$emit('delete')">
        Delete for everyone
      </button>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { ChatMember, ChatRoom, RoomRole } from '@/services/userchat.service';

const props = defineProps<{
  room: ChatRoom;
  members: ChatMember[];
  userId: string;
  myRole: RoomRole;
  onlineIds: Set<string>;
  title: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'mute', value: boolean): void;
  (e: 'add-member'): void;
  (e: 'role', userId: string, role: string): void;
  (e: 'remove', userId: string): void;
  (e: 'leave'): void;
  (e: 'delete'): void;
  (e: 'rename', values: { name?: string; topic?: string }): void;
}>();

const RANK: Record<string, number> = { member: 1, admin: 2, owner: 3 };
const PALETTE = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2',
  '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#c026d3',
];

const isDirect = computed(() => props.room.kind === 'direct');
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

function colourFor(id: string) {
  let sum = 0;
  for (const ch of String(id || '')) sum += ch.charCodeAt(0);
  return PALETTE[sum % PALETTE.length];
}

function initials(name: string) {
  return String(name || '?').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}
</script>

<style scoped>
.panel {
  width: 300px; flex: 0 0 300px;
  display: flex; flex-direction: column;
  border-left: 1px solid rgba(15, 23, 42, 0.08);
  background: #fff;
}
header { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px 11px; border-bottom: 1px solid rgba(15, 23, 42, 0.07); }
h2 { margin: 0; font-size: 0.92rem; color: #0f172a; }

.body { flex: 1; overflow-y: auto; padding: 16px 14px; }

.hero { text-align: center; margin-bottom: 18px; }
.hero-avatar {
  width: 62px; height: 62px; margin: 0 auto 10px;
  border-radius: 50%; display: grid; place-items: center;
  color: #fff; font-size: 1.2rem; font-weight: 700;
}
h3 { margin: 0 0 4px; font-size: 1rem; color: #0f172a; }
.topic { margin: 0; font-size: 0.81rem; color: #64748b; line-height: 1.45; }

.rename input {
  width: 100%; text-align: center; font: inherit;
  border: 1px solid transparent; border-radius: 7px; padding: 5px 8px;
  background: transparent; outline: none;
}
.rename input:hover { background: #f1f5f9; }
.rename input:focus { border-color: #2563eb; background: #fff; }
.rename input:first-child { font-size: 1rem; font-weight: 600; color: #0f172a; }
.topic-input { margin-top: 3px; font-size: 0.81rem; color: #64748b; }

.toggle {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 9px 10px; margin-bottom: 18px;
  border-radius: 9px; background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.07);
  cursor: pointer;
}
.toggle input { margin-top: 2px; }
.toggle strong { display: block; font-size: 0.82rem; color: #1e293b; font-weight: 600; }
.toggle small { display: block; margin-top: 2px; font-size: 0.73rem; color: #64748b; line-height: 1.4; }

section { margin-bottom: 18px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
h4 { margin: 0; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
.link { border: 0; background: none; color: #2563eb; font-size: 0.79rem; font-weight: 600; cursor: pointer; }

.members { list-style: none; margin: 0; padding: 0; }
.members li { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 8px; }
.members li:hover { background: #f8fafc; }
.avatar { width: 30px; height: 30px; flex: 0 0 30px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 0.68rem; font-weight: 700; }
.who { flex: 1; min-width: 0; }
.name { display: block; font-size: 0.84rem; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name em { font-style: normal; color: #94a3b8; font-size: 0.76rem; }
.online { display: block; font-size: 0.71rem; color: #16a34a; font-weight: 600; }
.full { display: block; font-size: 0.72rem; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.role {
  padding: 1px 7px; border-radius: 999px;
  font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;
}
.role.owner { background: #fef3c7; color: #92400e; }
.role.admin { background: #dbeafe; color: #1e40af; }

.row-actions { display: flex; align-items: center; gap: 3px; }
.row-actions select {
  font: inherit; font-size: 0.72rem; padding: 2px 4px;
  border: 1px solid rgba(15, 23, 42, 0.14); border-radius: 6px;
  background: #fff; color: #475569; cursor: pointer;
}

.facts p { display: flex; justify-content: space-between; gap: 10px; margin: 0 0 5px; font-size: 0.78rem; color: #475569; }
.facts span { color: #94a3b8; }

footer { border-top: 1px solid rgba(15, 23, 42, 0.08); padding: 11px 14px 13px; display: grid; gap: 7px; }
.danger-btn {
  width: 100%; padding: 8px 12px; border-radius: 8px;
  border: 1px solid #fecaca; background: #fff; color: #b91c1c;
  font-size: 0.83rem; font-weight: 600; cursor: pointer;
}
.danger-btn:hover { background: #fef2f2; }
.danger-btn.solid { background: #dc2626; border-color: #dc2626; color: #fff; }
.danger-btn.solid:hover { background: #b91c1c; }

.icon-btn { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 50%; background: none; color: #64748b; cursor: pointer; }
.icon-btn:hover { background: #e2e8f0; }
.icon-btn.danger:hover { background: #fee2e2; color: #b91c1c; }
</style>
