<template>
  <div class="fx-page">
    <div class="fx-page__head"><h1 class="fx-page__title">Real-Time hub</h1></div>
    <div class="fx-tabs">
      <button type="button" class="fx-tab is-active">All data streams</button>
      <button type="button" class="fx-tab" disabled>My data streams</button>
      <button type="button" class="fx-tab" disabled>Fabric events</button>
    </div>
    <div class="fx-page__scroll">
      <div class="fx-empty"><FxIcon name="realtime" :size="44" />
        <h3>No data streams yet</h3>
        <p>Eventstreams and KQL databases are not part of this lab environment. The Service
          Operations data arrives in batch from the ServiceNow Table API through data pipelines -
          the Monitor hub shows those runs.</p>
        <button type="button" class="fx-btn" @click="go({ page: 'monitor' })">Open Monitor</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import FxIcon from './FxIcon.vue';
import { useFabric } from './fabric';

const { go } = useFabric();
</script>
