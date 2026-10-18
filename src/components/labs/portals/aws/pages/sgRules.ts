/** Security group rule types as the EC2 console's "Type" dropdown lists them. */

export interface RuleType {
    label: string;
    protocol: string;
    port: string;
    /** The port range is typed by the user. */
    custom?: boolean;
}

export const RULE_TYPES: RuleType[] = [
    { label: 'Custom TCP', protocol: 'tcp', port: '', custom: true },
    { label: 'Custom UDP', protocol: 'udp', port: '', custom: true },
    { label: 'All TCP', protocol: 'tcp', port: '0-65535' },
    { label: 'All UDP', protocol: 'udp', port: '0-65535' },
    { label: 'All ICMP - IPv4', protocol: 'icmp', port: '' },
    { label: 'All traffic', protocol: 'all', port: '' },
    { label: 'SSH', protocol: 'tcp', port: '22' },
    { label: 'SMTP', protocol: 'tcp', port: '25' },
    { label: 'DNS (TCP)', protocol: 'tcp', port: '53' },
    { label: 'HTTP', protocol: 'tcp', port: '80' },
    { label: 'HTTPS', protocol: 'tcp', port: '443' },
    { label: 'MySQL/Aurora', protocol: 'tcp', port: '3306' },
    { label: 'RDP', protocol: 'tcp', port: '3389' },
    { label: 'PostgreSQL', protocol: 'tcp', port: '5432' },
    { label: 'Redis', protocol: 'tcp', port: '6379' },
    { label: 'Custom ICMP - IPv4', protocol: 'icmp', port: '' },
];

export function protocolLabel(protocol: string): string {
    const p = String(protocol || '').toLowerCase();
    if (p === '-1' || p === 'all') return 'All';
    return p.toUpperCase();
}

/** The Type a stored rule reads as: "SSH", "HTTP", or "Custom TCP". */
export function typeOf(rule: { protocol?: string; port?: string }): string {
    const protocol = String(rule.protocol || '').toLowerCase();
    const port = String(rule.port || '');
    if (protocol === '-1' || protocol === 'all') return 'All traffic';
    const named = RULE_TYPES.find(t => !t.custom && t.protocol === protocol && t.port === port);
    if (named) return named.label;
    if (protocol === 'icmp') return 'All ICMP - IPv4';
    return protocol === 'udp' ? 'Custom UDP' : 'Custom TCP';
}

export interface EditRule {
    /** Present when the row was already on the group (so a removal is a revoke). */
    original?: { protocol: string; port: string; cidr: string };
    type: string;
    port: string;
    source: string;
    cidr: string;
    description: string;
}

export function ruleOf(row: EditRule): { protocol: string; port: string; cidr: string } {
    const kind = RULE_TYPES.find(t => t.label === row.type) || RULE_TYPES[0];
    return { protocol: kind.protocol, port: kind.custom ? row.port.trim() : kind.port, cidr: row.cidr.trim() };
}

export function sameRule(a: { protocol: string; port: string; cidr: string },
                         b: { protocol: string; port: string; cidr: string }): boolean {
    return String(a.protocol) === String(b.protocol) && String(a.port || '') === String(b.port || '')
        && String(a.cidr) === String(b.cidr);
}

export function ruleProblem(row: EditRule): string {
    const kind = RULE_TYPES.find(t => t.label === row.type);
    if (kind?.custom) {
        const port = row.port.trim();
        if (!port) return 'Port range is required.';
        const m = port.match(/^(\d+)(?:-(\d+))?$/);
        if (!m || Number(m[1]) > 65535 || (m[2] && (Number(m[2]) > 65535 || Number(m[2]) < Number(m[1])))) {
            return 'Port range must be a number from 0 to 65535, or a range such as 8000-8080.';
        }
    }
    const cidr = row.cidr.trim();
    if (!/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.test(cidr)) {
        return 'Source must be a valid CIDR block, such as 0.0.0.0/0.';
    }
    return '';
}
