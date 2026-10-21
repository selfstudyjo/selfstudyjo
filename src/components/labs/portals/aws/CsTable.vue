<template>
  <section class="cs-table" :class="{ 'cs-table--page': variant === 'full-page' }">
    <header class="cs-table__header">
      <div class="cs-table__titlebar">
        <div class="cs-table__title">
          <component :is="variant === 'full-page' ? 'h1' : 'h2'" class="cs-table__h">
            {{ title }}
            <span v-if="showCounter" class="cs-counter">({{ counterText }})</span>
          </component>
          <a v-if="info" class="cs-info" href="#" @click.prevent>Info</a>
        </div>
        <div class="cs-table__actions"><slot name="actions" /></div>
      </div>
      <p v-if="description" class="cs-table__desc">{{ description }}</p>
      <div class="cs-table__tools">
        <div class="cs-filter">
          <CsIcon name="search" class="cs-filter__icon" />
          <input v-model="filter" class="cs-filter__input" type="search"
                 :placeholder="filterPlaceholder" :aria-label="filterPlaceholder" />
          <button v-if="filter" type="button" class="cs-filter__clear" aria-label="Clear"
                  @click="filter = ''"><CsIcon name="close" size="small" /></button>
        </div>
        <span v-if="filter" class="cs-table__matches">{{ filtered.length }} {{ filtered.length === 1 ? 'match' : 'matches' }}</span>
        <slot name="tools" />
        <div class="cs-pager">
          <button type="button" class="cs-pager__btn" :disabled="page <= 1" aria-label="Previous page"
                  @click="page--"><CsIcon name="angle-left" /></button>
          <button v-for="n in pages" :key="n" type="button" class="cs-pager__num"
                  :class="{ 'is-current': n === page }" @click="page = n">{{ n }}</button>
          <button type="button" class="cs-pager__btn" :disabled="page >= pages" aria-label="Next page"
                  @click="page++"><CsIcon name="angle-right" /></button>
        </div>
        <div class="cs-prefs">
          <button type="button" class="cs-icon-btn" aria-label="Preferences" @click="prefsOpen = !prefsOpen">
            <CsIcon name="settings" />
          </button>
          <div v-if="prefsOpen" class="cs-prefs__pop" role="dialog" aria-label="Preferences">
            <h3>Preferences</h3>
            <div class="cs-prefs__group">
              <strong>Page size</strong>
              <label v-for="n in [10, 25, 50]" :key="n" class="cs-radio">
                <input v-model="pageSize" type="radio" :value="n" /> {{ n }} resources
              </label>
            </div>
            <div class="cs-prefs__group">
              <strong>Wrap lines</strong>
              <label class="cs-check"><input v-model="wrap" type="checkbox" /> Select to see all the text and wrap the lines</label>
            </div>
            <div class="cs-prefs__group">
              <strong>Select visible columns</strong>
              <label v-for="col in columns" :key="col.id" class="cs-check">
                <input type="checkbox" :checked="!hidden.has(col.id)" @change="toggleColumn(col.id)" />
                {{ col.header }}
              </label>
            </div>
            <div class="cs-prefs__foot">
              <button type="button" class="cs-btn cs-btn--primary" @click="prefsOpen = false">Confirm</button>
            </div>
          </div>
        </div>
      </div>
    </header>
    <div class="cs-table__scroll">
      <table :class="{ 'is-wrap': wrap }">
        <thead>
          <tr>
            <th v-if="selectionType" class="cs-table__sel">
              <input v-if="selectionType === 'multi'" type="checkbox" class="cs-cb"
                     :checked="allChecked" :indeterminate.prop="someChecked && !allChecked"
                     aria-label="Select all" @change="toggleAll" />
            </th>
            <th v-for="col in visibleColumns" :key="col.id" :style="col.width ? { minWidth: col.width } : undefined"
                :class="{ 'is-sortable': col.sortKey, 'is-sorted': sortKey === col.sortKey && col.sortKey }"
                @click="col.sortKey && sortOn(col.sortKey)">
              <span class="cs-th">{{ col.header }}
                <CsIcon v-if="col.sortKey" :name="sortKey === col.sortKey && sortDir === 'desc' ? 'caret-up' : 'caret-down'"
                        size="small" class="cs-th__sort" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td :colspan="span" class="cs-table__empty"><div class="cs-table__empty-in"><span class="cs-spinner" /> Loading resources</div></td>
          </tr>
          <tr v-else-if="!items.length">
            <td :colspan="span" class="cs-table__empty">
              <div class="cs-table__empty-in">
                <strong>{{ emptyTitle }}</strong>
                <div v-if="emptyText">{{ emptyText }}</div>
                <div class="cs-table__empty-act"><slot name="empty" /></div>
              </div>
            </td>
          </tr>
          <tr v-else-if="!filtered.length">
            <td :colspan="span" class="cs-table__empty">
              <div class="cs-table__empty-in">
                <strong>No matches</strong>
                <div>We can't find a match.</div>
                <div class="cs-table__empty-act">
                  <button type="button" class="cs-btn" @click="filter = ''">Clear filter</button>
                </div>
              </div>
            </td>
          </tr>
          <tr v-for="row in pageRows" :key="keyOf(row)" :class="{ 'is-selected': isSelected(row), 'is-ctx': ctxKey === keyOf(row) }"
              @click="selectionType === 'single' && choose(row)" @contextmenu="openMenu($event, row)">
            <td v-if="selectionType" class="cs-table__sel" @click.stop>
              <input v-if="selectionType === 'multi'" type="checkbox" class="cs-cb" :checked="isSelected(row)"
                     :aria-label="'Select ' + keyOf(row)" @change="toggle(row)" />
              <input v-else type="radio" class="cs-rb" :name="radioName" :checked="isSelected(row)"
                     :aria-label="'Select ' + keyOf(row)" @change="choose(row)" />
            </td>
            <td v-for="col in visibleColumns" :key="col.id">
              <slot :name="'cell-' + col.id" :row="row">{{ cellText(col, row) }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <CsContextMenu v-if="rowMenu" ref="ctxMenu" :items="ctxItems" @select="ctxPick" @close="ctxKey = ''" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { matches, sortBy } from '@/utils/portalKit';
import CsContextMenu from './CsContextMenu.vue';
import type { DdItem } from './CsDropdown.vue';
import CsIcon from './CsIcon.vue';

export interface Column {
  id: string;
  header: string;
  cell?: (row: any) => unknown;
  sortKey?: string;
  width?: string;
}

const props = withDefaults(defineProps<{
  title: string;
  items: Record<string, any>[];
  columns: Column[];
  trackBy: string;
  selectionType?: 'single' | 'multi' | '';
  selected?: string[];
  filterPlaceholder?: string;
  filterFields?: string[];
  emptyTitle?: string;
  emptyText?: string;
  description?: string;
  variant?: 'full-page' | 'container';
  info?: boolean;
  loading?: boolean;
  counter?: boolean;
  /** The right-click menu for a row - the same entries as the page's "Actions" menu. */
  rowMenu?: (row: any) => DdItem[];
}>(), {
  selectionType: '', selected: () => [], filterPlaceholder: 'Find resources',
  filterFields: () => [], emptyTitle: 'No resources', emptyText: '', description: '',
  variant: 'container', info: true, loading: false, counter: true,
});

const emit = defineEmits<{
  (e: 'update:selected', value: string[]): void;
  (e: 'row-action', id: string, row: any): void;
}>();

const ctxMenu = ref<InstanceType<typeof CsContextMenu> | null>(null);
const ctxItems = ref<DdItem[]>([]);
const ctxKey = ref('');
let ctxRow: Record<string, any> | null = null;

/** Right-click selects the row (unless it is already part of the selection) and opens its menu. */
async function openMenu(event: MouseEvent, row: Record<string, any>) {
  if (!props.rowMenu) return;
  event.preventDefault();
  if (props.selectionType && !isSelected(row)) emit('update:selected', [keyOf(row)]);
  ctxRow = row;
  ctxKey.value = keyOf(row);
  await nextTick();
  ctxItems.value = props.rowMenu(row);
  ctxMenu.value?.show(event);
}
function ctxPick(id: string) {
  if (ctxRow) emit('row-action', id, ctxRow);
}

const filter = ref('');
const page = ref(1);
const pageSize = ref(10);
const prefsOpen = ref(false);
const wrap = ref(false);
const hidden = ref(new Set<string>());
const sortKey = ref('');
const sortDir = ref<'asc' | 'desc'>('asc');
const radioName = 'cs-rb-' + Math.random().toString(36).slice(2);

const visibleColumns = computed(() => props.columns.filter(col => !hidden.value.has(col.id)));
const span = computed(() => visibleColumns.value.length + (props.selectionType ? 1 : 0));
const fields = computed(() => props.filterFields.length ? props.filterFields
  : props.columns.map(col => col.sortKey || col.id));
const filtered = computed(() => {
  const list = props.items.filter(row => matches(row, filter.value, fields.value));
  return sortKey.value ? sortBy(list, sortKey.value, sortDir.value) : list;
});
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)));
const pageRows = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const showCounter = computed(() => props.counter);
const counterText = computed(() => props.selectionType === 'multi' && props.selected.length
  ? `${props.selected.length}/${props.items.length}` : String(props.items.length));

watch([filter, pageSize], () => { page.value = 1; });
watch(pages, value => { if (page.value > value) page.value = value; });
// A row that left the list (deleted, terminated away) leaves the selection too.
watch(() => props.items, list => {
  const keys = new Set(list.map(row => keyOf(row)));
  const kept = props.selected.filter(key => keys.has(key));
  if (kept.length !== props.selected.length) emit('update:selected', kept);
});

function keyOf(row: Record<string, any>): string {
  return String(row?.[props.trackBy] ?? '');
}
function cellText(col: Column, row: Record<string, any>) {
  const value = col.cell ? col.cell(row) : row?.[col.id];
  return value === null || value === undefined || value === '' ? '-' : String(value);
}
function isSelected(row: Record<string, any>) {
  return props.selected.includes(keyOf(row));
}
function choose(row: Record<string, any>) {
  emit('update:selected', [keyOf(row)]);
}
function toggle(row: Record<string, any>) {
  const key = keyOf(row);
  emit('update:selected', isSelected(row) ? props.selected.filter(k => k !== key) : [...props.selected, key]);
}
const allChecked = computed(() => pageRows.value.length > 0 && pageRows.value.every(isSelected));
const someChecked = computed(() => pageRows.value.some(isSelected));
function toggleAll() {
  emit('update:selected', allChecked.value ? [] : filtered.value.map(keyOf));
}
function sortOn(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}
function toggleColumn(id: string) {
  const next = new Set(hidden.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  hidden.value = next;
}
</script>

<style scoped>
.cs-table { background: #fff; border: 1px solid #c6c6cd; border-radius: 16px; box-shadow: 0 1px 2px rgba(0, 7, 22, .06); }
.cs-table__header { padding: 12px 20px 8px; }
.cs-table__titlebar { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 8px 16px; }
.cs-table__title { display: block; min-width: 0; }
.cs-table__h { display: inline; margin: 0 8px 0 0; font-size: 18px; line-height: 22px; font-weight: 700; color: #0f141a; }
.cs-table--page .cs-table__h { font-size: 20px; line-height: 24px; }
.cs-counter { font-weight: 400; color: #656871; }
.cs-info { white-space: nowrap; font-size: 12px; font-weight: 700; color: #006ce0; text-decoration: none; }
.cs-info:hover { text-decoration: underline; }
.cs-table__actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cs-table__desc { margin: 4px 0 0; color: #656871; font-size: 14px; }
.cs-table__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 12px; }
.cs-filter { position: relative; flex: 1 1 280px; max-width: 520px; display: flex; align-items: center; }
.cs-filter__icon { position: absolute; left: 12px; color: #656871; pointer-events: none; }
.cs-filter__input { width: 100%; height: 32px; padding: 4px 32px 4px 36px; border: 1px solid #8c8c94; border-radius: 8px; font: inherit; color: #0f141a; background: #fff; }
.cs-filter__input::placeholder { color: #656871; font-style: italic; }
.cs-filter__input:focus { outline: none; box-shadow: inset 0 0 0 1px #006ce0; border-color: #006ce0; }
.cs-filter__input::-webkit-search-cancel-button { display: none; }
.cs-filter__clear { position: absolute; right: 8px; border: 0; background: none; color: #424650; cursor: pointer; padding: 4px; }
.cs-table__matches { color: #656871; font-size: 14px; }
.cs-pager { display: flex; align-items: center; gap: 2px; margin-left: auto; }
.cs-pager__btn, .cs-pager__num { border: 0; background: none; min-width: 24px; height: 24px; padding: 0 4px; border-radius: 4px; color: #424650; font: inherit; cursor: pointer; }
.cs-pager__btn:disabled { color: #b4b4bb; cursor: default; }
.cs-pager__num.is-current { font-weight: 700; color: #0f141a; }
.cs-pager__num:hover:not(.is-current) { color: #006ce0; }
.cs-prefs { position: relative; border-left: 1px solid #c6c6cd; padding-left: 8px; }
.cs-icon-btn { border: 0; background: none; color: #424650; padding: 4px; border-radius: 4px; cursor: pointer; display: inline-flex; }
.cs-icon-btn:hover { color: #0f141a; }
.cs-prefs__pop { position: absolute; right: 0; top: 32px; z-index: 30; width: 300px; max-width: 80vw; background: #fff; border: 1px solid #c6c6cd; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 7, 22, .2); padding: 16px 20px; }
.cs-prefs__pop h3 { margin: 0 0 12px; font-size: 18px; }
.cs-prefs__group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 14px; }
.cs-prefs__foot { display: flex; justify-content: flex-end; }
.cs-radio, .cs-check { display: flex; gap: 8px; align-items: flex-start; color: #0f141a; }
.cs-table__scroll { container-type: inline-size; overflow-x: auto; border-top: 1px solid #c6c6cd; border-radius: 0 0 16px 16px; }
table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
th { position: sticky; top: 0; background: #fff; text-align: left; font-weight: 700; color: #424650; padding: 8px 12px 8px 20px; border-bottom: 1px solid #c6c6cd; white-space: nowrap; user-select: none; }
th + th { border-left: 1px solid transparent; }
th.is-sortable { cursor: pointer; }
th.is-sortable:hover, th.is-sorted { color: #0f141a; }
.cs-th { display: inline-flex; align-items: center; gap: 6px; }
.cs-th__sort { color: #8c8c94; }
th.is-sorted .cs-th__sort { color: #0f141a; }
td { padding: 9px 12px 9px 20px; border-bottom: 1px solid #ebebf0; color: #0f141a; white-space: nowrap; vertical-align: top; }
table.is-wrap td { white-space: normal; word-break: break-word; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover td { background: #f3f3f7; }
tbody tr.is-selected td { background: #f0fbff; border-bottom-color: #006ce0; }
tbody tr.is-ctx td { background: #e6f5ff; }
tbody tr.is-selected td:first-child { box-shadow: inset 2px 0 0 #006ce0; }
.cs-table__sel { width: 20px; padding-right: 0; }
.cs-cb, .cs-rb { accent-color: #006ce0; width: 14px; height: 14px; margin: 2px 0 0; cursor: pointer; }
.cs-table__empty { text-align: center; color: #656871; padding: 0; white-space: normal; }
/* The empty state stays in the visible part of a table that scrolls sideways, as Cloudscape's does. */
.cs-table__empty-in { position: sticky; left: 0; width: 100cqw; padding: 24px 12px; }
.cs-table__empty strong { display: block; color: #424650; margin-bottom: 4px; }
.cs-table__empty-act { margin-top: 12px; }
.cs-table__empty-act:empty { display: none; }
tbody tr:has(.cs-table__empty):hover td { background: #fff; }
.cs-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #c6c6cd; border-top-color: #424650; border-radius: 50%; animation: cs-spin .8s linear infinite; vertical-align: -1px; margin-right: 6px; }
@keyframes cs-spin { to { transform: rotate(360deg); } }
@container sl-portal (max-width: 640px) {
  .cs-table__header { padding: 12px 14px 8px; }
  th, td { padding-left: 12px; }
  .cs-filter { flex-basis: 100%; max-width: none; }
  .cs-pager { margin-left: 0; }
}
</style>
