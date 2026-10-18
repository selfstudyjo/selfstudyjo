<template>
  <div class="cs-head" :class="'cs-head--' + level">
    <div class="cs-head__row">
      <div class="cs-head__title">
        <component :is="level === 1 ? 'h1' : 'h2'" class="cs-head__h">
          {{ title }}<span v-if="counter !== undefined && counter !== ''" class="cs-head__counter"> ({{ counter }})</span>
        </component>
        <a v-if="info" class="cs-head__info" href="#" @click.prevent>Info</a>
      </div>
      <div v-if="$slots.actions" class="cs-head__actions"><slot name="actions" /></div>
    </div>
    <p v-if="description" class="cs-head__desc">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string; counter?: string | number; description?: string; info?: boolean; level?: 1 | 2;
}>(), { info: true, level: 1, description: '', counter: undefined });
</script>

<style scoped>
.cs-head { margin-bottom: 16px; }
.cs-head--2 { margin-bottom: 0; }
.cs-head__row { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 8px 16px; }
.cs-head__title { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-wrap: wrap; }
.cs-head__h { margin: 0; color: #0f141a; font-weight: 700; word-break: break-word; }
.cs-head--1 .cs-head__h { font-size: 24px; line-height: 30px; }
.cs-head--2 .cs-head__h { font-size: 18px; line-height: 22px; }
.cs-head__counter { font-weight: 400; color: #656871; }
.cs-head__info { font-size: 12px; font-weight: 700; color: #006ce0; text-decoration: none; }
.cs-head__info:hover { text-decoration: underline; }
.cs-head__actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cs-head__desc { margin: 4px 0 0; color: #656871; font-size: 14px; line-height: 20px; max-width: 900px; }
</style>
