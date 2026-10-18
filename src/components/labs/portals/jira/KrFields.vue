<template>
  <div>
    <div class="j-field"><label class="j-label" :for="id + '-text'">Key result<span class="j-req">*</span></label>
      <input :id="id + '-text'" v-model="form.kr" class="j-input" maxlength="200" />
      <span class="j-help">Measurable: a number that moves from a baseline to a target.</span></div>
    <div class="j-grid2">
      <div class="j-field"><label class="j-label" :for="id + '-owner'">Owner</label>
        <select :id="id + '-owner'" v-model="form.owner" class="j-select">
          <option value="">{{ editing ? 'Keep current owner' : 'No owner' }}</option>
          <option v-for="p in team" :key="p.id" :value="p.id">{{ p.name }}</option></select>
        <span v-if="!form.owner && !editing" class="j-help">A key result with no owner does not move.</span></div>
      <div class="j-field"><label class="j-label" :for="id + '-conf'">Confidence (%)</label>
        <input :id="id + '-conf'" v-model="form.confidence" class="j-input" type="number" min="0" max="100" /></div>
      <div class="j-field"><label class="j-label" :for="id + '-base'">Baseline</label>
        <input :id="id + '-base'" v-model="form.baseline" class="j-input" type="number" step="any" /></div>
      <div class="j-field"><label class="j-label" :for="id + '-target'">Target</label>
        <input :id="id + '-target'" v-model="form.target" class="j-input" type="number" step="any" /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The key-result fields, shared by "Create goal" and "Add / edit key result". */
import type { Person } from './jiraKit';

defineProps<{ form: Record<string, any>; team: Person[]; editing?: boolean }>();
const id = 'kr' + Math.random().toString(36).slice(2, 8);
</script>
