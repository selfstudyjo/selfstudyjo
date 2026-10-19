/**
 * The AWS Management Console's map: which services exist, what each one's
 * side navigation holds, and the URL the real console shows for each page.
 *
 * Plain module - no Vue - so the routing decisions are in one place and the
 * page components only say "go to s3/bucket with name=x".
 */

export type ServiceId =
    | 'home' | 's3' | 'ec2' | 'vpc' | 'iam' | 'lambda'
    | 'dynamodb' | 'rds' | 'sqs' | 'sns' | 'cloudwatch'
    | 'kms' | 'glue' | 'athena' | 'lakeformation' | 'kinesis' | 'redshift'
    | 'stepfunctions' | 'billing';

export interface Route {
    svc: ServiceId;
    page: string;
    params?: Record<string, string>;
}

export interface NavLink {
    label: string;
    route?: Route;
    /** A real console link this lab does not model; drawn, not clickable. */
    disabled?: boolean;
    external?: boolean;
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
    /** Background colour of the service's square icon (AWS category colours). */
    color: string;
    home: Route;
    nav: NavSection[];
    /** The side navigation title links here. */
    title: string;
}

const r = (svc: ServiceId, page: string, params?: Record<string, string>): Route =>
    ({ svc, page, params });

const off = (label: string): NavLink => ({ label, disabled: true });

export const SERVICES: ServiceDef[] = [
    {
        id: 'ec2', name: 'EC2', short: 'EC2', title: 'EC2',
        description: 'Virtual Servers in the Cloud',
        category: 'Compute', color: '#ed7100', home: r('ec2', 'dashboard'),
        nav: [
            { links: [{ label: 'Dashboard', route: r('ec2', 'dashboard') }, off('EC2 Global View'), off('Events')] },
            {
                title: 'Instances', links: [
                    { label: 'Instances', route: r('ec2', 'instances') },
                    off('Instance Types'), off('Launch Templates'), off('Spot Requests'),
                    off('Savings Plans'), off('Reserved Instances'), off('Dedicated Hosts'),
                    off('Capacity Reservations'),
                ],
            },
            { title: 'Images', links: [{ label: 'AMIs', route: r('ec2', 'amis') }, off('AMI Catalog')] },
            {
                title: 'Elastic Block Store', links: [
                    { label: 'Volumes', route: r('ec2', 'volumes') }, off('Snapshots'), off('Lifecycle Manager'),
                ],
            },
            {
                title: 'Network & Security', links: [
                    { label: 'Security Groups', route: r('ec2', 'sgs') },
                    off('Elastic IPs'), off('Placement Groups'),
                    { label: 'Key Pairs', route: r('ec2', 'keys') },
                    off('Network Interfaces'),
                ],
            },
            { title: 'Load Balancing', links: [off('Load Balancers'), off('Target Groups')] },
            { title: 'Auto Scaling', links: [off('Auto Scaling Groups')] },
        ],
    },
    {
        id: 's3', name: 'S3', short: 'S3', title: 'Amazon S3',
        description: 'Scalable Storage in the Cloud',
        category: 'Storage', color: '#7aa116', home: r('s3', 'buckets'),
        nav: [
            {
                links: [
                    { label: 'General purpose buckets', route: r('s3', 'buckets') },
                    off('Directory buckets'), off('Table buckets'), off('Vector buckets'),
                    off('Access Grants'), off('Access Points'), off('Object Lambda Access Points'),
                    off('Multi-Region Access Points'), off('Batch Operations'),
                    off('IAM Access Analyzer for S3'),
                ],
            },
            { links: [off('Block Public Access settings for this account')] },
            { title: 'Storage Lens', links: [off('Dashboards'), off('Storage Lens groups'), off('AWS Organizations settings')] },
            { links: [off('Feature spotlight'), off('AWS Marketplace for S3')] },
        ],
    },
    {
        id: 'vpc', name: 'VPC', short: 'VPC', title: 'VPC dashboard',
        description: 'Isolated Cloud Resources',
        category: 'Networking & Content Delivery', color: '#8c4fff', home: r('vpc', 'vpcs'),
        nav: [
            { links: [off('EC2 Global View')] },
            {
                title: 'Virtual private cloud', links: [
                    { label: 'Your VPCs', route: r('vpc', 'vpcs') },
                    { label: 'Subnets', route: r('vpc', 'subnets') },
                    { label: 'Route tables', route: r('vpc', 'routes') },
                    off('Internet gateways'), off('Egress-only internet gateways'),
                    off('DHCP option sets'), off('Elastic IPs'), off('Managed prefix lists'),
                    { label: 'Endpoints', route: r('vpc', 'endpoints') },
                    off('Endpoint services'),
                    { label: 'NAT gateways', route: r('vpc', 'nats') },
                    off('Peering connections'),
                ],
            },
            {
                title: 'Security', links: [
                    off('Network ACLs'),
                    { label: 'Security groups', route: r('vpc', 'sgs') },
                ],
            },
        ],
    },
    {
        id: 'iam', name: 'IAM', short: 'IAM', title: 'Identity and Access Management (IAM)',
        description: 'Manage access to AWS resources',
        category: 'Security, Identity, & Compliance', color: '#dd344c', home: r('iam', 'dashboard'),
        nav: [
            { links: [{ label: 'Dashboard', route: r('iam', 'dashboard') }] },
            {
                title: 'Access management', links: [
                    off('User groups'),
                    { label: 'Users', route: r('iam', 'users') },
                    { label: 'Roles', route: r('iam', 'roles') },
                    { label: 'Policies', route: r('iam', 'policies') },
                    off('Identity providers'), off('Account settings'), off('Root access management'),
                ],
            },
            { title: 'Access reports', links: [off('Access Analyzer'), off('Resource analysis'), off('Credential report')] },
        ],
    },
    {
        id: 'lambda', name: 'Lambda', short: 'Lambda', title: 'AWS Lambda',
        description: 'Run code without thinking about servers',
        category: 'Compute', color: '#ed7100', home: r('lambda', 'functions'),
        nav: [
            { links: [off('Dashboard'), off('Applications'), { label: 'Functions', route: r('lambda', 'functions') }] },
            { title: 'Additional resources', links: [off('Code signing configurations'), off('Event source mappings'), off('Layers'), off('Replicas')] },
        ],
    },
    {
        id: 'dynamodb', name: 'DynamoDB', short: 'DynamoDB', title: 'DynamoDB',
        description: 'Managed NoSQL Database',
        category: 'Database', color: '#c925d1', home: r('dynamodb', 'tables'),
        nav: [
            {
                links: [
                    off('Dashboard'), { label: 'Tables', route: r('dynamodb', 'tables') },
                    { label: 'Explore items', route: r('dynamodb', 'explore') },
                    off('PartiQL editor'), off('Backups'), off('Exports to S3'), off('Imports from S3'),
                    off('Integrations'), off('Reserved capacity'), off('Settings'),
                ],
            },
        ],
    },
    {
        id: 'rds', name: 'Aurora and RDS', short: 'RDS', title: 'Aurora and RDS',
        description: 'Managed Relational Database Service',
        category: 'Database', color: '#c925d1', home: r('rds', 'databases'),
        nav: [
            {
                links: [
                    off('Dashboard'), { label: 'Databases', route: r('rds', 'databases') },
                    off('Query editor'), off('Performance insights'),
                    { label: 'Snapshots', route: r('rds', 'snapshots') },
                    off('Exports in Amazon S3'), off('Automated backups'), off('Reserved instances'), off('Proxies'),
                ],
            },
            { links: [off('Subnet groups'), off('Parameter groups'), off('Option groups'), off('Custom engine versions')] },
        ],
    },
    {
        id: 'sqs', name: 'Simple Queue Service', short: 'SQS', title: 'Amazon SQS',
        description: 'Managed Message Queues',
        category: 'Application Integration', color: '#e7157b', home: r('sqs', 'queues'),
        nav: [{ links: [{ label: 'Queues', route: r('sqs', 'queues') }] }],
    },
    {
        id: 'sns', name: 'Simple Notification Service', short: 'SNS', title: 'Amazon SNS',
        description: 'Managed Message Topics for Pub/Sub',
        category: 'Application Integration', color: '#e7157b', home: r('sns', 'topics'),
        nav: [
            {
                links: [
                    off('Dashboard'), { label: 'Topics', route: r('sns', 'topics') },
                    { label: 'Subscriptions', route: r('sns', 'subscriptions') },
                ],
            },
            { title: 'Mobile', links: [off('Push notifications'), off('Text messaging (SMS)')] },
        ],
    },
    {
        id: 'cloudwatch', name: 'CloudWatch', short: 'CloudWatch', title: 'CloudWatch',
        description: 'Monitor Resources and Applications',
        category: 'Management & Governance', color: '#e7157b', home: r('cloudwatch', 'groups'),
        nav: [
            { links: [off('Favorites and recents'), off('Dashboards'), off('AI Operations')] },
            { title: 'Alarms', links: [{ label: 'All alarms', route: r('cloudwatch', 'alarms') }] },
            {
                title: 'Logs', links: [
                    { label: 'Log groups', route: r('cloudwatch', 'groups') },
                    off('Log Anomalies'), off('Live Tail'), off('Logs Insights'), off('Contributor Insights'),
                ],
            },
            { title: 'Metrics', links: [off('All metrics'), off('Explorer'), off('Streams')] },
        ],
    },
    {
        id: 'kms', name: 'Key Management Service', short: 'KMS', title: 'Key Management Service (KMS)',
        description: 'Securely Generate and Manage AWS Encryption Keys',
        category: 'Security, Identity, & Compliance', color: '#dd344c', home: r('kms', 'keys'),
        nav: [{ links: [off('AWS managed keys'), { label: 'Customer managed keys', route: r('kms', 'keys') },
            off('Custom key stores')] }],
    },
    {
        id: 'glue', name: 'AWS Glue', short: 'Glue', title: 'AWS Glue',
        description: 'Simple, scalable, and serverless data integration',
        category: 'Analytics', color: '#8c4fff', home: r('glue', 'databases'),
        nav: [
            { links: [off('Getting started')] },
            { title: 'ETL jobs', links: [off('Visual ETL'), off('Notebooks'),
                { label: 'Jobs', route: r('glue', 'jobs') }, off('Job run monitoring')] },
            { title: 'Data Catalog', links: [
                { label: 'Databases', route: r('glue', 'databases') },
                { label: 'Tables', route: r('glue', 'tables') },
                { label: 'Connections', route: r('glue', 'connections') },
                { label: 'Crawlers', route: r('glue', 'crawlers') },
                off('Classifiers'), off('Catalog settings')] },
        ],
    },
    {
        id: 'athena', name: 'Athena', short: 'Athena', title: 'Amazon Athena',
        description: 'Serverless interactive analytics service',
        category: 'Analytics', color: '#8c4fff', home: r('athena', 'editor'),
        nav: [
            { links: [{ label: 'Query editor', route: r('athena', 'editor') }, off('Notebook editor')] },
            { title: 'Administration', links: [{ label: 'Workgroups', route: r('athena', 'workgroups') },
                off('Capacity reservations'), off('Data sources and catalogs')] },
        ],
    },
    {
        id: 'lakeformation', name: 'AWS Lake Formation', short: 'Lake Formation', title: 'AWS Lake Formation',
        description: 'Build, manage, and secure your data lake',
        category: 'Analytics', color: '#8c4fff', home: r('lakeformation', 'permissions'),
        nav: [
            { links: [off('Dashboard')] },
            { title: 'Data Catalog', links: [{ label: 'Databases', route: r('glue', 'databases') },
                { label: 'Tables', route: r('glue', 'tables') }] },
            { title: 'Permissions', links: [{ label: 'Data lake permissions', route: r('lakeformation', 'permissions') },
                { label: 'LF-Tags and permissions', route: r('lakeformation', 'tags') }] },
            { title: 'Administration', links: [{ label: 'Administrative roles and tasks', route: r('lakeformation', 'admins') },
                { label: 'Data lake locations', route: r('lakeformation', 'locations') }] },
        ],
    },
    {
        id: 'kinesis', name: 'Kinesis', short: 'Kinesis', title: 'Amazon Kinesis',
        description: 'Work with Real-Time Streaming Data',
        category: 'Analytics', color: '#8c4fff', home: r('kinesis', 'streams'),
        nav: [{ links: [{ label: 'Data streams', route: r('kinesis', 'streams') },
            { label: 'Amazon Data Firehose', route: r('kinesis', 'firehose') }, off('Managed Apache Flink')] }],
    },
    {
        id: 'redshift', name: 'Amazon Redshift', short: 'Redshift', title: 'Redshift Serverless',
        description: 'Fast, Simple, Cost-Effective Data Warehousing',
        category: 'Analytics', color: '#8c4fff', home: r('redshift', 'serverless'),
        nav: [
            { links: [{ label: 'Serverless dashboard', route: r('redshift', 'serverless') },
                { label: 'Query editor v2', route: r('redshift', 'editor') }] },
            { links: [off('Provisioned clusters dashboard'), off('Datashares')] },
        ],
    },
    {
        id: 'stepfunctions', name: 'Step Functions', short: 'Step Functions', title: 'Step Functions',
        description: 'Coordination for Distributed Applications',
        category: 'Application Integration', color: '#e7157b', home: r('stepfunctions', 'machines'),
        nav: [{ links: [{ label: 'State machines', route: r('stepfunctions', 'machines') }, off('Activities')] }],
    },
    {
        id: 'billing', name: 'Billing and Cost Management', short: 'Billing', title: 'Billing and Cost Management',
        description: 'Budgets, Cost Explorer and cost allocation tags',
        category: 'Cloud Financial Management', color: '#7aa116', home: r('billing', 'explorer'),
        nav: [
            { links: [off('Home')] },
            { title: 'Cost and usage analysis', links: [{ label: 'Cost Explorer', route: r('billing', 'explorer') }] },
            { title: 'Budgets and planning', links: [{ label: 'Budgets', route: r('billing', 'budgets') }] },
            { title: 'Cost organization', links: [{ label: 'Cost allocation tags', route: r('billing', 'tags') }] },
        ],
    },
];

export const SERVICE_BY_ID: Record<string, ServiceDef> =
    Object.fromEntries(SERVICES.map(service => [service.id, service]));

export const REGION_NAMES: Record<string, string> = {
    'us-east-1': 'US East (N. Virginia)',
    'us-east-2': 'US East (Ohio)',
    'us-west-1': 'US West (N. California)',
    'us-west-2': 'US West (Oregon)',
    'ap-south-1': 'Asia Pacific (Mumbai)',
    'eu-central-1': 'Europe (Frankfurt)',
    'eu-west-1': 'Europe (Ireland)',
    'me-central-1': 'Middle East (UAE)',
};

export function regionName(region: string): string {
    return REGION_NAMES[region] || region;
}

/** The region label shown in the top bar: "UAE", "Ireland", "N. Virginia". */
export function regionShort(region: string): string {
    const name = REGION_NAMES[region] || region;
    const match = name.match(/\(([^)]+)\)/);
    return match ? match[1] : name;
}

export function sameRoute(a: Route, b?: Route): boolean {
    return Boolean(b) && a.svc === b!.svc && a.page === b!.page;
}

/** 123456789012 -> 1234-5678-9012, the way the account menu prints it. */
export function accountDashed(account: string): string {
    const digits = String(account || '').replace(/\D/g, '');
    return digits.length === 12 ? `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}` : account;
}

const enc = encodeURIComponent;

/** The URL the real console has in the address bar for this page. */
export function urlFor(route: Route, region: string): string {
    const p = route.params || {};
    const host = `https://${region}.console.aws.amazon.com`;
    const q = `?region=${region}`;
    switch (route.svc) {
    case 'home':
        return `${host}/console/home${q}#`;
    case 's3':
        if (route.page === 'create') return `${host}/s3/bucket/create${q}`;
        if (route.page === 'upload') return `${host}/s3/upload/${enc(p.bucket)}${q}&prefix=${enc(p.prefix || '')}`;
        if (route.page === 'object') return `${host}/s3/object/${enc(p.bucket)}${q}&bucketType=general&prefix=${enc(p.key)}`;
        if (route.page === 'bucket') {
            const prefix = p.prefix ? `&prefix=${enc(p.prefix)}&showversions=false` : '';
            return `${host}/s3/buckets/${enc(p.name)}${q}&bucketType=general${prefix}&tab=${p.tab || 'objects'}`;
        }
        return `${host}/s3/buckets${q}`;
    case 'ec2': {
        const base = `${host}/ec2/home${q}#`;
        switch (route.page) {
        case 'instances': return `${base}Instances:`;
        case 'launch': return `${base}LaunchInstances:`;
        case 'instance': return `${base}InstanceDetails:instanceId=${p.id}`;
        case 'sgs': return `${base}SecurityGroups:`;
        case 'sg': return `${base}SecurityGroup:groupId=${p.id}`;
        case 'sg-create': return `${base}CreateSecurityGroup:`;
        case 'sg-inbound': return `${base}ModifyInboundSecurityGroupRules:securityGroupId=${p.id}`;
        case 'keys': return `${base}KeyPairs:`;
        case 'key-create': return `${base}CreateKeyPair:`;
        case 'volumes': return `${base}Volumes:`;
        case 'volume-create': return `${base}CreateVolume:`;
        case 'amis': return `${base}Images:visibility=public-images`;
        default: return `${base}Home:`;
        }
    }
    case 'vpc': {
        const base = `${host}/vpcconsole/home${q}#`;
        switch (route.page) {
        case 'vpc-create': return `${base}CreateVpc:createMode=vpcOnly`;
        case 'vpc': return `${base}VpcDetails:VpcId=${p.id}`;
        case 'subnets': return `${base}subnets:`;
        case 'subnet-create': return `${base}CreateSubnet:`;
        case 'sgs': return `${base}SecurityGroups:`;
        case 'sg': return `${base}SecurityGroup:groupId=${p.id}`;
        case 'sg-create': return `${base}CreateSecurityGroup:`;
        case 'sg-inbound': return `${base}ModifyInboundSecurityGroupRules:securityGroupId=${p.id}`;
        case 'routes': return `${base}RouteTables:`;
        case 'nats': return `${base}NatGateways:`;
        case 'endpoints': return `${base}Endpoints:`;
        case 'endpoint-create': return `${base}CreateVpcEndpoint:`;
        default: return `${base}vpcs:`;
        }
    }
    case 'kms':
        return `${host}/kms/home${q}#/kms/keys${p.id ? '/' + enc(p.id) : ''}${route.page === 'create' ? '/create' : ''}`;
    case 'glue': {
        const base = `${host}/glue/home${q}#/v2/`;
        switch (route.page) {
        case 'tables': return `${base}data-catalog/tables`;
        case 'table': return `${base}data-catalog/tables/view/${enc(p.name)}?database=${enc(p.db)}`;
        case 'crawlers': return `${base}data-catalog/crawlers`;
        case 'connections': return `${base}data-catalog/connections`;
        case 'jobs': return `${base}etl-configuration/jobs`;
        case 'job': return `${base}edit-job/script?jobName=${enc(p.name)}&tab=${p.tab || 'runs'}`;
        default: return `${base}data-catalog/databases`;
        }
    }
    case 'athena':
        return route.page === 'workgroups' ? `${host}/athena/home${q}#/workgroups`
            : `${host}/athena/home${q}#/query-editor`;
    case 'lakeformation':
        return `${host}/lakeformation/home${q}#${{ permissions: 'permissions-list', tags: 'lf-tags',
            admins: 'administrative-roles-and-tasks', locations: 'data-lake-locations' }[route.page] || 'permissions-list'}`;
    case 'kinesis':
        if (route.page === 'firehose') return `${host}/firehose/home${q}#/streams`;
        if (route.page === 'stream') return `${host}/kinesis/home${q}#/streams/details/${enc(p.name)}/${p.tab || 'monitoring'}`;
        return `${host}/kinesis/home${q}#/streams/list`;
    case 'redshift':
        return route.page === 'editor' ? `${host}/sqlworkbench/home${q}#/client`
            : `${host}/redshiftv2/home${q}#/serverless-dashboard`;
    case 'stepfunctions': {
        const base = `${host}/states/home${q}#/`;
        if (route.page === 'machine') return `${base}statemachines/view/${enc(p.arn)}`;
        if (route.page === 'execution') return `${base}v2/executions/details/${enc(p.arn)}`;
        if (route.page === 'create') return `${base}statemachines/create`;
        return `${base}statemachines`;
    }
    case 'billing': {
        const base = 'https://us-east-1.console.aws.amazon.com/costmanagement/home#/';
        if (route.page === 'budgets') return `${base}budgets`;
        if (route.page === 'tags') return `${base}tags`;
        return `${base}cost-explorer`;
    }
    case 'iam': {
        const base = `https://us-east-1.console.aws.amazon.com/iam/home${q}#/`;
        switch (route.page) {
        case 'users': return `${base}users`;
        case 'user': return `${base}users/details/${enc(p.name)}?section=${p.tab || 'permissions'}`;
        case 'user-create': return `${base}users/create`;
        case 'roles': return `${base}roles`;
        case 'role': return `${base}roles/details/${enc(p.name)}?section=${p.tab || 'permissions'}`;
        case 'role-create': return `${base}roles/create`;
        case 'policies': return `${base}policies`;
        default: return `${base}home`;
        }
    }
    case 'lambda': {
        const base = `${host}/lambda/home${q}#/`;
        if (route.page === 'create') return `${base}create/function`;
        if (route.page === 'function') return `${base}functions/${enc(p.name)}?tab=${p.tab || 'code'}`;
        return `${base}functions`;
    }
    case 'dynamodb': {
        const base = `${host}/dynamodbv2/home${q}#`;
        if (route.page === 'create') return `${base}create-table`;
        if (route.page === 'table') return `${base}table?name=${enc(p.name)}`;
        if (route.page === 'explore') return `${base}item-explorer?table=${enc(p.name || '')}`;
        if (route.page === 'item-create') return `${base}edit-item?itemMode=1&table=${enc(p.name)}`;
        return `${base}tables`;
    }
    case 'rds': {
        const base = `${host}/rds/home${q}#`;
        if (route.page === 'create') return `${base}launch-dbinstance:`;
        if (route.page === 'database') return `${base}database:id=${p.id};is-cluster=false`;
        if (route.page === 'modify') return `${base}modify-instance:id=${p.id}`;
        if (route.page === 'snapshots') return `${base}snapshots-list:`;
        return `${base}databases:`;
    }
    case 'sqs': {
        const base = `${host}/sqs/v3/home${q}#/`;
        if (route.page === 'create') return `${base}create-queue`;
        if (route.page === 'queue') return `${base}queues/${enc(p.url || '')}`;
        return `${base}queues`;
    }
    case 'sns': {
        const base = `${host}/sns/v3/home${q}#/`;
        if (route.page === 'create') return `${base}create-topic`;
        if (route.page === 'topic') return `${base}topic/${p.arn}`;
        if (route.page === 'subscriptions') return `${base}subscriptions`;
        if (route.page === 'subscribe') return `${base}create-subscription`;
        return `${base}topics`;
    }
    case 'cloudwatch': {
        if (route.page === 'alarms') return `${host}/cloudwatch/home${q}#alarmsV2:`;
        const base = `${host}/cloudwatch/home${q}#logsV2:log-groups`;
        if (route.page === 'group') return `${base}/log-group/${enc(enc(p.name))}`;
        if (route.page === 'create') return `${base}/create-log-group`;
        return base;
    }
    }
    return `${host}/console/home${q}`;
}
