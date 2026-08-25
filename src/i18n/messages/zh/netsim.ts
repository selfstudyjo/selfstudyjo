/**
 * The Network Simulator, its lessons and the Roblox studio — Chinese (Simplified).
 *
 * ============================================================
 * A CLI KEYWORD IS NOT A WORD
 * ============================================================
 *
 * The mirror of `../ar/netsim.ts`, and its header applies exactly: `permit`,
 * `deny`, `trunk`, `access`, `rstp`, `icmp`, `inside`, `full`, `half`,
 * `standard`, `extended` are literals a Cisco IOS command line accepts and
 * nothing else. Translated, a student reading the Chinese screen types the
 * Chinese word and the command is rejected — a worse outcome than the label
 * having stayed in English. They are on
 * `tools/i18n-check/untranslated.json` with that reason recorded, and the check
 * fails if one of them is ever also given a translation.
 *
 * What is translated is the prose around them, which is where the teaching is.
 *
 * Protocol NAMES (VLAN, ACL, ARP, MTU, DHCP) are left alone by the codemod's
 * `ATOMIC` list for a different reason: a Chinese networking textbook writes
 * them exactly that way.
 */

import type { Catalogue } from '../../index';

const netsim: Catalogue = {
    /* ---------------------------------------------------------------- *
     * The canvas and the palette
     * ---------------------------------------------------------------- */
    'Your canvas is empty': '画布是空的',
    'Drag a device from the palette on the left, load a template, or ask the AI to build a network for you.':
        '从左侧面板拖入一台设备、加载一个模板，或让 AI 为你搭一个网络。',
    'Drag onto the canvas, or click to drop it in the centre.': '拖到画布上，或点击直接放到中间。',
    'Click a device to configure it, or a cable to inspect the link.':
        '点击设备进行配置，或点击线缆查看链路。',
    'Click the second device to complete the cable — press': '点击第二台设备完成连线 —— 按',
    'to cancel': '取消',
    'Search 60+ devices…': '搜索 60 多种设备……',
    'Nothing selected': '未选中任何对象',
    'Start from a template': '从模板开始',
    'Load the starter topology': '加载入门拓扑',
    'Generate a topology': '生成拓扑',
    'Generate with AI': '用 AI 生成',
    'Build on canvas': '在画布上搭建',
    'Build': '搭建',
    'Fit': '适应',
    'Fit to view': '适应视图',
    'Browse…': '浏览……',
    'Browse the curriculum': '浏览课程大纲',
    'Label': '标签',
    'Notes': '备注',
    'devices': '台设备',
    'devices ·': '台设备 ·',
    'links': '条链路',
    'links ready to build': '条链路可以搭建',
    'hosts': '台主机',
    'Recalculate': '重新计算',
    'Run "Recalculate" after cabling some devices together.': '连好几台设备之后运行“重新计算”。',

    /* ---------------------------------------------------------------- *
     * Interfaces and addressing
     * ---------------------------------------------------------------- */
    'About this device': '关于此设备',
    'Interface': '接口',
    'Interface enabled (no shutdown)': '接口已启用（no shutdown）',
    'IPv4 address': 'IPv4 地址',
    'IPv6 address': 'IPv6 地址',
    'IPv6 prefix': 'IPv6 前缀',
    'Subnet mask': '子网掩码',
    'Default gateway': '默认网关',
    'Default route / gateway of last resort': '默认路由 / 最后网关',
    'Address': '地址',
    'Obtain address by DHCP': '通过 DHCP 获取地址',
    'Use DHCP for addressing': '使用 DHCP 分配地址',
    'Cable type': '线缆类型',
    'Cabled ports': '已连线端口',
    'Port': '端口',
    'Duplex': '双工模式',
    'speed': '速率',
    'Bandwidth (Mbps)': '带宽（Mbps）',
    'Latency': '延迟',
    'Frame size': '帧大小',
    'errors': '错误',
    'Value': '值',
    'Host': '主机',
    'Source': '源',
    'Destination': '目的',
    'Via': '经由',
    'Previous hop': '上一跳',
    'Action': '动作',
    'Hits': '命中次数',
    'Reachable addresses': '可达地址',
    'Empty — address and enable the interfaces first.': '为空 —— 请先为接口配置地址并启用。',
    '{v0} usable · {v1}': '{v0} 个可用 · {v1}',
    '{v0} · Layer {v1} · {v2}': '{v0} · 第 {v1} 层 · {v2}',
    '{v0} · priority {v1}': '{v0} · 优先级 {v1}',
    '{v0} · {v1} · {v2} · MAC {v3}': '{v0} · {v1} · {v2} · MAC {v3}',
    'rx {v0} frames / {v1} B · tx {v2} frames / {v3} B · drops {v4}':
        '接收 {v0} 帧 / {v1} 字节 · 发送 {v2} 帧 / {v3} 字节 · 丢弃 {v4}',
    '· {v0} bits': '· {v0} 位',
    'Layers {v0}': '第 {v0} 层',
    'hop {v0} / {v1}': '第 {v0} 跳，共 {v1} 跳',

    /* ---------------------------------------------------------------- *
     * VLANs and switching
     * ---------------------------------------------------------------- */
    'VLANs': 'VLAN',
    'VLAN {v0}': 'VLAN {v0}',
    'VLAN database': 'VLAN 数据库',
    'VLANs in this topology': '此拓扑中的 VLAN',
    'VLAN tag': 'VLAN 标签',
    'Add VLAN': '添加 VLAN',
    'Delete VLAN': '删除 VLAN',
    'Access VLAN': '接入 VLAN',
    'Native VLAN': '本征 VLAN',
    'Mapped VLAN': '映射的 VLAN',
    'Allowed VLANs (blank = all)': '允许的 VLAN（留空表示全部）',
    'Access ports': '接入端口',
    'Switchport mode': '交换端口模式',
    'Add SVI': '添加 SVI',
    'SVIs (inter-VLAN routing)': 'SVI（VLAN 间路由）',
    'No SVIs yet. Each VLAN needs one to be routable.': '还没有 SVI。每个 VLAN 都需要一个才能被路由。',
    'MAC address table': 'MAC 地址表',
    'Empty — a switch only learns from frames it receives.': '为空 —— 交换机只能从收到的帧中学习。',
    'ARP cache': 'ARP 缓存',
    'Empty — ARP is populated on demand, when traffic needs it.':
        '为空 —— ARP 是按需建立的，只有流量需要时才会填充。',
    '{v0} devices share this domain': '{v0} 台设备共享此域',
    'A broadcast domain is the set of devices that receive each other\'s broadcast frames. A switch does not split them — only a VLAN boundary or a router does.':
        '广播域是指能互相收到广播帧的那一组设备。交换机不会分隔广播域 —— 只有 VLAN 边界或路由器才会。',

    /* ---------------------------------------------------------------- *
     * Spanning tree
     * ---------------------------------------------------------------- */
    'Spanning tree': '生成树',
    'Spanning tree enabled': '已启用生成树',
    'Bridge priority': '网桥优先级',
    '· STP {v0}': '· STP {v0}',
    'Lowest priority wins the root election; the MAC address breaks ties. Set this deliberately on the switch you want as root — leaving every switch at 32768 means the oldest box wins by accident.':
        '优先级最低的交换机赢得根桥选举，相同时由 MAC 地址决定。请在你希望作为根桥的交换机上明确设置这个值 —— 如果所有交换机都保持 32768，最终是最老的那台机器碰巧当上根桥。',

    /* ---------------------------------------------------------------- *
     * Routing
     * ---------------------------------------------------------------- */
    'Static routes': '静态路由',
    'Dynamic routing': '动态路由',
    'Add route': '添加路由',
    'Routing table (live)': '路由表（实时）',
    'None. A router only knows its connected networks until you add routes.':
        '无。在你添加路由之前，路由器只知道自己直连的网络。',
    'Router ID': '路由器 ID',
    'Process ID': '进程 ID',
    'RIP version': 'RIP 版本',
    'Traceroute': '路由跟踪',
    'trace': '跟踪',

    /* ---------------------------------------------------------------- *
     * ACLs and NAT
     * ---------------------------------------------------------------- */
    'Access control lists': '访问控制列表',
    'New ACL': '新建 ACL',
    'Add rule': '添加规则',
    'ACL inbound': '入方向 ACL',
    'ACL outbound': '出方向 ACL',
    'No ACLs. Create one, add rules, then apply it to an interface on the Interfaces tab.':
        '还没有 ACL。先创建一个、添加规则，然后在“接口”标签页把它应用到某个接口上。',
    'implicit deny any — every ACL ends with this': '隐含的 deny any —— 每个 ACL 末尾都有这一条',
    'NAT enabled': '已启用 NAT',
    'NAT role': 'NAT 角色',
    'Inside global': '内部全局',
    'Inside local': '内部本地',
    'Outside': '外部',
    'Outside address': '外部地址',
    'Mark interfaces as NAT inside / outside on the Interfaces tab, or nothing is translated.':
        '请在“接口”标签页把接口标记为 NAT inside / outside，否则不会有任何地址被转换。',

    /* ---------------------------------------------------------------- *
     * Services
     * ---------------------------------------------------------------- */
    'Address pools': '地址池',
    'Add pool': '添加地址池',
    'Active leases': '活动租约',
    'Lease (hours)': '租期（小时）',
    'Range start': '起始地址',
    'Range end': '结束地址',
    'dynamic pool': '动态地址池',
    'DNS server': 'DNS 服务器',
    'Authoritative records': '权威记录',
    'Add record': '添加记录',
    'Domains': '域名',
    'No records. Without one, clients get NXDOMAIN.': '没有记录。缺少记录时，客户端会收到 NXDOMAIN。',
    'HTTP server (port {v0})': 'HTTP 服务器（端口 {v0}）',
    'Also serve HTTPS (443)': '同时提供 HTTPS（443）',
    'Page title': '页面标题',
    'Page body (HTML)': '页面内容（HTML）',

    /* ---------------------------------------------------------------- *
     * Wireless
     * ---------------------------------------------------------------- */
    'Band': '频段',
    'Channel': '信道',
    'Channel width (MHz)': '信道宽度（MHz）',
    'Passphrase': '密码',
    'Security': '安全',
    'Guest SSID (optional)': '访客 SSID（可选）',
    'Join SSID': '加入 SSID',
    'Associated clients ({v0})': '已关联的客户端（{v0}）',
    'matches the AP exactly': '与 AP 完全一致',
    'None. A client associates when its wireless interface has the same SSID and passphrase.':
        '无。当客户端的无线接口配置了相同的 SSID 和密码时才会关联上。',
    'Hide the SSID (security theatre — it does not stop anyone)':
        '隐藏 SSID（只是安全上的表面功夫 —— 挡不住任何人）',

    /* ---------------------------------------------------------------- *
     * The simulation, the packet inspector and the event log
     * ---------------------------------------------------------------- */
    'Ping': 'Ping',
    'Ping…': 'Ping……',
    'Target (IP or name)': '目标（IP 或名称）',
    'Commands': '命令',
    'Reachability matrix': '连通性矩阵',
    'Every addressed host pinged against every other, one packet each. Green means both directions work.':
        '每台已配置地址的主机都会向其他每一台各发一个包。绿色表示两个方向都通。',
    'Run a ping, request DHCP, resolve a name or fetch a page. Every hop is captured with its real headers, so you can watch the encapsulation change layer by layer.':
        '执行 ping、请求 DHCP、解析域名或抓取网页。每一跳都会连同真实报头一起被捕获，你可以逐层观察封装的变化。',
    'No packet captured yet': '还没有捕获到数据包',
    'Open this packet trace': '打开此数据包跟踪',
    'Protocol stack': '协议栈',
    'Encapsulation — top of the stack is the application, bottom is bits on the medium':
        '封装 —— 栈顶是应用层，栈底是介质上的比特',
    'Event log': '事件日志',
    'No events yet. Run the simulation, ping between two hosts, or request DHCP on a client.':
        '还没有事件。运行模拟、在两台主机之间 ping，或在客户端上请求 DHCP。',
    'Running configuration': '当前运行配置',
    'Copy the whole session': '复制整个会话',
    'Clear the screen': '清屏',
    'Clear the conversation': '清空对话',

    /* ---------------------------------------------------------------- *
     * Checking a design, and the diagnostics
     * ---------------------------------------------------------------- */
    'Check my work': '检查我的作业',
    'Re-check': '重新检查',
    'Design review': '设计评审',
    'Issues on this device': '此设备上的问题',
    'Nothing wrong': '没有问题',
    'Problem:': '问题：',
    'Why this matters:': '为什么这很重要：',
    'Remember:': '记住：',
    'Fix': '修正',
    'Fix: {v0}': '修正：{v0}',
    'Hint: {v0}': '提示：{v0}',
    'Next: {v0}': '下一步：{v0}',
    '{v0} match{v1}': '{v0} 条匹配',
    'Addressing, cabling, VLANs, routing and services all check out. Run a ping to confirm end-to-end behaviour.':
        '地址、连线、VLAN、路由和服务都没有问题。运行一次 ping 来确认端到端是否通。',
    'the gateway {v0} is not inside any of this host\'s own subnets. A host cannot even ARP for an address outside its subnet — this is nearly always a wrong subnet mask.':
        '网关 {v0} 不在这台主机所属的任何子网内。主机连子网外的地址都无法发 ARP —— 这几乎总是子网掩码写错了。',
    'a host compares the destination against its own address using the mask. Same network → ARP directly. Different network → send the frame to the gateway\'s MAC while the IP header still targets the final destination.':
        '主机会用掩码把目的地址和自己的地址做比较。同一网络 → 直接发 ARP。不同网络 → 把帧发给网关的 MAC，而 IP 报头仍然指向最终目的地。',

    /* ---------------------------------------------------------------- *
     * The AI tutor
     * ---------------------------------------------------------------- */
    'AI Network Tutor': 'AI 网络导师',
    'Tutor': '导师',
    'Teach': '讲解',
    'Explain and teach': '讲解与教学',
    'Troubleshoot a symptom': '排查故障现象',
    'Ask anything about networking': '任何网络问题都可以问',
    '— I can see every device, address, VLAN, route and ACL on your canvas, plus the last simulation run.':
        '—— 我能看到你画布上的每一台设备、地址、VLAN、路由和 ACL，以及最近一次模拟运行的结果。',
    '“Build me a campus network with redundant uplinks.”': '“帮我搭一个带冗余上行链路的园区网。”',
    '“Explain what my trunk is actually doing, using my devices.”':
        '“用我的设备来讲讲我这个 trunk 实际在做什么。”',
    '“Review my design like a senior engineer would.”': '“像资深工程师那样评审一下我的设计。”',
    '“Why can PC-A not reach the server?”': '“为什么 PC-A 访问不到服务器？”',
    'choose a device…': '选择一台设备……',

    /* ---------------------------------------------------------------- *
     * The lesson panel and the Learn hub
     * ---------------------------------------------------------------- */
    'Tasks': '任务',
    'Tests': '测试',
    'Theory': '理论',
    'Quiz': '小测',
    'Standard': '标准',
    'Pro': '进阶',
    'Lesson complete': '本课完成',
    'No lesson attached': '未关联课程',
    'Pick a lesson from the Learn hub and the studio will check your work against the live network as you build it.':
        '从学习中心挑一节课，工作台会在你搭建的过程中，对照实际运行的网络来检查你的作业。',
    'Every task was verified against your running network — not a multiple-choice answer.':
        '每个任务都是对照你实际运行的网络验证的 —— 不是靠选择题。',
    '{v0} lessons across {v1} tracks, roughly {v2} hours of work. Every task is checked against your live simulated network — not against a multiple-choice answer.':
        '{v1} 条学习路径共 {v0} 节课，约 {v2} 小时的学习量。每个任务都是对照你实际运行的模拟网络检查的 —— 不是靠选择题。',
    '← Network Simulator': '← 网络模拟器',
};

export default netsim;
