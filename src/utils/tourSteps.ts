/**
 * The guided tour: what each page is, in order, and where the label goes.
 *
 * A plain module - no Vue, no DOM, no service imports - for the same reason as
 * `photoMask.ts`, `drawEngine.ts`, `leaderboardEngine.ts`, `labCatalogue.ts` and
 * `practiceIntegrity.ts`: everything decidable without a browser lives here so
 * `npm run check:tour` can drive it in node, and every mistake below is one
 * nobody can see in a screenshot.
 *
 * WHAT IS ACTUALLY HARD ABOUT A TOUR, WHICH IS NOT THE COPY
 *
 * Four things, and all four fail silently:
 *
 *  1. **A step whose target is not on the page.** Half the screens here render
 *     conditionally - signed out, no subscription, still loading, empty - so a
 *     selector that matched yesterday matches nothing today. A tour that points
 *     at nothing is worse than no tour, because the reader assumes the thing
 *     being described is somewhere they cannot see. Every step carries a LIST
 *     of selectors and a step that resolves none of them is SKIPPED, and
 *     `stepsFor` guarantees at least one step that needs no target at all, so
 *     the tour can never come out empty.
 *  2. **A label that lands on top of the thing it is labelling.** The whole
 *     point is the pairing of a box, a line and a caption; a caption covering
 *     the box is a tour explaining a rectangle the reader cannot see.
 *     `placeCard` tries four placements and only then clamps.
 *  3. **A label off the edge of the screen.** At 320px almost nothing has room
 *     beside it, so the fallback has to be "inside the viewport, wherever that
 *     is" rather than "beside the target, off the screen".
 *  4. **A step order that changes between renders.** The steps are read inside
 *     a computed; anything derived from a Set or an object's key order would
 *     reshuffle mid-tour and move Next under the reader's cursor.
 *
 * WHY THE CHAPTER IS CHOSEN BY PATH AND NOT BY COMPONENT
 *
 * A component name is not a thing a reader can be pointed at, and the same
 * component serves several routes (`/tools`, `/tools/linux`). The path is what
 * the router already resolves and what the sidebar already matches on, so the
 * two agree by construction. Matching is longest-prefix and SEGMENT AWARE for
 * the reason `appNav.ts` gives: a bare `startsWith` gets `/courses` and
 * `/course/:id` the wrong way round, and both exist here.
 *
 * THE STRINGS ARE ENGLISH CATALOGUE KEYS
 *
 * Every title and body is spent as `$t(step.title)` - through a variable, so no
 * source file contains the literal and `check:i18n`'s orphan scan would report
 * all of them. `TOUR_KEYS` is exported and DERIVED by walking the chapters, so
 * a step added without its Arabic and Chinese fails the check rather than
 * rendering an English sentence in the middle of an Arabic tour.
 */

/* ------------------------------------------------------------------ *
 * The model
 * ------------------------------------------------------------------ */

/** Where the caption sits relative to the thing it describes. */
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface TourStep {
    /** Stable, and unique within its chapter. Used as the render key. */
    id: string;
    /**
     * CSS selectors, tried in order; the first that resolves is the target.
     *
     * A list rather than one, because these are other files' class names and
     * a renamed one would otherwise take the step out with no error anywhere.
     * Omitted entirely for a step about the page as a whole.
     */
    target?: readonly string[];
    /** English catalogue key. */
    title: string;
    /** English catalogue key. */
    body: string;
    /** Where the caption prefers to sit. `placeCard` may overrule it. */
    prefer?: Placement;
}

export interface TourChapter {
    id: string;
    /**
     * Route paths this chapter covers. Longest match wins, segment aware.
     *
     * `/` is deliberately absent from every chapter but the dashboard's: as a
     * prefix it matches everything, so it is special-cased in `chapterFor`.
     */
    match: readonly string[];
    /** English catalogue key - the tour's own headline. */
    title: string;
    steps: readonly TourStep[];
}

/* ------------------------------------------------------------------ *
 * The chapters
 * ------------------------------------------------------------------ */

/**
 * The dashboard.
 *
 * First because it is where every signed-in reader lands, and because the score
 * ring is the single most-asked-about thing on the platform: it is a percentage
 * with no explanation next to it, and half the questions about it are really
 * "why is there no course-completion percentage" - which is answered here
 * rather than left to be inferred.
 */
const HOME: TourChapter = {
    id: 'home',
    match: ['/'],
    title: 'Your dashboard',
    steps: [
        {
            id: 'welcome',
            title: 'This is your dashboard',
            body: 'Everything on this page is about you: what you have scored, what you have earned and what you are enrolled in. Nothing here is visible to anybody else.',
        },
        {
            id: 'ring',
            target: ['.score-ring', '.progress-card', '.achievements'],
            title: 'Your average score',
            body: 'The mean of your best attempt at every quiz you have taken. Best attempt, not every attempt — re-sitting something does not drag the figure down.',
            prefer: 'right',
        },
        {
            id: 'badges',
            target: ['.badge-row', '.achievements'],
            title: 'Badges, including the ones you have not earned',
            body: 'Locked badges are shown on purpose, with what each one needs. A row that showed only what you already had would tell you nothing about what to do next.',
            prefer: 'top',
        },
        {
            id: 'lists',
            target: ['.card-header', '.active-subscriptions-list'],
            title: 'Your courses, results and certificates',
            body: 'The cards below the summary list what you are enrolled in and what you have earned. There is no "percent of course complete" anywhere, because nothing on this platform records that a lesson has been read — every figure here comes from a quiz you actually sat.',
            prefer: 'top',
        },
    ],
};

const COURSES: TourChapter = {
    id: 'courses',
    match: ['/courses'],
    title: 'The course catalogue',
    steps: [
        {
            id: 'grid',
            target: ['.course-card', '.courses-grid'],
            title: 'Every course on the platform',
            body: 'Open one to see its lessons, its homework and its quizzes. Enrolling is free and you can leave again.',
            prefer: 'top',
        },
        {
            id: 'search',
            target: ['.search-input', '.clear-search-btn'],
            title: 'Search works in every language',
            body: 'A course carries its title in English, Arabic and Chinese, and the box matches all three — so what you type finds the course whichever language you are reading the page in.',
            prefer: 'bottom',
        },
        {
            id: 'card',
            target: ['.course-card', '.courses-grid'],
            title: 'What a card tells you',
            body: 'The number of lessons, the level and whether you are already enrolled. Open the course for the syllabus.',
            prefer: 'right',
        },
    ],
};

const COURSE: TourChapter = {
    id: 'course',
    match: ['/course'],
    title: 'Inside a course',
    steps: [
        {
            id: 'lessons',
            target: ['.lesson-card', '.lesson-item', '.lessons-list'],
            title: 'The syllabus, in order',
            body: 'Lessons are listed in the order they are meant to be read. Open one to read it here rather than to download it.',
            prefer: 'top',
        },
        {
            id: 'links',
            target: ['.lesson-links', '.lesson-card'],
            title: 'What sits under each lesson',
            body: 'Open Lesson is the write-up. A runbook, when there is one, is the step-by-step version of the same material, and the reading and source links are references beside it.',
            prefer: 'right',
        },
        {
            id: 'comments',
            target: ['.comment-form', '.comments-section'],
            title: 'Ask about the course here',
            body: 'A comment on this page is about the course as a whole. A question about one lesson belongs on that lesson’s own page, where the people reading it are looking at the same thing you are.',
            prefer: 'top',
        },
    ],
};

const LESSON: TourChapter = {
    id: 'lesson',
    match: ['/course/:courseId/lesson'],
    title: 'Reading a lesson',
    steps: [
        {
            id: 'content',
            target: ['.lesson-content', '.lesson-body'],
            title: 'The whole write-up is here',
            body: 'Headings, lists, callouts and code blocks. A code block is deliberately left in English and pinned left to right — a translated command is a command that does not run.',
            prefer: 'top',
        },
        {
            id: 'nav',
            target: ['.lesson-nav', '.lesson-pager'],
            title: 'Next and previous follow the syllabus',
            body: 'Not the order the records happen to be stored in. The counter tells you where you are in the course.',
            prefer: 'top',
        },
        {
            id: 'discuss',
            target: ['.comment-form', '.comments-section'],
            title: 'Questions about this lesson',
            body: 'A comment here names the lesson as well as the course, so it appears with the material it is about instead of at the bottom of the whole syllabus.',
            prefer: 'top',
        },
    ],
};

const EXAMS: TourChapter = {
    id: 'exams',
    match: ['/exams'],
    title: 'Exams',
    steps: [
        {
            id: 'list',
            target: ['.exam-card', '.exams-page'],
            title: 'Every exam you can sit',
            body: 'An exam is booked with a proctor for a date and a time. A quiz is not — you can take one whenever you like.',
            prefer: 'top',
        },
        {
            id: 'book',
            target: ['.btn-schedule', '.btn-primary', '.appointment-actions'],
            title: 'Booking, rescheduling and cancelling',
            body: 'Pick a date and an hour that the proctor has open. You will be notified when the proctor clears you to start on the day.',
            prefer: 'left',
        },
        {
            id: 'rules',
            title: 'Before you start a paper',
            body: 'Every exam opens with the integrity rules and the clock does not start until you accept them. Read them: five breaches end the sitting and score it zero, and the record is public.',
        },
    ],
};

/**
 * Sitting a paper.
 *
 * The meter first, deliberately. It is the only thing on the page that can end
 * the sitting, and a candidate who meets it for the first time as a red number
 * has met it too late.
 */
const TAKE_EXAM: TourChapter = {
    id: 'take-exam',
    match: ['/take-exam', '/take-quiz'],
    title: 'Sitting a paper',
    steps: [
        {
            id: 'meter',
            target: ['.pr-meter', '.integrity-meter'],
            title: 'The integrity meter',
            body: 'Five pips, five breaches. Leaving the window, switching away, copying, pasting, printing or opening the developer tools each costs one. At five the paper is submitted for you and scored zero.',
            prefer: 'left',
        },
        {
            id: 'closed',
            target: ['.pr-meter', '.integrity-meter'],
            title: 'And it stops when you submit',
            body: 'Nothing is recorded against a sitting that is over. Closing the tab after you have handed the paper in costs you nothing at all.',
            prefer: 'left',
        },
        {
            id: 'timer',
            target: ['.timer', '.exam-timer', '.header-content'],
            title: 'The clock',
            body: 'It started when you accepted the rules, not when the page loaded, so the time you spent reading them is yours.',
            prefer: 'bottom',
        },
        {
            id: 'questions',
            target: ['.question-nav', '.question-grid', '.nav-controls'],
            title: 'Moving between questions',
            body: 'You can flag a question and come back to it. Answering every question earns a few points of its own, whatever the marks come to.',
            prefer: 'top',
        },
    ],
};

const LABS: TourChapter = {
    id: 'labs',
    match: ['/labs'],
    title: 'The labs',
    steps: [
        {
            id: 'tracks',
            target: ['.sl-chips', '.sl-grid'],
            title: 'Tracks and labs',
            body: 'A lab is a subject, the real tools for it, a brief and a list of things to make happen. The service inspects your environment to decide whether you have done them.',
            prefer: 'top',
        },
        {
            id: 'scoring',
            target: ['.pr-scoring', '.sl-filters', '.sl-hero'],
            title: 'How a lab scores',
            body: 'Every task the service verifies is worth points, and finishing one is worth more. Nothing in a lab can fail you — leaving the window to read the documentation is what the lab is asking you to do.',
            prefer: 'bottom',
        },
        {
            id: 'tools',
            target: ['.sl-hero__tools', '.sl-hero__toolbtns'],
            title: 'The scratchpad is not a lab',
            body: 'The terminal, the SQL editor and the Python compiler at the top of every page are somewhere to try one thing. A lab is the one with a brief and a mark.',
            prefer: 'bottom',
        },
    ],
};

const LAB: TourChapter = {
    id: 'lab',
    match: ['/lab'],
    title: 'Inside a lab',
    steps: [
        {
            id: 'brief',
            target: ['.sl-bench__tabs', '.sl-brief'],
            title: 'The brief and the panes',
            body: 'Each tab is a real tool for this subject. Every console is a shell over your own workspace, so `ls`, `cd` and `nano` work in all of them.',
            prefer: 'right',
        },
        {
            id: 'tasks',
            target: ['.sl-task', '.sl-tasks'],
            title: 'The tasks, and how they are marked',
            body: 'Most are checked against what is actually in your environment, so it does not matter how you got there. A few say "mark it yourself" because nothing observable changes.',
            prefer: 'left',
        },
        {
            id: 'check',
            target: ['.sl-check', '.sl-actions'],
            title: 'Check my work',
            body: 'Free and unlimited — checking often is how a lab is meant to be worked. It tells you what moved, and says so plainly when nothing did.',
            prefer: 'top',
        },
        {
            id: 'tutor',
            target: ['.sl-tutor'],
            title: 'The tutor, and what it costs',
            body: 'Your first three questions in a lab are free. Every one after that costs a few points — the tutor is a nudge, not the answer sheet.',
            prefer: 'left',
        },
    ],
};

const TOOLS: TourChapter = {
    id: 'tools',
    match: ['/tools'],
    title: 'The practice tools',
    steps: [
        {
            id: 'tabs',
            target: ['.tab-bar'],
            title: 'A terminal, a database and Python',
            body: 'All three are real: a contained shell, your own copy of the demo database, and a genuine CPython process. Break any of them and reset it.',
            prefer: 'bottom',
        },
        {
            id: 'dock',
            target: ['.sfs-topbar'],
            title: 'And they are on every page',
            body: 'The same three open in a dock at the bottom of whatever you are reading, so trying a query does not mean leaving the lesson that made you want to.',
            prefer: 'bottom',
        },
    ],
};

const LEADERBOARD: TourChapter = {
    id: 'leaderboard',
    match: ['/leaderboard'],
    title: 'The leaderboard',
    steps: [
        {
            id: 'public',
            target: ['.lb-hero__label', '.lb-hero'],
            title: 'This page needs no account',
            body: 'Anybody can read it, and everybody is told so before they start. That is the point: a rule nobody can see does not encourage anything.',
            prefer: 'bottom',
        },
        {
            id: 'points',
            target: ['.lb-explain__col', '.lb-filters', '.lb-explain'],
            title: 'What earns what',
            body: 'The whole scoring table is printed on the page. Passing scores, the mark itself adds more, a finished lab is worth about as much as a paper, and sitting something and missing it still earns a little.',
            prefer: 'top',
        },
        {
            id: 'conduct',
            target: ['.lb-conduct', '.lb-row', '.lb-table'],
            title: 'Conduct is its own column',
            body: 'It is separate from what you achieved, it can be negative, and it is bounded: one sitting can only ever cost so much, however long it runs.',
            prefer: 'top',
        },
        {
            id: 'record',
            target: ['.lb-btn'],
            title: 'Anybody’s activity record',
            body: 'Open a row to see everything that learner has earned and lost, with the time it happened. Yours is on there too.',
            prefer: 'left',
        },
    ],
};

const PLANS: TourChapter = {
    id: 'plans',
    match: ['/plans', '/my-plans', '/payment'],
    title: 'Plans and payment',
    steps: [
        {
            id: 'plans',
            target: ['.plan-card', '.plans-container'],
            title: 'What a plan unlocks',
            body: 'Each plan lists the features it includes. The pages those features gate are hidden from the sidebar until you have one, rather than shown and then refused.',
            prefer: 'top',
        },
        {
            id: 'pay',
            target: ['.btn', '.banner-actions'],
            title: 'Paying',
            body: 'You transfer to the account shown and an operator verifies it. The subscription starts when it is verified, and you are notified either way.',
            prefer: 'top',
        },
    ],
};

const NOTIFICATIONS: TourChapter = {
    id: 'notifications',
    match: ['/notifications'],
    title: 'Notifications',
    steps: [
        {
            id: 'list',
            target: ['.notification-item', '.notifications-container'],
            title: 'What the platform tells you',
            body: 'A certificate issued, a subscription extended, an exam approved, somebody replying to you. Marking one read marks it read for you and for nobody else.',
            prefer: 'top',
        },
        {
            id: 'clear',
            target: ['.clear-all', '.notifications-actions', '.notifications-container'],
            title: 'Clear All means gone',
            body: 'Not "read". It removes what you own and hides what you do not, for you alone — a platform announcement stays where it is for everybody else.',
            prefer: 'bottom',
        },
    ],
};

const NEWSCAST: TourChapter = {
    id: 'newscast',
    match: ['/newscast'],
    title: 'The newscast',
    steps: [
        {
            id: 'open',
            target: ['.studio__stage'],
            title: 'An hourly bulletin, read aloud',
            body: 'Two presenters take turns. It needs no account at all, and the language of the bulletin is separate from the language of the page.',
            prefer: 'bottom',
        },
        {
            id: 'controls',
            target: ['.transport', '.newscast__controls'],
            title: 'Choosing what you hear',
            body: 'Pick the language and the category, then play. You can skip a story, and the voice each presenter is actually using is named under their plate.',
            prefer: 'top',
        },
    ],
};

const AI_CHAT: TourChapter = {
    id: 'ai-chat',
    match: ['/ai-chat'],
    title: 'The AI assistant',
    steps: [
        {
            id: 'rooms',
            target: ['.ac-rooms', '.ac-sidebar'],
            title: 'One room per piece of work',
            body: 'Rooms are saved and named, so a conversation you had last week is still here and still knows what it was about.',
            prefer: 'right',
        },
        {
            id: 'memory',
            target: ['.ac-memory', '.ac-head'],
            title: 'What it remembers, and you can edit it',
            body: 'Each room keeps a short brief of what you are working on. Open Memory to read it and correct it — a memory you cannot see is one you cannot fix.',
            prefer: 'bottom',
        },
    ],
};

const MESSAGES: TourChapter = {
    id: 'messages',
    match: ['/messages'],
    title: 'Messages',
    steps: [
        {
            id: 'rooms',
            target: ['.uc-rooms', '.uc-list'],
            title: 'Conversations with other people here',
            body: 'One to one or in a group, with pictures and voice notes. This is not the support widget in the corner — that one reaches an operator.',
            prefer: 'right',
        },
        {
            id: 'quiet',
            title: 'You are not notified per message',
            body: 'The bell rings once for a room that has been quiet, not once per line. The unread count beside Messages is what keeps up in real time.',
        },
    ],
};

const PROFILE: TourChapter = {
    id: 'profile',
    match: ['/profile'],
    title: 'Your profile',
    steps: [
        {
            id: 'details',
            target: ['.profile-form', '.profile-card'],
            title: 'Your details',
            body: 'Your name here is what a certificate prints and what the leaderboard shows. Your email and password are changed from the same page.',
            prefer: 'right',
        },
        {
            id: 'photo',
            target: ['.profile-image', '.avatar'],
            title: 'Your photograph',
            body: 'It appears on your certificates and beside your messages. There is no requirement to have one — initials are drawn where there is none.',
            prefer: 'right',
        },
    ],
};

const CERTIFICATES: TourChapter = {
    id: 'certificates',
    match: ['/certificates', '/all-certificates', '/certificate'],
    title: 'Certificates',
    steps: [
        {
            id: 'list',
            target: ['.certificate-card', '.certificates-grid'],
            title: 'What you have earned',
            body: 'An exam certificate is issued automatically when you pass. A course certificate is issued by an instructor for finishing a course.',
            prefer: 'top',
        },
        {
            id: 'verify',
            title: 'Anybody can verify one',
            body: 'Every certificate carries an id, and the public list lets somebody you have shown it to confirm it is real.',
        },
    ],
};

const RESULTS: TourChapter = {
    id: 'results',
    match: ['/my-results', '/review-result'],
    title: 'Your results',
    steps: [
        {
            id: 'list',
            target: ['.result-card', '.results-table'],
            title: 'Every attempt, not just the best one',
            body: 'The board scores your best attempt at each thing; this page shows all of them, so you can see where you improved.',
            prefer: 'top',
        },
        {
            id: 'review',
            title: 'Reviewing a paper',
            body: 'Open a result to see the questions again with the correct answers. The options are in the same order you sat them in.',
        },
    ],
};

/** Ordered longest-first at module load, so `chapterFor` is a linear scan. */
const CHAPTERS: readonly TourChapter[] = [
    HOME, COURSES, COURSE, LESSON, EXAMS, TAKE_EXAM, LABS, LAB, TOOLS,
    LEADERBOARD, PLANS, NOTIFICATIONS, NEWSCAST, AI_CHAT, MESSAGES, PROFILE,
    CERTIFICATES, RESULTS,
];

/**
 * The page nothing else covers.
 *
 * NOT an error state. There are ~60 routes and eighteen chapters, so most of
 * the long tail lands here - and a tour that said "there is no tour for this
 * page" would be a button that punishes curiosity. The platform tail below runs
 * on every page anyway, so this is one honest sentence followed by something
 * genuinely useful.
 */
const GENERIC: TourChapter = {
    id: 'page',
    match: [],
    title: 'This page',
    steps: [
        {
            id: 'intro',
            title: 'A quick look round',
            body: 'This page does not have a walkthrough of its own yet, so here is the part of the platform that is the same everywhere.',
        },
    ],
};

/**
 * The chrome, appended to every chapter.
 *
 * Short on purpose. It is genuinely useful on every page - the sidebar scopes
 * itself and people do lose the way back - and anything longer becomes a toll
 * the reader pays for asking about the page they were actually on.
 */
const PLATFORM: readonly TourStep[] = [
    {
        /*
          NO TARGET, and that is load-bearing rather than a stylistic choice.

          It is the one step on the platform that is guaranteed to survive
          `visibleSteps`, so the tour can never come out empty however little of
          the page happens to be rendered - and an empty tour is a button that
          does nothing, on exactly the pages a newcomer is most likely to press
          it. It also earns its place: it is the seam between "this page" and
          "everywhere", which is otherwise an unexplained change of subject.
        */
        id: 'platform',
        title: 'And the parts that are the same everywhere',
        body: 'The rest of this tour is the platform itself — the sidebar, the search, the practice tools and the two pickers at the bottom of the rail. You will recognise it on every other page.',
    },
    {
        id: 'sidebar',
        target: ['.nav-group-label', '.sidebar-nav'],
        title: 'The sidebar follows what you are in',
        body: 'It shows the pages of whichever application you have open rather than all sixty at once. Home is pinned at the top and always takes you back out.',
        prefer: 'right',
    },
    {
        id: 'search',
        target: ['.sidebar-search', '.search-input'],
        title: 'Search reaches the whole platform',
        body: 'Not just the application you are in, which is the point of it. Ctrl+K from anywhere, then the arrow keys.',
        prefer: 'right',
    },
    {
        id: 'topbar',
        target: ['.sfs-topbar'],
        title: 'A terminal, SQL and Python, everywhere',
        body: 'They open in a panel at the bottom and the page stays readable behind it. Escape closes it.',
        prefer: 'bottom',
    },
    {
        id: 'language',
        target: ['.lp-root', '.sidebar-footer'],
        title: 'English, Arabic and Chinese',
        body: 'The whole interface follows, and so do the course titles, the exam papers and the AI. The picker keeps its own label in all three scripts, so it is findable in a language you cannot read.',
        prefer: 'top',
    },
    {
        id: 'theme',
        target: ['.tp-root', '.sidebar-footer'],
        title: 'Ten galaxies, three of them light',
        body: 'Every colour on the platform comes from whichever you pick, and each was measured for readability rather than chosen to look nice.',
        prefer: 'top',
    },
    {
        id: 'replay',
        target: ['.sfs-tour-btn'],
        title: 'Play this again whenever you like',
        body: 'The Tour button is on every page and it always describes the page you are on. Stop at any point with Escape.',
        prefer: 'bottom',
    },
];

/* ------------------------------------------------------------------ *
 * Choosing the chapter
 * ------------------------------------------------------------------ */

/**
 * Whether `path` sits under `base`, by SEGMENT.
 *
 * A bare `startsWith` gets `/courses` against `/course/:id` and `/plans`
 * against `/my-plans` wrong, and every one of those pairs exists here.
 */
export function isUnder(path: string, base: string): boolean {
    if (base === '/') return path === '/';
    const clean = normalisePath(path);
    if (clean === base) return true;
    return clean.startsWith(base + '/');
}

/** A path with its query, hash and trailing slash removed. */
export function normalisePath(path: string): string {
    const raw = String(path || '/').split('?')[0]!.split('#')[0]!;
    const cut = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
    return cut || '/';
}

/**
 * The chapter for a path, or the generic one.
 *
 * LONGEST MATCH, never array order. Two chapters can legitimately claim
 * overlapping prefixes - `/course` and `/course/:courseId/lesson` - and
 * resolving that by position means the answer depends on where somebody
 * happened to add a chapter, which is a bug that survives review.
 *
 * A pattern segment beginning with `:` matches any single segment, so one
 * pattern covers every id.
 */
export function chapterFor(path: string): TourChapter {
    const clean = normalisePath(path);
    let best: TourChapter = GENERIC;
    let bestLength = -1;
    for (const chapter of CHAPTERS) {
        for (const pattern of chapter.match) {
            if (!matches(clean, pattern)) continue;
            const length = pattern === '/' ? 0 : pattern.split('/').length;
            if (length > bestLength) { best = chapter; bestLength = length; }
        }
    }
    return best;
}

function matches(path: string, pattern: string): boolean {
    if (pattern === '/') return path === '/';
    if (!pattern.includes(':')) return isUnder(path, pattern);
    const want = pattern.split('/');
    const have = path.split('/');
    if (have.length < want.length) return false;
    return want.every((part, index) =>
        part.startsWith(':') ? !!have[index] : part === have[index]);
}

/**
 * Every step for a path: the page's own, then the platform's.
 *
 * The page first because that is what the reader asked about. The platform tail
 * is short and is the same everywhere, so somebody who has seen it once knows
 * they can stop.
 */
export function stepsFor(path: string): TourStep[] {
    const chapter = chapterFor(path);
    return [...chapter.steps, ...PLATFORM];
}

/** The tour's headline for a path. An English catalogue key. */
export function titleFor(path: string): string {
    return chapterFor(path).title;
}

/**
 * The steps whose target is on the page, plus every step that needs none.
 *
 * `resolve` is handed in rather than imported, which is what keeps this module
 * plain: the caller passes `sel => document.querySelector(sel)` and a check
 * passes a table. **A step that resolves nothing is dropped**, because half
 * these screens render conditionally and a box drawn round nothing is a tour
 * describing something the reader cannot find.
 */
export function visibleSteps(
    steps: readonly TourStep[],
    resolve: (selector: string) => boolean,
): TourStep[] {
    return steps.filter(step =>
        !step.target?.length || step.target.some(selector => resolve(selector)));
}

/** The first selector of a step that resolves, or `''`. */
export function targetFor(
    step: TourStep, resolve: (selector: string) => boolean,
): string {
    for (const selector of step.target || []) {
        if (resolve(selector)) return selector;
    }
    return '';
}

/* ------------------------------------------------------------------ *
 * Where the caption goes
 * ------------------------------------------------------------------ */

export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface Point { x: number; y: number }

/**
 * How far the caption sits from the box it describes, in px.
 *
 * THIRTY-FOUR, AND THE NUMBER IS THE FEATURE. At 18 the caption sat almost
 * against the box, `connector` returned a line shorter than its own 11px
 * arrowhead, and the component - correctly - drew nothing: a line that short
 * reads as a smudge between two edges that are already touching. The result
 * was a tour with a box and a caption and no arrow at all, which is most of
 * what makes the pairing readable. Found by looking at a screenshot, which is
 * the only way it could have been.
 */
export const GAP = 34;

/** How close the caption may come to the edge of the screen, in px. */
export const MARGIN = 12;

export interface Placed extends Point { placement: Placement }

/**
 * The share of the viewport past which a target stops being a target.
 *
 * A box round a 1,300 x 1,900 grid is not a spotlight, it is a border round the
 * screen - it highlights nothing, and the caption then has nowhere to sit that
 * is not on top of it. Past this, the step is drawn as a page-level one: no
 * box, no line, caption centred, which is the honest rendering of "this whole
 * page is the thing I am describing".
 *
 * 0.55 rather than something rounder because it is the value that separates the
 * two shapes these pages actually produce: a card, a filter row or a table row
 * is well under a third of the screen, and a grid, a page root or a full table
 * is well over two thirds. Nothing real sits near the boundary.
 */
export const MAX_TARGET_SHARE = 0.55;

/**
 * Whether a rectangle is small enough to point AT rather than to describe.
 *
 * Also false for anything taller or wider than the viewport, whatever its area:
 * a target the reader cannot see the ends of has no edge for a line to land on.
 */
export function isPointable(target: Rect | null, view: Size): boolean {
    if (!target) return false;
    if (target.width > view.width || target.height > view.height) return false;
    const area = Math.max(1, view.width * view.height);
    return (target.width * target.height) / area <= MAX_TARGET_SHARE;
}

/**
 * Where to put the caption.
 *
 * Four rules, in order, and the order is the whole of it:
 *
 *  1. no target at all -> centred, and the caller draws no box and no line;
 *  2. the preferred side, if the card fits on screen there;
 *  3. the remaining sides in a FIXED order, so the answer never depends on
 *     object key order and cannot change between two renders of the same page;
 *  4. failing all of those - which at 320px is most of the time - clamped
 *     inside the viewport, biased AWAY from the target so the caption does not
 *     land on top of the thing it is describing.
 *
 * Rule 4 is the one that matters. A caption off the edge of the screen is a
 * tour that has silently stopped working, and a caption over the target is a
 * tour explaining a rectangle the reader cannot see.
 */
export function placeCard(
    target: Rect | null, card: Size, view: Size, prefer: Placement = 'bottom',
): Placed {
    const centre: Placed = {
        x: Math.max(MARGIN, (view.width - card.width) / 2),
        y: Math.max(MARGIN, (view.height - card.height) / 2),
        placement: 'center',
    };
    // A target too large to point at is not passed on as one. Same answer as
    // no target at all, which is what it has become.
    if (!target || prefer === 'center' || !isPointable(target, view)) return centre;

    const order: Placement[] = ['bottom', 'top', 'right', 'left'];
    const tried = [prefer, ...order.filter(p => p !== prefer)];
    for (const placement of tried) {
        const at = anchor(target, card, placement);
        if (fits(at, card, view)) return { ...at, placement };
    }

    // Nothing fits beside it. Put the caption on whichever side of the target
    // has the most room, clamped - which is what a phone gets, every time.
    const above = target.y;
    const below = view.height - (target.y + target.height);
    const placement: Placement = below >= above ? 'bottom' : 'top';
    const at = anchor(target, card, placement);
    return {
        x: clamp(at.x, MARGIN, Math.max(MARGIN, view.width - card.width - MARGIN)),
        y: clamp(at.y, MARGIN, Math.max(MARGIN, view.height - card.height - MARGIN)),
        placement,
    };
}

function anchor(target: Rect, card: Size, placement: Placement): Point {
    const midX = target.x + target.width / 2 - card.width / 2;
    const midY = target.y + target.height / 2 - card.height / 2;
    switch (placement) {
        case 'top': return { x: midX, y: target.y - GAP - card.height };
        case 'right': return { x: target.x + target.width + GAP, y: midY };
        case 'left': return { x: target.x - GAP - card.width, y: midY };
        default: return { x: midX, y: target.y + target.height + GAP };
    }
}

function fits(at: Point, card: Size, view: Size): boolean {
    return at.x >= MARGIN && at.y >= MARGIN
        && at.x + card.width <= view.width - MARGIN
        && at.y + card.height <= view.height - MARGIN;
}

function clamp(value: number, low: number, high: number): number {
    return Math.min(Math.max(value, low), high);
}

/** Whether two boxes overlap at all. */
export function overlaps(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height;
}

export interface Connector { from: Point; to: Point; angle: number; length: number }

/**
 * The line from the caption to the box, and the angle its arrowhead points.
 *
 * Border to border rather than centre to centre, so the line does not run
 * underneath either rectangle and the arrowhead lands ON the edge of the thing
 * it is pointing at. The angle is in degrees, because the only consumer is a
 * CSS `rotate()`.
 */
export function connector(card: Rect, target: Rect): Connector {
    const cardMid = { x: card.x + card.width / 2, y: card.y + card.height / 2 };
    const targetMid = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const from = edgePoint(card, targetMid);
    const to = edgePoint(target, cardMid);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return {
        from, to,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
        length: Math.sqrt(dx * dx + dy * dy),
    };
}

/**
 * Where a ray from a rectangle's centre towards `towards` leaves the rectangle.
 *
 * The degenerate case - `towards` is the centre - returns the centre rather
 * than dividing by zero, which is what a zero-size target produces and what a
 * caption placed exactly over its own box would ask for.
 */
export function edgePoint(rect: Rect, towards: Point): Point {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const dx = towards.x - cx;
    const dy = towards.y - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    const scaleX = dx ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
    const scaleY = dy ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY;
    const scale = Math.min(scaleX, scaleY);
    return { x: cx + dx * scale, y: cy + dy * scale };
}

/* ------------------------------------------------------------------ *
 * Every string reached through a VARIABLE, for `check:i18n`
 * ------------------------------------------------------------------ */

/**
 * The keys no source file contains as a literal.
 *
 * `$t(step.title)` and `$t(step.body)` - spent through a variable, so the
 * orphan scan would report every one of them and the coverage scan would report
 * none. Exported so `check:i18n` can verify them against the catalogue instead,
 * which is how the sidebar's labels, the dashboard's badges, the labs' panel
 * titles and the practice ledger's own copy are all handled.
 *
 * DERIVED by walking the chapters, never a second hand-written list. A copy
 * goes stale the day somebody rewords a step, and the symptom is one caption in
 * the middle of an Arabic tour silently reverting to English.
 */
export const TOUR_KEYS: readonly string[] = (() => {
    const keys = new Set<string>();
    for (const chapter of [...CHAPTERS, GENERIC]) {
        keys.add(chapter.title);
        for (const step of chapter.steps) { keys.add(step.title); keys.add(step.body); }
    }
    for (const step of PLATFORM) { keys.add(step.title); keys.add(step.body); }
    return [...keys];
})();

/** Every chapter, for a check that wants to walk them. Read-only. */
export const ALL_CHAPTERS: readonly TourChapter[] = [...CHAPTERS, GENERIC];

/** The platform tail, for a check that wants to walk it. Read-only. */
export const PLATFORM_STEPS: readonly TourStep[] = PLATFORM;
