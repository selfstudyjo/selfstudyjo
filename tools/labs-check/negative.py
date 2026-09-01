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
