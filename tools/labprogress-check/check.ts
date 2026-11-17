/**
 * npm run check:labprogress - track progress, its colour, the lab to resume,
 * and Previous / Next inside a track.
 */
import { labNeighbours, progressHue, resumePoint, trackPercent,
  type LabProgress, type LabSummary, type LabTrack } from '../../src/utils/labCatalogue';

let failed = 0;
let passed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) { passed += 1; return; }
  failed += 1;
  console.log(`  FAIL  ${label}`, detail === undefined ? '' : JSON.stringify(detail));
}

const lab = (id: string, track: string, order: number) =>
  ({ id, track, order, title: id, difficulty: 'beginner' } as unknown as LabSummary);
const row = (lab_id: string, track: string, status: LabProgress['status'], last: string, score = 0) =>
  ({ lab_id, track, status, last_active: last, score, tasks_done: [], earned: 0, possible: 0,
     attempts: 1, completed_at: '' } as LabProgress);

const tracks = [{ id: 'linux', order: 1, title: 'Linux', labs: 3 }, { id: 'docker', order: 2, title: 'Docker', labs: 2 }] as unknown as LabTrack[];
const labs = [lab('l1', 'linux', 1), lab('l2', 'linux', 2), lab('l3', 'linux', 3),
  lab('d1', 'docker', 1), lab('d2', 'docker', 2)];

console.log('\n1. Percent and colour');
check('nothing started is 0%', trackPercent(labs.slice(0, 3), []) === 0);
check('one of three completed is 33%', trackPercent(labs.slice(0, 3), [row('l1', 'linux', 'completed', 'a')]) === 33);
check('a lab in progress counts by its score', trackPercent(labs.slice(0, 3),
  [row('l1', 'linux', 'in_progress', 'a', 60)]) === 20);
check('an in-progress lab never reads as complete', trackPercent([labs[0]],
  [row('l1', 'linux', 'in_progress', 'a', 100)]) < 100);
check('every lab completed is 100%', trackPercent(labs.slice(3),
  [row('d1', 'docker', 'completed', 'a'), row('d2', 'docker', 'completed', 'b')]) === 100);
check('0% is red', progressHue(0) === 0);
check('the hue only rises (red -> orange -> yellow -> green)',
  [0, 20, 40, 60, 80, 100].map(progressHue).every((h, i, a) => i === 0 || h > a[i - 1]));
check('100% is green', progressHue(100) >= 120);

console.log('\n2. Resume');
check('a new student starts at the first lab', resumePoint(tracks, labs, [])?.lab.id === 'l1'
  && resumePoint(tracks, labs, [])?.reason === 'start');
check('the most recent unfinished lab is continued', resumePoint(tracks, labs, [
  row('l1', 'linux', 'completed', '2026-01-01'), row('d1', 'docker', 'in_progress', '2026-01-03')])?.lab.id === 'd1');
const next = resumePoint(tracks, labs, [row('l1', 'linux', 'completed', '2026-01-02')]);
check('after finishing a lab, the next one in that track', next?.lab.id === 'l2' && next.reason === 'next', next);
check('a finished track moves on to an unfinished one', resumePoint(tracks, labs, [
  row('d1', 'docker', 'completed', 'a'), row('d2', 'docker', 'completed', 'b')])?.lab.id === 'l1');
check('everything done is null', resumePoint(tracks, labs, labs.map((l, i) =>
  row(l.id, l.track, 'completed', String(i)))) === null);

console.log('\n3. Previous / Next');
const middle = labNeighbours(labs, 'l2');
check('the middle lab has both', middle.previous?.id === 'l1' && middle.next?.id === 'l3'
  && middle.index === 1 && middle.total === 3);
check('the first has no previous', labNeighbours(labs, 'l1').previous === null);
check('the last has no next, and never crosses into another track', labNeighbours(labs, 'l3').next === null
  && labNeighbours(labs, 'd1').previous === null);
check('an unknown lab has nothing', labNeighbours(labs, 'zz').total === 0);

console.log(`\ncheck:labprogress: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
