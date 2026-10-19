<template>
  <div>
    <section class="cs-container">
      <div class="cs-container__head">
        <CsHeader :title="`Lifecycle rules (${rules.length})`" :level="2"
                  description="Use lifecycle rules to define actions you want Amazon S3 to take during an object's lifetime such as transitioning objects to another storage class, archiving them, or deleting them after a specified period of time.">
          <template #actions>
            <button type="button" class="cs-btn" :disabled="!selected || busy" @click="deleteRule">Delete</button>
            <button type="button" class="cs-btn cs-btn--primary" @click="openCreate">Create lifecycle rule</button>
          </template>
        </CsHeader>
      </div>
      <div class="cs-container__body">
        <table v-if="rules.length" class="cs-table-mini">
          <thead><tr><th /><th>Lifecycle rule name</th><th>Status</th><th>Scope</th><th>Transitions</th><th>Expiration</th><th>Noncurrent versions</th></tr></thead>
          <tbody><tr v-for="r in rules" :key="r.id">
            <td><input v-model="selected" type="radio" :value="r.id" :aria-label="`Select ${r.id}`" /></td>
            <td>{{ r.id }}</td><td>{{ r.status }}</td><td class="cs-mono">{{ r.prefix ? 'Prefix ' + r.prefix : 'Entire bucket' }}</td>
            <td>{{ r.transitions || '-' }}</td><td>{{ r.expiration_days ? r.expiration_days + ' days' : '-' }}</td>
            <td>{{ r.noncurrent_days ? 'Expire after ' + r.noncurrent_days + ' days' : '-' }}</td></tr></tbody></table>
        <div v-else class="cs-empty"><strong>No lifecycle rules</strong>There are no lifecycle rules for this bucket.</div>
      </div>
    </section>
    <CsModal v-if="form.open" title="Create lifecycle rule" size="large" @close="form.open = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="lc-id">Lifecycle rule name</label><input id="lc-id" v-model.trim="form.id" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label" for="lc-prefix">Prefix</label><input id="lc-prefix" v-model.trim="form.prefix" class="cs-input cs-mono" placeholder="landing/" />
          <span class="cs-constraint">Leave empty to apply the rule to all objects in the bucket.</span></div>
        <div class="cs-field"><span class="cs-label">Transition current versions of objects between storage classes</span>
          <table class="cs-table-mini"><thead><tr><th>Storage class</th><th>Days after object creation</th><th /></tr></thead>
            <tbody><tr v-for="(t, i) in form.transitions" :key="i">
              <td><select v-model="t.class" class="cs-select" aria-label="Storage class"><option v-for="c in CLASSES" :key="c" :value="c">{{ c }}</option></select></td>
              <td><input v-model.number="t.days" type="number" min="0" class="cs-input" aria-label="Days" /></td>
              <td><button type="button" class="cs-btn cs-btn--inline" @click="form.transitions.splice(i, 1)">Remove</button></td></tr></tbody></table>
          <div><button type="button" class="cs-btn" @click="form.transitions.push({ class: 'GLACIER_IR', days: 90 })">Add transition</button></div>
          <span class="cs-constraint">Standard-IA and One Zone-IA require at least 30 days.</span></div>
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label" for="lc-exp">Expire current versions after (days)</label><input id="lc-exp" v-model.number="form.expiration" type="number" min="0" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="lc-nc">Permanently delete noncurrent versions after (days)</label><input id="lc-nc" v-model.number="form.noncurrent" type="number" min="0" class="cs-input" /></div>
        </div>
        <label class="cs-check"><input v-model="form.abort" type="checkbox" /> Delete expired object delete markers or incomplete multipart uploads after 7 days</label>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="form.open = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!form.id || busy" @click="create">Create rule</button>
      </template>
    </CsModal>
  </div>
</template>

<script setup lang="ts">
/** S3 bucket > Management: lifecycle rules (transitions, expiration, noncurrent versions). The whole configuration is rewritten on every change, as S3 does. */
import { computed, reactive, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsModal from '../CsModal.vue';
import { useAws } from '../ctx';

const CLASSES = ['STANDARD_IA', 'INTELLIGENT_TIERING', 'ONEZONE_IA', 'GLACIER_IR', 'GLACIER', 'DEEP_ARCHIVE'];
const props = defineProps<{ bucket: Record<string, any> }>();
const ctx = useAws();
const rules = computed<Array<Record<string, any>>>(() => props.bucket.lifecycle || []);
const selected = ref('');
const busy = ref(false);
const form = reactive({ open: false, id: '', prefix: '', transitions: [] as Array<{ class: string; days: number }>,
  expiration: 0, noncurrent: 0, abort: true });

function toRaw(r: Record<string, any>) {
  const raw: Record<string, unknown> = { ID: r.id, Filter: { Prefix: r.prefix || '' }, Status: r.status || 'Enabled' };
  const transitions = (r.transition_list || []).map((t: any) => ({ Days: t.days, StorageClass: t.class }));
  if (transitions.length) raw.Transitions = transitions;
  if (r.expiration_days) raw.Expiration = { Days: r.expiration_days };
  if (r.noncurrent_days) raw.NoncurrentVersionExpiration = { NoncurrentDays: r.noncurrent_days };
  if (r.abort_days) raw.AbortIncompleteMultipartUpload = { DaysAfterInitiation: r.abort_days };
  return raw;
}
async function write(list: Array<Record<string, unknown>>, success: string) {
  busy.value = true;
  const command = list.length
    ? cli(['aws', 's3api', 'put-bucket-lifecycle-configuration'], { '--bucket': props.bucket.name,
      '--lifecycle-configuration': JSON.stringify({ Rules: list }) })
    : cli(['aws', 's3api', 'delete-bucket-lifecycle'], { '--bucket': props.bucket.name });
  const result = await ctx.run(command, success);
  busy.value = false;
  return result.ok;
}
function openCreate() {
  Object.assign(form, { open: true, id: '', prefix: '', transitions: [{ class: 'STANDARD_IA', days: 30 }], expiration: 365, noncurrent: 30, abort: true });
}
async function create() {
  const raw = toRaw({ id: form.id, prefix: form.prefix, status: 'Enabled',
    transition_list: form.transitions.map(t => ({ days: t.days, class: t.class })),
    expiration_days: form.expiration, noncurrent_days: form.noncurrent, abort_days: form.abort ? 7 : 0 });
  const list = [...rules.value.filter(r => r.id !== form.id).map(toRaw), raw];
  if (await write(list, `Lifecycle rule ${form.id} created.`)) form.open = false;
}
async function deleteRule() {
  const id = selected.value;
  if (await write(rules.value.filter(r => r.id !== id).map(toRaw), `Lifecycle rule ${id} deleted.`)) selected.value = '';
}
</script>
