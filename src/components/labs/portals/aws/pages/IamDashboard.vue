<template>
  <div>
    <CsHeader title="IAM Dashboard" />
    <div class="cs-split">
      <div>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Security recommendations" :level="2" /></div>
          <div class="cs-container__body cs-stack">
            <div class="id__rec"><CsStatus type="warning" label="" /><div><strong>Add MFA for root user</strong><p>Add MFA for root user - Enable multi-factor authentication (MFA) for the root user to improve security for this account.</p></div></div>
            <div class="id__rec"><CsStatus type="success" label="" /><div><strong>Root user has no active access keys</strong><p>Using access keys attached to an IAM user instead of the root user improves security.</p></div></div>
          </div>
        </section>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="IAM resources" :level="2" description="Resources in this AWS Account" /></div>
          <div class="cs-container__body">
            <div class="id__grid">
              <div><span class="cs-kv__label">User groups</span><strong class="id__big">0</strong></div>
              <div><a href="#" class="cs-link cs-kv__label" @click.prevent="ctx.to('iam', 'users')">Users</a><strong class="id__big">{{ users }}</strong></div>
              <div><a href="#" class="cs-link cs-kv__label" @click.prevent="ctx.to('iam', 'roles')">Roles</a><strong class="id__big">{{ roles }}</strong></div>
              <div><a href="#" class="cs-link cs-kv__label" @click.prevent="ctx.to('iam', 'policies')">Policies</a><strong class="id__big">{{ policies }}</strong></div>
              <div><span class="cs-kv__label">Identity providers</span><strong class="id__big">0</strong></div>
            </div>
          </div>
        </section>
      </div>
      <aside>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="AWS Account" :level="2" :info="false" /></div>
          <div class="cs-container__body cs-stack">
            <div><div class="cs-kv__label">Account ID</div><span class="cs-mono">{{ ctx.account.value }}</span></div>
            <div><div class="cs-kv__label">Account Alias</div>{{ alias }}</div>
            <div><div class="cs-kv__label">Sign-in URL for IAM users in this account</div>
              <span class="cs-link">https://{{ alias }}.signin.aws.amazon.com/console</span></div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { pick, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsStatus from '../CsStatus.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const users = computed(() => rows(ctx.view.value, 'iam.users').length);
const roles = computed(() => rows(ctx.view.value, 'iam.roles').length);
const policies = computed(() => rows(ctx.view.value, 'iam.managed_policies').length);
const alias = computed(() => String(pick(ctx.view.value, 'account_alias', 'selfstudy-lab')));
</script>

<style scoped>
.id__rec { display: flex; gap: 10px; align-items: flex-start; }
.id__rec p { margin: 2px 0 0; color: #424650; }
.id__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
.id__grid > div { display: flex; flex-direction: column; gap: 2px; }
.id__big { font-size: 28px; line-height: 36px; color: #006ce0; }
</style>
