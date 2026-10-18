<template>
  <!-- The Workload hub (app.fabric.microsoft.com/workloadhub): one tile per Fabric
       workload; a tile opens that workload's own page. -->
  <div class="fx-page wh">
    <div class="fx-page__head">
      <div class="fx-page__titles">
        <h1 class="fx-page__title">Workloads</h1>
        <p class="fx-page__sub">Explore the workloads that make up Microsoft Fabric. Open one to see what it does and the items it creates.</p>
      </div>
    </div>
    <div class="fx-tabs">
      <button type="button" class="fx-tab is-active">Fabric workloads</button>
      <button type="button" class="fx-tab" disabled title="Partner workloads are not part of this lab">More workloads</button>
    </div>
    <div class="fx-page__scroll">
      <div class="fx-page__body">
        <section class="fx-section">
          <div class="fx-section__head">
            <h2 class="fx-section__title">Microsoft Fabric</h2>
            <span class="fx-pill">{{ WORKLOADS.length }}</span>
          </div>
          <div class="wh-grid">
            <button v-for="w in WORKLOADS" :key="w.id" type="button" class="wh-tile"
                    :style="{ '--wl': w.color, '--wl-tint': w.tint }" @click="go({ page: 'workload', wl: w.id })">
              <span class="wh-tile__band">
                <FxIcon :name="w.icon" :size="48" />
                <span class="wh-tile__types">
                  <FxIcon v-for="t in w.types.slice(0, 4)" :key="t" :name="t" :size="20" />
                </span>
              </span>
              <span class="wh-tile__body">
                <span class="wh-tile__name">{{ w.name }}</span>
                <span class="wh-tile__pub">Microsoft</span>
                <span class="wh-tile__desc">{{ w.description }}</span>
                <span class="wh-tile__foot">
                  <span class="fx-pill">{{ w.types.length }} item types</span>
                  <span v-if="availableCount(w)" class="fx-pill fx-pill--brand">{{ availableCount(w) }} in this lab</span>
                  <span v-else class="fx-pill">Preview only</span>
                </span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import FxIcon from './FxIcon.vue';
import { WORKLOADS, availableCount, useFabric } from './fabric';

const { go } = useFabric();
</script>

<style scoped>
.wh-grid {
  display: grid; gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 272px), 1fr));
}
.wh-tile {
  display: flex; flex-direction: column; min-width: 0; padding: 0; overflow: hidden;
  border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; color: #242424;
  font: 14px/20px "Segoe UI", "Segoe UI Web (West European)", -apple-system, sans-serif;
  text-align: left; cursor: pointer; transition: box-shadow .12s, border-color .12s;
}
.wh-tile:hover { border-color: transparent; box-shadow: 0 0 2px rgba(0, 0, 0, .12), 0 8px 16px rgba(0, 0, 0, .14); }
.wh-tile:focus-visible { outline: 2px solid #117865; outline-offset: 1px; }
.wh-tile__band {
  position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  height: 96px; padding: 0 20px; background: var(--wl-tint);
  border-bottom: 1px solid #e0e0e0;
}
/* A soft arc of the workload colour behind the icons - the hub's illustration band. */
.wh-tile__band::after {
  content: ''; position: absolute; right: -40px; top: -60px; width: 200px; height: 200px; border-radius: 50%;
  background: var(--wl); opacity: .08; pointer-events: none;
}
.wh-tile__types {
  position: relative; z-index: 1; display: flex; gap: 6px; padding: 6px 8px;
  border-radius: 8px; background: rgba(255, 255, 255, .8);
}
.wh-tile__body { display: flex; flex-direction: column; flex: 1; gap: 2px; padding: 14px 16px 16px; min-width: 0; }
.wh-tile__name { font: 600 16px/22px "Segoe UI", sans-serif; color: #242424; }
.wh-tile__pub { font-size: 12px; line-height: 16px; color: #616161; }
.wh-tile__desc {
  margin-top: 8px; font-size: 13px; line-height: 18px; color: #424242;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden;
}
.wh-tile__foot { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; padding-top: 14px; }
@container sl-portal (max-width: 600px) {
  .wh-grid { gap: 12px; }
  .wh-tile__band { height: 80px; padding: 0 16px; }
}
</style>
