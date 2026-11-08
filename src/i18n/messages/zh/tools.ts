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
    "One installer: desktop app and command line · Windows, macOS and Linux": "一个安装包：桌面应用和命令行 · Windows、macOS 和 Linux",
    "Your AI coding agent. It writes and fixes code, runs your tests, reviews changes, and makes images, videos and documents - on your own computer. Sign in with your SelfStudyJo account.": "你的 AI 编程助手。它在你自己的电脑上编写和修复代码、运行测试、审查改动，并制作图片、视频和文档。使用你的 SelfStudyJo 账号登录。",
    "Works in your project": "在你的项目中工作",
    "It reads your files, edits them, runs commands and tests, and asks before it does anything risky.": "它读取并编辑你的文件、运行命令和测试，并在执行任何有风险的操作前先征求你的同意。",
    "Desktop app and command line": "桌面应用和命令行",
    "One installer gives you both the desktop app and the selfstudycode command (short name: ssc). They share your sign-in, settings, chats and local models.": "一个安装包同时为你提供桌面应用和 selfstudycode 命令（简称 ssc）。两者共用你的登录、设置、对话和本地模型。",
    "Explainer videos and documents": "讲解视频和文档",
    "Give it a folder of exam files and it makes one silent explainer video per file: questions and answers side by side with arrows, code next to its real output, cleaned scans, Arabic labels. It also makes 3D animated scenes with free sound effects.": "给它一个装着试卷文件的文件夹，它会为每个文件制作一段无声讲解视频：题目和答案并排并配有箭头，代码旁边显示真实运行结果，扫描件经过清理，标注使用阿拉伯语。它还能制作配有免费音效的 3D 动画场景。",
    "Made for everyday computers": "为普通电脑而设计",
    "It watches memory and the processor and slows itself down when your computer is busy, so it keeps working on an 8 GB laptop without freezing it. Your chats are saved as you go, and a long task always ends with a report of what was done.": "它会关注内存和处理器的使用情况，在电脑繁忙时自动放慢速度，因此在 8 GB 内存的笔记本上也能持续工作而不会让电脑卡死。你的对话会随时保存，长时间的任务总会以一份完成情况报告结束。",
    "Apps that start working": "一开始就能运行的应用",
    "New desktop, web and mobile apps start from templates that already build and run (Electron, React, Vue, Flask, FastAPI, Express, Expo). It adds your features step by step and launches the app to check it after each one.": "新的桌面、网页和手机应用都从已经能构建和运行的模板开始（Electron、React、Vue、Flask、FastAPI、Express、Expo）。它一步一步加入你的功能，并在每一步之后启动应用进行检查。",
    "Works offline too": "也可离线使用",
    "On first launch, in the app or the terminal, it offers to download a SelfStudy LM model sized for your computer, to a folder you choose. Then it works without the internet or an account. Ollama, LM Studio and llama.cpp work too.": "首次启动时（无论在应用中还是在终端中），它会提出下载一个适合你电脑配置的 SelfStudy LM 模型，保存到你选择的文件夹。之后无需联网、无需账号即可使用。Ollama、LM Studio 和 llama.cpp 也同样可用。",
    "Windows 10 or 11 (64-bit), macOS 12 or newer (Intel or Apple Silicon), or a 64-bit Linux such as Ubuntu 20.04 or newer.": "Windows 10 或 11（64 位）、macOS 12 或更高版本（Intel 或 Apple Silicon），或 64 位 Linux，例如 Ubuntu 20.04 或更高版本。",
    "4 GB of memory; 8 GB or more for SelfStudy LM, the recommended offline model.": "4 GB 内存；使用推荐的离线模型 SelfStudy LM 需要 8 GB 或更多。",
    "About 500 MB of free disk space, plus the offline model you choose.": "约 500 MB 可用磁盘空间，另加你所选离线模型的大小。",
    "An internet connection to use the SelfStudyJo AI models.": "使用 SelfStudyJo AI 模型需要联网。",
    "4 GB of memory and a microphone. An internet connection, or SelfStudy LM on your computer to work offline.": "4 GB 内存和一个麦克风。需要联网，或在电脑上安装 SelfStudy LM 以离线使用。",
    "A full video editor and lecture recorder. Record your screen, camera and voice, get a transcript in any language and AI presentation graphics placed right on what you explain, then edit by describing it in plain words: \"remove the parts with no audio longer than 3 seconds and add Arabic captions\". The work happens on your computer and one Undo takes it all back.": "一款完整的视频编辑器和讲座录制工具。录制你的屏幕、摄像头和声音，获得任何语言的文字稿，以及由 AI 精准放置在你所讲解内容上的演示图形；然后用简单的话描述即可编辑：\"删除超过 3 秒的无声片段并添加阿拉伯语字幕\"。所有处理都在你的电脑上完成，一次撤销即可全部还原。",
    "Record lectures": "录制讲座",
    "Record your screen, camera and microphone. Show the camera as a circle or a square, in a corner, at the side or anywhere you drag it, on a choice of themes. Shortcuts start, pause and stop it from any app.": "录制你的屏幕、摄像头和麦克风。摄像头画面可显示为圆形或方形，放在角落、侧边或任意拖动的位置，并有多种主题可选。快捷键可在任何应用中开始、暂停和停止录制。",
    "A transcript in any language": "任何语言的文字稿",
    "While you speak, your words are transcribed in any language or dialect and saved as a structured transcript, captions and plain text.": "你说话的同时，内容会以任何语言或方言转写成文字，并保存为结构化文字稿、字幕和纯文本。",
    "AI presentation overlays": "AI 演示图形",
    "Tick one box and the AI adds arrows, highlights, flowcharts and step lists exactly where your screen shows what you are explaining, at the moment you say it.": "勾选一个选项，AI 就会在屏幕显示你所讲解内容的位置、在你讲到它的那一刻，添加箭头、高亮、流程图和步骤列表。",
    // Video Editor 1.2.0. The highlight-reel example keeps 精彩/集锦 and a digit
    // before 分钟: those are what the app itself recognises in Chinese
    // (src/shared/highlights.mjs), so the example is one a student can type.
    "Highlighter": "荧光笔",
    "A Highlighter draw tool marks text on the screen: press H, and hold Shift for a straight band.": "荧光笔（Highlighter）绘图工具可标记屏幕上的文字：按 H，按住 Shift 可画出笔直的色带。",
    "Animate segments": "动画片段",
    "Press Animate where a part starts and End animate where it ends: the picture between them becomes an animation of what you are saying - titles, steps, flowcharts, numbers - while your original sound keeps playing.": "在某段开始处按“动画”，在结束处按“结束动画”：两者之间的画面会变成你所讲内容的动画——标题、步骤、流程图、数字——而原声照常播放。",
    "Reader voices": "朗读者声音",
    "A library of voices on your computer, plus your own: record a sample, it is cleaned and matched, then replace the narrator’s voice in any language or dialect, translated and timed to the original.": "电脑上的声音库，也可以加入你自己的声音：录一段样本，系统会清理并匹配，然后用任何语言或方言替换旁白的声音，自动翻译并与原片对齐时间。",
    "AI Highlights": "AI 精彩片段",
    "Type “make a 1 minute highlight reel” and it finds the best moments in the transcript. Preview each one, then make a highlight reel or mark the highlights with title cards. One Undo takes it back.": "输入“做一个 1 分钟的精彩集锦”，它会从文字稿中找出最精彩的时刻。逐一预览后，可以把它们做成精彩集锦，或用标题卡标记这些精彩片段。一次撤销即可还原。",
    "Works offline": "离线可用",
    "With SelfStudy LM, the plan for an editing command is made on your computer, and Whisper turns voice commands and captions into text on your computer too.": "借助 SelfStudy LM，编辑指令的执行计划在你的电脑上生成；Whisper 也会在你的电脑上把语音指令和字幕所需的语音转成文字。",
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
    "Your videos stay on your computer, and the text on your screen is read on your computer too. Online, only your speech, the text found on the screen and a short summary are sent to the AI; working offline with SelfStudy LM, nothing is sent.": "你的视频留在你的电脑上，屏幕上的文字也在你的电脑上识别。联网时，只有你的语音、屏幕上识别到的文字和简短摘要会发送给 AI；使用 SelfStudy LM 离线工作时，不会发送任何内容。",
    // SelfStudyCode 2.0.0: the command line comes in the desktop installer. The
    // app's menu path (Settings › About › Install the command), the commands and
    // the paths are drawn untranslated in their own elements beside these
    // sentences.
    "The command line": "命令行",
    "Since version 2.0, the same installer also gives you the selfstudycode command (short name: ssc). How it reaches your terminal depends on the installer:": "从 2.0 版起，同一个安装包还会为你提供 selfstudycode 命令（简称 ssc）。它如何进入你的终端，取决于安装包的类型：",
    "Your computer": "你的电脑",
    "The installer adds both commands to your PATH, so they work in any new terminal (PowerShell or cmd):": "安装程序会把这两个命令加入你的 PATH，因此它们在任何新的终端（PowerShell 或 cmd）中都可用：",
    "Open the app and choose:": "打开应用，选择：",
    "It links both commands into one of these folders:": "它会把这两个命令链接到以下文件夹之一：",
    "It writes these two files, which start the AppImage:": "它会写入以下两个文件，用来启动该 AppImage：",
    "The installer adds both commands:": "安装程序会添加这两个命令：",
    "Then open a new terminal in your project folder and type selfstudycode, or ssc.": "然后在你的项目文件夹中打开一个新的终端，输入 selfstudycode 或 ssc。",
    // SelfStudy LM, the local AI the three desktop apps share. Model names,
    // sizes and licences are drawn untranslated.
    "SelfStudy LM — the local AI of the desktop apps": "SelfStudy LM：桌面应用的本地 AI",
    "SelfStudy LM lets SelfStudyCode, Interview Helper and Video Editor work on your own computer, without the internet. It is not a new model trained from scratch: it is a packaged suite of open models, built on Qwen3.5 and Qwen3.6 (Qwen, Alibaba Cloud), Whisper (OpenAI) and FLUX.2 (Black Forest Labs).": "SelfStudy LM 让 SelfStudyCode、面试助手和视频编辑器无需联网，就能在你自己的电脑上运行。它不是从零开始训练的新模型，而是一套打包好的开放模型，基于 Qwen3.5 和 Qwen3.6（阿里云 Qwen 团队）、Whisper（OpenAI）和 FLUX.2（Black Forest Labs）。",
    "Downloaded once": "只需下载一次",
    "A model is downloaded once per computer: all three apps use the same models folder, so what one app downloads is there for the others.": "每台电脑只需下载一次模型：三款应用共用同一个模型文件夹，一款应用下载的模型，另外两款也能直接使用。",
    "Private and offline": "私密且离线",
    "It runs on your own computer and works without the internet.": "它在你自己的电脑上运行，无需联网。",
    "Processor or graphics card": "处理器或显卡",
    "It runs on the computer’s processor (CPU), and faster with a graphics card.": "它可以在电脑的处理器（CPU）上运行，有显卡时速度更快。",
    "Chosen in each app": "在各应用内选择",
    "On first launch each app offers the model that fits your computer and asks where to keep it. There is no download button for the models on this website.": "首次启动时，每款应用都会推荐适合你电脑的模型，并询问保存位置。本网站不提供模型下载按钮。",
    "The models": "模型一览",
    "Built on": "基于",
    "Download size": "下载大小",
    "Memory (RAM)": "内存（RAM）",
    "Licence": "许可证",
    "With less memory:": "内存较少时：",
    "Any computer": "任何电脑",
    "A graphics card helps.": "有显卡更好。",
    "Quick answers on any laptop. Installed beside a bigger SelfStudy LM model, it also makes that one faster.": "在任何笔记本电脑上都能快速回答。与更大的 SelfStudy LM 模型一起安装时，还能让后者运行得更快。",
    "The everyday model: lessons, code, video edit plans, interview answers, screenshots and scanned pages.": "日常使用的模型：课程讲解、代码、视频编辑计划、面试回答，以及截图和扫描页面。",
    "More knowledge and better reasoning: longer code, harder questions and careful writing.": "知识更丰富、推理更强：更长的代码、更难的问题和更严谨的写作。",
    "The strongest: agentic coding, long projects and data analysis. A mixture of experts, fast for its size.": "最强的模型：智能体编程、长期项目和数据分析。采用混合专家架构，相对其规模速度很快。",
    "Speech to text in 99 languages, in the Video Editor: voice commands, captions and transcripts.": "支持 99 种语言的语音转文字，用于视频编辑器：语音指令、字幕和文字稿。",
    "Pictures from a description, in SelfStudyCode: illustrations, backgrounds and thumbnails.": "根据描述生成图片，用于 SelfStudyCode：插图、背景和缩略图。",
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
    // Products page: SelfStudy Browser
    "A fast, safe web browser for students. One click puts a tab on a private VPN through the Tor network, and adult and dangerous content is blocked everywhere by AI that runs on your own computer.": "一款为学生打造的快速、安全的浏览器。一键即可让标签页通过 Tor 网络使用私密 VPN；成人和危险内容由在你电脑上运行的 AI 在所有网站拦截。",
    "VPN in one click": "一键 VPN",
    "The VPN button sends a tab through the Tor network: sites cannot see your IP address and nothing from that tab is kept after you quit. Normal tabs stay fast. Choose an exit country or a new identity at any time.": "VPN 按钮让标签页通过 Tor 网络访问：网站看不到你的 IP 地址，退出后该标签页不保留任何内容。普通标签页依旧快速。可随时选择出口国家或更换身份。",
    "No adult websites": "屏蔽成人网站",
    "Close to a million adult sites and over a hundred thousand phishing and scam sites are blocked. SafeSearch and YouTube Restricted Mode are always on.": "屏蔽近一百万个成人网站以及十多万个钓鱼和诈骗网站。安全搜索和 YouTube 受限模式始终开启。",
    "AI hides explicit content": "AI 隐藏不良内容",
    "On YouTube, Facebook, Instagram, X and every other site, explicit pictures, videos and posts are hidden behind a red warning box while you keep scrolling. The AI runs on your computer: nothing you see is uploaded.": "在 YouTube、Facebook、Instagram、X 及其他所有网站上，露骨的图片、视频和帖子会被红色警告框遮挡，你仍可继续滚动。AI 在你的电脑上运行：你看到的内容不会被上传。",
    "Learns what you block": "学习你屏蔽的内容",
    "Right-click a picture, or draw a box around anything, and it stays hidden on that site and everywhere the same picture appears. Signed in, what it learns is synced twice a week with your other computers.": "右键点击图片，或框选任意区域，它就会在该网站以及同一图片出现的任何地方保持隐藏。登录后，学到的内容每周与你的其他电脑同步两次。",
    "Virus-checked downloads": "下载经过病毒扫描",
    "Every download is scanned with Microsoft Defender on Windows or ClamAV on macOS and Linux, and an infected file is deleted.": "每个下载都会被扫描：Windows 上使用 Microsoft Defender，macOS 和 Linux 上使用 ClamAV，受感染的文件会被删除。",
    "Light and up to date": "轻量且保持最新",
    "One shared AI worker that unloads itself when idle, idle tabs put to sleep, and automatic updates twice a week.": "一个共享的 AI 进程在空闲时自动卸载，闲置标签页进入休眠，每周自动更新两次。",
    "4 GB of memory and about 600 MB of free disk space.": "4 GB 内存，约 600 MB 可用磁盘空间。",
    "An account is optional: it is only used for updates and sync.": "账号是可选的：仅用于更新和同步。",
    "Pages, pictures and videos are checked on your own computer and never uploaded. Signed in, only the sites and areas you or the browser blocked are synced. VPN tabs keep nothing after you quit.": "页面、图片和视频都在你自己的电脑上检查，从不上传。登录后，只同步你或浏览器屏蔽的网站和区域。VPN 标签页退出后不保留任何内容。",
    "Download the .dmg for your Mac: arm64 for Apple Silicon, x64 for Intel.": "为你的 Mac 下载对应的 .dmg：Apple Silicon 选 arm64，Intel 选 x64。",
    // Products page: Self-Study for Protection
    "4 GB of memory and about 400 MB of free disk space.": "4 GB 内存，约 400 MB 可用磁盘空间。",
    "Alerts that do not bother you": "不打扰你的提醒",
    "Charts for everything": "一切皆有图表",
    "Choose the install folder and finish. Open the app from the Start menu or the desktop icon.": "选择安装文件夹并完成安装。从开始菜单或桌面图标打开应用。",
    "Download the .exe installer (or the .msi) and run it.": "下载 .exe 安装程序（或 .msi）并运行。",
    "Download the AppImage (any distribution) or the .deb (Debian, Ubuntu).": "下载 AppImage（适用于任何发行版）或 .deb（Debian、Ubuntu）。",
    "Each running program with its owner, start time, live uptime, CPU, memory and digital signature, marked System, User, Suspicious or Dangerous with the reasons. Stop any program that is not part of the operating system, in a table or a 3D view of the process tree.": "列出每个正在运行的程序及其所有者、启动时间、实时运行时长、CPU、内存和数字签名，并标记为系统、用户、可疑或危险，同时说明原因。可以在表格或进程树的 3D 视图中停止任何不属于操作系统的程序。",
    "Every process, explained": "每个进程，一目了然",
    "Finds the devices on your Wi-Fi or cable network, with an icon for each type, its maker, address and first and last time seen. Devices that left stay listed as offline. Dangerous signs like ARP spoofing or a device scanning your computer are flagged.": "发现你的 Wi-Fi 或有线网络中的设备，为每种类型显示图标、制造商、地址以及首次和最后一次出现的时间。离开的设备会保留为离线状态。ARP 欺骗或有设备在扫描你的电脑等危险迹象会被标记。",
    "For full detail on system processes, use Relaunch as administrator inside the app.": "如需系统进程的完整信息，请在应用中使用“以管理员身份重新启动”。",
    "How to install it": "如何安装",
    "If Windows says \"Windows protected your PC\", choose More info, then Run anyway.": "如果 Windows 提示“Windows protected your PC”，请点击“More info”，然后点击“Run anyway”。",
    "Live 2D and 3D charts of CPU per core, memory, network traffic and disk space, with how fast each drive is filling.": "CPU 每个核心、内存、网络流量和磁盘空间的实时 2D 和 3D 图表，并显示每个磁盘的填满速度。",
    "Make the AppImage executable and run it, or install the .deb:": "为 AppImage 添加可执行权限并运行，或安装 .deb：",
    "Nothing about your computer, programs or network leaves your computer: no account, no telemetry. History and alerts are stored only in a folder on your own computer. Only scan networks you own or are allowed to monitor.": "有关你的电脑、程序或网络的任何信息都不会离开你的电脑：无需账户，没有遥测。历史记录和提醒只保存在你自己电脑上的文件夹中。请只扫描你拥有或被允许监控的网络。",
    "Open the .dmg file and drag the app into Applications.": "打开 .dmg 文件，把应用拖到“应用程序”文件夹。",
    "Optional: in System Settings, Privacy & Security, give it Full Disk Access for complete disk scans.": "可选：在“系统设置 › 隐私与安全性”中授予“完全磁盘访问权限”，以完整扫描磁盘。",
    "Optional: install ClamAV to scan files for viruses:": "可选：安装 ClamAV 以扫描文件中的病毒：",
    "Problems appear in the app. Only urgent ones - a dangerous program, a virus, someone signed in remotely, a disk about to be full - also show a desktop notification, even when the window is closed.": "问题会显示在应用中。只有紧急问题——危险程序、病毒、有人远程登录、磁盘即将写满——才会同时显示桌面通知，即使窗口已关闭。",
    "Protects your computer. It watches every program, every device on your network, your disks, processor and memory, checks your antivirus, firewall and sign-ins, explains problems in plain words and gives you the button that fixes them.": "保护你的电脑。它监视每个程序、网络中的每台设备、磁盘、处理器和内存，检查杀毒软件、防火墙和登录情况，用简单的话解释问题，并提供修复问题的按钮。",
    "Shows your antivirus and firewall status, runs quick, full, folder and file virus scans, removes threats, shows who is signed in (remote sessions are flagged) and lists programs that start automatically.": "显示杀毒软件和防火墙状态，运行快速、完整、文件夹和文件病毒扫描，清除威胁，显示谁已登录（标记远程会话），并列出自动启动的程序。",
    "The complete Disk Usage Analyzer: what uses the space on each drive and why, the largest files, a 3D map, files that look malicious, and safe cleanup that protects system files.": "完整的磁盘使用分析器：每个磁盘的空间被什么占用以及原因、最大的文件、3D 地图、疑似恶意的文件，以及保护系统文件的安全清理。",
    "The first time, right-click the app, choose Open, then Open again.": "第一次打开时，右键点击应用，选择“打开”，然后再次点击“打开”。",
    "Virus scanning uses Microsoft Defender on Windows; on macOS and Linux install the free ClamAV.": "病毒扫描在 Windows 上使用 Microsoft Defender；在 macOS 和 Linux 上请安装免费的 ClamAV。",
    "Viruses and break-ins": "病毒与入侵",
    "What fills your disk": "是什么占满了磁盘",
    "Who is on your network": "谁在你的网络上",
};

export default tools;
