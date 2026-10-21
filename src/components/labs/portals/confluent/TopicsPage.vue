<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span><span>Topics</span></nav>
    <div class="cc-title-row">
      <h1 class="cc-title">Topics</h1>
      <span class="cc-spacer"></span>
      <button type="button" class="cc-btn cc-btn--primary" @click="cc.go({ page: 'new-topic' })"><CcIcon name="plus" />Add a topic</button>
    </div>

    <div class="cc-toolbar">
      <label class="cc-search"><CcIcon name="search" />
        <input v-model="query" class="cc-input" type="search" placeholder="Search topics" aria-label="Search topics" /></label>
      <span class="cc-muted cc-small">{{ shown.length }} of {{ cc.topics.value.length }} topics</span>
      <span class="cc-spacer"></span>
      <label class="tp-check"><input v-model="onlyIssues" type="checkbox" /> Show only topics with issues</label>
    </div>

    <div class="cc-table-wrap">
      <table class="cc-table">
        <thead><tr>
          <th v-for="col in columns" :key="col.key" :class="{ 'is-num': col.num }">
            <button type="button" @click="sortOn(col.key)">{{ col.label }}<CcIcon v-if="sortKey === col.key" :name="sortDir === 'asc' ? 'chevron-down' : 'chevron-left'" /></button>
          </th>
          <th><span class="tp-sr">Actions</span></th>
        </tr></thead>
        <tbody>
          <tr v-if="!shown.length"><td :colspan="columns.length + 1" class="cc-empty">
            {{ cc.topics.value.length ? 'No topics match your search.' : 'No topics yet. Add a topic to get started.' }}</td></tr>
          <tr v-for="t in shown" :key="t.name" @contextmenu="cc.menu($event, actions(t))">
            <td><button type="button" class="cc-link tp-name" @click="cc.go({ page: 'topic', name: t.name, tab: 'overview' })">{{ t.name }}</button>
              <span v-if="t.dlq" class="cc-badge tp-dlq">DLQ</span></td>
            <td><span class="cc-status" :class="statusClass(t)">{{ statusText(t) }}</span></td>
            <td class="is-num">{{ t.partitions }}</td>
            <td class="is-num">{{ t.replication_factor }}</td>
            <td class="is-num" :class="{ bad: t.under_replicated }">{{ t.under_replicated }}</td>
            <td class="is-num">{{ num(t.messages) }}</td>
            <td class="is-num">{{ bytes(t.size_bytes) }}</td>
            <td>{{ t.configs?.['cleanup.policy'] || 'delete' }}</td>
            <td class="cc-actions"><button type="button" class="cc-kebab" :aria-label="'Actions for ' + t.name" @click="cc.menu($event, actions(t))"><CcIcon name="more" /></button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches, sortBy } from '@/utils/portalKit';
import type { CcMenuItem } from './ccContext';
import CcIcon from './CcIcon.vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME, bytes, kafkaTopics, num, type CcTopic } from './confluent';

const cc = useCc();
const query = ref('');
const onlyIssues = ref(false);
const sortKey = ref('name');
const sortDir = ref<'asc' | 'desc'>('asc');

const columns = [
  { key: 'name', label: 'Topic name' },
  { key: 'status', label: 'Status' },
  { key: 'partitions', label: 'Partitions', num: true },
  { key: 'replication_factor', label: 'Replication factor', num: true },
  { key: 'under_replicated', label: 'Under replicated partitions', num: true },
  { key: 'messages', label: 'Messages', num: true },
  { key: 'size_bytes', label: 'Size', num: true },
  { key: 'cleanup', label: 'Cleanup policy' },
];

function statusText(t: CcTopic) {
  if (t.offline_partitions) return 'Offline partitions';
  if (t.under_replicated) return 'Under replicated';
  return 'Healthy';
}
function statusClass(t: CcTopic) {
  if (t.offline_partitions) return 'cc-status--bad';
  if (t.under_replicated) return 'cc-status--warn';
  return 'cc-status--ok';
}
function actions(t: CcTopic): CcMenuItem[] {
  return [
    { label: 'View topic', icon: 'eye', run: () => cc.go({ page: 'topic', name: t.name, tab: 'overview' }) },
    { label: 'Browse messages', icon: 'topics', run: () => cc.go({ page: 'topic', name: t.name, tab: 'messages' }) },
    { label: 'Produce new message', icon: 'send', run: () => cc.go({ page: 'topic', name: t.name, tab: 'messages', produce: true }) },
    { label: 'Edit settings', icon: 'settings', run: () => cc.go({ page: 'topic', name: t.name, tab: 'configuration' }) },
    { label: 'Schema', icon: 'schema', run: () => cc.go({ page: 'topic', name: t.name, tab: 'schema' }) },
    { divider: true },
    { label: 'Delete topic', icon: 'trash', danger: true, run: () => remove(t.name) },
  ];
}
async function remove(name: string) {
  const ok = await cc.confirm({
    title: 'Delete topic',
    message: `Topic ${name} and all of its messages will be permanently deleted. Consumer groups lose their committed offsets for it.`,
    yes: 'Delete', danger: true, typeToConfirm: name,
  });
  if (ok) await cc.run(kafkaTopics(['--delete', '--topic', name]), { success: `Topic ${name} deleted` });
}

function sortOn(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}

const shown = computed(() => {
  const list = cc.topics.value
    .filter(t => matches(t as any, query.value, ['name']))
    .filter(t => !onlyIssues.value || t.under_replicated || t.offline_partitions)
    .map(t => ({ ...t, status: statusText(t), cleanup: t.configs?.['cleanup.policy'] || 'delete' }));
  return sortBy(list, sortKey.value, sortDir.value);
});
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.tp-name { font-weight: 600; }
.tp-dlq { margin-left: 6px; background: var(--cc-warning-bg); color: var(--cc-warning-text); }
.tp-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--cc-text); }
.bad { color: var(--cc-danger); font-weight: 600; }
.tp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
