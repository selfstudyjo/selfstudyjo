/**
 * Arabic.
 *
 * ============================================================
 * THE KEY IS THE ENGLISH TEXT. THERE IS NO ENGLISH CATALOGUE.
 * ============================================================
 *
 * See `../../index.ts` for why. The practical consequences while editing these
 * files:
 *
 *  - **A key that is not here renders in English.** That is a gap, not a
 *    failure, and it is why this catalogue can land incomplete without breaking
 *    a single screen. `npm run check:i18n` reports the coverage and names what
 *    is left.
 *  - **A key must match the source exactly, with runs of whitespace
 *    collapsed.** The codemod that wrote the `$t('…')` calls collapses them, so
 *    a sentence wrapped over three lines in a template is one line here.
 *  - **`{v0}`, `{v1}`… are the expressions the template interpolates**, and
 *    Arabic is free to put them anywhere in the sentence — which is most of the
 *    reason the codemod builds one key per phrase rather than one per fragment.
 *    Dropping one is a build failure rather than a number that silently
 *    disappears from one language.
 *
 * ============================================================
 * WHY THIS IS SPLIT INTO FILES BY AREA AND NOT SORTED A-Z
 * ============================================================
 *
 * Because context is what makes a translation right, and alphabetical order
 * destroys it. "Clear" over a search box, "Clear" over a drawing canvas and
 * "Clear" over a notification list are three different verbs in Arabic, and the
 * only way to pick each correctly is to see the keys around it. Sorted A-Z,
 * `Clear` sits between `Class` and `Close` and there is nothing to go on.
 *
 * `node tools/i18n-wrap/where.mjs <name>` prints the keys a given view owns,
 * which is how these files were filled and is how to extend one.
 *
 * ============================================================
 * REGISTER, AND WHY IT IS FORMAL THROUGHOUT
 * ============================================================
 *
 * Modern Standard Arabic (فصحى), not a dialect. Three reasons, in order:
 *
 *  1. It is the register of instruction. Every Arabic textbook, exam paper and
 *     certificate these students have read is in it, and a study platform that
 *     addresses them in Levantine colloquial reads like a friend rather than
 *     like a school.
 *  2. It is the only variety every reader shares. The audience is not one
 *     country — Jordanian, Egyptian, Gulf and Maghrebi readers all understand
 *     فصحى and do not all understand each other's dialects.
 *  3. It is what the AI side is told to answer in (`locales.ts` → `aiName`), so
 *     the interface and the interviewer speak the same Arabic. A formal
 *     interface wrapped around a colloquial interviewer is two products.
 *
 * Verbs addressed to the reader are imperative. Where Arabic forces a gender —
 * and it often does — the masculine singular is used, which is what every
 * Arabic interface does, and is deliberately not "solved" with a slash
 * construction no reader expects and no screen reader can pronounce.
 *
 * Digits are not this file's business: `Intl` renders Arabic-Indic numerals for
 * prose through `$n`, and a value a reader might have to type back is left in
 * source form. See `index.ts` → `formatNumber` for which is which.
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
 * Assembled in one place so a duplicate key is a real, visible conflict rather
 * than a silent overwrite. `check:i18n` fails on a key declared in two of these
 * modules — with 2,200 strings across five files, "why is this one word wrong
 * on that one screen" is otherwise unfindable.
 */
const ar: Catalogue = {
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

export default ar;
