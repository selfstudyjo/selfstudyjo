<template>
  <button
    type="button"
    class="sfs-bot-btn"
    :class="{ 'is-open': open }"
    :aria-pressed="open"
    :aria-label="label"
    :title="label"
    @click="toggle"
  >
    <!--
      A PERSON, not a speech bubble and not a robot.

      The window behind this button renders a rendered human who looks at you
      and talks; a chat glyph would promise a text box and a robot glyph would
      promise something that cannot be asked a question in a sentence. The
      support widget (app 9) already owns the speech bubble in the bottom-right
      corner of every page, so a second one here would read as the same feature
      twice — and they are not the same feature at all: that one reaches a
      human operator and this one does not.
    -->
    <UserRound class="sfs-bot-btn__i" />
    <span class="sfs-bot-btn__label">{{ $t('Assistant') }}</span>
    <span class="sfs-bot-btn__dot" aria-hidden="true"></span>
  </button>
</template>

<script setup lang="ts">
/**
 * The control that opens Noor.
 *
 * Its own component because it appears twice — in the top bar, which is every
 * page, and in the lab workspace's header, which is the one page the top bar is
 * deliberately hidden on. That is the same arrangement `TourButton` has and for
 * the same reason: two copies of the markup is two places for the class name to
 * drift, and one of the two would then be missing whatever the other gained.
 *
 * It shows its own pressed state because a control that opens something and
 * then looks exactly as it did before is one people press twice — and pressing
 * it twice closes the window they just opened.
 */
import { computed } from 'vue';
import { UserRound } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';
// The SMALL module, not the engine: this button is on every page and the
// engine is 35 kB of prompt builder it has no use for (working rule 47).
import { BUTTON_LABEL } from '@/utils/assistantCast';
import { t } from '@/i18n/runtime';

const { open, cast, toggle } = useAssistant();

/*
  The button NAMES whoever is on duty, and the name goes through `$t` too — an
  Arabic reader is offered نور or عمر rather than a Latin run inside Arabic
  prose. Computed rather than inline so both `aria-label` and `title` are the
  one string: a screen reader announcing a different name from the tooltip is
  the sort of thing nobody notices and nobody can explain afterwards.
*/
const label = computed(() => t(BUTTON_LABEL, { bot: t(cast.value.name) }));
</script>
