<template>
  <!-- One RDD: storage level, its distribution over executors, its partitions. -->
  <section v-if="rddId !== null && rdd">
    <h3 class="spk-h3">RDD Storage Info for In-memory table {{ rdd.name }}</h3>
    <ul class="list-unstyled">
      <li><strong>Storage Level:</strong> {{ rdd.storage_level }}</li>
      <li><strong>Cached Partitions:</strong> {{ rdd.cached_partitions }}</li>
      <li><strong>Total Partitions:</strong> {{ rdd.partitions || rdd.cached_partitions }}</li>
      <li><strong>Memory Size:</strong> {{ bytes(memory) }}</li>
      <li><strong>Disk Size:</strong> {{ bytes(disk) }}</li>
    </ul>
    <h4 class="spk-h4" @click="openDist = !openDist"><span :class="openDist ? 'arrow-open' : 'arrow-closed'"></span>
      <a href="#" @click.prevent>Data Distribution on {{ distribution.length }} Executors</a></h4>
    <div v-if="openDist" class="table-wrap">
      <table class="table table-bordered table-sm">
        <thead><tr><th>Host</th><th>On Heap Memory Usage</th><th>Off Heap Memory Usage</th><th>Disk Usage</th></tr></thead>
        <tbody>
          <tr v-for="d in distribution" :key="d.host">
            <td>{{ d.host }}</td>
            <td>{{ bytes(d.memory) }} ({{ bytes(Math.max(0, d.max - d.memory)) }} Remaining)</td>
            <td>0.0 B (0.0 B Remaining)</td>
            <td>{{ bytes(d.disk) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <h4 class="spk-h4" @click="openParts = !openParts"><span :class="openParts ? 'arrow-open' : 'arrow-closed'"></span>
      <a href="#" @click.prevent>{{ partitions.length }} Partitions</a></h4>
    <div v-if="openParts" class="table-wrap">
      <table class="table table-bordered table-sm">
        <thead><tr><th>Block Name</th><th>Storage Level</th><th>Size in Memory</th><th>Size on Disk</th><th>Executors</th></tr></thead>
        <tbody>
          <tr v-for="p in partitions" :key="p.block">
            <td>{{ p.block }}</td><td>{{ p.level }}</td><td>{{ bytes(p.memory) }}</td><td>{{ bytes(p.disk) }}</td><td>{{ p.host }}</td>
          </tr>
          <tr v-if="!partitions.length"><td colspan="5" class="spk-empty">No partition is materialised yet: a LAZY cache fills on its first read.</td></tr>
        </tbody>
      </table>
    </div>
    <p><a href="#" @click.prevent="$emit('navigate', { page: 'storage', app: app.id })">Back to Storage</a></p>
  </section>
  <p v-else-if="rddId !== null">No information to display for RDD {{ rddId }}</p>

  <section v-else>
    <h3 class="spk-h3">Storage</h3>
    <h4 class="spk-h4" @click="openList = !openList"><span :class="openList ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>RDDs</a></h4>
    <div v-if="openList" class="table-wrap"><table class="table table-bordered table-sm">
      <thead><tr><th>ID</th><th>RDD Name</th><th>Storage Level</th><th>Cached Partitions</th><th>Fraction Cached</th><th>Size in Memory</th><th>Size on Disk</th></tr></thead>
      <tbody>
        <tr v-for="(r, i) in storage" :key="r.name">
          <td>{{ i + 1 }}</td>
          <td><a href="#" @click.prevent="$emit('navigate', { page: 'rdd', app: app.id, id: i + 1 })">In-memory table {{ r.name }}</a></td>
          <td>{{ r.storage_level }}</td>
          <td>{{ r.cached_partitions }}</td><td>{{ Math.round(Number(r.fraction_cached || 0) * 100) }}%</td>
          <td>{{ bytes(Number(r.memory_bytes || 0)) }}</td><td>{{ bytes(Number(r.disk_bytes || 0)) }}</td>
        </tr>
        <tr v-if="!storage.length"><td colspan="7" class="spk-empty">No RDDs have been persisted. Call <code>df.cache()</code> or <code>CACHE TABLE t</code> to see one here.</td></tr>
      </tbody>
    </table></div>

    <!-- The lab's addition, labelled as such: persist / unpersist from here. -->
    <div class="sto__lab">
      <h4 class="spk-h4" @click="openLab = !openLab"><span :class="openLab ? 'arrow-open' : 'arrow-closed'"></span>
        <a href="#" @click.prevent>Cache or uncache a table</a></h4>
      <div v-if="openLab" class="sto__panel">
        <p class="spk-muted">Not part of the real Spark UI: a lab shortcut that runs the statement you would type,
          <code>spark-sql -e "CACHE TABLE …"</code>, so the Storage tab has something to show.</p>
        <p v-if="!catalyst" class="alert-warning sto__note">This lab's Spark model does not track cached data, so
          CACHE TABLE has nothing to show here.</p>
        <template v-else>
          <div class="sto__row">
            <select v-model="table" class="form-control sto__select" aria-label="Table to cache">
              <option value="" disabled>Choose a table</option>
              <option v-for="t in tables" :key="t" :value="t">{{ t }}</option>
            </select>
            <label class="sto__lazy"><input v-model="lazy" type="checkbox" /> LAZY</label>
            <button type="button" class="btn btn-primary" :disabled="busy || !table" @click="cacheTable">Cache</button>
          </div>
          <p class="hist__cmd"><code>{{ cacheCommand || ' ' }}</code></p>
          <div v-if="storage.length" class="sto__row">
            <select v-model="uncache" class="form-control sto__select" aria-label="Table to uncache">
              <option value="" disabled>Choose a cached table</option>
              <option v-for="r in storage" :key="r.name" :value="r.name">{{ r.name }}</option>
            </select>
            <button type="button" class="btn btn-secondary" :disabled="busy || !uncache" @click="confirmUncache = true">Uncache</button>
          </div>
          <div v-if="confirmUncache" class="sto__confirm" role="alertdialog" aria-label="Confirm uncache">
            <span>Remove <strong>{{ uncache }}</strong> from the cache? Later reads go back to the source files.</span>
            <button type="button" class="btn btn-danger" :disabled="busy" @click="uncacheTable">Uncache</button>
            <button type="button" class="btn btn-secondary" @click="confirmUncache = false">Cancel</button>
          </div>
          <div v-if="error" class="alert-danger sto__note">{{ error }}</div>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/** The Storage tab and its RDD drill-down page, plus a labelled lab shortcut. */
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import { cli, errorText, pick, rows } from '@/utils/portalKit';
import { bytes, executorsFor, unit, type SparkApp } from './spark';

const props = defineProps<{ app: SparkApp; view: Record<string, any>; api: PortalApi; busy?: boolean; rddId: number | null }>();
defineEmits<{ (event: 'navigate', route: any): void }>();

const openList = ref(true);
const openLab = ref(false);
const openDist = ref(true);
const openParts = ref(true);
const table = ref('');
const lazy = ref(false);
const uncache = ref('');
const confirmUncache = ref(false);
const error = ref('');

const storage = computed(() => rows(props.view, 'spark.storage'));
const catalyst = computed(() => String(pick(props.view, 'spark.planner', 'simple')) === 'catalyst');
const tables = computed(() => {
  const current = String(pick(props.view, 'hive.current', 'default'));
  return rows(props.view, 'hive.tables').filter(t => t.db === current).map(t => String(t.name));
});
const rdd = computed(() => (props.rddId === null ? null : storage.value[props.rddId - 1] || null));
const memory = computed(() => Number(rdd.value?.memory_bytes || 0));
const disk = computed(() => Number(rdd.value?.disk_bytes || 0));
const workers = computed(() => executorsFor(props.view).filter(e => e.id !== 'driver'));
const partitions = computed(() => {
  const r = rdd.value;
  if (!r) return [];
  const n = Number(r.cached_partitions || 0);
  const out: { block: string; level: string; memory: number; disk: number; host: string }[] = [];
  for (let i = 0; i < n; i++) {
    const exec = workers.value[i % Math.max(1, workers.value.length)];
    const share = 1 / n;
    out.push({ block: `rdd_${(props.rddId || 1) * 7 + 3}_${i}`, level: 'Memory Deserialized 1x Replicated',
               memory: Math.round(memory.value * share), disk: Math.round(disk.value * share),
               host: exec ? exec.address : 'driver' });
  }
  return out;
});
const distribution = computed(() => workers.value.map(e => {
  const own = partitions.value.filter(p => p.host === e.address);
  return { host: e.address, memory: own.reduce((n, p) => n + p.memory, 0), disk: own.reduce((n, p) => n + p.disk, 0),
           max: e.maxMemoryBytes + Math.round(unit(e.id) * 1024) };
}));

const cacheCommand = computed(() => (table.value
  ? cli(['spark-sql', '-e', `CACHE ${lazy.value ? 'LAZY ' : ''}TABLE ${table.value}`]) : ''));

async function cacheTable() {
  if (!cacheCommand.value) return;
  error.value = '';
  const result = await props.api.exec(cacheCommand.value, { success: `Table ${table.value} cached`,
                                                            failure: 'CACHE TABLE failed' });
  if (!result.ok) error.value = errorText(result);
}
async function uncacheTable() {
  const name = uncache.value;
  if (!name) return;
  error.value = '';
  const result = await props.api.exec(cli(['spark-sql', '-e', `UNCACHE TABLE ${name}`]),
                                      { success: `Table ${name} uncached`, failure: 'UNCACHE TABLE failed' });
  confirmUncache.value = false;
  if (result.ok) uncache.value = '';
  else error.value = errorText(result);
}
</script>

<style scoped>
.sto__lab { margin-top: 14px; }
.sto__panel { border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; background: #fcfcfc; }
.sto__row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.sto__select { max-width: 280px; flex: 1 1 180px; }
.sto__lazy { display: inline-flex; gap: 5px; align-items: center; font-size: 13px; }
.sto__note { padding: 8px 10px; border-radius: 4px; margin: 6px 0; }
.sto__confirm { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 10px; background: #fff3cd;
  border: 1px solid #ffeeba; border-radius: 4px; margin-bottom: 8px; font-size: 13px; }
.sto__confirm span { flex: 1 1 240px; }
.hist__cmd { font-size: 12px; margin: 4px 0 10px; overflow-wrap: anywhere; }
.alert-warning { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; }
.btn-danger { color: #fff; background: #dc3545; border-color: #dc3545; }
.btn-danger:hover:not(:disabled) { background: #c82333; border-color: #bd2130; }
</style>
