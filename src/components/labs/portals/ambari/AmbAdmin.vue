<template>
  <div>
    <ul class="nav-tabs">
      <li class="active"><a href="#" @click.prevent>Stack</a></li>
      <li><a href="#" @click.prevent>Versions</a></li>
      <li><a href="#" @click.prevent>Upgrade History</a></li>
    </ul>
    <div class="panel table-wrap">
      <table class="table">
        <thead><tr><th>Service</th><th>Version</th><th>Status</th><th>Description</th></tr></thead>
        <tbody>
          <tr v-for="row in stack" :key="row[0]">
            <td><strong>{{ row[0] }}</strong></td><td>{{ row[1] }}</td>
            <td><span class="label label-ok">Installed</span></td><td>{{ row[2] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { pick } from '@/utils/portalKit';

const props = defineProps<{ view: Record<string, any> }>();
const stack = computed(() => {
  const v = pick<Record<string, string>>(props.view, 'versions', {});
  return [
    ['HDFS', v.hadoop || '3.3.6', 'Apache Hadoop Distributed File System'],
    ['YARN + MapReduce2', v.hadoop || '3.3.6', 'Apache Hadoop NextGen MapReduce (YARN)'],
    ['Hive', v.hive || '3.1.3', 'Data warehouse system for ad-hoc queries & analysis of large datasets'],
    ['Spark2', v.spark || '3.5.1', 'Apache Spark is a fast and general engine for large-scale data processing'],
    ['ZooKeeper', '3.4.6', 'Centralized service which provides highly reliable distributed coordination'],
    ['Ambari Metrics', '0.1.0', 'A system for metrics collection that provides storage and retrieval capability'],
  ];
});
</script>
