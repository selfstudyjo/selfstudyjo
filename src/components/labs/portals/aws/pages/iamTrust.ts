/** Reading a role's trust policy the way the IAM console summarises it. */

export function trustedEntity(document: unknown): string {
    try {
        const parsed = JSON.parse(String(document || ''));
        const statements = Array.isArray(parsed?.Statement) ? parsed.Statement : [parsed?.Statement];
        const out: string[] = [];
        for (const statement of statements) {
            const principal = statement?.Principal || {};
            for (const value of [].concat(principal.Service || [])) out.push(`AWS Service: ${String(value).split('.')[0]}`);
            for (const value of [].concat(principal.AWS || [])) out.push(`Account: ${String(value).split(':')[4] || value}`);
            if (principal.Federated) out.push(`Identity Provider: ${principal.Federated}`);
        }
        return out.join(', ') || '–';
    } catch {
        return document ? 'Custom trust policy' : '–';
    }
}

export function prettyJson(document: unknown): string {
    try {
        return JSON.stringify(JSON.parse(String(document || '')), null, 4);
    } catch {
        return String(document || '');
    }
}
