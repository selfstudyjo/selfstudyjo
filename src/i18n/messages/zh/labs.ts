/**
 * The labs (app 11) — Simplified Chinese.
 *
 * ============================================================
 * WHY THIS IS ITS OWN MODULE
 * ============================================================
 *
 * Twelve subjects' worth of vocabulary that nothing else on the platform
 * shares, and the words collide badly with the rest of the catalogue: "Volumes"
 * here is a Docker volume (数据卷) and not a loudness control, "State" is a
 * Terraform state file (状态) and not a country, "Nodes" is a Kubernetes worker
 * (节点) and not a network-simulator device. Alphabetised in among the course
 * and exam strings every one of those is a coin flip, which is the reason
 * `../../index.ts` gives for splitting by area.
 *
 * ============================================================
 * WHAT IS DELIBERATELY *NOT* HERE
 * ============================================================
 *
 * Commands and product names. `docker ps`, `hdfs dfs -ls`, `terraform apply`,
 * `SELECT`, `kubectl` — every one is a literal a real CLI accepts, and a student
 * who types the Chinese word gets a command that does not run. That is WORSE
 * than the label having stayed in English, because the interface has actively
 * misled them. `rtl.css` makes the same call for `<pre>`, and
 * `tools/i18n-check/untranslated.json` allow-lists the acronyms and service
 * names this page prints (`S3`, `EC2`, `ARN`, `VPC`, `CIDR`, `SKU`,
 * `NameNode`, `Pods`…).
 *
 * Where a product name sits inside a phrase the Latin word is kept and the
 * grammar around it is Chinese — `IAM 角色`, `Hive 元存储`, `浏览 HDFS`. A
 * reader has to be able to find that word again in the real console, which is
 * in English.
 *
 * ============================================================
 * "SIMULATED" IS THE MOST IMPORTANT WORD IN THIS FILE
 * ============================================================
 *
 * Seven of the engines are simulations: no Docker daemon, no Kubernetes API
 * server, no AWS account. Every simulated tool says so on its own header and in
 * the prompt the AI tutor is given, and a reader who cannot read the English is
 * exactly the one most likely to spend an afternoon wondering why a flag the
 * real tool has does nothing here. `模拟` / `真实` are short enough to sit in a
 * tag and are never softened.
 */

import type { Catalogue } from '../../index';

const labs: Catalogue = {
    /* ---------------------------------------------------------------- *
     * The catalogue page
     * ---------------------------------------------------------------- */
    'Playgrounds, not exercises. Every lab hands you the real tools for a subject and a list of things to make happen - and it checks the environment, not what you typed.':
        '这是练习场，不是习题册。每个实验都给你该主题的真实工具，以及一份需要做成的清单 —— 而它检查的是环境本身，不是你敲了什么。',
    'Just want a scratchpad?': '只想要一块草稿板？',
    'Search labs, topics and tools': '搜索实验、主题与工具',
    'All tracks': '全部方向',
    'Loading the labs...': '正在加载实验……',
    'No lab matches that.': '没有匹配的实验。',
    'No labs are published yet.': '还没有发布任何实验。',
    'The labs are not reachable right now': '当前无法访问实验室',
    'Labs started': '已开始的实验',
    'Labs completed': '已完成的实验',
    'Tasks done': '已完成任务',
    '{v0} labs': '{v0} 个实验',
    '{v0} tasks': '{v0} 个任务',
    '{v0} completed': '已完成 {v0} 个',

    /* The labs' own subscription wording rather than the tools' — they are gated
     * on the same feature but reached from different places, and a reader who
     * clicked a lab must not be told about a terminal. */
    'Your plan does not include the labs. Add the lab feature to your subscription to open every track.':
        '你的套餐不包含实验室。在订阅中添加实验室功能，即可打开全部方向。',

    /* ---------------------------------------------------------------- *
     * The workspace
     * ---------------------------------------------------------------- */
    'Opening the lab...': '正在打开实验……',
    'This lab could not be opened': '无法打开此实验',
    'Back to the labs': '返回实验列表',
    /* On a course page and on a lesson page, beside the runbook and the
     * reading material. A verb, because it is the one thing in that row that
     * is doing rather than reading. */
    'Practise in the lab': '进入实验练习',
    /* The leaderboard's printed scoring table. The qualifier is the whole
     * point: a lab task point is not self-reported, it is a task the service
     * inspected the environment for. */
    'Lab task point · checked against the environment': '实验任务分 · 由环境核验',
    'Lab finished · every task': '实验完成 · 全部任务',
    'Brief': '实验说明',
    'By the end of this lab': '完成本实验后你将能够',
    'Datasets in this lab': '本实验中的数据集',
    'Built for you on this replica. Real rows, real answers.':
        '在这个副本上为你生成。真实的数据行，真实的结果。',
    'Reset environment': '重置环境',
    'This lab has no brief yet.': '此实验还没有说明。',

    /* A tool this bundle does not know about. The lab service deploys on its own
     * schedule, so this is an ordinary state rather than an error — and naming
     * WHICH tool turns "the lab looks wrong" into a deploy note. */
    'This lab asks for a tool this version does not have: {v0}. It has been left out.':
        '此实验需要一个当前版本没有的工具：{v0}。已将其省略。',

    /* ---------------------------------------------------------------- *
     * The panes
     * ---------------------------------------------------------------- */
    'Console': '控制台',
    'Files': '文件',
    'Result': '结果',
    'Run': '运行',
    'Truncated': '已截断',
    'Nothing yet.': '暂无内容。',
    'No files yet': '还没有文件',
    'Path': '路径',
    'Permissions': '权限',

    /* The explorer. `Top level` is the root of the LAB's filesystem, not the
     * machine's. */
    'Explorer': '资源管理器',
    'New File': '新建文件',
    'New Folder': '新建文件夹',
    'Collapse All': '全部折叠',
    'Filter files': '筛选文件',
    'Nothing matches that': '没有匹配项',
    'Top level': '顶层目录',
    'file name': '文件名',
    'folder name': '文件夹名',
    'File contents': '文件内容',
    'Pick a file on the left, or make one with New File.':
        '在左侧选择一个文件，或点击「新建文件」创建一个。',
    'Cut': '剪切',
    'Paste here': '粘贴到此处',
    'Write a program and press Run, or Ctrl+Enter': '写一段程序后点击运行，或按 Ctrl+Enter',
    'Write a statement and press Run, or Ctrl+Enter': '写一条语句后点击运行，或按 Ctrl+Enter',
    'The statement ran and returned no rows.': '语句已执行，未返回任何行。',
    '{v0} row(s)': '{v0} 行',
    'These files are what every tool in this lab sees. Write a Dockerfile, a manifest or a .tf file here and run it in the console.':
        '本实验中的每个工具看到的都是这些文件。在这里写 Dockerfile、清单或 .tf 文件，然后在控制台里运行。',

    /* The web playground. The second sentence is a promise about WHERE the code
     * runs, and it is the one thing a reader needs before pasting anything in. */
    'Web Playground': 'Web 练习场',
    'Your own browser renders this in a sandboxed frame. Nothing runs on the server.':
        '这是你自己的浏览器在沙箱框架中渲染的。服务器上不会运行任何代码。',
    'console.log output appears here.': 'console.log 的输出会显示在这里。',
    'Big preview': '大预览',
    'Side by side': '左右并排',
    'Press Run to update': '按“运行”以更新',
    'Saved. Check my work will see this.': '已保存。“检查我的作业”会看到这些内容。',
    'Your work is rendered here but could NOT be saved. The lab service did not answer.':
        '你的作业已在此渲染，但未能保存。实验服务没有响应。',

    /* ---------------------------------------------------------------- *
     * The task list
     * ---------------------------------------------------------------- */
    'This lab has no tasks yet.': '此实验还没有任务。',
    'Checking...': '正在检查……',
    'I have done this': '我已完成这一项',
    'Hint': '提示',
    'Hide hint': '隐藏提示',
    'Show what each task checks': '显示每项任务的检查方式',
    'Checked by': '检查方式',
    '{v0} of {v1} done': '已完成 {v0} / {v1}',
    '{v0} of {v1} points': '{v0} / {v1} 分',

    /* What `Check my work` just did. It said nothing at all before, in three of
     * its four outcomes - and a fallback that renders in English on a Chinese
     * page is a button that is still not answering the reader. */
    'The lab service did not answer. Nothing has been lost — try again in a moment.':
        '实验服务没有响应。没有内容丢失 —— 请稍后重试。',
    'Every task is done. {v0} of {v1} points.':
        '所有任务都已完成。{v0} / {v1} 分。',
    '{v0} more done — {v1} of {v2} now.':
        '又完成了 {v0} 项 —— 现在是 {v1} / {v2}。',
    'This lab cannot be checked on this replica. Tell an operator.':
        '本副本无法检查此实验。请告知运维人员。',
    'Every task here is marked by you. Tick "I have done this" as you finish each one.':
        '这里的每项任务都由你自己标记。完成一项就点一次“我已完成这一项”。',
    'Some work is no longer in your environment — {v0} of {v1} now.':
        '你的环境中已经没有部分成果了 —— 现在是 {v0} / {v1}。',
    'Nothing new yet — still {v0} of {v1}. Open a task for its hint.':
        '暂时没有新进展 —— 仍是 {v0} / {v1}。展开任务查看提示。',
    'You mark these tasks yourself — this lab cannot inspect them for you.':
        '这些任务由你自己标记 —— 本实验无法替你检查。',

    /* The third task state. A task the lab cannot check is not a failure and
     * must not read as one — it is a lab whose declaration names an environment
     * this deployment does not provide, which is an operator's problem. */
    'This lab cannot check that here. Tell an operator - the task names an environment the lab does not provide.':
        '此实验无法在这里检查该项。请告知运维人员 —— 该任务指向了本实验未提供的环境。',

    /* ---------------------------------------------------------------- *
     * The tutor
     * ---------------------------------------------------------------- */
    /* The Network Simulator, rendered as one pane of a lab rather than linked
     * away to. `Open full screen` is the way out for somebody who wants the
     * whole canvas; the pane is what keeps the brief and the tasks in view. */
    'Open full screen': '全屏打开',
    'Loading the Network Simulator...': '正在加载网络模拟器……',
    'The Network Simulator could not be loaded. Reload the page, or open it full screen.':
        '网络模拟器无法加载。请重新加载页面，或全屏打开它。',

    'AI Tutor': 'AI 导师',
    'Ask': '提问',
    'Ask the tutor': '向导师提问',
    'Ask a question about this lab': '就本实验提一个问题',
    'Ask about this lab. Try: why does the container name not resolve?':
        '就本实验提问。试试：为什么容器名解析不了？',
    'Review my work': '点评我的操作',
    'Thinking...': '正在思考……',
    'It can see your environment and what you have run. Answers come from a language model and can be wrong.':
        '它能看到你的环境以及你执行过的命令。答案来自语言模型，可能出错。',

    /* ---------------------------------------------------------------- *
     * Honesty about what is behind each tool
     * ---------------------------------------------------------------- */
    'Simulated': '模拟',
    'Real': '真实',
    'Reads the live environment': '读取实时环境',
    'This lab has no dashboard for that tool.': '本实验没有该工具的面板。',

    /* ---------------------------------------------------------------- *
     * The top bar and the scratchpad tools
     * ---------------------------------------------------------------- */
    'Practice tools': '练习工具',
    'A terminal, a SQL editor and a Python compiler': '一个终端、一个 SQL 编辑器和一个 Python 编译器',
    'Playgrounds for Linux, Python, web, SQL, Docker, Kubernetes, Big Data, cloud and Terraform':
        'Linux、Python、Web、SQL、Docker、Kubernetes、大数据、云与 Terraform 练习场',
    'Full page': '整页打开',
    'Resize': '调整大小',
    'Sign in to use the practice tools.': '登录后即可使用练习工具。',
    'Your plan does not include the practice tools.': '你的套餐不包含练习工具。',
    'Starting your workspace...': '正在启动你的工作区……',
    'These tools are not reachable right now': '当前无法访问这些工具',

    /* ---------------------------------------------------------------- *
     * Difficulty, lab status and task status
     *
     * Reached as `$t(DIFFICULTY_LABELS[lab.difficulty])` from a variable, so no
     * source file holds the literal and `check:i18n`'s orphan scan cannot see
     * them. They are verified positively against the exported table instead —
     * the same arrangement the sidebar's labels and the dashboard's badges have.
     * ---------------------------------------------------------------- */
    'Beginner': '入门',
    'Intermediate': '进阶',
    'Advanced': '高级',
    'Not started': '未开始',
    'In progress': '进行中',
    'To do': '待完成',
    'Cannot be checked': '无法检查',

    /* ---------------------------------------------------------------- *
     * The tool families, as they appear on a pane tab
     * ---------------------------------------------------------------- */
    'Terminal & Files': '终端与文件',
    'Web': 'Web',
    'Big Data': '大数据',

    /* ---------------------------------------------------------------- *
     * The GUI dashboards: panel titles
     * ---------------------------------------------------------------- */
    'Engine': '引擎',
    'Containers': '容器',
    'Images': '镜像',
    'Volumes': '数据卷',
    'Networks': '网络',
    'Cluster': '集群',
    'Nodes': '节点',
    'Deployments': '部署',
    'Services': '服务',
    'Events': '事件',
    'Browse HDFS': '浏览 HDFS',
    'Applications': '应用',
    'Jobs': '作业',
    'Hive metastore': 'Hive 元存储',
    'Alerts': '告警',
    'VPCs & subnets': 'VPC 与子网',
    'Security groups': '安全组',
    'IAM roles': 'IAM 角色',
    'Subscription': '订阅',
    'Resource groups': '资源组',
    'Resources': '资源',
    'Storage': '存储',
    'Blobs': 'Blob 对象',
    'State': '状态',
    'Managed resources': '受管资源',
    'Last plan': '最近一次 plan',
    'Dependencies': '依赖关系',
    'Outputs': '输出',
    'Branches': '分支',
    'History': '提交历史',

    /* ---------------------------------------------------------------- *
     * The GUI dashboards: column headers
     * ---------------------------------------------------------------- */
    'Image': '镜像',
    'Ports': '端口',
    'Uptime': '运行时长',
    'Tag': '标签',
    'Layers': '层数',
    'Driver': '驱动',
    'Used by': '被使用于',
    'Subnet': '子网',
    'Subnets': '子网',
    'Version': '版本',
    'Namespace': '命名空间',
    'Ready': '就绪',
    'Wanted': '期望',
    'Revision': '版本号',
    'Node': '节点',
    'Reason': '原因',
    'Keys': '键',
    'Capacity': '容量',
    'Used': '已用',
    'Blocks': '块数',
    'Replication': '副本数',
    'Application': '应用',
    'Database': '数据库',
    'Table': '表',
    'Rows': '行数',
    'External': '外部表',
    'Service': '服务',
    'Health': '健康状况',
    'Metric': '指标',
    'Components': '组件',
    'Bucket': '存储桶',
    'Region': '区域',
    'Objects': '对象数',
    'Versioning': '版本控制',
    'Instance': '实例',
    'Zone': '可用区',
    'Default': '默认',
    'Policies': '策略',
    'Runtime': '运行时',
    'Handler': '处理函数',
    'Invocations': '调用次数',
    'Items': '条目数',
    'Billing': '计费方式',
    'Id': '标识',
    'Detail': '详情',
    'Endpoint': '接入点',
    'Container': '容器',
    'Blob': 'Blob',
    'Tier': '存储层',
    'Provider': '提供程序',
    'Resource': '资源',
    'Depends on': '依赖于',
    'Branch': '分支',
    'Commit': '提交',
    'Message': '提交信息',

    /* A Spark stage line reads "3 tasks, shuffle 150.0KB". Two words, and both
     * of them are the sentence. */
    'tasks': '个任务',
    'shuffle': 'Shuffle 写入',

    /* THE TERMINAL SHORTCUT CARD.
     *
     * Every key name is left in English on purpose and is not in the
     * catalogue at all: `Tab`, `Ctrl+R` and `nano` are what is printed on a
     * keyboard and what a student types, so a translated key name would be
     * an instruction to press something that does not exist. The
     * DESCRIPTIONS beside them are prose and are translated. Same line
     * `untranslated.json` draws through the Cisco keywords and the shell
     * commands. */
    'Keyboard shortcuts': '键盘快捷键',
    'Keys': '快捷键',
    'complete a command or a filename': '补全命令或文件名',
    'search what you have run': '搜索已执行过的命令',
    'clear the screen': '清屏',
    'start / end of the line': '行首 / 行尾',
    'cut to the start / to the end': '剪切到行首 / 到行尾',
    'cut the last word / paste it back': '剪切上一个词 / 粘贴回来',
    'abandon the line': '放弃当前这一行',
    'walk through history': '浏览历史命令',
    'run the previous command again': '再次执行上一条命令',
    'open a file in an editor': '在编辑器中打开文件',
    'Type help to see every command, or press Tab to complete one.':
        '输入 help 查看全部命令，或按 Tab 补全命令。',
    'Modified': '已修改',

    // ------------------------------------------------------------------
    // Ansible - app 11's thirteenth track.
    //
    // `ok`, `changed` and `failed` are deliberately NOT here: they are the
    // words `ansible-playbook`'s own PLAY RECAP prints, and a student maps the
    // dashboard column to the recap line.
    // ------------------------------------------------------------------
    'Ansible': 'Ansible',
    'Control node': '控制节点',
    'Managed nodes': '受管节点',
    'Inventory groups': '清单分组',
    'Playbook runs': 'Playbook 运行记录',
    'Packages': '软件包',
    'Package': '软件包',
    'Roles': '角色',
    'Distribution': '发行版',
    'Groups': '分组',
    'Hosts': '主机',
    'Running': '运行中',
    'Variables': '变量',
    'Unit': '服务单元',
    'At boot': '开机启动',
    'Playbook': 'Playbook',
    'When': '时间',
    /* 幂等 is the exact standard term, and it is the one question this track
       turns on: would running it again change anything. */
    'Idempotent': '幂等',

    // ------------------------------------------------------------------
    // Jenkins - the fourteenth.
    // ------------------------------------------------------------------
    'Jenkins': 'Jenkins',
    'Controller': '控制器',
    'Stage view': '阶段视图',
    'Build history': '构建历史',
    'Plugins': '插件',
    'Plugin': '插件',
    'Job': '任务',
    'Pipeline from': 'Pipeline 来源',
    'Builds': '构建',
    'Last result': '最近结果',
    'Stage': '阶段',
    'Steps': '步骤',
    'Note': '备注',
    'Took': '耗时',
    'Artifacts': '构建产物',
    'Executors': '执行器',
    'Labels': '标签',
    'ID': 'ID',
    'Kind': '类型',

    // The backend Browser pane and the mobile Phone pane.
    'Preview': '预览',
    'App preview': '应用预览',
    'Reload': '重新加载',
    'The development server is not running yet.': '开发服务器尚未启动。',
    'in the console to build the app.': '在控制台中构建应用。',
    '{v0} SQL queries ran for this page': '本页面执行了 {v0} 条 SQL 查询',
    '{v0} network calls': '{v0} 次网络请求',
    // The Puppet and Chef lab dashboards. Reached as
    // `$t(panel.title)` and `$t(column.label)`, so no source
    // file holds the literal - see the note in
    // `labCatalogue.ts` about why they live there.
    'Puppet': 'Puppet',
    'Chef': 'Chef',
    'Control': '控制端',
    'Runs': '运行记录',
    'Compiled catalog': '已编译目录',
    'Relationships': '依赖关系',
    'Declared classes': '已声明的类',
    'Managed files': '受管文件',
    'Compile phase': '编译阶段',
    'Resource collection': '资源集合',
    'Run list': '运行列表',
    'Attributes': '属性',
    'Manifest': '清单',
    'Declared in': '声明于',
    'Before': '之前',
    'After': '之后',
    'Certname': '证书名称',
    'Family': '系列',
    'Certificate': '证书',
    'This node': '本节点',
    'Class': '类',
    'Refreshed': '已刷新',
    'updated': '已更新',
    'Guarded': '有守卫',
    'Notifies': '会通知',
    'Updated': '已更新',
    'Order': '顺序',
    'Entry': '条目',
    'Attribute': '属性',
    'Precedence': '优先级',
    'Set to': '设定为',
    'Effective value': '生效值',
    'Restarted': '已重启',
    'Restarts': '重启次数',
    'Bytes': '字节',

    // The Claude tracks: the API dashboard, the Claude Code
    // session view and the Cowork one.
    'Claude Cowork': 'Claude Cowork',
    'Requests': '请求',
    'Last request': '最近一次请求',
    'Tool definitions': '工具定义',
    'Tool calls': '工具调用',
    'Retrieval index': '检索索引',
    'Searches': '检索记录',
    'Evaluations': '评测',
    'MCP servers': 'MCP 服务器',
    'Session': '会话',
    'Permission rules': '权限规则',
    'Hooks': '钩子',
    'Subagents': '子代理',
    'Cowork': 'Cowork',
    'Standing context': '常驻上下文',
    'Model': '模型',
    'Temp': '温度',
    'In': '输入',
    'Out': '输出',
    'Cache w': '缓存写入',
    'Cache r': '缓存读取',
    'Stopped': '停止原因',
    'Cost': '成本',
    'Tokens': '词元',
    'Text': '文本',
    'Required': '必填',
    'Properties': '属性',
    'Tool': '工具',
    'Input': '输入参数',
    'Chunk': '分块',
    'Document': '文档',
    'First words': '开头文字',
    'Query': '查询',
    'Reranked': '已重排序',
    'Top hit': '最佳命中',
    'Documents': '文档',
    'Grader': '评分方式',
    'Cases': '用例',
    'Passed': '通过',
    'Failed': '失败',
    'Rate %': '通过率 %',
    'Mean': '平均分',
    'Server': '服务器',
    'Transport': '传输方式',
    'Prompts': '提示',
    'Scope': '范围',
    'File': '文件',
    'Lines': '行数',
    'Imports': '导入',
    'Effect': '效果',
    'Rule': '规则',
    'Event': '事件',
    'Matcher': '匹配器',
    'Command': '命令',
    'Fired': '触发次数',
    'Blocked': '已拦截',
    'Loaded': '已加载',
    'Prompt': '提示词',
    'Calls': '调用次数',
    'Refused': '被拒绝',
    'Skill': '技能',
    'Subagent': '子代理',
    'Target': '目标',
    'Decision': '判定',
    'Why': '原因',
    'Task': '任务',
    // The Model Context Protocol panels. Two terms are deliberately not
    // translated word for word: `Roots` is a protocol term whose ordinary
    // translation reads as a plant root, so it keeps the English in brackets
    // the way the netsim catalogue does for a protocol keyword; and
    // `Mcp-Session-Id` is an HTTP HEADER NAME a machine parses, so translating
    // it would be untranslated.json's rule arriving in a table column - a
    // student copying the translated form gets a request that 400s.
    'Model Context Protocol': '模型上下文协议（MCP）',
    'Capabilities': '已声明的能力',
    'Client': '客户端',
    'Sampling': '采样',
    'Roots': '根目录（Roots）',
    'HTTP sessions': 'HTTP 会话',
    'Direction': '方向',
    'Params': '参数',
    'Input schema': '输入模式',
    'Documented': '已文档化',
    'Samples': '会采样',
    'URI': '统一资源标识符（URI）',
    'MIME': 'MIME 类型',
    'Arguments': '参数',
    'Capability': '能力',
    'Declared': '已声明',
    'Wire method': '线上方法',
    'Implemented': '已实现',
    'Ok': '成功',
    'Sampled': '已采样',
    'From tool': '来自工具',
    'Allowed': '已允许',
    'Mcp-Session-Id': 'Mcp-Session-Id',
    'Stateful': '有状态',
    'Issued': '签发于',
    'Agent': '子代理',
    'Logs': '会记录日志',
    'Side': '一方',

    // ------------------------------------------------------------------
    // THE FOUR JOB TRACKS, added 2026-09-13 - the AI Engineer and the
    // Azure Cloud Infrastructure Architect (Senior Manager) curricula.
    //
    // Every one of these is reached as `$t(panel.title)` or
    // `$t(column.label)`, so no template holds the literal and the
    // codemod could never have found them; `check:i18n` is what does.
    //
    // What is NOT here is on `tools/i18n-check/untranslated.json`:
    // `precision@k`, `NDCG@k`, `PSI`, `F1`, `TP`/`FP`/`TN`/`FN`, `p95 ms`,
    // `KQL`, `NSG`, `FQDN`, `RACI`, `Tokens/s` and the bare `k` / `p` / `N`.
    // A metric name is read the same way in every language by the people
    // who read it at all, and an Arabic rendering of `recall@k` is a term
    // a reader would have to translate back before they could use it.
    // ------------------------------------------------------------------
    // The Azure platform dashboards - the networking stack, identity,
    // governance, observability and cost.
    'Platform': '平台',
    'Virtual networks': '虚拟网络',
    'Address space': '地址空间',
    'Resource group': '资源组',
    'Peered to': '对等到',
    'Prefix': '前缀',
    'Route table': '路由表',
    'Delegated to': '委派给',
    'Service endpoints': '服务终结点',
    'NSG rules': 'NSG 规则',
    'Priority': '优先级',
    'Access': '访问',
    'Protocol': '协议',
    'Routes': '路由',
    'Route': '路由',
    'Next hop IP': '下一跳 IP',
    'Attached to': '已附加到',
    'Peerings': '对等连接',
    'Forwarded traffic': '转发流量',
    'Gateway transit': '网关传递',
    'Use remote gateways': '使用远端网关',
    'Private endpoints': '专用终结点',
    'Group id': '组 ID',
    'Zone linked': '区域已链接',
    'Connection': '连接',
    'Resolves': '解析结果',
    'Private DNS zones': '专用 DNS 区域',
    'Linked networks': '已链接网络',
    'Records': '记录',
    'Firewalls': '防火墙',
    'Network rules': '网络规则',
    'Application rules': '应用规则',
    'Threat intel': '威胁情报',
    'Firewall rules': '防火墙规则',
    'Firewall': '防火墙',
    'Collection': '集合',
    'Path tests': '路径测试',
    'Hops': '跳数',
    'Management groups': '管理组',
    'Display name': '显示名称',
    'Parent': '父级',
    'Subscriptions': '订阅',
    'Policy assignments': '策略分配',
    'Assignment': '分配',
    'What it checks': '检查内容',
    'Identity': '标识',
    'Evaluated': '已评估',
    'Non-compliant': '不合规',
    'Rate': '比率',
    'Compliance': '合规性',
    'Role assignments': '角色分配',
    'Principal': '主体',
    'Breadth': '广度',
    'What it grants': '授予的权限',
    'Principals': '主体',
    'Object id': '对象 ID',
    'Workspaces': '工作区',
    'Retention days': '保留天数',
    'Tables with data': '有数据的表',
    'Diagnostic settings': '诊断设置',
    'Workspace': '工作区',
    'Created by': '创建者',
    'Alert rules': '告警规则',
    'Condition': '条件',
    'Window': '上下文窗口',
    'Frequency': '频率',
    'Severity': '严重级别',
    'Action group': '操作组',
    'Queries you have run': '已执行的查询',
    'Monthly cost': '月度成本',
    'Per month': '每月',
    'Owner tag': '归属标签',
    'Tagged': '已标记',
    'Budgets': '预算',
    'Run rate': '当前消耗率',
    'Alert at': '告警阈值',
    'Created': '创建时间',
    'Last what-if': '最近一次 what-if',
    'Change': '变更',
    'What changes': '变更内容',

    // The AI-engineering dashboards: data, training, evaluation, serving,
    // drift and the A/B ledger.
    'Datasets': '数据集',
    'Dataset': '数据集',
    'Natural grouping': '自然分组',
    'Positive': '正类比例',
    'Split': '数据划分',
    'Train': '训练集',
    'Val': '验证集',
    'Features': '特征',
    'Leakage': '数据泄漏',
    'Pipeline': '流水线',
    'Experiment': '实验',
    'Base model': '基础模型',
    'Epochs': '轮次',
    'Best epoch': '最佳轮次',
    'Val loss': '验证损失',
    'Val metric': '验证指标',
    'VRAM GiB': '显存 GiB',
    'Leak factor': '泄漏系数',
    'Learning curves': '学习曲线',
    'Epoch': '轮次',
    'Train loss': '训练损失',
    'Model registry': '模型注册表',
    'Base': '基线',
    'Size MB': '大小 MB',
    'Suite': '测试套件',
    'Threshold': '阈值',
    'Accuracy': '准确率',
    'Precision': '精确率',
    'Recall': '召回率',
    'Balanced': '平衡',
    'Per slice': '按切片',
    'Slice': '切片',
    'Knowledge tracing': '知识追踪',
    'Trace': '追踪',
    'Answer': '答案',
    'Prior': '先验概率',
    'Posterior': '后验概率',
    'Mastery': '掌握度',
    'Recommenders': '推荐算法',
    'Coverage': '覆盖率',
    'Cold start': '冷启动',
    'Serving': '推理服务',
    'Batch': '批大小',
    'Max length': '最大长度',
    'Weights GiB': '权重 GiB',
    'KV cache GiB': 'KV 缓存 GiB',
    'Total GiB': '总计 GiB',
    'Drift': '漂移',
    'Verdict': '结论',
    'At training': '训练时',
    'Now': '当前',
    'A/B tests': 'A/B 测试',
    'Days': '天数',
    'Variant': '实验组',
    'Control rate': '对照组转化率',
    'Variant rate': '实验组转化率',
    'Lift': '相对提升',
    'Declared MDE': '声明的最小可检测效应',
    'Needed per arm': '每组所需样本',
    'Reported so far': '已报告的结论',
    'Exports': '导出',
    'Model catalogue': '模型目录',
    'Parameters': '参数量',
    'Architecture': '架构',
    'Hidden': '隐藏层',
    'Context': '上下文',
    'Downloaded': '已下载',

    // The agent lab - tool calls, planning, memory and the trajectory
    // checks.
    'Planner': '规划器',
    'Stopped by': '终止原因',
    'Goal reached': '目标达成',
    'Seconds': '秒',
    'Peak window': '峰值窗口',
    'Repeats': '重复调用',
    'Refusals': '拒绝次数',
    'Compactions': '压缩次数',
    'Overflows': '溢出次数',
    'Constraint held': '约束是否保持',
    'Observation': '观测结果',
    'Trajectory checks': '轨迹检查',
    'Check': '检查项',
    'Destructive': '破坏性',
    'Observation tokens': '观测 token 数',
    'Latency ms': '延迟 ms',
    'Given': '已给出',
    'Policy': '策略',
    'What it does': '作用',
    'Guardrails': '防护栏',
    'Entries': '条目',
    'Survives the run': '跨运行保留',
    'Approvals': '审批',
    'Planners': '规划器',
    'What it is': '说明',
    'Token overhead': 'token 开销',
    'Adapts': '是否自适应',
    'Reflects': '是否反思',
    'Trade': '取舍',

    // The management dashboards: the team, the board, OKRs, stakeholders,
    // incidents and the budget.
    'This sprint': '本冲刺',
    'Scorecard': '评分卡',
    'Availability': '可用工时',
    'Morale': '士气',
    'Growth': '成长',
    'Burnout': '倦怠度',
    'Flight risk': '离职风险',
    'Overdue': '逾期',
    'Evidence': '证据',
    'One-to-ones': '一对一',
    'With': '与',
    'Cadence': '周期',
    'Last held (sprint)': '最近一次（冲刺）',
    'Sprints overdue': '逾期冲刺数',
    'Held': '已举行',
    'With an action': '含行动项',
    'Performance': '绩效',
    'Impact / trajectory': '影响 / 趋势',
    'Specific feedback': '具体反馈',
    'Defensible': '有据可依',
    'Sprints at level': '在当前级别的冲刺数',
    'Promotion': '晋升',
    'Board': '看板',
    'Assignee': '负责人',
    'Real cost': '实际成本',
    'Carried': '结转',
    'Key result': '关键结果',
    'Sprint': '冲刺',
    'Sprints': '冲刺',
    'Committed': '已承诺',
    'Delivered': '已交付',
    'Say / do': '承诺 / 达成',
    'OKRs': '目标与关键结果',
    'Objective': '目标',
    'Baseline': '基准值',
    'Confidence': '信心度',
    'Check-ins': '检查次数',
    'Item': '条目',
    'Responsible': '执行人',
    'Accountable': '最终负责人',
    'Consulted': '被咨询',
    'Informed': '被通知',
    'RAID register': 'RAID 登记表',
    'Impact': '影响',
    'Likelihood': '可能性',
    'Due': '到期',
    'Mitigation': '缓解措施',
    'Sprints open': '开放的冲刺数',
    'Controlled': '已受控',
    'Incidents': '事件',
    'MTTA min': '平均确认时间（分钟）',
    'MTTR min': '平均修复时间（分钟）',
    'Postmortem': '事后复盘',
    'Blameless': '无指责',
    'Came from': '来源',
    'Decision log': '决策记录',
    'Alternatives': '备选方案',
    'Chosen': '已选',
    'Door': '门类型',
    'Stakeholders': '相关方',
    'Power': '影响力',
    'Interest': '关注度',
    'Sprints since contact': '自上次联系的冲刺数',
    'Briefings': '简报次数',
    'What they want': '他们关心什么',
    'Hiring funnel': '招聘漏斗',
    'Sprints in stage': '在当前阶段的冲刺数',
    'Scorecards': '评分卡',
    'With evidence': '有证据',
    'Signals': '信号',
    'Budget': '预算',
    'Line': '费用项',
    'What the simulation noticed': '模拟发现的问题',
    'Retros': '回顾会议',
    'Keep': '保留',

    // The three TRACK names, which are not panel titles at all: they are
    // each track module's own `TRACK.title`, rendered as `$t(track.title)`
    // on the catalogue card and in the workspace header.
    'AI Engineering': 'AI 工程',
    'Agent Lab': '智能体实验室',
    'Management': '管理',
};

export default labs;
