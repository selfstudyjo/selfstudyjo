/**
 * The LIST and KEYED-SUB-RECORD halves of the record translator.
 *
 * Imported by `tools/datai18n-check/check.ts`, so these land in that check's
 * own output rather than being a separate npm script nobody runs.
 *
 * `field()` covers a scalar and had 51 checks over it from the day it was
 * written. `list()` and `nested()` are new and exist because app 11 has
 * reader-facing text that is not a scalar -- a lab's `objectives` is a list and
 * its `tasks` are keyed by task id. Both were rendered raw until 2026-09-26,
 * which is English objectives and English task steps inside a workbench whose
 * every other word was translated.
 *
 * FOUR OF THESE FAIL SILENTLY, which is why they are checks rather than care:
 *
 *  1. A SHORT TRANSLATED LIST MUST NOT SHORTEN THE LIST. Three Arabic
 *     objectives where the English has five must render five. A dropped
 *     objective is a requirement the student is never told about and the list
 *     looks complete while being short -- there is nothing on screen to say it
 *     happened.
 *  2. A HOLE IN THE MIDDLE MUST NOT SHIFT THE REST. `null` at index 2 means
 *     "use the English for element 2", not "element 3 is now element 2". Shifted,
 *     objective four is printed against step three's number.
 *  3. A TASK IS KEYED ON ITS ID. Keyed on position, a translation moves onto a
 *     different task the first time a lab gains a step -- and a lab's tasks are
 *     reordered by whoever edits it, while `tasks_done` is recorded against the
 *     id.
 *  4. `nested()` MUST FALL BACK TO WHAT THE CALLER PASSES IN. It is handed the
 *     sub-record's English by the caller because it cannot reach it (the row is
 *     `task`, not `lab.tasks[task.id]`), so a miss that returned `''` would
 *     blank every untranslated task title on the platform.
 */

import { list, nested, type Translatable } from '../../src/i18n/records';

export interface Case {
    label: string;
    pass: boolean;
    detail?: string;
}

const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

export function listCases(): Case[] {
    const out: Case[] = [];
    const add = (label: string, pass: boolean, detail = '') =>
        out.push({ label, pass, detail });

    const lab = {
        objectives: ['Write an inventory', 'Run a module', 'Use a handler'],
        tasks: [{ id: 't1', title: 'Make the file', detail: 'In config/', hint: 'Use nano' }],
        translations: {
            ar: {
                objectives: ['اكتب جرداً', 'شغّل وحدة', 'استخدم معالجاً'],
                tasks: { t1: { title: 'أنشئ الملف', detail: 'في config/' } },
            },
        },
    } as unknown as Translatable;

    /* ---- list() ---- */
    add('a full translation renders entirely in the translation',
        same(list(lab, 'objectives', 'ar'),
             ['اكتب جرداً', 'شغّل وحدة', 'استخدم معالجاً']));

    add('English renders the record\'s own list',
        same(list(lab, 'objectives', 'en'),
             ['Write an inventory', 'Run a module', 'Use a handler']));

    add('a language with no entry falls back to English',
        same(list(lab, 'objectives', 'zh'),
             ['Write an inventory', 'Run a module', 'Use a handler']));

    // 1. THE ONE THAT MATTERS MOST.
    const short = {
        objectives: ['one', 'two', 'three', 'four', 'five'],
        translations: { ar: { objectives: ['واحد', 'اثنان'] } },
    } as unknown as Translatable;
    const got = list(short, 'objectives', 'ar');
    add('a SHORT translation still renders every element',
        got.length === 5, `got ${got.length}`);
    add('...with the untranslated tail in English',
        same(got, ['واحد', 'اثنان', 'three', 'four', 'five']), got.join(' | '));

    // 2. A hole must not shift the rest.
    const holed = {
        objectives: ['one', 'two', 'three'],
        translations: { ar: { objectives: ['واحد', null, 'ثلاثة'] } },
    } as unknown as Translatable;
    add('a null in the middle uses the English at THAT index, not the next one',
        same(list(holed, 'objectives', 'ar'), ['واحد', 'two', 'ثلاثة']),
        list(holed, 'objectives', 'ar').join(' | '));

    const blank = {
        objectives: ['one', 'two'],
        translations: { ar: { objectives: ['   ', 'اثنان'] } },
    } as unknown as Translatable;
    add('a blank element is a gap, not an answer',
        same(list(blank, 'objectives', 'ar'), ['one', 'اثنان']));

    add('a translation LONGER than the English cannot add elements',
        same(list({
            objectives: ['one'],
            translations: { ar: { objectives: ['واحد', 'زائد'] } },
        } as unknown as Translatable, 'objectives', 'ar'), ['واحد']));

    add('a non-list translation is ignored rather than rendered',
        same(list({
            objectives: ['one', 'two'],
            translations: { ar: { objectives: 'واحد' } },
        } as unknown as Translatable, 'objectives', 'ar'), ['one', 'two']));

    add('a missing field is an empty list, never a throw',
        same(list(lab, 'nope', 'ar'), []));
    add('a null record is an empty list, never a throw',
        same(list(null, 'objectives', 'ar'), []));

    /* ---- nested() ---- */
    add('a keyed sub-record field comes back translated',
        nested(lab, 'tasks', 't1', 'title', 'ar', 'Make the file') === 'أنشئ الملف');

    // 4. THE FALLBACK IS THE CALLER'S.
    add('a sub-field with no translation falls back to what the caller passed',
        nested(lab, 'tasks', 't1', 'hint', 'ar', 'Use nano') === 'Use nano');
    add('an unknown task id falls back rather than blanking',
        nested(lab, 'tasks', 'nope', 'title', 'ar', 'Make the file') === 'Make the file');
    add('English never reads the map at all',
        nested(lab, 'tasks', 't1', 'title', 'en', 'Make the file') === 'Make the file');

    // 3. Keyed on the ID, so a reorder cannot move a translation.
    add('the translation is found by task id and not by position',
        nested({
            tasks: [{ id: 'zz', title: 'Second' }, { id: 't1', title: 'Make the file' }],
            translations: { ar: { tasks: { t1: { title: 'أنشئ الملف' } } } },
        } as unknown as Translatable, 'tasks', 't1', 'title', 'ar', 'Make the file')
            === 'أنشئ الملف');

    add('a positional (array) tasks translation is ignored, not indexed',
        nested({
            tasks: [{ id: 't1', title: 'Make the file' }],
            translations: { ar: { tasks: [{ title: 'WRONG' }] } },
        } as unknown as Translatable, 'tasks', 't1', 'title', 'ar', 'Make the file')
            === 'Make the file');

    add('a blank sub-field is a gap, not an answer',
        nested({
            tasks: [{ id: 't1', title: 'Make the file' }],
            translations: { ar: { tasks: { t1: { title: '  ' } } } },
        } as unknown as Translatable, 'tasks', 't1', 'title', 'ar', 'Make the file')
            === 'Make the file');

    add('a null record falls back rather than throwing',
        nested(null, 'tasks', 't1', 'title', 'ar', 'Make the file') === 'Make the file');

    return out;
}
