// Verifies the pure half of src/components/userchat/chatMedia.ts without a browser.
//
//   npm run check:chatmedia
//
// `prepareImage` and `startRecording` need a canvas and a microphone and are not
// checkable here. What *is* checkable is the arithmetic they are built on, and it
// is the arithmetic that goes quietly wrong:
//
// * `fitWithin` decides the dimensions every uploaded picture ends up with. An
//   off-by-one there means an image comes back one pixel over the limit the
//   backend then judges it against, and the symptom is an upload that fails for
//   some photos and not others.
// * `shouldUseReencoded` decides whether the compression is *kept*. Get it wrong
//   in one direction and every screenshot is uploaded at ten times its size; get
//   it wrong in the other and a resized photo is discarded in favour of the 4 MB
//   original. Neither shows an error.
// * `humanSize` and `formatDuration` are read by a person on every upload and
//   every voice note.

import {
    bestRecordingMime, fitWithin, formatDuration, humanSize, shouldUseReencoded,
    MAX_IMAGE_EDGE,
} from '../../src/components/userchat/chatMedia';

let failures = 0;

function check(label: string, ok: boolean, detail: any = '') {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
    if (!ok) failures++;
}

console.log('\n1. Fitting a picture inside the long-edge limit');
{
    const landscape = fitWithin(4032, 3024);
    check('a phone photo is scaled to the limit on its long edge',
          landscape.width === MAX_IMAGE_EDGE, landscape);
    check('and keeps its aspect ratio',
          Math.abs(landscape.width / landscape.height - 4032 / 3024) < 0.01, landscape);
    check('and is marked as scaled', landscape.scaled);

    const portrait = fitWithin(3024, 4032);
    check('a portrait photo is limited on its height, not its width',
          portrait.height === MAX_IMAGE_EDGE && portrait.width < MAX_IMAGE_EDGE, portrait);

    const small = fitWithin(800, 600);
    check('a small picture is left alone',
          small.width === 800 && small.height === 600 && !small.scaled, small);

    const exact = fitWithin(MAX_IMAGE_EDGE, 900);
    check('a picture exactly at the limit is not touched', !exact.scaled, exact);

    // The off-by-one. One pixel over must come back at or under the limit, never
    // at limit+1 - the backend judges the result against the same number.
    const justOver = fitWithin(MAX_IMAGE_EDGE + 1, 400);
    check('one pixel over the limit comes back at or under it',
          justOver.width <= MAX_IMAGE_EDGE, justOver);
    check('and never rounds up past it',
          fitWithin(3201, 1000).width <= MAX_IMAGE_EDGE, fitWithin(3201, 1000));

    // Degenerate inputs: a canvas of zero width throws, so neither side may be 0.
    check('a zero dimension never produces a zero-sized canvas',
          fitWithin(0, 0).width >= 1 && fitWithin(0, 0).height >= 1, fitWithin(0, 0));
    check('an extreme panorama keeps at least one pixel of height',
          fitWithin(20000, 3).height >= 1, fitWithin(20000, 3));
}

console.log('\n2. Deciding whether to keep the re-encoded copy');
{
    // The ordinary case: a big photo, scaled, and much smaller afterwards.
    check('a scaled photo that got smaller is kept',
          shouldUseReencoded(4_000_000, 220_000, true));

    // A resized picture is worth keeping even at a similar byte count, because the
    // *pixels* are what every replica and the mirror carry from then on.
    check('a scaled picture at about the same size is still kept',
          shouldUseReencoded(200_000, 205_000, true));

    // But not at any price - a resize that tripled the bytes is not a win.
    check('a scaled picture that ballooned is discarded',
          !shouldUseReencoded(200_000, 600_000, true));

    // Not resized: only worth replacing if the encode actually won something.
    // This is the flat-colour chart case - PNG stores it in kilobytes and JPEG
    // cannot.
    check('an unscaled picture that got bigger is discarded',
          !shouldUseReencoded(14_000, 120_000, false));
    check('an unscaled picture that got smaller is kept',
          shouldUseReencoded(300_000, 180_000, false));
    check('an exact tie on an unscaled picture keeps the original',
          !shouldUseReencoded(100_000, 100_000, false));
}

console.log('\n3. What a person reads');
{
    check('bytes', humanSize(512) === '512 B', humanSize(512));
    check('kilobytes', humanSize(2048) === '2 KB', humanSize(2048));
    check('megabytes, to one decimal', humanSize(3_500_000) === '3.3 MB',
          humanSize(3_500_000));
    check('the boundary does not read as "1024 KB"',
          humanSize(1024 * 1024) === '1.0 MB', humanSize(1024 * 1024));

    check('a short voice note', formatDuration(7_000) === '0:07', formatDuration(7_000));
    check('seconds are zero-padded', formatDuration(65_000) === '1:05',
          formatDuration(65_000));
    check('a long one', formatDuration(605_000) === '10:05', formatDuration(605_000));
    check('zero is not blank', formatDuration(0) === '0:00', formatDuration(0));
    // A recorder that has not started yet reports a negative elapsed time on some
    // clocks; "-1:-3" on screen is worse than "0:00".
    check('a negative duration clamps rather than rendering nonsense',
          formatDuration(-500) === '0:00', formatDuration(-500));
}

console.log('\n4. Recording format selection');
{
    // No MediaRecorder in node, which is the same situation as a browser too old
    // to have one. It has to answer '' rather than throwing, because the caller
    // uses that to fall back to a WAV the backend will resample.
    check('a environment with no MediaRecorder returns an empty string, not a throw',
          bestRecordingMime() === '', bestRecordingMime());

    // With one, the smallest supported container wins.
    (globalThis as any).MediaRecorder = {
        isTypeSupported: (type: string) => type === 'audio/mp4',
    };
    check('Safari falls through to audio/mp4', bestRecordingMime() === 'audio/mp4',
          bestRecordingMime());

    (globalThis as any).MediaRecorder = {
        isTypeSupported: (type: string) =>
            type === 'audio/webm;codecs=opus' || type === 'audio/webm' || type === 'audio/mp4',
    };
    check('Opus in WebM is preferred where it exists',
          bestRecordingMime() === 'audio/webm;codecs=opus', bestRecordingMime());
    delete (globalThis as any).MediaRecorder;
}

console.log();
if (failures) {
    console.log(`${failures} failed`);
    process.exit(1);
}
console.log('All checks passed.');
