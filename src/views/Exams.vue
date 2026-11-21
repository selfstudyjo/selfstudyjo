<template>
  <div class="exams-page">
    <div class="page-header">
      <h1 class="page-title">{{ $t('Exams') }}</h1>
      <p class="page-subtitle">{{ $t('View and schedule your exams') }}</p>
    </div>

    <!--
      TWO WAYS TO SIT AN EXAM, said once at the top rather than discovered at
      the end. The difference that matters to a student is the certificate, so
      that is what each card leads with.
    -->
    <div class="exam-modes" role="note">
      <div class="exam-mode exam-mode--proctored">
        <div class="exam-mode__title">🎓 {{ $t('Proctored exam') }}</div>
        <p>{{ $t('Book an appointment with an available proctor and sit the exam at that time. Pass it and your certificate is issued automatically.') }}</p>
      </div>
      <div class="exam-mode exam-mode--practice">
        <div class="exam-mode__title">📝 {{ $t('Practice exam') }}</div>
        <p>{{ $t('Start right away with any active subscription - no appointment, no proctor. Your score is recorded and earns points like a quiz, but no certificate is issued.') }}</p>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="search-container">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="$t('Search exams by title or course...')"
          class="search-input"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="search-clear"
          :aria-label="$t('Clear search')"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>{{ $t('Loading exams...') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">❌</div>
      <h3>{{ $t('Error Loading Exams') }}</h3>
      <p>{{ error }}</p>
      <button @click="loadExams" class="retry-btn">{{ $t('Retry') }}</button>
    </div>

    <!-- Empty State (no exams at all) -->
    <div v-else-if="exams.length === 0" class="empty-container">
      <div class="empty-icon">📝</div>
      <h3>{{ $t('No Exams Available') }}</h3>
      <p>{{ $t('There are no exams available at the moment.') }}</p>
    </div>

    <!-- Empty Search State -->
    <div v-else-if="filteredExams.length === 0" class="empty-container">
      <div class="empty-icon">🔍</div>
      <h3>{{ $t('No Matching Exams') }}</h3>
      <p>{{ $t('No exams match your search "{v0}".', { v0: searchQuery }) }}</p>
      <button @click="searchQuery = ''" class="retry-btn">{{ $t('Clear Search') }}</button>
    </div>

    <!-- Exams List -->
    <div v-else class="exams-container">
      <div class="exams-grid">
        <div
          v-for="exam in filteredExams"
          :key="exam.external_id"
          class="exam-card"
        >
          <div class="exam-header">
            <div class="exam-icon">📚</div>
            <div class="exam-title-section">
              <h3 class="exam-title">{{ $td(exam) }}</h3>
              <p class="exam-course">{{ $t('Course: {v0}', { v0: exam.course_name || exam.course_id }) }}</p>
            </div>
            <div v-if="isAuthenticated" class="exam-status" :class="getExamStatusClass(exam)">
              {{ getExamStatus(exam) }}
            </div>
          </div>

          <div class="exam-details">
            <div class="detail-row">
              <span class="detail-label">{{ $t('Duration:') }}</span>
              <span class="detail-value">{{ $t('{v0} minutes', { v0: exam.exam_duration }) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ $t('Instructions:') }}</span>
              <span class="detail-value truncated">{{ $td(exam, 'exam_instructions') }}</span>
            </div>

            <!-- Show times taken only for authenticated users -->
            <div v-if="isAuthenticated" class="detail-row">
              <span class="detail-label">{{ $t('Times Taken:') }}</span>
              <span class="detail-value">{{ getExamAttempts(exam) }}</span>
            </div>

            <!-- Display latest score if user has taken exam -->
            <div v-if="isAuthenticated && getLatestUserResult(exam)?.result_status === 'PASSED'" class="score-display">
              <span class="score-label">{{ $t('Your Latest Score:') }}</span>
              <span class="score-value passed">{{ getLatestUserResult(exam)?.score }}%</span>
            </div>

            <div v-else-if="isAuthenticated && getLatestUserResult(exam)?.result_status === 'FAILED'" class="score-display">
              <span class="score-label">{{ $t('Your Latest Score:') }}</span>
              <span class="score-value failed">{{ getLatestUserResult(exam)?.score }}%</span>
            </div>

            <!-- Practice is its own line: a practice pass earns no certificate
                 and must not read as the proctored result above. -->
            <div v-if="isAuthenticated && getBestPracticeResult(exam)" class="detail-row practice-row">
              <span class="detail-label">{{ $t('Best practice score:') }}</span>
              <span class="detail-value">
                {{ $t('{v0}% ({v1} attempts)', { v0: getBestPracticeResult(exam)?.score, v1: getPracticeAttempts(exam) }) }}
              </span>
            </div>

            <!-- Display next appointment if scheduled -->
            <div v-if="isAuthenticated && getActiveAppointment(exam)" class="appointment-info">
              <div class="appointment-label">{{ $t('Next Appointment:') }}</div>
              <div class="appointment-details">
                <div class="appointment-date">
                  {{ formatDate(getActiveAppointment(exam)?.appointment_date) }}
                </div>
                <div class="appointment-status" :class="getAppointmentStatusClass(getActiveAppointment(exam))">
                  {{ getActiveAppointment(exam)?.appointment_status }}
                </div>
              </div>
            </div>
          </div>

          <div class="exam-actions">

            <!-- Schedule or Start button based on status -->
            <template v-if="isAuthenticated">
              <template v-if="getLatestUserResult(exam)?.result_status === 'PASSED'">
                <button class="btn-completed" disabled>
                  <span>{{ $t('Completed') }}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </template>
              <template v-else-if="hasScheduledAppointment(exam)">
                <div class="appointment-actions">
                  <!-- Start Exam button (only appears 30 minutes before appointment AND can_start is true) -->
                  <button
                    v-if="canStartExam(exam)"
                    @click="startExam(exam)"
                    class="btn-start"
                  >
                    <span>{{ $t('Start Exam') }}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M14.752 11.168L9.192 7.108C8.892 6.9 8.5 7.1 8.5 7.44V16.56C8.5 16.9 8.892 17.1 9.192 16.892L14.752 12.832C15.068 12.6 15.068 12.4 14.752 12.168Z"
                            fill="currentColor"/>
                    </svg>
                  </button>
                  <button
                    v-else
                    @click="viewAppointment(exam)"
                    class="btn-scheduled"
                  >
                    <span>{{ $t('View Appointment') }}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <button v-if="canCancelAppointment(exam)" @click="cancelExam(exam)" class="btn-cancel-appointment">
                    <span>{{ $t('Cancel appointment') }}</span>
                  </button>
                </div>
              </template>
              <template v-else>
                <!-- Show schedule button for all other cases (no appointment, expired, cancelled, etc.) -->
                <button @click="scheduleExam(exam)" class="btn-schedule" :disabled="!shouldShowScheduleButton(exam)">
                  <span>{{ getScheduleButtonText(exam) }}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 8V12M12 12V16M12 12H16M12 12H8M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                </button>
              </template>
              <!-- PRACTICE, always available beside the proctored path: no
                   appointment, no approval, and never a certificate. Needs any
                   active subscription, which the route's guard checks. -->
              <button @click="practiceExam(exam)" class="btn-practice"
                      :title="$t('Practice now - no appointment, no certificate')">
                <span>{{ $t('Practice now') }}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M14.752 11.168L9.192 7.108C8.892 6.9 8.5 7.1 8.5 7.44V16.56C8.5 16.9 8.892 17.1 9.192 16.892L14.752 12.832C15.068 12.6 15.068 12.4 14.752 12.168Z"
                        fill="currentColor"/>
                </svg>
              </button>
            </template>
            <template v-else>
              <!-- For non-authenticated users, show login to schedule button -->
              <button @click="goToLogin" class="btn-schedule">
                <span>{{ $t('Login to Schedule') }}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { examService, isPracticeResult, type Exam, type UserExamResult, type ExamAppointment } from '@/services/exam.service';
import { notificationService } from '@/services/notification.service';

// Import CSS
import '@/assets/css/exams.css';
// Structural + responsive fixes shared by the eight exam-system pages.
// Imported AFTER the page stylesheet on purpose - see the header of the file.
import '@/assets/css/exam-system.css';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref<string | null>(null);
const exams = ref<Exam[]>([]);
const userResults = ref<UserExamResult[]>([]);
const appointments = ref<ExamAppointment[]>([]);

// Search query. `?q=` pre-fills it: the top bar's site search links an exam
// here, filtered to that exam's (English) title, because an exam has no page
// of its own - it is booked, practised and sat from this list.
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '');
watch(() => route.query.q, value => {
  if (typeof value === 'string') searchQuery.value = value;
});

// Filtered exams based on search query
const filteredExams = computed(() => {
  if (!searchQuery.value.trim()) {
    return exams.value;
  }
  const query = searchQuery.value.toLowerCase().trim();
  return exams.value.filter(exam => {
    const title = exam.title?.toLowerCase() || '';
    const courseName = exam.course_name?.toLowerCase() || '';
    const courseId = exam.course_id?.toLowerCase() || '';
    return title.includes(query) || courseName.includes(query) || courseId.includes(query);
  });
});

const userId = computed(() => authStore.user?.id);
const username = computed(() => authStore.user?.username);
const isAuthenticated = computed(() => authStore.isAuthenticated);

// Watch for authentication changes to reload data
watch(isAuthenticated, (newVal) => {
  if (newVal) {
    loadExams();
  }
});

onMounted(() => {
  loadExams();
});

async function loadExams() {
  loading.value = true;
  error.value = null;

  try {
    // Load exams (public data)
    const examsData = await examService.getExams();
    exams.value = examsData;

    // Load user-specific data only if authenticated
    if (isAuthenticated.value && userId.value) {
      const [resultsData, appointmentsData] = await Promise.all([
        examService.getUserExamResults(userId.value),
        examService.getExamAppointments(userId.value)
      ]);

      // Store results and appointments
      userResults.value = resultsData;
      appointments.value = appointmentsData;

      // Check for expired appointments and update if needed
      await checkAndUpdateExpiredAppointments(appointmentsData);

      // And remind anybody whose exam is imminent. Deliberately after the expiry
      // sweep, so a just-expired appointment is never reminded about.
      remindAboutImminentExams(appointments.value);
    } else {
      // Clear user-specific data if not authenticated
      userResults.value = [];
      appointments.value = [];
    }
  } catch (err: any) {
    console.error('Failed to load exams:', err);
    error.value = err.message || 'Failed to load exams';
  } finally {
    loading.value = false;
  }
}

/** How soon an exam has to be before it is worth ringing a bell about. */
const REMINDER_WINDOW_HOURS = 24;
const REMINDER_KEY = 'sfs.exam.reminded';

/**
 * Remind the student about an exam starting within the next day.
 *
 * There is no scheduler anywhere on this platform (working rule 18), so this
 * fires from a page load - which means the *only* thing standing between it and
 * a bell on every single visit is the dedupe below. Working rule 25 in one line:
 * a notification needs an ARRIVAL, and "this appointment is still soon" is not
 * one. So an appointment is remembered once it has been reminded about, keyed on
 * its id AND its scheduled time, so a reschedule legitimately re-arms it while a
 * reload does not.
 *
 * Stored per user, because a shared browser would otherwise silence one student's
 * reminder because another had already had it.
 */
function remindAboutImminentExams(rows: ExamAppointment[]) {
  try {
    const me = authStore.user?.username;
    if (!me) return;

    const key = `${REMINDER_KEY}.${me}`;
    let sent: Record<string, number> = {};
    try {
      sent = JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch {
      sent = {};
    }

    const now = Date.now();
    const horizon = now + REMINDER_WINDOW_HOURS * 3600 * 1000;
    let changed = false;

    for (const row of rows || []) {
      if (row.appointment_status !== 'Scheduled') continue;
      const at = new Date(row.appointment_date).getTime();
      if (!Number.isFinite(at) || at < now || at > horizon) continue;

      // The time is part of the mark: a rescheduled appointment is a new arrival.
      const mark = `${row.external_id}@${at}`;
      if (sent[mark]) continue;

      notificationService.notify('exam.starting_soon', {
        to: me,
        params: {
          exam: row.exam_title || row.exam || 'your exam',
          when: new Date(at).toLocaleString(),
        },
      });
      sent[mark] = now;
      changed = true;
    }

    if (changed) {
      // Bounded, or this grows for the life of the browser. A mark older than a
      // week cannot be for an appointment still inside a 24-hour window.
      const week = 7 * 24 * 3600 * 1000;
      const pruned = Object.fromEntries(
        Object.entries(sent).filter(([, when]) => now - Number(when) < week)
      );
      localStorage.setItem(key, JSON.stringify(pruned));
    }
  } catch {
    // A reminder is a nicety. It must never break the exams list.
  }
}

async function checkAndUpdateExpiredAppointments(appointmentsData: ExamAppointment[]) {
  const now = new Date();
  const updatePromises = [];

  for (const appointment of appointmentsData) {
    const appointmentDate = new Date(appointment.appointment_date);

    // Only update if appointment is in the past AND status is "Scheduled"
    // Do NOT update if status is: "In Progress", "Taken but Failed", "Completed", or "Cancelled"
    if (appointmentDate < now && appointment.appointment_status === 'Scheduled') {
      try {
        console.log(`Updating expired appointment: ${appointment.external_id}`);
        const updatePromise = examService.updateExamAppointment(appointment.external_id, {
          appointment_status: 'Expired',
          can_start: false
        });
        updatePromises.push(updatePromise);
      } catch (err) {
        console.error(`Failed to update expired appointment ${appointment.external_id}:`, err);
      }
    }
  }

  // Wait for all updates to complete
  if (updatePromises.length > 0) {
    try {
      await Promise.all(updatePromises);
      // Reload appointments after updates
      if (userId.value) {
        appointments.value = await examService.getExamAppointments(userId.value);
      }
    } catch (err) {
      console.error('Failed to update some expired appointments:', err);
    }
  }
}

function getExamStatus(exam: Exam): string {
  if (!isAuthenticated.value) {
    return 'Available';
  }

  // Check for latest result first
  const latestResult = getLatestUserResult(exam);
  if (latestResult?.result_status === 'PASSED') {
    return 'Passed';
  }

  // Check for active appointment
  const activeAppointment = getActiveAppointment(exam);
  if (activeAppointment) {
    // Check if appointment status is "Completed" and user passed
    if (activeAppointment.appointment_status === 'Completed' && latestResult?.result_status === 'PASSED') {
      return 'Completed & Passed';
    }
    return activeAppointment.appointment_status;
  }

  // Check if user has failed
  if (latestResult?.result_status === 'FAILED') {
    return 'Failed';
  }

  return 'Not Taken';
}

function getExamStatusClass(exam: Exam): string {
  if (!isAuthenticated.value) {
    return 'status-not-taken';
  }

  const status = getExamStatus(exam).toLowerCase();
  switch (status) {
    case 'passed':
    case 'completed & passed':
      return 'status-passed';
    case 'failed':
    case 'taken but failed':
      return 'status-failed';
    case 'scheduled':
      return 'status-scheduled';
    case 'in progress':
      return 'status-in-progress';
    case 'completed':
      return 'status-completed';
    case 'cancelled':
      return 'status-cancelled';
    case 'expired':
      return 'status-expired';
    case 'no reservation yet':
      return 'status-not-taken';
    default:
      return 'status-not-taken';
  }
}

function getAppointmentStatusClass(appointment: ExamAppointment | undefined): string {
  if (!appointment) return '';
  return appointment.appointment_status.toLowerCase().replace(/\s+/g, '-');
}

/**
 * The latest PROCTORED result. Everything that decides status, "Completed" and
 * whether a booking is still offered reads this, so a practice pass can never
 * stand in for the proctored exam that earns the certificate.
 */
function getLatestUserResult(exam: Exam): UserExamResult | undefined {
  const results = userResults.value
    .filter(result => result.exam === exam.external_id && result.user_id === userId.value
      && !isPracticeResult(result))
    .sort((a, b) => new Date(b.date_taken).getTime() - new Date(a.date_taken).getTime());
  return results[0];
}

function getUserAppointmentsForExam(exam: Exam): ExamAppointment[] {
  return appointments.value
    .filter(app => app.exam === exam.external_id && app.user_id === userId.value)
    .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());
}

function getActiveAppointment(exam: Exam): ExamAppointment | undefined {
  // Get all appointments for this exam for the current user
  const userAppointments = getUserAppointmentsForExam(exam);

  // Priority 1: Scheduled appointments (future appointments that are still active)
  const scheduledAppointments = userAppointments.filter(app =>
    app.appointment_status === 'Scheduled'
  );

  if (scheduledAppointments.length > 0) {
    // Return the most recent scheduled appointment
    return scheduledAppointments[0];
  }

  // Priority 2: In Progress appointments
  const inProgressAppointments = userAppointments.filter(app =>
    app.appointment_status === 'In Progress'
  );

  if (inProgressAppointments.length > 0) {
    return inProgressAppointments[0];
  }

  // Priority 3: Other active statuses
  const otherActiveAppointments = userAppointments.filter(app =>
    app.appointment_status === 'Taken but Failed' ||
    app.appointment_status === 'No Reservation Yet'
  );

  if (otherActiveAppointments.length > 0) {
    return otherActiveAppointments[0];
  }

  // If no active appointments, return undefined
  return undefined;
}

function hasScheduledAppointment(exam: Exam): boolean {
  const appointment = getActiveAppointment(exam);
  if (!appointment) return false;

  // Only show appointment actions for Scheduled or In Progress appointments
  return appointment.appointment_status === 'Scheduled' ||
         appointment.appointment_status === 'In Progress';
}

function getExamAttempts(exam: Exam): number {
  // Proctored attempts only; practice is counted on its own line.
  return userResults.value.filter(result =>
    result.exam === exam.external_id && result.user_id === userId.value
    && !isPracticeResult(result)
  ).length;
}

function getPracticeResults(exam: Exam): UserExamResult[] {
  return userResults.value.filter((result: UserExamResult) =>
    result.exam === exam.external_id && result.user_id === userId.value
    && isPracticeResult(result));
}

function getPracticeAttempts(exam: Exam): number {
  return getPracticeResults(exam).length;
}

/** The best practice score, earliest on a tie - the leaderboard's own rule. */
function getBestPracticeResult(exam: Exam): UserExamResult | undefined {
  return [...getPracticeResults(exam)].sort((a, b) =>
    (Number(b.score) - Number(a.score))
    || (new Date(a.date_taken).getTime() - new Date(b.date_taken).getTime()))[0];
}

/**
 * Open a practice sitting. No appointment, no proctor and no certificate; the
 * route's guard sends somebody without an active subscription to the plans.
 */
function practiceExam(exam: Exam) {
  if (!isAuthenticated.value) {
    goToLogin();
    return;
  }
  router.push({ path: '/practice-exam', query: { examId: exam.external_id } });
}

function canCancelAppointment(exam: Exam): boolean {
  if (!isAuthenticated.value) return false;

  const appointment = getActiveAppointment(exam);
  if (!appointment || appointment.appointment_status !== 'Scheduled') return false;

  const appointmentDate = new Date(appointment.appointment_date);
  const now = new Date();
  const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;

  // Calculate time difference
  const timeDiff = appointmentDate.getTime() - now.getTime();

  // Allow cancellation if more than 2 days remaining
  return timeDiff > twoDaysInMs;
}

function getScheduleButtonText(exam: Exam): string {
  const appointment = getActiveAppointment(exam);
  if (appointment) {
    const reschedulableStatuses = ['Expired', 'Cancelled', 'Taken but Failed', 'No Reservation Yet'];
    if (reschedulableStatuses.includes(appointment.appointment_status)) {
      return 'Reschedule Exam';
    }
  }
  return 'Schedule Exam';
}

function shouldShowScheduleButton(exam: Exam): boolean {
  if (!isAuthenticated.value) return false;

  // Don't show schedule button if user has passed
  if (getLatestUserResult(exam)?.result_status === 'PASSED') {
    return false;
  }

  const appointment = getActiveAppointment(exam);

  // Don't show schedule button if appointment status is "Completed" or "In Progress"
  if (appointment) {
    const nonScheduleStatuses = ['Completed', 'In Progress'];
    if (nonScheduleStatuses.includes(appointment.appointment_status)) {
      return false;
    }
  }

  // Show schedule button if:
  // 1. No active appointment exists, OR
  // 2. Appointment is in a state that allows rescheduling
  if (!appointment) return true;

  const allowedStatuses = ['Expired', 'Cancelled', 'Taken but Failed', 'No Reservation Yet'];
  return allowedStatuses.includes(appointment.appointment_status);
}


function scheduleExam(exam: Exam) {
  if (!isAuthenticated.value) {
    goToLogin();
    return;
  }

  router.push({
    path: '/schedule-exam',
    query: { examId: exam.external_id }
  });
}


async function cancelExam(exam: Exam) {
  if (!isAuthenticated.value) {
    goToLogin();
    return;
  }

  const appointment = getActiveAppointment(exam);
  if (!appointment || appointment.appointment_status !== 'Scheduled') {
    alert('This appointment cannot be cancelled.');
    return;
  }

  const appointmentDate = new Date(appointment.appointment_date);
  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (confirm(`Are you sure you want to cancel your ${exam.title} appointment on ${formattedDate}? This action cannot be undone.`)) {
    try {
      await examService.cancelExamAppointment(appointment.external_id);
      // Reload data
      await loadExams();
      alert('Appointment cancelled successfully.');
    } catch (error: any) {
      console.error('Failed to cancel appointment:', error);
      alert('Failed to cancel appointment: ' + (error.message || 'Unknown error'));
    }
  }
}

function viewAppointment(exam: Exam) {
  if (!isAuthenticated.value) {
    goToLogin();
    return;
  }

  const appointment = getActiveAppointment(exam);
  if (appointment && (appointment.appointment_status === 'Scheduled' || appointment.appointment_status === 'In Progress')) {
    router.push({
      path: '/exam-approval',
      query: { appointmentId: appointment.external_id }
    });
  }
}

function startExam(exam: Exam) {
  if (!isAuthenticated.value) {
    goToLogin();
    return;
  }

  const appointment = getActiveAppointment(exam);
  if (appointment) {
    router.push({
      path: '/take-exam',
      query: {
        examId: exam.external_id,
        appointmentId: appointment.external_id
      }
    });
  }
}

function canStartExam(exam: Exam): boolean {
  if (!isAuthenticated.value) return false;

  const appointment = getActiveAppointment(exam);
  if (!appointment) return false;

  // Check if can_start is true
  if (!appointment.can_start) return false;

  const appointmentTime = new Date(appointment.appointment_date).getTime();
  const currentTime = new Date().getTime();
  const thirtyMinutesBefore = appointmentTime - (30 * 60 * 1000);

  return currentTime >= thirtyMinutesBefore && currentTime <= appointmentTime;
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function goToLogin() {
  // Send the user to the login page, remembering where they came from
  // and showing a friendly notice on the login screen.
  router.push({
    path: '/login',
    query: {
      redirect: '/exams',
      message: 'You need to login first to schedule an exam.'
    }
  });
}
</script>

<style scoped>
.exams-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.appointment-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 12px;
}

.appointment-detail-grid .detail-item {
  display: flex;
  flex-direction: column;
}

.appointment-detail-grid .detail-label {
  font-size: 14px;
  color: var(--sfs-accent-text, #718096);
  margin-bottom: 4px;
}

.appointment-detail-grid .detail-value {
  font-size: 14px;
  font-weight: 500;
  color: #1a202c;
}

.history-container {
  margin-top: 12px;
  border: 1px solid var(--sfs-border-strong, #e2e8f0);
  border-radius: 8px;
  overflow: hidden;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--sfs-border-strong, #e2e8f0);
}

.history-item:last-child {
  border-bottom: none;
}

.history-date {
  font-size: 14px;
  color: var(--sfs-accent-text, #4a5568);
}

.history-status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.history-status.scheduled {
  background-color: var(--sfs-paper, #ebf8ff);
  color: var(--sfs-accent-on-paper, #2b6cb0);
}

.history-status.cancelled {
  background-color: var(--sfs-danger-wash, #fed7d7);
  color: var(--sfs-danger-on-paper, #c53030);
}

.history-status.expired {
  background-color: var(--sfs-danger-wash, #fed7d7);
  color: var(--sfs-danger-on-paper, #c53030);
}

.history-status.completed {
  background-color: var(--sfs-success-wash, #c6f6d5);
  color: var(--sfs-success-on-paper, #276749);
}

.status-in-progress {
  background-color: var(--sfs-warning-wash, #fefcbf);
  color: var(--sfs-warning-on-paper, #744210);
}
</style>