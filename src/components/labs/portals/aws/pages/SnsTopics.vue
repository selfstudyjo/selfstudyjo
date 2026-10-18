<template>
  <div v-if="creating">
    <CsHeader title="Create topic" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><span class="cs-label">Type</span>
          <div class="cs-desc">Topic type cannot be modified after topic is created</div>
          <div class="cs-tiles">
            <label class="cs-tile" :class="{ 'is-checked': type === 'fifo' }"><input v-model="type" type="radio" value="fifo" />
              <span><strong>FIFO (first-in, first-out)</strong><small>Strictly-preserved message ordering · Exactly-once message delivery · Subscription protocols: SQS</small></span></label>
            <label class="cs-tile" :class="{ 'is-checked': type === 'standard' }"><input v-model="type" type="radio" value="standard" />
              <span><strong>Standard</strong><small>Best-effort message ordering · At-least once message delivery · Subscription protocols: SQS, Lambda, Data Firehose, HTTP, SMS, email, mobile application endpoints</small></span></label>
          </div></div>
        <div class="cs-field"><label class="cs-label" for="sn-name">Name</label>
          <input id="sn-name" v-model.trim="name" class="cs-input" :class="{ 'is-invalid': tried && nameError }" placeholder="MyTopic" />
          <span v-if="tried && nameError" class="cs-error-text">{{ nameError }}</span>
          <span class="cs-constraint">Maximum 256 characters. Can include alphanumeric characters, hyphens (-) and underscores (_).<template v-if="type === 'fifo'"> FIFO topic names must end with ".fifo".</template></span></div>
        <div class="cs-field"><label class="cs-label" for="sn-display">Display name - <em>optional</em></label>
          <div class="cs-desc">To use this topic with SMS subscriptions, enter a display name. Only the first 10 characters are displayed in an SMS message.</div>
          <input id="sn-display" v-model="display" class="cs-input" placeholder="My Topic" /></div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('sns', 'topics')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create topic</button>
    </div>
  </div>
  <div v-else>
    <CsTable v-model:selected="selected" title="Topics" variant="full-page" :items="topics" :columns="columns" track-by="arn"
             selection-type="single" filter-placeholder="Search" empty-title="No topics" empty-text="To get started, create a topic.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Topics refreshed')"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" :disabled="!current" @click="current && ctx.to('sns', 'topic', { arn: current.arn, name: current.name })">Edit</button>
        <button type="button" class="cs-btn" :disabled="!current" @click="deleting = true">Delete</button>
        <button type="button" class="cs-btn" :disabled="!current" @click="current && ctx.to('sns', 'topic', { arn: current.arn, name: current.name, publish: '1' })">Publish message</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('sns', 'create')">Create topic</button>
      </template>
      <template #empty><button type="button" class="cs-btn" @click="ctx.to('sns', 'create')">Create topic</button></template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('sns', 'topic', { arn: row.arn, name: row.name })">{{ row.name }}</a></template>
    </CsTable>
    <CsDelete v-if="deleting && current" title="Delete topic" word="delete me" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="st__p">Are you sure you want to delete this topic? Topic <strong>{{ current.name }}</strong> and all of its subscriptions will be deleted.</p>
    </CsDelete>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const creating = computed(() => ctx.route.value.page === 'create');
const topics = computed(() => rows(ctx.view.value, 'sns'));
const selected = ref<string[]>([]);
const current = computed(() => topics.value.find(t => t.arn === selected.value[0]) || null);
const deleting = ref(false);
const busy = ref(false);
const type = ref<'standard' | 'fifo'>('standard');
const name = ref('');
const display = ref('');
const tried = ref(false);

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'type', header: 'Type', cell: r => (String(r.name).endsWith('.fifo') ? 'FIFO' : 'Standard') },
  { id: 'arn', header: 'ARN' },
];
const nameError = computed(() => {
  const base = type.value === 'fifo' ? name.value.replace(/\.fifo$/, '') : name.value;
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(base)) return 'Topic names can include only alphanumeric characters, hyphens and underscores.';
  if (type.value === 'fifo' && !name.value.endsWith('.fifo')) return 'FIFO topic names must end with ".fifo".';
  return '';
});

async function create() {
  tried.value = true;
  if (nameError.value) return;
  busy.value = true;
  const attrs = [type.value === 'fifo' ? 'FifoTopic=true' : '', display.value.trim() ? `DisplayName=${display.value.trim()}` : ''].filter(Boolean).join(',');
  const result = await ctx.run(cli(['aws', 'sns', 'create-topic'], { '--name': name.value, '--attributes': attrs }),
    `Topic ${name.value} created successfully.`);
  busy.value = false;
  if (result.ok) ctx.to('sns', 'topics');
}
async function remove() {
  if (!current.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sns', 'delete-topic'], { '--topic-arn': current.value.arn }),
    `Topic ${current.value.name} deleted successfully.`);
  busy.value = false;
  if (result.ok) { deleting.value = false; selected.value = []; }
}
</script>

<style scoped>
.st__p { margin: 0; }
</style>
