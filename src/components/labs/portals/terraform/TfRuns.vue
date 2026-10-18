<template>
  <div v-if="workspace" class="tf-page">
    <TfWsHeader />
    <div class="tf-section__head">
      <h2 class="tf-h2">Runs</h2>
    </div>
    <div class="rl-tabs" role="tablist">
      <button v-for="tab in tabs" :key="tab.id" type="button" role="tab" class="rl-tab" :class="{ 'is-active': filter === tab.id }"
              :aria-selected="filter === tab.id" @click="filter = tab.id">
        {{ tab.label }} <span class="rl-tab__n">{{ tab.count }}</span>
      </button>
    </div>

    <ul v-if="shown.length" class="rl">
      <li v-for="(item, index) in shown" :key="item.id" class="rl__row">
        <a href="#" class="rl__link" @click.prevent="go({ page: 'run', ws: workspace.name, id: item.id })">
          <div class="rl__status"><TfStatus :status="item.status" /></div>
          <div class="rl__main">
            <div class="rl__title">
              {{ title(item) }}
              <span v-if="index === 0 && filter === 'all' && item.status === 'applied'" class="tf-badge tf-badge--success rl__current">CURRENT</span>
            </div>
            <div class="rl__meta">
              <span class="tf-mono">#{{ item.id }}</span>
              <span class="rl__avatar">S</span>
              <span>selfstudy-student triggered via CLI</span>
              <span>· {{ operationLabel(item.operation) }}</span>
            </div>
            <code class="rl__cmd tf-mono">$ {{ item.command }}</code>
          </div>
          <div class="rl__side">
            <div v-if="item.has_changes" class="rl__counts">
              <span class="cnt--add">+{{ item.counts.add }}</span>
              <span class="cnt--change">~{{ item.counts.change }}</span>
              <span class="cnt--destroy">-{{ item.counts.destroy }}</span>
            </div>
            <span class="tf-faint tf-small">{{ ago(item.created_at, now) }}</span>
          </div>
        </a>
      </li>
    </ul>
    <div v-else class="tf-card tf-empty">
      <div class="tf-empty__title">{{ filter === 'all' ? 'No runs yet' : 'No runs match this filter' }}</div>
      Start a run with <strong>New run</strong>, or run <code class="tf-mono">terraform plan</code> in the console.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import TfStatus from './TfStatus.vue';
import TfWsHeader from './TfWsHeader.vue';
import { useTf } from './tfContext';
import { ago, operationLabel, type TfRun } from './tfKit';

const { workspace, runs, go, now } = useTf();
const filter = ref('all');
const mine = computed(() => runs.value.filter(item => item.workspace === workspace.value?.name));
const groups: Record<string, (run: TfRun) => boolean> = {
  all: () => true,
  attention: run => run.status === 'planned',
  errored: run => run.status === 'errored',
  applied: run => run.status === 'applied',
  discarded: run => run.status === 'discarded',
};
const tabs = computed(() => [
  { id: 'all', label: 'All' }, { id: 'attention', label: 'Needs attention' },
  { id: 'errored', label: 'Errored' }, { id: 'applied', label: 'Applied' }, { id: 'discarded', label: 'Discarded' },
].map(tab => ({ ...tab, count: mine.value.filter(groups[tab.id]).length })));
const shown = computed(() => mine.value.filter(groups[filter.value]));

function title(run: TfRun) {
  if (run.comments?.length) return run.comments[0].body;
  if (run.operation === 'destroy') return 'Queued destroy plan';
  if (run.operation === 'plan_only') return 'Speculative plan';
  return 'Triggered via CLI';
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.rl-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--tf-border); margin-bottom: 12px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.rl-tab { padding: 8px 12px; border-bottom: 3px solid transparent; margin-bottom: -1px; color: var(--tf-fg-faint); font-weight: 500; white-space: nowrap; }
.rl-tab.is-active { color: var(--tf-fg-action); border-bottom-color: var(--tf-fg-action); }
.rl-tab__n { display: inline-block; min-width: 20px; padding: 0 6px; margin-left: 4px; border-radius: 10px; background: var(--tf-surface-strong); color: var(--tf-fg-primary); font-size: 12px; text-align: center; }
.rl { border: 1px solid var(--tf-border); border-radius: 6px; overflow: hidden; }
.rl__row + .rl__row { border-top: 1px solid var(--tf-border); }
.rl__link { display: grid; grid-template-columns: 200px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 14px 16px; color: inherit; }
.rl__link:hover { background: var(--tf-surface-faint); text-decoration: none; color: inherit; }
.rl__title { font-weight: 600; color: var(--tf-fg-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rl__current { margin-left: 6px; font-size: 11px; }
.rl__meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 13px; color: var(--tf-fg-faint); margin-top: 2px; }
.rl__avatar { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--tf-brand); color: #fff; font-size: 10px; font-weight: 600; }
.rl__cmd { display: block; margin-top: 4px; font-size: 12px; color: var(--tf-fg-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rl__side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.rl__counts { display: flex; gap: 8px; font-family: var(--tf-mono); font-size: 13px; font-weight: 600; }
.cnt--add { color: var(--tf-fg-success); }
.cnt--change { color: var(--tf-fg-warning); }
.cnt--destroy { color: var(--tf-fg-critical); }
@container sl-portal (max-width: 760px) {
  .rl__link { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .rl__side { flex-direction: row; align-items: center; justify-content: space-between; }
}
</style>
