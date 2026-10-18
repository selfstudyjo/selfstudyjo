<template>
  <div class="fx-page">
    <ItemHeader :name="itemName" :type="type" :label="item?.label" :endorsement="item?.endorsement"
                :tabs="type === 'Environment' ? ['Home'] : ['File', 'Home', 'Insert']" :model-value="type === 'Environment' ? 'Home' : 'Home'"
                @settings="settings = 'about'" @share="settings = 'share'" />
    <div v-if="!item" class="fx-empty"><h3>This item no longer exists</h3>
      <button type="button" class="fx-btn" @click="go({ page: 'workspace', ws: wsName })">Back to {{ wsName }}</button></div>
    <template v-else-if="type === 'Environment'">
      <div class="fx-cmdbar">
        <button type="button" class="fx-cmd" disabled><FxIcon name="save" />Save</button>
        <button type="button" class="fx-cmd" disabled><FxIcon name="upload" />Publish</button>
      </div>
      <div class="fx-page__scroll gi-body">
        <div class="fx-settings">
          <div class="fx-settings__nav"><button type="button" class="is-active">Spark compute</button>
            <button type="button" disabled>Public libraries</button><button type="button" disabled>Custom libraries</button></div>
          <div class="fx-settings__body">
            <h3 class="fx-h3 gi-first">Spark compute</h3>
            <p class="fx-muted">An environment inherits the workspace's Spark settings. Change them in Workspace settings → Data Engineering/Science.</p>
            <dl class="fx-kv">
              <dt>Environment pool</dt><dd>{{ ws?.spark?.pool || 'Starter Pool' }}</dd>
              <dt>Maximum nodes</dt><dd>{{ ws?.spark?.max_nodes }}</dd>
              <dt>Native execution engine</dt><dd>{{ ws?.spark?.native_engine ? 'On' : 'Off' }}</dd>
              <dt>Runtime</dt><dd>1.3 (Spark 3.5, Delta 3.2)</dd>
            </dl>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="gi-report">
        <div class="gi-canvas">
          <FxIcon name="Report" :size="56" />
          <h3>Build visuals with your data</h3>
          <p class="fx-muted">Select or drag fields from the Data pane onto the report canvas. Reports in this lab read the
            semantic models in {{ wsName }}.</p>
          <ul class="gi-models"><li v-for="sm in models" :key="sm.name"><FxIcon name="SemanticModel" />{{ sm.name }}
            <button type="button" class="fx-link" @click="go({ page: 'item', ws: wsName, item: sm.name, type: 'SemanticModel' })">Open model</button></li>
            <li v-if="!models.length" class="fx-muted">No semantic models in this workspace yet.</li></ul>
        </div>
        <div class="gi-pages"><span class="gi-page is-active">Page 1</span><span class="gi-page">+</span></div>
      </div>
    </template>
    <ItemSettingsPanel v-if="settings && item" :item="item" :tab="settings" @close="settings = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FxIcon from './FxIcon.vue';
import ItemHeader from './ItemHeader.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import { rows, useFabric } from './fabric';

const { portal, route, go } = useFabric();
const wsName = computed(() => String(route.value.ws || ''));
const itemName = computed(() => String(route.value.item || ''));
const type = computed(() => String(route.value.type || ''));
const item = computed(() => rows(portal.value, 'items').find(i => i.workspace === wsName.value
  && i.name === itemName.value && i.type === type.value));
const ws = computed(() => rows(portal.value, 'workspaces').find(w => w.name === wsName.value));
const models = computed(() => rows(portal.value, 'items').filter(i => i.type === 'SemanticModel' && i.workspace === wsName.value));
const settings = ref('');
</script>

<style scoped>
.gi-body { padding: 16px var(--fx-gutter); }
.gi-first { margin-top: 0; }
.gi-body p { margin: 0 0 16px; line-height: 20px; max-width: 640px; }
.gi-report { flex: 1; display: flex; flex-direction: column; background: #eaeaea; min-height: 0; }
.gi-canvas { flex: 1; margin: 16px; background: #fff; border: 1px solid #d1d1d1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; gap: 8px; }
.gi-canvas h3 { margin: 4px 0 0; font: 600 16px/22px var(--fx-font, "Segoe UI", sans-serif); color: #242424; }
.gi-canvas p { max-width: 420px; margin: 0; }
.gi-models { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.gi-models li { display: flex; align-items: center; gap: 8px; }
.gi-pages { display: flex; gap: 2px; padding: 0 16px; background: #f5f5f5; border-top: 1px solid #d1d1d1; }
.gi-page { padding: 6px 14px; font-size: 13px; color: #424242; }
.gi-page.is-active { background: #fff; font-weight: 600; border-bottom: 3px solid #f0b400; }
@container sl-portal (max-width: 600px) {
  .gi-body { padding: 12px var(--fx-gutter); }
  .gi-canvas { margin: 8px; }
}
</style>
