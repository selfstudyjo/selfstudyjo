<template>
  <DdModal title="Run a new container" :subtitle="image" wide @close="$emit('close')">
    <button type="button" class="rd-toggle" :aria-expanded="open" @click="open = !open">
      <DdIcon :name="open ? 'chevron-down' : 'chevron-right'" :size="14" /> Optional settings
    </button>
    <template v-if="open">
      <div class="dd-field">
        <label for="rd-name">Container name</label>
        <input id="rd-name" v-model="name" class="dd-input" :class="{ 'is-invalid': nameError }" />
        <small v-if="!nameError">A random name is generated if you do not provide one.</small>
        <span v-else class="dd-err">{{ nameError }}</span>
      </div>

      <div class="dd-field">
        <label>Ports</label>
        <small>Enter "0" to assign randomly generated host ports.</small>
        <div v-for="(p, i) in ports" :key="'p' + i" class="rd-row">
          <input v-model="p.host" class="dd-input" placeholder="Host port" :aria-label="`Host port for ${p.container || 'new port'}`"
                 :class="{ 'is-invalid': portError(p.host) }" />
          <span class="rd-sep">:</span>
          <input v-if="p.extra" v-model="p.container" class="dd-input rd-cport" placeholder="Container port" aria-label="Container port" />
          <span v-else class="rd-fixed dd-mono">{{ p.container }}/tcp</span>
          <button type="button" class="dd-icon-btn" :aria-label="p.extra ? 'Remove' : 'Clear'" @click="p.extra ? ports.splice(i, 1) : (p.host = '')">
            <DdIcon :name="p.extra ? 'minus' : 'close'" :size="14" />
          </button>
        </div>
        <button type="button" class="dd-link rd-add" @click="ports.push({ host: '', container: '', extra: true })"><DdIcon name="plus" :size="13" /> Add port</button>
      </div>

      <div class="dd-field">
        <label>Volumes</label>
        <div v-for="(v, i) in vols" :key="'v' + i" class="rd-row">
          <input v-model="v.source" class="dd-input" placeholder="Host path or volume name" aria-label="Host path or volume name" />
          <input v-model="v.target" class="dd-input" placeholder="Container path" aria-label="Container path" />
          <button type="button" class="dd-icon-btn" aria-label="Remove" @click="removeRow(vols, i)"><DdIcon name="minus" :size="14" /></button>
        </div>
        <button type="button" class="dd-link rd-add" @click="vols.push({ source: '', target: '' })"><DdIcon name="plus" :size="13" /> Add volume</button>
      </div>

      <div class="dd-field">
        <label>Environment variables</label>
        <div v-for="(e, i) in env" :key="'e' + i" class="rd-row">
          <input v-model="e.key" class="dd-input" placeholder="Variable" aria-label="Variable" :class="{ 'is-invalid': envError(e.key) }" />
          <input v-model="e.value" class="dd-input" placeholder="Value" aria-label="Value" />
          <button type="button" class="dd-icon-btn" aria-label="Remove" @click="removeRow(env, i)"><DdIcon name="minus" :size="14" /></button>
        </div>
        <button type="button" class="dd-link rd-add" @click="env.push({ key: '', value: '' })"><DdIcon name="plus" :size="13" /> Add variable</button>
      </div>
    </template>
    <p class="rd-cli dd-mono">{{ command }}</p>
    <template #footer>
      <button type="button" class="dd-btn dd-btn--ghost" @click="$emit('close')">Cancel</button>
      <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || !!invalid" @click="run">Run</button>
    </template>
  </DdModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdModal from './DdModal.vue';
import { EXPOSED, NAME_RE, runCommand } from './dd';

const props = defineProps<{ image: string; api: PortalApi; busy?: boolean }>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'ran', name: string): void }>();

const repo = props.image.replace(/:[^/:]+$/, '');
const open = ref(false);
const name = ref('');
const ports = ref((EXPOSED[repo] || []).map(container => ({ host: '', container, extra: false })));
const vols = ref<{ source: string; target: string }[]>([{ source: '', target: '' }]);
const env = ref<{ key: string; value: string }[]>([{ key: '', value: '' }]);

const nameError = computed(() => !name.value || NAME_RE.test(name.value) ? ''
  : 'Invalid container name. Only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed.');
function portError(value: string) {
  if (!value) return '';
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 65535 ? '' : 'Port must be 0-65535';
}
function envError(key: string) { return key && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? 'Invalid name' : ''; }
const invalid = computed(() => nameError.value || ports.value.some(p => portError(p.host)
  || (p.extra && p.host && !/^\d+$/.test(p.container))) || env.value.some(e => envError(e.key)));

function removeRow<T>(list: T[], index: number) { list.splice(index, 1); }

const command = computed(() => runCommand({
  image: props.image, name: name.value, ports: ports.value, volumes: vols.value, env: env.value,
}));

async function run() {
  const result = await props.api.exec(command.value, { success: name.value ? `Container ${name.value} started` : `Started a container from ${props.image}` });
  if (!result.ok) return;
  const lines = String(result.output || '').trim().split('\n');
  const id = (lines[lines.length - 1] || '').trim();
  emit('ran', name.value || id.slice(0, 12));
}
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.rd-toggle { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; padding: 4px 0; font: inherit; font-size: 14px; font-weight: 500; color: var(--dd-text); cursor: pointer; align-self: flex-start; }
.rd-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rd-row .dd-input { flex: 1 1 150px; width: auto; }
.rd-row .dd-icon-btn { flex: none; border: 1px solid var(--dd-border); border-radius: 4px; }
.rd-sep { color: var(--dd-text-2); }
.rd-fixed { color: var(--dd-text-2); }
.rd-add { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; align-self: flex-start; }
.rd-cli { margin: 0; padding: 8px 10px; background: var(--dd-hover); border-radius: 4px; color: var(--dd-text-2); word-break: break-all; }
@container sl-portal (max-width: 520px) {
  .rd-sep { display: none; }
  .rd-row { flex-wrap: nowrap; }
  .rd-row .dd-input { flex: 1 1 0; min-width: 0; }
  .rd-fixed { flex: none; font-size: 12px; }
}
</style>
