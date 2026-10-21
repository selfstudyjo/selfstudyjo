/**
 * JQL, the subset Jira's issue navigator users actually type, over the view.
 *
 * Plain on purpose (no component, no Vue): searching is a READ, so it never
 * becomes an `mgr` command - it filters the issues the view already carries.
 * What it supports is what a student meets in the first week of Jira:
 *
 *   project = PLAT AND status = "In Progress" AND assignee = Karim
 *   labels in (q3-goal, tech-debt) AND sprint in openSprints()
 *   summary ~ "pager" OR text ~ outage
 *   "story points" >= 5 AND flagged is not EMPTY ORDER BY priority DESC, key
 *
 * Errors read the way Jira's do ("Field 'x' does not exist or you do not have
 * permission to view it."), because learning to read that message is part of
 * learning JQL. Anything outside the subset is an error, never a silent match.
 */
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, sprintName, type Issue } from './jiraKit';

export interface JqlContext {
    sprint: number;
    committed: string[];
    people: { id: string; name: string }[];
}

export interface OrderTerm { field: string; dir: 'asc' | 'desc' }

export interface JqlResult {
    ok: boolean;
    error: string;
    test: (issue: Issue) => boolean;
    order: OrderTerm[];
}

type Token = { kind: 'word' | 'string' | 'op' | 'punct'; value: string };

const OPS = ['!=', '>=', '<=', '!~', '=', '~', '>', '<'];

export function tokenize(text: string): Token[] {
    const out: Token[] = [];
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === '"' || ch === "'") {
            let j = i + 1;
            let value = '';
            while (j < text.length && text[j] !== ch) {
                if (text[j] === '\\' && j + 1 < text.length) { value += text[j + 1]; j += 2; continue; }
                value += text[j++];
            }
            if (j >= text.length) throw new Error(`Error in the JQL Query: The quoted string ${ch}${value} has not been completed.`);
            out.push({ kind: 'string', value });
            i = j + 1;
            continue;
        }
        if (ch === '(' || ch === ')' || ch === ',') { out.push({ kind: 'punct', value: ch }); i++; continue; }
        const op = OPS.find(candidate => text.startsWith(candidate, i));
        if (op) { out.push({ kind: 'op', value: op }); i += op.length; continue; }
        let j = i;
        while (j < text.length && !/[\s(),=!~<>"']/.test(text[j])) j++;
        if (j === i) throw new Error(`Error in the JQL Query: The character '${ch}' is a reserved JQL character.`);
        out.push({ kind: 'word', value: text.slice(i, j) });
        i = j;
    }
    return out;
}

// ---- fields ---------------------------------------------------------------

type Getter = (issue: Issue, ctx: JqlContext) => string | number | string[] | null;

interface Field { name: string; kind: 'text' | 'value' | 'number' | 'list'; get: Getter; values?: string[] }

const statusValues = ['To Do', 'In Progress', 'Done', 'todo', 'doing', 'done'];
const lastSprint = (issue: Issue) => (issue.events.length ? issue.events[issue.events.length - 1].sprint : issue.created) || 0;

const FIELDS: Record<string, Field> = {
    project: { name: 'project', kind: 'value', get: () => ['PLAT', 'Platform'] },
    key: { name: 'key', kind: 'value', get: issue => issue.id },
    summary: { name: 'summary', kind: 'text', get: issue => issue.title },
    description: { name: 'description', kind: 'text', get: issue => issue.description },
    text: { name: 'text', kind: 'text',
            get: issue => [issue.title, issue.description, ...issue.comments.map(c => c.body)].join('\n') },
    comment: { name: 'comment', kind: 'text', get: issue => issue.comments.map(c => c.body).join('\n') },
    status: { name: 'status', kind: 'value', values: statusValues,
              get: issue => [STATUS_LABEL[issue.status] || issue.status, issue.status] },
    statuscategory: { name: 'statusCategory', kind: 'value', values: statusValues,
                      get: issue => [STATUS_LABEL[issue.status] || issue.status, issue.status] },
    assignee: { name: 'assignee', kind: 'value',
                get: issue => issue.assignee_id ? [issue.assignee_id, issue.assignee, issue.assignee.split(' ')[0]] : null },
    reporter: { name: 'reporter', kind: 'value', get: () => ['you', 'currentuser()'] },
    type: { name: 'type', kind: 'value', values: Object.values(TYPE_LABEL),
            get: issue => [TYPE_LABEL[issue.type] || issue.type, issue.type] },
    priority: { name: 'priority', kind: 'value', values: Object.values(PRIORITY_LABEL),
                get: issue => [PRIORITY_LABEL[issue.value] || issue.value, issue.value] },
    labels: { name: 'labels', kind: 'list', get: issue => issue.labels.length ? issue.labels : null },
    component: { name: 'component', kind: 'value', get: issue => issue.skill || null },
    sprint: { name: 'sprint', kind: 'value',
              get: (issue, ctx) => {
                  const n = ctx.committed.includes(issue.id) ? ctx.sprint : Number(issue.sprint || 0);
                  return n ? [String(n), sprintName(n)] : null;
              } },
    'story points': { name: 'Story point estimate', kind: 'number', get: issue => issue.points },
    flagged: { name: 'flagged', kind: 'value', get: issue => issue.flagged ? ['Impediment', 'true', 'yes'] : null },
    'key result': { name: 'Key result', kind: 'value', get: issue => issue.kr || null },
    created: { name: 'created', kind: 'number', get: issue => issue.created },
    updated: { name: 'updated', kind: 'number', get: issue => lastSprint(issue) },
    watcher: { name: 'watcher', kind: 'value', get: issue => issue.watching ? ['you', 'currentuser()'] : null },
    issuelinktype: { name: 'issueLinkType', kind: 'list', get: issue => issue.links.length ? issue.links.map(l => l.type) : null },
};
const ALIASES: Record<string, string> = {
    issuekey: 'key', id: 'key', issue: 'key', title: 'summary', issuetype: 'type', label: 'labels',
    components: 'component', storypoints: 'story points', 'story point estimate': 'story points',
    points: 'story points', 'cf[10016]': 'story points', kr: 'key result', watchers: 'watcher',
    createddate: 'created', updateddate: 'updated',
};

export const JQL_FIELDS = Object.keys(FIELDS);

function field(name: string): Field {
    const key = name.toLowerCase();
    const found = FIELDS[key] || FIELDS[ALIASES[key]];
    if (!found) throw new Error(`Field '${name}' does not exist or you do not have permission to view it.`);
    return found;
}

// ---- parser ---------------------------------------------------------------

type Pred = (issue: Issue) => boolean;

class Parser {
    private at = 0;
    constructor(private tokens: Token[], private ctx: JqlContext) {}

    peek(offset = 0) { return this.tokens[this.at + offset]; }
    isWord(value: string, offset = 0) {
        const t = this.peek(offset);
        return Boolean(t && t.kind === 'word' && t.value.toLowerCase() === value);
    }
    take() { return this.tokens[this.at++]; }
    expectPunct(value: string) {
        const t = this.take();
        if (!t || t.kind !== 'punct' || t.value !== value) {
            throw new Error(`Error in the JQL Query: Expecting '${value}' but got '${t ? t.value : 'the end of the query'}'.`);
        }
    }

    parse(): { test: Pred; order: OrderTerm[] } {
        let test: Pred = () => true;
        if (this.peek() && !this.isWord('order')) test = this.or();
        const order: OrderTerm[] = [];
        if (this.isWord('order')) {
            this.take();
            if (!this.isWord('by')) throw new Error("Error in the JQL Query: Expecting 'by' after 'order'.");
            this.take();
            do {
                if (this.peek()?.kind === 'punct' && this.peek()!.value === ',') this.take();
                const t = this.take();
                if (!t || (t.kind !== 'word' && t.kind !== 'string')) throw new Error('Error in the JQL Query: Expecting a field name after ORDER BY.');
                const name = t.value.toLowerCase() === 'rank' ? 'rank' : field(t.value).name;
                let dir: 'asc' | 'desc' = 'asc';
                if (this.isWord('asc') || this.isWord('desc')) dir = this.take().value.toLowerCase() as 'asc' | 'desc';
                order.push({ field: name, dir });
            } while (this.peek()?.kind === 'punct' && this.peek()!.value === ',');
        }
        if (this.peek()) throw new Error(`Error in the JQL Query: Expecting either 'OR' or 'AND' but got '${this.peek()!.value}'.`);
        return { test, order };
    }

    or(): Pred {
        let left = this.and();
        while (this.isWord('or')) {
            this.take();
            const right = this.and();
            const a = left;
            left = issue => a(issue) || right(issue);
        }
        return left;
    }

    and(): Pred {
        let left = this.not();
        while (this.isWord('and')) {
            this.take();
            const right = this.not();
            const a = left;
            left = issue => a(issue) && right(issue);
        }
        return left;
    }

    not(): Pred {
        if (this.isWord('not')) { this.take(); const inner = this.not(); return issue => !inner(issue); }
        const t = this.peek();
        if (t && t.kind === 'punct' && t.value === '(') {
            this.take();
            const inner = this.or();
            this.expectPunct(')');
            return inner;
        }
        return this.clause();
    }

    value(): string {
        const t = this.take();
        if (!t) throw new Error('Error in the JQL Query: Expecting a value but reached the end of the query.');
        if (t.kind === 'punct' || t.kind === 'op') throw new Error(`Error in the JQL Query: Expecting a value but got '${t.value}'.`);
        if (t.kind === 'word' && this.peek()?.kind === 'punct' && this.peek()!.value === '(') {
            this.take();
            this.expectPunct(')');
            return t.value.toLowerCase() + '()';
        }
        return t.value;
    }

    clause(): Pred {
        const t = this.take();
        if (!t || (t.kind !== 'word' && t.kind !== 'string')) {
            throw new Error(`Error in the JQL Query: Expecting a field name but got '${t ? t.value : 'the end of the query'}'.`);
        }
        let name = t.value;
        // "story points" written unquoted as two words
        if (name.toLowerCase() === 'story' && this.isWord('points')) { this.take(); name = 'story points'; }
        const f = field(name);
        const ctx = this.ctx;
        const read = (issue: Issue) => f.get(issue, ctx);

        if (this.isWord('is')) {
            this.take();
            let negate = false;
            if (this.isWord('not')) { this.take(); negate = true; }
            if (!this.isWord('empty') && !this.isWord('null')) throw new Error("Error in the JQL Query: Expecting 'EMPTY' after 'IS'.");
            this.take();
            const empty = (issue: Issue) => { const v = read(issue); return v === null || v === '' || (Array.isArray(v) && !v.length); };
            return negate ? issue => !empty(issue) : empty;
        }
        let negateIn = false;
        if (this.isWord('not') && this.isWord('in', 1)) { this.take(); negateIn = true; }
        if (this.isWord('in')) {
            this.take();
            const list: string[] = [];
            if (this.peek()?.kind === 'word' && /\w+/.test(this.peek()!.value) && this.peek(1)?.kind === 'punct' && this.peek(1)!.value === '(' && this.peek(2)?.value === ')') {
                list.push(this.value());
            } else {
                this.expectPunct('(');
                list.push(this.value());
                while (this.peek()?.kind === 'punct' && this.peek()!.value === ',') { this.take(); list.push(this.value()); }
                this.expectPunct(')');
            }
            list.forEach(v => this.checkValue(f, v));
            const pred = (issue: Issue) => list.some(v => this.equals(f, read(issue), v, issue));
            return negateIn ? issue => !pred(issue) : pred;
        }
        const op = this.take();
        if (!op || op.kind !== 'op') {
            throw new Error(`Error in the JQL Query: Expecting operator but got '${op ? op.value : 'the end of the query'}'. Valid operators are '=', '!=', '~', '!~', '>', '>=', '<', '<=', 'IN', 'NOT IN' and 'IS'.`);
        }
        const raw = this.value();
        if (op.value === '~' || op.value === '!~') {
            if (f.kind !== 'text') throw new Error(`The operator '${op.value}' is not supported by the '${f.name}' field.`);
            const words = raw.toLowerCase().replace(/\*/g, '').split(/\s+/).filter(Boolean);
            const pred = (issue: Issue) => { const v = String(read(issue) || '').toLowerCase(); return words.every(w => v.includes(w)); };
            return op.value === '~' ? pred : issue => !pred(issue);
        }
        if (f.kind === 'text') throw new Error(`The operator '${op.value}' is not supported by the '${f.name}' field. Use '~' to search text.`);
        if (['>', '>=', '<', '<='].includes(op.value)) {
            if (f.kind !== 'number') throw new Error(`The operator '${op.value}' is not supported by the '${f.name}' field.`);
            const n = Number(raw);
            if (Number.isNaN(n)) throw new Error(`The value '${raw}' is not a valid number for the field '${f.name}'.`);
            return issue => {
                const v = Number(read(issue) || 0);
                return op.value === '>' ? v > n : op.value === '>=' ? v >= n : op.value === '<' ? v < n : v <= n;
            };
        }
        this.checkValue(f, raw);
        const pred = (issue: Issue) => this.equals(f, read(issue), raw, issue);
        return op.value === '=' ? pred : issue => !pred(issue);
    }

    checkValue(f: Field, raw: string) {
        if (raw.endsWith('()')) {
            const fn = raw.toLowerCase();
            const ok = (fn === 'currentuser()' && ['assignee', 'reporter', 'watcher'].includes(f.name))
                || ((fn === 'opensprints()' || fn === 'closedsprints()') && f.name === 'sprint');
            if (!ok) throw new Error(`Error in the JQL Query: The function '${raw}' is not supported for the field '${f.name}'.`);
            return;
        }
        if (raw.toLowerCase() === 'empty' || raw.toLowerCase() === 'null') return;
        if (f.values && !f.values.some(v => v.toLowerCase() === raw.toLowerCase())) {
            throw new Error(`The value '${raw}' does not exist for the field '${f.name}'.`);
        }
        if (f.name === 'assignee' && !this.ctx.people.some(p =>
            [p.id, p.name, p.name.split(' ')[0]].some(v => v.toLowerCase() === raw.toLowerCase()))) {
            throw new Error(`The value '${raw}' does not exist for the field 'assignee'.`);
        }
    }

    equals(f: Field, actual: ReturnType<Getter>, raw: string, issue: Issue): boolean {
        const want = raw.toLowerCase();
        if (want === 'empty' || want === 'null') return actual === null || actual === '' || (Array.isArray(actual) && !actual.length);
        if (want === 'opensprints()') return this.ctx.committed.includes(issue.id);
        if (want === 'closedsprints()') return !this.ctx.committed.includes(issue.id) && Number(issue.sprint || 0) > 0
            && Number(issue.sprint) < this.ctx.sprint;
        if (actual === null) return false;
        if (f.kind === 'number') return Number(actual) === Number(raw);
        const list = Array.isArray(actual) ? actual : [String(actual)];
        return list.some(v => String(v).toLowerCase() === want);
    }
}

export function compileJql(text: string, ctx: JqlContext): JqlResult {
    try {
        const parsed = new Parser(tokenize(text || ''), ctx).parse();
        return { ok: true, error: '', test: parsed.test, order: parsed.order };
    } catch (error) {
        return { ok: false, error: (error as Error).message, test: () => false, order: [] };
    }
}

const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const STATUS_RANK: Record<string, number> = { todo: 1, doing: 2, done: 3 };

/** Sort keys for ORDER BY. `rank` is the backlog order the view already carries. */
export function sortIssues(list: Issue[], order: OrderTerm[], rankOf: (issue: Issue) => number): Issue[] {
    const terms = order.length ? order : [{ field: 'rank', dir: 'asc' as const }];
    const keyOf = (issue: Issue, name: string): number | string => {
        switch (name) {
            case 'rank': return rankOf(issue);
            case 'key': return Number(issue.id.replace(/\D+/g, '')) || 0;
            case 'priority': return PRIORITY_RANK[issue.value] || 0;
            case 'status': case 'statusCategory': return STATUS_RANK[issue.status] || 0;
            case 'Story point estimate': return issue.points;
            case 'created': return issue.created;
            case 'updated': return lastSprint(issue);
            case 'summary': return issue.title.toLowerCase();
            case 'assignee': return (issue.assignee || '￿').toLowerCase();
            case 'type': return issue.type;
            default: return String((issue as any)[name] ?? '').toLowerCase();
        }
    };
    return [...list].sort((a, b) => {
        for (const term of terms) {
            const x = keyOf(a, term.field);
            const y = keyOf(b, term.field);
            if (x < y) return term.dir === 'asc' ? -1 : 1;
            if (x > y) return term.dir === 'asc' ? 1 : -1;
        }
        return rankOf(a) - rankOf(b);
    });
}
