<template>
  <div v-if="topic">
    <template v-if="publishing">
      <CsHeader title="Publish message to topic" />
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Message details" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-stack">
          <dl class="cs-kv"><div><dt>Topic ARN</dt><dd class="cs-mono">{{ topic.arn }}</dd></div></dl>
          <div class="cs-field"><label class="cs-label" for="sp-subj">Subject - <em>optional</em></label>
            <input id="sp-subj" v-model="subject" class="cs-input" placeholder="Enter the message subject" />
            <span class="cs-constraint">Up to 100 printable ASCII characters</span></div>
        </div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Message body" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-stack">
          <label class="cs-radio"><input type="radio" checked /> Identical payload for all delivery protocols.</label>
          <div class="cs-field stp__body"><label class="cs-label" for="sp-msg">Message body to send to the endpoint</label>
            <textarea id="sp-msg" v-model="message" class="cs-textarea" /></div>
        </div>
      </section>
      <div class="cs-form-actions">
        <button type="button" class="cs-btn cs-btn--link" @click="publishing = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!message || busy" @click="publish">Publish message</button>
      </div>
    </template>
    <template v-else>
      <CsHeader :title="topic.name">
        <template #actions>
          <button type="button" class="cs-btn" @click="deleting = true">Delete</button>
          <button type="button" class="cs-btn cs-btn--primary" @click="publishing = true">Publish message</button>
        </template>
      </CsHeader>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
        <div class="cs-container__body"><dl class="cs-kv">
          <div><dt>Name</dt><dd>{{ topic.name }}</dd></div><div><dt>ARN</dt><dd class="cs-mono">{{ topic.arn }}</dd></div>
          <div><dt>Type</dt><dd>{{ String(topic.name).endsWith('.fifo') ? 'FIFO' : 'Standard' }}</dd></div>
          <div><dt>Topic owner</dt><dd>{{ ctx.account.value }}</dd></div>
          <div><dt>Messages published</dt><dd>{{ topic.published }}</dd></div></dl></div>
      </section>
      <SnsSubTable :topic="topic" />
    </template>
    <CsDelete v-if="deleting" title="Delete topic" word="delete me" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="stp__p">Are you sure you want to delete this topic? Topic <strong>{{ topic.name }}</strong> and all of its subscriptions will be deleted.</p>
    </CsDelete>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>Topic does not exist</strong><button type="button" class="cs-link" @click="ctx.to('sns', 'topics')">View topics</button></div></div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import { useAws } from '../ctx';
import SnsSubTable from './SnsSubTable.vue';

const ctx = useAws();
const arn = computed(() => ctx.route.value.params?.arn || '');
const topic = computed(() => rows(ctx.view.value, 'sns').find(t => t.arn === arn.value) || null);
const publishing = ref(ctx.route.value.params?.publish === '1');
const deleting = ref(false);
const busy = ref(false);
const subject = ref('');
const message = ref('');

async function publish() {
  if (!topic.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sns', 'publish'], {
    '--topic-arn': topic.value.arn, '--subject': subject.value.trim(), '--message': message.value,
  }), `Message published to topic ${topic.value.name} successfully.`);
  busy.value = false;
  if (result.ok) { publishing.value = false; message.value = ''; subject.value = ''; }
}
async function remove() {
  if (!topic.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sns', 'delete-topic'], { '--topic-arn': topic.value.arn }),
    `Topic ${topic.value.name} deleted successfully.`);
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to('sns', 'topics'); }
}
</script>

<style scoped>
.stp__p { margin: 0; }
.stp__body { max-width: none; }
.stp__body textarea { min-height: 140px; }
</style>
