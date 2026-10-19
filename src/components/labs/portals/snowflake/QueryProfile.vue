<template>
  <div class="qp">
    <div v-if="!profile" class="sf-empty">
      <SfIcon name="graph" />
      <strong>No query profile</strong>
      <span>{{ emptyText || 'A profile is recorded for queries that read tables. Run a SELECT to see one.' }}</span>
    </div>
    <template v-else>
      <div class="qp__canvas" role="img" :aria-label="'Query profile with ' + profile.nodes.length + ' operators'">
        <div v-if="profile.fromResultCache" class="sf-alert sf-alert--info qp__cache">
          <SfIcon name="info" />
          <span>This query reused a persisted query result (<b>QUERY RESULT REUSE</b>). No warehouse compute was used.</span>
        </div>
        <div class="qp__graph">
          <div v-for="(level, li) in levels" :key="li" class="qp__level">
            <template v-for="node in level" :key="node.id">
              <button type="button" class="qp__node" :class="{ 'is-selected': selected === node.id, 'is-hot': node.percent === hottest }"
                      @click="selected = selected === node.id ? '' : node.id">
                <span class="qp__nodehead">
                  <SfIcon :name="iconFor(node.type)" />
                  <span class="qp__nodename">{{ node.label }}</span>
                  <span class="qp__nodeid">[{{ node.id }}]</span>
                </span>
                <span class="qp__pct">
                  <span class="qp__bar"><i :style="{ width: Math.max(2, node.percent) + '%' }"></i></span>
                  <b>{{ node.percent.toFixed(1) }}%</b>
                </span>
                <span v-if="tableOf(node)" class="qp__nodesub sf-mono">{{ tableOf(node) }}</span>
              </button>
            </template>
            <div v-if="li < levels.length - 1" class="qp__edge" aria-hidden="true">
              <span>{{ edgeRows(level) }}</span>
            </div>
          </div>
        </div>
      </div>

      <aside class="qp__side">
        <template v-if="selectedNode">
          <div class="qp__sidehead">
            <h3 class="sf-h3">{{ selectedNode.label }} [{{ selectedNode.id }}]</h3>
            <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" aria-label="Close" @click="selected = ''"><SfIcon name="close" /></button>
          </div>
          <section class="qp__section">
            <h4>Execution time</h4>
            <div class="qp__row"><span>Processing</span><b>{{ selectedNode.percent.toFixed(1) }}%</b></div>
            <div v-if="selectedNode.rows !== null" class="qp__row"><span>Output rows</span><b>{{ fmtNum(selectedNode.rows) }}</b></div>
          </section>
          <section v-if="selectedNode.attrs.length" class="qp__section">
            <h4>Attributes</h4>
            <div v-for="[key, value] in selectedNode.attrs" :key="key" class="qp__row"><span>{{ key }}</span><b class="sf-mono">{{ value }}</b></div>
          </section>
        </template>
        <template v-else>
          <section class="qp__section">
            <h4>Most expensive nodes</h4>
            <button v-for="node in expensive" :key="node.id" type="button" class="qp__exp" @click="selected = node.id">
              <span>{{ node.label }} [{{ node.id }}]</span><b>{{ node.percent.toFixed(1) }}%</b>
            </button>
          </section>
          <section class="qp__section">
            <h4>Profile overview</h4>
            <div class="qp__row"><span>Total execution time</span><b>{{ fmtMs(profile.totalMs) }}</b></div>
            <div class="qp__row"><span>Warehouse</span><b>{{ profile.warehouse || '—' }}</b></div>
            <div v-if="profile.credits !== null" class="qp__row"><span>Credits</span><b>{{ fmtCredits(profile.credits) }}</b></div>
          </section>
          <section class="qp__section">
            <h4>Statistics</h4>
            <div class="qp__row"><span>Partitions scanned</span><b>{{ fmtNum(profile.partitionsScanned) }}</b></div>
            <div class="qp__row"><span>Partitions total</span><b>{{ fmtNum(profile.partitionsTotal) }}</b></div>
            <div v-if="pruned !== null" class="qp__row"><span>Pruning</span><b>{{ pruned }}% pruned</b></div>
            <div class="qp__row"><span>Bytes scanned</span><b>{{ fmtBytes(profile.bytesScanned) }}</b></div>
            <div v-if="profile.cachePercent !== null" class="qp__row"><span>Percentage scanned from cache</span><b>{{ profile.cachePercent.toFixed(2) }}%</b></div>
            <div class="qp__row" :class="{ 'is-warn': (profile.spilledLocal || 0) > 0 }"><span>Bytes spilled to local storage</span><b>{{ fmtBytes(profile.spilledLocal || 0) }}</b></div>
            <div class="qp__row" :class="{ 'is-warn': (profile.spilledRemote || 0) > 0 }"><span>Bytes spilled to remote storage</span><b>{{ fmtBytes(profile.spilledRemote || 0) }}</b></div>
            <div v-for="[group, label, value] in profile.stats" :key="group + label" class="qp__row"><span>{{ label }}</span><b>{{ value }}</b></div>
          </section>
          <div v-if="(profile.spilledRemote || 0) > 0 || (profile.spilledLocal || 0) > 0" class="sf-alert sf-alert--warn">
            <SfIcon name="warning" /><span>This query spilled to {{ (profile.spilledRemote || 0) > 0 ? 'remote' : 'local' }} storage. A larger warehouse has more memory per query.</span>
          </div>
        </template>
      </aside>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Snowsight's Query Profile: the operator tree with each operator's share of
 * the execution time, and the statistics panel (pruning, bytes, spilling,
 * cache). Drawn from the profile the engine attaches to a query's result.
 */
import { computed, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import { fmtBytes, fmtCredits, fmtMs, fmtNum, layoutProfile, type Profile, type ProfileNode } from './snowflake';

const props = defineProps<{ profile: Profile | null; emptyText?: string }>();
const selected = ref('');

const levels = computed(() => (props.profile ? layoutProfile(props.profile.nodes) : []));
const hottest = computed(() => Math.max(-1, ...(props.profile?.nodes || []).map(n => n.percent)));
const expensive = computed(() => [...(props.profile?.nodes || [])].sort((a, b) => b.percent - a.percent).slice(0, 5));
const selectedNode = computed(() => props.profile?.nodes.find(n => n.id === selected.value) || null);
const pruned = computed(() => {
  const p = props.profile;
  if (!p || !p.partitionsTotal) return null;
  return Math.round((1 - (p.partitionsScanned || 0) / p.partitionsTotal) * 1000) / 10;
});

function iconFor(type: string): string {
  if (/scan/i.test(type)) return 'table';
  if (/join/i.test(type)) return 'lineage';
  if (/filter/i.test(type)) return 'filter';
  if (/aggregate/i.test(type)) return 'chart';
  if (/sort/i.test(type)) return 'sort';
  if (/result/i.test(type)) return 'check-circle';
  return 'graph';
}
function tableOf(node: ProfileNode): string {
  return node.attrs.find(([k]) => k === 'Table')?.[1] || '';
}
function edgeRows(level: ProfileNode[]): string {
  const known = level.map(n => n.rows).filter((r): r is number => r !== null);
  return known.length ? fmtNum(Math.max(...known)) : '';
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.qp { display: flex; min-height: 0; flex: 1; border-top: 1px solid var(--sf-border); }
.qp > .sf-empty { flex: 1; }
.qp__canvas {
  flex: 1; min-width: 0; overflow: auto; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 12px;
  background-color: var(--sf-bg-2);
  background-image: radial-gradient(circle, #D9DEE6 1px, transparent 1px); background-size: 16px 16px;
}
.qp__cache { align-self: stretch; }
.qp__graph { display: flex; flex-direction: column; align-items: center; }
.qp__level { display: flex; flex-direction: column; align-items: center; }
.qp__level > .qp__node + .qp__node { margin-top: 0; }
.qp__level { position: relative; }
.qp__level:has(.qp__node + .qp__node) { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 16px; }
.qp__level:has(.qp__node + .qp__node) > .qp__edge { flex-basis: 100%; }
.qp__node {
  width: 220px; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; text-align: left; cursor: pointer;
  background: var(--sf-bg); border: 1px solid var(--sf-border-strong); border-radius: 8px; box-shadow: 0 1px 2px rgba(30, 37, 47, .08);
  font: inherit; color: var(--sf-text);
}
.qp__node:hover { border-color: var(--sf-primary); }
.qp__node.is-selected { border-color: var(--sf-primary); box-shadow: 0 0 0 3px var(--sf-focus); }
.qp__node.is-hot .qp__bar i { background: #E5793A; }
.qp__nodehead { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; }
.qp__nodehead .sf-ico { color: var(--sf-primary); }
.qp__nodename { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qp__nodeid { color: var(--sf-text-3); font-weight: 400; font-size: 12px; }
.qp__pct { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.qp__bar { flex: 1; height: 6px; border-radius: 3px; background: var(--sf-hover); overflow: hidden; }
.qp__bar i { display: block; height: 100%; background: var(--sf-primary); border-radius: 3px; }
.qp__nodesub { color: var(--sf-text-2); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qp__edge { width: 2px; height: 34px; background: #9AA6B8; position: relative; margin: 4px auto; }
.qp__edge span { position: absolute; left: 8px; top: 8px; font-size: 11px; color: var(--sf-text-2); white-space: nowrap; background: var(--sf-bg); padding: 0 4px; border-radius: 3px; }
.qp__side { width: 300px; flex: none; border-left: 1px solid var(--sf-border); overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; background: var(--sf-bg); }
.qp__sidehead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.qp__section { display: flex; flex-direction: column; gap: 6px; }
.qp__section h4 { margin: 0 0 2px; font-size: 12px; font-weight: 600; color: var(--sf-text-2); text-transform: uppercase; letter-spacing: .04em; }
.qp__row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.qp__row span { color: var(--sf-text-2); }
.qp__row b { font-weight: 500; text-align: right; overflow-wrap: anywhere; }
.qp__row.is-warn b { color: var(--sf-warning); font-weight: 600; }
.qp__exp { display: flex; justify-content: space-between; gap: 8px; background: none; border: 0; padding: 4px 6px; margin: 0 -6px; border-radius: 4px; font: inherit; font-size: 13px; color: var(--sf-link); cursor: pointer; text-align: left; }
.qp__exp:hover { background: var(--sf-hover); }
.qp__exp b { color: var(--sf-text); font-weight: 500; }
@container sl-portal (max-width: 900px) {
  .qp { flex-direction: column; overflow: auto; }
  .qp__canvas { flex: none; min-height: 280px; overflow: visible; }
  .qp__side { width: auto; flex: none; overflow: visible; border-left: 0; border-top: 1px solid var(--sf-border); }
}
</style>
