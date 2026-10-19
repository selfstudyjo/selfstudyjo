<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span><span>Brokers</span></nav>
    <div class="cc-title-row"><h1 class="cc-title">Brokers overview</h1></div>

    <div class="cc-tiles">
      <div class="cc-tile"><span class="cc-tile__label">Total brokers</span><span class="cc-tile__value">{{ cc.brokers.value.length }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Online</span><span class="cc-tile__value">{{ online }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Offline</span>
        <span class="cc-tile__value" :class="{ 'cc-tile__value--bad': offline }">{{ offline }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Under replicated partitions</span>
        <span class="cc-tile__value" :class="{ 'cc-tile__value--bad': underReplicated }">{{ underReplicated }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Active controller</span><span class="cc-tile__value">{{ controller }}</span></div>
    </div>

    <div class="cc-table-wrap">
      <table class="cc-table">
        <thead><tr>
          <th>Broker ID</th><th>Host</th><th>Status</th><th>Controller</th>
          <th class="is-num">Partition replicas</th><th class="is-num">Leader partitions</th><th class="is-num">Out of sync replicas</th>
        </tr></thead>
        <tbody>
          <tr v-for="b in stats" :key="b.id">
            <td><strong>{{ b.id }}</strong></td>
            <td class="cc-mono">{{ b.host }}:{{ b.port || 9092 }}</td>
            <td><span class="cc-status" :class="b.status === 'online' ? 'cc-status--ok' : 'cc-status--bad'">{{ b.status === 'online' ? 'Online' : 'Offline' }}</span></td>
            <td><span v-if="b.controller" class="cc-badge cc-badge--blue">Active controller</span><span v-else class="cc-muted">-</span></td>
            <td class="is-num">{{ b.replicas }}</td>
            <td class="is-num">{{ b.leaders }}</td>
            <td class="is-num" :class="{ bad: b.outOfSync }">{{ b.outOfSync }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="cc-hint">Broker configuration is managed by the platform team in this lab; describe it with
      <span class="cc-mono">kafka-configs --describe --entity-type brokers --entity-default</span>.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME } from './confluent';

const cc = useCc();
const online = computed(() => cc.brokers.value.filter(b => b.status === 'online').length);
const offline = computed(() => cc.brokers.value.length - online.value);
const controller = computed(() => cc.brokers.value.find(b => b.controller)?.id ?? '-');
const underReplicated = computed(() => cc.topics.value.reduce((n, t) => n + Number(t.under_replicated || 0), 0));

const stats = computed(() => cc.brokers.value.map(b => {
  let replicas = 0;
  let leaders = 0;
  let outOfSync = 0;
  for (const t of cc.topics.value) {
    for (const p of t.partitions_detail || []) {
      const reps = Array.isArray(p.replicas) ? p.replicas : [];
      const isr = Array.isArray(p.isr) ? p.isr : [];
      if (reps.includes(b.id)) {
        replicas++;
        if (!isr.includes(b.id)) outOfSync++;
      }
      if (p.leader === b.id) leaders++;
    }
  }
  return { ...b, replicas, leaders, outOfSync };
}));
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.bad { color: var(--cc-danger); font-weight: 600; }
</style>
