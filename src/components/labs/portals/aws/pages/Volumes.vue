<template>
  <div v-if="creating">
    <CsHeader title="Create volume"
              description="Create an Amazon EBS volume to attach to any EC2 instance in the same Availability Zone." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Volume settings" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="vc-type">Volume type</label>
          <select id="vc-type" v-model="form.type" class="cs-select">
            <option v-for="t in volumeTypes" :key="t" :value="t">{{ TYPE_NAMES[t] || t }} ({{ t }})</option></select></div>
        <div class="cs-field"><label class="cs-label" for="vc-size">Size (GiB)</label>
          <input id="vc-size" v-model.number="form.size" type="number" min="1" max="16384" class="cs-input" :class="{ 'is-invalid': sizeError }" />
          <span v-if="sizeError" class="cs-error-text">{{ sizeError }}</span>
          <span class="cs-constraint">Min: 1 GiB, Max: 16384 GiB. The value must be an integer.</span></div>
        <div class="cs-field"><label class="cs-label" for="vc-iops">IOPS</label>
          <input id="vc-iops" class="cs-input" value="3000" disabled /></div>
        <div class="cs-field"><label class="cs-label" for="vc-az">Availability Zone</label>
          <select id="vc-az" v-model="form.az" class="cs-select"><option v-for="z in zones" :key="z" :value="z">{{ z }}</option></select></div>
        <div class="cs-field"><span class="cs-label">Snapshot ID - <em>optional</em></span>
          <select class="cs-select" disabled><option>Don't create volume from a snapshot</option></select></div>
        <label class="cs-check"><input type="checkbox" disabled /> <span>Encryption <small>Encrypt this volume</small></span></label>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Tags - optional" :level="2" :info="false" /></div>
      <div class="cs-container__body"><TagEditor v-model="tags" /></div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('ec2', 'volumes')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!sizeError" @click="create">Create volume</button>
    </div>
  </div>
  <div v-else>
    <CsTable v-model:selected="selected" title="Volumes" variant="full-page" :items="volumes" :columns="columns"
             track-by="id" selection-type="single" filter-placeholder="Search" empty-title="No volumes"
             empty-text="You don't have any volumes in this Region.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Volumes refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="actions" :disabled="!current" @select="act" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('ec2', 'volume-create')">Create volume</button>
      </template>
      <template #empty><button type="button" class="cs-btn" @click="ctx.to('ec2', 'volume-create')">Create volume</button></template>
      <template #cell-state="{ row }"><CsStatus :state="row.state" /></template>
      <template #cell-instance="{ row }">
        <a v-if="row.instance" href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'instance', { id: row.instance })">{{ row.instance }}: {{ row.device }}</a>
        <span v-else>–</span>
      </template>
    </CsTable>

    <CsModal v-if="modal === 'attach' && current" title="Attach volume" @close="modal = ''">
      <div class="cs-stack">
        <dl class="cs-kv"><div><dt>Volume ID</dt><dd class="cs-mono">{{ current.id }}</dd></div><div><dt>Availability Zone</dt><dd>{{ current.az }}</dd></div></dl>
        <div class="cs-field"><label class="cs-label" for="va-inst">Instance</label>
          <select id="va-inst" v-model="attachTo" class="cs-select">
            <option value="" disabled>Choose an instance</option>
            <option v-for="i in candidates" :key="i.id" :value="i.id">{{ i.id }}{{ i.name ? ` (${i.name})` : '' }} ({{ i.state }})</option>
          </select>
          <span class="cs-constraint">Only instances in the same Availability Zone as the selected volume are displayed.</span></div>
        <div class="cs-field"><label class="cs-label" for="va-dev">Device name</label>
          <input id="va-dev" v-model="device" class="cs-input" />
          <span class="cs-constraint">Recommended device names for Linux: /dev/sda1 for root volume. /dev/sd[f-p] for data volumes.</span></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!attachTo || busy" @click="attach">Attach volume</button>
      </template>
    </CsModal>
    <CsModal v-if="modal === 'detach' && current" title="Detach volume" @close="modal = ''">
      <p class="vo__p">Are you sure that you want to detach <span class="cs-mono">{{ current.id }}</span> from <span class="cs-mono">{{ current.instance }}</span>?</p>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="detach">Detach</button>
      </template>
    </CsModal>
    <CsDelete v-if="modal === 'delete' && current" title="Delete volume" word="delete" :busy="busy" @close="modal = ''" @confirm="remove">
      <p class="vo__p">Are you sure that you want to delete <span class="cs-mono">{{ current.id }}</span>? This action can't be undone.</p>
    </CsDelete>
    <ManageTags v-if="modal === 'tags' && current" :resource-id="current.id" :tags="current.tags || {}" @close="modal = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown, { type DdItem } from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { tagSpec } from '../commands';
import { awsDate, useAws } from '../ctx';
import ManageTags from './Ec2ManageTags.vue';

const ctx = useAws();
const creating = computed(() => ctx.route.value.page === 'volume-create');
const volumes = computed(() => rows(ctx.view.value, 'ec2.volumes'));
const zones = computed(() => pick<string[]>(ctx.view.value, 'zones', [ctx.region.value + 'a']));
const volumeTypes = computed(() => pick<string[]>(ctx.view.value, 'volume_types', ['gp3']));
const selected = ref<string[]>([]);
const current = computed(() => volumes.value.find(v => v.id === selected.value[0]) || null);
const modal = ref<'' | 'attach' | 'detach' | 'delete' | 'tags'>('');
const busy = ref(false);
const attachTo = ref('');
const device = ref('/dev/sdf');
const form = reactive({ type: 'gp3', size: 100, az: zones.value[0] });
const tags = ref<Tag[]>([]);

const TYPE_NAMES: Record<string, string> = {
  gp3: 'General Purpose SSD', gp2: 'General Purpose SSD', io1: 'Provisioned IOPS SSD', io2: 'Provisioned IOPS SSD',
  st1: 'Throughput Optimized HDD', sc1: 'Cold HDD', standard: 'Magnetic',
};
const columns: Column[] = [
  { id: 'name', header: 'Name', cell: r => r.name || '–' },
  { id: 'id', header: 'Volume ID', sortKey: 'id' },
  { id: 'type', header: 'Type', sortKey: 'type' },
  { id: 'size', header: 'Size', sortKey: 'size', cell: r => `${r.size} GiB` },
  { id: 'iops', header: 'IOPS', cell: () => '3000' },
  { id: 'throughput', header: 'Throughput', cell: () => '125' },
  { id: 'snapshot', header: 'Snapshot ID', cell: () => '–' },
  { id: 'created', header: 'Created', cell: r => awsDate(r.created) },
  { id: 'az', header: 'Availability Zone', sortKey: 'az' },
  { id: 'state', header: 'Volume state', sortKey: 'state' },
  { id: 'instance', header: 'Attached resources' },
];
const actions = computed<DdItem[]>(() => [
  { id: 'modify', text: 'Modify volume', disabled: true },
  { id: 'snapshot', text: 'Create snapshot', disabled: true },
  { id: 'attach', text: 'Attach volume', disabled: current.value?.state !== 'available' },
  { id: 'detach', text: 'Detach volume', disabled: current.value?.state !== 'in-use' },
  { id: 'delete', text: 'Delete volume', disabled: !current.value },
  { id: 'tags', text: 'Manage tags', disabled: !current.value },
]);
const candidates = computed(() => rows(ctx.view.value, 'ec2.instances')
  .filter(i => i.az === current.value?.az && i.state !== 'terminated'));
const sizeError = computed(() => (!Number.isInteger(form.size) || form.size < 1 || form.size > 16384
  ? 'Size must be an integer between 1 and 16384.' : ''));

function act(id: string) {
  modal.value = id as typeof modal.value;
  attachTo.value = '';
}
async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-volume'], {
    '--volume-type': form.type, '--size': form.size, '--availability-zone': form.az,
    '--tag-specifications': tagSpec('volume', tags.value),
  }), 'Successfully created volume.');
  busy.value = false;
  if (result.ok) ctx.to('ec2', 'volumes');
}
async function attach() {
  if (!current.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'attach-volume'], {
    '--volume-id': current.value.id, '--instance-id': attachTo.value, '--device': device.value,
  }), `Successfully attached volume ${current.value.id} to instance ${attachTo.value}.`);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function detach() {
  if (!current.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'detach-volume'], { '--volume-id': current.value.id }),
    `Successfully detached volume ${current.value.id}.`);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function remove() {
  if (!current.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-volume'], { '--volume-id': current.value.id }),
    `Successfully deleted volume ${current.value.id}.`);
  busy.value = false;
  if (result.ok) { modal.value = ''; selected.value = []; }
}
</script>

<style scoped>
.vo__p { margin: 0; }
</style>
