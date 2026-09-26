/**
 * The read-aloud control: "Read this section", and its transport bar.
 *
 * Its own area rather than a handful of keys in `common`, for the reason the
 * index file gives: context is what makes a translation right. "Read" here is
 * the imperative "read this to me" and not the reader's own act of reading;
 * "pause" is pausing a VOICE and not pausing a lab or a timer; and "Preparing"
 * is the platform synthesising audio rather than a student getting ready. Every
 * one of those is a different word in Arabic, and the only way to pick each
 * correctly is to see the others beside it.
 *
 * `Previous`, `Next` and `Stop` are deliberately NOT here -- they are already in
 * `common`, and a key declared in two modules is a silent overwrite that
 * `check:i18n` section 6 exists to catch.
 *
 * This is the one catalogue on the platform whose reader may not be able to see
 * the screen at all. A word that is wrong here is wrong in the one place the
 * interface cannot be checked by looking at it.
 */

import type { Catalogue } from '../../index';

const reader: Catalogue = {
    /* The button. */
    'Read this section': 'اقرأ هذا القسم',
    'Preparing…': 'جارٍ التحضير…',
    'Pause': 'إيقاف مؤقت',
    'Resume': 'متابعة',
    'There is nothing here to read aloud.': 'لا يوجد نص هنا لقراءته بصوت مسموع.',

    /* The transport bar. */
    'Reading aloud': 'القراءة بصوت مسموع',
    'Stop reading': 'إيقاف القراءة',
    'Reading speed': 'سرعة القراءة',
    '{v0} min left': 'يتبقى {v0} دقيقة',
    '{v0} min listen': 'مدة الاستماع {v0} دقيقة',

    /*
      THE TWO DECLARATIONS.

      Both exist because a substitution that is not declared is the bug working
      rule 21 is about, and both are read by somebody who can see the screen and
      is wondering why the voice did something.

      "Read in {v0}" is shown when the section is not in the language the reader
      chose -- which is the NORMAL case on ~230 lesson write-ups and on the whole
      Network Simulator catalogue, all of which are English only. The language
      name arrives in its OWN script (`nativeName`), so this sentence routinely
      wraps an English or Chinese word inside Arabic prose; the bar isolates it.
    */
    'Read in {v0}': 'تُقرأ بـ{v0}',
    'Code is not read aloud': 'لا تُقرأ الأوامر بصوت مسموع',
    '{v0} code blocks are not read aloud': 'لا تُقرأ {v0} من مقاطع الأوامر بصوت مسموع',

    'The voice service could not be reached. Reading stopped.':
        'لم يتم الوصول إلى خدمة الصوت. توقفت القراءة.',
};

export default reader;
