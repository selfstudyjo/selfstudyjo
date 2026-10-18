<template>
  <div class="gd-toolbar">
    <!-- Current repository -->
    <div class="gd-tb" :class="{ 'is-open': open === 'repo' }">
      <button type="button" class="gd-tb__btn" :aria-expanded="open === 'repo'" @click="$emit('toggle', 'repo')">
        <GdIcon name="repo" :size="16" class="gd-tb__icon" />
        <span class="gd-tb__text">
          <span class="gd-tb__label">Current repository</span>
          <span class="gd-tb__value">{{ v.repository.name }}</span>
        </span>
        <GdIcon name="triangleDown" :size="16" class="gd-tb__caret" />
      </button>
      <div v-if="open === 'repo'" class="gd-pop gd-pop--repo" role="dialog" aria-label="Repositories">
        <div class="gd-pop__filter">
          <span class="gd-pop__search"><GdIcon name="search" :size="13" />
            <input v-model="repoFilter" class="gd-pop__input" type="search" placeholder="Filter" aria-label="Filter repositories" />
          </span>
          <button type="button" class="gd-btn gd-pop__add" @click="addOpen = !addOpen">Add <GdIcon name="triangleDown" :size="12" /></button>
          <ul v-if="addOpen" class="gd-pop__addmenu">
            <li><button type="button" disabled>Clone repository…</button></li>
            <li><button type="button" :disabled="v.initialised" @click="addOpen = false; act.createRepo()">Create new repository…</button></li>
            <li><button type="button" disabled>Add existing repository…</button></li>
          </ul>
        </div>
        <div class="gd-pop__group">Other</div>
        <ul class="gd-pop__list">
          <li v-if="'workspace'.includes(repoFilter.trim().toLowerCase()) || !repoFilter.trim()"
              class="gd-pop__row is-current" @click="$emit('toggle', 'repo')">
            <GdIcon name="repo" :size="16" />
            <span class="gd-pop__name">{{ v.repository.name }}</span>
            <span class="gd-pop__path gd-dim">{{ v.repository.path }}</span>
          </li>
          <li v-else class="gd-pop__empty">Sorry, I can't find any repository matching {{ repoFilter }}</li>
        </ul>
      </div>
    </div>

    <!-- Current branch -->
    <div class="gd-tb gd-tb--branch" :class="{ 'is-open': open === 'branch', 'is-disabled': !v.initialised }">
      <button type="button" class="gd-tb__btn" :disabled="!v.initialised" :aria-expanded="open === 'branch'"
              @click="$emit('toggle', 'branch')">
        <GdIcon name="branch" :size="16" class="gd-tb__icon" />
        <span class="gd-tb__text">
          <span class="gd-tb__label">{{ v.detached ? 'Detached HEAD' : 'Current branch' }}</span>
          <span class="gd-tb__value">{{ !v.initialised ? '—' : v.detached ? v.detached.slice(0, 7) : v.branch }}</span>
        </span>
        <GdIcon name="triangleDown" :size="16" class="gd-tb__caret" />
      </button>
      <div v-if="open === 'branch'" class="gd-pop gd-pop--branch" role="dialog" aria-label="Branches">
        <div class="gd-pop__tabs" role="tablist">
          <button type="button" role="tab" :aria-selected="branchTab === 'branches'" class="gd-pop__tab"
                  :class="{ 'is-active': branchTab === 'branches' }" @click="branchTab = 'branches'">Branches</button>
          <button type="button" role="tab" :aria-selected="branchTab === 'prs'" class="gd-pop__tab"
                  :class="{ 'is-active': branchTab === 'prs' }" @click="branchTab = 'prs'">Pull requests</button>
        </div>
        <template v-if="branchTab === 'branches'">
          <div class="gd-pop__filter">
            <span class="gd-pop__search"><GdIcon name="search" :size="13" />
              <input v-model="branchFilter" class="gd-pop__input" type="search" placeholder="Filter"
                     aria-label="Filter branches" @keydown.enter="enterFilter" />
            </span>
            <button type="button" class="gd-btn gd-pop__new" @click="act.newBranch(branchFilter.trim())">New branch</button>
          </div>
          <div class="gd-pop__scroll">
            <template v-for="group in groups" :key="group.label">
              <div v-if="group.items.length" class="gd-pop__group">{{ group.label }}</div>
              <ul v-if="group.items.length" class="gd-pop__list">
                <li v-for="b in group.items" :key="b.name" class="gd-pop__row" :class="{ 'is-current': b.current }"
                    :title="b.name" @click="act.switchTo(b.name)" @contextmenu.prevent="$emit('branch-context', $event, b)">
                  <GdIcon :name="b.current ? 'check' : 'branch'" :size="16" />
                  <span class="gd-pop__name">{{ b.name }}</span>
                  <span class="gd-pop__when gd-dim">{{ shortAgo(b.at) }}</span>
                </li>
              </ul>
            </template>
            <div v-if="!filtered.length" class="gd-pop__empty">
              Sorry, I can't find any branch matching {{ branchFilter }}<br />
              <button type="button" class="gd-link" @click="act.newBranch(branchFilter.trim())">Create a new branch</button>
            </div>
          </div>
          <div class="gd-pop__foot">
            <button type="button" class="gd-btn gd-pop__merge" :disabled="v.branches.length < 2 || Boolean(v.detached)"
                    @click="act.mergeInto()">
              Choose a branch to merge into <b>{{ v.branch }}</b>
            </button>
          </div>
        </template>
        <div v-else class="gd-pop__prs">
          <GdIcon name="mark" :size="32" />
          <h3>This repository is not published to GitHub</h3>
          <p>Publish your repository to GitHub to see pull requests.</p>
          <button type="button" class="gd-btn gd-btn--primary" @click="act.publish()">Publish repository</button>
        </div>
      </div>
    </div>

    <!-- Fetch / publish / push -->
    <div class="gd-tb gd-tb--push">
      <button type="button" class="gd-tb__btn" :disabled="!v.initialised || busy" @click="act.publish()">
        <GdIcon name="upload" :size="16" class="gd-tb__icon" />
        <span class="gd-tb__text">
          <span class="gd-tb__value">Publish repository</span>
          <span class="gd-tb__label">Publish this repository to GitHub</span>
        </span>
      </button>
    </div>
    <div class="gd-toolbar__fill"></div>
  </div>
</template>

<script setup lang="ts">
/**
 * The dark toolbar: Current repository, Current branch, and the
 * fetch/publish/push button. There is no remote in this lab, so the third
 * button is honestly "Publish repository" - which runs `git push` and shows
 * git's refusal rather than pretending a GitHub.com exists.
 */
import { computed, ref, watch } from 'vue';
import GdIcon from './GdIcon.vue';
import type { Branch, GdView } from './gd';

const props = defineProps<{
  v: GdView;
  open: 'repo' | 'branch' | null;
  busy: boolean;
  act: {
    switchTo: (name: string) => void;
    newBranch: (name: string) => void;
    mergeInto: () => void;
    publish: () => void;
    createRepo: () => void;
  };
}>();
defineEmits<{
  (event: 'toggle', which: 'repo' | 'branch'): void;
  (event: 'branch-context', ev: MouseEvent, branch: Branch): void;
}>();

const repoFilter = ref('');
const branchFilter = ref('');
const branchTab = ref<'branches' | 'prs'>('branches');
const addOpen = ref(false);
watch(() => props.open, () => { addOpen.value = false; branchFilter.value = ''; });

const DEFAULT = computed(() => props.v.branches.find(b => b.name === 'main')?.name
  || props.v.branches.find(b => b.name === 'master')?.name || '');

const filtered = computed(() => {
  const needle = branchFilter.value.trim().toLowerCase();
  return props.v.branches.filter(b => !needle || b.name.toLowerCase().includes(needle));
});

const groups = computed(() => {
  const list = filtered.value;
  const def = list.filter(b => b.name === DEFAULT.value);
  const recent = list.filter(b => b.name !== DEFAULT.value && b.current);
  const other = list.filter(b => b.name !== DEFAULT.value && !b.current);
  return [
    { label: 'Default branch', items: def },
    { label: 'Recent branches', items: recent },
    { label: 'Other branches', items: other },
  ];
});

function enterFilter() {
  const exact = filtered.value[0];
  if (exact) props.act.switchTo(exact.name);
}

function shortAgo(at: string) {
  const when = Date.parse(at);
  if (!Number.isFinite(when)) return '';
  const s = Math.max(0, (Date.now() - when) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
</script>

<style scoped>
.gd-toolbar {
  display: flex; height: 50px; background: var(--gd-toolbar); color: #fff; flex: none;
  border-bottom: 1px solid #000; position: relative; z-index: 20;
}
.gd-toolbar__fill { flex: 1; }
.gd-tb { position: relative; width: 230px; flex: none; border-right: 1px solid #141414; }
.gd-tb--push { width: 230px; }
.gd-tb__btn {
  width: 100%; height: 100%; display: flex; align-items: center; gap: 10px; padding: 0 10px;
  border: 0; border-radius: 0; background: transparent; color: #fff; text-align: left; cursor: default; font-weight: 400;
}
.gd-tb__btn:hover:not(:disabled) { background: var(--gd-toolbar-hover); }
.gd-tb__btn:disabled { opacity: 0.5; }
.gd-tb.is-open .gd-tb__btn { background: #fff; color: var(--gd-text); }
.gd-tb.is-open .gd-tb__label { color: var(--gd-text-secondary); }
.gd-tb__icon { flex: none; }
.gd-tb__text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 16px; }
.gd-tb__label { font-size: 11px; color: #959da5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-tb__value { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-tb--push .gd-tb__label { font-size: 11px; }
.gd-tb__caret { flex: none; }
.gd-pop {
  position: absolute; left: 0; top: 100%; width: 365px; max-width: calc(100cqw - 8px); background: #fff;
  color: var(--gd-text); border: 1px solid var(--gd-border); border-top: 0; box-shadow: 0 8px 24px rgba(149, 157, 165, 0.3);
  display: flex; flex-direction: column; max-height: 460px; font-size: 12px;
}
.gd-pop__tabs { display: flex; border-bottom: 1px solid var(--gd-border); flex: none; }
.gd-pop__tab {
  flex: 1; height: 32px; border: 0; border-radius: 0; font-weight: 400; background: #fff; font-size: 12px; color: var(--gd-text-secondary);
  border-bottom: 2px solid transparent; cursor: default;
}
.gd-pop__tab:hover { background: var(--gd-hover); }
.gd-pop__tab.is-active { color: var(--gd-text); font-weight: 600; border-bottom-color: var(--gd-blue); }
.gd-pop__filter { display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid var(--gd-border); position: relative; flex: none; }
.gd-pop__search {
  flex: 1; display: flex; align-items: center; gap: 4px; border: 1px solid #d1d5da; border-radius: 3px;
  padding: 0 6px; color: var(--gd-text-secondary); background: #fff;
}
.gd-pop__search:focus-within { border-color: var(--gd-blue); box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3); }
.gd-pop__input { flex: 1; min-width: 0; border: 0; outline: none; font-size: 12px; height: 24px; background: none; color: var(--gd-text); }
.gd-pop__addmenu {
  position: absolute; right: 8px; top: 38px; z-index: 2; list-style: none; margin: 0; padding: 4px 0;
  background: #fff; border: 1px solid rgba(27, 31, 35, 0.15); border-radius: 4px; box-shadow: 0 3px 12px rgba(27, 31, 35, 0.15);
}
.gd-pop__addmenu button {
  display: block; width: 100%; border: 0; background: none; text-align: left; padding: 4px 16px; font-size: 12px;
  color: var(--gd-text); white-space: nowrap; cursor: default;
}
.gd-pop__addmenu button:hover:not(:disabled) { background: var(--gd-blue); color: #fff; }
.gd-pop__addmenu button:disabled { color: #a3aab1; }
.gd-pop__scroll { overflow: auto; flex: 1; min-height: 0; }
.gd-pop__group {
  padding: 6px 10px 4px; font-weight: 600; color: var(--gd-text); background: #f6f8fa;
  border-bottom: 1px solid var(--gd-border); font-size: 12px;
}
.gd-pop__list { list-style: none; margin: 0; padding: 0; }
.gd-pop__row {
  display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; cursor: default;
}
.gd-pop__row:hover { background: var(--gd-hover); }
.gd-pop__row.is-current { font-weight: 600; }
.gd-pop__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-pop__path { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 45%; }
.gd-pop__when { font-size: 11px; }
.gd-pop__empty { padding: 16px 12px; text-align: center; color: var(--gd-text-secondary); line-height: 20px; }
.gd-pop__foot { border-top: 1px solid var(--gd-border); padding: 8px; flex: none; }
.gd-pop__merge { width: 100%; justify-content: center; }
.gd-pop__merge b { margin-left: 3px; }
.gd-pop__prs { padding: 24px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--gd-text-secondary); }
.gd-pop__prs h3 { margin: 0; font-size: 14px; color: var(--gd-text); }
.gd-pop__prs p { margin: 0; }
.gd-dim { color: var(--gd-text-secondary); }
.gd-link { border: 0; background: none; color: var(--gd-blue); padding: 0; font-size: 12px; cursor: pointer; }
.gd-link:hover { text-decoration: underline; }
@container sl-portal (max-width: 760px) {
  .gd-tb { width: auto; flex: 1 1 0; min-width: 0; }
  .gd-tb--push .gd-tb__label { display: none; }
  .gd-toolbar__fill { display: none; }
}
@container sl-portal (max-width: 520px) {
  .gd-tb__label { display: none; }
  .gd-tb__caret { display: none; }
  .gd-tb__btn { gap: 6px; padding: 0 8px; }
  .gd-tb--push .gd-tb__value { font-size: 0; }
  .gd-tb--push { flex: none; width: 44px; }
  .gd-tb--push .gd-tb__text { display: none; }
  .gd-tb { position: static; }
  .gd-pop { left: 0; right: 0; width: auto; max-width: none; }
}
</style>
