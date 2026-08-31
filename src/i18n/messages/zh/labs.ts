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
    'file name, e.g. Dockerfile': '文件名，例如 Dockerfile',
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

    /* The third task state. A task the lab cannot check is not a failure and
     * must not read as one — it is a lab whose declaration names an environment
     * this deployment does not provide, which is an operator's problem. */
    'This lab cannot check that here. Tell an operator - the task names an environment the lab does not provide.':
        '此实验无法在这里检查该项。请告知运维人员 —— 该任务指向了本实验未提供的环境。',

    /* ---------------------------------------------------------------- *
     * The tutor
     * ---------------------------------------------------------------- */
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
};

export default labs;
