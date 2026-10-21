/** Breadcrumbs for every page, the way each AWS console spells them. */
import type { Route, ServiceId } from './nav';

export interface Crumb {
    text: string;
    route?: Route;
}

const at = (svc: ServiceId, page: string, params?: Record<string, string>): Route =>
    ({ svc, page, params });

export function crumbsFor(route: Route): Crumb[] {
    const p = route.params || {};
    switch (route.svc) {
    case 's3': {
        const root: Crumb[] = [{ text: 'Amazon S3', route: at('s3', 'buckets') },
            { text: 'Buckets', route: at('s3', 'buckets') }];
        if (route.page === 'create') return [...root, { text: 'Create bucket' }];
        if (route.page === 'bucket' || route.page === 'upload' || route.page === 'object') {
            const bucket = p.name || p.bucket;
            const out: Crumb[] = [...root, { text: bucket, route: at('s3', 'bucket', { name: bucket }) }];
            const path = route.page === 'object' ? p.key : (p.prefix || '');
            const parts = path.split('/').filter(Boolean);
            const folders = route.page === 'object' ? parts.slice(0, -1) : parts;
            let acc = '';
            for (const part of folders) {
                acc += part + '/';
                out.push({ text: part + '/', route: at('s3', 'bucket', { name: bucket, prefix: acc }) });
            }
            if (route.page === 'object') out.push({ text: parts[parts.length - 1] || p.key });
            if (route.page === 'upload') out.push({ text: 'Upload' });
            const last = out[out.length - 1];
            if (route.page === 'bucket') delete last.route;
            return out;
        }
        return [root[0], { text: 'General purpose buckets' }];
    }
    case 'ec2': {
        const root: Crumb = { text: 'EC2', route: at('ec2', 'dashboard') };
        const inst: Crumb = { text: 'Instances', route: at('ec2', 'instances') };
        const sgs: Crumb = { text: 'Security Groups', route: at('ec2', 'sgs') };
        switch (route.page) {
        case 'instances': return [root, { text: 'Instances' }];
        case 'launch': return [root, inst, { text: 'Launch an instance' }];
        case 'instance': return [root, inst, { text: p.id }];
        case 'connect': return [root, inst, { text: p.id, route: at('ec2', 'instance', { id: p.id }) },
            { text: 'Connect to instance' }];
        case 'terminal': return [root, inst, { text: p.id, route: at('ec2', 'instance', { id: p.id }) },
            { text: 'Connect to instance', route: at('ec2', 'connect', { id: p.id }) },
            { text: p.via === 'ssm' ? 'Session Manager' : 'EC2 Instance Connect' }];
        case 'sg-outbound': return [root, sgs, { text: p.id, route: at('ec2', 'sg', { id: p.id }) },
            { text: 'Edit outbound rules' }];
        case 'sgs': return [root, { text: 'Security Groups' }];
        case 'sg': return [root, sgs, { text: p.id }];
        case 'sg-create': return [root, sgs, { text: 'Create security group' }];
        case 'sg-inbound': return [root, sgs, { text: p.id, route: at('ec2', 'sg', { id: p.id }) },
            { text: 'Edit inbound rules' }];
        case 'keys': return [root, { text: 'Key pairs' }];
        case 'key-create': return [root, { text: 'Key pairs', route: at('ec2', 'keys') }, { text: 'Create key pair' }];
        case 'volumes': return [root, { text: 'Volumes' }];
        case 'volume-create': return [root, { text: 'Volumes', route: at('ec2', 'volumes') }, { text: 'Create volume' }];
        case 'amis': return [root, { text: 'AMIs' }];
        default: return [root, { text: 'Dashboard' }];
        }
    }
    case 'vpc': {
        const root: Crumb = { text: 'VPC', route: at('vpc', 'vpcs') };
        const vpcs: Crumb = { text: 'Your VPCs', route: at('vpc', 'vpcs') };
        const subnets: Crumb = { text: 'Subnets', route: at('vpc', 'subnets') };
        const sgs: Crumb = { text: 'Security Groups', route: at('vpc', 'sgs') };
        switch (route.page) {
        case 'vpc-create': return [root, vpcs, { text: 'Create VPC' }];
        case 'vpc': return [root, vpcs, { text: p.id }];
        case 'subnets': return [root, { text: 'Subnets' }];
        case 'subnet-create': return [root, subnets, { text: 'Create subnet' }];
        case 'sgs': return [root, { text: 'Security Groups' }];
        case 'sg': return [root, sgs, { text: p.id }];
        case 'sg-create': return [root, sgs, { text: 'Create security group' }];
        case 'sg-inbound': return [root, sgs, { text: p.id, route: at('vpc', 'sg', { id: p.id }) },
            { text: 'Edit inbound rules' }];
        case 'sg-outbound': return [root, sgs, { text: p.id, route: at('vpc', 'sg', { id: p.id }) },
            { text: 'Edit outbound rules' }];
        case 'routes': return [root, { text: 'Route tables' }];
        case 'nats': return [root, { text: 'NAT gateways' }];
        case 'endpoints': return [root, { text: 'Endpoints' }];
        case 'endpoint-create': return [root, { text: 'Endpoints', route: at('vpc', 'endpoints') },
            { text: 'Create endpoint' }];
        default: return [root, { text: 'Your VPCs' }];
        }
    }
    case 'iam': {
        const root: Crumb = { text: 'IAM', route: at('iam', 'dashboard') };
        const users: Crumb = { text: 'Users', route: at('iam', 'users') };
        const roles: Crumb = { text: 'Roles', route: at('iam', 'roles') };
        switch (route.page) {
        case 'users': return [root, { text: 'Users' }];
        case 'user-create': return [root, users, { text: 'Create user' }];
        case 'user': return [root, users, { text: p.name }];
        case 'roles': return [root, { text: 'Roles' }];
        case 'role-create': return [root, roles, { text: 'Create role' }];
        case 'role': return [root, roles, { text: p.name }];
        case 'policies': return [root, { text: 'Policies' }];
        default: return [root, { text: 'Dashboard' }];
        }
    }
    case 'lambda': {
        const root: Crumb = { text: 'Lambda', route: at('lambda', 'functions') };
        const fns: Crumb = { text: 'Functions', route: at('lambda', 'functions') };
        if (route.page === 'create') return [root, fns, { text: 'Create function' }];
        if (route.page === 'function') return [root, fns, { text: p.name }];
        return [root, { text: 'Functions' }];
    }
    case 'dynamodb': {
        const root: Crumb = { text: 'DynamoDB', route: at('dynamodb', 'tables') };
        const tables: Crumb = { text: 'Tables', route: at('dynamodb', 'tables') };
        const explore: Crumb = { text: 'Explore items', route: at('dynamodb', 'explore', { name: p.name || '' }) };
        switch (route.page) {
        case 'create': return [root, tables, { text: 'Create table' }];
        case 'table': return [root, tables, { text: p.name }];
        case 'explore': return [root, { text: 'Explore items' }];
        case 'item-create': return [root, explore, { text: p.name, route: at('dynamodb', 'explore', { name: p.name }) },
            { text: 'Create item' }];
        default: return [root, { text: 'Tables' }];
        }
    }
    case 'rds': {
        const root: Crumb = { text: 'Aurora and RDS', route: at('rds', 'databases') };
        const dbs: Crumb = { text: 'Databases', route: at('rds', 'databases') };
        switch (route.page) {
        case 'create': return [root, dbs, { text: 'Create database' }];
        case 'database': return [root, dbs, { text: p.id }];
        case 'modify': return [root, dbs, { text: p.id, route: at('rds', 'database', { id: p.id }) },
            { text: 'Modify' }];
        case 'snapshots': return [root, { text: 'Snapshots' }];
        default: return [root, { text: 'Databases' }];
        }
    }
    case 'sqs': {
        const root: Crumb = { text: 'Amazon SQS', route: at('sqs', 'queues') };
        const queues: Crumb = { text: 'Queues', route: at('sqs', 'queues') };
        if (route.page === 'create') return [root, queues, { text: 'Create queue' }];
        if (route.page === 'queue') return [root, queues, { text: p.name || '' }];
        return [root, { text: 'Queues' }];
    }
    case 'sns': {
        const root: Crumb = { text: 'Amazon SNS', route: at('sns', 'topics') };
        const topics: Crumb = { text: 'Topics', route: at('sns', 'topics') };
        switch (route.page) {
        case 'create': return [root, topics, { text: 'Create topic' }];
        case 'topic': return [root, topics, { text: p.name || '' }];
        case 'subscriptions': return [root, { text: 'Subscriptions' }];
        case 'subscribe': return [root, { text: 'Subscriptions', route: at('sns', 'subscriptions') },
            { text: 'Create subscription' }];
        default: return [root, { text: 'Topics' }];
        }
    }
    case 'cloudwatch': {
        const root: Crumb = { text: 'CloudWatch', route: at('cloudwatch', 'groups') };
        if (route.page === 'alarms') return [root, { text: 'Alarms' }];
        const groups: Crumb = { text: 'Log groups', route: at('cloudwatch', 'groups') };
        if (route.page === 'group') return [root, groups, { text: p.name }];
        if (route.page === 'create') return [root, groups, { text: 'Create log group' }];
        return [root, { text: 'Log groups' }];
    }
    default:
        return dataCrumbs(route);
    }
}

const TITLES: Record<string, [string, ServiceId, string]> = {
    'kms/keys': ['Key Management Service (KMS)', 'kms', 'Customer managed keys'],
    'kms/create': ['Key Management Service (KMS)', 'kms', 'Create key'],
    'kms/key': ['Key Management Service (KMS)', 'kms', ''],
    'glue/databases': ['AWS Glue', 'glue', 'Databases'],
    'glue/tables': ['AWS Glue', 'glue', 'Tables'],
    'glue/table': ['AWS Glue', 'glue', ''],
    'glue/crawlers': ['AWS Glue', 'glue', 'Crawlers'],
    'glue/connections': ['AWS Glue', 'glue', 'Connections'],
    'glue/jobs': ['AWS Glue', 'glue', 'Jobs'],
    'glue/job': ['AWS Glue', 'glue', ''],
    'athena/editor': ['Amazon Athena', 'athena', 'Query editor'],
    'athena/workgroups': ['Amazon Athena', 'athena', 'Workgroups'],
    'lakeformation/permissions': ['AWS Lake Formation', 'lakeformation', 'Data lake permissions'],
    'lakeformation/tags': ['AWS Lake Formation', 'lakeformation', 'LF-Tags and permissions'],
    'lakeformation/admins': ['AWS Lake Formation', 'lakeformation', 'Administrative roles and tasks'],
    'lakeformation/locations': ['AWS Lake Formation', 'lakeformation', 'Data lake locations'],
    'kinesis/streams': ['Amazon Kinesis', 'kinesis', 'Data streams'],
    'kinesis/stream': ['Amazon Kinesis', 'kinesis', ''],
    'kinesis/firehose': ['Amazon Data Firehose', 'kinesis', 'Firehose streams'],
    'redshift/serverless': ['Amazon Redshift', 'redshift', 'Serverless dashboard'],
    'redshift/editor': ['Amazon Redshift', 'redshift', 'Query editor v2'],
    'stepfunctions/machines': ['Step Functions', 'stepfunctions', 'State machines'],
    'stepfunctions/create': ['Step Functions', 'stepfunctions', 'Create state machine'],
    'stepfunctions/machine': ['Step Functions', 'stepfunctions', ''],
    'stepfunctions/execution': ['Step Functions', 'stepfunctions', ''],
    'billing/explorer': ['Billing and Cost Management', 'billing', 'Cost Explorer'],
    'billing/budgets': ['Billing and Cost Management', 'billing', 'Budgets'],
    'billing/tags': ['Billing and Cost Management', 'billing', 'Cost allocation tags'],
};

function dataCrumbs(route: Route): Crumb[] {
    const entry = TITLES[`${route.svc}/${route.page}`];
    if (!entry) return [];
    const p = route.params || {};
    const svc = entry[1];
    const home: Record<string, string> = { kms: 'keys', glue: 'databases', athena: 'editor',
        lakeformation: 'permissions', kinesis: 'streams', redshift: 'serverless',
        stepfunctions: 'machines', billing: 'explorer' };
    const root: Crumb = { text: entry[0], route: at(svc, home[svc] || route.page) };
    if (entry[2]) return [root, { text: entry[2] }];
    const parent: Record<string, Crumb> = {
        'kms/key': { text: 'Customer managed keys', route: at('kms', 'keys') },
        'glue/table': { text: 'Tables', route: at('glue', 'tables') },
        'glue/job': { text: 'Jobs', route: at('glue', 'jobs') },
        'kinesis/stream': { text: 'Data streams', route: at('kinesis', 'streams') },
        'stepfunctions/machine': { text: 'State machines', route: at('stepfunctions', 'machines') },
        'stepfunctions/execution': { text: 'State machines', route: at('stepfunctions', 'machines') },
    };
    const middle = parent[`${route.svc}/${route.page}`];
    return middle ? [root, middle, { text: p.name || p.id || '' }] : [root, { text: p.name || p.id || '' }];
}
