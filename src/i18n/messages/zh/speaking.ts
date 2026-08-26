/**
 * The Job Interview room and the Toastmasters meeting — Chinese (Simplified).
 *
 * ============================================================
 * THE INTERFACE IS ONLY HALF OF IT
 * ============================================================
 *
 * Everything here is the text AROUND the interviewer. What the interviewer
 * SAYS comes from a language model on app 27, told to answer in Simplified
 * Chinese by `language.py` there; what it SOUNDS like comes from
 * `i18n/speech.ts`, which will not cast an English voice for a Chinese
 * utterance. All three have to agree, or a reader cannot tell which part is
 * broken.
 *
 * ============================================================
 * THE ONE THING CHINESE BREAKS THAT NEITHER OTHER LANGUAGE DOES
 * ============================================================
 *
 * `_ji_is_whole_question` on app 27 accepts a question only if it has three
 * words and a terminator, and a Chinese sentence split on whitespace has ONE
 * "word". Every Chinese question a model produced would fail that floor and the
 * room would fall back to its local English pool — so `locales.ts` →
 * `countWords` counts CJK characters instead. It is the same class of bug as
 * the character floor that used to reject every Arabic question, arriving from
 * the other direction, and it is why `wordless` is a field on a locale rather
 * than a special case in the room.
 *
 * ============================================================
 * TWO TRANSLATION DECISIONS
 * ============================================================
 *
 *  - **"sorry" is kept as well as 抱歉.** The spoken-correction feature listens
 *    for a word the candidate SAYS, and a Chinese-speaking candidate practising
 *    an English-language interview will say "sorry". `answerEditing.ts` accepts
 *    both; this file translates only the explanation.
 *  - **"Toastmasters" and its six role names keep their English.** They are the
 *    organisation's terms of art — a member looking up "Ah-Counter" will not
 *    find 语气词统计员 in any Toastmasters manual — so the Chinese is given
 *    alongside rather than instead.
 */

import type { Catalogue } from '../../index';

const speaking: Catalogue = {
    /* ---------------------------------------------------------------- *
     * Job Interview — the landing page
     * ---------------------------------------------------------------- */
    '💼 AI Job Interview Practice': '💼 AI 模拟面试练习',
    'Practice technical and HR interviews with an AI interviewer and get instant feedback.':
        '与 AI 面试官进行技术面试和 HR 面试练习，并即时获得反馈。',
    'Start New Interview': '开始新面试',
    'My Interview Results': '我的面试记录',
    'Review past interviews, scores, transcripts and detailed feedback reports.':
        '回顾过往面试、得分、逐字稿和详细的反馈报告。',
    'What You\'ll Improve': '你会提升什么',
    'Technical depth & clarity': '技术深度与表达清晰度',
    'Communication skills': '沟通能力',
    'Confidence under pressure': '压力下的自信',
    'Answering structure (STAR)': '回答结构（STAR 法则）',

    /* ---------------------------------------------------------------- *
     * Job Interview — setting one up
     * ---------------------------------------------------------------- */
    '🎯 Prepare Your Interview': '🎯 准备你的面试',
    'Configure your mock interview. The AI interviewer will ask questions one at a time and wait for your answers.':
        '设置你的模拟面试。AI 面试官会逐个提问，并等待你的回答。',
    'Interview Type *': '面试类型 *',
    'Technical Interview (role / topic based)': '技术面试（按岗位 / 主题）',
    'HR Interview (behavioral / soft skills)': 'HR 面试（行为 / 软技能）',
    'Role / Topic *': '岗位 / 主题 *',
    'e.g., Python Developer, DevOps, Frontend Engineer': '例如：Python 开发、DevOps、前端工程师',
    'Qualifications / Job Requirements (optional)': '任职资格 / 岗位要求（可选）',
    '💡 If you fill this in, the interviewer will ask questions specifically related to these qualifications.':
        '💡 填写后，面试官会针对这些任职资格来提问。',
    'How many questions? *': '面试题目数量 *',
    'From {v0} to {v1}. Each answer is planned at': '{v0} 到 {v1} 题。每个回答预留',
    '— so {v0} questions is': '—— 因此 {v0} 题约需',
    '1 minute 30': '1 分 30 秒',
    'Total time (minutes)': '总时长（分钟）',
    'Set from your question count. Raise it if you want longer than 1:30 to think and answer; it cannot go below what {v0} questions need.':
        '根据题目数量自动设定。如果你想有超过 1 分 30 秒的思考和回答时间，可以调高；但不能低于 {v0} 题所需的时长。',
    '⏱️ {v0} extra minute{v1} — about': '⏱️ 多出 {v0} 分钟 —— 约',
    'per answer instead of 1:30.': '每题，而不是 1 分 30 秒。',
    'Attach a CV (optional)': '附上简历（可选）',
    '— No CV — interview me on the role and requirements only':
        '—— 不附简历 —— 只按岗位和要求来面试我',
    '💡 Attaching a CV makes the interview far more realistic: questions come from your own experience rather than from the role title alone.':
        '💡 附上简历会让面试真实得多：题目来自你自己的经历，而不只是岗位名称。',
    '✅ The interviewer will read this CV and ask about what is actually on it — your real projects, the gaps against the requirements, and the claims worth probing.':
        '✅ 面试官会读这份简历，并针对上面的真实内容提问 —— 你实际做过的项目、与岗位要求之间的差距，以及值得追问的表述。',
    'and the interviewer will read it before asking anything.': '面试官会在提问前先读一遍。',
    '⏳ Loading your CVs from the CV Builder…': '⏳ 正在从简历生成器加载你的简历……',
    'Loading it now…': '正在加载……',
    '📄 You have no CVs yet.': '📄 你还没有简历。',
    'Build one in the CV Builder': '在简历生成器中创建一份',
    '⚠️ Could not reach the CV Builder right now, so no CV can be attached. Everything else works — you can start the interview without one.':
        '⚠️ 目前无法连接简历生成器，因此无法附上简历。其他功能均正常 —— 你可以不附简历直接开始面试。',
    'Practising again.': '再练一次。',
    'Your role and requirements are filled in from your last interview — change anything you like, or just start. The interviewer knows which questions you have already been asked and will cover different ground.':
        '岗位和要求已根据你上次面试自动填好 —— 想改就改，也可以直接开始。面试官知道你已经被问过哪些题目，会换其他方向来问。',
    '⚠️ The next page will request camera & microphone permission. Your answers are transcribed by AI.':
        '⚠️ 下一页会请求摄像头和麦克风权限。你的回答将由 AI 转写为文字。',

    /* ---------------------------------------------------------------- *
     * Job Interview — the three ways to correct an answer
     * ---------------------------------------------------------------- */
    '🎙️ Fixing what you said, while you say it': '🎙️ 边说边改你说过的话',
    'Your speech is transcribed live into an': '你的语音会实时转写到一个',
    'editable': '可编辑的',
    'box. If you start a sentence badly — which everybody does, and non-native speakers do more — you do not have to live with it in your report.':
        '文本框中。如果你一句话开头说砸了 —— 这谁都会遇到，非母语者更常见 —— 你不必让它留在报告里。',
    'Words that count as a correction:': '会被视为更正的词：',
    'Just type.': '直接打字。',
    'The transcript is an ordinary text box. Click into it and correct anything at any time, even mid-answer.':
        '转写内容就是一个普通文本框。你可以随时点进去修改，哪怕正在回答中途。',
    'Say “sorry”.': '说“抱歉”。',
    'sorry': '抱歉',
    'deletes the last part of the sentence — back to the previous comma.':
        '会删掉句子的最后一段 —— 回退到上一个逗号处。',
    '“sorry sorry ignore”': '“抱歉 抱歉 忽略”',
    'deletes the last two parts,': '会删掉最后两段，',
    'the last three, and so on. It never wipes the whole answer. Anything you say after the correction carries straight on.':
        '再多一次就删三段，依此类推。它绝不会清空整个回答。更正之后说的内容会直接接上去。',
    'Highlight and replace.': '选中并替换。',
    'Select the words that came out wrong, press': '选中说错的那几个词，按',
    ', and keep talking — the new words land exactly where the old ones were, not at the end.':
        '，然后继续说 —— 新的内容会正好落在原来的位置，而不是接到末尾。',
    'Let spoken corrections edit my answer': '允许口头更正修改我的回答',
    'Turn this off if your interview is about something where you would say those words for real. You can still type and highlight, and you can switch it back on in the room.':
        '如果你的面试主题本身会真的说到这些词，请关掉此项。你仍然可以打字和选中替换，也可以在面试中重新打开。',
    'One': '一次',

    /* ---------------------------------------------------------------- *
     * Job Interview — the room
     * ---------------------------------------------------------------- */
    '💼 {v0} Interview': '💼 {v0}面试',
    '❓ Interviewer asks:': '❓ 面试官提问：',
    '✍️ Your answer': '✍️ 你的回答',
    '🎤 Start Answering': '🎤 开始回答',
    '🎤 transcribing…': '🎤 正在转写……',
    '✅ Submit Answer': '✅ 提交回答',
    '⏹️ End Interview': '⏹️ 结束面试',
    '🗑️ Clear': '🗑️ 清空',
    '👤 You ({v0})': '👤 你（{v0}）',
    '📄 CV attached': '📄 已附简历',
    '🔁 Attempt {v0}': '🔁 第 {v0} 次',
    '🎤 Your microphone could not be started': '🎤 无法启动麦克风',
    'A microphone is required — your spoken answers are transcribed. A camera is optional and the interview runs perfectly without one.':
        '面试需要麦克风 —— 你的口头回答会被转写为文字。摄像头是可选的，没有它面试同样可以正常进行。',
    'New questions — the interviewer knows what you have already been asked':
        '全新题目 —— 面试官知道你已经被问过什么',
    '▌ What you say next goes': '▌ 你接下来说的内容会插入',
    'here': '此处',
    'Delete what you highlighted and carry on speaking in its place':
        '删除选中的内容，并在原位继续说',
    'Replace highlighted': '替换选中内容',
    '↩︎ Undo last part': '↩︎ 撤销最后一段',
    '↦ Back to the end': '↦ 回到末尾',
    'Say': '说',
    'to delete the last part,': '删掉最后一段，',
    'for the last two — or highlight a phrase and press': '删掉最后两段 —— 或者选中一段话，然后按',
    '. You can also just type.': '。你也可以直接打字。',
    'spoken corrections': '口头更正',
    'Turn off if the interview is about a subject where you say these words for real':
        '如果面试主题本身会真的说到这些词，请关闭',
    '📋 Interview Feedback Report': '📋 面试反馈报告',
    '📋 Your report is being written as you go —': '📋 报告正在随面试进行同步生成 ——',
    'of {v0} answers coached': '/ {v0} 个回答已点评',
    '📋 Your report starts building from your first answer — nothing waits until the end.':
        '📋 报告从你的第一个回答就开始生成 —— 不会等到面试结束。',
    '💬 Question-by-question coaching ({v0})': '💬 逐题点评（{v0}）',
    ', {v0} in progress': '，{v0} 个正在生成',
    'No questions were answered.': '没有回答任何题目。',
    'Recommendation': '综合建议',

    /* ---------------------------------------------------------------- *
     * Job Interview — the report
     * ---------------------------------------------------------------- */
    '📊 My Job Interview Results': '📊 我的面试记录',
    '{v0} Interview — {v1}': '{v0}面试 —— {v1}',
    '🔍 Filter by topic / role…': '🔍 按主题 / 岗位筛选……',
    'Topic / Role': '主题 / 岗位',
    'Topic:': '主题：',
    'Technical': '技术',
    'Attempt:': '第几次：',
    'Planned:': '计划：',
    'Questions:': '题目数：',
    '· {v0} questions': '· {v0} 道题',
    'try {v0}': '第 {v0} 次',
    'unfinished': '未完成',
    'This interview was not finished — the answers you did give are still coached':
        '这场面试未完成 —— 但你已给出的回答仍然做了点评',
    'No questions recorded.': '没有记录到题目。',
    '🔁 Redo': '🔁 重做',
    'Same role and requirements, new questions': '相同岗位与要求，换一套新题',
    'Change the details first': '先修改设置',
    '🏁 Recommendation': '🏁 综合建议',
    '💬 Question-by-question coaching': '💬 逐题点评',
    '📄 CV the interviewer read': '📄 面试官读过的简历',
    '📋 Qualifications Considered': '📋 参考的任职资格',

    /* ---------------------------------------------------------------- *
     * The per-answer coaching card
     * ---------------------------------------------------------------- */
    '🗣️ Your answer:': '🗣️ 你的回答：',
    '✨ Your answer, made stronger': '✨ 你的回答，改得更有力',
    '📌 Feedback on your answer': '📌 对你回答的点评',
    '🔧 The one thing to change': '🔧 最该改的一点',
    '🎯 Why they ask this': '🎯 面试官为什么问这个',
    '⏳ Coaching this answer…': '⏳ 正在点评这个回答……',
    'The coach is writing feedback for this question now. It will appear here.':
        '点评正在为这道题生成，稍后会显示在这里。',
    'Checklist saved with this answer': '与该回答一起保存的要点清单',
    'The AI coach could not be reached for this question, so this is the shape a strong answer has rather than one written for you. Re-running the interview when the service is back produces a tailored answer and feedback on what you actually said.':
        '这道题未能连上 AI 点评，因此这里给出的是一个好回答通常的结构，而不是为你量身写的内容。服务恢复后重做面试，就会得到针对你实际所说内容的定制回答和反馈。',

    /* ---------------------------------------------------------------- *
     * Toastmasters — the landing page
     * ---------------------------------------------------------------- */
    '🎤 Toastmasters AI Training': '🎤 Toastmasters AI 训练',
    'Master public speaking with AI-powered evaluation and feedback.':
        '通过 AI 评估与反馈，掌握公众演讲。',
    'Start New Session': '开始新一场',
    'Practice a speech with 6 AI evaluators watching and giving real-time feedback.':
        '在 6 位 AI 评估员的注视下练习演讲，并获得实时反馈。',
    'View your past sessions, filler word trends, and progression charts.':
        '查看过往场次、语气词趋势和进步曲线。',
    'Skills You\'ll Build': '你会练成的能力',
    'Public speaking confidence': '公众演讲的自信',
    'Reduced filler words': '更少的语气词',
    'Better time management': '更好的时间掌控',
    'Stronger body language': '更有力的肢体语言',

    /* ---------------------------------------------------------------- *
     * Toastmasters — setting a session up. The six roles keep their English
     * names alongside the Chinese — see the header.
     * ---------------------------------------------------------------- */
    '🎯 Prepare Your Session': '🎯 准备本场练习',
    'Choose your role and configure today\'s session.': '选择你的角色，并设置今天的这一场。',
    'Your Role *': '你的角色 *',
    '🎤 Speaker — Deliver a speech': '🎤 演讲者（Speaker）—— 发表一次演讲',
    '🎙️ Toastmaster — Host the meeting': '🎙️ 主持人（Toastmaster）—— 主持整场会议',
    '⏱️ Timer — Track speech duration': '⏱️ 计时员（Timer）—— 记录演讲时长',
    '🗣️ Ah-Counter — Count filler words': '🗣️ 语气词统计员（Ah-Counter）—— 统计语气词',
    '✍️ Grammarian — Analyze language & grammar': '✍️ 语法官（Grammarian）—— 分析用语与语法',
    '📋 Speech Evaluator — Evaluate a speech': '📋 演讲评估员（Speech Evaluator）—— 评估一次演讲',
    '🎯 General Evaluator — Overall meeting feedback': '🎯 总评估员（General Evaluator）—— 对整场会议的反馈',
    'Speech Type *': '演讲类型 *',
    'Speech Topic / Title *': '演讲主题 / 标题 *',
    'e.g., The Power of Daily Habits': '例如：日常习惯的力量',
    'Ice Breaker (First Speech)': '破冰演讲（第一次演讲）',
    'Min Duration (min)': '最短时长（分钟）',
    'Max Duration (min)': '最长时长（分钟）',
    '⚠️ The next page will request camera and microphone permission.':
        '⚠️ 下一页会请求摄像头和麦克风权限。',

    /* ---------------------------------------------------------------- *
     * Toastmasters — the meeting
     * ---------------------------------------------------------------- */
    '🎭 Your Role:': '🎭 你的角色：',
    '🎭 Role:': '🎭 角色：',
    '📍 Topic:': '📍 主题：',
    '📋 Task:': '📋 任务：',
    '👤 You ({v0}) —': '👤 你（{v0}）——',
    'Your Live Transcript': '你的实时逐字稿',
    '🎤 Recording (Whisper AI)': '🎤 正在录音（Whisper AI）',
    '✋ I\'m Done': '✋ 我讲完了',
    '📋 Meeting Reports': '📋 会议报告',
    'Camera Off': '摄像头已关闭',
    'Mic:': '麦克风：',
    'Face:': '面部：',
    'face': '张脸',
    'Frames:': '帧数：',
    'Chunks:': '音频段：',

    /* ---------------------------------------------------------------- *
     * Toastmasters — the reports
     * ---------------------------------------------------------------- */
    '📊 My Toastmasters Results': '📊 我的 Toastmasters 记录',
    '🔍 Filter by topic…': '🔍 按主题筛选……',
    'Report: {v0}': '报告：{v0}',
    'All Roles': '全部角色',
    'Role:': '角色：',
    'Speaker': '演讲者',
    'Toastmaster': '主持人',
    'Timer': '计时员',
    'Ah-Counter': '语气词统计员',
    'Grammarian': '语法官',
    'Speech Evaluator': '演讲评估员',
    'General Evaluator': '总评估员',
    'Ice Breaker': '破冰演讲',
    '📝 Topic': '📝 主题',
    '🎤 Sample Speech': '🎤 示范演讲',
    '📚 Word of the Day': '📚 每日词汇',
    '📜 Your Full Transcript': '📜 你的完整逐字稿',
    'Fillers': '语气词',
    'Fillers:': '语气词：',
    'Target:': '目标：',
    'Face Visible:': '面部可见：',
    'Looking Forward:': '正视镜头：',
    'Centered:': '居中：',
    'Engagement:': '投入度：',


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
    '(no speech captured)': '（未捕获到语音）',
    'Audio recording is not supported by this browser.': '此浏览器不支持录音。',
    'Centered': '居中程度',
    'Click "Start Meeting" to begin.': '点击“开始会议”以开始。',
    'Click the speak button when ready.': '准备好后点击发言按钮。',
    'Engagement': '参与度',
    'Face visible': '面部可见',
    'Finalizing transcription…': '正在完成语音转文字…',
    'Generating sample speech…': '正在生成示范演讲…',
    'Generating your impromptu question…': '正在生成你的即席问题…',
    'Good language overall.': '整体语言表达良好。',
    'Good meeting overall.': '整体会议表现良好。',
    'Hello, I am your Grammarian.': '你好，我是语法官。',
    'Intro skipped — jumping ahead…': '已跳过开场——继续下一步…',
    'Listen carefully…': '请仔细聆听…',
    'Loading AI face detection…': '正在加载 AI 面部检测…',
    'Looking forward': '正视前方',
    'Maintain eye contact.': '保持眼神交流。',
    'Microphone access is needed to take part in the meeting.': '参加会议需要麦克风权限。',
    'No camera on this device — the meeting runs on the microphone alone': '此设备没有摄像头——仅用麦克风即可进行会议',
    'No camera was used for this meeting, so there is no body-language analysis. The microphone is all a meeting needs — turn a camera on next time if you would like this report too.': '本次会议未使用摄像头，因此没有肢体语言分析。会议只需要麦克风——如果你也想要这份报告，下次可以打开摄像头。',
    'Now our sample speaker will deliver a speech. Listen carefully!': '现在由示范演讲者发言，请仔细聆听！',
    'Please turn on your camera.': '请打开你的摄像头。',
    'Please unmute your microphone first.': '请先取消麦克风静音。',
    'Please welcome {v0}!': '让我们欢迎 {v0}！',
    'Practice your {v0} duties.': '练习你的{v0}职责。',
    'Preparing sample speech…': '正在准备示范演讲…',
    'Reports skipped — saving results…': '已跳过报告——正在保存结果…',
    'Requesting the microphone…': '正在请求麦克风权限…',
    'Sample': '示范',
    'Solid effort.': '表现扎实。',
    'Speak — your words appear here every few seconds. You can also type or correct anything in this box while you talk.': '开始说话——你的内容每隔几秒会显示在这里。你也可以在说话时直接在此框内输入或修改。',
    'System': '系统',
    'The microphone is not ready yet.': '麦克风尚未就绪。',
    'The room is preparing…': '会场正在准备…',
    'Three years ago I was afraid of failure. Then I, um, lost my job and started a business. It failed but, you know, that failure taught me everything. I basically learned that, like, taking risks is actually the key.': '三年前我很害怕失败。然后我，呃，失去了工作并开始创业。创业失败了，但是，你知道的，那次失败教会了我一切。我基本上明白了，就是说，冒险其实才是关键。',
    'Three years ago, I lost my job. I started a business that failed. But that failure taught me everything.': '三年前我失去了工作。我创办的企业失败了。但那次失败教会了我一切。',
    'Turn off if the speech is about a subject where you say these words for real': '如果演讲主题本身就会用到这些词，请关闭此项',
    'Welcome {v0}!': '欢迎 {v0}！',
    'Welcome {v0}! Today you have the {v1} role.': '欢迎 {v0}！今天你担任{v1}。',
    'Your turn, {v0}.': '轮到你了，{v0}。',
    '🎙️ Sample Speaker': '🎙️ 示范演讲者',
    '{v0} Today’s Word of the Day is “{v1}”, meaning: {v2}.': '{v0} 今天的每日词汇是“{v1}”，意思是：{v2}。',
    '{v0} filler words.': '{v0} 个填充词。',
    '⇥ Back to the end': '⇥ 回到末尾',
    '⏱️ Timer report': '⏱️ 计时官报告',
    '⏳ Analyzing…': '⏳ 正在分析…',
    '⏳ Evaluating your role…': '⏳ 正在评估你的角色…',
    '⏳ Generating…': '⏳ 正在生成…',
    '⏳ Setting up…': '⏳ 正在设置…',
    '▶️ Start Meeting': '▶️ 开始会议',
    '✅ Saved! Redirecting…': '✅ 已保存！正在跳转…',
    '✍️ Grammarian report': '✍️ 语法官报告',
    '✓ Started': '✓ 已开始',
    '🎙️ Start hosting': '🎙️ 开始主持',
    '🎤 I am ready to speak': '🎤 我准备好发言了',
    '🎤 Speak now! Your words appear here every few seconds.': '🎤 现在开始说话！你的内容每隔几秒会显示在这里。',
    '🎯 General evaluation': '🎯 总评',
    '📋 Deliver evaluation': '📋 进行点评',
    '🗣️ Ah-Counter report': '🗣️ 填充词统计报告',

    /* The interview room's status line. Prose in a `<script>` block, so it goes
     * through `t()` rather than `$t` -- and translated for the same reason the
     * meeting room's is: an Arabic interview whose captions are in English reads
     * as half a feature. */
    'Click "Start Answering" when you are ready to respond.': '准备好回答时，请点击“开始回答”。',
    'Finalizing your answer…': '正在整理你的回答…',
    'Finishing your report…': '正在完成你的报告…',
    'Interviewer is joining…': '面试官正在加入…',
    'Interviewer is thinking of the next question…': '面试官正在思考下一个问题…',
    'Requesting your microphone…': '正在请求麦克风权限…',
    'The interview cannot start without a microphone — see the message above.': '没有麦克风无法开始面试——请查看上方提示。',
    'Wrapping up the interview and preparing your feedback…': '正在结束面试并准备你的反馈…',
    'Your microphone is not connected yet.': '你的麦克风尚未连接。',
    '⏰ Time is up — finish your current answer, then it will wrap up.': '⏰ 时间到——请说完当前回答，之后将自动结束。',
};

export default speaking;
