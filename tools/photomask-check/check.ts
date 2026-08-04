import {
  BUSY_BACKGROUND_SPREAD, boxBlur, floodFillBackground, protectRegion, sampleBorder, shade,
} from '../../src/components/cvbuilder/photoMask';

const W = 200, H = 200;
let failures = 0;
function check(label: string, ok: boolean, detail: any = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
  if (!ok) failures++;
}

/** A synthetic headshot: uniform wall, dark head-and-shoulders subject. */
function makePortrait(bg: [number, number, number], noise = 0) {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      // subject: head circle + shoulders ellipse, both well inside the frame
      const head = ((x - 100) ** 2) / 38 ** 2 + ((y - 82) ** 2) / 46 ** 2 <= 1;
      const shoulders = ((x - 100) ** 2) / 74 ** 2 + ((y - 205) ** 2) / 90 ** 2 <= 1;
      const subject = head || shoulders;
      const jitter = noise ? Math.round((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * noise) : 0;
      px[i]     = subject ? 190 : Math.max(0, Math.min(255, bg[0] + jitter));
      px[i + 1] = subject ? 150 : Math.max(0, Math.min(255, bg[1] + jitter));
      px[i + 2] = subject ? 120 : Math.max(0, Math.min(255, bg[2] + jitter));
      px[i + 3] = 255;
    }
  }
  return px;
}

const at = (a: Uint8Array, x: number, y: number) => a[y * W + x];

console.log('\n1. Plain wall behind the subject');
{
  const px = makePortrait([240, 240, 240]);
  const { reference, spread } = sampleBorder(px, W, H);
  check('border median found the wall', reference.every(c => Math.abs(c - 240) <= 1), reference);
  check('a plain wall is not flagged as busy', spread < BUSY_BACKGROUND_SPREAD, spread.toFixed(2));

  const alpha = floodFillBackground(px, W, H, reference, 44, 0.5);
  check('corners are replaced', at(alpha, 1, 1) === 0 && at(alpha, W - 2, 1) === 0);
  check('wall beside the head is replaced', at(alpha, 8, 82) === 0, at(alpha, 8, 82));
  check('the face is kept', at(alpha, 100, 82) === 255, at(alpha, 100, 82));
  check('the shoulders are kept', at(alpha, 100, 170) === 255, at(alpha, 100, 170));

  let removed = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] === 0) removed++;
  check('a sensible share of the frame was replaced',
        removed / alpha.length > 0.3 && removed / alpha.length < 0.85,
        (removed / alpha.length).toFixed(3));
}

console.log('\n2. The protection guarantee holds at any tolerance');
{
  const px = makePortrait([240, 240, 240]);
  const { reference } = sampleBorder(px, W, H);
  for (const tolerance of [0, 60, 140, 255, 1e6]) {
    const alpha = floodFillBackground(px, W, H, reference, tolerance, 0.5);
    const region = protectRegion(W, H, 0.5);
    let violated = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x - region.centreX) / region.radiusX;
        const dy = (y - region.centreY) / region.radiusY;
        if (dx * dx + dy * dy <= 1 && at(alpha, x, y) !== 255) violated++;
      }
    }
    check(`tolerance ${tolerance}: nothing inside the protected zone is removed`,
          violated === 0, violated);
  }
}

console.log('\n3. Tolerance 0 changes nothing');
{
  const px = makePortrait([240, 240, 240]);
  const { reference } = sampleBorder(px, W, H);
  const alpha = floodFillBackground(px, W, H, reference, 0, 0.5);
  const kept = alpha.every(v => v === 255);
  // The border pixels equal the reference exactly, so distance 0 <= 0 matches.
  const removed = alpha.reduce((n, v) => n + (v === 0 ? 1 : 0), 0);
  check('only exact-match pixels go', kept || removed > 0, { kept, removed });
  check('the face survives', at(alpha, 100, 82) === 255);
}

console.log('\n4. A wall-coloured patch on the shirt is not punched out');
{
  const px = makePortrait([240, 240, 240]);
  // A logo the same colour as the wall, fully enclosed by the subject.
  for (let y = 150; y < 170; y++) for (let x = 92; x < 112; x++) {
    const i = (y * W + x) * 4;
    px[i] = 240; px[i + 1] = 240; px[i + 2] = 240;
  }
  const { reference } = sampleBorder(px, W, H);
  const alpha = floodFillBackground(px, W, H, reference, 44, 0.2);
  check('the enclosed patch is kept (flood fill cannot reach it)',
        at(alpha, 100, 160) === 255, at(alpha, 100, 160));
}

console.log('\n5. A busy background is detected and reported');
{
  const px = makePortrait([120, 140, 160], 150);
  const { spread } = sampleBorder(px, W, H);
  check('busy background flagged', spread > BUSY_BACKGROUND_SPREAD, spread.toFixed(2));
}

console.log('\n6. Feathering softens the edge');
{
  const px = makePortrait([240, 240, 240]);
  const { reference } = sampleBorder(px, W, H);
  const alpha = floodFillBackground(px, W, H, reference, 44, 0.5);
  const hardValues = new Set(Array.from(alpha));
  boxBlur(alpha, W, H, 3);
  const softValues = new Set(Array.from(alpha));
  check('before blur the mask is binary', hardValues.size === 2, [...hardValues]);
  check('after blur there is a ramp', softValues.size > 8, softValues.size);
  check('the face is still fully opaque', at(alpha, 100, 82) === 255, at(alpha, 100, 82));
  check('the far corner is still fully transparent', at(alpha, 0, 0) === 0, at(alpha, 0, 0));
}

console.log('\n7. Degenerate inputs do not throw');
{
  const tiny = new Uint8ClampedArray(4 * 4 * 4).fill(255);
  const { reference } = sampleBorder(tiny, 4, 4);
  const alpha = floodFillBackground(tiny, 4, 4, reference, 44, 0.5);
  boxBlur(alpha, 4, 4, 3);
  check('a 4x4 uniform image is handled', alpha.length === 16);
  check('shade() clamps', shade('#FFFFFF', 0.5) === '#ffffff' && shade('#000000', -0.5) === '#000000',
        [shade('#FFFFFF', 0.5), shade('#000000', -0.5)]);
  check('shade() darkens', shade('#F1F5F9', -0.22) !== '#f1f5f9', shade('#F1F5F9', -0.22));
  check('shade() survives junk', typeof shade('nonsense', -0.2) === 'string', shade('nonsense', -0.2));
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall photo mask checks passed');
