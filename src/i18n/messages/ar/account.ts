/**
 * Signing in, the profile, plans, payments, notifications, messaging, and the
 * home dashboard — Arabic.
 *
 * These are the screens a reader who has just switched language sees first, and
 * the ones they cannot get past if a word is wrong: the login form, the
 * verification code, the payment instructions. Two things in here were
 * translated with more care than their length suggests:
 *
 *  - **The payment instructions.** They tell somebody where to send money.
 *    "Transfer" and "Send" are different words in Arabic banking (حوّل for a
 *    bank transfer, أرسل for Cliq) and the platform's own screens use them
 *    that way, so the distinction is kept rather than flattened.
 *  - **"Verified" on a payment vs "Verified" on an email.** The first is an
 *    operator confirming money arrived (مؤكَّدة), the second is a code the
 *    reader typed (مُوثَّق). English uses one word for both and Arabic must
 *    not: a payment that says "authenticated" and an email that says
 *    "confirmed" both read as the wrong screen.
 */

import type { Catalogue } from '../../index';

const account: Catalogue = {
    /* ---------------------------------------------------------------- *
     * Sign in
     * ---------------------------------------------------------------- */
    'Welcome Back': 'مرحباً بعودتك',
    'Sign in to your Self Study JO account': 'سجّل الدخول إلى حسابك في Self Study JO',
    'Enter your username': 'أدخل اسم المستخدم',
    'Enter your password': 'أدخل كلمة المرور',
    'Password': 'كلمة المرور',
    'Signing In...': 'جارٍ تسجيل الدخول...',
    "Don't have an account?": 'ليس لديك حساب؟',
    'Sign up': 'أنشئ حساباً',
    'Sign in': 'تسجيل الدخول',
    'Already have an account?': 'لديك حساب بالفعل؟',

    /* ---------------------------------------------------------------- *
     * Register
     * ---------------------------------------------------------------- */
    'Join Self Study JO and start learning today': 'انضم إلى Self Study JO وابدأ التعلّم اليوم',
    'Create Account': 'إنشاء حساب',
    'Creating Account...': 'جارٍ إنشاء الحساب...',
    'Username *': 'اسم المستخدم *',
    'Email *': 'البريد الإلكتروني *',
    'Password *': 'كلمة المرور *',
    'Confirm Password *': 'تأكيد كلمة المرور *',
    'Create a strong password': 'اختر كلمة مرور قوية',
    'Confirm your password': 'أعد إدخال كلمة المرور',
    'Select gender': 'اختر الجنس',
    'Select Gender': 'اختر الجنس',
    'I agree to the': 'أوافق على',
    'Terms of Service': 'شروط الخدمة',
    'Privacy Policy': 'سياسة الخصوصية',
    'and': 'و',
    // The three form examples. Deliberately localised rather than left as
    // `John` / `Doe` / `johndoe`: a placeholder is an instruction about the
    // SHAPE of the answer, and a reader filling in an Arabic form is helped
    // by an Arabic-shaped example. The email and username stay Latin, because
    // both fields hold Latin characters and an Arabic example there would be
    // an instruction to type something the field will reject.
    'John': 'محمد',
    'Doe': 'العبدالله',
    'johndoe': 'mohammad',
    'john@example.com': 'mohammad@example.com',
    '🎁 Your': '🎁 لديك',
    '{v0}-day free trial': 'تجربة مجانية لمدة {v0} أيام',
    '— every feature unlocked — starts as soon as you verify your email.':
        '— جميع الميزات متاحة — تبدأ فوراً بعد توثيق بريدك الإلكتروني.',

    /* ---------------------------------------------------------------- *
     * Verify email
     * ---------------------------------------------------------------- */
    'Verify Your Email': 'وثّق بريدك الإلكتروني',
    'Verify Email': 'توثيق البريد',
    'Verifying...': 'جارٍ التوثيق...',
    'We\'ve sent a 6-digit code to {v0}': 'أرسلنا رمزاً من ستة أرقام إلى {v0}',
    'Code expires in {v0}': 'ينتهي الرمز خلال {v0}',
    'Code has expired': 'انتهت صلاحية الرمز',
    'Didn\'t receive the code?': 'لم يصلك الرمز؟',
    'Change email address': 'تغيير البريد الإلكتروني',
    'Email verified successfully! Redirecting...': 'تم توثيق البريد بنجاح! جارٍ التحويل...',

    /* ---------------------------------------------------------------- *
     * Profile
     * ---------------------------------------------------------------- */
    'Profile Settings': 'إعدادات الملف الشخصي',
    'Manage your account information and preferences': 'أدر معلومات حسابك وتفضيلاتك',
    'Personal Information': 'المعلومات الشخصية',
    'Account Information': 'معلومات الحساب',
    'Profile Picture': 'صورة الملف الشخصي',
    'Upload a JPG, PNG, or GIF image (max 5MB)': 'ارفع صورة بصيغة JPG أو PNG أو GIF (بحجم أقصى 5 ميغابايت)',
    'Uploading: {v0}%': 'جارٍ الرفع: {v0}%',
    'Email Address': 'عنوان البريد الإلكتروني',
    'Email Status': 'حالة البريد الإلكتروني',
    'Email Verified': 'بريد مُوثَّق',
    'Member Since': 'عضو منذ',
    'Last Updated': 'آخر تحديث',
    'Change Password': 'تغيير كلمة المرور',
    'Current Password': 'كلمة المرور الحالية',
    'Enter your current password': 'أدخل كلمة المرور الحالية',
    'New Password': 'كلمة المرور الجديدة',
    'Confirm New Password': 'تأكيد كلمة المرور الجديدة',
    'Password must be at least 8 characters long': 'يجب أن تكون كلمة المرور 8 أحرف على الأقل',
    'Save Changes': 'حفظ التغييرات',
    'Danger Zone': 'منطقة الخطر',
    'Delete Account': 'حذف الحساب',
    'Once you delete your account, there is no going back. Please be certain.':
        'حذف الحساب لا رجعة فيه. تأكّد قبل المتابعة.',
    'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently removed.':
        'هل تريد بالتأكيد حذف حسابك؟ لا يمكن التراجع عن هذا الإجراء، وستُحذف جميع بياناتك نهائياً.',
    'Confirm your password to delete account': 'أكّد كلمة المرور لحذف الحساب',
    '✓ Available': '✓ متاح',
    '✗ Username already taken': '✗ اسم المستخدم مستخدم بالفعل',
    '✗ Email already registered': '✗ البريد الإلكتروني مسجَّل بالفعل',

    /* ---------------------------------------------------------------- *
     * Notifications
     * ---------------------------------------------------------------- */
    'Mark All as Read': 'تعليم الكل كمقروء',
    'Mark as Read': 'تعليم كمقروء',
    'Clear All': 'مسح الكل',
    'Clear all {v0} notifications? The ones sent to you are deleted for good. Announcements are removed from your list and stay in everybody else\'s.':
        'مسح جميع الإشعارات ({v0})؟ ما أُرسل إليك منها يُحذف نهائياً، والإعلانات العامة تُزال من قائمتك فقط وتبقى في قوائم الآخرين.',
    'Loading your notifications...': 'جارٍ تحميل إشعاراتك...',
    'Loading more notifications...': 'جارٍ تحميل إشعارات أخرى...',
    'Load More': 'تحميل المزيد',
    'Unread': 'غير مقروء',
    'All ({v0})': 'الكل ({v0})',
    'Unread ({v0})': 'غير المقروءة ({v0})',
    'Personal ({v0})': 'الشخصية ({v0})',
    'General ({v0})': 'العامة ({v0})',
    'Group ({v0})': 'الجماعية ({v0})',
    'General': 'عام',
    'Current User': 'المستخدم الحالي',
    'From:': 'من:',
    'To:': 'إلى:',
    'Group:': 'المجموعة:',
    '✓ Handled': '✓ تمت المعالجة',

    /* ---------------------------------------------------------------- *
     * Plans
     * ---------------------------------------------------------------- */
    'Choose Your Plan': 'اختر خطتك',
    'Unlock your learning potential with the perfect plan tailored for your journey':
        'أطلق قدرتك على التعلّم مع الخطة الأنسب لمسارك',
    'Loading plans...': 'جارٍ تحميل الخطط...',
    'Unable to load plans': 'تعذّر تحميل الخطط',
    'What\'s included': 'ما تتضمّنه',
    'Your Current Subscriptions': 'اشتراكاتك الحالية',
    'Payment Pending': 'دفعة قيد الانتظار',
    'You have a pending payment for the': 'لديك دفعة قيد الانتظار لخطة',
    'plan.': '.',
    'View payment details': 'عرض تفاصيل الدفعة',
    'Cancel payment': 'إلغاء الدفعة',
    '⏳ Pending': '⏳ قيد الانتظار',
    '✨ {v0} days free': '✨ {v0} أيام مجاناً',
    'Created: {v0}': 'أُنشئ في: {v0}',

    /* ---------------------------------------------------------------- *
     * My plans
     * ---------------------------------------------------------------- */
    'My Learning Plans': 'خطط تعلّمي',
    'Manage your subscriptions and track your learning journey': 'أدر اشتراكاتك وتابع مسار تعلّمك',
    'Loading your learning dashboard...': 'جارٍ تحميل لوحة تعلّمك...',
    'Unable to Load Plans': 'تعذّر تحميل الخطط',
    'No Learning Plans Yet': 'لا توجد خطط تعلّم بعد',
    'Start your educational journey by exploring our premium plans': 'ابدأ رحلتك التعليمية باستكشاف خططنا المميزة',
    'Browse Learning Plans': 'استعراض خطط التعلّم',
    'Total Plans': 'مجموع الخطط',
    'Included Features': 'الميزات المتضمَّنة',
    'Previous Subscriptions': 'الاشتراكات السابقة',
    'Verified Payments': 'الدفعات المؤكَّدة',
    'Pending Payments': 'الدفعات قيد الانتظار',
    'Complete these payments to activate your subscriptions': 'أكمل هذه الدفعات لتنشيط اشتراكاتك',
    'Currently Active:': 'النشط حالياً:',
    '⭐ Currently Active': '⭐ النشط حالياً',
    '⭐ IN USE': '⭐ قيد الاستخدام',
    'ACTIVE': 'نشط',
    'EXPIRED': 'منتهي',
    'Pending': 'قيد الانتظار',
    'PENDING': 'قيد الانتظار',
    'Expires in {v0}': 'ينتهي خلال {v0}',
    'Plan Type:': 'نوع الخطة:',
    'Subscription ID:': 'معرّف الاشتراك:',
    'Payment ID:': 'معرّف الدفعة:',
    'Reference Number:': 'الرقم المرجعي:',
    'Method:': 'الطريقة:',
    'Cancel Payment': 'إلغاء الدفعة',
    'Subscription successfully created': 'تم إنشاء الاشتراك بنجاح',
    '{v0} of {v1} pending': '{v0} من {v1} قيد الانتظار',
    'You have multiple active subscriptions. Click "Use This Plan" to switch between them.':
        'لديك عدة اشتراكات نشطة. اضغط «استخدم هذه الخطة» للتبديل بينها.',
    'Payment Instructions': 'تعليمات الدفع',
    // See the header: حوّل for a bank transfer, أرسل for Cliq. The platform's
    // own two payment screens make the same distinction.
    '1. Transfer': '١. حوّل',
    '1. Send': '١. أرسل',
    'to:': 'إلى:',
    'via Cliq to:': 'عبر Cliq إلى:',
    'Bank': 'البنك',
    '📋 Copy Details': '📋 نسخ التفاصيل',
    '📞 Contact Admin': '📞 تواصل مع الإدارة',

    /* ---------------------------------------------------------------- *
     * Payment
     * ---------------------------------------------------------------- */
    'Complete Your Purchase': 'أكمل عملية الشراء',
    'Select payment method and complete your subscription': 'اختر طريقة الدفع وأكمل اشتراكك',
    'Loading payment options...': 'جارٍ تحميل طرق الدفع...',
    'Payment Error': 'خطأ في الدفع',
    'Payment Method:': 'طريقة الدفع:',
    'Payment Summary': 'ملخّص الدفعة',
    'Plan Summary': 'ملخّص الخطة',
    'Bank Transfer': 'حوالة بنكية',
    'Cliq Transfer': 'تحويل عبر Cliq',
    'No Bank Accounts Available': 'لا توجد حسابات بنكية متاحة',
    'No Cliq Accounts Available': 'لا توجد حسابات Cliq متاحة',
    'Please check back later or use Bank transfer': 'عد لاحقاً أو استخدم الحوالة البنكية',
    'Please check back later or use Cliq transfer': 'عد لاحقاً أو استخدم التحويل عبر Cliq',
    'Selected Account:': 'الحساب المختار:',
    'Account Holder:': 'صاحب الحساب:',
    'Branch:': 'الفرع:',
    'Address:': 'العنوان:',
    'Price:': 'السعر:',
    'Total Amount:': 'المبلغ الإجمالي:',
    '← Back to Plans': '← رجوع إلى الخطط',

    /* ---------------------------------------------------------------- *
     * Home dashboard
     * ---------------------------------------------------------------- */
    'Welcome back, {v0}!': 'مرحباً بعودتك، {v0}!',
    'Track your learning progress and achievements': 'تابع تقدّمك التعليمي وإنجازاتك',
    'My Courses': 'دوراتي',
    'Courses you\'re currently enrolled in': 'الدورات المسجَّل بها حالياً',
    'No courses enrolled yet': 'لم تسجّل في أي دورة بعد',
    'Browse Courses': 'استعراض الدورات',
    'Assigned Homeworks': 'الواجبات المُسندة',
    'Homework for your enrolled courses': 'واجبات دوراتك المسجَّلة',
    'No homeworks assigned': 'لا توجد واجبات مُسندة',
    'Your earned certificates': 'الشهادات التي حصلت عليها',
    'No exam certificates yet': 'لا توجد شهادات اختبارات بعد',
    'No course certificates yet': 'لا توجد شهادات دورات بعد',
    'Your recent quiz performance': 'أداؤك في الاختبارات القصيرة الأخيرة',
    'No quiz results yet': 'لا توجد نتائج اختبارات قصيرة بعد',
    'All your currently active subscription plans': 'جميع خطط اشتراكك النشطة',
    'No active subscription': 'لا يوجد اشتراك نشط',
    'Plan Name': 'اسم الخطة',
    'Features included': 'الميزات المتضمَّنة',
    'No features attached to this plan': 'لا توجد ميزات مرتبطة بهذه الخطة',
    'Expires': 'ينتهي',
    'Registered: {v0}': 'التسجيل: {v0}',
    '· {v0} combined feature{v1}': '· {v0} ميزة مجتمعة{v1}',

    /* ---- The dashboard's banner, tiles, badges and progress card ----
     *
     * `Your progress`, `Certified` and `Loading...` are deliberately absent:
     * they are already in studio.ts, learning.ts and common.ts respectively,
     * and a key declared twice is a build failure here rather than a silent
     * overwrite. The key IS the English text, so one entry serves every screen.
     *
     * Two register notes. A badge NAME is a title, so it is a noun phrase
     * (`الخطوات الأولى`), while a badge NOTE is an instruction to the reader and
     * takes the imperative (`سجّل في دورة`) — read as a noun the requirement
     * turns into a claim that the learner has already done it. And `اختبار قصير`
     * throughout for a quiz, never `اختبار`, which is the invigilated exam.
     */
    'Your learning dashboard': 'لوحة تعلّمك',
    'Quick actions': 'إجراءات سريعة',
    'Your learning at a glance': 'تعلّمك في لمحة',
    'Average quiz score': 'متوسط درجات الاختبارات القصيرة',
    'Average quiz score: {v0}%': 'متوسط درجات الاختبارات القصيرة: {v0}%',
    'Take your first quiz': 'ابدأ اختبارك القصير الأول',
    'Quizzes passed': 'الاختبارات القصيرة الناجحة',
    'Badges': 'الأوسمة',
    'Achievements': 'الإنجازات',
    '{v0} of {v1} earned': '{v0} من {v1} محقَّقة',
    'Earned': 'محقَّق',
    'Not earned yet': 'لم يُحقَّق بعد',
    'Measured from your quiz results — one attempt per quiz, your best':
        'محسوب من نتائج اختباراتك القصيرة — محاولة واحدة لكل اختبار، وهي الأفضل لديك',
    'Best score': 'أفضل درجة',
    'By course': 'حسب الدورة',
    'No quizzes yet': 'لا اختبارات قصيرة بعد',
    '{v0} of {v1} passed': 'نجحت في {v0} من {v1}',

    /* Badge names */
    'First Steps': 'الخطوات الأولى',
    'Scholar': 'دارس مجتهد',
    'Quiz Taker': 'مُختبِر',
    'Sharp Shooter': 'إصابة دقيقة',
    'Honour Roll': 'لوحة الشرف',
    'Perfect Score': 'الدرجة الكاملة',

    /* Badge requirements */
    'Enrol in a course': 'سجّل في دورة',
    'Enrol in 3 courses': 'سجّل في 3 دورات',
    'Pass a quiz': 'انجح في اختبار قصير',
    'Pass 5 quizzes': 'انجح في 5 اختبارات قصيرة',
    'Earn a certificate': 'احصل على شهادة',
    'Average 90% over 3 quizzes': 'حقّق متوسط 90% في 3 اختبارات قصيرة',
    'Score 100% on a quiz': 'احصل على 100% في اختبار قصير',

    /* ---- The strings that were still English literals in the template ----
     *
     * Every one of these was a bare `'Valid'` / `` `${n} Active` `` / `/year` in
     * Home.vue, so they rendered in English inside an otherwise Arabic
     * dashboard — and `{v0} Active` was worse than untranslated: the digit and
     * the word are neutral-then-Latin, so bidi reordered it to "Active 1".
     */
    'FAILED': 'راسب',
    'None': 'لا يوجد',
    '{v0} Active': '{v0} نشط',
    '/year': '/سنوياً',
    'Free': 'مجاناً',
    'Exam Certificate': 'شهادة اختبار',
    'Course Certificate': 'شهادة دورة',
    'Untitled Quiz': 'اختبار قصير بلا عنوان',
    'Unknown Course': 'دورة غير معروفة',
    'Unknown Lesson': 'درس غير معروف',
    'No description': 'لا يوجد وصف',
    /* Not "Loading…". A record that failed to arrive and one that has not
     * arrived yet are different states, and the second reads as a spinner that
     * never finishes. */
    'Course unavailable': 'الدورة غير متاحة',

    /* ---------------------------------------------------------------- *
     * Messaging (app 35)
     * ---------------------------------------------------------------- */
    'Pick a conversation': 'اختر محادثة',
    'Or start a new one. Messages, pictures and voice notes, free with your account.':
        'أو ابدأ محادثة جديدة. رسائل وصور وملاحظات صوتية، مجاناً مع حسابك.',
    'Edit message': 'تعديل الرسالة',
    'Close picture': 'إغلاق الصورة',
    'Loading your conversations': 'جارٍ تحميل محادثاتك',
    'No conversations yet': 'لا توجد محادثات بعد',
    'Start one with a classmate or a teacher — it is free with your account.':
        'ابدأ محادثة مع زميل أو معلّم — مجاناً مع حسابك.',
    'Search conversations': 'البحث في المحادثات',
    'Search conversations…': 'ابحث في المحادثات…',
    'Nothing matches “{v0}”.': 'لا شيء يطابق “{v0}”.',
    'Back to conversations': 'رجوع إلى المحادثات',
    '· {v0} online': '· {v0} متصل',
    'Notifications are muted for this conversation': 'الإشعارات صامتة في هذه المحادثة',
    'No messages yet': 'لا رسائل بعد',
    'Say hello — messages, pictures and voice notes.': 'ألقِ التحية — رسائل وصور وملاحظات صوتية.',
    'This is the beginning of the conversation.': 'هذه بداية المحادثة.',
    'Load earlier messages': 'تحميل الرسائل الأقدم',
    'Loading earlier messages…': 'جارٍ تحميل الرسائل الأقدم…',
    'Send': 'إرسال',
    'Sending': 'جارٍ الإرسال',
    'Sent': 'أُرسلت',
    'Read': 'مقروءة',
    'Not sent · retry': 'لم تُرسل · أعد المحاولة',
    'edited': 'مُعدَّلة',
    'More': 'المزيد',
    'More actions': 'إجراءات أخرى',
    'Reply to this message': 'الرد على هذه الرسالة',
    'Loading picture': 'جارٍ تحميل الصورة',
    'Attach a picture': 'إرفاق صورة',
    'Record a voice note': 'تسجيل ملاحظة صوتية',
    'Discard attachment': 'إلغاء المرفق',
    'Cancel reply': 'إلغاء الرد',
    'Replying to {v0}': 'رد على {v0}',
    'Uploading…': 'جارٍ الرفع…',
    '· {v0}% smaller': '· أصغر بنسبة {v0}%',
    'Emoji': 'رموز تعبيرية',
    'Insert an emoji': 'إدراج رمز تعبيري',
    'Close details': 'إغلاق التفاصيل',
    'Shared pictures': 'الصور المشتركة',
    'Add a topic…': 'أضف موضوعاً…',
    'Add': 'إضافة',
    'Admin': 'مشرف',
    'Member': 'عضو',
    'By': 'بواسطة',
    'Started': 'بدأت',
    'online': 'متصل',
    'Mute this conversation': 'كتم هذه المحادثة',
    'No chime and no notification email. The messages still arrive.':
        'بلا نغمة وبلا بريد إشعاري. الرسائل تصل كما هي.',
    'Leave this conversation': 'مغادرة هذه المحادثة',
    'Delete for everyone': 'حذف للجميع',
    'One to one': 'محادثة فردية',
    'Search by name or username…': 'ابحث بالاسم أو باسم المستخدم…',
    'Searching': 'جارٍ البحث',
    'Type at least two letters to find somebody.': 'اكتب حرفين على الأقل للبحث عن شخص.',
    'e.g. Physics revision': 'مثال: مراجعة الفيزياء',

    /* ---------------------------------------------------------------- *
     * The support widget (app 9). A DIFFERENT service from the messaging
     * above, and the console labels them Support Chat and User Chat for
     * exactly that reason — so the wording here says "support" rather than
     * "messages", or a reader will look for their classmate's reply in it.
     * ---------------------------------------------------------------- */
    'Welcome to SelfStudy Support': 'مرحباً بك في دعم SelfStudy',
    'SelfStudy Support': 'دعم SelfStudy',
    'We\'re here to help! Ask us anything about courses, progress, or technical issues.':
        'نحن هنا للمساعدة! اسألنا عن الدورات أو تقدّمك أو أي مشكلة تقنية.',
    'Typical response time: 2-5 minutes': 'زمن الرد المعتاد: من دقيقتين إلى خمس دقائق',
    'Open chat': 'فتح المحادثة',
    'Close chat': 'إغلاق المحادثة',
    'Minimize chat': 'تصغير المحادثة',
    'Connecting to chat...': 'جارٍ الاتصال بالمحادثة...',
    'Reconnecting...': 'جارٍ إعادة الاتصال...',
    'Offline': 'غير متصل',
    'Press Enter to send, Shift+Enter for new line': 'اضغط Enter للإرسال، وShift+Enter لسطر جديد',
    'You': 'أنت',
    '👨‍🏫 Support': '👨‍🏫 الدعم',
    '🤖 System': '🤖 النظام',
};

export default account;
