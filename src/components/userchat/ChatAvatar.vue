<template>
  <span
    class="avatar"
    :class="[`size-${size}`, { ring }]"
    :style="{ background: loaded ? 'transparent' : colour }"
    :title="title || name"
  >
    <img
      v-if="src && !failed"
      :src="src"
      :alt="name"
      loading="lazy"
      decoding="async"
      @load="loaded = true"
      @error="onError"
    />
    <span v-else class="initials">{{ initials }}</span>
    <span v-if="online" class="dot" aria-hidden="true"></span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { avatarDirectory } from './avatarDirectory';

/**
 * One person's avatar: their profile picture if they have one, their initials if
 * not.
 *
 * The picture is not on the chat records — app 35 stores a user id and a display
 * name and nothing else, deliberately, because a copy of somebody's avatar URL on
 * every message is a copy that goes stale the moment they change it. It is
 * resolved through `avatarDirectory`, which batches and caches the lookups
 * against app 13, so a room list of forty conversations costs one request rather
 * than forty.
 *
 * The initials are kept underneath the picture rather than replaced by it: the
 * coloured circle paints immediately, the photo fades in over it, and a broken or
 * missing image falls back without ever showing a blank hole.
 */
const props = withDefaults(defineProps<{
  userId: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  ring?: boolean;
  title?: string;
  /** Use this picture and do not look one up. For the signed-in user, whose
   *  avatar the auth store already has — asking app 13 for it again would be a
   *  request per page for something already in memory. */
  imageUrl?: string;
  /** Whether `userId` is a real person to look up in the profile directory.
   *
   *  False for a group room, where the id passed in is the *room* id: it is there
   *  to give the circle a stable colour, and looking it up would ask app 13 about
   *  something that is not a user and cache the miss for ever. An empty
   *  `imageUrl` cannot express this — it is falsy, so it reads as "not supplied".
   */
  lookup?: boolean;
}>(), { size: 'md', name: '', online: false, ring: false, lookup: true });

const failed = ref(false);
const loaded = ref(false);

const PALETTE = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2',
  '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#c026d3',
];

/** The same rule the backend's presence module uses, so a person is the same
 *  colour here, in the member list and beside their messages. */
const colour = computed(() => {
  const text = String(props.userId || props.name || '');
  if (!text) return PALETTE[0];
  let sum = 0;
  for (const ch of text) sum += ch.charCodeAt(0);
  return PALETTE[sum % PALETTE.length];
});

const initials = computed(() => {
  const source = props.name || props.userId || '?';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});

const resolved = ref('');
const src = computed(() => props.imageUrl || resolved.value);

watch(() => [props.userId, props.imageUrl, props.lookup] as const,
      async ([id, explicit, lookup]) => {
  failed.value = false;
  loaded.value = false;
  resolved.value = '';
  if (explicit || !id || !lookup) return;
  const url = await avatarDirectory.urlFor(id);
  // The id may have changed while the lookup was in flight — a room list being
  // scrolled reuses these components — and writing a stale answer would put the
  // wrong face on somebody.
  if (url && props.userId === id) resolved.value = url;
}, { immediate: true });

function onError() {
  // One failure is enough. Retrying a broken avatar on every re-render is how a
  // list of forty people becomes forty repeating failed requests.
  failed.value = true;
  loaded.value = false;
  if (props.userId) avatarDirectory.markBroken(props.userId);
}
</script>

<style scoped>
.avatar {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 700;
  overflow: hidden;
  user-select: none;
  transition: background 0.2s;
}

.avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.initials { line-height: 1; letter-spacing: 0.02em; }

.size-sm { width: 26px; height: 26px; font-size: 0.6rem; }
.size-md { width: 34px; height: 34px; font-size: 0.72rem; }
.size-lg { width: 44px; height: 44px; font-size: 0.85rem; }
.size-xl { width: 66px; height: 66px; font-size: 1.25rem; }

.ring { box-shadow: 0 0 0 2px var(--uc-avatar-cut, #fff), 0 0 0 3.5px rgba(129, 140, 248, 0.45); }

/*
  The presence dot sits on the ring rather than inside the circle, so it is not
  clipped by `overflow: hidden` on a picture.

  Its halo has to be the colour of whatever is *behind* the avatar, not white:
  the ring is what separates the dot from the picture underneath, and a white
  one on the dark chat panel reads as a bright speck stuck to somebody's ear.
  `--uc-avatar-cut` is set by the Messages page; the `#fff` fallback keeps this
  component usable on a light surface elsewhere.
*/
.dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 30%;
  height: 30%;
  min-width: 8px;
  min-height: 8px;
  border-radius: 50%;
  background: var(--uc-online, #16a34a);
  box-shadow: 0 0 0 2px var(--uc-avatar-cut, #fff);
}
</style>
