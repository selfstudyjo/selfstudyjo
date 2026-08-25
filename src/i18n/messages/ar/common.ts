/**
 * Shared vocabulary — Arabic.
 *
 * Every key here is used by two or more files, which is exactly why they are
 * together: each one has to work in all of them. `node tools/i18n-wrap/where.mjs
 * "~shared"` prints the list, and a string that grows a second call site moves
 * into this file.
 *
 * The nav registry's labels are here too. They are the one set of strings a
 * reader sees on every screen, so getting them wrong is wrong everywhere at
 * once — and `check:i18n` asserts that every `NavEntry.text` in
 * `navigation/appNav.ts` has an entry here, because a sidebar that is half
 * translated reads as a broken build rather than as an unfinished one.
 */

import type { Catalogue } from '../../index';

const common: Catalogue = {
    /* ---------------------------------------------------------------- *
     * Actions
     * ---------------------------------------------------------------- */
    'Cancel': 'إلغاء',
    'Save': 'حفظ',
    'Delete': 'حذف',
    'Remove': 'إزالة',
    'Edit': 'تعديل',
    'Close': 'إغلاق',
    'Open': 'فتح',
    'Copy': 'نسخ',
    'Copy text': 'نسخ النص',
    'Duplicate': 'نسخة مطابقة',
    'Share': 'مشاركة',
    'Search': 'بحث',
    'Clear': 'مسح',
    'Clear search': 'مسح البحث',
    'Clear Search': 'مسح البحث',
    'Reset': 'إعادة تعيين',
    'Refresh': 'تحديث',
    'Retry': 'إعادة المحاولة',
    'Try again': 'حاول مرة أخرى',
    'Try Again': 'حاول مرة أخرى',
    'Next': 'التالي',
    'Previous': 'السابق',
    'Back': 'رجوع',
    'Stop': 'إيقاف',
    'Leave': 'مغادرة',
    'Review': 'مراجعة',
    'Reply': 'رد',
    'Send message': 'إرسال رسالة',
    'Post Comment': 'إضافة تعليق',
    'View': 'عرض',
    'View Details': 'عرض التفاصيل',
    'Zoom in': 'تكبير',
    'Zoom out': 'تصغير',
    '+ Add': '+ إضافة',
    'Actions': 'إجراءات',

    /* ---------------------------------------------------------------- *
     * States
     * ---------------------------------------------------------------- */
    'Loading...': 'جارٍ التحميل...',
    'Active': 'نشط',
    'Completed': 'مكتمل',
    'Expired': 'منتهي',
    'Scheduled': 'مجدول',
    'Draft': 'مسودة',
    'Published': 'منشور',
    'Under Review': 'قيد المراجعة',
    'Verified': 'مُوثَّق',
    'Valid': 'صالح',
    'Private': 'خاص',
    'Public': 'عام',
    'Online': 'متصل',
    'Muted': 'صامت',
    'New': 'جديد',
    'none': 'لا شيء',
    '(none)': '(لا شيء)',
    '(optional)': '(اختياري)',
    '— optional': '— اختياري',
    'auto': 'تلقائي',
    'Yes': 'نعم',
    'No': 'لا',
    'All Statuses': 'جميع الحالات',
    'All Types': 'جميع الأنواع',
    'Any type': 'أي نوع',
    'Any language': 'أي لغة',
    '-- None --': '-- بلا --',
    '(you)': '(أنت)',
    '(You)': '(أنت)',
    'Newest first': 'الأحدث أولاً',
    'Oldest first': 'الأقدم أولاً',
    'Highest score': 'أعلى نتيجة',

    /* ---------------------------------------------------------------- *
     * Field labels
     * ---------------------------------------------------------------- */
    'Name': 'الاسم',
    'Title': 'العنوان',
    'Description': 'الوصف',
    'Type': 'النوع',
    'Type:': 'النوع:',
    'Status': 'الحالة',
    'Status:': 'الحالة:',
    'Date': 'التاريخ',
    'Date:': 'التاريخ:',
    'Year': 'السنة',
    'Duration': 'المدة',
    'Duration:': 'المدة:',
    'Amount': 'المبلغ',
    'Amount:': 'المبلغ:',
    'Email': 'البريد الإلكتروني',
    'Username': 'اسم المستخدم',
    'First Name': 'الاسم الأول',
    'Last Name': 'اسم العائلة',
    'Gender': 'الجنس',
    'Male': 'ذكر',
    'Female': 'أنثى',
    'Language': 'اللغة',
    'Mode': 'الوضع',
    'Method': 'الطريقة',
    'Role': 'الدور',
    'Owner': 'المالك',
    'Team': 'الفريق',
    'Group': 'مجموعة',
    'Group name': 'اسم المجموعة',
    'Topic': 'الموضوع',
    'Keywords': 'الكلمات المفتاحية',
    'Keywords (comma separated)': 'الكلمات المفتاحية (مفصولة بفواصل)',
    '(comma separated)': '(مفصولة بفواصل)',
    'Instructions': 'التعليمات',
    'Instructions:': 'التعليمات:',
    'Total': 'المجموع',
    'Score': 'النتيجة',
    'Score:': 'النتيجة:',
    'Results': 'النتائج',
    'Questions': 'الأسئلة',
    'From': 'من',
    'To': 'إلى',
    'Created:': 'أُنشئ في:',
    'Expires:': 'ينتهي في:',
    'User ID': 'معرّف المستخدم',
    'File name': 'اسم الملف',
    'File description': 'وصف الملف',
    'Template': 'القالب',
    'Templates': 'القوالب',
    'Template library': 'مكتبة القوالب',
    'Shape': 'الشكل',
    'Mask': 'قناع',
    'Code': 'الشيفرة',
    'Issues': 'ملاحظات',
    'Website': 'الموقع الإلكتروني',
    'Profile picture': 'صورة الملف الشخصي',
    'Take a photo': 'التقاط صورة',
    'Page {v0} of {v1}': 'صفحة {v0} من {v1}',
    '(Page {v0} of {v1})': '(صفحة {v0} من {v1})',
    'Question {v0} of {v1}': 'السؤال {v0} من {v1}',
    '« First': '« الأولى',
    '({v0} parts)': '({v0} أجزاء)',
    '+{v0} more': '+{v0} أخرى',
    '…and {v0} more.': '…و{v0} أخرى.',
    'Nobody matches “{v0}”.': 'لا أحد يطابق “{v0}”.',

    /* ---------------------------------------------------------------- *
     * Counted quantities
     *
     * These are `$t` sites, where the sentence around the number already
     * carries the count, so one form is right. Where a call site uses `$tc`
     * instead, the entry is a plural object and Arabic gets all six forms —
     * `Intl.PluralRules('ar')` distinguishes zero, one, two, few (3-10), many
     * (11-99) and other, and getting that wrong reads as broken grammar to a
     * native reader while looking completely fine to anybody else.
     * ---------------------------------------------------------------- */
    '{v0} characters': '{v0} حرفاً',
    '{v0} words': '{v0} كلمة',
    '{v0} minutes': '{v0} دقيقة',
    '{v0} min': '{v0} دقيقة',
    '{v0} hours': '{v0} ساعة',
    '{v0} steps': '{v0} خطوة',
    '{v0} views': '{v0} مشاهدة',
    '{v0} downloads': '{v0} تنزيلاً',
    '{v0} citations': '{v0} استشهاداً',
    '{v0} pts': '{v0} نقطة',
    '{v0} points': '{v0} نقطة',
    '{v0} unread': '{v0} غير مقروءة',
    '{n} unread': {
        zero: 'لا رسائل غير مقروءة',
        one: 'رسالة واحدة غير مقروءة',
        two: 'رسالتان غير مقروءتين',
        few: '{n} رسائل غير مقروءة',
        many: '{n} رسالة غير مقروءة',
        other: '{n} رسالة غير مقروءة',
    },
    '{v0} new': '{v0} جديدة',
    '{v0} comments': '{v0} تعليقاً',
    '{v0} members': '{v0} عضواً',
    '{v0} followers': '{v0} متابعاً',
    '{v0} files': '{v0} ملفاً',
    '{v0} links': '{v0} رابطاً',
    '{v0} errors': '{v0} أخطاء',
    '{v0} warnings': '{v0} تحذيراً',
    '{v0} hints': '{v0} تلميحاً',
    '{v0} parts': '{v0} أجزاء',
    '{v0} bytes': '{v0} بايت',
    '{v0} devices': '{v0} جهازاً',
    '{v0} projects': '{v0} مشروعاً',
    '{v0} sources': '{v0} مصدراً',
    '{v0} lessons': '{v0} درساً',
    '{v0} ms': '{v0} م.ث',
    '{v0}ms': '{v0} م.ث',
    '{v0}px': '{v0} بكسل',
    '~{v0} words': '~{v0} كلمة',
    '~{v0} pages': '~{v0} صفحة',
    '{v0} / {v1} lessons': '{v0} / {v1} درساً',
    '{v0} / {v1} sections': '{v0} / {v1} قسماً',
    '/ {v0} sections': '/ {v0} قسماً',
    '{v0} • {v1} minutes': '{v0} • {v1} دقيقة',
    '{v0}–{v1} min': '{v0}–{v1} دقيقة',
    '% match': '% تطابق',
    'JOD {v0}': '{v0} دينار',

    /* ---------------------------------------------------------------- *
     * The sidebar — every label, every group, every application.
     *
     * Checked against `navigation/appNav.ts` by `check:i18n`: a `NavEntry`
     * whose `text` has no entry here fails the build. A half-translated
     * sidebar is on every screen at once, so it is the one place where an
     * ordinary gap is not acceptable.
     * ---------------------------------------------------------------- */
    'Home': 'الرئيسية',
    'Main': 'الرئيسية',
    'Learn': 'التعلّم',
    'Tools': 'الأدوات',
    'Account': 'الحساب',
    'All applications': 'جميع التطبيقات',
    'Courses': 'الدورات',
    'Exams': 'الاختبارات',
    'Quizzes': 'الاختبارات القصيرة',
    'Certificates': 'الشهادات',
    'All Certificates': 'جميع الشهادات',
    'My Certificates': 'شهاداتي',
    'Exam Certificates': 'شهادات الاختبارات',
    'Course Certificates': 'شهادات الدورات',
    'My Results': 'نتائجي',
    'Leaderboard': 'لوحة المتصدرين',
    'Runbooks': 'أدلة العمل',
    'Labs': 'المعامل',
    'Notifications': 'الإشعارات',
    'Messages': 'الرسائل',
    'Profile': 'الملف الشخصي',
    'Plans': 'الخطط',
    'My Plans': 'خططي',
    'Newscast': 'الموجز الإخباري',
    'Job Interview': 'مقابلة العمل',
    'Toastmasters': 'Toastmasters',
    'CV Builder': 'منشئ السيرة الذاتية',
    'Drawing Papers': 'أوراق الرسم',
    'Network Simulator': 'محاكي الشبكات',
    'Roblox Studio': 'استوديو Roblox',
    'Research Flow': 'مسار البحث',
    'Login': 'تسجيل الدخول',
    'Logout': 'تسجيل الخروج',
    'Theme': 'المظهر',

    /* ---------------------------------------------------------------- *
     * The sidebar's application headers and the rest of its labels.
     *
     * The subtitle under each application title is the sentence saying what
     * that application is FOR, and it is translated for the same reason the
     * labels are: left in English it is the only untranslated text on an
     * otherwise translated sidebar, which reads as a rendering fault rather
     * than as unfinished work.
     * ---------------------------------------------------------------- */
    'Overview': 'نظرة عامة',
    'Related': 'ذات صلة',
    'Studio': 'الاستوديو',
    'Search pages…': 'ابحث في الصفحات…',
    'Search navigation': 'البحث في القائمة',
    'Search {app} & all apps…': 'ابحث في {app} وفي جميع التطبيقات…',

    'Lessons, homework and quizzes': 'الدروس والواجبات والاختبارات القصيرة',
    'Sit, schedule and review exams': 'أدِّ الاختبارات واحجز مواعيدها وراجع نتائجها',
    'Schedule Exam': 'حجز موعد اختبار',
    'Exam Approval': 'الموافقة على الاختبار',
    'Credentials you have earned': 'المؤهّلات التي حصلت عليها',
    'Who is ahead across the platform': 'من المتقدّم على مستوى المنصّة',
    'Step-by-step operational guides': 'أدلة تشغيلية خطوة بخطوة',
    'SQL, Linux and Python sandboxes': 'بيئات SQL وLinux وPython',
    'SQL Database': 'قاعدة بيانات SQL',
    'Linux Terminal': 'طرفية Linux',
    'Python Compiler': 'مصرّف Python',
    'Build and test topologies': 'ابنِ الطبولوجيات واختبرها',
    'Animation and scripting': 'التحريك والبرمجة النصية',
    'Ask, explain, summarise': 'اسأل واشرح ولخّص',
    'Mock interviews and feedback': 'مقابلات تجريبية وملاحظات',
    'Prepare Interview': 'تجهيز المقابلة',
    'Practise public speaking': 'تدرّب على الخطابة',
    'Prepare Session': 'تجهيز الجلسة',
    'Write, tailor and export a CV': 'اكتب سيرتك الذاتية وصمّمها وصدّرها',
    'My CVs': 'سِيَري الذاتية',
    'Shared canvas, free with an account': 'لوح مشترك، مجاناً مع الحساب',
    'My Papers': 'أوراقي',
    'Talk to students and teachers': 'تحدّث إلى الطلاب والمعلّمين',
    'Conversations': 'المحادثات',
    'World news, read to you hourly': 'أخبار العالم، تُقرأ عليك كل ساعة',
    'Profile, alerts and subscription': 'الملف الشخصي والتنبيهات والاشتراك',
    'Plans & Billing': 'الخطط والفواتير',
    'Subscriptions and payments': 'الاشتراكات والمدفوعات',
    'Proctoring': 'المراقبة',
    'Proctor Dashboard': 'لوحة المراقب',
    'Supervise exam appointments': 'الإشراف على مواعيد الاختبارات',
    'Projects, sources and writing': 'المشاريع والمصادر والكتابة',
    'My Projects': 'مشاريعي',
    'Create Project': 'إنشاء مشروع',
    'My Library': 'مكتبتي',
    'AI Writer': 'الكاتب بالذكاء الاصطناعي',
    'Collaboration': 'التعاون',
    'Researchers': 'الباحثون',
    'My Researcher Profile': 'ملفي كباحث',
    'Google Scholar': 'Google Scholar',

    /* ---------------------------------------------------------------- *
     * Academic and research vocabulary, shared across the Research Flow
     * views and the CV Builder.
     * ---------------------------------------------------------------- */
    'About': 'حول',
    'Bio': 'نبذة',
    'Institution': 'المؤسسة',
    'University': 'الجامعة',
    'University / institution': 'الجامعة / المؤسسة',
    'Department': 'القسم',
    'Supervisor': 'المشرف',
    'Field of study': 'مجال الدراسة',
    'Degree programme': 'البرنامج الدراسي',
    'Submission year': 'سنة التقديم',
    'Publication Year': 'سنة النشر',
    'Publication type': 'نوع المنشور',
    'Authors': 'المؤلفون',
    'Authors:': 'المؤلفون:',
    'References': 'المراجع',
    'Key terms': 'المصطلحات الأساسية',
    'Venue/Journal': 'المجلة / المكان',
    'Open access': 'وصول مفتوح',
    'PDF available': 'ملف PDF متاح',
    'My papers': 'أوراقي البحثية',
    'View paper': 'عرض الورقة البحثية',
    'View Project': 'عرض المشروع',
    'Search Projects': 'البحث في المشاريع',
    'Import from OpenAlex': 'استيراد من OpenAlex',
    'AI Research Writer': 'كاتب البحث بالذكاء الاصطناعي',
    'Can edit': 'يمكنه التعديل',
    'View only': 'العرض فقط',
    'Saves as': 'يُحفظ باسم',

    /* ---------------------------------------------------------------- *
     * Networking vocabulary shared between the simulator, its lessons and
     * the labs. The protocol names themselves are NOT here — `ATOMIC` in
     * `tools/i18n-wrap/wrap.mjs` keeps ACL, ARP, MTU and the rest out of
     * the catalogue, because each is written the same way in an Arabic
     * textbook and three identical entries is three chances to be wrong.
     * ---------------------------------------------------------------- */
    'Network': 'الشبكة',
    'Next hop': 'القفزة التالية',
    'Request DHCP': 'طلب DHCP',
    'Device encyclopedia': 'موسوعة الأجهزة',
    'Terminal': 'الطرفية',

    /* ---------------------------------------------------------------- *
     * Shared across the exam, certificate, plan and report screens.
     *
     * All of these turned up as gaps on views that were otherwise complete —
     * `check:i18n --gaps` naming a handful of strings per screen rather than a
     * screen. That is what a shared-vocabulary file is FOR, and it is the reason
     * coverage is worth reading per area rather than in total: eight missing
     * keys spread over nine views is one omission, not nine.
     * ---------------------------------------------------------------- */
    'Exam Information': 'معلومات الاختبار',
    'Exam Instructions Video': 'فيديو تعليمات الاختبار',
    'Video Instructions': 'تعليمات مصوّرة',
    'Error Loading Exam': 'تعذّر تحميل الاختبار',
    'Error Loading Certificates': 'تعذّر تحميل الشهادات',
    'Loading certificates...': 'جارٍ تحميل الشهادات...',
    'No Exam Certificates Found': 'لا توجد شهادات اختبارات',
    'No Course Certificates Found': 'لا توجد شهادات دورات',
    'Proctor Information': 'معلومات المراقب',
    'Proctor:': 'المراقب:',
    'Exam:': 'الاختبار:',
    'Course:': 'الدورة:',
    'Course': 'الدورة',
    'Back to Exams': 'رجوع إلى الاختبارات',
    'Back to Course': 'رجوع إلى الدورة',
    'Back to the dashboard': 'رجوع إلى لوحة التحكم',
    'Cancel Appointment': 'إلغاء الموعد',
    'Reschedule Exam': 'إعادة جدولة الاختبار',
    'View Appointment': 'عرض الموعد',
    'No room link set': 'لم يُحدَّد رابط القاعة',
    'Room 1': 'القاعة 1',
    'Room 2': 'القاعة 2',
    'View Plans': 'عرض الخطط',
    'View All Results →': 'عرض جميع النتائج →',
    'Quiz Results': 'نتائج الاختبارات القصيرة',
    'Active Subscriptions': 'الاشتراكات النشطة',
    'Payment History': 'سجل المدفوعات',
    'Payment ID': 'معرّف الدفعة',
    'Plan': 'الخطة',
    'Plan:': 'الخطة:',
    'New message': 'رسالة جديدة',

    /* The Toastmasters speech types and the interview report headings.
     *
     * Shared between a pre-session form, a live room and a results page, which
     * is exactly why they are here: a speech type called one thing on the form
     * and another in the report reads as two different features.
     *
     * The emoji are part of the key and are kept in the translation. They are
     * the only visual anchor on a long report, and dropping them in one
     * language makes that language's report look like a different screen. */
    'Prepared Speech': 'خطاب مُعدّ مسبقاً',
    'Evaluation Speech': 'خطاب تقييم',
    'Inspirational Speech': 'خطاب تحفيزي',
    'Persuasive Speech': 'خطاب إقناعي',
    'Table Topics (Impromptu)': 'موضوعات الطاولة (ارتجالي)',
    '⏱️ Timer Report': '⏱️ تقرير المؤقّت',
    '✍️ Grammarian Report': '✍️ تقرير مدقّق اللغة',
    '🗣️ Ah-Counter Report': '🗣️ تقرير عدّاد الحشو',
    '📋 Speech Evaluator Report': '📋 تقرير مقيّم الخطاب',
    '🎯 General Evaluator Report': '🎯 تقرير المقيّم العام',
    '📹 Body Language Analysis': '📹 تحليل لغة الجسد',
    '🎭 {v0} Role Evaluation': '🎭 تقييم دور {v0}',
    '📊 Filler Word Breakdown ({v0} total):': '📊 تفصيل كلمات الحشو (المجموع {v0}):',
    '✨ Zero filler words — outstanding clarity!': '✨ صفر كلمات حشو — وضوح ممتاز!',
    '✅ Strengths': '✅ نقاط القوة',
    '📈 Areas to Improve': '📈 مجالات التحسين',
    '📝 Overall Summary': '📝 الملخّص العام',
    '🗣️ Communication': '🗣️ التواصل',
    '🌟 Your strongest moment': '🌟 أقوى لحظة لديك',
    '⚠️ What would worry a hiring manager': '⚠️ ما قد يقلق مسؤول التوظيف',
    '🎯 Do this before your next interview': '🎯 افعل هذا قبل مقابلتك القادمة',
    '📊 Where the score came from': '📊 من أين جاءت النتيجة',
    '🔁 Redo This Interview': '🔁 إعادة هذه المقابلة',
    '✏️ Change Details & Redo': '✏️ تغيير التفاصيل والإعادة',
    '📄 View': '📄 عرض',
    '✂️ Replace highlighted': '✂️ استبدال المحدَّد',

    /* The spoken-correction words, quoted as the room quotes them.
     *
     * The Arabic is added rather than substituted: `answerEditing.ts` listens
     * for BOTH sets, because candidates code-switch constantly and somebody who
     * has practised saying "sorry" should not lose the feature by switching
     * interface language. These keys are only the explanation of it. */
    '“sorry”': '«آسف»',
    '“sorry sorry”': '«آسف آسف»',
    '— paste a bit more; 80 is the minimum.': '— الصق قليلاً أكثر؛ الحد الأدنى 80 حرفاً.',
    'Choose Technical or HR, set your role/topic and qualifications, then get interviewed question-by-question.':
        'اختر مقابلة تقنية أو مقابلة موارد بشرية، وحدّد دورك أو موضوعك ومؤهّلاتك، ثم أجرِ المقابلة سؤالاً بسؤال.',
    'For each question: what you said, your own answer rewritten to be stronger, a short model answer you can rehearse, and why the interviewer asked it.':
        'لكل سؤال: ما قلته، وإجابتك أنت مُعادة الصياغة بصورة أقوى، وإجابة نموذجية قصيرة يمكنك التدرّب عليها، وسبب طرح المحاور للسؤال.',

    /* ---------------------------------------------------------------- *
     * Self Study JO's own name is not translated.
     *
     * It is the product, and a product that calls itself something else in
     * one language is a different product to the reader looking for it.
     * Everything else on the page around it is Arabic.
     * ---------------------------------------------------------------- */
    'Self Study JO': 'Self Study JO',
};

export default common;
