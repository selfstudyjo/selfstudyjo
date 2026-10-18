<template>
  <section>
    <h3 class="spk-h3">Environment</h3>
    <div v-for="block in blocks" :key="block.title">
      <h4 class="spk-h4" @click="toggle(block.title)">
        <span :class="closed.includes(block.title) ? 'arrow-closed' : 'arrow-open'"></span>
        <a href="#" @click.prevent>{{ block.title }}</a>
      </h4>
      <div v-if="!closed.includes(block.title)" class="table-wrap">
        <table class="table table-bordered table-sm env__table">
          <thead><tr><th>{{ block.head[0] }}</th><th>{{ block.head[1] }}</th></tr></thead>
          <tbody>
            <tr v-for="row in block.rows" :key="row[0]"><td>{{ row[0] }}</td><td class="env__val">{{ row[1] }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { pick } from '@/utils/portalKit';
import type { SparkApp } from './spark';

const props = defineProps<{ app: SparkApp; view: Record<string, any> }>();
const closed = ref<string[]>(['Hadoop Properties', 'System Properties', 'Metrics Properties', 'Classpath Entries']);

function toggle(title: string) {
  closed.value = closed.value.includes(title) ? closed.value.filter(t => t !== title) : [...closed.value, title];
}

const blocks = computed(() => {
  const spark = pick<Record<string, string>>(props.view, 'ambari.configs.spark2-defaults.properties', {});
  const core = pick<Record<string, string>>(props.view, 'ambari.configs.core-site.properties', {});
  const hdfs = pick<Record<string, string>>(props.view, 'ambari.configs.hdfs-site.properties', {});
  const yarn = pick<Record<string, string>>(props.view, 'ambari.configs.yarn-site.properties', {});
  const version = String(pick(props.view, 'versions.spark', '3.5.1'));
  const hadoop = String(pick(props.view, 'versions.hadoop', '3.3.6'));
  const sparkProps: [string, string][] = [
    ['spark.app.id', props.app.id],
    ['spark.app.name', props.app.name],
    ['spark.app.startTime', String(props.app.started)],
    ['spark.driver.host', 'master-1.lab.internal'],
    ['spark.driver.port', '41235'],
    ['spark.executor.id', 'driver'],
    ['spark.sql.catalogImplementation', 'hive'],
    ['spark.sql.warehouse.dir', 'hdfs://namenode:8020/user/hive/warehouse'],
    ['spark.submit.deployMode', 'client'],
    ['spark.yarn.historyServer.address', 'spark-history.lab.internal:18080'],
    ...Object.entries(spark),
  ].sort((a, b) => a[0].localeCompare(b[0])) as [string, string][];
  return [
    { title: 'Runtime Information', head: ['Name', 'Value'], rows: [
      ['Java Home', '/usr/lib/jvm/java-1.8.0-openjdk/jre'], ['Java Version', '1.8.0_382 (Red Hat, Inc.)'],
      ['Scala Version', 'version 2.12.18'],
    ] },
    { title: 'Spark Properties', head: ['Name', 'Value'], rows: sparkProps },
    { title: 'Resource Profiles', head: ['Resource Profile Id', 'Resource Profile Contents'], rows: [
      ['0', `Executor Reqs: cores: [amount: ${spark['spark.executor.cores'] || 2}] memory: [amount: ${spark['spark.executor.memory'] || '2g'}] offHeap: [amount: 0] Task Reqs: cpus: [amount: 1.0]`],
    ] },
    { title: 'Hadoop Properties', head: ['Name', 'Value'], rows: Object.entries({ ...core, ...hdfs, ...yarn })
      .sort((a, b) => a[0].localeCompare(b[0])) },
    { title: 'System Properties', head: ['Name', 'Value'], rows: [
      ['file.encoding', 'UTF-8'], ['java.vendor', 'Red Hat, Inc.'], ['java.version', '1.8.0_382'],
      ['os.arch', 'amd64'], ['os.name', 'Linux'], ['sun.java.command', `org.apache.spark.deploy.SparkSubmit --master yarn ${props.app.name}`],
      ['user.dir', '/home/lab'], ['user.name', props.app.user], ['user.timezone', 'UTC'],
    ] },
    { title: 'Metrics Properties', head: ['Name', 'Value'], rows: [
      ['*.sink.servlet.class', 'org.apache.spark.metrics.sink.MetricsServlet'],
      ['*.sink.servlet.path', '/metrics/json'],
    ] },
    { title: 'Classpath Entries', head: ['Resource', 'Source'], rows: [
      [`/usr/hdp/current/spark2-client/jars/spark-core_2.12-${version}.jar`, 'System Classpath'],
      [`/usr/hdp/current/spark2-client/jars/spark-sql_2.12-${version}.jar`, 'System Classpath'],
      [`/usr/hdp/current/spark2-client/jars/hadoop-client-api-${hadoop}.jar`, 'System Classpath'],
      ['/etc/hadoop/conf/', 'System Classpath'],
    ] },
  ];
});
</script>

<style scoped>
.env__table td:first-child { width: 40%; word-break: break-all; }
.env__val { word-break: break-all; }
</style>
