<template>
  <div class="dh-ct">
    <div v-if="entity.contract" class="dh-alert dh-alert--success">
      <DhIcon name="check-circle" />
      <div>Contract <b>{{ entity.contract.name }} v{{ entity.contract.version }}</b> is published on this dataset. Consumers can rely on its schema, freshness and quality guarantees.</div>
    </div>
    <div v-else class="dh-alert dh-alert--info">
      <DhIcon name="info" />
      <div>No data contract is published on this dataset. Write one as <code>contracts/&lt;name&gt;.yaml</code> in the Files tool (dataset, owner, version, fields, sla, quality), validate it against the live data here, then publish it.</div>
    </div>
    <ContractCard v-for="f in files" :key="f.path" :file="f" />
    <div v-if="!files.length" class="dh-card dh-empty">
      <DhIcon name="contract" />
      <span>No contract file names this dataset yet.</span>
      <button type="button" class="dh-btn" @click="dh.go({ page: 'contracts' })">All data contracts</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DhIcon from './DhIcon.vue';
import ContractCard from './ContractCard.vue';
import { sameDataset, useDh, type DhDataset } from './dhContext';

const props = defineProps<{ entity: DhDataset }>();
const dh = useDh();
const files = computed(() => dh.contractFiles.value.filter(f => f.dataset && sameDataset(f.dataset, props.entity.urn)));
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-ct { display: flex; flex-direction: column; gap: 14px; }
.dh-ct code { background: rgba(0, 0, 0, .05); padding: 0 4px; border-radius: 3px; font-family: var(--dh-mono); font-size: 12px; }
</style>
