<template>
  <JiraModal :title="issue ? issue.id + ' ' + issue.title : issueKey" width="x-large" bare @close="$emit('close')">
    <div v-if="!issue" class="j-empty">
      <h3>This issue can't be found</h3>
      <p>{{ issueKey }} may have been deleted, or you may not have permission to view it.</p>
      <button type="button" class="j-btn j-btn--primary" @click="$emit('close')">Close</button>
    </div>
    <div v-else class="iv">
      <header class="iv__bar">
        <nav class="iv__crumbs" aria-label="Breadcrumbs">
          <span class="iv__proj" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><rect width="24" height="24" rx="4" fill="#FF8F73" /><path d="M6 16l4-8 3 5 2-3 3 6z" fill="#fff" /></svg></span>
          <a href="#" @click.prevent="$emit('close')">Platform</a><span class="iv__sep">/</span>
          <JiraDropdown :items="typeItems" :selected="issue.type" label="Change issue type" trigger-class="iv__typebtn"
                        @select="v => edit({ '--type': v }, 'Issue type updated')">
            <template #trigger><JiraIcon :name="issue.type" kind="type" /></template>
          </JiraDropdown>
          <span class="iv__key">{{ issue.id }}</span>
        </nav>
        <div class="iv__tools">
          <button type="button" class="j-btn j-btn--subtle iv__watch" :class="{ 'is-on': issue.watching }"
                  :title="issue.watching ? 'Stop watching' : 'Start watching'" :aria-pressed="issue.watching"
                  @click="watch_(issue!, !issue.watching)"><JiraIcon name="eye" /> {{ issue.watching ? 1 : 0 }}</button>
          <button type="button" class="j-btn j-btn--subtle j-btn--icon" title="Copy link" aria-label="Copy link"
                  @click="copy(issueUrl(issue.id), 'Link')"><JiraIcon name="share" /></button>
          <JiraDropdown :items="actionItems" label="Actions" align="right" trigger-class="j-btn j-btn--subtle j-btn--icon"
                        @select="onAction">
            <template #trigger><JiraIcon name="more" /></template>
          </JiraDropdown>
          <button type="button" class="j-btn j-btn--subtle j-btn--icon" aria-label="Close" autofocus @click="$emit('close')">
            <JiraIcon name="close" /></button>
        </div>
      </header>

      <div class="iv__grid">
        <div class="iv__main">
          <form v-if="editingTitle" class="iv__title-form" @submit.prevent="saveTitle">
            <input ref="titleField" v-model="title" class="j-input iv__title-input" maxlength="255" aria-label="Summary"
                   @keydown.esc="editingTitle = false" />
            <div class="iv__edit-actions">
              <button type="submit" class="j-btn j-btn--primary j-btn--compact" aria-label="Save"><JiraIcon name="check" :size="14" /></button>
              <button type="button" class="j-btn j-btn--compact" aria-label="Cancel" @click="editingTitle = false"><JiraIcon name="close" :size="14" /></button>
            </div>
          </form>
          <h1 v-else class="iv__title" tabindex="0" role="button" title="Click to edit the summary"
              @click="startTitle" @keydown.enter.prevent="startTitle">{{ issue.title }}</h1>

          <div v-if="issue.flagged" class="j-msg j-msg--warning iv__flagged">
            <JiraIcon name="flag" :size="16" />
            <div><div class="j-msg__title">Flagged</div>This work item is impeded.</div>
            <button type="button" class="j-btn j-btn--compact" @click="setFlag(issue!, false)">Remove flag</button>
          </div>
          <div class="iv__buttons">
            <button type="button" class="j-btn" disabled title="Attachments are not part of this simulation"><JiraIcon name="attach" /> Attach</button>
            <JiraDropdown :items="krItems" :selected="issue.kr" label="Link key result" trigger-class="j-btn"
                          heading="Roll up to a key result" @select="setKr">
              <template #trigger><JiraIcon name="link" /> Link key result</template>
            </JiraDropdown>
            <button type="button" class="j-btn" @click="showDelegate = !showDelegate"><JiraIcon name="team" /> Delegate</button>
            <button type="button" class="j-btn" @click="addingSub = true"><JiraIcon name="subtask" /> Add subtask</button>
            <button type="button" class="j-btn" @click="ctx.openDialog('link', issue.id)"><JiraIcon name="link" /> Link work item</button>
          </div>

          <form v-if="showDelegate" class="iv__panel" @submit.prevent="delegate">
            <h3 class="j-h3">Delegate {{ issue.id }}</h3>
            <div class="j-grid2">
              <div class="j-field"><label class="j-label" for="iv-dl-who">Delegate to<span class="j-req">*</span></label>
                <select id="iv-dl-who" v-model="dl.who" class="j-select"><option value="" disabled>Select a person</option>
                  <option v-for="p in team" :key="p.id" :value="p.id">{{ p.name }}</option></select></div>
              <div class="j-field"><label class="j-label" for="iv-dl-auth">Authority</label>
                <select id="iv-dl-auth" v-model="dl.authority" class="j-select">
                  <option value="inform">Inform — you still decide</option>
                  <option value="recommend">Recommend — they propose, you approve</option>
                  <option value="decide">Decide — they decide, you hear at the check-in</option></select></div>
              <div class="j-field"><label class="j-label" for="iv-dl-check">Check-in</label>
                <select id="iv-dl-check" v-model="dl.checkin" class="j-select">
                  <option value="">None</option><option value="weekly">Weekly</option>
                  <option value="biweekly">Every two weeks</option></select>
                <span v-if="!dl.checkin" class="j-help">Delegation without a check-in is abdication.</span></div>
            </div>
            <div class="j-actions"><button type="submit" class="j-btn j-btn--primary" :disabled="!dl.who">Delegate</button>
              <button type="button" class="j-btn j-btn--subtle" @click="showDelegate = false">Cancel</button></div>
          </form>

          <section class="iv__section">
            <h2 class="j-h3">Description</h2>
            <div v-if="editingDesc">
              <textarea ref="descField" v-model="description" class="j-textarea" rows="6" aria-label="Description" />
              <div class="j-actions iv__gap">
                <button type="button" class="j-btn j-btn--primary" @click="saveDescription">Save</button>
                <button type="button" class="j-btn j-btn--subtle" @click="editingDesc = false">Cancel</button>
              </div>
            </div>
            <div v-else class="iv__desc" :class="{ 'is-empty': !issue.description }" tabindex="0" role="button"
                 @click="startDesc" @keydown.enter.prevent="startDesc">
              {{ issue.description || 'Add a description…' }}
            </div>
          </section>

          <section class="iv__section">
            <div class="iv__sec-head"><h2 class="j-h3">Subtasks</h2>
              <span v-if="issue.subtasks.length" class="j-small">{{ subsDone }} of {{ issue.subtasks.length }} done</span>
              <span class="iv__spacer" />
              <button type="button" class="j-btn j-btn--subtle j-btn--icon j-btn--compact" aria-label="Add subtask" title="Add subtask"
                      @click="addingSub = true"><JiraIcon name="plus" /></button></div>
            <div v-if="issue.subtasks.length" class="j-progress j-progress--green iv__subbar"><span :style="{ width: (100 * subsDone / issue.subtasks.length) + '%' }" /></div>
            <ul class="iv__subs">
              <li v-for="sub in issue.subtasks" :key="sub.n" class="iv__sub" :class="{ 'is-done': sub.done }"
                  @contextmenu="subMenu($event, sub)">
                <input type="checkbox" :checked="sub.done" :aria-label="'Done: ' + sub.title" :disabled="busy"
                       @change="subtask(sub.done ? '--todo' : '--done', String(sub.n), sub.done ? 'Subtask reopened' : 'Subtask done')" />
                <JiraIcon name="subtask" :size="14" class="iv__sub-icon" />
                <span class="j-key">{{ issue.id }}-{{ sub.n }}</span>
                <form v-if="renaming === sub.n" class="iv__sub-form" @submit.prevent="renameSub(sub.n)">
                  <input v-model="subTitle" class="j-input iv__select" aria-label="Subtask title" autofocus @keydown.esc="renaming = 0" />
                  <button type="submit" class="j-btn j-btn--primary j-btn--compact">Save</button>
                </form>
                <span v-else class="iv__sub-title">{{ sub.title }}</span>
                <span class="j-lozenge" :class="sub.done ? 'j-lozenge--done' : 'j-lozenge--todo'">{{ sub.done ? 'Done' : 'To Do' }}</span>
                <button type="button" class="j-btn j-btn--subtle j-btn--icon j-btn--compact" :aria-label="'Actions for subtask ' + sub.n"
                        @click="subMenu($event, sub)"><JiraIcon name="more" /></button>
              </li>
            </ul>
            <form v-if="addingSub" class="iv__sub-new" @submit.prevent="addSub">
              <input v-model="newSub" class="j-input iv__select" placeholder="What needs to be done?" aria-label="New subtask"
                     maxlength="255" autofocus @keydown.esc="addingSub = false" />
              <button type="submit" class="j-btn j-btn--primary j-btn--compact" :disabled="!newSub.trim() || busy">Create</button>
              <button type="button" class="j-btn j-btn--subtle j-btn--compact" @click="addingSub = false">Cancel</button>
            </form>
            <p v-if="!issue.subtasks.length && !addingSub" class="j-small">Break this work item into smaller steps. Ticking them off does not deliver points — a sprint does.</p>
          </section>

          <section class="iv__section">
            <div class="iv__sec-head"><h2 class="j-h3">Linked work items</h2><span class="iv__spacer" />
              <button type="button" class="j-btn j-btn--subtle j-btn--icon j-btn--compact" aria-label="Link work item" title="Link work item"
                      @click="ctx.openDialog('link', issue.id)"><JiraIcon name="plus" /></button></div>
            <template v-for="group in linkGroups" :key="group.type">
              <div class="j-small iv__link-type">{{ group.type }}</div>
              <ul class="iv__subs">
                <li v-for="link in group.links" :key="link.key" class="iv__sub">
                  <JiraIcon :name="link.issue?.type || 'story'" kind="type" />
                  <button type="button" class="j-link j-nowrap" @click="ctx.openIssue(link.key)">{{ link.key }}</button>
                  <span class="iv__sub-title">{{ link.issue?.title || '(deleted)' }}</span>
                  <span v-if="link.issue" class="j-lozenge" :class="'j-lozenge--' + link.issue.status">{{ STATUS_LABEL[link.issue.status] }}</span>
                  <button type="button" class="j-btn j-btn--subtle j-btn--icon j-btn--compact" :aria-label="'Remove link to ' + link.key"
                          title="Remove link" @click="unlinkIssue(issue!, link.key)"><JiraIcon name="close" :size="14" /></button>
                </li>
              </ul>
            </template>
            <p v-if="!issue.links.length" class="j-small">No linked work items. Link one to record that it blocks, duplicates or relates to this one.</p>
          </section>

          <section class="iv__section">
            <h2 class="j-h3">Delivery</h2>
            <div class="iv__delivery">
              <div class="j-progress j-progress--green"><span :style="{ width: deliveredPct + '%' }" /></div>
              <span>{{ issue.done_points }} of {{ issue.points }} story points delivered</span>
            </div>
            <p class="j-small iv__gap">
              <template v-if="issue.assignee">For {{ issue.assignee }} this costs {{ issue.cost }} points of capacity
                ({{ costNote }}).</template>
              <template v-else>Unassigned work is not delivered — nobody picks it up.</template>
              <template v-if="issue.carried"> Carried over {{ issue.carried }} time(s).</template>
            </p>
          </section>

          <section class="iv__section">
            <button type="button" class="iv__toggle" :aria-expanded="showRaci" @click="showRaci = !showRaci">
              <JiraIcon :name="showRaci ? 'chevron-down' : 'chevron-right'" /> RACI
              <span v-if="raciSummary" class="iv__raci-sum">{{ raciSummary }}</span>
            </button>
            <form v-if="showRaci" class="iv__raci" @submit.prevent="saveRaci">
              <table class="j-table">
                <thead><tr><th>Person</th><th title="Responsible">R</th><th title="Accountable">A</th>
                  <th title="Consulted">C</th><th title="Informed">I</th></tr></thead>
                <tbody>
                  <tr v-for="p in team" :key="p.id">
                    <td><span class="iv__person"><JiraAvatar :name="p.name" :size="24" /> {{ p.name }}</span></td>
                    <td v-for="role in ROLES" :key="role"><input v-model="raci[role]" type="checkbox" :value="p.id"
                      :aria-label="`${p.name} ${role}`" /></td>
                  </tr>
                </tbody>
              </table>
              <p class="j-small iv__gap">Exactly one Accountable, always. Zero means nobody carries it; two means each believes the other does.</p>
              <button type="submit" class="j-btn iv__gap" :disabled="!raci.responsible.length && !raci.accountable.length">Save RACI</button>
            </form>
          </section>

          <section class="iv__section">
            <h2 class="j-h3">Activity</h2>
            <div class="j-tabs" role="tablist">
              <button v-for="t in ['All', 'Comments', 'History']" :key="t" type="button" role="tab" class="j-tab"
                      :class="{ 'is-active': tab === t }" :aria-selected="tab === t" @click="tab = t">{{ t }}</button>
            </div>
            <div v-if="tab !== 'History'" class="iv__comment-new">
              <JiraAvatar name="You Manager" :size="32" />
              <div class="iv__comment-box">
                <textarea v-if="commenting" ref="commentField" v-model="comment" class="j-textarea" rows="3"
                          placeholder="Add a comment…" aria-label="Add a comment" />
                <button v-else type="button" class="iv__comment-fake" @click="startComment">Add a comment…</button>
                <div v-if="commenting" class="j-actions iv__gap">
                  <button type="button" class="j-btn j-btn--primary" :disabled="!comment.trim()" @click="saveComment">Save</button>
                  <button type="button" class="j-btn j-btn--subtle" @click="commenting = false; comment = ''">Cancel</button>
                </div>
                <p v-else class="j-small">Pro tip: press <kbd>M</kbd> to comment</p>
              </div>
            </div>
            <ol class="iv__activity">
              <li v-for="(entry, index) in activity" :key="index" class="iv__entry">
                <JiraAvatar name="You Manager" :size="32" />
                <div>
                  <div class="iv__entry-head"><strong>You</strong>
                    <span v-if="entry.edited" class="j-small">(edited)</span>
                    <span v-if="entry.kind === 'history'">{{ entry.text }}</span>
                    <span class="j-small">Sprint {{ entry.sprint }}</span></div>
                  <template v-if="entry.kind === 'comment'">
                    <div v-if="editingComment === entry.order" class="iv__gap">
                      <textarea v-model="commentDraft" class="j-textarea" rows="3" aria-label="Edit comment" />
                      <div class="j-actions iv__gap">
                        <button type="button" class="j-btn j-btn--primary" :disabled="!commentDraft.trim()" @click="saveCommentEdit(entry.order)">Save</button>
                        <button type="button" class="j-btn j-btn--subtle" @click="editingComment = -1">Cancel</button>
                      </div>
                    </div>
                    <template v-else>
                      <div class="iv__entry-body">{{ entry.text }}</div>
                      <div class="iv__entry-actions">
                        <button type="button" class="j-link" @click="startCommentEdit(entry.order, entry.text)">Edit</button>
                        <span aria-hidden="true">·</span>
                        <button type="button" class="j-link" @click="deleteComment(entry.order)">Delete</button>
                      </div>
                    </template>
                  </template>
                </div>
              </li>
              <li v-if="!activity.length" class="j-small">Nothing here yet.</li>
            </ol>
          </section>
        </div>

        <aside class="iv__side">
          <div class="iv__status">
            <JiraDropdown :items="statusItems" label="Change status" trigger-class="iv__status-btn" :class="'is-' + issue.status"
                          @select="v => move(issue!, v as any)">
              <template #trigger>{{ STATUS_LABEL[issue.status] || issue.status }} <JiraIcon name="chevron-down" :size="12" /></template>
            </JiraDropdown>
          </div>

          <details class="iv__details" open>
            <summary>Details</summary>
            <dl>
              <dt>Assignee</dt>
              <dd>
                <JiraDropdown :items="assigneeItems" :selected="issue.assignee_id" label="Assignee" heading="Assign to"
                              trigger-class="iv__field-btn" @select="v => assign(issue!, v)">
                  <template #trigger><JiraAvatar :name="issue.assignee" :size="24" /> {{ issue.assignee || 'Unassigned' }}</template>
                </JiraDropdown>
              </dd>
              <dt>Reporter</dt>
              <dd><span class="iv__field-static"><JiraAvatar name="You Manager" :size="24" /> You</span></dd>
              <dt>Labels</dt>
              <dd>
                <button type="button" class="iv__labels" title="Edit labels" @click="ctx.openDialog('labels', issue.id)">
                  <span v-for="l in issue.labels" :key="l" class="iv__label">{{ l }}</span>
                  <span v-if="!issue.labels.length" class="j-muted">None</span>
                </button>
              </dd>
              <dt>Component</dt>
              <dd>
                <select class="j-select iv__select" :value="issue.skill" aria-label="Component"
                        @change="e => edit({ '--skill': (e.target as HTMLSelectElement).value }, 'Component updated')">
                  <option v-for="skill in skills" :key="skill" :value="skill">{{ skill }}</option>
                </select>
              </dd>
              <dt>Story point estimate</dt>
              <dd>
                <input class="j-input iv__select" type="number" min="0" max="100" :value="issue.points"
                       :disabled="issue.status === 'done'" aria-label="Story point estimate"
                       @change="e => edit({ '--points': (e.target as HTMLInputElement).value }, 'Story point estimate updated')" />
              </dd>
              <dt>Priority</dt>
              <dd>
                <JiraDropdown :items="priorityItems" :selected="issue.value" label="Priority" trigger-class="iv__field-btn"
                              @select="v => edit({ '--value': v }, 'Priority updated')">
                  <template #trigger><JiraIcon :name="issue.value" kind="priority" /> {{ PRIORITY_LABEL[issue.value] }}</template>
                </JiraDropdown>
              </dd>
              <dt>Sprint</dt>
              <dd>
                <select class="j-select iv__select" :value="issue.in_sprint ? 'yes' : 'no'" aria-label="Sprint"
                        :disabled="issue.status === 'done'" @change="onSprint">
                  <option value="no">None</option><option value="yes">{{ sprintName(sprint.n) }}</option>
                </select>
              </dd>
              <dt>Key result</dt>
              <dd>
                <select class="j-select iv__select" :value="issue.kr" aria-label="Key result"
                        @change="e => setKr((e.target as HTMLSelectElement).value)">
                  <option value="">None</option>
                  <option v-for="item in krItems.filter(i => i.value)" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </dd>
            </dl>
          </details>
          <p class="j-small iv__dates">
            <JiraIcon v-if="issue.flagged" name="flag" :size="12" class="iv__flag" /> {{ issue.flagged ? 'Flagged · ' : '' }}Created Sprint {{ issue.created }}<br />
            Updated Sprint {{ lastSprint }}</p>
        </aside>
      </div>
    </div>
  </JiraModal>
</template>

<script setup lang="ts">
/** The issue view: summary, description, activity on the left; status and details on the right. */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import JiraModal from './JiraModal.vue';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import { issueUrl, PRIORITY_LABEL, sprintName, STATUS_LABEL } from './jiraKit';
import { useJira } from './useJira';

const props = defineProps<{ issueKey: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const { ctx, all, team, sprint, move, assign, addToSprint, moveToBacklog, deleteIssue, setFlag, watch: watchIssue,
        unlinkIssue, copy } = useJira();
const busy = ctx.busy;
const watch_ = watchIssue;

const issue = computed(() => all.value.find(row => row.id === props.issueKey) || null);
const skills = computed(() => {
  const list = pick<string[]>(ctx.view.value, 'skills', []);
  const base = list.length ? list : ['azure', 'terraform', 'networking', 'python', 'leadership', 'data'];
  return issue.value && !base.includes(issue.value.skill) ? [...base, issue.value.skill] : base;
});

const ROLES = ['responsible', 'accountable', 'consulted', 'informed'] as const;
const editingTitle = ref(false);
const title = ref('');
const titleField = ref<HTMLInputElement | null>(null);
const editingDesc = ref(false);
const description = ref('');
const descField = ref<HTMLTextAreaElement | null>(null);
const commenting = ref(false);
const comment = ref('');
const commentField = ref<HTMLTextAreaElement | null>(null);
const tab = ref('All');
const showDelegate = ref(false);
const showRaci = ref(false);
const dl = reactive({ who: '', authority: 'recommend', checkin: 'weekly' });
const raci = reactive<Record<string, string[]>>({ responsible: [], accountable: [], consulted: [], informed: [] });

watch(() => issue.value?.raci, value => {
  for (const role of ROLES) {
    const list = value?.[role];
    raci[role] = Array.isArray(list) ? [...list] : String(list || '').split(',').map(s => s.trim()).filter(Boolean);
  }
}, { immediate: true });

const raciSummary = computed(() => {
  const value = issue.value?.raci;
  if (!value) return 'Not set';
  const a = Array.isArray(value.accountable) ? value.accountable : [];
  return a.length === 1 ? `Accountable: ${a[0]}` : `${a.length} accountable — invalid`;
});

const deliveredPct = computed(() => issue.value && issue.value.points
  ? Math.min(100, 100 * issue.value.done_points / issue.value.points) : 0);
const costNote = computed(() => {
  if (!issue.value) return '';
  const person = team.value.find(p => p.id === issue.value!.assignee_id);
  const level = Number(person?.skill_levels?.[issue.value.skill] || 0);
  return level ? `level ${level} in ${issue.value.skill}` : `untried in ${issue.value.skill}`;
});
const lastSprint = computed(() => {
  const events = issue.value?.events || [];
  return events.length ? events[events.length - 1].sprint : issue.value?.created || 1;
});

const typeItems: DropItem[] = [{ label: 'Story', value: 'story' }, { label: 'Task', value: 'task' }, { label: 'Bug', value: 'bug' }];
const priorityItems: DropItem[] = [{ label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' }];
const assigneeItems = computed<DropItem[]>(() => [{ label: 'Unassigned', value: '' },
  ...team.value.map(p => ({ label: p.name, value: p.id }))]);
const krItems = computed<DropItem[]>(() => [{ label: 'None', value: '' },
  ...rows<Record<string, any>>(ctx.view.value, 'objectives').flatMap(o =>
    (o.krs || []).map((kr: any) => ({ label: `${kr.id} · ${kr.text}`, value: kr.id })))]);
const statusItems = computed<DropItem[]>(() => {
  const row = issue.value!;
  return [
    { label: 'To Do', value: 'todo' },
    { label: 'In Progress', value: 'doing', disabled: !row.in_sprint && row.status !== 'doing',
      hint: `Commit it to ${sprintName(sprint.value.n)} first` },
    { label: 'Done', value: 'done', disabled: row.done_points + 0.01 < row.points,
      hint: `Done follows delivery: ${row.done_points} of ${row.points} pts delivered` },
  ].filter(item => item.value !== row.status);
});
const actionItems = computed<DropItem[]>(() => [
  issue.value?.in_sprint ? { label: 'Move to Backlog', value: 'backlog' }
    : { label: `Move to ${sprintName(sprint.value.n)}`, value: 'sprint', disabled: issue.value?.status === 'done' },
  { label: issue.value?.flagged ? 'Remove flag' : 'Add flag', value: issue.value?.flagged ? 'unflag' : 'flag' },
  { label: 'Add label', value: 'labels' },
  { label: 'Link work item', value: 'link' },
  { label: 'Add subtask', value: 'subtask' },
  { label: issue.value?.watching ? 'Stop watching' : 'Watch', value: 'watch' },
  { label: 'Delegate…', value: 'delegate' },
  { label: 'Copy link', value: 'copy-link', section: 'Share' },
  { label: 'Copy key', value: 'copy-key' },
  { label: 'Delete', value: 'delete', danger: true, section: 'Danger zone' },
]);

const subsDone = computed(() => (issue.value?.subtasks || []).filter(sub => sub.done).length);
const addingSub = ref(false);
const newSub = ref('');
const renaming = ref(0);
const subTitle = ref('');

async function subtask(flag: string, value: string, success: string, extra: Record<string, string> = {}) {
  if (!issue.value) return false;
  const result = await ctx.exec(cli(['mgr', 'backlog', 'subtask', issue.value.id], { [flag]: value, ...extra }), { success });
  return result.ok;
}
async function addSub() {
  const title = newSub.value.trim();
  if (title && await subtask('--add', title, 'Subtask created')) newSub.value = '';
}
async function renameSub(n: number) {
  const title = subTitle.value.trim();
  if (title && await subtask('--rename', String(n), 'Subtask renamed', { '--title': title })) renaming.value = 0;
}
function subMenu(event: MouseEvent, sub: { n: number; title: string; done: boolean }) {
  ctx.openMenu(event, [
    { label: sub.done ? 'Mark as To Do' : 'Mark as Done', value: 'toggle' },
    { label: 'Rename', value: 'rename' },
    { label: 'Delete', value: 'delete', danger: true },
  ], async value => {
    if (value === 'toggle') await subtask(sub.done ? '--todo' : '--done', String(sub.n), sub.done ? 'Subtask reopened' : 'Subtask done');
    else if (value === 'rename') { renaming.value = sub.n; subTitle.value = sub.title; }
    else if (value === 'delete' && await ctx.confirm({ title: `Delete subtask ${issue.value?.id}-${sub.n}?`,
      body: `"${sub.title}" will be permanently deleted.`, confirm: 'Delete', danger: true })) {
      await subtask('--remove', String(sub.n), 'Subtask deleted');
    }
  });
}

const linkGroups = computed(() => {
  const groups: { type: string; links: { key: string; issue: typeof issue.value }[] }[] = [];
  for (const link of issue.value?.links || []) {
    let group = groups.find(g => g.type === link.type);
    if (!group) { group = { type: link.type, links: [] }; groups.push(group); }
    group.links.push({ key: link.key, issue: all.value.find(row => row.id === link.key) || null });
  }
  return groups;
});

const editingComment = ref(-1);
const commentDraft = ref('');
function startCommentEdit(index: number, text: string) { editingComment.value = index; commentDraft.value = text; }
async function saveCommentEdit(index: number) {
  if (!issue.value || !commentDraft.value.trim()) return;
  const result = await ctx.exec(cli(['mgr', 'backlog', 'comment', issue.value.id],
    { '--edit': String(index + 1), '--body': commentDraft.value.trim() }), { success: 'Comment updated' });
  if (result.ok) editingComment.value = -1;
}
async function deleteComment(index: number) {
  if (!issue.value) return;
  const yes = await ctx.confirm({ title: 'Delete this comment?', body: "Once you delete, it's gone for good.",
                                  confirm: 'Delete', danger: true });
  if (yes) await ctx.exec(cli(['mgr', 'backlog', 'comment', issue.value.id], { '--delete': String(index + 1) }),
                          { success: 'Comment deleted' });
}

async function edit(flags: Record<string, string>, success: string) {
  if (!issue.value) return false;
  const result = await ctx.exec(cli(['mgr', 'backlog', 'edit', issue.value.id], flags), { success });
  return result.ok;
}

function startTitle() {
  title.value = issue.value?.title || '';
  editingTitle.value = true;
  nextTick(() => titleField.value?.select());
}

async function saveTitle() {
  const text = title.value.trim();
  if (!text) return;
  if (text !== issue.value?.title && !(await edit({ '--title': text }, 'Summary updated'))) return;
  editingTitle.value = false;
}

function startDesc() {
  description.value = issue.value?.description || '';
  editingDesc.value = true;
  nextTick(() => descField.value?.focus());
}

async function saveDescription() {
  if (!issue.value) return;
  const text = description.value.trim();
  // cli() omits an empty value, so clearing is spelled out: --description ''
  const command = text ? cli(['mgr', 'backlog', 'edit', issue.value.id], { '--description': text })
    : cli(['mgr', 'backlog', 'edit', issue.value.id]) + " --description ''";
  const result = await ctx.exec(command, { success: 'Description updated' });
  if (result.ok) editingDesc.value = false;
}

function startComment() {
  commenting.value = true;
  nextTick(() => commentField.value?.focus());
}

async function saveComment() {
  if (!issue.value || !comment.value.trim()) return;
  const result = await ctx.exec(cli(['mgr', 'backlog', 'comment', issue.value.id], { '--body': comment.value.trim() }),
                                { success: 'Comment added' });
  if (result.ok) { comment.value = ''; commenting.value = false; }
}

async function setKr(value: string) {
  if (!issue.value || value === issue.value.kr) return;
  if (!value) await ctx.exec(cli(['mgr', 'unlink', issue.value.id]), { success: `${issue.value.id} unlinked` });
  else await ctx.exec(cli(['mgr', 'link', issue.value.id], { '--kr': value }), { success: `${issue.value.id} linked to ${value}` });
}

async function onSprint(event: Event) {
  if (!issue.value) return;
  const yes = (event.target as HTMLSelectElement).value === 'yes';
  if (yes) await addToSprint([issue.value.id]);
  else await moveToBacklog([issue.value.id]);
}

async function delegate() {
  if (!issue.value || !dl.who) return;
  const result = await ctx.exec(cli(['mgr', 'delegate', issue.value.id], {
    '--to': dl.who, '--authority': dl.authority, '--checkin': dl.checkin,
  }), { success: '' });
  if (result.ok) {
    showDelegate.value = false;
    const lines = String(result.output || '').split('\n').map(l => l.trim()).filter(Boolean);
    ctx.flag(dl.checkin ? 'success' : 'warning', lines[0] || 'Delegated', lines.slice(1).join(' '));
  }
}

async function saveRaci() {
  if (!issue.value) return;
  await ctx.exec(cli(['mgr', 'raci', 'set', issue.value.id], {
    '--responsible': raci.responsible.join(','), '--accountable': raci.accountable.join(','),
    '--consulted': raci.consulted.join(','), '--informed': raci.informed.join(','),
  }), { success: `RACI saved for ${issue.value.id}` });
}

async function onAction(value: string) {
  if (!issue.value) return;
  if (value === 'sprint') await addToSprint([issue.value.id]);
  else if (value === 'backlog') await moveToBacklog([issue.value.id]);
  else if (value === 'delegate') showDelegate.value = true;
  else if (value === 'flag') ctx.openDialog('flag', issue.value.id);
  else if (value === 'unflag') await setFlag(issue.value, false);
  else if (value === 'labels' || value === 'link') ctx.openDialog(value, issue.value.id);
  else if (value === 'subtask') addingSub.value = true;
  else if (value === 'watch') await watch_(issue.value, !issue.value.watching);
  else if (value === 'copy-link') await copy(issueUrl(issue.value.id), 'Link');
  else if (value === 'copy-key') await copy(issue.value.id, 'Key');
  else if (value === 'delete' && await deleteIssue(issue.value)) emit('close');
}

const activity = computed(() => {
  if (!issue.value) return [];
  const comments = issue.value.comments.map((c: any, index) => ({ kind: 'comment', text: c.body, sprint: c.sprint, order: index,
                                                                    edited: Boolean(c.edited) }));
  const history = issue.value.events.map((e, index) => ({ kind: 'history', text: e.text, sprint: e.sprint, order: index, edited: false }));
  const list = tab.value === 'Comments' ? comments : tab.value === 'History' ? history : [...comments, ...history];
  return list.sort((a, b) => b.sprint - a.sprint || b.order - a.order);
});

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (event.key.toLowerCase() === 'm' && !/input|textarea|select/i.test(target.tagName) && !commenting.value) {
    event.preventDefault();
    startComment();
  }
}
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<style scoped>
.iv { padding: 4px 0 8px; }
.iv__bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 0 12px; }
.iv__crumbs { display: flex; align-items: center; gap: 6px; color: var(--j-text-subtle); min-width: 0; }
.iv__crumbs a { color: var(--j-text-subtle); text-decoration: none; }
.iv__crumbs a:hover { text-decoration: underline; }
.iv__proj { display: inline-flex; border-radius: 3px; overflow: hidden; }
.iv__sep { color: var(--j-text-subtlest); }
.iv :deep(.iv__typebtn) { padding: 4px; border-radius: 3px; }
.iv :deep(.iv__typebtn:hover) { background: var(--j-neutral-hover); }
.iv__key { color: var(--j-text-subtle); white-space: nowrap; }
.iv__tools { display: flex; gap: 2px; }
.iv__grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 32px; }
.iv__title { margin: 0 0 12px; padding: 4px 6px; margin-left: -6px; font-size: 24px; line-height: 28px; font-weight: 653;
  border-radius: 3px; cursor: text; overflow-wrap: anywhere; }
.iv__title:hover { background: var(--j-neutral); }
.iv__title-form { position: relative; margin-bottom: 12px; }
.iv__title-input { font-size: 20px; font-weight: 600; }
.iv__edit-actions { position: absolute; right: 0; top: calc(100% + 4px); display: flex; gap: 4px; z-index: 2; }
.iv__buttons { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.iv__panel { padding: 16px; margin-bottom: 20px; border: 1px solid var(--j-border); border-radius: 4px; }
.iv__section { margin-bottom: 24px; }
.iv__desc { padding: 8px; margin: 0 -8px; border-radius: 3px; white-space: pre-wrap; cursor: text; min-height: 40px; overflow-wrap: anywhere; }
.iv__desc:hover { background: var(--j-neutral); }
.iv__desc.is-empty { color: var(--j-text-subtlest); }
.iv__gap { margin-top: 8px; }
.iv__delivery { display: flex; align-items: center; gap: 12px; }
.iv__flagged { align-items: center; }
.iv__flagged > .ji { color: #C9372C; }
.iv__flagged > div { flex: 1; }
.iv__flag { color: #C9372C; }
.iv :deep(.iv__watch.is-on), .iv__watch.is-on { background: var(--j-selected); color: var(--j-selected-text); }
.iv__sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.iv__sec-head .j-h3 { margin: 0; }
.iv__spacer { flex: 1; }
.iv__subbar { margin-bottom: 8px; }
.iv__subs { list-style: none; margin: 0; padding: 0; border: 1px solid var(--j-border); border-radius: 4px; }
.iv__subs:empty { display: none; }
.iv__sub { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 8px; border-bottom: 1px solid var(--j-border); }
.iv__sub:last-child { border-bottom: 0; }
.iv__sub:hover { background: var(--j-sunken); }
.iv__sub input[type=checkbox] { width: 14px; height: 14px; accent-color: var(--j-brand); }
.iv__sub-icon { color: #1868DB; }
.iv__sub-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.iv__sub.is-done .iv__sub-title { text-decoration: line-through; color: var(--j-text-subtle); }
.iv__sub-form, .iv__sub-new { display: flex; flex: 1; gap: 6px; align-items: center; }
.iv__sub-new { margin-top: 8px; }
.iv__link-type { margin: 8px 0 4px; font-weight: 600; }
.iv__entry-actions { display: flex; gap: 6px; margin-top: 4px; font-size: 12px; color: var(--j-text-subtlest); }
.iv__entry-actions .j-link { font-size: 12px; color: var(--j-text-subtle); }
.iv__labels { display: flex; flex-wrap: wrap; gap: 4px; min-height: 32px; width: 100%; align-items: center; padding: 4px 6px; margin-left: -6px;
  border: 0; border-radius: 3px; background: transparent; font: inherit; text-align: left; cursor: pointer; }
.iv__labels:hover { background: var(--j-neutral); }
.iv__label { padding: 0 4px; border-radius: 3px; background: var(--j-neutral); font-size: 12px; line-height: 18px; }
.iv__delivery .j-progress { width: 200px; }
.iv__toggle { display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; font: inherit; font-weight: 653; color: var(--j-text); cursor: pointer; }
.iv__raci-sum { font-weight: 400; color: var(--j-text-subtle); font-size: 12px; }
.iv__raci { margin-top: 8px; overflow-x: auto; }
.iv__raci td:not(:first-child), .iv__raci th:not(:first-child) { text-align: center; width: 40px; }
.iv__person { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.iv__comment-new { display: flex; gap: 12px; margin-bottom: 16px; }
.iv__comment-box { flex: 1; min-width: 0; }
.iv__comment-fake { width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--j-border-input); border-radius: 3px;
  background: var(--j-surface); color: var(--j-text-subtlest); font: inherit; text-align: left; cursor: text; }
.iv__comment-fake:hover { background: var(--j-input-hover); }
kbd { padding: 0 4px; border: 1px solid var(--j-border); border-radius: 3px; background: var(--j-sunken); color: var(--j-text); font-size: 12px; font-family: inherit; }
.iv__activity { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.iv__entry { display: flex; gap: 12px; }
.iv__entry-head { display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; }
.iv__entry-body { margin-top: 4px; white-space: pre-wrap; overflow-wrap: anywhere; }
.iv__side { position: sticky; top: 0; align-self: start; }
.iv__status { margin-bottom: 16px; }
.iv__status :deep(.iv__status-btn) {
  height: 32px; padding: 0 10px; border-radius: 3px; font-weight: 600; background: var(--j-neutral); color: var(--j-text);
}
.iv__status :deep(.is-done .iv__status-btn) { background: #1F845A; color: #fff; }
.iv__status :deep(.is-doing .iv__status-btn) { background: var(--j-brand); color: #fff; }
.iv__details { border: 1px solid var(--j-border); border-radius: 4px; }
.iv__details summary { display: flex; align-items: center; gap: 10px; padding: 12px 16px; font-weight: 653; cursor: pointer; border-bottom: 1px solid var(--j-border); list-style: none; }
.iv__details summary::-webkit-details-marker { display: none; }
/* Atlassian's chevron rather than the browser's disclosure triangle. */
.iv__details summary::before { content: ''; width: 6px; height: 6px; margin: 0 2px; border-right: 1.6px solid var(--j-text-subtle);
  border-bottom: 1.6px solid var(--j-text-subtle); transform: translateY(-2px) rotate(45deg); }
.iv__details:not([open]) summary { border-bottom: 0; }
.iv__details:not([open]) summary::before { transform: rotate(-45deg); }
.iv__details dl { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 12px 8px; margin: 0; padding: 16px; align-items: center; }
.iv__details dt { font-size: 14px; font-weight: 600; color: var(--j-text-subtle); }
.iv__details dd { margin: 0; min-width: 0; }
.iv :deep(.iv__field-btn) { gap: 8px; padding: 4px 6px; margin-left: -6px; border-radius: 3px; text-align: left; }
.iv :deep(.iv__field-btn:hover) { background: var(--j-neutral); }
.iv__field-static { display: inline-flex; align-items: center; gap: 8px; }
.iv__select { min-height: 32px; height: 32px; padding: 4px 6px; }
/* The details panel edits in place: a field reads as plain text until it is
   hovered or focused, as Jira's own inline-edit fields do. */
.iv__details .iv__select:not(:focus):not(:hover) { border-color: transparent; background-color: transparent; }
.iv__details select.iv__select:not(:focus):not(:hover) { background-image: none; }
.iv__details .iv__select:disabled { border-color: transparent; background-color: transparent; }
.iv__dates { margin-top: 12px; }
@container sl-portal (max-width: 900px) {
  /* One column, in Jira's mobile order: the summary, then status and the
     details, then description and activity. */
  .iv__grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .iv__main { display: contents; }
  .iv__title, .iv__title-form { order: -2; }
  .iv__side { order: -1; margin-bottom: 20px; position: static; }
}
@container sl-portal (max-width: 640px) {
  .iv__toggle { min-height: 32px; }
  .iv :deep(.iv__typebtn) { min-width: 32px; min-height: 32px; justify-content: center; }
  .iv__bar { flex-wrap: wrap; }
  .iv__delivery { flex-wrap: wrap; }
  .iv__delivery .j-progress { width: 100%; }
  .iv__details dl { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .iv__details dd { margin-bottom: 8px; }
}
</style>
