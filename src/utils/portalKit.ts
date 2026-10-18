/**
 * The portals' shared half: turning a form into the command line it stands for,
 * and reading the engine's answer back.
 *
 * A portal (the AWS console, the Azure portal, Ambari, the Spark UI, Fabric,
 * Jira, ServiceNow) WRITES by sending app 11 the exact command a student could
 * have typed into the console beside it. That is the whole design — see
 * `utils/labtools.py` on app 11 — and it makes this module the one place where a
 * value somebody typed into a form becomes part of a command line. So it is a
 * plain module with `npm run check:labs` over it, on the `labCatalogue.ts`
 * precedent, because every way of getting it wrong is silent:
 *
 * **A value is ALWAYS quoted when it needs to be.** The engines split a line
 * with POSIX `shlex`, so a bucket description with a space in it, a Jira summary
 * with an apostrophe, or a tag value with a `$` would otherwise arrive as
 * several arguments — and the engine would answer about the wrong resource,
 * or create one with a truncated name, at exit code 0.
 *
 * **An empty optional field is OMITTED, never sent as `--flag ''`.** Several
 * engines read "present but empty" as a value; a blank "Description" box would
 * then overwrite a description the student set on the command line.
 *
 * **A boolean flag is bare.** `--multi-az`, not `--multi-az true`: the engines
 * declare their boolean flags, and `true` after one is read as a positional.
 *
 * Nothing in here touches the DOM, imports Vue, or knows any product.
 */

/** What a portal action receives back. The lab service's tool answer. */
export interface PortalResult {
    ok: boolean;
    output?: string;
    error?: string;
    code?: number;
    data?: unknown;
    via?: string;
}

/** What a portal sends. `surface` runs the line as a sibling tool would. */
export interface PortalPayload {
    command: string;
    surface?: string;
}

export type PortalRun = (payload: PortalPayload) => Promise<PortalResult>;

export type PortalValue = string | number | boolean | null | undefined;

/** Characters that are safe unquoted in a POSIX shell word. */
const SAFE_WORD = /^[A-Za-z0-9_@%+=:,./-]+$/;

/**
 * One value as one shell word.
 *
 * Single quotes, because inside them nothing is special — not `$`, not a
 * backslash, not a backtick — and a single quote itself is written as `'\''`
 * (close, escaped quote, reopen), which is the one spelling `shlex` and every
 * real shell agree on. An empty string is `''`, so it survives as an argument
 * rather than vanishing.
 */
export function quote(value: PortalValue): string {
    const text = value === null || value === undefined ? '' : String(value);
    if (text === '') return "''";
    if (SAFE_WORD.test(text)) return text;
    return "'" + text.replace(/'/g, "'\\''") + "'";
}

export type PortalFlagValue = PortalValue | PortalValue[];

/**
 * A command line from its words and its flags.
 *
 * `base` is the command and its positionals, each quoted. `flags` is an
 * ordered map — insertion order is the order written, so the line reads the way
 * the CLI's own documentation does:
 *
 *   `true`               bare flag             `--multi-az`
 *   `false` / null / ''  omitted
 *   a string or number   flag and one value    `--cidr-block 10.0.0.0/16`
 *   an array             flag and each value   `--instance-ids i-1 i-2`
 *                        (an empty array is omitted)
 */
export function cli(base: PortalValue[], flags: Record<string, PortalFlagValue> = {}): string {
    const words: string[] = [];
    for (const part of base) {
        if (part === null || part === undefined || part === false) continue;
        words.push(quote(part));
    }
    for (const [flag, value] of Object.entries(flags)) {
        if (value === true) {
            words.push(flag);
            continue;
        }
        if (value === false || value === null || value === undefined) continue;
        if (Array.isArray(value)) {
            const items = value.filter(item => item !== null && item !== undefined
                && item !== false && String(item) !== '');
            if (!items.length) continue;
            words.push(flag, ...items.map(item => quote(item)));
            continue;
        }
        if (String(value) === '') continue;
        words.push(flag, quote(value));
    }
    return words.join(' ');
}

/**
 * The engine's JSON, when it printed some.
 *
 * The AWS and Azure CLIs answer with JSON and a portal often needs the id the
 * create minted (to open the new resource's page). Tolerates a line of text
 * before the document, which several engines print as a note.
 */
export function parseJson<T = any>(output: string | undefined | null): T | null {
    const text = String(output || '').trim();
    if (!text) return null;
    try {
        return JSON.parse(text) as T;
    } catch {
        const start = text.search(/[[{]/);
        if (start < 0) return null;
        try {
            return JSON.parse(text.slice(start)) as T;
        } catch {
            return null;
        }
    }
}

/**
 * What to show when an action failed, in one or two lines.
 *
 * The engines print the product's own error — `An error occurred
 * (DependencyViolation) when calling the DeleteVpc operation: …` — and that IS
 * the useful message: it is what the real console shows and what a student will
 * search for. So it is trimmed, not rewritten. A transport failure (no output at
 * all) says so rather than rendering an empty red box.
 */
export function errorText(result: PortalResult | null | undefined): string {
    if (!result) return 'The lab service did not answer.';
    const text = String(result.error || '').trim() || String(result.output || '').trim();
    if (!text) return 'The request failed and returned no message.';
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    return lines.slice(0, 3).join(' ').slice(0, 600);
}

/** The AWS-style error code out of an error, e.g. `DependencyViolation`. */
export function errorCode(result: PortalResult | null | undefined): string {
    const match = errorText(result).match(/\(([A-Za-z][\w.]*)\)/);
    return match ? match[1] : '';
}

/**
 * Pick a path out of a view payload without throwing.
 *
 * The lab service deploys separately from this bundle, so a replica a release
 * behind simply does not have `ec2.nat_gateways` yet. A portal reading that must
 * render an empty list, never crash — the same rule `rowsAt` follows for the
 * read-only dashboards.
 */
export function pick<T = any>(view: unknown, path: string, fallback: T): T {
    let current: any = view;
    for (const key of path.split('.').filter(Boolean)) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return fallback;
        }
        current = current[key];
    }
    if (current === null || current === undefined) return fallback;
    if (Array.isArray(fallback) && !Array.isArray(current)) return fallback;
    return current as T;
}

/** `pick` for lists, always an array of objects. */
export function rows<T = Record<string, any>>(view: unknown, path: string): T[] {
    const list = pick<unknown[]>(view, path, []);
    return list.filter(item => item !== null && typeof item === 'object') as T[];
}

/**
 * Case-insensitive "does any of these fields contain the text".
 *
 * Every portal has a filter box above its tables. Matched on the fields the
 * caller names rather than on `JSON.stringify(row)`, which would match a key
 * name — typing "state" would find every row.
 */
export function matches(row: Record<string, any>, needle: string, fields: string[]): boolean {
    const text = needle.trim().toLowerCase();
    if (!text) return true;
    return fields.some(field => {
        const value = row?.[field];
        if (value === null || value === undefined) return false;
        const flat = Array.isArray(value) ? value.join(' ') : String(value);
        return flat.toLowerCase().includes(text);
    });
}

/**
 * A stable sort by one column, for a table header click.
 *
 * Stable and total: equal keys keep their incoming order, so a table re-derived
 * inside a computed does not reshuffle rows that compare equal every time the
 * view refreshes (the trap `sortLabs` documents). Numbers sort as numbers.
 */
export function sortBy<T extends Record<string, any>>(list: T[], key: string,
                                                      direction: 'asc' | 'desc' = 'asc'): T[] {
    const sign = direction === 'desc' ? -1 : 1;
    return list
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
            const left = a.row?.[key];
            const right = b.row?.[key];
            let order = 0;
            if (typeof left === 'number' && typeof right === 'number') {
                order = left - right;
            } else {
                order = String(left ?? '').localeCompare(String(right ?? ''),
                                                         undefined, { numeric: true });
            }
            return order * sign || a.index - b.index;
        })
        .map(entry => entry.row);
}

/**
 * A short identifier the way the products shorten them: `vpc-0a1b…9f`.
 *
 * Only for DISPLAY in a narrow column. The full id is always available on the
 * row (title attribute, copy button, detail page), because it is what a
 * student pastes into the next command.
 */
export function shortId(id: unknown, keep = 12): string {
    const text = String(id ?? '');
    if (text.length <= keep + 3) return text;
    return text.slice(0, keep) + '…';
}

/** A field validator result: '' when fine, otherwise the message. */
export type Rule = (value: string) => string;

export const RULES = {
    required: (label: string): Rule => value =>
        String(value ?? '').trim() ? '' : `${label} is required.`,
    pattern: (re: RegExp, message: string): Rule => value =>
        !String(value ?? '') || re.test(String(value)) ? '' : message,
    cidr: (label = 'CIDR block'): Rule => value => {
        const text = String(value ?? '').trim();
        if (!text) return '';
        const match = text.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
        if (!match) return `${label} must look like 10.0.0.0/16.`;
        const octets = match.slice(1, 5).map(Number);
        const prefix = Number(match[5]);
        if (octets.some(octet => octet > 255) || prefix > 32) {
            return `${label} is not a valid IPv4 CIDR.`;
        }
        return '';
    },
};

/** Every failing rule's message for one value; empty when all pass. */
export function validate(value: string, rules: Rule[]): string {
    for (const rule of rules) {
        const message = rule(value);
        if (message) return message;
    }
    return '';
}
