<template>
  <div v-if="inst">
    <CsHeader title="Connect to instance"
              :description="`Connect to your instance ${inst.id}${inst.name ? ` (${inst.name})` : ''} using any of these options`" />

    <div class="cs-tabs" role="tablist">
      <button v-for="t in tabs" :key="t" type="button" role="tab" class="cs-tab" :class="{ 'is-active': tab === t }"
              :aria-selected="tab === t" @click="tab = t">{{ t }}</button>
    </div>

    <!-- EC2 Instance Connect -->
    <section v-if="tab === 'EC2 Instance Connect'" class="cs-container">
      <div class="cs-container__body cs-stack">
        <div v-if="!running" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div><strong>The instance is not running</strong>Start the instance before you connect to it.</div></div>
        <div v-else-if="info.eic" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div><strong>{{ eicTitle }}</strong>{{ info.eic }}
            <div v-if="/Port 22/.test(info.eic) && firstGroup" class="cc__fix">
              <button type="button" class="cs-btn" @click="ctx.to('ec2', 'sg-inbound', { id: firstGroup })">Edit inbound rules of {{ firstGroup }}</button>
            </div></div></div>
        <dl class="cs-kv">
          <div><dt>Instance ID</dt><dd><a href="#" class="cs-link cs-mono" @click.prevent="ctx.to('ec2', 'instance', { id: inst.id })">{{ inst.id }}</a>
            <span v-if="inst.name"> ({{ inst.name }})</span></dd></div>
        </dl>
        <fieldset class="cc__set">
          <legend class="cs-label">Connection type</legend>
          <div class="cs-tiles">
            <label class="cs-tile" :class="{ 'is-checked': connection === 'public' }">
              <input v-model="connection" type="radio" value="public" />
              <span><strong>Connect using a Public IP</strong><small>Connect using a public IPv4 or IPv6 address</small></span>
            </label>
            <label class="cs-tile cc__off" :class="{ 'is-checked': connection === 'eice' }">
              <input v-model="connection" type="radio" value="eice" />
              <span><strong>Connect using a Private IP</strong><small>Connect using an EC2 Instance Connect Endpoint (not modelled in this lab)</small></span>
            </label>
          </div>
        </fieldset>
        <dl class="cs-kv">
          <div><dt>Public IPv4 address</dt><dd>{{ running && inst.public_ip ? inst.public_ip : '–' }}</dd></div>
          <div><dt>IPv6 address</dt><dd>–</dd></div>
        </dl>
        <div class="cs-field">
          <label class="cs-label" for="cc-user">Username</label>
          <div class="cs-desc">Enter the username defined in the AMI used to launch the instance. If you didn't define a custom username, use the AMI's default username, such as ec2-user.</div>
          <input id="cc-user" v-model.trim="username" class="cs-input cc__user" />
        </div>
        <div class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
          <div><strong>Note:</strong> In most cases, the default username, {{ info.user }}, is correct. However, read your AMI usage instructions to check if the AMI owner has changed the default AMI username.</div></div>
      </div>
    </section>

    <!-- Session Manager -->
    <section v-else-if="tab === 'Session Manager'" class="cs-container">
      <div class="cs-container__body cs-stack">
        <div v-if="info.ssm" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div><strong>SSM Agent is not online</strong>The SSM Agent was unable to connect to a Systems Manager endpoint to register itself with the service.
            <div class="cc__reason">{{ info.ssm }}</div>
            <div class="cc__fix cs-row">
              <button v-if="/instance profile|IAM/.test(info.ssm)" type="button" class="cs-btn" @click="ctx.to('ec2', 'instance', { id: inst.id })">Go to the instance to modify its IAM role</button>
              <button v-if="/policy|trust/.test(info.ssm) && inst.iam_role" type="button" class="cs-btn" @click="ctx.to('iam', 'role', { name: inst.iam_role })">Open role {{ inst.iam_role }}</button>
            </div></div></div>
        <div>
          <strong>Session Manager usage:</strong>
          <ul class="cc__list">
            <li>Connect to your instance without SSH keys or a bastion host.</li>
            <li>Sessions are secured using an AWS Key Management Service key.</li>
            <li>You can log session commands and details in an Amazon S3 bucket or CloudWatch Logs log group.</li>
            <li>Configure sessions on the Session Manager Preferences page.</li>
          </ul>
        </div>
        <dl class="cs-kv">
          <div><dt>Instance ID</dt><dd class="cs-mono">{{ inst.id }}</dd></div>
          <div><dt>IAM role</dt><dd>{{ inst.iam_role || '–' }}</dd></div>
        </dl>
      </div>
    </section>

    <!-- SSH client -->
    <section v-else-if="tab === 'SSH client'" class="cs-container">
      <div class="cs-container__body cs-stack">
        <dl class="cs-kv"><div><dt>Instance ID</dt><dd class="cs-mono">{{ inst.id }}<span v-if="inst.name"> ({{ inst.name }})</span></dd></div></dl>
        <div v-if="!inst.key" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div><strong>No associated key pair</strong>This instance is not associated with a key pair. Without a key pair, you can't connect to the instance through SSH. Use EC2 Instance Connect or Session Manager instead.</div></div>
        <ol class="cc__steps">
          <li>Open an SSH client.</li>
          <li>Locate your private key file. The key used to launch this instance is <strong>{{ keyFile }}</strong></li>
          <li>Run this command, if necessary, to ensure your key is not publicly viewable.
            <div class="cc__cmd"><code class="cs-mono">chmod 400 "{{ keyFile }}"</code>
              <button type="button" class="cs-btn cs-btn--icon" aria-label="Copy command" @click="copy(chmodCommand)"><CsIcon name="copy" /></button></div></li>
          <li>Connect to your instance using its Public DNS:
            <div class="cc__cmd"><code class="cs-mono">{{ inst.dns || inst.public_ip || '(no public address)' }}</code>
              <button type="button" class="cs-btn cs-btn--icon" aria-label="Copy DNS" @click="copy(inst.dns || inst.public_ip || '')"><CsIcon name="copy" /></button></div></li>
        </ol>
        <div>
          <strong>Command copied</strong>
          <div class="cc__cmd"><code class="cs-mono">{{ sshCommand }}</code>
            <button type="button" class="cs-btn cs-btn--icon" aria-label="Copy SSH command" @click="copy(sshCommand)"><CsIcon name="copy" /></button></div>
        </div>
        <div v-if="!info.ssh_open" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div>The instance's security groups do not allow inbound <strong>SSH (TCP 22)</strong>, so an SSH client cannot reach it.</div></div>
        <div class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
          <div><strong>Note:</strong> In most cases, the guessed username is correct. However, read your AMI usage instructions to check if the AMI owner has changed the default AMI username.
            This lab has no SSH client of its own - the browser terminal under <em>EC2 Instance Connect</em> reaches the same machine.</div></div>
      </div>
    </section>

    <!-- RDP client (Windows) -->
    <section v-else-if="tab === 'RDP client'" class="cs-container">
      <div class="cs-container__body cs-stack">
        <dl class="cs-kv"><div><dt>Instance ID</dt><dd class="cs-mono">{{ inst.id }}<span v-if="inst.name"> ({{ inst.name }})</span></dd></div></dl>
        <p class="cc__p">You can connect to your Windows instance using a remote desktop client of your choice, and by downloading and running the RDP shortcut file below:</p>
        <div><a class="cs-btn" :href="rdpHref" :download="`${inst.dns || inst.id}.rdp`"><CsIcon name="download" /> Download remote desktop file</a></div>
        <p class="cc__p">When prompted, connect to your instance using the following username and password:</p>
        <dl class="cs-kv">
          <div><dt>Public DNS</dt><dd class="cs-mono">{{ inst.dns || '–' }}</dd></div>
          <div><dt>Username</dt><dd>Administrator</dd></div>
          <div><dt>Password</dt><dd><span v-if="password" class="cs-mono">{{ password }}</span>
            <button v-else type="button" class="cs-link" @click="pwOpen = true">Get password</button></dd></div>
        </dl>
        <div v-if="!info.rdp_open" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div>The instance's security groups do not allow inbound <strong>RDP (TCP 3389)</strong>, so a remote desktop client cannot reach it.</div></div>
      </div>
    </section>

    <!-- EC2 serial console -->
    <section v-else class="cs-container">
      <div class="cs-container__body cs-stack">
        <div class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
          <div><strong>EC2 serial console access is not enabled for your account</strong>EC2 serial console is used for troubleshooting boot and network connectivity issues. It is not modelled in this lab; Actions &gt; Monitor and troubleshoot &gt; Get system log shows the boot output.</div></div>
        <dl class="cs-kv"><div><dt>Instance ID</dt><dd class="cs-mono">{{ inst.id }}</dd></div>
          <div><dt>Serial port</dt><dd>ttyS0</dd></div></dl>
      </div>
    </section>

    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('ec2', 'instance', { id: inst.id })">Cancel</button>
      <button v-if="tab === 'EC2 Instance Connect' || tab === 'Session Manager'" type="button" class="cs-btn cs-btn--primary"
              :disabled="!canConnect" @click="connect">Connect</button>
    </div>

    <CsModal v-if="pwOpen" title="Get Windows password" @close="pwOpen = false">
      <p class="cc__p">Use your private key to retrieve and decrypt the initial Windows administrator password for this instance.</p>
      <dl class="cs-kv cc__gap"><div><dt>Key pair associated with this instance</dt><dd>{{ inst.key || '–' }}</dd></div></dl>
      <div class="cs-field"><label class="cs-label" for="cc-key">Private key file</label>
        <input id="cc-key" v-model.trim="keyInput" class="cs-input" :placeholder="keyFile" /></div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="pwOpen = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !keyInput" @click="decrypt">Decrypt password</button>
      </template>
    </CsModal>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>Instance not found</strong>The instance ID '{{ id }}' does not exist.
      <button type="button" class="cs-link" @click="ctx.to('ec2', 'instances')">View all instances</button></div></div>
</template>

<script setup lang="ts">
/**
 * EC2 > Instances > Connect to instance, with the console's own tabs. The two
 * browser-based options open a terminal page (`ec2/terminal`) whose every line
 * is run against the simulated instance; the SSH and RDP tabs show the exact
 * client commands and files, as the console does.
 */
import { computed, ref } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const id = computed(() => ctx.route.value.params?.id || '');
const inst = computed(() => rows<any>(ctx.view.value, 'ec2.instances').find(i => i.id === id.value) || null);
const info = computed(() => inst.value?.connect || { user: 'ec2-user', eic: '', ssm: '', windows: false, ssh_open: false, rdp_open: false });
const running = computed(() => inst.value?.state === 'running');
const tabs = computed(() => (info.value.windows
  ? ['Session Manager', 'RDP client', 'EC2 serial console']
  : ['EC2 Instance Connect', 'Session Manager', 'SSH client', 'EC2 serial console']));
const tab = ref(tabs.value[0]);
const connection = ref<'public' | 'eice'>('public');
const username = ref(info.value.user);
const busy = ref(false);
const pwOpen = ref(false);
const password = ref('');
const keyFile = computed(() => `${inst.value?.key || 'my-key'}.pem`);
const keyInput = ref(keyFile.value);
const firstGroup = computed(() => (inst.value?.groups || [])[0] || '');
const eicTitle = computed(() => (/Port 22/.test(info.value.eic) ? 'Port 22 (SSH) is not authorized'
  : /public IPv4/.test(info.value.eic) ? 'No public IPv4 address assigned' : 'EC2 Instance Connect is not available'));
const chmodCommand = computed(() => `chmod 400 "${keyFile.value}"`);
const sshCommand = computed(() => `ssh -i "${keyFile.value}" ${info.value.user}@${inst.value?.dns || inst.value?.public_ip || 'instance'}`);
const canConnect = computed(() => {
  if (!running.value) return false;
  if (tab.value === 'Session Manager') return !info.value.ssm;
  return Boolean(username.value) && connection.value === 'public';
});
const rdpHref = computed(() => 'data:application/x-rdp;charset=utf-8,' + encodeURIComponent(
  `auto connect:i:1\nfull address:s:${inst.value?.dns || inst.value?.public_ip || ''}\nusername:s:Administrator\n`));

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* ignored */ }
  ctx.api.notify('success', 'Copied to clipboard', text);
}
function connect() {
  if (!inst.value) return;
  if (tab.value === 'Session Manager') ctx.to('ec2', 'terminal', { id: inst.value.id, via: 'ssm', user: 'ssm-user' });
  else ctx.to('ec2', 'terminal', { id: inst.value.id, via: 'eic', user: username.value });
}
async function decrypt() {
  if (!inst.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'get-password-data'], {
    '--instance-id': inst.value.id, '--priv-launch-key': keyInput.value,
  }));
  busy.value = false;
  if (result.ok) {
    password.value = String(parseJson<{ PasswordData?: string }>(result.output)?.PasswordData || '');
    pwOpen.value = false;
  }
}
</script>

<style scoped>
.cc__set { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.cc__off { opacity: .7; }
.cc__user { max-width: 360px; }
.cc__list, .cc__steps { margin: 6px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; }
.cc__cmd { display: flex; align-items: center; gap: 8px; margin-top: 6px; background: #f8f8f8; border: 1px solid #ebebf0; border-radius: 8px; padding: 6px 6px 6px 12px; max-width: 760px; }
.cc__cmd code { flex: 1; min-width: 0; word-break: break-all; }
.cc__reason { margin-top: 6px; font-weight: 700; }
.cc__fix { margin-top: 10px; }
.cc__p { margin: 0; }
.cc__gap { margin-bottom: 14px; }
</style>
