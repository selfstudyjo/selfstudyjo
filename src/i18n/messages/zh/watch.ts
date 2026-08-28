/**
 * Self Study TV (app 38) — Chinese (Simplified).
 *
 * ============================================================
 * ITS OWN AREA, BECAUSE CONTEXT IS WHAT MAKES A TRANSLATION RIGHT
 * ============================================================
 *
 * The same reason the Arabic file gives, and the words are different ones:
 *
 *  * **"Series"** is `剧集` — a television serial. `系列` is a series of
 *    anything (a series of lessons, a product line) and is what an alphabetical
 *    list would suggest.
 *  * **"Season"** is `季`, the television counter, not `季节` (a time of year).
 *  * **"Episode"** is counted with `集`, so `第 {v0} 季` and `下一集` rather than
 *    anything built out of `部分`.
 *  * **"Live"** is `直播` (broadcast as it happens), not `现场` (in person).
 *  * **"Play"** is `播放` (start the media running), never `玩` (to play a game).
 *
 * ============================================================
 * SCRIPT AND PRODUCT NAMES
 * ============================================================
 *
 * Simplified Chinese throughout. `Self Study` stays in Latin script, the same
 * decision `'Self Study Leaderboard': 'Self Study 排行榜'` already makes, with a
 * space before the Chinese — which is the convention every Chinese interface
 * mixing scripts follows and which `rtl.css`'s isolation rules make safe.
 *
 * Chinese punctuation is full width (`。，、`) and takes no space before it;
 * getting that wrong is the sort of thing a reader notices immediately and
 * cannot report in English.
 */

import type { Catalogue } from '../../index';

const watch: Catalogue = {
    /* -- the sidebar ---------------------------------------------------- */
    // The platform menu's group heading. A group label left in English is
    // the only untranslated text on an otherwise translated sidebar, which
    // reads as a rendering fault rather than as a gap.
    'Watch': '观看',

    /* -- the application, and how it is reached -------------------------- */
    'Self Study TV': 'Self Study 电视',
    'Films, series and live channels': '电影、剧集和直播频道',
    'Films, series and live channels — free with your account.':
        '电影、剧集和直播频道 —— 有账户即可免费观看。',

    /* -- kinds ---------------------------------------------------------- */
    // `剧集` — a television serial. NOT `系列`, which is a series of anything.
    'Series': '剧集',
    'Film': '电影',
    'Films': '电影',
    'Episode': '单集',
    'Episodes': '剧集列表',
    // `季` is the television counter; `季节` would be a time of year.
    'Season {v0}': '第 {v0} 季',

    /* -- rails ---------------------------------------------------------- */
    // Reached as `$t(rail.key)` from `iptvEngine.buildRails`, so these are
    // headings rather than sentences.
    'New this week': '本周新上',
    'Continue watching': '继续观看',
    'See all': '查看全部',

    /* -- playing -------------------------------------------------------- */
    // `播放` — start the media running. Never `玩`, which is to play a game.
    'Play': '播放',
    'Watch now': '立即观看',
    'Resume': '继续播放',
    'Start from the beginning': '从头开始',
    'You stopped at {v0}.': '你上次看到 {v0}。',
    'Next episode': '下一集',
    'Previous episode': '上一集',
    'Coming soon': '即将上线',
    'Untitled': '未命名',

    /* -- live ----------------------------------------------------------- */
    // `直播` — as it happens. Not `现场`, which is "in person".
    'Live channels': '直播频道',
    'Broadcast streams, playing straight from the broadcaster.':
        '直播信号，直接来自播出方。',
    'Tuning in…': '正在接入频道…',
    'Search channels…': '搜索频道…',
    // The fallback group for a channel an imported playlist gave no category.
    'Other': '其他',

    /* -- searching ------------------------------------------------------ */
    'Search films, series and channels…': '搜索电影、剧集和频道…',
    'Nothing matched that.': '没有匹配的结果。',

    /* -- empty, and not the same as broken ------------------------------ */
    'Nothing to watch yet': '暂时还没有内容',
    'Films, series and channels appear here as soon as they are published.':
        '电影、剧集和频道一经发布就会出现在这里。',
    'No channels yet': '暂时还没有频道',
    'Live channels appear here as soon as they are published.':
        '直播频道一经发布就会出现在这里。',
    'No episodes have been published yet.': '还没有发布任何一集。',
    'This has not been uploaded yet.': '这个还没有上传。',

    /* -- failures ------------------------------------------------------- */
    // Every one of these is a fallback, and a fallback is reached when something
    // has already gone wrong — which makes it the last place to leave a second,
    // avoidable wrongness (working rule 39).
    'Self Study TV is not answering': 'Self Study 电视没有响应',
    'Self Study TV is not answering. Try again in a moment.':
        'Self Study 电视没有响应。请稍后重试。',
    'Channels could not be loaded': '无法加载频道',
    'Channels could not be loaded.': '无法加载频道。',
    'That series could not be loaded': '无法加载该剧集',
    'That series could not be loaded.': '无法加载该剧集。',
    'That episode is not in this series.': '该单集不属于这部剧集。',
    'That could not be played.': '无法播放。',
    'Playback stopped. The link may have expired — try again.':
        '播放已中断，链接可能已过期 —— 请重试。',
    'That channel is not responding. It may be off air.':
        '该频道没有响应，可能已停播。',
    'This browser cannot play live streams.': '此浏览器无法播放直播流。',
    'The live player could not be loaded.': '无法加载直播播放器。',
};

export default watch;
