/** Which page component draws which route (`svc/page`). */
import type { Component } from 'vue';
import type { Route } from '../nav';
import Amis from './Amis.vue';
import CwGroup from './CwGroup.vue';
import CwGroups from './CwGroups.vue';
import DdbExplore from './DdbExplore.vue';
import DdbItemCreate from './DdbItemCreate.vue';
import DdbTable from './DdbTable.vue';
import DdbTables from './DdbTables.vue';
import Ec2Dashboard from './Ec2Dashboard.vue';
import Ec2Instance from './Ec2Instance.vue';
import Ec2Instances from './Ec2Instances.vue';
import Ec2Launch from './Ec2Launch.vue';
import Home from './Home.vue';
import IamDashboard from './IamDashboard.vue';
import IamPolicies from './IamPolicies.vue';
import IamRole from './IamRole.vue';
import IamRoleCreate from './IamRoleCreate.vue';
import IamRoles from './IamRoles.vue';
import IamUser from './IamUser.vue';
import IamUsers from './IamUsers.vue';
import KeyPairs from './KeyPairs.vue';
import LambdaCreate from './LambdaCreate.vue';
import LambdaFunction from './LambdaFunction.vue';
import LambdaList from './LambdaList.vue';
import RdsCreate from './RdsCreate.vue';
import RdsDatabase from './RdsDatabase.vue';
import RdsDatabases from './RdsDatabases.vue';
import RdsModify from './RdsModify.vue';
import RdsSnapshots from './RdsSnapshots.vue';
import S3Bucket from './S3Bucket.vue';
import S3Buckets from './S3Buckets.vue';
import S3Create from './S3Create.vue';
import S3Object from './S3Object.vue';
import SecurityGroups from './SecurityGroups.vue';
import SgCreate from './SgCreate.vue';
import SgDetail from './SgDetail.vue';
import SnsSubTable from './SnsSubTable.vue';
import SnsTopic from './SnsTopic.vue';
import SnsTopics from './SnsTopics.vue';
import SqsQueue from './SqsQueue.vue';
import SqsQueues from './SqsQueues.vue';
import Subnets from './Subnets.vue';
import Volumes from './Volumes.vue';
import VpcList from './VpcList.vue';
import Athena from './Athena.vue';
import Billing from './Billing.vue';
import CwAlarms from './CwAlarms.vue';
import GlueCatalog from './GlueCatalog.vue';
import GlueCrawlers from './GlueCrawlers.vue';
import GlueJobs from './GlueJobs.vue';
import Kinesis from './Kinesis.vue';
import KmsKeys from './KmsKeys.vue';
import LakeFormation from './LakeFormation.vue';
import Redshift from './Redshift.vue';
import StepFunctions from './StepFunctions.vue';
import VpcNetwork from './VpcNetwork.vue';

const PAGES: Record<string, Component> = {
  'home/home': Home,
  's3/buckets': S3Buckets,
  's3/create': S3Create,
  's3/bucket': S3Bucket,
  's3/object': S3Object,
  'ec2/dashboard': Ec2Dashboard,
  'ec2/instances': Ec2Instances,
  'ec2/launch': Ec2Launch,
  'ec2/instance': Ec2Instance,
  'ec2/amis': Amis,
  'ec2/sgs': SecurityGroups,
  'ec2/sg': SgDetail,
  'ec2/sg-inbound': SgDetail,
  'ec2/sg-create': SgCreate,
  'ec2/keys': KeyPairs,
  'ec2/key-create': KeyPairs,
  'ec2/volumes': Volumes,
  'ec2/volume-create': Volumes,
  'vpc/vpcs': VpcList,
  'vpc/vpc-create': VpcList,
  'vpc/subnets': Subnets,
  'vpc/subnet-create': Subnets,
  'vpc/sgs': SecurityGroups,
  'vpc/sg': SgDetail,
  'vpc/sg-inbound': SgDetail,
  'vpc/sg-create': SgCreate,
  'iam/dashboard': IamDashboard,
  'iam/users': IamUsers,
  'iam/user-create': IamUsers,
  'iam/user': IamUser,
  'iam/roles': IamRoles,
  'iam/role-create': IamRoleCreate,
  'iam/role': IamRole,
  'iam/policies': IamPolicies,
  'lambda/functions': LambdaList,
  'lambda/create': LambdaCreate,
  'lambda/function': LambdaFunction,
  'dynamodb/tables': DdbTables,
  'dynamodb/create': DdbTables,
  'dynamodb/table': DdbTable,
  'dynamodb/explore': DdbExplore,
  'dynamodb/item-create': DdbItemCreate,
  'rds/databases': RdsDatabases,
  'rds/create': RdsCreate,
  'rds/database': RdsDatabase,
  'rds/modify': RdsModify,
  'rds/snapshots': RdsSnapshots,
  'sqs/queues': SqsQueues,
  'sqs/create': SqsQueues,
  'sqs/queue': SqsQueue,
  'sns/topics': SnsTopics,
  'sns/create': SnsTopics,
  'sns/topic': SnsTopic,
  'sns/subscriptions': SnsSubTable,
  'sns/subscribe': SnsSubTable,
  'cloudwatch/groups': CwGroups,
  'cloudwatch/create': CwGroups,
  'cloudwatch/group': CwGroup,
  'cloudwatch/alarms': CwAlarms,
  'vpc/routes': VpcNetwork,
  'vpc/nats': VpcNetwork,
  'vpc/endpoints': VpcNetwork,
  'vpc/endpoint-create': VpcNetwork,
  'kms/keys': KmsKeys,
  'kms/create': KmsKeys,
  'kms/key': KmsKeys,
  'glue/databases': GlueCatalog,
  'glue/tables': GlueCatalog,
  'glue/table': GlueCatalog,
  'glue/connections': GlueCatalog,
  'glue/crawlers': GlueCrawlers,
  'glue/jobs': GlueJobs,
  'glue/job': GlueJobs,
  'athena/editor': Athena,
  'athena/workgroups': Athena,
  'lakeformation/permissions': LakeFormation,
  'lakeformation/tags': LakeFormation,
  'lakeformation/admins': LakeFormation,
  'lakeformation/locations': LakeFormation,
  'kinesis/streams': Kinesis,
  'kinesis/stream': Kinesis,
  'kinesis/firehose': Kinesis,
  'redshift/serverless': Redshift,
  'redshift/editor': Redshift,
  'stepfunctions/machines': StepFunctions,
  'stepfunctions/create': StepFunctions,
  'stepfunctions/machine': StepFunctions,
  'stepfunctions/execution': StepFunctions,
  'billing/explorer': Billing,
  'billing/budgets': Billing,
  'billing/tags': Billing,
};

export function pageFor(route: Route): Component {
  return PAGES[`${route.svc}/${route.page}`] || Home;
}
