/** The skin's own navigation: which page is open, and what URL it is on. */
import { BASE, classic } from './snow';

export type IncidentFilter = 'open' | 'all' | 'mine' | 'group' | 'unassigned' | 'p1';
export type EventTab = 'alerts' | 'events' | 'rules' | 'integrations';

export type Route =
  | { page: 'sow' }
  | { page: 'sow-record'; id: string }
  | { page: 'incident_list'; filter: IncidentFilter; text?: string }
  | { page: 'incident'; id: string; preset?: Record<string, string> }
  | { page: 'problem_list' }
  | { page: 'problem'; id: string; preset?: Record<string, string> }
  | { page: 'change_list' }
  | { page: 'change_new'; preset?: Record<string, string> }
  | { page: 'change'; id: string; preset?: Record<string, string> }
  | { page: 'major_list' }
  | { page: 'major'; id: string }
  | { page: 'oncall' }
  | { page: 'events'; tab: EventTab }
  | { page: 'sla_defs' }
  | { page: 'task_sla' };

const FILTER_QUERY: Record<IncidentFilter, string> = {
  open: 'active=true^ORDERBYpriority',
  all: 'ORDERBYDESCnumber',
  mine: 'active=true^assigned_to=javascript:gs.getUserID()',
  group: 'active=true^assignment_groupDYNAMICd6435e965f510100a9ad2572f2b47744',
  unassigned: 'active=true^assigned_toISEMPTY',
  p1: 'active=true^priority=1',
};

export function urlFor(route: Route): string {
  switch (route.page) {
    case 'sow': return `${BASE}/now/sow/home`;
    case 'sow-record': return `${BASE}/now/sow/record/incident/${route.id}`;
    case 'incident_list': return classic(`incident_list.do?sysparm_query=${FILTER_QUERY[route.filter]}`);
    case 'incident': return classic(`incident.do?sys_id=${route.id}`);
    case 'problem_list': return classic('problem_list.do?sysparm_query=active=true');
    case 'problem': return classic(`problem.do?sys_id=${route.id}`);
    case 'change_list': return classic('change_request_list.do?sysparm_query=active=true');
    case 'change_new': return `${BASE}/now/nav/ui/classic/params/target/sn_chg_model_ui_landing.do`;
    case 'change': return classic(`change_request.do?sys_id=${route.id}`);
    case 'major_list': return classic('incident_list.do?sysparm_query=major_incident_state=accepted');
    case 'major': return `${BASE}/now/nav/ui/classic/params/target/%24major_incident_workbench.do%3Fsysparm_sys_id%3D${route.id}`;
    case 'oncall': return classic('$oc.do?sysparm_include_view=daily,weekly,monthly');
    case 'events': return classic({
      alerts: 'em_alert_list.do?sysparm_query=state!=Closed',
      events: 'em_event_list.do?sysparm_query=ORDERBYDESCsys_created_on',
      rules: 'em_match_rule_list.do',
      integrations: 'em_connector_instance_list.do',
    }[route.tab]);
    case 'sla_defs': return classic('contract_sla_list.do?sysparm_query=collection=incident');
    case 'task_sla': return classic('task_sla_list.do?sysparm_query=task.sys_class_name=incident');
  }
  return BASE;
}

export function sameRoute(a: Route, b: Route): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
