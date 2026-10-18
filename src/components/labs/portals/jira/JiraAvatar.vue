<template>
  <span class="ja" :class="{ 'ja--empty': !name, 'ja--square': square }"
        :style="style" :title="title === false ? undefined : (name || 'Unassigned')"
        role="img" :aria-label="name || 'Unassigned'">
    <svg v-if="!name" viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <circle cx="12" cy="9.5" r="4" fill="#fff" />
      <path d="M4.8 20.2c1.3-3.5 4-5.2 7.2-5.2s5.9 1.7 7.2 5.2" fill="#fff" />
    </svg>
    <template v-else>{{ letters }}</template>
  </span>
</template>

<script setup lang="ts">
/** Jira's round avatar: initials on a stable colour, a silhouette when unassigned. */
import { computed } from 'vue';
import { avatarColour, initials } from './jiraKit';

const props = withDefaults(defineProps<{ name?: string; size?: number; square?: boolean;
                                          title?: boolean }>(),
                           { name: '', size: 24, square: false, title: true });

const letters = computed(() => initials(props.name));
const style = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  fontSize: Math.max(9, Math.round(props.size * 0.42)) + 'px',
  background: props.name ? avatarColour(props.name) : '#8590A2',
}));
</script>

<style scoped>
.ja {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  border-radius: 50%; color: #fff; font-weight: 600; letter-spacing: 0;
  line-height: 1; overflow: hidden; user-select: none;
  box-shadow: 0 0 0 2px var(--j-surface, #fff);
}
.ja--square { border-radius: 4px; }
.ja--empty { padding: 2px; }
</style>
