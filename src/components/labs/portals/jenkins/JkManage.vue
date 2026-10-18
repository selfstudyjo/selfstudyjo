<template>
  <div class="jk-mg">
    <h1 class="jk-h1">Manage Jenkins</h1>
    <div class="jk-alert jk-alert--warning jk-mg__warn">
      <span>Building on the built-in node can be a security issue. You should set up distributed builds. See <button type="button" class="jk-link" @click="ctx.go({ page: 'nodes' })">the documentation</button>.</span>
      <span class="jk-mg__warn-buttons">
        <button type="button" class="jk-btn jk-btn--primary" @click="ctx.go({ page: 'nodeNew' })">Set up agent</button>
        <button type="button" class="jk-btn" @click="ctx.notify('info', 'Clouds need a cloud provider plugin.')">Set up cloud</button>
      </span>
    </div>
    <section v-for="group in GROUPS" :key="group.title" class="jk-mg__group">
      <h2 class="jk-mg__h2">{{ group.title }}</h2>
      <div class="jk-mg__grid">
        <button v-for="item in group.items" :key="item.title" type="button" class="jk-mg__item"
                :class="{ 'is-off': !item.go }" @click="open(item)">
          <span class="jk-mg__icon"><JkIcon :name="item.icon" /></span>
          <span class="jk-mg__text">
            <span class="jk-mg__title">{{ item.title }}</span>
            <span class="jk-mg__desc">{{ item.desc }}</span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import JkIcon from './JkIcon.vue';
import { useJk } from './jkContext';
import type { Route } from './jenkinsKit';

const ctx = useJk();

interface Item { title: string; desc: string; icon: string; go?: Route }

const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'System Configuration', items: [
    { title: 'System', icon: 'gear', desc: 'Configure global settings and paths.' },
    { title: 'Tools', icon: 'hammer', desc: 'Configure tools, their locations and automatic installers.' },
    { title: 'Plugins', icon: 'puzzle', desc: 'Add, remove, disable or enable plugins that can extend the functionality of Jenkins.', go: { page: 'plugins' } },
    { title: 'Nodes', icon: 'computer', desc: 'Add, remove, control and monitor the various nodes that Jenkins runs jobs on.', go: { page: 'nodes' } },
    { title: 'Clouds', icon: 'cloud', desc: 'Add, remove, and configure cloud instances to provision agents on-demand.' },
  ] },
  { title: 'Security', items: [
    { title: 'Security', icon: 'shield', desc: 'Secure Jenkins; define who is allowed to access/use the system.' },
    { title: 'Credentials', icon: 'key', desc: 'Configure credentials', go: { page: 'credentials' } },
    { title: 'Credential Providers', icon: 'key', desc: 'Configure the credential providers and types' },
    { title: 'Users', icon: 'people', desc: 'Create/delete/modify users that can log in to this Jenkins.' },
  ] },
  { title: 'Status Information', items: [
    { title: 'System Information', icon: 'info', desc: 'Displays various environmental information to assist trouble-shooting.' },
    { title: 'System Log', icon: 'doc', desc: 'System log captures output from java.util.logging output related to Jenkins.' },
    { title: 'Load Statistics', icon: 'chart', desc: 'Check your resource utilization and see if you need more computers for your builds.' },
    { title: 'About Jenkins', icon: 'help', desc: 'See the version and license information.', go: { page: 'about' } },
  ] },
  { title: 'Troubleshooting', items: [
    { title: 'Manage Old Data', icon: 'doc', desc: 'Scrub configuration files to remove remnants from old plugins and earlier versions.' },
  ] },
  { title: 'Tools and Actions', items: [
    { title: 'Reload Configuration from Disk', icon: 'reload', desc: 'Discard all the loaded data in memory and reload everything from file system. Useful when you modified config files directly on disk.' },
    { title: 'Jenkins CLI', icon: 'terminal', desc: 'Access/manage Jenkins from your shell, or from your script.', go: { page: 'cli' } },
    { title: 'Script Console', icon: 'terminal', desc: 'Executes arbitrary script for administration/trouble-shooting/diagnostics.' },
    { title: 'Prepare for Shutdown', icon: 'power', desc: 'Stops executing new builds, so that the system can be eventually shut down safely.' },
  ] },
];

function open(item: Item) {
  if (item.go) ctx.go(item.go);
  else ctx.notify('info', `${item.title} is not part of this lab.`, 'Plugins, Nodes, Credentials and the Jenkins CLI are.');
}
</script>

<style scoped>
.jk-mg { max-width: 1312px; }
.jk-mg__warn { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.jk-mg__warn-buttons { display: flex; gap: 8px; }
.jk-mg__h2 { font-size: 17.6px; font-weight: 650; margin: 24px 0 9.6px; }
.jk-mg__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 304px), 1fr)); gap: 6.4px; }
.jk-mg__item { display: flex; align-items: flex-start; gap: 14.4px; padding: 12.8px; border: 0; border-radius: 12.8px; background: none; text-align: left; font: inherit; color: var(--jk-text); cursor: pointer; }
.jk-mg__item:hover { background: var(--jk-btn-bg); }
.jk-mg__icon { flex: none; display: grid; place-items: center; width: 41.6px; height: 41.6px; border-radius: 10.4px; background: var(--jk-btn-bg); }
.jk-mg__icon .jk-icon { width: 24px; height: 24px; }
.jk-mg__text { display: flex; flex-direction: column; min-width: 0; }
.jk-mg__title { font-weight: 650; }
.jk-mg__desc { color: var(--jk-secondary); font-size: 13px; line-height: 1.45; }
.jk-mg__item.is-off .jk-mg__title { color: var(--jk-text); }
</style>
