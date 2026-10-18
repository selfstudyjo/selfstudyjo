<template>
  <AmbModal :title="selected ? selected.context : `${running} Background Operations Running`" ok-text=""
            cancel-text="OK" wide @close="$emit('close')">
    <template v-if="!selected">
      <div v-if="!requests.length" class="empty">No operations to display</div>
      <div v-else class="table-wrap"><table class="table ops">
        <thead><tr><th>Operations</th><th>Start Time</th><th>Duration</th><th>Show</th></tr></thead>
        <tbody>
          <tr v-for="req in requests" :key="req.id">
            <td>
              <a href="#" @click.prevent="selected = req">
                <AmbIcon :name="req.status === 'FAILED' ? 'down' : 'ok'" :class="req.status === 'FAILED' ? 'health-down' : 'health-ok'" />
                {{ req.context }}
              </a>
              <div class="ops__bar" :class="{ 'is-failed': req.status === 'FAILED' }"><i :style="{ width: req.progress + '%' }"></i></div>
            </td>
            <td>{{ stamp(req.start) }}</td>
            <td>{{ req.status === 'FAILED' ? 'Failed' : '0.10 secs' }}</td>
            <td>{{ req.progress }}%</td>
          </tr>
        </tbody>
      </table></div>
    </template>
    <template v-else>
      <p><a href="#" @click.prevent="selected = null">« All operations</a></p>
      <p><strong>Status:</strong> {{ selected.status }} · <strong>User:</strong> {{ selected.user }} ·
        <strong>Command:</strong> {{ selected.command }}</p>
      <pre class="ops__log">{{ (selected.output || []).join('\n') || 'Command completed successfully!' }}</pre>
    </template>
  </AmbModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import { shortStamp } from './ambari';
import AmbIcon from './AmbIcon.vue';
import AmbModal from './AmbModal.vue';

const props = defineProps<{ view: Record<string, any> }>();
defineEmits<{ (event: 'close'): void }>();

const selected = ref<Record<string, any> | null>(null);
const requests = computed(() => rows(props.view, 'ambari.requests'));
const running = computed(() => requests.value.filter(r => r.status === 'IN_PROGRESS').length);
const stamp = shortStamp;
</script>

<style scoped>
.ops a { display: inline-flex; align-items: center; gap: 6px; }
.ops__bar { height: 6px; background: #eee; margin-top: 6px; max-width: 360px; }
.ops__bar i { display: block; height: 100%; background: #1EB475; }
.ops td:first-child { min-width: 220px; }
.ops__bar.is-failed i { background: #EF6162; }
.ops__log { background: #f5f5f5; border: 1px solid #ccc; padding: 10px; font-size: 12px; white-space: pre-wrap; max-height: 300px; overflow: auto; }
</style>
