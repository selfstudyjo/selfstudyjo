<template>
  <div class="dd-tp" role="dialog" :aria-label="title">
    <header>
      <strong>{{ title }}</strong>
      <button type="button" aria-label="Close" @click="$emit('close')"><DdIcon name="close" :size="16" /></button>
    </header>
    <div v-if="kind === 'gordon'" class="dd-tp__body">
      <p><DdIcon name="sparkle" :size="16" /> <b>Ask Gordon</b> is Docker's AI agent.</p>
      <p class="muted">Gordon is not available in this lab. Use the lab's AI tutor instead — it can see this
        engine's containers, images, volumes and networks.</p>
    </div>
    <div v-else-if="kind === 'learn'" class="dd-tp__body">
      <p class="muted">Walkthroughs</p>
      <button type="button" class="dd-tp__link" @click="$emit('go', { page: 'images', tab: 'hub' })">Run a container from an image</button>
      <button type="button" class="dd-tp__link" @click="$emit('go', { page: 'volumes' })">Persist your data with volumes</button>
      <button type="button" class="dd-tp__link" @click="$emit('go', { page: 'networks' })">Connect containers on a network</button>
      <button type="button" class="dd-tp__link" @click="$emit('go', { page: 'builds' })">Build an image from a Dockerfile</button>
    </div>
    <div v-else-if="kind === 'bug'" class="dd-tp__body">
      <p><span class="dot"></span> Docker Engine is running.</p>
      <dl>
        <dt>Engine</dt><dd>{{ view.version || '26.1.4' }}</dd>
        <dt>Host</dt><dd>{{ view.host || 'lab-node-1' }}</dd>
        <dt>Context</dt><dd>desktop-linux</dd>
      </dl>
    </div>
    <div v-else-if="kind === 'settings'" class="dd-tp__body">
      <dl>
        <dt>Docker Engine</dt><dd>{{ view.version || '26.1.4' }}</dd>
        <dt>CPUs</dt><dd>{{ view.desktop?.cpus ?? 8 }}</dd>
        <dt>Memory limit</dt><dd>{{ view.desktop?.mem_total_gb ?? 7.76 }} GB</dd>
        <dt>Disk usage limit</dt><dd>{{ view.desktop?.disk_limit_gb ?? 1006.85 }} GB</dd>
        <dt>Theme</dt><dd>Light</dd>
      </dl>
      <p class="muted">Settings are fixed in this lab.</p>
    </div>
    <div v-else class="dd-tp__body">
      <p class="muted">Signing in to Docker Hub is not needed in this lab — pulls come from the lab's registry,
        and there is no writable registry to push to.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DdIcon from './DdIcon.vue';
import type { DdRoute } from './dd';

const props = defineProps<{ kind: string; view: Record<string, any> }>();
defineEmits<{ (event: 'close'): void; (event: 'go', route: DdRoute): void }>();

const title = computed(() => ({
  gordon: 'Ask Gordon', learn: 'Learning center', bug: 'Troubleshoot', settings: 'Settings',
}[props.kind] || 'Docker account'));
</script>

<style scoped>
.dd-tp { position: absolute; top: calc(100% + 4px); right: 12px; z-index: 46; width: min(340px, calc(100% - 24px)); background: #fff; border-radius: 8px; box-shadow: 0 6px 24px rgb(0 0 0 / .2), 0 0 0 1px rgb(0 0 0 / .05); }
.dd-tp header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 6px 16px; font-size: 15px; }
.dd-tp header strong { font-weight: 500; }
.dd-tp header button { border: 0; background: none; cursor: pointer; color: var(--dd-text-2); padding: 4px; border-radius: 50%; }
.dd-tp__body { padding: 4px 16px 16px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--dd-text); }
.dd-tp__body p { margin: 0; display: flex; align-items: center; gap: 6px; line-height: 1.45; flex-wrap: wrap; }
.muted { color: var(--dd-text-2); }
.dd-tp__link { border: 0; background: none; padding: 4px 0; text-align: left; color: var(--dd-link); font: inherit; cursor: pointer; }
.dd-tp__link:hover { text-decoration: underline; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; }
dt { color: var(--dd-text-2); }
dd { margin: 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dd-green); display: inline-block; }
</style>
