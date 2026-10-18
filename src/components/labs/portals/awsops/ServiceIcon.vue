<template>
  <span class="svc-icon" :class="{ 'svc-icon--small': small, 'svc-icon--large': large }"
        :style="{ background: color }" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
      <!-- Simplified white glyphs in the spirit of the AWS architecture icons -->
      <template v-if="id === 'organizations'"><rect x="9" y="3" width="6" height="5" /><rect x="3" y="16" width="6" height="5" /><rect x="15" y="16" width="6" height="5" /><path d="M12 8v4M6 16v-4h12v4" /></template>
      <template v-else-if="id === 'controltower'"><path d="M8 21V9l4-6 4 6v12" /><path d="M5 21h14M10 13h4M10 17h4" /></template>
      <template v-else-if="id === 'iam'"><circle cx="12" cy="9" r="3.5" /><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" /><path d="M16 4l2 2 3-3" /></template>
      <template v-else-if="id === 'sso'"><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M2 20c0-3 2.5-5 6-5s6 2 6 5M14 15.5c3.2-.3 7 1.5 7 4.5" /></template>
      <template v-else-if="id === 'vpc'"><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 4V2M16 4V2M4 12H2M22 12h-2" /><circle cx="12" cy="12" r="3" /></template>
      <template v-else-if="id === 'ec2'"><rect x="6" y="6" width="12" height="12" /><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" /></template>
      <template v-else-if="id === 'ssm'"><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4M7 9l2 2-2 2M11 13h5" /></template>
      <template v-else-if="id === 'imagebuilder'"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></template>
      <template v-else-if="id === 'backup'"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></template>
      <template v-else-if="id === 'cloudwatch'"><circle cx="12" cy="12" r="8" /><path d="M7 14l3-3 3 2 4-5" /></template>
      <template v-else-if="id === 'sns'"><circle cx="12" cy="12" r="2.5" /><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4.5 4.5a10.5 10.5 0 0 0 0 15M19.5 4.5a10.5 10.5 0 0 1 0 15" /></template>
      <template v-else-if="id === 'securityhub'"><path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z" /><circle cx="12" cy="11" r="2.5" /><path d="M12 13.5V16" /></template>
      <template v-else-if="id === 'guardduty'"><path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z" /><circle cx="11" cy="11" r="3" /><path d="M13.2 13.2L16 16" /></template>
      <template v-else-if="id === 'config'"><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></template>
      <template v-else-if="id === 'cloudtrail'"><path d="M4 19c4-1 3-6 7-7s4-6 9-7" /><circle cx="4" cy="19" r="1.5" /><circle cx="11" cy="12" r="1.5" /><circle cx="20" cy="5" r="1.5" /></template>
      <template v-else-if="id === 'waf'"><path d="M3 6h18v12H3z" /><path d="M3 10h18M3 14h18M8 6v4M14 10v4M10 14v4M17 14v4" /></template>
      <template v-else-if="id === 'cloudformation'"><path d="M12 3l8 4-8 4-8-4z" /><path d="M4 12l8 4 8-4M4 17l8 4 8-4" /></template>
      <template v-else-if="id === 's3'"><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6l1.6 11.5c.2 1.5 2.6 2.5 5.4 2.5s5.2-1 5.4-2.5L19 6" /><path d="M12 11l5 2" /></template>
      <template v-else-if="id === 'secrets'"><rect x="5" y="10" width="14" height="10" rx="1" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></template>
      <template v-else-if="id === 'route53'"><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" /></template>
      <template v-else-if="id === 'cost'"><circle cx="12" cy="12" r="8" /><path d="M14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v1.5M12 16.5V18" /></template>
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
