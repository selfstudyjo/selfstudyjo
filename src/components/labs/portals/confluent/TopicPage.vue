<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'topics' })">Topics</button><span class="cc-sep">/</span><span>{{ name }}</span></nav>

    <template v-if="topic">
      <div class="cc-title-row">
        <h1 class="cc-title">{{ topic.name }}</h1>
        <span class="cc-status" :class="topic.offline_partitions ? 'cc-status--bad' : topic.under_replicated ? 'cc-status--warn' : 'cc-status--ok'">
          {{ topic.offline_partitions ? 'Offline partitions' : topic.under_replicated ? 'Under replicated' : 'Healthy' }}</span>
      </div>
      <nav class="cc-tabs" aria-label="Topic">
        <button v-for="t in TABS" :key="t[0]" type="button" :class="{ 'is-active': tab === t[0] }" @click="setTab(t[0])">{{ t[1] }}</button>
      </nav>
      <TopicOverview v-if="tab === 'overview'" :topic="topic" />
      <TopicMessages v-else-if="tab === 'messages'" :topic="topic" />
      <SchemaPanel v-else-if="tab === 'schema'" :subject="topic.name + '-value'" :topic="topic.name" />
      <TopicConfig v-else :topic="topic" />
    </template>
    <div v-else class="cc-card cc-empty">
      Topic <strong>{{ name }}</strong> does not exist.
      <div><button type="button" class="cc-btn cc-btn--ghost" @click="cc.go({ page: 'topics' })">Back to topics</button></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME } from './confluent';
import TopicOverview from './TopicOverview.vue';
import TopicMessages from './TopicMessages.vue';
import SchemaPanel from './SchemaPanel.vue';
import TopicConfig from './TopicConfig.vue';

type Tab = 'overview' | 'messages' | 'schema' | 'configuration';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['messages', 'Messages'], ['schema', 'Schema'], ['configuration', 'Configuration']];

const cc = useCc();
const name = computed(() => (cc.route.value.page === 'topic' ? cc.route.value.name : ''));
const tab = computed<Tab>(() => (cc.route.value.page === 'topic' ? cc.route.value.tab : 'overview'));
const topic = computed(() => cc.topic(name.value));

function setTab(next: Tab) {
  cc.go({ page: 'topic', name: name.value, tab: next });
}
</script>

<style scoped src="./cc.css"></style>
