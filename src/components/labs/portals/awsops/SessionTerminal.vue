<template>
  <div class="st" role="dialog" aria-modal="true" aria-label="Session Manager">
    <header class="st__bar">
      <div class="st__title">
        <strong>Session ID: {{ session?.id || '-' }}</strong>
        <span>Instance ID: {{ session?.instance || '-' }}<template v-if="session?.name"> ({{ session.name }})</template></span>
      </div>
      <button type="button" class="st__term" :disabled="busy" @click="terminate">Terminate</button>
    </header>
    <div v-if="session && !session.logged" class="st__warn">
      Session logging is not configured: this session leaves no audit trail of commands.
      Configure it in Session Manager → Preferences.
    </div>
    <div ref="screen" class="st__screen" @click="input?.focus()">
      <pre class="st__out">{{ transcript }}</pre>
      <div class="st__line">
        <span class="st__prompt">{{ prompt }}</span>
        <input ref="input" v-model="line" class="st__input" type="text" spellcheck="false" autocomplete="off"
               aria-label="Session command" :disabled="busy" @keydown.enter="send" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * An open Session Manager session takes over every command line (the engine's
 * `claims`), so the console cannot do anything else until it is exited. This
 * is the browser-based shell the real console opens in a new tab, drawn over
 * the page. "Terminate" sends `exit`, which is what ends the session.
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { pick } from '@/utils/portalKit';
import { useOps } from './ctx';

const ctx = useOps();
const line = ref('');
const busy = ref(false);
const screen = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const output = ref<string[]>([]);

const session = computed<any>(() => (pick<any[]>(ctx.c.value, 'ssm.sessions', []) as any[]).find(s => !s.ended) || null);
const windows = computed(() => {
  const id = session.value?.instance || '';
  const node = (pick<any[]>(ctx.c.value, 'ssm.nodes', []) as any[]).find(n => n.id === id);
  return !node || node.platform === 'Windows';
});
const prompt = computed(() => (windows.value ? 'PS C:\\Windows\\system32> ' : 'sh-5.2$ '));
const transcript = computed(() => {
  const head = session.value ? `Starting session with SessionId: ${session.value.id}\n` : '';
  return head + output.value.join('\n');
});

async function send() {
  const text = line.value.trim();
  if (!text || busy.value) return;
  busy.value = true;
  line.value = '';
  output.value.push(prompt.value + text);
  const result = await ctx.run(text, '', { quiet: true });
  const body = String(result.ok ? result.output || '' : result.error || result.output || '').trim();
  if (body) output.value.push(body);
  busy.value = false;
  await nextTick();
  screen.value?.scrollTo?.({ top: screen.value.scrollHeight });
  input.value?.focus();
}
async function terminate() {
  busy.value = true;
  await ctx.run('exit', 'Session terminated.', { quiet: true });
  busy.value = false;
}
onMounted(() => input.value?.focus());
</script>

<style scoped>
.st { position: absolute; inset: 0; z-index: 70; display: flex; flex-direction: column; background: #0f141a; color: #e9ebed; }
.st__bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: #232f3e; flex-wrap: wrap; }
.st__title { display: flex; flex-direction: column; font-size: 13px; line-height: 18px; min-width: 0; word-break: break-all; }
.st__term { border: 2px solid #ff9900; background: #ff9900; color: #0f141a; font: inherit; font-weight: 700; border-radius: 20px; padding: 4px 18px; cursor: pointer; }
.st__term:disabled { opacity: .6; cursor: default; }
.st__warn { background: #fffef0; color: #855900; font-size: 13px; padding: 6px 16px; border-bottom: 2px solid #855900; }
.st__screen { flex: 1; overflow: auto; padding: 12px 16px; font-family: Monaco, Menlo, Consolas, 'Courier New', monospace; font-size: 13px; line-height: 18px; cursor: text; }
.st__out { margin: 0; white-space: pre-wrap; word-break: break-word; color: inherit; font: inherit; background: none; }
.st__line { display: flex; align-items: center; }
.st__prompt { white-space: pre; color: #e9ebed; }
.st__input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #e9ebed; font: inherit; padding: 0; }
</style>
