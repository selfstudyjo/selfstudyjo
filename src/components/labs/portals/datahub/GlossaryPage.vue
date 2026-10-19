<template>
  <div class="dh-gl">
    <aside class="dh-gl__tree" aria-label="Business Glossary">
      <div class="dh-gl__treehead"><DhIcon name="book" /><b>Business Glossary</b></div>
      <input v-model="filter" class="dh-input dh-gl__filter" placeholder="Search glossary…" aria-label="Search glossary" />
      <button type="button" class="dh-gl__node" :class="{ 'is-active': !name }" @click="dh.go({ page: 'glossary' })">
        <DhIcon name="docs" :size="14" /> All terms <span class="dh-count">{{ dh.terms.value.length }}</span>
      </button>
      <button v-for="t in filtered" :key="t.name" type="button" class="dh-gl__node dh-gl__leaf" :class="{ 'is-active': name === t.name }"
              @click="dh.go({ page: 'glossary', name: t.name })">
        <DhIcon name="book" :size="13" /> <span class="dh-gl__nm">{{ t.name }}</span>
      </button>
    </aside>

    <div class="dh-page dh-gl__main">
      <template v-if="!name">
        <div class="dh-page-head">
          <div>
            <h1 class="dh-title">Business Glossary</h1>
            <p class="dh-subtitle">The shared vocabulary of the business. Terms attach to datasets and to individual fields so a search for "Customer" finds every place a customer lives.</p>
          </div>
          <button type="button" class="dh-btn dh-btn--primary" @click="form = { name: '', definition: '' }"><DhIcon name="plus" /> Add Term</button>
        </div>
        <div v-if="!dh.terms.value.length" class="dh-card dh-empty">
          <DhIcon name="book" />
          <span>Your glossary is empty. Create the first term to start a shared vocabulary.</span>
          <button type="button" class="dh-btn dh-btn--primary" @click="form = { name: '', definition: '' }"><DhIcon name="plus" /> Add Term</button>
        </div>
        <div v-else class="dh-table-wrap">
          <table class="dh-table">
            <thead><tr><th>Term</th><th>Definition</th><th>Related entities</th></tr></thead>
            <tbody>
              <tr v-for="t in filtered" :key="t.name">
                <td><button type="button" class="dh-link dh-gl__termlink" @click="dh.go({ page: 'glossary', name: t.name })"><DhIcon name="book" :size="13" /> {{ t.name }}</button></td>
                <td>{{ t.definition }}</td>
                <td>{{ related(t.name).length }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else>
        <div v-if="!term" class="dh-card dh-empty"><DhIcon name="book" /><span>Glossary term {{ name }} does not exist.</span></div>
        <template v-else>
          <div class="dh-gl__crumb dh-muted">Business Glossary › {{ term.name }}</div>
          <div class="dh-page-head">
            <div>
              <div class="dh-muted dh-small">Glossary Term</div>
              <h1 class="dh-title"><DhIcon name="book" :size="22" class="dh-gl__ticon" /> {{ term.name }}</h1>
            </div>
          </div>
          <section class="dh-card">
            <div class="dh-card__head"><h2 class="dh-h4">Definition</h2></div>
            <div class="dh-card__body"><p class="dh-gl__def">{{ term.definition }}</p></div>
          </section>
          <section class="dh-card">
            <div class="dh-card__head"><h2 class="dh-h4">Related Entities</h2><span class="dh-count">{{ related(term.name).length }}</span></div>
            <div class="dh-card__body">
              <div v-if="!related(term.name).length" class="dh-muted">No dataset or field uses this term yet. Add it from a dataset's sidebar or its schema.</div>
              <div v-for="r in related(term.name)" :key="r.urn + (r.column || '')" class="dh-gl__rel">
                <PlatformIcon :platform="r.platform" :size="16" />
                <button type="button" class="dh-link" @click="dh.openEntity(r.urn, r.column ? 'Schema' : 'Schema')">{{ shortName(r.urn) }}</button>
                <span v-if="r.column" class="dh-pill dh-pill--grey">field {{ r.column }}</span>
                <span class="dh-muted dh-mono">{{ r.urn }}</span>
              </div>
            </div>
          </section>
        </template>
      </template>
    </div>

    <DhModal v-if="form" title="Create Glossary Term" ok-text="Create" :ok-disabled="!form.name.trim() || !form.definition.trim()" :busy="dh.busy.value"
             @close="form = null" @ok="create">
      <div class="dh-field"><span class="dh-label"><b>*</b>Name</span>
        <input v-model="form.name" class="dh-input" placeholder="e.g. Customer Lifetime Value" aria-label="Term name" /></div>
      <div class="dh-field"><span class="dh-label"><b>*</b>Definition</span>
        <textarea v-model="form.definition" class="dh-textarea" rows="4" aria-label="Definition"
                  placeholder="A clear, business-friendly definition." /></div>
    </DhModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import DhModal from './DhModal.vue';
import PlatformIcon from './PlatformIcon.vue';
import { dh as cmd, shortName, useDh } from './dhContext';

const dh = useDh();
const filter = ref('');
const form = ref<{ name: string; definition: string } | null>(null);
const name = computed(() => dh.route.value.name || '');
const term = computed(() => dh.terms.value.find(t => t.name === name.value) || null);
const filtered = computed(() => dh.terms.value.filter(t => !filter.value.trim()
  || `${t.name} ${t.definition}`.toLowerCase().includes(filter.value.trim().toLowerCase())));

function related(termName: string) {
  const out: { urn: string; platform: string; column?: string }[] = [];
  for (const d of dh.datasets.value) {
    if (d.terms.includes(termName)) out.push({ urn: d.urn, platform: d.platform });
    for (const c of d.columns) if (c.terms.includes(termName)) out.push({ urn: d.urn, platform: d.platform, column: c.name });
  }
  return out;
}

async function create() {
  const f = form.value;
  if (!f) return;
  const result = await dh.run(cmd(['datahub', 'term', 'create'], { '--name': f.name.trim() }, { '--definition': f.definition.trim() }),
                              { success: `Created Glossary Term ${f.name.trim()}` });
  if (result.ok) {
    const created = f.name.trim();
    form.value = null;
    dh.go({ page: 'glossary', name: created });
  }
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-gl { display: flex; min-height: 100%; }
.dh-gl__tree { flex: none; width: 260px; box-sizing: border-box; background: #fff; border-right: 1px solid var(--dh-border); padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; }
.dh-gl__treehead { display: flex; align-items: center; gap: 8px; padding: 0 6px 8px; }
.dh-gl__treehead .dh-ico { color: #722ed1; }
.dh-gl__filter { margin-bottom: 6px; height: 30px; }
.dh-gl__node { display: flex; align-items: center; gap: 8px; border: 0; background: none; padding: 6px 8px; border-radius: 6px; font: inherit; font-size: 14px; color: var(--dh-text); text-align: left; cursor: pointer; min-width: 0; }
.dh-gl__node:hover { background: var(--dh-hover); }
.dh-gl__node.is-active { background: #f9f0ff; color: #531dab; font-weight: 600; }
.dh-gl__leaf { padding-left: 18px; }
.dh-gl__leaf .dh-ico { color: #722ed1; }
.dh-gl__nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dh-gl__main { flex: 1; min-width: 0; }
.dh-gl__termlink { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
.dh-gl__ticon { color: #722ed1; vertical-align: -3px; }
.dh-gl__def { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.dh-gl__rel { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--dh-border); flex-wrap: wrap; }
.dh-gl__rel:last-child { border-bottom: 0; }
.dh-small { font-size: 12px; }
@container sl-portal (max-width: 760px) {
  .dh-gl { flex-direction: column; }
  .dh-gl__tree { width: auto; border-right: 0; border-bottom: 1px solid var(--dh-border); max-height: 220px; overflow: auto; }
}
</style>
