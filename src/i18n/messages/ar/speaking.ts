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
    /* Live interview / live meeting: turns by voice, and interruptions. */
    '🎙️ Live interview': '🎙️ مقابلة مباشرة',
    'Run it as a live interview — no buttons, just talk': 'أجرِها كمقابلة مباشرة — بلا أزرار، تحدّث فقط',
    'The microphone listens all the time. Start answering whenever you are ready — there is no “Start Answering” or “Submit” button.': 'يستمع الميكروفون طوال الوقت. ابدأ الإجابة متى كنت مستعدًا — لا يوجد زر «ابدأ الإجابة» ولا زر «إرسال».',
    'Your answer ends when you stop talking for about two seconds, and the interviewer moves on — exactly as in a real call.': 'تنتهي إجابتك عندما تتوقف عن الكلام نحو ثانيتين، فينتقل المحاور إلى ما بعدها — تمامًا كما في مكالمة حقيقية.',
    'If you talk over the interviewer, they stop and listen. Each time is counted as an interruption, and your report treats it as a communication weakness.': 'إذا تحدّثت أثناء كلام المحاور فسيتوقف ويستمع إليك. تُحتسب كل مرة مقاطعةً، ويعدّها تقريرك نقطة ضعف في التواصل.',
    'You can still mute your microphone, pause to edit your answer, and end the interview at any time.': 'لا يزال بإمكانك كتم الميكروفون، والإيقاف المؤقت لتعديل إجابتك، وإنهاء المقابلة في أي وقت.',
    'Use headphones if you can: they stop the interviewer’s voice reaching your microphone.': 'استخدم سماعات الرأس إن أمكن: فهي تمنع صوت المحاور من الوصول إلى الميكروفون.',
    '🔇 Live interview — your microphone is muted. Unmute it to answer.': '🔇 مقابلة مباشرة — الميكروفون مكتوم. ألغِ الكتم لتجيب.',
    '🟢 Live — just answer. Stop talking for about two seconds when you have finished.': '🟢 مباشر — أجب فقط. توقف عن الكلام نحو ثانيتين عندما تنتهي.',
    '🟢 Live — the microphone is on. Let the interviewer finish, then answer.': '🟢 مباشر — الميكروفون يعمل. دع المحاور ينهي كلامه، ثم أجب.',
    'Interruptions: {v0}': 'المقاطعات: {v0}',
    '✋ You interrupted the interviewer': '✋ لقد قاطعت المحاور',
    '🎙️ Live interview: interruptions': '🎙️ المقابلة المباشرة: المقاطعات',
    'You interrupted the interviewer {v0} time(s). In a real interview that reads as not listening — let each question finish, then answer.': 'قاطعت المحاور {v0} مرة. في مقابلة حقيقية يبدو ذلك عدمَ إصغاء — دع كل سؤال يكتمل، ثم أجب.',
    'You never interrupted the interviewer — every question was allowed to finish.': 'لم تقاطع المحاور أبدًا — تُرك كل سؤال حتى اكتمل.',
    'Live turn-taking is not available in this browser. Turn live mode off to use the answer buttons.': 'تبادل الأدوار المباشر غير متاح في هذا المتصفح. أوقف الوضع المباشر لتستخدم أزرار الإجابة.',
    'Question {v0}: {v1} s into the interviewer’s line': 'السؤال {v0}: بعد {v1} ث من بدء كلام المحاور',
    'Introduction or closing: {v0} s into the interviewer’s line': 'المقدمة أو الختام: بعد {v0} ث من بدء كلام المحاور',
    'Your microphone is muted — unmute it to answer.': 'الميكروفون مكتوم — ألغِ الكتم لتجيب.',
    '🎤 Answer whenever you are ready. When you stop talking for about two seconds, your answer is sent.': '🎤 أجب متى كنت مستعدًا. عندما تتوقف عن الكلام نحو ثانيتين تُرسل إجابتك.',
    '🎙️ Live meeting': '🎙️ اجتماع مباشر',
    'Run it as a live meeting — no buttons, just talk': 'أجرِه كاجتماع مباشر — بلا أزرار، تحدّث فقط',
    'The microphone listens all the time. When it is your turn, simply start speaking — there is no “Speak” or “I’m Done” button.': 'يستمع الميكروفون طوال الوقت. عندما يحين دورك ابدأ الكلام ببساطة — لا يوجد زر «تحدّث» ولا زر «انتهيت».',
    'Your turn ends when you stop talking for about two seconds, and the meeting moves on to the reports.': 'ينتهي دورك عندما تتوقف عن الكلام نحو ثانيتين، وينتقل الاجتماع إلى التقارير.',
    'If you talk over one of the meeting roles, they stop and listen. Each time is counted as an interruption and the evaluators mention it.': 'إذا تحدّثت أثناء كلام أحد أدوار الاجتماع فسيتوقف ويستمع. تُحتسب كل مرة مقاطعةً ويذكرها المقيّمون.',
    'Use headphones if you can: they stop the speakers’ voices reaching your microphone.': 'استخدم سماعات الرأس إن أمكن: فهي تمنع أصوات المتحدثين من الوصول إلى الميكروفون.',
    '🔇 Live meeting — your microphone is muted. Unmute it to speak.': '🔇 اجتماع مباشر — الميكروفون مكتوم. ألغِ الكتم لتتحدث.',
    '🟢 Live — it is your turn. Stop talking for about two seconds when you have finished.': '🟢 مباشر — حان دورك. توقف عن الكلام نحو ثانيتين عندما تنتهي.',
    '🟢 Live — the microphone is on. Let each role finish; your turn opens on its own.': '🟢 مباشر — الميكروفون يعمل. دع كل دور ينهي كلامه؛ سيبدأ دورك تلقائيًا.',
    '✋ You interrupted the speaker': '✋ لقد قاطعت المتحدث',
    '🎙️ Live meeting: interruptions': '🎙️ الاجتماع المباشر: المقاطعات',
    'You talked over a meeting role {v0} time(s). In a real meeting, let each speaker finish before you begin.': 'تحدّثت أثناء كلام أحد الأدوار {v0} مرة. في اجتماع حقيقي دع كل متحدث ينهي كلامه قبل أن تبدأ.',
    'You never talked over anybody — every role was allowed to finish.': 'لم تتحدث أثناء كلام أحد أبدًا — تُرك كل دور حتى أنهى كلامه.',
    'Live turn-taking is not available in this browser. Turn live mode off to use the Speak button.': 'تبادل الأدوار المباشر غير متاح في هذا المتصفح. أوقف الوضع المباشر لتستخدم زر التحدث.',
    'Your microphone is muted — unmute it to speak.': 'الميكروفون مكتوم — ألغِ الكتم لتتحدث.',
    '🎤 Your turn — start speaking. When you stop for about two seconds, your turn ends.': '🎤 دورك — ابدأ الكلام. عندما تتوقف نحو ثانيتين ينتهي دورك.',
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

    /* ------------------------------------------------------------------ *
     * The meeting room's own voice
     * ------------------------------------------------------------------ *
     *
     * Every string below is either SPOKEN by one of the seven bots or is the
     * room's own status line, and most of them are fallbacks reached when a
     * provider did not answer. Working rule 39: a fallback is reached when
     * something has already gone wrong, so it is the last place to introduce a
     * second, avoidable wrongness -- an Arabic meeting whose Toastmaster
     * switches to English because one provider was rate limited for four
     * seconds reads as the feature being broken rather than as a provider
     * having blinked.
     *
     * The sample speeches are translated rather than left in English on
     * purpose. The Evaluation-Speech exercise asks the candidate to CRITIQUE
     * the speech it plays them, so its deliberate fillers are the material --
     * and a filler in a language the listener does not speak is not something
     * they can be asked to spot.
     */
    '(no speech captured)': '(لم يُسجَّل أي كلام)',
    'Audio recording is not supported by this browser.': 'تسجيل الصوت غير مدعوم في هذا المتصفّح.',
    'Centered': 'التمركز',
    'Click "Start Meeting" to begin.': 'اضغط «ابدأ الاجتماع» للبدء.',
    'Click the speak button when ready.': 'اضغط زر التحدّث عندما تكون مستعدًّا.',
    'Engagement': 'التفاعل',
    'Face visible': 'الوجه ظاهر',
    'Finalizing transcription…': 'إتمام تحويل الكلام إلى نص…',
    'Generating sample speech…': 'إعداد الخطاب النموذجي…',
    'Generating your impromptu question…': 'إعداد سؤالك المفاجئ…',
    'Good language overall.': 'لغة جيّدة بشكل عام.',
    'Good meeting overall.': 'اجتماع جيّد بشكل عام.',
    'Hello, I am your Grammarian.': 'مرحبًا، أنا مدقّق اللغة.',
    'Intro skipped — jumping ahead…': 'تم تجاوز المقدّمة — ننتقل للأمام…',
    'Listen carefully…': 'استمع بتركيز…',
    'Loading AI face detection…': 'تحميل كشف الوجه بالذكاء الاصطناعي…',
    'Looking forward': 'النظر إلى الأمام',
    'Maintain eye contact.': 'حافظ على التواصل البصري.',
    'Microphone access is needed to take part in the meeting.': 'يلزم السماح باستخدام الميكروفون للمشاركة في الاجتماع.',
    'No camera on this device — the meeting runs on the microphone alone': 'لا توجد كاميرا على هذا الجهاز — يعمل الاجتماع بالميكروفون وحده',
    'No camera was used for this meeting, so there is no body-language analysis. The microphone is all a meeting needs — turn a camera on next time if you would like this report too.': 'لم تُستخدم كاميرا في هذا الاجتماع، لذلك لا يوجد تحليل لِلُغة الجسد. الميكروفون هو كل ما يحتاجه الاجتماع — شغّل الكاميرا في المرة القادمة إن أردت هذا التقرير أيضًا.',
    'Now our sample speaker will deliver a speech. Listen carefully!': 'سيقدّم المتحدّث النموذجي خطابًا الآن. استمع بتركيز!',
    'Please turn on your camera.': 'يُرجى تشغيل الكاميرا.',
    'Please unmute your microphone first.': 'يُرجى إلغاء كتم الميكروفون أوّلًا.',
    'Please welcome {v0}!': 'لِنُرحّب بـ {v0}!',
    'Practice your {v0} duties.': 'تدرّب على مهام دور {v0}.',
    'Preparing sample speech…': 'تجهيز الخطاب النموذجي…',
    'Reports skipped — saving results…': 'تم تجاوز التقارير — جارٍ حفظ النتائج…',
    'Requesting the microphone…': 'طلب الوصول إلى الميكروفون…',
    'Sample': 'نموذجي',
    'Solid effort.': 'جهد جيّد.',
    'Speak — your words appear here every few seconds. You can also type or correct anything in this box while you talk.': 'تحدّث — تظهر كلماتك هنا كل بضع ثوانٍ. ويمكنك أيضًا الكتابة أو تصحيح أي شيء في هذا المربّع أثناء حديثك.',
    'System': 'النظام',
    'The microphone is not ready yet.': 'الميكروفون غير جاهز بعد.',
    'The room is preparing…': 'القاعة تستعدّ…',
    'Three years ago I was afraid of failure. Then I, um, lost my job and started a business. It failed but, you know, that failure taught me everything. I basically learned that, like, taking risks is actually the key.': 'قبل ثلاث سنوات كنت أخاف الفشل. ثم، إممم، فقدت عملي وبدأت مشروعًا. فشل المشروع لكن، تعرف، ذلك الفشل علّمني كل شيء. تعلّمت أساسًا أن، مثلًا، المخاطرة هي المفتاح فعلًا.',
    'Three years ago, I lost my job. I started a business that failed. But that failure taught me everything.': 'قبل ثلاث سنوات فقدت عملي. بدأت مشروعًا وفشل. لكن ذلك الفشل علّمني كل شيء.',
    'Turn off if the speech is about a subject where you say these words for real': 'أوقفه إذا كان الخطاب عن موضوع تقول فيه هذه الكلمات فعلًا',
    'Welcome {v0}!': 'مرحبًا {v0}!',
    'Welcome {v0}! Today you have the {v1} role.': 'مرحبًا {v0}! اليوم لديك دور {v1}.',
    'Your turn, {v0}.': 'دورك الآن، {v0}.',
    '🎙️ Sample Speaker': '🎙️ المتحدّث النموذجي',
    '{v0} Today’s Word of the Day is “{v1}”, meaning: {v2}.': '{v0} كلمة اليوم هي «{v1}»، ومعناها: {v2}.',
    '{v0} filler words.': '{v0} من كلمات الحشو.',
    '⇥ Back to the end': '⇥ العودة إلى النهاية',
    '⏱️ Timer report': '⏱️ تقرير المؤقِّت',
    '⏳ Analyzing…': '⏳ جارٍ التحليل…',
    '⏳ Evaluating your role…': '⏳ جارٍ تقييم دورك…',
    '⏳ Generating…': '⏳ جارٍ الإنشاء…',
    '⏳ Setting up…': '⏳ جارٍ التهيئة…',
    '▶️ Start Meeting': '▶️ ابدأ الاجتماع',
    '✅ Saved! Redirecting…': '✅ تم الحفظ! جارٍ التحويل…',
    '✍️ Grammarian report': '✍️ تقرير مدقّق اللغة',
    '✓ Started': '✓ بدأ',
    '🎙️ Start hosting': '🎙️ ابدأ الاستضافة',
    '🎤 I am ready to speak': '🎤 أنا مستعدّ للتحدّث',
    '🎤 Speak now! Your words appear here every few seconds.': '🎤 تحدّث الآن! تظهر كلماتك هنا كل بضع ثوانٍ.',
    '🎯 General evaluation': '🎯 التقييم العام',
    '📋 Deliver evaluation': '📋 قدّم التقييم',
    '🗣️ Ah-Counter report': '🗣️ تقرير عدّاد الحشو',

    /* The interview room's status line. Prose in a `<script>` block, so it goes
     * through `t()` rather than `$t` -- and translated for the same reason the
     * meeting room's is: an Arabic interview whose captions are in English reads
     * as half a feature. */
    'Click "Start Answering" when you are ready to respond.': 'اضغط «ابدأ الإجابة» عندما تكون مستعدًّا للردّ.',
    'Finalizing your answer…': 'إتمام إجابتك…',
    'Finishing your report…': 'إتمام تقريرك…',
    'Interviewer is joining…': 'المحاوِر ينضمّ الآن…',
    'Interviewer is thinking of the next question…': 'المحاوِر يفكّر في السؤال التالي…',
    'Requesting your microphone…': 'طلب الوصول إلى الميكروفون…',
    'The interview cannot start without a microphone — see the message above.': 'لا يمكن بدء المقابلة بدون ميكروفون — راجع الرسالة أعلاه.',
    'Wrapping up the interview and preparing your feedback…': 'إنهاء المقابلة وتحضير ملاحظاتك…',
    'Your microphone is not connected yet.': 'الميكروفون غير متّصل بعد.',
    '⏰ Time is up — finish your current answer, then it will wrap up.': '⏰ انتهى الوقت — أكمل إجابتك الحالية وسيتم الإنهاء بعدها.',
    // The candidate's own questions (2026-10-19).
    'Add questions manually': 'إضافة الأسئلة يدويًا',
    'Your questions — one per line *': 'أسئلتك — سؤال في كل سطر *',
    '💡 Paste a list straight from a job posting, a document or an email. Bullets and numbering are removed for you; repeated questions are asked once. Up to {v0} questions.': '💡 الصق قائمة مباشرة من إعلان وظيفة أو مستند أو بريد إلكتروني. ستُزال النقاط والترقيم تلقائيًا، ويُطرح السؤال المكرّر مرة واحدة. حتى {v0} سؤالًا.',
    '⚠️ {v0} repeated line(s) removed.': '⚠️ أُزيل {v0} من الأسطر المكرّرة.',
    '⚠️ Only the first {v0} questions are used; {v1} more were left out.': '⚠️ تُستخدم أول {v0} أسئلة فقط، وتُرك {v1} سؤالًا إضافيًا.',
    '⚠️ {v0} very long line(s) were shortened to {v1} characters.': '⚠️ اختُصر {v0} من الأسطر الطويلة جدًا إلى {v1} حرفًا.',
    'The interviewer will ask these {v0} question(s)': 'سيطرح المحاور هذه الأسئلة ({v0})',
    'Ask them in a random order': 'اطرحها بترتيب عشوائي',
    'Real interviewers do not follow your list. Shuffling makes sure you know each answer, not just the order.': 'المحاورون الحقيقيون لا يتبعون قائمتك. الخلط يضمن أنك تعرف كل إجابة، لا ترتيبها فقط.',
    'After my questions, let the interviewer add its own': 'بعد أسئلتي، دع المحاور يضيف أسئلته الخاصة',
    'Your questions always come first and are all asked. The interviewer then adds new questions on the role, requirements and CV above — never repeating one of yours.': 'تأتي أسئلتك أولًا دائمًا وتُطرح جميعها. ثم يضيف المحاور أسئلة جديدة عن الدور والمتطلبات والسيرة الذاتية أعلاه — دون أن يكرّر أيًّا من أسئلتك.',
    '📝 Your report is the same as a normal interview: every answer gets feedback, a model answer to rehearse, and your own answer rewritten to be stronger.': '📝 تقريرك مثل أي مقابلة عادية: كل إجابة تحصل على ملاحظات، وإجابة نموذجية للتدرّب عليها، وإعادة صياغة لإجابتك لتصبح أقوى.',
    'How many questions?': 'كم عدد الأسئلة؟',
    '{v0} — your list': '{v0} — قائمتك',
    '· planned at 1:30 each, so': '· بمعدل دقيقة ونصف لكل سؤال، أي',
    'Total questions (yours + the interviewer’s) *': 'إجمالي الأسئلة (أسئلتك + أسئلة المحاور) *',
    '{v0} of yours, then {v1} from the interviewer — {v2} minutes at 1:30 each.': '{v0} من أسئلتك، ثم {v1} من المحاور — {v2} دقيقة بمعدل دقيقة ونصف لكل سؤال.',
    'One question per line, for example:': 'سؤال في كل سطر، مثلًا:',
    'Tell me about yourself.': 'حدّثني عن نفسك.',
    'Why do you want to work here?': 'لماذا تريد العمل هنا؟',
    'Explain the difference between a process and a thread.': 'اشرح الفرق بين العملية (process) والخيط (thread).',
    'Describe a time you disagreed with your manager.': 'صف موقفًا اختلفت فيه مع مديرك.',
    'Please enter the role / topic for a Technical interview.': 'يُرجى إدخال الدور / الموضوع للمقابلة التقنية.',
    'Add at least one question (one per line), or untick "Add questions manually".': 'أضف سؤالًا واحدًا على الأقل (سؤال في كل سطر)، أو ألغِ تحديد «إضافة الأسئلة يدويًا».',
    'Hello {v0}, I\'m {v1}. Thanks for joining. Today we will go through the {v2} questions you prepared. Let\'s begin.': 'مرحبًا {v0}، أنا {v1}. شكرًا لانضمامك. سنمرّ اليوم على الأسئلة التي أعددتها ({v2}). لنبدأ.',
    'Your {v0} questions first, then the interviewer adds its own': 'أسئلتك ({v0}) أولًا، ثم يضيف المحاور أسئلته',
    'The interviewer asks only the questions you added': 'يطرح المحاور الأسئلة التي أضفتها فقط',
    '📝 Your questions ({v0})': '📝 أسئلتك ({v0})',
    '📝 Your question': '📝 سؤالك',
    'Asked the questions you added': 'طُرحت الأسئلة التي أضفتها',
    '📝 your questions': '📝 أسئلتك',
    '{v0} of yours, then the interviewer’s own': '{v0} من أسئلتك، ثم أسئلة المحاور',
    '{v0} of yours': '{v0} من أسئلتك',
    // The downloadable interview report (2026-10-19).
    'Overall score': 'النتيجة الإجمالية',
    'out of 100': 'من 100',
    'Score breakdown': 'تفصيل النتيجة',
    'Standout moment': 'اللحظة الأبرز',
    'What would worry an interviewer': 'ما قد يُقلق المحاور',
    'Strengths': 'نقاط القوة',
    'Areas to improve': 'مجالات التحسين',
    'Communication': 'التواصل',
    'Your action plan': 'خطة عملك',
    'Question-by-question coaching': 'التوجيه سؤالًا بسؤال',
    'For each question: what you said, feedback on it, your own answer rewritten to be stronger, and a model answer to rehearse.': 'لكل سؤال: ما قلته، وملاحظات عليه، وإجابتك نفسها بصياغة أقوى، وإجابة نموذجية للتدرّب عليها.',
    'Your question': 'سؤالك',
    'No answer was captured for this question.': 'لم تُسجَّل أي إجابة لهذا السؤال.',
    'Feedback on your answer': 'ملاحظات على إجابتك',
    'Your answer, improved': 'إجابتك بعد التحسين',
    'Your facts and examples, told more strongly.': 'حقائقك وأمثلتك نفسها، بصياغة أقوى.',
    'Model answer to rehearse': 'إجابة نموذجية للتدرّب عليها',
    'A short, strong answer you could say out loud.': 'إجابة قصيرة وقوية يمكنك قولها بصوت عالٍ.',
    'The one change that matters most': 'التغيير الأهم',
    'Why the interviewer asks this': 'لماذا يطرح المحاور هذا السؤال',
    'What a strong answer covers': 'ما تتناوله الإجابة القوية',
    '{v0}/10': '{v0}/10',
    'Self Study · Interview Report': 'Self Study · تقرير المقابلة',
    'This interview was not finished, so the report covers only the questions that were answered.': 'لم تكتمل هذه المقابلة، لذا يغطي التقرير الأسئلة التي أُجيب عنها فقط.',
    'Generated {v0}': 'أُنشئ في {v0}',
    'Interview Report': 'تقرير المقابلة',
    'Interview type': 'نوع المقابلة',
    'Role / topic': 'الدور / الموضوع',
    'Questions answered': 'الأسئلة المُجاب عنها',
    'Attempt': 'المحاولة',
    'CV': 'السيرة الذاتية',
    'Technical Assessment': 'التقييم التقني',
    'Competency Assessment': 'تقييم الكفاءات',
    'HR': 'موارد بشرية',
    'Your own list': 'قائمتك الخاصة',
    'Your list, then the interviewer’s': 'قائمتك، ثم أسئلة المحاور',
    '{v0} min {v1} s': '{v0} د {v1} ث',
    'Structure': 'البنية',
    'Depth': 'العمق',
    'Download your report': 'نزّل تقريرك',
    'Preparing PDF…': 'جارٍ تجهيز ملف PDF…',
    'PDF': 'ملف PDF',
    'Preparing Word file…': 'جارٍ تجهيز ملف Word…',
    'Word (.docx)': 'ملف Word (.docx)',
    'The report could not be created. Please try again.': 'تعذّر إنشاء التقرير. يُرجى المحاولة مرة أخرى.',
    '{v0} out of {v1}': '{v0} من أصل {v1}',
    // What the interview report download includes (2026-10-19).
    'What to include': 'ما الذي تريد تضمينه',
    'Full report': 'التقرير الكامل',
    'Questions with strong answers': 'الأسئلة مع إجابات قوية',
    'Questions with your answers': 'الأسئلة مع إجاباتك',
    'Questions with your answers and strong answers': 'الأسئلة مع إجاباتك وإجابات قوية',
    'Questions & Strong Answers': 'الأسئلة والإجابات القوية',
    'Questions & Your Answers': 'الأسئلة وإجاباتك',
    'Your Answers & Strong Answers': 'إجاباتك والإجابات القوية',
    'Each question with a strong answer you can rehearse.': 'كل سؤال مع إجابة قوية يمكنك التدرّب عليها.',
    'Each question with the answer you gave, as it was transcribed.': 'كل سؤال مع الإجابة التي قدّمتها، كما دُوّنت.',
    'Each question with the answer you gave, and a strong answer to compare it with.': 'كل سؤال مع الإجابة التي قدّمتها، وإجابة قوية لتقارنها بها.',
    'Score, evaluation, action plan and full coaching for every question.': 'النتيجة والتقييم وخطة العمل والتوجيه الكامل لكل سؤال.',
    'A revision sheet: each question with a strong answer to rehearse.': 'ورقة مراجعة: كل سؤال مع إجابة قوية للتدرّب عليها.',
    'Each question with the answer you gave, exactly as it was transcribed.': 'كل سؤال مع الإجابة التي قدّمتها، تمامًا كما دُوّنت.',
    'Each question with your answer and a strong answer side by side.': 'كل سؤال مع إجابتك وإجابة قوية جنبًا إلى جنب.',
    'Strong answer': 'إجابة قوية',
    'No strong answer was written for this question.': 'لم تُكتب إجابة قوية لهذا السؤال.',
    // Pausing an answer, and repairing misheard words (2026-10-19).
    '⏸ paused': '⏸ متوقف مؤقتًا',
    '🗣️ hearing you…': '🗣️ أسمعك…',
    '🎤 listening…': '🎤 أستمع…',
    '✍️ transcribing…': '✍️ جارٍ التدوين…',
    'Stop the microphone and the clock so you can edit your answer': 'أوقف الميكروفون والمؤقت لتتمكن من تعديل إجابتك',
    '⏸ Pause': '⏸ إيقاف مؤقت',
    'Turn the microphone back on and carry on answering': 'أعد تشغيل الميكروفون وتابع الإجابة',
    '▶ Continue': '▶ متابعة',
    'Replace words the transcription misheard, using the question as context. Nothing is added or rewritten.': 'استبدال الكلمات التي أخطأ التدوين في سماعها، اعتمادًا على السؤال كسياق. لا يُضاف شيء ولا يُعاد صياغة شيء.',
    '✨ Checking your words…': '✨ جارٍ فحص كلماتك…',
    '✍️ Finishing transcription…': '✍️ جارٍ إنهاء التدوين…',
    '✨ Context enhancement using AI': '✨ تحسين السياق باستخدام الذكاء الاصطناعي',
    'Microphone level': 'مستوى الميكروفون',
    '↩︎ Undo': '↩︎ تراجع',
    'Paused — correct anything in your answer, then press Continue.': 'متوقف مؤقتًا — صحّح ما تريد في إجابتك، ثم اضغط «متابعة».',
    '🎤 Listening again — carry on with your answer.': '🎤 أستمع مجددًا — تابع إجابتك.',
    'The microphone could not be restarted. You can still type your answer.': 'تعذّر إعادة تشغيل الميكروفون. لا يزال بإمكانك كتابة إجابتك.',
    'The AI could not be reached just now. Your answer is unchanged — you can try again or fix words by hand.': 'تعذّر الوصول إلى الذكاء الاصطناعي الآن. إجابتك لم تتغيّر — يمكنك المحاولة مرة أخرى أو تصحيح الكلمات يدويًا.',
    'The AI suggested more than word fixes, so your answer was kept exactly as you said it.': 'اقترح الذكاء الاصطناعي أكثر من تصحيح كلمات، لذا بقيت إجابتك تمامًا كما قلتها.',
    'No misheard words found — your answer is unchanged.': 'لم يُعثر على كلمات أُسيء سماعها — إجابتك لم تتغيّر.',
    'Fixed {v0} misheard word(s):': 'تم تصحيح {v0} من الكلمات التي أُسيء سماعها:',
    // Toastmasters: pausing a speech, and repairing misheard words (2026-10-19).
    'Stop the microphone and the timer so you can edit your transcript': 'أوقف الميكروفون والمؤقت لتتمكن من تعديل النص',
    'Turn the microphone back on and carry on with your speech': 'أعد تشغيل الميكروفون وتابع خطابك',
    'Replace words the transcription misheard, using the topic as context. Filler words are kept, and nothing is added or rewritten.': 'استبدال الكلمات التي أخطأ التدوين في سماعها، اعتمادًا على الموضوع كسياق. تبقى كلمات الحشو كما هي، ولا يُضاف شيء ولا يُعاد صياغة شيء.',
    'Paused — correct anything in your transcript, then press Continue.': 'متوقف مؤقتًا — صحّح ما تريد في النص، ثم اضغط «متابعة».',
    '🎤 Listening again — carry on with your speech.': '🎤 أستمع مجددًا — تابع خطابك.',
    'The microphone could not be restarted. You can still type your speech.': 'تعذّر إعادة تشغيل الميكروفون. لا يزال بإمكانك كتابة خطابك.',
    'The AI could not be reached just now. Your transcript is unchanged — you can try again or fix words by hand.': 'تعذّر الوصول إلى الذكاء الاصطناعي الآن. النص لم يتغيّر — يمكنك المحاولة مرة أخرى أو تصحيح الكلمات يدويًا.',
    'The AI suggested more than word fixes, so your transcript was kept exactly as you said it.': 'اقترح الذكاء الاصطناعي أكثر من تصحيح كلمات، لذا بقي النص تمامًا كما قلته.',
    'No misheard words found — your transcript is unchanged.': 'لم يُعثر على كلمات أُسيء سماعها — النص لم يتغيّر.',

    // The desktop Interview Helper's download page (views/InterviewHelper.vue).
    "Interview Helper (Desktop)": "مساعد المقابلات (تطبيق سطح المكتب)",
    "Interview Helper": "مساعد المقابلات",
    "Interviewer": "المحاور",
    "Desktop app · Windows, macOS and Linux": "تطبيق سطح مكتب · Windows وmacOS وLinux",
    "Live help in real English job interviews. It listens to the interviewer on Zoom, Microsoft Teams or Google Meet and shows you a short answer in very simple English, with the question explained in Arabic.": "مساعدة مباشرة في مقابلات العمل الحقيقية باللغة الإنجليزية. يستمع التطبيق إلى المحاور على Zoom أو Microsoft Teams أو Google Meet، ويعرض لك إجابة قصيرة بإنجليزية بسيطة جدًا، مع شرح السؤال بالعربية.",
    "Download the Interview Helper": "نزّل مساعد المقابلات",
    "Get AI Features": "احصل على ميزات الذكاء الاصطناعي",
    "Your plan includes AI Features. Sign in to the app with your SelfStudyJo account.": "خطتك تتضمن ميزات الذكاء الاصطناعي. سجّل الدخول إلى التطبيق بحسابك في SelfStudyJo.",
    "Your plan does not include AI Features yet.": "خطتك لا تتضمن ميزات الذكاء الاصطناعي بعد.",
    "You need a SelfStudyJo account with an active subscription that includes AI Features.": "تحتاج إلى حساب في SelfStudyJo باشتراك فعّال يتضمن ميزات الذكاء الاصطناعي.",
    "How it helps you": "كيف يساعدك",
    "Hears the interviewer": "يسمع المحاور",
    "It listens to your computer audio during the call, and to your microphone, and writes down what is said.": "يستمع إلى صوت حاسوبك أثناء المكالمة وإلى الميكروفون، ويكتب ما يُقال.",
    "Fixes what it heard": "يصحّح ما سمعه",
    "Misheard words and broken grammar in the interviewer’s question are corrected automatically before an answer is written.": "تُصحَّح تلقائيًا الكلمات التي أُسيء سماعها والأخطاء النحوية في سؤال المحاور قبل كتابة الإجابة.",
    "Very simple English": "إنجليزية بسيطة جدًا",
    "Answers use short sentences and everyday words, written to be read and spoken easily by an Arabic speaker.": "تستخدم الإجابات جملًا قصيرة وكلمات يومية، وتُكتب ليسهل على المتحدث بالعربية قراءتها ونطقها.",
    "Answers in seconds": "إجابات خلال ثوانٍ",
    "Prepare answers to common HR questions before the interview. They appear instantly, then Self Study AI improves them for the exact question.": "حضّر قبل المقابلة إجابات لأسئلة الموارد البشرية الشائعة. تظهر فورًا، ثم يحسّنها Self Study AI لتناسب السؤال نفسه.",
    "Download for your computer": "نزّل التطبيق لحاسوبك",
    "Windows 10 or 11. Computer audio works out of the box.": "Windows 10 أو 11. يعمل التقاط صوت الحاسوب مباشرة.",
    "macOS 13 or newer, Intel or Apple Silicon. Allow Screen Recording once so the app can hear the call.": "macOS 13 أو أحدث، بمعالج Intel أو Apple Silicon. اسمح بتسجيل الشاشة مرة واحدة ليتمكن التطبيق من سماع المكالمة.",
    "Choose the “Monitor of …” device if computer audio is not offered.": "اختر جهاز «Monitor of …» إذا لم يظهر خيار صوت الحاسوب.",
    "All installers are on the releases page. The first time you open it, Windows may ask you to confirm (More info, then Run anyway) and on macOS right-click the app and choose Open.": "جميع ملفات التثبيت موجودة في صفحة الإصدارات. عند فتح التطبيق أول مرة قد يطلب Windows التأكيد (More info ثم Run anyway)، وفي macOS انقر بزر الفأرة الأيمن على التطبيق واختر Open.",
    "Open the releases page": "افتح صفحة الإصدارات",
    "How to use it": "طريقة الاستخدام",
    "Your privacy": "خصوصيتك",
    "Your profile, prepared answers and interview notes are saved only in a folder on your own computer. Audio is sent only while you are listening, as short speech segments, and is not stored on our servers.": "يُحفظ ملفك الشخصي وإجاباتك المحضّرة وملاحظات المقابلات في مجلد على حاسوبك فقط. ويُرسل الصوت أثناء الاستماع فقط، على شكل مقاطع كلام قصيرة، ولا يُخزَّن على خوادمنا.",
    // The download buttons (one per detected system) and the 3D guide (2026-10-29).
    "Download for Windows": "نزّل لنظام Windows",
    "Download for Mac (Apple Silicon)": "نزّل لجهاز Mac (Apple Silicon)",
    "Download for Mac (Intel)": "نزّل لجهاز Mac (Intel)",
    "Download for Linux": "نزّل لنظام Linux",
    "Intel Mac? Download the Intel version": "جهاز Mac بمعالج Intel؟ نزّل نسخة Intel",
    "Apple Silicon Mac (M1 and later)? Download that version": "جهاز Mac بمعالج Apple Silicon (M1 وما بعده)؟ نزّل تلك النسخة",
    "The Interview Helper runs on a computer. Open this page on your Windows, Mac or Linux computer to download it.": "يعمل مساعد المقابلات على الحاسوب. افتح هذه الصفحة على حاسوبك بنظام Windows أو Mac أو Linux لتنزيله.",
    "Other systems and versions": "أنظمة وإصدارات أخرى",
    "Windows installer (64-bit)": "ملف تثبيت Windows (64 بت)",
    "macOS, Apple Silicon (M1 and later)": "macOS، Apple Silicon (M1 وما بعده)",
    "macOS, Intel": "macOS، Intel",
    "Linux AppImage (any distribution)": "Linux AppImage (أي توزيعة)",
    "Debian / Ubuntu package": "حزمة Debian / Ubuntu",
    "Step {v0} of {v1}": "الخطوة {v0} من {v1}",
    "1. Download and install": "1. التنزيل والتثبيت",
    "Press the download button above. Your computer is detected, so you get the right installer. Open it and follow the installer.": "اضغط زر التنزيل في الأعلى. يُتعرَّف على نوع حاسوبك تلقائيًا فتحصل على ملف التثبيت المناسب. افتحه واتبع خطوات التثبيت.",
    "2. Sign in": "2. تسجيل الدخول",
    "Open the app and sign in with your SelfStudyJo account. Your plan must include AI Features.": "افتح التطبيق وسجّل الدخول بحسابك في SelfStudyJo. يجب أن تتضمن خطتك ميزات الذكاء الاصطناعي.",
    "3. Set up the interview": "3. إعداد المقابلة",
    "Write the job title and paste your CV. The app prepares a short pitch, your strengths and stories taken only from your CV.": "اكتب المسمى الوظيفي والصق سيرتك الذاتية. يحضّر التطبيق تعريفًا قصيرًا بك ونقاط قوتك وقصصًا مأخوذة من سيرتك الذاتية فقط.",
    "4. Join the call": "4. انضم إلى المكالمة",
    "Join the interview on Zoom, Microsoft Teams or Google Meet and press Start. The app hears the interviewer through your computer audio. Use headphones.": "انضم إلى المقابلة على Zoom أو Microsoft Teams أو Google Meet واضغط «ابدأ». يسمع التطبيق المحاور عبر صوت حاسوبك. استخدم سماعات الرأس.",
    "5. Read the answer": "5. اقرأ الإجابة",
    "When the interviewer finishes a question, the answer appears in very simple English in the READ THIS NOW box, with the question in Arabic above it. Say it in your own voice.": "عندما ينهي المحاور سؤاله، تظهر الإجابة بإنجليزية بسيطة جدًا في مربع READ THIS NOW، والسؤال بالعربية فوقه. قلها بصوتك.",
    "6. Get feedback": "6. احصل على التقييم",
    "When the interview is over, press End. You get a score, your strengths, what to improve and a better answer for each question. Every interview is saved on your computer.": "عند انتهاء المقابلة، اضغط «إنهاء». تحصل على درجة ونقاط قوتك وما يجب تحسينه وإجابة أفضل لكل سؤال. تُحفظ كل مقابلة على حاسوبك.",
};

export default speaking;
