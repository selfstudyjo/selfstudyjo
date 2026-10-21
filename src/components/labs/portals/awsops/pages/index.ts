/** Which page component draws which route (`svc/page`, or `svc/*` for a whole service). */
import type { Component } from 'vue';
import type { Route } from '../nav';
import AutoScaling from './AutoScaling.vue';
import Backup from './Backup.vue';
import CloudFormation from './CloudFormation.vue';
import CloudTrail from './CloudTrail.vue';
import CloudWatch from './CloudWatch.vue';
import Config from './Config.vue';
import Connect from './Connect.vue';
import ControlTower from './ControlTower.vue';
import Cost from './Cost.vue';
import Ec2Misc from './Ec2Misc.vue';
import Endpoints from './Endpoints.vue';
import GuardDuty from './GuardDuty.vue';
import Home from './Home.vue';
import IamMisc from './IamMisc.vue';
import Logs from './Logs.vue';
import IamPolicies from './IamPolicies.vue';
import IamRoles from './IamRoles.vue';
import IamUsers from './IamUsers.vue';
import IdentityCenter from './IdentityCenter.vue';
import ImageBuilder from './ImageBuilder.vue';
import Instances from './Instances.vue';
import LoadBalancing from './LoadBalancing.vue';
import NetworkAcls from './NetworkAcls.vue';
import Organizations from './Organizations.vue';
import Reachability from './Reachability.vue';
import Route53 from './Route53.vue';
import RouteTables from './RouteTables.vue';
import S3 from './S3.vue';
import Secrets from './Secrets.vue';
import SecurityGroups from './SecurityGroups.vue';
import SecurityHub from './SecurityHub.vue';
import Sns from './Sns.vue';
import SsmFleet from './SsmFleet.vue';
import SsmPatch from './SsmPatch.vue';
import SsmRun from './SsmRun.vue';
import SsmWindows from './SsmWindows.vue';
import TransitVpn from './TransitVpn.vue';
import Unknown from './Unknown.vue';
import VpcBasics from './VpcBasics.vue';
import Waf from './Waf.vue';

const PAGES: Record<string, Component> = {
  'home/home': Home,
  'organizations/*': Organizations, 'controltower/*': ControlTower, 'sso/*': IdentityCenter,
  'iam/users': IamUsers, 'iam/user': IamUsers, 'iam/user-create': IamUsers,
  'iam/roles': IamRoles, 'iam/role': IamRoles, 'iam/role-create': IamRoles,
  'iam/policies': IamPolicies, 'iam/policy': IamPolicies, 'iam/policy-create': IamPolicies,
  'iam/*': IamMisc,
  'vpc/vpcs': VpcBasics, 'vpc/vpc': VpcBasics, 'vpc/subnets': VpcBasics, 'vpc/subnet': VpcBasics,
  'vpc/subnet-create': VpcBasics, 'vpc/igws': VpcBasics, 'vpc/nats': VpcBasics,
  'vpc/route-tables': RouteTables, 'vpc/route-table': RouteTables,
  'vpc/acls': NetworkAcls, 'vpc/acl': NetworkAcls,
  'vpc/sgs': SecurityGroups, 'vpc/sg': SecurityGroups, 'vpc/sg-create': SecurityGroups,
  'ec2/sgs': SecurityGroups, 'ec2/sg': SecurityGroups, 'ec2/sg-create': SecurityGroups,
  'vpc/endpoints': Endpoints, 'vpc/endpoint-create': Endpoints,
  'vpc/reachability': Reachability, 'vpc/reachability-path': Reachability,
  'vpc/tgws': TransitVpn, 'vpc/tgw-attachments': TransitVpn, 'vpc/tgw-route-tables': TransitVpn, 'vpc/vpn': TransitVpn,
  'ec2/instances': Instances, 'ec2/instance': Instances, 'ec2/connect': Connect, 'ec2/eices': Connect,
  'ec2/load-balancers': LoadBalancing, 'ec2/target-groups': LoadBalancing, 'ec2/target-group': LoadBalancing,
  'ec2/asgs': AutoScaling, 'ec2/asg': AutoScaling,
  'ec2/*': Ec2Misc,
  'ssm/fleet': SsmFleet, 'ssm/sessions': SsmFleet,
  'ssm/patch': SsmPatch, 'ssm/baseline': SsmPatch,
  'ssm/windows': SsmWindows, 'ssm/window': SsmWindows,
  'ssm/run-command': SsmRun, 'ssm/command': SsmRun, 'ssm/parameters': SsmRun,
  'cloudwatch/log-groups': Logs, 'cloudwatch/log-group': Logs, 'cloudwatch/insights': Logs,
  'imagebuilder/*': ImageBuilder, 'backup/*': Backup, 'cloudwatch/*': CloudWatch, 'sns/*': Sns,
  'securityhub/*': SecurityHub, 'guardduty/*': GuardDuty, 'config/*': Config, 'cloudtrail/*': CloudTrail,
  'waf/*': Waf, 'cloudformation/*': CloudFormation, 's3/*': S3, 'secrets/*': Secrets, 'route53/*': Route53, 'cost/*': Cost,
};

export function pageFor(route: Route): Component {
  return PAGES[`${route.svc}/${route.page}`] || PAGES[`${route.svc}/*`] || Unknown;
}
