<template>
  <div class="tm">
    <div class="cc-toolbar">
      <label class="cc-field tm-inline"><span class="cc-label">Partition</span>
        <select v-model="partition" class="cc-select">
          <option value="all">All partitions</option>
          <option v-for="p in topic.partitions" :key="p - 1" :value="String(p - 1)">Partition {{ p - 1 }}</option>
        </select></label>
      <label v-if="partition !== 'all'" class="cc-field tm-inline"><span class="cc-label">Jump to offset</span>
        <input v-model.trim="offset" class="cc-input tm-offset" type="text" placeholder="earliest, latest, 42 or -10" /></label>
      <label class="cc-field tm-inline"><span class="cc-label">Max messages</span>
        <select v-model.number="limit" class="cc-select">
          <option :value="20">20</option><option :value="50">50</option><option :value="100">100</option><option :value="200">200</option>
        </select></label>
      <button type="button" class="cc-btn tm-go" :disabled="loading" @click="browse(true)"><CcIcon name="refresh" />{{ loading ? 'Loading...' : 'Fetch messages' }}</button>
      <span class="cc-spacer"></span>
      <button type="button" class="cc-btn cc-btn--primary tm-go" @click="openProduce"><CcIcon name="send" />Produce a new message to this topic</button>
    </div>
    <label class="cc-search"><CcIcon name="filter" />
      <input v-model="filter" class="cc-input" type="search" placeholder="Filter by key or value" aria-label="Filter messages" /></label>

    <div v-if="error" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ error }}</span></div>

    <div class="tm-split" :class="{ 'has-detail': selected }">
      <div class="cc-table-wrap">
        <table class="cc-table">
          <thead><tr><th>Timestamp</th><th class="is-num">Partition</th><th class="is-num">Offset</th><th>Key</th><th>Value</th></tr></thead>
          <tbody>
            <tr v-if="!shown.length"><td colspan="5" class="cc-empty">
              {{ loading ? 'Fetching messages...' : loaded ? 'No messages found for this selection.' : 'Fetch messages to browse this topic.' }}</td></tr>
            <tr v-for="m in shown" :key="m.partition + ':' + m.offset" class="tm-row" :class="{ 'is-selected': isSel(m) }" @click="selected = m">
              <td class="tm-nowrap">{{ timeLabel(m.timestamp) }}</td>
              <td class="is-num">{{ m.partition }}</td>
              <td class="is-num">{{ m.offset }}</td>
              <td class="cc-mono tm-key">{{ m.key === null ? 'null' : m.key }}</td>
              <td class="cc-mono tm-val">{{ m.value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <aside v-if="selected" class="cc-card tm-detail">
        <div class="cc-card__head"><h3 class="cc-h3">Message</h3><span class="cc-spacer"></span>
          <button type="button" class="cc-btn cc-btn--ghost cc-btn--sm" aria-label="Close" @click="selected = null"><CcIcon name="close" /></button></div>
        <div class="cc-card__body tm-detail__body">
          <dl class="cc-kv">
            <dt>Topic</dt><dd>{{ topic.name }}</dd>
            <dt>Partition</dt><dd>{{ selected.partition }}</dd>
            <dt>Offset</dt><dd>{{ selected.offset }}</dd>
            <dt>Timestamp</dt><dd>{{ timeLabel(selected.timestamp) }} <span class="cc-muted">({{ selected.timestamp }})</span></dd>
            <dt>Key</dt><dd class="cc-mono">{{ selected.key === null ? 'null' : selected.key }}</dd>
          </dl>
          <div class="cc-label">Value</div>
          <CcJson :text="selected.value" />
          <div class="cc-label">Headers</div>
          <div v-if="!Object.keys(selected.headers).length" class="cc-muted cc-small">No headers</div>
          <dl v-else class="cc-kv"><template v-for="(v, k) in selected.headers" :key="k"><dt class="cc-mono">{{ k }}</dt><dd class="cc-mono">{{ v }}</dd></template></dl>
        </div>
      </aside>
    </div>

    <CcModal v-if="produceOpen" title="Produce a new message to this topic" ok-text="Produce" :busy="cc.busy.value" :width="620"
             @close="produceOpen = false" @ok="produce">
      <p class="cc-muted tm-p">Sends one record to <strong>{{ topic.name }}</strong> with <span class="cc-mono">kafka-console-producer</span>.
        A record with a key goes to the partition its key hashes to.</p>
      <label class="cc-field"><span class="cc-label">Key</span>
        <input v-model="pKey" class="cc-input" type="text" placeholder="optional (null key = sticky round-robin)" spellcheck="false" /></label>
      <label class="cc-field"><span class="cc-label">Value <em>*</em></span>
        <textarea v-model="pValue" class="cc-textarea" rows="9" spellcheck="false"></textarea>
        <span class="cc-hint">JSON is sent compacted to one line, as the console producer reads one record per line.</span></label>
      <div v-if="pError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ pError }}</span></div>
    </CcModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import CcJson from './CcJson.vue';
import CcModal from './CcModal.vue';
import { useCc } from './ccContext';
import { consumeCommand, oneLine, parseConsumed, produceCommand, timeLabel, type CcMessage, type CcTopic } from './confluent';

const props = defineProps<{ topic: CcTopic }>();
const cc = useCc();

const partition = ref('all');
const offset = ref('earliest');
const limit = ref(50);
const filter = ref('');
const messages = ref<CcMessage[]>([]);
const selected = ref<CcMessage | null>(null);
const loading = ref(false);
const loaded = ref(false);
const error = ref('');

const shown = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  return [...messages.value]
    .filter(m => !needle || String(m.key ?? '').toLowerCase().includes(needle) || m.value.toLowerCase().includes(needle))
    .sort((a, b) => b.timestamp - a.timestamp || b.partition - a.partition || b.offset - a.offset);
});
function isSel(m: CcMessage) {
  return selected.value?.partition === m.partition && selected.value?.offset === m.offset;
}

async function browse(logged: boolean) {
  error.value = '';
  loading.value = true;
  const command = consumeCommand(props.topic.name, {
    partition: partition.value === 'all' ? null : Number(partition.value),
    offset: offset.value || 'earliest',
    limit: limit.value,
  });
  const result = await cc.run(command, { quiet: true, unlogged: !logged });
  loading.value = false;
  loaded.value = true;
  if (!result.ok) { error.value = errorText(result); messages.value = []; return; }
  messages.value = parseConsumed(String(result.output || ''));
  if (selected.value && !messages.value.some(isSel)) selected.value = null;
}
onMounted(() => { if (props.topic.messages > 0) browse(false); else loaded.value = true; });

const produceOpen = ref(false);
const pKey = ref('');
const pValue = ref('');
const pError = ref('');
function openProduce() {
  pKey.value = '';
  pValue.value = '{\n  "order_id": 1001,\n  "status": "CREATED"\n}';
  pError.value = '';
  produceOpen.value = true;
}
async function produce() {
  const value = oneLine(pValue.value);
  if (value.error) { pError.value = value.error; return; }
  if (/[\r\n]/.test(pKey.value)) { pError.value = 'The key must be on a single line.'; return; }
  const result = await cc.run(produceCommand(props.topic.name, pKey.value, value.text),
    { success: `Produced a message to ${props.topic.name}`, quiet: true });
  if (!result.ok) { pError.value = errorText(result); return; }
  produceOpen.value = false;
  await browse(false);
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.tm { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.tm-inline { flex-direction: row; align-items: center; gap: 6px; }
.tm-inline .cc-label { white-space: nowrap; }
.tm-offset { width: 170px; }
.tm-go { align-self: flex-end; }
.tm-split { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
.tm-split.has-detail { grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr); }
.tm-row { cursor: pointer; }
.tm-nowrap { white-space: nowrap; }
.tm-key { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm-val { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm-detail { position: sticky; top: 8px; min-width: 0; }
.tm-detail__body { display: flex; flex-direction: column; gap: 10px; }
.tm-p { margin: 0; }
@container sl-portal (max-width: 1100px) {
  .tm-split.has-detail { grid-template-columns: minmax(0, 1fr); }
  .tm-detail { position: static; }
}
</style>
