<template>
  <div>
    <CsTable v-model:selected="selected" title="Roles" variant="full-page" :items="roles" :columns="columns" track-by="name"
             selection-type="multi" filter-placeholder="Search" empty-title="No roles"
             description="An IAM role is an identity you can create that has specific permissions with credentials that are valid for short durations. Roles can be assumed by entities that you trust.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Roles refreshed')"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" :disabled="!selected.length" @click="deleting = true">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('iam', 'role-create')">Create role</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('iam', 'role', { name: row.name })">{{ row.name }}</a></template>
    </CsTable>
    <CsDelete v-if="deleting" :title="selected.length === 1 ? `Delete ${selected[0]}?` : `Delete ${selected.length} roles?`"
              :word="selected.length === 1 ? selected[0] : 'delete'" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="ir__p">Deleting a role detaches its policies and removes it permanently. Anything that assumes it - a Lambda function, an EC2 instance - loses its permissions.</p>
    </CsDelete>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsIcon from '../CsIcon.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';
import { trustedEntity } from './iamTrust';

const ctx = useAws();
const roles = computed(() => rows(ctx.view.value, 'iam.roles'));
const selected = ref<string[]>([]);
const deleting = ref(false);
const busy = ref(false);
const columns: Column[] = [
  { id: 'name', header: 'Role name', sortKey: 'name' },
  { id: 'trusted', header: 'Trusted entities', cell: r => trustedEntity(r.trust) },
  { id: 'activity', header: 'Last activity', cell: () => '–' },
];

async function remove() {
  busy.value = true;
  let done = 0;
  for (const name of selected.value) {
    const role = roles.value.find(r => r.name === name);
    for (const arn of role?.policies || []) {
      await ctx.run(cli(['aws', 'iam', 'detach-role-policy'], { '--role-name': name, '--policy-arn': arn }));
    }
    const result = await ctx.run(cli(['aws', 'iam', 'delete-role'], { '--role-name': name }));
    if (result.ok) done += 1;
  }
  busy.value = false;
  deleting.value = false;
  selected.value = [];
  if (done) ctx.api.notify('success', `${done} role(s) deleted.`);
}
</script>

<style scoped>
.ir__p { margin: 0; }
</style>
