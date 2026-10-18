<template>
  <div v-if="bucket">
    <CsHeader :title="bucket.name">
      <template #actions>
        <button type="button" class="cs-btn" @click="modal = 'empty'" :disabled="!bucket.objects">Empty</button>
        <button type="button" class="cs-btn" @click="modal = 'delete'">Delete</button>
      </template>
    </CsHeader>
    <div class="cs-tabs" role="tablist">
      <button v-for="t in tabs" :key="t.id" type="button" class="cs-tab" role="tab" :class="{ 'is-active': tab === t.id }"
              :disabled="t.off" :title="t.off ? 'Not available in this lab' : undefined" @click="setTab(t.id)">{{ t.text }}</button>
    </div>
    <S3Objects v-if="tab === 'objects'" :bucket="bucket" :prefix="prefix" />
    <S3Properties v-else-if="tab === 'properties'" :bucket="bucket" />
    <S3Permissions v-else-if="tab === 'permissions'" :bucket="bucket" />
    <S3DeleteBucket v-if="modal === 'delete'" :bucket="bucket" @close="modal = ''" />
    <S3EmptyBucket v-if="modal === 'empty'" :bucket="bucket" @close="modal = ''" />
  </div>
  <div v-else class="cs-alert cs-alert--error">
    <CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>Bucket not found</strong>The bucket "{{ name }}" does not exist or was deleted.
      <button type="button" class="cs-link" @click="ctx.to('s3', 'buckets')">Go to buckets</button></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import { useAws } from '../ctx';
import S3DeleteBucket from './S3DeleteBucket.vue';
import S3EmptyBucket from './S3EmptyBucket.vue';
import S3Objects from './S3Objects.vue';
import S3Permissions from './S3Permissions.vue';
import S3Properties from './S3Properties.vue';

const ctx = useAws();
const params = computed(() => ctx.route.value.params || {});
const name = computed(() => params.value.name || '');
const prefix = computed(() => params.value.prefix || '');
const tab = computed(() => params.value.tab || 'objects');
const modal = ref<'' | 'delete' | 'empty'>('');
const bucket = computed(() => rows(ctx.view.value, 's3.buckets').find(b => b.name === name.value) || null);

const tabs = [
  { id: 'objects', text: 'Objects' }, { id: 'metadata', text: 'Metadata', off: true },
  { id: 'properties', text: 'Properties' }, { id: 'permissions', text: 'Permissions' },
  { id: 'metrics', text: 'Metrics', off: true }, { id: 'management', text: 'Management', off: true },
  { id: 'access', text: 'Access Points', off: true },
];

function setTab(id: string) {
  ctx.to('s3', 'bucket', { name: name.value, tab: id });
}
</script>
