/**
 * The SelfStudy E-Learning desktop app (`vite build --mode desktop`, VITE_DESKTOP=1).
 *
 * The desktop app is for STUDY on the student's own computer: courses and lessons, labs,
 * playgrounds and simulators, runbooks, quizzes, exams (taken directly, the software is the
 * proctor), and the learning tools (roadmaps, mock interviews, Toastmasters, AI tutor, the CV
 * Builder - the student's own CVs, kept on their computer). Every
 * page that is about money, other people or the online community - plans and payments,
 * certificates, leaderboards, exam booking, messages, the newscast - stays on the website.
 *
 * A plain module: the sidebar (appNav.canSee), the router and the views all ask it, so a
 * hidden page can neither be listed nor reached by URL.
 */
export const IS_DESKTOP: boolean = import.meta.env?.VITE_DESKTOP === '1';

/** Path prefixes the desktop app does not offer (segment-aware, like appNav.isUnder). */
export const DESKTOP_HIDDEN: readonly string[] = [
    '/plans', '/my-plans', '/payment', '/payments', '/checkout',
    '/schedule-exam', '/exam-approval', '/proctor-dashboard', '/proctor-exam-appointment', '/proctor',
    '/certificates', '/all-certificates', '/certificate',
    '/leaderboard', '/messages', '/notifications', '/newscast', '/products',
    '/research', '/roblox-tool', '/draw', '/live-course', '/live-courses',
    '/register', '/forgot-password', '/reset-password', '/verify-email', '/interview-helper',
];

export function hiddenOnDesktop(path: string, desktop: boolean = IS_DESKTOP): boolean {
    if (!desktop) return false;
    const p = (String(path || '/').split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/';
    return DESKTOP_HIDDEN.some((h) => p === h || p.startsWith(h + '/'));
}
