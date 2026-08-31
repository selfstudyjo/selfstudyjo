/**
 * Courses, homework, exams, quizzes, certificates, the leaderboard, runbooks,
 * the labs, and both proctor screens — Arabic.
 *
 * The largest file here, and the one where a mistranslation costs the most: an
 * exam candidate reading these strings is under a clock, and a proctor reading
 * them is deciding whether to let somebody into a room.
 *
 * Three distinctions English collapses and Arabic must not:
 *
 *  - **Exam vs quiz.** `اختبار` for the invigilated exam, `اختبار قصير` for the
 *    quiz inside a lesson. One word for both, and a student cannot tell whether
 *    the thing with a proctor and a certificate is the thing they can retake
 *    from the course page.
 *  - **"Take" an exam vs "take" a photo.** `ابدأ` / `أدِّ` for sitting an exam,
 *    `التقط` for a picture. The first is elsewhere in this file; the second is
 *    in `common.ts`.
 *  - **"Clear" the answer vs "clear" the filters vs "clear" the terminal.**
 *    `امسح` for the answer and the screen, `أزل` for the filters — removing a
 *    filter puts rows back, wiping an answer takes it away, and using one verb
 *    for both makes "Clear filters" read as "delete the results".
 */

import type { Catalogue } from '../../index';

const learning: Catalogue = {
    /* ---------------------------------------------------------------- *
     * Courses
     * ---------------------------------------------------------------- */
    'Explore Courses': 'استكشف الدورات',
    'Expand your knowledge with our curated courses': 'وسّع معرفتك مع دوراتنا المختارة',
    'Loading courses...': 'جارٍ تحميل الدورات...',
    'Unable to load courses': 'تعذّر تحميل الدورات',
    'No courses found': 'لم تُعثر على دورات',
    'Search courses...': 'ابحث في الدورات...',
    'Showing {v0} of {v1} courses': 'تُعرض {v0} من {v1} دورة',
    'Page {v0} of {v1} • {v2} total courses': 'صفحة {v0} من {v1} • {v2} دورة إجمالاً',
    'for "{v0}"': 'عن "{v0}"',
    'Sort by:': 'ترتيب حسب:',
    'Newest First': 'الأحدث أولاً',
    'Oldest First': 'الأقدم أولاً',
    'Title (A-Z)': 'العنوان (أ-ي)',
    'Title (Z-A)': 'العنوان (ي-أ)',

    'Back to Courses': 'رجوع إلى الدورات',
    'Loading course details...': 'جارٍ تحميل تفاصيل الدورة...',
    'Unable to load course': 'تعذّر تحميل الدورة',
    'Lessons': 'الدروس',
    'No lessons available for this course yet.': 'لا توجد دروس لهذه الدورة بعد.',
    'Reading Material': 'مادة القراءة',
    'Source Code': 'الشيفرة المصدرية',
    'Runbook': 'دليل العمل',

    /* ---------------------------------------------------------------- *
     * One lesson's page.
     *
     * `الدرس` is the lesson itself; `المحتوى` is its write-up. English uses
     * "content" for both the field and the page section, and Arabic must not:
     * `محتوى الدرس` names the write-up, and a heading reading just `المحتوى`
     * over a page that also has a discussion and a homework list reads as "the
     * contents of this page".
     *
     * `المناقشة` for the lesson's comments rather than `التعليقات`. The course
     * page's list is a set of remarks about the course; a lesson's is a thread
     * of questions and answers about one topic, and a student scanning a
     * sidebar for "where do I ask about this" looks for the second word.
     * ---------------------------------------------------------------- */
    'Loading lesson…': 'جارٍ تحميل الدرس…',
    'Unable to load this lesson': 'تعذّر تحميل هذا الدرس',
    'Back to the course': 'رجوع إلى الدورة',
    'Open Lesson': 'افتح الدرس',
    'Lesson content': 'محتوى الدرس',
    'This lesson has no write-up yet.': 'لا يوجد شرح مكتوب لهذا الدرس بعد.',
    'The reading material above covers it in the meantime.':
        'مادة القراءة أعلاه تغطّيه في الوقت الحالي.',
    'On this page': 'في هذه الصفحة',
    'Lessons in this course': 'دروس هذه الدورة',
    'Discussion': 'المناقشة',
    'Ask about this lesson… Use @ to mention someone':
        'اسأل عن هذا الدرس… استخدم @ للإشارة إلى أحد',
    'No comments on this lesson yet. Be the first to ask.':
        'لا توجد تعليقات على هذا الدرس بعد. كن أول من يسأل.',
    'Copied': 'تم النسخ',
    // Latin digits, deliberately: CLDR's numbering system for the language `ar`
    // is `latn`, every digit on this platform sits beside something Latin, and
    // Arabic-Indic digits next to a Latin unit are exactly the bidi hazard
    // `formatNumber` avoids. See src/i18n/index.ts.
    '{v0} min read': 'قراءة {v0} دقيقة',
    '{v0} of {v1}': '{v0} من {v1}',
    'Take Quiz': 'ابدأ الاختبار القصير',
    'Homework ({v0})': 'الواجبات ({v0})',
    'Comments': 'التعليقات',
    'Add a Comment': 'أضف تعليقاً',
    'Delete comment': 'حذف التعليق',
    'No comments yet. Be the first to share your thoughts!': 'لا توجد تعليقات بعد. كن أول من يشارك رأيه!',
    'Please': 'يُرجى',
    'login': 'تسجيل الدخول',
    'to comment': 'للتعليق',

    /* ---------------------------------------------------------------- *
     * Homework
     * ---------------------------------------------------------------- */
    'Homework': 'الواجب',
    'Loading homework...': 'جارٍ تحميل الواجب...',
    'Unable to load homework': 'تعذّر تحميل الواجب',
    'Lesson: {v0}': 'الدرس: {v0}',
    'Assignment Content': 'محتوى التكليف',
    'Homework Materials': 'مواد الواجب',
    'Submitted': 'مُقدَّم',
    'Not Submitted': 'غير مُقدَّم',
    'Submitted {v0}': 'قُدِّم {v0}',
    'Submitted Work': 'العمل المُقدَّم',
    'Submission Notes:': 'ملاحظات التقديم:',
    'Submission URL': 'رابط التقديم',
    'Your Submission': 'تقديمك',
    'View Your Submission': 'عرض تقديمك',
    'Edit Submission': 'تعديل التقديم',
    'Description / Notes': 'الوصف / الملاحظات',
    'Provide a link to your work (GitHub repository, Google Drive, CodePen, etc.)':
        'أضف رابطاً إلى عملك (مستودع GitHub أو Google Drive أو CodePen، إلخ)',
    'Open in new tab': 'فتح في تبويب جديد',
    'Preview not available. Please use the link above to view the content.':
        'المعاينة غير متاحة. استخدم الرابط أعلاه لعرض المحتوى.',
    'This Google Docs link cannot be embedded. Please use the link below to view the document:':
        'لا يمكن تضمين رابط Google Docs هذا. استخدم الرابط أدناه لعرض المستند:',

    /* ---------------------------------------------------------------- *
     * Exams — the list
     * ---------------------------------------------------------------- */
    'View and schedule your exams': 'اعرض اختباراتك واحجز مواعيدها',
    'Loading exams...': 'جارٍ تحميل الاختبارات...',
    'Error Loading Exams': 'تعذّر تحميل الاختبارات',
    'No Exams Available': 'لا توجد اختبارات متاحة',
    'There are no exams available at the moment.': 'لا توجد اختبارات متاحة في الوقت الحالي.',
    'No Matching Exams': 'لا توجد اختبارات مطابقة',
    'No exams match your search "{v0}".': 'لا توجد اختبارات تطابق بحثك "{v0}".',
    'Search exams by title or course...': 'ابحث عن اختبار بالعنوان أو الدورة...',
    'Start Exam': 'ابدأ الاختبار',
    'Login to Schedule': 'سجّل الدخول للحجز',
    'Manage Appointment': 'إدارة الموعد',
    'Next Appointment:': 'الموعد القادم:',
    'Active Appointment Details': 'تفاصيل الموعد النشط',
    'Appointment History': 'سجل المواعيد',
    'Can Start:': 'مسموح بالبدء:',
    'Course: {v0}': 'الدورة: {v0}',
    'Date Taken:': 'تاريخ الأداء:',
    'Times Taken:': 'عدد المحاولات:',
    'Your Latest Results': 'أحدث نتائجك',
    'Your Latest Score:': 'أحدث نتيجة لك:',
    'Watch Video Instructions': 'شاهد التعليمات المصوّرة',
    'Watch the video instructions:': 'شاهد التعليمات المصوّرة:',
    'Cancel your exam appointment. The time slot will be freed for other students.':
        'ألغِ موعد اختبارك. سيُتاح الوقت لطلاب آخرين.',
    'You can reschedule your exam appointment up to 2 days before the scheduled time.':
        'يمكنك إعادة جدولة موعد اختبارك حتى يومين قبل الوقت المحدَّد.',

    /* ---------------------------------------------------------------- *
     * Taking an exam
     * ---------------------------------------------------------------- */
    'Loading exam...': 'جارٍ تحميل الاختبار...',
    'Question': 'السؤال',
    'Question {v0}': 'السؤال {v0}',
    'Time Remaining': 'الوقت المتبقي',
    'Time Left:': 'الوقت المتبقي:',
    'Time Spent:': 'الوقت المستغرق:',
    'Clear Answer': 'امسح الإجابة',
    'Flagged': 'مُعلَّم',
    'Flagged:': 'المُعلَّمة:',
    'Flagged Questions': 'الأسئلة المُعلَّمة',
    'Answered': 'مُجاب عنه',
    'Answered:': 'المُجاب عنها:',
    'Unanswered:': 'غير المُجاب عنها:',
    'Total Questions:': 'مجموع الأسئلة:',
    'Correct Answers:': 'الإجابات الصحيحة:',
    'Current': 'الحالي',
    'Summary': 'الملخّص',
    'Review Answers': 'مراجعة الإجابات',
    'Submit Exam': 'تسليم الاختبار',
    'Finish': 'إنهاء',
    'Exam Completed': 'انتهى الاختبار',
    'Appointment Status:': 'حالة الموعد:',
    'Are you sure you want to submit?': 'هل تريد التسليم بالتأكيد؟',
    'You cannot change your answers after submission.': 'لا يمكنك تغيير إجاباتك بعد التسليم.',

    /* ---------------------------------------------------------------- *
     * Quizzes. `اختبار قصير` throughout — see the header.
     * ---------------------------------------------------------------- */
    'Quiz Instructions': 'تعليمات الاختبار القصير',
    'Quiz: {v0}': 'اختبار قصير: {v0}',
    'Start Quiz': 'ابدأ الاختبار القصير',
    'Submit Quiz': 'سلّم الاختبار القصير',
    'Retake Quiz': 'أعد الاختبار القصير',
    'Return to Course': 'رجوع إلى الدورة',
    'Unable to load quiz': 'تعذّر تحميل الاختبار القصير',
    'Your Score': 'نتيجتك',
    'Score: {v0} points': 'النتيجة: {v0} نقطة',
    'Questions: {v0}': 'الأسئلة: {v0}',
    'Total Questions: {v0}': 'مجموع الأسئلة: {v0}',
    'Time Limit: {v0} minutes': 'الحد الزمني: {v0} دقيقة',
    'Time: {v0}': 'الوقت: {v0}',
    'Passing Score: 70%': 'درجة النجاح: 70%',
    'Progress: {v0}/{v1}': 'التقدّم: {v0}/{v1}',
    'Flag questions to review later': 'علّم الأسئلة لمراجعتها لاحقاً',
    'Flagged ({v0})': 'المُعلَّمة ({v0})',
    'No flagged questions': 'لا توجد أسئلة مُعلَّمة',
    'Correct Answer': 'الإجابة الصحيحة',
    'No answers available for this question.': 'لا توجد إجابات متاحة لهذا السؤال.',

    /* ---------------------------------------------------------------- *
     * Results
     * ---------------------------------------------------------------- */
    'Back to Results': 'رجوع إلى النتائج',
    'Review {v0}': 'مراجعة {v0}',
    'Correct': 'صحيح',
    'Your answer': 'إجابتك',
    'Date: {v0}': 'التاريخ: {v0}',
    'Exam Results': 'نتائج الاختبارات',
    'Loading exam results...': 'جارٍ تحميل نتائج الاختبارات...',
    'Loading quiz results...': 'جارٍ تحميل نتائج الاختبارات القصيرة...',
    'No exam results yet.': 'لا توجد نتائج اختبارات بعد.',
    'No quiz results yet.': 'لا توجد نتائج اختبارات قصيرة بعد.',
    'No data to display': 'لا توجد بيانات للعرض',
    'Line Chart': 'مخطط خطي',
    'All': 'الكل',
    'Taken: {v0}': 'أُدِّي في: {v0}',

    /* ---------------------------------------------------------------- *
     * Certificates
     *
     * `شهادة` throughout, and the certificate FACE is deliberately formal
     * — it is a document somebody prints and presents, so it reads like one
     * rather than like a screen.
     * ---------------------------------------------------------------- */
    'Certificate of {v0}': 'شهادة {v0}',
    'Certified': 'مُعتمَد',
    'This is to certify that': 'تشهد هذه الوثيقة بأن',
    'has successfully {v0}': 'قد {v0} بنجاح',
    'as part of the course': 'كجزء من دورة',
    'Certificate ID': 'معرّف الشهادة',
    'Date of issue': 'تاريخ الإصدار',
    'Valid until': 'صالحة حتى',
    'Study hours': 'ساعات الدراسة',
    'Official Certification Authority': 'جهة الاعتماد الرسمية',
    'Print': 'طباعة',
    'Share achievement': 'مشاركة الإنجاز',
    'Share your achievement': 'شارك إنجازك',
    'Copy link': 'نسخ الرابط',
    'Copy post': 'نسخ المنشور',
    'More apps': 'تطبيقات أخرى',
    'Accessing certificate data ...': 'جارٍ الوصول إلى بيانات الشهادة ...',
    'Signal interference': 'تشويش في الإشارة',
    'Re‑establish connection': 'إعادة الاتصال',
    'Return to command centre': 'رجوع إلى مركز التحكّم',

    'View all your course and exam certificates': 'اعرض جميع شهادات دوراتك واختباراتك',
    'Complete courses to earn certificates': 'أكمل الدورات للحصول على شهادات',
    'Pass exams to earn certificates': 'انجح في الاختبارات للحصول على شهادات',
    'Try adjusting your search': 'جرّب تعديل بحثك',
    'Completion Date:': 'تاريخ الإكمال:',
    'Expiry Date:': 'تاريخ الانتهاء:',
    'Hours Completed:': 'الساعات المكتملة:',
    'Taken Date:': 'تاريخ الأداء:',
    'ID: {v0}...': 'المعرّف: {v0}...',

    'Browse all course and exam certificates': 'استعرض جميع شهادات الدورات والاختبارات',
    'Search by user, course, exam...': 'ابحث بالمستخدم أو الدورة أو الاختبار...',
    'Showing {v0} of {v1} certificates': 'تُعرض {v0} من {v1} شهادة',
    'Try adjusting your search criteria': 'جرّب تعديل معايير بحثك',
    'No exam certificates have been issued yet': 'لم تُصدر أي شهادات اختبارات بعد',
    'No course certificates have been issued yet': 'لم تُصدر أي شهادات دورات بعد',
    'All Status': 'جميع الحالات',
    'Sort by Date': 'ترتيب حسب التاريخ',
    'Sort by User': 'ترتيب حسب المستخدم',
    'Grid view': 'عرض شبكي',
    'List view': 'عرض قائمة',
    'View Certificate': 'عرض الشهادة',
    'User': 'المستخدم',
    'User Avatar': 'صورة المستخدم',
    'Exam': 'الاختبار',
    'Hours': 'الساعات',
    'Hours:': 'الساعات:',
    'Completed:': 'أُكمل في:',
    'Completion Date': 'تاريخ الإكمال',
    'Expiry Date': 'تاريخ الانتهاء',
    'Taken Date': 'تاريخ الأداء',
    'Taken:': 'أُدِّي في:',

    /* ---------------------------------------------------------------- *
     * Runbooks
     * ---------------------------------------------------------------- */
    'Step-by-step guides and tutorials': 'أدلة إرشادية خطوة بخطوة',
    'Loading runbooks...': 'جارٍ تحميل أدلة العمل...',
    'Failed to load runbooks': 'تعذّر تحميل أدلة العمل',
    'No runbooks available at the moment': 'لا توجد أدلة عمل متاحة حالياً',
    'No runbooks found': 'لم تُعثر على أدلة عمل',
    'Search runbooks...': 'ابحث في أدلة العمل...',
    'Try a different search term': 'جرّب مصطلح بحث آخر',
    'View Details →': 'عرض التفاصيل →',
    'Back to Runbooks': 'رجوع إلى أدلة العمل',
    'Loading runbook...': 'جارٍ تحميل دليل العمل...',
    'Failed to load runbook': 'تعذّر تحميل دليل العمل',
    'No steps available': 'لا توجد خطوات متاحة',
    'This runbook doesn\'t have any steps yet.': 'لا يحتوي دليل العمل هذا على أي خطوات بعد.',

    /* ---------------------------------------------------------------- *
     * The labs (app 11)
     *
     * The COMMANDS are never translated — see `rtl.css`, where the same
     * decision is made in CSS: `ls -la` is `ls -la` in every language, and a
     * student who copies a translated command gets one that does not run.
     * What is translated is the prose AROUND them.
     * ---------------------------------------------------------------- */
    'Initializing lab environment...': 'جارٍ تهيئة بيئة المعمل...',
    'No Lab Access': 'لا يوجد وصول إلى المعامل',
    'Unable to Access Labs': 'تعذّر الوصول إلى المعامل',
    'Your plan doesn\'t include the virtual labs. Add the lab feature to your subscription to open the SQL, Linux and Python sandboxes.':
        'خطتك لا تتضمّن المعامل الافتراضية. أضف ميزة المعامل إلى اشتراكك لفتح بيئات SQL وLinux وPython.',
    'SQL Query Editor': 'محرّر استعلامات SQL',
    'SQL Error:': 'خطأ SQL:',
    'Python Code Editor': 'محرّر شيفرة Python',
    'Python Error:': 'خطأ Python:',
    'Linux Terminal - {v0}@lab-server': 'طرفية Linux - {v0}@lab-server',
    '🌐 Welcome to Linux Terminal Lab!': '🌐 مرحباً بك في معمل طرفية Linux!',
    '📁 Type \'help\' for available commands': '📁 اكتب \'help\' لعرض الأوامر المتاحة',
    '💡 Press ↑/↓ for command history • Tab for auto-completion':
        '💡 استخدم ↑/↓ لسجل الأوامر • وTab للإكمال التلقائي',
    'Database Tables': 'جداول قاعدة البيانات',
    'End each query with a semicolon (;)': 'أنهِ كل استعلام بفاصلة منقوطة (;)',
    'No results yet. Run a query to see results here.': 'لا توجد نتائج بعد. نفّذ استعلاماً لتظهر النتائج هنا.',
    '{v0} row(s) returned': 'أُعيد {v0} سطراً',
    'Last query: {v0}...': 'آخر استعلام: {v0}...',
    'Output': 'الناتج',
    'Run your Python code to see output here.': 'نفّذ شيفرة Python لتظهر النتائج هنا.',
    'Process running...': 'العملية قيد التنفيذ...',
    'Stop current process': 'إيقاف العملية الحالية',
    'Clear screen': 'مسح الشاشة',
    'Clear terminal': 'مسح الطرفية',
    'Copy terminal content': 'نسخ محتوى الطرفية',
    'Quick Commands (Click to insert)': 'أوامر سريعة (اضغط للإدراج)',
    'Quick Examples': 'أمثلة سريعة',
    'Quick Tips': 'نصائح سريعة',
    /* ---- The labs: the four strings that were still literals ----
     * `Run Query` on an Arabic page was the only English word on the screen, and
     * it is the page's primary action. */
    'Running...': 'جارٍ التنفيذ...',
    'Run Query': 'نفّذ الاستعلام',
    'Run Code': 'شغّل الكود',
    'Enter your SQL query here...': 'اكتب استعلام SQL هنا...',
    'Type a command and press Enter...': 'اكتب أمراً واضغط Enter...',
    'List files': 'سرد الملفات',
    'List files with details': 'سرد الملفات بالتفاصيل',
    'Current directory': 'المجلد الحالي',
    'Print working directory': 'طباعة المجلد الحالي',
    'Current user': 'المستخدم الحالي',
    'Display current user': 'إظهار المستخدم الحالي',
    'Date & time': 'التاريخ والوقت',
    'Show current date and time': 'إظهار التاريخ والوقت الحالي',
    'Create directory': 'إنشاء مجلد',
    'Create folder': 'إنشاء مجلد',
    'Create file': 'إنشاء ملف',
    'Create empty file': 'إنشاء ملف فارغ',
    'Print text': 'طباعة نص',
    'Hello World': 'مرحباً بالعالم',
    'For Loop': 'حلقة تكرار',
    'Function': 'دالة',
    'Format': 'تنسيق',
    'File I/O': 'قراءة وكتابة الملفات',
    'Use': 'استخدم',
    'Try:': 'جرّب:',
    'to see table structure': 'لعرض بنية الجدول',
    'to view all data': 'لعرض جميع البيانات',

    /* ---------------------------------------------------------------- *
     * The leaderboard (apps 20 + 24)
     *
     * A PUBLIC page — no account — so it is the one screen here a reader may
     * arrive at before anything else. Its explanatory prose is the longest on
     * the platform and is deliberately translated in full rather than
     * summarised: the whole point of those paragraphs is that the ranking
     * rules are not a mystery, and a shortened Arabic version would make them
     * one for exactly the readers least able to ask.
     * ---------------------------------------------------------------- */
    'Self Study Leaderboard': 'لوحة متصدّري Self Study',
    'Open leaderboard': 'فتح لوحة المتصدرين',
    'Every exam passed, quiz cleared and certificate earned across the platform, ranked. No account needed — this page is public.':
        'كل اختبار تم النجاح فيه، وكل اختبار قصير تم إنجازه، وكل شهادة حُصل عليها على المنصّة، مرتَّبة. لا حاجة إلى حساب — هذه الصفحة عامة.',
    'The board could not be loaded': 'تعذّر تحميل اللوحة',
    'The board is empty': 'اللوحة فارغة',
    'Nothing has been earned across the platform yet. The first exam passed, quiz cleared or certificate issued will appear here.':
        'لم يُحقَّق شيء على المنصّة بعد. سيظهر هنا أول اختبار يُنجح فيه أو اختبار قصير يُنجَز أو شهادة تُصدَر.',
    'Nothing ranked for this period': 'لا توجد نتائج مرتَّبة لهذه الفترة',
    'No exam, quiz or certificate was earned in the last {v0} days. Try a longer period.':
        'لم يُحقَّق أي اختبار أو اختبار قصير أو شهادة في آخر {v0} يوماً. جرّب فترة أطول.',
    'Showing a partial board — {v0} did not answer. A replica is probably still waking up; try Refresh in a moment.':
        'تُعرض لوحة جزئية — {v0} لم تستجب. يُحتمل أن إحدى النسخ لا تزال في طور الاستيقاظ؛ جرّب التحديث بعد قليل.',
    'Built from {v0} of 4 public collections across the exam and certificate services. Figures are recomputed in the browser each time this page is opened.':
        'مبنيّة على {v0} من 4 مجموعات عامة في خدمتي الاختبارات والشهادات. تُحسب الأرقام في المتصفح في كل مرة تُفتح فيها الصفحة.',
    'Learner': 'المتعلّم',
    'Learners ranked by points. Rank is always the points rank, whatever the table is sorted by.':
        'المتعلّمون مرتَّبون حسب النقاط. الترتيب هو دائماً ترتيب النقاط، أياً كان العمود المستخدم في الفرز.',
    'Find a learner': 'ابحث عن متعلّم',
    'No learner matches “{v0}”.': 'لا يوجد متعلّم يطابق “{v0}”.',
    'Clear the search': 'مسح البحث',
    'Filter the board': 'تصفية اللوحة',
    'Full ranking': 'الترتيب الكامل',
    'The ranking': 'الترتيب',
    'The rules behind it': 'القواعد التي يستند إليها',
    'How points work': 'كيف تُحسب النقاط',
    'Points': 'النقاط',
    'Points earned · {v0}': 'النقاط المكتسبة · {v0}',
    'Credentials': 'المؤهّلات',
    'Progress': 'التقدّم',
    'Period': 'الفترة',
    'Sort': 'الفرز',
    'Sort the board by': 'فرز اللوحة حسب',
    'Show all time': 'إظهار كل الفترات',
    'Show {v0} more': 'إظهار {v0} أخرى',
    'Showing {v0} of {v1}': 'تُعرض {v0} من {v1}',
    'Rank {v0}': 'المرتبة {v0}',
    'NEW': 'جديد',
    'Not ranked in the previous period': 'غير مرتَّب في الفترة السابقة',
    'vs previous {v0} days': 'مقارنةً بآخر {v0} يوماً',
    'Most recent': 'الأحدث',
    'Most studied': 'الأكثر دراسةً',
    'Score distribution': 'توزيع النتائج',
    'Achievements over time': 'الإنجازات على مدى الوقت',
    'Trends': 'الاتجاهات',
    'Top three learners': 'أفضل ثلاثة متعلّمين',
    'Platform totals': 'إجماليات المنصّة',
    'Pass rate': 'نسبة النجاح',
    'Average score': 'المتوسّط',
    'Avg score': 'متوسّط النتيجة',
    'avg': 'المتوسّط',
    'Exam passed': 'اختبار مُنجَح',
    'Quiz passed': 'اختبار قصير مُنجَز',
    'Exam certificate': 'شهادة اختبار',
    'Course certificate': 'شهادة دورة',
    'Distinction · best attempt {v0} or above': 'امتياز · أفضل محاولة {v0} أو أعلى',
    'no scored assessment': 'لا يوجد تقييم مُدرَّج',
    '{v0} of {v1} assessments': '{v0} من {v1} تقييماً',
    '{v0} of {v1} ranked': '{v0} من {v1} مرتَّباً',
    'across {v0} {v1}': 'في {v0} {v1}',
    'One attempt each.': 'محاولة واحدة لكل تقييم.',
    'Counted over each learner\'s best attempt at each assessment, so a retake never appears twice.':
        'تُحسب على أفضل محاولة لكل متعلّم في كل تقييم، فلا تظهر إعادة الأداء مرتين.',
    'Only your best attempt at any exam or quiz counts, so re-sitting something you have already passed does not move you up.':
        'تُحتسب أفضل محاولة لك فقط في أي اختبار أو اختبار قصير، فإعادة أداء شيء نجحت فيه سابقاً لا ترفع ترتيبك.',
    'An exam certificate is worth nothing.': 'شهادة الاختبار لا تمنح نقاطاً.',
    'It is issued automatically for a pass, and the pass already earned the points — scoring both would pay twice for one achievement. It is still counted as a credential.':
        'تُصدر تلقائياً عند النجاح، والنجاح نفسه منح النقاط بالفعل — فاحتساب الاثنين يكافئ إنجازاً واحداً مرتين. وتبقى محسوبة كمؤهّل.',
    'Failures stay on the record.': 'الرسوب يبقى في السجل.',
    'They earn nothing and they count towards the pass rate, which is the only way that figure means anything.':
        'لا يمنح نقاطاً، ويُحتسب في نسبة النجاح، وهذا وحده ما يجعل لذلك الرقم معنى.',
    'Equal points share a rank.': 'النقاط المتساوية تتشارك المرتبة.',
    'Two learners on the same total are both shown at the same number, and the next learner takes the rank after both of them.':
        'يظهر المتعلّمان اللذان لهما المجموع نفسه في المرتبة نفسها، ويأخذ التالي المرتبة التي تليهما.',
    'No identifiers are published.': 'لا تُنشر أي معرّفات.',
    'The board shows the name a learner\'s own certificates carry, their totals, and nothing else — no account id, no email, and no list of what anybody failed.':
        'تُظهر اللوحة الاسم الذي تحمله شهادات المتعلّم نفسه، ومجاميعه، ولا شيء غير ذلك — لا معرّف حساب، ولا بريد إلكتروني، ولا قائمة بما رسب فيه أحد.',

    /* ---------------------------------------------------------------- *
     * Scheduling an exam (apps 20 + 21)
     * ---------------------------------------------------------------- */
    'Select an Exam': 'اختر اختباراً',
    'Select Exam': 'اختر الاختبار',
    'Choose the exam you want to schedule': 'اختر الاختبار الذي تريد حجز موعد له',
    'Select a Proctor': 'اختر مراقباً',
    'Select Proctor': 'اختر المراقب',
    'Choose an available proctor for your exam': 'اختر مراقباً متاحاً لاختبارك',
    'Select Date': 'اختر التاريخ',
    'Select Date & Time': 'اختر التاريخ والوقت',
    'Select New Date & Time': 'اختر تاريخاً ووقتاً جديدين',
    'Choose an available time slot for your exam': 'اختر وقتاً متاحاً لاختبارك',
    'Available Time Slots': 'الأوقات المتاحة',
    'Please select a date to see available time slots': 'اختر تاريخاً لعرض الأوقات المتاحة',
    'Next: Select Proctor': 'التالي: اختيار المراقب',
    'Next: Select Date & Time': 'التالي: اختيار التاريخ والوقت',
    'Checking {v0}\'s availability…': 'جارٍ التحقّق من توفّر {v0}…',
    'refreshing…': 'جارٍ التحديث…',
    '{v0} has {v1} bookable {v2} in {v3}.': 'لدى {v0} {v1} {v2} قابلة للحجز في {v3}.',
    'No proctors are available right now.': 'لا يوجد مراقبون متاحون حالياً.',
    'Please try again later or contact an administrator.': 'حاول لاحقاً أو تواصل مع الإدارة.',
    'Date Not Available': 'التاريخ غير متاح',
    'Every slot on this date has just been taken': 'حُجزت جميع الأوقات في هذا التاريخ للتو',
    'Pick another date marked ✓ on the calendar': 'اختر تاريخاً آخر مؤشَّراً بـ ✓ في التقويم',
    'Please select another date to schedule your exam.': 'اختر تاريخاً آخر لحجز موعد اختبارك.',
    'You already have an appointment on this date.': 'لديك موعد بالفعل في هذا التاريخ.',
    'You already have an appointment on this date. Please select another date.':
        'لديك موعد بالفعل في هذا التاريخ. اختر تاريخاً آخر.',
    'Already scheduled for {v0}': 'محجوز بالفعل في {v0}',
    'Currently scheduled': 'المحجوز حالياً',
    'BOOKED': 'محجوز',
    'PASSED': 'ناجح',
    'RETRY': 'أعد المحاولة',
    'Exam already passed': 'سبق النجاح في الاختبار',
    'Previous attempt failed - You can reschedule': 'المحاولة السابقة لم تُوفَّق — يمكنك إعادة الجدولة',
    'Confirm Booking': 'تأكيد الحجز',
    'Confirm Changes': 'تأكيد التغييرات',
    'Continue to Reschedule': 'متابعة إعادة الجدولة',
    'Schedule Another': 'حجز موعد آخر',
    'Processing...': 'جارٍ المعالجة...',
    'Cancelling...': 'جارٍ الإلغاء...',
    'Go Back': 'رجوع',
    'Back to {v0}': 'رجوع إلى {v0}',
    'View My Exams': 'عرض اختباراتي',
    'Yes, Cancel Appointment': 'نعم، ألغِ الموعد',
    'Are you sure you want to cancel this exam appointment?': 'هل تريد بالتأكيد إلغاء موعد الاختبار هذا؟',
    'This action cannot be undone. The time slot will be made available for other students.':
        'لا يمكن التراجع عن هذا الإجراء. سيُتاح الوقت لطلاب آخرين.',
    'Appointment Details': 'تفاصيل الموعد',
    'Current Appointment': 'الموعد الحالي',
    'Current Appointment Details': 'تفاصيل الموعد الحالي',
    'Current Schedule': 'الجدول الحالي',
    'New Schedule': 'الجدول الجديد',
    'Old Schedule': 'الجدول السابق',
    'Review your current exam appointment': 'راجع موعد اختبارك الحالي',
    'Exam Details': 'تفاصيل الاختبار',
    'Proctor Details': 'تفاصيل المراقب',
    'Date & Time:': 'التاريخ والوقت:',
    'Time:': 'الوقت:',
    'Email:': 'البريد الإلكتروني:',
    'Note:': 'ملاحظة:',
    'Error': 'خطأ',
    'Important Instructions': 'تعليمات مهمة',
    'Important Notes': 'ملاحظات مهمة',
    'Arrive at least 10 minutes before your scheduled time': 'احضر عشر دقائق على الأقل قبل موعدك',
    'Make sure your webcam and microphone are working': 'تأكّد من عمل الكاميرا والميكروفون',
    'Ensure you have a stable internet connection': 'تأكّد من استقرار اتصالك بالإنترنت',
    'Prepare your identification document': 'جهّز وثيقة هويتك',
    'Clear your workspace of any prohibited materials': 'أخلِ مساحة عملك من أي مواد ممنوعة',
    'The "Start Exam" button will appear 30 minutes before your appointment':
        'يظهر زر «ابدأ الاختبار» قبل موعدك بثلاثين دقيقة',
    'You can reschedule up to 2 days before the exam': 'يمكنك إعادة الجدولة حتى يومين قبل الاختبار',
    'You can reschedule up to 2 days before your current appointment':
        'يمكنك إعادة الجدولة حتى يومين قبل موعدك الحالي',
    'A new appointment will be created and the old appointment will be cancelled.':
        'سيُنشأ موعد جديد ويُلغى الموعد السابق.',
    'You will create a new appointment with the selected date/time':
        'ستُنشئ موعداً جديداً بالتاريخ والوقت المختارين',
    'The old appointment will be cancelled automatically': 'سيُلغى الموعد السابق تلقائياً',
    'The old time slot will become available for other students': 'سيُتاح الوقت السابق لطلاب آخرين',
    'Your old time slot will be made available to other students': 'سيُتاح وقتك السابق لطلاب آخرين',

    /* ---------------------------------------------------------------- *
     * Exam approval — the two-room setup
     * ---------------------------------------------------------------- */
    'Review instructions and get ready for your exam': 'راجع التعليمات واستعد لاختبارك',
    'Loading exam details...': 'جارٍ تحميل تفاصيل الاختبار...',
    'No appointment chosen': 'لم يُختر موعد',
    'This page shows one exam appointment, so it needs to know which one. Open it from your exams list and it will carry the details through.':
        'تعرض هذه الصفحة موعد اختبار واحداً، لذا تحتاج إلى معرفة أيّها. افتحها من قائمة اختباراتك لتنتقل التفاصيل معها.',
    'Go to My Exams': 'الانتقال إلى اختباراتي',
    'Exam starts in:': 'يبدأ الاختبار خلال:',
    'Scheduled Time': 'الوقت المحدَّد',
    'Starting Exam': 'جارٍ بدء الاختبار',
    'Proctor': 'المراقب',
    'Your exam proctor': 'مراقب اختبارك',
    'Email on request': 'البريد الإلكتروني عند الطلب',
    'Proctor Instructions': 'تعليمات المراقب',
    'Exam Instructions': 'تعليمات الاختبار',
    'Please read the full exam instructions carefully before starting your exam.':
        'اقرأ تعليمات الاختبار كاملةً بعناية قبل البدء.',
    'Watch Full Video Instructions': 'شاهد التعليمات المصوّرة كاملةً',
    'Watch the full video instructions before starting your exam.': 'شاهد التعليمات المصوّرة كاملةً قبل بدء اختبارك.',
    'This video cannot be embedded. Please watch it in a new tab.': 'لا يمكن تضمين هذا الفيديو. شاهده في تبويب جديد.',
    'You must read the full Exam Instructions and watch the complete Video Instructions before starting your exam. Failure to follow these instructions may result in exam disqualification.':
        'يجب أن تقرأ تعليمات الاختبار كاملةً وتشاهد التعليمات المصوّرة بالكامل قبل البدء. عدم الالتزام بهذه التعليمات قد يؤدي إلى استبعادك من الاختبار.',
    'Important:': 'مهم:',
    'Exam Rooms Setup': 'إعداد قاعات الاختبار',
    'Exam rooms will be assigned by your proctor.': 'سيحدّد المراقب قاعات الاختبار.',
    'No Rooms Available': 'لا توجد قاعات متاحة',
    'Join from two rooms:': 'انضم من قاعتين:',
    'one room from your mobile (for proctor) and one room from your PC/laptop (for exam and screen sharing)':
        'قاعة من هاتفك (للمراقب) وقاعة من حاسوبك (للاختبار ومشاركة الشاشة)',
    'Mobile Room': 'قاعة الهاتف',
    'PC/Laptop Room': 'قاعة الحاسوب',
    'Join Mobile Room': 'انضم من الهاتف',
    'Join PC Room': 'انضم من الحاسوب',
    'Join from your mobile device': 'انضم من هاتفك المحمول',
    'Join from your PC or laptop': 'انضم من حاسوبك',
    'This is where you\'ll take the exam': 'هنا ستؤدّي الاختبار',
    'Keep this room open during exam': 'أبقِ هذه القاعة مفتوحة أثناء الاختبار',
    'Keep both rooms open throughout the entire exam': 'أبقِ القاعتين مفتوحتين طوال الاختبار',
    'For proctor to monitor your office environment': 'لكي يراقب المراقب بيئة مكانك',
    'For taking the exam and sharing your screen': 'لأداء الاختبار ومشاركة شاشتك',
    'Mobile camera setup:': 'إعداد كاميرا الهاتف:',
    'Open the mobile room on your mobile device, enable camera, and point it to show your entire office/room so the proctor can monitor your environment':
        'افتح قاعة الهاتف على جهازك، وشغّل الكاميرا، ووجّهها لتُظهر كامل الغرفة حتى يتمكّن المراقب من مراقبة بيئتك',
    'Point camera to show your office': 'وجّه الكاميرا لتُظهر مكانك',
    'Ensure your mobile camera shows your entire workspace': 'تأكّد من أن كاميرا هاتفك تُظهر كامل مساحة عملك',
    'Screen sharing:': 'مشاركة الشاشة:',
    'Enable screen sharing': 'شغّل مشاركة الشاشة',
    'From the PC/laptop room, enable screen sharing so the proctor can see your exam screen':
        'من قاعة الحاسوب، شغّل مشاركة الشاشة ليتمكّن المراقب من رؤية شاشة اختبارك',
    'Do not disable screen sharing on your PC during the exam': 'لا توقف مشاركة الشاشة على حاسوبك أثناء الاختبار',
    'Enable camera and microphone': 'شغّل الكاميرا والميكروفون',
    'System Requirements': 'متطلّبات النظام',
    'Webcam enabled on both devices': 'كاميرا مُشغَّلة على الجهازين',
    'Microphone enabled on both devices': 'ميكروفون مُشغَّل على الجهازين',
    'Stable internet connection on both devices': 'اتصال إنترنت مستقر على الجهازين',
    'Modern browser (Chrome, Firefox, Edge) on both devices': 'متصفّح حديث (Chrome أو Firefox أو Edge) على الجهازين',
    'Follow all instructions provided by the proctor': 'اتبع جميع تعليمات المراقب',
    'The proctor will monitor both your mobile camera feed and PC screen':
        'سيراقب المراقب بثّ كاميرا هاتفك وشاشة حاسوبك معاً',
    'The proctor may pause or terminate the exam if rules are violated':
        'يمكن للمراقب إيقاف الاختبار أو إنهاؤه في حال خُرقت القواعد',
    'The "Start Exam" button will be enabled when your proctor gives permission.':
        'يُفعَّل زر «ابدأ الاختبار» عندما يمنحك المراقب الإذن.',
    'You can start the exam up to 30 minutes before your scheduled time.':
        'يمكنك بدء الاختبار قبل موعدك بثلاثين دقيقة كحدّ أقصى.',
    'You can reschedule your exam up to 2 days before the scheduled time.':
        'يمكنك إعادة جدولة اختبارك حتى يومين قبل الوقت المحدَّد.',
    'Need to Reschedule?': 'تحتاج إلى إعادة الجدولة؟',

    /* ---------------------------------------------------------------- *
     * The proctor's screens
     * ---------------------------------------------------------------- */
    'Exam appointments': 'مواعيد الاختبارات',
    'Welcome, {v0} ({v1})': 'مرحباً، {v0} ({v1})',
    'Loading appointments...': 'جارٍ تحميل المواعيد...',
    'No Appointments Yet': 'لا توجد مواعيد بعد',
    'You don\'t have any exam appointments assigned to you.': 'لا توجد مواعيد اختبارات مُسندة إليك.',
    'Nothing matches those filters': 'لا شيء يطابق هذه المرشّحات',
    '{v0} appointment{v1} hidden by the filters above.': '{v0} موعداً مخفياً بسبب المرشّحات أعلاه.',
    'Needs attention': 'يحتاج إلى انتباه',
    'Today': 'اليوم',
    'Upcoming': 'القادمة',
    'Candidate': 'المرشَّح',
    'Appointment': 'الموعد',
    'Exam Title': 'عنوان الاختبار',
    'Booked': 'محجوز',
    'Cancelled': 'ملغى',
    'In Progress': 'قيد التنفيذ',
    'Live': 'مباشر',
    'Live:': 'مباشر:',
    'Entered the room': 'دخل القاعة',
    'No Reservation Yet': 'لا حجز بعد',
    'Filter by exam title': 'تصفية حسب عنوان الاختبار',
    'Filter by username': 'تصفية حسب اسم المستخدم',
    'From Date': 'من تاريخ',
    'To Date': 'إلى تاريخ',
    'Clear filters': 'أزل المرشّحات',
    'Clear Filters': 'أزل المرشّحات',
    'Showing:': 'المعروض:',
    'Reference ids': 'المعرّفات المرجعية',

    'Exam Appointment Details': 'تفاصيل موعد الاختبار',
    '← Back to Dashboard': '← رجوع إلى لوحة التحكم',
    'Loading appointment details...': 'جارٍ تحميل تفاصيل الموعد...',
    'Exam Control': 'التحكّم بالاختبار',
    'Let the candidate start': 'اسمح للمرشَّح بالبدء',
    'Allow Student to Start Exam': 'السماح للطالب ببدء الاختبار',
    'Revoke permission to start': 'سحب إذن البدء',
    'They can start now. Revoking is allowed and takes effect immediately.':
        'يمكنه البدء الآن. السحب مسموح ويأخذ مفعوله فوراً.',
    'They cannot start until you allow it. Set a room link first.':
        'لا يمكنه البدء حتى تسمح له. حدّد رابط القاعة أولاً.',
    'When checked, the student will be able to start the exam. Make sure rooms are set and you\'re ready to proctor.':
        'عند التحديد، سيتمكّن الطالب من بدء الاختبار. تأكّد من إعداد القاعات ومن استعدادك للمراقبة.',
    '✅ Student has entered the exam': '✅ دخل الطالب الاختبار',
    'In the room': 'في القاعة',
    'Entered: {v0}': 'دخل في: {v0}',
    'Student entered at: {v0}': 'دخل الطالب في: {v0}',
    'Status Management': 'إدارة الحالة',
    'Proctor Controls': 'أدوات المراقب',
    'Appointment Information': 'معلومات الموعد',
    'Appointment ID:': 'معرّف الموعد:',
    'Appointment Date:': 'تاريخ الموعد:',
    'Exam Time: {v0} minutes': 'مدة الاختبار: {v0} دقيقة',
    'Student Information': 'معلومات الطالب',
    'Username: {v0}': 'اسم المستخدم: {v0}',
    'User ID: {v0}': 'معرّف المستخدم: {v0}',
    'Proctor ID:': 'معرّف المراقب:',
    'ID: {v0}': 'المعرّف: {v0}',
    'Current:': 'الحالي:',
    'Not Set': 'غير محدَّد',
    'Exam Rooms': 'قاعات الاختبار',
    'Add Rooms': 'إضافة قاعات',
    'Edit Rooms': 'تعديل القاعات',
    'Save Rooms': 'حفظ القاعات',
    'Save All Changes': 'حفظ جميع التغييرات',
    'Saving...': 'جارٍ الحفظ...',
    'Saving…': 'جارٍ الحفظ…',
    'No rooms assigned yet': 'لم تُسند قاعات بعد',
    'No room URL set': 'لم يُحدَّد رابط للقاعة',
    'Room 1 URL:': 'رابط القاعة 1:',
    'Room 2 URL:': 'رابط القاعة 2:',
    'Room 1 is the main exam room': 'القاعة 1 هي قاعة الاختبار الرئيسية',
    'Room 2 is optional for backup or monitoring': 'القاعة 2 اختيارية للاحتياط أو للمراقبة',
    'Optional: Backup room or monitoring room': 'اختياري: قاعة احتياطية أو قاعة مراقبة',
    'Enter the video conference URL (Zoom, Google Meet, etc.)': 'أدخل رابط الاجتماع المرئي (Zoom أو Google Meet، إلخ)',
    'Tips for Room URLs:': 'نصائح بشأن روابط القاعات:',
    'Use a secure video conferencing service (Google Meet, Zoom, etc.)':
        'استخدم خدمة اجتماعات مرئية آمنة (Google Meet أو Zoom، إلخ)',
    'Make sure the student has access to the room': 'تأكّد من أن الطالب يستطيع الوصول إلى القاعة',
    'Test the links before saving': 'اختبر الروابط قبل الحفظ',
    'Test': 'اختبار',
    'Test Link': 'اختبار الرابط',
    'Recently': 'مؤخراً',
    'Untitled Course': 'دورة بدون عنوان',
    'No description available': 'لا يوجد وصف متاح',
    'No description available.': 'لا يوجد وصف متاح.',
    'Unenroll from "{v0}"?': 'إلغاء التسجيل من "{v0}"؟',
    'Unknown Plan': 'خطة غير معروفة',
    'Untitled Homework': 'واجب بدون عنوان',
};

export default learning;
