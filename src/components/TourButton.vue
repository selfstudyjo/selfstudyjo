<template>
  <button
    type="button"
    class="sfs-tour-btn"
    :aria-pressed="open"
    :title="$t('Take a guided tour of this page')"
    @click="toggle"
  >
    <Compass class="sfs-tour-btn__i" />
    <span class="sfs-tour-btn__label">{{ $t('Tour') }}</span>
  </button>
</template>

<script setup lang="ts">
/**
 * The control that starts the tour.
 *
 * Its own component for one reason: it appears twice - in the top bar, which is
 * every page, and in the lab workspace's header, which is the one page the top
 * bar is deliberately hidden on. Two copies of the markup is two places for the
 * class name the tour's own last step POINTS AT to drift, and a step whose
 * target has been renamed is silently dropped.
 *
 * It shows its own pressed state because a control that starts something and
 * then looks exactly as it did before is one people press twice - and pressing
 * it twice stops the tour they just started.
 */
import { Compass } from 'lucide-vue-next';
import { useTour } from '@/composables/useTour';

const { open, toggle } = useTour();
</script>
