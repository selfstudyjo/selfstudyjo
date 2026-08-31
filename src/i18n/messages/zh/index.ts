/**
 * Chinese (Simplified).
 *
 * ============================================================
 * THE KEY IS THE ENGLISH TEXT. THERE IS NO ENGLISH CATALOGUE.
 * ============================================================
 *
 * See `../../index.ts` for why, and `../ar/index.ts` for the three editing
 * notes and the split-by-area reasoning — both apply identically here.
 *
 * ============================================================
 * WHAT IS DIFFERENT ABOUT CHINESE, BEYOND THE WORDS
 * ============================================================
 *
 *  - **Punctuation is full-width and is NOT the ASCII character with the same
 *    job.** `：` not `:`, `，` not `,`, `。` not `.`, `（）` not `()`, `、` for a
 *    list separator, `——` for an em dash. Mixing them reads to a Chinese reader
 *    exactly as `Hello ,world .` reads in English. This is the commonest way a
 *    Chinese translation gives itself away as machine output, and it is why a
 *    key like `'Status:'` is translated *with* its colon rather than having the
 *    colon left behind in the template.
 *  - **No spaces between words, which breaks a word count.** Nothing in this
 *    file does that, but the Job Interview room does — see `locales.ts` →
 *    `wordless` and `countWords`. A three-word floor rejects every Chinese
 *    question ever written, which is the same class of bug as the character
 *    floor that used to reject Arabic.
 *  - **One plural form.** `Intl.PluralRules('zh')` answers `other` for every
 *    number, so a bare string is the complete and correct answer to a key
 *    Arabic needs six forms for. `resolvePlural` treats it that way rather than
 *    demanding six copies of one sentence.
 *  - **A thin space is still wanted between Han and Latin.** `共 12 份` reads
 *    correctly, `共12份` is acceptable, and running a `{v0}` straight into Han
 *    text is not. Where it matters the space is written in deliberately.
 *  - **The layout does not mirror.** `direction` stays `ltr`, so nothing in
 *    `rtl.css` applies and none of the bidi isolation is relevant. Chinese is
 *    the locale that proves the RTL work is scoped to Arabic rather than to
 *    "not English".
 */

import type { Catalogue } from '../../index';

import common from './common';
import account from './account';
import learning from './learning';
import speaking from './speaking';
import tools from './tools';
import netsim from './netsim';
import research from './research';
import studio from './studio';
import labs from './labs';

/**
 * Assembled in one place so a duplicate key is a visible conflict rather than a
 * silent overwrite. `check:i18n` fails on a key declared in two of these
 * modules.
 */
const zh: Catalogue = {
    ...common,
    ...account,
    ...learning,
    ...speaking,
    ...tools,
    ...netsim,
    ...research,
    ...studio,
    ...labs,
};

export default zh;
