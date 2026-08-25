<template>
  <div class="ns-ai">
    <header class="ns-ai-head">
      <span class="ns-ai-avatar"><DeviceIcon name="sparkles" :size="17" /></span>
      <div>
        <h4>{{ $t('AI Network Tutor') }}</h4>
        <p>{{ ready ? 'Connected to Self Study AI · sees your live topology' : 'Connecting to the AI service…' }}</p>
      </div>
      <button class="ns-icon-btn" :title="$t('Clear the conversation')" @click="clearChat"><DeviceIcon name="trash" :size="14" /></button>
    </header>

    <div class="ns-ai-quick">
      <button
        v-for="q in AI_QUICK_PROMPTS" :key="q.label"
        class="ns-quick-chip" :class="q.kind"
        :title="q.prompt"
        @click="runQuick(q)"
      >
        <DeviceIcon :name="q.icon" :size="12" /> {{ q.label }}
      </button>
    </div>

    <div ref="scrollEl" class="ns-ai-thread">
      <div v-if="!messages.length" class="ns-ai-welcome">
        <p><strong>{{ $t('Ask anything about networking') }}</strong> {{ $t('— I can see every device, address, VLAN, route and ACL on your canvas, plus the last simulation run.') }}</p>
        <ul>
          <li>{{ $t('“Why can PC-A not reach the server?”') }}</li>
          <li>{{ $t('“Build me a campus network with redundant uplinks.”') }}</li>
          <li>{{ $t('“Explain what my trunk is actually doing, using my devices.”') }}</li>
          <li>{{ $t('“Review my design like a senior engineer would.”') }}</li>
        </ul>
      </div>

      <div v-for="(m, i) in messages" :key="i" class="ns-ai-msg" :class="m.role">
        <div class="ns-ai-role">{{ m.role === 'user' ? 'You' : 'Tutor' }}</div>
        <div v-if="m.role === 'assistant'" class="ns-ai-content" v-html="renderMd(m.content)"></div>
        <div v-else class="ns-ai-content plain">{{ m.content }}</div>
        <div v-if="m.spec" class="ns-ai-spec">
          <span><strong>{{ m.spec.devices.length }}</strong> {{ $t('devices ·') }} <strong>{{ m.spec.links?.length || 0 }}</strong> {{ $t('links ready to build') }}</span>
          <div class="ns-btn-row tight">
            <button class="ns-btn primary sm" @click="applySpec(m.spec, 'replace')">{{ $t('Build on canvas') }}</button>
            <button class="ns-btn ghost sm" @click="applySpec(m.spec, 'merge')">{{ $t('Add to existing') }}</button>
          </div>
        </div>
      </div>

      <div v-if="busy" class="ns-ai-msg assistant">
        <div class="ns-ai-role">{{ $t('Tutor') }}</div>
        <div class="ns-ai-typing"><span></span><span></span><span></span></div>
      </div>
    </div>

    <div class="ns-ai-input">
      <div class="ns-ai-mode">
        <button :class="['ns-mode-btn', { active: mode === 'ask' }]" @click="mode = 'ask'" :title="$t('Explain and teach')">{{ $t('Teach') }}</button>
        <button :class="['ns-mode-btn', { active: mode === 'generate' }]" @click="mode = 'generate'" :title="$t('Generate a topology')">{{ $t('Build') }}</button>
        <button :class="['ns-mode-btn', { active: mode === 'review' }]" @click="mode = 'review'" :title="$t('Design review')">{{ $t('Review') }}</button>
        <button :class="['ns-mode-btn', { active: mode === 'fix' }]" @click="mode = 'fix'" :title="$t('Troubleshoot a symptom')">{{ $t('Fix') }}</button>
      </div>
      <textarea
        v-model="draft"
        :placeholder="placeholder"
        rows="2"
        @keydown.enter.exact.prevent="send"
      ></textarea>
      <button class="ns-btn primary" :disabled="busy || (!draft.trim() && mode !== 'review')" @click="send">
        <DeviceIcon name="chevron" :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import DeviceIcon from './DeviceIcon.vue';
import { useNetSimStore } from '@/store/netsim';
import { netsimAi, AI_QUICK_PROMPTS } from '@/services/netsim-ai.service';
import type { AiTopologySpec } from '@/netsim/topology';
import { marked } from 'marked';

interface ThreadMessage {
    role: 'user' | 'assistant';
    content: string;
    spec?: AiTopologySpec;
}

const store = useNetSimStore();
const messages = ref<ThreadMessage[]>([]);
const draft = ref('');
const busy = ref(false);
const ready = ref(false);
const mode = ref<'ask' | 'generate' | 'review' | 'fix'>('ask');
const scrollEl = ref<HTMLElement | null>(null);

const placeholder = computed(() => {
    switch (mode.value) {
        case 'generate': return 'Describe the network you want built — "a branch office with two VLANs, a router doing NAT, and Wi-Fi"…';
        case 'review': return 'Press send for a full design review, or add anything you want me to focus on…';
        case 'fix': return 'Describe the symptom — "PC-A cannot reach the web server but can ping its gateway"…';
        default: return 'Ask about anything on your canvas, or any networking concept…';
    }
});

onMounted(async () => {
    ready.value = await netsimAi.initialize();
    // Restore any conversation stored with the project.
    const hist = store.project?.aiHistory || [];
    messages.value = hist.map(h => ({ role: h.role, content: h.content }));
    scrollDown();
});

watch(() => store.project?.id, () => {
    messages.value = (store.project?.aiHistory || []).map(h => ({ role: h.role, content: h.content }));
});

function renderMd(text: string): string {
    try { return marked.parse(text) as string; } catch { return text; }
}

function scrollDown() {
    nextTick(() => { if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight; });
}

function persist() {
    if (!store.project) return;
    store.project.aiHistory = messages.value.slice(-40).map(m => ({
        role: m.role, content: m.content, at: new Date().toISOString(),
    }));
    store.markDirty();
}

function push(role: 'user' | 'assistant', content: string, spec?: AiTopologySpec) {
    messages.value.push({ role, content, spec });
    persist();
    scrollDown();
}

async function send() {
    const text = draft.value.trim();
    if (mode.value !== 'review' && !text) return;
    if (busy.value) return;

    draft.value = '';
    busy.value = true;

    try {
        if (mode.value === 'generate') {
            push('user', text);
            const res = await netsimAi.generate(text, { existing: store.topology });
            if (res.ok && res.data) {
                const spec = res.data;
                const summary = [
                    `**${spec.name || 'Generated network'}** — ${spec.description || ''}`,
                    '',
                    `${spec.devices.length} devices, ${spec.links?.length || 0} links.`,
                    '',
                    ...(spec.notes?.length ? ['**Design notes**', ...spec.notes.map(n => `- ${n}`), ''] : []),
                    '**Devices**',
                    ...spec.devices.map(d => {
                        const addrs = (d.interfaces || []).filter(i => i.ip).map(i => `${i.name || 'port'} ${i.ip}/${i.mask || '24'}`).join(', ');
                        return `- \`${d.hostname}\` (${d.type})${addrs ? ` — ${addrs}` : ''}${d.notes ? ` · ${d.notes}` : ''}`;
                    }),
                ].join('\n');
                push('assistant', summary, spec);
            } else {
                push('assistant', `I could not build that. ${res.error || ''}\n\nTry describing it more concretely — how many sites, which VLANs, what addressing you want.`);
            }
        } else if (mode.value === 'review') {
            push('user', text || 'Review my design.');
            store.validate();
            const res = await netsimAi.review(store.topology, store.issues);
            push('assistant', res.ok && res.data ? res.data : `The review failed: ${res.error || 'unknown error'}`);
        } else if (mode.value === 'fix') {
            push('user', text);
            store.validate();
            const res = await netsimAi.troubleshoot(text, {
                topology: store.topology,
                issues: store.issues,
                events: store.events,
                lastTrace: store.activeTrace,
            });
            push('assistant', res.ok && res.data ? res.data : `I could not diagnose that: ${res.error || 'unknown error'}`);
        } else {
            push('user', text);
            const res = await netsimAi.ask(text, {
                topology: store.topology,
                issues: store.issues,
                selectedDevice: store.selectedDevice,
                history: messages.value.slice(-8).map(m => ({ role: m.role, content: m.content })),
            });
            push('assistant', res.ok && res.data ? res.data : `I could not answer that: ${res.error || 'unknown error'}`);
        }
    } finally {
        busy.value = false;
        scrollDown();
    }
}

async function runQuick(q: typeof AI_QUICK_PROMPTS[number]) {
    mode.value = q.kind === 'generate' ? 'generate' : 'ask';
    draft.value = q.prompt;
    await send();
}

function applySpec(spec: AiTopologySpec, how: 'replace' | 'merge') {
    if (how === 'replace' && store.topology.devices.length) {
        const proceed = window.confirm(
            `Replace the ${store.topology.devices.length} device(s) currently on the canvas with this generated network?\n\nYou can undo this with Ctrl+Z.`
        );
        if (!proceed) return;
    }
    store.applyAiSpec(spec, how);
}

function clearChat() {
    messages.value = [];
    persist();
}
</script>
