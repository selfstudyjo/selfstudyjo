<template>
  <!-- EC2 Instance Connect Endpoints -->
  <div v-if="page === 'eices'" @contextmenu="onEiceMenu">
    <CsTable variant="full-page" title="EC2 Instance Connect Endpoints" :items="eices" :columns="eiceCols" track-by="id"
             selection-type="single" v-model:selected="eiceSel" filter-placeholder="Filter endpoints"
             empty-title="No EC2 Instance Connect Endpoints"
             empty-text="An endpoint lets you connect to an instance that has no public IP address, without a bastion host.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="eiceSel.length !== 1" @click="deletingEice = eiceSel[0]">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openCreate()">Create endpoint</button>
      </template>
      <template #empty><button type="button" class="cs-btn" @click="openCreate()">Create endpoint</button></template>
      <template #cell-id="{ row }"><span class="cs-mono" :data-row="row.id">{{ row.id }}</span></template>
      <template #cell-state="{ row }"><CsStatus type="success" :label="row.state" /></template>
      <template #cell-sgs="{ row }">{{ row.sgs.join(', ') || '-' }}</template>
      <template #cell-preserve="{ row }">{{ row.preserve_client_ip ? 'Enabled' : 'Disabled' }}</template>
    </CsTable>
  </div>

  <!-- Connect to instance -->
  <div v-else-if="inst">
    <CsHeader title="Connect to instance" :description="`Connect to your instance ${inst.id} (${inst.name || 'no name'}) using any of these options`" />
    <div class="cs-tabs" role="tablist">
      <button v-for="t in tabs" :key="t" type="button" role="tab" class="cs-tab" :class="{ 'is-active': tab === t }"
              :aria-selected="tab === t" @click="tab = t; lastError = ''">{{ t }}</button>
    </div>

    <div v-if="inst.state !== 'running'" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
      <div><strong>The instance is {{ inst.state }}</strong>You can only connect to an instance that is in the running state.
        <button type="button" class="cs-link" @click="ctx.to('ec2', 'instance', { id: inst.id })">View instance</button></div></div>
    <div v-if="lastError" class="cs-alert cs-alert--error" role="alert"><CsIcon name="status-negative" class="cs-alert__icon" />
      <div><strong>Failed to connect to your instance</strong><pre class="cn__err">{{ lastError }}</pre></div></div>

    <!-- EC2 Instance Connect -->
    <section v-if="tab === 'EC2 Instance Connect'" class="cs-container">
      <div class="cs-container__body cs-stack">
        <dl class="cs-kv"><div><dt>Instance ID</dt><dd class="cs-mono">{{ inst.id }} ({{ inst.name }})</dd></div></dl>
        <div class="cs-field" style="max-width: none">
          <span class="cs-label">Connection Type</span>
          <div class="cs-tiles">
            <label class="cs-tile" :class="{ 'is-checked': kind === 'direct' }">
              <input v-model="kind" type="radio" value="direct" name="cn-kind" />
              <span><strong>Connect using EC2 Instance Connect</strong><small>Connect using the EC2 Instance Connect browser-based client, with a public IPv4 or IPv6 address.</small></span>
            </label>
            <label class="cs-tile" :class="{ 'is-checked': kind === 'eice' }">
              <input v-model="kind" type="radio" value="eice" name="cn-kind" />
              <span><strong>Connect using EC2 Instance Connect Endpoint</strong><small>Connect using the EC2 Instance Connect browser-based client, with a private IPv4 address and a VPC endpoint.</small></span>
            </label>
          </div>
        </div>
        <div v-if="kind === 'direct'" class="cs-field">
          <span class="cs-label">Public IPv4 address</span>
          <div v-if="inst.public_ip" class="cs-mono">{{ inst.public_ip }}</div>
          <div v-else class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
            <div>No public IPv4 address assigned. With no public IPv4 address, you can't use EC2 Instance Connect. Alternatively, connect using an EC2 Instance Connect Endpoint.</div></div>
          <span class="cs-constraint">Traffic arrives from the EC2 Instance Connect service range {{ prefix }}; a security group on the instance must allow SSH (TCP 22) from it.</span>
        </div>
        <div v-else class="cs-field">
          <label class="cs-label" for="cn-eice">EC2 Instance Connect Endpoint</label>
          <div class="cn__row">
            <select id="cn-eice" v-model="eice" class="cs-select" :disabled="!vpcEices.length">
              <option v-if="!vpcEices.length" value="">No endpoints in {{ inst.vpc }}</option>
              <option v-for="e in vpcEices" :key="e.id" :value="e.id">{{ e.id }} ({{ e.subnet }})</option>
            </select>
            <button type="button" class="cs-btn" @click="openCreate(inst.vpc)">Create endpoint</button>
          </div>
          <span class="cs-constraint">Private IPv4 address: <span class="cs-mono">{{ inst.ip }}</span>. The instance's security group must allow SSH (TCP 22) from the endpoint's security group.</span>
        </div>
        <div class="cs-field">
          <label class="cs-label" for="cn-user">Username</label>
          <input id="cn-user" v-model.trim="user" class="cs-input" spellcheck="false" autocomplete="off" />
          <span class="cs-constraint">Enter the username defined in the AMI used to launch the instance. If you didn't define a custom username, use the default username, {{ defaultUser }}.</span>
        </div>
        <div v-if="kind === 'eice'" class="cs-field">
          <label class="cs-label" for="cn-tunnel">Max tunnel duration (seconds) <small>- optional</small></label>
          <input id="cn-tunnel" v-model.number="tunnel" type="number" min="1" max="3600" class="cs-input cn__narrow" />
          <span class="cs-constraint">From 1 to 3600 seconds.</span>
        </div>
        <div v-if="windows" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div>EC2 Instance Connect does not support Windows instances. Use Session Manager or an RDP client.</div></div>
      </div>
    </section>

    <!-- Session Manager -->
    <section v-else-if="tab === 'Session Manager'" class="cs-container">
      <div class="cs-container__body cs-stack">
        <div><strong>Session Manager usage:</strong>
          <ul class="cn__ul">
            <li>Connect to your instance without SSH keys or a bastion host.</li>
            <li>Sessions are secured using an AWS Key Management Service key.</li>
            <li>You can log session commands and details in an Amazon S3 bucket or CloudWatch Logs log group.</li>
            <li>Configure sessions on the Session Manager <button type="button" class="cs-link" @click="ctx.to('ssm', 'sessions')">Preferences</button> page.</li>
          </ul>
        </div>
        <div v-if="inst.ssm !== 'Online'" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div><strong>SSM Agent is not online</strong>The SSM Agent was unable to connect to a Systems Manager endpoint to register itself with the service. ({{ inst.ssm }}: {{ inst.ssm_reason }})</div></div>
        <div v-else class="cs-alert cs-alert--success"><CsIcon name="status-positive" class="cs-alert__icon" />
          <div>This instance is a managed node and is ready to start a session.</div></div>
        <div v-if="!sessionLogged" class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
          <div>Session logging is not configured: this session will leave no audit trail of the commands you run.</div></div>
      </div>
    </section>

    <!-- SSH client -->
    <section v-else-if="tab === 'SSH client'" class="cs-container">
      <div class="cs-container__body cs-stack">
        <div><strong>Instance ID</strong><div class="cs-mono">{{ inst.id }} ({{ inst.name }})</div></div>
        <ol class="cn__ol">
          <li>Open an SSH client.</li>
          <li>Locate your private key file. <span class="cs-muted">This instance was launched without a key pair - push a temporary key with <span class="cs-mono">aws ec2-instance-connect send-ssh-public-key</span> first.</span></li>
          <li>Run this command, if necessary, to ensure your key is not publicly viewable.
            <div class="cn__cmd"><code>{{ chmodLine }}</code><button type="button" class="cs-btn cs-btn--icon" aria-label="Copy" @click="copy(chmodLine)"><CsIcon name="copy" /></button></div></li>
          <li>Connect to your instance using its {{ inst.public_ip ? 'Public IP' : 'Private IP' }}:
            <div class="cs-mono">{{ inst.public_ip || inst.ip }}</div></li>
        </ol>
        <div><strong>Example:</strong>
          <div class="cn__cmd"><code>{{ sshExample }}</code><button type="button" class="cs-btn cs-btn--icon" aria-label="Copy" @click="copy(sshExample)"><CsIcon name="copy" /></button></div></div>
        <div v-if="!inst.public_ip" class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
          <div>This instance has no public IP address: an SSH client can only reach it from inside {{ inst.vpc }} (or through an EC2 Instance Connect Endpoint with <span class="cs-mono">aws ec2-instance-connect open-tunnel</span>).</div></div>
        <div class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
          <div>Note: In most cases, the guessed username is correct. However, read your AMI usage instructions to check if the AMI owner has changed the default AMI username.</div></div>
      </div>
    </section>

    <!-- RDP client -->
    <section v-else-if="tab === 'RDP client'" class="cs-container">
      <div class="cs-container__body cs-stack">
        <div class="cs-tiles">
          <label class="cs-tile is-checked"><input type="radio" checked name="cn-rdp" />
            <span><strong>Connect using RDP client</strong><small>Download a file to use with your RDP client and retrieve your password.</small></span></label>
          <label class="cs-tile" title="Fleet Manager Remote Desktop is not simulated in this lab"><input type="radio" disabled name="cn-rdp" />
            <span><strong>Connect using Fleet Manager</strong><small>To connect to the instance using Fleet Manager Remote Desktop, the SSM Agent must be installed and running. (Not simulated.)</small></span></label>
        </div>
        <p class="cn__p">You can connect to your Windows instance using a remote desktop client of your choice, and by downloading and running the RDP shortcut file below:</p>
        <div><button type="button" class="cs-btn" @click="downloadRdp">Download remote desktop file</button></div>
        <p class="cn__p">When prompted, connect to your instance using the following username and password:</p>
        <dl class="cs-kv">
          <div><dt>{{ inst.public_ip ? 'Public DNS' : 'Private IP' }}</dt><dd class="cs-mono">{{ inst.public_ip ? `ec2-${inst.public_ip.replace(/\./g, '-')}.eu-west-1.compute.amazonaws.com` : inst.ip }}</dd></div>
          <div><dt>Username</dt><dd class="cs-mono">Administrator</dd></div>
          <div><dt>Password</dt><dd><button type="button" class="cs-link" :disabled="busy" @click="getPassword">Get password</button></dd></div>
        </dl>
        <div v-if="password !== null" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div><strong>Password not available</strong>{{ password || 'This instance was launched without a key pair, so there is no encrypted password to decrypt. Use Session Manager - the estate\'s access standard - instead.' }}</div></div>
        <div v-if="!inst.sgs.some(allowsRdp)" class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
          <div>No security group on this instance allows RDP (TCP 3389): an RDP client could not reach it.</div></div>
      </div>
    </section>

    <!-- EC2 serial console -->
    <section v-else class="cs-container">
      <div class="cs-container__body cs-stack">
        <dl class="cs-kv"><div><dt>Instance ID</dt><dd class="cs-mono">{{ inst.id }} ({{ inst.name }})</dd></div>
          <div><dt>Serial port</dt><dd>ttyS0</dd></div></dl>
        <div class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div><strong>EC2 Serial Console access is disabled for this account</strong>An administrator must allow access at the account level (EC2 > Settings > EC2 Serial Console). Serial console access is reserved for troubleshooting an instance that cannot boot or reach the network.</div></div>
      </div>
    </section>

    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('ec2', 'instances')">Cancel</button>
      <button v-if="tab !== 'SSH client' && tab !== 'RDP client'" type="button" class="cs-btn cs-btn--primary"
              :disabled="busy || !canConnect" @click="connect">
        <span v-if="busy" class="cs-btn__spinner" aria-hidden="true" />Connect</button>
    </div>

    <section v-if="history.length" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Recent connections" :level="2" :info="false" description="EC2 Instance Connect sessions are not logged by Session Manager." /></div>
      <div class="cs-container__body cs-scroll-x"><table class="cs-table-mini"><thead><tr><th>Session</th><th>User</th><th>Via</th><th>Started</th><th>Ended</th></tr></thead>
        <tbody><tr v-for="h in history" :key="h.id"><td class="cs-mono">{{ h.id }}</td><td>{{ h.user }}</td><td>{{ h.via }}</td><td>{{ h.started }}</td><td>{{ h.ended || 'Active' }}</td></tr></tbody></table></div>
    </section>
  </div>
  <NotFound v-else what="Instance" :id="id" back="instances" />

  <!-- Create endpoint -->
  <CsModal v-if="creating" title="Create EC2 Instance Connect Endpoint" size="large" @close="creating = false">
    <div class="cs-stack">
      <p class="cs-muted cn__p">An EC2 Instance Connect Endpoint lets you connect to instances in a VPC over SSH or RDP without a public IP address, a bastion host or an internet gateway. One endpoint per VPC.</p>
      <div class="cs-field"><label class="cs-label" for="ce-vpc">VPC</label>
        <select id="ce-vpc" v-model="cf.vpc" class="cs-select" @change="cf.subnet = ''; cf.sgs = []">
          <option v-for="v in vpcs" :key="v.id" :value="v.id">{{ v.id }} ({{ v.name }})</option></select></div>
      <div class="cs-field"><span class="cs-label">Security groups</span>
        <span class="cs-desc">The endpoint's security group must allow outbound SSH to your instances; their security groups must allow inbound SSH from it. If you choose none, the VPC's default security group is used.</span>
        <div class="cn__checks">
          <label v-for="g in cfGroups" :key="g.id" class="cs-check"><input v-model="cf.sgs" type="checkbox" :value="g.id" />
            <span><span class="cs-mono">{{ g.id }}</span> ({{ g.name }})</span></label>
          <span v-if="!cfGroups.length" class="cs-muted">No security groups in this VPC.</span>
        </div></div>
      <div class="cs-field"><label class="cs-label" for="ce-subnet">Subnet</label>
        <select id="ce-subnet" v-model="cf.subnet" class="cs-select" :class="{ 'is-invalid': tried && !cf.subnet }">
          <option value="">Choose a subnet</option>
          <option v-for="s in cfSubnets" :key="s.id" :value="s.id">{{ s.id }} ({{ s.name }} | {{ s.az }} | {{ s.cidr }})</option></select>
        <span v-if="tried && !cf.subnet" class="cs-error-text">Choose a subnet.</span></div>
      <label class="cs-check"><input v-model="cf.preserve" type="checkbox" />
        <span>Preserve Client IP<small>The source of traffic to your instance is the client's IP address, not the endpoint's - so instance security groups must then allow the client's address.</small></span></label>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="creating = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="createEice">Create endpoint</button>
    </template>
  </CsModal>

  <CsDelete v-if="deletingEice" :title="`Delete ${deletingEice}?`" word="delete" :busy="busy" @close="deletingEice = ''" @confirm="deleteEice">
    <p class="cn__p">Deleting the endpoint closes any connection open through it, and instances in its VPC will not be reachable over EC2 Instance Connect until another endpoint is created.</p>
  </CsDelete>

  <RowMenu v-if="rm.menu.value" :x="rm.menu.value.x" :y="rm.menu.value.y" :title="rm.menu.value.key"
           :items="[{ id: 'copy', text: 'Copy endpoint ID' }, { id: 'divider', divider: true }, { id: 'delete', text: 'Delete', danger: true }]"
           @select="eiceMenu" @close="rm.close" />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import RowMenu from '../RowMenu.vue';
import { useOps } from '../ctx';
import { copyText, downloadText, useRowMenu } from '../rowmenu';
import NotFound from './NotFound.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const id = computed(() => ctx.route.value.params?.id || '');
const busy = computed(() => ctx.busy.value);
const inst = computed<any>(() => rows<any>(ctx.c.value, 'ec2.instances').find(i => i.id === id.value || i.name === id.value) || null);
const windows = computed(() => inst.value?.platform === 'windows');
const tabs = computed(() => (windows.value
  ? ['Session Manager', 'RDP client', 'EC2 serial console']
  : ['EC2 Instance Connect', 'Session Manager', 'SSH client', 'EC2 serial console']));
const tab = ref('');
watch(tabs, list => { if (!list.includes(tab.value)) tab.value = list[0]; }, { immediate: true });

const allEices = computed(() => rows<any>(ctx.c.value, 'ec2.eices'));
const eices = computed(() => allEices.value.map(e => ({ ...e, preserve: e.preserve_client_ip })));
const vpcEices = computed(() => allEices.value.filter(e => e.vpc === inst.value?.vpc));
const prefix = computed(() => String(ctx.c.value?.ec2?.eic_prefix || '18.202.216.48/29'));
const sessionLogged = computed(() => {
  const prefs = ctx.c.value?.ssm?.prefs || {};
  return Boolean(prefs.s3 || prefs.cloudwatch);
});
const history = computed(() => rows<any>(ctx.c.value, 'ec2.connections').filter(h => h.instance === inst.value?.id).slice(0, 5));
const defaultUser = computed(() => (String(inst.value?.os || '').includes('Ubuntu') ? 'ubuntu' : 'ec2-user'));
const kind = ref<'direct' | 'eice'>('direct');
const eice = ref('');
const user = ref('ec2-user');
const tunnel = ref<number | ''>('');
const lastError = ref('');
const password = ref<string | null>(null);

watch(inst, value => {
  if (!value) return;
  kind.value = value.public_ip ? 'direct' : 'eice';
  user.value = defaultUser.value;
}, { immediate: true });
watch(vpcEices, list => { if (!list.some(e => e.id === eice.value)) eice.value = list[0]?.id || ''; }, { immediate: true });

const sshExample = computed(() => `ssh -i "my-key.pem" ${defaultUser.value}@${inst.value?.public_ip || inst.value?.ip || ''}`);
const canConnect = computed(() => {
  const i = inst.value;
  if (!i || i.state !== 'running') return false;
  if (tab.value === 'EC2 Instance Connect') return !windows.value && Boolean(user.value) && (kind.value === 'direct' || Boolean(eice.value));
  if (tab.value === 'Session Manager') return i.ssm === 'Online';
  return true;
});

const chmodLine = 'chmod 400 "my-key.pem"';
async function copy(text: string) {
  const ok = await copyText(text);
  ctx.api.notify(ok ? 'success' : 'error', ok ? 'Copied to clipboard' : 'Could not copy to the clipboard');
}

function allowsRdp(gid: string): boolean {
  const g = rows<any>(ctx.c.value, 'net.sgs').find(x => x.id === gid);
  return Boolean(g && g.inbound.some((r: any) => r.protocol === '-1' || (r.protocol === 'tcp' && Number(r.from) <= 3389 && Number(r.to) >= 3389)));
}

async function connect() {
  const i = inst.value;
  if (!i) return;
  lastError.value = '';
  let command = '';
  if (tab.value === 'EC2 Instance Connect') {
    command = cli(['aws', 'ec2-instance-connect', 'ssh'], {
      '--instance-id': i.id, '--os-user': user.value, '--connection-type': kind.value,
      '--instance-connect-endpoint-id': kind.value === 'eice' ? eice.value : '',
      '--max-tunnel-duration': kind.value === 'eice' && tunnel.value ? String(tunnel.value) : '',
    });
  } else if (tab.value === 'Session Manager') {
    command = cli(['aws', 'ssm', 'start-session'], { '--target': i.id });
  } else {
    command = cli(['aws', 'ec2-instance-connect', 'send-serial-console-ssh-public-key'], {
      '--instance-id': i.id, '--serial-port': '0', '--ssh-public-key': 'file://serial.pub',
    });
  }
  const result = await ctx.run(command, '', { quiet: true });
  if (!result.ok) lastError.value = String(result.error || result.output || 'The connection failed.').trim();
}

async function getPassword() {
  const i = inst.value;
  if (!i) return;
  const result = await ctx.run(cli(['aws', 'ec2', 'get-password-data'], { '--instance-id': i.id }), '', { quiet: true });
  if (!result.ok) { password.value = String(result.error || '').trim(); return; }
  const data = parseJson<any>(result.output) || {};
  password.value = data.PasswordData ? 'The password is encrypted with the launch key pair; decrypt it with the private key file.' : '';
}

function downloadRdp() {
  const i = inst.value;
  if (!i) return;
  const host = i.public_ip || i.ip;
  downloadText(`${i.name || i.id}.rdp`, `auto connect:i:1\r\nfull address:s:${host}\r\nusername:s:Administrator\r\n`, 'application/x-rdp');
  ctx.api.notify('info', `Downloaded ${i.name || i.id}.rdp`);
}

// ---- endpoints ----
const vpcs = computed(() => rows<any>(ctx.c.value, 'net.vpcs').filter(v => !v.account || v.account === ctx.account.value));
const creating = ref(false);
const tried = ref(false);
const cf = reactive({ vpc: '', subnet: '', sgs: [] as string[], preserve: false });
const cfGroups = computed(() => rows<any>(ctx.c.value, 'net.sgs').filter(g => g.vpc === cf.vpc));
const cfSubnets = computed(() => rows<any>(ctx.c.value, 'net.subnets').filter(s => s.vpc === cf.vpc));
const eiceSel = ref<string[]>([]);
const deletingEice = ref('');
const eiceCols = [
  { id: 'id', header: 'Endpoint ID', sortKey: 'id' }, { id: 'state', header: 'State' }, { id: 'vpc', header: 'VPC ID', sortKey: 'vpc' },
  { id: 'subnet', header: 'Subnet ID' }, { id: 'az', header: 'Availability Zone' }, { id: 'sgs', header: 'Security groups' },
  { id: 'preserve', header: 'Preserve Client IP' }, { id: 'dns', header: 'DNS name' }, { id: 'created', header: 'Created' },
];

function openCreate(vpc = '') {
  cf.vpc = vpc || inst.value?.vpc || vpcs.value[0]?.id || '';
  cf.subnet = '';
  cf.sgs = [];
  cf.preserve = false;
  tried.value = false;
  creating.value = true;
}
async function createEice() {
  tried.value = true;
  if (!cf.subnet) return;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-instance-connect-endpoint'], {
    '--subnet-id': cf.subnet, '--security-group-ids': cf.sgs, '--preserve-client-ip': cf.preserve,
  }));
  if (result.ok) {
    const made = parseJson<any>(result.output)?.InstanceConnectEndpoint?.InstanceConnectEndpointId || '';
    ctx.api.notify('success', `Successfully created EC2 Instance Connect Endpoint ${made}.`);
    creating.value = false;
    if (made) eice.value = made;
  }
}
async function deleteEice() {
  const target = deletingEice.value;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-instance-connect-endpoint'], { '--instance-connect-endpoint-id': target }),
    `Successfully deleted EC2 Instance Connect Endpoint ${target}.`);
  deletingEice.value = '';
  if (result.ok) eiceSel.value = [];
}

const rm = useRowMenu();
function onEiceMenu(event: MouseEvent) { rm.open(event, key => { eiceSel.value = [key]; }); }
async function eiceMenu(action: string) {
  const key = rm.menu.value?.key || eiceSel.value[0];
  if (!key) return;
  if (action === 'copy') await copy(key);
  if (action === 'delete') deletingEice.value = key;
}
</script>

<style scoped>
.cn__err { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; font: 13px Monaco, Menlo, Consolas, monospace; background: none; color: inherit; }
.cn__row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.cn__row .cs-select { flex: 1; min-width: 200px; }
.cn__narrow { width: 160px; }
.cn__ul, .cn__ol { margin: 6px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
.cn__p { margin: 0; }
.cn__cmd { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 6px 6px 6px 12px; background: #f8f8f8; border: 1px solid #ebebf0; border-radius: 8px; max-width: 720px; }
.cn__cmd code { flex: 1; min-width: 0; font: 13px Monaco, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
.cn__checks { display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow: auto; padding: 4px 0; }
</style>
