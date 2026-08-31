<template>
  <article class="sl-brief">
    <template v-for="(block, index) in parsed" :key="index">
      <h4 v-if="block.kind === 'heading'" class="sl-brief__heading">{{ block.text }}</h4>

      <!--
        A CODE block is `dir="ltr"` and always monospaced, in every language.

        This is the most valuable rule in the whole lab UI. Rendered
        right-to-left the bidi algorithm reorders the punctuation, so
        `hdfs dfs -du -h -s /data` comes out with the flags and the path moved
        and a student copying it gets a command that does not run - and these
        labs are made almost entirely of commands. `rtl.css` pins every `<pre>`
        for the same reason; this says it locally because the element is built
        here.
      -->
      <pre v-else-if="block.kind === 'code'" class="sl-brief__code" dir="ltr"
      >{{ block.text }}</pre>

      <blockquote v-else-if="block.kind === 'note'" class="sl-brief__note">
        <RichText :text="block.text" />
      </blockquote>

      <ol v-else-if="block.kind === 'list' && block.ordered"
          class="sl-brief__list" :start="block.start">
        <li v-for="(item, at) in block.items" :key="at">
          <RichText :text="item" />
        </li>
      </ol>

      <ul v-else-if="block.kind === 'list'" class="sl-brief__list">
        <li v-for="(item, at) in block.items" :key="at">
          <RichText :text="item" />
        </li>
      </ul>

      <p v-else class="sl-brief__para"><RichText :text="block.text" /></p>
    </template>

    <p v-if="parsed.length === 0" class="sl-brief__empty">
      {{ $t('This lab has no brief yet.') }}
    </p>
  </article>
</template>

<script setup lang="ts">
/**
 * A lab's brief, rendered with the SAME parser the lesson page uses.
 *
 * The same parser deliberately: a lab brief and a lesson write-up are both
 * operator-written text in the same five-marker notation, and two parsers would
 * mean a heading that renders on one page and not the other. `lessonContent.ts`
 * is already a plain module with `check:lessoncontent` over it, so this gets
 * that coverage for free.
 *
 * **Nothing here reaches `v-html`.** A brief is a record fetched over the
 * network from a service whose write path is reachable with the shared token,
 * rendered on a page that carries the session. `RichText` escapes before it
 * inserts the anchors it built itself - which is the rule the one place that
 * ignored it taught this platform the hard way.
 */
import { computed } from 'vue';
import RichText from '@/components/RichText.vue';
import { blocks } from '@/utils/lessonContent';

const props = defineProps<{ text: string }>();

const parsed = computed(() => blocks(props.text));
</script>
