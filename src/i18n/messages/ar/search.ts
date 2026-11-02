/**
 * The site search: the field in the top bar and its results panel.
 *
 * Its own area because "search" here is the whole-site finder rather than a
 * filter box over one list, and the section headings ("Lessons", "Quizzes")
 * are headings of a results list. Keys that already exist elsewhere -
 * "Courses", "Exams", "Runbooks", "Quizzes", "Lessons", "Clear", "Clear search",
 * "Playground", "Loading…", "Show {v0} more" - are NOT declared again here
 * (`check:i18n` fails on a key declared twice).
 */

import type { Catalogue } from '../../index';

const search: Catalogue = {
    /* The field in the top bar. */
    'Search the site…': 'ابحث في الموقع…',
    'Search the site': 'ابحث في الموقع',
    'Search courses, lessons, labs, quizzes, exams, runbooks and pages':
        'ابحث في الدورات والدروس والمختبرات والاختبارات القصيرة والامتحانات وأدلة التشغيل والصفحات',
    'Close search': 'أغلق البحث',
    'Search results': 'نتائج البحث',

    /* Before anything is typed. */
    'Recent searches': 'عمليات البحث الأخيرة',
    'Jump to': 'انتقل إلى',
    'Type to search courses, lessons, labs, quizzes, exams, runbooks and pages.':
        'اكتب للبحث في الدورات والدروس والمختبرات والاختبارات القصيرة والامتحانات وأدلة التشغيل والصفحات.',

    /* The result sections. */
    'Pages & apps': 'الصفحات والتطبيقات',
    'Labs & playgrounds': 'المختبرات وساحات التدريب',
    'Show fewer': 'اعرض أقل',
    'This section could not be loaded.': 'تعذّر تحميل هذا القسم.',
    'The service did not answer. Press to try again.': 'لم تستجب الخدمة. اضغط للمحاولة مرة أخرى.',
    'Some results are still loading': 'لا تزال بعض النتائج قيد التحميل',

    /* A result the reader cannot open yet. */
    'Sign in to open': 'سجّل الدخول لفتحه',
    'Needs a plan with labs': 'يتطلب خطة تشمل المختبرات',
    'Needs a plan with runbooks': 'يتطلب خطة تشمل أدلة التشغيل',
    'Needs a plan with AI tools': 'يتطلب خطة تشمل أدوات الذكاء الاصطناعي',
    'Needs a plan with Research Flow': 'يتطلب خطة تشمل Research Flow',
    'Needs a plan with Toastmasters': 'يتطلب خطة تشمل Toastmasters',
    'Needs a plan with exams': 'يتطلب خطة تشمل الامتحانات',
    'Needs a subscription': 'يتطلب اشتراكًا',

    /* Nothing found. */
    'No results': 'لا توجد نتائج',
    '{v0} results': '{v0} نتيجة',
    'No results for “{v0}”': 'لا توجد نتائج لـ «{v0}»',
    'Check the spelling, or try fewer or shorter words.': 'تحقّق من الإملاء، أو جرّب كلمات أقل أو أقصر.',
    'You can search in English, Arabic or Chinese.': 'يمكنك البحث بالعربية أو الإنجليزية أو الصينية.',
    'Browse instead': 'أو تصفّح',

    /* The keyboard hints in the footer. */
    'to move': 'للتنقل',
    'to open': 'للفتح',
    'next section': 'القسم التالي',
    'to close': 'للإغلاق',
};

export default search;
