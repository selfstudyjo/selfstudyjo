<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'consumers' })">Consumers</button><span class="cc-sep">/</span><span>{{ name }}</span></nav>

    <template v-if="group">
      <div class="cc-title-row">
        <h1 class="cc-title">{{ group.group }}</h1>
        <span class="cc-status" :class="group.state === 'Stable' ? 'cc-status--ok' : 'cc-status--off'">{{ group.state }}</span>
        <span class="cc-spacer"></span>
        <button type="button" class="cc-btn" @click="resetOpen = true"><CcIcon name="refresh" />Reset offsets</button>
        <button type="button" class="cc-btn cc-btn--danger-text" @click="remove"><CcIcon name="trash" />Delete consumer group</button>
      </div>

      <div class="cc-tiles">
        <div class="cc-tile"><span class="cc-tile__label">Messages behind</span><span class="cc-tile__value">{{ num(group.lag) }}</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Number of consumers</span><span class="cc-tile__value">{{ group.members }}</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Number of topics</span><span class="cc-tile__value">{{ (group.topics || []).length }}</span></div>
        <div class="cc-tile"><span class="cc-tile__label">Coordinator</span><span class="cc-tile__value cg-small">Broker 1</span>
          <span class="cc-tile__sub">kafka-1.shopflow.internal:9092</span></div>
      </div>

      <div class="cc-toolbar">
        <h2 class="cc-h2">Consumer lag</h2>
        <span class="cc-spacer"></span>
        <label class="cc-field cg-inline"><span class="cc-label">Topic</span>
          <select v-model="topicFilter" class="cc-select"><option value="">All topics</option>
            <option v-for="t in group.topics" :key="t" :value="t">{{ t }}</option></select></label>
      </div>
      <div class="cc-table-wrap">
        <table class="cc-table">
          <thead><tr><th>Topic</th><th class="is-num">Partition</th><th class="is-num">Messages behind</th>
            <th class="is-num">Current offset</th><th class="is-num">End offset</th><th>Consumer ID</th></tr></thead>
          <tbody>
            <tr v-if="!lagRows.length"><td colspan="6" class="cc-empty">This group has no committed offsets.</td></tr>
            <tr v-for="r in lagRows" :key="r.topic + ':' + r.partition">
              <td class="cc-mono">{{ r.topic }}</td>
              <td class="is-num">{{ r.partition }}</td>
              <td class="is-num" :class="{ lag: (r.lag || 0) > 0 }">{{ r.lag === null ? '-' : num(r.lag) }}</td>
              <td class="is-num">{{ r.committed === null ? '-' : num(r.committed) }}</td>
              <td class="is-num">{{ num(r.end) }}</td>
              <td class="cc-muted">{{ group.members ? `${group.group}-consumer-${(r.partition % group.members) + 1}` : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ResetOffsetsModal v-if="resetOpen" :group="group" @close="resetOpen = false" />
    </template>
    <div v-else class="cc-card cc-empty">Consumer group <strong>{{ name }}</strong> does not exist.
      <div><button type="button" class="cc-btn cc-btn--ghost" @click="cc.go({ page: 'consumers' })">Back to consumer groups</button></div></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import CcIcon from './CcIcon.vue';
import ResetOffsetsModal from './ResetOffsetsModal.vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME, kafkaGroups, num } from './confluent';

const cc = useCc();
const name = computed(() => (cc.route.value.page === 'group' ? cc.route.value.group : ''));
const group = computed(() => cc.groups.value.find(g => g.group === name.value));
const topicFilter = ref('');
const resetOpen = ref(false);
const lagRows = computed(() => (group.value?.lag_detail || []).filter(r => !topicFilter.value || r.topic === topicFilter.value));

async function remove() {
  if (!group.value) return;
  const g = group.value.group;
  const ok = await cc.confirm({
    title: 'Delete consumer group',
    message: group.value.members
      ? `Group ${g} has ${group.value.members} active consumer(s). Kafka only deletes an empty group; stop its consumers first.`
      : `The committed offsets of ${g} will be deleted. Its consumers will start from auto.offset.reset next time.`,
    yes: 'Delete', danger: true, typeToConfirm: g,
  });
  if (!ok) return;
  const result = await cc.run(kafkaGroups(['--delete', '--group', g]), { success: `Consumer group ${g} deleted` });
  if (result.ok) cc.go({ page: 'consumers' });
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.cg-inline { flex-direction: row; align-items: center; gap: 6px; }
.cg-small { font-size: 18px; font-weight: 400; }
.lag { color: var(--cc-warning-text); font-weight: 600; }
</style>
