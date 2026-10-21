<template>
  <aside class="js" :class="{ 'is-open': open }" aria-label="Project navigation">
    <div class="js__project">
      <span class="js__project-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <rect width="24" height="24" rx="4" fill="#FF8F73" />
          <path d="M6 16l4-8 3 5 2-3 3 6z" fill="#fff" />
        </svg>
      </span>
      <span class="js__project-text">
        <span class="js__project-name">Platform</span>
        <span class="js__project-kind">Software project</span>
      </span>
      <button type="button" class="js__close" aria-label="Close sidebar" @click="$emit('close')">
        <JiraIcon name="chevron-left" />
      </button>
    </div>

    <nav class="js__nav">
      <div class="js__heading">Planning</div>
      <a v-for="item in planning" :key="item.id" href="#" class="js__item"
         :class="{ 'is-selected': page === item.id }" :aria-current="page === item.id ? 'page' : undefined"
         @click.prevent="$emit('go', item.id)">
        <JiraIcon :name="item.icon" class="js__item-icon" />
        <span class="js__item-label">{{ item.label }}</span>
        <span v-if="item.count" class="js__count">{{ item.count }}</span>
      </a>

      <div class="js__heading">Delivery management</div>
      <a v-for="item in delivery" :key="item.id" href="#" class="js__item"
         :class="{ 'is-selected': page === item.id }" :aria-current="page === item.id ? 'page' : undefined"
         @click.prevent="$emit('go', item.id)">
        <JiraIcon :name="item.icon" class="js__item-icon" />
        <span class="js__item-label">{{ item.label }}</span>
        <span v-if="item.count" class="js__count" :class="{ 'is-alert': item.alert }">{{ item.count }}</span>
      </a>

      <div class="js__divider" />
      <a href="#" class="js__item is-muted" @click.prevent>
        <JiraIcon name="code" class="js__item-icon" /><span class="js__item-label">Code</span>
      </a>
      <a href="#" class="js__item is-muted" @click.prevent>
        <JiraIcon name="gear" class="js__item-icon" /><span class="js__item-label">Project settings</span>
      </a>
    </nav>

    <div class="js__foot">
      You're in a team-managed project
      <a href="#" @click.prevent>Learn more</a>
    </div>
  </aside>
</template>

<script setup lang="ts">
/** The project sidebar: Platform (PLAT), its planning views, and the delivery registers. */
import { computed } from 'vue';
import JiraIcon from './JiraIcon.vue';
import type { PageId } from './jiraKit';

const props = defineProps<{ page: PageId; open: boolean; counts: Record<string, number>;
                            alerts: Record<string, boolean> }>();
defineEmits<{ (event: 'go', page: PageId): void; (event: 'close'): void }>();

const planning = computed(() => [
  { id: 'timeline' as PageId, label: 'Timeline', icon: 'timeline', count: 0 },
  { id: 'backlog' as PageId, label: 'Backlog', icon: 'backlog', count: 0 },
  { id: 'board' as PageId, label: 'Board', icon: 'board', count: 0 },
  { id: 'issues' as PageId, label: 'Issues', icon: 'list', count: 0 },
  { id: 'goals' as PageId, label: 'Goals', icon: 'goals', count: 0 },
  { id: 'reports' as PageId, label: 'Reports', icon: 'reports', count: 0 },
]);

const delivery = computed(() => [
  { id: 'risks' as PageId, label: 'Risks', icon: 'shield', count: props.counts.risks || 0, alert: props.alerts.risks },
  { id: 'incidents' as PageId, label: 'Incidents', icon: 'siren', count: props.counts.incidents || 0, alert: props.alerts.incidents },
  { id: 'stakeholders' as PageId, label: 'Stakeholders', icon: 'people', count: 0, alert: false },
  { id: 'team' as PageId, label: 'Team', icon: 'team', count: 0, alert: false },
]);
</script>

<style scoped>
.js {
  display: flex; flex-direction: column; width: 240px; flex: none; min-height: 0;
  background: var(--j-surface); border-right: 1px solid var(--j-border); overflow: auto;
}
.js__project { display: flex; align-items: center; gap: 8px; padding: 20px 12px 16px 16px; }
.js__project-avatar { display: inline-flex; border-radius: 4px; overflow: hidden; flex: none; }
.js__project-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.js__project-name { font-size: 14px; font-weight: 653; color: var(--j-text); }
.js__project-kind { font-size: 12px; color: var(--j-text-subtle); }
.js__close { display: none; border: 0; background: transparent; color: var(--j-text-subtle); cursor: pointer; width: 28px; height: 28px; border-radius: 3px; }
.js__close:hover { background: var(--j-neutral-hover); }
.js__nav { display: flex; flex-direction: column; padding: 0 8px; gap: 2px; }
.js__heading {
  padding: 16px 8px 6px; font-size: 12px; font-weight: 653; line-height: 16px;
  color: var(--j-text-subtlest); text-transform: uppercase;
}
.js__item {
  position: relative; display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 8px;
  border-radius: 3px; color: var(--j-text-subtle); text-decoration: none; font-size: 14px;
}
.js__item:hover { background: var(--j-neutral-hover); color: var(--j-text); }
.js__item:focus-visible { outline: 2px solid var(--j-focus); outline-offset: -2px; }
.js__item.is-selected { background: var(--j-selected); color: var(--j-selected-text); font-weight: 500; }
.js__item.is-selected::before {
  content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 0 2px 2px 0;
  background: var(--j-brand);
}
.js__item.is-muted { color: var(--j-text-subtlest); }
.js__item-icon { color: inherit; }
.js__item-label { flex: 1; }
.js__count {
  min-width: 20px; padding: 0 6px; border-radius: 10px; background: var(--j-neutral);
  color: var(--j-text-subtle); font-size: 12px; font-weight: 600; text-align: center; line-height: 18px;
}
.js__count.is-alert { background: #FFECEB; color: #AE2E24; }
.js__divider { height: 1px; margin: 12px 8px; background: var(--j-border); }
.js__foot { margin-top: auto; padding: 16px; font-size: 12px; color: var(--j-text-subtlest); line-height: 16px; }
.js__foot a { display: block; color: var(--j-link); text-decoration: none; }

@container sl-portal (max-width: 900px) {
  .js {
    position: absolute; top: 0; bottom: 0; left: 0; z-index: 30; transform: translateX(-100%);
    transition: transform 0.18s ease; box-shadow: 0 8px 16px rgba(30, 31, 33, 0.2);
  }
  .js.is-open { transform: none; }
  .js__close { display: inline-grid; place-items: center; }
}
</style>
