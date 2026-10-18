<template>
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Number</th><th>Short description</th><th>Priority</th><th>State</th><th>Assigned to</th><th>SLA</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.number">
          <td><button type="button" class="link" @click="$emit('open', r)">{{ r.number }}</button></td>
          <td class="short">{{ r.short }}</td>
          <td><i class="dot" :class="'dot--p' + r.priority"></i>{{ PRIORITY_LABEL[r.priority] }}</td>
          <td>{{ r.state }}</td>
          <td>{{ personName(model, r.assigned_to) || (r.group ? '(' + r.group + ')' : '') }}</td>
          <td><SlaBar :sla="worstSla(r)" /></td>
        </tr>
      </tbody>
    </table>
    <div v-if="!rows.length" class="empty">Nothing here. You are all caught up.</div>
  </div>
</template>

<script setup lang="ts">
/** The workspace's compact record list (My work, List view). */
import SlaBar from './SlaBar.vue';
import { PRIORITY_LABEL, personName, worstSla, type Incident, type Model } from './snow';

defineProps<{ rows: Incident[]; model: Model }>();
defineEmits<{ (event: 'open', row: Incident): void }>();
</script>

<style scoped src="./sn.css"></style>
<style scoped>.short { min-width: 12rem; }</style>
