"""Break each decision in turn and prove `npm run check:reader` notices.

    python tools/reader-check/negative.py

WHY THIS EXISTS. Every assertion in `check:reader` passed the first time it was
written, and that is not evidence of anything: half of them are regexes over
source, which is the easiest kind of assertion to write vacuously -- it passes
when the file says the right thing and ALSO passes when the file says nothing at
all in a shape the pattern happens not to match. `tools/labs-check/negative.py`
found one of its own checks matching straight across a closing brace into the
declaration of the function it was looking for, and `_negative_claude.py` found
ten weak checks and three no-op mutations in one run.

So every mutation below is the fault as it would actually arrive -- the obvious
simplification, the plausible tidy-up, the thing somebody would write if they had
not read the comment above it:

  * the voice following the SETTING rather than the script, which is the whole
    feature getting the one decision wrong;
  * code being read aloud, which is forty minutes of `hdfs dfs -du -h -s /data`;
  * a passage over app 36's silent 1200-character truncation;
  * a table read as a stream of unattributed cells;
  * the Chrome keepalive removed, which cuts every long passage off AND leaves
    the promise pending for ever;
  * the generation counter removed, so an abandoned chain talks over the new one;
  * the route-leave stop removed, so the lesson reads over the next page.

BOTH DIRECTIONS MATTER. A mutation that does not regress anything reports a sound
check as vacuous; a check that matches a name in three places reports itself as
sound when it is not. Anything printed as `??` below is a mutation whose anchor
has moved, which is a stale harness rather than a passing one.
"""
import io
import os
import shutil
import subprocess
import sys
import tempfile

# The failure DETAIL printed below is routinely Arabic or Chinese -- it is the
# language the check just measured -- and a Windows console defaults to cp1252,
# which raises `UnicodeEncodeError` mid-report and takes the whole run down after
# one mutation. `errors='replace'` rather than a strict encode: a mojibake
# character in a label is a cosmetic loss, and a harness that dies on the first
# interesting finding is not.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# (name, file, before, after) - `after` is the code as it would be WITHOUT the fix.
MUTATIONS = [
    # ---------------- the decision the whole feature rests on ----------------
    ('the voice follows the reader\'s SETTING rather than the script',
     'src/utils/reader.ts',
     '    if (!arabic && !han && !latin) return fallback;',
     '    return fallback;\n    if (!arabic && !han && !latin) return fallback;'),

    ('script counts are compared raw, so "HTTP 标头" is read in English',
     'src/utils/reader.ts',
     "const CHARS_PER_WORD: Record<ReaderLang, number> = { en: 5, ar: 4, zh: 1.5 };",
     "const CHARS_PER_WORD: Record<ReaderLang, number> = { en: 1, ar: 1, zh: 1 };"),

    ('digits and punctuation vote, so a table of addresses reads as English',
     'src/utils/reader.ts',
     "const LATIN = /[A-Za-z\\u00C0-\\u024F]/;",
     "const LATIN = /[A-Za-z0-9.\\/\\u00C0-\\u024F]/;"),

    ('the language is detected per PASSAGE, so a long paragraph changes voice',
     'src/utils/reader.ts',
     '            passages.push({ text, lang: unit.lang });',
     '            passages.push({ text, lang: detectLang(text, unit.lang) });'),

    # ---------------- code ----------------
    ('a fenced block is read aloud',
     'src/utils/reader.ts',
     "        if (block.kind === 'code') { counters.skippedCode++; continue; }",
     "        if (block.kind === 'code') { units.push({ text: block.text, lang: 'en' }); continue; }"),

    ('a fenced block is skipped SILENTLY, with nothing saying so',
     'src/utils/reader.ts',
     "        if (block.kind === 'code') { counters.skippedCode++; continue; }",
     "        if (block.kind === 'code') { continue; }"),

    ('inline code is dropped, removing the subject of the sentence',
     'src/utils/reader.ts',
     "        .replace(/`([^`\\n]+)`/g, '$1')",
     "        .replace(/`([^`\\n]+)`/g, ' ')"),

    # ---------------- the 1200-character truncation ----------------
    ('the budget goes over the server limit',
     'src/utils/reader.ts',
     'export const SPEECH_BUDGET = 360;',
     'export const SPEECH_BUDGET = 1600;'),

    ('the hard ceiling goes over the server limit',
     'src/utils/reader.ts',
     'export const PASSAGE_CEILING = 900;',
     'export const PASSAGE_CEILING = 4000;'),

    ('an over-long sentence is left whole rather than cut',
     'src/utils/reader.ts',
     '        if (unit.length > PASSAGE_CEILING) {\n            flush();\n            out.push(...splitLong(unit, lang));\n            continue;\n        }',
     '        if (false) {\n            flush();\n            out.push(...splitLong(unit, lang));\n            continue;\n        }'),

    # ---------------- things that vanish ----------------
    ('a unit with no sentence structure is dropped instead of read',
     'src/utils/reader.ts',
     '    const units = parts.length ? parts : [clean];',
     '    const units = parts;'),

    ('a list item loses its stop, so the list is one run-on sentence',
     'src/utils/reader.ts',
     "                units.push({ text: prefix + withStop(said), lang });",
     "                units.push({ text: prefix + said, lang });"),

    ('an ordered list restarts at 1 over steps four, five and six',
     'src/utils/reader.ts',
     "                const prefix = block.ordered ? `${block.start + at}. ` : '';",
     "                const prefix = block.ordered ? `${at + 1}. ` : '';"),

    ('numbered() stops numbering, so a spoken list is a paragraph',
     'src/utils/reader.ts',
     '        .map((item, at) => `${at + 1}. ${item}`)',
     '        .map(item => item)'),

    # ---------------- the table ----------------
    ('a table is read as a stream of unattributed cells',
     'src/utils/reader.ts',
     "            pairs.push(label ? `${label}: ${value}` : value);",
     '            pairs.push(value);'),

    ('the row subject is read twice, once as a label',
     'src/utils/reader.ts',
     '        for (let i = 1; i < cells.length; i++) {',
     '        for (let i = 0; i < cells.length; i++) {'),

    ('an empty cell is announced with nothing after it',
     'src/utils/reader.ts',
     '            if (!value) continue;',
     '            if (false) continue;'),

    # ---------------- the estimate ----------------
    ('the estimate uses one rate for every language',
     'src/utils/reader.ts',
     '        (total, p) => total + estimateDurationMs(p.text, p.lang), 0);',
     "        (total, p) => total + estimateDurationMs(p.text, 'en'), 0);"),

    ('the dominant language is by passage COUNT rather than by characters',
     'src/utils/reader.ts',
     "        totals.set(p.lang, (totals.get(p.lang) || 0) + p.text.length);",
     "        totals.set(p.lang, (totals.get(p.lang) || 0) + 1);"),

    # ---------------- the shared-empty bug, as it actually shipped -----------
    ('the empty plan goes back to being a shared, spread constant',
     'src/utils/reader.ts',
     'export function emptyPlan(): ReadingPlan {\n    return { passages: [], skippedCode: 0, languages: [], chars: 0 };\n}',
     'const SHARED: ReadingPlan = { passages: [], skippedCode: 0, languages: [], chars: 0 };\nexport function emptyPlan(): ReadingPlan {\n    return { ...SHARED };\n}'),

    # ---------------- a lookbehind, i.e. a blank page on Safari < 16.4 -------
    ('a lookbehind reaches the bundle',
     'src/utils/reader.ts',
     "        .replace(/~~([^~\\n]+)~~/g, '$1')",
     "        .replace(/(?<=\\s)~~([^~\\n]+)~~/g, '$1')"),

    # ---------------- the composable ----------------
    ('the Chrome keepalive is removed, so every long passage is cut off',
     'src/composables/useReader.ts',
     '                window.speechSynthesis.pause();\n                window.speechSynthesis.resume();',
     '                void 0;'),

    ('the watchdog is removed, so a lost onend hangs the reader for ever',
     'src/composables/useReader.ts',
     '        watchdog = setTimeout(finish, Math.max(8000, budget * 2 + 6000));',
     '        // no watchdog'),

    ('speechSynthesis is never cancelled, so it reads over the next page',
     'src/composables/useReader.ts',
     '    try { window.speechSynthesis?.cancel(); } catch { /* no engine here */ }',
     '    /* nothing to cancel */'),

    ('the generation counter goes, so an abandoned chain talks over the new one',
     'src/composables/useReader.ts',
     '        if (mine !== turn) return;\n        index.value = at;',
     '        index.value = at;'),

    ('the capability probe is spent even when the device has the voices',
     'src/composables/useReader.ts',
     '    if (languages.every(lang => deviceCanSpeak(voices.value, lang))) return;',
     '    /* always probe */'),

    ('the probe is asked about nothing rather than the plan',
     'src/composables/useReader.ts',
     '    await probe(next.languages);',
     '    await probe([]);'),

    ('the audio context is no longer primed inside the click',
     'src/composables/useReader.ts',
     '    audio.prime();\n    error.value = \'\';',
     '    error.value = \'\';'),

    ('prime() moves behind an await, where the gesture no longer counts',
     'src/composables/useReader.ts',
     '    audio.prime();\n    error.value = \'\';',
     '    await probe();\n    audio.prime();\n    error.value = \'\';'),

    ('a device route counts as a failure, abandoning the read on the fast path',
     'src/composables/useReader.ts',
     "            if (spoken.route === 'server') failures++;",
     '            failures++;'),

    ('three server failures no longer stop, so the button reads as dead',
     'src/composables/useReader.ts',
     "            error.value = 'speech-unavailable';",
     "            // error.value = 'speech-unavailable';",),

    ('the next passage is no longer prefetched, so every seam is a round trip',
     'src/composables/useReader.ts',
     '        prefetch(plan.passages[at + 1]);',
     '        // prefetch(plan.passages[at + 1]);'),

    ('the page stops reserving room, so the bar covers the end of the lesson',
     'src/assets/css/default-layout.css',
     "html[data-sfs-reading='1'] .app-container > .main-content {",
     "html[data-sfs-nothing] .app-container > .main-content {"),

    ('the document is never marked, so the reserve never applies',
     'src/composables/useReader.ts',
     "    if (active) root.setAttribute('data-sfs-reading', '1');",
     '    if (active) void 0;'),

    ('the mark is never cleared, so every page keeps the reserve for ever',
     'src/composables/useReader.ts',
     '    clearTimers();\n    markReading(false);',
     '    clearTimers();'),

    ('the reader state stops being module-level, so two sections can both read',
     'src/composables/useReader.ts',
     "const state = ref<ReaderState>('idle');",
     "let state = ref<ReaderState>('idle');"),

    # ---------------- the control ----------------
    ('the control stops declaring the language it is reading in',
     'src/components/ReadAloud.vue',
     "    return t('Read in {v0}', { v0: getLocale(lang).nativeName });",
     "    return '';"),

    ('the control stops saying that code is skipped',
     'src/components/ReadAloud.vue',
     "        : t('{v0} code blocks are not read aloud', { v0: n });",
     '        : \'\';'),

    ('the read no longer stops when the page is left',
     'src/components/ReadAloud.vue',
     'onBeforeRouteLeave(() => { if (mine.value) reader.stop(); });',
     '/* no route guard */'),

    ('the read no longer stops on unmount',
     'src/components/ReadAloud.vue',
     'onBeforeUnmount(() => { if (mine.value) reader.stop(); });',
     '/* no unmount guard */'),

    ('a language change no longer stops the read',
     'src/components/ReadAloud.vue',
     'watch(localeId, () => { if (mine.value) reader.stop(); });',
     '/* no locale watch */'),

    ('the transport bar stops being teleported out of the stacking context',
     'src/components/ReadAloud.vue',
     '<Teleport v-if="mine" to="body">',
     '<div v-if="mine">'),

    ('the bar announces itself over the voice that is reading the page',
     'src/components/ReadAloud.vue',
     '<span class="sfs-read-bar__meta" aria-live="off">',
     '<span class="sfs-read-bar__meta" aria-live="polite">'),

    ('the plan is rebuilt in the handler rather than computed',
     'src/components/ReadAloud.vue',
     'const plan = computed<ReadingPlan>(() => {',
     'const plan = (() => {\n  const inner = () => ({ passages: [], skippedCode: 0, languages: [], chars: 0 });\n  return { value: inner() };\n})();\nconst unusedPlan = ((): ReadingPlan => {'),

    # ---------------- the stylesheet ----------------
    ('the passage counter stops being pinned LTR',
     'src/assets/css/read-aloud.css',
     '    direction: ltr;\n    unicode-bidi: isolate;\n    font-variant-numeric: tabular-nums;',
     '    font-variant-numeric: tabular-nums;'),

    ('the transport controls mirror, so skip-back skips forward',
     'src/assets/css/read-aloud.css',
     '       newscast set follow. */\n    direction: ltr;',
     '       newscast set follow. */'),

    ('the playing state takes the page ink on an accent fill',
     'src/assets/css/read-aloud.css',
     '    color: var(--sfs-on-accent, #ffffff);\n}\n\n/*\n * ON AN ISLAND',
     '    color: var(--sfs-text, #e8ecf8);\n}\n\n/*\n * ON AN ISLAND'),

    ('a bare colour literal goes in, wrong in nine of the ten galaxies',
     'src/assets/css/read-aloud.css',
     '    background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));\n    color: var(--sfs-text, #e8ecf8);',
     '    background: #2b3050;\n    color: #e8ecf8;'),

    ('a class outside the namespace goes in, landing on other pages',
     'src/assets/css/read-aloud.css',
     '.sfs-read-label {',
     '.read-label, .sfs-read-label {'),

    ('the touch minimum becomes a rem, i.e. 41.5px on a phone',
     'src/assets/css/read-aloud.css',
     '        min-height: max(2.75rem, 44px);',
     '        min-height: 2.75rem;'),

    ('the island variant stops borrowing its container ink',
     'src/assets/css/read-aloud.css',
     '.sfs-read-btn--inherit {\n    background: transparent;\n    border-color: currentColor;\n    color: inherit;',
     '.sfs-read-btn--inherit {\n    background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));\n    border-color: var(--sfs-border, rgb(255 255 255 / 0.14));\n    color: var(--sfs-text, #e8ecf8);'),

    # ---------------- the wiring ----------------
    ('two sections on the lesson page share one id',
     'src/views/LessonDetails.vue',
     ':id="`lesson-section-${index}`"',
     'id="lesson-write-up"'),

    ('the lesson page stops importing the control',
     'src/views/LessonDetails.vue',
     "import ReadAloud from '@/components/ReadAloud.vue';",
     '/* no ReadAloud */'),

    ('the runbook stops importing the control',
     'src/views/RunbookDetails.vue',
     "import ReadAloud from '@/components/ReadAloud.vue';",
     '/* no ReadAloud */'),

    ('the lab brief stops importing the control',
     'src/components/labs/LabBrief.vue',
     "import ReadAloud from '@/components/ReadAloud.vue';",
     '/* no ReadAloud */'),

    ('the studio lesson panel stops importing the control',
     'src/components/netsim/LessonPanel.vue',
     "import ReadAloud from '@/components/ReadAloud.vue';",
     '/* no ReadAloud */'),

    # ---------------- the catalogues ----------------
    ('an Arabic key goes missing, so one string renders in English',
     'src/i18n/messages/ar/reader.ts',
     "    'Read this section': 'اقرأ هذا القسم',",
     ''),

    ('a Chinese key goes missing, so one string renders in English',
     'src/i18n/messages/zh/reader.ts',
     "    'Read this section': '朗读本节',",
     ''),

    ('the reader catalogue redeclares a key common already has',
     'src/i18n/messages/ar/reader.ts',
     "    'Reading aloud': 'القراءة بصوت مسموع',",
     "    'Reading aloud': 'القراءة بصوت مسموع',\n    'Previous': 'السابق',"),

    ('the Arabic catalogue is never registered',
     'src/i18n/messages/ar/index.ts',
     '    ...reader,',
     '    /* ...reader, */'),
]


def run_check():
    result = subprocess.run(
        ['npm', 'run', 'check:reader'], cwd=ROOT, capture_output=True, text=True,
        shell=(os.name == 'nt'))
    return result.returncode == 0, (result.stdout or '') + (result.stderr or '')


def main():
    ok, output = run_check()
    if not ok:
        print('The check does not pass BEFORE any mutation. Fix that first.\n')
        print(output[-3000:])
        return 1
    print('baseline: PASS\n')

    caught, missed = 0, []
    for name, path, before, after in MUTATIONS:
        full = os.path.join(ROOT, path)
        original = io.open(full, encoding='utf-8').read()
        if before not in original:
            missed.append((name, 'the anchor is not in ' + path))
            print('  ??  {}\n      anchor missing in {}'.format(name, path))
            continue
        backup = tempfile.mktemp()
        shutil.copyfile(full, backup)
        io.open(full, 'w', encoding='utf-8').write(original.replace(before, after, 1))
        try:
            passed, out = run_check()
        finally:
            shutil.copyfile(backup, full)
            os.remove(backup)
        if passed:
            missed.append((name, 'NOT CAUGHT'))
            print('  --  {}\n      NOT CAUGHT'.format(name))
        else:
            caught += 1
            failed = [l.strip() for l in out.splitlines() if l.strip().startswith('FAIL')]
            print('  ok  {}\n      {}'.format(name, failed[0] if failed else '(build failed)'))

    print('\n{} of {} mutations caught'.format(caught, len(MUTATIONS)))
    for name, why in missed:
        print('  MISSED  {} -- {}'.format(name, why))
    return 1 if missed else 0


if __name__ == '__main__':
    sys.exit(main())
