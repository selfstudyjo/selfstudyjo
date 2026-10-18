<template>
  <CsDropdown :items="items" :disabled="!db" @select="act" />
  <CsModal v-if="modal === 'stop' && db" :title="`Stop DB instance ${db.id}?`" @close="modal = ''">
    <p class="ra__p">Stopping a DB instance doesn't delete it. The instance is automatically started after seven days if it isn't started manually.</p>
    <label class="cs-check"><input v-model="snapFirst" type="checkbox" /> <span>Save the DB instance in a snapshot</span></label>
    <input v-if="snapFirst" v-model.trim="snapName" class="cs-input ra__gap" aria-label="Snapshot identifier" />
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="stop">Stop temporarily</button>
    </template>
  </CsModal>
  <CsModal v-if="modal === 'reboot' && db" :title="`Reboot DB instance`" @close="modal = ''">
    <p class="ra__p">Are you sure you want to reboot <strong>{{ db.id }}</strong>?</p>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="simple('reboot-db-instance', `Rebooting ${db.id}`)">Confirm</button>
    </template>
  </CsModal>
  <CsModal v-if="modal === 'snapshot' && db" title="Take DB snapshot" @close="modal = ''">
    <div class="cs-field"><label class="cs-label" for="ra-snap">Snapshot name</label>
      <input id="ra-snap" v-model.trim="snapName" class="cs-input" />
      <span class="cs-constraint">Identifiers must begin with a letter; contain only ASCII letters, digits, and hyphens; and must not end with a hyphen or contain two consecutive hyphens.</span></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !snapName" @click="snapshot">Take snapshot</button>
    </template>
  </CsModal>
  <CsDelete v-if="modal === 'delete' && db" :title="`Delete ${db.id} instance?`" word="delete me" :busy="busy" :allowed="finalSnap ? !!snapName : ack"
            @close="modal = ''" @confirm="remove">
    <div class="cs-stack">
      <label class="cs-check"><input v-model="finalSnap" type="checkbox" /> <span>Create final snapshot<small>Determines whether a final DB snapshot is created before the DB instance is deleted.</small></span></label>
      <div v-if="finalSnap" class="cs-field"><label class="cs-label" for="ra-final">Final snapshot name</label>
        <input id="ra-final" v-model.trim="snapName" class="cs-input" /></div>
      <label class="cs-check"><input type="checkbox" disabled /> <span>Retain automated backups</span></label>
      <label v-if="!finalSnap" class="cs-check"><input v-model="ack" type="checkbox" /> <span>I acknowledge that upon instance deletion, automated backups, including system snapshots and point-in-time recovery, will no longer be available.</span></label>
    </div>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown, { type DdItem } from '../CsDropdown.vue';
import CsModal from '../CsModal.vue';
import { useAws } from '../ctx';

const props = defineProps<{ db: Record<string, any> | null }>();
const emit = defineEmits<{ (e: 'deleted'): void }>();
const ctx = useAws();
const modal = ref<'' | 'stop' | 'reboot' | 'snapshot' | 'delete'>('');
const busy = ref(false);
const snapFirst = ref(false);
const snapName = ref('');
const finalSnap = ref(true);
const ack = ref(false);

const items = computed<DdItem[]>(() => [
  { id: 'stop', text: 'Stop temporarily', disabled: props.db?.status !== 'available' },
  { id: 'start', text: 'Start', disabled: props.db?.status !== 'stopped' },
  { id: 'reboot', text: 'Reboot', disabled: props.db?.status !== 'available' },
  { id: 'delete', text: 'Delete' },
  { id: 'g', text: 'Backups', group: true },
  { id: 'snapshot', text: 'Take snapshot', nested: true },
  { id: 'replica', text: 'Create read replica', disabled: true, nested: true },
]);

function stamp() {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
}
function act(id: string) {
  if (!props.db) return;
  if (id === 'start') { simple('start-db-instance', `Starting ${props.db.id}`); return; }
  snapName.value = id === 'delete' ? `${props.db.id}-final-snapshot` : `${props.db.id}-snapshot-${stamp()}`;
  finalSnap.value = true;
  ack.value = false;
  snapFirst.value = false;
  modal.value = id as typeof modal.value;
}
async function simple(verb: string, success: string) {
  if (!props.db) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'rds', verb], { '--db-instance-identifier': props.db.id }), success);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function stop() {
  if (!props.db) return;
  busy.value = true;
  if (snapFirst.value && snapName.value) {
    await ctx.run(cli(['aws', 'rds', 'create-db-snapshot'], { '--db-instance-identifier': props.db.id, '--db-snapshot-identifier': snapName.value }));
  }
  const result = await ctx.run(cli(['aws', 'rds', 'stop-db-instance'], { '--db-instance-identifier': props.db.id }),
    `Successfully stopped ${props.db.id}.`);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function snapshot() {
  if (!props.db) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'rds', 'create-db-snapshot'], {
    '--db-instance-identifier': props.db.id, '--db-snapshot-identifier': snapName.value,
  }), `Creating snapshot ${snapName.value}.`);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function remove() {
  if (!props.db) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'rds', 'delete-db-instance'], {
    '--db-instance-identifier': props.db.id,
    '--final-db-snapshot-identifier': finalSnap.value ? snapName.value : '',
    '--skip-final-snapshot': !finalSnap.value,
  }), `Deleting ${props.db.id}.`);
  busy.value = false;
  if (result.ok) {
    modal.value = '';
    emit('deleted');
    if (ctx.route.value.page !== 'databases') ctx.to('rds', 'databases');
  }
}
</script>

<style scoped>
.ra__p { margin: 0 0 12px; }
.ra__gap { margin-top: 8px; }
</style>
