/** The application navigator: what the All menu lists, and where each module goes. */
import type { Route } from './route';

export interface NavModule { label: string; route: Route; key: string }
export interface NavApp { label: string; modules: NavModule[] }

export const NAV: NavApp[] = [
  { label: 'Incident', modules: [
    { key: 'inc-new', label: 'Create New', route: { page: 'incident', id: '-1' } },
    { key: 'inc-mine', label: 'Assigned to me', route: { page: 'incident_list', filter: 'mine' } },
    { key: 'inc-open', label: 'Open', route: { page: 'incident_list', filter: 'open' } },
    { key: 'inc-unassigned', label: 'Open - Unassigned', route: { page: 'incident_list', filter: 'unassigned' } },
    { key: 'inc-group', label: 'My Groups Work', route: { page: 'incident_list', filter: 'group' } },
    { key: 'inc-p1', label: 'Critical Incidents', route: { page: 'incident_list', filter: 'p1' } },
    { key: 'inc-all', label: 'All', route: { page: 'incident_list', filter: 'all' } },
  ] },
  { label: 'Major Incidents', modules: [
    { key: 'mim', label: 'Major Incident Workbench', route: { page: 'major_list' } },
  ] },
  { label: 'Problem', modules: [
    { key: 'prb-new', label: 'Create New', route: { page: 'problem', id: '-1' } },
    { key: 'prb-all', label: 'All', route: { page: 'problem_list' } },
  ] },
  { label: 'Change', modules: [
    { key: 'chg-new', label: 'Create New', route: { page: 'change_new' } },
    { key: 'chg-all', label: 'All', route: { page: 'change_list' } },
  ] },
  { label: 'On-Call Scheduling', modules: [
    { key: 'oc', label: 'My On-Call Schedule', route: { page: 'oncall' } },
  ] },
  { label: 'Event Management', modules: [
    { key: 'em-alerts', label: 'All Alerts', route: { page: 'events', tab: 'alerts' } },
    { key: 'em-events', label: 'All Events', route: { page: 'events', tab: 'events' } },
    { key: 'em-rules', label: 'Event Rules', route: { page: 'events', tab: 'rules' } },
    { key: 'em-connectors', label: 'Connectors', route: { page: 'events', tab: 'integrations' } },
  ] },
  { label: 'Service Level Management', modules: [
    { key: 'slm-defs', label: 'SLA Definitions', route: { page: 'sla_defs' } },
    { key: 'slm-task', label: 'Task SLAs', route: { page: 'task_sla' } },
  ] },
];

export const DEFAULT_FAVORITES = ['inc-mine', 'inc-open', 'mim', 'oc', 'em-alerts', 'slm-task'];

export function moduleByKey(key: string): NavModule | undefined {
  for (const app of NAV) {
    const found = app.modules.find(m => m.key === key);
    if (found) return found;
  }
  return undefined;
}
