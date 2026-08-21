// Type-checks the Job Interview feature, and nothing else.
//
//   npm run check:jitypes
//
// `vue-tsc` is not clean on this repo (51 errors elsewhere as of 2026-08-20)
// and is deliberately not part of `build`, so nothing was type-checking these
// files at all. That cost a production bug of the worst kind — silent, and
// invisible to every other check:
//
//     if (!audioStream) { resolve(); return; }          // module-level stream
//     const audioTracks = audioStream.getAudioTracks();
//     const audioStream = new MediaStream(audioTracks); // shadows it, same scope
//
// A `const` puts the whole function body in its temporal dead zone, so both
// reads above threw "Cannot access 'audioStream' before initialization" on
// every 3-second chunk. The build succeeded, every unit check passed, and the
// only symptom was the transcript box sitting on "Listening…" for ever.
// TypeScript calls it TS2448 and would have refused it outright.
//
// So: run the whole project (types need it) and fail on errors in these files
// only. Gating on the other 51 would be a check somebody switches off.

import { spawnSync } from 'node:child_process';

/** Everything the Job Interview feature is made of. */
const OWNED = [
    'src/views/JobInterview',                       // the four views
    'src/components/jobinterview/',
    'src/services/jobinterview.service.ts',
    'src/utils/interviewSetup.ts',
    'src/utils/mediaDevices.ts',
    'src/utils/answerEditing.ts',
];

/**
 * Errors that are always a runtime bug, wherever they are.
 *
 * TS2448 and TS2454 are the two that produce a throw rather than a wrong type,
 * so they are worth failing on across the whole repo — if one appears in a file
 * nobody has touched, that file was already broken.
 */
const ALWAYS_FATAL = /error (TS2448|TS2454)\b/;

const run = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vue-tsc', '--noEmit', '-p', 'tsconfig.json'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
);

const lines = `${run.stdout || ''}\n${run.stderr || ''}`
    .split(/\r?\n/)
    .filter(l => /error TS\d+/.test(l));

const normalise = s => s.replace(/\\/g, '/');
const mine = lines.filter(l => OWNED.some(f => normalise(l).includes(f)));
const fatal = lines.filter(l => ALWAYS_FATAL.test(l) && !mine.includes(l));

console.log(`\nvue-tsc: ${lines.length} error(s) in the project, `
    + `${mine.length} in the Job Interview feature\n`);

for (const line of [...mine, ...fatal]) console.log(`  FAIL  ${line.trim()}`);

if (mine.length === 0 && fatal.length === 0) {
    console.log('  ok    no type errors in the Job Interview feature');
    console.log('  ok    no use-before-declaration anywhere in the project');
    console.log('\n✅ jitypes: all checks passed\n');
    process.exit(0);
}
console.log(`\n❌ jitypes: ${mine.length + fatal.length} error(s)\n`);
process.exit(1);
