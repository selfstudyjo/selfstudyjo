/**
 * Arabic — the site assistant, who is two people.
 *
 * ITS OWN AREA, for the reason the index gives: the right translation of a word
 * depends on the words around it. "Assistant" here is `مساعِد` — a person who
 * helps — and not `مُساعَدة` (the abstract noun) nor `الدعم` (which on this
 * platform is the human support widget in the corner of every page, app 9, and
 * conflating the two would have readers waiting for a person to reply).
 * "Listening" is `أستمع`, the deliberate act, not `أسمع`. Alphabetically sorted
 * between `Assignments` and `Attempts` there would be nothing to go on.
 *
 * REGISTER. Modern Standard Arabic, and FIRST PERSON throughout, because the
 * assistant speaks as themself: `أستطيع`, `لم أتمكّن`. The refusal is the one
 * place to be plain rather than elaborate — a student who has just been told no
 * needs to understand immediately what is being offered instead, and `الحلّ`
 * (working it out) is named as the thing that teaches, which is the argument.
 *
 * GENDER IS THE HARD PART HERE, and it is why several of these read oddly if
 * you compare them with the English. There are TWO assistants and they
 * alternate — نور on one visit, عمر on the next — so any sentence Arabic forces
 * a gender on is a sentence that is wrong half the time. `جاهزة للمساعدة` is
 * feminine and `جاهز` is masculine; `في الخدمة` is neither, and that is why it
 * is what the plate says. Same for `قيد التفكير` over `تفكّر`/`يفكّر`. First
 * person carries most of the rest for free, which is the other reason the
 * register is what it is.
 *
 * THE NAMES ARE TRANSLITERATED, NOT TRANSLATED. `نور` is not "light" and `عمر`
 * is not a lifespan. Working rule 41 refuses to translate a PERSON's name
 * because that is putting words in somebody's mouth; these are the platform's
 * own characters, and the newscast already puts آدم and ليلى on its plates.
 *
 * DIGITS. Latin, as everywhere else — see `formatNumber`.
 */

const assistant: Record<string, string> = {
    // ── the two of them, by name ────────────────────────────────────────────
    //
    // TRANSLITERATED, not translated. `نور` is not "light" and `عمر` is not a
    // lifespan: they are names, and the newscast already puts آدم and ليلى on
    // its plates for the same reason. Working rule 41 refuses to translate a
    // PERSON's name because that is putting words in somebody's mouth; these
    // are the platform's own characters, and leaving them Latin would drop a
    // left-to-right run into the middle of every Arabic greeting.
    'Noor': 'نور',
    'Omar': 'عمر',

    // ── the button and the window ───────────────────────────────────────────
    'Assistant': 'المساعِد',
    // `{bot}` is whoever is on duty, already translated by the caller.
    'Ask {bot}, the site assistant': 'اسأل {bot}، مساعِد الموقع',
    'Ask me anything about Self Study Jo…': 'اسألني أي شيء عن Self Study Jo…',
    '{bot} is thinking': '{bot} قيد التفكير',
    'Talk to {bot}': 'تحدّث إلى {bot}',
    'Stop listening': 'أوقِف الاستماع',
    'Voice on': 'الصوت مُفعَّل',
    'Voice off': 'الصوت مُعطَّل',
    // `{v0}` is the destination's own name, and Arabic puts it after the verb.
    'Open {v0}': 'افتح {v0}',

    // ── the plate under the face ────────────────────────────────────────────
    // Also gender-neutral for the same reason - `جاهزة` is feminine.
    'here to help': 'في الخدمة',
    'thinking…': 'قيد التفكير…',
    'speaking': 'قيد التحدّث',
    'listening…': 'قيد الاستماع…',

    // ── what she opens with ─────────────────────────────────────────────────
    'Hi {name} — I am {bot}. Ask me about anything on Self Study Jo, or tell me where you want to go and I will take you there.':
        'مرحبًا {name} — أنا {bot}. اسألني عن أي شيء في Self Study Jo، أو أخبرني إلى أين تريد الذهاب وسآخذك إليه.',
    'Hi — I am {bot}, the Self Study Jo assistant. Ask me what the platform does or where to find something. Sign in and I can look up your own results too.':
        'مرحبًا — أنا {bot}، مساعِد Self Study Jo. اسألني عمّا تقدّمه المنصّة أو عن مكان أي شيء فيها. وبعد تسجيل الدخول أستطيع أيضًا الاطّلاع على نتائجك.',

    // ── the suggestion chips ────────────────────────────────────────────────
    'What is Self Study Jo?': 'ما هي Self Study Jo؟',
    'Show me my quiz results': 'اعرض لي نتائج الاختبارات القصيرة',
    'Take me to the labs': 'خذني إلى المختبرات',
    'When does my plan expire?': 'متى تنتهي صلاحية اشتراكي؟',
    'What can I learn here?': 'ماذا يمكنني أن أتعلّم هنا؟',
    'Take me to the courses': 'خذني إلى الدورات',
    'How do the labs work?': 'كيف تعمل المختبرات؟',

    // ── the one thing she will not do ───────────────────────────────────────
    'I can help you find your way around and look things up, but I do not answer exam, quiz, lab or homework questions — working them out is the part that teaches you something. I can open the lesson, the runbook or the lab brief that covers it. If you meant something else, ask me again in other words.':
        'أستطيع مساعدتك في التنقّل داخل المنصّة والبحث عن المعلومات، لكنّني لا أجيب عن أسئلة الامتحانات أو الاختبارات القصيرة أو المختبرات أو الواجبات — فحلّها بنفسك هو الجزء الذي تتعلّم منه. يمكنني أن أفتح لك الدرس أو دليل التنفيذ أو وصف المختبر الذي يغطّي الموضوع. وإن كنت تقصد شيئًا آخر، فأعِد سؤالي بصيغة مختلفة.',

    // ── when something goes wrong ───────────────────────────────────────────
    // Deliberately does NOT say "permission denied": `getUserMedia` has at
    // least six distinct failures and only one of them is a refusal.
    'I could not open your microphone. Check that one is connected, that this site is allowed to use it, and that another application is not holding it.':
        'لم أتمكّن من تشغيل الميكروفون. تأكّد من توصيله، ومن السماح لهذا الموقع باستخدامه، ومن عدم استخدام تطبيق آخر له في الوقت نفسه.',
    'I did not get an answer that time. Ask me again?':
        'لم تصلني إجابة هذه المرّة. هل تعيد سؤالي؟',
    'The assistant is out of capacity just now. Try again in a moment.':
        'المساعِد مشغول بالكامل في الوقت الحالي. حاول مرّة أخرى بعد قليل.',
    'I could not reach the assistant service. Check your connection and try again.':
        'تعذّر الوصول إلى خدمة المساعِد. تحقّق من اتصالك ثم حاول مرّة أخرى.',
};

export default assistant;
