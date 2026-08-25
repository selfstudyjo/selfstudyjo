/**
 * Which file each key comes from — the translator's context.
 *
 *   node tools/i18n-wrap/where.mjs            # a per-file tally
 *   node tools/i18n-wrap/where.mjs Exams      # the keys owned by matching files
 *
 * Grouping the catalogue by area rather than alphabetically is what makes a
 * consistent translation possible: "Clear" in a chat, "Clear" on a canvas and
 * "Clear" over a log file are three different verbs in Arabic and three
 * different words in Chinese, and only the surrounding keys say which is which.
 */

import fs from 'node:fs';
import path from 'node:path';

const SQ = /(^|[^\w$])\.?\$?tc?\(\s*'((?:[^'\\]|\\.)*)'/g;
const DQ = /(^|[^\w$])\.?\$?tc?\(\s*"((?:[^"\\]|\\.)*)"/g;

const keys = new Map();

const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(p); continue; }
        if (!/\.(vue|ts)$/.test(p)) continue;
        if (p.includes(`${path.sep}messages${path.sep}`)) continue;
        const src = fs.readFileSync(p, 'utf8');
        for (const re of [SQ, DQ]) {
            re.lastIndex = 0;
            for (const m of src.matchAll(re)) {
                const k = m[2]
                    .replace(/\\'/g, "'")
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
                if (!/[A-Za-z]{2}/.test(k)) continue;
                if (!keys.has(k)) keys.set(k, new Set());
                keys.get(k).add(path.relative('src', p).replace(/\\/g, '/'));
            }
        }
    }
};
walk('src');

const byFile = new Map();
for (const [k, files] of keys) {
    // A key used in two files belongs to neither: it is shared vocabulary and
    // has to be translated once, in a way that works in both places.
    const owner = files.size === 1 ? [...files][0] : '~shared';
    if (!byFile.has(owner)) byFile.set(owner, []);
    byFile.get(owner).push(k);
}

const ordered = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
const only = process.argv[2];

if (only) {
    for (const [f, ks] of ordered) {
        if (!f.toLowerCase().includes(only.toLowerCase())) continue;
        console.log(`### ${f} (${ks.length})`);
        ks.sort((a, b) => a.localeCompare(b, 'en')).forEach(k => console.log(k));
    }
} else {
    for (const [f, ks] of ordered) console.log(String(ks.length).padStart(5), f);
    console.log('TOTAL', keys.size);
}
