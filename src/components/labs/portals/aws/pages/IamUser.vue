<template>
  <div v-if="user">
    <CsHeader :title="user.name">
      <template #actions><button type="button" class="cs-btn" @click="deleting = true">Delete</button></template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Summary" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>ARN</dt><dd class="cs-mono">{{ user.arn }}</dd></div>
          <div><dt>Console access</dt><dd>Disabled</dd></div>
          <div><dt>Access key 1</dt><dd><span class="cs-link">Create access key</span></dd></div>
          <div><dt>Created</dt><dd>{{ awsDate(user.created) }}</dd></div>
          <div><dt>Last console sign-in</dt><dd>–</dd></div>
        </dl>
      </div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in tabs" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" :disabled="t === 'Groups' || t === 'Security credentials' || t === 'Last Accessed'" @click="tab = t">{{ t }}</button>
    </div>
    <template v-if="tab === 'Permissions'">
      <div v-if="adding">
        <PolicyPicker v-model="toAttach" :exclude="user.policies" title="Other permissions policies" description="Attach policies directly to this user." />
        <div class="cs-form-actions">
          <button type="button" class="cs-btn cs-btn--link" @click="adding = false">Cancel</button>
          <button type="button" class="cs-btn cs-btn--primary" :disabled="!toAttach.length || busy" @click="attach">Add permissions</button>
        </div>
      </div>
      <CsTable v-else v-model:selected="selectedPolicies" title="Permissions policies" :items="attached" :columns="policyColumns"
               track-by="arn" selection-type="multi" filter-placeholder="Search"
               description="Permissions are defined by policies attached to the user directly or through groups."
               empty-title="No resources to display">
        <template #actions>
          <button type="button" class="cs-btn" :disabled="!selectedPolicies.length || busy" @click="detach">Remove</button>
          <CsDropdown label="Add permissions" primary :items="[{ id: 'attach', text: 'Add permissions' }, { id: 'inline', text: 'Create inline policy', disabled: true }]" @select="startAdd" />
        </template>
      </CsTable>
    </template>
    <section v-else-if="tab === 'Tags'" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Tags (${tagList.length})`" :level="2">
        <template #actions><button v-if="!editingTags" type="button" class="cs-btn" @click="startTags">Manage tags</button></template></CsHeader></div>
      <div class="cs-container__body">
        <template v-if="editingTags">
          <TagEditor v-model="tags" />
          <div class="cs-form-actions">
            <button type="button" class="cs-btn cs-btn--link" @click="editingTags = false">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || tags.some(t => tagProblem(t))" @click="saveTags">Save changes</button>
          </div>
        </template>
        <table v-else-if="tagList.length" class="cs-table-mini"><thead><tr><th>Key</th><th>Value</th></tr></thead>
          <tbody><tr v-for="t in tagList" :key="t.key"><td>{{ t.key }}</td><td>{{ t.value || '–' }}</td></tr></tbody></table>
        <div v-else class="cs-empty"><strong>No tags associated with the resource.</strong></div>
      </div>
    </section>
    <CsDelete v-if="deleting" :title="`Delete ${user.name}?`" :word="user.name" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="iud__p">Permanently delete <strong>{{ user.name }}</strong>? Its {{ user.policies.length }} attached policies are detached first. This can't be undone.</p>
    </CsDelete>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>No such entity</strong>The user with name {{ name }} cannot be found.
      <button type="button" class="cs-link" @click="ctx.to('iam', 'users')">View users</button></div></div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsTable, { type Column } from '../CsTable.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { tagProblem, tagWords } from '../commands';
import { awsDate, useAws } from '../ctx';
import PolicyPicker from './PolicyPicker.vue';

const ctx = useAws();
const name = computed(() => ctx.route.value.params?.name || '');
const user = computed(() => {
  const row = rows<any>(ctx.view.value, 'iam.users').find(u => u.name === name.value);
  return row ? { ...row, policies: row.policies || [], tags: row.tags || {} } : null;
});
const tabs = ['Permissions', 'Groups', 'Tags', 'Security credentials', 'Last Accessed'];
const tab = ref('Permissions');
const busy = ref(false);
const deleting = ref(false);
const adding = ref(false);
const toAttach = ref<string[]>([]);
const selectedPolicies = ref<string[]>([]);
const editingTags = ref(false);
const tags = ref<Tag[]>([]);

const managed = computed(() => rows(ctx.view.value, 'iam.managed_policies'));
const attached = computed(() => (user.value?.policies || []).map((arn: string) => {
  const hit = managed.value.find(p => p.arn === arn);
  return { arn, name: arn.split('/').pop(), type: hit?.type || 'AWS managed', via: 'Directly' };
}));
const policyColumns: Column[] = [
  { id: 'name', header: 'Policy name', sortKey: 'name' },
  { id: 'type', header: 'Type' },
  { id: 'via', header: 'Attached via' },
];
const tagList = computed(() => Object.entries(user.value?.tags || {}).map(([key, value]) => ({ key, value: String(value) })));

function startAdd(id: string) {
  if (id === 'attach') { toAttach.value = []; adding.value = true; }
}
async function attach() {
  busy.value = true;
  for (const arn of toAttach.value) {
    await ctx.run(cli(['aws', 'iam', 'attach-user-policy'], { '--user-name': name.value, '--policy-arn': arn }));
  }
  busy.value = false;
  ctx.api.notify('success', `${toAttach.value.length} policy attached.`);
  adding.value = false;
}
async function detach() {
  busy.value = true;
  for (const arn of selectedPolicies.value) {
    await ctx.run(cli(['aws', 'iam', 'detach-user-policy'], { '--user-name': name.value, '--policy-arn': arn }));
  }
  busy.value = false;
  ctx.api.notify('success', 'Policy removed.');
  selectedPolicies.value = [];
}
function startTags() {
  tags.value = tagList.value.map(t => ({ ...t }));
  editingTags.value = true;
}
async function saveTags() {
  busy.value = true;
  const kept = tags.value.filter(t => t.key.trim());
  const removed = tagList.value.filter(t => !kept.some(k => k.key.trim() === t.key)).map(t => t.key);
  if (removed.length) await ctx.run(cli(['aws', 'iam', 'untag-user'], { '--user-name': name.value, '--tag-keys': removed }));
  if (kept.length) await ctx.run(cli(['aws', 'iam', 'tag-user'], { '--user-name': name.value, '--tags': tagWords(kept) }));
  busy.value = false;
  ctx.api.notify('success', 'Tags saved successfully.');
  editingTags.value = false;
}
async function remove() {
  if (!user.value) return;
  busy.value = true;
  for (const arn of user.value.policies) {
    await ctx.run(cli(['aws', 'iam', 'detach-user-policy'], { '--user-name': name.value, '--policy-arn': arn }));
  }
  const result = await ctx.run(cli(['aws', 'iam', 'delete-user'], { '--user-name': name.value }), `User ${name.value} deleted.`);
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to('iam', 'users'); }
}
</script>

<style scoped>
.iud__p { margin: 0; }
</style>
