/**
 * The CV Builder, the drawing papers, the AI chat and the newscast chrome —
 * Chinese (Simplified).
 *
 * The mirror of `../ar/tools.ts`, and its header applies here too: the CV
 * Builder's long warnings about what the AI did and did not invent are
 * translated in full rather than summarised, because they are the difference
 * between a candidate sending out a CV they can defend in an interview and one
 * they cannot — and the reader most at risk is the one who cannot read the
 * English.
 *
 * The newscast's own bilingual phrase table (`PHRASES` in `newscastEngine.ts`)
 * is a separate mechanism about the BULLETIN's language, which is not the same
 * question as the site's: the bulletins are scraped in Arabic and English and
 * there is no Chinese one to read. A Chinese reader gets Chinese studio
 * furniture and picks whichever bulletin exists.
 */

import type { Catalogue } from '../../index';

const tools: Catalogue = {
    /* ---------------------------------------------------------------- *
     * AI Chat (app 27)
     * ---------------------------------------------------------------- */
    'AI Chat Assistant': 'AI 智能助手',
    'Ask me anything about your courses, labs, or general knowledge':
        '课程、实验室或任何常识问题，都可以问我',

    /* The saved conversations, and the memory each one carries. */
    'New chat': '新建对话',
    'Your chats': '你的对话',
    'Search chats': '搜索对话',
    'No chats yet. Start one and it will be saved here.': '还没有对话。开始一个，它就会保存在这里。',
    'No chats match that search.': '没有符合该搜索的对话。',
    'Name this chat': '为这个对话命名',
    'Rename': '重命名',
    'Pin': '置顶',
    'Unpin': '取消置顶',
    'Pinned': '已置顶',
    'Yesterday': '昨天',
    'Previous 7 days': '过去 7 天',
    'Previous 30 days': '过去 30 天',
    'Older': '更早',
    'Delete this chat and everything in it?': '删除这个对话及其中的所有内容？',
    'Could not load your chats.': '无法加载你的对话。',
    'Could not open that chat.': '无法打开该对话。',
    'Could not start a new chat.': '无法新建对话。',
    'Could not rename that chat.': '无法重命名该对话。',
    'Could not delete that chat.': '无法删除该对话。',
    'Could not send that message.': '无法发送该消息。',
    'Could not clear that chat.': '无法清空该对话。',
    'Could not save that.': '无法保存。',
    'What are you working on?': '你在做什么？',
    'Everything you say here is saved, and the assistant will remember the project next time you open this chat.':
        '你在这里说的一切都会被保存，下次打开这个对话时，助手仍然记得这个项目。',
    'Type your message… (Enter to send, Shift+Enter for a new line)':
        '输入你的消息……（Enter 发送，Shift+Enter 换行）',
    'Thinking…': '思考中……',
    'Copy code': '复制代码',
    'Memory': '记忆',
    'What you are working on': '你正在做的事',
    'The assistant fills this in as you talk. Edit it to correct what it remembers.':
        '助手会在交流中填写这里。编辑它可以纠正助手记住的内容。',
    'Update from this chat': '根据本对话更新',
    'Updating…': '正在更新……',
    'Clear chat': '清空对话',
    'Clear every message here, and what the assistant remembers?': '清空这里的所有消息，以及助手记住的内容？',
    'The assistant is updating what it remembers from this chat.':
        '助手正在更新它从本对话中记住的内容。',
    'Earlier in this chat': '此对话的早前内容',
    'The assistant remembers this project': '助手记得这个项目',
    'Could not read what the assistant remembers.': '无法读取助手记住的内容。',
    'The assistant could not be reached. Nothing was changed.': '无法连接到助手。没有任何改动。',
    'The assistant could not be reached. Your message was saved — try again.':
        '无法连接到助手。你的消息已保存 —— 请重试。',
    'Nothing yet — the assistant learns what you are working on as you go.':
        '暂时还没有 —— 助手会在交流中逐步了解你正在做的事。',
    'The assistant can see all {v0} messages in this chat.': '助手可以看到本对话中全部 {v0} 条消息。',
    'The assistant reads the last {v0} messages in full, and remembers the {v1} before them as notes.':
        '助手会完整阅读最近 {v0} 条消息，并把之前的 {v1} 条记成笔记。',

    /* ---------------------------------------------------------------- *
     * The newscast page's own chrome
     * ---------------------------------------------------------------- */
    'No headlines yet.': '暂无头条。',

    /* ---------------------------------------------------------------- *
     * Drawing papers (app 34)
     * ---------------------------------------------------------------- */
    'Drawing papers': '画板',
    'A shared whiteboard for lessons, diagrams and working through a problem. Papers are private until you share them — free with your account, no subscription needed.':
        '用于讲课、画图和推演题目的共享白板。画板在分享之前都是私有的 —— 账户内免费使用，无需订阅。',
    'New paper': '新建画板',
    'No papers yet.': '还没有画板。',
    'Create your first paper': '创建你的第一个画板',
    'Open a blank paper and start drawing — pen, shapes, text and sticky notes.':
        '打开一个空白画板开始画 —— 画笔、图形、文字和便签。',
    'Paper': '画板',
    'Blank': '空白',
    'Algebra — week 3': '代数 —— 第 3 周',
    'Shared with me': '共享给我的',
    'Shared with {v0}': '共享给 {v0}',
    'Size': '大小',
    /*
     * TWO WHOLE SENTENCES rather than a sentence with a value in it - see
     * the Arabic note. The interpolated fragment was bare English, so a
     * Chinese reader got 「链接：can view」.
     */
    'Link: can view': '链接：可查看',
    'Link: can edit': '链接：可编辑',
    'You can edit': '你可以编辑',
    '{v0} · edited {v1}': '{v0} · 编辑于 {v1}',
    '{v0} item{v1} · edited {v2}': '{v0} 个元素 · 编辑于 {v2}',
    'Delete “{v0}”?': '删除“{v0}”？',
    'This removes the paper and everything drawn on it, for everyone it is shared with. It cannot be undone.':
        '这会为所有被共享者删除该画板及其上的全部内容，且无法撤销。',
    'Keep it': '保留',

    'Opening the paper…': '正在打开画板……',
    'Opening the shared paper…': '正在打开共享的画板……',
    'Paper title': '画板标题',
    'Back to my papers': '返回我的画板',
    'Back to papers': '返回画板列表',
    'Save a copy to my papers': '保存副本到我的画板',
    'Clear the paper': '清空画板',
    'Clear this paper?': '要清空这个画板吗？',
    'Everything drawn on it will be erased, for everyone. Undo can bring it back while this tab stays open.':
        '画板上的全部内容都会为所有人清除。只要此标签页不关闭，撤销仍可恢复。',
    'This paper is private, or it is no longer shared with you. Ask whoever owns it to share it again.':
        '此画板为私有，或已不再共享给你。请让所有者重新分享。',

    'Undo (Ctrl Z)': '撤销（Ctrl Z）',
    'Redo (Ctrl Shift Z)': '重做（Ctrl Shift Z）',
    'Fit to screen (Ctrl 0)': '适应屏幕（Ctrl 0）',
    'Clear the page': '清空页面',
    'Fill': '填充',
    'No fill': '无填充',
    'Any colour': '任意颜色',

    'Share this paper': '分享此画板',
    'Share “{v0}”': '分享“{v0}”',
    'Who has access': '有权访问的人',
    'Add a person': '添加成员',
    'Add as {v0}': '以{v0}身份添加',
    'Search by username, name or email': '按用户名、姓名或邮箱搜索',
    'Searching…': '搜索中……',
    'Permission': '权限',
    'Can view': '可查看',
    'Owner — can edit, share and delete': '所有者 —— 可编辑、分享和删除',
    'Only people you add can open this paper.': '只有你添加的人才能打开此画板。',
    'Link access': '链接访问',
    'Share link': '分享链接',
    'New link': '生成新链接',
    'No link — private': '无链接 —— 私有',
    'Anyone with the link': '任何拿到链接的人',
    'Anyone with the link can view': '任何拿到链接的人都可查看',
    'Anyone with the link can edit': '任何拿到链接的人都可编辑',
    'Anyone holding this link can open the paper without signing in. Turning the link off or making a new one stops the old one working immediately.':
        '任何拿到此链接的人都可以不登录直接打开画板。关闭链接或生成新链接后，旧链接会立即失效。',
    'Invalidate the old link and make a new one': '作废旧链接并生成新链接',
    'Done': '完成',

    /* ---------------------------------------------------------------- *
     * CV Builder (app 33) — the library
     * ---------------------------------------------------------------- */
    'Import, dictate, tailor and download a professional CV — every version saved to your account.':
        '导入、口述、按岗位定制并下载一份专业简历 —— 每个版本都保存在你的账户里。',
    'CVs': '简历',
    'Loading your CVs…': '正在加载你的简历……',
    'You have no CVs yet. Upload one, dictate one, or start from blank — all three end up in the same editor.':
        '你还没有简历。可以上传、口述，或从空白开始 —— 三种方式最终都进入同一个编辑器。',
    'Search by title, name or role…': '按标题、姓名或岗位搜索……',
    'Average completeness': '平均完成度',
    'Best job match': '最高岗位匹配度',
    'Tailored to a job': '已按岗位定制',
    'Tailored{v0}': '已定制{v0}',
    '{v0} · updated {v1}': '{v0} · 更新于 {v1}',
    '{v0}% complete · {v1} role{v2} · {v3} skill{v4} · {v5} words':
        '完成 {v0}% · {v1} 段经历 · {v3} 项技能 · {v5} 个词',
    'Upload your current CV': '上传你现有的简历',
    'PDF or DOCX. The AI reads it, pulls out every role, date and skill, and hands you an editable CV you can then enhance.':
        '支持 PDF 或 DOCX。AI 会读取内容，提取每段经历、日期和技能，并生成一份可编辑的简历供你进一步优化。',
    'Choose a file': '选择文件',
    'or drop it here': '或拖拽到此处',
    'PDF, DOCX or TXT · up to 12 MB': 'PDF、DOCX 或 TXT · 最大 12 MB',
    'Paste text instead': '改为粘贴文本',
    'Paste CV text': '粘贴简历文本',
    'Already have your history written down — in an email, a LinkedIn export, a note? Paste it and the AI structures it the same way.':
        '你的经历已经写在别处了 —— 邮件、LinkedIn 导出或一段笔记？粘贴过来，AI 会以同样的方式整理成结构化内容。',
    'See the text we read from your file ({v0} words)': '查看我们从文件中读取的文本（{v0} 个词）',
    'Build it by talking': '用说话来生成',
    'No CV to start from? Describe your experience out loud for a minute or two and the AI writes the whole thing. Add a photo and pick a template afterwards.':
        '没有可参考的简历？用一两分钟口头描述你的经历，AI 会写出整份简历。之后再添加照片、挑选模板。',
    'Start the voice builder': '开始语音生成',
    'Keep going — about 60 characters of speech is the minimum.': '继续说 —— 至少需要约 60 个字符的语音内容。',
    'Build from a job description': '根据岗位描述生成',
    'Start from the job you want': '从你想要的岗位出发',
    'No CV at all? Paste the advert and the AI writes a complete draft aimed at that role — the right sections, the posting\'s skills, and real bullets you edit. Anything it cannot know about you is left in':
        '完全没有简历？粘贴招聘广告，AI 会针对该岗位写出一份完整草稿 —— 合适的板块、招聘信息中的技能，以及可供你修改的真实条目。凡是它无法得知的信息，都会留在',
    'for you to fill in.': '中，由你补充。',
    'Leave it empty and you get a scaffold to fill in. Nothing is ever invented about you — no employer, date, degree or certificate the AI has not been told.':
        '留空则会得到一个待填写的框架。关于你的信息绝不会被编造 —— 没有告知过 AI 的雇主、日期、学位或证书，它都不会写进去。',
    'Copy “{v0}”': '复制“{v0}”',
    'Name for the copy': '副本名称',
    'The copy is a separate CV — editing it never touches the original. Give it a name you will recognise in the list.':
        '副本是一份独立的简历 —— 编辑它不会影响原件。请起一个你在列表里能认出来的名字。',
    'Download “{v0}”': '下载“{v0}”',
    'Name the file. Six applications means six PDFs in one downloads folder, and every one of them is called after you unless you say otherwise.':
        '给文件起个名。投六个岗位就是同一个下载文件夹里的六个 PDF，如果不另行命名，它们全都叫你的名字。',
    'Delete this CV?': '删除这份简历？',
    '“{v0}” will be removed from your CV Builder. This cannot be undone from here.':
        '“{v0}”将从你的简历生成器中移除，此处无法撤销。',
    'Every template renders identically in PDF and DOCX. You can switch template on any CV at any time — it never changes your content.':
        '每个模板在 PDF 和 DOCX 中的呈现完全一致。你可以随时为任意简历切换模板 —— 内容不会因此改变。',
    'Heads up:': '请注意：',

    /* ---------------------------------------------------------------- *
     * CV Builder — the editor
     * ---------------------------------------------------------------- */
    'Loading your CV…': '正在加载你的简历……',
    'Back to my CVs': '返回我的简历',
    'CV title': '简历标题',
    'Download this CV': '下载此简历',
    'Rendered on the server from the template you can see, including edits you have not saved. Name the file so you can tell this application from the next one.':
        '文件在服务器端按你当前看到的模板生成，包含尚未保存的修改。给文件起个名，以便与下一次投递区分开。',
    'The download is rendered on the server from this same template, so the file matches what you see here. Unsaved edits are included in the download.':
        '下载文件由服务器按同一模板生成，因此与你在这里看到的一致。未保存的修改也会包含在内。',
    '{v0}% complete · {v1} words': '完成 {v0}% · {v1} 个词',
    'Sections': '板块',
    'Drag-free ordering: move a section up or down, or hide it. Hidden sections keep their content — they just do not print.':
        '无需拖拽的排序：把板块上移、下移或隐藏。隐藏的板块会保留内容 —— 只是不会打印出来。',
    'Move up': '上移',
    'Move down': '下移',
    'Personal details': '个人信息',
    'Full name': '姓名',
    'Professional title': '职位头衔',
    'Professional summary': '个人简介',
    '{v0} characters. Recruiters read this first and often only this.':
        '{v0} 个字符。招聘方最先看的就是这一段，而且往往只看这一段。',
    'Phone': '电话',
    'Location': '所在地',
    'Link': '链接',
    'Experience': '工作经历',
    'Job title': '职位名称',
    'Company': '公司',
    'Dates': '起止时间',
    'I still work here': '我目前仍在此任职',
    'What you did — one per line': '你做了什么 —— 每行一条',
    'What you achieved — one per line': '你取得了什么成果 —— 每行一条',
    'Highlights — one per line': '亮点 —— 每行一条',
    'Title & company': '职位与公司',
    'No roles yet. Add one, or import a CV and the AI fills this in for you.':
        '还没有工作经历。手动添加一条，或导入一份简历让 AI 帮你填好。',
    '+ Add role': '+ 添加经历',
    '+ Add group': '+ 添加分组',
    'Group name — optional': '分组名称 —— 可选',
    'Education': '教育经历',
    'Qualification': '学历 / 资格',
    'Organisation': '院校 / 机构',
    'Grade': '成绩',
    'Level': '水平',
    'Issuer': '颁发机构',
    'Skills': '技能',
    'Skills — comma separated': '技能 —— 用逗号分隔',
    'Tech — comma separated': '技术栈 —— 用逗号分隔',
    'Tools and technologies — comma separated': '工具与技术 —— 用逗号分隔',
    'Interests — comma separated': '兴趣爱好 —— 用逗号分隔',
    'Projects': '项目经历',
    'Certifications': '证书',
    'Languages': '语言能力',
    'Awards': '获奖',
    'Award': '奖项',
    'Volunteering': '志愿经历',
    'Extras': '其他',
    'Certifications, licences and degrees are never written in for you because employers verify them. Add any you genuinely hold in the editor.':
        '证书、执照和学位绝不会替你写上，因为雇主会去核实。请在编辑器中自行添加你真正持有的项目。',
    'Never added for you — a certificate is checked.': '绝不替你添加 —— 证书是会被核实的。',

    /* CV Builder — the AI actions, and the honesty around them. */
    'Enhance into a copy': '优化并生成副本',
    'The AI sharpens your wording, turns responsibilities into achievements and fixes the grammar. It will not add a job, a date, a degree or a metric you did not write — if it appears to, treat that as a bug and tell us.':
        'AI 会打磨你的措辞，把职责改写为成果，并修正语法。它不会添加你没有写过的工作、日期、学位或数据 —— 如果看起来添加了，请当作缺陷反馈给我们。',
    'Get it reviewed': '获取评审意见',
    'A recruiter-style critique. It changes nothing — it tells you what a screener would notice in the 30 seconds they spend.':
        '以招聘方视角给出的评点。它不会改动任何内容 —— 只告诉你筛选者在那 30 秒里会注意到什么。',
    'Match this CV to a job': '将此简历匹配到岗位',
    'Paste the job description and the AI rewrites the CV to answer it — writing the posting\'s required skills, tools and technologies into your skills section and into the roles where that work belongs, then rewriting your summary and headline to target the title. Everything it adds is listed below for you to review.':
        '粘贴岗位描述，AI 会针对它重写简历 —— 把招聘信息中要求的技能、工具和技术写进你的技能板块以及相应的工作经历中，再改写你的简介和头衔来对准该职位。它添加的所有内容都会列在下方供你审阅。',
    'Reading the posting and rewriting your CV against it — this usually takes a few seconds. Your CV is saved either way.':
        '正在阅读招聘信息并据此重写你的简历 —— 通常需要几秒钟。无论结果如何，你的简历都已保存。',
    'Tailoring into a copy keeps this CV as your general one.': '定制到副本可以让这份简历继续作为你的通用简历。',
    'Target role — optional': '目标岗位 —— 可选',
    'Anything specific to change — optional': '有什么具体想改的 —— 可选',
    'Tone': '语气',
    'Professional — the default': '专业 —— 默认',
    'Concise — cut every spare word': '精简 —— 删掉每一个多余的词',
    'Impact-first — lead with outcomes': '成果优先 —— 先讲结果',
    'Academic — formal and precise': '学术 —— 正式且精确',
    'Add to this CV by talking': '用说话为此简历补充内容',
    'Dictate the experience you want on this CV. The AI rewrites the CV from what you say — so use this when you want to rebuild the content, not to add a single line.':
        '口述你想写进这份简历的经历。AI 会根据你说的内容重写整份简历 —— 所以这适合用来重建内容，而不是补一句话。',
    'Replace this CV\'s content': '替换此简历的内容',
    'Rewrite the whole CV': '重写整份简历',
    'Your current content will be replaced': '你当前的内容将被替换',
    ', or use “as a new CV” to keep it.': '，或选择“另存为新简历”以保留原件。',
    'Confirm before you send this': '投出去之前请先确认',
    'What the AI changed': 'AI 改了什么',
    'Added to your CV — review these': '已添加到你的简历 —— 请逐条核对',
    'Read the “Added to your CV” list before you apply and delete anything you cannot stand behind in an interview. Credentials — certifications, licences, degrees — are never added for you, because they are checked.':
        '投递前请先读一遍“已添加到你的简历”清单，凡是面试时无法为之背书的内容都要删掉。而证书、执照、学位这类资质绝不会替你添加，因为它们会被核实。',
    'Open the editor tabs and delete anything here you could not defend in an interview — you are the last check on this list.':
        '打开编辑器各标签页，删掉这里任何你在面试中无法解释的内容 —— 这份清单的最后一道关是你自己。',
    'Still missing — only you can add these': '仍然缺失 —— 只有你能补上',
    '{v0} detail{v1} still in square brackets.': '还有 {v0} 处内容留在方括号里。',
    'Nothing about your history was invented, so each one is a fact only you can supply. Replace them all before you send this CV anywhere.':
        '关于你的经历没有任何编造，因此每一处都是只有你才能提供的事实。把它们全部替换后再投出这份简历。',
    'No blanks left. Read it through anyway — the bullets were written from the advert, so they describe the job rather than what you actually did.':
        '没有空缺了。但仍请通读一遍 —— 这些条目是根据招聘广告写的，描述的是岗位要求，而不是你实际做过的事。',
    'Drafted from this job ad': '根据此招聘广告起草',
    'Match report': '匹配报告',
    '{v0}% job match': '岗位匹配度 {v0}%',
    'was {v0}%': '此前为 {v0}%',
    'tailored {v0}': '定制于 {v0}',
    'Why you fit': '你为何合适',
    'Gaps': '差距',
    'Quick wins': '快速可改进项',
    'Working well': '表现良好之处',
    'What to do about it': '该如何处理',
    'What to do next': '下一步该做什么',
    'Credentials this role asks for': '此岗位要求的资质',
    'Already evidenced': '已有证据支持',
    'ATS notes': 'ATS 筛选提示',
    'ATS-safe': '对 ATS 友好',
    'AI is unavailable on this replica': '此副本上的 AI 功能不可用',
    'No AI provider key is configured on the CV Builder service, so enhancing, reviewing and tailoring cannot run right now. Editing, templates and downloads all still work.':
        '简历生成器服务上没有配置 AI 提供方密钥，因此优化、评审和岗位定制暂时无法运行。编辑、模板和下载功能均正常。',

    /* CV Builder — the photo studio. */
    'Show a picture on the CV': '在简历上显示照片',
    'Optional. Some markets expect a photo, others screen it out — if you are unsure, leave the avatar or turn the photo off. Pick a default avatar and it is used in the PDF and DOCX exactly as you see it here.':
        '可选。有些地区期待简历带照片，有些则会因此筛掉 —— 如果不确定，可以保留头像或关闭照片。选择默认头像后，PDF 和 DOCX 中会与这里显示的完全一致。',
    'Upload or take a photo, drag it to centre your face, and swap the background for a professional colour. Your face is never removed — only the area around you.':
        '上传或拍摄一张照片，拖动使面部居中，并将背景替换为专业色。你的面部绝不会被抹除 —— 只处理周围区域。',
    'Or use a default avatar': '或使用默认头像',
    'Remove photo': '移除照片',
    'The {v0} template never prints a picture — pick another template if you want one shown.':
        '{v0} 模板从不打印照片 —— 若想显示照片，请另选模板。',
    'Colour & type': '颜色与字体',
    'Font': '字体',
    'Use the template\'s own colour': '使用模板自带的颜色',
    'Circle': '圆形',
    'Square': '方形',
    'Rounded': '圆角',
    'custom': '自定义',
    'empty': '空',

    /* CV Builder — the sample values, localised so a placeholder reads as a
     * placeholder. 张伟 is the Chinese equivalent of a stand-in name; the date
     * takes the Chinese format, because a date is exactly the field somebody
     * copies the shape of. */
    'Layla Haddad': '张伟',
    'Senior Backend Engineer': '高级后端工程师',
    'Senior DevOps Engineer': '高级 DevOps 工程师',
    'Amman, Jordan': '约旦 安曼',
    'Computer Science': '计算机科学',
    'Mar 2021': '2021 年 3 月',
    'Very Good / 3.6 GPA': '良好 / GPA 3.6',
    // SelfStudyCode download (AI Chat page). Commands and product UI words stay in English.
    'The installers are being built. Please check back in a few minutes.': '安装包正在构建中，请几分钟后再来查看。',
    'Version {v0}': '版本 {v0}',
    'Detected: {v0}': '检测到的系统：{v0}',
    'Command line (CLI) for {v0}': '{v0} 命令行工具（CLI）',
    'Desktop app': '桌面应用',
    'Command line (CLI)': '命令行（CLI）',
    'How to install the command line tool': '如何安装命令行工具',
    'Then open a project folder in a terminal and run selfstudycode.': '然后在终端中打开项目文件夹，运行 selfstudycode。',
    'No internet? It also works offline with a model running on your computer (Ollama, LM Studio or llama.cpp): run selfstudycode --offline.': '没有网络？它也可以离线使用你电脑上运行的模型（Ollama、LM Studio 或 llama.cpp）：运行 selfstudycode --offline。',
    'The installers are not code-signed yet: Windows may show "Windows protected your PC" (choose More info, then Run anyway), and macOS may ask you to open it from System Settings, Privacy & Security.':
        '安装包暂未进行代码签名：Windows 可能显示 "Windows protected your PC"（请选择 More info，然后 Run anyway），macOS 可能要求你在 System Settings 的 Privacy & Security 中允许打开。',
    'Windows': 'Windows',
    'macOS': 'macOS',
    'Linux': 'Linux',
    'your system': '你的系统',
    'Could not load the downloads right now. Please try again.': '暂时无法加载下载列表，请重试。',
    'Could not start the download. Please try again.': '无法开始下载，请重试。',
    // SelfStudy Products (/products) and the AI Chat's attachments and voice input.
    "SelfStudy Products": "SelfStudy 产品",
    "Desktop apps for your computer": "适用于你电脑的桌面应用",
    "Desktop apps for your own computer, included with your AI Features subscription. Download the latest version for Windows, macOS or Linux.": "适用于你自己电脑的桌面应用，包含在 AI 功能订阅中。下载适用于 Windows、macOS 或 Linux 的最新版本。",
    "See plans": "查看套餐",
    "Could not check your subscription right now. Please try again.": "暂时无法核实你的订阅，请重试。",
    "Download for {v0}": "下载 {v0} 版",
    "These apps run on a computer. Open this page on your Windows, Mac or Linux computer to download them.": "这些应用在电脑上运行。请在你的 Windows、Mac 或 Linux 电脑上打开此页面进行下载。",
    "There is no build for this computer yet. Every available build is listed below.": "暂时没有适用于此电脑的版本。所有可用版本列在下方。",
    "System requirements": "系统要求",
    "All downloads": "全部下载",
    "Video Editor": "视频编辑器",
    "Desktop app and command line · Windows, macOS and Linux": "桌面应用和命令行 · Windows、macOS 和 Linux",
    "Your AI coding agent. It writes and fixes code, runs your tests, reviews changes, and makes images, videos and documents - on your own computer. Sign in with your SelfStudyJo account.": "你的 AI 编程助手。它在你自己的电脑上编写和修复代码、运行测试、审查改动，并制作图片、视频和文档。使用你的 SelfStudyJo 账号登录。",
    "Works in your project": "在你的项目中工作",
    "It reads your files, edits them, runs commands and tests, and asks before it does anything risky.": "它读取并编辑你的文件、运行命令和测试，并在执行任何有风险的操作前先征求你的同意。",
    "Desktop app or terminal": "桌面应用或终端",
    "Use the desktop app, or the selfstudycode command in any terminal on Windows, macOS or Linux.": "使用桌面应用，或在 Windows、macOS 或 Linux 的任意终端中使用 selfstudycode 命令。",
    "Explainer videos and documents": "讲解视频和文档",
    "It can turn a topic, a scanned page or a PDF into a narrated-style explainer video, diagrams and clean documents.": "它可以把一个主题、一页扫描件或一个 PDF 变成讲解视频、图表和整洁的文档。",
    "Works offline too": "也可离线使用",
    "Windows 10 or 11 (64-bit), macOS 12 or newer (Intel or Apple Silicon), or a 64-bit Linux such as Ubuntu 20.04 or newer.": "Windows 10 或 11（64 位）、macOS 12 或更高版本（Intel 或 Apple Silicon），或 64 位 Linux，例如 Ubuntu 20.04 或更高版本。",
    "4 GB of memory; 8 GB or more to run a local model offline.": "4 GB 内存；离线运行本地模型需要 8 GB 或更多。",
    "About 500 MB of free disk space.": "约 500 MB 可用磁盘空间。",
    "An internet connection to use the SelfStudyJo AI models.": "使用 SelfStudyJo AI 模型需要联网。",
    "4 GB of memory, a microphone, and an internet connection.": "4 GB 内存、一个麦克风和网络连接。",
    "A full video editor whose edits you can also describe in plain words, or say out loud: \"remove the parts with no audio longer than 3 seconds, improve the sound and add Arabic captions\". The app does the work on your computer and one Undo takes it all back.": "一款完整的视频编辑器，你也可以用简单的话描述或直接说出要做的编辑：\"删除超过 3 秒的无声片段，改善音质并添加阿拉伯语字幕\"。应用在你的电脑上完成处理，一次撤销即可全部还原。",
    "A real timeline": "真正的时间线",
    "Several video and audio tracks, split, trim, move, speed, volume, fades, text and markers.": "多条视频和音频轨道，支持分割、裁剪、移动、变速、音量、淡入淡出、文字和标记。",
    "Edit by asking": "说一说就能编辑",
    "Type or speak what you want. The AI answers with a plan of steps, and you see every step before it is applied.": "输入或说出你想要的效果。AI 会给出分步计划，每一步在执行前你都能看到。",
    "One-click clean-ups": "一键优化",
    "Improve the sound, fix a dark video, stabilise, denoise, crop for vertical video, and ready-made looks.": "改善音质、修复偏暗的视频、防抖、降噪、裁剪为竖屏，以及现成的画面风格。",
    "Captions and export": "字幕与导出",
    "Captions from the speech in your video, burned in or saved as .srt, and export to MP4, MOV, MKV, WebM, GIF or audio only.": "根据视频中的语音生成字幕，可烧录进画面或保存为 .srt，并可导出为 MP4、MOV、MKV、WebM、GIF 或仅音频。",
    "8 GB of memory recommended for HD video.": "处理高清视频建议 8 GB 内存。",
    "Free disk space for your videos and exports.": "为你的视频和导出文件预留可用磁盘空间。",
    "Your videos stay on your computer: only the spoken command and a short summary of the video are sent to the AI.": "你的视频留在你的电脑上：只有说出的指令和视频的简短摘要会发送给 AI。",
    "Attachments": "附件",
    "only the start was read": "只读取了开头部分",
    "Remove {v0}": "移除 {v0}",
    "Listening… {v0}s. Press the microphone again to stop.": "正在聆听… {v0} 秒。再按一次麦克风即可停止。",
    "Turning your voice into text…": "正在把你的语音转成文字…",
    "You can attach one image, text or code files, Word documents (.docx) and PDFs. Images up to 4 MB, files up to 1 MB.": "你可以附加一张图片、文本或代码文件、Word 文档（.docx）和 PDF。图片最大 4 MB，文件最大 1 MB。",
    "Attach a file or image": "附加文件或图片",
    "Stop recording": "停止录音",
    "Speak your message": "说出你的消息",
    "That attachment is too large.": "该附件太大。",
    "One of those files cannot be read here. Attach an image, a text or code file, a .docx or a PDF.": "其中有文件无法在此读取。请附加图片、文本或代码文件、.docx 或 PDF。",
    "That attachment could not be used.": "无法使用该附件。",
    "\"{v0}\" cannot be read here. Attach an image, a text or code file, a .docx or a PDF.": "无法在此读取\"{v0}\"。请附加图片、文本或代码文件、.docx 或 PDF。",
    "You can attach up to {v0} files to one message.": "每条消息最多可附加 {v0} 个文件。",
    "Attach one image per message.": "每条消息只能附加一张图片。",
    "\"{v0}\" is too large.": "\"{v0}\"太大。",
    "That file could not be read.": "无法读取该文件。",
    "The microphone could not be used. Allow microphone access in your browser and try again.": "无法使用麦克风。请在浏览器中允许访问麦克风后重试。",
    "That recording is too long. Keep it under two minutes.": "录音太长。请控制在两分钟以内。",
    "No speech was heard. Try again a little closer to the microphone.": "没有听到语音。请靠近麦克风一点再试。",
    "Your voice could not be turned into text. Please try again.": "无法把你的语音转成文字，请重试。",
};

export default tools;
