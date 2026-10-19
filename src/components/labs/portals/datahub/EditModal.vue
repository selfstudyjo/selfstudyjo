<template>
  <DhModal :title="title" :ok-text="okText" :ok-disabled="!canSave" :busy="saving" :width="mode === 'docs' ? 640 : 520"
           @close="$emit('close')" @ok="save">
    <p v-if="column" class="dh-muted dh-target">Field <code>{{ column }}</code> of <b>{{ shortName(urn) }}</b></p>

    <template v-if="mode === 'tag'">
      <div class="dh-field">
        <span class="dh-label">Tag</span>
        <input v-model="value" class="dh-input" placeholder="Search for tags, or type a new one…" aria-label="Tag"
               @keydown.enter.prevent="save" />
      </div>
      <div class="dh-suggestions">
        <button v-for="t in tagSuggestions" :key="t" type="button" class="dh-tag dh-pick" :class="{ 'is-on': value === t }"
                @click="value = t">
          <span class="dh-tag__dot" :style="{ background: tagColor(t) }" /><span class="dh-tag__text">{{ t }}</span>
        </button>
        <span v-if="value.trim() && !allTags.includes(value.trim())" class="dh-hint">Create a new tag "{{ value.trim() }}"</span>
      </div>
    </template>

    <template v-else-if="mode === 'term'">
      <div v-if="!dh.terms.value.length" class="dh-alert dh-alert--info">
        <DhIcon name="info" />
        <div>The Business Glossary is empty. Create a term first.
          <button type="button" class="dh-link" @click="toGlossary">Open the Glossary</button>
        </div>
      </div>
      <template v-else>
        <div class="dh-field">
          <span class="dh-label">Glossary Term</span>
          <input v-model="filter" class="dh-input" placeholder="Search for glossary terms…" aria-label="Filter terms" />
        </div>
        <div class="dh-term-list">
          <label v-for="t in termOptions" :key="t.name" class="dh-term-opt" :class="{ 'is-on': value === t.name }">
            <input v-model="value" type="radio" name="dh-term" :value="t.name" />
            <DhIcon name="book" :size="14" />
            <span><b>{{ t.name }}</b><small>{{ t.definition }}</small></span>
          </label>
          <div v-if="!termOptions.length" class="dh-muted">No matching terms.</div>
        </div>
      </template>
    </template>

    <template v-else-if="mode === 'owner'">
      <div class="dh-field">
        <span class="dh-label"><b>*</b>Owner</span>
        <input v-model="value" class="dh-input" placeholder="Search for users or groups…" aria-label="Owner"
               list="dh-owner-options" />
        <datalist id="dh-owner-options"><option v-for="o in knownOwners" :key="o" :value="o" /></datalist>
      </div>
      <div class="dh-field">
        <span class="dh-label">Ownership type</span>
        <select v-model="ownerType" class="dh-select" aria-label="Ownership type">
          <option v-for="t in OWNER_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
    </template>

    <template v-else-if="mode === 'domain'">
      <div v-if="!dh.domains.value.length" class="dh-alert dh-alert--info">
        <DhIcon name="info" />
        <div>No domains exist yet. <button type="button" class="dh-link" @click="toDomains">Create a domain</button></div>
      </div>
      <div v-else class="dh-field">
        <span class="dh-label">Domain</span>
        <select v-model="value" class="dh-select" aria-label="Domain">
          <option value="" disabled>Select a domain</option>
          <option v-for="d in dh.domains.value" :key="d.name" :value="d.name">{{ d.name }}</option>
        </select>
      </div>
    </template>

    <template v-else>
      <div class="dh-field">
        <span class="dh-label">Description</span>
        <textarea v-model="value" class="dh-textarea" rows="8" aria-label="Description"
                  placeholder="Describe what this asset contains, how it is produced and how it should be used." />
        <span class="dh-hint">Leave empty to fall back to the description ingestion found.</span>
      </div>
    </template>
  </DhModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import DhModal from './DhModal.vue';
import { OWNER_TYPES, shortName, tagColor, useDh } from './dhContext';
import { addOwner, addTag, addTerm, setDocs, setDomain } from './edits';

const props = defineProps<{ mode: 'tag' | 'term' | 'owner' | 'domain' | 'docs'; urn: string; column?: string; initial?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const dh = useDh();

const value = ref(props.initial || '');
const filter = ref('');
const ownerType = ref('TECHNICAL_OWNER');
const saving = ref(false);

const title = computed(() => ({ tag: 'Add Tags', term: 'Add Glossary Terms', owner: 'Add Owners', domain: 'Set Domain', docs: 'Edit Description' })[props.mode]);
const okText = computed(() => (props.mode === 'docs' ? 'Save' : props.mode === 'domain' ? 'Set Domain' : 'Add'));
const canSave = computed(() => props.mode === 'docs' || Boolean(value.value.trim()));

const allTags = computed(() => {
  const set = new Set<string>(['PII', 'Sensitive', 'Deprecated', 'Gold', 'Tier1', 'Legacy']);
  for (const d of dh.datasets.value) {
    d.tags.forEach(t => set.add(t));
    d.columns.forEach(c => c.tags.forEach(t => set.add(t)));
  }
  return [...set].sort((a, b) => a.localeCompare(b));
});
const tagSuggestions = computed(() => {
  const needle = value.value.trim().toLowerCase();
  return allTags.value.filter(t => !needle || t.toLowerCase().includes(needle)).slice(0, 14);
});
const termOptions = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  return dh.terms.value.filter(t => !needle || t.name.toLowerCase().includes(needle) || t.definition.toLowerCase().includes(needle));
});
const knownOwners = computed(() => [...new Set(dh.datasets.value.flatMap(d => d.owners.map(o => o.owner)))].sort());

async function save() {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  const text = value.value.trim();
  try {
    let result;
    if (props.mode === 'tag') result = await addTag(dh, props.urn, text, props.column);
    else if (props.mode === 'term') result = await addTerm(dh, props.urn, text, props.column);
    else if (props.mode === 'owner') result = await addOwner(dh, props.urn, text, ownerType.value);
    else if (props.mode === 'domain') result = await setDomain(dh, props.urn, text);
    else result = await setDocs(dh, props.urn, value.value.trim(), props.column);
    if (result?.ok) emit('close');
  } finally {
    saving.value = false;
  }
}

function toGlossary() { emit('close'); dh.go({ page: 'glossary' }); }
function toDomains() { emit('close'); dh.go({ page: 'domains' }); }
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-target { margin: 0; }
.dh-target code { background: #f5f5f5; padding: 0 4px; border-radius: 3px; font-family: var(--dh-mono); font-size: 12px; }
.dh-suggestions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dh-pick { cursor: pointer; font: inherit; font-size: 12px; }
.dh-pick:hover, .dh-pick.is-on { border-color: var(--dh-primary); background: #f0f5ff; }
.dh-term-list { display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow: auto; }
.dh-term-opt { display: flex; align-items: flex-start; gap: 8px; padding: 8px; border: 1px solid var(--dh-border); border-radius: 6px; cursor: pointer; }
.dh-term-opt.is-on { border-color: #722ed1; background: #f9f0ff; }
.dh-term-opt input { margin: 3px 0 0; accent-color: #722ed1; }
.dh-term-opt .dh-ico { color: #722ed1; margin-top: 3px; }
.dh-term-opt span { display: flex; flex-direction: column; min-width: 0; }
.dh-term-opt small { color: var(--dh-text-2); font-size: 12px; overflow-wrap: anywhere; }
</style>
