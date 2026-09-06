/**
 * Simplified Chinese — Noor, the site assistant.
 *
 * ITS OWN AREA, for the reason the index gives: the right word depends on the
 * words around it. "Assistant" here is `助手` — a helper who acts on your
 * behalf — and not `助理` (a job title) nor `客服` (which on this platform is
 * the human support widget in the corner of every page, app 9; conflating the
 * two would have readers waiting for a person to reply). "Listening" is `聆听`
 * rather than `听到`, because the point is that she is attending, not that
 * sound reached her.
 *
 * SIMPLIFIED, and it has to be said rather than assumed: a model told only
 * "answer in Chinese" intermittently produces Traditional, which is why
 * `locales.ts` names the script for the AI side. The same discipline applies to
 * a human editing this file.
 *
 * HER NAME IS NOT TRANSLATED. `Noor` is transliterated as `努尔`, not rendered
 * by meaning: it is a name (working rule 41), and translating it would leave
 * the spoken greeting and the plate under her face disagreeing about who she
 * is.
 *
 * NO SPACE BEFORE PUNCTUATION, and full-width marks throughout — `？` and `。`
 * rather than `?` and `.`. A Latin question mark after Han characters is the
 * commonest tell of a machine-translated interface.
 */

const assistant: Record<string, string> = {
    // ── the button and the window ───────────────────────────────────────────
    'Assistant': '助手',
    'Ask Noor, the site assistant': '向站点助手努尔提问',
    'Ask me anything about Self Study Jo…': '关于 Self Study Jo 的任何问题都可以问我…',
    'Noor is thinking': '努尔正在思考',
    'Talk to Noor': '与努尔对话',
    'Stop listening': '停止聆听',
    'Voice on': '语音已开启',
    'Voice off': '语音已关闭',
    // `{v0}` is the destination's own name.
    'Open {v0}': '打开{v0}',

    // ── the plate under her face ────────────────────────────────────────────
    'here to help': '随时为你服务',
    'thinking…': '思考中…',
    'speaking': '讲话中',
    'listening…': '聆听中…',

    // ── what she opens with ─────────────────────────────────────────────────
    'Hi {name} — I am Noor. Ask me about anything on Self Study Jo, or tell me where you want to go and I will take you there.':
        '你好，{name}——我是努尔。关于 Self Study Jo 的任何问题都可以问我，或者告诉我你想去哪个页面，我带你过去。',
    'Hi — I am Noor, the Self Study Jo assistant. Ask me what the platform does or where to find something. Sign in and I can look up your own results too.':
        '你好——我是 Self Study Jo 的助手努尔。你可以问我这个平台能做什么，或者某项内容在哪里。登录之后，我还能帮你查看自己的成绩。',

    // ── the suggestion chips ────────────────────────────────────────────────
    'What is Self Study Jo?': 'Self Study Jo 是什么？',
    'Show me my quiz results': '看看我的小测成绩',
    'Take me to the labs': '带我去实验室',
    'When does my plan expire?': '我的订阅什么时候到期？',
    'What can I learn here?': '我在这里能学到什么？',
    'Take me to the courses': '带我去课程页面',
    'How do the labs work?': '实验室是怎么运作的？',

    // ── the one thing she will not do ───────────────────────────────────────
    'I can help you find your way around and look things up, but I do not answer exam, quiz, lab or homework questions — working them out is the part that teaches you something. I can open the lesson, the runbook or the lab brief that covers it. If you meant something else, ask me again in other words.':
        '我可以帮你在平台里找路、查资料，但我不会回答考试、小测、实验或作业题——自己动手推演出来，才是真正学到东西的那一步。我可以帮你打开对应的课时、操作手册或实验说明。如果你想问的是别的事情，请换个说法再问我一次。',

    // ── when something goes wrong ───────────────────────────────────────────
    // Deliberately does NOT say "permission denied": `getUserMedia` has at
    // least six distinct failures and only one of them is a refusal.
    'I could not open your microphone. Check that one is connected, that this site is allowed to use it, and that another application is not holding it.':
        '无法打开你的麦克风。请确认麦克风已连接、本站已获得使用权限，并且没有其他应用正在占用它。',
    'I did not get an answer that time. Ask me again?':
        '这次没有拿到回答。要再问我一遍吗？',
    'The assistant is out of capacity just now. Try again in a moment.':
        '助手当前负载已满，请稍后再试。',
    'I could not reach the assistant service. Check your connection and try again.':
        '无法连接到助手服务。请检查网络连接后重试。',
};

export default assistant;
