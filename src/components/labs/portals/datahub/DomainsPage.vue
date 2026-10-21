<template>
  <div class="dh-page">
    <template v-if="!name">
      <div class="dh-page-head">
        <div>
          <h1 class="dh-title">Domains</h1>
          <p class="dh-subtitle">View your data assets organized into collections that align with business groups, and the team accountable for each.</p>
        </div>
        <button type="button" class="dh-btn dh-btn--primary" @click="form = { name: '', owner: '' }"><DhIcon name="plus" /> New Domain</button>
      </div>
      <input v-model="filter" class="dh-input dh-dom-filter" placeholder="Search domains…" aria-label="Search domains" />
      <div v-if="!shown.length" class="dh-card dh-empty">
        <DhIcon name="domain" /><span>{{ dh.domains.value.length ? 'No domains match.' : 'No domains yet. Create one to group related assets.' }}</span>
      </div>
      <div v-else class="dh-dom-grid">
        <button v-for="d in shown" :key="d.name" type="button" class="dh-card dh-dom-card" @click="dh.go({ page: 'domains', name: d.name })">
          <span class="dh-dom-icon" :style="{ background: color(d.name) }">{{ d.name.charAt(0).toUpperCase() }}</span>
          <span class="dh-dom-body">
            <b>{{ d.name }}</b>
            <small>{{ count(d.name) }} asset{{ count(d.name) === 1 ? '' : 's' }}</small>
            <small v-if="d.owner"><DhIcon name="user" :size="12" /> {{ d.owner }}</small>
            <small v-else class="dh-dom-noowner">No owner (declared by ingestion)</small>
          </span>
        </button>
      </div>
    </template>

    <template v-else>
      <div class="dh-muted dh-small"><button type="button" class="dh-link" @click="dh.go({ page: 'domains' })">Domains</button> › {{ name }}</div>
      <div class="dh-page-head">
        <div class="dh-row">
          <span class="dh-dom-icon dh-dom-icon--lg" :style="{ background: color(name) }">{{ name.charAt(0).toUpperCase() }}</span>
          <div>
            <div class="dh-muted dh-small">Domain</div>
            <h1 class="dh-title">{{ name }}</h1>
          </div>
        </div>
        <div class="dh-row">
          <div v-if="domain && domain.owner" class="dh-dom-owner"><DhIcon name="user" /> Owner <b>{{ domain.owner }}</b></div>
          <DhMenu v-if="domain" label="Domain actions" :items="domainActions" />
        </div>
      </div>
      <section class="dh-card">
        <div class="dh-card__head"><h2 class="dh-h4">Entities</h2><span class="dh-count">{{ assets.length }}</span></div>
        <div class="dh-card__body">
          <div v-if="!assets.length" class="dh-muted">No assets in this domain yet. Set a dataset's domain from its sidebar.</div>
          <div v-for="a in assets" :key="a.urn" class="dh-dom-row">
            <PlatformIcon :platform="a.platform" :size="18" />
            <button type="button" class="dh-link dh-dom-name" @click="dh.openEntity(a.urn)">{{ shortName(a.urn) }}</button>
            <span class="dh-muted dh-mono">{{ a.urn }}</span>
            <span class="dh-spacer" />
            <span v-for="t in a.tags" :key="t" class="dh-tag"><span class="dh-tag__dot" :style="{ background: tagColor(t) }" />{{ t }}</span>
            <button type="button" class="dh-btn dh-btn--text" :title="'Remove ' + shortName(a.urn) + ' from ' + name" @click="unset(a.urn)"><DhIcon name="close" /> Remove</button>
          </div>
        </div>
      </section>
    </template>

    <DhModal v-if="ownerEdit !== null" title="Edit Owner" ok-text="Save" :ok-disabled="!ownerEdit.trim()" :busy="dh.busy.value"
             @close="ownerEdit = null" @ok="saveOwner">
      <div class="dh-field"><span class="dh-label"><b>*</b>Owner</span>
        <input v-model="ownerEdit" class="dh-input" aria-label="Domain owner" /></div>
    </DhModal>

    <DhModal v-if="form" title="Create New Domain" ok-text="Create" :ok-disabled="!form.name.trim() || !form.owner.trim()" :busy="dh.busy.value"
             @close="form = null" @ok="create">
      <div class="dh-field"><span class="dh-label"><b>*</b>Name</span>
        <input v-model="form.name" class="dh-input" placeholder="e.g. finance" aria-label="Domain name" />
        <span class="dh-hint">Give your new Domain a name.</span></div>
      <div class="dh-field"><span class="dh-label"><b>*</b>Owner</span>
        <input v-model="form.owner" class="dh-input" placeholder="e.g. finance-data-team" aria-label="Domain owner" />
        <span class="dh-hint">The user or group accountable for the domain.</span></div>
    </DhModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import DhModal from './DhModal.vue';
import DhMenu from './DhMenu.vue';
import PlatformIcon from './PlatformIcon.vue';
import { dh as cmd, shortName, tagColor, useDh, type DhMenuItem } from './dhContext';

const dh = useDh();
const filter = ref('');
const form = ref<{ name: string; owner: string } | null>(null);
const name = computed(() => dh.route.value.name || '');
const domain = computed(() => dh.domains.value.find(d => d.name === name.value) || null);
const shown = computed(() => dh.domains.value.filter(d => !filter.value.trim() || d.name.toLowerCase().includes(filter.value.trim().toLowerCase())));
const assets = computed(() => dh.datasets.value.filter(d => d.domain === name.value));

function count(domainName: string) { return dh.datasets.value.filter(d => d.domain === domainName).length; }
function color(text: string) {
  const palette = ['#1677ff', '#13a8a8', '#722ed1', '#d46b08', '#389e0d', '#c41d7f'];
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length] as string;
}

const domainActions = computed<DhMenuItem[]>(() => {
  const editable = Boolean(domain.value?.owner);
  return [
    { label: 'Edit owner', icon: 'user', disabled: !editable, run: () => { ownerEdit.value = domain.value?.owner || ''; } },
    { label: 'Copy URN', icon: 'copy', run: () => navigator.clipboard?.writeText(`urn:li:domain:${name.value}`).then(() => dh.notify('success', 'Copied URN')) },
    { divider: true },
    { label: 'Delete', icon: 'trash', danger: true, disabled: !editable, run: removeDomain },
  ];
});
const ownerEdit = ref<string | null>(null);
async function saveOwner() {
  const owner = (ownerEdit.value || '').trim();
  const result = await dh.run(cmd(['datahub', 'domain', 'update'], { '--name': name.value, '--owner': owner }), { success: 'Domain updated' });
  if (result.ok) ownerEdit.value = null;
}
async function removeDomain() {
  const ok = await dh.confirm({
    title: `Delete ${name.value}?`,
    message: assets.value.length
      ? `${assets.value.length} asset(s) still belong to this domain; DataHub refuses to delete it until they are removed from it.`
      : 'The domain will be permanently deleted.',
    yes: 'Delete', danger: true,
  });
  if (!ok) return;
  const result = await dh.run(cmd(['datahub', 'domain', 'delete'], { '--name': name.value }), { success: `Deleted domain ${name.value}` });
  if (result.ok) dh.go({ page: 'domains' });
}
async function unset(urn: string) {
  const ok = await dh.confirm({ title: 'Remove from domain?', message: `${shortName(urn)} will no longer belong to ${name.value}.`, yes: 'Remove' });
  if (ok) await dh.run(cmd(['datahub', 'domain', 'unset'], { '--urn': urn }), { success: 'Removed from domain' });
}

async function create() {
  const f = form.value;
  if (!f) return;
  const result = await dh.run(cmd(['datahub', 'domain', 'create'], { '--name': f.name.trim(), '--owner': f.owner.trim() }),
                              { success: `Created domain ${f.name.trim()}` });
  if (result.ok) form.value = null;
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-dom-filter { max-width: 320px; }
.dh-dom-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 12px; }
.dh-dom-card { display: flex; gap: 12px; align-items: flex-start; padding: 16px; cursor: pointer; font: inherit; text-align: left; color: var(--dh-text); }
.dh-dom-card:hover { border-color: var(--dh-primary); box-shadow: 0 2px 8px rgba(22, 119, 255, .1); }
.dh-dom-icon { width: 36px; height: 36px; border-radius: 8px; color: #fff; display: grid; place-items: center; font-weight: 800; flex: none; }
.dh-dom-icon--lg { width: 44px; height: 44px; font-size: 18px; }
.dh-dom-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dh-dom-body b { font-size: 15px; overflow-wrap: anywhere; }
.dh-dom-body small { color: var(--dh-text-2); font-size: 12px; display: inline-flex; align-items: center; gap: 4px; }
.dh-dom-noowner { font-style: italic; }
.dh-dom-owner { display: inline-flex; align-items: center; gap: 6px; color: var(--dh-text-2); }
.dh-dom-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--dh-border); flex-wrap: wrap; }
.dh-dom-row:last-child { border-bottom: 0; }
.dh-dom-name { font-weight: 600; }
.dh-small { font-size: 12px; }
</style>
