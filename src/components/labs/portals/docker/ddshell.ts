/**
 * The Exec and Files tabs' plain half: reading `ls -lAp` and `docker diff`
 * back into rows, Tab completion, and a download. No Vue, no DOM beyond the
 * one anchor a download needs.
 */

export interface FileEntry {
    name: string; dir: boolean; size: number; modified: string; mode: string;
}

const LONG = /^([dl-][rwxst-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\w{3}\s+\d+\s+[\d:]+)\s+(.+)$/;

/** `ls -lAp` output -> rows, directories first, as the Files tab lists them. */
export function parseLsLong(text: string): FileEntry[] {
    const out: FileEntry[] = [];
    for (const raw of String(text || '').split('\n')) {
        const match = raw.match(LONG);
        if (!match) continue;
        const dir = match[1].startsWith('d') || match[4].endsWith('/');
        const name = match[4].replace(/\/$/, '');
        if (!name || name === '.' || name === '..') continue;
        out.push({ name, dir, size: Number(match[2]) || 0, modified: match[3].replace(/\s+/g, ' '), mode: match[1] });
    }
    return out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
}

/** `docker diff` -> { '/path': 'A' | 'C' | 'D' }. */
export function parseDiff(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const raw of String(text || '').split('\n')) {
        const match = raw.match(/^([ACD])\s+(\/\S.*)$/);
        if (match) out[match[2].replace(/\/$/, '')] = match[1];
    }
    return out;
}

export function fmtBytes(size: number): string {
    if (size < 1000) return `${size} B`;
    if (size < 1e6) return `${(size / 1000).toFixed(2)} kB`;
    return `${(size / 1e6).toFixed(2)} MB`;
}

/**
 * Complete the last word of `line` against `names` (one `ls -Ap` listing of
 * the directory that word points into; directories end in `/`). Returns the
 * new line, and the candidates when the completion is ambiguous - which the
 * terminal prints, as a shell does on a second Tab.
 */
export function completeLine(line: string, names: string[]): { line: string; options: string[] } {
    const cut = line.search(/\S*$/);
    const last = line.slice(cut);
    const slash = last.lastIndexOf('/');
    const head = slash >= 0 ? last.slice(0, slash + 1) : '';
    const stem = slash >= 0 ? last.slice(slash + 1) : last;
    const hits = names.filter(name => name.startsWith(stem) && (stem.startsWith('.') || !name.startsWith('.')));
    if (!hits.length) return { line, options: [] };
    if (hits.length === 1) {
        const done = hits[0];
        return { line: line.slice(0, cut) + head + done + (done.endsWith('/') ? '' : ' '), options: [] };
    }
    let prefix = hits[0];
    for (const hit of hits.slice(1)) {
        while (!hit.startsWith(prefix)) prefix = prefix.slice(0, -1);
    }
    return { line: line.slice(0, cut) + head + prefix, options: prefix.length > stem.length ? [] : hits };
}

/** Save text as a file in the browser - a blob URL, revoked straight after. */
export function download(filename: string, text: string) {
    const blob = new Blob([text.endsWith('\n') ? text : text + '\n'], { type: 'text/plain' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}
