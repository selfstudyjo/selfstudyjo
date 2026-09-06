/**
 * The CV Builder, the drawing papers, the AI chat and the newscast chrome —
 * Arabic.
 *
 * ============================================================
 * THE CV BUILDER'S WARNINGS ARE TRANSLATED IN FULL, ON PURPOSE
 * ============================================================
 *
 * Most of the long strings in this file are the CV Builder telling somebody
 * what the AI did and did NOT do to their CV — that nothing about their history
 * was invented, that a certificate is never added for them because employers
 * check them, that the square-bracketed gaps are facts only they can supply.
 *
 * Those are not marketing copy. They are the difference between a candidate
 * sending out a CV they can defend in an interview and one they cannot, and the
 * reader most at risk is exactly the one who cannot read the English version.
 * So none of them is shortened, and where Arabic needs more words than English
 * they are spent.
 *
 * ============================================================
 * THE NEWSCAST IS A SPECIAL CASE AND ONLY PART OF IT IS HERE
 * ============================================================
 *
 * The newscast has had its own bilingual phrase table since it was built —
 * `PHRASES` in `newscastEngine.ts`, keyed `en` / `ar`, carrying the studio
 * furniture and the anchors' own names. That table is about the BULLETIN's
 * language, which is not the same question as the site's: the bulletins
 * themselves are scraped by Airflow from RT and Al Jazeera in Arabic and
 * English and there is no Chinese one to read.
 *
 * So the two stay separate and mean different things — `PHRASES` gained a `zh`
 * entry so a Chinese reader gets Chinese studio furniture, and the bulletin
 * language selector still offers the two languages that have bulletins. Only
 * the page's own chrome is in this file.
 */

import type { Catalogue } from '../../index';

const tools: Catalogue = {
    /* ---------------------------------------------------------------- *
     * AI Chat (app 27)
     * ---------------------------------------------------------------- */
    'AI Chat Assistant': 'مساعد الذكاء الاصطناعي',
    'Ask me anything about your courses, labs, or general knowledge':
        'اسألني أي شيء عن دوراتك أو معاملك أو أي معرفة عامة',

    /* The saved conversations, and the memory each one carries. */
    'New chat': 'محادثة جديدة',
    'Your chats': 'محادثاتك',
    'Search chats': 'ابحث في المحادثات',
    'No chats yet. Start one and it will be saved here.': 'لا محادثات بعد. ابدأ واحدة وستُحفظ هنا.',
    'No chats match that search.': 'لا محادثات تطابق هذا البحث.',
    'Name this chat': 'سمِّ هذه المحادثة',
    'Rename': 'إعادة تسمية',
    'Pin': 'تثبيت',
    'Unpin': 'إلغاء التثبيت',
    'Pinned': 'المثبّتة',
    'Yesterday': 'أمس',
    'Previous 7 days': 'آخر 7 أيام',
    'Previous 30 days': 'آخر 30 يوماً',
    'Older': 'أقدم',
    'Delete this chat and everything in it?': 'هل تريد حذف هذه المحادثة وكل ما فيها؟',
    'Could not load your chats.': 'تعذّر تحميل محادثاتك.',
    'Could not open that chat.': 'تعذّر فتح تلك المحادثة.',
    'Could not start a new chat.': 'تعذّر بدء محادثة جديدة.',
    'Could not rename that chat.': 'تعذّرت إعادة تسمية تلك المحادثة.',
    'Could not delete that chat.': 'تعذّر حذف تلك المحادثة.',
    'Could not send that message.': 'تعذّر إرسال تلك الرسالة.',
    'Could not clear that chat.': 'تعذّر مسح تلك المحادثة.',
    'Could not save that.': 'تعذّر الحفظ.',
    'What are you working on?': 'على ماذا تعمل؟',
    'Everything you say here is saved, and the assistant will remember the project next time you open this chat.':
        'كل ما تكتبه هنا محفوظ، وسيتذكّر المساعد المشروع في المرة القادمة التي تفتح فيها هذه المحادثة.',
    'Type your message… (Enter to send, Shift+Enter for a new line)':
        'اكتب رسالتك… (Enter للإرسال، Shift+Enter لسطر جديد)',
    'Thinking…': 'يفكّر…',
    'Copy code': 'نسخ الشيفرة',
    'Memory': 'الذاكرة',
    'What you are working on': 'ما الذي تعمل عليه',
    'The assistant fills this in as you talk. Edit it to correct what it remembers.':
        'يملأ المساعد هذا الحقل أثناء حديثكما. عدّله لتصحيح ما يتذكّره.',
    'Update from this chat': 'حدّث من هذه المحادثة',
    'Updating…': 'جارٍ التحديث…',
    'Clear chat': 'مسح المحادثة',
    'Clear every message here, and what the assistant remembers?':
        'هل تريد مسح كل الرسائل هنا وما يتذكّره المساعد؟',
    'The assistant is updating what it remembers from this chat.':
        'يقوم المساعد بتحديث ما يتذكّره من هذه المحادثة.',
    'Earlier in this chat': 'سابقاً في هذه المحادثة',
    'The assistant remembers this project': 'يتذكّر المساعد هذا المشروع',
    'Could not read what the assistant remembers.': 'تعذّرت قراءة ما يتذكّره المساعد.',
    'The assistant could not be reached. Nothing was changed.':
        'تعذّر الوصول إلى المساعد. لم يتغيّر شيء.',
    'The assistant could not be reached. Your message was saved — try again.':
        'تعذّر الوصول إلى المساعد. حُفظت رسالتك — أعد المحاولة.',
    'Nothing yet — the assistant learns what you are working on as you go.':
        'لا شيء بعد — يتعرّف المساعد على ما تعمل عليه أثناء الحديث.',
    'The assistant can see all {v0} messages in this chat.':
        'يرى المساعد كل الرسائل في هذه المحادثة وعددها {v0}.',
    'The assistant reads the last {v0} messages in full, and remembers the {v1} before them as notes.':
        'يقرأ المساعد آخر {v0} رسالة كاملةً، ويتذكّر الـ {v1} السابقة لها على شكل ملاحظات.',

    /* ---------------------------------------------------------------- *
     * The newscast page's own chrome
     * ---------------------------------------------------------------- */
    'No headlines yet.': 'لا عناوين بعد.',

    /* ---------------------------------------------------------------- *
     * Drawing papers (app 34)
     * ---------------------------------------------------------------- */
    'Drawing papers': 'أوراق الرسم',
    'A shared whiteboard for lessons, diagrams and working through a problem. Papers are private until you share them — free with your account, no subscription needed.':
        'لوح مشترك للدروس والرسوم التوضيحية وحلّ المسائل. الأوراق خاصة حتى تشاركها — مجاناً مع حسابك، بلا اشتراك.',
    'New paper': 'ورقة جديدة',
    'No papers yet.': 'لا توجد أوراق بعد.',
    'Create your first paper': 'أنشئ ورقتك الأولى',
    'Open a blank paper and start drawing — pen, shapes, text and sticky notes.':
        'افتح ورقة فارغة وابدأ الرسم — قلم وأشكال ونصوص وملاحظات لاصقة.',
    'Paper': 'ورقة',
    'Blank': 'فارغة',
    'Algebra — week 3': 'الجبر — الأسبوع الثالث',
    'Shared with me': 'مشتركة معي',
    'Shared with {v0}': 'مشتركة مع {v0}',
    'Size': 'الحجم',
    /*
     * TWO WHOLE SENTENCES rather than a sentence with a value in it.
     * `Link: {v0}` was the key and the value interpolated into it was a
     * bare English `can view` / `can edit`, so an Arabic reader got
     * `الرابط: can view` - the outer key was translated and the
     * fragment inside it never was. Split, because a two-word verb phrase
     * handed to a translator on its own has no grammar to agree with.
     */
    'Link: can view': 'الرابط: للاطلاع',
    'Link: can edit': 'الرابط: للتعديل',
    'You can edit': 'يمكنك التعديل',
    '{v0} · edited {v1}': '{v0} · عُدِّلت {v1}',
    '{v0} item{v1} · edited {v2}': '{v0} عنصراً · عُدِّلت {v2}',
    'Delete “{v0}”?': 'حذف “{v0}”؟',
    'This removes the paper and everything drawn on it, for everyone it is shared with. It cannot be undone.':
        'يحذف هذا الورقة وكل ما رُسم عليها، لكل من شوركت معه. ولا يمكن التراجع عنه.',
    'Keep it': 'أبقِها',

    'Opening the paper…': 'جارٍ فتح الورقة…',
    'Opening the shared paper…': 'جارٍ فتح الورقة المشتركة…',
    'Paper title': 'عنوان الورقة',
    'Back to my papers': 'رجوع إلى أوراقي',
    'Back to papers': 'رجوع إلى الأوراق',
    'Save a copy to my papers': 'حفظ نسخة في أوراقي',
    'Clear the paper': 'مسح الورقة',
    'Clear this paper?': 'مسح هذه الورقة؟',
    'Everything drawn on it will be erased, for everyone. Undo can bring it back while this tab stays open.':
        'سيُمحى كل ما رُسم عليها، للجميع. ويمكن للتراجع استعادته ما دام هذا التبويب مفتوحاً.',
    'This paper is private, or it is no longer shared with you. Ask whoever owns it to share it again.':
        'هذه الورقة خاصة، أو لم تعد مشتركة معك. اطلب من مالكها مشاركتها من جديد.',

    'Undo (Ctrl Z)': 'تراجع (Ctrl Z)',
    'Redo (Ctrl Shift Z)': 'إعادة (Ctrl Shift Z)',
    'Fit to screen (Ctrl 0)': 'ملاءمة الشاشة (Ctrl 0)',
    'Clear the page': 'مسح الصفحة',
    'Fill': 'التعبئة',
    'No fill': 'بلا تعبئة',
    'Any colour': 'أي لون',

    'Share this paper': 'مشاركة هذه الورقة',
    'Share “{v0}”': 'مشاركة “{v0}”',
    'Who has access': 'من له حق الوصول',
    'Add a person': 'إضافة شخص',
    'Add as {v0}': 'إضافة بصفة {v0}',
    'Search by username, name or email': 'ابحث باسم المستخدم أو الاسم أو البريد الإلكتروني',
    'Searching…': 'جارٍ البحث…',
    'Permission': 'الصلاحية',
    'Can view': 'يمكنه العرض',
    'Owner — can edit, share and delete': 'المالك — يمكنه التعديل والمشاركة والحذف',
    'Only people you add can open this paper.': 'لا يمكن فتح هذه الورقة إلا لمن تضيفهم.',
    'Link access': 'الوصول بالرابط',
    'Share link': 'رابط المشاركة',
    'New link': 'رابط جديد',
    'No link — private': 'بلا رابط — خاصة',
    'Anyone with the link': 'أي شخص يملك الرابط',
    'Anyone with the link can view': 'أي شخص يملك الرابط يمكنه العرض',
    'Anyone with the link can edit': 'أي شخص يملك الرابط يمكنه التعديل',
    'Anyone holding this link can open the paper without signing in. Turning the link off or making a new one stops the old one working immediately.':
        'يمكن لأي شخص يملك هذا الرابط فتح الورقة دون تسجيل الدخول. وإيقاف الرابط أو إنشاء رابط جديد يوقف عمل القديم فوراً.',
    'Invalidate the old link and make a new one': 'إبطال الرابط القديم وإنشاء رابط جديد',
    'Done': 'تم',

    /* ---------------------------------------------------------------- *
     * CV Builder (app 33) — the library
     * ---------------------------------------------------------------- */
    'Import, dictate, tailor and download a professional CV — every version saved to your account.':
        'استورد سيرتك أو أملِها صوتياً أو صمّمها لوظيفة معيّنة ثم نزّلها — وكل نسخة محفوظة في حسابك.',
    'CVs': 'السِّيَر الذاتية',
    'Loading your CVs…': 'جارٍ تحميل سيرك الذاتية…',
    'You have no CVs yet. Upload one, dictate one, or start from blank — all three end up in the same editor.':
        'ليست لديك سِيَر ذاتية بعد. ارفع واحدة أو أملِها صوتياً أو ابدأ من صفحة فارغة — وتنتهي الطرق الثلاث إلى المحرّر نفسه.',
    'Search by title, name or role…': 'ابحث بالعنوان أو الاسم أو الدور…',
    'Average completeness': 'متوسّط الاكتمال',
    'Best job match': 'أفضل مطابقة لوظيفة',
    'Tailored to a job': 'مصمَّمة لوظيفة',
    'Tailored{v0}': 'مصمَّمة{v0}',
    '{v0} · updated {v1}': '{v0} · حُدِّثت {v1}',
    '{v0}% complete · {v1} role{v2} · {v3} skill{v4} · {v5} words':
        '{v0}% مكتملة · {v1} دوراً · {v3} مهارة · {v5} كلمة',
    'Upload your current CV': 'ارفع سيرتك الذاتية الحالية',
    'PDF or DOCX. The AI reads it, pulls out every role, date and skill, and hands you an editable CV you can then enhance.':
        'بصيغة PDF أو DOCX. يقرؤها الذكاء الاصطناعي ويستخرج كل دور وتاريخ ومهارة، ويعطيك سيرة قابلة للتعديل يمكنك تحسينها بعد ذلك.',
    'Choose a file': 'اختر ملفاً',
    'or drop it here': 'أو أفلته هنا',
    'PDF, DOCX or TXT · up to 12 MB': 'PDF أو DOCX أو TXT · حتى 12 ميغابايت',
    'Paste text instead': 'الصق النص بدلاً من ذلك',
    'Paste CV text': 'الصق نص السيرة الذاتية',
    'Already have your history written down — in an email, a LinkedIn export, a note? Paste it and the AI structures it the same way.':
        'هل خبرتك مكتوبة بالفعل — في بريد إلكتروني أو تصدير من LinkedIn أو ملاحظة؟ الصقها وسيرتّبها الذكاء الاصطناعي بالطريقة نفسها.',
    'See the text we read from your file ({v0} words)': 'اعرض النص الذي قرأناه من ملفك ({v0} كلمة)',
    'Build it by talking': 'أنشئها بالكلام',
    'No CV to start from? Describe your experience out loud for a minute or two and the AI writes the whole thing. Add a photo and pick a template afterwards.':
        'لا سيرة ذاتية تبدأ منها؟ اوصف خبرتك بصوتك لدقيقة أو دقيقتين وسيكتبها الذكاء الاصطناعي كاملةً. ثم أضف صورة واختر قالباً.',
    'Start the voice builder': 'ابدأ الإنشاء الصوتي',
    'Keep going — about 60 characters of speech is the minimum.': 'تابع — الحد الأدنى نحو 60 حرفاً من الكلام.',
    'Build from a job description': 'أنشئها من وصف وظيفي',
    'Start from the job you want': 'ابدأ من الوظيفة التي تريدها',
    'No CV at all? Paste the advert and the AI writes a complete draft aimed at that role — the right sections, the posting\'s skills, and real bullets you edit. Anything it cannot know about you is left in':
        'لا سيرة ذاتية على الإطلاق؟ الصق الإعلان وسيكتب الذكاء الاصطناعي مسوّدة كاملة موجَّهة لذلك الدور — بالأقسام المناسبة، ومهارات الإعلان، ونقاط حقيقية تعدّلها أنت. وكل ما لا يمكن أن يعرفه عنك يُترك بين',
    'for you to fill in.': 'لتُكمله أنت.',
    'Leave it empty and you get a scaffold to fill in. Nothing is ever invented about you — no employer, date, degree or certificate the AI has not been told.':
        'اتركه فارغاً وستحصل على هيكل تُكمله. ولا يُختلق عنك شيء أبداً — لا جهة عمل ولا تاريخ ولا شهادة ولا مؤهّل لم يُخبَر به الذكاء الاصطناعي.',
    'Copy “{v0}”': 'نسخ “{v0}”',
    'Name for the copy': 'اسم النسخة',
    'The copy is a separate CV — editing it never touches the original. Give it a name you will recognise in the list.':
        'النسخة سيرة ذاتية مستقلّة — وتعديلها لا يمسّ الأصل. أعطها اسماً تعرفه في القائمة.',
    'Download “{v0}”': 'تنزيل “{v0}”',
    'Name the file. Six applications means six PDFs in one downloads folder, and every one of them is called after you unless you say otherwise.':
        'سمِّ الملف. ستّ طلبات توظيف تعني ستّة ملفات PDF في مجلّد تنزيلات واحد، وكلّها باسمك ما لم تحدّد غير ذلك.',
    'Delete this CV?': 'حذف هذه السيرة الذاتية؟',
    '“{v0}” will be removed from your CV Builder. This cannot be undone from here.':
        'ستُزال “{v0}” من منشئ سيرتك الذاتية. ولا يمكن التراجع عن ذلك من هنا.',
    'Every template renders identically in PDF and DOCX. You can switch template on any CV at any time — it never changes your content.':
        'كل قالب يُخرَج بالشكل نفسه في PDF وDOCX. ويمكنك تبديل القالب في أي سيرة في أي وقت — ولا يغيّر ذلك محتواك أبداً.',
    'Heads up:': 'تنبيه:',

    /* ---------------------------------------------------------------- *
     * CV Builder — the editor
     * ---------------------------------------------------------------- */
    'Loading your CV…': 'جارٍ تحميل سيرتك الذاتية…',
    'Back to my CVs': 'رجوع إلى سيري الذاتية',
    'CV title': 'عنوان السيرة الذاتية',
    'Download this CV': 'تنزيل هذه السيرة الذاتية',
    'Rendered on the server from the template you can see, including edits you have not saved. Name the file so you can tell this application from the next one.':
        'يُخرَج على الخادم من القالب الذي تراه، بما في ذلك التعديلات غير المحفوظة. سمِّ الملف لتميّز هذا الطلب من الذي يليه.',
    'The download is rendered on the server from this same template, so the file matches what you see here. Unsaved edits are included in the download.':
        'يُخرَج التنزيل على الخادم من القالب نفسه، فيطابق الملف ما تراه هنا. والتعديلات غير المحفوظة مضمّنة في التنزيل.',
    '{v0}% complete · {v1} words': '{v0}% مكتملة · {v1} كلمة',
    'Sections': 'الأقسام',
    'Drag-free ordering: move a section up or down, or hide it. Hidden sections keep their content — they just do not print.':
        'ترتيب بلا سحب: حرّك القسم أعلى أو أسفل، أو أخفِه. الأقسام المخفيّة تحفظ محتواها — لكنها لا تُطبع.',
    'Move up': 'تحريك للأعلى',
    'Move down': 'تحريك للأسفل',
    'Personal details': 'المعلومات الشخصية',
    'Full name': 'الاسم الكامل',
    'Professional title': 'المسمّى المهني',
    'Professional summary': 'الملخّص المهني',
    '{v0} characters. Recruiters read this first and often only this.':
        '{v0} حرفاً. يقرأ المسؤولون عن التوظيف هذا أولاً، وغالباً لا يقرؤون غيره.',
    'Phone': 'الهاتف',
    'Location': 'الموقع',
    'Link': 'الرابط',
    'Experience': 'الخبرة العملية',
    'Job title': 'المسمّى الوظيفي',
    'Company': 'الشركة',
    'Dates': 'التواريخ',
    'I still work here': 'ما زلت أعمل هنا',
    'What you did — one per line': 'ما قمت به — واحد في كل سطر',
    'What you achieved — one per line': 'ما أنجزته — واحد في كل سطر',
    'Highlights — one per line': 'أبرز النقاط — واحدة في كل سطر',
    'Title & company': 'المسمّى والشركة',
    'No roles yet. Add one, or import a CV and the AI fills this in for you.':
        'لا أدوار بعد. أضف واحداً، أو استورد سيرة ذاتية وسيُكمل الذكاء الاصطناعي هذا لك.',
    '+ Add role': '+ إضافة دور',
    '+ Add group': '+ إضافة مجموعة',
    'Group name — optional': 'اسم المجموعة — اختياري',
    'Education': 'التعليم',
    'Qualification': 'المؤهّل',
    'Organisation': 'المؤسسة',
    'Grade': 'التقدير',
    'Level': 'المستوى',
    'Issuer': 'الجهة المانحة',
    'Skills': 'المهارات',
    'Skills — comma separated': 'المهارات — مفصولة بفواصل',
    'Tech — comma separated': 'التقنيات — مفصولة بفواصل',
    'Tools and technologies — comma separated': 'الأدوات والتقنيات — مفصولة بفواصل',
    'Interests — comma separated': 'الاهتمامات — مفصولة بفواصل',
    'Projects': 'المشاريع',
    'Certifications': 'الشهادات المهنية',
    'Languages': 'اللغات',
    'Awards': 'الجوائز',
    'Award': 'جائزة',
    'Volunteering': 'العمل التطوّعي',
    'Extras': 'إضافات',
    'Certifications, licences and degrees are never written in for you because employers verify them. Add any you genuinely hold in the editor.':
        'لا تُكتب لك الشهادات المهنية والتراخيص والدرجات العلمية أبداً، لأن جهات العمل تتحقّق منها. أضف ما تحمله منها فعلاً في المحرّر.',
    'Never added for you — a certificate is checked.': 'لا تُضاف لك أبداً — فالشهادة يُتحقَّق منها.',

    /* CV Builder — the AI actions, and the honesty around them. */
    'Enhance into a copy': 'تحسين في نسخة',
    'The AI sharpens your wording, turns responsibilities into achievements and fixes the grammar. It will not add a job, a date, a degree or a metric you did not write — if it appears to, treat that as a bug and tell us.':
        'يشذّب الذكاء الاصطناعي صياغتك، ويحوّل المسؤوليات إلى إنجازات، ويصحّح القواعد. ولن يضيف وظيفة أو تاريخاً أو درجة أو رقماً لم تكتبه أنت — وإن بدا أنه فعل، فاعتبر ذلك خللاً وأخبرنا به.',
    'Get it reviewed': 'اطلب مراجعتها',
    'A recruiter-style critique. It changes nothing — it tells you what a screener would notice in the 30 seconds they spend.':
        'نقد بأسلوب مسؤول التوظيف. لا يغيّر شيئاً — بل يخبرك بما سيلاحظه المُفرِز في الثلاثين ثانية التي يمنحها لسيرتك.',
    'Match this CV to a job': 'طابق هذه السيرة مع وظيفة',
    'Paste the job description and the AI rewrites the CV to answer it — writing the posting\'s required skills, tools and technologies into your skills section and into the roles where that work belongs, then rewriting your summary and headline to target the title. Everything it adds is listed below for you to review.':
        'الصق الوصف الوظيفي وسيعيد الذكاء الاصطناعي كتابة السيرة لتجيب عنه — بإدراج المهارات والأدوات والتقنيات المطلوبة في الإعلان داخل قسم مهاراتك وداخل الأدوار التي ينتمي إليها ذلك العمل، ثم إعادة كتابة ملخّصك وعنوانك لاستهداف المسمّى. وكل ما يضيفه مدرَج أدناه لمراجعتك.',
    'Reading the posting and rewriting your CV against it — this usually takes a few seconds. Your CV is saved either way.':
        'جارٍ قراءة الإعلان وإعادة كتابة سيرتك في مقابله — يستغرق هذا عادةً ثوانٍ قليلة. وسيرتك محفوظة في كل الأحوال.',
    'Tailoring into a copy keeps this CV as your general one.': 'التصميم في نسخة يُبقي هذه السيرة سيرتك العامة.',
    'Target role — optional': 'الدور المستهدف — اختياري',
    'Anything specific to change — optional': 'أي شيء محدَّد تريد تغييره — اختياري',
    'Tone': 'النبرة',
    'Professional — the default': 'مهنية — الافتراضية',
    'Concise — cut every spare word': 'موجزة — احذف كل كلمة زائدة',
    'Impact-first — lead with outcomes': 'بالأثر أولاً — ابدأ بالنتائج',
    'Academic — formal and precise': 'أكاديمية — رسمية ودقيقة',
    'Add to this CV by talking': 'أضف إلى هذه السيرة بالكلام',
    'Dictate the experience you want on this CV. The AI rewrites the CV from what you say — so use this when you want to rebuild the content, not to add a single line.':
        'أملِ الخبرة التي تريدها في هذه السيرة. يعيد الذكاء الاصطناعي كتابة السيرة من كلامك — فاستخدم هذا حين تريد إعادة بناء المحتوى، لا لإضافة سطر واحد.',
    'Replace this CV\'s content': 'استبدال محتوى هذه السيرة',
    'Rewrite the whole CV': 'إعادة كتابة السيرة كاملةً',
    'Your current content will be replaced': 'سيُستبدل محتواك الحالي',
    ', or use “as a new CV” to keep it.': '، أو استخدم «كسيرة جديدة» للإبقاء عليه.',
    'Confirm before you send this': 'تحقّق قبل إرسال هذه السيرة',
    'What the AI changed': 'ما غيّره الذكاء الاصطناعي',
    'Added to your CV — review these': 'أُضيف إلى سيرتك — راجع هذه',
    'Read the “Added to your CV” list before you apply and delete anything you cannot stand behind in an interview. Credentials — certifications, licences, degrees — are never added for you, because they are checked.':
        'اقرأ قائمة «أُضيف إلى سيرتك» قبل التقديم واحذف كل ما لا تستطيع الدفاع عنه في مقابلة. أما المؤهّلات — الشهادات المهنية والتراخيص والدرجات — فلا تُضاف لك أبداً، لأنه يُتحقَّق منها.',
    'Open the editor tabs and delete anything here you could not defend in an interview — you are the last check on this list.':
        'افتح تبويبات المحرّر واحذف من هنا كل ما لا تستطيع الدفاع عنه في مقابلة — فأنت آخر مدقّق على هذه القائمة.',
    'Still missing — only you can add these': 'ما زال ناقصاً — لا يستطيع إضافته إلا أنت',
    '{v0} detail{v1} still in square brackets.': '{v0} تفصيلاً ما زال بين أقواس مربّعة.',
    'Nothing about your history was invented, so each one is a fact only you can supply. Replace them all before you send this CV anywhere.':
        'لم يُختلق شيء عن خبرتك، فكل واحد منها معلومة لا يمكن أن يقدّمها غيرك. استبدلها كلها قبل إرسال هذه السيرة إلى أي جهة.',
    'No blanks left. Read it through anyway — the bullets were written from the advert, so they describe the job rather than what you actually did.':
        'لا فراغات متبقّية. اقرأها كاملةً على أي حال — فالنقاط كُتبت من الإعلان، أي أنها تصف الوظيفة لا ما قمت به فعلاً.',
    'Drafted from this job ad': 'صيغت من هذا الإعلان الوظيفي',
    'Match report': 'تقرير المطابقة',
    '{v0}% job match': '{v0}% مطابقة للوظيفة',
    'was {v0}%': 'كانت {v0}%',
    'tailored {v0}': 'صُمّمت {v0}',
    'Why you fit': 'لماذا أنت مناسب',
    'Gaps': 'الفجوات',
    'Quick wins': 'مكاسب سريعة',
    'Working well': 'ما ينجح جيداً',
    'What to do about it': 'ما العمل بشأنه',
    'What to do next': 'الخطوة التالية',
    'Credentials this role asks for': 'المؤهّلات التي يطلبها هذا الدور',
    'Already evidenced': 'مُثبَتة بالفعل',
    'ATS notes': 'ملاحظات أنظمة تتبّع المتقدّمين',
    'ATS-safe': 'متوافقة مع أنظمة التتبّع',
    'AI is unavailable on this replica': 'الذكاء الاصطناعي غير متاح على هذه النسخة',
    'No AI provider key is configured on the CV Builder service, so enhancing, reviewing and tailoring cannot run right now. Editing, templates and downloads all still work.':
        'لا يوجد مفتاح مزوّد ذكاء اصطناعي مُهيّأ على خدمة منشئ السيرة الذاتية، فلا يمكن الآن التحسين ولا المراجعة ولا التصميم لوظيفة. أما التعديل والقوالب والتنزيل فتعمل كلها كما هي.',

    /* CV Builder — the photo studio. */
    'Show a picture on the CV': 'إظهار صورة في السيرة الذاتية',
    'Optional. Some markets expect a photo, others screen it out — if you are unsure, leave the avatar or turn the photo off. Pick a default avatar and it is used in the PDF and DOCX exactly as you see it here.':
        'اختياري. بعض الأسواق تتوقّع صورة وأخرى تستبعدها — فإن لم تكن متأكّداً، أبقِ الصورة الرمزية أو أوقف الصورة. وإذا اخترت صورة رمزية افتراضية فستُستخدم في PDF وDOCX كما تراها هنا تماماً.',
    'Upload or take a photo, drag it to centre your face, and swap the background for a professional colour. Your face is never removed — only the area around you.':
        'ارفع صورة أو التقطها، واسحبها لتوسيط وجهك، واستبدل الخلفية بلون مهني. ولا يُزال وجهك أبداً — بل المنطقة المحيطة بك فقط.',
    'Or use a default avatar': 'أو استخدم صورة رمزية افتراضية',
    'Remove photo': 'إزالة الصورة',
    'The {v0} template never prints a picture — pick another template if you want one shown.':
        'قالب {v0} لا يطبع صورة أبداً — اختر قالباً آخر إن أردت إظهار صورة.',
    'Colour & type': 'اللون والنوع',
    'Font': 'الخط',
    'Use the template\'s own colour': 'استخدم لون القالب نفسه',
    'Circle': 'دائرة',
    'Square': 'مربّع',
    'Rounded': 'مستدير الحواف',
    'custom': 'مخصَّص',
    'empty': 'فارغ',

    /* CV Builder — the sample values.
     *
     * Localised rather than left in English. A placeholder is an instruction
     * about the SHAPE of the answer, and an Arabic-reading candidate filling in
     * an Arabic form is helped by an Arabic-shaped example. `Mar 2021` becomes
     * an Arabic month because a date is exactly the field somebody copies the
     * format of. */
    'Layla Haddad': 'ليلى حدّاد',
    'Senior Backend Engineer': 'مهندس خوادم أول',
    'Senior DevOps Engineer': 'مهندس DevOps أول',
    'Amman, Jordan': 'عمّان، الأردن',
    'Computer Science': 'علوم الحاسوب',
    'Mar 2021': 'آذار 2021',
    'Very Good / 3.6 GPA': 'جيد جداً / معدّل 3.6',
};

export default tools;
