<template>
  <div>
    <CsTable v-model:selected="selected" title="Policies" variant="full-page" :items="policies" :columns="columns" track-by="arn"
             selection-type="single" filter-placeholder="Filter by Type: Search"
             :filter-fields="['name', 'type', 'description']"
             description="A policy is an object in AWS that defines permissions.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Policies refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="[{ id: 'attach', text: 'Attach', disabled: !current }, { id: 'detach', text: 'Detach', disabled: true }, { id: 'delete', text: 'Delete', disabled: true, disabledReason: 'AWS managed policies cannot be deleted' }]"
                    :disabled="!current" @select="attaching = true" />
        <button type="button" class="cs-btn cs-btn--primary" disabled title="Customer managed policies are not modelled in this lab">Create policy</button>
      </template>
      <template #cell-name="{ row }"><span class="cs-link">{{ row.name }}</span></template>
    </CsTable>

    <CsModal v-if="attaching && current" :title="`Attach ${current.name}`" @close="attaching = false">
      <div class="cs-stack">
        <p class="ip__p">{{ current.description }}</p>
        <div class="cs-field"><label class="cs-label" for="ip-role">Role</label>
          <select id="ip-role" v-model="role" class="cs-select">
            <option value="" disabled>Choose a role</option>
            <option v-for="r in roles" :key="r.name" :value="r.name">{{ r.name }}</option>
          </select>
          <span v-if="!roles.length" class="cs-constraint">There are no roles yet. Create one under Roles first.</span></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="attaching = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!role" @click="attach">Attach policy</button>
      </template>
    </CsModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDropdown from '../CsDropdown.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const policies = computed(() => rows(ctx.view.value, 'iam.managed_policies'));
const roles = computed(() => rows(ctx.view.value, 'iam.roles'));
const selected = ref<string[]>([]);
const current = computed(() => policies.value.find(p => p.arn === selected.value[0]) || null);
const attaching = ref(false);
const role = ref('');
const columns: Column[] = [
  { id: 'name', header: 'Policy name', sortKey: 'name' },
  { id: 'type', header: 'Type', sortKey: 'type' },
  { id: 'attached', header: 'Used as', cell: r => (r.attached ? `Permissions policy (${r.attached})` : 'None') },
  { id: 'description', header: 'Description' },
];

async function attach() {
  if (!current.value) return;
  const result = await ctx.run(cli(['aws', 'iam', 'attach-role-policy'], { '--role-name': role.value, '--policy-arn': current.value.arn }),
    `Policy ${current.value.name} attached to ${role.value}.`);
  if (result.ok) attaching.value = false;
}
</script>

<style scoped>
.ip__p { margin: 0; color: #424650; }
</style>
