<template>
  <div v-if="role">
    <CsHeader :title="role.name">
      <template #actions><button type="button" class="cs-btn" @click="deleting = true">Delete</button></template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Summary" :level="2" :info="false">
        <template #actions><button v-if="!editDesc" type="button" class="cs-btn" @click="startDesc">Edit</button></template></CsHeader></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>Creation date</dt><dd>{{ awsDate(role.created) }}</dd></div>
          <div><dt>ARN</dt><dd class="cs-mono">{{ role.arn }}</dd></div>
          <div><dt>Last activity</dt><dd>–</dd></div>
          <div><dt>Maximum session duration</dt><dd>1 hour</dd></div>
          <div><dt>Description</dt><dd>
            <template v-if="editDesc">
              <textarea v-model="desc" class="cs-textarea" aria-label="Description" />
              <div class="cs-row ir__edit"><button type="button" class="cs-btn cs-btn--link" @click="editDesc = false">Cancel</button>
                <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveDesc">Save changes</button></div>
            </template>
            <template v-else>{{ role.description || '–' }}</template>
          </dd></div>
        </dl>
      </div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in tabs" :key="t.id" type="button" class="cs-tab" :class="{ 'is-active': tab === t.id }" :disabled="t.off" @click="tab = t.id">{{ t.text }}</button>
    </div>
    <template v-if="tab === 'permissions'">
      <div v-if="adding">
        <PolicyPicker v-model="toAttach" :exclude="role.policies" title="Other permissions policies" description="Attach policies to this role." />
        <div class="cs-form-actions">
          <button type="button" class="cs-btn cs-btn--link" @click="adding = false">Cancel</button>
          <button type="button" class="cs-btn cs-btn--primary" :disabled="!toAttach.length || busy" @click="attach">Add permissions</button>
        </div>
      </div>
      <CsTable v-else v-model:selected="selectedPolicies" title="Permissions policies" :items="attached" :columns="columns"
               track-by="arn" selection-type="multi" filter-placeholder="Search"
               description="You can attach up to 10 managed policies." empty-title="No resources to display">
        <template #actions>
          <button type="button" class="cs-btn" :disabled="!selectedPolicies.length || busy" @click="detaching = true">Remove</button>
          <CsDropdown label="Add permissions" primary :items="[{ id: 'attach', text: 'Attach policies' }, { id: 'inline', text: 'Create inline policy', disabled: true }]" @select="startAdd" />
        </template>
      </CsTable>
    </template>
    <section v-else-if="tab === 'trust'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Trusted entities" :level="2" description="Entities that can assume this role under specified conditions.">
        <template #actions><button v-if="!editTrust" type="button" class="cs-btn" @click="startTrust">Edit trust policy</button></template></CsHeader></div>
      <div class="cs-container__body">
        <template v-if="editTrust">
          <textarea v-model="trustDraft" class="cs-textarea cs-mono ir__json" :class="{ 'is-invalid': trustError }" spellcheck="false" aria-label="Trust policy" />
          <span v-if="trustError" class="cs-error-text">{{ trustError }}</span>
          <div class="cs-form-actions">
            <button type="button" class="cs-btn cs-btn--link" @click="editTrust = false">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!trustError" @click="saveTrust">Update policy</button>
          </div>
        </template>
        <pre v-else class="cs-code">{{ prettyJson(role.trust) || '(no trust policy)' }}</pre>
      </div>
    </section>
    <section v-else-if="tab === 'tags'" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Tags (${tagList.length})`" :level="2">
        <template #actions><button v-if="!editTags" type="button" class="cs-btn" @click="startTags">Manage tags</button></template></CsHeader></div>
      <div class="cs-container__body">
        <template v-if="editTags">
          <TagEditor v-model="tags" />
          <div class="cs-form-actions">
            <button type="button" class="cs-btn cs-btn--link" @click="editTags = false">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || tags.some(t => tagProblem(t))" @click="saveTags">Save changes</button>
          </div>
        </template>
        <table v-else-if="tagList.length" class="cs-table-mini"><thead><tr><th>Key</th><th>Value</th></tr></thead>
          <tbody><tr v-for="t in tagList" :key="t.key"><td>{{ t.key }}</td><td>{{ t.value || '–' }}</td></tr></tbody></table>
        <div v-else class="cs-empty"><strong>No tags associated with the resource.</strong></div>
      </div>
    </section>
    <CsModal v-if="detaching" :title="`Remove ${selectedPolicies.length} polic${selectedPolicies.length === 1 ? 'y' : 'ies'}?`" @close="detaching = false">
      <p class="ir__p">The role will lose the permissions these policies grant.</p>
      <ul class="ir__ids"><li v-for="arn in selectedPolicies" :key="arn">{{ arn.split('/').pop() }}</li></ul>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="detaching = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="detach">Remove policies</button>
      </template>
    </CsModal>
    <CsDelete v-if="deleting" :title="`Delete ${role.name}?`" :word="role.name" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="ir__p">Deleting this role detaches its {{ role.policies.length }} policies and removes it permanently.</p>
    </CsDelete>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>No such entity</strong>The role with name {{ name }} cannot be found.
      <button type="button" class="cs-link" @click="ctx.to('iam', 'roles')">View roles</button></div></div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsTable, { type Column } from '../CsTable.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { tagProblem, tagWords } from '../commands';
import { awsDate, useAws } from '../ctx';
import PolicyPicker from './PolicyPicker.vue';
import { prettyJson } from './iamTrust';

const ctx = useAws();
const name = computed(() => ctx.route.value.params?.name || '');
const role = computed(() => {
  const row = rows<any>(ctx.view.value, 'iam.roles').find(r => r.name === name.value);
  return row ? { ...row, policies: row.policies || [], tags: row.tags || {} } : null;
});
const tabs = [
  { id: 'permissions', text: 'Permissions' }, { id: 'trust', text: 'Trust relationships' },
  { id: 'tags', text: 'Tags' }, { id: 'access', text: 'Last Accessed', off: true }, { id: 'revoke', text: 'Revoke sessions', off: true },
];
const tab = ref(ctx.route.value.params?.tab || 'permissions');
const busy = ref(false);
const deleting = ref(false);
const detaching = ref(false);
const adding = ref(false);
const toAttach = ref<string[]>([]);
const selectedPolicies = ref<string[]>([]);
const editTrust = ref(false);
const trustDraft = ref('');
const editTags = ref(false);
const tags = ref<Tag[]>([]);
const editDesc = ref(false);
const desc = ref('');

const managed = computed(() => rows(ctx.view.value, 'iam.managed_policies'));
const attached = computed(() => (role.value?.policies || []).map((arn: string) => {
  const hit = managed.value.find(p => p.arn === arn);
  return { arn, name: arn.split('/').pop(), type: hit?.type || 'Customer managed', via: 'Directly' };
}));
const columns: Column[] = [
  { id: 'name', header: 'Policy name', sortKey: 'name' },
  { id: 'type', header: 'Type' },
  { id: 'via', header: 'Attached entities' },
];
const tagList = computed(() => Object.entries(role.value?.tags || {}).map(([key, value]) => ({ key, value: String(value) })));
const trustError = computed(() => {
  try { JSON.parse(trustDraft.value); return ''; } catch { return 'This policy contains invalid JSON.'; }
});

function startAdd(id: string) {
  if (id === 'attach') { toAttach.value = []; adding.value = true; }
}
async function attach() {
  busy.value = true;
  for (const arn of toAttach.value) {
    await ctx.run(cli(['aws', 'iam', 'attach-role-policy'], { '--role-name': name.value, '--policy-arn': arn }));
  }
  busy.value = false;
  ctx.api.notify('success', `Policy was successfully attached to role.`);
  adding.value = false;
}
async function detach() {
  busy.value = true;
  for (const arn of selectedPolicies.value) {
    await ctx.run(cli(['aws', 'iam', 'detach-role-policy'], { '--role-name': name.value, '--policy-arn': arn }));
  }
  busy.value = false;
  detaching.value = false;
  selectedPolicies.value = [];
  ctx.api.notify('success', 'Policy was successfully removed from the role.');
}
function startTrust() {
  trustDraft.value = prettyJson(role.value?.trust) || '{}';
  editTrust.value = true;
}
async function saveTrust() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'update-assume-role-policy'], {
    '--role-name': name.value, '--policy-document': JSON.stringify(JSON.parse(trustDraft.value)),
  }), 'Trust policy updated.');
  busy.value = false;
  if (result.ok) editTrust.value = false;
}
function startTags() {
  tags.value = tagList.value.map(t => ({ ...t }));
  editTags.value = true;
}
async function saveTags() {
  busy.value = true;
  const kept = tags.value.filter(t => t.key.trim());
  const removed = tagList.value.filter(t => !kept.some(k => k.key.trim() === t.key)).map(t => t.key);
  if (removed.length) await ctx.run(cli(['aws', 'iam', 'untag-role'], { '--role-name': name.value, '--tag-keys': removed }));
  if (kept.length) await ctx.run(cli(['aws', 'iam', 'tag-role'], { '--role-name': name.value, '--tags': tagWords(kept) }));
  busy.value = false;
  ctx.api.notify('success', 'Tags saved successfully.');
  editTags.value = false;
}
function startDesc() {
  desc.value = role.value?.description || '';
  editDesc.value = true;
}
async function saveDesc() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'update-role'], { '--role-name': name.value, '--description': desc.value }),
    'Role description updated.');
  busy.value = false;
  if (result.ok) editDesc.value = false;
}
async function remove() {
  if (!role.value) return;
  busy.value = true;
  for (const arn of role.value.policies) {
    await ctx.run(cli(['aws', 'iam', 'detach-role-policy'], { '--role-name': name.value, '--policy-arn': arn }));
  }
  const result = await ctx.run(cli(['aws', 'iam', 'delete-role'], { '--role-name': name.value }), `Role ${name.value} deleted.`);
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to('iam', 'roles'); }
}
</script>

<style scoped>
.ir__edit { margin-top: 8px; }
.ir__json { min-height: 260px; font-size: 13px; }
.ir__p { margin: 0 0 8px; }
.ir__ids { margin: 0; padding-left: 18px; }
</style>
