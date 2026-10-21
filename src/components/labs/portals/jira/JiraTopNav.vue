<template>
  <header class="jt">
    <div class="jt__left">
      <button type="button" class="jt__icon jt__burger" aria-label="Open sidebar" @click="$emit('toggle-nav')">
        <JiraIcon name="menu" />
      </button>
      <JiraDropdown :items="appItems" label="Switch sites or apps" heading="Switch to"
                    trigger-class="jt__icon" @select="() => {}">
        <template #trigger><JiraIcon name="apps" /></template>
      </JiraDropdown>
      <a class="jt__logo" href="#" aria-label="Go to your Jira homepage" @click.prevent="$emit('go', 'board')">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id="jt-g1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#0052CC" /><stop offset="1" stop-color="#2684FF" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="#1868DB" />
          <path d="M17.6 6H11.8c0 1.5 1.2 2.7 2.7 2.7h1.1v1c0 1.5 1.2 2.7 2.7 2.7V6.6c0-.3-.3-.6-.7-.6z" fill="#fff" />
          <path d="M14.7 8.9H8.9c0 1.5 1.2 2.7 2.7 2.7h1.1v1c0 1.5 1.2 2.7 2.7 2.7V9.5c0-.3-.3-.6-.7-.6z" fill="#fff" opacity=".85" />
          <path d="M11.8 11.8H6c0 1.5 1.2 2.7 2.7 2.7h1.1v1c0 1.5 1.2 2.7 2.7 2.7v-5.8c0-.3-.3-.6-.7-.6z" fill="#fff" opacity=".7" />
        </svg>
        <span class="jt__wordmark">Jira</span>
      </a>
      <nav class="jt__nav" aria-label="Primary">
        <JiraDropdown v-for="menu in menus" :key="menu.label" :items="menu.items" :label="menu.label"
                      :heading="menu.heading" trigger-class="jt__menu" :class="{ 'is-current': menu.current }"
                      @select="value => onMenu(value)">
          <template #trigger>{{ menu.label }} <JiraIcon name="chevron-down" :size="12" /></template>
        </JiraDropdown>
        <JiraDropdown :items="moreItems" label="More" trigger-class="jt__menu" class="jt__more"
                      @select="value => onMenu(value)">
          <template #trigger>More <JiraIcon name="chevron-down" :size="12" /></template>
        </JiraDropdown>
      </nav>
      <button type="button" class="j-btn j-btn--primary jt__create" @click="$emit('create')">
        <JiraIcon name="plus" class="jt__create-plus" /><span class="jt__create-text">Create</span>
      </button>
    </div>

    <div class="jt__right">
      <div class="jt__search" :class="{ 'is-focused': focused }">
        <JiraIcon name="search" class="jt__search-icon" />
        <input v-model="query" type="search" placeholder="Search" aria-label="Search"
               @focus="focused = true" @blur="onBlur" @keydown.enter="openFirst" />
        <div v-if="focused && query.trim()" class="jt__results" role="listbox">
          <div class="jt__results-head">Issues</div>
          <button v-for="hit in hits" :key="hit.id" type="button" class="jt__hit"
                  @mousedown.prevent="pick(hit.id)">
            <JiraIcon :name="hit.type" kind="type" />
            <span class="jt__hit-title">{{ hit.title }}</span>
            <span class="jt__hit-key">{{ hit.id }}</span>
          </button>
          <div v-if="!hits.length" class="jt__noresults">No issues match "{{ query }}"</div>
        </div>
      </div>
      <JiraDropdown :items="notificationItems" label="Notifications" align="right" heading="Notifications"
                    trigger-class="jt__icon" class="jt__bell" @select="() => {}">
        <template #trigger>
          <JiraIcon name="bell" />
          <span v-if="unread" class="jt__badge">{{ unread > 9 ? '9+' : unread }}</span>
        </template>
        <template #item="{ item }">
          <span class="jt__note" :class="'is-' + item.level">
            <span class="jt__note-text">{{ item.label }}</span>
            <span class="jt__note-meta">{{ item.meta }}</span>
          </span>
        </template>
      </JiraDropdown>
      <JiraDropdown :items="helpItems" label="Help" align="right" trigger-class="jt__icon" @select="() => {}">
        <template #trigger><JiraIcon name="help" /></template>
      </JiraDropdown>
      <JiraDropdown :items="settingsItems" label="Settings" align="right" heading="Jira settings"
                    trigger-class="jt__icon" @select="() => {}">
        <template #trigger><JiraIcon name="gear" /></template>
      </JiraDropdown>
      <JiraDropdown :items="profileItems" label="Your profile and settings" align="right"
                    trigger-class="jt__icon jt__me" @select="() => {}">
        <template #trigger><JiraAvatar name="You Manager" :size="24" :title="false" /></template>
      </JiraDropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
/** The global navigation bar of Jira Cloud, 56px, white, with the product menus. */
import { computed, ref } from 'vue';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import { type Issue, type PageId } from './jiraKit';

const props = defineProps<{ page: PageId; issues: Issue[]; signals: any[] }>();
const emit = defineEmits<{
  (event: 'toggle-nav'): void;
  (event: 'create'): void;
  (event: 'go', page: PageId): void;
  (event: 'open-issue', key: string): void;
}>();

const query = ref('');
const focused = ref(false);

const appItems: DropItem[] = [
  { label: 'Jira', value: 'jira' }, { label: 'Confluence', value: 'confluence', disabled: true },
  { label: 'Jira Service Management', value: 'jsm', disabled: true },
  { label: 'Atlassian Home', value: 'home', disabled: true },
];

const menus = computed(() => [
  { label: 'Your work', heading: 'Assigned to me', current: false,
    items: props.issues.filter(i => i.in_sprint && i.status !== 'done').slice(0, 6)
      .map(i => ({ label: `${i.id}  ${i.title}`, value: 'issue:' + i.id })) },
  { label: 'Projects', heading: 'Recent', current: true,
    items: [{ label: 'Platform (PLAT) — Software project', value: 'page:board' },
            { label: 'View all projects', value: 'none', disabled: true }] },
  { label: 'Filters', heading: 'Starred filters', current: false,
    items: [{ label: 'View all issues', value: 'page:issues' },
            { label: 'Open risks', value: 'page:risks' }, { label: 'Open incidents', value: 'page:incidents' },
            { label: 'Backlog', value: 'page:backlog' }] },
  { label: 'Dashboards', heading: 'Recent', current: false,
    items: [{ label: 'Velocity chart', value: 'page:reports' }, { label: 'Team health', value: 'page:team' }] },
  { label: 'Teams', heading: 'Your teams', current: false,
    items: [{ label: 'Cloud Platform Engineering', value: 'page:team' }] },
  { label: 'Plans', heading: 'Plans', current: false,
    items: [{ label: 'Platform timeline', value: 'page:timeline' }, { label: 'Goals', value: 'page:goals' }] },
]);

const moreItems = computed<DropItem[]>(() => menus.value.flatMap(menu =>
  menu.items.map((item, index) => ({ ...item, section: index === 0 ? menu.label : undefined }))));

function onMenu(value: string) {
  if (value.startsWith('page:')) emit('go', value.slice(5) as PageId);
  else if (value.startsWith('issue:')) emit('open-issue', value.slice(6));
}

const hits = computed(() => {
  const text = query.value.trim().toLowerCase();
  if (!text) return [];
  return props.issues.filter(issue => issue.id.toLowerCase().includes(text)
                                      || issue.title.toLowerCase().includes(text)).slice(0, 8);
});

function pick(key: string) {
  query.value = '';
  focused.value = false;
  emit('open-issue', key);
}

function openFirst() {
  if (hits.value.length) pick(hits.value[0].id);
}

function onBlur() {
  window.setTimeout(() => { focused.value = false; }, 120);
}

const notificationItems = computed<DropItem[]>(() => {
  const list = [...(props.signals || [])].reverse().slice(0, 12);
  if (!list.length) return [{ label: 'No new notifications. Signals appear when a sprint completes.', value: 'none', disabled: true }];
  return list.map((row: any, index: number) => ({
    label: String(row.text || row.message || ''), value: 'n' + index,
    level: row.level, meta: `Sprint ${row.sprint} · ${String(row.level || '').toUpperCase()}`,
  }));
});
const unread = computed(() => (props.signals || []).filter((row: any) => row.level !== 'good').length);

const helpItems: DropItem[] = [
  { label: 'Jira Software documentation', value: 'docs', disabled: true },
  { label: 'Keyboard shortcuts', value: 'keys', hint: 'Board: Shift + ←/→ moves the focused card', disabled: true },
  { label: 'What is this site?', value: 'sim', hint: 'A simulated Jira over the lab’s mgr engine', disabled: true },
];
const settingsItems: DropItem[] = [
  { label: 'System', value: 's', disabled: true }, { label: 'Products', value: 'p', disabled: true },
  { label: 'Projects', value: 'pr', disabled: true }, { label: 'Issues', value: 'i', disabled: true },
];
const profileItems: DropItem[] = [
  { label: 'You (Engineering Manager)', value: 'me', disabled: true },
  { label: 'Profile', value: 'profile', disabled: true },
  { label: 'Personal settings', value: 'settings', disabled: true },
];
</script>

<style scoped>
.jt {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 56px;
  padding: 0 12px; background: var(--j-surface); border-bottom: 1px solid var(--j-border);
  flex: none; min-width: 0;
}
.jt__left, .jt__right { display: flex; align-items: center; gap: 4px; min-width: 0; }
.jt__left { flex: 1 1 auto; }
.jt :deep(.jt__icon) {
  display: inline-grid; place-items: center; position: relative; width: 32px; height: 32px;
  border-radius: 50%; color: var(--j-text-subtle);
}
.jt :deep(.jt__icon:hover) { background: var(--j-neutral-hover); }
.jt .jt__burger { display: none; border: 0; background: transparent; cursor: pointer; }
.jt__logo {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 6px; margin-right: 8px;
  border-radius: 3px; color: var(--j-text); text-decoration: none;
}
.jt__logo:hover { background: var(--j-neutral-hover); }
.jt__wordmark { font-size: 16px; font-weight: 653; letter-spacing: -0.2px; }
.jt__nav { display: flex; align-items: center; gap: 2px; min-width: 0; }
.jt__nav :deep(.jt__menu) {
  height: 32px; padding: 0 8px; border-radius: 3px; color: var(--j-text-subtle); font-weight: 500;
  white-space: nowrap;
}
.jt__nav :deep(.jt__menu:hover) { background: var(--j-neutral-hover); color: var(--j-text); }
.jt__nav .is-current :deep(.jt__menu) { color: var(--j-brand); }
.jt__nav .is-current { box-shadow: inset 0 -3px 0 var(--j-brand); height: 56px; align-items: center; }
.jt__more { display: none; }
.jt__create { margin-left: 8px; height: 32px; }
.jt__create-plus { display: none; }
.jt__search { position: relative; display: flex; align-items: center; width: 200px; margin-right: 4px; }
.jt__search input {
  width: 100%; height: 32px; padding: 0 8px 0 30px; border: 1px solid var(--j-border-input);
  border-radius: 3px; background: var(--j-surface); color: var(--j-text); font: inherit; font-size: 14px;
}
.jt__search input:hover { background: var(--j-input-hover); }
.jt__search input:focus { outline: none; box-shadow: inset 0 0 0 2px var(--j-focus); border-color: transparent; }
.jt__search.is-focused { width: 320px; }
.jt__search-icon { position: absolute; left: 8px; color: var(--j-text-subtle); pointer-events: none; }
.jt__results {
  position: absolute; top: 38px; right: 0; z-index: 40; width: 380px; max-width: 80vw; padding: 8px 0;
  background: var(--j-surface-overlay); border-radius: 4px;
  box-shadow: 0 8px 12px rgba(30, 31, 33, 0.15), 0 0 1px rgba(30, 31, 33, 0.31);
}
.jt__results-head { padding: 4px 16px; font-size: 12px; font-weight: 653; color: var(--j-text-subtlest); text-transform: uppercase; }
.jt__hit {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 16px; border: 0;
  background: transparent; font: inherit; color: var(--j-text); text-align: left; cursor: pointer;
}
.jt__hit:hover { background: var(--j-neutral-hover); }
.jt__hit-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jt__hit-key { color: var(--j-text-subtlest); font-size: 12px; }
.jt__noresults { padding: 8px 16px; color: var(--j-text-subtle); }
.jt__badge {
  position: absolute; top: 0; right: -2px; min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 8px; background: #C9372C; color: #fff; font-size: 12px; font-weight: 700;
  line-height: 16px; text-align: center; box-shadow: 0 0 0 2px var(--j-surface);
}
.jt__note { display: flex; flex-direction: column; gap: 2px; white-space: normal; font-size: 13px; }
.jt__note-meta { font-size: 12px; color: var(--j-text-subtlest); }
.jt__note.is-critical .jt__note-meta { color: var(--j-danger-text); }
.jt__note.is-good .jt__note-meta { color: var(--j-success-text); }
.jt__bell :deep(.jd__menu) { width: 360px; max-width: 360px; }
/* The empty state is a message, not a dead option: subtle, but readable. */
.jt__bell :deep(.jd__item:disabled) { color: var(--j-text-subtle); cursor: default; }

@container sl-portal (max-width: 1240px) {
  .jt__nav > :nth-child(n+4):not(.jt__more) { display: none; }
  .jt__more { display: inline-flex; }
}
@container sl-portal (max-width: 900px) {
  .jt .jt__burger { display: inline-grid; }
  .jt__nav { display: none; }
  .jt__search, .jt__search.is-focused { width: 150px; }
}
@container sl-portal (max-width: 560px) {
  .jt { padding: 0 6px; gap: 2px; }
  .jt__wordmark { display: none; }
  .jt__create { margin-left: 2px; padding: 0 8px; }
  .jt__create-text { display: none; }
  .jt__create-plus { display: inline-block; }
  .jt__search { width: 32px; }
  .jt__search input { padding: 0; width: 32px; cursor: pointer; border-color: transparent; }
  .jt .jt__search input::placeholder { color: transparent; }
  .jt .jt__search:not(.is-focused) input { text-indent: 40px; overflow: hidden; }
  .jt__search.is-focused input { border-color: var(--j-border-input); }
  .jt .jt__search.is-focused input::placeholder { color: var(--j-text-subtlest); }
  .jt__search.is-focused { position: absolute; left: 6px; right: 6px; width: auto; z-index: 45; }
  .jt__search.is-focused input { width: 100%; padding-left: 30px; color: var(--j-text); }
  .jt__right > :nth-child(3), .jt__right > :nth-child(4) { display: none; }
  /* The right-hand menus hang from the bar, not from their icon, so a 360px
     notifications panel never runs off the left edge of a phone. */
  .jt { position: relative; }
  .jt__right :deep(.jd) { position: static; }
  .jt__right :deep(.jd__menu) { top: 52px; right: 6px; max-width: calc(100% - 12px); }
  .jt__bell :deep(.jd__menu) { left: 6px; width: auto; max-width: none; }
}
</style>
