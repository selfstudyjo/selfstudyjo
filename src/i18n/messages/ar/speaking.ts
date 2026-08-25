/**
 * The Job Interview room and the Toastmasters meeting — Arabic.
 *
 * ============================================================
 * THE INTERFACE IS ONLY HALF OF IT
 * ============================================================
 *
 * Everything here is the text AROUND the interviewer. What the interviewer
 * SAYS comes from a language model on app 27 and is a separate mechanism
 * entirely: `language.py` there appends the register directive built from
 * `locales.ts` → `aiName`, so the questions, the coaching and the evaluation
 * arrive in Modern Standard Arabic. And what the interviewer sounds like is a
 * third mechanism, `i18n/speech.ts`, which refuses to cast an English voice for
 * an Arabic utterance — an assigned `utterance.voice` overrides
 * `utterance.lang`, so casting the wrong one produces an English speaker
 * reading Arabic letters rather than accented Arabic.
 *
 * All three have to agree or the room is incoherent: an Arabic interface asking
 * English questions in an English voice is worse than being wholly in English,
 * because the reader cannot tell which part is broken.
 *
 * ============================================================
 * TWO TRANSLATION DECISIONS WORTH KNOWING
 * ============================================================
 *
 *  - **"sorry" stays in both languages, and the Arabic word is added rather
 *    than substituted.** The spoken-correction feature listens for a word the
 *    candidate SAYS, and the backend's transcription is in the session's
 *    language — so an Arabic session needs `آسف`. But candidates code-switch
 *    constantly, and somebody who has practised saying "sorry" should not lose
 *    the feature by switching interface language. `answerEditing.ts` therefore
 *    accepts both sets; this file only translates the *explanation*.
 *  - **"Toastmasters" is not translated.** It is the name of the organisation
 *    whose format the meeting follows, and the six roles are its terms of art —
 *    a member looking for "Ah-Counter" will not find "عدّاد الترددات" in any
 *    Toastmasters manual. The role names are translated *with* the original in
 *    the session where a beginner meets them, and left alone where they are
 *    labels.
 */

import type { Catalogue } from '../../index';

const speaking: Catalogue = {
    /* ---------------------------------------------------------------- *
     * Job Interview — the landing page
     * ---------------------------------------------------------------- */
    '💼 AI Job Interview Practice': '💼 التدرّب على مقابلات العمل بالذكاء الاصطناعي',
    'Practice technical and HR interviews with an AI interviewer and get instant feedback.':
        'تدرّب على المقابلات التقنية ومقابلات الموارد البشرية مع محاور بالذكاء الاصطناعي، واحصل على تقييم فوري.',
    'Start New Interview': 'ابدأ مقابلة جديدة',
    'My Interview Results': 'نتائج مقابلاتي',
    'Review past interviews, scores, transcripts and detailed feedback reports.':
        'راجع مقابلاتك السابقة ونتائجها ونصوصها وتقارير التقييم المفصّلة.',
    'What You\'ll Improve': 'ما ستحسّنه',
    'Technical depth & clarity': 'العمق التقني والوضوح',
    'Communication skills': 'مهارات التواصل',
    'Confidence under pressure': 'الثقة تحت الضغط',
    'Answering structure (STAR)': 'بنية الإجابة (STAR)',

    /* ---------------------------------------------------------------- *
     * Job Interview — setting one up
     * ---------------------------------------------------------------- */
    '🎯 Prepare Your Interview': '🎯 جهّز مقابلتك',
    'Configure your mock interview. The AI interviewer will ask questions one at a time and wait for your answers.':
        'اضبط إعدادات مقابلتك التجريبية. سيطرح المحاور سؤالاً واحداً في كل مرة وينتظر إجابتك.',
    'Interview Type *': 'نوع المقابلة *',
    'Technical Interview (role / topic based)': 'مقابلة تقنية (حسب الدور أو الموضوع)',
    'HR Interview (behavioral / soft skills)': 'مقابلة موارد بشرية (سلوكية / مهارات شخصية)',
    'Role / Topic *': 'الدور / الموضوع *',
    'e.g., Python Developer, DevOps, Frontend Engineer': 'مثال: مطوّر Python، DevOps، مهندس واجهات أمامية',
    'Qualifications / Job Requirements (optional)': 'المؤهّلات / متطلّبات الوظيفة (اختياري)',
    '💡 If you fill this in, the interviewer will ask questions specifically related to these qualifications.':
        '💡 إن أدخلت هذا، سيطرح المحاور أسئلة مرتبطة تحديداً بهذه المؤهّلات.',
    'How many questions? *': 'كم عدد الأسئلة؟ *',
    'From {v0} to {v1}. Each answer is planned at': 'من {v0} إلى {v1}. تُقدَّر مدة كل إجابة بـ',
    '— so {v0} questions is': '— أي أن {v0} سؤالاً يعني',
    '1 minute 30': 'دقيقة و30 ثانية',
    'Total time (minutes)': 'المدة الإجمالية (بالدقائق)',
    'Set from your question count. Raise it if you want longer than 1:30 to think and answer; it cannot go below what {v0} questions need.':
        'تُحدَّد من عدد أسئلتك. ارفعها إن أردت أكثر من دقيقة و30 ثانية للتفكير والإجابة؛ ولا يمكن أن تقلّ عمّا يحتاجه {v0} سؤالاً.',
    '⏱️ {v0} extra minute{v1} — about': '⏱️ {v0} دقيقة إضافية — نحو',
    'per answer instead of 1:30.': 'لكل إجابة بدلاً من دقيقة و30 ثانية.',
    'Attach a CV (optional)': 'أرفق سيرة ذاتية (اختياري)',
    '— No CV — interview me on the role and requirements only':
        '— بلا سيرة ذاتية — أجرِ المقابلة على الدور والمتطلّبات فقط',
    '💡 Attaching a CV makes the interview far more realistic: questions come from your own experience rather than from the role title alone.':
        '💡 إرفاق سيرة ذاتية يجعل المقابلة أقرب إلى الواقع بكثير: تأتي الأسئلة من خبرتك أنت لا من مسمّى الوظيفة وحده.',
    '✅ The interviewer will read this CV and ask about what is actually on it — your real projects, the gaps against the requirements, and the claims worth probing.':
        '✅ سيقرأ المحاور هذه السيرة الذاتية ويسأل عمّا فيها فعلاً — مشاريعك الحقيقية، والفجوات مقابل المتطلّبات، والادّعاءات التي تستحق التمحيص.',
    'and the interviewer will read it before asking anything.': 'وسيقرأها المحاور قبل أن يسأل أي شيء.',
    '⏳ Loading your CVs from the CV Builder…': '⏳ جارٍ تحميل سيرك الذاتية من منشئ السيرة الذاتية…',
    'Loading it now…': 'جارٍ التحميل…',
    '📄 You have no CVs yet.': '📄 ليست لديك سِيَر ذاتية بعد.',
    'Build one in the CV Builder': 'أنشئ واحدة في منشئ السيرة الذاتية',
    '⚠️ Could not reach the CV Builder right now, so no CV can be attached. Everything else works — you can start the interview without one.':
        '⚠️ تعذّر الوصول إلى منشئ السيرة الذاتية حالياً، فلا يمكن إرفاق سيرة. كل شيء آخر يعمل — ويمكنك بدء المقابلة بدونها.',
    'Practising again.': 'تتدرّب مرة أخرى.',
    'Your role and requirements are filled in from your last interview — change anything you like, or just start. The interviewer knows which questions you have already been asked and will cover different ground.':
        'دورك ومتطلّباتك مُعبَّأة من مقابلتك السابقة — عدّل ما تشاء، أو ابدأ فوراً. يعرف المحاور الأسئلة التي سُئلتها من قبل وسيتناول جوانب أخرى.',
    '⚠️ The next page will request camera & microphone permission. Your answers are transcribed by AI.':
        '⚠️ ستطلب الصفحة التالية إذن الكاميرا والميكروفون. تُحوَّل إجاباتك إلى نص بالذكاء الاصطناعي.',

    /* ---------------------------------------------------------------- *
     * Job Interview — the three ways to correct an answer
     *
     * Translated in full and not summarised: this is the feature a
     * non-native speaker needs most, and the reason it exists is that
     * Whisper faithfully transcribes a false start and the coach then marks
     * the candidate down for rambling. An Arabic-reading candidate is
     * exactly who that happens to.
     * ---------------------------------------------------------------- */
    '🎙️ Fixing what you said, while you say it': '🎙️ تصحيح ما قلته أثناء قولك له',
    'Your speech is transcribed live into an': 'يُحوَّل كلامك إلى نص مباشرةً في مربّع',
    'editable': 'قابل للتعديل',
    'box. If you start a sentence badly — which everybody does, and non-native speakers do more — you do not have to live with it in your report.':
        '. إن بدأت جملة بشكل سيّئ — وهذا يحدث للجميع، ولغير الناطقين بالإنجليزية أكثر — فلا داعي لأن تبقى في تقريرك.',
    'Words that count as a correction:': 'الكلمات التي تُعدّ تصحيحاً:',
    'Just type.': 'اكتب فقط.',
    'The transcript is an ordinary text box. Click into it and correct anything at any time, even mid-answer.':
        'النص مربّع كتابة عادي. اضغط داخله وصحّح ما تشاء في أي وقت، حتى في منتصف إجابتك.',
    'Say “sorry”.': 'قل «آسف».',
    'sorry': 'آسف',
    'deletes the last part of the sentence — back to the previous comma.':
        'تحذف الجزء الأخير من الجملة — رجوعاً إلى الفاصلة السابقة.',
    '“sorry sorry ignore”': '«آسف آسف تجاهل»',
    'deletes the last two parts,': 'تحذف الجزأين الأخيرين،',
    'the last three, and so on. It never wipes the whole answer. Anything you say after the correction carries straight on.':
        'والثلاثة الأخيرة، وهكذا. ولا تمسح الإجابة كاملةً أبداً. وكل ما تقوله بعد التصحيح يتابع مباشرةً.',
    'Highlight and replace.': 'حدّد واستبدل.',
    'Select the words that came out wrong, press': 'حدّد الكلمات التي خرجت خطأً، واضغط',
    ', and keep talking — the new words land exactly where the old ones were, not at the end.':
        '، وتابع الكلام — تحلّ الكلمات الجديدة مكان القديمة بالضبط، لا في نهاية النص.',
    'Let spoken corrections edit my answer': 'اسمح للتصحيحات المنطوقة بتعديل إجابتي',
    'Turn this off if your interview is about something where you would say those words for real. You can still type and highlight, and you can switch it back on in the room.':
        'أوقف هذا إن كانت مقابلتك عن موضوع قد تقول فيه تلك الكلمات فعلاً. يمكنك الكتابة والتحديد كما هما، ويمكنك إعادة تشغيله داخل الغرفة.',
    'One': 'واحدة',

    /* ---------------------------------------------------------------- *
     * Job Interview — the room
     * ---------------------------------------------------------------- */
    '💼 {v0} Interview': '💼 مقابلة {v0}',
    '❓ Interviewer asks:': '❓ يسأل المحاور:',
    '✍️ Your answer': '✍️ إجابتك',
    '🎤 Start Answering': '🎤 ابدأ الإجابة',
    '🎤 transcribing…': '🎤 جارٍ التحويل إلى نص…',
    '✅ Submit Answer': '✅ أرسل الإجابة',
    '⏹️ End Interview': '⏹️ إنهاء المقابلة',
    '🗑️ Clear': '🗑️ مسح',
    '👤 You ({v0})': '👤 أنت ({v0})',
    '📄 CV attached': '📄 سيرة ذاتية مرفقة',
    '🔁 Attempt {v0}': '🔁 المحاولة {v0}',
    '🎤 Your microphone could not be started': '🎤 تعذّر تشغيل الميكروفون',
    'A microphone is required — your spoken answers are transcribed. A camera is optional and the interview runs perfectly without one.':
        'الميكروفون مطلوب — تُحوَّل إجاباتك المنطوقة إلى نص. الكاميرا اختيارية والمقابلة تعمل تماماً بدونها.',
    'New questions — the interviewer knows what you have already been asked':
        'أسئلة جديدة — يعرف المحاور ما سُئلته من قبل',
    '▌ What you say next goes': '▌ ما ستقوله يذهب',
    'here': 'هنا',
    'Delete what you highlighted and carry on speaking in its place':
        'احذف ما حدّدته وتابع الكلام في موضعه',
    'Replace highlighted': 'استبدل المحدَّد',
    '↩︎ Undo last part': '↩︎ تراجع عن الجزء الأخير',
    '↦ Back to the end': '↦ رجوع إلى النهاية',
    'Say': 'قل',
    'to delete the last part,': 'لحذف الجزء الأخير،',
    'for the last two — or highlight a phrase and press': 'للجزأين الأخيرين — أو حدّد عبارة واضغط',
    '. You can also just type.': '. ويمكنك أيضاً الكتابة مباشرةً.',
    'spoken corrections': 'التصحيحات المنطوقة',
    'Turn off if the interview is about a subject where you say these words for real':
        'أوقفه إن كانت المقابلة عن موضوع تقول فيه هذه الكلمات فعلاً',
    '📋 Interview Feedback Report': '📋 تقرير تقييم المقابلة',
    '📋 Your report is being written as you go —': '📋 يُكتب تقريرك أثناء تقدّمك —',
    'of {v0} answers coached': 'من {v0} إجابة تمّ تدريبها',
    '📋 Your report starts building from your first answer — nothing waits until the end.':
        '📋 يبدأ بناء تقريرك من إجابتك الأولى — لا شيء ينتظر النهاية.',
    '💬 Question-by-question coaching ({v0})': '💬 تدريب سؤالاً بسؤال ({v0})',
    ', {v0} in progress': '، {v0} قيد الإنجاز',
    'No questions were answered.': 'لم تُجب عن أي سؤال.',
    'Recommendation': 'التوصية',

    /* ---------------------------------------------------------------- *
     * Job Interview — the report
     * ---------------------------------------------------------------- */
    '📊 My Job Interview Results': '📊 نتائج مقابلاتي',
    '{v0} Interview — {v1}': 'مقابلة {v0} — {v1}',
    '🔍 Filter by topic / role…': '🔍 تصفية حسب الموضوع أو الدور…',
    'Topic / Role': 'الموضوع / الدور',
    'Topic:': 'الموضوع:',
    'Technical': 'تقنية',
    'Attempt:': 'المحاولة:',
    'Planned:': 'المُقرَّر:',
    'Questions:': 'الأسئلة:',
    '· {v0} questions': '· {v0} سؤالاً',
    'try {v0}': 'المحاولة {v0}',
    'unfinished': 'غير مكتملة',
    'This interview was not finished — the answers you did give are still coached':
        'لم تُكتمل هذه المقابلة — ومع ذلك تمّ تدريب الإجابات التي قدّمتها',
    'No questions recorded.': 'لم تُسجَّل أي أسئلة.',
    '🔁 Redo': '🔁 إعادة',
    'Same role and requirements, new questions': 'نفس الدور والمتطلّبات، أسئلة جديدة',
    'Change the details first': 'عدّل التفاصيل أولاً',
    '🏁 Recommendation': '🏁 التوصية',
    '💬 Question-by-question coaching': '💬 تدريب سؤالاً بسؤال',
    '📄 CV the interviewer read': '📄 السيرة الذاتية التي قرأها المحاور',
    '📋 Qualifications Considered': '📋 المؤهّلات التي أُخذت في الحسبان',

    /* ---------------------------------------------------------------- *
     * The per-answer coaching card
     * ---------------------------------------------------------------- */
    '🗣️ Your answer:': '🗣️ إجابتك:',
    '✨ Your answer, made stronger': '✨ إجابتك، بصياغة أقوى',
    '📌 Feedback on your answer': '📌 ملاحظات على إجابتك',
    '🔧 The one thing to change': '🔧 الشيء الواحد الذي يجب تغييره',
    '🎯 Why they ask this': '🎯 لماذا يُطرح هذا السؤال',
    '⏳ Coaching this answer…': '⏳ جارٍ تدريب هذه الإجابة…',
    'The coach is writing feedback for this question now. It will appear here.':
        'يكتب المدرّب ملاحظاته على هذا السؤال الآن، وستظهر هنا.',
    'Checklist saved with this answer': 'قائمة تحقّق محفوظة مع هذه الإجابة',
    'The AI coach could not be reached for this question, so this is the shape a strong answer has rather than one written for you. Re-running the interview when the service is back produces a tailored answer and feedback on what you actually said.':
        'تعذّر الوصول إلى المدرّب لهذا السؤال، فهذا هو شكل الإجابة القوية عموماً وليس إجابة مكتوبة لك. إعادة المقابلة بعد عودة الخدمة تنتج إجابة مخصَّصة وملاحظات على ما قلته فعلاً.',

    /* ---------------------------------------------------------------- *
     * Toastmasters — the landing page
     * ---------------------------------------------------------------- */
    '🎤 Toastmasters AI Training': '🎤 تدريب Toastmasters بالذكاء الاصطناعي',
    'Master public speaking with AI-powered evaluation and feedback.':
        'أتقن الخطابة أمام الجمهور بتقييم وملاحظات مدعومة بالذكاء الاصطناعي.',
    'Start New Session': 'ابدأ جلسة جديدة',
    'Practice a speech with 6 AI evaluators watching and giving real-time feedback.':
        'تدرّب على خطاب بحضور ستة مقيّمين بالذكاء الاصطناعي يقدّمون ملاحظاتهم لحظياً.',
    'View your past sessions, filler word trends, and progression charts.':
        'اعرض جلساتك السابقة، واتجاهات كلمات الحشو، ومخطّطات تطوّرك.',
    'Skills You\'ll Build': 'المهارات التي ستبنيها',
    'Public speaking confidence': 'الثقة في الخطابة',
    'Reduced filler words': 'تقليل كلمات الحشو',
    'Better time management': 'إدارة أفضل للوقت',
    'Stronger body language': 'لغة جسد أقوى',

    /* ---------------------------------------------------------------- *
     * Toastmasters — setting a session up
     *
     * The six roles keep their Toastmasters names alongside the Arabic, for
     * the reason in the header: these are the organisation's terms of art and
     * a member will not find the Arabic in any manual.
     * ---------------------------------------------------------------- */
    '🎯 Prepare Your Session': '🎯 جهّز جلستك',
    'Choose your role and configure today\'s session.': 'اختر دورك واضبط إعدادات جلسة اليوم.',
    'Your Role *': 'دورك *',
    '🎤 Speaker — Deliver a speech': '🎤 المتحدّث (Speaker) — قدّم خطاباً',
    '🎙️ Toastmaster — Host the meeting': '🎙️ مدير الجلسة (Toastmaster) — أدِر الاجتماع',
    '⏱️ Timer — Track speech duration': '⏱️ المؤقِّت (Timer) — تابع مدة الخطاب',
    '🗣️ Ah-Counter — Count filler words': '🗣️ عدّاد الحشو (Ah-Counter) — أحصِ كلمات الحشو',
    '✍️ Grammarian — Analyze language & grammar': '✍️ مدقّق اللغة (Grammarian) — حلّل اللغة والقواعد',
    '📋 Speech Evaluator — Evaluate a speech': '📋 مقيّم الخطاب (Speech Evaluator) — قيّم خطاباً',
    '🎯 General Evaluator — Overall meeting feedback': '🎯 المقيّم العام (General Evaluator) — ملاحظات عن الاجتماع كله',
    'Speech Type *': 'نوع الخطاب *',
    'Speech Topic / Title *': 'موضوع الخطاب / عنوانه *',
    'e.g., The Power of Daily Habits': 'مثال: قوة العادات اليومية',
    'Ice Breaker (First Speech)': 'خطاب التعريف (الخطاب الأول)',
    'Min Duration (min)': 'أقل مدة (دقيقة)',
    'Max Duration (min)': 'أقصى مدة (دقيقة)',
    '⚠️ The next page will request camera and microphone permission.':
        '⚠️ ستطلب الصفحة التالية إذن الكاميرا والميكروفون.',

    /* ---------------------------------------------------------------- *
     * Toastmasters — the meeting
     * ---------------------------------------------------------------- */
    '🎭 Your Role:': '🎭 دورك:',
    '🎭 Role:': '🎭 الدور:',
    '📍 Topic:': '📍 الموضوع:',
    '📋 Task:': '📋 المهمة:',
    '👤 You ({v0}) —': '👤 أنت ({v0}) —',
    'Your Live Transcript': 'نصّك المباشر',
    '🎤 Recording (Whisper AI)': '🎤 جارٍ التسجيل (Whisper AI)',
    '✋ I\'m Done': '✋ انتهيت',
    '📋 Meeting Reports': '📋 تقارير الاجتماع',
    'Camera Off': 'الكاميرا مغلقة',
    'Mic:': 'الميكروفون:',
    'Face:': 'الوجه:',
    'face': 'وجه',
    'Frames:': 'الإطارات:',
    'Chunks:': 'المقاطع:',

    /* ---------------------------------------------------------------- *
     * Toastmasters — the reports
     * ---------------------------------------------------------------- */
    '📊 My Toastmasters Results': '📊 نتائج Toastmasters الخاصة بي',
    '🔍 Filter by topic…': '🔍 تصفية حسب الموضوع…',
    'Report: {v0}': 'التقرير: {v0}',
    'All Roles': 'جميع الأدوار',
    'Role:': 'الدور:',
    'Speaker': 'المتحدّث',
    'Toastmaster': 'مدير الجلسة',
    'Timer': 'المؤقِّت',
    'Ah-Counter': 'عدّاد الحشو',
    'Grammarian': 'مدقّق اللغة',
    'Speech Evaluator': 'مقيّم الخطاب',
    'General Evaluator': 'المقيّم العام',
    'Ice Breaker': 'خطاب التعريف',
    '📝 Topic': '📝 الموضوع',
    '🎤 Sample Speech': '🎤 خطاب نموذجي',
    '📚 Word of the Day': '📚 كلمة اليوم',
    '📜 Your Full Transcript': '📜 نصّك الكامل',
    'Fillers': 'كلمات الحشو',
    'Fillers:': 'كلمات الحشو:',
    'Target:': 'المستهدف:',
    'Face Visible:': 'الوجه ظاهر:',
    'Looking Forward:': 'النظر إلى الأمام:',
    'Centered:': 'التمركز:',
    'Engagement:': 'التفاعل:',
};

export default speaking;
