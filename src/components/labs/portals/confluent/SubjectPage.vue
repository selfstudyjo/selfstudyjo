<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'registry' })">Schema Registry</button><span class="cc-sep">/</span><span>{{ subject }}</span></nav>
    <div class="cc-title-row"><h1 class="cc-title">{{ subject }}</h1></div>
    <SchemaPanel :subject="subject" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SchemaPanel from './SchemaPanel.vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME } from './confluent';

const cc = useCc();
const subject = computed(() => (cc.route.value.page === 'subject' ? cc.route.value.subject : ''));
</script>

<style scoped src="./cc.css"></style>
