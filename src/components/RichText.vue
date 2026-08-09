<template>
  <!--
    Renders user-written text with its links, addresses and mentions live.

    `v-html` here is safe for one specific reason: `linkify()` escapes the
    whole input before it inserts anything, and the only tags in its output are
    ones it built itself. Do not pass anything through this that has NOT been
    through linkify — that is the entire contract of the component.
  -->
  <component
    :is="tag"
    class="rich-text"
    :class="{ 'on-fill': onFill, measured }"
    v-html="html"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { linkify, type LinkifyOptions } from '@/utils/linkify';

const props = withDefaults(defineProps<{
  /** The raw, untrusted text. */
  text?: string | null;
  /** Element to render as. A message body is a <p>; a title is a <span>. */
  tag?: string;
  /**
   * The text sits on a filled surface — a sent chat bubble, a coloured
   * banner — rather than on the page. Links then take the fill's ink
   * (`--sfs-on-accent`) instead of the surface-derived accent, which is the
   * difference between a readable link and a dark blue one on indigo.
   */
  onFill?: boolean;
  /** Constrain to a comfortable reading measure. Off for chat bubbles. */
  measured?: boolean;
  /** Render `@name` as a mention. */
  mentions?: boolean;
  /** Where a mention points. */
  mentionHref?: (username: string) => string | null;
}>(), {
  text: '',
  tag: 'p',
  onFill: false,
  measured: false,
  mentions: true,
});

const html = computed(() => {
  const options: LinkifyOptions = {
    mentions: props.mentions,
    mentionHref: props.mentionHref,
  };
  return linkify(props.text ?? '', options);
});
</script>
