<template>
  <div v-if="creating">
    <CsHeader title="Create queue" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><span class="cs-label">Type</span>
          <div class="cs-desc">Choose the queue type for your application or cloud infrastructure.</div>
          <div class="cs-tiles">
            <label class="cs-tile" :class="{ 'is-checked': type === 'standard' }"><input v-model="type" type="radio" value="standard" />
              <span><strong>Standard</strong><small>At-least-once delivery, message ordering isn't preserved. At-least once delivery. Best-effort ordering.</small></span></label>
            <label class="cs-tile" :class="{ 'is-checked': type === 'fifo' }"><input v-model="type" type="radio" value="fifo" />
              <span><strong>FIFO</strong><small>First-in-first-out delivery, message ordering is preserved. First-in-first-out delivery. Exactly-once processing.</small></span></label>
          </div>
          <div class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" /><div>You can't change the queue type after you create a queue.</div></div></div>
        <div class="cs-field"><label class="cs-label" for="sq-name">Name</label>
          <input id="sq-name" v-model.trim="name" class="cs-input" :class="{ 'is-invalid': tried && nameError }" placeholder="Enter a name" />
          <span v-if="tried && nameError" class="cs-error-text">{{ nameError }}</span>
          <span class="cs-constraint">A queue name is case-sensitive and can have up to 80 characters. You can use alphanumeric characters, hyphens (-), and underscores (_).<template v-if="type === 'fifo'"> The name of a FIFO queue must end with the .fifo suffix.</template></span></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Configuration" :level="2" description="Set the maximum message size, visibility to other consumers, and message retention." /></div>
      <div class="cs-container__body cs-grid-2">
        <div class="cs-field"><label class="cs-label" for="sq-vis">Visibility timeout</label>
          <div class="cs-row"><input id="sq-vis" v-model.number="visibility" type="number" class="cs-input sq__num" /> Seconds</div>
          <span class="cs-constraint">Should be between 0 seconds and 12 hours.</span></div>
        <div class="cs-field"><label class="cs-label" for="sq-ret">Message retention period</label>
          <div class="cs-row"><input id="sq-ret" v-model.number="retentionDays" type="number" class="cs-input sq__num" /> Days</div>
          <span class="cs-constraint">Should be between 1 minute and 14 days.</span></div>
        <div class="cs-field"><span class="cs-label">Delivery delay</span><div class="cs-row"><input class="cs-input sq__num" value="0" disabled /> Seconds</div></div>
        <div class="cs-field"><span class="cs-label">Maximum message size</span><div class="cs-row"><input class="cs-input sq__num" value="256" disabled /> KB</div></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Encryption - optional" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack"><span class="cs-label">Server-side encryption</span>
        <label class="cs-radio"><input type="radio" disabled /> Disabled</label><label class="cs-radio"><input type="radio" checked /> Enabled</label></div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('sqs', 'queues')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create queue</button>
    </div>
  </div>
  <div v-else>
    <CsTable v-model:selected="selected" title="Queues" variant="full-page" :items="queues" :columns="columns" track-by="url"
             selection-type="single" filter-placeholder="Search queues by prefix" empty-title="No queues"
             empty-text="You don't have any queues.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Queues refreshed')"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" :disabled="!current" @click="current && ctx.to('sqs', 'queue', { url: current.url, name: current.name, edit: '1' })">Edit</button>
        <button type="button" class="cs-btn" :disabled="!current" @click="deleting = true">Delete</button>
        <button type="button" class="cs-btn" :disabled="!current" @click="current && ctx.to('sqs', 'queue', { url: current.url, name: current.name, send: '1' })">Send and receive messages</button>
        <CsDropdown :items="[{ id: 'purge', text: 'Purge' }]" :disabled="!current" @select="purging = true" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('sqs', 'create')">Create queue</button>
      </template>
      <template #empty><button type="button" class="cs-btn" @click="ctx.to('sqs', 'create')">Create queue</button></template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('sqs', 'queue', { url: row.url, name: row.name })">{{ row.name }}</a></template>
    </CsTable>
    <SqsDanger v-if="current && (deleting || purging)" :queue="current" :mode="deleting ? 'delete' : 'purge'"
               @close="deleting = false; purging = false" @done="deleting && (selected = []); deleting = false; purging = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, useAws } from '../ctx';
import SqsDanger from './SqsDanger.vue';

const ctx = useAws();
const creating = computed(() => ctx.route.value.page === 'create');
const queues = computed(() => rows(ctx.view.value, 'sqs'));
const selected = ref<string[]>([]);
const current = computed(() => queues.value.find(q => q.url === selected.value[0]) || null);
const deleting = ref(false);
const purging = ref(false);
const busy = ref(false);
const type = ref<'standard' | 'fifo'>('standard');
const name = ref('');
const visibility = ref(30);
const retentionDays = ref(4);
const tried = ref(false);

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'type', header: 'Type', cell: r => (r.fifo ? 'FIFO' : 'Standard') },
  { id: 'created', header: 'Created', cell: r => awsDate(r.created) },
  { id: 'messages', header: 'Messages available', sortKey: 'messages' },
  { id: 'inflight', header: 'Messages in flight', cell: () => '0' },
  { id: 'encryption', header: 'Encryption', cell: () => 'Amazon SQS key (SSE-SQS)' },
  { id: 'dedup', header: 'Content-based deduplication', cell: r => (r.fifo ? 'Disabled' : '-') },
];

const nameError = computed(() => {
  const base = type.value === 'fifo' ? name.value.replace(/\.fifo$/, '') : name.value;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(base)) return 'Can only include alphanumeric characters, hyphens, or underscores. 1 to 80 in length.';
  if (type.value === 'fifo' && !name.value.endsWith('.fifo')) return 'The name of a FIFO queue must end with the .fifo suffix.';
  if (queues.value.some(q => q.name === name.value)) return `A queue already exists with the same name: ${name.value}`;
  return '';
});

async function create() {
  tried.value = true;
  if (nameError.value) return;
  busy.value = true;
  const attrs = [`VisibilityTimeout=${visibility.value}`, `MessageRetentionPeriod=${retentionDays.value * 86400}`];
  if (type.value === 'fifo') attrs.unshift('FifoQueue=true');
  const result = await ctx.run(cli(['aws', 'sqs', 'create-queue'], { '--queue-name': name.value, '--attributes': attrs.join(',') }),
    `Queue ${name.value} created successfully.`);
  busy.value = false;
  if (result.ok) ctx.to('sqs', 'queues');
}
</script>

<style scoped>
.sq__num { width: 130px; }
</style>
