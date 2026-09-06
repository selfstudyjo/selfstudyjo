/**
 * Arabic — the practice record: exam integrity, lab scoring, activity records.
 *
 * ITS OWN AREA, and the reason is the one the index gives for the split: the
 * right translation of a word depends on the words around it. "Record" here is
 * a written account of somebody's conduct (`سِجِل`), not a database row and not
 * a recording; "conduct" is `سلوك` and never `تصرّف`; a "breach" of the rules is
 * `مخالفة`, which is the word an institution uses on a disciplinary notice and
 * which no reader would confuse with an error. Alphabetically sorted beside
 * `Clear` and `Close` there would be nothing to go on.
 *
 * REGISTER. Modern Standard Arabic, formal, and deliberately *plain* in the
 * reprimand: the one place on this platform where the interface accuses
 * somebody is the last place to reach for elaborate phrasing, because the
 * reader has to be able to argue with it. `غِشّ` is the word — it is what the
 * offence is called in every Arabic-speaking examination hall, and softening it
 * to `مخالفة` in the headline would leave a student unsure whether they had
 * been accused of cheating or of a clerical slip.
 *
 * DIGITS. Latin, as everywhere else here — see `formatNumber`. Every number on
 * these screens sits next to something Latin (a `%`, a `+`, a `−`), which is
 * exactly the bidi hazard Arabic-Indic digits create.
 *
 * THE MINUS SIGN. The English side spends U+2212 rather than a hyphen for a
 * bidi reason (a hyphen is neutral and gets relocated inside Arabic prose), so
 * nothing here should introduce one.
 */
export default {
    /* ---------------- the leaderboard's own additions ---------------- */
    'Activity': 'النشاط',
    'Activity record': 'سجل النشاط',
    'And what conduct is worth': 'وما يستحقّه السلوك',
    'Anybody can open a learner\'s activity record and see what was earned, what was lost, and when. That is the point: a rule nobody can see does not deter anything, and everyone is told before they start.':
        'يمكن لأي شخص فتح سجل نشاط أي متعلّم ورؤية ما كسبه وما خسره ومتى. وهذا هو المقصود: القاعدة التي لا يراها أحد لا تردع أحدًا، وكل متعلّم يُبلَّغ بها قبل أن يبدأ.',
    'Conduct': 'السلوك',
    'Copying or pasting': 'النسخ أو اللصق',
    'Every action is public.': 'كل إجراء معلَن.',
    'Five breaches end an exam.': 'خمس مخالفات تُنهي الامتحان.',
    'Five minutes of unbroken work': 'خمس دقائق من العمل المتواصل',
    'Leaving the exam window': 'مغادرة نافذة الامتحان',
    'Leaving the window, switching away, copying, pasting, printing or opening the developer tools during an exam or a quiz is recorded. {v0} of them and the paper is submitted, scored zero and marked as cheating. A lab records the same actions and can never be failed by them.':
        'مغادرة النافذة أو الانتقال إلى تطبيق آخر أو النسخ أو اللصق أو الطباعة أو فتح أدوات المطوّر أثناء امتحان أو اختبار قصير — كلّها تُسجَّل. وعند {v0} منها تُسلَّم الورقة وتُصحَّح بصفر وتُقيَّد كغِشّ. أما المعمل فيسجّل الإجراءات نفسها ولا يمكن أن تُسقِطك فيه أبدًا.',
    'No identifiers and no content are published.': 'لا تُنشَر أي معرّفات ولا أي محتوى.',
    'Opening the developer tools': 'فتح أدوات المطوّر',
    'Show every action {v0} has taken': 'إظهار كل إجراء قام به {v0}',
    'Sitting a whole paper cleanly': 'أداء الورقة كاملةً بنزاهة',
    'Switching away with Alt+Tab': 'الانتقال بعيدًا باستخدام Alt+Tab',
    'The board shows the name a learner\'s own certificates carry and their totals — no account id and no email. Nothing anywhere records an answer, a question, or what was copied: a copy is recorded as a character count.':
        'تُظهر اللوحة الاسم الذي تحمله شهادات المتعلّم ومجاميعه فقط — دون معرّف حساب ودون بريد إلكتروني. ولا يُسجَّل في أي مكان جواب ولا سؤال ولا ما نُسِخ: يُسجَّل النسخ بعدد الأحرف فقط.',
    'nothing recorded': 'لا شيء مسجَّل',

    /* ---------------- the activity record ---------------- */
    'A quiz — the platform cannot name one without publishing its answer key':
        'اختبار قصير — لا تستطيع المنصّة تسميته دون نشر مفتاح إجاباته',
    'Active days': 'أيام النشاط',
    'Activity over time': 'النشاط على مدى الوقت',
    'Activity record for {v0}': 'سجل نشاط {v0}',
    'An exam the platform cannot name': 'امتحان لا تستطيع المنصّة تسميته',
    'Built in your browser from the same public collections the board is built from. No account identifiers are shown, and no answer, question or copied text is ever recorded.':
        'يُبنى في متصفّحك من المجموعات المعلَنة نفسها التي تُبنى منها اللوحة. لا تُعرَض أي معرّفات حسابات، ولا يُسجَّل أبدًا أي جواب أو سؤال أو نصّ منسوخ.',
    'Loading the activity record...': 'جارٍ تحميل سجل النشاط...',
    'The activity record could not be loaded. Reload the page and try again.':
        'تعذّر تحميل سجل النشاط. أعد تحميل الصفحة وحاول مرة أخرى.',
    'Close the activity record': 'إغلاق سجل النشاط',
    'Courses enrolled': 'الدورات المسجَّل بها',
    'Earned by achievement': 'المكتسب من الإنجاز',
    'Enrolling on a course earns nothing — it is here because it is what somebody is working on. An exam certificate earns nothing either: the pass already earned the points.':
        'التسجيل في دورة لا يكسب نقاطًا — وهو مذكور هنا لأنه يبيّن ما يعمل عليه المتعلّم. وشهادة الامتحان أيضًا لا تكسب نقاطًا: فالنجاح نفسه كسبها.',
    'Every action, in the order it happened. A line with no points beside it changed nothing — it is here because it is what the rest is read against.':
        'كل إجراء بالترتيب الذي حدث فيه. السطر الذي لا نقاط بجانبه لم يغيّر شيئًا — وهو مذكور لأنه السياق الذي تُقرأ فيه بقية السجل.',
    'Everything on this platform, with the time it happened. This record is public.':
        'كل ما جرى على هذه المنصّة، مع وقت حدوثه. هذا السجل معلَن.',
    'Five recorded integrity breaches end an exam or a quiz. Every action is in the record below with the time it happened.':
        'خمس مخالفات نزاهة مسجَّلة تُنهي الامتحان أو الاختبار القصير. وكل إجراء مذكور في السجل أدناه مع وقت حدوثه.',
    'How many things happened in each period. Beside the points and not instead of them: a busy period that lost most of its points is not a quiet one.':
        'عدد ما حدث في كل فترة. إلى جانب النقاط وليس بدلًا منها: فالفترة المزدحمة التي خسرت معظم نقاطها ليست فترة هادئة.',
    'Labs finished': 'المعامل المُنجَزة',
    'Labs in progress': 'المعامل الجارية',
    'No conduct has been recorded — this learner has sat nothing since the practice record was introduced.':
        'لم يُسجَّل أي سلوك — لم يؤدِّ هذا المتعلّم شيئًا منذ استحداث سجل التدريب.',
    'No exam sat.': 'لم يُؤدَّ أي امتحان.',
    'No lab finished yet.': 'لم يُنجَز أي معمل بعد.',
    'No quiz taken.': 'لم يُؤدَّ أي اختبار قصير.',
    'None issued.': 'لم تُصدَر أي شهادة.',
    'Not enrolled on anything.': 'غير مسجَّل في أي شيء.',
    'Nothing dated to plot.': 'لا توجد بيانات مؤرَّخة للرسم.',
    'Nothing earned yet.': 'لم يُكتسب شيء بعد.',
    'Nothing has been recorded for this learner yet.': 'لم يُسجَّل شيء لهذا المتعلّم بعد.',
    'Nothing open at the moment.': 'لا يوجد شيء مفتوح حاليًا.',
    'Only the best attempt at each assessment is shown, which is the same attempt the ranking counts. A failure earns nothing and stays on the record.':
        'تُعرَض أفضل محاولة فقط في كل تقييم، وهي المحاولة نفسها التي يحسبها الترتيب. والرسوب لا يكسب شيئًا ويبقى في السجل.',
    'Only the sources that earned. Conduct is shown on its own tile above, because it is the one figure here that can be negative.':
        'المصادر التي كسبت نقاطًا فقط. أما السلوك فيُعرَض في بطاقته الخاصة أعلاه، لأنه الرقم الوحيد هنا الذي يمكن أن يكون سالبًا.',
    'Points over time': 'النقاط على مدى الوقت',
    'The running total, including the quiet periods — a series that skipped them would imply activity that never happened.':
        'المجموع التراكمي، بما في ذلك الفترات الهادئة — فالسلسلة التي تتجاهلها تُوهم بنشاط لم يحدث.',
    'Total points': 'مجموع النقاط',
    'What was earned and what was lost, per kind of action. Nothing here records what was copied or typed — a copy is recorded as a character count and never as the text.':
        'ما كُسِب وما خُسِر، حسب نوع الإجراء. لا يُسجَّل هنا ما نُسِخ أو ما كُتِب — يُسجَّل النسخ بعدد الأحرف ولا يُسجَّل النصّ أبدًا.',
    'Where the points came from': 'من أين جاءت النقاط',
    'Which part of the record': 'أي جزء من السجل',
    'achievements and conduct together': 'الإنجاز والسلوك معًا',
    'course': 'دورة',
    'exam': 'امتحان',
    'exams, quizzes, labs, certificates': 'الامتحانات والاختبارات القصيرة والمعامل والشهادات',
    'no dated activity': 'لا نشاط مؤرَّخ',
    'no points': 'لا نقاط',
    'since {v0}': 'منذ {v0}',
    'this learner': 'هذا المتعلّم',
    '{v0} earned, {v1} lost': '{v0} مكتسبة، {v1} مفقودة',
    '{v0} sitting(s) were ended for cheating and scored zero.':
        'أُنهيت {v0} جلسة بسبب الغِشّ وصُحّحت بصفر.',
    '{v0}\'s picture': 'صورة {v0}',
    '{v0}/{v1} tasks': '{v0}/{v1} مهمة',

    /* ---------------- the rules gate ---------------- */
    'Before you begin': 'قبل أن تبدأ',
    'I understand — start the exam': 'فهمت — ابدأ الامتحان',
    'Not now': 'ليس الآن',
    'Recorded score': 'الدرجة المسجَّلة',
    'See my activity record': 'عرض سجل نشاطي',
    '{v0} questions, {v1} minutes, and a pass mark of {v2}%. The clock starts when you accept the rules below.':
        '{v0} سؤالًا، و{v1} دقيقة، ودرجة نجاح {v2}%. يبدأ الوقت عند موافقتك على القواعد أدناه.',

    /* ---------------- the rules themselves ---------------- */
    'A lab is for trying things. Every action below is recorded and some of them cost points, but no number of them ends a lab or takes a task away from you. Leaving the window to read the documentation is what a practitioner does.':
        'المعمل مكان للتجربة. كل إجراء أدناه يُسجَّل وبعضه يخصم نقاطًا، لكن لا عدد منها يُنهي معملًا ولا يسلبك مهمة أنجزتها. ومغادرة النافذة لقراءة الوثائق هي ما يفعله الممارس فعلًا.',
    'Also recorded, and worth nothing either way': 'يُسجَّل أيضًا، ولا قيمة له سلبًا أو إيجابًا',
    'Every point on the public leaderboard comes from something this platform verified. Nothing here is awarded for turning up, and nothing here can be talked up: a task counts when the service looks at your environment and finds what the lab asked for.':
        'كل نقطة على اللوحة المعلَنة تأتي من شيء تحقّقت منه هذه المنصّة. لا شيء هنا يُمنح مقابل الحضور، ولا شيء هنا يمكن تحسينه بالكلام: تُحسَب المهمة عندما تفحص الخدمة بيئتك وتجد فيها ما طلبه المعمل.',
    'Everything recorded here is public. Anybody can open your activity record on the leaderboard and see what you earned, what you lost and when. Nothing records an answer, a question, or what you copied — a copy is recorded as a number of characters and never as the text.':
        'كل ما يُسجَّل هنا معلَن. يمكن لأي شخص فتح سجل نشاطك على اللوحة ورؤية ما كسبته وما خسرته ومتى. ولا يُسجَّل أي جواب أو سؤال أو ما نسخته — يُسجَّل النسخ بعدد الأحرف ولا يُسجَّل النصّ أبدًا.',
    'Exam integrity': 'نزاهة الامتحان',
    'How lab points work': 'كيف تُحسَب نقاط المعمل',
    'How you earn points here': 'كيف تكسب النقاط هنا',
    'Leave the window, read the manual, ask the tutor, break the environment and reset it. Some of that costs points and none of it ends a lab, takes a verified task away from you, or counts against an exam. The five-breach rule is for exams and quizzes only, and it is on the screen before you start one.':
        'اغادر النافذة، واقرأ الدليل، واسأل المدرّس، وأعطِب البيئة ثم أعِد تعيينها. بعض ذلك يخصم نقاطًا، ولا شيء منه يُنهي معملًا أو يسلبك مهمة تحقّقت أو يُحسَب عليك في امتحان. قاعدة المخالفات الخمس للامتحانات والاختبارات القصيرة فقط، وهي معروضة على الشاشة قبل أن تبدأ أيًّا منها.',
    'Nothing here can fail you': 'لا شيء هنا يمكن أن يُسقِطك',
    'Nothing in a lab can fail you': 'لا شيء في المعمل يمكن أن يُسقِطك',
    'Nothing in this context earns conduct points.': 'لا شيء في هذا السياق يكسب نقاط سلوك.',
    'Nothing recorded yet.': 'لم يُسجَّل شيء بعد.',
    'Nothing recorded. Keep the paper in front of you and it stays that way.':
        'لم يُسجَّل شيء. أبقِ الورقة أمامك وسيبقى الأمر كذلك.',
    'Practice record': 'سجل التدريب',
    'See the leaderboard': 'عرض لوحة الصدارة',
    'The full table, and what is recorded': 'الجدول الكامل، وما يُسجَّل',
    'This is an assessment, not a lab. Leaving the window, switching away with Alt+Tab, copying, pasting, printing or opening the developer tools is recorded, costs points, and counts as one of the {v0}. Reach {v0} and the paper is submitted for you, marked zero, and recorded as cheating.':
        'هذا تقييم وليس معملًا. مغادرة النافذة أو الانتقال بـ Alt+Tab أو النسخ أو اللصق أو الطباعة أو فتح أدوات المطوّر — كلّها تُسجَّل وتخصم نقاطًا وتُحسَب واحدة من {v0}. وعند بلوغ {v0} تُسلَّم الورقة عنك وتُصحَّح بصفر وتُقيَّد كغِشّ.',
    'What costs points': 'ما يخصم النقاط',
    'What earns points': 'ما يكسب النقاط',
    'Your record is public. Anybody can open it from the leaderboard and see every task you finished, every lab you are in the middle of, and every point earned or lost — with the time it happened.':
        'سجلّك معلَن. يمكن لأي شخص فتحه من لوحة الصدارة ورؤية كل مهمة أنجزتها وكل معمل أنت في وسطه وكل نقطة كسبتها أو خسرتها — مع وقت حدوث ذلك.',
    'and {v0} more, all of them on your activity record':
        'و{v0} أخرى، جميعها في سجل نشاطك',
    '{v0} integrity breaches will end this sitting and score it zero':
        '{v0} مخالفات نزاهة تُنهي هذه الجلسة وتُصحّحها بصفر',
    '{v0} of {v1} integrity breaches recorded': 'سُجّلت {v0} من {v1} مخالفات نزاهة',

    /* ---------------- the lab's tutor allowance ---------------- */
    'Your {v0} free asks are used. Each further ask costs {v1} points. It will not fail the lab and it will not take a verified task away from you.':
        'استُهلكت أسئلتك المجانية الـ {v0}. كل سؤال إضافي يخصم {v1} نقاط. ولن يُسقِط المعمل ولن يسلبك مهمة تحقّقت.',
    '{v0} of your {v1} free tutor asks used in this lab. Each ask after that costs {v2} points — and finishing within the allowance earns {v3}.':
        'استُهلك {v0} من أسئلتك المجانية الـ {v1} للمدرّس في هذا المعمل. كل سؤال بعد ذلك يخصم {v2} نقاط — وإنجاز المعمل داخل الحدّ المسموح يكسب {v3}.',

    /* ---------------- the catalogue: what each action is ---------------- */
    'Started the paper': 'بدأ الورقة',
    'The sitting began.': 'بدأت الجلسة.',
    'Read and accepted the integrity rules': 'قرأ قواعد النزاهة ووافق عليها',
    'The clock does not start until the rules are accepted.':
        'لا يبدأ الوقت حتى تُقبل القواعد.',
    'Submitted the paper': 'سلّم الورقة',
    'The sitting ended.': 'انتهت الجلسة.',
    'Opened the lab': 'فتح المعمل',
    'So a lab you are working on is visible before you finish it.':
        'حتى يكون المعمل الذي تعمل عليه ظاهرًا قبل أن تُنجزه.',
    'Pressed Check my work': 'ضغط "تحقّق من عملي"',
    'Free and unlimited. Checking often is how a lab is meant to be worked.':
        'مجاني وغير محدود. التحقّق المتكرّر هو الطريقة المقصودة للعمل في المعمل.',
    'Asked the lab tutor': 'سأل مدرّس المعمل',
    'Your first three asks in a lab are free.': 'أسئلتك الثلاثة الأولى في المعمل مجانية.',
    'Reset the environment': 'أعاد تعيين البيئة',
    'Starting again costs nothing.': 'البدء من جديد لا يكلّف شيئًا.',
    'Finished the lab': 'أنهى المعمل',
    'Every task verified. Nothing after this is scored.':
        'تم التحقّق من كل مهمة. ولا يُحتسَب شيء بعد ذلك.',
    'This sitting is finished. Nothing further is scored against it.':
        'انتهت هذه الجلسة. ولا يُحتسَب عليها شيء بعد الآن.',
    'Stayed on task': 'ظلّ منصرفًا إلى العمل',
    'One award for every five minutes of unbroken, active work, up to eight.':
        'مكافأة واحدة لكل خمس دقائق من العمل المتواصل الفعلي، حتى ثماني مرات.',
    'Answered every question': 'أجاب عن كل سؤال',
    'Awarded once, for leaving nothing blank.': 'تُمنَح مرة واحدة، لعدم ترك أي فراغ.',
    'Sat the whole paper cleanly': 'أدّى الورقة كاملةً بنزاهة',
    'No window left, nothing copied, nothing pasted, from the first question to submission.':
        'لا مغادرة للنافذة ولا نسخ ولا لصق، من السؤال الأول إلى التسليم.',
    'Finished the lab within the free tutor allowance':
        'أنجز المعمل داخل حدّ الأسئلة المجانية للمدرّس',
    'Completed every task having asked the tutor three times or fewer.':
        'أنجز كل المهام بعد أن سأل المدرّس ثلاث مرات أو أقل.',
    'Worked a task through to a verified pass': 'أوصل مهمة إلى نجاح متحقَّق منه',
    'Awarded when Check my work finds something new, up to four times per lab.':
        'تُمنَح عندما يجد "تحقّق من عملي" شيئًا جديدًا، حتى أربع مرات في المعمل.',
    'Left the exam window': 'غادر نافذة الامتحان',
    'The tab lost focus or was hidden. In an exam this is one of the five.':
        'فقدت علامة التبويب التركيز أو أُخفيت. وفي الامتحان تُحسَب واحدة من الخمس.',
    'Switched away with Alt+Tab': 'انتقل بعيدًا باستخدام Alt+Tab',
    'A deliberate switch to another application, which is why it costs more.':
        'انتقال متعمَّد إلى تطبيق آخر، ولذلك يخصم أكثر.',
    'Copied text out of the paper': 'نسخ نصًّا من الورقة',
    'How many characters is recorded. The text itself never is.':
        'يُسجَّل عدد الأحرف. أما النصّ نفسه فلا يُسجَّل أبدًا.',
    'Pasted text into the paper': 'لصق نصًّا في الورقة',
    'An answer that arrived from somewhere else.': 'جواب وصل من مكان آخر.',
    'Opened the browser developer tools': 'فتح أدوات المطوّر في المتصفّح',
    'The heaviest penalty: during a paper its only use is to read what the page was sent.':
        'أشدّ الخصومات: فاستخدامها الوحيد أثناء الورقة هو قراءة ما أُرسل إلى الصفحة.',
    'Tried to print or save the paper': 'حاول طباعة الورقة أو حفظها',
    'Taking the questions out of the room.': 'إخراج الأسئلة من القاعة.',
    'Left full screen': 'خرج من وضع الشاشة الكاملة',
    'Cheapest of the five, because it is the one people do by accident.':
        'أقلّ الخمس خصمًا، لأنه الإجراء الذي يقع بالخطأ.',
    'Asked the tutor beyond the free allowance': 'سأل المدرّس بعد انتهاء الحدّ المجاني',
    'Each ask past the first three costs. It never fails a lab.':
        'كل سؤال بعد الثلاثة الأولى يخصم نقاطًا. ولا يُسقِط معملًا أبدًا.',

    /* ---------------- the reprimand ---------------- */
    'This sitting was ended for cheating': 'أُنهيت هذه الجلسة بسبب الغِشّ',
    'Leaving the exam window, switching away with Alt+Tab, copying, pasting, printing or opening the developer tools during a paper is cheating. {v0} breaches were recorded against this sitting and {v1} is the limit, so it has been submitted and scored zero. Every action is on your activity record with the time it happened, and that record is public. Speak to your instructor if you believe any of it is wrong.':
        'مغادرة نافذة الامتحان أو الانتقال بـ Alt+Tab أو النسخ أو اللصق أو الطباعة أو فتح أدوات المطوّر أثناء الورقة غِشّ. سُجّلت {v0} مخالفات على هذه الجلسة والحدّ هو {v1}، فسُلّمت الورقة وصُحّحت بصفر. وكل إجراء مُدرَج في سجل نشاطك مع وقت حدوثه، وهذا السجل معلَن. راجع مدرّسك إن كنت ترى أن شيئًا منه غير صحيح.',

    /* ---------------- how a lab earns ---------------- */
    'Every task the service verifies in your environment is worth {v0} points.':
        'كل مهمة تتحقّق منها الخدمة في بيئتك تستحقّ {v0} نقاط.',
    'Finishing every task in a lab adds {v0} more.':
        'إنجاز كل مهام المعمل يضيف {v0} نقطة أخرى.',
    'Finishing a lab having asked the tutor {v0} times or fewer adds {v1}.':
        'إنجاز معمل بعد سؤال المدرّس {v0} مرات أو أقل يضيف {v1}.',
    'Every five minutes of unbroken, active work adds {v0}, up to {v1} times.':
        'كل خمس دقائق من العمل المتواصل الفعلي تضيف {v0}، حتى {v1} مرة.',
    'A lab is capped at {v0} points lost however long you work, and once every task is verified nothing further is scored at all.':
        'لا يتجاوز ما يُخصَم في المعمل {v0} نقطة مهما طال عملك، وبعد التحقّق من كل المهام لا يُحتسَب شيء بعد ذلك إطلاقًا.',
    'Working a task through to a verified pass adds {v0}, up to {v1} times.':
        'إيصال مهمة إلى نجاح متحقَّق منه يضيف {v0}، حتى {v1} مرات.',
    'Asking the tutor a fourth time and beyond costs {v0} each.':
        'سؤال المدرّس للمرة الرابعة وما بعدها يخصم {v0} نقاط لكل سؤال.',
    'Leaving the window costs {v0}, and Alt+Tab costs {v1} — but nothing in a lab can fail you.':
        'مغادرة النافذة تخصم {v0}، وAlt+Tab يخصم {v1} — لكن لا شيء في المعمل يمكن أن يُسقِطك.',

    /* ---------------- the strike meter ---------------- */
    'Clean so far. {v0} breaches would end this sitting.':
        'نزيه حتى الآن. {v0} مخالفات تُنهي هذه الجلسة.',
    '{v0} of {v1} breaches recorded. {v2} more will end this sitting.':
        'سُجّلت {v0} من {v1} مخالفات. {v2} أخرى تُنهي هذه الجلسة.',
    'One more breach will end this sitting and score it zero.':
        'مخالفة واحدة أخرى تُنهي هذه الجلسة وتُصحّحها بصفر.',
    'This sitting has been ended. {v0} integrity breaches were recorded and {v1} is the limit.':
        'أُنهيت هذه الجلسة. سُجّلت {v0} مخالفات نزاهة والحدّ هو {v1}.',
    'No points lost. Keep going.': 'لم تُخسر أي نقاط. واصِل.',
    '{v0} points lost so far. Nothing here can fail you — a lab is for trying things.':
        'خُسرت {v0} نقاط حتى الآن. لا شيء هنا يمكن أن يُسقِطك — فالمعمل مكان للتجربة.',

    /* ---------------- why an achievement earned what it earned ---------------- */
    'Passed an exam — {v0} points, plus {v1} for the mark itself.':
        'نجح في امتحان — {v0} نقطة، مع {v1} على الدرجة نفسها.',
    'An attempt that did not pass — {v0} points for sitting it. It counts towards the pass rate, which is the only way that figure means anything.':
        'محاولة لم تنجح — {v0} نقاط لأدائها. وتُحسَب في نسبة النجاح، وهذا وحده ما يجعل تلك النسبة ذات معنى.',
    'This sitting was ended for breaking the integrity rules, so it earns nothing at all — not even the credit for having attempted it.':
        'أُنهيت هذه الجلسة لمخالفة قواعد النزاهة، فلا تكسب شيئًا إطلاقًا — ولا حتى نقاط أداء المحاولة.',
    'Passed a quiz — {v0} points, plus {v1} for the mark itself.':
        'نجح في اختبار قصير — {v0} نقطة، مع {v1} على الدرجة نفسها.',
    'A course certificate — {v0} points. It is the one credential that scores, because nothing else records finishing a course.':
        'شهادة دورة — {v0} نقطة. وهي الشهادة الوحيدة التي تكسب نقاطًا، لأن لا شيء آخر يسجّل إتمام دورة.',
    'Issued automatically for passing the exam, so it is worth nothing on its own — the pass already earned the points. It is still a credential.':
        'تُصدَر تلقائيًا عند النجاح في الامتحان، فلا قيمة لها بذاتها — فالنجاح كسب النقاط بالفعل. وتبقى مع ذلك شهادة.',
    '{v0} verified tasks at {v1} points each{v2}.':
        '{v0} مهمة متحقَّق منها بواقع {v1} نقاط لكل مهمة{v2}.',

    /* ---------------- the two speaking rooms ---------------- */
    /*
     * The mock interview and the Toastmasters meeting. REGISTER: `مقابلة عمل`
     * is the interview, `اجتماع` the meeting, and a `دور` is the turn a member
     * takes rather than a role in the abstract - which is `الدور` here on
     * purpose, because the record says which role was practised. "Spoke" is
     * `نطق`/`تحدّث` and never `قال`: the whole distinction these awards rest on
     * is between an answer somebody SAID ALOUD and one they typed.
     */
    'Started the interview': 'بدأ المقابلة',
    'Recorded so the rest of the ledger has a start.':
        'يُسجَّل ليكون لبقية السجل بداية.',
    'Answered a question': 'أجاب عن سؤال',
    'One per question submitted. Free, and it is what makes "answered three of eight, then left" legible.':
        'واحد لكل سؤال مُرسَل. مجاني، وهو ما يجعل عبارة «أجاب عن ثلاثة من ثمانية ثم انصرف» مفهومة.',
    'Finished the interview': 'أكمل المقابلة',
    'Every question answered or the time up. Nothing after this is scored.':
        'أُجيب عن كل سؤال أو انتهى الوقت. لا يُحسَب شيء بعد ذلك.',
    'Joined the meeting': 'انضمّ إلى الاجتماع',
    'Finished the meeting': 'أكمل الاجتماع',
    'Your turn taken and the evaluations read. Nothing after this is scored.':
        'أخذتَ دورك واستمعتَ إلى التقييمات. لا يُحسَب شيء بعد ذلك.',
    'Spoke a real answer': 'نطق بإجابة حقيقية',
    'Awarded for a turn you actually said out loud, of some substance, up to eight times.':
        'يُمنَح على دور نطقتَ به فعلًا بصوت مسموع وكان ذا مضمون، حتى ثماني مرات.',
    'Answered every question the interviewer asked':
        'أجاب عن كل سؤال طرحه المُقابِل',
    'Awarded once, for going the whole way rather than stopping at the hard one.':
        'يُمنَح مرة واحدة، للمضي إلى النهاية بدلًا من التوقف عند السؤال الصعب.',
    'Stayed for the whole meeting': 'بقي طوال الاجتماع',
    'Awarded once, for hearing every other speaker out rather than leaving after your turn.':
        'يُمنَح مرة واحدة، للإنصات إلى كل متحدّث آخر بدلًا من الانصراف بعد دورك.',
    'Left the interview before the end': 'انصرف من المقابلة قبل نهايتها',
    'Abandoning an interview partway is recorded. Nothing in an interview can fail you.':
        'تُسجَّل مغادرة المقابلة في منتصفها. ولا شيء في المقابلة يمكن أن يُرسِّبك.',
    'Left the meeting before the end': 'انصرف من الاجتماع قبل نهايته',
    'Leaving while the meeting is still running is recorded. Nothing in a meeting can fail you.':
        'يُسجَّل الانصراف والاجتماع ما زال قائمًا. ولا شيء في الاجتماع يمكن أن يُرسِّبك.',

    /* ---------------- what each room pays, printed before it opens ------- */
    'Every turn you actually speak, of some substance, earns {v0} — up to {v1} times.':
        'كل دور تنطق به فعلًا ويكون ذا مضمون يكسب {v0} — حتى {v1} مرات.',
    'Every five minutes of unbroken, active work earns {v0}, up to {v1} times.':
        'كل خمس دقائق من عمل متواصل ونشِط تكسب {v0}، حتى {v1} مرات.',
    'Answering every question the interviewer asks earns {v0} more.':
        'الإجابة عن كل سؤال يطرحه المُقابِل تكسب {v0} إضافية.',
    'Staying to the end, so every other speaker is heard out, earns {v0} more.':
        'البقاء إلى النهاية، بحيث يُنصَت إلى كل متحدّث آخر، يكسب {v0} إضافية.',
    'Leaving the window costs {v0} and switching away with Alt+Tab costs {v1}.':
        'مغادرة النافذة تُكلِّف {v0} والانتقال بمفتاحي Alt+Tab يُكلِّف {v1}.',
    'Pasting text into the transcript costs {v0} — what you paste is coached as something you said.':
        'لصق نص في النص المنسوخ يُكلِّف {v0} — فما تلصقه يُقيَّم على أنه شيء قلتَه.',
    'Leaving before the end costs {v0}.': 'الانصراف قبل النهاية يُكلِّف {v0}.',
    'Nothing here can fail you, and one sitting is capped at {v0} points lost. Once it is finished, nothing further is scored at all.':
        'لا شيء هنا يمكن أن يُرسِّبك، والجلسة الواحدة محدودة بخسارة {v0} نقطة على الأكثر. وبعد انتهائها لا يُحسَب أي شيء إطلاقًا.',

    /* ---------------- the reassurance each room leads with --------------- */
    'An interview here is rehearsal, so nothing below can fail you or take a mark away - there is no mark. Every action is recorded, some of them cost points, and the report you get at the end is coaching either way. What earns is the part that is the exercise: answering out loud, and staying in the room.':
        'المقابلة هنا تدريب، فلا شيء مما يلي يمكن أن يُرسِّبك أو يسحب منك درجة — إذ لا توجد درجة. كل إجراء يُسجَّل، وبعضه يُكلِّف نقاطًا، والتقرير الذي تحصل عليه في النهاية توجيهي في الحالتين. وما يكسب هو الجزء الذي يمثّل التمرين نفسه: أن تُجيب بصوت مسموع، وأن تبقى في الغرفة.',
    'A meeting cannot be failed. Every action below is recorded and some of them cost points, but the worst any of them does is lower the conduct score on your record. What earns most here is the thing a meeting is actually for: taking your turn out loud, and hearing everybody else out.':
        'لا يمكن الرسوب في اجتماع. كل إجراء مما يلي يُسجَّل وبعضه يُكلِّف نقاطًا، لكن أقصى ما يفعله أيٌّ منها هو خفض درجة السلوك في سجلك. وأكثر ما يكسب هنا هو ما وُجد الاجتماع من أجله: أن تأخذ دورك بصوت مسموع، وأن تُنصِت إلى الآخرين.',
    '{v0} points lost so far. Nothing here can fail you — an interview is rehearsal.':
        'خسِرتَ {v0} نقطة حتى الآن. لا شيء هنا يمكن أن يُرسِّبك — فالمقابلة تدريب.',
    '{v0} points lost so far. Nothing here can fail you — a meeting is practice.':
        'خسِرتَ {v0} نقطة حتى الآن. لا شيء هنا يمكن أن يُرسِّبك — فالاجتماع تمرين.',

    /* ---------------- the two pre-session panels ---------------- */
    '📋 What is recorded, and what it is worth':
        '📋 ما الذي يُسجَّل، وما قيمته',
    'An interview here is practice, so nothing below can fail you — there is no mark to void. What it does is keep a record: the turns you actually speak earn points, and leaving the window, pasting an answer in or walking out partway costs them. That record is public.':
        'المقابلة هنا تمرين، فلا شيء مما يلي يمكن أن يُرسِّبك — إذ لا توجد درجة تُلغى. وما يفعله هو الاحتفاظ بسجل: الأدوار التي تنطق بها فعلًا تكسب نقاطًا، ومغادرة النافذة أو لصق إجابة أو الانصراف في المنتصف تُكلِّفك نقاطًا. وهذا السجل علني.',
    'Pasting is the one worth reading twice: the transcript is the record of what you said, so a pasted answer is coached and reported as speech you never gave.':
        'اللصق هو ما يستحق القراءة مرتين: النص المنسوخ هو سجل ما قلتَه، فالإجابة الملصوقة تُقيَّم ويُبلَّغ عنها ككلام لم تقله قطّ.',
    'A meeting is practice, so nothing below can fail you. What it does is keep a record: taking your turn out loud earns points, and so does hearing every other speaker out — while leaving the window, pasting your speech in or leaving partway costs them. That record is public.':
        'الاجتماع تمرين، فلا شيء مما يلي يمكن أن يُرسِّبك. وما يفعله هو الاحتفاظ بسجل: أخذ دورك بصوت مسموع يكسب نقاطًا، وكذلك الإنصات إلى كل متحدّث آخر — أما مغادرة النافذة أو لصق خطابك أو الانصراف في المنتصف فتُكلِّفك نقاطًا. وهذا السجل علني.',
    'Copying is deliberately not recorded here — the sample speech and the word of the day are on screen for you to use. Pasting into your own transcript is, because that transcript is what the Grammarian and both Evaluators read as your speech.':
        'النسخ لا يُسجَّل هنا عن قصد — فالخطاب النموذجي وكلمة اليوم معروضان على الشاشة لتستعملهما. أما اللصق في نصك المنسوخ فيُسجَّل، لأن ذلك النص هو ما يقرأه اللغوي والمقيِّمان على أنه خطابك.',

    /* ---------------- the kind chips ---------------- */
    'Lab': 'معمل',
};
