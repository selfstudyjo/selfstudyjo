/**
 * The ServiceNow skin's plain half: reading the `snow` read model out of the
 * cloudops view, the choice lists the forms draw, and building every command
 * line a form stands for.
 *
 * Every builder returns the exact `snow …` line a student could type — the
 * portal never writes any other way (see ../README.md). `_portal_servicenow.py`
 * on app 11 builds the same strings and runs them against the engine, so a
 * change here should be mirrored there.
 */
import { cli, pick, rows } from '@/utils/portalKit';

export const HOST = 'acme.service-now.com';
export const BASE = `https://${HOST}`;

export interface Sla {
  name: string; definition: string; type: string; target: number; target_text: string;
  elapsed: number; elapsed_text: string; left: number; percent: number; stage: string;
  has_breached: boolean; start: string; stop: string; breach_time: string; paused: number;
}
export interface Note { kind: string; text: string; by: string; at: string; minute: number }
export interface MajorUpdate { at: string; audience: string; text: string }
export interface Major {
  declared: string; manager: string; bridge: string; missed: number; resolved: string;
  pir: string; last_update: string; next_due: string; overdue: boolean; updates: MajorUpdate[];
}
export interface Incident {
  number: string; short: string; description: string; caller: string; category: string;
  subcategory: string; channel: string; source: string; ci: string; impact: number;
  urgency: number; priority: number; state: string; hold_reason: string; group: string;
  assigned_to: string; opened: string; opened_minute: number; acked: string;
  responded: string; resolved: string; closed: string; events: number; problem: string;
  change: string; parent: string; reassignments: number; resolution_code: string;
  resolution_notes: string; reprioritised: { at: string; from: number; to: number; reason: string }[];
  notes: Note[]; slas: Sla[]; major: Major | null;
}
export interface Problem {
  number: string; short: string; state: string; description: string; ci: string;
  incidents: string[]; cause: string; workaround: string; fix_change: string; opened: string;
  known_error: boolean;
}
export interface Change {
  number: string; type: string; short: string; state: string; ci: string; risk: string;
  plan: string; backout: string; test: string; start: string; start_minute: number; end: string;
  duration: number; duration_text: string; template: string; incident: string;
  approvals: { by: string; at: string }[]; implemented: string; result: string; notes: string;
  review: string; opened: string; in_freeze: boolean; lead_minutes: number;
}
export interface Page {
  id: string; incident: string; group: string; who: string; level: number; status: string;
  sent: string; acked_by: string; acked_at: string; history: { at: string; who: string; what: string }[];
}
export interface Group {
  name: string; manager: string; members: string[]; primary: string; secondary: string;
  escalation: { who: string; after: number }[];
}
export interface Person { id: string; name: string; role: string }
export interface SnEvent {
  at: string; source: string; node: string; type: string; severity: string; resource: string;
  state: string; incident: string; action: string;
}
export interface Rule {
  name: string; source: string; match: string; impact: number; urgency: number; priority: number;
  group: string; ignore: boolean;
}
export interface Integration { source: string; endpoint: string; group: string; auto_resolve: boolean; received: number }
export interface Template { id: string; name: string; ci: string }
export interface Choices {
  cis: string[]; categories: Record<string, string[]>; channels: string[]; states: string[];
  hold_reasons: string[]; resolution_codes: string[]; change_types: string[]; risks: string[];
  templates: Template[]; sla_targets: { priority: number; pickup: number; response: number; restore: number }[];
  major_cadence: number; normal_lead: number;
}

const DEFAULT_CHOICES: Choices = {
  cis: [], categories: {}, channels: [], states: ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed', 'Canceled'],
  hold_reasons: ['awaiting-caller', 'awaiting-vendor', 'awaiting-change', 'awaiting-problem'],
  resolution_codes: [], change_types: ['normal', 'standard', 'emergency'], risks: ['low', 'moderate', 'high'],
  templates: [], sla_targets: [], major_cadence: 30, normal_lead: 1440,
};

/** Everything the screens read, never throwing on a replica a release behind. */
export function readModel(view: unknown) {
  const choices = { ...DEFAULT_CHOICES, ...pick<Partial<Choices>>(view, 'snow.choices', {}) };
  return {
    instance: pick(view, 'snow.instance', HOST),
    user: pick(view, 'snow.user', 'ops.engineer'),
    userName: pick(view, 'snow.user_name', 'You'),
    time: pick(view, 'snow.time', pick(view, 'clock.time', '')),
    minute: pick(view, 'snow.minute', 0),
    incidents: rows<Incident>(view, 'snow.incidents').map(normaliseIncident),
    problems: rows<Problem>(view, 'snow.problems').map(p => ({ ...p, incidents: p.incidents || [] })),
    changes: rows<Change>(view, 'snow.changes').map(c => ({ ...c, approvals: c.approvals || [] })),
    pages: rows<Page>(view, 'snow.pages').map(p => ({ ...p, history: p.history || [] })),
    groups: rows<Group>(view, 'snow.groups').map(g => ({ ...g, members: g.members || [], escalation: g.escalation || [] })),
    people: rows<Person>(view, 'snow.people'),
    events: rows<SnEvent>(view, 'snow.events'),
    rules: rows<Rule>(view, 'snow.rules'),
    integrations: rows<Integration>(view, 'snow.integrations'),
    files: pick<string[]>(view, 'snow.files', []),
    choices,
  };
}
export type Model = ReturnType<typeof readModel>;

function normaliseIncident(row: Incident): Incident {
  return { ...row, notes: row.notes || [], slas: row.slas || [], reprioritised: row.reprioritised || [] };
}

// ---------------------------------------------------------------------------
// Labels, the way the platform spells them
// ---------------------------------------------------------------------------

export const PRIORITY_LABEL: Record<number, string> = {
  1: '1 - Critical', 2: '2 - High', 3: '3 - Moderate', 4: '4 - Low', 5: '5 - Planning',
};
export const LEVEL_LABEL: Record<number, string> = { 1: '1 - High', 2: '2 - Medium', 3: '3 - Low' };
export const PRIORITY_MATRIX: Record<string, number> = {
  '1,1': 1, '1,2': 2, '2,1': 2, '1,3': 3, '2,2': 3, '3,1': 3, '2,3': 4, '3,2': 4, '3,3': 5,
};
export function priorityOf(impact: number, urgency: number): number {
  return PRIORITY_MATRIX[`${impact},${urgency}`] || 5;
}
export const HOLD_LABEL: Record<string, string> = {
  'awaiting-caller': 'Awaiting Caller', 'awaiting-vendor': 'Awaiting Vendor',
  'awaiting-change': 'Awaiting Change', 'awaiting-problem': 'Awaiting Problem',
};
export const SLA_LABEL: Record<string, string> = {
  'pick-up': 'Pick-up', response: 'Response', restore: 'Resolution (restore)',
};
export const STAGE_LABEL: Record<string, string> = {
  'in progress': 'In progress', paused: 'Paused', achieved: 'Achieved', breached: 'Breached',
  cancelled: 'Cancelled',
};
export const CHANGE_STATES = ['New', 'Assess', 'Authorize', 'Scheduled', 'Implement', 'Review', 'Closed'];
export const CLOSE_CODES: { value: string; label: string }[] = [
  { value: 'successful', label: 'Successful' },
  { value: 'unsuccessful', label: 'Unsuccessful' },
  { value: 'backed-out', label: 'Backed out' },
];

export function cap(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function personName(model: Model, id: string): string {
  if (!id) return '';
  return model.people.find(p => p.id === id)?.name || id;
}

/** The worst running SLA, as the list's "SLA" bar shows it. */
export function worstSla(row: Incident): Sla | null {
  const live = row.slas.filter(s => s.stage !== 'cancelled');
  if (!live.length) return null;
  const breached = live.find(s => s.stage === 'breached');
  if (breached) return breached;
  const running = live.filter(s => s.stage === 'in progress' || s.stage === 'paused');
  if (running.length) return running.reduce((a, b) => (b.percent > a.percent ? b : a));
  return live.reduce((a, b) => (b.percent > a.percent ? b : a));
}

export function isOpen(row: Incident): boolean {
  return ['New', 'In Progress', 'On Hold'].includes(row.state);
}

export function myGroups(model: Model): string[] {
  return model.groups.filter(g => g.members.includes(model.user)).map(g => g.name);
}

/** The next number the instance will mint, for the read-only Number field. */
export function nextNumber(prefix: string, base: number, existing: string[]): string {
  let max = base;
  for (const id of existing) {
    const n = Number(String(id).replace(/\D/g, ''));
    if (n > max) max = n;
  }
  return prefix + String(max + 1).padStart(7, '0');
}

export function mintedNumber(output: string | undefined, prefix: string): string {
  const match = String(output || '').match(new RegExp(`\\b(${prefix}\\d{7})\\b`));
  return match ? match[1] : '';
}

// ---------------------------------------------------------------------------
// URLs the real instance shows
// ---------------------------------------------------------------------------

export function classic(target: string): string {
  return `${BASE}/now/nav/ui/classic/params/target/${encodeURIComponent(target)}`;
}

// ---------------------------------------------------------------------------
// Command builders. One per form action; nothing else writes.
// ---------------------------------------------------------------------------

export interface IncidentDraft {
  short: string; description: string; caller: string; category: string; subcategory: string;
  channel: string; ci: string; impact: number; urgency: number; group: string; assigned_to: string;
}

export const cmd = {
  incidentList: () => cli(['snow', 'incident', 'list'], { '--all': true }),
  sla: (number?: string) => cli(['snow', 'sla', number || null]),
  incidentCreate: (d: IncidentDraft) => cli(['snow', 'incident', 'create'], {
    '--short': d.short, '--ci': d.ci, '--impact': d.impact, '--urgency': d.urgency,
    '--group': d.group, '--caller': d.caller, '--description': d.description,
    '--category': d.category, '--subcategory': d.subcategory, '--channel': d.channel,
  }),
  incidentUpdate: (number: string, fields: Partial<Record<'short' | 'description' | 'ci' | 'caller' | 'category' | 'subcategory' | 'channel', string>>) =>
    cli(['snow', 'incident', 'update', number], {
      '--short': fields.short, '--description': fields.description, '--ci': fields.ci,
      '--caller': fields.caller, '--category': fields.category,
      '--subcategory': fields.subcategory, '--channel': fields.channel,
    }),
  incidentPriority: (number: string, impact: number, urgency: number, reason: string) =>
    cli(['snow', 'incident', 'priority', number], { '--impact': impact, '--urgency': urgency, '--reason': reason }),
  incidentAssign: (number: string, group: string, to?: string) =>
    cli(['snow', 'incident', 'assign', number], { '--group': group, '--to': to }),
  incidentAck: (number: string) => cli(['snow', 'incident', 'ack', number]),
  incidentComment: (number: string, text: string) => cli(['snow', 'incident', 'comment', number], { '--text': text }),
  incidentWorknote: (number: string, text: string) => cli(['snow', 'incident', 'worknote', number], { '--text': text }),
  incidentHold: (number: string, reason: string) => cli(['snow', 'incident', 'hold', number], { '--reason': reason }),
  incidentResume: (number: string) => cli(['snow', 'incident', 'resume', number]),
  incidentResolve: (number: string, code: string, notes: string) =>
    cli(['snow', 'incident', 'resolve', number], { '--code': code, '--notes': notes }),
  incidentClose: (number: string) => cli(['snow', 'incident', 'close', number]),
  incidentCancel: (number: string, reason: string) => cli(['snow', 'incident', 'cancel', number], { '--reason': reason }),
  incidentDelete: (number: string) => cli(['snow', 'incident', 'delete', number]),
  incidentLink: (number: string, kind: 'problem' | 'change' | 'parent', target: string) =>
    cli(['snow', 'incident', 'link', number], { [`--${kind}`]: target }),

  problemCreate: (short: string, incidents: string[], ci?: string, description?: string) =>
    cli(['snow', 'problem', 'create'], { '--short': short, '--incidents': incidents.join(','), '--ci': ci, '--description': description }),
  problemUpdate: (number: string, fields: { short?: string; description?: string; ci?: string }) =>
    cli(['snow', 'problem', 'update', number], { '--short': fields.short, '--description': fields.description, '--ci': fields.ci }),
  problemRca: (number: string, cause: string) => cli(['snow', 'problem', 'rca', number], { '--cause': cause }),
  problemWorkaround: (number: string, text: string) => cli(['snow', 'problem', 'workaround', number], { '--text': text }),
  problemFix: (number: string, change: string) => cli(['snow', 'problem', 'fix', number], { '--change': change }),
  problemClose: (number: string) => cli(['snow', 'problem', 'close', number]),
  problemDelete: (number: string) => cli(['snow', 'problem', 'delete', number]),

  changeCreate: (d: { type: string; template?: string; short?: string; ci?: string; risk?: string; plan?: string;
    backout?: string; test?: string; start?: string; duration?: string; incident?: string }) =>
    cli(['snow', 'change', 'create'], {
      '--type': d.type, '--template': d.template, '--short': d.short, '--ci': d.ci, '--risk': d.risk,
      '--plan': d.plan, '--backout': d.backout, '--test-plan': d.test, '--start': d.start,
      '--duration': d.duration, '--incident': d.incident,
    }),
  changeUpdate: (number: string, d: { short?: string; ci?: string; risk?: string; plan?: string; backout?: string;
    test?: string; start?: string; duration?: string; incident?: string }) =>
    cli(['snow', 'change', 'update', number], {
      '--short': d.short, '--ci': d.ci, '--risk': d.risk, '--plan': d.plan, '--backout': d.backout,
      '--test-plan': d.test, '--start': d.start, '--duration': d.duration, '--incident': d.incident,
    }),
  changeSubmit: (number: string) => cli(['snow', 'change', 'submit', number]),
  changeApprove: (number: string, as: 'cab' | 'ecab') => cli(['snow', 'change', 'approve', number], { '--as': as }),
  changeImplement: (number: string) => cli(['snow', 'change', 'implement', number]),
  changeComplete: (number: string, result: string, notes: string) =>
    cli(['snow', 'change', 'complete', number], { '--result': result, '--notes': notes }),
  changeReview: (number: string, notes: string) => cli(['snow', 'change', 'review', number], { '--notes': notes }),
  changeCancel: (number: string, reason: string) => cli(['snow', 'change', 'cancel', number], { '--reason': reason }),
  changeDelete: (number: string) => cli(['snow', 'change', 'delete', number]),

  majorDeclare: (number: string, manager: string) => cli(['snow', 'major', 'declare', number], { '--manager': manager }),
  majorBridge: (number: string, url: string) => cli(['snow', 'major', 'bridge', number], { '--url': url }),
  majorUpdate: (number: string, audience: string, text: string) =>
    cli(['snow', 'major', 'update', number], { '--audience': audience, '--text': text }),
  majorResolve: (number: string) => cli(['snow', 'major', 'resolve', number]),
  majorPir: (number: string, file: string) => cli(['snow', 'major', 'pir', number], { '--file': file }),

  oncallSet: (group: string, primary?: string, secondary?: string) =>
    cli(['snow', 'oncall', 'set'], { '--group': group, '--primary': primary, '--secondary': secondary }),
  oncallPolicy: (group: string, steps: { who: string; after: number }[]) =>
    cli(['snow', 'oncall', 'policy'], { '--group': group, '--steps': steps.map(s => `${s.who}:${s.after}`).join(',') }),
  oncallClear: (group: string) => cli(['snow', 'oncall', 'policy'], { '--group': group, '--clear': true }),
  oncallPage: (number: string) => cli(['snow', 'oncall', 'page', number]),
  oncallAck: (page: string) => cli(['snow', 'oncall', 'ack', page]),

  integrationAdd: (source: string, group: string, autoResolve: boolean) =>
    cli(['snow', 'integration', 'add', source], { '--group': group, '--auto-resolve': autoResolve }),
  integrationDelete: (source: string) => cli(['snow', 'integration', 'delete', source]),
  ruleAdd: (r: { name: string; source: string; match: string; impact: number; urgency: number; group: string; ignore: boolean }) =>
    // --ignore last: it is a bare flag and must not swallow a following value.
    cli(['snow', 'event', 'rule', 'add'], {
      '--name': r.name, '--source': r.source, '--match': r.match, '--impact': r.impact,
      '--urgency': r.urgency, '--group': r.group, '--ignore': r.ignore,
    }),
  ruleDelete: (name: string) => cli(['snow', 'event', 'rule', 'delete'], { '--name': name }),
};

// ---------------------------------------------------------------------------
// Record identity: the 32-hex sys_id and the URL a record lives at
// ---------------------------------------------------------------------------

/**
 * A stable 32-character sys_id for a record. The simulated instance keys its
 * records by number, so the sys_id is DERIVED from (table, number) - the same
 * record always copies the same sys_id, and two records never share one.
 */
export function sysId(table: string, key: string): string {
  let out = '';
  let seed = 0x811c9dc5;
  const text = `${table}:${key}`;
  for (let round = 0; round < 4; round += 1) {
    let h = seed ^ round;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    seed = h;
    out += h.toString(16).padStart(8, '0');
  }
  return out;
}

export function recordUrl(table: string, key: string): string {
  return `${BASE}/${table}.do?sys_id=${sysId(table, key)}`;
}

/** One CSV cell, quoted when it needs to be (RFC 4180). */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
