"""Break Noor, and prove `npm run check:assistant` notices.

    python tools/assistant-check/negative.py

Every assertion in that check is a regex over source or a call into a plain
module, which is the easiest kind to write vacuously - and on the first run of
this script FOUR of them were:

  * the `v-html` rule matched the comment in the template saying `v-html` is
    never used, so it failed while the code was correct and would have passed
    with the code broken;
  * the deferral rule matched `defineAsyncComponent` in the IMPORT at the top of
    the layout, so replacing the deferred window with a static import left it
    green;
  * the colour rule collected every hex inside a `var()` fallback and subtracted
    them by VALUE, so a bare `color: #e7eaf3` was excused by the identical hex
    in somebody else's fallback three rules down;
  * and the refusal's negative corpus had no sentence containing a solve verb
    and no assessment noun, so the whole AND was untested and "any verb alone"
    passed every case.

BOTH DIRECTIONS MATTER. A mutation that regresses nothing reports a sound check
as vacuous, and a check that matches a name in three places reports itself as
sound when it is not. `tools/labs-check/negative.py` is the precedent and it
found the same two shapes.

Every mutation is reverted whether the check passed or failed, so an interrupted
run leaves the tree as it found it.
"""

import io, subprocess, sys

MUTATIONS = [
    ('src/components/assistant/AssistantDock.vue',
     '            >{{ message.content }}</p>',
     '            v-html="message.content"></p>',
     'v-html in the bubble'),
    ('src/services/assistant.service.ts',
     'base, `${path}?user_id=${encodeURIComponent(userId)}`);',
     'base, `/exams/?user_id=${encodeURIComponent(userId)}`);',
     'the service fetches the answer key'),
    ('src/utils/assistantEngine.ts',
     "        return found ? { kind: 'navigate', to: found.to, label: found.label } : null;",
     "        return found ? { kind: 'navigate', to: found.to, label: found.label }\n            : { kind: 'navigate', to: target, label: target };",
     'an invented page is navigated to anyway'),
    ('src/utils/assistantEngine.ts',
     '        return [`${name}: COULD NOT BE READ just now',
     '        return [`${name}: none yet. ',
     'an unreadable section reads as an empty one'),
    ('src/utils/assistantEngine.ts',
     '    if (SOLVE_VERBS.slice(1).some(re => re.test(value))) return true;\n    return SOLVE_VERBS[0].test(value) && ASSESSMENT_NOUNS.some(re => re.test(value));',
     '    return SOLVE_VERBS.some(re => re.test(value));',
     'the refusal fires on an ordinary question'),
    ('src/utils/assistantEngine.ts',
     '    if (SOLVE_VERBS.slice(1).some(re => re.test(value))) return true;',
     '    if (false) return true;',
     'the standalone phrasings stop being refused'),
    ('src/utils/assistantEngine.ts',
     '        if (a.at !== b.at) return a.at < b.at ? 1 : -1;\n        return a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0;',
     '        return a.at < b.at ? 1 : (a.at > b.at ? -1 : 0);',
     'the attempt order is not total'),
    ('src/utils/assistantEngine.ts',
     '        if (!out.has(id)) out.set(id, { id, to, label, about, requires });',
     '        out.set(id, { id, to, label, about, requires });',
     'a later entry overwrites a section landing page'),
    ('src/utils/assistantEngine.ts',
     '        if (!ctx.access.lab) return null;\n        const lab = findEntry(ctx.labs',
     '        const lab = findEntry(ctx.labs',
     'a lab button is drawn without the feature'),
    ('src/utils/assistantEngine.ts',
     '    const rows = section.rows.slice(0, MAX_ROWS).map(render);',
     '    const rows = section.rows.map(render);',
     'the prompt section is unbounded'),
    ('src/utils/assistantEngine.ts',
     '                if (say) return { say, action };',
     '                return { say, action };',
     'an empty say renders a blank bubble'),
    ('src/utils/assistantEngine.ts',
     '    return messages.filter(m => !m.failed && m.content.trim()).slice(-HISTORY_TURNS * 2);',
     '    return messages.filter(m => m.content.trim());',
     'the history is unbounded'),
    ('src/assets/css/assistant.css',
     '.sfs-bot__chip {',
     '.chip {',
     'a bare class name in a globally loaded sheet'),
    ('src/assets/css/assistant.css',
     'color: var(--sfs-text, #e7eaf3);\n    font: inherit;\n    font-size: 0.82rem;',
     'color: #e7eaf3;\n    font: inherit;\n    font-size: 0.82rem;',
     'a bare colour literal'),
    ('src/layouts/DefaultLayout.vue',
     "const AssistantDock = defineAsyncComponent(\n    () => import('@/components/assistant/AssistantDock.vue'));",
     "import AssistantDock from '@/components/assistant/AssistantDock.vue';",
     'the window is eager again'),
    ('src/components/assistant/AssistantDock.vue',
     '        }, 9000);',
     '        }, 9000000);',
     'the Chrome keepalive stops keeping alive'),
    ('src/components/assistant/AssistantDock.vue',
     '<span>{{ $t(cast.name) }}</span>',
     '<span>Noor</span>',
     'the plate hardcodes a name'),
    ('src/utils/assistantCast.ts',
     '    if (index < 0) return ASSISTANTS[0]!;\n    return ASSISTANTS[(index + 1) % ASSISTANTS.length]!;',
     '    return ASSISTANTS[0]!;',
     'the cast stops alternating and one of them never appears'),
    ('src/utils/assistantCast.ts',
     '    if (index < 0) return ASSISTANTS[0]!;',
     "    if (index < 0) throw new Error('unknown cast');",
     'an unrecognised stored value throws instead of falling back'),
    ('src/utils/assistantCast.ts',
     '    const index = ASSISTANTS.findIndex(a => a.id === assistant.id);\n    return index < 0 ? 0 : index;',
     '    void assistant;\n    return 0;',
     'both assistants share a seat, so they share a device voice'),
    ('src/utils/assistantEngine.ts',
     "export const GREETING_SIGNED_IN = 'Hi {name} — I am {bot}.",
     "export const GREETING_SIGNED_IN = 'Hi {name} — I am Noor.",
     'the greeting hardcodes a name'),
    ('src/stage3d/assistants.ts',
     '        build: 0.6, height: 1.79, phase: 2.7,',
     '        build: 0.6, height: 1.79, phase: 0.45,',
     'the two assistants breathe almost in step'),
    ('src/components/assistant/AssistantDock.vue',
     '                plan.allowAnyVoice);',
     '                false);',
     'the male voice is refused a stand-in rather than reshaping one'),
    ('src/components/assistant/AssistantDock.vue',
     '            const ratio = plan.shapeTo ? shapeRatio(clip.gender, plan.shapeTo) : 1;',
     '            const ratio = 1;',
     'the reshaping pass is skipped, so Omar is voiced by a woman'),
]

caught = 0
stale = 0
for path, before, after, label in MUTATIONS:
    original = io.open(path, encoding='utf-8').read()
    if before not in original:
        # NOT a pass. An anchor that no longer matches is a mutation that has
        # silently stopped testing anything - the code moved, or was reworded,
        # and this line now proves nothing while still printing a tidy result.
        # Four of these appeared the moment the cast was split into its own
        # module, which is exactly when a stale mutation is least visible.
        print('  STALE anchor not found, this mutation tests nothing: ' + label)
        stale += 1
        continue
    io.open(path, 'w', encoding='utf-8', newline='\n').write(original.replace(before, after, 1))
    r = subprocess.run('npm run check:assistant', shell=True, capture_output=True,
                       text=True, encoding='utf-8', errors='replace')
    io.open(path, 'w', encoding='utf-8', newline='\n').write(original)
    out = (r.stdout or '') + (r.stderr or '')
    failed = 'All checks passed' not in out
    caught += failed
    print(('  ok    caught: ' if failed else '  MISS  NOT caught: ') + label)

print('\n%d of %d mutations caught' % (caught, len(MUTATIONS)))
sys.exit(0 if caught == len(MUTATIONS) else 1)
