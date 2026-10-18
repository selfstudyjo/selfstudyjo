<template>
  <div>
    <!-- ================= Virtual network ================= -->
    <template v-if="res.kind === 'vnet'">
      <template v-if="tab === 'overview'">
        <div class="az-tabs"><button type="button" class="az-tab is-active">Topology</button></div>
        <h3 class="az-section-title">Subnets ({{ subnets.length }})</h3>
        <AzTable :columns="subnetCols" :rows="subnetRows" row-key="name" />
        <h3 class="az-section-title">Peerings ({{ peerings.length }})</h3>
        <AzTable :columns="peerCols" :rows="peerings" row-key="name"><template #empty>No peerings.</template></AzTable>
      </template>
      <template v-else-if="tab === 'address'">
        <p class="az-intro">The virtual network's address space, specified as one CIDR notation address prefix.</p>
        <div class="az-field"><div class="az-field__label">Address space</div>
          <div class="az-field__ctl"><input v-model="space" class="az-input" :class="{ 'is-bad': spaceErr }" />
            <div v-if="spaceErr" class="az-err">{{ spaceErr }}</div>
            <div class="az-help">{{ hostCount(space) }}</div></div></div>
        <button type="button" class="az-btn az-btn--primary" :disabled="Boolean(spaceErr) || space === vnet?.address_space" @click="saveSpace">Save</button>
      </template>
      <template v-else-if="tab === 'subnets'">
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openSubnet(null)"><AzIcon name="plus" /> Subnet</button>
          <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
          <button type="button" class="az-cmd az-cmd--danger" :disabled="!pickedSubnets.length" @click="deleteSubnets"><AzIcon name="trash" /> Delete</button>
        </div>
        <AzTable v-model:selected="pickedSubnets" :columns="subnetCols" :rows="subnetRows" row-key="name" selectable>
          <template #cell-name="{ row }"><button type="button" class="az-link" @click="openSubnet(row)">{{ row.name }}</button></template>
          <template #empty>No subnets.</template>
        </AzTable>
      </template>
      <template v-else-if="tab === 'peerings'">
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openPeering"><AzIcon name="plus" /> Add</button>
          <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
        </div>
        <AzTable :columns="[...peerCols, { key: 'actions', label: '', sortable: false }]" :rows="peerings" row-key="name">
          <template #cell-state="{ row }"><span class="az-status"><AzIcon :name="row.state === 'Connected' ? 'ok' : 'warning'" :size="14" /> {{ row.state }}</span></template>
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="deletePeering(row)">Delete</button></template>
          <template #empty>No results. A peering is two objects, one on each virtual network.</template>
        </AzTable>
      </template>
      <template v-else-if="tab === 'devices'">
        <AzTable :columns="[{ key: 'device', label: 'Device' }, { key: 'type', label: 'Type' }, { key: 'ip', label: 'IP address' }, { key: 'subnet', label: 'Subnet' }]"
                 :rows="devices" row-key="device"><template #empty>No connected devices.</template></AzTable>
      </template>
    </template>

    <!-- ================= Network security group ================= -->
    <template v-else-if="res.kind === 'nsg'">
      <template v-if="['overview', 'inbound', 'outbound'].includes(tab)">
        <div class="az-cmdbar" v-if="tab !== 'overview'">
          <button type="button" class="az-cmd" @click="openRule(null)"><AzIcon name="plus" /> Add</button>
          <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
          <button type="button" class="az-cmd az-cmd--danger" :disabled="!pickedRules.length" @click="deleteRules"><AzIcon name="trash" /> Delete</button>
        </div>
        <template v-for="d in (tab === 'overview' ? ['Inbound', 'Outbound'] : [tab === 'inbound' ? 'Inbound' : 'Outbound'])" :key="d">
          <h3 v-if="tab === 'overview'" class="az-section-title">{{ d }} security rules</h3>
          <AzTable v-model:selected="pickedRules" :columns="ruleCols" :rows="rulesOf(d)" row-key="key" :selectable="tab !== 'overview'">
            <template #cell-name="{ row }">
              <button v-if="!row.isDefault" type="button" class="az-link" @click="openRule(row)">{{ row.name }}</button>
              <span v-else>{{ row.name }}</span></template>
            <template #cell-access="{ row }"><span class="az-status"><AzIcon :name="row.access === 'Allow' ? 'ok' : 'error'" :size="14" /> {{ row.access }}</span></template>
          </AzTable>
        </template>
      </template>
      <template v-else-if="tab === 'nsgsubnets'">
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="Object.assign(assoc, { vnet: '', subnet: '' }); associating = 'nsg'"><AzIcon name="plus" /> Associate</button></div>
        <AzTable :columns="[{ key: 'name', label: 'Name' }, { key: 'vnet', label: 'Virtual network' }, { key: 'prefix', label: 'Address range' }, { key: 'actions', label: '', sortable: false }]"
                 :rows="attachedSubnets('nsg')" row-key="key">
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="dissociate(row, 'nsg')">Dissociate</button></template>
          <template #empty>No subnets are associated with this network security group.</template>
        </AzTable>
      </template>
      <template v-else-if="tab === 'nics'">
        <AzTable :columns="[{ key: 'name', label: 'Name' }, { key: 'vm', label: 'Attached to' }]"
                 :rows="(nsg?.interfaces || []).map((vm: string) => ({ name: vm + 'VMNic', vm }))" row-key="name">
          <template #empty>No network interfaces are associated with this network security group.</template></AzTable>
      </template>
      <template v-else-if="tab === 'effective'">
        <p class="az-intro">Effective security rules for a subnet: your rules plus the platform defaults underneath, in priority order.</p>
        <div class="az-filters">
          <select v-model="eff" class="az-filter"><option value="">Select a subnet</option>
            <option v-for="s in attachedSubnets('nsg')" :key="s.key" :value="s.key">{{ s.key }}</option></select>
          <button type="button" class="az-btn" :disabled="!eff" @click="effective">Show</button>
        </div>
        <pre v-if="effOut" class="az-code">{{ effOut }}</pre>
      </template>
    </template>

    <!-- ================= Public IP ================= -->
    <template v-else-if="res.kind === 'publicip'">
      <template v-if="tab === 'ipconfig'">
        <div class="az-field"><div class="az-field__label">IP address</div><div class="az-field__ctl">{{ p.address }} ({{ p.allocation || 'Static' }})</div></div>
        <div class="az-field"><div class="az-field__label">DNS name label (optional)</div>
          <div class="az-field__ctl"><input v-model="dns" class="az-input" />
            <div class="az-help">.{{ res.location }}.cloudapp.azure.com</div></div></div>
        <button type="button" class="az-btn az-btn--primary" :disabled="dns === (p.dns_label || '')" @click="saveDns">Save</button>
      </template>
    </template>

    <!-- ================= Route table ================= -->
    <template v-else-if="res.kind === 'routetable'">
      <template v-if="tab === 'overview' || tab === 'routes'">
        <div v-if="tab === 'routes'" class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openRoute"><AzIcon name="plus" /> Add</button>
          <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
        </div>
        <h3 v-else class="az-section-title">Routes</h3>
        <AzTable :columns="routeCols" :rows="routeRows" row-key="name">
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="deleteRoute(row)">Delete</button></template>
          <template #empty>No routes. A subnet with this table uses the system routes only.</template>
        </AzTable>
        <div v-if="table && !table.subnets.length" class="az-banner is-warning" style="margin-top: 10px"><AzIcon name="warning" />
          <span>This route table is not associated with any subnet, so none of its routes are in effect.</span></div>
      </template>
      <template v-else-if="tab === 'rtsubnets'">
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="Object.assign(assoc, { vnet: '', subnet: '' }); associating = 'route_table'"><AzIcon name="plus" /> Associate</button></div>
        <AzTable :columns="[{ key: 'name', label: 'Name' }, { key: 'vnet', label: 'Virtual network' }, { key: 'prefix', label: 'Address range' }, { key: 'actions', label: '', sortable: false }]"
                 :rows="attachedSubnets('route_table')" row-key="key">
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="dissociate(row, 'route_table')">Dissociate</button></template>
          <template #empty>No subnets are associated with this route table.</template>
        </AzTable>
      </template>
      <template v-else-if="tab === 'rtconfig'">
        <div class="az-field"><div class="az-field__label">Propagate gateway routes</div>
          <div class="az-radios"><label class="az-radio"><input v-model="bgp" type="radio" value="yes" /> Yes</label>
            <label class="az-radio"><input v-model="bgp" type="radio" value="no" /> No</label></div></div>
        <button type="button" class="az-btn az-btn--primary" @click="saveBgp">Save</button>
      </template>
    </template>

    <!-- ================= Private DNS zone ================= -->
    <template v-else-if="res.kind === 'privatednszone'">
      <template v-if="tab === 'overview' || tab === 'records'">
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openRecord"><AzIcon name="plus" /> Record set</button>
          <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
        </div>
        <AzTable :columns="[{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'ttl', label: 'TTL' }, { key: 'value', label: 'Value' }, { key: 'actions', label: '', sortable: false }]"
                 :rows="(zone?.records || []).map((r: any) => ({ ...r, actions: '' }))" row-key="name">
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="deleteRecord(row)">Delete</button></template>
          <template #empty>No record sets.</template>
        </AzTable>
      </template>
      <template v-else-if="tab === 'links'">
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="openLink"><AzIcon name="plus" /> Add</button></div>
        <AzTable :columns="[{ key: 'name', label: 'Link name' }, { key: 'vnet', label: 'Virtual network' }, { key: 'reg', label: 'Auto-registration' }, { key: 'status', label: 'Link status' }, { key: 'actions', label: '', sortable: false }]"
                 :rows="(zone?.links || []).map((l: any) => ({ ...l, reg: l.registration ? 'Enabled' : 'Disabled', status: 'Completed', actions: '' }))" row-key="name">
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="deleteLink(row)">Delete</button></template>
          <template #empty>No virtual network links. A zone that is not linked to a network is never consulted by it.</template>
        </AzTable>
      </template>
    </template>

    <!-- ================= Private endpoint ================= -->
    <template v-else-if="res.kind === 'privateendpoint'">
      <template v-if="tab === 'overview' || tab === 'dnsconfig'">
        <div v-if="pe" class="az-ess__grid">
          <div class="az-ess__row"><span class="az-ess__k">FQDN</span><span class="az-ess__v">{{ pe.fqdn }}</span></div>
          <div class="az-ess__row"><span class="az-ess__k">IP address</span><span class="az-ess__v">{{ pe.privateIpAddress }}</span></div>
          <div class="az-ess__row"><span class="az-ess__k">Subnet</span><span class="az-ess__v">{{ pe.subnet }}</span></div>
          <div class="az-ess__row"><span class="az-ess__k">Private DNS zone group</span><span class="az-ess__v">{{ pe.privateDnsZoneGroup || 'None' }}</span></div>
        </div>
        <div v-if="pe && !pe.privateDnsZoneGroup" class="az-banner is-warning"><AzIcon name="warning" />
          <span>No DNS configuration: {{ pe.fqdn }} still resolves to its public address. The required zone is <b>{{ pe.requiredZone }}</b>.</span></div>
        <button v-if="tab === 'dnsconfig'" type="button" class="az-btn az-btn--primary" @click="openZoneGroup">Add configuration</button>
      </template>
      <template v-else-if="tab === 'pelink'">
        <div class="az-kv"><span>Target resource</span><span>{{ pe?.target }} ({{ pe?.groupId }})</span></div>
        <div class="az-kv"><span>Connection status</span><span>{{ pe?.connectionState }}</span></div>
        <button v-if="pe && pe.connectionState !== 'Approved'" type="button" class="az-btn az-btn--primary" style="margin-top: 10px" @click="approve">Approve</button>
      </template>
    </template>

    <!-- ================= Firewall ================= -->
    <template v-else-if="res.kind === 'firewall'">
      <template v-if="tab === 'overview' || tab === 'fwrules'">
        <div class="az-tabs">
          <button type="button" class="az-tab" :class="{ 'is-active': fwKind === 'network-rule' }" @click="fwKind = 'network-rule'">Network rule collection</button>
          <button type="button" class="az-tab" :class="{ 'is-active': fwKind === 'application-rule' }" @click="fwKind = 'application-rule'">Application rule collection</button>
        </div>
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="openFwRule"><AzIcon name="plus" /> Add rule</button></div>
        <AzTable :columns="fwCols" :rows="fwRows" row-key="key"><template #empty>No rules. With no rules a firewall denies everything that is routed to it.</template></AzTable>
      </template>
    </template>

    <template v-else-if="tab === 'overview'">
      <p class="az-muted">This {{ res.kind }} has no further settings in this lab.</p>
    </template>

    <!-- ================= panes ================= -->
    <AzPane v-if="subnetPane" :title="editingSubnet ? editingSubnet.name : 'Add a subnet'" :subtitle="res.name" :error="paneError" @close="subnetPane = false">
      <div class="az-field"><div class="az-field__label">Subnet purpose</div>
        <div class="az-field__ctl"><select v-model="sForm.purpose" class="az-select" :disabled="Boolean(editingSubnet)" @change="purpose">
          <option value="Default">Default</option><option value="AzureFirewallSubnet">Azure Firewall</option>
          <option value="GatewaySubnet">Virtual Network Gateway</option><option value="AzureBastionSubnet">Azure Bastion</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="sForm.name" class="az-input" :disabled="Boolean(editingSubnet) || sForm.purpose !== 'Default'" /></div></div>
      <div class="az-field"><div class="az-field__label">Starting address / size <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="sForm.prefix" class="az-input" :disabled="Boolean(editingSubnet)" placeholder="10.0.1.0/24" />
          <div class="az-help">{{ hostCount(sForm.prefix) }} · inside {{ vnet?.address_space }}</div></div></div>
      <h3 class="az-group-title">Security</h3>
      <div class="az-field"><div class="az-field__label">Network security group</div>
        <div class="az-field__ctl"><select v-model="sForm.nsg" class="az-select"><option value="">None</option>
          <option v-for="n in nsgNames" :key="n" :value="n">{{ n }}</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Route table</div>
        <div class="az-field__ctl"><select v-model="sForm.rt" class="az-select"><option value="">None</option>
          <option v-for="n in rtNames" :key="n" :value="n">{{ n }}</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Service endpoints</div>
        <div class="az-field__ctl"><input v-model="sForm.endpoints" class="az-input" placeholder="Microsoft.Storage, Microsoft.Sql" /></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!sForm.name || !sForm.prefix" @click="saveSubnet">{{ editingSubnet ? 'Save' : 'Add' }}</button>
        <button type="button" class="az-btn" @click="subnetPane = false">Cancel</button>
      </template>
    </AzPane>

    <AzPane v-if="peerPane" title="Add peering" :subtitle="res.name" :error="paneError" @close="peerPane = false">
      <h3 class="az-group-title">Remote virtual network summary</h3>
      <div class="az-field"><div class="az-field__label">Peering link name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="pForm.remoteName" class="az-input" placeholder="spoke-to-hub" /></div></div>
      <div class="az-field"><div class="az-field__label">Virtual network <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="pForm.remote" class="az-select"><option value="">Select a virtual network</option>
          <option v-for="n in otherVnets" :key="n" :value="n">{{ n }}</option></select></div></div>
      <label class="az-check"><input v-model="pForm.remoteForwarded" type="checkbox" /> Allow '{{ pForm.remote || 'remote' }}' to receive forwarded traffic from '{{ res.name }}'</label><br />
      <label class="az-check"><input v-model="pForm.remoteGw" type="checkbox" /> Allow gateway or route server in '{{ pForm.remote || 'remote' }}' to forward traffic to '{{ res.name }}'</label>
      <h3 class="az-group-title">Local virtual network summary</h3>
      <div class="az-field"><div class="az-field__label">Peering link name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="pForm.name" class="az-input" placeholder="hub-to-spoke" /></div></div>
      <label class="az-check"><input v-model="pForm.forwarded" type="checkbox" /> Allow '{{ res.name }}' to receive forwarded traffic from '{{ pForm.remote || 'remote' }}'</label><br />
      <label class="az-check"><input v-model="pForm.transit" type="checkbox" /> Allow gateway or route server in '{{ res.name }}' to forward traffic to '{{ pForm.remote || 'remote' }}'</label><br />
      <label class="az-check"><input v-model="pForm.useRemote" type="checkbox" /> Enable '{{ res.name }}' to use '{{ pForm.remote || 'remote' }}'s' remote gateway or route server</label>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!pForm.remote || !pForm.name" @click="savePeering">Add</button>
        <button type="button" class="az-btn" @click="peerPane = false">Cancel</button>
      </template>
    </AzPane>

    <AzRulePane v-if="rulePane && nsg" :nsg="nsg.name" :group="nsg.group" :direction="ruleDirection" :existing="editingRule"
                :taken="(nsg.rules || []).map((r: any) => Number(r.priority))" @close="rulePane = false" />

    <AzPane v-if="associating" title="Associate subnet" :subtitle="res.name" :error="paneError" @close="associating = ''">
      <div class="az-field"><div class="az-field__label">Virtual network <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="assoc.vnet" class="az-select"><option value="">Select</option>
          <option v-for="v in vnetNames" :key="v" :value="v">{{ v }}</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Subnet <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="assoc.subnet" class="az-select"><option value="">Select</option>
          <option v-for="s in subnetsOf(assoc.vnet)" :key="s" :value="s">{{ s }}</option></select></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!assoc.vnet || !assoc.subnet" @click="associate">OK</button>
        <button type="button" class="az-btn" @click="associating = ''">Cancel</button>
      </template>
    </AzPane>

    <AzPane v-if="routePane" title="Add route" :subtitle="res.name" :error="paneError" @close="routePane = false">
      <div class="az-field"><div class="az-field__label">Route name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="rForm.name" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Destination IP addresses/CIDR ranges <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="rForm.prefix" class="az-input" placeholder="0.0.0.0/0" /></div></div>
      <div class="az-field"><div class="az-field__label">Next hop type <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="rForm.hop" class="az-select">
          <option v-for="h in hops" :key="h" :value="h">{{ hopLabel(h) }}</option></select></div></div>
      <div v-if="rForm.hop === 'VirtualAppliance'" class="az-field"><div class="az-field__label">Next hop address <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="rForm.ip" class="az-input" placeholder="10.0.1.4" />
          <div class="az-help">The private IP of the firewall or network virtual appliance.</div></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!rForm.name || !rForm.prefix" @click="saveRoute">Add</button>
        <button type="button" class="az-btn" @click="routePane = false">Cancel</button>
      </template>
    </AzPane>

    <AzPane v-if="recordPane" title="Add record set" :subtitle="res.name" :error="paneError" @close="recordPane = false">
      <div class="az-field"><div class="az-field__label">Name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="recForm.name" class="az-input" /><div class="az-help">.{{ res.name }}</div></div></div>
      <div class="az-field"><div class="az-field__label">Type</div><div class="az-field__ctl">A - Address record</div></div>
      <div class="az-field"><div class="az-field__label">IP address <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="recForm.ip" class="az-input" placeholder="10.1.2.5" /></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!recForm.name || !recForm.ip" @click="saveRecord">OK</button>
        <button type="button" class="az-btn" @click="recordPane = false">Cancel</button>
      </template>
    </AzPane>

    <AzPane v-if="linkPane" title="Add virtual network link" :subtitle="res.name" :error="paneError" @close="linkPane = false">
      <div class="az-field"><div class="az-field__label">Link name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="lForm.name" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Virtual network <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="lForm.vnet" class="az-select"><option value="">Select</option>
          <option v-for="v in vnetNames" :key="v" :value="v">{{ v }}</option></select></div></div>
      <label class="az-check"><input v-model="lForm.reg" type="checkbox" /> Enable auto registration</label>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!lForm.name || !lForm.vnet" @click="saveLink">OK</button>
        <button type="button" class="az-btn" @click="linkPane = false">Cancel</button>
      </template>
    </AzPane>

    <AzPane v-if="zgPane" title="Add DNS configuration" :subtitle="res.name" :error="paneError" @close="zgPane = false">
      <div class="az-field"><div class="az-field__label">Private DNS zone <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="zgZone" class="az-select"><option value="">Select</option>
          <option v-for="z in zoneNames" :key="z" :value="z">{{ z }}</option></select>
          <div class="az-help">Required for this endpoint: {{ pe?.requiredZone }}</div></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!zgZone" @click="saveZoneGroup">Add</button>
        <button type="button" class="az-btn" @click="zgPane = false">Cancel</button>
      </template>
    </AzPane>

    <AzPane v-if="fwPane" :title="fwKind === 'network-rule' ? 'Add network rule' : 'Add application rule'" :subtitle="res.name" :error="paneError" @close="fwPane = false">
      <div class="az-field"><div class="az-field__label">Rule collection name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="fwForm.collection" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Priority <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="fwForm.priority" class="az-input" type="number" /></div></div>
      <div class="az-field"><div class="az-field__label">Action</div>
        <div class="az-radios"><label class="az-radio"><input v-model="fwForm.action" type="radio" value="Allow" /> Allow</label>
          <label class="az-radio"><input v-model="fwForm.action" type="radio" value="Deny" /> Deny</label></div></div>
      <div class="az-field"><div class="az-field__label">Rule name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="fwForm.name" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Source addresses</div>
        <div class="az-field__ctl"><input v-model="fwForm.sources" class="az-input" placeholder="10.1.0.0/16" /></div></div>
      <template v-if="fwKind === 'network-rule'">
        <div class="az-field"><div class="az-field__label">Protocol</div>
          <div class="az-field__ctl"><select v-model="fwForm.protocol" class="az-select">
            <option>TCP</option><option>UDP</option><option>ICMP</option><option value="Any">Any</option></select></div></div>
        <div class="az-field"><div class="az-field__label">Destination addresses</div>
          <div class="az-field__ctl"><input v-model="fwForm.dests" class="az-input" placeholder="*" /></div></div>
        <div class="az-field"><div class="az-field__label">Destination ports <span class="az-req">*</span></div>
          <div class="az-field__ctl"><input v-model="fwForm.ports" class="az-input" placeholder="443" /></div></div>
      </template>
      <div v-else class="az-field"><div class="az-field__label">Target FQDNs <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="fwForm.fqdns" class="az-input" placeholder="*.github.com, api.example.com" /></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!fwForm.name || !fwForm.collection" @click="saveFwRule">Add</button>
        <button type="button" class="az-btn" @click="fwPane = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** Networking resources: VNet, NSG, public IP, route table, private DNS zone, private endpoint, firewall. */
import { computed, reactive, ref } from 'vue';
import { cli, errorText, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import AzRulePane from './AzRulePane.vue';
import { useAz } from './azure';

const props = defineProps<{ res: Record<string, any>; tab: string }>();
defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
function any(v: unknown) { return v === '*' || v === undefined || v === '' ? 'Any' : String(v); }
const p = computed(() => props.res.props || {});
const g = computed(() => String(props.res.group));
const paneError = ref('');

async function act(command: string, success: string, close?: () => void) {
  paneError.value = '';
  const result = await az.run(command, success, { quiet: true });
  if (!result.ok) { paneError.value = errorText(result); return false; }
  if (close) close();
  return true;
}

function hostCount(cidr: string) {
  const m = String(cidr || '').match(/^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/);
  if (!m) return '';
  const bits = 32 - Number(m[2]);
  const total = 2 ** bits;
  return `${total.toLocaleString()} addresses (${Math.max(0, total - 5).toLocaleString()} usable; Azure reserves 5)`;
}

// ---------- VNet ----------
const vnets = computed(() => rows(az.p.value, 'vnets'));
const vnet = computed(() => vnets.value.find(v => v.name === props.res.name) || null);
const subnets = computed<Record<string, any>[]>(() => vnet.value?.subnets || []);
const subnetRows = computed(() => subnets.value.map((s): Record<string, any> => ({ ...s, range: s.prefix, available: hostCount(s.prefix).split(' (')[0],
  nsgName: s.nsg || '-', rtName: s.route_table || '-', ep: (s.service_endpoints || []).join(', ') || '-' })));
const subnetCols = [{ key: 'name', label: 'Name' }, { key: 'range', label: 'IPv4' }, { key: 'available', label: 'Available IPs' },
                    { key: 'nsgName', label: 'Security group' }, { key: 'rtName', label: 'Route table' },
                    { key: 'ep', label: 'Service endpoints' }];
const peerings = computed(() => (vnet.value?.peerings || []).map((x: any) => ({ ...x,
  fwd: x.allow_forwarded ? 'Allowed' : 'Disabled', gw: x.allow_gateway_transit ? 'Enabled' : 'Disabled',
  useGw: x.use_remote_gateways ? 'Enabled' : 'Disabled', actions: '' })));
const peerCols = [{ key: 'name', label: 'Name' }, { key: 'state', label: 'Peering status' },
                  { key: 'remote', label: 'Remote virtual network' }, { key: 'fwd', label: 'Forwarded traffic' },
                  { key: 'gw', label: 'Gateway transit' }, { key: 'useGw', label: 'Remote gateway' }];
const devices = computed(() => rows(az.p.value, 'resources').filter(r => r.kind === 'vm' && r.props?.vnet === props.res.name)
  .map(r => ({ device: `${r.name}VMNic`, type: 'Network interface', ip: r.props?.private_ip, subnet: r.props?.subnet })));
const space = ref(String(vnet.value?.address_space || ''));
const spaceErr = computed(() => (/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(space.value) ? '' : 'Invalid address prefix.'));
async function saveSpace() {
  await act(cli(['az', 'network', 'vnet', 'update'], { '-g': g.value, '-n': props.res.name, '--address-prefixes': space.value }),
            `Updated address space of '${props.res.name}'`);
}
const nsgNames = computed(() => rows(az.p.value, 'resources').filter(r => r.kind === 'nsg').map(r => String(r.name)));
const rtNames = computed(() => rows(az.p.value, 'route_tables').map(r => String(r.name)));
const subnetPane = ref(false);
const editingSubnet = ref<Record<string, any> | null>(null);
const pickedSubnets = ref<string[]>([]);
const sForm = reactive({ purpose: 'Default', name: '', prefix: '', nsg: '', rt: '', endpoints: '' });
function openSubnet(row: Record<string, any> | null) {
  editingSubnet.value = row;
  paneError.value = '';
  Object.assign(sForm, row ? { purpose: 'Default', name: row.name, prefix: row.prefix, nsg: row.nsg || '', rt: row.route_table || '',
                               endpoints: (row.service_endpoints || []).join(', ') }
    : { purpose: 'Default', name: 'default', prefix: '', nsg: '', rt: '', endpoints: '' });
  subnetPane.value = true;
}
function purpose() { if (sForm.purpose !== 'Default') sForm.name = sForm.purpose; }
async function saveSubnet() {
  const ep = sForm.endpoints.split(/[\s,]+/).filter(Boolean);
  if (editingSubnet.value) {
    const base: string[] = ['az', 'network', 'vnet', 'subnet', 'update'];
    if (!sForm.nsg && editingSubnet.value.nsg) base.push('--nsg', '');
    if (!sForm.rt && editingSubnet.value.route_table) base.push('--route-table', '');
    await act(cli(base, { '-g': g.value, '--vnet-name': props.res.name, '-n': sForm.name, '--nsg': sForm.nsg,
                          '--route-table': sForm.rt, '--service-endpoints': ep.join(' ') }),
              `Updated subnet '${sForm.name}'`, () => { subnetPane.value = false; });
    return;
  }
  await act(cli(['az', 'network', 'vnet', 'subnet', 'create'], { '-g': g.value, '--vnet-name': props.res.name, '-n': sForm.name,
    '--address-prefixes': sForm.prefix, '--nsg': sForm.nsg, '--route-table': sForm.rt, '--service-endpoints': ep.join(' ') }),
            `Successfully added subnet '${sForm.name}'`, () => { subnetPane.value = false; });
}
async function deleteSubnets() {
  const items = [...pickedSubnets.value];
  if (!(await az.confirm({ title: 'Delete subnet', message: 'Do you want to delete the selected subnet(s)?', items, confirmLabel: 'Yes', danger: true }))) return;
  for (const name of items) {
    await az.run(cli(['az', 'network', 'vnet', 'subnet', 'delete'], { '-g': g.value, '--vnet-name': props.res.name, '-n': name }),
                 `Deleted subnet '${name}'`);
  }
  pickedSubnets.value = [];
}
const otherVnets = computed(() => vnets.value.map(v => String(v.name)).filter(n => n !== props.res.name));
const peerPane = ref(false);
const pForm = reactive({ name: '', remoteName: '', remote: '', forwarded: true, transit: false, useRemote: false,
                         remoteForwarded: true, remoteGw: false });
function openPeering() {
  Object.assign(pForm, { name: '', remoteName: '', remote: '', forwarded: true, transit: false, useRemote: false,
                         remoteForwarded: true, remoteGw: false });
  paneError.value = '';
  peerPane.value = true;
}
async function savePeering() {
  const ok = await act(cli(['az', 'network', 'vnet', 'peering', 'create'], { '-g': g.value, '-n': pForm.name,
    '--vnet-name': props.res.name, '--remote-vnet': pForm.remote, '--allow-vnet-access': 'true',
    '--allow-forwarded-traffic': String(pForm.forwarded), '--allow-gateway-transit': String(pForm.transit),
    '--use-remote-gateways': String(pForm.useRemote) }), `Added peering '${pForm.name}'`);
  if (!ok) return;
  if (pForm.remoteName) {
    const remote = vnets.value.find(v => v.name === pForm.remote);
    const ok2 = await act(cli(['az', 'network', 'vnet', 'peering', 'create'], { '-g': remote?.group || g.value, '-n': pForm.remoteName,
      '--vnet-name': pForm.remote, '--remote-vnet': props.res.name, '--allow-vnet-access': 'true',
      '--allow-forwarded-traffic': String(pForm.remoteForwarded), '--allow-gateway-transit': String(pForm.remoteGw) }),
                          `Added peering '${pForm.remoteName}'`);
    if (!ok2) return;
  }
  peerPane.value = false;
}
async function deletePeering(row: Record<string, any>) {
  if (!(await az.confirm({ title: 'Delete peering', message: `Do you want to delete peering '${row.name}'? Traffic between the networks stops.`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'network', 'vnet', 'peering', 'delete'], { '-g': g.value, '--vnet-name': props.res.name, '-n': row.name }),
               `Deleted peering '${row.name}'`);
}

// ---------- NSG ----------
const nsg = computed(() => rows(az.p.value, 'nsgs').find(n => n.name === props.res.name) || null);
const ruleCols = [{ key: 'priority', label: 'Priority' }, { key: 'name', label: 'Name' }, { key: 'port', label: 'Port' },
                  { key: 'protocol', label: 'Protocol' }, { key: 'source', label: 'Source' },
                  { key: 'destination', label: 'Destination' }, { key: 'access', label: 'Action' }];
function rulesOf(direction: string) {
  const n = nsg.value;
  if (!n) return [];
  return [...(n.rules || []), ...(n.defaults || [])].filter((r: any) => r.direction === direction)
    .map((r: any) => ({ ...r, key: `${r.direction}|${r.name}`, port: any(r.destinationPortRange), source: any(r.sourceAddressPrefix),
                        destination: any(r.destinationAddressPrefix), protocol: any(r.protocol) }))
    .sort((a: any, b: any) => Number(a.priority) - Number(b.priority));
}
const pickedRules = ref<string[]>([]);
const rulePane = ref(false);
const editingRule = ref<Record<string, any> | null>(null);
const ruleDirection = computed<'Inbound' | 'Outbound'>(() => (editingRule.value?.direction
  || (props.tab === 'outbound' ? 'Outbound' : 'Inbound')) as 'Inbound' | 'Outbound');
function openRule(row: Record<string, any> | null) { editingRule.value = row; rulePane.value = true; }
async function deleteRules() {
  const items = pickedRules.value.map(k => k.split('|')[1]);
  const defaults = items.filter(n => (nsg.value?.defaults || []).some((d: any) => d.name === n));
  if (defaults.length) { az.note('error', 'Default security rules cannot be deleted', defaults.join(', ')); return; }
  if (!(await az.confirm({ title: 'Delete security rules', message: 'Do you want to delete the selected security rules?', items, confirmLabel: 'Yes', danger: true }))) return;
  for (const name of items) {
    await az.run(cli(['az', 'network', 'nsg', 'rule', 'delete'], { '-g': g.value, '--nsg-name': props.res.name, '-n': name }),
                 `Deleted security rule '${name}'`);
  }
  pickedRules.value = [];
}
function attachedSubnets(key: 'nsg' | 'route_table') {
  const out: Record<string, any>[] = [];
  for (const v of vnets.value) {
    for (const s of v.subnets || []) {
      if (s[key] === props.res.name) out.push({ key: `${v.name}/${s.name}`, name: s.name, vnet: v.name, vnetGroup: v.group, prefix: s.prefix, actions: '' });
    }
  }
  return out;
}
const vnetNames = computed(() => vnets.value.map(v => String(v.name)));
function subnetsOf(name: string) { return (vnets.value.find(v => v.name === name)?.subnets || []).map((s: any) => String(s.name)); }
const associating = ref<'' | 'nsg' | 'route_table'>('');
const assoc = reactive({ vnet: '', subnet: '' });
async function associate() {
  const v = vnets.value.find(x => x.name === assoc.vnet);
  const flag = associating.value === 'nsg' ? '--nsg' : '--route-table';
  await act(cli(['az', 'network', 'vnet', 'subnet', 'update'], { '-g': v?.group || g.value, '--vnet-name': assoc.vnet,
                                                                '-n': assoc.subnet, [flag]: props.res.name }),
            `Associated subnet '${assoc.subnet}' with '${props.res.name}'`, () => { associating.value = ''; });
}
async function dissociate(row: Record<string, any>, key: 'nsg' | 'route_table') {
  if (!(await az.confirm({ title: 'Dissociate', message: `Dissociate subnet '${row.key}' from '${props.res.name}'?`, confirmLabel: 'Yes' }))) return;
  await az.run(cli(['az', 'network', 'vnet', 'subnet', 'update', key === 'nsg' ? '--nsg' : '--route-table', ''],
                   { '-g': row.vnetGroup, '--vnet-name': row.vnet, '-n': row.name }), `Dissociated subnet '${row.key}'`);
}
const eff = ref('');
const effOut = ref('');
async function effective() {
  const [v, s] = eff.value.split('/');
  const result = await az.run(cli(['az', 'network', 'watcher', 'show-effective-rules'], { '--vnet': v, '--subnet': s }), '', { quiet: true });
  effOut.value = String(result.ok ? result.output : result.error || '').trim();
}

// ---------- public IP ----------
const dns = ref(String(p.value.dns_label || ''));
async function saveDns() {
  await act(cli(['az', 'network', 'public-ip', 'update'], { '-g': g.value, '-n': props.res.name, '--dns-name': dns.value }),
            `Updated DNS name label of '${props.res.name}'`);
}

// ---------- route table ----------
const table = computed(() => rows(az.p.value, 'route_tables').find(t => t.name === props.res.name) || null);
const routeRows = computed(() => (table.value?.routes || []).map((r: any) => ({ name: r.name, prefix: r.prefix,
  hop: hopLabel(r.next_hop_type), ip: r.next_hop_ip || '-', actions: '' })));
const routeCols = [{ key: 'name', label: 'Name' }, { key: 'prefix', label: 'Address prefix' },
                   { key: 'hop', label: 'Next hop type' }, { key: 'ip', label: 'Next hop IP address' },
                   { key: 'actions', label: '', sortable: false }];
const hops = computed<string[]>(() => az.p.value.catalogue?.next_hops || ['VirtualAppliance', 'Internet', 'None']);
function hopLabel(h: string) {
  return ({ VirtualAppliance: 'Virtual appliance', VirtualNetworkGateway: 'Virtual network gateway', VnetLocal: 'Virtual network',
            Internet: 'Internet', None: 'None', VnetPeering: 'Virtual network peering' } as Record<string, string>)[h] || h;
}
const routePane = ref(false);
const rForm = reactive({ name: '', prefix: '', hop: 'VirtualAppliance', ip: '' });
function openRoute() {
  const fw = rows(az.p.value, 'firewalls')[0];
  Object.assign(rForm, { name: 'to-firewall', prefix: '0.0.0.0/0', hop: 'VirtualAppliance', ip: fw?.private_ip || '' });
  paneError.value = '';
  routePane.value = true;
}
async function saveRoute() {
  await act(cli(['az', 'network', 'route-table', 'route', 'create'], { '-g': g.value, '--route-table-name': props.res.name,
    '-n': rForm.name, '--address-prefix': rForm.prefix, '--next-hop-type': rForm.hop,
    '--next-hop-ip-address': rForm.hop === 'VirtualAppliance' ? rForm.ip : '' }),
            `Added route '${rForm.name}'`, () => { routePane.value = false; });
}
async function deleteRoute(row: Record<string, any>) {
  if (!(await az.confirm({ title: 'Delete route', message: `Delete route '${row.name}'?`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'network', 'route-table', 'route', 'delete'], { '-g': g.value, '--route-table-name': props.res.name, '-n': row.name }),
               `Deleted route '${row.name}'`);
}
const bgp = ref(table.value?.disable_bgp ? 'no' : 'yes');
async function saveBgp() {
  await act(cli(['az', 'network', 'route-table', 'update'], { '-g': g.value, '-n': props.res.name,
    '--disable-bgp-route-propagation': bgp.value === 'no' ? 'true' : 'false' }), `Updated route table '${props.res.name}'`);
}

// ---------- private DNS zone ----------
const zone = computed(() => rows(az.p.value, 'dns_zones').find(z => z.name === props.res.name) || null);
const recordPane = ref(false);
const recForm = reactive({ name: '', ip: '' });
function openRecord() { Object.assign(recForm, { name: '', ip: '' }); paneError.value = ''; recordPane.value = true; }
async function saveRecord() {
  await act(cli(['az', 'network', 'private-dns', 'record-set', 'a', 'add-record'], { '-g': g.value, '--zone-name': props.res.name,
    '--record-set-name': recForm.name, '--ipv4-address': recForm.ip }), `Added record set '${recForm.name}'`,
            () => { recordPane.value = false; });
}
async function deleteRecord(row: Record<string, any>) {
  if (!(await az.confirm({ title: 'Delete record set', message: `Delete '${row.name}'?`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'network', 'private-dns', 'record-set', String(row.type || 'A').toLowerCase(), 'delete'],
                   { '-g': g.value, '--zone-name': props.res.name, '-n': row.name, '--yes': true }), `Deleted record set '${row.name}'`);
}
const linkPane = ref(false);
const lForm = reactive({ name: '', vnet: '', reg: false });
function openLink() { Object.assign(lForm, { name: '', vnet: '', reg: false }); paneError.value = ''; linkPane.value = true; }
async function saveLink() {
  await act(cli(['az', 'network', 'private-dns', 'link', 'vnet', 'create'], { '-g': g.value, '--zone-name': props.res.name,
    '-n': lForm.name, '--virtual-network': lForm.vnet, '--registration-enabled': String(lForm.reg) }),
            `Added virtual network link '${lForm.name}'`, () => { linkPane.value = false; });
}
async function deleteLink(row: Record<string, any>) {
  if (!(await az.confirm({ title: 'Delete virtual network link', message: `Delete '${row.name}'? Clients in ${row.vnet} will resolve this zone's names through public DNS.`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'network', 'private-dns', 'link', 'vnet', 'delete'], { '-g': g.value, '--zone-name': props.res.name, '-n': row.name, '--yes': true }),
               `Deleted virtual network link '${row.name}'`);
}

// ---------- private endpoint ----------
const pe = computed(() => rows(az.p.value, 'private_endpoints').find(e => e.name === props.res.name) || null);
const zoneNames = computed(() => rows(az.p.value, 'dns_zones').map(z => String(z.name)));
const zgPane = ref(false);
const zgZone = ref('');
function openZoneGroup() { zgZone.value = zoneNames.value.find(z => z === pe.value?.requiredZone) || ''; paneError.value = ''; zgPane.value = true; }
async function saveZoneGroup() {
  await act(cli(['az', 'network', 'private-endpoint', 'dns-zone-group', 'create'], { '-g': g.value, '--endpoint-name': props.res.name,
    '-n': 'default', '--private-dns-zone': zgZone.value }), 'Added DNS configuration', () => { zgPane.value = false; });
}
async function approve() {
  await az.run(cli(['az', 'network', 'private-endpoint', 'approve'], { '-g': g.value, '-n': props.res.name }), 'Approved private endpoint connection');
}

// ---------- firewall ----------
const fw = computed(() => rows(az.p.value, 'firewalls').find(f => f.name === props.res.name) || null);
const fwKind = ref<'network-rule' | 'application-rule'>('network-rule');
const fwRows = computed(() => {
  const list = (fwKind.value === 'network-rule' ? fw.value?.network_rules : fw.value?.application_rules) || [];
  return list.map((r: any, i: number) => ({ key: String(i), collection: r.collection, priority: r.priority, action: r.action,
    name: r.name, protocol: r.protocol, sources: (r.source_addresses || []).join(', '),
    target: (r.destination_addresses || r.target_fqdns || []).join(', '), ports: r.ports }));
});
const fwCols = [{ key: 'collection', label: 'Collection' }, { key: 'priority', label: 'Priority' }, { key: 'action', label: 'Action' },
                { key: 'name', label: 'Rule' }, { key: 'protocol', label: 'Protocol' }, { key: 'sources', label: 'Source' },
                { key: 'target', label: 'Destination' }, { key: 'ports', label: 'Ports' }];
const fwPane = ref(false);
const fwForm = reactive({ collection: '', priority: '200', action: 'Allow', name: '', sources: '*', protocol: 'TCP', dests: '*', ports: '443', fqdns: '' });
function openFwRule() {
  Object.assign(fwForm, { collection: fwKind.value === 'network-rule' ? 'net-allow' : 'app-allow', priority: '200', action: 'Allow',
                          name: '', sources: '*', protocol: 'TCP', dests: '*', ports: '443', fqdns: '' });
  paneError.value = '';
  fwPane.value = true;
}
async function saveFwRule() {
  const split = (s: string) => s.split(/[\s,]+/).filter(Boolean);
  const flags: Record<string, any> = { '-g': g.value, '--firewall-name': props.res.name, '--collection-name': fwForm.collection,
    '-n': fwForm.name, '--priority': fwForm.priority, '--action': fwForm.action, '--source-addresses': split(fwForm.sources).join(',') };
  if (fwKind.value === 'network-rule') {
    flags['--protocols'] = fwForm.protocol;
    flags['--destination-addresses'] = split(fwForm.dests).join(',');
    flags['--destination-ports'] = fwForm.ports;
  } else {
    flags['--protocols'] = 'Http=80,Https=443';
    flags['--target-fqdns'] = split(fwForm.fqdns).join(',');
  }
  await act(cli(['az', 'network', 'firewall', fwKind.value, 'create'], flags), `Added rule '${fwForm.name}'`,
            () => { fwPane.value = false; });
}
</script>
