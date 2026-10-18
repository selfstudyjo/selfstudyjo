<template>
  <div v-if="db">
    <template v-if="!reviewing">
      <CsHeader :title="`Modify DB instance: ${db.id}`" :info="false" />
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Settings" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-stack">
          <dl class="cs-kv"><div><dt>Engine version</dt><dd>{{ db.version }}</dd></div><div><dt>DB instance identifier</dt><dd>{{ db.id }}</dd></div></dl>
          <div class="cs-field"><label class="cs-label" for="rm-pw">New master password <small>- optional</small></label>
            <input id="rm-pw" v-model="password" type="password" class="cs-input" :class="{ 'is-invalid': password && password.length < 8 }" autocomplete="new-password" />
            <span class="cs-constraint">At least 8 printable ASCII characters. Leave empty to keep the current password.</span></div>
        </div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Instance configuration" :level="2" :info="false" /></div>
        <div class="cs-container__body"><div class="cs-field"><label class="cs-label" for="rm-class">DB instance class</label>
          <select id="rm-class" v-model="dbClass" class="cs-select"><option v-for="c in classes" :key="c" :value="c">{{ c }}</option></select></div></div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Storage" :level="2" :info="false" /></div>
        <div class="cs-container__body"><div class="cs-field"><label class="cs-label" for="rm-st">Allocated storage</label>
          <div class="cs-row"><input id="rm-st" v-model.number="storage" type="number" class="cs-input rm__num" :class="{ 'is-invalid': storage < db.storage }" /> GiB</div>
          <span v-if="storage < db.storage" class="cs-error-text">You can't decrease allocated storage (currently {{ db.storage }} GiB).</span></div></div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Availability & durability" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-stack">
          <label class="cs-radio"><input v-model="multiAz" type="radio" :value="true" /> Create a standby instance (recommended for production usage)</label>
          <label class="cs-radio"><input v-model="multiAz" type="radio" :value="false" /> Do not create a standby instance</label>
        </div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Connectivity" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-stack">
          <span class="cs-label">Public access</span>
          <label class="cs-radio"><input v-model="publicAccess" type="radio" :value="true" /> Publicly accessible</label>
          <label class="cs-radio"><input v-model="publicAccess" type="radio" :value="false" /> Not publicly accessible</label>
        </div>
      </section>
      <div class="cs-form-actions">
        <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('rds', 'database', { id: db.id })">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!changes.length || storage < db.storage || (!!password && password.length < 8)" @click="reviewing = true">Continue</button>
      </div>
    </template>
    <template v-else>
      <CsHeader :title="`Modify DB instance: ${db.id}`" :info="false" />
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Summary of modifications" :level="2" :info="false" description="You are about to submit the following modifications. Only values that will change are displayed." /></div>
        <div class="cs-container__body"><table class="cs-table-mini"><thead><tr><th>Attribute</th><th>Current value</th><th>New value</th></tr></thead>
          <tbody><tr v-for="c in changes" :key="c[0]"><td>{{ c[0] }}</td><td>{{ c[1] }}</td><td>{{ c[2] }}</td></tr></tbody></table></div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Schedule modifications" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-stack">
          <label class="cs-radio"><input v-model="immediate" type="radio" :value="false" /> Apply during the next scheduled maintenance window</label>
          <label class="cs-radio"><input v-model="immediate" type="radio" :value="true" /> Apply immediately</label>
        </div>
      </section>
      <div class="cs-form-actions">
        <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('rds', 'database', { id: db.id })">Cancel</button>
        <button type="button" class="cs-btn" @click="reviewing = false">Back</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="save">Modify DB instance</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const id = computed(() => ctx.route.value.params?.id || '');
const db = computed(() => rows(ctx.view.value, 'rds').find(d => d.id === id.value) || null);
const classes = computed(() => pick<string[]>(ctx.view.value, 'db_classes', []));
const dbClass = ref(db.value?.class || 'db.t3.micro');
const storage = ref(Number(db.value?.storage) || 20);
const multiAz = ref(Boolean(db.value?.multi_az));
const publicAccess = ref(Boolean(db.value?.public));
const password = ref('');
const reviewing = ref(false);
const immediate = ref(true);
const busy = ref(false);

const changes = computed(() => {
  const d = db.value;
  if (!d) return [];
  const out: [string, string, string][] = [];
  if (dbClass.value !== d.class) out.push(['DB instance class', d.class, dbClass.value]);
  if (storage.value !== d.storage) out.push(['Allocated storage', `${d.storage} GiB`, `${storage.value} GiB`]);
  if (multiAz.value !== Boolean(d.multi_az)) out.push(['Multi-AZ deployment', d.multi_az ? 'Yes' : 'No', multiAz.value ? 'Yes' : 'No']);
  if (publicAccess.value !== Boolean(d.public)) out.push(['Publicly accessible', d.public ? 'Yes' : 'No', publicAccess.value ? 'Yes' : 'No']);
  if (password.value) out.push(['Master password', '****', '********']);
  return out;
});

async function save() {
  const d = db.value;
  if (!d) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'rds', 'modify-db-instance'], {
    '--db-instance-identifier': d.id,
    '--db-instance-class': dbClass.value !== d.class ? dbClass.value : '',
    '--allocated-storage': storage.value !== d.storage ? storage.value : '',
    '--multi-az': multiAz.value !== Boolean(d.multi_az) && multiAz.value,
    '--no-multi-az': multiAz.value !== Boolean(d.multi_az) && !multiAz.value,
    '--publicly-accessible': publicAccess.value !== Boolean(d.public) && publicAccess.value,
    '--no-publicly-accessible': publicAccess.value !== Boolean(d.public) && !publicAccess.value,
    '--master-user-password': password.value,
    '--apply-immediately': immediate.value,
  }), `Successfully modified DB instance ${d.id}.`);
  busy.value = false;
  if (result.ok) ctx.to('rds', 'database', { id: d.id });
}
</script>

<style scoped>
.rm__num { width: 140px; }
</style>
