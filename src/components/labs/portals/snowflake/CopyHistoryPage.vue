<template>
  <div class="sf-page">
    <div class="sf-page-head">
      <h1 class="sf-h1">Copy History</h1>
      <span class="sf-spacer"></span>
      <button type="button" class="sf-btn" @click="loadTemplate"><SfIcon name="upload" /> Load data</button>
    </div>
    <div class="sf-grid-cards">
      <div class="sf-card sf-stat"><b>{{ fmtNum(loads.length) }}</b><span>Files</span></div>
      <div class="sf-card sf-stat"><b>{{ fmtNum(loaded) }}</b><span>Rows loaded</span></div>
      <div class="sf-card sf-stat"><b>{{ fmtNum(failed) }}</b><span>Files with errors</span></div>
      <div class="sf-card sf-stat"><b>{{ tables.length }}</b><span>Target tables</span></div>
    </div>
    <div class="sf-toolbar">
      <div class="sf-search ch__search"><SfIcon name="search" /><input v-model="filter" class="sf-input" placeholder="File or table" /></div>
      <label class="sf-chip">Status
        <select v-model="status" aria-label="Status"><option value="">All</option><option value="ok">Loaded</option><option value="run">Partially loaded</option><option value="bad">Load failed</option><option value="muted">Skipped</option></select></label>
      <label class="sf-chip">Table
        <select v-model="table" aria-label="Table"><option value="">All</option><option v-for="t in tables" :key="t" :value="t">{{ t }}</option></select></label>
    </div>
    <div class="sf-table-wrap">
      <table class="sf-table">
        <thead><tr><th>File</th><th>Table</th><th>Status</th><th class="sf-num">Rows loaded</th><th class="sf-num">Errors</th><th>First error</th><th>Pipe</th><th>Loaded</th></tr></thead>
        <tbody>
          <tr v-for="(l, i) in shown" :key="i">
            <td class="sf-mono"><span class="sf-ellipsis ch__file" :title="l.file">{{ l.file }}</span></td>
            <td class="sf-mono">{{ l.table }}</td>
            <td><span class="sf-badge" :class="'sf-badge--' + statusTone(l.status)">{{ l.status }}</span></td>
            <td class="sf-num">{{ fmtNum(l.rows_loaded) }}</td>
            <td class="sf-num">{{ fmtNum(l.errors) }}</td>
            <td class="sf-muted"><span class="sf-ellipsis" :title="l.first_error || ''">{{ l.first_error || '' }}</span></td>
            <td class="sf-muted">{{ l.pipe || '' }}</td>
            <td class="sf-muted">{{ fmtMinute(l.at) }}</td>
          </tr>
          <tr v-if="!shown.length"><td colspan="8"><div class="sf-empty"><SfIcon name="upload" /><strong>No data loads</strong><span>Files loaded with COPY INTO or a pipe appear here.</span></div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Monitoring > Copy History: the load history of every table (COPY INTO and pipes). */
import { computed, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import { useSf } from './sfContext';
import { matches } from '@/utils/portalKit';
import { fmtMinute, fmtNum, list, statusTone } from './snowflake';

const sf = useSf();
const loads = computed(() => list.loads(sf.view.value).slice().reverse());
const filter = ref('');
const status = ref('');
const table = ref('');
const tables = computed(() => [...new Set(loads.value.map(l => l.table).filter(Boolean))]);
const loaded = computed(() => loads.value.reduce((n, l) => n + (Number(l.rows_loaded) || 0), 0));
const failed = computed(() => loads.value.filter(l => (Number(l.errors) || 0) > 0 || statusTone(l.status) === 'bad').length);
const shown = computed(() => loads.value.filter(l => matches(l, filter.value, ['file', 'table'])
  && (!status.value || statusTone(l.status) === status.value) && (!table.value || l.table === table.value)));

function loadTemplate() {
  sf.openWorksheet("-- Load files from the lake stage\nLIST @RAW.SHOP.LAKE_STAGE;\n\nCOPY INTO <database>.<schema>.<table>\nFROM @RAW.SHOP.LAKE_STAGE\nPATTERN = '.*\\.csv'\nFILE_FORMAT = (FORMAT_NAME = 'RAW.SHOP.CSV_FMT')\nON_ERROR = 'CONTINUE';\n", 'Load data');
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.ch__search { width: min(300px, 100%); }
.ch__file { max-width: 300px; }
</style>
