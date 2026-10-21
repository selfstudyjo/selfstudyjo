<template>
  <div class="le">
    <div class="le__head"><span>Timestamp</span><span>Message</span></div>
    <div v-if="!events.length" class="cs-empty"><strong>No events found</strong>No events match the filter.</div>
    <div v-for="(e, i) in events" :key="i" class="le__row" :class="{ 'is-open': open.has(i) }">
      <button type="button" class="le__toggle" :aria-expanded="open.has(i)" :aria-label="open.has(i) ? 'Collapse' : 'Expand'" @click="toggle(i)">
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 4v8l5-4z" fill="currentColor" /></svg>
      </button>
      <span class="le__time">{{ e.time }}</span>
      <span class="le__msg" :class="{ 'is-error': /\bERROR\b|\bError\b|503/.test(e.message), 'is-warn': /\bWARN|\bWarning\b/.test(e.message) }">{{ e.message }}</span>
      <div v-if="open.has(i)" class="le__detail">
        <div><b>Log stream</b> <span class="cs-mono">{{ e.stream }}</span></div>
        <pre class="le__pre">{{ e.message }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** CloudWatch's log-event viewer: one line per event, expanding to the whole message. */
import { ref } from 'vue';

defineProps<{ events: { time: string; stream: string; message: string }[] }>();
const open = ref(new Set<number>());
function toggle(i: number) {
  const next = new Set(open.value);
  if (next.has(i)) next.delete(i); else next.add(i);
  open.value = next;
}
</script>

<style scoped>
.le { border: 1px solid #c6c6cd; border-radius: 8px; overflow: hidden; font-size: 13px; }
.le__head { display: grid; grid-template-columns: 28px 200px minmax(0, 1fr); padding: 6px 10px; background: #f8f8f8; border-bottom: 1px solid #c6c6cd; font-weight: 700; color: #424650; }
.le__head span:first-child { grid-column: 2; }
.le__row { display: grid; grid-template-columns: 28px 200px minmax(0, 1fr); align-items: start; padding: 4px 10px; border-bottom: 1px solid #ebebf0; }
.le__row:last-child { border-bottom: 0; }
.le__row.is-open { background: #f0fbff; }
.le__toggle { border: 0; background: none; cursor: pointer; padding: 2px; color: #424650; }
.le__row.is-open .le__toggle svg { transform: rotate(90deg); }
.le__time { font: 12px/20px Monaco, Menlo, Consolas, monospace; color: #424650; }
.le__msg { font: 12px/20px Monaco, Menlo, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.le__msg.is-error { color: #db0000; }
.le__msg.is-warn { color: #855900; }
.le__detail { grid-column: 2 / -1; padding: 6px 0 4px; }
.le__pre { margin: 4px 0 0; padding: 8px 10px; background: #fff; border: 1px solid #ebebf0; border-radius: 6px; white-space: pre-wrap; word-break: break-word; font: 12px/18px Monaco, Menlo, Consolas, monospace; }
@container sl-portal (max-width: 640px) {
  .le__head, .le__row { grid-template-columns: 24px minmax(0, 1fr); }
  .le__time { grid-column: 2; }
  .le__msg { grid-column: 2; white-space: normal; }
}
</style>
