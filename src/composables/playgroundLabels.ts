/**
 * The playground menu's interface text, as LITERAL `t()` calls.
 *
 * The group headings and the two linked studios' copy are chosen by a value
 * (`row.group`, `row.id`), so a `$t(GROUP_LABELS[g])` in a template would hide
 * every key from `check:i18n`'s scan - the coverage check could not see them
 * and the orphan check would report their catalogue entries. A switch over
 * literals keeps both checks honest without a second exemption list.
 *
 * A record's own title and summary are NOT here: those come from app 11 with
 * their translations and are read with `td()` (data, not interface).
 */
import { t, td } from '@/i18n/runtime';
import type { Playground } from '@/utils/playgrounds';

export function groupLabel(group: string): string {
    switch (group) {
        case 'cloud': return t('Cloud');
        case 'data': return t('Data');
        case 'devops': return t('DevOps');
        case 'programming': return t('Programming');
        case 'web': return t('Web & mobile');
        case 'ai': return t('AI');
        case 'management': return t('Management');
        case 'networking': return t('Networking');
        default: return group;
    }
}

/** The displayed title: a linked studio's is interface text, a record's is data. */
export function playgroundTitle(row: Playground): string {
    if (row.id === 'netsim-studio') return t('Network Simulator');
    if (row.id === 'self-driving-studio') return t('Self-Driving Studio');
    return td(row, 'title') || row.id;
}

export function playgroundSummary(row: Playground): string {
    if (row.id === 'netsim-studio') {
        return t('Build a network of routers, switches and PCs and configure it.');
    }
    if (row.id === 'self-driving-studio') {
        return t('Write CARLA Python, run it, watch it drive a 3D city.');
    }
    return td(row, 'summary');
}

/** What the search box also matches for a row: its displayed, translated text. */
export function playgroundSearchText(row: Playground): string {
    return `${playgroundTitle(row)} ${playgroundSummary(row)} ${groupLabel(String(row.group))}`;
}
