/**
 * The site search: the field in the top bar and its results panel.
 *
 * Its own area because "search" here is the whole-site finder rather than a
 * filter box over one list, and the section headings ("Lessons", "Quizzes")
 * are headings of a results list. Keys that already exist elsewhere -
 * "Courses", "Exams", "Runbooks", "Quizzes", "Lessons", "Clear", "Clear search",
 * "Playground", "Loading…", "Show {v0} more" - are NOT declared again here
 * (`check:i18n` fails on a key declared twice).
 */

import type { Catalogue } from '../../index';

const search: Catalogue = {
    /* The field in the top bar. */
    'Search the site…': '搜索全站…',
    'Search the site': '搜索全站',
    'Search courses, lessons, labs, quizzes, exams, runbooks and pages':
        '搜索课程、课时、实验、测验、考试、操作手册和页面',
    'Close search': '关闭搜索',
    'Search results': '搜索结果',

    /* Before anything is typed. */
    'Recent searches': '最近的搜索',
    'Jump to': '快速前往',
    'Type to search courses, lessons, labs, quizzes, exams, runbooks and pages.':
        '输入关键词，搜索课程、课时、实验、测验、考试、操作手册和页面。',

    /* The result sections. */
    'Pages & apps': '页面与应用',
    'Labs & playgrounds': '实验与练习场',
    'Show fewer': '收起',
    'This section could not be loaded.': '此部分无法加载。',
    'The service did not answer. Press to try again.': '服务没有响应。点击重试。',
    'Some results are still loading': '部分结果仍在加载',

    /* A result the reader cannot open yet. */
    'Sign in to open': '登录后打开',
    'Needs a plan with labs': '需要包含实验的套餐',
    'Needs a plan with runbooks': '需要包含操作手册的套餐',
    'Needs a plan with AI tools': '需要包含 AI 工具的套餐',
    'Needs a plan with Research Flow': '需要包含 Research Flow 的套餐',
    'Needs a plan with Toastmasters': '需要包含 Toastmasters 的套餐',
    'Needs a plan with exams': '需要包含考试的套餐',
    'Needs a subscription': '需要订阅',

    /* Nothing found. */
    'No results': '没有结果',
    '{v0} results': '{v0} 个结果',
    'No results for “{v0}”': '没有找到“{v0}”的结果',
    'Check the spelling, or try fewer or shorter words.': '请检查拼写，或尝试更少、更短的词。',
    'You can search in English, Arabic or Chinese.': '可以用中文、英文或阿拉伯文搜索。',
    'Browse instead': '或者浏览',

    /* The keyboard hints in the footer. */
    'to move': '移动',
    'to open': '打开',
    'next section': '下一部分',
    'to close': '关闭',
};

export default search;
