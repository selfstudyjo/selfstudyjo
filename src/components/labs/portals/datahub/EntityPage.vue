<template>
  <div v-if="!entity" class="dh-page">
    <div class="dh-card dh-empty">
      <DhIcon name="search" />
      <h2 class="dh-h3">Entity not found</h2>
      <span class="dh-mono">{{ fullUrn(urn) }}</span>
      <span class="dh-hint">It is not in the catalogue. Lineage can reference assets that were never ingested.</span>
      <button type="button" class="dh-btn" @click="dh.go({ page: 'home' })">Back to home</button>
    </div>
  </div>
  <div v-else class="dh-entity">
    <div class="dh-entity__main">
      <!-- The entity header: type, browse path, title, URN, the lineage / impact actions -->
      <header class="dh-entity__head">
        <div class="dh-entity__crumbs">
          <PlatformIcon :platform="entity.platform" :size="16" />
          <span>Dataset</span><span class="dh-sep">·</span><span>{{ subtypeOf(entity.platform) }}</span>
          <span class="dh-sep">·</span><span>{{ platformLabel(entity.platform) }}</span>
          <template v-for="(p, i) in browsePath(entity.urn)" :key="i"><span class="dh-sep">›</span><span>{{ p }}</span></template>
        </div>
        <div class="dh-entity__titlerow">
          <PlatformIcon :platform="entity.platform" :size="30" />
          <h1 class="dh-entity__title">{{ shortName(entity.urn) }}</h1>
          <button type="button" class="dh-btn dh-btn--text dh-btn--sm" title="Copy URN" @click="copyUrn">
            <DhIcon name="copy" /> Copy URN
          </button>
          <span class="dh-spacer" />
          <button type="button" class="dh-btn" @click="setTab('Lineage')"><DhIcon name="lineage" /> Lineage</button>
          <button type="button" class="dh-btn" @click="impact"><DhIcon name="diff" /> Impact Analysis</button>
        </div>
        <div class="dh-entity__stats">
          <span><DhIcon name="column" :size="13" /> {{ entity.columns.length }} columns</span>
          <span><DhIcon name="lineage" :size="13" /> {{ entity.upstream }} upstream · {{ entity.downstream }} downstream</span>
          <span v-if="entity.assertions" class="dh-pill" :class="entity.assertions.status === 'passing' ? 'dh-pill--ok' : 'dh-pill--bad'">
            <DhIcon :name="entity.assertions.status === 'passing' ? 'check-circle' : 'x-circle'" :size="12" />
            {{ entity.assertions.status === 'passing' ? 'Assertions passing' : entity.assertions.failed + ' failing assertion' + (entity.assertions.failed === 1 ? '' : 's') }}
          </span>
          <span v-if="entity.contract" class="dh-pill dh-pill--info"><DhIcon name="contract" :size="12" /> Contract v{{ entity.contract.version }}</span>
          <span v-if="openIncidents.length" class="dh-pill dh-pill--bad"><DhIcon name="incident" :size="12" /> {{ openIncidents.length }} active incident{{ openIncidents.length === 1 ? '' : 's' }}</span>
          <span v-if="entity.pii_columns.length" class="dh-pill dh-pill--warn"><DhIcon name="lock" :size="12" /> {{ entity.pii_columns.length }} PII field{{ entity.pii_columns.length === 1 ? '' : 's' }}</span>
          <span class="dh-pill" :class="entity.ingested ? 'dh-pill--grey' : 'dh-pill--warn'">{{ entity.ingested ? 'Ingested' : 'Not ingested yet' }}</span>
        </div>
      </header>

      <nav class="dh-tabs dh-entity__tabs" aria-label="Dataset tabs">
        <button v-for="t in tabs" :key="t.key" type="button" :class="{ 'is-active': tab === t.key }" @click="setTab(t.key)">
          <DhIcon :name="t.icon" :size="14" />{{ t.key }}
          <span v-if="t.count" class="dh-count">{{ t.count }}</span>
        </button>
      </nav>

      <section class="dh-entity__body">
        <SchemaTab v-if="tab === 'Schema'" :entity="entity" />
        <div v-else-if="tab === 'Documentation'" class="dh-docs">
          <div class="dh-row">
            <h2 class="dh-h3">About</h2><span class="dh-spacer" />
            <button type="button" class="dh-btn dh-btn--sm" @click="editing = { mode: 'docs', initial: entity.description }"><DhIcon name="pencil" /> Edit</button>
          </div>
          <p v-if="entity.description" class="dh-docs__text">{{ entity.description }}</p>
          <div v-else class="dh-empty">
            <DhIcon name="doc" />
            <span>No documentation yet. Share your knowledge by adding documentation.</span>
            <button type="button" class="dh-btn dh-btn--primary" @click="editing = { mode: 'docs', initial: '' }"><DhIcon name="pencil" /> Add Documentation</button>
          </div>
          <h3 class="dh-h4">Field documentation</h3>
          <div class="dh-table-wrap">
            <table class="dh-table">
              <thead><tr><th>Field</th><th>Description</th></tr></thead>
              <tbody>
                <tr v-for="c in entity.columns" :key="c.name">
                  <td class="dh-mono">{{ c.name }}</td>
                  <td :class="{ 'dh-muted': !c.description }">{{ c.description || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <LineageTab v-else-if="tab === 'Lineage'" :entity="entity" />
        <div v-else-if="tab === 'Properties'" class="dh-table-wrap">
          <table class="dh-table">
            <thead><tr><th>Name</th><th>Value</th></tr></thead>
            <tbody>
              <tr v-for="p in properties" :key="p[0]"><td class="dh-prop-k">{{ p[0] }}</td><td class="dh-mono">{{ p[1] }}</td></tr>
            </tbody>
          </table>
        </div>
        <QualityTab v-else-if="tab === 'Quality'" :entity="entity" />
        <ContractTab v-else-if="tab === 'Contract'" :entity="entity" />
        <IncidentsList v-else :dataset="entity.urn" />
      </section>

      <div v-if="impactRows" class="dh-card dh-impact">
        <div class="dh-card__head">
          <h2 class="dh-h4">Impact analysis</h2><span class="dh-muted">{{ impactRows.length }} downstream asset{{ impactRows.length === 1 ? '' : 's' }}</span>
          <span class="dh-spacer" /><button type="button" class="dh-btn dh-btn--text dh-btn--sm" aria-label="Close impact" @click="impactRows = null"><DhIcon name="close" /></button>
        </div>
        <div class="dh-card__body">
          <div v-if="!impactRows.length" class="dh-muted">No downstream assets depend on this dataset.</div>
          <table v-else class="dh-table">
            <thead><tr><th>Asset</th><th>Hops</th><th>Via</th><th>Owners to notify</th></tr></thead>
            <tbody>
              <tr v-for="r in impactRows" :key="String(r[0])">
                <td><button type="button" class="dh-link" @click="dh.openEntity(String(r[0]))">{{ r[0] }}</button></td>
                <td>{{ r[1] }}</td><td class="dh-mono">{{ r[2] }}</td><td>{{ r[3] || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <EntitySidebar :entity="entity" @edit="editing = $event" />

    <EditModal v-if="editing" :mode="editing.mode" :urn="entity.urn" :column="editing.column" :initial="editing.initial"
               @close="editing = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import PlatformIcon from './PlatformIcon.vue';
import SchemaTab from './SchemaTab.vue';
import LineageTab from './LineageTab.vue';
import QualityTab from './QualityTab.vue';
import ContractTab from './ContractTab.vue';
import IncidentsList from './IncidentsList.vue';
import EntitySidebar from './EntitySidebar.vue';
import EditModal from './EditModal.vue';
import {
  browsePath, dh as cmd, fullUrn, platformLabel, sameDataset, shortName, subtypeOf, useDh,
} from './dhContext';

const dh = useDh();
const urn = computed(() => dh.route.value.urn || '');
const entity = computed(() => dh.dataset(urn.value));
const tab = computed(() => dh.route.value.tab || 'Schema');

type Editing = { mode: 'tag' | 'term' | 'owner' | 'domain' | 'docs'; column?: string; initial?: string };
const editing = ref<Editing | null>(null);
const impactRows = ref<unknown[][] | null>(null);

const openIncidents = computed(() => dh.incidents.value.filter(i => i.status !== 'resolved' && sameDataset(i.dataset, urn.value)));
const results = computed(() => dh.results.value.filter(r => sameDataset(r.asset, urn.value)));
const contractCount = computed(() => dh.contractFiles.value.filter(c => c.dataset && sameDataset(c.dataset, urn.value)).length);

const tabs = computed(() => [
  { key: 'Schema', icon: 'schema', count: entity.value?.columns.length || 0 },
  { key: 'Documentation', icon: 'doc', count: 0 },
  { key: 'Lineage', icon: 'lineage', count: 0 },
  { key: 'Properties', icon: 'props', count: 0 },
  { key: 'Quality', icon: 'quality', count: results.value.length },
  { key: 'Contract', icon: 'contract', count: contractCount.value },
  { key: 'Incidents', icon: 'incident', count: openIncidents.value.length },
]);

const properties = computed(() => {
  const e = entity.value;
  if (!e) return [];
  const list: [string, string][] = [
    ['urn', fullUrn(e.urn)],
    ['cli urn', e.urn],
    ['platform', e.platform],
    ['qualifiedName', e.name],
    ['env', 'PROD'],
    ['subType', subtypeOf(e.platform)],
    ['domain', e.domain || '—'],
    ['owners', e.owners.map(o => `${o.owner} (${o.type})`).join(', ') || '—'],
    ['columns', String(e.columns.length)],
    ['upstreamCount', String(e.upstream)],
    ['downstreamCount', String(e.downstream)],
    ['ingested', e.ingested ? 'true' : 'false'],
    ['contract', e.contract ? `${e.contract.name} v${e.contract.version}` : '—'],
  ];
  if (e.assertions) list.push(['lastAssertionSuite', `${e.assertions.suite} (${e.assertions.runs} run${e.assertions.runs === 1 ? '' : 's'})`]);
  return list;
});

function setTab(name: string) {
  dh.route.value = { ...dh.route.value, tab: name };
}

async function copyUrn() {
  try {
    await navigator.clipboard.writeText(fullUrn(urn.value));
    dh.notify('success', 'URN copied');
  } catch {
    dh.notify('info', 'URN', fullUrn(urn.value));
  }
}

async function impact() {
  const result = await dh.run(cmd(['datahub', 'impact'], { '--urn': urn.value }));
  if (!result.ok) return;
  const grid = ((result.data as any)?.grids || [])[0];
  impactRows.value = grid ? grid.rows : [];
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-entity { display: flex; min-height: 100%; align-items: stretch; }
.dh-entity__main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dh-entity__head { background: #fff; padding: 16px 24px 12px; display: flex; flex-direction: column; gap: 8px; }
.dh-entity__crumbs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--dh-text-2); }
.dh-sep { color: #8c8c8c; }
.dh-entity__titlerow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dh-entity__title { margin: 0; font-size: 24px; line-height: 32px; font-weight: 700; overflow-wrap: anywhere; min-width: 0; }
.dh-entity__stats { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--dh-text-2); }
.dh-entity__stats > span:not(.dh-pill) { display: inline-flex; align-items: center; gap: 5px; }
.dh-entity__tabs { background: #fff; padding: 0 24px; }
.dh-entity__body { padding: 16px 24px 24px; min-width: 0; }
.dh-docs { display: flex; flex-direction: column; gap: 12px; }
.dh-docs__text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; background: #fff; border: 1px solid var(--dh-border); border-radius: 8px; padding: 14px 16px; }
.dh-prop-k { font-weight: 600; white-space: nowrap; }
.dh-impact { margin: 0 24px 24px; }
@container sl-portal (max-width: 1000px) {
  .dh-entity { flex-direction: column; }
}
@container sl-portal (max-width: 640px) {
  .dh-entity__head, .dh-entity__body { padding-left: 12px; padding-right: 12px; }
  .dh-entity__tabs { padding: 0 12px; }
  .dh-impact { margin: 0 12px 12px; }
}
</style>
