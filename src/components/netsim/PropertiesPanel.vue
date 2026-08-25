<template>
  <aside class="ns-props">
    <!-- ═══════════ nothing selected ═══════════ -->
    <div v-if="!device && !link" class="ns-props-empty">
      <DeviceIcon name="cursor" :size="34" />
      <h4>{{ $t('Nothing selected') }}</h4>
      <p>{{ $t('Click a device to configure it, or a cable to inspect the link.') }}</p>
      <div class="ns-quick-stats">
        <div><strong>{{ store.stats.devices }}</strong><span>{{ $t('devices') }}</span></div>
        <div><strong>{{ store.stats.links }}</strong><span>{{ $t('links') }}</span></div>
        <div><strong>{{ store.stats.vlans }}</strong><span>{{ $t('VLANs') }}</span></div>
        <div :class="{ bad: store.errorCount > 0 }"><strong>{{ store.errorCount }}</strong><span>{{ $t('errors') }}</span></div>
      </div>
    </div>

    <!-- ═══════════ link selected ═══════════ -->
    <div v-else-if="link" class="ns-props-inner">
      <header class="ns-props-head">
        <span class="ns-props-icon" style="color:#94a3b8"><DeviceIcon name="cable" :size="22" /></span>
        <div>
          <h3>{{ linkTitle }}</h3>
          <p>{{ CABLE_LABELS[link.cable] }} · {{ link.bandwidthMbps >= 1000 ? link.bandwidthMbps / 1000 + ' Gbps' : link.bandwidthMbps + ' Mbps' }}</p>
        </div>
        <button class="ns-icon-btn" :title="$t('Close')" @click="store.selectLink(null)"><DeviceIcon name="close" :size="15" /></button>
      </header>

      <div class="ns-props-body">
        <div class="ns-field-grid">
          <label>{{ $t('Status') }}<span class="ns-status-pill" :class="link.severed ? 'down' : link.status">{{ link.severed ? 'cut' : link.status }}</span></label>
          <label>{{ $t('Latency') }}
            <input type="number" min="0" step="0.1" v-model.number="link.latencyMs" @change="store.applyConfigChange()" />
          </label>
          <label>{{ $t('Bandwidth (Mbps)') }}
            <input type="number" min="1" v-model.number="link.bandwidthMbps" @change="store.applyConfigChange()" />
          </label>
          <label>{{ $t('Label') }}
            <input type="text" v-model="link.label" :placeholder="$t('e.g. 802.1Q trunk')" @change="store.markDirty()" />
          </label>
          <label>{{ $t('Cable type') }}
            <select v-model="link.cable" @change="store.applyConfigChange()">
              <option v-for="(lbl, key) in CABLE_LABELS" :key="key" :value="key">{{ lbl }}</option>
            </select>
          </label>
        </div>

        <div class="ns-note-block">
          <strong>{{ $t('Why this matters:') }}</strong>
          {{ cableTeaching }}
        </div>

        <div class="ns-btn-row">
          <button class="ns-btn" :class="link.severed ? 'success' : 'warning'" @click="store.toggleLinkSevered(link.id)">
            {{ link.severed ? 'Reconnect cable' : 'Cut cable (test failover)' }}
          </button>
          <button class="ns-btn danger" @click="store.removeLink(link.id)">
            <DeviceIcon name="trash" :size="14" /> {{ $t('Delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════ device selected ═══════════ -->
    <div v-else-if="device" class="ns-props-inner">
      <header class="ns-props-head">
        <span class="ns-props-icon" :style="{ color: type?.accent }"><DeviceIcon :name="type?.icon || 'pc'" :size="22" /></span>
        <div>
          <h3>
            <input class="ns-hostname-input" v-model="device.hostname" spellcheck="false" @change="store.markDirty()" />
          </h3>
          <p>{{ $t('{v0} · Layer {v1} · {v2}', { v0: type?.name, v1: type?.layer, v2: type?.role }) }}</p>
        </div>
        <button class="ns-icon-btn" :title="$t('Close')" @click="store.select(null)"><DeviceIcon name="close" :size="15" /></button>
      </header>

      <nav class="ns-tabs">
        <button
          v-for="t in visibleTabs" :key="t.id"
          :class="['ns-tab', { active: tab === t.id }]"
          @click="tab = t.id"
        >{{ t.label }}</button>
      </nav>

      <div class="ns-props-body">
        <!-- ─── Overview ─── -->
        <section v-if="tab === 'overview'">
          <div class="ns-btn-row tight">
            <button class="ns-btn" :class="device.powered ? 'warning' : 'success'" @click="store.togglePower(device.id)">
              <DeviceIcon name="power" :size="14" /> {{ device.powered ? 'Power off' : 'Power on' }}
            </button>
            <button class="ns-btn ghost" @click="emit('open-terminal', device.id)">
              <DeviceIcon name="terminal" :size="14" /> {{ $t('Terminal') }}
            </button>
            <button class="ns-btn ghost" @click="store.duplicateDevice(device.id)">
              <DeviceIcon name="copy" :size="14" /> {{ $t('Duplicate') }}
            </button>
            <button class="ns-btn danger" @click="store.removeDevice(device.id)">
              <DeviceIcon name="trash" :size="14" /> {{ $t('Delete') }}
            </button>
          </div>

          <div class="ns-btn-row tight">
            <button class="ns-btn ghost sm" @click="doPing">{{ $t('Ping…') }}</button>
            <button v-if="canDhcp" class="ns-btn ghost sm" @click="store.runDhcp(device.id)">{{ $t('Request DHCP') }}</button>
            <button v-if="isHost" class="ns-btn ghost sm" @click="doHttp">{{ $t('Browse…') }}</button>
            <button v-if="isHost" class="ns-btn ghost sm" @click="doDns">{{ $t('nslookup…') }}</button>
          </div>

          <div class="ns-info-rows">
            <div><span>{{ $t('Reachable addresses') }}</span><strong>{{ addressSummary || '—' }}</strong></div>
            <div><span>{{ $t('Cabled ports') }}</span><strong>{{ cabledCount }} / {{ device.interfaces.filter(i => i.medium !== 'console').length }}</strong></div>
            <div v-if="isHost"><span>{{ $t('Default gateway') }}</span><strong :class="{ bad: gatewayBad }">{{ device.host.defaultGateway || 'not set' }}</strong></div>
            <div v-if="isHost"><span>{{ $t('DNS server') }}</span><strong>{{ device.host.dnsServer || 'not set' }}</strong></div>
            <div v-if="device.stp?.enabled"><span>{{ $t('Spanning tree') }}</span><strong>{{ $t('{v0} · priority {v1}', { v0: device.stp.isRoot ? 'root bridge' : device.stp.mode.toUpperCase(), v1: device.stp.priority }) }}</strong></div>
          </div>

          <label class="ns-field block">{{ $t('Notes') }}
            <textarea v-model="device.notes" rows="3" placeholder="What is this device for?" @change="store.markDirty()"></textarea>
          </label>

          <div v-if="deviceIssues.length" class="ns-issue-list">
            <h5>{{ $t('Issues on this device') }}</h5>
            <div v-for="i in deviceIssues" :key="i.id" class="ns-issue" :class="i.severity">
              <strong>{{ i.title }}</strong>
              <p>{{ i.detail }}</p>
              <p v-if="i.fix" class="ns-fix">{{ $t('Fix: {v0}', { v0: i.fix }) }}</p>
            </div>
          </div>

          <div v-if="type?.learn?.length" class="ns-learn-block">
            <h5><DeviceIcon name="book" :size="14" /> {{ $t('About this device') }}</h5>
            <p class="ns-blurb">{{ type.blurb }}</p>
            <ul><li v-for="(l, i) in type.learn" :key="i">{{ l }}</li></ul>
          </div>
        </section>

        <!-- ─── Interfaces ─── -->
        <section v-else-if="tab === 'interfaces'">
          <div class="ns-iface-list">
            <div
              v-for="st in ifaceStatus"
              :key="st.iface.id"
              class="ns-iface"
              :class="{ open: openIface === st.iface.id, down: !st.status.startsWith('up/up') }"
            >
              <button class="ns-iface-head" @click="openIface = openIface === st.iface.id ? '' : st.iface.id">
                <span class="ns-iface-dot" :class="dotClass(st.status)"></span>
                <span class="ns-iface-name">{{ st.iface.short }}</span>
                <span class="ns-iface-addr">{{ st.iface.ipv4 ? `${st.iface.ipv4}/${maskToPrefix(st.iface.mask)}` : (st.iface.dhcp ? 'dhcp' : '—') }}</span>
                <span class="ns-iface-mode">{{ modeLabel(st.iface) }}</span>
                <span class="ns-group-chevron"><DeviceIcon name="chevron" :size="12" /></span>
              </button>

              <div v-show="openIface === st.iface.id" class="ns-iface-body">
                <p class="ns-iface-meta">
                  {{ $t('{v0} · {v1} · {v2} · MAC {v3}', { v0: st.iface.name, v1: st.iface.medium, v2: formatSpeed(st.iface.speedMbps), v3: st.iface.mac }) }}<br />
                  <span :class="{ bad: !st.status.startsWith('up/up') }">{{ st.status }}</span>
                  <template v-if="st.linkTo"> → {{ st.linkTo }}</template>
                  <template v-if="st.stpRole"> {{ $t('· STP {v0}', { v0: st.stpRole }) }}</template>
                </p>

                <div class="ns-field-grid">
                  <label class="ns-check">
                    <input type="checkbox" v-model="st.iface.enabled" @change="store.applyConfigChange(st.iface.enabled ? `${st.iface.short} enabled` : `${st.iface.short} shut down`)" />
                    <span>{{ $t('Interface enabled (no shutdown)') }}</span>
                  </label>
                  <label class="ns-check">
                    <input type="checkbox" v-model="st.iface.dhcp" @change="store.applyConfigChange()" />
                    <span>{{ $t('Obtain address by DHCP') }}</span>
                  </label>
                  <label :class="{ disabled: st.iface.dhcp }">{{ $t('IPv4 address') }}
                    <input type="text" v-model="st.iface.ipv4" :disabled="st.iface.dhcp" placeholder="10.0.1.10" spellcheck="false" @change="onIpChange(st.iface)" />
                  </label>
                  <label :class="{ disabled: st.iface.dhcp }">{{ $t('Subnet mask') }}
                    <input type="text" v-model="st.iface.mask" :disabled="st.iface.dhcp" placeholder="255.255.255.0" list="ns-masks" spellcheck="false" @change="onIpChange(st.iface)" />
                  </label>
                  <label>{{ $t('IPv6 address') }}
                    <input type="text" v-model="st.iface.ipv6" :placeholder="$t('2001:db8:10::1')" spellcheck="false" @change="store.applyConfigChange()" />
                  </label>
                  <label>{{ $t('IPv6 prefix') }}
                    <input type="number" min="1" max="128" v-model.number="st.iface.prefix6" @change="store.applyConfigChange()" />
                  </label>
                  <label>{{ $t('Description') }}
                    <input type="text" v-model="st.iface.description" :placeholder="$t('to SW1 Gi1/0/1')" @change="store.markDirty()" />
                  </label>

                  <template v-if="supportsVlans">
                    <label>{{ $t('Switchport mode') }}
                      <select v-model="st.iface.mode" @change="store.applyConfigChange()">
                        <option value="access">{{ $t('access') }}</option>
                        <option value="trunk">{{ $t('trunk') }}</option>
                        <option value="routed">{{ $t('routed (no switchport)') }}</option>
                      </select>
                    </label>
                    <label v-if="st.iface.mode === 'access'">{{ $t('Access VLAN') }}
                      <input type="number" min="1" max="4094" v-model.number="st.iface.accessVlan" @change="store.applyConfigChange()" />
                    </label>
                    <label v-if="st.iface.mode === 'trunk'">{{ $t('Native VLAN') }}
                      <input type="number" min="1" max="4094" v-model.number="st.iface.nativeVlan" @change="store.applyConfigChange()" />
                    </label>
                    <label v-if="st.iface.mode === 'trunk'" class="span2">{{ $t('Allowed VLANs (blank = all)') }}
                      <input
                        type="text"
                        :value="st.iface.trunkVlans.join(',')"
                        placeholder="10,20,30"
                        spellcheck="false"
                        @change="setTrunkVlans(st.iface, ($event.target as HTMLInputElement).value)"
                      />
                    </label>
                  </template>

                  <template v-if="supportsNat">
                    <label>{{ $t('NAT role') }}
                      <select v-model="st.iface.natRole" @change="store.applyConfigChange()">
                        <option value="none">{{ $t('none') }}</option>
                        <option value="inside">{{ $t('inside') }}</option>
                        <option value="outside">{{ $t('outside') }}</option>
                      </select>
                    </label>
                  </template>

                  <template v-if="device.acls.length">
                    <label>{{ $t('ACL inbound') }}
                      <select v-model="st.iface.aclIn" @change="store.applyConfigChange()">
                        <option value="">{{ $t('(none)') }}</option>
                        <option v-for="a in device.acls" :key="a.id" :value="a.name">{{ a.name }}</option>
                      </select>
                    </label>
                    <label>{{ $t('ACL outbound') }}
                      <select v-model="st.iface.aclOut" @change="store.applyConfigChange()">
                        <option value="">{{ $t('(none)') }}</option>
                        <option v-for="a in device.acls" :key="a.id" :value="a.name">{{ a.name }}</option>
                      </select>
                    </label>
                  </template>

                  <label>{{ $t('Duplex') }}
                    <select v-model="st.iface.duplex" @change="store.applyConfigChange()">
                      <option value="auto">{{ $t('auto') }}</option><option value="full">{{ $t('full') }}</option><option value="half">{{ $t('half') }}</option>
                    </select>
                  </label>
                  <label>MTU
                    <input type="number" min="576" max="9216" v-model.number="st.iface.mtu" @change="store.applyConfigChange()" />
                  </label>

                  <template v-if="st.iface.medium === 'wireless' || st.iface.medium === 'cellular'">
                    <label class="span2">{{ $t('Join SSID') }}
                      <input type="text" v-model="st.iface.ssid" :placeholder="$t('SelfStudy-WiFi')" spellcheck="false" @change="store.applyConfigChange()" />
                    </label>
                    <label class="span2">{{ $t('Passphrase') }}
                      <input type="text" v-model="st.iface.passphrase" :placeholder="$t('matches the AP exactly')" spellcheck="false" @change="store.applyConfigChange()" />
                    </label>
                    <label>{{ $t('Band') }}
                      <select v-model="st.iface.band" @change="store.applyConfigChange()">
                        <option value="2.4GHz">{{ $t('2.4 GHz') }}</option><option value="5GHz">{{ $t('5 GHz') }}</option><option value="6GHz">{{ $t('6 GHz') }}</option>
                      </select>
                    </label>
                  </template>
                </div>

                <div v-if="st.iface.ipv4 && subnetOf(st.iface)" class="ns-subnet-facts">
                  <span>{{ $t('net') }} <strong>{{ subnetOf(st.iface)!.network }}/{{ subnetOf(st.iface)!.prefix }}</strong></span>
                  <span>{{ $t('hosts') }} <strong>{{ subnetOf(st.iface)!.firstHost }}–{{ subnetOf(st.iface)!.lastHost }}</strong></span>
                  <span>{{ $t('bcast') }} <strong>{{ subnetOf(st.iface)!.broadcast }}</strong></span>
                  <span>{{ $t('{v0} usable · {v1}', { v0: subnetOf(st.iface)!.hosts, v1: subnetOf(st.iface)!.scope }) }}</span>
                </div>

                <div v-if="st.iface.counters" class="ns-counters">
                  {{ $t('rx {v0} frames / {v1} B · tx {v2} frames / {v3} B · drops {v4}', { v0: st.iface.counters.rxFrames, v1: st.iface.counters.rxBytes, v2: st.iface.counters.txFrames, v3: st.iface.counters.txBytes, v4: st.iface.counters.drops }) }}
                </div>
              </div>
            </div>
          </div>
          <datalist id="ns-masks">
            <option v-for="p in [8,16,20,22,23,24,25,26,27,28,29,30,31,32]" :key="p" :value="prefixToMask(p)">/{{ p }}</option>
          </datalist>
        </section>

        <!-- ─── Host settings ─── -->
        <section v-else-if="tab === 'host'">
          <div class="ns-field-grid">
            <label class="ns-check span2">
              <input type="checkbox" v-model="device.host.dhcp" @change="store.applyConfigChange()" />
              <span>{{ $t('Use DHCP for addressing') }}</span>
            </label>
            <label class="span2">{{ $t('Default gateway') }}
              <input type="text" v-model="device.host.defaultGateway" placeholder="10.0.1.1" spellcheck="false" @change="store.applyConfigChange()" />
            </label>
            <label class="span2">{{ $t('DNS server') }}
              <input type="text" v-model="device.host.dnsServer" placeholder="10.0.30.10" spellcheck="false" @change="store.applyConfigChange()" />
            </label>
          </div>
          <div v-if="gatewayBad" class="ns-note-block bad">
            <strong>{{ $t('Problem:') }}</strong> {{ $t('the gateway {v0} is not inside any of this host\'s own subnets. A host cannot even ARP for an address outside its subnet — this is nearly always a wrong subnet mask.', { v0: device.host.defaultGateway }) }}
          </div>
          <div class="ns-note-block">
            <strong>{{ $t('Remember:') }}</strong> {{ $t('a host compares the destination against its own address using the mask. Same network → ARP directly. Different network → send the frame to the gateway\'s MAC while the IP header still targets the final destination.') }}
          </div>
        </section>

        <!-- ─── VLANs ─── -->
        <section v-else-if="tab === 'vlans'">
          <div class="ns-row-head">
            <h5>{{ $t('VLAN database') }}</h5>
            <button class="ns-btn ghost sm" @click="addVlanRow"><DeviceIcon name="plus" :size="13" /> {{ $t('Add VLAN') }}</button>
          </div>
          <table class="ns-table">
            <thead><tr><th>ID</th><th>{{ $t('Name') }}</th><th>{{ $t('Access ports') }}</th><th></th></tr></thead>
            <tbody>
              <tr v-for="v in device.vlans" :key="v.id">
                <td><span class="ns-vlan-dot" :style="{ background: v.color }"></span>{{ v.id }}</td>
                <td><input class="ns-inline-input" v-model="v.name" @change="store.markDirty()" /></td>
                <td class="ns-mono">{{ portsInVlan(v.id) || '—' }}</td>
                <td>
                  <button v-if="v.id !== 1" class="ns-icon-btn danger" :title="$t('Delete VLAN')" @click="removeVlan(v.id)">
                    <DeviceIcon name="trash" :size="13" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <template v-if="isMultilayer">
            <div class="ns-row-head">
              <h5>{{ $t('SVIs (inter-VLAN routing)') }}</h5>
              <button class="ns-btn ghost sm" @click="addSviRow"><DeviceIcon name="plus" :size="13" /> {{ $t('Add SVI') }}</button>
            </div>
            <table class="ns-table">
              <thead><tr><th>{{ $t('Interface') }}</th><th>{{ $t('Address') }}</th><th>{{ $t('Mask') }}</th><th></th></tr></thead>
              <tbody>
                <tr v-for="svi in svis" :key="svi.id">
                  <td class="ns-mono">{{ svi.name }}</td>
                  <td><input class="ns-inline-input" v-model="svi.ipv4" placeholder="10.1.10.1" @change="store.applyConfigChange()" /></td>
                  <td><input class="ns-inline-input" v-model="svi.mask" @change="store.applyConfigChange()" /></td>
                  <td><button class="ns-icon-btn danger" @click="removeSvi(svi.id)"><DeviceIcon name="trash" :size="13" /></button></td>
                </tr>
                <tr v-if="!svis.length"><td colspan="4" class="ns-muted">{{ $t('No SVIs yet. Each VLAN needs one to be routable.') }}</td></tr>
              </tbody>
            </table>
          </template>

          <div v-if="device.stp" class="ns-sub-block">
            <h5>{{ $t('Spanning tree') }}</h5>
            <div class="ns-field-grid">
              <label class="ns-check span2">
                <input type="checkbox" v-model="device.stp.enabled" @change="store.applyConfigChange()" />
                <span>{{ $t('Spanning tree enabled') }}</span>
              </label>
              <label>{{ $t('Mode') }}
                <select v-model="device.stp.mode" @change="store.applyConfigChange()">
                  <option value="stp">stp</option><option value="rstp">{{ $t('rstp') }}</option>
                  <option value="pvst">{{ $t('pvst') }}</option><option value="rapid-pvst">{{ $t('rapid-pvst') }}</option><option value="mstp">{{ $t('mstp') }}</option>
                </select>
              </label>
              <label>{{ $t('Bridge priority') }}
                <select v-model.number="device.stp.priority" @change="store.applyConfigChange()">
                  <option v-for="p in [0,4096,8192,12288,16384,20480,24576,28672,32768,36864,40960,45056,49152]" :key="p" :value="p">{{ p }}</option>
                </select>
              </label>
            </div>
            <p class="ns-muted sm">
              {{ $t('Lowest priority wins the root election; the MAC address breaks ties. Set this deliberately on the switch you want as root — leaving every switch at 32768 means the oldest box wins by accident.') }}
            </p>
          </div>
        </section>

        <!-- ─── Routing ─── -->
        <section v-else-if="tab === 'routing'">
          <div class="ns-row-head">
            <h5>{{ $t('Static routes') }}</h5>
            <button class="ns-btn ghost sm" @click="addRoute"><DeviceIcon name="plus" :size="13" /> {{ $t('Add route') }}</button>
          </div>
          <table class="ns-table">
            <thead><tr><th>{{ $t('Network') }}</th><th>{{ $t('Mask') }}</th><th>{{ $t('Next hop') }}</th><th></th></tr></thead>
            <tbody>
              <tr v-for="r in device.routing.staticRoutes" :key="r.id">
                <td><input class="ns-inline-input" v-model="r.network" placeholder="10.2.0.0" @change="store.applyConfigChange()" /></td>
                <td><input class="ns-inline-input" v-model="r.mask" placeholder="255.255.255.0" @change="store.applyConfigChange()" /></td>
                <td><input class="ns-inline-input" v-model="r.nextHop" placeholder="172.16.1.2" @change="store.applyConfigChange()" /></td>
                <td><button class="ns-icon-btn danger" @click="removeRoute(r.id)"><DeviceIcon name="trash" :size="13" /></button></td>
              </tr>
              <tr v-if="!device.routing.staticRoutes.length"><td colspan="4" class="ns-muted">{{ $t('None. A router only knows its connected networks until you add routes.') }}</td></tr>
            </tbody>
          </table>

          <div class="ns-field-grid">
            <label class="span2">{{ $t('Default route / gateway of last resort') }}
              <input type="text" v-model="device.routing.defaultGateway" placeholder="203.0.113.1" spellcheck="false" @change="store.applyConfigChange()" />
            </label>
          </div>

          <div class="ns-sub-block">
            <h5>{{ $t('Dynamic routing') }}</h5>
            <div class="ns-field-grid">
              <label class="ns-check span2">
                <input type="checkbox" v-model="device.routing.ospf.enabled" @change="store.applyConfigChange()" />
                <span>{{ $t('OSPF (link-state, AD 110, bandwidth-based cost)') }}</span>
              </label>
              <label v-if="device.routing.ospf.enabled">{{ $t('Process ID') }}
                <input type="number" min="1" v-model.number="device.routing.ospf.processId" @change="store.applyConfigChange()" />
              </label>
              <label v-if="device.routing.ospf.enabled">{{ $t('Router ID') }}
                <input type="text" v-model="device.routing.ospf.routerId" placeholder="1.1.1.1" @change="store.applyConfigChange()" />
              </label>
              <label class="ns-check span2">
                <input type="checkbox" v-model="device.routing.rip.enabled" @change="store.applyConfigChange()" />
                <span>{{ $t('RIP (distance-vector, AD 120, max 15 hops)') }}</span>
              </label>
              <label v-if="device.routing.rip.enabled">{{ $t('RIP version') }}
                <select v-model.number="device.routing.rip.version" @change="store.applyConfigChange()">
                  <option :value="1">{{ $t('1 (classful)') }}</option><option :value="2">{{ $t('2 (classless, VLSM)') }}</option>
                </select>
              </label>
            </div>
          </div>

          <div class="ns-sub-block">
            <h5>{{ $t('Routing table (live)') }}</h5>
            <table class="ns-table mono">
              <thead><tr><th>{{ $t('Code') }}</th><th>{{ $t('Destination') }}</th><th>{{ $t('Via') }}</th><th>{{ $t('AD/Metric') }}</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in routingTable" :key="i">
                  <td>{{ routeCode(r.source) }}</td>
                  <td>{{ r.network }}/{{ maskToPrefix(r.mask) }}</td>
                  <td>{{ r.nextHop && r.nextHop !== '0.0.0.0' ? r.nextHop : 'connected' }}{{ exitName(r.exitInterfaceId) }}</td>
                  <td>{{ r.source === 'connected' ? '0/0' : `${r.adminDistance ?? 1}/${r.metric}` }}</td>
                </tr>
                <tr v-if="!routingTable.length"><td colspan="4" class="ns-muted">{{ $t('Empty — address and enable the interfaces first.') }}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ─── Services ─── -->
        <section v-else-if="tab === 'services'">
          <div class="ns-service-toggle">
            <label class="ns-check">
              <input type="checkbox" v-model="device.services.http.enabled" @change="store.applyConfigChange()" />
              <span>{{ $t('HTTP server (port {v0})', { v0: device.services.http.port }) }}</span>
            </label>
            <template v-if="device.services.http.enabled">
              <div class="ns-field-grid indent">
                <label>{{ $t('Port') }}<input type="number" v-model.number="device.services.http.port" @change="store.applyConfigChange()" /></label>
                <label class="ns-check"><input type="checkbox" v-model="device.services.http.tls" @change="store.applyConfigChange()" /><span>{{ $t('Also serve HTTPS (443)') }}</span></label>
                <label class="span2">{{ $t('Page title') }}<input type="text" v-model="device.services.http.title" @change="store.markDirty()" /></label>
                <label class="span2">{{ $t('Page body (HTML)') }}<textarea rows="3" v-model="device.services.http.body" @change="store.markDirty()"></textarea></label>
              </div>
            </template>
          </div>

          <div class="ns-service-toggle">
            <label class="ns-check">
              <input type="checkbox" v-model="device.services.dns.enabled" @change="store.applyConfigChange()" />
              <span>{{ $t('DNS server (UDP 53)') }}</span>
            </label>
            <template v-if="device.services.dns.enabled">
              <div class="ns-row-head indent">
                <span class="ns-muted sm">{{ $t('Authoritative records') }}</span>
                <button class="ns-btn ghost sm" @click="addDnsRow"><DeviceIcon name="plus" :size="13" /> {{ $t('Add record') }}</button>
              </div>
              <table class="ns-table indent">
                <thead><tr><th>{{ $t('Name') }}</th><th>{{ $t('Type') }}</th><th>{{ $t('Value') }}</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="r in device.services.dns.records" :key="r.id">
                    <td><input class="ns-inline-input" v-model="r.name" :placeholder="$t('www.lab.local')" @change="store.applyConfigChange()" /></td>
                    <td>
                      <select class="ns-inline-input" v-model="r.type" @change="store.markDirty()">
                        <option>A</option><option>{{ $t('AAAA') }}</option><option>CNAME</option><option>MX</option><option>TXT</option>
                      </select>
                    </td>
                    <td><input class="ns-inline-input" v-model="r.value" placeholder="10.1.30.20" @change="store.applyConfigChange()" /></td>
                    <td><button class="ns-icon-btn danger" @click="removeDnsRow(r.id)"><DeviceIcon name="trash" :size="13" /></button></td>
                  </tr>
                  <tr v-if="!device.services.dns.records.length"><td colspan="4" class="ns-muted">{{ $t('No records. Without one, clients get NXDOMAIN.') }}</td></tr>
                </tbody>
              </table>
            </template>
          </div>

          <div class="ns-service-toggle">
            <label class="ns-check">
              <input type="checkbox" v-model="device.services.dhcp.enabled" @change="store.applyConfigChange()" />
              <span>{{ $t('DHCP server (UDP 67)') }}</span>
            </label>
            <template v-if="device.services.dhcp.enabled">
              <div class="ns-row-head indent">
                <span class="ns-muted sm">{{ $t('Address pools') }}</span>
                <button class="ns-btn ghost sm" @click="addPool"><DeviceIcon name="plus" :size="13" /> {{ $t('Add pool') }}</button>
              </div>
              <div v-for="p in device.services.dhcp.pools" :key="p.id" class="ns-pool indent">
                <div class="ns-pool-head">
                  <input class="ns-inline-input strong" v-model="p.name" @change="store.markDirty()" />
                  <button class="ns-icon-btn danger" @click="removePool(p.id)"><DeviceIcon name="trash" :size="13" /></button>
                </div>
                <div class="ns-field-grid">
                  <label>{{ $t('Network') }}<input v-model="p.network" placeholder="10.1.10.0" @change="store.applyConfigChange()" /></label>
                  <label>{{ $t('Mask') }}<input v-model="p.mask" placeholder="255.255.255.0" @change="store.applyConfigChange()" /></label>
                  <label>{{ $t('Range start') }}<input v-model="p.rangeStart" placeholder="10.1.10.100" @change="store.applyConfigChange()" /></label>
                  <label>{{ $t('Range end') }}<input v-model="p.rangeEnd" placeholder="10.1.10.200" @change="store.applyConfigChange()" /></label>
                  <label>{{ $t('Gateway (opt 3)') }}<input v-model="p.gateway" placeholder="10.1.10.1" @change="store.applyConfigChange()" /></label>
                  <label>{{ $t('DNS (opt 6)') }}<input v-model="p.dnsServer" placeholder="10.1.30.10" @change="store.applyConfigChange()" /></label>
                  <label>{{ $t('Lease (hours)') }}<input type="number" min="1" v-model.number="p.leaseHours" @change="store.markDirty()" /></label>
                </div>
              </div>
              <div v-if="leases.length" class="ns-sub-block indent">
                <h5>{{ $t('Active leases') }}</h5>
                <table class="ns-table mono">
                  <thead><tr><th>IP</th><th>MAC</th><th>{{ $t('Host') }}</th></tr></thead>
                  <tbody><tr v-for="l in leases" :key="l.mac"><td>{{ l.ip }}</td><td>{{ l.mac }}</td><td>{{ l.hostname }}</td></tr></tbody>
                </table>
              </div>
            </template>
          </div>

          <div class="ns-service-toggle compact">
            <label class="ns-check"><input type="checkbox" v-model="device.services.ftp.enabled" @change="store.applyConfigChange()" /><span>{{ $t('FTP (21)') }}</span></label>
            <label class="ns-check"><input type="checkbox" v-model="device.services.smtp.enabled" @change="store.applyConfigChange()" /><span>{{ $t('SMTP (25)') }}</span></label>
            <label class="ns-check"><input type="checkbox" v-model="device.services.ntp.enabled" @change="store.applyConfigChange()" /><span>{{ $t('NTP (123)') }}</span></label>
            <label class="ns-check"><input type="checkbox" v-model="device.services.syslog.enabled" @change="store.applyConfigChange()" /><span>{{ $t('Syslog (514)') }}</span></label>
            <label class="ns-check"><input type="checkbox" v-model="device.services.mqtt.enabled" @change="store.applyConfigChange()" /><span>{{ $t('MQTT (1883)') }}</span></label>
            <label class="ns-check"><input type="checkbox" v-model="device.services.radius.enabled" @change="store.applyConfigChange()" /><span>{{ $t('RADIUS (1812)') }}</span></label>
          </div>
        </section>

        <!-- ─── Security ─── -->
        <section v-else-if="tab === 'security'">
          <div class="ns-row-head">
            <h5>{{ $t('Access control lists') }}</h5>
            <button class="ns-btn ghost sm" @click="addAclRow"><DeviceIcon name="plus" :size="13" /> {{ $t('New ACL') }}</button>
          </div>

          <div v-for="acl in device.acls" :key="acl.id" class="ns-acl">
            <div class="ns-acl-head">
              <input class="ns-inline-input strong" v-model="acl.name" @change="store.markDirty()" />
              <select class="ns-inline-input" v-model="acl.type" @change="store.applyConfigChange()">
                <option value="standard">{{ $t('standard') }}</option><option value="extended">{{ $t('extended') }}</option>
              </select>
              <span class="ns-muted sm">{{ appliedWhere(acl.name) }}</span>
              <button class="ns-icon-btn danger" @click="removeAcl(acl.id)"><DeviceIcon name="trash" :size="13" /></button>
            </div>
            <table class="ns-table">
              <thead><tr><th>#</th><th>{{ $t('Action') }}</th><th>{{ $t('Proto') }}</th><th>{{ $t('Source') }}</th><th v-if="acl.type === 'extended'">{{ $t('Destination') }}</th><th v-if="acl.type === 'extended'">{{ $t('Port') }}</th><th>{{ $t('Hits') }}</th><th></th></tr></thead>
              <tbody>
                <tr v-for="r in [...acl.rules].sort((a, b) => a.seq - b.seq)" :key="r.id">
                  <td class="ns-mono">{{ r.seq }}</td>
                  <td>
                    <select class="ns-inline-input" v-model="r.action" @change="store.applyConfigChange()">
                      <option value="permit">{{ $t('permit') }}</option><option value="deny">{{ $t('deny') }}</option>
                    </select>
                  </td>
                  <td>
                    <select class="ns-inline-input" v-model="r.protocol" @change="store.applyConfigChange()">
                      <option value="ip">ip</option><option value="icmp">{{ $t('icmp') }}</option><option value="tcp">tcp</option><option value="udp">udp</option>
                    </select>
                  </td>
                  <td class="ns-acl-addr">
                    <label class="ns-check tiny"><input type="checkbox" v-model="r.srcAny" @change="store.applyConfigChange()" /><span>{{ $t('any') }}</span></label>
                    <template v-if="!r.srcAny">
                      <input class="ns-inline-input" v-model="r.src" placeholder="10.0.1.0" @change="store.applyConfigChange()" />
                      <input class="ns-inline-input" v-model="r.srcWildcard" placeholder="0.0.0.255" @change="store.applyConfigChange()" />
                    </template>
                  </td>
                  <td v-if="acl.type === 'extended'" class="ns-acl-addr">
                    <label class="ns-check tiny"><input type="checkbox" v-model="r.dstAny" @change="store.applyConfigChange()" /><span>{{ $t('any') }}</span></label>
                    <template v-if="!r.dstAny">
                      <input class="ns-inline-input" v-model="r.dst" placeholder="10.0.2.0" @change="store.applyConfigChange()" />
                      <input class="ns-inline-input" v-model="r.dstWildcard" placeholder="0.0.0.255" @change="store.applyConfigChange()" />
                    </template>
                  </td>
                  <td v-if="acl.type === 'extended'"><input class="ns-inline-input tiny" type="number" v-model.number="r.dstPort" placeholder="80" @change="store.applyConfigChange()" /></td>
                  <td class="ns-mono">{{ r.hits || 0 }}</td>
                  <td><button class="ns-icon-btn danger" @click="removeAclRule(acl.id, r.id)"><DeviceIcon name="trash" :size="13" /></button></td>
                </tr>
                <tr class="ns-implicit"><td colspan="8">{{ $t('implicit deny any — every ACL ends with this') }}</td></tr>
              </tbody>
            </table>
            <button class="ns-btn ghost sm" @click="addAclRule(acl.id)"><DeviceIcon name="plus" :size="12" /> {{ $t('Add rule') }}</button>
          </div>
          <p v-if="!device.acls.length" class="ns-muted">{{ $t('No ACLs. Create one, add rules, then apply it to an interface on the Interfaces tab.') }}</p>

          <div v-if="supportsNat" class="ns-sub-block">
            <h5>NAT</h5>
            <div class="ns-field-grid">
              <label class="ns-check span2">
                <input type="checkbox" v-model="device.nat.enabled" @change="store.applyConfigChange()" />
                <span>{{ $t('NAT enabled') }}</span>
              </label>
              <label>{{ $t('Mode') }}
                <select v-model="device.nat.mode" @change="store.applyConfigChange()">
                  <option value="pat">{{ $t('PAT (overload) — many to one') }}</option>
                  <option value="dynamic">{{ $t('dynamic pool') }}</option>
                  <option value="static">{{ $t('static one-to-one') }}</option>
                </select>
              </label>
              <label>{{ $t('Outside address') }}
                <input type="text" v-model="device.nat.outsideAddress" placeholder="203.0.113.10" @change="store.applyConfigChange()" />
              </label>
            </div>
            <p class="ns-muted sm">{{ $t('Mark interfaces as NAT inside / outside on the Interfaces tab, or nothing is translated.') }}</p>
            <div v-if="device.nat.translations?.length" class="ns-sub-block">
              <table class="ns-table mono">
                <thead><tr><th>{{ $t('Pro') }}</th><th>{{ $t('Inside local') }}</th><th>{{ $t('Inside global') }}</th><th>{{ $t('Outside') }}</th></tr></thead>
                <tbody>
                  <tr v-for="(t, i) in device.nat.translations" :key="i">
                    <td>{{ t.protocol }}</td><td>{{ t.insideLocal }}</td><td>{{ t.insideGlobal }}</td><td>{{ t.outsideGlobal }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ─── Wireless ─── -->
        <section v-else-if="tab === 'wireless' && device.wireless">
          <div class="ns-field-grid">
            <label class="span2">SSID
              <input type="text" v-model="device.wireless.ssid" spellcheck="false" @change="store.applyConfigChange()" />
            </label>
            <label class="span2">{{ $t('Guest SSID (optional)') }}
              <input type="text" v-model="device.wireless.guestSsid" spellcheck="false" @change="store.applyConfigChange()" />
            </label>
            <label>{{ $t('Security') }}
              <select v-model="device.wireless.security" @change="store.applyConfigChange()">
                <option value="open">{{ $t('open (no encryption)') }}</option>
                <option value="wep">{{ $t('WEP (broken — never use)') }}</option>
                <option value="wpa2-personal">{{ $t('WPA2-Personal') }}</option>
                <option value="wpa2-enterprise">{{ $t('WPA2-Enterprise (802.1X)') }}</option>
                <option value="wpa3-personal">{{ $t('WPA3-Personal (SAE)') }}</option>
                <option value="wpa3-enterprise">{{ $t('WPA3-Enterprise') }}</option>
              </select>
            </label>
            <label>{{ $t('Passphrase') }}
              <input type="text" v-model="device.wireless.passphrase" spellcheck="false" @change="store.applyConfigChange()" />
            </label>
            <label>{{ $t('Band') }}
              <select v-model="device.wireless.band" @change="store.applyConfigChange()">
                <option value="2.4GHz">{{ $t('2.4 GHz (range)') }}</option>
                <option value="5GHz">{{ $t('5 GHz (capacity)') }}</option>
                <option value="6GHz">{{ $t('6 GHz (Wi-Fi 6E/7, WPA3 only)') }}</option>
              </select>
            </label>
            <label>{{ $t('Channel') }}
              <input type="number" min="1" v-model.number="device.wireless.channel" @change="store.applyConfigChange()" />
            </label>
            <label>{{ $t('Channel width (MHz)') }}
              <select v-model.number="device.wireless.channelWidthMHz" @change="store.applyConfigChange()">
                <option :value="20">20</option><option :value="40">40</option><option :value="80">80</option>
                <option :value="160">160</option><option :value="320">{{ $t('320 (Wi-Fi 7, 6 GHz)') }}</option>
              </select>
            </label>
            <label>{{ $t('Standard') }}
              <select v-model="device.wireless.standard" @change="store.applyConfigChange()">
                <option value="802.11n">{{ $t('802.11n (Wi-Fi 4)') }}</option>
                <option value="802.11ac">{{ $t('802.11ac (Wi-Fi 5)') }}</option>
                <option value="802.11ax">{{ $t('802.11ax (Wi-Fi 6/6E)') }}</option>
                <option value="802.11be">{{ $t('802.11be (Wi-Fi 7)') }}</option>
              </select>
            </label>
            <label>{{ $t('Mapped VLAN') }}
              <input type="number" min="1" max="4094" v-model.number="device.wireless.vlanId" :placeholder="$t('untagged')" @change="store.applyConfigChange()" />
            </label>
            <label>{{ $t('TX power (dBm)') }}
              <input type="number" min="1" max="30" v-model.number="device.wireless.txPowerDbm" @change="store.applyConfigChange()" />
            </label>
            <label class="ns-check span2">
              <input type="checkbox" v-model="device.wireless.hidden" @change="store.markDirty()" />
              <span>{{ $t('Hide the SSID (security theatre — it does not stop anyone)') }}</span>
            </label>
          </div>

          <div class="ns-note-block" :class="{ bad: wifiWarning }">
            <strong>{{ wifiWarning ? 'Problem:' : 'Note:' }}</strong> {{ wifiWarning || wifiTip }}
          </div>

          <div class="ns-sub-block">
            <h5>{{ $t('Associated clients ({v0})', { v0: associatedClients.length }) }}</h5>
            <ul class="ns-plain-list">
              <li v-for="c in associatedClients" :key="c">{{ c }}</li>
              <li v-if="!associatedClients.length" class="ns-muted">
                {{ $t('None. A client associates when its wireless interface has the same SSID and passphrase.') }}
              </li>
            </ul>
          </div>
        </section>

        <!-- ─── Tables ─── -->
        <section v-else-if="tab === 'tables'">
          <div v-if="supportsVlans" class="ns-sub-block">
            <div class="ns-row-head">
              <h5>{{ $t('MAC address table') }}</h5>
              <button class="ns-btn ghost sm" @click="clearMac">{{ $t('Clear') }}</button>
            </div>
            <table class="ns-table mono">
              <thead><tr><th>VLAN</th><th>MAC</th><th>{{ $t('Type') }}</th><th>{{ $t('Port') }}</th></tr></thead>
              <tbody>
                <tr v-for="(e, i) in device.macTable || []" :key="i">
                  <td>{{ e.vlan }}</td><td>{{ e.mac }}</td><td>{{ e.type }}</td><td>{{ portName(e.interfaceId) }}</td>
                </tr>
                <tr v-if="!(device.macTable || []).length"><td colspan="4" class="ns-muted">{{ $t('Empty — a switch only learns from frames it receives.') }}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="ns-sub-block">
            <div class="ns-row-head">
              <h5>{{ $t('ARP cache') }}</h5>
              <button class="ns-btn ghost sm" @click="clearArp">{{ $t('Clear') }}</button>
            </div>
            <table class="ns-table mono">
              <thead><tr><th>IP</th><th>MAC</th><th>{{ $t('Type') }}</th><th>{{ $t('Interface') }}</th></tr></thead>
              <tbody>
                <tr v-for="(e, i) in device.arpTable || []" :key="i">
                  <td>{{ e.ip }}</td><td>{{ e.mac }}</td><td>{{ e.type }}</td><td>{{ portName(e.interfaceId) }}</td>
                </tr>
                <tr v-if="!(device.arpTable || []).length"><td colspan="4" class="ns-muted">{{ $t('Empty — ARP is populated on demand, when traffic needs it.') }}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="ns-sub-block">
            <div class="ns-row-head"><h5>{{ $t('Running configuration') }}</h5>
              <button class="ns-btn ghost sm" @click="copyConfig"><DeviceIcon name="copy" :size="12" /> {{ $t('Copy') }}</button>
            </div>
            <pre class="ns-config">{{ runConfig }}</pre>
          </div>
        </section>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import DeviceIcon from './DeviceIcon.vue';
import { useNetSimStore } from '@/store/netsim';
import { getDeviceType, isL2Forwarder, isL3Forwarder } from '@/netsim/devices';
import { roleOf } from '@/netsim/engine';
import { runningConfig } from '@/netsim/cli';
import { addVlan, addSvi, VLAN_PALETTE } from '@/netsim/topology';
import { maskToPrefix, prefixToMask, describeSubnet, isValidIPv4, sameSubnet, formatSpeed } from '@/netsim/ip';
import { CABLE_LABELS } from '@/netsim/types';
import type { NetInterface, Device } from '@/netsim/types';

const emit = defineEmits<{ (e: 'open-terminal', id: string): void }>();

const store = useNetSimStore();
const device = computed<Device | null>(() => store.selectedDevice);
const link = computed(() => store.selectedLink);
const type = computed(() => (device.value ? getDeviceType(device.value.typeId) : undefined));

const tab = ref('overview');
const openIface = ref('');

const isHost = computed(() => !!device.value && ['host', 'server', 'nas', 'loadbalancer'].includes(roleOf(device.value)));
const supportsVlans = computed(() => !!device.value && isL2Forwarder(roleOf(device.value)));
const isMultilayer = computed(() => !!device.value && (roleOf(device.value) === 'multilayer' || roleOf(device.value) === 'router'));
const supportsNat = computed(() => !!type.value?.supports.nat);
const supportsRouting = computed(() => !!device.value && isL3Forwarder(roleOf(device.value)));
const canDhcp = computed(() => !!device.value?.interfaces.some(i => i.dhcp));

const visibleTabs = computed(() => {
    const t: Array<{ id: string; label: string }> = [
        { id: 'overview', label: 'Overview' },
        { id: 'interfaces', label: 'Interfaces' },
    ];
    if (isHost.value) t.push({ id: 'host', label: 'IP settings' });
    if (supportsVlans.value) t.push({ id: 'vlans', label: 'VLANs & STP' });
    if (supportsRouting.value) t.push({ id: 'routing', label: 'Routing' });
    if (type.value?.supports.dhcpServer || type.value?.supports.dnsServer || type.value?.supports.httpServer) {
        t.push({ id: 'services', label: 'Services' });
    }
    if (type.value?.supports.acl || supportsNat.value) t.push({ id: 'security', label: 'Security' });
    if (device.value?.wireless) t.push({ id: 'wireless', label: 'Wireless' });
    t.push({ id: 'tables', label: 'Tables' });
    return t;
});

watch(() => device.value?.id, () => {
    if (!visibleTabs.value.some(t => t.id === tab.value)) tab.value = 'overview';
    openIface.value = '';
});

/* ─── quick actions ─── */

function suggestTarget(): string {
    const d = device.value;
    if (!d) return '';
    // Prefer the gateway, then any other addressed host, then a public address.
    if (d.host?.defaultGateway) return d.host.defaultGateway;
    const other = store.topology.devices.find(x => x.id !== d.id && x.interfaces.some(i => i.ipv4));
    return other?.interfaces.find(i => i.ipv4)?.ipv4 || '8.8.8.8';
}

function doPing() {
    const d = device.value; if (!d) return;
    const target = window.prompt(`Ping from ${d.hostname} — target IP or hostname:`, suggestTarget());
    if (target?.trim()) void store.runPing(d.id, target.trim());
}

function doHttp() {
    const d = device.value; if (!d) return;
    const server = store.topology.devices.find(x => x.services?.http?.enabled && x.interfaces.some(i => i.ipv4));
    const guess = server ? `http://${server.interfaces.find(i => i.ipv4)!.ipv4}` : 'http://';
    const url = window.prompt(`Fetch a page from ${d.hostname} — URL:`, guess);
    if (url?.trim()) void store.runHttp(d.id, url.trim().includes('://') ? url.trim() : `http://${url.trim()}`);
}

function doDns() {
    const d = device.value; if (!d) return;
    const rec = store.topology.devices.flatMap(x => x.services?.dns?.records || [])[0];
    const name = window.prompt(`Resolve a name from ${d.hostname}:`, rec?.name || 'www.lab.local');
    if (name?.trim()) void store.runDns(d.id, name.trim());
}

/* ─── overview data ─── */

const ifaceStatus = computed(() => (device.value ? store.sim.interfaceStatus(device.value.id) : []));
const cabledCount = computed(() => ifaceStatus.value.filter(s => s.linkTo).length);
const addressSummary = computed(() =>
    (device.value?.interfaces || []).filter(i => i.ipv4).map(i => `${i.ipv4}/${maskToPrefix(i.mask)}`).join(', '));

const gatewayBad = computed(() => {
    const d = device.value;
    if (!d || !isHost.value) return false;
    const gw = d.host.defaultGateway;
    if (!gw) return false;
    if (!isValidIPv4(gw)) return true;
    return !d.interfaces.some(i => i.ipv4 && isValidIPv4(i.ipv4) && sameSubnet(i.ipv4, gw, i.mask));
});

const deviceIssues = computed(() => store.issues.filter(i => i.deviceId === device.value?.id));

/* ─── interfaces ─── */

function dotClass(status: string): string {
    if (status.startsWith('up/up') && status.includes('STP')) return 'blocked';
    if (status.startsWith('up/up')) return 'up';
    if (status.includes('administratively')) return 'admin-down';
    return 'down';
}
function modeLabel(i: NetInterface): string {
    if (i.sviVlan) return `SVI ${i.sviVlan}`;
    if (i.mode === 'access') return `access ${i.accessVlan}`;
    if (i.mode === 'trunk') return `trunk`;
    return 'routed';
}
function subnetOf(i: NetInterface) {
    return i.ipv4 && isValidIPv4(i.ipv4) ? describeSubnet(i.ipv4, i.mask) : null;
}
function onIpChange(i: NetInterface) {
    if (i.ipv4 && !isValidIPv4(i.ipv4)) {
        store.toast('error', 'Invalid IPv4 address', `"${i.ipv4}" is not four octets between 0 and 255.`);
    }
    store.applyConfigChange();
}
function setTrunkVlans(i: NetInterface, raw: string) {
    i.trunkVlans = raw.split(',').flatMap(part => {
        const p = part.trim();
        if (!p) return [];
        if (p.includes('-')) {
            const [a, b] = p.split('-').map(Number);
            if (!a || !b || b < a) return [];
            return Array.from({ length: b - a + 1 }, (_, k) => a + k);
        }
        const n = Number(p);
        return n >= 1 && n <= 4094 ? [n] : [];
    });
    store.applyConfigChange();
}

/* ─── VLANs ─── */

function portsInVlan(id: number): string {
    return (device.value?.interfaces || [])
        .filter(i => i.mode === 'access' && (i.accessVlan || 1) === id)
        .map(i => i.short).join(', ');
}
function addVlanRow() {
    const d = device.value; if (!d) return;
    const next = Math.max(1, ...d.vlans.map(v => v.id)) + 9;
    addVlan(d, next, `VLAN${String(next).padStart(4, '0')}`);
    store.applyConfigChange(`VLAN ${next} created`);
}
function removeVlan(id: number) {
    const d = device.value; if (!d) return;
    d.vlans = d.vlans.filter(v => v.id !== id);
    d.interfaces.forEach(i => { if (i.accessVlan === id) i.accessVlan = 1; });
    store.applyConfigChange(`VLAN ${id} removed`);
}
const svis = computed(() => (device.value?.interfaces || []).filter(i => i.sviVlan));
function addSviRow() {
    const d = device.value; if (!d) return;
    const candidates = d.vlans.filter(v => !d.interfaces.some(i => i.sviVlan === v.id));
    const vlanId = candidates[0]?.id ?? (Math.max(1, ...d.vlans.map(v => v.id)) + 9);
    if (!d.vlans.some(v => v.id === vlanId)) addVlan(d, vlanId, `VLAN${vlanId}`);
    addSvi(d, vlanId, '', '255.255.255.0');
    store.applyConfigChange(`SVI for VLAN ${vlanId} created`);
}
function removeSvi(id: string) {
    const d = device.value; if (!d) return;
    d.interfaces = d.interfaces.filter(i => i.id !== id);
    store.applyConfigChange('SVI removed');
}

/* ─── routing ─── */

const routingTable = computed(() => (device.value ? store.sim.routingTable(device.value.id) : []));
function routeCode(s?: string) {
    return s === 'connected' ? 'C' : s === 'rip' ? 'R' : s === 'ospf' ? 'O' : s === 'default' ? 'S*' : 'S';
}
function exitName(id?: string) {
    const i = device.value?.interfaces.find(x => x.id === id);
    return i ? `, ${i.short}` : '';
}
function addRoute() {
    const d = device.value; if (!d) return;
    d.routing.staticRoutes.push({
        id: `rt-${Date.now().toString(36)}`, network: '', mask: '255.255.255.0', nextHop: '',
        metric: 1, adminDistance: 1, source: 'static',
    });
    store.markDirty();
}
function removeRoute(id: string) {
    const d = device.value; if (!d) return;
    d.routing.staticRoutes = d.routing.staticRoutes.filter(r => r.id !== id);
    store.applyConfigChange('Route removed');
}

/* ─── services ─── */

const leases = computed(() => device.value?.services.dhcp.leases || []);
function addPool() {
    const d = device.value; if (!d) return;
    d.services.dhcp.enabled = true;
    d.services.dhcp.pools.push({
        id: `pool-${Date.now().toString(36)}`, name: `POOL${d.services.dhcp.pools.length + 1}`,
        network: '', mask: '255.255.255.0', rangeStart: '', rangeEnd: '',
        gateway: '', dnsServer: '', domain: 'lab.local', leaseHours: 24, excluded: [],
    });
    store.markDirty();
}
function removePool(id: string) {
    const d = device.value; if (!d) return;
    d.services.dhcp.pools = d.services.dhcp.pools.filter(p => p.id !== id);
    store.applyConfigChange('Pool removed');
}
function addDnsRow() {
    const d = device.value; if (!d) return;
    d.services.dns.enabled = true;
    d.services.dns.records.push({ id: `rr-${Date.now().toString(36)}`, name: '', type: 'A', value: '', ttl: 300 });
    store.markDirty();
}
function removeDnsRow(id: string) {
    const d = device.value; if (!d) return;
    d.services.dns.records = d.services.dns.records.filter(r => r.id !== id);
    store.applyConfigChange('Record removed');
}

/* ─── security ─── */

function addAclRow() {
    const d = device.value; if (!d) return;
    const name = `ACL-${d.acls.length + 1}`;
    d.acls.push({ id: `acl-${Date.now().toString(36)}`, name, type: 'extended', rules: [] });
    store.applyConfigChange(`${name} created`);
}
function removeAcl(id: string) {
    const d = device.value; if (!d) return;
    const acl = d.acls.find(a => a.id === id);
    d.acls = d.acls.filter(a => a.id !== id);
    if (acl) d.interfaces.forEach(i => {
        if (i.aclIn === acl.name) i.aclIn = '';
        if (i.aclOut === acl.name) i.aclOut = '';
    });
    store.applyConfigChange('ACL removed');
}
function addAclRule(aclId: string) {
    const acl = device.value?.acls.find(a => a.id === aclId); if (!acl) return;
    acl.rules.push({
        id: `r-${Date.now().toString(36)}`, seq: (acl.rules.length + 1) * 10,
        action: 'permit', protocol: 'ip',
        srcAny: true, src: '', srcWildcard: '0.0.0.0',
        dstAny: true, dst: '', dstWildcard: '0.0.0.0', hits: 0,
    });
    store.markDirty();
}
function removeAclRule(aclId: string, ruleId: string) {
    const acl = device.value?.acls.find(a => a.id === aclId); if (!acl) return;
    acl.rules = acl.rules.filter(r => r.id !== ruleId);
    store.applyConfigChange();
}
function appliedWhere(name: string): string {
    const d = device.value; if (!d) return '';
    const spots = d.interfaces.flatMap(i => [
        ...(i.aclIn === name ? [`${i.short} in`] : []),
        ...(i.aclOut === name ? [`${i.short} out`] : []),
    ]);
    return spots.length ? `applied: ${spots.join(', ')}` : 'not applied to any interface';
}

/* ─── wireless ─── */

const associatedClients = computed(() => {
    const d = device.value; if (!d) return [];
    return store.sim.allLinks
        .filter(l => (l.cable === 'wireless' || l.cable === 'cellular') && (l.aDeviceId === d.id || l.bDeviceId === d.id))
        .map(l => {
            const otherId = l.aDeviceId === d.id ? l.bDeviceId : l.aDeviceId;
            const other = store.deviceById.get(otherId);
            return other ? `${other.hostname} — SSID "${l.label}"` : '';
        })
        .filter(Boolean);
});

const wifiWarning = computed(() => {
    const w = device.value?.wireless; if (!w) return '';
    if (w.security === 'wep') return 'WEP has been breakable in minutes since 2004. Move to WPA2-Personal at minimum.';
    if (w.security === 'open') return 'An open SSID means every frame is readable over the air by anyone in range.';
    if (w.band === '6GHz' && !w.security.startsWith('wpa3')) return '6 GHz mandates WPA3. WPA2-only clients cannot associate at all.';
    if (w.band === '2.4GHz' && ![1, 6, 11].includes(w.channel)) return `Channel ${w.channel} overlaps its neighbours. In 2.4 GHz only 1, 6 and 11 are non-overlapping.`;
    if (w.band === '2.4GHz' && w.channelWidthMHz > 20) return 'Wider than 20 MHz in 2.4 GHz leaves no clean channels at all. Use 20 MHz.';
    return '';
});

const wifiTip = computed(() => {
    const w = device.value?.wireless;
    if (!w) return '';
    if (w.band === '6GHz') return 'Clean spectrum and 160/320 MHz channels. A Wi-Fi 7 AP can exceed 5 Gbps, so give it a 2.5/5/10 GbE uplink or the cable becomes the bottleneck.';
    if (w.band === '5GHz') return 'Good balance of capacity and range. 40 or 80 MHz is usually the right choice; 160 MHz costs you channel reuse in a dense deployment.';
    return 'Best range, worst capacity. Keep it at 20 MHz on channel 1, 6 or 11 — and keep it enabled, because a lot of IoT is 2.4 GHz only.';
});

/* ─── tables ─── */

function portName(id: string): string {
    return device.value?.interfaces.find(i => i.id === id)?.short || id;
}
function clearMac() {
    if (device.value) { device.value.macTable = []; store.toast('info', 'MAC table cleared'); }
}
function clearArp() {
    if (device.value) { device.value.arpTable = []; store.toast('info', 'ARP cache cleared'); }
}
const runConfig = computed(() => (device.value ? runningConfig(device.value).join('\n') : ''));
async function copyConfig() {
    try {
        await navigator.clipboard.writeText(runConfig.value);
        store.toast('success', 'Configuration copied');
    } catch {
        store.toast('error', 'Could not copy to the clipboard');
    }
}

/* ─── link ─── */

const linkTitle = computed(() => {
    const l = link.value; if (!l) return '';
    const A = store.deviceById.get(l.aDeviceId);
    const B = store.deviceById.get(l.bDeviceId);
    const ai = A?.interfaces.find(i => i.id === l.aInterfaceId);
    const bi = B?.interfaces.find(i => i.id === l.bInterfaceId);
    return `${A?.hostname} ${ai?.short} ↔ ${B?.hostname} ${bi?.short}`;
});

const cableTeaching = computed(() => {
    const c = link.value?.cable;
    switch (c) {
        case 'serial-dce': return 'On a serial link one end is DCE and supplies the clock (clock rate 64000); the other is DTE and follows it. Miss the clock rate and the line stays down with no obvious error.';
        case 'serial-dte': return 'This is the DTE end — it takes its clock from the DCE side. Only one end sets the clock rate.';
        case 'fiber-single-mode': return 'Single-mode fibre carries a laser over kilometres. Immune to electrical noise, carries no power, and cannot be tapped without breaking the light path.';
        case 'fiber-multi-mode': return 'Multi-mode fibre is the in-building choice — a few hundred metres, cheaper optics. Use it between floors and closets.';
        case 'crossover': return 'A crossover swaps the transmit and receive pairs. Historically required between two similar devices; Auto-MDIX makes it unnecessary on modern ports.';
        case 'coaxial': return 'Coax is a shared medium: everyone in the neighbourhood contends for the same capacity. Evening slowdown is contention, not your Wi-Fi.';
        case 'wireless': return 'Radio is half-duplex and shared. Every client on the radio takes turns, so twenty clients do not each get the headline rate.';
        case 'cellular': return 'Cellular adds 20–40 ms of latency and usually puts you behind carrier-grade NAT, so inbound connections are impossible.';
        default: return 'Copper straight-through, the standard host-to-switch and switch-to-router cable. 100 m maximum at 1 Gbps; 10 Gbps needs Cat6a for that distance.';
    }
});
</script>
