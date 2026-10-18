<template>
  <div class="az-blade az-home">
    <section class="az-home__sec">
      <h2 class="az-home__h">Azure services</h2>
      <div class="az-tiles">
        <button type="button" class="az-tile" @click="az.go({ page: 'create', kind: 'marketplace' })">
          <span class="az-tile__ico az-tile__ico--create"><AzIcon name="plus" :size="30" /></span>
          <span>Create a resource</span>
        </button>
        <button v-for="s in tiles" :key="s.key" type="button" class="az-tile" @click="az.go(s.route)">
          <span class="az-tile__ico"><AzIcon :name="s.icon" :size="34" /></span>
          <span>{{ s.label }}</span>
        </button>
        <button type="button" class="az-tile" @click="az.go({ page: 'services' })">
          <span class="az-tile__ico az-tile__ico--create"><AzIcon name="chevron" :size="26" /></span>
          <span>More services</span>
        </button>
      </div>
    </section>

    <section class="az-home__sec">
      <h2 class="az-home__h">Resources</h2>
      <div class="az-tabs">
        <button type="button" class="az-tab" :class="{ 'is-active': which === 'recent' }" @click="which = 'recent'">Recent</button>
        <button type="button" class="az-tab" :class="{ 'is-active': which === 'fav' }" @click="which = 'fav'">Favorite</button>
      </div>
      <template v-if="which === 'recent'">
        <div v-if="!recent.length" class="az-empty">
          <AzIcon name="group" :size="48" />
          <h3>No resources have been viewed recently</h3>
          <p>View a list of all your resources</p>
          <button type="button" class="az-btn az-btn--primary" @click="az.go({ page: 'browse', kind: 'all' })">View all resources</button>
        </div>
        <AzTable v-else :columns="cols" :rows="recent" row-key="id">
          <template #cell-name="{ row }">
            <button type="button" class="az-link az-namecell" @click="open(row)">
              <AzIcon :name="row.icon" /> {{ row.name }}</button>
          </template>
        </AzTable>
        <button v-if="recent.length" type="button" class="az-link" style="margin-top: 10px"
                @click="az.go({ page: 'browse', kind: 'all' })">See all</button>
      </template>
      <div v-else class="az-empty az-empty--small">
        <h3>No favorite resources</h3>
        <p>Select the star next to a resource name to add it to your favorites.</p>
      </div>
    </section>

    <section class="az-home__sec">
      <h2 class="az-home__h">Navigate</h2>
      <div class="az-nav">
        <button type="button" class="az-navlink" @click="az.go({ page: 'service', name: 'subscriptions' })">
          <AzIcon name="subscription" :size="22" /> Subscriptions</button>
        <button type="button" class="az-navlink" @click="az.go({ page: 'browse', kind: 'groups' })">
          <AzIcon name="group" :size="22" /> Resource groups</button>
        <button type="button" class="az-navlink" @click="az.go({ page: 'browse', kind: 'all' })">
          <AzIcon name="allservices" :size="22" /> All resources</button>
        <button type="button" class="az-navlink" @click="az.go({ page: 'dashboard' })">
          <AzIcon name="dashboard" :size="22" /> Dashboard</button>
      </div>
    </section>

    <section class="az-home__sec">
      <h2 class="az-home__h">Tools</h2>
      <div class="az-cards">
        <button type="button" class="az-card az-toolcard" @click="az.go({ page: 'service', name: 'monitor' })">
          <AzIcon name="monitor" :size="28" />
          <span><b>Azure Monitor</b><br /><span class="az-muted">Monitor your apps and infrastructure</span></span></button>
        <button type="button" class="az-card az-toolcard" @click="az.go({ page: 'service', name: 'policy' })">
          <AzIcon name="policy" :size="28" />
          <span><b>Azure Policy</b><br /><span class="az-muted">Enforce organizational standards and assess compliance</span></span></button>
        <button type="button" class="az-card az-toolcard" @click="az.go({ page: 'service', name: 'cost' })">
          <AzIcon name="cost" :size="28" />
          <span><b>Cost Management</b><br /><span class="az-muted">Analyze and optimize your cloud spend for free</span></span></button>
        <button type="button" class="az-card az-toolcard" @click="az.go({ page: 'service', name: 'advisor' })">
          <AzIcon name="advisor" :size="28" />
          <span><b>Advisor</b><br /><span class="az-muted">Get personalized recommendations</span></span></button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/** Home: the Azure services row, recent resources, Navigate and Tools. */
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzTable from './AzTable.vue';
import { meta, useAz } from './azure';
import { SERVICES } from './services';

const az = useAz();
const which = ref<'recent' | 'fav'>('recent');
const TILE_KEYS = ['groups', 'vm', 'storage', 'vnet', 'webapp', 'sqldb', 'keyvault', 'monitor', 'policy'];
const tiles = TILE_KEYS.map(k => SERVICES.find(s => s.key === k)!).filter(Boolean);

const recent = computed(() => {
  const res = rows(az.p.value, 'resources').map(r => ({ id: r.id, name: r.name, kind: r.kind,
    icon: meta(r.kind).icon, type: meta(r.kind).singular, created: Number(r.created || 0) }));
  const groups = rows(az.p.value, 'groups').map(g => ({ id: g.id, name: g.name, kind: 'group', icon: 'group',
    type: 'Resource group', created: Number(g.created || 0) }));
  return [...res, ...groups].sort((a, b) => b.created - a.created).slice(0, 10)
    .map((r): Record<string, any> => ({ ...r, viewed: 'a few seconds ago' }));
});
const cols = [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'viewed', label: 'Last Viewed' }];
function open(row: Record<string, any>) {
  if (row.kind === 'group') az.go({ page: 'group', name: row.name });
  else az.go({ page: 'resource', id: row.id });
}
</script>

<style scoped>
.az-home { max-width: 1280px; }
.az-home__sec { margin: 8px 0 26px; }
.az-home__h { margin: 10px 0 12px; font-size: 16px; font-weight: 600; }
.az-nav { display: flex; flex-wrap: wrap; gap: 8px 32px; }
.az-navlink { display: inline-flex; align-items: center; gap: 10px; border: 0; background: none; padding: 6px 0;
  font: 13px inherit; color: #115ea3; cursor: pointer; }
.az-navlink:hover { text-decoration: underline; }
.az-toolcard { display: flex; gap: 12px; align-items: flex-start; text-align: left; cursor: pointer; font: inherit; color: inherit; }
.az-toolcard:hover { background: #fafafa; }
</style>
