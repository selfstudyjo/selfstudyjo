/**
 * The playgrounds: one free-practice workspace per tool (the top bar's
 * Playgrounds menu, /playgrounds and /playground/:id).
 *
 * Its own area because "playground" here is a SANDBOX for a product (练习场),
 * not a lab, and the group headings are menu sections. Product and tool names
 * are never translated - they come from app 11 as data. The bare "Playground"
 * key lives in `labs.ts` and must not be declared again here.
 */

import type { Catalogue } from '../../index';

const playground: Catalogue = {
    /* The top bar button and its menu. */
    'Playgrounds': '练习场',
    'Open a playground for any tool': '为任意工具打开练习场',
    'Search tools…': '搜索工具…',
    'All playgrounds': '全部练习场',
    'Your own workspace for every tool. Practise freely - nothing is graded or recorded.':
        '每个工具都有你自己的工作区。自由练习——不评分，也不记录。',
    'Sign in to use the playgrounds.': '登录后即可使用练习场。',
    'Your plan does not include the playgrounds.': '你的套餐不包含练习场。',
    'Loading the playgrounds…': '正在加载练习场…',
    'No tool matches that search.': '没有与该搜索匹配的工具。',
    'The playgrounds could not be loaded.': '无法加载练习场。',

    /* The menu's groups. */
    'Cloud': '云',
    'Data': '数据',
    'DevOps': 'DevOps',
    'Programming': '编程',
    'Web & mobile': 'Web 与移动',
    'AI': '人工智能',
    'Networking': '网络',

    /* The two studios that have routes of their own. */
    'Build a network of routers, switches and PCs and configure it.':
        '用路由器、交换机和电脑搭建网络并进行配置。',
    'Write CARLA Python, run it, watch it drive a 3D city.':
        '编写 CARLA Python 代码并运行，看它在 3D 城市中驾驶。',

    /* The /playgrounds page and one playground. */
    'Your own workspace for every tool on the platform - its consoles, its dashboards and its portal. Practise anything: nothing here is graded or recorded, and your work is saved between visits.':
        '平台上每个工具都有你自己的工作区——包括控制台、仪表板和门户。随意练习：这里不评分也不记录，你的成果会在每次访问之间保存。',
    'Graded labs': '评分实验',
    'There is no playground with that name.': '没有这个名称的练习场。',
    'See every playground': '查看全部练习场',
    'Your own workspace for every tool - nothing graded': '每个工具的专属工作区——不评分',
};

export default playground;
