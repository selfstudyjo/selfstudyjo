<template>
  <svg class="dh-pf" :width="size" :height="size" viewBox="0 0 24 24" role="img" :aria-label="label">
    <title>{{ label }}</title>
    <!-- PostgreSQL: the blue elephant's head -->
    <template v-if="platform === 'postgres'">
      <path d="M12 2.6c-4.6 0-8 2.6-8 7 0 2.6 1 4.4 2.3 5.6.5 2.3 1.4 5.8 3.1 6.2 1 .2 1.5-1 1.7-2.6.6.2 1.3.3 2 .2.3 1.7.9 3.2 2.2 3.1 1.6-.1 1.9-2.6 1.9-5 1.6-1.4 2.8-3.5 2.8-6.2 0-4.8-3.3-8.3-8-8.3z"
            fill="#336791" />
      <path d="M8.2 9.4c0-1 .8-1.7 1.6-1.7M15.6 7.8c.9.1 1.5.8 1.5 1.7" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" />
      <circle cx="10.2" cy="10.6" r=".9" fill="#fff" /><circle cx="14.4" cy="10.4" r=".9" fill="#fff" />
      <path d="M12.6 12.6c0 2.2.6 4 1.6 5" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round" />
    </template>
    <!-- Snowflake: the six-armed flake -->
    <template v-else-if="platform === 'snowflake'">
      <g stroke="#29B5E8" stroke-width="2.1" stroke-linecap="round" fill="none">
        <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8" />
        <path d="M9.6 4.2 12 6.4l2.4-2.2M9.6 19.8 12 17.6l2.4 2.2M4.6 10.5l3.1-1-0.7-3.2M19.4 13.5l-3.1 1 .7 3.2M19.4 10.5l-3.1-1 .7-3.2M4.6 13.5l3.1 1-.7 3.2" stroke-width="1.5" />
      </g>
    </template>
    <!-- Apache Kafka: the connected nodes -->
    <template v-else-if="platform === 'kafka'">
      <g fill="none" stroke="#231F20" stroke-width="1.6">
        <circle cx="9" cy="4.6" r="2.1" /><circle cx="9" cy="12" r="2.8" /><circle cx="9" cy="19.4" r="2.1" />
        <circle cx="17.2" cy="8.2" r="2.1" /><circle cx="17.2" cy="15.8" r="2.1" />
        <path d="M9 6.7v2.5M9 14.8v2.5M11.6 10.8l3.7-1.6M11.6 13.2l3.7 1.6" />
      </g>
    </template>
    <!-- Amazon S3 (the data lake): the bucket -->
    <template v-else-if="platform === 'lake' || platform === 's3'">
      <path d="M4 6.2 5.8 19c.2 1.4 3 2.4 6.2 2.4s6-1 6.2-2.4L20 6.2" fill="#E25444" />
      <ellipse cx="12" cy="6.2" rx="8" ry="2.6" fill="#7B1D13" />
      <ellipse cx="12" cy="6" rx="6.4" ry="1.6" fill="#F58536" />
      <path d="M7 11.2c3.2 1 6.8 1 10 0" stroke="#fff" stroke-width="1" fill="none" opacity=".7" />
    </template>
    <!-- dbt: the orange mark -->
    <template v-else-if="platform === 'dbt'">
      <path d="M20.6 3.4c.5.5.6 1.3.2 1.9l-4.5 6.7 4.5 6.7c.4.6.3 1.4-.2 1.9-.5.5-1.3.6-1.9.2L12 16.3l-6.7 4.5c-.6.4-1.4.3-1.9-.2-.5-.5-.6-1.3-.2-1.9L7.7 12 3.2 5.3c-.4-.6-.3-1.4.2-1.9.5-.5 1.3-.6 1.9-.2L12 7.7l6.7-4.5c.6-.4 1.4-.3 1.9.2z" fill="#FF694B" />
      <circle cx="12" cy="12" r="2.2" fill="#fff" />
    </template>
    <!-- Apache Airflow: the pinwheel -->
    <template v-else-if="platform === 'airflow'">
      <path d="M12 12 12.4 2.6c3.6.6 4 4.6 0 9.4z" fill="#017CEE" />
      <path d="M12 12 21.4 12.4c-.6 3.6-4.6 4-9.4 0z" fill="#00AD46" />
      <path d="M12 12 11.6 21.4c-3.6-.6-4-4.6 0-9.4z" fill="#04D659" />
      <path d="M12 12 2.6 11.6c.6-3.6 4.6-4 9.4 0z" fill="#00C7D4" />
    </template>
    <!-- Apache Flink: the squirrel's colours -->
    <template v-else-if="platform === 'flink'">
      <path d="M15.8 3.2c3.2 1.4 4.6 5.4 3 8.6-1.2 2.4-3.6 3.2-5.2 2.6 2-.8 3.2-2.6 2.8-4.6-.4-2.2-2.6-3.4-4.6-2.8 1-1.8 2.4-3.2 4-3.8z" fill="#E6526F" />
      <path d="M5.2 20.6c-.6-4 1.2-8 5-9.4 2.8-1 5.4.2 6 2.6.8 3-1.6 6-5.4 6.8z" fill="#F28E5A" />
      <circle cx="9.6" cy="15.2" r=".9" fill="#3F2A2F" />
    </template>
    <!-- Feast: the feature store mark -->
    <template v-else-if="platform === 'feast'">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#E9373F" />
      <path d="M9 17V7h6.4M9 12h5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" fill="none" stroke="#8C8C8C" stroke-width="1.6" />
      <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" fill="none" stroke="#8C8C8C" stroke-width="1.6" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { platformLabel } from './dhContext';

const props = withDefaults(defineProps<{ platform: string; size?: number }>(), { size: 18 });
const label = computed(() => platformLabel(props.platform));
</script>

<style scoped>
.dh-pf { flex: none; display: inline-block; vertical-align: middle; }
</style>
