<template>
  <div class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1 class="dh-title">Incidents</h1>
        <p class="dh-subtitle">Data incidents raised by monitors across every asset. Acknowledge one to show it is being worked on; resolve it with a note.</p>
      </div>
      <button type="button" class="dh-btn" :disabled="dh.busy.value || !dh.monitors.value.length" @click="runAll"><DhIcon name="refresh" /> Re-evaluate monitors</button>
    </div>
    <IncidentsList />
  </div>
</template>

<script setup lang="ts">
import DhIcon from './DhIcon.vue';
import IncidentsList from './IncidentsList.vue';
import { dh as cmd, useDh } from './dhContext';

const dh = useDh();

async function runAll() {
  await dh.run(cmd(['monitor', 'run']), { success: 'Monitors evaluated' });
}
</script>

<style scoped src="./dh.css"></style>
