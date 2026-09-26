/**
 * Dump the Network Simulator's curriculum as JSON, for translation.
 *
 *   npm run netsim:extract   ->  ../_i18n/netsim.en.json
 *
 * WHY THIS IS A BUILD RATHER THAN A REGEX. `src/netsim/lessons.ts` builds each
 * lesson with positional arguments to a local `L(...)` helper, so the prose is
 * not in named fields and an extractor written as a regex would have to model
 * that call signature -- and would silently drop a lesson the day somebody
 * added an argument. Importing the module means the extractor sees exactly what
 * the app sees.
 *
 * The output is keyed to match `src/netsim/i18n/index.ts`'s catalogue shape
 * exactly, so the translated file can be dropped in beside it with no mapping
 * step. TASKS ARE KEYED ON TASK ID and everything else positional -- see the
 * note on `overlayLesson`.
 *
 * `commands[].cmd` is deliberately absent from the output: a command is copied,
 * never translated, so it is never offered to a translator in the first place.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LESSONS, TRACKS } from '@/netsim/lessons';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../../_i18n/netsim.en.json');

const lessons: Record<string, unknown> = {};
for (const lesson of LESSONS) {
    const entry: Record<string, unknown> = {
        title: lesson.title,
        subtitle: lesson.subtitle,
        theory: lesson.theory,
        objectives: lesson.objectives,
    };
    if (lesson.keyTerms?.length) {
        entry.keyTerms = lesson.keyTerms.map(r => ({ term: r.term, meaning: r.meaning }));
    }
    if (lesson.commands?.length) {
        entry.commands = lesson.commands.map(r => ({ explain: r.explain }));
    }
    if (lesson.tasks?.length) {
        const tasks: Record<string, unknown> = {};
        for (const task of lesson.tasks) {
            tasks[task.id] = task.hint
                ? { text: task.text, hint: task.hint }
                : { text: task.text };
        }
        entry.tasks = tasks;
    }
    if (lesson.quiz?.length) {
        entry.quiz = lesson.quiz.map(r => ({ q: r.q, options: r.options, why: r.why }));
    }
    lessons[lesson.id] = entry;
}

const tracks: Record<string, unknown> = {};
for (const track of TRACKS) {
    const row: Record<string, unknown> = { title: track.title, subtitle: track.subtitle };
    const blurb = (track as { blurb?: string }).blurb;
    if (blurb) row.blurb = blurb;
    tracks[track.id] = row;
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ lessons, tracks }, null, 1), 'utf8');

const chars = JSON.stringify({ lessons, tracks }).length;
console.log('netsim curriculum: %d lessons, %d tracks, %d chars of JSON',
            Object.keys(lessons).length, Object.keys(tracks).length, chars);
console.log('wrote %s', out);
