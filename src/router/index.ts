import { createRouter, createWebHashHistory } from 'vue-router';
import { authGuard, publicOnlyGuard } from './guard';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import Home from '../views/Home.vue';
import Courses from '../views/Courses.vue';
import CourseDetails from '../views/CourseDetails.vue';
import LessonDetails from '../views/LessonDetails.vue';
import HomeworkView from '../views/HomeworkView.vue';
import Profile from '../views/Profile.vue';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import VerifyEmail from '../views/VerifyEmail.vue';
import Notifications from '../views/Notifications.vue';
import UserCertificates from '../views/UserCertificates.vue';
import UserCertificate from '../views/UserCertificate.vue';
import AllUsersCertificates from '../views/AllUsersCertificates.vue';
import Runbooks from '../views/Runbooks.vue';
import RunbookDetails from '../views/RunbookDetails.vue';
import Labs from '../views/Labs.vue';
import Exams from '../views/Exams.vue';
import ScheduleExam from '../views/ScheduleExam.vue';
import ExamApproval from '../views/ExamApproval.vue';
import TakeExam from '../views/TakeExam.vue';
import TakeQuiz from '../views/TakeQuiz.vue';
import ProctorDashboard from '../views/ProctorDashboard.vue';
import ProctorExamAppointment from '../views/ProctorExamAppointment.vue';
import Plans from '../views/Plans.vue';
import Payment from '../views/Payment.vue';
import MyPlans from '../views/MyPlans.vue';
import UserResults from '../views/UserResults.vue';
import ReviewResults from '../views/ReviewResults.vue';
import AiChat from '../views/AiChat.vue';

// Research Flow Views
import ResearchFlow from '../views/ResearchFlow.vue';
import ResearchMyProjects from '../views/ResearchMyProjects.vue';
import ResearchSearchProjects from '../views/ResearchSearchProjects.vue';
import ResearchLibrary from '../views/ResearchLibrary.vue';
import ResearchCollaboration from '../views/ResearchCollaboration.vue';
import ResearchProjectDetails from '../views/ResearchProjectDetails.vue';
import ResearchCreateProject from '../views/ResearchCreateProject.vue';
import ResearchImportOpenAlex from '../views/ResearchImportOpenAlex.vue';
import ResearchGoogleScholar from '../views/ResearchGoogleScholar.vue';
import ResearchAIWriter from '../views/ResearchAIWriter.vue';
import ResearchAIWriterDetail from '../views/ResearchAIWriterDetail.vue';
import ResearchResearchers from '../views/ResearchResearchers.vue';
import ResearchResearcherProfile from '../views/ResearchResearcherProfile.vue';
import ResearchCompleteProfile from '../views/ResearchCompleteProfile.vue';

import Toastmasters from '../views/Toastmasters.vue';
import ToastmastersPreSession from '../views/ToastmastersPreSession.vue';
import ToastmastersSession from '../views/ToastmastersSession.vue';
import ToastmastersResults from '../views/ToastmastersResults.vue';

import JobInterview from '../views/JobInterview.vue';
import JobInterviewPreSession from '../views/JobInterviewPreSession.vue';
import JobInterviewSession from '../views/JobInterviewSession.vue';
import JobInterviewResults from '../views/JobInterviewResults.vue';

/*
  Lazy, and the only route here that is — because it is the only remaining
  static import of `three`.

  `RobloxTool.vue` imports the whole of `three` at module scope. Statically
  imported, that puts a 3D engine (~170 kB gzip) in the ENTRY chunk, so every
  visitor downloaded it to read the login page. The tool itself is behind
  `ai_feature` and is one of the least-visited screens on the platform.

  This is deliberately not a general conversion of the router to lazy routes.
  That is a worthwhile change and a much larger one — ~50 views, each becoming a
  network request on first navigation, which needs a loading state per route to
  not read as a stall. This is the one case where a single line removes a
  library from every page.
*/
const RobloxTool = () => import('../views/RobloxTool.vue');

// CV Builder (gated by ai_feature)
import CvBuilder from '../views/CvBuilder.vue';
import CvBuilderEditor from '../views/CvBuilderEditor.vue';

// Drawing papers (app 34) — auth only. Deliberately NOT subscription-gated:
// this tool is free with an account, so the routes carry `requiresAuth` and no
// `requiresSubscription` / `requiredFeatures`.
import DrawPapers from '../views/DrawPapers.vue';
import DrawBoard from '../views/DrawBoard.vue';
import Messages from '../views/Messages.vue';
import DrawShared from '../views/DrawShared.vue';

// Newscast (app 36) — deliberately the most open page on the platform: no
// account and no subscription. Its route carries `requiresAuth: false`, which
// puts it alongside Courses, Exams, Plans and All Certificates rather than
// alongside Drawing Papers and Messages, which need an account.
import Newscast from '../views/Newscast.vue';

// Leaderboard — public like the Newscast: `requiresAuth: false`, no
// subscription and no feature flag, so a signed-out visitor sees the whole
// board. It reads the exam and certificate services and writes nothing.
import Leaderboard from '../views/Leaderboard.vue';

// Network Simulator (gated by lab_feature)
import NetworkSimulator from '../views/NetworkSimulator.vue';
import NetworkSimulatorStudio from '../views/NetworkSimulatorStudio.vue';
import NetworkSimulatorLearn from '../views/NetworkSimulatorLearn.vue';


const routes = [
    {
        path: '/',
        component: DefaultLayout,
        children: [
            {
                path: '',
                name: 'Home',
                component: Home,
                meta: { title: 'Dashboard', requiresAuth: true }
            },
            {
                path: 'courses',
                name: 'Courses',
                component: Courses,
                meta: { title: 'Courses', requiresAuth: false }
            },
            {
                path: 'runbooks',
                name: 'Runbooks',
                component: Runbooks,
                meta: { title: 'Runbooks', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['runbook_feature'] }
            },
            {
                path: 'runbooks/:id',
                name: 'RunbookDetails',
                component: RunbookDetails,
                meta: { title: 'Runbook Details', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['runbook_feature'] },
                props: true
            },
            {
                path: 'labs',
                name: 'Labs',
                component: Labs,
                meta: { title: 'Labs', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['lab_feature'] }
            },
            {
                /*
                  The three sandboxes are addressable.

                  They were tabs in component state, which meant the sidebar had
                  nothing to point at — one "Labs" entry for three tools — and a
                  student could not link a classmate to the Python tab or come
                  back to the one they were in. The tab is a route param now, so
                  it survives a reload, a back button and a shared URL, and
                  appNav can list all three. `/labs` still works and lands on SQL.
                */
                path: 'labs/:tab(sql|linux|python)',
                name: 'LabsTab',
                component: Labs,
                meta: { title: 'Labs', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['lab_feature'] }
            },
            {
                path: 'course/:id',
                name: 'CourseDetails',
                component: CourseDetails,
                meta: { title: 'Course Details', requiresAuth: false }
            },
            {
                /*
                  ONE LESSON'S PAGE, and it is `requiresAuth: false` for the
                  same reason `course/:id` is: the catalogue and what is in it
                  are what a visitor is deciding about, and a course page that
                  lists twenty lesson titles a signed-out reader cannot open is
                  an advertisement with twenty dead links in it.

                  What being signed out costs on that page is spelled out there
                  rather than hidden: the comment form says to sign in, the
                  runbook link is drawn only for somebody who can open one, and
                  the quiz and homework badges need an enrolment.

                  It sits ABOVE `.../homework` so the two are adjacent in the
                  file; the order is not load-bearing, because Vue Router scores
                  a four-segment pattern above a three-segment one and neither
                  of these can match the other's depth.
                */
                path: 'course/:courseId/lesson/:lessonId',
                name: 'LessonDetails',
                component: LessonDetails,
                meta: { title: 'Lesson', requiresAuth: false }
            },
            {
                path: 'course/:courseId/lesson/:lessonId/homework',
                name: 'Homework',
                component: HomeworkView,
                meta: { title: 'Homework', requiresAuth: true },
                props: (route: any) => ({
                    courseId: route.params.courseId,
                    lessonId: route.params.lessonId,
                    homeworkId: route.query.homeworkId
                })
            },
            {
                path: 'take-quiz',
                name: 'TakeQuiz',
                component: TakeQuiz,
                meta: { title: 'Take Quiz', requiresAuth: true }
            },
            {
                path: 'profile',
                name: 'Profile',
                component: Profile,
                meta: { title: 'Profile', requiresAuth: true }
            },
            {
                path: 'notifications',
                name: 'Notifications',
                component: Notifications,
                meta: { title: 'Notifications', requiresAuth: true }
            },
            {
                path: 'certificates',
                name: 'UserCertificates',
                component: UserCertificates,
                meta: { title: 'My Certificates', requiresAuth: true }
            },
            {
                path: 'certificate/:certificateId',
                name: 'UserCertificate',
                component: UserCertificate,
                meta: { title: 'Certificate Details', requiresAuth: false }
            },
            {
                path: 'all-certificates',
                name: 'AllUsersCertificates',
                component: AllUsersCertificates,
                meta: { title: 'All Certificates', requiresAuth: false }
            },
            {
                path: 'leaderboard',
                name: 'Leaderboard',
                component: Leaderboard,
                meta: { title: 'Leaderboard', requiresAuth: false }
            },
            {
                path: 'exams',
                name: 'Exams',
                component: Exams,
                meta: { title: 'Exams', requiresAuth: false }
            },
            {
                path: 'schedule-exam',
                name: 'ScheduleExam',
                component: ScheduleExam,
                meta: { title: 'Schedule Exam', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['exam_feature'] }
            },
            {
                path: 'exam-approval',
                name: 'ExamApproval',
                component: ExamApproval,
                meta: { title: 'Exam Approval', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['exam_feature'] }
            },
            {
                path: 'take-exam',
                name: 'TakeExam',
                component: TakeExam,
                meta: { title: 'Take Exam', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['exam_feature'] }
            },
            {
                path: 'proctor-dashboard',
                name: 'ProctorDashboard',
                component: ProctorDashboard,
                meta: { title: 'Proctor Dashboard', requiresAuth: true }
            },
            {
                path: 'proctor-appointment/:id',
                name: 'ProctorExamAppointment',
                component: ProctorExamAppointment,
                meta: { title: 'Exam Appointment', requiresAuth: true },
                props: true
            },
            {
                path: 'plans',
                name: 'Plans',
                component: Plans,
                meta: { title: 'Subscription Plans', requiresAuth: false }
            },
            {
                path: 'payment',
                name: 'Payment',
                component: Payment,
                meta: { title: 'Payment', requiresAuth: true },
                props: (route: any) => ({
                    plan: route.query.plan,
                    title: route.query.title,
                    price: route.query.price,
                    description: route.query.description
                })
            },
            {
                path: 'my-plans',
                name: 'MyPlans',
                component: MyPlans,
                meta: { title: 'My Plans', requiresAuth: true }
            },
            {
                path: 'my-results',
                name: 'UserResults',
                component: UserResults,
                meta: { title: 'My Results', requiresAuth: true }
            },
            {
                path: 'review-result/:type/:id',
                name: 'ReviewResults',
                component: ReviewResults,
                meta: { title: 'Review Result', requiresAuth: true },
                props: true
            },
            {
                path: 'ai-chat',
                name: 'AiChat',
                component: AiChat,
                meta: { title: 'AI Chat Assistant', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['ai_feature'] }
            },
            {
                // One conversation, by id.
                //
                // A chat is a PLACE rather than a tab: the id in the path is
                // what makes a reload land back in the same project, what makes
                // Back go to the conversation you came from rather than out of
                // the feature, and what lets somebody keep two pieces of work
                // open in two tabs. It is also what `check:appnav` needs -- an
                // entry can only be offered for a path the router can match, so
                // a room that lived only in component state could never be one.
                //
                // Deliberately NOT in the sidebar: the rooms are the page's own
                // navigation, and thirty of them in the platform rail would be
                // thirty entries nobody can scan. It is in the section's `match`
                // so the sidebar stays on AI Chat while a room is open.
                path: 'ai-chat/:roomId',
                name: 'AiChatRoom',
                component: AiChat,
                meta: { title: 'AI Chat Assistant', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['ai_feature'] }
            },
            {
                // Public on purpose — no `requiresSubscription`, no
                // `requiredFeatures`, and `requiresAuth: false`. A signed-out
                // visitor can listen to the whole bulletin.
                path: 'newscast',
                name: 'Newscast',
                component: Newscast,
                meta: { title: 'Newscast', requiresAuth: false }
            },
            // Research Flow Routes
            {
                path: 'research',
                name: 'ResearchFlow',
                component: ResearchFlow,
                meta: { title: 'Research Flow', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/my-projects',
                name: 'ResearchMyProjects',
                component: ResearchMyProjects,
                meta: { title: 'My Research Projects', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/search',
                name: 'ResearchSearchProjects',
                component: ResearchSearchProjects,
                meta: { title: 'Search Research Projects', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/library',
                name: 'ResearchLibrary',
                component: ResearchLibrary,
                meta: { title: 'My Research Library', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/collaboration',
                name: 'ResearchCollaboration',
                component: ResearchCollaboration,
                meta: { title: 'Collaboration', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/project/:id',
                name: 'ResearchProjectDetails',
                component: ResearchProjectDetails,
                meta: { title: 'Project Details', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] },
                props: true
            },
            {
                path: 'research/create-project',
                name: 'ResearchCreateProject',
                component: ResearchCreateProject,
                meta: { title: 'Create Research Project', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/import-openalex',
                name: 'ResearchImportOpenAlex',
                component: ResearchImportOpenAlex,
                meta: { title: 'Import from OpenAlex', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/google-scholar',
                name: 'ResearchGoogleScholar',
                component: ResearchGoogleScholar,
                meta: { title: 'Google Scholar Search', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/ai-writer',
                name: 'ResearchAIWriter',
                component: ResearchAIWriter,
                meta: { title: 'AI Research Writer', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/ai-writer/:id',
                name: 'ResearchAIWriterDetail',
                component: ResearchAIWriterDetail,
                meta: { title: 'AI Research Writer', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] },
                props: true
            },
            {
                path: 'research/researchers',
                name: 'ResearchResearchers',
                component: ResearchResearchers,
                meta: { title: 'Researchers', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/researcher/:userId',
                name: 'ResearchResearcherProfile',
                component: ResearchResearcherProfile,
                meta: { title: 'Researcher Profile', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] },
                props: true
            },
            {
                path: 'research/complete-profile',
                name: 'ResearchCompleteProfile',
                component: ResearchCompleteProfile,
                meta: { title: 'Complete Researcher Profile', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'research/profile',
                name: 'ResearchMyProfile',
                component: ResearchCompleteProfile,
                meta: { title: 'My Researcher Profile', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['research_flow_feature'] }
            },
            {
                path: 'login',
                name: 'Login',
                component: Login,
                meta: { title: 'Login', publicOnly: true }
            },
            {
                path: 'register',
                name: 'Register',
                component: Register,
                meta: { title: 'Register', publicOnly: true }
            },
            {
                path: 'verify-email',
                name: 'VerifyEmail',
                component: VerifyEmail,
                meta: { title: 'Verify Email' }
            },
            {
                path: 'toastmasters',
                name: 'Toastmasters',
                component: Toastmasters,
                meta: { title: 'Toastmasters', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['toastmasters_feature'] }
            },
            {
                path: 'toastmasters/pre-session',
                name: 'ToastmastersPreSession',
                component: ToastmastersPreSession,
                meta: { title: 'Prepare Session', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['toastmasters_feature'] }
            },
            {
                path: 'toastmasters/session',
                name: 'ToastmastersSession',
                component: ToastmastersSession,
                meta: { title: 'Toastmasters Session', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['toastmasters_feature'] }
            },
            {
                path: 'toastmasters/results',
                name: 'ToastmastersResults',
                component: ToastmastersResults,
                meta: { title: 'My Toastmasters Results', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['toastmasters_feature'] }
            },

            // Job Interview Routes (gated by ai_feature)
            {
                path: 'job-interview',
                name: 'JobInterview',
                component: JobInterview,
                meta: { title: 'Job Interview', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['ai_feature'] }
            },
            {
                path: 'job-interview/pre-session',
                name: 'JobInterviewPreSession',
                component: JobInterviewPreSession,
                meta: { title: 'Prepare Interview', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['ai_feature'] }
            },
            {
                path: 'job-interview/session',
                name: 'JobInterviewSession',
                component: JobInterviewSession,
                meta: { title: 'Job Interview Session', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['ai_feature'] }
            },
            {
                path: 'job-interview/results',
                name: 'JobInterviewResults',
                component: JobInterviewResults,
                meta: { title: 'My Interview Results', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['ai_feature'] }
            },

            // Roblox Tool (gated by ai_feature)
            {
                path: 'roblox-tool',
                name: 'RobloxTool',
                component: RobloxTool,
                meta: { title: 'Roblox Animation Studio', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['ai_feature'] }
            },

            // CV Builder (gated by ai_feature)
            {
                path: 'cv-builder',
                name: 'CvBuilder',
                component: CvBuilder,
                meta: { title: 'CV Builder', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['ai_feature'] }
            },
            {
                path: 'cv-builder/editor/:id',
                name: 'CvBuilderEditor',
                component: CvBuilderEditor,
                meta: { title: 'CV Builder', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['ai_feature'] },
                props: true
            },

            // Drawing papers (app 34). Auth only — no requiresSubscription and no
            // requiredFeatures, so `subscription-guard.ts` lets any signed-in user
            // through. This is the only feature page on the platform that is free,
            // which is why it is worth stating rather than leaving to be inferred
            // from the absence of two keys.
            {
                path: 'draw',
                name: 'DrawPapers',
                component: DrawPapers,
                meta: { title: 'Drawing Papers', requiresAuth: true }
            },
            {
                path: 'draw/paper/:id',
                name: 'DrawBoard',
                component: DrawBoard,
                meta: { title: 'Drawing Paper', requiresAuth: true },
                props: true
            },
            {
                // A share link lands here to have its token resolved into a paper id,
                // then replaces itself with DrawBoard. requiresAuth, because the
                // backend needs an X-User-ID to attribute strokes to — a link grants
                // access to a paper, it does not replace signing in.
                path: 'draw/shared/:token',
                name: 'DrawShared',
                component: DrawShared,
                meta: { title: 'Shared Paper', requiresAuth: true },
                props: true
            },

            // Messages (app 35 — Self Study User Chat).
            //
            // `requiresAuth` and nothing else, like Drawing Papers above: talking
            // to your classmates is free with an account. That is deliberate, not
            // an omission — a study platform where students cannot message each
            // other without paying is not much of a study platform.
            //
            // NOT the support chat. That is app 9, and it is the ChatBox widget
            // that floats on every page rather than a route.
            {
                path: 'messages',
                name: 'Messages',
                component: Messages,
                // hideSupportChat: the app-9 widget's toggle is a fixed circle in
                // the bottom-right corner and sits exactly on top of this page's
                // microphone button. See DefaultLayout.vue.
                meta: { title: 'Messages', requiresAuth: true, hideSupportChat: true }
            },
            {
                // The same component, with a room open. A separate named route
                // rather than an optional parameter so a notification's deep link
                // (`/#/messages/<room_id>`, built by the backend's utils/notify.py)
                // resolves to something the router can name.
                path: 'messages/:roomId',
                name: 'MessageRoom',
                component: Messages,
                meta: { title: 'Messages', requiresAuth: true, hideSupportChat: true },
                props: true
            },

            // Network Simulator (gated by lab_feature)
            {
                path: 'network-simulator',
                name: 'NetworkSimulator',
                component: NetworkSimulator,
                meta: { title: 'Network Simulator', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['lab_feature'] }
            },
            {
                path: 'network-simulator/learn',
                name: 'NetworkSimulatorLearn',
                component: NetworkSimulatorLearn,
                meta: { title: 'Network Simulator — Learn', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['lab_feature'] }
            },
            {
                path: 'network-simulator/studio/:id?',
                name: 'NetworkSimulatorStudio',
                component: NetworkSimulatorStudio,
                meta: { title: 'Network Simulator Studio', requiresAuth: true, requiresSubscription: true, requiredFeatures: ['lab_feature'] },
                props: true
            }

        ]
    },
    {
        path: '/:catchAll(.*)',
        redirect: '/'
    }
];

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes
});

router.beforeEach(async (to, from, next) => {
    document.title = `${to.meta.title} | Self Study JO`;
    const isRunbookDetailsRoute = to.name === 'RunbookDetails';
    if (to.meta.publicOnly) {
        publicOnlyGuard(to, from, next);
    } else if (to.meta.requiresAuth === true || (isRunbookDetailsRoute && to.params.id)) {
        await authGuard(to, from, next);
    } else {
        next();
    }
});

export default router;