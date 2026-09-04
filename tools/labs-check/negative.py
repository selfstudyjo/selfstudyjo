"""Break each fix in turn and prove `npm run check:labs` notices.

A regex over source is the easiest kind of assertion to write and the easiest to
write vacuously: it passes when the file says the right thing, and it also passes
when the file says nothing at all in a shape the pattern happens not to match.
Every check added on 2026-09-01 is one of those, and the three faults they guard
were each invisible to 341 existing assertions — so "it passes" was never going
to be evidence on its own. Working rule 44, with a script on it.

    python tools/labs-check/negative.py

Each mutation is the fault as it actually shipped, not a random edit: `v-if` on
the active pane, `refreshViews` re-seeding the source, the report never being
built, the studio statically imported, the playground adopting a server source
unconditionally.

The 2026-09-04 batch is the terminal and the tutor, and two of those are the same
kind of invisible: `ref="tutor"` inside a `v-for` collects into an ARRAY, so
`tutor.value?.askAboutTask?.()` read a method off an array and the optional call
swallowed it - no error, no request, nothing in the browser console. And a
console key handler that forgets `preventDefault` does not fail, it closes the
tab.
"""
import io
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# (name, file, before, after) - `after` is the code as it was BEFORE the fix.
MUTATIONS = [
    ('a pane is destroyed when the student leaves it',
     'src/views/LabWorkspace.vue',
     'v-if="opened.has(pane.family)" v-show="activePane === pane.family"',
     'v-if="activePane === pane.family"'),

    ('the tool inside a pane is unmounted rather than hidden',
     'src/views/LabWorkspace.vue',
     '<div v-show="activeTool(pane.family) === tool.id" class="sl-bench__tool-slot">',
     '<div v-if="activeTool(pane.family) === tool.id" class="sl-bench__tool-slot">'),

    ('refreshViews overwrites the student\'s source again',
     'src/views/LabWorkspace.vue',
     '      views.value = fresh;\n',
     '      views.value = fresh;\n      webSource.value = (fresh as any).web || {};\n'),

    ('grading goes back to reporting nothing',
     'src/views/LabWorkspace.vue',
     '    report.value = gradeReport(before, result?.grade ?? null);',
     '    // report.value = gradeReport(before, result?.grade ?? null);'),

    ('the Network Simulator goes back to being a link',
     'src/views/LabWorkspace.vue',
     '<NetworkStudio v-if="tool.id === \'netsim\'" embedded />',
     '<a :href="`#${tool.href}`">open</a>'),

    ('the studio is imported statically, into every lab\'s chunk',
     'src/views/LabWorkspace.vue',
     "  loader: () => import('@/views/NetworkSimulatorStudio.vue'),",
     "  loader: () => import('@/views/NetworkSimulatorLearn.vue'),"),

    ('the playground adopts a server source over typed work again',
     'src/components/labs/LabWeb.vue',
     '  if (touched.value) return;',
     '  // if (touched.value) return;'),

    ('Run stops persisting, so grading never sees it',
     'src/components/labs/LabWeb.vue',
     '  render();\n  queueSave();\n}',
     '  render();\n}'),

    ('a browser global is shadowed again',
     'src/components/labs/LabWeb.vue',
     'const srcdoc = ref(\'\');',
     'const document = ref(\'\');'),

    ('a blob URL is opened in a tab of our own origin',
     'src/components/labs/LabWeb.vue',
     'function render() {',
     'function openTab() { window.open(URL.createObjectURL(new Blob([]))); }\nfunction render() {'),

    ('the task list stops drawing the report',
     'src/components/labs/LabTasks.vue',
     '{{ $t(report.key, report.params) }}',
     '{{ report ? "" : "" }}'),

    ('the self-mark control becomes an unticking checkbox again',
     'src/components/labs/LabTasks.vue',
     "v-if=\"task.manual && task.status !== 'passed'\"",
     'v-if="task.manual"'),

    ('the embedded studio claims beforeunload from the lab',
     'src/views/NetworkSimulatorStudio.vue',
     "    if (!props.embedded) window.addEventListener('beforeunload', warnUnsaved);",
     "    window.addEventListener('beforeunload', warnUnsaved);"),

    ('the embedded studio draws the link that navigates out of the lab',
     'src/views/NetworkSimulatorStudio.vue',
     '<router-link v-if="!embedded" class="ns-icon-btn" to="/network-simulator"',
     '<router-link class="ns-icon-btn" to="/network-simulator"'),

    ('the embedded studio reads a route that belongs to the lab',
     'src/views/NetworkSimulatorStudio.vue',
     'const projectId = props.embedded ? undefined : route.params.id as string | undefined;',
     'const projectId = route.params.id as string | undefined;'),

    ('the embedded studio is sized by the viewport again',
     'src/assets/css/netsim.css',
     '.ns-studio--embedded {\n    height: max(30rem, min(76vh, 76dvh));',
     '.ns-studio--embedded {\n    height: calc(100vh - 0px);'),
    # ---- 2026-09-04: the terminal, the editors and the tutor --------------

    # THE BUG, exactly as it shipped. A template ref inside a `v-for` is an
    # array, so the method was never found and the click did nothing at all.
    ('the tutor ref goes back to being an array',
     'src/views/LabWorkspace.vue',
     ':ref="el => { if (el) tutor = el }"',
     'ref="tutor"'),

    # And the other half: it SENT a sentence the student had never read.
    ('the tutor sends for you instead of filling the box',
     'src/views/LabWorkspace.vue',
     'requestAnimationFrame(() => tutor.value?.fillQuestion?.(question));',
     'requestAnimationFrame(() => tutor.value?.askAboutTask?.(task));'),

    ('the question is built at the call site again',
     'src/views/LabWorkspace.vue',
     'const question = taskQuestion(lab.value, task, position, tasks.length);',
     "const question = `I am stuck on ${task.title}`;"),

    ('the console loses its completion source',
     'src/views/LabWorkspace.vue',
     ':complete="completeIn"',
     ':hint="consoleHint(tool)"'),

    ('the file tree stops following a write from a subject console',
     'src/views/LabWorkspace.vue',
     "  if (toolId === 'editor' || panes.value.some(pane => pane.tools.some(",
     "  if (toolId === 'editor' || toolId === 'terminal') { /* was: */ } else if (false && panes.value.some(pane => pane.tools.some("),

    # `clear` answering as empty output was the second thing reported about
    # these labs, and the branch that fixes it is one line.
    ('clear goes back to printing nothing',
     'src/components/labs/LabConsole.vue',
     '    if (result?.clear) {',
     '    if (false) {'),

    ('nano and vi stop opening a buffer',
     'src/components/labs/LabConsole.vue',
     '    if (result?.editor) openBuffer(result.editor);',
     '    // if (result?.editor) openBuffer(result.editor);'),

    ('the prompt stops following cd',
     'src/components/labs/LabConsole.vue',
     '  return `student@lab:${cwd.value}$ `;',
     '  return own;'),

    # A past line rewritten to the current directory misreports where it ran.
    ('every past line is redrawn at the current directory',
     'src/components/labs/LabConsole.vue',
     "  push('cmd', line, prompt.value);",
     "  push('cmd', line);"),

    ('the terminal decisions move back into the component',
     'src/components/labs/LabConsole.vue',
     "} from '@/utils/labTerminal';",
     "} from '@/utils/labTerminalInlined';"),

    ('the tutor stops exposing fillQuestion',
     'src/components/labs/LabTutor.vue',
     'defineExpose({ fillQuestion });',
     'defineExpose({});'),

    ('the tutor box goes back to a one-line input',
     'src/components/labs/LabTutor.vue',
     '      <textarea',
     '      <input type="text"'),

    # ---- the plain modules, where a wrong answer is silent ----------------

    ('Tab inserts the FIRST match rather than the common prefix',
     'src/utils/labTerminal.ts',
     '    const prefix = longestCommonPrefix(hits);',
     '    const prefix = hits[0];'),

    ('a single match stops adding a trailing space',
     'src/utils/labTerminal.ts',
     '        const value = hits[0] + suffixOf(hits[0]);',
     '        const value = hits[0];'),

    ('a later word completes against commands again',
     'src/utils/labTerminal.ts',
     "    return /(^|[|;&])\\s*$/.test(before);",
     '    return true;'),

    ('reverse search forgets its position, so Ctrl+R twice never moves',
     'src/utils/labTerminal.ts',
     '    const offset = Math.max(0, Math.min(state.offset, matches.length - 1));',
     '    const offset = 0;'),

    ('reverse search stops de-duplicating',
     'src/utils/labTerminal.ts',
     '        if (!entry || seen.has(entry)) continue;',
     '        if (!entry) continue;'),

    ('!! with no history becomes an empty command',
     'src/utils/labTerminal.ts',
     '    if (!entries.length) return text;',
     "    if (!entries.length) return '';"),

    ('vi opens in insert mode, which is the one thing vi is not',
     'src/utils/labTerminal.ts',
     "        mode: program === 'vi' ? 'normal' : 'insert',",
     "        mode: 'insert',"),

    (':q on a dirty buffer closes and throws the work away',
     'src/utils/labTerminal.ts',
     "                    return { kind: 'none',\n                             state: { ...next, mode: 'normal', pending: '',\n                                      status: 'E37: No write since last change '\n                                        + '(add ! to override)' } };",
     "                    return { kind: 'close', state: next };"),

    ('the editor help line stops naming the real shortcuts',
     'src/utils/labTerminal.ts',
     "        ? '^O Write Out   ^X Exit   ^Q Discard'",
     "        ? 'Save   Close'"),

    ('the tutor question drops what the checker just said',
     'src/utils/labCatalogue.ts',
     '        if (task.note) parts.push(`The check says: ${sentence(task.note)}`);',
     '        // note dropped'),

    ('the tutor question stops asking for a nudge',
     'src/utils/labCatalogue.ts',
     "    parts.push('What should I look at next? Give me one nudge rather than the '\n        + 'answer, and tell me why it works.');",
     "    parts.push('What is the answer?');"),

    ('the tutor question drops the DETAIL, where the requirement is',
     'src/utils/labCatalogue.ts',
     '    if (task.detail) parts.push(`The lab asks: ${sentence(task.detail)}`);',
     '    // detail dropped'),

    ('the completion call starts throwing at the console',
     'src/services/labs.service.ts',
     '        } catch {\n            return empty;\n        }',
     '        } finally {\n            void empty;\n        }'),
]

def run_check():
    result = subprocess.run(
        ['npm', 'run', 'check:labs'], cwd=ROOT, capture_output=True, text=True,
        shell=(os.name == 'nt'))
    return result.returncode == 0, (result.stdout or '') + (result.stderr or '')


def main():
    ok, output = run_check()
    if not ok:
        print('The check does not pass BEFORE any mutation. Fix that first.\n')
        print(output[-2000:])
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
            print('  ok  {}\n      {}'.format(name, failed[0] if failed else '(failed)'))

    print('\n{} of {} mutations caught'.format(caught, len(MUTATIONS)))
    for name, why in missed:
        print('  MISSED  {} -- {}'.format(name, why))
    return 1 if missed else 0


if __name__ == '__main__':
    sys.exit(main())
