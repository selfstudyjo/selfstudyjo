<template>
  <section class="dd-page">
    <div class="dd-head">
      <h1>Docker Scout</h1>
      <span class="dd-spacer"></span>
      <button type="button" class="dd-feedback"><DdIcon name="feedback" :size="15" /> Give feedback</button>
    </div>
    <div class="sv-picker">
      <label for="sv-img" class="dd-muted">Image</label>
      <select id="sv-img" v-model="chosen" class="dd-select">
        <option v-for="i in list" :key="i.id + i.tag" :value="imageRef(i)">{{ imageRef(i) }}</option>
      </select>
    </div>
    <div class="sv-cards">
      <div v-for="sev in ['C', 'H', 'M', 'L']" :key="sev" class="sv-card" :class="'is-' + sev">
        <span class="sv-sev">{{ sev }}</span><strong>–</strong>
        <small>{{ { C: 'Critical', H: 'High', M: 'Medium', L: 'Low' }[sev] }}</small>
      </div>
    </div>
    <div class="dd-empty">
      <DdIcon name="scout" :size="56" class="dd-empty__art" />
      <h2>Image analysis is not available in this lab</h2>
      <p>Docker Scout indexes the packages in an image and matches them against vulnerability databases, which needs a
        Docker account and network access. The counts above are unknown, not zero.</p>
      <button v-if="chosen" type="button" class="dd-btn dd-btn--secondary" @click="$emit('go', { page: 'images', id: chosen })">View image layers</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import { imageRef, images, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();
const list = computed(() => images(props.view));
const chosen = ref(list.value[0] ? imageRef(list.value[0]) : '');
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.dd-spacer { flex: 1; }
.sv-picker { display: flex; align-items: center; gap: 10px; max-width: 420px; }
.sv-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; max-width: 620px; }
.sv-card { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 10px; padding: 10px 12px; border: 1px solid var(--dd-border); border-radius: 6px; }
.sv-card small { grid-column: 2; color: var(--dd-text-2); font-size: 12px; }
.sv-card strong { font-weight: 500; }
.sv-sev { grid-row: span 2; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 4px; color: #fff; font-weight: 700; font-size: 13px; }
.is-C .sv-sev { background: #A2242E; }
.is-H .sv-sev { background: #E2541F; }
.is-M .sv-sev { background: #F0A020; color: #17191E; }
.is-L .sv-sev { background: #6B7383; }
</style>
