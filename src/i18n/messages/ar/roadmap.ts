/**
 * The Roadmap Provider: a learning path to a job role, drawn as a map.
 *
 * Its own area because "stage", "step", "map" and "tour" here are a JOURNEY
 * (مرحلة، خطوة، خريطة، جولة) - not an exam stage, a lab task or the guided
 * tour of the interface. Role titles, stage names and step titles are English
 * record data and are rendered as-is; only the chrome is translated.
 */

import type { Catalogue } from '../../index';

const roadmap: Catalogue = {
    /* Navigation. */
    'Roadmap Provider': 'مُنشئ خرائط التعلّم',
    'My Roadmaps': 'خرائطي',
    'Your learning path to a role, free with an account': 'طريقك التعليمي إلى وظيفة، مجانًا مع حساب',

    /* The page. */
    'Pick a field, a specialization or a job role, and get a step-by-step roadmap built from the courses, lessons, labs and runbooks on this site - drawn as a map you can walk in 2D or 3D.':
        'اختر مجالًا أو تخصصًا أو مسمّى وظيفيًا، واحصل على خريطة تعلّم خطوة بخطوة مبنية من الدورات والدروس والمختبرات وأدلة التشغيل على هذا الموقع - مرسومة كخريطة يمكنك التجوّل فيها بعرض ثنائي أو ثلاثي الأبعاد.',
    'New roadmap': 'خريطة جديدة',
    'Sign in or register to build your roadmaps': 'سجّل الدخول أو أنشئ حسابًا لبناء خرائطك',
    'Roadmaps are free with an account. Your maps and your progress on them are saved, so you can come back to them any time.':
        'الخرائط مجانية مع حساب. تُحفظ خرائطك وتقدّمك فيها، لتعود إليها متى شئت.',
    'Register': 'إنشاء حساب',

    /* My roadmaps. */
    'My roadmaps': 'خرائطي',
    'Loading your roadmaps…': 'جارٍ تحميل خرائطك…',
    'You have not made a roadmap yet. Choose one from the catalogue to start.':
        'لم تُنشئ أي خريطة بعد. اختر واحدة من الدليل لتبدأ.',
    'Roadmap name': 'اسم الخريطة',
    '{v0} of {v1} steps done': 'أُنجزت {v0} من {v1} خطوة',
    'Delete this roadmap and your progress on it?': 'حذف هذه الخريطة وتقدّمك فيها؟',
    'Roadmap deleted.': 'حُذفت الخريطة.',

    /* Creating. */
    'The AI is writing your roadmap…': 'الذكاء الاصطناعي يكتب خريطتك…',
    'Building your roadmap…': 'جارٍ بناء خريطتك…',
    '{v0} s - this can take up to half a minute.': '{v0} ث - قد يستغرق ذلك حتى نصف دقيقة.',
    'Reading the role': 'قراءة متطلبات الوظيفة',
    'Matching courses, lessons and labs': 'مطابقة الدورات والدروس والمختبرات',
    'Arranging the stages': 'ترتيب المراحل',
    'Drawing your map': 'رسم خريطتك',
    'Your roadmap is ready.': 'خريطتك جاهزة.',

    /* Opening one. */
    'Opening the roadmap…': 'جارٍ فتح الخريطة…',
    'This roadmap could not be opened': 'تعذّر فتح هذه الخريطة',
    'It may have been deleted, or it belongs to another account.': 'ربما حُذفت، أو أنها تخص حسابًا آخر.',
    'Back to my roadmaps': 'العودة إلى خرائطي',

    /* The preview bar. */
    'This is the template. Make it yours to track your progress.': 'هذا هو القالب. اجعله خريطتك لتتابع تقدّمك.',
    'Hours a week': 'ساعات في الأسبوع',
    'Personalise with AI': 'خصّصها بالذكاء الاصطناعي',
    'Create my roadmap': 'أنشئ خريطتي',
    'Back to the catalogue': 'العودة إلى الدليل',

    /* The roadmap. */
    'about {v0} weeks': 'نحو {v0} أسابيع',
    '{v0} hours a week': '{v0} ساعات في الأسبوع',
    '{v0} stages': '{v0} مراحل',
    'Written with AI': 'كُتبت بالذكاء الاصطناعي',
    '{v0}% done': 'أُنجز {v0}%',
    '{v0} in progress': '{v0} قيد التنفيذ',
    'Next up:': 'التالي:',
    'Show me': 'أرني',
    'Map view': 'طريقة عرض الخريطة',
    'Play tour': 'تشغيل الجولة',
    'Legend': 'مفتاح الرموز',
    '3D needs WebGL, which this browser does not offer, so the map is shown in 2D.':
        'يحتاج العرض ثلاثي الأبعاد إلى WebGL، وهو غير متاح في هذا المتصفح، لذلك تُعرض الخريطة بعرض ثنائي الأبعاد.',
    'The 3D map could not start on this device, so it is shown in 2D.':
        'تعذّر تشغيل الخريطة ثلاثية الأبعاد على هذا الجهاز، لذلك تُعرض بعرض ثنائي الأبعاد.',
    'Roadmap map': 'خريطة التعلّم',
    'Stage {v0}': 'المرحلة {v0}',
    '{v0} wk': '{v0} أسبوع',
    'optional': 'اختياري',

    /* 3D. */
    '3D roadmap map': 'خريطة التعلّم ثلاثية الأبعاد',
    'Building the 3D map…': 'جارٍ بناء الخريطة ثلاثية الأبعاد…',
    'Previous stage': 'المرحلة السابقة',
    'Whole map': 'الخريطة كاملة',
    'Next stage': 'المرحلة التالية',
    'Drag to turn · scroll or pinch to zoom · right-drag to move':
        'اسحب للتدوير · مرّر أو اضغط بإصبعين للتكبير · اسحب بالزر الأيمن للتحريك',

    /* One step. */
    'Do these first': 'أنجز هذه أولًا',
    'This topic has no page on the site yet - the role sources show where to learn it.':
        'لا توجد صفحة لهذا الموضوع على الموقع بعد - تشير مصادر الوظيفة إلى أين تتعلّمه.',
    'Your progress on this step': 'تقدّمك في هذه الخطوة',
    'Doing': 'قيد التنفيذ',
    'Open the course': 'افتح الدورة',
    'Open the lesson': 'افتح الدرس',
    'Open the runbook': 'افتح دليل التشغيل',

    /* The role. */
    'What this role needs': 'ما تتطلّبه هذه الوظيفة',
    'Responsibilities': 'المسؤوليات',

    /* The builder. */
    'From the catalogue': 'من الدليل',
    'Describe your own role': 'صف وظيفتك بنفسك',
    'Search roles and fields…': 'ابحث في الوظائف والمجالات…',
    'Loading the catalogue…': 'جارٍ تحميل الدليل…',
    'Nothing in the catalogue matches. Try "Describe your own role" instead.':
        'لا شيء في الدليل يطابق بحثك. جرّب «صف وظيفتك بنفسك» بدلًا من ذلك.',
    '{v0} courses': '{v0} دورات',
    '{v0} runbooks': '{v0} أدلة تشغيل',
    'Preview the roadmap': 'معاينة الخريطة',
    'Job role, field or specialization': 'المسمّى الوظيفي أو المجال أو التخصص',
    'e.g. Cloud Security Engineer': 'مثال: مهندس أمن سحابي',
    'Your goal (optional)': 'هدفك (اختياري)',
    'e.g. Move from IT support into cloud security within a year': 'مثال: الانتقال من الدعم الفني إلى أمن السحابة خلال عام',
    "The AI researches the role and arranges the site's courses, labs and runbooks around it. Without it, the closest catalogue roadmap is used.":
        'يبحث الذكاء الاصطناعي في الوظيفة وينظّم دورات الموقع ومختبراته وأدلة تشغيله حولها. وبدونه تُستخدم أقرب خريطة من الدليل.',
    'Build my roadmap': 'ابنِ خريطتي',

    /* The service. */
    'The Roadmap Provider is not available yet': 'مُنشئ خرائط التعلّم غير متاح بعد',
    'It is being switched on. Please check back soon.': 'جارٍ تفعيله. يُرجى العودة قريبًا.',
    'The roadmap service is not set up yet': 'خدمة الخرائط غير مُهيّأة بعد',
    'The server is missing its configuration. Please try again later.': 'تنقص الخادم إعداداته. يُرجى المحاولة لاحقًا.',
    'The roadmap service could not be reached': 'تعذّر الوصول إلى خدمة الخرائط',
    'Check your connection and try again. The first visit of the day can take up to 20 seconds.':
        'تحقّق من اتصالك وحاول مجددًا. قد تستغرق أول زيارة في اليوم حتى 20 ثانية.',
    'Something went wrong. Please try again.': 'حدث خطأ ما. يُرجى المحاولة مجددًا.',
};

export default roadmap;
