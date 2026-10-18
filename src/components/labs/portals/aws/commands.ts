/**
 * The small, AWS-specific spellings the console's forms need when they become
 * CLI arguments. Every one is a VALUE passed to `cli()` (which quotes it), never
 * a fragment concatenated into a command line.
 */

export interface TagPair {
    key: string;
    value: string;
}

/** `{Key=Name,Value=web},{Key=env,Value=dev}` - the shorthand inside `Tags=[...]`. */
export function tagShorthand(tags: TagPair[]): string {
    return tags.filter(tag => tag.key.trim())
        .map(tag => `{Key=${tag.key.trim()},Value=${tag.value.trim()}}`).join(',');
}

/** `ResourceType=vpc,Tags=[{Key=Name,Value=web}]` for `--tag-specifications`. */
export function tagSpec(resourceType: string, tags: TagPair[]): string {
    const body = tagShorthand(tags);
    return body ? `ResourceType=${resourceType},Tags=[${body}]` : '';
}

/** `Key=a,Value=b` words for IAM's `--tags` (one word per tag). */
export function tagWords(tags: TagPair[]): string[] {
    return tags.filter(tag => tag.key.trim())
        .map(tag => `Key=${tag.key.trim()},Value=${tag.value.trim()}`);
}

/** The characters AWS allows in a tag key or value. */
export const TAG_CHARS = /^[\p{L}\p{Z}\p{N}_.:/=+\-@]*$/u;

export function tagProblem(tag: TagPair): string {
    if (!tag.key.trim() && tag.value.trim()) return 'You must specify a tag key.';
    if (tag.key.length > 128) return 'The key must be 128 characters or fewer.';
    if (tag.value.length > 256) return 'The value must be 256 characters or fewer.';
    if (!TAG_CHARS.test(tag.key) || !TAG_CHARS.test(tag.value)) {
        return 'Tags can contain only letters, numbers, spaces, and any of the following: _.:/=+-@';
    }
    if (/^aws:/i.test(tag.key)) return 'Tag keys can\'t start with "aws:".';
    return '';
}

/** A trust policy document for a role a given service can assume. */
export function trustPolicy(principal: Record<string, string>): string {
    return JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Principal: principal, Action: 'sts:AssumeRole' }],
    }, null, 4);
}

/** DynamoDB JSON for one attribute value typed into the item editor. */
export function ddbValue(type: string, raw: string): Record<string, unknown> {
    if (type === 'N') return { N: raw };
    if (type === 'BOOL') return { BOOL: raw === 'true' };
    if (type === 'NULL') return { NULL: true };
    return { S: raw };
}

/** One DynamoDB attribute as the item explorer prints it. */
export function ddbText(attr: unknown): string {
    if (!attr || typeof attr !== 'object') return '';
    const [type, value] = Object.entries(attr as Record<string, unknown>)[0] || ['', ''];
    if (type === 'NULL') return 'null';
    if (type === 'BOOL') return String(value);
    if (type === 'M' || type === 'L' || type === 'SS' || type === 'NS') return JSON.stringify(value);
    return String(value ?? '');
}
