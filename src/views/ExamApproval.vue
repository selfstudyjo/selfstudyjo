<template>
  <div class="exam-approval-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Exam Approval</h1>
        <p class="page-subtitle">Review instructions and get ready for your exam</p>
        <div class="timer-display" v-if="appointment">
          <div class="timer-label">Exam starts in:</div>
          <div class="timer" :class="getTimerClass(timeUntilStart)">
            {{ formatTimeRemaining(timeUntilStart) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading exam details...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">❌</div>
      <h3>Error Loading Exam</h3>
      <p>{{ error }}</p>
      <button @click="loadExamDetails" class="retry-btn">Retry</button>
    </div>

    <!-- Main Content -->
    <div v-else-if="exam && appointment" class="approval-content">
      <div class="approval-grid">
        <!-- Left Column: Exam Details -->
        <div class="left-column">
          <div class="exam-info-card">
            <div class="card-header">
              <h2>{{ exam.title }}</h2>
              <div class="exam-status" :class="appointment.appointment_status.toLowerCase().replace(/\s+/g, '-')">
                {{ appointment.appointment_status }}
              </div>
            </div>

            <div class="card-body">
              <div class="info-section">
                <h3>Exam Information</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">Course</div>
                    <div class="info-value">{{ exam.course_name || exam.course_id }}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Duration</div>
                    <div class="info-value">{{ exam.exam_duration }} minutes</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Scheduled Time</div>
                    <div class="info-value">{{ formatDateTime(appointment.appointment_date) }}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Proctor</div>
                    <div class="info-value">{{ appointment.proctor_name || appointment.proctor_id || 'Not assigned' }}</div>
                  </div>
                </div>
              </div>

              <div class="instructions-section">
                <h3>Exam Instructions</h3>
                <div class="instructions-content">
                  {{ exam.exam_instructions }}
                </div>
                <div class="instructions-note">
                  <p><strong>Important:</strong> Please read the full exam instructions carefully before starting your exam.</p>
                </div>
              </div>

              <!-- Video Instructions with Embed -->
              <div v-if="exam.video_instructions_url" class="video-section">
                <h3>Video Instructions</h3>
                <div class="video-container">
                  <div v-if="videoEmbed.canEmbed" class="video-embed-wrapper">
                    <div class="video-embed-container">
                      <iframe
                        :src="videoEmbed.embedUrl"
                        width="100%"
                        height="400"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        title="Exam Instructions Video"
                        referrerpolicy="strict-origin-when-cross-origin"
                      ></iframe>
                    </div>
                    <div class="video-embed-info">
                      <p>Watch the full video instructions before starting your exam.</p>
                    </div>
                  </div>
                  <div v-else class="video-link-container">
                    <div class="video-link-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                        <path d="M10 16.5L16 12L10 7.5V16.5ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
                              fill="currentColor"/>
                      </svg>
                    </div>
                    <div class="video-link-info">
                      <h4>Video Instructions</h4>
                      <p>This video cannot be embedded. Please watch it in a new tab.</p>
                      <a :href="exam.video_instructions_url" target="_blank" class="video-external-link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M18 13V19C18 20.1 17.1 21 16 21H5C3.89 21 3 20.1 3 19V8C3 6.9 3.89 6 5 6H11M15 3H21V9M10 14L21 3"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Watch Full Video Instructions
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Actions and Rooms -->
        <div class="right-column">
          <div class="action-card">
            <div class="card-header">
              <h2>Exam Rooms Setup</h2>
              <div class="room-status" :class="appointment.is_entered ? 'entered' : 'not-entered'">
                {{ appointment.is_entered ? 'Entered' : 'Not Entered' }}
              </div>
            </div>

            <div class="card-body">
              <!-- Rooms Container - Side by Side -->
              <div v-if="appointment.room_url_1 || appointment.room_url_2" class="rooms-container">
                <!-- Room 1: PC/Laptop Room -->
                <div v-if="appointment.room_url_1" class="room-section pc-room">
                  <div class="room-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                      <path d="M20 18C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H0V20H24V18H20ZM4 4H20V16H4V4Z"
                            fill="currentColor"/>
                    </svg>
                  </div>
                  <h3>PC/Laptop Room</h3>
                  <p class="room-description">For taking the exam and sharing your screen</p>
                  <a :href="appointment.room_url_1" target="_blank" class="room-link pc-link">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M18 13V19C18 20.1 17.1 21 16 21H5C3.89 21 3 20.1 3 19V8C3 6.9 3.89 6 5 6H11M15 3H21V9M10 14L21 3"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Join PC Room
                  </a>
                  <div class="room-instructions">
                    <h4>Instructions:</h4>
                    <ul>
                      <li>Join from your PC or laptop</li>
                      <li>Enable screen sharing</li>
                      <li>Keep this room open during exam</li>
                      <li>This is where you'll take the exam</li>
                    </ul>
                  </div>
                </div>

                <!-- Room 2: Mobile Room -->
                <div v-if="appointment.room_url_2" class="room-section mobile-room">
                  <div class="room-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                      <path d="M17 1.01L7 1C5.9 1 5 1.9 5 3V21C5 22.1 5.9 23 7 23H17C18.1 23 19 22.1 19 21V3C19 1.9 18.1 1.01 17 1.01ZM17 19H7V5H17V19Z"
                            fill="currentColor"/>
                    </svg>
                  </div>
                  <h3>Mobile Room</h3>
                  <p class="room-description">For proctor to monitor your office environment</p>
                  <a :href="appointment.room_url_2" target="_blank" class="room-link mobile-link">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M18 13V19C18 20.1 17.1 21 16 21H5C3.89 21 3 20.1 3 19V8C3 6.9 3.89 6 5 6H11M15 3H21V9M10 14L21 3"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Join Mobile Room
                  </a>
                  <div class="room-instructions">
                    <h4>Instructions:</h4>
                    <ul>
                      <li>Join from your mobile device</li>
                      <li>Enable camera and microphone</li>
                      <li>Point camera to show your office</li>
                      <li>Keep this room open during exam</li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- No Rooms Available -->
              <div v-else class="no-rooms">
                <div class="no-rooms-icon">🚫</div>
                <h3>No Rooms Available</h3>
                <p>Exam rooms will be assigned by your proctor.</p>
              </div>

              <!-- Updated Requirements Checklist -->
              <div class="requirements-section">
                <h3>System Requirements</h3>
                <div class="requirements-list">
                  <div class="requirement-item" :class="{ 'met': checkRequirement('camera') }">
                    <div class="requirement-check">
                      <span v-if="checkRequirement('camera')">✓</span>
                      <span v-else>•</span>
                    </div>
                    <div class="requirement-text">Webcam enabled on both devices</div>
                  </div>
                  <div class="requirement-item" :class="{ 'met': checkRequirement('microphone') }">
                    <div class="requirement-check">
                      <span v-if="checkRequirement('microphone')">✓</span>
                      <span v-else>•</span>
                    </div>
                    <div class="requirement-text">Microphone enabled on both devices</div>
                  </div>
                  <div class="requirement-item" :class="{ 'met': checkRequirement('internet') }">
                    <div class="requirement-check">
                      <span v-if="checkRequirement('internet')">✓</span>
                      <span v-else>•</span>
                    </div>
                    <div class="requirement-text">Stable internet connection on both devices</div>
                  </div>
                  <div class="requirement-item" :class="{ 'met': checkRequirement('browser') }">
                    <div class="requirement-check">
                      <span v-if="checkRequirement('browser')">✓</span>
                      <span v-else>•</span>
                    </div>
                    <div class="requirement-text">Modern browser (Chrome, Firefox, Edge) on both devices</div>
                  </div>
                  <div class="requirement-item">
                    <div class="requirement-check">•</div>
                    <div class="requirement-text"><strong>Join from two rooms:</strong> one room from your mobile (for proctor) and one room from your PC/laptop (for exam and screen sharing)</div>
                  </div>
                  <div class="requirement-item">
                    <div class="requirement-check">•</div>
                    <div class="requirement-text"><strong>Mobile camera setup:</strong> Open the mobile room on your mobile device, enable camera, and point it to show your entire office/room so the proctor can monitor your environment</div>
                  </div>
                  <div class="requirement-item">
                    <div class="requirement-check">•</div>
                    <div class="requirement-text"><strong>Screen sharing:</strong> From the PC/laptop room, enable screen sharing so the proctor can see your exam screen</div>
                  </div>
                </div>
                <div class="important-note">
                  <div class="note-icon">⚠️</div>
                  <div class="note-content">
                    <p><strong>Important:</strong> You must read the full Exam Instructions and watch the complete Video Instructions before starting your exam. Failure to follow these instructions may result in exam disqualification.</p>
                  </div>
                </div>
              </div>

              <!-- Reschedule Option -->
              <div v-if="canRescheduleAppointment" class="reschedule-section">
                <h3>Need to Reschedule?</h3>
                <div class="reschedule-info">
                  <p>You can reschedule your exam up to 2 days before the scheduled time.</p>
                  <button @click="rescheduleExam" class="btn-reschedule">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 8V12M12 12V16M12 12H16M12 12H8M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Reschedule Exam
                  </button>
                </div>
              </div>
            </div>

            <!-- Start Exam Button -->
            <div class="card-footer">
              <button @click="startExam"
                      :disabled="!appointment.can_start || startingExam"
                      class="start-exam-btn"
                      :class="{ 'enabled': appointment.can_start, 'disabled': !appointment.can_start }">
                <span v-if="!startingExam">
                  {{ appointment.can_start ? 'Start Exam' : 'Waiting for Proctor...' }}
                </span>
                <span v-else class="loading-text">
                  <span class="loading-dots"></span>
                  Starting Exam
                </span>
                <svg v-if="appointment.can_start && !startingExam" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>

              <div v-if="!appointment.can_start" class="waiting-message">
                <div class="waiting-icon">⏰</div>
                <p>The "Start Exam" button will be enabled when your proctor gives permission.</p>
                <p class="timer-note">You can start the exam up to 30 minutes before your scheduled time.</p>
              </div>
            </div>
          </div>

          <!-- Proctor Information -->
          <div v-if="appointment.proctor_id" class="proctor-card">
            <div class="card-header">
              <h2>Proctor Information</h2>
            </div>
            <div class="card-body">
              <div class="proctor-info">
                <div class="proctor-avatar">
                  {{ getProctorInitial(appointment.proctor_name || appointment.proctor_id) }}
                </div>
                <div class="proctor-details">
                  <h3>{{ appointment.proctor_name || appointment.proctor_id }}</h3>
                  <p>Your exam proctor</p>
                  <div class="proctor-contact">
                    <div class="contact-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"
                              fill="currentColor"/>
                      </svg>
                      <span>Email on request</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="proctor-instructions">
                <h4>Proctor Instructions</h4>
                <ul>
                  <li>The proctor will monitor both your mobile camera feed and PC screen</li>
                  <li>Keep both rooms open throughout the entire exam</li>
                  <li>Follow all instructions provided by the proctor</li>
                  <li>The proctor may pause or terminate the exam if rules are violated</li>
                  <li>Ensure your mobile camera shows your entire workspace</li>
                  <li>Do not disable screen sharing on your PC during the exam</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Back Button -->
    <div class="back-container">
      <button @click="goBack" class="back-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Back to Exams
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { examService, type Exam, type ExamAppointment } from '@/services/exam.service';
import { VideoEmbedService } from '@/utils/videoEmbed';

// Import CSS
import '@/assets/css/exam-approval.css';
// Structural + responsive fixes shared by the eight exam-system pages.
// Imported AFTER the page stylesheet on purpose - see the header of the file.
import '@/assets/css/exam-system.css';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref<string | null>(null);
const startingExam = ref(false);
const exam = ref<Exam | null>(null);
const appointment = ref<ExamAppointment | null>(null);
const checkInterval = ref<NodeJS.Timeout | null>(null);
const timeRemainingInterval = ref<NodeJS.Timeout | null>(null);
const videoEmbed = ref({
  canEmbed: false,
  embedUrl: null as string | null
});

const appointmentId = computed(() => route.query.appointmentId as string);

const timeUntilStart = computed(() => {
  if (!appointment.value) return 0;

  const appointmentTime = new Date(appointment.value.appointment_date).getTime();
  const currentTime = new Date().getTime();
  return Math.max(0, appointmentTime - currentTime);
});

const canRescheduleAppointment = computed(() => {
  if (!appointment.value) return false;

  const appointmentDate = new Date(appointment.value.appointment_date);
  const now = new Date();
  const twoDaysInMs = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds

  // Calculate time difference
  const timeDiff = appointmentDate.getTime() - now.getTime();

  // Allow rescheduling if more than 2 days remaining
  return timeDiff > twoDaysInMs &&
         appointment.value.appointment_status === 'Scheduled' &&
         appointment.value.appointment_status !== 'In Progress' &&
         appointment.value.appointment_status !== 'Completed';
});

onMounted(() => {
  loadExamDetails();
  startCheckingAppointment();
  startTimeRemainingUpdate();
});

onUnmounted(() => {
  if (checkInterval.value) {
    clearInterval(checkInterval.value);
  }
  if (timeRemainingInterval.value) {
    clearInterval(timeRemainingInterval.value);
  }
});

function startTimeRemainingUpdate() {
  // Update time remaining every second for live countdown
  timeRemainingInterval.value = setInterval(() => {
    // The computed property will update automatically
  }, 1000);
}

function getTimerClass(timeMs: number): string {
  if (timeMs === 0) return 'ready';
  if (timeMs < 30 * 60 * 1000) return 'warning'; // Less than 30 minutes
  if (timeMs < 2 * 24 * 60 * 60 * 1000) return 'normal'; // Less than 2 days
  return 'normal';
}

async function loadExamDetails() {
  if (!appointmentId.value) {
    error.value = 'No appointment specified';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // Load the appointment (now returns enriched data with names)
    const appointments = await examService.getExamAppointments(authStore.user?.id);
    appointment.value = appointments.find(a => a.external_id === appointmentId.value) || null;

    if (!appointment.value) {
      throw new Error('Appointment not found');
    }

    // Load the exam details (now returns enriched data with course name)
    exam.value = await examService.getExam(appointment.value.exam);

    // Setup video embed if available
    if (exam.value?.video_instructions_url) {
      const embedProps = VideoEmbedService.getVideoEmbedProps(exam.value.video_instructions_url);
      videoEmbed.value = {
        canEmbed: embedProps.canEmbed,
        embedUrl: embedProps.embedUrl
      };
    }
  } catch (err: any) {
    console.error('Failed to load exam details:', err);
    error.value = err.message || 'Failed to load exam details';
  } finally {
    loading.value = false;
  }
}

function startCheckingAppointment() {
  // Check appointment status every 30 seconds
  checkInterval.value = setInterval(async () => {
    try {
      if (appointment.value) {
        const appointments = await examService.getExamAppointments(authStore.user?.id);
        const updatedAppointment = appointments.find(a => a.external_id === appointmentId.value);

        if (updatedAppointment) {
          appointment.value = updatedAppointment;
        }
      }
    } catch (err) {
      console.warn('Failed to check appointment status:', err);
    }
  }, 30000);
}

function checkRequirement(requirement: string): boolean {
  switch (requirement) {
    case 'camera':
      return true;
    case 'microphone':
      return true;
    case 'internet':
      return navigator.onLine;
    case 'browser':
      const ua = navigator.userAgent;
      return ua.includes('Chrome') || ua.includes('Firefox') || ua.includes('Edg');
    default:
      return false;
  }
}

function getProctorInitial(proctorId: string): string {
  return proctorId.charAt(0).toUpperCase();
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Ready to start';

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  const parts = [];

  if (days > 0) {
    parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }
  if (seconds >= 0 && days === 0 && hours === 0) {
    // Only show seconds when we're under an hour
    parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  }

  return parts.join(' ');
}

async function startExam() {
  if (!appointment.value?.can_start || !exam.value) return;

  startingExam.value = true;

  try {
    router.push({
      path: '/take-exam',
      query: {
        examId: exam.value.external_id,
        appointmentId: appointment.value.external_id
      }
    });
  } catch (err) {
    console.error('Failed to start exam:', err);
    error.value = 'Failed to start exam. Please try again.';
    startingExam.value = false;
  }
}

function rescheduleExam() {
  if (!exam.value || !appointment.value) return;

  router.push({
    path: '/schedule-exam',
    query: {
      examId: exam.value.external_id,
      reschedule: true,
      appointmentId: appointment.value.external_id
    }
  });
}

function goBack() {
  router.push('/exams');
}
</script>
