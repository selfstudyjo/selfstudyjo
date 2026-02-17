import { createRouter, createWebHistory } from 'vue-router';
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
                meta: { title: 'Courses', requiresAuth: false } // Public
            },
            {
                path: 'runbooks',
                name: 'Runbooks',
                component: Runbooks,
                meta: { title: 'Runbooks', requiresAuth: false } // Public
            },
            {
                path: 'runbooks/:id',
                name: 'RunbookDetails',
                component: RunbookDetails,
                meta: { title: 'Runbook Details', requiresAuth: false }, // Public
                props: true
            },
            {
                path: 'labs',
                name: 'Labs',
                component: Labs,
                meta: { title: 'Labs', requiresAuth: true }
            },
            {
                path: 'course/:id',
                name: 'CourseDetails',
                component: CourseDetails,
                meta: { title: 'Course Details', requiresAuth: false } // Public
            },
            {
                path: 'course/:courseId/lesson/:lessonId/homework',
                name: 'Homework',
                component: HomeworkView,
                meta: { title: 'Homework', requiresAuth: true },
                props: (route) => ({
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
                meta: { title: 'All Certificates', requiresAuth: false } // Public
            },
            {
                path: 'exams',
                name: 'Exams',
                component: Exams,
                meta: { title: 'Exams', requiresAuth: false } // Public
            },
            {
                path: 'schedule-exam',
                name: 'ScheduleExam',
                component: ScheduleExam,
                meta: { title: 'Schedule Exam', requiresAuth: true }
            },
            {
                path: 'exam-approval',
                name: 'ExamApproval',
                component: ExamApproval,
                meta: { title: 'Exam Approval', requiresAuth: true }
            },
            {
                path: 'take-exam',
                name: 'TakeExam',
                component: TakeExam,
                meta: { title: 'Take Exam', requiresAuth: true }
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
                meta: { title: 'Subscription Plans', requiresAuth: false } // Public
            },
            {
                path: 'payment',
                name: 'Payment',
                component: Payment,
                meta: { title: 'Payment', requiresAuth: true },
                props: (route) => ({
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
            // ADD LOGIN AND REGISTER HERE TOO - THIS IS THE KEY CHANGE
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
            }
        ]
    },
{
    path: '/:catchAll(.*)',
    redirect: '/'
}
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL), // 👈 dynamic base
                            routes
});

// Global navigation guards
router.beforeEach(async (to, from, next) => {
    // Update page title
    document.title = `${to.meta.title} | Self Study JO`;

    // Check if this is the runbook details route
    const isRunbookDetailsRoute = to.name === 'RunbookDetails';

if (to.meta.publicOnly) {
    publicOnlyGuard(to, from, next);
} else if (to.meta.requiresAuth === true || (isRunbookDetailsRoute && to.params.id)) {
    await authGuard(to, from, next);
} else {
    // For routes without authentication requirement (like Exams, Courses)
    next();
}
});

export default router;
