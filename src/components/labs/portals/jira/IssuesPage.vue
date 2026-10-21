<template>
  <div class="j-page ip">
    <nav class="j-crumbs" aria-label="Breadcrumbs">
      <a href="#" @click.prevent>Projects</a><span class="sep">/</span>
      <a href="#" @click.prevent="ctx.go('board')">Platform</a>
    </nav>
    <div class="j-header">
      <h1 class="j-h1">{{ currentFilter ? currentFilter.label : 'Search' }}</h1>
      <div class="j-actions">
        <button type="button" class="j-btn" @click="ctx.openCreate()"><JiraIcon name="plus" /> Create</button>
      </div>
    </div>

    <div class="ip__layout">
      <aside class="ip__filters" aria-label="Filters">
        <div class="ip__filters-head">Filters</div>
        <button v-for="f in FILTERS" :key="f.id" type="button" class="ip__filter"
                :class="{ 'is-selected': currentFilter?.id === f.id }" @click="applyFilter(f)">
          <JiraIcon :name="f.icon" :size="14" /> {{ f.label }}
          <span class="ip__filter-count">{{ countFor(f.jql) }}</span>
        </button>
      </aside>

      <section class="ip__main">
        <div class="ip__bar">
          <template v-if="mode === 'basic'">
            <div class="ip__search">
              <JiraIcon name="search" class="ip__search-icon" />
              <input v-model="basic.text" class="j-input" type="search" placeholder="Search work" aria-label="Search work"
                     @keydown.enter="runBasic" />
            </div>
            <select v-model="basic.status" class="j-select ip__pick" aria-label="Status" @change="runBasic">
              <option value="">Status: All</option>
              <option v-for="(label, id) in STATUS_LABEL" :key="id" :value="label">{{ label }}</option>
            </select>
            <select v-model="basic.assignee" class="j-select ip__pick" aria-label="Assignee" @change="runBasic">
              <option value="">Assignee: All</option><option value="EMPTY">Unassigned</option>
              <option v-for="p in team" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <select v-model="basic.type" class="j-select ip__pick" aria-label="Type" @change="runBasic">
              <option value="">Type: All</option>
              <option v-for="t in ['Story', 'Task', 'Bug']" :key="t" :value="t">{{ t }}</option>
            </select>
            <select v-model="basic.label" class="j-select ip__pick" aria-label="Label" @change="runBasic">
              <option value="">Labels: All</option>
              <option v-for="l in allLabels" :key="l" :value="l">{{ l }}</option>
            </select>
          </template>
          <form v-else class="ip__jql" @submit.prevent="runJql">
            <textarea v-model="jqlText" class="j-textarea ip__jql-input" :class="{ 'is-invalid': !compiled.ok }" rows="2"
                      spellcheck="false" aria-label="JQL query" placeholder="project = PLAT AND status = &quot;In Progress&quot; ORDER BY priority DESC"
                      @keydown.enter.exact.prevent="runJql" />
            <button type="submit" class="j-btn j-btn--primary">Search</button>
          </form>
          <div class="ip__mode" role="group" aria-label="Search mode">
            <button type="button" class="j-btn j-btn--compact" :class="{ 'is-on': mode === 'basic' }" @click="toBasic">Basic</button>
            <button type="button" class="j-btn j-btn--compact" :class="{ 'is-on': mode === 'jql' }" @click="toJql">JQL</button>
          </div>
        </div>
        <div v-if="!compiled.ok" class="j-msg j-msg--error"><JiraIcon name="error" :size="20" />
          <div><div class="j-msg__title">The JQL query is invalid</div>{{ compiled.error }}</div></div>
        <p v-else-if="mode === 'jql'" class="j-small ip__hint">
          Fields: project, key, summary, text, description, status, assignee, type, priority, labels, component,
          sprint, "story points", flagged, created, updated, watcher, issueLinkType ·
          Functions: openSprints(), closedSprints(), currentUser() · ORDER BY field ASC|DESC
        </p>

        <div class="ip__tools">
          <span class="j-muted">{{ results.length }} work item{{ results.length === 1 ? '' : 's' }}</span>
          <template v-if="selected.length">
            <span class="ip__sel">{{ selected.length }} selected</span>
            <button type="button" class="j-btn j-btn--compact" :disabled="busy" @click="bulkSprint">Move to {{ sprintName(sprint.n) }}</button>
            <button type="button" class="j-btn j-btn--compact" :disabled="busy" @click="bulkBacklog">Move to Backlog</button>
            <button type="button" class="j-btn j-btn--compact j-btn--subtle" @click="selected = []">Clear</button>
          </template>
          <span class="ip__spacer" />
          <JiraDropdown :items="columnItems" label="Columns" align="right" heading="Show columns"
                        trigger-class="j-btn j-btn--compact" @select="toggleColumn">
            <template #trigger><JiraIcon name="grid" :size="14" /> Columns</template>
            <template #item="{ item }"><span class="ip__col-item"><input type="checkbox" :checked="item.on" tabindex="-1" aria-hidden="true" /> {{ item.label }}</span></template>
          </JiraDropdown>
        </div>

        <div class="j-table-wrap">
          <table class="j-table ip__table">
            <thead>
              <tr>
                <th class="ip__check"><input type="checkbox" :checked="allSelected" aria-label="Select all" @change="toggleAll" /></th>
                <th v-for="col in shownColumns" :key="col.id">
                  <button v-if="col.sort" type="button" class="ip__sort" @click="sortBy(col.sort)">
                    {{ col.label }}
                    <JiraIcon v-if="sortField === col.sort" :name="sortDir === 'asc' ? 'arrow-up' : 'arrow-down'" :size="12" />
                  </button>
                  <span v-else>{{ col.label }}</span>
                </th>
                <th><span class="ip__sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="issue in results" :key="issue.id" :class="{ 'is-selected': selected.includes(issue.id), 'is-flagged': issue.flagged }"
                  @contextmenu="contextMenu($event, issue)">
                <td class="ip__check"><input type="checkbox" :checked="selected.includes(issue.id)" :aria-label="'Select ' + issue.id"
                                             @change="toggleRow(issue.id)" /></td>
                <td v-for="col in shownColumns" :key="col.id" :class="'ip__c-' + col.id">
                  <template v-if="col.id === 'type'"><JiraIcon :name="issue.type" kind="type" :title="TYPE_LABEL[issue.type]" /></template>
                  <template v-else-if="col.id === 'key'"><button type="button" class="j-link j-nowrap" @click="ctx.openIssue(issue.id)">{{ issue.id }}</button></template>
                  <template v-else-if="col.id === 'summary'">
                    <button type="button" class="ip__summary" @click="ctx.openIssue(issue.id)">{{ issue.title }}</button>
                    <JiraIcon v-if="issue.flagged" name="flag" :size="12" class="ip__flag" title="Flagged" />
                  </template>
                  <template v-else-if="col.id === 'status'"><span class="j-lozenge" :class="'j-lozenge--' + issue.status">{{ STATUS_LABEL[issue.status] }}</span></template>
                  <template v-else-if="col.id === 'assignee'"><span class="ip__person"><JiraAvatar :name="issue.assignee" :size="24" /> {{ issue.assignee || 'Unassigned' }}</span></template>
                  <template v-else-if="col.id === 'priority'"><span class="ip__person"><JiraIcon :name="issue.value" kind="priority" /> {{ PRIORITY_LABEL[issue.value] }}</span></template>
                  <template v-else-if="col.id === 'labels'"><span v-for="l in issue.labels" :key="l" class="ip__label">{{ l }}</span></template>
                  <template v-else-if="col.id === 'points'"><span class="j-points" :class="'j-points--' + issue.status">{{ issue.points }}</span></template>
                  <template v-else-if="col.id === 'sprint'">{{ issue.in_sprint ? sprintName(sprint.n) : (issue.sprint ? sprintName(Number(issue.sprint)) : '') }}</template>
                  <template v-else-if="col.id === 'component'">{{ issue.skill }}</template>
                  <template v-else-if="col.id === 'updated'">Sprint {{ updatedOf(issue) }}</template>
                  <template v-else-if="col.id === 'created'">Sprint {{ issue.created }}</template>
                </td>
                <td class="ip__more">
                  <button type="button" class="j-btn j-btn--subtle j-btn--icon j-btn--compact" :aria-label="'Actions for ' + issue.id"
                          @click="contextMenu($event, issue)"><JiraIcon name="more" /></button>
                </td>
              </tr>
              <tr v-if="!results.length"><td :colspan="shownColumns.length + 2" class="ip__none">
                <div class="j-empty"><h3>No work items were found matching your search</h3>
                  <p>Try modifying your search criteria or creating a new work item.</p></div></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The issue navigator: saved filters, Basic and JQL search, sortable columns,
 * a column chooser, bulk move and the same right-click menu as the board.
 * Searching is a read; every action from here is still an `mgr` command.
 */
import { computed, reactive, ref, watch } from 'vue';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import { PRIORITY_LABEL, sprintName, STATUS_LABEL, TYPE_LABEL, type Issue } from './jiraKit';
import { compileJql, sortIssues, type JqlContext } from './jql';
import { useJira } from './useJira';

const { ctx, all, team, sprint, addToSprint, moveToBacklog, contextMenu } = useJira();
const busy = ctx.busy;

interface SavedFilter { id: string; label: string; jql: string; icon: string }
const FILTERS: SavedFilter[] = [
  { id: 'all', label: 'All work items', jql: 'project = PLAT ORDER BY rank', icon: 'list' },
  { id: 'open', label: 'Open work items', jql: 'project = PLAT AND status != Done ORDER BY priority DESC', icon: 'backlog' },
  { id: 'sprint', label: 'Current sprint', jql: 'sprint in openSprints() ORDER BY status, rank', icon: 'board' },
  { id: 'unassigned', label: 'Unassigned', jql: 'assignee is EMPTY AND status != Done', icon: 'team' },
  { id: 'flagged', label: 'Flagged', jql: 'flagged is not EMPTY', icon: 'flag' },
  { id: 'watching', label: 'Watched by me', jql: 'watcher = currentUser()', icon: 'eye' },
  { id: 'done', label: 'Done work items', jql: 'status = Done ORDER BY updated DESC', icon: 'check' },
  { id: 'bugs', label: 'Open bugs', jql: 'type = Bug AND status != Done', icon: 'error' },
];

const jqlCtx = computed<JqlContext>(() => ({ sprint: sprint.value.n, committed: sprint.value.committed,
  people: team.value.map(p => ({ id: p.id, name: p.name })) }));

const mode = ref<'basic' | 'jql'>(ctx.jql.value ? 'jql' : 'basic');
const jqlText = ref(ctx.jql.value || FILTERS[0].jql);
const applied = ref(jqlText.value);
const currentFilter = ref<SavedFilter | null>(ctx.jql.value ? null : FILTERS[0]);
ctx.jql.value = '';
const basic = reactive({ text: '', status: '', assignee: '', type: '', label: '' });

const compiled = computed(() => compileJql(applied.value, jqlCtx.value));
const rankOf = (issue: Issue) => all.value.findIndex(row => row.id === issue.id);
const results = computed(() => compiled.value.ok
  ? sortIssues(all.value.filter(compiled.value.test), compiled.value.order, rankOf) : []);
const sortField = computed(() => compiled.value.order[0]?.field || '');
const sortDir = computed(() => compiled.value.order[0]?.dir || 'asc');
const allLabels = computed(() => Array.from(new Set(all.value.flatMap(i => i.labels))).sort());

function countFor(jql: string) {
  const c = compileJql(jql, jqlCtx.value);
  return c.ok ? all.value.filter(c.test).length : 0;
}

function quote(value: string) {
  return /^[A-Za-z0-9_.-]+$/.test(value) ? value : '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function basicJql() {
  const parts = ['project = PLAT'];
  if (basic.text.trim()) parts.push(`text ~ ${quote(basic.text.trim())}`);
  if (basic.status) parts.push(`status = ${quote(basic.status)}`);
  if (basic.assignee) parts.push(basic.assignee === 'EMPTY' ? 'assignee is EMPTY' : `assignee = ${quote(basic.assignee)}`);
  if (basic.type) parts.push(`type = ${basic.type}`);
  if (basic.label) parts.push(`labels = ${quote(basic.label)}`);
  return parts.join(' AND ') + ' ORDER BY rank';
}

function runBasic() {
  currentFilter.value = null;
  jqlText.value = basicJql();
  applied.value = jqlText.value;
}
function runJql() {
  currentFilter.value = FILTERS.find(f => f.jql === jqlText.value.trim()) || null;
  applied.value = jqlText.value.trim();
}
function toBasic() { mode.value = 'basic'; }
function toJql() { mode.value = 'jql'; jqlText.value = applied.value; }
function applyFilter(f: SavedFilter) {
  currentFilter.value = f;
  jqlText.value = f.jql;
  applied.value = f.jql;
  mode.value = 'jql';
  selected.value = [];
}

function sortBy(fieldName: string) {
  const base = applied.value.replace(/\s+ORDER\s+BY[\s\S]*$/i, '').trim();
  const dir = sortField.value === fieldName && sortDir.value === 'asc' ? 'DESC' : 'ASC';
  const name = fieldName === 'Story point estimate' ? '"story points"' : fieldName;
  applied.value = `${base ? base + ' ' : ''}ORDER BY ${name} ${dir}`;
  jqlText.value = applied.value;
  currentFilter.value = null;
}

interface Col { id: string; label: string; sort?: string }
const COLUMNS: Col[] = [
  { id: 'type', label: 'Type', sort: 'type' }, { id: 'key', label: 'Key', sort: 'key' },
  { id: 'summary', label: 'Summary', sort: 'summary' }, { id: 'status', label: 'Status', sort: 'status' },
  { id: 'assignee', label: 'Assignee', sort: 'assignee' }, { id: 'priority', label: 'Priority', sort: 'priority' },
  { id: 'labels', label: 'Labels' }, { id: 'points', label: 'Story point estimate', sort: 'Story point estimate' },
  { id: 'sprint', label: 'Sprint' }, { id: 'component', label: 'Component' },
  { id: 'created', label: 'Created', sort: 'created' }, { id: 'updated', label: 'Updated', sort: 'updated' },
];
const visible = ref<string[]>(['type', 'key', 'summary', 'status', 'assignee', 'priority', 'labels', 'points', 'sprint']);
const shownColumns = computed(() => COLUMNS.filter(c => visible.value.includes(c.id)));
const columnItems = computed<DropItem[]>(() => COLUMNS.map(c => ({ label: c.label, value: c.id, on: visible.value.includes(c.id),
  disabled: c.id === 'key' || c.id === 'summary' })));
function toggleColumn(id: string) {
  visible.value = visible.value.includes(id) ? visible.value.filter(x => x !== id)
    : COLUMNS.map(c => c.id).filter(c => c === id || visible.value.includes(c));
}

const selected = ref<string[]>([]);
const allSelected = computed(() => results.value.length > 0 && results.value.every(i => selected.value.includes(i.id)));
function toggleRow(id: string) {
  selected.value = selected.value.includes(id) ? selected.value.filter(x => x !== id) : [...selected.value, id];
}
function toggleAll() { selected.value = allSelected.value ? [] : results.value.map(i => i.id); }
watch(results, list => { selected.value = selected.value.filter(id => list.some(i => i.id === id)); });

async function bulkSprint() {
  const keys = selected.value.filter(id => { const i = all.value.find(r => r.id === id); return i && !i.in_sprint && i.status !== 'done'; });
  if (!keys.length) { ctx.flag('info', 'Nothing to move', 'The selected work items are already in the sprint or done.'); return; }
  if (await addToSprint(keys)) selected.value = [];
}
async function bulkBacklog() {
  const keys = selected.value.filter(id => sprint.value.committed.includes(id));
  if (!keys.length) { ctx.flag('info', 'Nothing to move', 'None of the selected work items are in the sprint.'); return; }
  if (await moveToBacklog(keys)) selected.value = [];
}

const updatedOf = (issue: Issue) => issue.events.length ? issue.events[issue.events.length - 1].sprint : issue.created;
</script>

<style scoped>
.ip__layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 24px; align-items: start; }
.ip__filters { display: flex; flex-direction: column; gap: 2px; }
.ip__filters-head { padding: 0 8px 6px; font-size: 12px; font-weight: 653; color: var(--j-text-subtlest); text-transform: uppercase; }
.ip__filter { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 8px; border: 0; border-radius: 3px;
  background: transparent; color: var(--j-text-subtle); font: inherit; text-align: left; cursor: pointer; }
.ip__filter:hover { background: var(--j-neutral-hover); color: var(--j-text); }
.ip__filter.is-selected { background: var(--j-selected); color: var(--j-selected-text); }
.ip__filter-count { margin-left: auto; font-size: 12px; color: var(--j-text-subtlest); }
.ip__bar { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.ip__search { position: relative; width: 200px; }
.j-page .ip__search .j-input { padding-left: 30px; min-height: 32px; height: 32px; }
.ip__search-icon { position: absolute; left: 8px; top: 8px; color: var(--j-text-subtle); }
.j-page .ip__pick { width: auto; min-height: 32px; height: 32px; padding-top: 4px; padding-bottom: 4px; }
.ip__jql { display: flex; gap: 8px; flex: 1; min-width: 260px; align-items: flex-start; }
.j-page .ip__jql-input { min-height: 36px; font: 13px/18px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; }
.ip__mode { display: inline-flex; gap: 2px; margin-left: auto; }
.j-btn.is-on { background: var(--j-selected); color: var(--j-selected-text); }
.ip__hint { margin: -4px 0 12px; }
.ip__tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.ip__sel { font-weight: 600; }
.ip__spacer { flex: 1; }
.ip__col-item { display: inline-flex; align-items: center; gap: 8px; }
.ip__table td { padding: 6px 8px; }
.ip__check { width: 28px; }
.ip__sort { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; font: inherit;
  font-weight: inherit; color: inherit; cursor: pointer; }
.ip__sort:hover { color: var(--j-text); text-decoration: underline; }
.ip__summary { padding: 0; border: 0; background: none; font: inherit; color: var(--j-text); text-align: left; cursor: pointer; overflow-wrap: anywhere; }
.ip__summary:hover { color: var(--j-link); text-decoration: underline; }
.ip__flag { margin-left: 6px; color: #C9372C; }
.ip__table tr.is-flagged { background: #FFF7D6; }
.ip__person { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.ip__label { display: inline-block; margin: 0 4px 2px 0; padding: 0 4px; border-radius: 3px; background: var(--j-neutral);
  font-size: 12px; line-height: 18px; white-space: nowrap; }
.ip__more { width: 32px; text-align: right; }
.ip__none { padding: 0; }
.ip__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@container sl-portal (max-width: 900px) {
  .ip__layout { grid-template-columns: minmax(0, 1fr); }
  .ip__filters { flex-direction: row; flex-wrap: wrap; }
  .ip__filters-head { display: none; }
  .ip__filter-count { margin-left: 4px; }
}
@container sl-portal (max-width: 640px) {
  .ip__search { flex: 1 1 160px; }
  .ip__mode { margin-left: 0; }
  .ip__jql { flex-direction: column; }
}
</style>
