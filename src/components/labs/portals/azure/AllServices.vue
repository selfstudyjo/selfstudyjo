<template>
  <div class="az-blade">
    <div class="az-blade__head">
      <AzIcon name="allservices" :size="28" class="az-blade__icon" />
      <div class="az-blade__titles"><h1 class="az-blade__title">All services</h1></div>
    </div>
    <div class="az-filters">
      <input v-model="needle" class="az-filter" placeholder="Search all services" aria-label="Search all services" />
    </div>
    <div class="az-allsvc">
      <section v-for="cat in categories" :key="cat.name" class="az-allsvc__cat">
        <h2 class="az-section-title">{{ cat.name }}</h2>
        <button v-for="s in cat.items" :key="s.key" type="button" class="az-allsvc__item" @click="az.go(s.route)">
          <AzIcon :name="s.icon" :size="22" /> <span>{{ s.label }}</span>
          <AzIcon :name="s.favorite ? 'starfill' : 'star'" :size="14" class="az-allsvc__star" />
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AzIcon from './AzIcon';
import { useAz } from './azure';
import { SERVICES } from './services';

const az = useAz();
const needle = ref('');
const categories = computed(() => {
  const q = needle.value.trim().toLowerCase();
  const out: { name: string; items: typeof SERVICES }[] = [];
  for (const s of SERVICES) {
    if (q && !s.label.toLowerCase().includes(q) && !(s.keywords || '').includes(q)) continue;
    let cat = out.find(c => c.name === s.category);
    if (!cat) { cat = { name: s.category, items: [] }; out.push(cat); }
    cat.items.push(s);
  }
  return out;
});
</script>

<style scoped>
.az-allsvc { columns: 3 260px; column-gap: 32px; }
.az-allsvc__cat { break-inside: avoid; margin-bottom: 12px; }
.az-allsvc__item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 4px; border: 0; background: none;
  border-radius: 4px; font: inherit; color: #242424; text-align: left; cursor: pointer; }
.az-allsvc__item:hover { background: #f5f5f5; }
.az-allsvc__star { margin-left: auto; color: #616161; }
</style>
