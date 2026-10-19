<template>
  <div class="cc-page nt">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'topics' })">Topics</button><span class="cc-sep">/</span><span>New topic</span></nav>
    <div class="cc-title-row"><h1 class="cc-title">New topic</h1></div>

    <div class="cc-card">
      <div class="cc-card__body nt-body">
        <div class="cc-form-grid">
          <label class="cc-field">
            <span class="cc-label">Topic name <em>*</em></span>
            <input v-model.trim="name" class="cc-input" :class="{ 'cc-input--error': nameError }" type="text" placeholder="e.g. shop.orders" spellcheck="false" />
            <span v-if="nameError" class="cc-error-text">{{ nameError }}</span>
            <span v-else class="cc-hint">ASCII letters, digits, '.', '_' and '-' only.</span>
          </label>
          <label class="cc-field">
            <span class="cc-label">Number of partitions <em>*</em></span>
            <input v-model.number="partitions" class="cc-input" type="number" min="1" max="1000" />
            <span class="cc-hint">More partitions allow more consumers in a group to read in parallel.</span>
          </label>
        </div>

        <div v-if="!custom" class="nt-actions">
          <button type="button" class="cc-btn cc-btn--primary" :disabled="!!nameError || !name || cc.busy.value" @click="create">Create with defaults</button>
          <button type="button" class="cc-btn" @click="custom = true">Customize settings</button>
          <button type="button" class="cc-btn cc-btn--ghost" @click="cc.go({ page: 'topics' })">Cancel</button>
        </div>

        <template v-else>
          <section class="nt-section">
            <h2 class="cc-h2">Availability</h2>
            <div class="cc-form-grid">
              <label class="cc-field">
                <span class="cc-label">Replication factor</span>
                <select v-model.number="rf" class="cc-select">
                  <option v-for="n in rfOptions" :key="n" :value="n">{{ n }}</option>
                </select>
                <span class="cc-hint">{{ online }} broker(s) online. Production topics use 3.</span>
              </label>
              <label class="cc-field">
                <span class="cc-label">Min in-sync replicas (min.insync.replicas)</span>
                <input v-model.number="minIsr" class="cc-input" type="number" min="1" :max="rf" />
                <span class="cc-hint">With acks=all, a write fails when fewer replicas than this are in sync.</span>
              </label>
            </div>
          </section>
          <section class="nt-section">
            <h2 class="cc-h2">Storage</h2>
            <div class="cc-form-grid">
              <label class="cc-field">
                <span class="cc-label">Cleanup policy (cleanup.policy)</span>
                <select v-model="cleanup" class="cc-select">
                  <option value="delete">Delete</option>
                  <option value="compact">Compact</option>
                  <option value="compact,delete">Compact and delete</option>
                </select>
              </label>
              <label class="cc-field">
                <span class="cc-label">Retention time (retention.ms)</span>
                <select v-model="retention" class="cc-select">
                  <option v-for="r in RETENTION" :key="r[0]" :value="r[0]">{{ r[1] }}</option>
                </select>
              </label>
              <label v-if="retention === 'custom'" class="cc-field">
                <span class="cc-label">Custom retention (ms)</span>
                <input v-model.trim="retentionCustom" class="cc-input" type="text" inputmode="numeric" />
              </label>
              <label class="cc-field">
                <span class="cc-label">Retention size (retention.bytes)</span>
                <input v-model.trim="retentionBytes" class="cc-input" type="text" inputmode="numeric" placeholder="-1 (infinite)" />
              </label>
            </div>
          </section>
          <section class="nt-section">
            <h2 class="cc-h2">Message size</h2>
            <div class="cc-form-grid">
              <label class="cc-field">
                <span class="cc-label">Maximum message size in bytes (max.message.bytes)</span>
                <input v-model.trim="maxBytes" class="cc-input" type="text" inputmode="numeric" placeholder="1048588" />
              </label>
            </div>
          </section>
          <div v-if="formError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ formError }}</span></div>
          <div class="nt-actions">
            <button type="button" class="cc-btn cc-btn--primary" :disabled="!!nameError || !name || cc.busy.value" @click="create">Save &amp; create</button>
            <button type="button" class="cc-btn cc-btn--ghost" @click="cc.go({ page: 'topics' })">Cancel</button>
          </div>
        </template>
        <div v-if="error" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ error }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME, kafkaTopics, repeated } from './confluent';

const cc = useCc();
const RETENTION: [string, string][] = [
  ['3600000', '1 hour'], ['86400000', '1 day'], ['604800000', '1 week (default)'],
  ['2592000000', '1 month'], ['31536000000', '1 year'], ['-1', 'Infinite'], ['custom', 'Custom'],
];

const name = ref('');
const partitions = ref(6);
const custom = ref(false);
const online = computed(() => cc.brokers.value.filter(b => b.status === 'online').length || 1);
const rfOptions = computed(() => Array.from({ length: Math.max(3, cc.brokers.value.length) }, (_, i) => i + 1));
const rf = ref(3);
const minIsr = ref(2);
const cleanup = ref('delete');
const retention = ref('604800000');
const retentionCustom = ref('');
const retentionBytes = ref('');
const maxBytes = ref('');
const error = ref('');

const nameError = computed(() => {
  if (!name.value) return '';
  if (!/^[a-zA-Z0-9._-]{1,249}$/.test(name.value) || name.value === '.' || name.value === '..') {
    return "Topic names may only contain ASCII letters, digits, '.', '_' and '-'.";
  }
  if (cc.topic(name.value)) return `Topic "${name.value}" already exists.`;
  return '';
});
const formError = computed(() => {
  if (!Number.isInteger(partitions.value) || partitions.value < 1) return 'Number of partitions must be at least 1.';
  if (minIsr.value < 1 || minIsr.value > rf.value) return 'Min in-sync replicas must be between 1 and the replication factor.';
  if (retention.value === 'custom' && !/^-?\d+$/.test(retentionCustom.value)) return 'Custom retention must be a number of milliseconds.';
  if (retentionBytes.value && !/^-?\d+$/.test(retentionBytes.value)) return 'Retention size must be a number of bytes.';
  if (maxBytes.value && !/^\d+$/.test(maxBytes.value)) return 'Maximum message size must be a number of bytes.';
  return '';
});

async function create() {
  error.value = '';
  if (nameError.value || !name.value) return;
  const words: (string | number)[] = ['--create', '--topic', name.value, '--partitions', partitions.value];
  if (custom.value) {
    if (formError.value) return;
    words.push('--replication-factor', rf.value);
    words.push(...repeated('--config', {
      'cleanup.policy': cleanup.value,
      'retention.ms': retention.value === 'custom' ? retentionCustom.value : retention.value,
      'min.insync.replicas': String(minIsr.value),
      'retention.bytes': retentionBytes.value,
      'max.message.bytes': maxBytes.value,
    }));
  } else {
    words.push('--replication-factor', Math.min(3, online.value));
  }
  const result = await cc.run(kafkaTopics(words), { success: `Topic ${name.value} created`, quiet: true });
  if (!result.ok) { error.value = errorText(result); return; }
  cc.go({ page: 'topic', name: name.value, tab: 'overview' });
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.nt-body { display: flex; flex-direction: column; gap: 20px; }
.nt-section { display: flex; flex-direction: column; gap: 12px; padding-top: 16px; border-top: 1px solid var(--cc-border); }
.nt-actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
