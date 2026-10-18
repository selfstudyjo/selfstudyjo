<template>
  <div class="home">
    <div class="home__inner">
      <div class="home__head">
        <div class="home__title"><h1>Console Home</h1><a class="home__info" href="#" @click.prevent>Info</a></div>
        <div class="cs-row">
          <button type="button" class="cs-btn" disabled>Reset to default layout</button>
          <button type="button" class="cs-btn cs-btn--primary" disabled><CsIcon name="add-plus" /> Add widgets</button>
        </div>
      </div>

      <div class="home__grid">
        <section class="cs-container home__w home__w--wide">
          <div class="cs-container__head home__wh"><h2>Recently visited <a class="home__info" href="#" @click.prevent>Info</a></h2></div>
          <div class="cs-container__body">
            <div class="home__recent">
              <button v-for="svc in favourites" :key="svc.id" type="button" class="home__svc" @click="ctx.go(svc.home)">
                <ServiceIcon :id="svc.id" /><span class="cs-link">{{ svc.name }}</span>
              </button>
            </div>
          </div>
          <div class="cs-container__foot"><a href="#" class="cs-link" @click.prevent="all = !all">{{ all ? 'Hide' : 'View all services' }}</a></div>
          <div v-if="all" class="cs-container__body home__all">
            <button v-for="svc in SERVICES" :key="svc.id" type="button" class="home__svc" @click="ctx.go(svc.home)">
              <ServiceIcon :id="svc.id" small /><span class="cs-link">{{ svc.name }}</span>
            </button>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>Shift <a class="home__info" href="#" @click.prevent>Info</a></h2></div>
          <div class="cs-container__body">
            <dl class="home__health">
              <div><dt>Shift time (UTC)</dt><dd class="home__big">{{ shift.time || '-' }}</dd></div>
              <div><dt>Open incidents</dt><dd class="home__big">{{ shift.open ?? 0 }}</dd><dd class="cs-muted">{{ shift.p1_open || 0 }} P1</dd></div>
              <div><dt>SLA breaches</dt><dd class="home__big" :class="{ 'home__bad': shift.breaches }">{{ shift.breaches ?? 0 }}</dd></div>
            </dl>
            <p class="cs-muted home__note">The scenario clock moves only when you run <code>ops wait</code> in the Ops console.</p>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>AWS Health <a class="home__info" href="#" @click.prevent>Info</a></h2></div>
          <div class="cs-container__body">
            <dl class="home__health">
              <div><dt>Alarms in ALARM</dt><dd class="home__big" :class="{ 'home__bad': inAlarm }">{{ inAlarm }}</dd>
                <dd><a href="#" class="cs-link" @click.prevent="ctx.to('cloudwatch', 'alarms')">CloudWatch alarms</a></dd></div>
              <div><dt>Unmanaged instances</dt><dd class="home__big" :class="{ 'home__bad': unmanaged }">{{ unmanaged }}</dd>
                <dd><a href="#" class="cs-link" @click.prevent="ctx.to('ssm', 'fleet')">Fleet Manager</a></dd></div>
              <div><dt>Active GuardDuty findings</dt><dd class="home__big" :class="{ 'home__bad': findings }">{{ findings }}</dd>
                <dd><a href="#" class="cs-link" @click.prevent="ctx.to('guardduty', 'findings')">GuardDuty</a></dd></div>
            </dl>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>Security <a class="home__info" href="#" @click.prevent>Info</a></h2></div>
          <div class="cs-container__body">
            <dl class="home__health">
              <div><dt>Security Hub score</dt><dd class="home__big">{{ security.hub ? security.score + '%' : '-' }}</dd>
                <dd class="cs-muted">{{ security.hub ? `${security.failed_controls} failed controls` : 'Security Hub is not enabled' }}</dd></div>
              <div><dt>Config recording</dt><dd class="home__big">{{ security.config_recording ? 'On' : 'Off' }}</dd></div>
            </dl>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>Cost and usage <a class="home__info" href="#" @click.prevent>Info</a></h2></div>
          <div class="cs-container__body">
            <dl class="home__health">
              <div><dt>Monthly run rate</dt><dd class="home__big">{{ money(finops.monthly) }}</dd></div>
              <div><dt>Savings Plans coverage</dt><dd class="home__big">{{ finops.sp_coverage ?? 0 }}%</dd></div>
            </dl>
            <a href="#" class="cs-link" @click.prevent="ctx.to('cost', 'explorer')">Go to Cost Explorer</a>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>Your resources in {{ ctx.home.value }}</h2></div>
          <div class="cs-container__body">
            <table class="cs-table-mini"><tbody>
              <tr v-for="item in resources" :key="item.label">
                <td><a href="#" class="cs-link" @click.prevent="ctx.go(item.route)">{{ item.label }}</a></td>
                <td class="home__num">{{ item.count }}</td></tr>
            </tbody></table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { pick, rows } from '@/utils/portalKit';
import CsIcon from '../../aws/CsIcon.vue';
import ServiceIcon from '../ServiceIcon.vue';
import { useOps } from '../ctx';
import { money } from '../kit';
import { SERVICES, SERVICE_BY_ID, type Route } from '../nav';

const ctx = useOps();
const all = ref(false);
const shift = computed<any>(() => pick(ctx.view.value, 'shift', {}));
const security = computed<any>(() => pick(ctx.view.value, 'security', {}));
const finops = computed<any>(() => pick(ctx.view.value, 'finops', {}));
const favourites = computed(() => ['ec2', 'vpc', 'iam', 'ssm', 'cloudwatch', 'backup', 'organizations', 'securityhub']
  .map(id => SERVICE_BY_ID[id]).filter(Boolean));
const inAlarm = computed(() => rows<any>(ctx.c.value, 'monitoring.alarms').filter(a => a.state === 'ALARM').length);
const unmanaged = computed(() => rows<any>(ctx.c.value, 'ssm.nodes').filter(n => n.ping !== 'Online' && n.ping !== 'Inactive').length);
const findings = computed(() => rows<any>(ctx.c.value, 'security.guardduty.findings').filter(f => !f.archived).length);
const resources = computed(() => {
  const at = (svc: any, page: string): Route => ({ svc, page });
  return [
    { label: 'Instances (running)', count: rows<any>(ctx.c.value, 'ec2.instances').filter(i => i.state === 'running' && i.region === ctx.home.value).length, route: at('ec2', 'instances') },
    { label: 'Auto Scaling groups', count: rows<any>(ctx.c.value, 'ec2.asgs').length, route: at('ec2', 'asgs') },
    { label: 'VPCs', count: rows<any>(ctx.c.value, 'net.vpcs').length, route: at('vpc', 'vpcs') },
    { label: 'Security groups', count: rows<any>(ctx.c.value, 'net.sgs').length, route: at('vpc', 'sgs') },
    { label: 'IAM users', count: rows<any>(ctx.c.value, 'iam.users').length, route: at('iam', 'users') },
    { label: 'Backup vaults', count: rows<any>(ctx.c.value, 'backup.vaults').length, route: at('backup', 'vaults') },
    { label: 'S3 buckets', count: rows<any>(ctx.c.value, 's3.buckets').length, route: at('s3', 'buckets') },
    { label: 'CloudFormation stacks', count: rows<any>(ctx.c.value, 'iac.stacks').length, route: at('cloudformation', 'stacks') },
  ];
});
</script>

<style scoped>
.home { background: #f8f8f8; min-height: 100%; }
.home__inner { padding: 20px 40px 40px; max-width: 1640px; }
.home__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
.home__title { display: flex; align-items: baseline; gap: 8px; }
.home__title h1 { margin: 0; font-size: 28px; line-height: 34px; font-weight: 700; }
.home__info { font-size: 12px; font-weight: 700; color: #006ce0; text-decoration: none; }
.home__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 20px; }
.home__w { margin: 0; }
.home__w--wide { grid-column: 1 / -1; }
.home__wh h2 { margin: 0; font-size: 18px; line-height: 22px; display: flex; align-items: baseline; gap: 8px; }
.home__recent, .home__all { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap: 12px 20px; }
.home__svc { display: flex; align-items: center; gap: 12px; border: 0; background: none; padding: 4px 0; font: inherit; text-align: left; cursor: pointer; }
.home__health { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; margin: 0; }
.home__health dt { font-weight: 700; color: #424650; font-size: 14px; }
.home__health dd { margin: 0; }
.home__big { font-size: 32px; line-height: 40px; font-weight: 300; color: #006ce0; }
.home__bad { color: #db0000; }
.home__note { margin: 12px 0 0; font-size: 12px; }
.home__note code { font-family: Monaco, Menlo, Consolas, monospace; background: #ebebf0; padding: 0 4px; border-radius: 4px; color: #0f141a; }
.home__num { text-align: right; font-weight: 700; }
@container sl-portal (max-width: 640px) { .home__inner { padding: 14px; } }
</style>
