<template>
  <div class="dp">
    <div class="dp__bar">
      <p class="j-muted dp__intro">The D in RAID: decisions, with the alternatives and the why, so somebody in six months can tell whether the reasoning still holds. Records are append-only — supersede a decision with a new one.</p>
      <button type="button" class="j-btn j-btn--primary" @click="open">Record decision</button>
    </div>
    <div class="j-table-wrap">
      <table class="j-table">
        <thead><tr><th>Key</th><th>Decision</th><th>Options</th><th>Chosen</th><th>Rationale</th><th>Door</th><th>Consulted</th><th>Status</th><th>Sprint</th></tr></thead>
        <tbody>
          <tr v-for="d in decisions" :key="d.id">
            <td class="j-nowrap j-key">{{ d.id }}</td>
            <td class="dp__title">{{ d.title }}</td>
            <td>{{ d.options }}</td>
            <td>{{ d.chosen || '—' }}</td>
            <td class="dp__why">{{ d.because || '—' }}</td>
            <td><span class="j-lozenge" :class="d.door === 'one-way' ? 'j-lozenge--danger' : 'j-lozenge--default'">{{ d.door }}</span></td>
            <td>{{ d.consulted || '—' }}</td>
            <td><span class="j-lozenge" :class="d.status === 'complete' ? 'j-lozenge--success' : 'j-lozenge--warning'">{{ d.status }}</span></td>
            <td>{{ d.sprint }}</td>
          </tr>
          <tr v-if="!decisions.length"><td colspan="9"><div class="j-empty"><h3>No decisions recorded</h3><p>Every one you make is being forgotten.</p></div></td></tr>
        </tbody>
      </table>
    </div>

    <JiraModal v-if="form" title="Record decision" @close="form = null">
      <form id="dp-form" @submit.prevent="save">
        <div class="j-field"><label class="j-label" for="dp-title">Decision<span class="j-req">*</span></label>
          <input id="dp-title" v-model="form.title" class="j-input" maxlength="160" autofocus /></div>
        <div class="j-field"><label class="j-label" for="dp-opts">Options considered</label>
          <input id="dp-opts" v-model="form.options" class="j-input" placeholder="Separate with |, e.g. Terraform | Bicep | both" />
          <span class="j-help">At least two, or it is a note saying what happened.</span></div>
        <div class="j-grid2">
          <div class="j-field"><label class="j-label" for="dp-chosen">Chosen</label>
            <select id="dp-chosen" v-model="form.chosen" class="j-select">
              <option value="">Select an option</option>
              <option v-for="o in optionList" :key="o" :value="o">{{ o }}</option></select></div>
          <div class="j-field"><span class="j-label">Reversibility</span>
            <label class="j-check dp__door"><input v-model="form.irreversible" type="checkbox" /> One-way door (irreversible)</label></div>
        </div>
        <div class="j-field"><label class="j-label" for="dp-why">Because</label>
          <textarea id="dp-why" v-model="form.because" class="j-textarea" rows="3" /></div>
        <div class="j-field"><span class="j-label">Consulted</span>
          <div class="dp__people">
            <label v-for="p in team" :key="p.id" class="j-check"><input v-model="form.consult" type="checkbox" :value="p.id" /> {{ p.name }}</label>
          </div></div>
      </form>
      <template #footer>
        <button type="button" class="j-btn j-btn--subtle" @click="form = null">Cancel</button>
        <button type="submit" form="dp-form" class="j-btn j-btn--primary" :disabled="!form.title.trim()">Record</button>
      </template>
    </JiraModal>
  </div>
</template>

<script setup lang="ts">
/** Decision records (ADRs) through `mgr decision add`. */
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import JiraModal from './JiraModal.vue';
import { useJira } from './useJira';

const { ctx, team } = useJira();
const decisions = computed(() => [...rows<Record<string, any>>(ctx.view.value, 'decisions')].reverse());
const form = ref<{ title: string; options: string; chosen: string; because: string; irreversible: boolean; consult: string[] } | null>(null);
const optionList = computed(() => (form.value?.options || '').split(/[|,]/).map(s => s.trim()).filter(Boolean));

function open() { form.value = { title: '', options: '', chosen: '', because: '', irreversible: false, consult: [] }; }

async function save() {
  const f = form.value!;
  const result = await ctx.exec(cli(['mgr', 'decision', 'add'], {
    '--title': f.title.trim(), '--options': optionList.value.join('|'), '--chosen': f.chosen,
    '--because': f.because.trim(), '--consult': f.consult.join(','), '--irreversible': f.irreversible,
  }), { success: '' });
  if (result.ok) {
    form.value = null;
    const lines = String(result.output || '').split('\n').map(l => l.trim()).filter(Boolean);
    ctx.flag(/FLAGGED|IRREVERSIBLE/.test(String(result.output)) ? 'warning' : 'success', lines[0] || 'Recorded',
             lines.slice(1).join(' '));
  }
}
</script>

<style scoped>
.dp__bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
.dp__intro { margin: 0; max-width: 640px; }
.dp__title { min-width: 200px; }
.dp__why { min-width: 180px; max-width: 320px; color: var(--j-text-subtle); }
.dp__door { min-height: 36px; }
.dp__people { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
</style>
