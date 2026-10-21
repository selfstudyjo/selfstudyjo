<template>
  <div v-if="launched.length">
    <div class="cs-alert cs-alert--success">
      <CsIcon name="status-positive" class="cs-alert__icon" />
      <div><strong>Success</strong>Successfully initiated launch of instance
        <template v-for="(id, i) in launched" :key="id"><span v-if="i">, </span>
          <a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'instance', { id })">{{ id }}</a></template></div>
    </div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Launch log" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <table class="cs-table-mini"><tbody>
          <tr v-for="(line, i) in log" :key="i"><td>{{ line.text }}</td><td><CsStatus :type="line.ok ? 'success' : 'error'" :label="line.ok ? 'Succeeded' : 'Failed'" /></td></tr>
        </tbody></table>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn" @click="reset">Launch another instance</button>
      <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('ec2', 'instances')">View all instances</button>
    </div>
  </div>

  <div v-else>
    <CsHeader title="Launch an instance"
              description="Amazon EC2 allows you to create virtual machines, or instances, that run on the AWS Cloud. Quickly get started by following the simple steps below." />
    <div class="cs-split">
      <div>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Name and tags" :level="2" /></div>
          <div class="cs-container__body cs-stack">
            <div class="cs-field">
              <label class="cs-label" for="lw-name">Name</label>
              <div class="cs-row lw__name"><input id="lw-name" v-model="name" class="cs-input" placeholder="e.g. My Web Server" />
                <button type="button" class="cs-link" @click="moreTags = !moreTags">Add additional tags</button></div>
            </div>
            <TagEditor v-if="moreTags" v-model="tags" />
          </div>
        </section>

        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Application and OS Images (Amazon Machine Image)" :level="2"
            description="An AMI contains the operating system, application server, and applications for your instance. If you don't see a suitable AMI below, use the search field or choose Browse more AMIs." /></div>
          <div class="cs-container__body cs-stack">
            <div class="lw__qs-head"><strong>Quick Start</strong></div>
            <div class="lw__qs">
              <button v-for="os in quick" :key="os.label" type="button" class="lw__os" :class="{ 'is-selected': os.ami === ami, 'is-off': !os.ami }"
                      :disabled="!os.ami" @click="pickOs(os)">
                <span class="lw__os-name">{{ os.label }}</span>
                <span class="lw__os-logo" :style="{ background: os.color }">{{ os.mark }}</span>
              </button>
            </div>
            <div class="cs-field">
              <label class="cs-label" for="lw-ami">Amazon Machine Image (AMI)</label>
              <select id="lw-ami" v-model="ami" class="cs-select">
                <option v-for="a in amis" :key="a.id" :value="a.id">{{ a.name }} - {{ a.id }}</option>
              </select>
              <span class="cs-constraint">{{ amiRow?.name }} · ami ID {{ ami }} · Architecture 64-bit (x86) · Virtualization: hvm · ENA enabled: true · Root device type: ebs</span>
              <span class="cs-badge cs-badge--grey lw__free">Free tier eligible</span>
            </div>
          </div>
        </section>

        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Instance type" :level="2" /></div>
          <div class="cs-container__body">
            <div class="cs-field">
              <label class="cs-label" for="lw-type">Instance type</label>
              <select id="lw-type" v-model="type" class="cs-select">
                <option v-for="t in types" :key="t.name" :value="t.name">{{ t.name }}</option>
              </select>
              <span class="cs-constraint">Family: {{ type.split('.')[0] }} · {{ typeRow?.cpus }} vCPU · {{ typeRow?.memory }} GiB Memory · Current generation: true</span>
            </div>
          </div>
        </section>

        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Key pair (login)" :level="2"
            description="You can use a key pair to securely connect to your instance. Ensure that you have access to the selected key pair before you launch the instance." /></div>
          <div class="cs-container__body">
            <div class="cs-field">
              <label class="cs-label" for="lw-key">Key pair name - <em>required</em></label>
              <div class="cs-row lw__name">
                <select id="lw-key" v-model="key" class="cs-select">
                  <option value="">Proceed without a key pair (Not recommended)</option>
                  <option v-for="k in keys" :key="k.name" :value="k.name">{{ k.name }}</option>
                </select>
                <button type="button" class="cs-link" @click="keyModal = true">Create new key pair</button>
              </div>
              <div v-if="!key" class="cs-constraint">Default value - not recommended. You won't be able to connect to the instance unless you set up access another way.</div>
            </div>
          </div>
        </section>

        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Network settings" :level="2" /></div>
          <div class="cs-container__body cs-stack">
            <div class="cs-grid-2">
              <div class="cs-field">
                <label class="cs-label" for="lw-vpc">VPC - <em>required</em></label>
                <select id="lw-vpc" v-model="vpc" class="cs-select" @change="onVpc">
                  <option v-for="v in vpcs" :key="v.id" :value="v.id">{{ v.id }}{{ v.default ? ' (default)' : v.name ? ` (${v.name})` : '' }} · {{ v.cidr }}</option>
                </select>
              </div>
              <div class="cs-field">
                <label class="cs-label" for="lw-subnet">Subnet</label>
                <select id="lw-subnet" v-model="subnet" class="cs-select">
                  <option value="">No preference</option>
                  <option v-for="s in subnets" :key="s.id" :value="s.id">{{ s.id }}{{ s.name ? ` (${s.name})` : '' }} · {{ s.az }} · {{ s.cidr }}</option>
                </select>
              </div>
            </div>
            <div v-if="!subnets.length" class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
              <div>There are no subnets in this VPC. Create a subnet before you launch an instance into it.</div></div>
            <div class="cs-field">
              <span class="cs-label">Firewall (security groups)</span>
              <div class="cs-desc">A security group is a set of firewall rules that control the traffic for your instance. Add rules to allow specific traffic to reach your instance.</div>
              <div class="cs-tiles">
                <label class="cs-tile" :class="{ 'is-checked': sgMode === 'create' }"><input v-model="sgMode" type="radio" value="create" /><span><strong>Create security group</strong></span></label>
                <label class="cs-tile" :class="{ 'is-checked': sgMode === 'select' }"><input v-model="sgMode" type="radio" value="select" /><span><strong>Select existing security group</strong></span></label>
              </div>
            </div>
            <template v-if="sgMode === 'create'">
              <div class="cs-field"><label class="cs-label" for="lw-sgname">Security group name - <em>required</em></label>
                <input id="lw-sgname" v-model="sgName" class="cs-input" />
                <span class="cs-constraint">This security group will be added to all network interfaces. The name can't be edited after the security group is created.</span></div>
              <div class="cs-field"><label class="cs-label" for="lw-sgdesc">Description - <em>required</em></label>
                <input id="lw-sgdesc" v-model="sgDesc" class="cs-input" /></div>
              <label class="cs-check"><input v-model="allowSsh" type="checkbox" /><span>Allow SSH traffic from <strong>Anywhere</strong> 0.0.0.0/0<small>Helps you connect to your instance</small></span></label>
              <label class="cs-check"><input v-model="allowHttps" type="checkbox" /><span>Allow HTTPS traffic from the internet<small>To set up an endpoint, for example when creating a web server</small></span></label>
              <label class="cs-check"><input v-model="allowHttp" type="checkbox" /><span>Allow HTTP traffic from the internet<small>To set up an endpoint, for example when creating a web server</small></span></label>
              <div v-if="allowSsh" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
                <div>Rules with source of 0.0.0.0/0 allow all IP addresses to access your instance. We recommend setting security group rules to allow access from known IP addresses only.</div></div>
            </template>
            <div v-else class="cs-field">
              <label class="cs-label">Common security groups</label>
              <div class="lw__sgs">
                <label v-for="g in vpcGroups" :key="g.id" class="cs-check"><input v-model="sgIds" type="checkbox" :value="g.id" />
                  <span>{{ g.name }} <span class="cs-mono cs-muted">{{ g.id }}</span><small>VPC: {{ g.vpc }}</small></span></label>
              </div>
              <span v-if="!sgIds.length" class="cs-error-text">Select at least one security group.</span>
            </div>
          </div>
        </section>

        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Configure storage" :level="2" /></div>
          <div class="cs-container__body">
            <div class="cs-row"><span>1x</span><input class="cs-input lw__gib" value="8" disabled aria-label="Size" /><span>GiB</span>
              <select class="cs-select lw__gib2" disabled><option>gp3</option></select><span>Root volume (Not encrypted)</span></div>
            <div class="cs-constraint lw__gap">Free tier eligible customers can get up to 30 GB of EBS General Purpose (SSD) or Magnetic storage.</div>
          </div>
        </section>

        <section class="cs-container">
          <div class="cs-container__head"><button type="button" class="lw__adv" @click="advanced = !advanced">
            <CsIcon :name="advanced ? 'caret-down' : 'caret-right'" /> <strong>Advanced details</strong></button></div>
          <div v-if="advanced" class="cs-container__body cs-stack">
            <div class="cs-field"><span class="cs-label">Domain join directory</span><select class="cs-select" disabled><option>Select</option></select></div>
            <div class="cs-field"><label class="cs-label" for="lw-profile">IAM instance profile</label>
              <div class="cs-row lw__name">
                <select id="lw-profile" v-model="iamProfile" class="cs-select">
                  <option value="">Select</option>
                  <option v-for="p in profiles" :key="p.name" :value="p.name">{{ p.name }}</option>
                </select>
                <a href="#" class="cs-link" @click.prevent="ctx.to('iam', 'role-create')">Create new IAM profile <CsIcon name="external" size="small" /></a>
              </div>
              <div class="cs-constraint">An instance profile passes an IAM role to the instance. Session Manager needs one whose role has AmazonSSMManagedInstanceCore.</div></div>
            <div class="cs-field"><span class="cs-label">Shutdown behavior</span><select class="cs-select" disabled><option>Stop</option></select></div>
            <div class="cs-field"><label class="cs-label" for="lw-ud">User data - <em>optional</em></label>
              <div class="cs-desc">Enter user data in the field. Shell scripts that start with #!/bin/bash run as root at first boot; the output lands in /var/log/cloud-init-output.log.</div>
              <textarea id="lw-ud" v-model="userData" class="cs-textarea cs-mono" placeholder="#!/bin/bash" spellcheck="false" /></div>
          </div>
        </section>
      </div>

      <aside class="cs-container lw__summary">
        <div class="cs-container__head"><CsHeader title="Summary" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-stack">
          <div class="cs-field"><label class="cs-label" for="lw-count">Number of instances</label>
            <input id="lw-count" v-model.number="count" type="number" min="1" max="8" class="cs-input lw__count" /></div>
          <dl class="lw__sum">
            <dt>Software Image (AMI)</dt><dd>{{ amiRow?.name }}<br /><span class="cs-mono cs-muted">{{ ami }}</span></dd>
            <dt>Virtual server type (instance type)</dt><dd>{{ type }}</dd>
            <dt>Firewall (security group)</dt><dd>{{ sgMode === 'create' ? 'New security group' : (sgIds.join(', ') || '-') }}</dd>
            <dt>Storage (volumes)</dt><dd>1 volume(s) - 8 GiB</dd>
          </dl>
          <div class="cs-alert cs-alert--info lw__tier"><CsIcon name="status-info" class="cs-alert__icon" />
            <div><strong>Free tier:</strong> In your first year of opening an AWS account, you get 750 hours per month of t2.micro instance usage. (Simulated - nothing is billed.)</div></div>
          <div class="lw__btns">
            <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('ec2', 'instances')">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="!canLaunch || busy" @click="launch">
              <span v-if="busy" class="cs-btn__spinner" />Launch instance</button>
          </div>
        </div>
      </aside>
    </div>

    <CsModal v-if="keyModal" title="Create key pair" @close="keyModal = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="lw-kn">Key pair name</label>
          <div class="cs-desc">Key pairs allow you to connect to your instance securely.</div>
          <input id="lw-kn" v-model.trim="keyName" class="cs-input" placeholder="Enter key pair name" />
          <span class="cs-constraint">The name can include up to 255 ASCII characters. It can't include leading or trailing spaces.</span></div>
        <div class="cs-field"><span class="cs-label">Key pair type</span>
          <label class="cs-radio"><input v-model="keyType" type="radio" value="rsa" /> RSA <small>RSA encrypted private and public key pair</small></label>
          <label class="cs-radio"><input v-model="keyType" type="radio" value="ed25519" /> ED25519 <small>ED25519 encrypted private and public key pair</small></label></div>
        <div class="cs-field"><span class="cs-label">Private key file format</span>
          <label class="cs-radio"><input type="radio" checked /> .pem <small>For use with OpenSSH</small></label>
          <label class="cs-radio"><input type="radio" disabled /> .ppk <small>For use with PuTTY</small></label></div>
        <div class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div>When prompted, store the private key in a secure and accessible location on your computer. You will need it later to connect to your instance.</div></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="keyModal = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!keyName || busy" @click="createKey">Create key pair</button>
      </template>
    </CsModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, parseJson, pick, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsStatus from '../CsStatus.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { tagSpec } from '../commands';
import { useAws } from '../ctx';

const ctx = useAws();
const amis = computed(() => pick<any[]>(ctx.view.value, 'amis', []));
const types = computed(() => pick<any[]>(ctx.view.value, 'instance_types', []));
const keys = computed(() => rows(ctx.view.value, 'ec2.key_pairs'));
const vpcs = computed(() => rows(ctx.view.value, 'ec2.vpcs'));
const allSubnets = computed(() => rows(ctx.view.value, 'ec2.subnets'));
const groups = computed(() => rows(ctx.view.value, 'ec2.security_groups'));

const name = ref('');
const moreTags = ref(false);
const tags = ref<Tag[]>([]);
const ami = ref(amis.value[0]?.id || 'ami-0abcdef1234567890');
const type = ref('t3.micro');
const key = ref('');
const vpc = ref(vpcs.value.find(v => v.default)?.id || vpcs.value[0]?.id || '');
const subnet = ref('');
const sgMode = ref<'create' | 'select'>('create');
const existingCount = groups.value.filter(g => String(g.name).startsWith('launch-wizard')).length;
const sgName = ref(`launch-wizard-${existingCount + 1}`);
const sgDesc = ref(`launch-wizard-${existingCount + 1} created ${new Date().toISOString().slice(0, 19).replace('T', 'T')}Z`);
const allowSsh = ref(true);
const allowHttps = ref(false);
const allowHttp = ref(false);
const sgIds = ref<string[]>([]);
const count = ref(1);
const advanced = ref(false);
const iamProfile = ref('');
const userData = ref('');
const profiles = computed(() => rows(ctx.view.value, 'ec2.instance_profiles'));
const busy = ref(false);
const keyModal = ref(false);
const keyName = ref('');
const keyType = ref('rsa');
const launched = ref<string[]>([]);
const log = ref<{ text: string; ok: boolean }[]>([]);

const amiRow = computed(() => amis.value.find(a => a.id === ami.value));
const typeRow = computed(() => types.value.find(t => t.name === type.value));
const subnets = computed(() => allSubnets.value.filter(s => s.vpc === vpc.value));
const vpcGroups = computed(() => groups.value.filter(g => g.vpc === vpc.value));
const canLaunch = computed(() => Boolean(ami.value && type.value && subnets.value.length
  && (sgMode.value === 'create' ? sgName.value.trim() && sgDesc.value.trim() : sgIds.value.length)
  && count.value >= 1 && count.value <= 8));

const MARK: Record<string, [string, string, string]> = {
  'Amazon Linux 2023': ['Amazon Linux', 'aws', '#232f3e'],
  'Ubuntu Server 24.04 LTS': ['Ubuntu', 'U', '#e95420'],
  'Windows Server 2022': ['Windows', '⊞', '#0078d4'],
  'Debian 12': ['Debian', 'D', '#a80030'],
};
const quick = computed(() => {
  const list = amis.value.map(a => {
    const m = MARK[a.name] || [a.name, a.name[0], '#424650'];
    return { label: m[0], mark: m[1], color: m[2], ami: a.id, type: a.default_type };
  });
  return [...list, { label: 'macOS', mark: '', color: '#8c8c94', ami: '', type: '' },
    { label: 'Red Hat', mark: 'RH', color: '#8c8c94', ami: '', type: '' }];
});

function pickOs(os: { ami: string; type: string }) {
  ami.value = os.ami;
  if (os.type) type.value = os.type;
}
function onVpc() {
  subnet.value = '';
  sgIds.value = [];
}
function reset() {
  launched.value = [];
  log.value = [];
  name.value = '';
}

async function createKey() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-key-pair'], { '--key-name': keyName.value, '--key-type': keyType.value }),
    `Successfully created key pair ${keyName.value}. The private key was saved as ${keyName.value}.pem.`);
  busy.value = false;
  if (result.ok) {
    key.value = keyName.value;
    keyModal.value = false;
    keyName.value = '';
  }
}

async function launch() {
  busy.value = true;
  log.value = [];
  let groupIds = [...sgIds.value];
  if (sgMode.value === 'create') {
    const made = await ctx.run(cli(['aws', 'ec2', 'create-security-group'], {
      '--group-name': sgName.value.trim(), '--description': sgDesc.value.trim(), '--vpc-id': vpc.value,
    }));
    log.value.push({ text: `Creating security group ${sgName.value}`, ok: made.ok });
    if (!made.ok) { busy.value = false; return; }
    const groupId = parseJson<{ GroupId: string }>(made.output)?.GroupId || '';
    groupIds = [groupId];
    const rules: [boolean, string][] = [[allowSsh.value, '22'], [allowHttps.value, '443'], [allowHttp.value, '80']];
    for (const [on, port] of rules) {
      if (!on) continue;
      const rule = await ctx.run(cli(['aws', 'ec2', 'authorize-security-group-ingress'], {
        '--group-id': groupId, '--protocol': 'tcp', '--port': port, '--cidr': '0.0.0.0/0',
      }));
      log.value.push({ text: `Authorizing inbound rule tcp/${port} from 0.0.0.0/0`, ok: rule.ok });
    }
  }
  const allTags = [...(name.value.trim() ? [{ key: 'Name', value: name.value.trim() }] : []),
    ...tags.value.filter(t => t.key.trim() && t.key.trim() !== 'Name')];
  const run = await ctx.run(cli(['aws', 'ec2', 'run-instances'], {
    '--image-id': ami.value,
    '--instance-type': type.value,
    '--count': count.value > 1 ? count.value : '',
    '--key-name': key.value,
    '--subnet-id': subnet.value || subnets.value[0]?.id || '',
    '--security-group-ids': groupIds,
    '--tag-specifications': tagSpec('instance', allTags),
    '--iam-instance-profile': iamProfile.value ? `Name=${iamProfile.value}` : '',
    '--user-data': userData.value.trim() ? userData.value : '',
  }));
  log.value.push({ text: 'Launching instance', ok: run.ok });
  busy.value = false;
  if (run.ok) {
    const out = parseJson<{ Instances: { InstanceId: string }[] }>(run.output);
    launched.value = (out?.Instances || []).map(i => i.InstanceId);
  }
}
</script>

<style scoped>
.lw__name { flex-wrap: wrap; }
/* The field keeps a usable width; on a narrow pane the link drops under it instead of squeezing it. */
.lw__name .cs-input, .lw__name .cs-select { flex: 1 1 220px; min-width: 0; }
.lw__name .cs-link { white-space: nowrap; }
.lw__qs { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
.lw__os { display: flex; flex-direction: column; align-items: center; gap: 8px; border: 1px solid #c6c6cd; border-radius: 8px; background: #fff; color: #0f141a; padding: 10px 6px; font: inherit; font-size: 12px; cursor: pointer; }
.lw__os.is-selected { border: 2px solid #006ce0; background: #f0fbff; padding: 9px 5px; }
.lw__os.is-off { opacity: .5; cursor: default; }
.lw__os-name { font-weight: 700; color: #0f141a; }
.lw__os-logo { width: 40px; height: 40px; border-radius: 6px; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 14px; }
.lw__free { align-self: flex-start; }
.lw__sgs { display: flex; flex-direction: column; gap: 8px; }
.lw__gib { width: 70px; }
.lw__gib2 { width: 90px; }
.lw__gap { margin-top: 8px; }
.lw__adv { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; font: inherit; font-size: 18px; cursor: pointer; padding: 0; color: #0f141a; }
.lw__summary { position: sticky; top: 0; }
.lw__count { max-width: 120px; }
.lw__sum { margin: 0; }
.lw__sum dt { font-weight: 700; color: #006ce0; margin-top: 8px; }
.lw__sum dd { margin: 2px 0 0; }
.lw__tier { margin: 0; font-size: 12px; line-height: 16px; }
.lw__btns { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
</style>
