<template>
  <span class="sc" :class="'sc--' + tone">
    <DbtIcon :name="tone === 'ok' ? 'ok' : tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : tone === 'skip' ? 'skip' : 'none'" />
    <span>{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
/** A last-run status as dbt Explorer shows it: an icon and the word. */
import { computed } from 'vue';
import DbtIcon from './DbtIcon.vue';
import { statusTone } from './dbt';

const props = defineProps<{ status: string | null | undefined; empty?: string }>();
const tone = computed(() => statusTone(props.status));
const label = computed(() => {
  const s = String(props.status ?? '');
  if (!s) return props.empty || 'Not run';
  return s.charAt(0).toUpperCase() + s.slice(1);
});
</script>

<style scoped>
.sc { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; white-space: nowrap; color: #262A38; }
.sc .dbt-ico { width: 15px; height: 15px; }
.sc--ok .dbt-ico { color: #178A4F; }
.sc--bad .dbt-ico { color: #C8352B; }
.sc--warn .dbt-ico { color: #B26100; }
.sc--skip .dbt-ico, .sc--none .dbt-ico { color: #8A92A6; }
.sc--none { color: #5C6378; font-weight: 400; }
</style>
