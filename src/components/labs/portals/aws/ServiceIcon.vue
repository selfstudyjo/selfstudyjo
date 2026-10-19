<template>
  <span class="svc-icon" :class="{ 'svc-icon--small': small, 'svc-icon--large': large }"
        :style="{ background: color }" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
      <!-- Simplified white glyphs in the spirit of the AWS architecture icons -->
      <template v-if="id === 's3'"><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6l1.6 11.5c.2 1.5 2.6 2.5 5.4 2.5s5.2-1 5.4-2.5L19 6" /><path d="M12 11l5 2" /></template>
      <template v-else-if="id === 'ec2'"><rect x="6" y="6" width="12" height="12" /><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" /></template>
      <template v-else-if="id === 'vpc'"><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 4V2M16 4V2M4 12H2M22 12h-2" /><circle cx="12" cy="12" r="3" /></template>
      <template v-else-if="id === 'iam'"><circle cx="12" cy="9" r="3.5" /><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" /><path d="M16 4l2 2 3-3" /></template>
      <template v-else-if="id === 'lambda'"><path d="M6 20l5-9-3-6h3l6 12 2-1" /><path d="M11 11l-3 9" /></template>
      <template v-else-if="id === 'dynamodb'"><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></template>
      <template v-else-if="id === 'rds'"><ellipse cx="12" cy="7" rx="6" ry="2.5" /><path d="M6 7v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7" /><path d="M3 4l3 3M21 4l-3 3M3 20l3-3M21 20l-3-3" /></template>
      <template v-else-if="id === 'sqs'"><rect x="4" y="7" width="16" height="10" rx="1" /><path d="M8 10v4M12 10v4M16 10v4" /></template>
      <template v-else-if="id === 'sns'"><circle cx="12" cy="12" r="2.5" /><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4.5 4.5a10.5 10.5 0 0 0 0 15M19.5 4.5a10.5 10.5 0 0 1 0 15" /></template>
      <template v-else-if="id === 'cloudwatch'"><circle cx="12" cy="12" r="8" /><path d="M7 14l3-3 3 2 4-5" /></template>
      <template v-else-if="id === 'kms'"><circle cx="8" cy="12" r="3.5" /><path d="M11.5 12H21M18 12v3M15 12v2" /></template>
      <template v-else-if="id === 'glue'"><path d="M5 5h14v4H5zM5 15h14v4H5z" /><path d="M9 9v6M15 9v6" /></template>
      <template v-else-if="id === 'athena'"><circle cx="11" cy="11" r="6" /><path d="M15.5 15.5 20 20M8 11h6M11 8v6" /></template>
      <template v-else-if="id === 'lakeformation'"><path d="M3 17c3-2 6 2 9 0s6 2 9 0" /><path d="M7 13V5h10v8" /><path d="M10 9h4" /></template>
      <template v-else-if="id === 'kinesis'"><path d="M3 8c4 0 4-3 8-3s4 3 10 3M3 13c4 0 4-3 8-3s4 3 10 3M3 18c4 0 4-3 8-3s4 3 10 3" /></template>
      <template v-else-if="id === 'redshift'"><path d="M4 6h16v12H4z" /><path d="M8 18V10M12 18V8M16 18v-5" /></template>
      <template v-else-if="id === 'stepfunctions'"><rect x="3" y="3" width="6" height="5" /><rect x="15" y="9" width="6" height="5" /><rect x="3" y="16" width="6" height="5" /><path d="M9 5.5h3v13H9M12 11.5h3" /></template>
      <template v-else-if="id === 'billing'"><circle cx="12" cy="12" r="8" /><path d="M14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.9 2.5 2.1-1 2-2.5 2c-1.2 0-2.2-.6-2.6-1.6M12 6v1.5M12 16.5V18" /></template>
      <template v-else><circle cx="12" cy="12" r="7" /></template>
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { SERVICE_BY_ID } from './nav';

const props = defineProps<{ id: string; small?: boolean; large?: boolean }>();
const color = computed(() => {
  const base = SERVICE_BY_ID[props.id]?.color || '#232f3e';
  return `linear-gradient(45deg, ${base}, ${base}cc)`;
});
</script>

<style scoped>
.svc-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 4px; flex: none; }
.svc-icon svg { width: 24px; height: 24px; }
.svc-icon--small { width: 18px; height: 18px; border-radius: 3px; }
.svc-icon--small svg { width: 14px; height: 14px; stroke-width: 1.8; }
.svc-icon--large { width: 40px; height: 40px; }
.svc-icon--large svg { width: 30px; height: 30px; }
</style>
