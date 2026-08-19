// Verifies src/utils/proctorQueue.ts without a browser.
//
//   npm run check:proctorqueue
//
// The proctor dashboard's ordering model. It is checked here rather than by
// reading the screen because the two properties that matter are invariants over
// arbitrary input — every appointment appears in exactly one group, and none is
// lost — and those are exactly the properties you cannot see by looking at one
// proctor's list on one afternoon.
//
// The module is imported, not re-implemented. A check written against a second
// copy of the logic proves nothing about the first, which is the trap app 23's
// identity e2e fell into: its stub answered the same wrong endpoint the code did,
// so 8 checks passed against a validator that refused the entire happy path.

import {
    ATTENTION_LEAD_MS,
    ATTENTION_TRAIL_MS,
    LIVE_STATUSES,
    groupForProctor,
    isClosed,
    isLiveNow,
    isSameDay,
    needsAttention,
    primaryActionLabel,
    relativeWhen,
    type QueueRow,
} from '../../src/utils/proctorQueue';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

// A fixed "now", so the windows are being tested and not the clock.
const NOW = new Date('2026-08-19T12:00:00');
const H = 60 * 60 * 1000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

const row = (
    external_id: string, status: string, offsetMs: number, can_start = false,
): QueueRow => ({
    external_id, appointment_status: status,
    appointment_date: at(offsetMs), can_start,
});

console.log('\n1. Who is waiting on the proctor right now');
{
    check('an exam that started half an hour ago with nobody let in',
        needsAttention(row('a', 'Scheduled', -0.5 * H), NOW));
    check('and one starting in half an hour',
        needsAttention(row('b', 'Scheduled', +0.5 * H), NOW));
    check('a candidate already let in is not waiting on anybody',
        !needsAttention(row('c', 'Scheduled', -0.5 * H, true), NOW));

    // Both ends of the window, exactly. An off-by-one here is either an urgent
    // group that fills with history or one that misses the exam starting now.
    check('the trailing edge is inclusive',
        needsAttention(row('d', 'Scheduled', -ATTENTION_TRAIL_MS), NOW));
    check('and just past it is history, not attention',
        !needsAttention(row('e', 'Scheduled', -ATTENTION_TRAIL_MS - 1000), NOW));
    check('the leading edge is inclusive',
        needsAttention(row('f', 'Scheduled', +ATTENTION_LEAD_MS), NOW));
    check('and just past it is not yet urgent',
        !needsAttention(row('g', 'Scheduled', +ATTENTION_LEAD_MS + 1000), NOW));

    check('a Completed exam never needs attention',
        !needsAttention(row('h', 'Completed', -0.5 * H), NOW));
    check('nor a Cancelled one',
        !needsAttention(row('i', 'Cancelled', -0.5 * H), NOW));
    check('an unparseable date is not urgent rather than throwing',
        !needsAttention({ external_id: 'j', appointment_status: 'Scheduled',
                          appointment_date: 'not a date' }, NOW));
    check('every live status is treated as live',
        LIVE_STATUSES.every(status =>
            needsAttention(row('k', status, -0.5 * H), NOW)), LIVE_STATUSES);
}

console.log('\n2. The live marker asks a different question from attention');
{
    // A candidate who has been let in is no longer the proctor's to-do, but their
    // exam is very much in progress. Collapsing these two would either mark a
    // finished list live or drop the marker the moment somebody is let in.
    const letIn = row('a', 'Scheduled', -0.5 * H, true);
    check('a candidate already let in still shows as LIVE', isLiveNow(letIn, NOW));
    check('while not needing attention', !needsAttention(letIn, NOW));
    check('In Progress is always live regardless of its time',
        isLiveNow(row('b', 'In Progress', -100 * H), NOW));
    check('an exam four hours past is no longer live',
        !isLiveNow(row('c', 'Scheduled', -4 * H), NOW));
    check('and one tomorrow is not live yet',
        !isLiveNow(row('d', 'Scheduled', +24 * H), NOW));
    check('a Completed exam is never live',
        !isLiveNow(row('e', 'Completed', 0), NOW));
}

console.log('\n3. Grouping: the two invariants');
{
    const rows: QueueRow[] = [
        row('waiting-now', 'Scheduled', -0.5 * H),
        row('waiting-soon', 'Scheduled', +0.5 * H),
        row('already-let-in', 'Scheduled', -0.5 * H, true),
        row('later-today', 'Scheduled', +8 * H),
        row('un-approved-last-week', 'Scheduled', -30 * H),
        row('next-week', 'Scheduled', +24 * 7 * H),
        row('done', 'Completed', -48 * H),
        row('cancelled-future', 'Cancelled', +48 * H),
        row('no-reservation', 'No Reservation Yet', +48 * H),
    ];
    const groups = groupForProctor(rows, NOW);
    const where = (id: string) =>
        groups.filter(g => g.rows.some(r => r.external_id === id)).map(g => g.key);

    // THE invariant. Everything else here is a detail by comparison: a row in two
    // groups is a proctor double-counting their morning, and a row in none is an
    // exam nobody invigilates.
    check('every appointment appears in exactly one group',
        rows.every(r => where(r.external_id).length === 1),
        rows.map(r => [r.external_id, where(r.external_id)]));
    check('and the groups account for all of them',
        groups.reduce((n, g) => n + g.rows.length, 0) === rows.length,
        groups.map(g => [g.key, g.rows.length]));

    check('urgent wins over Today for the same appointment',
        where('waiting-now').join() === 'attention', where('waiting-now'));
    check('a candidate already let in falls through to Today',
        where('already-let-in').join() === 'today', where('already-let-in'));
    check('an exam later today is Today', where('later-today').join() === 'today',
        where('later-today'));
    check('one never approved last week is Past - nobody can act on it now',
        where('un-approved-last-week').join() === 'past',
        where('un-approved-last-week'));
    check('next week is Upcoming', where('next-week').join() === 'upcoming',
        where('next-week'));
    check('a Completed exam is Past', where('done').join() === 'past');
    check('a Cancelled FUTURE exam is Past, not Upcoming - it is not live',
        where('cancelled-future').join() === 'past', where('cancelled-future'));
    check('No Reservation Yet is a live status, so it is Upcoming',
        where('no-reservation').join() === 'upcoming', where('no-reservation'));

    console.log('\n4. Order within a group');
    const ids = (key: string) =>
        groups.find(g => g.key === key)?.rows.map(r => r.external_id) ?? [];
    const times = (key: string) =>
        groups.find(g => g.key === key)?.rows
            .map(r => new Date(r.appointment_date).getTime()) ?? [];
    const ascending = (xs: number[]) => xs.every((v, i) => i === 0 || xs[i - 1] <= v);
    const descending = (xs: number[]) => xs.every((v, i) => i === 0 || xs[i - 1] >= v);

    check('attention is ascending - the next one to deal with leads',
        ascending(times('attention')), ids('attention'));
    check('today is ascending', ascending(times('today')), ids('today'));
    check('upcoming is ascending', ascending(times('upcoming')), ids('upcoming'));
    check('past is DESCENDING - an archive leads with the most recent',
        descending(times('past')), ids('past'));

    console.log('\n5. Shape');
    check('groups are in urgency order, not time order',
        groups.map(g => g.key).join() === 'attention,today,upcoming,past',
        groups.map(g => g.key));
    check('every group has a title and a hint',
        groups.every(g => g.title.trim().length > 0 && g.hint.trim().length > 0));
    // -48H, not -1H: a Completed exam from THIS MORNING belongs in Today, and
    // deliberately so - a proctor looking at today wants the whole day including
    // what has finished. Only a different day makes it Past.
    check('an empty group is dropped rather than rendering a heading over nothing',
        groupForProctor([row('only', 'Completed', -48 * H)], NOW)
            .map(g => g.key).join() === 'past',
        groupForProctor([row('only', 'Completed', -48 * H)], NOW).map(g => g.key));
    check('and a finished exam from earlier TODAY still shows under Today',
        groupForProctor([row('this-morning', 'Completed', -4 * H)], NOW)
            .map(g => g.key).join() === 'today',
        groupForProctor([row('this-morning', 'Completed', -4 * H)], NOW).map(g => g.key));
    check('no appointments at all is no groups, not a crash',
        groupForProctor([], NOW).length === 0);
    check('the input array is never mutated',
        (() => {
            const original = [row('z', 'Scheduled', +H), row('y', 'Scheduled', -50 * H)];
            const before = original.map(r => r.external_id).join();
            groupForProctor(original, NOW);
            return original.map(r => r.external_id).join() === before;
        })());
}

console.log('\n5b. A closed appointment offers nothing to do');
{
    // Found in a screenshot: a Completed exam was rendering "Open and let in"
    // beside "Not yet allowed to start". Both are meaningless once an exam is over
    // - there is nothing left to permit - and together they read as the record
    // being in the wrong state, which invites a proctor to reopen a paper that has
    // already been marked.
    const done = row('a', 'Completed', -48 * H);
    const cancelled = row('b', 'Cancelled', +48 * H);
    const expired = row('c', 'Expired', -48 * H);
    const scheduled = row('d', 'Scheduled', +2 * H);
    const inProgress = row('e', 'In Progress', -H, true);

    check('a Completed appointment is closed', isClosed(done));
    check('so is a Cancelled one', isClosed(cancelled));
    check('and an Expired one', isClosed(expired));
    check('a Scheduled one is NOT closed', !isClosed(scheduled));
    check('nor is one In Progress', !isClosed(inProgress));

    check('a closed appointment offers "View details", never "let in"',
        primaryActionLabel(done) === 'View details', primaryActionLabel(done));
    check('and so do the cancelled and expired ones',
        primaryActionLabel(cancelled) === 'View details'
        && primaryActionLabel(expired) === 'View details');
    check('an open appointment nobody is let into yet says "Open and let in"',
        primaryActionLabel(scheduled) === 'Open and let in',
        primaryActionLabel(scheduled));
    check('and one already let in says "Manage"',
        primaryActionLabel(inProgress) === 'Manage', primaryActionLabel(inProgress));

    // `can_start` is reset when an exam ends, so it cannot be the test - a closed
    // appointment and one that has not started look identical through it.
    check('closed is decided by STATUS, not by can_start',
        isClosed(row('f', 'Completed', -H, true))
        && primaryActionLabel(row('f', 'Completed', -H, true)) === 'View details');

    check('every live status is treated as open',
        LIVE_STATUSES.every(st => !isClosed(row('g', st, 0))), LIVE_STATUSES);
}

console.log('\n6. Dates');
{
    check('isSameDay is a calendar comparison, not a 24-hour one',
        isSameDay(new Date('2026-08-19T00:01:00'), new Date('2026-08-19T23:59:00')));
    check('and midnight either side is a different day',
        !isSameDay(new Date('2026-08-19T23:59:00'), new Date('2026-08-20T00:01:00')));

    check('today reads as Today', relativeWhen(at(2 * H), NOW).startsWith('Today at'));
    check('tomorrow reads as Tomorrow',
        relativeWhen(at(24 * H), NOW).startsWith('Tomorrow at'));
    check('yesterday reads as Yesterday',
        relativeWhen(at(-24 * H), NOW).startsWith('Yesterday at'));
    check('anything further away names the weekday',
        /at /.test(relativeWhen(at(24 * 7 * H), NOW))
        && !/^(Today|Tomorrow|Yesterday)/.test(relativeWhen(at(24 * 7 * H), NOW)),
        relativeWhen(at(24 * 7 * H), NOW));
    // A bad timestamp must render as nothing rather than "Invalid Date", which is
    // what a user would otherwise read on the card.
    check('an unparseable date renders as empty, never "Invalid Date"',
        relativeWhen('nonsense', NOW) === '');
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
