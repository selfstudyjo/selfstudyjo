<template>
  <div>
    <CsHeader title="EC2 Dashboard" :info="false" />
    <div class="cs-split ed__split">
      <div>
        <section class="cs-container">
          <div class="cs-container__head">
            <CsHeader title="Resources" :level="2">
              <template #actions><button type="button" class="cs-btn" disabled>EC2 Global view</button></template>
            </CsHeader>
            <p class="ed__lead">You are using the following Amazon EC2 resources in the {{ regionName(ctx.region.value) }} Region:</p>
          </div>
          <div class="cs-container__body">
            <div class="ed__grid">
              <div v-for="item in resources" :key="item.label" class="ed__res">
                <a v-if="item.route" href="#" class="cs-link" @click.prevent="ctx.go(item.route)">{{ item.label }}</a>
                <span v-else>{{ item.label }}</span>
                <strong>{{ item.count }}</strong>
              </div>
            </div>
          </div>
        </section>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Launch instance" :level="2" :info="false"
            description="To get started, launch an Amazon EC2 instance, which is a virtual server in the cloud." /></div>
          <div class="cs-container__body">
            <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('ec2', 'launch')">Launch instance</button>
            <p class="cs-muted ed__note">Note: Your instances will launch in the {{ regionName(ctx.region.value) }} Region</p>
          </div>
        </section>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Service health" :level="2" /></div>
          <div class="cs-container__body">
            <dl class="cs-kv"><div><dt>Region</dt><dd>{{ regionName(ctx.region.value) }}</dd></div>
              <div><dt>Status</dt><dd><CsStatus type="success" label="This service is operating normally" /></dd></div></dl>
          </div>
        </section>
      </div>
      <aside>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Account attributes" :level="2" :info="false" /></div>
          <div class="cs-container__body cs-stack">
            <div><div class="cs-kv__label">Default VPC</div><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'vpcs')">{{ defaultVpc || '–' }}</a></div>
            <div class="cs-kv__label">Settings</div>
            <span class="cs-link">Data protection and security</span><span class="cs-link">Zones</span>
            <span class="cs-link">EC2 Serial Console</span><span class="cs-link">Default credit specification</span>
          </div>
        </section>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Explore AWS" :level="2" :info="false" /></div>
          <div class="cs-container__body cs-stack">
            <div><strong>Get up to 40% better price performance</strong><p class="ed__p">T4g instances deliver the best price performance for burstable general purpose workloads in Amazon EC2.</p></div>
            <div><strong>Enable Best Price-Performance with AWS Graviton2</strong><p class="ed__p">AWS Graviton2 powered EC2 instances enable up to 40% better price performance for a broad spectrum of cloud workloads.</p></div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsStatus from '../CsStatus.vue';
import { useAws } from '../ctx';
import { regionName, type Route } from '../nav';

const ctx = useAws();
const v = ctx.view;
const defaultVpc = computed(() => rows(v.value, 'ec2.vpcs').find(x => x.default)?.id || '');
const r = (page: string): Route => ({ svc: 'ec2', page });
const resources = computed(() => {
  const instances = rows(v.value, 'ec2.instances');
  return [
    { label: 'Instances (running)', count: instances.filter(i => i.state === 'running').length, route: r('instances') },
    { label: 'Auto Scaling Groups', count: 0 },
    { label: 'Capacity Reservations', count: 0 },
    { label: 'Dedicated Hosts', count: 0 },
    { label: 'Elastic IPs', count: 0 },
    { label: 'Instances', count: instances.length, route: r('instances') },
    { label: 'Key pairs', count: rows(v.value, 'ec2.key_pairs').length, route: r('keys') },
    { label: 'Load balancers', count: 0 },
    { label: 'Placement groups', count: 0 },
    { label: 'Security groups', count: rows(v.value, 'ec2.security_groups').length, route: r('sgs') },
    { label: 'Snapshots', count: 0 },
    { label: 'Volumes', count: rows(v.value, 'ec2.volumes').length, route: r('volumes') },
  ];
});
</script>

<style scoped>
.ed__split { grid-template-columns: minmax(0, 1fr) 300px; }
.ed__lead { margin: 6px 0 0; color: #424650; }
.ed__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.ed__res { display: flex; justify-content: space-between; gap: 8px; border: 1px solid #c6c6cd; border-radius: 8px; padding: 10px 14px; }
.ed__note { margin: 10px 0 0; font-size: 12px; }
.ed__p { margin: 2px 0 0; color: #424650; font-size: 13px; }
</style>
