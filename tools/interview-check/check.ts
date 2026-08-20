// Verifies src/utils/interviewSetup.ts without a browser.
//
//   npm run check:interview
//
// The Job Interview setup model: what a redo carries over, what the interviewer
// is told about the candidate, and which fallback question comes next. Checked
// here rather than by running an interview because all three properties are
// invariants over arbitrary input:
//
//   * no fallback question repeats inside one interview, at ANY attempt number;
//   * a redo's fallback questions differ from the sitting they redo;
//   * a CV digest fits its budget whatever CV it is given, and never cuts a
//     line in half.
//
// The module is imported, not re-implemented -- a check written against a
// second copy of the logic proves nothing about the first (app 23's identity
// e2e is the cautionary tale: its stub answered the same wrong endpoint the
// code did, so 8 checks passed against a validator that refused the entire
// happy path).

import {
    CV_DIGEST_LIMIT,
    HR_FALLBACKS,
    MAX_AVOID_QUESTIONS,
    MAX_MINUTES,
    MAX_QUESTIONS,
    MIN_MINUTES,
    MIN_QUESTIONS,
    askedQuestionsFrom,
    clampMinutes,
    cvDigest,
    cvLabel,
    fallbackQuestion,
    normaliseQuestion,
    normaliseType,
    questionCountFor,
    redoConfigFrom,
    techFallbacks,
    type DigestibleCv,
    type PastSession,
} from '../../src/utils/interviewSetup';
import {
    AUDIO_CONSTRAINTS,
    VIDEO_CONSTRAINTS,
    acquireInterviewMedia,
    classifyMediaError,
    describeMediaError,
    mediaUnsupportedReason,
} from '../../src/utils/mediaDevices';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

console.log('\n1. Duration and question count');
{
    check('a blank duration is the 15-minute default', clampMinutes(undefined) === 15);
    check('nonsense is the default, not NaN', clampMinutes('abc') === 15);
    check('below the floor clamps up', clampMinutes(1) === MIN_MINUTES);
    check('above the ceiling clamps down', clampMinutes(999) === MAX_MINUTES);

    check('the shortest interview is still worth four questions',
        questionCountFor(MIN_MINUTES) === MIN_QUESTIONS, questionCountFor(MIN_MINUTES));
    check('the longest is capped',
        questionCountFor(MAX_MINUTES) === MAX_QUESTIONS, questionCountFor(MAX_MINUTES));
    check('15 minutes is ten questions', questionCountFor(15) === 10, questionCountFor(15));

    // The pools have to be at least as long as the longest interview, or a
    // 60-minute sitting repeats a question with nothing having gone wrong.
    check('the HR pool covers the longest interview', HR_FALLBACKS.length >= MAX_QUESTIONS,
        HR_FALLBACKS.length);
    check('the technical pool covers it too', techFallbacks('DevOps').length >= MAX_QUESTIONS,
        techFallbacks('DevOps').length);
}

console.log('\n2. Interview type');
{
    check('HR is HR', normaliseType('HR') === 'HR');
    check('lowercase hr is HR', normaliseType('hr') === 'HR');
    check('anything else is Technical', normaliseType('Technical') === 'Technical');
    check('an absent type is Technical, not undefined', normaliseType(undefined) === 'Technical');
    check('a typo is Technical rather than a third state', normaliseType('H.R.') === 'Technical');
}

console.log('\n3. No fallback question repeats inside one interview');
{
    // The property the rotation stride exists for. An offset sharing a factor
    // with the pool length would pass at attempt 1 and fail at attempt 3.
    for (const type of ['Technical', 'HR']) {
        for (let attempt = 1; attempt <= 30; attempt++) {
            const asked = new Set<string>();
            for (let q = 1; q <= MAX_QUESTIONS; q++) {
                asked.add(fallbackQuestion(type, 'Python Developer', q, attempt));
            }
            check(`${type} attempt ${attempt}: ${MAX_QUESTIONS} distinct questions`,
                asked.size === MAX_QUESTIONS, { attempt, got: asked.size });
            if (attempt >= 3 && asked.size === MAX_QUESTIONS) break; // three is enough to print
        }
    }
}

console.log('\n4. A redo asks something else');
{
    // The whole point of the feature on the day the AI is unreachable.
    const first = fallbackQuestion('Technical', 'DevOps', 1, 1);
    const second = fallbackQuestion('Technical', 'DevOps', 1, 2);
    check('attempt 2 opens with a different question', first !== second, { first, second });

    // And the rotation walks the entire pool before coming back, rather than
    // alternating between two of them.
    const openings = new Set<string>();
    for (let attempt = 1; attempt <= MAX_QUESTIONS; attempt++) {
        openings.add(fallbackQuestion('HR', '', 1, attempt));
    }
    check('twelve attempts give twelve distinct openings',
        openings.size === MAX_QUESTIONS, openings.size);

    check('it is a pure function -- a reload mid-interview gets the same question',
        fallbackQuestion('Technical', 'DevOps', 3, 4) === fallbackQuestion('Technical', 'DevOps', 3, 4));
    check('a missing attempt behaves as attempt 1',
        fallbackQuestion('HR', '', 2) === fallbackQuestion('HR', '', 2, 1));
    check('attempt 0 does not fall off the front of the pool',
        typeof fallbackQuestion('HR', '', 1, 0) === 'string' && !!fallbackQuestion('HR', '', 1, 0));
    check('a blank topic still reads as a question',
        fallbackQuestion('Technical', '', 1, 1).includes('this field'));
}

console.log('\n5. Which questions a redo is told to avoid');
{
    const sessions: PastSession[] = [
        {
            interview_type: 'Technical', topic: 'DevOps', created_at: '2026-08-01T10:00:00Z',
            qa_pairs: [{ question: 'What is CI/CD?' }, { question: 'Explain blue-green deploys.' }],
        },
        {
            interview_type: 'Technical', topic: 'DevOps', created_at: '2026-08-10T10:00:00Z',
            qa_pairs: [{ question: 'What is CI/CD?  ' }, { question: 'How do you monitor a fleet?' }],
        },
        {
            interview_type: 'HR', topic: 'DevOps', created_at: '2026-08-11T10:00:00Z',
            qa_pairs: [{ question: 'Tell me about yourself.' }],
        },
        {
            interview_type: 'Technical', topic: 'Frontend', created_at: '2026-08-12T10:00:00Z',
            qa_pairs: [{ question: 'What is the virtual DOM?' }],
        },
    ];

    const avoid = askedQuestionsFrom(sessions, { type: 'Technical', topic: 'DevOps' });
    check('only the same type and topic count', avoid.length === 3, avoid);
    check('an HR sitting does not filter a technical one',
        !avoid.some(q => q.includes('yourself')), avoid);
    check('another role does not either',
        !avoid.some(q => q.includes('virtual DOM')), avoid);
    check('the same question asked twice appears once',
        avoid.filter(q => q.trim() === 'What is CI/CD?').length === 1, avoid);
    check('newest sitting first', avoid[0] === 'What is CI/CD?' || avoid[0] === 'How do you monitor a fleet?',
        avoid[0]);

    // Punctuation and case are what the AI varies when it repeats itself.
    check('trailing space is not a different question',
        normaliseQuestion('What is CI/CD?  ') === normaliseQuestion('what is ci cd'));
    check('punctuation is not a different question',
        normaliseQuestion('Tell me about yourself!') === normaliseQuestion('Tell me about yourself'));
    check('two genuinely different questions stay different',
        normaliseQuestion('What is CI?') !== normaliseQuestion('What is CD?'));

    const many: PastSession[] = [{
        interview_type: 'Technical', topic: 'DevOps', created_at: '2026-08-01T10:00:00Z',
        qa_pairs: Array.from({ length: 100 }, (_, i) => ({ question: `Question number ${i}?` })),
    }];
    check('the list is capped so it cannot eat the prompt budget',
        askedQuestionsFrom(many, { type: 'Technical', topic: 'DevOps' }).length === MAX_AVOID_QUESTIONS);
    check('an empty history is an empty list, not a throw',
        askedQuestionsFrom(undefined, { type: 'HR', topic: '' }).length === 0);
    check('a session with no questions is skipped',
        askedQuestionsFrom([{ interview_type: 'HR', topic: '', qa_pairs: null }],
            { type: 'HR', topic: '' }).length === 0);
}

console.log('\n6. What a redo carries over');
{
    const past: PastSession = {
        interview_type: 'Technical',
        topic: 'DevOps Engineer',
        qualifications: '5+ years Linux, Bash, Terraform',
        planned_minutes: 20,
        attempt: 2,
        cv_id: 'cv-123',
        cv_title: 'DevOps CV',
        cv_summary: 'Candidate: Mahmoud — DevOps Engineer',
        created_at: '2026-08-10T10:00:00Z',
    };
    const cfg = redoConfigFrom(past, { interviewer: 'sara', avoidQuestions: ['What is CI/CD?'] });

    check('the role carries over', cfg.topic === 'DevOps Engineer');
    check('the requirements carry over -- the whole point',
        cfg.qualifications === '5+ years Linux, Bash, Terraform');
    check('the duration carries over', cfg.minutes === 20);
    check('the attached CV carries over', cfg.cvId === 'cv-123' && !!cfg.cvSummary);
    check('the attempt number advances', cfg.attempt === 3, cfg.attempt);
    check('the caller decides who conducts it', cfg.interviewer === 'sara');
    check('the avoid list travels with it', cfg.avoidQuestions?.length === 1);

    // A session stored before any of this existed.
    const legacy = redoConfigFrom({ interview_type: 'HR', topic: 'HR / General' });
    check('a session with no attempt number redoes as attempt 2', legacy.attempt === 2, legacy.attempt);
    check('a session with no duration gets the default', legacy.minutes === 15, legacy.minutes);
    check('no CV stays no CV', legacy.cvId === undefined && legacy.cvSummary === undefined);
    check('an HR redo keeps its topic label', legacy.topic === 'HR / General');

    const blankTechnical = redoConfigFrom({ interview_type: 'Technical', topic: '' });
    check('a technical redo with no topic is left blank for the form to catch',
        blankTechnical.topic === '');

    check('an over-long avoid list is capped on the way in',
        redoConfigFrom(past, { avoidQuestions: Array.from({ length: 90 }, (_, i) => `q${i}`) })
            .avoidQuestions?.length === MAX_AVOID_QUESTIONS);
    check('the duration can be overridden', redoConfigFrom(past, { minutes: 45 }).minutes === 45);
    check('an overridden duration is still clamped', redoConfigFrom(past, { minutes: 900 }).minutes === MAX_MINUTES);
}

console.log('\n7. The CV the interviewer is handed');
{
    const cv: DigestibleCv = {
        title: 'DevOps CV',
        personal: {
            full_name: 'Mahmoud Alqudah',
            headline: 'Senior DevOps Engineer',
            summary: 'Eight years building and running Linux platforms.',
            location: 'Amman, Jordan',
        },
        experience: [{
            role: 'DevOps Engineer', company: 'Acme', start: '2021', current: true,
            bullets: ['Cut deploy time from 40m to 6m', 'Ran the on-call rota', 'Owned the Terraform estate',
                      'A fourth bullet that should be dropped'],
            tech: ['Terraform', 'AWS'],
        }, {
            role: 'Sysadmin', company: 'Beta Ltd', start: '2018', end: '2021',
            description: 'Looked after 200 Linux hosts.',
        }],
        skills: [{ category: 'Cloud', items: ['AWS', 'GCP'] }, { category: 'Empty', items: [] }],
        education: [{ degree: 'BSc', field: 'Computer Science', institution: 'JU', start: '2014', end: '2018' }],
        projects: [{ name: 'Fleet ping', description: 'Hourly health sweep', tech: ['Airflow'] }],
        certifications: [{ name: 'AWS SAA' }, { name: 'CKA' }],
        languages: [{ name: 'Arabic', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    };

    const digest = cvDigest(cv);
    check('the candidate is named', digest.includes('Mahmoud Alqudah'));
    check('the headline is there', digest.includes('Senior DevOps Engineer'));
    check('roles are there with their dates', digest.includes('DevOps Engineer at Acme'), digest.slice(0, 200));
    check('a current role reads as present', digest.includes('present'));
    check('bullets are capped at three per role',
        !digest.includes('A fourth bullet that should be dropped'));
    check('a role with no bullets falls back to its description',
        digest.includes('Looked after 200 Linux hosts.'));
    check('skills are there', digest.includes('AWS, GCP'));
    check('a skill group with no items is skipped', !digest.includes('Empty'));
    check('education is there', digest.includes('Computer Science'));
    check('certifications are there', digest.includes('AWS SAA, CKA'));
    check('languages are there', digest.includes('Arabic (Native)'));

    // Nothing contactable belongs in a prompt.
    const withContact = cvDigest({
        ...cv,
        personal: { ...cv.personal, full_name: 'Mahmoud Alqudah' },
    });
    check('no email address reaches the prompt', !/@/.test(withContact), withContact);

    check('an absent CV is an empty string, not a throw', cvDigest(null) === '');
    check('an empty CV is an empty string', cvDigest({}) === '');
    check('a CV with only a name still says something', cvDigest({ personal: { full_name: 'A' } }).length > 0);

    // The budget, and the line boundary.
    const huge: DigestibleCv = {
        personal: { full_name: 'Big CV', summary: 'x'.repeat(400) },
        experience: Array.from({ length: 40 }, (_, i) => ({
            role: `Role ${i}`, company: `Company ${i}`, start: '2010', end: '2011',
            bullets: ['y'.repeat(120), 'z'.repeat(120), 'w'.repeat(120)],
        })),
    };
    const capped = cvDigest(huge);
    check('a huge CV is cut to the budget', capped.length <= CV_DIGEST_LIMIT, capped.length);
    check('and it is actually near it rather than empty', capped.length > CV_DIGEST_LIMIT / 2, capped.length);

    // Every line that survived must be a line the builder produced whole.
    const wholeLines = cvDigest(huge, 1000).split('\n');
    const allWhole = wholeLines.every(line => {
        if (line.startsWith('  · ')) {
            const body = line.slice(4);
            return body === 'y'.repeat(120) || body === 'z'.repeat(120) || body === 'w'.repeat(120);
        }
        return true;
    });
    check('truncation drops whole lines, never half a sentence', allWhole,
        wholeLines[wholeLines.length - 1]);

    check('a tiny budget is honoured', cvDigest(cv, 200).length <= 200, cvDigest(cv, 200).length);
    check('a tiny budget still returns whole lines',
        cvDigest(cv, 200).split('\n').every(l => l.length > 0));
}

console.log('\n8. Saying accurately why a device did not start');
{
    // The reported bug: a machine with a working microphone and no usable
    // camera was told "Camera/microphone permission denied: Requested device
    // not found" -- and permission HAD been granted, so the message sent the
    // user to the one setting that could not possibly help.
    const notFound = { name: 'NotFoundError', message: 'Requested device not found' };
    check('a missing device is not classified as a refusal',
        classifyMediaError(notFound) === 'missing', classifyMediaError(notFound));
    check('and the sentence does not mention permission at all',
        !/permission|denied|blocked/i.test(describeMediaError(notFound, 'camera')),
        describeMediaError(notFound, 'camera'));
    check('it says the device was not found',
        /no camera was found/i.test(describeMediaError(notFound, 'camera')));
    check('and names where to look for it',
        /privacy/i.test(describeMediaError(notFound, 'camera')));
    // Chrome's raw message is what used to be appended after the words
    // "permission denied", and is what made the report read as a contradiction.
    check('the raw driver message is never relayed',
        !describeMediaError(notFound, 'camera').includes('Requested device not found'));

    check('a real refusal IS a refusal',
        classifyMediaError({ name: 'NotAllowedError' }) === 'denied');
    check('and points at the padlock',
        /padlock/i.test(describeMediaError({ name: 'NotAllowedError' }, 'microphone')));

    check('a device held by another app is `busy`',
        classifyMediaError({ name: 'NotReadableError' }) === 'busy');
    check('and names the applications to close',
        /Zoom|Teams/i.test(describeMediaError({ name: 'NotReadableError' }, 'camera')));

    check('over-tight constraints are their own case',
        classifyMediaError({ name: 'OverconstrainedError' }) === 'constraints');
    check('the older Chrome spellings are understood',
        classifyMediaError({ name: 'PermissionDeniedError' }) === 'denied'
        && classifyMediaError({ name: 'DevicesNotFoundError' }) === 'missing'
        && classifyMediaError({ name: 'TrackStartError' }) === 'busy');
    check('an unrecognised error is `unknown`, not silently a refusal',
        classifyMediaError({ name: 'WhoKnowsError' }) === 'unknown');
    check('and still produces a usable sentence',
        describeMediaError({ name: 'WhoKnowsError' }, 'microphone').length > 40);
    check('null does not throw', typeof describeMediaError(null, 'microphone') === 'string');
    check('the microphone and the camera are worded differently',
        describeMediaError(notFound, 'microphone') !== describeMediaError(notFound, 'camera'));

    // An insecure origin hides navigator.mediaDevices entirely, so there is no
    // exception to classify -- it reads as an unsupported browser.
    check('an insecure origin is diagnosed as such',
        /https/i.test(mediaUnsupportedReason({}, false, 'http://192.168.1.5:3000')));
    check('and the origin is named',
        mediaUnsupportedReason({}, false, 'http://192.168.1.5:3000').includes('192.168.1.5'));
    check('a secure origin with no API blames the browser instead',
        /browser/i.test(mediaUnsupportedReason({}, true)));
    check('a working browser reports nothing',
        mediaUnsupportedReason({ mediaDevices: { getUserMedia: () => {} } }, true) === '');

    // Two separate constraint objects, because they are two separate
    // getUserMedia calls -- and that split is the whole fix.
    check('video is asked for as ideal, never exact',
        !JSON.stringify(VIDEO_CONSTRAINTS).includes('exact')
        && JSON.stringify(VIDEO_CONSTRAINTS).includes('ideal'));
    check('audio asks for echo cancellation',
        JSON.stringify(AUDIO_CONSTRAINTS).includes('echoCancellation'));
    check('the two are separate, so neither call can fail the other',
        JSON.stringify(AUDIO_CONSTRAINTS) !== JSON.stringify(VIDEO_CONSTRAINTS));
}

console.log('\n9. A camera fault must never cost the microphone');
{
    // THE bug, reproduced: a machine with a working microphone whose camera is
    // absent. Asked for together, the single getUserMedia call rejects and the
    // interview cannot start; asked for separately, the mic survives.
    const notFound = Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' });
    const calls: MediaStreamConstraints[] = [];
    const noCamera = async (c: MediaStreamConstraints) => {
        calls.push(c);
        if (c.video) throw notFound;
        return 'MIC' as unknown as MediaStream;
    };

    const got = await acquireInterviewMedia(noCamera);
    check('the microphone is still acquired', got.audio === ('MIC' as unknown), got.audio);
    check('nothing blocks the interview', got.micError === '', got.micError);
    check('there is no camera', got.video === null);
    check('and the reason is recorded for the tile', got.cameraError.length > 0);
    check('the reason does not claim permission was denied',
        !/permission|denied/i.test(got.cameraError), got.cameraError);

    // The ordering, which is the property that makes the above true.
    check('two calls were made, not one', calls.length === 2, calls.length);
    check('the microphone was asked for first', !!calls[0].audio && !calls[0].video, calls[0]);
    check('and the camera on its own afterwards', !!calls[1].video && !calls[1].audio, calls[1]);

    // A camera that is present but held by Zoom -- the other common cause.
    const busy = Object.assign(new Error('Could not start video source'), { name: 'NotReadableError' });
    const cameraBusy = await acquireInterviewMedia(async (c: MediaStreamConstraints) => {
        if (c.video) throw busy;
        return 'MIC' as unknown as MediaStream;
    });
    check('a busy camera also leaves the microphone working', cameraBusy.audio !== null);
    check('and says which applications to close',
        /Zoom|Teams/i.test(cameraBusy.cameraError), cameraBusy.cameraError);

    // Both present: the ordinary case must still work.
    const both = await acquireInterviewMedia(async (c: MediaStreamConstraints) =>
        (c.video ? 'CAM' : 'MIC') as unknown as MediaStream);
    check('with both devices, both are returned',
        both.audio === ('MIC' as unknown) && both.video === ('CAM' as unknown));
    check('and nothing is reported', both.micError === '' && both.cameraError === '');

    // No microphone: this one DOES block, and must say so.
    const micCalls: MediaStreamConstraints[] = [];
    const noMic = await acquireInterviewMedia(async (c: MediaStreamConstraints) => {
        micCalls.push(c);
        throw notFound;
    });
    check('a missing microphone blocks', noMic.audio === null && noMic.micError.length > 0);
    check('and the camera is not even attempted -- there is nothing to run',
        micCalls.length === 1, micCalls.length);
    check('no camera error is invented for it', noMic.cameraError === '', noMic.cameraError);

    // A refused microphone is the one case that really is a permission problem.
    const denied = await acquireInterviewMedia(async () => {
        throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    });
    check('a refused microphone says so, and points at the padlock',
        /padlock/i.test(denied.micError), denied.micError);
}

console.log('\n10. The CV picker label');
{
    check('title and headline', cvLabel({ title: 'DevOps CV', headline: 'SRE' }) === 'DevOps CV — SRE');
    check('falls back to the name', cvLabel({ title: 'CV', full_name: 'Mahmoud' }) === 'CV — Mahmoud');
    check('title alone', cvLabel({ title: 'CV' }) === 'CV');
    check('an untitled CV is named, not blank', cvLabel({}) === 'Untitled CV');
    check('nothing is an empty string', cvLabel(null) === '');
}

console.log(failures === 0
    ? '\n✅ interviewSetup: all checks passed\n'
    : `\n❌ interviewSetup: ${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
