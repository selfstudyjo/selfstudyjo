<template>
  <div v-if="workspace" class="tf-page">
    <TfWsHeader />
    <div class="ov">
      <div class="ov__main">
        <!-- Latest run -->
        <section class="tf-card ov-run">
          <div class="tf-card__head">
            <h2 class="tf-h3">Latest Run</h2>
            <a href="#" @click.prevent="go({ page: 'runs', ws: workspace.name })">View all runs</a>
          </div>
          <div v-if="latest" class="ov-run__body">
            <div class="ov-run__row">
              <TfStatus :status="latest.status" />
              <a href="#" class="ov-run__title" @click.prevent="go({ page: 'run', ws: workspace.name, id: latest.id })">
                {{ runTitle(latest) }}
              </a>
            </div>
            <div class="ov-run__meta">
              <span class="tf-mono tf-faint">{{ latest.id }}</span>
              <span class="tf-faint">·</span>
              <span class="tf-faint">{{ operationLabel(latest.operation) }}</span>
              <span class="tf-faint">·</span>
              <span class="tf-faint">Triggered via CLI {{ ago(latest.created_at, now) }}</span>
            </div>
            <div v-if="latest.has_changes" class="ov-run__counts">
              <span class="cnt cnt--add">+{{ latest.counts.add }}</span>
              <span class="cnt cnt--change">~{{ latest.counts.change }}</span>
              <span class="cnt cnt--destroy">-{{ latest.counts.destroy }}</span>
            </div>
            <div v-if="latest.status === 'planned'" class="tf-alert tf-alert--warning ov-run__confirm">
              <TfIcon name="alert-circle" />
              <div>
                <span class="tf-alert__title">Needs Confirmation</span>
                Check the plan and confirm to apply it, or discard the run.
                <div><a href="#" @click.prevent="go({ page: 'run', ws: workspace.name, id: latest.id })">See details</a></div>
              </div>
            </div>
          </div>
          <div v-else class="ov-wait">
            <h3 class="tf-h3">Waiting for configuration</h3>
            <p class="tf-faint">This workspace currently has no Terraform runs. To start, add a <code class="tf-mono">cloud</code> block to your configuration and run <code class="tf-mono">terraform init</code>, or start a run from here - this lab's working directory already has the configuration.</p>
            <pre class="tf-code ov-wait__code">{{ cloud }}</pre>
            <p class="tf-faint tf-small">Then: <code class="tf-mono">terraform init</code>, <code class="tf-mono">terraform plan</code></p>
          </div>
        </section>

        <!-- Resources -->
        <section class="tf-section">
          <div class="tf-section__head">
            <h2 class="tf-h2">Resources <span class="ov-n">{{ resources.length }}</span></h2>
            <div class="ov-filter">
              <TfIcon name="search" class="ov-filter__icon" />
              <input v-model="filter" class="tf-input ov-filter__input" type="search" placeholder="Filter resources" aria-label="Filter resources" />
            </div>
          </div>
          <div class="tf-table-wrap">
            <table class="tf-table">
              <thead><tr><th>Name</th><th>Provider</th><th>Type</th><th>Module</th><th>Created</th></tr></thead>
              <tbody>
                <tr v-for="resource in shownResources" :key="resource.address">
                  <td>
                    <span class="ov-res">{{ resource.name }}</span>
                    <span v-if="resource.tainted" class="tf-badge tf-badge--critical ov-tag">tainted</span>
                    <span v-if="resource.imported" class="tf-badge tf-badge--action ov-tag">imported</span>
                    <div class="tf-faint tf-small tf-mono">{{ resource.id }}</div>
                  </td>
                  <td>hashicorp/{{ providerOf(resource.provider) }}</td>
                  <td class="tf-mono">{{ resource.type }}</td>
                  <td class="tf-faint">root</td>
                  <td class="tf-faint">{{ ago(resource.created, now) }}</td>
                </tr>
                <tr v-if="!shownResources.length">
                  <td colspan="5"><div class="tf-empty"><div class="tf-empty__title">No resources</div>
                    {{ resources.length ? 'No resource matches the filter.' : 'Resources appear here once a run is applied.' }}</div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Outputs -->
        <section class="tf-section">
          <div class="tf-section__head"><h2 class="tf-h2">Outputs <span class="ov-n">{{ outputs.length }}</span></h2></div>
          <div class="tf-table-wrap">
            <table class="tf-table">
              <thead><tr><th>Name</th><th>Type</th><th>Value</th></tr></thead>
              <tbody>
                <tr v-for="output in outputs" :key="output.name">
                  <td class="tf-mono">{{ output.name }}</td>
                  <td class="tf-faint">{{ typeOf(output.value) }}</td>
                  <td class="tf-mono ov-val">{{ fmtValue(output.value) }}</td>
                </tr>
                <tr v-if="!outputs.length"><td colspan="3"><div class="tf-empty">No outputs. Outputs appear after an apply of a configuration with <code class="tf-mono">output</code> blocks.</div></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- README -->
        <section class="tf-section">
          <div class="tf-card">
            <div class="tf-card__head"><h2 class="tf-h3"><TfIcon name="file" /> README.md</h2></div>
            <div v-if="readme" class="tf-card__body ov-readme">
              <template v-for="(block, index) in readmeBlocks" :key="index">
                <h3 v-if="block.kind === 'h'" class="tf-h3 ov-readme__h">{{ block.text }}</h3>
                <pre v-else-if="block.kind === 'code'" class="tf-code">{{ block.text }}</pre>
                <p v-else class="ov-readme__p">{{ block.text }}</p>
              </template>
            </div>
            <div v-else class="tf-empty">This workspace has no README. Add a <code class="tf-mono">README.md</code> to the configuration to show it here.</div>
          </div>
        </section>
      </div>

      <!-- Side -->
      <aside class="ov__side">
        <div class="tf-card ov-side">
          <dl class="ov-side__dl">
            <div><dt>Project</dt><dd><a href="#" @click.prevent="go({ page: 'projects' })">Default Project</a></dd></div>
            <div><dt>Execution mode</dt><dd>Local</dd></div>
            <div><dt>Auto-apply</dt><dd>Off</dd></div>
            <div><dt>Workflow</dt><dd>CLI-driven</dd></div>
            <div><dt>Terraform version</dt><dd>v{{ workspace.version }}</dd></div>
            <div><dt>State serial</dt><dd>{{ workspace.serial }}</dd></div>
            <div><dt>Initialized</dt><dd>{{ initialised ? 'Yes' : 'No - a run will run terraform init' }}</dd></div>
            <div v-if="workspace.locked"><dt>Locked</dt><dd>By {{ workspace.lock?.user }}<br><span class="tf-faint tf-small">{{ workspace.lock?.reason }}</span></dd></div>
            <div><dt>Created</dt><dd>{{ ago(workspace.created_at, now) }}</dd></div>
          </dl>
        </div>
        <div class="tf-card ov-side">
          <div class="ov-side__title">Providers</div>
          <div v-for="provider in providers" :key="provider.name" class="ov-prov">
            <TfIcon name="box" :size="14" /> hashicorp/{{ provider.name }} <span class="tf-faint">v{{ provider.version }}</span>
          </div>
          <p v-if="!providers.length" class="tf-faint tf-small">None installed yet.</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches, pick, rows } from '@/utils/portalKit';
import TfIcon from './TfIcon.vue';
import TfStatus from './TfStatus.vue';
import TfWsHeader from './TfWsHeader.vue';
import { useTf } from './tfContext';
import { ago, cloudBlock, fmtValue, operationLabel, type TfRun } from './tfKit';

const { view, workspace, runs, now, go, org } = useTf();
const filter = ref('');
const latest = computed(() => runs.value.find(run => run.workspace === workspace.value?.name) || null);
const resources = computed(() => rows<Record<string, any>>(view.value, 'state.resources'));
const shownResources = computed(() => resources.value.filter(r => matches(r, filter.value, ['address', 'type', 'name', 'id'])));
const outputs = computed(() => rows<{ name: string; value: unknown }>(view.value, 'outputs'));
const providers = computed(() => rows<{ name: string; version: string }>(view.value, 'providers'));
const initialised = computed(() => Boolean(pick(view.value, 'initialised', false)));
const readme = computed(() => String(pick(view.value, 'readme', '')));
const cloud = computed(() => cloudBlock(org.value, workspace.value?.name || ''));

function providerOf(provider: string) { return provider || '—'; }
function typeOf(value: unknown) {
  if (Array.isArray(value)) return 'list';
  if (value !== null && typeof value === 'object') return 'object';
  return typeof value;
}
function runTitle(run: TfRun) {
  if (run.status === 'errored') return 'Errored run';
  if (run.operation === 'destroy') return 'Queued destroy plan';
  if (run.operation === 'plan_only') return 'Speculative plan';
  return 'Triggered via CLI';
}

const readmeBlocks = computed(() => {
  const blocks: { kind: 'h' | 'p' | 'code'; text: string }[] = [];
  const lines = readme.value.split('\n');
  let para: string[] = [];
  let code: string[] | null = null;
  const flush = () => { if (para.length) { blocks.push({ kind: 'p', text: para.join(' ') }); para = []; } };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (code) { blocks.push({ kind: 'code', text: code.join('\n') }); code = null; } else { flush(); code = []; }
      continue;
    }
    if (code) { code.push(line); continue; }
    if (/^#{1,6}\s/.test(line)) { flush(); blocks.push({ kind: 'h', text: line.replace(/^#+\s*/, '') }); continue; }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim());
  }
  if (code) blocks.push({ kind: 'code', text: code.join('\n') });
  flush();
  return blocks;
});
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.ov { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 24px; align-items: start; }
.ov-run__body { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.ov-run__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ov-run__title { font-weight: 600; font-size: 15px; }
.ov-run__meta { display: flex; gap: 6px; flex-wrap: wrap; font-size: 13px; }
.ov-run__counts { display: flex; gap: 10px; font-family: var(--tf-mono); font-size: 13px; font-weight: 600; }
.cnt--add { color: var(--tf-fg-success); }
.cnt--change { color: var(--tf-fg-warning); }
.cnt--destroy { color: var(--tf-fg-critical); }
.ov-run__confirm { margin-top: 6px; }
.ov-wait { padding: 20px 16px; display: flex; flex-direction: column; gap: 10px; }
.ov-wait__code { max-width: 520px; }
.ov-n { display: inline-block; margin-left: 6px; padding: 0 8px; border-radius: 12px; background: var(--tf-surface-strong); font-size: 13px; font-weight: 500; line-height: 20px; color: var(--tf-fg-primary); vertical-align: 2px; }
.ov-filter { position: relative; width: min(260px, 100%); }
.ov-filter__icon { position: absolute; left: 10px; top: 10px; color: var(--tf-fg-faint); }
.ov-filter__input { padding-left: 32px; min-height: 32px; padding-top: 5px; padding-bottom: 5px; }
.ov-res { font-weight: 600; color: var(--tf-fg-strong); }
.ov-tag { margin-left: 6px; font-size: 12px; padding: 0 5px; }
.ov-val { overflow-wrap: anywhere; }
.ov-readme { display: flex; flex-direction: column; gap: 10px; }
.ov-readme__p { line-height: 22px; }
.ov-side { padding: 16px; margin-bottom: 16px; }
.ov-side__dl { margin: 0; display: flex; flex-direction: column; gap: 12px; }
.ov-side__dl dt { font-size: 13px; color: var(--tf-fg-faint); }
.ov-side__dl dd { margin: 0; font-weight: 500; color: var(--tf-fg-strong); }
.ov-side__title { font-weight: 600; color: var(--tf-fg-strong); margin-bottom: 8px; }
.ov-prov { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 3px 0; }
@container sl-portal (max-width: 1100px) {
  .ov { grid-template-columns: minmax(0, 1fr); }
}
</style>
