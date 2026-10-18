<template>
  <!-- One workload's page in the Workload hub: the hero band, the item types it
       creates (the ones this lab models are live, the rest say so), and where to
       go next. -->
  <div class="fx-page wd">
    <div v-if="!wl" class="fx-empty"><h3>Workload not found</h3>
      <button type="button" class="fx-btn" @click="go({ page: 'workloads' })">Back to Workloads</button></div>
    <template v-else>
      <div class="fx-page__scroll">
        <nav class="fx-breadcrumb wd-crumb" aria-label="Breadcrumb">
          <button type="button" @click="go({ page: 'workloads' })">Workloads</button>
          <FxIcon name="chevronRight" :size="12" />
          <span class="is-current">{{ wl.name }}</span>
        </nav>
        <header class="wd-hero" :style="{ '--wl': wl.color, '--wl-tint': wl.tint }">
          <span class="wd-hero__icon"><FxIcon :name="wl.icon" :size="64" /></span>
          <div class="wd-hero__text">
            <h1 class="wd-hero__name">{{ wl.name }}</h1>
            <div class="wd-hero__meta">
              <span>Microsoft</span><span aria-hidden="true">·</span>
              <span>{{ wl.types.length }} item types</span><span aria-hidden="true">·</span>
              <span>{{ availableCount(wl) ? availableCount(wl) + ' available in this lab' : 'Not modelled in this lab' }}</span>
            </div>
            <p class="wd-hero__desc">{{ wl.description }}</p>
          </div>
          <div class="wd-hero__actions">
            <button v-if="firstAvailable" type="button" class="fx-btn fx-btn--primary"
                    :disabled="!workspaces.length" @click="creating = firstAvailable">
              <FxIcon name="plus" />New {{ label(firstAvailable).toLowerCase() }}
            </button>
            <button type="button" class="fx-btn" @click="go({ page: 'create' })"><FxIcon name="create" />Create hub</button>
          </div>
        </header>

        <div class="fx-page__body">
          <p v-if="!availableCount(wl)" class="fx-msgbar fx-msgbar--info wd-msg">
            <FxIcon name="info" />
            <span>{{ wl.name }} items aren't part of this lab environment. They're listed so you recognise
              them in the real portal; nothing here can be created.</span>
          </p>

          <section class="fx-section">
            <div class="fx-section__head">
              <h2 class="fx-section__title">Create</h2>
              <label v-if="availableCount(wl)" class="wd-ws">
                <span>Workspace</span>
                <select v-model="target" class="fx-select" :disabled="!workspaces.length" aria-label="Workspace">
                  <option v-if="!workspaces.length" value="">No workspaces</option>
                  <option v-for="w in workspaces" :key="w.name" :value="w.name">{{ w.name }}</option>
                </select>
              </label>
            </div>
            <div class="wd-grid">
              <FxTypeTile v-for="t in ordered" :key="t" :type="t" :blocked="!workspaces.length"
                          @pick="creating = t" />
            </div>
          </section>

          <section class="fx-section">
            <div class="fx-section__head"><h2 class="fx-section__title">Get started</h2></div>
            <div class="wd-grid">
              <button v-for="s in wl.start" :key="s.title" type="button" class="fx-card wd-start" @click="go(s.to)">
                <span class="fx-card__title"><span class="wd-start__icon"><FxIcon :name="s.icon" :size="18" /></span>{{ s.title }}</span>
                <span class="fx-card__desc">{{ s.text }}</span>
              </button>
              <button type="button" class="fx-card wd-start" @click="go({ page: 'workspaces' })">
                <span class="fx-card__title"><span class="wd-start__icon"><FxIcon name="workspaces" :size="18" /></span>Your workspaces</span>
                <span class="fx-card__desc">Every item lives in a workspace. Open one to see its items, folders, access and Git status.</span>
              </button>
            </div>
          </section>

          <section v-if="mine.length" class="fx-section">
            <div class="fx-section__head">
              <h2 class="fx-section__title">Your {{ wl.name }} items</h2>
              <span class="fx-pill">{{ mine.length }}</span>
            </div>
            <div class="fx-tablewrap">
              <table class="fx-table">
                <thead><tr><th>Name</th><th>Type</th><th>Location</th></tr></thead>
                <tbody>
                  <tr v-for="i in mine" :key="i.workspace + i.name + i.type">
                    <td><span class="fx-cellname"><FxIcon :name="i.type" :size="18" />
                      <button type="button" @click="go({ page: 'item', ws: i.workspace, item: i.name, type: i.type })">{{ i.name }}</button></span></td>
                    <td>{{ label(i.type) }}</td>
                    <td><button type="button" class="fx-link" @click="go({ page: 'workspace', ws: i.workspace })">{{ i.workspace }}</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </template>
    <NewItemDialog v-if="creating" :ws="target" :initial-type="creating"
                   @close="creating = ''" @created="opened" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxTypeTile from './FxTypeTile.vue';
import NewItemDialog from './NewItemDialog.vue';
import { availableCount, rows, typeInfo, typeLabel, useFabric, workloadById } from './fabric';

const { portal, route, go } = useFabric();
const wl = computed(() => workloadById(route.value.wl));
const creating = ref('');
const workspaces = computed(() => rows(portal.value, 'workspaces'));
const target = ref(route.value.ws || workspaces.value[0]?.name || '');
watch(workspaces, list => {
  if (!list.some(w => w.name === target.value)) target.value = list[0]?.name || '';
});
const ordered = computed(() => [...(wl.value?.types || [])]
  .sort((a, b) => Number(typeInfo(b).available) - Number(typeInfo(a).available)));
const firstAvailable = computed(() => ordered.value.find(t => typeInfo(t).available) || '');
const mine = computed(() => rows(portal.value, 'items')
  .filter(i => (wl.value?.types || []).includes(i.type)));
function label(type: string) { return typeLabel(type); }
function opened(value: { ws: string; name: string; type: string }) {
  creating.value = '';
  go({ page: 'item', ws: value.ws, item: value.name, type: value.type });
}
</script>

<style scoped>
.wd-crumb { padding-top: 14px; padding-bottom: 8px; }
.wd-crumb .is-current { padding: 2px 4px; font-weight: 600; color: #242424; }
.wd-hero {
  position: relative; overflow: hidden;
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
  margin: 0 var(--fx-gutter); padding: 24px 28px; border-radius: 8px;
  background: var(--wl-tint); border: 1px solid #e0e0e0;
}
.wd-hero::after {
  content: ''; position: absolute; right: -80px; top: -120px; width: 360px; height: 360px; border-radius: 50%;
  background: var(--wl); opacity: .07; pointer-events: none;
}
.wd-hero__icon { position: relative; z-index: 1; flex: none; }
.wd-hero__text { position: relative; z-index: 1; flex: 1 1 320px; min-width: 0; }
.wd-hero__name { margin: 0; font: 600 28px/36px "Segoe UI", sans-serif; color: #242424; }
.wd-hero__meta { display: flex; flex-wrap: wrap; gap: 0 6px; margin-top: 2px; font-size: 13px; color: #424242; }
.wd-hero__desc { max-width: 720px; margin: 10px 0 0; font-size: 14px; line-height: 20px; color: #242424; }
.wd-hero__actions { position: relative; z-index: 1; display: flex; gap: 8px; flex-wrap: wrap; align-self: flex-end; }
.wd-msg { margin: 16px 0 0; }
.wd-ws { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; font-size: 14px; color: #424242; }
.wd-ws .fx-select { width: 220px; max-width: 100%; }
.wd-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
.wd-start__icon {
  display: inline-grid; place-items: center; width: 32px; height: 32px; flex: none;
  border-radius: 8px; background: #e6f2ef; color: #0e6e5c;
}
@container sl-portal (max-width: 600px) {
  .wd-hero { padding: 18px 16px; gap: 12px; }
  .wd-hero__icon :deep(svg) { width: 48px; height: 48px; }
  .wd-hero__name { font-size: 22px; line-height: 28px; }
  .wd-hero__actions { align-self: stretch; }
  .wd-ws { flex: 1 1 100%; margin-left: 0; }
  .wd-ws .fx-select { flex: 1; width: auto; min-width: 0; }
  .fx-section__head { flex-wrap: wrap; }
}
</style>
