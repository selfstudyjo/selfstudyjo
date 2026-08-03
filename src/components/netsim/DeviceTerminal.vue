<template>
  <div class="ns-terminal">
    <header class="ns-terminal-head">
      <select class="ns-trace-select" :value="deviceId" @change="emit('change-device', ($event.target as HTMLSelectElement).value)">
        <option v-for="d in store.topology.devices" :key="d.id" :value="d.id">
          {{ d.hostname }} — {{ typeName(d.typeId) }}
        </option>
      </select>
      <span class="ns-terminal-mode">{{ modeLabel }}</span>
      <div class="ns-terminal-actions">
        <button class="ns-icon-btn" title="Clear the screen" @click="store.clearCli(deviceId)"><DeviceIcon name="trash" :size="13" /></button>
        <button class="ns-icon-btn" title="Copy the whole session" @click="copyAll"><DeviceIcon name="copy" :size="13" /></button>
      </div>
    </header>

    <div ref="outEl" class="ns-terminal-out" :style="{ fontSize: `${fontSize}px` }" @click="focusInput">
      <div v-for="l in lines" :key="l.id" class="ns-cli-line" :class="l.kind">{{ l.text }}</div>
    </div>

    <div class="ns-terminal-input">
      <span class="ns-terminal-prompt">{{ promptText }}</span>
      <input
        ref="inputEl"
        v-model="command"
        type="text"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        :placeholder="placeholder"
        @keydown.enter.prevent="send"
        @keydown.up.prevent="history(-1)"
        @keydown.down.prevent="history(1)"
        @keydown.tab.prevent="complete"
      />
    </div>

    <div v-if="suggestions.length" class="ns-terminal-suggest">
      <button v-for="s in suggestions" :key="s" @click="applySuggestion(s)">{{ s }}</button>
    </div>

    <div class="ns-terminal-hints">
      <button v-for="h in quickHints" :key="h" class="ns-hint-chip" @click="command = h; focusInput()">{{ h }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import DeviceIcon from './DeviceIcon.vue';
import { useNetSimStore } from '@/store/netsim';
import { completions, isHostShell } from '@/netsim/cli';
import { getDeviceType } from '@/netsim/devices';

const props = defineProps<{ deviceId: string }>();
const emit = defineEmits<{ (e: 'change-device', id: string): void }>();

const store = useNetSimStore();
const command = ref('');
const outEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const fontSize = computed(() => store.profile?.preferences.cliFont || 13);

const device = computed(() => store.deviceById.get(props.deviceId));
const session = computed(() => store.getCliSession(props.deviceId));
const lines = computed(() => session.value.lines);
const promptText = computed(() => store.cliPromptFor(props.deviceId));

const modeLabel = computed(() => {
    const d = device.value;
    if (!d) return '';
    if (isHostShell(d)) return 'host shell';
    const m = session.value.mode;
    return m === 'user' ? 'user EXEC'
        : m === 'privileged' ? 'privileged EXEC'
        : m === 'config' ? 'global config'
        : m.replace('config-', 'config: ');
});

const placeholder = computed(() => {
    const d = device.value;
    if (!d) return '';
    if (isHostShell(d)) return 'try: ipconfig /all · ping <ip> · nslookup <name> · curl http://<host> · help';
    if (session.value.mode === 'user') return 'type "enable" then "?" for the command list';
    return 'type "?" for help at this level';
});

const quickHints = computed(() => {
    const d = device.value;
    if (!d) return [];
    if (isHostShell(d)) return ['ipconfig /all', 'ping 8.8.8.8', 'arp -a', 'route print', 'netstat', 'help'];
    switch (session.value.mode) {
        case 'user': return ['enable', 'show version'];
        case 'privileged': return ['show ip interface brief', 'show ip route', 'show mac address-table', 'show vlan brief', 'show spanning-tree', 'show running-config', 'configure terminal'];
        case 'config': return ['interface gi0/0', 'vlan 10', 'ip route 0.0.0.0 0.0.0.0 ', 'router ospf 1', 'ip dhcp pool LAN', 'exit'];
        case 'config-if': return ['ip address 10.0.1.1 255.255.255.0', 'no shutdown', 'switchport mode access', 'switchport access vlan 10', 'switchport mode trunk', 'exit'];
        default: return ['exit', 'end'];
    }
});

const suggestions = computed(() => {
    const d = device.value;
    if (!d || command.value.trim().length < 2) return [];
    return completions(session.value, d, command.value).filter(c => c !== command.value);
});

function typeName(typeId: string): string {
    return getDeviceType(typeId)?.name || typeId;
}

function send() {
    const cmd = command.value;
    if (!cmd.trim()) return;
    store.runCli(props.deviceId, cmd);
    command.value = '';
    scrollToBottom();
}

function history(delta: number) {
    const s = session.value;
    if (!s.history.length) return;
    s.historyIndex = Math.max(0, Math.min(s.history.length, s.historyIndex + delta));
    command.value = s.history[s.historyIndex] ?? '';
}

function complete() {
    const c = suggestions.value[0];
    if (c) command.value = c;
}

function applySuggestion(s: string) {
    command.value = s;
    focusInput();
}

function focusInput() {
    inputEl.value?.focus();
}

function scrollToBottom() {
    nextTick(() => {
        if (outEl.value) outEl.value.scrollTop = outEl.value.scrollHeight;
    });
}

async function copyAll() {
    try {
        await navigator.clipboard.writeText(lines.value.map(l => l.text).join('\n'));
        store.toast('success', 'Session copied to the clipboard');
    } catch {
        store.toast('error', 'Could not copy');
    }
}

watch(lines, scrollToBottom, { deep: true });
watch(() => props.deviceId, () => { command.value = ''; scrollToBottom(); focusInput(); });
onMounted(() => { scrollToBottom(); focusInput(); });
</script>
