<template>
  <div class="cc-page">
    <div class="cc-title-row">
      <h1 class="cc-title">Home</h1>
    </div>
    <div class="cc-tiles home-summary">
      <div class="cc-tile"><span class="cc-tile__label">Healthy clusters</span><span class="cc-tile__value">{{ healthy ? 1 : 0 }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Unhealthy clusters</span>
        <span class="cc-tile__value" :class="{ 'cc-tile__value--bad': !healthy }">{{ healthy ? 0 : 1 }}</span></div>
    </div>

    <div class="cc-card home-cluster">
      <div class="cc-card__head">
        <button type="button" class="cc-link home-cluster__name" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button>
        <span class="cc-status" :class="healthy ? 'cc-status--ok' : 'cc-status--bad'">{{ healthy ? 'Running' : 'Unhealthy' }}</span>
        <span class="cc-spacer"></span>
        <span class="cc-muted cc-small">Cluster ID <span class="cc-mono">{{ cc.clusterId.value }}</span></span>
      </div>
      <div class="cc-card__body home-grid">
        <section>
          <h3 class="cc-h3">Overview</h3>
          <dl class="cc-kv">
            <dt>Brokers</dt><dd>{{ online }} / {{ cc.brokers.value.length }} online</dd>
            <dt>Partitions</dt><dd>{{ partitions }}</dd>
            <dt>Topics</dt><dd>{{ cc.topics.value.length }}</dd>
            <dt>Kafka version</dt><dd>{{ cc.version.value }}</dd>
          </dl>
        </section>
        <section>
          <h3 class="cc-h3">Connected services</h3>
          <dl class="cc-kv">
            <dt>ksqlDB clusters</dt><dd>0</dd>
            <dt>Connect clusters</dt><dd>1 ({{ cc.connectors.value.length }} connectors)</dd>
            <dt>Schema Registry</dt><dd>{{ cc.subjects.value.length }} subjects</dd>
          </dl>
        </section>
        <section>
          <h3 class="cc-h3">Health</h3>
          <dl class="cc-kv">
            <dt>Under replicated</dt><dd :class="{ bad: underReplicated }">{{ underReplicated }}</dd>
            <dt>Offline partitions</dt><dd :class="{ bad: offline }">{{ offline }}</dd>
            <dt>Failed connectors</dt><dd :class="{ bad: failed }">{{ failed }}</dd>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME } from './confluent';

const cc = useCc();
const online = computed(() => cc.brokers.value.filter(b => b.status === 'online').length);
const partitions = computed(() => cc.topics.value.reduce((n, t) => n + Number(t.partitions || 0), 0));
const underReplicated = computed(() => cc.topics.value.reduce((n, t) => n + Number(t.under_replicated || 0), 0));
const offline = computed(() => cc.topics.value.reduce((n, t) => n + Number(t.offline_partitions || 0), 0));
const failed = computed(() => cc.connectors.value.filter(c => c.state === 'FAILED' || c.tasks.some(t => t.state === 'FAILED')).length);
const healthy = computed(() => online.value === cc.brokers.value.length && !underReplicated.value && !offline.value);
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.home-summary { max-width: 420px; }
.home-cluster__name { font-size: 16px; font-weight: 600; }
.home-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 20px; }
.home-grid section { display: flex; flex-direction: column; gap: 8px; }
.bad { color: var(--cc-danger); font-weight: 600; }
</style>
