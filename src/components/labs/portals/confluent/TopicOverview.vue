<template>
  <div class="to">
    <div class="cc-tiles">
      <div class="cc-tile"><span class="cc-tile__label">Partitions</span><span class="cc-tile__value">{{ topic.partitions }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Replication factor</span><span class="cc-tile__value">{{ topic.replication_factor }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Under replicated partitions</span>
        <span class="cc-tile__value" :class="{ 'cc-tile__value--bad': topic.under_replicated }">{{ topic.under_replicated }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Messages</span><span class="cc-tile__value">{{ num(topic.messages) }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Size</span><span class="cc-tile__value">{{ bytes(topic.size_bytes) }}</span></div>
      <div class="cc-tile"><span class="cc-tile__label">Consumers</span><span class="cc-tile__value">{{ consumers.length }}</span>
        <span class="cc-tile__sub">{{ consumers.join(', ') || 'No consumer groups' }}</span></div>
    </div>

    <div class="cc-title-row">
      <h2 class="cc-h2">Partitions</h2>
      <span class="cc-spacer"></span>
      <button type="button" class="cc-btn cc-btn--sm" @click="openAlter">Increase partitions</button>
    </div>
    <div class="cc-table-wrap">
      <table class="cc-table">
        <thead><tr>
          <th class="is-num">Partition ID</th><th>Status</th><th class="is-num">Leader (broker ID)</th><th>Replicas</th>
          <th>In-sync replicas</th><th class="is-num">Start offset</th><th class="is-num">End offset</th><th class="is-num">Messages</th>
        </tr></thead>
        <tbody>
          <tr v-for="p in topic.partitions_detail" :key="p.partition">
            <td class="is-num">{{ p.partition }}</td>
            <td><span class="cc-status" :class="p.leader < 0 ? 'cc-status--bad' : (p.isr || []).length < (p.replicas || []).length ? 'cc-status--warn' : 'cc-status--ok'">
              {{ p.leader < 0 ? 'Offline' : (p.isr || []).length < (p.replicas || []).length ? 'Under replicated' : 'Healthy' }}</span></td>
            <td class="is-num">{{ p.leader < 0 ? 'none' : p.leader }}</td>
            <td class="to-reps"><span v-for="r in p.replicas || []" :key="r" class="to-rep" :class="{ 'is-leader': r === p.leader, 'is-out': !(p.isr || []).includes(r) }">{{ r }}</span></td>
            <td class="cc-mono">{{ (p.isr || []).join(', ') || '-' }}</td>
            <td class="is-num">{{ num(p.start_offset ?? 0) }}</td>
            <td class="is-num">{{ num(p.end_offset) }}</td>
            <td class="is-num">{{ num(p.end_offset - (p.start_offset ?? 0)) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="topic.partitions > topic.partitions_detail.length" class="cc-hint">Showing the first {{ topic.partitions_detail.length }} of {{ topic.partitions }} partitions.</p>

    <CcModal v-if="alterOpen" title="Increase partitions" ok-text="Save" :ok-disabled="newCount <= topic.partitions" :busy="cc.busy.value"
             @close="alterOpen = false" @ok="alter">
      <div class="cc-alert cc-alert--warn"><CcIcon name="warning" />
        <span>Partitions can only be added. Adding partitions to a keyed topic changes which partition a key maps to, which breaks per-key ordering.</span></div>
      <label class="cc-field"><span class="cc-label">Number of partitions</span>
        <input v-model.number="newCount" class="cc-input" type="number" :min="topic.partitions + 1" /></label>
      <div v-if="alterError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ alterError }}</span></div>
    </CcModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import CcModal from './CcModal.vue';
import { useCc } from './ccContext';
import { bytes, kafkaTopics, num, type CcTopic } from './confluent';

const props = defineProps<{ topic: CcTopic }>();
const cc = useCc();
const consumers = computed(() => cc.groups.value.filter(g => (g.topics || []).includes(props.topic.name)).map(g => g.group));

const alterOpen = ref(false);
const newCount = ref(0);
const alterError = ref('');
function openAlter() {
  newCount.value = props.topic.partitions + 1;
  alterError.value = '';
  alterOpen.value = true;
}
async function alter() {
  const result = await cc.run(kafkaTopics(['--alter', '--topic', props.topic.name, '--partitions', newCount.value]),
    { success: `Topic ${props.topic.name} now has ${newCount.value} partitions`, quiet: true });
  if (!result.ok) { alterError.value = errorText(result); return; }
  alterOpen.value = false;
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.to { display: flex; flex-direction: column; gap: 16px; }
.to-reps { white-space: nowrap; }
.to-rep { display: inline-block; min-width: 22px; padding: 0 6px; margin-right: 4px; border-radius: 3px; text-align: center; font-size: 12px; font-weight: 600; background: var(--cc-tag-bg); color: var(--cc-text); }
.to-rep.is-leader { background: var(--cc-primary); color: #fff; }
.to-rep.is-out { background: var(--cc-danger-bg); color: var(--cc-danger-text); text-decoration: line-through; }
</style>
