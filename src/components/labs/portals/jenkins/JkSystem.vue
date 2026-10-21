<template>
  <form class="jk-sys" @submit.prevent="save">
    <h1 class="jk-h1">System</h1>

    <section class="jk-sys__section">
      <h2 class="jk-h2">Home directory</h2>
      <p class="jk-muted">/var/jenkins_home</p>
    </section>

    <section class="jk-sys__section">
      <div class="jk-field">
        <label class="jk-label" for="jk-sys-msg">System Message</label>
        <textarea id="jk-sys-msg" v-model="message" class="jk-textarea" rows="4"></textarea>
        <p class="jk-help">This message will be displayed at the top of the Jenkins main page. Plain text in this lab.</p>
      </div>
      <div v-if="message.trim()" class="jk-sys__preview">
        <span class="jk-muted">Preview</span>
        <div class="jk-sys__message">{{ message.trim() }}</div>
      </div>
    </section>

    <section class="jk-sys__section">
      <div class="jk-field">
        <label class="jk-label" for="jk-sys-exec"># of executors</label>
        <input id="jk-sys-exec" v-model.number="executors" class="jk-input jk-sys__num" type="number" min="0" />
        <p v-if="!(executors >= 0) || !Number.isInteger(executors)" class="jk-error">» Not a non-negative integer</p>
        <p v-else-if="executors === 0" class="jk-help">With 0 executors the built-in node runs no builds; only agents do. That is the recommended setup.</p>
      </div>
      <div class="jk-field">
        <label class="jk-label" for="jk-sys-labels">Labels</label>
        <input id="jk-sys-labels" v-model="labels" class="jk-input" type="text" autocomplete="off" />
        <p class="jk-help">Space-separated labels for the built-in node.</p>
      </div>
      <div class="jk-field">
        <label class="jk-label" for="jk-sys-usage">Usage</label>
        <select id="jk-sys-usage" class="jk-select" disabled>
          <option>Use this node as much as possible</option>
        </select>
      </div>
    </section>

    <section class="jk-sys__section">
      <h2 class="jk-h2">Jenkins Location</h2>
      <div class="jk-field">
        <label class="jk-label" for="jk-sys-url">Jenkins URL</label>
        <input id="jk-sys-url" class="jk-input" type="text" :value="ctx.base.value" readonly />
      </div>
      <div class="jk-field">
        <label class="jk-label" for="jk-sys-mail">System Admin e-mail address</label>
        <input id="jk-sys-mail" class="jk-input" type="text" value="address not configured yet &lt;nobody@nowhere&gt;" readonly />
      </div>
    </section>

    <div class="jk-bottom-bar">
      <button type="submit" class="jk-btn jk-btn--primary" :disabled="saving || !valid">Save</button>
      <button type="button" class="jk-btn" :disabled="saving || !valid || !dirty" @click="apply">Apply</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useJk } from './jkContext';
import { jcli } from './jenkinsKit';

const ctx = useJk();
const builtIn = computed(() => ctx.nodes.value.find(n => n.name === 'built-in'));
const message = ref('');
const executors = ref(2);
const labels = ref('');
const saving = ref(false);

function load() {
  message.value = ctx.systemMessage.value;
  executors.value = builtIn.value ? Number(builtIn.value.executors) : 2;
  labels.value = (builtIn.value?.labels || []).join(' ');
}
load();
watch(() => [ctx.systemMessage.value, builtIn.value?.executors, (builtIn.value?.labels || []).join(' ')], load);

const valid = computed(() => Number.isInteger(executors.value) && executors.value >= 0);
const msgChanged = computed(() => message.value.trim() !== ctx.systemMessage.value);
const execChanged = computed(() => Boolean(builtIn.value) && executors.value !== Number(builtIn.value!.executors));
const labelsChanged = computed(() => Boolean(builtIn.value)
  && labels.value.trim().split(/\s+/).filter(Boolean).join(' ') !== (builtIn.value!.labels || []).join(' '));
const dirty = computed(() => msgChanged.value || execChanged.value || labelsChanged.value);

async function apply(): Promise<boolean> {
  if (!valid.value) return false;
  saving.value = true;
  try {
    const commands: string[] = [];
    if (msgChanged.value) {
      const text = message.value.trim().replace(/\s*\n\s*/g, ' ');
      commands.push(text ? jcli(['set-system-message', text]) : jcli(['set-system-message']));
    }
    if (execChanged.value || labelsChanged.value) {
      const flags: Record<string, string> = {};
      if (execChanged.value) flags['--executors'] = String(executors.value);
      const words = ['update-node', 'built-in'];
      if (labelsChanged.value) words.push('--labels', labels.value.trim().split(/\s+/).filter(Boolean).join(' '));
      commands.push(jcli(words, flags));
    }
    for (const command of commands) {
      const result = await ctx.run(command);
      if (!result.ok) return false;
    }
    ctx.notify('success', 'Saved');
    return true;
  } finally {
    saving.value = false;
  }
}

async function save() {
  if (!dirty.value || await apply()) ctx.go({ page: 'manage' });
}
</script>

<style scoped>
.jk-sys { max-width: 860px; }
.jk-sys__section { padding-bottom: 8px; border-bottom: 1px solid var(--jk-border); margin-bottom: 16px; }
.jk-sys__num { max-width: 140px; }
.jk-sys__preview { margin-top: -4px; }
.jk-sys__message { margin-top: 4px; padding: 12px 16px; border-radius: 10px; background: var(--jk-table-bg); white-space: pre-wrap; }
</style>
