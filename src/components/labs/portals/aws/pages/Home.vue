<template>
  <div class="home">
    <div class="home__inner">
      <div class="home__head">
        <div class="home__title">
          <h1>Console Home</h1>
          <a class="home__info" href="#" @click.prevent>Info</a>
        </div>
        <div class="cs-row">
          <button type="button" class="cs-btn" disabled>Reset to default layout</button>
          <button type="button" class="cs-btn cs-btn--primary" disabled><CsIcon name="add-plus" /> Add widgets</button>
        </div>
      </div>

      <div class="home__grid">
        <section class="cs-container home__w home__w--wide">
          <div class="cs-container__head home__wh">
            <h2>Recently visited <a class="home__info" href="#" @click.prevent>Info</a></h2>
          </div>
          <div class="cs-container__body">
            <div class="home__recent">
              <button v-for="svc in recentServices" :key="svc.id" type="button" class="home__svc" @click="ctx.go(svc.home)">
                <ServiceIcon :id="svc.id" />
                <span class="cs-link">{{ svc.name }}</span>
              </button>
            </div>
          </div>
          <div class="cs-container__foot home__foot"><a href="#" class="cs-link" @click.prevent="servicesOpen = !servicesOpen">View all services</a></div>
          <div v-if="servicesOpen" class="cs-container__body home__all">
            <button v-for="svc in SERVICES" :key="svc.id" type="button" class="home__svc" @click="ctx.go(svc.home)">
              <ServiceIcon :id="svc.id" small />
              <span class="cs-link">{{ svc.name }}</span>
            </button>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>Welcome to AWS</h2></div>
          <div class="cs-container__body home__welcome">
            <div><strong class="cs-link">Getting started with AWS <CsIcon name="external" size="small" /></strong>
              <p>Learn the fundamentals and find valuable information to get the most out of AWS.</p></div>
            <div><strong class="cs-link">Training and certification <CsIcon name="external" size="small" /></strong>
              <p>Learn from AWS experts and advance your skills and knowledge.</p></div>
            <div><strong class="cs-link">What's new with AWS? <CsIcon name="external" size="small" /></strong>
              <p>Discover new AWS services, features, and Regions.</p></div>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>AWS Health <a class="home__info" href="#" @click.prevent>Info</a></h2></div>
          <div class="cs-container__body">
            <dl class="home__health">
              <div><dt>Open issues</dt><dd class="home__big">0</dd><dd class="cs-muted">Past 7 days</dd></div>
              <div><dt>Scheduled changes</dt><dd class="home__big">0</dd><dd class="cs-muted">Upcoming and past 7 days</dd></div>
              <div><dt>Other notifications</dt><dd class="home__big">0</dd><dd class="cs-muted">Past 7 days</dd></div>
            </dl>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>Cost and usage <a class="home__info" href="#" @click.prevent>Info</a></h2></div>
          <div class="cs-container__body">
            <dl class="home__health">
              <div><dt>Current month costs</dt><dd class="home__big">$0.00</dd></div>
              <div><dt>Forecasted month end costs</dt><dd class="home__big">$0.00</dd></div>
            </dl>
            <p class="cs-muted home__note">This is a simulated account. Nothing here is billed.</p>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>Your resources in {{ ctx.region.value }}</h2></div>
          <div class="cs-container__body">
            <table class="cs-table-mini">
              <tbody>
                <tr v-for="item in resources" :key="item.label">
                  <td><a href="#" class="cs-link" @click.prevent="ctx.go(item.route)">{{ item.label }}</a></td>
                  <td class="home__num">{{ item.count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="cs-container home__w">
          <div class="cs-container__head home__wh"><h2>Build a solution <a class="home__info" href="#" @click.prevent>Info</a></h2></div>
          <div class="cs-container__body home__build">
            <button v-for="item in build" :key="item.text" type="button" class="home__build-item" @click="ctx.go(item.route)">
              <ServiceIcon :id="item.svc" />
              <span><span class="cs-link">{{ item.text }}</span><small>With {{ item.with }} · {{ item.time }}</small></span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { pick, rows } from '@/utils/portalKit';
import CsIcon from '../CsIcon.vue';
import ServiceIcon from '../ServiceIcon.vue';
import { useAws } from '../ctx';
import { SERVICES, SERVICE_BY_ID, type Route, type ServiceId } from '../nav';

const ctx = useAws();
const servicesOpen = ref(false);
const v = ctx.view;

const recentServices = computed(() => {
  const order: ServiceId[] = ['s3', 'ec2', 'vpc', 'iam', 'lambda', 'dynamodb', 'rds', 'cloudwatch'];
  return order.map(id => SERVICE_BY_ID[id]);
});

const r = (svc: ServiceId, page: string): Route => ({ svc, page });
const resources = computed(() => [
  { label: 'S3 buckets', count: rows(v.value, 's3.buckets').length, route: r('s3', 'buckets') },
  { label: 'EC2 instances (running)', count: rows(v.value, 'ec2.instances').filter(i => i.state === 'running').length, route: r('ec2', 'instances') },
  { label: 'VPCs', count: rows(v.value, 'ec2.vpcs').length, route: r('vpc', 'vpcs') },
  { label: 'Security groups', count: rows(v.value, 'ec2.security_groups').length, route: r('ec2', 'sgs') },
  { label: 'IAM roles', count: rows(v.value, 'iam.roles').length, route: r('iam', 'roles') },
  { label: 'Lambda functions', count: rows(v.value, 'lambda').length, route: r('lambda', 'functions') },
  { label: 'DynamoDB tables', count: rows(v.value, 'dynamodb').length, route: r('dynamodb', 'tables') },
  { label: 'RDS DB instances', count: rows(v.value, 'rds').length, route: r('rds', 'databases') },
  { label: 'Log groups', count: pick<any[]>(v.value, 'logs.groups', []).length, route: r('cloudwatch', 'groups') },
]);

const build = [
  { text: 'Launch a virtual machine', with: 'EC2', time: '2-3 mins', svc: 'ec2', route: r('ec2', 'launch') },
  { text: 'Create a bucket', with: 'S3', time: '1 min', svc: 's3', route: r('s3', 'create') },
  { text: 'Build a web app', with: 'Lambda', time: '6 mins', svc: 'lambda', route: r('lambda', 'create') },
  { text: 'Set up a database', with: 'RDS', time: '5 mins', svc: 'rds', route: r('rds', 'create') },
  { text: 'Create a NoSQL table', with: 'DynamoDB', time: '2 mins', svc: 'dynamodb', route: r('dynamodb', 'create') },
  { text: 'Create a VPC', with: 'VPC', time: '2 mins', svc: 'vpc', route: r('vpc', 'vpc-create') },
];
</script>

<style scoped>
.home { background: linear-gradient(180deg, #f3f3f7 0, #fff 360px); min-height: 100%; }
.home__inner { padding: 24px 40px 40px; max-width: 1640px; }
.home__head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
.home__title { display: flex; align-items: baseline; gap: 8px; }
.home__title h1 { margin: 0; font-size: 28px; line-height: 36px; font-weight: 700; }
.home__info { font-size: 12px; font-weight: 700; color: #006ce0; text-decoration: none; margin-left: 6px; }
.home__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 20px; }
.home__w { margin: 0; display: flex; flex-direction: column; }
.home__w--wide { grid-column: span 2; }
.home__wh h2 { margin: 0; font-size: 18px; line-height: 22px; font-weight: 700; }
.home__recent { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px 16px; }
.home__all { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px 16px; }
.home__svc { display: flex; align-items: center; gap: 10px; border: 0; background: none; text-align: left; padding: 2px 0; font: inherit; cursor: pointer; }
.home__foot { text-align: center; }
.home__welcome { display: flex; flex-direction: column; gap: 14px; }
.home__welcome p { margin: 2px 0 0; color: #424650; }
.home__health { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 16px; margin: 0; }
.home__health dt { font-weight: 700; color: #424650; }
.home__health dd { margin: 0; }
.home__big { font-size: 28px; line-height: 36px; font-weight: 700; color: #0f141a; }
.home__note { margin: 14px 0 0; font-size: 12px; }
.home__num { text-align: right; font-weight: 700; width: 60px; }
.home__build { display: flex; flex-direction: column; gap: 14px; }
.home__build-item { display: flex; align-items: center; gap: 12px; border: 0; background: none; text-align: left; font: inherit; cursor: pointer; padding: 0; }
.home__build-item small { display: block; color: #656871; font-size: 12px; }
@container sl-portal (max-width: 900px) {
  .home__inner { padding: 16px; }
  .home__w--wide { grid-column: auto; }
}
</style>
