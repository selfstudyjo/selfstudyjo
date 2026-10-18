<template>
  <div class="az-blade">
    <div class="az-blade__head">
      <AzIcon name="dashboard" :size="28" />
      <div class="az-blade__titles"><h1 class="az-blade__title">My Dashboard</h1>
        <div class="az-blade__sub">Private dashboard</div></div>
    </div>
    <div class="az-cmdbar">
      <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
      <button type="button" class="az-cmd" disabled><AzIcon name="plus" /> Create</button>
      <button type="button" class="az-cmd" disabled><AzIcon name="edit" /> Edit</button>
    </div>
    <div class="az-dash">
      <div class="az-card az-dash__tile az-dash__wide">
        <h3>All resources</h3>
        <div class="az-muted">Subscription: {{ az.p.value.account?.subscription_name }}</div>
        <div v-for="r in resources.slice(0, 8)" :key="r.id" class="az-dash__row">
          <button type="button" class="az-link az-namecell" @click="az.go({ page: 'resource', id: r.id })">
            <AzIcon :name="meta(r.kind).icon" /> {{ r.name }}</button>
          <span class="az-muted">{{ meta(r.kind).singular }}</span>
        </div>
        <div v-if="!resources.length" class="az-muted" style="padding: 20px 0">No resources to display</div>
        <button type="button" class="az-link" @click="az.go({ page: 'browse', kind: 'all' })">See more</button>
      </div>
      <div class="az-card az-dash__tile">
        <h3>Resource groups</h3>
        <div class="az-big">{{ groups.length }}</div>
        <div class="az-muted">in {{ locations }} region(s)</div>
      </div>
      <div class="az-card az-dash__tile">
        <h3>Cost (estimated)</h3>
        <div class="az-big">${{ cost.toLocaleString() }}</div>
        <div class="az-muted">per month, list price ballpark</div>
      </div>
      <div class="az-card az-dash__tile">
        <h3>Policy compliance</h3>
        <div class="az-big">{{ compliance }}</div>
        <div class="az-muted">{{ nonCompliant }} non-compliant evaluation(s)</div>
      </div>
      <div class="az-card az-dash__tile">
        <h3>Virtual machines</h3>
        <div class="az-big">{{ running }} / {{ vms }}</div>
        <div class="az-muted">running</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { pick, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import { meta, useAz } from './azure';

const az = useAz();
const resources = computed(() => rows(az.p.value, 'resources'));
const groups = computed(() => rows(az.p.value, 'groups'));
const locations = computed(() => new Set(groups.value.map(g => g.location)).size);
const cost = computed(() => Number(pick(az.v.value, 'platform.monthly_cost', 0)));
const evals = computed(() => rows(az.v.value, 'compliance'));
const nonCompliant = computed(() => evals.value.filter(e => e.status === 'non-compliant').length);
const compliance = computed(() => (evals.value.length
  ? `${Math.round(100 * (evals.value.length - nonCompliant.value) / evals.value.length)}%` : '—'));
const vms = computed(() => resources.value.filter(r => r.kind === 'vm').length);
const running = computed(() => resources.value.filter(r => r.kind === 'vm' && r.props?.power === 'VM running').length);
</script>

<style scoped>
.az-dash { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.az-dash__wide { grid-column: span 2; }
.az-dash__row { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
.az-big { font-size: 34px; font-weight: 600; line-height: 1.2; margin: 6px 0; }
@container sl-portal (max-width: 560px) { .az-dash__wide { grid-column: auto; } }
</style>
