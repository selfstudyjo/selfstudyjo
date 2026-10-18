/**
 * The AWS Management Console's map for the Cloud Operations estate: which
 * services exist, what each one's side navigation holds, the breadcrumb for
 * every page, and the URL the real console shows in the address bar.
 *
 * Plain module - no Vue - so the routing decisions live in one place and the
 * page components only say "go to vpc/acl with id=x".
 */

export type ServiceId =
    | 'home' | 'organizations' | 'controltower' | 'iam' | 'sso' | 'vpc' | 'ec2'
    | 'ssm' | 'imagebuilder' | 'backup' | 'cloudwatch' | 'sns' | 'securityhub'
    | 'guardduty' | 'config' | 'cloudtrail' | 'waf' | 'cloudformation' | 's3'
    | 'secrets' | 'route53' | 'cost';

export interface Route {
    svc: ServiceId;
    page: string;
    params?: Record<string, string>;
}

export interface NavLink {
    label: string;
    route?: Route;
}

export interface NavSection {
    title?: string;
    links: NavLink[];
}

export interface ServiceDef {
    id: ServiceId;
    name: string;
    short: string;
    description: string;
    category: string;
    color: string;
    home: Route;
    nav: NavSection[];
    title: string;
}

const r = (svc: ServiceId, page: string, params?: Record<string, string>): Route =>
    ({ svc, page, params });
const l = (label: string, svc: ServiceId, page: string): NavLink => ({ label, route: r(svc, page) });
const off = (label: string): NavLink => ({ label });

const MGMT = '#e7157b';
const SEC = '#dd344c';
const NET = '#8c4fff';
const COMPUTE = '#ed7100';
const STORAGE = '#7aa116';

export const SERVICES: ServiceDef[] = [
    {
        id: 'organizations', name: 'AWS Organizations', short: 'Organizations', title: 'AWS Organizations',
        description: 'Central governance and management across AWS accounts',
        category: 'Management & Governance', color: MGMT, home: r('organizations', 'accounts'),
        nav: [{ links: [l('AWS accounts', 'organizations', 'accounts'), off('Services'),
            l('Policies', 'organizations', 'policies'), off('Settings')] }],
    },
    {
        id: 'controltower', name: 'AWS Control Tower', short: 'Control Tower', title: 'AWS Control Tower',
        description: 'Set up and govern a secure, compliant multi-account environment',
        category: 'Management & Governance', color: MGMT, home: r('controltower', 'dashboard'),
        nav: [
            { links: [l('Dashboard', 'controltower', 'dashboard')] },
            { title: 'Organization', links: [l('Organization', 'controltower', 'organization'),
                l('Account factory', 'controltower', 'factory')] },
            { title: 'Control library', links: [l('All controls', 'controltower', 'controls')] },
            { links: [l('Landing zone settings', 'controltower', 'settings')] },
        ],
    },
    {
        id: 'iam', name: 'IAM', short: 'IAM', title: 'Identity and Access Management (IAM)',
        description: 'Manage access to AWS resources',
        category: 'Security, Identity, & Compliance', color: SEC, home: r('iam', 'dashboard'),
        nav: [
            { links: [l('Dashboard', 'iam', 'dashboard')] },
            { title: 'Access management', links: [off('User groups'), l('Users', 'iam', 'users'),
                l('Roles', 'iam', 'roles'), l('Policies', 'iam', 'policies'),
                l('Identity providers', 'iam', 'idp'), l('Account settings', 'iam', 'settings')] },
            { title: 'Access reports', links: [off('Access Analyzer'), l('Credential report', 'iam', 'report'),
                l('Policy simulator', 'iam', 'simulator')] },
        ],
    },
    {
        id: 'sso', name: 'IAM Identity Center', short: 'IAM Identity Center', title: 'IAM Identity Center',
        description: 'Manage workforce user access to multiple AWS accounts and cloud applications',
        category: 'Security, Identity, & Compliance', color: SEC, home: r('sso', 'accounts'),
        nav: [
            { links: [off('Dashboard'), off('Users'), l('Groups', 'sso', 'groups'), off('Settings')] },
            { title: 'Multi-account permissions', links: [l('AWS accounts', 'sso', 'accounts'),
                l('Permission sets', 'sso', 'permission-sets')] },
        ],
    },
    {
        id: 'vpc', name: 'VPC', short: 'VPC', title: 'VPC dashboard',
        description: 'Isolated Cloud Resources',
        category: 'Networking & Content Delivery', color: NET, home: r('vpc', 'vpcs'),
        nav: [
            { title: 'Virtual private cloud', links: [l('Your VPCs', 'vpc', 'vpcs'), l('Subnets', 'vpc', 'subnets'),
                l('Route tables', 'vpc', 'route-tables'), l('Internet gateways', 'vpc', 'igws'),
                l('NAT gateways', 'vpc', 'nats'), l('Endpoints', 'vpc', 'endpoints'),
                off('Peering connections')] },
            { title: 'Security', links: [l('Network ACLs', 'vpc', 'acls'), l('Security groups', 'vpc', 'sgs')] },
            { title: 'Network Analysis', links: [l('Reachability Analyzer', 'vpc', 'reachability')] },
            { title: 'Virtual private network (VPN)', links: [off('Customer gateways'),
                l('Site-to-Site VPN connections', 'vpc', 'vpn')] },
            { title: 'Transit gateways', links: [l('Transit gateways', 'vpc', 'tgws'),
                l('Transit gateway attachments', 'vpc', 'tgw-attachments'),
                l('Transit gateway route tables', 'vpc', 'tgw-route-tables')] },
        ],
    },
    {
        id: 'ec2', name: 'EC2', short: 'EC2', title: 'EC2',
        description: 'Virtual Servers in the Cloud',
        category: 'Compute', color: COMPUTE, home: r('ec2', 'dashboard'),
        nav: [
            { links: [l('Dashboard', 'ec2', 'dashboard')] },
            { title: 'Instances', links: [l('Instances', 'ec2', 'instances'),
                l('Launch Templates', 'ec2', 'launch-templates'), off('Spot Requests'),
                off('Savings Plans'), off('Reserved Instances')] },
            { title: 'Images', links: [l('AMIs', 'ec2', 'amis'), off('AMI Catalog')] },
            { title: 'Elastic Block Store', links: [off('Volumes'), l('Snapshots', 'ec2', 'snapshots')] },
            { title: 'Network & Security', links: [l('Security Groups', 'ec2', 'sgs'), off('Elastic IPs'),
                off('Key Pairs')] },
            { title: 'Load Balancing', links: [l('Load Balancers', 'ec2', 'load-balancers'),
                l('Target Groups', 'ec2', 'target-groups')] },
            { title: 'Auto Scaling', links: [l('Auto Scaling Groups', 'ec2', 'asgs')] },
        ],
    },
    {
        id: 'ssm', name: 'Systems Manager', short: 'Systems Manager', title: 'AWS Systems Manager',
        description: 'Gain operational insights and take action on AWS resources',
        category: 'Management & Governance', color: MGMT, home: r('ssm', 'fleet'),
        nav: [
            { title: 'Application Tools', links: [l('Parameter Store', 'ssm', 'parameters')] },
            { title: 'Node Tools', links: [l('Fleet Manager', 'ssm', 'fleet'), off('Compliance'),
                l('Session Manager', 'ssm', 'sessions'), l('Run Command', 'ssm', 'run-command'),
                l('Patch Manager', 'ssm', 'patch')] },
            { title: 'Change Management Tools', links: [l('Maintenance Windows', 'ssm', 'windows')] },
        ],
    },
    {
        id: 'imagebuilder', name: 'EC2 Image Builder', short: 'EC2 Image Builder', title: 'EC2 Image Builder',
        description: 'A managed service to automate build, customize and deploy OS images',
        category: 'Compute', color: COMPUTE, home: r('imagebuilder', 'pipelines'),
        nav: [
            { links: [l('Image pipelines', 'imagebuilder', 'pipelines'), l('Images', 'imagebuilder', 'images')] },
            { title: 'Saved configurations', links: [l('Image recipes', 'imagebuilder', 'recipes'),
                l('Components', 'imagebuilder', 'components'),
                l('Infrastructure configurations', 'imagebuilder', 'infra'),
                l('Distribution settings', 'imagebuilder', 'dist')] },
        ],
    },
    {
        id: 'backup', name: 'AWS Backup', short: 'AWS Backup', title: 'AWS Backup',
        description: 'Centrally manage and automate backups across AWS services',
        category: 'Storage', color: STORAGE, home: r('backup', 'dashboard'),
        nav: [
            { links: [l('Dashboard', 'backup', 'dashboard')] },
            { title: 'My account', links: [l('Backup plans', 'backup', 'plans'),
                l('Backup vaults', 'backup', 'vaults'), l('Jobs', 'backup', 'jobs'),
                l('Restore testing', 'backup', 'dr'), off('Settings')] },
        ],
    },
    {
        id: 'cloudwatch', name: 'CloudWatch', short: 'CloudWatch', title: 'CloudWatch',
        description: 'Monitor Resources and Applications',
        category: 'Management & Governance', color: MGMT, home: r('cloudwatch', 'alarms'),
        nav: [
            { links: [off('Favorites and recents'), off('Dashboards')] },
            { title: 'Alarms', links: [l('All alarms', 'cloudwatch', 'alarms')] },
            { title: 'Metrics', links: [l('All metrics', 'cloudwatch', 'metrics')] },
            { links: [off('Logs'), off('Application Signals')] },
        ],
    },
    {
        id: 'sns', name: 'Simple Notification Service', short: 'SNS', title: 'Amazon SNS',
        description: 'SNS managed message topics for Pub/Sub',
        category: 'Application Integration', color: MGMT, home: r('sns', 'topics'),
        nav: [{ links: [off('Dashboard'), l('Topics', 'sns', 'topics'),
            l('Subscriptions', 'sns', 'subscriptions')] }],
    },
    {
        id: 'securityhub', name: 'Security Hub', short: 'Security Hub', title: 'Security Hub',
        description: 'Unified security and compliance center',
        category: 'Security, Identity, & Compliance', color: SEC, home: r('securityhub', 'summary'),
        nav: [{ links: [l('Summary', 'securityhub', 'summary'), l('Security standards', 'securityhub', 'standards'),
            l('Controls', 'securityhub', 'controls'), off('Insights'), l('Findings', 'securityhub', 'findings')] }],
    },
    {
        id: 'guardduty', name: 'GuardDuty', short: 'GuardDuty', title: 'GuardDuty',
        description: 'Intelligent Threat Detection to Protect Your AWS Accounts and Workloads',
        category: 'Security, Identity, & Compliance', color: SEC, home: r('guardduty', 'findings'),
        nav: [{ links: [off('Summary'), l('Findings', 'guardduty', 'findings'), off('Usage')] },
            { title: 'Settings', links: [l('Settings', 'guardduty', 'settings')] }],
    },
    {
        id: 'config', name: 'Config', short: 'Config', title: 'AWS Config',
        description: 'Track Resource Inventory and Changes',
        category: 'Management & Governance', color: MGMT, home: r('config', 'dashboard'),
        nav: [{ links: [l('Dashboard', 'config', 'dashboard'), off('Conformance packs'),
            l('Rules', 'config', 'rules'), off('Resources'), off('Aggregators')] },
        { links: [l('Settings', 'config', 'settings')] }],
    },
    {
        id: 'cloudtrail', name: 'CloudTrail', short: 'CloudTrail', title: 'CloudTrail',
        description: 'Track User Activity and API Usage',
        category: 'Management & Governance', color: MGMT, home: r('cloudtrail', 'trails'),
        nav: [{ links: [off('Dashboard'), l('Event history', 'cloudtrail', 'events'), off('Insights'),
            off('Lake'), l('Trails', 'cloudtrail', 'trails')] }],
    },
    {
        id: 'waf', name: 'WAF & Shield', short: 'WAF & Shield', title: 'AWS WAF',
        description: 'Protect your web applications from common web exploits',
        category: 'Security, Identity, & Compliance', color: SEC, home: r('waf', 'acls'),
        nav: [{ title: 'AWS WAF', links: [l('Web ACLs', 'waf', 'acls'), off('Bot Control'),
            off('IP sets'), off('Regex pattern sets'), off('Rule groups')] }],
    },
    {
        id: 'cloudformation', name: 'CloudFormation', short: 'CloudFormation', title: 'CloudFormation',
        description: 'Create and Manage Resources with Templates',
        category: 'Management & Governance', color: MGMT, home: r('cloudformation', 'stacks'),
        nav: [{ links: [l('Stacks', 'cloudformation', 'stacks'), off('StackSets'), l('Exports', 'cloudformation', 'exports')] },
            { title: 'IaC generator', links: [off('IaC generator')] }],
    },
    {
        id: 's3', name: 'S3', short: 'S3', title: 'Amazon S3',
        description: 'Scalable Storage in the Cloud',
        category: 'Storage', color: STORAGE, home: r('s3', 'buckets'),
        nav: [{ links: [l('General purpose buckets', 's3', 'buckets'), off('Directory buckets'),
            off('Table buckets'), off('Access Points')] },
        { links: [l('Block Public Access settings for this account', 's3', 'account-bpa')] }],
    },
    {
        id: 'secrets', name: 'Secrets Manager', short: 'Secrets Manager', title: 'AWS Secrets Manager',
        description: 'Easily rotate, manage, and retrieve secrets throughout their lifecycle',
        category: 'Security, Identity, & Compliance', color: SEC, home: r('secrets', 'secrets'),
        nav: [{ links: [l('Secrets', 'secrets', 'secrets')] }],
    },
    {
        id: 'route53', name: 'Route 53', short: 'Route 53', title: 'Route 53',
        description: 'Scalable DNS and Domain Name Registration',
        category: 'Networking & Content Delivery', color: NET, home: r('route53', 'zones'),
        nav: [{ links: [off('Dashboard'), l('Hosted zones', 'route53', 'zones'), off('Health checks')] }],
    },
    {
        id: 'cost', name: 'Billing and Cost Management', short: 'Billing and Cost Management',
        title: 'Billing and Cost Management',
        description: 'Analyze, manage and optimize your costs',
        category: 'Cloud Financial Management', color: STORAGE, home: r('cost', 'explorer'),
        nav: [
            { links: [off('Home')] },
            { title: 'Cost and usage analysis', links: [l('Cost Explorer', 'cost', 'explorer')] },
            { title: 'Cost organization', links: [l('Cost allocation tags', 'cost', 'tags')] },
            { title: 'Budgets and planning', links: [l('Budgets', 'cost', 'budgets')] },
            { title: 'Savings and commitments', links: [l('Rightsizing recommendations', 'cost', 'rightsizing'),
                l('Savings Plans', 'cost', 'savings-plans'), l('Reservations', 'cost', 'reservations')] },
        ],
    },
];

export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map(s => [s.id, s])) as Record<string, ServiceDef>;

/** Feature hits for the unified search box. */
export const FEATURES: { title: string; svc: ServiceId; page: string; words: string }[] = [
    { title: 'Instances', svc: 'ec2', page: 'instances', words: 'instance server vm windows' },
    { title: 'Auto Scaling Groups', svc: 'ec2', page: 'asgs', words: 'asg autoscaling refresh' },
    { title: 'Target Groups', svc: 'ec2', page: 'target-groups', words: 'target health alb elb' },
    { title: 'Launch Templates', svc: 'ec2', page: 'launch-templates', words: 'launch template ami version' },
    { title: 'Network ACLs', svc: 'vpc', page: 'acls', words: 'nacl acl stateless' },
    { title: 'Security groups', svc: 'vpc', page: 'sgs', words: 'security group firewall sg rdp' },
    { title: 'Route tables', svc: 'vpc', page: 'route-tables', words: 'route table tgw' },
    { title: 'Reachability Analyzer', svc: 'vpc', page: 'reachability', words: 'reachability path analysis' },
    { title: 'Endpoints', svc: 'vpc', page: 'endpoints', words: 'vpc endpoint gateway privatelink' },
    { title: 'Users', svc: 'iam', page: 'users', words: 'user access key rotate' },
    { title: 'Roles', svc: 'iam', page: 'roles', words: 'role trust oidc' },
    { title: 'Credential report', svc: 'iam', page: 'report', words: 'credential report' },
    { title: 'Permission sets', svc: 'sso', page: 'permission-sets', words: 'permission set sso identity center' },
    { title: 'Service control policies', svc: 'organizations', page: 'policies', words: 'scp policy guardrail' },
    { title: 'Fleet Manager', svc: 'ssm', page: 'fleet', words: 'managed node ssm agent' },
    { title: 'Patch Manager', svc: 'ssm', page: 'patch', words: 'patch baseline patch group' },
    { title: 'Maintenance Windows', svc: 'ssm', page: 'windows', words: 'maintenance window' },
    { title: 'Session Manager', svc: 'ssm', page: 'sessions', words: 'session shell' },
    { title: 'Backup vaults', svc: 'backup', page: 'vaults', words: 'vault recovery point restore lock' },
    { title: 'Alarms', svc: 'cloudwatch', page: 'alarms', words: 'alarm cpu metric' },
    { title: 'Findings', svc: 'guardduty', page: 'findings', words: 'finding threat' },
    { title: 'Event history', svc: 'cloudtrail', page: 'events', words: 'event cloudtrail lookup' },
    { title: 'Stacks', svc: 'cloudformation', page: 'stacks', words: 'stack change set drift' },
    { title: 'Cost Explorer', svc: 'cost', page: 'explorer', words: 'cost bill spend' },
    { title: 'Savings Plans', svc: 'cost', page: 'savings-plans', words: 'savings plan commitment' },
];

const REGION_NAMES: Record<string, string> = {
    'us-east-1': 'US East (N. Virginia)', 'us-east-2': 'US East (Ohio)',
    'us-west-1': 'US West (N. California)', 'us-west-2': 'US West (Oregon)',
    'eu-west-1': 'Europe (Ireland)', 'eu-west-2': 'Europe (London)',
    'eu-central-1': 'Europe (Frankfurt)', 'ap-southeast-1': 'Asia Pacific (Singapore)',
    'me-central-1': 'Middle East (UAE)',
};

export function regionName(code: string): string {
    return REGION_NAMES[code] || code;
}

export function regionShort(code: string): string {
    const name = REGION_NAMES[code];
    const match = name && name.match(/\(([^)]+)\)/);
    return match ? match[1] : code;
}

export function accountDashed(account: string): string {
    const digits = String(account || '').replace(/\D/g, '');
    return digits.length === 12 ? `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}` : account;
}

/** Services whose console is global (no region in the address bar). */
const GLOBAL: ServiceId[] = ['iam', 'organizations', 'route53', 'cost', 'sso'];

export function isGlobal(svc: string): boolean { return (GLOBAL as string[]).includes(svc); }

interface PageMeta {
    label: string;
    /** For a detail or create page: the list page it belongs to. */
    parent?: string;
    /** The param that names the resource (shown as the last crumb). */
    param?: string;
    /** URL path after the service's base, `{param}` substituted. */
    url: string;
}

const P = (label: string, url: string, parent?: string, param?: string): PageMeta =>
    ({ label, url, parent, param });

/** Page labels (crumbs) and the URL fragment the real console uses. */
const PAGES: Record<string, Record<string, PageMeta>> = {
    organizations: {
        accounts: P('AWS accounts', '#/accounts'), policies: P('Service control policies', '#/policies/scp'),
        policy: P('Policy', '#/policies/scp/{id}', 'policies', 'name'),
        'policy-create': P('Create new service control policy', '#/policies/scp/create', 'policies'),
    },
    controltower: {
        dashboard: P('Dashboard', '#dashboard'), organization: P('Organization', '#organization'),
        factory: P('Account factory', '#accountfactory'), controls: P('All controls', '#controls'),
        settings: P('Landing zone settings', '#landingzonesettings'),
    },
    iam: {
        dashboard: P('Dashboard', '#/home'), users: P('Users', '#/users'),
        user: P('User', '#/users/details/{name}', 'users', 'name'), 'user-create': P('Create user', '#/users/create', 'users'),
        roles: P('Roles', '#/roles'), role: P('Role', '#/roles/details/{name}', 'roles', 'name'),
        'role-create': P('Create role', '#/roles/create', 'roles'),
        policies: P('Policies', '#/policies'), policy: P('Policy', '#/policies/details/{arn}', 'policies', 'name'),
        'policy-create': P('Create policy', '#/policies/create', 'policies'),
        idp: P('Identity providers', '#/identity_providers'), settings: P('Account settings', '#/account_settings'),
        report: P('Credential report', '#/credential_report'), simulator: P('Policy simulator', '#/policy_simulator'),
    },
    sso: {
        accounts: P('AWS accounts', '#/organization/accounts'), groups: P('Groups', '#/groups'),
        'permission-sets': P('Permission sets', '#/permissionSets'),
        'permission-set': P('Permission set', '#/permissionSets/{name}', 'permission-sets', 'name'),
        'permission-set-create': P('Create permission set', '#/permissionSets/create', 'permission-sets'),
        account: P('Account', '#/organization/accounts/{id}', 'accounts', 'name'),
    },
    vpc: {
        vpcs: P('Your VPCs', '#vpcs:'), vpc: P('VPC', '#VpcDetails:VpcId={id}', 'vpcs', 'id'),
        subnets: P('Subnets', '#subnets:'), subnet: P('Subnet', '#SubnetDetails:subnetId={id}', 'subnets', 'id'),
        'subnet-create': P('Create subnet', '#CreateSubnet:', 'subnets'),
        'route-tables': P('Route tables', '#RouteTables:'),
        'route-table': P('Route table', '#RouteTableDetails:RouteTableId={id}', 'route-tables', 'id'),
        igws: P('Internet gateways', '#igws:'), nats: P('NAT gateways', '#NatGateways:'),
        endpoints: P('Endpoints', '#Endpoints:'), 'endpoint-create': P('Create endpoint', '#CreateVpcEndpoint:', 'endpoints'),
        acls: P('Network ACLs', '#acls:'), acl: P('Network ACL', '#NetworkAclDetails:networkAclId={id}', 'acls', 'id'),
        sgs: P('Security Groups', '#SecurityGroups:'), sg: P('Security group', '#SecurityGroup:groupId={id}', 'sgs', 'id'),
        'sg-create': P('Create security group', '#CreateSecurityGroup:', 'sgs'),
        reachability: P('Reachability Analyzer', '#ReachabilityAnalyzer:'),
        'reachability-path': P('Path', '#NetworkPath:pathId={id}', 'reachability', 'id'),
        vpn: P('Site-to-Site VPN connections', '#VpnConnections:'), tgws: P('Transit gateways', '#TransitGateways:'),
        'tgw-attachments': P('Transit gateway attachments', '#TransitGatewayAttachments:'),
        'tgw-route-tables': P('Transit gateway route tables', '#TransitGatewayRouteTables:'),
    },
    ec2: {
        dashboard: P('Dashboard', '#Home:'), instances: P('Instances', '#Instances:'),
        instance: P('Instance', '#InstanceDetails:instanceId={id}', 'instances', 'id'),
        'launch-templates': P('Launch templates', '#LaunchTemplates:'),
        'launch-template': P('Launch template', '#LaunchTemplateDetails:launchTemplateId={id}', 'launch-templates', 'name'),
        amis: P('AMIs', '#Images:visibility=owned-by-me'), snapshots: P('Snapshots', '#Snapshots:'),
        sgs: P('Security Groups', '#SecurityGroups:'), sg: P('Security group', '#SecurityGroup:groupId={id}', 'sgs', 'id'),
        'sg-create': P('Create security group', '#CreateSecurityGroup:', 'sgs'),
        'load-balancers': P('Load balancers', '#LoadBalancers:'),
        'target-groups': P('Target groups', '#TargetGroups:'),
        'target-group': P('Target group', '#TargetGroup:targetGroupArn={id}', 'target-groups', 'name'),
        asgs: P('Auto Scaling groups', '#AutoScalingGroups:'),
        asg: P('Auto Scaling group', '#AutoScalingGroupDetails:id={name}', 'asgs', 'name'),
    },
    ssm: {
        fleet: P('Fleet Manager', '#/fleet-manager/managed-nodes'), patch: P('Patch Manager', '#/patch-manager'),
        baseline: P('Patch baseline', '#/patch-manager/baselines/{id}', 'patch', 'name'),
        windows: P('Maintenance Windows', '#/maintenance-windows'),
        window: P('Maintenance window', '#/maintenance-windows/{id}', 'windows', 'name'),
        'run-command': P('Run Command', '#/run-command/executing-commands'),
        command: P('Command', '#/run-command/{id}', 'run-command', 'id'),
        sessions: P('Session Manager', '#/session-manager/sessions'), parameters: P('Parameter Store', '#/parameters'),
    },
    imagebuilder: {
        pipelines: P('Image pipelines', '#/pipelines'), images: P('Images', '#/images'),
        recipes: P('Image recipes', '#/imageRecipes'), components: P('Components', '#/components'),
        infra: P('Infrastructure configurations', '#/infrastructureConfigurations'),
        dist: P('Distribution settings', '#/distributionConfigurations'),
        'pipeline-create': P('Create image pipeline', '#/pipelines/create', 'pipelines'),
    },
    backup: {
        dashboard: P('Dashboard', '#/'), plans: P('Backup plans', '#/backupplan'),
        plan: P('Backup plan', '#/backupplan/details/{id}', 'plans', 'name'),
        'plan-create': P('Create backup plan', '#/backupplan/create', 'plans'),
        vaults: P('Backup vaults', '#/backupvaults'), vault: P('Backup vault', '#/backupvaults/details/{name}', 'vaults', 'name'),
        jobs: P('Jobs', '#/jobs'), dr: P('Restore testing', '#/restoretesting'),
    },
    cloudwatch: {
        alarms: P('All alarms', '#alarmsV2:'), alarm: P('Alarm', '#alarmsV2:alarm/{name}', 'alarms', 'name'),
        'alarm-create': P('Create alarm', '#alarmsV2:create', 'alarms'), metrics: P('All metrics', '#metricsV2'),
    },
    sns: {
        topics: P('Topics', '#/topics'), topic: P('Topic', '#/topic/{arn}', 'topics', 'name'),
        subscriptions: P('Subscriptions', '#/subscriptions'),
    },
    securityhub: {
        summary: P('Summary', '#/summary'), standards: P('Security standards', '#/standards'),
        controls: P('Controls', '#/controls'), control: P('Control', '#/controls/{id}', 'controls', 'id'),
        findings: P('Findings', '#/findings'),
    },
    guardduty: { findings: P('Findings', '#/findings'), settings: P('Settings', '#/settings') },
    config: {
        dashboard: P('Dashboard', '#/dashboard'), rules: P('Rules', '#/rules'),
        rule: P('Rule', '#/rules/details?configRuleName={name}', 'rules', 'name'),
        settings: P('Settings', '#/settings'),
    },
    cloudtrail: {
        trails: P('Trails', '#/trails'), trail: P('Trail', '#/trails/{name}', 'trails', 'name'),
        'trail-create': P('Create trail', '#/create', 'trails'), events: P('Event history', '#/events'),
    },
    waf: { acls: P('Web ACLs', '#/webacls'), acl: P('Web ACL', '#/webacls/rules/{name}', 'acls', 'name') },
    cloudformation: {
        stacks: P('Stacks', '#/stacks'), stack: P('Stack', '#/stacks/stackinfo?stackId={id}', 'stacks', 'name'),
        'stack-create': P('Create stack', '#/stacks/create', 'stacks'), exports: P('Exports', '#/exports'),
    },
    s3: {
        buckets: P('General purpose buckets', '/s3/buckets'), bucket: P('Bucket', '/s3/buckets/{name}', 'buckets', 'name'),
        'account-bpa': P('Block Public Access settings for this account', '/s3/settings'),
    },
    secrets: {
        secrets: P('Secrets', '#!/listSecrets'), secret: P('Secret', '#!/secret?name={name}', 'secrets', 'name'),
    },
    route53: {
        zones: P('Hosted zones', '#/hostedzones'), zone: P('Hosted zone', '#/hostedzones/{id}', 'zones', 'name'),
    },
    cost: {
        explorer: P('Cost Explorer', '#/cost-explorer'), tags: P('Cost allocation tags', '#/tags'),
        budgets: P('Budgets', '#/budgets'), rightsizing: P('Rightsizing recommendations', '#/rightsizing'),
        'savings-plans': P('Savings Plans', '#/savings-plans/overview'),
        reservations: P('Reservations', '#/reservations/recommendations'),
    },
};

const BASES: Record<string, string> = {
    organizations: 'organizations/v2/home', controltower: 'controltower/home', iam: 'iam/home',
    sso: 'singlesignon/home', vpc: 'vpcconsole/home', ec2: 'ec2/home', ssm: 'systems-manager',
    imagebuilder: 'imagebuilder/home', backup: 'backup/home', cloudwatch: 'cloudwatch/home',
    sns: 'sns/v3/home', securityhub: 'securityhub/home', guardduty: 'guardduty/home',
    config: 'config/home', cloudtrail: 'cloudtrailv2/home', waf: 'wafv2/homev2',
    cloudformation: 'cloudformation/home', secrets: 'secretsmanager/home', route53: 'route53/v2/home',
    cost: 'costmanagement/home',
};

export interface Crumb {
    text: string;
    route?: Route;
}

export function pageMeta(route: Route): PageMeta | undefined {
    return PAGES[route.svc]?.[route.page];
}

export function crumbsFor(route: Route): Crumb[] {
    if (route.svc === 'home') return [];
    const svc = SERVICE_BY_ID[route.svc];
    const meta = pageMeta(route);
    if (!svc || !meta) return [];
    const out: Crumb[] = [{ text: svc.short, route: svc.home }];
    if (meta.parent) {
        const parent = PAGES[route.svc][meta.parent];
        out.push({ text: parent.label, route: r(route.svc, meta.parent) });
        const named = meta.param ? route.params?.[meta.param] || route.params?.id : '';
        out.push({ text: named || meta.label });
    } else {
        out.push({ text: meta.label });
    }
    return out;
}

const enc = encodeURIComponent;

/** The URL the real console has in the address bar for this page. */
export function urlFor(route: Route, region: string): string {
    if (route.svc === 'home') return `https://${region}.console.aws.amazon.com/console/home?region=${region}#`;
    const meta = pageMeta(route);
    const fragment = (meta?.url || '').replace(/\{(\w+)\}/g, (_m, key) => enc(route.params?.[key] || ''));
    if (route.svc === 's3') return `https://${region}.console.aws.amazon.com${fragment}?region=${region}`;
    const global = GLOBAL.includes(route.svc);
    const host = global ? 'https://us-east-1.console.aws.amazon.com' : `https://${region}.console.aws.amazon.com`;
    return `${host}/${BASES[route.svc]}?region=${global ? 'us-east-1' : region}${fragment}`;
}
