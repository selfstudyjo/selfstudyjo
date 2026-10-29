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
    /* Live interview / live meeting: turns by voice, and interruptions. */
    '🎙️ Live interview': '🎙️ 实时面试',
    'Run it as a live interview — no buttons, just talk': '以实时面试进行——无需按钮，直接说话',
    'The microphone listens all the time. Start answering whenever you are ready — there is no “Start Answering” or “Submit” button.': '麦克风会一直收听。准备好就开始回答——没有“开始回答”或“提交”按钮。',
    'Your answer ends when you stop talking for about two seconds, and the interviewer moves on — exactly as in a real call.': '当你停止说话约两秒，回答即结束，面试官会继续下一步——和真实通话完全一样。',
    'If you talk over the interviewer, they stop and listen. Each time is counted as an interruption, and your report treats it as a communication weakness.': '如果你在面试官说话时插话，对方会停下来听你说。每次都计为一次打断，报告会把它视为沟通上的不足。',
    'You can still mute your microphone, pause to edit your answer, and end the interview at any time.': '你仍然可以随时静音麦克风、暂停以编辑回答，或结束面试。',
    'Use headphones if you can: they stop the interviewer’s voice reaching your microphone.': '尽量使用耳机：这样面试官的声音不会进入你的麦克风。',
    '🔇 Live interview — your microphone is muted. Unmute it to answer.': '🔇 实时面试——你的麦克风已静音。取消静音后即可回答。',
    '🟢 Live — just answer. Stop talking for about two seconds when you have finished.': '🟢 实时——直接回答即可。说完后停顿约两秒。',
    '🟢 Live — the microphone is on. Let the interviewer finish, then answer.': '🟢 实时——麦克风已开启。请等面试官说完再回答。',
    'Interruptions: {v0}': '打断次数：{v0}',
    '✋ You interrupted the interviewer': '✋ 你打断了面试官',
    '🎙️ Live interview: interruptions': '🎙️ 实时面试：打断情况',
    'You interrupted the interviewer {v0} time(s). In a real interview that reads as not listening — let each question finish, then answer.': '你打断了面试官 {v0} 次。在真实面试中，这会显得你没有认真倾听——请让每个问题说完再回答。',
    'You never interrupted the interviewer — every question was allowed to finish.': '你从未打断面试官——每个问题都完整地说完了。',
    'Live turn-taking is not available in this browser. Turn live mode off to use the answer buttons.': '此浏览器不支持实时轮流发言。请关闭实时模式以使用回答按钮。',
    'Question {v0}: {v1} s into the interviewer’s line': '第 {v0} 题：面试官开口 {v1} 秒后',
    'Introduction or closing: {v0} s into the interviewer’s line': '开场或结束语：面试官开口 {v0} 秒后',
    'Your microphone is muted — unmute it to answer.': '你的麦克风已静音——取消静音后即可回答。',
    '🎤 Answer whenever you are ready. When you stop talking for about two seconds, your answer is sent.': '🎤 准备好就回答。停止说话约两秒后，你的回答会自动发送。',
    '🎙️ Live meeting': '🎙️ 实时会议',
    'Run it as a live meeting — no buttons, just talk': '以实时会议进行——无需按钮，直接说话',
    'The microphone listens all the time. When it is your turn, simply start speaking — there is no “Speak” or “I’m Done” button.': '麦克风会一直收听。轮到你时直接开口即可——没有“发言”或“我讲完了”按钮。',
    'Your turn ends when you stop talking for about two seconds, and the meeting moves on to the reports.': '当你停止说话约两秒，你的发言即结束，会议进入点评环节。',
    'If you talk over one of the meeting roles, they stop and listen. Each time is counted as an interruption and the evaluators mention it.': '如果你在某个会议角色说话时插话，对方会停下来听你说。每次都计为一次打断，点评人会提到它。',
    'Use headphones if you can: they stop the speakers’ voices reaching your microphone.': '尽量使用耳机：这样发言者的声音不会进入你的麦克风。',
    '🔇 Live meeting — your microphone is muted. Unmute it to speak.': '🔇 实时会议——你的麦克风已静音。取消静音后即可发言。',
    '🟢 Live — it is your turn. Stop talking for about two seconds when you have finished.': '🟢 实时——轮到你了。讲完后停顿约两秒。',
    '🟢 Live — the microphone is on. Let each role finish; your turn opens on its own.': '🟢 实时——麦克风已开启。请让每个角色说完；轮到你时会自动开始。',
    '✋ You interrupted the speaker': '✋ 你打断了发言者',
    '🎙️ Live meeting: interruptions': '🎙️ 实时会议：打断情况',
    'You talked over a meeting role {v0} time(s). In a real meeting, let each speaker finish before you begin.': '你在会议角色说话时插话 {v0} 次。在真实会议中，请等每位发言者说完再开口。',
    'You never talked over anybody — every role was allowed to finish.': '你从未打断任何人——每个角色都完整地说完了。',
    'Live turn-taking is not available in this browser. Turn live mode off to use the Speak button.': '此浏览器不支持实时轮流发言。请关闭实时模式以使用发言按钮。',
    'Your microphone is muted — unmute it to speak.': '你的麦克风已静音——取消静音后即可发言。',
    '🎤 Your turn — start speaking. When you stop for about two seconds, your turn ends.': '🎤 轮到你了——开始发言吧。停顿约两秒后，你的发言即结束。',
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
    // The candidate's own questions (2026-10-19).
    'Add questions manually': '手动添加问题',
    'Your questions — one per line *': '你的问题 — 每行一个 *',
    '💡 Paste a list straight from a job posting, a document or an email. Bullets and numbering are removed for you; repeated questions are asked once. Up to {v0} questions.': '💡 可直接粘贴招聘启事、文档或邮件中的问题列表。项目符号和编号会自动去除，重复的问题只问一次。最多 {v0} 个问题。',
    '⚠️ {v0} repeated line(s) removed.': '⚠️ 已删除 {v0} 行重复内容。',
    '⚠️ Only the first {v0} questions are used; {v1} more were left out.': '⚠️ 只使用前 {v0} 个问题，另有 {v1} 个未使用。',
    '⚠️ {v0} very long line(s) were shortened to {v1} characters.': '⚠️ 有 {v0} 行过长，已截短为 {v1} 个字符。',
    'The interviewer will ask these {v0} question(s)': '面试官将提出以下 {v0} 个问题',
    'Ask them in a random order': '随机顺序提问',
    'Real interviewers do not follow your list. Shuffling makes sure you know each answer, not just the order.': '真实的面试官不会按你的列表提问。打乱顺序能确保你掌握每个答案，而不只是记住顺序。',
    'After my questions, let the interviewer add its own': '在我的问题之后，让面试官补充自己的问题',
    'Your questions always come first and are all asked. The interviewer then adds new questions on the role, requirements and CV above — never repeating one of yours.': '你的问题总是最先提出，并且全部都会问到。之后面试官会根据上面的职位、要求和简历补充新问题 — 不会重复你的任何问题。',
    '📝 Your report is the same as a normal interview: every answer gets feedback, a model answer to rehearse, and your own answer rewritten to be stronger.': '📝 你的报告与普通面试相同：每个回答都有反馈、可供练习的示范答案，以及改写得更有力的你自己的回答。',
    'How many questions?': '多少个问题？',
    '{v0} — your list': '{v0} — 你的列表',
    '· planned at 1:30 each, so': '· 每题按 1 分 30 秒计划，共',
    'Total questions (yours + the interviewer’s) *': '问题总数（你的 + 面试官的）*',
    '{v0} of yours, then {v1} from the interviewer — {v2} minutes at 1:30 each.': '先问你的 {v0} 个，再问面试官的 {v1} 个 — 每题 1 分 30 秒，共 {v2} 分钟。',
    'One question per line, for example:': '每行一个问题，例如：',
    'Tell me about yourself.': '请介绍一下你自己。',
    'Why do you want to work here?': '你为什么想在这里工作？',
    'Explain the difference between a process and a thread.': '解释进程（process）和线程（thread）的区别。',
    'Describe a time you disagreed with your manager.': '描述一次你与经理意见不合的经历。',
    'Please enter the role / topic for a Technical interview.': '请输入技术面试的职位 / 主题。',
    'Add at least one question (one per line), or untick "Add questions manually".': '请至少添加一个问题（每行一个），或取消勾选“手动添加问题”。',
    'Hello {v0}, I\'m {v1}. Thanks for joining. Today we will go through the {v2} questions you prepared. Let\'s begin.': '你好 {v0}，我是 {v1}。感谢你的参加。今天我们会逐一过一遍你准备的 {v2} 个问题。我们开始吧。',
    'Your {v0} questions first, then the interviewer adds its own': '先问你的 {v0} 个问题，再由面试官补充',
    'The interviewer asks only the questions you added': '面试官只问你添加的问题',
    '📝 Your questions ({v0})': '📝 你的问题（{v0}）',
    '📝 Your question': '📝 你的问题',
    'Asked the questions you added': '提问的是你添加的问题',
    '📝 your questions': '📝 你的问题',
    '{v0} of yours, then the interviewer’s own': '你的 {v0} 个问题，然后是面试官的问题',
    '{v0} of yours': '你的 {v0} 个问题',
    // The downloadable interview report (2026-10-19).
    'Overall score': '总分',
    'out of 100': '满分 100',
    'Score breakdown': '分项得分',
    'Standout moment': '亮点时刻',
    'What would worry an interviewer': '面试官可能担心的地方',
    'Strengths': '优势',
    'Areas to improve': '需要改进的方面',
    'Communication': '沟通',
    'Your action plan': '你的行动计划',
    'Question-by-question coaching': '逐题辅导',
    'For each question: what you said, feedback on it, your own answer rewritten to be stronger, and a model answer to rehearse.': '每道题包括：你的回答、对它的反馈、改写得更有力的你自己的回答，以及可供练习的示范答案。',
    'Your question': '你的问题',
    'No answer was captured for this question.': '这道题没有记录到回答。',
    'Feedback on your answer': '对你回答的反馈',
    'Your answer, improved': '改进后的你的回答',
    'Your facts and examples, told more strongly.': '同样的事实和例子，讲得更有力。',
    'Model answer to rehearse': '可供练习的示范答案',
    'A short, strong answer you could say out loud.': '一个简短有力、可以直接说出口的回答。',
    'The one change that matters most': '最重要的一处改进',
    'Why the interviewer asks this': '面试官为什么问这个问题',
    'What a strong answer covers': '好的回答应包含什么',
    '{v0}/10': '{v0}/10',
    'Self Study · Interview Report': 'Self Study · 面试报告',
    'This interview was not finished, so the report covers only the questions that were answered.': '这次面试没有完成，因此报告只包含已回答的问题。',
    'Generated {v0}': '生成于 {v0}',
    'Interview Report': '面试报告',
    'Interview type': '面试类型',
    'Role / topic': '职位 / 主题',
    'Questions answered': '已回答问题',
    'Attempt': '尝试次数',
    'CV': '简历',
    'Technical Assessment': '技术评估',
    'Competency Assessment': '能力评估',
    'HR': '人力资源',
    'Your own list': '你自己的列表',
    'Your list, then the interviewer’s': '你的列表，然后是面试官的问题',
    '{v0} min {v1} s': '{v0} 分 {v1} 秒',
    'Structure': '结构',
    'Depth': '深度',
    'Download your report': '下载你的报告',
    'Preparing PDF…': '正在生成 PDF…',
    'PDF': 'PDF 文件',
    'Preparing Word file…': '正在生成 Word 文件…',
    'Word (.docx)': 'Word 文件 (.docx)',
    'The report could not be created. Please try again.': '无法生成报告，请重试。',
    '{v0} out of {v1}': '{v1} 题中的 {v0} 题',
    // What the interview report download includes (2026-10-19).
    'What to include': '包含哪些内容',
    'Full report': '完整报告',
    'Questions with strong answers': '问题与优秀答案',
    'Questions with your answers': '问题与你的回答',
    'Questions with your answers and strong answers': '问题、你的回答与优秀答案',
    'Questions & Strong Answers': '问题与优秀答案',
    'Questions & Your Answers': '问题与你的回答',
    'Your Answers & Strong Answers': '你的回答与优秀答案',
    'Each question with a strong answer you can rehearse.': '每道题附有一个可供练习的优秀答案。',
    'Each question with the answer you gave, as it was transcribed.': '每道题附有你的回答（按转写原文）。',
    'Each question with the answer you gave, and a strong answer to compare it with.': '每道题附有你的回答，以及一个可供对照的优秀答案。',
    'Score, evaluation, action plan and full coaching for every question.': '包括得分、评估、行动计划以及每道题的完整辅导。',
    'A revision sheet: each question with a strong answer to rehearse.': '复习用：每道题附有一个可供练习的优秀答案。',
    'Each question with the answer you gave, exactly as it was transcribed.': '每道题附有你的回答，完全按照转写原文。',
    'Each question with your answer and a strong answer side by side.': '每道题并列显示你的回答和一个优秀答案。',
    'Strong answer': '优秀答案',
    'No strong answer was written for this question.': '这道题没有生成优秀答案。',
    // Pausing an answer, and repairing misheard words (2026-10-19).
    '⏸ paused': '⏸ 已暂停',
    '🗣️ hearing you…': '🗣️ 正在听你说…',
    '🎤 listening…': '🎤 正在聆听…',
    '✍️ transcribing…': '✍️ 正在转写…',
    'Stop the microphone and the clock so you can edit your answer': '暂停麦克风和计时，以便编辑你的回答',
    '⏸ Pause': '⏸ 暂停',
    'Turn the microphone back on and carry on answering': '重新打开麦克风，继续回答',
    '▶ Continue': '▶ 继续',
    'Replace words the transcription misheard, using the question as context. Nothing is added or rewritten.': '根据问题的上下文，替换转写时听错的词语。不会添加或改写任何内容。',
    '✨ Checking your words…': '✨ 正在检查你的用词…',
    '✍️ Finishing transcription…': '✍️ 正在完成转写…',
    '✨ Context enhancement using AI': '✨ 使用人工智能进行上下文修正',
    'Microphone level': '麦克风音量',
    '↩︎ Undo': '↩︎ 撤销',
    'Paused — correct anything in your answer, then press Continue.': '已暂停 — 修改你的回答后，点击“继续”。',
    '🎤 Listening again — carry on with your answer.': '🎤 重新开始聆听 — 请继续回答。',
    'The microphone could not be restarted. You can still type your answer.': '无法重新启动麦克风。你仍然可以输入回答。',
    'The AI could not be reached just now. Your answer is unchanged — you can try again or fix words by hand.': '暂时无法连接人工智能。你的回答未被修改 — 可以重试，或手动修改词语。',
    'The AI suggested more than word fixes, so your answer was kept exactly as you said it.': '人工智能建议的修改超出了纠正词语的范围，因此你的回答保持原样。',
    'No misheard words found — your answer is unchanged.': '没有发现听错的词语 — 你的回答未被修改。',
    'Fixed {v0} misheard word(s):': '已修正 {v0} 处听错的词语：',
    // Toastmasters: pausing a speech, and repairing misheard words (2026-10-19).
    'Stop the microphone and the timer so you can edit your transcript': '暂停麦克风和计时，以便编辑你的转写文本',
    'Turn the microphone back on and carry on with your speech': '重新打开麦克风，继续你的演讲',
    'Replace words the transcription misheard, using the topic as context. Filler words are kept, and nothing is added or rewritten.': '根据主题的上下文，替换转写时听错的词语。口头填充词会保留，不会添加或改写任何内容。',
    'Paused — correct anything in your transcript, then press Continue.': '已暂停 — 修改转写文本后，点击“继续”。',
    '🎤 Listening again — carry on with your speech.': '🎤 重新开始聆听 — 请继续你的演讲。',
    'The microphone could not be restarted. You can still type your speech.': '无法重新启动麦克风。你仍然可以输入演讲内容。',
    'The AI could not be reached just now. Your transcript is unchanged — you can try again or fix words by hand.': '暂时无法连接人工智能。你的转写文本未被修改 — 可以重试，或手动修改词语。',
    'The AI suggested more than word fixes, so your transcript was kept exactly as you said it.': '人工智能建议的修改超出了纠正词语的范围，因此你的转写文本保持原样。',
    'No misheard words found — your transcript is unchanged.': '没有发现听错的词语 — 你的转写文本未被修改。',

    // The desktop Interview Helper's download page (views/InterviewHelper.vue).
    "Interview Helper (Desktop)": "面试助手（桌面版）",
    "Interview Helper": "面试助手",
    "Interviewer": "面试官",
    "Desktop app · Windows, macOS and Linux": "桌面应用 · Windows、macOS 和 Linux",
    "Live help in real English job interviews. It listens to the interviewer on Zoom, Microsoft Teams or Google Meet and shows you a short answer in very simple English, with the question explained in Arabic.": "在真实的英语求职面试中实时帮助你。它会收听 Zoom、Microsoft Teams 或 Google Meet 上面试官的讲话，并用非常简单的英语为你显示简短的回答，同时用阿拉伯语解释问题。",
    "Download the Interview Helper": "下载面试助手",
    "Get AI Features": "获取 AI 功能",
    "Your plan includes AI Features. Sign in to the app with your SelfStudyJo account.": "你的套餐包含 AI 功能。请用你的 SelfStudyJo 账户登录应用。",
    "Your plan does not include AI Features yet.": "你的套餐尚未包含 AI 功能。",
    "You need a SelfStudyJo account with an active subscription that includes AI Features.": "你需要一个 SelfStudyJo 账户，并拥有包含 AI 功能的有效订阅。",
    "How it helps you": "它如何帮助你",
    "Hears the interviewer": "听懂面试官",
    "It listens to your computer audio during the call, and to your microphone, and writes down what is said.": "通话期间它会收听电脑音频和你的麦克风，并记录所说的内容。",
    "Fixes what it heard": "纠正听到的内容",
    "Misheard words and broken grammar in the interviewer’s question are corrected automatically before an answer is written.": "在撰写回答之前，会自动纠正面试官问题中听错的词和语法错误。",
    "Very simple English": "非常简单的英语",
    "Answers use short sentences and everyday words, written to be read and spoken easily by an Arabic speaker.": "回答使用短句和日常词汇，让以阿拉伯语为母语的人容易阅读和说出。",
    "Answers in seconds": "几秒内给出回答",
    "Prepare answers to common HR questions before the interview. They appear instantly, then Self Study AI improves them for the exact question.": "面试前为常见的人事问题准备好回答。它们会立即显示，随后 Self Study AI 会针对具体问题进行改进。",
    "Download for your computer": "为你的电脑下载",
    "Windows 10 or 11. Computer audio works out of the box.": "Windows 10 或 11。可直接收听电脑音频。",
    "macOS 13 or newer, Intel or Apple Silicon. Allow Screen Recording once so the app can hear the call.": "macOS 13 或更新版本，Intel 或 Apple 芯片。请允许一次“屏幕录制”，以便应用收听通话。",
    "Choose the “Monitor of …” device if computer audio is not offered.": "如果没有电脑音频选项，请选择“Monitor of …”设备。",
    "All installers are on the releases page. The first time you open it, Windows may ask you to confirm (More info, then Run anyway) and on macOS right-click the app and choose Open.": "所有安装包都在发布页面上。首次打开时，Windows 可能要求确认（点击 More info，再点击 Run anyway）；在 macOS 上请右键点击应用并选择 Open。",
    "Open the releases page": "打开发布页面",
    "How to use it": "使用方法",
    "Your privacy": "你的隐私",
    "Your profile, prepared answers and interview notes are saved only in a folder on your own computer. Audio is sent only while you are listening, as short speech segments, and is not stored on our servers.": "你的资料、准备好的回答和面试记录只保存在你自己电脑上的一个文件夹里。音频只在收听时以短语音片段的形式发送，不会存储在我们的服务器上。",
    // The download buttons (one per detected system) and the 3D guide (2026-10-29).
    "Download for Windows": "下载 Windows 版",
    "Download for Mac (Apple Silicon)": "下载 Mac 版（Apple Silicon）",
    "Download for Mac (Intel)": "下载 Mac 版（Intel）",
    "Download for Linux": "下载 Linux 版",
    "Intel Mac? Download the Intel version": "使用 Intel 芯片的 Mac？下载 Intel 版",
    "Apple Silicon Mac (M1 and later)? Download that version": "使用 Apple Silicon 芯片（M1 及更新）的 Mac？下载该版本",
    "The Interview Helper runs on a computer. Open this page on your Windows, Mac or Linux computer to download it.": "面试助手在电脑上运行。请在你的 Windows、Mac 或 Linux 电脑上打开此页面进行下载。",
    "Other systems and versions": "其他系统和版本",
    "Windows installer (64-bit)": "Windows 安装程序（64 位）",
    "macOS, Apple Silicon (M1 and later)": "macOS，Apple Silicon（M1 及更新）",
    "macOS, Intel": "macOS，Intel",
    "Linux AppImage (any distribution)": "Linux AppImage（适用于任何发行版）",
    "Debian / Ubuntu package": "Debian / Ubuntu 软件包",
    "Step {v0} of {v1}": "第 {v0} 步，共 {v1} 步",
    "1. Download and install": "1. 下载并安装",
    "Press the download button above. Your computer is detected, so you get the right installer. Open it and follow the installer.": "点击上方的下载按钮。系统会识别你的电脑，为你提供合适的安装程序。打开它并按照安装步骤操作。",
    "2. Sign in": "2. 登录",
    "Open the app and sign in with your SelfStudyJo account. Your plan must include AI Features.": "打开应用，用你的 SelfStudyJo 账户登录。你的套餐必须包含 AI 功能。",
    "3. Set up the interview": "3. 设置面试",
    "Write the job title and paste your CV. The app prepares a short pitch, your strengths and stories taken only from your CV.": "填写职位名称并粘贴你的简历。应用会准备一段简短的自我介绍、你的优势，以及只取自你简历的经历故事。",
    "4. Join the call": "4. 加入通话",
    "Join the interview on Zoom, Microsoft Teams or Google Meet and press Start. The app hears the interviewer through your computer audio. Use headphones.": "在 Zoom、Microsoft Teams 或 Google Meet 上加入面试，然后点击“开始”。应用通过电脑音频听到面试官的声音。请使用耳机。",
    "5. Read the answer": "5. 阅读回答",
    "When the interviewer finishes a question, the answer appears in very simple English in the READ THIS NOW box, with the question in Arabic above it. Say it in your own voice.": "面试官说完一个问题后，回答会以非常简单的英语显示在 READ THIS NOW 框中，上方附有阿拉伯语的问题。用你自己的声音说出来。",
    "6. Get feedback": "6. 获取反馈",
    "When the interview is over, press End. You get a score, your strengths, what to improve and a better answer for each question. Every interview is saved on your computer.": "面试结束后，点击“结束”。你会得到评分、你的优势、需要改进之处，以及每个问题的更好回答。每次面试都会保存在你的电脑上。",
};

export default speaking;
