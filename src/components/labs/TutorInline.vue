<template>
  <!--
    One line of a tutor answer, with `inline code` and **strong** drawn as
    elements. Every span is DATA from `inlineSpans` and every piece of prose
    goes through `RichText`, which escapes before it inserts the anchors it
    builds - so nothing a model wrote reaches the DOM as markup (working rule 13).
  -->
  <span class="sl-inline">
    <template v-for="(span, index) in spans" :key="index">
      <code v-if="span.kind === 'code'" class="sl-inline__code" dir="ltr">{{ span.text }}</code>
      <strong v-else-if="span.kind === 'strong'" class="sl-inline__strong"><RichText
        :text="span.text" tag="span" :mentions="false" /></strong>
      <RichText v-else :text="span.text" tag="span" :mentions="false" />
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import RichText from '@/components/RichText.vue';
import { inlineSpans } from '@/utils/aichatMarkdown';

const props = defineProps<{ text: string }>();

const spans = computed(() => inlineSpans(props.text));
</script>
