<template>
  <div v-if="inst">
    <CsHeader :title="`Instance summary for ${inst.id}${inst.name ? ` (${inst.name})` : ''}`"
              :description="`Updated less than a minute ago`">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Instance refreshed')"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" disabled>Connect</button>
        <Ec2InstanceActions :instances="[inst]" />
      </template>
    </CsHeader>

    <section class="cs-container">
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>Instance ID</dt><dd class="cs-mono">{{ inst.id }}</dd></div>
          <div><dt>Public IPv4 address</dt><dd>{{ running ? inst.public_ip || '–' : '–' }}<span v-if="running && inst.public_ip" class="cs-link"> | open address</span></dd></div>
          <div><dt>Private IPv4 addresses</dt><dd>{{ inst.private_ip }}</dd></div>
          <div><dt>IPv6 address</dt><dd>–</dd></div>
          <div><dt>Instance state</dt><dd><CsStatus :state="inst.state" /></dd></div>
          <div><dt>Public IPv4 DNS</dt><dd>{{ running ? inst.dns || '–' : '–' }}</dd></div>
          <div><dt>Private IP DNS name (IPv4 only)</dt><dd>ip-{{ String(inst.private_ip).replace(/\./g, '-') }}.{{ ctx.region.value }}.compute.internal</dd></div>
          <div><dt>Instance type</dt><dd>{{ inst.type }}</dd></div>
          <div><dt>Elastic IP addresses</dt><dd>–</dd></div>
          <div><dt>VPC ID</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'vpcs')">{{ inst.vpc }}</a></dd></div>
          <div><dt>Subnet ID</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'subnets')">{{ inst.subnet }}</a></dd></div>
          <div><dt>Instance ARN</dt><dd class="cs-mono">arn:aws:ec2:{{ ctx.region.value }}:{{ ctx.account.value }}:instance/{{ inst.id }}</dd></div>
        </dl>
      </div>
    </section>

    <div class="cs-tabs">
      <button v-for="t in tabs" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>

    <section v-if="tab === 'Details'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Instance details" :level="2" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>Platform</dt><dd>{{ inst.platform }}</dd></div>
          <div><dt>AMI ID</dt><dd class="cs-mono">{{ inst.image }}</dd></div>
          <div><dt>AMI name</dt><dd>{{ inst.ami_name }}</dd></div>
          <div><dt>Monitoring</dt><dd>disabled</dd></div>
          <div><dt>Launch time</dt><dd>{{ awsDate(inst.launched_at) }} ({{ inst.launched }})</dd></div>
          <div><dt>Key pair assigned at launch</dt><dd>{{ inst.key || '–' }}</dd></div>
          <div><dt>Availability Zone</dt><dd>{{ inst.az }}</dd></div>
          <div><dt>vCPUs</dt><dd>{{ inst.cpus }}</dd></div>
          <div><dt>Memory (GiB)</dt><dd>{{ inst.memory }}</dd></div>
          <div><dt>Owner</dt><dd>{{ ctx.account.value }}</dd></div>
        </dl>
      </div>
    </section>

    <section v-else-if="tab === 'Status and alarms'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Status checks" :level="2" description="Status checks detect problems that may impair this instance from running your applications." /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>System status checks</dt><dd><CsStatus :type="running ? 'success' : 'stopped'" :label="running ? 'System reachability check passed' : '–'" /></dd></div>
          <div><dt>Instance status checks</dt><dd><CsStatus :type="running ? 'success' : 'stopped'" :label="running ? 'Instance reachability check passed' : '–'" /></dd></div>
        </dl>
      </div>
    </section>

    <template v-else-if="tab === 'Security'">
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Security details" :level="2" /></div>
        <div class="cs-container__body">
          <dl class="cs-kv">
            <div><dt>IAM Role</dt><dd>–</dd></div>
            <div><dt>Owner ID</dt><dd>{{ ctx.account.value }}</dd></div>
            <div><dt>Security groups</dt><dd>
              <div v-for="g in instGroups" :key="g.id"><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'sg', { id: g.id })">{{ g.id }} ({{ g.name }})</a></div>
            </dd></div>
          </dl>
        </div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Inbound rules" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-scroll-x">
          <table class="cs-table-mini">
            <thead><tr><th>Security group rule ID</th><th>Port range</th><th>Protocol</th><th>Source</th><th>Security groups</th></tr></thead>
            <tbody>
              <tr v-for="(rule, i) in inbound" :key="i"><td class="cs-mono">sgr-{{ rule.hash }}</td><td>{{ rule.port || 'All' }}</td><td>{{ rule.protocol }}</td><td>{{ rule.cidr }}</td><td>{{ rule.group }}</td></tr>
              <tr v-if="!inbound.length"><td colspan="5" class="cs-muted">No inbound rules</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <section v-else-if="tab === 'Networking'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Networking details" :level="2" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>Public IPv4 address</dt><dd>{{ running ? inst.public_ip || '–' : '–' }}</dd></div>
          <div><dt>Private IPv4 addresses</dt><dd>{{ inst.private_ip }}</dd></div>
          <div><dt>VPC ID</dt><dd class="cs-mono">{{ inst.vpc }}</dd></div>
          <div><dt>Subnet ID</dt><dd class="cs-mono">{{ inst.subnet }}</dd></div>
          <div><dt>Availability Zone</dt><dd>{{ inst.az }}</dd></div>
        </dl>
      </div>
    </section>

    <section v-else-if="tab === 'Storage'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Block devices" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini">
          <thead><tr><th>Volume ID</th><th>Device name</th><th>Volume size (GiB)</th><th>Attachment status</th></tr></thead>
          <tbody>
            <tr><td class="cs-mono">(root)</td><td>/dev/xvda</td><td>8</td><td><CsStatus type="success" label="Attached" /></td></tr>
            <tr v-for="vol in volumes" :key="vol.id"><td class="cs-mono">{{ vol.id }}</td><td>{{ vol.device }}</td><td>{{ vol.size }}</td><td><CsStatus type="success" label="Attached" /></td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="tab === 'Tags'" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Tags (${tagList.length})`" :level="2">
        <template #actions><button type="button" class="cs-btn" @click="tagging = true">Manage tags</button></template>
      </CsHeader></div>
      <div class="cs-container__body">
        <table v-if="tagList.length" class="cs-table-mini">
          <thead><tr><th>Key</th><th>Value</th></tr></thead>
          <tbody><tr v-for="t in tagList" :key="t[0]"><td>{{ t[0] }}</td><td>{{ t[1] || '–' }}</td></tr></tbody>
        </table>
        <div v-else class="cs-empty"><strong>No tags</strong>No tags found for this resource.</div>
      </div>
    </section>

    <ManageTags v-if="tagging" :resource-id="inst.id" :tags="inst.tags || {}" @close="tagging = false" />
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>Instance not found</strong>The instance ID '{{ id }}' does not exist.
      <button type="button" class="cs-link" @click="ctx.to('ec2', 'instances')">View all instances</button></div></div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsStatus from '../CsStatus.vue';
import { awsDate, useAws } from '../ctx';
import Ec2InstanceActions from './Ec2InstanceActions.vue';
import ManageTags from './Ec2ManageTags.vue';
import { protocolLabel } from './sgRules';

const ctx = useAws();
const id = computed(() => ctx.route.value.params?.id || '');
const inst = computed(() => rows(ctx.view.value, 'ec2.instances').find(i => i.id === id.value) || null);
const running = computed(() => inst.value?.state === 'running');
const tabs = ['Details', 'Status and alarms', 'Monitoring', 'Security', 'Networking', 'Storage', 'Tags'];
const tab = ref('Details');
const tagging = ref(false);

const instGroups = computed(() => rows(ctx.view.value, 'ec2.security_groups')
  .filter(g => (inst.value?.groups || []).includes(g.id)));
const inbound = computed(() => instGroups.value.flatMap(g => (g.ingress || []).map((r: any, i: number) => ({
  protocol: protocolLabel(r.protocol), port: r.port, cidr: r.cidr, group: g.name,
  hash: (g.id.slice(3, 11) + String(i)).padEnd(17, '0'),
}))));
const volumes = computed(() => rows(ctx.view.value, 'ec2.volumes').filter(v => v.instance === id.value));
const tagList = computed(() => Object.entries(inst.value?.tags || {}));
</script>
