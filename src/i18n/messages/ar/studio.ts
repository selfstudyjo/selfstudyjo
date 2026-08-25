/**
 * The Roblox studio, the Network Simulator's project and lesson pages, the CV
 * photo studio and the last odds and ends — Arabic.
 *
 * ============================================================
 * A PROPERTY NAME IN SOMEBODY ELSE'S EDITOR IS NOT PROSE
 * ============================================================
 *
 * `Anchored`, `CanCollide`, `Transparency`, `Material`, `Color` are the names
 * Roblox Studio itself puts in its properties panel. A student is meant to find
 * that row in Studio and change it, and Studio is in English — so translating
 * the label here sends them looking for a row that does not exist. Same rule as
 * the simulator's CLI keywords and the labs' shell commands: they are on
 * `tools/i18n-check/untranslated.json` with the reason recorded.
 *
 * What is translated is every instruction around them, and on this feature that
 * is most of the value: the import steps, the export formats, the "paste this
 * into ServerScriptService" walkthrough. A student who cannot read those cannot
 * use the tool at all, whatever the property rows say.
 *
 * The CV photo studio's guidance is translated in full for a different reason:
 * it is the only place on the platform that tells somebody their face will never
 * be removed no matter what the sliders do, and that is a promise worth being
 * able to read.
 */

import type { Catalogue } from '../../index';

const studio: Catalogue = {
    /* ---------------------------------------------------------------- *
     * Roblox — the two tools
     * ---------------------------------------------------------------- */
    '🎨 Part Designer': '🎨 مصمّم الأجزاء',
    'Part Designer': 'مصمّم الأجزاء',
    'Roblox Animation Studio': 'استوديو التحريك لـ Roblox',
    'Create, preview & export Lua animation scripts for Roblox':
        'أنشئ نصوص تحريك Lua لـ Roblox وعاينها وصدّرها',
    '🤖 AI Part Generator': '🤖 مُنشئ الأجزاء بالذكاء الاصطناعي',
    '🤖 AI Generate': '🤖 إنشاء بالذكاء الاصطناعي',
    'Describe what to build. AI creates it with hierarchy (root + children), proper shapes and materials. All parts anchored.':
        'اوصف ما تريد بناءه. ينشئه الذكاء الاصطناعي بتسلسل هرمي (جزء جذر + أجزاء فرعية) وبأشكال ومواد مناسبة، وكل الأجزاء مثبّتة.',
    'Describe the animation. AI generates the Lua code and saves to your library.':
        'اوصف الحركة. ينشئ الذكاء الاصطناعي شيفرة Lua ويحفظها في مكتبتك.',
    'Choose from the library or create with AI.': 'اختر من المكتبة أو أنشئ بالذكاء الاصطناعي.',
    'Model Name': 'اسم المجسّم',
    'My Model': 'مجسّمي',
    'My Saved Designs': 'تصاميمي المحفوظة',
    'Parts Tree ({v0})': 'شجرة الأجزاء ({v0})',
    '+ Root Part': '+ جزء جذر',
    'Add child': 'إضافة جزء فرعي',
    'Part:': 'الجزء:',
    'Edit: {v0}': 'تعديل: {v0}',
    'Position & size': 'الموضع والحجم',
    'Category': 'الفئة',
    'Icon': 'الأيقونة',
    'Info': 'معلومات',
    'Mine': 'خاصتي',
    'Search…': 'بحث…',
    'Loading…': 'جارٍ التحميل…',
    'Best For': 'الأفضل لـ',
    '💀 Kill Player on Touch': '💀 قتل اللاعب عند اللمس',

    '🎬 Animations': '🎬 الحركات',
    'Animations': 'الحركات',
    'Animation': 'حركة',
    'Custom Animation': 'حركة مخصَّصة',
    '🎬 Part Animation': '🎬 حركة جزء',
    '🎬 Model Animation (from library)': '🎬 حركة مجسّم (من المكتبة)',
    'Model Animation Script (Lua)': 'نص حركة المجسّم (Lua)',
    'Global Behavior Script (Lua)': 'نص السلوك العام (Lua)',
    'Select an Animation': 'اختر حركة',
    'Select an animation to preview': 'اختر حركة لمعاينتها',
    'No animations found': 'لم تُعثر على حركات',
    '⚙️ Add Animation': '⚙️ إضافة حركة',
    '⚙️ Add to Library': '⚙️ إضافة إلى المكتبة',
    '🤖 My Animations': '🤖 حركاتي',
    '📚 Library': '📚 المكتبة',
    '🔄 New': '🔄 جديد',
    'Loop:': 'التكرار:',
    'Speed:': 'السرعة:',
    'Lua Code': 'شيفرة Lua',
    'Lua Script': 'نص Lua',
    'View script': 'عرض النص',
    'Preview Params JSON': 'معاينة معاملات JSON',

    'How to Import': 'كيفية الاستيراد',
    'How to Apply': 'كيفية التطبيق',
    'Import RBXM (Recommended)': 'استيراد RBXM (مُستحسَن)',
    '📥 RBXM': '📥 RBXM',
    '📦 ZIP': '📦 ZIP',
    'ZIP Package': 'حزمة ZIP',
    '📄 Lua': '📄 Lua',
    'Save → 📥 RBXM → In Studio: File → Import from File → select .rbxm. All parts, scripts, kill zones, animations included.':
        'احفظ ← 📥 RBXM ← في Studio: File ← Import from File ← اختر ملف .rbxm. تُدرج جميع الأجزاء والنصوص ومناطق القتل والحركات.',
    '📄 Lua → paste into ServerScriptService Script → F5 to create → stop, delete script, save.':
        '📄 Lua ← الصقه في نص داخل ServerScriptService ← اضغط F5 للإنشاء ← أوقف التشغيل واحذف النص ثم احفظ.',
    '📦 ZIP → contains RBXM + Lua + README.': '📦 ZIP ← يحتوي على RBXM وLua وملف README.',

    /* ---------------------------------------------------------------- *
     * The Network Simulator's project list
     * ---------------------------------------------------------------- */
    'Build a network. Run it. Watch every layer.': 'ابنِ شبكة. شغّلها. وراقب كل طبقة.',
    'Drag real devices onto the canvas, cable them, configure them with real CLI syntax, then send a packet and follow it hop by hop — MAC rewrites, VLAN tags, TTL, NAT, ACLs and all seven layers of encapsulation. The AI tutor sees the same network you do.':
        'اسحب أجهزة حقيقية إلى اللوحة، ووصّلها بالكوابل، واضبطها بصيغة سطر أوامر حقيقية، ثم أرسل حزمة وتابعها قفزةً بقفزة — إعادة كتابة عناوين MAC، ووسوم VLAN، وقيمة TTL، وNAT، وقوائم ACL، وطبقات التغليف السبع كلها. ويرى المدرّس بالذكاء الاصطناعي الشبكة نفسها التي ترى.',
    'What this simulator actually models': 'ما يحاكيه هذا المحاكي فعلاً',
    'device types': 'نوع جهاز',
    'OSI layers simulated': 'طبقة من OSI مُحاكاة',
    'templates': 'قالباً',
    'lessons': 'درساً',
    'My networks': 'شبكاتي',
    'New network': 'شبكة جديدة',
    'Untitled network': 'شبكة بلا عنوان',
    'Search my networks…': 'ابحث في شبكاتي…',
    'Loading your projects…': 'جارٍ تحميل مشاريعك…',
    'Start from': 'ابدأ من',
    'Blank canvas': 'لوحة فارغة',
    'Start from a blank canvas, load a template, or let the AI generate one for you.':
        'ابدأ من لوحة فارغة، أو حمّل قالباً، أو اترك الذكاء الاصطناعي ينشئ لك واحدة.',
    'Start from a working network': 'ابدأ من شبكة عاملة',
    'Browse templates': 'استعراض القوالب',
    'Branch office network': 'شبكة مكتب فرعي',
    'Every template is correct and runnable. Load one, run it, then break it deliberately.':
        'كل قالب صحيح وقابل للتشغيل. حمّل واحداً، وشغّله، ثم اعطبه بقصد.',
    'Create and open': 'إنشاء وفتح',
    'Description (optional)': 'الوصف (اختياري)',
    'Community networks': 'شبكات المجتمع',
    'Copy to my networks': 'نسخ إلى شبكاتي',
    'Nothing shared yet. Open one of your networks and press': 'لم يُشارَك شيء بعد. افتح إحدى شبكاتك واضغط',
    'to publish it for other students.': 'لنشرها لبقية الطلاب.',
    'shared': 'مشتركة',
    'by {v0}': 'بواسطة {v0}',
    'Your progress': 'تقدّمك',
    '{v0} XP · {v1} badge{v2}': '{v0} نقطة خبرة · {v1} شارة',
    '{v0} XP · {v1} badges': '{v0} نقطة خبرة · {v1} شارة',
    'Learn by doing': 'تعلّم بالممارسة',
    'Open the curriculum →': 'افتح المنهج →',
    'Lab feature · Network Simulator': 'ميزة المعامل · محاكي الشبكات',

    /* Storage: the token explanation, translated in full because it is a
     * security explanation rather than a setting. A reader who cannot follow it
     * is a reader who might put a write-capable token in a published bundle. */
    'Storage settings': 'إعدادات التخزين',
    'Connect storage': 'ربط التخزين',
    'Connect this device with a GitHub token': 'اربط هذا الجهاز برمز GitHub',
    'Fine-grained personal access token': 'رمز وصول شخصي دقيق الصلاحيات',
    'Repository': 'المستودع',
    'Proxy': 'وسيط',
    'Save and test': 'حفظ واختبار',
    'Forget token': 'نسيان الرمز',
    'Last sync': 'آخر مزامنة',
    'Syncing to {v0}': 'المزامنة إلى {v0}',
    'Projects are saving to this browser only': 'تُحفظ المشاريع في هذا المتصفح فقط',
    'The data repository is not reachable': 'لا يمكن الوصول إلى مستودع البيانات',
    'Everything works — your networks, lessons and progress are all kept in this browser. Cross-device sync needs the':
        'كل شيء يعمل — شبكاتك ودروسك وتقدّمك محفوظة كلها في هذا المتصفح. أما المزامنة بين الأجهزة فتحتاج إلى',
    'storage endpoints deployed on the Self Study AI backend; the frontend finds them through the registry automatically. Until then, you can sync just this device from Storage settings.':
        'نقاط تخزين مُنشورة على خدمة Self Study AI؛ وتجدها الواجهة عبر السجل تلقائياً. وحتى ذلك الحين، يمكنك مزامنة هذا الجهاز وحده من إعدادات التخزين.',
    'Why there is no build-time token:': 'لماذا لا يوجد رمز يُدرَج وقت البناء:',
    'anything in a': 'أي شيء في متغيّر',
    'variable is compiled into the published JavaScript. GitHub\'s push protection blocks a deploy that contains one, which is the right outcome — a write-capable token in a public bundle can be extracted by anyone who loads the page.':
        'يُدمَج في ملف JavaScript المنشور. وحماية الدفع في GitHub تمنع أي نشر يحتوي على واحد، وهذه هي النتيجة الصحيحة — فرمز قادر على الكتابة داخل حزمة عامة يمكن أن يستخرجه أي شخص يفتح الصفحة.',
    'The token is stored in this browser only. It is never part of the deployed site, so it cannot leak to visitors — but it also only works on this device. For real multi-user sync, point':
        'يُخزَّن الرمز في هذا المتصفح فقط. ولا يكون أبداً جزءاً من الموقع المنشور، فلا يمكن أن يتسرّب إلى الزوّار — لكنه في المقابل يعمل على هذا الجهاز وحده. وللمزامنة الحقيقية بين عدة مستخدمين، وجّه',
    'at a backend that holds the token server-side.': 'إلى خدمة خلفية تحتفظ بالرمز على الخادم.',
    '{v0} — your work is still safe in this browser and will sync on the next successful save.':
        '{v0} — عملك ما زال محفوظاً في هذا المتصفح وسيُزامَن عند أول حفظ ناجح.',

    /* ---------------------------------------------------------------- *
     * The studio's own furniture
     * ---------------------------------------------------------------- */
    'Back to projects': 'رجوع إلى المشاريع',
    'Unsaved changes': 'تغييرات غير محفوظة',
    'Undo (Ctrl+Z)': 'تراجع (Ctrl+Z)',
    'Redo (Ctrl+Shift+Z)': 'إعادة (Ctrl+Shift+Z)',
    'Tidy the layout': 'ترتيب التخطيط',
    'Layout': 'التخطيط',
    'Configure': 'الإعدادات',
    'Inspect': 'الفحص',
    'Simulation': 'المحاكاة',
    'Lesson': 'الدرس',
    'AI tutor': 'المدرّس بالذكاء الاصطناعي',
    'Add to canvas': 'إضافة إلى اللوحة',
    'Add to existing': 'إضافة إلى الموجود',
    'Search devices, tags, protocols…': 'ابحث في الأجهزة والوسوم والبروتوكولات…',
    'Select a device to open its terminal, or double-click one on the canvas.':
        'اختر جهازاً لفتح طرفيته، أو اضغط عليه مرتين على اللوحة.',
    'Reset MAC/ARP/NAT tables': 'إعادة تعيين جداول MAC وARP وNAT',
    'Layer {v0} · {v1} · since {v2} · {v3} ports': 'الطبقة {v0} · {v1} · منذ {v2} · {v3} منفذاً',

    'Subnet calculator': 'حاسبة الشبكات الفرعية',
    'IP address': 'عنوان IP',
    'Mask or prefix': 'القناع أو البادئة',
    'Enter a valid IPv4 address to see the breakdown.': 'أدخل عنوان IPv4 صالحاً لعرض التفصيل.',
    'Usable hosts': 'المضيفون القابلون للاستخدام',
    'Usable range': 'النطاق القابل للاستخدام',
    'Broadcast': 'البثّ',
    'Wildcard': 'قناع البدل',
    'Class / scope': 'الصنف / النطاق',
    'Split into equal subnets': 'تقسيم إلى شبكات فرعية متساوية',
    'New prefix': 'بادئة جديدة',
    '{v0}–{v1} · {v2} hosts · bcast {v3}': '{v0}–{v1} · {v2} مضيفاً · بثّ {v3}',

    'Import & export': 'الاستيراد والتصدير',
    'Import / export JSON': 'استيراد / تصدير JSON',
    'Import': 'استيراد',
    'Load from file': 'تحميل من ملف',
    'Download .json': 'تنزيل ملف .json',
    'Copy topology JSON': 'نسخ JSON الطبولوجيا',
    'Paste topology JSON': 'الصق JSON الطبولوجيا',
    'Fill with current topology': 'املأ بالطبولوجيا الحالية',
    'Topologies are stored as JSON in': 'تُخزَّن الطبولوجيات كـ JSON في',
    '. The same format is what the AI generator produces, so anything you export can be edited by hand and re-imported.':
        '. وهو الصيغة نفسها التي ينتجها المُنشئ بالذكاء الاصطناعي، فيمكن تعديل أي شيء تصدّره يدوياً ثم استيراده من جديد.',
    'Each template is a working, correct network — load one and start breaking it. That is how you learn fastest.':
        'كل قالب شبكة عاملة وصحيحة — حمّل واحداً وابدأ بإعطابه. هذه أسرع طريقة للتعلّم.',

    /* ---------------------------------------------------------------- *
     * The Learn hub
     * ---------------------------------------------------------------- */
    'Learn networking by building it': 'تعلّم الشبكات ببنائها',
    'You will be able to': 'ستكون قادراً على',
    'Tasks checked in the studio': 'مهام يُتحقَّق منها في الاستوديو',
    'Check your understanding': 'تحقّق من فهمك',
    'Practice questions on any topic': 'أسئلة تدريبية في أي موضوع',
    'The AI tutor writes exam-style questions and explains every answer.':
        'يكتب المدرّس بالذكاء الاصطناعي أسئلة على نمط الاختبارات ويشرح كل إجابة.',
    'e.g. VLSM, trunking, OSPF cost, NAT overload': 'مثال: VLSM، trunking، تكلفة OSPF، NAT overload',

    /* ---------------------------------------------------------------- *
     * The CV photo studio and voice recorder
     *
     * The guidance is translated in full: this is the only place on the
     * platform that promises somebody their face will never be removed
     * whatever the sliders do, and a promise nobody can read is not one.
     * ---------------------------------------------------------------- */
    'Photo studio': 'استوديو الصورة',
    'Picture': 'الصورة',
    'Upload a photo': 'ارفع صورة',
    'Use your camera': 'استخدم الكاميرا',
    'PNG, JPG or WEBP': 'PNG أو JPG أو WEBP',
    'Choose another': 'اختر صورة أخرى',
    'Retake': 'إعادة التصوير',
    'Switch camera': 'تبديل الكاميرا',
    'Mirror preview': 'معاينة معكوسة',
    'Flip horizontally': 'قلب أفقي',
    'Show framing guide': 'إظهار دليل التأطير',
    'Re-centre': 'إعادة التوسيط',
    'Straighten': 'تعديل الميل',
    'Zoom': 'التكبير',
    'Nudge': 'إزاحة',
    'Up': 'أعلى',
    'Down': 'أسفل',
    'Left': 'يسار',
    'Right': 'يمين',
    'Drag the picture to move it · scroll to zoom': 'اسحب الصورة لتحريكها · واستخدم عجلة الفأرة للتكبير',
    'Start from a photo you already have, or take one now. You can reframe it and change its background in the next step — nothing is saved until you press Apply.':
        'ابدأ من صورة لديك بالفعل، أو التقط واحدة الآن. يمكنك إعادة تأطيرها وتغيير خلفيتها في الخطوة التالية — ولا يُحفظ شيء حتى تضغط «تطبيق».',
    'Fill the circle with your head and shoulders, look at the lens, and keep the light in front of you. A plain wall behind you makes the background swap far cleaner.':
        'املأ الدائرة برأسك وكتفيك، وانظر إلى العدسة، واجعل الضوء أمامك. ووجود حائط سادة خلفك يجعل استبدال الخلفية أنظف بكثير.',
    'Background': 'الخلفية',
    'Custom colour': 'لون مخصَّص',
    'How much to replace': 'مقدار ما يُستبدَل',
    'Edge softness': 'نعومة الحواف',
    'Protect the person': 'حماية الشخص',
    'Highlight what will be replaced': 'إبراز ما سيُستبدَل',
    'Keeping the photo exactly as taken. Choose a colour or gradient to replace whatever is behind you.':
        'تُحفظ الصورة كما التُقطت تماماً. اختر لوناً أو تدرّجاً لاستبدال ما يوجد خلفك.',
    'The area inside the protected zone is never touched, so your face stays intact whatever the other sliders say. If part of you is being cut out, raise':
        'لا تُمَس المنطقة داخل النطاق المحمي أبداً، فيبقى وجهك سليماً أياً كانت قيم المؤشّرات الأخرى. وإن كان جزء منك يُقتطع، فارفع',
    'or lower': 'أو اخفض',
    'The background in this photo is busy rather than a plain wall, so the swap will look patchy. A photo against a single-colour wall gives a much cleaner result — or leave the background as it is.':
        'خلفية هذه الصورة مزدحمة وليست حائطاً سادة، لذا سيبدو الاستبدال متقطّعاً. صورة أمام حائط بلون واحد تعطي نتيجة أنظف بكثير — أو اترك الخلفية كما هي.',
    'You are editing the version already on your CV. “Reframe the original” goes back to the untouched upload, which keeps the quality.':
        'أنت تعدّل النسخة الموجودة بالفعل في سيرتك الذاتية. و«إعادة تأطير الأصل» ترجع إلى الملف المرفوع كما هو، وهو ما يحفظ الجودة.',
    'Contact': 'معلومات التواصل',
    'Nothing to show yet. Fill in the editor and this preview updates as you type.':
        'لا شيء لعرضه بعد. املأ المحرّر وتتحدّث هذه المعاينة أثناء كتابتك.',

    'Transcript': 'النص',
    'transcribing {v0}…': 'جارٍ التحويل إلى نص {v0}…',
    'working…': 'جارٍ العمل…',
    '— editable, fix anything the microphone got wrong': '— قابل للتعديل، صحّح ما أخطأ الميكروفون في التقاطه',
    'Speak naturally, as if answering “tell me about your career”. Cover each job title and employer, roughly when you were there, what you actually did and anything you improved with a number. Then your education, skills and languages. You can pause and resume — nothing is sent until you stop.':
        'تحدّث بطبيعية، كأنك تجيب عن سؤال «حدّثني عن مسارك المهني». اذكر كل مسمّى وظيفي وجهة العمل، ومتى كنت هناك تقريباً، وما قمت به فعلاً، وأي شيء حسّنته برقم. ثم تعليمك ومهاراتك ولغاتك. ويمكنك التوقّف والمتابعة — ولا يُرسَل شيء حتى تتوقّف.',
    'Anything else to add': 'أي شيء آخر تريد إضافته',
    'e.g. targeting a DevOps role in Dubai, available from October':
        'مثال: أستهدف وظيفة DevOps في دبي، ومتاح من تشرين الأول',

    /* ---------------------------------------------------------------- *
     * The last odds and ends
     * ---------------------------------------------------------------- */
    'No pages match “{v0}”': 'لا توجد صفحات تطابق “{v0}”',
    'Open navigation menu': 'فتح قائمة التنقّل',
    '{n} unread notifications': {
        zero: 'لا إشعارات غير مقروءة',
        one: 'إشعار واحد غير مقروء',
        two: 'إشعاران غير مقروءين',
        few: '{n} إشعارات غير مقروءة',
        many: '{n} إشعاراً غير مقروء',
        other: '{n} إشعار غير مقروء',
    },
    'Sign In': 'تسجيل الدخول',
    'Appearance': 'المظهر',
    'Choose your galaxy': 'اختر مجرّتك',
    'Ten palettes. Text colour is worked out from whatever it sits on, so every one stays readable.':
        'عشر لوحات ألوان. يُحسَب لون النص من الخلفية التي يقع عليها، فتبقى كلها مقروءة.',
    'Show the numbers': 'إظهار الأرقام',
    'Change Photo': 'تغيير الصورة',
    'Added {v0}': 'أُضيف {v0}',
    'AI, Machine Learning, Data Science': 'الذكاء الاصطناعي، تعلّم الآلة، علم البيانات',
    'gesture recognition, rehabilitation, exergame': 'التعرّف على الإيماءات، إعادة التأهيل، الألعاب الرياضية التفاعلية',
};

export default studio;
