/**
 * The read-aloud control: "Read this section", and its transport bar.
 *
 * Its own area rather than a handful of keys in `common`, for the reason the
 * index file gives: context is what makes a translation right. 朗读 is reading
 * ALOUD, which is a different word from 阅读 (reading to oneself) and is the
 * whole subject of this catalogue; 暂停 pauses a voice rather than a lab or a
 * countdown. Alphabetical order would separate every one of those from the
 * keys that decide it.
 *
 * `Previous`, `Next` and `Stop` are deliberately NOT here -- they are already in
 * `common`, and a key declared in two modules is a silent overwrite that
 * `check:i18n` section 6 exists to catch.
 *
 * Simplified Chinese throughout, and the script matters as much as the
 * language: told only "translate to Chinese" a model intermittently answers in
 * Traditional, which is the same failure `language.py` names on app 27.
 */

import type { Catalogue } from '../../index';

const reader: Catalogue = {
    /* The button. */
    'Read this section': '朗读本节',
    'Preparing…': '正在准备…',
    'Pause': '暂停',
    'Resume': '继续',
    'There is nothing here to read aloud.': '此处没有可朗读的内容。',

    /* The transport bar. */
    'Reading aloud': '正在朗读',
    'Stop reading': '停止朗读',
    'Reading speed': '朗读速度',
    '{v0} min left': '还剩 {v0} 分钟',
    '{v0} min listen': '收听时长 {v0} 分钟',

    /*
      THE TWO DECLARATIONS.

      Both exist because a substitution that is not declared is the bug working
      rule 21 is about, and both are read by somebody who can see the screen and
      is wondering why the voice did something.

      "Read in {v0}" is shown when the section is not in the language the reader
      chose -- which is the NORMAL case on ~230 lesson write-ups and on the whole
      Network Simulator catalogue, all of which are English only.
    */
    'Read in {v0}': '以{v0}朗读',
    'Code is not read aloud': '代码不会被朗读',
    '{v0} code blocks are not read aloud': '有 {v0} 个代码块不会被朗读',

    'The voice service could not be reached. Reading stopped.':
        '无法连接语音服务，朗读已停止。',
};

export default reader;
