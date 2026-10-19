<template>
  <div class="dh-search-page">
    <aside class="dh-filters" :class="{ 'is-open': filtersOpen }">
      <div class="dh-filters__head">
        <span class="dh-h4">Filters</span><span class="dh-spacer" />
        <button v-if="activeCount" type="button" class="dh-btn dh-btn--link dh-btn--sm" @click="clearAll">Clear all</button>
      </div>
      <div v-for="facet in facets" :key="facet.key" class="dh-facet">
        <div class="dh-facet__title">{{ facet.title }}</div>
        <div v-if="!facet.values.length" class="dh-facet__none">None</div>
        <label v-for="v in facet.values" :key="v.value" class="dh-facet__opt">
          <input type="checkbox" :checked="selected[facet.key].includes(v.value)" @change="toggle(facet.key, v.value)" />
          <PlatformIcon v-if="facet.key === 'platform'" :platform="v.value" :size="14" />
          <span class="dh-tag__dot" v-else-if="facet.key === 'tag'" :style="{ background: tagColor(v.value) }" />
          <span class="dh-facet__label">{{ facet.key === 'platform' ? platformLabel(v.value) : v.value }}</span>
          <span class="dh-facet__n">{{ v.count }}</span>
        </label>
      </div>
    </aside>

    <section class="dh-results">
      <div class="dh-results__bar">
        <button type="button" class="dh-btn dh-btn--sm dh-filters-toggle" @click="filtersOpen = !filtersOpen">
          <DhIcon name="filter" /> Filters<span v-if="activeCount"> ({{ activeCount }})</span>
        </button>
        <span class="dh-muted">
          Showing <b>{{ shown.length ? 1 : 0 }} - {{ shown.length }}</b> of <b>{{ shown.length }}</b> results
          <template v-if="dh.route.value.query"> for "<b>{{ dh.route.value.query }}</b>"</template>
        </span>
        <span class="dh-spacer" />
        <label class="dh-sort">Sort by
          <select v-model="sort" class="dh-select dh-select--sm">
            <option value="relevance">Relevance</option>
            <option value="name">Name A to Z</option>
            <option value="platform">Platform</option>
          </select>
        </label>
      </div>

      <div v-if="!shown.length" class="dh-card dh-empty">
        <DhIcon name="search" />
        <span>No results found for "{{ dh.route.value.query || '*' }}"</span>
        <span class="dh-hint">Try a broader query, clear a filter, or ingest more sources.</span>
      </div>

      <article v-for="d in shown" :key="d.urn" class="dh-result">
        <div class="dh-result__type">
          <PlatformIcon :platform="d.platform" :size="16" />
          <span>Dataset</span><span class="dh-dot-sep">·</span><span>{{ subtypeOf(d.platform) }}</span>
          <span class="dh-dot-sep">·</span><span>{{ platformLabel(d.platform) }}</span>
          <template v-for="(p, i) in browsePath(d.urn)" :key="i"><span class="dh-dot-sep">›</span><span>{{ p }}</span></template>
        </div>
        <button type="button" class="dh-result__name" @click="dh.openEntity(d.urn)">{{ shortName(d.urn) }}</button>
        <p class="dh-result__desc" :class="{ 'is-empty': !d.description }">{{ d.description || 'No description' }}</p>
        <div class="dh-result__meta">
          <span v-if="d.domain" class="dh-tag"><DhIcon name="domain" :size="12" /><span class="dh-tag__text">{{ d.domain }}</span></span>
          <span v-for="t in d.tags" :key="'t' + t" class="dh-tag"><span class="dh-tag__dot" :style="{ background: tagColor(t) }" /><span class="dh-tag__text">{{ t }}</span></span>
          <span v-for="t in d.terms" :key="'g' + t" class="dh-tag dh-term"><DhIcon name="book" :size="12" /><span class="dh-tag__text">{{ t }}</span></span>
          <span v-if="d.pii_columns.length" class="dh-pill dh-pill--warn"><DhIcon name="lock" :size="12" /> {{ d.pii_columns.length }} PII</span>
          <span v-if="d.assertions" class="dh-pill" :class="d.assertions.status === 'passing' ? 'dh-pill--ok' : 'dh-pill--bad'">
            {{ d.assertions.status === 'passing' ? 'Assertions passing' : 'Assertions failing' }}
          </span>
        </div>
        <div class="dh-result__foot">
          <span><DhIcon name="column" :size="13" /> {{ d.columns.length }} columns</span>
          <span><DhIcon name="lineage" :size="13" /> {{ d.upstream }} upstream · {{ d.downstream }} downstream</span>
          <span v-if="d.owners.length" class="dh-result__owners"><DhIcon name="user" :size="13" />
            <span v-for="o in d.owners" :key="o.owner" class="dh-owner-chip" :title="o.type">{{ o.owner }}</span>
          </span>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import PlatformIcon from './PlatformIcon.vue';
import { browsePath, platformLabel, searchDatasets, shortName, subtypeOf, tagColor, useDh, type DhDataset } from './dhContext';

const dh = useDh();
type Key = 'platform' | 'domain' | 'tag' | 'term' | 'owner';
const selected = reactive<Record<Key, string[]>>({
  platform: [...(dh.route.value.platforms || [])], domain: [], tag: [], term: [], owner: [],
});
const sort = ref('relevance');
const filtersOpen = ref(false);

const matched = computed(() => searchDatasets(dh.datasets.value, dh.route.value.query || ''));

function valuesOf(d: DhDataset, key: Key): string[] {
  if (key === 'platform') return [d.platform];
  if (key === 'domain') return d.domain ? [d.domain] : [];
  if (key === 'tag') return d.tags;
  if (key === 'term') return d.terms;
  return d.owners.map(o => o.owner);
}

function passes(d: DhDataset, except: Key | null) {
  return (Object.keys(selected) as Key[]).every(key => key === except || !selected[key].length
    || valuesOf(d, key).some(v => selected[key].includes(v)));
}

const facets = computed(() => {
  const defs: { key: Key; title: string }[] = [
    { key: 'platform', title: 'Platform' }, { key: 'domain', title: 'Domain' }, { key: 'tag', title: 'Tags' },
    { key: 'term', title: 'Glossary Terms' }, { key: 'owner', title: 'Owners' },
  ];
  return defs.map(def => {
    const counts = new Map<string, number>();
    for (const d of matched.value.filter(x => passes(x, def.key))) {
      for (const v of valuesOf(d, def.key)) counts.set(v, (counts.get(v) || 0) + 1);
    }
    for (const v of selected[def.key]) if (!counts.has(v)) counts.set(v, 0);
    return { ...def, values: [...counts.entries()].map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)) };
  });
});

const activeCount = computed(() => (Object.keys(selected) as Key[]).reduce((n, k) => n + selected[k].length, 0));

const shown = computed(() => {
  const list = matched.value.filter(d => passes(d, null));
  if (sort.value === 'name') return [...list].sort((a, b) => shortName(a.urn).localeCompare(shortName(b.urn)));
  if (sort.value === 'platform') return [...list].sort((a, b) => a.platform.localeCompare(b.platform) || a.urn.localeCompare(b.urn));
  return list;
});

function toggle(key: Key, value: string) {
  const list = selected[key];
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1); else list.push(value);
  if (key === 'platform') dh.route.value = { ...dh.route.value, platforms: [...list] };
}

function clearAll() {
  for (const key of Object.keys(selected) as Key[]) selected[key].splice(0);
  dh.route.value = { ...dh.route.value, platforms: [] };
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-search-page { display: flex; min-height: 100%; }
.dh-filters { flex: none; width: 260px; background: #fff; border-right: 1px solid var(--dh-border); padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; }
.dh-filters__head { display: flex; align-items: center; }
.dh-facet__title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
.dh-facet__none { color: var(--dh-text-2); font-size: 13px; }
.dh-facet__opt { display: flex; align-items: center; gap: 8px; padding: 3px 0; cursor: pointer; font-size: 13px; min-width: 0; }
.dh-facet__opt input { margin: 0; accent-color: var(--dh-primary); }
.dh-facet__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dh-facet__n { color: var(--dh-text-2); font-size: 12px; }
.dh-results { flex: 1; min-width: 0; padding: 16px 24px 28px; display: flex; flex-direction: column; gap: 12px; }
.dh-results__bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.dh-sort { display: inline-flex; align-items: center; gap: 8px; color: var(--dh-text-2); font-size: 13px; }
.dh-select--sm { height: 28px; width: auto; font-size: 13px; }
.dh-filters-toggle { display: none; }
.dh-result { background: #fff; border: 1px solid var(--dh-border); border-radius: 8px; padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dh-result:hover { border-color: #d6e4ff; box-shadow: 0 2px 8px rgba(0, 0, 0, .05); }
.dh-result__type { display: flex; align-items: center; gap: 6px; color: var(--dh-text-2); font-size: 12px; flex-wrap: wrap; min-width: 0; }
.dh-dot-sep { color: #8c8c8c; }
.dh-result__name { border: 0; background: none; padding: 0; font: inherit; font-size: 17px; font-weight: 700; color: var(--dh-text); cursor: pointer; text-align: left; overflow-wrap: anywhere; align-self: flex-start; }
.dh-result__name:hover { color: var(--dh-primary); text-decoration: underline; }
.dh-result__desc { margin: 0; color: var(--dh-text-2); overflow-wrap: anywhere; }
.dh-result__desc.is-empty { font-style: italic; }
.dh-result__meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.dh-result__foot { display: flex; gap: 18px; flex-wrap: wrap; color: var(--dh-text-2); font-size: 12px; margin-top: 2px; }
.dh-result__foot > span { display: inline-flex; align-items: center; gap: 5px; }
.dh-result__owners { flex-wrap: wrap; }
.dh-owner-chip { background: #f5f5f5; border-radius: 10px; padding: 0 8px; color: var(--dh-text); }
@container sl-portal (max-width: 820px) {
  .dh-search-page { flex-direction: column; }
  .dh-filters { display: none; width: auto; border-right: 0; border-bottom: 1px solid var(--dh-border); }
  .dh-filters.is-open { display: flex; }
  .dh-filters-toggle { display: inline-flex; }
  .dh-results { padding: 12px; }
}
</style>
