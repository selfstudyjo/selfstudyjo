/**
 * Small display and argument helpers shared by the console's pages. Every
 * value that becomes part of a command still goes through `cli()`; these only
 * shape what is drawn, or build ONE argument value (a JSON document, a
 * shorthand) that `cli()` then quotes.
 */

export { awsDate } from '../aws/ctx';

/** A JSON document the way the console's policy editors show it. */
export function pretty(doc: unknown): string {
    if (doc === null || doc === undefined || doc === '') return '';
    if (typeof doc === 'string') {
        try { return JSON.stringify(JSON.parse(doc), null, 4); } catch { return doc; }
    }
    return JSON.stringify(doc, null, 4);
}

/** Parse a JSON editor's text: [value, ''] or [null, message]. */
export function parseJson(text: string): [any, string] {
    if (!text.trim()) return [null, 'The document is empty.'];
    try {
        return [JSON.parse(text), ''];
    } catch (error: any) {
        return [null, 'Ln 1, Col 1: ' + String(error?.message || 'Invalid JSON').replace(/^JSON\.parse: /, '')];
    }
}

/** A JSON document as ONE compact argument (cli() quotes it). */
export function compact(doc: unknown): string {
    return typeof doc === 'string' ? JSON.stringify(JSON.parse(doc)) : JSON.stringify(doc);
}

export function lastPart(arn: unknown): string {
    const text = String(arn || '');
    return text.split('/').pop() || text;
}

/** "-1" -> "All", "tcp" -> "TCP". */
export function protoLabel(proto: unknown): string {
    const p = String(proto ?? '');
    if (p === '-1' || p === 'all') return 'All';
    if (p === '6') return 'TCP';
    if (p === '17') return 'UDP';
    return p.toUpperCase();
}

/** A rule's port range as the console prints it. */
export function portRange(rule: Record<string, any>): string {
    const proto = String(rule.protocol ?? '');
    const low = Number(rule.from ?? 0);
    const high = Number(rule.to ?? low);
    if (proto === '-1' || (low === 0 && high === 65535)) return 'All';
    return low === high ? String(low) : `${low} - ${high}`;
}

/** The well-known name for a rule (SG / NACL "Type" column). */
export function ruleType(rule: Record<string, any>): string {
    const proto = String(rule.protocol ?? '');
    const low = Number(rule.from ?? 0);
    const high = Number(rule.to ?? low);
    if (proto === '-1') return 'All traffic';
    const named: Record<number, string> = {
        22: 'SSH', 80: 'HTTP', 443: 'HTTPS', 3389: 'RDP', 1433: 'MSSQL', 389: 'LDAP',
        445: 'SMB', 53: 'DNS (TCP)', 3306: 'MYSQL/Aurora', 5432: 'PostgreSQL',
    };
    if (low === high && named[low] && proto === 'tcp') return named[low];
    return `Custom ${protoLabel(proto)}`;
}

/** Tags as a sorted list. */
export function tagList(tags: Record<string, string> | undefined): { key: string; value: string }[] {
    return Object.entries(tags || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, value }));
}

export function nameTag(tags: Record<string, string> | undefined, fallback = '-'): string {
    return (tags && tags.Name) || fallback;
}

export function money(amount: unknown): string {
    const n = Number(amount) || 0;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Days -> "412 days" the way IAM prints key age. */
export function days(n: unknown): string {
    const value = Number(n);
    if (n === null || n === undefined || Number.isNaN(value)) return '-';
    if (value === 0) return 'Today';
    return `${value} day${value === 1 ? '' : 's'}`;
}

/** The CloudWatch comparison operator as a sentence fragment. */
export const COMPARISONS: Record<string, string> = {
    GreaterThanThreshold: '>', GreaterThanOrEqualToThreshold: '>=',
    LessThanThreshold: '<', LessThanOrEqualToThreshold: '<=',
};
