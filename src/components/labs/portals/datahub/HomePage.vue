<template>
  <div class="dh-page dh-home">
    <section class="dh-home__hero">
      <h1 class="dh-home__greet">{{ greeting }}, datahub</h1>
      <p class="dh-muted">Discover, understand and trust the ShopFlow data platform. {{ dh.datasets.value.length }} assets catalogued<span v-if="dh.clockText.value"> · platform clock {{ dh.clockText.value }}</span>.</p>
    </section>

    <div class="dh-home__grid">
      <section class="dh-card dh-home__wide">
        <div class="dh-card__head"><h2 class="dh-h3">Explore your data</h2><span class="dh-spacer" />
          <button type="button" class="dh-btn dh-btn--link" @click="dh.go({ page: 'search', query: '', platforms: [] })">View all</button>
        </div>
        <div class="dh-card__body">
          <div v-if="!platformCounts.length" class="dh-empty">
            <DhIcon name="plug" />
            <span>No assets yet. Run an ingestion recipe to pull metadata into DataHub.</span>
            <button type="button" class="dh-btn dh-btn--primary" @click="dh.go({ page: 'ingestion' })">Go to Ingestion</button>
          </div>
          <div v-else class="dh-platforms">
            <button v-for="p in platformCounts" :key="p.platform" type="button" class="dh-platform"
                    @click="explore(p.platform)">
              <PlatformIcon :platform="p.platform" :size="28" />
              <span class="dh-platform__name">{{ platformLabel(p.platform) }}</span>
              <span class="dh-platform__count">{{ p.count }} {{ p.count === 1 ? 'asset' : 'assets' }}</span>
            </button>
          </div>
        </div>
      </section>

      <section class="dh-card">
        <div class="dh-card__head"><h2 class="dh-h3">Data health</h2></div>
        <div class="dh-card__body dh-health">
          <button type="button" class="dh-health__row" @click="dh.go({ page: 'incidents' })">
            <DhIcon name="incident" /><span>Open incidents</span><span class="dh-spacer" />
            <span class="dh-pill" :class="openIncidents ? 'dh-pill--bad' : 'dh-pill--ok'">{{ openIncidents }}</span>
          </button>
          <button type="button" class="dh-health__row" @click="dh.go({ page: 'monitors' })">
            <DhIcon name="pulse" /><span>Monitors alerting</span><span class="dh-spacer" />
            <span class="dh-pill" :class="alerting ? 'dh-pill--bad' : 'dh-pill--ok'">{{ alerting }} / {{ dh.monitors.value.length }}</span>
          </button>
          <button type="button" class="dh-health__row" @click="dh.go({ page: 'gx' })">
            <DhIcon name="quality" /><span>Failing assertions</span><span class="dh-spacer" />
            <span class="dh-pill" :class="failingAssertions ? 'dh-pill--bad' : 'dh-pill--ok'">{{ failingAssertions }}</span>
          </button>
          <button type="button" class="dh-health__row" @click="dh.go({ page: 'pii' })">
            <DhIcon name="lock" /><span>Unmasked PII columns</span><span class="dh-spacer" />
            <span class="dh-pill" :class="dh.piiUnmasked.value.length ? 'dh-pill--warn' : 'dh-pill--ok'">{{ dh.piiUnmasked.value.length }}</span>
          </button>
        </div>
      </section>

      <section class="dh-card">
        <div class="dh-card__head"><h2 class="dh-h3">Domains</h2><span class="dh-spacer" />
          <button type="button" class="dh-btn dh-btn--link" @click="dh.go({ page: 'domains' })">View all</button>
        </div>
        <div class="dh-card__body">
          <div v-if="!dh.domains.value.length" class="dh-muted">No domains yet.</div>
          <button v-for="d in dh.domains.value.slice(0, 6)" :key="d.name" type="button" class="dh-health__row"
                  @click="dh.go({ page: 'domains', name: d.name })">
            <DhIcon name="domain" /><span class="dh-strong">{{ d.name }}</span><span class="dh-spacer" />
            <span class="dh-muted">{{ countIn(d.name) }} assets</span>
          </button>
        </div>
      </section>

      <section class="dh-card">
        <div class="dh-card__head"><h2 class="dh-h3">Recently viewed</h2></div>
        <div class="dh-card__body">
          <div v-if="!recentRows.length" class="dh-muted">Assets you open appear here.</div>
          <button v-for="d in recentRows" :key="d.urn" type="button" class="dh-health__row" @click="dh.openEntity(d.urn)">
            <PlatformIcon :platform="d.platform" :size="16" /><span class="dh-strong">{{ shortName(d.urn) }}</span>
            <span class="dh-muted dh-ellipsis">{{ browsePath(d.urn).join('.') }}</span>
          </button>
        </div>
      </section>

      <section class="dh-card">
        <div class="dh-card__head"><h2 class="dh-h3">Business glossary</h2><span class="dh-spacer" />
          <button type="button" class="dh-btn dh-btn--link" @click="dh.go({ page: 'glossary' })">View all</button>
        </div>
        <div class="dh-card__body dh-row">
          <div v-if="!dh.terms.value.length" class="dh-muted">No glossary terms yet.</div>
          <button v-for="t in dh.terms.value.slice(0, 10)" :key="t.name" type="button" class="dh-tag dh-term dh-tagbtn"
                  @click="dh.go({ page: 'glossary', name: t.name })">
            <DhIcon name="book" :size="12" /><span class="dh-tag__text">{{ t.name }}</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DhIcon from './DhIcon.vue';
import PlatformIcon from './PlatformIcon.vue';
import { browsePath, dh as cmd, platformLabel, shortName, useDh, type DhDataset } from './dhContext';

const props = defineProps<{ recent: string[] }>();
const dh = useDh();

const greeting = computed(() => {
  const time = dh.clockText.value;
  const hour = Number((time.match(/(\d{2}):\d{2}/) || [])[1] ?? 9);
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
});

const platformCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const d of dh.datasets.value) counts.set(d.platform, (counts.get(d.platform) || 0) + 1);
  return [...counts.entries()].map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count || a.platform.localeCompare(b.platform));
});
const openIncidents = computed(() => dh.incidents.value.filter(i => i.status !== 'resolved').length);
const alerting = computed(() => dh.monitors.value.filter(m => m.status === 'ALERT').length);
const failingAssertions = computed(() => dh.datasets.value.filter(d => d.assertions?.status === 'failing').length);
const recentRows = computed(() => props.recent.map(u => dh.dataset(u)).filter((d): d is DhDataset => Boolean(d)));

function countIn(domain: string) {
  return dh.datasets.value.filter(d => d.domain === domain).length;
}

async function explore(platform: string) {
  dh.go({ page: 'search', query: '', platforms: [platform] });
  await dh.run(cmd(['datahub', 'search', '*'], { '--platform': platform }), { quiet: true });
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-home { max-width: 1320px; margin: 0 auto; width: 100%; box-sizing: border-box; }
.dh-home__hero { padding: 6px 0 2px; }
.dh-home__greet { margin: 0 0 4px; font-size: 24px; line-height: 32px; font-weight: 700; }
.dh-home__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px; }
.dh-home__wide { grid-column: 1 / -1; }
.dh-platforms { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr)); gap: 12px; }
.dh-platform {
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px; border: 1px solid var(--dh-border);
  border-radius: 8px; background: #fff; cursor: pointer; font: inherit; text-align: left; color: var(--dh-text);
}
.dh-platform:hover { border-color: var(--dh-primary); box-shadow: 0 2px 8px rgba(22, 119, 255, .12); }
.dh-platform__name { font-weight: 700; }
.dh-platform__count { color: var(--dh-text-2); font-size: 13px; }
.dh-health { display: flex; flex-direction: column; gap: 2px; padding: 8px; }
.dh-health__row {
  display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: none; padding: 8px; border-radius: 6px;
  font: inherit; color: var(--dh-text); cursor: pointer; text-align: left; min-width: 0;
}
.dh-health__row:hover { background: var(--dh-hover); }
.dh-health__row > .dh-ico { color: var(--dh-text-2); }
.dh-strong { font-weight: 600; flex: none; }
.dh-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; font-size: 12px; }
.dh-tagbtn { cursor: pointer; font: inherit; font-size: 12px; }
.dh-tagbtn:hover { border-color: #722ed1; }
</style>
