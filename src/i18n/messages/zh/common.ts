/**
 * Shared vocabulary — Chinese (Simplified).
 *
 * The mirror of `../ar/common.ts`: same key set, same reason for being one
 * file. `node tools/i18n-wrap/where.mjs "~shared"` prints the list.
 *
 * Note the punctuation throughout — `：` and not `:`. A label ending in an
 * ASCII colon is the commonest tell that a Chinese interface was translated
 * word by word rather than written.
 */

import type { Catalogue } from '../../index';

const common: Catalogue = {
    /* ---------------------------------------------------------------- *
     * Actions
     * ---------------------------------------------------------------- */
    'Cancel': '取消',
    'Save': '保存',
    'Delete': '删除',
    'Remove': '移除',
    'Edit': '编辑',
    'Close': '关闭',
    'Open': '打开',
    'Copy': '复制',
    'Copy text': '复制文本',
    'Duplicate': '创建副本',
    'Share': '分享',
    'Search': '搜索',
    'Clear': '清除',
    'Clear search': '清除搜索',
    'Clear Search': '清除搜索',
    'Reset': '重置',
    'Refresh': '刷新',
    'Retry': '重试',
    'Try again': '重试',
    'Try Again': '重试',
    'Next': '下一个',
    'Previous': '上一个',
    'Back': '返回',
    'Stop': '停止',
    'Leave': '退出',
    'Review': '查看',
    'Reply': '回复',
    'Send message': '发送消息',
    'Post Comment': '发表评论',
    'View': '查看',
    'View Details': '查看详情',
    'Zoom in': '放大',
    'Zoom out': '缩小',
    '+ Add': '+ 添加',
    'Actions': '操作',

    /* ---------------------------------------------------------------- *
     * States
     * ---------------------------------------------------------------- */
    'Loading...': '加载中……',
    'Active': '有效',
    'Completed': '已完成',
    'Expired': '已过期',
    'Scheduled': '已预约',
    'Draft': '草稿',
    'Published': '已发布',
    'Under Review': '审核中',
    'Verified': '已核验',
    'Valid': '有效',
    'Private': '私有',
    'Public': '公开',
    'Online': '在线',
    'Muted': '已静音',
    'New': '新',
    'none': '无',
    '(none)': '（无）',
    '(optional)': '（可选）',
    '— optional': '—— 可选',
    'auto': '自动',
    'Yes': '是',
    'No': '否',
    'All Statuses': '全部状态',
    'All Types': '全部类型',
    'Any type': '任意类型',
    'Any language': '任意语言',
    '-- None --': '-- 无 --',
    '(you)': '（你）',
    '(You)': '（你）',
    'Newest first': '最新优先',
    'Oldest first': '最早优先',
    'Highest score': '最高分优先',

    /* ---------------------------------------------------------------- *
     * Field labels
     * ---------------------------------------------------------------- */
    'Name': '名称',
    'Title': '标题',
    'Description': '描述',
    'Type': '类型',
    'Type:': '类型：',
    'Status': '状态',
    'Status:': '状态：',
    'Date': '日期',
    'Date:': '日期：',
    'Year': '年份',
    'Duration': '时长',
    'Duration:': '时长：',
    'Amount': '金额',
    'Amount:': '金额：',
    'Email': '邮箱',
    'Username': '用户名',
    'First Name': '名',
    'Last Name': '姓',
    'Gender': '性别',
    'Male': '男',
    'Female': '女',
    'Language': '语言',
    'Mode': '模式',
    'Method': '方式',
    'Role': '角色',
    'Owner': '所有者',
    'Team': '团队',
    'Group': '群组',
    'Group name': '群组名称',
    'Topic': '主题',
    'Keywords': '关键词',
    'Keywords (comma separated)': '关键词（用逗号分隔）',
    '(comma separated)': '（用逗号分隔）',
    'Instructions': '说明',
    'Instructions:': '说明：',
    'Total': '合计',
    'Score': '分数',
    'Score:': '分数：',
    'Results': '结果',
    'Questions': '题目',
    'From': '从',
    'To': '至',
    'Created:': '创建于：',
    'Expires:': '到期：',
    'User ID': '用户 ID',
    'File name': '文件名',
    'File description': '文件说明',
    'Template': '模板',
    'Templates': '模板',
    'Template library': '模板库',
    'Shape': '形状',
    'Mask': '蒙版',
    'Code': '代码',
    'Issues': '问题',
    'Website': '网站',
    'Profile picture': '头像',
    'Take a photo': '拍照',
    'Page {v0} of {v1}': '第 {v0} 页，共 {v1} 页',
    '(Page {v0} of {v1})': '（第 {v0} 页，共 {v1} 页）',
    'Question {v0} of {v1}': '第 {v0} 题，共 {v1} 题',
    '« First': '« 首页',
    '({v0} parts)': '（{v0} 个部分）',
    '+{v0} more': '还有 {v0} 项',
    '…and {v0} more.': '……还有 {v0} 项。',
    'Nobody matches “{v0}”.': '没有人符合“{v0}”。',

    /* ---------------------------------------------------------------- *
     * Counted quantities
     *
     * Chinese has one plural form, so every one of these is a bare string —
     * and that is the complete answer, not a shortcut. What Chinese does need
     * is the MEASURE WORD, which English has no equivalent of and which
     * differs by noun: 个 for a generic item, 位 for a person, 门 for a
     * course, 道 for a question, 份 for a document. Using 个 for all of them
     * is understandable and reads as foreign, so each is given its own.
     * ---------------------------------------------------------------- */
    '{v0} characters': '{v0} 个字符',
    '{v0} words': '{v0} 个词',
    '{v0} minutes': '{v0} 分钟',
    '{v0} min': '{v0} 分钟',
    '{v0} hours': '{v0} 小时',
    '{v0} steps': '{v0} 个步骤',
    '{v0} views': '{v0} 次浏览',
    '{v0} downloads': '{v0} 次下载',
    '{v0} citations': '{v0} 次引用',
    '{v0} pts': '{v0} 分',
    '{v0} points': '{v0} 分',
    '{v0} unread': '{v0} 条未读',
    '{n} unread': '{n} 条未读',
    '{v0} new': '{v0} 条新的',
    '{v0} comments': '{v0} 条评论',
    '{v0} members': '{v0} 位成员',
    '{v0} followers': '{v0} 位关注者',
    '{v0} files': '{v0} 个文件',
    '{v0} links': '{v0} 个链接',
    '{v0} errors': '{v0} 个错误',
    '{v0} warnings': '{v0} 条警告',
    '{v0} hints': '{v0} 条提示',
    '{v0} parts': '{v0} 个部分',
    '{v0} bytes': '{v0} 字节',
    '{v0} devices': '{v0} 台设备',
    '{v0} projects': '{v0} 个项目',
    '{v0} sources': '{v0} 个来源',
    '{v0} lessons': '{v0} 节课',
    '{v0} ms': '{v0} 毫秒',
    '{v0}ms': '{v0} 毫秒',
    '{v0}px': '{v0} 像素',
    '~{v0} words': '约 {v0} 个词',
    '~{v0} pages': '约 {v0} 页',
    '{v0} / {v1} lessons': '{v0} / {v1} 节课',
    '{v0} / {v1} sections': '{v0} / {v1} 个章节',
    '/ {v0} sections': '/ {v0} 个章节',
    '{v0} • {v1} minutes': '{v0} • {v1} 分钟',
    '{v0}–{v1} min': '{v0}–{v1} 分钟',
    '% match': '% 匹配',
    'JOD {v0}': '{v0} 约旦第纳尔',

    /* ---------------------------------------------------------------- *
     * The sidebar
     * ---------------------------------------------------------------- */
    'Home': '首页',
    'Main': '主要',
    'Learn': '学习',
    'Tools': '工具',
    'Account': '账户',
    'All applications': '全部应用',
    'Courses': '课程',
    'Exams': '考试',
    'Quizzes': '小测',
    'Certificates': '证书',
    'All Certificates': '全部证书',
    'My Certificates': '我的证书',
    'Exam Certificates': '考试证书',
    'Course Certificates': '课程证书',
    'My Results': '我的成绩',
    'Leaderboard': '排行榜',
    'Runbooks': '操作手册',
    'Labs': '实验室',
    'Notifications': '通知',
    'Messages': '消息',
    'Profile': '个人资料',
    'Plans': '套餐',
    'My Plans': '我的套餐',
    'Newscast': '新闻播报',
    'Job Interview': '模拟面试',
    'Toastmasters': 'Toastmasters',
    'CV Builder': '简历生成器',
    'Drawing Papers': '画板',
    'Network Simulator': '网络模拟器',
    'Roblox Studio': 'Roblox 工作室',
    'Research Flow': '科研流程',
    'Login': '登录',
    'Logout': '退出登录',
    'Theme': '主题',
    /* ---- The galaxy picker's dark/light switch ---- */
    'Dark': '深色',
    'Light': '浅色',
    'Theme: {v0}': '主题：{v0}',
    'Change theme — currently {v0}': '更换主题 —— 当前为 {v0}',

    /* ---------------------------------------------------------------- *
     * The sidebar's application headers and the rest of its labels.
     *
     * The subtitle under each application title is translated for the same
     * reason the labels are: left in English it is the only untranslated text
     * on an otherwise translated sidebar, which reads as a rendering fault.
     * ---------------------------------------------------------------- */
    'Overview': '概览',
    'Related': '相关',
    'Studio': '工作室',
    'Search pages…': '搜索页面……',
    'Search navigation': '搜索导航',
    'Search {app} & all apps…': '搜索{app}及全部应用……',

    'Lessons, homework and quizzes': '课时、作业与小测',
    'Sit, schedule and review exams': '参加考试、预约与查看成绩',
    'Schedule Exam': '预约考试',
    'Exam Approval': '考试确认',
    'Credentials you have earned': '你已获得的证书',
    'Who is ahead across the platform': '看看平台上谁领先',
    'Step-by-step operational guides': '分步操作指南',
    'SQL, Linux and Python sandboxes': 'SQL、Linux 与 Python 沙箱',
    'SQL Database': 'SQL 数据库',
    'Linux Terminal': 'Linux 终端',
    'Python Compiler': 'Python 编译器',
    'Build and test topologies': '搭建并测试网络拓扑',
    'Animation and scripting': '动画与脚本',
    'Ask, explain, summarise': '提问、讲解、总结',
    'Mock interviews and feedback': '模拟面试与反馈',
    'Prepare Interview': '准备面试',
    'Practise public speaking': '练习公众演讲',
    'Prepare Session': '准备本场练习',
    'Write, tailor and export a CV': '撰写、定制并导出简历',
    'My CVs': '我的简历',
    'Shared canvas, free with an account': '共享画板，账户内免费',
    'My Papers': '我的画板',
    'Talk to students and teachers': '与同学和老师交流',
    'Conversations': '会话',
    'World news, read to you hourly': '国际新闻，每小时为你播报',
    'Profile, alerts and subscription': '资料、提醒与订阅',
    'Plans & Billing': '套餐与账单',
    'Subscriptions and payments': '订阅与支付',
    'Proctoring': '监考',
    'Proctor Dashboard': '监考面板',
    'Supervise exam appointments': '管理考试预约',
    'Projects, sources and writing': '项目、文献与写作',
    'My Projects': '我的项目',
    'Create Project': '新建项目',
    'My Library': '我的文献库',
    'AI Writer': 'AI 写作',
    'Collaboration': '协作',
    'Researchers': '研究者',
    'My Researcher Profile': '我的研究者资料',
    'Google Scholar': 'Google 学术',

    /* ---------------------------------------------------------------- *
     * Academic and research vocabulary
     * ---------------------------------------------------------------- */
    'About': '关于',
    'Bio': '简介',
    'Institution': '机构',
    'University': '大学',
    'University / institution': '大学 / 机构',
    'Department': '院系',
    'Supervisor': '导师',
    'Field of study': '研究领域',
    'Degree programme': '学位项目',
    'Submission year': '提交年份',
    'Publication Year': '发表年份',
    'Publication type': '出版物类型',
    'Authors': '作者',
    'Authors:': '作者：',
    'References': '参考文献',
    'Key terms': '关键术语',
    'Venue/Journal': '会议 / 期刊',
    'Open access': '开放获取',
    'PDF available': '有 PDF 可用',
    'My papers': '我的论文',
    'View paper': '查看论文',
    'View Project': '查看项目',
    'Search Projects': '搜索项目',
    'Import from OpenAlex': '从 OpenAlex 导入',
    'AI Research Writer': 'AI 论文写作',
    'Can edit': '可编辑',
    'View only': '仅查看',
    'Saves as': '保存为',

    /* ---------------------------------------------------------------- *
     * Networking vocabulary. The protocol names are deliberately absent —
     * see `ATOMIC` in `tools/i18n-wrap/wrap.mjs`.
     * ---------------------------------------------------------------- */
    'Network': '网络',
    'Next hop': '下一跳',
    'Request DHCP': '请求 DHCP',
    'Device encyclopedia': '设备百科',
    'Terminal': '终端',

    /* ---------------------------------------------------------------- *
     * Shared across the exam, certificate, plan and report screens.
     *
     * These turned up as gaps on views that were otherwise complete —
     * `check:i18n --gaps` naming a handful of strings per screen rather than a
     * screen. That is what a shared-vocabulary file is for, and it is the
     * reason coverage is worth reading per area rather than in total.
     * ---------------------------------------------------------------- */
    'Exam Information': '考试信息',
    'Exam Instructions Video': '考试说明视频',
    'Video Instructions': '视频说明',
    'Error Loading Exam': '加载考试出错',
    'Error Loading Certificates': '加载证书出错',
    'Loading certificates...': '正在加载证书……',
    'No Exam Certificates Found': '未找到考试证书',
    'No Course Certificates Found': '未找到课程证书',
    'Proctor Information': '监考员信息',
    'Proctor:': '监考员：',
    'Exam:': '考试：',
    'Course:': '课程：',
    'Course': '课程',
    'Back to Exams': '返回考试',
    'Back to Course': '返回课程',
    'Back to the dashboard': '返回面板',
    'Cancel Appointment': '取消预约',
    'Reschedule Exam': '重新预约考试',
    'View Appointment': '查看预约',
    'No room link set': '未设置考场链接',
    'Room 1': '考场 1',
    'Room 2': '考场 2',
    'View Plans': '查看套餐',
    'View All Results →': '查看全部记录 →',
    'Quiz Results': '小测成绩',
    'Active Subscriptions': '生效中的订阅',
    'Payment History': '支付记录',
    'Payment ID': '支付 ID',
    'Plan': '套餐',
    'Plan:': '套餐：',
    'New message': '新消息',

    /* The Toastmasters speech types and the interview report headings, shared
     * between a form, a live room and a results page — a speech type called one
     * thing on the form and another in the report reads as two features.
     *
     * The emoji are part of the key and are kept: they are the only visual
     * anchor on a long report. */
    'Prepared Speech': '备稿演讲',
    'Evaluation Speech': '评估型演讲',
    'Inspirational Speech': '激励型演讲',
    'Persuasive Speech': '说服型演讲',
    'Table Topics (Impromptu)': '即席演讲（Table Topics）',
    '⏱️ Timer Report': '⏱️ 计时员报告',
    '✍️ Grammarian Report': '✍️ 语法官报告',
    '🗣️ Ah-Counter Report': '🗣️ 语气词统计报告',
    '📋 Speech Evaluator Report': '📋 演讲评估员报告',
    '🎯 General Evaluator Report': '🎯 总评估员报告',
    '📹 Body Language Analysis': '📹 肢体语言分析',
    '🎭 {v0} Role Evaluation': '🎭 {v0}角色评估',
    '📊 Filler Word Breakdown ({v0} total):': '📊 语气词明细（共 {v0} 次）：',
    '✨ Zero filler words — outstanding clarity!': '✨ 零语气词 —— 表达非常清晰！',
    '✅ Strengths': '✅ 优势',
    '📈 Areas to Improve': '📈 待改进之处',
    '📝 Overall Summary': '📝 总体评价',
    '🗣️ Communication': '🗣️ 沟通表达',
    '🌟 Your strongest moment': '🌟 你表现最好的一刻',
    '⚠️ What would worry a hiring manager': '⚠️ 招聘经理会担心什么',
    '🎯 Do this before your next interview': '🎯 下次面试前先做这件事',
    '📊 Where the score came from': '📊 分数构成',
    '🔁 Redo This Interview': '🔁 重做这场面试',
    '✏️ Change Details & Redo': '✏️ 修改设置并重做',
    '📄 View': '📄 查看',
    '✂️ Replace highlighted': '✂️ 替换选中内容',

    /* The spoken-correction words, quoted as the room quotes them. The Chinese
     * is added rather than substituted: `answerEditing.ts` listens for both
     * sets, because a Chinese-speaking candidate practising an English-language
     * interview will say "sorry". These keys are only the explanation of it. */
    '“sorry”': '“抱歉”',
    '“sorry sorry”': '“抱歉 抱歉”',
    '— paste a bit more; 80 is the minimum.': '—— 再多粘贴一些；至少需要 80 个字符。',
    'Choose Technical or HR, set your role/topic and qualifications, then get interviewed question-by-question.':
        '选择技术面试或 HR 面试，设置岗位／主题和任职资格，然后逐题接受面试。',
    'For each question: what you said, your own answer rewritten to be stronger, a short model answer you can rehearse, and why the interviewer asked it.':
        '每道题都会给出：你说了什么、把你自己的回答改写得更有力、一段可以照着练的简短示范回答，以及面试官为什么问这道题。',

    /* ---------------------------------------------------------------- *
     * The product's own name is not translated. A product that calls itself
     * something else in one language is a different product to the reader
     * looking for it.
     * ---------------------------------------------------------------- */
    'Self Study JO': 'Self Study JO',
};

export default common;
