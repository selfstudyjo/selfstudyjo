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
    // SelfStudyCode download (AI Chat page). Commands and product UI words stay in English.
    'The installers are being built. Please check back in a few minutes.': 'يجري بناء ملفات التثبيت الآن. يرجى العودة بعد بضع دقائق.',
    'Version {v0}': 'الإصدار {v0}',
    'Detected: {v0}': 'النظام المكتشف: {v0}',
    'Command line (CLI) for {v0}': 'أداة سطر الأوامر (CLI) لنظام {v0}',
    'Desktop app': 'تطبيق سطح المكتب',
    'Command line (CLI)': 'سطر الأوامر (CLI)',
    'How to install the command line tool': 'طريقة تثبيت أداة سطر الأوامر',
    'Then open a project folder in a terminal and run selfstudycode.': 'ثم افتح مجلد مشروع في الطرفية وشغّل الأمر selfstudycode.',
    'The installers are not code-signed yet: Windows may show "Windows protected your PC" (choose More info, then Run anyway), and macOS may ask you to open it from System Settings, Privacy & Security.':
        'ملفات التثبيت غير موقّعة رقمياً بعد: قد يعرض Windows رسالة "Windows protected your PC" (اختر More info ثم Run anyway)، وقد يطلب منك macOS فتحه من System Settings ثم Privacy & Security.',
    'Windows': 'Windows',
    'macOS': 'macOS',
    'Linux': 'Linux',
    'your system': 'نظامك',
    'Could not load the downloads right now. Please try again.': 'تعذّر تحميل قائمة التنزيلات الآن. يرجى المحاولة مجدداً.',
    'Could not start the download. Please try again.': 'تعذّر بدء التنزيل. يرجى المحاولة مجدداً.',
    // SelfStudy Products (/products) and the AI Chat's attachments and voice input.
    "SelfStudy Products": "منتجات SelfStudy",
    "Desktop apps for your computer": "تطبيقات سطح المكتب لحاسوبك",
    "Desktop apps for your own computer, included with your AI Features subscription. Download the latest version for Windows, macOS or Linux.": "تطبيقات سطح مكتب لحاسوبك أنت، مشمولة في اشتراك ميزات الذكاء الاصطناعي. نزّل أحدث إصدار لنظام Windows أو macOS أو Linux.",
    "See plans": "عرض الخطط",
    "Could not check your subscription right now. Please try again.": "تعذّر التحقق من اشتراكك الآن. يرجى المحاولة مجدداً.",
    "Download for {v0}": "نزّل لنظام {v0}",
    "These apps run on a computer. Open this page on your Windows, Mac or Linux computer to download them.": "تعمل هذه التطبيقات على الحاسوب. افتح هذه الصفحة على حاسوبك بنظام Windows أو Mac أو Linux لتنزيلها.",
    "There is no build for this computer yet. Every available build is listed below.": "لا يوجد إصدار لهذا الحاسوب بعد. جميع الإصدارات المتاحة مدرجة أدناه.",
    "System requirements": "متطلبات النظام",
    "All downloads": "كل التنزيلات",
    "Video Editor": "محرر الفيديو",
    "One installer: desktop app and command line · Windows, macOS and Linux": "ملف تثبيت واحد: تطبيق سطح مكتب وسطر أوامر · Windows وmacOS وLinux",
    "Your AI coding agent. It writes and fixes code, runs your tests, reviews changes, and makes images, videos and documents - on your own computer. Sign in with your SelfStudyJo account.": "وكيلك البرمجي بالذكاء الاصطناعي. يكتب الشيفرة ويصلحها، ويشغّل اختباراتك، ويراجع التغييرات، وينشئ الصور والفيديوهات والمستندات - على حاسوبك أنت. سجّل الدخول بحسابك في SelfStudyJo.",
    "Works in your project": "يعمل داخل مشروعك",
    "It reads your files, edits them, runs commands and tests, and asks before it does anything risky.": "يقرأ ملفاتك ويعدّلها، ويشغّل الأوامر والاختبارات، ويستأذنك قبل أي خطوة فيها مخاطرة.",
    "Desktop app and command line": "تطبيق سطح المكتب وسطر الأوامر",
    "One installer gives you both the desktop app and the selfstudycode command (short name: ssc). They share your sign-in, settings, chats and local models.": "ملف تثبيت واحد يمنحك تطبيق سطح المكتب والأمر selfstudycode معاً (واسمه المختصر ssc). ويتشارك الاثنان تسجيل دخولك وإعداداتك ومحادثاتك ونماذجك المحلية.",
    "Explainer videos and documents": "فيديوهات شرح ومستندات",
    "Give it a folder of exam files and it makes one silent explainer video per file: questions and answers side by side with arrows, practical steps done for real in VS Code and a browser on a hidden desktop, cleaned scans, Arabic labels. It also makes 3D animated scenes with free sound effects and character voices.": "أعطه مجلداً من ملفات الامتحانات فيصنع فيديو شرح صامتاً لكل ملف: الأسئلة والأجوبة جنباً إلى جنب مع أسهم، وتنفيذ الخطوات العملية فعلياً في VS Code والمتصفح على سطح مكتب مخفي، ومسحاً ضوئياً منظفاً، وعناوين بالعربية. ويصنع أيضاً مشاهد متحركة ثلاثية الأبعاد مع مؤثرات صوتية مجانية وأصوات للشخصيات.",
    "Made for everyday computers": "مصمم للحواسيب العادية",
    "It watches memory and the processor and slows itself down when your computer is busy, so it keeps working on an 8 GB laptop without freezing it. Your chats are saved as you go, and a long task always ends with a report of what was done.": "يراقب الذاكرة والمعالج ويبطئ نفسه عندما يكون حاسوبك مشغولاً، فيستمر في العمل على حاسوب محمول بذاكرة 8 غيغابايت دون أن يجمده. تُحفظ محادثاتك أولاً بأول، وتنتهي كل مهمة طويلة دائماً بتقرير عما أُنجز.",
    "Apps that start working": "تطبيقات تعمل من البداية",
    "New desktop, web and mobile apps start from templates that already build and run (Electron, React, Vue, Flask, FastAPI, Express, Expo). It adds your features step by step and launches the app to check it after each one.": "تبدأ تطبيقات سطح المكتب والويب والهاتف الجديدة من قوالب تُبنى وتعمل مسبقاً (Electron وReact وVue وFlask وFastAPI وExpress وExpo). يضيف ميزاتك خطوة بخطوة ويشغّل التطبيق ليتحقق منه بعد كل خطوة.",
    "Works offline too": "يعمل دون إنترنت أيضاً",
    "On first launch, in the app or the terminal, it offers to download a SelfStudy LM model sized for your computer, to a folder you choose. Then it works without the internet or an account. Ollama, LM Studio and llama.cpp work too.": "عند التشغيل الأول، في التطبيق أو في الطرفية، يعرض عليك تنزيل نموذج SelfStudy LM بحجم يناسب حاسوبك إلى مجلد تختاره. بعدها يعمل دون إنترنت ودون حساب. ويعمل أيضاً مع Ollama وLM Studio وllama.cpp.",
    "Windows 10 or 11 (64-bit), macOS 12 or newer (Intel or Apple Silicon), or a 64-bit Linux such as Ubuntu 20.04 or newer.": "Windows 10 أو 11 (64 بت)، أو macOS 12 أو أحدث (Intel أو Apple Silicon)، أو Linux بنظام 64 بت مثل Ubuntu 20.04 أو أحدث.",
    "4 GB of memory; 8 GB or more for SelfStudy LM, the recommended offline model.": "ذاكرة 4 غيغابايت؛ و8 غيغابايت أو أكثر لنموذج SelfStudy LM، وهو النموذج الموصى به للعمل دون إنترنت.",
    "About 500 MB of free disk space, plus the offline model you choose.": "نحو 500 ميغابايت من المساحة الحرة على القرص، إضافة إلى مساحة النموذج الذي تختاره للعمل دون إنترنت.",
    "An internet connection to use the SelfStudyJo AI models.": "اتصال بالإنترنت لاستخدام نماذج الذكاء الاصطناعي في SelfStudyJo.",
    "4 GB of memory and a microphone. An internet connection, or SelfStudy LM on your computer to work offline.": "ذاكرة 4 غيغابايت وميكروفون. واتصال بالإنترنت، أو SelfStudy LM على حاسوبك للعمل دون إنترنت.",
    "A full video editor and lecture recorder. Record your screen, camera and voice, get a transcript in any language and AI presentation graphics placed right on what you explain, then edit by describing it in plain words: \"remove the parts with no audio longer than 3 seconds and add Arabic captions\". The work happens on your computer and one Undo takes it all back.": "محرر فيديو كامل ومسجّل محاضرات. سجّل شاشتك والكاميرا وصوتك، واحصل على نص مكتوب بأي لغة ورسومات عرض يضعها الذكاء الاصطناعي على ما تشرحه تماماً، ثم عدّل بوصف ما تريد بكلمات بسيطة: \"احذف المقاطع الصامتة الأطول من 3 ثوانٍ وأضف ترجمة عربية\". يتم العمل على حاسوبك، وتراجع واحد يلغي كل شيء.",
    "Record lectures": "تسجيل المحاضرات",
    "Record your screen, camera and microphone. Show the camera as a circle or a square, in a corner, at the side or anywhere you drag it, on a choice of themes. Shortcuts start, pause and stop it from any app.": "سجّل شاشتك والكاميرا والميكروفون. اعرض الكاميرا في دائرة أو مربع، في زاوية أو على الجانب أو في أي مكان تسحبها إليه، مع مجموعة من التصاميم. اختصارات لوحة المفاتيح تبدأ التسجيل وتوقفه مؤقتاً وتنهيه من أي تطبيق.",
    "A transcript in any language": "نص مكتوب بأي لغة",
    "While you speak, your words are transcribed in any language or dialect and saved as a structured transcript, captions and plain text.": "أثناء حديثك تُكتب كلماتك بأي لغة أو لهجة، وتُحفظ نصاً منظماً وترجمة مرئية ونصاً عادياً.",
    "AI presentation overlays": "رسومات عرض بالذكاء الاصطناعي",
    "Tick one box and the AI adds arrows, highlights, flowcharts and step lists exactly where your screen shows what you are explaining, at the moment you say it.": "فعّل خياراً واحداً ويضيف الذكاء الاصطناعي أسهماً وتظليلاً ومخططات انسيابية وقوائم خطوات في المكان الذي تعرض فيه شاشتك ما تشرحه، وفي اللحظة التي تتحدث فيها عنه.",
    // Video Editor 1.2.0. The highlight-reel example keeps «أبرز» and a digit
    // before «دقيقة»: those are what the app itself recognises in Arabic
    // (src/shared/highlights.mjs), so the example is one a student can type.
    "Highlighter": "قلم التظليل",
    "A Highlighter draw tool marks text on the screen: press H, and hold Shift for a straight band.": "أداة الرسم Highlighter تُبرز النص على الشاشة: اضغط H، واضغط Shift مع الاستمرار لرسم شريط مستقيم.",
    "Animate segments": "تحريك المقاطع",
    "Press Animate where a part starts and End animate where it ends: the picture between them becomes an animation of what you are saying - titles, steps, flowcharts, numbers - while your original sound keeps playing.": "اضغط «تحريك» حيث يبدأ الجزء و«إنهاء التحريك» حيث ينتهي: تتحول الصورة بينهما إلى رسوم متحركة لما تقوله - عناوين وخطوات ومخططات وأرقام - بينما يستمر صوتك الأصلي.",
    "Reader voices": "أصوات القرّاء",
    "A library of voices on your computer, plus your own: record a sample, it is cleaned and matched, then replace the narrator’s voice in any language or dialect, translated and timed to the original.": "مكتبة أصوات على جهازك، وصوتك أنت أيضاً: سجّل عيّنة فتُنظَّف وتُطابَق، ثم استبدل صوت الراوي بأي لغة أو لهجة، مترجماً ومضبوط التوقيت مع الأصل.",
    "AI Highlights": "أبرز اللقطات بالذكاء الاصطناعي",
    "Type “make a 1 minute highlight reel” and it finds the best moments in the transcript. Preview each one, then make a highlight reel or mark the highlights with title cards. One Undo takes it back.": "اكتب «اصنع مقطعاً لأبرز اللحظات مدته 1 دقيقة» فيجد أفضل اللحظات في النص المكتوب. شاهد كلّاً منها، ثم اصنع منها مقطعاً لأبرز اللحظات أو ميّزها بعلامات وبطاقات عناوين. وتراجع واحد يلغي ذلك.",
    "Works offline": "يعمل دون إنترنت",
    "With SelfStudy LM, the plan for an editing command is made on your computer, and Whisper turns voice commands and captions into text on your computer too.": "مع SelfStudy LM تُعَدّ خطة أمر التعديل على حاسوبك، ويحوّل Whisper الكلام إلى نص على حاسوبك أيضاً، للأوامر الصوتية وللترجمة.",
    "A real timeline": "خط زمني حقيقي",
    "Several video and audio tracks, split, trim, move, speed, volume, fades, text and markers.": "عدة مسارات فيديو وصوت، وتقسيم وقص ونقل، وسرعة وصوت وتلاشٍ، ونصوص وعلامات.",
    "Edit by asking": "عدّل بالطلب",
    "Type or speak what you want. The AI answers with a plan of steps, and you see every step before it is applied.": "اكتب أو قل ما تريد. يجيب الذكاء الاصطناعي بخطة من الخطوات، وترى كل خطوة قبل تطبيقها.",
    "One-click clean-ups": "تحسينات بنقرة واحدة",
    "Improve the sound, fix a dark video, stabilise, denoise, crop for vertical video, and ready-made looks.": "حسّن الصوت، وأصلح الفيديو المعتم، وثبّت الصورة، وأزل التشويش، واقتصّ للفيديو العمودي، واستخدم مظاهر جاهزة.",
    "Captions and export": "الترجمة والتصدير",
    "Captions from the speech in your video, burned in or saved as .srt, and export to MP4, MOV, MKV, WebM, GIF or audio only.": "ترجمة من الكلام في الفيديو، مدمجة في الصورة أو محفوظة بصيغة .srt، وتصدير إلى MP4 أو MOV أو MKV أو WebM أو GIF أو صوت فقط.",
    "8 GB of memory recommended for HD video.": "يُنصح بذاكرة 8 غيغابايت لفيديو HD.",
    "Free disk space for your videos and exports.": "مساحة حرة على القرص لفيديوهاتك وملفات التصدير.",
    "Your videos stay on your computer, and the text on your screen is read on your computer too. Online, only your speech, the text found on the screen and a short summary are sent to the AI; working offline with SelfStudy LM, nothing is sent.": "تبقى فيديوهاتك على حاسوبك، ويُقرأ النص الظاهر على شاشتك على حاسوبك أيضاً. عند العمل عبر الإنترنت لا يُرسل إلى الذكاء الاصطناعي إلا كلامك والنص الموجود على الشاشة وملخص قصير؛ أما عند العمل دون إنترنت مع SelfStudy LM فلا يُرسل أي شيء.",
    // SelfStudyCode 2.0.0: the command line comes in the desktop installer. The
    // app's menu path (Settings › About › Install the command), the commands and
    // the paths are drawn untranslated in their own left-to-right elements beside
    // these sentences, so none of them is inside the Arabic.
    "The command line": "سطر الأوامر",
    "Since version 2.0, the same installer also gives you the selfstudycode command (short name: ssc). How it reaches your terminal depends on the installer:": "منذ الإصدار 2.0 يمنحك ملف التثبيت نفسه الأمر selfstudycode أيضاً (واسمه المختصر ssc). وتعتمد طريقة وصوله إلى الطرفية على نوع ملف التثبيت:",
    "Your computer": "حاسوبك",
    "The installer adds both commands to your PATH, so they work in any new terminal (PowerShell or cmd):": "يضيف ملف التثبيت الأمرين إلى PATH، فيعملان في أي طرفية جديدة (PowerShell أو cmd):",
    "Open the app and choose:": "افتح التطبيق واختر:",
    "It links both commands into one of these folders:": "سيضع رابطاً للأمرين في أحد هذين المجلدين:",
    "It writes these two files, which start the AppImage:": "سيُنشئ هذين الملفين اللذين يشغّلان ملف AppImage:",
    "The installer adds both commands:": "يضيف ملف التثبيت الأمرين:",
    "Then open a new terminal in your project folder and type selfstudycode, or ssc.": "ثم افتح طرفية جديدة في مجلد مشروعك واكتب selfstudycode أو ssc.",
    // SelfStudy LM, the local AI the three desktop apps share. Model names,
    // sizes and licences are drawn untranslated in left-to-right elements.
    "SelfStudy LM — the local AI of the desktop apps": "SelfStudy LM — الذكاء الاصطناعي المحلي لتطبيقات سطح المكتب",
    "SelfStudy LM lets SelfStudyCode, Interview Helper and Video Editor work on your own computer, without the internet. It is not a new model trained from scratch: it is a packaged suite of open models, built on Qwen3.5 and Qwen3.6 (Qwen, Alibaba Cloud), Whisper (OpenAI) and FLUX.2 (Black Forest Labs).": "يتيح SelfStudy LM لتطبيقات SelfStudyCode ومساعد المقابلات ومحرر الفيديو العمل على حاسوبك أنت، دون إنترنت. وهو ليس نموذجاً جديداً دُرِّب من الصفر، بل مجموعة مُجهَّزة من النماذج المفتوحة، مبنية على Qwen3.5 وQwen3.6 (من فريق Qwen في Alibaba Cloud) وWhisper (من OpenAI) وFLUX.2 (من Black Forest Labs).",
    "Downloaded once": "يُنزَّل مرة واحدة",
    "A model is downloaded once per computer: all three apps use the same models folder, so what one app downloads is there for the others.": "يُنزَّل النموذج مرة واحدة لكل حاسوب: تستخدم التطبيقات الثلاثة مجلد النماذج نفسه، فما يُنزّله أحدها يجده الآخران جاهزاً.",
    "Private and offline": "خاص ودون إنترنت",
    "It runs on your own computer and works without the internet.": "يعمل على حاسوبك أنت، ودون الحاجة إلى الإنترنت.",
    "Processor or graphics card": "المعالج أو بطاقة الرسوميات",
    "It runs on the computer’s processor (CPU), and faster with a graphics card.": "يعمل على معالج الحاسوب (CPU)، ويصبح أسرع مع بطاقة رسوميات.",
    "Chosen in each app": "يُختار داخل كل تطبيق",
    "On first launch each app offers the model that fits your computer and asks where to keep it. There is no download button for the models on this website.": "عند التشغيل الأول يعرض كل تطبيق النموذج المناسب لحاسوبك ويسألك أين تحفظه. ولا يوجد على هذا الموقع زر لتنزيل النماذج.",
    "The models": "النماذج",
    "Built on": "مبني على",
    "Download size": "حجم التنزيل",
    "Memory (RAM)": "الذاكرة (RAM)",
    "Licence": "الترخيص",
    "With less memory:": "مع ذاكرة أقل:",
    "Any computer": "أي حاسوب",
    "A graphics card helps.": "يُفضَّل وجود بطاقة رسوميات.",
    "Quick answers on any laptop. Installed beside a bigger SelfStudy LM model, it also makes that one faster.": "إجابات سريعة على أي حاسوب محمول. وإذا ثُبِّت بجانب نموذج SelfStudy LM أكبر، جعله أسرع أيضاً.",
    "The everyday model: lessons, code, video edit plans, interview answers, screenshots and scanned pages.": "نموذج الاستخدام اليومي: الدروس والشيفرة وخطط تعديل الفيديو وإجابات المقابلات ولقطات الشاشة والصفحات الممسوحة ضوئياً.",
    "More knowledge and better reasoning: longer code, harder questions and careful writing.": "معرفة أوسع واستدلال أفضل: شيفرة أطول وأسئلة أصعب وكتابة متأنية.",
    "The strongest: agentic coding, long projects and data analysis. A mixture of experts, fast for its size.": "الأقوى: البرمجة بالوكلاء والمشاريع الطويلة وتحليل البيانات. وهو نموذج من نوع «خليط الخبراء»، سريع بالنسبة إلى حجمه.",
    "Speech to text in 99 languages, in the Video Editor: voice commands, captions and transcripts.": "تحويل الكلام إلى نص في 99 لغة، في محرر الفيديو: الأوامر الصوتية والترجمة والنصوص المكتوبة.",
    "Pictures from a description, in SelfStudyCode: illustrations, backgrounds and thumbnails.": "صور من وصف تكتبه، في SelfStudyCode: رسوم توضيحية وخلفيات وصور مصغّرة.",
    "Attachments": "المرفقات",
    "only the start was read": "قُرئت البداية فقط",
    "Remove {v0}": "إزالة {v0}",
    "Listening… {v0}s. Press the microphone again to stop.": "جارٍ الاستماع… {v0} ث. اضغط الميكروفون مجدداً للإيقاف.",
    "Turning your voice into text…": "جارٍ تحويل صوتك إلى نص…",
    "You can attach one image, text or code files, Word documents (.docx) and PDFs. Images up to 4 MB, files up to 1 MB.": "يمكنك إرفاق صورة واحدة، وملفات نصية أو برمجية، ومستندات Word (.docx) وملفات PDF. الصور حتى 4 ميغابايت، والملفات حتى 1 ميغابايت.",
    "Attach a file or image": "إرفاق ملف أو صورة",
    "Stop recording": "إيقاف التسجيل",
    "Speak your message": "قل رسالتك بصوتك",
    "That attachment is too large.": "هذا المرفق كبير جداً.",
    "One of those files cannot be read here. Attach an image, a text or code file, a .docx or a PDF.": "تعذّرت قراءة أحد هذه الملفات هنا. أرفق صورة أو ملفاً نصياً أو برمجياً أو ملف .docx أو PDF.",
    "That attachment could not be used.": "تعذّر استخدام هذا المرفق.",
    "\"{v0}\" cannot be read here. Attach an image, a text or code file, a .docx or a PDF.": "تعذّرت قراءة \"{v0}\" هنا. أرفق صورة أو ملفاً نصياً أو برمجياً أو ملف .docx أو PDF.",
    "You can attach up to {v0} files to one message.": "يمكنك إرفاق ما يصل إلى {v0} ملفات في الرسالة الواحدة.",
    "Attach one image per message.": "أرفق صورة واحدة في كل رسالة.",
    "\"{v0}\" is too large.": "\"{v0}\" كبير جداً.",
    "That file could not be read.": "تعذّرت قراءة هذا الملف.",
    "The microphone could not be used. Allow microphone access in your browser and try again.": "تعذّر استخدام الميكروفون. اسمح بالوصول إلى الميكروفون في متصفحك وحاول مجدداً.",
    "That recording is too long. Keep it under two minutes.": "هذا التسجيل طويل جداً. اجعله أقل من دقيقتين.",
    "No speech was heard. Try again a little closer to the microphone.": "لم يُسمع أي كلام. حاول مجدداً وأنت أقرب قليلاً إلى الميكروفون.",
    "Your voice could not be turned into text. Please try again.": "تعذّر تحويل صوتك إلى نص. يرجى المحاولة مجدداً.",
    // Products page: SelfStudy Browser
    "A fast, safe web browser for students. One click puts a tab on a private VPN through the Tor network, and adult and dangerous content is blocked everywhere by AI that runs on your own computer.": "متصفح ويب سريع وآمن للطلاب. بنقرة واحدة يعمل أي تبويب عبر شبكة VPN خاصة من خلال شبكة Tor، ويُحجب المحتوى الإباحي والخطير في كل مكان بذكاء اصطناعي يعمل على حاسوبك.",
    "VPN in one click": "VPN بنقرة واحدة",
    "The VPN button sends a tab through the Tor network: sites cannot see your IP address and nothing from that tab is kept after you quit. Normal tabs stay fast. Choose an exit country or a new identity at any time.": "زر VPN يرسل التبويب عبر شبكة Tor: لا ترى المواقع عنوان IP الخاص بك ولا يُحفظ شيء من هذا التبويب بعد الإغلاق. تبقى التبويبات العادية سريعة. اختر بلد الخروج أو هوية جديدة في أي وقت.",
    "No adult websites": "لا مواقع إباحية",
    "Close to a million adult sites and over a hundred thousand phishing and scam sites are blocked. SafeSearch and YouTube Restricted Mode are always on.": "يُحجب قرابة مليون موقع إباحي وأكثر من مئة ألف موقع تصيّد واحتيال. البحث الآمن ووضع YouTube المقيّد يعملان دائماً.",
    "AI hides explicit content": "الذكاء الاصطناعي يخفي المحتوى الفاضح",
    "On YouTube, Facebook, Instagram, X and every other site, explicit pictures, videos and posts are hidden behind a red warning box while you keep scrolling. The AI runs on your computer: nothing you see is uploaded.": "على YouTube وFacebook وInstagram وX وكل المواقع الأخرى، تُخفى الصور والفيديوهات والمنشورات الفاضحة خلف مربع تحذير أحمر بينما تواصل التمرير. يعمل الذكاء الاصطناعي على حاسوبك: لا يُرفع شيء مما تراه.",
    "Learns what you block": "يتعلّم ما تحجبه",
    "Right-click a picture, or draw a box around anything, and it stays hidden on that site and everywhere the same picture appears. Signed in, what it learns is synced twice a week with your other computers.": "انقر بزر الفأرة الأيمن على صورة أو ارسم مربعاً حول أي شيء، فيبقى مخفياً على ذلك الموقع وفي كل مكان تظهر فيه الصورة نفسها. عند تسجيل الدخول، يُزامَن ما يتعلّمه مرتين في الأسبوع مع حواسيبك الأخرى.",
    "Virus-checked downloads": "تنزيلات مفحوصة من الفيروسات",
    "Every download is scanned with Microsoft Defender on Windows or ClamAV on macOS and Linux, and an infected file is deleted.": "يُفحص كل تنزيل باستخدام Microsoft Defender على Windows أو ClamAV على macOS وLinux، ويُحذف الملف المصاب.",
    "Light and up to date": "خفيف ومحدَّث دائماً",
    "One shared AI worker that unloads itself when idle, idle tabs put to sleep, and automatic updates twice a week.": "عامل ذكاء اصطناعي واحد مشترك يُفرَّغ من الذاكرة عند الخمول، وتبويبات خاملة تُنوَّم، وتحديثات تلقائية مرتين في الأسبوع.",
    "4 GB of memory and about 600 MB of free disk space.": "ذاكرة 4 GB ونحو 600 MB من المساحة الفارغة على القرص.",
    "An account is optional: it is only used for updates and sync.": "الحساب اختياري: يُستخدم فقط للتحديثات والمزامنة.",
    "Pages, pictures and videos are checked on your own computer and never uploaded. Signed in, only the sites and areas you or the browser blocked are synced. VPN tabs keep nothing after you quit.": "تُفحص الصفحات والصور والفيديوهات على حاسوبك ولا تُرفع أبداً. عند تسجيل الدخول، لا يُزامَن إلا المواقع والمناطق التي حجبتها أنت أو حجبها المتصفح. تبويبات VPN لا تحتفظ بشيء بعد الإغلاق.",
    "Download the .dmg for your Mac: arm64 for Apple Silicon, x64 for Intel.": "نزّل ملف ‎.dmg المناسب لجهاز Mac: arm64 لمعالجات Apple Silicon وx64 لمعالجات Intel.",
    // Products page: Self-Study for Protection
    "4 GB of memory and about 400 MB of free disk space.": "ذاكرة 4 GB ونحو 400 MB من المساحة الفارغة على القرص.",
    "Alerts that do not bother you": "تنبيهات لا تزعجك",
    "Charts for everything": "رسوم بيانية لكل شيء",
    "Choose the install folder and finish. Open the app from the Start menu or the desktop icon.": "اختر مجلد التثبيت وأكمل. افتح التطبيق من قائمة ابدأ أو من أيقونة سطح المكتب.",
    "Download the .exe installer (or the .msi) and run it.": "نزّل ملف التثبيت ‎.exe (أو ‎.msi) وشغّله.",
    "Download the AppImage (any distribution) or the .deb (Debian, Ubuntu).": "نزّل ملف AppImage (لأي توزيعة) أو ‎.deb (لـ Debian وUbuntu).",
    "Each running program with its owner, start time, live uptime, CPU, memory and digital signature, marked System, User, Suspicious or Dangerous with the reasons. Stop any program that is not part of the operating system, in a table or a 3D view of the process tree.": "كل برنامج يعمل مع مالكه ووقت بدئه ومدة تشغيله الحية واستهلاكه للمعالج والذاكرة وتوقيعه الرقمي، مصنّفاً: نظام أو مستخدم أو مشبوه أو خطير مع الأسباب. أوقف أي برنامج ليس جزءاً من نظام التشغيل، من جدول أو من عرض ثلاثي الأبعاد لشجرة العمليات.",
    "Every process, explained": "كل عملية مع شرحها",
    "Finds the devices on your Wi-Fi or cable network, with an icon for each type, its maker, address and first and last time seen. Devices that left stay listed as offline. Dangerous signs like ARP spoofing or a device scanning your computer are flagged.": "يكتشف الأجهزة على شبكة Wi-Fi أو الشبكة السلكية، مع أيقونة لكل نوع والشركة المصنّعة والعنوان وأول وآخر ظهور. تبقى الأجهزة التي غادرت في القائمة كغير متصلة. وتُعلَّم العلامات الخطيرة مثل انتحال ARP أو جهاز يفحص حاسوبك.",
    "For full detail on system processes, use Relaunch as administrator inside the app.": "للحصول على تفاصيل كاملة عن عمليات النظام، استخدم «إعادة التشغيل كمسؤول» داخل التطبيق.",
    "How to install it": "طريقة التثبيت",
    "If Windows says \"Windows protected your PC\", choose More info, then Run anyway.": "إذا ظهرت رسالة \"Windows protected your PC\"، فاختر More info ثم Run anyway.",
    "Live 2D and 3D charts of CPU per core, memory, network traffic and disk space, with how fast each drive is filling.": "رسوم حية ثنائية وثلاثية الأبعاد للمعالج لكل نواة والذاكرة وحركة الشبكة ومساحة الأقراص، مع سرعة امتلاء كل قرص.",
    "Make the AppImage executable and run it, or install the .deb:": "اجعل ملف AppImage قابلاً للتنفيذ وشغّله، أو ثبّت ملف ‎.deb:",
    "Nothing about your computer, programs or network leaves your computer: no account, no telemetry. History and alerts are stored only in a folder on your own computer. Only scan networks you own or are allowed to monitor.": "لا تغادر أي معلومة عن حاسوبك أو برامجك أو شبكتك حاسوبك: لا حساب ولا قياس عن بُعد. يُحفظ السجل والتنبيهات فقط في مجلد على حاسوبك. افحص فقط الشبكات التي تملكها أو المسموح لك بمراقبتها.",
    "Open the .dmg file and drag the app into Applications.": "افتح ملف ‎.dmg واسحب التطبيق إلى مجلد Applications.",
    "Optional: in System Settings, Privacy & Security, give it Full Disk Access for complete disk scans.": "اختياري: في إعدادات النظام، الخصوصية والأمان، امنحه «الوصول الكامل إلى القرص» لفحص الأقراص بالكامل.",
    "Optional: install ClamAV to scan files for viruses:": "اختياري: ثبّت ClamAV لفحص الملفات من الفيروسات:",
    "Problems appear in the app. Only urgent ones - a dangerous program, a virus, someone signed in remotely, a disk about to be full - also show a desktop notification, even when the window is closed.": "تظهر المشكلات داخل التطبيق. والمشكلات العاجلة فقط - برنامج خطير، فيروس، شخص متصل عن بُعد، قرص على وشك الامتلاء - تظهر أيضاً كإشعار على سطح المكتب، حتى عندما تكون النافذة مغلقة.",
    "Protects your computer. It watches every program, every device on your network, your disks, processor and memory, checks your antivirus, firewall and sign-ins, explains problems in plain words and gives you the button that fixes them.": "يحمي حاسوبك. يراقب كل برنامج وكل جهاز على شبكتك وأقراصك والمعالج والذاكرة، ويتحقق من مضاد الفيروسات والجدار الناري وعمليات تسجيل الدخول، ويشرح المشكلات بكلمات بسيطة ويعطيك الزر الذي يصلحها.",
    "Shows your antivirus and firewall status, runs quick, full, folder and file virus scans, removes threats, shows who is signed in (remote sessions are flagged) and lists programs that start automatically.": "يعرض حالة مضاد الفيروسات والجدار الناري، ويجري فحصاً سريعاً أو كاملاً أو لمجلد أو لملف، ويزيل التهديدات، ويُظهر من سجّل الدخول (مع تعليم الجلسات البعيدة)، ويعرض البرامج التي تبدأ تلقائياً.",
    "The complete Disk Usage Analyzer: what uses the space on each drive and why, the largest files, a 3D map, files that look malicious, and safe cleanup that protects system files.": "محلل استخدام القرص كاملاً: ما الذي يشغل المساحة على كل قرص ولماذا، وأكبر الملفات، وخريطة ثلاثية الأبعاد، والملفات التي تبدو خبيثة، وتنظيف آمن يحمي ملفات النظام.",
    "The first time, right-click the app, choose Open, then Open again.": "في المرة الأولى، انقر بزر الفأرة الأيمن على التطبيق واختر Open، ثم Open مرة أخرى.",
    "Virus scanning uses Microsoft Defender on Windows; on macOS and Linux install the free ClamAV.": "يستخدم فحص الفيروسات Microsoft Defender على Windows؛ وعلى macOS وLinux ثبّت ClamAV المجاني.",
    "Viruses and break-ins": "الفيروسات والاختراقات",
    "What fills your disk": "ما الذي يملأ قرصك",
    "Who is on your network": "من على شبكتك",
    "Run on my computer": "شغّله على جهازي",
    "Download a SelfStudy LM model and chat with it on your own computer - offline, private, free. The desktop app downloads the model for you the first time.": "نزّل نموذج SelfStudy LM وتحدث معه على جهازك - بدون إنترنت وبخصوصية ومجانًا. يقوم تطبيق سطح المكتب بتنزيل النموذج لك في المرة الأولى.",
    "needs {v0} memory": "يحتاج ذاكرة {v0}",
    "Download the desktop app": "نزّل تطبيق سطح المكتب",
    "All SelfStudy apps": "كل تطبيقات SelfStudy",
    // SelfStudy VPN (Products page)
    "An encrypted VPN for networking and security students. No account and no sign-in: press Connect, choose a country or let it choose one for you, and websites see a new IP address while your traffic stays encrypted.": "شبكة VPN مشفّرة لطلاب الشبكات والأمن. بلا حساب ولا تسجيل دخول: اضغط اتصال، واختر دولة أو دعه يختار لك، فترى المواقع عنوان IP جديداً بينما تبقى بياناتك مشفّرة.",
    "Choose a country": "اختر دولة",
    "Pick from 41 countries, or Automatic, which chooses a fast country each time it starts and moves on if one does not answer. Switching takes a few seconds.": "اختر من 41 دولة، أو الوضع التلقائي الذي يختار دولة سريعة عند كل تشغيل وينتقل إلى غيرها إن لم تستجب. التبديل يستغرق ثوانيَ معدودة.",
    "A new IP address": "عنوان IP جديد",
    "Change your address with one click, or automatically every 10 minutes to 2 hours, with a new country each time if you like.": "غيّر عنوانك بنقرة واحدة، أو تلقائياً كل 10 دقائق إلى ساعتين، مع دولة جديدة في كل مرة إن أردت.",
    "Encrypted three times": "تشفير ثلاثي",
    "Traffic goes through three Tor relays, each with its own layer of encryption: your network sees one encrypted connection, and no single relay knows both who you are and where you go.": "تمرّ بياناتك عبر ثلاث محطات من شبكة Tor، لكل منها طبقة تشفير خاصة: لا ترى شبكتك إلا اتصالاً مشفّراً واحداً، ولا تعرف أي محطة وحدها من أنت وإلى أين تذهب معاً.",
    "No leaks, kill switch": "بلا تسريب، ومفتاح إيقاف",
    "Site names are looked up inside the tunnel, so there is no DNS leak, and if the tunnel drops your traffic is blocked instead of leaving unprotected. A built-in leak test checks it.": "تُحلّ أسماء المواقع داخل النفق فلا يحدث تسريب DNS، وإذا انقطع النفق تُحجب بياناتك بدل أن تخرج بلا حماية. واختبار التسريب المدمج يتحقق من ذلك.",
    "Whole system or one terminal": "النظام كله أو طرفية واحدة",
    "Route every program that uses the system proxy, or copy ready-made commands for curl, git, pip, npm and proxychains.": "وجّه كل برنامج يستخدم وكيل النظام، أو انسخ أوامر جاهزة لـ curl وgit وpip وnpm وproxychains.",
    "See how it works": "شاهد كيف يعمل",
    "A live view of your route - entry guard, middle relay and exit relay with their countries - for learning how onion routing works.": "عرض حيّ لمسارك - محطة الدخول والمحطة الوسطى ومحطة الخروج مع دولها - لتتعلم كيف يعمل التوجيه البصلي.",
    "4 GB of memory and about 300 MB of free disk space.": "ذاكرة 4 غيغابايت ونحو 300 ميغابايت من المساحة الحرة.",
    "No account is needed to use it. Programs that ignore the system proxy, and UDP traffic such as games and some calls, are not routed.": "لا حاجة إلى حساب لاستخدامه. البرامج التي تتجاهل وكيل النظام، وحركة UDP مثل الألعاب وبعض المكالمات، لا تمرّ عبره.",
    "No account, no logs and no telemetry: settings are kept only on your computer. It uses the Tor network and is not affiliated with The Tor Project. Use it only on networks you are allowed to use.": "بلا حساب ولا سجلات ولا قياس عن بُعد: تُحفظ الإعدادات على حاسوبك فقط. يستخدم شبكة Tor ولا يتبع مشروع Tor. استخدمه فقط على الشبكات المسموح لك باستخدامها.",
    "The first time you connect, macOS asks for your password so the app can set the system proxy.": "عند الاتصال أول مرة، يطلب macOS كلمة المرور ليتمكن التطبيق من ضبط وكيل النظام.",
    "The SelfStudy desktop apps come with a paid plan that includes AI Features; they are not part of the free trial.": "تأتي تطبيقات SelfStudy لسطح المكتب مع خطة مدفوعة تشمل ميزات الذكاء الاصطناعي، وليست ضمن التجربة المجانية.",
    // SelfStudy WiFi Connect (Products page)
    "Chat, voice messages, audio calls and file sharing between nearby computers over Wi-Fi, with no router, switch or internet. One computer starts a hotspot, the others join, and everyone can reach everyone.": "محادثة ورسائل صوتية ومكالمات صوتية ومشاركة ملفات بين الحواسيب القريبة عبر Wi-Fi، بلا راوتر ولا سويتش ولا إنترنت. يشغّل حاسوب واحد نقطة اتصال وينضم إليها الآخرون، فيتواصل الجميع مع الجميع.",
    "Voice messages and calls": "رسائل صوتية ومكالمات",
    "Record a voice message in any chat, or call another device directly. Calls go device to device over the Wi-Fi with echo cancellation and encryption, with no internet needed.": "سجّل رسالة صوتية في أي محادثة، أو اتصل بجهاز آخر مباشرة. تنتقل المكالمات من جهاز إلى جهاز عبر Wi-Fi مع إلغاء الصدى والتشفير، دون الحاجة إلى إنترنت.",
    "You control the ports": "أنت تتحكم في المنافذ",
    "Choose the ports in Settings, open them in the firewall for this app only, close them with one click, and have them closed automatically when you quit.": "اختر المنافذ من الإعدادات، وافتحها في جدار الحماية لهذا التطبيق وحده، وأغلقها بنقرة واحدة، أو دعها تُغلق تلقائياً عند الخروج.",
    "Hotspot in one click": "نقطة اتصال بنقرة واحدة",
    "On Windows it starts a Wi-Fi Direct group that works with no internet connection; on Linux an access point. Others see it as a normal Wi-Fi network and join it from the app.": "على Windows ينشئ مجموعة Wi-Fi Direct تعمل دون اتصال بالإنترنت، وعلى Linux نقطة وصول. يراها الآخرون شبكة Wi-Fi عادية وينضمون إليها من التطبيق.",
    "Direct and group rooms": "غرف مباشرة وغرف جماعية",
    "Two devices make a direct room. Three or more join one hotspot and make a group room, where every device can talk to every other - the host relays when two cannot reach each other.": "جهازان يكوّنان غرفة مباشرة. ثلاثة أجهزة أو أكثر تنضم إلى نقطة اتصال واحدة وتكوّن غرفة جماعية يتحدث فيها كل جهاز مع الآخرين - ويمرّر المضيف الرسائل حين لا يصل جهازان أحدهما إلى الآخر.",
    "Files and pictures": "ملفات وصور",
    "Send many files at once, or drag and drop them into a chat. Every file is checked with SHA-256 before it is saved, and pictures show right in the chat.": "أرسل عدة ملفات دفعة واحدة، أو اسحبها وأفلتها في المحادثة. يُفحص كل ملف بـ SHA-256 قبل حفظه، وتظهر الصور داخل المحادثة مباشرة.",
    "Knows who is who": "يعرف من هو من",
    "Each device has its own signed key with a fingerprint you can compare, plus its MAC address, IP address and user name. A device pretending to be another is refused.": "لكل جهاز مفتاح موقَّع خاص به مع بصمة يمكنك مقارنتها، إضافة إلى عنوان MAC وعنوان IP واسم المستخدم. ويُرفض أي جهاز ينتحل صفة جهاز آخر.",
    "Private and encrypted": "خاص ومشفّر",
    "Every link is encrypted and every message is signed by its author. Messages and files are stored only on the computers in the room - no server and no account.": "كل اتصال مشفّر وكل رسالة موقَّعة من كاتبها. تُحفظ الرسائل والملفات على حواسيب الغرفة فقط - بلا خادم ولا حساب.",
    "See your network live": "شاهد شبكتك حيّة",
    "A 3D map shows every device nearby and the messages and files moving between them, with tables of devices and transfers.": "خريطة ثلاثية الأبعاد تعرض كل جهاز قريب والرسائل والملفات المتنقلة بينها، مع جداول للأجهزة والتحويلات.",
    "A Wi-Fi adapter on every computer, and the app on every device in the room. macOS can join a hotspot but cannot start one from an app.": "محوّل Wi-Fi في كل حاسوب، والتطبيق على كل جهاز في الغرفة. يستطيع macOS الانضمام إلى نقطة اتصال لكنه لا يسمح للتطبيقات بإنشائها.",
    "Nothing leaves your Wi-Fi network: no account, no server and no telemetry. Messages and files are kept only on the devices that send and receive them. Allow the app through the firewall on private networks when your computer asks.": "لا شيء يغادر شبكة Wi-Fi الخاصة بك: بلا حساب ولا خادم ولا قياس عن بُعد. تُحفظ الرسائل والملفات على الأجهزة التي ترسلها وتستقبلها فقط. اسمح للتطبيق عبر جدار الحماية على الشبكات الخاصة حين يطلب حاسوبك ذلك.",
    "When Windows Firewall asks, allow it on private networks so other devices can find this one.": "حين يسأل جدار حماية Windows، اسمح للتطبيق على الشبكات الخاصة لتتمكن الأجهزة الأخرى من العثور على هذا الجهاز.",
    "When macOS asks, allow it to find devices on your local network.": "حين يسأل macOS، اسمح للتطبيق بالعثور على الأجهزة في شبكتك المحلية.",
    "Starting a hotspot needs NetworkManager, which Ubuntu, Fedora and most desktops include.": "يحتاج تشغيل نقطة الاتصال إلى NetworkManager، الموجود في Ubuntu وFedora ومعظم بيئات سطح المكتب.",
    "8 GB of memory recommended to run the AI on your own computer.": "يُنصح بذاكرة 8 غيغابايت لتشغيل الذكاء الاصطناعي على حاسوبك.",
    "The download comes with a paid AI plan. The app needs no account: signing in only adds the Self-Study online AI.": "يأتي التنزيل مع خطة ذكاء اصطناعي مدفوعة. لا يحتاج التطبيق إلى حساب: تسجيل الدخول يضيف فقط ذكاء Self-Study عبر الإنترنت.",
    "The download comes with a paid AI plan. Browsing the store needs no account; installing apps needs a sign-in with a paid AI plan.": "يأتي التنزيل مع خطة ذكاء اصطناعي مدفوعة. تصفّح المتجر لا يحتاج إلى حساب؛ أما تثبيت التطبيقات فيتطلب تسجيل الدخول بخطة ذكاء اصطناعي مدفوعة.",
    "Your files stay on your computer. With the AI on your computer nothing is sent anywhere; with the online AI only the part of the file the request needs is sent.": "تبقى ملفاتك على حاسوبك. مع الذكاء الاصطناعي على حاسوبك لا يُرسل أي شيء، ومع الذكاء الاصطناعي عبر الإنترنت يُرسل فقط جزء الملف الذي يحتاجه الطلب.",
    "Your code stays on your computer. With the AI on your computer nothing is sent anywhere; with the online AI only the code you ask about is sent.": "تبقى شيفرتك على حاسوبك. مع الذكاء الاصطناعي على حاسوبك لا يُرسل أي شيء، ومع الذكاء الاصطناعي عبر الإنترنت تُرسل فقط الشيفرة التي تسأل عنها.",
    "Connections and data stay on your computer. The AI is sent table and column names, never your rows, unless you paste them into a question.": "تبقى الاتصالات والبيانات على حاسوبك. يُرسل إلى الذكاء الاصطناعي أسماء الجداول والأعمدة فقط وليس صفوفك، إلا إذا ألصقتها في سؤال.",
    "The store only talks to SelfStudy to list and download apps. It sends nothing about your computer except which system it is.": "لا يتواصل المتجر مع SelfStudy إلا لعرض التطبيقات وتنزيلها. ولا يرسل أي شيء عن حاسوبك سوى نوع النظام.",
    "Sheets, Docs and Slides in one app, with a Copilot that edits your file: it formats, writes formulas, builds tables and charts, inserts pictures and creates whole presentations.": "جداول ومستندات وعروض تقديمية في تطبيق واحد، مع مساعد Copilot يعدّل ملفك: ينسّق ويكتب الصيغ ويبني الجداول والرسوم البيانية ويدرج الصور وينشئ عروضًا كاملة.",
    "Sheets like Excel": "جداول مثل Excel",
    "Cells, more than 100 formulas, number formats, merge, freeze panes, filters, sorting, conditional formatting, charts and pictures. Opens and saves .xlsx and .csv.": "خلايا وأكثر من 100 صيغة وتنسيقات أرقام ودمج وتثبيت الأجزاء وتصفية وفرز وتنسيق شرطي ورسوم بيانية وصور. يفتح ويحفظ ملفات .xlsx و.csv.",
    "Docs like Word": "مستندات مثل Word",
    "A page view with fonts, sizes, styles, lists, tables, pictures, links, page setup and find and replace. Opens and saves .docx and exports PDF.": "عرض صفحات مع الخطوط والأحجام والأنماط والقوائم والجداول والصور والروابط وإعداد الصفحة والبحث والاستبدال. يفتح ويحفظ .docx ويصدّر PDF.",
    "Slides like PowerPoint": "عروض مثل PowerPoint",
    "Themes, layouts, text boxes, shapes, tables, charts, transitions, animations, speaker notes and a full-screen slide show. Opens and saves .pptx.": "سمات وتخطيطات ومربعات نص وأشكال وجداول ورسوم بيانية وانتقالات وحركات وملاحظات المتحدث وعرض بملء الشاشة. يفتح ويحفظ .pptx.",
    "Every tool you expect": "كل الأدوات المعتادة",
    "Format painter, fonts on your computer, bold, italic, underline, colours, alignment, undo and redo, copy and paste, printing and automatic recovery.": "ناسخ التنسيق وخطوط حاسوبك والغامق والمائل والتسطير والألوان والمحاذاة والتراجع والإعادة والنسخ واللصق والطباعة والاستعادة التلقائية.",
    "AI on your computer or online": "ذكاء اصطناعي على حاسوبك أو عبر الإنترنت",
    "A small model runs on your own computer by default. In Settings you can choose a bigger model, the Self-Study online AI, or your own AI service key.": "يعمل نموذج صغير على حاسوبك افتراضيًا. ومن الإعدادات يمكنك اختيار نموذج أكبر أو ذكاء Self-Study عبر الإنترنت أو مفتاح خدمة ذكاء اصطناعي خاص بك.",
    "A code editor like VS Code with AI built in. It detects the language, formats your code, reviews it, explains it and helps you organise the whole project.": "محرر برمجي مثل VS Code مع ذكاء اصطناعي مدمج. يتعرّف على اللغة وينسّق الشيفرة ويراجعها ويشرحها ويساعدك على تنظيم المشروع كله.",
    "A real code editor": "محرر برمجي حقيقي",
    "Tabs, split view, compare files, a command palette, quick open, Markdown preview and syntax colours for more than 80 languages.": "تبويبات وعرض مقسوم ومقارنة ملفات ولوحة أوامر وفتح سريع ومعاينة Markdown وتلوين الصياغة لأكثر من 80 لغة.",
    "Knows every language": "يعرف كل اللغات",
    "The language of each file is detected from its name and content, and Format document tidies the code in that language.": "تُكتشف لغة كل ملف من اسمه ومحتواه، ويرتّب أمر تنسيق المستند الشيفرة بتلك اللغة.",
    "Project tools": "أدوات المشروع",
    "File explorer, search and replace in all files, Git changes and commits, a terminal, and Run for the current file.": "مستكشف الملفات والبحث والاستبدال في كل الملفات وتغييرات Git والإيداع وطرفية وتشغيل الملف الحالي.",
    "AI code review": "مراجعة الشيفرة بالذكاء الاصطناعي",
    "Ask the AI to review a file or the project structure, fix errors, refactor, add comments and tests, or explain code line by line.": "اطلب من الذكاء الاصطناعي مراجعة ملف أو بنية المشروع أو إصلاح الأخطاء أو إعادة الهيكلة أو إضافة تعليقات واختبارات أو شرح الشيفرة سطرًا سطرًا.",
    "The right model for your computer": "النموذج المناسب لحاسوبك",
    "A small model runs on your computer; a bigger one is suggested when your memory allows it, or use the online AI.": "يعمل نموذج صغير على حاسوبك، ويُقترح نموذج أكبر عندما تسمح الذاكرة، أو استخدم الذكاء الاصطناعي عبر الإنترنت.",
    "A database tool for every engine: browse tables, run SQL, import and export data, draw ER diagrams and ask the AI to write or explain queries.": "أداة قواعد بيانات لكل المحركات: تصفّح الجداول وشغّل SQL واستورد البيانات وصدّرها وارسم مخططات ER واطلب من الذكاء الاصطناعي كتابة الاستعلامات أو شرحها.",
    "Every database": "كل قواعد البيانات",
    "SQLite, PostgreSQL, MySQL and MariaDB, SQL Server, Oracle, MongoDB and Redis, with passwords kept encrypted on your computer.": "SQLite وPostgreSQL وMySQL وMariaDB وSQL Server وOracle وMongoDB وRedis، مع حفظ كلمات المرور مشفّرة على حاسوبك.",
    "SQL editor": "محرر SQL",
    "Completion for tables and columns, formatting, several query tabs and results you can sort, filter and edit.": "إكمال تلقائي للجداول والأعمدة وتنسيق وعدة تبويبات للاستعلامات ونتائج يمكنك فرزها وتصفيتها وتعديلها.",
    "ER diagrams": "مخططات ER",
    "See the tables and their relations as a diagram, and export it as a picture, Mermaid, DBML or PlantUML.": "اعرض الجداول وعلاقاتها في مخطط، وصدّره صورةً أو Mermaid أو DBML أو PlantUML.",
    "Import and export": "الاستيراد والتصدير",
    "Import CSV, JSON and Excel files; export to CSV, JSON, Excel, SQL and Markdown; back up SQLite databases.": "استورد ملفات CSV وJSON وExcel، وصدّر إلى CSV وJSON وExcel وSQL وMarkdown، وانسخ قواعد SQLite احتياطيًا.",
    "Smart menus and AI": "قوائم ذكية وذكاء اصطناعي",
    "Right-click any table for the right actions, and ask the AI to write a query in plain words, explain it or make it faster.": "انقر بزر الفأرة الأيمن على أي جدول لتظهر الإجراءات المناسبة، واطلب من الذكاء الاصطناعي كتابة استعلام بكلمات بسيطة أو شرحه أو تسريعه.",
    "One app to install and update every SelfStudy desktop app. It picks the right installer for your computer by itself.": "تطبيق واحد لتثبيت جميع تطبيقات SelfStudy المكتبية وتحديثها. يختار المثبّت المناسب لحاسوبك تلقائيًا.",
    "Every app in one place": "كل التطبيقات في مكان واحد",
    "Office, the Text Editor, Studio DB, SelfStudyCode, Interview Helper, Video Editor, Protection, Browser, VPN and WiFi Connect.": "Office ومحرر النصوص وStudio DB وSelfStudyCode وInterview Helper وVideo Editor وProtection وBrowser وVPN وWiFi Connect.",
    "The right file for your computer": "الملف المناسب لحاسوبك",
    "Windows, macOS for Intel or Apple Silicon, or Linux: the store downloads the build made for your system.": "Windows أو macOS لمعالجات Intel أو Apple Silicon أو Linux: ينزّل المتجر النسخة المصنوعة لنظامك.",
    "Install with one click": "التثبيت بنقرة واحدة",
    "See the download progress, install, open and remove apps without searching for files.": "تابع تقدّم التنزيل وثبّت التطبيقات وافتحها وأزلها دون البحث عن الملفات.",
    "Always up to date": "محدّث دائمًا",
    "The store checks for new versions and updates your apps, and itself, when you allow it.": "يتحقق المتجر من الإصدارات الجديدة ويحدّث تطبيقاتك ونفسه عندما تسمح بذلك.",
};

export default tools;
