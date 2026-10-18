<template>
  <div class="fx-page">
    <div class="fx-page__scroll">
      <section class="hp-hero">
        <div>
          <h1 class="hp-hello">Welcome to Fabric, {{ firstName }}</h1>
          <p class="fx-muted">Unify your data, analytics and AI on one platform. {{ clock }}</p>
        </div>
        <div class="hp-actions">
          <button type="button" class="fx-btn fx-btn--primary" @click="$emit('new-workspace')">
            <FxIcon name="plus" />New workspace
          </button>
          <button type="button" class="fx-btn" @click="go({ page: 'create' })">
            <FxIcon name="create" />Create
          </button>
        </div>
      </section>

      <div class="fx-page__body hp-body">
      <section class="fx-section">
        <div class="fx-section__head"><h2 class="fx-section__title">Recommended</h2></div>
        <div class="fx-cards">
          <button type="button" class="fx-card" @click="go({ page: 'monitor' })">
            <span class="fx-card__title"><span class="hp-ico"><FxIcon name="monitor" :size="18" /></span>Monitor activity</span>
            <span class="fx-card__desc">Track pipelines, notebooks and refreshes across your workspaces.</span>
          </button>
          <button type="button" class="fx-card" @click="go({ page: 'onelake' })">
            <span class="fx-card__title"><span class="hp-ico"><FxIcon name="onelake" :size="18" /></span>Explore the OneLake catalog</span>
            <span class="fx-card__desc">Find lakehouses, warehouses and semantic models you can use.</span>
          </button>
          <button type="button" class="fx-card" @click="go({ page: 'workloads' })">
            <span class="fx-card__title"><span class="hp-ico"><FxIcon name="workloads" :size="18" /></span>Browse workloads</span>
            <span class="fx-card__desc">See what each Fabric workload does and the items it creates.</span>
          </button>
          <button type="button" class="fx-card" @click="go({ page: 'deploy' })">
            <span class="fx-card__title"><span class="hp-ico"><FxIcon name="deploy" :size="18" /></span>Deployment pipelines</span>
            <span class="fx-card__desc">Promote content from development to test and production.</span>
          </button>
        </div>
      </section>

      <section class="fx-section">
        <div class="fx-section__head">
          <h2 class="fx-section__title">Workspaces</h2>
          <span class="fx-pill">{{ workspaces.length }}</span>
          <button type="button" class="fx-section__link" @click="go({ page: 'workspaces' })">View all<FxIcon name="chevronRight" :size="12" /></button>
        </div>
        <div class="fx-cards">
          <button v-for="w in workspaces" :key="w.name" type="button" class="fx-card"
                  @click="go({ page: 'workspace', ws: w.name })">
            <span class="fx-card__title"><FxIcon name="Workspace" :size="32" /><span class="hp-wsname" :title="w.name">{{ w.name }}</span></span>
            <span class="fx-card__desc">{{ countIn(w.name) }} items · {{ w.capacity || 'No capacity' }}</span>
          </button>
          <p v-if="!workspaces.length" class="fx-muted">You don't have any workspaces yet.</p>
        </div>
      </section>

      <section class="fx-section">
        <div class="fx-tabs hp-tabs">
          <button type="button" class="fx-tab is-active">Recent</button>
          <button type="button" class="fx-tab" disabled>Favorites</button>
          <button type="button" class="fx-tab" disabled>Shared with me</button>
        </div>
        <div class="fx-tablewrap">
          <table class="fx-table">
            <thead><tr><th>Name</th><th>Type</th><th>Opened</th><th>Location</th>
              <th>Endorsement</th><th>Sensitivity</th></tr></thead>
            <tbody>
              <tr v-for="i in recent" :key="i.id">
                <td><span class="fx-cellname"><FxIcon :name="i.type" :size="18" />
                  <button type="button"
                          @click="go({ page: 'item', ws: i.workspace, item: i.name, type: i.type })">
                    {{ i.name }}</button></span></td>
                <td>{{ typeLabel(i.type) }}</td>
                <td class="fx-muted">{{ i.refreshed || i.created }}</td>
                <td><button type="button" class="fx-link" @click="go({ page: 'workspace', ws: i.workspace })">
                  {{ i.workspace }}</button></td>
                <td>{{ i.endorsement || '—' }}</td>
                <td>{{ i.label || '—' }}</td>
              </tr>
              <tr v-if="!recent.length"><td colspan="6" class="fx-muted">No recent items.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FxIcon from './FxIcon.vue';
import { displayName, rows, typeLabel, useFabric } from './fabric';

defineEmits<{ (event: 'new-workspace'): void }>();
const { portal, view, go } = useFabric();
const workspaces = computed(() => rows(portal.value, 'workspaces'));
const items = computed(() => rows(portal.value, 'items'));
const recent = computed(() => [...items.value].reverse().slice(0, 12));
const firstName = computed(() => displayName(String(portal.value.me || '')).split(' ')[0] || 'there');
const clock = computed(() => (view.value.clock?.time ? `Lab clock: ${view.value.clock.time}` : ''));
function countIn(ws: string) { return items.value.filter(i => i.workspace === ws).length; }
</script>

<style scoped>
.hp-hero {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  padding: 28px var(--fx-gutter) 24px;
  background: linear-gradient(120deg, #e6f2ef 0%, #f3f9f7 55%, #eef4fb 100%);
  border-bottom: 1px solid #e0e0e0;
}
.hp-hello { margin: 0 0 4px; font: 600 28px/36px "Segoe UI", sans-serif; }
.hp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.hp-body { padding-top: 12px; }
.hp-tabs { padding: 0; margin: 0 -8px 4px; }
.hp-ico { display: inline-grid; place-items: center; width: 32px; height: 32px; flex: none; border-radius: 8px; background: #e6f2ef; color: #0e6e5c; }
.hp-wsname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@container sl-portal (max-width: 600px) {
  .hp-hero { padding: 20px var(--fx-gutter) 18px; }
  .hp-hello { font-size: 22px; line-height: 28px; }
}
p { margin: 0; }
</style>
