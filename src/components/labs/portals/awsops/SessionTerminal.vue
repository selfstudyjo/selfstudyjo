<template>
  <div class="st" role="dialog" aria-modal="true" :aria-label="isSsh ? 'EC2 Instance Connect' : 'Session Manager'">
    <header class="st__bar">
      <div class="st__brand">
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><rect x="1" y="2" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="m4 6 2 2-2 2M8 10h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
        <span>{{ isSsh ? 'EC2 Instance Connect' : 'Session Manager' }}</span>
      </div>
      <div class="st__title">
        <template v-if="isSsh">
          <strong>{{ active?.instance }}<template v-if="active?.name"> ({{ active.name }})</template></strong>
          <span>{{ active?.user }}@{{ active?.ip }} · {{ active?.via === 'direct' ? 'Public IPv4' : 'via ' + active?.via }}</span>
        </template>
        <template v-else>
          <strong>Session ID: {{ active?.id || '-' }}</strong>
          <span>Instance ID: {{ active?.instance || '-' }}<template v-if="active?.name"> ({{ active.name }})</template></span>
        </template>
      </div>
      <span class="st__spacer" />
      <button type="button" class="st__ghost" :disabled="busy" title="Clear the screen (Ctrl+L)" @click="clearScreen">Clear</button>
      <button type="button" class="st__term" :disabled="busy" @click="terminate">{{ isSsh ? 'Close' : 'Terminate' }}</button>
    </header>
    <div v-if="active && !isSsh && !active.logged" class="st__warn">
      Session logging is not configured: this session leaves no audit trail of commands.
      Configure it in Session Manager → Preferences.
    </div>
    <div v-if="isSsh" class="st__warn st__warn--info">
      EC2 Instance Connect sessions are not recorded by Session Manager: nothing you type here is logged.
    </div>
    <div ref="screen" class="st__screen" @click="focus">
      <pre class="st__out">{{ transcript }}</pre>
      <div class="st__line">
        <span class="st__prompt">{{ prompt }}</span>
        <input ref="input" v-model="line" class="st__input" type="text" spellcheck="false" autocomplete="off"
               autocapitalize="off" aria-label="Terminal input" :disabled="busy"
               @keydown.enter.prevent="send" @keydown.up.prevent="older" @keydown.down.prevent="newer"
               @keydown.tab.prevent="complete" @keydown="keys" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * An open session takes over every command line (the engine's `claims`), so
 * the console cannot do anything else until it is exited. This is the
 * browser-based shell the real console opens in a new tab - Session Manager's
 * or EC2 Instance Connect's - drawn over the page. Every line typed is sent
 * to the engine exactly as typed; the prompt (user, host, directory) comes
 * back from it, so `cd` and `sudo -i` move it the way a real shell does.
 *
 * Up/Down walk this session's history, Tab completes a command word, Ctrl+L
 * clears the screen and Ctrl+C abandons the line - the keys a terminal user
 * reaches for without thinking.
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
const past = ref<string[]>([]);
const cursor = ref(-1);

const active = computed<any>(() => pick<any>(ctx.c.value, 'ssm.active', null));
const isSsh = computed(() => active.value?.kind === 'ssh');
const windows = computed(() => active.value?.platform === 'Windows');
const prompt = computed(() => String(active.value?.prompt || (windows.value ? 'PS C:\\Windows\\system32> ' : 'sh-5.2$ ')));
const opening = ref('');
const transcript = computed(() => (opening.value ? opening.value + '\n' : '') + output.value.join('\n'));

const WORDS_LINUX = ['cat', 'cd', 'clear', 'curl', 'date', 'df', 'echo', 'exit', 'free', 'head', 'help', 'hostname', 'id',
  'ip', 'journalctl', 'ls', 'ps', 'pwd', 'ss', 'sudo', 'systemctl', 'tail', 'top', 'uname', 'uptime', 'whoami'];
const WORDS_WINDOWS = ['exit', 'Get-EventLog', 'Get-HotFix', 'Get-PSDrive', 'Get-Service', 'help', 'hostname', 'ipconfig',
  'Remove-Item', 'Restart-Service', 'Test-NetConnection', 'whoami'];

function focus() { input.value?.focus(); }
async function scroll() {
  await nextTick();
  screen.value?.scrollTo?.({ top: screen.value.scrollHeight });
  focus();
}

async function send() {
  const text = line.value;
  if (busy.value) return;
  line.value = '';
  cursor.value = -1;
  const shown = prompt.value;
  if (!text.trim()) { output.value.push(shown); await scroll(); return; }
  past.value = [text, ...past.value.filter(p => p !== text)].slice(0, 100);
  if (text.trim() === 'clear' || text.trim() === 'cls' || text.trim() === 'Clear-Host') {
    output.value = [];
    opening.value = '';
    if (!windows.value) await ctx.run(text.trim() === 'clear' ? 'clear' : text.trim(), '', { quiet: true });
    await scroll();
    return;
  }
  busy.value = true;
  output.value.push(shown + text);
  const result = await ctx.run(text, '', { quiet: true });
  const body = String(result.ok ? result.output || '' : result.error || result.output || '').replace(/\s+$/, '');
  if (body && body.trim() !== prompt.value.trim()) output.value.push(body);
  busy.value = false;
  await scroll();
}
function older() {
  if (!past.value.length) return;
  cursor.value = Math.min(past.value.length - 1, cursor.value + 1);
  line.value = past.value[cursor.value];
}
function newer() {
  if (cursor.value <= 0) { cursor.value = -1; line.value = ''; return; }
  cursor.value -= 1;
  line.value = past.value[cursor.value];
}
function complete() {
  const words = line.value.split(' ');
  if (words.length !== 1 || !words[0]) return;
  const head = words[0].toLowerCase();
  const pool = windows.value ? WORDS_WINDOWS : WORDS_LINUX;
  const hits = pool.filter(w => w.toLowerCase().startsWith(head));
  if (hits.length === 1) line.value = hits[0] + ' ';
  else if (hits.length > 1) { output.value.push(prompt.value + line.value, hits.join('  ')); scroll(); }
}
function keys(event: KeyboardEvent) {
  if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); clearScreen(); }
  if (event.ctrlKey && event.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
    event.preventDefault();
    output.value.push(prompt.value + line.value + '^C');
    line.value = '';
    scroll();
  }
}
function clearScreen() {
  output.value = [];
  opening.value = '';
  focus();
}
async function terminate() {
  busy.value = true;
  const id = active.value?.id;
  await ctx.run('exit', isSsh.value ? 'Connection closed.' : `Session ${id || ''} terminated.`, { quiet: true });
  busy.value = false;
}
onMounted(() => {
  const a = active.value;
  // The line that opened this session printed the banner; show it as the real terminal does.
  const last = ctx.api.history.value[0];
  if (a && last && last.ok && /(ec2-instance-connect ssh|ssm start-session)/.test(last.command)) {
    const lines = String(last.output || '').replace(/\s+$/, '').split('\n');
    if (lines.length && lines[lines.length - 1].trim() === prompt.value.trim()) lines.pop();
    opening.value = lines.join('\n');
  } else if (a) {
    opening.value = a.kind === 'ssh'
      ? `Connected to ${a.instance} as ${a.user} (${a.os}).`
      : `Starting session with SessionId: ${a.id}`;
  }
  focus();
});
</script>

<style scoped>
.st { position: absolute; inset: 0; z-index: 70; display: flex; flex-direction: column; background: #0f141a; color: #e9ebed; }
.st__bar { display: flex; align-items: center; gap: 16px; padding: 8px 16px; background: #232f3e; flex-wrap: wrap; }
.st__brand { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #fff; white-space: nowrap; }
.st__title { display: flex; flex-direction: column; font-size: 12px; line-height: 16px; min-width: 0; word-break: break-all; color: #d1d5db; }
.st__title strong { color: #fff; font-size: 13px; }
.st__spacer { flex: 1; }
.st__ghost { border: 1px solid #8c8c94; background: transparent; color: #e9ebed; font: inherit; font-weight: 700; border-radius: 20px; padding: 3px 14px; cursor: pointer; }
.st__ghost:hover:not(:disabled) { border-color: #fff; }
.st__term { border: 2px solid #ff9900; background: #ff9900; color: #0f141a; font: inherit; font-weight: 700; border-radius: 20px; padding: 4px 18px; cursor: pointer; }
.st__term:disabled, .st__ghost:disabled { opacity: .6; cursor: default; }
.st__warn { background: #fffef0; color: #855900; font-size: 13px; padding: 6px 16px; border-bottom: 2px solid #855900; }
.st__warn--info { background: #f0fbff; color: #002b66; border-bottom-color: #006ce0; }
.st__screen { flex: 1; overflow: auto; padding: 12px 16px; font-family: Monaco, Menlo, Consolas, 'Courier New', monospace; font-size: 13px; line-height: 18px; cursor: text; }
.st__out { margin: 0; white-space: pre-wrap; word-break: break-word; color: inherit; font: inherit; background: none; border: 0; padding: 0; }
.st__line { display: flex; align-items: center; }
.st__prompt { white-space: pre; color: #7ee787; }
.st__input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #e9ebed; font: inherit; padding: 0; caret-color: #e9ebed; box-shadow: none; }
</style>
