/**
 * Simplified Chinese — the practice record: exam integrity, lab scoring,
 * activity records.
 *
 * ITS OWN AREA, for the reason the index gives: context is what makes a
 * translation right. "Record" here is a written account of somebody's conduct
 * (`记录`, and specifically `活动记录` for the panel), not a database row;
 * "breach" is `违规`, the word an institution puts on a disciplinary notice;
 * "cheating" is `作弊`, which is the only word an examination hall uses and the
 * one a student would recognise instantly. Sorted alphabetically beside
 * `Clear` and `Close` there would be nothing to go on.
 *
 * SCRIPT. Simplified throughout, and the register is formal-plain rather than
 * literary — the reprimand in particular, because the one place the interface
 * accuses somebody is the last place to be ornate: the reader has to be able to
 * argue with it.
 *
 * DIGITS AND SPACING. Latin digits, and no space before Chinese punctuation
 * (`speakable()` on app 36 documents the same rule for the newscast). A `{v0}`
 * placeholder sits directly against the characters around it, which is what a
 * Chinese sentence does with a number.
 */
export default {
    /* ---------------- the leaderboard's own additions ---------------- */
    'Activity': '活动',
    'Activity record': '活动记录',
    'And what conduct is worth': '以及行为的分值',
    'Anybody can open a learner\'s activity record and see what was earned, what was lost, and when. That is the point: a rule nobody can see does not deter anything, and everyone is told before they start.':
        '任何人都可以打开某位学员的活动记录，查看他获得了什么、失去了什么以及发生的时间。这正是本意所在：无人看见的规则起不到任何约束作用，而每位学员在开始之前都会被告知。',
    'Conduct': '行为',
    'Copying or pasting': '复制或粘贴',
    'Every action is public.': '每一项操作都是公开的。',
    'Five breaches end an exam.': '五次违规将终止考试。',
    'Five minutes of unbroken work': '连续五分钟的专注工作',
    'Leaving the exam window': '离开考试窗口',
    'Leaving the window, switching away, copying, pasting, printing or opening the developer tools during an exam or a quiz is recorded. {v0} of them and the paper is submitted, scored zero and marked as cheating. A lab records the same actions and can never be failed by them.':
        '在考试或测验期间离开窗口、切换到其他程序、复制、粘贴、打印或打开开发者工具，都会被记录。累计{v0}次，试卷将被自动提交、判为零分并记为作弊。实验室会记录同样的操作，但绝不会因此判你不及格。',
    'No identifiers and no content are published.': '不公开任何标识符，也不公开任何内容。',
    'Opening the developer tools': '打开开发者工具',
    'Show every action {v0} has taken': '查看 {v0} 的全部操作',
    'Sitting a whole paper cleanly': '全程清白地完成整张试卷',
    'Switching away with Alt+Tab': '用 Alt+Tab 切换离开',
    'The board shows the name a learner\'s own certificates carry and their totals — no account id and no email. Nothing anywhere records an answer, a question, or what was copied: a copy is recorded as a character count.':
        '排行榜只显示学员自己证书上的姓名和总分——没有账号标识，也没有电子邮箱。任何地方都不会记录答案、题目或被复制的内容：复制只记录字符数。',
    'nothing recorded': '无记录',

    /* ---------------- the activity record ---------------- */
    'A quiz — the platform cannot name one without publishing its answer key':
        '一次测验——平台无法在不公开答案的前提下说出它的名称',
    'Active days': '活跃天数',
    'Activity over time': '活动随时间的变化',
    'Activity record for {v0}': '{v0} 的活动记录',
    'An exam the platform cannot name': '平台无法命名的一场考试',
    'Built in your browser from the same public collections the board is built from. No account identifiers are shown, and no answer, question or copied text is ever recorded.':
        '在你的浏览器中由排行榜所依据的同一批公开数据构建。不显示任何账号标识，也从不记录任何答案、题目或被复制的文本。',
    'Close the activity record': '关闭活动记录',
    'Courses enrolled': '已报名的课程',
    'Earned by achievement': '来自成就的得分',
    'Enrolling on a course earns nothing — it is here because it is what somebody is working on. An exam certificate earns nothing either: the pass already earned the points.':
        '报名课程不产生积分——它列在这里是为了说明学员正在学什么。考试证书同样不产生积分：通过考试本身已经算过分了。',
    'Every action, in the order it happened. A line with no points beside it changed nothing — it is here because it is what the rest is read against.':
        '按发生顺序列出的每一项操作。旁边没有分数的条目没有改变任何数值——它在这里是为了给其余记录提供上下文。',
    'Everything on this platform, with the time it happened. This record is public.':
        '这个平台上的全部记录，以及各自发生的时间。本记录是公开的。',
    'Five recorded integrity breaches end an exam or a quiz. Every action is in the record below with the time it happened.':
        '五次被记录的诚信违规会终止一场考试或测验。每一项操作都在下方记录中，并附有发生时间。',
    'How many things happened in each period. Beside the points and not instead of them: a busy period that lost most of its points is not a quiet one.':
        '每个时段发生了多少事。它与积分并列而非取代积分：一个忙碌却扣掉大部分积分的时段并不是一个安静的时段。',
    'Labs finished': '已完成的实验室',
    'Labs in progress': '进行中的实验室',
    'No conduct has been recorded — this learner has sat nothing since the practice record was introduced.':
        '尚无行为记录——自练习记录启用以来，这位学员还未参加过任何测评。',
    'No exam sat.': '未参加过考试。',
    'No lab finished yet.': '尚未完成任何实验室。',
    'No quiz taken.': '未参加过测验。',
    'None issued.': '尚未颁发。',
    'Not enrolled on anything.': '未报名任何课程。',
    'Nothing dated to plot.': '没有可绘制的带时间数据。',
    'Nothing earned yet.': '尚未获得任何积分。',
    'Nothing has been recorded for this learner yet.': '尚未为这位学员记录任何内容。',
    'Nothing open at the moment.': '目前没有进行中的项目。',
    'Only the best attempt at each assessment is shown, which is the same attempt the ranking counts. A failure earns nothing and stays on the record.':
        '每项测评只显示最好的一次尝试，也就是排名所采用的那一次。未通过的尝试不产生积分，并且会留在记录中。',
    'Only the sources that earned. Conduct is shown on its own tile above, because it is the one figure here that can be negative.':
        '只列出产生积分的来源。行为单独显示在上方的卡片中，因为它是这里唯一可能为负的数值。',
    'Points over time': '积分随时间的变化',
    'The running total, including the quiet periods — a series that skipped them would imply activity that never happened.':
        '累计总分，包含没有活动的时段——跳过它们的曲线会暗示出并不存在的活动。',
    'Total points': '总积分',
    'What was earned and what was lost, per kind of action. Nothing here records what was copied or typed — a copy is recorded as a character count and never as the text.':
        '按操作类型列出的所得与所失。这里不记录被复制或输入的内容——复制只记录字符数，从不记录文本本身。',
    'Where the points came from': '积分的来源',
    'Which part of the record': '记录的哪一部分',
    'achievements and conduct together': '成就与行为的合计',
    'course': '课程',
    'exam': '考试',
    'exams, quizzes, labs, certificates': '考试、测验、实验室与证书',
    'no dated activity': '无带时间的活动',
    'no points': '无积分',
    'since {v0}': '自 {v0} 起',
    'this learner': '这位学员',
    '{v0} earned, {v1} lost': '获得 {v0} 项，失去 {v1} 项',
    '{v0} sitting(s) were ended for cheating and scored zero.':
        '有 {v0} 场测评因作弊被终止并判为零分。',
    '{v0}\'s picture': '{v0} 的照片',
    '{v0}/{v1} tasks': '{v0}/{v1} 项任务',

    /* ---------------- the rules gate ---------------- */
    'Before you begin': '开始之前',
    'I understand — start the exam': '我已了解——开始考试',
    'Not now': '暂不开始',
    'Recorded score': '记录的成绩',
    'See my activity record': '查看我的活动记录',
    '{v0} questions, {v1} minutes, and a pass mark of {v2}%. The clock starts when you accept the rules below.':
        '共 {v0} 道题，限时 {v1} 分钟，及格线为 {v2}%。你确认下方规则后计时开始。',

    /* ---------------- the rules themselves ---------------- */
    'A lab is for trying things. Every action below is recorded and some of them cost points, but no number of them ends a lab or takes a task away from you. Leaving the window to read the documentation is what a practitioner does.':
        '实验室就是用来动手尝试的。下面每一项操作都会被记录，其中一些会扣分，但无论多少次都不会终止实验室，也不会收回你已完成的任务。离开窗口去查文档，本来就是从业者的做法。',
    'Also recorded, and worth nothing either way': '同样会被记录，但不加分也不扣分',
    'Every point on the public leaderboard comes from something this platform verified. Nothing here is awarded for turning up, and nothing here can be talked up: a task counts when the service looks at your environment and finds what the lab asked for.':
        '公开排行榜上的每一分都来自平台亲自核验过的事实。这里没有出勤分，也没有靠说辞得来的分：只有当服务检查你的环境并找到实验室所要求的结果时，任务才算完成。',
    'Everything recorded here is public. Anybody can open your activity record on the leaderboard and see what you earned, what you lost and when. Nothing records an answer, a question, or what you copied — a copy is recorded as a number of characters and never as the text.':
        '这里记录的一切都是公开的。任何人都可以在排行榜上打开你的活动记录，查看你获得了什么、失去了什么以及发生的时间。系统不记录任何答案、题目或你复制的内容——复制只记录字符数，从不记录文本本身。',
    'Exam integrity': '考试诚信',
    'How lab points work': '实验室积分的计算方式',
    'How you earn points here': '你在这里如何获得积分',
    'Leave the window, read the manual, ask the tutor, break the environment and reset it. Some of that costs points and none of it ends a lab, takes a verified task away from you, or counts against an exam. The five-breach rule is for exams and quizzes only, and it is on the screen before you start one.':
        '离开窗口、查阅手册、向助教提问、把环境弄坏再重置。其中一些会扣分，但都不会终止实验室、不会收回已核验的任务，也不会计入任何考试。五次违规的规则只适用于考试与测验，而且会在你开始之前显示在屏幕上。',
    'Nothing here can fail you': '这里没有任何东西会让你不及格',
    'Nothing in a lab can fail you': '实验室里没有任何东西会让你不及格',
    'Nothing in this context earns conduct points.': '在此情境下没有可获得行为积分的操作。',
    'Nothing recorded yet.': '尚无记录。',
    'Nothing recorded. Keep the paper in front of you and it stays that way.':
        '尚无记录。把试卷留在眼前，就会一直如此。',
    'Practice record': '练习记录',
    'See the leaderboard': '查看排行榜',
    'The full table, and what is recorded': '完整表格，以及记录的内容',
    'This is an assessment, not a lab. Leaving the window, switching away with Alt+Tab, copying, pasting, printing or opening the developer tools is recorded, costs points, and counts as one of the {v0}. Reach {v0} and the paper is submitted for you, marked zero, and recorded as cheating.':
        '这是一场测评，不是实验室。离开窗口、用 Alt+Tab 切换、复制、粘贴、打印或打开开发者工具，都会被记录、扣分，并计入{v0}次之内。一旦达到{v0}次，系统会替你提交试卷、判为零分并记为作弊。',
    'What costs points': '哪些操作会扣分',
    'What earns points': '哪些操作会加分',
    'Your record is public. Anybody can open it from the leaderboard and see every task you finished, every lab you are in the middle of, and every point earned or lost — with the time it happened.':
        '你的记录是公开的。任何人都可以从排行榜打开它，查看你完成的每项任务、正在进行的每个实验室，以及每一次加分或扣分——并附有发生时间。',
    'and {v0} more, all of them on your activity record':
        '另有 {v0} 项，全部都在你的活动记录中',
    '{v0} integrity breaches will end this sitting and score it zero':
        '{v0}次诚信违规将终止本场测评并判为零分',
    '{v0} of {v1} integrity breaches recorded': '已记录 {v0}/{v1} 次诚信违规',

    /* ---------------- the lab's tutor allowance ---------------- */
    'Your {v0} free asks are used. Each further ask costs {v1} points. It will not fail the lab and it will not take a verified task away from you.':
        '你的 {v0} 次免费提问已用完。之后每次提问扣 {v1} 分。这不会让实验室不及格，也不会收回已核验的任务。',
    '{v0} of your {v1} free tutor asks used in this lab. Each ask after that costs {v2} points — and finishing within the allowance earns {v3}.':
        '本实验室已用掉 {v0}/{v1} 次免费助教提问。之后每次提问扣 {v2} 分——而在额度内完成实验室可获得 {v3} 分。',

    /* ---------------- the catalogue: what each action is ---------------- */
    'Started the paper': '开始答卷',
    'The sitting began.': '本场测评开始。',
    'Read and accepted the integrity rules': '阅读并接受了诚信规则',
    'The clock does not start until the rules are accepted.': '在接受规则之前不会开始计时。',
    'Submitted the paper': '提交了试卷',
    'The sitting ended.': '本场测评结束。',
    'Opened the lab': '打开了实验室',
    'So a lab you are working on is visible before you finish it.':
        '这样你正在做的实验室在完成之前也能被看到。',
    'Pressed Check my work': '点击了"检查我的作业"',
    'Free and unlimited. Checking often is how a lab is meant to be worked.':
        '免费且不限次数。频繁检查正是实验室预期的工作方式。',
    'Asked the lab tutor': '向实验室助教提问',
    'Your first three asks in a lab are free.': '每个实验室的前三次提问免费。',
    'Reset the environment': '重置了环境',
    'Starting again costs nothing.': '重新开始不扣任何分。',
    'Stayed on task': '保持专注',
    'One award for every five minutes of unbroken attention, up to twelve.':
        '每连续专注五分钟奖励一次，最多十二次。',
    'Answered every question': '回答了所有题目',
    'Awarded once, for leaving nothing blank.': '奖励一次，因为没有留下任何空白。',
    'Sat the whole paper cleanly': '全程清白地完成整张试卷',
    'No window left, nothing copied, nothing pasted, from the first question to submission.':
        '从第一题到提交，未离开窗口、未复制、未粘贴。',
    'Finished the lab within the free tutor allowance': '在免费助教额度内完成了实验室',
    'Completed every task having asked the tutor three times or fewer.':
        '在向助教提问不超过三次的情况下完成了所有任务。',
    'Worked a task through to a verified pass': '把一项任务做到通过核验',
    'Awarded when Check my work finds something new, up to four times per lab.':
        '当"检查我的作业"发现新进展时奖励，每个实验室最多四次。',
    'Left the exam window': '离开了考试窗口',
    'The tab lost focus or was hidden. In an exam this is one of the five.':
        '标签页失去焦点或被隐藏。在考试中这计入五次之内。',
    'Switched away with Alt+Tab': '用 Alt+Tab 切换离开',
    'A deliberate switch to another application, which is why it costs more.':
        '有意切换到其他程序，因此扣分更多。',
    'Copied text out of the paper': '从试卷中复制了文本',
    'How many characters is recorded. The text itself never is.':
        '只记录字符数。文本本身从不记录。',
    'Pasted text into the paper': '把文本粘贴到试卷中',
    'An answer that arrived from somewhere else.': '来自别处的答案。',
    'Opened the browser developer tools': '打开了浏览器开发者工具',
    'The heaviest penalty: during a paper its only use is to read what the page was sent.':
        '扣分最重：在答卷期间，它唯一的用途就是查看页面收到的数据。',
    'Tried to print or save the paper': '试图打印或保存试卷',
    'Taking the questions out of the room.': '把题目带出考场。',
    'Left full screen': '退出了全屏',
    'Cheapest of the five, because it is the one people do by accident.':
        '五者中扣分最少，因为这一项常常是无意为之。',
    'Asked the tutor beyond the free allowance': '在免费额度之外向助教提问',
    'Each ask past the first three costs. It never fails a lab.':
        '前三次之后每次提问都会扣分。但绝不会让实验室不及格。',

    /* ---------------- the reprimand ---------------- */
    'This sitting was ended for cheating': '本场测评因作弊被终止',
    'Leaving the exam window, switching away with Alt+Tab, copying, pasting, printing or opening the developer tools during a paper is cheating. {v0} breaches were recorded against this sitting and {v1} is the limit, so it has been submitted and scored zero. Every action is on your activity record with the time it happened, and that record is public. Speak to your instructor if you believe any of it is wrong.':
        '在答卷期间离开考试窗口、用 Alt+Tab 切换、复制、粘贴、打印或打开开发者工具，均属作弊。本场测评被记录了 {v0} 次违规，上限为 {v1} 次，因此已被提交并判为零分。每一项操作都在你的活动记录中，并附有发生时间，而该记录是公开的。如果你认为其中有误，请联系你的授课教师。',

    /* ---------------- how a lab earns ---------------- */
    'Every task the service verifies in your environment is worth {v0} points.':
        '服务在你的环境中核验通过的每项任务价值 {v0} 分。',
    'Finishing every task in a lab adds {v0} more.':
        '完成一个实验室的所有任务再加 {v0} 分。',
    'Finishing a lab having asked the tutor {v0} times or fewer adds {v1}.':
        '在向助教提问不超过 {v0} 次的情况下完成实验室，再加 {v1} 分。',
    'Every five minutes of unbroken work adds {v0}, up to {v1} times.':
        '每连续工作五分钟加 {v0} 分，最多 {v1} 次。',
    'Working a task through to a verified pass adds {v0}, up to {v1} times.':
        '把一项任务做到通过核验加 {v0} 分，最多 {v1} 次。',
    'Asking the tutor a fourth time and beyond costs {v0} each.':
        '第四次及以后每次向助教提问扣 {v0} 分。',
    'Leaving the window costs {v0}, and Alt+Tab costs {v1} — but nothing in a lab can fail you.':
        '离开窗口扣 {v0} 分，Alt+Tab 扣 {v1} 分——但实验室里没有任何东西会让你不及格。',

    /* ---------------- the strike meter ---------------- */
    'Clean so far. {v0} breaches would end this sitting.':
        '目前清白。累计{v0}次违规将终止本场测评。',
    '{v0} of {v1} breaches recorded. {v2} more will end this sitting.':
        '已记录 {v0}/{v1} 次违规。再有{v2}次将终止本场测评。',
    'One more breach will end this sitting and score it zero.':
        '再有一次违规就会终止本场测评并判为零分。',
    'This sitting has been ended. {v0} integrity breaches were recorded and {v1} is the limit.':
        '本场测评已被终止。共记录 {v0} 次诚信违规，上限为 {v1} 次。',
    'No points lost. Keep going.': '未扣任何分。继续保持。',
    '{v0} points lost so far. Nothing here can fail you — a lab is for trying things.':
        '目前已扣 {v0} 分。这里没有任何东西会让你不及格——实验室就是用来动手尝试的。',

    /* ---------------- why an achievement earned what it earned ---------------- */
    'Passed an exam — {v0} points, plus {v1} for a distinction at {v2} or above.':
        '通过一场考试——{v0} 分，成绩达到 {v2} 分及以上再加 {v1} 分优异奖励。',
    'An attempt that did not pass. It earns nothing and it counts towards the pass rate, which is the only way that figure means anything.':
        '一次未通过的尝试。它不产生积分，并计入通过率——这也是那个数字唯一有意义的算法。',
    'Passed a quiz — {v0} points, plus {v1} for a distinction.':
        '通过一次测验——{v0} 分，优异再加 {v1} 分。',
    'A course certificate — {v0} points. It is the one credential that scores, because nothing else records finishing a course.':
        '一张课程证书——{v0} 分。它是唯一产生积分的凭证，因为没有别的记录能证明课程已完成。',
    'Issued automatically for passing the exam, so it is worth nothing on its own — the pass already earned the points. It is still a credential.':
        '通过考试后自动颁发，因此本身不产生积分——通过考试已经算过分了。但它仍然是一份凭证。',
    '{v0} verified tasks at {v1} points each{v2}.':
        '{v0} 项已核验的任务，每项 {v1} 分{v2}。',

    /* ---------------- the kind chips ---------------- */
    'Lab': '实验室',
};
