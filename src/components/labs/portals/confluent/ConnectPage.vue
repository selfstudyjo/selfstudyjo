<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span>
      <span>Connect</span><span class="cc-sep">/</span><span>{{ CONNECT_CLUSTER }}</span></nav>
    <div class="cc-title-row">
      <h1 class="cc-title">{{ CONNECT_CLUSTER }}</h1>
      <span class="cc-muted cc-small">{{ CONNECT_URL }} · Kafka Connect {{ cc.version.value }}</span>
      <span class="cc-spacer"></span>
      <button type="button" class="cc-btn cc-btn--primary" @click="cc.go({ page: 'add-connector' })"><CcIcon name="plus" />Add connector</button>
    </div>

    <div class="cc-tiles">
      <div class="cc-tile"><span class="cc-tile__label">Running</span><span class="cc-tile__value">{{ count('RUNNING') }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Degraded</span><span class="cc-tile__value" :class="{ 'cc-tile__value--bad': degraded }">{{ degraded }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Failed</span><span class="cc-tile__value" :class="{ 'cc-tile__value--bad': count('FAILED') }">{{ count('FAILED') }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Paused</span><span class="cc-tile__value">{{ count('PAUSED') }}</span></div>
    </div>

    <div class="cc-toolbar">
      <label class="cc-search"><CcIcon name="search" />
        <input v-model="query" class="cc-input" type="search" placeholder="Search connectors" aria-label="Search connectors" /></label>
    </div>
    <div class="cc-table-wrap">
      <table class="cc-table">
        <thead><tr><th>Status</th><th>Name</th><th>Category</th><th>Type</th><th>Topics</th><th class="is-num">Number of tasks</th><th class="is-num">Records</th></tr></thead>
        <tbody>
          <tr v-if="!shown.length"><td colspan="7" class="cc-empty">{{ cc.connectors.value.length ? 'No connectors match your search.' : 'No connectors yet. Add a connector to move data in or out of Kafka.' }}</td></tr>
          <tr v-for="c in shown" :key="c.name">
            <td><span class="cc-status" :class="statusClass(c)">{{ statusText(c) }}</span></td>
            <td><button type="button" class="cc-link cn-name" @click="cc.go({ page: 'connector', name: c.name, tab: 'overview' })">{{ c.name }}</button></td>
            <td>{{ c.type === 'sink' ? 'Sink' : 'Source' }}</td>
            <td class="cc-mono">{{ c.class.split('.').pop() }}</td>
            <td class="cc-mono">{{ (c.topics || []).join(', ') || '-' }}</td>
            <td class="is-num">{{ c.tasks.length }}</td>
            <td class="is-num">{{ num(c.records) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME, CONNECT_CLUSTER, CONNECT_URL, num, type CcConnector } from './confluent';

const cc = useCc();
const query = ref('');
const shown = computed(() => cc.connectors.value.filter(c => matches(c as any, query.value, ['name', 'class', 'topics'])));
const degraded = computed(() => cc.connectors.value.filter(c => c.state === 'RUNNING' && c.tasks.some(t => t.state === 'FAILED')).length);
function count(state: string) { return cc.connectors.value.filter(c => c.state === state).length; }
function statusText(c: CcConnector) {
  if (c.state === 'RUNNING' && c.tasks.some(t => t.state === 'FAILED')) return 'Degraded';
  return c.state.charAt(0) + c.state.slice(1).toLowerCase();
}
function statusClass(c: CcConnector) {
  const s = statusText(c);
  return s === 'Running' ? 'cc-status--ok' : s === 'Paused' ? 'cc-status--off' : s === 'Degraded' ? 'cc-status--warn' : 'cc-status--bad';
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.cn-name { font-weight: 600; }
</style>
