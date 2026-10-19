<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span><span>{{ CLUSTER_NAME }}</span></nav>
    <div class="cc-title-row"><h1 class="cc-title">Cluster overview</h1></div>

    <div v-if="problems.length" class="cc-alert cc-alert--error">
      <CcIcon name="x-circle" />
      <div><strong>{{ problems.length }} issue{{ problems.length === 1 ? '' : 's' }} need attention</strong>
        <div v-for="p in problems" :key="p">{{ p }}</div></div>
    </div>

    <section class="ov-panel">
      <header class="ov-panel__head"><h2 class="cc-h3">Brokers</h2>
        <button type="button" class="cc-btn cc-btn--ghost cc-btn--sm" @click="cc.go({ page: 'brokers' })">View all <CcIcon name="chevron-right" /></button></header>
      <div class="cc-tiles">
        <div class="cc-tile"><span class="cc-tile__label">Total</span><span class="cc-tile__value">{{ cc.brokers.value.length }}</span>
          <span class="cc-tile__sub">{{ online }} online</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Production</span><span class="cc-tile__value">{{ production }}</span>
          <span class="cc-tile__sub">bytes per second (clickstream producer)</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Consumption</span><span class="cc-tile__value">{{ totalLag }}</span>
          <span class="cc-tile__sub">messages behind, all consumer groups</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Controller</span><span class="cc-tile__value">{{ controller }}</span>
          <span class="cc-tile__sub">active controller broker</span></div>
      </div>
    </section>

    <section class="ov-panel">
      <header class="ov-panel__head"><h2 class="cc-h3">Topics</h2>
        <button type="button" class="cc-btn cc-btn--ghost cc-btn--sm" @click="cc.go({ page: 'topics' })">View all <CcIcon name="chevron-right" /></button></header>
      <div class="cc-tiles">
        <div class="cc-tile"><span class="cc-tile__label">Total</span><span class="cc-tile__value">{{ cc.topics.value.length }}</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Partitions</span><span class="cc-tile__value">{{ partitions }}</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Under replicated partitions</span>
          <span class="cc-tile__value" :class="{ 'cc-tile__value--bad': underReplicated }">{{ underReplicated }}</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Offline partitions</span>
          <span class="cc-tile__value" :class="{ 'cc-tile__value--bad': offline }">{{ offline }}</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Messages</span><span class="cc-tile__value">{{ num(messages) }}</span>
          <span class="cc-tile__sub">{{ bytes(size) }} on disk</span></div>
      </div>
    </section>

    <section class="ov-panel">
      <header class="ov-panel__head"><h2 class="cc-h3">Connect</h2>
        <button type="button" class="cc-btn cc-btn--ghost cc-btn--sm" @click="cc.go({ page: 'connect' })">View all <CcIcon name="chevron-right" /></button></header>
      <div class="cc-tiles">
        <div class="cc-tile"><span class="cc-tile__label">Clusters</span><span class="cc-tile__value">1</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Running connectors</span><span class="cc-tile__value">{{ running }}</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Paused connectors</span><span class="cc-tile__value">{{ paused }}</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Failed / degraded</span>
          <span class="cc-tile__value" :class="{ 'cc-tile__value--bad': failed }">{{ failed }}</span></div>
      </div>
    </section>

    <section class="ov-panel">
      <header class="ov-panel__head"><h2 class="cc-h3">Top topics by messages</h2></header>
      <div class="cc-card cc-card__body ov-bars">
        <div v-if="!topTopics.length" class="cc-muted">No messages yet.</div>
        <div v-for="t in topTopics" :key="t.name" class="ov-bar">
          <button type="button" class="cc-link ov-bar__name" @click="cc.go({ page: 'topic', name: t.name, tab: 'overview' })">{{ t.name }}</button>
          <span class="ov-bar__track"><span class="ov-bar__fill" :style="{ width: Math.max(2, (t.messages / maxMessages) * 100) + '%' }"></span></span>
          <span class="ov-bar__value">{{ num(t.messages) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CcIcon from './CcIcon.vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME, bytes, num } from './confluent';

const cc = useCc();
const online = computed(() => cc.brokers.value.filter(b => b.status === 'online').length);
const controller = computed(() => cc.brokers.value.find(b => b.controller)?.id ?? '-');
const partitions = computed(() => cc.topics.value.reduce((n, t) => n + Number(t.partitions || 0), 0));
const underReplicated = computed(() => cc.topics.value.reduce((n, t) => n + Number(t.under_replicated || 0), 0));
const offline = computed(() => cc.topics.value.reduce((n, t) => n + Number(t.offline_partitions || 0), 0));
const messages = computed(() => cc.topics.value.reduce((n, t) => n + Number(t.messages || 0), 0));
const size = computed(() => cc.topics.value.reduce((n, t) => n + Number(t.size_bytes || 0), 0));
const totalLag = computed(() => num(cc.groups.value.reduce((n, g) => n + Number(g.lag || 0), 0)));
const running = computed(() => cc.connectors.value.filter(c => c.state === 'RUNNING' && c.tasks.every(t => t.state === 'RUNNING')).length);
const paused = computed(() => cc.connectors.value.filter(c => c.state === 'PAUSED').length);
const failed = computed(() => cc.connectors.value.filter(c => c.state === 'FAILED' || c.tasks.some(t => t.state === 'FAILED')).length);

const production = computed(() => {
  const p = cc.producer.value;
  const topic = cc.topic(String(p.topic || ''));
  const rate = Number(p.rate_per_min || 0);
  if (!topic || !topic.messages || !rate) return '0';
  return num(Math.round((topic.size_bytes / topic.messages) * rate / 60));
});

const topTopics = computed(() => [...cc.topics.value].filter(t => t.messages > 0)
  .sort((a, b) => b.messages - a.messages || a.name.localeCompare(b.name)).slice(0, 6));
const maxMessages = computed(() => Math.max(1, ...topTopics.value.map(t => t.messages)));

const problems = computed(() => {
  const out: string[] = [];
  for (const b of cc.brokers.value) if (b.status !== 'online') out.push(`Broker ${b.id} (${b.host}) is offline.`);
  for (const t of cc.topics.value) {
    if (t.offline_partitions) out.push(`Topic ${t.name} has ${t.offline_partitions} offline partition(s).`);
    else if (t.under_replicated) out.push(`Topic ${t.name} has ${t.under_replicated} under replicated partition(s).`);
  }
  for (const c of cc.connectors.value) {
    if (c.state === 'FAILED' || c.tasks.some(t => t.state === 'FAILED')) out.push(`Connector ${c.name} has a failed task.`);
  }
  return out;
});
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.ov-panel { display: flex; flex-direction: column; gap: 8px; }
.ov-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ov-bars { display: flex; flex-direction: column; gap: 8px; }
.ov-bar { display: grid; grid-template-columns: minmax(120px, 220px) 1fr auto; gap: 12px; align-items: center; }
.ov-bar__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-bar__track { height: 10px; background: var(--cc-tag-bg); border-radius: 5px; overflow: hidden; }
.ov-bar__fill { display: block; height: 100%; background: var(--cc-primary); border-radius: 5px; }
.ov-bar__value { font-variant-numeric: tabular-nums; color: var(--cc-text-2); }
</style>
