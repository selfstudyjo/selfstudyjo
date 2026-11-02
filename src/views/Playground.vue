<template>
  <!--
    ONE PLAYGROUND: a tool's free-practice workspace, independent of any lab.

    Underneath it is app 11's `play-<tool>` record - unpublished, a
    `workspace`, no tasks (the `carla-studio` precedent) - so this is the lab
    workspace in PLAYGROUND mode: every console, editor, dashboard and portal
    the tool has, over the student's own saved environment, and no brief, no
    tasks, no Check my work and no progress record.

    `:key` on the id, because moving from /playground/play-aws to
    /playground/play-azure through the menu reuses this component, and a
    workspace that kept the first tool's panes mounted would be AWS consoles
    under an Azure title.
  -->
  <div class="sfs-pg-page">
    <LabWorkspace v-if="valid" :key="id" :lab-id="id" playground />
    <section v-else class="sfs-pg-missing">
      <h1>{{ $t('There is no playground with that name.') }}</h1>
      <router-link to="/playgrounds" class="sfs-pg-missing__link">
        {{ $t('See every playground') }}
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import LabWorkspace from '@/views/LabWorkspace.vue';
import { isPlaygroundId } from '@/utils/playgrounds';

const props = defineProps<{ playgroundId?: string }>();
const route = useRoute();

const id = computed(() => String(props.playgroundId || route.params.playgroundId || ''));
// Only a `play-*` id is opened here. Anything else is a lab id typed into the
// wrong address, and opening it in playground mode would hide a real lab's
// tasks while leaving its grading live.
const valid = computed(() => isPlaygroundId(id.value));
</script>

<style scoped>
.sfs-pg-missing {
  max-width: 36rem;
  margin: 3rem auto;
  padding: 1.5rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  border-radius: 14px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  text-align: center;
}
.sfs-pg-missing h1 { margin: 0 0 0.8rem; font-size: 1.15rem; }
.sfs-pg-missing__link { color: var(--sfs-accent-text, #a5b4fc); font-weight: 700; }
</style>
