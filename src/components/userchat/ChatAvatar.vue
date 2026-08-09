<template>
  <span
    class="uc-avatar"
    :class="[`uc-size-${size}`, { 'uc-ring': ring }]"
    :title="title || name"
  >
    <!-- The clipping happens on this inner layer, not on the root — see the note
         above `.uc-dot`. -->
    <span class="uc-face" :style="loaded ? { background: 'transparent' } : paint(colour)">
      <img
        v-if="src && !failed"
        :src="src"
        :alt="name"
        loading="lazy"
        decoding="async"
        @load="loaded = true"
        @error="onError"
      />
      <span v-else class="uc-initials">{{ initials }}</span>
    </span>
    <span v-if="online" class="uc-dot" aria-hidden="true"></span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { paint } from '@/theme/contrast';

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
/*
  ---------------------------------------------------------------------------
  Every class here is `uc-`-prefixed, and that is load-bearing rather than
  tidiness.

  This app has no CSS scoping at the page level: all 36 files in
  `src/assets/css/` are imported from view modules and bundled into one global
  `index.css` that is live on every route. A scoped block stops *our* rules
  leaking out; it does nothing to stop *their* rules leaking in. This component
  was previously `class="avatar"`, and `side-nav.css` has an unscoped

      .avatar { width: 40px; height: 40px; min-width: 40px; border: 2px solid …; }

  Our `width: 34px` won its specificity fight, `min-width: 40px` had nothing to
  fight, and the result was a 40 × 34 ellipse with a stray border on it — every
  face in the feature. Before adding a class anywhere under `.uc-root`, check it:

      grep -rnE "(^|,\s*)\.<name>\s*(,|\{)" src/assets/css/*.css src/style.css
  ---------------------------------------------------------------------------
*/
.uc-avatar {
  position: relative;
  flex: 0 0 auto;
  display: inline-block;
  border-radius: 50%;
  user-select: none;
  /*
    Deliberately NOT `overflow: hidden`. The root is the positioning context for
    the presence dot, which sits on the rim at the bottom-right — outside the
    circle. Clipping here is what made the dot invisible: it was hidden by the
    very `border-radius` + `overflow` pair meant to round the photograph. The
    clip belongs one level in, on `.uc-face`.
  */
}

.uc-face {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  color: var(--sfs-text, #fff);
  font-weight: 700;
  transition: background 0.2s;
}

.uc-face img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.uc-initials { line-height: 1; letter-spacing: 0.02em; }

/* `min-width` / `min-height` are stated alongside `width` / `height` on purpose:
   they are the two properties a stray global rule can set without contradicting
   anything of ours, and they are exactly how this went oval. */
.uc-size-sm { width: 26px; height: 26px; min-width: 26px; min-height: 26px; font-size: 0.6rem; }
.uc-size-md { width: 36px; height: 36px; min-width: 36px; min-height: 36px; font-size: 0.74rem; }
.uc-size-lg { width: 46px; height: 46px; min-width: 46px; min-height: 46px; font-size: 0.86rem; }
.uc-size-xl { width: 72px; height: 72px; min-width: 72px; min-height: 72px; font-size: 1.3rem; }

.uc-ring { box-shadow: 0 0 0 2px var(--uc-avatar-cut, #fff), 0 0 0 4px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.5); }

/*
  The presence dot.

  Its halo has to be the colour of whatever is *behind* the avatar, not white:
  the ring is what separates the dot from the picture underneath, and a white one
  on the dark chat panel reads as a bright speck stuck to somebody's ear.
  `--uc-avatar-cut` is set on `.uc-root`; the `#fff` fallback keeps this component
  usable on a light surface elsewhere.
*/
.uc-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 30%;
  height: 30%;
  min-width: 9px;
  min-height: 9px;
  border-radius: 50%;
  background: var(--uc-online, #16a34a);
  box-shadow: 0 0 0 2px var(--uc-avatar-cut, #fff);
}
/* A little more presence on the two large sizes, where 30% of the circle is a
   dot big enough to look like a mistake if it is not deliberately placed. */
.uc-size-lg .uc-dot,
.uc-size-xl .uc-dot { right: 2px; bottom: 2px; width: 24%; height: 24%; }
</style>
