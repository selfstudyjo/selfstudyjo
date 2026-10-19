<template>
  <div class="sf-page home">
    <div class="home__hero">
      <h1 class="sf-h1">Welcome back, {{ firstName }}</h1>
      <p class="sf-muted">{{ account }} · {{ region }}</p>
    </div>

    <div class="home__actions">
      <button type="button" class="home__action" @click="sf.openWorksheet('')">
        <span class="home__icon"><SfIcon name="worksheet" /></span>
        <b>Query data</b><span>Write SQL in a worksheet</span>
      </button>
      <button type="button" class="home__action" @click="sf.go({ page: 'databases' })">
        <span class="home__icon home__icon--b"><SfIcon name="database" /></span>
        <b>Explore data</b><span>Browse databases, schemas and tables</span>
      </button>
      <button type="button" class="home__action" @click="sf.create('stage')">
        <span class="home__icon home__icon--c"><SfIcon name="upload" /></span>
        <b>Load data</b><span>Create a stage on the data lake</span>
      </button>
      <button type="button" class="home__action" @click="sf.go({ page: 'query-history' })">
        <span class="home__icon home__icon--d"><SfIcon name="history" /></span>
        <b>Monitor queries</b><span>Query history and profiles</span>
      </button>
    </div>

    <div class="home__cols">
      <section class="sf-card">
        <div class="sf-page-head"><h2 class="sf-h2">Recent worksheets</h2><span class="sf-spacer"></span>
          <button type="button" class="sf-link" @click="sf.go({ page: 'worksheets' })">View all</button></div>
        <ul class="home__list">
          <li v-for="w in recent" :key="w.id">
            <button type="button" class="home__item" @click="sf.go({ page: 'worksheet', id: w.id })">
              <SfIcon name="worksheet" /><span>{{ w.name }}</span>
            </button>
          </li>
        </ul>
      </section>
      <section class="sf-card">
        <div class="sf-page-head"><h2 class="sf-h2">Account usage</h2><span class="sf-spacer"></span>
          <button type="button" class="sf-link" @click="sf.go({ page: 'cost' })">Cost Management</button></div>
        <div class="sf-grid-cards home__stats">
          <div class="sf-stat"><b>{{ fmtCredits(credits) }}</b><span>Credits used</span></div>
          <div class="sf-stat"><b>{{ queries.length }}</b><span>Queries</span></div>
          <div class="sf-stat"><b>{{ failed }}</b><span>Failed queries</span></div>
          <div class="sf-stat"><b>{{ running }}</b><span>Warehouses running</span></div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The Snowsight home page: quick actions, recent worksheets, account usage. */
import { computed } from 'vue';
import SfIcon from './SfIcon.vue';
import { useSf } from './sfContext';
import { pick } from '@/utils/portalKit';
import { fmtCredits, list } from './snowflake';

const sf = useSf();
const account = computed(() => String(pick(sf.view.value, 'warehouse.account', 'SHOPFLOW')).toUpperCase());
const region = computed(() => String(pick(sf.view.value, 'warehouse.region', 'AWS_EU_WEST_1')));
const firstName = computed(() => {
  const user = list.users(sf.view.value)[0];
  const name = String(user?.display_name || user?.name || 'DATA_ENGINEER');
  return name.split(/[_\s]/)[0].replace(/^\w/, c => c.toUpperCase()).replace(/\B\w+/, w => w.toLowerCase());
});
const recent = computed(() => [...sf.worksheets.value].sort((a, b) => b.modified - a.modified).slice(0, 6));
const queries = computed(() => list.queries(sf.view.value));
const failed = computed(() => queries.value.filter(q => /FAIL/i.test(q.status)).length);
const credits = computed(() => Number(pick(sf.view.value, 'warehouse.credits.total', 0)));
const running = computed(() => list.warehouses(sf.view.value).filter(w => String(w.state).toUpperCase() === 'STARTED').length);
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.home { gap: 20px; }
.home__hero p { margin: 2px 0 0; }
.home__actions { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr)); gap: 12px; }
.home__action { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 16px; border: 1px solid var(--sf-border); border-radius: 10px; background: var(--sf-bg); cursor: pointer; font: inherit; text-align: left; color: var(--sf-text); }
.home__action:hover { border-color: var(--sf-primary); box-shadow: 0 2px 8px rgba(26, 108, 231, .12); }
.home__action b { font-size: 14px; font-weight: 600; margin-top: 6px; }
.home__action span:last-child { font-size: 12px; color: var(--sf-text-2); }
.home__icon { width: 36px; height: 36px; border-radius: 8px; display: grid; place-items: center; background: #E3F4FB; color: #0E7FAA; }
.home__icon--b { background: #E8F0FD; color: #1556B8; }
.home__icon--c { background: #EAF6EC; color: #1B7F3A; }
.home__icon--d { background: #F3ECFC; color: #6B3FB5; }
.home__icon .sf-ico { width: 20px; height: 20px; }
.home__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 16px; }
.home__list { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; }
.home__item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 6px; border: 0; border-radius: 6px; background: none; font: inherit; color: var(--sf-text); cursor: pointer; text-align: left; }
.home__item:hover { background: var(--sf-hover); }
.home__item .sf-ico { color: var(--sf-text-2); }
.home__stats { margin-top: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 120px), 1fr)); }
</style>
