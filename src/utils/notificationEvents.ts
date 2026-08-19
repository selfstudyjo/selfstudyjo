// src/utils/notificationEvents.ts
//
// Every notification this platform sends, in one place.
//
// Before this file, a notification was written wherever somebody happened to be
// standing: `Notifications.vue` composed the payment ones inline, the payment
// request built a five-line template string in `notification.service.ts`, and
// nothing else sent any at all. Three consequences, all of which this fixes:
//
// 1. **Nobody could answer "what does this platform notify about?"** — the only
//    way to find out was to grep for `createNotification` and read the call
//    sites. Which is also why so few actions had one: adding a notification
//    meant inventing a wording, a category and a destination on the spot.
// 2. **A `link` was invisible to every client but this one.** The way to attach
//    a destination was `notificationMeta.ts`, which appends a JSON blob inside
//    an HTML comment to the message text — so the admin console rendered the
//    comment, and any other reader saw it too. App 16 has first-class
//    `category` / `event` / `link` / `priority` fields now, and this catalogue
//    is what fills them.
// 3. **Wordings drifted.** "Payment Approved" and "Your payment was approved"
//    for the same event, from two places.
//
// It is a **plain module** — no Vue, no Pinia, no router, no service imports —
// for the same reason `appNav.ts`, `photoMask.ts`, `drawEngine.ts`,
// `chatMedia.ts` and `linkify.ts` are: `npm run check:notifyevents` runs the
// whole catalogue through node in about a second and fails the build on a
// placeholder nothing fills, a link the router cannot match, or a category the
// UI has no icon for. A wording bug in a notification is invisible until it is
// in front of a user, and by then it has been sent.
//
// **There is a second copy of this catalogue**, in
// `selfstudyadmin/utils/notify.py`. There is no shared package on this platform
// (working rule 10) and the console is a Python app, so the events an operator
// sends are duplicated there rather than imported. When that repo happens to be
// checked out beside this one — which it is in the `SelfStudy Apps` workspace —
// the check script reads it and fails on a key the two disagree about; when it
// is not, it says so and skips. A check that silently passes because a file was
// missing is worse than no check.

/** What the notification is about. The UI picks an icon and a colour from this. */
export type NotificationCategory =
    | 'system'
    | 'account'
    | 'course'
    | 'homework'
    | 'exam'
    | 'certificate'
    | 'payment'
    | 'subscription'
    | 'runbook'
    | 'research'
    | 'lab'
    | 'proctor'
    | 'ai'
    | 'drawing'
    | 'message';

export const CATEGORIES: NotificationCategory[] = [
    'system', 'account', 'course', 'homework', 'exam', 'certificate',
    'payment', 'subscription', 'runbook', 'research', 'lab', 'proctor',
    'ai', 'drawing', 'message',
];

/**
 * Categories with no event of their own, deliberately, and why.
 *
 * `ai`, `drawing`, `message` — apps 27, 34 and 35 create notifications from
 * their **own** backends (`selfstudydraw/utils/notify.py` on a share,
 * `selfstudyuserchat/utils/notify.py` once per quiet room), so nothing in this
 * catalogue sends them and nothing here can. They arrive with no `category`
 * today; these are the chips waiting for the day those services set one.
 *
 * `lab` — access to the sandboxes is `lab_feature` on a subscription, so
 * `subscription.activated` already says it. A second notification for the same
 * fact is how a bell teaches people to stop reading it.
 *
 * Listed rather than deleted so the "every category is used" check can pass
 * honestly instead of being weakened, and so the reason survives.
 */
export const RESERVED_CATEGORIES: NotificationCategory[] = ['ai', 'drawing', 'message', 'lab'];

/**
 * Which side creates an event.
 *
 * `app` is selfstudyjo, `console` is selfstudyadmin, `service` is a backend
 * emitting on its own. It is checkable rather than documentary:
 * `npm run check:notifyevents` fails when a `console` event is missing from
 * `selfstudyadmin/utils/notify.py`, when a `service` event is missing from
 * `selfstudyexam/utils/notify.py`, and when an `app` event is in this file but
 * nothing in `src/` ever sends it. A catalogue entry nobody sends is worse than
 * no entry — it reads like a feature that exists.
 *
 * `service` exists because until 2026-08-19 every notification on this platform
 * came from a *client*, so anything that happens with no browser present was
 * silent — which is exactly the events a student cannot see happening. A
 * certificate is now issued automatically by app 20 the moment somebody passes,
 * and nobody clicked anything to cause it. Marking such an event `app` would be
 * a lie the check would catch (nothing under `src/` sends it); leaving it out of
 * the catalogue would put its wording back at the call site, which is what
 * working rule 14 exists to prevent.
 */
export type Sender = 'app' | 'console' | 'service';

/**
 * How loudly to render it, and nothing else — nothing suppresses a notification
 * by priority. `urgent` is reserved for something the user loses money or access
 * over if they ignore it.
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export const PRIORITIES: NotificationPriority[] = ['low', 'normal', 'high', 'urgent'];

/** Who an event is aimed at. Only documentation — the caller names recipients. */
export type Audience = 'user' | 'operator';

export interface NotificationEventSpec {
    /** `app.action`, and it is stored on the record as `event`. Never reword one
     *  of these: it is the machine key a client may be filtering on. */
    key: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    /** Who reads it. */
    audience: Audience;
    /** Who creates it. Checked, not documentary — see `Sender`. */
    sentBy: Sender[];
    /** Every `{placeholder}` used below, so the check can prove they are filled. */
    params: string[];
    title: string;
    message: string;
    /** Where the "View" button goes. Must be a path the router can match. */
    link?: string;
}

/**
 * The catalogue.
 *
 * Grouped by the application the event comes from, which is also the order the
 * admin console lists them in. Keep an entry's wording short: the bell renders
 * two lines before it clips, and a notification nobody finishes reading is a
 * notification that did not work.
 *
 * **What does NOT get an entry**, because the rule "notify on important actions"
 * is only half a rule without it:
 *
 * - anything the user just did themselves and is still looking at. Enrolling in
 *   a course does not need a notification saying you enrolled in a course.
 * - anything that happens per message, per stroke, per keystroke. App 35 already
 *   learned this: it notifies once per quiet room, not once per message
 *   (`selfstudyuserchat/utils/notify.py`), and app 34 notifies on a share and
 *   never on an edit.
 * - anything an operator does that a user cannot act on. A record being
 *   reindexed is not news.
 */
export const NOTIFICATION_EVENTS: Record<string, NotificationEventSpec> = {
    // -- Courses (app 19) ---------------------------------------------------
    'course.homework_added': {
        key: 'course.homework_added',
        category: 'homework',
        priority: 'high',
        audience: 'user',
        sentBy: ['console'],
        params: ['course', 'homework', 'courseId'],
        title: 'New homework in {course}',
        message: '{homework} has been added to {course}. Open the course to see what is due.',
        link: '/course/{courseId}',
    },
    'course.lesson_added': {
        key: 'course.lesson_added',
        category: 'course',
        priority: 'normal',
        audience: 'user',
        sentBy: ['console'],
        params: ['course', 'lesson', 'courseId'],
        title: 'New lesson in {course}',
        message: '{lesson} is now available in {course}.',
        link: '/course/{courseId}',
    },
    'course.homework_submitted': {
        key: 'course.homework_submitted',
        category: 'homework',
        priority: 'normal',
        audience: 'operator',
        sentBy: ['app'],
        params: ['student', 'homework', 'course', 'courseId'],
        title: 'Homework submitted',
        message: '{student} submitted "{homework}" for {course} and it is waiting to be marked.',
        link: '/course/{courseId}',
    },
    // There is no `course.homework_graded`, and the reason is the data model
    // rather than a decision: app 19's submitted-homework record has no grade
    // field, so nothing marks anything and there is no moment to fire on. Add
    // the event the same day that field exists — and not before, because an
    // entry here that nothing can send reads like a feature.
    // There is deliberately no `course.comment_reply`. Notifying every previous
    // commenter on every reply is how a busy course thread becomes a reason to
    // switch notifications off; a reply that is *for* somebody names them, and
    // `course.mentioned` covers that.
    'course.mentioned': {
        key: 'course.mentioned',
        category: 'course',
        priority: 'high',
        audience: 'user',
        sentBy: ['app'],
        params: ['author', 'course', 'courseId', 'excerpt'],
        title: '{author} mentioned you',
        message: '{author} mentioned you in {course}: "{excerpt}"',
        link: '/course/{courseId}',
    },
    'course.enrolled': {
        key: 'course.enrolled',
        category: 'course',
        priority: 'normal',
        audience: 'operator',
        sentBy: ['app'],
        params: ['student', 'course', 'courseId'],
        title: 'New enrolment',
        message: '{student} enrolled in {course}.',
        link: '/course/{courseId}',
    },

    // -- Exams (app 20) and proctoring (app 21) -----------------------------
    //
    // There is deliberately NO `exam.appointment_requested`. It existed, was sent
    // to every admin when a student booked, and was wrong in three ways at once:
    //
    //  * it asked for an approval that booking does not need. A booked appointment
    //    is booked; what still has to happen is the proctor opening the room on the
    //    day, which is `can_start` and is a different moment with a different
    //    notification (`exam.appointment_approved`).
    //  * its link was a bare `/exam-approval` with no `appointmentId`, and that
    //    page cannot render without one - so the notification led to a dead end.
    //  * `/exam-approval` is the STUDENT's view of their own appointment. The
    //    proctor's screen is `/proctor-dashboard`. Because the proctor on this
    //    platform is also an admin, they received this one as well as their own
    //    correct notification - two bells for one booking, and the wrong one sent
    //    them to a student's page that then failed to load.
    //
    // The proctor already gets `proctor.appointment_assigned` (below), sent by
    // `exam.service.ts` inside `createExamAppointment`, which says what happened
    // and points at `/proctor-dashboard`. That is the whole of "just notify the
    // proctor".
    // There is deliberately no separate "your proctor let you in" event. This one
    // covers both edges - an operator approving the booking (console) and the
    // proctor flipping can_start on the day (app, from ProctorExamAppointment.vue)
    // - and a second event for the same moment would be two bells for one thing.
    'exam.appointment_approved': {
        key: 'exam.appointment_approved',
        category: 'exam',
        priority: 'high',
        audience: 'user',
        sentBy: ['app', 'console'],
        params: ['exam', 'when'],
        // Wording matched to selfstudyadmin/utils/notify.py, character for
        // character. This event has two senders - the proctor flipping can_start
        // and an operator approving from the console - so it must not describe
        // either one of them, and the two copies must not drift.
        title: 'Your exam is approved',
        message: 'You are approved to sit {exam} on {when}. Be ready a few minutes early.',
        // Deliberately `/exams` and not the appointment page: the console sends
        // this one too and does not know the appointment id, and an event whose
        // link only works for one of its two senders is worse than a general one.
        // `/exams` carries a Start button for a cleared appointment anyway.
        link: '/exams',
    },
    'exam.appointment_rejected': {
        key: 'exam.appointment_rejected',
        category: 'exam',
        priority: 'high',
        audience: 'user',
        sentBy: ['console'],
        params: ['exam', 'reason'],
        title: 'Your exam appointment was not approved',
        message: 'Your request to sit {exam} was not approved. {reason}',
        link: '/schedule-exam',
    },
    'exam.submitted': {
        key: 'exam.submitted',
        category: 'exam',
        priority: 'normal',
        audience: 'operator',
        sentBy: ['app'],
        params: ['student', 'exam', 'score'],
        title: 'Exam submitted',
        message: '{student} finished {exam} with a score of {score}.',
        link: '/all-certificates',
    },
    'exam.result_published': {
        key: 'exam.result_published',
        category: 'exam',
        priority: 'high',
        audience: 'user',
        sentBy: ['app'],
        params: ['exam', 'outcome'],
        title: 'Your exam result is ready',
        message: 'Your result for {exam} is available: {outcome}.',
        link: '/my-results',
    },
    'proctor.appointment_assigned': {
        key: 'proctor.appointment_assigned',
        category: 'proctor',
        priority: 'high',
        audience: 'user',
        sentBy: ['app'],
        params: ['student', 'exam', 'when'],
        title: 'You are proctoring an exam',
        message: '{student} booked {exam} with you on {when}.',
        link: '/proctor-dashboard',
    },
    'proctor.appointment_rescheduled': {
        key: 'proctor.appointment_rescheduled',
        category: 'proctor',
        priority: 'high',
        audience: 'user',
        sentBy: ['app'],
        params: ['student', 'exam', 'when'],
        title: 'An exam you are proctoring moved',
        message: '{student} moved {exam} to {when}.',
        link: '/proctor-dashboard',
    },
    'proctor.appointment_cancelled': {
        key: 'proctor.appointment_cancelled',
        category: 'proctor',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: ['student', 'exam', 'when'],
        title: 'An exam you were proctoring was cancelled',
        message: '{student} cancelled {exam}, which was set for {when}.',
        link: '/proctor-dashboard',
    },

    // The link carries the appointmentId because `/exam-approval` is meaningless
    // without one - it is a single appointment's page, and it answers "No
    // appointment specified" when the query parameter is missing. Every link on
    // this page's events is built the same way.
    'exam.appointment_booked': {
        key: 'exam.appointment_booked',
        category: 'exam',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: ['exam', 'when', 'proctor', 'appointmentId'],
        title: 'Exam appointment booked',
        message: 'You are booked to sit {exam} on {when} with {proctor}. Your proctor will open the room at the scheduled time.',
        link: '/exam-approval?appointmentId={appointmentId}',
    },
    'exam.appointment_rescheduled': {
        key: 'exam.appointment_rescheduled',
        category: 'exam',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: ['exam', 'when', 'appointmentId'],
        title: 'Exam appointment moved',
        message: 'Your appointment to sit {exam} is now {when}.',
        link: '/exam-approval?appointmentId={appointmentId}',
    },
    'exam.appointment_cancelled': {
        key: 'exam.appointment_cancelled',
        category: 'exam',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: ['exam', 'when'],
        title: 'Exam appointment cancelled',
        message: 'Your appointment to sit {exam} on {when} has been cancelled. You can book another time.',
        link: '/schedule-exam',
    },
    // The one reminder on the platform. It fires from the Exams page rather than
    // from a scheduler, because nothing here has one (working rule 18) - so it is
    // deduped per appointment per window, or it would re-send on every page load.
    'exam.starting_soon': {
        key: 'exam.starting_soon',
        category: 'exam',
        priority: 'urgent',
        audience: 'user',
        sentBy: ['app'],
        params: ['exam', 'when'],
        title: 'Your exam starts soon',
        message: '{exam} starts at {when}. Be ready a few minutes early and check your room link.',
        link: '/exams',
    },
    'exam.appointment_expired': {
        key: 'exam.appointment_expired',
        category: 'exam',
        priority: 'high',
        audience: 'user',
        sentBy: ['service'],
        params: ['exam', 'when'],
        title: 'An exam appointment expired',
        message: 'Your appointment to sit {exam} on {when} passed without the exam being started. You can book another time.',
        link: '/schedule-exam',
    },
    'proctor.candidate_entered': {
        key: 'proctor.candidate_entered',
        category: 'proctor',
        priority: 'normal',
        audience: 'user',
        sentBy: ['service'],
        params: ['student', 'exam', 'when'],
        title: 'A candidate entered the exam room',
        message: '{student} started {exam} at {when}.',
        link: '/proctor-dashboard',
    },
    'proctor.appointment_expired': {
        key: 'proctor.appointment_expired',
        category: 'proctor',
        priority: 'normal',
        audience: 'user',
        sentBy: ['service'],
        params: ['student', 'exam', 'when'],
        title: 'An exam you were proctoring expired',
        message: '{student} did not sit {exam}, which was set for {when}.',
        link: '/proctor-dashboard',
    },
    'proctor.exam_submitted': {
        key: 'proctor.exam_submitted',
        category: 'proctor',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: ['student', 'exam', 'score'],
        title: 'A candidate finished their exam',
        message: '{student} submitted {exam} and scored {score}.',
        link: '/proctor-dashboard',
    },

    // -- Certificates (app 24) ---------------------------------------------
    // Both senders, and the second one is new: an operator still issues a course
    // certificate by hand from the console, and app 20 now issues an EXAM
    // certificate on its own the moment somebody passes - see
    // selfstudyexam/utils/certificates.py. The wording has to serve both, so it
    // does not claim who issued it.
    'certificate.issued': {
        key: 'certificate.issued',
        category: 'certificate',
        priority: 'high',
        audience: 'user',
        sentBy: ['console', 'service'],
        params: ['title'],
        title: 'You earned a certificate',
        message: 'Your certificate for {title} has been issued. You can view and download it now.',
        link: '/certificates',
    },
    'certificate.revoked': {
        key: 'certificate.revoked',
        category: 'certificate',
        priority: 'urgent',
        audience: 'user',
        sentBy: ['console'],
        params: ['title', 'reason'],
        title: 'A certificate was withdrawn',
        message: 'Your certificate for {title} has been withdrawn. {reason}',
        link: '/certificates',
    },

    // -- Payments (app 23) --------------------------------------------------
    'payment.request_submitted': {
        key: 'payment.request_submitted',
        category: 'payment',
        priority: 'urgent',
        audience: 'operator',
        sentBy: ['app'],
        params: ['student', 'plan', 'amount', 'paymentId'],
        title: 'New payment request',
        message: '{student} submitted a payment of JOD {amount} for {plan}. Reference {paymentId}. Approve or ignore it below.',
        link: '/notifications',
    },
    'payment.approved': {
        key: 'payment.approved',
        category: 'payment',
        priority: 'high',
        audience: 'user',
        sentBy: ['app', 'console'],
        params: ['plan', 'amount'],
        title: 'Payment approved',
        message: 'Your payment of JOD {amount} for {plan} has been verified. Your subscription is active.',
        link: '/my-plans',
    },
    'payment.rejected': {
        key: 'payment.rejected',
        category: 'payment',
        priority: 'urgent',
        audience: 'user',
        sentBy: ['app', 'console'],
        params: ['plan', 'amount', 'reason'],
        title: 'Payment not approved',
        message: 'Your payment of JOD {amount} for {plan} was not approved. {reason}',
        link: '/payment',
    },
    'payment.expiring': {
        key: 'payment.expiring',
        category: 'payment',
        priority: 'high',
        audience: 'user',
        sentBy: ['console'],
        params: ['plan', 'days'],
        title: 'Payment request expires soon',
        message: 'Your pending payment for {plan} expires in {days} days. Complete the transfer to keep it.',
        link: '/payment',
    },

    // -- Subscriptions (app 22) --------------------------------------------
    // Both send this one, and they are not competing: the console sends it when
    // an operator activates a paid plan, the app when a new account's 7-day free
    // trial is created at email verification (`subscription.service.ts`). One
    // subscription becoming active is one bell either way.
    'subscription.activated': {
        key: 'subscription.activated',
        category: 'subscription',
        priority: 'high',
        audience: 'user',
        sentBy: ['app', 'console'],
        params: ['plan', 'until'],
        title: 'Your subscription is active',
        message: 'The {plan} plan is now active on your account until {until}.',
        link: '/my-plans',
    },
    'subscription.extended': {
        key: 'subscription.extended',
        category: 'subscription',
        priority: 'high',
        audience: 'user',
        sentBy: ['console'],
        params: ['plan', 'until'],
        title: 'Your subscription was extended',
        message: 'The {plan} plan on your account now runs until {until}.',
        link: '/my-plans',
    },
    // The frontend sends this one and the console sends `expired`. That split is
    // in `subscription.service.ts` — a warning is worth most when it reaches
    // somebody before the date, and the person's own browsing is a far more
    // reliable trigger than an operator happening to open a screen.
    'subscription.expiring': {
        key: 'subscription.expiring',
        category: 'subscription',
        priority: 'urgent',
        audience: 'user',
        sentBy: ['app'],
        params: ['plan', 'days'],
        title: 'Your subscription expires soon',
        message: 'The {plan} plan expires in {days} days. Renew it to keep access to your tools.',
        link: '/plans',
    },
    'subscription.expired': {
        key: 'subscription.expired',
        category: 'subscription',
        priority: 'urgent',
        audience: 'user',
        sentBy: ['console'],
        params: ['plan'],
        title: 'Your subscription has expired',
        message: 'The {plan} plan has expired and the features it covered are no longer available.',
        link: '/plans',
    },

    // -- Runbooks (app 17) --------------------------------------------------
    'runbook.published': {
        key: 'runbook.published',
        category: 'runbook',
        priority: 'normal',
        audience: 'user',
        sentBy: ['console'],
        params: ['title'],
        title: 'New runbook: {title}',
        message: '{title} has been published and is available to read now.',
        link: '/runbooks',
    },
    'runbook.updated': {
        key: 'runbook.updated',
        category: 'runbook',
        priority: 'low',
        audience: 'user',
        sentBy: ['console'],
        params: ['title', 'runbookId'],
        title: '{title} was updated',
        message: 'The runbook {title} has been revised.',
        link: '/runbooks/{runbookId}',
    },

    // -- Research Flow (app 28) ---------------------------------------------
    'research.collaboration_invite': {
        key: 'research.collaboration_invite',
        category: 'research',
        priority: 'high',
        audience: 'user',
        sentBy: ['app'],
        params: ['inviter', 'project', 'role', 'projectId'],
        title: 'You were added to a research project',
        message: '{inviter} added you to {project} as {role}.',
        link: '/research/project/{projectId}',
    },
    'research.collaboration_accepted': {
        key: 'research.collaboration_accepted',
        category: 'research',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: ['researcher', 'project', 'projectId'],
        title: '{researcher} joined your project',
        message: '{researcher} accepted your invitation to {project}.',
        link: '/research/project/{projectId}',
    },
    'research.project_comment': {
        key: 'research.project_comment',
        category: 'research',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: ['author', 'project', 'projectId'],
        title: 'New comment on {project}',
        message: '{author} commented on {project}.',
        link: '/research/project/{projectId}',
    },
    'research.ai_draft_ready': {
        key: 'research.ai_draft_ready',
        category: 'research',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: ['title', 'draftId'],
        title: 'Your AI draft is ready',
        message: 'The draft for {title} has finished generating.',
        link: '/research/ai-writer/{draftId}',
    },
    'research.new_researcher': {
        key: 'research.new_researcher',
        category: 'research',
        priority: 'low',
        audience: 'operator',
        sentBy: ['app'],
        params: ['researcher', 'field'],
        title: 'New researcher profile',
        message: '{researcher} created a researcher profile in {field}.',
        link: '/research/researchers',
    },

    // Nothing for the labs (app 11): access is `lab_feature` on a subscription,
    // so `subscription.activated` already says it. A second notification for the
    // same fact is how a bell teaches people to stop reading it.

    // Nothing for the Toastmasters or job-interview sessions (app 27): both put
    // their report on screen as soon as the session ends and neither has a
    // "later" — the report is the last step of the thing you were already doing.

    // -- Account (apps 13, 14, 15) ------------------------------------------
    'account.welcome': {
        key: 'account.welcome',
        category: 'account',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: ['name'],
        title: 'Welcome to Self Study, {name}',
        message: 'Your account is ready. Browse the courses, or pick a plan to unlock the tools.',
        link: '/courses',
    },
    'account.email_verified': {
        key: 'account.email_verified',
        category: 'account',
        priority: 'normal',
        audience: 'user',
        sentBy: ['app'],
        params: [],
        title: 'Your email is verified',
        message: 'Thanks — your email address is confirmed and your account is fully active.',
        link: '/profile',
    },
    'account.password_changed': {
        key: 'account.password_changed',
        category: 'account',
        priority: 'urgent',
        audience: 'user',
        sentBy: ['app'],
        params: ['when'],
        title: 'Your password was changed',
        message: 'The password on your account was changed on {when}. If that was not you, contact support immediately.',
        link: '/profile',
    },

    // -- Platform ------------------------------------------------------------
    'system.announcement': {
        key: 'system.announcement',
        category: 'system',
        priority: 'normal',
        audience: 'user',
        sentBy: ['console'],
        params: ['subject', 'detail'],
        title: '{subject}',
        message: '{detail}',
    },
    'system.maintenance': {
        key: 'system.maintenance',
        category: 'system',
        priority: 'high',
        audience: 'user',
        sentBy: ['console'],
        params: ['when', 'detail'],
        title: 'Scheduled maintenance',
        message: 'The platform will be unavailable on {when}. {detail}',
    },
};

export const EVENT_KEYS = Object.keys(NOTIFICATION_EVENTS);

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

/** Every `{name}` in a template, in order, without duplicates. */
export function placeholdersIn(template: string): string[] {
    return [...new Set([...template.matchAll(PLACEHOLDER)].map(m => m[1]))];
}

/**
 * Fill a template.
 *
 * A missing value renders as the placeholder's own name rather than as
 * `undefined` or an empty gap: "New homework in course" is wrong and obvious,
 * "New homework in undefined" is wrong and looks like a crash, and "New homework
 * in " looks like the course has no name. The check script is what stops any of
 * the three reaching a user — this is only the fallback.
 */
export function fill(template: string, params: Record<string, unknown> = {}): string {
    return template.replace(PLACEHOLDER, (_match, name: string) => {
        const value = params[name];
        if (value === undefined || value === null || value === '') return name;
        return String(value);
    });
}

export interface BuiltNotification {
    title: string;
    message: string;
    category: NotificationCategory;
    event: string;
    link: string;
    priority: NotificationPriority;
}

/**
 * One event plus its parameters, as the fields app 16 stores.
 *
 * Returns `null` for a key that is not in the catalogue rather than throwing:
 * the caller is almost always inside a `try` around a user action that has
 * already succeeded, and a typo in an event key must not turn "your payment was
 * approved" into a red error box.
 */
export function buildNotification(
    key: string,
    params: Record<string, unknown> = {}
): BuiltNotification | null {
    const spec = NOTIFICATION_EVENTS[key];
    if (!spec) return null;
    return {
        title: fill(spec.title, params),
        message: fill(spec.message, params),
        category: spec.category,
        event: spec.key,
        link: spec.link ? fill(spec.link, params) : '',
        priority: spec.priority,
    };
}

/**
 * The icon name for a category, from the set `SideNav.vue` already draws.
 *
 * Here rather than in the component so the check can prove every category has
 * one — a category with no icon renders as a blank square, which reads as a
 * broken notification rather than as a missing mapping.
 */
export const CATEGORY_ICONS: Record<NotificationCategory, string> = {
    system: 'notifications',
    account: 'profile',
    course: 'courses',
    homework: 'write',
    exam: 'exams',
    certificate: 'certificate',
    payment: 'plans',
    subscription: 'myPlans',
    runbook: 'runbooks',
    research: 'research',
    lab: 'lab',
    proctor: 'proctor',
    ai: 'ai',
    drawing: 'draw',
    message: 'messages',
};
