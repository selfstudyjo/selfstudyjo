/**
 * HCP Terraform portal - the plain half: routes and their URLs, how a run
 * status is drawn, and the command lines each button stands for.
 *
 * Every write the portal makes is a line a student could type:
 *
 *   New run - Plan and apply   terraform plan -out=tfplan        (Needs Confirmation)
 *   Confirm & apply            terraform apply tfplan            (the saved plan)
 *   Queue destroy plan         terraform plan -destroy -out=tfplan
 *   ... and confirm it         terraform destroy -auto-approve   (adopts that run)
 *   New run - Plan only        terraform plan
 *   Replace resources          -replace=ADDRESS on the plan
 *   Variables                  cat > terraform.tfvars <<'EOF' (HCP Terraform hands
 *                              workspace variables to Terraform as terraform.tfvars)
 *   Environment variables      cat > .envrc <<'EOF'   (export lines; TF_VAR_* feed vars)
 *   New workspace              terraform workspace new NAME
 *   Lock / Unlock / Discard    the HCP Terraform API call with curl - the product
 *                              has no CLI verb for them
 *   General settings / tags    PATCH /workspaces/:id, /relationships/tags (curl)
 *   Rollback state version     POST /workspaces/:id/state-versions (curl)
 */
import { cli, pick, quote, rows } from '@/utils/portalKit';

export const ORG_DEFAULT = 'selfstudy';
export const APP = 'https://app.terraform.io';
export const API = 'https://app.terraform.io/api/v2';
export const PLAN_FILE = 'tfplan';
export const TFVARS = 'terraform.tfvars';
export const ENVRC = '.envrc';

export type Page =
  | 'workspaces' | 'projects' | 'new-workspace' | 'registry' | 'usage' | 'org-settings'
  | 'overview' | 'runs' | 'run' | 'states' | 'state' | 'variables'
  | 'settings' | 'locking' | 'destruction';

export interface Route {
  page: Page;
  ws?: string;
  id?: string;
}

export const WS_PAGES: Page[] = ['overview', 'runs', 'run', 'states', 'state', 'variables',
  'settings', 'locking', 'destruction'];

export function routeUrl(route: Route, org: string): string {
  const base = `${APP}/app/${org}`;
  const ws = `${base}/workspaces/${route.ws || ''}`;
  switch (route.page) {
    case 'projects': return `${base}/projects`;
    case 'new-workspace': return `${base}/workspaces/new`;
    case 'registry': return `${base}/registry/private/modules`;
    case 'usage': return `${base}/usage`;
    case 'org-settings': return `${base}/settings/profile`;
    case 'overview': return ws;
    case 'runs': return `${ws}/runs`;
    case 'run': return `${ws}/runs/${route.id || ''}`;
    case 'states': return `${ws}/states`;
    case 'state': return `${ws}/states/${route.id || ''}`;
    case 'variables': return `${ws}/variables`;
    case 'settings': return `${ws}/settings/general`;
    case 'locking': return `${ws}/settings/lock`;
    case 'destruction': return `${ws}/settings/delete`;
    default: return `${base}/workspaces`;
  }
}

/* ---------------------------------------------------------------- view */

export interface TfRun {
  id: string;
  workspace: string;
  operation: 'plan_only' | 'plan_and_apply' | 'destroy' | string;
  status: string;
  created_at: string;
  plan_finished_at?: string;
  applied_at?: string;
  discarded_at?: string;
  discard_reason?: string;
  command: string;
  counts: { add: number; change: number; destroy: number };
  actions: TfAction[];
  has_changes: boolean;
  plan_log: string;
  apply_log: string;
  error: string;
  plan_file: string;
  replace: string[];
  comments: { body: string; at: string; user: string }[];
  serial_before?: number;
  serial_after?: number;
  version?: string;
}

export interface TfAction {
  action: 'create' | 'update' | 'replace' | 'destroy';
  address: string;
  type: string;
  name: string;
  reason: string;
  attributes: Record<string, unknown>;
  changes: { key: string; before: unknown; after: unknown; forces: boolean }[];
}

export interface TfWorkspace {
  name: string;
  id: string;
  current: boolean;
  resources: number;
  serial: number;
  outputs: { name: string; value: unknown }[];
  created_at: string;
  locked: boolean;
  lock: { id: string; reason: string; user: string; at: string } | null;
  latest_run: { id: string; status: string; operation: string; created_at: string;
                counts: TfRun['counts'] } | null;
  runs: number;
  version: string;
  description?: string;
  tags?: string[];
  auto_apply?: boolean;
  execution_mode?: 'local' | 'remote' | string;
}

export interface TfVariable {
  key: string;
  value: string;
  category: 'terraform' | 'env';
  hcl: boolean;
  sensitive: boolean;
  description: string;
  file: string;
  error: string;
}

export function org(view: unknown): string {
  return String(pick(view, 'organization', ORG_DEFAULT));
}

export function workspacesOf(view: unknown): TfWorkspace[] {
  const list = rows<TfWorkspace>(view, 'workspaces');
  if (list.length) return list;
  // A replica a release behind sends only `workspace`.
  const name = String(pick(view, 'workspace', 'default'));
  return [{
    name, id: '', current: true, resources: rows(view, 'state.resources').length,
    serial: Number(pick(view, 'state.serial', 0)), outputs: rows(view, 'outputs') as any,
    created_at: '', locked: false, lock: null, latest_run: null, runs: 0,
    version: String(pick(view, 'version', '')),
  }];
}

export function runsOf(view: unknown, ws?: string): TfRun[] {
  return rows<TfRun>(view, 'runs').filter(run => !ws || run.workspace === ws);
}

export function variablesOf(view: unknown): TfVariable[] {
  return rows<TfVariable>(view, 'variables');
}

/* -------------------------------------------------------------- statuses */

export interface StatusMeta { label: string; tone: 'success' | 'warning' | 'critical' | 'neutral' | 'highlight' | 'action'; icon: string }

export const STATUS: Record<string, StatusMeta> = {
  applied: { label: 'Applied', tone: 'success', icon: 'check-circle' },
  planned_and_finished: { label: 'Planned and finished', tone: 'success', icon: 'check-circle' },
  planned: { label: 'Needs Confirmation', tone: 'warning', icon: 'alert-circle' },
  errored: { label: 'Errored', tone: 'critical', icon: 'x-circle' },
  discarded: { label: 'Discarded', tone: 'neutral', icon: 'skip' },
  pending: { label: 'Pending', tone: 'neutral', icon: 'clock' },
  planning: { label: 'Planning', tone: 'action', icon: 'loading' },
  applying: { label: 'Applying', tone: 'action', icon: 'loading' },
};

export function statusMeta(status: string | undefined | null): StatusMeta {
  if (!status) return { label: 'No runs yet', tone: 'neutral', icon: 'minus-circle' };
  return STATUS[status] || { label: status, tone: 'neutral', icon: 'circle' };
}

export function operationLabel(operation: string): string {
  if (operation === 'plan_only') return 'Plan only';
  if (operation === 'destroy') return 'Destroy';
  return 'Plan and apply';
}

/* ----------------------------------------------------------------- times */

export function parseStamp(stamp: string | undefined): number {
  if (!stamp) return 0;
  const time = Date.parse(stamp);
  return Number.isFinite(time) ? time : 0;
}

export function ago(stamp: string | undefined, now = Date.now()): string {
  const time = parseStamp(stamp);
  if (!time) return '—';
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 45) return 'a few seconds ago';
  if (seconds < 90) return 'a minute ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 45) return `${minutes} minutes ago`;
  if (minutes < 90) return 'an hour ago';
  const hours = Math.round(minutes / 60);
  if (hours < 22) return `${hours} hours ago`;
  if (hours < 36) return 'a day ago';
  return `${Math.round(hours / 24)} days ago`;
}

export function longDate(stamp: string | undefined): string {
  const time = parseStamp(stamp);
  if (!time) return '—';
  return new Date(time).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function fmtValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return '[' + value.map(fmtValue).join(', ') + ']';
  return JSON.stringify(value);
}

export function shortRun(id: string): string {
  return id;
}

/* -------------------------------------------------------------- commands */

export function cmdInit(): string {
  return cli(['terraform', 'init']);
}

export function cmdPlan(kind: 'apply' | 'plan' | 'destroy', replace: string[] = []): string {
  const flags: Record<string, any> = {};
  if (kind === 'destroy') flags['-destroy'] = true;
  const base: (string | null)[] = ['terraform', 'plan'];
  let line = cli(base, flags);
  if (kind !== 'plan') line += ' ' + quote(`-out=${PLAN_FILE}`);
  for (const address of replace) line += ' ' + quote(`-replace=${address}`);
  return line;
}

export function cmdConfirm(run: TfRun): string {
  if (run.operation === 'destroy') return cli(['terraform', 'destroy'], { '-auto-approve': true });
  return cli(['terraform', 'apply', run.plan_file || PLAN_FILE]);
}

function apiCall(method: string, url: string, body?: unknown): string {
  // The bearer token stays a shell variable on purpose: the line is one a
  // student could paste with their own TFE_TOKEN exported.
  let line = cli(['curl', '-sS', '--fail-with-body', '-X', method]);
  line += ' -H "Authorization: Bearer $TFE_TOKEN"';
  line += ' ' + cli(['-H', 'Content-Type: application/vnd.api+json']);
  if (body !== undefined) line += ' ' + cli(['--data', JSON.stringify(body)]);
  line += ' ' + quote(url);
  return line;
}

export function cmdLock(wsId: string, reason: string): string {
  return apiCall('POST', `${API}/workspaces/${wsId}/actions/lock`, reason ? { reason } : undefined);
}

export function cmdUnlock(wsId: string, force = false): string {
  return apiCall('POST', `${API}/workspaces/${wsId}/actions/${force ? 'force-unlock' : 'unlock'}`);
}

export function cmdDiscard(runId: string, comment: string): string {
  return apiCall('POST', `${API}/runs/${runId}/actions/discard`, comment ? { comment } : undefined);
}

export function cmdComment(runId: string, body: string): string {
  return apiCall('POST', `${API}/runs/${runId}/comments`,
                 { data: { type: 'comments', attributes: { body } } });
}

/** General settings: PATCH /workspaces/:id with the attributes that changed. */
export function cmdUpdateWorkspace(wsId: string, attributes: Record<string, unknown>): string {
  return apiCall('PATCH', `${API}/workspaces/${wsId}`, { data: { type: 'workspaces', attributes } });
}

export function cmdTags(wsId: string, tags: string[], remove = false): string {
  return apiCall(remove ? 'DELETE' : 'POST', `${API}/workspaces/${wsId}/relationships/tags`,
                 { data: tags.map(name => ({ type: 'tags', attributes: { name } })) });
}

/** Rollback: a new state version whose content is an older one's. */
export function cmdRollback(wsId: string, versionId: string): string {
  return apiCall('POST', `${API}/workspaces/${wsId}/state-versions`, {
    data: { type: 'state-versions', relationships: {
      'rollback-state-version': { data: { type: 'state-versions', id: versionId } } } },
  });
}

export const TAG_NAME = /^[a-z0-9][a-z0-9:_-]{0,254}$/;
export const WS_NAME = /^[A-Za-z0-9_.-]{1,90}$/;

export function cmdWorkspace(verb: 'new' | 'select' | 'delete', name: string, force = false): string {
  return cli(['terraform', 'workspace', verb, name], { '-force': force });
}

/* ------------------------------------------------------------- variables */

export const TF_KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;
export const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function oneLine(text: string): string {
  return String(text || '').replace(/[\r\n]+/g, ' ').trim();
}

function heredoc(path: string, lines: string[]): string {
  const body = lines.join('\n');
  // A body line that is exactly the marker would end the document early.
  const marker = body.split('\n').some(line => line.trim() === 'EOF') ? 'TFVARS_EOF' : 'EOF';
  return `cat > ${path} <<'${marker}'\n${body}${body ? '\n' : ''}${marker}`;
}

/** terraform.tfvars as the Variables page keeps it. */
export function cmdWriteTfvars(vars: TfVariable[]): string {
  const lines: string[] = [];
  vars.forEach((item, index) => {
    if (index) lines.push('');
    if (item.description) lines.push(`# description: ${oneLine(item.description)}`);
    if (item.sensitive) lines.push('# sensitive');
    const value = item.hcl ? oneLine(item.value) || '""' : JSON.stringify(String(item.value ?? ''));
    lines.push(`${item.key} = ${value}`);
  });
  return heredoc(TFVARS, lines);
}

/** .envrc: environment variables as export lines. */
export function cmdWriteEnvrc(vars: TfVariable[]): string {
  const lines: string[] = [];
  vars.forEach((item, index) => {
    if (index) lines.push('');
    if (item.description) lines.push(`# description: ${oneLine(item.description)}`);
    if (item.sensitive) lines.push('# sensitive');
    lines.push(`export ${item.key}=${quote(String(item.value ?? '').replace(/[\r\n]+/g, ' '))}`);
  });
  return heredoc(ENVRC, lines);
}

/** The cloud block a CLI-driven workspace's empty state tells you to add. */
export function cloudBlock(orgName: string, ws: string): string {
  return `terraform {\n  cloud {\n    organization = "${orgName}"\n\n    workspaces {\n      name = "${ws}"\n    }\n  }\n}`;
}
