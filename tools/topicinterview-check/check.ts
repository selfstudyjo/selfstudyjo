// npm run check:topicinterview — the plain half of "Interview on this topic".
import {
  buildScope, clampPlan, fallbackQuestion, joinMaterial, scopeQuestionCount,
  MAX_TOPIC_QUESTIONS, MATERIAL_CHARS,
} from '../../src/utils/topicInterview';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
  if (!ok) { failures++; if (detail !== undefined) console.log('        ', detail); }
}

const lab = buildScope({ kind: 'lab', title: '  Linux permissions ', size: 6,
  parts: ['## chmod\nchmod changes modes', null, '', '## chown\nchown changes owners'] });
check('title is trimmed', lab.title === 'Linux permissions');
check('empty parts are dropped and headings kept', lab.material.startsWith('## chmod') && !lab.material.includes('\n\n\n'));
check('material is clipped to the limit', joinMaterial(['x'.repeat(MATERIAL_CHARS * 2)]).length <= MATERIAL_CHARS);
check('a 40-question exam asks at most five', scopeQuestionCount({ size: 40, material: '' }) === 5);
check('a 3-question quiz asks two', scopeQuestionCount({ size: 3, material: '' }) === 2);
check('a long lesson asks more than a short one',
  scopeQuestionCount({ material: 'w '.repeat(1200) }) > scopeQuestionCount({ material: 'w '.repeat(50) }));
const many = clampPlan(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'A'], lab, 'en');
check('a plan never exceeds five', many.length === MAX_TOPIC_QUESTIONS, many);
check('a plan is deduplicated case-insensitively', new Set(many.map(s => s.toLowerCase())).size === many.length);
const thin = clampPlan([], lab, 'en');
check('an empty plan is filled from the material headings', thin[0] === 'chmod' && thin.length >= 2, thin);
const ar = fallbackQuestion(lab, 'chmod', 0, 'ar');
check('the fallback question is in the chosen language and names the area', ar.includes('chmod') && /[؀-ۿ]/.test(ar), ar);
check('an unknown language falls back to English', fallbackQuestion(lab, 'x', 1, 'xx').startsWith('Walk me'));

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll topic interview checks passed.');
