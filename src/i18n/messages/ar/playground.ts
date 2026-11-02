/**
 * The playgrounds: one free-practice workspace per tool (the top bar's
 * Playgrounds menu, /playgrounds and /playground/:id).
 *
 * Its own area because "playground" here is a SANDBOX for a product, not a
 * children's park and not a lab, and the group headings ("Data", "AI") are
 * menu sections rather than nouns in a sentence. Product and tool names (AWS,
 * kubectl, Snowsight) are never translated - they come from app 11 as data.
 * The bare "Playground" key lives in `labs.ts` (the workspace header) and must
 * not be declared again here.
 */

import type { Catalogue } from '../../index';

const playground: Catalogue = {
    /* The top bar button and its menu. */
    'Playgrounds': 'ساحات التدريب',
    'Open a playground for any tool': 'افتح ساحة تدريب لأي أداة',
    'Search tools…': 'ابحث عن أداة…',
    'All playgrounds': 'كل ساحات التدريب',
    'Your own workspace for every tool. Practise freely - nothing is graded or recorded.':
        'مساحة عمل خاصة بك لكل أداة. تدرّب بحرية - لا شيء يُقيَّم أو يُسجَّل.',
    'Sign in to use the playgrounds.': 'سجّل الدخول لاستخدام ساحات التدريب.',
    'Your plan does not include the playgrounds.': 'خطتك لا تتضمن ساحات التدريب.',
    'Loading the playgrounds…': 'جارٍ تحميل ساحات التدريب…',
    'No tool matches that search.': 'لا توجد أداة تطابق هذا البحث.',
    'The playgrounds could not be loaded.': 'تعذّر تحميل ساحات التدريب.',

    /* The menu's groups. */
    'Cloud': 'السحابة',
    'Data': 'البيانات',
    'DevOps': 'DevOps',
    'Programming': 'البرمجة',
    'Web & mobile': 'الويب والجوال',
    'AI': 'الذكاء الاصطناعي',
    'Networking': 'الشبكات',

    /* The two studios that have routes of their own. */
    'Build a network of routers, switches and PCs and configure it.':
        'ابنِ شبكة من الموجّهات والمحوّلات والحواسيب واضبط إعداداتها.',
    'Write CARLA Python, run it, watch it drive a 3D city.':
        'اكتب كود CARLA بلغة بايثون وشغّله وشاهده يقود في مدينة ثلاثية الأبعاد.',

    /* The /playgrounds page and one playground. */
    'Your own workspace for every tool on the platform - its consoles, its dashboards and its portal. Practise anything: nothing here is graded or recorded, and your work is saved between visits.':
        'مساحة عمل خاصة بك لكل أداة على المنصة - بواجهات أوامرها ولوحاتها وبوابتها. تدرّب على أي شيء: لا شيء هنا يُقيَّم أو يُسجَّل، ويُحفظ عملك بين الزيارات.',
    'Graded labs': 'المختبرات المُقيَّمة',
    'There is no playground with that name.': 'لا توجد ساحة تدريب بهذا الاسم.',
    'See every playground': 'اعرض كل ساحات التدريب',
    'Your own workspace for every tool - nothing graded': 'مساحة عمل لكل أداة - دون تقييم',
};

export default playground;
