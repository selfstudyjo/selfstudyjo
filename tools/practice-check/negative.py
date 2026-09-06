"""Break each of the speaking rooms' invariants and prove `check:practice` notices.

    python tools/practice-check/negative.py

WHY THIS EXISTS

Every assertion added for the interview and the Toastmasters meeting on
2026-09-06 passed the first time it was written, which says nothing at all about
whether it can fail. Working rule 44, with a script on it — and it earned its
keep on the first run: two of the six mutations below went straight past 200
green assertions, because the catalogue being perfect says nothing about whether
either ROOM uses it.

  * deleting `await sitting.complete()` from the interview left a finished
    interview accruing penalties for as long as the tab lived, on a public
    record — which is the exact bug the labs were reported for;
  * deleting the abandon note from `usePracticeSitting` stopped "left before the
    end" ever being recorded at all.

Both are lifecycle facts, so `check:practice` reads the view and the composable
off disk for them — the same instrument `check:labs` uses on `LabWeb.vue`.

BOTH DIRECTIONS MATTER. A mutation that regresses nothing reports a SOUND check
as vacuous, so a case that comes back NOT CAUGHT needs the mutation read before
the check is blamed. And a check matching a name that appears in three places
reports itself as sound when it is not — which is how "the room never quotes the
assessed price" was written first: it scanned every printed figure for the
number 4, and a room's own Alt+Tab price IS 4, so the property it claimed to
test was a coincidence.
"""
import io
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# (name, file, before, after) — `after` is the mistake, and each one is a
# plausible refactor rather than sabotage: a context list widened by one word, a
# price copied from the row above, a call somebody tidied away.
MUTATIONS = [
    # --- the catalogue ---------------------------------------------------
    ('an interview is given the exam strike limit',
     'src/utils/practiceIntegrity.ts',
     '    interview: null, toastmasters: null,',
     '    interview: NEGATIVE_LIMIT, toastmasters: null,'),

    ('a pasted answer stops being recorded in the speaking rooms',
     'src/utils/practiceIntegrity.ts',
     "        contexts: ['exam', 'quiz', 'interview', 'toastmasters'],\n"
     '        contextPoints: { interview: -4, toastmasters: -4 },',
     "        contexts: ['exam', 'quiz'],\n"
     '        contextPoints: { },'),

    ('copying is added to the MEETING, where the screen carries the exercise',
     'src/utils/practiceIntegrity.ts',
     "        contexts: ['exam', 'quiz', 'interview'],\n"
     '        contextPoints: { interview: -2 },',
     "        contexts: ['exam', 'quiz', 'interview', 'toastmasters'],\n"
     '        contextPoints: { interview: -2, toastmasters: -2 },'),

    ('a window switch in a room is priced at the exam rate',
     'src/utils/practiceIntegrity.ts',
     '        contextPoints: { lab: -1, interview: -3, toastmasters: -3 },',
     '        contextPoints: { lab: -1, interview: -4, toastmasters: -4 },'),

    ('the spoken award loses its cap, so it can be scripted in a loop',
     'src/utils/practiceIntegrity.ts',
     "        contexts: ['interview', 'toastmasters'], once: 8,",
     "        contexts: ['interview', 'toastmasters'], once: 0,"),

    ('finishing a meeting is made an AWARD, so clicking through one pays',
     'src/utils/practiceIntegrity.ts',
     "        points: 0, severity: 'neutral', contexts: ['toastmasters'], once: 1,\n"
     "        label: 'Finished the meeting',",
     "        points: 20, severity: 'positive', contexts: ['toastmasters'], once: 1,\n"
     "        label: 'Finished the meeting',"),

    ('staying for the whole meeting stops earning anything',
     'src/utils/practiceIntegrity.ts',
     "        points: 10, severity: 'positive', contexts: ['toastmasters'], once: 1,",
     "        points: 0, severity: 'neutral', contexts: ['toastmasters'], once: 1,"),

    # --- the copy, which is what the rooms SAY --------------------------
    ('both rooms fall back to the lab reassurance, as they did before '
     'CALM_BODY existed',
     'src/utils/practiceIntegrity.ts',
     "    interview: 'An interview here is rehearsal,",
     "    interview: CALM_BODY.lab, unusedInterview: 'An interview here is rehearsal,"),

    ('the running sentence goes back to naming a lab in every context',
     'src/utils/practiceIntegrity.ts',
     'key: OPEN_BODY[verdict.context] || OPEN_BODY.lab,',
     'key: OPEN_BODY.lab,'),

    # --- the wiring, which is what the rooms DO -------------------------
    ('the abandon note is dropped from the composable, so walking out is '
     'never recorded',
     'src/composables/usePracticeSitting.ts',
     '            note(options.abandonedAs);',
     '            void options.abandonedAs;'),

    ('the abandon note moves BELOW the flush, where nothing can post it',
     'src/composables/usePracticeSitting.ts',
     '            note(options.abandonedAs);\n        }\n        monitor.value?.stop();',
     '        }\n        monitor.value?.stop();\n        note(options.abandonedAs || "");'),

    ('the interview never closes its sitting, so a finished one goes on '
     'accruing penalties for the life of the tab',
     'src/views/JobInterviewSession.vue',
     '  await sitting.complete();',
     '  void 0;'),

    ('the meeting never closes its sitting either',
     'src/views/ToastmastersSession.vue',
     '  await sitting.complete();',
     '  void 0;'),

    ('the interview stops declaring how an abandoned sitting is recorded',
     'src/views/JobInterviewSession.vue',
     "  abandonedAs: 'interview.left_early',",
     '  // abandonedAs removed',
     ),

    ('the spoken award stops being gated on the microphone, so it is payable '
     'by typing',
     'src/views/JobInterviewSession.vue',
     '  if (spokeThisAnswer\n'
     '      && countWords(spokenText, localeId.value) >= SPOKEN_WORD_FLOOR) {',
     '  if (spokenText) {'),

    ('the microphone flag is never set, so nothing can ever earn it',
     'src/views/JobInterviewSession.vue',
     '  spokeThisAnswer = true;\n',
     ''),

    ('the developer-tools detector is switched back on in the interview, '
     'where there is no answer key to read',
     'src/views/JobInterviewSession.vue',
     '  watch: { devtools: false, print: false, fullscreen: false },',
     '  watch: { print: false, fullscreen: false },'),

    ('the clipboard detector is switched off in the meeting, so a pasted '
     'speech is evaluated as one that was given',
     'src/views/ToastmastersSession.vue',
     '  watch: { devtools: false, print: false, fullscreen: false },',
     '  watch: { devtools: false, print: false, fullscreen: false, clipboard: false },'),
]


def run_check():
    result = subprocess.run(
        ['npm', 'run', 'check:practice'], cwd=ROOT, capture_output=True,
        text=True, shell=(os.name == 'nt'))
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
        io.open(full, 'w', encoding='utf-8', newline='\n').write(
            original.replace(before, after, 1))
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
            failed = [l.strip() for l in out.splitlines()
                      if l.strip().startswith('FAIL')]
            print('  ok  {}\n      {}'.format(name, failed[0][:110] if failed
                                              else '(failed)'))

    print('\n{} of {} mutations caught'.format(caught, len(MUTATIONS)))
    for name, why in missed:
        print('  MISSED  {} -- {}'.format(name, why))
    return 1 if missed else 0


if __name__ == '__main__':
    sys.exit(main())
