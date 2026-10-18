<template>
  <div>
    <div class="cs-tabs s3b__tabs">
      <button type="button" class="cs-tab is-active">General purpose buckets</button>
      <button type="button" class="cs-tab" disabled title="Not available in this lab">Directory buckets</button>
      <button type="button" class="cs-tab" disabled title="Not available in this lab">Table buckets</button>
    </div>

    <section class="cs-container">
      <div class="cs-container__head">
        <CsHeader title="Account snapshot" :level="2" description="Storage Lens provides visibility into storage usage and activity trends." />
      </div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>Total storage</dt><dd>{{ totalBytes }}</dd></div>
          <div><dt>Object count</dt><dd>{{ objects.length }}</dd></div>
          <div><dt>Buckets</dt><dd>{{ buckets.length }}</dd></div>
        </dl>
      </div>
    </section>

    <CsTable
      v-model:selected="selected"
      title="General purpose buckets"
      variant="full-page"
      :items="buckets"
      :columns="columns"
      track-by="name"
      selection-type="single"
      filter-placeholder="Find buckets by name"
      :filter-fields="['name', 'region']"
      description="Buckets are containers for data stored in S3."
      empty-title="No buckets"
      empty-text="You don't have any buckets."
    >
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="refresh"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" :disabled="!current" @click="copyArn"><CsIcon name="copy" /> Copy ARN</button>
        <button type="button" class="cs-btn" :disabled="!current" @click="modal = 'empty'">Empty</button>
        <button type="button" class="cs-btn" :disabled="!current" @click="modal = 'delete'">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('s3', 'create')">Create bucket</button>
      </template>
      <template #empty>
        <button type="button" class="cs-btn" @click="ctx.to('s3', 'create')">Create bucket</button>
      </template>
      <template #cell-name="{ row }">
        <a href="#" class="cs-link" @click.prevent="ctx.to('s3', 'bucket', { name: row.name })">{{ row.name }}</a>
      </template>
      <template #cell-region="{ row }">{{ regionName(row.region) }} {{ row.region }}</template>
      <template #cell-analyzer="{ row }"><span class="cs-link">View analyzer for {{ row.region }}</span></template>
    </CsTable>

    <S3DeleteBucket v-if="modal === 'delete' && current" :bucket="current" @close="modal = ''" @done="selected = []" />
    <S3EmptyBucket v-if="modal === 'empty' && current" :bucket="current" @close="modal = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, bytes, useAws } from '../ctx';
import { regionName } from '../nav';
import S3DeleteBucket from './S3DeleteBucket.vue';
import S3EmptyBucket from './S3EmptyBucket.vue';

const ctx = useAws();
const selected = ref<string[]>([]);
const modal = ref<'' | 'delete' | 'empty'>('');

const buckets = computed(() => rows(ctx.view.value, 's3.buckets'));
const objects = computed(() => rows(ctx.view.value, 's3.objects'));
const current = computed(() => buckets.value.find(b => b.name === selected.value[0]) || null);
const totalBytes = computed(() => bytes(objects.value.reduce((sum, o) => sum + (Number(o.size) || 0), 0)));

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'region', header: 'AWS Region', sortKey: 'region' },
  { id: 'analyzer', header: 'IAM Access Analyzer' },
  { id: 'created', header: 'Creation date', sortKey: 'created', cell: row => awsDate(row.created) },
];

function refresh() {
  ctx.api.notify('info', 'Bucket list refreshed');
}
async function copyArn() {
  try { await navigator.clipboard.writeText(current.value?.arn || ''); } catch { /* ignored */ }
  ctx.api.notify('success', `ARN copied: ${current.value?.arn}`);
}
</script>

<style scoped>
.s3b__tabs { margin-top: -4px; }
</style>
