/**
 * The labs (app 11) — Arabic.
 *
 * ============================================================
 * WHY THIS IS ITS OWN MODULE
 * ============================================================
 *
 * Because the labs are twelve subjects' worth of vocabulary and nothing else on
 * the platform shares it. "Volumes" here is a Docker volume, not a loudness
 * control; "State" is a Terraform state file, not a country; "Nodes" is a
 * Kubernetes worker, not a network simulator device. Sorted in among the course
 * and exam strings, every one of those is a coin flip — which is the reason
 * `../../index.ts` gives for splitting by area rather than A-Z, arriving here in
 * its sharpest form.
 *
 * ============================================================
 * WHAT IS DELIBERATELY *NOT* HERE
 * ============================================================
 *
 * Commands and product names. `docker ps`, `hdfs dfs -ls`, `terraform apply`,
 * `SELECT`, `kubectl` — every one of those is a literal a real CLI accepts, and
 * a student reading the Arabic screen who types the Arabic word gets a command
 * that does not run. That is WORSE than the label having stayed in English,
 * because the interface has actively misled them. The same line runs through
 * `rtl.css`, which pins every `<pre>` left-to-right, and through
 * `tools/i18n-check/untranslated.json`, where the acronyms and service names
 * this page prints (`S3`, `EC2`, `ARN`, `VPC`, `CIDR`, `SKU`, `NameNode`,
 * `Pods`…) are allow-listed with the same reasoning.
 *
 * Where a product name sits inside a phrase the Latin word is kept and the
 * grammar around it is Arabic — `أدوار IAM`, `مخزن بيانات Hive`,
 * `استعراض HDFS`. A reader has to be able to find that word again in the real
 * console, which is in English.
 *
 * ============================================================
 * "SIMULATED" IS THE MOST IMPORTANT WORD IN THIS FILE
 * ============================================================
 *
 * Seven of the engines are simulations: there is no Docker daemon, no
 * Kubernetes API server and no AWS account behind them. Every tool that is one
 * says so on its own header and in the prompt the AI tutor is given, and a
 * reader who cannot read the English is exactly the reader most likely to spend
 * an afternoon wondering why a flag the real tool has does nothing here. So
 * `محاكاة` / `حقيقي` are translated, kept short enough to sit in a tag, and are
 * never softened.
 */

import type { Catalogue } from '../../index';

const labs: Catalogue = {
    /* ---------------------------------------------------------------- *
     * The catalogue page
     * ---------------------------------------------------------------- */
    'Playgrounds, not exercises. Every lab hands you the real tools for a subject and a list of things to make happen - and it checks the environment, not what you typed.':
        'ملاعب للتدريب، لا تمارين. كل معمل يمنحك الأدوات الحقيقية لموضوعه وقائمةً بما ينبغي تحقيقه - ثم يتحقّق من البيئة نفسها، لا من نصّ ما كتبته.',
    'Just want a scratchpad?': 'تريد مساحة تجريبية سريعة؟',
    'Search labs, topics and tools': 'ابحث في المعامل والمواضيع والأدوات',
    'All tracks': 'كل المسارات',
    'Loading the labs...': 'جارٍ تحميل المعامل...',
    'No lab matches that.': 'لا يوجد معمل يطابق ذلك.',
    'No labs are published yet.': 'لم يُنشَر أي معمل بعد.',
    'The labs are not reachable right now': 'لا يمكن الوصول إلى المعامل الآن',
    'Labs started': 'المعامل التي بدأتها',
    'Labs completed': 'المعامل المكتملة',
    'Tasks done': 'المهام المنجزة',
    '{v0} labs': '{v0} معمل',
    '{v0} tasks': '{v0} مهمة',
    '{v0} completed': '{v0} مكتمل',

    /* The subscription wording is the labs' own rather than the tools' — they
     * are gated on the same feature and reached from different places, and a
     * reader who clicked a lab must not be told about a terminal. */
    'Your plan does not include the labs. Add the lab feature to your subscription to open every track.':
        'خطتك لا تتضمّن المعامل. أضف ميزة المعامل إلى اشتراكك لفتح جميع المسارات.',

    /* ---------------------------------------------------------------- *
     * The workspace
     * ---------------------------------------------------------------- */
    'Opening the lab...': 'جارٍ فتح المعمل...',
    'This lab could not be opened': 'تعذّر فتح هذا المعمل',
    'Back to the labs': 'العودة إلى المعامل',
    /* On a course page and on a lesson page, beside the runbook and the
     * reading material. A verb, because it is the one thing in that row that
     * is doing rather than reading. */
    'Practise in the lab': 'تدرَّب في المعمل',
    /* The leaderboard's printed scoring table. The qualifier is the whole
     * point: a lab task point is not self-reported, it is a task the service
     * inspected the environment for. */
    'Lab task point · checked against the environment':
        'نقطة مهمة في معمل · يُتحقَّق منها في البيئة نفسها',
    'Lab finished · every task': 'معمل مكتمل · كل المهام',
    'Brief': 'التعريف',
    'By the end of this lab': 'بنهاية هذا المعمل',
    'Datasets in this lab': 'مجموعات البيانات في هذا المعمل',
    'Built for you on this replica. Real rows, real answers.':
        'مُولَّدة لك على هذه النسخة. صفوف حقيقية وأجوبة حقيقية.',
    'Reset environment': 'تصفير البيئة',
    'This lab has no brief yet.': 'لا يوجد تعريف لهذا المعمل بعد.',

    /* A tool the bundle does not know about. The lab service deploys on its own
     * schedule, so this is an ordinary state rather than an error — and saying
     * WHICH tool is what turns "the lab looks wrong" into a deploy note. */
    'This lab asks for a tool this version does not have: {v0}. It has been left out.':
        'يطلب هذا المعمل أداةً غير متوفّرة في هذه النسخة: {v0}. وقد استُثنيت.',

    /* ---------------------------------------------------------------- *
     * The panes
     * ---------------------------------------------------------------- */
    'Console': 'الطرفية',
    'Files': 'الملفات',
    'Result': 'النتيجة',
    'Run': 'تشغيل',
    'Truncated': 'مُقتطَع',
    'Nothing yet.': 'لا شيء بعد.',
    'No files yet': 'لا ملفات بعد',
    'Path': 'المسار',
    'Permissions': 'الصلاحيات',
    'file name, e.g. Dockerfile': 'اسم الملف، مثل Dockerfile',
    'Write a program and press Run, or Ctrl+Enter': 'اكتب برنامجاً واضغط تشغيل، أو Ctrl+Enter',
    'Write a statement and press Run, or Ctrl+Enter': 'اكتب عبارة واضغط تشغيل، أو Ctrl+Enter',
    'The statement ran and returned no rows.': 'نُفِّذت العبارة ولم تُرجِع أي صفوف.',
    '{v0} row(s)': '{v0} صف',
    'These files are what every tool in this lab sees. Write a Dockerfile, a manifest or a .tf file here and run it in the console.':
        'هذه الملفات هي ما تراه كل أداة في هذا المعمل. اكتب هنا ملف Dockerfile أو ملف تعريف أو ملف .tf ثم شغّله في الطرفية.',

    /* The web playground. The second sentence is a promise about WHERE the code
     * runs, and it is the one thing a reader needs before pasting anything in. */
    'Web Playground': 'ملعب الويب',
    'Your own browser renders this in a sandboxed frame. Nothing runs on the server.':
        'متصفّحك هو الذي يعرض هذا داخل إطار معزول. لا شيء يُنفَّذ على الخادم.',
    'console.log output appears here.': 'تظهر هنا مخرجات console.log.',

    /* ---------------------------------------------------------------- *
     * The task list
     * ---------------------------------------------------------------- */
    'This lab has no tasks yet.': 'لا توجد مهام في هذا المعمل بعد.',
    'Checking...': 'جارٍ التحقّق...',
    'I have done this': 'أنجزتُ هذه',
    'Hint': 'تلميح',
    'Hide hint': 'إخفاء التلميح',
    'Show what each task checks': 'اعرض ما تتحقّق منه كل مهمة',
    'Checked by': 'يُتحقَّق منها بـ',
    '{v0} of {v1} done': 'أُنجزت {v0} من {v1}',
    '{v0} of {v1} points': '{v0} من {v1} نقطة',

    /* The third task state. A task the lab cannot check is not a failure and
     * must not read as one — it is a lab whose declaration names an environment
     * this deployment does not provide, which is an operator's problem and not
     * the student's. */
    'This lab cannot check that here. Tell an operator - the task names an environment the lab does not provide.':
        'لا يستطيع هذا المعمل التحقّق من ذلك هنا. أبلِغ المشغّل - فالمهمة تسمّي بيئةً لا يوفّرها المعمل.',

    /* ---------------------------------------------------------------- *
     * The tutor
     * ---------------------------------------------------------------- */
    'AI Tutor': 'المدرّب الذكي',
    'Ask': 'اسأل',
    'Ask the tutor': 'اسأل المدرّب',
    'Ask a question about this lab': 'اطرح سؤالاً عن هذا المعمل',
    'Ask about this lab. Try: why does the container name not resolve?':
        'اسأل عن هذا المعمل. جرّب: لماذا لا يُترجَم اسم الحاوية إلى عنوان؟',
    'Review my work': 'راجع عملي',
    'Thinking...': 'جارٍ التفكير...',
    'It can see your environment and what you have run. Answers come from a language model and can be wrong.':
        'يرى بيئتك وما نفّذته فيها. الأجوبة تأتي من نموذج لغوي وقد تكون خاطئة.',

    /* ---------------------------------------------------------------- *
     * Honesty about what is behind each tool
     * ---------------------------------------------------------------- */
    'Simulated': 'محاكاة',
    'Real': 'حقيقي',
    'Reads the live environment': 'يقرأ البيئة الحيّة',
    'This lab has no dashboard for that tool.': 'لا توجد لوحة لهذه الأداة في هذا المعمل.',

    /* ---------------------------------------------------------------- *
     * The top bar and the scratchpad tools
     * ---------------------------------------------------------------- */
    'Practice tools': 'أدوات التدريب',
    'A terminal, a SQL editor and a Python compiler': 'طرفية ومحرّر SQL ومصرّف Python',
    'Playgrounds for Linux, Python, web, SQL, Docker, Kubernetes, Big Data, cloud and Terraform':
        'ملاعب لـ Linux وPython والويب وSQL وDocker وKubernetes والبيانات الضخمة والسحابة وTerraform',
    'Full page': 'صفحة كاملة',
    'Resize': 'تغيير الحجم',
    'Sign in to use the practice tools.': 'سجّل الدخول لاستخدام أدوات التدريب.',
    'Your plan does not include the practice tools.': 'خطتك لا تتضمّن أدوات التدريب.',
    'Starting your workspace...': 'جارٍ تشغيل مساحة عملك...',
    'These tools are not reachable right now': 'لا يمكن الوصول إلى هذه الأدوات الآن',

    /* ---------------------------------------------------------------- *
     * Difficulty, lab status and task status
     *
     * Reached as `$t(DIFFICULTY_LABELS[lab.difficulty])` from a variable, so no
     * source file holds the literal and `check:i18n`'s orphan scan cannot see
     * them. They are verified positively against the exported table instead —
     * the same arrangement the sidebar's labels and the dashboard's badges have.
     * ---------------------------------------------------------------- */
    'Beginner': 'مبتدئ',
    'Intermediate': 'متوسّط',
    'Advanced': 'متقدّم',
    'Not started': 'لم يبدأ',
    'In progress': 'قيد التنفيذ',
    'To do': 'للتنفيذ',
    'Cannot be checked': 'لا يمكن التحقّق',

    /* ---------------------------------------------------------------- *
     * The tool families, as they appear on a pane tab
     * ---------------------------------------------------------------- */
    'Terminal & Files': 'الطرفية والملفات',
    'Web': 'الويب',
    'Big Data': 'البيانات الضخمة',

    /* ---------------------------------------------------------------- *
     * The GUI dashboards: panel titles
     * ---------------------------------------------------------------- */
    'Engine': 'المحرّك',
    'Containers': 'الحاويات',
    'Images': 'الصور',
    'Volumes': 'الوحدات التخزينية',
    'Networks': 'الشبكات',
    'Cluster': 'العنقود',
    'Nodes': 'العُقد',
    'Deployments': 'النشرات',
    'Services': 'الخدمات',
    'Events': 'الأحداث',
    'Browse HDFS': 'استعراض HDFS',
    'Applications': 'التطبيقات',
    'Jobs': 'المهام',
    'Hive metastore': 'مخزن بيانات Hive',
    'Alerts': 'التنبيهات',
    'VPCs & subnets': 'شبكات VPC والشبكات الفرعية',
    'Security groups': 'مجموعات الأمان',
    'IAM roles': 'أدوار IAM',
    'Subscription': 'الاشتراك',
    'Resource groups': 'مجموعات الموارد',
    'Resources': 'الموارد',
    'Storage': 'التخزين',
    'Blobs': 'الكائنات',
    'State': 'الحالة',
    'Managed resources': 'الموارد المُدارة',
    'Last plan': 'آخر خطة',
    'Dependencies': 'التبعيات',
    'Outputs': 'المخارج',
    'Branches': 'الفروع',
    'History': 'السجل',

    /* ---------------------------------------------------------------- *
     * The GUI dashboards: column headers
     * ---------------------------------------------------------------- */
    'Image': 'الصورة',
    'Ports': 'المنافذ',
    'Uptime': 'مدة التشغيل',
    'Tag': 'الوسم',
    'Layers': 'الطبقات',
    'Driver': 'المُشغِّل',
    'Used by': 'تستخدمها',
    'Subnet': 'الشبكة الفرعية',
    'Subnets': 'الشبكات الفرعية',
    'Version': 'الإصدار',
    'Namespace': 'مساحة الأسماء',
    'Ready': 'جاهزة',
    'Wanted': 'المطلوب',
    'Revision': 'المراجعة',
    'Node': 'العقدة',
    'Reason': 'السبب',
    'Keys': 'المفاتيح',
    'Capacity': 'السعة',
    'Used': 'المستخدَم',
    'Blocks': 'الكتل',
    'Replication': 'النسخ المتماثل',
    'Application': 'التطبيق',
    'Database': 'قاعدة البيانات',
    'Table': 'الجدول',
    'Rows': 'الصفوف',
    'External': 'خارجي',
    'Service': 'الخدمة',
    'Health': 'الحالة الصحية',
    'Metric': 'المقياس',
    'Components': 'المكوّنات',
    'Bucket': 'السلة',
    'Region': 'المنطقة',
    'Objects': 'الكائنات',
    'Versioning': 'تعدّد الإصدارات',
    'Instance': 'المثيل',
    'Zone': 'النطاق',
    'Default': 'افتراضي',
    'Policies': 'السياسات',
    'Runtime': 'بيئة التشغيل',
    'Handler': 'المعالج',
    'Invocations': 'مرات الاستدعاء',
    'Items': 'العناصر',
    'Billing': 'الفوترة',
    'Id': 'المعرّف',
    'Detail': 'التفصيل',
    'Endpoint': 'نقطة الوصول',
    'Container': 'الحاوية',
    'Blob': 'الكائن',
    'Tier': 'الطبقة',
    'Provider': 'المزوّد',
    'Resource': 'المورد',
    'Depends on': 'يعتمد على',
    'Branch': 'الفرع',
    'Commit': 'الإيداع',
    'Message': 'الرسالة',

    /* A Spark stage line reads "3 tasks, shuffle 150.0KB". Two words, and both
     * of them are the sentence. */
    'tasks': 'مهام',
    'shuffle': 'خلط',
};

export default labs;
