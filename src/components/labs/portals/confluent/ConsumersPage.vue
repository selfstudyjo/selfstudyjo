<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span><span>Consumers</span></nav>
    <div class="cc-title-row"><h1 class="cc-title">Consumer groups</h1></div>

    <div class="cc-tiles">
      <div class="cc-tile"><span class="cc-tile__label">Consumer groups</span><span class="cc-tile__value">{{ cc.groups.value.length }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Active (Stable)</span><span class="cc-tile__value">{{ stable }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Total messages behind</span><span class="cc-tile__value">{{ num(totalLag) }}</span></div>
    </div>

    <div class="cc-toolbar">
      <label class="cc-search"><CcIcon name="search" />
        <input v-model="query" class="cc-input" type="search" placeholder="Search consumer groups" aria-label="Search consumer groups" /></label>
    </div>
    <div class="cc-table-wrap">
      <table class="cc-table">
        <thead><tr><th>Consumer group ID</th><th>State</th><th class="is-num">Messages behind</th><th class="is-num">Number of consumers</th>
          <th class="is-num">Number of topics</th><th>Topics</th></tr></thead>
        <tbody>
          <tr v-if="!shown.length"><td colspan="6" class="cc-empty">{{ cc.groups.value.length ? 'No consumer groups match your search.' : 'No consumer groups have committed offsets yet.' }}</td></tr>
          <tr v-for="g in shown" :key="g.group">
            <td><button type="button" class="cc-link cg-name" @click="cc.go({ page: 'group', group: g.group })">{{ g.group }}</button></td>
            <td><span class="cc-status" :class="g.state === 'Stable' ? 'cc-status--ok' : g.state === 'Rebalancing' ? 'cc-status--warn' : 'cc-status--off'">{{ g.state }}</span></td>
            <td class="is-num" :class="{ lag: g.lag > 0 }">{{ num(g.lag) }}</td>
            <td class="is-num">{{ g.members }}</td>
            <td class="is-num">{{ (g.topics || []).length }}</td>
            <td class="cc-mono">{{ (g.topics || []).join(', ') }}</td>
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
import { CLUSTER_NAME, num } from './confluent';

const cc = useCc();
const query = ref('');
const stable = computed(() => cc.groups.value.filter(g => g.state === 'Stable').length);
const totalLag = computed(() => cc.groups.value.reduce((n, g) => n + Number(g.lag || 0), 0));
const shown = computed(() => cc.groups.value.filter(g => matches(g as any, query.value, ['group', 'topics'])));
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.cg-name { font-weight: 600; }
.lag { color: var(--cc-warning-text); font-weight: 600; }
</style>
