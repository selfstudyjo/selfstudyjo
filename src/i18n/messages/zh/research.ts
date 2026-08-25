/**
 * Research Flow — Chinese (Simplified).
 *
 * Thirteen views, and the one application whose vocabulary is most exacting:
 * this is academic register, not interface register. A student writing a thesis
 * in Chinese writes it against Chinese academic conventions, and the terms are
 * settled — 理论框架 for a theoretical framework, 研究问题 for research
 * questions, 研究空白 for a research gap, 研究意义 for significance.
 * Approximating those reads to a supervisor as somebody who has not read a
 * thesis.
 *
 * Two things are deliberately NOT translated:
 *
 *  - **A citation style's name.** APA, IEEE and Harvard are the names of the
 *    styles, and a student told to submit in APA needs to see `APA`.
 *  - **The example values in the search fields.** `Okayama University`,
 *    `Funabiki`, `10.1234/example` are examples of the SHAPE of an answer to a
 *    field that queries OpenAlex and Google Scholar, both of which index in
 *    English. A Chinese example there is an instruction to type something that
 *    returns nothing. Contrast the CV Builder, where the examples ARE localised,
 *    because that field holds the reader's own name.
 */

import type { Catalogue } from '../../index';

const research: Catalogue = {
    /* ---------------------------------------------------------------- *
     * The hub
     * ---------------------------------------------------------------- */
    'Loading Research Flow...': '正在加载科研流程……',
    'Manage your research projects, collaborate with peers, and explore academic papers':
        '管理你的科研项目、与同行协作，并检索学术文献',
    'Quick Stats': '概览数据',
    'Research Files': '研究文件',
    'Total Views': '总浏览量',
    'Downloads': '下载量',
    'Collaborations': '协作',

    /* ---------------------------------------------------------------- *
     * Projects
     * ---------------------------------------------------------------- */
    'New Project': '新建项目',
    'Create New Project': '创建新项目',
    'Loading projects...': '正在加载项目……',
    'Search my projects...': '搜索我的项目……',
    'No projects found. Create your first project!': '未找到项目。创建你的第一个项目吧！',
    'Searching projects...': '正在搜索项目……',
    'No projects found matching your criteria.': '没有符合条件的项目。',
    'Search by title, description, keywords, owner...': '按标题、描述、关键词或所有者搜索……',
    'Page {v0} of {v1} ({v2} results)': '第 {v0} / {v1} 页（共 {v2} 条结果）',
    'All Access': '全部访问级别',
    'Files:': '文件：',
    'Basic Information': '基本信息',
    'Title *': '标题 *',
    'Project title': '项目标题',
    'Description *': '描述 *',
    'DOI (Optional)': 'DOI（可选）',
    'Upload File (Optional)': '上传文件（可选）',
    'Access Control *': '访问权限 *',
    'Access Level': '访问级别',
    'Private - Only you': '私有 —— 仅你本人',
    'Team - Only team members': '团队 —— 仅团队成员',
    'Public - Anyone can view': '公开 —— 任何人可查看',
    'AI, Machine Learning, Deep Learning': '人工智能、机器学习、深度学习',

    'Project Details': '项目详情',
    'Loading project...': '正在加载项目……',
    'Project not found or you don\'t have access.': '项目不存在，或你没有访问权限。',
    'Back to Research Flow': '返回科研流程',
    'Edit Project': '编辑项目',
    'Research Files ({v0})': '研究文件（{v0}）',
    'No files uploaded yet.': '尚未上传任何文件。',
    'Upload New File': '上传新文件',
    'Version (e.g., v1.0)': '版本（例如 v1.0）',
    'Download': '下载',
    'Team Members ({v0})': '团队成员（{v0}）',
    'No team members.': '没有团队成员。',
    'Can Edit': '可编辑',
    'Editor': '编辑者',
    'Viewer': '查看者',
    'Request Collaboration': '申请协作',
    'Send a request to the project owner to join as a collaborator.':
        '向项目所有者发送申请，以协作者身份加入。',
    'Comments ({v0})': '评论（{v0}）',
    'No comments yet. Be the first to comment!': '还没有评论。来做第一个评论的人！',
    'Views:': '浏览量：',
    'Downloads:': '下载量：',
    'Citations:': '引用次数：',
    'Venue': '会议 / 期刊',
    'Venue:': '会议 / 期刊：',
    'Year:': '年份：',

    /* ---------------------------------------------------------------- *
     * Collaboration
     * ---------------------------------------------------------------- */
    'Send Collaboration Request': '发送协作申请',
    'Select a project...': '选择一个项目……',
    'Search requests...': '搜索申请……',
    'My Requests ({v0})': '我发出的申请（{v0}）',
    'Received ({v0})': '收到的申请（{v0}）',
    'Pending ({v0})': '待处理（{v0}）',
    'Approved ({v0})': '已通过（{v0}）',
    'Rejected ({v0})': '已拒绝（{v0}）',
    'No requests in this category.': '此类别下没有申请。',
    'Approve': '通过',
    'Reject': '拒绝',
    'From: {v0}': '来自：{v0}',
    'To: {v0}': '发送至：{v0}',

    /* ---------------------------------------------------------------- *
     * Researchers
     * ---------------------------------------------------------------- */
    'Loading researchers...': '正在加载研究者……',
    'No researchers found.': '未找到研究者。',
    'Search researchers...': '搜索研究者……',
    'Researcher Profile': '研究者资料',
    'Researcher profile not found.': '未找到该研究者资料。',
    'Research Interests': '研究兴趣',
    'Projects ({v0})': '项目（{v0}）',
    'No projects yet.': '还没有项目。',
    'Joined': '加入时间',
    '{v0} Your Researcher Profile': '{v0} 你的研究者资料',
    'First name': '名',
    'Last name': '姓',
    'University *': '大学 *',
    'Research Interests (comma separated)': '研究兴趣（用逗号分隔）',
    'ORCID ID': 'ORCID 编号',
    'Google Scholar ID': 'Google 学术 ID',
    'Google Scholar profile ID': 'Google 学术主页 ID',
    'Research institution...': '研究机构……',

    /* ---------------------------------------------------------------- *
     * The library
     * ---------------------------------------------------------------- */
    'My Research Library': '我的文献库',
    'Loading library...': '正在加载文献库……',
    'OpenAlex Library ({v0})': 'OpenAlex 文献库（{v0}）',
    'Local Projects ({v0})': '本地项目（{v0}）',
    'No papers in your OpenAlex library yet.': '你的 OpenAlex 文献库中还没有论文。',
    'No saved local projects yet.': '还没有保存的本地项目。',
    'Open Access': '开放获取',
    'View Paper': '查看论文',
    'DOI: {v0}': 'DOI：{v0}',

    /* ---------------------------------------------------------------- *
     * Searching OpenAlex
     * ---------------------------------------------------------------- */
    'Search Academic Papers': '检索学术论文',
    'Enter your research keywords, e.g. hand gesture rehabilitation exergame':
        '输入研究关键词，例如 hand gesture rehabilitation exergame',
    'Keywords are the only required field. Every filter below is optional — add them only when you want to narrow the results.':
        '关键词是唯一必填项。下面的筛选条件都是可选的 —— 只在需要缩小范围时再添加。',
    'Keywords are the only required field.': '关键词是唯一必填项。',
    'Searching OpenAlex…': '正在检索 OpenAlex……',
    'No papers matched this search.': '没有论文符合此次检索。',
    'Try removing a filter, widening the year range, or searching the full text instead of just the title and abstract.':
        '试着去掉一个筛选条件、放宽年份范围，或改为检索全文而不只是标题和摘要。',
    'Filters:': '筛选条件：',
    'Clear all filters': '清除全部筛选',
    'Search in': '检索范围',
    'Title only': '仅标题',
    'Title and abstract': '标题与摘要',
    'Full text': '全文',
    'Publication year': '发表年份',
    'Minimum citations': '最少引用次数',
    'Open access only': '仅开放获取',
    'PDF linked only': '仅含 PDF 链接',
    'Has a DOI': '含 DOI',
    'Retracted': '已撤稿',
    'Institutions:': '机构：',
    'Type a university name': '输入大学名称',
    'Type an author name': '输入作者姓名',
    'Type a topic keyword, e.g. computer vision': '输入主题关键词，例如 computer vision',
    'Sort by': '排序方式',
    'Relevance': '相关度',
    'Most cited': '引用最多',
    'Results per page': '每页结果数',
    'Showing {v0}–{v1} · page {v2} of {v3}': '显示第 {v0}–{v1} 条 · 第 {v2} / {v3} 页',
    'Last »': '末页 »',
    '{v0} paper{v1} found': '找到 {v0} 篇论文',
    'Open PDF source {v0}': '打开 PDF 来源 {v0}',
    'OpenAlex allows paging through the first 10,000 results only. Narrow the search with filters to reach the rest.':
        'OpenAlex 只允许翻阅前 10,000 条结果。请用筛选条件缩小范围以查看其余结果。',
    'Search failed.': '搜索失败。',
    'Author name': '作者姓名',

    /* ---------------------------------------------------------------- *
     * Google Scholar
     *
     * The long explanation is translated in full: it is the page telling the
     * reader that Scholar has no API and that half of what they are looking at
     * is an AI SUGGESTION rather than a search result. A student who cannot read
     * that paragraph is a student who cites an unverified suggestion.
     * ---------------------------------------------------------------- */
    'Google Scholar Search': 'Google 学术检索',
    'How this works.': '工作原理。',
    'Google Scholar has no public API, so this page does two things instead. It builds the exact Scholar query a professional searcher would run — open it to see the real Scholar results — and it uses AI to suggest the literature that search should surface. Every suggestion is then checked against OpenAlex. Items marked':
        'Google 学术没有公开的 API，因此本页改做两件事：一是构造出专业检索者会使用的那条 Scholar 查询语句 —— 打开它就能看到真实的 Scholar 结果；二是用 AI 推测该检索应当命中的文献。随后每条建议都会与 OpenAlex 核对。标记为',
    'have confirmed bibliographic data; items marked': '的条目具有已确认的文献信息；标记为',
    'are search leads to confirm yourself before citing.': '的条目只是检索线索，引用前请自行核实。',
    'Enter your research topic, e.g. python games development for education':
        '输入研究主题，例如 python games development for education',
    'Find on Scholar': '在 Scholar 中查找',
    'Open on Google Scholar': '在 Google 学术中打开',
    'Open search': '打开检索',
    'Search strategy': '检索策略',
    'Alternative searches': '备选检索式',
    'Building the search and checking results against OpenAlex…':
        '正在构造检索式并与 OpenAlex 核对结果……',
    'This takes longer than a normal search because every suggestion is verified.':
        '这比普通检索更慢，因为每条建议都会被核实。',
    'Verify results against OpenAlex (recommended)': '与 OpenAlex 核对结果（推荐）',
    'Verified in OpenAlex': '已在 OpenAlex 中核实',
    'Unverified': '未核实',
    'Unverified suggestion': '未核实的建议',
    'Why it matters:': '为什么这很重要：',
    '{v0} suggested papers': '{v0} 篇建议论文',
    '{v0} verified': '{v0} 篇已核实',
    '{v0} unverified': '{v0} 篇未核实',
    '· AI confidence: {v0}': '· AI 置信度：{v0}',
    '· {v0}% title match': '· 标题匹配 {v0}%',
    'Exclude work about': '排除关于以下内容的研究',
    'Review articles only': '仅综述文章',
    'From year': '起始年份',
    'To year': '截止年份',
    'Journal article': '期刊论文',
    'Conference paper': '会议论文',
    'Book chapter': '专著章节',
    'Thesis': '学位论文',
    'Scholar interface language': 'Scholar 界面语言',

    /* ---------------------------------------------------------------- *
     * The AI writer — starting one
     * ---------------------------------------------------------------- */
    'Start a New Research': '开始新的研究',
    'My AI Researches ({v0})': '我的 AI 研究（{v0}）',
    'Loading your researches…': '正在加载你的研究……',
    'You have not started an AI research yet.': '你还没有开始任何 AI 研究。',
    'The writer builds a full thesis structure for you — plan, chapters, references — and exports it as a Word document or a PDF.':
        '写作助手会为你搭建完整的论文结构 —— 研究计划、章节、参考文献 —— 并导出为 Word 文档或 PDF。',
    'Research topic': '研究主题',
    'Research type': '研究类型',
    'Working title': '暂定标题',
    'Leave blank to let the AI write the title': '留空则由 AI 拟定标题',
    '(optional — AI will propose one)': '（可选 —— AI 会给出建议）',
    'Citation style': '引用格式',
    'Writing language': '写作语言',
    'Target word count': '目标字数',
    'Anything else the AI should know': '还有什么需要让 AI 知道的',
    'Your name': '你的姓名',
    'Appears on the title page': '将显示在标题页上',
    'Use my saved research library as the source list ({v0} papers)':
        '用我保存的文献库作为来源列表（{v0} 篇论文）',
    'Draft research questions': '起草研究问题',
    'Suggested references': '建议的参考文献',
    'Sections generated': '已生成的章节',
    'Compare Research Types': '比较研究类型',
    'Research Type Comparison': '研究类型对照',
    'Document structure — {v0}': '文档结构 —— {v0}',
    'Feature': '特征',
    'Chapters:': '章节数：',
    'Length:': '篇幅：',
    'Theory:': '理论深度：',
    'Originality:': '原创性：',
    'The AI is writing the problem statement, research gap, questions, methodology and chapter outline. This usually takes 20–60 seconds.':
        'AI 正在撰写问题陈述、研究空白、研究问题、研究方法和章节大纲。通常需要 20–60 秒。',
    'No AI provider is configured on this server, so plans and chapters cannot be generated. Ask an administrator to set':
        '此服务器未配置 AI 提供方，因此无法生成研究计划和章节。请让管理员设置',
    '{v0} sections · ~{v1} words': '{v0} 个章节 · 约 {v1} 字',
    'or': '或',

    /* ---------------------------------------------------------------- *
     * The AI writer — the document. Academic register throughout; see header.
     * ---------------------------------------------------------------- */
    'Loading research…': '正在加载研究……',
    'Research Plan': '研究计划',
    'Generate the research plan': '生成研究计划',
    'No plan has been generated yet.': '尚未生成研究计划。',
    'Problem statement': '问题陈述',
    'Research gap': '研究空白',
    'Research questions': '研究问题',
    'Hypotheses': '研究假设',
    'Aims': '研究目的',
    'Objectives': '具体目标',
    'Significance': '研究意义',
    'Scope and delimitations': '研究范围与界限',
    'Methodology': '研究方法',
    'Theoretical framework': '理论框架',
    'Thesis statement': '论点陈述',
    'Risks and mitigations': '风险与应对措施',
    'Next steps': '后续步骤',
    'Recommended search terms': '推荐检索词',
    'Chapter outline': '章节大纲',
    'Chapter {v0}: {v1}': '第 {v0} 章：{v1}',
    'Document Sections': '文档章节',
    'Document ({v0}/{v1})': '文档（{v0}/{v1}）',
    'Generate section': '生成本节',
    'Not written yet. Press': '尚未撰写。请按',
    'to review it first.': '先行审阅。',
    'Writing section {v0} of {v1} —': '正在撰写第 {v0} / {v1} 节 ——',
    '. Each section is a separate request, so you can leave this page and come back; finished sections are saved as they complete.':
        '。每一节都是一次独立请求，因此你可以离开本页稍后再回来；已完成的章节会随即保存。',
    'Sections are written one at a time so long documents do not time out. Generate them in order — each section is given the earlier ones as context so the argument stays consistent.':
        '章节逐节撰写，以免长文档超时。请按顺序生成 —— 每一节都会把前面的章节作为上下文，从而保持论证连贯。',
    'Title Page': '标题页',
    'Title Page Details': '标题页信息',
    'These fields appear on the title page of the exported document.':
        '这些字段会出现在导出文档的标题页上。',
    'Sources': '来源文献',
    'Sources ({v0})': '来源文献（{v0}）',
    'sources': '篇来源',
    'Sources the AI may cite': 'AI 可以引用的来源文献',
    'No sources attached.': '未附加任何来源文献。',
    'No sources attached, so the document will export without a reference list.':
        '未附加来源文献，因此导出的文档不会包含参考文献列表。',
    'The writer cites only these sources. If the list is empty it writes from general disciplinary knowledge and will not invent citations — but the document will be far stronger with real literature attached.':
        '写作助手只引用这些来源。如果列表为空，它会依据学科通识来写，并且不会编造引用 —— 但附上真实文献会让文档扎实得多。',
    'Attach papers on the': '在',
    'tab — the writer then cites them in the text and builds the bibliography in {v0} automatically.':
        '标签页中附加论文 —— 写作助手随后会在正文中引用它们，并自动按 {v0} 格式生成参考文献。',
    'Find papers on OpenAlex': '在 OpenAlex 中查找论文',
    'Search Google Scholar': '检索 Google 学术',
    'Search these on OpenAlex': '在 OpenAlex 中检索这些',
    'Search these on Google Scholar': '在 Google 学术中检索这些',
    'References ({v0})': '参考文献（{v0}）',
    'references': '条参考文献',
    'Build reference list': '生成参考文献列表',
    'No reference list yet.': '还没有参考文献列表。',
    '{v0} source{v1} attached. The reference list is built automatically when you export, or press':
        '已附加 {v0} 篇来源文献。导出时会自动生成参考文献列表，或点击',
    'above.': '（见上方）。',
    'Formatted in {v0} with a hanging indent. Journal titles are italicised and each DOI or URL becomes a clickable link in the exported DOCX and PDF. Only metadata held for the source is used — no page range or DOI is guessed.':
        '按 {v0} 格式排版，使用悬挂缩进。期刊名用斜体，每个 DOI 或链接在导出的 DOCX 和 PDF 中都是可点击的。只使用来源已有的元数据 —— 不会凭空推测页码范围或 DOI。',
    'All researches': '全部研究',
    'pages': '页',
    'words': '字',
    '· {v0} citations': '· {v0} 次引用',
};

export default research;
