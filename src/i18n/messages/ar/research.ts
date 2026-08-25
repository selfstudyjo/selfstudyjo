/**
 * Research Flow — Arabic.
 *
 * Thirteen views, the largest single application on the platform after the
 * Network Simulator, and the one whose vocabulary is the most exacting: this is
 * academic register, not interface register. A student writing a thesis in
 * Arabic is writing it against Arabic academic conventions, and the words for
 * them are settled — `الإطار النظري` for a theoretical framework,
 * `أسئلة البحث` for research questions, `الفجوة البحثية` for a research gap.
 * Approximating those reads to a supervisor as somebody who has not read a
 * thesis.
 *
 * Two things are deliberately NOT translated:
 *
 *  - **A citation style's name.** `APA`, `IEEE`, `Harvard` are the names of the
 *    styles, and a student told to submit in APA needs to see `APA`.
 *  - **The example values in the search fields.** `Okayama University`,
 *    `Funabiki`, `10.1234/example` are examples of the SHAPE of an answer to a
 *    field that queries OpenAlex and Google Scholar — both of which index in
 *    English. An Arabic example there is an instruction to type something that
 *    returns nothing. Contrast the CV Builder, where the examples ARE localised,
 *    because that field holds the reader's own name.
 */

import type { Catalogue } from '../../index';

const research: Catalogue = {
    /* ---------------------------------------------------------------- *
     * The hub
     * ---------------------------------------------------------------- */
    'Loading Research Flow...': 'جارٍ تحميل مسار البحث...',
    'Manage your research projects, collaborate with peers, and explore academic papers':
        'أدر مشاريعك البحثية، وتعاون مع زملائك، واستكشف الأوراق الأكاديمية',
    'Quick Stats': 'إحصاءات سريعة',
    'Research Files': 'ملفات البحث',
    'Total Views': 'إجمالي المشاهدات',
    'Downloads': 'التنزيلات',
    'Collaborations': 'التعاونات',

    /* ---------------------------------------------------------------- *
     * Projects
     * ---------------------------------------------------------------- */
    'New Project': 'مشروع جديد',
    'Create New Project': 'إنشاء مشروع جديد',
    'Loading projects...': 'جارٍ تحميل المشاريع...',
    'Search my projects...': 'ابحث في مشاريعي...',
    'No projects found. Create your first project!': 'لم تُعثر على مشاريع. أنشئ مشروعك الأول!',
    'Searching projects...': 'جارٍ البحث في المشاريع...',
    'No projects found matching your criteria.': 'لا توجد مشاريع تطابق معاييرك.',
    'Search by title, description, keywords, owner...': 'ابحث بالعنوان أو الوصف أو الكلمات المفتاحية أو المالك...',
    'Page {v0} of {v1} ({v2} results)': 'صفحة {v0} من {v1} ({v2} نتيجة)',
    'All Access': 'جميع مستويات الوصول',
    'Files:': 'الملفات:',
    'Basic Information': 'المعلومات الأساسية',
    'Title *': 'العنوان *',
    'Project title': 'عنوان المشروع',
    'Description *': 'الوصف *',
    'DOI (Optional)': 'المعرّف الرقمي DOI (اختياري)',
    'Upload File (Optional)': 'رفع ملف (اختياري)',
    'Access Control *': 'التحكّم بالوصول *',
    'Access Level': 'مستوى الوصول',
    'Private - Only you': 'خاص — أنت فقط',
    'Team - Only team members': 'الفريق — أعضاء الفريق فقط',
    'Public - Anyone can view': 'عام — يمكن للجميع العرض',
    'AI, Machine Learning, Deep Learning': 'الذكاء الاصطناعي، تعلّم الآلة، التعلّم العميق',

    'Project Details': 'تفاصيل المشروع',
    'Loading project...': 'جارٍ تحميل المشروع...',
    'Project not found or you don\'t have access.': 'المشروع غير موجود أو لا تملك حق الوصول إليه.',
    'Back to Research Flow': 'رجوع إلى مسار البحث',
    'Edit Project': 'تعديل المشروع',
    'Research Files ({v0})': 'ملفات البحث ({v0})',
    'No files uploaded yet.': 'لم تُرفع أي ملفات بعد.',
    'Upload New File': 'رفع ملف جديد',
    'Version (e.g., v1.0)': 'الإصدار (مثال: v1.0)',
    'Download': 'تنزيل',
    'Team Members ({v0})': 'أعضاء الفريق ({v0})',
    'No team members.': 'لا يوجد أعضاء فريق.',
    'Can Edit': 'يمكنه التعديل',
    'Editor': 'محرِّر',
    'Viewer': 'مُطالِع',
    'Request Collaboration': 'طلب تعاون',
    'Send a request to the project owner to join as a collaborator.':
        'أرسل طلباً إلى مالك المشروع للانضمام كمتعاون.',
    'Comments ({v0})': 'التعليقات ({v0})',
    'No comments yet. Be the first to comment!': 'لا توجد تعليقات بعد. كن أول من يعلّق!',
    'Views:': 'المشاهدات:',
    'Downloads:': 'التنزيلات:',
    'Citations:': 'الاستشهادات:',
    'Venue': 'المجلة / المكان',
    'Venue:': 'المجلة / المكان:',
    'Year:': 'السنة:',

    /* ---------------------------------------------------------------- *
     * Collaboration
     * ---------------------------------------------------------------- */
    'Send Collaboration Request': 'إرسال طلب تعاون',
    'Select a project...': 'اختر مشروعاً...',
    'Search requests...': 'ابحث في الطلبات...',
    'My Requests ({v0})': 'طلباتي ({v0})',
    'Received ({v0})': 'المستلمة ({v0})',
    'Pending ({v0})': 'قيد الانتظار ({v0})',
    'Approved ({v0})': 'المقبولة ({v0})',
    'Rejected ({v0})': 'المرفوضة ({v0})',
    'No requests in this category.': 'لا توجد طلبات في هذه الفئة.',
    'Approve': 'قبول',
    'Reject': 'رفض',
    'From: {v0}': 'من: {v0}',
    'To: {v0}': 'إلى: {v0}',

    /* ---------------------------------------------------------------- *
     * Researchers
     * ---------------------------------------------------------------- */
    'Loading researchers...': 'جارٍ تحميل الباحثين...',
    'No researchers found.': 'لم يُعثر على باحثين.',
    'Search researchers...': 'ابحث في الباحثين...',
    'Researcher Profile': 'ملف الباحث',
    'Researcher profile not found.': 'لم يُعثر على ملف الباحث.',
    'Research Interests': 'الاهتمامات البحثية',
    'Projects ({v0})': 'المشاريع ({v0})',
    'No projects yet.': 'لا توجد مشاريع بعد.',
    'Joined': 'انضم في',
    '{v0} Your Researcher Profile': '{v0} ملفك كباحث',
    'First name': 'الاسم الأول',
    'Last name': 'اسم العائلة',
    'University *': 'الجامعة *',
    'Research Interests (comma separated)': 'الاهتمامات البحثية (مفصولة بفواصل)',
    'ORCID ID': 'معرّف ORCID',
    'Google Scholar ID': 'معرّف Google Scholar',
    'Google Scholar profile ID': 'معرّف ملف Google Scholar',
    'Research institution...': 'المؤسسة البحثية...',

    /* ---------------------------------------------------------------- *
     * The library
     * ---------------------------------------------------------------- */
    'My Research Library': 'مكتبتي البحثية',
    'Loading library...': 'جارٍ تحميل المكتبة...',
    'OpenAlex Library ({v0})': 'مكتبة OpenAlex ({v0})',
    'Local Projects ({v0})': 'المشاريع المحلية ({v0})',
    'No papers in your OpenAlex library yet.': 'لا توجد أوراق في مكتبة OpenAlex الخاصة بك بعد.',
    'No saved local projects yet.': 'لا توجد مشاريع محلية محفوظة بعد.',
    'Open Access': 'وصول مفتوح',
    'View Paper': 'عرض الورقة البحثية',
    'DOI: {v0}': 'المعرّف الرقمي: {v0}',

    /* ---------------------------------------------------------------- *
     * Searching OpenAlex
     * ---------------------------------------------------------------- */
    'Search Academic Papers': 'البحث في الأوراق الأكاديمية',
    'Enter your research keywords, e.g. hand gesture rehabilitation exergame':
        'أدخل كلماتك المفتاحية البحثية، مثال: hand gesture rehabilitation exergame',
    'Keywords are the only required field. Every filter below is optional — add them only when you want to narrow the results.':
        'الكلمات المفتاحية هي الحقل الإلزامي الوحيد. وكل مرشّح أدناه اختياري — أضفه فقط عندما تريد تضييق النتائج.',
    'Keywords are the only required field.': 'الكلمات المفتاحية هي الحقل الإلزامي الوحيد.',
    'Searching OpenAlex…': 'جارٍ البحث في OpenAlex…',
    'No papers matched this search.': 'لا توجد أوراق تطابق هذا البحث.',
    'Try removing a filter, widening the year range, or searching the full text instead of just the title and abstract.':
        'جرّب إزالة مرشّح، أو توسيع نطاق السنوات، أو البحث في النص الكامل بدلاً من العنوان والملخّص فقط.',
    'Filters:': 'المرشّحات:',
    'Clear all filters': 'مسح جميع المرشّحات',
    'Search in': 'ابحث في',
    'Title only': 'العنوان فقط',
    'Title and abstract': 'العنوان والملخّص',
    'Full text': 'النص الكامل',
    'Publication year': 'سنة النشر',
    'Minimum citations': 'أقل عدد استشهادات',
    'Open access only': 'الوصول المفتوح فقط',
    'PDF linked only': 'ما له ملف PDF فقط',
    'Has a DOI': 'له معرّف رقمي DOI',
    'Retracted': 'مسحوبة',
    'Institutions:': 'المؤسسات:',
    'Type a university name': 'اكتب اسم جامعة',
    'Type an author name': 'اكتب اسم مؤلف',
    'Type a topic keyword, e.g. computer vision': 'اكتب كلمة مفتاحية للموضوع، مثال: computer vision',
    'Sort by': 'ترتيب حسب',
    'Relevance': 'الصلة',
    'Most cited': 'الأكثر استشهاداً',
    'Results per page': 'النتائج في الصفحة',
    'Showing {v0}–{v1} · page {v2} of {v3}': 'تُعرض {v0}–{v1} · صفحة {v2} من {v3}',
    'Last »': 'الأخيرة »',
    '{v0} paper{v1} found': 'وُجدت {v0} ورقة',
    'Open PDF source {v0}': 'فتح مصدر PDF {v0}',
    'OpenAlex allows paging through the first 10,000 results only. Narrow the search with filters to reach the rest.':
        'يسمح OpenAlex بالتنقّل في أول 10,000 نتيجة فقط. ضيّق البحث بالمرشّحات للوصول إلى الباقي.',
    'Search failed.': 'فشل البحث.',
    'Author name': 'اسم المؤلف',

    /* ---------------------------------------------------------------- *
     * Google Scholar
     *
     * The long explanation is translated in full: it is the page telling the
     * reader that Scholar has no API and that half of what they are looking at
     * is an AI SUGGESTION rather than a search result. A student who cannot read
     * that paragraph is a student who cites an unverified suggestion.
     * ---------------------------------------------------------------- */
    'Google Scholar Search': 'البحث في Google Scholar',
    'How this works.': 'كيف يعمل هذا.',
    'Google Scholar has no public API, so this page does two things instead. It builds the exact Scholar query a professional searcher would run — open it to see the real Scholar results — and it uses AI to suggest the literature that search should surface. Every suggestion is then checked against OpenAlex. Items marked':
        'لا يوفّر Google Scholar واجهة برمجية عامة، لذا تقوم هذه الصفحة بأمرين بدلاً من ذلك. تبني استعلام Scholar نفسه الذي سيستخدمه باحث محترف — افتحه لترى نتائج Scholar الحقيقية — وتستخدم الذكاء الاصطناعي لاقتراح المراجع التي ينبغي أن يُظهرها ذلك البحث. ثم يُتحقَّق من كل اقتراح في مقابل OpenAlex. والعناصر المؤشَّرة بـ',
    'have confirmed bibliographic data; items marked': 'لها بيانات ببليوغرافية مؤكَّدة؛ أما العناصر المؤشَّرة بـ',
    'are search leads to confirm yourself before citing.': 'فهي مؤشّرات بحث عليك التأكّد منها بنفسك قبل الاستشهاد بها.',
    'Enter your research topic, e.g. python games development for education':
        'أدخل موضوع بحثك، مثال: python games development for education',
    'Find on Scholar': 'ابحث في Scholar',
    'Open on Google Scholar': 'افتح في Google Scholar',
    'Open search': 'فتح البحث',
    'Search strategy': 'استراتيجية البحث',
    'Alternative searches': 'بحوث بديلة',
    'Building the search and checking results against OpenAlex…':
        'جارٍ بناء البحث والتحقّق من النتائج في مقابل OpenAlex…',
    'This takes longer than a normal search because every suggestion is verified.':
        'يستغرق هذا وقتاً أطول من البحث العادي لأن كل اقتراح يُتحقَّق منه.',
    'Verify results against OpenAlex (recommended)': 'التحقّق من النتائج في مقابل OpenAlex (مُستحسَن)',
    'Verified in OpenAlex': 'مُتحقَّق منه في OpenAlex',
    'Unverified': 'غير مُتحقَّق منه',
    'Unverified suggestion': 'اقتراح غير مُتحقَّق منه',
    'Why it matters:': 'لماذا يهمّ ذلك:',
    '{v0} suggested papers': '{v0} ورقة مقترحة',
    '{v0} verified': '{v0} مُتحقَّق منها',
    '{v0} unverified': '{v0} غير مُتحقَّق منها',
    '· AI confidence: {v0}': '· ثقة الذكاء الاصطناعي: {v0}',
    '· {v0}% title match': '· تطابق العنوان {v0}%',
    'Exclude work about': 'استثنِ الأعمال المتعلّقة بـ',
    'Review articles only': 'مقالات المراجعة فقط',
    'From year': 'من سنة',
    'To year': 'إلى سنة',
    'Journal article': 'مقال في مجلة',
    'Conference paper': 'ورقة مؤتمر',
    'Book chapter': 'فصل من كتاب',
    'Thesis': 'رسالة علمية',
    'Scholar interface language': 'لغة واجهة Scholar',

    /* ---------------------------------------------------------------- *
     * The AI writer — starting one
     * ---------------------------------------------------------------- */
    'Start a New Research': 'ابدأ بحثاً جديداً',
    'My AI Researches ({v0})': 'بحوثي بالذكاء الاصطناعي ({v0})',
    'Loading your researches…': 'جارٍ تحميل بحوثك…',
    'You have not started an AI research yet.': 'لم تبدأ بحثاً بالذكاء الاصطناعي بعد.',
    'The writer builds a full thesis structure for you — plan, chapters, references — and exports it as a Word document or a PDF.':
        'يبني الكاتب هيكل رسالة كاملاً لك — خطة وفصولاً ومراجع — ويصدّره كمستند Word أو ملف PDF.',
    'Research topic': 'موضوع البحث',
    'Research type': 'نوع البحث',
    'Working title': 'العنوان المبدئي',
    'Leave blank to let the AI write the title': 'اتركه فارغاً ليكتب الذكاء الاصطناعي العنوان',
    '(optional — AI will propose one)': '(اختياري — سيقترح الذكاء الاصطناعي واحداً)',
    'Citation style': 'نمط الاستشهاد',
    'Writing language': 'لغة الكتابة',
    'Target word count': 'عدد الكلمات المستهدف',
    'Anything else the AI should know': 'أي شيء آخر ينبغي أن يعرفه الذكاء الاصطناعي',
    'Your name': 'اسمك',
    'Appears on the title page': 'يظهر في صفحة العنوان',
    'Use my saved research library as the source list ({v0} papers)':
        'استخدم مكتبتي البحثية المحفوظة كقائمة مصادر ({v0} ورقة)',
    'Draft research questions': 'صياغة أسئلة البحث',
    'Suggested references': 'المراجع المقترحة',
    'Sections generated': 'الأقسام المُنشأة',
    'Compare Research Types': 'مقارنة أنواع البحث',
    'Research Type Comparison': 'مقارنة أنواع البحث',
    'Document structure — {v0}': 'بنية المستند — {v0}',
    'Feature': 'الميزة',
    'Chapters:': 'الفصول:',
    'Length:': 'الطول:',
    'Theory:': 'النظرية:',
    'Originality:': 'الأصالة:',
    'The AI is writing the problem statement, research gap, questions, methodology and chapter outline. This usually takes 20–60 seconds.':
        'يكتب الذكاء الاصطناعي بيان المشكلة والفجوة البحثية والأسئلة والمنهجية ومخطّط الفصول. يستغرق هذا عادةً من 20 إلى 60 ثانية.',
    'No AI provider is configured on this server, so plans and chapters cannot be generated. Ask an administrator to set':
        'لا يوجد مزوّد ذكاء اصطناعي مُهيّأ على هذا الخادم، فلا يمكن إنشاء الخطط ولا الفصول. اطلب من الإدارة ضبط',
    '{v0} sections · ~{v1} words': '{v0} قسماً · ~{v1} كلمة',
    'or': 'أو',

    /* ---------------------------------------------------------------- *
     * The AI writer — the document
     *
     * Academic register throughout. See the header: these terms are settled in
     * Arabic and approximating them reads to a supervisor as somebody who has
     * not read a thesis.
     * ---------------------------------------------------------------- */
    'Loading research…': 'جارٍ تحميل البحث…',
    'Research Plan': 'خطة البحث',
    'Generate the research plan': 'أنشئ خطة البحث',
    'No plan has been generated yet.': 'لم تُنشأ أي خطة بعد.',
    'Problem statement': 'بيان المشكلة',
    'Research gap': 'الفجوة البحثية',
    'Research questions': 'أسئلة البحث',
    'Hypotheses': 'الفرضيات',
    'Aims': 'الأهداف العامة',
    'Objectives': 'الأهداف الإجرائية',
    'Significance': 'أهمية الدراسة',
    'Scope and delimitations': 'النطاق والحدود',
    'Methodology': 'المنهجية',
    'Theoretical framework': 'الإطار النظري',
    'Thesis statement': 'الأطروحة',
    'Risks and mitigations': 'المخاطر وسبل معالجتها',
    'Next steps': 'الخطوات التالية',
    'Recommended search terms': 'مصطلحات البحث المقترحة',
    'Chapter outline': 'مخطّط الفصول',
    'Chapter {v0}: {v1}': 'الفصل {v0}: {v1}',
    'Document Sections': 'أقسام المستند',
    'Document ({v0}/{v1})': 'المستند ({v0}/{v1})',
    'Generate section': 'أنشئ القسم',
    'Not written yet. Press': 'لم يُكتب بعد. اضغط',
    'to review it first.': 'لمراجعته أولاً.',
    'Writing section {v0} of {v1} —': 'جارٍ كتابة القسم {v0} من {v1} —',
    '. Each section is a separate request, so you can leave this page and come back; finished sections are saved as they complete.':
        '. كل قسم طلب منفصل، فيمكنك مغادرة هذه الصفحة والعودة إليها؛ وتُحفظ الأقسام المكتملة أولاً بأول.',
    'Sections are written one at a time so long documents do not time out. Generate them in order — each section is given the earlier ones as context so the argument stays consistent.':
        'تُكتب الأقسام واحداً تلو الآخر حتى لا تنتهي مهلة المستندات الطويلة. أنشئها بالترتيب — فكل قسم يُمنَح الأقسام السابقة كسياق ليبقى الطرح متّسقاً.',
    'Title Page': 'صفحة العنوان',
    'Title Page Details': 'تفاصيل صفحة العنوان',
    'These fields appear on the title page of the exported document.':
        'تظهر هذه الحقول في صفحة عنوان المستند المُصدَّر.',
    'Sources': 'المصادر',
    'Sources ({v0})': 'المصادر ({v0})',
    'sources': 'مصادر',
    'Sources the AI may cite': 'المصادر التي يجوز للذكاء الاصطناعي الاستشهاد بها',
    'No sources attached.': 'لا توجد مصادر مرفقة.',
    'No sources attached, so the document will export without a reference list.':
        'لا توجد مصادر مرفقة، لذا سيُصدَّر المستند بلا قائمة مراجع.',
    'The writer cites only these sources. If the list is empty it writes from general disciplinary knowledge and will not invent citations — but the document will be far stronger with real literature attached.':
        'يستشهد الكاتب بهذه المصادر فقط. وإن كانت القائمة فارغة فسيكتب من المعرفة العامة في التخصّص ولن يختلق استشهادات — لكن المستند سيكون أقوى بكثير بإرفاق مراجع حقيقية.',
    'Attach papers on the': 'أرفق الأوراق من تبويب',
    'tab — the writer then cites them in the text and builds the bibliography in {v0} automatically.':
        ' — ثم يستشهد بها الكاتب في النص ويبني قائمة المراجع بنمط {v0} تلقائياً.',
    'Find papers on OpenAlex': 'ابحث عن أوراق في OpenAlex',
    'Search Google Scholar': 'ابحث في Google Scholar',
    'Search these on OpenAlex': 'ابحث عن هذه في OpenAlex',
    'Search these on Google Scholar': 'ابحث عن هذه في Google Scholar',
    'References ({v0})': 'المراجع ({v0})',
    'references': 'مراجع',
    'Build reference list': 'ابنِ قائمة المراجع',
    'No reference list yet.': 'لا توجد قائمة مراجع بعد.',
    '{v0} source{v1} attached. The reference list is built automatically when you export, or press':
        'أُرفق {v0} مصدراً. تُبنى قائمة المراجع تلقائياً عند التصدير، أو اضغط',
    'above.': 'أعلاه.',
    'Formatted in {v0} with a hanging indent. Journal titles are italicised and each DOI or URL becomes a clickable link in the exported DOCX and PDF. Only metadata held for the source is used — no page range or DOI is guessed.':
        'مُنسَّقة بنمط {v0} بمسافة بادئة معلّقة. تُكتب أسماء المجلات بخط مائل، ويصبح كل معرّف DOI أو رابط قابلاً للنقر في ملفي DOCX وPDF المُصدَّرين. ولا يُستخدم إلا ما هو محفوظ فعلاً من بيانات المصدر — فلا يُخمَّن نطاق صفحات ولا معرّف DOI.',
    'All researches': 'جميع البحوث',
    'pages': 'صفحات',
    'words': 'كلمات',
    '· {v0} citations': '· {v0} استشهاداً',
};

export default research;
