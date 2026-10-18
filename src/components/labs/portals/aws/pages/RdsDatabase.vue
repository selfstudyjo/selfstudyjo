<template>
  <div v-if="db">
    <CsHeader :title="db.id">
      <template #actions>
        <button type="button" class="cs-btn" @click="ctx.to('rds', 'modify', { id: db.id })">Modify</button>
        <RdsActions :db="db" />
      </template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Summary" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>DB identifier</dt><dd>{{ db.id }}</dd></div>
          <div><dt>Status</dt><dd><CsStatus :state="db.status" /></dd></div>
          <div><dt>Role</dt><dd>Instance</dd></div>
          <div><dt>Engine</dt><dd>{{ engineLabel(db.engine) }}</dd></div>
          <div><dt>Class</dt><dd>{{ db.class }}</dd></div>
          <div><dt>Region & AZ</dt><dd>{{ ctx.region.value }}a</dd></div>
          <div><dt>CPU</dt><dd>{{ db.status === 'available' ? '2.31%' : '–' }}</dd></div>
          <div><dt>Current activity</dt><dd>{{ db.status === 'available' ? '0 Connections' : '–' }}</dd></div>
        </dl>
      </div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in tabs" :key="t.id" type="button" class="cs-tab" :class="{ 'is-active': tab === t.id }" :disabled="t.off" @click="tab = t.id">{{ t.text }}</button>
    </div>
    <section v-if="tab === 'connectivity'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Connectivity & security" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>Endpoint</dt><dd class="cs-mono">{{ db.endpoint }}</dd></div>
          <div><dt>Port</dt><dd>{{ db.port }}</dd></div>
          <div><dt>Availability Zone</dt><dd>{{ ctx.region.value }}a</dd></div>
          <div><dt>VPC</dt><dd class="cs-mono">{{ defaultVpc }}</dd></div>
          <div><dt>Publicly accessible</dt><dd>{{ db.public ? 'Yes' : 'No' }}</dd></div>
          <div><dt>Certificate authority</dt><dd>rds-ca-rsa2048-g1</dd></div>
        </dl>
      </div>
    </section>
    <section v-else-if="tab === 'configuration'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Instance" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>DB instance ID</dt><dd>{{ db.id }}</dd></div>
          <div><dt>Engine version</dt><dd>{{ db.version }}</dd></div>
          <div><dt>DB name</dt><dd>–</dd></div>
          <div><dt>Instance class</dt><dd>{{ db.class }}</dd></div>
          <div><dt>Master username</dt><dd>{{ db.username || '–' }}</dd></div>
          <div><dt>Multi-AZ</dt><dd>{{ db.multi_az ? 'Yes' : 'No' }}</dd></div>
          <div><dt>Storage type</dt><dd>General Purpose SSD (gp3)</dd></div>
          <div><dt>Storage</dt><dd>{{ db.storage }} GiB</dd></div>
          <div><dt>Resource ID</dt><dd class="cs-mono">db-{{ db.id.toUpperCase().replace(/-/g, '').padEnd(26, 'X').slice(0, 26) }}</dd></div>
          <div><dt>ARN</dt><dd class="cs-mono">{{ db.arn }}</dd></div>
          <div><dt>Created time</dt><dd>{{ awsDate(db.created) }}</dd></div>
        </dl>
      </div>
    </section>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Snapshots (${snapshots.length})`" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <table v-if="snapshots.length" class="cs-table-mini"><thead><tr><th>Snapshot name</th><th>Snapshot creation time</th><th>Status</th><th>Type</th></tr></thead>
          <tbody><tr v-for="s in snapshots" :key="s.id"><td>{{ s.id }}</td><td>{{ awsDate(s.created) }}</td><td><CsStatus :state="s.status" /></td><td>{{ s.type }}</td></tr></tbody></table>
        <div v-else class="cs-empty"><strong>No snapshots</strong></div>
      </div>
    </section>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>DBInstanceNotFound</strong>DBInstance {{ id }} not found.
      <button type="button" class="cs-link" @click="ctx.to('rds', 'databases')">View databases</button></div></div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsStatus from '../CsStatus.vue';
import { awsDate, useAws } from '../ctx';
import RdsActions from './RdsActions.vue';
import { engineLabel } from './rdsKit';

const ctx = useAws();
const id = computed(() => ctx.route.value.params?.id || '');
const db = computed(() => rows(ctx.view.value, 'rds').find(d => d.id === id.value) || null);
const snapshots = computed(() => rows(ctx.view.value, 'rds_snapshots').filter(s => s.instance === id.value));
const defaultVpc = computed(() => rows(ctx.view.value, 'ec2.vpcs').find(v => v.default)?.id || '–');
const tabs = [
  { id: 'connectivity', text: 'Connectivity & security' }, { id: 'monitoring', text: 'Monitoring', off: true },
  { id: 'logs', text: 'Logs & events', off: true }, { id: 'configuration', text: 'Configuration' },
  { id: 'maintenance', text: 'Maintenance & backups' }, { id: 'tags', text: 'Tags', off: true },
];
const tab = ref('connectivity');
</script>
