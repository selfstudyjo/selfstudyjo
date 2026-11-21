<template>
  <fieldset class="cvl">
    <legend class="cvl__legend">{{ $t('What type of CV do you want?') }}</legend>
    <div class="cvl__options" role="radiogroup">
      <button
        type="button" role="radio" class="cvl__opt" :class="{ 'is-on': modelValue === 'detailed' }"
        :aria-checked="modelValue === 'detailed'" @click="$emit('update:modelValue', 'detailed')"
      >
        <span class="cvl__title">{{ $t('Detailed (long form)') }}</span>
        <span class="cvl__note">{{ $t('Every role names the tools, technologies and skills you used, aligned with the job description.') }}</span>
      </button>
      <button
        type="button" role="radio" class="cvl__opt" :class="{ 'is-on': modelValue === 'concise' }"
        :aria-checked="modelValue === 'concise'" @click="$emit('update:modelValue', 'concise')"
      >
        <span class="cvl__title">{{ $t('Concise (one page)') }}</span>
        <span class="cvl__note">{{ $t('Short, plain-language bullets per role and your key skills in one Skills section. You tell the details in the interview.') }}</span>
      </button>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
/**
 * Long form or short form, asked before the AI writes anything (2026-11-21).
 * The two options are written out (not a v-for over a table) so every label is
 * a literal $t() call that check:i18n can see.
 */
import type { CvLength } from '@/services/cvbuilder.service';

defineProps<{ modelValue: CvLength }>();
defineEmits<{ (e: 'update:modelValue', value: CvLength): void }>();
</script>

<style scoped>
.cvl { border: 0; margin: 0 0 1rem; padding: 0; min-width: 0; }
.cvl__legend { font-weight: 600; margin-bottom: 0.5rem; color: var(--sfs-text, #e8eaf6); }
.cvl__options { display: grid; gap: 0.6rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); }
.cvl__opt {
  display: flex; flex-direction: column; gap: 0.25rem; text-align: start; cursor: pointer;
  padding: 0.75rem 0.9rem; border-radius: 0.75rem; min-width: 0;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
  color: var(--sfs-text, #e8eaf6); font: inherit;
}
.cvl__opt:hover { border-color: var(--sfs-accent, #667eea); }
.cvl__opt.is-on {
  border: 2px solid var(--sfs-accent, #667eea);
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.14);
}
.cvl__opt:focus-visible { outline: 2px solid var(--sfs-accent, #667eea); outline-offset: 2px; }
.cvl__title { font-weight: 600; }
.cvl__note { font-size: 0.85rem; color: var(--sfs-text-muted, #b8bdd8); overflow-wrap: anywhere; }
</style>
