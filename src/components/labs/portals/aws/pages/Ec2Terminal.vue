<template>
  <div class="et" :class="'et--' + via">
    <!-- Session Manager draws its session bar on top, with Terminate -->
    <header v-if="via === 'ssm'" class="et__bar et__bar--top">
      <span><strong>Session ID:</strong> <span class="et__mono">{{ sessionId || '…' }}</span></span>
      <span><strong>Instance ID:</strong> <span class="et__mono">{{ id }}</span></span>
      <button type="button" class="et__terminate" :disabled="closing" @click="terminate">Terminate</button>
    </header>

    <div ref="screen" class="et__screen" role="log" aria-live="polite" tabindex="-1" @click="focusInput">
      <div v-for="(line, index) in lines" :key="index" class="et__line" :class="'et__line--' + line.kind">{{ line.text }}</div>
      <div v-if="!closed" class="et__input-row">
        <span class="et__prompt">{{ prompt }}</span>
        <input ref="input" v-model="draft" class="et__input" :disabled="busy || !prompt" spellcheck="false"
               autocomplete="off" autocapitalize="off" aria-label="Terminal input"
               @keydown="onKey" />
        <span v-if="busy" class="et__cursor" aria-hidden="true" />
      </div>
      <div v-else class="et__closed">
        <div>{{ via === 'ssm' ? 'Session terminated.' : 'Connection closed.' }}</div>
        <div class="et__closed-actions">
          <button type="button" class="et__btn" @click="reconnect">Reconnect</button>
          <button type="button" class="et__btn" @click="ctx.to('ec2', 'instance', { id })">Back to instance</button>
        </div>
      </div>
    </div>

    <!-- EC2 Instance Connect draws the instance strip underneath -->
    <footer v-if="via === 'eic'" class="et__bar et__bar--bottom">
      <span class="et__mono">{{ id }}<span v-if="inst?.name"> ({{ inst.name }})</span></span>
      <span>PublicIPs: <span class="et__mono">{{ inst?.public_ip || '–' }}</span></span>
      <span>PrivateIPs: <span class="et__mono">{{ inst?.private_ip || '–' }}</span></span>
      <button type="button" class="et__btn et__btn--small" @click="disconnect">Disconnect</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
/**
 * The browser terminal behind "Connect": EC2 Instance Connect or Session
 * Manager, into the simulated instance.
 *
 * Opening the session runs the real command (`aws ec2-instance-connect ssh`,
 * `aws ssm start-session`) and it appears in the equivalent-CLI drawer. The
 * lines typed afterwards are keystrokes inside that session, not CLI calls a
 * student made, so they are carried unlogged: through
 * `aws ec2-instance-connect ssh ... -- <line>` and
 * `aws ssm start-session --document-name AWS-StartInteractiveCommand`, which
 * the engine runs against the instance's own shell.
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { cli, rows, type PortalResult } from '@/utils/portalKit';
import { useAws } from '../ctx';

interface Line { text: string; kind: 'out' | 'err' | 'cmd' | 'info' }
interface SessionData { prompt?: string; closed?: boolean; clear?: boolean; id?: string }

const ctx = useAws();
const id = computed(() => ctx.route.value.params?.id || '');
const via = computed(() => (ctx.route.value.params?.via === 'ssm' ? 'ssm' : 'eic'));
const user = computed(() => ctx.route.value.params?.user || 'ec2-user');
const inst = computed(() => rows<any>(ctx.view.value, 'ec2.instances').find(i => i.id === id.value) || null);

const lines = ref<Line[]>([]);
const draft = ref('');
const prompt = ref('');
const busy = ref(false);
const closed = ref(false);
const closing = ref(false);
const sessionId = ref('');
const history = ref<string[]>([]);
const cursor = ref(-1);
const screen = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);

const MAX_LINES = 600;

function push(text: string, kind: Line['kind']) {
  if (!text) return;
  for (const part of text.replace(/\r\n/g, '\n').split('\n')) lines.value.push({ text: part, kind });
  if (lines.value.length > MAX_LINES) lines.value.splice(0, lines.value.length - MAX_LINES);
}
async function scrollDown() {
  await nextTick();
  if (screen.value) screen.value.scrollTop = screen.value.scrollHeight;
  input.value?.focus();
}
function focusInput() {
  if (!window.getSelection()?.toString()) input.value?.focus();
}

function sessionOf(result: PortalResult): SessionData {
  const data = result.data as { session?: SessionData } | undefined;
  return data?.session || {};
}

function apply(result: PortalResult) {
  const session = sessionOf(result);
  if (session.clear) lines.value = [];
  push(String(result.output || ''), 'out');
  if (!result.ok || result.error) push(String(result.error || ''), 'err');
  if (session.id) sessionId.value = session.id;
  if (session.closed) {
    closed.value = true;
    prompt.value = '';
  } else if (session.prompt) {
    prompt.value = session.prompt;
  } else if (!result.ok && !prompt.value) {
    // The session never opened (TargetNotConnected, a timeout on port 22 ...).
    closed.value = true;
  }
}

function openCommand(): string {
  if (via.value === 'ssm') return cli(['aws', 'ssm', 'start-session'], { '--target': id.value });
  return cli(['aws', 'ec2-instance-connect', 'ssh'], {
    '--instance-id': id.value, '--os-user': user.value, '--connection-type': 'direct',
  });
}
function lineCommand(line: string): string {
  if (via.value === 'ssm') {
    return cli(['aws', 'ssm', 'start-session'], {
      '--target': id.value, '--document-name': 'AWS-StartInteractiveCommand', '--parameters': `command=${line}`,
    });
  }
  return cli(['aws', 'ec2-instance-connect', 'ssh', '--instance-id', id.value, '--os-user', user.value,
    '--connection-type', 'direct', '--', line]);
}

async function open() {
  lines.value = [];
  closed.value = false;
  prompt.value = '';
  busy.value = true;
  if (via.value === 'eic') push(`Connecting to ${id.value} as ${user.value} using EC2 Instance Connect...`, 'info');
  const result = await ctx.run(openCommand(), '', { quiet: true });
  busy.value = false;
  if (via.value === 'eic') lines.value = [];
  apply(result);
  if (!result.ok) {
    push(via.value === 'ssm'
      ? 'Failed to start the session. Check that the SSM Agent is online and the instance has an IAM role with AmazonSSMManagedInstanceCore.'
      : 'Failed to connect to your instance. Error establishing SSH connection to your instance. Try again later.', 'info');
  }
  scrollDown();
}

async function submit() {
  const line = draft.value;
  draft.value = '';
  cursor.value = -1;
  push(prompt.value + line, 'cmd');
  const trimmed = line.trim();
  if (!trimmed) { scrollDown(); return; }
  if (history.value[history.value.length - 1] !== line) history.value.push(line);
  if (history.value.length > 100) history.value.shift();
  if (trimmed === 'clear') { lines.value = []; scrollDown(); return; }
  if (via.value === 'ssm' && (trimmed === 'exit' || trimmed === 'logout') && prompt.value.startsWith('sh-')) {
    await terminate();
    return;
  }
  busy.value = true;
  const result = await ctx.run(lineCommand(line), '', { quiet: true, unlogged: true });
  busy.value = false;
  apply(result);
  scrollDown();
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter') { event.preventDefault(); submit(); return; }
  if (event.key === 'ArrowUp' && history.value.length) {
    event.preventDefault();
    cursor.value = cursor.value < 0 ? history.value.length - 1 : Math.max(0, cursor.value - 1);
    draft.value = history.value[cursor.value];
    return;
  }
  if (event.key === 'ArrowDown' && cursor.value >= 0) {
    event.preventDefault();
    cursor.value += 1;
    if (cursor.value >= history.value.length) { cursor.value = -1; draft.value = ''; } else draft.value = history.value[cursor.value];
    return;
  }
  if (event.key === 'Tab') { event.preventDefault(); return; }
  if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) { event.preventDefault(); lines.value = []; return; }
  if (event.ctrlKey && (event.key === 'c' || event.key === 'C') && !window.getSelection()?.toString()) {
    event.preventDefault();
    push(prompt.value + draft.value + '^C', 'cmd');
    draft.value = '';
    scrollDown();
  }
  if (event.ctrlKey && (event.key === 'd' || event.key === 'D') && !draft.value) {
    event.preventDefault();
    draft.value = 'exit';
    submit();
  }
}

async function terminate() {
  closing.value = true;
  if (sessionId.value) {
    await ctx.run(cli(['aws', 'ssm', 'terminate-session'], { '--session-id': sessionId.value }), '', { quiet: true });
  }
  closing.value = false;
  closed.value = true;
  prompt.value = '';
  push(`Exiting session with sessionId: ${sessionId.value || '(none)'}.`, 'info');
  scrollDown();
}
function disconnect() {
  closed.value = true;
  prompt.value = '';
  push(`Connection to ${inst.value?.public_ip || id.value} closed.`, 'info');
}
function reconnect() {
  sessionId.value = '';
  open();
}

onMounted(open);
</script>

<style scoped>
.et { display: flex; flex-direction: column; height: max(420px, calc(100vh - 260px)); min-height: 420px; border-radius: 8px; overflow: hidden; background: #000; border: 1px solid #232f3e; }
.et__screen { flex: 1; min-height: 0; overflow: auto; padding: 8px 10px; color: #f2f3f3; font-family: Monaco, Menlo, Consolas, 'Courier New', monospace; font-size: 13px; line-height: 18px; cursor: text; outline: none; }
.et--ssm .et__screen { background: #000; }
.et__line { white-space: pre-wrap; word-break: break-word; min-height: 18px; }
.et__line--err { color: #ff8a80; }
.et__line--info { color: #9ba7b6; }
.et__line--cmd { color: #f2f3f3; }
.et__input-row { display: flex; align-items: baseline; flex-wrap: wrap; }
.et__prompt { white-space: pre; color: #f2f3f3; }
.et__input { flex: 1 1 120px; min-width: 40px; border: 0; outline: none; background: transparent; color: #f2f3f3; font: inherit; padding: 0; caret-color: #f2f3f3; }
.et__input:disabled { color: #9ba7b6; }
.et__cursor { display: inline-block; width: 8px; height: 14px; background: #9ba7b6; animation: et-blink 1s steps(1) infinite; }
@keyframes et-blink { 50% { opacity: 0; } }
.et__closed { color: #9ba7b6; margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.et__closed-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.et__bar { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px; padding: 6px 12px; background: #232f3e; color: #fff; font-size: 13px; }
.et__bar--top { border-bottom: 1px solid #000; }
.et__bar--bottom { border-top: 1px solid #000; }
.et__mono { font-family: Monaco, Menlo, Consolas, 'Courier New', monospace; font-size: 12px; }
.et__terminate { margin-left: auto; border: 1px solid #fff; border-radius: 16px; background: transparent; color: #fff; font: inherit; font-weight: 700; padding: 2px 14px; cursor: pointer; }
.et__terminate:hover:not(:disabled) { background: #fff; color: #232f3e; }
.et__btn { border: 1px solid #9ba7b6; border-radius: 16px; background: transparent; color: #f2f3f3; font: inherit; font-size: 13px; padding: 3px 14px; cursor: pointer; }
.et__btn:hover { border-color: #fff; color: #fff; }
.et__btn--small { margin-left: auto; padding: 1px 12px; }
@container sl-portal (max-width: 560px) {
  .et__screen { font-size: 12px; }
  .et__bar { gap: 4px 12px; }
}
</style>
