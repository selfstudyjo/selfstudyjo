/**
 * Self Study TV (app 38) — Arabic.
 *
 * ============================================================
 * ITS OWN AREA, BECAUSE CONTEXT IS WHAT MAKES A TRANSLATION RIGHT
 * ============================================================
 *
 * The nine modules are split by area rather than sorted A-Z for one reason: the
 * same English word is different Arabic words depending on what it sits next to.
 * This area is full of that, and none of it is decidable from the key alone:
 *
 *  * **"Series"** here is a television serial (`مسلسل`), not a sequence, not a
 *    series of lessons, and not `سلسلة`.
 *  * **"Season"** is `موسم` — a television season. The same word means a time of
 *    year and would be wrong in almost any other module.
 *  * **"Live"** is `مباشر` (as-it-happens broadcast), never `حيّ` (alive).
 *  * **"Play"** is `تشغيل` (start it running), not `لعب` (to play a game) —
 *    which is what a translator working from an alphabetical list would pick,
 *    because that is the commoner meaning of the English word.
 *  * **"Film"** is `فيلم` and **"Films"** `أفلام`; the loan word is what every
 *    Arabic viewer uses, and `شريط سينمائي` is a phrase nobody says.
 *
 * ============================================================
 * REGISTER
 * ============================================================
 *
 * Modern Standard Arabic, imperative for anything addressed to the reader, as in
 * every other module here. `Self Study` itself stays in Latin script — the same
 * decision `'Self Study Leaderboard': 'لوحة متصدّري Self Study'` already makes,
 * because it is a product name rather than a phrase.
 *
 * Digits are not this file's business: `$n` renders them through `Intl`, and a
 * timecode is deliberately not `$n` at all (see `iptvEngine.timecode` — a
 * timecode is a machine value and Arabic-Indic digits next to a colon inside an
 * LTR frame are exactly the bidi hazard `rtl.css` isolates against).
 */

import type { Catalogue } from '../../index';

const watch: Catalogue = {
    /* -- the sidebar ---------------------------------------------------- */
    // The platform menu's group heading. A group label left in English is
    // the only untranslated text on an otherwise translated sidebar, which
    // reads as a rendering fault rather than as a gap.
    'Watch': 'المشاهدة',

    /* -- the application, and how it is reached -------------------------- */
    'Self Study TV': 'تلفزيون Self Study',
    'Films, series and live channels': 'أفلام ومسلسلات وقنوات مباشرة',
    'Films, series and live channels — free with your account.':
        'أفلام ومسلسلات وقنوات مباشرة — مجاناً مع حسابك.',

    /* -- kinds ---------------------------------------------------------- */
    // A television serial. NOT `سلسلة`, which is a chain or a sequence.
    'Series': 'مسلسل',
    'Film': 'فيلم',
    'Films': 'أفلام',
    'Episode': 'حلقة',
    'Episodes': 'الحلقات',
    // A television season, not a time of year — the word is the same and the
    // context is the only thing that decides it.
    'Season {v0}': 'الموسم {v0}',

    /* -- rails ---------------------------------------------------------- */
    // Reached as `$t(rail.key)` from `iptvEngine.buildRails`, which is why these
    // read as headings rather than as sentences.
    'New this week': 'جديد هذا الأسبوع',
    'Continue watching': 'متابعة المشاهدة',
    'See all': 'عرض الكل',

    /* -- playing -------------------------------------------------------- */
    // `تشغيل` — start it running. NOT `لعب`, which is to play a game and is the
    // commoner meaning of the English word.
    'Play': 'تشغيل',
    'Watch now': 'شاهد الآن',
    'Resume': 'متابعة',
    'Start from the beginning': 'ابدأ من البداية',
    'You stopped at {v0}.': 'توقّفت عند {v0}.',
    'Next episode': 'الحلقة التالية',
    'Previous episode': 'الحلقة السابقة',
    'Coming soon': 'قريباً',
    'Untitled': 'بلا عنوان',

    /* -- live ----------------------------------------------------------- */
    // `مباشر` — as it happens. Never `حيّ`, which means alive.
    'Live channels': 'قنوات مباشرة',
    'Broadcast streams, playing straight from the broadcaster.':
        'بثّ مباشر يأتيك من جهة البثّ نفسها.',
    'Tuning in…': 'جارٍ الاتصال بالقناة…',
    'Search channels…': 'ابحث في القنوات…',
    // The fallback group for a channel an imported playlist gave no category.
    'Other': 'أخرى',

    /* -- searching ------------------------------------------------------ */
    'Search films, series and channels…': 'ابحث في الأفلام والمسلسلات والقنوات…',
    'Nothing matched that.': 'لا نتائج مطابقة.',

    /* -- empty, and not the same as broken ------------------------------ */
    'Nothing to watch yet': 'لا يوجد ما تشاهده بعد',
    'Films, series and channels appear here as soon as they are published.':
        'تظهر الأفلام والمسلسلات والقنوات هنا بمجرّد نشرها.',
    'No channels yet': 'لا قنوات بعد',
    'Live channels appear here as soon as they are published.':
        'تظهر القنوات المباشرة هنا بمجرّد نشرها.',
    'No episodes have been published yet.': 'لم تُنشر أي حلقة بعد.',
    'This has not been uploaded yet.': 'لم يُرفع هذا بعد.',

    /* -- failures ------------------------------------------------------- */
    // Every one of these is a fallback, and a fallback is reached when something
    // has already gone wrong — which makes it the last place to leave a second,
    // avoidable wrongness (working rule 39).
    'Self Study TV is not answering': 'تلفزيون Self Study لا يستجيب',
    'Self Study TV is not answering. Try again in a moment.':
        'تلفزيون Self Study لا يستجيب. أعد المحاولة بعد لحظات.',
    'Channels could not be loaded': 'تعذّر تحميل القنوات',
    'Channels could not be loaded.': 'تعذّر تحميل القنوات.',
    'That series could not be loaded': 'تعذّر تحميل هذا المسلسل',
    'That series could not be loaded.': 'تعذّر تحميل هذا المسلسل.',
    'That episode is not in this series.': 'هذه الحلقة ليست في هذا المسلسل.',
    'That could not be played.': 'تعذّر تشغيل هذا.',
    'Playback stopped. The link may have expired — try again.':
        'توقّف التشغيل. قد تكون صلاحية الرابط قد انتهت — أعد المحاولة.',
    'That channel is not responding. It may be off air.':
        'هذه القناة لا تستجيب. قد تكون متوقّفة عن البثّ.',
    'This browser cannot play live streams.':
        'هذا المتصفّح لا يستطيع تشغيل البثّ المباشر.',
    'The live player could not be loaded.': 'تعذّر تحميل مشغّل البثّ المباشر.',
};

export default watch;
