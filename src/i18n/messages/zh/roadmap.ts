/**
 * The Roadmap Provider: a learning path to a job role, drawn as a map.
 *
 * Its own area because "stage", "step", "map" and "tour" here are a JOURNEY
 * (阶段、步骤、路线图、导览) - not an exam stage, a lab task or the guided tour
 * of the interface. Role titles, stage names and step titles are English record
 * data and are rendered as-is; only the chrome is translated.
 */

import type { Catalogue } from '../../index';

const roadmap: Catalogue = {
    /* Navigation. */
    'Roadmap Provider': '学习路线图',
    'My Roadmaps': '我的路线图',
    'Your learning path to a role, free with an account': '通往职位的学习路径，注册即可免费使用',

    /* The page. */
    'Pick a field, a specialization or a job role, and get a step-by-step roadmap built from the courses, lessons, labs and runbooks on this site - drawn as a map you can walk in 2D or 3D.':
        '选择一个领域、专业方向或职位，获得一份由本站课程、课时、实验和操作手册组成的分步路线图——以可在 2D 或 3D 中漫游的地图呈现。',
    'New roadmap': '新建路线图',
    'Sign in or register to build your roadmaps': '登录或注册以创建你的路线图',
    'Roadmaps are free with an account. Your maps and your progress on them are saved, so you can come back to them any time.':
        '注册账户即可免费使用路线图。你的路线图和学习进度都会保存，随时可以回来继续。',
    'Register': '注册',

    /* My roadmaps. */
    'My roadmaps': '我的路线图',
    'Loading your roadmaps…': '正在加载你的路线图…',
    'You have not made a roadmap yet. Choose one from the catalogue to start.': '你还没有路线图。从目录中选择一个开始吧。',
    'Roadmap name': '路线图名称',
    '{v0} of {v1} steps done': '已完成 {v0} / {v1} 步',
    'Delete this roadmap and your progress on it?': '删除此路线图及其中的进度？',
    'Roadmap deleted.': '路线图已删除。',

    /* Creating. */
    'The AI is writing your roadmap…': 'AI 正在编写你的路线图…',
    'Building your roadmap…': '正在生成你的路线图…',
    '{v0} s - this can take up to half a minute.': '{v0} 秒——最多可能需要半分钟。',
    'Reading the role': '分析职位要求',
    'Matching courses, lessons and labs': '匹配课程、课时和实验',
    'Arranging the stages': '安排各个阶段',
    'Drawing your map': '绘制你的地图',
    'Your roadmap is ready.': '你的路线图已就绪。',

    /* Opening one. */
    'Opening the roadmap…': '正在打开路线图…',
    'This roadmap could not be opened': '无法打开此路线图',
    'It may have been deleted, or it belongs to another account.': '它可能已被删除，或属于其他账户。',
    'Back to my roadmaps': '返回我的路线图',

    /* The preview bar. */
    'This is the template. Make it yours to track your progress.': '这是模板。将它保存为你自己的路线图以跟踪进度。',
    'Hours a week': '每周小时数',
    'Personalise with AI': '用 AI 个性化',
    'Create my roadmap': '创建我的路线图',
    'Back to the catalogue': '返回目录',

    /* The roadmap. */
    'about {v0} weeks': '约 {v0} 周',
    '{v0} hours a week': '每周 {v0} 小时',
    '{v0} stages': '{v0} 个阶段',
    'Written with AI': '由 AI 编写',
    '{v0}% done': '已完成 {v0}%',
    '{v0} in progress': '{v0} 个进行中',
    'Next up:': '下一步：',
    'Show me': '查看',
    'Map view': '地图视图',
    'Play tour': '播放导览',
    'Legend': '图例',
    '3D needs WebGL, which this browser does not offer, so the map is shown in 2D.':
        '3D 视图需要 WebGL，而此浏览器不支持，因此地图以 2D 显示。',
    'The 3D map could not start on this device, so it is shown in 2D.': '3D 地图无法在此设备上启动，因此以 2D 显示。',
    'Roadmap map': '路线图地图',
    'Stage {v0}': '第 {v0} 阶段',
    '{v0} wk': '{v0} 周',
    'optional': '可选',

    /* 3D. */
    '3D roadmap map': '3D 路线图地图',
    'Building the 3D map…': '正在构建 3D 地图…',
    'Previous stage': '上一阶段',
    'Whole map': '整张地图',
    'Next stage': '下一阶段',
    'Drag to turn · scroll or pinch to zoom · right-drag to move': '拖动旋转 · 滚动或双指缩放 · 右键拖动平移',

    /* One step. */
    'Do these first': '请先完成这些',
    'This topic has no page on the site yet - the role sources show where to learn it.':
        '本站暂时没有此主题的页面——职位来源中列出了可以学习它的地方。',
    'Your progress on this step': '你在此步骤上的进度',
    'Doing': '进行中',
    'Open the course': '打开课程',
    'Open the lesson': '打开课时',
    'Open the runbook': '打开操作手册',

    /* The role. */
    'What this role needs': '此职位的要求',
    'Responsibilities': '职责',

    /* The builder. */
    'From the catalogue': '从目录选择',
    'Describe your own role': '描述你自己的职位',
    'Search roles and fields…': '搜索职位和领域…',
    'Loading the catalogue…': '正在加载目录…',
    'Nothing in the catalogue matches. Try "Describe your own role" instead.': '目录中没有匹配项。请改用“描述你自己的职位”。',
    '{v0} courses': '{v0} 门课程',
    '{v0} runbooks': '{v0} 份操作手册',
    'Preview the roadmap': '预览路线图',
    'Job role, field or specialization': '职位、领域或专业方向',
    'e.g. Cloud Security Engineer': '例如：云安全工程师',
    'Your goal (optional)': '你的目标（可选）',
    'e.g. Move from IT support into cloud security within a year': '例如：一年内从 IT 支持转向云安全',
    "The AI researches the role and arranges the site's courses, labs and runbooks around it. Without it, the closest catalogue roadmap is used.":
        'AI 会研究该职位，并围绕它编排本站的课程、实验和操作手册。不使用 AI 时，将采用目录中最接近的路线图。',
    'Build my roadmap': '生成我的路线图',

    /* The service. */
    'The Roadmap Provider is not available yet': '学习路线图功能尚未开放',
    'It is being switched on. Please check back soon.': '正在启用中，请稍后再来查看。',
    'The roadmap service is not set up yet': '路线图服务尚未配置',
    'The server is missing its configuration. Please try again later.': '服务器缺少配置，请稍后再试。',
    'The roadmap service could not be reached': '无法连接路线图服务',
    'Check your connection and try again. The first visit of the day can take up to 20 seconds.':
        '请检查网络连接后重试。每天的首次访问可能需要最多 20 秒。',
    'Something went wrong. Please try again.': '出了点问题，请重试。',
};

export default roadmap;
