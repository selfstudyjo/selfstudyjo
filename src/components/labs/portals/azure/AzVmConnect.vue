<template>
  <div class="vmc">
    <!-- ===================== A live session (Bastion / Azure CLI / serial) ===================== -->
    <template v-if="session">
      <div class="vmc-sess">
        <div class="vmc-sess__bar">
          <AzIcon :name="session.kind === 'bastion' ? 'bastion' : 'shell'" :size="16" />
          <span class="vmc-sess__title">{{ sessionTitle }}</span>
          <span class="vmc-sess__sim" title="This lab's VM is a simulation; the tool header says what is modelled">Simulated session</span>
          <span class="vmc-sess__grow"></span>
          <button v-if="session.kind === 'serial'" type="button" class="vmc-sess__btn" @click="serialReset">
            <AzIcon name="restart" :size="14" /> Restart VM</button>
          <button type="button" class="vmc-sess__btn" @click="term?.clear()"><AzIcon name="trash" :size="14" /> Clear</button>
          <button type="button" class="vmc-sess__btn is-danger" @click="disconnect"><AzIcon name="close" :size="14" /> Disconnect</button>
        </div>
        <div class="vmc-sess__screen">
          <AzTerminal ref="term" :key="session.id" :prompt="sessionPrompt" :banner="session.banner" :send="sendLine"
                      :label="sessionTitle + ' input'" running-text="…" @exit="disconnect" />
        </div>
        <p class="az-muted vmc-sess__foot">Every line you run here is sent as
          <code>{{ session.kind === 'bastion' ? 'az network bastion ssh … -- <command>' : session.kind === 'cli'
            ? 'az ssh vm … -- <command>' : 'az vm run-command invoke --scripts <command>' }}</code>
          — open the equivalent-CLI drawer below the portal to see each one.</p>
      </div>
    </template>

    <!-- ===================== Connect ===================== -->
    <template v-else-if="tab === 'connect'">
      <h2 class="az-h2">Connect</h2>
      <div v-if="!running" class="az-banner is-warning"><AzIcon name="warning" />
        <span>The virtual machine is {{ powerLabel.toLowerCase() }}. Start it before connecting —
          no connection method reaches a VM that is not running.
          <button type="button" class="az-link" @click="start">Start VM</button></span></div>
      <div class="vmc-head">
        <div class="az-kv"><span>Public IP address</span><span>{{ p.public_ip || 'None' }}</span></div>
        <div class="az-kv"><span>Private IP address</span><span>{{ p.private_ip }}</span></div>
        <div class="az-kv"><span>Admin username</span><span>{{ p.admin }}</span></div>
        <div class="az-kv"><span>Port</span><span>{{ windows ? '3389 (RDP)' : '22 (SSH)' }}</span></div>
      </div>

      <h3 class="az-section-title">Most common</h3>
      <div class="vmc-methods">
        <article v-if="!windows" class="vmc-method">
          <header><AzIcon name="connect" :size="22" /><div><h4>Native SSH</h4>
            <p>Connect from your own machine with an SSH client, over the public IP.</p></div></header>
          <div class="vmc-req" :class="nativeReady ? 'is-ok' : 'is-bad'">
            <AzIcon :name="nativeReady ? 'ok' : 'warning'" :size="14" />{{ nativeReady ? 'Requirements met' : 'Configuration required' }}</div>
          <button type="button" class="az-btn" @click="pane = 'native'">Select</button>
        </article>
        <article v-else class="vmc-method">
          <header><AzIcon name="connect" :size="22" /><div><h4>Native RDP</h4>
            <p>Connect from your own machine with Remote Desktop, over the public IP.</p></div></header>
          <div class="vmc-req" :class="rdpReady ? 'is-ok' : 'is-bad'">
            <AzIcon :name="rdpReady ? 'ok' : 'warning'" :size="14" />{{ rdpReady ? 'Requirements met' : 'Configuration required' }}</div>
          <button type="button" class="az-btn" @click="pane = 'rdp'">Select</button>
        </article>
        <article v-if="!windows" class="vmc-method">
          <header><AzIcon name="shell" :size="22" /><div><h4>SSH using Azure CLI</h4>
            <p>Open an SSH session in the browser with <code>az ssh vm</code>. Uses the public IP and port 22.</p></div></header>
          <div class="vmc-req" :class="nativeReady && running ? 'is-ok' : 'is-bad'">
            <AzIcon :name="nativeReady && running ? 'ok' : 'warning'" :size="14" />{{ nativeReady && running ? 'Requirements met' : 'Configuration required' }}</div>
          <button type="button" class="az-btn" @click="pane = 'cli'">Select</button>
        </article>
        <article class="vmc-method">
          <header><AzIcon name="bastion" :size="22" /><div><h4>Bastion</h4>
            <p>Connect through Azure Bastion over TLS in the browser — no public IP and no open port 22 needed.</p></div></header>
          <div class="vmc-req" :class="bastion ? 'is-ok' : 'is-bad'">
            <AzIcon :name="bastion ? 'ok' : 'infofill'" :size="14" />{{ bastion ? `Bastion ${bastion.name} (${bastion.props.sku})` : 'Not deployed in this virtual network' }}</div>
          <button type="button" class="az-btn" @click="setTab('bastion')">Select</button>
        </article>
      </div>
      <h3 class="az-section-title">More ways to connect</h3>
      <div class="vmc-more">
        <button type="button" class="az-link" @click="setTab('serial')"><AzIcon name="shell" :size="14" /> Serial console</button>
        <button type="button" class="az-link" @click="setTab('runcommand')"><AzIcon name="play" :size="14" /> Run command</button>
        <button type="button" class="az-link" @click="setTab('bootdiag')"><AzIcon name="monitor" :size="14" /> Boot diagnostics</button>
      </div>
    </template>

    <!-- ===================== Bastion ===================== -->
    <template v-else-if="tab === 'bastion'">
      <h2 class="az-h2">Bastion</h2>
      <template v-if="!bastion">
        <p class="az-intro">Azure Bastion is a managed service that lets you connect to virtual machines over TLS from the
          Azure portal, with no public IP address on the VM and no inbound SSH/RDP rule. There is no Bastion host in
          <b>{{ p.vnet }}</b> yet.</p>
        <div class="az-card vmc-deploy">
          <h3>Deploy Bastion Developer</h3>
          <p class="az-muted">A free, lightweight Bastion that connects to VMs in this virtual network only. It needs no
            <code>AzureBastionSubnet</code> and no public IP address.</p>
          <button type="button" class="az-btn az-btn--primary" :disabled="busy" @click="deployBastion('Developer')">Deploy Bastion Developer</button>
        </div>
        <div class="az-card vmc-deploy">
          <h3>Create Azure Bastion using defaults (Basic)</h3>
          <p class="az-muted">A dedicated Bastion. Creates <code>AzureBastionSubnet</code> (/26) in {{ p.vnet }} and a
            Standard public IP address, then the Bastion host.</p>
          <button type="button" class="az-btn" :disabled="busy" @click="deployBastion('Basic')">Deploy Bastion</button>
        </div>
      </template>
      <template v-else>
        <div class="az-banner is-success"><AzIcon name="ok" />
          <span>Using Bastion: <button type="button" class="az-link" @click="az.go({ page: 'resource', id: bastion.id })">{{ bastion.name }}</button>,
            SKU <b>{{ bastion.props.sku }}</b>, virtual network {{ bastion.props.vnet }}.</span></div>
        <div v-if="windows" class="az-banner"><AzIcon name="infofill" />
          <span>A Bastion RDP session draws the Windows desktop in the browser, which this lab does not model. Use
            <button type="button" class="az-link" @click="setTab('runcommand')">Run command</button> to run PowerShell on this VM.</span></div>
        <template v-else>
          <p class="az-intro">Please enter username and password or SSH key to your virtual machine to connect using Bastion.</p>
          <div class="az-form vmc-form">
            <div class="az-field"><div class="az-field__label">Authentication Type</div>
              <div class="az-field__ctl"><select v-model="bForm.auth" class="az-select">
                <option value="ssh-key">SSH Private Key from Local File</option>
                <option value="password">Password</option></select></div></div>
            <div class="az-field"><div class="az-field__label">Username <span class="az-req">*</span></div>
              <div class="az-field__ctl"><input v-model="bForm.user" class="az-input" autocomplete="off" /></div></div>
            <div v-if="bForm.auth === 'password'" class="az-field"><div class="az-field__label">VM Password <span class="az-req">*</span></div>
              <div class="az-field__ctl"><input v-model="bForm.password" class="az-input" type="password" autocomplete="off" /></div></div>
            <div v-else class="az-field"><div class="az-field__label">Local File <span class="az-req">*</span></div>
              <div class="az-field__ctl"><input class="az-input" readonly :value="`~/.ssh/${p.name || res.name}_key.pem`" />
                <div class="az-help">The key generated when this VM was created.</div></div></div>
            <label class="az-check"><input v-model="bForm.newTab" type="checkbox" disabled /> Open in new browser tab (the lab opens the session in this blade)</label>
            <div style="margin-top: 14px"><button type="button" class="az-btn az-btn--primary"
              :disabled="!bForm.user || (bForm.auth === 'password' && !bForm.password) || busy" @click="openBastion">Connect</button></div>
          </div>
        </template>
      </template>
    </template>

    <!-- ===================== Serial console ===================== -->
    <template v-else-if="tab === 'serial'">
      <h2 class="az-h2">Serial console</h2>
      <div v-if="!p.boot_diagnostics" class="az-banner is-warning"><AzIcon name="warning" />
        <span>Boot diagnostics must be enabled to use the serial console.
          <button type="button" class="az-link" @click="enableBootDiag">Enable with managed storage account (recommended)</button></span></div>
      <div v-else-if="!running" class="az-banner is-warning"><AzIcon name="warning" />
        <span>The serial console is only available while the VM is running. <button type="button" class="az-link" @click="start">Start VM</button></span></div>
      <template v-else>
        <p class="az-intro">The serial console connects to ttyS0 on the VM, independent of its network configuration — which is
          what makes it the way back in when an NSG or a firewall rule has locked you out.</p>
        <button type="button" class="az-btn az-btn--primary" @click="openSerial">Connect to serial console</button>
      </template>
    </template>

    <!-- ===================== Run command ===================== -->
    <template v-else-if="tab === 'runcommand'">
      <h2 class="az-h2">Run command</h2>
      <p class="az-intro">Run scripts on the VM through the VM agent. Commands run as <b>{{ windows ? 'NT AUTHORITY\\SYSTEM' : 'root' }}</b>,
        need the VM to be running, and do not need any network access to it.</p>
      <AzTable :columns="rcCols" :rows="rcRows" row-key="id">
        <template #cell-id="{ row }"><button type="button" class="az-link" @click="openRun(row.id)">{{ row.id }}</button></template>
      </AzTable>
      <AzPane v-if="rcOpen" :title="'Run Command Script'" :subtitle="rcOpen" :error="rcError" @close="rcOpen = ''">
        <template v-if="rcOpen === 'RunShellScript' || rcOpen === 'RunPowerShellScript'">
          <div class="az-field"><div class="az-field__label">{{ windows ? 'PowerShell Script' : 'Linux Shell Script' }}</div>
            <div class="az-field__ctl"><textarea v-model="rcScript" class="az-textarea az-mono vmc-script" spellcheck="false"></textarea></div></div>
        </template>
        <p v-else class="az-muted">{{ rcOpen === 'ifconfig' ? 'Lists the network configuration of the VM.' : 'Lists the IP configuration of the VM.' }}</p>
        <div class="az-section-title">Output</div>
        <pre class="az-code vmc-output">{{ rcOutput || (rcRunning ? 'Script execution in progress…' : '') }}</pre>
        <template #foot>
          <button type="button" class="az-btn az-btn--primary" :disabled="rcRunning || ((rcOpen === 'RunShellScript' || rcOpen === 'RunPowerShellScript') && !rcScript.trim())"
                  @click="runScript">Run</button>
          <button type="button" class="az-btn" @click="rcOpen = ''">Close</button>
        </template>
      </AzPane>
    </template>

    <!-- ===================== Boot diagnostics ===================== -->
    <template v-else-if="tab === 'bootdiag'">
      <h2 class="az-h2">Boot diagnostics</h2>
      <div class="az-cmdbar">
        <button type="button" class="az-cmd" @click="bdSettings = true"><AzIcon name="settings" /> Settings</button>
        <button type="button" class="az-cmd" :disabled="!p.boot_diagnostics" @click="loadBootLog"><AzIcon name="refresh" /> Refresh</button>
      </div>
      <div v-if="!p.boot_diagnostics" class="az-banner"><AzIcon name="infofill" />
        <span>Boot diagnostics is disabled for this virtual machine. <button type="button" class="az-link" @click="enableBootDiag">Enable with managed storage account</button></span></div>
      <template v-else>
        <div class="az-tabs"><button type="button" class="az-tab is-active">Serial log</button></div>
        <pre class="az-code vmc-bootlog">{{ bootLog || (running ? 'Loading…' : 'The VM is not running; there is no serial output.') }}</pre>
      </template>
      <AzPane v-if="bdSettings" title="Boot diagnostics settings" @close="bdSettings = false">
        <div class="az-radios" style="flex-direction: column">
          <label class="az-radio"><input v-model="bdChoice" type="radio" value="on" /> Enable with managed storage account (recommended)</label>
          <label class="az-radio"><input v-model="bdChoice" type="radio" value="off" /> Disable</label></div>
        <template #foot>
          <button type="button" class="az-btn az-btn--primary" @click="saveBootDiag">Save</button>
          <button type="button" class="az-btn" @click="bdSettings = false">Cancel</button>
        </template>
      </AzPane>
    </template>

    <!-- ===================== Native SSH / CLI / RDP panes ===================== -->
    <AzPane v-if="pane === 'native'" title="Native SSH" :subtitle="res.name" @close="pane = ''">
      <h3 class="az-section-title">1 Configure prerequisites for Native SSH</h3>
      <div class="vmc-check" :class="p.public_ip ? 'is-ok' : 'is-bad'"><AzIcon :name="p.public_ip ? 'ok' : 'error'" :size="14" />
        <span>Public IP address: {{ p.public_ip || 'this VM has none — use Bastion, or associate a public IP with its network interface' }}</span></div>
      <div class="vmc-check" :class="portOpen(22) ? 'is-ok' : 'is-bad'"><AzIcon :name="portOpen(22) ? 'ok' : 'error'" :size="14" />
        <span>Port 22 inbound: {{ portOpen(22) ? 'allowed by ' + portRule(22) : 'blocked by ' + portRule(22) }}
          <button v-if="!portOpen(22) && nsgName" type="button" class="az-link" @click="openPort(22)">Add inbound rule for port 22</button></span></div>
      <div class="vmc-check" :class="running ? 'is-ok' : 'is-bad'"><AzIcon :name="running ? 'ok' : 'error'" :size="14" />
        <span>VM status: {{ powerLabel }}</span></div>
      <h3 class="az-section-title">2 Copy and execute SSH command</h3>
      <div class="vmc-copy"><pre class="az-code">{{ sshCommand }}</pre>
        <button type="button" class="az-btn" @click="copy(sshCommand)"><AzIcon name="copy" /> Copy</button></div>
      <p class="az-muted">Run it in a terminal on your own machine. {{ p.auth === 'password' ? 'You will be asked for the admin password.' : `The private key is the .pem file downloaded when the VM was created; on Linux/macOS run chmod 400 on it first.` }}</p>
      <h3 class="az-section-title">3 Test your connection</h3>
      <div v-if="testResult" class="az-banner" :class="testResult.ok ? 'is-success' : 'is-error'">
        <AzIcon :name="testResult.ok ? 'ok' : 'error'" /><span class="vmc-pre">{{ testResult.text }}</span></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="busy" @click="testConnection">Test connection</button>
        <button type="button" class="az-btn" @click="pane = ''">Close</button>
      </template>
    </AzPane>
    <AzPane v-if="pane === 'cli'" title="SSH using Azure CLI" :subtitle="res.name" @close="pane = ''">
      <p class="az-intro">Starts an SSH session to the VM's public IP with <code>az ssh vm</code>, inside this blade.</p>
      <div class="vmc-copy"><pre class="az-code">{{ cliLogin }}</pre></div>
      <div v-if="!nativeReady" class="az-banner is-warning"><AzIcon name="warning" />
        <span>{{ !p.public_ip ? 'This VM has no public IP address.' : 'Port 22 is not open to the internet on its network security group(s).' }}
          The session will time out — the same way it would from your own machine.</span></div>
      <div class="az-field"><div class="az-field__label">Username</div>
        <div class="az-field__ctl"><input v-model="cliUser" class="az-input" /></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!cliUser || busy" @click="openCli">Connect</button>
        <button type="button" class="az-btn" @click="pane = ''">Cancel</button>
      </template>
    </AzPane>
    <AzPane v-if="pane === 'rdp'" title="Native RDP" :subtitle="res.name" @close="pane = ''">
      <h3 class="az-section-title">1 Configure prerequisites for Native RDP</h3>
      <div class="vmc-check" :class="p.public_ip ? 'is-ok' : 'is-bad'"><AzIcon :name="p.public_ip ? 'ok' : 'error'" :size="14" />
        <span>Public IP address: {{ p.public_ip || 'none' }}</span></div>
      <div class="vmc-check" :class="portOpen(3389) ? 'is-ok' : 'is-bad'"><AzIcon :name="portOpen(3389) ? 'ok' : 'error'" :size="14" />
        <span>Port 3389 inbound: {{ portOpen(3389) ? 'allowed by ' + portRule(3389) : 'blocked by ' + portRule(3389) }}
          <button v-if="!portOpen(3389) && nsgName" type="button" class="az-link" @click="openPort(3389)">Add inbound rule for port 3389</button></span></div>
      <h3 class="az-section-title">2 Download and open the RDP file</h3>
      <button type="button" class="az-btn" :disabled="!p.public_ip" @click="downloadRdp"><AzIcon name="download" /> Download RDP file</button>
      <p class="az-muted">Sign in as <b>{{ p.admin }}</b> with the password you set when you created the VM.</p>
      <template #foot><button type="button" class="az-btn" @click="pane = ''">Close</button></template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/**
 * Connecting to a virtual machine: the Connect blade, Bastion, the serial
 * console, Run command and Boot diagnostics.
 *
 * A session in the browser is a terminal whose every line is the `az` command
 * line that would do the same thing: `az network bastion ssh ... -- <line>`,
 * `az ssh vm ... -- <line>`, or `az vm run-command invoke --scripts <line>`.
 * The engine decides whether the session is allowed at all - a stopped VM, a
 * closed port 22, a VM in a VNet the Bastion cannot reach all refuse there, so
 * the portal and the CLI console can never disagree about it.
 */
import { computed, reactive, ref, watch } from 'vue';
import { cli, errorText, parseJson, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import AzTerminal, { type TermReply } from './AzTerminal.vue';
import { useAz } from './azure';

const props = defineProps<{ res: Record<string, any>; tab: string }>();
const emit = defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
const p = computed(() => props.res.props || {});
const busy = computed(() => az.busy.value);
const running = computed(() => p.value.power === 'VM running');
const windows = computed(() => String(p.value.image || '').startsWith('Win'));
const powerLabel = computed(() => (running.value ? 'Running' : p.value.power === 'VM deallocated' ? 'Stopped (deallocated)' : 'Stopped'));
function setTab(t: string) { emit('tab', t); }

// ----- network reachability, as the portal's checklist shows it -----
const nsgName = computed(() => String(p.value.nsg || ''));
const vnets = computed(() => rows(az.p.value, 'vnets'));
const subnetNsg = computed(() => {
  const v = vnets.value.find(x => x.name === p.value.vnet && x.group === props.res.group) || vnets.value.find(x => x.name === p.value.vnet);
  return String((v?.subnets || []).find((s: any) => s.name === p.value.subnet)?.nsg || '');
});
function nsgRules(name: string) {
  const n = rows(az.p.value, 'nsgs').find(x => x.name === name);
  if (!n) return [] as Record<string, any>[];
  return [...(n.rules || []), ...(n.defaults || [])].filter((r: any) => r.direction === 'Inbound')
    .sort((a: any, b: any) => Number(a.priority) - Number(b.priority));
}
function portMatch(spec: unknown, port: number) {
  return String(spec ?? '*').split(/[,;]/).some(part => {
    const t = part.trim();
    if (!t || t === '*' || t === 'Any') return true;
    const [lo, hi] = t.split('-').map(Number);
    return hi ? port >= lo && port <= hi : Number(t) === port;
  });
}
function sourceFromInternet(src: unknown) {
  const s = String(src ?? '*');
  return !['VirtualNetwork', 'AzureLoadBalancer', 'VirtualNetworkAll'].includes(s);
}
/** The first rule, by priority, that a SYN from the internet to `port` meets on one NSG. */
function firstRule(name: string, port: number) {
  return nsgRules(name).find(r => portMatch(r.destinationPortRange, port)
    && ['*', 'Any', 'Tcp', 'TCP'].includes(String(r.protocol || '*')) && sourceFromInternet(r.sourceAddressPrefix)) || null;
}
function check(port: number): { ok: boolean; rule: string } {
  for (const [where, name] of [['subnet', subnetNsg.value], ['NIC', nsgName.value]] as const) {
    if (!name) continue;
    const r = firstRule(name, port);
    if (!r || r.access !== 'Allow') return { ok: false, rule: `${r ? r.name : 'DenyAllInBound'} on ${name} (${where})` };
  }
  if (!subnetNsg.value && !nsgName.value) return { ok: true, rule: 'no network security group' };
  return { ok: true, rule: [subnetNsg.value, nsgName.value].filter(Boolean).map(n => `${firstRule(n, port)?.name} on ${n}`).join(' and ') };
}
function portOpen(port: number) { return check(port).ok; }
function portRule(port: number) { return check(port).rule; }
const nativeReady = computed(() => Boolean(p.value.public_ip) && portOpen(22));
const rdpReady = computed(() => Boolean(p.value.public_ip) && portOpen(3389));
const sshCommand = computed(() => (p.value.auth === 'password'
  ? `ssh ${p.value.admin}@${p.value.public_ip || '<no-public-ip>'}`
  : `ssh -i ~/.ssh/${props.res.name}_key.pem ${p.value.admin}@${p.value.public_ip || '<no-public-ip>'}`));
function copy(text: string) {
  void navigator.clipboard?.writeText(text);
  az.note('info', 'Copied to clipboard');
}

async function start() {
  await az.run(cli(['az', 'vm', 'start'], { '-g': props.res.group, '-n': props.res.name }),
               `Successfully started virtual machine '${props.res.name}'`);
}
async function openPort(port: number) {
  const n = rows(az.p.value, 'nsgs').find(x => x.name === nsgName.value);
  if (!n) return;
  const taken = new Set((n.rules || []).map((r: any) => Number(r.priority)));
  let priority = 300;
  while (taken.has(priority)) priority += 10;
  const name = port === 22 ? 'SSH' : port === 3389 ? 'RDP' : `Port_${port}`;
  await az.run(cli(['az', 'network', 'nsg', 'rule', 'create'], {
    '-g': n.group, '--nsg-name': n.name, '-n': name, '--priority': String(priority), '--direction': 'Inbound',
    '--access': 'Allow', '--protocol': 'Tcp', '--source-address-prefixes': '*', '--source-port-ranges': '*',
    '--destination-address-prefixes': '*', '--destination-port-ranges': String(port),
  }), `Created security rule '${name}' (port ${port}) on '${n.name}'`);
}

const testResult = ref<{ ok: boolean; text: string } | null>(null);
async function testConnection() {
  testResult.value = null;
  const r = await az.api.exec(cli(['az', 'ssh', 'vm'], { '-g': props.res.group, '-n': props.res.name,
                                                       '--local-user': p.value.admin, '--': 'true' }), { quiet: true });
  testResult.value = r.ok ? { ok: true, text: `Connected to ${p.value.public_ip}:22 as ${p.value.admin}. Your SSH command will work.` }
    : { ok: false, text: errorText(r) };
}
function downloadRdp() {
  const body = `full address:s:${p.value.public_ip}:3389\r\nprompt for credentials:i:1\r\nadministrative session:i:1\r\nusername:s:${p.value.admin}\r\n`;
  const url = URL.createObjectURL(new Blob([body], { type: 'application/x-rdp' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.res.name}.rdp`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ----- sessions -----
interface Session { id: number; kind: 'bastion' | 'cli' | 'serial'; user: string; banner: string; auth?: string }
const session = ref<Session | null>(null);
const term = ref<InstanceType<typeof AzTerminal> | null>(null);
let sid = 0;
const pane = ref('');
const bastion = computed(() => {
  const all = rows(az.p.value, 'resources').filter(r => r.kind === 'bastion');
  return all.find(b => b.props?.vnet === p.value.vnet) || null;
});
const bForm = reactive({ auth: p.value.auth === 'password' ? 'password' : 'ssh-key', user: String(p.value.admin || 'azureuser'),
                         password: '', newTab: false });
const cliUser = ref(String(p.value.admin || 'azureuser'));
const sessionTitle = computed(() => {
  const s = session.value;
  if (!s) return '';
  if (s.kind === 'bastion') return `${props.res.name} — Bastion (${bastion.value?.name || ''})`;
  if (s.kind === 'cli') return `${props.res.name} — az ssh vm`;
  return `${props.res.name} — Serial console`;
});
const sessionPrompt = computed(() => {
  const s = session.value;
  if (!s) return '$ ';
  if (s.kind === 'serial') return `root@${props.res.name}:~# `;
  const home = `/home/${s.user}`;
  const cwd = String(p.value.shell?.cwd?.[s.user] || home);
  const shown = cwd === home ? '~' : cwd.startsWith(home + '/') ? '~' + cwd.slice(home.length) : cwd;
  return `${s.user}@${props.res.name}:${shown}$ `;
});

function bastionBase(): Record<string, string> {
  const b = bastion.value!;
  return { '--name': b.name, '--resource-group': b.group, '--target-resource-id': props.res.id,
           '--auth-type': bForm.auth, '--username': session.value?.user || bForm.user };
}
async function openBastion() {
  const flags = { ...bastionBase(), '--username': bForm.user };
  const r = await az.api.exec(cli(['az', 'network', 'bastion', 'ssh'], flags), { quiet: true });
  if (!r.ok) { fail('Bastion could not connect', r); return; }
  session.value = { id: ++sid, kind: 'bastion', user: bForm.user, auth: bForm.auth, banner: String(r.output || '') };
}
async function openCli() {
  const r = await az.api.exec(cli(['az', 'ssh', 'vm'], { '-g': props.res.group, '-n': props.res.name, '--local-user': cliUser.value }),
                              { quiet: true });
  if (!r.ok) { fail('SSH connection failed', r); return; }
  pane.value = '';
  session.value = { id: ++sid, kind: 'cli', user: cliUser.value, banner: String(r.output || '') };
}
async function openSerial() {
  const r = await az.api.exec(cli(['az', 'serial-console', 'connect'], { '-g': props.res.group, '-n': props.res.name }), { quiet: true });
  if (!r.ok) { fail('Serial console unavailable', r); return; }
  session.value = { id: ++sid, kind: 'serial', user: 'root',
                    banner: `${String(r.output || '').replace(/login: $/, 'login: root (auto)')}\n[Simulated] Lines typed here run as root through az vm run-command invoke.` };
}
async function serialReset() {
  if (!(await az.confirm({ title: 'Restart VM (Hard)', message: `This sends a hard reset to '${props.res.name}' through the serial console. Unsaved work in memory is lost.`, confirmLabel: 'Restart' }))) return;
  const r = await az.api.exec(cli(['az', 'serial-console', 'send', 'reset'], { '-g': props.res.group, '-n': props.res.name }), { quiet: true });
  term.value?.print(r.ok ? String(r.output || '') : errorText(r), r.ok ? 'info' : 'err');
  if (r.ok) {
    const log = await az.api.exec(cli(['az', 'vm', 'boot-diagnostics', 'get-boot-log'], { '-g': props.res.group, '-n': props.res.name }),
                                  { quiet: true, unlogged: true });
    if (log.ok) term.value?.print(String(log.output || ''), 'info');
  }
}
function disconnect() { session.value = null; }
/** A refused connection: a toast now and an entry in the bell, as the portal does. */
function fail(title: string, r: Parameters<typeof errorText>[0]) {
  az.api.notify('error', title, errorText(r));
  az.note('error', title, errorText(r));
}

/** The stdout/stderr out of a run-command result's "message". */
function runCommandText(output: string | undefined): { out: string; err: string } {
  const doc = parseJson<Record<string, any>>(output);
  const message = String(doc?.value?.[0]?.message || output || '');
  const m = message.match(/\[stdout\]\n([\s\S]*?)\n\n\[stderr\]\n([\s\S]*)$/);
  return m ? { out: m[1].replace(/\n+$/, ''), err: m[2].replace(/\n+$/, '') } : { out: message, err: '' };
}

async function sendLine(line: string): Promise<TermReply> {
  const s = session.value;
  if (!s) return {};
  const trimmed = line.trim();
  if (trimmed === 'clear') return { clear: true };
  if (trimmed === 'exit' || trimmed === 'logout') return { text: 'logout\nConnection closed.', exit: true };
  if (s.kind === 'serial') {
    const r = await az.api.exec(cli(['az', 'vm', 'run-command', 'invoke'], { '-g': props.res.group, '-n': props.res.name,
                                                                           '--command-id': 'RunShellScript', '--scripts': line }), { quiet: true });
    if (!r.ok) return { text: errorText(r), error: true };
    const { out, err } = runCommandText(r.output);
    return { text: [out, err].filter(Boolean).join('\n'), error: !out && Boolean(err) };
  }
  const command = s.kind === 'bastion'
    ? cli(['az', 'network', 'bastion', 'ssh'], { ...bastionBase(), '--': line })
    : cli(['az', 'ssh', 'vm'], { '-g': props.res.group, '-n': props.res.name, '--local-user': s.user, '--': line });
  const r = await az.api.exec(command, { quiet: true });
  if (r.ok) return { text: String(r.output || '') };
  const text = [String(r.output || '').trim(), String(r.error || '').trim()].filter(Boolean).join('\n');
  return { text: text || errorText(r), error: true };
}

async function deployBastion(sku: 'Developer' | 'Basic') {
  const vnetName = String(p.value.vnet || '');
  const group = props.res.group;
  const name = `${vnetName}-bastion`;
  az.note('progress', `Deploying Bastion '${name}'...`);
  if (sku === 'Basic') {
    const v = vnets.value.find(x => x.name === vnetName);
    if (!(v?.subnets || []).some((s: any) => s.name === 'AzureBastionSubnet')) {
      const r = await az.run(cli(['az', 'network', 'vnet', 'subnet', 'create'], { '-g': group, '--vnet-name': vnetName,
                                  '-n': 'AzureBastionSubnet', '--address-prefixes': bastionPrefix(v) }), '', { quiet: true });
      if (!r.ok) return;
    }
    if (!rows(az.p.value, 'resources').some(r => r.kind === 'publicip' && r.name === `${name}-ip`)) {
      const r = await az.run(cli(['az', 'network', 'public-ip', 'create'], { '-g': group, '-n': `${name}-ip`, '--sku': 'Standard' }), '', { quiet: true });
      if (!r.ok) return;
    }
  }
  await az.run(cli(['az', 'network', 'bastion', 'create'], { '-g': group, '-n': name, '--vnet-name': vnetName,
    '--public-ip-address': sku === 'Basic' ? `${name}-ip` : '', '--sku': sku }), `Deployment succeeded: Bastion '${name}' created`);
}
/** A /26 inside the VNet's space that no subnet uses yet. */
function bastionPrefix(v: Record<string, any> | undefined): string {
  const space = String(v?.address_space || '10.0.0.0/16').split(',')[0].trim();
  const base = space.split('/')[0].split('.').map(Number);
  const used = (v?.subnets || []).map((s: any) => String(s.prefix || ''));
  for (let third = 1; third < 255; third += 1) {
    const candidate = `${base[0]}.${base[1]}.${third}.0`;
    if (!used.some((u: string) => u.startsWith(`${base[0]}.${base[1]}.${third}.`))) return `${candidate}/26`;
  }
  return `${base[0]}.${base[1]}.250.0/26`;
}

// ----- run command -----
const rcRows = computed(() => (windows.value
  ? [{ id: 'RunPowerShellScript', desc: 'Executes a PowerShell script' }, { id: 'IPConfig', desc: 'List IP configuration' }]
  : [{ id: 'RunShellScript', desc: 'Executes a Linux shell script' }, { id: 'ifconfig', desc: 'List network configuration' }]));
const rcCols = [{ key: 'id', label: 'Name' }, { key: 'desc', label: 'Description' }];
const rcOpen = ref('');
const rcScript = ref('');
const rcOutput = ref('');
const rcError = ref('');
const rcRunning = ref(false);
function openRun(id: string) {
  rcOpen.value = id; rcOutput.value = ''; rcError.value = '';
  if (!rcScript.value) rcScript.value = windows.value ? 'hostname\nGet-Service' : 'hostname\nuname -a\ndf -h';
}
async function runScript() {
  rcRunning.value = true; rcOutput.value = ''; rcError.value = '';
  const flags: Record<string, string> = { '-g': props.res.group, '-n': props.res.name, '--command-id': rcOpen.value };
  if (rcOpen.value === 'RunShellScript' || rcOpen.value === 'RunPowerShellScript') flags['--scripts'] = rcScript.value;
  const r = await az.api.exec(cli(['az', 'vm', 'run-command', 'invoke'], flags), { quiet: true });
  rcRunning.value = false;
  if (!r.ok) { rcError.value = errorText(r); return; }
  const doc = parseJson<Record<string, any>>(r.output);
  rcOutput.value = String(doc?.value?.[0]?.message || r.output || '');
}

// ----- boot diagnostics -----
const bootLog = ref('');
const bdSettings = ref(false);
const bdChoice = ref(p.value.boot_diagnostics ? 'on' : 'off');
async function enableBootDiag() {
  await az.run(cli(['az', 'vm', 'boot-diagnostics', 'enable'], { '-g': props.res.group, '-n': props.res.name }),
               `Boot diagnostics enabled for '${props.res.name}'`);
}
async function saveBootDiag() {
  const verb = bdChoice.value === 'on' ? 'enable' : 'disable';
  const r = await az.run(cli(['az', 'vm', 'boot-diagnostics', verb], { '-g': props.res.group, '-n': props.res.name }),
                         `Boot diagnostics ${verb}d for '${props.res.name}'`);
  if (r.ok) bdSettings.value = false;
}
async function loadBootLog() {
  if (!p.value.boot_diagnostics || !running.value) { bootLog.value = ''; return; }
  const r = await az.api.exec(cli(['az', 'vm', 'boot-diagnostics', 'get-boot-log'], { '-g': props.res.group, '-n': props.res.name }),
                              { quiet: true });
  bootLog.value = r.ok ? String(r.output || '') : errorText(r);
}
watch(() => [props.tab, p.value.boot_diagnostics, p.value.power], () => { if (props.tab === 'bootdiag') void loadBootLog(); }, { immediate: true });
// A stopped VM drops every session, as a real one would.
watch(running, on => { if (!on && session.value) { session.value = null; az.api.notify('warning', 'Session closed', `${props.res.name} is no longer running.`); } });
</script>

<style scoped>
.vmc-head { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; max-width: 760px; margin-bottom: 4px; }
.vmc-methods { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.vmc-method { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--az-stroke2); border-radius: 8px;
  background: #fff; box-shadow: var(--az-shadow4); }
.vmc-method header { display: flex; gap: 12px; align-items: flex-start; }
.vmc-method h4 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
.vmc-method p { margin: 0; color: var(--az-fg2); }
.vmc-method .az-btn { align-self: flex-start; margin-top: auto; }
.vmc-req { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.vmc-req.is-ok { color: var(--az-ok); }
.vmc-req.is-bad { color: var(--az-warn); }
.vmc-more { display: flex; flex-wrap: wrap; gap: 8px 24px; }
.vmc-more .az-link { display: inline-flex; align-items: center; gap: 6px; }
.vmc-deploy { max-width: 640px; margin-bottom: 12px; }
.vmc-deploy p { margin: 0 0 12px; }
.vmc-form { max-width: 720px; }
.vmc-check { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; }
.vmc-check.is-ok :deep(svg) { color: var(--az-ok); }
.vmc-check.is-bad :deep(svg) { color: var(--az-danger); }
.vmc-copy { display: flex; gap: 8px; align-items: flex-start; }
.vmc-copy pre { flex: 1 1 auto; margin: 0; }
.vmc-pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.vmc-script { min-height: 160px; font-family: Consolas, 'Cascadia Mono', monospace; }
.vmc-output { min-height: 80px; max-height: 320px; overflow: auto; }
.vmc-bootlog { min-height: 240px; max-height: 480px; overflow: auto; background: #0c0c0c; color: #e6e6e6; }
.vmc-sess { display: flex; flex-direction: column; height: 560px; min-height: 320px;
  border: 1px solid #3b3b3b; border-radius: 6px; overflow: hidden; }
.vmc-sess__bar { flex: none; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px 0 12px;
  background: #1f1f1f; color: #fff; }
.vmc-sess__title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.vmc-sess__sim { padding: 1px 8px; border-radius: 10px; background: #383838; color: #d6d6d6; font-size: 11px; white-space: nowrap; }
.vmc-sess__grow { flex: 1 1 auto; }
.vmc-sess__btn { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; border: 0; border-radius: 4px;
  background: transparent; color: #fff; font: 12px var(--az-font); cursor: pointer; white-space: nowrap; }
.vmc-sess__btn:hover { background: #383838; }
.vmc-sess__btn.is-danger:hover { background: #a4262c; }
.vmc-sess__screen { flex: 1 1 auto; min-height: 0; }
.vmc-sess__foot { margin: 6px 0 0; font-size: 12px; }
@container sl-portal (max-width: 700px) {
  .vmc-head { grid-template-columns: 1fr; }
  .vmc-sess__sim { display: none; }
}
</style>
