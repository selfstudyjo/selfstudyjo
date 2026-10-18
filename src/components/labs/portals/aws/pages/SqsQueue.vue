<template>
  <div v-if="queue">
    <!-- Send and receive is its own page in the SQS console -->
    <template v-if="sendMode">
      <CsHeader title="Send and receive messages" :description="`Send messages to and receive messages from a queue.`">
        <template #actions><button type="button" class="cs-btn" @click="sendMode = false">Back to queue</button></template>
      </CsHeader>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Send message" :level="2">
          <template #actions><button type="button" class="cs-btn" @click="body = ''">Clear content</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="!body || busy" @click="send">Send message</button></template></CsHeader></div>
        <div class="cs-container__body cs-stack">
          <div class="cs-field sq__body"><label class="cs-label" for="sq-body">Message body</label>
            <div class="cs-desc">Enter the message to send to the queue.</div>
            <textarea id="sq-body" v-model="body" class="cs-textarea" /></div>
          <div v-if="queue.fifo" class="cs-grid-2">
            <div class="cs-field"><label class="cs-label" for="sq-group">Message group ID</label><input id="sq-group" v-model="groupId" class="cs-input" /></div>
            <div class="cs-field"><label class="cs-label" for="sq-dedup">Message deduplication ID</label><input id="sq-dedup" v-model="dedupId" class="cs-input" /></div>
          </div>
        </div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Receive messages" :level="2">
          <template #actions><button type="button" class="cs-btn" @click="received = []">Stop polling</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="poll">Poll for messages</button></template></CsHeader></div>
        <div class="cs-container__body cs-stack">
          <dl class="cs-kv"><div><dt>Messages available</dt><dd>{{ queue.messages }}</dd></div><div><dt>Polling duration</dt><dd>20</dd></div>
            <div><dt>Maximum message count</dt><dd>10</dd></div><div><dt>Polling progress</dt><dd>{{ polled ? '100%' : '0%' }}</dd></div></dl>
          <table class="cs-table-mini"><thead><tr><th>ID</th><th>Sent</th><th>Size</th><th>Receive count</th><th>Body</th></tr></thead>
            <tbody><tr v-for="m in received" :key="m.MessageId"><td class="cs-mono">{{ m.MessageId }}</td><td>{{ m.sent }}</td><td>{{ m.Body.length }} bytes</td><td>1</td><td>{{ m.Body }}</td></tr>
              <tr v-if="!received.length"><td colspan="5" class="cs-empty"><strong>No messages</strong>Poll for messages to see them here.</td></tr></tbody></table>
        </div>
      </section>
    </template>

    <template v-else>
      <CsHeader :title="queue.name">
        <template #actions>
          <button type="button" class="cs-btn" @click="editing = !editing">Edit</button>
          <button type="button" class="cs-btn" @click="danger = 'delete'">Delete</button>
          <button type="button" class="cs-btn" @click="danger = 'purge'">Purge</button>
          <button type="button" class="cs-btn cs-btn--primary" @click="sendMode = true">Send and receive messages</button>
        </template>
      </CsHeader>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
        <div class="cs-container__body">
          <dl class="cs-kv">
            <div><dt>Name</dt><dd>{{ queue.name }}</dd></div>
            <div><dt>Type</dt><dd>{{ queue.fifo ? 'FIFO' : 'Standard' }}</dd></div>
            <div><dt>ARN</dt><dd class="cs-mono">{{ queue.arn }}</dd></div>
            <div><dt>Encryption</dt><dd>Amazon SQS key (SSE-SQS)</dd></div>
            <div><dt>URL</dt><dd class="cs-mono">{{ queue.url }}</dd></div>
            <div><dt>Dead-letter queue</dt><dd>-</dd></div>
          </dl>
        </div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Configuration" :level="2" :info="false" /></div>
        <div class="cs-container__body">
          <div v-if="editing" class="cs-stack">
            <div class="cs-grid-2">
              <div class="cs-field"><label class="cs-label" for="sq-ev">Visibility timeout</label>
                <div class="cs-row"><input id="sq-ev" v-model.number="visibility" type="number" class="cs-input sq__num" :class="{ 'is-invalid': visError }" /> Seconds</div>
                <span v-if="visError" class="cs-error-text">{{ visError }}</span></div>
              <div class="cs-field"><label class="cs-label" for="sq-er">Message retention period</label>
                <div class="cs-row"><input id="sq-er" v-model.number="retention" type="number" class="cs-input sq__num" :class="{ 'is-invalid': retError }" /> Seconds</div>
                <span v-if="retError" class="cs-error-text">{{ retError }}</span></div>
            </div>
            <div class="cs-form-actions"><button type="button" class="cs-btn cs-btn--link" @click="editing = false">Cancel</button>
              <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!visError || !!retError" @click="save">Save</button></div>
          </div>
          <dl v-else class="cs-kv">
            <div><dt>Visibility timeout</dt><dd>{{ queue.visibility }} Seconds</dd></div>
            <div><dt>Message retention period</dt><dd>{{ retentionText }}</dd></div>
            <div><dt>Delivery delay</dt><dd>0 Seconds</dd></div>
            <div><dt>Maximum message size</dt><dd>256 KB</dd></div>
            <div><dt>Receive message wait time</dt><dd>0 Seconds</dd></div>
            <div><dt>Messages available</dt><dd>{{ queue.messages }}</dd></div>
          </dl>
        </div>
      </section>
    </template>
    <SqsDanger v-if="danger" :queue="queue" :mode="danger" @close="danger = ''" @done="danger = ''" />
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>The specified queue does not exist.</strong><button type="button" class="cs-link" @click="ctx.to('sqs', 'queues')">View queues</button></div></div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import { useAws } from '../ctx';
import SqsDanger from './SqsDanger.vue';

const ctx = useAws();
const url = computed(() => ctx.route.value.params?.url || '');
const queue = computed(() => rows(ctx.view.value, 'sqs').find(q => q.url === url.value) || null);
const sendMode = ref(ctx.route.value.params?.send === '1');
const editing = ref(ctx.route.value.params?.edit === '1');
const danger = ref<'' | 'delete' | 'purge'>('');
const busy = ref(false);
const body = ref('');
const groupId = ref('group-1');
const dedupId = ref('');
const received = ref<{ MessageId: string; Body: string; sent: string }[]>([]);
const polled = ref(false);
const visibility = ref(30);
const retention = ref(345600);

watch(editing, on => {
  if (on && queue.value) { visibility.value = queue.value.visibility; retention.value = queue.value.retention; }
}, { immediate: true });

const retentionText = computed(() => {
  const s = Number(queue.value?.retention) || 0;
  return s % 86400 === 0 ? `${s / 86400} Days` : `${s} Seconds`;
});
const visError = computed(() => (Number.isInteger(visibility.value) && visibility.value >= 0 && visibility.value <= 43200 ? '' : 'Should be between 0 seconds and 12 hours.'));
const retError = computed(() => (Number.isInteger(retention.value) && retention.value >= 60 && retention.value <= 1209600 ? '' : 'Should be between 1 minute and 14 days.'));

async function send() {
  if (!queue.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sqs', 'send-message'], {
    '--queue-url': queue.value.url, '--message-body': body.value,
    '--message-group-id': queue.value.fifo ? groupId.value : '',
    '--message-deduplication-id': queue.value.fifo ? (dedupId.value || String(Date.now())) : '',
  }));
  busy.value = false;
  if (result.ok) {
    const id = parseJson<{ MessageId: string }>(result.output)?.MessageId;
    ctx.api.notify('success', `Your message has been sent and is ready to be received.`, `Message ID: ${id}`);
    body.value = '';
  }
}
async function poll() {
  if (!queue.value) return;
  busy.value = true;
  polled.value = true;
  const found: { MessageId: string; Body: string; sent: string }[] = [];
  for (let i = 0; i < 10; i += 1) {
    const result = await ctx.run(cli(['aws', 'sqs', 'receive-message'], {
      '--queue-url': queue.value.url, '--max-number-of-messages': 10, '--wait-time-seconds': 20,
    }));
    const message = parseJson<{ Messages?: { MessageId: string; Body: string }[] }>(result.output)?.Messages?.[0];
    if (!result.ok || !message) break;
    found.push({ ...message, sent: new Date().toUTCString() });
  }
  received.value = [...found, ...received.value];
  busy.value = false;
  ctx.api.notify('info', `Received ${found.length} message(s).`);
}
async function save() {
  if (!queue.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sqs', 'set-queue-attributes'], {
    '--queue-url': queue.value.url, '--attributes': `VisibilityTimeout=${visibility.value},MessageRetentionPeriod=${retention.value}`,
  }), `Queue ${queue.value.name} updated successfully.`);
  busy.value = false;
  if (result.ok) editing.value = false;
}
</script>

<style scoped>
.sq__num { width: 130px; }
.sq__body { max-width: none; }
.sq__body textarea { min-height: 120px; }
</style>
