import { createRouter, createWebHashHistory } from 'vue-router';
import { authGuard, publicOnlyGuard } from './guard';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import Home from '../views/Home.vue';
import Courses from '../views/Courses.vue';
import CourseDetails from '../views/CourseDetails.vue';
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
import ResearchResearchers from '../views/ResearchResearchers.vue';
import ResearchResearcherProfile from '../views/ResearchResearcherProfile.vue';
import ResearchCompleteProfile from '../views/ResearchCompleteProfile.vue';

import Toastmasters from '../views/Toastmasters.vue';
import ToastmastersPreSession from '../views/ToastmastersPreSession.vue';
import ToastmastersSession from '../views/ToastmastersSession.vue';
import ToastmastersResults from '../views/ToastmastersResults.vue';


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
                path: 'course/:id',
                name: 'CourseDetails',
                component: CourseDetails,
                meta: { title: 'Course Details', requiresAuth: false }
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
            }

        ]
    },
    {
        path: '/:catchAll(.*)',
        redirect: '/'
    }
];

const router = createRouter({
    // ✅ Use hash history for GitHub Pages compatibility
    // URLs become /#/courses instead of /courses
    // This makes refresh work on any route since the server only sees '/'
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