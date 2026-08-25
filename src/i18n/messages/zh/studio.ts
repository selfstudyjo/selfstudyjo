/**
 * The Roblox studio, the Network Simulator's project and lesson pages, the CV
 * photo studio and the last odds and ends — Chinese (Simplified).
 *
 * ============================================================
 * A PROPERTY NAME IN SOMEBODY ELSE'S EDITOR IS NOT PROSE
 * ============================================================
 *
 * `Anchored`, `CanCollide`, `Transparency`, `Material`, `Color` are the names
 * Roblox Studio itself puts in its properties panel. A student is meant to find
 * that row in Studio and change it, and Studio is in English — so translating
 * the label here sends them looking for a row that does not exist. They are on
 * `tools/i18n-check/untranslated.json` with the reason recorded, exactly like
 * the simulator's CLI keywords and the labs' shell commands.
 *
 * What is translated is every instruction around them, and on this feature that
 * is most of the value: the import steps, the export formats, the "paste this
 * into ServerScriptService" walkthrough.
 */

import type { Catalogue } from '../../index';

const studio: Catalogue = {
    /* ---------------------------------------------------------------- *
     * Roblox — the two tools
     * ---------------------------------------------------------------- */
    '🎨 Part Designer': '🎨 部件设计器',
    'Part Designer': '部件设计器',
    'Roblox Animation Studio': 'Roblox 动画工作室',
    'Create, preview & export Lua animation scripts for Roblox':
        '为 Roblox 创建、预览并导出 Lua 动画脚本',
    '🤖 AI Part Generator': '🤖 AI 部件生成器',
    '🤖 AI Generate': '🤖 AI 生成',
    'Describe what to build. AI creates it with hierarchy (root + children), proper shapes and materials. All parts anchored.':
        '描述你想搭建的东西。AI 会按层级（根部件 + 子部件）生成，并配好形状和材质，所有部件都会锚定。',
    'Describe the animation. AI generates the Lua code and saves to your library.':
        '描述这段动画。AI 会生成 Lua 代码并保存到你的库中。',
    'Choose from the library or create with AI.': '从库中选择，或用 AI 创建。',
    'Model Name': '模型名称',
    'My Model': '我的模型',
    'My Saved Designs': '我保存的设计',
    'Parts Tree ({v0})': '部件树（{v0}）',
    '+ Root Part': '+ 根部件',
    'Add child': '添加子部件',
    'Part:': '部件：',
    'Edit: {v0}': '编辑：{v0}',
    'Position & size': '位置与尺寸',
    'Category': '分类',
    'Icon': '图标',
    'Info': '信息',
    'Mine': '我的',
    'Search…': '搜索……',
    'Loading…': '加载中……',
    'Best For': '最适合',
    '💀 Kill Player on Touch': '💀 触碰即淘汰玩家',

    '🎬 Animations': '🎬 动画',
    'Animations': '动画',
    'Animation': '动画',
    'Custom Animation': '自定义动画',
    '🎬 Part Animation': '🎬 部件动画',
    '🎬 Model Animation (from library)': '🎬 模型动画（来自库）',
    'Model Animation Script (Lua)': '模型动画脚本（Lua）',
    'Global Behavior Script (Lua)': '全局行为脚本（Lua）',
    'Select an Animation': '选择一段动画',
    'Select an animation to preview': '选择一段动画进行预览',
    'No animations found': '未找到动画',
    '⚙️ Add Animation': '⚙️ 添加动画',
    '⚙️ Add to Library': '⚙️ 添加到库',
    '🤖 My Animations': '🤖 我的动画',
    '📚 Library': '📚 库',
    '🔄 New': '🔄 新建',
    'Loop:': '循环：',
    'Speed:': '速度：',
    'Lua Code': 'Lua 代码',
    'Lua Script': 'Lua 脚本',
    'View script': '查看脚本',
    'Preview Params JSON': '预览参数 JSON',

    'How to Import': '如何导入',
    'How to Apply': '如何应用',
    'Import RBXM (Recommended)': '导入 RBXM（推荐）',
    '📥 RBXM': '📥 RBXM',
    '📦 ZIP': '📦 ZIP',
    'ZIP Package': 'ZIP 压缩包',
    '📄 Lua': '📄 Lua',
    'Save → 📥 RBXM → In Studio: File → Import from File → select .rbxm. All parts, scripts, kill zones, animations included.':
        '保存 → 📥 RBXM → 在 Studio 中：File → Import from File → 选择 .rbxm 文件。所有部件、脚本、淘汰区和动画都会一并导入。',
    '📄 Lua → paste into ServerScriptService Script → F5 to create → stop, delete script, save.':
        '📄 Lua → 粘贴到 ServerScriptService 下的 Script 中 → 按 F5 生成 → 停止运行、删除脚本、保存。',
    '📦 ZIP → contains RBXM + Lua + README.': '📦 ZIP → 内含 RBXM、Lua 和 README。',

    /* ---------------------------------------------------------------- *
     * The Network Simulator's project list
     * ---------------------------------------------------------------- */
    'Build a network. Run it. Watch every layer.': '搭一个网络。跑起来。看清每一层。',
    'Drag real devices onto the canvas, cable them, configure them with real CLI syntax, then send a packet and follow it hop by hop — MAC rewrites, VLAN tags, TTL, NAT, ACLs and all seven layers of encapsulation. The AI tutor sees the same network you do.':
        '把真实设备拖到画布上、连好线、用真实的 CLI 语法配置，然后发一个数据包，逐跳跟着它走 —— MAC 重写、VLAN 标签、TTL、NAT、ACL，以及七层封装的全过程。AI 导师看到的和你看到的是同一个网络。',
    'What this simulator actually models': '这个模拟器到底模拟了什么',
    'device types': '种设备类型',
    'OSI layers simulated': '层 OSI 模型已模拟',
    'templates': '个模板',
    'lessons': '节课',
    'My networks': '我的网络',
    'New network': '新建网络',
    'Untitled network': '未命名网络',
    'Search my networks…': '搜索我的网络……',
    'Loading your projects…': '正在加载你的项目……',
    'Start from': '从此开始',
    'Blank canvas': '空白画布',
    'Start from a blank canvas, load a template, or let the AI generate one for you.':
        '从空白画布开始、加载一个模板，或让 AI 为你生成一个。',
    'Start from a working network': '从一个可运行的网络开始',
    'Browse templates': '浏览模板',
    'Branch office network': '分支机构网络',
    'Every template is correct and runnable. Load one, run it, then break it deliberately.':
        '每个模板都是正确且可运行的。加载一个、跑起来，然后故意把它弄坏。',
    'Create and open': '创建并打开',
    'Description (optional)': '描述（可选）',
    'Community networks': '社区网络',
    'Copy to my networks': '复制到我的网络',
    'Nothing shared yet. Open one of your networks and press': '还没有分享内容。打开你的一个网络，然后点击',
    'to publish it for other students.': '把它发布给其他同学。',
    'shared': '已分享',
    'by {v0}': '来自 {v0}',
    'Your progress': '你的进度',
    '{v0} XP · {v1} badge{v2}': '{v0} 经验 · {v1} 枚徽章',
    '{v0} XP · {v1} badges': '{v0} 经验 · {v1} 枚徽章',
    'Learn by doing': '边做边学',
    'Open the curriculum →': '打开课程大纲 →',
    'Lab feature · Network Simulator': '实验室功能 · 网络模拟器',

    /* Storage: the token explanation, translated in full because it is a
     * security explanation rather than a setting. */
    'Storage settings': '存储设置',
    'Connect storage': '连接存储',
    'Connect this device with a GitHub token': '用 GitHub 令牌连接此设备',
    'Fine-grained personal access token': '细粒度个人访问令牌',
    'Repository': '仓库',
    'Proxy': '代理',
    'Save and test': '保存并测试',
    'Forget token': '清除令牌',
    'Last sync': '上次同步',
    'Syncing to {v0}': '正在同步到 {v0}',
    'Projects are saving to this browser only': '项目仅保存在此浏览器中',
    'The data repository is not reachable': '无法连接数据仓库',
    'Everything works — your networks, lessons and progress are all kept in this browser. Cross-device sync needs the':
        '功能都正常 —— 你的网络、课程和进度都保存在此浏览器中。跨设备同步需要',
    'storage endpoints deployed on the Self Study AI backend; the frontend finds them through the registry automatically. Until then, you can sync just this device from Storage settings.':
        '在 Self Study AI 后端部署存储接口；前端会通过注册表自动找到它们。在那之前，你可以在“存储设置”中只同步这一台设备。',
    'Why there is no build-time token:': '为什么不在构建时嵌入令牌：',
    'anything in a': '任何写在',
    'variable is compiled into the published JavaScript. GitHub\'s push protection blocks a deploy that contains one, which is the right outcome — a write-capable token in a public bundle can be extracted by anyone who loads the page.':
        '变量里的内容都会被编译进发布的 JavaScript。GitHub 的推送保护会拦下包含令牌的部署，这是正确的结果 —— 公开包里的可写令牌，任何打开页面的人都能提取出来。',
    'The token is stored in this browser only. It is never part of the deployed site, so it cannot leak to visitors — but it also only works on this device. For real multi-user sync, point':
        '令牌只保存在此浏览器中，绝不会成为已发布站点的一部分，因此不会泄露给访客 —— 但它也只在这台设备上有效。要实现真正的多人同步，请把',
    'at a backend that holds the token server-side.': '指向一个在服务器端保管令牌的后端。',
    '{v0} — your work is still safe in this browser and will sync on the next successful save.':
        '{v0} —— 你的内容仍安全保存在此浏览器中，下次保存成功时会自动同步。',

    /* ---------------------------------------------------------------- *
     * The studio's own furniture
     * ---------------------------------------------------------------- */
    'Back to projects': '返回项目列表',
    'Unsaved changes': '有未保存的更改',
    'Undo (Ctrl+Z)': '撤销（Ctrl+Z）',
    'Redo (Ctrl+Shift+Z)': '重做（Ctrl+Shift+Z）',
    'Tidy the layout': '整理布局',
    'Layout': '布局',
    'Configure': '配置',
    'Inspect': '检查',
    'Simulation': '模拟',
    'Lesson': '课程',
    'AI tutor': 'AI 导师',
    'Add to canvas': '添加到画布',
    'Add to existing': '添加到现有拓扑',
    'Search devices, tags, protocols…': '搜索设备、标签、协议……',
    'Select a device to open its terminal, or double-click one on the canvas.':
        '选择一台设备打开它的终端，或在画布上双击某台设备。',
    'Reset MAC/ARP/NAT tables': '重置 MAC / ARP / NAT 表',
    'Layer {v0} · {v1} · since {v2} · {v3} ports': '第 {v0} 层 · {v1} · 自 {v2} · {v3} 个端口',

    'Subnet calculator': '子网计算器',
    'IP address': 'IP 地址',
    'Mask or prefix': '掩码或前缀',
    'Enter a valid IPv4 address to see the breakdown.': '输入有效的 IPv4 地址即可查看拆解结果。',
    'Usable hosts': '可用主机数',
    'Usable range': '可用地址范围',
    'Broadcast': '广播地址',
    'Wildcard': '通配符掩码',
    'Class / scope': '类别 / 范围',
    'Split into equal subnets': '等分为多个子网',
    'New prefix': '新前缀',
    '{v0}–{v1} · {v2} hosts · bcast {v3}': '{v0}–{v1} · {v2} 台主机 · 广播 {v3}',

    'Import & export': '导入与导出',
    'Import / export JSON': '导入 / 导出 JSON',
    'Import': '导入',
    'Load from file': '从文件加载',
    'Download .json': '下载 .json',
    'Copy topology JSON': '复制拓扑 JSON',
    'Paste topology JSON': '粘贴拓扑 JSON',
    'Fill with current topology': '填入当前拓扑',
    'Topologies are stored as JSON in': '拓扑以 JSON 形式保存在',
    '. The same format is what the AI generator produces, so anything you export can be edited by hand and re-imported.':
        '。AI 生成器输出的也是同一种格式，因此你导出的内容都可以手工编辑后再导入。',
    'Each template is a working, correct network — load one and start breaking it. That is how you learn fastest.':
        '每个模板都是一个可运行且正确的网络 —— 加载一个，然后开始把它弄坏。这样学得最快。',

    /* ---------------------------------------------------------------- *
     * The Learn hub
     * ---------------------------------------------------------------- */
    'Learn networking by building it': '在动手搭建中学网络',
    'You will be able to': '你将能够',
    'Tasks checked in the studio': '在工作台中检查的任务',
    'Check your understanding': '检验你的理解',
    'Practice questions on any topic': '任意主题的练习题',
    'The AI tutor writes exam-style questions and explains every answer.':
        'AI 导师会出考试风格的题目，并逐题讲解答案。',
    'e.g. VLSM, trunking, OSPF cost, NAT overload': '例如：VLSM、trunking、OSPF 开销、NAT overload',

    /* ---------------------------------------------------------------- *
     * The CV photo studio and voice recorder
     * ---------------------------------------------------------------- */
    'Photo studio': '照片工作室',
    'Picture': '照片',
    'Upload a photo': '上传照片',
    'Use your camera': '使用摄像头',
    'PNG, JPG or WEBP': 'PNG、JPG 或 WEBP',
    'Choose another': '换一张',
    'Retake': '重拍',
    'Switch camera': '切换摄像头',
    'Mirror preview': '镜像预览',
    'Flip horizontally': '水平翻转',
    'Show framing guide': '显示构图参考线',
    'Re-centre': '重新居中',
    'Straighten': '校正倾斜',
    'Zoom': '缩放',
    'Nudge': '微调',
    'Up': '上',
    'Down': '下',
    'Left': '左',
    'Right': '右',
    'Drag the picture to move it · scroll to zoom': '拖动照片可移动 · 滚动可缩放',
    'Start from a photo you already have, or take one now. You can reframe it and change its background in the next step — nothing is saved until you press Apply.':
        '可以用你已有的照片，也可以现在拍一张。下一步能重新构图并更换背景 —— 在你点击“应用”之前不会保存任何内容。',
    'Fill the circle with your head and shoulders, look at the lens, and keep the light in front of you. A plain wall behind you makes the background swap far cleaner.':
        '让头部和肩膀填满圆圈，看向镜头，让光源在你正前方。身后是一面素墙时，背景替换的效果会干净得多。',
    'Background': '背景',
    'Custom colour': '自定义颜色',
    'How much to replace': '替换范围',
    'Edge softness': '边缘柔化',
    'Protect the person': '保护人物区域',
    'Highlight what will be replaced': '高亮将被替换的区域',
    'Keeping the photo exactly as taken. Choose a colour or gradient to replace whatever is behind you.':
        '照片将完全保持拍摄时的样子。选择一种颜色或渐变来替换你身后的部分。',
    'The area inside the protected zone is never touched, so your face stays intact whatever the other sliders say. If part of you is being cut out, raise':
        '保护区内的部分绝不会被处理，因此无论其他滑块怎么调，你的面部都不会受影响。如果你身体的一部分被抠掉了，请提高',
    'or lower': '或降低',
    'The background in this photo is busy rather than a plain wall, so the swap will look patchy. A photo against a single-colour wall gives a much cleaner result — or leave the background as it is.':
        '这张照片的背景比较杂乱，不是素墙，因此替换效果会显得斑驳。在单色墙前拍的照片效果会干净得多 —— 或者干脆保留原背景。',
    'You are editing the version already on your CV. “Reframe the original” goes back to the untouched upload, which keeps the quality.':
        '你正在编辑简历上已经使用的那一版。“重新构图原图”会回到未处理的上传文件，画质更好。',
    'Contact': '联系方式',
    'Nothing to show yet. Fill in the editor and this preview updates as you type.':
        '暂无内容可显示。在编辑器中填写内容，此预览会随输入实时更新。',

    'Transcript': '转写文本',
    'transcribing {v0}…': '正在转写 {v0}……',
    'working…': '处理中……',
    '— editable, fix anything the microphone got wrong': '—— 可编辑，麦克风听错的地方随时改',
    'Speak naturally, as if answering “tell me about your career”. Cover each job title and employer, roughly when you were there, what you actually did and anything you improved with a number. Then your education, skills and languages. You can pause and resume — nothing is sent until you stop.':
        '自然地说，就像在回答“讲讲你的职业经历”。逐段说出职位名称和雇主、大致的起止时间、你实际做了什么，以及任何能用数字说明的改进。然后是教育背景、技能和语言能力。你可以暂停再继续 —— 在你停止之前不会发送任何内容。',
    'Anything else to add': '还有什么要补充的',
    'e.g. targeting a DevOps role in Dubai, available from October':
        '例如：目标是迪拜的 DevOps 岗位，十月起可入职',

    /* ---------------------------------------------------------------- *
     * The last odds and ends
     * ---------------------------------------------------------------- */
    'No pages match “{v0}”': '没有页面符合“{v0}”',
    'Open navigation menu': '打开导航菜单',
    '{n} unread notifications': '{n} 条未读通知',
    'Sign In': '登录',
    'Appearance': '外观',
    'Choose your galaxy': '选择你的星系',
    'Ten palettes. Text colour is worked out from whatever it sits on, so every one stays readable.':
        '十套配色。文字颜色会根据所处背景自动推算，因此每一套都清晰可读。',
    'Show the numbers': '显示数值',
    'Change Photo': '更换照片',
    'Added {v0}': '添加于 {v0}',
    'AI, Machine Learning, Data Science': '人工智能、机器学习、数据科学',
    'gesture recognition, rehabilitation, exergame': '手势识别、康复、体感游戏',
};

export default studio;
