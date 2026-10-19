<template>
  <div class="dh-schema">
    <div class="dh-schema__bar">
      <div class="dh-schema__search">
        <DhIcon name="search" class="dh-schema__icon" />
        <input v-model="filter" class="dh-input dh-schema__input" placeholder="Search in schema…" aria-label="Search in schema" />
      </div>
      <span class="dh-muted">{{ shown.length }} of {{ entity.columns.length }} fields</span>
      <span class="dh-spacer" />
      <label class="dh-check"><input v-model="piiOnly" type="checkbox" /> PII fields only</label>
    </div>

    <div v-if="!entity.columns.length" class="dh-card dh-empty">
      <DhIcon name="schema" />
      <span>No schema has been ingested for this asset.</span>
    </div>
    <div v-else class="dh-table-wrap">
      <table class="dh-table">
        <thead>
          <tr><th>Field</th><th>Type</th><th>Description</th><th>Tags</th><th>Glossary Terms</th></tr>
        </thead>
        <tbody>
          <tr v-for="c in shown" :key="c.name">
            <td class="dh-field-cell">
              <span class="dh-typebadge" :title="family(c.type)">{{ typeGlyph(c.type) }}</span>
              <span class="dh-field-name">{{ c.name }}</span>
              <span v-if="c.pii" class="dh-pii" :title="c.classified ? 'Classified as PII by ingestion' : 'Tagged PII'"><DhIcon name="lock" :size="11" /> PII</span>
            </td>
            <td class="dh-type">{{ c.type || 'unknown' }}</td>
            <td class="dh-desc-cell">
              <span :class="{ 'dh-muted': !c.description }">{{ c.description || '' }}</span>
              <button type="button" class="dh-inline-edit" :aria-label="'Edit description of ' + c.name"
                      @click="editing = { mode: 'docs', column: c.name, initial: c.description }">
                <DhIcon name="pencil" :size="12" /><span v-if="!c.description">Add description</span>
              </button>
            </td>
            <td>
              <div class="dh-chips">
                <span v-for="t in c.tags" :key="t" class="dh-tag">
                  <span class="dh-tag__dot" :style="{ background: tagColor(t) }" /><span class="dh-tag__text">{{ t }}</span>
                  <button type="button" class="dh-tag__x" :aria-label="'Remove tag ' + t + ' from ' + c.name"
                          @click="removeTag(dh, entity.urn, t, c.name)"><DhIcon name="close" :size="10" /></button>
                </span>
                <button type="button" class="dh-add" @click="editing = { mode: 'tag', column: c.name }"><DhIcon name="plus" :size="11" /> Add Tag</button>
              </div>
            </td>
            <td>
              <div class="dh-chips">
                <span v-for="t in c.terms" :key="t" class="dh-tag dh-term">
                  <DhIcon name="book" :size="11" /><span class="dh-tag__text">{{ t }}</span>
                  <button type="button" class="dh-tag__x" :aria-label="'Remove term ' + t + ' from ' + c.name"
                          @click="removeTerm(dh, entity.urn, t, c.name)"><DhIcon name="close" :size="10" /></button>
                </span>
                <button type="button" class="dh-add" @click="editing = { mode: 'term', column: c.name }"><DhIcon name="plus" :size="11" /> Add Term</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <EditModal v-if="editing" :mode="editing.mode" :urn="entity.urn" :column="editing.column" :initial="editing.initial"
               @close="editing = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import EditModal from './EditModal.vue';
import { tagColor, useDh, type DhDataset } from './dhContext';
import { removeTag, removeTerm } from './edits';

const props = defineProps<{ entity: DhDataset }>();
const dh = useDh();
const filter = ref('');
const piiOnly = ref(false);
const editing = ref<{ mode: 'tag' | 'term' | 'docs'; column: string; initial?: string } | null>(null);

const shown = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  return props.entity.columns.filter(c => (!piiOnly.value || c.pii)
    && (!needle || [c.name, c.type || '', c.description, ...c.tags, ...c.terms].join(' ').toLowerCase().includes(needle)));
});

function family(type: string | null) {
  const t = String(type || '').toLowerCase();
  if (/bool/.test(t)) return 'boolean';
  if (/timestamp|date|time/.test(t)) return 'date / time';
  if (/int|numeric|decimal|number|float|double|real/.test(t)) return 'number';
  if (/char|text|string|uuid/.test(t)) return 'string';
  if (/variant|json|object|array|struct/.test(t)) return 'struct';
  return 'unknown';
}

function typeGlyph(type: string | null) {
  return ({ boolean: 'T/F', 'date / time': '◷', number: '#', string: 'Aa', struct: '{ }', unknown: '?' } as Record<string, string>)[family(type)];
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-schema { display: flex; flex-direction: column; gap: 12px; }
.dh-schema__bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.dh-schema__search { position: relative; width: 300px; max-width: 100%; }
.dh-schema__icon { position: absolute; left: 10px; top: 8px; color: #8c8c8c; }
.dh-schema__input { padding-left: 32px; }
.dh-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.dh-check input { accent-color: var(--dh-primary); margin: 0; }
.dh-field-cell { white-space: nowrap; }
.dh-typebadge { display: inline-grid; place-items: center; min-width: 26px; height: 20px; padding: 0 3px; border-radius: 4px; background: #f0f5ff; color: #1d39c4; font-size: 11px; font-weight: 700; margin-right: 8px; font-family: var(--dh-mono); }
.dh-field-name { font-weight: 700; }
.dh-pii { display: inline-flex; align-items: center; gap: 3px; margin-left: 8px; height: 18px; padding: 0 6px; border-radius: 9px; background: #fff1f0; color: #a8071a; border: 1px solid #ffa39e; font-size: 11px; font-weight: 700; }
.dh-type { font-family: var(--dh-mono); font-size: 12px; color: var(--dh-text-2); white-space: nowrap; }
.dh-desc-cell { min-width: 180px; }
.dh-desc-cell > span { overflow-wrap: anywhere; }
.dh-inline-edit { white-space: nowrap; border: 0; background: none; color: var(--dh-text-2); cursor: pointer; padding: 0 4px; font: inherit; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; }
.dh-inline-edit:hover { color: var(--dh-primary); }
.dh-chips { display: flex; flex-wrap: wrap; gap: 4px; min-width: 150px; }
</style>
