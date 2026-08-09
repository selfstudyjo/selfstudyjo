/**
 * The sidebar's navigation registry.
 *
 * A plain module — no Vue, no Pinia, no router — for the same reason as
 * `photoMask.ts`, `drawEngine.ts` and `chatMedia.ts`: everything here is
 * decidable without a browser, so `npm run check:appnav` can assert the
 * properties that are invisible until they are wrong in front of a user.
 *
 * WHY A REGISTRY RATHER THAN A LIST
 *
 * The sidebar used to be one flat list of every page the signed-in user could
 * reach. That is fine at eight entries and unusable at thirty: the platform is
 * ~19 applications, several of which (Research Flow alone has eleven pages)
 * have a whole navigation tree of their own that had nowhere to live, so those
 * pages were reachable only from inside the feature and invisible from the
 * sidebar. Somebody two clicks into the AI Writer had no way to see that
 * "My Library" and "Collaboration" existed.
 *
 * So the sidebar is now *dynamic*: it resolves the current path to the
 * application that owns it and shows that application's pages. Three things
 * are load-bearing and are the reason this file is checked:
 *
 *  1. **Home is pinned and unconditional.** Every scoped sidebar is a sidebar
 *     that no longer lists most of the platform, so the way back out has to be
 *     present on every page, in every mode, collapsed or not. It is
 *     `HOME_ENTRY`, rendered outside the groups so no filter, no access flag
 *     and no search query can remove it.
 *  2. **Sections own disjoint path prefixes.** Two applications claiming the
 *     same path means the sidebar shows the wrong application's pages on it,
 *     and which one it picks depends on array order — the kind of bug that
 *     survives review and shows up as "the menu changed".
 *  3. **A section's own pages must resolve back to it.** If `/research/library`
 *     did not resolve to the Research Flow section, opening it would swap the
 *     sidebar out from under the user mid-task.
 *
 * The entry constants below are shared between an application's `items` and
 * other applications' `related` links deliberately: one page, one label, one
 * set of search keywords, wherever it is linked from.
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/**
 * Icons are named here and drawn in SideNav.vue.
 *
 * The indirection is what keeps this module plain: an icon is a Vue render
 * function, and importing one would make the registry unloadable in node and
 * therefore uncheckable. The union type is what makes the component's map
 * exhaustive — a name added here without a glyph is a compile error, not a
 * blank square.
 */
export type IconName =
    | 'home' | 'grid'
    | 'courses' | 'exams' | 'runbooks' | 'lab' | 'netsim'
    | 'certificate' | 'allCertificates' | 'results'
    | 'plans' | 'myPlans'
    | 'profile' | 'notifications' | 'messages' | 'draw'
    | 'ai' | 'research' | 'toastmasters' | 'jobInterview' | 'roblox' | 'cvBuilder'
    | 'proctor'
    | 'list' | 'plus' | 'search' | 'library' | 'users' | 'write' | 'import'
    | 'globe' | 'play' | 'calendar' | 'check' | 'layers' | 'learn' | 'idCard';

/** The live counters the sidebar can hang off an entry. */
export type BadgeKind = 'notifications' | 'messages';

/**
 * What a user is allowed to see.
 *
 * Mirrors the `hasXAccess` computeds on the auth store, passed in as plain
 * booleans so this module never imports the store. `auth` is "signed in at
 * all"; the rest are subscription features and the proctor role.
 */
export interface Access {
    auth: boolean;
    ai: boolean;
    lab: boolean;
    runbook: boolean;
    research: boolean;
    toastmasters: boolean;
    exam: boolean;
    proctor: boolean;
}

/**
 * What an entry needs before it is shown.
 *
 * `'public'` is the only value visible to a signed-out visitor. The default
 * when omitted is `'auth'`, because on this platform most pages need an
 * account and forgetting the key should fail closed.
 */
export type AccessKey = keyof Access | 'public';

export interface NavEntry {
    to: string;
    text: string;
    icon: IconName;
    /** Extra search terms, so a page is findable by what it does and not only by its label. */
    keywords?: string;
    requires?: AccessKey;
    badge?: BadgeKind;
}

export interface NavGroup {
    label: string;
    items: NavEntry[];
}

export interface AppSection {
    id: string;
    /** Shown as the sidebar's title while this application is open. */
    title: string;
    /** One line under the title — what the application is for. */
    subtitle: string;
    icon: IconName;
    /** Path prefixes this application owns. Matching is segment-aware; longest wins. */
    match: string[];
    /** The application's landing page. Its header icon links here. */
    home: string;
    /**
     * This application's own pages — every one of them must resolve back to
     * this same section, and `check:appnav` enforces it. A cross-application
     * link here would swap the sidebar out from under whoever clicked it,
     * which is what `related` is for.
     */
    items: NavEntry[];
    /** Links out to neighbouring applications — rendered under "Related". */
    related?: NavEntry[];
}

/* ------------------------------------------------------------------ *
 * Path helpers
 * ------------------------------------------------------------------ */

/**
 * Is `path` at or below `prefix`, respecting segment boundaries?
 *
 * A bare `startsWith` is wrong here and the platform has the routes to prove
 * it: `/courses`.startsWith('/course') is true, so the Courses catalogue would
 * light up as active while a course detail page was open, and `/my-plans`
 * would sit under `/my-plan`. Only a whole segment counts.
 */
export function isUnder(path: string, prefix: string): boolean {
    if (prefix === '/') return path === '/';
    return path === prefix || path.startsWith(prefix + '/');
}

/**
 * Which of `paths` the current location is in — the longest match, not the
 * first.
 *
 * Order-independence is the point: `/network-simulator/studio/42` is under
 * both `/network-simulator` and `/network-simulator/studio`, and marking the
 * overview active because it happens to be listed first is how a sidebar ends
 * up disagreeing with the page it is next to.
 */
export function activePath(paths: string[], current: string): string | null {
    let best: string | null = null;
    for (const path of paths) {
        if (!isUnder(current, path)) continue;
        if (best === null || path.length > best.length) best = path;
    }
    return best;
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

/** A query split into the terms every match must contain. */
export function searchTerms(query: string): string[] {
    return normalize(query).split(' ').filter(Boolean);
}

/** Label, keywords and the path itself, so "netsim" and "network simulator" both find it. */
export function haystack(entry: NavEntry): string {
    return normalize(`${entry.text} ${entry.keywords || ''} ${entry.to.replace(/[/-]/g, ' ')}`);
}

export function entryMatches(entry: NavEntry, terms: string[]): boolean {
    if (!terms.length) return true;
    const hay = haystack(entry);
    return terms.every(term => hay.includes(term));
}

/**
 * Split a label into matched / unmatched runs so hits can be emphasised
 * without `v-html` — the labels are ours, but building HTML from a user's
 * keystrokes is a habit worth not having.
 */
export function matchParts(text: string, terms: string[]): { text: string; match: boolean }[] {
    if (!terms.length) return [{ text, match: false }];

    const lower = text.toLowerCase();
    const ranges: [number, number][] = [];
    for (const term of terms) {
        let at = lower.indexOf(term);
        while (at !== -1) {
            ranges.push([at, at + term.length]);
            at = lower.indexOf(term, at + term.length);
        }
    }
    if (!ranges.length) return [{ text, match: false }];

    ranges.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
        else merged.push([range[0], range[1]]);
    }

    const parts: { text: string; match: boolean }[] = [];
    let cursor = 0;
    for (const [start, end] of merged) {
        if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
        parts.push({ text: text.slice(start, end), match: true });
        cursor = end;
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
    return parts;
}

/* ------------------------------------------------------------------ *
 * Access
 * ------------------------------------------------------------------ */

export function canSee(entry: { requires?: AccessKey }, access: Access): boolean {
    const need: AccessKey = entry.requires ?? 'auth';
    if (need === 'public') return true;
    if (!access.auth) return false;
    return access[need];
}

/** Filter each group's items and drop the groups that empty out. */
export function pruneGroups(groups: NavGroup[], access: Access): NavGroup[] {
    return groups
        .map(group => ({ label: group.label, items: group.items.filter(item => canSee(item, access)) }))
        .filter(group => group.items.length > 0);
}

/** Filter already-pruned groups by a search query, dropping the empties. */
export function filterGroups(groups: NavGroup[], terms: string[]): NavGroup[] {
    if (!terms.length) return groups;
    return groups
        .map(group => ({ label: group.label, items: group.items.filter(item => entryMatches(item, terms)) }))
        .filter(group => group.items.length > 0);
}

export function flatten(groups: NavGroup[]): NavEntry[] {
    return groups.flatMap(group => group.items);
}

/* ------------------------------------------------------------------ *
 * The pages
 *
 * One constant per page. An application's `items` and every other
 * application's `related` reference the same object, so a label or a keyword
 * is written once and cannot drift between the two places it appears.
 * ------------------------------------------------------------------ */

/**
 * The way back out, pinned above every group in every mode.
 *
 * Not part of any group and not subject to `canSee`: a scoped sidebar hides
 * most of the platform, so the escape hatch must not be something an access
 * flag or a search query can take away. A signed-out visitor clicking it is
 * sent to the login page by `authGuard`, which is the honest answer to
 * "take me to my dashboard".
 */
export const HOME_ENTRY: NavEntry = {
    to: '/',
    text: 'Home',
    icon: 'home',
    keywords: 'dashboard start overview main back index',
    requires: 'public',
};

// -- Learn ---------------------------------------------------------------
const COURSES: NavEntry = { to: '/courses', text: 'Courses', icon: 'courses', keywords: 'learn lessons training catalog study browse', requires: 'public' };
const EXAMS: NavEntry = { to: '/exams', text: 'Exams', icon: 'exams', keywords: 'tests quizzes assessments', requires: 'public' };
const SCHEDULE_EXAM: NavEntry = { to: '/schedule-exam', text: 'Schedule Exam', icon: 'calendar', keywords: 'book appointment slot sitting date', requires: 'exam' };
const EXAM_APPROVAL: NavEntry = { to: '/exam-approval', text: 'Exam Approval', icon: 'check', keywords: 'approve pending request start permission', requires: 'exam' };
const RUNBOOKS: NavEntry = { to: '/runbooks', text: 'Runbooks', icon: 'runbooks', keywords: 'procedures operations guides steps playbook', requires: 'runbook' };
const LABS: NavEntry = { to: '/labs', text: 'Labs', icon: 'lab', keywords: 'practice sandbox hands on exercises sql linux python terminal', requires: 'lab' };

// -- Certificates --------------------------------------------------------
const MY_CERTIFICATES: NavEntry = { to: '/certificates', text: 'My Certificates', icon: 'certificate', keywords: 'credentials badges diplomas awarded mine' };
const ALL_CERTIFICATES: NavEntry = { to: '/all-certificates', text: 'All Certificates', icon: 'allCertificates', keywords: 'credentials badges diplomas everyone verify public', requires: 'public' };

// -- Results -------------------------------------------------------------
const MY_RESULTS: NavEntry = { to: '/my-results', text: 'My Results', icon: 'results', keywords: 'scores grades marks exam quiz history' };

// -- Billing -------------------------------------------------------------
const PLANS: NavEntry = { to: '/plans', text: 'Plans', icon: 'plans', keywords: 'pricing packages subscribe subscription upgrade buy', requires: 'public' };
const MY_PLANS: NavEntry = { to: '/my-plans', text: 'My Plans', icon: 'myPlans', keywords: 'subscription billing membership renew invoice' };

// -- Account -------------------------------------------------------------
const PROFILE: NavEntry = { to: '/profile', text: 'Profile', icon: 'profile', keywords: 'account settings avatar password email name' };
const NOTIFICATIONS: NavEntry = { to: '/notifications', text: 'Notifications', icon: 'notifications', keywords: 'alerts inbox unread bell', badge: 'notifications' };
const MESSAGES: NavEntry = { to: '/messages', text: 'Messages', icon: 'messages', keywords: 'chat conversation direct message dm talk classmates group voice picture free', badge: 'messages' };

// -- Tools ---------------------------------------------------------------
const DRAW: NavEntry = { to: '/draw', text: 'Drawing Papers', icon: 'draw', keywords: 'whiteboard draw paint canvas sketch diagram board collaborate free' };
const NETSIM: NavEntry = { to: '/network-simulator', text: 'Network Simulator', icon: 'netsim', keywords: 'netsim topology router switch packet tracer cisco subnet', requires: 'lab' };
const AI_CHAT: NavEntry = { to: '/ai-chat', text: 'AI Chat Assistant', icon: 'ai', keywords: 'chatbot gpt llm ask question assistant', requires: 'ai' };
const RESEARCH: NavEntry = { to: '/research', text: 'Research Flow', icon: 'research', keywords: 'papers sources literature review academic citation', requires: 'research' };
const TOASTMASTERS: NavEntry = { to: '/toastmasters', text: 'Toastmasters', icon: 'toastmasters', keywords: 'public speaking speech presentation pathways', requires: 'toastmasters' };
const JOB_INTERVIEW: NavEntry = { to: '/job-interview', text: 'Job Interview', icon: 'jobInterview', keywords: 'hiring practice questions mock career recruiter', requires: 'ai' };
const CV_BUILDER: NavEntry = { to: '/cv-builder', text: 'CV Builder', icon: 'cvBuilder', keywords: 'resume curriculum vitae pdf docx export photo voice', requires: 'ai' };
const ROBLOX: NavEntry = { to: '/roblox-tool', text: 'Roblox Studio', icon: 'roblox', keywords: 'game lua scripting studio animation', requires: 'ai' };

// -- Proctoring ----------------------------------------------------------
const PROCTOR_DASHBOARD: NavEntry = { to: '/proctor-dashboard', text: 'Proctor Dashboard', icon: 'proctor', keywords: 'monitor supervise invigilate exams candidates', requires: 'proctor' };

/* ------------------------------------------------------------------ *
 * The applications
 * ------------------------------------------------------------------ */

/**
 * Ordered for readability only — `resolveSection` picks by longest matching
 * prefix, never by position, so reordering this array cannot change which
 * application a path belongs to.
 *
 * A path deliberately absent from every `match` list (`/login`, `/register`,
 * `/verify-email`) falls through to the full platform menu, which is the right
 * sidebar for somebody who is not inside an application yet.
 *
 * Some routes appear in `match` but in no `items` list — `/take-exam`,
 * `/course/:id`, `/draw/paper/:id`, `/toastmasters/session`. Those are pages
 * you arrive at from within the application rather than navigate to, so they
 * belong to the section (the sidebar must stay put while you are on them) but
 * are not destinations to offer.
 */
export const APP_SECTIONS: AppSection[] = [
    {
        id: 'courses',
        title: 'Courses',
        subtitle: 'Lessons, homework and quizzes',
        icon: 'courses',
        match: ['/courses', '/course', '/take-quiz'],
        home: '/courses',
        items: [COURSES],
        related: [MY_RESULTS, MY_CERTIFICATES, EXAMS, LABS, AI_CHAT],
    },
    {
        id: 'exams',
        title: 'Exams',
        subtitle: 'Sit, schedule and review exams',
        icon: 'exams',
        // `/my-results` and `/review-result` live here rather than under Account:
        // a result is something an exam produced, and somebody looking at one is
        // far more likely to want the next exam than their avatar.
        match: ['/exams', '/schedule-exam', '/exam-approval', '/take-exam', '/my-results', '/review-result'],
        home: '/exams',
        items: [EXAMS, SCHEDULE_EXAM, EXAM_APPROVAL, MY_RESULTS],
        related: [MY_CERTIFICATES, COURSES, PROCTOR_DASHBOARD],
    },
    {
        id: 'certificates',
        title: 'Certificates',
        subtitle: 'Credentials you have earned',
        icon: 'certificate',
        match: ['/certificates', '/all-certificates', '/certificate'],
        home: '/certificates',
        items: [MY_CERTIFICATES, ALL_CERTIFICATES],
        related: [COURSES, EXAMS],
    },
    {
        id: 'billing',
        title: 'Plans & Billing',
        subtitle: 'Subscriptions and payments',
        icon: 'plans',
        match: ['/plans', '/my-plans', '/payment'],
        home: '/plans',
        items: [PLANS, MY_PLANS],
        related: [PROFILE],
    },
    {
        id: 'runbooks',
        title: 'Runbooks',
        subtitle: 'Step-by-step operational guides',
        icon: 'runbooks',
        match: ['/runbooks'],
        home: '/runbooks',
        items: [RUNBOOKS],
        related: [COURSES, LABS],
    },
    {
        id: 'labs',
        title: 'Labs',
        subtitle: 'SQL, Linux and Python sandboxes',
        icon: 'lab',
        match: ['/labs'],
        home: '/labs',
        items: [LABS],
        related: [NETSIM, COURSES, AI_CHAT],
    },
    {
        id: 'netsim',
        title: 'Network Simulator',
        subtitle: 'Build and test topologies',
        icon: 'netsim',
        match: ['/network-simulator'],
        home: '/network-simulator',
        items: [
            { to: '/network-simulator', text: 'Overview', icon: 'netsim', keywords: 'home start saved topologies', requires: 'lab' },
            { to: '/network-simulator/studio', text: 'Studio', icon: 'layers', keywords: 'build canvas design topology devices cables', requires: 'lab' },
            { to: '/network-simulator/learn', text: 'Learn', icon: 'learn', keywords: 'tutorial lessons theory guide networking', requires: 'lab' },
        ],
        related: [LABS, AI_CHAT],
    },
    {
        id: 'research',
        title: 'Research Flow',
        subtitle: 'Projects, sources and writing',
        icon: 'research',
        match: ['/research'],
        home: '/research',
        items: [
            { to: '/research', text: 'Overview', icon: 'research', keywords: 'home start dashboard', requires: 'research' },
            { to: '/research/my-projects', text: 'My Projects', icon: 'list', keywords: 'mine owned papers studies', requires: 'research' },
            { to: '/research/create-project', text: 'Create Project', icon: 'plus', keywords: 'new start add begin', requires: 'research' },
            { to: '/research/search', text: 'Search Projects', icon: 'search', keywords: 'find browse discover others', requires: 'research' },
            { to: '/research/library', text: 'My Library', icon: 'library', keywords: 'saved sources references bibliography', requires: 'research' },
            { to: '/research/collaboration', text: 'Collaboration', icon: 'users', keywords: 'co authors invites shared team', requires: 'research' },
            { to: '/research/ai-writer', text: 'AI Writer', icon: 'write', keywords: 'draft generate compose paper section', requires: 'research' },
            { to: '/research/import-openalex', text: 'Import from OpenAlex', icon: 'import', keywords: 'openalex doi metadata fetch works', requires: 'research' },
            { to: '/research/google-scholar', text: 'Google Scholar', icon: 'globe', keywords: 'scholar search citations external', requires: 'research' },
            { to: '/research/researchers', text: 'Researchers', icon: 'users', keywords: 'people directory authors profiles', requires: 'research' },
            { to: '/research/profile', text: 'My Researcher Profile', icon: 'idCard', keywords: 'orcid affiliation bio mine', requires: 'research' },
        ],
        related: [AI_CHAT, CV_BUILDER],
    },
    {
        id: 'ai',
        title: 'AI Chat Assistant',
        subtitle: 'Ask, explain, summarise',
        icon: 'ai',
        match: ['/ai-chat'],
        home: '/ai-chat',
        items: [AI_CHAT],
        related: [JOB_INTERVIEW, CV_BUILDER, TOASTMASTERS, RESEARCH],
    },
    {
        id: 'toastmasters',
        title: 'Toastmasters',
        subtitle: 'Practise public speaking',
        icon: 'toastmasters',
        match: ['/toastmasters'],
        home: '/toastmasters',
        items: [
            { to: '/toastmasters', text: 'Overview', icon: 'toastmasters', keywords: 'home start speeches', requires: 'toastmasters' },
            { to: '/toastmasters/pre-session', text: 'Prepare Session', icon: 'play', keywords: 'new speech begin setup topic warm up', requires: 'toastmasters' },
            { to: '/toastmasters/results', text: 'My Results', icon: 'results', keywords: 'scores feedback history evaluation', requires: 'toastmasters' },
        ],
        related: [JOB_INTERVIEW, AI_CHAT],
    },
    {
        id: 'interview',
        title: 'Job Interview',
        subtitle: 'Mock interviews and feedback',
        icon: 'jobInterview',
        match: ['/job-interview'],
        home: '/job-interview',
        items: [
            { to: '/job-interview', text: 'Overview', icon: 'jobInterview', keywords: 'home start interviews', requires: 'ai' },
            { to: '/job-interview/pre-session', text: 'Prepare Interview', icon: 'play', keywords: 'new begin setup role job description', requires: 'ai' },
            { to: '/job-interview/results', text: 'My Results', icon: 'results', keywords: 'scores feedback history evaluation', requires: 'ai' },
        ],
        related: [CV_BUILDER, TOASTMASTERS, AI_CHAT],
    },
    {
        id: 'cv',
        title: 'CV Builder',
        subtitle: 'Write, tailor and export a CV',
        icon: 'cvBuilder',
        match: ['/cv-builder'],
        home: '/cv-builder',
        items: [{ ...CV_BUILDER, text: 'My CVs' }],
        related: [JOB_INTERVIEW, AI_CHAT, PROFILE],
    },
    {
        id: 'roblox',
        title: 'Roblox Studio',
        subtitle: 'Animation and scripting',
        icon: 'roblox',
        match: ['/roblox-tool'],
        home: '/roblox-tool',
        items: [ROBLOX],
        related: [AI_CHAT, COURSES],
    },
    {
        id: 'draw',
        title: 'Drawing Papers',
        subtitle: 'Shared canvas, free with an account',
        icon: 'draw',
        match: ['/draw'],
        home: '/draw',
        items: [{ ...DRAW, text: 'My Papers' }],
        related: [MESSAGES, COURSES],
    },
    {
        id: 'messages',
        title: 'Messages',
        subtitle: 'Talk to students and teachers',
        icon: 'messages',
        match: ['/messages'],
        home: '/messages',
        items: [{ ...MESSAGES, text: 'Conversations' }],
        related: [NOTIFICATIONS, DRAW, PROFILE],
    },
    {
        id: 'proctor',
        title: 'Proctoring',
        subtitle: 'Supervise exam appointments',
        icon: 'proctor',
        match: ['/proctor-dashboard', '/proctor-appointment'],
        home: '/proctor-dashboard',
        items: [PROCTOR_DASHBOARD],
        related: [EXAMS, ALL_CERTIFICATES],
    },
    {
        id: 'account',
        title: 'Account',
        subtitle: 'Profile, alerts and subscription',
        icon: 'profile',
        match: ['/profile', '/notifications'],
        home: '/profile',
        items: [PROFILE, NOTIFICATIONS],
        related: [MY_PLANS, MESSAGES, MY_CERTIFICATES, MY_RESULTS],
    },
];

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

/**
 * The full platform menu — the sidebar shown when the user is not inside any
 * application, and the list the in-application search falls back to.
 *
 * `HOME_ENTRY` is deliberately not in here: it is pinned above the groups so
 * that it survives filtering.
 */
export function globalGroups(access: Access): NavGroup[] {
    return pruneGroups([
        { label: 'Main', items: [MESSAGES, NOTIFICATIONS] },
        { label: 'Learn', items: [COURSES, EXAMS, RUNBOOKS, LABS, ALL_CERTIFICATES] },
        { label: 'Tools', items: [DRAW, NETSIM, AI_CHAT, RESEARCH, TOASTMASTERS, JOB_INTERVIEW, CV_BUILDER, ROBLOX] },
        { label: 'Account', items: [MY_PLANS, PLANS, MY_CERTIFICATES, MY_RESULTS, PROFILE] },
        { label: 'Proctoring', items: [PROCTOR_DASHBOARD] },
    ], access);
}

/** One application's pages, plus its links out, filtered to what this user may see. */
export function sectionGroups(section: AppSection, access: Access): NavGroup[] {
    return pruneGroups([
        { label: section.title, items: section.items },
        { label: 'Related', items: section.related ?? [] },
    ], access);
}

/**
 * The application that owns `path`, or null for the full platform menu.
 *
 * Longest prefix wins, so a nested application can be carved out of a broader
 * one later without reordering anything.
 *
 * Returns null when the matched application has nothing this user may see —
 * a subscription that lapsed mid-session would otherwise leave them staring at
 * a sidebar containing only its own title.
 */
export function resolveSection(path: string, access: Access): AppSection | null {
    let best: AppSection | null = null;
    let bestLength = -1;

    for (const section of APP_SECTIONS) {
        for (const prefix of section.match) {
            if (!isUnder(path, prefix)) continue;
            if (prefix.length > bestLength) {
                best = section;
                bestLength = prefix.length;
            }
        }
    }

    if (!best) return null;
    return sectionGroups(best, access).length ? best : null;
}

export interface NavLayoutOptions {
    section: AppSection | null;
    access: Access;
    query: string;
    /** The "All applications" disclosure, only consulted when the query is empty. */
    showAllApps: boolean;
}

/**
 * `scoped` is what the sidebar leads with; `extra` is everything the user has
 * to ask for, and the disclosure control is rendered between the two.
 */
export interface NavLayout {
    scoped: NavGroup[];
    extra: NavGroup[];
}

/**
 * What the nav renders, given where the user is and what they have typed.
 *
 * Three rules, and the second is the whole of "every application's sidebar has
 * a search input":
 *
 *  * outside an application the sidebar is the full platform menu, and the
 *    search filters it in place, group labels and all;
 *  * inside one, a **non-empty** query still searches the whole platform — the
 *    in-application hits first under the application's own name, then
 *    everything else under "All applications". Scoping the search to the open
 *    application would make the one control that looks like it can take you
 *    anywhere the one that cannot;
 *  * with an empty query, inside an application, the rest of the platform is
 *    one click away behind the disclosure rather than gone.
 */
export function navLayout(options: NavLayoutOptions): NavLayout {
    const { section, access, query, showAllApps } = options;
    const terms = searchTerms(query);
    const global = globalGroups(access);

    if (!section) return { scoped: filterGroups(global, terms), extra: [] };

    const scoped = filterGroups(sectionGroups(section, access), terms);

    if (!terms.length) return { scoped, extra: showAllApps ? global : [] };

    // Searching from inside an application: never show a page twice, and label
    // the rest so it is obvious the hit is somewhere other than where you are.
    const shown = new Set(flatten(scoped).map(item => item.to));
    const elsewhere = flatten(filterGroups(global, terms)).filter(item => !shown.has(item.to));
    return { scoped, extra: elsewhere.length ? [{ label: 'All applications', items: elsewhere }] : [] };
}

/** Everything `navLayout` would render, in order — the keyboard cursor walks this. */
export function navGroups(options: NavLayoutOptions): NavGroup[] {
    const layout = navLayout(options);
    return [...layout.scoped, ...layout.extra];
}
