/**
 * The twelve enterprise consoles of SRE labs 19-30, as DATA.
 *
 * One component (EnterpriseConsole.vue) draws all of them: the product's
 * chrome and colour, its live inventory pages (read from `view.ent.<subsystem>`,
 * which app 11 computes from the same state the Ops Console changes), its
 * FORMS, and the lab's guided steps (guided.json, generated from the task
 * cards by `_sre/build_ent_actions.py`).
 *
 * Every form builds the exact line the Ops Console accepts - with `cli()`, so
 * a value with a space stays one argument - and shows it in the "Equivalent
 * CLI commands" strip. Nothing here talks to a network; the host runs the line
 * through app 11 like every other portal.
 */
import { cli } from '@/utils/portalKit';

export interface FormField {
    key: string;
    label: string;
    value?: string;
    options?: string[];
    area?: boolean;          // a multi-line box (SQL, a script, a query)
    check?: boolean;         // a checkbox; value 'true' / ''
}

export interface ProductForm {
    title: string;
    hint?: string;
    fields: FormField[];
    run: string;             // the button label
    build: (v: Record<string, string>) => string;
}

export interface Product {
    name: string;
    vendor: string;
    color: string;           // the product's own accent (header bar)
    location: string;
    subsystems: string[];    // which view.ent.<name> pages it shows
    forms: ProductForm[];
}

/** A PowerShell single-quoted string: nothing inside is special but ''. */
export function psq(value: string): string {
    const text = String(value ?? '');
    if (/^[\w.@\\/:,*$-]+$/.test(text)) return text;
    return "'" + text.replace(/'/g, "''") + "'";
}

/** A cmdlet run in the workstation's PowerShell 7 (AD, Graph, Exchange Online). */
export function pwsh(script: string): string {
    return ['pwsh', '-Command', '"' + script + '"'].join(' ');
}

/** A one-shot command on a server (Linux, Windows over OpenSSH, FortiOS). */
export function onHost(host: string, command: string): string {
    return ['ssh', host, command].join(' ');
}

/** A FortiOS double-quoted value. */
function fq(value: string): string {
    return '"' + String(value ?? '').replace(/"/g, '') + '"';
}

const yes = (v: string) => v === 'true';

export const PRODUCTS: Record<string, Product> = {
    cloudctl: {
        name: 'Cloud Control', vendor: 'Terraform · AWS · Azure · OCI', color: '#5c4ee5',
        location: 'https://cloudctl.shopfront.internal/workspaces/hybrid',
        subsystems: ['iac'],
        forms: [
            { title: 'Terraform run', run: 'Queue run',
              hint: 'init → validate → plan → apply. A plan that wants to destroy something is a stop sign.',
              fields: [{ key: 'dir', label: 'Working directory', value: 'hybrid' },
                       { key: 'op', label: 'Operation', value: 'plan', options: ['init', 'validate', 'plan', 'apply'] }],
              build: v => cli(['terraform', '-chdir=' + v.dir, v.op], { '-auto-approve': v.op === 'apply' }) },
            { title: 'CloudFormation stack', run: 'Run',
              fields: [{ key: 'op', label: 'Action', value: 'describe-stack-events',
                         options: ['validate-template', 'deploy', 'describe-stack-events', 'delete-stack'] },
                       { key: 'stack', label: 'Stack name', value: 'shop-dr-net' },
                       { key: 'tpl', label: 'Template file', value: 'cfn/dr-network.yaml' },
                       { key: 'iam', label: 'Acknowledge CAPABILITY_NAMED_IAM', value: 'true', check: true }],
              build: v => v.op === 'validate-template'
                  ? cli(['aws', 'cloudformation', 'validate-template'], { '--template-body': 'file://' + v.tpl })
                  : v.op === 'deploy'
                      ? cli(['aws', 'cloudformation', 'deploy'], { '--stack-name': v.stack, '--template-file': v.tpl,
                                                                   '--capabilities': yes(v.iam) ? 'CAPABILITY_NAMED_IAM' : '' })
                      : cli(['aws', 'cloudformation', v.op], { '--stack-name': v.stack }) },
            { title: 'Azure deployment (Bicep)', run: 'Run',
              fields: [{ key: 'op', label: 'Action', value: 'what-if', options: ['what-if', 'create'] },
                       { key: 'rg', label: 'Resource group', value: 'rg-shop-prod' },
                       { key: 'file', label: 'Template', value: 'bicep/storage.bicep' },
                       { key: 'name', label: 'Deployment name', value: 'storage-01' }],
              build: v => cli(['az', 'deployment', 'group', v.op], { '-g': v.rg, '-f': v.file, '-n': v.op === 'create' ? v.name : '' }) },
            { title: 'OCI', run: 'List', fields: [{ key: 'what', label: 'Show', value: 'compartments', options: ['compartments', 'vcns'] },
                                                   { key: 'cid', label: 'Compartment OCID (for VCNs)', value: 'ocid1.compartment.oc1..aaaaaaaashopprod7xq2' }],
              build: v => v.what === 'vcns' ? cli(['oci', 'network', 'vcn', 'list'], { '--compartment-id': v.cid })
                                            : cli(['oci', 'iam', 'compartment', 'list']) },
        ],
    },
    updatemgr: {
        name: 'Update Manager', vendor: 'RHEL · Windows Server · Defender · ALB', color: '#0f7b6c',
        location: 'https://updates.shopfront.internal/patching/ring-prod',
        subsystems: ['servers'],
        forms: [
            { title: 'Load balancer target', run: 'Apply', hint: 'Drain a server before patching it; put it back only when it is healthy.',
              fields: [{ key: 'op', label: 'Action', value: 'describe-target-health',
                         options: ['describe-target-health', 'deregister-targets', 'register-targets'] },
                       { key: 'tg', label: 'Target group', value: 'tg-web', options: ['tg-web', 'tg-app'] },
                       { key: 'id', label: 'Target', value: 'rhel-web1', options: ['rhel-web1', 'rhel-web2', 'win-app1', 'win-app2'] }],
              build: v => cli(['aws', 'elbv2', v.op], { '--target-group-arn': v.tg,
                                                        '--targets': v.op === 'describe-target-health' ? '' : 'Id=' + v.id }) },
            { title: 'Linux (RHEL) host', run: 'Run on host',
              fields: [{ key: 'host', label: 'Host', value: 'rhel-web1', options: ['rhel-web1', 'rhel-web2'] },
                       { key: 'op', label: 'Action', value: 'sudo dnf updateinfo summary',
                         options: ['sudo dnf updateinfo summary', 'sudo dnf updateinfo list --security', 'sudo dnf upgrade --security -y',
                                   'needs-restarting -r', 'sudo reboot', 'uname -r', 'sudo setenforce 1',
                                   'sudo systemctl enable --now firewalld', 'sudo firewall-offline-cmd --add-service=https'] }],
              build: v => onHost(v.host, v.op) },
            { title: 'Windows Server host', run: 'Run on host',
              fields: [{ key: 'host', label: 'Host', value: 'win-app1', options: ['win-app1', 'win-app2'] },
                       { key: 'op', label: 'Action', value: 'Get-WindowsUpdate',
                         options: ['Get-WindowsUpdate', "Install-WindowsUpdate -Category 'Security Updates' -AcceptAll -IgnoreReboot",
                                   'Restart-Computer -Force', 'Get-HotFix -Id KB5049012', 'Get-MpComputerStatus',
                                   'Update-MpSignature', 'Set-MpPreference -DisableRealtimeMonitoring $false',
                                   'Get-NetFirewallProfile', 'Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True'] }],
              build: v => onHost(v.host, v.op) },
        ],
    },
    vsphere: {
        name: 'vSphere Client', vendor: 'VMware vCenter · Hyper-V · S2D', color: '#1d428a',
        location: 'https://vcenter.shopfront.local/ui/app/cluster;nav=h/urn:vmomi:ClusterComputeResource:domain-c8/summary',
        subsystems: ['virt'],
        forms: [
            { title: 'Cluster settings', run: 'Save', fields: [
                { key: 'ha', label: 'vSphere HA', value: 'true', check: true },
                { key: 'drs', label: 'vSphere DRS', value: 'true', check: true },
                { key: 'mode', label: 'DRS automation', value: 'fullyAutomated', options: ['manual', 'partiallyAutomated', 'fullyAutomated'] }],
              build: v => cli(['govc', 'cluster.change'], { '-ha-enabled': yes(v.ha), '-drs-enabled': yes(v.drs),
                                                         '-drs-mode': yes(v.drs) ? v.mode : '' }) + ' /DC-Amman/host/Prod-Cluster' },
            { title: 'Host', run: 'Run', fields: [
                { key: 'host', label: 'ESXi host', value: 'esx-02', options: ['esx-01', 'esx-02', 'esx-03'] },
                { key: 'op', label: 'Action', value: 'host.info', options: ['host.info', 'host.maintenance.enter', 'host.maintenance.exit'] }],
              build: v => cli(['govc', v.op, v.host]) },
            { title: 'Migrate VM (vMotion)', run: 'Migrate', fields: [
                { key: 'vm', label: 'VM', value: 'jump-01' }, { key: 'host', label: 'Target host', value: 'esx-03' },
                { key: 'ds', label: 'Datastore', value: 'vsanDatastore' }],
              build: v => cli(['govc', 'vm.migrate'], { '-host': v.host, '-ds': v.ds }) + ' ' + cli([v.vm]) },
            { title: 'Snapshots', run: 'Run', fields: [
                { key: 'op', label: 'Action', value: 'snapshot.tree', options: ['snapshot.tree', 'snapshot.create', 'snapshot.remove'] },
                { key: 'vm', label: 'VM', value: 'sql-01' }, { key: 'name', label: 'Snapshot name', value: 'pre-patch-2026-11' }],
              build: v => cli(['govc', v.op], { '-vm': v.vm }) + (v.op === 'snapshot.tree' ? '' : ' ' + cli([v.name])) },
            { title: 'Hyper-V / Storage Spaces Direct (hv-01)', run: 'Run on hv-01', fields: [
                { key: 'op', label: 'Cmdlet', value: 'Get-VM', options: ['Get-VM', 'Get-StoragePool', 'Get-VirtualDisk',
                    'Set-VMReplicationServer -ComputerName hv-dr01 -ReplicationEnabled $true -AllowedAuthenticationType Kerberos -ReplicationAllowedFromAnyServer',
                    'Enable-VMReplication -VMName file-01 -ReplicaServerName hv-dr01 -ReplicaServerPort 80 -AuthenticationType Kerberos',
                    'Start-VMInitialReplication -VMName file-01', 'Measure-VMReplication -VMName file-01',
                    'New-Volume -StoragePoolFriendlyName S2D* -FriendlyName vol-sql -FileSystem CSVFS_ReFS -ResiliencySettingName Mirror -Size 500GB'] }],
              build: v => onHost('hv-01', v.op) },
        ],
    },
    devops: {
        name: 'Pipelines', vendor: 'GitHub Actions · Azure DevOps · ACR · AKS', color: '#24292f',
        location: 'https://github.com/shopfront/shopapi/actions',
        subsystems: ['cicd'],
        forms: [
            { title: 'GitHub Actions', run: 'Run', fields: [
                { key: 'op', label: 'Action', value: 'run list', options: ['workflow run', 'run list', 'run view --log-failed', 'run rerun --failed'] },
                { key: 'wf', label: 'Workflow file', value: 'ci.yml' }],
              build: v => v.op === 'workflow run' ? cli(['gh', 'workflow', 'run', v.wf]) : ['gh', v.op].join(' ') },
            { title: 'Azure Pipelines', run: 'Run', fields: [
                { key: 'op', label: 'Action', value: 'run', options: ['run', 'runs list', 'runs show'] },
                { key: 'name', label: 'Pipeline', value: 'shop-cd' }, { key: 'branch', label: 'Branch', value: 'main' },
                { key: 'id', label: 'Run id', value: '241' }],
              build: v => v.op === 'run' ? cli(['az', 'pipelines', 'run'], { '--name': v.name, '--branch': v.branch })
                  : v.op === 'runs show' ? cli(['az', 'pipelines', 'runs', 'show'], { '--id': v.id })
                      : cli(['az', 'pipelines', 'runs', 'list']) },
            { title: 'Approve the production stage', run: 'Approve', hint: 'Sends approve.json (from the Files tool) to the approvals API.',
              fields: [{ key: 'body', label: 'Body file', value: 'approve.json' }],
              build: v => cli(['az', 'rest'], { '--method': 'patch',
                  '--uri': 'https://dev.azure.com/shopfront/shop/_apis/pipelines/approvals?api-version=7.1-preview.1', '--body': '@' + v.body }) },
            { title: 'AKS', run: 'Run', fields: [
                { key: 'op', label: 'Action', value: 'kubectl get deploy -n production',
                  options: ['az aks get-credentials --resource-group rg-shop-prod --name aks-shop', 'kubectl get deploy -n production',
                            'kubectl rollout status deployment/shopapi -n production',
                            'az acr repository show-tags --name acrshopprod --repository shopapi --output table'] }],
              build: v => v.op },
        ],
    },
    awx: {
        name: 'Ansible Automation Platform', vendor: 'AWX · Event-Driven Ansible', color: '#c9190b',
        location: 'https://awx.shopfront.internal/#/templates',
        subsystems: ['auto'],
        forms: [
            { title: 'Job template: playbook', run: 'Launch', fields: [
                { key: 'pb', label: 'Playbook', value: 'ansible/site.yml' }, { key: 'inv', label: 'Inventory', value: 'ansible/inventory.ini' },
                { key: 'check', label: 'Check mode (--check --diff)', value: '', check: true }, { key: 'limit', label: 'Limit', value: '' }],
              build: v => cli(['ansible-playbook', '-i', v.inv, v.pb], { '--check': yes(v.check), '--diff': yes(v.check), '--limit': v.limit }) },
            { title: 'Ad-hoc command', run: 'Run', fields: [
                { key: 'pattern', label: 'Hosts', value: 'all' }, { key: 'module', label: 'Module', value: 'ping' },
                { key: 'args', label: 'Arguments', value: '' }, { key: 'become', label: 'Privilege escalation (-b)', value: '', check: true }],
              build: v => cli(['ansible', v.pattern, '-i', 'ansible/inventory.ini'], { '-m': v.module, '-a': v.args, '-b': yes(v.become) }) },
            { title: 'Inventory & rulebook', run: 'Run', fields: [
                { key: 'op', label: 'Action', value: 'ansible-inventory -i scripts/cmdb_inventory.py --graph',
                  options: ['ansible-inventory -i scripts/cmdb_inventory.py --graph', 'ansible-rulebook -i ansible/inventory.ini -r ansible/rulebook.yml',
                            'ssh app-03 sudo systemctl stop shopapi', 'ssh app-03 systemctl status shopapi'] }],
              build: v => v.op },
        ],
    },
    dbconsole: {
        name: 'Database Console', vendor: 'MySQL 8 · PostgreSQL 16', color: '#00618a',
        location: 'https://dbconsole.shopfront.internal/query',
        subsystems: ['db'],
        forms: [
            { title: 'Query editor', run: 'Execute', hint: 'EXPLAIN before you index; CREATE INDEX CONCURRENTLY on a busy PostgreSQL table.',
              fields: [{ key: 'engine', label: 'Connection', value: 'MySQL db-mysql1/orders', options: ['MySQL db-mysql1/orders', 'PostgreSQL db-1/shop'] },
                       { key: 'sql', label: 'SQL', value: 'SHOW FULL PROCESSLIST', area: true }],
              build: v => v.engine.startsWith('MySQL')
                  ? cli(['mysql', '-h', 'db-mysql1', '-u', 'admin', 'orders'], { '-e': v.sql.replace(/\s+/g, ' ').trim() })
                  : cli(['psql', '-h', 'db-1', '-U', 'postgres', '-d', 'shop'], { '-c': v.sql.replace(/\s+/g, ' ').trim() }) },
            { title: 'Backup', run: 'Back up', fields: [
                { key: 'engine', label: 'Database', value: 'PostgreSQL shop', options: ['PostgreSQL shop', 'MySQL orders'] },
                { key: 'file', label: 'File', value: 'backups/shop-2026-11-15.dump' }],
              build: v => v.engine.startsWith('MySQL')
                  ? cli(['mysqldump', '-h', 'db-mysql1', '-u', 'admin', '--single-transaction', '--routines', '--triggers', 'orders', '--result-file=' + v.file])
                  : cli(['pg_dump', '-h', 'db-1', '-U', 'postgres', '-Fc', '-d', 'shop', '-f', v.file]) },
            { title: 'Restore (PostgreSQL)', run: 'Restore', fields: [
                { key: 'file', label: 'Dump', value: 'backups/shop-2026-11-14.dump' }, { key: 'table', label: 'Only table (data only)', value: 'refunds' },
                { key: 'list', label: 'Just list the contents', value: '', check: true }],
              build: v => yes(v.list) ? cli(['pg_restore', '--list', v.file])
                  : cli(['pg_restore', '-h', 'db-1', '-U', 'postgres', '-d', 'shop'], { '--data-only': Boolean(v.table), '-t': v.table }) + ' ' + cli([v.file]) },
        ],
    },
    fortigate: {
        name: 'FortiGate', vendor: 'FGT200F · FortiOS 7.4', color: '#da291c',
        location: 'https://fw-1.shopfront.local/ng/firewall/policy/policy/standard',
        subsystems: ['forti'],
        forms: [
            { title: 'New IPv4 policy', run: 'OK', hint: 'Order matters: the first policy that matches decides.',
              fields: [{ key: 'name', label: 'Name', value: 'wms-to-db' }, { key: 'src', label: 'Incoming interface', value: 'vlan40' },
                       { key: 'dst', label: 'Outgoing interface', value: 'vlan10' }, { key: 'saddr', label: 'Source', value: 'all' },
                       { key: 'daddr', label: 'Destination', value: 'all' }, { key: 'svc', label: 'Service', value: 'HTTPS' },
                       { key: 'action', label: 'Action', value: 'accept', options: ['accept', 'deny'] },
                       { key: 'nat', label: 'NAT', value: '', check: true }],
              build: v => onHost('fw-1', ['config firewall policy', 'edit 0', 'set name ' + fq(v.name), 'set srcintf ' + fq(v.src),
                  'set dstintf ' + fq(v.dst), 'set srcaddr ' + fq(v.saddr), 'set dstaddr ' + fq(v.daddr), 'set action ' + v.action,
                  'set schedule "always"', 'set service ' + fq(v.svc), 'set logtraffic all', yes(v.nat) ? 'set nat enable' : '',
                  'next', 'end'].filter(Boolean).join('\n')) },
            { title: 'Address object', run: 'OK', fields: [{ key: 'name', label: 'Name', value: 'wms-db' },
                { key: 'subnet', label: 'IP/Netmask', value: '10.10.0.30 255.255.255.255' }],
              build: v => onHost('fw-1', ['config firewall address', 'edit ' + fq(v.name), 'set subnet ' + v.subnet, 'next', 'end'].join('\n')) },
            { title: 'CLI console', run: 'Run script', hint: 'FortiOS CLI. A config block must end with "end".',
              fields: [{ key: 'script', label: 'Script', value: 'get system status', area: true }],
              build: v => onHost('fw-1', v.script.trim()) },
            { title: 'Diagnostics', run: 'Run', fields: [{ key: 'op', label: 'Command', value: 'execute dhcp lease-list',
                options: ['execute dhcp lease-list', 'get router info routing-table all', 'get vpn ipsec tunnel summary', 'diagnose vpn ike gateway list',
                          'diagnose vpn tunnel up to-azure', 'execute ping app.azure.shopfront.internal', 'show firewall policy'] }],
              build: v => onHost('fw-1', v.op) },
        ],
    },
    observe: {
        name: 'Observability', vendor: 'CloudWatch · Elastic · Datadog · Azure Monitor', color: '#ff9900',
        location: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#alarmsV2:',
        subsystems: ['observe'],
        forms: [
            { title: 'CloudWatch alarm', run: 'Create alarm', fields: [
                { key: 'name', label: 'Alarm name', value: 'shop-alb-5xx' }, { key: 'threshold', label: 'Threshold (count / 60 s)', value: '50' },
                { key: 'periods', label: 'Datapoints to alarm', value: '3' }],
              build: v => cli(['aws', 'cloudwatch', 'put-metric-alarm'], { '--alarm-name': v.name, '--namespace': 'AWS/ApplicationELB',
                  '--metric-name': 'HTTPCode_Target_5XX_Count', '--dimensions': 'Name=LoadBalancer,Value=app/shop-alb/7a3c9e1b2d4f5a60',
                  '--statistic': 'Sum', '--period': '60', '--evaluation-periods': v.periods, '--threshold': v.threshold,
                  '--comparison-operator': 'GreaterThanThreshold', '--treat-missing-data': 'notBreaching',
                  '--alarm-actions': 'arn:aws:sns:eu-west-1:123456789012:oncall-pagerduty' }) },
            { title: 'Logs Insights', run: 'Run query', hint: 'Starts the query; read it with "get-query-results" below.',
              fields: [{ key: 'group', label: 'Log group', value: '/shop/checkout' },
                       { key: 'q', label: 'Query', area: true, value: 'fields @timestamp, status | filter status >= 500 | stats count() as errors by bin(5m)' }],
              build: v => cli(['aws', 'logs', 'start-query'], { '--log-group-name': v.group, '--start-time': '1763204400', '--end-time': '1763208000',
                                                               '--query-string': v.q.replace(/\s+/g, ' ').trim() }) },
            { title: 'Logs Insights results', run: 'Get results', fields: [{ key: 'id', label: 'Query id', value: '9c1e0001-3f2a-4b8e-a1c6-5d0b7e2f0001' }],
              build: v => cli(['aws', 'logs', 'get-query-results'], { '--query-id': v.id }) },
            { title: 'Kibana search', run: 'Search', fields: [{ key: 'q', label: 'Lucene query', value: 'status:>=500' }],
              build: v => cli(['curl', '-s', 'http://elk-1:9200/shop-logs-*/_search?q=' + encodeURIComponent(v.q)]) },
            { title: 'Log Analytics (KQL)', run: 'Run', fields: [{ key: 'q', label: 'KQL', area: true,
                value: 'AppRequests | where Success == false | summarize Failed = count() by OperationName' }],
              build: v => cli(['az', 'monitor', 'log-analytics', 'query'], { '-w': 'law-shop-prod', '--analytics-query': v.q.replace(/\s+/g, ' ').trim() }) },
            { title: 'Datadog monitors', run: 'Show all', fields: [], build: () => cli(['dog', 'monitor', 'show_all']) },
        ],
    },
    itsm: {
        name: 'Service Operations', vendor: 'ITSM · Incident · Problem · Change', color: '#293e40',
        location: 'https://shopfront.service-now.com/now/sow/list/params/list-id/incident',
        subsystems: ['itsm'],
        forms: [
            { title: 'Queue', run: 'Refresh', fields: [{ key: 'group', label: 'Assignment group', value: '', options: ['', 'SRE-L2', 'Payments-L3'] }],
              build: v => cli(['itsm', 'queue'], { '--group': v.group }) },
            { title: 'Work an incident', run: 'Save', fields: [
                { key: 'op', label: 'Action', value: 'assign', options: ['show', 'assign', 'update', 'escalate'] },
                { key: 'num', label: 'Number', value: 'INC0012008' }, { key: 'to', label: 'Assign to / escalate to group', value: 'me' },
                { key: 'state', label: 'State', value: 'In Progress', options: ['New', 'In Progress', 'On Hold', 'Resolved'] },
                { key: 'note', label: 'Work note / reason', value: '', area: true }],
              build: v => v.op === 'assign' ? cli(['itsm', 'assign', v.num], { '--to': v.to })
                  : v.op === 'update' ? cli(['itsm', 'update', v.num], { '--state': v.state, '--work-note': v.note })
                      : v.op === 'escalate' ? cli(['itsm', 'escalate', v.num], { '--group': v.to, '--reason': v.note })
                          : cli(['itsm', 'show', v.num]) },
            { title: 'Evidence for the RCA', run: 'Collect', fields: [{ key: 'kind', label: 'Source', value: 'cmdb', options: ['cmdb', 'changes', 'metrics', 'logs'] }],
              build: v => cli(['itsm', 'evidence', v.kind]) },
            { title: 'Change request', run: 'Move', fields: [
                { key: 'op', label: 'Transition', value: 'submit', options: ['submit', 'implement', 'close'] },
                { key: 'num', label: 'Change', value: 'CHG0031001' }],
              build: v => cli(['itsm', 'change', v.op, v.num], { '--code': v.op === 'close' ? 'successful' : '' }) },
        ],
    },
    grc: {
        name: 'Security & Compliance', vendor: 'ISO 27001 · IAM · Key Vault · DR', color: '#6b2fb3',
        location: 'https://grc.shopfront.internal/frameworks/iso27001',
        subsystems: ['grc'],
        forms: [
            { title: 'Compliance', run: 'Run', fields: [{ key: 'op', label: 'Action', value: 'scan', options: ['scan', 'findings', 'evidence export'] }],
              build: v => v.op === 'evidence export'
                  ? cli(['compliance', 'evidence', 'export'], { '--framework': 'iso27001', '--out': 'evidence/iso27001-evidence.json' })
                  : cli(['compliance', v.op], { '--framework': 'iso27001' }) },
            { title: 'IAM role policies', run: 'Apply', fields: [
                { key: 'op', label: 'Action', value: 'list-attached-role-policies', options: ['list-attached-role-policies', 'attach-role-policy', 'detach-role-policy'] },
                { key: 'role', label: 'Role', value: 'ci-deploy' },
                { key: 'arn', label: 'Policy ARN', value: 'arn:aws:iam::123456789012:policy/ci-deploy-ecr-eks' }],
              build: v => cli(['aws', 'iam', v.op], { '--role-name': v.role, '--policy-arn': v.op === 'list-attached-role-policies' ? '' : v.arn }) },
            { title: 'Key Vault', run: 'Save', fields: [
                { key: 'purge', label: 'Purge protection', value: 'true', check: true }],
              build: v => cli(['az', 'keyvault', 'update'], { '--name': 'kv-shop-prod', '--enable-purge-protection': yes(v.purge) ? 'true' : 'false' }) },
            { title: 'Disaster recovery drill', run: 'Run', fields: [{ key: 'op', label: 'Action', value: 'describe-jobs',
                options: ['start-recovery', 'describe-jobs', 'terminate-recovery-instances'] }],
              build: v => v.op === 'start-recovery' ? cli(['aws', 'drs', 'start-recovery'], { '--source-servers': 'sourceServerID=s-1a2b3c4d5e6f70801', '--is-drill': true })
                  : v.op === 'terminate-recovery-instances' ? cli(['aws', 'drs', v.op], { '--recovery-instance-ids': 'i-0dr00000000005e6f' })
                      : cli(['aws', 'drs', v.op]) },
        ],
    },
    m365: {
        name: 'Microsoft 365 admin', vendor: 'Active Directory · Entra ID · Exchange Online', color: '#0078d4',
        location: 'https://admin.microsoft.com/#/users',
        subsystems: ['m365'],
        forms: [
            { title: 'Active Directory user', run: 'Apply', fields: [
                { key: 'op', label: 'Action', value: 'Unlock', options: ['Get', 'Unlock', 'Reset password', 'Must change at logon', 'Disable', 'Enable'] },
                { key: 'user', label: 'User (sAMAccountName)', value: 'j.smith' }, { key: 'pw', label: 'Temporary password', value: 'Temp-Pass-2026!x' }],
              build: v => pwsh(v.op === 'Unlock' ? 'Unlock-ADAccount -Identity ' + psq(v.user)
                  : v.op === 'Reset password' ? 'Set-ADAccountPassword -Identity ' + psq(v.user) + ' -Reset -NewPassword (ConvertTo-SecureString ' + psq(v.pw) + ' -AsPlainText -Force)'
                      : v.op === 'Must change at logon' ? 'Set-ADUser -Identity ' + psq(v.user) + ' -ChangePasswordAtLogon $true'
                          : v.op === 'Disable' ? 'Disable-ADAccount -Identity ' + psq(v.user)
                              : v.op === 'Enable' ? 'Enable-ADAccount -Identity ' + psq(v.user)
                                  : 'Get-ADUser -Identity ' + psq(v.user) + ' -Properties *') },
            { title: 'Group membership', run: 'Apply', fields: [
                { key: 'op', label: 'Action', value: 'Add', options: ['Add', 'Remove'] },
                { key: 'group', label: 'Group', value: 'Sales', options: ['Sales', 'VPN-Users', 'M365-E3-Licensed'] }, { key: 'user', label: 'User', value: 'l.haddad' }],
              build: v => pwsh((v.op === 'Add' ? 'Add' : 'Remove') + '-ADGroupMember -Identity ' + psq(v.group) + ' -Members ' + psq(v.user)
                               + (v.op === 'Remove' ? ' -Confirm:$false' : '')) },
            { title: 'Entra Connect sync', run: 'Sync now', fields: [],
              build: () => pwsh('Invoke-Command -ComputerName aadc-01 -ScriptBlock { Start-ADSyncSyncCycle -PolicyType Delta }') },
            { title: 'Mailbox migration batch', run: 'Run', fields: [
                { key: 'op', label: 'Action', value: 'Get', options: ['Get', 'Users', 'Start', 'Complete'] },
                { key: 'batch', label: 'Batch', value: 'Wave1' }],
              build: v => pwsh(v.op === 'Users' ? 'Get-MigrationUser -BatchId ' + psq(v.batch)
                  : v.op === 'Complete' ? 'Complete-MigrationBatch -Identity ' + psq(v.batch) + ' -Confirm:$false'
                      : v.op + '-MigrationBatch -Identity ' + psq(v.batch)) },
            { title: 'Shared mailbox conversion', run: 'Convert', fields: [{ key: 'upn', label: 'Mailbox', value: 'o.khalil@shopfront.com' }],
              build: v => pwsh('Set-Mailbox -Identity ' + psq(v.upn) + ' -Type Shared') },
        ],
    },
    delivery: {
        name: 'Project Delivery', vendor: 'Needs · Gaps · Readiness · UAT · Training', color: '#2f6f4f',
        location: 'https://delivery.shopfront.internal/projects/WMS-2026',
        subsystems: ['delivery'],
        forms: [
            { title: 'Stakeholder need', run: 'Add', fields: [
                { key: 'who', label: 'Stakeholder', value: '' }, { key: 'need', label: 'Need', value: '' },
                { key: 'prio', label: 'Priority', value: 'must', options: ['must', 'should', 'could'] }, { key: 'acc', label: 'Acceptance criterion', value: '' }],
              build: v => cli(['project', 'needs', 'add'], { '--stakeholder': v.who, '--need': v.need, '--priority': v.prio, '--acceptance': v.acc }) },
            { title: 'Readiness', run: 'Run', fields: [
                { key: 'op', label: 'Action', value: 'check', options: ['check', 'confirm'] },
                { key: 'item', label: 'Item (confirm)', value: 'licensing' }, { key: 'ev', label: 'Evidence', value: '' }],
              build: v => v.op === 'confirm' ? cli(['project', 'readiness', 'confirm', v.item], { '--evidence': v.ev }) : cli(['project', 'readiness']) },
            { title: 'UAT run', run: 'Record', fields: [
                { key: 'id', label: 'Case', value: 'UAT-01' }, { key: 'res', label: 'Result', value: 'pass', options: ['pass', 'fail'] },
                { key: 'tester', label: 'Tester', value: '' }],
              build: v => cli(['uat', 'run', v.id], { '--result': v.res, '--tester': v.tester }) },
            { title: 'Training attendance', run: 'Record', fields: [{ key: 'id', label: 'Session', value: 'TRN-1' }, { key: 'n', label: 'Attendees', value: '18' }],
              build: v => cli(['training', 'attend', v.id], { '--count': v.n }) },
            { title: 'Installation plan', run: 'Publish', fields: [], build: () => cli(['project', 'install', 'publish']) },
        ],
    },
};
